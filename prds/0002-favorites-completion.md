# PRD-0002 — Favorites completion (issue #1815, post-S3 refinement)

| | |
|---|---|
| **Status** | Draft for review → additional slice(s) under issue **#1815** (does **not** spawn a new issue) |
| **Target** | odd-platform **release 1.0.0** (same train as PRD-0001) |
| **Parent** | **PRD-0001 §5** (`prds/0001-favorites-and-recently-viewed.md`) — this PRD **completes** the shared foundation §5 specified; it does not expand scope |
| **Issue** | [opendatadiscovery/odd-platform#1815](https://github.com/opendatadiscovery/odd-platform/issues/1815) — Favorites. Slices S1 (#1817), S2 (#1819), S3 (#1821, review-ready) shipped the skeleton; this PRD defines the slices that finish it |
| **Author** | ODD Team (maintainer feedback, 2026-06-27) |
| **Consultations** | post-S3 PO + SRE critique — `lineage/odd-platform/sme-consultations/2026-06-27-favorites-s3-po-sre-critique.md` |
| **Why this exists** | A running-UI review of S3 found the favorites surface **half-built against PRD-0001 §5 itself** (S2 deferred the 4 cross-kind facets; S3 shipped a fixed checkbox where §5.6/§5.7 specified a grouped multi-select, and a 3-field row where §5.6 specified the shared rich row renderer) **plus** refinements the running UI revealed (icon collision, list-row stars, FTS). The S3 code review verified correctness but did not run the end-to-end Product-Owner/SRE lens — the gap this PRD closes. |

---

## 1. Frame — this completes PRD-0001 §5, it does not expand it

PRD-0001 §5 specified a faceted, multi-select, richly-rendered favorites surface. The slice decomposition descoped it under the banner "additive, no contract break":

- **§5.3 / §5.6** specified facet filters **Namespace, Datasource, Tag, Owner, Asset-type — multi-select, default *All***, reusing `components/Search/Filters/*`. → **S2 deferred all four cross-kind facets; S3 shipped only a fixed-checkbox Asset-type filter.**
- **§5.6** specified the right pane as **"the shared row renderer"** (the catalog result row: name, namespace, asset type, datetime, description). → **S3 shipped a sparse 3-field row (name + kind label + star).**
- **§5.7** specified a **grouped multi-select** where **Data Entities refine by Entity Class** (Datasets, Transformers, Quality Tests, …) alongside Glossary Terms / Query Examples / Lookup Tables. → **S3 shipped a flat 3-option group (Data Entities / Terms / Query Examples).**
- **"Star any viewable asset"** (PRD §1) → **S3 placed the star on detail headers + DataEntity search rows only; Query-Example and Term ("Dictionary") *list* rows have no star.**

So most of the maintainer's review is **PRD-0001 §5 compliance**, not new scope. The genuinely-new refinements (running-UI discoveries) are the **Star/Popular icon collision**, **full-text search over favorites**, and the **main-page panel form-factor**.

## 2. Maintainer review → PO verdicts (SME consult 2026-06-27)

| # | Maintainer note | PO verdict | Resolution |
|---|---|---|---|
| 1 | Panel should match the "My Objects" form-factor; re-icon "Popular" (Star now = Favorite) | **VALID — reshape** | Reuse the **My-Objects shared column component** for the panel rows, but keep Favorites in its **own always-on band outside** the owner-gated Recommended grid (Recommended is hidden under DISABLED / no-owner — `catalog-overview.md:45,62`). Adopt a **global icon system**: Star = Favorite everywhere; re-icon Popular (trending) + Recently-Viewed (clock). |
| 2 | Asset-type filter as a checkbox is wrong — use the multichoice facet pattern | **VALID** | Replace the fixed checkbox group with the platform `MultipleFilterItem` autocomplete + "Clear All" (`components/Search/Filters/Filters.tsx:47-65`). This is PRD §5.6. |
| 3 | "Data Entity" bucket too broad — split by class, combine with Terms / Query Examples at one level | **VALID — split across UI + contract** | **UI:** flatten so Datasets / Transformers / … (Entity Class) sit at the **same level** as Glossary Terms / Query Examples (PRD §5.7's grouped multi-select). **Contract:** keep the 3-way `AssetKind` as the backend **routing discriminator**; add `entity_class_ids[]` that refines **only** the `DATA_ENTITY` semi-join. **Not** a flat 9-value `asset_types` enum (ODD's own Search models class as a tab strip refining the data-entity kind — `search.md:35-49`). |
| 4 | List rows too sparse — show namespace, created datetime, asset type, truncated description | **VALID** | Reuse the existing **Search result-row renderer**; resolve the fields live in the semi-join; degrade per-kind (a Query Example has no namespace). PRD §5.6. |
| 5 | Where are the tag / namespace / … facets? | **VALID** | Ship the 4 deferred facets `namespace_ids / datasource_ids / tag_ids / owner_ids` + the **exclude-a-kind** rule (a kind that lacks the selected facet drops out — PRD §5.3 line 135). |
| 6 / 8 | Query-Example **and** Term list rows can't be starred | **VALID** | `<FavoriteStar>` on Query-Examples list rows **and** Terms ("Dictionary") list rows, hydrated in one batch per list (not per-row). |
| 7 | No full-text search on the Favorites tab | **VALID — enrichment** | A free-text box scoped to the user's favorites (MUST for parity with every other ODD list surface). New backend support. |

## 3. PO enrichment (a Principal PO would also require)

- **Shared-foundation discipline (load-bearing):** every fix lands in **shared components** (the panel column, the facet sidebar, the row renderer, the list-row star). Otherwise the sibling **Recently Viewed** (PLT-250) re-opens all eight gaps when it reuses §5's foundation.
- **Global icon system** — Star = Favorite, Popular = trending, Recently = clock (resolves the collision in note 1 everywhere, not just on Overview).
- **Empty / loading / error states** for the tab + panel; render-when-empty teaches the star (PRD §5.5).
- **Accessibility** — the new autocomplete facets + the new list-row stars carry the same `aria-pressed` / keyboard contract S3's `FavoriteStar` already meets.
- **DISABLED shared-bucket labelling** — under `auth.type=DISABLED` favorites are an instance-wide shared bucket (PRD §6.3); the surface should label it non-possessively ("Favorites *(shared)*") so an operator isn't misled. *(Confirm S3's current DISABLED copy in-tree.)*
- **COULD:** star-reach to other list surfaces (lineage panes, DEG members, Directory rows); a sort control on the tab.

