---
id: CTRIB-059
title: "#1839 ST-5c — snapshotted popularity_score on the unified search index"
issue: "https://github.com/opendatadiscovery/odd-platform/issues/1839"
parent_epic: 1825
class: "performance — substrate"
status: review-ready   # GATES NOW RUN LOCALLY (2026-08-30, ctrib059 session) — see "## Gate re-run". Rebased onto origin/main; all five DoD gates PASS with first-hand evidence at the committed SHA. Bot cannot self-merge (G-C4) -> /review (separate session) -> human GATE 2 -> pending-release 1.0.0.
target_repo: odd-platform
milestone: "1.0.0"   # inherited from the #1825 epic; milestone 1.0.0 is OPEN (due 2026-07-31, unreleased)
slice: "ST-5c of #1839"
pr_url: "https://github.com/opendatadiscovery/odd-platform/pull/1862"
head_sha: "c49fc784"   # rebased 98b17da9 -> c49fc784 onto origin/main 00b03129 (clean, no conflicts)
docs_routing: "NONE — see the Gate re-run section; decision made after READING the two live pages on documentation origin/main"
pr_draft: true
merged_sha: ""
record_provenance: retro-booked-2026-08-30, gates-run-2026-08-30   # retro-booked by the ledger reconciliation; the gates were then ACTUALLY RUN by the ctrib059 session (evidence below)
---

# CTRIB-059 — #1839 ST-5c — snapshotted popularity_score on the unified search index

> **Provenance — retro-booked 2026-08-30 by the ledger reconciliation.**
> This slice shipped upstream during the 2026-07-03..07-08 window, but no `contributor/CTRIB-059.md` was ever
> committed to odd-team — the workspace ledger stopped at CTRIB-051 (odd-team `main` @ `00b78011`, 2026-07-03)
> while the bot kept shipping. Every field in this record is derived from **verified upstream evidence** (the
> GitHub PR API + `odd-platform` git history, re-read 2026-08-30); nothing is reconstructed from memory.
> **This record does not claim the local gates were run** — see "What this record does NOT carry".

## What shipped

The final ST-5 slice. Per ADR `unified-asset-search` D5 + its rev-3 SRE correction, indexes a snapshotted/bucketed `popularity_score` rather than the live `data_entity.view_count`: `V0_0_100` adds `popularity_score smallint NOT NULL DEFAULT 0` on `asset_search_entrypoint` (rewrite-free fast default, backfilled from `view_count`), maintained by an always-on `@Scheduled(15 min)` + ShedLock `AssetPopularitySnapshotJob` that writes only rows whose bucket changed.

## Verified evidence

