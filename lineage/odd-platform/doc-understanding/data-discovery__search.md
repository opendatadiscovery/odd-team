---
doc_page: "docs/data-discovery/search.md"
page_title: "Search and Filtering"
live_url: "https://docs.opendatadiscovery.org/features/data-discovery/search"
live_url_verified_status: "200"
live_url_resolved_slug: "features/data-discovery/search"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "Search Session"
    - "FTS Search Vector (Data Entity)"
    - "Compute facet counts catalog-wide (the catalog-cardinality enumeration surface)"
    - "Cross-owner facet-count enumeration via drill-down (REFACTOR-024 family extension)"
    - "tsquery operator-injection via persisted state (DoS via every facet aggregator)"
    - "EXCLUDE_FROM_SEARCH is broadly applied but NOT to /popular"
    - "F-001 UI LOOP CLOSURE — Popular-Tile Click Feeds view_count Increment"
    - "Highlight Data Entity (ts_headline FTS field-match render)"
    - "Bootstrap and orchestrate data-entity search session (Catalog page UI orchestrator role)"
  features:
    - "F-017"
  code_nodes:
    - "odd-platform java SearchController controller-method:search"
    - "odd-platform java SearchController controller-method:facets"
    - "odd-platform java SearchController controller-method:getSearchResults"
audience: [operator]
doc_claim_vs_code:
  - "Page is exceptionally well-aligned — every operator caveat traces to a confirmed graph invariant/code node. No code-contradicting claims found. The drift entries below are the few residual seams worth a maintainer's eye."
  - "Page (Technical details, line 61) links FTSConstants.java as 'the underlying constants used by the search engine'; the FTS query construction operators that actually break on the documented special chars `( ) & | ! * :` live in JooqFTSHelper.tsQuery (JooqFTSHelper.java:164-168 → to_tsquery at :100-105 — per invariant:tsquery-operator-injection-via-persisted-state), not in FTSConstants. The link is correct-but-incomplete: the special-char caveat (lines 92-94) and the constants link point at different files, so a developer following the link to understand the caveat lands one file away from the unescaped-operator code. — evidence: invariant:tsquery-operator-injection-via-persisted-state / JooqFTSHelper.java:164-168"
  - "Page (exclude_from_search caveat, line 102) enumerates the list surfaces that ignore the flag (Popular, By-Owner, By-Term, DEG-experiment runs, dimensions, detail GET, query-suggestions). The code-confirmed enumeration is sharper: the flag IS applied at 9 sites and the canonical home-page leak is listPopular's cteDataEntitySelect (ReactiveDataEntityRepositoryImpl.java:909-939), which has open backlog as REFACTOR-222 / TEST-GAP-310 / TEST-GAP-318. The page's prose claim 'a shared SQL helper that does not apply the predicate' is directionally right but the code shows distinct per-query CTEs, not one shared helper omission. — evidence: invariant:exclude-from-search-is-broadly-applied-but-not-to-popular / ReactiveDataEntityRepositoryImpl.java:909-939"
  - "Page (line 84) states a search_facets session 'lives until 30 days after its last access (configurable via housekeeping.ttl.search_facets_days)'. The 30-day default and the housekeeping knob are documented on the odd-platform config page; this page does not restate the default's source. Maintainer note only — not a contradiction; the cross-link to housekeeping settings is present (line 118). — evidence: entitie:search-session"
maintainer_curated: false
---

# Search and Filtering — doc understanding

This operator-facing page documents the Catalog's full-text + faceted search front door. It maps cleanly onto the `SearchController` surface: the session-creating `POST /api/search` (`SearchController.java:59` — confirmed node `odd-platform java SearchController controller-method:search`, which mints a `search_facets` row keyed by a server-generated UUID and returns counts + a `searchId`, not rows), the row-fetching `GET /api/search/{search_id}/results` (`getSearchResults`), and the facet surface (`getSearchFacetList` + `getFiltersForFacet`, confirmed node `…controller-method:facets` and feature **F-017 Search Filter Facets**). The seven-facet sidebar the page lists corresponds to the catalog-wide aggregators in `ReactiveSearchFacetRepositoryImpl`.

The page's standout value is its "Known limitations and operator caveats" section, which is a near-verbatim operator translation of confirmed ontology invariants: the `/search/{uuid}` server-side session with no `owner_id`/`created_by` column (`entitie:search-session`, schema at `V0_0_1__init.sql:204-211`); cross-owner facet-count enumeration by default (`invariant:cross-owner-facet-count-enumeration-via-drill-down`); the `tsquery` special-character 500 (`invariant:tsquery-operator-injection-via-persisted-state`); the `exclude_from_search`-ignored-by-Popular leak (`invariant:exclude-from-search-is-broadly-applied-but-not-to-popular`, backlog REFACTOR-222 / TEST-GAP-310); and the +2 `view_count` inflation per result click (`invariant:f-001-ui-loop-closure-popular-tile-click-feeds-view-count-increment`). The page reads as a direct downstream product of this ontology; the few `doc_claim_vs_code` entries above are editorial seams (a link that points one file away from the caveat code; a "shared SQL helper" phrasing the code shows as distinct per-query CTEs), not behavioural contradictions. Audience is **operator** throughout — the framing is "what you might assume / what actually happens / what to do today."

## Maintainer notes
