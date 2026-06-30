# ADR (draft) — Unified Asset Search

| | |
|---|---|
| **Status** | **Agreed direction (draft, rev 3)** — approved by the maintainer 2026-06-29 (rev 2) as the plan to proceed; **rev 3 (2026-06-30)** adds the parametrised-URL + saved-search architecture, security as a first-class principle, the sort model (closing **[#1705](https://github.com/opendatadiscovery/odd-platform/issues/1705)**), and an early **Saved-Search (P0)** slice. Each slice is still refined + GATE-1-approved before code (G-C7 + G-C3). Design for issue [#1825](https://github.com/opendatadiscovery/odd-platform/issues/1825). |
| **Date** | 2026-06-29 (rev 2). **2026-06-30 (rev 3)** — maintainer steer: Search must be a *first-class* search "from performance, capabilities, **security** points of view among data governance tools and in the future"; **Saved Search** filters (named, editable, deletable, **shared as a parametrised URL, not a mutable session**) implemented now; close **#1705** within the epic. Research: `research/unified-asset-search/SAVED-SEARCH-URL-SECURITY.md`. |
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
4. **Security is first-class (maintainer steer 2026-06-30).** Search is also a *governance* surface — every capability is judged on its security posture, not only speed and polish. The headline rule (D10/D11 + the Security cross-cutting): a shared or saved search is a **query spec run *as the requester*** — results re-evaluate under the *recipient's* permissions on every run, never the sharer's; the URL/spec carries **no secrets**; the user-authored, shareable query path must be **injection-safe and fail closed**. Security is a release gate alongside performance.

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
The Popular filter ranges over the existing global `view_count` (`ReactiveDataEntityRepositoryImpl:633`). **rev-3 SRE correction (`SEARCH-CAPABILITIES-DESIGN.md` §2):** denormalise a **snapshotted / bucketed `popularity_score`** onto the index (refreshed on a cadence), **NOT the live `view_count`** — the live counter is a known write-contention hotspot (`concepts.yaml:564`); denormalising it onto the index would couple index writes to read volume (every page-view dirties an index row). Approximate popularity ordering is fine for browse, and the range filter + histogram stay index-fast. It is the first **numeric-range facet** (a reusable widget — later row/column counts, freshness). The **histogram** is a bucketed aggregate (`width_bucket`) over the *filtered* set — a **SHOULD**, cached/bounded (principle 2). **DE-scoped**; **My/Global-Popular is a separate later track** (recency ≠ frequency; frequency is its own work). *(Confidence: HIGH.)*

### D6 — Highlights: rich for DE now; term/QE parity is a tracked follow-up
DE keeps `DataEntitySearchHighlight`. Terms/QE have **no highlight infra today** → cross-kind highlight parity (a per-kind highlight model) is a **defined follow-up**, not a launch blocker; the row degrades (no badge for a kind without one). The "why it matched" badge is part of the **UX-perfection** target (principle 1), so parity is scheduled, not dropped. *(Confidence: MEDIUM.)*

### D7 — Result columns are user-configurable; **persist client-side first**, server-side later
A "field constructor" over a **kind/type-aware field catalog** (shared fields + kind-specific — Quality Test Suite URL etc. already in `Results.styles` `AddColNames`); a chosen field renders only for kinds that carry it. Persist **client-side first** (the platform already persists UI state client-side); **server-side per-user saved views** are a later enhancement. *(Confidence: MEDIUM.)*

### D8 — Retire the tabs; home blocks become deep-link widgets
Per PRD-0003 R3/R5: remove the `/search` class tabs + My-Objects tab (→ Asset-type + My-data filters) and the `/favorites` tab (→ the Favorites filter). The catalog-overview **panels stay** as widgets whose "See all" opens `/search` with the filter pre-set. Favoriting itself (star + table + write API + panel) is untouched. *(Confidence: HIGH — product-decided.)*

### D9 — **No breaking change to the core for existing users** (the hard constraint on D1)
Existing users on `/api/search`, the per-kind searches, and the current UI must migrate **without stress**. So the rework is **internal** (the unified index, the cross-kind query) while the **public surface stays compatible**: `/api/search` keeps its shape (additively extended, or transparently served from the unified index filtered to DE); the polymorphic search is a **new additive path** (e.g. `/api/search/assets`); the per-kind search endpoints keep working until the UI fully converges; clients regenerate additively. Any unavoidable break gets a **deprecation window**, never a silent change. *(Confidence: HIGH — this is the maintainer's hard line.)*

### D10 — Search state lives in the **URL as parametrised query params**, not in the mutable session *(rev 3)*
The canonical "what to search" (query + filters + sort + page) **serialises to/from URL query params** — the Algolia `stateToRoute`/`routeToState` two-way pattern (`research/unified-asset-search/SAVED-SEARCH-URL-SECURITY.md` Thread 1). A search becomes **stateless, bookmarkable, shareable, and back/forward-correct**; the server `search_facets` session (if kept to back FTS execution) becomes an **internal detail derivable from the params** — never the shared/saved handle.
- **Why (maintainer steer — "a parametrised url, not a mutable session"):** a shared `/search/{sessionId}` shares a session that **mutates and expires** — the `IT-125`/`#1760` "search session expired" dead-link class is a *direct* symptom. A param URL never expires, bookmarks cleanly, and re-runs deterministically; it is also the storage shape for saved searches (D11).
- **How:** the FE owns the state and writes it to the URL **debounced (~400 ms)**, encoding only *modified* values with clean/renamed params; on load it parses the URL → runs the search. Additive (D9): `/api/search` keeps working, now derivable from the params. *(Confidence: HIGH.)*

### D11 — **Saved searches**: named, per-user, CRUD, **shared as a parametrised URL** *(rev 3 — the now-ask)*
A `saved_search(id, name, owner_identity, spec jsonb, created_at, updated_at)` row holds **the same param spec D10 encodes** — one canonical spec, two surfaces (URL + saved row) — reusing the merged **Favorites `Asset`/identity foundation** (`CurrentUserIdentityResolver`; per-user, shared sentinel under `auth.type=DISABLED`, labelled). A user **saves the current search** (filters + ordering) under a name, then **selects / edits / deletes** it; **sharing is the URL** (D10) — no server-side grant. Mirrors **DataHub Views** (a first-class "save a set of filters" entity).
- **Security (first-class):** a saved search is **private to its owner**; the share link is a **query spec run as the recipient** — results re-evaluate under the recipient's visibility (D2 live semi-join + the Security cross-cutting), so a link can never surface an unauthorized row. The `spec` carries **only** non-sensitive catalog metadata + sort. **Team/org-published** saved searches (RBAC + audience on the entity) are a **separate later slice** (P4).
- **Reuse:** `saved_search` is the same per-identity-row pattern as the `favorite` table (PRD-0001 foundation) — `CurrentUserIdentityResolver` + a reactive repository; no new identity machinery. *(Confidence: HIGH.)*

### D12 — **Sorting is a property of a *typed column*** — the `sort` contract now, the per-column-type matrix with the constructor *(rev 3, SRE-designed — `SEARCH-CAPABILITIES-DESIGN.md`)*
Sorting is not a bolt-on `sort` string: the **column field-catalog (D7) carries each field's `data_type`**, and a **type → sort-options registry** derives the menu. This splits the work cleanly (and resolves "sort ships with/after the column constructor"):
- **Now (ST-2, P0):** the **server-side `sort` contract** (`[{field, direction, nulls}]` + the named semantic orderings `relevance` / `status-priority`) + the **default-order model** + a **global dropdown** of the ~5 canonical sorts. **[#1705](https://github.com/opendatadiscovery/odd-platform/issues/1705) closes here** (server-side, as that 2024 thread concluded).
- **With the constructor (ST-7, P3):** the **per-column ▾ type-derived sort menu** — the rich matrix, which can only exist once columns are user-configurable.

Per-type (full detail in the design doc):
- **Status (semantic categorical) — named orderings, never asc/desc:** **Maturity (stable-first = #1705)** [default browse] + **Needs-attention (unassigned-first)** [steward hygiene]; index-backed by a **denormalised `status_priority smallint`** (not a `CASE` sort at scale).
- **Datetime (nullable):** the 4-way `{asc,desc}×{nulls first,last}` matrix, **default DESC NULLS LAST**; UX exposes "Newest/Oldest" + one advanced "show unknown first" toggle — never the raw matrix.
- **Alphanumeric:** A→Z **case-insensitive ICU locale** (not `C` byte order); nullable namespace/owner → nulls-last; **owner is multi-valued → the sort key needs a decision (min vs primary).**
- **Numeric:** DESC default; ASC = "find dead assets"; a kind-specific column sort segregates a mixed result by kind.
- **No multi-key builder** (no governance tool has one); always append the **unique `id` tiebreaker**; one fixed composite `status-priority → {popularity|name|updated}`.
- **Default browse fork (a maintainer decision at ST-2's GATE 1):** trust-first (#1705) vs market usage-first; **recommended hybrid `status_priority → popularity_score DESC`.**
- **SRE:** NULLS-aligned btree indexes (the `DESC NULLS LAST` default is not free; its index also serves the steward `ASC NULLS FIRST` by backward scan); **keyset pagination + the `id` tiebreaker** for stored-column sorts, **OFFSET + a depth-cap** for relevance (`ts_rank` is not seekable); a global depth cap on arbitrary sorts. *(Confidence: HIGH.)*

### D13 — Close the query-operator + facet-logic gaps (DataHub-grade) *(rev 3)*
First-class among governance tools needs more than today's AND-only plain FTS (`SEARCH-CAPABILITIES-DESIGN.md` §3-4, §6):
- **Query operators:** adopt Postgres **`websearch_to_tsquery`** — Google-style operators (quoted phrase, `-` negation, `or`) that are **injection-safe by construction** (never raises on metacharacters), serving operator-parity **and** the IT-003/PLT-090 fail-closed mandate in one move. *(MEDIUM — verify the operator surface + the IT-003 interaction in implementation.)*
- **Facet logic:** **AND/OR within a facet + negation** (DataHub's "match any" / "should not match") — the clearest filtering gap to close, layered onto the cross-kind facets (D3). *(Confidence: HIGH for the direction.)*

## Cross-cutting — held to the 1.0.0 bar on every slice
- **Performance (principle 2) — a release gate.** Per query: one ranked index scan (D1) + a page-sized live semi-join (D2, never a full scan); the **Popular histogram** bucketed + cached (D5); the **My-data** lineage expansion depth-capped + size-guarded (D4); facet counts incremental, not full-recompute per keystroke; index maintenance kept off the request path (write-time/async). We measure search latency from P1 and gate on it.
- **UI/UX (principle 1) — perfection.** One result row that reads cleanly across kinds, the why-it-matched highlight (D6), configurable columns (D7), and a filter sidebar (D3) that composes without clutter; the home panels deep-link in (D8) — one place to search, many ways in. Pixel review every slice.
- **Security (principle 4) — a release gate.** A shared/saved search re-evaluates results under the **requester's** permissions (D11 + the query-time-RBAC prior art); the URL/spec carries **no secrets** (only catalog-metadata filters + sort — URLs leak via history / server logs / `Referer`); the **shareable, user-authored param path reuses the escaped FTS query** (the `IT-003`/`PLT-090` tsquery-poisoning guard) and **fails closed** (a malformed spec → empty, never a 500). Favorites/My-data degrade to empty/shared under `auth.type=DISABLED`, labelled.

## Phasing — a roadmap of issues under #1825 (NOT one task; the path to 1.0.0)
Each phase is decomposed into its own issue(s)/slice(s) under #1825 (the concrete subtask list lives in `state/search-overhaul-decomposition.md`); the milestone split is the maintainer's call (§ open decisions).
- **P0 — Saved & shareable search (the maintainer's now-ask; built on the *current* search, forward-compatible):** the **parametrised-URL state foundation** (D10) + **saved searches** (D11 — `saved_search` CRUD + select/edit/delete + copy-share-link) + the **security model** (recipient-scoped re-eval, no-secrets-in-URL, tsquery-safe + fail-closed). DE-scoped now; the spec extends **additively** when P1 lands. *(Lands early; fixes the `IT-125` session-expiry dead-link class as a bonus.)*
- **P1 — the unified search core:** the `asset_search_entrypoint` index + its incremental maintenance + the polymorphic ranked query (D1) + the `Asset` result via live semi-join (D2) + the **Asset-type** filter (D3) + the cross-kind result row + retire the class tabs + **#1705 status-priority default sort (D12)**. *(Backward-compat: `/api/search` + per-kind searches keep working — D9. Latency baseline established here.)*
- **P2 — the scope filters:** **Favorites** + **My data** (per-direction depth, D4) + **Popular** (D5) + **Recently-viewed** (on #1816's data) + retire the My-Objects + `/favorites` tabs + rewire the home "See all" (D8). **← Favorites + Recently-viewed finish here.**
- **P3 — depth of capability:** highlight parity across kinds (D6) + the result-column constructor (D7).
- **P4 — convergence + power features:** converge the per-kind searches onto the unified index + deprecate the duplicate paths (D9); **team/org-published saved searches** (RBAC + audience on `saved_search`); server-side column views (D7); My/Global-Popular (D5); deeper lineage defaults if wanted (D4).

## Consequences
- **Positive:** one fast search engine + one result renderer; favorites/recently/class/my-objects collapse into filters; true cross-kind relevance + correct pagination; reuses the favorites foundation, the lineage API, the my-objects hook, and `view_count`; positions search as a best-in-class governance-navigation surface.
- **Cost / watch:** the unified-index **backfill + incremental maintenance** is the deliberate, bounded rework (measured for latency from P1); the live Popular histogram + the My-data lineage intersection are the per-query costs to bound; highlight parity is staged (D6).
- **Backward-compat:** the public contract + per-kind searches stay during convergence (D9); no stressful migration for existing endpoint/UI users.
- **Auth:** Favorites + My-data degrade to empty/shared under `auth.type=DISABLED`.

## References
- `prds/0003-unified-asset-search.md` · #1825 · `state/roadmap-unified-search.md` · `adrs/drafts/favorites-recently-viewed-foundation.md` (the reused Asset model + identity + semi-join).
- **rev 3 (2026-06-30):** `research/unified-asset-search/SAVED-SEARCH-URL-SECURITY.md` (param-URL + saved-search + security) · **`research/unified-asset-search/SEARCH-CAPABILITIES-DESIGN.md`** (the comprehensive sorting/filtering/columns/pagination design) · **`lineage/odd-platform/sme-consultations/2026-06-30-first-class-search-sorting-design.md`** (the SRE/PO consult — DataHub/Atlan/Amundsen/Select Star/Secoda + Postgres + keyset, cited) · the decomposition `state/search-overhaul-decomposition.md` · [#1705](https://github.com/opendatadiscovery/odd-platform/issues/1705) (status-priority, folded into D12) · `IT-125` (the session-expiry class D10 retires) · `IT-003` (the FTS-injection guard the shareable path reuses).
- Search internals (verified 2026-06-29): `service/search/SearchServiceImpl.java:75,85,99,128`; `repository/reactive/Reactive{Search,TermSearch,QueryExampleSearch,LookupTableSearch}EntrypointRepository*`; `dto/FacetType.java`; `repository/reactive/ReactiveLineageRepository.java` (depth-bounded: `getLineageRelations(…, LineageDepth)` / `getLineageRelationsForDepthOne`); `ReactiveDataEntityRepositoryImpl.java:633` (`view_count`); `Search/Results/Results.styles.ts` (`AddColNames`); `Search/Results/ResultItem/SearchHighlights` (`DataEntitySearchHighlight`, DE-only).
