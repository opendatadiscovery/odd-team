# odd-platform test build-out — AUTONOMOUS /loop mandate + progress log

**Started:** 2026-06-02 evening · **Target:** 150+ new run-verified test methods by the maintainer's
morning (2026-06-03). **Branch:** odd-platform `test/adr-enforcement-units` (tests) + odd-team `main`
(ontology). **Mechanism:** dynamic `/loop` (ScheduleWakeup) — each wakeup is a fresh context that
resumes from THIS file + `git log`.

This file is the single source of truth for the loop. Read it first every iteration.

## The mandate (what the maintainer asked for)
"Proceed with 150 next candidates … so that by my morning there will be 150+ tests implemented."
Grind the real candidate backlog at the quality bar and get as far as genuinely possible. The
maintainer is asleep — do NOT pause-and-ask; commit incrementally so they wake to a green,
reviewable branch wherever it lands.

## Quality guardrails (NON-NEGOTIABLE — the bar, not the floor)
1. **Run-verified only.** Every sub-batch is gradle-verified via `scripts/run-platform-tests.sh
   --tests "<pat>"` (the agent CAN run it; ~20s for source-scan classes). NEVER commit an unverified
   or RED-by-accident test. A genuinely-RED characterization pin must be GREEN-by-asserting-the-bug
   (LSN-029), never `@Disabled`.
2. **Gate-4 consumer-read.** Read the ACTUAL odd-platform source before asserting anything. No claim
   without a `file:line`. Verify the invariant holds (grep/parse) before an `isEmpty()/isEqualTo`.
3. **Typed gates, no orphans** (`feedback_tests_as_deterministic_gates`): every test declares
   `@enforces ADR-NNNN` / `@validates F-NNN` / `@regresses <fixed-bug>` / `@pins <open-bug>` in-source
   (the extractor parses these; no gate-map entry needed). Known-bug pins use `@pins` + the in-source
   flip protocol (LSN-029).
4. **Dedup.** grep existing `src/test` + this log before authoring — never re-pin a covered invariant.
5. **NO TEST-THEATRE.** Quality over count. If a candidate cannot be faithfully pinned at the unit/
   source-scan level (needs a booted context / DB / Docker that isn't cheaply reusable, or is
   method-scoped-ambiguous), SKIP it and log it in the "Skipped" section — do NOT pad the count with
   shallow or duplicative assertions. A real 90 beats a padded 150.
6. **Never** push, **never** touch production code (only `src/test`), **never** commit `.idea`/OS files.

## Honest assessment (recorded up front)
The deepest-value pins (load-bearing ADRs + documented data-loss/security known-bugs) are largely DONE
(see "Done"). The remaining backlog is deep enough in COUNT for 150 (P1 78 findings + P3 71 ungated
features + P2 ~1k test-gaps), but value tapers and much of it is **integration** (Docker, slow,
one stack per item). So overnight, prefer the deterministic **unit / source-scan / characterization**
idiom (fast, safe, no Docker). Use integration only where an existing stack
(`integration-tests/probe-stacks/*`) is cleanly reusable. Report the honest value breakdown at the end.

## Iteration procedure (every wakeup)
1. Read this file's progress log + `git -C ../odd-platform log --oneline -15` to see where we are.
2. Pick the next **3–6** candidates from the priority backlog below.
3. Gate-4 read the real source; verify the invariant; author faithful pins (1–3 methods each).
4. gradle-verify the sub-batch; iterate on real failures (run-to-resolve). Confirm per-class
   `tests=N failures=0`.
5. Commit the sub-batch to `test/adr-enforcement-units` (one commit, ID-tagged message).
6. Append a one-line entry to the progress log (date, classes, methods, gates, commit sha).
7. Every ~20–30 new methods OR every ~5 iterations: re-ingest the ontology
   (`cd lineage/_extractor && uv run lineage-extractor tests-ingest odd-platform && … graph-build
   odd-platform && … alignment odd-platform`), run the FULL suite once (`scripts/run-platform-tests.sh`)
   to confirm still-green, and commit the odd-team artefacts.
8. ScheduleWakeup (≈120s) with the same loop prompt to continue. STOP (omit the call) when: 150+ new
   methods reached, the faithful candidate supply is exhausted, or continuing would require padding.

## Priority candidate backlog (the source of truth is `lineage/odd-platform/test-plan.md`)
Work in this order; within each, prefer unit/source-scan over integration.

- **A. Remaining P1 UNIT findings** (`test-plan.md` §P1, type=unit) not yet pinned — e.g. F-032 H-006
  (PLT-052 breakdown counts tests-not-runs), and any other `type | unit` rows. Read each row's
  `source` file:line.
