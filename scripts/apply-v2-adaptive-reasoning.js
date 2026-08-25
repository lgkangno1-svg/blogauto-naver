const fs = require("node:fs");
const path = require("node:path");

const target = path.join(__dirname, "..", "src", "lib", "codexRunner.js");
let source = fs.readFileSync(target, "utf8");
let changed = false;

const importAnchor = 'const { shouldRefineWriterContract } = require("./contractPolicy");';
const imports = [
  'const { readHistory } = require("./history");',
  'const { chooseAdaptiveAgentModels } = require("./adaptiveReasoning");'
];
for (const importLine of imports) {
  if (source.includes(importLine)) continue;
  if (!source.includes(importAnchor)) throw new Error("contractPolicy import anchor not found");
  source = source.replace(importAnchor, `${importAnchor}\n${importLine}`);
  changed = true;
}

const effectiveOptionsAnchor = `  let effectiveOptions = {\n    ...options,\n    codexModel: normalizeCodexModel(options.codexModel),\n    agentModels: normalizeAgentModels(options.agentModels),\n    searchResults: Array.isArray(options.searchResults) ? options.searchResults : [],\n    sourceQuality: options.sourceQuality || { status: "not_requested" }\n  };`;
const marker = "const adaptiveReasoning = chooseAdaptiveAgentModels({";
if (!source.includes(marker)) {
  if (!source.includes(effectiveOptionsAnchor)) throw new Error("effectiveOptions anchor not found");
  const block = `${effectiveOptionsAnchor}\n  let adaptiveHistory = [];\n  try {\n    if (effectiveOptions.runtimeRoot) adaptiveHistory = readHistory(effectiveOptions.runtimeRoot);\n  } catch (error) {\n    log(\`Adaptive reasoning history read skipped: \${error.message}\`, "warn", "main");\n  }\n  const adaptiveReasoning = chooseAdaptiveAgentModels({\n    history: adaptiveHistory,\n    blogId: effectiveOptions.blogId || "",\n    tokenMode: effectiveOptions.tokenMode || effectiveOptions.tokenEfficiencyMode || "balanced",\n    requestedModels: effectiveOptions.agentModels,\n    topic: effectiveOptions.topic,\n    topicMode: effectiveOptions.topicMode,\n    freshnessLevel: effectiveOptions.freshnessLevel,\n    sourceQuality: effectiveOptions.sourceQuality\n  });\n  if (adaptiveReasoning.applied) {\n    effectiveOptions = {\n      ...effectiveOptions,\n      agentModels: normalizeAgentModels(adaptiveReasoning.agentModels),\n      adaptiveReasoning\n    };\n    log(\`토큰 자동튜닝 적용: \${adaptiveReasoning.reasons.join(" / ")}\`, "info", "main");\n  } else {\n    effectiveOptions = { ...effectiveOptions, adaptiveReasoning };\n  }`;
  source = source.replace(effectiveOptionsAnchor, block);
  changed = true;
}

const tokenSnapshotAnchor = `  const tokenUsageSnapshot = () => ({\n    total: totalTokens,\n    grossTotal: totalGrossTokens,\n    rateLimits: latestRateLimits,\n    agents: { ...agentTokenTotals },\n    grossAgents: { ...agentGrossTokenTotals }\n  });`;
const adaptiveSnapshot = `  const tokenUsageSnapshot = () => ({\n    total: totalTokens,\n    grossTotal: totalGrossTokens,\n    rateLimits: latestRateLimits,\n    agents: { ...agentTokenTotals },\n    grossAgents: { ...agentGrossTokenTotals },\n    adaptiveReasoning: effectiveOptions.adaptiveReasoning || null\n  });`;
if (!source.includes("adaptiveReasoning: effectiveOptions.adaptiveReasoning || null")) {
  if (!source.includes(tokenSnapshotAnchor)) throw new Error("tokenUsageSnapshot anchor not found");
  source = source.replace(tokenSnapshotAnchor, adaptiveSnapshot);
  changed = true;
}

if (changed) {
  fs.writeFileSync(target, source, "utf8");
  console.log("Applied V2 conservative adaptive reasoning policy");
} else {
  console.log("V2 conservative adaptive reasoning policy already applied");
}
