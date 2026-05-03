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
- User-facing page: `docs/master-data-management/lookup-tables.md` (DOC-038, review-ready after re-ship) — creation flow, structure tab, 9 PG field types (LookupTableFieldType: VARCHAR/INTEGER/SERIAL/DECIMAL/BOOLEAN/DATE/TIME/JSON/UUID), data tab walkthrough, vs-regular-Data-Entity comparison, direct-DB and API access paths, the 9 LOOKUP_TABLE_* RBAC permissions table, and the 16-endpoint /api/referencedata/ API surface (table CRUD / column CRUD / row CRUD / search).
- SUMMARY placement: nested under a new `master-data-management.md` pillar landing (sibling of `data-modelling.md`) per CLAUDE.md Cornerstone 2 + main-concepts.md:72 governance-map. Pillar landing introduces the broader Master Data Management surface; Lookup Tables is the only child today.
- Features.md ## Lookup Tables H2 collapsed to a 2-paragraph teaser linking the new page; #id-3353 anchor preserved for back-compat.
- API name asymmetry: code/spec namespace is `ReferenceData` / `/api/referencedata/`; user-facing page label is "Lookup Tables"; navigation-section label is "Master Data". The doc page calls all three out explicitly to bridge searches.

## UI Navigation
- **Master Data** is a top-level toolbar tab in `odd-platform-ui/src/components/shared/elements/AppToolbar/ToolbarTabs/ToolbarTabs.tsx:36-79` (sibling to Management, NOT a child); routing in `App.tsx:62,75` makes `lookupTablesPath()` at `/master-data/lookup-tables` a top-level `<Route>` next to `managementPath()` at `/management/*`. Doc claims about hierarchy must cite this SoT, not `LookupTables.tsx` (which is the page-content component and silent on navigation).

## Related Domains
- data-entities (lookup tables link to entities)
- management (lookup tables are managed objects, but UI placement is sibling top-level tab — see UI Navigation above)
- search (lookup tables are searchable)
