---
id: PLT-268
title: "Most popular ranks glossary terms and query examples below assets nobody has ever opened: the platform records term / query-example opens but has nowhere to count them, so popularity is data-entity-only"
target_repo: odd-platform
issue_type: feature
status: filed            # FILED https://github.com/opendatadiscovery/odd-platform/issues/1883 on 2026-09-06 by odd-contributor[bot]. The maintainer lifted the never-auto-file rule this session ("you could create gh issues on your own"); the draft stays here as the working record behind the filed body.
github_issue_url: "https://github.com/opendatadiscovery/odd-platform/issues/1883"
github_issue_number: 1883
filed_title: "Cross-kind popularity: count views for Terms and Query Examples so Most popular / the Popularity facet rank all three asset kinds"
filed_labels: "kind: feature, scope: backend, scope: frontend"
severity: medium         # not a defect - ST-9 shipped its DE-only scope deliberately and documented it. It is a
                         # product gap on the #1825 thesis ("one query language, one result list, all asset kinds"),
                         # and it is user-visible the moment anyone picks Most popular on a catalog with a glossary.
discovered_during: "maintainer request at the CTRIB-066 / #1843 GATE-2 close-out, 2026-09-06 - 'count most popular for terms and query examples as well'"
found_date: "2026-09-06"
user_facing_verified: true    # DRIVEN end to end on a running platform built from the merged ST-9 code
                              # (0238005c's tree): a term opened 26 times through the shipped
                              # POST /api/recently-viewed/TERM/{id} endpoint ranks BELOW a data entity with zero
                              # views under sort=popularity, contributes 0 to the histogram, and disappears
                              # entirely from the Popular tile's own link. Transcript in "User-facing impact".
suggested_milestone: ""       # SUGGESTED ONLY - filed with NO milestone; the maintainer attaches one
public_note: "https://github.com/opendatadiscovery/odd-platform/issues/1843#issuecomment-5561330652 - the post-merge note on #1843 carrying the same driven evidence, posted 2026-09-06 BEFORE this issue existed, so it deliberately made no tracked-separately claim. A short follow-up on the same thread now links #1883."
related: "#1843 (ST-9 - shipped the DE-only facet + sort), #1825 (the unified-asset-search epic this narrows), #1861 (Search residuals - a plausible alternative home if you would rather fold this in than file it), #1839 slice 5c / #1862 (V0_0_100, the popularity substrate), #1816 (recently-viewed, which already records all three kinds)"
---

## What

