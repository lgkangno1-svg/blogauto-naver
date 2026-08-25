const FACT_NUMBER_RE = /\d[\d,]*(?:\.\d+)?\s*(?:만원|천원|원대|원|%|퍼센트|개월|년|일|GB|기가|kg|g|명)/gi;

const FAKE_EXPERIENCE_PATTERNS = [
  /\d+\s*(?:일|주|개월|년)\s*(?:써|사용|먹|해)\s*보/i,
  /직접\s*(?:써|사용|먹|구매|신청|체험|가|다녀)/i,
  /(?:써|사용|먹|신청|체험)해\s*보니/i,
  /내돈내산/i,
  /실사용\s*후기/i
];

const AI_PHRASES = [
  "알아보겠습니다",
  "정리해 보았습니다",
  "함께 알아보겠습니다",
  "결론적으로",
  "도움이 되었으면",
  "끝까지 읽어",
  "참고하시기 바랍니다"
];

const TITLE_STOP = new Set([
  "이렇게", "하는", "방법", "이유", "정리", "알뜰", "절약", "생활", "정보", "체크",
  "상품", "구매", "가격", "사용", "후기", "기준", "지금", "확인", "하면", "되는"
]);

function normalizeNumberToken(value) {
  return String(value || "").replace(/[,\s]+/g, "").toLowerCase();
}

function titleTokens(value) {
  const tokens = String(value || "").match(/[가-힣A-Za-z0-9]{2,}/g) || [];
  return new Set(tokens.filter((token) => !TITLE_STOP.has(token) && !/^\d+$/.test(token)));
}

function titleSimilarity(left, right) {
  const a = titleTokens(left);
  const b = titleTokens(right);
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }
  return intersection / (a.size + b.size - intersection);
}

function maxRecentTitleSimilarity(title, historyTitles = []) {
  return (Array.isArray(historyTitles) ? historyTitles : [])
    .reduce((max, recent) => Math.max(max, titleSimilarity(title, recent)), 0);
}

function evidenceText(searchResults = []) {
  return (Array.isArray(searchResults) ? searchResults : [])
    .map((item) => [item?.title, item?.excerpt, item?.snippet].filter(Boolean).join(" "))
    .join("\n");
}

function unsupportedNumberClaims(title, article, searchResults = []) {
  const claims = Array.from(new Set(`${title || ""}\n${article || ""}`.match(FACT_NUMBER_RE) || []));
  if (!claims.length) return [];
  const normalizedEvidence = normalizeNumberToken(evidenceText(searchResults));
  return claims.filter((claim) => !normalizedEvidence.includes(normalizeNumberToken(claim)));
}

function repeatedEndingIssue(article) {
  const endings = String(article || "").match(/(?:습니다|는데요|더라고요|입니다|했어요|됩니다)[.!?]?/g) || [];
  if (endings.length < 8) return false;
  const counts = new Map();
  for (const ending of endings) {
    const normalized = ending.replace(/[.!?]/g, "");
    counts.set(normalized, (counts.get(normalized) || 0) + 1);
  }
  const top = Math.max(...counts.values());
  return top / endings.length > 0.58;
}

function sourceHasOfficialEvidence(searchResults = []) {
  return (Array.isArray(searchResults) ? searchResults : []).some((item) => {
    const relevance = item?.relevance || {};
    return relevance.officialSource === true || relevance.institutionalSource === true;
  });
}

function looksHighStakes({ topic = "", title = "", sourceQuality = null } = {}) {
  if (sourceQuality?.authorityEvidenceRequired === true || sourceQuality?.strictEvidenceRequired === true) return true;
  const text = `${topic} ${title}`;
  return /(정부|지원금|장려금|세금|환급|보조금|신청|자격|정책|법률|금리|보험|복지|대출|통신요금|요금제)/i.test(text);
}

function issue(code, message, { severity = "hard", repairScope = "targeted" } = {}) {
  return { code, message, severity, repairScope };
}

