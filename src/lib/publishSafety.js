function normalizeComparableText(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .replace(/[\p{P}\p{S}]/gu, "")
    .toLowerCase();
}

function titleVerificationNeedle(title, maxChars = 28) {
  return normalizeComparableText(title).slice(0, Math.max(12, Number(maxChars) || 28));
}

function publishOutcomeUncertainError(cause, detail = {}) {
  const originalMessage = String(cause?.message || cause || "최종 발행 결과를 확인하지 못했습니다.").trim();
  const error = new Error(
    `Naver 최종 발행 버튼은 실행됐지만 게시 성공 여부를 확정하지 못했습니다. 자동 재발행을 중단합니다. ${originalMessage}`
  );
  error.code = "NAVER_PUBLISH_UNCERTAIN";
  error.failurePhase = "publish_verify";
  error.commitBoundaryCrossed = true;
  error.originalMessage = originalMessage;
  error.publishDetail = detail;
  return error;
}

function publishStatusFromError(error) {
  if (error?.code === "NAVER_PUBLISH_UNCERTAIN") return "publish_uncertain";
  if (error?.code === "SESSION_EXPIRED") return "session_expired";
  if (error?.code === "CODEX_USAGE_LIMIT") return "codex_usage_limit";
  if (error?.code === "CODEX_EXEC_FAILED") return "codex_exec_failed";
  return "failed";
}

function shouldAutoRetryStatus(status) {
  return ![
    "success",
    "generated",
    "publish_uncertain",
    "codex_usage_limit",
    "codex_exec_failed",
    "session_expired"
  ].includes(String(status || "").toLowerCase());
}

async function bodyContainsTitle(page, needle) {
  if (!needle || !page || page.isClosed?.()) return false;
  const frames = typeof page.frames === "function" ? page.frames() : [];
  const targets = [page, ...frames].filter(Boolean);
  for (const target of targets) {
    try {
      const locator = target.locator("body");
      const text = await locator.innerText({ timeout: 4500 });
      if (normalizeComparableText(text).includes(needle)) return true;
    } catch {
      // Try the next frame/document.
    }
  }
  return false;
}

async function verifyPublishedTitle({ page, blogId, title, log = () => {}, timeoutMs = 30000 } = {}) {
  const needle = titleVerificationNeedle(title);
  const cleanBlogId = String(blogId || "").trim();
  if (!page || !cleanBlogId || !needle) {
    return { verified: false, reason: "missing_verification_input", url: "" };
  }

  const candidates = [
    `https://blog.naver.com/${encodeURIComponent(cleanBlogId)}`,
    `https://blog.naver.com/PostList.naver?blogId=${encodeURIComponent(cleanBlogId)}&categoryNo=0&from=postList`
  ];

  for (const url of candidates) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
      await page.waitForTimeout?.(1800);
      if (await bodyContainsTitle(page, needle)) {
        log(`발행 완료 신호는 불명확했지만 블로그 목록에서 제목을 독립 확인했습니다: ${title}`);
        return { verified: true, reason: "title_verified", url: page.url?.() || url };
      }
    } catch (error) {
      log(`발행 후 제목 독립 검증 실패(${url}): ${String(error?.message || error).slice(0, 180)}`, "warn");
    }
  }

  return { verified: false, reason: "title_not_confirmed", url: page.url?.() || "" };
}

module.exports = {
  normalizeComparableText,
  titleVerificationNeedle,
  publishOutcomeUncertainError,
  publishStatusFromError,
  shouldAutoRetryStatus,
  verifyPublishedTitle
};
