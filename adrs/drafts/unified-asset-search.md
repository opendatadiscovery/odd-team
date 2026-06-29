# ADR (draft) — Unified Asset Search

| | |
|---|---|
| **Status** | **Proposed (draft)** — design for issue [#1825](https://github.com/opendatadiscovery/odd-platform/issues/1825). No code until approved (G-C7 + G-C3). |
| **Date** | 2026-06-29 |
| **Repo** | `opendatadiscovery/odd-platform` |
| **Design source** | `prds/0003-unified-asset-search.md` (PRD-0003) — product rationale + the 6 requirements. This ADR fixes the *architectural* decisions PRD-0003 §5/§10 left open. |
| **Drives** | #1825 (the overhaul). **Supersedes** the bespoke Favorites tab (#1815 Group B) + the Recently-Viewed tab (#1816) — both become filters here. **Reuses** the merged Favorites foundation (`adrs/drafts/favorites-recently-viewed-foundation.md`). |
| **Why an ADR (G-C7)** | A **new public search contract** (a polymorphic result + new filters), a **cross-cutting query model** (federated cross-kind search), and the **retirement of shipped public surfaces** (the `/favorites` tab, the search class/My-Objects tabs). Irreversible-blast-radius → approved before code. |

## Context — the search subsystem is data-entity-native end-to-end *(verified 2026-06-29, `da2932e1`)*

- `/api/search` is a **stateful session**: `search(SearchFormData)` → a `searchId` + facet state; `updateFacets(searchId, …)` mutates it; `getSearchResults(searchId)` → **`DataEntityList`** (`service/search/SearchServiceImpl.java:75,85,99`). Facet counts are computed in `getFacetsData` — including an **`myObjectsCount` from `authIdentityProvider.fetchAssociatedOwner()`** (`:128`), so **"My Objects" is already a search-side concept**.
- The DE index is one `search_entrypoint` tsvector (`ReactiveSearchEntrypointRepository`). **Terms, Query Examples, and Lookup Tables each already have their own FTS entrypoint + service** (`ReactiveTermSearchEntrypointRepository`, `ReactiveQueryExampleSearchEntrypointRepository`, `ReactiveLookupTableSearchEntrypointRepository`) and dedicated surfaces (the Dictionary, Data Modelling).
- Facets are **9 categorical DE dimensions** (`dto/FacetType.java`). Highlights are **`DataEntitySearchHighlight` — DE-only** (a grep for `Highlight` over the term/query code is **empty** — terms/QE have no highlight infrastructure). "Popular" is a **global `view_count DESC`** list (`ReactiveDataEntityRepositoryImpl.java:633`).
- Lineage is an **edge table** (`LINEAGE`), traversed **depth-bounded**: `getLineageRelations(roots, LineageDepth, …)` (N-hop) and `getLineageRelationsForDepthOne(rootIds, …)` (1-hop) — `repository/reactive/ReactiveLineageRepository.java`.
- The merged **Favorites foundation** gives a polymorphic `(asset_kind, asset_id)` **`Asset`** model + `CurrentUserIdentityResolver` (per-user; shared sentinel under `auth.type=DISABLED`) + the **resolve-live-by-semi-join** pattern (favorites ADR D3) — all reused here.

PRD-0003 consolidates the overlapping list surfaces (Search, Favorites tab, Recently-Viewed, class/My-Objects tabs, catalog-overview blocks) into one faceted cross-kind **Asset** search. This ADR fixes *how*.

## Decision

### D1 — A **federated aggregator** over the existing per-kind search entrypoints — NOT a new unified index
The new search path fans the query + filters to **each kind's existing FTS entrypoint** (DE / Term / QE / Lookup), merges the per-kind ranked results, and assembles a polymorphic page.
- **Why:** the four tsvector indexes + per-kind ranking already exist; a federated layer reuses them with **zero migration** and **zero re-indexing risk**, and is **kind-extensible** (a future kind = one more fan-out branch).
- **Rejected — a single `asset_search_entrypoint` tsvector:** true single-index ranking, but a destructive migration + a re-indexing pipeline + reconciling/deprecating the four existing entrypoints — a large blast radius for a ranking-quality gain catalog search does not need. Revisit only if cross-kind ranking proves inadequate in practice.
- **Trade-off (accepted):** cross-kind ranking is **approximate** (merging four ranked lists). Mitigation: present **kind-grouped** (sections per kind) or score-interleaved via a per-kind `ts_rank` normalised across kinds; default to kind-grouped. *(Confidence: HIGH.)*

### D2 — The result is the polymorphic **`Asset`** union, resolved **live by semi-join** (reuse the Favorites model)
A result page is `Asset[]` where each item is `(asset_kind, one-of {DataEntityRef | TermRef | QueryExampleRef | …})` — the **same discriminated union** the Favorites list already returns (`FavoriteAsset`; favorites ADR D2). Titles/refs resolve **live** by semi-joining the page's `(asset_kind, asset_id)` back onto each kind's existing list query, inheriting each kind's visibility predicate (favorites ADR D3) — no denormalised search row to drift, and the `FavoriteAssetResolver` is the template. *(Confidence: HIGH — the proven favorites pattern.)*

### D3 — Filters are facets on the **existing search session** model, extended cross-kind
Extend `SearchFormData` + the facet state with the PRD-0003 filters, each backed by an existing mechanism — keeping **one** search model, not a second engine:

| Filter | Backing mechanism |
|---|---|
| **Asset type** (+ DE class refinement) | the `asset_kind` fan-out (D1) + the existing `ENTITY_CLASSES` facet for the DE split |
| **Favorites** (All / Yes / No) | a join / anti-join to the `favorite` table via `CurrentUserIdentityResolver` (merged) |
| **My data** (All / My-Objects / Up / Down) | `fetchAssociatedOwner()` (the existing hook, `SearchServiceImpl:128`) + the lineage repo (D4) |
| **Popular** (numeric range) | the existing `view_count` (D5) |
| **Recently viewed** (datetime) | `#1816`'s `recently_viewed` (built in parallel) |

*(Confidence: HIGH.)*

### D4 — "My data" upstream/downstream is **lineage-depth-bounded; ship 1-hop first**
"My Objects" = `fetchAssociatedOwner()`'s owned set. "Upstream / Downstream dependents" = the lineage neighbours of that set, via `getLineageRelationsForDepthOne(ownedIds, …)` (**1-hop — cheap, predictable**), extensible to N-hop via `getLineageRelations(roots, LineageDepth)`. Intersected with the search result set.
- **Why 1-hop first:** bounded, predictable cost; transitive closure can explode on dense graphs. The lineage API already supports both depths, so deepening later is additive.
- **Auth:** no owner identity under `auth.type=DISABLED` → "My data" is empty there (labelled), consistent with Favorites. *(Confidence: MEDIUM-HIGH — depth is a tunable, not a rebuild.)*

### D5 — **Popular** is a **numeric-range facet** over the existing `view_count` — the first non-categorical facet
The Popular filter ranges over the existing global `view_count` (`ReactiveDataEntityRepositoryImpl:633`), used **as-is**. Every facet today is **categorical**; Popular is the first **numeric-range facet** — a reusable widget (later: row/column counts, freshness). The **histogram** is a distribution aggregate (`width_bucket` over the *currently-filtered* set) — a **SHOULD** (the slider ships first; the live distribution is the cost to bound). **DE-scoped** (the metric is DE-only); **My/Global-Popular is out of scope** (a separate later split — recency ≠ frequency, and frequency is its own track). *(Confidence: HIGH.)*

### D6 — Highlights: reuse `DataEntitySearchHighlight` for DE; **term/QE ship without highlights initially** (parity = a tracked follow-up)
Data entities keep their rich "why it matched" highlights (`DataEntitySearchHighlight`). Terms/QE have **no highlight infrastructure today**, so cross-kind highlight parity is a **defined follow-up** (a per-kind highlight model), not a launch blocker. The result row degrades gracefully — no highlight badge for a kind that lacks one. *(Confidence: MEDIUM — honest scope; flagged in PRD-0003 R4.)*

### D7 — Result columns are user-configurable; **persist client-side first**, server-side later
The "field constructor" lets a user choose result columns from a **kind/type-aware field catalog** (the shared fields + kind-specific ones — a Quality Test's Suite URL etc. already exist in `Search/Results/Results.styles.ts` `AddColNames`). A chosen field renders only for the kinds that carry it (degrade per-kind). Persist the set **client-side** first (the platform already persists UI state client-side); **server-side per-user config is a later enhancement**, not a launch dependency. *(Confidence: MEDIUM.)*

### D8 — Retire the tabs; home blocks become deep-link widgets
Per PRD-0003 R3/R5: remove the `/search` **class tabs** + the **My-Objects tab** (→ the Asset-type + My-data filters) and the standalone **`/favorites` tab** (→ the Favorites filter). The catalog-overview **panels stay as widgets** whose "See all" opens `/search` with the matching filter pre-set. The favoriting capability itself (the star, the `favorite` table + write API, the panel) is untouched. *(Confidence: HIGH — product-decided in PRD-0003.)*

### D9 — A **version-safe** contract: additive, don't break the DE-only `/api/search`
The existing `/api/search` → `DataEntityList` has consumers (the SDK, integrations). Introduce the polymorphic search **additively** — a new path (e.g. `/api/search/assets`) or an explicitly-versioned extension returning the `Asset` union — rather than mutating the existing result shape. Regenerate Java + TS clients. *(Confidence: MEDIUM-HIGH — the exact mechanism is a P1 detail; the principle is don't silently break.)*

## Phasing (mirrors PRD-0003 §8)
- **P1** — D1 + D2 + D3(asset-type) + the cross-kind result row + retire the class tabs. *(the federated core)*
- **P2** — D3 scope filters (Favorites · My-data [D4] · Popular [D5] · Recently-viewed) + retire the My-Objects + `/favorites` tabs + the home "See all" rewire (D8). **← Favorites + Recently-viewed finish here.**
- **P3** — D6 highlight parity + D7 the column constructor.
- **P4** *(optional, later)* — deepen My-data to N-hop (D4); My/Global-Popular (D5).

## Consequences
- **Positive:** one search model + one result renderer; favorites / recently / class / my-objects collapse into filters; cross-kind discovery; reuses 4 indexes + the merged favorites foundation + the lineage API + the my-objects hook; **no migration**.
- **Negative / watch:** approximate cross-kind ranking (D1); the live Popular histogram cost (D5); staged highlight parity (D6); the My-data lineage × search intersection is the heaviest query (D4) — bound the depth.
- **Auth:** Favorites + My-data degrade to empty/shared under `auth.type=DISABLED` (consistent with the favorites foundation).
- **Migration risk:** none at the DB layer (federated, D1); the only contract risk is the public `/api/search` shape — addressed additively (D9).

## References
- `prds/0003-unified-asset-search.md` (PRD-0003) · issue #1825 · `state/roadmap-unified-search.md`.
- `adrs/drafts/favorites-recently-viewed-foundation.md` — the reused `Asset` model + identity resolver + resolve-live-by-semi-join.
- Search internals (verified 2026-06-29): `service/search/SearchServiceImpl.java:75,85,99,128`; `repository/reactive/Reactive{Search,TermSearch,QueryExampleSearch,LookupTableSearch}EntrypointRepository*`; `dto/FacetType.java`; `repository/reactive/ReactiveLineageRepository.java` (depth-bounded); `ReactiveDataEntityRepositoryImpl.java:633` (Popular = `view_count`); `odd-platform-ui/src/components/Search/Results/Results.styles.ts` (`AddColNames`); `…/Search/Results/ResultItem/SearchHighlights` (`DataEntitySearchHighlight`, DE-only).
