const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const runnerPath = path.join(root, "src", "lib", "codexRunner.js");
let source = fs.readFileSync(runnerPath, "utf8");
let changed = false;

function replaceOnce(from, to, label) {
  if (source.includes(to)) return;
  if (!source.includes(from)) {
    throw new Error(`V2 patch anchor not found: ${label}`);
  }
  source = source.replace(from, to);
  changed = true;
}

function replaceAllExact(from, to, label) {
  if (source.includes(to) && !source.includes(from)) return;
  if (!source.includes(from)) throw new Error(`V2 patch anchor not found: ${label}`);
  source = source.split(from).join(to);
  changed = true;
}

function ensureRequire(requireLine) {
  if (source.includes(requireLine)) return;
  const spawnLine = 'const { spawn } = require("node:child_process");';
  if (!source.includes(spawnLine)) {
    throw new Error(`V2 patch anchor not found while adding import: ${requireLine}`);
  }
  source = source.replace(spawnLine, `${spawnLine}\n${requireLine}`);
  changed = true;
}

// Imports must be checked independently. Other V2 modules may be inserted between
// them, so relying on one exact multi-line import block is not rerun-safe.
ensureRequire('const { evaluateArticleQuality } = require("./qualityGate");');
ensureRequire('const { adaptiveEffort, tokenSavings } = require("./tokenPolicy");');
ensureRequire('const { buildEvidenceLedger, compactResearchHandoff } = require("./evidenceLedger");');

replaceOnce(
  '  let taskEffort = modelEffortForAgent(options, agent);',
  '  let taskEffort = adaptiveEffort(options, agent, modelEffortForAgent(options, agent));',
  "adaptive effort"
);

replaceOnce(
  `  const tokenUsageSnapshot = () => ({\n    total: totalTokens,\n    grossTotal: totalGrossTokens,\n    rateLimits: latestRateLimits,\n    agents: { ...agentTokenTotals },\n    grossAgents: { ...agentGrossTokenTotals }\n  });`,
  `  const tokenUsageSnapshot = () => {\n    const savings = tokenSavings(totalGrossTokens, totalTokens);\n    return {\n      total: totalTokens,\n      grossTotal: totalGrossTokens,\n      rateLimits: latestRateLimits,\n      agents: { ...agentTokenTotals },\n      grossAgents: { ...agentGrossTokenTotals },\n      ...savings\n    };\n  };`,
  "token savings snapshot"
);

replaceOnce(
  '  const maxReviewAttempts = String(effectiveOptions.topicMode || "").toLowerCase() === "auto" ? 3 : 1;',
  '  const maxReviewAttempts = String(effectiveOptions.topicMode || "").toLowerCase() === "auto" ? 3 : 2;',
  "manual deterministic repair allowance"
);

replaceOnce(
  `    JSON.stringify(compactSearchResultsForPrompt(searchResults, {\n      maxResults: 8,\n      excerptChars: 700\n    }), null, 2),`,
  `    JSON.stringify(buildEvidenceLedger(searchResults, {\n      topic,\n      keyword,\n      maxSources: 8,\n      maxEvidenceChars: 360\n    }), null, 2),`,
  "writer evidence ledger"
);

replaceOnce(
  '    researchTitleResult ? "Full Research/Title handoff for factual support only:" : "",\n    researchTitleResult ? JSON.stringify(researchTitleResult, null, 2) : "",',
  '    researchTitleResult ? "Compact Research/Title handoff for factual support only:" : "",\n    researchTitleResult ? JSON.stringify(compactResearchHandoff(researchTitleResult), null, 2) : "",',
  "compact writer handoff"
);

replaceOnce(
  '    JSON.stringify(historyTitles.slice(0, 80), null, 2),',
  '    JSON.stringify(historyTitles.slice(0, 30), null, 2),',
  "compact duplicate awareness"
);

replaceAllExact(
  '    JSON.stringify(researchTitleResult || {}, null, 2),',
  '    JSON.stringify(compactResearchHandoff(researchTitleResult || {}), null, 2),',
  "compact downstream research handoff"
);

const deterministicGateAlreadyIntegrated = source.includes("let deterministicQuality = evaluateArticleQuality({")
  || source.includes("const deterministicQuality = evaluateArticleQuality({")
  || source.includes("Writer 부분 수정 시작:");
if (!deterministicGateAlreadyIntegrated) {
  replaceOnce(
    `    log(\`Writer Agent 본문 작성 완료 (\${attempt}/\${maxReviewAttempts})\`, "info", "writer");\n    log(\`Main Agent 최종 검수 시작 (\${attempt}/\${maxReviewAttempts})\`, "info", "main");`,
    `    const deterministicQuality = evaluateArticleQuality({\n      topic: effectiveOptions.topic || finalTitle,\n      title: String(writerResult.title || finalTitle || "").trim(),\n      article: String(writerResult.article || ""),\n      historyTitles: effectiveOptions.historyTitles || [],\n      searchResults: effectiveOptions.searchResults || [],\n      sourceQuality: effectiveOptions.sourceQuality || null\n    });\n    writerResult = { ...writerResult, deterministicQuality };\n\n    if (!deterministicQuality.pass) {\n      const qualityReason = deterministicQuality.repairFeedback || "Deterministic quality gate failed.";\n      log(\`무료 품질 게이트 감지: \${qualityReason}\`, deterministicQuality.hardBlock ? "warn" : "info", "main");\n      if (attempt < maxReviewAttempts) {\n        writerRevisionFeedback = compactTextList([\n          \`Deterministic quality gate repair scope: \${deterministicQuality.repairScope}\`,\n          qualityReason\n        ]).join(" / ").slice(0, 3000);\n        log(\`Main Agent 호출 전에 Writer가 문제 부분을 먼저 수정합니다 (\${attempt + 1}/\${maxReviewAttempts})\`, "info", "main");\n        continue;\n      }\n      return {\n        status: "failed",\n        failurePhase: "quality_gate",\n        failureReason: qualityReason,\n        title: "",\n        article: "",\n        tags: [],\n        bodyImages: [],\n        titleImagePath: "",\n        notes: deterministicQuality.issues.map((item) => item.message),\n        researchTitleResult: researchResult,\n        deterministicQuality,\n        tokenUsage: tokenUsageSnapshot()\n      };\n    }\n\n    log(\`Writer Agent 본문 작성 완료 (\${attempt}/\${maxReviewAttempts})\`, "info", "writer");\n    log(\`Main Agent 최종 검수 시작 (\${attempt}/\${maxReviewAttempts})\`, "info", "main");`,
    "deterministic gate before main review"
  );
}

if (changed) {
  fs.writeFileSync(runnerPath, source, "utf8");
  console.log("Applied V2 core patch to src/lib/codexRunner.js");
} else {
  console.log("V2 core patch already applied");
}
