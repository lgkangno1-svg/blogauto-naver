const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  ttlForFreshness,
  normalizeUrl,
  readSourceCache,
  writeSourceCache,
  pruneSourceCache
} = require("../src/lib/sourceCache");
const { buildEvidenceLedger } = require("../src/lib/evidenceLedger");

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "blogauto-source-cache-"));
try {
  assert(ttlForFreshness("high") < ttlForFreshness("auto"));
  assert(ttlForFreshness("auto") < ttlForFreshness("low"));

  assert.strictEqual(
    normalizeUrl("https://EXAMPLE.com:443/article/?b=2&utm_source=naver&a=1#section"),
    "https://example.com/article?a=1&b=2"
  );
  assert.strictEqual(
    normalizeUrl("https://example.com/article?a=1&b=2&fbclid=tracking"),
    "https://example.com/article?a=1&b=2"
  );

  const url = "https://example.com/article?x=1&utm_source=naver#section";
  const canonicalAlias = "https://EXAMPLE.com:443/article/?x=1&fbclid=tracking";
  const value = {
    fetchedUrl: "https://example.com/article?x=1",
    contentLength: 500,
    excerpt: "근거 본문 ".repeat(30),
    outboundLinks: [{ url: "https://gov.kr/example" }]
  };
  assert.strictEqual(writeSourceCache({ runtimeRoot: temp, url, value, now: new Date("2026-08-26T00:00:00Z") }), true);

  const fresh = readSourceCache({
    runtimeRoot: temp,
    url: canonicalAlias,
    freshnessLevel: "high",
    nowMs: Date.parse("2026-08-26T00:30:00Z")
  });
  assert.strictEqual(fresh.hit, true);
  assert(fresh.value.excerpt.includes("근거 본문"));

  const ledger = buildEvidenceLedger([
    {
      title: "공식 안내",
      url,
      excerpt: "신청 조건과 대상을 공식 안내합니다.",
      relevance: { officialSource: true, score: 10 }
    },
    {
      title: "공식 안내 검색복제",
      fetchedUrl: canonicalAlias,
      excerpt: "같은 공식 페이지가 추적 파라미터만 다르게 수집됐습니다.",
      relevance: { officialSource: true, score: 9 }
    }
  ], { topic: "신청 조건" });
  assert.strictEqual(ledger.candidateCount, 1);
  assert.strictEqual(ledger.sourceCount, 1);

  const stale = readSourceCache({
    runtimeRoot: temp,
    url,
    freshnessLevel: "high",
    nowMs: Date.parse("2026-08-26T02:00:01Z")
  });
  assert.strictEqual(stale.hit, false);
  assert.strictEqual(stale.reason, "expired");

  const longLived = readSourceCache({
    runtimeRoot: temp,
    url: canonicalAlias,
    freshnessLevel: "low",
    nowMs: Date.parse("2026-08-27T00:00:00Z")
  });
  assert.strictEqual(longLived.hit, true);

  const prune = pruneSourceCache(temp, { maxEntries: 0, nowMs: Date.parse("2026-08-27T00:00:00Z") });
  assert(prune.removed >= 1);
  console.log("V2 source cache checks passed");
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
