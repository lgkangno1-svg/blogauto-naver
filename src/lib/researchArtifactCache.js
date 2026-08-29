const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { normalizeUrl } = require("./sourceCache");

const CACHE_VERSION = 1;
const PROMPT_POLICY_VERSION = "research-title-v2-2026-08-30";
const DEFAULT_MAX_ENTRIES = 250;
const TTL_BY_FRESHNESS = {
  low: 24 * 60 * 60 * 1000,
  medium: 6 * 60 * 60 * 1000,
  auto: 12 * 60 * 60 * 1000,
  high: 0
};

function text(value, limit = 1200) {
  return String(value || "").normalize("NFKC").replace(/\s+/g, " ").trim().slice(0, limit);
}

function list(value, maxItems = 12, limit = 500) {
  return Array.isArray(value) ? value.slice(0, maxItems).map((item) => text(item, limit)).filter(Boolean) : [];
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function hash(value) {
  return crypto.createHash("sha256").update(String(value || ""), "utf8").digest("hex");
}

function freshness(value) {
  const normalized = String(value || "auto").toLowerCase();
  return Object.prototype.hasOwnProperty.call(TTL_BY_FRESHNESS, normalized) ? normalized : "auto";
}

function ttlForFreshness(value) {
  return TTL_BY_FRESHNESS[freshness(value)];
}

function relevance(item = {}) {
  const source = item.relevance || {};
  return {
    score: Number(source.score || 0),
    officialSource: source.officialSource === true,
    institutionalSource: source.institutionalSource === true,
    independentSource: source.independentSource === true,
    lowTrustSource: source.lowTrustSource === true,
    currentFactSignal: source.currentFactSignal === true,
    strictEvidence: source.strictEvidence === true,
    authorityEvidence: source.authorityEvidence === true,
    independentEvidence: source.independentEvidence === true
  };
}

function buildSourceSetFingerprint(searchResults = []) {
  const rows = [];
  const seen = new Set();
  for (const item of Array.isArray(searchResults) ? searchResults : []) {
    const excerpt = text(item?.excerpt || item?.snippet, 14000);
    if (excerpt.length < 80) continue;
    const row = {
      url: normalizeUrl(item?.fetchedUrl || item?.url || ""),
      title: text(item?.title, 240),
      contentHash: hash(excerpt),
      relevance: relevance(item)
    };
    const identity = `${row.url}|${row.contentHash}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    rows.push(row);
  }
  rows.sort((a, b) => `${a.url}|${a.contentHash}|${a.title}`.localeCompare(`${b.url}|${b.contentHash}|${b.title}`));
  return { sourceCount: rows.length, hash: rows.length ? hash(stable(rows)) : "" };
}

function sourceQuality(source = {}) {
  return {
    status: text(source.status, 60).toLowerCase(),
    authorityEvidenceRequired: source.authorityEvidenceRequired === true,
    authorityEvidenceCandidates: Number(source.authorityEvidenceCandidates || 0),
    independentEvidenceRequired: source.independentEvidenceRequired === true,
    independentEvidenceCandidates: Number(source.independentEvidenceCandidates || 0),
    strongEvidenceCandidates: Number(source.strongEvidenceCandidates || 0),
    topicMatchedCandidates: Number(source.topicMatchedCandidates || 0),
    directlyRelevantCandidates: Number(source.directlyRelevantCandidates || 0)
  };
}

function classificationSignature(classification = {}) {
  return {
    searchNeed: text(classification.searchNeed, 40).toLowerCase(),
    reasons: list(classification.reasons, 12, 100).sort()
  };
}

function evaluateResearchArtifactCacheEligibility(options = {}, classification = {}) {
  const sourceFingerprint = buildSourceSetFingerprint(options.searchResults);
  const quality = sourceQuality(options.sourceQuality || {});
  const risk = classificationSignature(classification);
  if (!options.runtimeRoot) return { eligible: false, reason: "runtime_root_missing", sourceFingerprint };
  if (String(options.topicMode || "manual").toLowerCase() !== "manual") return { eligible: false, reason: "auto_topic_not_cacheable", sourceFingerprint };
  if (!text(options.topic, 600)) return { eligible: false, reason: "direct_topic_missing", sourceFingerprint };
  if (!sourceFingerprint.hash) return { eligible: false, reason: "source_content_missing", sourceFingerprint };
  if (quality.status !== "usable") return { eligible: false, reason: `source_quality_${quality.status || "unknown"}`, sourceFingerprint };
  if (freshness(options.freshnessLevel) === "high") return { eligible: false, reason: "high_freshness_not_cacheable", sourceFingerprint };
  if (risk.searchNeed === "strict") return { eligible: false, reason: "strict_research_not_cacheable", sourceFingerprint };
  if (risk.reasons.some((reason) => [
    "high_stakes_fact_pattern",
    "high_freshness",
    "known_source_quality_failure",
    "authority_evidence_required"
  ].includes(reason))) return { eligible: false, reason: "risk_or_current_context_not_cacheable", sourceFingerprint };
  if (text(options.researchRevisionContext, 200)) return { eligible: false, reason: "revision_context_not_cacheable", sourceFingerprint };
  return { eligible: true, reason: "eligible", sourceFingerprint };
}

function contextFor(options = {}, classification = {}, sourceFingerprint) {
  return {
    cacheVersion: CACHE_VERSION,
    promptPolicyVersion: PROMPT_POLICY_VERSION,
    sourceSetHash: sourceFingerprint.hash,
    sourceCount: sourceFingerprint.sourceCount,
    topicMode: text(options.topicMode || "manual", 40).toLowerCase(),
    topic: text(options.topic, 600),
    keyword: text(options.keyword, 600),
    category: text(options.category, 300),
    excludedTopics: text(options.excludedTopics, 1200),
    publishPurpose: text(options.publishPurpose, 1200),
    preferredTone: text(options.preferredTone, 600),
    freshnessLevel: freshness(options.freshnessLevel),
    currentDateLabel: text(options.currentDateLabel, 40),
    tokenEfficiencyMode: text(options.tokenEfficiencyMode, 40),
    codexModel: text(options.codexModel, 80),
    researchEffort: text(options.agentModels?.research, 40),
    keywordLanes: Array.isArray(options.keywordLanes) ? options.keywordLanes.slice(0, 20) : [],
    recommendedKeywordLanes: Array.isArray(options.recommendedKeywordLanes) ? options.recommendedKeywordLanes.slice(0, 20) : [],
    historyTitles: list(options.historyTitles, 80, 260),
    sourceQuality: sourceQuality(options.sourceQuality || {}),
    classification: classificationSignature(classification)
  };
}

function buildResearchArtifactCacheKey(options = {}, classification = {}) {
  const eligibility = evaluateResearchArtifactCacheEligibility(options, classification);
  const context = contextFor(options, classification, eligibility.sourceFingerprint);
  return { ...eligibility, context, key: eligibility.eligible ? hash(stable(context)) : "" };
}

function compactObject(value, fields, limit = 700) {
  const out = {};
  for (const field of fields) {
    const item = value?.[field];
    if (typeof item === "string") {
      const compacted = text(item, limit);
      if (compacted) out[field] = compacted;
    } else if (typeof item === "boolean" || typeof item === "number") out[field] = item;
  }
  return out;
}

function compactResearchArtifact(result = {}) {
  const artifact = compactObject(result, [
    "status", "failureReason", "finalTitle", "topicThesis", "topicLane", "directTopicPreserved",
    "factBased", "searchNeed", "searchFlowSummary", "currentBridgeRequired", "currentBridgeSatisfied", "writerBrief"
  ], 1200);
  artifact.selectedKeywordIndexes = Array.isArray(result.selectedKeywordIndexes)
    ? result.selectedKeywordIndexes.slice(0, 12).map(Number).filter(Number.isFinite) : [];
  for (const field of [
    "selectedKeywordPhrases", "searchQueries", "repeatedTopics", "competitionGaps", "coreQuestions",
    "mustCover", "avoidDirections", "confirmedFacts", "uncertainItems", "notes"
  ]) artifact[field] = list(result[field], 16, 700);
  artifact.anchorEvent = compactObject(result.anchorEvent, ["name", "date", "summary"], 700);
  artifact.currentPeg = compactObject(result.currentPeg, ["date", "summary"], 700);
  artifact.currentPeg.sourceIds = list(result.currentPeg?.sourceIds, 8, 100);
  artifact.usableSources = Array.isArray(result.usableSources) ? result.usableSources.slice(0, 10).map((item) => ({
    sourceId: text(item?.sourceId || item?.id, 100), title: text(item?.title, 260),
    url: text(item?.url || item?.fetchedUrl, 500), reason: text(item?.reason, 500)
  })).filter((item) => item.sourceId || item.title || item.url) : [];
  artifact.titleCandidates = Array.isArray(result.titleCandidates) ? result.titleCandidates.slice(0, 6).map((item) => ({
    title: text(item?.title, 260), reason: text(item?.reason, 500), risk: text(item?.risk, 300)
  })).filter((item) => item.title) : [];
  const contract = result.writerContract || {};
  artifact.writerContract = compactObject(contract, [
    "articleMission", "selectedTitle", "topicThesis", "targetReader", "readerPromise", "firstSectionFocus",
    "currentBridgeRequired", "currentBridgeSatisfied", "tone"
  ], 700);
  for (const field of [
    "mustAnswer", "mustCover", "mustNotDo", "confirmedFacts", "uncertainItems", "sourceBoundaries",
    "safetyBoundaries", "recommendedStructure", "readerValueChecklist"
  ]) artifact.writerContract[field] = list(contract[field], 12, 500);
  artifact.writerContract.anchorEvent = compactObject(contract.anchorEvent, ["name", "date", "summary"], 600);
  artifact.writerContract.currentPeg = compactObject(contract.currentPeg, ["date", "summary"], 600);
  artifact.writerContract.currentPeg.sourceIds = list(contract.currentPeg?.sourceIds, 8, 100);
  return artifact;
}

function artifactIsReusable(artifact = {}, options = {}) {
  return String(artifact.status || "").toUpperCase() === "PASS"
    && Boolean(text(artifact.finalTitle, 260))
    && Boolean(text(artifact.topicThesis, 600))
    && Boolean(text(artifact.searchNeed, 40))
    && (String(options.topicMode || "manual").toLowerCase() !== "manual" || artifact.directTopicPreserved === true);
}

function cacheDir(runtimeRoot) {
  return path.join(String(runtimeRoot || ""), "cache", "research-artifacts");
}

function readResearchArtifactCache({ options = {}, classification = {}, nowMs = Date.now() } = {}) {
  const info = buildResearchArtifactCacheKey(options, classification);
  if (!info.eligible) return { ...info, hit: false };
  const ttlMs = ttlForFreshness(options.freshnessLevel);
  if (!(ttlMs > 0)) return { ...info, hit: false, reason: "ttl_disabled", ttlMs };
  const filePath = path.join(cacheDir(options.runtimeRoot), `${info.key}.json`);
  if (!fs.existsSync(filePath)) return { ...info, hit: false, reason: "missing", filePath, ttlMs };
  let payload;
  try { payload = JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "")); } catch { payload = null; }
  if (!payload || payload.version !== CACHE_VERSION || payload.promptPolicyVersion !== PROMPT_POLICY_VERSION || payload.key !== info.key) {
    return { ...info, hit: false, reason: "schema_or_key_mismatch", filePath, ttlMs };
  }
  const storedAtMs = Date.parse(String(payload.storedAt || ""));
  if (!Number.isFinite(storedAtMs)) return { ...info, hit: false, reason: "invalid_timestamp", filePath, ttlMs };
  const ageMs = Math.max(0, Number(nowMs) - storedAtMs);
  if (ageMs > ttlMs) return { ...info, hit: false, reason: "expired", filePath, ttlMs, ageMs };
  if (!artifactIsReusable(payload.artifact, options)) return { ...info, hit: false, reason: "artifact_not_reusable", filePath, ttlMs, ageMs };
  return { ...info, hit: true, reason: "hit", artifact: payload.artifact, storedAt: payload.storedAt, filePath, ttlMs, ageMs };
}

function pruneResearchArtifactCache(runtimeRoot, { maxEntries = DEFAULT_MAX_ENTRIES, nowMs = Date.now() } = {}) {
  const dir = cacheDir(runtimeRoot);
  if (!runtimeRoot || !fs.existsSync(dir)) return { removed: 0, remaining: 0 };
  const files = fs.readdirSync(dir).filter((name) => name.endsWith(".json")).map((name) => {
    const filePath = path.join(dir, name);
    try { return { filePath, mtimeMs: fs.statSync(filePath).mtimeMs }; } catch { return null; }
  }).filter(Boolean).sort((a, b) => b.mtimeMs - a.mtimeMs);
  let removed = 0;
  files.forEach((item, index) => {
    if (index < Math.max(0, Number(maxEntries) || 0) && nowMs - item.mtimeMs <= 7 * 24 * 60 * 60 * 1000) return;
    try { fs.rmSync(item.filePath, { force: true }); removed += 1; } catch {}
  });
  return { removed, remaining: Math.max(0, files.length - removed) };
}

function writeResearchArtifactCache({ options = {}, classification = {}, result = {}, now = new Date() } = {}) {
  const info = buildResearchArtifactCacheKey(options, classification);
  if (!info.eligible) return { ...info, written: false };
  const artifact = compactResearchArtifact(result);
  if (!artifactIsReusable(artifact, options)) return { ...info, written: false, reason: "artifact_not_reusable" };
  const dir = cacheDir(options.runtimeRoot);
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${info.key}.json`);
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  const payload = { version: CACHE_VERSION, promptPolicyVersion: PROMPT_POLICY_VERSION, key: info.key, storedAt: now.toISOString(), artifact };
  try {
    fs.writeFileSync(tempPath, `${JSON.stringify(payload)}\n`, "utf8");
    fs.renameSync(tempPath, filePath);
    pruneResearchArtifactCache(options.runtimeRoot);
    return { ...info, written: true, reason: "written", filePath, artifact };
  } catch {
    try { fs.rmSync(tempPath, { force: true }); } catch {}
    return { ...info, written: false, reason: "write_failed", filePath };
  }
}

module.exports = {
  CACHE_VERSION,
  PROMPT_POLICY_VERSION,
  TTL_BY_FRESHNESS,
  ttlForFreshness,
  buildSourceSetFingerprint,
  evaluateResearchArtifactCacheEligibility,
  buildResearchArtifactCacheKey,
  readResearchArtifactCache,
  writeResearchArtifactCache,
  pruneResearchArtifactCache,
  _private: { text, list, stable, hash, sourceQuality, classificationSignature, compactResearchArtifact, artifactIsReusable, cacheDir }
};
