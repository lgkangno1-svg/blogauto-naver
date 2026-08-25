function compactText(value, limit = 360) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function termsFrom(...values) {
  return Array.from(new Set(values
    .flatMap((value) => String(value || "").match(/[가-힣A-Za-z0-9]{2,}/g) || [])
    .filter((term) => term.length >= 2)))
    .slice(0, 24);
}

function sentenceScore(sentence, terms) {
  const text = String(sentence || "").toLowerCase();
  let score = 0;
  for (const term of terms) {
    if (text.includes(String(term).toLowerCase())) score += 2;
  }
  if (/\d/.test(text)) score += 1;
  if (/(신청|조건|대상|가격|일정|변경|발표|지원|비교|방법|주의|확인)/.test(text)) score += 1;
  return score;
}

function selectEvidenceSentences(text, terms, maxChars = 360) {
  const sentences = String(text || "")
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?。])\s+|\s*[·•]\s*/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 15);

  const ranked = sentences
    .map((sentence, index) => ({ sentence, index, score: sentenceScore(sentence, terms) }))
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const selected = [];
  let used = 0;
  for (const item of ranked) {
    if (selected.length >= 3) break;
    const sentence = compactText(item.sentence, 220);
    if (!sentence || used + sentence.length > maxChars) continue;
    selected.push(sentence);
    used += sentence.length;
  }
  if (!selected.length) {
    const fallback = compactText(text, maxChars);
    if (fallback) selected.push(fallback);
  }
  return selected;
}

function sourceStrength(item = {}) {
  const relevance = item.relevance || {};
  if (relevance.officialSource === true) return "official";
  if (relevance.institutionalSource === true) return "institution";
  if (relevance.independentSource === true) return "independent";
  if (relevance.lowTrustSource === true) return "low-trust";
  return "web";
}

function buildEvidenceLedger(searchResults = [], {
  topic = "",
  keyword = "",
  maxSources = 8,
  maxEvidenceChars = 360
} = {}) {
  const terms = termsFrom(topic, keyword);
  const rows = (Array.isArray(searchResults) ? searchResults : [])
    .filter(Boolean)
    .slice(0, Math.max(1, maxSources))
    .map((item, index) => ({
      id: String(item.sourceId || `S${index + 1}`),
      sourceType: sourceStrength(item),
      title: compactText(item.title, 150),
      url: String(item.fetchedUrl || item.url || "").trim(),
      score: Number(item?.relevance?.score || 0),
      currentFactSignal: item?.relevance?.currentFactSignal === true,
      facts: selectEvidenceSentences(item.excerpt || item.snippet || "", terms, maxEvidenceChars)
    }))
    .filter((item) => item.title || item.facts.length);

  return {
    topic: compactText(topic, 180),
    keyword: compactText(keyword, 100),
    sourceCount: rows.length,
    sources: rows
  };
}

function compactList(value, maxItems = 8, itemChars = 260) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => typeof item === "string" ? compactText(item, itemChars) : item)
    .filter(Boolean)
    .slice(0, maxItems);
}

function compactResearchHandoff(result = {}) {
  if (!result || typeof result !== "object") return {};
  return {
    status: result.status,
    searchNeed: result.searchNeed,
    finalTitle: result.finalTitle || result.selectedTitle,
    topicThesis: compactText(result.topicThesis, 500),
    targetReader: compactText(result.targetReader, 240),
    readerPromise: compactText(result.readerPromise, 400),
    firstSectionFocus: compactText(result.firstSectionFocus, 360),
    mustAnswer: compactList(result.mustAnswer, 8),
    mustCover: compactList(result.mustCover, 10),
    mustNotDo: compactList(result.mustNotDo, 10),
    confirmedFacts: compactList(result.confirmedFacts, 12, 320),
    uncertainItems: compactList(result.uncertainItems, 8, 280),
    sourceBoundaries: compactList(result.sourceBoundaries, 8, 280),
    usableSources: compactList(result.usableSources, 8, 320),
    currentBridgeRequired: result.currentBridgeRequired === true,
    currentBridgeSatisfied: result.currentBridgeSatisfied === true,
    anchorEvent: result.anchorEvent || null,
    currentPeg: result.currentPeg || null,
    writerContract: result.writerContract || undefined
  };
}

module.exports = {
  buildEvidenceLedger,
  compactResearchHandoff,
  _private: {
    compactText,
    selectEvidenceSentences,
    sentenceScore,
    sourceStrength,
    termsFrom
  }
};