ST-9 (#1843) shipped the **Popularity** range facet, the **Most popular** sort and the Popular tile's
**View all**. All three read `asset_search_entrypoint.popularity_score`, which is a 15-minute snapshot of
`data_entity.view_count`. `view_count` exists on exactly one table -- `data_entity` (added by
`V0_0_10__add_counters.sql`) -- so terms and query examples are pinned at score 0 forever.

`V0_0_100__snapshot_popularity_score.sql:18` states the constraint plainly:

> Popularity is DATA-ENTITY-ONLY (Terms / Query Examples have no view_count) -> non-DE rows keep 0.

That was the right scope for ST-9 and the manual documents it. The gap it leaves is that **the platform
already observes term and query-example opens and then throws the observation away**.

## The observation already exists -- there is just nowhere to count it

All three detail pages record an open, through one shared cross-kind path:

| Surface | Call |
|---|---|
| `DataEntityDetails.tsx:37` | `useRecordRecentlyViewed(AssetKind.DATA_ENTITY, id)` |
| `TermDetails.tsx:29` | `useRecordRecentlyViewed(AssetKind.TERM, termId)` |
| `QueryExampleDetails/QueryExampleDetailsContainer.tsx:22` | `useRecordRecentlyViewed(AssetKind.QUERY_EXAMPLE, exampleId)` |

-> `POST /api/recently-viewed/{asset_kind}/{asset_id}` -> `RecentlyViewedController.recordRecentlyViewed`
-> `RecentlyViewedServiceImpl.recordView` -> `recently_viewed (asset_kind, asset_id, oidc_username, provider,
last_viewed_at)`. The table is explicitly polymorphic --
`V0_0_95__create_recently_viewed.sql:14` comments the column `-- DATA_ENTITY | TERM | QUERY_EXAMPLE`.

So the signal is cross-kind today. Only the **aggregate** is data-entity-only.

**`recently_viewed` cannot itself be the aggregate**, and it is worth saying why so nobody spends a day trying:

* It is a **per-identity upsert** -- one row per (user, asset), moved to "now" on each open. 26 opens by one
  identity produce **one** row (measured below).
* `RecentlyViewedHousekeepingJob` deletes rows older than `housekeeping.ttl.recently_viewed_days` **and** trims
  each user's history to the newest `housekeeping.ttl.recently_viewed_max_per_user`. It is a bounded navigation
  store, by design -- its own migration header calls it "navigation-only".
* Under `auth.type=DISABLED` every caller shares one sentinel identity, so the whole instance collapses to one
  row per asset.

## User-facing impact

Driven on a running platform built from the merged ST-9 code, 2026-09-06. Seeded: two data entities
(`plt268 dataset` with `view_count = 1000`, `plt268 neverviewed` with `view_count = 0`) and one glossary term
(`plt268 term`), all three indexed through the normal FTS writer path. The term was then opened **26 times**
through the shipped endpoint (`POST /api/recently-viewed/TERM/1` -> `HTTP 204` each time), and the snapshot
job's own UPDATE statement was run.

**1. The opens are recorded, and then cannot be counted.**

```
recently_viewed:   TERM id=1   rows=1     <- 26 opens, one row (per-identity upsert)
information_schema: columns named view_count  ->  data_entity.view_count       (that is the whole list)
asset_search_entrypoint after the snapshot job:
  DATA_ENTITY id=26801  plt268 dataset       score=9    (1000 views)
  DATA_ENTITY id=26802  plt268 neverviewed   score=0    (0 views)
  TERM        id=1      plt268 term          score=0    (26 opens)
```

**2. `Most popular` ranks the 26-times-opened term below the asset nobody has ever opened.**

```
POST /api/search/assets  {"query":"plt268","sort":"popularity"}
  1. DATA_ENTITY   plt268 dataset
  2. DATA_ENTITY   plt268 neverviewed     <- zero views
  3. TERM          plt268 term            <- 26 opens
```

Both sit in score band 0, and the tiebreaker is `asset_kind ASC`, so a data entity always precedes a term. The
ordering is not merely "terms rank low": **no number of opens can ever move a term above an unopened dataset.**

**3. The histogram under-counts the result set.**

```
POST /api/search/assets/facets/popularity  {"query":"plt268"}
  sum of all 21 bucket counts = 2      (the search matches 3 assets)
```

The bars a user slides over describe 2 of the 3 results. The Popularity control's own qualifier says
*Data entities only*, so this is disclosed -- but it means the distribution is not the distribution of the list.

**4. The Popular tile's own link drops the term.**

```
POST /api/search/assets  {"query":"plt268","sort":"popularity","popularity":{"min":1}}
  total: 1   ->  [DATA_ENTITY]
```

`popularity_min=1` is exactly what the home page's Popular **View all** link sends. A catalog whose glossary is
its most-used surface shows a Popular view with no terms in it.

**Who this bites.** A data-governance team whose glossary is the thing people actually open: stewards use
Most popular to find what the organisation reads, and the answer silently excludes the glossary. It also
undercuts the #1825 thesis -- "one query language, one result list, all asset kinds" -- at the one ordering
where the kinds are treated unequally.

## Suggested fix

The cheap and consistent shape is a **cross-kind view counter written from the path that already sees every
open**, rather than a second counter bolted onto `term` and `query_example`:

1. **One counter, one hook.** `POST /api/recently-viewed/{asset_kind}/{asset_id}` already fires for all three
   kinds and already carries the polymorphic key. Have `recordView` also increment a global, identity-free
   counter -- either a small `asset_view_count (asset_kind, asset_id, view_count)` table or a
   `view_count` column on `asset_search_entrypoint` itself (the union index already has the exact
   `(asset_kind, asset_id)` key and is already the popularity substrate).
2. **Snapshot from it.** `ReactiveAssetSearchRepositoryImpl.refreshPopularityScores` currently joins
   `data_entity` and is kind-guarded. Point it at the cross-kind counter and drop the
   `asset_kind = 'DATA_ENTITY'` predicate; `asset_popularity_bucket()` is already kind-agnostic.
3. **Drop the DE-scoping from the read paths**: condition (8) in `conditions()` (which adds
   `ASSET_KIND.eq(DATA_ENTITY)` whenever a range is active) and the `.and(ASSET_KIND.eq(DATA_ENTITY))` in
   `popularityHistogram`. Then the facet's `Data entities only` qualifier, its inline help and the
   `search.md ## Popularity` section come out too.
4. **Converge `data_entity.view_count` deliberately, or leave it.** Two hooks exist today: the DE counter is
   incremented server-side on the detail GET (`DataEntityServiceImpl:207` -> `incrementViewCount`), while
   terms and query examples are recorded by an explicit front-end POST. Whether the new counter replaces the DE
   one or runs beside it is the one real decision in this issue. Note that the front-end POST path is the
   better-behaved of the two: the detail-GET increment is the one the manual already warns is "trivially
   inflatable" (no rate limit, no de-duplication, no auth), and there is a separate follow-up open on the same
   counter's live-vs-snapshot divergence between the home page's Popular tile and the search.

**Scope notes.** `asset_popularity_bucket()`, the `asset_search_entrypoint_popularity_idx` composite and the
whole ST-9 read path are already kind-agnostic -- the DE-scoping is three predicates and one source column, not
an architecture. The change does touch the approved ADR (`unified-asset-search` D5 records popularity as
data-entity-only), so it needs an ADR amendment rather than a silent widening.

## Tests a fix should carry

* Unit (Testcontainers, mirroring `AssetSearchPopularityIntegrationTest`): a term with N opens lands in the
  band `asset_popularity_bucket(N)` and sorts above a zero-view data entity; the histogram's bucket counts sum
  to the FULL result set, not the data-entity subset; a range no longer excludes terms.
* Integration (odd-team, extending `IT-156`): the case that today asserts the term is ABSENT under a range is
  the exact case that must flip -- it is the regression oracle for this change.
* The `search.md ## Popularity` section, the control's `Data entities only` qualifier and its inline help all
  become wrong on the same commit; sweep them together.
