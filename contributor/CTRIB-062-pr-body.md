## What

ST-8 of the #1825 search overhaul: a **My data** scope filter on the catalog search — the assets you own, and
the assets immediately up- or downstream of them — replacing the retired My-Objects result tab.

Closes #1842

## Why it is more than a new filter

Reading the code to build it turned up a **live defect on the shipped ST-4 path**: the existing `my_objects`
predicate was kind-guarded *with pass-through* —

```java
ASSET_KIND <> 'DATA_ENTITY' OR data_entity.id IN (owned)
```

— so "My Objects" returned your data entities **plus every term and every query example in the catalog**. A
filter whose label promises narrowing was *widening* the result for two of the three kinds; under "all kinds"
an operator read a screen of other people's terms as things they own. Fixing that is inside this slice's own
acceptance criterion ("each scope narrows correctly"), so it ships here.

Ownership is now evaluated per kind by that kind's own relation — data entities via `ownership`, terms via
`term_ownership` — and query examples, which have no ownership model at all, are excluded with the reason shown
in the sidebar rather than silently absent.

## The performance gate is a deliverable, not a checkbox

Measured on `postgres:13.2-alpine` (the deployed version) against a dense 50 000-edge fixture, **before**
writing the implementation:

| What | Measured |
|---|---|
| Downstream lineage hop (`parent_oddrn` — the PK's leading column) | Bitmap Index Scan, **30 ms** |
| Upstream lineage hop (`child_oddrn` — **no usable index**) | **Seq Scan, 880 ms** |
| Upstream hop after `V0_0_101` adds `lineage(child_oddrn)` | Bitmap Index Scan, **22 ms** |
| The existing recursive edge CTE at depth 2 | 1 157 ms, **130 000 rows materialised** for 800 distinct nodes |
| The same CTE at depth 3 | **did not complete within a 25 s statement timeout** |
| The bounded breadth-first walk used instead, depth 3 | **~281 ms** |

Two consequences:

1. **`V0_0_101` adds `lineage(child_oddrn)`.** Without it, three upstream hops cost ~2.6 s of pure sequential
   scanning on every search that uses the filter. The lineage-graph view anchors on the same columns and
   benefits identically.
2. **The scope expansion does not reuse the recursive CTE.** That CTE is `UNION ALL` over *edges* with no
   visited set, so its cost grows with path count, not node count — at the ADR's own depth ceiling it does not
   return. The filter uses a breadth-first walk with an explicit visited set instead: cycle-safe by
   construction, ≤ 3 indexed+`LIMIT`-ed queries per direction, and the worst case readable off the code rather
   than off a query plan. **`lineageCte` is untouched**, so the graph view keeps its behaviour exactly.

A third measurement changed the implementation itself: binding the resolved ids as `= ANY(bigint[])` on the
joined `data_entity.id` measured **54 443 ms** with a 10 000-id scope over a 200 000-row catalog, versus
**249 ms** for `asset_id IN (SELECT unnest(?))` applied to the index row. `= ANY` is a scalar array operation
Postgres evaluates linearly *per candidate row*, and PG13 has no hashed-ScalarArrayOp optimisation — so a
literal `IN` list is no better. That 218× difference is invisible on a small fixture.

## Bounds, and which of them shapes the result

- **Depth** ≤ 3 per direction, independently settable, default 1.
- **A node budget of 10 000** — the cap DataHub's Impact Analysis publishes — is the **only set-determining
  bound**. It is a pure function of the request and the data and every hop is ordered, so a truncated set is a
  deterministic prefix: the same shareable URL re-runs identically.
- **A wall clock** exists only as a circuit breaker. It is load-dependent, so it yields a *distinct* outcome
  (`TIMEOUT`, no scope applied) rather than a partial set wearing the same flag as the deterministic cap.
- **`MY_OBJECTS` is never truncated.** It stays the uncapped SQL semi-join it is today, so an owner of tens of
  thousands of assets keeps seeing all of them; only the lineage expansion is budgeted, and its first hop
  anchors on a *subquery* so the owned set is never even materialised.

**Truncation is loud**, because impact analysis is why people reach for this filter: the response declares it,
the page carries a persistent strip naming cause and remedy, and the count is qualified (`17+`, "partial"). An
operator who reads a truncated impact set as complete ships a breaking change believing they told every
downstream consumer.

## Also in this change

- **The result tab strip is gone.** ST-4 retired the seven class tabs; this retires the last one, so the
  components are deleted rather than left rendering a single tab. Their hint was the only place `/search`
  showed a count, so the count moves into a results header — which also **fixes** it: the tab hint counted data
  entities only and under-reported a mixed cross-kind result.
- **The three home panels deep-link into the filter**, and their captions are corrected in the same change.
  "Upstream dependents" is inverted — a dependent depends on you, i.e. is downstream, while that endpoint
  returns what your data depends *on* — so leaving it would mean the panel you click and the chip you land on
  disagree.
- **Posture when the filter cannot personalise** (never a silent empty): hidden under `auth.type=DISABLED`
  (matching the documented posture of the Recommended panel, the twin surface); rendered *disabled with the
  remedy named* for a signed-in user with no Owner binding, because that user has a fix and hiding it hides
  the fix.
- **Back-compat (ADR D9):** `my_objects` still works — when `my_data` is absent it reads as `[MY_OBJECTS]` — so
  bookmarked `?my=true` URLs and saved searches stored before this keep working. `/api/search` and the per-kind
  searches are untouched.
- **i18n across all 7 locales**, including *removing* the two inverted keys (key-parity guards parity, not
  orphans).

## Scope exclusions

Deferred with a tracked home, not silently dropped: per-option counts on the filter (three extra aggregates per
search on the slice that already carries the perf gate — ships only with measured evidence); giving query
examples an ownership model; the pre-existing gap where saved searches drop the Asset-type selection; and the
`data-lineage.md` self-contradiction about "Upstream dependents". The public scope note on #1842 states all of
these.

## Verification

- **Unit** — full `:odd-platform-api:build` **green: 773 tests, 0 failures, 0 skipped** (test + checkstyle +
  assemble, the CI replica). 24 new behavioural tests against a real Postgres and real wiring: direction
  correctness with independent per-direction depth, depth clamping, the anchor exclusion, **cycle
  termination**, **deterministic node-cap truncation asserted across two runs**, the node budget spent
  **exactly at a hop boundary**, the **wall-clock circuit breaker returning TIMEOUT with an empty scope**
  (fail-closed — a timeout must never read as unscoped), a large-owned-set regression guard, the per-kind
  narrowing (including the foreign-term and query-example exclusions), the full token-degradation contract
  (blank / unrecognised / case / duplicates / the ADR D9 legacy alias precedence), an empty resolved scope
  failing closed with an agreeing count, and the fail-closed empty page when no owner resolves.
- **Changed-lines coverage — 115/115 = 100%** against CI's `min-coverage-changed-files: 98`, measured locally
  rather than discovered in CI. The check found three documented outcomes with no test behind them (TIMEOUT,
  the NODE_CAP hop boundary, unrecognised-token degradation) — all three are promises this PR's own OpenAPI
  descriptions make, so they are now pinned. One dead factory was **deleted rather than tested**.
- **Frontend** — `tsc` clean; 42/42 URL-contract tests, asserted against real serialiser output rather than an
  assumed shape.
- **Integration** — two new protocols, both run, both green. `IT-152` (4/4) covers the URL contract's
  survival of a facet toggle (the #1858 mirror-merge class), the retired strip, the count, and the
  `auth.type=DISABLED` posture. `IT-153` (4/4) is the half that needs an identity: a real form login against a
  seeded owner association, proving each scope actually NARROWS (owned / upstream / downstream are not
  interchangeable), that per-direction depth is honoured, and that the home panels deep-link into the filter.
  Three existing suite-registered specs were re-pointed off the retired control rather than left red.
- **Full regression** — all four suites on the working-tree SUT: `feature-complete` 328 passed,
  `known-bugs` 3 RED (its pass condition), `multi-stack` 12 passed, `ingestion-e2e` 15 passed. The
  `feature-complete` failures are change-independent and reconciled by arithmetic, not assertion: 11 are the
  documented stale-spec class (specs still gating on `GET /api/search/{id}/results`, which ST-4 retired), 6
  belong to an unmerged sibling slice, 1 is a known cold-start instance. Three of the documented stale specs
  now **pass** because this PR re-points them off the retired control.
- **Live** — the running image was driven directly to capture the real response shape and to prove the
  fail-closed behaviour end-to-end. That is also how an overclaim in this PR's own API description was caught:
  an out-of-range depth clamps, but a wrong-*typed* one is a 400, and the published description now says so.
- **Performance** — the indexes in `V0_0_101` are measured, not assumed (lineage `child_oddrn` 880 ms → 22 ms;
  `ownership(owner_id)` 107 ms → 4.9 ms), and the scope predicate's shape was corrected *before* implementation
  by a measurement that showed the originally-planned `= ANY(array)` costing 54 443 ms against 249 ms for the
  sub-select form. One "obvious" optimisation was rejected for measuring slower. **Scope of that evidence,
  stated plainly:** those runs used probe SQL on a dense fixture, not the complete shipped query at catalog
  scale — the code comment says exactly that, and the remaining confirmation is tracked rather than implied.

## Docs

`Docs: documentation@release/1.0.0 — publishes with the 1.0.0 release.` The `search.md` section describing a
nine-tab result strip is retired (it documented a surface that no longer exists), replaced by the two sidebar
filters that really scope by kind/class plus a new My-data section carrying the partial-result warning;
`catalog-overview.md` gains the deep-links and the corrected column names.

Milestone: 1.0.0
