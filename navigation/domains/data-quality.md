# Data Quality

SLA monitoring, quality test results, assertions, profiling, expectations integration.

## Code Entry Points (odd-platform)

### Controllers
- `odd-platform-api/.../controller/DataQualityController.java` — DQ test configuration
- `odd-platform-api/.../controller/DataQualityRunsController.java` — DQ test run results

### UI — Dashboard Page
- `odd-platform-ui/src/components/DataQuality/DataQuality.tsx` — top-level DQ page (`/data-quality`)
- `odd-platform-ui/src/components/DataQuality/DataQualityContent.tsx` — main content
- `odd-platform-ui/src/components/DataQuality/DataQualityFilters/` — filter components
- `odd-platform-ui/src/components/DataQuality/DataQualityStore/` — state management
- `odd-platform-ui/src/components/DataQuality/TestResults/` — test result display
- `odd-platform-ui/src/routes/dataQualityRoutes.ts` — route: `/data-quality`

### UI — Per-Entity Test Reports
- `odd-platform-ui/src/components/DataEntityDetails/Overview/OverviewDataQualityReport/`
- `odd-platform-ui/src/components/DataEntityDetails/Overview/OverviewExpectations/`
- Entity detail tab: `TEST_REPORTS` in `dataEntitiesRoutes.ts`

### API
- `/api/datasets/{data_entity_id}/sla` — SLA endpoint
- `/api/datasets/{data_entity_id}/sla_report` — SLA report
- `/api/datasets/{data_entity_id}/test_report` — test report
- `/api/datasets/{data_entity_id}/dataqatests` — DQ tests for dataset
- `/api/dataqatests/runs` — DQ test runs

## Code Entry Points (standalone integrations)
- `odd-great-expectations` — GE checkpoint action → pushes DQ results
- `odd-collector-profiler` — DataProfiler (Capital One) → pushes dataset statistics

## Documentation
- `documentation/docs/data-quality/dashboard.md` — the catalog-wide Quality Dashboard page (`/data-quality`): the three rings (Table Health — a 4-slice priority cascade incl. Unknown as of 0.29.0/#1794; Test Results Breakdown — counts in-flight RUNNING as of 0.29.0/#1794; Monitored Tables), the six anomaly-class metrics, and the per-side filter sets
- `documentation/docs/data-quality/test-run-history.md` — per-test run history (in-flight runs sort to top, 0.29.0/#1793)
- `documentation/docs/data-quality/sla-statuses.md` — dataset SLA statuses (GREEN/YELLOW/RED)
- `documentation/docs/data-quality/test-results-import.md` — pushing DQ test results in
- `documentation/docs/Features.md#data-quality-test-results-import` — test results import
- `documentation/docs/Features.md#dataset-quality-statuses-sla` — SLA statuses
- `documentation/docs/use-cases/dq-visibility.md` — use case (Pandas Profiling claim was corrected by DOC-027 / done; path realigned by DOC-085)
- Thin coverage (candidate follow-up): the dashboard's per-side filter UX + standalone-page interactions are only lightly documented

## Related Domains
- data-entities (quality results attach to entities)
- alerting (quality failures trigger alerts)
- ingestion (quality data ingested via collectors)
