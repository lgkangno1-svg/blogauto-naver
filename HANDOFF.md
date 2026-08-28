# Blogauto Naver V2 — Engineering Handoff

> **Living document.** Update this file in the same engineering iteration whenever `upgrade/best-of-v2` changes materially. It is the canonical handoff for another AI/developer.
>
> Last updated: 2026-08-28 (Asia/Seoul)
> Active branch: `upgrade/best-of-v2`
> Active PR: #1 — `Build best-of V2: Codex-first quality and token-efficient pipeline`
> Current remote HEAD before this documentation commit: `6296daaebf1c6bbbf25d960064525d11b3cfc854`

---

## 1. Development intent

Upgrade the existing Electron Naver/Tistory blog automation app into a **reliable, token-efficient, evidence-aware publishing system** without rewriting the proven runtime model.

The core product rule is:

**Spend Codex reasoning only where semantic judgment is genuinely needed; use deterministic code for checks, compression, caching, recovery policy, and irreversible-operation safety whenever practical.**

The upgrade must remain evolutionary. Existing settings, account/category data, browser profiles, Naver/Tistory sessions, pending drafts, history rows, and the current automation model should remain compatible where practical.

### Non-negotiable runtime choice

- Research/Title Agent: Codex CLI
- Writer Agent: Codex CLI
- Main Review Agent: Codex CLI
- Image Worker / Image Style Agent: Codex CLI
- Targeted semantic repair: Codex CLI
- **Do not switch to OpenCode Go and do not require its API.**

---

## 2. Final target

The target is a Windows Electron publishing console that can repeatedly generate and publish useful Naver Blog content with:

- strong factual/source quality;
- low avoidable Codex token use;
- deterministic preflight and quality gates before expensive model calls;
- compact Evidence Ledger / Research handoff instead of repeated raw source bodies;
- safe reuse of previously fetched evidence;
- conservative Naver publish semantics that do not duplicate posts after ambiguous final-click outcomes;
- recoverable browser/login/pending-draft sessions;
- durable per-job/per-Agent diagnostics;
- clear Electron operator states and warnings;
- modular policy/cache/diagnostic code around the larger orchestrators;
- repeatable V2 regression checks plus the original project checks.

A successful V2 should use **fewer unnecessary model calls and fewer unnecessary prompt tokens** while retaining or improving quality and reliability.

---

## 3. Safety and compatibility invariants

1. Codex CLI remains the agent runtime.
2. High-risk/current/financial/policy/application/recruitment/strict-evidence work must not be downgraded merely to save tokens.
3. Explicit operator `xhigh` reasoning remains authoritative.
4. The final Naver publish click is a commit boundary. Ambiguity after it is not a normal retryable failure.
5. `publish_uncertain` must never feed a blind automatic republish loop.
6. Pending-draft recovery must preserve the same publish-safety invariant.
7. Existing settings/history/runtime data should remain readable when new optional fields are absent.
8. Prefer targeted patches and small modules over broad rewrites of `main.js`, `codexRunner.js`, or publisher files.
9. Every meaningful engineering iteration updates this `HANDOFF.md` and continues the same `upgrade/best-of-v2` branch / PR #1.

---

## 4. Current architecture

Primary application path:

1. Electron UI loads account/category/topic/purpose/token/publishing settings.
2. Research/Title logic determines subject/title and evidence/search requirements.
3. Deterministic Research preflight bypasses a redundant “do I need search?” Codex call when search is already obviously necessary.
4. Search gathers source candidates when required.
5. Persistent source-body cache can reuse previously extracted page content according to freshness TTL.
6. Evidence is ranked, deduplicated and compressed into an Evidence Ledger / compact Research handoff.
7. Writer Contract is deterministically accepted for routine stable work or semantically refined by Main when risk requires it.
8. Writer produces title/article/tags/image instructions.
9. Deterministic quality gates run before paying for Main review.
10. Targeted partial repair is attempted for local repairable failures before a full rewrite.
11. Main semantic review runs when still required.
12. Image Worker generates image output.
13. Naver browser automation writes and publishes the post.
14. Ambiguous post-click outcomes are independently verified; unresolved ambiguity becomes `publish_uncertain`.
15. Optional Tistory publishing follows the safe path.
16. Token/job diagnostics are persisted and surfaced in Electron.

Key files:

