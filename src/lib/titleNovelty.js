const { maxRecentTitleSimilarity } = require("./qualityGate");

const DEFAULT_MAX_TITLE_SIMILARITY = 0.72;

function closestRecentTitle(title, historyTitles = []) {
  const current = String(title || "").trim();
  let best = { title: "", similarity: 0 };
  for (const recent of Array.isArray(historyTitles) ? historyTitles : []) {
    const candidate = String(recent || "").trim();
    if (!candidate) continue;
    const similarity = maxRecentTitleSimilarity(current, [candidate]);
    if (similarity > best.similarity) {
      best = { title: candidate, similarity };
    }
  }
  return best;
}

function evaluateTitleNovelty(title, historyTitles = [], {
  maxTitleSimilarity = DEFAULT_MAX_TITLE_SIMILARITY
} = {}) {
  const current = String(title || "").trim();
  if (!current) {
    return {
      pass: false,
      similarity: 0,
      closestTitle: "",
      reason: "최종 제목이 비어 있어 중복 검사를 진행할 수 없습니다."
    };
  }

  const closest = closestRecentTitle(current, historyTitles);
  const threshold = Number.isFinite(Number(maxTitleSimilarity))
    ? Math.max(0, Math.min(1, Number(maxTitleSimilarity)))
    : DEFAULT_MAX_TITLE_SIMILARITY;
  const pass = closest.similarity < threshold;
  return {
    pass,
    similarity: Number(closest.similarity.toFixed(3)),
    closestTitle: closest.title,
    threshold,
    reason: pass
      ? ""
      : `최근 제목과 표현/소재가 너무 유사합니다 (${Math.round(closest.similarity * 100)}%).`
  };
}

module.exports = {
  DEFAULT_MAX_TITLE_SIMILARITY,
  evaluateTitleNovelty,
  closestRecentTitle
};
