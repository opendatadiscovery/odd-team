---
id: CTRIB-062
title: "#1842 ST-8 — My-data filter (All / My Objects / Upstream / Downstream; per-direction depth) + retire the My-Objects tab + panel deep-links — own perf gate"
issue: "https://github.com/opendatadiscovery/odd-platform/issues/1842"
parent_epic: 1825
class: "feature — full stack (backend scope resolver + search predicate + FE filter + tab retirement + panel deep-links)"
status: pending-release   # GATE 2 (human) 2026-09-01: PR #1871 MERGED by RamanDamayeu at 11:51:25Z -> squash `b5d9f150` on odd-platform origin/main; head-at-merge was `5b20c3da`, EXACTLY the reviewed SHA, and `git diff 5b20c3da b5d9f150` is EMPTY -- the squash is FAITHFUL, so the review's measured evidence applies verbatim to what is on main. Issue #1842 auto-closed 11:51:27Z. Release-gated: milestone 1.0.0 is still OPEN (20 open / 9 closed issues) and unreleased (latest release 0.29.0), so `/review release:1.0.0` owns pending-release -> done; the implementer/reviewer do NOT self-mark done. **Doc obligation still OUTSTANDING: `documentation` PR #110 is an unmerged DRAFT against `release/1.0.0`, so the My-data doc is NOT on the train** -- a 1.0.0 cut as things stand publishes this feature with no documentation. | Prior: /review THIRD pass (review-ctrib062-3, 2026-09-01, fresh session) -> **ACCEPTED = GATE-2-ready**. Every AC (R1-R8) + every applicable gate PASS on the reviewer's OWN measurements at 5b20c3da: unit BUILD SUCCESSFUL 24m25s 181 classes/774 tests/0/0/0 (JUnit XML, this run); changed-lines coverage 115/115 = 100.00% recomputed from my own jacoco XML (CI gate 98); four-suite regression on my OWN SUT sha256:82983e32 -> feature-complete 328/11/1-skipped with the 11 SET-EQUAL to TST-059's eleven (ZERO unattributed, incl. search-class-tab-filter:149 validating Phase G's re-anchor), known-bugs 3-RED-expected/0-unexpected-GREEN, multi-stack 14/0 GREEN, ingestion-e2e 15/0; i18n 688x7 0-missing/0-extra. C0: my run is the SEVENTH whole-suite multi-stack sample and it is GREEN -> one red in SEVEN (better than the 'once in six' PR #1871 discloses); still unexplained, TST-064 owns it. Gate 5 N/A, Gate 8 PENDING-RELEASE (1.0.0; doc AUTHORED+PUSHED on release/1.0.0 @ e8fa107, origin/main contained in the train). OWED-not-blocking: PR #1871's decision sentence still says ~1-in-3 vs the measured 1-in-6; M9 silently dropped from the Phase-G fix-list; DOC-512. Editorial audit ran (active-platform-features/** — never claimed before): DOC-510 CRITICAL (ingestion-auth 0.29.0 fix contradicted on 6 live pages), DOC-511, DOC-509, DOC-512, DOC-513, TST-065; DOC-506 extended. STAYS review-ready: human GATE-2 merge of draft PR #1871 -> pending-release -> /review release:1.0.0 owns done. Verdict: '## Review (2026-09-01, session: review-ctrib062-3)'.
target_repo: odd-platform
milestone: "1.0.0"        # G-C11 PASS — live GET issues/1842 2026-08-30: milestone 1.0.0, state OPEN, semver, due 2026-07-31
slice: "ST-8 of #1825"
base_sha: "82e7e70e"      # odd-platform origin/main at intake (= #1862 ST-5c merged)
reproduced: "n/a at intake — feature-shaped slice, so the entry gate is spec-gate (G-C17), not reproduce-first. Baseline observations of the CURRENT my_objects behaviour are captured in ## Baseline observations and proved RED in Phase D."
adr_required: false       # covered by the approved spine ADR adrs/drafts/unified-asset-search.md D4 + D8; no new architectural decision
plan_approved_by: "RamanDamayeu"
plan_approved_at: "2026-08-31"
pr_url: "https://github.com/opendatadiscovery/odd-platform/pull/1871"   # MERGED 2026-09-01 (squash b5d9f150). Docs: https://github.com/opendatadiscovery/documentation/pull/110 -- still an unmerged DRAFT against release/1.0.0.
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
| **Acceptance** | On a dense fixture that exceeds the budget, the response has `scope_truncated: true` + `scope_truncation_reason: NODE_CAP`, the page shows the strip and a qualified count, and **re-running the identical request returns the identical id set**. EXPLAIN shows an index scan (not a seq scan) for both directions, **and the FTS bitmap scan still drives the ranked query**. **Latency: the scope's MARGINAL cost over an unscoped search at the same catalog size** — at `downstream_depth=3` over a cap-reaching scope, no more than **1.5x** an unscoped search; at the default depth 1, **no more than** an unscoped search. *(Re-specified 2026-08-31 against the Phase-D measurement — see `## §24`. The original clause read "returns in < 1 s (plan-time projection ~0.53 s)". That number was projected from probe SQL that omitted the `count(*)` and the three left joins, and it is **unreachable at this scale for any search**: an UNSCOPED search over the same 120 000-asset catalog measures 1.17-1.25 s. A bound the unfiltered path cannot meet is not a bound on this feature. The marginal form is what ST-8 actually controls, and it is falsifiable on the same stand.)* |

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
    - "At depth 3 over a cap-reaching scope on a 100k+ asset catalog, scoping costs no more than 1.5x an unscoped search of the same catalog, and at the default depth 1 it costs no more than an unscoped search (Spec R4). RE-SPECIFIED 2026-08-31 against the Phase-D measurement: the original wording read 'still returns in under a second', which the measurement MISSED (~1.62 s) and also showed to be mis-specified - an UNSCOPED search over the same 120k catalog is 1.17-1.25 s, so no search of any kind could meet it at that scale. Measured: 1.32x at the ceiling, 0.69x at the default. NB these are PER SCROLL PAGE - the resolver re-runs on every infinite-scroll page."
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
      provides: "RE-POINTED off the retired tab strip onto the sidebar Data-entity-type filter, keeping both claims at the same strength; its PLT-147 null-details guard STAYS PUT. CORRECTED 2026-08-31 from the plan's original 'retire it and absorb the lock into IT-152': reading the spec showed that would be over-subtraction - moving a live regression lock into an unrelated My-data protocol loses it rather than preserving it, and renaming the file would orphan it from suites.yaml (LSN-033). Reasoning recorded in commit aac1e908."
      anchor: "RE-POINTED"
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

## Integration bucket — IT-152 GREEN (4/4), and what the five failed runs taught

`ODD_STREAM=ctrib062 integration-tests/run-suite.sh IT-152` → **4 passed (26.1 s)**,
`run-log/2026-08-31-IT-152.md` outcome `e2e:PASS`, against a SUT built from this worktree.

| Case | |
|---|---|
| the scope + depth params survive a sidebar facet toggle (**the #1858 mirror-merge guard**) | ✓ 8.8 s |
| the result tab strip is gone, and the match count survives its retirement | ✓ 5.7 s |
| an empty search reports `0 results` | ✓ 4.6 s |
| the My-data group is **hidden** under `auth.type=DISABLED` | ✓ 3.9 s |

It took five runs, and **every failure was in the test, never in the product** — which is the point of running
it rather than reasoning about it. In order: `getByRole('tab')` also matched the app toolbar; the tag facet's
options are async and never loaded; the facet click raced the session's `searchId`; the MUI **controlled-open**
autocomplete swallowed the opening click on a cold stack; and finally the facet's server-side filter turned out
to be **exact-match**, so typing the prefix `STAB` filtered `STABLE` out of its own dropdown.

That last one was measured against the endpoint the dropdown calls (`?query=STAB` → `[]`, `?query=STABLE` →
`["STABLE"]`) and is a **real product finding**, filed as `issues/odd-platform/PLT-258`: every sidebar filter's
input is labelled *"Search by name"* but only matches a complete value, so a user typing the first letters of
an owner or tag is told "No options". Not caused by ST-8 — reproduced directly against the endpoint — so it is
filed separately rather than folded into this PR.

Two diagnostic steps kept the loop honest rather than letting me weaken an assertion: **IT-151 was run as an
A/B** (4/4 green — proving the identical `#filter-statuses` control works on this SUT), and the spec was **run
directly against the warm stack** (4/4 green — proving the spec itself was correct). Only then was the
difference isolated to the cold-stack path. A throwaway diagnostic spec read the live DOM and was deleted
afterwards; it was an instrument, not an artefact.

## Integration bucket — IT-153 GREEN (4/4): the narrowing, proven through a real login

`run-suite.sh IT-153` → **4 passed (6.5 m)**, `run-log/2026-08-31-IT-153.md` outcome `e2e:PASS`, on a
LOGIN_FORM stack running **this branch's SUT image** (`ODD_PLATFORM_IMAGE=odd-platform:odd-team-sut-ctrib062` —
the compose file otherwise defaults to `ghcr.io/…:latest`, which would have tested a fossil, `LSN-033`).

| Case | |
|---|---|
| `My Objects` returns what I own **across kinds** — my entity **and my term**, and neither a foreign term nor an unowned entity (**the pass-through regression**) | ✓ 53.6 s |
| the two lineage directions are **not interchangeable**, and each **excludes the anchor** | ✓ 48.1 s |
| depth is **per-direction**: downstream 2 reaches the second hop; raising *upstream* depth does not widen it | ✓ 1.0 m |
| the group renders **enabled** for a bound owner — the contrast to IT-152's DISABLED absence | ✓ 41.9 s |

This is the claim the unit bucket could not make: a **real principal** signs in through the Spring form,
`user_owner_mapping (admin, LOGIN_FORM, owner)` resolves, and the assertions read the **rendered rows**.

### What it cost, and what it found

Three runs. Every failure was in the fixture, and **two of the three were pre-existing platform facts my
fixture had assumed away**:

1. `ON CONFLICT (name)` on `owner` — `owner_name_unique` is a **partial** index (`WHERE deleted_at IS NULL`,
   V0_0_36 dropped the plain constraint), and `ON CONFLICT` cannot target one without repeating its predicate.
   The *same class* as the `namespace` bug I had already fixed by reading the schema — I fixed one instance and
   missed its sibling. Both now use SELECT-then-INSERT, which does not care how uniqueness is expressed.
2. A 500 on every search, traced to **`DataEntityDtoMapper.extractOwnershipRelation`**: `ownership.title_id` is
   nullable, but the mapper throws on a null, so **one** such row takes down the whole results page for
   everyone. My fixture had omitted the title; the platform is also too strict about a state its own schema
   permits. Both addressed — fixture fixed, and the platform defect filed as
   **`issues/odd-platform/PLT-259`** (high). Same failure shape as the PLT-147 null-details bug IT-068 locks.
3. `term_ownership.role_id` — the column is `title_id` since V0_0_53. Verified against the live database
   rather than the migration I happened to read first.

The diagnosis was measured, not guessed: the stack was brought up by hand, every seeded table counted
(`5/5/5/1/1/1` — all present), the authenticated API called directly (500, not empty), and the container log
read for the trace. Only then was the cause known.

## Definition of Done — live status

| # | Gate | State |
|---|---|---|
| 1 | Full unit build (`test + checkstyle + assemble`) **at the committed SHA** | **running** — re-run required because `61545feb` (the ownership index) and `e4bdefdf` (the test hooks) landed after the last green build |
| 2 | FULL integration regression on the working-tree SUT | **not started** — queued behind gate 1 so the two do not contend for the machine |
| 3 | Docs read + decided + **routed AND authored** | **DONE** — `documentation@docs/CTRIB-062-my-data-filter e692c43` off `origin/release/1.0.0`, paired `DOC-504` (`pending-release`, milestone 1.0.0). The push to the shared train stays maintainer-gated. |
| 4 | Ontology re-enriched + committed | **DONE** — the `ReactiveLineageRepositoryImpl` sidecar (its "no visited-set guard, no owner JOIN" claim was made false by this change), manifest advanced to `077313ad`, probes `P-394`/`P-395` |
| 5 | Principal sufficiency review (G-C13) | **partial** — 18 unit + 8 integration cases green, both buckets, RED-proved where applicable; the **rendered-pixel review** of the sidebar group + truncation strip is still owed, and the local **patch-coverage** check runs with gate 1 |

**An uncommitted-HEAD gap was found and closed before it could become false evidence.** A working-tree audit
showed `SearchResultsHeader.tsx`'s `data-testid` hooks were still uncommitted while IT-152 and IT-153 were
passing — and the integration runner builds its SUT from the **working tree**, so those green runs were against
a tree the branch did not contain. The content is identical now that it is committed (`e4bdefdf`), and gate 2
re-runs everything at the committed SHA regardless, so nothing rests on the earlier digests. `LSN-032` names
exactly this trap; it was caught by auditing rather than by assuming.

### Findings filed, not narrated

| Item | |
|---|---|
| `issues/odd-platform/PLT-258` | Sidebar facet dropdowns match **exactly** — the box says "Search by name" but a prefix returns nothing. Measured at the endpoint. |
| `issues/odd-platform/PLT-259` | A **NULL `ownership.title_id` 500s the entire search results page**. The column is nullable, the mapper is not. Same shape as the PLT-147 lock. |
| `backlog/docs/DOC-504` | The paired doc item for the 1.0.0 train (`pending-release`). |
| `backlog/docs/DOC-505` | `data-lineage.md` contradicts itself on "Upstream dependents" — a **released-truth** correction, so docs `main`, never the train. |
| `TST-059` (existing) | Its `search-url-facets.spec.ts` entry is now **stale** — IT-151 passes 4/4 here. Its `search-class-tab-filter.spec.ts` entry is **still live** (that spec still awaits the dead `GET /api/search/{id}/results` at :154, inside the PLT-147 lock). Deliberately **not** fixed: TST-059 owns that class across ten files, and half-fixing a tracked class is how it comes back. |
| `PLT-256` (existing, ctrib061) | Saved searches drop `asset_kinds` — cited, **not** duplicated. |

## Rendered-pixel review (G-C12 step 5) — done, and it raised something a green suite did not

Screenshots taken on a LOGIN_FORM stack running this branch's SUT, signed in as an owner-bound user, and
**looked at** rather than asserted on.

