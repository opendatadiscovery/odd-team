# ADR (draft) — Unified Asset Search

| | |
|---|---|
| **Status** | **Agreed direction (draft, rev 2)** — approved by the maintainer 2026-06-29 as the plan to proceed; each slice is still refined + GATE-1-approved before code (G-C7 + G-C3). Design for issue [#1825](https://github.com/opendatadiscovery/odd-platform/issues/1825). |
| **Date** | 2026-06-29 (rev 2 — maintainer steer: 1.0.0 may rework core engines; performance + UX as first-class; choose rework when benefit > migration drawback; lineage depth a per-direction parameter). |
| **Repo** | `opendatadiscovery/odd-platform` |
| **Design source** | `prds/0003-unified-asset-search.md` (PRD-0003). This ADR fixes the *architectural* decisions. |
| **Drives** | #1825 (the overhaul). **Supersedes** the Favorites tab (#1815 Group B) + the Recently-Viewed tab (#1816) — both become filters here. **Reuses** the merged Favorites foundation (`adrs/drafts/favorites-recently-viewed-foundation.md`). |
| **Why an ADR (G-C7)** | A reworked **core search engine** + a **new public search contract** + the **retirement of shipped surfaces**. Search/navigation is ODD's primary function — this is the most load-bearing change in the 1.0.0 line. |

## Context — the search subsystem is data-entity-native end-to-end *(verified 2026-06-29, `da2932e1`)*

- `/api/search` is a **stateful session**: `search(SearchFormData)` → a `searchId` + facet state; `updateFacets(searchId, …)` mutates it; `getSearchResults(searchId)` → **`DataEntityList`** (`service/search/SearchServiceImpl.java:75,85,99`). Facet counts include an **`myObjectsCount` from `authIdentityProvider.fetchAssociatedOwner()`** (`:128`) — "My Objects" is already a search-side concept.
- The DE index is one `search_entrypoint` tsvector. **Terms, Query Examples, Lookup Tables each already have their own FTS entrypoint + service** (`Reactive{Term,QueryExample,LookupTable}SearchEntrypointRepository`) + dedicated surfaces.
- Facets are **9 categorical DE dimensions** (`dto/FacetType.java`). Highlights are **`DataEntitySearchHighlight` — DE-only** (a grep for `Highlight` over term/query code is empty). "Popular" is a **global `view_count DESC`** (`ReactiveDataEntityRepositoryImpl.java:633`).
- Lineage is an **edge table** (`LINEAGE`) traversed **depth-bounded**: `getLineageRelations(roots, LineageDepth, …)` (N-hop) + `getLineageRelationsForDepthOne(rootIds, …)` (1-hop) — `repository/reactive/ReactiveLineageRepository.java`.
- The merged **Favorites foundation** gives the polymorphic `(asset_kind, asset_id)` **`Asset`** model + `CurrentUserIdentityResolver` (per-user; shared sentinel under `auth.type=DISABLED`) + **resolve-live-by-semi-join** (favorites ADR D3) — reused here.

PRD-0003 consolidates the overlapping list surfaces into one faceted cross-kind **Asset** search. ODD is, first and foremost, a search-and-navigation platform — so for 1.0.0 this surface is held to a **most-capable-on-the-market** bar.

## Guiding principles (the 1.0.0 bar — they decide every trade-off below)

1. **UI/UX of the core, perfection as the target.** Search *is* the product's primary navigation; every slice gets the highest polish bar + a pixel review.
2. **Performance is first-class.** Search is the most-frequently-used feature; per-query latency is a **release gate**, not an afterthought. A design that is cleaner but slower loses.
3. **Modularity + backward-compat, and *choose the rework* when its benefit outweighs the migration drawback.** 1.0.0 **may rework core engines** — but existing users on current endpoints + UI elements must migrate **without stress**: the public contract + UI patterns stay compatible (additive, deprecation windows), even while the internals are rebuilt. A breaking change is taken only where benefit clearly > migration cost, never silently.

## Decision

### D1 — A **unified cross-kind search index**, maintained alongside the per-kind ones (re-weighed: for 1.0.0, performance + capability beat the migration rework)
Build a single polymorphic **`asset_search_entrypoint`** (`asset_kind`, `asset_id`, the FTS `tsvector`, + the shared sortable/filterable columns) covering **all** kinds, maintained by the same write-path that maintains the per-kind vectors. The new unified search runs **one** ranked query over it.
- **Why (re-weighed against federated, under principles 2 + 3):** for the **most-used feature**, a unified index gives **one** ranked query instead of a **4-way fan-out + merge + cross-source pagination** (federated pagination is genuinely hard — you over-fetch from each source and re-merge every page), **true cross-kind relevance** (one `ts_rank` across kinds, not four lists stitched together), and the most-capable search. The migration (a backfill + write-path maintenance) is the accepted **core-engine rework** 1.0.0 permits — its benefit (latency + ranking + correct pagination) clearly beats the drawback.
- **Backward-compat (the bound on the rework — principle 3):** the per-kind entrypoints + the existing `/api/search` **keep working** during a convergence window (the unified index is **additive** — a new table + maintenance); existing endpoint/UI users are not broken (D9). The per-kind paths converge onto the unified index across the 1.0.0 line.
- **Rejected (kept as the fallback) — the federated aggregator:** no migration, a fine MVP, but it pays the 4-query + merge + pagination cost on every search and only approximates cross-kind ranking — it loses on principles 1+2. Fall back to it only if the unified-index maintenance proves disproportionately costly. *(Confidence: HIGH for the direction; the index schema + the incremental-maintenance pipeline are the P1 design + the first place we measure latency.)*

### D2 — The result is the polymorphic **`Asset`** union, resolved **live by semi-join** (reuse the Favorites model)
A result page is `Asset[]` of `(asset_kind, one-of {DataEntityRef | TermRef | QueryExampleRef | …})` — the discriminated union the Favorites list already returns (favorites ADR D2). The unified index returns the ranked, paginated `(asset_kind, asset_id)` page; titles/refs resolve **live** by semi-joining that page back onto each kind's existing list query (favorites ADR D3 / `FavoriteAssetResolver` is the template), inheriting each kind's visibility predicate. The index carries only what's needed to **match + rank + filter + sort**; the **display** comes from the live join (page-sized — never a full scan). *(Confidence: HIGH.)*

### D3 — Filters are facets on the (reworked) search session model, cross-kind
Extend `SearchFormData` + the facet state — one search model, not a second engine:

| Filter | Backing |
|---|---|
| **Asset type** (+ DE class refinement) | a column on the unified index (`asset_kind`) + the existing `ENTITY_CLASSES` facet for the DE split |
| **Favorites** (All / Yes / No) | join / anti-join to the `favorite` table via `CurrentUserIdentityResolver` (merged) |
| **My data** (All / My-Objects / Up / Down) | `fetchAssociatedOwner()` (`SearchServiceImpl:128`) + the lineage repo, with per-direction depth (D4) |
| **Popular** (numeric range) | the existing `view_count`, denormalised onto the index for fast range + histogram (D5) |
| **Recently viewed** (datetime) | `#1816`'s `recently_viewed` (built in parallel), joined per current identity |

*(Confidence: HIGH.)*

### D4 — "My data" lineage is a **per-direction depth parameter** (default 1 up + 1 down, independently settable)
"My Objects" = `fetchAssociatedOwner()`'s owned set. Upstream/Downstream = its lineage neighbours. **Depth is a first-class search parameter — `upstream_depth` and `downstream_depth`, each defaulting to `1`, settable independently** (e.g. 2 upstream + 1 downstream). 1-hop uses `getLineageRelationsForDepthOne`; deeper uses `getLineageRelations(roots, LineageDepth)` — both exist. The neighbour set is intersected with the search results.
- **Why a per-direction parameter (maintainer's explicit spec):** governance users reason about impact radius differently up vs down; default-1-both keeps the common case cheap, while a power user widens one direction. It's a parameter from day one, not "1-hop now, deepen later."
- **Performance (principle 2):** depth caps the expansion; guard total-set size + deep/dense traversals (a max-depth ceiling + a node-count cap). **Auth:** empty under DISABLED (no owner). *(Confidence: HIGH.)*

### D5 — **Popular** is a **numeric-range facet** over the existing `view_count` — denormalised onto the index
The Popular filter ranges over the existing global `view_count` (`ReactiveDataEntityRepositoryImpl:633`), used **as-is**, denormalised onto the unified index so the range filter + the histogram are index-fast. It is the first **numeric-range facet** (a reusable widget — later row/column counts, freshness). The **histogram** is a bucketed aggregate (`width_bucket`) over the *filtered* set — a **SHOULD**, cached/bounded (principle 2). **DE-scoped**; **My/Global-Popular is a separate later track** (recency ≠ frequency; frequency is its own work). *(Confidence: HIGH.)*

### D6 — Highlights: rich for DE now; term/QE parity is a tracked follow-up
DE keeps `DataEntitySearchHighlight`. Terms/QE have **no highlight infra today** → cross-kind highlight parity (a per-kind highlight model) is a **defined follow-up**, not a launch blocker; the row degrades (no badge for a kind without one). The "why it matched" badge is part of the **UX-perfection** target (principle 1), so parity is scheduled, not dropped. *(Confidence: MEDIUM.)*

### D7 — Result columns are user-configurable; **persist client-side first**, server-side later
A "field constructor" over a **kind/type-aware field catalog** (shared fields + kind-specific — Quality Test Suite URL etc. already in `Results.styles` `AddColNames`); a chosen field renders only for kinds that carry it. Persist **client-side first** (the platform already persists UI state client-side); **server-side per-user saved views** are a later enhancement. *(Confidence: MEDIUM.)*

### D8 — Retire the tabs; home blocks become deep-link widgets
Per PRD-0003 R3/R5: remove the `/search` class tabs + My-Objects tab (→ Asset-type + My-data filters) and the `/favorites` tab (→ the Favorites filter). The catalog-overview **panels stay** as widgets whose "See all" opens `/search` with the filter pre-set. Favoriting itself (star + table + write API + panel) is untouched. *(Confidence: HIGH — product-decided.)*

### D9 — **No breaking change to the core for existing users** (the hard constraint on D1)
Existing users on `/api/search`, the per-kind searches, and the current UI must migrate **without stress**. So the rework is **internal** (the unified index, the cross-kind query) while the **public surface stays compatible**: `/api/search` keeps its shape (additively extended, or transparently served from the unified index filtered to DE); the polymorphic search is a **new additive path** (e.g. `/api/search/assets`); the per-kind search endpoints keep working until the UI fully converges; clients regenerate additively. Any unavoidable break gets a **deprecation window**, never a silent change. *(Confidence: HIGH — this is the maintainer's hard line.)*

## Cross-cutting — held to the 1.0.0 bar on every slice
- **Performance (principle 2) — a release gate.** Per query: one ranked index scan (D1) + a page-sized live semi-join (D2, never a full scan); the **Popular histogram** bucketed + cached (D5); the **My-data** lineage expansion depth-capped + size-guarded (D4); facet counts incremental, not full-recompute per keystroke; index maintenance kept off the request path (write-time/async). We measure search latency from P1 and gate on it.
- **UI/UX (principle 1) — perfection.** One result row that reads cleanly across kinds, the why-it-matched highlight (D6), configurable columns (D7), and a filter sidebar (D3) that composes without clutter; the home panels deep-link in (D8) — one place to search, many ways in. Pixel review every slice.

## Phasing — a roadmap of issues under #1825 (NOT one task; the path to 1.0.0)
Each phase is decomposed into its own issue(s)/slice(s) under #1825; the milestone split is the maintainer's call (§ open decisions).
- **P1 — the unified search core:** the `asset_search_entrypoint` index + its incremental maintenance + the polymorphic ranked query (D1) + the `Asset` result via live semi-join (D2) + the **Asset-type** filter (D3) + the cross-kind result row + retire the class tabs. *(Backward-compat: `/api/search` + per-kind searches keep working — D9. Latency baseline established here.)*
- **P2 — the scope filters:** **Favorites** + **My data** (per-direction depth, D4) + **Popular** (D5) + **Recently-viewed** (on #1816's data) + retire the My-Objects + `/favorites` tabs + rewire the home "See all" (D8). **← Favorites + Recently-viewed finish here.**
- **P3 — depth of capability:** highlight parity across kinds (D6) + the result-column constructor (D7).
- **P4 — convergence + power features:** converge the per-kind searches onto the unified index + deprecate the duplicate paths (D9); server-side saved views (D7); My/Global-Popular (D5); deeper lineage defaults if wanted (D4).

## Consequences
- **Positive:** one fast search engine + one result renderer; favorites/recently/class/my-objects collapse into filters; true cross-kind relevance + correct pagination; reuses the favorites foundation, the lineage API, the my-objects hook, and `view_count`; positions search as a best-in-class governance-navigation surface.
- **Cost / watch:** the unified-index **backfill + incremental maintenance** is the deliberate, bounded rework (measured for latency from P1); the live Popular histogram + the My-data lineage intersection are the per-query costs to bound; highlight parity is staged (D6).
- **Backward-compat:** the public contract + per-kind searches stay during convergence (D9); no stressful migration for existing endpoint/UI users.
- **Auth:** Favorites + My-data degrade to empty/shared under `auth.type=DISABLED`.

## References
- `prds/0003-unified-asset-search.md` · #1825 · `state/roadmap-unified-search.md` · `adrs/drafts/favorites-recently-viewed-foundation.md` (the reused Asset model + identity + semi-join).
- Search internals (verified 2026-06-29): `service/search/SearchServiceImpl.java:75,85,99,128`; `repository/reactive/Reactive{Search,TermSearch,QueryExampleSearch,LookupTableSearch}EntrypointRepository*`; `dto/FacetType.java`; `repository/reactive/ReactiveLineageRepository.java` (depth-bounded: `getLineageRelations(…, LineageDepth)` / `getLineageRelationsForDepthOne`); `ReactiveDataEntityRepositoryImpl.java:633` (`view_count`); `Search/Results/Results.styles.ts` (`AddColNames`); `Search/Results/ResultItem/SearchHighlights` (`DataEntitySearchHighlight`, DE-only).