- `src/main.js` — Electron main process/orchestration
- `src/lib/codexRunner.js` — Codex agent execution/prompts
- `src/lib/search.js` — search/source enrichment
- `src/lib/evidenceLedger.js` — evidence ranking/compression/deduplication
- `src/lib/sourceCache.js` — persistent fetched-source cache and URL canonicalization
- `src/lib/qualityGate.js` — deterministic article checks
- `src/lib/partialRepair.js` — targeted Writer repair policy
- `src/lib/adaptiveReasoning.js` / `tokenPolicy.js` — token/reasoning policy
- `src/lib/publishSafety.js` — irreversible publish-state rules
- `src/lib/naverPublisher.js` — Naver browser automation
- `src/lib/history.js` / `jobDiagnostics.js` — durable usage diagnostics
- `src/renderer/` — Electron UI
- `scripts/check*.js` — original and V2 regression checks

---

## 5. Completed V2 capabilities

### Deterministic quality and repair

- Fabricated first-person experience detection.
- Unsupported numeric claim detection.
- High-stakes authority-evidence checks.
- Duplicate-title checks.
- AI stock-phrase and repetitive-ending checks.
- Length anomaly checks.
- Deterministic failures return to Writer before Main review when possible.
- Targeted partial repair runs before a full rewrite for local repairable failures.
- Partial repair keeps stable title/tags/structure where practical and uses compact evidence with lower reasoning.

### Token efficiency

- `economy` / `balanced` / `quality` modes.
- Gross/effective/cached token accounting.
- Per-Agent token diagnostics.
- Durable diagnostics in `blog_history.jsonl`.
- Rolling token baseline and token-spike warning support.
- History-driven adaptive Writer reasoning under conservative gates.
- `quality` is never history-downgraded.
- Explicit `xhigh` is never lowered.
- Routine stable manual Writer Contract refinement may skip one Main semantic-refinement call.
- Deterministic Research preflight skips a redundant Codex search-decision call when search is already clearly necessary.

### Evidence/search

- Compact Evidence Ledger.
- Compact Research handoff.
- Duplicate Writer Contract context removed from handoff where redundant.
- Authority-first source ordering.
- Global evidence character budget.
- URL deduplication.
- Persistent source-body cache with freshness-aware TTL:
  - high: 1 hour
  - medium: 6 hours
  - auto: 12 hours
  - low: 72 hours
- Cache corruption/staleness falls back to live extraction.

### 2026-08-28 source identity improvement

The source cache and Evidence Ledger now canonicalize equivalent URLs before identity/hash comparison.

Canonicalization currently:

- removes URL fragments;
- lowercases host names;
- removes default `:80` / `:443` ports;
- removes a conservative set of known tracking parameters including `utm_*`, `fbclid`, `gclid`, `dclid`, `msclkid`, `igshid`, Mailchimp IDs, Yandex click ID, `_ga`, and `_gl`;
- sorts remaining query parameters deterministically;
- removes non-root trailing slashes.

Why this matters: the same article previously could occupy separate cache entries or Evidence rows solely because it arrived through different campaign/search tracking URLs. That caused avoidable source extraction/cache misses and duplicate evidence prompt budget. Functional query parameters are preserved, so content-changing query URLs are not intentionally collapsed.

Regression coverage checks both:

- writing a source under one tracked URL and reading it back through a canonical-equivalent alias;
- deduplicating Evidence Ledger candidates whose URLs differ only by tracking/canonicalization noise.

### Duplicate-material prevention

- Early lexical duplicate-title gate before Writer/Main/Image work.
- Zero-token semantic/material novelty check for differently worded but substantially repeated subjects.
- Duplicate exit occurs before downstream Codex/image work.

### Publishing safety/recovery

- Conservative Naver publish commit-boundary handling.
- Independent verification after ambiguous final-click outcomes.
- Verified post -> success.
- unresolved ambiguity -> `publish_uncertain`.
- `publish_uncertain` is not auto-retried.
- Pending-draft resume preserves the quarantine.
- Existing persistent Naver/Tistory browser-session model remains intact.

### Electron diagnostics / UX

- Per-job/per-Agent token data survives backend -> main -> IPC -> renderer flow.
- Effective/gross/saved token values and savings percentages are available.
- Largest Agent consumer is identified.
- Recent-history baselines can flag token spikes.
- Publish uncertainty is a distinct operator-attention state rather than generic failure.

### CI / upgrade maintainability

- V2 integration patches have been hardened for rerun/idempotency where previous exact-shape anchors became brittle.
- Feature-specific regression scripts exist alongside the original `npm run check`.
- The same PR #1 remains the integration PR; do not create duplicates.

