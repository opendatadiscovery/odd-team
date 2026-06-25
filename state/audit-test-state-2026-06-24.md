# Independent Test-State Audit — odd-platform @ `origin/main` `8e5b3339` (2026-06-24)

> Auditor session: AI-assisted Claude Opus 4.8. Mandate: run the full integration suite (e2e +
> feature-complete + ingestion) against the **current latest main** of odd-platform, investigate
> issues, fix nothing — establish the real state of tests. This file is the durable handoff so the
> work can resume after a 5–6h offline gap. **Nothing in odd-platform or the suites was modified.**

## TL;DR verdict

**On `origin/main` @ `8e5b3339`, the integration suite is a CLEAN PASS** — every green-target lane 100% green,
the 3 quarantined known-bugs still red-by-design, zero regressions from the two commits that merged since
yesterday's runs. The headline regression-closure (CTRIB-031 `.unwrap()` fix) is **confirmed flipped green on main**.

| Bucket / lane | Result on `8e5b3339` | Verdict |
|---|---|---|
| **Integration · feature-complete** | **313 passed / 0 failed** (5.8m) + api probe P-001 PASS | ✅ GREEN |
| **Integration · multi-stack** | **9 passed / 0 failed** (3.5m) | ✅ GREEN |
| **Integration · ingestion-e2e** (IT-128) | **6 passed / 0 failed** (58s) | ✅ GREEN |
| **Integration · known-bugs** (IT-004/006/007) | **3 failed / 0 passed** | ✅ RED-by-design, 0 unexpected-green |
| **Unit · `odd-platform-api:build`** (gradle + Testcontainers + checkstyle + JaCoCo) | **BUILD SUCCESSFUL · 604 tests · 0 fail/err/skip** · line 51.5% / branch 43.9% | ✅ GREEN |

Integration tally: **328 green e2e cases / 3 expected-red / 0 unexpected**. Per the tests-pillar rule
("clean PASS = every green-lane test green + known-bugs still red") this is a clean pass.

## Why this run was worth doing (not a re-run of yesterday)

**None of the 2026-06-23 run-logs tested current main.** Every yesterday entry ran against a per-contributor
*stream* SUT (`odd-team-sut-ctrib030/031/032/033`), each = "origin/main-at-the-time (`c7f14fc5`) + an unmerged fix."
Since then two of those fixes merged to main:

