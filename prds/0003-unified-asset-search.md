# PRD-0003 — Unified Asset Search (main Search overhaul)

| | |
|---|---|
| **Status** | **Logged as [#1825](https://github.com/opendatadiscovery/odd-platform/issues/1825)** (2026-06-29, milestone 1.0.0) — to be decomposed into slices. This PRD is its requirements + design rationale. Pivot announced on the sibling issues: [#1815 comment](https://github.com/opendatadiscovery/odd-platform/issues/1815#issuecomment-4832457367), [#1816 comment](https://github.com/opendatadiscovery/odd-platform/issues/1816#issuecomment-4832457502). |
| **Target** | odd-platform — **milestone TBD by the maintainer** (release planning is maintainer authority; see §9 — this likely lands on its own *before* the Favorites completion). |
| **Blocks** | **PRD-0002 Group B / #1815 (Favorites completion).** This overhaul **supersedes** the bespoke Favorites tab, its facets, and its planned full-text search — Favorites is *finished* by becoming a **filter** on this search, not by building a parallel surface. The Favorites Group-B work is paused until this lands (nothing is pushed). |
| **Relates** | **PLT-250 (Recently Viewed)** — becomes a datetime filter on this search, not a tab. **PRD-0001/0002** — the `favorite` table + the star + the write API are reused as a search filter (not retired). |
| **Author** | ODD Team (maintainer ideation, 2026-06-29). |
| **Why this exists** | ODD has accreted **overlapping list surfaces** — the main `/search`, the Favorites tab, the (planned) Recently-Viewed tab, the `/search` class-tabs, the My-Objects tab, and the catalog-overview blocks — that **duplicate and drift**. The main search is **data-entity-only** while the catalog's assets are **cross-kind** (data entities, terms, query examples). Favorites Group B was about to add a *second* search engine (full-text over favorites) + a bespoke facet set. The realization: **Favorites, Recently-Viewed, the class-tabs, and My-Objects are not surfaces — they are filters on one search.** This PRD overhauls the main search into a single, faceted, cross-kind **Asset** search and makes the rest views of it. |

---

## 1. Frame — one search, not many list surfaces

Today a user navigates a thicket of near-identical list surfaces, each a list of assets with a scope + filters:

- **`/search`** — faceted, highlighted results, but **data-entity-only** (terms + query examples have their own separate searches).
- **The Favorites tab** (`/favorites`, shipped S3/S4/S4b) — a cross-kind list with its own thinner facet + table; Group B was about to add four more facets + full-text search = **a second search engine**.
- **The class tabs** on `/search` (Datasets, Transformers, Quality Tests, …) and a **My Objects** tab.
- **The catalog-overview blocks** (My Objects / Upstream / Downstream / Favorites / Popular) — pre-baked owner/lineage/favorite lists.
- **Recently Viewed** (PLT-250) — would have been a *third* tab of the same shape.

They overlap, drift, and are each maintained separately. **The pivot: collapse them into one faceted, cross-kind Asset search**, where favorited-ness, recency, ownership/lineage, and asset-kind are **filters**; the home blocks are **widgets that deep-link into the filtered search**; and there is **one** result renderer (with highlights) to maintain.

## 2. Current architecture (the ground truth this overhaul moves) — *verified in-tree 2026-06-29*

- **Per-kind search, four separate indexes.** The main search is a stateful session (`POST /api/search` → `…/{id}/results` → **`DataEntityList`** + `…/{id}/facet/{facet_type}`), backed by `ReactiveSearchEntrypointRepository` (a `search_entrypoint` tsvector keyed on `data_entity_id`). Terms, Query Examples, and Lookup Tables each already have **their own** FTS entrypoint + service (`ReactiveTermSearchEntrypointRepository`, `ReactiveQueryExampleSearchEntrypointRepository`, …) and **dedicated** surfaces (the Dictionary, Data Modelling).
- **Nine DE-specific facets** (`FacetType`: ENTITY_CLASSES, TYPES, NAMESPACES, DATA_SOURCES, OWNERS, TAGS, GROUPS, STATUSES, DATA_ENTITY).
- **DE-shaped result + highlights.** Results are `DataEntity`; the "why it matched" model is `DataEntitySearchHighlight` (dataset columns, owners, metadata, tags, namespace, datasource).
- **The result table already carries class-specific extra columns** (`Results.styles` `AddColNames`: Suite URL, Rows/Columns, Sources/Targets, …) — the seed for the configurable-columns feature (R4).
- **Favorites** (PRD-0001): a `favorite` table keyed on `(identity, asset_kind, asset_id)` + a star/unstar write API + a cross-kind list endpoint + `CurrentUserIdentityResolver` (shared bucket under `auth.type=DISABLED`).

**Implication:** the raw "search each kind" capability already exists (four tsvector indexes). What's missing is a **unifying layer** (a polymorphic query + result + facets) and the **filter model** below. This is a **search-subsystem** change, not a favorites tweak — it warrants its own **ADR**.

## 3. Goals / Non-goals

**Goals** — one faceted search over **all** asset kinds (+ future kinds); Favorites / Recently-Viewed / ownership-lineage / asset-kind as **filters**, not surfaces; reuse the result row + **highlights** across kinds; a user-configurable **result-column set**; the catalog-overview blocks survive as **deep-link widgets**.

**Non-goals** — a new relevance/ranking model (reuse per-kind ranking; cross-kind merge is acceptable, §7); removing the **favoriting capability** (only the favorites *tab* is retired — the star, the `favorite` table, the write API stay); removing the home page (it stays; its blocks become widgets).

## 4. Requirements

### R1 (MUST) — Polymorphic search over all asset kinds
`/search` returns a **mixed-kind result** (`DataEntity | Term | QueryExample | …`) — the same discriminated-union shape Favorites already uses. A query matches across every kind's searchable text (names, descriptions, definitions, attributes). Extensible: a future asset kind plugs in without a new surface.
- *AC:* one query surfaces matching data entities, terms, and query examples in a single ranked result; each row routes to its kind's detail page.

### R2 (MUST) — The filter sidebar
In addition to the shared facets that exist today (namespace, datasource, owner, tag, group, status):
- **Asset type** — `Term · Query Example · Data Entity`, where **Data Entity expands into its class categories** (Dataset, Transformer, Quality Test, …). The class split reuses the existing `ENTITY_CLASSES`/`TYPES` facet.
- **Favorites** — `All · Yes · No` (single-select). Yes = in my favorites; No = not in my favorites (anti-join). Per-user; **instance-wide shared under `auth.type=DISABLED`** (label it).
- **"My data"** *(name proposed; alts: "Relevance", "Ownership & lineage")* — multi-select: `All · My Objects · Upstream dependents · Downstream dependents`. My Objects = entities I own; Upstream/Downstream = the lineage neighbours of my owned set.
- **Popular** — a **numeric range** filter on an asset's **`view_count`** (frequency — *how many* times it has been seen): a lower + upper bound presented as a **dual-handle slider**, and *(SHOULD)* over a **histogram of the value distribution** (the Booking/AirBnB price-range pattern, so the user sees where assets cluster before choosing the bounds). This introduces a **new facet *type*** — every facet today is categorical; Popular is the first **numeric-range facet** (a reusable pattern, later usable for row/column counts, staleness/freshness, …). **Source metric:** the **existing `view_count`** (already built — the "Popular" block) is used **as-is**; it is data-entity-scoped, so Popular is **DE-only** for now. A **separate, later** enhancement may split **My Popular** (the current user's view frequency) vs **Global Popular** (total) — *out of scope here*. **Popular has no dependency on #1816** (it is frequency, not recency).
- *(future, R2-f)* **Recently viewed** — a **last-viewed-timestamp** range filter: per-user **recency** (*when* an asset was last opened, **not** how often). Depends on the **#1816 view-tracking foundation** (the `recently_viewed` timestamps). **Distinct from Popular** (frequency / `view_count`) — an asset can be recently-viewed-by-me yet globally unpopular, or popular yet not recently viewed.
- *AC:* each filter narrows the cross-kind result; filters compose; "All"/empty = unfiltered; the Popular slider's range maps to a `seen_min`/`seen_max` filter on the popularity metric.

