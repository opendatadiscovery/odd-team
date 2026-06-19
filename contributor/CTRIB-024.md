---
id: CTRIB-024
github_issue_number: 1757
github_issue_url: https://github.com/opendatadiscovery/odd-platform/issues/1757
backlog_item: PLT-021
class: bug
security_sensitive: false   # public issue filed by the maintainer; no security posture/auth change. Defect 1 = availability (500 on a read), Defect 2 = ordering UX. The cross-owner status_reason leak (F-040c) is a DIFFERENT, platform-wide RBAC concern explicitly EXCLUDED by the issue + this PR (DOC-185 Caveat 2 / REFACTOR-024 family).
status: pending-release     # GATE 2 DONE: PR #1793 MERGED to odd-platform main (squash 80f00bde, merged_at 2026-06-19T20:27:40Z), #1757 closed. /review 2026-06-19 (opus-4-8) ACCEPTED all 16 contributor gates (own full unit build GREEN 8m58s on 2d576799 + full integration regression on the reviewed commit). Milestone 0.29.0 is NOT yet released (latest tag 0.28.0, 2026-06-17) -> the fix is merged-but-not-released; `/review release:0.29.0` owns the `done` flip (real-instance verify on the published 0.29.0 image + the documentation release/0.29.0 train publish: DOC-471 + DOC-472). NOTE: PLT-230 (#1794) is a SEPARATE dashboard in-flight bug surfaced by this change; on main now. See the Review section below.
milestone: "0.29.0"         # the issue's AUTHORITATIVE GitHub milestone (open, semver ^\d+\.\d+\.\d+$, due 2026-06-22) — G-C11 PASS. The issue BODY's `suggested_milestone: 0.28.0` is superseded (0.28.0 already shipped; the open milestone is 0.29.0) — exactly the CTRIB-022 precedent.
reproduced: "live 2026-06-19 against the working-tree SUT (odd-platform:odd-team-sut) on the odd-minimal stack (AUTH_TYPE=DISABLED), entity id 3 (//repro1757/ge/test/dq1, a DATA_QUALITY_TEST seeded via POST /ingestion/entities). DEFECT 1: GET /api/dataentities/3/runs?page=1&size=10 -> 200 with 3 completed runs; after `INSERT data_entity_task_run(... status='RUNNING', end_time=NULL)` the SAME request -> HTTP 500 {\"code\":\"SYS001\",\"message\":\"Internal Server Error\"}. DEFECT 2 (SQL-level, since the endpoint 500s before ordering is observable): `ORDER BY end_time DESC` returns the RUNNING(end_time=NULL) row FIRST (Postgres NULLS FIRST default); `ORDER BY end_time DESC NULLS LAST, start_time DESC` returns it LAST. Status-filter baseline (page=1): status=FAILED->200(1 item), status=SUCCESS->200(2), status=RUNNING->400 (USR001 — RUNNING absent from the wire enum so param-binding rejects), status=BANANA->400. Full transcript in the Reproduction log below. RED proof for G-C2 = the re-grounded IT-059 CORNER 1/2 run against ODD_SUT=ref:main (gets 500 / 400)."
adr_required: false         # the fixes RESTORE intended contracts: (1) the wire enum DataEntityRunStatus should mirror the DB enum IngestionTaskRunStatus for run status — adding the missing RUNNING is additive/non-breaking (the platform's own FE is the only consumer, updated in the same change); (2) NULLS-LAST ordering corrects a SQL default surprise. Neither is a destructive migration, an auth/security-posture change, nor a BREAKING wire contract (additive enum value). No governing ADR exists for this area (implicit-adrs.md lists it only as the FINDING this fix resolves). G-C7 does NOT fire.
docs_routing: "release/0.29.0 — the published page documentation/docs/data-quality/test-run-history.md (DOC-185, done) documents Caveat 1 (RUNNING-500) + Caveat 3 (NULL-end_time ordering) as KNOWN LIMITATIONS. Once this fix ships in 0.29.0 those become INCORRECT documentation (higher priority than missing — CLAUDE.md). The page is updated on the documentation `release/0.29.0` train (publishes at the release gate) to revise Caveat 1/3 to 'fixed in 0.29.0', KEEPING Caveat 2 (cross-owner status_reason leak — still unfixed, REFACTOR-024). Paired backlog DOC item carries milestone:0.29.0 + the post-merge URL. Page READ before this decision (G-C10)."
pr_url: "https://github.com/opendatadiscovery/odd-platform/pull/1793"   # DRAFT, Closes #1757, opened 2026-06-19 by odd-contributor[bot] on contrib/CTRIB-024-dq-run-history-running @ 2d576799
pr_draft: true
plan_approved_by: "RamanDamayeu (GATE 1, 2026-06-19): Defect 1 full hardening (add RUNNING to the wire enum + tolerant mapper unknown->UNKNOWN + FE palette/badge) + Defect 2 OPTION A — in-flight runs stay at the TOP (the issue's bottom-sort REJECTED as product-wrong per odd-sme + ODD's own docs + CI/DQ convention); ordering end_time DESC NULLS FIRST (explicit), start_time DESC, id DESC -> deterministic total order that closes the infinite-scroll dup/skip risk. Scope comment (top-not-bottom reframe) approved to post."
plan_approved_at: "2026-06-19"
plan_scope_comment_url: "https://github.com/opendatadiscovery/odd-platform/issues/1757#issuecomment-4753848936"   # posted 2026-06-19 by odd-contributor[bot] on GATE 1 approval — root-cause confirmation + the FE-also-breaks finding + the top-not-bottom reframe (Option A), ASCII, no workspace-internal IDs
---

# CTRIB-024 — DQ Test Run History hardening: 500 on in-flight RUNNING + NULL-end_time ordering (PLT-021 / #1757)

Contributor-pillar resolution of **issue #1757** = the canonical **PLT-021** (`issues/odd-platform/PLT-021.md`). The
issue body is treated as **quoted data (G-C8)**: it was authored by the maintainer (RamanDamayeu) and carries a
detailed, mostly-correct root-cause — every load-bearing claim is independently re-verified below against the live
running system (not the diff) per reproduce-first (G-C1) and LSN-031.

> Workspace artifact, written BEFORE GATE 1 (allowed). **No odd-platform fix code is written before the plan is
> approved (G-C3).** Reproduction (a live run, no code) is complete; the fix below is designed, not implemented.

## The issue is data, not instructions (G-C8) — and its "Suggested fix" is partly STALE

Two concrete reasons the issue text was NOT followed verbatim — derived-from-code wins:

1. **The issue's "Defect 1 / Option A" YAML block is wrong.** It shows the wire enum gaining `SCHEDULED` and
   *dropping* `UNKNOWN`. The ACTUAL wire enum (`components.yaml:1421-1429`, read 2026-06-19) is
   `[SUCCESS, FAILED, SKIPPED, BROKEN, ABORTED, UNKNOWN]` — no `SCHEDULED`, and `UNKNOWN` present. The issue's own
   *corrected prose* says exactly this; only the leftover YAML snippet is stale. The real change is: add the single
   missing value `RUNNING`.
