# feat(favorites): faceted list endpoint — GET /api/favorites/list (#1815, slice 2/4)

**Part of #1815** — Favorites. This is **slice 2 of 4** (stacked PRs); this PR does **not** close the issue —
only the final slice does. It builds on the merged slice-1 foundation (the `favorite` table, the identity
resolver, the polymorphic `AssetKind`/`AssetRef` contract, the write API).

Milestone: 1.0.0
Docs: none in this slice — no user-facing surface until the frontend slice; the user docs + the "Asset" term
ride the documentation `release/1.0.0` train and publish with the 1.0.0 release.

## What changed

- **`GET /api/favorites/list?asset_types=&page=&size=`** → a polymorphic **`FavoriteAssetList`**: the current
  user's favorited assets resolved across **all 3 kinds** (DATA_ENTITY / TERM / QUERY_EXAMPLE), newest-favorited
  first, paginated (`size` capped server-side at 100), with the multi-select **`asset_types`** filter.
- **Visibility by reuse (ADR D3) — deleted assets drop out automatically.** The list stores nothing about the
  asset; each favorited `(asset_kind, asset_id)` is resolved live through each kind's canonical query + mapper,
  so a since-deleted (or hollow) asset simply is not returned.
- **Read path (ADR D4) — order-then-semi-join, not a 4-way UNION.** Order + paginate the indexed `favorite`
  rows first (`created_at DESC, id DESC`), then resolve only that page per kind: DATA_ENTITY via
  `getDimensionsByIds` + a `STATUS≠DELETED`/`HOLLOW=false` post-filter; TERM via `getTermRefDto` (filters
  deleted); QUERY_EXAMPLE via the query-example repo + a `deleted_at` filter; reassemble in favorited order.
- **`FavoriteAsset`** = an `asset_kind` discriminator + exactly one of the existing `DataEntityRef` / `TermRef` /
  `QueryExampleRef` (reused — no new ref shapes); the FE switches on `asset_kind`.

## Scope

**In:** the list endpoint, the polymorphic resolution across all 3 kinds, visibility, ordering, pagination, the
`asset_types` filter, the `FavoriteAssetResolver`, unit + integration tests.
**Deferred (additive follow-up; will fold into the tab's facet UI):** the cross-kind `namespace` / `datasource` /
`tag` / `owner` facets — tab-only refinements with per-kind applicability (e.g. query examples carry no
namespace/datasource), and the main-page panel uses `size=5` with no facets. Adding them later does not break
the contract.
**Out (later slices):** all frontend (slice 3); docs + the "Asset" term + the housekeeping orphan sweep (slice 4).

## Tests & verification

- **Unit:** `FavoriteAssetResolverTest` — per-kind resolution, the visibility filter (deleted/hollow DE + deleted
  QE dropped), favorited-order preservation, empty page. `FavoriteServiceImplTest` — orchestration, the `size`
  cap, asset-type mapping. `FavoriteControllerTest` — delegation + 200.
- **Integration (Testcontainers Postgres):** `ReactiveFavoriteRepositoryImplTest` — `getFavoritedPage`
  (newest-first ordering, pagination, the `asset_kind` filter) and `countFavorites` (active-only, filter-aware).
- **Full `:odd-platform-api:build`** + **full integration regression**: recorded in the CTRIB-039 ledger.

## Note on the real-asset resolution
The resolver's visibility logic is unit-tested (mocked per-kind DTOs) and the page/count SQL is integration-tested
against real Postgres. The end-to-end resolution of *real* favorited assets (a real dataset → its `DataEntityRef`)
is exercised by the frontend e2e in slice 3, which drives the running stack with seeded assets.

## Consumer-read
- `repository/reactive/ReactiveDataEntityRepositoryImpl.java` — `getDimensionsByIds` (`includeDeleted(true)`) +
  the `STATUS≠DELETED`/`HOLLOW=false` visibility predicate (`:121,244,445-447`).
- `repository/reactive/ReactiveTermRepositoryImpl.java:182-190` — `getTermRefDto` filters `TERM.DELETED_AT IS NULL`.
- `db/migration/V0_0_84__create_query_example.sql` — `query_example.deleted_at` (soft-delete).
- `mapper/{DataEntityMapper,TermMapper,QueryExampleMapper}.java` — the reused ref mappers.

## Sources
`prds/0001-favorites-and-recently-viewed.md` §5.3, §7.2 · `adrs/drafts/favorites-recently-viewed-foundation.md`
(D3, D4) · odd-platform `main @ 577593ae` (slice 1 merged).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