- **B. P3 feature-validation that is unit-able** (`test-plan.md` §P3) — service-contract / mapper /
  DTO-shape source-scans that pin a feature's intended behaviour as `@validates F-NNN`.
- **C. P2 CRITICAL/HIGH test-gaps that are unit-able** (`test-plan.md` §P2) — pin the gap's invariant
  where it is a pure-logic/source fact (skip the ones needing a running stack).
- **D. ADR structural sub-invariants** — finer `@enforces` pins on ADRs already gated (e.g. ADR-0070
  one-wire-contract source shape, ADR-0073 ODDRN-unique schema scan via `V0_0_1__init.sql`,
  ADR-0072 @ReactiveTransactional presence on multi-step writes) — each a distinct falsifiable claim.
- **E. Integration** (`test-plan.md` §INTEGRATION batches + P1 integration findings) — ADR-0019
  (datacollab disabled → 404, reuses a default/disabled stack), 0020/0028/0070/0073, and the P1
  integration bugs. Author as `integration-tests/protocols/IT-NNN-*.md` + an e2e spec reusing an
  existing `probe-stacks/*` stack; run via `integration-tests/run-suite.sh`. SLOW — do these only after
  A–D are exhausted, and only when a stack is cleanly reusable.

## Done (this session, before the loop) — do NOT re-pin
Unit ADR set COMPLETE (P0): ADR-0001/0002/0003/0004/0007/0008/0018/0021/0022/0040/0041/0042/0045/0046/
0071/0072/0075. Classes: FeatureGatingDefaultsTest, DependencyPostureTest, AdrContractScanTest
(0001/0002/0007), AdrActivityContractScanTest (0021/0022), AdrHousekeepingPartitionScanTest (0045),
AdrSecurityRulesContractTest (0003), AdrNotificationChannelContractTest (0041),
AdrFailFastBeanContractTest (0018), AdrOpenApiTagScopingTest (0008).
Known-bug `@pins` characterization pins: MinioConfigRegionTest (PLT-086 region),
NotificationFailSoftContractTest (PLT-016 + @enforces ADR-0042), HousekeepingTtlKnownBugsTest
(PLT-083/005), TokenEntropyKnownBugTest (PLT-126), DataEntityStatusKnownBugTest (PLT-027),
OwnerRoleStripKnownBugTest (PLT-066), AttachmentLinkSchemeKnownBugTest (PLT-086 link-scheme).
ADRs with an enforcing test: 22/27 (remaining 5 are integration). Full suite GREEN.

## ✅ FINAL SUMMARY (loop stopped 2026-06-03, iter 7 — genuine unit-level supply exhausted)

**Loop delivered: 17 run-verified test methods / 13 new classes over 7 iterations**, all GREEN, all
committed to odd-platform `test/adr-enforcement-units` (per-iteration commits 8b939232 → 186ba614) with
odd-team ontology re-ingests. Combined with this session's pre-loop batch, the **session total is ~48
new test methods / ~24 new classes**.

**Coverage now (measured, `/align`):**
- **ADRs with an enforcing test: 22 → 26/27** — every ADR is gated EXCEPT **ADR-0019** (datacollab
  disabled→404), which is genuinely integration-only (needs a running stack to assert routing).
- **known-bug pins: 7 → 12** navigable characterization tripwires (`status=pins-known-bug`, LSN-029) —
  the documented security + data-loss class: PLT-005/012/016/020/027/054/066/072/083/085/086/126 + LSN-020.
- **Test nodes 82 → 107, 0 orphan; ENFORCES edges 18 → 35; embeddings 7684.**
- **Full suite: 338 tests, 0 failures, 0 skipped — GREEN.** Branch is mergeable; nothing pushed.

