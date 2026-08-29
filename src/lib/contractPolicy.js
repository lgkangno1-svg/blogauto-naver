const HIGH_STAKES_RE = /(정부|지원금|장려금|세금|환급|보조금|신청|자격|정책|법률|금리|보험|복지|대출|통신요금|요금제|채용|모집|접수|마감)/i;
const CURRENT_RISK_RE = /(현재|최신|오늘|이번주|이번 달|최근|출시|발표|중단|종료|장애|인상|인하|리콜|논란|예약|모집|접수|마감)/i;

function hasMeaningfulList(value) {
  if (Array.isArray(value)) {
    return value.some((item) => String(item || "").trim());
  }
  return Boolean(String(value || "").trim());
}

function normalizeMode(value) {
  const mode = String(value || "balanced").trim().toLowerCase();
  return ["economy", "balanced", "quality"].includes(mode) ? mode : "balanced";
}

function shouldRefineWriterContract({
  topic = "",
  finalTitle = "",
  topicMode = "manual",
  tokenMode = "balanced",
  researchResult = null,
  sourceQuality = null
} = {}) {
  const reasons = [];
  const research = researchResult && typeof researchResult === "object" ? researchResult : {};
  const quality = sourceQuality && typeof sourceQuality === "object" ? sourceQuality : {};
  const mode = normalizeMode(tokenMode);
  const searchNeed = String(research.searchNeed || "").trim().toLowerCase();
  const combinedTitle = `${topic || ""} ${finalTitle || ""}`.trim();

  // Quality mode deliberately keeps the existing Main-Agent semantic pass.
  if (mode === "quality") reasons.push("quality_mode");

  // Auto topic selection has more room for thesis drift than a fixed manual topic.
  if (String(topicMode || "manual").toLowerCase() === "auto") reasons.push("auto_topic_mode");

  if (searchNeed === "strict") reasons.push("strict_search");
  if (quality.authorityEvidenceRequired === true || quality.strictEvidenceRequired === true) {
    reasons.push("authority_evidence_required");
  }
  if (quality.independentEvidenceRequired === true) reasons.push("independent_evidence_required");
  if (research.currentBridgeRequired === true) reasons.push("current_bridge_required");
  if (hasMeaningfulList(research.uncertainItems)) reasons.push("research_uncertainty");
  if (hasMeaningfulList(research.mustNotDo) && searchNeed !== "skip") reasons.push("explicit_safety_boundary");
  if (HIGH_STAKES_RE.test(combinedTitle)) reasons.push("high_stakes_topic");
  if (CURRENT_RISK_RE.test(combinedTitle) && searchNeed !== "skip") reasons.push("current_status_topic");

  const uniqueReasons = Array.from(new Set(reasons));
  return {
    refine: uniqueReasons.length > 0,
    reasons: uniqueReasons,
    mode,
    searchNeed,
    skippedReason: uniqueReasons.length
      ? ""
      : "안정적인 수동 일반 글이라 코드가 만든 Writer Contract를 그대로 사용합니다."
  };
}

module.exports = {
  shouldRefineWriterContract,
  _private: {
    hasMeaningfulList,
    normalizeMode
  }
};