- `56480919` (#1766 ARM-2 / #1801, CTRIB-031) — appends `.unwrap()` to ~13 thunk-arm `.tsx` consumers so a refused
  destructive confirm no longer closes-as-success / navigates-away. This was the fix whose 2 tests were yesterday's
  **only** feature-complete failures ("309 passed / 2 failed … fix isn't in main yet").
- `8e5b3339` (#1769/#1804, CTRIB-033) — reference-data column write-guard + name-collision 400. Current HEAD.

This audit is the **first** run against `8e5b3339`, so it answers: did the merged fix flip those 2 tests green, and
did the 2 newly-merged commits regress anything? (Answers: **yes** and **no**.)

## Evidence (verified, cited)

- **SUT built from main**: `build-sut.sh ODD_SUT=main` → `SUT_DESC=built from source: main @ 8e5b3339`,
  image `odd-platform:odd-team-sut-audit` digest `sha256:353a5b06a54f…`. Both rails (api-probe + ui-e2e) ran against it.
- **Regression-closure CONFIRMED**: `confirmation-dialog-thunk-arm.spec.ts:32` (datasource delete) and `:91`
  (term delete) both **✓ green** on main. These were RED yesterday on the pre-`#1801` stream SUT.
- **Flakes did NOT bite**: IT-107 `direct-bind-create` (TST-054 flake) ✓✓✓; IT-012 `notifications-wal-failover`
  (PLT-139 flake) ✓. No retry was needed.
- **`#1804` reference-data guard blast radius — clean**: `lookup-tables-rdm.spec.ts` UC-007 (collision→400),
  UC-010 (cross-table PATCH→400), UC-011 ("new defect-b twin" DELETE→400) all ✓; all lookup-rename/listing specs ✓.
- **Known-bugs nature** (all 3 stayed red; counts correct, but the *reasons* differ — an auditor distinction):
  - **IT-004** `quality-dashboard-unknown-status` (PLT-052) — **genuine repro**: `palette.runStatus["WARNING"]` is
    undefined and `.color` throws before the `??` fallback (`DataQualityContent.tsx:47-48`). Real open bug.
  - **IT-006** `error-boundary-containment` (TEST-GAP-1013 / F-042) — **genuine repro**: `#root` empties on a
    malformed dashboard payload; no React error boundary anywhere in odd-platform-ui → total white-screen. Real open bug.
  - **IT-007** `attachment-local-durability` (LSN-001 / PLT-086) — **RED for a HARNESS reason, not a repro**: it errors
    `recreatePlatformContainer(): not supported against an external stack` because `run-suite.sh`/`run-regression.sh`
    always set `ODD_STACK_EXTERNAL=1`. So under the standard runner IT-007 cannot demonstrate its data-loss bug; it just
    can't run its mechanism. The bug itself is real & separately pinned, but **this test's red ≠ evidence of the bug**
    in suite context. → FINDING #1 below.

## Test-fabric inventory (4 distinct layers — the real "state of tests")

| # | Layer | Where | Size on main | CI-gated? |
|---|---|---|---|---|
| 1 | **Backend Java unit + in-process integration** (Mockito/StepVerifier + `BaseIntegrationTest` Testcontainers) | `../odd-platform/odd-platform-api/src/test` | **149 test classes / ~466 `@Test`** | ✅ **YES** — `run-pr-tests.yaml` runs `./gradlew odd-platform-api:build` on every PR |
| 2 | **Frontend unit** (vitest) | `../odd-platform/odd-platform-ui/src/**/*.test.tsx` | **16 files** | ❌ **NO** — only ref is a commented-out `# npm run test:ci` (FINDING #2) |
| 3 | **odd-platform-native Playwright e2e** | `../odd-platform/tests/` | **8 specs** | ⚠️ **PARTIAL** — `run-playwright-tests.yml` runs lint+format+image-build only; the actual `# Run Playwright tests` step is commented out (FINDING #2) |
| 4 | **odd-team integration suite** (this workspace; Playwright e2e + API probes) | `integration-tests/` | **138 protocols / 137 specs / 192 probe defs** | ◻ By design **maintainer-run locally** (`run-suite.sh` / `run-regression.sh`), NOT in odd-platform CI |

Layer 4 (what this audit ran) is by far the deepest e2e coverage and is the workspace's purpose-built fabric.
The **only automated gate on an odd-platform PR is layer 1** (backend gradle build). Layers 2 & 3 exist but are
dormant in CI.

## Auditor findings (no fixes applied — logged here for triage)

1. **IT-007 cannot characterize its bug under the standard suite runner.** It fails on the external-stack guard, not on
   the data-loss. The known-bugs lane is still correctly red (3/3, 0 unexpected-green), but IT-007's red is not bug
   evidence. Consider: (a) a runner path that lets IT-007 manage its own non-external stack, or (b) reclassify so the
   regression signal isn't a false-equivalent. (Pre-existing; not introduced by this run.)
2. **CI gating gap: FE unit (vitest, 16 files) + native Playwright e2e (8 specs) are NOT executed in CI** — both are
   commented-out in `.github/workflows/run-playwright-tests.yml` (lines 62-77) and the sonar workflows. They run only
   on a developer's machine. So FE regressions are caught only by the odd-team layer-4 suite (local) or by review, not
   by an automated PR gate. (Verified by reading the workflow, not inferred.)
3. **The coverage dashboards lag HEAD.** `lineage/odd-platform/alignment-scorecard.md` is dated **2026-06-18** (substrate
   scan `e67461de`; HEAD is many commits past). `lineage/odd-platform/promise-test-worklist.md` is dated **2026-06-04**
   (frontier "97/1306 = 7%"). Both are explicitly point-in-time, but a reader wanting "current coverage %" has no freshly
   regenerated number. Scorecard dimension **D (Test-Traceability Ledger) = RED**: 49/112 features have a validating
   test/gate, 41/1361 findings have a regression guard, 9/192 probes executed. (Regenerate via
   `lineage-extractor alignment odd-platform` to get a HEAD-current number — deterministic, no LLM.)
4. **Unit-test gating is ledger-based, not in-source.** 0 Java test files carry an in-source `@validates/@enforces/
   @pins/@regresses` annotation; the gate↔test linkage lives entirely in `lineage/odd-platform/test-gates.yaml`
   (~291 gate lines). Legitimate per the pillar, but it is a manual-sync surface.
5. **Verbose test logging.** The unit `test` profile logs r2dbc parameter binding at DEBUG — the run log ballooned past
   ~47 MB of `Bind parameter [...] to: FAILED` lines (where `FAILED` is DQ-run-status *data*, not failures). Harmless,
   but it makes the raw gradle log unreadable; rely on the JUnit XML, not the console log.

## Integrity checks that PASSED (the pillar's own rules hold)

- **0 `@Disabled` / `@Ignore`** in the odd-platform test tree — the "never disable a test" rule is genuinely upheld.
- **Known-bug pins flip-on-fix**: the 2 scorecard-listed pins missing on main (`ActivityActorFilterKnownBugTest`,
  `AttachmentLinkSchemeKnownBugTest`) were **renamed as their bugs got fixed** (→ `ReactiveActivityRepositoryActorFilterTest`,
  folded into `LinkServiceImplTest`); `MinioConfigRegion` even has a dedicated `MinioRegionUnsetRegressionPinTest` (LSN-002).
- **Integration known-bugs are real & tracked** (PLT-052, F-042/TEST-GAP-1013, LSN-001/PLT-086) — not blind rotting tests.

## Unit result — COMPLETE (BUILD SUCCESSFUL, finished 20:21)

`scripts/run-platform-tests.sh` (= `./gradlew :odd-platform-api:build -PbundleUI=false`) → **BUILD SUCCESSFUL**.
**604 tests · 0 failures · 0 errors · 0 skipped** (146 JUnit suites) — main passes its own PR CI gate cleanly.
**JaCoCo** (hand-written code; generated excluded): **LINE 51.5% · INSTRUCTION 51.1% · BRANCH 43.9% · METHOD 50.2% ·
CLASS 65.6%** — clears the 50% CI floor, but *only just* (a modest bar; branch coverage ~44%). This is a real
"state of tests" data point: the backend gate is a low coverage bar. **Wall-clock note:** gradle reported
"BUILD SUCCESSFUL in 10h 48m 49s" (09:32→20:21) = real time across the host's offline/suspend window, NOT compute —
the 604 tests were observed executing in minutes at launch. Not a performance finding.

Durable artifacts / how to re-read on resume (do NOT read the ~47 MB+ console log — it is r2dbc DEBUG spam):

```
# verdict + counts (authoritative):
grep -h 'tests=\|failures=\|errors=\|skipped=' ../odd-platform/odd-platform-api/build/test-results/test/*.xml | head
#   or just:  cat ../odd-platform/odd-platform-api/build/reports/tests/test/index.html | grep -i 'success\|failed'
# coverage % (the 50% CI floor is enforced by the Madrapps action, not by gradle):
ls ../odd-platform/odd-platform-api/build/reports/jacoco/test/jacocoTestReport.xml   # parse <counter type="LINE"/> etc.
# the run's own console (volatile scratch, may be huge / may not persist across session):
#   scratchpad/audit-unit.log  → grep -a 'BUILD SUCCESSFUL\|BUILD FAILED' (ignore the r2dbc DEBUG spam)
```

Result: **BUILD SUCCESSFUL**, as expected — main is the tip of a repo whose PR gate is exactly this build.

## What is pending to FINALIZE the audit (resume checklist)

1. ✅ DONE — unit BUILD SUCCESSFUL, 604/0/0/0, line 51.5% / branch 43.9% (in the TL;DR + Unit-result section).
2. ◻ (optional, low) Annotate today's 4 run-log entries `integration-tests/run-log/2026-06-24-{feature-complete,known-bugs,multi-stack,ingestion-e2e}.md`
   with proper provenance (they were written with `runner: (fill: …)` template stubs by `run-suite.sh`). This is MY run's
   own records — appropriate to fill; NOT retro-editing anyone else's entry.
3. ◻ (optional, medium) Triage findings #1–#5 above into the backlog/issues if the maintainer wants them tracked beyond
   this doc. Per CLAUDE.md "follow-up on disk", findings #1 (IT-007 runner) and #2 (CI gating gap) are the strongest
   candidates. **Not done yet — the mandate was "investigate, don't fix."**
4. ◻ (optional, medium) Regenerate the alignment scorecard against HEAD for a current coverage number (`lineage-extractor
   alignment odd-platform`).

## Reproduce this exact audit run

```
cd <workspace>            # odd-team
# integration (the headline): builds origin/main fresh, runs all 4 lanes serialized under the heavy-e2e lock, tears down
ODD_SUT=main ODD_PLATFORM_DIR=<path>/odd-platform \
  integration-tests/run-regression.sh audit feature-complete known-bugs multi-stack ingestion-e2e
# unit (the CI gate): SUT-agnostic, compiles the working tree (= main)
scripts/run-platform-tests.sh
```

Durable result artifacts (survive the session): `integration-tests/run-log/2026-06-24-*.md` (4 lane entries),
`lineage/odd-platform/probe-runs/2026-06-24-P-001.yaml` (api probe trace),
`../odd-platform/odd-platform-api/build/{test-results,reports}/…` (unit XML/HTML/JaCoCo).

## Working-tree state at audit time (informational)

- odd-platform: on `main` @ `8e5b3339` == `origin/main` (verified `git rev-list --left-right --count` = 0/0). Dirty:
  only `docker/demo.yaml` (M) + `docker/demo.override.yaml` (??) — runtime compose files, NOT in the Jib image or the
  Java unit build, so irrelevant to every result here.
- odd-team: pre-existing untracked/modified files from prior sessions (probe-run yaml, run-log entries, PLT-241, locks).
  This audit added: this file + the 4 run-log entries (via the runner) + the P-001 probe-run trace + sidecar probe stamps.
