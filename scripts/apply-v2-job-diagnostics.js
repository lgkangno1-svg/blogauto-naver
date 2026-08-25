const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const files = {
  main: path.join(root, "src", "main.js"),
  html: path.join(root, "src", "renderer", "index.html"),
  app: path.join(root, "src", "renderer", "app.js")
};

function patchFile(filePath, patches) {
  let source = fs.readFileSync(filePath, "utf8");
  let changed = false;
  for (const { from, to, label } of patches) {
    if (source.includes(to)) continue;
    if (!source.includes(from)) throw new Error(`V2 diagnostics patch anchor not found (${path.basename(filePath)}): ${label}`);
    source = source.replace(from, to);
    changed = true;
  }
  if (changed) fs.writeFileSync(filePath, source, "utf8");
  return changed;
}

const mainChanged = patchFile(files.main, [
  {
    from: 'const { publishStatusFromError } = require("./lib/publishSafety");\n',
    to: 'const { publishStatusFromError } = require("./lib/publishSafety");\nconst { buildJobTokenDiagnostics } = require("./lib/jobDiagnostics");\n',
    label: "diagnostics import"
  },
  {
    from: `  const jobTokenUsage = {\n    total: 0,\n    grossTotal: 0,\n    inputTokens: 0,\n    cachedInputTokens: 0,\n    outputTokens: 0,\n    rateLimits: null\n  };`,
    to: `  const jobTokenUsage = {\n    total: 0,\n    grossTotal: 0,\n    inputTokens: 0,\n    cachedInputTokens: 0,\n    outputTokens: 0,\n    agents: {},\n    grossAgents: {},\n    diagnostics: buildJobTokenDiagnostics({}),\n    rateLimits: null\n  };`,
    label: "job token diagnostics state"
  },
  {
    from: `          if (usage.rateLimits) {\n            jobTokenUsage.rateLimits = usage.rateLimits;\n          }\n          emit("job:tokens", {`,
    to: `          if (usage.rateLimits) {\n            jobTokenUsage.rateLimits = usage.rateLimits;\n          }\n          const usageAgent = String(usage.agent || "").trim();\n          if (usageAgent) {\n            const agentTotal = Number(usage.agentTotal || 0);\n            if (Number.isFinite(agentTotal) && agentTotal >= 0) {\n              jobTokenUsage.agents[usageAgent] = agentTotal;\n            }\n            const grossDelta = Math.max(0, Number(usage.agentGrossDelta || 0));\n            if (grossDelta) {\n              jobTokenUsage.grossAgents[usageAgent] = Number(jobTokenUsage.grossAgents[usageAgent] || 0) + grossDelta;\n            }\n          }\n          jobTokenUsage.diagnostics = buildJobTokenDiagnostics(jobTokenUsage);\n          emit("job:tokens", {`,
    label: "live per-agent accounting"
  },
  {
    from: `            agentGrossDelta: Number(usage.agentGrossDelta || 0),\n            final: usage.final === true,`,
    to: `            agentGrossDelta: Number(usage.agentGrossDelta || 0),\n            agents: { ...jobTokenUsage.agents },\n            grossAgents: { ...jobTokenUsage.grossAgents },\n            diagnostics: jobTokenUsage.diagnostics,\n            final: usage.final === true,`,
    label: "live diagnostic payload"
  },
  {
    from: `    if (codexResult.tokenUsage?.rateLimits) {\n      jobTokenUsage.rateLimits = codexResult.tokenUsage.rateLimits;\n    }\n    persistCodexRateLimits(runtimeRoot, jobTokenUsage.rateLimits);`,
    to: `    if (codexResult.tokenUsage?.rateLimits) {\n      jobTokenUsage.rateLimits = codexResult.tokenUsage.rateLimits;\n    }\n    if (codexResult.tokenUsage?.agents && typeof codexResult.tokenUsage.agents === "object") {\n      jobTokenUsage.agents = { ...codexResult.tokenUsage.agents };\n    }\n    if (codexResult.tokenUsage?.grossAgents && typeof codexResult.tokenUsage.grossAgents === "object") {\n      jobTokenUsage.grossAgents = { ...codexResult.tokenUsage.grossAgents };\n    }\n    jobTokenUsage.diagnostics = buildJobTokenDiagnostics(jobTokenUsage);\n    persistCodexRateLimits(runtimeRoot, jobTokenUsage.rateLimits);`,
    label: "final per-agent accounting"
  }
]);

