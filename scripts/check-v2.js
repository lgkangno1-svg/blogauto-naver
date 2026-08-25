const assert = require("node:assert/strict");
const { evaluateArticleQuality } = require("../src/lib/qualityGate");
const { adaptiveEffort, tokenSavings } = require("../src/lib/tokenPolicy");

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

assert.equal(adaptiveEffort({ tokenEfficiencyMode: "balanced", topic: "주방세제 비교" }, "main", "high"), "medium");
assert.equal(adaptiveEffort({ tokenEfficiencyMode: "balanced", topic: "정부 지원금 신청 자격" }, "research", "high"), "high");
assert.equal(adaptiveEffort({ tokenEfficiencyMode: "economy", topic: "주방세제 비교" }, "writer", "high"), "low");
assert.deepEqual(tokenSavings(10000, 7000), { cachedOrSavedTokens: 3000, savingsPercent: 30 });

console.log("V2 checks passed");
