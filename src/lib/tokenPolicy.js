const EFFORT_ORDER = ["low", "medium", "high", "xhigh"];
const VALID_MODES = new Set(["economy", "balanced", "quality"]);

function normalizeEffort(value, fallback = "medium") {
  const normalized = String(value || "").trim().toLowerCase();
  return EFFORT_ORDER.includes(normalized) ? normalized : fallback;
}

function normalizeTokenMode(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return VALID_MODES.has(normalized) ? normalized : "balanced";
}

function minEffort(left, right) {
  const a = EFFORT_ORDER.indexOf(normalizeEffort(left));
  const b = EFFORT_ORDER.indexOf(normalizeEffort(right));
  return EFFORT_ORDER[Math.min(a, b)];
}

function maxEffort(left, right) {
  const a = EFFORT_ORDER.indexOf(normalizeEffort(left));
  const b = EFFORT_ORDER.indexOf(normalizeEffort(right));
  return EFFORT_ORDER[Math.max(a, b)];
}

function highRiskTopic(options = {}) {
  const topic = `${options.topic || ""} ${options.keyword || ""} ${options.category || ""}`;
  if (/(정부|지원금|장려금|세금|환급|보조금|신청|자격|정책|법률|금리|보험|복지|대출|채용|모집|접수|가격 인상|리콜)/i.test(topic)) {
    return true;
  }
  const freshness = String(options.freshnessLevel || "").toLowerCase();
  if (freshness === "high") return true;
  const sourceQuality = options.sourceQuality || {};
  return sourceQuality.authorityEvidenceRequired === true
    || sourceQuality.independentEvidenceRequired === true
    || sourceQuality.strictEvidenceRequired === true;
}

function recommendedEffort(options = {}, agent = "main") {
  const mode = normalizeTokenMode(options.tokenEfficiencyMode);
  if (mode === "quality") return null;
  const risky = highRiskTopic(options);

  if (mode === "economy") {
    if (agent === "image" || agent === "imageStyle") return "low";
    if (agent === "writer") return risky ? "medium" : "low";
    if (agent === "research") return risky ? "medium" : "low";
    if (agent === "main") return risky ? "medium" : "low";
    return "low";
  }

  // balanced: keep expensive reasoning for evidence-risky work, not routine prose.
  if (agent === "image" || agent === "imageStyle") return "low";
  if (agent === "writer") return "medium";
  if (agent === "research") return risky ? "high" : "medium";
  if (agent === "main") return risky ? "high" : "medium";
  return "medium";
}

function adaptiveEffort(options = {}, agent = "main", configuredEffort = "high") {
  const configured = normalizeEffort(configuredEffort, "high");
  const recommended = recommendedEffort(options, agent);
  if (!recommended) return configured;
  // User-selected effort is treated as a ceiling in economy/balanced mode.
  return minEffort(configured, recommended);
}

function escalatedEffort(value) {
  const current = normalizeEffort(value);
  const index = EFFORT_ORDER.indexOf(current);
  return EFFORT_ORDER[Math.min(EFFORT_ORDER.length - 1, index + 1)];
}

function tokenSavings(grossTotal = 0, effectiveTotal = 0) {
  const gross = Math.max(0, Number(grossTotal || 0));
  const effective = Math.max(0, Number(effectiveTotal || 0));
  return {
    cachedOrSavedTokens: Math.max(0, gross - effective),
    savingsPercent: gross > 0 ? Number((((gross - effective) / gross) * 100).toFixed(1)) : 0
  };
}

module.exports = {
  adaptiveEffort,
  escalatedEffort,
  highRiskTopic,
  normalizeTokenMode,
  tokenSavings,
  _private: {
    normalizeEffort,
    minEffort,
    maxEffort,
    recommendedEffort
  }
};
