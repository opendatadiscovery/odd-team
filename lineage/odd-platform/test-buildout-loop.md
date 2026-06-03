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
1. **Run-verified AND style-verified.** Every sub-batch is gradle-verified via
   `scripts/run-platform-tests.sh --tests "<pat>"` (the agent CAN run it; ~20s for source-scan classes).
   That gate now mirrors CI exactly — `--tests` mode runs the filtered `test` **plus `checkstyleMain` +
   `checkstyleTest`** (a no-arg run runs the full `:odd-platform-api:build`, exactly as the GitHub
   run_tests job does). So "verified" means **green tests AND zero Checkstyle violations**: a created/modified test that trips a style rule (most commonly a line
   `>120` chars — `config/checkstyle/checkstyle.xml`) REDs this gate exactly as it REDs CI, even though
   every test passes (Checkstyle emits no JUnit XML — a green test run can still fail the build).
   NEVER commit a sub-batch until the script exits 0 (tests + checkstyle). NEVER commit an unverified
   or RED-by-accident test. A genuinely-RED characterization pin must be GREEN-by-asserting-the-bug
   (LSN-029), never `@Disabled`. Root cause this guard exists: 2026-06-03 PR #1743 went green on every
   test but RED on `:odd-platform-api:checkstyleTest` (4 test lines >120) because the old gate ran only
   `:odd-platform-api:test` and never saw Checkstyle.
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
   **Author within the Checkstyle rules** — keep every line **≤120 chars** (the rule that bit PR #1743;
   wrap per `config/checkstyle/checkstyle.xml`: dot/operator lead the wrapped line, comma trails, +4
   indent), no unused imports/star-imports, no trailing whitespace. Caveat: `awk length` counts BYTES,
   so a line with an em-dash `—` (3 UTF-8 bytes, 1 char) over-counts — the gate (step 4) is authoritative.
4. gradle-verify the sub-batch via `scripts/run-platform-tests.sh --tests "<pat>"`; iterate on real
   failures (run-to-resolve). Confirm the script **exits 0** = per-class `tests=N failures=0` **AND
   `:odd-platform-api:checkstyleTest`/`checkstyleMain` reported no violations** (the script runs both
   checkstyle tasks alongside the filtered test, so a style violation fails this step — fix it before
   committing, never commit around it).
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

## ✅ PHASE 1 COMPLETE — structural + known-bug SOURCE-SCAN pins (iters 1-7)

**Phase 1 delivered: 17 run-verified methods / 13 classes over 7 iterations** (+ pre-loop batch =
~48 methods / ~24 classes), all GREEN, committed to odd-platform `test/adr-enforcement-units`
(8b939232 → fc851571). These are STRUCTURAL source-scan pins (ADR shapes, known-bug characterizations)
— a NARROW slice. **This was NOT the unit-test ceiling** (maintainer correction 2026-06-03): the real
unit scope is the ~1038 TEST-GAP backlog worked with BEHAVIORAL tests — see PHASE 2 below. (The earlier
"loop stopped, supply exhausted" call was wrong: it conflated the source-scan slice with the whole unit
scope. Memory: feedback_unit_test_scope_is_the_testgap_backlog.)

## ⚡ COVERAGE-DRIVEN RE-ORIENTATION (2026-06-03, maintainer directive)