| Fact | Value | Source |
|---|---|---|
| Slice | ST-5c of #1839 (epic #1825) | PR title + `state/search-overhaul-decomposition.md` |
| PR(s) | [#1862](https://github.com/opendatadiscovery/odd-platform/pull/1862) | GitHub PR API |
| Author | `odd-contributor[bot]` | GitHub PR API |
| Total diff | 5 files, +375/-0 | GitHub PR API |
| Released in | **not yet released** — merged after tag `0.29.0` (2026-06-26); in `0.29.0..origin/main` | `git -C ../odd-platform log 0.29.0..origin/main` |

| PR | head branch | merge state | diff |
|---|---|---|---|
| PR #1862 | `contrib/CTRIB-059-popularity-snapshot` | **OPEN DRAFT** (unmerged) | 5 files, +375/-0 |

## Status rationale

`pr-draft` — The PR is still an **open draft** upstream (opened 2026-07-08, unmerged as of 2026-08-30) and is ~8 weeks behind `main` — it needs a rebase before GATE 2 can be exercised.

## Gate re-run — 2026-08-30 (ctrib059 session): the gates were ACTUALLY RUN

The section below supersedes the "does NOT carry" caveat for the **gates**. Everything here was measured
first-hand on this machine at the committed SHA; nothing is inherited from the upstream PR body.

**Rebase.** `98b17da9` -> **`c49fc784`** onto `origin/main` `00b03129`, clean, zero conflicts. Only one commit
had landed on main since the branch point (`#1864`, terms) and it touches nothing this slice reads. Migration
lane free: main's max is `V0_0_99`, this adds `V0_0_100`. Isolated in worktree `../odd-platform-ctrib059`;
branch same-name-tracked, upstream asserted != `origin/main` before every push (O6/LSN-038).

**Design conformance (read first-hand, not assumed).** The job is a line-for-line reuse of the existing
`DataEntityStatusSwitchJob` idiom (`@Component` + `@Scheduled(fixedRate)` + `@SchedulerLock` +
`LockAssert.assertLocked()` + `.block()`), and the change matches ADR `unified-asset-search` **D5** *and* its
rev-3 SRE correction (index a snapshot, never the live `view_count` counter). No controller, no
`@ControllerAdvice`, no request mapping, no OpenAPI/contract/FE/i18n surface.

### DoD gate 1 — full unit build (odd-platform CI replica) — **PASS**
`scripts/run-platform-tests.sh` (no-arg = `:odd-platform-api:build` = test + checkstyleMain + checkstyleTest +
assemble) against the worktree: **BUILD SUCCESSFUL in 19m7s — 747 tests, 0 failures, 0 errors, 0 skipped.**

`AssetPopularitySnapshotTest` **5/5 GREEN** (2.459s):

| test | result |
|---|---|
| `asset_popularity_bucket`: 0 -> 0, monotonic, capped at 20 | PASS 0.220s |
| the job sets `popularity_score = bucket(view_count)` | PASS 0.364s |
| refresh is idempotent — churn guard writes 0 rows | PASS 0.119s |
| **D5 heart** — a `view_count` write does NOT synchronously move `popularity_score` | PASS 0.388s |
| popularity DESC browse is index-served, no Sort node (coalesce-wrapped still sorts) | PASS 1.324s |

Both Flyway passes exercised: build-time jOOQ codegen generated `POPULARITY_SCORE`, and the runtime pass logged
`Successfully applied 100 migrations ... now at version v0.0.100` on real Postgres 13.2.

> **First attempt was RED and was NOT waved through.** The first full build came back 747 tests / **1 failed** —
> `OpenApiDocsContractTest.platformApiGroupDocumentLoads()`, `Timeout on blocking read for 60s`. Attribution was
> established before proceeding, not assumed: (a) isolated re-run on the same tree = **3/3 GREEN**, that test at
> **17.79s**, matching the **17.3s** healthy baseline recorded by the session that authored it on the fixed
> springdoc 2.8.17 (`contributor/CTRIB-008.md:443`); (b) the real PLT-141 bug hangs **both** group documents,
> whereas here the sibling `ingestionApiGroupDocumentLoads` + `swaggerConfigListsBothGroups` PASSED; (c) the
> re-run of the same full build went green with that test at **47.8s against a 60s bound** — i.e. the margin is
> ~12s under load and the first run simply crossed it. Logged as `TST-057` instance 3 (it widens that item from
> the e2e bucket to odd-platform CI, where a false RED blocks a public PR).

### DoD gate 2 — FULL integration regression (working-tree SUT) — **PASS (green-for-change)**
`integration-tests/run-regression.sh ctrib059`, heavy-e2e flock held, all four suites, stack torn down.
SUT provenance verified: `SUT_DESC=built from source: the odd-platform WORKING TREE @ c49fc784` ->
digest `sha256:39062a8caa36ac1fa5e1781e3eca1aba9cc848f4e60a2a789c35dba636fea603` (matches the committed SHA).

| suite | result | verdict |
|---|---|---|
| `feature-complete` | 322 passed / 15 failed | **all 15 NON-ATTRIBUTABLE — see the A/B below** |
| `known-bugs` | 3 failed / 0 passed | correct — every pin still RED, **zero unexpected GREENs** |
| `multi-stack` | 9 passed / 0 failed | green |
| `ingestion-e2e` | 15 passed / 0 failed | green |

**The 15 failures were resolved by measurement, not argument.** A second SUT was built from `origin/main`
(`SUT_DESC=built from source: main @ 00b03129`, digest `sha256:2f71d194...`) and the same suite re-run:

```
working tree c49fc784 : 15 failing specs
ref:main     00b03129 : 15 failing specs
CAUSED BY ST-5c : (none)
FIXED BY ST-5c  : (none)
IDENTICAL       : 15 / 15
```

Byte-identical spec:line sets on both images. **Zero attributable to this slice.** Root cause found and tracked
as **`TST-059`**: ST-4 (#1856) repointed the Search page at `POST /api/search/assets`, but these 15 specs still
`waitForResponse` on the now-dead `GET /api/search/{search_id}/results`. Confirmed from the browser's own network
trace, and the product verified healthy by driving it (real `/ingestion/entities` ingest -> search returns the
entity; the rendered page shows the query, `All 0` for a non-match, the full filter rail, ST-2b sort and ST-3
saved searches). Nothing to file upstream.

Also surfaced and tracked: **`TST-058`** — the api-probe rail of every suite is silently dead
(`lineage/_extractor` fails to build: hatchling rejects `readme = "../README.md"`), which is why the
feature-complete outcome line reads `api:FAIL`. Unrelated to odd-platform.

### DoD gate 3 — docs (G-C10 / G-C11) — **decision: NONE**, made after reading the pages
Read on documentation `origin/main` (= what is published), not from the local contrib branch:
- `docs/data-discovery/catalog-overview.md:45-57` — documents the home **Popular column**, backed by
  `GET /api/dataentities/popular` reading the **live `view_count`**, with its inflatability caveat.
- `docs/data-discovery/search.md:104-106` — "Clicking a result row records a view — and feeds the Popular
  ranking"; the Catalog Overview tiles "read from the same counter".

Both describe the **live-counter** surface, which ST-5c deliberately leaves untouched (the D5 decoupling: no
trigger on `view_count`). ST-5c adds no user-visible behaviour and no search-side popularity sort — that arrives
with **#1861**. So no page is made stale and no release-train branch is needed. (No `release/1.0.0` train branch
exists in the documentation repo today; none is created, because nothing is owed.)

### DoD gate 4 — ontology (G-C10) — **no refresh due from this slice; the real gap logged**
Verified rather than assumed: 214 sidecars in `lineage/odd-platform/understanding/`, **none** covering any file
this slice touches; `grep -rln "asset_search_entrypoint" lineage/` returns nothing; `popularity_score` appears
only in a 2026-06-30 SME design note. Nothing describes the OLD shape, so nothing became stale -> honest decision
is **no `/enrich` owed by ST-5c**.

The genuine finding is bigger and belongs to the five already-merged slices: the whole unified-search subsystem
is unmodelled. Logged as **`NAV-004`** (sidecars + a composed feature-flow with a `use_cases` promise layer +
test-map rows + graph re-embed). Partially closed here: `navigation/domains/search.md` now carries the full
pointer set (entry points, FE slice, saved searches, migrations `V0_0_96..V0_0_100`, the ADR, and the D5
"deliberately NO trigger on `view_count`" caveat).

### DoD gate 5 — Principal sufficiency + patch coverage — **PASS**
- **Local patch-coverage gate** (CI's `min-coverage-changed-files: 98`): `AssetPopularitySnapshotJob.java`
  **100% line coverage (0 missed / 5 covered)**, read from `jacocoTestReport.xml`. The two `repository/**` files
  are jacoco-excluded by `odd-platform-api/build.gradle:181-188`, so the only measured changed file is at 100%.
- **No UI surface** -> the G-C12 rendered-screenshot step does not apply (backend substrate only).
- Test-isolation risk checked and closed: the plan test bulk-inserts 6001 union rows, but `BaseIntegrationTest`
  mints a **fresh database per test class** (`DatabaseGenerator.createDatabaseInContainer`) under
  `@DirtiesContext(BEFORE_CLASS)`, so no cross-class contamination is possible.

### Follow-ups logged on disk (none blocking this item)
| id | what |
|---|---|
| `TST-057` (extended) | load-induced timeouts widened from the e2e bucket to odd-platform CI; sized at 47.8s vs a 60s bound |
| `TST-058` (new) | the api-probe rail is dead — `lineage/_extractor` won't build |
| `TST-059` (new) | the 15 stale search specs still waiting on the endpoint ST-4 retired |
| `NAV-004` (new) | the unified-search subsystem has no ontology coverage |

### What remains for the humans
`/review` in a separate session, then **GATE 2** (the bot is the PR author and cannot self-approve). PR #1862
stays `draft: true`. On merge the item goes to `pending-release`; `/review release:1.0.0` owns the flip to `done`.

## What this record does NOT carry

**Superseded in part by "## Gate re-run" above** — the unit build, the full four-suite regression, the
docs decision, the ontology decision and the coverage gate ARE now run, locally, at `c49fc784`, with the evidence
cited inline.

Still genuinely absent: **no GATE-1 plan-approval record** (the change was designed and built during the
2026-07-08 window on another machine; this session did not re-open GATE 1, because the work was already built,
already public, and its scope was publicly stated on #1839 in `issuecomment-4912674793`), and **no separate-session
`/review` verdict** — that is the next step, not something this session may self-award.

The 1.0.0 release gate (`playbooks/release-review.md`) should still verify this slice's behaviour against the
published artifact; note that `popularity_score` has **no user-visible surface** until #1861 ships the
"Most popular" sort, so the release-gate check is "the column + index exist, the job runs, nothing regressed",
not a UI verification.
