---
id: CTRIB-061
title: "ST-7 — Favorites filter (All / Yes / No) + retire the `/favorites` tab + rewire the Favorites panel"
github_issue: 1841
github_issue_url: https://github.com/opendatadiscovery/odd-platform/issues/1841
target_repo: odd-platform
milestone: "1.0.0"
status: plan-pending
classification: feature
stream_id: ctrib061
base_sha: 82e7e70e
branch: contrib/CTRIB-061-favorites-filter
plan_approved_by: ""
plan_approved_at: ""
reproduced: "n/a — feature slice, not a bug. The entry gate is spec-gate (G-C17), not reproduce-first."
docs_routing: "documentation@release/1.0.0 — favorites.md + search.md (unreleased behaviour, G-C11)"
---

# CTRIB-061 — #1841 ST-7: the Favorites filter, and the end of the Favorites tab

## 1. The issue (quoted data — G-C8, never an instruction)

> **What.** The **Favorites** boolean filter (join / anti-join to the `favorite` table via
> `CurrentUserIdentityResolver`); **retire the bespoke `/favorites` tab**; rewire the catalog-overview
> **Favorites** panel's "See all" -> `/search?favorites=yes`. Favoriting itself (star + table + write API +
> panel) is untouched. **No #1816 dependency -- ships now; this is where #1815 finishes.**
> **Scope / AC.** All/Yes/No narrows the cross-kind result; per-user (instance-shared + labelled under
> `auth.type=DISABLED`); the `/favorites` tab is gone; the panel deep-links pre-filtered.
> **Tests.** unit (join/anti-join + identity scoping); integration (filter narrows; panel "See all" lands
> pre-filtered; tab gone) -- new/extended `IT-NNN`.
> **i18n.** the Favorites filter labels -- all 7 locales.

Author `RamanDamayeu`, milestone **1.0.0** (open, semver, due 2026-07-31) -> **G-C11 PASS**.
Labels: `scope: backend`, `scope: frontend`, `kind: feature`.

