## REFACTOR-650 — DataEntityRunController's runs-history list orders by `end_time DESC` with NO `NULLS FIRST/LAST` directive — Postgres default for DESC is NULLS FIRST → RUNNING rows (with end_time=NULL) appear at the TOP of the list, undated-looking with no visual signal

**Severity**: MEDIUM
**Category**: ordering-NULLS-FIRST-surprise
**Batch**: ZG (2026-05-25)
**Pillars affected**: [P-04 Data Quality]

**Surfaced by**:
- `odd-platform__java__DataEntityRunController__controller-class__DataEntityRunController.md:bugs_limitations_corner_cases.[2]` (MEDIUM) — "**NULL end_time ordering not specified** — when a row has `end_time = NULL` (RUNNING task), the JOOQ paginate emits `ORDER BY end_time DESC` with no `NULLS FIRST/LAST` directive (ReactiveDataEntityTaskRunRepositoryImpl.java:178, JooqQueryHelper.java:74-89). Postgres default for DESC is NULLS FIRST, so RUNNING rows appear AT THE TOP of the runs list. The UI labels each row by `startTime` (TestRunItem.tsx:30) with an empty Duration column when endTime is null (TestRunItem.tsx:53-57); operator sees an undated-looking row first, with no visual signal that it represents an in-flight test."

**Statement**: The runs-history SQL emits `ORDER BY end_time DESC` (`ReactiveDataEntityTaskRunRepositoryImpl.java:176-182`, `JooqQueryHelper.java:55-90`) with no NULLS directive. Postgres's default for `DESC` is `NULLS FIRST`, so rows with `end_time IS NULL` (RUNNING tasks, where the task hasn't ended yet) appear AT THE TOP of the result. The UI renders these rows via `TestRunItem.tsx:25-60`:
- Leftmost column `startTime` — labelled correctly
- Duration column — empty (because `endTime - startTime` is NaN when endTime is null)
- Status column — would render RUNNING badge IF the wire schema included RUNNING (but it doesn't — see REFACTOR-649; the mapper throws before the UI sees the row, so this hypothetical render path is currently unreachable)

The compound failure mode with REFACTOR-649: when a RUNNING row exists, the mapper throws HTTP 500 → operator never sees the row. IF the mapper were fixed (REFACTOR-649 Option A or B), the operator would see the RUNNING row AT THE TOP with no visual signal that it's in-flight. The ordering decision compounds with the wire-schema gap.

**Evidence**:
- SQL ordering: `ReactiveDataEntityTaskRunRepositoryImpl.java:176-182` (`paginate(..., DATA_ENTITY_TASK_RUN.END_TIME, SortOrder.DESC, ...)`)
- JOOQ paginate emits no NULLS directive: `JooqQueryHelper.java:55-90` (`.orderBy(...)` without `.nullsFirst()` / `.nullsLast()`)
- UI rendering: `TestRunItem.tsx:25-60` (leftmost column startTime; Duration column empty when endTime null)

**Existing-ADR-or-implied-prescription**: no governing ADR. The ORDER BY decision is implicit at the paginate helper layer; the NULLS-handling decision was not made.

**Proposed remedy**: add `.nullsLast()` to the paginate helper's SQL emission (one line in `JooqQueryHelper.java`). RUNNING rows then appear at the bottom of the list, matching the operator's expectation of "most-recently-completed first, in-flight at the end." Alternatively, add a parallel surface (`/runs/in-flight`) for in-flight tests and exclude RUNNING from the main listing.

**Severity rationale**: MEDIUM — UI-rendering surprise; not a security or data-integrity bug. The bug is currently masked by REFACTOR-649 (HTTP 500 short-circuits the render path); fixing REFACTOR-649 without fixing this REFACTOR moves the issue from "page broken" to "page confusingly ordered."

**Suggested backlog grouping**: `Quality Dashboard observability sprint` (paired with REFACTOR-649 — wire-enum asymmetry).

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-347 (`listByOddrns` SQL pagination has NO ORDER BY clause) — the same shape on a different surface; the paginate helper layer is the shared root cause for both.
- SUPERSEDES: none.
- CONFLICTS: none.

---
