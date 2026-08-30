---
id: CTRIB-059
title: "#1839 ST-5c — snapshotted popularity_score on the unified search index"
issue: "https://github.com/opendatadiscovery/odd-platform/issues/1839"
parent_epic: 1825
class: "performance — substrate"
status: review-ready   # REVIEW ACCEPTED 2026-08-30 (session review-ctrib059) — see "## Review". Every gate re-verified first-hand at c49fc784: reviewer's own unit build 747/0 + own four-suite regression on a FRESH reviewer SUT (321/16 feature-complete, ALL 16 change-independent and proven so by a cold ref:main A/B; known-bugs 3-RED with zero unexpected GREENs; multi-stack 9/0; ingestion-e2e 15/0) + running-instance checks (shedlock row, no view_count trigger, D9 legacy search 200). Terminal state for a passing CTRIB item: bot cannot self-merge (G-C4) -> human GATE 2 -> pending-release 1.0.0 -> /review release:1.0.0 owns done.
target_repo: odd-platform
milestone: "1.0.0"   # inherited from the #1825 epic; milestone 1.0.0 is OPEN (due 2026-07-31, unreleased)
slice: "ST-5c of #1839"
pr_url: "https://github.com/opendatadiscovery/odd-platform/pull/1862"
head_sha: "c49fc784"   # rebased 98b17da9 -> c49fc784 onto origin/main 00b03129 (clean, no conflicts)
docs_routing: "NONE for this slice's own diff (the two Popular-column pages were READ on documentation origin/main and neither is made stale — D5 leaves the live-view_count path untouched). AMENDED BY REVIEW 2026-08-30: docs ARE owed at 1.0.0 for the additive half (this is the platform's 5th @Scheduled job and the other four all carry an operator-manual entry) — filed with full epic scope as backlog/docs/DOC-499.md (milestone 1.0.0), so playbooks/release-review.md check 1 must clear it before 1.0.0 publishes. Paired ADR-log gap: backlog/adr/ADR-0080.md."
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

## Review (2026-08-30, session: review-ctrib059)

- **Result**: **ACCEPTED** — every gate PASSes with first-hand evidence at the reviewed SHA `c49fc784`. The item
  stays `review-ready`: the bot authored PR #1862 and cannot self-approve (G-C4), so **human GATE 2** owns the
  merge, then `pending-release` → `/review release:1.0.0` owns `done`.
- **Session boundary**: fresh session; `/implement` was the prior ctrib059 session (odd-team `e137cd64`, 18:57).
  Self-review gate satisfied.
- **Cheap precondition (the 2-minute bounce)**: NOT triggered. The item's DoD records all five gates as RUN at the
  committed SHA with no "NOT RUN"/deferred admission, and an integration run-log exists whose SUT digest matches.
  The runs below are the *confirmation* of gates implement already passed, not their first execution.

### Reviewed subject (verified, not assumed)

