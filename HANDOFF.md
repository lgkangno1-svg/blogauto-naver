# Blogauto Naver V2 — Engineering Handoff

> **Living document.** This file must be updated in the same engineering iteration whenever `upgrade/best-of-v2` changes materially. It is the canonical handoff for another AI/developer joining the project.
>
> Last updated: 2026-08-26 (Asia/Seoul)
> Active branch: `upgrade/best-of-v2`
> Active PR: #1 — `Build best-of V2: Codex-first quality and token-efficient pipeline`
> Baseline observed at this update: `4298a3cbc9a2571f654da4f19cc875be36ec2223`

---

## 1. Development intent

The goal is to turn the existing Blogauto Naver/Tistory Electron application into a **reliable, token-efficient, evidence-aware publishing system** while preserving the proven runtime and automation model.

The upgrade is deliberately evolutionary rather than a rewrite. Existing behavior, saved settings, session reuse, Naver/Tistory publishing, and the Codex CLI agent stack should remain compatible wherever practical.

The core product principle is:

**Spend Codex reasoning only where semantic judgment is actually required; use deterministic code for everything that can be checked reliably without another model call.**

This project is not being migrated to OpenCode Go. All writing/research/review/image-agent work must continue to use the existing **Codex CLI** dependency unless the owner explicitly changes that requirement.

---

## 2. Final target

The V2 target is a Windows Electron publishing console that can repeatedly generate and publish useful Naver Blog content with:

- high factual and source quality;
- low avoidable Codex token use;
- deterministic preflight and quality gates before expensive review calls;
- compact evidence transfer instead of repeatedly passing source bodies;
- conservative Naver publish semantics that never blindly duplicate a post after an ambiguous click/result;
- recoverable browser/login/pending-draft sessions;
- durable diagnostics that explain where tokens were spent and why a policy decision was made;
- understandable Electron UX for status, warnings, publishing uncertainty, and token efficiency;
- modular code that can be changed without destabilizing the publishing path;
- regression tests and CI strong enough that repeated V2 patch application does not corrupt integrated code.

A successful V2 is not merely “more AI.” It should make **fewer unnecessary model calls**, retain or improve quality, and fail conservatively at irreversible boundaries.

---

## 3. Non-negotiable architectural constraints

1. **Codex CLI remains the agent runtime.**
   - Research/Title Agent
   - Writer Agent
   - Main Review Agent
   - Image Worker
   - Any targeted repair/review agent introduced later

2. **Do not require OpenCode Go or its API.**

3. **Keep persistent browser/session automation.** Existing Naver/Tistory session reuse is part of the product model.

4. **Do not trade reliability for token savings.** High-risk/current/financial/policy/application/recruitment/strict-evidence topics keep stronger reasoning and evidence paths.

5. **Never blindly retry an ambiguous publish commit boundary.** When the final publish click may have succeeded, verify independently or quarantine as uncertain.

6. **Prefer targeted patches over broad rewrites.** Preserve backward compatibility of settings/history/runtime data where practical.

7. **Every meaningful engineering iteration must update this `HANDOFF.md`.** The document and code should not drift apart.

---

## 4. Current application architecture

The repository is an Electron desktop application. The primary path is:

1. User/configuration selects account, category, keyword/topic, purpose, token mode and publishing options.
2. Research/Title flow determines topic/title and evidence/search requirements.
3. Search gathers source candidates where required.
4. Evidence is normalized/compressed into a compact ledger/handoff.
5. Writer Contract is either deterministically accepted or semantically refined by Main depending on risk/policy.
6. Writer produces the article, tags and image instructions.
7. Deterministic quality gates check local/factual/style constraints before spending Main-review tokens.
8. Targeted partial repair is attempted for repairable local failures.
9. Main Review is used when semantic review is still required.
10. Image Worker creates image output.
11. Naver browser automation writes and publishes the post.
12. Naver final-click ambiguity is independently verified; uncertain outcomes are quarantined rather than retried.
13. Optional Tistory publishing follows a successful Naver path.
14. Job/token diagnostics are persisted to history and surfaced in Electron.

Important existing files documented by the project README:

- `src/main.js` — Electron main process and orchestration
- `src/lib/codexRunner.js` — Codex Research/Writer/Main/Image execution and prompts
- `src/lib/search.js` — search/evidence/source-quality handling
- `src/lib/naverPublisher.js` — Naver browser automation
- `src/lib/tistoryPublisher.js` — Tistory browser automation
- `src/lib/accountStore.js` — account/category persistence
- `src/lib/settings.js` — settings defaults/normalization
- `src/renderer/` — Electron renderer UI
- `scripts/check.js` — original structural/regression checks

The V2 work has intentionally added smaller policy/diagnostic/cache modules rather than continuing to place every decision into the large orchestrators.

---

## 5. Engineering strategy

### 5.1 Deterministic first

Before paying for another Codex call, code should answer questions that can be answered deterministically:

- Is this title too similar to a recent title?
- Does the draft contain fabricated first-person experience patterns?
- Are there unsupported numeric claims?
- Is a high-stakes claim missing authority evidence?
- Are there known AI stock phrases or repetitive endings?
- Is length clearly anomalous?
- Is search obviously required from topic/risk/freshness metadata?
- Has an irreversible publish action possibly already succeeded?

### 5.2 Compress semantic context

Do not repeatedly resend full search pages or duplicate contracts. Prefer:

- Evidence Ledger
- source IDs and compact source metadata
- bounded excerpts/facts
- global evidence budgets
- URL deduplication
- authority ordering
- content-hash reuse when safe

### 5.3 Conservative irreversible operations

The publish click is a commit boundary. Timeout/no selector after the click is **not equivalent to failure**. The safe sequence is:

`click -> normal completion detection -> independent verification -> success OR publish_uncertain quarantine`

Never convert ambiguity directly into automatic republish.

### 5.4 Measure before tuning

Token policy should be based on durable successful-job history rather than intuition. Diagnostics should explain:

- effective tokens;
- gross tokens;
- cached/saved tokens;
- savings percentage;
- per-agent shares;
- largest token consumer;
- adaptive-policy decision and reason.

---

## 6. Completed V2 work

The following capabilities have been integrated into `upgrade/best-of-v2` as of the baseline above.

### Quality and deterministic gates

- Deterministic pre-review quality gate for fabricated experience, unsupported numeric claims, high-stakes authority evidence, duplicate titles, AI-like stock phrases, repetitive endings and length anomalies.
- Deterministic failures are routed back to Writer before paying for Main review.
- Targeted partial Writer repair for local failures before a full rewrite.
- Partial repair uses compact evidence and low/medium reasoning and preserves stable title/tags/structure where possible.

### Token efficiency

- `economy`, `balanced`, and `quality` token modes.
- Cached-token/gross/effective token accounting.
- Per-Agent token diagnostics.
- Durable diagnostics in `blog_history.jsonl`.
- Rolling token baseline and spike warning support in Electron.
- Adaptive reasoning based on real successful same-blog history.
- Explicit `xhigh` is treated as an operator override and is not lowered.
- Routine stable balanced work may lower **Writer only** to `low` after enough evidence; Research/Main are not history-downgraded.
- Routine stable manual Writer Contract refinement can skip an otherwise redundant Main semantic-refinement call.
- Deterministic Research preflight skips the redundant first “do I need search?” Codex call when search is already obviously necessary.

### Evidence and search

- Evidence Ledger and compact Research handoff.
- Writer Contract duplication removed from Research handoff where redundant.
- Bounded source/fact context rather than leaking large excerpts.
- Authority-oriented ordering: official/institutional/independent sources before weaker web evidence.
- URL deduplication.
- Global evidence budget.
- Freshness-aware persistent source-body cache with current policy:
  - high: 1 hour
  - medium: 6 hours
  - auto: 12 hours
  - low: 72 hours
- Cache corruption/staleness falls back to live extraction.

### Duplicate prevention

- Early lexical duplicate-title gate before Writer/Main/Image work.
- Zero-token semantic title/material novelty check for cases where words differ but the subject is effectively duplicated.
- Duplicate detection exits early so downstream Codex calls and image work are not wasted.

### Publishing safety and recovery