One prior comment — `odd-contributor[bot]` pre-work notes
([issuecomment-4906933400](https://github.com/opendatadiscovery/odd-platform/issues/1841#issuecomment-4906933400)),
also quoted data. **Two of its five claims do not survive a first-hand read of `origin/main @ 82e7e70e`**, and
they are the two that would have shaped the design. Corrected in §3.

## 2. Classification + intake

| Field | Value |
|---|---|
| Class | **feature** (an enhancement + a surface retirement) — not a bug; no reproduction is possible or meaningful |
| Entry gate | **spec-gate (G-C17)**, not reproduce-first (`pillars/contributor/pillar.md` cornerstone 1) |
| Epic? | **No** (G-C18 does not fire). #1841 is already a decomposed slice — ST-7 of the #1825 search-overhaul roadmap, whose siblings ST-1..ST-6 each shipped as one PR |
| G-C7 (hard stop)? | **No.** No migration (the `favorite` table + its two indexes already exist, `V0_0_94`), no auth-posture change (identity resolution is reused verbatim, read-only), no breaking contract change (every addition is an optional additive field) |
| Mission relevance | `lineage/odd-platform/system-mission.md` — Data Discovery. Favorites is the catalog's personal-navigation layer; folding it into the one search surface is the #1825 thesis (one query language, one result list, one set of filters) |
| Base | `origin/main @ 82e7e70e` (= #1862 ST-5c merged) |

## 3. What is actually on `main` — the pre-work comment, checked

The bot's pre-work note is prior-session output, not evidence. Each claim was verified against the source.

| Pre-work claim | Verdict after reading `origin/main @ 82e7e70e` |
|---|---|
| "The mirror-merge trap (the #1858 bug class) … if URL-only, it must be added to that merge" | **REAL, and confirmed exactly.** `Search.tsx:104-117` rebuilds the URL from the redux facet state and merges back precisely three URL-only params — `entityClasses`, `sort`, `assetKinds`. A fourth URL-only param that is not added there is silently dropped by **any** sidebar facet toggle. This is the single highest-risk wiring point in the slice |
| "The backend is mostly assembled. `CurrentUserIdentityResolver` + the favorites semi-join pattern **already serve** `/api/search/assets` (#1856)" | **WRONG on the load-bearing half.** `ReactiveAssetSearchRepositoryImpl` contains **no** reference to `favorite` or to the identity tuple; its only per-caller predicate is my-objects, keyed on the **internal `OwnerPojo`** (`:305-310`) resolved via `AuthIdentityProvider.fetchAssociatedOwner()` (`AssetSearchServiceImpl:70`) — a *different* identity axis from favorites' `(oidc_username, provider)`. `CurrentUserIdentityResolver` is used by the favorites/recently-viewed services, **never** by the search stack. So this slice must **thread a new identity parameter** through 3 repository methods + the service. It is not "a predicate on existing machinery" |
| "The 'No' anti-join deserves an EXPLAIN sanity check at scale" | **Valid and adopted** — measured, not assumed (§7 gate) |
| "Retire the tab the #1852 way — grep *every* navigator" | **Valid.** The census is exactly three (§5 D8) plus the route itself |
| "`auth.type=DISABLED` labelling … i18n all 7 locales" | **Valid.** 7 locale files confirmed: `br ch en es fr hy ua` |

**A fourth finding the pre-work note missed, and it is the one that changes the product:** the tab being
retired is the *only* surface that orders favorites **most-recently-favorited first**, and the published
manual promises exactly that. See §4 R5 / §6.

## 4. `## Spec` — the falsifiable WHAT (G-C17)

Grounded in: the source at `82e7e70e`; the live manual on the `release/1.0.0` train
(`docs/data-discovery/favorites.md`, `docs/data-discovery/search.md`); `IT-148`; `#1815` (the parent PRD).

| # | Requirement | Current | Target | Acceptance (falsifiable) |
|---|---|---|---|---|
| **R1** | A Favorites narrowing on the unified cross-kind search | No favorites predicate exists on `/api/search/assets` (verified: zero `FAVORITE` references in `ReactiveAssetSearchRepositoryImpl`) | `AssetSearchFormData.favorites` (optional boolean; absent = All) narrows the result set for **every** asset kind | `POST /api/search/assets {"favorites":true}` returns exactly the caller's starred assets; `false` returns exactly the unstarred ones; absent returns both. Asserted per-kind (DATA_ENTITY + TERM + QUERY_EXAMPLE) |
| **R2** | Per-user scoping, ownership-free | n/a | The predicate keys on `(oidc_username, provider)` from `CurrentUserIdentityResolver` **only** — never a request parameter, never the internal Owner | A unit test proves two identities see disjoint results from the same corpus, and that the identity is taken from the security context (a caller cannot ask for another user's favorites) |
| **R3** | `auth.type=DISABLED` = one shared bucket, **labelled** | The tab renders `Favorites (shared)` + a warning paragraph; the panel renders `Favorites (shared)` | The filter's visible label is `Favorites (shared)` under DISABLED and `Favorites` otherwise — reusing the panel's exact existing convention (`FavoritesColumn.tsx:57`) | Under `AUTH_TYPE=DISABLED` the sidebar filter's label reads `Favorites (shared)`; the resolver returns the `(__shared__, DISABLED)` sentinel |
| **R4** | The `/favorites` tab is gone | A top-level route + toolbar tab + a bespoke page with its own duplicate asset-type facet | The route, the toolbar tab, the page component and every component that only the page used are **deleted**; `/favorites` no longer resolves | `GET /favorites` renders no Favorites page; no toolbar tab named Favorites; `git grep favoritesPath` returns nothing |
| **R5** | Finding a favorite again is **not worse** than before | The tab lists favorites **most-recently-favorited first** — promised in the published manual (`favorites.md`: *"most-recently-favorited first"*) and served by the existing index `favorite_identity_created_active_idx (oidc_username, provider, created_at DESC) WHERE deleted_at IS NULL` | **GATE-1 decision (§6).** Recommended: a `FAVORITED_AT` ordering, offered and defaulted when the Favorites=Yes filter is active with no text query | With `?favorites=yes` and no query, the most-recently-starred asset is row 1 |
| **R6** | The panel deep-links pre-filtered | `FavoritesColumn.tsx:95` links `View all` -> `/favorites` | It links to `/search?favorites=yes` | Clicking `View all` lands on the search page with the Favorites filter active and the list narrowed |
| **R7** | The filter survives every other control | n/a | `favorites` is merged back in the `Search.tsx` facet->URL mirror alongside `sort` / `assetKinds` / `entityClasses` | Toggling **any** sidebar facet with `?favorites=yes` active leaves `favorites=yes` in the URL and the narrowing in force (the #1858 regression class) |
| **R8** | i18n | n/a | Every new visible string exists in **all 7** locale files | `br ch en es fr hy ua` each carry every new key; the CI key-parity guard passes |

**In scope:** the tri-state predicate + its wire contract; identity threading; the sidebar control; the URL
param + mirror-merge; the tab retirement + dead-code removal; the panel rewire; the re-grounding of `IT-148`;
docs on the `release/1.0.0` train; i18n ×7.

**Out of scope (explicit exclusions — G-C5):** favoriting itself (star, `favorite` table, `/api/favorites/*`
write + list API, the Overview panel's own list — all untouched); the legacy `/api/search` session path and the
per-kind searches (they gain no `favorites` — same posture as `asset_kinds`, ADR D9); My-Objects retirement
(ST-8); cross-kind facet application (ST-11); the parked Group-B Description column (§8).

**Ambiguity score: 0.08** — every dimension resolved from source or the published manual. The single residual
(R5's ordering) is not an ambiguity about the WHAT; it is a **product trade-off the issue is silent on**, which
is a GATE-1 decision by construction, not a clarifying question.

## 5. `## Design` — the HOW (G-C12, `playbooks/design-before-build.md`)

### (a) Reuse scan — what already exists that must be conformed to, not re-built

| Need | Existing component reused | Why it is the right one |
|---|---|---|
| A URL-only search filter (read + write + navigate) | **`AssetTypeFilter.tsx`** — the ST-4 pattern: read via `paramsToSearchState(location.search)`, write via `searchStateToParams` + `navigate(searchPath()…)` | It is the *only* correct way to write the search URL — anything hand-rolled diverges byte-wise from the mirror and breaks `Search.tsx`'s equality loop-guard |
| The identity tuple | **`CurrentUserIdentityResolver`** verbatim | Already the single, security-context-only source for favorites; never returns empty (falls back to the shared sentinel) — so no my-objects-style short-circuit is needed |
| The `(asset_kind, asset_id)` correlated lookup | The **`favorite_identity_asset_key`** unique index (`V0_0_94`) | Exactly the 4-tuple an `EXISTS` / `NOT EXISTS` correlates on — an index-only probe per row, both directions |
| The "(shared)" labelling convention | **`FavoritesColumn.tsx:57`** — `isShared ? t('Favorites (shared)') : t('Favorites')` via `useAppInfo().authType` | Already the shipped convention on the sibling surface; a second phrasing would be a parallel surface with drift |
| The tri-state control | **`SingleFilterItem` / `FixedOptionsMultiFilter` are both wrong shapes** (facet-backed / multiselect-with-chips). A **new** `FixedOptionsSingleFilter` sibling is justified: same `Input` + `Autocomplete` + label idiom, single value, no chips | One sentence of justification per the reuse rule: no single-select fixed-option filter exists, and forcing a tri-state through a chip multiselect would render "All/Yes/No" as removable chips — wrong affordance |

### (b) ADR check

`adrs/drafts/unified-asset-search.md` governs. **D2 (live semi-join)** is directly on point: per-caller
predicates are evaluated live against the source table, never denormalised onto `asset_search_entrypoint` —
which is exactly right here, because a favorite is *per user* and the entrypoint row is *per asset*. **D9
(no breaking change)** holds: `/api/search` is untouched. **D10 (the URL is the search's source of truth)** is
why `favorites` is a URL param, not redux state. **D12 (keyset vs relevance paging)** is the constraint that
shapes R5 (below). **No new ADR is warranted** — this slice conforms; it establishes no new pattern.

### (c) The change, surface by surface

- **D1 — `favorites` is a URL-only param**, like `sort` / `asset_kinds`, not a redux facet: it has no
  server-aggregated counts and no `SearchFacetNames` key. **Consequence (the #1858 trap): it MUST be added to
  the `Search.tsx:110-115` merge-back.** This is the one wiring point that fails silently.
- **D2 — wire contract:** `AssetSearchFormData.favorites: boolean` (optional; absent = All). On
  `AssetSearchFormData`, **not** `SearchFormData` — only the unified path honours it, exactly as `asset_kinds`
  does. URL spelling stays human-readable per the issue: `?favorites=yes|no`, mapped fail-closed (anything else
  -> absent -> All), mirroring the `sort` allow-list.
- **D3 — the predicate**, cross-kind uniform (unlike my-objects, which is DE-only, because `favorite` is keyed
  on the polymorphic pair):
  `EXISTS (SELECT 1 FROM favorite WHERE oidc_username=? AND provider=? AND deleted_at IS NULL AND asset_kind = a.asset_kind AND asset_id = a.asset_id)`
  and `NOT EXISTS (…)` for No. Correlated on the unique 4-tuple index -> an anti-join, not a materialised
  `NOT IN` (which would also be NULL-unsafe).
- **D4 — identity threading:** one new nullable parameter, a `FavoritesScopeDto(String oidcUsername, String
  provider, boolean favorited)` record — `null` = no narrowing — added to `keysetPage` / `relevancePage` /
  `count` and to `conditions(...)`. Resolved once in `AssetSearchServiceImpl` from `CurrentUserIdentityResolver`.
  Mirrors how the nullable `OwnerPojo owner` already flows.
- **D5 — the sidebar control:** a new `FavoritesFilter.tsx` under `Search/Filters/`, rendered in `Filters.tsx`
  next to `AssetTypeFilter`, on the `AssetTypeFilter` read/write pattern, with the `Favorites (shared)`
  label under DISABLED. Cleared by the single **Clear All** (it is a filter) — so `handleClearAll` in
  `Filters.tsx:35-39` must drop it, which its current `{query, sort, myObjects}`-preserving rebuild already
  does for free; verified, and asserted by a test rather than assumed.
- **D6 — the tab retirement.** Delete `Favorites.tsx`, `FavoritesListItem/**`, `FavoritesAssetTypeFilter/**`
  (+ its test), `routes/favoritesRoutes.ts` and its `routes/index.ts` export, the `App.tsx:63` route, and the
  `ToolbarTabs.tsx:41-45` entry. **Subtract-before-add:** the symbol census (run against `origin/main`) shows
  `FAVORITES_TABLE_COLS`, `favoriteAssetNamespace` and `favoriteAssetUpdatedAt` become dead with the list item,
  and `favoriteAssetDescription` is **already** dead in production code (only its own unit test references it —
  it was the Group-B seed). All four go, with their tests. **Kept** (still used by the panel / search results /
  recently-viewed): `favoriteAssetId`, `favoriteAssetName`, `favoriteAssetLink`, `assetKindSingularLabel`,
  `ASSET_KIND_OPTIONS`, the whole redux favorites slice/thunks, and `FavoriteStar`.
- **D7 — the panel rewire:** `FavoritesColumn.tsx:95` `to={favoritesPath()}` -> the canonical serialiser
  (`searchPath()` + `searchStateToParams({…, favorites:'yes'})`), never a hand-written string — same reason as
  D1.

### (d) Impact-dimension checklist

| Dimension | Handled |
|---|---|
| i18n | **All 7 locales** (`br ch en es fr hy ua`) for every new string — never en-only-plus-backlog (LSN-035) |
| Generated clients | BE + FE OpenAPI codegen both regenerate off `components.yaml`; BE needs `rm -rf build/generated` (the `$ref`'d `components.yaml` is not tracked as a Gradle input — `reference_odd_platform_activity_event_and_spec_codegen`) |
| Consumers of changed signatures | 3 repository methods (interface + impl + their tests) — the only callers are `AssetSearchServiceImpl` and the repository's own tests |
| Migrations | **None.** `favorite` + both indexes ship in `V0_0_94` |
| Docs | `favorites.md` (the tab section is now false) + `search.md` (a new filter) on `release/1.0.0` |
| Ontology | `/enrich --touched` on the asset-search nodes — **subject to `lineage/**` being unclaimed** (ctrib060 is co-active) |
| Tests | Unit (predicate + identity scoping + fail-closed parse + mirror-merge) **and** integration (`IT-148` re-grounded — it currently drives `/favorites` in 3 of 4 tests) |

### (e) Product-Owner / SRE lens

- **PO:** the retirement is *net positive* — it removes a parallel surface with its own duplicate asset-type
  facet, and returns favorites to the one place users already search. The one thing the tab did better is
  ordering (R5). The empty-state teaching line (*"Star an asset to pin it here."*) is also lost; the filter's
  zero-result state should carry it, which costs one string and reuses `EmptyContentPlaceholder`.
- **SRE:** the anti-join is the only new cost on a hot path. It is a correlated `NOT EXISTS` on a unique index,
  evaluated per candidate row — bounded, but it must be **measured** (`EXPLAIN (ANALYZE, BUFFERS)`), not
  asserted. That measurement is a gate in §7, not a footnote.

## 6. GATE-1 decision — the one thing the issue does not settle

Everything above is decided. **One question needs the maintainer**, because it is a product trade-off the issue
is silent on and the answer changes what gets built.

**In plain language:** the Favorites tab you are retiring shows your starred assets **newest-starred first**.
The search page cannot do that — with no search text it orders by status, then by internal id. So after this
change, a user who stars something today may find it buried in the middle of their favorites list. The
published manual (`favorites.md`) states the newest-first behaviour as a promise, so shipping without it makes
a live doc page wrong.

| Option | What the user gets | Cost | Risk of not doing it |
|---|---|---|---|
| **A (recommended) — add a "Recently favorited" ordering**, offered in the sort dropdown only when Favorites=Yes is active, and used as the default in that state (with no text query) | Identical to today's tab. The promise in the manual stays true | **~1 day** (measured against the real code, not estimated from the description — see the note below) | — |
| **B — ship the filter as specified; accept status-priority ordering** | Favorites are findable, but not newest-first | Zero | A documented promise becomes false; the manual must be edited to retract it; a user with many favorites loses the "what did I just star" affordance |
| **C — keep the tab as well as the filter** | Nothing is lost | Zero build, permanent duplication | Contradicts the issue and the #1825 thesis; leaves the duplicate asset-type facet in place |

**What Option A actually costs — read out of the code, not guessed.** `relevancePage` already orders by the
generic `orderFields(state)` (`ReactiveAssetSearchRepositoryImpl:87-99`), so routing a new sort to the
offset pager needs no new pager and no `AssetSearchPageRow` change. The ordering itself is a **correlated
scalar subquery in `ORDER BY`** — `(SELECT f.created_at FROM favorite f WHERE f.oidc_username=? AND
f.provider=? AND f.deleted_at IS NULL AND f.asset_kind = a.asset_kind AND f.asset_id = a.asset_id) DESC` —
which resolves on the same unique index the predicate already probes and therefore needs **no change to
`searchFrom()`** (no new join, so every other query keeps its exact plan). The one genuine trap: the
repository's `effectiveSort(state)` and the service's `SearchSortDto.resolveEffective(...)` must return the
same answer or the cursor scope, the keyset-vs-offset choice and the `ORDER BY` disagree — the code comments
at `:52` and `AssetSearchServiceImpl:62-64` say so explicitly. Since the favorites scope is already being
threaded into all three repository methods, both sides read it from the same value; a unit test pins the
agreement. That trap is the reason this is a day and not an afternoon.

**Recommendation: A.** It is the difference between *moving* a feature and *degrading* it, the index was
already built for exactly this ordering, and B forces a same-release retraction of a page we wrote this cycle.

## 7. `## Plan`

Ordered, with the GATE-1 answer folded in at step 3.

1. **Spec** — `components.yaml`: add `favorites` (optional boolean, described) to `AssetSearchFormData`.
   Regenerate BE (`rm -rf build/generated` first) + FE clients.
2. **Backend predicate** — `FavoritesScopeDto` record; thread it through `ReactiveAssetSearchRepository`
   (`keysetPage` / `relevancePage` / `count`) into `conditions(...)` as `EXISTS` / `NOT EXISTS`;
   `AssetSearchServiceImpl` resolves the identity via `CurrentUserIdentityResolver` **only when** `favorites`
   is present.
3. **(Option A only) Ordering** — `SearchSortDto.FAVORITED_AT`; an `ORDER BY favorite.created_at DESC` branch
   active only under a Yes-scope; routed to the offset pager; `resolveEffective` defaults to it when
   Favorites=Yes and there is no text query. Sort-dropdown option shown only in that state.
4. **URL state** — `searchUrlState.ts`: `SEARCH_FAVORITES_PARAM = 'favorites'`, `favorites?: 'yes' | 'no'` on
   `SearchUrlState`, fail-closed parse, serialise, and project into `searchUrlStateToAssetSearchFormData`.
5. **The mirror-merge (the #1858 trap)** — add `favorites: live.favorites` to the `Search.tsx` merge-back.
6. **The control** — `FixedOptionsSingleFilter` + `FavoritesFilter.tsx`; render in `Filters.tsx`; DISABLED
   label via `useAppInfo()`.
7. **Retire the tab** — delete the route, the toolbar entry, the page and its page-only components; remove the
   four now-dead `lib.ts` helpers and their tests.
8. **Rewire the panel** — `FavoritesColumn.tsx` `View all` -> the serialised `/search?favorites=yes`.
9. **i18n ×7** — every new string in `br ch en es fr hy ua`.
10. **Tests — both buckets.** Unit: the predicate (Yes/No/absent × 3 kinds), identity isolation, fail-closed
    param parse, the mirror-merge preservation (vitest), the sort default. Integration: **re-ground `IT-148`**
    — it drives `/favorites` in 3 of its 4 tests and its 4th test (`:159`, the Group-B Description column) is
    **already permanently RED on `main`** against an unimplemented feature. Re-point tests 1-3 at the search
    filter and resolve test 4 per §8. Add: the panel `View all` lands pre-filtered; a sidebar toggle preserves
    `favorites=yes`; `/favorites` no longer resolves.
11. **SRE measurement** — `EXPLAIN (ANALYZE, BUFFERS)` for Yes and No on a seeded corpus; recorded in this file.
12. **Docs on `release/1.0.0`** — rewrite the `favorites.md` "Favorites tab" section as the filter; add the
    filter to `search.md`'s facet list; paired backlog DOC item with `milestone: 1.0.0`.
13. **Ontology** — `/enrich --touched`, if and only if `lineage/**` is unclaimed at that point.

### `must_haves` (the plan contract — G-C19)

**User-observable truths** (each traces to a §4 acceptance line):

| # | Truth | Spec |
|---|---|---|
| T1 | With Favorites=Yes, the result list contains exactly the caller's starred assets, of every kind | R1 |
| T2 | With Favorites=No, it contains exactly the assets the caller has not starred | R1 |
| T3 | Two different signed-in users see different Favorites=Yes results from the same catalog | R2 |
| T4 | Under `auth.type=DISABLED` the filter is labelled `Favorites (shared)` | R3 |
| T5 | `/favorites` no longer resolves and no Favorites tab is shown | R4 |
| T6 | (Option A) With `?favorites=yes` and no query, the most-recently-starred asset is row 1 | R5 |
| T7 | The panel's `View all` lands on a search page already narrowed to favorites | R6 |
| T8 | Toggling any sidebar facet leaves an active Favorites filter in force | R7 |
| T9 | Every new label renders in each of the 7 locales | R8 |

**Artifacts** (path -> provides -> grep anchor):

| Artifact | Provides | Anchor |
|---|---|---|
| `odd-platform-specification/components.yaml` | the wire field | `favorites:` under `AssetSearchFormData` |
| `…/dto/FavoritesScopeDto.java` | the identity+direction value | `record FavoritesScopeDto` |
| `…/repository/reactive/ReactiveAssetSearchRepositoryImpl.java` | T1,T2 | `FAVORITE.OIDC_USERNAME` |
| `…/service/AssetSearchServiceImpl.java` | T3 | `currentUserIdentityResolver.resolve()` |
| `…/dto/SearchSortDto.java` | T6 | `FAVORITED_AT` |
| `…/lib/search/searchUrlState.ts` | T1,T2,T7 | `SEARCH_FAVORITES_PARAM` |
| `…/components/Search/Search.tsx` | **T8** | `favorites: live.favorites` |
| `…/components/Search/Filters/FavoritesFilter/FavoritesFilter.tsx` | T4 | `Favorites (shared)` |
| `…/components/Overview/…/FavoritesColumn/FavoritesColumn.tsx` | T7 | `searchStateToParams` |
| `…/locales/translations/{br,ch,en,es,fr,hy,ua}.json` | T9 | the new keys ×7 |
| `integration-tests/protocols/IT-148-*.md` + `e2e/specs/favorites-star-see-loop.spec.ts` | T5,T7,T8 | `favorites=yes` |

**key_links** (where this would silently half-work):

| From | To | Via | Silent failure if missing |
|---|---|---|---|
| a sidebar facet toggle | the preserved `favorites` param | `Search.tsx` merge-back | **the #1858 class** — the filter vanishes on the next click, with no error |
| `FavoritesColumn` `View all` | a narrowed search page | `searchStateToParams`, not a literal | a byte-divergent URL the mirror immediately rewrites, losing the filter |
| `AssetSearchFormData.favorites` | the SQL predicate | the `FavoritesScopeDto` threaded through all 3 repo methods | `count` disagreeing with the page -> a total that does not match the rows |
| the Yes scope | the `FAVORITED_AT` ordering | the join being present when that sort is chosen | an ordering that silently falls back, or an SQL error when Favorites is off |

**No scope-reduction language.** Nothing here is `v1`, `static for now`, or `wired later`.

## 8. The parked Group-B slice — disposition (the issue asks for this explicitly)

`origin/contrib/CTRIB-039-favorites-group-b @ 6295a925` is **one WIP commit containing 7 lines of
`components.yaml`** (a `FavoriteAsset.description` field) and **no implementation**. Its only consumer was the
Favorites tab's Description column — the surface this slice deletes.

**Disposition: OUT, and closed.** With the tab retired the column has no home; search result rows already carry
their own description rendering. Concretely, the permanently-RED `favorites-star-see-loop.spec.ts:159` that
pins it is **removed with the tab**, which also returns the `feature-complete` suite to green — the outcome the
pre-work note asked for. This is stated in the PR body and in the #1815 disposition comment.

## 9. Test ledger

| Gate | Status |
|---|---|
| Unit — full `:odd-platform-api:build` | pending Phase D |
| Unit — vitest (FE) | pending Phase D |
| Integration — `IT-148` re-grounded, GREEN on fix / RED on `ref:main` | pending Phase D |
| FULL regression (`run-regression.sh ctrib061`) | pending Phase D — **blocked on the heavy-e2e flock, held by co-active ctrib060** |
| `EXPLAIN (ANALYZE, BUFFERS)` Yes + No | pending Phase D |
| Docs read + authored on `release/1.0.0` | pending Phase D |
| Ontology `/enrich --touched` | pending Phase D (conditional on `lineage/**` being unclaimed) |

## 10. Parallel-stream coordination (three streams co-active)

Registered as `ctrib061` in `state/active-streams.yaml`. Namespace: worktree `../odd-platform-ctrib061`,
tag `odd-platform:odd-team-sut-ctrib061`, compose `ctrib061`, ports 18250/15650 — all verified free.
Phase A/C held **no** shared resource (read-only against `origin/main`).

| Stream | Work | Bearing on this slice |
|---|---|---|
| `ctrib060` | #1840 ST-6 query operators | **Holds the heavy-e2e flock** (`run-regression.sh`, pid 248842 since 23:39:22). My Phase-D regression queues behind it — `run-regression.sh` blocks on the flock, so this is automatic, not a manual wait. Also mid-`/enrich`, so `lineage/**` (R9) is treated as claimed |
| `ctrib062` | #1842 **ST-8 — My-data filter + retire the My-Objects tab + rewire 3 home panels** | **The structural twin of this slice**, and the real coordination point |

**The ST-8 overlap, stated precisely.** ST-7 and ST-8 do the same four things to the same four files: add a
URL-only param to `searchUrlState.ts`, register it in the `Search.tsx` merge-back, add a single-select fixed-option
filter to `Filters.tsx`, and retire a tab + rewire its home panel. Two consequences:

1. **A shared component.** Both need the `FixedOptionsSingleFilter` that §5(a) justifies (ST-8's
   All / My Objects / Upstream / Downstream is also single-select over a fixed set). Whichever slice lands
   first should build it as a general sibling of `FixedOptionsMultiFilter` — not a Favorites-specific control —
   so the second reuses rather than forks it. This plan builds it that way regardless of merge order.
2. **Textual conflicts, not design conflicts.** The merge-back block and the `Filters.tsx` render list will
   each take one added line from both slices. That is a trivial rebase, and it is the *expected* shape — it
   needs no sequencing decision, only awareness.

Nothing here blocks GATE 1. It is recorded so the second slice to reach Phase D does not re-derive it.

## 11. Follow-ups logged on disk (`playbooks/follow-up-on-disk.md`)

| Item | What | Why it is not fixed here |
|---|---|---|
| **`issues/odd-platform/PLT-256`** | **"Save current search" silently drops the Asset-type filter.** `SavedSearch.spec` is typed `SearchFormData`, which has no `asset_kinds` — so ST-4's Asset-type narrowing is dropped on capture *and* on reapply, with no warning. Found while mapping this slice's URL-param census; grepped the backlog + `issues/odd-platform/` first — untracked | A pre-existing, already-shipped defect in ST-3×ST-4, not caused by ST-7. Fixing it means a **contract** change (`SavedSearch.spec` -> `AssetSearchFormData`) plus a migration-free data question — out of this slice's approved scope (G-C5) |

**This slice inherits that gap by construction:** `favorites`, like `asset_kinds`, is a URL-only dimension on
`AssetSearchFormData`, so a saved search will not capture it either. That is *consistent* with the shipped
behaviour rather than a new regression, and PLT-256 fixes both at once. Called out in the PR body so the
maintainer sees the inheritance, not just the new field.
