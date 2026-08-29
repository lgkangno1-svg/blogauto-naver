const assert = require("node:assert/strict");
const { evaluateArticleQuality } = require("../src/lib/qualityGate");
const { adaptiveEffort, tokenSavings } = require("../src/lib/tokenPolicy");
const { buildEvidenceLedger, compactResearchHandoff } = require("../src/lib/evidenceLedger");
const {
  planPartialRepair,
  buildPartialRepairPrompt,
  mergePartialRepairResult,
  partialRepairEffort
} = require("../src/lib/partialRepair");
const {
  normalizeComparableText,
  titleVerificationNeedle,
  publishOutcomeUncertainError,
  publishStatusFromError,
  shouldAutoRetryStatus
} = require("../src/lib/publishSafety");

function base(overrides = {}) {
  return {
    topic: "통신비 절약 방법",
    title: "통신비 줄이기 전에 확인할 조건",
    article: "약정과 데이터 사용량을 먼저 확인해야 합니다. ".repeat(35),
    historyTitles: [],
    searchResults: [],
    sourceQuality: { status: "usable" },
    ...overrides
  };
}

{
  const result = evaluateArticleQuality(base({
    article: `제가 직접 3개월 사용해 보니 좋았습니다. ${"약정 조건을 확인해야 합니다. ".repeat(35)}`
  }));
  assert.equal(result.pass, false);
  assert.ok(result.issues.some((item) => item.code === "fabricated_experience"));
}

{
  const result = evaluateArticleQuality(base({
    article: `월 3만원을 무조건 아낄 수 있습니다. ${"조건을 비교해야 합니다. ".repeat(35)}`
  }));
  assert.ok(result.issues.some((item) => item.code === "unsupported_numeric_claim"));
}

{
  const result = evaluateArticleQuality(base({
    article: `공식 안내에는 월 3만원 조건이 표시되어 있습니다. ${"조건을 비교해야 합니다. ".repeat(35)}`,
    searchResults: [{
      title: "공식 안내",
      excerpt: "월 3만원 조건",
      relevance: { officialSource: true }
    }]
  }));
  assert.equal(result.issues.some((item) => item.code === "unsupported_numeric_claim"), false);
}

{
  const title = "통신비 줄이기 전에 확인할 조건";
  const result = evaluateArticleQuality(base({ title, historyTitles: [title] }));
  assert.ok(result.issues.some((item) => item.code === "duplicate_title"));
}

{
  const longExcerpt = [
    "통신비 요금제는 데이터 사용량과 약정 조건을 함께 비교해야 합니다.",
    "공식 안내에는 월 3만원 조건이 표시되어 있습니다.",
    "관련 없는 매우 긴 배경 설명입니다. ".repeat(80)
  ].join(" ");
  const ledger = buildEvidenceLedger([{ title: "공식 요금 안내", excerpt: longExcerpt, relevance: { score: 10, officialSource: true } }], {
    topic: "통신비 요금제 비교",
    keyword: "통신비",
    maxEvidenceChars: 300
  });
  assert.equal(ledger.sourceCount, 1);
  assert.equal(ledger.sources[0].sourceType, "official");
  assert.ok(JSON.stringify(ledger).length < longExcerpt.length);
  assert.ok(ledger.sources[0].facts.join(" ").includes("통신비"));
}

{
  // Evidence must be authority-first even when the raw result list starts with UGC,
  // and duplicate URLs must not spend prompt budget twice.
  const ledger = buildEvidenceLedger([
    {
      title: "개인 블로그 요약",
      url: "https://blog.example/post",
      excerpt: "통신비 관련 개인 의견입니다.",
      relevance: { score: 14, lowTrustSource: true }
    },
    {
      title: "공식 통신비 안내",
      url: "https://gov.example/guide",
      excerpt: "통신비 할인 대상과 신청 조건을 공식 안내합니다. 월 3만원 조건은 대상별로 다릅니다.",
      relevance: { score: 8, officialSource: true, strictEvidence: true, currentFactSignal: true }
    },
    {
      title: "공식 통신비 안내 복제 결과",
      fetchedUrl: "https://gov.example/guide",
      excerpt: "같은 페이지가 검색 공급자에서 중복 수집됐습니다.",
      relevance: { score: 7, officialSource: true }
    }
  ], {
    topic: "통신비 할인 신청 조건",
    maxSources: 2,
    maxTotalEvidenceChars: 500
  });
  assert.equal(ledger.sources[0].sourceType, "official");
  assert.equal(ledger.candidateCount, 2);
  assert.ok(ledger.evidenceChars <= 500);
  assert.equal(ledger.sources.filter((item) => item.url === "https://gov.example/guide").length, 1);
}

{
  const compact = compactResearchHandoff({
    status: "PASS",
    finalTitle: "테스트 제목",
    confirmedFacts: Array.from({ length: 30 }, (_, i) => `사실 ${i}`),
    uncertainItems: ["변동 가능"],
    ignoredHugeField: "x".repeat(10000)
  });
  assert.equal(compact.finalTitle, "테스트 제목");
  assert.ok(compact.confirmedFacts.length <= 12);
  assert.equal(compact.ignoredHugeField, undefined);
}