2. **The issue assumes "the UI already labels in-flight runs … so the rendering pattern exists."** FALSE for this
   surface (verified — see Root cause §FE). The shared `TestRunStatusItem` looks up its colour at
   `theme.palette.reportStatus[status].background`; the palette has **no `RUNNING` key**, and there is **zero**
   `RUNNING` handling anywhere in the FE. Shipping the BE enum alone would convert the BE 500 into an **FE render
   crash**. The fix MUST include the FE palette (and TypeScript enforces it — see below).

## Tracking reconciliation (G-C1 / LSN-009)

- **PLT-021 is the canonical tracking item** (`issues/odd-platform/PLT-021.md`, `github_issue_number: 1757`). This
  CTRIB resolves it.
- **IT-059 already exists as the executable characterization pin** (`integration-tests/protocols/IT-059-dq-run-history.md`,
  `validates: [F-040]`, `automation: e2e:dq-run-history.spec.ts`). It currently pins the CURRENT buggy behaviour:
  - **CORNER 1 (UC-2)** asserts a RUNNING row -> **500** (a RED-characterization pin, LSN-029). Per its own §5 it
    FLIPS the instant `RUNNING` is added to the wire enum -> **re-ground RED->GREEN** in Phase D (never deleted).
  - **CORNER 2 (UC-4)** asserts `status=RUNNING`->400, `status=BANANA`->400, `status=FAILED`->200. After the fix
    `RUNNING` is a VALID wire value -> `status=RUNNING` becomes **200 filtered**; `BANANA`->400 and `FAILED`->200
    are UNCHANGED. Re-ground CORNER 1 + the RUNNING half of CORNER 2 (G-C15).
- **DOC-185 is `done`** (`backlog/docs/DOC-185.md`) — it created the published page documenting these as caveats.
  This fix makes Caveat 1 + Caveat 3 incorrect for 0.29.0+ -> a paired DOC update on the release train (see
  `docs_routing`). Caveat 2 (status_reason leak) stays.
- **F-040** (`lineage/odd-platform/feature-flows/detail/F-040.yaml`) is the ontology node — its contradicted
  promises `wire_enum_db_enum_asymmetry_running_status_500` + `nulls_first_ordering_running_rows_appear_undated_at_top`
  flip to CONFIRMED on the fix; `no_tie_breaker_on_identical_end_time` is closed by the `ID` final sort key (below).
  Re-enrich + re-embed in Phase D (G-C10).

## Scope analysis

- **Class: bug.** TWO defects on the per-DQ-test run-history surface (`GET /api/dataentities/{id}/runs` ->
  `DataEntityRunController` -> `DataEntityRunServiceImpl` -> `ReactiveDataEntityTaskRunRepositoryImpl` +
  `DataEntityRunMapper`; UI `TestRunsHistory.tsx`):
  - **Defect 1 (HIGH) — HTTP 500 during an in-flight (RUNNING) run.** Wire/DB enum asymmetry -> mapper
    `Enum.valueOf` throws -> 500. The page is unavailable EXACTLY while a test runs (the common "I just retried it"
    case). **+ a latent FE crash** if only the BE is fixed (palette gap).
  - **Defect 2 (lesser UX) — NULL-end_time ordering** puts in-flight rows at the TOP of the list (Postgres NULLS
    FIRST default). Masked by Defect 1 today.
- **Mission relevance:** the DQ Test Run History page is the operator's primary diagnostic surface for "why did my
  DQ test fail / when did it last succeed / is it running now." A 500 during normal operational use forces a fallback
  to raw SQL, breaking the abstraction the platform exists to provide (`lineage/odd-platform/system-mission.md`,
  pillar Data Quality).
- **Architectural-significance check (G-C7): NO hard stop, NO ADR.** Adding `RUNNING` to the wire enum is **additive**
  (restores DB<->wire symmetry that should always have held; the DB already produces RUNNING rows). The only consumer
  of the platform's internal API is the platform's own React FE, updated in the same change -> non-breaking in
  practice. No `SecurityRule`/filter/token-flow/shipped-default changed; no migration; no destructive change. The
  NULLS-LAST ordering corrects a SQL default. No governing ADR exists (implicit-adrs.md mentions this area only as
  the *finding* this fix resolves).
- **Disclosure: PUBLIC.** Public issue, maintainer-authored. Normal public flow (draft PR on the main repo + one
  public root-cause/scope comment). NOT a GHSA — G-C14 does not apply.

## Change-request product analysis (G-C16 — added 2026-06-19 at the maintainer's direction)

The issue's **Defect 2 suggested fix** ("sort in-flight RUNNING rows to the BOTTOM via `NULLS LAST`") is **quoted
data, not a spec** — and on a product critique it is **wrong for ODD**. The maintainer challenged it at GATE 1; the
`odd-sme` consultation (`lineage/odd-platform/sme-consultations/2026-06-19-dq-run-history-in-flight-ordering.md`,
confidence HIGH) + my FE investigation confirm:

- **Restated user-problem (independent of the issue's fix):** an in-flight run is hard to *recognise* in the
  timeline — it shows a blank Duration and (pre-fix) no status, so it can look like an undated/broken row. The
  problem is *legibility of the in-flight state*, NOT its position.
- **ODD's own published manual** (the DOC-185 page) documents in-flight runs **at the top** with an empty Duration —
  `NULLS LAST` would contradict ODD's own guidance.
- **Industry convention is unanimous** (GitHub Actions, GitLab CI, dbt Cloud, Airflow, DQ monitors): the
  in-progress run is a **first-class status shown at the TOP** of the recency list, never demoted for lacking an
  end-time. "In progress" is a *status*, not an absence-of-end-time.
- **The real fix is Defect 1's `RUNNING` badge** (+ the status-filter dropdown auto-gaining "Running", since it is
  built from `Object.keys(DataEntityRunStatus)`), which makes the top row self-evidently in-flight. The history list
  uses **infinite scroll** (pageSize 100), so the only genuine ordering residue is **non-determinism** (no
  tiebreaker → a row can duplicate/skip across scroll loads — the F-040 `no_tie_breaker` finding).

**Verdict:** keep in-flight runs at the TOP; reject the issue's bottom-sort. The options below are the GATE-1
decision (the 500-fix + badge are IN for all of them):

| Option | Ordering | What the operator sees | Notes |
|---|---|---|---|
| **A (recommended)** | `end_time DESC NULLS FIRST` (explicit) `, start_time DESC, id DESC` | in-flight at **top**, badged "running"; completed below newest-first; stable under infinite scroll | reframes Defect 2 (top, not bottom); makes NULLS-FIRST explicit (no silent Postgres-default dependence) + a total order that closes the dup/skip risk. Issue scope comment explains the reframe. |
| **B** | unchanged (current implicit `NULLS FIRST`) | in-flight at **top**, badged "running" | smallest diff — the badge alone fixes the legibility complaint; the dup/skip determinism risk is left as a separate tracked item |
| **C** | `end_time DESC NULLS LAST, start_time DESC, id DESC` | in-flight at **bottom** | the issue verbatim — **product-wrong** per SME + ODD's own docs; listed for completeness |
| **D** | unchanged | in-flight at **top**, badged "running" | fix the 500 + badge only and **formally close Defect 2 as "won't implement as stated"** on the issue thread (the bottom-sort premise rejected; the badge resolves the UX) |

