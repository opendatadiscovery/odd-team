---
doc_gap_id: DOC-GAP-265
severity: MEDIUM
category: drift
batch: ZC
generated_at: "2026-05-25T00:00:00Z"
generated_at_commit: ede5d277
prompt_version: "doc-gap-finder/0.1.0"
maintainer_curated: false
related_pillar_features:
  - "P-04:F-002"
related_features:
  - F-022
related_doc_gaps: []
---

## DOC-GAP-265 — Quality Dashboard "Test Results Breakdown" ring + per-category result tiles: live `/features/data-quality/dashboard` page describes the breakdown as 3 statuses ("passed / failed / skipped"); the code renders SIX statuses everywhere — the breakdown donut, the legend, and EVERY per-category result row each iterate the full `DataEntityRunStatus` enum (SUCCESS / FAILED / SKIPPED / BROKEN / ABORTED / UNKNOWN); an operator who sees a `BROKEN` or `ABORTED` slice (or the 4 extra per-category tile columns) has NO doc explaining what the additional statuses mean

**Severity**: MEDIUM
**Category**: drift (live-doc list-vs-implementation count mismatch; doc is incomplete rather than contradictory — the three listed statuses are a subset)

### Surfaced by

- `odd-platform__ts__react-component__component__DataQualityContent.md:docs_link_semantic.doc_drift_findings.[1]` — verbatim: *"DOC DRIFT — Test Results Breakdown ring is described as 3 statuses, code renders up to 6. The live `dashboard` page describes the breakdown ring as 'passed / failed / skipped' (3 statuses). The component builds the breakdown slices dynamically from `DataEntityRunStatus`, which has SIX values — SUCCESS, FAILED, SKIPPED, BROKEN, ABORTED, UNKNOWN (`DataQualityContent.tsx:43-51, 83`, `components.yaml:1407-1415`) — and the legend (`DataQualityContent.tsx:83-89`) renders all six. An operator who sees a `BROKEN` or `ABORTED` slice has no doc explaining it."*
- `odd-platform__ts__react-component__component__TestCategoryResults.md:docs_link_semantic.doc_drift_findings.[0]` — verbatim: *"DOC DRIFT — the per-status breakdown documents only three statuses; the code renders six. The live `dashboard` page (WebFetched 2026-05-22, status 200) describes the Test Results breakdown as 'broken down by status (passed / failed / skipped)' — three statuses. The component renders a tile for every value of `DataEntityRunStatus`, which has SIX values: SUCCESS, FAILED, SKIPPED, BROKEN, ABORTED, UNKNOWN (`components.yaml:1407-1415`; iterated at `TestCategoryResults.tsx:21`). An operator reading the docs will expect three columns and see six."*
- `odd-platform__ts__react-component__component__DataQualityContent.md:concepts.entities[DataEntityRunStatus]` — *"the run-status enum {SUCCESS, FAILED, SKIPPED, BROKEN, ABORTED, UNKNOWN} driving the legend and the breakdown colours (`DataQualityContent.tsx:3, 83`, `components.yaml:1407-1415`)"*
- `odd-platform__ts__react-component__component__TestCategoryResults.md:concepts.entities[DataEntityRunStatus]` — same six-value enum (the schema-side primary source)
- `odd-platform__ts__react-component__component__TestCategoryResults.md:implicit_adrs.[0]` — confirms the enum-order tile sort iterates `Object.values(DataEntityRunStatus)` and is consistent with the legend at `DataQualityContent.tsx:83-89` — i.e. the six-status rendering is the deliberate design of both the legend and the tiles

### Evidence

- WebFetch `https://docs.opendatadiscovery.org/features/data-quality/dashboard` 2026-05-25 status **200** (DIRECT FETCH this session) — verbatim: *"Test Results Breakdown Statuses: 'passed / failed / skipped'"* (three statuses, no mention of BROKEN, ABORTED, or UNKNOWN)
- The page does not anywhere mention "broken", "aborted", or "unknown" in the breakdown context (verified by the explicit Q1 in the fetch — *"every status name mentioned in the Test Results Breakdown context"* — returned only the three).
- `odd-platform-specification/components.yaml:1407-1415` — the `DataEntityRunStatus` enum declares SIX values: `SUCCESS, FAILED, SKIPPED, BROKEN, ABORTED, UNKNOWN`
- `odd-platform-ui/src/components/DataQuality/DataQualityContent/DataQualityContent.tsx:43-51` — `testResultsBreakdownChartData` (the donut data) is built by `Array.from(testResultsBreakdown.entries()).map(([status, value]) => ({ name: t(status), value, color: palette.runStatus[status].color ?? palette.dataQualityDashboard.unknown }))` — it iterates ALL keys of the breakdown Map, which (when populated from real backend data) carries up to all six enum values
- `odd-platform-ui/src/components/DataQuality/DataQualityContent/DataQualityContent.tsx:83-89` — the LEGEND iterates `Object.values(DataEntityRunStatus).map(status => <S.LegendItem key={status} $color={palette.runStatus[status].color}>{capitalizeFirstLetter(t(status.toLowerCase()))}</S.LegendItem>)` — six legend chips, one per enum value
- `odd-platform-ui/src/components/DataQuality/TestCategoryResults/TestCategoryResults.tsx:19-25` — `sortedResults = useMemo(() => Object.values(DataEntityRunStatus).map(status => results.find(r => r.status === status)).flatMap(f => (f ? [f] : [])), [results])` — the per-category row iterates the full enum
- `odd-platform-api/src/main/java/.../mapper/DataQualityCategoryMapperImpl.java:45-60` — the backend `addMissingStatuses` injects a zero-count `DataQualityRunStatusCount` for EVERY `DataEntityRunStatus` value not already present, so every category's `results` array ALWAYS has all six entries in production
- `odd-platform-ui/src/theme/palette.ts:122-129` — `palette.runStatus` is keyed by all six enum values with distinct colours (SUCCESS green, FAILED red, BROKEN orange, SKIPPED blue, ABORTED purple, UNKNOWN grey)

