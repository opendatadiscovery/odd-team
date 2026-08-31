---
id: PLT-260
title: "Every catalog search pays a full count(*) over the FTS match set, which dominates the request at 100k+ assets"
target_repo: odd-platform
issue_type: bug
status: draft
github_issue_url: ""
github_issue_number: null
filed_title: "Catalog search: the total-count query dominates request time on a large catalog"
filed_labels: "kind: bug, scope: backend"
severity: medium   # not a correctness defect; it sets the floor for every search on a real-sized catalog
discovered_during: "CTRIB-062 / #1842 ST-8 - the ST-8 performance gate, measured on a 120 000-asset stand"
found_date: "2026-08-31"
user_facing_verified: true   # measured end to end against a running platform; numbers below
suggested_milestone: ""      # SUGGESTED ONLY -- the maintainer attaches one
---

## Summary

`AssetSearchServiceImpl.resolvePage` issues the ranked page and a `count(*)` over the same predicate as a
`Mono.zip`. On a small catalog the count is free. On a realistic one it is the single most expensive part of
the request, and it is paid on **every** search - with or without any filter.

This is **not** an ST-8 defect. ST-8's My-data scope surfaced it because that slice was the first to measure a
search at catalog scale, but the count predates it and applies to every search path.

## Measured

Stand: PostgreSQL 13.2 (the deployed version), a LOGIN_FORM platform stack, **120 000 indexed assets**, a
query matching all of them. `auto_explain` with `log_min_duration=200`, so every figure is the statement's own
duration as PostgreSQL recorded it - not a client-side estimate.

| statement | n | median | max |
|---|---|---|---|
| `count(*)` over the ranked predicate | 27 | **274 ms** | 397 ms |
| the ranked page itself (`ts_rank` + LIMIT 31) | 27 | 360 ms | 521 ms |

End to end, an **unscoped** search over that catalog measures **1.17 - 1.25 s**. The count is a large,
unavoidable share of it, and it grows with the match set rather than with the page.

The page query is bounded by `LIMIT` and served by the GIN index:

```
Limit  (actual time=507.683..507.706 rows=31)
  ->  Sort  Sort Method: top-N heapsort  Memory: 29kB
        ->  Hash Left Join ... (rows=10000)
              ->  Bitmap Heap Scan on asset_search_entrypoint  (actual time=99.1..216.0 rows=10000)
                    ->  Bitmap Index Scan on asset_search_entrypoint_search_vector_gin_idx
                          Index Cond: (search_vector @@ to_tsquery('...'))
```

The count has no such bound - it must visit the whole match set.

## User-facing impact

Every search on a catalog of this size costs over a second before any filter is applied, and roughly a
quarter to a third of that is spent computing a number the UI renders as a single line of text
(`N results`). An operator typing in the Catalog waits for the exact total whether or not they care about it,
on every keystroke-committed query. It also sets the floor that any per-feature performance target has to be
written against: a bound of "under a second" is unreachable at 120 000 assets no matter how efficient the
feature's own predicate is.

## Directions (not a prescription)

- **Cap it.** Count up to N (e.g. 10 000) and render `10 000+`. The UI already has a "partial count" idiom
  from ST-8 (`N+ results`), so the presentation cost is near zero.
- **Defer it.** Return the page immediately and fetch the total in a second call, so the list paints first.
- **Estimate it.** `EXPLAIN`-derived row estimates for large match sets, exact below a threshold.

Each changes what `total` means, so it is a product decision, not a pure optimisation.

## Sources

- Measured on the CTRIB-062 Phase-D perf stand, 2026-08-31; `auto_explain` output.
- `odd-platform-api/.../service/AssetSearchServiceImpl.java` - `resolvePage`, the `Mono.zip(pageFlux, count)`.
- `odd-platform-api/.../repository/reactive/ReactiveAssetSearchRepositoryImpl.java` - `count(state, assetKinds, scope)`.
