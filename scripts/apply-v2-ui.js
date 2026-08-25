const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const files = {
  settings: path.join(root, "src", "lib", "settings.js"),
  html: path.join(root, "src", "renderer", "index.html"),
  app: path.join(root, "src", "renderer", "app.js")
};

function patchFile(filePath, patches) {
  let source = fs.readFileSync(filePath, "utf8");
  let changed = false;
  for (const { from, to, label } of patches) {
    if (source.includes(to)) continue;
    if (!source.includes(from)) throw new Error(`V2 UI patch anchor not found (${path.basename(filePath)}): ${label}`);
    source = source.replace(from, to);
    changed = true;
  }
  if (changed) fs.writeFileSync(filePath, source, "utf8");
  return changed;
}

const settingsChanged = patchFile(files.settings, [
  {
    from: '  agentHarnessMode: "lean"\n};',
    to: '  tokenEfficiencyMode: "balanced",\n  agentHarnessMode: "lean"\n};',
    label: "settings token mode"
  }
]);

const htmlChanged = patchFile(files.html, [
  {
    from: `          <label>\n            <span>Main Agent</span>`,
    to: `          <label>\n            <span>토큰 모드</span>\n            <select id="tokenEfficiencyMode">\n              <option value="economy">절약</option>\n              <option value="balanced" selected>균형</option>\n              <option value="quality">품질 우선</option>\n            </select>\n          </label>\n          <label>\n            <span>Main Agent</span>`,
    label: "token mode control"
  },
  {
    from: '          <span id="tokenBadge" class="badge token">누적 0 tokens</span>\n',
    to: '          <span id="tokenBadge" class="badge token">누적 0 tokens</span>\n          <span id="tokenSavingsBadge" class="badge token">캐시/절감 0%</span>\n',
    label: "token savings badge"
  }
]);

const appChanged = patchFile(files.app, [
  {
    from: '  tokenTotal: 0,\n  codexRateLimits: null,',
    to: '  tokenTotal: 0,\n  tokenGrossTotal: 0,\n  tokenSavedTotal: 0,\n  codexRateLimits: null,',
    label: "token state"
  },
  {
    from: `function setTokenTotal(total) {\n  state.tokenTotal = Number(total || 0);\n  $("#tokenBadge").textContent = \`누적 \${formatTokens(state.tokenTotal)}\`;\n}\n`,
    to: `function setTokenTotal(total) {\n  state.tokenTotal = Number(total || 0);\n  $("#tokenBadge").textContent = \`누적 \${formatTokens(state.tokenTotal)}\`;\n}\n\nfunction setTokenUsage(payload = {}) {\n  const total = Number(payload.total || 0);\n  const gross = Math.max(total, Number(payload.grossTotal || total || 0));\n  const saved = Math.max(0, Number(payload.cachedOrSavedTokens ?? (gross - total)));\n  const savingsPercent = Number.isFinite(Number(payload.savingsPercent))\n    ? Number(payload.savingsPercent)\n    : (gross > 0 ? ((saved / gross) * 100) : 0);\n  state.tokenGrossTotal = gross;\n  state.tokenSavedTotal = saved;\n  setTokenTotal(total);\n  const badge = $("#tokenSavingsBadge");\n  if (badge) badge.textContent = \`캐시/절감 \${Math.round(savingsPercent * 10) / 10}% · \${saved.toLocaleString()}\`;\n}\n`,
    label: "token usage renderer"
  },
  {
    from: '    codexModel: normalizeCodexModel($("#codexModel")?.value),\n',
    to: '    codexModel: normalizeCodexModel($("#codexModel")?.value),\n    tokenEfficiencyMode: $("#tokenEfficiencyMode")?.value || "balanced",\n',
    label: "collect token mode"
  },
  {
    from: '    maxBodyImages: "#maxBodyImages"\n',
    to: '    maxBodyImages: "#maxBodyImages",\n    tokenEfficiencyMode: "#tokenEfficiencyMode"\n',
    label: "apply token mode"
  },
  {
    from: '    codexModel: form.codexModel,\n    agentModels: form.agentModels\n',
    to: '    codexModel: form.codexModel,\n    tokenEfficiencyMode: form.tokenEfficiencyMode,\n    agentModels: form.agentModels\n',
    label: "save token mode"
  },
  {
    from: `  window.blogAuto.onTokens((payload) => {\n    setTokenTotal(payload.total || 0);`,
    to: `  window.blogAuto.onTokens((payload) => {\n    setTokenUsage(payload);`,
    label: "live token event"
  },
  {
    from: '    if (payload.tokenUsage) setTokenTotal(payload.tokenUsage.total || 0);\n',
    to: '    if (payload.tokenUsage) setTokenUsage(payload.tokenUsage);\n',
    label: "preview token event"
  }
]);

console.log(`V2 UI patch: settings=${settingsChanged} html=${htmlChanged} app=${appChanged}`);