A deterministic JaCoCo coverage GATE is now live on `test/adr-enforcement-units` (odd-platform
`build.gradle` + `run-pr-tests.yaml`, commit f4561f23): **Madrapps/jacoco-report**, `min-coverage-overall: 70`,
`min-coverage-changed-files: 98`, generated code excluded. **Current report-level instruction coverage = 44.3%
(37818/85367).** The PR coverage check is RED until 70% — the build-out must close that gap **before the next
merge** (maintainer's words). SonarCloud is permanently gone (no budget/access — see memory).

**New primary objective: drive instruction coverage 44.3% → 70%**, not raw test count. Maintainer chose
"re-point the loop at high-impact gaps" (pure UNIT; defer the `repository.reactive` integration lever).
- **Target selection = biggest MISSED-instruction hand-written classes** (parse
  `odd-platform-api/build/reports/jacoco/test/jacocoTestReport.csv`, sort by INSTRUCTION_MISSED desc, skip
  generated + `repository.*` + already-covered). Mappers are tiny % — STOP defaulting to them; go where the
  missed instructions are.
- **Controllers (13%, big + easy):** `@WebFluxTest(XController.class)` + `@MockBean` the service(s) +
  `WebTestClient` — sliced web context, NO Docker. Assert status codes + response shape per endpoint.
- **Low-coverage services (term 1% / search 13% / policy.comparer / genai / attachment):** Mockito +
  StepVerifier over their real method bodies (happy + guard paths), covering the FAT methods.
- Still: confirmed gate (@validates F-NNN / @enforces ADR / @pins) only; ≤120-char lines + sorted imports;
  verify via `scripts/run-platform-tests.sh --tests`; re-run jacocoTestReport every few iters to track the %.
- `repository.reactive` (42%, 33.6k instr — a THIRD of the base) is the dominant remaining gap but needs
  Testcontainers integration; it's DEFERRED by the maintainer's choice, so 70%-with-repos-in will require a
  later integration pass (flag it when unit gains plateau).

## 🔄 PHASE 2 — gap-driven BEHAVIORAL unit tests (the real +150 scope; ACTIVE)

**Mandate:** work the ~1038 `TEST-GAP-NNN` backlog (`lineage/odd-platform/test-map/detail/*.yaml`)
gap-by-gap toward 150+ behavioral unit tests that pin EXPECTED functionality. The instrument is
behavioral tests that EXERCISE the code, not string-scans:
- **Services** → Mockito (`@ExtendWith(MockitoExtension)`, `@Mock` the repos/collaborators) + reactor-test
  `StepVerifier` (assertNext / verifyComplete / verifyError) + `verify(...)`. Pattern refs:
  `NamespaceServiceImplTest`, `ActivityServiceImplTest` (the Phase-2 proof, fc851571), `DataEntityServiceTest`.
- **Mappers / validators / parsers / enums / pure utils** → plain JUnit + AssertJ (no mocks).
- **Controllers** → `@WebFluxTest(X.class)` with a `@MockBean` service (sliced web context — NO Docker).

**Per-gap pipeline (every candidate):** (1) read the TEST-GAP detail; (2) Gate-4 read the target source;
(3) decide: unit-able now / integration (defer) / rescope / remove-if-stale-or-not-applicable; (4) if
unit: author a faithful behavioral test pinning the expected behaviour with a typed gate
(`@validates F-NNN` for feature behaviour, `@enforces ADR-NNNN` where it pins an ADR, `@pins <id>` for a
known bug); (5) gradle-verify (never commit unverified / accidental-RED) **AND run the lint gate
`JAVA_HOME=<jdk17> ./gradlew :odd-platform-api:checkstyleTest --no-daemon` — `run-platform-tests.sh`
does NOT lint, but CI does; both `LineLength`>120 (CHARS not bytes — em-dash/arrow = 1 char, so `awk
length` false-positives) and `CustomImportOrder` (sort within the `o.o.oddplatform.*` group) fail CI
silently-green. Do NOT pass `--tests` to checkstyleTest; `./gradlew --stop` if a stale daemon errors`;
(6) commit; (7) **update the TEST-GAP node** — mark covered (point `test_files_existing` at the new test)
or rescope/remove, and note it; (8) re-ingest the ontology every ~20-30 methods + full suite.

**Triage rule:** SKIP (and log in Skipped) gaps that genuinely need a running stack/DB/Docker
(`category: missing-integration` that truly needs Testcontainers) — those are the integration batch. But
MANY `missing-integration` gaps are actually unit-able as `@WebFluxTest`+mock or Mockito service tests —
judge by whether the behaviour needs a real DB. Prefer criticality CRITICAL/HIGH first.

**Stop condition (Phase 2):** 150+ behavioral methods reached, OR the genuinely unit-able gaps are
exhausted (then the remainder is the supervised integration batch) — stop with a summary + PushNotification.

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

- 2026-06-03 — PHASE 2 kickoff (maintainer correction: unit scope = the TEST-GAP backlog, not source-scans). Proof behavioral test ActivityServiceImplTest (4 methods, Mockito+StepVerifier, dispatch of getActivityList) GREEN — odd-platform fc851571. Loop RESUMES gap-driven toward +150 behavioral tests.

- 2026-06-03 — PHASE 2 iter 1 (behavioral services): ActivityServiceImplTest (4, dispatch; fc851571) + OwnerServiceImplTest (5, cascade-delete safety + NotFound; 89d8b148) = 9 behavioral methods, GREEN. Both services had NO prior unit test. validates F-019/F-021. Gap-curation note: the finer OwnerService gaps (622 UX-confirm, 625 FTS-delete-asymmetry, 626 owner_association_request orphan) are integration/finer and remain OPEN — not false-marked; re-ingest auto-credits the new tests via COVERS + @validates. Run-to-resolve: delete() uses eager .then(arg) → cascade tests use a poison Mono.error (subscribe-only). Next: more untested services (Tag/Alert/DataSource/Collector) + mappers/validators, gap-node-driven.

- 2026-06-03 — PHASE 2 iter 2 (behavioral service): CollectorServiceImplTest (5, cascade-delete + not-found, validates F-020) GREEN, no run-to-resolve. odd-platform 444df13e. Phase-2 total: 14 behavioral methods. Next: DataSource/DataQuality/Term/Tag/Role services + mappers/validators.

- 2026-06-03 — PHASE 2 iter 3 + RE-INGEST: DataSourceServiceImplTest (4, cascade-delete + not-found, validates F-031; a26e47f6) GREEN. Re-ingest: 111 test nodes, VALIDATES 72→76, full suite 356 GREEN. Phase-2 total: 18 behavioral methods / 4 service classes. Next: DataQuality/Term/Tag/Role/Policy services + mappers/validators.

- 2026-06-03 — PHASE 2 iter 4 (behavioral service): RoleServiceImplTest (4, ADMIN/predefined-role protection + not-found, validates F-006; addresses CRITICAL TEST-GAP-221) GREEN. odd-platform fe7b57dc. Phase-2 total: 22 behavioral methods / 5 service classes. Next: DataQuality/Term/Tag/Policy/Reference services + lookup validators (pure JUnit) + mappers.

- 2026-06-03 — PHASE 2 iter 5 (pure-logic + bug fix): extended LookupTypesValidatorTest +3 methods (Integer/Char/Timestamp validators, previously uncovered) AND fixed a real copy-paste bug (line 69 UUID invalid-case asserted jsonbValidator). 8/8 GREEN. odd-platform 38243c94. Phase-2 total: 25 methods. Dedup note: the 5 other lookup validators were already covered — extended, not duplicated. Next: more untested services (DataQuality/Term/Tag/Policy/DataEntityGroup) + re-ingest due ~iter 6.

- 2026-06-03 — PHASE 2 iter 6 (behavioral service): AlertHaltConfigServiceImplTest (4, read/save halt-config + NotFound + empty-default, validates F-007) GREEN. odd-platform dbd3a906. Phase-2 total: 29 methods. Next: DataEntityStatistics/DataEntityGroup/Tag/Policy services; re-ingest due ~38-40.

- 2026-06-03 — PHASE 2 iter 7 (behavioral service): DataEntityGroupServiceImplTest (2, only-manually-created-groups-editable + NotFound, validates F-012) GREEN. odd-platform 23794cfb. Phase-2 total: 31 methods / 7 services. Re-ingest due ~38-40. Next: DataEntityStatistics/Tag/Policy/Directory services + mappers.

- 2026-06-03 — PHASE 2 iter 8 + RE-INGEST: PolicyServiceImplTest (5, Administrator-policy protection + cascade + not-found, validates F-006; c32f8e9c) GREEN. Re-ingest: 115 test nodes, VALIDATES 76→80, FULL SUITE 374 GREEN. Phase-2 total: 36 behavioral methods / 8 services + validators. Next: DataEntityStatistics/Tag/Directory/DatasetField/Lineage/DataQuality services + mappers.

- 2026-06-03 — PHASE 2 iter 9 (behavioral service): TagServiceImplTest (4, external-tag protection + not-found, validates F-018) GREEN. odd-platform d8c13367. Phase-2 total: 40 behavioral methods / 9 services + validators. Next: Directory/DatasetField/Lineage/DataQuality/DataEntityRun services; re-ingest ~56.

- 2026-06-03 — PHASE 2 iter 10 (behavioral service): DataEntityRunServiceImplTest (2, runs only for runs-capable classes + NotFound, validates F-040) GREEN. odd-platform 52c2d910. Phase-2 total: 42 methods / 10 services + validators. Dedup-skipped DataEntityStatistics (existing ingestion test + murky gate). Next: Lineage/Reference/DatasetVersion/DatasetField services; re-ingest ~56.

- 2026-06-03 — PHASE 2 iter 11 (behavioral service): ReferenceDataServiceImplTest (4, lookup-table not-found + column-belongs-to-table invariant, validates F-026) GREEN. odd-platform 7bffe688. Phase-2 total: 46 methods / 11 services + validators. Next: Lineage/DatasetVersion/DatasetStructure/DataEntityFilled services + mappers; RE-INGEST due (crossing ~56 next iter).
- 2026-06-03 — PHASE 2 iter 12 + RE-INGEST (crossed ~56) + LINT-GATE CATCH: 5 services / 10 behavioral methods, all GREEN — DatasetVersionServiceImplTest (3, version-read NotFound + identical-diff BadRequest, validates F-045; d53eca6c); DataQualityServiceImplTest (2, no-tests + missing-dataset NotFound, F-022) + MessageServiceImplTest (1, non-existent parent NotFound, F-038) + MetadataFieldServiceImplTest (2, missing-field NotFound + get-or-create dedup invariant via ArgumentCaptor, F-046) [5debb00d]; QueryExampleServiceImplTest (2, update NotFound + duplicate-assign BadRequest — eager `.then`+`.zipWith` double-poison, F-025; a6306e4e). Re-ingest: 123 test nodes (0 orphan), VALIDATES 80→88, 12 known-bug pins, embeddings preserved (vectors=7700). FULL SUITE 384→394 GREEN (102 classes, 0 fail/0 skip). ready-now now credits F-022/F-038. **Lint-gate catch:** maintainer hand-wrapped 4 earlier test lines >120 (odd-platform d64df9b9) → ran the real `:odd-platform-api:checkstyleTest` (ground truth, agent CAN run it) → only real violation was MessageServiceImplTest import order (CustomImportOrder; datacollab.service sorts before exception/mapper/repo), fixed in e087464a; confirmed whole branch checkstyle-clean. Lesson folded into per-gap step 5 + memory project_local_test_env (checkstyle counts CHARS not bytes; the 3 byte>120 dash-lines were NON-issues). Phase-2 total: 56 behavioral methods / 16 services + validators. Next: Lineage(F-005)/OwnerAssociationRequest/DataSourceIngestion/DatasetField/DataEntityLookupTable services + mappers.

- 2026-06-03 — GATE HARDENING (post-merge CI failure → close the class). PR #1743 CI went green on
  every test but RED on `:odd-platform-api:checkstyleTest` — 4 loop-authored test lines >120 chars.
  Cause: the local gate ran only `:odd-platform-api:test`; CI runs `odd-platform-api:build` (= the full
  `check` lifecycle incl. checkstyleMain/Test). Fixed the gate to MIRROR CI: `scripts/run-platform-tests.sh`
  now runs `:odd-platform-api:build -PbundleUI=false` (no-arg) / `checkstyleMain + checkstyleTest + the
  filtered test` (`--tests` mode — `check`/`build` reject `--tests`, and `test` must be LAST so the option
  binds to it), both running Checkstyle over both source sets. VERIFIED: `run-platform-tests.sh --tests
  "*AlertHaltConfigServiceImplTest*"` → BUILD SUCCESSFUL, all 3 tasks ran, checkstyle GREEN (also confirms
  the d64df9b9 wrap fix is clean). Wrapped the 4 lines (odd-platform d64df9b9, no behavioral change).
  Guardrail 1 + iter-procedure steps 3-4 updated above to make style-verify non-negotiable.
  Memory: project_local_test_env (the local-gate-omits-checkstyle gap).

- 2026-06-03 — PHASE 2 iter 13 (behavioral services; lint-gate now via the hardened script): 3 services /
  5 methods, all GREEN + checkstyle-clean. AlertServiceImplTest (3, per-entity alert list+counts NotFound
  on a non-existent/soft-deleted entity via the shared checkDataEntityExistence guard + empty-external-batch
  no-op via verifyNoInteractions; validates F-014 + F-007) + OwnerAssociationRequestServiceImplTest (1,
  approve/decline a non-existent request → NotFound; getCurrentUser chain head assembled-not-subscribed;
  validates F-171) [5c8dce77]; DatasetFieldServiceImplTest (1, updateInternalName on a non-existent field
  → NotFound, eager .then(updateDatasetFieldSearchVectors) tail poisoned; validates F-178) [73c2c3f0].
  All verified via `run-platform-tests.sh --tests` (test + checkstyleMain + checkstyleTest in one shot).
  Phase-2 total: 61 behavioral methods / 19 services + validators. RE-INGEST due at ~76. Next: DatasetField
  (more guards: updateDescription/createOrUpdate)/DataSourceIngestion-or-Lineage (extend existing tests) /
  mappers/parsers. Deferred: DataEntityLookupTableServiceImpl (create/update pipelines are mapping-heavy,
  no clean unit guard → integration, logged in Skipped).
- 2026-06-03 — PHASE 2 iter 14 (small clean services; service-guard supply now THINNING). Scanned ALL
  remaining untested services for `new NotFoundException`/`new BadUserRequestException` signatures — the
  big-guard services are now covered; only small ones remain. MetricServiceImplTest (2, latest-metrics for
  a non-existent data entity / dataset field → NotFound; validates F-030) + DatasetFieldInternalInformation-
  ServiceImplTest (1, updateDescription on a non-existent field → NotFound, lazy flatMaps; validates F-047)
  [b24336a4]. Phase-2 total: 64 behavioral methods / 21 services + validators. RE-INGEST due at ~76.
  **Pivot signal:** the clean service-guard supply is nearly exhausted (remaining untested services are
  transform/aggregation/pipeline-heavy or have 0-1 guards). NEXT ITERS should shift to MAPPERS / parsers /
  enums (pure JUnit+AssertJ, no mocks) + extending existing service test classes with more guard methods —
  that is the larger remaining unit scope. Logged Relationships as an ONTOLOGY-GAP skip (see Skipped).
- 2026-06-03 — PHASE 2 iter 15 (MAPPER pivot — pure logic, no mocks): CollectorMapperImplTest (2,
  mapForm sets namespace/token FK ids null-safely; validates F-020) + DataSourceMapperImplTest (3, mapForm
  TRIMS the oddrn + null-safe FK ids; validates F-031) [37d120bc]. Instantiated against the REAL generated
  impls: `new XMapperImpl(new NamespaceMapperImpl(), new TokenMapperImpl(new DateTimeMapperImpl()))` (the
  mapper test lives in package `mapper`, so the *Impl classes need no import). Both gate cleanly to the
  feature their service already validates (no gate-hunting). Phase-2 total: 69 behavioral methods / 21
  services + 2 mappers. RE-INGEST due at ~76 (≈7 methods away — likely next iter). Next: more hand-written
  mappers gating to known features (PolicyMapper→F-006, OwnershipMapper, RoleMapper→F-006, DataEntityRun-
  Mapper→F-040) + parsers. KEY new lesson: a MapStruct mapper's generated `XMapperImpl` constructor takes
  its `uses` mappers; chain the no-arg/leaf impls (NamespaceMapperImpl no-arg, TokenMapperImpl(DateTimeMapperImpl)).
- 2026-06-03 — PHASE 2 iter 16 + RE-INGEST (crossed ~76): 4 mapper tests / 6 methods, all GREEN +
  checkstyle-clean. TokenMapperImplTest (2, mapValue MASKS hidden token to ******+last-6 vs full when
  showToken; the security invariant behind one-shot reveal; validates F-163) + OwnershipMapperImplTest (2,
  mapDtos/mapTermDtos return NULL not empty-list on empty input; validates F-019) + RoleMapperImplTest (1,
  mapToRoleList page total/hasNext→PageInfo; validates F-006) + DataEntityRunMapperImplTest (1, validates
  F-040) [2ad6e020]. Re-ingest: test nodes 123→134 (0 orphan), VALIDATES 88→100, 12 known-bug pins,
  embeddings preserved (vectors=7711). FULL SUITE 394→413 GREEN (113 classes, 0 fail/0 skip). Phase-2
  total: 75 behavioral methods / 21 services + 6 mappers. Next: more hand-written mappers/parsers gating to
  confirmed features (PolicyMapper mapToDto JSON-deser→F-006, TermMapper→F-024, NamespaceMapper, etc.) +
  extending existing service test classes. Halfway to 150; clean unit candidates still plentiful (mappers).
- 2026-06-03 — PHASE 2 iter 17 (COVERAGE-DRIVEN, first): targeted the BIGGEST uncovered non-repo class from
  the jacoco XML — service.term.TermServiceImpl (1306 missed instr, 2%). TermServiceImplTest (5 guard pins,
  validates F-024 + F-154 + F-002): getTermByNamespaceAndName unknown→NotFound; createTerm duplicate-in-
  namespace→BadRequest (duplicate guard before the Mono.defer create chain); updateTerm non-existent→NotFound;
  delete term-mentioned-in-description→BadRequest (eager .thenMany/.then deletion tails poison-stubbed);
  linkTermWithDataEntity already-assigned→BadRequest. GREEN + checkstyle-clean. odd-platform 32cc3ef3.
  Phase-2 total: 80 methods. NOTE (coverage reality): guard-only pins cover the GUARD branches, not the fat
  happy bodies (create/update/delete/link success) where most of the 1306 instr live — so the % bump is
  modest (~+0.2-0.3%). Re-measure pending (every few iters). Next biggest uncovered unit-able: service.search
  DataEntityHighlightConverter (1036, 1% — pure converter?), notification translators/generators (Slack/Alert,
  0%, pure-ish), controller.DataEntityController (349, 26%, @WebFluxTest). SecurityConstants (1094, 0%) is a
  constants holder — SKIP (test-theatre). repository.* deferred (integration).
- 2026-06-03 — PHASE 2 iter 18 (COVERAGE-DRIVEN): TermSearchServiceImplTest (3, fetchFacetState unknown-
  searchId→NotFound across getFacets/getSearchResults/getFilterOptions, validates F-024). GREEN. odd-platform
  66f78a78. Phase-2 total: 83 methods.
- 2026-06-03 — ⛔ PLATEAU REACHED (unit-only path short of 70%) — PINGED MAINTAINER, LOOP STOPPED.
  RE-MEASURE after iters 17-18 (8 tests): overall instruction coverage 44.30% → **44.57%** (+0.27 pts /
  8 tests). At ~0.034 pts/test, 70% (gap 25.4 pts / +21,706 covered instr) is ~180 iterations away —
  infeasible via the chosen unit-only path. ROOT CAUSE: the uncovered instruction mass is NOT unit-reachable
  cheaply — (a) repository.reactive (33.6k instr, 42%) is DEFERRED (integration/Testcontainers, maintainer's
  choice); (b) the remaining big non-repo classes are fat happy-bodies (HighlightConverter 1036, facet
  services, notification translators, GenAI/attachment) needing heavy DTO/facet SCAFFOLDING for modest
  per-test yield. Math: covering 100% of non-repo business logic tops out ~77% overall (repos cap);
  realistically ~60-65%. So 70%-with-repos-in is only reachable with the repository.reactive integration
  pass. LEVERS handed back to maintainer: (1) repository.reactive Testcontainers integration pass [efficient
  path to 70%]; (2) trim repository.* from the gate denominator → 70% measures business logic (then current
  base 45.6%, reachable by continued unit work); (3) lower the overall gate (e.g. 50-55%) + keep the 98%
  changed-files ratchet doing the real forward-looking work. Loop will RESUME on the maintainer's choice.
- 2026-06-03 — ✅ MAINTAINER CHOSE LEVER (2): TRIM repository.* FROM THE GATE. build.gradle now excludes
  `**/repository/**` from the jacoco denominator (commit fe816b85). New BUSINESS-LOGIC base = **46.01%**
  (23817/51766), repos confirmed absent from the report, ceiling now 100% → 70% is REACHABLE. Gap to 70% =
  +12,419 covered instr. NOTE: trimming only nudged 44.57%→46.01% (repos were ~42% covered) — the climb to
  70% is REAL happy-path work, NOT guard pins (guard pins yielded only +0.27%/8-tests). LOOP RE-ORIENTED:
  target the FAT non-repo classes and cover their HAPPY/MAIN bodies (where the missed instructions are), not
  just guard branches — HighlightConverter (1036, build a DataEntityDetailsDto), notification translators/
  generators (Slack/Alert, pure-ish formatting), facet/term/genai/attachment services (happy paths), thin
  controllers via @WebFluxTest. PLATEAU-PING re-armed: if even the happy-path business-logic climb stalls
  (<~0.5%/iter over ~3 re-measures) short of 70%, STOP + PushNotification WITH THE FULL ANALYSIS (maintainer
  wants the analysis delivered in the ping, not a headline — memory feedback_ping_at_plateaus_with_analysis).

## Skipped (candidate + why it can't be faithfully pinned at the unit level — for the morning report)
- DateTimeUtil (service/ingestion/util — UTC/epoch conversion, UNtested, pure + high-value: mapUTCDateTime
  both directions + mapEpochSeconds, all null-safe). Genuinely worth pinning (timezone correctness is a
  classic silent-bug class) BUT it is cross-cutting infrastructure with NO feature gate and NO UTC-norm ADR
  (ADR-0058 is soft-deletion, not UTC). Deferred under "confirmed gates only" — author once a UTC/timestamp-
  normalization ADR exists to @enforces (or if the no-orphan rule is relaxed for pure-util correctness pins).
- PLT-131 (owner getDto soft-deleted) — method-scoped; needs to diff getDto vs list filter, and OWNER
  hard-deletes muddy the invariant. Revisit as integration.
- PLT-054 Slack signature-verification (F-038 H-002) — 3rd aspect of an already-pinned bug + absence pin (verification could live in parser/filter); fragile, skipped.
- F-021 H-011 audit-survives-hard-delete (INNER join drops rows) — genuine bug but no tracker id for a clean @pins; revisit when filed, or as integration.
- EnumValueServiceImpl — DEDUP: already covered by an existing `EnumValueServiceTest.java` (not `*ImplTest`); not re-authored.
- DatasetStructureServiceImpl / DataEntityFilledServiceImpl / DataEntityInternalStateServiceImpl — guards=0 pure-delegation services (no error/branch logic); a unit test would only re-assert the mock (test-theatre). Deferred — these are exercised by their callers' tests + integration.
- DirectoryServiceImpl (F-? directory tree) — REAL untested gap (existing `DirectoryTest.java` does NOT reference the impl). 10 guards / 4 deps — good behavioral candidate; queued for a later iter (not skipped permanently).
- DataEntityLookupTableServiceImpl (F-026 lookup-table data-entity linkage) — create/update methods are mapping-heavy reactive PIPELINES (mapCreatedLookupTablePojo → create → generateOddrn → updateSearchVectors → update → createVersion; createOrUpdateLookupDatasetField builds JSONB type maps + version-with-fields), not clean NotFound/branch guards. A faithful unit test would stub the entire create chain = test-theatre; better covered by integration. Deferred. (LineageServiceImpl + DataSourceIngestionServiceImpl already have existing tests — dedup, not re-authored.)
- RelationshipsServiceImpl (ERD/GRAPH dataset relationships) — has 2 genuinely clean pins (getERDRelationshipById / getGraphRelationshipById on a missing id → NotFound via switchIfEmpty), BUT there is **no feature gate** for it: the ERD/GRAPH "Relationships" surface is NOT in `feature-flows/detail` (searched name/contributing-nodes for relation/erd/diagram → no dedicated F-NNN). This is an ONTOLOGY GAP (a real, navigable UI feature with no extracted Feature node), not a test gap. Per the loop's "confirmed gates only / no orphans" rule, NOT authored with a fabricated gate. Action: model the Relationships feature (assign an F-NNN) in feature-flows, THEN author these pins with @validates that id. Same applies to any other unmodeled-feature service surfaced later.
