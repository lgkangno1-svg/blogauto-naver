const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { evaluateTitleNovelty, closestRecentTitle } = require("../src/lib/titleNovelty");

const recent = [
  "통신비 절약 전에 먼저 확인할 조건은?",
  "장보기 비용 줄이려면 가격표보다 먼저 볼 것"
];

const duplicate = evaluateTitleNovelty("통신비 절약 전에 먼저 확인할 조건은?", recent);
assert.equal(duplicate.pass, false);
assert.equal(duplicate.similarity, 1);
assert.equal(duplicate.closestTitle, recent[0]);

const novel = evaluateTitleNovelty("식기세척기 용량 선택할 때 가족 수보다 중요한 기준", recent);
assert.equal(novel.pass, true);

const closest = closestRecentTitle("장보기 비용 줄이려면 가격표보다 먼저 볼 것", recent);
assert.equal(closest.title, recent[1]);
assert.equal(closest.similarity, 1);

const runner = fs.readFileSync(path.join(__dirname, "..", "src", "lib", "codexRunner.js"), "utf8");
assert.match(runner, /require\("\.\/titleNovelty"\)/);
assert.match(runner, /earlyTitleNovelty = evaluateTitleNovelty\(finalTitle/);
assert.match(runner, /failurePhase: "duplicate"/);
assert.match(runner, /skippedStages: \["writer_contract", "writer", "main_review", "image"\]/);

const gatePos = runner.indexOf("const earlyTitleNovelty = evaluateTitleNovelty(finalTitle");
const contractPos = runner.indexOf('const refineWriterContract = async (promptFileName = "writer-contract-prompt.txt")');
assert.ok(gatePos >= 0 && contractPos >= 0 && gatePos < contractPos, "early duplicate gate must run before writer contract refinement");

console.log("V2 early title novelty gate checks passed");