---

## 6. Adaptive reasoning safety policy

History-driven reasoning reduction currently follows these rules:

- apply only after Research/search/source-quality resolution;
- require at least 8 successful token-instrumented jobs for the same blog;
- use only successful/generated/published/verified history rows;
- never lower `quality` mode;
- never lower explicit `xhigh`;
- exclude auto-topic, high-freshness/current, policy, financial, application/recruitment, price, strict/authority/independent-evidence contexts;
- balanced history tuning may lower **Writer only**, only when Writer is a persistent >=55% token bottleneck;
- Research and Main remain at the balanced baseline;
- economy relies on its static low-reasoning policy rather than claiming synthetic history savings;
- adaptive decision/reason should remain auditable in diagnostics.

Do not change thresholds based on a tiny sample or intuition alone.

---

## 7. Publish state invariants

Safe sequence after final publish action:

`click -> normal completion detection -> independent verification -> success OR publish_uncertain quarantine`

Rules:

1. Before the final click, a known reversible/idempotent failure may be retryable.
2. After the final click, timeout/selector failure is ambiguous until independently verified.
3. Verification finding the post means success.
4. Controlled retry after final-click ambiguity is allowed only if absence can be established confidently by implementation logic.
5. If success/absence cannot be established, use `publish_uncertain`.
6. `publish_uncertain` requires operator attention/safe resolution and must not auto-republish.
7. Pending-draft/session recovery must preserve all of the above.

This is the highest-severity operational regression area.

---

## 8. Evidence and cache invariants

- Official/authority evidence is preferred for claims affecting money, eligibility, policy, law, applications, or current status.
- Independent editorial evidence may complement official sources.
- Low-confidence web/blog sources may help discovery but must not silently become authority evidence.
- Writer/Main should receive compact facts/source references, not repeated full crawled bodies.
- Unsupported numeric and fabricated experience claims should fail deterministically where possible.
- Freshness TTL must still control cache reuse for time-sensitive subjects.
- URL canonicalization must remove only transport/tracking noise; do not strip arbitrary functional query parameters.
- Future content-hash Research artifact reuse must include schema/policy version and risk/freshness compatibility in its key.

---

## 9. Current verification status

PR #1 remains open and mergeable after this iteration.

The code/test commit `e950655eeb3cc90d9ba98045e7b8acace8b1ad51` ran the `V2 Core Upgrade` workflow successfully on 2026-08-28. That run includes the new canonical source-cache reuse test and canonical Evidence Ledger deduplication test, together with the workflow's existing V2 integration/regression path. The subsequent commit only updated this living handoff, so no code behavior changed after the successful run.

Remote branch state was re-read after the push, and PR #1 reported `mergeable: true`.

Future agents must still inspect the current HEAD and latest workflow before beginning a new iteration; do not assume this verification remains current indefinitely.

---

## 10. Remaining work — priority order

### P0 — Research artifact reuse by content hash

Implement a **safe compact Evidence Ledger / Research handoff cache keyed by normalized source-content hashes**, with the real goal of avoiding repeated Research Codex analysis when the same source material is reused for a compatible topic.

Requirements:

- hash normalized source content, not URL alone;
- include cache schema/prompt-policy version;
- include risk/evidence/freshness compatibility dimensions;
- invalidate when underlying source text changes;
- never reuse across incompatible high-risk/current modes;
- cache only bounded derived artifacts;
- deterministic hit/miss/version/TTL tests;
- diagnostics for cache hits and measured saved calls;
- conservative fallback to normal Research when any compatibility check is uncertain.

### P0 — Measure Research-preflight saved calls

Persist fields such as:

- `researchPreflight.applied`
- `researchPreflight.searchMode`
- `researchPreflight.reason`
- `researchPreflight.codexDecisionCallSkipped`

Do not fabricate token savings without a reliable baseline.

### P1 — Modularization without behavior change

Large growth points remain `src/main.js`, `src/lib/codexRunner.js`, and publisher code. Preferred extraction boundaries:

- generation pipeline orchestration;
- publish state machine / independent verification;
- pending-draft recovery;
- evidence/research cache policy;
- Agent invocation wrappers;
- diagnostics persistence.

Avoid a broad stylistic rewrite.

### P1 — Stronger behavioral/session tests

Add deterministic tests for:

- timeout after a successful final click;
- verification success / confirmed absence / unknown branches;
- no auto-retry from `publish_uncertain`;
- pending-draft resume quarantine;
- stale browser profile/session recovery;
- cache schema/version invalidation;
- backward-compatible settings/history parsing.

