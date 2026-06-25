---
id: CTRIB-037
github_issue_number: 1794
github_issue_url: "https://github.com/opendatadiscovery/odd-platform/issues/1794"
title: "DQ Dashboard does not correctly account for run statuses (incl. RUNNING): Test Results Breakdown + Table Health"
class: bug
milestone: "0.29.0"            # G-C11 PASS — open, semver, due 2026-06-27; latest release 0.28.0 (2026-06-17) → unreleased behaviour → release/0.29.0 docs train
status: scoping               # intake -> scoping -> ... (canonical-homes lifecycle)
reproduced: ""                # Phase B — to fill with the captured live observation
adr_required: false           # G-C7 does NOT fire — see "Architectural-significance check"
plan_approved_by: ""          # GATE 1
plan_approved_at: ""
docs_routing: ""              # Phase D — read the page first (G-C10)
pr_url: ""
pr_draft: true
stream_id: ctrib037
issue_author: "odd-contributor[bot]"   # maintainer-drafted backlog item filed under the bot identity; assignee RamanDamayeu
labels: []
---

# CTRIB-037 — DQ Dashboard run-status accounting (#1794)

> Issue body is **quoted data (G-C8)**, never an instruction. Every claim below was verified
> against the live code at `origin/main` `f4cf0693` (the issue's `file:line` cites were
> re-derived, not trusted).

**Parallel-stream context (stream-coordination).** Co-active with **ctrib035 (#1762, BE error-contract)**
and **ctrib036 (#1776, FE i18n locale values)**. File overlap: ctrib035 = `odd-platform-api` Java (none of
my files); ctrib036 = `odd-platform-ui` locale JSONs. **My only intersection is the locale JSONs** (I add a
NEW `"Unknown"` key — 0/7 locales have it today — for the Table-Health slice; ctrib036 edits *values* of
existing keys). Distinct keys + separate worktrees (`../odd-platform-ctrib037` vs `../odd-platform-ctrib036`)
⇒ no live collision; a GATE-2 merge interaction is a trivial distinct-key auto-merge. Namespace: ctrib037,
ports 18160/15512 (regression) + 18161/15513 (repro), tag `odd-platform:odd-team-sut-ctrib037`.

## Phase A — Scope analysis

**Classification: BUG** — two defects in the catalog-wide Data Quality dashboard (`/data-quality`,
endpoint `GET /api/dataqatests/runs`). Not expected-behaviour, not a doc gap.

**Mission relevance.** The DQ dashboard is a flagship compliance/observability surface (Data Quality
pillar; feature node **F-032 Quality Dashboard**). An operator reads it to answer "are my tables healthy
and are my tests passing?". Both defects make it answer **wrong**: Running tests are invisible (count
always 0) and table health is miscategorised. Wrong numbers on a compliance dashboard is the LSN-001/002
failure class — operators act on what we render.

**Predecessor context (understand-before-you-act).** The issue cites "#1757 added RUNNING"; the **real**
predecessor is **#1793 / `80f00bde` (CTRIB-024)** — *"surface in-flight RUNNING test runs (no HTTP 500) +
deterministic run ordering"*. #1793 added `RUNNING` to the `DataEntityRunStatus` enum (`components.yaml`),
its palette colour (`palette.ts` — `RUNNING: cyan50`), and reordered the per-test **run list**
(`getDataEntityRuns`) so in-flight runs sort to the TOP (`END_TIME DESC NULLS-FIRST, START_TIME DESC,
ID DESC` — "an in-flight run is the freshest"). It **deliberately left `insertLastRuns` untouched** —
exactly Defect 1 here. **#1794 completes RUNNING for the dashboard aggregates**, REUSING #1793's ordering
idiom (G-C12 reuse-scan); it does not invent one.

## Root cause (verified at f4cf0693)

