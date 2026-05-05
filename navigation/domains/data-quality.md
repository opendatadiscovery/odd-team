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
- `documentation/docs/Features.md#data-quality-test-results-import` — test results import
- `documentation/docs/Features.md#dataset-quality-statuses-sla` — SLA statuses
- `documentation/docs/use-cases/dq-visibility.md` — use case (Pandas Profiling claim was corrected by DOC-027 / done; path realigned by DOC-085)
- **Not documented**: DQ dashboard page (`/data-quality`), filters, standalone page UX

## Related Domains
- data-entities (quality results attach to entities)
- alerting (quality failures trigger alerts)
- ingestion (quality data ingested via collectors)
