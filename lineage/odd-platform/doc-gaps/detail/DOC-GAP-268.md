---
doc_gap_id: DOC-GAP-268
severity: MEDIUM
category: missing-page
batch: ZC
generated_at: "2026-05-25T00:00:00Z"
generated_at_commit: ede5d277
prompt_version: "doc-gap-finder/0.1.0"
maintainer_curated: false
related_pillar_features:
  - "P-04:F-002"
related_doc_gaps:
  - DOC-GAP-265   # sibling — 3-vs-6 statuses in the per-category row
---

## DOC-GAP-268 — Quality Dashboard per-test-category result ROW (the right-side matrix the live page calls "a per-test-category matrix") is undocumented in structure: the doc says "a per-test-category matrix on the right showing per-anomaly-class counts" but never describes the COMPOSITION of a single row — a category name heading + a large total-count number + a horizontal row of per-run-status count tiles (one tile per `DataEntityRunStatus` value, colour-coded, with the literal en-dash `–` for zero/negative counts and the numeral otherwise); operators see the per-category panel and have no doc-side description of what each numeric tile means or how its colour maps to status

**Severity**: MEDIUM
**Category**: missing-page content (the dashboard sub-page mentions the matrix in one phrase and never elaborates; the rendered structure of a single row is the operator's primary information surface for per-category quality posture)

### Surfaced by

- `odd-platform__ts__react-component__component__TestCategoryResults.md:docs_link_semantic.doc_drift_findings.[1]` — verbatim: *"DOC GAP — the per-category result ROW (this component) is undocumented. The live `dashboard` page describes 'three breakdown rings' and 'a per-test-category matrix … showing per-anomaly-class counts' but does not describe the per-category row this component renders: a category name + a total + a row of per-run-status count tiles. The presentation an operator actually sees on `/data-quality` for each test category is not documented."*
- `odd-platform__ts__react-component__component__TestCategoryResults.md:operations` — *"compute-category-total (sum every `count` in `results` into one number — `TestCategoryResults.tsx:14-17`)"*, *"stabilise-status-order (re-order `results` into DataEntityRunStatus enum-declaration order, dropping any status the array does not contain — `TestCategoryResults.tsx:19-25`)"*, *"render-category-row (emit the category heading, the total, and one count tile per status — `TestCategoryResults.tsx:27-45`)"*
- `odd-platform__ts__react-component__component__TestCategoryResults.md:concepts.invariants` — *"A count tile shows the literal en-dash character `\\u2013` when `count` is 0 or negative, the numeric count otherwise (`TestCategoryResults.tsx:39`)"*, *"Tile colour is keyed by run status via `theme.palette.runStatus[$status].color` — SUCCESS green, FAILED red, BROKEN orange, SKIPPED blue, ABORTED purple, UNKNOWN grey (`TestCategoryResults.styles.ts:27-36`)"*
- `odd-platform__ts__react-component__component__TestCategoryResults.md:implicit_adrs.[0]` — *"Fixed-position status tiles via enum-order re-sort, not server-order rendering. … every category row shows its SUCCESS / FAILED / SKIPPED / BROKEN / ABORTED / UNKNOWN tiles in the same horizontal slots, making the dashboard columns visually comparable across category rows."* — the column-alignment intent is the structural design of the matrix

### Evidence

- WebFetch `https://docs.opendatadiscovery.org/features/data-quality/dashboard` 2026-05-25 status **200** (DIRECT FETCH this session) — verbatim Q5 answer: *"Per-Test-Category Result Rows/Panels: The documentation describes 'a per-test-category matrix on the right showing per-anomaly-class counts.' The six anomaly classes are: Assertion Tests, Column Values Anomalies, Freshness Anomalies, Schema Changes, Unknown Category, Volume Anomalies. However, the page provides no details on per-status count tiles or specific row/panel structure beyond the matrix visualization."*
- `odd-platform-ui/src/components/DataQuality/TestCategoryResults/TestCategoryResults.tsx:14-17` — `total` computation: `useMemo(() => results.reduce((acc, {count}) => acc + count, 0), [results])`
- `odd-platform-ui/src/components/DataQuality/TestCategoryResults/TestCategoryResults.tsx:19-25` — `sortedResults`: enum-order re-sort with present-only `flatMap` drop branch
- `odd-platform-ui/src/components/DataQuality/TestCategoryResults/TestCategoryResults.tsx:27-45` — the render: category heading (h4), the large total (h1), the horizontal status-tile row
- `odd-platform-ui/src/components/DataQuality/TestCategoryResults/TestCategoryResults.tsx:39` — verbatim: `{count > 0 ? count : '–'}` (the en-dash zero-state)
- `odd-platform-ui/src/components/DataQuality/TestCategoryResults/TestCategoryResults.styles.ts:27-36` — the tile colour binding via `theme.palette.runStatus[$status].color`
- `odd-platform-ui/src/theme/palette.ts:122-129` — the six per-status colours
- `odd-platform-api/src/main/java/.../mapper/DataQualityCategoryMapperImpl.java:45-60` — the backend `addMissingStatuses` guarantee that every category's `results` array has all six statuses in production (the contract that makes column-alignment work)

### Drift narrative

The live dashboard page mentions the per-test-category matrix in ONE phrase: *"a per-test-category matrix on the right showing per-anomaly-class counts."* It then lists the six anomaly classes (Assertion Tests, Column Values Anomalies, Freshness Anomalies, Schema Changes, Unknown Category, Volume Anomalies). That is the entirety of the matrix coverage.

What an operator actually sees on the dashboard for each test category is a horizontal row composed of:

1. A **category heading** (h4) on the left — the category description string (e.g. "Assertion Tests").
2. A **large total-count number** (h1) — the sum of all run-status counts for the category across all datasets.
3. A **fixed-position row of six count tiles** — one per `DataEntityRunStatus` value, in a STABLE column order (SUCCESS, FAILED, SKIPPED, BROKEN, ABORTED, UNKNOWN) so columns line up across adjacent category rows. Each tile is colour-coded by status (Success green, Failed red, Skipped blue, Broken orange, Aborted purple, Unknown grey). A tile with count > 0 shows the numeral; a tile with count 0 (or, theoretically, negative — see bugs_limitations_corner_cases) shows a literal en-dash `–`.

The column alignment is the design point of the matrix: an operator scanning vertically down the "FAILED" column sees the failure count for each category in the same horizontal slot. This is the reason the component exists — a plain `results.map(...)` would have been shorter, but would let column position track backend serialisation order, making category rows visually non-comparable.

Without the doc-side description, operators do not learn:

- That the total is the SUM of all per-status counts (not just failed; not just non-skipped) — so a high "total" with all zero-tiles-except-Skipped means "many tests were skipped", not "many tests failed".
- That tile colour is meaningful (green=Success, red=Failed, etc.) — without this, a colour-blind operator or an operator looking at a screenshot may not be able to read the panel.
- That the en-dash `–` means "zero", not "no data" — visually, `–` can read as "missing" or "N/A", which is wrong; zero IS the data here.
- That column position is meaningful — the operator scans vertically expecting `FAILED` to always be in the same column, and the doc never names that intent.

### Proposed doc action

**Single-part action — add a "Per-category result rows" sub-section to the dashboard doc page**.

`documentation/docs/features/data-quality/dashboard.md` — after the existing matrix mention (or replacing it), add:

> ## Per-category result rows
>
> The right side of the dashboard renders one ROW per test category (six rows in total — see the [Test categories](#test-categories) list below). Each row is composed of:
>
> 1. **Category heading** (left) — the test category name (e.g. "Assertion Tests").
> 2. **Total count** (large number, centre) — the SUM of test runs across all statuses for the category. A high total with all-zero failure tiles means many tests were skipped or unknown; a high total with high FAILED is the operator's signal that the category has data-quality problems to triage.
> 3. **Per-status count tiles** (right, six tiles per row) — one tile per run status (Success, Failed, Skipped, Broken, Aborted, Unknown), in a STABLE column order so the same column always shows the same status across adjacent rows. The tile colour matches the status legend at the top of the dashboard:
>
>    | Status | Colour | Tile content |
>    | --- | --- | --- |
>    | Success | green | count of passing test runs |
>    | Failed | red | count of failing test runs |
>    | Skipped | blue | count of skipped test runs |
>    | Broken | orange | count of broken-execution test runs |
>    | Aborted | purple | count of aborted test runs |
>    | Unknown | grey | count of unrecognised-status test runs |
>
>    A tile shows the literal **en-dash `–`** when its count is zero (NOT "no data" — zero is the data; the en-dash is a visual no-clutter style).
>
> The column order is anchored to the `DataEntityRunStatus` enum order to make the matrix visually scannable: scrolling down the FAILED column reads off the failure count of each category.

### Cross-references

- **DOC-GAP-265** (Test Results Breakdown 3-vs-6 statuses) — sibling finding; the six-status enumeration is the SAME enum that drives the per-category tiles. The "Per-status count tiles" table above is a natural place to consolidate the per-status descriptions DOC-GAP-265 also wants.
- **DOC-GAP-269** (empty-state undocumented) — sibling finding; the en-dash zero-state described here is part of the dashboard's empty-state story.
- **Rule 6 coherence** — cross-registry sweep ran: `concepts/index.yaml` enumeration of the six anomaly classes via `DataQualityCategory.getDescription()` + `feature-flows/F-022` (per-dataset DQ — same six categories in a different surface) — all SAME-POLARITY. No CONTRADICTS, no SUPERSEDES.

### Severity rationale

MEDIUM. The matrix is the right-side half of the dashboard's display — a visually-prominent component that drives the operator's per-category triage. Documenting it as one phrase ("a per-test-category matrix … showing per-anomaly-class counts") under-delivers for the surface's importance. Operator-impact is reader-friction + colour-blind/screenshot legibility loss — not data-loss, hence MEDIUM. Fix is one sub-section.

### Last verified

- 2026-05-25 — WebFetch dashboard page status 200; the page still describes the matrix in one phrase only; sidecar evidence (TestCategoryResults.tsx:14-45, TestCategoryResults.styles.ts:27-36, palette.ts:122-129) re-confirmed at substrate commit `ede5d277`.
