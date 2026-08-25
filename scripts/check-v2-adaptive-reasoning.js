const assert = require("node:assert/strict");
const { chooseAdaptiveAgentModels } = require("../src/lib/adaptiveReasoning");
const { adaptiveEffort } = require("../src/lib/tokenPolicy");

function rows(count, agentSplit = { writer: 7000, main: 1500, research: 1500 }) {
  return Array.from({ length: count }, (_, index) => ({
    create_at: `2026-08-${String(25 - index).padStart(2, "0")}T10:00:00+09:00`,
    blog_id: "demo",
    status: "generated",
    token_total: Object.values(agentSplit).reduce((a, b) => a + b, 0),
    token_agents: { ...agentSplit }
  }));
}

{
  const out = chooseAdaptiveAgentModels({
    history: rows(8),
    blogId: "demo",
    tokenMode: "balanced",
    requestedModels: { research: "high", writer: "high", main: "high", image: "medium" },
    topic: "식기세척기 용량 선택 기준",
    topicMode: "manual",
    freshnessLevel: "low"
  });
  assert.equal(out.applied, true);
  assert.equal(out.agentModels.writer, "low", "history tuning must beat the static balanced writer=medium baseline");
  assert.equal(out.agentModels.main, "high");
  assert.equal(out.agentModels.research, "high");
  assert.equal(out.sampleCount, 8);
  assert.equal(adaptiveEffort({ tokenEfficiencyMode: "balanced", topic: "식기세척기 용량 선택 기준" }, "writer", out.agentModels.writer), "low");
}

{
  const out = chooseAdaptiveAgentModels({
    history: rows(7),
    blogId: "demo",
    tokenMode: "balanced",
    requestedModels: { research: "high", writer: "high", main: "high", image: "medium" },
    topic: "일반 생활 정보"
  });
  assert.equal(out.applied, false);
  assert.equal(out.sampleCount, 7);
}

{
  const out = chooseAdaptiveAgentModels({
    history: rows(8),
    blogId: "demo",
    tokenMode: "quality",
    requestedModels: { research: "high", writer: "high", main: "high", image: "medium" },
    topic: "식기세척기 용량 선택 기준"
  });
  assert.equal(out.applied, false);
  assert.equal(out.agentModels.writer, "high");
}

{
  const out = chooseAdaptiveAgentModels({
    history: rows(8),
    blogId: "demo",
    tokenMode: "balanced",
    requestedModels: { research: "high", writer: "high", main: "high", image: "medium" },
    topic: "2026 정부지원금 신청 자격",
    topicMode: "manual",
    freshnessLevel: "high"
  });
  assert.equal(out.highRisk, true);
  assert.equal(out.applied, false);
  assert.equal(out.agentModels.writer, "high");
}

{
  const out = chooseAdaptiveAgentModels({
    history: rows(8, { writer: 5000, main: 3000, research: 2000 }),
    blogId: "demo",
    tokenMode: "balanced",
    requestedModels: { research: "high", writer: "high", main: "high", image: "medium" },
    topic: "냉장고 정리 방법",
    freshnessLevel: "low"
  });
  assert.equal(out.applied, false, "writer must exceed the conservative 55% share threshold");
}

{
  const out = chooseAdaptiveAgentModels({
    history: rows(8),
    blogId: "demo",
    tokenMode: "balanced",
    requestedModels: { research: "high", writer: "xhigh", main: "high", image: "medium" },
    topic: "식기세척기 용량 선택 기준"
  });
  assert.equal(out.agentModels.writer, "xhigh", "explicit xhigh must be preserved by history tuning");
  assert.equal(adaptiveEffort({ tokenEfficiencyMode: "balanced", topic: "일반 정보" }, "writer", "xhigh"), "xhigh", "explicit xhigh must survive tokenPolicy too");
}

{
  const out = chooseAdaptiveAgentModels({
    history: rows(8),
    blogId: "demo",
    tokenMode: "economy",
    requestedModels: { research: "high", writer: "high", main: "high", image: "medium" },
    topic: "냉장고 정리 방법",
    freshnessLevel: "low"
  });
  assert.equal(out.applied, false, "economy already has a static low-reasoning policy and should not pretend history saved more");
}

console.log("V2 adaptive reasoning regression checks passed");
