# Lookup Tables

Reference data management — editable lookup tables linked to entities for enrichment.

## Code Entry Points (odd-platform)

### Backend
- `odd-platform-api/.../service/DataEntityLookupTableService.java` → `DataEntityLookupTableServiceImpl.java`
- `odd-platform-api/.../repository/reactive/ReactiveLookupTableRepository.java` → `ReactiveLookupTableRepositoryImpl.java`
- `odd-platform-api/.../repository/reactive/ReactiveLookupTableDefinitionRepository.java`
- `odd-platform-api/.../repository/reactive/ReactiveLookupTableSearchEntrypointRepository.java`
- `odd-platform-api/.../mapper/LookupTableMapper.java`, `LookupTableDefinitionMapper.java`, `LookupTableRowMapper.java`
- `odd-platform-api/.../dto/LookupTableDto.java`, `LookupTableColumnDto.java`, `LookupTableColumnTypes.java`
- `odd-platform-api/.../service/LookupDataSearchServiceImpl.java`

### Entity Model
- Entity type: `LOOKUP_TABLE(24)` in `DataEntityTypeDto.java`
- Entity class: DATA_SET (lookup tables are datasets)

### RBAC Permissions (9)
LOOKUP_TABLE_CREATE, LOOKUP_TABLE_UPDATE, LOOKUP_TABLE_DELETE, LOOKUP_TABLE_DEFINITION_CREATE, LOOKUP_TABLE_DEFINITION_UPDATE, LOOKUP_TABLE_DEFINITION_DELETE, LOOKUP_TABLE_DATA_CREATE, LOOKUP_TABLE_DATA_UPDATE, LOOKUP_TABLE_DATA_DELETE

### UI
- `odd-platform-ui/src/components/MasterData/LookupTables.tsx`

## Tests
<!-- To be populated -->

## Documentation (verified 2026-04-30)
- User-facing page: `docs/lookup-tables.md` (DOC-038, review-ready) — creation flow, structure tab, 9 PG field types (LookupTableFieldType: VARCHAR/INTEGER/SERIAL/DECIMAL/BOOLEAN/DATE/TIME/JSON/UUID), data tab walkthrough, vs-regular-Data-Entity comparison, direct-DB and API access paths, the 9 LOOKUP_TABLE_* RBAC permissions table, and the 16-endpoint /api/referencedata/ API surface (table CRUD / column CRUD / row CRUD / search).
- SUMMARY placement: top-level sibling between Data Modelling and Use cases per CLAUDE.md Cornerstone 2 (Master Data Management incl. Reference Data is a separate pillar from Data Modelling).
- Features.md ## Lookup Tables H2 collapsed to a 2-paragraph teaser linking the new page; #id-3353 anchor preserved for back-compat.
- API name asymmetry: code/spec namespace is `ReferenceData` / `/api/referencedata/`; user-facing page label is "Lookup Tables"; navigation-section label is "Master Data". The doc page calls all three out explicitly to bridge searches.

## Related Domains
- data-entities (lookup tables link to entities)
- management (lookup tables are managed objects)
- search (lookup tables are searchable)
