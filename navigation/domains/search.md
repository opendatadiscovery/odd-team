# Search

Full-text and faceted search across all metadata entities.

## Code Entry Points (odd-platform)

### Backend
- `odd-platform-specification/openapi.yaml` — `/api/search`, `/api/search/{search_id}`, `/api/search/{search_id}/facet/{facet_type}`
- `odd-platform-api/.../dto/FacetType.java` — 9 facet types: ENTITY_CLASSES, TYPES, NAMESPACES, DATA_SOURCES, OWNERS, TAGS, GROUPS, STATUSES, DATA_ENTITY
- `odd-platform-api/.../repository/reactive/ReactiveSearchFacetRepositoryImpl.java`
- `odd-platform-api/.../repository/util/FTSConfig.java` — full-text search config
- `odd-platform-api/.../repository/util/FTSConstants.java` — FTS constants
- `odd-platform-api/.../mapper/FacetStateMapper.java` → `FacetStateMapperImpl.java`

### UI
- `odd-platform-ui/src/components/Search/Search.tsx` — search page container
- `odd-platform-ui/src/components/Search/Filters/Filters.tsx` — 7 filter components: Datasource, Type, Namespace, Owner, Tag, Groups, Statuses
- `odd-platform-ui/src/components/Search/Results/Results.tsx` — search results view
- `odd-platform-ui/src/redux/slices/dataEntitySearch.slice.ts` — search state
- `odd-platform-ui/src/redux/selectors/dataentitySearch.selectors.ts`

### Term Search (separate)
- `odd-platform-ui/src/components/Terms/TermSearch/` — dedicated term search with own facets
- `odd-platform-api/.../service/term/TermSearchService.java`

## Documentation
- `documentation/docs/Features.md#advanced-search` — mentions 3 of 7 filters

## Related Domains
- data-entities (searchable objects)
- glossary (terms searchable via dedicated search)
- collaboration (tags/labels as facets)