| fact | value | how verified |
|---|---|---|
| worktree | `../odd-platform-ctrib059` @ `c49fc784`, **clean**, exactly 1 commit ahead of `origin/main` `00b03129` | `git status` + `git log` + `git merge-base` |
| diff | 5 files, **+375/−0**; no file modified except the 2 additive repository files | `git diff --stat origin/main...HEAD` |
| PR #1862 | head SHA == `c49fc7840a8be8d757083b2658e643461f09523c`, `draft: true`, author `odd-contributor[bot]`, base `main` `00b03129`, 5 files +375/−0 | GitHub PR API |
| upstream CI at that SHA | **6/6 SUCCESS** — `run_tests`, `Test Results`, `run_playwright_tests/{test,lint,format-check}`, `update_release_draft` | GitHub check-runs API |
| rebase delta | the old base was `a1a4988e` (ST-5b) and `origin/main` is `00b03129` (#1864, terms) whose parent IS `a1a4988e` — exactly ONE intervening commit, touching only `ReactiveTermRepositoryImpl` / `TermRelationsRepositoryImpl` / `TermRepositoryTest` / `TermDetailsTabs.tsx` | `git show --stat 00b03129` |
| milestone (G-C11) | issue **#1839** and epic **#1825** both carry the **OPEN** milestone `1.0.0` (semver, due 2026-07-31) | GitHub issues API |

### Acceptance criteria (the ST-5 scope this slice owns — `state/search-overhaul-decomposition.md:115`)

- [x] **`popularity_score` column on the union index** — PASS. `V0_0_100` adds `popularity_score smallint NOT NULL
  DEFAULT 0`; confirmed on a **live** instance: `\d asset_search_entrypoint` shows the column and
  `asset_search_entrypoint_popularity_idx btree (popularity_score DESC NULLS LAST, asset_kind, asset_id DESC)`
  (psql on the running reviewer SUT).
- [x] **The snapshot job** — PASS. `AssetPopularitySnapshotJob` is a line-for-line reuse of the
  `DataEntityStatusSwitchJob` idiom (compared side by side); `SchedulingConfiguration` supplies `@EnableScheduling`
  + `@EnableSchedulerLock` + a `JdbcTemplateLockProvider`, so the wiring is real, not decorative. **Proven on the
  running instance**: the `shedlock` table carries `assetPopularitySnapshotJob` `locked_at 18:32:57 →
  lock_until 18:46:57` (exactly the declared 14-minute window) beside `housekeepingJob` / `statusSwitchJob`.
- [x] **Index-served popularity ordering** — PASS. `popularitySort_isServedByIndex_noSortNode` EXPLAINs the real
  planner output over 6001 seeded rows and asserts `asset_search_entrypoint_popularity_idx` + `doesNotContain("Sort")`,
  with a **negative control** (the `coalesce()`-wrapped ORDER BY *must* Sort) — a self-contained oracle, so a
  trivially-passing assertion is ruled out.
- [x] **ADR D5 conformance (snapshot, never the live counter)** — PASS, read first-hand:
  `adrs/drafts/unified-asset-search.md:59` D5 carries the "**rev-3 SRE correction**: denormalise a snapshotted /
  bucketed `popularity_score` … **NOT the live `view_count`**", and
  `adrs/drafts/research/unified-asset-search/SEARCH-CAPABILITIES-DESIGN.md:139` is the "⚠ Correction to ADR D5".
  The implementation matches clause for clause, DE-scoped, non-DE rows at 0.
- [x] **The decoupling is real, not asserted** — PASS on the **live DB**: `pg_trigger` on `data_entity` lists only
  `data_entity_status_priority_trg` and `asset_search_entrypoint_de_sortcols_trg`, and
  `pg_get_triggerdef(...) LIKE '%view_count%'` is **false for both**. No trigger couples the counter to the index.

### Quality Bar

- **Gate 1 — No duplicates: PASS.** No pre-existing bucketing/popularity denormalisation exists — `grep` over
  `db/migration/` finds `asset_popularity_bucket` only in `V0_0_100`, and `V0_0_99`'s only "popularity" hit is a
  scope comment deferring it to 5c. The sync functions were checked for a competing writer: `V0_0_99`'s
  `ON CONFLICT … DO UPDATE SET` names four columns and **not** `popularity_score`, so the trigger path cannot
  clobber the snapshot.
- **Gate 2 — Aliases: N/A** (no published-doc change; no alias introduced).
- **Gate 3 — Caveats captured: N/A for this item's diff** (no doc page in scope). The caveats *are* captured where
  a maintainer meets them (the `V0_0_100` header + the job javadoc + `navigation/domains/search.md`'s
  "deliberately NO trigger on `view_count`"); the *published* operator caveat is owed at 1.0.0 and is now tracked —
  see Gate 6.
- **Gate 4 — Consumer-read: PASS.** Every runtime claim traced to the code that enforces it:
  the javadoc's "the housekeeping manager is opt-in" → `HousekeepingJobManager:18`
  `@ConditionalOnProperty(value = "housekeeping.enabled", havingValue = "true")`; "a fresh DE's union row takes
  DEFAULT 0" → the named-column `ON CONFLICT` above; the Popular-column claims → the FE/BE read path (below).
- **Gate 5 — Unset-parameter audit: N/A (no SDK builder), analogue run.** `@Scheduled(fixedRate = 15, MINUTES)` /
  `@SchedulerLock(name, lockAtLeastFor = 14m, lockAtMostFor = 14m)` are all set and consistent (lock window < rate).
  Unset and classified: `initialDelay` → *safely-defaulted* (first run at boot, right after the migration's own
  backfill, so it writes ~0 rows — and the live shedlock row proves that first run happened cleanly);
  `spring.task.scheduling.pool.size` → **absent platform-wide**, so Spring's single scheduler thread is shared by
  all five `@Scheduled` jobs — *pre-existing*, not introduced here (four jobs already share it), folded into DOC-499
  as an operator-doc clause rather than charged to this item.
- **Gate 6 — Bidirectional code ↔ doc: PASS (with the missing direction FILED, not narrated).**
  *Code → doc, staleness half:* verified by reading the two cited pages on documentation `origin/main` (`8599b84`),
  not from the local checkout — `data-discovery/catalog-overview.md` (the Popular column "ranked by view count
  alone" + its inflatability hint) and `data-discovery/search.md` ("Clicking a result row records a view — and feeds
  the Popular ranking"; the tiles "read from the same counter"). Both describe the **live-counter** surface that D5
  deliberately leaves untouched, so **neither is made stale**. The item's decision is correct on this half.
  *The additive half was NOT covered by that decision:* the change adds the platform's **fifth** `@Scheduled` job,
  and all four existing ones carry an operator-manual entry with cadence + lock posture + a caveat
  (`data-discovery/statuses.md:42`; `configuration-and-deployment/odd-platform.md:176`, `:846`, `:872`, `:916`).
  That gap is real but is **not this slice's to absorb**: it is one instance of a seven-slice epic gap, now filed
  with full cross-tree scope as **DOC-499** (`milestone: 1.0.0`), so `playbooks/release-review.md` check 1 must
  clear it before 1.0.0 publishes. Per this gate's own rule, a *filed* finding satisfies it; narration would not.
- **Gate 7 — Layout: N/A** (no SUMMARY/TOC/IA surface in the diff).
- **Gate 8 — Publishing standards: N/A for this item, PENDING-RELEASE for its docs.** The item authors no doc
  content, so there is nothing "parked as a draft with no train" to fail on. Confirmed there is **no
  `release/1.0.0` branch** in the documentation repo today (`git branch -r`: only `main` + `release/0.28.0`,
  `origin/main` @ `8599b84`) — the train is created lazily by whichever item first authors gated content
  (DOC-495/497 already hold authored, unpushed content). The owed 1.0.0 docs are DOC-499 + ADR-0080.
  **Amend `docs_routing:`** from the bare `NONE` to point at DOC-499 — the staleness read was right, but "nothing
  is owed" is not.
- **Gate 9 — Factual claim provenance: PASS.** Every load-bearing claim in the record was re-derived, none taken on
  trust: the 214-sidecar count (`ls | wc -l` → 214); `grep -rln "asset_search_entrypoint" lineage/` → **nothing**;
  `popularity_score` in lineage → only the 2026-06-30 SME note; the `17.3s` healthy springdoc baseline → really at
  `contributor/CTRIB-008.md:443`; both Flyway passes → my own build log carries
  `Successfully applied 100 migrations … now at version v0.0.100` **and** `POPULARITY_SCORE` in the generated
  `model/tables/AssetSearchEntrypoint.java` + `model/Indexes.java`; the SUT digests → the implementer's
  `39062a8c` image **contains** `V0_0_100` + `AssetPopularitySnapshotJob.class` while `2f71d194` (main) contains
  **neither**, so the A/B compared what it claimed to compare.
- **Gate 10 — Content-type homing: N/A** (code-only diff). The two follow-ups were homed by type on purpose:
  feature/operator pages → DOC-499; the ADR-log page → ADR-0080 (Cornerstone 5).
- **Gate 11 — Audience isolation: N/A** (the mechanical grep targets `documentation/docs/**`; no such file is
  touched). Two optional one-line polishes noted below.
- **G-C15 — changed-test danger zone: N/A.** No existing test was modified; `AssetPopularitySnapshotTest` is a new
  file (+235/−0) and no matcher, mock or `@Disabled` was introduced anywhere in the diff.
- **Patch coverage (CI's `min-coverage-changed-files: 98`): PASS, re-derived.** Parsed
  `jacocoTestReport.xml` myself: `AssetPopularitySnapshotJob` **0 missed / 5 covered = 100%**; the two
  `repository/**` files are excluded by `odd-platform-api/build.gradle`'s `jacocoExcludes`, so they are not in the
  report at all. Independently confirmed by upstream `run_tests` = SUCCESS (the coverage action runs inside that job).

### Regressions — the reviewer's OWN full run, both buckets, on a FRESH reviewer SUT

- **Unit (my own CI replica, not the implementer's):** `ODD_PLATFORM_DIR=../odd-platform-ctrib059
  scripts/run-platform-tests.sh` → **BUILD SUCCESSFUL in 23m 27s**; parsed from the JUnit XML rather than the
  console: **747 tests, 0 failures, 0 errors, 0 skipped**. `AssetPopularitySnapshotTest` **5/5 GREEN** (2.009s),
  including the D5-decoupling proof and the planner oracle. Matches the item's claim exactly.
- **Integration (fresh SUT built by me from the worktree — `SUT_DESC=built from source: the odd-platform WORKING
  TREE @ c49fc784`, image `sha256:bbe0d657…`, independent of the implementer's `39062a8c`):**
  `integration-tests/run-regression.sh revctrib059`, heavy-e2e flock held, all four suites, stack torn down.

  | suite | my result | implementer's | verdict |
  |---|---|---|---|
  | `feature-complete` | **321 passed / 16 failed** (32.1m) | 322 / 15 | 15 identical + 1 extra, **all change-independent** (below) |
  | `known-bugs` | **3 failed / 0 passed** — IT-004, IT-006, IT-007 | same | correct: every pin still RED, **zero unexpected GREENs** |
  | `multi-stack` | **9 passed / 0 failed** (10.0m) | same | green |
  | `ingestion-e2e` | **15 passed / 0 failed** (5.8m) | same | green |

- **The 15 shared failures**: byte-identical spec:line set to the implementer's, and their cause was re-verified
  independently — each waits on `/\/api\/search\/[0-9a-f-]+\/results/` (`catalog-search.spec.ts:31`,
  `search-url-state.spec.ts:25`, `search-result-row-click.spec.ts:28`, …), the GET that ST-4 retired from the
  Search page's client. The endpoint itself still exists (`openapi.yaml:1075` + `SearchController`), so this is
  spec staleness, not an API break — ADR D9 holds. Tracked as **TST-059**. The implementer's ref:main A/B was also
  re-checked at the artefact level (its `results.json` shows `expected 322 / unexpected 15` on the main-built SUT).
- **The 16th failure — resolved by measurement, and it is a NEW finding**:
  `swagger-openapi-discovery.spec.ts:63` (IT-042). Not waved through as "a flake":

  | run | SUT | result |
  |---|---|---|
  | `feature-complete` (warm suite) | reviewed `c49fc784` | RED at `:77` — both GROUP docs passed, the bare un-grouped doc exceeded the helper's **8s** bound |
  | `run-suite.sh IT-042` **cold, idle box** | reviewed `c49fc784` | RED **earlier**, at `:71` — even the first group doc exceeded 8s |
  | `run-suite.sh IT-042` **cold, idle box** | `odd-team-sut-ctrib059base` = `origin/main` `00b03129` | **RED identically at `:71`** |

  So it is **change-independent** (identical on an image proven to contain neither `V0_0_100` nor the job) and it is
  **not a load flake** — it is deterministically RED cold and green only once an earlier spec warms springdoc, i.e.
  an order-dependent test whose 8s bound sits below the cold document build (the unit bucket measures that build at
  17.8s idle / 47.8–58.5s loaded). Folded into **TST-057** as its fourth instance, with the A/B and a new
  integration-bucket AC. Nothing to file upstream: the platform serves both grouped documents — `OpenApiDocsContractTest`
  was 3/3 GREEN at this commit.
- **TST-057 confirmed and sharpened**: in my green build `platformApiGroupDocumentLoads()` took **58.5s against its
  60s bound** — a **1.5s** margin, thinner than the 47.8s the implementer measured. Recorded on TST-057.
- **TST-058 confirmed independently**: my run's api rail died the same way —
  `Call to hatchling.build.build_editable failed` — so `api:FAIL` on `feature-complete` is the dead probe rail, not
  odd-platform.

### Running-system verification (not the diff — the deployed artifact)

On a live stack from the reviewed image (`:18090`), with the main-built image (`:18091`) alongside:

- `shedlock` row `assetPopularitySnapshotJob` present, `locked_at 18:32:57 → lock_until 18:46:57` — **the job runs
  in a real deployment**, under the lock, on the declared window.
- `asset_popularity_bucket` exists with `provolatile = i` (IMMUTABLE) and `proparallel = s` (PARALLEL SAFE) exactly
  as declared; real values `bucket(0)=0, bucket(1)=1, bucket(1000)=9, bucket(2^63−1)=20` — monotonic and capped.
- No `data_entity` trigger references `view_count` (the D5 decoupling, checked against `pg_trigger`, not the diff).
- `POST /api/search/assets?size=5` → **HTTP 200** with the documented `AssetList` shape
  (`{"items": [], "page_info": {"total":0,"hasNext":false,"nextCursor":null}}`; empty because the stack has no
  ingested data), and legacy `POST /api/search` → **HTTP 200** — ADR **D9** (additive, no breaking change) verified
  on the running instance.

### Navigation

Consistent. `navigation/domains/search.md`'s new "Unified cross-kind Asset Search" section was spot-checked rather
than trusted: `AssetSearchController.java`, `SearchAssetResolver.java`, `AssetSearchCursor.java`,
`SavedSearchService.java`, `odd-platform-ui/src/lib/search/searchUrlState.ts` and
`components/Search/Results/SavedSearches/` all exist at the cited paths, and the five `redux/*/assetSearch.*` files
are present. The honest "no ontology coverage" caveat matches reality (verified above) and is tracked as NAV-004.

### Follow-ups filed by this review (`playbooks/follow-up-on-disk.md`)

| id | why it is a separate item |
|---|---|
| **DOC-499** (new, high, `milestone: 1.0.0`) | The #1825 doc train stops at ST-1b: saved searches (ST-3), cross-kind results (ST-4), the Sort-by dropdown (ST-2a/2b) and this slice's job are all undocumented, while DOC-495/497 cover only the URL slices. Verified by `grep -rl` per slice over `backlog/docs/`. Full cross-tree scope in ONE item rather than eight fragments. |
| **ADR-0080** (new, medium, `milestone: 1.0.0`) | Six merged PRs cite "ADR unified-asset-search D2/D5/D12" in **public** source with no published ADR page — `ReactiveAssetSearchRepository.java:19` cites two ADRs and a reader can resolve only `ADR-0021`. Separate from DOC-499 because an ADR-log page is its own content type (Gate 10 / Cornerstone 5). |
| **TST-057** (extended) | The fourth instance above + the 58.5s/60s measurement + an integration-bucket AC. Extended, not duplicated. |
| — | **Deliberately NOT logged**: the two optional one-line polishes below. The item is being accepted, not reworked, and neither is worth an item. |

### Optional polish for GATE 2 (non-blocking, one line each)

- `V0_0_100__snapshot_popularity_score.sql` cites `concepts.yaml:564` — an odd-team ontology file. `git grep` finds
  **no precedent** for a `concepts.yaml` citation in merged odd-platform source; an upstream reader cannot resolve
  it. (`ADR unified-asset-search` / `SEARCH-CAPABILITIES-DESIGN` *do* have merged precedent, so those are
  consistent with the epic — ADR-0080 is the real fix for that class.)
- `AssetPopularitySnapshotTest.java` line ~301 cites "(R-C4 / KL3)" — internal plan codes with no precedent in the
  public repo and no meaning to an upstream maintainer.

### Notes

- The `status:` label reads `review-ready` where the contributor flow's pre-review state is `pr-draft` (the body's
  "Status rationale" says `pr-draft`). Reviewed as-is; the post-review terminal state for a passing CTRIB item is
  `review-ready` either way, so no flip is required — **human GATE 2 is the next step**. VERIFIED via
  `.claude/skills/review/SKILL.md` hard-prerequisites.
- The item's honesty about what it did *not* carry (no GATE-1 plan record) is accurate and was not treated as a
  gate failure: the change was designed, built and made public in the 2026-07-08 window, its scope publicly stated
  on #1839, and re-opening GATE 1 on already-built public work would be theatre. The *code* gates are what this
  review re-ran, and they hold.
- Reviewer's stream `review-ctrib059` registered in `state/active-streams.yaml` at intake; heavy-e2e flock acquired
  and released; both leftover IT-042 stacks torn down; `lineage/**` **clean** (no probe drift — the api rail never
  ran). VERIFIED via `git status --short lineage/` (empty) and `docker ps` (empty).