{
  // The Writer Contract is already emitted separately by buildPrompt. The support
  // handoff must not duplicate it, and usableSources must not carry full excerpts.
  const hugeExcerpt = "원문 본문 ".repeat(1200);
  const contract = {
    selectedTitle: "통신비 절약 전 확인할 조건",
    mustAnswer: ["약정 조건", "데이터 사용량"],
    safetyBoundaries: ["근거 없는 금액 단정 금지"]
  };
  const compact = compactResearchHandoff({
    status: "PASS",
    searchNeed: "normal",
    finalTitle: "통신비 절약 전 확인할 조건",
    writerContract: contract,
    usableSources: [{
      sourceId: "S1",
      title: "공식 안내",
      url: "https://gov.example/guide",
      excerpt: hugeExcerpt,
      nested: { body: hugeExcerpt }
    }],
    confirmedFacts: [{ claim: "대상별 조건 확인", evidence: hugeExcerpt }]
  });
  assert.equal(compact.writerContract, undefined);
  assert.equal(compact.usableSources[0].excerpt, undefined);
  assert.ok(JSON.stringify(compact).length < 2500);

  const withContract = compactResearchHandoff({ writerContract: contract }, { includeWriterContract: true });
  assert.ok(withContract.writerContract);
}

{
  assert.equal(normalizeComparableText("  통신비, 줄이기! "), "통신비줄이기");
  assert.ok(titleVerificationNeedle("통신비 줄이기 전에 확인할 조건").startsWith("통신비줄이기"));
  const uncertain = publishOutcomeUncertainError(new Error("완료 확인 timeout"), { blogId: "test" });
  assert.equal(uncertain.code, "NAVER_PUBLISH_UNCERTAIN");
  assert.equal(uncertain.failurePhase, "publish_verify");
  assert.equal(uncertain.commitBoundaryCrossed, true);
  assert.equal(publishStatusFromError(uncertain), "publish_uncertain");
  assert.equal(shouldAutoRetryStatus("publish_uncertain"), false);
  assert.equal(shouldAutoRetryStatus("failed"), true);
}

{
  const quality = {
    pass: false,
    repairScope: "targeted",
    issues: [
      { code: "fabricated_experience", message: "직접 사용 표현 제거" },
      { code: "ai_phrase", message: "AI 상투어 수정" }
    ]
  };
  const plan = planPartialRepair(quality);
  assert.equal(plan.eligible, true);
  assert.deepEqual(plan.issueCodes, ["fabricated_experience", "ai_phrase"]);
  const prompt = buildPartialRepairPrompt({
    writerResult: {
      title: "통신비 줄이기 전에 확인할 조건",
      article: "제가 직접 써보니 좋았습니다. 알아보겠습니다.",
      tags: ["통신비"]
    },
    deterministicQuality: quality,
    topic: "통신비 절약",
    keyword: "통신비",
    searchResults: [{
      title: "공식 안내",
      excerpt: "요금제는 약정과 데이터 사용량을 함께 확인한다.",
      relevance: { score: 10, officialSource: true }
    }],
    resultPath: "C:/job/writer-partial-repair-1-result.json"
  });
  assert.ok(prompt.includes("This is NOT a full rewrite"));
  assert.ok(prompt.includes("C:/job/writer-partial-repair-1-result.json"));
  assert.ok(prompt.includes("Compact evidence ledger"));
  assert.ok(prompt.length < 7000);

  const merged = mergePartialRepairResult({
    title: "원래 제목",
    article: "원래 본문",
    tags: ["기존태그"]
  }, {
    status: "success",
    title: "바꾸려는 제목",
    article: "수정된 본문",
    tags: ["바꾸려는태그"]
  });
  assert.equal(merged.title, "원래 제목");
  assert.equal(merged.article, "수정된 본문");
  assert.deepEqual(merged.tags, ["기존태그"]);
  assert.equal(merged.partialRepairApplied, true);
  assert.equal(partialRepairEffort("balanced"), "low");
  assert.equal(partialRepairEffort("quality"), "medium");
}

{
  const duplicatePlan = planPartialRepair({
    pass: false,
    repairScope: "title",
    issues: [{ code: "duplicate_title", message: "제목 중복" }]
  });
  assert.equal(duplicatePlan.eligible, false);
  assert.ok(duplicatePlan.reason.startsWith("unsupported_scope:"));

  const fullPlan = planPartialRepair({
    pass: false,
    repairScope: "full",
    issues: [{ code: "article_too_short", message: "본문이 짧음" }]
  });
  assert.equal(fullPlan.eligible, false);
  assert.equal(fullPlan.reason, "full_rewrite_required");
}

assert.equal(adaptiveEffort({ tokenEfficiencyMode: "balanced", topic: "주방세제 비교" }, "main", "high"), "medium");
assert.equal(adaptiveEffort({ tokenEfficiencyMode: "balanced", topic: "정부 지원금 신청 자격" }, "research", "high"), "high");
assert.equal(adaptiveEffort({ tokenEfficiencyMode: "economy", topic: "주방세제 비교" }, "writer", "high"), "low");
assert.deepEqual(tokenSavings(10000, 7000), { cachedOrSavedTokens: 3000, savingsPercent: 30 });

console.log("V2 checks passed");
