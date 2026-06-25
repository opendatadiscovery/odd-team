---
id: CTRIB-037
github_issue_number: 1794
github_issue_url: "https://github.com/opendatadiscovery/odd-platform/issues/1794"
title: "DQ Dashboard does not correctly account for run statuses (incl. RUNNING): Test Results Breakdown + Table Health"
class: bug
milestone: "0.29.0"            # G-C11 PASS — open, semver, due 2026-06-27; latest release 0.28.0 (2026-06-17) → unreleased behaviour → release/0.29.0 docs train
status: plan-approved         # GATE 1 PASSED 2026-06-25 (RamanDamayeu) — Option A + include 1a; Phase D next
reproduced: "contributor/CTRIB-037.md §Phase B (live on ctrib037repro :18161, image 005dee4b = main f4cf0693 DQ-identical); raw captures scratchpad/dash-*.json"
adr_required: false           # G-C7 does NOT fire — see "Architectural-significance check"
plan_approved_by: "RamanDamayeu"   # GATE 1 — AskUserQuestion + explicit override message 2026-06-25
plan_approved_at: "2026-06-25"
gate1_decisions: "Cascade = Option A — the issue's 4-state mapping, by MAINTAINER OVERRIDE (the AskUserQuestion picked B; the maintainer then explicitly INSISTED on A and to update the docs): Error=at least one FAILED; Warning=at least one BROKEN (no FAILED); Unknown=at least one UNKNOWN (no FAILED/BROKEN); Healthy=none of the above (only SUCCESS/SKIPPED/ABORTED/RUNNING). Scope = include Defect 1a (ingestion NPE) + start_time migration in ONE PR. Docs page /features/data-quality/dashboard MUST be updated to match (the documented 'Error=failed or broken' changes). Scope comment posted on #1794 before code."
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

## Phase B — Reproduction (live, verified on the running system — LSN-031)

Stack: throwaway `odd-minimal` (ctrib037repro, `:18161`), image `odd-platform:odd-team-sut-ctrib034`
(`005dee4b`, proven DQ-identical to current main `f4cf0693` — the only intervening commits #1805/#1806
touched alert/housekeeping/locale files, zero DQ). Drove the REAL ingestion path
(`POST /ingestion/entities`) → read the catalog-wide dashboard (`GET /api/dataqatests/runs`). Script +
raw captures: `scratchpad/repro-1794.py` + `scratchpad/dash-*.json`.

### Defect 1 — the breakdown's "Running" count (ASSERTION category)
| Step | Action | Observed `Assertion Tests` breakdown | Meaning |
|---|---|---|---|
| D1.1 | ingest 1 **SUCCESS** run (end_time present) | `{SUCCESS: 1}` (RUNNING back-filled 0) | baseline |
| D1.2 | ingest an **in-flight RUNNING** run (start_time, **no end_time**) | **HTTP 500** `{"code":"SYS001",...}`; breakdown unchanged `{SUCCESS: 1}` | **DEFECT 1a (deeper than the issue)** |
| D1.3 | ingest a **RUNNING run WITH end_time** | `{RUNNING: 1}` | RUNNING IS counted when it has end_time |

> **DEFECT 1a — NEW finding the issue's static analysis missed (this is the reproduce-first payoff).**
> An in-flight run **cannot even be ingested** today: `POST /ingestion/entities` of a run with null
> `end_time` returns **HTTP 500 / SYS001**. Stack trace (container log):
> `java.lang.NullPointerException: Cannot invoke "java.time.OffsetDateTime.toLocalDateTime()" because
> the return value of "...IngestionTaskRun.getEndTime()" is null` at
> `DataEntityTaskRunMapperImpl.mapTaskRun(:19)` ← `TaskRunIngestionRequestProcessor.process(:34)`.
> The mapper (`:18-19`) unconditionally calls `getStartTime()/getEndTime().toLocalDateTime()`. So the run
> never reaches `insertLastRuns`. **#1793 fixed only the READ side** (`DataEntityRunMapper.mapRunStatus` —
> tolerant status→enum so the runs *page* doesn't 500); the INGESTION mapper was never made null-safe.
>
> **DEFECT 1b — the issue's claim, confirmed:** D1.3 proves a RUNNING run is counted *only because it has
> an end_time* — i.e. the breakdown logic itself handles RUNNING; the exclusion is purely end_time-gated
> (`insertLastRuns:103` `.filter(end_time != null)`). **So "make Running count" = fix 1a (ingest null
> end_time) + 1b (stop dropping it from the last-run rollup, order by COALESCE(end_time,start_time)).**