function evaluateArticleQuality({
  topic = "",
  title = "",
  article = "",
  historyTitles = [],
  searchResults = [],
  sourceQuality = null,
  maxTitleSimilarity = 0.72
} = {}) {
  const issues = [];
  const joined = `${title}\n${article}`;

  if (FAKE_EXPERIENCE_PATTERNS.some((pattern) => pattern.test(joined))) {
    issues.push(issue(
      "fabricated_experience",
      "실제로 확인되지 않은 직접 사용·구매·신청 경험 표현이 포함되어 있습니다.",
      { severity: "hard", repairScope: "targeted" }
    ));
  }

  const unsupported = unsupportedNumberClaims(title, article, searchResults);
  if (unsupported.length) {
    issues.push(issue(
      "unsupported_numeric_claim",
      `검색 근거에서 확인되지 않은 숫자 주장이 있습니다: ${unsupported.slice(0, 4).join(", ")}`,
      { severity: "hard", repairScope: "targeted" }
    ));
  }

  if (looksHighStakes({ topic, title, sourceQuality }) && FACT_NUMBER_RE.test(joined) && !sourceHasOfficialEvidence(searchResults)) {
    issues.push(issue(
      "high_stakes_without_authority",
      "정책·금전성 주제의 구체 숫자 주장에 공식/기관 근거가 없습니다.",
      { severity: "hard", repairScope: "targeted" }
    ));
  }
  FACT_NUMBER_RE.lastIndex = 0;

  const similarity = maxRecentTitleSimilarity(title, historyTitles);
  if (similarity >= maxTitleSimilarity) {
    issues.push(issue(
      "duplicate_title",
      `최근 제목과 표현/소재가 너무 유사합니다 (${Math.round(similarity * 100)}%).`,
      { severity: "soft", repairScope: "title" }
    ));
  }

  const aiPhrase = AI_PHRASES.find((phrase) => String(article || "").includes(phrase));
  if (aiPhrase) {
    issues.push(issue(
      "ai_phrase",
      `AI 상투어를 자연스러운 문장으로 바꿔야 합니다: ${aiPhrase}`,
      { severity: "soft", repairScope: "targeted" }
    ));
  }

  if (repeatedEndingIssue(article)) {
    issues.push(issue(
      "repeated_endings",
      "같은 종결어미가 과도하게 반복됩니다.",
      { severity: "soft", repairScope: "targeted" }
    ));
  }

  const articleChars = String(article || "").replace(/\s/g, "").length;
  if (articleChars > 0 && articleChars < 1200) {
    issues.push(issue(
      "article_too_short",
      `본문이 너무 짧습니다 (${articleChars}자).`,
      { severity: "soft", repairScope: "full" }
    ));
  }
  if (articleChars > 2600) {
    issues.push(issue(
      "article_too_long",
      `본문이 너무 깁니다 (${articleChars}자).`,
      { severity: "soft", repairScope: "targeted" }
    ));
  }

  const hardIssues = issues.filter((item) => item.severity === "hard");
  const repairScopes = new Set(issues.map((item) => item.repairScope));
  const repairScope = repairScopes.has("full")
    ? "full"
    : repairScopes.has("targeted")
      ? "targeted"
      : repairScopes.has("title")
        ? "title"
        : "none";

  return {
    pass: issues.length === 0,
    hardBlock: hardIssues.length > 0,
    issues,
    repairScope,
    titleSimilarity: Number(similarity.toFixed(3)),
    unsupportedNumberClaims: unsupported,
    repairFeedback: issues.map((item) => item.message).join(" / ").slice(0, 2500)
  };
}

module.exports = {
  evaluateArticleQuality,
  titleSimilarity,
  maxRecentTitleSimilarity,
  unsupportedNumberClaims,
  _private: {
    looksHighStakes,
    repeatedEndingIssue,
    sourceHasOfficialEvidence
  }
};
