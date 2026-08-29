const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const filePath = path.join(root, "src", "lib", "codexRunner.js");
let source = fs.readFileSync(filePath, "utf8");

const importLine = 'const { deterministicSearchPreflight, buildPreflightResearchRequest } = require("./researchPreflight");';
if (!source.includes(importLine)) {
  const anchor = 'const { chooseAdaptiveAgentModels } = require("./adaptiveReasoning");';
  if (!source.includes(anchor)) throw new Error("research preflight import anchor not found");
  source = source.replace(anchor, `${anchor}\n${importLine}`);
}

if (!source.includes("const researchPreflight = deterministicSearchPreflight(effectiveOptions);")) {
  const researchAnchor = "  let researchResult = await runCodexTask({\n";
  if (!source.includes(researchAnchor)) throw new Error("initial Research Agent anchor not found");

  const preflightBlock = `  let researchSearchRound = 0;\n  const researchPreflight = deterministicSearchPreflight(effectiveOptions);\n  if (\n    researchPreflight.shouldSearchFirst\n    && effectiveOptions.searchResults.length === 0\n    && typeof options.onSearchNeeded === \"function\"\n  ) {\n    log(\n      \`토큰 최적화: 첫 Research 검색판정 호출을 생략하고 자료를 먼저 수집합니다. (\${researchPreflight.searchNeed}: \${researchPreflight.reasons.join(\", \")})\`,\n      \"info\",\n      \"research\"\n    );\n    const preflightRequest = buildPreflightResearchRequest(effectiveOptions, researchPreflight);\n    const searchPayload = await options.onSearchNeeded(preflightRequest, {\n      round: 1,\n      previousSearchResults: effectiveOptions.searchResults,\n      sourceQuality: effectiveOptions.sourceQuality,\n      deterministicPreflight: true\n    });\n    effectiveOptions = {\n      ...effectiveOptions,\n      searchResults: Array.isArray(searchPayload?.searchResults) ? searchPayload.searchResults : [],\n      sourceQuality: searchPayload?.sourceQuality || { status: \"unknown\" },\n      researchSearchPreflight: researchPreflight\n    };\n    researchSearchRound = 1;\n  }\n\n`;
  source = source.replace(researchAnchor, `${preflightBlock}${researchAnchor}`);

  const duplicateDeclaration = "  const maxResearchSearchRounds = 2;\n  let researchSearchRound = 0;\n  while (\n";
  if (!source.includes(duplicateDeclaration)) {
    throw new Error("researchSearchRound declaration anchor not found");
  }
  source = source.replace(
    duplicateDeclaration,
    "  const maxResearchSearchRounds = 2;\n  while (\n"
  );
}

fs.writeFileSync(filePath, source, "utf8");
console.log("V2 deterministic Research preflight integrated");
