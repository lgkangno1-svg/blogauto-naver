const { buildEvidenceLedger } = require("./evidenceLedger");

const TARGETED_REPAIR_CODES = new Set([
  "fabricated_experience",
  "unsupported_numeric_claim",
  "ai_phrase",
  "repeated_endings",
  "article_too_long"
]);

function planPartialRepair(quality = {}) {
  const issues = Array.isArray(quality?.issues) ? quality.issues.filter(Boolean) : [];
  if (!issues.length || quality?.pass === true) {
    return { eligible: false, reason: "no_issues", issueCodes: [] };
  }
  if (quality?.repairScope === "full") {
    return { eligible: false, reason: "full_rewrite_required", issueCodes: issues.map((item) => item.code).filter(Boolean) };
  }

  const issueCodes = issues.map((item) => String(item?.code || "")).filter(Boolean);
  const unsupportedCodes = issueCodes.filter((code) => !TARGETED_REPAIR_CODES.has(code));
  if (unsupportedCodes.length) {
    return {
      eligible: false,
      reason: `unsupported_scope:${unsupportedCodes.join(",")}`,
      issueCodes
    };
  }

  return {
    eligible: true,
    reason: "targeted_article_repair",
    scope: "article",
    issueCodes,
    messages: issues.map((item) => String(item?.message || "")).filter(Boolean).slice(0, 6)
  };
}

function compactOriginalResult(writerResult = {}) {
  return {
    title: String(writerResult?.title || ""),
    article: String(writerResult?.article || ""),
    tags: Array.isArray(writerResult?.tags) ? writerResult.tags.slice(0, 12) : [],
    notes: Array.isArray(writerResult?.notes) ? writerResult.notes.slice(0, 8) : []
  };
}

function buildPartialRepairPrompt({
  writerResult = {},
  deterministicQuality = {},
  topic = "",
  keyword = "",
  searchResults = []
} = {}) {
  const plan = planPartialRepair(deterministicQuality);
  if (!plan.eligible) return "";

  const evidenceLedger = buildEvidenceLedger(searchResults, {
    topic: topic || writerResult?.title || "",
    keyword,
    maxSources: 6,
    maxFactsPerSource: 3,
    maxEvidenceChars: 1800
  });
  const original = compactOriginalResult(writerResult);

  return [
    "You are the Writer Agent performing a narrow repair of an already-good Korean Naver Blog draft.",
    "This is NOT a full rewrite. Preserve all unaffected wording, structure, section order, tags, and factual meaning.",
    "Do not change the title. Research/Title Agent owns the selected title.",
    "Do not add new facts, dates, amounts, percentages, personal experience, products, policies, or claims.",
    "Only change the minimum sentences necessary to resolve the listed deterministic issues.",
    "",
    `Topic: ${topic || "(same as selected title)"}`,
    `Keyword: ${keyword || "(none)"}`,
    "",
    "Issues to repair:",
    JSON.stringify({ issueCodes: plan.issueCodes, messages: plan.messages }, null, 2),
    "",
    "Compact evidence ledger (support boundary only):",
    JSON.stringify(evidenceLedger, null, 2),
    "",
    "Current draft:",
    JSON.stringify(original, null, 2),
    "",
    "Repair rules by issue:",
    "- fabricated_experience: convert unverified first-person/use-duration wording into neutral reader-facing information without inventing replacement experience.",
    "- unsupported_numeric_claim: remove the unsupported number or replace the sentence with a non-numeric statement only when that statement is supported by the evidence ledger.",
    "- ai_phrase: replace only the stock AI phrase with natural Korean wording.",
    "- repeated_endings: vary sentence endings locally; preserve meaning and paragraph order.",
    "- article_too_long: remove repetition and low-value padding; do not cut supported decision-critical details.",
    "",
    "Required output:",
    "- Write one JSON object only using this shape:",
    "  {\"status\":\"success\"|\"failed\",\"failureReason\":\"\",\"title\":\"unchanged title\",\"article\":\"repaired article\",\"tags\":[],\"notes\":[]}",
    "- status=failed if the issue cannot be repaired without changing the title, changing the topic, or inventing facts.",
    "- Keep title byte-for-byte identical to the Current draft title when status=success."
  ].join("\n");
}

function mergePartialRepairResult(original = {}, repair = {}) {
  if (String(repair?.status || "").toLowerCase() !== "success") return null;
  const article = String(repair?.article || "").trim();
  if (!article) return null;
  return {
    ...original,
    article,
    title: String(original?.title || ""),
    tags: Array.isArray(original?.tags) ? original.tags : [],
    notes: [
      ...(Array.isArray(original?.notes) ? original.notes : []),
      ...(Array.isArray(repair?.notes) ? repair.notes : [])
    ].slice(0, 20),
    partialRepairApplied: true
  };
}

function partialRepairEffort(tokenEfficiencyMode = "balanced") {
  return String(tokenEfficiencyMode || "balanced").toLowerCase() === "quality" ? "medium" : "low";
}

module.exports = {
  planPartialRepair,
  buildPartialRepairPrompt,
  mergePartialRepairResult,
  partialRepairEffort,
  _private: {
    TARGETED_REPAIR_CODES,
    compactOriginalResult
  }
};