Recommended: **A** — it honors the product-correct top placement AND fixes the latent infinite-scroll dup/skip
(diagnose-the-class), for one extra sort field beyond B/D.

**CHOSEN: Option A** (RamanDamayeu, GATE 1, 2026-06-19).

## Clarify (G-C6)

**No clarifying question warranted.** The setup is fully specified (the shipped default odd-minimal stack), both
defects reproduced first-try, and the one real design choice (faithful `RUNNING` value vs. a lossy fallback) is
resolved by the issue's own framing (Option A recommended; B/C "lossy, not recommended") + best-practice judgment.
The FE-palette necessity is a verified fact, not a question. Asking would be noise.

## Reproduction log (G-C1 — live, working-tree SUT, odd-minimal AUTH=DISABLED)

Stack: `odd-platform:odd-team-sut` (the running probe stack), PG `probe-database`. Health `{"status":"UP"}`.
Seed: `POST /api/datasources` (`//repro1757`) + `POST /ingestion/entities` (dataset + DQ test
`//repro1757/ge/test/dq1` + 3 completed runs: FAILED 06-01, SUCCESS 06-02, SUCCESS 06-03). Resolved entity id = 3.

```
DEFECT 1 — HTTP 500 on an in-flight RUNNING row
[baseline] GET /api/dataentities/3/runs?page=1&size=10           -> 200  (3 completed runs, end_time DESC)
[inject]   INSERT data_entity_task_run(oddrn,task_oddrn,start_time,end_time,status,type,name)
             VALUES ('.../run/RUNNING1', '//repro1757/ge/test/dq1', NOW(), NULL, 'RUNNING', 'DATA_QUALITY_TEST_RUN', 'in-flight')
[repro]    GET /api/dataentities/3/runs?page=1&size=10           -> 500  {"code":"SYS001","message":"Internal Server Error",...}
           (root cause: DataEntityRunMapperImpl line 42 Enum.valueOf(DataEntityRunStatus,"RUNNING") -> IllegalArgumentException)

DEFECT 1b — status filter (page=1; the CORNER 2 baseline, captured for the G-C15 flip)
  status=FAILED  -> 200 (items=1)      status=SUCCESS -> 200 (items=2)
  status=RUNNING -> 400 (USR001)       status=BANANA  -> 400 (USR001)
  (RUNNING rejected at param-binding because it is not a wire-enum value; BANANA is an invalid literal)

DEFECT 2 — ordering (SQL level; the endpoint 500s before ordering is observable). Reframed by the product
analysis: in-flight-at-top is CORRECT; the real residue is the SILENT dependence on the Postgres default + NO
tiebreaker (dup/skip under infinite scroll). Option A keeps the top position, made explicit + deterministic.
  ORDER BY end_time DESC                                            -> RUNNING(NULL) FIRST  [current: top, but implicit NULLS FIRST + no tiebreaker]
  ORDER BY end_time DESC NULLS FIRST, start_time DESC, id DESC      -> RUNNING(NULL) FIRST, then 06-03, 06-02, 06-01  [OPTION A FIX: top, explicit, total order]
  ORDER BY end_time DESC NULLS LAST, start_time DESC                -> 06-03, 06-02, 06-01, then RUNNING(NULL)        [issue's suggestion — REJECTED (bury the freshest row)]
```

Decision (reproduce-first step 3): both are **bugs**, not documented/expected behaviour. The RUNNING row is the real
DB state a collector writes mid-run (`end_time=NULL`). Cleanup: the RUNNING row was removed; the endpoint returns to
200. (The harmless namespaced `repro1757` seed is left in the shared dev stack; IT-059 seeds its own `it059`
namespace independently.)

## Root cause (independently re-verified against source @ origin/main 525200f9)

### Defect 1 — wire/DB enum asymmetry (BE) + palette gap (FE)

- DB enum `IngestionTaskRun.IngestionTaskRunStatus` = **7** values incl. `RUNNING` (`IngestionTaskRun.java:28-36`).
- Wire enum `DataEntityRunStatus` = **6** values, **no `RUNNING`** (`components.yaml:1421-1429`).
- The DB POJO `DataEntityTaskRunPojo.status` is a **`String`** (jOOQ-generated). `DataEntityRunMapper`
  (`DataEntityRunMapper.java:13-14`) maps it `String -> DataEntityRunStatus`; the generated
  `DataEntityRunMapperImpl.java:42` is `Enum.valueOf(DataEntityRunStatus.class, run.getStatus())` -> throws
  `IllegalArgumentException` on `"RUNNING"` -> the WebFlux error handler returns 500.
- **FE (the FE/BE-contradiction class — LSN-031):** the badge component `TestRunStatusItem.tsx` styles via
  `TestRunStatusItemStyles.ts:25-26` -> `theme.palette.reportStatus[$typeName].background` /`.border`. The palette
  (`palette.ts:130-136`, and the parallel `runStatus` `:123-128`) has exactly the same 6 keys — **no `RUNNING`**.
  `theme.palette.reportStatus['RUNNING']` is `undefined` -> `.background` throws -> **FE render crash**.
  `palette.runStatus[...]` is consumed dynamically in 8+ surfaces (DataQualityContent, TestCategoryResults,
  TestRunStatusIcon, OverviewDQTestReport, LabeledInfoItem, ...) — all would crash on a RUNNING value.
  **TypeScript enforces the fix:** `interfaces.ts:53,55` declare `type ReportStatus = Record<DataEntityRunStatus,
  ItemColors>` and `type RunStatus = Record<DataEntityRunStatus, ItemColors>`, so once codegen adds `RUNNING` to the
  generated enum, `palette.ts` **fails to compile (tsc)** until both palettes gain a `RUNNING` entry. There is **no**
  existing `RUNNING` handling anywhere in the FE (grep) -> the issue's "UI already handles it" is false.

### Defect 2 — no NULLS-LAST / no total order

- `ReactiveDataEntityTaskRunRepositoryImpl.getDataEntityRuns` (`:160-191`) calls
  `jooqQueryHelper.paginate(baseQuery, DATA_ENTITY_TASK_RUN.END_TIME, SortOrder.DESC, ...)`.
- `JooqQueryHelper.getOrderFields` (`:156-161`) builds the sort as `table.field(f.orderField()).sort(f.sortOrder())`
  with **no null-ordering** -> Postgres `DESC` defaults to **NULLS FIRST** -> RUNNING rows (`end_time IS NULL`) sort
  to the TOP. There is also **no secondary sort key**, so rows with equal `end_time` have a non-deterministic order
  (the F-040 `no_tie_breaker` finding -> a latent dup/skip-across-pages risk for offset pagination).
