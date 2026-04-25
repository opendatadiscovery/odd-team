# Glossary

Business terms, definitions, term-to-entity assignments, term hierarchy.

## Code Entry Points (odd-platform)

### Controller
- `odd-platform-api/.../controller/TermController.java` — full CRUD, ownership, tags, linked terms, query examples, search

### Services
- `odd-platform-api/.../service/term/TermService.java` — term CRUD, term-to-entity/term-to-term linking
- `odd-platform-api/.../service/term/TermSearchService.java` — dedicated term search with facets
- `odd-platform-api/.../service/term/TermOwnershipService.java` — term ownership management

### Key Features (from code)
- Term CRUD with namespaces
- Term ownership (create/update/delete owners)
- Term tagging
- Term-to-entity linking (data entities and dataset fields/columns)
- Term-to-term linking (direct API: `addLinkedTermToTerm`, `deleteLinkedTermFromTerm`)
- Query example associations
- Dedicated term search with facets
- Reverse lookup: which entities link to a term (`getTermLinkedEntities`, `getTermLinkedColumns`)

### API endpoints
- `GET/POST /api/terms` — list/create terms
- `GET/PUT/DELETE /api/terms/{term_id}` — term details/update/delete
- `GET /api/terms/{term_id}/entities` — linked entities
- `GET /api/terms/{term_id}/columns` — linked columns
- `GET /api/terms/{term_id}/linked_terms` — linked terms
- `POST /api/terms/{term_id}/term` — link an existing term to another term (`addLinkedTermToTerm`)
- `DELETE /api/terms/{term_id}/term/{linked_term_id}` — remove a term-to-term link (`deleteLinkedTermFromTerm`)
- `POST/DELETE /api/terms/{term_id}/query_examples` — query examples

## Documentation
- `documentation/docs/Features.md#dictionary-terms` — basic term feature
- `documentation/docs/Features.md#associating-terms-with-data-entities-through-descriptive-information` — text-based linking
- `documentation/docs/GLOSSARY.md` — stub (5 empty headers)

## Related Domains
- data-entities (terms assigned to entities and fields)
- search (terms are searchable via dedicated search)
- collaboration (term ownership)
