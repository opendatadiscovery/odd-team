# Relationships / ERD

Entity-Relationship Diagram data — FK constraints, cross-schema references between datasets.

## Code Entry Points (odd-platform)

### Backend
- `odd-platform-api/.../controller/RelationshipController.java` — REST API
- Entity class: `DATA_RELATIONSHIP(9)` in `DataEntityClassDto.java`
- Entity types: `ENTITY_RELATIONSHIP(25)`, `GRAPH_RELATIONSHIP(26)` in `DataEntityTypeDto.java`

## Code Entry Points (odd-collectors)
- PostgreSQL relationships: `odd-collector/odd_collector/adapters/postgresql/mappers/relationships/`
- Snowflake relationships: `odd-collector/odd_collector/adapters/snowflake/mappers/relationships/`

## Tests
<!-- To be populated -->

## Documentation
- `documentation/docs/data-modelling/relationships.md` — feature page (live: `https://docs.opendatadiscovery.org/data-modelling/relationships`); covers ENTITY_RELATIONSHIP / GRAPH_RELATIONSHIP classes, ERD cardinality model, UI walkthrough.
- `documentation/docs/developer-guides/api-reference/relationships.md` — API reference.
- **Known doc drift** (per `lineage/odd-platform/feature-flows/detail/F-037.yaml` + scan run SR-20260527T1800Z findings F-037a/c/g): (a) Target column on Relationships list page renders Source data (RelationshipsListItem.tsx:73-81 copy-paste bug — doc says distinct columns); (b) row-click "routing determined by relationship type" misleads — code always navigates to /dataentities/{id}/overview; (c) page silent on permissions (no auth gate at any layer; cross-tenant catalog enumeration oracle).

## Related Domains
- data-entities (relationships connect datasets)
- collectors-adapters (adapters extract FK metadata)
- lineage (complementary to lineage — structural vs. flow)
