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

// Do not tune before Research finishes: sourceQuality can become strict/high-risk only
// after supplemental search. Apply immediately before Writer Contract / Writer work.
const adaptiveMarker = "const adaptiveReasoning = chooseAdaptiveAgentModels({";
if (!source.includes(adaptiveMarker)) {
  const insertAnchor = '  const refineWriterContract = async (promptFileName = "writer-contract-prompt.txt") => {';
  if (!source.includes(insertAnchor)) throw new Error("Writer Contract function anchor not found");
  const block = [
    '  let adaptiveHistory = [];',
    '  try {',
    '    if (effectiveOptions.runtimeRoot) adaptiveHistory = readHistory(effectiveOptions.runtimeRoot);',
    '  } catch (error) {',
    '    log(`Adaptive reasoning history read skipped: ${error.message}`, "warn", "main");',
    '  }',
    '  const adaptiveReasoning = chooseAdaptiveAgentModels({',
    '    history: adaptiveHistory,',
    '    blogId: effectiveOptions.blogId || "",',
    '    tokenMode: effectiveOptions.tokenMode || effectiveOptions.tokenEfficiencyMode || "balanced",',
    '    requestedModels: effectiveOptions.agentModels,',
    '    topic: finalTitle || effectiveOptions.topic,',
    '    topicMode: effectiveOptions.topicMode,',
    '    freshnessLevel: effectiveOptions.freshnessLevel,',
    '    sourceQuality: effectiveOptions.sourceQuality',
    '  });',
    '  effectiveOptions = {',
    '    ...effectiveOptions,',
    '    agentModels: adaptiveReasoning.applied',
    '      ? normalizeAgentModels(adaptiveReasoning.agentModels)',
    '      : effectiveOptions.agentModels,',
    '    adaptiveReasoning',
    '  };',
    '  if (adaptiveReasoning.applied) {',
    '    log(`토큰 자동튜닝 적용: ${adaptiveReasoning.reasons.join(" / ")}`, "info", "main");',
    '  }',
    ''
  ].join("\n");
  source = source.replace(insertAnchor, `${block}${insertAnchor}`);
  changed = true;
}

const snapshotAnchor = '      grossAgents: { ...agentGrossTokenTotals },\n      ...savings';
const snapshotReplacement = '      grossAgents: { ...agentGrossTokenTotals },\n      adaptiveReasoning: effectiveOptions.adaptiveReasoning || null,\n      ...savings';
if (!source.includes('adaptiveReasoning: effectiveOptions.adaptiveReasoning || null')) {
  if (!source.includes(snapshotAnchor)) throw new Error("tokenUsageSnapshot savings anchor not found");
  source = source.replace(snapshotAnchor, snapshotReplacement);
  changed = true;
}

if (changed) {
  fs.writeFileSync(target, source, "utf8");
  console.log("Applied V2 conservative adaptive reasoning policy after Research");
} else {
  console.log("V2 conservative adaptive reasoning policy already applied");
}