- Conservative Naver publish commit-boundary handling.
- Ambiguous post-click outcomes are independently verified against blog/post-list state.
- Verified outcome is converted to success.
- Unverifiable ambiguity becomes `publish_uncertain`.
- `publish_uncertain` is not blindly auto-retried.
- Pending-draft resume respects the same quarantine semantics.
- Existing persistent Naver/Tistory session model is preserved.

### Electron diagnostics / UX

- Per-job/per-Agent token efficiency data reaches renderer instead of being lost at IPC boundaries.
- Effective/gross/saved token values and savings rates are available in UI diagnostics.
- Largest Agent consumer is identified.
- Recent-history baseline supports token-spike warnings.
- Publish uncertainty is represented as a distinct operator-attention state rather than a generic failure.

### CI / upgrade maintainability

- V2 migration/integration patches were hardened for rerun/idempotency where later patches changed object shapes/imports/gates.
- Regression checks are split by feature so policy failures are easier to identify.
- Original `npm run check` remains part of verification.
- Existing Codex error mappings such as usage-limit/exec-failure behavior have been preserved while new states were introduced.

---

## 7. Adaptive reasoning safety policy

Current safety requirements for history-driven reasoning reduction:

- Apply only after Research/search/source-quality resolution.
- Require at least 8 successful token-instrumented jobs for the same blog.
- Use only successful/generated/published/verified history rows.
- Never lower `quality` mode.
- Never lower an explicit `xhigh` operator override.
- Exclude auto-topic, high-freshness/current, policy, financial, application/recruitment, price, strict/authority/independent-evidence contexts.
- In balanced mode, only Writer may be lowered by history and only when Writer is a persistent >=55% Agent-token bottleneck.
- Research and Main remain at the balanced baseline.
- Economy relies on its static low-reasoning policy rather than claiming artificial history savings.
- Persist/audit the adaptive decision and reason in diagnostics.

When changing these thresholds, require evidence from real history rather than only synthetic assumptions.

---

## 8. Current verification status

At the observed baseline, PR #1 is open and mergeable.

The latest integrated V2 verification described by the PR includes:

- every migration patch independently;
- deterministic Research preflight behavior;
- evergreen false-positive coverage (`방법` must not be mistaken for a legal/high-stakes topic merely because it contains `법`);
- adaptive Writer Contract policy regression checks;
- lexical + semantic title novelty checks;
- Evidence Ledger authority ordering, URL dedupe and global budget checks;
- source cache TTL/read/write/prune checks;
- per-job/per-agent and durable token diagnostics checks;
- adaptive reasoning safety and xhigh-preservation checks;
- syntax checks for integrated Codex/search/cache/main/renderer code;
- original `npm run check`;
- generated integration commit back to `upgrade/best-of-v2`.

**Important:** Future agents must inspect the *current* GitHub branch and latest CI/workflow results before starting. Do not assume this section is still current simply because it is in the handoff.

---

## 9. Remaining work — prioritized roadmap

### P0 / highest-value next

#### A. Content-hash cache for compact Evidence Ledger / Research handoff

Goal: when nearly identical source content is reused for a related article, avoid paying Research Codex to summarize the same evidence again.

Requirements:

- key by normalized source-content hash, not only URL;
- include schema/prompt-policy version in the cache key so stale formats do not leak forward;
- respect freshness/risk TTL and invalidate when underlying source text changes;
- never reuse a handoff across incompatible high-risk/evidence modes;
- cache only compact derived evidence, not unbounded raw model output;
- add deterministic cache-hit/miss tests;
- expose hit/saved-call metrics to diagnostics.

This is currently the strongest remaining direct token-efficiency opportunity.

#### B. Persist Research-preflight saved-call metrics

The deterministic preflight saves a Codex call, but diagnostics should record actual skip events so savings can be measured over real usage instead of estimated.

Suggested fields:

- `researchPreflight.applied`
- `researchPreflight.searchMode`
- `researchPreflight.reason`
- `researchPreflight.codexDecisionCallSkipped`

Avoid fabricating token savings when no reliable historical baseline exists.

### P1 / reliability and maintainability

#### C. Modularize orchestration without behavior change

`src/main.js`, `src/lib/codexRunner.js`, and publisher code are high-risk growth points. Extract narrowly scoped modules only when tests can protect behavior.

Preferred boundaries include:

