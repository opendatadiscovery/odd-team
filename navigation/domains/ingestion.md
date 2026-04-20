# Ingestion (stub)

The pipeline that moves metadata from data sources into the platform: Collector → Ingress API → Platform storage.

## Code Entry Points (odd-platform)
<!-- To be populated by scanner: navigation/feature-entry-points -->
- Controller: `odd-platform-api/.../controller/IngestionController.java`
- Service: `odd-platform-api/.../service/ingestion/IngestionService.java`
- OpenAPI: `odd-platform-specification/openapi.yaml` (ingestion endpoints)

## Code Entry Points (odd-collectors)
- SDK Collector: `odd-collector-sdk/odd_collector_sdk/collector.py`
- SDK Job: `odd-collector-sdk/odd_collector_sdk/job.py`
- SDK API Client: `odd-collector-sdk/odd_collector_sdk/api/`
- Adapter base: `odd-collector-sdk/odd_collector_sdk/domain/adapter.py`

## Code Entry Points (specification)
- Ingress API spec: `specification/`

## Tests
<!-- To be populated by scanners -->

## Documentation
<!-- To be populated by scanner: docs/accuracy/feature-behavior -->

## Data Flow
1. Collector loads `collector_config.yaml`
2. Dynamic adapter import based on plugin `type`
3. APScheduler triggers `get_data_entity_list()` on interval
4. SDK chunks entities and POSTs to Platform Ingress API
5. Platform validates, resolves ODDRNs, stores in PostgreSQL

## Related Domains
→ collectors-sdk (SDK orchestrates the pipeline)
→ collectors-adapters (adapters extract the metadata)
→ specification (defines the Ingress API contract)
→ data-entities (ingestion creates/updates entities)
