const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const files = {
  main: path.join(root, "src", "main.js"),
  html: path.join(root, "src", "renderer", "index.html"),
  app: path.join(root, "src", "renderer", "app.js")
};

function replaceOnce(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`V2 history diagnostics anchor not found: ${label}`);
  return source.replace(from, to);
}

function patchMain() {
  let source = fs.readFileSync(files.main, "utf8");
  source = replaceOnce(
    source,
    'const { buildJobTokenDiagnostics } = require("./lib/jobDiagnostics");',
    'const { buildJobTokenDiagnostics, historyTokenFields } = require("./lib/jobDiagnostics");',
    "history diagnostics import"
  );
  source = source.split("        token_total: jobTokenUsage.total,\n").join("        ...historyTokenFields(jobTokenUsage),\n");
  source = source.split("      token_total: jobTokenUsage.total,\n").join("      ...historyTokenFields(jobTokenUsage),\n");
  fs.writeFileSync(files.main, source, "utf8");
}

function patchHtml() {
  let source = fs.readFileSync(files.html, "utf8");
  source = replaceOnce(
    source,
    '          <div id="agentTokenBreakdown" class="image-notes"></div>',
    '          <div id="agentTokenBreakdown" class="image-notes"></div>\n          <div id="tokenHistoryBaseline" class="image-notes"><span class="hint">최근 작업 토큰 기준선은 작업 이력에 쌓인 뒤 표시됩니다.</span></div>',
    "history baseline container"
  );
  fs.writeFileSync(files.html, source, "utf8");
}

function patchApp() {
  let source = fs.readFileSync(files.app, "utf8");
  source = replaceOnce(
    source,
    "function renderHistory(history) {",
    `function renderTokenHistoryBaseline(history = []) {\n  const target = $("#tokenHistoryBaseline");\n  if (!target) return;\n  const rows = (Array.isArray(history) ? history : [])\n    .filter((item) => Number(item?.token_total || 0) > 0)\n    .slice(0, 20);\n  if (!rows.length) {\n    target.innerHTML = '<span class="hint">최근 작업 토큰 기준선은 작업 이력에 쌓인 뒤 표시됩니다.</span>';\n    return;\n  }\n  const average = Math.round(rows.reduce((sum, item) => sum + Number(item.token_total || 0), 0) / rows.length);\n  const gross = Math.round(rows.reduce((sum, item) => sum + Math.max(Number(item.token_total || 0), Number(item.token_gross_total || 0)), 0) / rows.length);\n  const saved = Math.round(rows.reduce((sum, item) => sum + Number(item.token_saved || 0), 0) / rows.length);\n  const savings = gross > 0 ? Math.round((saved / gross) * 1000) / 10 : 0;\n  const latest = Number(rows[0]?.token_total || 0);\n  const previous = rows.slice(1);\n  const previousAverage = previous.length\n    ? Math.round(previous.reduce((sum, item) => sum + Number(item.token_total || 0), 0) / previous.length)\n    : 0;\n  const delta = previousAverage > 0 ? Math.round(((latest - previousAverage) / previousAverage) * 1000) / 10 : 0;\n  const anomaly = previous.length >= 3 && delta >= 50;\n  const largestAgent = rows.map((item) => String(item.token_largest_agent || "")).find(Boolean) || "-";\n  target.innerHTML = \`<div><strong>최근 \${rows.length}건 평균 \${average.toLocaleString()} tokens</strong> · 평균 절감 \${saved.toLocaleString()} (\${savings}%) · 최근 최대 Agent \${escapeHtml(largestAgent)}</div>\`\n    + (previousAverage ? \`<div class=\"\${anomaly ? "note warn" : "hint"}\">최근 작업은 이전 평균 대비 \${delta >= 0 ? "+" : ""}\${delta}%\${anomaly ? " — 토큰 급증 확인 필요" : ""}</div>\` : "");\n}\n\nfunction renderHistory(history) {`,
    "history token baseline renderer"
  );
  source = replaceOnce(
    source,
    "  if (summary) summary.innerHTML = renderHistorySummary(items);\n",
    "  if (summary) summary.innerHTML = renderHistorySummary(items);\n  renderTokenHistoryBaseline(items);\n",
    "render history baseline"
  );
  source = replaceOnce(
    source,
    '      ["검토 결과", item.final_verdict],\n      ["실패 단계", item.failure_phase],',
    '      ["검토 결과", item.final_verdict],\n      ["토큰 총사용", item.token_gross_total ? formatTokens(item.token_gross_total) : ""],\n      ["토큰 절감", item.token_saved ? `${formatTokens(item.token_saved)} (${Number(item.token_savings_percent || 0)}%)` : ""],\n      ["최대 사용 Agent", item.token_largest_agent],\n      ["실패 단계", item.failure_phase],',
    "history token detail rows"
  );
  fs.writeFileSync(files.app, source, "utf8");
}

patchMain();
patchHtml();
patchApp();
console.log("V2 durable history token diagnostics patch applied");
