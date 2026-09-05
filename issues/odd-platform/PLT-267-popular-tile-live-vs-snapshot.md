---
id: PLT-267
title: "The home page's Popular tile and the search's Popularity facet / sort disagree: the tile ranks by the live exact view count and ignores exclude_from_search, the search uses the 15-minute bucketed snapshot and honours it"
target_repo: odd-platform
issue_type: bug
status: draft            # paste-ready; handed to the maintainer in the CTRIB-066 GATE-1 packet (the bot never files issues)
github_issue_url: ""
github_issue_number: null
filed_title: "Popular tile vs search Popularity: two definitions of popular (live view_count vs the 15-min snapshot; exclude_from_search ignored by the tile)"
filed_labels: "kind: bug, scope: backend, scope: frontend"
severity: low            # a consistency defect between two surfaces that will sit one click apart once ST-9 links them; no data is wrong, no security exposure is new
discovered_during: "CTRIB-066 / #1843 (ST-9 Popular range facet) -- the odd-sme consult + the source read, 2026-09-05"
found_date: "2026-09-05"
user_facing_verified: false   # derived from the source (listPopular vs the unified-search predicates) and the shipped doc caveat; the click-through divergence is observable once #1843 ships the View all link
suggested_milestone: ""       # SUGGESTED ONLY -- filed with NO milestone; the maintainer attaches one (1.0.0 would close the gap before the facet publishes)
related: "#1843 (ST-9 -- adds the search side + the tile's View all), #1839 slice 5c / PR #1862 (the popularity_score snapshot), #1861 item 1 (the Most popular sort)"
---

## What

The catalog has two surfaces that claim to show "popular" data entities, and after ST-9 (#1843) they sit one
click apart -- the home page's **Popular** tile gains a **View all** that opens the catalog search sorted by
popularity. They do not compute popularity the same way:

| | Popular tile (home page) | Search: Popularity facet + Most popular sort (#1843) |
|---|---|---|
| Signal | `data_entity.view_count`, live, exact | `asset_search_entrypoint.popularity_score` -- a log2 band of view_count, refreshed every 15 minutes by `AssetPopularitySnapshotJob` (ADR unified-asset-search D5 + its SRE correction: the live counter is a write hotspot and must not be joined at query time) |
| Order | exact views, highest first | band, highest first; inside one band the order is the stable id tiebreaker |
| `exclude_from_search = true` | ignored -- the entity is shown (the shared list-shape helper filters only soft-delete + hollow; documented in catalog-overview.md and search.md as "a full-text-search signal only") | honoured -- the entity is absent |

User-visible consequences once the link exists:

1. Two entities at 40 and 60 views share band 5 (31-62 views). The tile shows 60 then 40; **View all** may show 40
   then 60. The tile's #1 can appear as #3 on the search page.
2. An entity opened 16 times in the last few minutes shows `16 views` on its General panel while the search's
   `15+ views` band does not list it yet -- for up to 15 minutes.
3. An entity flagged `exclude_from_search` shows on the tile and **vanishes on click-through** to View all.

None of this is a data error; it is two definitions of the same word. #1843 discloses all three in the manual's
Popularity section rather than fixing the tile, because the fix changes a released endpoint's semantics.

## Where

- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/repository/reactive/ReactiveDataEntityRepositoryImpl.java`
  -- `listPopular` (~:669) orders the CTE by `view_count DESC`; no `exclude_from_search` predicate (the manual's
  caveat: catalog-overview.md "exclude_from_search is a full-text-search signal only", the Popular column named first).
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/repository/reactive/ReactiveAssetSearchRepositoryImpl.java`
  -- the unified search's eligibility (condition (3), `EXCLUDE_FROM_SEARCH`) and, from #1843, the range predicate + the
  `POPULARITY_SCORE` sort.
- `odd-platform-api/src/main/resources/db/migration/V0_0_100__snapshot_popularity_score.sql` -- the band function
  `asset_popularity_bucket` and the composite index `asset_search_entrypoint_popularity_idx`.
- `GET /api/dataentities/popular` (openapi.yaml `/api/dataentities/popular`) -- the tile's endpoint, released.

## Suggested fix

**One definition of popular: point the tile at the snapshot.** Serve `GET /api/dataentities/popular` from
`asset_search_entrypoint` ordered by `popularity_score DESC, asset_id DESC` (an index-only scan on the existing
composite index), joined to `data_entity` for the ref + the same eligibility the search applies
(`hollow`, `status <> DELETED`, `exclude_from_search`). This also retires the tile's un-indexed
`view_count` sequential scan + in-memory sort on every home-page render (there is no index on
`data_entity.view_count`).

Compatibility (ADR D9): the endpoint's shape is unchanged; its ORDER becomes band-then-id and lags the live counter
by up to 15 minutes. That is a behaviour change on a released endpoint, so it should ship with its own doc update:
the two shipped inflatability caveats (catalog-overview.md#recommended, entity-detail-page.md) keep their substance
("view count is trivially inflatable") and gain the snapshot sentence the search page already carries.

Alternative kept for completeness: leave the tile live and keep the divergence documented (what #1843 does). It is
honest but leaves the home page and the search disagreeing about the one usage signal the catalog has.

## Steps to reproduce (after #1843 merges)

1. Seed two data entities with 40 and 60 views; wait for (or trigger) the popularity snapshot.
2. Open the home page: the Popular tile lists the 60-view entity above the 40-view one.
3. Click **View all** on the tile.
4. **Expected:** the same order. **Actual:** both sit in band 5 and the search orders them by id -- the 40-view
   entity can come first.
5. Flag one of them `exclude_from_search = true`: it stays on the tile and disappears from View all.

## References

- ADR `unified-asset-search` D5 + the rev-3 SRE correction (`SEARCH-CAPABILITIES-DESIGN.md` section 2): snapshot,
  never the live counter.
- odd-team `contributor/CTRIB-066.md` section 5.5 (GATE-1 decision D2) and the `odd-sme` consult
  `lineage/odd-platform/sme-consultations/2026-09-05-popular-range-facet-histogram.md` Q5.
- `lineage/odd-platform/concepts.yaml` "Popular Entities Ranking" (the `exclude_from_search` gap and the missing
  `view_count` index).
