## REFACTOR-600 — Live `dashboard.md` is incomplete on multiple axes — Test Results breakdown described as 3 statuses but code renders 6; Table Health labels disagree (success/failed/broken vs Healthy/Warning/Error); per-category result row, empty-state, filter-panel interaction model, access-control posture, "Unknown category" casing all silent or drifted. Consolidated DOC-DRIFT for `/data-quality` dashboard.md (and the pillar landing) — five drift facets + four absence facets on one live page

**Severity**: MEDIUM
**Category**: doc-code-drift (consolidated cross-facet)
**Pillars affected**: [P-04 Data Quality — F-032 Quality Dashboard]
**related_features**: [F-032]
**related_pillar_features**: [P-04:F-002]
**Batch**: ZC (2026-05-22)

**Surfaced by**: ALL FOUR per-component sidecars surfaced overlapping facets. Consolidated here as one scope to keep the catalog disciplined; each facet has its own cited surfaced-by below.

- `odd-platform__ts__react-component__component__DataQualityContent.md:doc_drift_findings.[0-3]` (4 doc-drift items)
- `odd-platform__ts__react-component__component__DataQualityFilters.md:doc_drift_findings.[0-2]` (3 doc-drift items)
- `odd-platform__ts__react-component__component__TestCategoryResults.md:doc_drift_findings.[0-2]` (3 doc-drift items)
- `odd-platform__ts__react-component__component__DataQuality.md:doc_drift_findings.[0]` (access-control silence)

**Description**: The live Quality Dashboard documentation page at `https://docs.opendatadiscovery.org/features/data-quality/dashboard` (WebFetched 2026-05-22 status 200) carries DRIFT against the implementation on the following axes. Every entry below has both a verbatim doc quotation and a code/file:line anchor.

**Drift facets** (doc says X, code does Y):

1. **Table Health labels (`DataQualityContent.tsx:55-62` vs doc)**: doc describes the ring as "success / failed / broken." Code renders `tablesDashboard.tablesHealth.{healthyTables, warningTables, errorTables}` — slices labelled **Healthy / Warning / Error**. The DTO field set has no `failed` or `broken`. Operator reading docs for "broken tables" count finds different labels on screen.
2. **Test Results Breakdown — 3 statuses vs 6 (`DataQualityContent.tsx:43-51, 83` + `TestCategoryResults.tsx:21` + `components.yaml:1407-1415` vs doc)**: doc describes breakdown as 'passed / failed / skipped' (three statuses). Code renders one slice per `DataEntityRunStatus` value — SIX values: SUCCESS, FAILED, SKIPPED, BROKEN, ABORTED, UNKNOWN. The legend (`DataQualityContent.tsx:83-89`) shows all six. Operator seeing BROKEN or ABORTED slice has no doc explaining it.
3. **'Unknown category' casing (`TestCategoryResults.tsx:30` + `DataQualityCategory.java:17` vs doc)**: doc capitalises "Unknown Category." Code renders the server-defined enum description verbatim — "Unknown category" (lowercase c). Minor; operator-visible.

**Absence facets** (doc silent on operator-visible behaviour):

4. **Empty-state behaviour undocumented**: doc says nothing about what the dashboard shows when no DQ tests are ingested. Code renders three grey 'No data' donuts + zero category panels. An operator on a fresh install sees grey donuts and an otherwise empty page with no explanatory copy.
5. **Per-category result row undocumented (`TestCategoryResults.tsx` doc gap)**: doc describes 'three breakdown rings' and 'a per-test-category matrix … per-anomaly-class counts' but never describes the row this component renders: category name + total + per-run-status count tiles. The visual the operator actually sees is undocumented.
6. **Filter-panel interaction model undocumented**: doc names the five filter dimensions but never documents (a) that filter selections are reflected into the URL query string (deep-linkable / shareable), (b) that there are TWO 'Clear' buttons scoped per side, (c) that the autocomplete searches by name. The doc covers the read surface and is silent on the operator's primary interaction surface.
7. **'Title' filter binding to `OWNERSHIP.TITLE_ID` undocumented** — see REFACTOR-593 for the full LSN-020 drift; the doc-side absence is one of the contributing factors.
8. **Namespace filter datasource-inheritance widening undocumented** — see REFACTOR-594.
9. **Access control / who-can-see-the-dashboard silent** (`DataQuality.tsx:doc_drift_findings.[0]`): WebFetches of `dashboard.md` + `data-quality.md` + the pillar landing all 2026-05-22 status 200 — all silent on access control. The dashboard is reachable by any authenticated user (the route is mounted without `WithPermissionsProvider`; see ADR-CANDIDATE-003 STRENGTHENED batch ZC); the read-collaborative posture is intentional but undocumented.

