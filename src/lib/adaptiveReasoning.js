const VALID_EFFORTS = new Set(["low", "medium", "high", "xhigh"]);

const HIGH_RISK_TERMS = [
  "정부", "지원금", "장려금", "세금", "환급", "보조금", "정책", "법률", "법 ", "자격",
  "대출", "금리", "보험", "연금", "청약", "신청", "모집", "접수", "마감", "채용",
  "가격", "요금", "할인율", "출시", "리콜", "중단", "장애", "논란", "현재", "최신", "오늘",
  "2025", "2026", "2027"
];

function normalizeEffort(value, fallback = "high") {
  const normalized = String(value || "").trim().toLowerCase();
  return VALID_EFFORTS.has(normalized) ? normalized : fallback;
}

function normalizeModels(models = {}) {
  return {
    main: normalizeEffort(models.main, "high"),
    research: normalizeEffort(models.research, "high"),
    writer: normalizeEffort(models.writer, "high"),
    image: normalizeEffort(models.image, "medium"),
    imageStyle: normalizeEffort(models.imageStyle, "medium")
  };
}

function tokenNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

function isSuccessfulHistory(entry = {}) {
  const status = String(entry.status || "").toLowerCase();
  return ["success", "generated", "published", "verified"].includes(status)
    && tokenNumber(entry.token_total) > 0;
}

function relevantHistory(history = [], blogId = "", limit = 20) {
  return (Array.isArray(history) ? history : [])
    .filter((entry) => !blogId || String(entry?.blog_id || "") === String(blogId))
    .filter(isSuccessfulHistory)
    .slice(0, Math.max(1, Number(limit) || 20));
}

function median(values = []) {
  const sorted = values.map(tokenNumber).filter(Boolean).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function aggregateAgentShares(rows = []) {
  const totals = {};
  let grandTotal = 0;
  for (const row of rows) {
    const agents = row?.token_agents && typeof row.token_agents === "object" ? row.token_agents : {};
    for (const [agent, amount] of Object.entries(agents)) {
      const value = tokenNumber(amount);
      if (!value) continue;
      totals[agent] = (totals[agent] || 0) + value;
      grandTotal += value;
    }
  }
  const shares = {};
  for (const [agent, amount] of Object.entries(totals)) {
    shares[agent] = grandTotal > 0 ? Number((amount / grandTotal).toFixed(4)) : 0;
  }
  return { totals, shares, grandTotal };
}

function isHighRiskContext({ topic = "", topicMode = "manual", freshnessLevel = "auto", sourceQuality = null } = {}) {
  if (String(topicMode || "").toLowerCase() === "auto") return true;
  if (String(freshnessLevel || "").toLowerCase() === "high") return true;
  const text = String(topic || "").toLowerCase();
  if (HIGH_RISK_TERMS.some((term) => text.includes(term.toLowerCase()))) return true;
  if (sourceQuality?.strictEvidenceRequired === true) return true;
  if (sourceQuality?.authorityEvidenceRequired === true) return true;
  if (sourceQuality?.independentEvidenceRequired === true) return true;
  return false;
}

function chooseAdaptiveAgentModels({
  history = [],
  blogId = "",
  tokenMode = "balanced",
  requestedModels = {},
  topic = "",
  topicMode = "manual",
  freshnessLevel = "auto",
  sourceQuality = null,
  minSamples = 8,
  historyLimit = 20
} = {}) {
  const mode = String(tokenMode || "balanced").toLowerCase();
  const requested = normalizeModels(requestedModels);
  const rows = relevantHistory(history, blogId, historyLimit);
  const highRisk = isHighRiskContext({ topic, topicMode, freshnessLevel, sourceQuality });
  const result = {
    applied: false,
    mode,
    sampleCount: rows.length,
    highRisk,
    requestedModels: requested,
    agentModels: { ...requested },
    medianTokens: median(rows.map((row) => row.token_total)),
    reasons: []
  };

  if (mode === "quality") {
    result.reasons.push("quality 모드는 사용자 품질 우선 설정을 그대로 유지합니다.");
    return result;
  }
  if (highRisk) {
    result.reasons.push("정책·금전·최신성 또는 자동주제 위험 신호가 있어 reasoning을 자동 하향하지 않습니다.");
    return result;
  }
  if (rows.length < Math.max(1, Number(minSamples) || 8)) {
    result.reasons.push(`성공 작업 표본이 ${rows.length}건이라 자동튜닝 최소 ${minSamples}건에 미달합니다.`);
    return result;
  }

  const { shares } = aggregateAgentShares(rows);
  result.agentShares = shares;

  // Economy mode already forces routine text agents to low in tokenPolicy.
  // Applying a second history policy cannot save more tokens and would only add confusing telemetry.
  if (mode === "economy") {
    result.reasons.push("economy 모드는 기존 정적 정책이 이미 low reasoning을 적용하므로 추가 자동튜닝을 생략합니다.");
    return result;
  }

  // Balanced's static baseline is medium for routine Writer/Main/Research work.
  // Only lower Writer below that baseline when it has remained the clear token bottleneck.
  // Research/Main stay at the balanced baseline to preserve evidence/review quality.
  const writerShare = Number(shares.writer || 0);
  if (writerShare >= 0.55 && requested.writer !== "xhigh") {
    result.agentModels.writer = "low";
    result.applied = true;
    result.reasons.push(`Writer가 최근 토큰의 ${Math.round(writerShare * 100)}%를 지속 사용해 balanced 기준 medium→low로 조정합니다.`);
    return result;
  }

  result.reasons.push("Writer 토큰 비중이 55% 미만이라 balanced reasoning 기준을 유지합니다.");
  return result;
}

module.exports = {
  chooseAdaptiveAgentModels,
  _private: {
    normalizeEffort,
    normalizeModels,
    relevantHistory,
    aggregateAgentShares,
    isHighRiskContext,
    median,
    tokenNumber
  }
};
