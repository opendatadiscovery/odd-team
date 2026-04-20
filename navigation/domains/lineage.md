# Lineage (stub)

Tracks data flow between entities: upstream sources → transformations → downstream consumers.

## Code Entry Points (odd-platform)
<!-- To be populated by scanner: navigation/feature-entry-points -->
- Controller: `odd-platform-api/.../controller/LineageController.java`
- Service: `odd-platform-api/.../service/LineageService.java`
- Repository: `odd-platform-api/.../repository/reactive/ReactiveLineageRepository.java`
- UI Components: `odd-platform-ui/src/components/DataEntityDetails/Lineage/`

## Tests
<!-- To be populated by scanner: tests/platform-backend -->

## Documentation
<!-- To be populated by scanner: docs/accuracy/feature-behavior -->

## Ingestion Path
Collector reports upstream/downstream ODDRNs in `data_transformer` fields
→ Ingress API receives `DataEntityList`
→ Platform resolves ODDRNs and builds graph in `lineage_relation` table

## Related Domains
→ data-entities (lineage connects entities)
→ ingestion (lineage data comes via collectors)
→ specification (lineage model defined in spec)
