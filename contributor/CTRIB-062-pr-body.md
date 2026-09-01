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

### And then the gate was taken on the query the platform actually issues

Everything above is **plan-time probe SQL**. A predicate measured in isolation is not the query the service
builds, so the gate was re-run against a running platform: a LOGIN_FORM stack on this branch's image, a real
user-owner binding, **120 000 indexed assets**, 30 000 lineage edges, and `auto_explain` capturing the plans
PostgreSQL *executed* — scope genuinely resolved (`scopeTruncated: true`, `NODE_CAP`, `total: 10000`).

**The shape holds in the shipped query.** The concern was that once three left joins, kind guards, facet
semi-joins, sort and keyset pagination are present, the FTS bitmap might stop driving and every number above
would describe a query the platform never issues. It does not:

```
->  Bitmap Heap Scan on asset_search_entrypoint        (actual time=99.1..216.0 rows=10000)
      ->  Bitmap Index Scan on asset_search_entrypoint_search_vector_gin_idx
                                                       (actual time=74.9 rows=120000)
            Index Cond: (search_vector @@ to_tsquery('...'))
```

The GIN index drives, 120 000 candidates come back, and the scope is applied as a **filter on the bitmap heap
scan**, narrowing to exactly 10 000 — not a separate join, not a per-row rescan. Ranked page: **507.77 ms**.
The lineage hops never crossed the 200 ms logging threshold, so `V0_0_101` is doing its job.

**The latency target was missed — and was also mis-specified.** Warm, on that stand:

| request | measured |
|---|---|
| depth 3, cap-reaching scope | **1.51 - 1.76 s** |
| depth 1 — the default | 0.72 - 0.91 s |
| `MY_OBJECTS` only (uncapped semi-join, no walk) | 0.23 - 0.29 s |
| **unscoped**, same 120k catalog | **1.17 - 1.25 s** |

The original target was "under a second at the ceiling". An **unscoped** search over the same catalog is
1.23 s, so that number was unreachable for *any* search at this scale — it was projected from probe SQL that
omitted the `count(*)` and the joins. The target is therefore restated as the scope's **marginal** cost, which
is the part this change controls: **1.32x** an unscoped search at the ceiling, and **0.69x** at the default
depth — i.e. scoping is *faster* than not scoping, because it narrows. Per-statement, the dominant cost is the
pre-existing `count(*)` (median 274 ms, max 397 ms), which every search pays with or without a filter; that is
filed separately rather than absorbed here.

**Read those figures as per SCROLL PAGE, not per search.** The scope resolver re-runs on every
infinite-scroll page — the request shape is identical — so ~1.6 s at the ceiling is what each page of
results costs, not a one-off. At the default depth 1 that is 0.72-0.91 s per page, below the unscoped
baseline. Stating it explicitly because "1.6 s once" and "1.6 s per scroll" are different product facts,
and the resolved scope is deterministic for a given URL state, so caching it per request-state is the
obvious lever if the ceiling case ever needs to get cheaper.

**One optimisation was tried after that and reverted, because measuring it destroyed it.** The walk's
ODDRN-to-id lookup was moved to the same array-bind shape, reasoning from the note above. Direct SQL A/B, same
database, same 10 000 oddrns, `EXPLAIN ANALYZE`:

```
.in(collection)         planning 19-24 ms   execution 115-149 ms   (~150 ms)
IN (SELECT unnest(?))   planning  7    ms   execution 207-217 ms   (~220 ms)
```

~70 ms **slower**. The two call sites are opposite access patterns — the ranked query matches 10k ids against a
120k-row FTS bitmap where a hashable semi-join wins; this one does 10 000 *exact lookups on a unique btree
index*, where constants known at plan time are what the planner wants. So the array-bind note is **not** a
blanket rule; the numbers and an explicit "tried, measured, reverted - do not re-apply by analogy" now sit on
that method.

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
  (matching the documented posture of the Recommended panel, the twin surface); rendered greyed-out for a
  signed-in user with no Owner binding **with the remedy as a link** to the owner-association page, because
  that user has a fix and neither hiding it nor merely naming it gets them there.
- **Back-compat (ADR D9):** `my_objects` still works — when `my_data` is absent it reads as `[MY_OBJECTS]` — so
  bookmarked `?my=true` URLs and saved searches stored before this keep working. `/api/search` and the per-kind
  searches are untouched.
- **i18n across all 7 locales**, including *removing* the two inverted keys (key-parity guards parity, not
  orphans).

## Two user-visible defects an independent review pass caught, fixed here

