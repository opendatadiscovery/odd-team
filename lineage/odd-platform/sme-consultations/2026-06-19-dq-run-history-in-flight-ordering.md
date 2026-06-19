---
artefact: sme-consultation
project: odd-platform
consulted_at: 2026-06-19T00:00:00Z
consulted_by: maintainer-direct
consultation_question: "In the per-DQ-test run-history timeline (F-040), where should a currently-RUNNING (in-flight) run appear and how should it be signalled — is issue #1757's 'sort in-flight runs to the bottom via NULLS LAST' product-correct for ODD?"
slug: dq-run-history-in-flight-ordering
confidence_overall: HIGH
prompt_version: odd-sme/0.1.0
---

# Where an in-flight DQ run belongs in the run-history timeline (F-040), and how to signal it

## TL;DR

Issue #1757's "sort in-flight runs to the bottom via `NULLS LAST`" is **product-wrong for ODD**. Across every comparable run-history surface that documents the behaviour, an in-progress execution is treated as a **first-class, most-recent row shown at the top** of a recency-sorted list, carrying an explicit live "running/in-progress" indicator — never buried below completed runs. The current ODD behaviour already puts the in-flight row at the top (Postgres `NULLS FIRST` on `end_time DESC`); the real defect is that the row is **undated and unbadged**, not that it is at the top. The correct fix is to **keep the in-flight run at the top and add a `RUNNING` status badge + "started X ago" affordance** (the separate badge fix the maintainer references), not to move it down. `NULLS LAST` would actively regress the operator's primary diagnostic question ("is it running right now?") by hiding the answer at the bottom of a paginated, infinite-scroll list.

## Question scope

The maintainer asked one decision with two coupled halves:
1. **Position** — top / bottom / separate section for a `RUNNING` row (`end_time = NULL`) in the recency-sorted `/history` timeline.
2. **Signal** — what in-progress affordance the row should carry (status badge / spinner / live-or-blank duration / "started X ago").

Plus an explicit verdict on whether #1757's `NULLS LAST` recommendation is product-correct.

