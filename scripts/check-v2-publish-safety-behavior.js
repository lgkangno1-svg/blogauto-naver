const assert = require("node:assert/strict");
const {
  titleVerificationNeedle,
  verifyPublishedTitle,
  publishOutcomeUncertainError,
  publishStatusFromError,
  shouldAutoRetryStatus
} = require("../src/lib/publishSafety");

function mockDocument(text = "", { throws = false } = {}) {
  return {
    locator(selector) {
      assert.equal(selector, "body");
      return {
        async innerText() {
          if (throws) throw new Error("body unavailable");
          return text;
        }
      };
    }
  };
}

function mockPage({ bodies = [], gotoFailures = [] } = {}) {
  let visit = -1;
  let currentUrl = "about:blank";
  return {
    isClosed: () => false,
    frames: () => visit >= 0 && Array.isArray(bodies[visit]?.frames) ? bodies[visit].frames : [],
    locator: (selector) => mockDocument(visit >= 0 ? bodies[visit]?.body || "" : "").locator(selector),
    async goto(url) {
      visit += 1;
      currentUrl = url;
      if (gotoFailures[visit]) throw new Error(gotoFailures[visit]);
    },
    async waitForTimeout() {},
    url: () => currentUrl
  };
}

(async () => {
  const missing = await verifyPublishedTitle({ page: null, blogId: "test", title: "제목" });
  assert.equal(missing.verified, false);
  assert.equal(missing.reason, "missing_verification_input");

  const title = "통신비 줄이기 전에 확인할 조건";
  const directPage = mockPage({ bodies: [{ body: `최근 글 목록 ${title} 본문` }] });
  const direct = await verifyPublishedTitle({ page: directPage, blogId: "blog id", title, timeoutMs: 10 });
  assert.equal(direct.verified, true);
  assert.equal(direct.reason, "title_verified");
  assert(direct.url.includes("blog%20id"));

  const framePage = mockPage({
    bodies: [
      { body: "첫 페이지에는 아직 없음", frames: [mockDocument("프레임에도 없음")] },
      { body: "두 번째 페이지", frames: [mockDocument(`iframe 목록 ${title}`)] }
    ]
  });
  const framed = await verifyPublishedTitle({ page: framePage, blogId: "test", title, timeoutMs: 10 });
  assert.equal(framed.verified, true);
  assert(framed.url.includes("PostList.naver"));

  const recoveryPage = mockPage({
    gotoFailures: ["temporary navigation failure", ""],
    bodies: [{ body: "" }, { body: title }]
  });
  const logs = [];
  const recovered = await verifyPublishedTitle({
    page: recoveryPage,
    blogId: "test",
    title,
    timeoutMs: 10,
    log: (...args) => logs.push(args)
  });
  assert.equal(recovered.verified, true);
  assert(logs.some((entry) => entry[1] === "warn"));

  const absentPage = mockPage({ bodies: [{ body: "다른 글" }, { body: "여전히 다른 글" }] });
  const absent = await verifyPublishedTitle({ page: absentPage, blogId: "test", title, timeoutMs: 10 });
  assert.equal(absent.verified, false);
  assert.equal(absent.reason, "title_not_confirmed");

  const uncertain = publishOutcomeUncertainError(new Error("post-click timeout"), {
    blogId: "test",
    title,
    verificationReason: absent.reason
  });
  assert.equal(uncertain.code, "NAVER_PUBLISH_UNCERTAIN");
  assert.equal(uncertain.failurePhase, "publish_verify");
  assert.equal(uncertain.commitBoundaryCrossed, true);
  assert.equal(publishStatusFromError(uncertain), "publish_uncertain");
  assert.equal(shouldAutoRetryStatus("publish_uncertain"), false);
  assert.equal(shouldAutoRetryStatus("session_expired"), false);
  assert.equal(shouldAutoRetryStatus("failed"), true);

  const needle = titleVerificationNeedle("  통신비, 줄이기 전에! 확인할 조건  ");
  assert(needle.startsWith("통신비줄이기전에확인할조건"));

  console.log("V2 publish safety behavioral checks passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