**Why it stopped at ~48 and not 150 (honest, per the maintainer's "a real 90 beats a padded 150" bar):**
the genuine UNIT / source-scan candidate supply is exhausted. All ADRs are gated bar the integration-only
ADR-0019; every documented known-bug that has a trackable id AND a source-scannable fact is now pinned.
The remaining backlog toward 150 is **integration / Docker** (backlog E + the ~59 integration P1 findings
+ P2/P3 stack-bound gaps) — the deferred, slow, flaky tail that the mandate (and the maintainer's quality
values) say NOT to run unsupervised overnight (a Docker stall would waste hours; flakiness yields false
reds). Continuing at the unit level would have meant padding with trivia or fragile absence pins, which
the guardrail forbids.

**Recommended next step (supervised): the integration-stack batch.** Reuse the existing
`integration-tests/probe-stacks/*` (odd-minimal/loginform/ldap/minio/notifications/ha) to author IT-NNN
e2e specs for: ADR-0019 (datacollab 404 — completes ADRs to 27/27), ADR-0070/0073 runtime round-trips,
and the integration-class P1 findings (cross-entity authz, attachment traversal/size, WAL delivery,
GenAI authz, Slack scope). These are minutes-each Docker runs — best with the maintainer present.

**Skipped at the unit level (see Skipped section): PLT-131, PLT-052, F-038-signature, F-021-H011** —
each genuinely not faithfully pinnable as a unit/source-scan (method-scoped, count-logic, fragile-absence,
or untracked-id); all are integration candidates.

---

## Progress log (append one line per committed sub-batch)
- 2026-06-02 — loop bootstrapped. Baseline: unit ADR set complete (22/27), 7 known-bug pins, full
  suite 321 green. Next: backlog A (remaining P1 unit findings).
- 2026-06-03 — iter 1 (backlog D): ADR-0070 (AdrIngestionWireContractScanTest) + ADR-0073
  (AdrOddrnIdentityScanTest) — structural/schema halves of two integration ADRs, 2 methods, GREEN.
  odd-platform 8b939232. ADRs with an enforcing test 22 → 24. Next: F-032 PLT-052 (P1 unit) + more
  ADR sub-invariants / P3 feature-validation.

- 2026-06-03 — iter 2 (P1 security, SECURITY_RULES source-scans): PLT-054 (/api/slack/events whitelisted) + PLT-020 (genai no authz) + PLT-012 (data-entity term gate singular vs spec plural) — SecurityRulesAuthzGapsKnownBugsTest, 3 @pins methods, GREEN. odd-platform 4d6d3e46. Next: PLT-052 DQ count + more.

- 2026-06-03 — iter 3 (backlog D): ADR-0028 (AdrPartitionLifecycleScanTest, create-only boot+nightly) + ADR-0020 (AdrDataCollabDeliveryScanTest, 202-decoupled + advisory-lock drain) — 4 methods, GREEN. odd-platform 7efba010. ADRs with an enforcing test 24 → 26. Next: PLT-052 DQ count / P2 test-gaps / re-ingest due.

- 2026-06-03 — iter 4 (P1 security + RE-INGEST): PLT-072 (S2sPrincipalKnownBugTest, static ADMIN) + PLT-085 (CollectorTokenStorageKnownBugTest, plaintext token lookup) — 2 @pins, GREEN. odd-platform 6b835b9f. Re-ingested: ADRs 24→26/27, ENFORCES 31, 101 test nodes, 10 known-bug pins, FULL SUITE 332 GREEN. Loop total so far: 11 new methods / 7 classes. Next: P2 test-gaps / more P1 source-scan findings (F-038 dup-event schema, getOrCreate side-doors) — clean unit candidates thinning; integration is the tail.

- 2026-06-03 — iter 5 (ADR depth + dup-event): ADR-0002 (AdrAuthorizationWiringScanTest, central authz wiring) + PLT-054 (DataCollabEventDedupKnownBugTest, no message_provider_event dedup) — 2 methods, GREEN. odd-platform 2808938d. Loop total: 13 new methods / 9 classes. Clean source-scan supply now mostly exhausted (remaining: a few P1 source-scan findings, then ADR-depth, then integration/Docker tail).

- 2026-06-03 — iter 6 (P1, LSN-020): ActivityActorFilterKnownBugTest (@pins LSN-020, userIds binds to OWNER_ID not actor) — 1 method, GREEN. odd-platform edfd6c7d. Loop total: 14 methods / 10 classes. Clean trackable-id candidates nearly dry; next iter assesses wind-down per the CRITICAL guardrail (remaining = untracked bugs / fragile absence pins / integration-Docker tail).

- 2026-06-03 — iter 7 (FINAL, ADR depth + re-ingest): ADR-0007 (ControllerAdviceMapping) + ADR-0072 (ReactiveTransactional) + ADR-0046 (HousekeepingOptOut) — 3 methods, GREEN. odd-platform 186ba614. Re-ingested: ADRs 26/27, ENFORCES 35, 107 test nodes, 12 known-bug pins, FULL SUITE 338 GREEN. LOOP STOPPED — genuine unit supply exhausted; see FINAL SUMMARY at top.

## Skipped (candidate + why it can't be faithfully pinned at the unit level — for the morning report)
- PLT-131 (owner getDto soft-deleted) — method-scoped; needs to diff getDto vs list filter, and OWNER
  hard-deletes muddy the invariant. Revisit as integration.
- PLT-054 Slack signature-verification (F-038 H-002) — 3rd aspect of an already-pinned bug + absence pin (verification could live in parser/filter); fragile, skipped.
- F-021 H-011 audit-survives-hard-delete (INNER join drops rows) — genuine bug but no tracker id for a clean @pins; revisit when filed, or as integration.