### R3 (MUST) — Retire the search-page tabs
The `/search` **class tabs** and the **My Objects tab** are removed — their function moves into the **Asset type** and **My data** filters (R2). `/search` becomes pure faceted search (sidebar + results), no tabs.

### R4 (MUST) — One result renderer: highlights + configurable columns
- **Highlights:** reuse the result row's **"why it matched"** highlighting across kinds (the `SearchHighlights` mechanism), so a row testifies *why* it appeared. *Honest scope:* data entities have rich highlights today; term/query-example highlight fields are thinner, so cross-kind **highlight parity** is a defined sub-task, not free.
- **Configurable columns (the "field constructor"):** the user chooses which fields the results table shows, from the full catalog of available attributes — the shared fields (name, type, namespace, owner, updated, description, tags) **plus** kind/type-specific fields (a Quality Test's **Suite URL**, a term's definition, a dataset's row/column counts, …). A chosen field renders only for the kinds that carry it (degrades per-kind). The set is **persisted per user**.
- *AC:* a user adds/removes result columns and the table reflects it; a kind-specific column shows for that kind and is blank for others.

### R5 (MUST) — Home blocks become deep-link widgets; the Favorites tab is retired
- The catalog-overview **Favorites** panel's **"See all" → `/search?favorites=yes`** (not a `/favorites` tab). Likewise **My Objects / Upstream / Downstream** → `/search` with **My data** pre-set, and **Popular** → its scoped search.
- The bespoke **`/favorites` tab is removed** (superseding S3/S4/S4b's tab + the in-progress Description column). The home panels stay as 5-item widgets.

## 5. Technical direction → **resolved in the ADR (rev 2): the unified index**

> **Resolution:** `adrs/drafts/unified-asset-search.md` (D1) re-weighed this for 1.0.0 — performance-first (search is the most-used feature) + core-engine rework permitted when benefit > migration drawback — and chose a **unified cross-kind index** (one ranked query; true cross-kind relevance; correct pagination), maintained alongside the per-kind ones for backward-compat (no breaking change to the core). The federated option below is the documented **rejected fallback**.

**Federated aggregator over the existing per-kind entrypoints** (vs a new unified index): a new search path fans the query + filters out to each kind's existing FTS entrypoint, merges + ranks into the polymorphic `Asset` result, and computes facets as the **shared** dimensions (kind-specific facets surface when that kind is in scope).
- *Why:* reuses all four existing indexes + per-kind ranking/highlights; **no migration**; the result is the `Asset` union Favorites already defines; kind-extensible.
- *Alternative (heavier):* one `asset_search_entrypoint` tsvector → true single-index ranking, at the cost of a migration + a re-indexing pipeline + reconciling the four existing entrypoints. **Decide in the ADR.**

## 6. Cross-cutting impact (Gate 0)
- **OpenAPI / contract:** a polymorphic search result (`Asset` union); new filter params (`asset_kinds`, `entity_class_ids`, `favorites`, the `my_data` scope, `seen_min`/`seen_max`, future `viewed_after`); a **numeric-range facet type** (the existing `FacetType` is categorical) + a **popularity-distribution endpoint** for the histogram; the result-column config. → **regenerate Java + TS clients.** A new public search contract → **ADR + careful versioning** (existing `/api/search` consumers).
- **Backend:** the aggregator + the favorites join (reuse `CurrentUserIdentityResolver`) + the **My-data lineage × ownership × FTS** intersection (the heavy part, §7); cross-kind facet computation.
- **Frontend:** `dataEntitySearch` slice → a polymorphic search slice; the sidebar filters; the result renderer (reuse the row + highlights); the **column-constructor** UI + persistence; remove the tabs; rewire the home "See all" links.
- **Persistence (R4 columns):** per-user column config — local-state (per browser) vs server-persisted (per user). **Decide.**
- **i18n** (all 7 locales): the new filter labels, the column-picker, empty/error copy.
- **Retired surfaces:** the `/favorites` tab + its components; the `/search` tabs; PRD-0002 Group B's bespoke favorites facets + FTS are **dropped, not built**.
- **Docs (release train):** the search page; the **"Asset"** umbrella term; the favorites docs shift from "a tab" to "a search filter".
- **Tests:** unit-cover the aggregator + each filter + the column resolution; an integration e2e for cross-kind search, the favorites/my-data filters, and the column constructor.
- **Ontology:** `/enrich --touched` over the search + favorites nodes once the surface is final.

## 7. SRE / risk flags
- **My-data filter cost (the heaviest part).** Upstream/Downstream = **lineage traversal from the owned set, intersected with the search** — define the **depth** (1-hop direct dependents [cheap, predictable] vs full transitive closure [powerful, can explode]); guard the query (closure size, timeouts).
- **Cross-kind ranking** is approximate (merging four ranked lists vs one index) — acceptable for catalog search; consider kind-grouped or score-interleaved presentation.
- **Popular-histogram distribution** must be computed over the *currently-filtered* result set so it stays meaningful as other filters narrow — a bucketed aggregate (`width_bucket`/range `GROUP BY`) that re-runs per query; cache/bound it so it doesn't dominate the search cost. The range filter (slider) is cheap; the live distribution is the part to watch.
- **Highlight parity** is uneven at first (DE-rich, term/QE-thin).
- **Auth degradation:** Favorites + My-data need a user identity → empty/shared under `auth.type=DISABLED`; label it, don't mislead.
- **Contract migration:** the existing DE-only `/api/search` has consumers — version/migrate, don't silently break.

## 8. Suggested phasing (slices, after the issue is filed)
1. **P1 — Polymorphic search core:** the federated aggregator + the `Asset` result + the **Asset type** filter (class split) + the cross-kind result row + retire the class tabs. *(The foundation.)*
2. **P2 — The scope filters:** **Favorites** (All/Yes/No) + **My data** + retire the My-Objects tab + the **`/favorites` tab** + rewire the home "See all" deep-links. *(The point Favorites is "finished" — §9.)*
3. **P3 — Highlight parity + the column constructor (R4).**
4. **P4 — Recently-viewed filter** (with PLT-250).

## 9. Sequencing — this blocks, then unblocks, Favorites
This overhaul **blocks the Favorites completion** (#1815 / PRD-0002 Group B): the favorites tab, its facets, and its full-text search are **superseded** by becoming a search filter. **After P2 lands, Favorites is effectively finished** — the star affordance already ships, and "find my favorites" becomes `/search?favorites=yes` + the home panel. The remaining Group-B work **dissolves into** this PRD rather than shipping separately. Net plan (maintainer's stated sequence): **finish this search overhaul, then close out Favorites as a thin follow-up** (verify the filter + panel, retire the tab, refresh docs).

## 10. Open decisions (flagged for the issue / ADR — not punted)
1. **Milestone** — 1.0.0 (with Favorites) makes 1.0.0 large; or a dedicated search milestone with the Favorites-finish trailing it. *(Maintainer / release-planning authority.)*
2. **Federated aggregator vs unified index** (§5) — recommend federated; confirm in the ADR.
3. **My-data lineage depth** — 1-hop vs transitive (§7).
4. **Column-config persistence** — local vs server (§6).
5. **The "My data" filter name** — "My data" (rec) / "Relevance" / "Ownership & lineage".
6. **Favorites "No" option** — keep the anti-join, or All/Yes only.

---

## GitHub issue — paste-ready (public language)

> **Title:** Overhaul the main Search into a unified, faceted Asset search (all asset kinds + filters)
>
> **Labels:** `kind: feature`, `scope: backend`, `scope: frontend`, `to decompose`
>
> ---
>
> ### What
> Turn the main **Search** page into a single faceted search over **all asset kinds** — Data Entities, Glossary Terms, Query Examples (and whatever assets we add later) — and make Favorites, Recently Viewed, ownership/lineage, and asset type **filters on that one search** instead of separate tabs and surfaces.
>
> ### Why
> Today there are several overlapping list surfaces that drift apart and are each maintained on their own: the data-entity-only `/search` (with its own class tabs and a "My Objects" tab), a separate **Favorites** tab, the catalog-overview **My Objects / Upstream / Downstream / Favorites / Popular** blocks, and dedicated searches for Terms and Query Examples — with Recently Viewed about to add yet another. They are all "a list of assets with a scope + filters." Consolidating them into one search removes the duplication, makes the whole catalog searchable in one place, and lets every list surface become a saved view of the same search.
>
> ### Requirements
> 1. **Search all asset kinds** in one place — a query matches across data entities, terms, and query examples (names, descriptions, definitions, attributes); each result routes to its own detail page; extensible to future kinds.
> 2. **Filters** (left sidebar), in addition to today's namespace / datasource / owner / tag / group / status:
>    - **Asset type** — Term · Query Example · Data Entity, where Data Entity expands into its classes (Dataset, Transformer, Quality Test, …).
>    - **Favorites** — All / Yes / No.
>    - **My data** — multi-select: All / My Objects / Upstream dependents / Downstream dependents.
>    - **Popular** — a range filter on how often an asset has been seen (a lower/upper bound on the view count), shown as a slider over a histogram of the distribution (like a price-range filter).
>    - *(later)* **Recently viewed** — a date/time-range filter.
> 3. **Remove the Search page tabs** (the class tabs and the My Objects tab) — their job moves into the filters above.
> 4. **One result table** with **search highlights** that show *why* each row matched (reuse the existing highlighting), and a **column constructor** — the user picks which fields the table shows, from every available attribute (shared fields plus kind-specific ones like a Quality Test's Suite URL); each chosen field shows for the kinds that have it.
> 5. **Home blocks become deep-link widgets** — the catalog-overview Favorites / My Objects / Upstream / Downstream / Popular panels stay as short widgets whose **"See all"** opens the main Search pre-filtered (e.g. Favorites' "See all" → Search with the Favorites filter set). The standalone **Favorites tab is retired** in favour of the Favorites filter.
>
> ### Notes
> - Favoriting itself (the star on any asset) stays — only the favorites *tab* goes away.
> - Favorites and "My data" are per-user; under `auth.type=DISABLED` favorites are an instance-wide shared set and "My Objects" has no owner — the UI should make that clear.
> - This **blocks** the remaining Favorites work in #1815: that work is folded into this overhaul.
> - To be decomposed into slices after filing; a design ADR will fix the technical approach (a federated search across the existing per-kind indexes vs a single unified index), the lineage-filter depth, and where the column config is stored.

---

## Sources
- Search architecture (verified 2026-06-29, odd-platform `da2932e1`): `controller/SearchController.java`; `service/search/SearchServiceImpl.java`; `repository/reactive/Reactive{Search,TermSearch,QueryExampleSearch,LookupTableSearch}EntrypointRepository*.java`; `dto/FacetType.java`; `navigation/domains/search.md`; `odd-platform-specification/openapi.yaml` (`/api/search*` → `DataEntityList`); `odd-platform-ui/.../Search/Results/Results.styles.ts` (`MainColNames`/`AddColNames`); `odd-platform-ui/.../Search/Results/ResultItem/SearchHighlights/SearchHighlights.tsx` (`DataEntitySearchHighlight`).
- Favorites foundation reused as a filter: `prds/0001-favorites-and-recently-viewed.md`, `prds/0002-favorites-completion.md`; `service/FavoriteAssetResolver.java`, `auth/CurrentUserIdentityResolver.java`, the `favorite` table (`V0_0_94`).
- Ideation: maintainer, 2026-06-29 (this session).
