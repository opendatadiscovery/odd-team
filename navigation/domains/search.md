# Search

Full-text and faceted search across all metadata entities.

## Code Entry Points (odd-platform)

### Backend
- `odd-platform-specification/openapi.yaml` — `/api/search`, `/api/search/{search_id}`, `/api/search/{search_id}/facet/{facet_type}`
- `odd-platform-api/.../dto/FacetType.java` — 9 facet types: ENTITY_CLASSES, TYPES, NAMESPACES, DATA_SOURCES, OWNERS, TAGS, GROUPS, STATUSES, DATA_ENTITY
- `odd-platform-api/.../repository/reactive/ReactiveSearchFacetRepositoryImpl.java`
- `odd-platform-api/.../repository/util/JooqFTSHelper.java` — **the single FTS sink and the home of the product's query grammar.** `tsQueryExpression(String)` compiles a user's search string to a tsquery; `ftsCondition` / `ftsRankField` are the match + rank sinks. **7 repository classes / 26 call sites** consume it — the unified asset search, the legacy `/api/search`, the facet counts, term search, query-example search, lookup-table search, autocomplete suggestions and the `ts_headline` highlights — so a change here is a change to every search surface at once. Bare words are PREFIX-matched (`tsQuery`, the #1756 sanitiser); `"phrase"` / `-exclusion` / `or` compile to `phraseto_tsquery` / `!! plainto_tsquery` / `||` groups, each guarded by `querytree(...) = 'T'` so a branch with no positive term cannot force a sequential scan (#1840 / ST-6)
- `odd-platform-api/.../repository/util/FTSConfig.java` — full-text search config
- `odd-platform-api/.../repository/util/FTSConstants.java` — FTS constants
- `odd-platform-api/.../repository/reactive/ReactiveDataEntityRepositoryImpl.java` — `getHighlightedResult` (`ts_headline`, the result-row "why you see it" highlight) + `getQuerySuggestions` (autocomplete); both build their query through the sink above
- `odd-platform-api/.../mapper/FacetStateMapper.java` → `FacetStateMapperImpl.java`

### UI
- `odd-platform-ui/src/components/Search/Search.tsx` — search page container
- `odd-platform-ui/src/components/Search/Filters/Filters.tsx` — 7 filter components: Datasource, Type, Namespace, Owner, Tag, Groups, Statuses
- `odd-platform-ui/src/components/Search/Results/Results.tsx` — search results view
- `odd-platform-ui/src/components/shared/elements/MainSearchInput/MainSearchInput.tsx` — the ONE search box, rendered on both entry points (the Catalog home hero and the Search page); commits a query to `/search?q=` on Enter. `SearchSyntaxHint.tsx` beside it is the query-syntax inline help (ADR-0076 `InformationIcon` + `AppTooltip`)
- `odd-platform-ui/src/redux/slices/dataEntitySearch.slice.ts` — search state
- `odd-platform-ui/src/redux/selectors/dataentitySearch.selectors.ts`

### Unified cross-kind Asset Search (#1825 overhaul — ST-1..ST-5)

The 2026-07 overhaul added a SECOND, additive search stack beside the legacy data-entity-only one above.
`POST /api/search/assets` returns Data Entities + Terms + Query Examples in ONE ranked list, served by a single
polymorphic FTS index. The legacy `/api/search` paths are untouched (ADR `unified-asset-search` D9).

- `odd-platform-api/.../controller/AssetSearchController.java` — the `/api/search/assets` entry point
- `odd-platform-api/.../service/AssetSearchService.java` → `AssetSearchServiceImpl.java`
- `odd-platform-api/.../service/SearchAssetResolver.java` — resolves `(asset_kind, asset_id)` refs into renderable assets
- `odd-platform-api/.../repository/reactive/ReactiveAssetSearchRepository.java` → `…Impl.java` — the ranked
  query: `keysetPage` (index-backed browse sorts) / `relevancePage` (ts_rank, OFFSET + depth-cap) / `count` /
  `refreshPopularityScores`
- `odd-platform-api/.../dto/AssetSearchCursor.java` + `AssetSearchPageRow.java` — the keyset cursor + page row
- `odd-platform-api/.../service/job/AssetPopularitySnapshotJob.java` — **the scheduled job** (`@Scheduled` 15 min
  + ShedLock) that re-snapshots `popularity_score` off the request path. Deliberately NOT a `HousekeepingJob`
  (that manager is opt-in); sibling idiom: `service/job/DataEntityStatusSwitchJob.java`
- `odd-platform-ui/src/redux/{actions,thunks,slices,selectors,interfaces}/assetSearch.*` — the FE state
- `odd-platform-ui/src/lib/search/searchUrlState.ts` — search state ⇄ URL params (ST-1a/ST-1b)
- Saved searches (ST-3): `controller/SavedSearchController.java`, `service/SavedSearchService{,Impl}.java`,
  `repository/reactive/ReactiveSavedSearchRepository{,Impl}.java`,
  `odd-platform-ui/src/components/Search/Results/SavedSearches/`

**Schema (the substrate — read these before touching the ranked query):**
- `db/migration/V0_0_96__add_status_priority.sql` — the denormalised status-priority sort key
- `db/migration/V0_0_97__create_saved_search.sql` — saved searches
- `db/migration/V0_0_98__create_asset_search_entrypoint.sql` — **the unified index table** `asset_search_entrypoint`
  `(asset_kind, asset_id, search_vector)` + the per-entrypoint AFTER triggers that mirror each kind's FTS vector in
- `db/migration/V0_0_99__denormalise_asset_search_sort_columns.sql` — NULLS-aligned sort columns + btree indexes
- `db/migration/V0_0_100__snapshot_popularity_score.sql` — `popularity_score` + the `asset_popularity_bucket()`
  log2-band function (the single source of truth shared by the backfill AND the refresh job) + the composite index.
  **There is deliberately NO trigger on `data_entity.view_count`** — the read hot path stays decoupled from the
  search index (ADR D5 + its rev-3 SRE correction); popularity moves only when the snapshot job runs

**Decision record:** `adrs/drafts/unified-asset-search.md` (D1 unified index / D2 live semi-join / D5 snapshotted
popularity / D9 no breaking change / D12 keyset-vs-relevance pagination) + the SRE corrections in
`adrs/drafts/research/unified-asset-search/SEARCH-CAPABILITIES-DESIGN.md`.

**Coverage caveat:** this subsystem has **no ontology sidecars and no feature-flow** yet (`lineage/odd-platform/`
carries nothing for `asset_search_entrypoint`) — tracked as `backlog/navigation/NAV-004.md`. Until that closes,
this file is the only navigation pointer into the unified stack.

### Term Search (separate)
- `odd-platform-ui/src/components/Terms/TermSearch/` — dedicated term search with own facets
- `odd-platform-api/.../service/term/TermSearchService.java`

## Documentation
- `documentation/docs/Features.md#advanced-search` — mentions 3 of 7 filters

## Related Domains
- data-entities (searchable objects; `view_count` is the popularity input — see the V0_0_100 caveat above)
- glossary (terms searchable via dedicated search)
- collaboration (tags/labels as facets)
