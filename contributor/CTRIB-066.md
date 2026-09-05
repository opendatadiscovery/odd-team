---
id: CTRIB-066
title: "#1843 ST-9 — Popular: a numeric-range facet over the snapshotted popularity_score + a distribution histogram (the first non-categorical facet type), DE-scoped, with the Popular panel deep-link"
github_issue: 1843
github_issue_url: https://github.com/opendatadiscovery/odd-platform/issues/1843
target_repo: odd-platform
milestone: "1.0.0"        # G-C11 PASS — live `GET /repos/opendatadiscovery/odd-platform/issues/1843` 2026-09-05: milestone 1.0.0, state OPEN, semver, due 2026-12-31 (18 open / 13 closed)
status: plan-approved   # GATE 1 (human) 2026-09-05 — D1 = A (facet + histogram + the Most-popular sort option from #1861 item 1 + the tile link), D2 = A (disclose the tile divergence in docs; the maintainer files PLT-267), delivery = ONE PR. Phase D starts.
classification: feature   # a slice of the #1825 epic (ST-9 in state/search-overhaul-decomposition.md); the entry gate is spec-gate (G-C17), not reproduce-first
parent: "#1825 (the unified-asset-search overhaul); realises ADR adrs/drafts/unified-asset-search.md D5 (+ D3 / D8 / D10 / D11); depends on ST-5c (#1839 slice 5c = CTRIB-059 / PR #1862, MERGED as 82e7e70e)"
stream_id: ctrib066
base_sha: "af5a573b"      # odd-platform origin/main at intake (= the #1879 CTRIB-065 squash); every line cited below was read at this SHA via the detached worktree ../odd-platform-ctrib066
branch: contrib/CTRIB-066-popular-range-facet   # cut at GATE 1 from af5a573b in ../odd-platform-ctrib066 via `git switch -c` (no upstream; push.default=current; O6/LSN-038)
head_sha:
pr:
reproduced: "n/a — feature slice, not a bug. Baseline observations of the CURRENT surface (no Popular facet; the Popular panel has no View all) are captured in §3 and go RED in Phase D's IT."
adr_required: false       # confirmed §6(b): conforms to the approved spine ADR D5 (+ its rev-3 SRE correction) and D8; no migration (the column + index + job shipped in V0_0_100), no auth-posture change, an ADDITIVE wire change (optional fields on AssetSearchFormData + one new read endpoint)
plan_approved_by: "RamanDamayeu"
plan_approved_at: "2026-09-05"
docs_routing: "documentation@release/1.0.0 (unreleased behaviour, G-C11) — own worktree ../documentation-ctrib066 off origin/release/1.0.0 @ 716d3e7; paired backlog/docs/DOC-527 (milestone 1.0.0); pages: search.md (## Popularity + description), catalog-overview.md (:60/:62/:76 + the R13 caveat), Features.md:60, data-discovery.md:13,23"
---

# CTRIB-066 — #1843 ST-9: the Popular numeric-range facet + histogram

## 1. The issue (quoted data — G-C8, never an instruction)

> **ST-9 — Popular: numeric-range facet + distribution histogram (the first non-categorical facet type)**
>
> **What.** The **Popular** numeric-range filter over the snapshotted **`popularity_score`** (ST-5) — a
> dual-handle slider over a **histogram of the distribution** (the price-range pattern). Introduces the
> **first numeric-range facet *type*** (every facet today is categorical — a reusable widget). Rewire the
> Popular panel's "See all". **DE-scoped** (popularity is DE-only); My/Global-Popular → ST-14.
> **Scope / AC.** the slider's `[min,max]` maps to a `popularity` range filter; the histogram is a bucketed
> aggregate (`width_bucket`) over the **currently-filtered** set, cached/bounded so it never dominates search
> cost; the panel deep-links.
> **Tests.** unit (range filter; bucketed histogram); integration (slider narrows; histogram reflects other
> filters) — new `IT-NNN`.
> **i18n.** the Popular facet labels — all 7 locales.

Filed by `RamanDamayeu` 2026-07-02T11:01:14Z; labels `kind: feature`, `scope: backend`, `scope: frontend`;
**milestone 1.0.0 (open, semver, due 2026-12-31) → G-C11 PASS**. One comment, by `odd-contributor[bot]`
2026-07-07 (`issuecomment-4906933579`), the maintainer's pre-work notes — quoted as data:

