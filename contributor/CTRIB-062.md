---
id: CTRIB-062
title: "#1842 ST-8 — My-data filter (All / My Objects / Upstream / Downstream; per-direction depth) + retire the My-Objects tab + panel deep-links — own perf gate"
issue: "https://github.com/opendatadiscovery/odd-platform/issues/1842"
parent_epic: 1825
class: "feature — full stack (backend scope resolver + search predicate + FE filter + tab retirement + panel deep-links)"
status: implementing       # GATE 1 APPROVED 2026-08-31; scope comment posted; Phase D
target_repo: odd-platform
milestone: "1.0.0"        # G-C11 PASS — live GET issues/1842 2026-08-30: milestone 1.0.0, state OPEN, semver, due 2026-07-31
slice: "ST-8 of #1825"
base_sha: "82e7e70e"      # odd-platform origin/main at intake (= #1862 ST-5c merged)
reproduced: "n/a at intake — feature-shaped slice, so the entry gate is spec-gate (G-C17), not reproduce-first. Baseline observations of the CURRENT my_objects behaviour are captured in ## Baseline observations and proved RED in Phase D."
adr_required: false       # covered by the approved spine ADR adrs/drafts/unified-asset-search.md D4 + D8; no new architectural decision
plan_approved_by: "RamanDamayeu"
plan_approved_at: "2026-08-31"
pr_url: null
docs_routing: "release/1.0.0 train (unreleased behaviour) — branch docs/CTRIB-062-my-data-filter off origin/release/1.0.0; paired backlog item DOC-504 (id re-verified at write time). Push to the shared train is maintainer-gated (DOC-495/497 precedent)."
stream: ctrib062
---

# CTRIB-062 — #1842 ST-8 — the My-data filter

## Intake

