const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const codexPath = path.join(root, "src", "lib", "codexRunner.js");
const diagnosticsPath = path.join(root, "src", "lib", "jobDiagnostics.js");
const mainPath = path.join(root, "src", "main.js");

function replaceOnce(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`research-artifact-cache patch anchor missing: ${label}`);
  return source.replace(before, after);
}

let codex = fs.readFileSync(codexPath, "utf8");
codex = replaceOnce(
  codex,
  'const { deterministicSearchPreflight, buildPreflightResearchRequest } = require("./researchPreflight");\n',
  'const { deterministicSearchPreflight, buildPreflightResearchRequest } = require("./researchPreflight");\nconst { readResearchArtifactCache, writeResearchArtifactCache } = require("./researchArtifactCache");\n',
  "codex import"
);

codex = replaceOnce(
  codex,
  '  let totalTokens = 0;\n  let totalGrossTokens = 0;\n  let latestRateLimits = null;\n  const rememberRateLimits = (result) => {',
  '  let totalTokens = 0;\n  let totalGrossTokens = 0;\n  let latestRateLimits = null;\n  const researchOptimization = {\n    preflight: {\n      applied: false,\n      searchMode: "",\n      reason: "",\n      codexDecisionCallSkipped: false\n    },\n    artifactCache: {\n      eligible: false,\n      hit: false,\n      reason: "not_checked",\n      codexResearchCallSkipped: false,\n      stored: false,\n      sourceSetHash: ""\n    }\n  };\n  const rememberRateLimits = (result) => {',
  "optimization state"
);

codex = replaceOnce(
  codex,
  '      grossAgents: { ...agentGrossTokenTotals },\n      adaptiveReasoning: effectiveOptions.adaptiveReasoning || null,\n      ...savings',
  '      grossAgents: { ...agentGrossTokenTotals },\n      adaptiveReasoning: effectiveOptions.adaptiveReasoning || null,\n      researchOptimization: {\n        preflight: { ...researchOptimization.preflight },\n        artifactCache: { ...researchOptimization.artifactCache }\n      },\n      ...savings',
  "snapshot diagnostics"
);

codex = replaceOnce(
  codex,
  '  const researchPreflight = deterministicSearchPreflight(effectiveOptions);\n  if (',
  '  const researchPreflight = deterministicSearchPreflight(effectiveOptions);\n  researchOptimization.preflight.searchMode = String(researchPreflight.searchNeed || "");\n  researchOptimization.preflight.reason = Array.isArray(researchPreflight.reasons)\n    ? researchPreflight.reasons.join(",")\n    : "";\n  if (',
  "preflight diagnostics"
);

codex = replaceOnce(
  codex,
  '    const preflightRequest = buildPreflightResearchRequest(effectiveOptions, researchPreflight);\n',
  '    researchOptimization.preflight.applied = true;\n    researchOptimization.preflight.codexDecisionCallSkipped = true;\n    const preflightRequest = buildPreflightResearchRequest(effectiveOptions, researchPreflight);\n',
  "preflight skip metric"
);

const initialResearchBlock = `  let researchResult = await runCodexTask({\n    options: effectiveOptions,\n    prompt: buildResearchTitlePrompt(effectiveOptions),\n    promptFileName: "research-title-prompt.txt",\n    resultFileName: "research-title-result.json",\n    log,\n    agent: "research"\n  });`;
const initialResearchReplacement = `  const researchCacheClassification = () => deterministicSearchPreflight({\n    ...effectiveOptions,\n    searchResults: []\n  });\n  const readCurrentResearchCache = () => {\n    const cacheRead = readResearchArtifactCache({\n      options: effectiveOptions,\n      classification: researchCacheClassification()\n    });\n    researchOptimization.artifactCache.eligible = cacheRead.eligible === true;\n    researchOptimization.artifactCache.reason = String(cacheRead.reason || "unknown");\n    researchOptimization.artifactCache.sourceSetHash = String(cacheRead.sourceFingerprint?.hash || "");\n    return cacheRead;\n  };\n  const maybeStoreResearchCache = (result) => {\n    const cacheWrite = writeResearchArtifactCache({\n      options: effectiveOptions,\n      classification: researchCacheClassification(),\n      result\n    });\n    if (cacheWrite.written) {\n      researchOptimization.artifactCache.stored = true;\n      researchOptimization.artifactCache.eligible = true;\n      researchOptimization.artifactCache.reason = "stored";\n      researchOptimization.artifactCache.sourceSetHash = String(cacheWrite.sourceFingerprint?.hash || researchOptimization.artifactCache.sourceSetHash || "");\n    } else if (researchOptimization.artifactCache.reason === "not_checked") {\n      researchOptimization.artifactCache.eligible = cacheWrite.eligible === true;\n      researchOptimization.artifactCache.reason = String(cacheWrite.reason || "not_stored");\n      researchOptimization.artifactCache.sourceSetHash = String(cacheWrite.sourceFingerprint?.hash || "");\n    }\n    return cacheWrite;\n  };\n\n  const initialResearchCache = readCurrentResearchCache();\n  let researchResult;\n  if (initialResearchCache.hit) {\n    researchOptimization.artifactCache.hit = true;\n    researchOptimization.artifactCache.codexResearchCallSkipped = true;\n    researchOptimization.artifactCache.reason = "hit";\n    researchResult = {\n      ...initialResearchCache.artifact,\n      tokenUsage: { total: 0, grossTotal: 0 },\n      researchArtifactCache: { hit: true, storedAt: initialResearchCache.storedAt || "" }\n    };\n    log("토큰 최적화: 동일 Research 근거/문맥 캐시를 재사용해 Research Codex 호출을 생략합니다.", "info", "research");\n  } else {\n    researchResult = await runCodexTask({\n      options: effectiveOptions,\n      prompt: buildResearchTitlePrompt(effectiveOptions),\n      promptFileName: "research-title-prompt.txt",\n      resultFileName: "research-title-result.json",\n      log,\n      agent: "research"\n    });\n    maybeStoreResearchCache(researchResult);\n  }`;
codex = replaceOnce(codex, initialResearchBlock, initialResearchReplacement, "initial research cache");

