---
id: CTRIB-066
title: "#1843 ST-9 — Popular: a numeric-range facet over the snapshotted popularity_score + a distribution histogram (the first non-categorical facet type), DE-scoped, with the Popular panel deep-link"
github_issue: 1843
github_issue_url: https://github.com/opendatadiscovery/odd-platform/issues/1843
target_repo: odd-platform
milestone: "1.0.0"        # G-C11 PASS — live `GET /repos/opendatadiscovery/odd-platform/issues/1843` 2026-09-05: milestone 1.0.0, state OPEN, semver, due 2026-12-31 (18 open / 13 closed)
status: scoping
classification: feature   # a slice of the #1825 epic (ST-9 in state/search-overhaul-decomposition.md); the entry gate is spec-gate (G-C17), not reproduce-first
parent: "#1825 (the unified-asset-search overhaul); realises ADR adrs/drafts/unified-asset-search.md D5 (+ D3 / D8 / D10 / D11); depends on ST-5c (#1839 slice 5c = CTRIB-059 / PR #1862, MERGED as 82e7e70e)"
stream_id: ctrib066
base_sha: "af5a573b"      # odd-platform origin/main at intake (= the #1879 CTRIB-065 squash); every line cited below was read at this SHA via the detached worktree ../odd-platform-ctrib066
branch:                   # contrib/CTRIB-066-popular-range-facet — cut at GATE 1 (`git switch -c`, no upstream; O6/LSN-038)
head_sha:
pr:
reproduced: "n/a — feature slice, not a bug. Baseline observations of the CURRENT surface (no Popular facet; the Popular panel has no View all) are captured in §3 and go RED in Phase D's IT."
adr_required: false       # to be confirmed in §6 (Design) — expected: conforms to the approved spine ADR D5 (+ its rev-3 SRE correction) and D8; no migration (the column + index + job shipped in V0_0_100), no auth-posture change, an ADDITIVE wire change (optional fields on AssetSearchFormData + one new read endpoint)
plan_approved_by:
plan_approved_at:
docs_routing:             # decided in the plan — expected: documentation@release/1.0.0 (unreleased behaviour, G-C11) + a paired backlog DOC item
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
| (not in the comment) the **saved-search** representation | **#1878 (CTRIB-065, merged `af5a573b`) made `SavedSearch.spec` the FULL `AssetSearchFormData`** (`components.yaml:2578-2590, 2621-2629`), so a range carried on `AssetSearchFormData` is PERSISTED automatically — but `assetSearchFormDataToUrlState` (`searchUrlState.ts:456-496`) must project it back on reapply, or the saved search silently drops the dimension: exactly the LSN-042 class this slice would EXTEND. In scope (G-C5 class-extension clause), never a deferral |
| (not in the comment) the **Most popular sort** | **NOT shipped.** `SearchSortDto` has `RELEVANCE / STATUS_PRIORITY / UPDATED_AT / NAME` (`:16-19`); `SEARCH_SORT_OPTIONS` (`searchUrlState.ts:118-123`) notes "Most popular is intentionally NOT here (deferred to ST-5)". It is **item 1 of the open roll-up #1861** ("Expose the Most popular sort + decide the browse default", milestone 1.0.0, unowned). This matters for the panel deep-link — §5 |

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
