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
- `documentation/docs/data-modelling/query-examples.md` — feature page (live: `https://docs.opendatadiscovery.org/data-modelling/query-examples`); covers create/edit affordance, RBAC grid (all 7 QUERY_EXAMPLE_* permissions), term-linking workflow, faceted search.
- **Known doc drift / known operator caveats** (per `lineage/odd-platform/feature-flows/detail/F-025.yaml`, `F-131.yaml`, `F-132.yaml` + scan-run SR-20260527T1400Z + SR-20260527T1800Z findings F-025a / F-131a/b/c / F-132a; tracked as backlog item DOC-183 — pending triage):
  - QUERY_EXAMPLE_* permission grid split across THREE controllers (QueryExampleController + DataEntityController + TermController) — operators configuring policies on one controller miss four of seven gates.
  - 10 of 13 endpoints unscoped (reads + searches fall through to `.authenticated()`).
  - XSS surface via `MDEditor.Markdown` without rehype-sanitize — `QueryExampleDetailsOverview.tsx:19,25` renders user-authored content verbatim.
  - No `@ActivityLog` on any Query Example mutation — invisible to global Activity Feed.
  - QueryExampleForm authoring dialog has no client-side XSS allowlist + no dirty-form warning + definition-vs-render mode-mismatch (plain Input authoring → Markdown render).
  - Query Example Details page tab navigation (Overview / Linked Entities / Linked Terms) is completely undocumented; `?tab=foo` URL param has no runtime validation.

## Related code sites (added 2026-05-27 — scan run SR-20260527T1800Z)
- `odd-platform-ui/src/components/DataModelling/QueryExampleForm/QueryExampleForm.tsx` — Create + Edit form-modal with embedded Markdown editor (F-131 anchor).
- `odd-platform-ui/src/components/DataModelling/QueryExamples/QueryExampleDetailsContainer.tsx` — Details page container + tab routing (F-132 anchor).
- `odd-platform-ui/src/components/DataModelling/QueryExamples/QueryExampleDetailsTabs.tsx` — Tab strip with hint badges.

## Related Domains
- data-entities (examples link to datasets)
- glossary (examples link to terms)
- search (dedicated search with facets)
