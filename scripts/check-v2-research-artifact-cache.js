const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  buildSourceSetFingerprint,
  evaluateResearchArtifactCacheEligibility,
  buildResearchArtifactCacheKey,
  readResearchArtifactCache,
  writeResearchArtifactCache,
  ttlForFreshness
} = require("../src/lib/researchArtifactCache");
const { buildJobTokenDiagnostics, historyTokenFields } = require("../src/lib/jobDiagnostics");

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "blogauto-research-artifact-cache-"));
const sourceA = {
  sourceId: "S1",
  title: "정리 안내",
  url: "https://example.com/a",
  excerpt: "주방세제 성분 비교에서 계면활성제 종류와 사용 목적을 함께 확인해야 합니다. ".repeat(8),
  relevance: { score: 9, currentFactSignal: false, strictEvidence: false }
};
const sourceB = {
  sourceId: "S2",
  title: "비교 자료",
  url: "https://example.com/b",
  excerpt: "세척력뿐 아니라 헹굼 편의와 사용량도 비교 기준이 될 수 있습니다. ".repeat(8),
  relevance: { score: 7, independentSource: true }
};
const baseOptions = {
  runtimeRoot: temp,
  topicMode: "manual",
  topic: "주방세제 성분 비교",
  keyword: "주방세제",
  category: "생활",
  publishPurpose: "구매 전 확인할 기준 정리",
  preferredTone: "친절하고 구체적으로",
  freshnessLevel: "low",
  currentDateLabel: "2026-08-30",
  tokenEfficiencyMode: "balanced",
  codexModel: "gpt-5.6-sol",
  agentModels: { research: "medium" },
  historyTitles: ["기존 제목"],
  keywordLanes: [],
  recommendedKeywordLanes: [],
  sourceQuality: {
    status: "usable",
    directlyRelevantCandidates: 2,
    topicMatchedCandidates: 2,
    strongEvidenceCandidates: 0,
    authorityEvidenceRequired: false,
    independentEvidenceRequired: false
  },
  searchResults: [sourceA, sourceB]
};
const safeClassification = { searchNeed: "normal", reasons: [] };
const riskClassification = { searchNeed: "strict", reasons: ["high_stakes_fact_pattern"] };
const passResult = {
  status: "PASS",
  failureReason: "",
  finalTitle: "주방세제 성분 비교, 세척력만 보면 놓치는 기준",
  topicThesis: "주방세제 성분과 실제 선택 기준을 함께 비교한다.",
  directTopicPreserved: true,
  factBased: true,
  searchNeed: "normal",
  searchFlowSummary: "두 자료에서 직접 관련 기준을 정리함",
  coreQuestions: ["어떤 성분을 봐야 하나"],
  mustCover: ["성분", "사용 목적"],
  confirmedFacts: ["제품별 성분 구성은 다를 수 있다"],
  usableSources: [{ sourceId: "S1", title: sourceA.title, url: sourceA.url, reason: "직접 관련" }],
  writerContract: {
    articleMission: "선택 기준 설명",
    selectedTitle: "주방세제 성분 비교, 세척력만 보면 놓치는 기준",
    topicThesis: "주방세제 성분과 실제 선택 기준을 함께 비교한다.",
    targetReader: "구매 전 비교하는 독자",
    readerPromise: "성분과 사용 목적을 구분해 선택할 수 있게 한다",
    firstSectionFocus: "세척력 외 기준부터 설명",
    mustAnswer: ["성분 차이"],
    mustCover: ["사용 목적"],
    mustNotDo: ["근거 없는 우열 단정 금지"],
    confirmedFacts: ["제품별 구성 차이"],
    uncertainItems: [],
    sourceBoundaries: ["S1"],
    safetyBoundaries: [],
    recommendedStructure: ["성분", "선택 기준"],
    readerValueChecklist: ["비교 기준 제공"],
    currentBridgeRequired: false,
    currentBridgeSatisfied: false,
    tone: "친절하고 구체적으로"
  },
  ignoredHugeField: "x".repeat(20000)
};

