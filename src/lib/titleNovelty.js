const { maxRecentTitleSimilarity } = require("./qualityGate");

const DEFAULT_MAX_TITLE_SIMILARITY = 0.72;
const DEFAULT_MAX_SEMANTIC_SIMILARITY = 0.74;

const SEMANTIC_STOP = new Set([
  "이렇게", "하는", "방법", "이유", "정리", "정보", "체크", "확인", "지금", "먼저",
  "무엇", "어떤", "어떻게", "정말", "꼭", "전", "때", "하면", "되는", "좋은", "알아보기"
]);

const PARTICLE_SUFFIXES = [
  "에서부터", "으로부터", "에게서", "까지", "부터", "처럼", "보다", "으로", "에서", "에게", "한테",
  "과", "와", "은", "는", "이", "가", "을", "를", "의", "도", "만"
].sort((a, b) => b.length - a.length);

function canonicalizeAliases(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/전기료/g, "전기요금")
    .replace(/통신료/g, "통신비")
    .replace(/핸드폰/g, "휴대폰")
    .replace(/차이점|다른\s*점|다를까|다른가|어떻게\s*다른지/g, "차이")
    .replace(/아끼(?:는|기|려면|려고)?|줄이(?:는|기|려면|려고)?|절감(?:하는|하기)?|낮추(?:는|기|려면)?/g, "절약")
    .replace(/고르(?:는|기|려면)?|선택하(?:는|기|려면)?|선택법/g, "선택")
    .replace(/확인법|체크법/g, "확인")
    .replace(/[^가-힣a-z0-9%]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripParticle(token) {
  let current = String(token || "");
  for (const suffix of PARTICLE_SUFFIXES) {
    if (current.endsWith(suffix) && current.length - suffix.length >= 2) {
      current = current.slice(0, -suffix.length);
      break;
    }
  }
  return current;
}

function semanticTokens(value) {
  return canonicalizeAliases(value)
    .split(" ")
    .map(stripParticle)
    .filter((token) => token.length >= 2 && !SEMANTIC_STOP.has(token) && !/^\d+$/.test(token));
}

function setJaccard(left, right) {
  const a = new Set(left);
  const b = new Set(right);
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
}

function setContainment(left, right) {
  const a = new Set(left);
  const b = new Set(right);
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / Math.min(a.size, b.size);
}

function ngrams(value, n = 3) {
  const normalized = canonicalizeAliases(value).replace(/\s+/g, "");
  if (!normalized) return [];
  if (normalized.length <= n) return [normalized];
  const out = [];
  for (let i = 0; i <= normalized.length - n; i += 1) out.push(normalized.slice(i, i + n));
  return out;
}

function diceSimilarity(left, right) {
  const a = ngrams(left);
  const b = ngrams(right);
  if (!a.length || !b.length) return 0;
  const counts = new Map();
  for (const gram of a) counts.set(gram, (counts.get(gram) || 0) + 1);
  let overlap = 0;
  for (const gram of b) {
    const count = counts.get(gram) || 0;
    if (count > 0) {
      overlap += 1;
      counts.set(gram, count - 1);
    }
  }
  return (2 * overlap) / (a.length + b.length);
}

function semanticTitleSimilarity(left, right) {
  const leftTokens = semanticTokens(left);
  const rightTokens = semanticTokens(right);
  if (!leftTokens.length || !rightTokens.length) return 0;
  const jaccard = setJaccard(leftTokens, rightTokens);
  const containment = setContainment(leftTokens, rightTokens);
  const charDice = diceSimilarity(left, right);
  const score = (jaccard * 0.4) + (containment * 0.35) + (charDice * 0.25);
  return Math.max(0, Math.min(1, score));
}

function closestRecentTitle(title, historyTitles = []) {
  const current = String(title || "").trim();
  let best = {
    title: "",
    similarity: 0,
    lexicalSimilarity: 0,
    semanticSimilarity: 0,
    duplicateMode: "none"
  };
  for (const recent of Array.isArray(historyTitles) ? historyTitles : []) {
    const candidate = String(recent || "").trim();
    if (!candidate) continue;
    const lexicalSimilarity = maxRecentTitleSimilarity(current, [candidate]);
    const semanticSimilarity = semanticTitleSimilarity(current, candidate);
    const similarity = Math.max(lexicalSimilarity, semanticSimilarity);
    if (similarity > best.similarity) {
      best = {
        title: candidate,
        similarity,
        lexicalSimilarity,
        semanticSimilarity,
        duplicateMode: semanticSimilarity > lexicalSimilarity ? "semantic" : "lexical"
      };
    }
  }
  return best;
}

function evaluateTitleNovelty(title, historyTitles = [], {
  maxTitleSimilarity = DEFAULT_MAX_TITLE_SIMILARITY,
  maxSemanticSimilarity = DEFAULT_MAX_SEMANTIC_SIMILARITY
} = {}) {
  const current = String(title || "").trim();
  if (!current) {
    return {
      pass: false,
      similarity: 0,
      lexicalSimilarity: 0,
      semanticSimilarity: 0,
      closestTitle: "",
      duplicateMode: "empty",
      reason: "최종 제목이 비어 있어 중복 검사를 진행할 수 없습니다."
    };
  }

  const closest = closestRecentTitle(current, historyTitles);
  const lexicalThreshold = Number.isFinite(Number(maxTitleSimilarity))
    ? Math.max(0, Math.min(1, Number(maxTitleSimilarity)))
    : DEFAULT_MAX_TITLE_SIMILARITY;
  const semanticThreshold = Number.isFinite(Number(maxSemanticSimilarity))
    ? Math.max(0, Math.min(1, Number(maxSemanticSimilarity)))
    : DEFAULT_MAX_SEMANTIC_SIMILARITY;
  const lexicalDuplicate = closest.lexicalSimilarity >= lexicalThreshold;
  const semanticDuplicate = closest.semanticSimilarity >= semanticThreshold;
  const pass = !lexicalDuplicate && !semanticDuplicate;
  const mode = lexicalDuplicate ? "lexical" : semanticDuplicate ? "semantic" : "none";
  const activeSimilarity = mode === "semantic" ? closest.semanticSimilarity : closest.lexicalSimilarity;

  return {
    pass,
    similarity: Number(Math.max(closest.lexicalSimilarity, closest.semanticSimilarity).toFixed(3)),
    lexicalSimilarity: Number(closest.lexicalSimilarity.toFixed(3)),
    semanticSimilarity: Number(closest.semanticSimilarity.toFixed(3)),
    closestTitle: closest.title,
    duplicateMode: mode,
    threshold: lexicalThreshold,
    semanticThreshold,
    reason: pass
      ? ""
      : mode === "semantic"
        ? `최근 글과 핵심 소재가 표현만 달라 사실상 중복입니다 (의미 유사도 ${Math.round(activeSimilarity * 100)}%).`
        : `최근 제목과 표현/소재가 너무 유사합니다 (${Math.round(activeSimilarity * 100)}%).`
  };
}

module.exports = {
  DEFAULT_MAX_TITLE_SIMILARITY,
  DEFAULT_MAX_SEMANTIC_SIMILARITY,
  evaluateTitleNovelty,
  closestRecentTitle,
  semanticTitleSimilarity,
  _private: {
    canonicalizeAliases,
    semanticTokens,
    diceSimilarity,
    setJaccard,
    setContainment
  }
};
