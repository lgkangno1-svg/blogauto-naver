const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const runnerPath = path.join(root, "src", "lib", "codexRunner.js");
let source = fs.readFileSync(runnerPath, "utf8");

function replaceOnce(haystack, needle, replacement, label) {
  if (haystack.includes(replacement)) return haystack;
  const index = haystack.indexOf(needle);
  if (index < 0) {
    throw new Error(`V2 partial repair patch failed: ${label} anchor not found`);
  }
  return haystack.slice(0, index) + replacement + haystack.slice(index + needle.length);
}

const evidenceImport = 'const { buildEvidenceLedger, compactResearchHandoff } = require("./evidenceLedger");';
const repairImport = 'const { planPartialRepair, buildPartialRepairPrompt, mergePartialRepairResult, partialRepairEffort } = require("./partialRepair");';
if (!source.includes(repairImport)) {
  source = replaceOnce(
    source,
    evidenceImport,
    `${evidenceImport}\n${repairImport}`,
    "partial repair import"
  );
}

source = source.replace(
  "    const deterministicQuality = evaluateArticleQuality({",
  "    let deterministicQuality = evaluateArticleQuality({"
);

const anchor = `    writerResult = { ...writerResult, deterministicQuality };\n\n    if (!deterministicQuality.pass) {`;
const integrated = `    writerResult = { ...writerResult, deterministicQuality };\n\n    if (!deterministicQuality.pass) {\n      const repairPlan = planPartialRepair(deterministicQuality);\n      if (repairPlan.eligible) {\n        log(\`Writer 부분 수정 시작: \${repairPlan.issueCodes.join(", ")}\`, "info", "writer");\n        const repairResultFileName = \`writer-partial-repair-\${attempt}-result.json\`;\n        const repairResult = await runCodexTask({\n          options: {\n            ...effectiveOptions,\n            agentModels: {\n              ...(effectiveOptions.agentModels || {}),\n              writer: partialRepairEffort(effectiveOptions.tokenEfficiencyMode)\n            }\n          },\n          prompt: buildPartialRepairPrompt({\n            writerResult,\n            deterministicQuality,\n            topic: effectiveOptions.topic || finalTitle,\n            keyword: effectiveOptions.keyword || "",\n            searchResults: effectiveOptions.searchResults || [],\n            resultPath: path.join(effectiveOptions.jobDir, repairResultFileName)\n          }),\n          promptFileName: \`writer-partial-repair-\${attempt}-prompt.txt\`,\n          resultFileName: repairResultFileName,\n          log,\n          tokenOffset: totalTokens,\n          grossTokenOffset: totalGrossTokens,\n          agentTokenOffset: agentTokenTotals.writer,\n          agent: "writer"\n        });\n        totalTokens += Number(repairResult.tokenUsage?.total || 0);\n        totalGrossTokens += Number(repairResult.tokenUsage?.grossTotal || repairResult.tokenUsage?.total || 0);\n        agentTokenTotals.writer += Number(repairResult.tokenUsage?.total || 0);\n        agentGrossTokenTotals.writer += Number(repairResult.tokenUsage?.grossTotal || repairResult.tokenUsage?.total || 0);\n        rememberRateLimits(repairResult);\n\n        const repairedWriterResult = mergePartialRepairResult(writerResult, repairResult);\n        if (repairedWriterResult) {\n          const repairedQuality = evaluateArticleQuality({\n            topic: effectiveOptions.topic || finalTitle,\n            title: String(repairedWriterResult.title || finalTitle || "").trim(),\n            article: String(repairedWriterResult.article || ""),\n            historyTitles: effectiveOptions.historyTitles || [],\n            searchResults: effectiveOptions.searchResults || [],\n            sourceQuality: effectiveOptions.sourceQuality || null\n          });\n          if (repairedQuality.pass) {\n            deterministicQuality = repairedQuality;\n            writerResult = {\n              ...repairedWriterResult,\n              deterministicQuality: repairedQuality,\n              partialRepair: {\n                applied: true,\n                issueCodes: repairPlan.issueCodes,\n                tokenUsage: repairResult.tokenUsage || null\n              }\n            };\n            log("Writer 부분 수정으로 무료 품질 게이트를 통과했습니다. 전체 본문 재작성은 생략합니다.", "info", "writer");\n          } else {\n            log(\`Writer 부분 수정 후에도 품질 문제가 남아 기존 전체 재작성 경로로 전환합니다: \${repairedQuality.repairFeedback || "unknown"}\`, "warn", "writer");\n            deterministicQuality = repairedQuality;\n            writerResult = { ...repairedWriterResult, deterministicQuality: repairedQuality };\n          }\n        } else {\n          log("Writer 부분 수정 결과가 유효하지 않아 기존 전체 재작성 경로로 전환합니다.", "warn", "writer");\n        }\n      }\n    }\n\n    if (!deterministicQuality.pass) {`;

if (!source.includes("Writer 부분 수정 시작:")) {
  source = replaceOnce(source, anchor, integrated, "deterministic quality partial repair");
}

fs.writeFileSync(runnerPath, source, "utf8");
console.log("V2 partial repair patch applied");
