---
id: CTRIB-062
title: "#1842 ST-8 — My-data filter (All / My Objects / Upstream / Downstream; per-direction depth) + retire the My-Objects tab + panel deep-links — own perf gate"
issue: "https://github.com/opendatadiscovery/odd-platform/issues/1842"
parent_epic: 1825
class: "feature — full stack (backend scope resolver + search predicate + FE filter + tab retirement + panel deep-links)"
status: scoping
target_repo: odd-platform
milestone: "1.0.0"        # G-C11 PASS — live GET issues/1842 2026-08-30: milestone 1.0.0, state OPEN, semver, due 2026-07-31
slice: "ST-8 of #1825"
base_sha: "82e7e70e"      # odd-platform origin/main at intake (= #1862 ST-5c merged)
reproduced: "n/a at intake — feature-shaped slice, so the entry gate is spec-gate (G-C17), not reproduce-first. Baseline observations of the CURRENT my_objects behaviour are captured in ## Baseline observations and proved RED in Phase D."
adr_required: false       # covered by the approved spine ADR adrs/drafts/unified-asset-search.md D4 + D8; no new architectural decision
plan_approved_by: null
plan_approved_at: null
pr_url: null
docs_routing: "pending — expected release/1.0.0 train (unreleased behaviour); see ## Plan"
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
| **Target** | `upstream_depth` and `downstream_depth`, each default **1**, independently settable, **hard ceiling 3** (ADR D4 + SME Q4: DataHub's Impact Analysis defaults to 1 degree "to minimize processor-intensive queries"; ODD's ceiling is lower than a graph view's because a search filter runs per interaction). Each direction's depth applies only when that direction's scope is ticked. A value outside `[1,3]`, or a non-integer, **degrades to the default** — never a 400, never a 500 — conforming to the `SearchFormData.sort` precedent (*"deliberately a plain string rather than a strict enum so an unknown value degrades gracefully"*, `components.yaml:2453-2460`). |
| **Acceptance** | With a chain `U2 → U1 → A(mine) → D1 → D2`: `Upstream, depth 1` ⇒ `{U1}`; `depth 2` ⇒ `{U1,U2}`; `Downstream, depth 1` ⇒ `{D1}`. `?upstream_depth=99` and `?upstream_depth=abc` both behave exactly as `depth 1`. |

### R4 — The scope expansion is bounded, and any truncation is a server-declared, visible state

| | |
|---|---|
| **Current** | The lineage CTE is `WITH RECURSIVE … UNION ALL` over **edges**, with no visited-set/cycle guard — cost grows with *path* count, `O(f^d)` per root, and the anchor set is the caller's whole owned set, unpaginated. Nothing caps it. |
| **Target** | Expansion is BFS with an explicit visited set (cycle-safe by construction), bounded by: depth ≤ 3, a cumulative **traversed-node budget of 10 000** (the cap the cited DataHub Impact Analysis uses), and a wall-clock budget. When any bound bites, the response carries **`scope_truncated: true`** and the UI (a) renders a **persistent** strip above the results naming cause + remedy, and (b) **qualifies the count** — `N+` / "(partial)", never a bare total. A truncated total presented as a total is a false governance claim (the operator concludes "17 downstream consumers, I've told them all"). Truncation is **deterministic for a given spec** — the search state is a shareable URL (D10), so two people opening the same link must see the same scope. |
| **Acceptance** | On a dense fixture that exceeds the budget, the response has `scope_truncated: true`, the page shows the strip and a qualified count, and re-running the identical request returns the identical id set. EXPLAIN shows an index scan (not a seq scan) for both directions. The request completes within the stated latency bound. |

### R5 — The My-Objects tab is retired and the result count survives it

| | |
|---|---|
| **Current** | The strip is down to **All + My Objects**; ST-4 named ST-8 as the owner of the retirement (`SearchResultsTabs.tsx:16-20`). The tab hint is the **only** place `/search` shows a result count. |
| **Target** | The tab strip is **removed entirely** (a one-tab strip is not a control), and the total moves into the existing results-header band next to the sort control — `N results`, present on the empty state too (`0 results`), qualified when truncated (R4). |
| **Acceptance** | `/search` renders no tab strip; a search shows `N results` matching the number of rows the list can scroll to; an empty search shows `0 results`, not a bare empty list. |

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
| **Acceptance** | On the `odd-minimal` (DISABLED) stack the My-data group is absent from the sidebar. On a LOGIN_FORM stack with an unbound user it renders disabled with the reason. Server-side, a My-data scope with no resolvable owner returns an empty page, never an unscoped one (the existing `AssetSearchServiceImpl.java:66-72` short-circuit, extended to the new scopes). |

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
- **Applying `my_data` to the legacy `/api/search` session results** — that endpoint drives no UI since ST-4 and its
  boolean semantics are D9-frozen. The new fields never enter `FacetStateDto`, so the legacy path cannot silently
  half-honour them; the OpenAPI description states this.
- **`asset_kinds` is not persisted into a saved search** (pre-existing ST-3/ST-4 integration gap found en route —
  `searchUrlStateToFormData` drops it, so `SavedSearchForm` never stores it). → follow-up item, not fixed here.
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
| **OpenAPI contract** | `components.yaml`: new `MyDataScope` enum; `SearchFormData` gains `my_data` + `upstream_depth` + `downstream_depth` and marks `my_objects` deprecated-with-alias; `AssetPageInfo` gains `scope_truncated`. Additive only (D9). |
| **Generated clients (BE + FE)** | BE: gradle openapi generation — **`$ref`'d `components.yaml` changes are not tracked by the BE gradle task; `build/generated` must be deleted to force regen** (`reference_odd_platform_activity_event_and_spec_codegen`). FE: docker codegen. Both re-run and verified in Phase D; generated sources are gitignored, so nothing is committed. |
| **Every consumer of a changed signature** | `ReactiveAssetSearchRepository.{keysetPage,relevancePage,count}` change `OwnerPojo owner` → the resolved scope. Consumers: `AssetSearchServiceImpl` (3 call sites) + `AssetSearchKeysetPaginationTest`, `AssetSearchSortIntegrationTest`, `AssetSearchServiceIntegrationTest` — all updated in the same commit. |
| **Migration** | `V0_0_101__lineage_child_oddrn_index.sql` — one additive `CREATE INDEX` (see (e)). Non-destructive ⇒ not a G-C7 hard stop. **Lane check at branch time:** main's max is `V0_0_100`; ctrib060 (ST-6) and ctrib061 (ST-7) are not expected to add migrations, but the number is re-verified against `origin/main` immediately before the commit. |
| **i18n — ALL 7 locales** | `My Objects` / `Upstream` / `Downstream` already exist in all 7 (verified per key). NEW keys: the group heading, the two `… of my data` option labels, the two depth-select labels, the QE-exclusion caption, the truncation strip copy, the unbound-user reason, `N results` / `0 results`. Every new key added to `en,br,ch,es,fr,hy,ua` in the same commit; the `i18n-key-parity` test is the guard. |
| **Dead code** | `SearchResultsTabs/` and `SearchTabsSkeleton/` are imported **only** by `Results.tsx` (verified by grep) — both directories are deleted, not left orphaned. **Deliberately NOT deleted:** `dataEntitySearch.slice`'s `myObjects` field and `getSearchEntityClass`'s `'my'` branch. They are not dead — the slice faithfully mirrors the still-live `SearchFacetsData.myObjects` echo, and the legacy `/search/{sessionId}` deep-link (kept by D9) can still load a session whose `myObjects` is true. Only the *writer* (`changeDataEntitySearchFacet`'s `'my'` pseudo-class, `dataEntitySearch.slice.ts:230-236`) becomes unreachable; removing it would ripple into `dataEntitySearch.slice.test.ts` and the `SearchClass` type for no user-visible gain. |
| **Docs** | `search.md` (the whole "Result-class tabs" section dies with my change) + `catalog-overview.md` (panel captions + the new View-all deep-links), on the `release/1.0.0` train. |
| **Ontology** | `F-017` (search filter facets), `F-148` (the class-tab filter this retires), `F-015` (the my-objects anchor reads the panels use). `/enrich --touched` in Phase D **iff** `lineage/**` is clean and unclaimed (R9 is currently contended by ctrib060). |
| **Existing tests broken by the change** | `integration-tests/e2e/specs/multilingual-i18n.spec.ts:312-335` asserts the **My Objects tab** renders + translates — it must be re-pointed at the new My-data filter control (protocol `IT-102` updated in step with it). `IT-068`/`IT-151` reference the class-tab strip; re-read and re-pointed where they touch the retired control. |
| **Security** | The scope is resolved **server-side from the authenticated principal only** — no owner id is ever accepted from the request, so a crafted URL cannot scope to another user's owned set. The URL carries only scope tokens + small integers (no secrets — the D10/D11 rule). A shared link re-evaluates as the recipient. Fail-closed: unknown scope token or bad depth ⇒ dropped/defaulted, never an error. |
| **Product-Owner / SRE lens** | Run via `odd-sme` (`lineage/odd-platform/sme-consultations/2026-08-30-my-data-scope-filter.md`) BEFORE this design; its findings on cross-kind semantics (R2), impact-direction wording (D1), the DISABLED/unbound posture (R7), truncation honesty (R4) and the result count (R5) are folded in above. Its two deferred recommendations (per-option counts; renaming "My Objects" product-wide) are in the out-of-scope list with homes. |
| **Rendered pixels** | A screenshot of the sidebar (group + chips + depth selects + caption), the truncation strip, and the results header is captured and reviewed as a user before the PR leaves draft (G-C12 step 5). |

### (d) The scope resolver — bounded by construction

```
resolve(owner, scopes, upDepth, downDepth) -> (allowedDeIds, allowedTermIds, truncated)

  budget = 10_000 traversed nodes            # the cap DataHub's Impact Analysis publishes
  deadline = now + SCOPE_BUDGET              # wall-clock; a partial set is flagged, never silently complete

  ownedDe   = SELECT id, oddrn FROM data_entity JOIN ownership … WHERE owner_id = ? ORDER BY id LIMIT budget
  ownedTerm = MY_OBJECTS ? (SELECT term_id FROM term_ownership WHERE owner_id = ? ORDER BY term_id LIMIT budget) : {}

  for each selected lineage direction:
      frontier = ownedDe.oddrns ; visited = {}          # visited => cycle-safe, no path explosion
      repeat depth times:
          hop = SELECT DISTINCT <other> FROM lineage
                WHERE <anchor> = ANY(:frontier) AND is_deleted = false
                ORDER BY 1 LIMIT remaining-budget+1     # ORDER BY => truncation is DETERMINISTIC for a spec
          frontier = hop − visited ; visited ∪= frontier
          if budget exhausted or deadline passed -> truncated = true ; break
      neighbourIds ∪= SELECT id FROM data_entity WHERE oddrn = ANY(visited − ownedOddrns)

  allowedDeIds   = (MY_OBJECTS ? ownedDe.ids : {}) ∪ neighbourIds
  allowedTermIds = ownedTerm                            # lineage is DE-only, so terms only enter via MY_OBJECTS
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
   (asset_search_entrypoint.asset_kind = 'DATA_ENTITY' AND asset_search_entrypoint.asset_id IN (SELECT unnest(:deIds)))
OR (asset_search_entrypoint.asset_kind = 'TERM'        AND asset_search_entrypoint.asset_id IN (SELECT unnest(:termIds)))
```

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
| 1 | **Contract + migration** — `MyDataScope`, `SearchFormData.{my_data,upstream_depth,downstream_depth}`, `my_objects` deprecated-with-alias, `AssetPageInfo.scope_truncated`; `V0_0_101` index | `odd-platform-specification/components.yaml`, `…/db/migration/V0_0_101__lineage_child_oddrn_index.sql` |
| 2 | **Backend — the bounded scope resolver (RED-first)** | new `service/MyDataScopeResolver{,Impl}.java`, `dto/MyDataScopeResult.java`, `dto/DataEntityIdOddrn.java`; `ReactiveLineageRepository{,Impl}` + `getNeighbourOddrns`; `ReactiveDataEntityRepository{,Impl}` + `listIdAndOddrnByOwner` / `listIdsByOddrns`; `ReactiveTermRepository{,Impl}` + `listIdsByOwner`; new `MyDataScopeResolverTest` |
| 3 | **Backend — the search predicate + response flag** | `ReactiveAssetSearchRepository{,Impl}` (owner → scope; kind-guarded array predicate), `AssetSearchServiceImpl` (scope resolution, back-compat alias, depth clamp, `scopeTruncated` on the page info); extend `AssetSearchServiceIntegrationTest` |
| 4 | **Frontend — the URL contract** | `lib/search/searchUrlState.ts` (+ params, fail-closed parse, legacy `?my=` alias, form-data projection), `redux/selectors/dataentitySearch.selectors.ts`, `Search.tsx` (mirror merge), `Filters.tsx` (Clear All), `lib/hooks/useNavigateToSearch.ts`; **three existing test files that assert the old `myObjects` shape and WILL break**: `lib/search/__tests__/searchUrlState.test.ts` (:17,60-110,153,197-215), `lib/search/__tests__/searchFormDataToUrlState.test.ts` (:13,28), `lib/hooks/__tests__/useNavigateToSearch.test.tsx` (:49 — asserts `{myObjects:true}` → `/search?my=true`) |
| 5 | **Frontend — the My-data sidebar group** | new `Filters/MyDataFilter/MyDataFilter.tsx` (+ styles, + `__tests__`), `Filters/Filters.tsx` |
| 6 | **Frontend — retire the tab strip, land the result count + truncation strip** | `Results/Results.tsx`, **delete** `Results/SearchResultsTabs/**` + `SearchTabsSkeleton/**`, `redux/{interfaces,slices,selectors,thunks}` for `total` + `scopeTruncated` |
| 7 | **Frontend — the three panel deep-links + caption correction** | `Overview/OwnerAssociation/OwnerEntitiesList/{OwnerEntitiesList.tsx,DataEntityList/DataEntityList.tsx}` |
| 8 | **i18n × 7** | `locales/translations/{en,br,ch,es,fr,hy,ua}.json` |
| 9 | **odd-team: integration test** | `integration-tests/protocols/IT-152-*.md`, `integration-tests/e2e/specs/my-data-filter.spec.ts`, `integration-tests/suites.yaml`; update `integration-tests/e2e/specs/multilingual-i18n.spec.ts` + `protocols/IT-102-*.md` |
| 10 | **odd-team: docs + follow-ups + ontology** | `documentation@docs/CTRIB-062-my-data-filter` (off `origin/release/1.0.0`); `backlog/docs/DOC-503`; the follow-up items; `/enrich --touched` |

### Tests (G-C9 — both buckets, written failing FIRST)

**Unit → odd-platform CI** (`scripts/run-platform-tests.sh`, the full `:odd-platform-api:build`):
- `MyDataScopeResolverTest` (Testcontainers `BaseIntegrationTest`; owner passed explicitly ⇒ no auth mocking, matching the repo's zero-`@MockBean` convention): owned DE + owned term resolution; upstream vs downstream direction correctness on a `U2→U1→A→D1→D2` chain; per-direction depth 1/2/3 independence; the anchor exclusion; **cycle safety** (`A→B→A` terminates and does not duplicate); the node cap firing ⇒ `truncated=true`; determinism (same spec ⇒ identical id set twice); empty owner ⇒ empty scope.
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
- `docs/data-discovery/search.md` — the "Result-class tabs" section is **retired by this change** and is rewritten as the Filters-sidebar model including the My-data group, the per-direction depth, the truncation caveat, and the DISABLED/unbound posture.
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

| Item | What |
|---|---|
| `PLT-257` | Saved searches silently drop `asset_kinds`: `searchUrlStateToFormData` (the `SavedSearchForm` capture path) projects only the shared `SearchFormData`, so an Asset-type narrowing is lost on save/reapply. Pre-existing ST-3/ST-4 gap. |
| `DOC-504` | `data-lineage.md` contradicts itself on "Upstream dependents" (its endpoint table says the opposite of its prose two lines later) and records the wrong `getMyObjectsWithUpstream/Downstream` OpenAPI summaries. |
| `TST-060` | Per-option counts on the My-data filter (`My Objects (23)`) — deferred pending measured evidence that three extra aggregates per search are affordable on the heaviest slice. |

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
    - "An existing saved search or bookmark that used the old My-Objects filter still works unchanged (Spec R8)"
  artifacts:
    - path: "odd-platform-specification/components.yaml"
      provides: "the my_data + per-direction-depth request contract and the scope_truncated response flag"
      anchor: "MyDataScope"
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
      via: "searchUrlStateToFormData projecting my_data + depths into SearchFormData"
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