const htmlChanged = patchFile(files.html, [
  {
    from: `        <section class="panel main-log-panel" aria-label="Main Agent 로그">`,
    to: `        <section class="panel token-diagnostics-panel" aria-label="토큰 효율 진단">\n          <div class="panel-head">\n            <div>\n              <h2>토큰 효율 진단</h2>\n              <p class="hint">이번 작업에서 어떤 Agent가 토큰을 사용했고 캐시로 얼마나 절약했는지 표시합니다.</p>\n            </div>\n          </div>\n          <div class="history-summary" id="tokenDiagnosticsSummary">\n            <span class="hint">작업을 실행하면 Agent별 사용량이 표시됩니다.</span>\n          </div>\n          <div id="agentTokenBreakdown" class="image-notes"></div>\n        </section>\n\n        <section class="panel main-log-panel" aria-label="Main Agent 로그">`,
    label: "diagnostics panel"
  }
]);

const appChanged = patchFile(files.app, [
  {
    from: `function formatPercent(value) {`,
    to: `function renderJobDiagnostics(tokenUsage = {}) {\n  const diagnostics = tokenUsage?.diagnostics || {};\n  const total = Number(diagnostics.total ?? tokenUsage.total ?? 0);\n  const gross = Math.max(total, Number(diagnostics.grossTotal ?? tokenUsage.grossTotal ?? total));\n  const saved = Math.max(0, Number(diagnostics.savedTokens ?? (gross - total)));\n  const savingsPercent = Number.isFinite(Number(diagnostics.savingsPercent))\n    ? Number(diagnostics.savingsPercent)\n    : (gross > 0 ? (saved / gross) * 100 : 0);\n  const summary = $("#tokenDiagnosticsSummary");\n  if (summary) {\n    const biggest = diagnostics.largestAgent?.agent\n      ? \` · 최대 사용 \${diagnostics.largestAgent.agent} \${Number(diagnostics.largestAgent.sharePercent || 0)}%\`\n      : "";\n    summary.innerHTML = \`<strong>실사용 \${total.toLocaleString()}</strong> · 총입력기준 \${gross.toLocaleString()} · 절감 \${saved.toLocaleString()} (\${Math.round(savingsPercent * 10) / 10}%)\${biggest}\`;\n  }\n  const breakdown = $("#agentTokenBreakdown");\n  if (!breakdown) return;\n  const rows = Array.isArray(diagnostics.agentRows) ? diagnostics.agentRows : [];\n  if (!rows.length) {\n    breakdown.innerHTML = '<span class="hint">Agent별 집계 대기 중</span>';\n    return;\n  }\n  breakdown.innerHTML = rows.map((row) => {\n    const effective = Number(row.effective || 0).toLocaleString();\n    const grossAgent = Number(row.gross || row.effective || 0).toLocaleString();\n    const savedAgent = Number(row.saved || 0).toLocaleString();\n    return \`<div><strong>\${row.agent}</strong> · 실사용 \${effective} / 총 \${grossAgent} / 절감 \${savedAgent} · 비중 \${Number(row.sharePercent || 0)}%</div>\`;\n  }).join("");\n}\n\nfunction formatPercent(value) {`,
    label: "diagnostics renderer"
  },
  {
    from: `  window.blogAuto.onTokens((payload) => {\n    setTokenUsage(payload);`,
    to: `  window.blogAuto.onTokens((payload) => {\n    setTokenUsage(payload);\n    renderJobDiagnostics(payload);`,
    label: "live diagnostics"
  },
  {
    from: `    if (payload.tokenUsage) setTokenUsage(payload.tokenUsage);\n    if (payload.tokenUsage?.rateLimits)`,
    to: `    if (payload.tokenUsage) {\n      setTokenUsage(payload.tokenUsage);\n      renderJobDiagnostics(payload.tokenUsage);\n    }\n    if (payload.tokenUsage?.rateLimits)`,
    label: "preview diagnostics"
  },
  {
    from: `    if (payload.tokenUsage) setTokenTotal(payload.tokenUsage.total || 0);\n    if (payload.tokenUsage?.rateLimits)`,
    to: `    if (payload.tokenUsage) {\n      setTokenUsage(payload.tokenUsage);\n      renderJobDiagnostics(payload.tokenUsage);\n    }\n    if (payload.tokenUsage?.rateLimits)`,
    label: "completion diagnostics"
  },
  {
    from: `  setTokenTotal(0);\n  $("#articlePreview").value = "";`,
    to: `  setTokenUsage({ total: 0, grossTotal: 0 });\n  renderJobDiagnostics({ total: 0, grossTotal: 0 });\n  $("#articlePreview").value = "";`,
    label: "manual reset diagnostics"
  }
]);

console.log(`V2 job diagnostics patch: main=${mainChanged} html=${htmlChanged} app=${appChanged}`);