try {
  assert(ttlForFreshness("low") > ttlForFreshness("medium"));
  assert.equal(ttlForFreshness("high"), 0);

  const forward = buildSourceSetFingerprint([sourceA, sourceB]);
  const reverse = buildSourceSetFingerprint([sourceB, sourceA]);
  assert.equal(forward.hash, reverse.hash);
  assert.equal(forward.sourceCount, 2);

  const eligible = evaluateResearchArtifactCacheEligibility(baseOptions, safeClassification);
  assert.equal(eligible.eligible, true);

  const strict = evaluateResearchArtifactCacheEligibility(baseOptions, riskClassification);
  assert.equal(strict.eligible, false);
  assert.equal(strict.reason, "strict_research_not_cacheable");

  const autoTopic = evaluateResearchArtifactCacheEligibility({ ...baseOptions, topicMode: "auto" }, safeClassification);
  assert.equal(autoTopic.eligible, false);

  const keyA = buildResearchArtifactCacheKey(baseOptions, safeClassification);
  const keyOrderChanged = buildResearchArtifactCacheKey({ ...baseOptions, searchResults: [sourceB, sourceA] }, safeClassification);
  assert.equal(keyA.key, keyOrderChanged.key);

  const changedSource = { ...sourceA, excerpt: `${sourceA.excerpt} 새로 변경된 핵심 사실` };
  const keyChangedContent = buildResearchArtifactCacheKey({ ...baseOptions, searchResults: [changedSource, sourceB] }, safeClassification);
  assert.notEqual(keyA.key, keyChangedContent.key);

  const keyChangedTopic = buildResearchArtifactCacheKey({ ...baseOptions, topic: "주방세제 향 비교" }, safeClassification);
  assert.notEqual(keyA.key, keyChangedTopic.key);

  const now = new Date("2026-08-30T00:00:00Z");
  const write = writeResearchArtifactCache({ options: baseOptions, classification: safeClassification, result: passResult, now });
  assert.equal(write.written, true);
  assert.equal(write.artifact.ignoredHugeField, undefined);

  const hit = readResearchArtifactCache({
    options: baseOptions,
    classification: safeClassification,
    nowMs: Date.parse("2026-08-30T01:00:00Z")
  });
  assert.equal(hit.hit, true);
  assert.equal(hit.artifact.finalTitle, passResult.finalTitle);
  assert.equal(hit.artifact.directTopicPreserved, true);

  const stale = readResearchArtifactCache({
    options: baseOptions,
    classification: safeClassification,
    nowMs: Date.parse("2026-08-31T00:00:01Z")
  });
  assert.equal(stale.hit, false);
  assert.equal(stale.reason, "expired");

  const currentNormal = evaluateResearchArtifactCacheEligibility(baseOptions, {
    searchNeed: "normal",
    reasons: ["current_or_date_bound_pattern"]
  });
  assert.equal(currentNormal.eligible, true);

  const changedDateKey = buildResearchArtifactCacheKey({ ...baseOptions, currentDateLabel: "2026-08-31" }, safeClassification);
  assert.notEqual(keyA.key, changedDateKey.key);

  const originalPayload = JSON.parse(fs.readFileSync(write.filePath, "utf8"));
  fs.writeFileSync(write.filePath, `${JSON.stringify({ ...originalPayload, version: 999 })}\n`, "utf8");
  const invalidVersion = readResearchArtifactCache({
    options: baseOptions,
    classification: safeClassification,
    nowMs: Date.parse("2026-08-30T01:00:00Z")
  });
  assert.equal(invalidVersion.hit, false);
  assert.equal(invalidVersion.reason, "schema_or_key_mismatch");
  writeResearchArtifactCache({ options: baseOptions, classification: safeClassification, result: passResult, now });

  const optimization = {
    preflight: { applied: true, searchMode: "normal", reason: "current_or_date_bound_pattern", codexDecisionCallSkipped: true },
    artifactCache: { eligible: true, hit: true, reason: "hit", codexResearchCallSkipped: true, stored: false, sourceSetHash: keyA.context.sourceSetHash }
  };
  const diagnostics = buildJobTokenDiagnostics({ total: 900, grossTotal: 1200, researchOptimization: optimization });
  assert.equal(diagnostics.researchOptimization.preflight.codexDecisionCallSkipped, true);
  assert.equal(diagnostics.researchOptimization.artifactCache.hit, true);
  const historyFields = historyTokenFields({ total: 900, grossTotal: 1200, researchOptimization: optimization, diagnostics });
  assert.equal(historyFields.research_preflight_skipped_call, true);
  assert.equal(historyFields.research_cache_hit, true);
  assert.equal(historyFields.research_cache_skipped_call, true);

  const highFreshness = evaluateResearchArtifactCacheEligibility({ ...baseOptions, freshnessLevel: "high" }, safeClassification);
  assert.equal(highFreshness.eligible, false);
  assert.equal(highFreshness.reason, "high_freshness_not_cacheable");

  console.log("V2 Research artifact cache checks passed");
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