Both were live in the first draft of this PR and neither was covered by a test.

**A timed-out scope printed a bare total next to its own warning.** On the wall-clock circuit breaker the
resolver returns an empty id set with the lineage directions still *selected*, so the predicate turns them
into `false` — the lineage half contributes no rows. But the header excluded `TIMEOUT` from the "partial"
qualifier, so with only Upstream or Downstream ticked a user saw:

```
0 results
Your My data scope could not be resolved in time, so it was not applied.
```

Both halves wrong, in the same direction this whole mechanism exists to prevent: "Downstream of my data ->
0 results" reads as *nothing depends on my assets*, and the copy then sends the reader looking for an
unfiltered catalog they are not being shown. Both truncation reasons mean the true set is a strict superset of
what is on screen, so both now qualify the count, and the timeout copy says what actually happened. Locked by
a new component test that is **red on the pre-fix component** (3 of its 8 cases fail there; the 5 that assert
unchanged behaviour pass on both sides, which is what makes them guards rather than restatements).

**Ticking "My Objects" silently switched off the Type filter** — and the Create-Data-Entity-Group button with
it. `getSearchEntityClass` opened with `if (search.myObjects) return 'my'`, and both surfaces gate on that
selector returning a number. That was *correct* while "My Objects" was one option in a one-of-N result tab
strip: picking it was mutually exclusive with picking a class by construction. This PR retires that strip and
makes the owned scope an ordinary sidebar filter three rows below **Data entity type**, so "My Objects +
Datasets" is now an ordinary two-checkbox combination — in which a filter the user never touched vanished with
nothing on screen to explain it, and the page this PR ships said the opposite. The short-circuit existed only
to serve the retired tab, so it is gone. `my_objects` itself is untouched and still rides the legacy
`/api/search` session exactly as before.

The same pass also removed a *dead-and-dangerous* branch in the facet reducer: its only writer was the tab
handler, but had any generic facet control ever dispatched `entityClasses`, it would have reset `myObjects` to
false and dropped the user's scope from the session without a trace.

## Scope exclusions

Deferred with a tracked home, not silently dropped: per-option counts on the filter (three extra aggregates per
search on the slice that already carries the perf gate — ships only with measured evidence); giving query
examples an ownership model; the pre-existing gap where saved searches drop the Asset-type selection; and the
`data-lineage.md` self-contradiction about "Upstream dependents". The public scope note on #1842 states all of
these.

## Verification

- **Unit** — full `:odd-platform-api:build`, the CI replica: **774 tests, 2 failed**; `checkstyleMain`,
  `checkstyleTest`, `assemble` and `bootJar` all green. Both failures are 60-second *bounds*, not assertions
  (`OpenApiDocsContractTest.platformApiGroupDocumentLoads`, `LoadIngestionTest.testInjectingManyDataEntities`),
  and both were settled by an A/B with the decision rule fixed **before** the run: the same targeted pair, same
  box, on this branch and on its merge base — **both arms green, 4/4**, so they are load-driven. The raw A-vs-B
  timings are deliberately *not* quoted as a regression: every measurement including the control moved ~1.6x,
  so the arms ran at different load; normalised against the control the subjects move 1.037x / 1.049x / 0.938x.
  The hypothesis a reviewer would reasonably raise — this PR adds three indexes and `LoadIngestionTest` is
  write-heavy over those tables — is disproved by that same data: the subject moved 3.7% more than the control
  while the sibling ingestion test moved 6% *less*. 27 new behavioural tests against a real Postgres and real wiring: direction
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
- **Frontend** — `tsc` clean; **175/176** vitest (the one failure is an unrelated `Management` timeout, proved
  change-independent by running it alone on both this branch and the merge base: 2/2 green on each, red only
  in-suite under load). URL-contract tests assert against real serialiser output rather than an assumed shape.
  **ESLint is now 0 errors and 0 warnings across every file this PR touches** — it had never been run on this
  surface, and it caught a dead `eslint-disable` directive for a rule this config does not enable.
