---
doc_page: "docs/data-quality.md"
page_title: "Data Quality"
live_url: "https://docs.opendatadiscovery.org/features/data-quality"
live_url_verified_status: "200"
live_url_resolved_slug: "features/data-quality"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "Data Quality Test"
    - "Data Quality Dashboard (catalog-wide aggregate quality view)"
    - "Dataset SLA (Green/Yellow/Red aggregate + PNG badge)"
    - "Data Quality Test Severity (MINOR / MAJOR / CRITICAL)"
    - "Dataset Test Report (count-per-status aggregate)"
    - "Per-Entity Run History (DataEntityRunList — paginated run-history read surface for one DQ test or transformer)"
    - "Data Quality Engineer"
  features:
    - "F-032"
    - "F-022"
    - "F-040"
  code_nodes: []
audience: [operator, data-consumer]
doc_claim_vs_code:
  - "Page (Subsections) says Dataset Quality Statuses use 'the `/api/datasets/{id}/sla` endpoint for BI-report import' — but `/api/datasets/{id}/sla` returns image/png (a hardcoded sla_red/yellow/green.png byte-array), NOT an importable JSON report; the JSON DataSetSLAReport is the SIBLING endpoint `/api/datasets/{id}/sla_report`. A BI client built to 'import' from /sla receives a 1-2 KB PNG and fails to parse it. Evidence: invariant:sla-as-png-vs-jsonsla-report-drift (DataQualityController.java:42-48, CachingByteArraySLAResourceResolver.java:30-54, openapi.yaml:1880-1894 vs sla_report at openapi.yaml:1898-1913) / F-022 (feature-flows/detail/F-022.yaml:1, primary_drift_class png_vs_json_doc_drift). [HIGH — LSN-002 'operator follows our guide off a cliff' class for the BI audience the page targets]"
  - "Page (Subsections) describes the Quality Dashboard as 'three breakdown rings (Table Health / Test Results / Monitored Tables), six anomaly-class metrics' — the three-ring count is correct, but 'six anomaly-class metrics' mis-attributes the number 6: the six is the per-run-status tile count (DataEntityRunStatus = SUCCESS/FAILED/SKIPPED/BROKEN/ABORTED/UNKNOWN) rendered inside each category row, NOT a count of anomaly classes. The DataQualityCategory enum has FIVE named anomaly classes (Assertion Tests / Volume Anomalies / Freshness Anomalies / Schema Changes / Column Values Anomalies) plus an 'Unknown category' catch-all, and the category count is dynamic (wire type is `string`, not an enum). Evidence: entitie:data-quality-test-category (TestCategoryResults.tsx:11-45, DataQualityCategoryMapperImpl.java:45-60, components.yaml:3802-3813) / entitie:data-entity-run-status (components.yaml:1407-1415) / F-032 (feature-flows/detail/F-032.yaml:1). [MEDIUM — LSN-019 mechanical-transcription drift; number attached to the wrong dimension]"
maintainer_curated: false
---

# Data Quality — doc understanding

This is the **Data Quality pillar landing page**. It frames ODD Platform as a Data Quality *aggregator* (checks run in external frameworks; ODD only ingests and surfaces their results) and routes the operator to four sub-surfaces: Test Results Import, the catalog-wide Quality Dashboard, per-dataset SLA statuses, and Test Run History. It maps cleanly to the three P-04 read/curate features — F-032 (the catalog-wide `/data-quality` dashboard; confirmed via `feature-flows/detail/F-032.yaml:1`, `ui_route:/data-quality`), F-022 (per-dataset Test reports + SLA badge; `feature-flows/detail/F-022.yaml:1`), and F-040 (per-entity Test Run History at `ui_route:/dataentities/{id}/history`; `feature-flows/detail/F-040.yaml:1`) — and to the DQ concept cluster (Data Quality Test, the Dashboard, Dataset SLA, Test Severity MINOR/MAJOR/CRITICAL, Dataset Test Report, Per-Entity Run History) plus the Data Quality Engineer audience the page explicitly links for the end-to-end use case.

Two drift findings carry from this landing page (both already corroborated by enriched code nodes, recorded in `doc_claim_vs_code`): the `/api/datasets/{id}/sla` "for BI-report import" claim propagates the HIGH-severity PNG-vs-JSON endpoint conflation (`invariant:sla-as-png-vs-jsonsla-report-drift`), and "six anomaly-class metrics" mis-attaches the six-value run-status enum count to the anomaly-category dimension (`entitie:data-quality-test-category`). The page's other specific claims verify correct: the three dashboard rings (Table Health / Test Results / Monitored Tables), the `/dataentities/{id}/history` route, the `status_reason` cross-owner read framing, and the MINOR/MAJOR/CRITICAL severity set all match the confirmed nodes. The deeper per-subsection drifts (the dashboard's "Test Results = count of test runs" semantic per `invariant:dq-dashboard-test-results-counts-tests-not-runs`, and the undocumented six-value `DataEntityRunStatus` enum) live on the dashboard.md / test-run-history.md sub-pages, not on this landing page.

The `POST /ingestion/entities/datasets/stats` endpoint the page cites for custom-framework test-result import (Subsections bullet 1) did not resolve to an enriched CodeNode via graph-search — the ingestion-stats surface is not yet in the substrate; its verification belongs to the `test-results-import.md` sub-page analysis, not this landing.

## Maintainer notes
