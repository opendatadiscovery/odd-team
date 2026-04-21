# Query Examples

SQL query examples linked to datasets and terms, with dedicated search and Data Modelling UI section.

## Code Entry Points (odd-platform)

### Controller
- `odd-platform-api/.../controller/QueryExampleController.java` — 11 endpoints: CRUD, search, facets, suggestions, dataset/term linking

### Services
- `odd-platform-api/.../service/QueryExampleService.java`
- `odd-platform-api/.../service/QueryExampleSearchService.java`

### UI
- `odd-platform-ui/src/components/DataModelling/QueryExamples.tsx` — list page
- `odd-platform-ui/src/components/DataModelling/QueryExampleDetails/` — detail view
- `odd-platform-ui/src/components/DataModelling/QueryExampleForm/` — create/edit form
- `odd-platform-ui/src/components/DataModelling/QueryExampleSearchResults/` — search results
- Route: `/data-modelling/query-examples` (`queryExamplesRoutes.ts`)

### RBAC Permissions (7)
QUERY_EXAMPLE_DATASET_CREATE, QUERY_EXAMPLE_DATASET_DELETE, QUERY_EXAMPLE_TERM_CREATE, QUERY_EXAMPLE_TERM_DELETE, QUERY_EXAMPLE_CREATE, QUERY_EXAMPLE_UPDATE, QUERY_EXAMPLE_DELETE

### API
- `POST /api/queryexample` — create
- `GET/PUT/DELETE /api/queryexample/{example_id}` — CRUD
- `POST /api/queryexample/search` — initiate search
- `GET /api/queryexample/search/{search_id}` — get search facets
- `GET /api/queryexample/search/{search_id}/results` — get results
- `GET /api/queryexample/dataset/{data_entity_id}` — examples for dataset
- `GET /api/queryexample/term/{term_id}` — examples for term

## Documentation
- **None** — feature is completely undocumented

## Related Domains
- data-entities (examples link to datasets)
- glossary (examples link to terms)
- search (dedicated search with facets)
