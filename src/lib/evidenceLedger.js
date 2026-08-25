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

  // Prefer sentences that actually support the topic/keyword or contain a concrete fact.
  // Zero-signal prose is useful only as a last-resort fallback and should not consume the
  // repeated Writer/Main prompt budget.
  const useful = ranked.filter((item) => item.score > 0);
  const candidates = useful.length ? useful : ranked.slice(0, 1);
  const selected = [];
  let used = 0;
  for (const item of candidates) {
    if (selected.length >= 3) break;
    const sentence = compactText(item.sentence, 220);
    if (!sentence || used + sentence.length > maxChars) continue;
    selected.push(sentence);
    used += sentence.length;
  }
  if (!selected.length) {
    const fallback = compactText(text, Math.min(maxChars, 220));
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

function sourcePriority(item = {}) {
  const strength = sourceStrength(item);
  const base = {
    official: 40,
    institution: 32,
    independent: 24,
    web: 12,
    "low-trust": 0
  }[strength] || 8;
  const relevance = item.relevance || {};
  return base
    + Math.min(20, Math.max(0, Number(relevance.score || 0)))
    + (relevance.currentFactSignal === true ? 6 : 0)
    + (relevance.strictEvidence === true ? 4 : 0);
}

function sourceIdentity(item = {}) {
  const url = String(item.fetchedUrl || item.url || "").trim().toLowerCase();
  if (url) return `url:${url}`;
  const title = compactText(item.title, 180).toLowerCase();
  return title ? `title:${title}` : "";
}

function rankAndDedupeSources(searchResults = []) {
  const seen = new Set();
  return (Array.isArray(searchResults) ? searchResults : [])
    .filter(Boolean)
    .slice()
    .sort((a, b) => sourcePriority(b) - sourcePriority(a))
    .filter((item) => {
      const key = sourceIdentity(item);
      if (!key) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function buildEvidenceLedger(searchResults = [], {
  topic = "",
  keyword = "",
  maxSources = 8,
  maxEvidenceChars = 360,
  maxTotalEvidenceChars = 2200
} = {}) {
  const terms = termsFrom(topic, keyword);
  const ranked = rankAndDedupeSources(searchResults);
  const chosen = ranked.slice(0, Math.max(1, maxSources));
  const rows = [];
  let evidenceChars = 0;
  const totalBudget = Math.max(300, Number(maxTotalEvidenceChars) || 2200);

  for (let index = 0; index < chosen.length; index += 1) {
    const item = chosen[index];
    const remaining = totalBudget - evidenceChars;
    if (remaining < 80) break;
    const perSourceBudget = Math.min(Math.max(120, maxEvidenceChars), remaining);
    const facts = selectEvidenceSentences(item.excerpt || item.snippet || "", terms, perSourceBudget);
    const factChars = facts.reduce((sum, fact) => sum + fact.length, 0);
    const row = {
      id: String(item.sourceId || `S${index + 1}`),
      sourceType: sourceStrength(item),
      title: compactText(item.title, 150),
      url: String(item.fetchedUrl || item.url || "").trim(),
      score: Number(item?.relevance?.score || 0),
      currentFactSignal: item?.relevance?.currentFactSignal === true,
      facts
    };
    if (!row.title && !row.facts.length) continue;
    rows.push(row);
    evidenceChars += factChars;
  }

  return {
    topic: compactText(topic, 180),
    keyword: compactText(keyword, 100),
    sourceCount: rows.length,
    candidateCount: ranked.length,
    omittedSourceCount: Math.max(0, ranked.length - rows.length),
    evidenceChars,
    sources: rows
  };
}

function compactPrimitive(value, limit = 260) {
  if (typeof value === "string") return compactText(value, limit);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value === null || value === undefined) return undefined;
  return compactText(value, limit);
}

function compactObject(value, { maxKeys = 6, stringChars = 220, depth = 0 } = {}) {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== "object") return compactPrimitive(value, stringChars);
  if (depth >= 2) return compactText(JSON.stringify(value), stringChars);
  if (Array.isArray(value)) {
    return value
      .slice(0, maxKeys)
      .map((item) => compactObject(item, { maxKeys, stringChars, depth: depth + 1 }))
      .filter((item) => item !== undefined && item !== "");
  }
  const out = {};
  for (const [key, nested] of Object.entries(value).slice(0, maxKeys)) {
    const compacted = compactObject(nested, { maxKeys, stringChars, depth: depth + 1 });
    if (compacted === undefined || compacted === "") continue;
    if (Array.isArray(compacted) && compacted.length === 0) continue;
    out[key] = compacted;
  }
  return Object.keys(out).length ? out : undefined;
}

function compactList(value, maxItems = 8, itemChars = 260) {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, maxItems)
    .map((item) => compactObject(item, { maxKeys: 6, stringChars: itemChars }))
    .filter((item) => item !== undefined && item !== "");
}

function compactSourceRef(item) {
  if (typeof item === "string") return compactText(item, 260);
  if (!item || typeof item !== "object") return compactPrimitive(item, 260);
  const ref = {
    sourceId: compactText(item.sourceId || item.id, 80),
    title: compactText(item.title, 180),
    url: compactText(item.fetchedUrl || item.url, 300),
    sourceType: compactText(item.sourceType || item.type, 80)
  };
  return Object.fromEntries(Object.entries(ref).filter(([, value]) => value !== ""));
}

function pruneEmptyObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => {
    if (item === undefined || item === null || item === "") return false;
    if (Array.isArray(item) && item.length === 0) return false;
    if (typeof item === "object" && !Array.isArray(item) && Object.keys(item).length === 0) return false;
    return true;
  }));
}

function compactResearchHandoff(result = {}, { includeWriterContract = false } = {}) {
  if (!result || typeof result !== "object") return {};
  const handoff = {
    status: result.status,
    searchNeed: result.searchNeed,
    finalTitle: compactText(result.finalTitle || result.selectedTitle, 220),
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
    // The full excerpt/body belongs in the Evidence Ledger. Repeating it here is a
    // large prompt leak, so usableSources is intentionally reduced to references.
    usableSources: Array.isArray(result.usableSources)
      ? result.usableSources.slice(0, 8).map(compactSourceRef).filter(Boolean)
      : [],
    currentBridgeRequired: result.currentBridgeRequired === true || undefined,
    currentBridgeSatisfied: result.currentBridgeSatisfied === true || undefined,
    anchorEvent: compactObject(result.anchorEvent, { maxKeys: 5, stringChars: 240 }),
    currentPeg: compactObject(result.currentPeg, { maxKeys: 5, stringChars: 240 }),
    // buildPrompt already sends the Writer Contract separately as the highest-priority
    // brief. Excluding it from the support handoff avoids sending the same contract twice.
    writerContract: includeWriterContract
      ? compactObject(result.writerContract, { maxKeys: 16, stringChars: 320 })
      : undefined
  };
  return pruneEmptyObject(handoff);
}

module.exports = {
  buildEvidenceLedger,
  compactResearchHandoff,
  _private: {
    compactText,
    compactObject,
    selectEvidenceSentences,
    sentenceScore,
    sourceStrength,
    sourcePriority,
    rankAndDedupeSources,
    termsFrom
  }
};
