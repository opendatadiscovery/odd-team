---
doc_page: "docs/data-quality/dashboard.md"
page_title: "Quality Dashboard"
live_url: "https://docs.opendatadiscovery.org/features/data-quality/dashboard"
live_url_verified_status: "200"
live_url_resolved_slug: "features/data-quality/dashboard"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "Data Quality Dashboard (catalog-wide aggregate quality view)"
    - "Aggregate catalog-wide data-quality (single-fetch dashboard projection)"
    - "Data Quality Test Category (anomaly-class bucket)"
    - "DataEntityRunStatus (six-value run-outcome enum)"
    - "data_entity_task_last_run (denormalised one-row-per-task latest-run table — load-bearing for DQ dashboard semantics)"
    - "Dashboard Filter Panel (two-set tables-vs-tests independent filters)"
    - "Data Quality Engineer"
  features:
    - "F-032"
  code_nodes: []
audience: [operator, data-consumer, developer]
doc_claim_vs_code:
  - "Page §'Three breakdown rings' lists the Test Results Breakdown statuses as 'passed / failed / skipped' (3) and never enumerates the rest; the code renders a tile + ring slice for every value of the six-value DataEntityRunStatus enum (SUCCESS, FAILED, SKIPPED, BROKEN, ABORTED, UNKNOWN). Doc is INCOMPLETE — an operator who ingests a test set that emits BROKEN/ABORTED/UNKNOWN sees three undocumented states. MEDIUM. Evidence: invariant:run-status-three-vs-six-status-doc-drift-dashboard; entitie:data-entity-run-status / components.yaml:1407-1415; TestCategoryResults.tsx:21; DataQualityContent.tsx:83-89."
  - "Page §'Three breakdown rings' labels the Table Health slices 'success / failed / broken'; the code renders them as Healthy / Warning / Error from tablesDashboard.tablesHealth.{healthyTables, warningTables, errorTables} — the DTO has no 'failed' or 'broken' field. Vocabulary mismatch: an operator searching the UI for a 'broken tables' count will not find that label. MEDIUM. Evidence: invariant:table-health-label-drift-success-failed-broken-vs-healthy-warning-error; DataQualityContent.tsx:55-62; components.yaml:3772-3787."
  - "Page §'Filtering' lists 'Title' as one of five filter dimensions with NO caveat; the SQL binds the Title filter to OWNERSHIP.TITLE_ID — the ownership role/title (e.g. 'Data Steward'), NOT the dataset name a bare 'Title' label implies. Selecting Title='Data Steward' narrows the rings to entities where some owner holds that role — a different and wider slice than 'datasets named X'. LSN-020 input-name-vs-implementation class; HIGH-value omitted caveat. Also: Owner+Title compose into ONE OWNERSHIP join AND-ed together (entities where THAT owner holds THAT title), which can return an empty dashboard unexpectedly. Evidence: invariant:dashboard-title-filter-binds-ownership-title-not-dataset-name; ReactiveDataQualityRunsRepositoryImpl.java:301,309 (binding) and :297-302 (Owner+Title AND-join); TitleFilter.tsx:29."
  - "Page §'Filtering' names 'Namespace' as a filter dimension but is SILENT on its widening: the SQL matches BOTH the entity's own namespace AND its datasource's namespace via an OR-clause, so filtering by namespace X also includes every entity whose DATASOURCE is in X. Ring counts are wider than 'entities in namespace X' alone implies; an operator comparing the dashboard number to a separate query sees unexplained inflation. MEDIUM (over-inclusion, related-but-wider — not a category mismatch). Evidence: invariant:dashboard-namespace-filter-widens-via-datasource-namespace; ReactiveDataQualityRunsRepositoryImpl.java:288-293; NamespaceFilter.tsx:29."
  - "The page documents the /data-quality dashboard but never states its authorization posture; the route is mounted with NO client-side permission guard — unlike the sibling /lookup-tables route which is wrapped in WithPermissionsProvider. Any authenticated user (and, under auth.type=DISABLED, any anonymous caller) opens the catalog-wide aggregate health of every dataset. Omitted security caveat on the route's operator-facing home page. Severity to be confirmed against the backend authorization on GET /api/dataqatests/runs (probe P-090 — DataQualityRunsController not yet enriched). Evidence: F-032 (primary_drift_class=ungated_dashboard_route_no_permission_guard; entry DataQuality.tsx:7-18, App.tsx:73 vs App.tsx:75-88)."
maintainer_curated: false
---

# Quality Dashboard — doc understanding

The page documents the catalog-wide **Data Quality Dashboard** at `/data-quality` (`F-032`; concept `Data Quality Dashboard (catalog-wide aggregate quality view)`) — the cross-entity aggregate view, distinct from the per-dataset Test reports tab. It delivers an operator three breakdown rings (Table Health / Test Results Breakdown / Monitored Tables), a per-category card per anomaly class, and a two-set filter sidebar; all of it is served by a single GET `/api/dataqatests/runs` aggregate fetch (operation `Aggregate catalog-wide data-quality (single-fetch dashboard projection)`). The six anomaly classes on the page match the backend `DataQualityCategory` enum verbatim (concept `Data Quality Test Category (anomaly-class bucket)`), and the alphabetical-ordering and AND-only-conjunction caveats the page now carries are accurate against the code.

This page is **partially-corrected, partially-drifted** against the implementation. The headline correction has landed: the page's prior "count of test runs" claim has been rewritten into a HIGH-severity-accurate warning hint that the Test Results Breakdown counts **distinct tests by their latest run only**, naming the `data_entity_task_last_run` denormalised table — this now matches the code (concept `data_entity_task_last_run (...)`), so the LSN-019-class drift the graph captured on 2026-05-22/25 (`invariant:dq-dashboard-test-results-counts-tests-not-runs`) is **resolved in the doc** and should not be re-raised. Four drifts remain live (frontmatter `doc_claim_vs_code`): the breakdown ring documents 3 of 6 `DataEntityRunStatus` states; Table Health is labelled success/failed/broken where the UI shows Healthy/Warning/Error; and two filter dimensions carry no caveat for SQL-level surprises — the **Title** filter binds to `OWNERSHIP.TITLE_ID` (ownership role, not dataset name — LSN-020 class, the highest-value omission) and the **Namespace** filter silently widens through the datasource's namespace. A fifth, lower-confidence finding: the route has no client-side permission guard and the page is silent on its auth posture.

## Maintainer notes
<!-- preserved across re-analysis; the only block a human hand-edits -->