**Wisdom-test classification**: GAP (all 9 facets). Each is a doc-product editorial gap: the doc page exists, the code is correct, the doc has not kept pace with the implementation's actual surface. None is a structural change; all are doc-content authorings.

**Primary source citations** (representative for each facet):

| # | Live URL | Code anchor |
|---|---|---|
| 1 | `dashboard.md` "success / failed / broken" | `DataQualityContent.tsx:55-62` + `components.yaml:3772-3787` |
| 2 | `dashboard.md` "passed / failed / skipped" | `DataQualityContent.tsx:83-89` + `components.yaml:1407-1415` |
| 3 | `dashboard.md` "Unknown Category" | `TestCategoryResults.tsx:30` + `DataQualityCategory.java:17` |
| 4 | `dashboard.md` (silent) | `DonutChart.tsx:94-95` + `DataQualityContent.tsx:75` |
| 5 | `dashboard.md` (silent on per-category row) | `TestCategoryResults.tsx:27-45` |
| 6 | `dashboard.md` (silent on URL deep-link, two Clears, autocomplete) | `DataQualityFilters.tsx:28-91` |
| 7 | `dashboard.md` (silent on Title binding) | `ReactiveDataQualityRunsRepositoryImpl.java:301, 309` |
| 8 | `dashboard.md` (silent on namespace widening) | `ReactiveDataQualityRunsRepositoryImpl.java:288-293` |
| 9 | `dashboard.md` + `data-quality.md` + landing (all silent on access control) | `App.tsx:73` + `App.tsx:75-88` (gated sibling) + `ToolbarTabs.tsx:45-49` |

**Existing-ADR-or-implied-prescription**: The Quality Bar Gate 4 (consumer-read) + Gate 6 (bidirectional code↔doc coverage) + the doc-pillar editorial audit are the project-side prescription. The cross-cutting nature of 9 facets on ONE page indicates the page has not had a structured update since the implementation evolved (six-status enum, datasource-inheritance widening, deep-linkable URL, per-category row, ungated-by-design route).

**Proposed remedy**: One DOC-NNN tranche covering `dashboard.md` (the most affected page) with sub-tasks for each facet. Specifically:

1. Replace 'success / failed / broken' with 'Healthy / Warning / Error' and explain the mapping (`tablesHealth.healthyTables` → 'Healthy', etc.).
2. Add a statuses subsection enumerating all six `DataEntityRunStatus` values, what each means, and the colour mapping (mirror the legend's order: SUCCESS, FAILED, SKIPPED, BROKEN, ABORTED, UNKNOWN).
3. Fix 'Unknown Category' → 'Unknown category' (or fix the server-side description string if 'Unknown Category' is the preferred form; ONE OR THE OTHER, not both).
4. Add an "Empty state" admonition: "If no Data Quality tests have been ingested, the dashboard renders three grey 'No data' donuts and no category panels — see [Test Results Import](.md) to ingest DQ data."
5. Add a "Per-category result rows" subsection describing the category-heading + total + six-tile shape.
6. Add a "Filter panel interaction" subsection: deep-linkable URL, per-side Clear, autocomplete-by-name.
7. Pair with REFACTOR-593 / REFACTOR-594 — the same doc tranche includes the Title / Namespace filter clarifications.
8. Add an "Access control" admonition: "The Quality Dashboard is visible to any authenticated user. There is no per-role or per-owner gate at this surface; the dashboard reflects ODD's read-collaborative catalog posture (see [Authorization](enable-security/authorization.md))." Cross-link to the canonical authorization doc.

**Severity rationale**: MEDIUM (consolidated). Each individual facet is LOW-to-MEDIUM; the cluster on one live page is MEDIUM because an operator landing on `dashboard.md` to triage encounters multiple unsynced facets and loses confidence in the docs as a whole. The doc-vs-code Bidirectional Coverage gate (Quality Bar Gate 6) is exactly the gate that catches this class — the file-analyser surfaced 9 facets in a single batch, indicating the dashboard page has not had a structured Gate-6 audit since its content was authored.

**Suggested backlog grouping**: `Quality Dashboard hardening sprint` (doc-side companion) + `DOC-NNN dashboard.md tranche`. Editor-pass appropriate for one focused authoring session.

---
