# Directory

Browsable data source catalog — hierarchy of source types → data sources → entity types → entities.

## Code Entry Points (odd-platform)

### Controller
- `odd-platform-api/.../controller/DirectoryController.java` — 4 endpoints

### Service
- `odd-platform-api/.../service/DirectoryService.java`

### UI
- `odd-platform-ui/src/components/Directory/` — directory page
- Route: `/directory` (`directoryRoutes.ts`, 62 lines with typed params)

### API
- `GET /api/directory` — (not used directly)
- `GET /api/directory/datasources` — list data source types with prefixes
- `GET /api/directory/datasources/{data_source_id}/types` — entity types for a data source
- `GET /api/directory/datasources/{data_source_id}` — entities in a data source

## Documentation
- **None** — feature is completely undocumented

## Related Domains
- data-entities (directory browses entities)
- management (data sources are managed objects)
- search (complementary — browse vs. search)
