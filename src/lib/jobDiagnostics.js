const AGENT_ORDER = ["research", "writer", "main", "image", "imageStyle"];

function asTokenNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

function normalizeAgentMap(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  const out = {};
  for (const agent of AGENT_ORDER) {
    out[agent] = asTokenNumber(source[agent]);
  }
  for (const [agent, amount] of Object.entries(source)) {
    if (Object.prototype.hasOwnProperty.call(out, agent)) continue;
    const normalized = asTokenNumber(amount);
    if (normalized) out[agent] = normalized;
  }
  return out;
}

function sumTokens(map = {}) {
  return Object.values(map).reduce((sum, value) => sum + asTokenNumber(value), 0);
}

function buildJobTokenDiagnostics(tokenUsage = {}) {
  const agents = normalizeAgentMap(tokenUsage.agents);
  const grossAgents = normalizeAgentMap(tokenUsage.grossAgents);
  const agentEffectiveTotal = sumTokens(agents);
  const agentGrossTotal = sumTokens(grossAgents);
  const total = asTokenNumber(tokenUsage.total) || agentEffectiveTotal;
  const grossTotal = Math.max(
    total,
    asTokenNumber(tokenUsage.grossTotal),
    agentGrossTotal
  );
  const cachedInputTokens = asTokenNumber(tokenUsage.cachedInputTokens);
  const savedTokens = Math.max(0, grossTotal - total);
  const savingsPercent = grossTotal > 0 ? Number(((savedTokens / grossTotal) * 100).toFixed(1)) : 0;

  const agentRows = Object.keys({ ...grossAgents, ...agents })
    .map((agent) => {
      const effective = asTokenNumber(agents[agent]);
      const gross = Math.max(effective, asTokenNumber(grossAgents[agent]));
      const saved = Math.max(0, gross - effective);
      return {
        agent,
        effective,
        gross,
        saved,
        sharePercent: total > 0 ? Number(((effective / total) * 100).toFixed(1)) : 0,
        savingsPercent: gross > 0 ? Number(((saved / gross) * 100).toFixed(1)) : 0
      };
    })
    .filter((row) => row.effective || row.gross)
    .sort((a, b) => b.effective - a.effective);

  const largestAgent = agentRows[0] || null;
  return {
    total,
    grossTotal,
    savedTokens,
    savingsPercent,
    cachedInputTokens,
    inputTokens: asTokenNumber(tokenUsage.inputTokens),
    outputTokens: asTokenNumber(tokenUsage.outputTokens),
    agents,
    grossAgents,
    agentRows,
    largestAgent,
    hasAgentBreakdown: agentRows.length > 0
  };
}

module.exports = {
  AGENT_ORDER,
  buildJobTokenDiagnostics,
  _private: { asTokenNumber, normalizeAgentMap, sumTokens }
};