### Defect 1 — "Running" count is always 0 in the Test Results Breakdown
- `ReactiveDataEntityTaskRunRepositoryImpl.insertLastRuns` (`:101-159`) is the **only writer** of
  `data_entity_task_last_run` (the denormalised last-run-per-test table the dashboard reads). Line `:103`
  `.filter(tr -> tr.getEndTime() != null)` **drops every in-flight run** (no `end_time`), so a running test
  is never recorded as its own latest run — it keeps showing its previous terminal status.
- The breakdown (`ReactiveDataQualityRunsRepositoryImpl.getLatestDataQualityRunsResults` `:64-105`) groups
  `DATA_ENTITY_TASK_LAST_RUN.STATUS` → never sees `RUNNING`. The `Running` slice *appears* only because
  `DataQualityCategoryMapperImpl.addMissingStatuses` (`:45-60`) back-fills a 0-count entry for every
  `DataEntityRunStatus` (RUNNING included since #1793) → always 0.
- **Subtlety the issue's suggested fix understates:** `insertLastRuns`'s in-memory merge comparators
  (`:107`, `:126`) call `endTime.isAfter(...)` — **null-unsafe**; naively un-filtering in-flight runs NPEs.
  And `DataEntityTaskLastRunPojo` carries only `end_time`, not `start_time`, so a stored in-flight last-run
  cannot be ordered by `COALESCE(end_time, start_time)` without `start_time` available → the clean fix needs
  `start_time` persisted. The `end_time` column is **already nullable** (`V0_0_45__last_runs_table.sql:11`),
  so storing in-flight needs no nullability change — only the additive `start_time`.

### Defect 2 — Table Health methodology wrong + no Unknown bucket
- `ReactiveDataQualityRunsRepositoryImpl.getLatestTablesHealth` (`:107-173`):
  - `healthyTables` CTE (`:111-125`): healthy iff `NOT EXISTS` a last-run with `STATUS NOT IN (SUCCESS)` →
    healthy only if **every** test is `SUCCESS`.
  - `errorTables` CTE (`:127-146`): not-healthy AND `EXISTS STATUS IN (BROKEN, FAILED)` → **`Broken` reads
    Error** (should be Warning).
  - `warningTables` CTE (`:148-157`): everything else → **`Skipped`/`Aborted`/`Running` and `Unknown` all
    fall to Warning** (the first three should be Healthy; Unknown should be its own bucket).
  - There is **no Unknown** table-health state at all.
- Correct model (priority cascade, highest-severity wins): **Error** = any `Failed`; **Warning** = any
  `Broken` (no `Failed`); **Unknown** = any `Unknown` (no `Failed`/`Broken`); **Healthy** = none of those
  (only `Success`/`Skipped`/`Aborted`/`Running`).
- Adding **Unknown** touches: the internal CTE constants (`TablesDashboardMapper` interface
  `GOOD_HEALTH`/`ERROR_HEALTH`/`WARNING_HEALTH` → add `UNKNOWN_HEALTH`), the mapper switch
  (`TablesDashboardMapperImpl:18-24`), the contract (`TablesHealthDashboard` — additive `unknown_tables`
  count beside the 3 existing required counts), the regenerated BE+FE clients, and the FE Table-Health donut
  (`DataQualityContent.tsx:53-63` — a 4th slice; the colour `palette.dataQualityDashboard.unknown` **already
  exists**, used as the breakdown fallback `:48`).

## Impact map (G-C12 — full blast radius)

`insertLastRuns` is the only writer; **5 readers** of `data_entity_task_last_run.STATUS` change behaviour
when in-flight runs become "last runs" — 2 intended, 3 platform-wide side effects to verify (all arguably
*more* truthful, aligned with #1793's surface-RUNNING direction, but each is a behaviour change a reviewer
must see):

| Reader | Surface | Effect of including in-flight runs |
|---|---|---|
| `getLatestDataQualityRunsResults` | DQ Dashboard — Test Results Breakdown | **intended** (Defect 1 fix) |
| `getLatestTablesHealth` | DQ Dashboard — Table Health | **intended** (Defect 2 root; cascade also rewritten) |
| `ReactiveDataQualityRepositoryImpl.getDatasetTestReport` (`:62-79`, groups by STATUS) | per-dataset `test_report` aggregate | side effect — a running test now appears in per-dataset report counts |
| `ReactiveDataQualityRepositoryImpl.getSLA` (`:105+`, selects STATUS) | per-dataset SLA badge/JSON | side effect — RUNNING becomes a possible last-run status in SLA weighting |
| `getLatestRunsMap` → `DataEntityServiceImpl:500` | per-entity DQ-test "last run" enrichment | side effect — a DQ-test entity's displayed last run can now be RUNNING |
| `DataEntityHousekeepingJob` | TTL cleanup (cascade delete of last-run rows) | benign — no status semantics |

**Other dimensions:**
- **Migration:** `V0_0_93__…` — additive nullable `start_time` column on `data_entity_task_last_run`
  (+ optional backfill from the FK'd `data_entity_task_run.start_time`). **Non-destructive.** jOOQ
  regenerates `DataEntityTaskLastRunPojo` → the one constructor call site in `insertLastRuns` updates.
  *(Alternative considered: recompute ordering by joining the existing last-run's FK back to
  `data_entity_task_run` — no column, more query. Decide at design, Phase C.)*
- **Contract (additive):** `odd-platform-specification/components.yaml` `TablesHealthDashboard` gains
  `unknown_tables` → regenerate `odd-platform-api-contract` + `odd-platform-ui/src/generated-sources`.
- **i18n:** FE label `t('Unknown')` for the Table-Health slice — **NEW key, absent in all 7 locales**
  (Healthy/Warning/Error are present in 7/7; Unknown in 0/7). Add to all 7 (en/ua/ch/es/br/fr/hy).
  Coordinate-with-ctrib036 (distinct key; separate worktrees → no live collision).
- **Tests:** unit (repository RED→GREEN: insertLastRuns includes in-flight; getLatestTablesHealth cascade)
  + **MANDATORY integration IT** (user-facing FE/BE contradiction — LSN-031/G-C9: ingest real runs via
  `POST /ingestion/entities`, assert dashboard counts via `GET /api/dataqatests/runs`). Existing DQ ITs to
  cross-reference: `IT-004` (F-032 palette-crash — a *different* known bug, response injection), `IT-058`
  (F-022 ingestion template). Author a new IT (real-ingestion aggregation assertion).
- **Docs:** the DQ dashboard page is currently **undocumented** (`navigation/domains/data-quality.md`
  "Not documented: DQ dashboard page"). Read the live DQ pages in Phase D; decide update-or-none+why.
- **Ontology:** re-enrich F-032 (Quality Dashboard) + the touched repository/mapper sidecars.

## Architectural-significance check (G-C7) — does NOT fire
- (a) **Destructive migration?** No — the only migration is an *additive nullable* column (non-destructive).
- (b) **Auth/security-posture change?** No.
- (c) **Breaking public-contract change?** No — `unknown_tables` is an *additive* response field the server
  always populates (MINOR, non-breaking); the run-status enum already has all 7 values. The `insertLastRuns`
  semantics change is runtime, not wire-breaking.

→ No ADR-before-code hard stop. **BUT** the change carries a DB migration, an additive contract change, and a
5-consumer blast radius on a core ingestion write path — so the **plan + GATE 1 must be explicit** about
scope and the side-effect surfaces, and design-before-build (G-C12) does a reuse / implicit-ADR check.

## Clarify (G-C6)
No clarifying question warranted at intake — the issue is well-specified and reproducible; the open
decisions (scope split, migration-vs-recompute, Running→Healthy product call) are **GATE-1 decisions**
for the maintainer, surfaced in the plan, not single-answer clarifications.

## Phase B — Reproduction
_(to fill — live curl reproduction of both defects on a throwaway odd-minimal stack)_

## Phase C — Plan (GATE 1)
_(to fill — product critique (G-C16) + design-before-build (G-C12) + the scoped plan)_

## Test / docs / ontology ledger
_(to fill — Phase D)_