**Archetype:** plausibility + comparative (a UX-convention call validated against ODD's own stated convention and the prevailing industry pattern).

**Out of scope** (named so the caller knows where this ends): the *separate* HTTP-500-on-RUNNING availability bug (the wire/DB enum asymmetry, F-040-UC-2 → PLT-144) is a hard precondition — if the page 500s, ordering is moot. This note assumes that bug is fixed (the mapper tolerates `RUNNING` or it is added to the wire enum) and answers the ordering/signalling question that remains. I do not re-litigate the enum fix here.

## Domain plausibility

**Operator workflow this serves** (Rule 4 — "Diagnose a stale/failing DQ test"): a data-quality engineer opens the History tab on a DQ test precisely because something looks off, and their first three questions are *"is it running right now? when did it last succeed? what failed?"*. The "is it running right now?" question is answered by the freshest row. Burying the only row that answers it at the bottom of a 100-row, infinite-scroll list (TestRunsHistory page-size 100, `ReactiveDataEntityTaskRunRepositoryImpl` no cap) directly defeats the workflow that brings the operator to the page. This is a HIGH-PLAUSIBILITY "first-class in-progress row at the top" judgment.

**Against ODD's own surface:** ODD's live doc page (`/features/data-quality/test-run-history`, verified 200 this session) **describes** the current state without prescribing a target convention. Quoted: *"The list is sorted by end-time, most recent first — the run that finished last is at the top"* and *"Rows whose `end_time` is `NULL` (in-flight runs that have started but not finished) sort to the top under Postgres' default `NULLS FIRST` ordering for `DESC`."* It tells the operator *"Treat any row with an empty Duration as in-flight; the platform will repopulate the row when the run completes."* So ODD's *documented, shipped* convention is already **in-flight-at-top** — #1757 would contradict ODD's own published manual, which an operator has now been told to rely on.

**Verdict on #1757:** PRODUCT-WRONG for ODD. `NULLS LAST` optimises for a code-purity intuition ("undated rows look broken at the top, push them down") at the cost of the operator's primary question. The maintainer's read is correct: a running test is the freshest, most operationally-relevant row. The "undated row at the top" complaint is real but its fix is a **badge**, not a **demotion**.

## Industry vocabulary alignment

- **Canonical industry term:** the in-progress state is universally a **first-class run status** co-listed with terminal states, not a null/absence. GitHub Actions' REST API documents the status enum as *"`completed`, `action_required`, `cancelled`, `failure`, `neutral`, `skipped`, `stale`, `success`, `timed_out`, `in_progress`, `queued`, `requested`, `waiting`, `pending`"* — `in_progress` and `queued` sit in the same enum as the terminal conclusions (verified this session). GitLab CI documents `running` and `pending` as pipeline statuses alongside `passed`/`failed`/`canceled`/`skipped`, and surfaces a running pipeline with first-class actions: *"cancel a running pipeline, retry failed jobs, or delete a pipeline"* (verified this session).
- **ODD's term** (per `concepts.yaml` / F-040): the DB enum `IngestionTaskRunStatus` already has **`RUNNING`** as one of seven first-class values (`SUCCESS|FAILED|SKIPPED|BROKEN|ABORTED|RUNNING|UNKNOWN`, `IngestionTaskRun.java:28-36`). The wire enum `DataEntityRunStatus` is the one missing it (six values, `components.yaml:1407-1415`). So ODD's own data model already agrees with the industry: `RUNNING` is a status, not an absence-of-end-time.
- **Recommended alignment:** **re-align the wire enum to the DB enum** — add `RUNNING` to `DataEntityRunStatus` so the in-flight row carries a *named status the UI can badge*, exactly as GitHub/GitLab do. This is the same change F-040-UC-2's fix demands for the 500 bug; the ordering fix and the availability fix share one root cause (the missing wire value). Do not invent a new ODD-specific vocabulary for "in flight"; `RUNNING` already exists.

## Implicit requirements (functional / security / performance / reliability)

- **Functional:** The in-flight row must remain at the **top** of the recency order and must be **visually distinguishable from a completed run** — a `RUNNING` status badge (matching the existing status-badge vocabulary the History table already renders) and a Duration cell that reads as live/ongoing rather than blank (e.g. "started 4m ago" or a live-ticking elapsed, not an empty cell). *(citation: ODD doc page "Treat any row with an empty Duration as in-flight" — the current blank cell is the confusing affordance the operator complained about; GitLab/GitHub treat running as a badged status — no citation that ODD must match exactly, domain knowledge.)* Confidence: HIGH.
- **Security:** unchanged by this decision — the cross-owner read + `status_reason` PII leak (F-040-UC-3, REFACTOR-024) is orthogonal to ordering and must not be conflated with this fix. *(citation: F-040.yaml UC-3.)* Confidence: HIGH.
- **Performance:** the in-flight rows are a tiny, bounded set (a test has very few concurrent runs), so keeping them at the top costs nothing; **but** the existing single-key `ORDER BY end_time DESC` with no tie-breaker (F-040-UC-12 / P-150) means the *boundary between in-flight rows and the newest completed row* can churn across infinite-scroll pages. If a `RUNNING`-first ordering is made explicit, add a deterministic secondary key (e.g. `start_time DESC, id DESC`) so the in-flight block has a stable internal order. *(citation: F-040.yaml UC-12, `ReactiveDataEntityTaskRunRepositoryImpl.java:176-182`.)* Confidence: HIGH.
- **Reliability:** the ordering fix is **gated on** the HTTP-500-on-RUNNING fix (F-040-UC-2 / PLT-144). Shipping `NULLS LAST` (or any ordering change) without fixing the 500 is pure churn — the page is unreachable whenever a `RUNNING` row exists, so no operator ever sees the order. Sequence the enum/mapper fix first, then the badge + ordering affordance. *(citation: F-040.yaml UC-2, `DataEntityRunMapper.java:13-14`.)* Confidence: HIGH.

## Operator workflows this feature participates in

- **Diagnose a stale/failing DQ test** (Rule 4): the in-flight-at-top row is the answer to "is a retry running right now?" — the maintainer's exact scenario ("the operator just retried a failing test"). Top placement + RUNNING badge makes the retry immediately visible; bottom placement hides it.
- **Audit data quality across a domain** (Rule 4, escalation): a steward scanning a test's recent history wants the live state at a glance; a badged top row gives "currently running, last result FAILED 1h ago" in one read.

## Competitor comparison

| System | Equivalent surface | In-progress position + indicator | URL (verified this session) |
|---|---|---|---|
| GitHub Actions | Workflow run history list / runs API | `in_progress` + `queued` are first-class statuses co-listed with terminal conclusions in the same enum; runs are surfaced newest-first in the run list (status enum verified; the prose run-list ordering page rendered as a link-hub and could not be quoted — see Caveats) | https://docs.github.com/en/rest/actions/workflow-runs |
| GitLab CI | Pipelines list | `running`/`pending` are documented pipeline statuses alongside passed/failed; a running pipeline carries first-class inline actions ("cancel a running pipeline, retry failed jobs") — i.e. it is shown and actionable in the list, not hidden | https://docs.gitlab.com/ci/pipelines/ |
| dbt Cloud | Run history dashboard | Documents tracking "the progress of runs in progress" in the same run-history dashboard as completed runs; explicit top/bottom ordering not stated on the page (see Caveats) | https://docs.getdbt.com/docs/deploy/run-visibility |

The convergent signal across the two systems that *do* document it explicitly: **in-progress is a first-class status, shown in-line with completed runs, with its own indicator and actions — never demoted to the bottom.** None documents a "push running to the bottom" pattern.

## Recommended framing for the caller

> Keep the in-flight (`RUNNING`) run at the **top** of the recency-sorted History timeline — it is the operator's freshest, most diagnostic row and ODD's own published manual already tells operators to expect it there. Reject #1757's `NULLS LAST` demotion: the "undated row" complaint is fixed by a **`RUNNING` status badge + live/"started X ago" duration**, not by hiding the row. This requires adding `RUNNING` to the wire enum `DataEntityRunStatus` (the same root-cause fix that resolves the HTTP-500-on-RUNNING bug, PLT-144), so sequence the enum/mapper fix first; then the badge and a deterministic secondary sort key (`start_time DESC, id DESC`) give the in-flight block a stable, clearly-signalled position at the top.

One-paragraph expansion: the industry treats `running`/`in_progress` as a status, not as "an end_time we don't have yet." ODD's data model already agrees (the DB enum has `RUNNING`); only the wire contract and the UI affordance lag. Aligning the wire enum closes three F-040 facets at once — the 500 (UC-2), the unfilterable `?status=RUNNING` (UC-4), and the undated-row UX (UC-9) — and makes the ordering question self-resolving: a badged `RUNNING` row at the top is correct and legible, whereas a `NULLS LAST` row at the bottom is both wrong-for-the-workflow and still undated.

## Caveats and uncertainty

- **Thin marketing/UI doc prose.** Several product UI pages (GitHub Actions "view workflow history", Airflow Grid view, Jenkins build history, GitLab pipelines, Soda Cloud) either 404'd at the URLs tried or rendered in WebFetch as link-hubs / generic copy without the specific "newest-at-top + running indicator" prose I wanted to quote. The verdict therefore rests on the **status-enum evidence** (GitHub Actions REST `in_progress`/`queued` as first-class; GitLab `running` + cancel/retry actions) plus **ODD's own doc page**, which is sufficient and convergent — but I could not pin a single sentence that says verbatim "the in-progress run is rendered at the top." That specific UI-prose claim is `confidence: MEDIUM`; the "in-progress is first-class and not demoted" claim is `confidence: HIGH`.
- **What would fully close it:** a screenshot-level confirmation (or a reachable UI doc page) from GitHub Actions / dbt Cloud showing the running row at list position 0 with its spinner. Not required for the verdict — the recommendation does not change — but it would upgrade the UI-prose claim to HIGH.
- **Adjacent question worth a follow-up (not this consultation):** whether ODD should add a `QUEUED`/`SCHEDULED` distinction (GitHub/GitLab both separate `queued` from `running`). ODD's DB enum has no `QUEUED`; if ODD ever models pre-execution state, the same "first-class, top-of-list, badged" logic applies. Defer.

## Citations

- `lineage/odd-platform/feature-flows/detail/F-040.yaml` (read 2026-06-19) — drift facet `nulls_first_ordering_running_rows_appear_undated_at_top` (lines 458-484); UC-2 (RUNNING→500, lines 756-765, → PLT-144); UC-4 (unfilterable RUNNING, lines 775-784); UC-9 (sort-vs-display key, lines 821-829); UC-12 (no tie-breaker, lines 848-856); enum facts `IngestionTaskRun.java:28-36` (7-value DB enum) vs `components.yaml:1407-1415` (6-value wire enum); `ReactiveDataEntityTaskRunRepositoryImpl.java:176-182` (`ORDER BY end_time DESC`, no NULLS directive, no tie-breaker); `TestRunItem.tsx:53-57` (blank Duration when endTime null).
- `lineage/odd-platform/system-mission.md` (read 2026-06-19) — P-04 Data Quality pillar framing (lines 143-161); data-quality-engineer audience (line 330).
- `https://docs.opendatadiscovery.org/features/data-quality/test-run-history` — last_verified_status: **200** (WebFetch 2026-06-19). Quoted verbatim: *"The list is sorted by end-time, most recent first — the run that finished last is at the top."*; *"Rows whose `end_time` is `NULL` (in-flight runs that have started but not finished) sort to the top under Postgres' default `NULLS FIRST` ordering for `DESC`."*; *"Treat any row with an empty Duration as in-flight; the platform will repopulate the row when the run completes."*; *"The page returns HTTP 500 while a test is currently running."*; *"The History tab is unavailable exactly when an operator most wants to consult it — during an in-flight test execution."*
- `https://docs.github.com/en/rest/actions/workflow-runs` — last_verified_status: **200** (WebFetch 2026-06-19). Quoted verbatim status enum: *"Can be one of: `completed`, `action_required`, `cancelled`, `failure`, `neutral`, `skipped`, `stale`, `success`, `timed_out`, `in_progress`, `queued`, `requested`, `waiting`, `pending`"*. Default list-ordering prose: NOT stated on the page (recorded, not paraphrased).
- `https://docs.gitlab.com/ci/pipelines/` — last_verified_status: **200** (WebFetch 2026-06-19). Documents statuses Passed/Failed/Canceled/Skipped/Pending/Running; quoted: *"cancel a running pipeline, retry failed jobs, or delete a pipeline"* (running pipeline is first-class + actionable in the list). Exhaustive ordering prose: NOT stated.
- `https://docs.getdbt.com/docs/deploy/run-visibility` — last_verified_status: **200** (WebFetch 2026-06-19). Quoted: *"You can also use it to review recent runs, find errored runs, and track the progress of runs in progress."* Top/bottom ordering + running indicator: NOT stated on the page.
- `https://docs.github.com/en/actions/managing-workflow-runs-and-deployments/managing-workflow-runs/viewing-workflow-run-history` — last_verified_status: **404** (WebFetch 2026-06-19).
- `https://docs.github.com/en/actions/how-tos/monitor-workflows/view-workflow-history` — last_verified_status: **404** (WebFetch 2026-06-19).
- `https://docs.github.com/en/actions/concepts/workflows-and-actions/about-monitoring-workflows` — last_verified_status: **200 but link-hub** (WebFetch 2026-06-19; no quotable ordering/indicator prose).
- `https://airflow.apache.org/docs/apache-airflow/stable/ui.html` — last_verified_status: **200 but no quotable ordering/colour-legend prose** (WebFetch 2026-06-19). Quoted only: *"Each row represents a task, and each column represents a Dag run."*
- `https://www.jenkins.io/doc/book/using/working-with-your-first-pipeline/` — last_verified_status: **404** (WebFetch 2026-06-19).
- `https://docs.gitlab.com/ee/ci/pipelines/` — last_verified_status: **cross-host redirect → docs.gitlab.com/ci/pipelines/** (WebFetch 2026-06-19; followed, see above).
- `https://docs.soda.io/soda-cloud/display-datasets.html` — last_verified_status: **404** (WebFetch 2026-06-19).
