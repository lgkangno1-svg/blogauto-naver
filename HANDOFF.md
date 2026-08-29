# Blogauto Naver V2 — Engineering Handoff

> **Living implementation document.** Update this file whenever `upgrade/best-of-v2` changes materially.
>
> **MANDATORY FIRST READ:** `PRODUCT_DEVELOPMENT_CHARTER.md` is the canonical product/development charter. Every future AI/developer must read that document first, then this handoff, before choosing or implementing an improvement.
>
> Last updated: 2026-08-28 (Asia/Seoul)
> Active branch: `upgrade/best-of-v2`
> Active PR: #1 — `Build best-of V2: Codex-first quality and token-efficient pipeline`

## 1. Purpose of this document

`PRODUCT_DEVELOPMENT_CHARTER.md` defines **what the owner wants, why the product exists, product philosophy, quality/cost/automation/safety criteria, prioritization rules, and long-term target**.

This `HANDOFF.md` intentionally tracks the changing implementation state: what exists now, important invariants, verification status, known regressions, and the next engineering priorities.

If implementation convenience conflicts with the Charter, follow the Charter unless the owner's latest explicit instruction supersedes it.

## 2. Current architecture

Primary application path:

1. Electron UI loads account/category/topic/purpose/token/publishing settings.
2. Research/Title logic determines subject/title and evidence/search requirements.
3. Deterministic Research preflight bypasses a redundant “do I need search?” Codex call when search is already obviously necessary.
4. Search gathers source candidates when required.
5. Persistent source-body cache reuses extracted content according to freshness TTL.
6. Evidence is ranked, canonicalized, deduplicated and compressed into an Evidence Ledger / compact Research handoff.
7. Writer Contract is deterministically accepted for routine stable work or semantically refined by Main when risk requires it.
8. Writer produces title/article/tags/image instructions.
9. Deterministic quality gates run before Main review.
10. Targeted partial repair runs for local repairable failures before a full rewrite.
11. Main semantic review runs when still required.
12. Image Worker generates image output.
13. Naver browser automation writes and publishes the post.
14. Ambiguous post-click outcomes are independently verified; unresolved ambiguity becomes `publish_uncertain`.
15. Optional Tistory publishing follows the safe path.
16. Token/job diagnostics are persisted and surfaced in Electron.

Key files include `src/main.js`, `src/lib/codexRunner.js`, `src/lib/search.js`, `src/lib/evidenceLedger.js`, `src/lib/sourceCache.js`, `src/lib/qualityGate.js`, `src/lib/partialRepair.js`, `src/lib/adaptiveReasoning.js`, `src/lib/tokenPolicy.js`, `src/lib/publishSafety.js`, `src/lib/naverPublisher.js`, `src/lib/jobDiagnostics.js`, `src/renderer/`, and `scripts/check*.js`.

## 3. Completed V2 capabilities

- Deterministic quality checks for fabricated experience, unsupported numeric claims, high-stakes authority evidence, duplicate titles, AI stock phrases, repetitive endings, and length anomalies.
- Targeted partial repair before full Writer rewrite.
- `economy` / `balanced` / `quality` modes and conservative history-driven Writer reasoning adaptation.
- Explicit `xhigh` preservation.
- Per-Agent gross/effective/cached token diagnostics and durable history.
- Adaptive Writer Contract refinement that can skip a redundant Main call for routine stable manual work.
- Deterministic Research preflight that skips a redundant Codex search-decision call when search is clearly required.
- Compact Evidence Ledger and Research handoff instead of repeated raw source bodies.
- Authority-first evidence ordering and global evidence budget.
- Freshness-aware persistent source cache: high 1h, medium 6h, auto 12h, low 72h.
- Canonical source URL identity: fragments/default ports/tracking parameters removed, remaining query parameters sorted, functional unknown parameters preserved.
- Early lexical + zero-token semantic/material duplicate detection before Writer/Main/Image work.
- Conservative Naver final-publish commit boundary with independent verification and `publish_uncertain` quarantine.
- Pending-draft recovery preserving the same no-blind-republish invariant.
- Electron token/publish diagnostics.
- Feature-specific V2 regression checks plus original project checks.

## 4. Current highest priorities