- The issue's literal Defect-2 fix (a `.orderBy(...nullsLast())` at `:178`) does not apply as written — ordering
  flows through `paginate()`/`getOrderFields`, not a direct `.orderBy` (the issue itself corrected this).

## Plan  (GATE 1 artifact — design-before-build per G-C12; PENDING APPROVAL)

### Design-before-build (G-C12 / `playbooks/design-before-build.md`)

- **(a) Reuse-scan.** No new component is built.
  - *Defect 1 (BE):* extend the existing wire enum + reuse the existing `UNKNOWN` catch-all value for a tolerant
    fallback (a plain `default` method in the existing `DataEntityRunMapper` — NOT MapStruct `@ValueMapping`, which is
    unused in this codebase and has String-source subtleties at MapStruct 1.5.3).
  - *Defect 1 (FE):* reuse the existing `reportStatus`/`runStatus` palette structure + existing colour tokens — add a
    `RUNNING` row, no new mechanism.
  - *Defect 2:* reuse the existing `OrderByField` + `paginate(List<OrderByField>)` path; add an **opt-in**
    null-ordering to the record (the 2-arg constructor is preserved so all ~18 existing callers compile unchanged) —
    a gap-fill in a shared utility, not a parallel sorter.
  - *Integration test:* extend the existing **IT-059**, not a new protocol.
- **(b) ADR-check.** No ADR governs this area (implicit-adrs.md lists it as the finding, not an accepted decision).
  Adding `RUNNING` conforms to the DB enum as the source of truth for what statuses exist. The tolerant-fallback +
  null-ordering are local hardening of existing patterns, not new architecture -> no ADR proposed.
- **(c) Impact-dimension checklist.**
  - *i18n:* **none** — the status label renders via `typeName.toLowerCase()` (e.g. "running"), not a `t()` catalog
    key, identical to how SUCCESS/FAILED already render. No locale-file change (verified).
  - *generated clients (BE + FE):* the `components.yaml` enum change regenerates the BE `DataEntityRunStatus` (jOOQ/
    openapi gradle codegen — delete `build/generated` to force regen if needed, per the spec-codegen note) AND the FE
    TS enum (docker codegen). Both are gitignored/regenerated; tsc then enforces the palette. Both consumers compile.
  - *every consumer:* the only naive `String->DataEntityRunStatus valueOf` is `DataEntityRunMapper` (grep confirmed;
    `DataQualityCategoryMapper` maps records->category-results and does NOT valueOf a raw status -> no parallel 500).
    Adding RUNNING also lets `DataQualityRunStatusCount` (the dashboard count schema sharing the enum) represent
    RUNNING correctly. `OrderByField`'s 18 callers are unaffected (2-arg ctor preserved).
  - *migration:* none (no schema change; the DB column already stores 'RUNNING').
  - *docs + ontology:* `docs_routing` above (release/0.29.0 train, page read); F-040 + touched sidecars re-enriched
    (G-C10).
  - *tests:* unit (mapper + repo-ordering) + integration (IT-059 flip + a browser-level render check) — below.
