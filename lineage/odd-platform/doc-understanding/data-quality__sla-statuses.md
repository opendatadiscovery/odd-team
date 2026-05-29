---
doc_page: "docs/data-quality/sla-statuses.md"
page_title: "Dataset Quality Statuses (SLA)"
live_url: "https://docs.opendatadiscovery.org/features/data-quality/sla-statuses"
live_url_verified_status: "200"
live_url_resolved_slug: "features/data-quality/sla-statuses"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "Dataset SLA (Green/Yellow/Red aggregate + PNG badge)"
    - "Data Quality Test Severity (MINOR / MAJOR / CRITICAL)"
    - "Data Quality Test"
    - "Set data-quality test severity (owner-scoped mutation)"
    - "Render SLA colour as PNG badge"
    - "SLA-as-PNG endpoint vs DataSetSLAReport JSON doc-vs-code drift"
    - "Data Quality Engineer"
  features:
    - "F-022"
    - "F-057"
  code_nodes:
    - "odd-platform java DataQualityController controller-method:getSLA"
    - "odd-platform java DataQualityController controller-method:getDatasetSLAReport"
    - "odd-platform java DataQualityController controller-method:getDataEntityDataQATests"
    - "odd-platform java DataQualityController controller-method:getDatasetTestReport"
    - "odd-platform java DataQualityController controller-method:setDataQATestSeverity"
    - "odd-platform openapi tags openapi-tag:dataQuality"
audience: [operator, data-consumer, developer]
doc_claim_vs_code:
  - "Caveat block mis-cites 2 of 4 read-endpoint paths. Page writes `GET /api/dataentities/{id}/datasetstests` and `GET /api/datasets/{id}/test_reports`; the canonical paths are `GET /api/datasets/{data_entity_id}/dataqatests` (getDataEntityDataQATests) and `GET /api/datasets/{data_entity_id}/test_report` (singular, getDatasetTestReport). Wrong resource root (`dataentities` vs `datasets`), wrong segment (`datasetstests` vs `dataqatests`), and plural-vs-singular (`test_reports` vs `test_report`). An operator copying a URL from the security caveat to test access gets 404. The body table in 'Importing SLA into BI reports' uses the correct `/sla` and `/sla_report` paths, so the drift is isolated to the caveat enumeration. Evidence: openapi.yaml:1915 (`/api/datasets/{data_entity_id}/test_report`), openapi.yaml:1932 (`/api/datasets/{data_entity_id}/dataqatests`); concept entitie:data-quality-test (DataQualityController.java:25,33). DOC-GAP candidate (LOW-MEDIUM: factual path drift in a caveat; the live-correct paths are present elsewhere on the same page)."
  - "RESOLVED (no current drift) — the historic HIGH-severity invariant:sla-as-png-vs-jsonsla-report-drift no longer applies to this page revision. That invariant recorded an EARLIER page that conflated `/sla` with the JSON `DataSetSLAReport`. The current page's 'Importing SLA into BI reports' table correctly separates `GET /api/datasets/{data_entity_id}/sla` → `image/png` (PNG badge) from `GET /api/datasets/{data_entity_id}/sla_report` → `application/json DataSetSLAReport`, matching openapi.yaml:1880 (getSLA → image/png) and openapi.yaml:1898 (getDatasetSLAReport → application/json). The concept invariant:sla-as-png-vs-jsonsla-report-drift carries a stale 'fix is doc-side / page misdescribes' note that the page has since superseded — the concept's vocabulary_status should be refreshed to doc-side-RESOLVED. Surfaced as the reverse drift (concept stale vs page correct), not a page defect."
maintainer_curated: false
---

# Dataset Quality Statuses (SLA) — doc understanding

This page is the operator + BI-integrator surface for ODD's per-dataset data-quality SLA. It tells an operator how to set per-test severities (MINOR / MAJOR / CRITICAL — concept `entitie:data-quality-test-severity`, set via `setDataQATestSeverity` / `PUT .../severity`, owner-scoped through `DATASET_TEST_RUN_SET_SEVERITY` per `operation:set-data-quality-test-severity-owner-scoped-mutation`), explains how those severities aggregate into the dataset SLA colour by `SLACalculator` (concept `entitie:dataset-sla`; the page's Red/Yellow/Green failure-pattern rules match the SLACalculator.java:80-100 semantics recorded on that concept), and gives a BI-consumer two endpoints — the `image/png` badge (`getSLA`, `operation:render-sla-colour-as-png-badge`) and the JSON `DataSetSLAReport` (`getDatasetSLAReport`). The five DQ endpoints are the `openapi-tag:dataQuality` surface and feature `F-022`.

The page is notably accurate and operator-honest: all three of its `Known operator caveats` are confirmed against code. (1) The default-MAJOR fallback for tests with no operator-set severity is real — `ReactiveDataQualityRepositoryImpl.java:142-148` per `entitie:data-quality-test-severity`. (2) The "any authenticated user can read every dataset's DQ" caveat is real — only the lone write endpoint has a `SecurityConstants.SECURITY_RULES` entry (line 243-246); the four reads are unscoped (feature `F-022`). (3) The "severity changes are not logged in the Activity Feed / no `last_modified_by` / no versioning" caveat is exactly feature `F-057` and `operation:set-data-quality-test-severity-owner-scoped-mutation` (onDuplicateKeyUpdate at ReactiveDataQualityRepositoryImpl.java:90-101, no ActivityEvent). The data-quality-engineer (`audience:data-quality-engineer`) is the primary reader.

The one current drift is a factual path slip in the security caveat block: two of the four enumerated read-endpoint URLs are mistyped (`/api/dataentities/{id}/datasetstests` and `test_reports`) versus the canonical `/api/datasets/{data_entity_id}/dataqatests` and `test_report` (openapi.yaml:1932, :1915) — minor, since the body table on the same page uses the correct paths. Separately, the historic PNG-vs-JSON drift invariant is now stale: this page revision disambiguates the two endpoints correctly, so the drift is RESOLVED on the doc side and the concept note should be refreshed.

## Maintainer notes
