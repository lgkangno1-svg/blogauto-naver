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

function historyTokenFields(tokenUsage = {}) {
  const diagnostics = tokenUsage?.diagnostics?.total !== undefined
    ? tokenUsage.diagnostics
    : buildJobTokenDiagnostics(tokenUsage);
  return {
    token_total: asTokenNumber(diagnostics.total),
    token_gross_total: Math.max(asTokenNumber(diagnostics.total), asTokenNumber(diagnostics.grossTotal)),
    token_saved: asTokenNumber(diagnostics.savedTokens),
    token_savings_percent: Number.isFinite(Number(diagnostics.savingsPercent))
      ? Number(Number(diagnostics.savingsPercent).toFixed(1))
      : 0,
    token_agents: normalizeAgentMap(diagnostics.agents),
    token_gross_agents: normalizeAgentMap(diagnostics.grossAgents),
    token_largest_agent: String(diagnostics.largestAgent?.agent || "")
  };
}

function median(values = []) {
  const sorted = values
    .map(asTokenNumber)
    .filter(Boolean)
    .sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function summarizeHistoryTokenDiagnostics(history = [], {
  blogId = "",
  limit = 20
} = {}) {
  const rows = (Array.isArray(history) ? history : [])
    .filter((entry) => !blogId || String(entry?.blog_id || "") === String(blogId))
    .filter((entry) => asTokenNumber(entry?.token_total) > 0)
    .slice(0, Math.max(1, Number(limit) || 20));
  if (!rows.length) {
    return {
      sampleCount: 0,
      averageTotal: 0,
      medianTotal: 0,
      averageGrossTotal: 0,
      averageSaved: 0,
      averageSavingsPercent: 0,
      largestAgent: "",
      latestTotal: 0,
      previousAverageTotal: 0,
      latestVsPreviousPercent: 0,
      anomaly: false
    };
  }

  const total = rows.reduce((sum, row) => sum + asTokenNumber(row.token_total), 0);
  const grossTotal = rows.reduce((sum, row) => sum + Math.max(asTokenNumber(row.token_total), asTokenNumber(row.token_gross_total)), 0);
  const savedTotal = rows.reduce((sum, row) => sum + asTokenNumber(row.token_saved), 0);
  const agentTotals = {};
  for (const row of rows) {
    for (const [agent, amount] of Object.entries(row.token_agents || {})) {
      agentTotals[agent] = (agentTotals[agent] || 0) + asTokenNumber(amount);
    }
  }
  const largestAgent = Object.entries(agentTotals)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || "";
  const latestTotal = asTokenNumber(rows[0]?.token_total);
  const previousRows = rows.slice(1);
  const previousAverageTotal = previousRows.length
    ? Math.round(previousRows.reduce((sum, row) => sum + asTokenNumber(row.token_total), 0) / previousRows.length)
    : 0;
  const latestVsPreviousPercent = previousAverageTotal > 0
    ? Number((((latestTotal - previousAverageTotal) / previousAverageTotal) * 100).toFixed(1))
    : 0;

  return {
    sampleCount: rows.length,
    averageTotal: Math.round(total / rows.length),
    medianTotal: median(rows.map((row) => row.token_total)),
    averageGrossTotal: Math.round(grossTotal / rows.length),
    averageSaved: Math.round(savedTotal / rows.length),
    averageSavingsPercent: grossTotal > 0 ? Number(((savedTotal / grossTotal) * 100).toFixed(1)) : 0,
    largestAgent,
    latestTotal,
    previousAverageTotal,
    latestVsPreviousPercent,
    anomaly: previousRows.length >= 3 && latestVsPreviousPercent >= 50
  };
}

module.exports = {
  AGENT_ORDER,
  buildJobTokenDiagnostics,
  historyTokenFields,
  summarizeHistoryTokenDiagnostics,
  _private: { asTokenNumber, normalizeAgentMap, sumTokens, median }
};
