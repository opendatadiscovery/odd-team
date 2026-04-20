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
- **None** — feature is completely undocumented

## Related Domains
- data-entities (relationships connect datasets)
- collectors-adapters (adapters extract FK metadata)
- lineage (complementary to lineage — structural vs. flow)