### Drift narrative

The live dashboard sub-page documents the Test Results Breakdown ring with three statuses ("passed / failed / skipped") — a strict subset of what the code renders. The renderer is:

- The **breakdown donut ring** (top-centre of the dashboard) — slices coloured by `palette.runStatus[status].color`, one slice per DISTINCT status present in any test-result row across all categories. In production with backend `addMissingStatuses` injecting zeros, this is up to six slices.
- The **legend** (six small coloured chips below the rings) — `DataQualityContent.tsx:83-89` iterates `Object.values(DataEntityRunStatus)` — always six chips, even if some statuses have zero count.
- Each **per-category result row** (the right-side matrix) — `TestCategoryResults.tsx:19-25` iterates the same enum — six tile columns per row.

So an operator looking at the dashboard sees: a donut with up to 6 colours, a legend with 6 chips, and a matrix with 6 columns. The doc tells them about 3. The doc's three names ("passed / failed / skipped") are a partial alias of three of the six (SUCCESS ≈ "passed"; FAILED ≈ "failed"; SKIPPED ≈ "skipped"), but BROKEN, ABORTED, and UNKNOWN have NO doc presence at all. An operator seeing a large orange BROKEN slice in their dashboard cannot Google the meaning from the docs.

There is also a secondary alias drift: the doc says "passed" but the legend renders "Success" (the literal i18n key of `'success'` capitalised by `capitalizeFirstLetter(t(status.toLowerCase()))` at `DataQualityContent.tsx:86`). "Passed" / "Failed" / "Skipped" are the doc's vocabulary; "Success" / "Failed" / "Skipped" are the screen's vocabulary. The first and third align; "Passed" vs "Success" is a minor vocabulary drift on top of the count drift.

### Proposed doc action

**Single-part action — extend the dashboard doc's Test Results Breakdown description**.

`documentation/docs/features/data-quality/dashboard.md` — replace the current "passed / failed / skipped" sentence with the full six-status enumeration + a brief description of each:

> **Test Results Breakdown** — the count of test runs broken down by run status. The breakdown ring and the per-category matrix both render up to six slices/tiles per the `DataEntityRunStatus` enum:
>
> - **Success** (green) — the test passed.
> - **Failed** (red) — the test ran and detected a data-quality problem.
> - **Skipped** (blue) — the test was skipped (e.g. a precondition was not met).
> - **Broken** (orange) — the test execution itself failed (an error in the test code or test infrastructure, not a data-quality failure).
> - **Aborted** (purple) — the test was cancelled before it could complete.
> - **Unknown** (grey) — the test ingestion did not supply a recognisable status.
>
> The legend below the rings shows all six colours; the donut and the per-category tiles show only statuses present in the ingested data (with the platform injecting zero-count entries to keep tile columns aligned across categories).

Also align the "Success" vs "Passed" vocabulary — the UI renders "Success" (from the enum value `SUCCESS`); pick one vocabulary across UI + docs and stick to it. Recommendation: align the docs to the UI (use "Success") since changing the UI requires an i18n + display-code change.

### Cross-references

- **DOC-GAP-268** (per-category row undocumented entirely) — sibling finding; the count drift is one facet; the row's full structure is the next one. The maintainer's dashboard.md edit can address both in one section.
- **DOC-GAP-269** (empty-state undocumented) — sibling finding; the "Unknown (grey) — the test ingestion did not supply a recognisable status" sentence above also addresses the empty-state "No data" grey slice that DonutChart renders for zero-total rings.
- **Rule 6 coherence** — cross-registry sweep ran: `concepts/index.yaml` enumeration of `DataEntityRunStatus` (6-value enum), `feature-flows/F-022` (per-dataset DQ — same enum used in dataset Test Reports tab) — all SAME-POLARITY. No CONTRADICTS, no SUPERSEDES.

### Severity rationale

MEDIUM. The doc is incomplete rather than wrong — an operator following the doc gets the three named statuses correctly. But an operator seeing the dashboard renders something the doc doesn't describe (BROKEN slice, ABORTED tile column, UNKNOWN legend chip) has no doc-side recourse to understand it. The fix is one paragraph in the dashboard doc + alignment of "Success" vs "Passed" vocabulary — cheap.

### Last verified

- 2026-05-25 — WebFetch dashboard page status 200; the three-status sentence is intact; the six-value enum + the iteration sites re-confirmed at substrate commit `ede5d277`.