- **Integration** — two new protocols, both run, both green. `IT-152` (4/4) covers the URL contract's
  survival of a facet toggle (the #1858 mirror-merge class), the retired strip, the count, and the
  `auth.type=DISABLED` posture. `IT-153` (4/4) is the half that needs an identity: a real form login against a
  seeded owner association, proving each scope actually NARROWS (owned / upstream / downstream are not
  interchangeable), that per-direction depth is honoured, and that the home panels deep-link into the filter.
  Three existing suite-registered specs were re-pointed off the retired control rather than left red.
  `IT-152` is now **5/5**, the fifth case pinning that "Clear All" clears the scope and its depths while
  leaving the query and the sort — a deliberate change to a shipped control that previously had no assertion
  at any level.
- **Full regression** — all four suites on a SUT built from this branch: `feature-complete` 328 passed /
  12 failed, `known-bugs` 3 RED (its pass condition, with no unexpected greens), **`multi-stack` 13 passed** (but see the known-issue section below — it is not reliably green),
  `ingestion-e2e` 15 passed. Every `feature-complete` failure is reconciled by **exact `spec:line`** rather
  than by arithmetic: 11 are the documented stale-spec class (specs still gating on
  `GET /api/search/{id}/results`, which ST-4 retired) and 1 is a known cold-start instance — **zero
  unattributed**. Three of the documented stale specs now **pass** because this PR re-points them off the
  retired control. `multi-stack` matters here: an earlier run of it ended red on one of this PR's own new
  specs, and that was fixed and then re-verified **as a whole suite in one process**, because the defect's own
  root cause was that it only surfaces in suite context — a targeted re-run could not have proved it.
- **Live** — the running image was driven directly to capture the real response shape and to prove the
  fail-closed behaviour end-to-end. That is also how an overclaim in this PR's own API description was caught:
  an out-of-range depth clamps, but a wrong-*typed* one is a 400, and the published description now says so.
- **Performance** — the indexes in `V0_0_101` are measured, not assumed (lineage `child_oddrn` 880 ms → 22 ms;
  `ownership(owner_id)` 107 ms → 4.9 ms), and the scope predicate's shape was corrected *before* implementation
  by a measurement that showed the originally-planned `= ANY(array)` costing 54 443 ms against 249 ms for the
  sub-select form. **That evidence is no longer probe-only:** the gate has since been taken on the running
  platform at 120 000 assets with `auto_explain` reading the executed plans — the FTS bitmap still drives, the
  latency target was found both missed *and* mis-specified and is restated against the unscoped baseline, and
  a follow-up optimisation of mine was reverted for measuring slower. See the performance section above.

## Known issue at merge time: one of this PR's own tests is flaky in suite context

Stated up front rather than left in a run-log, because it is the one thing here that
should affect the merge decision.

**What happens.** `IT-153` (`my-data-scope-narrows.spec.ts`) — the integration test that proves the My Objects
scope stops returning other people's terms — fails roughly **one whole-suite run in three**, and only when the
`multi-stack` suite runs as a suite. Run on its own it passes every time. When it fails, it fails in its own
readiness gate: the seeded fixture never becomes searchable on the freshly-booted LOGIN_FORM stack within 90
seconds.

**Sample so far: green, red, green.** Three whole-suite runs across two sessions, on two independently-built
images. It is a race, not a broken assertion — the feature itself is not implicated, and every other suite
reconciles exactly.

**What I could not do.** I could not find the cause, and I would rather say so than ship a plausible-looking
fix. Three explanations were argued and each was ruled out *by the source*: there is no background indexing
race (`V0_0_98` keeps `asset_search_entrypoint` in step with **synchronous** AFTER triggers); the generated
`search_vector` cannot be nulled by the seed (`V0_0_14` wraps every term in `coalesce`); and the stack
readiness probe cannot accept a half-started platform (health details are off, so the body is exactly
`{"status":"UP"}`). The database client also opens a fresh connection per call, so a stale pool is out too.

**What I did instead.** Made the next failure name its own cause. The readiness gate now reads every layer
between the seed and the screen *at the moment it fails, while the stack is still up* — migration state, the
row itself, the legacy entrypoint, the unified index, and the API's own answer — and prints which one lost the
row. It also asserts the fixture reached the unified index immediately after seeding, so a seeding problem
reports at the seed rather than ninety seconds later at the UI. Previously the stack was torn down before
anyone could look.

**The decision this leaves you.** Either merge accepting a known ~1-in-3 flaky spec that will now diagnose
itself the next time it goes red, or hold the slice until an occurrence is caught and fixed. I have not closed
it by declaring it closed.

## Docs

`Docs: documentation@release/1.0.0 — publishes with the 1.0.0 release.` The `search.md` section describing a
nine-tab result strip is retired (it documented a surface that no longer exists), replaced by the two sidebar
filters that really scope by kind/class plus a new My-data section carrying the partial-result warning;
`catalog-overview.md` gains the deep-links and the corrected column names.

Milestone: 1.0.0
