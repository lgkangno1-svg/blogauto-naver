const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const CACHE_VERSION = 1;
const DEFAULT_MAX_ENTRIES = 500;
const TTL_BY_FRESHNESS = {
  high: 60 * 60 * 1000,
  medium: 6 * 60 * 60 * 1000,
  auto: 12 * 60 * 60 * 1000,
  low: 72 * 60 * 60 * 1000
};

function normalizeFreshness(value) {
  const normalized = String(value || "auto").trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(TTL_BY_FRESHNESS, normalized) ? normalized : "auto";
}

function ttlForFreshness(value) {
  return TTL_BY_FRESHNESS[normalizeFreshness(value)];
}

function normalizeUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    url.hash = "";
    return url.toString();
  } catch {
    return raw.replace(/#.*$/, "");
  }
}

function cacheDir(runtimeRoot) {
  return path.join(String(runtimeRoot || ""), "cache", "source-content");
}

function cacheKey(url) {
  return crypto.createHash("sha256").update(normalizeUrl(url)).digest("hex");
}

function cachePath(runtimeRoot, url) {
  return path.join(cacheDir(runtimeRoot), `${cacheKey(url)}.json`);
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    return null;
  }
}

function readSourceCache({ runtimeRoot, url, freshnessLevel = "auto", nowMs = Date.now() } = {}) {
  if (!runtimeRoot || !normalizeUrl(url)) return { hit: false, reason: "disabled" };
  const filePath = cachePath(runtimeRoot, url);
  if (!fs.existsSync(filePath)) return { hit: false, reason: "missing" };
  const payload = readJson(filePath);
  if (!payload || payload.version !== CACHE_VERSION || normalizeUrl(payload.url) !== normalizeUrl(url)) {
    return { hit: false, reason: "invalid" };
  }
  const storedAtMs = Date.parse(String(payload.storedAt || ""));
  if (!Number.isFinite(storedAtMs)) return { hit: false, reason: "invalid_timestamp" };
  const ttlMs = ttlForFreshness(freshnessLevel);
  const ageMs = Math.max(0, Number(nowMs) - storedAtMs);
  if (ageMs > ttlMs) return { hit: false, reason: "expired", ageMs, ttlMs };
  const value = payload.value && typeof payload.value === "object" ? payload.value : null;
  if (!value || String(value.excerpt || "").trim().length < 80) {
    return { hit: false, reason: "empty" };
  }
  return { hit: true, value, ageMs, ttlMs, storedAt: payload.storedAt, filePath };
}

function writeSourceCache({ runtimeRoot, url, value, now = new Date() } = {}) {
  if (!runtimeRoot || !normalizeUrl(url) || !value || String(value.excerpt || "").trim().length < 80) return false;
  const dir = cacheDir(runtimeRoot);
  fs.mkdirSync(dir, { recursive: true });
  const filePath = cachePath(runtimeRoot, url);
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  const payload = {
    version: CACHE_VERSION,
    url: normalizeUrl(url),
    storedAt: now.toISOString(),
    value: {
      fetchedUrl: String(value.fetchedUrl || ""),
      contentLength: Number(value.contentLength || 0),
      excerpt: String(value.excerpt || ""),
      outboundLinks: Array.isArray(value.outboundLinks) ? value.outboundLinks.slice(0, 12) : []
    }
  };
  try {
    fs.writeFileSync(tempPath, `${JSON.stringify(payload)}\n`, "utf8");
    fs.renameSync(tempPath, filePath);
    return true;
  } catch {
    try { fs.rmSync(tempPath, { force: true }); } catch {}
    return false;
  }
}

function pruneSourceCache(runtimeRoot, { maxEntries = DEFAULT_MAX_ENTRIES, maxAgeMs = 14 * 24 * 60 * 60 * 1000, nowMs = Date.now() } = {}) {
  if (!runtimeRoot) return { removed: 0, remaining: 0 };
  const dir = cacheDir(runtimeRoot);
  if (!fs.existsSync(dir)) return { removed: 0, remaining: 0 };
  const files = [];
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith(".json")) continue;
    const filePath = path.join(dir, name);
    try {
      const stat = fs.statSync(filePath);
      files.push({ filePath, mtimeMs: stat.mtimeMs });
    } catch {}
  }
  files.sort((a, b) => b.mtimeMs - a.mtimeMs);
  let removed = 0;
  files.forEach((item, index) => {
    if (index < maxEntries && nowMs - item.mtimeMs <= maxAgeMs) return;
    try {
      fs.rmSync(item.filePath, { force: true });
      removed += 1;
    } catch {}
  });
  return { removed, remaining: Math.max(0, files.length - removed) };
}

module.exports = {
  TTL_BY_FRESHNESS,
  ttlForFreshness,
  normalizeUrl,
  readSourceCache,
  writeSourceCache,
  pruneSourceCache,
  _private: { cacheDir, cacheKey, cachePath }
};