## 4. SRE flags (consult 2026-06-27)

1. **Order-then-semi-join vs heterogeneous facets** — a facet that excludes a kind (Query Examples carry no namespace/datasource) breaks the clean "LIMIT the `favorite` rows first, then resolve" plan; it needs per-kind filtered sub-queries merged under a single global `favorited_at DESC` order. **Tractable only because a curated favorites set is low-cardinality per user** — keep the `size` cap (100) and **count after** facet filtering.
2. **FTS is non-uniform** — Data Entities + Terms have `tsvector`/GIN; **Query Examples do not** → an `ILIKE` fallback for that kind. Document the asymmetry.
3. **Batch-hydrate** — prefer a **client-side favorited-id set** (the favorites set is small) over a `POST /api/favorites/status` round-trip per list surface. `POST /api/favorites/status` already shipped (S1); keep it for arbitrary lists, but the list-row stars (#6/#8) should hydrate from the cached set.
4. **DISABLED open-posture** of `/api/favorites/*` mirrors the documented `GET /api/dataentities/popular` parallel (`catalog-overview.md:45`) — **not a new leak**; carry the existing LSN-001/LSN-002 "don't run DISABLED in production" admonition into the favorites docs.

## 5. Prioritized closure set (the additional slice(s))

**Group A — FE-only (no contract change; can ship first):**
- **A1 (MUST)** Replace the Asset-type checkbox with the `MultipleFilterItem` autocomplete facet (note 2).
- **A2 (MUST)** Panel uses the My-Objects shared column component, own always-on band (note 1).
- **A3 (MUST)** Global icon system — Star=Favorite / Popular=trending / Recently=clock (note 1).
- **A4 (MUST)** `<FavoriteStar>` on Query-Example + Term list rows, batch-hydrated (notes 6/8).
- **A5 (MUST)** Rich row renderer on the Favorites tab — reuse the Search row (note 4), for the fields already in the payload.
- **A6 (MUST)** Empty / loading / error states.
- **A7 (MUST)** A11y on the new facets + list-row stars.
- **A8 (SHOULD)** DISABLED "(shared)" labelling (after confirming current copy).

**Group B — needs backend contract change (OpenAPI + clients + JOOQ):**
- **B1 (MUST)** The 4 cross-kind facets `namespace_ids / datasource_ids / tag_ids / owner_ids` + the exclude-a-kind rule (note 5; PRD §5.3).
- **B2 (MUST)** `entity_class_ids[]` refining the `DATA_ENTITY` semi-join; keep `AssetKind` as the discriminator (note 3).
- **B3 (MUST)** Enrich the `AssetRef`/`FavoriteAsset` payload so the rich row (A5) resolves without N+1 (namespace, asset type, created-at, truncated description).
- **B4 (SHOULD→MUST)** Free-text search over favorites — `query` param; per-kind `tsvector` + Query-Example `ILIKE` fallback (note 7; SRE flag 2).
- **B5 (done)** `POST /api/favorites/status` — already shipped (S1); no new work, used by A4.

**Group C — coherence:**
- **C1 (MUST)** Everything lands in shared components so Recently-Viewed (PLT-250) inherits it.
- **C2 / C3 (COULD)** Sort control; star-reach to lineage / DEG / Directory.

## 6. Cross-cutting impact (Gate 0)

- **OpenAPI** (`/api/favorites/list` gains `namespace_ids/datasource_ids/tag_ids/owner_ids/entity_class_ids/query`) → **regenerate Java + TS clients**; the `FavoriteAsset` payload enrichment (B3) is a response-shape change → consumers + the FE row renderer.
- **JOOQ** — no new table; the read path (`ReactiveFavoriteRepositoryImpl` + `FavoriteAssetResolver`) gains the per-kind facet sub-queries.
- **i18n** — new facet labels + the FTS placeholder + any new empty/error copy → all 7 locales.
- **Docs (release/1.0.0 train)** — the favorites feature page must document the **completed** surface (facets, FTS, list-row stars, the panel), not the S3 skeleton; the "Asset" term in `main-concepts.md` (PRD §5.7); carry the DISABLED admonition.
- **Ontology** — `/enrich --touched` over the favorites nodes after the surface is final (the deferred S4 ontology step).
- **Tests** — extend IT-148 (the star→see loop) to cover: a multi-select facet narrowing, FTS, and starring from a QE/Term list row; unit-cover the facet/FTS slice logic + the per-kind resolver branches.

## 7. Closure gate

**Issue #1815 cannot be considered closed until Group A + Group B (MUST) land** (Group C/COULD may trail). The current S3 PR (#1821) is a correct, mergeable **skeleton** slice — it can merge as-is (the foundation it builds is reused), but the **closing keyword stays off every slice until the completion slices above ship**. The maintainer's review is the acceptance bar for "done," not the green test suite.

## Sources

- PRD-0001 §5.3 / §5.5 / §5.6 / §5.7, §6.3, §7.2 — `prds/0001-favorites-and-recently-viewed.md` (the foundation this completes).
- PO + SRE consult — `lineage/odd-platform/sme-consultations/2026-06-27-favorites-s3-po-sre-critique.md`.
- Platform facet pattern — `odd-platform-ui/src/components/Search/Filters/Filters.tsx` (`MultipleFilterItem`, "Clear All").
- Catalog Overview "Recommended"/"My Objects" form-factor + the DISABLED open-posture parallel — `documentation/docs/data-discovery/catalog-overview.md`.
- Search class-tab taxonomy — `documentation/docs/data-discovery/search.md`.
- S3 review verdict (what shipped vs the gaps) — `contributor/CTRIB-039.md` "## Review (2026-06-27, session: review-ctrib039)".