### Defect 2 — Table Health methodology (one test/table, terminal status, end_time present)
`GET /api/dataqatests/runs` → `tables_dashboard.tables_health` = **`{"healthy_tables": 1, "error_tables":
2, "warning_tables": 3}`** (monitored_tables=6). Per-table, under TODAY's rules:

| Table (its only test's latest run) | Bucket today | Correct bucket |
|---|---|---|
| `tbl_broken` (BROKEN) | **error** | warning ✗ |
| `tbl_skipped` (SKIPPED) | **warning** | healthy ✗ |
| `tbl_unknown` (UNKNOWN) | **warning** | unknown (no such bucket exists) ✗ |
| `tbl1` (RUNNING, from D1.3) | **warning** | healthy ✗ |
| `tbl_failed` (FAILED) | error | error ✓ |
| `tbl_success` (SUCCESS) | healthy | healthy ✓ |

Buggy totals `healthy=1 · error=2 · warning=3` exactly match the cascade in `getLatestTablesHealth`
(healthy = all-SUCCESS; error = any BROKEN|FAILED; warning = the rest). Post-fix the correct cascade would
yield `healthy=3 · warning=1 · error=1 · unknown=1`.

**Reproduced ✓ both defects on the running system.** Defect 1 is two-layered (1a ingestion NPE + 1b last-run
filter); Defect 2 confirmed exactly as the issue describes.

## Phase C — Product critique (G-C16) + Design (G-C12) + Plan (GATE 1)

### C.1 Change-request product analysis (G-C16)
**User problem, restated independent of the issue's proposed solution:** an operator looking at the DQ
dashboard cannot trust two of its three signals — (1) tests that are *currently running* are invisible
(the Running slice is always 0, and a table reverts to its previous status), and (2) the Table Health ring
mis-rates tables: a currently-running or merely-skipped test makes a table look "Warning" (a false alarm),
a `Broken` test reads "Error" (over-escalation vs a real data `Failed`), and there is no way to express
"health unknown".

**Is the issue's direction product-correct?** YES (unlike CTRIB-024/#1757, where the issue's suggested fix
was product-wrong). The cascade (non-failures don't degrade health; Unknown gets its own bucket) is the
right shape for an at-a-glance health ring, and it is consistent with the sibling #1793/#1757 direction of
surfacing in-flight RUNNING prominently. Grounding: `odd-sme` consultation
`lineage/odd-platform/sme-consultations/2026-06-25-ctrib037-table-health-cascade.md`.

**The central product fork — `BROKEN` classification (odd-sme + live-docs grounded; the GATE-1 decision).**
odd-sme's consultation (`lineage/odd-platform/sme-consultations/2026-06-25-ctrib037-table-health-cascade.md`,
confidence HIGH) **rejects the issue's `Broken→Warning`**, and I **VERIFIED its load-bearing claim myself**
(WebFetch `docs.opendatadiscovery.org/features/data-quality/dashboard`, 200, 2026-06-25, quoted verbatim):
> Healthy = "none of its latest test runs is anything but a success"; **Error = "when any latest run is
> failed or broken"**; Warning = "everything in between"; "broken/failed runs roll up into the Error slice";
> **no Unknown state**; breakdown statuses = Success/Failed/Skipped/Broken/Aborted/Unknown (**no Running** —
> the docs are already stale vs #1793).

So `Broken→Warning` would (a) **regress documented + shipped behaviour**, (b) diverge from **alerting**
(`IngestionTaskRunAlertState:20-23` fires on BROKEN == FAILED), and (c) invert the **semantics** — ODD records
a data-assertion *failure* as **FAILED**, never BROKEN (`odd-great-expectations/mapper.py:63-77`: GE
`success:false → FAILED`); **BROKEN means the test machinery itself broke / produced no verdict** — *more*
alarming, not less. SLA rightly ignores BROKEN (it is a ratio, not a health signal) — a *different* question,
not a precedent for the ring.

**The structural consequence the issue did not foresee:** if `Broken→Error` is kept (per odd-sme) AND the
other genuine fixes land (SKIPPED/ABORTED/RUNNING→Healthy, UNKNOWN→Unknown), then **the Warning bucket has no
remaining member** — BROKEN is its only natural occupant. So the cascade is a real fork:
- **Option A (issue's 4-state ring):** Error=FAILED · **Warning=BROKEN** · Unknown=UNKNOWN · Healthy=rest.
  Every slice has a member; but it *changes* the documented Error=failed|broken and diverges from alerting.
- **Option B (odd-sme / docs- + alerting-consistent):** Error=FAILED|BROKEN · Unknown=UNKNOWN · Healthy=rest ·
  **Warning becomes empty** (effectively a 3-state + Unknown ring). Keeps BROKEN a failure; loses Warning.

Both fix the REAL bug both agree on (today SKIPPED/ABORTED/RUNNING/UNKNOWN all wrongly read Warning; in-flight
runs are uncounted). They differ ONLY on BROKEN, which decides whether Warning survives. My lean was **Option
B** (grounded), but the maintainer owns the product call.

> **GATE-1 RESOLUTION (2026-06-25, RamanDamayeu — FINAL):** **Option A.** The AskUserQuestion initially picked
> B; the maintainer then **explicitly overrode** it: *"I would still insist on that mapping … Error=at least
> one Failed; Warning=at least one Broken (no Failed); Unknown=at least one Unknown (no Failed/Broken);
> Healthy=none of the above (only Success/Skipped/Aborted/Running) … and update the documentation accordingly."*
> This is the maintainer's product authority, made with full knowledge of the docs-regression + alerting
> trade-off I surfaced (they resolve the docs concern by **updating the docs** to match — on `release/0.29.0`).
> The 4-state ring is coherent (no empty slice). **Implement Option A; update `/features/data-quality/dashboard`
> to the new cascade + Running-in-breakdown.** The Unknown slice ships (the maintainer wants the 4-state ring);
> I still run odd-sme's one-query check in Phase D and note the result, but it does not gate the bucket.

**The product-critical ADDITION the issue missed (reproduce-first):** **Defect 1a — in-flight runs can't be
ingested at all** (HTTP 500 NPE at `DataEntityTaskRunMapperImpl.mapTaskRun`). The issue's Defect 1 names only
the `insertLastRuns` filter; in reality a no-`end_time` run 500s before it ever reaches the rollup. "Make
Running count" is impossible without fixing 1a too. This *expands the issue's stated scope* → a public scope
comment is required at GATE 1 (G-C5).

**The product-critical ADDITION the issue missed (reproduce-first):** **Defect 1a — in-flight runs can't be
ingested at all** (HTTP 500 NPE at `DataEntityTaskRunMapperImpl.mapTaskRun`). The issue's Defect 1 names only
the `insertLastRuns` filter; in reality a no-`end_time` run 500s before it ever reaches the rollup. "Make
Running count" is impossible without fixing 1a too. This *expands the issue's stated scope* → a public scope
comment is required at GATE 1 (G-C5).

### C.2 Design-before-build (G-C12)
- **Reuse-scan:** (a) the **#1793 ordering idiom** — an in-flight run is the freshest; order by
  `COALESCE(end_time, start_time)` — is reused for the `insertLastRuns` last-run choice (not invented).
  (b) the existing **CTE-union-all + `DSL.inline(STATUS)`** shape in `getLatestTablesHealth` is *extended*
  with a 4th `unknownTables` CTE, not rewritten wholesale. (c) the FE **`palette.dataQualityDashboard.unknown`**
  colour already exists (used as the breakdown fallback `DataQualityContent.tsx:48`) — reused for the Unknown
  slice. (d) the `TablesHealthDashboard` count-field + mapper-switch pattern is extended (one field, one case).
- **ADR-check:** `implicit-adrs.md` / `refactoring-scopes.md` carry **no** decision constraining the last-run
  rollup or table-health cascade. The change *conforms* to #1793's emerging "in-flight is the freshest"
  pattern. It is a bug fix completing #1793, **not** a new architectural decision → **no new ADR** (G-C7 does
  not fire; G-C12(b) reverse-ADR not warranted).
- **Impact checklist:** migration (additive `start_time`), generated BE+FE clients (additive `unknown_tables`),
  every consumer (the 5 last-run readers — §C.4), i18n (`Unknown` × 7 locales), docs (read live DQ pages),
  ontology (F-032). All enumerated; none deferred silently.
- **PO/SRE lens (`odd-sme`):** Running→Healthy prevents false on-call alarms from a transient state; a distinct
  Unknown bucket is an honest "we don't know"; the cascade matches CI/DQ-tool norms. [folded from the
  consultation.]

### C.3 The scoped plan — exact changes (one PR, logical commits)

**Commit 1 — Defect 1a (ingestion accepts in-flight runs).**
`mapper/DataEntityTaskRunMapperImpl.mapTaskRun` — null-guard BOTH `getStartTime()` and `getEndTime()` (the
contract makes both optional: `DataEntityRun.required = [status]` only). Maps a null timestamp to a null
`LocalDateTime` instead of NPE-ing.

**Commit 2 — Defect 1b (in-flight runs become the last run).**
- Migration `db/migration/V0_0_93__last_run_start_time.sql` — `ALTER TABLE data_entity_task_last_run ADD
  COLUMN start_time TIMESTAMP WITHOUT TIME ZONE;` (additive, nullable, non-destructive) + a one-shot backfill
  `UPDATE … SET start_time = (SELECT start_time FROM data_entity_task_run WHERE oddrn = last_task_run_oddrn)`.
- `ReactiveDataEntityTaskRunRepositoryImpl.insertLastRuns` — drop the `.filter(end_time != null)`; build the
  last-run pojo with `start_time`; replace the `endTime.isAfter(...)` comparators (in-memory grouping AND the
  existing-vs-incoming merge) with an **effective-time** comparison `COALESCE(end_time, start_time)` (null-safe);
  add `START_TIME = excluded` to the `onDuplicateKeyUpdate`. (jOOQ regenerates `DataEntityTaskLastRunPojo` with
  `startTime`; update the one constructor call site.)

**Commit 3 — Defect 2 (Table Health priority cascade + Unknown).**
- `ReactiveDataQualityRunsRepositoryImpl.getLatestTablesHealth` — rewrite the CTEs to the cascade: **error** =
  any `FAILED`; **warning** = any `BROKEN` & no `FAILED`; **unknown** = any `UNKNOWN` & no `FAILED`/`BROKEN`;
  **healthy** = none of those (SUCCESS/SKIPPED/ABORTED/RUNNING). Add the 4th `unknownTables` CTE + union branch.
- `mapper/TablesDashboardMapper` (interface) — add `UNKNOWN_HEALTH` constant; `TablesDashboardMapperImpl` —
  add the `case UNKNOWN_HEALTH -> setUnknownTables(...)`.
- `odd-platform-specification/components.yaml` `TablesHealthDashboard` — add `unknown_tables` (additive,
  required like its siblings); regenerate `odd-platform-api-contract` + `odd-platform-ui/src/generated-sources`.
- FE `DataQualityContent.tsx` — destructure `unknownTables`; add a 4th slice
  `{ title: t('Unknown'), value: unknownTables, color: palette.dataQualityDashboard.unknown }`.
- i18n — add `"Unknown"` to all 7 locale JSONs (en/ua/ch/es/br/fr/hy) — NEW key (0/7 today).

**Commit 4 — the per-dataset `test_report` side-effect (§C.4 #3).** Keep `mapTestReport`'s `total` consistent:
exclude RUNNING from the `total` sum (the report has no `running_total` slot and RUNNING is not a completed
result), so `total == success+failed+skipped+broken+aborted+unknown`. [GATE-1 confirm — vs adding a
`running_total` field, vs accept+follow-up.]

**Commits 5+ — tests, docs, ontology** (§C.5–C.6).

### C.4 Blast radius — the 5 last-run readers (verified)
1. `getLatestDataQualityRunsResults` (breakdown) — **intended** (Defect 1).
2. `getLatestTablesHealth` (table health) — **intended** (Defect 2).
3. `getDatasetTestReport`/`mapTestReport` — **side effect**: `total` would include a RUNNING last-run with no
   `running_total` field → totals stop reconciling. Handled by Commit 4.
4. `SLACalculator` (per-dataset SLA) — **unaffected**: filters `SUCCESS|FAILED` only; RUNNING is ignored.
5. `getLatestRunsMap` → `DataEntityServiceImpl.getLastRunsForQualityTests` — **benign/positive**: a DQ-test
   entity's displayed "last run" can now be RUNNING (correct; the read path is #1793-tolerant).
(+ `DataEntityHousekeepingJob` — cascade delete only; no status semantics.)

### C.5 Scope EXCLUSIONS (G-C5) — deliberately NOT touched
- **PLT-052 / IT-004** (the palette `TypeError` blank-dashboard on a *truly-unknown* status) — a different
  known bug; `palette.runStatus[RUNNING]` already exists (#1793) so my change does not trigger it. Untouched.
- **The concurrent-overlapping-runs edge case** — the `COALESCE(end_time,start_time)` total order is a
  reasonable, simple resolution; not over-engineered with NULLS-FIRST display semantics (that is #1793's
  *display* concern, not the rollup's).
- **The run-status enum / #1793's run-list ordering / the alerting + SLA models** — untouched.
- **A `running_total` on the per-dataset `test_report`** — out of the dashboard's scope (Commit 4 keeps the
  total consistent instead); if wanted, a tracked follow-up on F-022.

### C.6 Test plan (BOTH buckets — G-C9)
- **Unit (odd-platform CI):** (a) `DataEntityTaskRunMapperImplTest` — null `end_time` (and null `start_time`)
  maps to null, no NPE (RED on main → GREEN). (b) `ReactiveDataQualityRunsRepositoryTest` (a `BaseIntegrationTest`)
  — **add `getLatestTablesHealth` coverage** (currently ZERO — G-C13 sufficiency): each status → its correct
  bucket incl. the new Unknown; plus an **insertLastRuns in-flight** case (ingest SUCCESS then an in-flight
  RUNNING via the real `insertLastRuns` → last-run is RUNNING). The existing test bypasses `insertLastRuns` and
  must be extended, not just relied on. Any characterization assertion re-grounded RED→GREEN (G-C15).
- **Integration IT (odd-team, MANDATORY — user-facing FE/BE contradiction, LSN-031/G-C9):** a NEW `IT-NNN`
  (DQ dashboard run-status accounting). Real ingestion (`POST /ingestion/entities`) of the Phase-B scenarios →
  assert `GET /api/dataqatests/runs` counts (Running counted; tables_health healthy/warning/error/unknown) +
  drive the FE ring (4 slices incl. Unknown). **Assertions from the CAPTURED real responses** (`scratchpad/
  dash-*.json`). RED on `ODD_SUT=ref:main` (in-flight 500 / Running 0 / health miscount), GREEN on the fix.
  Cross-ref F-032, IT-004 (sibling), IT-058 (ingestion template).

### C.7 Docs (G-C10) + Ontology
- **Docs: the DQ-dashboard page DOES exist** — `docs.opendatadiscovery.org/features/data-quality/dashboard`
  (my nav file `navigation/domains/data-quality.md` "Not documented: DQ dashboard page" is STALE → log a nav
  follow-up). It documents the *current* behaviour verbatim (Healthy=all-success · Error=failed|broken ·
  Warning=in-between · no Unknown · breakdown statuses = the 6 pre-#1793 ones, **no Running**). So this change
  **requires a docs update on `release/0.29.0`** (the page is already stale on Running post-#1793): the new
  Table-Health cascade (per the GATE-1 cascade choice), Running counted in the breakdown, and (if Option A or
  the Unknown slice ships) the Unknown state. Paired backlog DOC item (`milestone: 0.29.0` + the page URL).
  **+ odd-sme follow-up DOC:** BROKEN-vs-FAILED is defined *nowhere* user-facing (the root cause of the
  three surfaces diverging) — log a DOC-NNN.
- Ontology: `/enrich --touched` F-032 + the DQ repo/mapper sidecars (only while `lineage/**` is clean+unclaimed
  — currently dirty from ctrib035's sme-consultation; re-check at the write moment).

### C.8 GATE-1 decisions (the maintainer owns these)
1. **[#1 — the product fork] Table Health `BROKEN` classification / the cascade shape** (see C.1): **Option A**
   (issue's 4-state ring, Warning=BROKEN — changes documented Error=failed|broken) vs **Option B** (odd-sme +
   live-docs + alerting: Error=FAILED|BROKEN, Warning empty → 3-state+Unknown). Both fix the agreed real bugs
   (SKIPPED/ABORTED/RUNNING→Healthy, UNKNOWN→Unknown, in-flight counted). **My lean: Option B** (grounded), but
   the maintainer's issue explicitly designed Option A — their call.
2. **Scope — include Defect 1a (ingestion NPE) + the `start_time` migration?** Recommend **YES** (in-flight runs
   cannot be counted at all without it — the reproduce-first finding). Expands the issue's stated scope → a
   public **scope comment** is posted on #1794 at approval (C.9).
3. **The new Unknown bucket** — ship the 4th `unknown_tables` slice now, or gate it on the Phase-D one-query
   check (does UNKNOWN ever appear as a table's worst latest status; ODD's GE adapter never emits it)? Recommend
   **ship it** (the issue asks for it; it is additive + honest), and still run the check to confirm it is reachable.
4. **One PR** (both defects + 1a, one coherent unit) vs split? Recommend **one PR**, ~4–6 logical commits, one review.
   (The per-dataset `test_report` `total` is kept consistent inside this PR — Commit 4 — vs adding a `running_total`
   field, which would be a separate F-022 follow-up.)

### C.9 Drafted scope comment for #1794 (posted at GATE-1 approval — G-C5)
> _(ASCII, self-contained, no workspace-internal IDs — finalised + posted after approval)_
> Picking this up. Reproduced both problems on a local stack. One addition beyond the write-up: an in-flight
> run (no `end_time`) currently **fails to ingest at all** (HTTP 500 — a NullPointerException in the task-run
> ingestion mapper), so "make Running count" needs that fixed first; the PR will cover it. Planned scope:
> (1) ingestion accepts in-flight runs; (2) the last-run rollup records the in-flight run as the latest
> (ordered by `COALESCE(end_time, start_time)`, via a new additive `start_time` column); (3) the Table Health
> priority cascade + a new **Unknown** health state (additive `unknown_tables` field + ring slice). The
> per-dataset test-report `total` is kept consistent with the change. No breaking API change; rides milestone
> 0.29.0. Out of scope (tracked separately): the unrelated palette-crash on a never-before-seen status.

## Test / docs / ontology ledger
_(to fill — Phase D)_
