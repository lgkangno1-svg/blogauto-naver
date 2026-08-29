const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function patchFile(relativePath, patches) {
  const filePath = path.join(root, relativePath);
  let source = fs.readFileSync(filePath, "utf8");
  let changed = false;

  for (const patch of patches) {
    if (source.includes(patch.to)) continue;
    if (!source.includes(patch.from)) {
      throw new Error(`Publish safety patch anchor not found: ${relativePath} :: ${patch.label}`);
    }
    source = source.replace(patch.from, patch.to);
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, source, "utf8");
    console.log(`Applied publish safety patch to ${relativePath}`);
  } else {
    console.log(`Publish safety patch already applied to ${relativePath}`);
  }
}

patchFile("src/lib/naverPublisher.js", [
  {
    label: "publish safety import",
    from: 'const path = require("node:path");\n',
    to: 'const path = require("node:path");\nconst { publishOutcomeUncertainError, verifyPublishedTitle } = require("./publishSafety");\n'
  },
  {
    label: "final publish commit boundary",
    from: `    const finalPublished = await clickFinalPublishButton(page, selectors, log, options);\n    if (!finalPublished) {\n      throw new Error("최종 발행 버튼을 찾을 수 없습니다. 발행 화면 DOM 확인이 필요합니다.");\n    }\n    await assertNaverSessionActive(page, selectors, log, "최종 발행");\n    await waitForPublishCompletion(page, selectors, log);`,
    to: `    const finalPublished = await clickFinalPublishButton(page, selectors, log, options);\n    if (!finalPublished) {\n      throw new Error("최종 발행 버튼을 찾을 수 없습니다. 발행 화면 DOM 확인이 필요합니다.");\n    }\n\n    // From this point the remote publish may already have committed. Never turn an\n    // ambiguous verification failure into a blind retry. Verify independently first.\n    try {\n      await assertNaverSessionActive(page, selectors, log, "최종 발행");\n      await waitForPublishCompletion(page, selectors, log);\n      return { status: "published", verification: "editor", url: page.url() };\n    } catch (error) {\n      const verification = await verifyPublishedTitle({\n        page,\n        blogId: resolveBlogId(options),\n        title: options.title,\n        log\n      });\n      if (verification.verified) {\n        return { status: "verified", verification: verification.reason, url: verification.url };\n      }\n      throw publishOutcomeUncertainError(error, {\n        blogId: resolveBlogId(options),\n        title: options.title,\n        lastUrl: page.url(),\n        verificationReason: verification.reason\n      });\n    }`
  }
]);

patchFile("src/main.js", [
  {
    label: "publish status helper import",
    from: 'const { publishToNaver, checkNaverSession, verifyOpenNaverSession } = require("./lib/naverPublisher");\n',
    to: 'const { publishToNaver, checkNaverSession, verifyOpenNaverSession } = require("./lib/naverPublisher");\nconst { publishStatusFromError } = require("./lib/publishSafety");\n'
  },
  {
    label: "resume publish uncertain status",
    from: `    } catch (error) {\n      if (error.code === "SESSION_EXPIRED" && account.id) {\n        updateAccountSession(runtimeRoot, account.id, "expired", settings);\n        emitAccountStore(runtimeRoot);\n      }\n      safeLog(jobId, error.message, "error");\n      updateStatus(jobId, error.code === "SESSION_EXPIRED" ? "session_expired" : "failed", error.message);\n      emit("job:complete", {\n        ...nonSensitiveJob,\n        status: error.code === "SESSION_EXPIRED" ? "session_expired" : "failed",`,
    to: `    } catch (error) {\n      const resumeFailedStatus = publishStatusFromError(error);\n      if (error.code === "SESSION_EXPIRED" && account.id) {\n        updateAccountSession(runtimeRoot, account.id, "expired", settings);\n        emitAccountStore(runtimeRoot);\n      }\n      if (resumeFailedStatus === "publish_uncertain") {\n        writeSettings(runtimeRoot, {\n          pendingNaverPublishDraft: {\n            ...pendingDraft,\n            status: "publish_uncertain",\n            uncertainAt: new Date().toISOString(),\n            uncertainReason: error.message\n          }\n        });\n        safeLog(jobId, "발행 결과가 불확실하여 보류 draft를 자동 재발행 대상에서 제외했습니다. 블로그 목록을 수동 확인해 주세요.", "warn");\n      }\n      safeLog(jobId, error.message, "error");\n      updateStatus(jobId, resumeFailedStatus, error.message);\n      emit("job:complete", {\n        ...nonSensitiveJob,\n        status: resumeFailedStatus,`
  },
  {
    label: "resume return uncertain status",
    from: `      return {\n        status: error.code === "SESSION_EXPIRED" ? "session_expired" : "failed",\n        reason: error.message,\n        resumedPendingPublish: true\n      };`,
    to: `      return {\n        status: resumeFailedStatus,\n        reason: error.message,\n        resumedPendingPublish: true\n      };`
  },
  {
    label: "general publish error classification",
    from: `    const failedStatus = error.code === "SESSION_EXPIRED"\n      ? "session_expired"\n      : error.code === "CODEX_USAGE_LIMIT" ? "codex_usage_limit"\n        : error.code === "CODEX_EXEC_FAILED" ? "codex_exec_failed"\n          : "failed";`,
    to: `    const failedStatus = error.code === "NAVER_PUBLISH_UNCERTAIN"\n      ? "publish_uncertain"\n      : error.code === "SESSION_EXPIRED"\n        ? "session_expired"\n        : error.code === "CODEX_USAGE_LIMIT" ? "codex_usage_limit"\n          : error.code === "CODEX_EXEC_FAILED" ? "codex_exec_failed"\n            : "failed";`
  }
]);

patchFile("src/renderer/app.js", [
  {
    label: "run state publish uncertain class",
    from: `    session_expired: "danger",\n    duplicate_retry: "warning",`,
    to: `    session_expired: "danger",\n    publish_uncertain: "warning",\n    duplicate_retry: "warning",`
  },
  {
    label: "run state publish uncertain label",
    from: `    session_expired: "세션만료",\n    duplicate_retry: "중복",`,
    to: `    session_expired: "세션만료",\n    publish_uncertain: "발행확인필요",\n    duplicate_retry: "중복",`
  },
  {
    label: "auto retry uncertain exclusion",
    from: `  return !["success", "generated", "codex_usage_limit", "codex_exec_failed", "session_expired"].includes(status);`,
    to: `  return !["success", "generated", "publish_uncertain", "codex_usage_limit", "codex_exec_failed", "session_expired"].includes(status);`
  },
  {
    label: "history badge publish uncertain class",
    from: `    session_expired: "danger",\n    duplicate_retry: "warning",\n    publishing: "info",`,
    to: `    session_expired: "danger",\n    publish_uncertain: "warning",\n    duplicate_retry: "warning",\n    publishing: "info",`
  },
  {
    label: "history badge publish uncertain label",
    from: `    session_expired: "세션만료",\n    duplicate_retry: "중복",\n    publishing: "발행",`,
    to: `    session_expired: "세션만료",\n    publish_uncertain: "확인필요",\n    duplicate_retry: "중복",\n    publishing: "발행",`
  }
]);
