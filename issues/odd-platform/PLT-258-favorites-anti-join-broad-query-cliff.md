---
id: PLT-258
title: "favorites=false on a broad search query is ~27x slower than the same query unfiltered (4.8s vs 180ms) -- a GIN row misestimate turns the anti-join into ~10M in-memory comparisons"
target_repo: odd-platform
issue_type: bug
status: draft
github_issue_url: ""
github_issue_number: null
filed_title: "Search: the favorites=false filter degrades ~27x on broad queries (anti-join materialises on a GIN row misestimate)"
filed_labels: "kind: bug, scope: backend, scope: performance"
severity: low   # low ONLY because favorites=false has no UI control today; the cliff itself is real and measured
discovered_during: "CTRIB-061 / #1841 ST-7 -- the EXPLAIN gate the issue's own pre-work note asked for"
found_date: "2026-08-31"
user_facing_verified: false   # measured on a synthetic 50k corpus; not yet driven from the UI (there is no UI path)
suggested_milestone: "1.0.0"  # SUGGESTED ONLY -- filed with NO milestone; the maintainer attaches it (G-C11)
---

## Summary

The ST-7 Favorites filter's **negative** direction (`favorites=false` -- "assets I have NOT starred") costs
**4.8 s** on a query matching most of the catalog, against **180 ms** for the identical query with no
favorites predicate. A ~27x cliff, measured, not projected.

The **positive** direction -- the one the UI exposes -- is unaffected: **5.9 ms**.

## Measurements

`EXPLAIN (ANALYZE, BUFFERS)` on the **generated** SQL (captured from the application's r2dbc query log, not
hand-written), against 50,001 `asset_search_entrypoint` rows and 60,200 active `favorite` rows across 300
identities, 200 of them the caller's:

| query | plan | time |
|---|---|---|
| broad FTS, **no** favorites predicate (control) | Bitmap Heap Scan + top-N sort | **180 ms** |
| broad FTS + `favorites=true` | Nested Loop semi-join, drives from `favorite` | **5.9 ms** |
| broad FTS + `favorites=false` | **Nested Loop Anti Join** | **4,829 ms** |
| *selective* FTS + `favorites=false` | Merge Anti Join | **6.7 ms** |

## Root cause

Not the predicate shape and not a missing index.

The GIN scan's row estimate is **~50x low** -- planner `rows=1000`, actual `rows=50001`. With 1,000 estimated
outer rows a nestloop anti-join against ~200 inner rows looks cheap, so the planner picks it. At the real
50,001 rows the inner side is **materialised once** (`loops=1`) and the correlation is applied as a
**Join Filter** rather than an index condition:

```
Nested Loop Anti Join  (actual time=20.602..4806.653 rows=49801 loops=1)
  Join Filter: ((favorite.asset_kind = ase.asset_kind) AND (favorite.asset_id = ase.asset_id))
  Rows Removed by Join Filter: 9980100          <- ~10M comparisons
```

**A partial index on the exact correlated 4-tuple was created and re-measured: it changed nothing** (4.8 s ->
4.8 s). The planner used it (`Index Only Scan`) and still materialised + filtered. The misestimate is the
driver, so an index is not the remedy.

For contrast, the same predicate with a *selective* query gets a **Merge Anti Join** and runs in 6.7 ms -- the
planner's choice is correct once its estimate is close.

## Why severity is low today

`favorites=false` has **no UI control**. ST-7 ships a two-state toggle (on / absent) after a product decision
that "show me everything I have NOT starred" is indistinguishable from "All" for a user with tens of favorites
out of thousands of assets. The value stays expressible on the wire and in the URL, so this is reachable by a
hand-built link or an API caller -- but nothing in the product generates it.

If a future slice gives the inverted scope a UI affordance, **this becomes a user-facing cliff and must be
fixed first.**

## Possible remedies (not applied here -- out of ST-7's approved scope)

- Improve the GIN selectivity estimate for the entrypoint's `search_vector` (raise statistics target, or an
  extended-statistics object). Fixes the cause and helps every broad search, not just this filter.
- Force a hash anti-join for the negative direction. Not portably expressible through jOOQ.
- Cap the candidate set before the anti-join (the depth cap already exists for relevance paging; it does not
  apply to the browse sorts).

## Sources

Read/measured 2026-08-31 on the `ctrib061` isolated stack (`odd-platform:odd-team-sut-ctrib061`, DB on 15650),
against the SQL captured from the running application:
`ReactiveAssetSearchRepositoryImpl` condition (5b); `db/migration/V0_0_94__create_favorite.sql`
(`favorite_identity_asset_key`, `favorite_identity_created_active_idx`);
`db/migration/V0_0_98__create_asset_search_entrypoint.sql` (the GIN index).
