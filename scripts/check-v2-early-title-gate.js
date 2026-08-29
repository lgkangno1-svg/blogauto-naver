const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  evaluateTitleNovelty,
  closestRecentTitle,
  semanticTitleSimilarity
} = require("../src/lib/titleNovelty");

const recent = [
  "통신비 절약 전에 먼저 확인할 조건은?",
  "장보기 비용 줄이려면 가격표보다 먼저 볼 것"
];

const duplicate = evaluateTitleNovelty("통신비 절약 전에 먼저 확인할 조건은?", recent);
assert.equal(duplicate.pass, false);
assert.equal(duplicate.similarity, 1);
assert.equal(duplicate.closestTitle, recent[0]);
assert.equal(duplicate.duplicateMode, "lexical");

const novel = evaluateTitleNovelty("식기세척기 용량 선택할 때 가족 수보다 중요한 기준", recent);
assert.equal(novel.pass, true);

const closest = closestRecentTitle("장보기 비용 줄이려면 가격표보다 먼저 볼 것", recent);
assert.equal(closest.title, recent[1]);
assert.equal(closest.similarity, 1);

// Same subject/decision hidden behind Korean particles, reordered nouns and paraphrased wording.
const semanticRecent = ["식기세척기 12인용과 14인용 차이, 고르기 전 확인할 점"];
const semanticCandidate = "14인용 식기세척기와 12인용은 어떻게 다를까? 선택 전 체크";
const semanticDuplicate = evaluateTitleNovelty(semanticCandidate, semanticRecent);
assert.equal(semanticDuplicate.pass, false);
assert.equal(semanticDuplicate.duplicateMode, "semantic");
assert.ok(semanticDuplicate.semanticSimilarity >= semanticDuplicate.semanticThreshold);
assert.ok(semanticDuplicate.lexicalSimilarity < 0.72, "semantic gate should catch a paraphrase the lexical gate misses");

// Common aliases should normalize without a model call.
assert.ok(
  semanticTitleSimilarity(
    "냉장고 전기료 줄이려면 온도 설정부터",
    "냉장고 전기요금 절약, 적정 온도 설정이 먼저"
  ) >= 0.74
);

// Reusing the same product/entity with a genuinely different reader question must remain allowed.
const differentAngle = evaluateTitleNovelty(
  "식기세척기 전기요금 절약하려면 어떤 코스를 쓸까",
  ["식기세척기 설치비 추가되는 경우와 사전 체크 항목"]
);
assert.equal(differentAngle.pass, true);

const runner = fs.readFileSync(path.join(__dirname, "..", "src", "lib", "codexRunner.js"), "utf8");
assert.match(runner, /require\("\.\/titleNovelty"\)/);
assert.match(runner, /earlyTitleNovelty = evaluateTitleNovelty\(finalTitle/);
assert.match(runner, /failurePhase: "duplicate"/);
assert.match(runner, /skippedStages: \["writer_contract", "writer", "main_review", "image"\]/);

const gatePos = runner.indexOf("const earlyTitleNovelty = evaluateTitleNovelty(finalTitle");
const contractPos = runner.indexOf('const refineWriterContract = async (promptFileName = "writer-contract-prompt.txt")');
assert.ok(gatePos >= 0 && contractPos >= 0 && gatePos < contractPos, "early duplicate gate must run before writer contract refinement");

console.log("V2 early lexical + semantic title novelty gate checks passed");
