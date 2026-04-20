# Data Entities (stub)

Core metadata objects in the platform: tables, views, jobs, pipelines, ML models, dashboards, etc.

## Code Entry Points (odd-platform)
<!-- To be populated by scanner: navigation/feature-entry-points -->
- Controller: `odd-platform-api/.../controller/DataEntityController.java`
- Service: `odd-platform-api/.../service/DataEntityService.java`
- Repository: `odd-platform-api/.../repository/reactive/ReactiveDataEntityRepository.java`
- UI Components: `odd-platform-ui/src/components/DataEntityDetails/`

## Tests
<!-- To be populated by scanner: tests/platform-backend -->

## Documentation
<!-- To be populated by scanner: docs/accuracy/feature-behavior -->

## Ingestion Path
Collector `get_data_entity_list()` → Ingress API → Platform ingests via `IngestionService`

## Related Domains
→ lineage (entities have upstream/downstream)
→ search (entities are searchable)
→ collaboration (entities have owners, tags)
→ alerting (entity state changes trigger alerts)
→ data-quality (entities have quality test results)
