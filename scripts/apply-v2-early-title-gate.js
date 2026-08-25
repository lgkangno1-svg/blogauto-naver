const fs = require("node:fs");
const path = require("node:path");

const target = path.join(__dirname, "..", "src", "lib", "codexRunner.js");
let source = fs.readFileSync(target, "utf8");
let changed = false;

const importAnchor = 'const { evaluateArticleQuality } = require("./qualityGate");';
const importReplacement = `${importAnchor}\nconst { evaluateTitleNovelty } = require("./titleNovelty");`;
if (!source.includes('require("./titleNovelty")')) {
  if (!source.includes(importAnchor)) throw new Error("qualityGate import anchor not found");
  source = source.replace(importAnchor, importReplacement);
  changed = true;
}

const insertionAnchor = '  const refineWriterContract = async (promptFileName = "writer-contract-prompt.txt") => {';
const gateMarker = 'const earlyTitleNovelty = evaluateTitleNovelty(finalTitle';
if (!source.includes(gateMarker)) {
  if (!source.includes(insertionAnchor)) throw new Error("writer contract anchor not found");
  const block = `  const earlyTitleNovelty = evaluateTitleNovelty(\n    finalTitle,\n    effectiveOptions.historyTitles || [],\n    { maxTitleSimilarity: 0.72 }\n  );\n  if (!earlyTitleNovelty.pass) {\n    const duplicateReason = earlyTitleNovelty.reason || "최근 제목과 지나치게 유사한 제목이 선택되었습니다.";\n    log(\n      \`Research/Title Agent 조기 중복 차단: \${duplicateReason} Writer/Main/Image 호출을 생략합니다.\`,\n      "warn",\n      "research"\n    );\n    return {\n      status: "failed",\n      failurePhase: "duplicate",\n      failureReason: duplicateReason,\n      title: "",\n      article: "",\n      tags: [],\n      bodyImages: [],\n      titleImagePath: "",\n      notes: compactTextList([\n        duplicateReason,\n        earlyTitleNovelty.closestTitle\n          ? \`가장 유사한 최근 제목: \${earlyTitleNovelty.closestTitle}\`\n          : ""\n      ]),\n      researchTitleResult: researchResult,\n      optimization: {\n        earlyExit: "duplicate_title",\n        skippedStages: ["writer_contract", "writer", "main_review", "image"]\n      },\n      tokenUsage: tokenUsageSnapshot()\n    };\n  }\n\n`;
  source = source.replace(insertionAnchor, block + insertionAnchor);
  changed = true;
}

if (changed) {
  fs.writeFileSync(target, source, "utf8");
  console.log("Applied V2 early title novelty gate");
} else {
  console.log("V2 early title novelty gate already applied");
}