| Field | Value | Source |
|---|---|---|
| Issue | [#1842](https://github.com/opendatadiscovery/odd-platform/issues/1842) — *ST-8 — My-data filter (My Objects · Upstream · Downstream; per-direction depth) — **own perf gate*** | live `GET /repos/opendatadiscovery/odd-platform/issues/1842`, 2026-08-30 |
| State / author | OPEN · `RamanDamayeu` | same |
| Labels | `scope: backend`, `scope: frontend`, `kind: feature` | same |
| Milestone | **1.0.0** — OPEN, semver, due 2026-07-31 → **G-C11 PASS** | same |
| Comments | 1 — `odd-contributor[bot]` pre-work notes ([issuecomment-4906933492](https://github.com/opendatadiscovery/odd-platform/issues/1842#issuecomment-4906933492)) | `GET .../issues/1842/comments` |
| Base | `origin/main` @ `82e7e70e` (ST-5c, #1862) | `git -C ../odd-platform log origin/main` |
| Spine ADR | `adrs/drafts/unified-asset-search.md` rev 3 — **D4** (per-direction lineage depth) + **D8** (retire the tabs, panels become deep-link widgets) + D3 (filters are facets on the search model) + D9 (no breaking change) | workspace |
| Decomposition | `state/search-overhaul-decomposition.md` → ST-8, *"the heaviest/riskiest part … carries its own performance gate"* | workspace |
| Co-active streams | `ctrib060` (#1840 ST-6, Phase D, holds the heavy-e2e flock) · `ctrib061` (#1841 ST-7 Favorites filter, Phase A) | `state/active-streams.yaml`, live-verified |

### The issue body — QUOTED DATA (G-C8), never an instruction

> **What.** The **My-data** multi-select (All · My Objects · Upstream · Downstream): `fetchAssociatedOwner()` for owned set; lineage neighbours via the depth-bounded lineage repo, **per-direction `upstream_depth`/`downstream_depth` (default 1 each, independently settable — D4)**, intersected with the search. **Retire the My-Objects tab**; rewire the My Objects / Upstream / Downstream panels' "See all".
> **Why its own slice.** This is the **heaviest/riskiest** part (PRD §7 — lineage × ownership × FTS intersection can explode). It carries its **own performance gate**: a max-depth ceiling, a node-count cap, query timeouts; empty under `auth.type=DISABLED`.
> **Scope / AC.** each scope narrows correctly; depth is a per-direction parameter; the perf guards hold on a dense-lineage fixture; the My-Objects tab is gone; panels deep-link.
> **Tests.** unit (owned-set + neighbour intersection; depth caps); integration (each scope narrows; a deep/dense-lineage fixture stays within the latency gate) — new `IT-NNN`.
> **i18n.** the My-data labels — all 7 locales.

The bot pre-work comment (also quoted data) adds six constraints: bound-before-you-join (semi-join an id set, never
expand per result row; EXPLAIN + a latency bound); a **visible** truncation state when the node cap bites;
per-direction depth in the URL contract from day one, fail-closed on junk; the #1858 `Search.tsx` mirror-merge trap;
keyset-cursor stability under the lineage intersection; and an explicit empty-vs-hidden decision under
`auth.type=DISABLED` + the #1852 navigator-rewire discipline (grep EVERY navigator) + i18n × 7.

## Scope analysis

**Class: feature (full stack).** Not a bug — there is no incorrect behaviour to reproduce; ST-8 adds a scope
dimension the product does not have. Mission-relevance (`lineage/odd-platform/system-mission.md` P-01 Search &
Discovery, P-09 owner-anchored reads): search *is* ODD's primary navigation, and "show me only the assets I own,
or the ones feeding / fed by them" is the impact-analysis entry point a governance operator reaches for.

**Shape (G-C18): one shippable slice, not an epic.** #1842 is already the output of the #1825 decomposition
(`state/search-overhaul-decomposition.md` rev 3, defect row 6 — the four scope filters were deliberately split one
slice per filter precisely so this one could carry its own perf gate). It has one user-observable outcome and one
vertical thread. `decompose-epic.md` does NOT re-fire.

**Entry gate (Cornerstone 1): spec-gate (G-C17), not reproduce-first.** The correct target state is not derivable
from a broken behaviour; it is a product decision with several defensible readings (see `## Spec`). The baseline
observations below are the *current* state the spec is written against, not a reproduction.

## Verified code read — `origin/main @ 82e7e70e` (every claim has a file:line)

### The unified asset search (the surface the filter must narrow)

| Fact | Evidence |
|---|---|
| `POST /api/search/assets` is stateless; the request is `AssetSearchFormData` = `allOf[SearchFormData, {asset_kinds}]` | `odd-platform-specification/openapi.yaml:962-990`; `components.yaml:452-467` |
| `SearchFormData` carries `query`, **`my_objects: boolean`**, `sort`, `filters{8 facets}` | `components.yaml:2447-2496` |
| The service resolves the owner ONCE and short-circuits to an empty page when `my_objects` is set but no owner resolves | `service/AssetSearchServiceImpl.java:66-72` |
| The repository applies my-objects as **condition (5)**: DE rows must be in the owner's `ownership` set; **non-DE rows PASS THROUGH** | `repository/reactive/ReactiveAssetSearchRepositoryImpl.java:302-310` |
| Precedent for "a DE-only facet excludes the non-DE kinds outright" — condition (7) | same file, `:337-347` |
| Precedent for a page-bounded id semi-join into the ranked query — condition (6) `DATA_ENTITY.ID.in(deFacetMatches)` | same file, `:312-336` |
| Sort/keyset/relevance-offset all resolve from one `SearchSortDto`; cursor decodes fail-closed | `AssetSearchServiceImpl.java:60-63`, `dto/AssetSearchCursor.java` |

**Consequence, verified in code:** today `my_objects=true` on the cross-kind search returns *my data entities **plus
every term plus every query example in the catalog***. That is not a "My Objects" result set. Making it narrow
correctly is inside ST-8's own AC ("each scope narrows correctly").

### Ownership + lineage (the sets the filter is built from)

| Fact | Evidence |
|---|---|
| Data entities own through `ownership(data_entity_id, owner_id)` | `V0_0_1…`; used at `ReactiveAssetSearchRepositoryImpl.java:306-309` |
| **Terms own through `term_ownership(term_id, owner_id)`** (hard-delete since V0_0_76 — no `deleted_at`) | `db/migration/V0_0_35__add_terms.sql:29-43`, `V0_0_76__term_relations_hard_delete.sql:16-24` |
| **Query examples have NO ownership** — only `data_entity_to_query_example` | `db/migration/V0_0_84__create_query_example.sql:1-23` |
| Lineage is an oddrn-keyed edge table traversed by a `WITH RECURSIVE … UNION ALL` CTE with **no cycle/visited guard** — only the depth bound stops it, and **every path is a row** | `repository/reactive/ReactiveLineageRepositoryImpl.java:132-160` |
| `LineageDepth.empty()` = depth **-1** ⇒ `t.depth(1) < -1` is false ⇒ the recursive term NEVER fires ⇒ the existing home panels are **exactly 1 hop** | `dto/lineage/LineageDepth.java:16`, `ReactiveLineageRepositoryImpl.java:158` |
| The home panels' neighbour set **excludes the owned set itself** | `service/DataEntityRelationsServiceImpl.java:33-38` (`.filter(Predicate.not(oddrns::contains))`) |
| UPSTREAM anchors on `LINEAGE.CHILD_ODDRN in (owned)` ⇒ returns the entities **my objects depend ON**; DOWNSTREAM anchors on `PARENT_ODDRN` ⇒ the entities **fed by** mine | `ReactiveLineageRepositoryImpl.java:139-141` |
| The public lineage-graph endpoint's `lineage_depth` has `minimum: 1` and **no maximum** | `openapi.yaml:1601-1608` |

### The surfaces to change

| Fact | Evidence |
|---|---|
| The result tab strip is down to **All + My Objects**; ST-4 left a comment naming ST-8 as the owner of the retirement | `components/Search/Results/SearchResultsTabs/SearchResultsTabs.tsx:16-20,33-36` |
| The tab hint (`totals.all` / `totals.myObjectsTotal`) is the **only** place the result COUNT is shown on `/search` | same file `:33-36`; `Search/Results/Results.tsx:148-156` (no other count render) |
| The My-Objects tab writes the `entityClasses` pseudo-facet, which mirrors to `?my=` | `Results.tsx:124-146` |
| `Search.tsx`'s facet→URL mirror rebuilds the URL from redux and **merges back the URL-only params** (`entityClasses`, `sort`, `assetKinds`) — a URL-only param NOT in that merge is silently dropped by any sidebar toggle (**the #1858 trap**) | `components/Search/Search.tsx:96-115` |
| The URL contract + fail-closed parsing live in one module; `assetKinds` is the template for a URL-only, allow-listed param | `lib/search/searchUrlState.ts:26-44,140-215` |
| `FixedOptionsMultiFilter` is the **existing** standard multiselect for a fixed, non-server-aggregated option set (used by Asset type + Data entity type) | `components/Search/Filters/FilterItem/FixedOptionsMultiFilter/FixedOptionsMultiFilter.tsx:24-33`; `AssetTypeFilter/AssetTypeFilter.tsx:9-58` |
| The three home panels (**My Objects · Upstream dependents · Downstream dependents**) have **NO "See all" / "View all" link at all** — only Favorites and Recently-Viewed do | `Overview/OwnerAssociation/OwnerEntitiesList/DataEntityList/DataEntityList.tsx` (whole file — no link); `FavoritesColumn.tsx:93-97`; `RecentlyViewedColumn.tsx:24` (*"there is no 'View all' yet"*) |
| `useNavigateToSearch()` is the existing canonical navigator to the param URL (the #1852 pattern) | `lib/hooks/useNavigateToSearch.ts` |
| All 7 locales already carry `My Objects`, `Upstream`, `Downstream`, `Upstream dependents`, `Downstream dependents` | `locales/translations/{en,br,ch,es,fr,hy,ua}.json` — verified per key |

**The issue says "rewire" the panels' "See all"; the verified truth is there is nothing to rewire — the link must be
ADDED.** Recorded here so the plan's wording matches the code, not the ticket.

### Blast radius outside odd-platform

| Fact | Evidence |
|---|---|
| Retiring the My-Objects tab **breaks an existing green e2e assertion** | `integration-tests/e2e/specs/multilingual-i18n.spec.ts:318,329-335` (asserts the "My Objects" **tab** renders + translates under `ua`) — protocol `IT-102` |
| `IT-068` describes the strip as a 9-tab class filter (already stale after ST-4) and `IT-151` exercises the class tab | `integration-tests/protocols/IT-068…md:1-30`, `IT-151…md:16-30` |
| The published manual still documents a **9-tab strip incl. My Objects** on the `release/1.0.0` train | `documentation@origin/release/1.0.0:docs/data-discovery/search.md:31-49` |
| The broader ST-3/4/5 doc debt is already tracked | `backlog/docs/DOC-499.md` |
| Ontology nodes in the blast radius | `lineage/odd-platform/feature-flows/detail/{F-015 (My-Objects anchor reads), F-017 (Search filter facets), F-148 (Search result class-tab filter)}.yaml` |

## Baseline observations (the current state the spec is written against)

1. `?my=true` narrows only DE rows; terms + query examples are returned unfiltered (`ReactiveAssetSearchRepositoryImpl.java:302-310`). **To be proved RED in Phase D** by a new case on `AssetSearchServiceIntegrationTest`.
2. There is no upstream/downstream scope on search at all — the only lineage-scoped surfaces are the two home panels, fixed at 1 hop.
3. Under `auth.type=DISABLED` every my-scoped surface returns empty with **no signal** (`IT-055`, `IT-056` pin this as a defect class, not a feature).

## Spec (G-C17 — the WHAT, falsifiable)

Grounded in: the spine ADR (D3/D4/D8/D9 + the Cross-cutting perf/security gates), the decomposition's ST-8 entry,
the verified code read above, the live manual (`search.md`, `catalog-overview.md`, `alerting.md`, `data-lineage.md`
on `documentation@origin/release/1.0.0`), and the SME consult
`lineage/odd-platform/sme-consultations/2026-08-30-my-data-scope-filter.md`.

### R1 — A My-data scope group narrows the cross-kind search

| | |
|---|---|
| **Current** | `/search` offers a boolean My-Objects **tab**. It scopes only DATA_ENTITY rows to the caller's `ownership`; TERM and QUERY_EXAMPLE rows pass through unfiltered (`ReactiveAssetSearchRepositoryImpl.java:302-310`). There is no lineage-direction scope on search at all. |
| **Target** | The Filters sidebar carries a **My data** group with three additive, OR-ed checkboxes — **My Objects**, **Upstream of my data**, **Downstream of my data**. Zero ticked = no narrowing (the "All" state). Selecting one or more narrows the cross-kind result to the union of those scopes. |
| **Acceptance** | With entity `A` owned by me, `U → A` and `A → D` lineage edges, and `X` owned by nobody: `My Objects` ⇒ `{A}`; `Upstream of my data` ⇒ `{U}`; `Downstream of my data` ⇒ `{D}`; `My Objects + Downstream` ⇒ `{A, D}`; none ticked ⇒ `{A, U, D, X}`. Verifiable by driving `/search` and by `POST /api/search/assets`. |

### R2 — Ownership is evaluated per kind by that kind's own ownership relation

| | |
|---|---|
| **Current** | "My Objects" returns my data entities **plus every term plus every query example in the catalog** — the filter *widens* the result for 2 of 3 kinds while its label promises narrowing. A live correctness defect on the shipped ST-4 path. |
| **Target** | `My Objects` ⇒ data entities in `ownership` **∪** terms in `term_ownership` for the caller's owner. Query examples have **no ownership model** (`V0_0_84`) ⇒ excluded while any My-data scope is active, with the reason stated in the UI (a caption under the group), never silently absent. `Upstream/Downstream` ⇒ **data entities only** (lineage is DE-oddrn-keyed), so terms and query examples are excluded — the same kind-guarded exclusion condition (7) already applies for DE-only facets (`:337-347`). |
| **Acceptance** | Seed a term I own + a term I do not + a query example. `My Objects` returns my DE and my term, and neither the other term nor the query example. The sidebar shows "Query examples have no owner, so they are excluded from My data." |

### R3 — Depth is a per-direction parameter, defaulted 1, ceilinged 3

| | |
|---|---|
| **Current** | No depth parameter on search. The two home panels are hard-wired to exactly 1 hop (`LineageDepth.empty()` ⇒ the recursive term never fires — `ReactiveLineageRepositoryImpl.java:158`, `LineageDepth.java:16`). |
| **Target** | `upstream_depth` and `downstream_depth`, each default **1**, independently settable, **hard ceiling 3** (ADR D4 + SME Q4: DataHub's Impact Analysis defaults to 1 degree "to minimize processor-intensive queries"; ODD's ceiling is lower than a graph view's because a search filter runs per interaction). Each direction's depth applies only when that direction's scope is ticked. A value outside `[1,3]` **degrades to the default** — never a 400, never a 500. *(Corrected after measuring the running system — see `## Live-system verification`. The original wording also claimed a non-integer degrades; that is **false at the API level**, where a wrong-JSON-typed value is a 400 from the deserialiser like any typed field. It is true at the URL level, which is the case that matters: the FE's `parseDepth` drops a non-numeric depth before a request is ever built, so no stale or hand-edited shareable link can produce one.)* **This constrains the wire types** (plan-check W3): `my_data` is declared `array` of **plain `string`** and the depths as plain `integer` with **no `minimum`/`maximum`**, with the token set and the range documented in the description and enforced by a service-side allow-list + clamp. A strict `enum` / `minimum` would make the generated Jackson deserializer reject the value *before* any clamp could run, turning a hand-edited URL into a 400. This is exactly the `SearchFormData.sort` precedent — *"deliberately a plain string rather than a strict enum so an unknown value degrades gracefully to the default instead of failing the request"* (`components.yaml:2453-2460`). |
| **Acceptance** | With a chain `U2 → U1 → A(mine) → D1 → D2`: `Upstream, depth 1` ⇒ `{U1}`; `depth 2` ⇒ `{U1,U2}`; `Downstream, depth 1` ⇒ `{D1}`. `?upstream_depth=99` and `?upstream_depth=abc` both behave exactly as `depth 1` **as URLs** — the first clamps server-side (verified live: HTTP 200), the second is dropped by the URL parser and never reaches the request. |

### R4 — The scope expansion is bounded, and any truncation is a server-declared, visible state

| | |
|---|---|
| **Current** | The lineage CTE is `WITH RECURSIVE … UNION ALL` over **edges**, with no visited-set/cycle guard — cost grows with *path* count, `O(f^d)` per root, and the anchor set is the caller's whole owned set, unpaginated. Nothing caps it. |
| **Target** | The **lineage expansion** is BFS with an explicit visited set (cycle-safe by construction), bounded by depth ≤ 3 and a cumulative **traversed-node budget of 10 000** (the cap the cited DataHub Impact Analysis uses). **The node budget is the ONLY set-determining bound** — it is a function of the spec and the data, so the resolved id set and `scope_truncated` are reproducible for a given URL (ADR D10). A wall-clock budget exists only as a **circuit breaker** and yields a *distinct* outcome, never a partial set wearing the same flag: `scope_truncated: true` + `scope_truncation_reason: TIMEOUT` ⇒ "the scope could not be resolved — reduce depth or narrow your filters". `NODE_CAP` ⇒ a deterministic partial set. The UI (a) renders a **persistent** strip above the results naming cause + remedy, and (b) **qualifies the count** — `N+` / "(partial)", never a bare total. A truncated total presented as a total is a false governance claim (the operator concludes "17 downstream consumers, I've told them all"). **`MY_OBJECTS` is never truncated** — see R2/Design (d): it stays an uncapped SQL semi-join, exactly as today. |
| **Acceptance** | On a dense fixture that exceeds the budget, the response has `scope_truncated: true` + `scope_truncation_reason: NODE_CAP`, the page shows the strip and a qualified count, and **re-running the identical request returns the identical id set** (asserted twice in the same test — the only bound that decided the set was the node budget). EXPLAIN shows an index scan (not a seq scan) for both directions, **and the FTS bitmap scan still drives the ranked query** (the scope semi-join must not become the driver — measurement M3). **Latency bound, named here rather than set by the run that measures it:** at `downstream_depth=3` over a scope that reaches the 10 000-node cap, on a catalog of ≥ 100 000 indexed assets, `POST /api/search/assets` returns in **< 1 s** (plan-time projection: ~0.53 s — M1-M3). |

### R5 — The My-Objects tab is retired and the result count survives it

| | |
|---|---|
| **Current** | The strip is down to **All + My Objects**; ST-4 named ST-8 as the owner of the retirement (`SearchResultsTabs.tsx:16-20`). The tab hint is the **only** place `/search` shows a result count. |
| **Target** | The tab strip is **removed entirely** (a one-tab strip is not a control), and the total moves into the existing results-header band next to the sort control — `N results`, present on the empty state too (`0 results`), qualified when truncated (R4). |
| **Acceptance** | `/search` renders no tab strip; a search shows `N results` matching the number of rows the list can scroll to; an empty search shows `0 results`, not a bare empty list. **And on the legacy `/search/{sessionId}` route too** (plan-check W5): the tab strip renders unconditionally today, whereas the results-header band it is moving into is gated `{!routerSearchId && …}` (`Results.tsx:171`) — so the count element is rendered **outside** that gate, or the count silently disappears on a route D9 keeps alive and `IT-125` exercises. |

### R6 — The three home panels deep-link into the filter

| | |
|---|---|
| **Current** | The **My Objects / Upstream dependents / Downstream dependents** panels have **no** "See all"/"View all" link at all (`DataEntityList.tsx` — the whole component renders no link; `RecentlyViewedColumn.tsx:24` records *"there is no 'View all' yet"*). The issue says "rewire"; the verified truth is **add**. |
| **Target** | Each of the three panels gets a **View all** link (the Favorites-panel pattern, `FavoritesColumn.tsx:93-97`) that navigates through `useNavigateToSearch()` to the canonical param URL with the matching scope pre-set. The two lineage panel captions are corrected to the filter's vocabulary (see the GATE-1 decision) so the label the user clicks matches the filter they land in. |
| **Acceptance** | Clicking **View all** on each panel lands on `/search?my_data=…` with that scope's chip active and the results narrowed accordingly. |

### R7 — The posture when the filter cannot personalise is explicit, never silent-empty

| | |
|---|---|
| **Current** | Under `auth.type=DISABLED`, or for a signed-in user with no Owner binding, every my-scoped surface returns empty with **no signal** — `IT-055` / `IT-056` pin this as a defect class, and `catalog-overview.md:53` documents the twin surface's posture as *"hidden from the home page entirely"*. |
| **Target** | Three distinct states, mirroring what ODD **already publishes** for the twin surfaces: `auth.type=DISABLED` ⇒ the **whole My data group is hidden** (`catalog-overview.md:53`; and `alerting.md:91` hides the My/Downstream/Upstream tabs without an owner binding). Signed in, **no Owner binding** ⇒ the group **renders disabled** with a one-line reason + a link to the owner-association surface (the remedy exists; hiding hides it). Signed in and bound ⇒ enabled; owning nothing yields an honest empty result. |
| **Discriminator — verified to already exist, no contract change** | The two states are distinguishable **today**: `AppInfo.authType` is on the contract (`components.yaml:2787-2793`), served by `AppInfoController` from `@Value("${auth.type}")`, and already consumed in the FE by `useAppInfo()` — `FavoritesColumn.tsx:34` does `const isShared = appInfo?.authType === 'DISABLED'` for this exact purpose. So: `authType === 'DISABLED'` ⇒ hide; else `getIdentity` truthy **and** `getOwnership` falsy ⇒ disabled-with-remedy; else enabled. (`whoami` alone cannot tell them apart — under DISABLED `IdentityController.dummyOwner()` returns identity-present/owner-null, the same shape as a signed-in unbound user — which is why the posture reads `authType`, not `whoami`.) |
| **Acceptance** | On the `odd-minimal` (DISABLED) stack the My-data group is **absent** from the sidebar. On a LOGIN_FORM stack with an unbound user it **renders disabled** with the reason + the association link. Server-side, a My-data scope with no resolvable owner returns an empty page, never an unscoped one (the existing `AssetSearchServiceImpl.java:66-72` short-circuit, extended to the new scopes). Both arms are asserted in `IT-152` against real stacks — not by injecting two props into a component test, which would pass while the running system produced one shape. |

### R7b — "Clear All" clears the My-data scope (a deliberate change to a shipped control)

| | |
|---|---|
| **Current** | `Filters.handleClearAll` rebuilds the URL from `{query, sort, myObjects}` and states verbatim: *"Query, sort and My-Objects are preserved (they are not filters)"* (`Filters.tsx:31-39`). |
| **Target** | The My-data scope **is** a filter — it lives in the Filters panel next to Asset type — so "Clear All" clears `my_data` and both depths along with the facets. `query` and `sort` stay preserved (they are not filters). Surfaced here rather than buried in a key_link (plan-check W4) because it changes a shipped control's behaviour, and it is named in the public scope comment. |
| **Acceptance** | With `?q=x&my_data=…&upstream_depth=2&tags[]=5` active, "Clear All" yields `?q=x` — the scope, the depth and the facet are gone, the query survives. |

### R8 — Additive contract, no break (D9)

`SearchFormData.my_objects` keeps working: when `my_data` is absent, `my_objects: true` is read as `my_data: [MY_OBJECTS]`. Existing saved searches (whose `spec` jsonb carries `my_objects`) reapply unchanged. `/api/search` and the per-kind searches are untouched. Old `?my=true` URLs keep working.

### In scope / out of scope

**In:** the `my_data` + per-direction-depth contract on `SearchFormData`; the bounded scope resolver + its lineage
repository method + the `lineage(child_oddrn)` index; the cross-kind kind-guarded predicate on the unified search;
`scope_truncated` on the response; the sidebar My-data group (+ depth selects, disabled/hidden postures, the
QE-exclusion caption); the URL params + fail-closed parsing + the `Search.tsx` mirror merge; the tab-strip removal +
the results-header count; the three panel **View all** deep-links + the two lineage-panel caption corrections;
i18n × 7; the `search.md` + `catalog-overview.md` doc updates on the 1.0.0 train; `IT-102`'s tab assertion
re-pointed; a new IT; the ontology refresh.

**Out (explicitly, each with its home):**
- **Per-option counts on the filter (`My Objects (23)`)** — the SME's Q7 second half. Needs three extra aggregate
  queries per search on the *heaviest* slice; ships only with measured evidence. → follow-up item.
- **Giving query examples an ownership model** — a product question, not ST-8's (SME "out of scope" line).
- **Applying the lineage scopes to the legacy `/api/search` DE session** — **the earlier justification for this was
  factually wrong and is retracted** (plan-check B2). `/api/search` is *not* unused: `Search.tsx:78-81` dispatches
  `createDataEntitiesSearch` on **every** distinct URL state, `Results.tsx:100-110` will not fetch the cross-kind
  page until that session reports `searchFiltersSynced && searchId`, and `Filters.tsx:75` gates the `Type` facet on
  `getSearchEntityClass`, which returns `'my'` **iff `search.myObjects`** (`dataentitySearch.selectors.ts:113`). The
  correct posture, verified: **the DE-session request stays byte-identical to today** — `searchUrlStateToFormData`
  keeps emitting `myObjects: true` whenever `MY_OBJECTS` is among the selected scopes, so the sidebar, the `Type`
  facet rule and the session gate behave exactly as they do now, and `my_data`/the depths ride along as fields
  `/api/search` simply does not read (stated in their OpenAPI descriptions). **Named limitation, pre-existing:** the
  sidebar's facet option counts are catalog-wide and are *already* not my-objects-scoped today —
  `getEntityClassFacetForDataEntity(state)` takes no owner (`ReactiveSearchFacetRepository.java:29`) — so with only
  `Upstream`/`Downstream` ticked they describe the unscoped catalog. That is the ontology's existing
  `catalog_wide_count_design_my_objects_not_a_boundary` drift class on `F-017`, not a regression this slice
  introduces, and it is called out rather than left for a reader to discover.
- **`asset_kinds` is not persisted into a saved search** (pre-existing ST-3/ST-4 integration gap found en route —
  `searchUrlStateToFormData` drops it, so `SavedSearchForm` never stores it). → **already tracked as
  `issues/odd-platform/PLT-256`** (filed by the co-active ST-7 stream from the same read); cited, not duplicated.
- **The `data-lineage.md` self-contradiction** about "Upstream dependents" and the wrong `getMyObjectsWith*` OpenAPI
  summaries → follow-up DOC item (the page I am editing is `search.md` / `catalog-overview.md`).
- **Renaming "My Objects" across Alerts / Recommended / docs** — a cross-surface vocabulary change; out.
- **Raising the depth ceiling, or making it configurable** — no config key until measured evidence asks for one.

### Ambiguity report

| Dimension | Weight | Min | Score | Basis |
|---|---|---|---|---|
| Goal clarity | 0.35 | 0.75 | **0.92** | R1-R7 each state current → target → a falsifiable acceptance a human can drive. The only judgment left is the option-label set (GATE-1 decision D1). |
| Boundary clarity | 0.25 | 0.70 | **0.90** | In/out enumerated above, each out-item with a named home. Two scope calls (panel captions, dropping the "All" checkbox) are surfaced, not silently absorbed. |
| Constraint clarity | 0.20 | 0.65 | **0.85** | Perf bounds numeric (depth ≤ 3, 10 000 nodes, wall-clock), the missing `child_oddrn` index verified from the DDL, D9 back-compat stated, the DISABLED/unbound postures anchored to published doc lines. Residual: the exact latency number is set by measurement in Phase D, not assumed here. |
| Acceptance clarity | 0.20 | 0.70 | **0.88** | Every requirement has a concrete arrange/act/assert a human can execute; the perf gate's evidence form (EXPLAIN + measured latency on a dense fixture) is named. |

`ambiguity = 1 − (0.35·0.92 + 0.25·0.90 + 0.20·0.85 + 0.20·0.88) = 1 − 0.893 = ` **0.107 ≤ 0.20 — GATE PASSED**, every dimension above its minimum.

**Residual carried to GATE 1 (not silently absorbed):** the option-label set (D1 below). Nothing else needs the maintainer.

## Product critique of the change request (G-C16)

The issue's framing is sound and I am **not** proposing a reshape — but three of its sentences are wrong or
under-specified against the verified code, and one of its own enumerations is self-contradictory.

1. **"Rewire the … panels' 'See all'."** There is no "See all" on those panels to rewire (`DataEntityList.tsx`).
   The work is to **add** it. Restated in R6; no scope change, but the plan must not inherit the ticket's wording.
2. **"multi-select (All · My Objects · Upstream · Downstream)"** mixes a *reset state* with three *additive scopes*.
   Shipping "All" as a fourth checkbox creates the classic contradictory selection (All + Upstream both ticked).
   **Zero ticked is All** — which is also exactly how the existing `FixedOptionsMultiFilter` behaves, so the correct
   product shape and the reuse candidate agree. Recorded in the public scope comment.
3. **The issue is silent on the cross-kind semantics**, and the shipped ST-4 behaviour there is a defect: "My
   Objects" currently *widens* the result for terms and query examples. Closing it is inside ST-8's own AC ("each
   scope narrows correctly") and is treated as a launch blocker, not an enhancement.
4. **"Upstream dependents" is a misnomer** and ODD's own manual contradicts itself about it: `data-lineage.md`
   states the correct semantics in its endpoint table and then asserts the opposite two lines later, while
   `catalog-overview.md:58-59` publishes a *third* pair of names ("Upstream/Downstream **Dependencies**"). A
   dependent depends on you — i.e. is downstream — so the upstream panel's caption is factually inverted. Because
   this slice wires those panels *into* the new filter, shipping the mismatch would be a defect I introduce.
5. **Impact analysis is the downstream direction**, and ODD has already published that framing — `alerting.md:62`
   calls the Downstream alert view the *"Impact view — 'what's breaking in systems that consume my data'"*. The
   copy must not describe upstream as "impact".

**Verdict: build as asked, with the three corrections above folded in.** No rescope, no revoke.

## GATE-1 decision (one, with a recommendation)

**D1 — the option labels.** ODD publishes **three** vocabularies for this concept today: `My Objects / Downstream /
Upstream` (the Alerts scope tabs — `alerting.md:54-65`, the closest analogue: same owner anchor, same two lineage
directions), `Upstream/Downstream Dependencies` (`catalog-overview.md:58-59`), and `Upstream/Downstream dependents`
(the code's panel captions). The SME recommends a fourth: `Owned by me / Upstream of my data / Downstream of my data`.

**Recommendation — group heading "My data"; options `My Objects` · `Upstream of my data` · `Downstream of my data`;
the two home-panel captions corrected to the same two lineage labels.** Rationale: keep `My Objects` because it is
ODD's published name on three shipped surfaces and renaming it only in Search would *create* an inconsistency with
the Alerts scope tabs (the reuse key already exists in all 7 locales); replace `dependents` because it is factually
inverted for upstream, contradicted by ODD's own pages, and my deep-links would otherwise land a user on a chip
whose wording disagrees with the panel they clicked. Cost of the recommendation: 2 new i18n keys × 7 locales, and
`catalog-overview.md`'s panel names updated on the same train.

The alternative (adopt the SME's `Owned by me` too) is *clearer standalone* but adds a fourth published name for the
owned scope and needs a cross-surface rename to be coherent — out of this slice.

## Design (G-C12 — the HOW, decided before any code)

### (a) Reuse scan — what already exists that this must conform to, not duplicate

| Need | Existing thing reused | Why it is the right one |
|---|---|---|
| A sidebar multiselect over a small FIXED option set that is not a server-aggregated facet | **`FixedOptionsMultiFilter`** + the `AssetTypeFilter` wrapper (`Filters/FilterItem/FixedOptionsMultiFilter/…tsx`, `Filters/AssetTypeFilter/AssetTypeFilter.tsx`) | Asset type is the exact same shape — 3 fixed options, URL-only param, chips, cleared by the single "Clear All". Building a second multiselect idiom in the same sidebar is the "lighter parallel" anti-pattern (`feedback_search_existing_ui_pattern_before_building`). |
| A single-select control bound to a URL param | **`AppSelect` + `AppMenuItem`**, as used by `SearchSortMenu` | The shipped ODD single-select; the depth pickers are the same shape. |
| Writing a URL-only search param | `paramsToSearchState` → mutate → `searchStateToParams` → `navigate` (the `AssetTypeFilter` / `Filters.handleClearAll` idiom) | Keeps every writer byte-identical to the `Search.tsx` mirror — the equality loop-guard depends on it. |
| A kind-guarded predicate on the unified index | conditions **(3)**, **(4)**, **(7)** in `ReactiveAssetSearchRepositoryImpl` | Established shape: `ASSET_KIND.eq(K).and(<K's predicate>)` OR-chained; non-matching kinds excluded explicitly rather than leaking through the outer join's NULL side. |
| A "View all" panel link | `FavoritesColumn.tsx:93-97` (`MuiLink component={Link} … variant='subtitle2'`) | The shipped Recommended-band affordance; the three panels get the identical control. |
| Navigating to the canonical param URL | **`useNavigateToSearch()`** | The #1852 navigator pattern; guarantees the panel-written URL and the mirror-written URL are byte-identical. |
| Owner resolution + the empty short-circuit | `AuthIdentityProvider.fetchAssociatedOwner()` + the existing `switchIfEmpty(empty page)` at `AssetSearchServiceImpl.java:66-72` | The F-011 single chokepoint; the new scopes extend the same branch rather than adding a second identity path. |
| Graceful degradation of an out-of-range scalar | the `SearchFormData.sort` precedent (`components.yaml:2453-2460`) | Same contract family; a bad `sort` degrades to the default rather than 400-ing, so a bad depth must too. |

**Deliberately NOT reused: `ReactiveLineageRepository.getLineageRelations(roots, LineageDepth, kind)`.** It is a
`WITH RECURSIVE … UNION ALL` over *edges* with no visited set, so its cost is per-path (`O(f^d)` per root) and it is
not cycle-safe — precisely the explosion ST-8 exists to prevent. It stays untouched (the lineage graph view keeps its
behaviour, zero regression surface); the scope expansion gets its own bounded primitive.

### (b) ADR check

`adrs/drafts/unified-asset-search.md` **D4** fixes per-direction depth (default 1, independently settable) and
mandates "a max-depth ceiling + a node-count cap"; **D8** retires the tabs and turns the panels into deep-link
widgets; **D3** puts the filter on the search model; **D9** forbids a breaking change; the Cross-cutting section makes
performance a **release gate**. This slice **conforms** — it adds no architectural decision, so **G-C7 does not fire**
and no new ADR is required. Two ADR-adjacent choices are recorded here rather than in a new ADR because they are
implementation of D4's mandate, not new architecture: the BFS-with-visited-set expansion, and the fixed
(non-configurable) ceiling.

### (c) Impact-dimension checklist

| Dimension | Handled |
|---|---|
| **OpenAPI contract** | `components.yaml`: `SearchFormData` gains `my_data` (an array of plain `string`, token set documented, **not** a strict `enum` — W3) + `upstream_depth` + `downstream_depth` (plain `integer`, **no** `minimum`/`maximum`) and marks `my_objects` deprecated-with-alias; `AssetPageInfo` gains `scope_truncated` + `scope_truncation_reason` (B3). Permissive typing is deliberate and matches the `sort` precedent: a strict enum/range makes generated Jackson reject a hand-edited value *before* the service can clamp it, which would turn R3's "never a 400" into a lie. Additive only (D9). |
| **Generated clients (BE + FE)** | BE: gradle openapi generation — **`$ref`'d `components.yaml` changes are not tracked by the BE gradle task; `build/generated` must be deleted to force regen** (`reference_odd_platform_activity_event_and_spec_codegen`). FE: docker codegen. Both re-run and verified in Phase D; generated sources are gitignored, so nothing is committed. |
| **Every consumer of a changed signature** | `ReactiveAssetSearchRepository.{keysetPage,relevancePage,count}` change `OwnerPojo owner` → the resolved scope. Consumers: `AssetSearchServiceImpl` — **4 call sites, not 3** (plan-check W7): `count` in the depth-cap terminal (`:83`), `relevancePage` (`:90`), `keysetPage` (`:91`), and `count` again inside the `Mono.zip` (`:93`) — plus `AssetSearchKeysetPaginationTest`, `AssetSearchSortIntegrationTest`, `AssetSearchServiceIntegrationTest`. All updated in the same commit. |
| **Migration** | `V0_0_101__lineage_child_oddrn_index.sql` — one additive `CREATE INDEX` (see (e)). Non-destructive ⇒ not a G-C7 hard stop. **Lane check at branch time:** main's max is `V0_0_100`; ctrib060 (ST-6) and ctrib061 (ST-7) are not expected to add migrations, but the number is re-verified against `origin/main` immediately before the commit. |
| **i18n — ALL 7 locales** | `My Objects` / `Upstream` / `Downstream` already exist in all 7 (verified per key). **NEW keys:** the group heading, the two `… of my data` option labels, the two depth-select labels, the QE-exclusion caption, the two truncation-strip strings (`NODE_CAP` / `TIMEOUT`), the unbound-user reason, `N results` / `0 results`. **RETIRED keys** (plan-check W8 — the row previously listed additions only): `Upstream dependents` and `Downstream dependents` become orphans when the panel captions are corrected, and `i18n-key-parity` guards *parity*, not *orphans* — so both are deleted from all 7 files symmetrically in the same commit. Every change lands in `en,br,ch,es,fr,hy,ua` together. |
| **Dead code** | `SearchResultsTabs/` and `SearchTabsSkeleton/` are imported **only** by `Results.tsx` (verified by grep) — both directories are deleted, not left orphaned. **Deliberately NOT deleted:** `dataEntitySearch.slice`'s `myObjects` field and `getSearchEntityClass`'s `'my'` branch. They are not dead — the slice faithfully mirrors the still-live `SearchFacetsData.myObjects` echo, and the legacy `/search/{sessionId}` deep-link (kept by D9) can still load a session whose `myObjects` is true. Only the *writer* (`changeDataEntitySearchFacet`'s `'my'` pseudo-class, `dataEntitySearch.slice.ts:230-236`) becomes unreachable; removing it would ripple into `dataEntitySearch.slice.test.ts` and the `SearchClass` type for no user-visible gain. |
| **Docs** | `search.md` (the whole "Result-class tabs" section dies with my change) + `catalog-overview.md` (panel captions + the new View-all deep-links), on the `release/1.0.0` train. |
| **Ontology** | `F-017` (search filter facets), `F-148` (the class-tab filter this retires), `F-015` (the my-objects anchor reads the panels use). `/enrich --touched` in Phase D **iff** `lineage/**` is clean and unclaimed (R9 is currently contended by ctrib060). |
| **Existing tests broken by the change** | `integration-tests/e2e/specs/multilingual-i18n.spec.ts:312-335` asserts the **My Objects tab** renders + translates — it must be re-pointed at the new My-data filter control (protocol `IT-102` updated in step with it). `IT-068`/`IT-151` reference the class-tab strip; re-read and re-pointed where they touch the retired control. |
| **Security** | The scope is resolved **server-side from the authenticated principal only** — no owner id is ever accepted from the request, so a crafted URL cannot scope to another user's owned set. The URL carries only scope tokens + small integers (no secrets — the D10/D11 rule). A shared link re-evaluates as the recipient. Fail-closed: unknown scope token or bad depth ⇒ dropped/defaulted, never an error. |
| **Product-Owner / SRE lens** | Run via `odd-sme` (`lineage/odd-platform/sme-consultations/2026-08-30-my-data-scope-filter.md`) BEFORE this design; its findings on cross-kind semantics (R2), impact-direction wording (D1), the DISABLED/unbound posture (R7), truncation honesty (R4) and the result count (R5) are folded in above. Its two deferred recommendations (per-option counts; renaming "My Objects" product-wide) are in the out-of-scope list with homes. |
| **Rendered pixels** | A screenshot of the sidebar (group + chips + depth selects + caption), the truncation strip, and the results header is captured and reviewed as a user before the PR leaves draft (G-C12 step 5). |

### (d) The scope resolver — bounded by construction

**`MY_OBJECTS` is NOT resolved into a materialised id set at all** — that would silently regress shipped behaviour
(plan-check B4). Today condition (5) is an *uncapped, planner-optimised* correlated semi-join
(`DATA_ENTITY.ID.in(DSL.select(OWNERSHIP.DATA_ENTITY_ID)…)`, `:306-309`), so an owner of 50 000 entities sees all of
them. Materialising + capping that set would break truth #1 and D9 for exactly the "admin / CI-bot owner of
thousands of entities" the SME flagged. So **only the lineage expansion is budgeted**:

```
resolve(owner, scopes, upDepth, downDepth) -> (neighbourIds, truncated, reason)

  # MY_OBJECTS contributes NO resolver work: it stays a SQL semi-join in the ranked query (uncapped, as today).

  budget   = 10_000 traversed nodes          # the cap DataHub's Impact Analysis publishes — the ONLY set-determining bound
  deadline = now + SCOPE_BUDGET              # a CIRCUIT BREAKER, not a set-shaper: it yields reason=TIMEOUT + no set

  for each selected lineage direction:
      visited = {}
      # hop 1 anchors on a SUBQUERY — the owned set is never materialised or capped, so a huge owned set
      # cannot exhaust the budget before the walk even starts (plan-check B4, second half):
      hop1 = SELECT DISTINCT <other> FROM lineage
             WHERE <anchor> IN (SELECT de.oddrn FROM data_entity de JOIN ownership o ON o.data_entity_id = de.id
                                WHERE o.owner_id = ?)
               AND is_deleted = false
             ORDER BY 1 LIMIT remaining-budget + 1      # ORDER BY => the truncation point is deterministic
      # hops 2..depth anchor on the previous frontier, which is already budget-bounded:
      hop_n = SELECT DISTINCT <other> FROM lineage
              WHERE <anchor> IN (SELECT unnest(:frontier)) AND is_deleted = false
              ORDER BY 1 LIMIT remaining-budget + 1
      visited ∪= hop − visited                          # visited set => cycle-safe, no path explosion
      if budget exhausted   -> truncated = true ; reason = NODE_CAP ; break     (deterministic partial set)
      if deadline passed    -> truncated = true ; reason = TIMEOUT  ; abandon   (no set — the UI says "narrow it")

  neighbourIds = SELECT id FROM data_entity WHERE oddrn IN (SELECT unnest(:visited))
                 EXCEPT the owned ids           # the neighbour set excludes the anchors, per the shipped panels
```

Bound: **≤ 3 hops × 1 query each per direction**, every query indexed and `LIMIT`-ed by the remaining budget — the
worst case is readable off the code, not off a query plan. The neighbour set **excludes the owned anchors**, matching
the shipped panel semantics (`DataEntityRelationsServiceImpl.java:33-38`), so "Upstream of my data" means *the things
feeding mine*, not *mine*.

The predicate handed to the ranked query, kind-guarded in the condition-(3)/(7) style, applied to the **unified
INDEX row** and bound as a **hashable subquery** — never a 10 000-element `IN` list (the
`unbounded_in_clause_anchor_fanout` drift class recorded on `F-015`) and never `= ANY(array)` on the joined base
table (**measured at 54 s** — `## Plan-time measurements` M3):

```
   (ase.asset_kind = 'DATA_ENTITY' AND (
        -- MY_OBJECTS: the UNCAPPED semi-join, byte-identical in shape to today's condition (5)
        [my_objects] ase.asset_id IN (SELECT ownership.data_entity_id FROM ownership WHERE owner_id = ?)
        -- lineage scopes: the budgeted, resolved neighbour set
     OR [up|down]    ase.asset_id IN (SELECT unnest(:neighbourIds))))
OR (ase.asset_kind = 'TERM' AND
        [my_objects] ase.asset_id IN (SELECT term_ownership.term_id FROM term_ownership WHERE owner_id = ?))
```
(the bracketed branches are emitted only for the scopes actually selected; with none selected the whole predicate
is absent, which is the "All" state)

Empty arrays make both branches false — a scope that resolves to nothing returns nothing, never the full catalog.
The predicate deliberately reads `asset_id` off the **index row** rather than the left-joined `data_entity.id`: for a
DE row they are the same value, so the join is unnecessary here, and keeping the predicate off the join is exactly
what preserves the FTS-driven plan (M3 — 249 ms vs 54 443 ms).
The predicate deliberately reads `asset_id` off the index row rather than the left-joined `data_entity.id`: for a DE
row they are the same value, and keeping it off the join is what preserves the FTS-driven plan (M3).

### (e) The index — measured, not assumed

`lineage`'s only indexes are the PK `(parent_oddrn, child_oddrn, establisher_oddrn)` and
`lineage_establisher_oddrn` (`V0_0_2`, `V0_0_17:116-119`; `V0_0_26` only widened the column types; nothing since).
So the **DOWNSTREAM** hop (`WHERE parent_oddrn = ANY(…)`) range-starts on the PK, but the **UPSTREAM** hop
(`WHERE child_oddrn = ANY(…)`) has no usable index and must sequentially scan `lineage` — on every hop, for every
search. `V0_0_101` adds `CREATE INDEX lineage_child_oddrn ON lineage (child_oddrn)`. The before/after `EXPLAIN
(ANALYZE, BUFFERS)` on the dense fixture is captured in the test ledger; if the measurement contradicts this reading,
the migration is dropped and the measurement is recorded instead.

### (f) Where it would silently break (the wiring the plan-check must confirm)

1. `Search.tsx`'s mirror rebuilds the URL from redux and merges back only `entityClasses` / `sort` / `assetKinds`. A
   URL-only `my_data` **not added to that merge** is silently dropped by any sidebar facet toggle — the #1858 class.
2. `assetSearch.thunks.ts` currently maps the response to `{hasNext, lastId}` and **discards `total`**. Without
   extending that mapping the results header can never show a count and `scope_truncated` can never reach the strip.
3. `Filters.handleClearAll` reconstructs the URL from `{query, sort, myObjects}`; a `my_data` not carried there is
   silently wiped (or silently kept) by Clear All — it must be cleared *deliberately*, as a filter.
4. `searchUrlStateToFormData` is what `SavedSearchForm` captures; if `my_data` is not projected there, a saved search
   silently loses the scope (the pre-existing `asset_kinds` defect, repeated).
5. The three panel "View all" links must build the URL through `useNavigateToSearch()`, or a panel-written URL and a
   mirror-written URL diverge and the equality loop-guard misfires.

## Plan

### Commit sequence (one branch `contrib/CTRIB-062-my-data-filter`, per-item commits)

| # | Commit | Files |
|---|---|---|
| 1 | **Contract + migration** — `SearchFormData.{my_data (array of plain `string`), upstream_depth, downstream_depth}` declared **permissively** so a bad token degrades instead of 400-ing (W3), `my_objects` deprecated-with-alias, `AssetPageInfo.{scope_truncated, scope_truncation_reason}` (B3); `V0_0_101` index | `odd-platform-specification/components.yaml`, `…/db/migration/V0_0_101__lineage_child_oddrn_index.sql` |
| 2 | **Backend — the bounded LINEAGE resolver (RED-first)** | new `service/MyDataScopeResolver{,Impl}.java`, `dto/MyDataScopeResult.java` (`neighbourIds`, `truncated`, `reason`); `ReactiveLineageRepository{,Impl}` + `getNeighbourOddrnsFromOwnedSet(ownerId, kind, limit)` (**hop 1 — anchors on a subquery, so the owned set is never materialised** — B4) and `getNeighbourOddrns(frontier, kind, limit)` (hops 2..d); `ReactiveDataEntityRepository{,Impl}` + `listIdsByOddrns`; new `MyDataScopeResolverTest`. **No owned-set materialisation method** — `MY_OBJECTS` never leaves SQL. |
| 3 | **Backend — the search predicate + response flag** | `ReactiveAssetSearchRepository{,Impl}` (owner → scope; kind-guarded array predicate), `AssetSearchServiceImpl` (scope resolution, back-compat alias, depth clamp, `scopeTruncated` on the page info); extend `AssetSearchServiceIntegrationTest` |
| 4 | **Frontend — the URL contract** | `lib/search/searchUrlState.ts` (+ params, fail-closed parse, legacy `?my=` alias, form-data projection), `redux/selectors/dataentitySearch.selectors.ts`, `Search.tsx` (mirror merge), `Filters.tsx` (Clear All), `lib/hooks/useNavigateToSearch.ts`; **three existing test files that assert the old `myObjects` shape and WILL break**: `lib/search/__tests__/searchUrlState.test.ts` (:17,60-110,153,197-215), `lib/search/__tests__/searchFormDataToUrlState.test.ts` (:13,28), `lib/hooks/__tests__/useNavigateToSearch.test.tsx` (:49 — asserts `{myObjects:true}` → `/search?my=true`) |
| 5 | **Frontend — the My-data sidebar group** | new `Filters/MyDataFilter/MyDataFilter.tsx` (+ styles, + `__tests__`), `Filters/Filters.tsx` |
| 6 | **Frontend — retire the tab strip, land the result count + truncation strip** | `Results/Results.tsx`, **delete** `Results/SearchResultsTabs/**` + `SearchTabsSkeleton/**`, `redux/{interfaces,slices,selectors,thunks}` for `total` + `scopeTruncated` |
| 7 | **Frontend — the three panel deep-links + caption correction** | `Overview/OwnerAssociation/OwnerEntitiesList/{OwnerEntitiesList.tsx,DataEntityList/DataEntityList.tsx}` |
| 8 | **i18n × 7** | `locales/translations/{en,br,ch,es,fr,hy,ua}.json` |
| 9 | **odd-team: the new IT + every existing spec the retirement breaks** (plan-check B5 — commit 9 previously named only the i18n spec, which would have left the mandatory FULL regression red or forced unplanned scope) | NEW: `integration-tests/protocols/IT-152-my-data-scope-filter.md`, `integration-tests/e2e/specs/my-data-filter.spec.ts`, `integration-tests/suites.yaml`. RE-POINTED: `e2e/specs/multilingual-i18n.spec.ts` + `protocols/IT-102-*.md` (the tab-strip translation assertion moves to the My-data group's labels); `e2e/specs/search-url-facets.spec.ts` (`:124`, `:133`, `:150` click `role=tab`) + `protocols/IT-151-*.md` — its write/removal surface moves to the sidebar `DataEntityTypeFilter`, and the re-pointed assertion must still be **RED on `ref:main`** and no weaker than the one it replaces (G-C15). RETIRED: `e2e/specs/search-class-tab-filter.spec.ts` + `protocols/IT-068-*.md` — its subject (the class-tab strip) ceases to exist, so the protocol is **superseded with a stated reason and removed from both suites**, never silently green-ified; its PLT-147 null-details regression lock is **preserved by moving that assertion into `IT-152`** so the guard is not lost with the tab. |
| 10 | **odd-team: docs + follow-ups + ontology** | `documentation@docs/CTRIB-062-my-data-filter` (off `origin/release/1.0.0`); `backlog/docs/DOC-503`; the follow-up items; `/enrich --touched` |

### Tests (G-C9 — both buckets, written failing FIRST)

**Unit → odd-platform CI** (`scripts/run-platform-tests.sh`, the full `:odd-platform-api:build`):
- `MyDataScopeResolverTest` (Testcontainers `BaseIntegrationTest`; owner passed explicitly ⇒ no auth mocking, matching the repo's zero-`@MockBean` convention): owned DE + owned term resolution; upstream vs downstream direction correctness on a `U2→U1→A→D1→D2` chain; per-direction depth 1/2/3 independence; the anchor exclusion; **cycle safety** (`A→B→A` terminates and does not duplicate); the node cap firing ⇒ `truncated=true, reason=NODE_CAP`; **determinism asserted as a property** (same spec ⇒ byte-identical id set on two consecutive runs, with the wall-clock breaker proven not to be the deciding bound — B3); a **large owned set** (> the budget) still yielding a non-empty hop-1 frontier (the B4 regression guard); empty owner ⇒ empty scope. Separately, a Mockito test that `MY_OBJECTS` alone invokes the resolver **not at all**.
- `AssetSearchServiceIntegrationTest` extensions: **the RED proof** — `my_objects=true` today returns a foreign term + a query example (asserted to FAIL on `origin/main`, PASS on the branch); each scope narrows; `my_data` supersedes `my_objects`; `my_objects:true` alone still behaves as `[MY_OBJECTS]`; QEs excluded whenever a scope is active; a garbage depth behaves as depth 1; `scope_truncated` surfaces.
- `AssetSearchKeysetPaginationTest` extension: the keyset cursor stays stable and ordered **with a my-data scope applied** (the pre-work note's cursor-stability point).
- FE vitest: `searchUrlState` round-trip for `my_data` + depths; unknown scope token dropped; depth outside 1-3 dropped; legacy `?my=true` → `[MY_OBJECTS]`; `MyDataFilter` renders hidden under DISABLED / disabled-without-owner.

**Integration → odd-team `IT-152`** (`run-suite.sh`, Playwright, `odd-minimal` + a LOGIN_FORM arm):
seed a small owned/lineage graph via `dbQuery`; drive `/search`; assert each scope narrows the **rendered** list, the
chips round-trip through a page reload (shareable URL), a sidebar facet toggle does **not** drop the scope (the #1858
regression guard), the tab strip is gone, the result count renders, a panel "View all" lands pre-filtered, and — on a
**dense** fixture — the request completes inside the stated bound with `scope_truncated` shown as a persistent strip
and a qualified count. Every assertion is written against a **captured real response / observed DOM**, never a derived
shape (CTRIB-023/IT-137 case-law).

### Docs (G-C10 + G-C11)

Read first, then author on the **`release/1.0.0` train** (unreleased behaviour) via a per-stream docs worktree +
branch `docs/CTRIB-062-my-data-filter` off `origin/release/1.0.0`; the push to the shared train is
**maintainer-gated** (DOC-495/497 precedent). Paired backlog item **DOC-503** (`milestone: 1.0.0`,
`status: pending-release`) records the affected pages + expected post-merge URLs.
- `docs/data-discovery/search.md` — **read at `origin/release/1.0.0` before planning this** (`:15-49`). Two edits: (i) the whole **"Result-class tabs"** section (`:31-49`, a nine-tab table incl. `My Objects`) is **retired by this change** — ST-4 removed the seven class tabs and ST-8 removes the last one — and is rewritten as the Filters-sidebar model, adding the My-data group, the per-direction depth, the truncation caveat and the DISABLED/unbound posture; (ii) the **Type** facet bullet (`:22`) still reads *"Only shown after an entity-class tab is selected at the top of the Catalog"* — already false since ST-4, and definitively unfixable-by-reference once no tab exists, so the clause is corrected to the Data-entity-type sidebar filter in the same edit rather than left as a known-false sentence beside a true one.
- `docs/data-discovery/catalog-overview.md` — the three panels' corrected captions + their new "View all" deep-links.

### Scope comment (G-C5 — posted to #1842 immediately after GATE 1, before any code)

The approved plan changes the issue's stated scope in three ways, so a public comment is mandatory: (1) the panels'
"See all" is **added**, not rewired (none exists); (2) the multi-select ships **without an "All" checkbox** — zero
ticked is All, because "All + Upstream" is a contradictory selection; (3) the slice also **fixes the shipped ST-4
cross-kind defect** (terms/query examples passing through "My Objects") and **corrects the two lineage panel
captions**, because the deep-links this slice adds would otherwise land users on a mismatched label. It also states
what is deferred and where: per-option facet counts, query-example ownership, the `asset_kinds`-not-saved gap, and the
`data-lineage.md` self-contradiction. ASCII only, no workspace-internal IDs.

### Follow-ups to log on disk (G-C5 / `follow-up-on-disk.md`) — ids re-verified at write time

Ids re-derived from the canonical trackers **and re-checked against the two co-active streams' uncommitted files**
(three streams are allocating ids concurrently; `feedback_id_enumeration_canonical_tracker_only` + LSN-009).

| Item | What |
|---|---|
| ~~`PLT-257` saved searches drop `asset_kinds`~~ | **ALREADY TRACKED — do not duplicate.** `issues/odd-platform/PLT-256-saved-search-drops-asset-type-filter.md` (committed `3bae4c10`) was logged by the ST-7 stream from the *same* code read, hours before I reached it. I cite PLT-256 in the scope comment instead of filing a second draft. This is exactly the backlog-internal duplication LSN-009 exists to prevent, and it was caught only by grepping the tracker before writing. |
| `DOC-504` | `data-lineage.md` contradicts itself on "Upstream dependents" (its endpoint table states the opposite of its own prose two lines later) and records the wrong `getMyObjectsWithUpstream/Downstream` OpenAPI summaries. Sourced from the SME consult + verified against the live page. |
| `PLT-258` | Per-option counts on the My-data filter (`My Objects (23)`) — deferred pending measured evidence that three extra aggregates per search are affordable on the slice that already carries the perf gate. An odd-platform enhancement ⇒ an issue draft, not a workspace backlog item. |

**Id state at plan time** (re-verify again at write time — they move while three streams run): `DOC-503` and
`PLT-257` were claimed by ctrib061 **as untracked files** while this plan was being written, so mine are `DOC-504`
and `PLT-258`. `TST-060` is free but not needed — neither follow-up is a test gap.

### must_haves (the plan contract — G-C19)

```yaml
must_haves:
  truths:
    - "On /search, ticking 'My Objects' narrows the visible cross-kind list to assets I own — my data entities AND my terms — and no longer shows other people's terms or any query example (Spec R1, R2)"
    - "Ticking 'Upstream of my data' shows the assets feeding mine; 'Downstream of my data' shows the assets fed by mine; ticking two scopes shows their union; ticking none shows everything (Spec R1)"
    - "Changing a direction's depth from 1 to 2 widens only that direction's results; a hand-edited nonsense depth behaves exactly like depth 1 (Spec R3)"
    - "When the scope expansion hits its bound, the page says so in a persistent strip and the count reads as partial - never a bare total presented as complete (Spec R4)"
    - "A search with a My-data scope survives a page reload and a sidebar facet toggle, and reproduces for someone I send the URL to, scoped to THEIR ownership (Spec R1, R8)"
    - "/search shows no tab strip, and still shows how many results matched - including '0 results' on an empty search (Spec R5)"
    - "'View all' on each of the My Objects / Upstream / Downstream home panels opens /search pre-filtered to that scope (Spec R6)"
    - "On an auth-disabled deployment the My-data group is absent; for a signed-in user with no Owner binding it renders disabled and names the remedy (Spec R7)"
    - "An existing saved search or bookmark that used the old My-Objects filter still works unchanged, and a NEW saved search carrying a My-data scope reapplies with that scope intact (Spec R8, R1)"
    - "An owner of tens of thousands of assets still sees ALL of them under 'My Objects' - the owned set is never capped or truncated; only the lineage walk is bounded (Spec R2, R4)"
    - "'Clear All' clears the My-data scope and its depths along with the facets, while leaving the query and the sort alone (Spec R7b)"
    - "At depth 3 over a cap-reaching scope on a 100k+ asset catalog the search still returns in under a second (Spec R4)"
  artifacts:
    - path: "odd-platform-specification/components.yaml"
      provides: "the my_data + per-direction-depth request contract (permissively typed) and the scope_truncated + reason response flags"
      anchor: "scope_truncation_reason"
    - path: "odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/MyDataScopeResolverImpl.java"
      provides: "the bounded, cycle-safe, deterministic owned-set + lineage-neighbour resolution"
      anchor: "MAX_SCOPE_NODES"
    - path: "odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/repository/reactive/ReactiveLineageRepositoryImpl.java"
      provides: "one bounded, ordered, indexed BFS hop - the only new lineage primitive"
      anchor: "getNeighbourOddrns"
    - path: "odd-platform-api/src/main/resources/db/migration/V0_0_101__lineage_child_oddrn_index.sql"
      provides: "the index that makes the upstream hop an index scan instead of a seq scan"
      anchor: "lineage_child_oddrn"
    - path: "odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/repository/reactive/ReactiveAssetSearchRepositoryImpl.java"
      provides: "the kind-guarded scope semi-join on the ranked query, applied to the INDEX row (measured M3)"
      anchor: "unnest"
    - path: "odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/AssetSearchServiceImpl.java"
      provides: "scope resolution, the my_objects back-compat alias, the depth clamp, scopeTruncated on the page info"
      anchor: "scopeTruncated"
    - path: "odd-platform-ui/src/lib/search/searchUrlState.ts"
      provides: "my_data + depth params, fail-closed parsing, the legacy ?my= alias, the SearchFormData projection"
      anchor: "SEARCH_MY_DATA_PARAM"
    - path: "odd-platform-ui/src/components/Search/Filters/MyDataFilter/MyDataFilter.tsx"
      provides: "the sidebar group: 3 scope chips, 2 depth selects, the QE-exclusion caption, the hidden/disabled postures"
      anchor: "FixedOptionsMultiFilter"
    - path: "odd-platform-ui/src/components/Search/Results/Results.tsx"
      provides: "the tab strip removed; the result count + truncation strip rendered"
      anchor: "results"
    - path: "odd-platform-ui/src/redux/thunks/assetSearch.thunks.ts"
      provides: "carries total + scopeTruncated out of the response instead of discarding them"
      anchor: "scopeTruncated"
    - path: "odd-platform-ui/src/components/Overview/OwnerAssociation/OwnerEntitiesList/OwnerEntitiesList.tsx"
      provides: "the three panels' View all deep-links + the corrected lineage captions"
      anchor: "useNavigateToSearch"
    - path: "integration-tests/protocols/IT-152-my-data-scope-filter.md"
      provides: "the e2e protocol: each scope narrows, URL round-trip, facet-toggle survival, panel deep-link, dense-fixture perf gate"
      anchor: "scope_truncated"
    - path: "odd-platform-ui/src/components/Search/Filters/MyDataFilter/MyDataFilter.tsx (posture half)"
      provides: "the three-state posture read from the EXISTING AppInfo.authType discriminator - no contract change"
      anchor: "useAppInfo"
    - path: "integration-tests/e2e/specs/search-url-facets.spec.ts + protocols/IT-151-*.md"
      provides: "re-pointed off the retired class tab onto the sidebar DataEntityTypeFilter, still RED on ref:main"
      anchor: "DataEntityTypeFilter"
    - path: "integration-tests/protocols/IT-068-search-class-tab-filter.md + its spec"
      provides: "retired with a stated reason (its subject ceases to exist); its PLT-147 null-details guard MOVES into IT-152 rather than being lost"
      anchor: "superseded"
  key_links:
    - from: "MyDataFilter (and the three home panels)"
      to: "the /api/search/assets request"
      via: "searchStateToParams -> the URL -> paramsToSearchState -> searchUrlStateToAssetSearchFormData -> searchAssets thunk"
    - from: "Search.tsx facet->URL mirror"
      to: "the my_data + depth params"
      via: "the URL-only merge alongside sort/assetKinds/entityClasses - WITHOUT this, any sidebar toggle silently drops the scope (#1858 class)"
    - from: "AssetPageInfo.total + scope_truncated on the wire"
      to: "the results-header count + the truncation strip"
      via: "assetSearch.thunks mapping -> AssetSearchState.pageInfo -> selector -> Results.tsx (the mapping currently DISCARDS total)"
    - from: "MyDataScopeResolver's resolved id set"
      to: "the ranked query"
      via: "a kind-guarded asset_id IN (SELECT unnest(?)) semi-join on ASSET_SEARCH_ENTRYPOINT in conditions() - never a per-row expansion, never a 10k IN list, and never = ANY(array) on the joined data_entity.id (measured at 54s, M3)"
    - from: "Filters.handleClearAll"
      to: "my_data + the two depths"
      via: "explicit clearing in the reconstructed URL - they are filters, unlike query/sort"
    - from: "SavedSearchForm capture"
      to: "the saved spec"
      via: "searchUrlStateToFormData projecting my_data + depths into SearchFormData - AND still emitting myObjects:true whenever MY_OBJECTS is selected, so the DE session request stays byte-identical to today (B2)"
    - from: "a saved search's stored SearchFormData spec"
      to: "the reapplied /search URL"
      via: "searchFormDataToUrlState (SavedSearches.tsx:43,57) mapping legacy my_objects -> [MY_OBJECTS] and projecting my_data + depths back into SearchUrlState - the REAPPLY direction, which is where PLT-256's class of silent scope loss actually bites"
    - from: "GET /api/info authType (+ whoami's identity/owner pair)"
      to: "the My-data group's hidden / disabled / enabled posture"
      via: "useAppInfo() for DISABLED (the FavoritesColumn precedent) + getIdentity/getOwnership for the unbound case - whoami ALONE cannot separate them (dummyOwner returns identity-present/owner-null under DISABLED)"
```

## Plan-time measurements (Phase-A probe — measured, not assumed)

Run on a throwaway `postgres:13.2-alpine` (**the deployed version** — `docker/demo.yaml`) in this stream's own
namespace (`ctrib062-pgprobe`, no published port, removed after the run; ctrib060's stack and flock untouched).
Fixture: `lineage` recreated with odd-platform's **exact** DDL (`V0_0_2` + the `V0_0_17` 3-column PK + `V0_0_26`
varchar widening + `V0_0_79 is_deleted`), seeded as a dense 6-layer × 400-node graph with fan-out 25 =
**50 000 edges**; plus a 200 000-row `data_entity` + a mirror `asset_search_entrypoint` with its GIN index.

### M1 — the upstream hop is a sequential scan today; the index fixes it

| Hop (200 roots) | Plan | Time |
|---|---|---|
| DOWNSTREAM — `parent_oddrn = ANY(…)` (PK prefix) | Bitmap Index Scan on `lineage_pkey` | **29.95 ms** |
| UPSTREAM — `child_oddrn = ANY(…)` (**no index today**) | **Seq Scan on lineage** | **880.46 ms** |
| UPSTREAM — after `CREATE INDEX lineage_child_oddrn ON lineage(child_oddrn)` | Bitmap Index Scan on `lineage_child_oddrn` | **22.40 ms** |

**39× on a 50 000-edge table.** The `V0_0_101` index is confirmed necessary, not speculative — three upstream hops
would otherwise cost ~2.6 s of pure sequential scanning on **every** search request.

### M2 — the existing `UNION ALL` edge CTE really does explode; the BFS does not

Replicating `ReactiveLineageRepositoryImpl.lineageCte` **exactly**, from the same 200 roots:

| Expansion | Result |
|---|---|
| Existing CTE, depth 2 | **1 157 ms**, **130 000 rows materialised** to yield 800 distinct nodes (a 162× amplification) |
| Existing CTE, depth 3 | **did not complete within a 25 s statement timeout** |
| Planned BFS (visited set, one bounded+ordered query per hop), depth 3 | **~281 ms total** (36 / 68 / 121 ms per hop), 1 400 distinct nodes |

This is the measured justification for **not** reusing `getLineageRelations` — at the ADR's own ceiling the existing
primitive is not merely slow, it does not return.

### M3 — ⚠ the planned scope predicate was WRONG, and the measurement caught it

The design first specified `data_entity.id = ANY(?::bigint[])` on the **joined base table**. Measured on the
200 000-row fixture with a 10 000-id scope:

| Scope-predicate shape | Plan | Time |
|---|---|---|
| **(as originally planned)** `de.id = ANY(array)` on the joined `data_entity` | Hash Right Join, the array re-scanned **per row** | **54 443 ms** |
| `asset_search_entrypoint.asset_id IN (SELECT unnest(?))`, kind-guarded — **on the index row, no join** | Bitmap Heap Scan (FTS-driven) + hashed semi-join | **249 ms** |
| the same scope as an explicit `(kind, id)` JOIN against `unnest` | Nested Loop driving `ase_pkey` | **212 ms** |

**218× — and completely invisible on a small test fixture.** `= ANY(array)` is a scalar array operation Postgres
evaluates linearly *per candidate row*; `IN (SELECT unnest(?))` is a hashable subquery.

**Two design corrections, made here rather than discovered at the perf gate:**
1. The scope predicate is applied to **`ASSET_SEARCH_ENTRYPOINT.ASSET_ID`** — the unified index row — **not** to the
   left-joined `DATA_ENTITY.ID`. For DE rows the two are the same value, so the join is unnecessary for this
   predicate and removing it keeps the FTS bitmap scan as the driver.
2. The bind is **`IN (SELECT unnest(?))`**, never `= ANY(?)`. Recorded in `must_haves` as the artifact anchor.

Budget check with the corrections: 3 BFS hops (~281 ms) + the scoped ranked query (~249 ms) ≈ **0.53 s** at the
worst-case ceiling (depth 3, 10 000-node scope, 200 k-row catalog) — inside a 1 s interactive budget, with the
common case (depth 1) an order of magnitude cheaper. The Phase-D gate re-measures this on the real SUT.

## Parallel-stream coordination (three streams co-active)

`state/active-streams.yaml`, live-verified at intake and again before GATE 1.

| Stream | Work | State when this plan was written | Overlap with ST-8 |
|---|---|---|---|
| `ctrib060` | #1840 ST-6 — `websearch_to_tsquery` query operators | Phase D; **holds the heavy-e2e flock** (`run-regression.sh ctrib060`, pid 248842); stack on 18100/15500 | **Overlap — corrected (plan-check W6; my first reading said "none" and was wrong).** `git diff --stat origin/main contrib/CTRIB-060-search-query-operators` touches `odd-platform-specification/components.yaml` (+9), `AssetSearchServiceIntegrationTest.java` (+145) and **all seven** locale files — the same three surfaces I edit in commits 1, 3 and 8. Semantically independent (its change is the FTS *condition*, mine is the scope predicate) but textually adjacent. My Phase-D regression queues behind its flock (`run-regression.sh` blocks; no contention). |
| `ctrib061` | #1841 ST-7 — Favorites filter | Phase A/C, `plan-pending` | **Direct overlap** — see below. |
| `ctrib062` | **this** | Phase C, plan-check pending | — |

### The ST-7 ∥ ST-8 overlap — real, and mechanically resolvable

Both slices add a *personalised scope filter* to the same sidebar, the same URL contract and the same ranked query.
Read from `contributor/CTRIB-061.md` (its `## 5 Design` / `## 7 Plan`), the shared files are:

| File / symbol | ST-7 (Favorites) | ST-8 (My data) | Conflict class |
|---|---|---|---|
| `components.yaml` | adds `favorites` to **`AssetSearchFormData`** | adds `my_data` + depths to **`SearchFormData`**, `scope_truncated` to `AssetPageInfo` | different schemas — textual only |
| `lib/search/searchUrlState.ts` | `SEARCH_FAVORITES_PARAM` + parse/serialise | `SEARCH_MY_DATA_PARAM` + two depth params | adjacent additions |
| `Search.tsx` mirror merge (`:101-106`) | adds `favorites` to the merge-back | adds `my_data` + depths | **same object literal** |
| `Filters.tsx` (render + Clear All) | mounts `FavoritesFilter` | mounts `MyDataFilter` | same two hunks |
| `ReactiveAssetSearchRepository{,Impl}` — `keysetPage` / `relevancePage` / `count` | threads a new **identity** parameter | replaces `OwnerPojo owner` with the resolved **scope** | **same three signatures** |
| `AssetSearchServiceImpl` | resolves the identity | resolves the scope + the depth clamp + `scopeTruncated` | same method |
| `AssetSearchServiceIntegrationTest` | new favorites cases | new my-data cases | same class |

**Posture:** both branch from `origin/main @ 82e7e70e`; neither depends on the other's behaviour. **Whichever merges
second rebases** — the conflicts are textual (adjacent additions to the same literals/signatures), not semantic, and
the two predicates compose by AND without interacting. I do **not** wait for ST-7: waiting serialises two independent
slices for no correctness gain, and the rebase is minutes of mechanical work. Recorded here so whoever rebases sees
the exact hunk list instead of discovering it.

**One noted difference, deliberately not harmonised here:** ST-7 puts `favorites` on `AssetSearchFormData` (the
`asset_kinds` precedent), so — like `asset_kinds` — it will not be captured into a saved search; ST-8 puts `my_data`
on `SearchFormData` because it **generalises `my_objects`, which already lives there**, and splitting a field from
the deprecated field it supersedes would force a precedence rule spanning two schemas. The underlying class (the
saved-search spec projection dropping `AssetSearchFormData`-only dimensions) is the follow-up logged as `PLT-257`;
it is not ST-8's to fix and is not a blocker for either slice.

## Scope comment — DRAFT (ASCII-only; posts to #1842 immediately after GATE 1, before any code)

> **ST-8 scope note — what this PR will and will not cover**
>
> Working #1842 now. Three corrections to the issue text, and three deferrals, so the thread matches the PR.
>
> **Corrections to the issue as written**
>
> 1. **The home panels have no "See all" to rewire — it will be added.** `My Objects`, `Upstream dependents` and
>    `Downstream dependents` render no "See all"/"View all" link today (only the Favorites and Recently Viewed
>    columns have one). This PR adds one to each of the three, deep-linking into the new filter.
> 2. **The multi-select ships without an "All" option.** "All - My Objects - Upstream - Downstream" mixes a reset
>    state with three additive scopes, so "All + Upstream" would be a contradictory selection. Zero boxes ticked IS
>    All - which is also how the existing Asset-type filter behaves, so the control stays consistent with its sibling.
>    Because the scope is a filter, the Filters panel's "Clear All" now clears it (and its depths) along with the
>    facets; the query and the sort are still preserved, as today.
> 3. **The cross-kind semantics are fixed as part of "each scope narrows correctly".** Today `my_objects=true` on
>    `/api/search/assets` narrows only Data Entity rows: every Term and every Query Example in the catalog passes
>    through unfiltered, so the filter WIDENS the result for two of three kinds while its label promises narrowing.
>    After this PR, ownership is evaluated per kind by that kind's own ownership relation - data entities via
>    `ownership`, terms via `term_ownership` - and query examples, which have no ownership model at all, are
>    excluded while a My-data scope is active, with the reason shown in the sidebar rather than silently absent.
>
> **Also in scope, because this PR makes it user-visible**
>
> The two lineage panel captions are corrected. "Upstream dependents" is inverted - a dependent depends on you, i.e.
> is downstream, while that endpoint returns the entities your data depends ON - and the manual currently carries
> three different names for the concept. Since this PR wires those panels into the new filter, leaving the panel and
> the filter chip disagreeing would ship a defect this change creates.
>
> **Deferred, with a tracked home (not silently dropped)**
>
> * Per-option counts on the filter ("My Objects (23)") - three extra aggregate queries per search on the slice that
>   already carries the perf gate; ships only with measured evidence.
> * Giving query examples an ownership model - a product question, not this slice's.
> * Saved searches do not persist the Asset-type selection (a pre-existing gap from the ST-3/ST-4 boundary) - it is
>   already tracked from the parallel ST-7 work, and is not fixed here.
> * `data-lineage.md` contradicts itself about "Upstream dependents" and records two wrong OpenAPI summaries -
>   tracked as a documentation follow-up; this PR's doc changes are to `search.md` and `catalog-overview.md`.
>
> **The performance gate is a deliverable, not a checkbox.** Measured on a Postgres 13.2 fixture while planning:
> the upstream lineage hop is a sequential scan today (881 ms vs 30 ms downstream, on 50k edges) because `lineage`
> has no index leading on `child_oddrn` - so the PR adds one (22 ms after). The existing recursive edge CTE
> materialises 130k rows for 800 nodes at depth 2 and does not complete at depth 3 within 25 s, so the scope
> expansion is a bounded breadth-first walk with a visited set instead. Depth is capped at 3, the traversed set at
> 10,000 nodes, and any truncation is reported by the server and shown to you - a partial impact set must never
> read as a complete one.

## Plan-check (G-C19) — ISSUES FOUND: 5 blockers, 8 warnings; 4 blockers accepted, 1 disproved

Adversarial fresh-context check by `.claude/agents/plan-checker.md` against `origin/main @ 82e7e70e`.
**Every finding was re-verified here before acting on it** — an agent's verdict is evidence, not authority.

| # | Finding | My verification | Disposition |
|---|---|---|---|
| **B1** | *"R7's three-state posture is unimplementable — the system cannot distinguish `auth.type=DISABLED` from a signed-in user with no Owner binding; the plan must add a contract discriminator."* | **DISPROVED — the discriminator already exists.** The checker verified `whoami` correctly (`IdentityController.dummyOwner()` does return identity-present/owner-null under DISABLED, indistinguishable from an unbound user) but looked only at `Identity` / `AssociatedOwner` / `Feature`. It missed **`AppInfo.authType`** — on the contract at `components.yaml:2787-2793`, served by `AppInfoController` from `@Value("${auth.type}")`, and **already consumed for exactly this purpose** by `FavoritesColumn.tsx:34` (`appInfo?.authType === 'DISABLED'`). **No contract change is needed.** | **Rejected as a blocker; accepted as a real WARNING** — the mechanism existed but my plan never *named* it, so a reviewer could not verify the posture was wired. R7 now records the discriminator + why `whoami` alone is insufficient; a `key_link` and an artifact anchor were added; `IT-152` asserts both arms on real stacks instead of by injecting props. |
| **B2** | *"'the legacy `/api/search` drives no UI since ST-4' is factually false."* | **CONFIRMED, and it was my error.** `Search.tsx:78-81` dispatches `createDataEntitiesSearch` on every distinct URL state; `Results.tsx:100-110` gates the cross-kind fetch on `searchFiltersSynced && searchId`; `Filters.tsx:75` gates the `Type` facet via `getSearchEntityClass`, which returns `'my'` iff `search.myObjects`. *One sub-claim overstated:* the sidebar facet counts would **not** change, because `getEntityClassFacetForDataEntity(state)` takes no owner (`ReactiveSearchFacetRepository.java:29`) — they are already catalog-wide today. | **ACCEPTED.** The false sentence is retracted in the out-of-scope list and replaced with the verified posture: the DE-session request stays **byte-identical to today** (`myObjects: true` still emitted whenever `MY_OBJECTS` is selected). The catalog-wide facet counts are named as a **pre-existing** limitation, citing `F-017`'s own `catalog_wide_count_design_my_objects_not_a_boundary` drift class. |
| **B3** | *"a wall-clock deadline makes truncation non-deterministic, contradicting R4's own acceptance and ADR D10."* | **CONFIRMED** — my Design (d) put `deadline passed -> truncated = true` one line below a comment claiming determinism. A load-dependent cutoff means the same shared URL yields a different id set on a busy node. | **ACCEPTED.** The node budget is now the **only set-determining bound**; the wall clock is a circuit breaker with its own outcome (`scope_truncation_reason: TIMEOUT` ⇒ no set + "narrow your filters") that can never be mistaken for the deterministic `NODE_CAP` partial set. `scope_truncation_reason` added to the contract. |
| **B4** | *"`MY_OBJECTS` regresses from today's uncapped ownership semi-join to a 10 000-row capped materialised set."* | **CONFIRMED — the best catch of the review.** Condition (5) today is `DATA_ENTITY.ID.in(DSL.select(OWNERSHIP.DATA_ENTITY_ID)…)` (`:306-309`) — uncapped and planner-optimised. My resolver materialised and capped it, so an owner of >10 000 assets would silently lose rows (a D9 break), and worse, a large owned set would exhaust the shared budget *before hop 1*, making the lineage scopes return ~nothing. | **ACCEPTED, with a better design than the suggested fix.** `MY_OBJECTS` is removed from the resolver entirely and stays an **uncapped SQL semi-join** in the ranked query. The budget applies only to the lineage walk — and **hop 1 now anchors on a subquery**, so the owned set is never materialised at all and cannot consume the budget. |
| **B5** | *"two suite-registered e2e specs assert the control this slice deletes, and neither is in any commit."* | **CONFIRMED.** `search-url-facets.spec.ts:124,133,150` click `role=tab`; `search-class-tab-filter.spec.ts` is entirely the tab strip; both are in `feature-complete` **and** `ui-e2e`. Commit 9 named only the i18n spec — so the mandatory FULL regression could not have gone green without unplanned scope. | **ACCEPTED.** Commit 9 now carries both, with a stated per-spec decision: `IT-151` **re-pointed** onto the sidebar `DataEntityTypeFilter` (still RED on `ref:main`, no weaker — G-C15); `IT-068` **retired as superseded**, with its PLT-147 null-details regression lock **moved into `IT-152`** so the guard is not lost with the tab. |

**Warnings — all 8 accepted and folded in:** W1 the saved-search *reapply* key_link (`searchFormDataToUrlState`, the
direction where PLT-256's defect class actually bites) · W2 the latency bound is now **named in R4's acceptance and
as a truth**, not fixed by the run that measures it · W3 the wire types are stated, and `my_data`/depths are declared
**permissively** (plain `string` / `integer`, no `enum`/`minimum`) so R3's "never a 400" is actually reachable —
generated Jackson would otherwise reject a bad token before any clamp ran · W4 "Clear All" gets its own requirement
**R7b** and a line in the public scope comment · W5 the result count renders **outside** the `!routerSearchId` gate
so it does not vanish on the legacy session route · W6 the ctrib060 overlap table corrected — it *does* touch
`components.yaml`, `AssetSearchServiceIntegrationTest` and all 7 locale files · W7 **four** repository call sites,
not three · W8 the two **retired** i18n keys named so all 7 files change symmetrically.

**Loop count: 1 of ≤3. No open BLOCKER remains** — four accepted and fixed above, one disproved with cited evidence
and downgraded to a warning that is also fixed. The plan is GATE-1 ready.


## GATE 1 — APPROVED 2026-08-31

| | |
|---|---|
| Approved by | `RamanDamayeu` (the maintainer, and #1842's author) |
| Decision **D1 — option labels** | **Option 1 (the recommendation): `My Objects` · `Upstream of my data` · `Downstream of my data`**, under the group heading **My data** — keeping ODD's published `My Objects` (already on the Alerts scope tabs + the Recommended panel, and already in all 7 locales) and replacing the inverted `dependents` wording. **Includes the two home-panel caption corrections**, so the panel a user clicks and the filter they land on read the same. |
| Decision **GATE 1** | **Approve — post the scope note and build.** The panel-caption correction is IN (the alternative that dropped it was declined). |
| Scope comment | Posted before any code, as the gate requires: [issuecomment-5471710327](https://github.com/opendatadiscovery/odd-platform/issues/1842#issuecomment-5471710327) — 3 888 chars, ASCII-verified (0 bytes > 127), `odd-contributor[bot]`, 2026-08-30T22:41:41Z. It carries the three corrections, the Clear-All change, the in-scope caption correction, the four deferrals, and the measured perf table. |

**Consequences of D1 fixed here so Phase D does not re-litigate them:**
- New i18n keys (× 7 locales): `My data`, `Upstream of my data`, `Downstream of my data`, `Upstream depth`, `Downstream depth`, the query-example exclusion caption, the two truncation-strip strings, the unbound-user reason, `N results`, `0 results`.
- Retired i18n keys (× 7 locales): `Upstream dependents`, `Downstream dependents`.
- Reused as-is (× 7 locales, already present): `My Objects`.
- `catalog-overview.md`'s panel list (`:57-59`, currently "Upstream/Downstream **Dependencies**") is updated on the same train so the manual, the code and the filter finally agree.

## Phase D — implementation ledger (running)

Branch `contrib/CTRIB-062-my-data-filter` in worktree `../odd-platform-ctrib062`, off `origin/main @ 82e7e70e`.
Branch safety asserted before any push (O6/LSN-038): no upstream set, `branch.merge` unset, `push.default=current`.
Migration lane re-verified at branch time — `origin/main` max is `V0_0_100`, neither co-active stream adds one.

| # | Commit | State |
|---|---|---|
| 1 | `54f3cb91` contract + `V0_0_101` index | done — `my_data` / depths declared **permissively** (plain `string` array + plain `integer`, no `enum`/`minimum`) so a stale URL degrades instead of 400-ing; `my_objects` deprecated-with-alias; `AssetPageInfo.scopeTruncated` + `scopeTruncationReason` |
| 2 | `ebb38484` the bounded lineage walk | done — **7/7 tests GREEN** in 21 s against a real Postgres |
| 3 | `ba18fafa` cross-kind scope predicate + service wiring | done — **11/11 tests GREEN** (5 predicate + 6 wiring) |
| 4 | `cb97c058` the URL contract (+ the #1858 mirror merge) | done — **42/42 FE tests GREEN** |
| 5-8 | `077313ad` sidebar group · tab retirement + count · panel deep-links · i18n × 7 | done — tsc clean; full vitest 163/164 (the 1 failure non-attributable, proven below) |
| 9 | `aac1e908` (odd-team) IT-152 + the three re-pointed specs | authored; **run in progress** |
| 10 | `24c3034d` (odd-team) + `documentation@e692c43` docs on the 1.0.0 train, DOC-504/505 | done |
| — | ontology refresh | in progress (`/enrich` on the one sidecar this change makes stale) |
| — | FULL regression + draft PR | pending |

**Commit-hygiene defect caught and fixed before any push.** The `git rm` of the retired tab components was
left staged and rode along into the *resolver* commit, whose message says nothing about a UI deletion — a
reviewer of that commit would have seen two files vanish with no explanation. Since nothing was pushed, the
five commits were regrouped with `reset --soft` + explicit-path re-commits, and the result verified
**byte-identical** to the pre-regroup tree (`git diff --stat 2437df4e HEAD` → empty).

**A second push-safety trap caught, in the docs repo.** `git worktree add -b <branch> origin/release/1.0.0`
silently set the upstream to the **shared, published-facing** `release/1.0.0` train — the LSN-034 class, where
a bare `git push` publishes to it. Unset and asserted (`@{u}` absent, `branch.merge` unset,
`push.default=current`) before a single doc byte was written.

### Unit bucket — measured, not asserted

`MyDataScopeResolverTest` — **7/7 GREEN, 0 failures, 21.152 s** (`build/test-results/test/TEST-…MyDataScopeResolverTest.xml`):

| Case | Time |
|---|---|
| UPSTREAM/DOWNSTREAM walk opposite directions; per-direction depth is independent; a depth above the ceiling is clamped | 1.998 s |
| the owned anchors are excluded — "upstream of my data" is not "my data" | 0.359 s |
| a **cycle** terminates and does not duplicate (the visited set the recursive CTE lacks) | 0.671 s |
| the node budget truncates **deterministically** — same request, byte-identical set, twice | 1.640 s |
| a **large owned set does not starve the walk** — the plan-check B4 regression guard | 0.963 s |
| an owner with no lineage resolves empty, not a catalog leak | 15.394 s |
| no lineage scope ⇒ the resolver does no work | 0.063 s |

**Two defects this bucket caught before review, not after:** the Spring context failed to start because the
resolver's test seam gave it two constructors (`No default constructor found`) — fixed with an explicit
`@Autowired` on the injectable one; and four checkstyle violations (a 142-char line, a blank line at a block
start, an import-order swap) that a bare `:test` task would have been blind to, which is exactly why the local
gate runs the full `build` lifecycle.


### Frontend bucket — measured

| Check | Result |
|---|---|
| `tsc --noEmit` (Node 24, after a full OpenAPI regen — the new fields are in the generated client) | **clean, exit 0, no output** |
| `vitest run src/lib/search src/lib/hooks/__tests__/useNavigateToSearch.test.tsx` | **42/42 GREEN** |
| `vitest run` (the whole FE suite) | **163/164**, 33 files |

The single failure — `DataSourceItem.test.tsx > REJECTED delete → the dialog STAYS OPEN` — is a
**load-induced timeout**, not a regression: the suite ran while a gradle build and a neighbouring stream's
docker regression were saturating the box (187 s wall, 845 s of import time), and the test timed out at its
5 000 ms budget. Re-run in isolation it is **2/2 GREEN in 1.87 s**. It imports nothing this slice touches.
Proven, not assumed — the whole point of re-running rather than waving it through.

The three URL-shape assertions I could have guessed wrong (`my_data[]=MY_OBJECTS`,
`downstream_depth=2&my_data[]=DOWNSTREAM`, and the depth-omission rules) are asserted against **real
serialiser output**, not a derived shape — the CTRIB-023 / IT-137 lesson.

## Live-system verification (the running SUT, not a unit mock)

`odd-platform:odd-team-sut-ctrib062` built from this worktree, stack `ctrib062` on `:18260` — the same image
the e2e runs against.

**The response shape was CAPTURED, never assumed** (the CTRIB-023 / IT-137 lesson — an assertion written from
a reasoned shape broke on the fix itself):

```
POST /api/search/assets?size=5   {"query":"","filters":{},"my_data":["DOWNSTREAM"],"downstream_depth":2}
-> {"items":[], "page_info":{"total":0,"hasNext":false,"nextCursor":null,
                             "scopeTruncated":null,"scopeTruncationReason":null}}
```

So the wire really is `page_info` (snake_case, like its siblings) carrying camelCase members — matching the
`AssetPageInfo` declaration rather than my expectation of it.

**Fail-closed, proven end-to-end on the running system rather than only in a unit test:**

| Request | Result |
|---|---|
| `my_data: ["NONSENSE"]`, `upstream_depth: 99` | **HTTP 200** — the unknown token is dropped and the depth clamps |
| `upstream_depth: -7` | **HTTP 200** — clamped into range |
| `my_objects: true` (the deprecated field, alone) | **HTTP 200** — the back-compat alias still serves |
| `upstream_depth: "abc"` (wrong JSON **type**) | **HTTP 400** `USR001 Failed to read HTTP message` |

**That last row contradicted my own spec, and the spec was corrected rather than the result explained away.**
R3 originally claimed "a value outside [1,3], **or a non-integer**, degrades — never a 400". The out-of-range
half is true and measured; the non-integer half is not, because Jackson rejects a wrong-typed value before any
service-side clamp can run. The claim is now scoped to what is actually true — the URL path, where
`parseDepth` drops a non-numeric depth before the request exists, which is the case a shareable link can
actually hit — and the **published OpenAPI descriptions for both depth fields were rewritten to match**, since
an inaccurate contract description is exactly the class of defect this project exists to prevent.

## Plan-time measurements, round 2 — what the ontology refresh caught

The `/enrich` pass on `ReactiveLineageRepositoryImpl` did more than restate the file: reading it fresh, the
analyser flagged two things about **my own change**. Both were verified against the real schema before acting,
and they resolved in opposite directions — which is the point of measuring rather than accepting.

### M4 — CONFIRMED and fixed: I indexed only half the query

`ownership` and `term_ownership` are both looked up **by owner** (the `MY_OBJECTS` semi-join and hop 1's
anchor subquery), but in both tables `owner_id` is the **second** column of the only composite index
(`ownership(data_entity_id, owner_id)`, `term_ownership(term_id, owner_id)`) — confirmed against the live
`pg_indexes`. A predicate on `owner_id` alone cannot range-start on either.

| `SELECT data_entity_id FROM ownership WHERE owner_id = ?` (400 000 rows, 500 owners) | Plan | Time |
|---|---|---|
| today | **Parallel Seq Scan** | **107.1 ms** |
| after `CREATE INDEX ownership_owner_id` | Bitmap Index Scan | **4.9 ms** |

**22×, on every search that carries a My-data scope.** Exactly the class of finding that produced the
`lineage(child_oddrn)` index — and I had indexed the lineage side while leaving the ownership side on a
sequential scan. Both indexes now ship in `V0_0_101`.

### M5 — REJECTED after measuring: the "obvious" frontier fix is the slowest

The same pass flagged that hops 2..n bind the frontier as a literal `IN` list — the shape M3 taught me to
avoid. Measured at the worst case (a 10 000-element frontier over 400 000 edges):

| Frontier binding | Time |
|---|---|
| `IN (SELECT … FROM generate_series)` — a hashed subquery | **894 ms** |
| the literal `IN (?, ?, … ×10 000)` jOOQ emits today | **1 380 ms** |
| `IN (SELECT unnest(?))` — the array bind used elsewhere in this slice | **1 885 ms** |

**The suggested fix is the slowest of the three**, because here the planner turns it into 10 000 individual
index probes rather than one hash. All three land around a second only at a frontier the node budget already
caps, and the common case (depth 1, a handful of owned assets) is milliseconds. So the shape stays — changing
it would have been churn in the wrong direction, justified by pattern-matching rather than measurement.

M3 and M5 together are the honest lesson: `= ANY(array)` was catastrophic *in a per-row OR filter over a large
scan*, and `unnest` fixed it there. Neither result generalises to a different query shape, and assuming it did
would have made this slower.

## Live-system diagnosis — IT-152's last failure was mine, twice over

The `#1858` mirror-merge test failed three runs in a row on `waiting for getByRole('option', {name:'STABLE'})`.
Rather than loosen the assertion, each hypothesis was tested against the running stack:

| Hypothesis | Test | Verdict |
|---|---|---|
| The facet-options endpoint is broken | `curl .../facet/statuses` → 400 | **My curl was wrong** — the path enum is the uppercase `STATUSES`; it returns 200 and lists all five statuses |
| The tag facet's async options never load | switched to `statuses`, a facet whose options always exist | correct change, but not the cause |
| The click races the session's `searchId` | added an explicit settle-wait on the results count | correct change, but not the cause |
| The interaction is broken on my build | ran **IT-151**, which drives the identical `#filter-statuses` → `STABLE` control | **4/4 PASS** — so the control works on my SUT |
| The spec itself is wrong | ran `my-data-scope.spec.ts` directly against the warm stack | **4/4 PASS** — the spec is correct |

So the failure only reproduces through `run-suite.sh`, which recreates the stack: on a **cold** app the MUI
**controlled-open** autocomplete can swallow the opening click, because the popup only appears once a debounced
fetch resolves and flips `autocompleteOpen`. That is a known ODD widget gotcha with a recorded technique —
drive it by **typing** (`pressSequentially`), which follows the same `onInputChange → handleFacetSearch` path a
user does. Applied, rather than papering over it with a longer timeout.

A diagnostic spec was written to read the live DOM (options present, listbox open, the facet request 200) and
**deleted afterwards** — it was an instrument, not an artefact.