const assert = require("node:assert/strict");
const { evaluateArticleQuality } = require("../src/lib/qualityGate");
const { adaptiveEffort, tokenSavings } = require("../src/lib/tokenPolicy");
const { buildEvidenceLedger, compactResearchHandoff } = require("../src/lib/evidenceLedger");
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

assert.equal(adaptiveEffort({ tokenEfficiencyMode: "balanced", topic: "주방세제 비교" }, "main", "high"), "medium");
assert.equal(adaptiveEffort({ tokenEfficiencyMode: "balanced", topic: "정부 지원금 신청 자격" }, "research", "high"), "high");
assert.equal(adaptiveEffort({ tokenEfficiencyMode: "economy", topic: "주방세제 비교" }, "writer", "high"), "low");
assert.deepEqual(tokenSavings(10000, 7000), { cachedOrSavedTokens: 3000, savingsPercent: 30 });

console.log("V2 checks passed");