- generation pipeline orchestration;
- publish state machine / commit-boundary verification;
- pending draft recovery;
- diagnostics persistence;
- evidence/research cache policy;
- Agent invocation wrappers.

Do not perform a large stylistic rewrite.

#### D. Stronger behavioral tests

Add behavioral tests around:

- publish timeout after successful final click;
- independent verification success/failure/unknown branches;
- no automatic retry from `publish_uncertain`;
- pending-draft resume quarantine;
- browser/session recovery after stale profile/session state;
- cache schema/version invalidation;
- backward-compatible history/settings parsing.

#### E. Windows/Electron smoke coverage

CI syntax/regression tests are useful but do not fully emulate real Windows Electron + browser behavior. Add the lightest practical smoke coverage without requiring credentials or live publishing.

### P2 / UX and data-driven tuning

#### F. Diagnostics UX refinement

Turn diagnostics from raw numbers into operator decisions:

- show why adaptive reasoning changed or did not change;
- show Research-preflight skip events;
- show Evidence/Research cache hits;
- clearly separate actual measured savings from estimates;
- provide concise tooltips rather than overwhelming the publishing screen.

#### G. Semantic duplicate/material memory refinement

Continue reducing repeat subject matter while guarding against false positives. Prefer deterministic/local zero-token methods where practical before adding any extra model call.

---

## 10. Session recovery requirements

Session recovery is a first-class reliability concern because login/session failure can occur independently of content generation.

Principles:

- Preserve persistent browser profiles where valid.
- Detect invalid/stale sessions before expensive generation/publish steps when practical.
- Keep manual security/challenge recovery available rather than attempting brittle bypasses.
- Do not destroy a potentially recoverable pending draft because login verification failed.
- A recovered session must resume from the safest reversible point.
- If the final publish commit may already have happened, session recovery must not turn that ambiguity into a republish.

Future session changes should be tested together with pending-draft and `publish_uncertain` semantics.

---

## 11. Publish state invariants

These are safety invariants, not UX preferences:

1. Before final publish click, retry may be possible if the operation is known reversible/idempotent.
2. After final publish click, timeout is ambiguous until independently verified.
3. Independent verification finding the title/post means success.
4. Independent verification proving absence may permit a controlled retry only if the implementation can establish absence confidently.
5. If success/absence cannot be established, use `publish_uncertain`.
6. `publish_uncertain` must require operator attention or explicit safe resolution; it must not feed an automatic republish loop.
7. Pending-draft resume must preserve this invariant.

Any change that weakens these rules should be treated as a regression even if it increases apparent automation success rate.

---

## 12. Evidence invariants

- Official/authority evidence is preferred for claims where user action, money, eligibility, policy, law, application or current status can be affected.
- Independent editorial evidence can complement official sources, especially for technology/news subjects.
- Low-confidence web/blog sources may help discover a topic but should not silently become authority evidence.
- Writer/Main should receive compact facts and source references, not duplicate full crawled bodies.
- Unsupported numeric claims and fabricated experience claims should fail deterministically where possible.
- Cache reuse must never hide freshness changes in time-sensitive claims.

---

## 13. Token-efficiency invariants

- A saved Codex call is valuable only if quality/reliability is not reduced materially.
- Avoid model calls whose answer can be established by deterministic policy.
- Repair only the failing region before requesting a full rewrite.
- Do not send the same Writer Contract/evidence/source body multiple times in one pipeline unless semantically necessary.
- Prefer compact Evidence Ledger over raw source bodies.
- Do not lower high-risk reasoning based only on token pressure.
- Operator-selected `xhigh` remains authoritative.
- Use real job diagnostics to justify future threshold changes.

---

## 14. Backward compatibility expectations

When practical, new versions must continue to read existing:

- user settings;
- account/category data;
- browser profile/session data;
- pending draft data;
- `blog_history.jsonl` rows that predate newer diagnostics fields.

New optional fields should default safely when absent. Avoid migrations that require the user to recreate accounts, browser sessions or historical data without a strong reason.

---

## 15. Workflow for every future engineering loop

Every AI/developer iteration should follow this sequence:

1. Fetch the current `upgrade/best-of-v2` HEAD from GitHub.
2. Inspect the latest PR/CI/workflow results.
3. Read this `HANDOFF.md` and relevant current source files.
4. Check for changes made by another AI/developer since the previous iteration.
5. Identify the highest-value remaining improvement or regression.
6. Make the smallest coherent implementation.
7. Add/update deterministic regression coverage.
8. Run or inspect all practical V2 tests plus original `npm run check`.
9. Fix regressions before considering the iteration complete.
10. Update this `HANDOFF.md` with:
    - what changed;
    - why it changed;
    - tests/CI result;
    - new risks/decisions;
    - revised next priority;
    - current head/commit when known.
11. Commit and push to the existing `upgrade/best-of-v2` branch.
12. Continue PR #1 instead of opening a duplicate PR.
13. Verify the remote branch/PR reflects the pushed change.

Do not report “complete” merely because a local patch or CI artifact exists. Remote branch state must be checked.

---

## 16. Known risk areas / regression watchlist

### Re-running V2 patch scripts

Previous iterations found that patch scripts could fail or duplicate imports/gates when run against already-upgraded code. Continue treating **idempotency/rerun safety** as a regression requirement.

### Error-state mappings

Existing Codex error mappings must remain compatible. Adding a new state must not accidentally change established usage-limit or execution-failure handling.

### Regex policy false positives

High-risk topic detection previously had a false-positive class where `법률?` could cause ordinary text such as `방법` to look legal/high-risk. Prefer explicit terms and add regression examples when modifying keyword policy.

### Adaptive optimization overreach

Do not generalize a token-saving policy from a tiny sample. The current minimum-history and risk exclusions are intentionally conservative.

### UI/IPC shape drift

Diagnostics have historically been calculated in backend code but lost before renderer display. When extending diagnostics, verify the complete path: producer -> main -> IPC -> renderer -> history.

### Publish ambiguity

This is the highest-severity operational regression area because duplicate Naver posts are user-visible and irreversible enough to require conservative semantics.

---

## 17. Test/CI checklist

Before a V2 iteration is considered healthy, verify as many of the following as are available in the current repository/workflow:

- JavaScript syntax checks for modified modules;
- feature-specific V2 regression tests;
- deterministic quality-gate checks;
- evidence compression/ordering/budget tests when affected;
- duplicate-title/material tests when affected;
- source/cache TTL and invalidation tests when affected;
- token diagnostics/adaptive-policy tests when affected;
- publish safety/pending-draft recovery tests when affected;
- original `npm run check`;
- workflow-generated integration commit behavior, if that workflow is used;
- remote branch HEAD and PR mergeability/status after push.

If a test cannot be run because of environment/credential/Actions limitations, record that limitation in this document instead of silently treating it as passed.

---

## 18. Operational data / security notes

Runtime account credentials, browser profiles, sessions, generated images, logs and local settings are not intended for source control. Follow the existing `.gitignore` and README policy. Do not commit passwords, cookies, profile directories, `.env` files, or user account assets.

Live Naver/Tistory end-to-end publishing tests should be treated carefully because they have external side effects. Prefer deterministic/simulated tests for commit-boundary logic and use live publishing only when explicitly appropriate.

---

## 19. Decision log

### 2026-08-26 — Living handoff introduced

Decision: create `HANDOFF.md` at repository root and make it mandatory to update during every meaningful V2 engineering iteration.

Reason: development is iterative and may be continued by multiple AIs/developers. PR text alone is not a sufficient durable source of architecture, intent, safety invariants, progress, known regressions and next priorities.

### Existing V2 design decisions carried forward

- Keep Codex CLI, do not switch to OpenCode Go.
- Deterministic gates before semantic/model review where possible.
- Evidence Ledger/compression rather than raw repeated source context.
- Targeted repair before full rewrite.
- Conservative publish ambiguity handling with `publish_uncertain`.
- History-driven adaptive Writer reasoning only under conservative safety rules.
- Zero-token/early duplicate prevention before expensive downstream Agents.
- Freshness-aware source caching.

---

## 20. Next engineer starting point

At the time this handoff was created, the recommended next implementation is:

**Safe content-hash caching of compact Evidence Ledger / Research handoff output, with cache schema/versioning, risk/freshness invalidation, deterministic tests, and measured cache-hit diagnostics.**

Before implementing it, re-check GitHub because another AI/developer may have changed the branch after this document was written.
