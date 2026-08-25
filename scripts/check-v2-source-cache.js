const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  ttlForFreshness,
  readSourceCache,
  writeSourceCache,
  pruneSourceCache
} = require("../src/lib/sourceCache");

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "blogauto-source-cache-"));
try {
  assert(ttlForFreshness("high") < ttlForFreshness("auto"));
  assert(ttlForFreshness("auto") < ttlForFreshness("low"));

  const url = "https://example.com/article?x=1#section";
  const value = {
    fetchedUrl: "https://example.com/article?x=1",
    contentLength: 500,
    excerpt: "근거 본문 ".repeat(30),
    outboundLinks: [{ url: "https://gov.kr/example" }]
  };
  assert.strictEqual(writeSourceCache({ runtimeRoot: temp, url, value, now: new Date("2026-08-26T00:00:00Z") }), true);

  const fresh = readSourceCache({
    runtimeRoot: temp,
    url,
    freshnessLevel: "high",
    nowMs: Date.parse("2026-08-26T00:30:00Z")
  });
  assert.strictEqual(fresh.hit, true);
  assert(fresh.value.excerpt.includes("근거 본문"));

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
    url,
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