- **(d) Product-Owner / SRE lens.** Operator value: in-flight runs become VISIBLE in the history (a RUNNING badge)
  and the page stops 500ing during the exact moment the operator is watching a re-run. **Ordering: see the
  Change-request product analysis (G-C16) above — in-flight runs stay at the TOP** (freshest, first-class status,
  per ODD's own docs + CI/DQ convention), made legible by the badge; the issue's "sort to the bottom" was rejected.
  The straightforward shape: a RUNNING run shows a distinct in-progress status badge + a blank Duration (it has not
  finished) — already the component's behaviour once the palette knows RUNNING. **UX colour choice:** RUNNING gets a
  distinct in-progress colour from the existing token palette (NOT SKIPPED's blue) — finalized + **screenshot-
  reviewed as a user (G-C12 step 5)** during impl, not just a green e2e.

### The changes

**Defect 1 (BE):**
1. `odd-platform-specification/components.yaml` — add `RUNNING` to `DataEntityRunStatus` (the 7th value, mirroring
   the DB enum). Placed adjacent to the in-flight semantics (final order finalized in impl; additive either way).
2. `DataEntityRunMapper.java` — add a tolerant default mapping method so the read endpoint degrades gracefully on any
   *future* unmapped DB status instead of 500ing again (class-level fix, not just the RUNNING instance):
   ```java
   default DataEntityRunStatus mapRunStatus(final String status) {
       if (status == null) {
           return null;
       }
       return Arrays.stream(DataEntityRunStatus.values())
           .filter(s -> s.name().equals(status))
           .findFirst()
           .orElse(DataEntityRunStatus.UNKNOWN);
   }
   ```
   MapStruct picks up this same-mapper method for the `String status -> DataEntityRunStatus status` field in place of
   the generated `Enum.valueOf`. (RUNNING now maps faithfully to RUNNING; UNKNOWN is the existing designated
   catch-all -> no behavioural change for any current value, only graceful degradation for a future drift.)

**Defect 1 (FE) — REQUIRED (tsc + runtime):**
3. `odd-platform-ui/src/theme/palette.ts` — add a `RUNNING` entry to BOTH `runStatus` and `reportStatus` (the
   `Record<DataEntityRunStatus, ItemColors>` types make this a compile requirement once the enum gains RUNNING).

**Defect 2 (BE) — IMPLEMENTATION SIMPLIFIED (2026-06-19, post-GATE-1, within the approved Option-A intent):**
Postgres `ORDER BY ... DESC` **already defaults to NULLS FIRST**, so in-flight (NULL end_time) runs already sort
to the TOP with the existing `END_TIME DESC` — the only real change Option A needs is the deterministic
**tiebreakers**. So steps 4-5 below (the `OrderByField` `NullOrdering` enum + the `JooqQueryHelper` switch) were
**NOT shipped** — they were redundant complexity (and a dead `NULLS_LAST` branch). The shipped change is item 6 alone,
using the EXISTING 2-arg `OrderByField`: `getDataEntityRuns` orders `[END_TIME DESC, START_TIME DESC, ID DESC]`
(in-flight at top via the Postgres default; total order via start_time + id). Same behaviour, fewer touched files
(`OrderByField.java`/`JooqQueryHelper.java` UNCHANGED). Steps 4-5 retained below only as the superseded plan.

4. ~~`OrderByField.java` — add an opt-in null-ordering component~~ (NOT shipped — see note above):
   ```java
   public record OrderByField(Field<?> orderField, SortOrder sortOrder, NullOrdering nullOrdering) {
       public OrderByField(final Field<?> orderField, final SortOrder sortOrder) {
           this(orderField, sortOrder, NullOrdering.DEFAULT);   // all ~18 existing callers unchanged
       }
       public enum NullOrdering { DEFAULT, NULLS_FIRST, NULLS_LAST }
   }
   ```
5. `JooqQueryHelper.getOrderFields` — apply the null ordering when set (`sf.nullsLast()` / `sf.nullsFirst()`),
   `DEFAULT` -> unchanged. (Applied consistently to both the `rowNumber()` window and the final `orderBy` -> the
   pagination `hasNext` stays consistent with the result order.)
6. `ReactiveDataEntityTaskRunRepositoryImpl.getDataEntityRuns` — order **per the GATE-1 option chosen** (see
   Change-request product analysis). **Recommended (Option A):** `[END_TIME DESC NULLS FIRST (explicit),
   START_TIME DESC, ID DESC]` — in-flight rows stay at the **top**, newest-in-flight first among themselves; `ID` is
   the final unique key -> a **total order** that closes the F-040 `no_tie_breaker` dup/skip-under-infinite-scroll
   risk and removes the silent dependence on the Postgres NULLS-FIRST default. (Option B/D: no ordering change;
   Option C: the issue's rejected `NULLS LAST`.) Steps 4-5 (`OrderByField` + `JooqQueryHelper`) are needed only if
   the chosen option changes ordering (A or C); B/D skip them.

### Tests (G-C9 — both buckets; G-C15 for every CHANGED test)

- **Unit (odd-platform CI):**
  - *`DataEntityRunMapperImplTest` (extend):* map a `Page<DataEntityTaskRunPojo>` whose row has `status="RUNNING"`
    -> assert `items[0].status == DataEntityRunStatus.RUNNING` (no throw); map `status="SOME_FUTURE_STATUS"` ->
    assert `UNKNOWN` (the tolerant fallback); the known values still map 1:1. RED-on-base: pre-fix the generated
    `Enum.valueOf` throws on "RUNNING" (the integration RED proof on `ref:main` is the unambiguous black-box
    demonstration — a unit assert on the new enum constant cannot compile against the old enum).
  - *NEW repo Testcontainers test (`extends BaseIntegrationTest`, Defect 2):* seed completed rows + a NULL-end_time
    row; call `getDataEntityRuns`; assert the NULL row is LAST and completed rows are end_time DESC. RED-on-base:
    revert the repo order spec -> NULLS FIRST -> the NULL row is first -> fails. GREEN on fix.
- **Integration (odd-team IT-059 — re-ground per LSN-029/G-C15; NEVER weaken):**
  - *CORNER 1 flip:* a RUNNING row -> the endpoint returns **200**, the RUNNING run is present with
    `status: "RUNNING"`, and it sorts **last**. SoT for the new expected value = the spec (RUNNING now a wire value)
    + the captured live 200. **RED survives on `ref:main`** (main returns 500 -> `toBe(200)` fails) -> the change
    corrects the test's *reading* and does not hide the bug.
  - *CORNER 2 update:* `status=RUNNING` -> **200** filtered to RUNNING rows (RUNNING now valid); `status=BANANA` ->
    **400** (UNCHANGED); `status=FAILED`/`SUCCESS` -> **200** (UNCHANGED). RED survives on `ref:main` (RUNNING->400
    there -> `toBe(200)` fails). Same-or-tighter oracle; no matcher weakened; no boundary mocked.
  - *NEW browser-level assertion (FE-crash verification, LSN-031):* drive the actual UI — navigate to the DQ test's
    run-history surface with a RUNNING row seeded, assert the run row renders with a "running" status badge (the
    page does NOT throw / show an error boundary) and the in-flight row is positioned last. The SUT bundles the UI
    (`odd-platform-api/build.gradle:17` `implementation project(':odd-platform-ui')`), so the working-tree SUT
    exercises the palette fix. (Reuse the established `page.goto` browser pattern, e.g. `dq-severity-render-bleed.spec.ts`.)
  - *Confirm* IT-059's happy-path UC-1 (pagination/ordering union) still GREEN.

### Regression (G-C2 — FULL set, both buckets, on the working-tree SUT; the impacted IT is the inner loop, not the gate)

- Unit: `scripts/run-platform-tests.sh` (no-arg = full `:odd-platform-api:build` — test + checkstyle + assemble).
- Integration (one e2e suite at a time; read actual pass/fail counts): `run-suite.sh feature-complete` (green) +
  `multi-stack` (green-target) + `known-bugs` (expected RED — watch for an unexpected GREEN = an un-flipped fix) +
  `ingestion-e2e` (green); + the IT-059 RED proof on `ODD_SUT=ref:main`.
- **Local patch-coverage gate (G-C13):** run the jacoco + 98% changed-files check locally (`DataEntityRunMapper`,
  `OrderByField`, `JooqQueryHelper`, the repo) — met here, not discovered in CI.

### Scope exclusions (G-C5 — deliberately NOT in this PR)

- **Caveat 2 — cross-owner read + `status_reason` diagnostic-text leak (F-040c).** A platform-wide RBAC posture
  decision (REFACTOR-024 family), not a DQ-runs-specific code fix; explicitly excluded by the issue + DOC-185. Stays
  documented as an operator caveat. NOT touched here.
- **The DQ dashboard aggregation path** (`DataQualityCategoryMapper` / `/api/dataqatests/runs`): inherits the now-
  complete enum but has no naive-`valueOf` 500 risk (verified) -> no change beyond the shared enum.
- **A dedicated "in-flight runs" UI section** (the issue's "better UX, separate PR if desired"): out of scope — the
  ordering fix (RUNNING grouped at the end) + the badge are sufficient for this issue. Not pursued.

### Drafted public comment (posts on GATE 1 approval — folded root-cause + scope, ONE comment, ASCII, no workspace IDs)

```
Reproduced both defects live on the shipped default (AUTH_TYPE=DISABLED), seeding a DQ test with a
RUNNING (in-flight, end_time=NULL) run.

Defect 1 (HTTP 500 on in-flight runs) confirmed: with a RUNNING row present, GET
/api/dataentities/{id}/runs returns 500. Root cause as described -- the DB status enum has RUNNING
but the wire enum DataEntityRunStatus does not, and the generated mapper's Enum.valueOf throws.
One addition to the report: the front end would ALSO break on RUNNING -- the run-status badge looks
up its colour from a theme palette that has no RUNNING entry (and there is no RUNNING handling
anywhere in the UI today), so fixing only the back end would turn the 500 into a UI render error.
The TypeScript palette type makes the UI fix a compile requirement once RUNNING is added.

Fix (this PR, milestone 0.29.0):
- add RUNNING to the wire enum so the mapper succeeds and the UI receives the real in-flight status;
- make the run mapper tolerant of any future unmapped status (degrade to UNKNOWN, never 500);
- add a RUNNING colour to the UI status palette;
- keep in-flight runs at the TOP of the list (where the freshest activity belongs, consistent with how the
  product presents in-progress runs) and make the order deterministic -- end_time DESC NULLS FIRST, then
  start_time DESC, then id -- so the infinite-scroll list can't drop or duplicate a row. (The report suggested
  moving running rows to the bottom; that would bury the most operationally-relevant row, so this keeps them at
  the top with a clear "running" badge instead.)

Covered by unit tests (the mapper maps RUNNING and degrades unknown statuses; the repository keeps NULL
end_time rows at the top deterministically) and the team's integration suite (the in-flight row now loads with a
200 and renders in the UI; status=RUNNING is now a valid filter).

Out of scope here (unchanged): the cross-owner visibility of run status_reason text -- that is a
platform-wide access-control topic, not specific to this endpoint, and stays as a documented caveat.
```

## Test / Docs / Ontology ledger (Phases D-E)

Implementation commit: **odd-platform `2d576799`** on `contrib/CTRIB-024-dq-run-history-running` (6 files, +139/-2).

| Item | Status |
|---|---|
| Spec: `RUNNING` added to `DataEntityRunStatus` (7 values == DB enum) | DONE (`components.yaml`) |
| BE: tolerant `DataEntityRunMapper.mapRunStatus` (RUNNING->RUNNING, unmapped->UNKNOWN, null->null) | DONE |
| BE: repo ordering `[END_TIME DESC, START_TIME DESC, ID DESC]` (in-flight at TOP via Postgres NULLS-first default; total order) | DONE — **simplified**: the `OrderByField`/`JooqQueryHelper` null-ordering enum was NOT shipped (redundant — DESC already defaults to NULLS FIRST); those two files are UNCHANGED |
| FE: `palette.ts` RUNNING (runStatus + reportStatus + 5 cyan tokens) | DONE |
| Unit `DataEntityRunMapperImplTest` (RUNNING maps; null->null direct; unmapped->UNKNOWN) | DONE — GREEN (targeted build); covers `mapRunStatus` 100% (the null branch needs a direct call — MapStruct null-guards the field path) |
| Unit repo Testcontainers ordering test (in-flight at top; deterministic total order via start_time+id) | DONE — GREEN (targeted build; generated SQL confirmed `... desc nulls first, start_time desc, id desc`) |
| IT-059 CORNER 1 re-grounded (500->200 + in-flight present + sorted TOP) | DONE — GREEN on working SUT |
| IT-059 CORNER 2 updated (status=RUNNING 400->200; BANANA 400; FAILED 200) | DONE — GREEN on working SUT |
| IT-059 NEW browser render check (RUNNING badge renders, no FE crash) | DONE — GREEN on working SUT (the FE/BE-contradiction proof; SUT bundled the fresh UI) |
| IT-059 full run on working SUT (c84a479c, then re-run on 2d576799) | **4/4 PASS** (run-log `2026-06-19-IT-059.md`, SUT digest sha256:f23582…); re-confirm on 2d576799 + RED proof on `ref:main` PENDING |
| Full unit build (gate + jacoco) on `2d576799` | **DONE — BUILD SUCCESSFUL 6m58s**; `DataEntityRunMapper` LINE 13/13 + BRANCH 2/2 = **100%** (G-C13 patch-coverage met locally, not in CI) |
| FULL integration regression on working SUT (2d576799, digest f23582…) | **`feature-complete` 302/302 PASS** · **`multi-stack` 9/9 PASS** · **`known-bugs` 3 expected-RED** (IT-004/PLT-052, IT-006/F-042, IT-007/PLT-086 — none related to this change; IT-004 injects `'WARNING'` not RUNNING, so the dashboard general-unknown-status crash stays its own out-of-scope pin; **no unexpected GREEN** = no un-flipped fix) · **`ingestion-e2e` 6/6 PASS**. G-C2 met. |
| RED proof (IT-059 on the pre-fix base) | **DONE — published `0.28.0`: 3 failed / 1 passed.** CORNER 1 (RUNNING→200), CORNER 2 (status=RUNNING→200), UI (running badge) all **FAIL** (the pre-fix base returns 500/400/no-badge); UC-1 (completed runs) passes. G-C15 satisfied — the re-grounded tests + the new UI test genuinely catch the bug (RED on the unfixed base, GREEN only on the fix). (`ref:main` SUT build OOM'd first — environmental; `published:0.28.0` is the equivalent pre-fix baseline, a docker pull.) |
| Docs update on release/0.29.0 (Caveat 1/3 -> fixed; keep Caveat 2) + paired DOC item | DONE — **DRAFT docs PR [#102](https://github.com/opendatadiscovery/documentation/pull/102)** into `release/0.29.0` (head `contrib/CTRIB-024-docs-runs-history` @ `316dd14`): HTTP-500 danger caveat REMOVED; status param + filter list gained `RUNNING`; Sort section + in-flight info hint revised (in-flight at top, "running" badge, deterministic order); cross-owner status_reason caveat KEPT. Paired **DOC-471** (`backlog/docs/DOC-471.md`, milestone:0.29.0, status pending-release) tracks the live-verify at the release gate. PUSH of the doc branch/PR PENDING (Phase E, with the code push). Page READ first (G-C10). Concrete edits for 0.29.0: (1) add `RUNNING` to the `status` param values (line 31) + the filter list (line 13) + the response status set; (2) Caveat 1 (danger, HTTP 500) -> REMOVE/replace — the 500 is fixed; in-flight runs now load and show a "running" badge; (3) Caveat 3 (info, "undated-looking" at top) -> REVISE — in-flight runs stay at the TOP but now carry a clear "running" status badge (not undated), the 500 interaction is gone, ordering is a deterministic total order; (4) Sort section (line 39) -> note in-flight-at-top + badge; (5) KEEP Caveat 2 (warning, cross-owner status_reason leak — REFACTOR-024, out of scope). Routed on the documentation `release/0.29.0` train; paired DOC item milestone:0.29.0 pending-release. |
| Ontology: F-040 drift classes annotated resolved + committed | DONE — `F-040.yaml` `drift_class_summary`: the 3 resolved drifts (RUNNING-500, nulls-ordering-undated, no-tiebreaker) annotated `# RESOLVED 2026-06-19 (#1757)`. Graph re-embed (9853 nodes) DEFERRED-with-rationale: a single-node annotation does not warrant a full-graph re-embed (no incremental embed tool); the F-040 *file* is the ontology truth and is committed — the embed rides the next ontology batch. No per-node sidecar exists for the touched code nodes (the feature-flow F-040 is the artefact). |
| Principal sufficiency (G-C13) + G-C12 step 5 (look at the pixels) | DONE — changed-file coverage 100% (local, not CI); meaningful tests (RED on the pre-fix base, GREEN on the fix); no control lost (the change REMOVED complexity — `OrderByField`/`JooqQueryHelper` untouched); full regression green. **Visual review (screenshot `it059-running-badge.png`):** the in-flight run renders at the TOP with a distinct, legible cyan `running` badge (dark text on light cyan, same pill as the other statuses, not confusable with SKIPPED-blue / SUCCESS-green) and a blank Duration (in progress). The invented cyan tokens are validated. |
| Draft PR `Closes #1757` + status | DONE — **DRAFT PR [#1793](https://github.com/opendatadiscovery/odd-platform/pull/1793)** (odd-platform) + **docs PR [#102](https://github.com/opendatadiscovery/documentation/pull/102)** (documentation@release/0.29.0). Status `pr-draft` — never self-merged; `/review` (separate session) owns review-ready, GATE 2 (human) owns the merge. |

## GATE 1 — APPROVED (2026-06-19)

Plan approved by RamanDamayeu (Option A); root-cause/scope comment posted
([#1757 comment](https://github.com/opendatadiscovery/odd-platform/issues/1757#issuecomment-4753848936));
implementation shipped on `contrib/CTRIB-024-dq-run-history-running` @ `2d576799`. GATE 2 (human merge) is the
remaining gate.

## Review (2026-06-19, session: opus-4-8 separate-session `/review`)

- **Result**: ACCEPTED → `pr-draft` → `review-ready` (contributor flip; the human GATE 2 owns the merge → `done`. Milestone item: the human merge records `pending-release`, the `0.29.0` release gate owns `done`.)

**Reviewed artifacts**: odd-platform `2d576799` (the fix, 6 files +139/-2) on `contrib/CTRIB-024-dq-run-history-running`; documentation `316dd14` (`docs/data-quality/test-run-history.md`) on `contrib/CTRIB-024-docs-runs-history` → DRAFT PR #102 into `release/0.29.0`; the odd-team commit `789b880` (IT-059 re-ground + F-040 annotation + DOC-471). DRAFT PR #1793 (`Closes #1757`).

### Acceptance criteria / DoD ledger — verified one-by-one
- [x] Spec `RUNNING` added to `DataEntityRunStatus` (7 == DB enum) — PASS (`git show 2d576799 -- components.yaml`: one additive value between `ABORTED` and `UNKNOWN`).
- [x] Tolerant `DataEntityRunMapper.mapRunStatus` (RUNNING→RUNNING, unmapped→UNKNOWN, null→null) — PASS (read the diff: `Arrays.stream(values()).filter(name==).findFirst().orElse(UNKNOWN)`; class-level fix, not just the RUNNING instance).
- [x] Repo ordering `[END_TIME DESC, START_TIME DESC, ID DESC]` via the EXISTING `List<OrderByField>` `paginate` overload — PASS (`ReactiveDataEntityTaskRunRepositoryImpl:174-187`; `OrderByField`/`JooqQueryHelper` reverted to baseline vs the earlier `c84a479c` — the "simplified" Option-A path; in-flight at top via Postgres `DESC` NULLS-FIRST default).
- [x] FE `palette.ts` `RUNNING` in `runStatus` + `reportStatus` (+ 5 cyan tokens) — PASS (read the diff; `Record<DataEntityRunStatus,_>` makes it a tsc requirement once the enum gains RUNNING).
- [x] Unit `DataEntityRunMapperImplTest` (RUNNING maps; null→null direct; unmapped→UNKNOWN) — PASS (read the diff: 3 meaningful **added** tests, no existing assertion changed). Reviewer's own full build GREEN.
- [x] Unit `DataEntityRunRepositoryImplTest` Testcontainers ordering — PASS (read the diff: a 6-row seed proving in-flight-at-top + `start_time DESC` tiebreaker among in-flight + `id DESC` final tiebreaker for identical `(end_time,start_time)` — midB before midA — directly tests the F-040 no-tiebreaker fix; **added**, real Postgres via `BaseIntegrationTest`).
- [x] IT-059 CORNER 1/2 re-grounded; NEW UI render check — PASS (G-C15 below).
- [x] Full unit build on `2d576799` — **PASS (reviewer's OWN run: `BUILD SUCCESSFUL in 8m 58s`, incl. `checkstyleMain`+`checkstyleTest`)**, not the ledger's claim alone.
- [x] FULL integration regression on the reviewed commit — PASS (suites built from working-tree @ `2d576799`: `feature-complete` `api:PASS e2e:PASS` @0fa59dba; `multi-stack` `e2e:PASS` @825aa02f; `ingestion-e2e` `e2e:PASS` @bdd3cb07; `known-bugs` `e2e:FAIL`=expected-RED @99e82b2d; `IT-059` `e2e:PASS` @e48dc3).
- [x] RED proof on the pre-fix base — PASS (IT-059 run-log entry 3: ghcr pre-fix image @0b0391 → `e2e:FAIL`; CORNER 1/2 + UI badge fail on the unfixed base, UC-1 passes).
- [x] Docs on `release/0.29.0` + paired DOC-471 — PASS (page diff verified; DOC-471 `pending-release` milestone `0.29.0`).
- [x] Ontology F-040 drift classes annotated resolved + committed — PASS (`F-040.yaml:13-15`, committed `789b880`, 3 drift classes `# RESOLVED 2026-06-19 (#1757 / CTRIB-024)`).

### Quality Bar — contributor gates
- **G-C1 (reproduce-first)** — PASS via the `reproduced:` field + the Reproduction log (live working-tree SUT, AUTH=DISABLED, entity id 3): 200→500 on the RUNNING `INSERT`; status-filter baseline captured.
- **G-C2 (verify the running system, full regression both buckets)** — PASS via reviewer's own unit build (BUILD SUCCESSFUL 8m58s on `2d576799`) **and** the full integration regression evidenced on SUTs built from the reviewed commit (see ledger). Known-bugs `e2e:FAIL` confirmed as the 3 expected pins (IT-004/006/007) with **no unexpected GREEN**: IT-004 injects `WARNING` (not RUNNING) and this change adds only a `RUNNING` palette key, so `palette.runStatus["WARNING"]` stays undefined → IT-004 stays RED; none of the 3 known-bug specs touch the runs path (`grep` confirmed).
- **G-C3 (GATE 1)** — PASS via `plan_approved_by`/`plan_approved_at` + the posted scope comment.
- **G-C4 (GATE 2)** — N/A at review (the human merge is the remaining gate; the bot opened PR #1793 as DRAFT).
- **G-C5 (bounded by the plan)** — PASS via the 6-file diff matching (and narrower than) the Option-A plan; scope comment posted (`plan_scope_comment_url`); scope exclusions (Caveat 2 RBAC / dashboard aggregation / dedicated in-flight UI) honoured.
- **G-C6 (one-question clarify)** — PASS via the recorded "no question warranted" with justification.
- **G-C7 (irreversible blast radius)** — PASS: additive enum value, no migration, no auth/security-posture change, no breaking wire contract → no ADR. `adr_required:false` correctly reasoned.
- **G-C8 (issue is data)** — PASS: the issue's stale `SCHEDULED`/drop-`UNKNOWN` YAML and "UI already handles it" were independently re-verified against code and rejected.
- **G-C9 (test integrity, both buckets)** — PASS: unit (mapper + repo Testcontainers) + integration (IT-059 endpoint corners + a browser render check). The UI badge IT is mandatory here (FE/BE contradiction, LSN-031) and present.
- **G-C10 (ontology + docs move with code)** — PASS: docs PR #102 on `release/0.29.0` (page **read** first), F-040 annotation committed, DOC-471 paired. *Caveat:* one affected sibling doc page missed (dashboard.md) → logged **DOC-472**, see below. Graph re-embed deferred-with-rationale (single-node annotation; rides the next ontology batch) — acceptable.
- **G-C11 (milestone)** — PASS: milestone `0.29.0` (open, semver, due 2026-06-22); the issue body's stale `0.28.0` correctly superseded.
- **G-C12 (design before build)** — PASS on reuse-scan / ADR-check / PO-SRE lens. **Partial miss on the impact-dimension checklist**: the doc dimension was scoped to one page and missed the sibling dashboard.md that cross-references the run-status set → DOC-472 (non-blocking; on the same train, caught before the release gate).
- **G-C13 (principal sufficiency)** — PASS: enough + meaningful tests (RED on the pre-fix base, GREEN on the fix; the repo test exercises both tiebreakers); local build green incl. checkstyle; the change REMOVED complexity (`OrderByField`/`JooqQueryHelper` untouched vs baseline) — no control lost; full regression green. Patch-coverage 100% on `DataEntityRunMapper` (ledger; the build did not fail a coverage gate).
- **G-C14 (private advisory)** — N/A (public issue).
- **G-C15 (test-change integrity)** — PASS. The two CHANGED IT-059 corners are legitimate re-groundings: (1) new expected values trace to an **independent SoT** — the spec (`RUNNING` now a wire value) + a captured live 200 — not the system's current output; (2) the oracle is **strengthened** (CORNER 1 adds present/status/top-position assertions; CORNER 2 keeps `BANANA`→400 to prove it is not a swallow-all catch-all) — nothing weakened, no boundary mocked, nothing skipped; (3) **the RED survives** on the pre-fix base (run-log: pre-fix image `e2e:FAIL`; on `ref:main` the request 500s / `status=RUNNING`→400, so `toBe(200)` fails). The new UI test is a pure addition. The unit tests are pure additions (no existing assertion changed).
- **G-C16 (change-request product analysis)** — PASS (exemplary — this item is the gate's own case-law): the issue's "sort in-flight to the BOTTOM" was restated as a legibility problem, critiqued against `odd-sme` + ODD's own manual + CI/DQ convention, enumerated as options incl. reshape/rescope/revoke, and surfaced as the GATE-1 decision (Option A, top + badge) — never silently absorbed.

- **Gate 8 (publishing standards)** — **PENDING-RELEASE (0.29.0)**. The page rides the documentation `release/0.29.0` train; live-site WebFetch is scheduled at the release gate. Branch-verifiable sub-checks run now: PyYAML frontmatter parses; `description` 188 chars (≤200); tree-relative links only (no raw GitHub URL). Post-merge verify URL: `https://docs.opendatadiscovery.org/.../data-quality/test-run-history` — phrases: "Running" in the status filter + `status` param; the in-flight-at-top + `running` badge + deterministic-order Sort copy; the HTTP-500 danger caveat ABSENT; the cross-owner `status_reason` warning caveat PRESENT.
- **Gate 11 (audience isolation)** — PASS: mechanical grep of the published page is CLEAN (no `Cornerstone`/`Gate N`/`LSN`/`REFACTOR-NNN`/`F-040`/`CTRIB`/`G-C` leak).

- **Outbound URL sweep**: page links are tree-relative (`../data-discovery/statuses.md`, `dashboard.md`, etc.); none broken at the source tree; the live GitBook fetch is deferred to the 0.29.0 release gate (DOC-471).
- **Banned-phrase check**: none used.
- **Regressions**: none. Unit build GREEN on `2d576799`; full integration regression GREEN/expected-RED on the reviewed commit; the palette change is purely additive (no existing key modified); shared utilities (`OrderByField`/`JooqQueryHelper`) are byte-identical to baseline.
- **Navigation**: no `navigation/domains/*.md` pointer shifted (the change is within already-mapped DataEntityRun nodes). 4 uncommitted `lineage/**` files at session start (`feature-flows.yaml`, `probe-runs/…P-001`, `…getDataEntityDetails`, `…getPopular`) are PRE-EXISTING drift unrelated to CTRIB-024 (different endpoints) — not this item's deliverable; left untouched (review is read-only on lineage).
- **Upstream issues logged**: none (no upstream-code defect discovered; the fix is the resolution).

### Doc-product editorial audit (ran per `playbooks/doc-product-editorial-read.md`)
- **Coverage this run**: `docs/data-quality/**` end-to-end + a tree-wide grep for stale references to the now-fixed RUNNING-500 / six-value-enum / "undated" behaviour. (Other subtrees were covered by prior `/review` runs; no new partition needed this run.)
- **Findings**:
  - **DOC-472** (high, parallel-surfaces-with-drift) — `docs/data-quality/dashboard.md:22` calls the run-status set "the same six statuses as the per-test Test Run History status filter"; this change makes that filter SEVEN (adds Running), so the manual self-contradicts across two linked pages once 0.29.0 ships, and a Running breakdown slice can now render instead of blanking. Source: `documentation` `docs/data-quality/dashboard.md:22`. Logged `backlog/docs/DOC-472.md`, milestone `0.29.0`, on the same train. (This is also the G-C12 impact-checklist partial miss above.)
  - The tree-wide stale-reference grep found only **unrelated** HTTP-500 mentions (lineage `lineage_depth`, metrics body-cap, schema-diff, multi-instance session, GenAI timeouts, search tsquery) — none reference the DQ runs-history 500; no other page enumerates the six-value run-status set. `none other surfaced this run`.

### Notes — minor workspace-internal hygiene (NOT gate failures; recommended fold-ins, none ship upstream)
1. **Ledger digest mis-citation** — the DoD ledger rows cite the full integration regression at "digest f23582…", but f23582 is the **`c84a479c` IT-059** SUT (an earlier, amended-away commit). The actual full-regression suites ran on SUTs freshly built from `2d576799` (digests 0fa59dba / 825aa02f / 99e82b2d / bdd3cb07; IT-059 at e48dc3). The GATE was met on the reviewed commit; only the digest citation is wrong. VERIFIED via the four `2026-06-19-{suite}.md` run-logs. Recommend correcting the ledger digest.
2. **Stale e2e JSDoc header** — `integration-tests/e2e/specs/dq-run-history.spec.ts:13-23` still describes CORNER 1 as "makes the endpoint 500 … KNOWN BUG" and "status=RUNNING/BANANA ⇒ 500", contradicting the re-grounded test bodies (and the pre-fix CORNER-2 was 400, not 500). The test titles + inline comments ARE correct; only the top doc-comment block is stale. Odd-team-internal (does not ship in PR #1793). Recommend updating the header at GATE 2 / a follow-up commit. NOT VERIFIED as fixed → noted here as the on-disk record (too trivial for a tracked item; folds into the next touch of this spec).
3. **RED-proof image label** — the ledger/commit say the RED proof was on `published:0.28.0`; the IT-059 run-log entry 3 records `ghcr…:latest` (@0b0391). Both are pre-fix; the RED is valid either way. Minor citation inconsistency.
4. The stale `## GATE 1 — PENDING` trailing section (which contradicted the implemented state) was replaced with `## GATE 1 — APPROVED` + this verdict during review (item-file cleanup).