### P0 — Content-hash Research artifact reuse

Safely cache compact derived Evidence/Research artifacts when the underlying normalized source content is the same and risk/freshness/policy dimensions are compatible. The goal is to eliminate repeated Research analysis of the same evidence, not merely to make a cache for its own sake.

Required safeguards: source-content hash, schema/prompt-policy version, freshness/risk compatibility, invalidation when source text changes, bounded cached output, deterministic hit/miss/version tests, conservative fallback, and measured saved-call diagnostics.

### P0 — Persist Research-preflight saved-call metrics

Record actual preflight decisions such as `applied`, `searchMode`, `reason`, and `codexDecisionCallSkipped`. Do not invent token-savings numbers without a defensible baseline.

### P1 — Behavioral reliability tests

Strengthen tests for final-click timeout/verification branches, `publish_uncertain`, pending-draft quarantine, stale session recovery, cache invalidation, and backward-compatible settings/history parsing.

### P1 — Modularize only behind tests

Gradually extract generation orchestration, publish state machine, pending-draft recovery, evidence/cache policy, Agent invocation, and diagnostics from large files. No broad stylistic rewrite.

### P1 — Windows/Electron smoke coverage

Add the lightest credential-free smoke coverage practical. Routine CI must not require live Naver publishing.

### P2 — Operator diagnostics UX

Show concise reasons for adaptive decisions, preflight skips, cache hits, and actual measured savings without turning the main UI into a developer console.

## 5. Safety invariants that must not regress

- Codex CLI remains the Agent runtime unless the owner explicitly changes it.
- High-risk/current/financial/policy/application/recruitment/strict-evidence work is not downgraded merely to save tokens.
- `quality` and explicit `xhigh` policies remain protected.
- Same/repeated content should be stopped before expensive downstream Agents where practical.
- Writer/Main receive compact evidence, not repeated raw crawled bodies.
- Cache freshness must not hide current changes.
- Unknown functional query parameters must not be stripped during URL canonicalization.
- Final Naver publish click is an irreversible commit boundary.
- Post-click ambiguity never becomes a blind automatic retry.
- `publish_uncertain` never feeds an automatic republish loop.
- Existing settings/history/session/pending-draft data should remain backward compatible where practical.
- Patch rerun/idempotency remains a regression requirement for the V2 integration approach.

## 6. Verification status

The canonical-source identity improvement was verified by the V2 Core Upgrade workflow, including canonical source-cache reuse and canonical Evidence Ledger deduplication regression coverage. The existing integration path also retains the project's V2 checks and original `npm run check`.

PR #1 was confirmed open and mergeable after that implementation cycle. Future developers must re-read current GitHub HEAD/PR/CI rather than treating this paragraph as permanently current.

The new `PRODUCT_DEVELOPMENT_CHARTER.md` is documentation-only and establishes the durable product/development criteria; it does not change runtime behavior.

## 7. Mandatory workflow for every future engineering loop

1. Inspect current GitHub branch HEAD, PR #1, and latest CI/workflow results.
2. Read `PRODUCT_DEVELOPMENT_CHARTER.md` in full.
3. Read this `HANDOFF.md`.
4. Inspect the current relevant source files; never assume remembered code is current.
5. Check whether another AI/developer changed the same area.
6. Choose the highest-value improvement using the Charter's P0/P1/P2 criteria.
7. Make the smallest coherent safe implementation.
8. Add regression coverage with the implementation.
9. Run/inspect relevant V2 tests and original project checks.
10. Fix regressions before declaring success.
11. Update this `HANDOFF.md` with implementation state, verification, new risks, and next priority.
12. If the owner's product goals or long-term criteria changed, update `PRODUCT_DEVELOPMENT_CHARTER.md` too; otherwise leave the Charter stable.
13. Push to the existing `upgrade/best-of-v2` branch and continue PR #1.
14. Verify the remote state after push.

## 8. Completion definition

A development iteration is complete only when the coherent change is implemented, relevant regression coverage exists, practical checks have passed or limitations are explicitly recorded, the remote branch reflects the change, and this handoff is current.

Do not report a live browser/Naver behavior as verified merely because syntax/CI tests passed. External side-effect testing must be described accurately.
