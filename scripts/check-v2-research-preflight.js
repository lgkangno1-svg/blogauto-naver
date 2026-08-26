const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const {
  deterministicSearchPreflight,
  buildPreflightResearchRequest
} = require("../src/lib/researchPreflight");

function checkDecision(input, expectedNeed, message) {
  const decision = deterministicSearchPreflight(input);
  assert.equal(decision.shouldSearchFirst, Boolean(expectedNeed), message);
  assert.equal(decision.searchNeed, expectedNeed || "", message);
  return decision;
}

checkDecision(
  { topic: "2026 청년 지원금 신청 조건", topicMode: "manual", freshnessLevel: "auto" },
  "strict",
  "high-stakes application topics must search before Research"
);

checkDecision(
  { topic: "갤럭시 신제품 출시 가격 정리", topicMode: "manual", freshnessLevel: "high" },
  "normal",
  "current product topics should pre-search"
);

checkDecision(
  { topic: "주방 정리할 때 동선을 단순하게 만드는 방법", topicMode: "manual", freshnessLevel: "low" },
  "",
  "stable evergreen manual topics must retain Research skip decision"
);

checkDecision(
  { topic: "생활비 절약", topicMode: "auto", freshnessLevel: "auto" },
  "normal",
  "auto topic discovery needs sources before Research title selection"
);

checkDecision(
  {
    topic: "2026 지원금",
    topicMode: "manual",
    searchResults: [{ title: "already fetched" }]
  },
  "",
  "existing search results must not trigger duplicate pre-search"
);

const decision = deterministicSearchPreflight({
  topic: "통신요금 변경 신청",
  topicMode: "manual"
});
const request = buildPreflightResearchRequest({ topic: "통신요금 변경 신청" }, decision);
assert.equal(request.status, "REVISION");
assert.equal(request.searchNeed, "strict");
assert.match(request.topicThesis, /통신요금/);
assert.ok(Array.isArray(request.notes) && request.notes.length > 0);

const runnerPath = path.join(__dirname, "..", "src", "lib", "codexRunner.js");
const runner = fs.readFileSync(runnerPath, "utf8");
assert.match(runner, /deterministicSearchPreflight/);
assert.match(runner, /deterministicPreflight: true/);
assert.match(runner, /researchSearchRound = 1/);
assert.equal(
  (runner.match(/let researchSearchRound = 0;/g) || []).length,
  1,
  "research search round counter must have exactly one declaration"
);

console.log("V2 deterministic Research preflight checks passed");
