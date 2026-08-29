const fs = require("node:fs");
const path = require("node:path");

const target = path.join(__dirname, "..", "src", "lib", "codexRunner.js");
let source = fs.readFileSync(target, "utf8");
let changed = false;

const importAnchor = 'const { evaluateTitleNovelty } = require("./titleNovelty");';
const importLine = 'const { shouldRefineWriterContract } = require("./contractPolicy");';
if (!source.includes('require("./contractPolicy")')) {
  if (!source.includes(importAnchor)) throw new Error("titleNovelty import anchor not found");
  source = source.replace(importAnchor, `${importAnchor}\n${importLine}`);
  changed = true;
}

const callAnchor = '  const initialContractRefinement = await refineWriterContract();';
const marker = 'const contractRefinementPolicy = shouldRefineWriterContract({';
if (!source.includes(marker)) {
  if (!source.includes(callAnchor)) throw new Error("initial Writer Contract refinement anchor not found");
  const block = [
    '  const contractRefinementPolicy = shouldRefineWriterContract({',
    '    topic: effectiveOptions.topic,',
    '    finalTitle,',
    '    topicMode: effectiveOptions.topicMode,',
    '    tokenMode: effectiveOptions.tokenMode,',
    '    researchResult,',
    '    sourceQuality: effectiveOptions.sourceQuality',
    '  });',
    '  let initialContractRefinement = { ok: true, skipped: true, policy: contractRefinementPolicy };',
    '  if (contractRefinementPolicy.refine) {',
    '    log(',
    '      `Main Agent Writer Contract 정밀 검수 유지: ${contractRefinementPolicy.reasons.join(", ")}`,',
    '      "info",',
    '      "main"',
    '    );',
    '    initialContractRefinement = await refineWriterContract();',
    '  } else {',
    '    const draftWriterContract = buildWriterContract(researchResult, {',
    '      topic: finalTitle || effectiveOptions.topic,',
    '      finalTitle,',
    '      preferredTone: effectiveOptions.preferredTone || ""',
    '    });',
    '    researchResult = {',
    '      ...researchResult,',
    '      writerContract: draftWriterContract,',
    '      writerContractRefined: false,',
    '      writerContractPolicy: contractRefinementPolicy,',
    '      notes: compactTextList([',
    '        researchResult.notes,',
    '        "토큰 최적화: 안정적인 일반 글이라 별도 Main Agent Writer Contract 호출을 생략했습니다."',
    '      ])',
    '    };',
    '    log(',
    '      "토큰 최적화: 안정적인 일반 글이라 Main Agent Writer Contract 호출을 생략합니다.",',
    '      "info",',
    '      "main"',
    '    );',
    '  }'
  ].join("\n");
  source = source.replace(callAnchor, block);
  changed = true;
}

if (changed) {
  fs.writeFileSync(target, source, "utf8");
  console.log("Applied V2 adaptive Writer Contract refinement policy");
} else {
  console.log("V2 adaptive Writer Contract refinement policy already applied");
}
