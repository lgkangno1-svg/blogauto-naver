const HIGH_STAKES_RE = /(정부|지원금|장려금|세금|환급|보조금|법률?|규정|자격|신청|모집|청약|대출|금리|보험|연금|복지|통신요금|요금제)/i;
const CURRENT_FACT_RE = /(최신|최근|현재|오늘|이번\s*(?:주|달|월|분기|년)|가격|요금|할인|출시|런칭|발표|업데이트|변경|중단|종료|리콜|장애|공고|마감|일정|예약|판매|재고|모집|신청|접수|오픈|운영중|가능|뉴스|이슈)/i;
const DATE_SIGNAL_RE = /(?:20\d{2}[년.\-/ ]|\d{1,2}월|\d{1,2}일)/;

function normalizeFreshness(value) {
  const normalized = String(value || "auto").trim().toLowerCase();
  return ["low", "medium", "high", "auto"].includes(normalized) ? normalized : "auto";
}

function deterministicSearchPreflight({
  topic = "",
  keyword = "",
  publishPurpose = "",
  topicMode = "manual",
  freshnessLevel = "auto",
  sourceQuality = null,
  searchResults = []
} = {}) {
  if (Array.isArray(searchResults) && searchResults.length > 0) {
    return { shouldSearchFirst: false, searchNeed: "", reasons: ["search_results_already_present"] };
  }

  const text = [topic, keyword, publishPurpose].map((value) => String(value || "")).join(" ");
  const freshness = normalizeFreshness(freshnessLevel);
  const reasons = [];
  let searchNeed = "";

  if (String(topicMode || "manual").toLowerCase() === "auto") {
    searchNeed = "normal";
    reasons.push("auto_topic_requires_sources");
  }

  if (HIGH_STAKES_RE.test(text)) {
    searchNeed = "strict";
    reasons.push("high_stakes_fact_pattern");
  } else if (CURRENT_FACT_RE.test(text) || DATE_SIGNAL_RE.test(text)) {
    searchNeed = searchNeed || "normal";
    reasons.push("current_or_date_bound_pattern");
  }

  if (freshness === "high") {
    searchNeed = searchNeed === "strict" ? "strict" : "normal";
    reasons.push("high_freshness");
  } else if (freshness === "medium" && searchNeed === "") {
    // Medium freshness alone is not enough to force a search. Stable manual topics
    // can still let Research decide to skip and avoid unnecessary browsing.
    reasons.push("medium_freshness_not_forced");
  }

  const qualityStatus = String(sourceQuality?.status || "").toLowerCase();
  if (["insufficient", "strict_insufficient"].includes(qualityStatus)) {
    searchNeed = "strict";
    reasons.push("known_source_quality_failure");
  }
  if (sourceQuality?.officialEvidenceRequired === true || sourceQuality?.independentEvidenceRequired === true) {
    searchNeed = "strict";
    reasons.push("authority_evidence_required");
  }

  return {
    shouldSearchFirst: ["normal", "strict"].includes(searchNeed),
    searchNeed,
    reasons
  };
}

function buildPreflightResearchRequest(options = {}, decision = {}) {
  const topic = String(options.topic || "").trim();
  return {
    status: "REVISION",
    searchNeed: decision.searchNeed || "normal",
    finalTitle: "",
    topicThesis: topic,
    failureReason: "Deterministic search preflight requested sources before the first Research Agent call.",
    searchFlowSummary: `Preflight search: ${(decision.reasons || []).join(", ")}`,
    notes: [
      "토큰 최적화: 검색이 명백한 주제라 첫 Research 검색판정 호출을 생략하고 먼저 자료를 수집합니다."
    ]
  };
}

module.exports = {
  deterministicSearchPreflight,
  buildPreflightResearchRequest,
  _private: {
    HIGH_STAKES_RE,
    CURRENT_FACT_RE,
    DATE_SIGNAL_RE,
    normalizeFreshness
  }
};
