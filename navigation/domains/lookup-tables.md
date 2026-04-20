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

## Documentation
- **None** — feature is completely undocumented

## Related Domains
- data-entities (lookup tables link to entities)
- management (lookup tables are managed objects)
- search (lookup tables are searchable)
