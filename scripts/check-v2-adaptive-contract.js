const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { shouldRefineWriterContract } = require("../src/lib/contractPolicy");

const routine = shouldRefineWriterContract({
  topic: "식기세척기 설치 전에 확인할 공간 기준",
  finalTitle: "식기세척기 설치 전 확인할 공간과 배수 기준",
  topicMode: "manual",
  tokenMode: "balanced",
  researchResult: { searchNeed: "normal", uncertainItems: [] },
  sourceQuality: { status: "usable" }
});
assert.equal(routine.refine, false, "routine manual article should skip the extra Main contract call");

const strict = shouldRefineWriterContract({
  topic: "정부 지원금 신청 자격",
  finalTitle: "정부 지원금 신청 자격과 확인 경로",
  topicMode: "manual",
  tokenMode: "balanced",
  researchResult: { searchNeed: "strict", uncertainItems: [] },
  sourceQuality: { status: "usable", authorityEvidenceRequired: true }
});
assert.equal(strict.refine, true, "strict/high-stakes article must keep Main contract refinement");
assert.ok(strict.reasons.includes("strict_search"));

const current = shouldRefineWriterContract({
  topic: "최근 서비스 중단 이슈",
  finalTitle: "최근 서비스 중단 이후 현재 이용 가능 여부",
  topicMode: "manual",
  tokenMode: "economy",
  researchResult: { searchNeed: "normal", currentBridgeRequired: true },
  sourceQuality: { status: "usable" }
});
assert.equal(current.refine, true, "current-bridge article must keep semantic refinement even in economy mode");

const qualityMode = shouldRefineWriterContract({
  topic: "주방세제 선택 기준",
  finalTitle: "주방세제 고를 때 확인할 성분과 용도",
  topicMode: "manual",
  tokenMode: "quality",
  researchResult: { searchNeed: "light" },
  sourceQuality: { status: "usable" }
});
assert.equal(qualityMode.refine, true, "quality mode should preserve the existing refinement pass");

const runnerPath = path.join(__dirname, "..", "src", "lib", "codexRunner.js");
const runner = fs.readFileSync(runnerPath, "utf8");
assert.ok(runner.includes('require("./contractPolicy")'), "codexRunner must import contractPolicy after migration");
assert.ok(runner.includes("const contractRefinementPolicy = shouldRefineWriterContract({"), "adaptive contract policy must be wired into orchestration");
assert.ok(runner.includes("Main Agent Writer Contract 호출을 생략"), "skip path should be observable in logs/notes");
assert.ok(runner.includes("initialContractRefinement = await refineWriterContract();"), "risk path must retain original Main refinement");

console.log("V2 adaptive Writer Contract checks passed");