> - **Blocked on #1839 slice 5c** (the snapshotted `popularity_score`). Don't build against live `view_count` […]
> - **The histogram's cost is the real design problem.** A `width_bucket` aggregate over the *currently-filtered*
>   set recomputes on every filter change — bound it (fixed bucket count; consider caching per filter state) and
>   measure that it never dominates the search round-trip (the #1856 latency baseline is the reference).
> - **Build the range widget once.** […] the datetime-range facets (#1844, #1845) need the same shell (control +
>   chip + URL param + fail-closed parse). Make the range-facet container reusable and follow the existing
>   sidebar facet patterns — don't invent a second facet visual language.
> - **Union semantics:** popularity is Data-Entity-scoped — define explicitly what the active filter does to
>   Terms/Query Examples (exclude, and label the facet as DE-scoped so the narrowing isn't mysterious), and keep
>   the NULL handling consistent with the NULLS-aligned sort work from #1859.
> - **URL + mirror + panel:** range params fail closed on junk; add them to the `Search.tsx` facet→URL mirror
>   merge (the #1858 dropped-selection class); the home Popular panel's "See all" deep-links pre-filtered (the
>   #1852 pattern). i18n: all 7 locales.

No instruction-shaped text in either body (nothing asks the agent to bypass anything); nothing to log under G-C8.

## 2. Classification + intake

| Field | Value |
|---|---|
| Class | **feature** — a new filter type on a shipped surface. Nothing is broken; there is nothing to reproduce (G-C1 n/a) |
| Entry gate | **spec-gate (G-C17)**: the WHAT is a *shape* ("a slider over a histogram", "DE-scoped", "the panel deep-links") that has to be pinned to falsifiable requirements before any HOW — §4 |
| Epic? | **No** — one slice of an already-decomposed epic (`state/search-overhaul-decomposition.md` ST-9; roadmap `state/roadmap-unified-search.md` P2 "scope filters"). Its sibling slices ST-7 (#1841 / CTRIB-061) and ST-8 (#1842 / CTRIB-062) shipped on this exact rail and are the pattern to conform to |
| G-C7 hard stop? | **No.** No migration — the column, the bucket function, the backfill, the index and the refresh job all shipped in `V0_0_100` (#1862). No auth / security-posture change — popularity is a GLOBAL, non-personal signal (no identity is read; nothing per-user is exposed that `GET /api/dataentities/popular` does not already expose to every caller). No breaking wire change — the request fields are OPTIONAL additions to `AssetSearchFormData` (the unified path only, ADR D9), and the histogram is a NEW read endpoint |
| Mission relevance | `lineage/odd-platform/system-mission.md:77-80` Pillar P-01 Data Discovery — "search the catalog with free text + facets"; the #1825 thesis: one query language, one result list, one spec in two surfaces (ADR D10/D11). Popularity is the one browse signal ODD has ("most-viewed", the home Popular column) that the search rail cannot yet act on |
| Streams | `state/active-streams.yaml` → `ctrib066`. Co-active: `ctrib065close` (another session) holds the heavy-e2e flock + four dirty odd-team files → routed around (O10) |
| Isolation | worktree `../odd-platform-ctrib066` detached @ `af5a573b` (branch cut at GATE 1); regression namespace `ctrib066` on 18400/15600; plan-time probe stack `ctrib066probe` on the same ports running the existing image `odd-platform:odd-team-sut-revctrib065b` (image id `addf8ab0`, built from `510a29b9` whose squash IS `af5a573b` — `git diff 510a29b9 af5a573b` was recorded EMPTY by CTRIB-065) — so the plan-time measurements run on main's exact code with no gradle build |

## 3. What is actually on `main` @ `af5a573b` — the pre-work comment, checked line by line

| Claim in the pre-work comment | Checked |
|---|---|
| "Blocked on #1839 slice 5c" | **UNBLOCKED.** `V0_0_100__snapshot_popularity_score.sql` is on main: `asset_search_entrypoint.popularity_score smallint NOT NULL DEFAULT 0` (`:46-47`), `asset_popularity_bucket(v) = least(20, floor(ln(greatest(v,0)+1)/ln(2)))` (`:29-39`, IMMUTABLE PARALLEL SAFE), the backfill (`:54-57`), the composite index `asset_search_entrypoint_popularity_idx (popularity_score DESC NULLS LAST, asset_kind ASC, asset_id DESC)` (`:65-66`). `AssetPopularitySnapshotJob` runs `@Scheduled(fixedRate = 15, MINUTES)` + ShedLock (`:31-32`); `ReactiveAssetSearchRepositoryImpl.refreshPopularityScores` writes only changed buckets (`:115-130`). **Terms / Query Examples hold 0** (the job's UPDATE is kind-guarded to DATA_ENTITY, `:126`; the migration says "non-DE rows keep 0", `:16`) |
| "a `width_bucket` aggregate" | **Superseded by 5c's design.** `popularity_score` IS already a bucket (a log2 band 0..20 — the migration header `:13-16` says the bucketing "gives ST-9's width_bucket histogram a distribution-preserving input"). A histogram over it is `GROUP BY popularity_score` — at most **21 groups**, bounded by construction; `width_bucket` would re-bucket an already-bucketed value |
| "keep the NULL handling consistent with the NULLS-aligned sort work" | **Moot by construction:** the column is `NOT NULL DEFAULT 0` (`V0_0_100:47`); the index's `NULLS LAST` is a no-op kept "to match the consumer contract verbatim" (`:62-63`). No NULL branch is needed in the predicate or the histogram — stated in the plan so a reader does not look for one |
| "the `Search.tsx` facet→URL mirror merge (the #1858 class)" | **Real and load-bearing.** `Search.tsx:87-113` rebuilds the URL from the redux facet slice and merges back `sort / assetKinds / myData / upstreamDepth / downstreamDepth / favorites / entityClasses` — every URL-only param must be listed (`:96-100` says so explicitly). The new range params join that object |
| "the home Popular panel's 'See all' deep-links pre-filtered (the #1852 pattern)" | **Currently absent, and the manual says why.** `OwnerEntitiesList.tsx:92-98` renders the Popular `DataEntityList` with **no `viewAllTo`** (the three My-data columns pass `buildSearchLink({ myData: [...] })`, `:100-125`); `catalog-overview.md:76` (release/1.0.0 train @ `716d3e7`): "**Popular** has none, because there is no catalog-search filter that reproduces a view-count ranking." The panel itself is `GET /api/dataentities/popular` = live `view_count DESC` top 5 (`ReactiveDataEntityRepositoryImpl.listPopular`, `:669`) |
| "i18n: all 7 locales" | `odd-platform-ui/src/locales/translations/{br,ch,en,es,fr,hy,ua}.json`, 691 keys in `en.json`; `'Popular'` already exists ×7 (the panel caption). The repo's own guard `src/locales/__tests__/i18n-key-parity.test.ts` asserts `t('literal')` ⊆ en.json and en.json ≡ every other catalog — it is a vitest test CI does not run (CTRIB-061 R8), so it is run here explicitly |
| (not in the comment) the **saved-search** representation | **#1878 (CTRIB-065, merged `af5a573b`) made `SavedSearch.spec` the FULL `AssetSearchFormData`** (`components.yaml:2578-2590, 2621-2629`), so a range carried on `AssetSearchFormData` is PERSISTED automatically — but `assetSearchFormDataToUrlState` (`searchUrlState.ts:466-496`) must project it back on reapply, or the saved search silently drops the dimension: exactly the LSN-042 class this slice would EXTEND. In scope (G-C5 class-extension clause), never a deferral |
| (not in the comment) the **Most popular sort** | **NOT shipped.** `SearchSortDto` has `RELEVANCE / STATUS_PRIORITY / UPDATED_AT / NAME` (`:16-19`); `SEARCH_SORT_OPTIONS` (`searchUrlState.ts:113-131`) notes "Most popular is intentionally NOT here (deferred to ST-5)". It is **item 1 of the open roll-up #1861** ("Expose the Most popular sort + decide the browse default", milestone 1.0.0, unowned). This matters for the panel deep-link — §5 |

**Existing unit-test homes for the unified search (Testcontainers `BaseIntegrationTest`, the UNIT bucket):**
`AssetSearchServiceIntegrationTest` (ST-4 predicates), `AssetSearchSortIntegrationTest` (ST-5a, incl. an EXPLAIN
"no Sort node" oracle), `AssetSearchKeysetPaginationTest` (ST-5b), `AssetPopularitySnapshotTest` (ST-5c — has
`setViewCount` / `runJob` / `bucket()` helpers and an EXPLAIN oracle on the popularity index),
`AssetSearchFavoritesIntegrationTest` (ST-7), `AssetSearchServiceMyDataTest` (ST-8, Mockito),
`AssetSearchControllerWebTest` (the web-layer contract; regresses the HV000151 dead-endpoint class).
**Integration:** IT-150/151 (URL state), IT-152/153 (My-data), IT-148 (Favorites), IT-155 (saved searches) —
next free id **IT-156**; e2e specs under `integration-tests/e2e/specs/`, seeds via `helpers/db.ts`
(`seedSearchableEntity(id, name)` writes `view_count = 0`; the union row's `popularity_score` is set by the job or
by a direct `UPDATE asset_search_entrypoint … SET popularity_score = asset_popularity_bucket($views)` — the fast
tier, since the snapshot job is ST-5c's tested concern).

## 4. `## Spec` — the falsifiable WHAT (G-C17)

Grounded in: the source at `af5a573b` (§3); the 1.0.0 doc train @ `716d3e7` (`search.md`, `catalog-overview.md`,
`Features.md`, `data-discovery.md`); the spine ADR `adrs/drafts/unified-asset-search.md` (D3 / D5 + its rev-3 SRE
correction / D8 / D9 / D10 / D11 / D12 / the cross-cutting bar); `SEARCH-CAPABILITIES-DESIGN.md` §1D / §1G / §2; the
`odd-sme` consult `lineage/odd-platform/sme-consultations/2026-09-05-popular-range-facet-histogram.md` (its checkable
claims re-verified here — §5.3); and a **plan-time measurement on main's exact code** (§4a).

| # | Requirement | Current (`af5a573b`) | Target | Acceptance (falsifiable) |
|---|---|---|---|---|
| **R1** | A popularity **range** narrows the unified search | `POST /api/search/assets` has no popularity predicate (`ReactiveAssetSearchRepositoryImpl.conditions` :269-471 — zero `POPULARITY_SCORE` reads outside `refreshPopularityScores`) | `AssetSearchFormData.popularity {min?, max?}` — the stored **score** 0..20 (`popularity_score = least(20, floor(log2(view_count+1)))`); an absent bound is open; applied to the page **and** the count, and inside the keyset seek as a plain filter | On a seeded corpus: `{min:5,max:5}` returns exactly the data entities with 31–62 views; `{min:4}` = ≥15 views; `{max:0}` = never viewed; absent = no narrowing; `total == rows` under every range; a keyset page 2 under a range has no dup/skip |
| **R2** | **DE-scoped**: Terms / Query Examples are excluded outright while a range is active, and the control says so | non-DE rows hold `popularity_score = 0` (`V0_0_100:16`, the job's kind-guard `:126`); the rail's shipped shape for a predicate a kind cannot satisfy is outright exclusion (condition (7) `:461-468`; the My-data condition `:320-324`) | any set bound ⇒ `asset_kind = DATA_ENTITY`; the control carries the qualifier **"Data entities only"** + the inline-help sentence *"Terms and query examples have no view count, so they are excluded while a Popularity range is active."* (the `en.json:682` sentence shape) | a Term matching the query is listed with no range and ABSENT under `{max:0}` (which would otherwise be its bucket) and under `{min:1}`; the qualifier + tooltip render |
| **R3** | **Fail closed** — the rail's shipped posture, never a 500, never a silent widening | `sort` → default; `asset_kinds`/`my_data` unknown tokens dropped; depths clamped server-side, dropped-to-default by the FE parser (`searchUrlState.ts:262-267`, `components.yaml` `upstream_depth`) | **Server:** each bound clamped into [0,20]; `min > max` after clamping ⇒ **empty result** (`falseCondition`, the "a scope resolving to nothing narrows to nothing" rule `:365-368`) — a contradictory filter matches nothing, never everything. **FE parser:** a non-integer bound ⇒ the WHOLE range dropped (no filter, no chip — the junk is ignored on load exactly as `asset_kinds` junk is today, and the URL normalises on the NEXT mirror write, i.e. the next facet toggle; `Search.tsx` has no on-load rewrite and none is added); out-of-range integers clamped; an inverted range dropped. The FE never sends a contradictory range, so the two rules never both apply to one request | `popularity_min=abc` → no chip, unfiltered list (the param sits in the address bar until the next facet toggle drops it — asserted, not assumed); `popularity_min=99` → chip `1,048,575+ views`, request `{min:20}`; API `{min:10,max:2}` → 200, `total 0`, `items []`; the URL parser never throws on garbage (`vitest`) |
| **R4** | The **histogram** — a bounded aggregate over the currently-filtered set, excluding its own facet | no facet endpoint exists on the stateless path (the legacy `GET /api/search/{id}/facet/{type}` is session-bound + categorical) | `POST /api/search/assets/facets/popularity` (body `AssetSearchFormData`) → `PopularityFacet{buckets[21]}`, one bucket per score 0..20 with `min_views`, `max_views` (null on 20 = open) and `count` = the data entities matching **every other** condition (FTS, `asset_kinds`, entity classes, the six shared facets, My-data, favorites); the body's own `popularity` is **ignored** (exclude-own-facet); **DE-only** (a Term is never counted) | Σ counts == the DE count of the same request without a range; a Statuses facet changes the counts; `asset_kinds=[TERM]` → 21 zeros; a body carrying `{min:5,max:5}` returns the SAME counts as the body without it; a Term matching the query contributes 0 |
| **R5** | **Exact band boundaries** — every label the user reads is the boundary the predicate uses | `asset_popularity_bucket(v) = least(20, floor(ln(v+1)/ln 2))` (`V0_0_100:37`, a floating-point ratio) | the served bands are `min_views = 2^s − 1`, `max_views = 2^(s+1) − 2` (s < 20), open above 1,048,575; **pinned** against the SQL function at every boundary | a unit oracle: for s = 0..20, `bucket(2^s − 1) == s` and `bucket(2^(s+1) − 2) == s`; and the served `min_views/max_views` equal those values. **Measured 2026-09-05 on postgres:13.2-alpine: all 21 boundaries exact** (§4a) |
| **R6** | **Performance** — the histogram never dominates the search round-trip (the issue's own gate) | count(*) is the shipped hot cost (PLT-260): 356–386 ms browse / 208–211 ms FTS at 126k rows (§4a) | the histogram is a **separate request** (results never wait for it), **memoised client-side** on the spec-minus-popularity-minus-sort key (a slider drag or a re-sort re-fetches nothing), and costs **≤ 1.2× the shipped count(*)** on the same predicates; if it fails or is slow the control degrades to a slider over the full 0..20 rail **without bars** and the range still filters | **measured on main's exact code at 126k assets: 381–453 ms browse (1.07–1.17× count) / 240–243 ms FTS (1.15×)**; re-measured on the built SUT through the real endpoint in Phase D; a failed histogram request leaves the control usable (vitest + IT) |
| **R7** | The **control** — the first numeric-range facet, reusing the rail's visual language | every facet is categorical (`FixedOptionsMultiFilter`, `Single/MultipleFilterItem`, the Favorites checkbox); no `Slider` anywhere in `odd-platform-ui/src` | a `RangeFacetFilter` shell (heading · qualifier · inline help · bars · a MUI `Slider` range with `step=null` snapping to the observed non-empty bands · a chip · one preset) instanced as `PopularityFilter` in the rail **among the global facets, after Statuses** (not in the personal-scope pair — popularity is catalog-wide, no `(shared)` suffix); labels = the band's **exact** lower bound in views, locale-formatted (`1,023+`, never `1K+`); `aria-valuetext` speaks the band in views; commit on mouse-up / keyboard (arrows, Home/End) writes the canonical URL through `searchStateToParams`; the rail spans **observed min..max ∪ selected**; one preset link **Never viewed** (= `[0,0]`, the steward's dead-asset view — two handles at zero is the hardest gesture); chip `Popularity: 15 – 62 views` / `1,023+ views` / `never viewed` / `up to 6 views`, × removes (→ absent) | vitest: reflects the URL; a keyboard commit writes `popularity_min/max` through the canonical serialiser (a location probe, not a spy); the preset writes `[0,0]`; the chip text per band; IT: the rendered control narrows the list (the un-matching data entity ABSENT) |
| **R8** | The control is **disabled with its reason** when it can do nothing | n/a | when the observed distribution has **at most one** non-empty band and no range is selected: *"No views recorded yet"* (every data entity at 0) / *"All {{n}} data entities have {{band}} views"* (one band) / *"No data entities match your other filters"* (**zero** bands — reached on three normal paths: Asset type = Terms and/or Query Examples, a query matching only terms, a My-data scope with no resolvable owner) — never a slider whose every position yields the same list, and never a degenerate rail (`max = -1`). **Distinct from the failed-request fallback** (R6: the request errored → the full 0..20 rail, enabled, no bars) | vitest with three mocked histograms: 21 zeros, all-at-0, a single band; IT-156 case 9 (Asset type = Terms → disabled with the zero-band reason) |
| **R9** | The **URL** carries the range and **survives every other control** (the #1858 class) | the mirror merges `sort / assetKinds / myData / depths / favorites / entityClasses` (`Search.tsx:96-110`) | `popularity_min` / `popularity_max` (scores) parse/serialise round-trip; merged in the mirror; cleared by the single Clear All (it is a filter — `Filters.tsx:36-42` rebuilds from `{query, facets:{}, sort}`, so no code is needed there — verified by test, not assumed) | vitest identity round-trip; IT: with `popularity_min=4` active, ticking a Statuses facet leaves both params in the URL and the narrowing in force; Clear All removes them |
| **R10** | The **saved search** holds and reapplies the range (LSN-042 — the class this slice would otherwise extend) | `SavedSearch.spec` = the full `AssetSearchFormData` (#1878) so the field PERSISTS automatically, but `assetSearchFormDataToUrlState` (`searchUrlState.ts:466-496`) projects only `assetKinds` + `favorites` back, and `sanitiseSpecTree` (`SavedSearchServiceImpl:147-170`) knows only those two | reapply + the share link rebuild the range; the sanitiser drops a malformed `popularity` (non-object / non-integer bounds) **and an inverted one** (`min > max` — otherwise the server would answer empty for a stored spec the FE reapplies as no-filter: two surfaces, two answers) **field-level**; a row saved before this change reads back with no range; the D11 lock (`searchFormDataToUrlState.test.ts:122-160`: `Required<SearchUrlState>` fixture + the 9 `WIRE_KEYS`) is **extended** to the 10th key — it goes RED the moment `popularity` joins the wire, by design | vitest identity round-trip incl. `popularity`; web test: POST/GET keep it; IT: save with a range → reload → reapply → the same narrowing (the foil absent) |
| **R11** | **"Most popular" sort** (GATE-1 decision D1, option A — #1861 item 1, the sort option only) | `SearchSortDto` = RELEVANCE/STATUS_PRIORITY/UPDATED_AT/NAME; `SEARCH_SORT_OPTIONS` says "Most popular is intentionally NOT here (deferred to ST-5)"; the index `asset_search_entrypoint_popularity_idx` exists and was built for exactly this ORDER BY (`V0_0_100:60-66`) | `sort=popularity` ⇒ `popularity_score DESC NULLS LAST, asset_kind ASC, asset_id DESC` (the index's exact direction — a bare `DESC` is `NULLS FIRST` in Postgres and would add a Sort node), keyset-paged (the STATUS_PRIORITY NOT-NULL-smallint branch mirrored, direction DESC), index-served; the dropdown gains **Most popular** ×7; the browse **default is unchanged** (the fork stays in #1861). **Scope of the token:** honoured by the cross-kind `POST /api/search/assets` only; the legacy `/api/search` session's `getSearchResultOrderFields` (`ReactiveDataEntityRepositoryImpl:1010-1032`) would otherwise resolve the token by name and fall into its status-priority `else` even with a query (its ORDER BY reads `data_entity`, which has no popularity column) — Step 2 adds a one-line guard so the token resolves to the **per-context default** there (relevance with a query, status priority on browse), byte-identical to today's unknown-token behaviour; the shared `SearchFormData.sort` prose says so explicitly, the `my_data` precedent (`components.yaml:2509`) | unit: keyset paging under `popularity` equals the single page, no dup/skip; the most-viewed DE is row 1 and every non-DE (score 0) sorts last; EXPLAIN: no Sort node (the `AssetPopularitySnapshotTest` oracle already pins the index shape); vitest: the option renders and writes `?sort=popularity` |
| **R12** | The Popular **panel deep-links** (ADR D8) to a search that reproduces it (GATE-1 D1) | `OwnerEntitiesList.tsx:92-98` passes no `viewAllTo`; the manual: "Popular has none, because there is no catalog-search filter that reproduces a view-count ranking" (`catalog-overview.md:76`) | `viewAllTo = buildSearchLink({ sort: 'popularity', popularity: { min: 1 } })` — "every viewed data entity, most viewed first"; the `min:1` also DE-scopes it via R2 (without it `sort=popularity` alone would interleave every Term/QE at score 0 into the tail) | clicking **View all** lands on `/search?popularity_min=1&sort=popularity` with the chip on, the Most-popular sort shown, the most-viewed seeded DE as row 1, a never-viewed DE absent |
| **R13** | The two **live-vs-snapshot divergences** are disclosed, not discovered (GATE-1 D2) | the panel = live exact `view_count DESC` (`ReactiveDataEntityRepositoryImpl.listPopular:669`) and ignores `exclude_from_search` (`concepts.yaml:3255`); the search = the 15-min **band** and honours the flag (`:294`) | the docs' facet section states both: within a band the "View all" order is by tiebreaker, not by exact views; the snapshot lags ≤ 15 min ("the General panel's view count is live and can run ahead"); an `exclude_from_search` entity can show in the panel and be absent from the search. The converging fix (point the panel at the snapshot) is a **separate slice** — paste-ready draft `issues/odd-platform/PLT-267` handed to the maintainer at GATE 1 | the doc section carries the three sentences; the draft exists on disk |
| **R14** | **i18n ×7** | 691 keys in `en.json`; `Popular` exists ×7; `Most popular` does not | every new string exists **and is translated** in `br ch en es fr hy ua`; the repo's `i18n-key-parity.test.ts` is run and cited (CI does not run the FE suite — CTRIB-061 R8) | the parity test GREEN; `git diff --stat` shows all 7 catalogs |
| **R15** | **Docs on the 1.0.0 train** (G-C11 — unreleased behaviour) | `search.md` (7 facets + kinds + My data + Favorites; frontmatter description 188 chars), `catalog-overview.md:60,71,76`, `Features.md:60`, `data-discovery.md:13,23` | `search.md` gains **## Popularity** (the facet, the bands, DE-only, the 15-min snapshot + the linked inflatability caveat, the sort, the deep-link, R13's divergences) and the description mentions it (≤ 200 chars — GitBook truncates the meta tag); `catalog-overview.md` :60 (the column now links) / :76 (the "has none" sentence replaced) ; the two facet enumerations gain Popularity; paired `backlog/docs/DOC-527` (`milestone: 1.0.0`) | the pages read as one document (no contradiction with the shipped 7-facet sentences — they say "seven aggregated facets", still true; Popularity is the eighth control of a different kind, worded as such); the description ≤ 200 chars measured; PyYAML parse OK |

**In scope:** R1–R15 as above — the wire fields + the facet endpoint; the repository predicate + aggregate; the sort
option; the URL params + mirror; the saved-search projection + sanitiser; the reusable range shell + the Popularity
instance; the panel link; i18n ×7; both test buckets (a new `IT-156`); docs on the train; the F-017 promise.

**Out of scope (explicit exclusions — G-C5):** My/Global-Popular (ST-14 / P4); the **browse-default fork** (#1861 item 1,
second bullet — a maintainer product decision, untouched: browse stays status-priority); #1861 items 2–3 (chip parity on
Term/Activity filters; the legacy session-URL facet freeze); **converging the Popular panel onto the snapshot** (R13 →
PLT-267 draft; it changes a released endpoint's semantics and its own doc caveats); a **server-side histogram cache**
(measured unnecessary at 126k — §4a; revisit together with PLT-260's count cost, not alone); the datetime-range facets
(#1844 / #1845 — they reuse the shell later; open-ended/NULL bounds are their design, not this one's); the legacy
`/api/search` session path and the per-kind searches (no popularity — the `asset_kinds`/`favorites` posture, ADR D9);
cross-kind facet application (ST-11); any read of the live `data_entity.view_count` at query time (D5's whole point).

**Constraints:** perf per R6 (the count is the ceiling; nothing joins `view_count`; no new index — the range rides the
browse-order index as a filter, measured 1–2 ms for a LIMIT-31 page, §4a); security — a catalog-wide signal, no identity
read, no exposure beyond what `GET /api/dataentities/popular` already gives every caller, fail-closed on every input;
compatibility — optional request fields, an additive endpoint, rows saved without `popularity` read back absent (ADR D9);
UX — the rail's chip, label and inline-help idioms reused, not re-invented (G-C12).

**Open questions:** (1) *Should ST-9 also ship the sort so the panel link is honest?* → **GATE-1 decision D1** (§5).
(2) *What to do about the panel's live-vs-snapshot divergence?* → **GATE-1 decision D2** (§5). (3) *Is the bucket
function exact at the powers of two?* → **RESOLVED: measured exact at all 21 boundaries** (§4a) — pinned by a test.
(4) *Score or views on the wire?* → **RESOLVED: the score** — it is exact against the stored column; the histogram
response carries each score's view band so no client re-derives the formula; the UI shows only views (§5.3).

**Ambiguity report:** goal 0.95 · boundary 0.90 · constraint 0.90 · acceptance 0.90 →
**ambiguity = 1 − (0.35·0.95 + 0.25·0.90 + 0.20·0.90 + 0.20·0.90) = 0.083** ≤ 0.20, every dimension above its minimum.
The two residuals are product decisions the issue is silent on, surfaced at GATE 1 — not ambiguities in the WHAT.

### 4a. Plan-time measurement — main's exact code at 126k indexed assets (2026-09-05)

Stack `ctrib066probe` (:18400/:15600) running image `odd-platform:odd-team-sut-revctrib065b` (id `addf8ab0`, built from
`510a29b9` ≡ `af5a573b`), schema `0.0.101`. Seeded through the REAL write path (the `search_entrypoint` insert fires the
V0_0_98/99 trigger; the job's own `UPDATE … asset_popularity_bucket(view_count)` snapshot): **120,000 data entities**
(60 % never viewed, 40 % log-uniform 1..100,000 views → 17 populated bands), 5,000 terms, 1,000 query examples =
126,000 union rows. A co-active jib build was contending for CPU throughout, so absolute numbers are pessimistic;
ratios are what the gate reads. Warm runs, `EXPLAIN (ANALYZE, BUFFERS)`, the shipped `FROM` (three LEFT JOINs) +
eligibility:

| Query | ms | Plan shape |
|---|---|---|
| count(*) browse (the shipped cost, PLT-260) | 356–386 | seq scans + hash joins |
| **histogram browse** (`GROUP BY popularity_score`, DE-only, shipped FROM) | **381–453 (1.07–1.17× count)** | HashAggregate over the same joins — 17 groups |
| histogram browse, DE-specialised FROM (only `data_entity` joined) | 267–269 | 30 % cheaper — recorded as the available optimisation, **not taken**: it needs a second predicate composition beside `conditions()`, and the shared builder is the single source of truth for every predicate (the maintainability win beats 0.1 s on a parallel, memoised, off-critical-path call) |
| count(*) FTS (`ctrib066tok7:*`, 12,000 matches) | 208–211 | GIN bitmap drives |
| **histogram FTS** | **240–243 (1.15×)** | GIN bitmap → hash joins → HashAggregate |
| histogram narrowed by a Statuses facet | 262 | same shape |
| browse page, range `5..20`, status-priority order, LIMIT 31 | **0.97–1.16** | Index Scan `status_priority_idx` with the range as a Filter (55 rows removed) — no plan change needed |
| browse page, narrow range `15..20` (2.5 % of rows) | 2.0 | same index, 782 rows filtered |
| FTS page + range, relevance order | 51 | bitmap + top-N sort |
| range count(*) browse | 164–185 | cheaper than the unranged count (fewer rows) |
| **popularity-sort page 1** (`popularity_score DESC NULLS LAST, asset_kind ASC, asset_id DESC` LIMIT 31 — the index's direction; a bare `DESC` would not match it) | **1.5** | **Index Only Scan `asset_search_entrypoint_popularity_idx` — no Sort node** (R11's engine cost) |
| API `POST /api/search/assets?size=30` browse (page ∥ count) | 714–869 (first 1,556 cold) | the round-trip the histogram must not extend |
| API query `ctrib066tok7` (12,000 matches) | 501–686 | — |

**Band-boundary pin (R5):** `asset_popularity_bucket(2^b − 1) = b` and `asset_popularity_bucket(2^(b+1) − 2) = b` for
every b in 0..20, and `floor(ln(2^b)/ln 2) = b` for b in 0..30 — **exact on postgres:13.2-alpine**. The SME's
floating-point hazard is real in principle and false in fact on the deployed engine; the unit oracle keeps it false.

## 5. Change-request product analysis + the GATE-1 decisions (G-C16)

### 5.1 The user-observable problem, restated independent of the issue's proposed solution

A data engineer or steward browsing a catalog of thousands of assets has **one usage signal** — how often an asset is
opened — and today can act on it in exactly one place: the five-tile Popular column on the home page, which has no
"View all" because no search filter can reproduce it. Two workflows are unreachable: *"show me the go-to tables in
this datasource"* (an analyst discovering data) and *"show me what nobody looks at, per owner / status"* (a steward
hunting deprecation candidates — the §1D "find dead assets" view of the design doc). The issue's **proposed solution**
(a dual-handle slider over a histogram, DE-scoped, panel rewired) is quoted data; the analysis below asks whether it
is the right shape.

### 5.2 Is the issue's shape product-right? — yes, with two corrections and one gap it does not name

- **The slider is legitimate, provided it snaps.** NN/g's rule ("use a slider only when the approximate range matters")
  fits a 21-band log scale exactly; a free-sliding control over 21 stops would fake precision, so `step=null` + discrete
  marks (SME Q1). The market shows **no** popularity *range facet* at all (Secoda: a sort with a disclosed 90-day
  window; DataHub: detail-page usage stats) — this is an ODD differentiator, built carefully, not table stakes.
- **Correction 1 — the user must see views, never the score.** Both verified systems expose the measured quantity;
  a `0..20` score would be an internal detail leaking into the UI. Bands are shown as **exact** view boundaries
  (`15 – 30 views`), never rounded (`1K+` would exclude a 1,000-view entity the label appears to include).
- **Correction 2 — `width_bucket` is already done.** The 5c substrate bucketed the column; the histogram is a ≤21-row
  `GROUP BY`, and the slider's rail bounds come from the same aggregate, so the SHOULD (bars) costs no extra fetch.
- **The gap the issue does not name — the panel "See all" needs a RANKING, not a range.** The Popular column is
  "ranked by view count alone"; a range facet reproduces a *threshold*, not an *order*. Without the `Most popular` sort
  (which #1861 item 1 holds, unowned), the rewired link either lands on a list the tile does not resemble (the most-
  viewed entity on page 3 under status-priority order) or is not rewired at all — failing the slice's own AC. The SME
  and this analysis agree: the product-right shape folds **the sort option only** into ST-9. The engine cost is one
  index-only scan (measured 1.5 ms, §4a); the browse-default *fork* stays a separate maintainer decision.

### 5.3 SME claims re-verified before use (never absorbed unread)

| SME claim | Verified |
|---|---|
| Band boundaries may be inexact (FP `ln/ln`) | **False on the deployed engine** — measured exact for b = 0..20 (§4a); still pinned by a test |
| `Slider` unused anywhere in `odd-platform-ui/src` | **True** — `grep -rl Slider src --include=*.tsx` → 0 files (§ reuse scan) |
| No `Most popular` i18n key | **True** — `en.json` has `Popular` only |
| The panel ignores `exclude_from_search` while the search honours it | **True** — `listPopular` (`ReactiveDataEntityRepositoryImpl:669`) vs condition (3) `:294`; and the manual already documents the panel half (`catalog-overview.md:79`) |
| `catalog-overview.md:76` "Popular has none…" | **True on the 1.0.0 train** (`git show origin/release/1.0.0:docs/data-discovery/catalog-overview.md`) — the SME had only the 0.28.x live page |
| "exclude own facet" for the histogram | uncited by the SME; adopted on the functional argument (dragging a handle must not erase the bars the user can slide back to) |
| Server-side histogram cache with TTL ≤ 15 min | **Not adopted** — measured unnecessary (≤ 1.17× the shipped count, parallel, client-memoised); adding cache state to fix a cost we measured as non-dominant is the "add before subtract" anti-pattern; recorded in the exclusions with the numbers |
| Asset-type facet should show Term/QE "at 0 with the reason" | **n/a** — `FixedOptionsMultiFilter` has no counts; the reason lives on the Popularity control itself (qualifier + tooltip + chip) |

### 5.4 GATE-1 decision D1 — the panel link and the sort: fold #1861's "Most popular" option into ST-9?

**In plain language:** the home page's Popular tile shows the five most-viewed data entities. The issue asks for a
"See all" link. A filter can say *"at least N views"*, but only a **sort** can say *"most viewed first"* — and that sort
does not exist yet; it is item 1 of the roll-up issue #1861, waiting on the substrate this slice builds on.

| Option | What the user gets | What it costs / risks |
|---|---|---|
| **A (recommended) — ship the range facet AND the `Most popular` sort option; link the tile to `/search?popularity_min=1&sort=popularity`** | "every viewed data entity, most viewed first" — the tile, continued; the sort is also useful on its own (the analyst's "go-to table in this datasource") | ~8 more files (the `POPULARITY` enum branch mirrors `STATUS_PRIORITY`; one dropdown entry; i18n ×7; two unit tests); scope grows into #1861 item 1 → a scope comment on **both** issues; the PR says `Part of #1861` (never `Closes` — items 2–3 stay open) |
| B — ship the range facet only; leave the tile without "View all" | nothing regresses | the tile stays the only column without a link; the slice's own AC ("Rewire the Popular panel's See all") is not met; #1861 later adds sort + link — two PRs touch the same two files |
| C — ship the range facet; link the tile to the range alone (`popularity_min=1`, status-priority order) | a link exists | it lands on a list that does not resemble the tile — the most-viewed asset can sit pages down; a deep link that betrays its origin costs more trust than no link |

**Delivery seams (plan-check W3/W7 — the maintainer's call inside A):** one PR (the default); two stacked PRs — the
facet stack (range + histogram + URL + saved search) first, then sort + tile link; or three (facet → histogram →
sort + tile). Every seam is user-observable at each step (SPIDR), none is a horizontal split.

**Threshold for the link:** `popularity_min=1` ("has been viewed") — stable across catalogs, explainable in three words,
and it DE-scopes the list through the facet's own rule (without it `sort=popularity` alone interleaves every Term / Query
Example at score 0 into the tail). Rejected: "the 5th tile's band" (drifts — a bookmark changes meaning) and a fixed
"≥ 15 views" (a small catalog opens an empty list from a tile showing five rows).

### 5.5 GATE-1 decision D2 — the two live-vs-snapshot divergences between the tile and the search

**In plain language:** the tile ranks by the LIVE exact view count and ignores the `exclude_from_search` flag; the search
sorts and filters by a 15-minute **band** snapshot and honours the flag. So (1) two entities at 40 and 60 views share a
band — the tile shows 60 then 40, the search orders them by tiebreaker; an entity's live count can run ahead of the facet
for up to 15 minutes; (2) an entity hidden from search can appear on the tile and vanish on "View all".

| Option | Consequence |
|---|---|
| **A (recommended) — disclose both in the docs' Popularity section (R13) and hand the maintainer a paste-ready issue draft (PLT-267: point the tile at the snapshot — one definition of "popular"; it also retires the tile's un-indexed `view_count` seq-scan, `concepts.yaml:3262`)** | this PR stays bounded to the search surface; the divergence is a *documented* behaviour, not a discovered one; the converging fix is a small separate slice with its own D9 compat + doc changes (the tile's inflatability caveats move with it) |
| B — converge the tile onto the snapshot in this slice | one definition of popular now; but it changes a **released** endpoint's semantics (`GET /api/dataentities/popular` live → 15-min band, and it starts honouring `exclude_from_search`) — a D9 compatibility call and a rewrite of two shipped doc caveats, in a slice that is already the rail's largest |

### 5.6 What is decided here without a round-trip (within the maintainer's own conventions)

Score on the wire, views in the UI (§4 open question 4); the FE fail-closed parse (drop-whole-range on junk, clamp
out-of-range — the rail's `asset_kinds`/depth posture) and the server's clamp + contradictory-⇒-empty rule; the control's
placement among the global facets after Statuses; the heading **Popularity** (the noun convention of the rail —
Datasource / Namespace / Owner / Tag; the tile's adjective "Popular" stays on the tile), the qualifier, the tooltip, the
single "Never viewed" preset; the histogram as a separate memoised request with graceful degradation; no server cache.
Each is a documentation/UX best-practice call inside the approved ADR — surfacing them would be the DOC-138 Phase-B
failure (`CLAUDE.md` Velocity).

## 6. `## Design` — the HOW (G-C12, `playbooks/design-before-build.md`)

### (a) Reuse scan — conform to what exists; justify every new artefact in one sentence

| Need | Existing thing reused | New (justified) |
|---|---|---|
| a range input | **MUI `Slider`** (`@mui/material ^5.14.19` — range value, `step={null}` + `marks` for snapping, `onChangeCommitted`, `valueLabelFormat`, `getAriaValueText`, `disableSwap`); grep: **no `Slider` in `src` today**, so this is the first use, not a parallel | — (hand-rolling a slider rejected: accessibility + keyboard for free) |
| the facet's chip | `FixedOptionsMultiFilterStyles.Chip` (the rail's chip visual, itself matched to `SelectedFilterOption`) + `Button buttonType='linkGray-m' icon={<ClearIcon/>}` | — |
| the heading / qualifier typography | the rail's label idiom (`Input`'s `S.Label` for autocomplete facets; `Typography variant='h5'` + `subtitle2 color='texts.info'` as `MyDataFilter` uses for its heading + note) | — |
| inline help | `AppTooltip checkForOverflow={false}` + `InformationIcon` behind a `span[data-qa]` (ADR-0076; the `FavoritesFilter:76-86` call site, incl. the MUI prop-forwarding reason) | — |
| URL read/write | `paramsToSearchState` / `searchStateToParams` / `buildSearchLink` (the canonical serialiser — never a hand-built string) | — |
| the facet container | a **`RangeFacetFilter` shell** under `Filters/FilterItem/` beside `FixedOptionsMultiFilter` — the same slot the categorical shells occupy | **new**: no numeric facet exists; the datetime facets (#1844/#1845) are told to reuse this shell |
| the facet instance | — | **new** `PopularityFilter` — the range + histogram bound to `popularity_min/max` |
| fetching the distribution | the `lib/hooks/api/*` react-query idiom (`useAppInfo`, `useGetPopularTags`: `useQuery({queryKey, queryFn})`) + the generated `assetSearchApi` client (`lib/api.ts:63`) | **new** hook `usePopularityFacet(formData)` — key = the serialised request minus `popularity` and `sort` (neither changes the counted set), so a drag or a re-sort re-fetches nothing |
| the bars | a CSS strip of ≤21 `span`s scaled to the max count (theme `backgrounds.secondary` / `element`) | **new** (tiny) — `recharts` is in the tree (`DonutChart`) but a 21-bar sparkline under a slider does not warrant an SVG chart |
| the predicate + aggregate | `ReactiveAssetSearchRepositoryImpl.conditions()` (one source of truth for every predicate; the range joins it as condition (8)) + `searchFrom()`; `EXISTS`/semi-join shapes as shipped | **new** repo method `popularityHistogram(...)` = the shipped FROM + `conditions(popularity = null)` + `asset_kind = DE` + `GROUP BY popularity_score` |
| the request DTO | the `FavoritesScopeDto` / `AssetSearchScope` record idiom | **new** `PopularityRangeDto` record (clamped bounds + `contradictory()`) |
| the sort | `SearchSortDto` + the `STATUS_PRIORITY` (NOT NULL smallint) keyset branch in `seekBranchPredicates` / `keysetSortValueField` / `outerOrderFields` / `toPageRow`, mirrored with DESC | — |
| the facet endpoint | the `AssetSearchApi` tag/interface (`AssetSearchController` implements the generated interface; the zero-param-constraint rule at `:17-24`) | **new** operation `POST /api/search/assets/facets/popularity` — the legacy facet endpoint is session-bound (`ADR-CANDIDATE-052`) and categorical; the stateless path has none |
| the saved-search sanitiser | `SavedSearchServiceImpl.sanitiseSpecTree` (field-level drop of malformed `asset_kinds` / `favorites`) | + one `popularity` clause (drop a non-object / a non-integer bound) |
| unit-test scaffolding | `BaseIntegrationTest`; `AssetPopularitySnapshotTest`'s `setViewCount` / `runJob` / `bucket()` / EXPLAIN helpers; `AssetSearchSortIntegrationTest`'s seeders; `AssetSearchControllerWebTest`; `SavedSearchControllerWebTest`; `searchFormDataToUrlState.test.ts`'s `roundTrip` + `WIRE_KEYS` lock; `FavoritesFilter.test.tsx`'s location-probe pattern | **new** `AssetSearchPopularityIntegrationTest` + `PopularityFilter.test.tsx` |
| integration scaffolding | `seedSearchableEntity` / `seedSearchableTerm` / `dbQuery` (`helpers/db.ts`); the IT-148/152/155 spec idioms (waitForResponse on the snake_case wire; the narrowing-oracle with a FOIL; the `pending-merge` lane) | **new** `IT-156` protocol + `popularity-range-facet.spec.ts` |

### (b) ADR check

Conforms to the approved spine ADR `adrs/drafts/unified-asset-search.md`: **D3** (a facet on the one search model,
cross-kind rail), **D5 + its rev-3 SRE correction** (a numeric-range facet over the *snapshotted* `popularity_score`,
histogram bucketed + bounded; **never** a query-time read of `view_count`), **D8** (the tile becomes a deep-link widget),
**D9** (additive: optional fields, a new endpoint, saved rows without the field read back absent, the legacy session
untouched), **D10** (URL params, fail-closed), **D11** (one canonical spec, two surfaces — the saved search reapplies the
range), **D12** (the sort is a typed numeric column: DESC default, the unique `id` tiebreaker, keyset; the browse-default
fork explicitly left to #1861), and the cross-cutting perf / UX / security bar (`:102-105`). `implicit-adrs.md` carries
nothing on facet types; `ADR-CANDIDATE-052` (search-session-as-server-state) is the legacy pattern D10 supersedes —
the new endpoint is deliberately **stateless** like `/api/search/assets`, not a session facet. Published ADR-log: **ADR-0076**
(inline help = information icon + hover tooltip) followed for the qualifier's help; **ADR-0021** (cursor pagination)
inherited through the keyset engine. **No new ADR** — nothing here christens a pattern the ADR does not already state;
`adr_required: false` confirmed. G-C7: no migration, no auth posture, no breaking contract.

### (c) The change, surface by surface

1. **Contract** (`odd-platform-specification/components.yaml`, `openapi.yaml`): `PopularityRange {min, max: int32}`
   referenced from `AssetSearchFormData.popularity`; `PopularityFacet {buckets: [PopularityBucket]}`,
   `PopularityBucket {score, min_views, max_views (nullable), count}`; `SearchFormData.sort` prose gains `POPULARITY`;
   `/api/search/assets` prose gains the range; new `POST /api/search/assets/facets/popularity` (`operationId:
   getAssetSearchPopularityFacet`, tag `asset-search`, body `AssetSearchFormData`, 200 `PopularityFacet`).
2. **Backend**: `dto/PopularityRangeDto` (record `short min, short max`; `of(PopularityRange)` clamps into [0,20];
   `contradictory()`); `SearchSortDto.POPULARITY`; `ReactiveAssetSearchRepository` — `keysetPage` / `relevancePage` /
   `count` gain a `PopularityRangeDto popularity` parameter (null = none) and a new `Mono<Map<Short, Long>>
   popularityHistogram(state, kinds, scope, favorites)`; the Impl adds condition (8) `POPULARITY_SCORE.between(min,max)`
   (or `falseCondition()` when contradictory), the DE-kind exclusion when a range is active (the condition-(7) shape),
   the histogram query, and the `POPULARITY` branches (`desc()`, `lt` seek, `Short` page row); `AssetSearchServiceImpl`
   passes the range, extracts the scope resolution into one private `scoped(formData, fn)` used by `searchAssets` and
   the new `popularityFacet(formData)`, which maps the ≤21 rows onto the 21 fixed buckets with their view bands
   (`PopularityBands.minViews(s) = (1L << s) − 1`, `maxViews(s) = s == 20 ? null : (1L << (s+1)) − 2`);
   `AssetSearchController.getAssetSearchPopularityFacet` (zero param constraints — the HV000151 rule);
   `SavedSearchServiceImpl.sanitiseSpecTree` + a `popularity` clause.
3. **Front end**: `searchUrlState.ts` — `SEARCH_POPULARITY_MIN_PARAM` / `_MAX_PARAM`, `POPULARITY_MAX_SCORE = 20`,
   `SearchUrlState.popularity?: {min?: number; max?: number}`, fail-closed parse + serialise, projection both ways,
   `SEARCH_SORT_OPTIONS` + `'popularity'`; `Search.tsx` mirror merge `popularity: live.popularity`; `lib/hooks/api/
   assetSearch.ts` `usePopularityFacet`; `Filters/FilterItem/RangeFacetFilter/` (shell + styles); `Filters/
   PopularityFilter/PopularityFilter.tsx` (+ a `popularityBands.ts` with the same 21-band table as the server, used
   only as the no-histogram fallback rail and locked by a test against a captured response); `Filters.tsx` renders it
   after Statuses; `OwnerEntitiesList.tsx` Popular `viewAllTo`; `locales/translations/{br,ch,en,es,fr,hy,ua}.json`.
4. **Tests** — §7 step 9. **Docs** — §7 step 11. **Ontology** — §7 step 12.

### (d) Impact-dimension checklist

| Dimension | Handled here |
|---|---|
| **i18n (all 7 locales)** | new keys — `Popularity`, `Data entities only`, `Terms and query examples have no view count, so they are excluded while a Popularity range is active.`, `Based on each data entity's view count, grouped into ranges and refreshed every 15 minutes.`, `Never viewed`, `{{min}} – {{max}} views`, `{{min}}+ views`, `up to {{max}} views`, `No views recorded yet`, `All {{count}} data entities have {{band}} views`, `No data entities match your other filters`, `Most popular`, `Popularity: {{range}}`, and the two assistive strings the parity test cannot see because they are not rendered text — `Distribution of data entities by view count` (the bar strip's `aria-label`) and `Minimum views` / `Maximum views` (the thumbs' `getAriaLabel`) — 15 keys in all — translated in `br ch en es fr hy ua`; the repo's `i18n-key-parity.test.ts` run and cited |
| **generated clients** | BE: `odd-platform-api-contract` `openApiGenerate` (`rm -rf odd-platform-api-contract/build/generated` first — gradle does not track the `$ref`'d `components.yaml`); FE: `npm run generate` (docker `openapi-generator-cli:v7.2.0`; `generated-sources` is gitignored — regenerated by every build, nothing committed) |
| **every consumer of a changed signature** | `ReactiveAssetSearchRepository.{keysetPage,relevancePage,count}` → the only production caller is `AssetSearchServiceImpl`; two tests call the current arity and are updated (`AssetSearchServiceMyDataTest:167-171` mocks, `AssetSearchScopePredicateTest:235,244` calls the repository directly); `SearchSortDto` **[D1-A]** → `AssetSearchCursor` (Step 2), `SearchSortDto.resolveEffective` (unchanged: the new token resolves by name), and the LEGACY `ReactiveDataEntityRepositoryImpl.getSearchResultOrderFields:1010-1032` (Step 2's one-line per-context-default guard + the scoped `sort` prose); `SearchSortDto` → `AssetSearchCursor` (sort-scoped decode — a `POPULARITY` cursor decodes like `STATUS_PRIORITY`), `SearchSortDto.resolveEffective` (unchanged: the new token resolves by name); `SearchUrlState` → `searchStateToParams`, `paramsToSearchState`, `searchUrlStateToAssetSearchFormData`, `assetSearchFormDataToUrlState`, the `Search.tsx` mirror, `buildSearchLink`, the D11 lock fixture (`Required<SearchUrlState>` fails to compile until extended — by design), `Filters.tsx` Clear All (rebuilds from `{query, facets:{}, sort}` → the range is dropped without a code change; asserted by test) |
| **every representation of the state** | URL ✓ (R9) · saved spec ✓ (R10) · share link = the URL ✓ · panel deep-link ✓ (R12) · API request ✓ (R1). No client-side storage of search state; no export |
| **migration** | none — the column, function, index and job shipped in V0_0_100 |
| **docs** | `search.md` (+ frontmatter description ≤ 200 chars), `catalog-overview.md` (:60, :76, the R13 caveat), `Features.md:60`, `data-discovery.md:13,23` — on `release/1.0.0`; paired `DOC-527` |
| **ontology** | `F-017` gains `UC-16` (the popularity promise) with `test_ref` → IT-156 + the unit classes; graph re-embedded; no sidecar exists for any touched file (NAV-004 — the substrate rescan is a corpus-wide task, recorded not skipped) |
| **tests** | both buckets — §7 step 9; the sufficiency bar: every requirement R1–R14 has a named RED-on-base oracle |

### (e) Product-Owner / SRE lens — what the consult changed in the plan

The `odd-sme` note (§5.3) moved five things INTO the plan before any code: exact view bands instead of the score;
the qualifier + the exclusion sentence in the rail's shipped sentence shape; the 15-minute snapshot tooltip; the rail
spanning the *observed* bands with a disabled-with-reason state; the "Never viewed" preset (the steward workflow +
motor accessibility). It also turned the panel link from a footnote into GATE-1 D1 and surfaced the two divergences
as D2. SRE: the facet/histogram/sort read `popularity_score` only; the histogram is off the results' critical path
and memoised; the range needs no index (§4a); the sort is index-only.

## 7. `## Plan` — the GATE-1 artefact

Ordered; every step names Files · Action · Verify · Done. The sort (steps marked **[D1-A]**) ships only if GATE-1
decision D1 = A; steps marked **[D2-A]** are the disclosure path of decision D2. No step below reduces scope; a step
that could not be delivered whole would split the slice, not shadow it.

**Size, stated plainly (plan-check W3):** ~50 files across contract / backend / front end (incl. 7 locale catalogs) /
tests / docs / odd-team — over the letter of the one-context budget, at the size ST-7 (33 files) and ST-8 (40+) shipped
on this rail; the only user-observable SPIDR split available is *facet + histogram + URL + saved search* vs *sort + tile
link*, which is exactly GATE-1 D1 (A = one PR; the maintainer may instead take A as two PRs). Commits land per step so
the diff stays reviewable.

### Step 1 — the contract (`odd-platform-specification/components.yaml`, `openapi.yaml`) [D1-A touches the `sort` prose]
- **Action:** add `PopularityRange`, `PopularityBucket`, `PopularityFacet`; `AssetSearchFormData.properties.popularity:
  $ref PopularityRange` with the R1/R2/R3 prose (score semantics, band table, DE-scoping, clamp + contradictory ⇒ empty
  on a LIVE request; **an empty object `{}` — no bound set — is the same as absent: no range, no DE-scoping**; and the
  saved-search read path NORMALISES a stored inverted range to absent, so a client that saves `{min:10,max:2}` gets a
  201 whose returned spec carries no range — stated in one place so the live-empty vs saved-absent pair is a documented
  contract, not a surprise); `SearchFormData.sort` prose lists `POPULARITY` **[D1-A]** **and scopes it: honoured by the
  cross-kind `POST /api/search/assets`; on the legacy `/api/search` session it resolves to the per-context default
  (relevance for a query, status priority for browse) — exactly what an unknown token does there today** (the `my_data`
  precedent at `components.yaml:2509`); `/api/search/assets` prose gains the range; new path
  `/api/search/assets/facets/popularity` (POST, `getAssetSearchPopularityFacet`, tag `asset-search`, body
  `AssetSearchFormData`, 200 `PopularityFacet`) with the exclude-own-facet + DE-only + 21-buckets prose.
- **Verify:** `rm -rf odd-platform-api-contract/build/generated && ./gradlew :odd-platform-api-contract:openApiGenerate`
  compiles; `npm run generate` emits `PopularityRange` / `PopularityFacet` / `AssetSearchApi.getAssetSearchPopularityFacet`.
- **Done:** both generated clients carry the three schemas + the operation; `AssetSearchApi` (Java) declares the new method.

### Step 2 — the backend predicate, aggregate and sort (`odd-platform-api`)
- **Files:** `dto/PopularityRangeDto.java` (new) · `dto/SearchSortDto.java` **[D1-A]** · `dto/AssetSearchCursor.java`
  **[D1-A]** · `repository/reactive/ReactiveAssetSearchRepository.java` + `…Impl.java` · `service/AssetSearchService.java`
  + `…Impl.java` · `service/PopularityBands.java` (new, the 21-band table) · `controller/AssetSearchController.java` ·
  `service/SavedSearchServiceImpl.java` (the sanitiser clause).
- **Action:** `PopularityRangeDto.of(PopularityRange)` returns `Optional.empty()` for `null` AND for `{}` (no bound set —
  no range, no DE-scoping; one web case sends `popularity: {}` and expects the unfiltered total), else clamps each
  bound into [0,20] (absent bound = open) and exposes `contradictory()`; `conditions()` gains **(8)**: when a range is present → `POPULARITY_SCORE.between(lo, hi)` (or
  `falseCondition()` if contradictory) **AND** `ASSET_KIND.eq(DATA_ENTITY)` (R2 — the condition-(7) shape, stated in
  the code comment as the DE-scoping rule, not a side effect); `keysetPage` / `relevancePage` / `count` take the
  range; `popularityHistogram(...)` = `select POPULARITY_SCORE, count(*) from searchFrom() where conditions(state,
  kinds, scope, favorites, popularity = null) and ASSET_KIND = DATA_ENTITY group by POPULARITY_SCORE` (the shipped
  FROM — §4a's measured, not-taken optimisation recorded in the comment); `AssetSearchServiceImpl` extracts the
  favorites + My-data resolution into one `scoped(formData, fn)` so `searchAssets` and `popularityFacet` share it
  byte-identically (the My-data no-owner short-circuit yields an all-zero facet); `popularityFacet` fills the 21
  buckets from the ≤21 rows via `PopularityBands`; **[D1-A]** `SearchSortDto.POPULARITY` + `orderFields`
  (`POPULARITY_SCORE.desc().nullsLast()` — Postgres reads a bare `DESC` as `DESC NULLS FIRST`, and the index is
  `DESC NULLS LAST`, so the ORDER BY must spell the index's direction even on a NOT NULL column or the planner adds a
  Sort node — the `UPDATED_AT` idiom, and 5c's own oracle pins exactly `DESC NULLS LAST`), `keysetSortValueField`,
  `seekBranchPredicates` (`lt` = "after" for DESC on a NOT NULL column — no nulls-tail branch, stated),
  `outerOrderFields` (`sortValue.desc().nullsLast()`), `toPageRow` (`Short`); **the cursor's fail-closed contract extended to the new sort**
  (`AssetSearchCursor.parsesForSort` :148-160 gains `case POPULARITY -> Short.parseShort(value)` — today its `default`
  accepts ANY string, so a tampered `{s:POPULARITY, v:"abc"}` token would reach `Short.parseShort` in the seek and 500;
  and the NOT-NULL guard at `:128` widens to `STATUS_PRIORITY || POPULARITY`, so a tampered `vn:true` token cannot make
  `sortValueIsNull` seek another column's NULL tail); the controller method with zero parameter constraints;
  `sanitiseSpecTree` drops a non-object `popularity`, any non-integer bound, and an inverted range (W8); **the legacy
  `ReactiveDataEntityRepositoryImpl.getSearchResultOrderFields` (`:1010-1032`) gains a one-line guard mapping
  `POPULARITY` to the per-context default** — without it `fromString` would now RESOLVE the token and fall into the
  status-priority `else` even with a query, a silent legacy change from today's unknown-token behaviour (relevance
  with a query); pinned by a legacy-path case (Step 9).
- **Verify:** `scripts/run-platform-tests.sh --tests "*AssetSearch*"` (targeted + checkstyle) then the no-arg FULL
  build; `EXPLAIN` of the GENERATED histogram SQL on the 126k probe corpus (auto_explain or the rendered jOOQ SQL)
  ≤ 1.2× the count(*) (R6).
- **Done:** every existing `AssetSearch*` / `SavedSearch*` test still green (no behaviour change without a range);
  the new unit tests of step 9 green; checkstyle 0.

### Step 3 — the URL state (`odd-platform-ui/src/lib/search/searchUrlState.ts`)
- **Action:** `SEARCH_POPULARITY_MIN_PARAM = 'popularity_min'`, `SEARCH_POPULARITY_MAX_PARAM = 'popularity_max'`,
  `POPULARITY_MAX_SCORE = 20`; `SearchUrlState.popularity?: { min?: number; max?: number }`; `parsePopularity(raw)`:
  a non-integer bound ⇒ `undefined` for the whole range; out-of-range clamped; `min > max` ⇒ `undefined`; serialise
  only set bounds; `searchUrlStateToAssetSearchFormData` maps `popularity`; `assetSearchFormDataToUrlState` projects it
  back with the same clamp/drop rules (a stored spec is as untrusted as a URL — IT-006 never-throw); **[D1-A]** the
  `SearchSortValue` union gains `'popularity'`, `SEARCH_SORT_OPTIONS` + `{ value: 'popularity', labelKey: 'Most
  popular' }`, and the `:113-114` comment ("Most popular is intentionally NOT here — deferred to ST-5") is rewritten to
  the new truth (it shipped with ST-9 on the 5c snapshot).
- **Verify:** `vitest run src/lib/search` — the identity round-trips (including `{min:0,max:0}` — the falsy-zero trap:
  a bound of `0` must serialise and reapply; never `if (min)`), the fail-closed cases + the extended D11 lock.
- **Done:** `Required<SearchUrlState>` fixture compiles again with `popularity` set; `WIRE_KEYS` has 10 entries.

### Step 4 — the mirror merge (`Search.tsx:101-110`) — the #1858 trap
- **Action:** add `popularity: live.popularity` to the merge object (the comment at `:96-100` says every URL-only
  param lands here — this is the fourth slice to prove it).
- **Verify:** IT-156 case 3 (toggle a Statuses facet with a range active → both params survive).
- **Done:** the range survives every facet toggle; Clear All removes it (asserted, not assumed — `Filters.tsx:36-42`).

### Step 5 — the histogram hook (`odd-platform-ui/src/lib/hooks/api/assetSearch.ts`, new; export from `index.ts`)
- **Action:** `usePopularityFacet(formData: AssetSearchFormData)` — `useQuery({ queryKey: ['popularityFacet', key],
  queryFn: () => assetSearchApi.getAssetSearchPopularityFacet({ assetSearchFormData: stripped }), staleTime: 5 min,
  retry: 0 })` where `stripped` omits `popularity` **and `sort`** (neither changes the counted set) and `key` = `JSON.stringify` of the
  stripped, key-sorted request (a drag or a re-sort re-fetches nothing; a facet change does).
- **Verify:** vitest for `PopularityFilter` (mocked hook) + IT-156 case 6 (`waitForResponse` on the snake_case wire).
- **Done:** one request per distinct non-popularity state; no request on a slider commit.

### Step 6 — the reusable shell (`Filters/FilterItem/RangeFacetFilter/RangeFacetFilter.tsx` + `RangeFacetFilterStyles.ts`)
- **Action:** props `name`, `filterId`, `qualifier?`, `help?` (the tooltip sentence), `stops: {value, label,
  ariaText, count?}[]` (the rail, already restricted to observed ∪ selected by the caller), `selected?: [number,
  number]`, `onCommit(range | undefined)`, `chipText(range)`, `presets?: {label, range}[]`, `disabledReason?`.
  Renders: heading (`Typography h5` + `subtitle2 texts.info` qualifier + the ADR-0076 icon/tooltip behind a
  `span[data-qa='filter-<id>-info']`), the bar strip (`role='img'`, `aria-label` = the count summary), the MUI
  `Slider` (`value=[lo,hi]` as stop indices, `min=0 max=stops.length-1 step={null} marks`, `disableSwap`,
  `valueLabelDisplay='auto'` + `valueLabelFormat` = the stop label, `getAriaValueText` = `ariaText`,
  `onChangeCommitted` → `onCommit`, `data-qa='filter-<id>-slider'`), the presets as `Button linkGray-m`, the chip
  (`FixedOptionsMultiFilterStyles.Chip` + `ClearIcon` → `onCommit(undefined)`), or the disabled state with its reason.
  Keyboard: the MUI thumbs handle arrows / Home / End natively; `onChangeCommitted` fires on key-up. **Guard:**
  with fewer than two stops (`stops.length < 2` — e.g. a selected `[5,5]` and then Asset type = Terms leaves
  `stops = {5}`) the shell renders the chip, the presets and the reason WITHOUT a slider — a one-stop rail is not a
  range control and MUI computes NaN positions for `min == max`.
- **Verify:** `PopularityFilter.test.tsx` (the shell is exercised through its first instance — a second instance is
  #1844/#1845's concern) incl. the single-stop-with-selection mock (chip present, no slider, no NaN).
- **Done:** no popularity knowledge inside the shell; the datetime facets can instance it with their own stops.

### Step 7 — the instance (`Filters/PopularityFilter/PopularityFilter.tsx` + `popularityBands.ts`), the rail (`Filters.tsx`) and the 7 catalogs (`locales/translations/{br,ch,en,es,fr,hy,ua}.json`)
- **Action:** reads `paramsToSearchState(location.search).popularity`; calls `usePopularityFacet` with the URL-derived
  request; stops = the buckets with `count > 0` ∪ the selected bounds (fallback when the facet is unavailable: all 21
  bands from `popularityBands.ts`, no bars); labels/aria from `min_views` / `max_views` via `toLocaleString()`;
  `chipText`: `Popularity: {{min}} – {{max}} views` / `{{min}}+ views` / `up to {{max}} views` / `never viewed`;
  preset `Never viewed` → `[0,0]`; `disabledReason` when `nonEmpty.length <= 1` and no selection — three reasons (zero bands / all at 0 / one band); the failed-request path (`isError`) is NOT disabled: it shows the full 21-band rail without bars; `onCommit`
  writes `{...paramsToSearchState(location.search), popularity}` through `buildSearchLink` + `navigate`;
  `Filters.tsx` renders `<PopularityFilter />` after the Statuses facet (the global-facet block); **every new key
  (§6(d)) is added to all seven catalogs in this step, translated** (machine-assisted for `br ch es fr hy ua`, marked
  in the commit body) — never en-only-plus-backlog.
- **Verify:** vitest (URL reflect · keyboard commit writes the canonical URL via a location probe · preset · chip
  text per band · the three disabled reasons incl. the 21-zero mock · the enabled bar-less fallback rail on a failed
  hook · one render under a non-en locale from the real `ua.json`); IT-156 cases 1/2/4/8/9.
- **Done:** the control narrows the rendered list; the URL is byte-identical to the serialiser's output.

### Step 8 — the tile (`Overview/…/OwnerEntitiesList.tsx:92-98`) **[D1-A]** + the sort menu (via `SEARCH_SORT_OPTIONS`)
- **Action:** `viewAllTo={buildSearchLink({ sort: 'popularity', popularity: { min: 1 } })}` on the Popular list;
  the dropdown gains the entry through the option table (no component change). **[D2-A]** no tile-query change.
- **Verify:** IT-156 case 7; `SearchSortMenu.test.tsx` gains the option.
- **Done:** View all lands on `/search?popularity_min=1&sort=popularity`, most-viewed first.

### Step 9 — tests, BOTH buckets, each with a named RED-on-base oracle (G-C9 / G-C15)
**Unit (odd-platform, runs in `./gradlew build`):**
- `AssetSearchPopularityIntegrationTest` (new, `BaseIntegrationTest`): seed DEs at 0 / 3 / 40 / 1,000 views (+ the
  job's snapshot via `refreshPopularityScores`) and a Term sharing the token — R1 (each range returns exactly the
  expected set; `count == rows`; a keyset page 2 under a range no dup/skip), R2 (the Term present without a range,
  absent under `{max:0}` and `{min:1}`), R3 (`{min:99}` ≡ `{min:20}`; `{min:10,max:2}` → empty page + total 0), R4
  (Σ buckets == the DE count; a status facet changes counts; `asset_kinds=[TERM]` → zeros; the body's own range does
  not change counts; the Term contributes 0), R5 (the 21 served bands vs `asset_popularity_bucket` at every boundary),
  **[D1-A]** R11 (most-viewed first; every non-DE last; keyset paging under `popularity` no dup/skip).
- `AssetSearchControllerWebTest` +3: `popularity` in the body binds and returns 200; the facet endpoint returns 200
  with 21 buckets; a contradictory range returns 200 with an empty list (never a 500 — the HV000151 class for the new
  method).
- `SavedSearchControllerWebTest` + `SavedSearchServiceImplTest`: POST/GET keep `popularity` (a web round-trip of
  `{min:4,max:9}`); a legacy row reads back without it; a malformed stored `popularity` is dropped field-level (the
  spec survives); **an inverted stored range `{min:10,max:2}` reads back ABSENT** (service case + the web round-trip
  asserting the 201 body carries no range).
- **[D1-A]** the legacy `/api/search` fallback pin: a `BaseIntegrationTest` case driving the legacy `SearchService.search`
  + `getSearchResults` with `sort=popularity` and a query orders by relevance, and without a query by status priority —
  byte-identical to an unknown token today (home: `AssetSearchSortIntegrationTest`'s sibling class for the legacy path
  if one exists at authoring time, else a new small `LegacySearchSortFallbackTest`; the plan names the behaviour, the
  Phase-D commit names the class).
- **[D1-A]** `AssetSearchKeysetPaginationTest.keyset_malformedCursor_failsClosedToFirstPage` (:152) gains the two
  POPULARITY tamper tokens — `{s:POPULARITY, v:"abc"}` and `{s:POPULARITY, vn:true}` — both must fail closed to page 1
  (the blocker the round-1 plan-check found: without the cursor change the first 500s, the second seeks
  `UPDATED_AT IS NULL`); and `keysetSeek_unionOfRangesRangeStarts_orFormFilters` (:224) gains the POPULARITY seek shape
  (`popularity_score < ? / = ? AND …`, `ORDER BY popularity_score DESC NULLS LAST, asset_kind ASC, asset_id DESC`) asserting `Index`
  + no `Rows Removed by Filter`. Honestly: this oracle (like its two siblings) EXPLAINs a hand-written SQL that MIRRORS
  the generated seek — the GENERATED query's executed plan is captured in Step 10 (`auto_explain` on the built SUT:
  `Index Only Scan … asset_search_entrypoint_popularity_idx`, no Sort) and recorded as a test-ledger line, which is
  where a `.desc()`-without-`nullsLast()` slip would be caught.
- **CHANGED tests (G-C15 — each keeps a RED-on-base proof and asserts MORE truth; SoT named):**
  | Test | Change | SoT for the new expectation | Surviving RED |
  |---|---|---|---|
  | `AssetSearchServiceMyDataTest:167-171` + `AssetSearchScopePredicateTest:235,244` | the repository mock/call arity gains the `PopularityRangeDto` argument (`null`) | the new interface signature — a compile-time fact, no oracle weakened | unchanged assertions; still RED if the scoping predicates regress |
  | `SearchSortMenu.test.tsx:84` "offers the four canonical orderings" → five, `Most popular` last | `SEARCH_SORT_OPTIONS` + §1G of the design doc + the `en.json` key | RED on base (the option is absent there) |
  | `searchFormDataToUrlState.test.ts:124-154` | `Required<SearchUrlState>` gains `popularity: {min:1,max:5}`; `WIRE_KEYS` gains `popularity` (10) | the wire — `AssetSearchFormDataToJSON` emits every key; the D11 invariant | RED on base (a 10-key set vs the 9 emitted) |
  | `searchFormDataToUrlState.test.ts:83-86` | its UNKNOWN-sort fixture is literally `sort: 'popularity'` — a value this slice makes known; the fixture becomes `'garbage'` (the `searchUrlState.test.ts:188` idiom) | the contract allow-list (what "unknown" means) | n/a — a fixture correction; the assertion (an unknown sort is dropped) is unchanged and still RED if the fail-closed parse regresses |
- RED proof: every new predicate/histogram test fails on `af5a573b` by construction (the field does not exist → the
  request is unfiltered / the endpoint 404s); recorded by running the class against a detached `af5a573b` worktree.
**Unit (FE, vitest — CI does not run it, so it is run and cited):**
- `searchUrlState.test.ts` (+ round-trip identity, serialise-only-set-bounds, fail-closed drop / clamp / inverted-drop,
  the projection both ways) · `searchFormDataToUrlState.test.ts` (the D11 lock: `popularity` in the `Required` fixture,
  `WIRE_KEYS` → 10, a `popularity`-only round-trip) · `PopularityFilter.test.tsx` (new, the location-probe pattern) ·
  `SearchSortMenu.test.tsx` **[D1-A]** · `i18n-key-parity.test.ts` (unchanged, run).
**Integration (odd-team `IT-156` — `integration-tests/protocols/IT-156-popularity-range-facet.md` +
`e2e/specs/popularity-range-facet.spec.ts`, stack `odd-minimal`, `validates: [F-017]`, lane `pending-merge` until the
PR merges — graduated at the GATE-2 close-out per TST-067; **`suites.yaml` is currently dirty and owned by the co-active
`ctrib065close` session, so the one-line lane edit is sequenced AFTER that session's commit lands — never staged over
its working copy, O10**):** seed three DEs sharing a token at 0 / 40 / 1,000 views —
**set BOTH `data_entity.view_count` AND the union row's `popularity_score = asset_popularity_bucket(view_count)`**: the
snapshot job runs at startup and every 15 minutes with no initial delay and rewrites any row whose bucket
`IS DISTINCT FROM bucket(view_count)`, so a score set with `view_count` left at 0 would be reset to 0 mid-test (a
flake); with both seeded the job is a no-op on these rows. The fast tier is still right (the job itself is 5c's tested
concern) — plus a Term with the token. Every case asserts **narrowing with a FOIL** (presence alone is GREEN on
base, where the params are dropped):
| # | Case | RED on `af5a573b` because |
|---|---|---|
| 1 | keyboard-drive the slider to the 31–62 band → URL gains `popularity_min=5&popularity_max=5`; the 40-view DE listed; the 0-view and 1,000-view DEs **absent**; the Term absent; the qualifier visible | no control exists |
| 2 | deep link `?q=tok&popularity_min=4` → chip `Popularity: 15+ views`; the 0-view DE absent | the param is dropped → the unfiltered list shows it |
| 3 | with the range active, tick a Statuses facet → both params still in the URL and the 0-view DE still absent | no mirror merge |
| 4 | with the range active (the 0-view DE **absent** — asserted first), Clear All → both params gone and the 0-view DE **back** | the first half is RED on base (the range never applied); the second half is the completeness oracle |
| 5 | save the search with the range → reload → reapply → the 0-view DE absent; the copied link carries the params | the spec has no `popularity` |
| 6 | the facet response (captured on the wire, `waitForResponse(/facets\/popularity/)`) has 21 buckets and its counts change when a Statuses facet is applied | 404 |
| 7 | **[D1-A]** the home tile's **View all** → `/search?popularity_min=1&sort=popularity`; the 1,000-view DE is listed ABOVE the 40-view DE (relative order — other specs' seeded entities may outrank both), the 0-view DE absent | the tile has no link |
| 8 | the **Never viewed** preset → `popularity_min=0&popularity_max=0`; only the 0-view DE listed | no control |
| 9 | Asset type = **Terms** (with the token) → the Popularity control renders **disabled** with "No data entities match your other filters" (the histogram is 21 zeros); removing the kind re-enables it | no control |
Every `expect(...)` on a response body is written from a CAPTURED real response (CTRIB-023/IT-137 rule).
**Run discipline:** `ODD_STREAM=ctrib066 ODD_PLATFORM_DIR=../odd-platform-ctrib066 integration-tests/run-suite.sh IT-156`
(GREEN on the fix) and `ODD_SUT=ref:main` (the RED half); then the FULL regression `integration-tests/run-regression.sh
ctrib066` (blocks on the flock until `ctrib065close` releases it); the FULL unit build; the local changed-lines coverage
check (≥ 98 %) from the jacoco XML — before the PR leaves draft.

### Step 10 — SRE measurement on the built SUT
- **Action:** re-run §4a's histogram + count + range-page + sort-page measurements through the REAL endpoints on the
  Phase-D SUT with the 126k corpus (`auto_explain` for the executed plans); record in the ledger.
- **Done:** histogram ≤ 1.2× count on browse and FTS; the sort page index-only; the range page unchanged.

### Step 11 — docs on `documentation@release/1.0.0` (own worktree `../documentation-ctrib066` off `origin/release/1.0.0`; same-name push; LSN-034)
- `docs/data-discovery/search.md`: a **## Popularity** section after **## Favorites** (what it filters, the bands as a
  short table, DE-only + the exclusion sentence, the 15-minute snapshot, the Never-viewed preset, **[D1-A]** the Most
  popular sort, the tile's View all, the R13 divergences in one `hint` that LINKS the inflatability warning rather than
  repeating it); the frontmatter `description` is **re-authored** (today 188 chars — appending ", Popularity" lands exactly on the
  200-char GitBook cut, so the sentence is rewritten shorter, e.g. dropping the redundant "the catalog's query-oriented
  entry point" clause the H1 already carries) and measured ≤ 200 chars (PyYAML + `: ` check);
  the "filters travel with the link" bullet lists the range.
- `docs/data-discovery/catalog-overview.md`: :60 (the column now links) · :62 ("Each of the first three columns
  carries a View all" → all four; the Popular link's destination named) · :76 (both clauses: "The three personalised
  columns each end in a View all" and "Popular has none…" replaced with the link's behaviour) · the R13 sentences beside
  the inflatability warning.
- `docs/Features.md:60` + `docs/data-discovery.md:13,23`: the facet enumerations gain the Popularity range.
- Paired `backlog/docs/DOC-527.md` (`milestone: "1.0.0"`, the affected pages + expected URLs for the release gate).
- **Verify:** every changed page re-read end-to-end; `git grep -n "Popular has none"` on the branch returns nothing.

### Step 12 — ontology (G-C10) + follow-ups on disk
- `lineage/odd-platform/feature-flows/detail/F-017.yaml`: `F-017-UC-16` (the promise: a user narrows the catalog to
  a view-count band, sees the distribution, Terms/QEs excluded with a reason; **[D1-A]** the tile's View all is the same
  list, longer), `coverage: verified`, `test_ref` → IT-156 + the unit classes; `use_case_coverage` 4/15 → 5/16;
  re-embed the graph (`graph-build`); no sidecar exists for any touched file (NAV-004 — noted for the corpus rescan).
- `issues/odd-platform/PLT-267-popular-tile-live-vs-snapshot.md` **[D2-A]** (paste-ready: converge the tile onto the
  snapshot; the two divergences; the `view_count` seq-scan) — handed to the maintainer at GATE 1.
- `backlog/docs/DOC-527.md` (step 11).

### Step 13 — the public scope comments (G-C5; posted right after GATE 1, before any code)
- On **#1843**: this PR covers the range facet + histogram + tile link **and** (D1-A) the `Most popular` sort option
  from #1861 item 1; the browse-default fork is NOT decided here; the tile's live-vs-snapshot divergence is disclosed
  in the docs and tracked by the maintainer-filed issue (URL once filed).
- On **#1861** (D1-A): item 1's sort option ships with the ST-9 PR (`Part of #1861`); the default fork + items 2–3 stay.
  ASCII only; no workspace-internal ids.

### `must_haves` (the plan contract — G-C19)

**User-observable truths** (each traces to a §4 acceptance line):

| # | Truth | Spec | Covered by |
|---|---|---|---|
| T1 | Setting a Popularity range lists only the data entities whose view count falls in the selected bands, and the count above the list agrees | R1 | unit + IT-156 #1/#2 |
| T2 | With a range active, Terms and Query Examples are absent and the control says "Data entities only" (+ why, on hover) | R2 | unit + IT-156 #1 |
| T3 | A garbage or contradictory range never errors: the UI shows no filter (the junk param normalises away on the next facet toggle); the API answers 200 with an empty list for a contradictory range | R3 | vitest + web test |
| T4 | The bars above the slider show how many data entities sit in each view band for everything else the user has filtered — and do not change when the slider itself moves | R4 | unit + IT-156 #6 |
| T5 | Every label / chip / aria text names the exact view boundary the filter applies (`15 – 30 views`, `1,023+ views`) | R5, R7 | unit (the 21-boundary pin) + vitest |
| T6 | The results never wait for the histogram; if it fails the slider still works over the full rail | R6 | vitest (failed hook) + the measured ledger |
| T7 | A keyboard user can set the range; the commit puts `popularity_min/max` in the address bar and narrows the list | R7, R9 | vitest (location probe) + IT-156 #1 |
| T8 | When the other filters leave zero or one view band to slide over, the control is disabled and says why (nothing matches / all unviewed / all in one band) — while a failed histogram request leaves it usable | R8, R6 | vitest (three mocks + the error mock) + IT-156 #9 |
| T9 | The range survives every other facet toggle, and Clear All removes it | R9 | IT-156 #3/#4 |
| T10 | A saved search that had a range reapplies it, and its copied link carries it | R10 | vitest (D11 lock) + web test + IT-156 #5 |
| T11 | **[D1-A]** "Most popular" in the sort menu orders the list most-viewed first, with Terms/QEs last | R11 | unit + vitest |
| T12 | **[D1-A]** The home tile's View all opens the search already sorted by popularity and narrowed to viewed data entities | R12 | IT-156 #7 |
| T13 | The docs say what the tile and the search disagree on (band order, 15-min lag, exclude_from_search) | R13 | doc read (Gate 8 at the release gate) |
| T14 | Every new label renders in each of the 7 locales | R14 | the repo's parity test (every key in every catalog), run + one vitest render under `lng: 'ua'` from the real catalog (a rendered check, not only parity) |
| T15 | A reader of the 1.0.0 manual finds the Popularity facet, its bands, its DE-only rule, the snapshot lag and the tile link described on the search page, and the catalog-overview page no longer says the tile has no View all | R15 | the doc read + `git grep` for the retired sentence; Gate 8 live-verify at the 1.0.0 release gate (DOC-527) |

**Artifacts** (path → provides → grep anchor):

| Artifact | Provides | Anchor |
|---|---|---|
| `odd-platform-specification/{components,openapi}.yaml` | the wire fields + the facet endpoint | `PopularityRange`, `/api/search/assets/facets/popularity` |
| `…/dto/PopularityRangeDto.java` | the clamped bounds + `contradictory()` | `record PopularityRangeDto` |
| `…/dto/SearchSortDto.java` **[D1-A]** | the sort token | `POPULARITY` |
| `…/dto/AssetSearchCursor.java` **[D1-A]** | the fail-closed cursor for the new sort | `case POPULARITY` |
| `…/repository/reactive/ReactiveAssetSearchRepositoryImpl.java` | T1, T2, T4, T11 | `POPULARITY_SCORE.between`, `popularityHistogram` |
| `…/service/PopularityBands.java` | T5 | `minViews` |
| `…/service/AssetSearchServiceImpl.java` | T4 (shared scoping) | `popularityFacet` |
| `…/controller/AssetSearchController.java` | T4 | `getAssetSearchPopularityFacet` |
| `…/service/SavedSearchServiceImpl.java` | T10 | `POPULARITY_FIELD` |
| `…/lib/search/searchUrlState.ts` | T3, T7, T9, T10 | `SEARCH_POPULARITY_MIN_PARAM` |
| `…/components/Search/Search.tsx` | **T9** | `popularity: live.popularity` |
| `…/lib/hooks/api/assetSearch.ts` | T4, T6 | `usePopularityFacet` |
| `…/Filters/FilterItem/RangeFacetFilter/RangeFacetFilter.tsx` | T5, T7, T8 | `onChangeCommitted` |
| `…/Filters/PopularityFilter/PopularityFilter.tsx` + `popularityBands.ts` | T1–T8 | `filter-popularity` |
| `…/Filters/Filters.tsx` | renders the control in the rail | `<PopularityFilter` |
| `…/Overview/…/OwnerEntitiesList.tsx` **[D1-A]** | T12 | `sort: 'popularity'` |
| `…/locales/translations/{br,ch,en,es,fr,hy,ua}.json` | T14 | `Most popular`, `Data entities only` |
| `integration-tests/protocols/IT-156-*.md` + `e2e/specs/popularity-range-facet.spec.ts` + `suites.yaml` (`pending-merge`) | T1–T12 | `popularity_min` |
| `documentation@release/1.0.0` (4 pages) + `backlog/docs/DOC-527.md` | T13, T15 | `## Popularity` |
| `lineage/odd-platform/feature-flows/detail/F-017.yaml` | the promise | `F-017-UC-16` |

**key_links** (where this would silently half-work):

| From | To | Via | Silent failure if missed |
|---|---|---|---|
| a sidebar facet toggle | the preserved range | the `Search.tsx` merge object | the #1858 class — the filter vanishes on the next click |
| the slider commit | the canonical URL | `buildSearchLink` / `searchStateToParams`, never a literal | a byte-divergent URL the mirror rewrites — the control flickers and reverts |
| `AssetSearchFormData.popularity` | the SQL predicate in **all three** page/count methods | `PopularityRangeDto` threaded through `keysetPage`, `relevancePage`, `count` | a total that disagrees with the rows |
| the facet endpoint | the SAME scopes as the results | the shared `scoped(formData, fn)` in the service | bars that describe a list the user will not get (My-data / favorites ignored) |
| the facet request | no re-fetch on a drag or a re-sort | the hook's key = the request **minus** `popularity` **and** `sort` | a fetch storm on every handle move, and bars that collapse to the selection |
| the stored spec | the reapplied range | `assetSearchFormDataToUrlState` + the sanitiser clause | LSN-042 again — a saved search that silently lost its filter |
| the served bands | the SQL function | the R5 boundary pin | a label that includes an entity the predicate excludes |
| the tile's View all **[D1-A]** | a list that resembles the tile | `sort=popularity` + `popularity_min=1` | a link that betrays its origin |
| a `sort=popularity` page 2 **[D1-A]** | a fail-closed seek | `AssetSearchCursor.parsesForSort` + the `:128` guard extended to POPULARITY | a tampered cursor 500s (`Short.parseShort` in the seek) or seeks `UPDATED_AT IS NULL` |
| IT-156 | a real RED on base | asserting the FOIL's absence, never the subject's presence | a test green on the unfixed base (G-C15) |

**Two key_links verified as already wired (traced, not assumed):** the request build — both fetch sites in `Results.tsx`
(`:105` scroll, `:113` page 1) read one `assetSearchFormData` memo from `location.search`, so the range reaches the
request the moment the projection exists; the re-query trigger — a changed `popularity` changes `searchStateToParams`'
output, so `Search.tsx`'s `urlStateKey` changes and page 1 re-fires (the `asset_kinds` / `favorites` mechanism).

**No scope-reduction language.** The sort is a GATE-1 option, not a deferred shadow; the tile convergence is a named
sibling with a paste-ready draft, not "reported separately"; the server cache is excluded on a measurement, not on
effort.

### GATE 1 — APPROVED 2026-09-05 (`RamanDamayeu`, via the structured ask after plan-check round 3 PASSED)

| Decision | Chosen | Consequence folded into the plan |
|---|---|---|
| **D1** — the tile's View all needs a ranking | **A** — the range facet + histogram **and** the `Most popular` sort option (#1861 item 1, the option only); the tile links to `/search?popularity_min=1&sort=popularity` | every **[D1-A]** step is IN; the browse-default fork stays in #1861; a scope comment on #1843 AND on #1861 (`Part of #1861`, never `Closes`) |
| **D2** — tile vs search divergence | **A** — disclose the three consequences in the manual's Popularity section; the maintainer files `PLT-267` (converge the tile onto the snapshot) as its own slice | the tile's query is untouched; the scope comment describes the documented behaviour without a "tracked separately" claim until the issue URL exists (G-C5 / LSN-042 rule 1) |
| **Delivery** | **one PR**, per-step commits | one draft PR, one review, one merge |

## 7a. Plan-check record (G-C19)

**Round 1 — `plan-checker`, fresh context, 2026-09-05: `ISSUES FOUND` — 1 blocker, 11 warnings**
(`contributor/CTRIB-066-plancheck.md`). Every cited file/line verified at `af5a573b`; D4 clean (no scope-reduction or
class-extension phrase; D2's disposition compliant with G-C5); D6 system-level ADR conformance holds; D8 all open
questions resolved/routed; D10 no G-C7 stop.
- **B1 (fixed):** the `Most popular` sort had a consumer with no step and no test — `AssetSearchCursor.parsesForSort`
  accepts any string in its `default` and the `:128` NOT-NULL guard names only `STATUS_PRIORITY`, so a tampered
  POPULARITY cursor would 500 or seek `UPDATED_AT IS NULL`. → Step 2 files/action, Step 9 (two tamper tokens in the
  fail-closed test + the POPULARITY seek in the EXPLAIN test), an artifact row and a key_link.
- **W1 (fixed):** `PLT-266` had been taken by the co-active session ten minutes earlier → the draft is `PLT-267`
  (re-check the max id at packet assembly).
- **W2 (fixed):** two more consumers of the changed repository arity (`AssetSearchScopePredicateTest`) and of
  `SearchSortDto` (the legacy `getSearchResultOrderFields` fallback — the shared `sort` prose now scopes the token).
- **W3 (recorded):** size over the letter of the budget; precedent + the D1 split named for the maintainer.
- **W4 (fixed):** R3 no longer claims an on-load URL rewrite (none exists; junk normalises on the next mirror write).
- **W5 (fixed):** IT-156 case 4 asserts the narrowing first, then Clear All.
- **W6 (fixed):** the three CHANGED tests enumerated with SoT + surviving RED (G-C15).
- **W7 (fixed):** the generated POPULARITY seek shape is EXPLAINed in the keyset test, not only the hand-written ORDER BY.
- **W8 (fixed):** a stored inverted range is normalised by the sanitiser so the server and the FE reapply agree.
- **W9 (fixed):** `catalog-overview.md:62` + both clauses of `:76`; the description is re-authored, not appended.
- **W10 (fixed):** T15 covers R15.
- **W11 (fixed):** `suites.yaml` edit sequenced after the co-active commit; the hook key strips `sort` as well.

**Round 2 — `plan-checker`, fresh context, 2026-09-05: `ISSUES FOUND` — 1 blocker (new), 7 warnings.** Round 1's
B1 + W1/W2/W5/W6/W9/W10/W11 CLOSED; W4 partial (T3 residue); W7/W8 closed with a residual each; W3 honest but the seams
understated. The spawner's three hunts: the sanitiser/server split is consistent (URL ↔ saved row agree — D11 holds)
but the live-empty vs saved-absent pair was undocumented → fixed; stripping `sort` from the histogram key is never
wrong (the aggregate takes no sort); four §4/§6/§7 residues → fixed.
- **B1 (fixed):** the all-zero histogram (Asset type = Terms; a query matching only terms; My data with no owner) hit no
  defined rendering — R8 disabled only for ONE band, so `stops = []` → a degenerate `max = -1` slider. → R8 "at most
  one non-empty band" + the zero-band reason (13th key ×7), Step 7 `nonEmpty.length <= 1`, T8 reworded, three vitest
  mocks + IT-156 case 9; kept distinct from the failed-request fallback (T6).
- **W1 (fixed):** `.desc()` is `DESC NULLS FIRST` in Postgres and the index is `DESC NULLS LAST` → `.desc().nullsLast()`
  at both ORDER BY sites + the oracle SQL.
- **W2 (fixed):** the inverted range's three paths stated in the contract (live → empty; saved → normalised to absent);
  `{}` ≡ absent; service + web tests named.
- **W3 (fixed):** the IT seed sets `view_count` AND the score (the snapshot job runs at startup with no delay and would
  reset a score seeded over `view_count = 0`); case 7 asserts relative order.
- **W4 (fixed):** the 7 catalogs are Step 7's files; T14 gains a rendered non-en check.
- **W5 (fixed):** Step 1 scopes the `sort` token; Step 2 guards the legacy path (per-context default, byte-identical to
  today); Step 9 pins it.
- **W6 (fixed):** T3's stale clause, the §6(d) duplicate, "minus popularity and sort" everywhere, the docs artifact →
  T15, the `SearchSortValue` union + the stale `:113` comment in Step 3.
- **W7 (fixed):** the three delivery seams named inside D1 for the maintainer.

**Round 3 — `plan-checker`, fresh context, 2026-09-05: `VERIFICATION PASSED`** — 15/15 requirements → a step and a
truth; 20 artifacts each with a consuming step; 10 key_links each implemented by a named step; D1–D10 compliant; **no
open BLOCKER — the plan may proceed to GATE 1.** Round 2's B1 + W1–W5/W7 CLOSED, W6 partial. Six non-blocking warnings,
all folded before the packet: (1) a HIDDEN changed test — `searchFormDataToUrlState.test.ts:83-86` uses `sort:
'popularity'` as its unknown-sort fixture → the fixture becomes `'garbage'`, a fourth CHANGED-table row; (2) a
single-stop rail with a selection → the shell renders no slider below two stops; (3) the two assistive strings are
i18n keys too (15 in all), asserted in the `ua` render; (4) the unit EXPLAIN oracle is honestly described as mirroring
the generated seek, with the generated plan captured in Step 10's ledger; (5) hygiene — R11 and §4a now spell
`DESC NULLS LAST` and the guarded legacy fallback, the key_links row says "minus `popularity` and `sort`",
`PopularityRangeDto.of({})` is defined, a `{min:0,max:0}` round-trip fixture is named, line drift fixed; (6) size —
carried into GATE-1 D1 with the three seams. No fourth plan-check (loop ≤ 3); `/review` re-checks the `must_haves`
against the diff (G-C19).

## 8. Test ledger
_(filled in Phase D — every gate RUN, never reasoned: full unit build · targeted classes · vitest + tsc + i18n parity ·
IT-156 GREEN on the fix + RED on `ref:main` · the FULL four-suite regression under the flock · changed-lines coverage ·
the SRE re-measurement · the pixel review of the rendered rail.)_

## 9. A coordination hazard I created (recorded, not buried)

My round-1-fixes commit (`7435fdb5`, never pushed) was a bare `git commit -m` after an explicit `git add` of three
paths. The odd-team checkout's index is SHARED, and the co-active `ctrib065close` session had by then STAGED six files
of its own close-out (`contributor/CTRIB-065.md`, the IT-155 protocol, `run-log/2026-09-05-feature-complete.md`,
`suites.yaml`, `PLT-265`, `state/PROGRESS.md`) — a bare commit takes the whole index, so their 441 lines rode into my
commit under my message. Caught by `git show --stat` on a routine "did the co-active session commit its dirt?" check
(the four files had gone clean with no commit of theirs in the log). Remedied before any push: `git reset --soft HEAD~1`
+ `git commit -- <my three paths>` (`b6ffca96`); their six files are back in the index, staged exactly as they left
them, for their own commit. Rule installed in `playbooks/stream-coordination.md` step 6 + the registry header: **commit
with a pathspec; `git diff --cached --name-only` first.** O3 named the `git add -A` sweep; this is its sibling — the
bare-commit sweep of files someone ELSE staged.

## 10. Comments posted (G-C6 / G-C5)
- Clarifying question: **none warranted** — every open point resolved from source, the manual, the measurement or the
  SME consult; the two residuals are product decisions for GATE 1, not questions the maintainer must research.
- Scope comments (posted 2026-09-05 right after GATE 1, before any code — one per issue, ASCII, self-contained,
  no workspace-internal ids; the tile divergence described as a DOCUMENTED behaviour, with no "tracked separately"
  claim until PLT-267 has a URL — G-C5 / LSN-042 rule 1):
  - #1843 (scope of the ST-9 PR incl. the Most-popular sort + what it deliberately does not do): https://github.com/opendatadiscovery/odd-platform/issues/1843#issuecomment-5553257740
  - #1861 (item 1's sort option ships with the ST-9 PR, `Part of #1861`; the browse-default fork + items 2-3 stay): https://github.com/opendatadiscovery/odd-platform/issues/1861#issuecomment-5553257855