const loopBefore = `    effectiveOptions = {\n      ...effectiveOptions,\n      searchResults: Array.isArray(searchPayload?.searchResults) ? searchPayload.searchResults : [],\n      sourceQuality: searchPayload?.sourceQuality || { status: "unknown" }\n    };\n    try {\n      researchResult = await runCodexTask({\n        options: effectiveOptions,\n        prompt: buildResearchTitlePrompt(effectiveOptions),\n        promptFileName: researchSearchRound === 1 ? "research-title-prompt.txt" : \`research-title-search-\${researchSearchRound}-prompt.txt\`,\n        resultFileName: "research-title-result.json",\n        log,\n        tokenOffset: totalTokens,\n        grossTokenOffset: totalGrossTokens,\n        agentTokenOffset: agentTokenTotals.research,\n        agent: "research"\n      });\n      if (researchSearchRound > 1) {\n        preserveAgentFile(\n          options.jobDir,\n          "research-title-result.json",\n          \`research-title-search-\${researchSearchRound}-result.json\`\n        );\n      }\n    } catch (error) {`;
const loopAfter = `    effectiveOptions = {\n      ...effectiveOptions,\n      searchResults: Array.isArray(searchPayload?.searchResults) ? searchPayload.searchResults : [],\n      sourceQuality: searchPayload?.sourceQuality || { status: "unknown" }\n    };\n    const loopResearchCache = readCurrentResearchCache();\n    if (loopResearchCache.hit) {\n      researchOptimization.artifactCache.hit = true;\n      researchOptimization.artifactCache.codexResearchCallSkipped = true;\n      researchOptimization.artifactCache.reason = "hit";\n      researchResult = {\n        ...loopResearchCache.artifact,\n        tokenUsage: { total: 0, grossTotal: 0 },\n        researchArtifactCache: { hit: true, storedAt: loopResearchCache.storedAt || "" }\n      };\n      log("토큰 최적화: 검색 후 동일 Research 근거/문맥 캐시를 재사용해 재분석 Codex 호출을 생략합니다.", "info", "research");\n    } else try {\n      researchResult = await runCodexTask({\n        options: effectiveOptions,\n        prompt: buildResearchTitlePrompt(effectiveOptions),\n        promptFileName: researchSearchRound === 1 ? "research-title-prompt.txt" : \`research-title-search-\${researchSearchRound}-prompt.txt\`,\n        resultFileName: "research-title-result.json",\n        log,\n        tokenOffset: totalTokens,\n        grossTokenOffset: totalGrossTokens,\n        agentTokenOffset: agentTokenTotals.research,\n        agent: "research"\n      });\n      maybeStoreResearchCache(researchResult);\n      if (researchSearchRound > 1) {\n        preserveAgentFile(\n          options.jobDir,\n          "research-title-result.json",\n          \`research-title-search-\${researchSearchRound}-result.json\`\n        );\n      }\n    } catch (error) {`;
codex = replaceOnce(codex, loopBefore, loopAfter, "research reanalysis cache");

fs.writeFileSync(codexPath, codex, "utf8");

