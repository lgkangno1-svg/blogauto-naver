const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const searchPath = path.join(root, "src", "lib", "search.js");
const mainPath = path.join(root, "src", "main.js");

function replaceOnce(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`source-cache patch anchor missing: ${label}`);
  return source.replace(before, after);
}

let search = fs.readFileSync(searchPath, "utf8");
search = replaceOnce(
  search,
  'const https = require("node:https");\n',
  'const https = require("node:https");\nconst { readSourceCache, writeSourceCache, pruneSourceCache } = require("./sourceCache");\n',
  "search import"
);

search = replaceOnce(
  search,
  'async function fetchCandidateContent(candidate) {\n  const attempts = [candidate.url];',
  'async function fetchCandidateContent(candidate, options = {}) {\n  const cached = readSourceCache({\n    runtimeRoot: options.runtimeRoot,\n    url: candidate.url,\n    freshnessLevel: options.freshnessLevel\n  });\n  if (cached.hit) {\n    return {\n      ...candidate,\n      ...cached.value,\n      cache: { hit: true, ageMs: cached.ageMs, ttlMs: cached.ttlMs }\n    };\n  }\n\n  const attempts = [candidate.url];',
  "fetch cache read"
);

search = replaceOnce(
  search,
  '        return {\n          ...candidate,\n          fetchedUrl: attemptUrl,\n          contentLength: text.length,\n          excerpt: text.slice(0, MAX_EXCERPT_CHARS),\n          outboundLinks: uniqueCandidates(outboundLinks).slice(0, MAX_AUTHORITY_LINK_CANDIDATES)\n        };',
  '        const result = {\n          ...candidate,\n          fetchedUrl: attemptUrl,\n          contentLength: text.length,\n          excerpt: text.slice(0, MAX_EXCERPT_CHARS),\n          outboundLinks: uniqueCandidates(outboundLinks).slice(0, MAX_AUTHORITY_LINK_CANDIDATES),\n          cache: { hit: false }\n        };\n        writeSourceCache({\n          runtimeRoot: options.runtimeRoot,\n          url: candidate.url,\n          value: result\n        });\n        return result;',
  "fetch cache write"
);

search = replaceOnce(
  search,
  '        const result = await fetchCandidateContent(candidate);',
  '        const result = await fetchCandidateContent(candidate, options);',
  "fetch options"
);

search = replaceOnce(
  search,
  '    const validEnriched = enriched.filter(Boolean);\n    const withContent = validEnriched.filter((item) => String(item.excerpt || "").trim().length >= 80);',
  '    const validEnriched = enriched.filter(Boolean);\n    const cacheHits = validEnriched.filter((item) => item?.cache?.hit === true).length;\n    if (cacheHits > 0) {\n      log(`본문 캐시 재사용: ${cacheHits}/${validEnriched.length}개`);\n    }\n    const withContent = validEnriched.filter((item) => String(item.excerpt || "").trim().length >= 80);',
  "cache hit log"
);

search = replaceOnce(
  search,
  'async function collectSearchResults(options, log = () => {}) {\n  const primary = String(options.primaryProvider || "naver").toLowerCase();',
  'async function collectSearchResults(options, log = () => {}) {\n  if (options.runtimeRoot) {\n    pruneSourceCache(options.runtimeRoot);\n  }\n  const primary = String(options.primaryProvider || "naver").toLowerCase();',
  "cache prune"
);

fs.writeFileSync(searchPath, search, "utf8");

let main = fs.readFileSync(mainPath, "utf8");
main = replaceOnce(
  main,
  '          const searchResults = await collectSearchResults({\n            topic: searchTopic,',
  '          const searchResults = await collectSearchResults({\n            runtimeRoot,\n            topic: searchTopic,',
  "main runtime root"
);
fs.writeFileSync(mainPath, main, "utf8");

console.log("V2 source cache patch applied");