### P1 — Windows/Electron smoke coverage

Add the lightest practical credential-free Windows/Electron smoke checks. Do not require live Naver publishing for routine CI.

### P2 — Operator diagnostics UX

Expose concise reasons for adaptive reasoning decisions, Research-preflight skip events, source/Research cache hits, and measured-vs-estimated savings without cluttering the primary publishing flow.

---

## 11. Known regression watchlist

### V2 patch reruns

Previous iterations found rerun failures/duplicate insertions when patch scripts expected one exact historical source shape. Idempotency remains a requirement.

### Regex policy false positives

A previous legal/high-risk regex could classify ordinary `방법` as legal because of a broad `법` match. Prefer explicit terms and regression examples.

### Error-state mappings

Preserve existing Codex usage-limit/execution-failure mappings when adding new states.

### Adaptive overreach

Do not lower reasoning from insufficient history or for high-risk/current contexts.

### URL canonicalization overreach

Do not strip unknown query parameters merely because they look unnecessary. Some query parameters select language, article version, product, date, pagination, or other content. The current preserve-unknown/remove-known-trackers approach is intentional.

### UI/IPC shape drift

When diagnostics fields change, verify the entire producer -> main -> IPC -> renderer -> history path.

### Publish ambiguity

Never optimize apparent success rate by turning post-click ambiguity into blind retries.

---

## 12. Test/CI checklist

For every meaningful V2 iteration, run or inspect as many as available:

- syntax checks for modified JS modules;
- feature-specific V2 regression scripts;
- deterministic quality-gate checks when affected;
- Evidence ordering/budget/deduplication tests when affected;
- source cache TTL/read/write/prune/canonicalization tests when affected;
- duplicate-title/material tests when affected;
- token diagnostics/adaptive-policy tests when affected;
- publish safety/pending-draft recovery tests when affected;
- original `npm run check`;
- integration workflow/generated commit behavior where used;
- remote branch HEAD and PR mergeability/status after pushes.

If a test cannot be run because of credentials/Actions/environment constraints, record that limitation rather than silently treating it as passed.

---

## 13. Standard workflow for every future engineering loop

1. Fetch current `upgrade/best-of-v2` HEAD.
2. Inspect current PR #1 and latest CI/workflow results.
3. Read this `HANDOFF.md` plus relevant current source files.
4. Detect changes made by another AI/developer since the previous loop.
5. Choose the highest-value remaining improvement/regression.
6. Make the smallest coherent implementation.
7. Add/update deterministic regression coverage.
8. Run or inspect practical V2 tests plus original `npm run check`.
9. Fix regressions before calling the loop healthy.
10. Update this document with what changed, why, tests/CI, risks/decisions, and revised next priority.
11. Commit/push to the existing `upgrade/best-of-v2` branch.
12. Continue PR #1; do not open a duplicate PR.
13. Re-read remote HEAD/PR after push.

Do not report completion merely because a local patch exists or because an earlier CI run was green.

---

## 14. Operational/security notes

Do not commit passwords, cookies, browser profiles, account assets, `.env` files, runtime logs containing secrets, or generated user-specific session material.

Live Naver/Tistory publishing has external side effects. Prefer deterministic/simulated safety tests and use live publishing only when explicitly appropriate.

---

## 15. Decision log

### 2026-08-28 — Canonical source identity

Decision: canonicalize source URLs for both persistent source-cache keys and Evidence Ledger source identity.

Reason: search engines, redirects, campaigns, and copied links can represent the same source with UTM/click identifiers, fragments, query ordering, default ports, or trailing-slash differences. Treating these as separate sources wastes extraction/cache capacity and repeated evidence prompt budget.

Safety choice: remove only a conservative known set of tracking parameters while preserving unknown/functional query parameters.

Verification: `V2 Core Upgrade` succeeded on code/test commit `e950655e...`, including the new canonical cache-reuse and evidence-deduplication assertions.

### 2026-08-26 — Living handoff introduced

Decision: keep this root `HANDOFF.md` as a mandatory living engineering handoff updated with every meaningful V2 iteration.

### Existing V2 decisions carried forward

- Keep Codex CLI; do not switch to OpenCode Go.
- Deterministic gates before model review where reliable.
- Compact Evidence Ledger instead of repeated raw source context.
- Targeted repair before full rewrite.
- Conservative `publish_uncertain` semantics.
- History-driven Writer-only adaptive lowering under strict safety gates.