let diagnostics = fs.readFileSync(diagnosticsPath, "utf8");
diagnostics = replaceOnce(
  diagnostics,
  'function buildJobTokenDiagnostics(tokenUsage = {}) {',
  `function normalizeResearchOptimization(value = {}) {\n  const source = value && typeof value === "object" ? value : {};\n  const preflight = source.preflight && typeof source.preflight === "object" ? source.preflight : {};\n  const artifactCache = source.artifactCache && typeof source.artifactCache === "object" ? source.artifactCache : {};\n  return {\n    preflight: {\n      applied: preflight.applied === true,\n      searchMode: String(preflight.searchMode || ""),\n      reason: String(preflight.reason || "").slice(0, 500),\n      codexDecisionCallSkipped: preflight.codexDecisionCallSkipped === true\n    },\n    artifactCache: {\n      eligible: artifactCache.eligible === true,\n      hit: artifactCache.hit === true,\n      reason: String(artifactCache.reason || "").slice(0, 200),\n      codexResearchCallSkipped: artifactCache.codexResearchCallSkipped === true,\n      stored: artifactCache.stored === true,\n      sourceSetHash: String(artifactCache.sourceSetHash || "").slice(0, 80)\n    }\n  };\n}\n\nfunction buildJobTokenDiagnostics(tokenUsage = {}) {`,
  "diagnostics normalizer"
);

diagnostics = replaceOnce(
  diagnostics,
  '    largestAgent,\n    hasAgentBreakdown: agentRows.length > 0\n',
  '    largestAgent,\n    hasAgentBreakdown: agentRows.length > 0,\n    researchOptimization: normalizeResearchOptimization(tokenUsage.researchOptimization)\n',
  "diagnostics output"
);

diagnostics = replaceOnce(
  diagnostics,
  '    token_gross_agents: normalizeAgentMap(diagnostics.grossAgents),\n    token_largest_agent: String(diagnostics.largestAgent?.agent || "")\n',
  '    token_gross_agents: normalizeAgentMap(diagnostics.grossAgents),\n    token_largest_agent: String(diagnostics.largestAgent?.agent || ""),\n    research_optimization: normalizeResearchOptimization(diagnostics.researchOptimization || tokenUsage.researchOptimization),\n    research_preflight_skipped_call: normalizeResearchOptimization(diagnostics.researchOptimization || tokenUsage.researchOptimization).preflight.codexDecisionCallSkipped,\n    research_cache_hit: normalizeResearchOptimization(diagnostics.researchOptimization || tokenUsage.researchOptimization).artifactCache.hit,\n    research_cache_skipped_call: normalizeResearchOptimization(diagnostics.researchOptimization || tokenUsage.researchOptimization).artifactCache.codexResearchCallSkipped\n',
  "history optimization fields"
);

diagnostics = replaceOnce(
  diagnostics,
  '  _private: { asTokenNumber, normalizeAgentMap, sumTokens, median }\n};',
  '  _private: { asTokenNumber, normalizeAgentMap, normalizeResearchOptimization, sumTokens, median }\n};',
  "private export"
);
fs.writeFileSync(diagnosticsPath, diagnostics, "utf8");

let main = fs.readFileSync(mainPath, "utf8");
main = replaceOnce(
  main,
  '    grossAgents: {},\n    diagnostics: buildJobTokenDiagnostics({}),\n    rateLimits: null\n',
  '    grossAgents: {},\n    researchOptimization: null,\n    diagnostics: buildJobTokenDiagnostics({}),\n    rateLimits: null\n',
  "job token initialization"
);

main = replaceOnce(
  main,
  '          jobTokenUsage.outputTokens = Number(usage.outputTokens || 0);\n          if (usage.rateLimits) {',
  '          jobTokenUsage.outputTokens = Number(usage.outputTokens || 0);\n          if (usage.researchOptimization && typeof usage.researchOptimization === "object") {\n            jobTokenUsage.researchOptimization = usage.researchOptimization;\n          }\n          if (usage.rateLimits) {',
  "live optimization usage"
);

main = replaceOnce(
  main,
  '    if (codexResult.tokenUsage?.grossAgents && typeof codexResult.tokenUsage.grossAgents === "object") {\n      jobTokenUsage.grossAgents = { ...codexResult.tokenUsage.grossAgents };\n    }\n    jobTokenUsage.diagnostics = buildJobTokenDiagnostics(jobTokenUsage);',
  '    if (codexResult.tokenUsage?.grossAgents && typeof codexResult.tokenUsage.grossAgents === "object") {\n      jobTokenUsage.grossAgents = { ...codexResult.tokenUsage.grossAgents };\n    }\n    if (codexResult.tokenUsage?.researchOptimization && typeof codexResult.tokenUsage.researchOptimization === "object") {\n      jobTokenUsage.researchOptimization = codexResult.tokenUsage.researchOptimization;\n    }\n    jobTokenUsage.diagnostics = buildJobTokenDiagnostics(jobTokenUsage);',
  "final optimization usage"
);
fs.writeFileSync(mainPath, main, "utf8");

console.log("V2 Research artifact cache patch applied");