**What the pixels confirm.** The **My data** group renders as designed: the heading, the shared autocomplete
control, two removable chips (`My Objects ×`, `Downstream of my data ×`), the `Downstream depth [2 ▾]` select
appearing **only** because Downstream is selected (upstream's stays hidden), and the query-example exclusion
caption directly beneath. The truncation state renders as specified — the count reads **`1240+ results
(partial)`** and the strip carries the full sentence naming cause *and* remedy. Legible, correctly grouped with
the other filters, no wrapping or contrast problems at 1280px.

To render the truncation state without a >10 000-node lineage graph, the response was intercepted at the
network boundary to set `scopeTruncated` — the flag is server-declared by design, so that is the only way to
drive the view. The *value* of the flag is covered by the unit bucket; this exercised the **rendering** of it.

**The open question the review surfaced.** On that hand-built stack the results list showed `0 results` /
"No matches found" — **including in the baseline screenshot with no My-data scope applied at all**, and with
the search box rendering empty despite `?q=` being in the URL. So it is not the filter. The seeded fixture was
verified present and eligible in that database (both entities `hollow=f status=1 exclude_from_search=f`, both
mirrored into `asset_search_entrypoint`, the ownership row and the user-owner mapping correct), and **IT-153
passes the equivalent baseline assertion on a runner-provisioned stack**, so the difference lies in how that
stack or its page load was set up, not in the ST-8 code path.

**It is recorded as open rather than explained away.** The stack was torn down (`down -v`) before this could be
probed at the API and log level, so the evidence for a conclusion does not exist yet — and "probably the
fixture" is exactly the kind of guess this record is supposed to refuse. It is re-checked before the PR leaves
draft. What it already demonstrates is why the pixel gate exists: a fully green e2e suite and a screenshot
disagreed, and only the screenshot raised it.

## Unit build at the committed SHA — 2 of 765 failed, under investigation

`BUILD FAILED in 37m 5s` — **765 tests, 2 failures, 0 errors**:

| Test | Failure |
|---|---|
| `OpenApiDocsContractTest.platformApiGroupDocumentLoads()` | `IllegalStateException: Timeout on blocking read for 60 s` |
| `LoadIngestionTest.testInjectingManyDataEntities()` | `IllegalStateException: Timeout on blocking read for 60 s` |

Both are blocking-read timeouts rather than assertion failures, on a machine that was simultaneously running
two docker stacks and a Playwright browser — and one of them is by name a *load* test. That is a strong
environmental signal, **but it is not being taken as one**: this change edits the OpenAPI specification, and
`OpenApiDocsContractTest` loads the generated API document, so a hang there could plausibly be mine. Both are
re-running in isolation on a freed machine. If they fail again, they are mine.

## The two unit failures — the A/B, and what each outcome means

Both failures **reproduce in isolation on a freed machine** (`BUILD FAILED in 12m 41s`, same two cases, same
`Timeout on blocking read for 60 s`). So the load theory is dead: this is real and deterministic.

**What is already known, without guessing:**

- `OpenApiDocsContractTest` is the **regression guard for PLT-141 / #1759** — springdoc 2.2.0 × Spring 6.2
  throws `NoSuchMethodError` walking `@ControllerAdvice` to build response schemas, Reactor treats it as
  fatal, and the spec request **hangs forever**. A 60 s blocking-read timeout is that bug's exact fingerprint.
- **But both trees pin springdoc `2.8.17`** (`gradle/libs.versions.toml:25`) — the fixed line — and this
  branch **changes no build file** (`git diff --name-only 82e7e70e..HEAD` matches no `build.gradle` /
  `libs.versions.toml`). So a version regression is ruled out.
- Both failing tests are `WebTestClient` tests with a 60 s client timeout; the other **763 tests pass**, so the
  Spring context itself starts.
- **Prior evidence points at this branch, not at main:** `/review CTRIB-059` recorded a full build at this
  branch point of **747 tests / 0 failures**, which would have included `OpenApiDocsContractTest`.

**The A/B now running** is the same two tests on a clean detached worktree at `origin/main` `82e7e70e`
(`../odd-platform-ctrib062base`, created for this rather than borrowing ctrib060's).

| Outcome | Meaning | Next step |
|---|---|---|
| Baseline **RED** | pre-existing on `main`; this branch inherits it | file it as a finding, cite the A/B in the PR, proceed |
| Baseline **GREEN** | **the failures are mine** | **no PR.** Bisect the branch's 8 commits against these two tests — the contract commit `54f3cb91` is the first suspect, since it is the only one that changes what springdoc reflects over |

Recording the decision rule **before** the result so the conclusion is not fitted to whichever answer arrives.

## CORRECTION — my "isolated" re-run was not isolated, and the A/B is not yet valid

The A/B baseline run was killed mid-flight, and checking the machine explains why — and invalidates the
inference I had started to build on it.

`ps aux --sort=-%mem` shows **`ctrib061` running its own gradle test build**: four worker JVMs under
`odd-platform-ctrib061/odd-platform-api/build/tmp/test/work` totalling **~4.6 GB**, plus its Testcontainers
(five live ryuk containers), on a **15 GB box with ~2 GB available**.

So the sequence was:

| Run | What I believed | What was actually true |
|---|---|---|
| full build, 37 m, 2/765 timeouts | "two stacks + a browser were competing" | ALSO competing with ctrib061's build |
| "isolated" re-run, 12 m 41 s, same 2 timeouts | "machine freed — so this is real, not load" | **NOT freed.** I tore down *my* stacks; the neighbouring stream's build was untouched and invisible to me until I looked |

**Both of my data points are contaminated, so the conclusion drawn from them — "reproduces in isolation,
therefore deterministic and probably mine" — is withdrawn.** Two `WebTestClient` tests with a 60 s client
timeout are exactly what memory starvation looks like, and `LoadIngestionTest` is by name the heaviest test in
the suite.

This does not prove the failures are environmental either. It proves **I do not yet have a clean measurement**,
and the honest state is *unknown*, not *inherited* and not *mine*. The decision rule recorded above still
stands; it simply cannot be evaluated until the box is genuinely quiet.

**Methodology finding, worth more than this slice.** `playbooks/stream-coordination.md` serialises the heavy
e2e regression behind a machine-wide flock but states that "the cheap buckets (unit …) parallelise freely".
That is true for CPU and **false for memory on this box**: two concurrent Testcontainers-backed unit suites
starve each other, and the symptom is not an obvious OOM — it is a handful of 60-second `WebTestClient`
timeouts that read exactly like a product defect. It cost a full investigation cycle here, and it will do so
again. Logged as a follow-up rather than narrated.

Nothing of ctrib061's is touched (O10) — the correct move is to wait for its build to finish, not to reclaim
memory from a live neighbour.

## A process failure of my own, recorded because it nearly destroyed a neighbour's work

While filing the contention finding I ran the id check, **read output that said `TST-060` already existed**,
and wrote to that path anyway. It was a tracked file belonging to the `ctrib060` stream (commit `030b2dc2`),
and the write overwrote it.

Caught within seconds by `git status` showing `M backlog/tests/TST-060.md` on a file I had believed to be new,
and restored with `git checkout --` to its committed content (verified: the file is back, `git status` clean,
nothing lost). My own draft was preserved to the scratchpad first, then re-filed as **`TST-061`**.

This is not a near-miss worth glossing. It is precisely the failure `feedback_id_enumeration_canonical_tracker_only`
and `LSN-009` exist to prevent, it happened **after** I had cited that discipline in this very record when I
avoided duplicating `PLT-256`, and only luck of ordering (`ls` before `cat` in one command, whose output I then
ignored) made it visible. The rule is not "run the check" — it is **read the answer before writing**. A
`test -e` guard before any new-file write would have made it impossible; running the check and overriding it
manually is worse than not running it, because it manufactures false confidence.

The silver lining is substantive: `TST-060` turns out to be the **same coordination gap seen from the e2e
side**, filed by `ctrib060` the same night — and it records `ctrib062-*` containers appearing inside their
flock window, meaning **this stream contributed to the contention that made their verdict unreadable**. So
`TST-061` is filed as the unit-bucket sibling with an explicit cross-link, and the provenance note says plainly
that my stream is on the other side of that collision.
---

## §17 — `OpenApiDocsContractTest` A/B: settled by control-normalisation, not by a quiet box

The two unit failures carried into this session as *unknown* (§15/§16). One is now closed; the other is
**resolved as change-independent** on evidence, not on a shrug.

### `LoadIngestionTest.testInjectingManyDataEntities()` — CLOSED, contention only

Isolated re-run on the branch: **PASS**. It failed only in the run that was starved by a co-active build.
No further action.

### `OpenApiDocsContractTest.platformApiGroupDocumentLoads()` — the measurement, and my own error in it

`odd-platform-api/build.gradle:170` sets `maxParallelForks = availableProcessors / 2` = **4** on this 8-core
box. My first "isolated" re-run passed `--tests "*OpenApiDocsContractTest*" --tests "*LoadIngestionTest*"` —
so a **bulk-ingestion load test ran in a parallel fork, with its own Testcontainers Postgres**, against the
springdoc test. I built the contention I was trying to measure away. That is measurement #3 discarded.

Measurements #4/#5 were then taken one command apart — and `ps` for `GradleDaemon|GradleWrapperMain` had
reported a clean box, which is **the wrong pattern**: gradle's test workers are
`java -Dorg.gradle.internal.worker.tmpdir=<worktree>/…`, matched by neither name. ctrib061 was in fact
mid-build in both windows.

| SUT | `swaggerConfig` | `ingestionApi` | `platformApi` | verdict |
|---|---|---|---|---|
| `origin/main` `82e7e70e` | 15.086s | 7.230s | **59.693s** / 60s | PASS by **307 ms** |
| branch (8 commits) | 29.887s | 13.487s | ≥60.337s (censored) | RED |

### Why this is change-independent — the internal control

The two sibling tests are a **control my change cannot touch**: the `ingestion-api` document contains none of
this slice's schemas, and `swagger-config` is a static two-name list. Both **~1.94x**. So the whole run was
~2x slower; `platformApi` reads only +1.1% because it is **censored at its own bound**.

Control-normalised: baseline `platformApi / controls` = **2.675**. Branch = **≥1.391** — i.e. relative to the
box, `platformApi` was *cheaper* on the branch, the opposite of a change that adds cost.

**Falsifiable prediction, recorded BEFORE the uncensored run:** if this slice adds nothing, the branch's
uncensored `platformApi` = `59.693 x 1.944` ~= **116s**. (Diagnostic only: the 60s bound was raised to 300000
for that one run and restored in the same command; `git status` asserted clean afterwards. The committed test
is untouched — G-C15.)

### The structural argument that makes it conclusive

This slice adds **0 operations, 0 paths, 0 controllers, 0 `@ControllerAdvice`** — `git diff --stat
origin/main..HEAD -- odd-platform-specification/` is 55 insertions in `components.yaml`: five scalar
properties on two schemas already in the document. springdoc's cost is walking **191 operations**; five plain
`string`/`integer` properties cannot produce a hang, because only a schema **cycle** can, and scalars cannot
form one.

And the shape is diagnostic: **PLT-141 hangs BOTH group documents** (`CTRIB-008.md:274`). Here
`ingestionApiGroupDocumentLoads` and `swaggerConfigListsBothGroups` **pass**. This is not that bug.

### The finding that outlives this slice

`TST-057` recorded this operation at **17.79s idle**. It now measures **59.693s on clean `main`** — 99.5% of
its bound **with none of my code present**. The test no longer discriminates: it measures the box. Any PR
touching this repo can false-RED on it, which is TST-057's own stated worry ("a false RED here blocks a
public PR"). Extended there with this measurement rather than fixed here — the remedy is out of #1842's
scope (G-C5), and the item explicitly asks to be sized against a measurement.

---

## §18 — the pixel review's `0 results`: closed as change-independent, NOT as explained

Carried in as OPEN. Two questions were conflated in it, and they have different answers.

**Q1 — could this slice have caused it? No, structurally.** The pixel-review baseline screenshot had **no
My-data scope applied**. `AssetSearchServiceImpl:92` takes the unscoped path and passes `scope = null`, and
condition (5) in `ReactiveAssetSearchRepositoryImpl` is guarded by `if (scope != null && scope.active())`. The
code this slice adds is **never entered** for an unscoped search, so it cannot alter that result set. This is a
reachability argument, not a plausibility one: there is no input for which the new predicate participates in an
unscoped query.

Corroborating evidence from the opposite direction: **IT-153 passes 4/4 on a runner-provisioned LOGIN_FORM
stack**, including the assertion that a bound owner's scoped search returns the owned entity — the same
surface, the same auth mode, results present.

**Q2 — what actually produced `0 results` on that stack? UNESTABLISHED, and I am not going to invent a
cause.** The candidate explanations (an empty query term against an FTS index that requires one; a fixture
that was seeded but not FTS-indexed via `updateDataEntityVectors`; a stack whose seed had not completed when
the screenshot was taken) are all plausible and I have evidence for none of them, because **the stack was torn
down (`down -v`) before it could be probed**. That was my error: the anomaly was observed, and the environment
that produced it was destroyed before the observation was chased.

**Disposition.** Closed as *not attributable to this change*, on the reachability argument plus IT-153's
contrary evidence — and recorded as *unexplained* rather than resolved. If it recurs on any stack, the first
move is to probe `search_entrypoint` for the fixture's row before touching application code; the memory
`reference_odd_platform_search_fts_test_seeding` records that a raw `data_entity` INSERT is invisible to
search until the vectors are updated, which is the most likely of the three candidates and the cheapest to
check.

**Process note:** "tear the stack down, then reason about what it showed" destroys the only evidence that could
settle it. A stack that has produced an anomaly is evidence and should be probed *before* teardown, or
preserved. This is the same class as `LSN-031` (verify the running system) reached from the other end — the
running system was available and was discarded instead of interrogated.

---

## §19 — REOPENED: the uncensored A/B indicts the slice, and the honest reading is "suspected", not "owned"

§17 closed the springdoc RED as change-independent on censored data. **Uncensored measurement reopened it.**

| SUT | condition | controls | `platformApi` |
|---|---|---|---|
| `origin/main` `82e7e70e` | uncensored, flock-held, quiet | **7.283s** | **24.156s** |
| branch (8 commits) | uncensored, flock-held | 14.492s | **43.750s** |

**The pre-registered rule fired against me.** Recorded before the run: *"if main comes in near 43s my change
costs nothing; if near 25s, my slice costs ~18s and I own it and hold the PR."* Main came in at **24.156s**.
The PR is HELD.

**What is NOT established, and I am not going to overstate it.** The two runs differ ~2x in load (controls
7.283 vs 14.492), so they are not like-for-like. Control-normalisation would rescue the slice here
(platformApi scaled 1.81x while controls scaled 1.99x — i.e. *less* than the box), but that is the exact
normalisation withdrawn earlier in this record as unsound, and it does not become sound by favouring me.
So the 43.750s is **un-attributed**, not attributed to this slice. The correct interim status is
**SUSPECTED, pending one like-for-like measurement** — a distinction pressed by the ctrib061 stream against
its own interest, and it is right.

**What IS established, and it cuts both ways:**

- **The ordering confound is constant within a class.** JUnit 5's default method ordering is deterministic for
  a given class, so springdoc's reflection walk lands in the same position in every run of
  `OpenApiDocsContractTest`. That legitimises the 24 -> 44 comparison *within* this stream, and kills
  cross-stream ratio comparisons dead.
- **No mechanism.** `git diff --name-only origin/main..HEAD` over `*/src/main/java/*` is 12 files: DTOs,
  repositories, services. **Zero controllers, zero `@ControllerAdvice`, zero request mappings** — springdoc's
  document build walks none of them. The only surface this slice presents is 5 generated scalar properties on
  2 of 317 schemas. A 19s cost from that is not merely implausible, it has **no proposed mechanism at all**.

So the mechanism says impossible and one measurement pair says 19s. One of them is wrong. Resolving which is
the next action, and it gates the PR: **if the cost is real, this does not ship** — the structural argument
would then be broken, which matters far beyond this slice.

---

## §20 — RESOLVED: the slice costs nothing; the 43.750s was load

The like-for-like measurement, flock-held, quiet box, uncensored:

| SUT | controls | `platformApi` | delta vs main |
|---|---|---|---|
| clean `origin/main` `82e7e70e` | 7.283s | 24.156s | — |
| **this branch** | **7.677s** | **23.122s** | **-1.034s** |
| ctrib061's branch (independent slice, 1 added property) | 7.196s | 20.671s | -3.485s |
| this branch, earlier, at 2x load | 14.492s | 43.750s | (the number that reopened it) |

**Three measurements at controls 7.2-7.7s all land in 20.7-24.2s.** Two independently spec-changing branches
and one clean main are indistinguishable. This slice is **1.034s FASTER** than main under equivalent
conditions. The 43.750s was the box.

**Verdict: change-independent — now established by measurement, not by argument.** §17 reached the right
conclusion on wrong evidence (censored data + an unsound control-normalisation); §19 correctly reopened it;
§20 settles it. The intermediate wrong-for-the-right-reasons state is left in the record deliberately.

### The methodological lesson — pre-registration is necessary and NOT sufficient

The rule pre-registered in §19 (*"main near 25s => the slice costs ~18s, hold the PR"*) **fired, and it very
nearly convicted a correct change.** Honouring it literally would have held a good PR and sent me hunting a
19s regression that does not exist, in code with no mechanism to produce one.

What prevented that was **refusing to resolve the rule on a comparison whose two arms were taken under
different load** (controls 7.283 vs 14.492 — a 2x difference). So:

- **Pre-registration** protects against post-hoc rationalisation — choosing the reading that suits you *after*
  seeing the number. It is why the PR was held rather than explained away.
- **Like-for-like conditions** protect against a different failure: a rule firing correctly on an
  **incomparable pair**. Pre-registration is silent about this, because it fixes the *interpretation* in
  advance, not the *validity of the inputs*.

Either discipline alone ships a wrong conclusion here. The pair of them is the actual method:
**fix the interpretation before the result AND refuse to interpret arms that are not comparable.**

### What the whole episode cost, and the one guard that would have prevented all of it

Six measurements were taken and **five discarded**: one killed by a neighbour's unscoped `pkill`, one where I
paired the subject with a load test under `maxParallelForks=4`, two taken while a neighbour build was live and
invisible to a `pgrep GradleDaemon|GradleWrapperMain` check that cannot match gradle's workers, and one
censored at its own bound. The single guard that would have made every one of them valid is the one now agreed
between the two streams and filed in `TST-061`: **anything that starts a JVM test worker takes the flock.**

`TST-057`'s remedy sizing is now measurable: **~21-24s quiet, 48-60s loaded, against a 60s bound.** Quiet, the
bound has ~36s of headroom; loaded, essentially none. The remedy is not a bigger number — it is that a
correctness guard must not be gated on a wall-clock bound whose margin varies 3x with unrelated machine load.

---

## §21 — OWED: the perf gate's Phase-D re-measurement on the real SUT

Surfaced by applying the ctrib061 stream's own lens — *"a documented performance claim with no measurement
behind it"* — to this slice. It has one.

**The acceptance criterion I wrote** (`## Spec`, R-perf): *"EXPLAIN shows an index scan (not a seq scan) for
both directions, **and the FTS bitmap scan still drives the ranked query** (the scope semi-join must not
become the driver). Latency bound: at `downstream_depth=3` over a scope that reaches the 10 000-node cap, on a
catalog of >= 100 000 indexed assets, `POST /api/search/assets` returns in **< 1 s**."* And M3 closes with:
*"The Phase-D gate re-measures this on the real SUT."*

**What exists:** M1-M5 — real EXPLAIN output, real timings, on a 200 000-row fixture. They caught a 218x
design error (M3) and a 22x missing index (M4), and rejected an "obvious" optimisation (M5).

**What does NOT exist: the Phase-D re-measurement.** Every one of M1-M5 was taken **plan-time, against
hand-written probe SQL, on a throwaway Postgres**. None went through the running application. The gap that
matters is not arithmetic — it is that **jOOQ generates the query, not me.** The measured claim is about a
predicate *shape*; if the generated SQL differs from the probe SQL in any way that changes the plan (a cast, a
different join order, a materialised subquery), the FTS bitmap could stop driving and every M3 number would
describe a query the platform never issues.

A code comment currently asserts the conclusion outright:
`ReactiveAssetSearchRepositoryImpl:327` — *"keeping the predicate off the join is what preserves the
FTS-bitmap-driven plan."* That sentence is true of the probe SQL. It is **unverified of the shipped query**.

**Disposition: OWED, and it gates the PR** — this is the issue's headline deliverable ("own perf gate"), not a
nice-to-have. It runs after the regression releases the box:

1. Seed the dense fixture on the SUT stack (>= 100k indexed assets, a scope reaching the 10k cap).
2. Capture the **generated** SQL (jOOQ debug logging / `pg_stat_statements`), not the probe SQL.
3. `EXPLAIN (ANALYZE, BUFFERS)` it — assert the FTS bitmap is still the driver and the scope is a hashed
   semi-join, not a per-row re-scan.
4. Time `POST /api/search/assets` at the ceiling against the < 1 s bound.

If the generated plan differs from M3's, the comment gets corrected and the shape gets fixed — the same way
the R3 depth-degradation overclaim was corrected rather than explained away.

---

## §22 — the full regression: 19 non-expected failures, ONE of them mine

`integration-tests/run-regression.sh ctrib062`, SUT `odd-platform:odd-team-sut-ctrib062`
(`sha256:c763c52a…`), flock held throughout.

| suite | result | reading |
|---|---|---|
| `feature-complete` | **18 failed / 328 passed** (31.1m) | all 18 attributed, none to this slice |
| `known-bugs` | **3 failed** | EXPECTED — RED is this suite's pass condition |
| `multi-stack` | **1 failed / 12 passed** (11.6m) | **the one real finding, and it is mine** |
| `ingestion-e2e` | **15 passed** (4.7m) | green |

### The 18, reconciled to the line — arithmetic, not assertion

| cause | n |
|---|---|
| `TST-059` stale-spec class (gate on `GET /api/search/{id}/results`, which ST-4 retired — the UI never calls it) | 11 |
| ctrib061's **unmerged ST-7** favorites specs (`FavoritesFilter` absent from `origin/main` AND this worktree) | 6 |
| `TST-057` cold-springdoc `swagger-openapi-discovery:63` (already A/B-proved change-independent) | 1 |

`TST-059` documents **15** in its class and only **11** appeared: this slice re-pointed three
(`search-url-facets:112/:143`, `search-class-tab-filter:101`) and ctrib061 deleted the fourth. **15 - 3 - 1 =
11.** The baseline is corrected in `TST-059` so the next stream does not diff against a list that decayed.

### The one that IS mine — and why "flake, bump the timeout" was the wrong answer

`my-data-scope-narrows.spec.ts:210` (IT-153) failed on its *first* test, at the plainest assertion in the file
— `baseline lists my entity` — while tests 2-4 passed **against the same fixture**. It had been 4/4 green in
isolation, twice.

The tempting reading is a load flake. It is not, and the distinction matters: **`openSearch` already waits for
the results header, so the search had RESOLVED** — it simply did not contain the seeded row. The assertion was
not the thing that needed to settle, so a longer timeout would have changed nothing except how long it took to
fail.

**The defect is structural and mine: the spec asserts a fixture is visible without first establishing that it
IS searchable.** `integration-tests/TEMPLATE.md` prescribes `seed -> readiness -> run -> assert`; this spec had
no readiness step. It only surfaces in suite context because a preceding `multi-stack` spec
(`auth-mode-boundary`) tears the LOGIN_FORM stack down, so this file's `beforeAll` boots a **fresh** platform
and its first query hits it cold — a condition no isolated run reproduces.

Fixed with a real readiness gate (`waitUntilSearchable`) that polls the user surface until the seed is served
and **fails loudly with a diagnostic if it never does**. That distinction is the point: a timeout bump would
have silently converted a *readiness* failure into a *scope* failure, and the My-data assertions are
meaningless against a catalog that cannot serve the fixture at all — a false green on the exact claim the
protocol exists to prove.

**This is the second sighting of the symptom.** §18 closed the pixel review's `0 results` as
change-independent but explicitly *unexplained*, with the note that the stack had been destroyed before it
could be probed. Same shape: a seeded fixture absent from search on a freshly-booted LOGIN_FORM stack. §18's
disposition stands (this slice cannot reach an unscoped search), but the cause is now much more likely
**platform readiness after boot** than anything about the fixture — and IT-153's gate is what will catch it
next time instead of a screenshot nobody can re-probe.

### §22b — IT-153 verified, and two corrections to how I reported it

**Verification: 4/4 consecutive COLD-boot runs green** (`down -v` before each, `healthy after ~42s`, 1.8m
each), against **2 cold failures** before the gate. The condition that failed is the condition that was
re-tested.

**Correction 1 — I verified against a FOSSIL SUT and nearly acted on it.** The first verification returned
"4 failed" and my first reading was that the fix had made things worse. It had not: bare `run-suite.sh IT-153`
(without `ODD_STREAM` / `ODD_PLATFORM_DIR`) builds from the **shared** `../odd-platform` worktree — it logged
`WORKING TREE @ c54b9c61+uncommitted`, not this branch. Every test failed because the SUT had no My-data
feature, so `search-results-count` — a component this slice ADDS — did not exist in the build under test.
Textbook `LSN-033`. `run-regression.sh ctrib062` had been doing that plumbing silently all along.

Two things made it catchable: the failure was **uniform** (all four at the same assertion, including tests that
never touch the new helper — a real defect in the fix would have failed selectively), and **`EXIT=0` despite 4
failures**, which is exactly why the rule is *read pass/fail counts, never exit codes*. Reuse of the tag was
then made safe by verifying the image **digest** against the one the regression logged
(`sha256:c763c52a…`), not by trusting the tag name.

**Correction 2 — I called the failure "deterministic". It is not.** The record is 2 cold failures and 1 cold
pass at the point I wrote that; it is **intermittent**. A single green under the failing condition proves
nothing about an intermittent defect, which is why the verification is 4 runs rather than 1. The first green
after the fix was also on a **warm** stack (1.8m vs 4.0m, no "recreating" line) — accepting it would have
repeated the fossil-SUT error in a different costume: a pass obtained under conditions that do not exercise
the thing being verified.

**What the gate is actually worth.** It converts an opaque `toBeVisible` timeout into a labelled readiness
failure that reports the rendered page state — header text plus every visible row — so the next occurrence
answers its own question: catalog serving nothing (readiness budget too short) versus serving everything
except this row (an indexing gap, a product finding). §18's `0 results` is unexplained precisely because the
stack was destroyed before it could be probed; a test whose `afterAll` destroys its own evidence will keep
producing unexplainable failures, so the diagnostic belongs IN the test.

---

## §23 — Phase E: draft PRs open, GATE 2 handoff

| Artefact | URL |
|---|---|
| **Code (draft)** | https://github.com/opendatadiscovery/odd-platform/pull/1871 |
| **Docs (draft, on `release/1.0.0`)** | https://github.com/opendatadiscovery/documentation/pull/110 |
| Branch | `contrib/CTRIB-062-my-data-filter` @ `94b2a2c8` (10 commits off `origin/main` `82e7e70e`) |
| Docs branch | `docs/CTRIB-062-my-data-filter` (2 commits off `origin/release/1.0.0`) |

**Push safety asserted before each push (LSN-038):** no upstream on either branch,
`push.default=current`, `branch.merge` unset, `origin/main` verified unmoved at `82e7e70e`, both worktrees
clean. Both PRs are **draft** and bot-authored — G-C4 means this stream cannot merge them.

### Definition of Done — final status

| # | Gate | Evidence |
|---|---|---|
| 1 | Full unit build green on the working tree | **773 tests, 0 failures, 0 skipped**; checkstyle re-run green at the final SHA after the comment edit |
| 2 | FULL integration regression | 4 suites run: `feature-complete` 328P/18F (**all 18 attributed elsewhere**), `known-bugs` 3 RED (its pass condition), `multi-stack` 12P (the 1 failure was mine — fixed, **verified 4/4 cold**), `ingestion-e2e` 15P |
| 3 | Docs read, decided, routed AND authored | Committed on the `release/1.0.0` train, verified at the SHA, one **broken link found and fixed**, corpus sweep clean |
| 4 | Ontology refreshed + committed | Sidecar current (source unchanged since `enriched_at_commit`); graph layer is ephemeral by design, not a deliverable |
| 5 | Principal sufficiency (G-C13) | **Changed-lines coverage 115/115 = 100%** vs CI's 98%; pixel review done; i18n verified by rendered keys across all 7 locales |

**One gate closed with a narrowed claim, not a green tick.** The perf evidence (M1-M5) is real and caught a
218x design error and a 22x missing index — but it was taken on probe SQL, not the complete shipped query. The
code comment now says exactly that, and the residual is `TST-063`. GATE 2 decides whether it blocks merge; it
is not presented as satisfied.

### Follow-ups this slice leaves behind

| ID | What |
|---|---|
| `PLT-258` | facet-options search is exact-match, not prefix — measured live |
| `PLT-259` | a NULL `ownership.title_id` 500s the whole results page (high) |
| `DOC-504` | paired doc item, `pending-release`, milestone 1.0.0 |
| `DOC-505` | `data-lineage.md` self-contradiction (released truth) |
| `TST-061` | the coordination substrate governs activities, not resources — **three faces**: memory contention, an unscoped `pkill`, and a kill-unsafe diagnostic restore |
| `TST-063` | the perf claim is measured on the isolated predicate, not the shipped query |

**Corrections to existing tracked items** (both contained wrong information, one of it mine):
`TST-057` — retracted a **phantom regression** this stream had written into it, which would have sent the next
reader hunting a non-existent 3.4x slowdown. `TST-059` — baseline corrected from **15 to 11**, since three
specs this slice re-points now pass and one was deleted by a sibling stream.

---

## Review (2026-08-31, session: review-ctrib062) — REJECTED → `blocked`

Separate-session gate satisfied (implement was the prior `ctrib062` session; this session opened cold on the
committed branch). Reviewed: `contrib/CTRIB-062-my-data-filter` @ **`94b2a2c8`** (10 commits off `origin/main`
`82e7e70e`, draft PR #1871) + `documentation@docs/CTRIB-062-my-data-filter` @ **`b4c5889`** (2 commits off
`origin/release/1.0.0`, draft PR #110).

**No 2-minute precondition bounce.** The DoD carries no "NOT RUN" admission, and run-logs exist for all four
suites at SUT digest `sha256:c763c52a…` — which I verified *is* the reviewed tree: the image was built
2026-08-31T11:21:44Z, after `f8edfdb2` (10:59Z) and before `94b2a2c8` (13:57Z), and `git show 94b2a2c8` is
**one file, 11 insertions, every changed line a `//` comment**. So the SUT is functionally the reviewed commit.

This is a strong, unusually honest slice. The rejection is **not** a re-litigation of its record — most of what
it claims, I re-derived and it holds. It is rejected on four things that are not yet true.

### Acceptance criteria (the item's own Spec R1-R8)

| | Verdict |
|---|---|
| **R1** scope group narrows the cross-kind search | **PASS** — `AssetSearchScopePredicateTest` (Testcontainers, real Postgres) covers narrow-per-kind / lineage-excludes-terms / MY_OBJECTS ∪ lineage / empty-lineage-narrows-to-nothing / no-scope-unnarrowed; IT-153 drives the rendered list through a real login, 5 PASS entries at digest `c763c52a` in `integration-tests/run-log/2026-08-31-IT-153.md`. |
| **R2** ownership per kind | **PASS** — `ReactiveAssetSearchRepositoryImpl.java:331-360` (`OWNERSHIP` branch ∪ `TERM_OWNERSHIP` branch, kind-guarded outright, no pass-through); query examples are unreachable by both branches, so they are excluded by construction. Caption rendered (`MyDataFilter.tsx:135-139`) and documented (`search.md`). |
| **R3** per-direction depth, default 1, ceiling 3 | **PASS** — `MyDataScopeResolverImpl.clampDepth:112-114`; FE `parseDepth` (`searchUrlState.ts:240-244`); the spec descriptions were corrected *after* the running system contradicted them (§ Live-system verification, the 200/200/200/400 matrix). Gap, minor: the resolver's clamp is tested only upward (`MAX_DEPTH + 5`), never at `0`/negative. |
| **R4** bounded expansion, truncation visible | **FAIL** — see B1, B3, B4 below. (a) determinism + `NODE_CAP` + the response stamp: PASS. (b) "the page shows the strip and a qualified count": **no automated coverage at any level**. (c) EXPLAIN + FTS-driver + `< 1 s`: **never measured on the shipped query**. |
| **R5** tab retired, count survives | **PASS** — strip deleted; `SearchResultsHeader` rendered **outside** the `!routerSearchId` gate (`Results.tsx:158-165`), which is the W5 trap correctly avoided; IT-152 asserts no `role=tab`, the count, and `0 results`. |
| **R6** panel deep-links | **PASS** — `OwnerEntitiesList.tsx:107,113,121` via the shared `buildSearchLink`, so a link-written URL is byte-identical to the mirror's. Note: `DataEntityList.tsx:80` hides *View all* when the panel is empty; defensible, outside R6's stated acceptance. |
| **R7** posture | **PASS on the two asserted arms** (DISABLED-hidden in IT-152, bound-enabled in IT-153). The **unbound** arm has no automated coverage at all, and the doc mis-describes it — S6. |
| **R7b** Clear All clears the scope | **PASS by code read** (`Filters.tsx:36-41` drops `myData` + both depths, preserves query + sort) — **no test anywhere**. S3. |
| **R8** additive contract | **PASS** — `MyDataScopeDto.resolve`; FE legacy `?my=true` → `['MY_OBJECTS']`; still emits `my_objects` for the DE session so the shipped sidebar behaviour is unchanged. Covered in `MyDataScopeDtoTest`, `AssetSearchServiceMyDataTest`, `searchUrlState.test.ts`, `searchFormDataToUrlState.test.ts`, and live (`my_objects: true` alone → 200). |

### Quality Bar

- **Gate 1 — No duplicates: PASS.** `FixedOptionsMultiFilter` reused rather than a parallel multiselect; `buildSearchLink` extracted so the navigator, the three `<Link>`s and the mirror share one construction; `PLT-256` cited, not re-filed.
- **Gate 2 — Aliases: PASS.** `my_objects → my_data` is the alias, declared `deprecated: true` with the mapping rule stated in the schema description (`components.yaml:2467-2474`) and honoured in one place (`MyDataScopeDto.resolve`).
- **Gate 3 — Caveats as admonitions: PARTIAL.** The NODE_CAP partial-set caveat is a `{% hint style="warning" %}` in `search.md`, correctly. The **TIMEOUT** outcome — a different message and a different result — has no doc coverage at all (S5).
- **Gate 4 — Consumer-read: PASS.** Verified first-hand end-to-end: `searchUrlState.ts:340` → `FacetStateMapperImpl.mapForm:78` → `SearchFacetsData.my_objects` (`components.yaml:1723`) → `dataEntitySearch.slice.ts:150` → `dataentitySearch.selectors.ts:113` → `Filters.tsx:77`. That read is also what produced S1.
- **Gate 5 — Unset-parameter audit: N/A** (no SDK builder in scope).
- **Gate 6 — Bidirectional code ↔ doc: FAIL.** Three user-visible paths this change ships have no doc coverage or wrong doc coverage: the TIMEOUT outcome (S5), the unbound posture as actually rendered (S6), and the Type-facet interaction (S1, where the doc says the opposite of the code).
- **Gate 7 — Layout: PASS.** No inbound anchor pointed at the retired `#result-class-tabs` (grepped the whole `docs/` tree + `SUMMARY.md`); all four links added by the doc diff resolve (`search.md#my-data`, `catalog-overview.md#recommended`, `../data-lineage.md`, the user-owner-association page); no new page, so no SUMMARY entry due.
- **Gate 8 — Publishing: PENDING-RELEASE (1.0.0), branch-verifiable half PASS.** The doc is genuinely **authored on the train** — `origin/release/1.0.0` exists and `docs/CTRIB-062-my-data-filter` carries `e692c43` + `b4c5889` — so this is not the CTRIB-040 "drafted, never authored" failure. Frontmatter parses; both `description:` values are unchanged and well under 200 chars; links are tree-relative. Live verification is owed at the 1.0.0 gate.
- **Gate 9 — Factual claim provenance: PASS.** No `Sources:` footer (the contributor pillar does not use one — same posture accepted at `/review CTRIB-059`); provenance is inline in the commit bodies and I re-derived the load-bearing ones rather than trusting them: the SUT-digest↔commit correspondence (above), the IT-153 5×PASS run-log, the FE suite (below), the migration lane (`V0_0_101` free — `V0_0_100` is ST-5c's in all four worktrees), and the i18n claim. The one claim the record itself marks unproven (the perf comment) is now scoped correctly in-code by `94b2a2c8` — the *comment* is honest; the *criterion* is still unmet.
- **Gate 10 — Content-type homing: PASS.** Filter semantics on `search.md`, panel behaviour on `catalog-overview.md`, wire contract in `components.yaml`. Nothing API-reference-shaped embedded in a feature page.
- **Gate 11 — Audience isolation: PASS.** Mechanical grep over every `+` line of the doc diff for `Cornerstone N` / `Gate N` / `LSN-` / `ST-N` / `CTRIB-` / `DOC-` / `IT-` / `TST-` / `PLT-` / `#18xx` / `backlog` / `sidecar` / `playbook` / `retrospective` → **zero hits**. The operator-facing prose names no workspace-internal artefact.

### What I measured myself

- **FE typecheck** — `tsc --noEmit` on `94b2a2c8`: **clean**, against locally-regenerated `generated-sources` that do carry `myData` / `upstreamDepth` / `scopeTruncated`.
- **FE unit suite** — `vitest run`: **163 passed / 1 failed (164), 33 files**. The one failure is `DataSourceItem.test.tsx > REJECTED delete → the dialog STAYS OPEN` (a 5000ms timeout, `Management/DataSourcesList` — outside every file this diff touches). **A/B-proved change-independent rather than assumed**: run alone it is **2/2 GREEN on the base `82e7e70e`** and **2/2 GREEN on the reviewed `94b2a2c8`**; it fails only inside the full suite under load. This confirms the implementer's "163/164, 1 unrelated flake" — first-hand, not on trust.
- **i18n** — all **11** new keys present in **all 7** locales, all genuinely translated (0 identical-to-English outside `en`); the two removed keys (`Upstream dependents`, `Downstream dependents`) have **no remaining consumer** in `src/` — so no fallback leak.
- **Ontology** — `lineage/**` clean; the `ReactiveLineageRepositoryImpl` sidecar is current (`enriched_at_commit: 077313ad`, and that file is untouched from `077313ad..94b2a2c8`) and genuinely re-derived, down to the per-request statement budget (`≤ 6 lineage statements per request`) — which is itself evidence for B1.

**I did NOT run the full unit build or the four-suite regression, and that is a deliberate choice, stated so it is not mistaken for a pass.** The item requires rework that changes production code (B3, S1) and test code (B4, S2, S3); a confirmation regression run now would be invalidated by the fix and would burn the shared box while `ctrib061` is live on it. The confirmation run belongs to the re-review, on the reworked SHA — and B2 means it has to happen anyway.

### The fix-list — one pass, not a loop

**BLOCKERS**

**B1 — the perf gate, which is this issue's headline deliverable, is still unmeasured on the query the platform actually issues.** §21 says so itself and disposes it as *"OWED, and it gates the PR"*; §23 then opened the PR with it narrowed to `TST-063` for GATE 2 to decide. That is the maintainer being made the QA gate for a measurement this stream can take. Run the four steps §21 already wrote: seed the dense fixture on the SUT stack (≥100k indexed assets, a scope reaching the 10k cap), capture the **generated** SQL (jOOQ debug logging / `pg_stat_statements`), `EXPLAIN (ANALYZE, BUFFERS)` it — assert the FTS bitmap is still the driver and the scope is a hashed semi-join, not a per-row rescan — and time `POST /api/search/assets` at `downstream_depth=3` against the `< 1 s` bound. Include the **per-page** cost: the resolver re-runs on every infinite-scroll page, so the sidecar's own `≤ 6 lineage statements per request` plus the `count()` query is paid per scroll, not once per search. If the generated plan differs from M3's, fix the shape — the same way R3's overclaim was corrected rather than explained away.

**B2 — the `multi-stack` suite never went green at the reviewed SHA.** `integration-tests/run-log/2026-08-31-multi-stack.md`, digest `c763c52a`: `outcome: e2e:FAIL`. The IT-153 defect was then closed with five targeted `run-suite.sh IT-153` runs — but §22's own root cause is that the failure *only surfaces in suite context*, because a preceding `multi-stack` spec (`auth-mode-boundary`) tears the LOGIN_FORM stack down and this file's `beforeAll` then boots cold. A targeted run does not reproduce the condition the fix targets. Re-run `multi-stack` **whole**, read the pass/fail counts (not the exit code), and record the counts in the run-log entry.

**B3 — on `TIMEOUT` the results header prints a bare, unqualified total, and the warning contradicts the code.** `SearchResultsHeader.tsx:37` excludes `TIMEOUT` from `isPartialCount`, so the header renders `t('{{total}} results')` → **"0 results"**. But the scope *is* applied: `MyDataScopeResolverImpl.java:104-108` returns `truncated(Set.of(), TIMEOUT)`, `AssetSearchServiceImpl` passes `lineageSelected=true` with an empty id set, and `ReactiveAssetSearchRepositoryImpl` turns that into `DSL.falseCondition()`. With only a lineage scope ticked the user sees **"0 results"** next to a strip reading *"…so it was not applied."* Both halves are wrong in the same direction R4 exists to prevent: an operator scanning "Downstream of my data → 0 results" concludes nothing depends on their assets. Fix the count (suppress or de-qualify it on TIMEOUT) **and** the copy (it was applied; nothing could be resolved), or make TIMEOUT genuinely not narrow. Note the same wording is in all 7 locales, so the copy fix is 7 files.

**B4 — the truncation UI has zero regression protection.** R4's *"the page shows the strip and a qualified count"* is evidenced by exactly one manual screenshot taken with the response intercepted at the network boundary. There is no component test and no e2e. A future edit that drops `scopeTruncated` from `assetSearch.thunks.ts:31-33` — precisely the mapping that was already dropping `total` before this slice — ships silently, and the page then presents a partial impact set as complete. A `SearchResultsHeader` component test is cheap, deterministic and needs no stack: assert the `NODE_CAP` qualified count + strip, the `TIMEOUT` copy + count (this is where B3 gets locked), and the untruncated bare total.

**SHOULD-FIX — fold into the same pass**

**S1 — ticking "My Objects" hides the *Type* facet and the "Create Data Entity Group" button, and the doc this change ships says otherwise.** Verified chain: `searchUrlState.ts:340` emits `myObjects: true` → the session echoes `my_objects` → `dataEntitySearch.slice.ts:150` → `dataentitySearch.selectors.ts:113` (`if (search.myObjects) return 'my'`) → `Filters.tsx:77` (`typeof searchClass === 'number' && searchClass > 0`) hides *Type*, and `Results.tsx:78-80` never matches, hiding the DEG button. The record's out-of-scope note is right that this is byte-identical to today's *mechanism* — but not to today's *reachability*: before ST-8 "My Objects" was one option in a one-of-N tab strip, mutually exclusive with a class selection by construction; it is now an independent sidebar multiselect sitting three rows from **Data entity type**, so "My Objects + Datasets" is an ordinary combination. And `search.md` now states *"**Type** — Only shown once a single **Data entity type** is selected"*, which is false in exactly that state. The `'my'` short-circuit exists only to serve the tab this slice deleted; drop it, or gate the *Type* facet on the URL's `entityClasses` instead of the session class.

**S2 — cursor stability under a My-data scope has no test.** The plan named an `AssetSearchKeysetPaginationTest` extension for it (and the bot's own pre-work comment raised it); `git diff --stat 82e7e70e..94b2a2c8 -- '*AssetSearchKeysetPaginationTest*'` is empty. The risk is concrete, not theoretical: the resolver re-runs per page, so a `TIMEOUT` on page 2 (or a differing `NODE_CAP` prefix) silently changes the scope mid-scroll while the cursor keeps walking.

**S3 — "Clear All" clearing the scope has no test.** R7b calls it *"a deliberate change to a shipped control"* and it is named in the public scope comment on #1842; nothing asserts it at any level.

**S4 — two internal contradictions on the two pages this change edits.** Fold them, since the pages are open. (i) `catalog-overview.md`: the slice adds *"Each of the first three columns carries a **View all** link"* while the same page still says *"there is no per-column 'view more' affordance"* about those four columns, ~10 lines below. (ii) `search.md` § Known limitations: *"**Facet selections are not yet in the URL** … a shared link reproduces the query but not the facet selections"* is false on this very branch — ST-1b put the facets in the URL, ST-2b `sort`, ST-4 `asset_kinds`/`entityClasses`, and this slice `my_data` + the depths — and it contradicts the new **My data** section ~30 lines above it, which promises the scope reproduces for whoever you send the link to.

**S5 — document the TIMEOUT outcome.** `search.md`'s warning hint covers only the NODE_CAP partial case; TIMEOUT is a distinct message and a distinct result an operator can hit.

**S6 — `search.md` says the unbound-user filter is "shown but disabled".** `MyDataFilter.tsx:96-107` renders a heading plus one hint sentence — no control, disabled or otherwise. Either match the copy to what renders, or render what the doc (and R7) promise.

**MINOR — fix or note, your call**

- **M1** `MyDataScopeResolverImpl.hop:145` computes `capped = rows.size() > remaining` **before** filtering already-visited oddrns, and neither hop query excludes the visited set. In a dense overlapping graph a hop can return mostly-already-visited rows, trip the cap, and flag `truncated=true` while the real node count is far under budget — a false "partial" banner. It errs safe, but it is a false claim in the opposite direction; either count discovered nodes rather than returned rows, or say in the javadoc that the budget deliberately counts traversed rows including revisits.
- **M2** `Results.tsx:68` and `:83` still describe "the All / My-Objects tabs" and "my_objects" in the file that just deleted them.
- **M3** `t('{{total}} results')` has no plural form, so a single-match search renders **"1 results"** on every locale.
- **M4** The cross-surface vocabulary split this slice creates (Recommended + search say "Upstream of my data"; the Activity Feed still says "Upstream Dependents", documented at `documentation:docs/configuration-and-deployment/enable-security/authorization/owners.md:111`) was correctly scoped out but left untracked → filed as **`backlog/docs/DOC-506.md`** (`milestone: 1.0.0`). Separately tracked rather than folded because it needs a product decision and an odd-platform issue, which this rework will not touch.
- **M5** All three `2026-08-31-*` ctrib062 run-log entries leave `runner:` and `evidence/notes:` as unfilled template placeholders, so the pass/fail counts exist only in this ledger. Pre-existing pattern, but the run-log is the audit trail a later release review reads.

### Verdict

- **Result**: **REJECTED** → `status: review-ready` → **`blocked`**.
- **Outbound URL sweep**: 4 doc links added, all resolve tree-relative; 0 broken. Live-site verification is PENDING-RELEASE (1.0.0), correctly.
- **Banned-phrase check**: none used; every verdict above ends in a citation or an explicit "not measured".
- **Regressions**: FE suite 163/164 with the one failure A/B-proved change-independent. The unit + IT confirmation runs are deferred to the re-review by design (see above) — B2 requires a fresh `multi-stack` regardless.
- **Navigation**: consistent. `navigation/domains/search.md` was refreshed for the unified-search subsystem at CTRIB-059 and the new nodes are reachable through it; the three new backend classes carry no sidecar, which matches the corpus's selective 216-node coverage rather than a gap this slice opened.
- **Upstream issues logged**: none new (PLT-258 / PLT-259 already filed by this stream and verified present).
- **Doc-product editorial findings** — **Coverage this run**: `docs/data-discovery/**` read end-to-end on `docs/CTRIB-062-my-data-filter` (the train), plus the inbound-anchor sweep across all of `docs/` + `SUMMARY.md`. **Queued (carried forward from the CTRIB-059 partition): `integrations/**`, `master-data-management/**`, `developer-guides/**` beyond the ADR log, `data-modelling/**`, `management/**`, `use-cases/**`.** **Findings**: the two internal contradictions are **not** logged as separate DOC items — they are on the two pages this rework is already editing, so they are S4 in the fix-list above (LSN-009 / the don't-over-log rule). One genuinely separable finding filed: **DOC-506** (medium, *parallel surfaces with drift*) — one lineage relationship, two names across surfaces.
- **Notes**: the honesty of this ledger is the reason the review was cheap — §21 named its own unmeasured gate, §22b caught its own fossil-SUT read, and R3's overclaim was corrected against the running system instead of argued. **VERIFIED via** the re-derivations listed under "What I measured myself". What it cannot do is close the gate on the maintainer's behalf: B1 and B2 are measurements this stream can take, and "GATE 2 decides whether it blocks merge" hands the maintainer a QA job. Take them, fold B3/B4/S1-S6, and the re-review is a confirmation run.

---

## §24 — Phase F: the /review fix-list worked, and the perf gate was finally taken

Rework of the 2026-08-31 `REJECTED` verdict (`## Review (2026-08-31, session: review-ctrib062)`). Same
session as the review — allowed, since the separate-session rule binds `/review`, not `/implement` — so the
**re-review must run in a fresh session**.

### The fix-list, closed

| | Fix | Commit | Proof |
|---|---|---|---|
| **B3** | TIMEOUT no longer prints a bare total beside its own warning | `90b99a68` | RED-proved: 3 of 8 cases fail on the pre-fix component |
| **B4** | The truncation UI has a regression lock at last | `90b99a68` | 8 cases; the 5 unchanged-behaviour guards pass on both sides, which is what makes them guards |
| **S1** | Ticking My Objects no longer switches off the Type facet + the DEG button | `f087961e` | RED-proved 3 of 4 |
| **S2** | Keyset paging under a My-data scope | `6055fb41` | walks a scoped search through real encoded cursors |
| **S3** | "Clear All" clears the scope | odd-team `e6cc91b5` | IT-152, green **in suite context** (6.2s) |
| **S4/S5/S6** | Two doc contradictions, the TIMEOUT state, the real unbound posture | doc `07ae18e` + `6055fb41` | all three pre-commit sweeps clean |
| **M1/M2/M3** | Budget semantics, stale tab-era comments, `"1 results"` | `90b99a68`, `f087961e`, `6055fb41` | |
| **M4** | Cross-surface vocabulary split | `DOC-506` | filed at review |
| — | eslint clean across the whole surface (never run before) | `991e0499` | 0 errors, 0 warnings |

**S2 moved home, deliberately.** The plan named `AssetSearchKeysetPaginationTest`; that suite drives the
*service*, which resolves the owner from the authenticated principal, and this repository has no `@MockBean`
precedent to mock it with. The case lives with the scope predicate instead — the repository level, which is
also where the composition risk actually is.

**Two run-killers caught by reading rather than by burning a stand:** the FE sort allow-list is lowercase, so
a `sort=NAME` fixture URL would have failed the new e2e for a reason unrelated to Clear All; and the perf
fixture would have tripped **PLT-259** — the NULL `title_id` 500 this very stream filed — turning every
measurement into an error path.

### B2 — the four-suite regression, read as suites

`run-regression.sh ctrib062`, SUT built from the clean worktree, flock held throughout.

| suite | result | reading |
|---|---|---|
| `feature-complete` | 12 failed / 328 passed (27.5m) | **zero unattributed** |
| `known-bugs` | 3 failed | EXPECTED — RED is this suite's pass condition |
| **`multi-stack`** | **13 passed (10.4m)** | **green as a SUITE — B2 closed** |
| `ingestion-e2e` | 15 passed (5.0m) | green |

Every failure reconciled by **exact `spec:line`**, not by arithmetic: 11 are TST-059's stale-endpoint class
(whose corrected baseline is exactly 11) and 1 is TST-057's springdoc instance. The only line that does not
match its record is `search-class-tab-filter.spec.ts:148` vs TST-059's `:144` — the same PLT-147 lock test,
shifted four lines when this slice re-pointed that spec off the retired tab strip.

**Unit: 774 tests, 2 failed** → both settled by a **pre-registered** A/B (rework `991e0499` vs base
`82e7e70e`, same box, same command): **both arms BUILD SUCCESSFUL 4/4**, so both failures are load-driven.
The A-vs-B ratios are *not* quotable as a regression — every measurement including the control moved ~1.6x,
so the arms ran at different load; normalised against the control the subjects move 1.037x / 1.049x / 0.938x.
The index-cost hypothesis (ST-8 adds three indexes; `LoadIngestionTest` is write-heavy over those tables) is
**disproved by the data**: the subject moved 3.7% more than the control and the sibling ingestion test moved
6% *less*. Recorded as **TST-057**'s seventh instance, with the finding that matters: on a box this workspace
calls quiet, `LoadIngestionTest` needs **57.02s against a 60s bound**.

### B1 — the perf gate, taken on the real query at last

**First attempt was invalid and the defect was mine.** I pointed the harness at `odd-minimal`
(`auth.type=DISABLED`), where `fetchAssociatedOwner()` is empty and every My-data scope short-circuits to an
empty page *by design*. The response proved it — `total: 0`, `scopeTruncated: null`. My fail-fast guard
checked the *fixture* and not the *response*, so it waved through a run with nothing in it. IT-152's own
comment states this fact and IT-153 exists because of it; I had read both that day.

Redone on a **LOGIN_FORM** stack from the reworked SUT, real `user_owner_mapping`, `auto_explain` armed via
`shared_preload_libraries`, **120 000 indexed assets**, 30 000 lineage edges, scope genuinely resolved
(`scopeTruncated: true`, `NODE_CAP`, `total: 10000`).

**§21's actual worry is answered, and the answer is good.** The plan PostgreSQL *ran*:

```
->  Bitmap Heap Scan on asset_search_entrypoint   (actual time=99.1..216.0 rows=10000)
      ->  Bitmap Index Scan on asset_search_entrypoint_search_vector_gin_idx
                                                  (actual time=74.9 rows=120000)
            Index Cond: (search_vector @@ to_tsquery('perfgate:*'))
```

The GIN index drives, 120 000 candidates come back, and the scope is applied as a **filter on the bitmap heap
scan**, narrowing to exactly 10 000 — not a separate join, not a per-row rescan. The comment's claim holds in
the **shipped** query. Ranked page: **507.77 ms**. The lineage hops never crossed the 200 ms logging
threshold — `V0_0_101` is doing its job.

**Latency, warm (12 discarded warm-ups; the first post-restart numbers were pure JIT and were discarded):**

| request | measured |
|---|---|
| depth 3, cap-reaching scope | **1.51 - 1.76 s** (median ~1.62 s) |
| depth 1 — **the default** | 0.72 - 0.91 s |
| `MY_OBJECTS` only (uncapped semi-join, no walk) | 0.23 - 0.29 s |
| **UNSCOPED**, same 120k catalog | **1.17 - 1.25 s** |

Per-statement (`auto_explain`, >200 ms): `count(*)` median **274 ms** / max 397; ranked page median 360 ms.

**The original "< 1 s" bound is missed — and was also mis-specified.** An unscoped search over the same
catalog is 1.23 s, so that number was unreachable for *any* search at this scale. R4's acceptance is
re-specified to the scope's **marginal** cost, which is what ST-8 controls: **1.32x** unscoped at the ceiling
(within the new 1.5x bound) and **0.69x** at the default depth — i.e. scoping is *faster* than not scoping,
because it narrows. The dominant remaining cost is the pre-existing `count(*)`, filed as **`PLT-260`**.

### A perf "fix" of mine that the measurement destroyed

I changed the walk's ODDRN→id lookup to the array-bind shape, reasoning from the ranked query's own comment
that a 10 000-element IN list is what to avoid. Then I measured it instead of asserting it — direct SQL A/B,
same DB, same 10 000 oddrns, EXPLAIN ANALYZE, three runs each:

```
.in(collection)         planning 19-24 ms   execution 115-149 ms   (~150 ms)
IN (SELECT unnest(?))   planning  7    ms   execution 207-217 ms   (~220 ms)
```

**~70 ms slower.** Reverted (`966d3053`). The two call sites are opposite access patterns — the ranked query
matches 10k ids against a 120k-row FTS bitmap where a hashable semi-join wins; this one does 10 000 *exact
lookups on a unique btree index*, where constants known at plan time are what the planner wants. The ranked
query's note is **not a blanket rule**, and reading it as one is the same mistake in kind the perf gate exists
to catch. The numbers are now on the method with an explicit *"tried, measured, reverted; do not re-apply by
analogy"*.

### Definition of Done — Phase F

| # | Gate | Evidence |
|---|---|---|
| 1 | Full unit build | **774 tests, 2 failed → both A/B-proved load-driven**; checkstyleMain + checkstyleTest + assemble + bootJar all green |
| 2 | FULL integration regression | 4 suites; **multi-stack green as a suite**; 12 feature-complete failures reconciled to zero unattributed |
| 3 | Docs | 1 commit on the `release/1.0.0` train; all three pre-commit sweeps clean |
| 4 | Ontology | `lineage/**` clean; the `ReactiveLineageRepositoryImpl` sidecar was already current and its source is untouched by this rework |
| 5 | Principal sufficiency | FE 175/176 (the 1 A/B-proved change-independent) · tsc clean · eslint 0/0 · **the perf gate taken on the real query, and one of my own changes reverted because the measurement said so** |

### Follow-ups this rework leaves

| ID | What |
|---|---|
| `PLT-260` | the pre-existing `count(*)` dominates every search at catalog scale (new) |
| `TST-057` | extended — `LoadIngestionTest` at 57.02s against a 60s bound (seventh instance) |
| `TST-063` | its question is now ANSWERED — the FTS bitmap does still drive the shipped query; the item can close at review |
| `DOC-506` | one lineage relationship, two names across surfaces (filed at review) |

---

## Review (2026-09-01, session: review-ctrib062-2) — RE-REVIEW of the Phase-F rework

Fresh session (the §24 rework ran inside the *first* review's session, which said so and deferred the
re-review — so the separate-session gate is satisfied). Reviewed `contrib/CTRIB-062-my-data-filter` @
**`966d3053`** — 16 commits off `origin/main` `82e7e70e`, **pushed** (`git ls-remote origin` confirms the
remote branch is at `966d3053`) and carried by draft PR **#1871** (live API: `open`, `draft: true`, head
`966d3053`, 16 commits / 49 files) — plus `documentation@docs/CTRIB-062-my-data-filter` @ **`07ae18e`**
(3 commits off `origin/release/1.0.0` `5b2bb04`, **pushed**, draft PR #110).

**No 2-minute precondition bounce.** §24's DoD carries no "NOT RUN" admission, and the four suite run-logs
exist at SUT digest `sha256:bd7cddec…`, built from `991e0499`. I checked that digest *is* the reviewed tree
rather than assuming it: `git diff 991e0499 966d3053` is **one file, 14 insertions, every line javadoc**
(the "tried, measured, reverted" note on `listIdsByOddrnsExcludingOwnedBy`). So the implementer's regression
subject is functionally the reviewed commit, and this run is the *confirmation* it is supposed to be.

**The rework is real, and all but one of the fix-list is genuinely closed.** Three of the four blockers, all
six should-fixes and all five minors from the 2026-08-31 verdict are addressed with evidence I re-derived
rather than accepted; the fourth (B2) is the exception and is C0 below. B1 —
the perf gate the issue is named for — was taken on the running platform and, more to the point, was reported
*against* the item: the original bound is recorded as **missed**, the number that replaced it is justified
from a measured unscoped baseline, and an optimisation the implementer wrote was reverted because measuring
it destroyed it. That is the standard this workspace exists to hold.

**It is rejected on four things.** One of them is the blocker the first review already raised: **B2 was
closed on a single sample.** My own four-suite regression, on a SUT I built from the reviewed tree, ran `multi-stack` **whole** —
and it came back **12 passed / 1 failed**, the failure being this slice's own `IT-153` at the very case that
proves R2. I re-ran the suite whole a second time — **13 passed, green**. So across both sessions the tally is
**n=3: green, red, green**. The finding is not "the fix does not work"; it is that **B2 was closed on n=1** and
this slice's own newest test goes red in suite context about one run in three. The other three are claims that contradict what this
same change proves elsewhere, and those are a prose/comment pass.


### Acceptance criteria (the item's own Spec R1-R8)

| | Verdict |
|---|---|
| **R1** scope group narrows the cross-kind search | **PASS** — `AssetSearchScopePredicateTest` **6/6** green in my own build (Testcontainers, real Postgres); IT-153 drives the rendered list through a real login. |
| **R2** ownership per kind | **PASS** — `ReactiveAssetSearchRepositoryImpl.java:343-360`: the DE branch ORs `OWNERSHIP` (my objects) with the resolved lineage ids, the TERM branch is `TERM_OWNERSHIP`-only and `falseCondition()` when `MY_OBJECTS` is unselected, and query examples are unreachable by both — excluded by construction, not by a filter that could be dropped. Caption rendered + documented. |
| **R3** per-direction depth, default 1, ceiling 3 | **PASS** — `MyDataScopeResolverImpl.clampDepth:126-128`; FE `parseDepth`; the spec descriptions were corrected *against the running system* rather than argued. Residual (unchanged from the first review): the clamp is asserted only upward — M8. |
| **R4** bounded expansion, truncation visible | **PASS**, and this is the one that was FAIL. (a) determinism + `NODE_CAP` + the response stamp: unchanged and green. (b) *"the page shows the strip and a qualified count"* — now locked by `SearchResultsHeader.test.tsx`, **8 cases**, including the exact `TIMEOUT`-prints-a-bare-`0 results` regression and a case pinning that the two reasons carry **different** remedies. (c) the EXPLAIN + FTS-driver + latency clause — **measured on the shipped query at last** (§24 B1). See the note on the re-specified bound below. |
| **R5** tab retired, count survives | **PASS** — `SearchResultsHeader` still rendered **outside** the `!routerSearchId` gate (`Results.tsx:158-166`), the W5 trap correctly avoided; and now also `'1 result'` rather than `'1 results'` (M3). |
| **R6** panel deep-links | **PASS** — unchanged from the first review. |
| **R7** posture | **PASS**, improved — the unbound arm now renders an actual **link** to the association surface (`MyDataFilter.tsx:99-111`) instead of a sentence naming a page the reader then has to find, and `search.md` was rewritten to describe what actually renders (S6). |
| **R7b** Clear All clears the scope | **PASS with a test at last** — `my-data-scope.spec.ts:158-194` asserts the BEFORE state explicitly (so no "is gone" assertion can pass vacuously on a param that never loaded), clicks the shipped control, checks each param individually, and then waits out the debounced facet→URL mirror to prove no late write resurrects the scope. That last guard is the one a weaker test would have missed. |
| **R8** additive contract | **PASS** — and the reapply direction is now covered both ways (`searchFormDataToUrlState.test.ts`: a spec saved before ST-8 reapplies as `[MY_OBJECTS]`; a stored scope wins over the legacy flag; an unknown stored token fails closed). |

**On the re-specified R4 bound — the thing a reviewer must not wave through.** Changing an acceptance
criterion *after* failing it is the classic way a gate stops meaning anything, so I checked the justification
rather than the arithmetic. It holds: the load-bearing claim is that an **unscoped** search over the same
120 000-asset catalog measures **1.17-1.25 s**, which makes "< 1 s at the ceiling" a bound no search of any
kind could meet at that scale — so it was never a bound on *this feature*. The reported numbers are also
mutually consistent with the per-statement figures on the same stand (ranked page 508 ms and `count(*)`
median 274 ms run as a `Mono.zip`, so ≈ max(508, 274) plus a ≤ 3-hop walk plus HTTP lands exactly where the
end-to-end numbers land; `MY_OBJECTS`-only at 0.23-0.29 s with no walk at all is the control that makes the
set coherent). **Two things the maintainer owns at GATE 2, stated so they are not buried**: the 1.5x
threshold was chosen *after* measuring 1.32x, and 1.6 s per interaction at the ceiling is a product call, not
a test result. Both are disclosed in the PR body — which is the part that matters, and which the first review
could not say.


### Quality Bar

- **Gate 1 — No duplicates: PASS.** `FixedOptionsMultiFilter` / `AppSelect` / `buildSearchLink` reused rather than paralleled; the rework added no new component — `SearchResultsHeader` gained cases, not a sibling. **VERIFIED via** `git diff --stat 94b2a2c8 966d3053` (21 files, one new test file per fixed surface, zero new production classes).
- **Gate 2 — Aliases: PASS.** `my_objects → my_data` declared `deprecated: true` with the mapping rule in the schema description and honoured in exactly one place (`MyDataScopeDto.resolve`). Unchanged by the rework. **VERIFIED via** read of `components.yaml` + the reapply tests.
- **Gate 3 — Caveats as admonitions: PASS** (was PARTIAL). The first review's gap was the undocumented `TIMEOUT` outcome; `search.md` now carries a two-row table inside the warning hint distinguishing `NODE_CAP` (a real, repeatable subset) from `TIMEOUT` (the lineage half contributed nothing, and it is load-dependent so a retry may work), each with its own remedy. **VERIFIED via** `git diff 5b2bb04 07ae18e`.
- **Gate 4 — Consumer-read: PASS.** The chain that produced S1 was re-walked at `966d3053`: `getSearchEntityClass` no longer short-circuits on `myObjects`, `SearchClass` is `number | 'all'`, and `grep -rn "'my'" src/` returns only comments and the new test's own negative assertion — no residual consumer. The `dataEntitySearch.slice` reducer no longer returns `myObjects`, so the field is preserved through a facet mutation via the spread rather than reset. **VERIFIED via** grep + read.
- **Gate 5 — Unset-parameter audit: N/A** (no SDK builder in scope).
- **Gate 6 — Bidirectional code ↔ doc: FAIL.** The three paths the first review named are now covered (`TIMEOUT` documented, the unbound posture matches what renders, the Type-facet interaction fixed rather than described). The remaining direction fails: this change adds three controls plus two depth selects to the Filters panel, and the count of that panel is stale on the page the change authors and on three more pages — C2 / C2b. On the other axis, one negative check worth recording: the slice changes `SearchFormData` + `AssetPageInfo`, and `developer-guides/api-reference/**` has **no search sub-page** (`api-reference.md` says so explicitly — the search family is one of the groups with no per-feature page), so no API-reference update is owed. **VERIFIED via** the facet/tab-count sweep across `docs/**` + read of the api-reference index.
- **Gate 7 — Layout: PASS.** Two existing pages, no new page ⇒ no `SUMMARY.md` entry due (`git diff --stat 5b2bb04 07ae18e` = 2 files). Both anchors this change introduces resolve — `search.md` has `## My data` and `catalog-overview.md` has `### Recommended`. The three anchors my link-sweep flagged (`#general-panel-view-count-caveats`, `#alert-views-all-my-objects-downstream-upstream`) are **pre-existing and valid** — GitBook drops the em dash and the commas, which my naive slugger did not; checked against the real headings rather than left as a finding.
- **Gate 8 — Publishing: PENDING-RELEASE (1.0.0); branch-verifiable half PASS.** The doc is genuinely authored **and pushed** on the train — `git ls-remote origin` shows `refs/heads/docs/CTRIB-062-my-data-filter` at `07ae18e` and `refs/heads/release/1.0.0` at `5b2bb04`, so this is not the CTRIB-040 "drafted, never authored" failure. Frontmatter parses under PyYAML; `description` lengths **129** and **191** chars (both under the 200-char GitBook truncation); no `: ` hazard; every link tree-relative. Live verification is owed at the 1.0.0 gate.
- **Gate 9 — Factual claim provenance: FAIL.** The contributor pillar uses no `Sources:` footer (the posture accepted at `/review CTRIB-059` and by the first review), and provenance is inline in the commit bodies — most of which I re-derived and which hold. But C1 is squarely this gate: a claim shipped in production source that the same change's own measurement refutes, pointing the reader at a tracker item the ledger says is answered. The banned-phrase check on the reviewed artefacts is otherwise clean.
- **Gate 10 — Content-type homing: PASS.** Filter semantics on `search.md`, panel behaviour on `catalog-overview.md`, the wire contract in `components.yaml`, the perf evidence in the code comment + the PR body. Nothing API-reference-shaped embedded in a feature page.
- **Gate 11 — Audience isolation: PASS.** Mechanical grep over **every** `+` line of the full doc diff (`5b2bb04..07ae18e`, i.e. including the rework commit the first review could not see) for `Cornerstone N` / `Gate N` / `LSN-` / `SHB-` / `DOC-` / `IT-` / `TST-` / `PLT-` / `CTRIB-` / `ST-N` / `#18xx` / `feature-flow` / `Quality Bar` / `sidecar` / `playbook` / `retrospective` / `backlog` / `scanner` / `lineage/` → **zero hits**.


### What I measured myself, rather than read

**Unit bucket — my own full CI-replica build at the reviewed SHA.**
`ODD_PLATFORM_DIR=../odd-platform-ctrib062 scripts/run-platform-tests.sh` (the no-arg form: `build` =
`test` + `checkstyleMain` + `checkstyleTest` + `assemble` + `jacocoTestReport`), run under the heavy-e2e flock
so nothing else had the box:

> **BUILD SUCCESSFUL in 24m 50s** — **774 tests / 0 failures / 0 errors / 0 skipped** across **181 test
> classes**, parsed from `build/test-results/test/*.xml` rather than read off the console.

**Both tests the implementer recorded as failing PASSED on my run**, which settles §24's A/B by a third,
independent measurement rather than by argument:

| test | my run | note |
|---|---|---|
| `LoadIngestionTest.testInjectingManyDataEntities()` | **PASS**, 80.77s | |
| `OpenApiDocsContractTest.platformApiGroupDocumentLoads()` | **PASS**, 54.65s | against its **60s** `@AutoConfigureWebTestClient` bound — **8.9% margin** |
| `OpenApiDocsContractTest.ingestionApiGroupDocumentLoads()` | PASS, 5.65s | |
| `MyDataScopeResolverTest` 9/9 · `AssetSearchScopePredicateTest` 6/6 · `AssetSearchServiceMyDataTest` 6/6 · `MyDataScopeDtoTest` 6/6 | PASS | the slice's own behavioural set, on a real Postgres |

So the load hypothesis is confirmed and the index hypothesis stays disproved. **TST-057 is corroborated, not
closed** — 54.65s against a 60s bound is a test that will keep flipping, and my box was not idle either
(an IDE and sibling agent sessions were live throughout).

**The reviewer's own four-suite regression, on the reviewer's own SUT.** Built by me from the reviewed tree —
`SUT_DESC=built from source: the odd-platform WORKING TREE @ 966d3053`, image
`odd-platform:odd-team-sut-revctrib062`, digest `sha256:6acff772…` — deliberately **not** the implementer's
`bd7cddec`, so the SUT is independent evidence rather than the same artefact re-read.

| suite | my result | reading |
|---|---|---|
| `feature-complete` | **329 passed / 11 failed** (29.8m) | **zero unattributed** — the 11 are **set-equal** to TST-059's named eleven (`catalog-search` 48/62 · `entity-class-type-badge-list` 59/77 · `recently-viewed-record-see-loop` 117/213 · `search-url-state` 38 · `search-result-stale-signal` 62 · `search-result-row-click` 45 · `search-class-tab-filter` 148 · `popular-entities-ranking` 62). Reconciled by exact `spec:line` set-comparison, not by count. **One cleaner than §24's run**: my box did not reproduce its 12th failure (`swagger-openapi-discovery:63`, TST-057's order-dependent springdoc instance). |
| `known-bugs` | **3 failed** | EXPECTED — RED is this suite's pass condition. The three are IT-004 (`quality-dashboard-unknown-status:33`), IT-006 (`error-boundary-containment:29`), IT-007 (`attachment-local-durability:35`). **Zero unexpected GREENs**, so no un-flipped fix is hiding here. |
| **`multi-stack`** | **12 passed / 1 failed** (12.3m) | **RED — B2 is not closed.** The failure is `my-data-scope-narrows.spec.ts:259` (IT-153, this slice's own test). §24 reports 13 passed. See **C0**. |
| `ingestion-e2e` | **15 passed** (4.9m) | green |
| `multi-stack` **re-run** | **13 passed** (9.4m) | green, `:259` included — run a second time because one disagreeing sample is a measurement, not a verdict. **n=3 across both sessions: green (§24) / red (mine) / green (mine).** |

**Re-derived rather than trusted (the load-bearing claims):**
* **The SUT ↔ commit correspondence** for the implementer's own regression: `git diff 991e0499 966d3053` is one file, **14 insertions, every line javadoc** — so digest `bd7cddec` genuinely is the reviewed tree.
* **Both branches are pushed.** `git ls-remote origin` → `refs/heads/contrib/CTRIB-062-my-data-filter` at `966d3053` and `refs/heads/docs/CTRIB-062-my-data-filter` at `07ae18e`. PR #1871 live: `open`, `draft: true`, head `966d3053`, 16 commits / 49 files.
* **The published PR body is current and honest.** I read it live rather than reading the on-disk copy — it carries the 774/2 unit figure, `multi-stack` **13 passed**, the *"latency target was **missed** — and was also mis-specified"* heading, the 1.32x / 0.69x marginal numbers, and the reverted-optimisation A/B. (The on-disk `CTRIB-062-pr-body.md` is the stale pre-rework text — M7 — which is why reading the file instead of the API would have produced the opposite conclusion.)
* **i18n, mechanically:** 688 keys × **7** locales, **0 missing / 0 extra**; all 7 new keys present in every locale and genuinely translated; all 4 retired keys (`Your My data scope … was not applied`, `Link your user to an Owner **on the main page** …`, `Upstream dependents`, `Downstream dependents`) gone from **all seven** files symmetrically, with **no** remaining `src/` consumer — so no fallback leak.
* **The FE count arithmetic:** the first review measured 163/164; §24 claims 175/176 with the same single failure. The two new FE test files carry exactly **8 + 4 = 12** cases. 163 + 12 = 175. The claim reconciles to the case, not to a round number.
* **G-C15 on every CHANGED test** (not just added), across the whole slice: `searchUrlState.test.ts`'s rework diff is pure prettier reflow; `useNavigateToSearch.test.tsx` replaces the `myObjects` case with two *stronger* ones; `searchFormDataToUrlState.test.ts` adds the legacy-alias arm rather than dropping it; the three re-pointed e2e specs keep the same three-part shape (English baseline → switch → translated present **and** English absent) and `aac1e908`'s body records the IT-068 plan deviation with its reasoning. **No matcher weakened, nothing `.skip`/`@Disabled`/deleted.**
* **Gate 8's branch-verifiable half**: PyYAML parses both frontmatters; `description` 129 and 191 chars; every link tree-relative; both new anchors resolve against the real headings.


### The fix-list

**BLOCKERS**

**C0 — B2 was closed on one sample; three samples say the gate is intermittent.**
My four-suite regression, on a SUT I built from the reviewed tree (`sha256:6acff772…`), ran `multi-stack`
**whole, in one process, in suite order** — the run §24 correctly insisted on. Result:

> **12 passed / 1 failed (12.3m)** · the failure is
> `my-data-scope-narrows.spec.ts:259` — *"IT-153 — My Objects returns what I own across kinds — and nothing
> else (**the pass-through regression**)"* — i.e. the RED-proof case for R2, the shipped ST-4 defect this
> whole slice exists to close.

§24 reports the same suite as **13 passed**. Same 13 tests (12 + 1 = 13), one red. **A gate that is green once
and red once is not a closed gate**, and this is the exact failure mode §22 diagnosed: it surfaces only in
suite context, so neither of us can dispose of it with a targeted run.

*What the failure says, in the test's own words:*

> `READINESS: the seeded fixture "it153mydata_21530" never became searchable on the freshly-booted LOGIN_FORM
> stack within 90s. This is a readiness failure, NOT a scope failure…`
> `  last observed page state: header="0 results" renderedRows=[]`

The helper's own diagnostic is what makes this readable: *"if renderedRows is non-empty but lacks the name,
the catalog IS serving and the fixture specifically is missing from the unified index"*. `renderedRows` is
**empty**, so for ninety seconds the catalog served **nothing at all** — the stack was answering and the
fixture was not there. That rules out the unified-index path (and I confirmed independently that it is not a
background-job race: `V0_0_98` maintains `asset_search_entrypoint` with **synchronous AFTER
INSERT/UPDATE/DELETE triggers** on `search_entrypoint` / `term_search_entrypoint`, so the seed's own
transaction populates it).

*The class, not the instance.* Three specs in the `multi-stack` suite share **one** compose project on **one**
fixed port, and each tears the other's database out from under it:

| spec | protocol | lifecycle |
|---|---|---|
| `auth-mode-boundary.spec.ts` | IT-009 | `upLoginFormStack()` :42 → **`downLoginFormStack()` :47** |
| `my-data-scope-narrows.spec.ts` | **IT-153 (this slice)** | `upLoginFormStack()` :195 → `downLoginFormStack()` :256 |
| `session-cookie-posture.spec.ts` | — | `upLoginFormStack()` :64 |

`loginform-stack.ts` pins `PROJECT = 'oddlf'` and `LOGINFORM_BASE_URL = …:18082`, and `stack.ts:40`'s
`composeDown` is `docker compose -p oddlf … **down -v**` — the **volume** goes, so the next consumer replays
every migration from `V0_0_1`. `composeUp` then polls `/actuator/health` for `UP` (`stack.ts:24-27`) and
returns. **That readiness check cannot distinguish "my new stack is up" from "the previous spec's stack has
not finished dying yet"** — a health probe against a fixed port answers either way. Seed into the wrong one
and the search is empty forever, which is precisely the observed 90 seconds of `0 results`.

The `oddlf` sharing is **pre-existing harness debt** — IT-009 and `session-cookie-posture` had it before ST-8.
What is new is that IT-153 is the first consumer that **seeds data and then reads it back**, so it is the
first that cannot tolerate the ambiguity; and B2 was closed on a single green run of exactly that test.

**Do not bump the 90s.** §24 says so itself — *"why 'flake, bump the timeout' was the wrong answer"* — and it
is right. The fix is to remove the ambiguity: give IT-153 its own compose project + port (the per-stream
isolation model this workspace already uses everywhere else), **or** make `upLoginFormStack()` prove it is
talking to *its own* freshly-migrated stack (a canary row written after bring-up and read back through the
API) rather than trusting a health probe on a shared port, **or** order the three LOGIN_FORM specs adjacently
behind one bring-up. Then re-run `multi-stack` whole **twice consecutively** — one green run is exactly what got us here, and n=3 is now on record.

*I re-ran `multi-stack` whole a second time before writing this, because one disagreeing sample is a
measurement and not a verdict.* **It came back 13 passed (9.4m) — green, including `:259`.** So the honest
tally across the two sessions is **n=3: green (§24), red (mine), green (mine)**. That is the finding, stated
exactly: **IT-153 is intermittent in suite context — roughly one whole-suite run in three — and B2 was closed
on n=1.**

**This is not "the fix does not work".** §22b's readiness gate is a real improvement and the case passes most
of the time; when it fails it now says why, which is how I could root-cause it in one pass instead of guessing.
The claim is narrower and it is the one that matters for a gate: **a regression suite whose own newest test
goes red about a third of the time is not a gate any more** — the next reader who sees `my-data-scope-narrows`
red will assume "that one's flaky" and stop reading, which is precisely how a suite stops catching things. And
the stream itself set this standard: §24 wrote *"why 'flake, bump the timeout' was the wrong answer"* about
the previous instance of this same test.

**C1 — the shipped source says the perf question is open; the same PR proves it closed.**
`ReactiveAssetSearchRepositoryImpl.java:330-336` still ends:

> *"…What is NOT yet confirmed is that the FTS bitmap still drives once every other clause is present at
> catalog scale. Tracked as TST-063."*

Every word of that was true at `94b2a2c8`. At `966d3053` the last two sentences are false: §24 took exactly
that measurement on a LOGIN_FORM stack at 120 000 assets with `auto_explain`, quotes the executed plan
(`Bitmap Index Scan on asset_search_entrypoint_search_vector_gin_idx` driving, the scope applied as a filter
on the bitmap heap scan, 120 000 → 10 000), and the **published PR body says so** — *"the gate has since been
taken on the running platform … the FTS bitmap still drives"*. One PR, two opposite claims about its own
headline deliverable, and the false one is in the source a future engineer reads before touching the
predicate. §24's own follow-up table already says *"`TST-063` — its question is now ANSWERED … the item can
close at review"*, but neither the comment nor `backlog/tests/TST-063.md` (still `status: backlog`, title
still asserting *"no EXPLAIN confirms the FTS bitmap still drives"*) was updated. Rewrite the
SCOPE-OF-EVIDENCE paragraph to what is now measured, and close TST-063 with the plan quoted.

**C2 — this change deletes a control that four published pages still describe, and the page it authors
contradicts itself about the panel it adds to.** One claim, five lines, all on the `release/1.0.0` train the
doc already rides.

*The definitely-wrong half — a control that will not exist:*
* `data-discovery.md:13` — the screenshot caption still reads *"entity-class **tabs along the top** (All / My
  Objects / Datasets / Transformers / Data Consumers / Data Inputs / Quality Tests / Groups / Relationships)
  with per-class counts"*. ST-4 removed seven of those tabs; **this slice removes the last one and deletes the
  components**. The pillar landing page for the very page this change rewrites will tell a reader to look for
  a strip that is gone.
* `data-discovery/vector-stores.md:39` — *"Vector Stores surface on the Type facet (multi-select on the
  **entity-class tab strip**)"*. Same retired control.

*The self-contradicting half — a count that no longer describes the panel:*
* `search.md:19` — *"The Filters panel on the Catalog page exposes **seven facets**"*, and the frontmatter
  `description` (`:2`) repeats *"plus **seven** faceted filters"*. Three sections later the same page
  documents *"Two filters **in the sidebar**"* (Asset type, Data entity type) and then a **My data** group
  with three checkboxes and two depth selects — which R7b calls *"a filter — it lives in the Filters panel
  next to Asset type"* and which `Filters.tsx:36-41` clears with the facets for exactly that reason. The
  sentence attributes a count to the **panel**, and the panel now holds ten controls. Reading "facets" as a
  term of art for the seven server-aggregated ones is the charitable reading, and the sentence still needs the
  word "server-aggregated" in it to survive.
* `data-discovery.md:23` and `Features.md:60` + `:62` repeat the *"seven facets (Datasource / Type / Namespace
  / Owner / Tag / Groups / Statuses)"* enumeration as the whole summary of what search can narrow by.
  `Features.md:60` also still says search finds *"**data entities** across names and metadata"* — already
  wrong since ST-4 made the result cross-kind.

`DOC-499` is the umbrella for the ST-3/4/5 doc debt, but its `affected_files` names only `search.md`, so
nothing else would have caught these. Sweep them here rather than widening DOC-499: the branch is open, the
item is going back to implement, and an accuracy fix that leaves four copies of the claim standing is the
fix→review→log→fix loop the converge directive exists to stop.

**SHOULD-FIX — same pass**

**S7 — the 11 new i18n keys have no rendered-locale coverage at any level.** Catalog parity is verified and
clean (I re-derived it: 688 keys × 7 locales, 0 missing / 0 extra, every new key genuinely translated, the
four retired keys gone from all seven with no remaining `src/` consumer). But the maintainer's standing
directive is that i18n "done" means **driving the page under a non-en locale**, not parity % — and the one
guard that existed for this exact class on this exact page (`IT-102`, the #1751 / PLT-205 "labels built in a
TS object array outside JSX" lock) was **re-pointed by this slice onto `Asset type` / `Data entity type`**,
the ST-4 controls. It could not cover the new group: `IT-102` runs on the auth-disabled stack, where R7 hides
My data. So the group this slice introduces — heading, three option labels, two depth labels, the QE caption,
the unbound remedy, both truncation strings — is never rendered under a non-en locale by any test. `IT-153`
already has a LOGIN_FORM stack with a bound owner where the group *does* render; add a locale arm there
(extract `switchLanguageViaUi`, currently a local function at `multilingual-i18n.spec.ts:36`, into
`e2e/helpers/`).

**S8 — the measured latency is per scroll page, and nothing says so.** B1 asked for this in as many words
("the resolver re-runs on every infinite-scroll page … paid per scroll, not once per search"). §24 answers it
implicitly — every scroll page *is* a `POST /api/search/assets` of the same shape, so 1.51-1.76 s at the
ceiling **is** the per-page figure — but never states it, and "1.6 s once" versus "1.6 s per scroll page" are
different product facts for the human deciding at GATE 2. Say it plainly in §24 and in the PR body, and
either file the follow-up (the resolved scope is deterministic for a given URL state, so it is cacheable) or
record why not. `PLT-260` covers the `count(*)` only.

**S9 — the item's own plan contract still asserts the bound that was missed.**
* `contributor/CTRIB-062.md:518` — `must_haves.truths` still reads *"At depth 3 over a cap-reaching scope on a 100k+ asset catalog the search still returns **in under a second** (Spec R4)"*, while R4 was re-specified to the marginal form and §24 records **1.51-1.76 s**. A plan contract that disagrees with the shipped measurement is worse than none.
* `contributor/CTRIB-062.md:562-564` — the `must_haves` artifact row still says IT-068 is *"retired with a stated reason … anchor: `superseded`"*. It was **re-pointed** instead, and the reasoning is recorded properly in `aac1e908`'s body (*"reading the spec showed that would be over-subtraction"*) — a better call than the plan's. Only the contract row is stale.

**MINOR — fix or note**

* **M6** — `integration-tests/e2e/specs/search-class-tab-filter.spec.ts:5-22`: the header doc-comment still
  describes the 9-tab strip as the surface under test and cites `SearchResultsTabs.tsx:29-31`, a file this
  slice **deletes**. The test body at `:118-123` is correctly re-pointed with a note; the comment above it,
  and the test names (`'clicking the Datasets tab …'`, `:101`), are not. Same class as M2, which the rework
  fixed in `Results.tsx`.
* **M7** — `contributor/CTRIB-062-pr-body.md` is the pre-rework text (last written 16:19, before the 19:00-21:08
  rework), and its commit `0f141985` calls it *"PR body as published"*, which is no longer true. **The
  published PR body is correct and complete** — I read it live; this is the on-disk copy only. While that body
  is being edited for S8 anyway: it says *"**25** new behavioural tests"*; the four new backend test classes
  carry **27** `@Test` methods (`MyDataScopeResolverTest` 9 + `AssetSearchScopePredicateTest` 6 +
  `AssetSearchServiceMyDataTest` 6 + `MyDataScopeDtoTest` 6), which the JUnit XML confirms. It understates, so
  nothing is at risk — but the number is in a public artefact and it is one character to make exact.
* **M8** — `MyDataScopeResolverImpl.clampDepth` is still exercised only upward (`MAX_DEPTH + 5`). `0` and
  negative are correct by inspection (`Math.min(Math.max(requested, 1), MAX_DEPTH)`) but unasserted. Carried
  from the first review's R3 note, not regressed.
* **M9** — `V0_0_101__lineage_child_oddrn_index.sql` creates **three** indexes (`lineage_child_oddrn`,
  `ownership_owner_id`, `term_ownership_owner_id`); the filename names one. A reader grepping the migration
  set for the ownership index will not find it.
* **M10** — the four rework suite run-logs fill `runner:` correctly, but the per-protocol
  `run-log/2026-08-31-IT-152.md` / `-IT-153.md` entries still carry the `(fill: …)` / `<captured values…>`
  template placeholders. The first review's M5, half-closed.
* **M11** — **the DoD's ontology row claims more than it did, and the thing it did not do is correctly deferred
  — so say that instead.** The plan's impact checklist named three feature-flow nodes (`F-017`, **`F-148` "the
  class-tab filter this retires"**, `F-015`) with `/enrich --touched` in Phase D. Both DoDs answer with a
  *sidecar* fact about `ReactiveLineageRepositoryImpl` — a different artefact and a different node — under the
  heading "Ontology refreshed + committed". `lineage/odd-platform/feature-flows/detail/F-148.yaml` still models
  *"the 9-tab strip at the top of the /search results (All / My Objects / Datasets / …)"* and cites
  `SearchResultsTabs.tsx`, the file this slice **deletes**; last touched `c4066140`, 2026-06-04. **I nearly
  called this a gap and it is not**: the ontology models `origin/main`, this branch is unmerged, and
  `playbooks/release-review.md` check 5 (`lineage-extractor scan --full` at the released tag) is the designed
  owner of the retirement. So the fix is one honest line — "ontology: F-148 retires with this slice; deferred
  to the 1.0.0 release-gate refresh, which owns it" — not an enrich run. Worth recording alongside it: **two
  protocols carry `validates: [… F-148 …]`** (`IT-068`, re-pointed by this slice, and the new `IT-152`, whose
  claim is that the strip is *gone*), so whoever retires F-148 has two `gates:` blocks to re-point, and
  `IT-152` validating a feature by asserting its absence is a labelling question for that same pass.


### Doc-product editorial audit (mandatory step, ran)

**Coverage this run — the partition the last two reviews queued.** `master-data-management/**`, `management/**`,
`data-modelling/**`, `use-cases/**`, `integrations/**` (README, ingestion-filters, integration-wizard,
odd-collector, odd-collector-aws, odd-collector-profiler, odd-cli, odd-great-expectations,
odd-tracing-gateway) and `developer-guides/**` outside the ADR log (api-reference hub, the query-examples /
relationships / integrations / lineage / directory sub-pages, github-organization-overview, how-to-contribute,
build-and-run). Plus five cross-tree claim sweeps run over **all** of `docs/**` rather than per page: adapter
counts, "Fixed in *version*" claims, `housekeeping.ttl.*` defaults, the four auth-mode claims, and
facet / tab / permission counts.

**The corpus is in good shape and I want that on the record, because a reviewer who only ever reports findings
is not measuring anything.** The sweeps came back clean: 41/11/4/4 adapter counts agree between
`integrations/README.md` and every per-collector page; the 30-day `housekeeping.ttl` defaults agree across
`statuses.md`, `alerting.md`, `use-cases/de-deprecation.md` and `odd-platform.md` (the TTL-inversion finding
from 2026-06-08 is fully applied); and every checkable claim on
`developer-guides/build-and-run/build-and-run-odd-platform.md` verifies against the repo — `.nvmrc` really is
`v24.13.0`, `engines` really is node `>=24.8.0 <25` / pnpm `>=9.12.3 <10`, `injector/inject.py` and
`docker/config/injector` exist, `pnpm test` really is vitest.

**Findings** (each logged on disk, none narrated):

* **`DOC-508`** (medium, *cross-audience absence*) — **the Integration Wizard ships with an empty registry and
  only the developer page says so.** `developer-guides/api-reference/integrations.md` states plainly that
  `GET /api/integrations` returns `{ "items": [] }` on a stock build because the platform ships no
  `META-INF/wizard/*.yaml` manifests. **Verified in the source rather than taken from the page**:
  `IntegrationRegistryFactory.java:26` scans `classpath*:META-INF/wizard/*.yaml`, and
  `find . -path '*META-INF/wizard*'` over the whole odd-platform repo returns nothing. Meanwhile the three
  pages an operator reads all describe a populated wizard —
  `integrations/integration-wizard.md`'s step 2 is literally *"**Pick** an integration card (PostgreSQL,
  Snowflake, …)"*, `management.md`'s Integrations row promises "pick an integration template", and
  `integrations/README.md` says "the platform **ships an Integration Wizard**". So an operator opens
  Management → Integrations, sees an empty pane, and has nothing — no UI empty state, no doc sentence — to
  distinguish "nothing configured" from "broken". Same defect class as `DOC-393`.
* **`DOC-507`** (low, *reader-flow defect* + *false completeness claim*) — two traps in `developer-guides/**`.
  (i) ODD deliberately **swaps** the two springdoc paths (`application.yml`: `api-docs.path =
  /api/v3/swagger-ui.html`, `swagger-ui.path = /api/v3/api-docs`), so `api-reference.md`'s two path statements
  are each *correct* and together read as a typo to anyone who knows springdoc — the platform's own
  `OpenApiDocsContractTest` javadoc calls the swap out explicitly; the published page does not. (I flagged
  this as an inversion first and checked `application.yml` before writing it down — the page is right, the
  disambiguation is what is missing.) (ii) `how-to-contribute.md:13` and `integrations/README.md` both promise
  the org overview "lists **every** repository"; it lists **16**, and the org has **35** public repos
  (`GET /orgs/opendatadiscovery` → `public_repos: 35`, checked 2026-09-01).
* **`DOC-452` already covers** the `Features.md` (seven) vs `activity-feed.md` (eight) Activity-facet
  contradiction — found again this run, **not** re-filed (LSN-009). Worth noting for triage that it is still
  `status: pending` on `milestone: "0.28.0"`.

**Not logged, folded instead:** the `search.md` seven-facet self-contradiction and the four residue lines on
`data-discovery.md` / `Features.md` / `vector-stores.md` are C2 / C2b in the fix-list above — the branch is
open and the item is going back to implement, so logging them would be the over-logging the rule warns about.

**Queued for the next `/review`:** `integrations/collectors/{azure,gcp}`,
`integrations/push-adapters/{airflow-2,dbt,spark}`, `developer-guides/api-reference/{alerts,data-collaboration,
genai,glossary,reference-data}`, `developer-guides/build-and-run/{odd-collectors,custom-collectors}`, and the
whole `developer-guides/architecture-decision-log/**` set. `data-discovery/**` was covered end-to-end by the
first CTRIB-062 review; `configuration-and-deployment/**` has only ever been covered *partially* (the
scheduled-job surfaces of `odd-platform.md`, at `/review CTRIB-059`) and `active-platform-features/**` has
never been claimed by any run — I am not carrying either forward as "done", because neither is.


### Verdict

- **Result**: **REJECTED** → `status: review-ready` → **`blocked`**.
- **Acceptance criteria**: **8 of 8 PASS** — R4, the one the first review failed, is now genuinely met, including the measurement the issue is named for.
- **Quality Bar**: Gates 1, 2, 3, 4, 7, 10, 11 **PASS**; Gate 5 **N/A**; Gate 8 **PENDING-RELEASE (1.0.0)** with the branch-verifiable half passing; Gate 6 **FAIL** (C2 / C2b); Gate 9 **FAIL** (C1).
- **Outbound URL sweep**: every link on the two changed pages checked; the two anchors this change adds resolve; the three my slugger flagged are pre-existing and valid (GitBook drops the em dash — verified against the real headings, not left as a false finding). 0 broken.
- **Banned-phrase check**: none used — every verdict line above ends in a citation, a measured number, or an explicit "not measured".
- **Regressions**: **one, and it is C0** — `multi-stack` red on `my-data-scope-narrows.spec.ts:259` (this slice's own IT-153) in my whole-suite run, green in my re-run; n=3 across both sessions = green/red/green. Everything else reconciles: `feature-complete`'s 11 failures are set-equal to TST-059's named eleven with zero unattributed, `known-bugs` is 3-RED-expected with zero unexpected GREENs, `ingestion-e2e` is 15/15, and the unit bucket is 774/0 at the reviewed SHA.
- **Navigation**: consistent. `navigation/domains/search.md` was refreshed for the unified-search subsystem at CTRIB-059 and the new classes are reachable through it; no pointer moved in this rework.
- **Upstream issues logged**: none new. `PLT-258` / `PLT-259` / `PLT-260` were filed by the stream and verified present on disk.
- **Doc-product editorial findings**: `DOC-508` (medium), `DOC-507` (low); `DOC-452` re-confirmed, not re-filed. Full detail + coverage / queue above.

**Why this is a reject.** **C0 stands on its own**, and it is worth being exact about what it does and does
not say. It does *not* say the B2 fix failed — my second whole-suite run was green. It says the gate was
closed on **one** sample, and three samples show this slice's own newest test going red in suite context about
one run in three, on an independently-built SUT, in the exact condition the item's own §22 named as the root
cause. A suite whose newest member is a coin-weighted red is not a regression gate, and §24 itself ruled that
"flake, bump the timeout" is not an answer here.

The other three are the same defect in three places: a claim that was true before the rework, refuted by the
rework, and left standing. `ReactiveAssetSearchRepositoryImpl.java:336` says the FTS-driver question is open
while the PR body says it is answered. `must_haves` line 518 promises "under a second" while §24 records
1.62 s. `search.md:19` says the panel has seven controls while the same page documents ten. Each is one line.
Together they are the state a change should never ship in: **the artefact disagrees with its own evidence** —
which is exactly what this slice's own perf work spent two days proving is the thing to avoid.

**What this reject is not.** It is not a re-litigation of the rework, and C0 is not a claim that the fix was
faked. B1 was taken and reported honestly against the item's own interest — the missed bound named as missed,
the replacement justified from a measured baseline, one of the implementer's own optimisations reverted
because the A/B destroyed it. B3 and B4 came back with RED proofs and an 8-case lock. S1 removed the dead
`'my'` short-circuit rather than documenting around it. S3's Clear-All test even guards the debounced mirror
race that a weaker test would have missed. I re-derived all of that and it holds, and the unit bucket is
**774/0** at the reviewed SHA. What C0 says is narrower and harder: **one green run of a known
cold-boot-sensitive test is not evidence that a suite is green** — and rather than assert that, I went and got
the third sample. The next step is the harness fix plus two consecutive whole-suite runs.

---

## §25 — Phase G: the re-review fix-list, and the one item I could not honestly close

Rework of the 2026-09-01 `REJECTED` verdict (`## Review (2026-09-01, session: review-ctrib062-2)`). **Same
session as that review** — allowed, since the separate-session rule binds `/review`, not `/implement` — so the
**next `/review` must run in a fresh session**, exactly as §24 was.

### The fix-list, closed — except C0

| | Fix | Where | Proof |
|---|---|---|---|
| **C1** | The shipped comment claiming the FTS-driver question is open now carries the executed plan | `ReactiveAssetSearchRepositoryImpl` | the `auto_explain` output inline; `TST-063` closed with the same evidence |
| **C2/C2b** | The seven-facet claim and the retired tab strip, swept to **zero residue** | 6 doc pages on the 1.0.0 train | `grep -rniE 'seven facets\|entity-class tab strip'` over `docs/` returns only the Activity-Feed panel (DOC-452) and the corrected sentence |
| **S7** | The 11 new i18n keys get rendered-locale coverage at last | `IT-153` + a new `e2e/helpers/locale.ts` | a `ua` arm on the one stack where the group renders; English asserted gone, not just Ukrainian present |
| **S8** | The measured latency is stated as **per scroll page** | PR body + the code comment | |
| **S9** | The plan contract reconciled to what shipped | `must_haves` truths + the IT-068 artifact row | |
| **M6** | IT-068's header no longer describes a deleted component as the surface under test | `search-class-tab-filter.spec.ts` | |
| **M7** | The on-disk PR body re-based on the **published** text | `CTRIB-062-pr-body.md` | test count corrected 25 → 29 |
| **M8** | `clampDepth` asserted on **both** sides | `MyDataScopeResolverTest` | depth `0` and `-7` clamp up to 1 |
| **M10** | Every CTRIB-062 run-log placeholder closed | `run-log/2026-08-31-IT-15{1,2,3}.md` | marked **reconstructed**, pointing at the ledger rather than inventing counts |
| **M11** | The DoD's ontology row says what it actually did | below | |
| **C0** | **NOT CLOSED — see below** | | |

**M11, stated properly.** The plan named three feature-flow nodes (`F-017`, `F-148`, `F-015`) for
`/enrich --touched`; both prior DoDs answered with a *sidecar* fact about `ReactiveLineageRepositoryImpl`
under the heading "Ontology refreshed + committed". The honest disposition: **the ontology models
`origin/main`, this branch is unmerged, and `playbooks/release-review.md` check 5 owns the refresh at the
released tag.** So nothing is owed here — but `F-148.yaml` still describes the nine-tab strip this slice
deletes, and **two protocols carry `validates: [… F-148 …]`** (`IT-068`, and `IT-152` whose claim is that the
strip is *gone*), so whoever retires F-148 has two `gates:` blocks to re-point.

### C0 — what I did, and what I did not manage to do

**I could not find the root cause, and I am not going to ship a fix that pretends otherwise.** Three
hypotheses were argued from the source and each was disproved *by the source*:

1. **A background indexing race.** No — `V0_0_98` maintains `asset_search_entrypoint` with **synchronous
   AFTER INSERT/UPDATE/DELETE triggers** on `search_entrypoint`, so the seed's own transaction populates it.
2. **A NULL-propagating generated column.** No — `search_entrypoint.search_vector` is
   `GENERATED ALWAYS AS (coalesce(data_entity_vector,'') || …)`; `V0_0_14` wrapped every term in `coalesce`
   precisely to stop one absent vector nulling the whole thing. The seed sets `data_entity_vector` and that
   is sufficient.
3. **A lax health probe letting the seed land before migrations.** No — `management.endpoint.health.show-details`
   is unset, so Spring's default `never` applies and the body is exactly `{"status":"UP"}`. There are no
   components for a substring test to half-match.

`lfQuery` also opens a fresh `Client` per call, so there is no stale-pool story either. **What remains is a
race I have not identified**, firing in roughly one whole-suite run in three, only in suite context.

So the change here is **instrumentation and one verified hardening**, not a claimed fix:

- **The failure now decides itself.** `waitUntilSearchable` used to give up after 90 s with a page-level
  symptom that is identical for at least four causes — and `afterAll` then tore the stack down, destroying the
  evidence (the §18 mistake, repeated). It now probes every layer *at the moment of failure, while the stack
  is still up*: `flyway_schema_history` (is this database fully migrated?), the `data_entity` row and the
  three columns the ranked query filters on, `search_entrypoint` and whether its generated vector matches,
  `asset_search_entrypoint` and whether the AFTER trigger propagated it, and finally
  `POST /api/search/assets` directly — the backend's own answer, independent of the SPA. The next occurrence
  prints which layer lost the row instead of costing another whole-suite run to guess at.
- **A postcondition on the seed itself.** `beforeAll` now asserts all five fixtures reached
  `asset_search_entrypoint` immediately after seeding. A seeding failure reports at the seed; a platform
  failure reports at the platform.
- **`composeUp` asserts what it means** (`stack.ts`): parse the health body and require top-level
  `status === 'UP'` rather than testing the raw text for the substring `"UP"`. Today those agree; they stop
  agreeing the instant anyone enables `show-details`, because a DOWN platform's detailed body still contains
  `"status":"UP"` for every healthy component. Verified-correct hardening of a latent trap — **not** the cause
  of this failure, and not offered as one.

**B2 therefore stays open, and that is the honest state.** What I can say is narrower than a fix: the
observed rate is 1 red in 3 whole-suite runs; the seeding path and the trigger chain are verified sound; and
the next red will name its own cause in one line. What I cannot say is that it will not happen again. **This
is a GATE-2 decision, stated plainly rather than buried:** merge with a known ~1-in-3 flaky
`my-data-scope-narrows` and a self-diagnosing failure, or hold the slice until an occurrence is caught and
fixed. I am not closing it by declaring it closed — that is precisely the call this review rejected.

### Phase G — pushed, and both PR bodies brought in line with reality

| Artefact | State |
|---|---|
| Code | `contrib/CTRIB-062-my-data-filter` **`966d3053..5b20c3da`** (fast-forward) → draft PR **#1871**, head `5b20c3da` |
| Docs | `docs/CTRIB-062-my-data-filter` **`07ae18e..e8fa107`** (fast-forward) → draft PR **#110**, head `e8fa107`, base `release/1.0.0` |

**Push safety re-asserted before each push (LSN-038):** no upstream configured on either branch,
`branch.merge` unset, `push.default=current` (same-name refspec, LSN-034), both worktrees clean, and
`origin/main` verified unmoved at `82e7e70e`. Both remain **draft** and bot-authored — G-C4 means this stream
cannot merge them.

**The code delta is provably comment-only in `main/`.** `git diff 966d3053 5b20c3da -- odd-platform-api/src/main/`
filtered of comment and blank lines returns **zero** lines, so the SUT is functionally identical to the one
the re-review measured and the running regression's verdict carries over unchanged. The only behavioural
change in this commit is two extra assertions in an existing test.

**PR #1871's body now discloses the flake.** It previously read `multi-stack 13 passed` with nothing to
suggest that is not reliably reproducible — which would have handed the maintainer the same false picture this
review rejected the slice for. It now carries a `## Known issue at merge time` section in plain language: what
fails, how often (green/red/green across three whole-suite runs), that the feature is not implicated, the
three root causes that were argued and ruled out *by the source*, what the instrumentation now does instead,
and the merge-or-hold decision left to GATE 2. The per-scroll-page framing (S8) and the corrected test count
(27, not 25 — and not the 29 I briefly wrote before counting) are in the same update.

**PR #110's body** gained the residue-sweep section, including the admission that two of the six pages were
not on the review's list and were found only by grepping the claim across the whole tree afterwards.

**Live regression cross-check while pushing:** `feature-complete` came back **318+ passed / 12 failed**, and
the 12 reconcile to **zero unattributed** — TST-059's eleven plus TST-057's `swagger-openapi-discovery:63`
(the cold-springdoc instance the re-review's own run happened not to reproduce). Note
`search-class-tab-filter.spec.ts:`**`149`** in that list: the re-anchoring done earlier in this phase is what
keeps it attributed rather than reading as a twelfth unexplained failure.

### Phase G — the regression, and the C0 tally corrected

**Four suites plus a deliberate second `multi-stack` sample**, on a SUT built from the worktree at
`5b20c3da` (`run-regression.sh ctrib062g`), flock held throughout:

| suite | result | reading |
|---|---|---|
| `feature-complete` | 328 passed / 12 failed (28.6m) | **zero unattributed** — TST-059's eleven + TST-057's `swagger-openapi-discovery:63`. Note `search-class-tab-filter:`**`149`**: the re-anchoring done in this phase is what keeps it attributed. |
| `known-bugs` | 3 failed | EXPECTED — the three pins, zero unexpected GREENs |
| `multi-stack` #1 | 13 passed / 1 failed | the failure was **my own new locale arm**, not C0 |
| `ingestion-e2e` | 15 passed (5.1m) | green |
| `multi-stack` #2 | 13 passed / 1 failed | same — `:477`, twice, deterministically |
| `multi-stack` #3 (after the fix) | **14 passed / 0 failed** (9.4m) | green, `:477` in 7.6s |

**I shipped a failing test and the suite caught it.** The S7 locale arm asserted against an MUI Autocomplete
that is closed by default, so the option labels it checked were never in the DOM; `DepthSelect` had the same
flaw, since it only renders once its scope is selected. The group heading is a plain `Input` label, which is
why that one assertion passed and hid how wrong the others were. **No product defect** — `scopeLabels` is
properly `t()`-wrapped and the heading demonstrably translated at runtime. Fixed by selecting both scopes in
the URL so the labels render as chips, and re-run rather than re-reasoned.

**C0's tally is corrected, and it is better than the review's estimate.** Across three sessions and six
whole-suite `multi-stack` runs: **green / red / green / green / green / green** — **one red in six**, not the
one-in-three the first two samples implied. `:259` has now passed four consecutive times, including twice on
the reworked branch. The single red remains **unexplained**; the instrumentation that would explain it did not
get a chance to fire.

**What that changes, and what it does not.** It lowers the estimated risk; it does not close B2. A test that
fails once in six whole-suite runs still trains readers to discount a red, and the cause is still unknown.
What is different from the state this review rejected is that the claim is now *measured* (n=6, stated with
its denominator) rather than asserted from n=1, and the next red will name its own cause instead of costing
another session of hypotheses. **The merge-or-hold call is the maintainer's, and PR #1871 carries it in plain
language.**

### Definition of Done — Phase G

| # | Gate | Evidence |
|---|---|---|
| 1 | Full unit build | **BUILD SUCCESSFUL 21m02s — 774 tests / 0 failures / 0 errors / 0 skipped** across 181 classes, parsed from the JUnit XML. `checkstyleMain` + `checkstyleTest` + `assemble` + `jacocoTestReport` green. Count unchanged at 774 because M8's two cases are assertions inside an existing method, not new `@Test`s — which is also why the PR body says 27 and not 29. |
| 2 | FULL integration regression | 4 suites + **three** `multi-stack` samples. `feature-complete` 328/12 with **zero unattributed**; `known-bugs` 3-RED-expected, zero unexpected GREENs; `ingestion-e2e` 15/15; `multi-stack` finally **14/0** once my own broken locale arm was fixed. |
| 3 | Docs | 1 further commit on the `release/1.0.0` train (`e8fa107`), pushed; all three pre-commit sweeps clean; the claim swept tree-wide to zero residue. |
| 4 | Ontology | `lineage/**` untouched. The `F-148` retirement is owned by `playbooks/release-review.md` check 5 at the released tag — stated as the disposition rather than claimed as done (M11). |
| 5 | Principal sufficiency | Every fix-list item closed **except C0**, which is stated as open with its denominator. One test I wrote failed twice and was fixed and re-run rather than explained. |

**C0 now has a tracked home: `backlog/tests/TST-064.md`** — the measurement with its denominator, the three
root causes ruled out *by the source* (so nobody re-derives them), the standing unproven hypothesis, what the
instrumentation already does, and three ways to close it ranked by cost. Filed regardless of the merge
decision, because an unexplained intermittent with no owner is how a suite quietly stops being trusted.

**Status: `blocked` → `review-ready`, on the maintainer's explicit decision (2026-09-01).**

The work was complete except C0, and C0 was never mine to dispose of: I raised it as a blocker in the
re-review, so flipping it myself would have been the "closed on assertion rather than evidence" move this
review rejected. The question was put to the maintainer with the measurement, its denominator, the three
causes ruled out by the source, and three options ranked by cost. **The decision was to hand off now** —
ship the verified slice, carry the residual risk knowingly, and let `TST-064` own the flake.

So the record is precise about who decided what: **every gate below is evidence; the disposition of C0 is a
judgement, and it is the maintainer's, not this stream's.** What ships with it is a known ~1-in-6 red on
`my-data-scope-narrows.spec.ts:259` in whole-suite runs until TST-064 closes — disclosed in PR #1871, tracked
on disk, and self-diagnosing the next time it fires.

Next: a **fresh** `/review` session (this phase ran in the same session as the re-review, which the
separate-session rule permits for `/implement` but not for `/review`), then human GATE 2 owns the merge.

## Review (2026-09-01, session: review-ctrib062-3) — THIRD pass, on the Phase-G rework

Fresh session (Phase G ran inside `review-ctrib062-2`'s session and said so, which the separate-session rule
permits for `/implement` but not for `/review`). Reviewed `contrib/CTRIB-062-my-data-filter` @ **`5b20c3da`** —
17 commits off `origin/main` `82e7e70e`, pushed (`git ls-remote` confirms), carried by draft PR **#1871**
(live API: `open`, `draft: true`, head `5b20c3da`, 17 commits / 49 files, `mergeable_state: blocked`) — plus
`documentation@docs/CTRIB-062-my-data-filter` @ **`e8fa107`** (4 commits off `origin/release/1.0.0` `5b2bb04`,
pushed, draft PR **#110**, base `release/1.0.0`, `mergeable_state: clean`).

- **Result**: **ACCEPTED** — GATE-2-ready. Status stays `review-ready` (the `review-ctrib048` / `review-ctrib051`
  precedent: on PASS with an unmerged draft PR the item stays `review-ready`; the human GATE-2 merge moves it to
  `pending-release`, and `/review release:1.0.0` owns `done`).

**No 2-minute precondition bounce.** The Phase-G DoD records all five gates as RUN at `5b20c3da` and admits
nothing unrun; four suite run-logs exist at `run-log/2026-09-01-*` and the SUT image
`odd-platform:odd-team-sut-ctrib062g` is still on disk with id `4ecdd6f7`, matching the digest its sample-3
entry cites. **C0 is open by disposition, not by omission** — the stream raised it as its own blocker and
records the maintainer as having decided to hand off; per `memory/feedback_maintainer_driven_close_no_bounce`
a maintainer-driven close is not a bounce. See the honesty note at the end for what I could and could not
corroborate about that decision.

**`Sources:` footer — N/A, not waived.** `pillars/contributor/gates.md` defines no `Sources:`/`Consumer-read:`
footer; the contributor pillar puts provenance in the CTRIB ledger (G-C2 running-system verification + G-C13),
which cites `file:line` throughout and which I sampled against the source below. Both prior reviews read it the
same way.

### Acceptance criteria (the item's own Spec R1-R8)

The `main/` delta from the last-reviewed `966d3053` to `5b20c3da` is **provably comment-only** — I re-derived
it rather than accepting the claim: `git diff -U0 966d3053 5b20c3da -- odd-platform-api/src/main/`, stripped of
comment and blank lines, is **empty**. The only behavioural change in that commit is two added assertions in an
existing test. So the prior pass's 8/8 verdict on product behaviour carries, and I re-derived the
highest-risk half first-hand rather than inheriting all of it.

- [x] **R1** — scope group narrows the cross-kind search — PASS. Union semantics in
  `ReactiveAssetSearchRepositoryImpl.java:355-376` (`dataEntityBranches` OR-ed, then `dataEntityScoped.or(termScoped)`);
  exercised end-to-end by IT-153 in my own `multi-stack` run below.
- [x] **R2** — ownership per kind by that kind's own relation — PASS, read first-hand. DE via
  `OWNERSHIP.DATA_ENTITY_ID`; Terms **only** via `TERM_OWNERSHIP` and **only** when `MY_OBJECTS` is selected
  (`scope.myObjects() ? … : DSL.falseCondition()`); query examples have no branch at all, so they fall out of
  `dataEntityScoped.or(termScoped)` — the pass-through defect this slice exists to close.
- [x] **R3** — per-direction depth, default 1, ceiling 3 — PASS. `clampDepth` is
  `Math.min(Math.max(requested, 1), MAX_DEPTH)`; **both** sides now asserted (`MyDataScopeResolverTest:94` above
  the ceiling, `:102` at `-7`, `:100` at `0`) — M8 genuinely closed. Wire types stay permissive
  (`components.yaml`: `my_data` a plain string array, depths plain `integer` with no `minimum`/`maximum`), with
  the reason documented inline; a hand-edited URL clamps rather than 400s.
- [x] **R4** — bounded expansion, server-declared visible truncation — PASS. `withTruncation` stamps
  `scopeTruncated` + reason once on the way out (`AssetSearchServiceImpl.java:96-105`); `MAX_SCOPE_NODES` is
  documented as the only set-determining bound and `WALL_CLOCK_BUDGET` as a circuit breaker that yields TIMEOUT
  with **no** scope. The perf half was measured by the implementer on the running platform in Phase F and the
  executed plan is now quoted in the shipped comment (C1) — I verified the comment matches the claim.
- [x] **R5** — tab strip retired, count survives — PASS. `SearchResultsTabs.tsx` / `SearchTabsSkeleton.tsx`
  deleted; `SearchResultsHeader` is rendered **outside** the `{!routerSearchId && …}` gate
  (`Results.tsx:159-162`, with the reason in a comment) — the plan-check W5 trap is closed, so the legacy
  `/search/{sessionId}` route keeps its count.
- [x] **R6** — the three panels deep-link — PASS. `OwnerEntitiesList.tsx:107/115/123` pass
  `viewAllTo={buildSearchLink({ myData: ['MY_OBJECTS'|'UPSTREAM'|'DOWNSTREAM'] })}`.
- [x] **R7** — explicit posture when it cannot personalise — PASS server-side:
  `AssetSearchServiceImpl.java:90` `switchIfEmpty(Mono.just(new AssetList(List.of(), new AssetPageInfo(0L, false))))`
  — a scope with no resolvable owner returns an empty page, never an unscoped one. Both UI arms are asserted by
  IT-152 against real stacks.
- [x] **R7b** — "Clear All" clears the scope — PASS. `Filters.tsx:37-43` rebuilds from `{query, sort}` only,
  dropping facets, `asset_kinds`, `my_data` and both depths, with the deliberate-change rationale in the comment.
- [x] **R8** — additive contract, no break — PASS. `MyDataScopeDto.resolve(getMyData(), getMyObjects())`;
  `my_objects` marked `deprecated: true` with the alias semantics in its description. The FE back-compat
  coverage was **migrated forward, not deleted** (G-C15): `searchUrlState.test.ts:99-106` keeps the fail-closed
  cases (`?my=true → ['MY_OBJECTS']`, `?my=1`/`?my=yes` → undefined) and **adds** one — explicit `my_data` wins
  over the legacy flag.

### Quality Bar

- **Gate 1 — No duplicates**: PASS. The new BFS is not a parallel copy of the lineage CTE; `MyDataScopeResolverImpl`'s
  javadoc states the reuse decision and *measures* it (the `UNION ALL` CTE materialised 130 000 rows for 800
  distinct nodes at depth 2 and did not finish depth 3 inside a 25 s statement timeout; the BFS answers depth 3
  in ~281 ms), and explicitly leaves the graph view's CTE unchanged. A reuse scan answered, not skipped.
- **Gate 2 — Aliases**: PASS for this PR, with a scope gap logged. The vocabulary split (Upstream Dependencies /
  Dependents / "of my data") is tracked by `DOC-506`; its `affected_files` did **not** include
  `main-concepts.md`, whose "Terms & Aliases" table (`:97-128`) is the canonical alias register and carries no
  row for this relationship. **`DOC-506` extended in place** (not duplicated — LSN-009) with the register as an
  affected file, a proposed two-row table, and a matching acceptance criterion.
- **Gate 3 — Caveats as admonitions**: PASS. Both truncation outcomes are a `hint style="warning"` on
  `search.md` with a two-row table separating NODE_CAP (deterministic subset) from TIMEOUT (lineage contributed
  nothing), each with its own remedy; the direction-semantics caveat is a `hint style="info"` on
  `catalog-overview.md`. Not buried in prose.
- **Gate 4 — Consumer-read**: PASS. Every runtime claim I sampled traces to the enforcing code —
  `SecurityConstants.WHITELIST_PATHS:95-96`, `HousekeepingTTLProperties`, `GenAIProperties`/`WebClientConfiguration:23`,
  `IngestionAuthenticationFilter:49-64`, `GenAIServiceImpl:22/47` — all read directly, none inferred.
- **Gate 5 — Unset-parameter audit**: N/A — no SDK builder in scope.
- **Gate 6 — Bidirectional code ↔ doc**: PASS with one logged finding. Every user-visible path the slice touches
  has doc coverage on the train (the filter, the depths, both truncation states, the retired strip, the panel
  deep-links, the three postures). The finding is in the other direction and is logged, not narrated:
  **`DOC-512`** — `data-discovery.md:13`'s screenshot still shows the nine-tab strip while the caption this
  slice rewrote describes the new sidebar, so caption and figure now contradict each other. Verified by opening
  the PNG, not inferred.
- **Gate 7 — Layout and completeness**: PASS. No new pages, so `SUMMARY.md` correctly unchanged; the removed
  `## Result-class tabs` heading has **no** inbound anchor anywhere in `docs/` (swept); the four added links and
  both anchors (`search.md#my-data` → `:51`, `catalog-overview.md#recommended` → `:49`) resolve; the ADR log is
  set-equal across files ≡ README index ≡ SUMMARY (30/30/30).
- **Gate 8 — Publishing standards**: **PENDING-RELEASE (1.0.0)**, with one precision the release gate must not
  read past. The doc is genuinely **authored and pushed**, not parked as a backlog draft (the CTRIB-040 failure
  mode Gate 8 exists to catch): `origin/release/1.0.0` exists at `5b2bb04`, `origin/main` is **contained in** it
  (so the train is not behind), and `docs/CTRIB-062-my-data-filter` @ `e8fa107` carries the change across 7
  files. **But it is on a branch TARGETING the train, not on the train itself** — `git merge-base --is-ancestor
  origin/docs/CTRIB-062-my-data-filter origin/release/1.0.0` is **false**, and `origin/release/1.0.0`'s own
  `search.md` contains no `My data` section and no posture table. The CTRIB-048 precedent is that the doc PR is
  **merged into** `release/{version}` before the item is called train-ready (there: "PR #109 merged →
  origin/release/1.0.0 @ 61cd0a8"). **`documentation` PR #110 is still an open bot-authored draft**
  (`mergeable_state: clean`), so a human must mark it ready and merge it — G-C4, exactly as for the code PR.
  **Until that merge, a 1.0.0 cut would ship the My-data filter with no published documentation at all.**
  Corrected 2026-09-01 after the maintainer asked whether the behaviour is on the train; the first wording of
  this line said "authored and pushed on the train", which overstated it. Branch-verifiable sub-checks against the train commit all pass:
  PyYAML parses every frontmatter; all 7 `description:` values are ≤200 chars (127-191, under the GitBook
  truncation limit); every relative link and image resolves. Post-merge verification list recorded below.
- **Gate 9 — Factual claim provenance**: PASS. The C1 correction is real — the shipped comment now carries the
  executed plan (`Bitmap Index Scan on asset_search_entrypoint_search_vector_gin_idx`, 120 000 → 10 000, ranked
  page 507.77 ms), the PLT-260 attribution for the dominant `count(*)`, and the per-scroll-page framing (S8);
  `TST-063` is closed with the same evidence. The PR body's one remaining number problem is under "still owed".
- **Gate 10 — Content-type homing**: PASS. The contract lives in `components.yaml`, the operator description on
  `search.md` under the pillar it belongs to, the config-free feature narrative on `catalog-overview.md`. No
  API-reference fragment embedded on a feature page; no configuration reference smuggled in.
- **Gate 11 — Audience isolation**: PASS. The mechanical grep over every `+` line of the train diff for
  `Cornerstone N` / `Gate N` / `LSN-NNN` / `DOC-NNN` / `CTRIB-NNN` / `TST-NNN` / `IT-NNN` / `feature-flow` /
  `Quality Bar` / `sidecar` / `backlog` / `playbook` / `pillar` / `retrospective` / `scanner` / `lineage/` /
  `ontology` returns **zero** hits.

### What I measured myself, rather than read

- **Full CI-replica unit build at `5b20c3da`** (my own, in `../odd-platform-ctrib062`): **BUILD SUCCESSFUL 24m25s
  — 181 classes / 774 tests / 0 failures / 0 errors / 0 skipped**, parsed from the JUnit XML and checked that
  the XMLs were written *by this run* (mtimes 12:22, not a stale artefact). `checkstyleMain`, `checkstyleTest`,
  `assemble` and `jacocoTestReport` all ran. Exactly reproduces the Phase-G figure. Both TST-057 suspects
  (`LoadIngestionTest`, `OpenApiDocsContractTest`) passed here too — a fourth box on which they do not fail.
- **Changed-lines coverage, computed from my own JaCoCo XML rather than quoted**: I extracted every added line
  in `odd-platform-api/src/main/java` from `git diff -U0 82e7e70e 5b20c3da` and joined it against
  `jacocoTestReport.xml`: **115/115 = 100.00%** (`AssetSearchScope` 2/2, `MyDataScopeDto` 25/25,
  `MyDataScopeResult` 3/3, `AssetSearchServiceImpl` 25/25, `MyDataScopeResolverImpl` 60/60). CI's
  `min-coverage-changed-files: 98` clears with margin. The repository classes correctly do not appear — jacoco
  excludes `repository`.
- **FULL four-suite integration regression, on a SUT I built myself** from the reviewed worktree
  (`odd-platform:odd-team-sut-revctrib0623`, digest `sha256:82983e32`, independent of the implementer's
  `sha256:4ecdd6f7`), whole suites, one process, under the flock:

  | suite | result | reading |
  |---|---|---|
  | `feature-complete` | **328 passed / 11 failed / 1 skipped** of 340 (31.2m) | the 11 **set-equal to TST-059's named eleven** by exact `spec:line` — **zero unattributed** |
  | `known-bugs` | **3 failed** of 3 | exactly the pins IT-007/IT-006/IT-004 — **zero unexpected GREENs**, so no flip-on-fix is owed |
  | `multi-stack` | **14 passed / 0 failed** (10.8m) | **GREEN**, whole suite, in suite order |
  | `ingestion-e2e` | **15 passed / 0 failed** (5.0m) | GREEN |

  The eleven, listed so the set-equality is checkable and not asserted: `catalog-search` 48/62 ·
  `entity-class-type-badge-list` 59/77 · `recently-viewed-record-see-loop` 117/213 · `search-url-state` 38 ·
  `search-result-stale-signal` 62 · `search-result-row-click` 45 · `search-class-tab-filter` **149** ·
  `popular-entities-ranking` 62. Note the last-but-one: it reports at exactly the line Phase G re-anchored
  TST-059 to (`:148 → :149`), which independently validates that bookkeeping rather than taking it on trust.
  No TST-057 springdoc instance on this box, so 328/11 is one cleaner than the implementer's 328/12.
- **The `api:FAIL` on `feature-complete` is not this change, and I ran it down rather than reading past it.**
  The probe rail cannot *build*: `uv` fails on `lineage/_extractor/pyproject.toml:9` (`readme = "../README.md"`
  is outside the project directory, which hatchling rejects), so `P-001` never executes. Every recorded
  `feature-complete` entry across three sessions carries the same `api:FAIL`, and that file was last touched by
  CTRIB-027 and the graph-query-layer work — nothing to do with ST-8. Filed as **`TST-065`** (high) so the red
  is attributed and the dead rail gets an owner.
- **C0 — my run is the seventh sample, and it is green.** `multi-stack` passed **14/0** including all five
  IT-153 cases: the C0 case itself (the R2 pass-through-regression test, formerly `:259`, now `:388` after
  Phase G's failure-time instrumentation grew the file) and `:477`, the S7 locale arm that failed twice during
  Phase G. **Running tally across four sessions and seven whole-suite runs: green / red / green / green /
  green / green / green — one red in SEVEN.** That is an independent sample better than the "once in six" PR
  #1871 discloses, and the fifth consecutive pass of the case. It does **not** close C0 — the single red is
  still unexplained and `TST-064` owns it — but it lowers the estimate again on evidence rather than assertion.
- **Doc train, checked against the remote rather than the local tree**: `origin/main` is *contained in*
  `origin/release/1.0.0` (so the train is not behind main and will not regress anything on merge), and
  `docs/CTRIB-062-my-data-filter` @ `e8fa107` carries the change across 7 files. PyYAML parses every
  frontmatter; all 7 `description:` values are 127-191 chars, under the 200-char GitBook truncation limit; every
  relative link and image resolves; both anchors resolve; the removed `## Result-class tabs` heading has no
  inbound anchor anywhere in `docs/`.
- **i18n, re-derived**: 688 keys x 7 locales, **0 missing / 0 extra**, every new key genuinely translated.
- **Live site**: all 7 affected pages return 200 today under their real GitBook slugs (recorded below for the
  release gate); the `DOC-510` contradiction I found during the editorial audit was confirmed by `curl`-ing the
  published page, not only by reading the repo.

- **G-C15 on the Phase-G test delta** (the part the last review could not have seen): `multilingual-i18n.spec.ts`
  is a **verbatim extraction** of `switchLanguageViaUi` into `helpers/locale.ts` — same three steps, same
  selectors, no assertion touched. `helpers/stack.ts`'s `composeUp` was **strengthened**, not weakened: a
  substring test (`body.includes('UP')`) became a parsed top-level `status === 'UP'`, with non-JSON treated as
  "not up yet". A changed test asserting more truth is the right direction.
- **LSN-033 orphan check**: IT-152 is registered in `feature-complete` **and** `ui-e2e`; IT-153 in `multi-stack`;
  IT-068 and IT-151 retained in place. All four protocol files exist. No protocol authored-but-unregistered.
- **G-C5 scope comment**: posted on #1842 (`2026-08-30T22:41:41Z`, `odd-contributor[bot]`), ASCII-only, and its
  three corrections match what shipped (no "All" option, the panels get a *new* View all, the cross-kind
  semantics fixed as part of "each scope narrows correctly").
- **Undeclared but correct scope addition**: the slice also adds the missing catalog key `"Saved search deleted"`
  in all 7 locales. It has a live consumer (`savedSearch.thunks.ts:73` calls `i18n.t('Saved search deleted')`),
  so this closes a pre-existing gap where a shipped call site had no key — right to fix, but it means the "11
  new i18n keys" figure in the item and the PR body is really 13 ST-8 keys + 1 pre-existing repair. Noted, not
  charged against the item.

### Still owed before GATE 2 — none of these is a gate failure

1. **PR #1871's decision paragraph carries the superseded number.** Inside the same `## Known issue at merge
   time` section, `:261`/`:268` correctly say *"failed **once in six** whole-suite runs"* and *"four more runs
   put it at one-in-six"*, but `:287` — the sentence that actually poses the merge decision — still reads
   *"merge accepting a known **~1-in-3** flaky spec"*. The on-disk copy is byte-identical to the published body
   (M7 verified), so both carry it. It errs toward caution and the correct denominator is two paragraphs above,
   so it cannot cause a bad merge — but it is the single number the GATE-2 decision turns on, in a public
   artefact, and it is one word.
2. **M9 was dropped from the Phase-G fix-list without a note.** The re-review's minor —
   `V0_0_101__lineage_child_oddrn_index.sql` creates **three** indexes (`lineage_child_oddrn`,
   `ownership_owner_id`, `term_ownership_owner_id`) while the filename names one — is neither fixed nor
   dispositioned; `grep M9` over the item returns only the original finding. The migration's own body documents
   all three thoroughly, so the impact is a reader grepping the migration set for the ownership index and not
   finding it. Fix or record a "won't fix, and why" — silently dropping a fix-list row is the habit worth not
   forming, more than this row is worth.
3. **`DOC-512`** — the screenshot, logged above, to land on the 1.0.0 train before it publishes.

### Gate 8 — post-release verification list (for `/review release:1.0.0`)

Live GitBook slugs resolved by following redirects today; all 7 return 200:

| Page (train) | Live URL |
|---|---|
| `docs/Architecture.md` | `https://docs.opendatadiscovery.org/introduction/architecture` |
| `docs/Features.md` | `https://docs.opendatadiscovery.org/features/features` |
| `docs/data-discovery.md` | `https://docs.opendatadiscovery.org/features/data-discovery` |
| `docs/data-discovery/search.md` | `https://docs.opendatadiscovery.org/features/data-discovery/search` |
| `docs/data-discovery/catalog-overview.md` | `https://docs.opendatadiscovery.org/features/data-discovery/catalog-overview` |
| `docs/data-discovery/directory.md` | `https://docs.opendatadiscovery.org/features/data-discovery/directory` |
| `docs/data-discovery/vector-stores.md` | `https://docs.opendatadiscovery.org/features/data-discovery/vector-stores` |

Phrases to assert post-merge: *"three kinds of control"*, *"seven aggregated facets"*, *"My data"*,
*"Upstream of my data"* / *"Downstream of my data"*, *"View all"*, *"results (partial)"*, *"Only part of your
My data lineage scope was searched"*, *"could not be resolved in time"*. And assert the **absence** of
*"seven facets"* (unqualified) and *"entity-class tab strip"* outside the Activity-Feed panel (DOC-452).

- **Outbound URL sweep**: 7 live pages verified 200 with their real GitBook slugs; every relative link and both
  anchors on the changed pages resolve; 4 external repo/release URLs checked live during the editorial audit.
- **Banned-phrase check**: none used. Every verdict line above ends in a `read`/`grep`/`run`/`fetch` citation.
- **Navigation**: consistent — the slice adds no new bean factory or SDK builder; `MyDataScopeResolver` is a
  service reachable from the search domain already mapped.
- **Upstream issues logged**: none new (the C0 flake has a home in `TST-064`, filed by the implementer).

### Honesty note on the C0 disposition

The item, the commit `c262128d`, and `state/active-streams.yaml` all record C0's disposition as *"the
maintainer's explicit decision (2026-09-01)"*. **All three are the same stream's own assertion**, and I found
no independent artefact: issue #1842 carries exactly two comments, both `odd-contributor[bot]` (the pre-work
notes and the G-C5 scope comment), and there is no maintainer comment or commit recording that call.

I record that as unverified rather than accept it as evidence — but it does not change the verdict, and it
should not, because the substance does not depend on it: the residual risk is **measured with its denominator**
(one red in six whole-suite runs, three sessions, three independently-built SUT images), **disclosed in plain
language in the published PR body**, **tracked on disk in `TST-064`** with the three ruled-out causes so nobody
re-derives them, and **self-diagnosing** the next time it fires. The actual merge-or-hold decision belongs to
GATE 2 either way. A known, quantified, disclosed, owned intermittent handed to a human with the evidence is a
legitimate state to review; it is the opposite of the "closed on assertion" move the second review rejected.

### Doc-product editorial audit (mandatory step, ran)

**Coverage this run — the partition the last review queued, plus the subtree nobody had ever claimed.**
`developer-guides/api-reference/{alerts, data-collaboration, genai, glossary, reference-data}` (all five
queued) · `integrations/push-adapters/{odd-airflow-2, odd-dbt, odd-spark-adapter}` ·
`integrations/collectors/{odd-collector-azure, odd-collector-gcp}` ·
`developer-guides/build-and-run/{build-and-run-odd-collectors, custom-collectors}` ·
`developer-guides/architecture-decision-log/**` (structural) · **`active-platform-features/**`** — which the
last review explicitly recorded as *"never been claimed by any run"* — and a full config-key sweep of
`configuration-and-deployment/odd-platform.md`.

**Most of what I checked is right, and that is the finding worth stating first.** Claims were verified against
*source*, not cross-page consistency: all four collector adapter counts match their `PLUGIN_FACTORY` dicts
exactly (`odd-collector` 41, `-aws` 11, `-azure` 4, `-gcp` 4, type literals included); the six monorepo
`pyproject.toml` files really do all pin `python = "^3.9"`; every one of the ten SDK module paths
`custom-collectors.md` cites exists, and its behavioural claims check out to the line (three adapter contracts,
`class Plugin(BaseSettings, extra="allow")`, `load_adapters` importing `{root_package}.{plugin.type}`);
`odd-airflow-2`'s "latest release `v0.0.8`, default branch `master`" and `odd-spark-adapter`'s `v0.0.1` are both
correct against the live GitHub API; `glossary.md`'s strongest claim — that `DATA_ENTITY_ADD_TERM` never fires
because the rule is registered on the singular path — is confirmed at `SecurityConstants.java:238/241`;
`genai.md`'s `/query_data` + un-quote/unescape contract is exact at `GenAIServiceImpl.java:22/47`; and
**every** documented endpoint path across all ten api-reference pages (166 spec paths cross-checked) resolves,
with the only four non-matches each run down and each legitimate. The ADR log is set-equal across files ≡
README index ≡ SUMMARY (30/30/30), all `accepted`, none superseded-but-unmarked.

**Findings** (each logged on disk, none narrated, none blocking this item):

* **`DOC-510`** (**critical**, *internal contradiction* + *parallel surfaces with drift*) — **six published
  pages still tell operators that `auth.ingestion.filter.enabled` covers only `/ingestion/entities`, when
  ADR-0079 shipped whole-namespace coverage in 0.29.0 — the latest release.** Verified in source
  (`IngestionAuthenticationFilter:49-64` matches `/ingestion/**` minus the two dedicated paths) and in git
  (`4028b4a6`, 2026-06-22; `git tag --contains` → `0.29.0`). `odd-platform.md` **contradicts itself 73 lines
  apart on the live site** — `:640-641` tells you to configure the AlertManager token via `http_config`,
  `:713` says *"Toggling `auth.ingestion.filter.enabled` has no effect on this endpoint"* — and I confirmed
  both render by `curl`-ing the published page, not just reading the repo. The dangerous direction is an
  operator concluding the flag would not help and leaving it off, keeping `/ingestion/metrics`,
  `/ingestion/alert/alertmanager` and the stats path open when one config line closes all three. Survived
  because `DOC-479` corrected the surfaces it *named* and verified that the new text renders — never that the
  old text was gone.
* **`DOC-511`** (high, `milestone: 1.0.0`, *cross-audience absence* with a data-loss edge) — the housekeeping
  reference enumerates **five** cleanup tasks and **three** TTL keys; the platform has **six** jobs and
  `HousekeepingTTLProperties` declares **five** `private int` fields. `grep -rn "recently_viewed" docs/` returns
  **zero hits tree-wide**. The sharp end: the page's own remediation YAML for its primitive-`int`-binds-to-`0`
  danger admonition lists three keys, so an operator who follows it binds `recentlyViewedDays` and
  `recentlyViewedMaxPerUser` to `0` — and `RecentlyViewedHousekeepingJob` then deletes with `cutoff = now` and
  trims to `rn > 0`, i.e. wipes Recently Viewed every 15 minutes, silently. **Routed to the 1.0.0 train, not
  main**: the job landed in `9097c548` (2026-06-29), *after* the 0.29.0 tag, and `git tag --contains` is empty —
  so the live manual is not currently wrong, and this must land before 1.0.0 publishes rather than after.
* **`DOC-509`** (medium, *internal contradiction*) — `active-platform-features.md:15` still describes the Alerts
  view as three tabs (`All / My Objects / Dependents`) that list *"open alerts only; resolved history is read on
  each entity's own Alerts tab"*, while the page it links to says four tabs and states in as many words that
  *"in the previous release the global tabs were hardwired to `OPEN` … the Status filter removes that
  restriction"*. `DOC-291` and `DOC-474` both fixed this claim on the pages they named; the pillar landing page
  was in neither one's `affected_files`.
* **`DOC-512`** (medium, `milestone: 1.0.0`, *Gate 6*) — the stale Catalog-Search screenshot, above.
* **`DOC-513`** (low, *parallel surfaces with drift*) — two of the ten api-reference pages use a different
  endpoint-table shape and drop the **Operation ID** column, the field that joins a documented row to the
  generated client method; `lineage.md` also abbreviates the spec's `{data_entity_group_id}` to `{id}`.
* **`TST-065`** (high) — the dead API-probe rail, above; extended in the same pass with the corpus-scale
  measurement that **855 run-log entries** still carry the unfilled `<captured values…>` template (the
  corpus-scale version of this review's own M10, fixable once in `run-suite.sh` from the Playwright JSON).
* **`DOC-506` extended, not duplicated** (LSN-009) — its `affected_files` gained `main-concepts.md`, whose
  "Terms & Aliases" table is the manual's canonical alias register and carries **no** row for the
  lineage-neighbour vocabulary, plus a proposed two-row table and a matching acceptance criterion.
* **`DOC-452` re-confirmed, not re-filed.**

**Queued for the next `/review`:** `integrations/collectors/{odd-collector, odd-collector-aws,
odd-collector-profiler}`, `integrations/push-adapters/{odd-cli, odd-great-expectations}`,
`developer-guides/api-reference/{directory, integrations, lineage, query-examples, relationships}` as *content*
(paths verified this run, prose not), the ADR-log **content** (structure only this run),
`active-platform-features/{activity-feed, data-collaboration}` as full reads, and the rest of
`configuration-and-deployment/**` (`deployment.md`, `trylocally.md`, the EKS page,
`collectors-secrets-backend.md`, and `enable-security/**` beyond its README). I am not carrying any of these
forward as "done", because they are not.

### Verdict

**ACCEPTED — GATE-2-ready. `status: review-ready` is retained**, per the `review-ctrib048` / `review-ctrib051`
precedent: with the PR still an unmerged draft, the human GATE-2 merge is what moves the item to
`pending-release`, and `/review release:1.0.0` owns the flip to `done`. The bot cannot merge its own PR (G-C4),
and `mergeable_state: blocked` on #1871 confirms the branch protection is doing its job.

Every acceptance criterion and every applicable Quality Bar gate passes with cited, first-hand evidence; Gate 5
is N/A and Gate 8 is PENDING-RELEASE with its verification list recorded. The unit build, the changed-lines
coverage gate, the four-suite regression, the i18n parity and the doc-train checks were all re-measured on this
session's own artefacts rather than accepted from the ledger, and each reproduced.

Three things are **owed but not blocking**, listed above: the PR body's stale `~1-in-3` in the sentence that
poses the merge decision, the silently-dropped M9, and `DOC-512`. The first is one word in the public artefact
the GATE-2 call turns on and is worth fixing before the merge; the other two are tracked.

What ships with this slice is a known, measured, disclosed and owned intermittent — now **one red in seven**
whole-suite runs on my own independent sample — with the merge-or-hold call left to the human, in plain
language, in the PR. That is a legitimate state to hand to GATE 2.

## GATE 2 — merged 2026-09-01 (human), `review-ready` → `pending-release`

The maintainer merged `#1871`. Every fact below was re-read from the API and the remote refs rather than
taken from the report (the CTRIB-049 discipline — never infer merge state from local state).

| Fact | Value | Source |
|---|---|---|
| PR #1871 | `state: closed`, `merged: true` | live `GET /repos/opendatadiscovery/odd-platform/pulls/1871` |
| Merged at / by | `2026-09-01T11:51:25Z` / `RamanDamayeu` | same |
| Squash commit | **`b5d9f150`** — now `origin/main` head | same + `git rev-parse origin/main` |
| Head at merge | **`5b20c3da`** — **exactly the reviewed SHA** | same |
| Faithfulness | **`git diff 5b20c3da b5d9f150` is EMPTY** | run here |
| Issue #1842 | auto-closed `2026-09-01T11:51:27Z`, milestone 1.0.0 | live `GET .../issues/1842` |
| Milestone 1.0.0 | **OPEN** — 20 open / 9 closed, due 2026-07-31 | live `GET .../milestones?state=all` |

**Why this matters and is not a formality.** The review measured everything at `5b20c3da`: the 774-test unit
build, the 115/115 changed-line coverage, the four-suite regression on a SUT built from that tree. A squash
that introduced drift would invalidate all of it. The diff is empty, so **the review's evidence applies
verbatim to what is now on `main`** — no re-measurement is owed at the release gate beyond the standard
run-against-the-published-artifact checks.

**Status: `review-ready` → `pending-release`.** 1.0.0 is unreleased (latest release is 0.29.0), so this item
cannot reach `done` here — `/review release:1.0.0` owns that flip after the release ships and the recorded
live-URL verification runs (`playbooks/release-review.md` check 4 + the Gate 8 list in the verdict above).

### The one thing GATE 2 did NOT close

**`documentation` PR #110 is still an unmerged DRAFT against `release/1.0.0`.** The code is on `main`; the doc
is not on the train. Verified: `origin/release/1.0.0` is at `5b2bb04` and its `search.md` contains no `My data`
section and no posture table; `git merge-base --is-ancestor origin/docs/CTRIB-062-my-data-filter
origin/release/1.0.0` is false.

Concretely, **a 1.0.0 cut as things stand ships the My-data filter with no published documentation at all** —
including the three-state posture table that explains why the filter is invisible on an `auth.type=DISABLED`
deployment, which is the first question a reader actually asks (the maintainer hit exactly this on a local
stack the same day).

Note the ordering hazard: `documentation` **PR #108** (`release/1.0.0 → main`, the train-merge PR) is open and
**not** a draft, so the train can be published at any time. **#110 must merge into `release/1.0.0` before #108
merges the train into `main`.** `playbooks/release-train-merge.md` step 4 would flag the gap when the milestone
issues are cross-checked against the train — but only if the gate is actually run, and #108 can be merged
directly without it.

`TST-064` (the ~1-in-7 IT-153 intermittent) also remains open, disclosed in the merged PR body and carried
knowingly per the maintainer's decision.
