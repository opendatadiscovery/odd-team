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
| Epic? | **No** (G-C18 does not fire). #1841 is already a decomposed slice — ST-7 of the #1825 search-overhaul roadmap, whose siblings ST-1..ST-6 each shipped as one PR. It does **split once more**, into ST-7 (the filter) + ST-7b (the ordering) — §6.2. That is a GATE-1 decision put to the maintainer, not a unilateral narrowing |
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
retired is the only surface that lists the **full** favorites set **most-recently-favorited first**, and the
published manual promises exactly that (`favorites.md:33`). See §4 R5 / §6.2.

> **Corrected during the plan-check.** An earlier revision of this record said the tab was the *only* surface
> ordering favorites newest-first. That is false: the Overview panel does too — `ReactiveFavoriteRepositoryImpl.java:83`
> orders `created_at DESC, id DESC` and `FavoritesColumn.tsx:35` fetches page 1 × 5, which `favorites.md:29`
> documents as "the five most-recently-favorited". The accurate cost of losing the ordering is therefore
> **the full list**, not the top five — the maintainer was being asked to decide on an overstated premise.

## 4. `## Spec` — the falsifiable WHAT (G-C17)

Grounded in: the source at `82e7e70e`; the live manual on the `release/1.0.0` train
(`docs/data-discovery/favorites.md`, `docs/data-discovery/search.md`); `IT-148`; `#1815` (the parent PRD).

| # | Requirement | Current | Target | Acceptance (falsifiable) |
|---|---|---|---|---|
| **R1** | A Favorites narrowing on the unified cross-kind search | No favorites predicate exists on `/api/search/assets` (verified: zero `FAVORITE` references in `ReactiveAssetSearchRepositoryImpl`) | `AssetSearchFormData.favorites` (optional boolean; absent = All) narrows the result set for **every** asset kind | `POST /api/search/assets {"favorites":true}` returns exactly the caller's starred assets; `false` returns exactly the unstarred ones; absent returns both. Asserted per-kind (DATA_ENTITY + TERM + QUERY_EXAMPLE) |
| **R2** | Per-user scoping, ownership-free | n/a | The predicate keys on `(oidc_username, provider)` from `CurrentUserIdentityResolver` **only** — never a request parameter, never the internal Owner | A unit test proves two identities see disjoint results from the same corpus, and that the identity is taken from the security context (a caller cannot ask for another user's favorites) |
| **R3** | `auth.type=DISABLED` = one shared bucket, **labelled** | The tab renders `Favorites (shared)` + a warning paragraph; the panel renders `Favorites (shared)` | The filter's visible label is `Favorites (shared)` under DISABLED and `Favorites` otherwise — reusing the panel's exact existing convention (`FavoritesColumn.tsx:44`; the `isShared` computation is at `:32`). **Verified: both keys already exist, translated, in all 7 locale files — R3 adds no i18n work at all** | Under `AUTH_TYPE=DISABLED` the sidebar filter's label reads `Favorites (shared)`; the resolver returns the `(__shared__, DISABLED)` sentinel |
| **R4** | The `/favorites` tab is gone — **without stranding anyone who bookmarked it** | A top-level route + toolbar tab + a bespoke page with its own duplicate asset-type facet | The toolbar tab, the page component and every component only the page used are **deleted**. `/favorites` is **not** deleted outright: `App.tsx` has no catch-all route (verified — no `path='*'`, no `Navigate` anywhere in the file), so a bare deletion renders the toolbar over a blank area for every existing bookmark. It becomes a `<Navigate replace>` to the pre-filtered search | No toolbar tab named Favorites; no `Favorites` page component; visiting `/favorites` lands on the pre-filtered search, not a blank screen. (`favoritesPath` deliberately survives as the redirect's source — so "`git grep favoritesPath` returns nothing" is **not** the test) |
| **R5** | Finding a favorite again is **not worse** than before, **by the time 1.0.0 publishes** | The tab lists the full favorites set **most-recently-favorited first** (`favorites.md:33`), served by the existing index `favorite_identity_created_active_idx` | A `FAVORITED_AT` ordering, defaulted when the Favorites scope is on with no text query. **GATE-1 decision 2 (§6.2): this requirement is satisfied by a sibling slice (ST-7b), not by this PR** — it re-opens the ST-5 cursor-pagination engine (see §6.2 for the eight call sites) | With `?favorites=yes` and no query, the most-recently-starred asset is row 1. **Verified at the 1.0.0 release gate, across ST-7 + ST-7b** — the docs describing it publish only at that release, so nothing user-visible regresses in between |
| **R6** | The panel deep-links pre-filtered | `FavoritesColumn.tsx:95` links `View all` -> `/favorites` | It links to `/search?favorites=yes` | Clicking `View all` lands on the search page with the Favorites filter active and the list narrowed |
| **R7** | The filter survives every other control | n/a | `favorites` is merged back in the `Search.tsx` facet->URL mirror alongside `sort` / `assetKinds` / `entityClasses` | Toggling **any** sidebar facet with `?favorites=yes` active leaves `favorites=yes` in the URL and the narrowing in force (the #1858 regression class) |
| **R8** | i18n | n/a | Every new visible string exists **and is translated** in all 7 locale files | Run the repo's **existing** guard — `odd-platform-ui/src/locales/__tests__/i18n-key-parity.test.ts`, which asserts every `t('literal')` in `src` exists in `en.json` **and** that each non-en catalog holds exactly en.json's keys (no missing, no orphan) — and cite its result. **It is a vitest test and CI does not run the FE suite** (`run-pr-tests.yaml:58` is `./gradlew odd-platform-api:build … -PbundleUI=false`; `run-playwright-tests.yml:77`'s `npm run test:ci` is commented out), so a missing locale key goes RED **only if we run it ourselves** |
| **R9** | The zero-result state still **teaches the star** | The tab's empty state reads *"Star an asset to pin it here."* — it is how a first-time user learns what the star does | With the Favorites scope on and nothing starred, the results area carries that same teaching line, not a bare "no results" | Favorites scope on + zero favorites -> the teaching text is rendered (asserted, not eyeballed) |
| **R10** | The DISABLED **consequence** survives, not just the state | The tab shows a full warning paragraph: favorites are shared by everyone on the instance | The `(shared)` label keeps the *state*; ODD's shipped inline-help idiom (`InformationIcon` + `AppTooltip`, ADR-0076) carries the *consequence* sentence beside it | Under DISABLED the filter shows the info icon and its tooltip states that anyone on the instance can see and remove these stars |

**In scope:** the favorites predicate + its wire contract (UI shape per GATE-1 decision 1 — the backend is identical either way); identity threading; the sidebar control; the URL
param + mirror-merge; the tab retirement + dead-code removal; the panel rewire; the re-grounding of `IT-148`;
docs on the `release/1.0.0` train; i18n ×7.

**Out of scope (explicit exclusions — G-C5):** favoriting itself (star, `favorite` table, `/api/favorites/*`
write + list API, the Overview panel's own list — all untouched); the legacy `/api/search` session path and the
per-kind searches (they gain no `favorites` — same posture as `asset_kinds`, ADR D9); My-Objects retirement
(ST-8); cross-kind facet application (ST-11); the parked Group-B Description column (§8).

> **Correction, round 2 of the plan-check.** An earlier revision of R8 asserted that *nothing* in the repo
> performs i18n key parity — and asserted it as "checked". It was wrong: I grepped `.github/workflows`,
> `odd-platform-ui/package.json` and `scripts/`, and never grepped the test tree, which is where the guard
> lives. The right move is the reuse one (G-C12): **run the guard that already exists**, not hand-roll a
> parallel diff beside it. Only the narrower CI half of the claim survives, and it is now stated line-by-line.

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
| The control | Depends on GATE-1 decision 1 (§6.1). **Toggle (recommended): no new component at all.** **Tri-state:** a new `FixedOptionsSingleFilter` — and it must be modelled on **`SingleFilterItem`**, which renders `AppSelect` + `AppMenuItem` (`SingleFilterItem.tsx:6,41-45`), **not** the `Input`+`Autocomplete` idiom an earlier revision of this record wrongly attributed to it. An Autocomplete-based tri-state would sit visually out of step with its immediate neighbours Datasource and Namespace | `FixedOptionsMultiFilter` is a multiselect-with-chips — it would render "All/Yes/No" as removable chips, the wrong affordance. The correction above came from the plan-check; the original claim was made without reading `SingleFilterItem` |

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
  the merge-back object at `Search.tsx:101-106`** (`const live` at `:100`). This is the one wiring point that
  fails silently.
- **D2 — wire contract:** `AssetSearchFormData.favorites: boolean` (optional; absent = All). On
  `AssetSearchFormData`, **not** `SearchFormData` — only the unified path honours it, exactly as `asset_kinds`
  does. URL spelling stays human-readable per the issue: `?favorites=yes|no`, mapped fail-closed (anything else
  -> absent -> All), mirroring the `sort` allow-list.
- **D3 — the predicate**, cross-kind uniform (unlike my-objects, which is DE-only, because `favorite` is keyed
  on the polymorphic pair):
  `EXISTS (SELECT 1 FROM favorite WHERE oidc_username=? AND provider=? AND deleted_at IS NULL AND asset_kind = a.asset_kind AND asset_id = a.asset_id)`
  and `NOT EXISTS (…)` for the negative direction. Correlated on the unique 4-tuple index -> an anti-join, not
  a materialised `NOT IN` (which would also be NULL-unsafe). Type-compatible: `favorite.asset_kind` and
  `asset_search_entrypoint.asset_kind` are both `varchar(64)` (`V0_0_94:11`, `V0_0_98:29`).
  **`searchFrom()` (`ReactiveAssetSearchRepositoryImpl:244-255`) is deliberately NOT touched** — a correlated
  `EXISTS` adds no join, so every other query keeps its exact plan. This is also why the ordering cannot ride
  this slice: `EXISTS` does not expose `favorite.created_at` to `orderFields()` (§6.2).
- **D4 — identity threading:** one new nullable parameter, a `FavoritesScopeDto(String oidcUsername, String
  provider, boolean favorited)` record — `null` = no narrowing — added to `keysetPage` / `relevancePage` /
  `count` and to `conditions(...)`. Resolved once in `AssetSearchServiceImpl` from `CurrentUserIdentityResolver`.
  Mirrors how the nullable `OwnerPojo owner` already flows.
- **D5 — the sidebar control:** a new `FavoritesFilter.tsx` under `Search/Filters/`, rendered in `Filters.tsx`
  next to `AssetTypeFilter`, on the `AssetTypeFilter` read/write pattern, with the `Favorites (shared)`
  label under DISABLED. Cleared by the single **Clear All** (it is a filter) — so `handleClearAll` in
  `Filters.tsx:35-39` must drop it, which its current `{query, sort, myObjects}`-preserving rebuild already
  does for free; verified, and asserted by a test rather than assumed.
- **D6 — the tab retirement, with the URL kept alive.** Delete `Favorites.tsx`, `FavoritesListItem/**`,
  `FavoritesAssetTypeFilter/**` (+ its test) and the `ToolbarTabs.tsx:41-45` entry. **`routes/favoritesRoutes.ts`
  and its `routes/index.ts` export STAY, and `App.tsx:63` is *replaced*, not removed**, by a `<Navigate replace>`
  to the pre-filtered search: `App.tsx` has no catch-all (verified — no `path='*'`, no `Navigate` in the file),
  so deleting the route outright renders the toolbar over a blank area for every existing bookmark — exactly
  what R4 exists to prevent, and what ADR principle 3 ("migrate without stress") forbids. **Subtract-before-add:** the symbol census (run against `origin/main`) shows
  `FAVORITES_TABLE_COLS`, `favoriteAssetNamespace` and `favoriteAssetUpdatedAt` become dead with the list item,
  and `favoriteAssetDescription` is **already** dead in production code (only its own unit test references it —
  it was the Group-B seed). All four go, with their tests. **Kept** (still used by the panel / search results /
  recently-viewed): `favoriteAssetId`, `favoriteAssetName`, `favoriteAssetLink`, `assetKindSingularLabel`,
  `ASSET_KIND_OPTIONS`, the whole redux favorites slice/thunks, and `FavoriteStar`.
- **D7 — the panel rewire:** `FavoritesColumn.tsx:95` `to={favoritesPath()}` -> the canonical serialiser
  (`searchPath()` + `searchStateToParams({…, favorites:'yes'})`), never a hand-written string — same reason as
  D1. (The `(shared)` label convention this slice reuses **renders** at `FavoritesColumn.tsx:44`, off the
  `isShared` computed at `:32` — not `:57`, as an earlier revision of this record wrongly stated.)
- **D9 — `my_objects` × `favorites` composition.** `AssetSearchServiceImpl:64-71` resolves the my-objects
  owner inside a reactive branch that early-returns an empty page when no owner resolves. A second identity
  resolution must **compose** with that, not sit beside it: resolve the favorites identity first (it never
  emits empty — `CurrentUserIdentityResolver` falls back to the shared sentinel), then enter the existing
  my-objects branch unchanged. Both scopes then apply as independent `AND` predicates.

### (d) Impact-dimension checklist

| Dimension | Handled |
|---|---|
| i18n | **All 7 locales** (`br ch en es fr hy ua`), translated, for every new string — never en-only-plus-backlog (LSN-035). Reduced by reuse: `Favorites`, `Favorites (shared)`, `All`, `Yes`, `No`, `Star an asset to pin it here.` already exist in all 7. The repo's `i18n-key-parity.test.ts` is the guard — **CI does not run the FE suite, so we run it and cite it** (R8) |
| Generated clients | BE + FE OpenAPI codegen both regenerate off `components.yaml`; BE needs `rm -rf build/generated` (the `$ref`'d `components.yaml` is not tracked as a Gradle input — `reference_odd_platform_activity_event_and_spec_codegen`) |
| Consumers of changed signatures | 3 repository methods (`keysetPage` / `relevancePage` / `count`) on the interface + impl, whose only production caller is `AssetSearchServiceImpl`; plus their tests. **With the ordering split out to ST-7b (§6.2), `SearchSortDto.resolveEffective` is NOT touched** — which matters, because it has **two** independent production call sites (`AssetSearchServiceImpl:61` and `ReactiveAssetSearchRepositoryImpl:238`) plus `SearchSortDtoTest`, and changing it would also pull in `AssetSearchCursorTest`, `AssetSearchKeysetPaginationTest`, `AssetSearchSortIntegrationTest`, `AssetSearchServiceIntegrationTest`, `AssetSearchControllerWebTest` and the FE `SearchSortMenu.test.tsx`. That census belongs to ST-7b |
| Migrations | **None.** `favorite` + both indexes ship in `V0_0_94` |
| Docs | `favorites.md` (the tab section is now false) + `search.md` (a new filter) on `release/1.0.0` |
| Ontology | `/enrich --touched` on the asset-search nodes — **subject to `lineage/**` being unclaimed** (ctrib060 is co-active) |
| Tests | Unit (predicate + identity scoping + fail-closed parse + mirror-merge) **and** integration. `IT-148` drives `/favorites` in **all four** of its tests (`favorites-star-see-loop.spec.ts:82,105,152,181`), so every one is affected: 1 and 3 re-grounded on the narrowing oracle, 2 retired with its subject, 4 deleted with the Group-B column (§7 step 9) |

### (e) Product-Owner / SRE lens

- **PO:** the retirement is *net positive* — it removes a parallel surface with its own duplicate asset-type
  facet, and returns favorites to the one place users already search. The one thing the tab did better is
  ordering (R5). The empty-state teaching line (*"Star an asset to pin it here."*) is also lost; the filter's
  zero-result state should carry it, which costs one string and reuses `EmptyContentPlaceholder`.
- **SRE:** the anti-join is the only new cost on a hot path. It is a correlated `NOT EXISTS` on a unique index,
  evaluated per candidate row — bounded, but it must be **measured** (`EXPLAIN (ANALYZE, BUFFERS)`), not
  asserted. That measurement is a gate in §7, not a footnote.

## 6. GATE-1 decisions — the two things the issue does not settle

Everything else is decided. **Two questions need the maintainer.** Both change what gets built, and the first
one **disagrees with the issue's own wording** — which is precisely the case G-C16 says must go to the human
rather than be silently absorbed.

Both are informed by an `odd-sme` consultation run for this slice:
`lineage/odd-platform/sme-consultations/2026-08-30-favorites-tab-to-filter-ia.md` (confidence HIGH). Its
checkable claims were re-verified here before use; one of its own caveats is corrected in §6.3.

### 6.1 Decision 1 — the filter's shape: the issue says **All / Yes / No**; the evidence says **on/off**

**In plain language:** "No" means *show me everything I have not starred*. Because a person stars tens of
assets out of thousands, that result is visually **indistinguishable from "All"** — the user selects a filter,
the list does not change, and the control looks broken. Meanwhile every use of the value people actually want
("just my starred ones") costs an extra click to get past a middle option nobody picks.

The SME survey found **no** comparable product exposing a tri-state for a personal boolean: DataHub ships
Views (a saved filter set activated from the search bar), Atlan and Secoda ship saved/filtered views, and
GitHub — the one verified product with a personal star list — ships a simple starred list plus sorting.

| Option | What the user gets | Cost |
|---|---|---|
| **A (recommended) — one "Favorites only" toggle**, labelled `Favorites (shared)` under DISABLED; off = All. **The wire contract stays the specced optional boolean**, so `favorites=false` remains expressible by API and URL at zero cost — nothing is lost, only the dead UI value goes | One click to the thing they want; no state that looks broken | *Less* than the issue's ask — no new single-select control is needed; it conforms to the existing personal-scope idiom |
| **B — All / Yes / No exactly as the issue specifies** | Literal compliance with the written AC | A new `FixedOptionsSingleFilter` control, plus a filter value whose selected state is indistinguishable from no filter |

**Recommendation: A.** Same capability, one fewer control to build, and no dead option on screen. If you
want the literal AC, say so and B ships instead — the backend is identical either way.

### 6.2 Decision 2 — the ordering: ship it as its own slice, or fold it in?

**In plain language:** the Favorites tab you are retiring lists your starred assets **newest-starred first**.
The search page cannot. With no search text it orders by status priority, and ties break on **internal catalog
id** — arbitrary *and stable*. So a freshly starred asset does not merely rank low: it lands at an unrelated
position **and never moves**, which is the opposite of "what did I just star". The manual states the
newest-first behaviour as a promise (`documentation@origin/release/1.0.0 favorites.md:33`, read first-hand).

**What changed since the first draft of this record — and it changes the recommendation.** I costed this at
"~1 day, one `ORDER BY` branch, offset-paged". The adversarial plan-check proved that wrong, and I verified
each point in the source. The ordering is not a branch; it re-opens the ST-5 cursor-pagination engine:

| Where | Why it must change | Evidence |
|---|---|---|
| `AssetSearchServiceImpl:77` | `final boolean relevance = sort == SearchSortDto.RELEVANCE` gates the pager choice, the depth cap (`:80`) and `nextCursor` (`:111-119`) | a new offset-paged sort must widen all four |
| `AssetSearchCursor:85,118,124` | `encode`/`decode` branch on `sort == RELEVANCE`. A `FAVORITED_AT` cursor falls into the **else** branch, emits `{"s":"FAVORITED_AT","k":null,"i":0}`, then fails `decode`'s `instanceof String` guard | **page 2 silently returns page 1, forever**, in an infinite scroll |
| `keysetSortValueField:198`, `seekBranchPredicates:170`, `outerOrderFields:209` | each has a `default ->` that silently falls back to `STATUS_PRIORITY` | if the pager is *not* widened, pages duplicate and skip rows |
| `SearchSortDto.resolveEffective:37` | called **twice, independently** — `AssetSearchServiceImpl:61` and `ReactiveAssetSearchRepositoryImpl:238`. The repository's copy reads only `FacetStateDto`, which does not carry `favorites` | the service would resolve `FAVORITED_AT` while the repository orders by `STATUS_PRIORITY` — breaking the invariant the code states verbatim at `AssetSearchServiceImpl:58-59` |
| `searchUrlState.ts:88-103` | `defaultSortForContext` mirrors the server default so the dropdown can display it, with a comment demanding lockstep updates | the sort control would **display the wrong ordering** — the FE-vs-BE contradiction class of PLT-176 |
| `SEARCH_SORT_OPTIONS`, `SearchSortMenu.tsx` + its test | a conditionally-offered sort option | — |

That is eight call sites across the engine that shipped as ST-5a, ST-5b and ST-5c — **three separate slices**.

**The decisive fact: splitting costs the user nothing.** The docs that promise newest-first publish at the
**1.0.0 release**, not at merge. As long as both slices land in 1.0.0, no operator ever sees the regression
and no page is ever wrong in public.

| Option | What ships | Consequence |
|---|---|---|
| **A (recommended) — ship the filter now; the ordering as ST-7b in the same milestone** | This PR: the filter, the retirement, the redirect, the panel, docs, tests. ST-7b: the `FAVORITED_AT` ordering, sized and scoped like its ST-5 siblings | Nothing regresses publicly (docs publish at 1.0.0). Each PR stays inside one reviewable context. The pagination engine is re-opened deliberately, with its own RED proofs — not as a rider on a filter PR |
| **B — fold the ordering into this PR** | One PR | ~20+ files, re-opens the cursor engine, and three of the plan-check's blockers live entirely inside it. This is the shape that produces a defect a reviewer has to find |
| **C — never do the ordering** | The filter only | The manual's promise must be retracted before 1.0.0, and the "what did I just star" workflow stays broken permanently |

**Recommendation: A.** Same end state as B by the release, in two slices each of which can be reviewed
properly. If you take A, I file ST-7b as a sub-issue for you before this PR opens, so the promise is tracked
and cannot be lost between slices.

### 6.3 What the SME added that is now folded into the spec above (no decision needed)

- **The teaching empty state** -> promoted from a design footnote to **R9**, an acceptance line with a test.
  The SME's point is well taken: as a §5(e) note it would be the first thing dropped under Phase-D pressure.
- **The DISABLED *consequence*** -> **R10**. `(shared)` preserves the state but loses "anyone on this instance
  can see and remove your star"; ODD's shipped `InformationIcon` + `AppTooltip` inline-help idiom carries it.
- **Discoverability** — a nav tab advertises a feature; a sidebar control does not. Mitigation is already in
  the plan (R6, the panel's `View all`), and the SME's condition is adopted: the control renders
  **unconditionally** in the Filters rail, never behind an "add a filter" affordance.
- **Nameability** — a saved search should be able to hold the favorites scope. It cannot today, for the same
  contract reason `asset_kinds` cannot: **PLT-256** (§11), logged during this slice.
- **Ontology gap** — `lineage/odd-platform/concepts.yaml` contains **zero** `favorit*` entries (verified:
  `grep -ci favorit` -> 0). Favorites is about to gain a search filter while remaining uncatalogued as a
  concept. Handled by the Phase-D `/enrich`, subject to the `lineage/**` lock.

**One SME caveat corrected.** It flagged that it could not read the `favorites.md` "most-recently-favorited
first" promise first-hand (no shell; the page is on the unmerged `release/1.0.0` branch) and asked that the
quote be verified before use. **It has been** — read directly from
`origin/release/1.0.0:docs/data-discovery/favorites.md:33`. The quote stands.

## 7. `## Plan`

Ordered. **The `FAVORITED_AT` ordering is NOT here** — it is ST-7b (§6.2, GATE-1 decision 2), which is what
keeps this slice inside one reviewable context.

1. **Spec** — `components.yaml`: add `favorites` (optional boolean, described) to `AssetSearchFormData`.
   **Also update the endpoint's own prose** — `openapi.yaml:966-974` enumerates the honored contract
   ("query + filters + sort + my_objects … plus an optional asset_kinds filter"); a new dimension absent from
   that line is undocumented at the contract's most-read point. Regenerate BE (`rm -rf build/generated` first)
   + FE clients. (`SearchFormData.sort`'s token list stays correct — no new sort ships here.)
2. **Backend predicate** — `FavoritesScopeDto` record; thread it through `ReactiveAssetSearchRepository`
   (`keysetPage` / `relevancePage` / `count`) into `conditions(...)` as `EXISTS` / `NOT EXISTS`, adding **no
   join** (D3). `AssetSearchServiceImpl` resolves the identity via `CurrentUserIdentityResolver` only when
   `favorites` is present, composed with — not beside — the existing my-objects branch (D9).
3. **URL state** — `searchUrlState.ts`: `SEARCH_FAVORITES_PARAM = 'favorites'`, `favorites?: 'yes' | 'no'` on
   `SearchUrlState`, fail-closed parse, serialise, and project into `searchUrlStateToAssetSearchFormData`.
4. **The mirror-merge (the #1858 trap)** — add `favorites: live.favorites` to the merge object at
   `Search.tsx:101-106`.
5. **The control** — `FavoritesFilter.tsx`, rendered **unconditionally** in `Filters.tsx`; label via
   `useAppInfo().authType` (`Favorites` / `Favorites (shared)`, both already translated ×7) plus the R10
   inline-help tooltip. Shape per GATE-1 decision 1; if tri-state, modelled on `SingleFilterItem`'s
   `AppSelect` + `AppMenuItem` (§5a). Backend identical either way.
6. **Retire the tab, without stranding bookmarks (R4)** — delete the toolbar entry, the page and its
   page-only components; **replace** the `App.tsx:63` route with a `<Navigate replace>` to the pre-filtered
   search (there is no catch-all route — verified — so a bare delete gives a blank screen). Remove the four
   now-dead `lib.ts` helpers and their tests.
7. **Rewire the panel** — `FavoritesColumn.tsx:95` `View all` -> the serialised `/search?favorites=yes`.
8. **i18n ×7** — every new string translated in `br ch en es fr hy ua`, then **run the repo's existing
   `odd-platform-ui/src/locales/__tests__/i18n-key-parity.test.ts`** and cite its result in the PR (CI does not
   run the FE suite, so this guard only fires if we fire it — R8). `Favorites` / `Favorites (shared)` /
   `Star an asset to pin it here.` / `All` / `Yes` / `No` already exist ×7.
9. **Tests — both buckets, each with a named RED-on-base oracle.**
   - **Unit (odd-platform CI):** the predicate — Yes / No / absent × DATA_ENTITY + TERM + QUERY_EXAMPLE (T1,T2);
     two identities see disjoint sets from one corpus (T3); the fail-closed `favorites` parse; the
     mirror-merge preservation (vitest, T8); `count` agrees with the page under both directions.
   - **Integration (odd-team `IT-148`, re-grounded).** **The oracle matters more than the assertion here.**
     A re-pointed "the starred asset is listed at `/search?favorites=yes`" is **GREEN on `ref:main`** — an
     unknown `favorites` param is dropped by `paramsToSearchState`, so the *unfiltered* search lists it too.
     That is the G-C15 neutered-test signature. So every favorites IT asserts **narrowing**:
     | Truth | Assertion | RED on `ref:main` because |
     |---|---|---|
     | T1,T2 | seed one starred + one **un-starred** asset; with the filter on, the starred one is listed **and the un-starred one is absent** | on base the filter is dropped -> the un-starred asset IS present |
     | T4 | under `AUTH_TYPE=DISABLED` the filter's label reads `Favorites (shared)` | on base there is no filter control at all |
     | T5 | `/favorites` lands on the pre-filtered search; no Favorites toolbar tab | on base it renders the tab |
     | T7 | the panel's `View all` lands pre-filtered and narrowed | on base it lands on `/favorites` |
     | T8 | with the filter on, toggling a sidebar facet leaves it in force and still narrowing | on base there is no filter to preserve |
     | T10 | filter on + zero favorites -> the teaching text, not "No matches found" | on base the tab owns that state |
     | T11 | under DISABLED the filter's inline-help tooltip states the shared-bucket consequence | on base there is no filter control at all |
   - **IT-148's four existing tests:** 1 and 3 (star -> find it again, for a DE and a Term) are re-pointed at
     the filter with the narrowing oracle above. **Test 2 is retired with the tab, not re-pointed** — its
     subject ("the *Favorites tab* uses the platform multi-select facet, not a checkbox group") ceases to
     exist, and its intent is already covered by the search sidebar's own `AssetTypeFilter` tests; the SoT for
     the deletion is the retirement itself, recorded in the protocol. **Test 4 is deleted with the tab** (§8) —
     it pins an unimplemented Group-B column and is **permanently RED on `main`** today, so its removal is
     what returns `feature-complete` to green.
10. **SRE measurement** — `EXPLAIN (ANALYZE, BUFFERS)` for both directions on a seeded corpus, recorded here.
    The anti-join is the one new cost on a hot path; it is measured, not asserted.
11. **Docs on `release/1.0.0`** — wider than the tab section, because three pages assert the tab:
    `favorites.md` **frontmatter `description:` (:2 — the published meta tag), the intro (:7), the panel
    paragraph (:29) and the tab section (:31-33)**; `catalog-overview.md:43` ("a **View all** link to the
    top-level Favorites tab"); and `search.md`'s facet list gains the filter. Paired backlog DOC item with
    `milestone: 1.0.0`.
12. **Ontology** — `/enrich --touched` on the asset-search nodes, plus the `concepts.yaml` favorites gap
    (§6.3). **Not conditional:** G-C10 makes it a Definition-of-Done gate. If `lineage/**` is still claimed by
    ctrib060 when Phase D reaches it, this slice **queues behind it and the PR stays `draft`** — it is never
    "skipped because the lock was busy".

### `must_haves` (the plan contract — G-C19)

**User-observable truths** (each traces to a §4 acceptance line):

| # | Truth | Spec | Covered by |
|---|---|---|---|
| T1 | With the Favorites scope on, the result list contains the caller's starred assets, of every kind | R1 | unit + IT (narrowing oracle) |
| T2 | The scope **genuinely narrows** — an asset the caller has not starred is absent from the filtered list | R1 | unit + IT (narrowing oracle) |
| T2b | The negative direction (not-starred-only) returns exactly the unstarred set | R1 | unit + API-level IT. **Conditioned on GATE-1 decision 1:** under the recommended toggle this is reachable by URL/API but has no UI control, so it is an API-level truth, not a rendered one; under the tri-state it is user-observable and gains a UI assertion |
| T3 | Two different signed-in users see different results from the same catalog | R2 | unit |
| T4 | Under `auth.type=DISABLED` the filter is labelled `Favorites (shared)` | R3 | IT |
| T5 | No Favorites tab; `/favorites` lands on the pre-filtered search rather than a blank screen | R4 | IT |
| T7 | The panel's `View all` lands on a search page already narrowed to favorites | R6 | IT |
| T8 | Toggling any sidebar facet leaves an active Favorites filter in force | R7 | vitest + IT |
| T9 | Every new label renders in each of the 7 locales | R8 | scripted parity diff |
| T10 | With the scope on and nothing starred, the results area teaches the star | R9 | IT |
| T11 | Under DISABLED the filter carries inline help stating anyone on the instance can see and remove these stars | R10 | vitest + IT |

**T6 (row 1 is the newest-starred) is deliberately absent — it is ST-7b's truth (§6.2), and R5's acceptance
is verified at the 1.0.0 release gate across both slices.**

**Artifacts** (path -> provides -> grep anchor):

| Artifact | Provides | Anchor |
|---|---|---|
| `odd-platform-specification/{components,openapi}.yaml` | the wire field + its prose | `favorites:` under `AssetSearchFormData` |
| `…/dto/FavoritesScopeDto.java` | the identity+direction value | `record FavoritesScopeDto` |
| `…/repository/reactive/ReactiveAssetSearchRepositoryImpl.java` | T1,T2 | `FAVORITE.OIDC_USERNAME` |
| `…/service/AssetSearchServiceImpl.java` | T3 | `currentUserIdentityResolver.resolve()` |
| `…/lib/search/searchUrlState.ts` | T1,T2,T7 | `SEARCH_FAVORITES_PARAM` |
| `…/components/Search/Search.tsx` | **T8** | `favorites: live.favorites` |
| `…/components/Search/Filters/FavoritesFilter/FavoritesFilter.tsx` | T4,T11 | `Favorites (shared)`, `InformationIcon` |
| `…/components/App.tsx` | **T5** | `<Navigate replace` on `favoritesPath()` |
| `…/components/Search/Results/Results.tsx` — the `EmptyContentPlaceholder` at `:203-207` | T10 | the favorites-scope branch of its `text` |
| `…/components/Overview/…/FavoritesColumn/FavoritesColumn.tsx` | T7 | `searchStateToParams` |
| `…/locales/translations/{br,ch,en,es,fr,hy,ua}.json` | T9,T10,T11 | the new keys ×7 |
| `integration-tests/protocols/IT-148-*.md` + `e2e/specs/favorites-star-see-loop.spec.ts` | T1,T2,T4,T5,T7,T8,T10 | `favorites=yes` + the absent-asset narrowing assertion |
| `integration-tests/suites.yaml` — IT-148 sits in **two** lanes (`feature-complete` `:16`, `ui-e2e` `:123`) and both carry a descriptive comment (`:22-25`, `:123`) naming it the "Favorites star->see loop" | the lane wiring stays truthful after re-grounding | `IT-148` |

**key_links** (where this would silently half-work):

| From | To | Via | Silent failure if missing |
|---|---|---|---|
| a sidebar facet toggle | the preserved `favorites` param | the `Search.tsx:101-106` merge object | **the #1858 class** — the filter vanishes on the next click, with no error |
| `FavoritesColumn` `View all` | a narrowed search page | `searchStateToParams`, not a literal | a byte-divergent URL the mirror immediately rewrites, losing the filter |
| `AssetSearchFormData.favorites` | the SQL predicate | `FavoritesScopeDto` threaded through **all three** repo methods | `count` disagreeing with the page -> a total that does not match the rows |
| an existing `/favorites` bookmark | the pre-filtered search | the `Navigate` replacing the deleted route | a blank content area under the toolbar — no 404, no message |
| the favorites IT | a real RED on base | asserting **absence of an un-starred asset**, not presence of a starred one | the test passes on the unfixed base and proves nothing (G-C15) |

**Two key_links verified as already-wired (traced, not assumed) — so the plan does NOT touch them:**

- **The request build.** Both fetch sites (`Results.tsx:93` scroll-extend, `:101` page 1) read one
  `assetSearchFormData` memo derived from `location.search` (`:85`).
- **The re-query trigger.** Changing `favorites` changes `searchStateToParams`' output, so `Search.tsx`'s
  `urlStateKey` changes, a fresh DE session is created, `searchFacetsSynced` flips, and the settle-effect
  re-fires page 1. Exactly the `asset_kinds` mechanism.

**No scope-reduction language.** Nothing here is `v1`, `static for now`, or `wired later`. ST-7b is a *named
sibling slice with its own tracked issue*, not a deferred shadow of this one — the distinction the plan-check
required, and the reason R5's acceptance is timed to the release gate rather than dropped.

### The scope comment to post at GATE-1 approval (G-C5), drafted

ASCII, self-contained, no workspace-internal IDs. Posted to #1841 immediately after approval, before any code.

```
Scope for the PR that will close this issue.

In this PR:
- A Favorites filter in the Catalog search sidebar, narrowing the cross-kind result set to
  the caller's starred assets. Per-user, keyed on the signed-in identity; under
  auth.type=DISABLED it is the shared instance-wide bucket and is labelled as such.
- The /favorites tab is retired. Its URL redirects to the pre-filtered search, so existing
  bookmarks and shared links keep working instead of landing on a blank page.
- The Catalog Overview Favorites panel's "View all" deep-links to the pre-filtered search.
- Docs and the favorites end-to-end test are updated to match.

Deferred to a sibling slice (ST-7b), NOT in this PR:
- "Recently favorited" ordering. The retired tab lists the full favorites set
  newest-starred-first; the search page cannot yet, because a per-user ordering has to be
  threaded through the cursor-pagination engine built in ST-5a/5b/5c - eight call sites
  across the pager, the cursor codec and the sort control. That is a change of the same
  size as its ST-5 siblings, so it ships as its own reviewable slice in this milestone
  rather than riding along here. Since the docs describing the ordering publish at the
  1.0.0 release and both slices target 1.0.0, nothing regresses for users in between.

Not touched:
- Favoriting itself: the star, the favorite table, the /api/favorites write and list
  endpoints, and the Overview panel's own list.
- The legacy /api/search path and the per-kind searches.

One thing found while working on this, reported separately: saving a search does not
capture the Asset-type filter, because the saved-search spec type has no field for it.
That is a pre-existing defect from the saved-search and asset-kind slices, not caused by
this change. A Favorites filter will be dropped by a saved search for the same reason
until it is fixed.
```

## 8. The parked Group-B slice — disposition (the issue asks for this explicitly)

`origin/contrib/CTRIB-039-favorites-group-b @ 6295a925` is **one WIP commit containing 7 lines of
`components.yaml`** (a `FavoriteAsset.description` field) and **no implementation**. Its only consumer was the
Favorites tab's Description column — the surface this slice deletes.

**Disposition: OUT, and closed.** With the tab retired the column has no home; search result rows already carry
their own description rendering. Concretely, the permanently-RED `favorites-star-see-loop.spec.ts:159` that
pins it is **deleted with the tab** (§7 step 9), which is what returns the `feature-complete` suite to green —
the outcome the pre-work note asked for. That deletion is not a weakened test under G-C15: the SoT is that the
surface it asserts ceases to exist. Stated in the PR body and in the #1815 disposition comment (§7, drafted).

## 9. Test ledger

Every row is RUN here before handoff. None may be recorded "NOT RUN" or "deferred to review".

| Gate | Status |
|---|---|
| Unit — full `:odd-platform-api:build` (test + checkstyle + assemble) | pending Phase D |
| Unit — the predicate cases, GREEN on fix / **RED on base**, both directions × 3 kinds | pending Phase D |
| Unit — FE vitest: mirror-merge preservation, fail-closed parse, the R10 inline help | pending Phase D |
| **`i18n-key-parity.test.ts`** — the repo's existing guard, run explicitly (CI does not) | pending Phase D |
| **Changed** existing tests — each needs a per-test SoT + a surviving RED on base (G-C15). Expected set, with the ordering split out: `FavoritesAssetTypeFilter.test.tsx` + `Favorites/__tests__/lib.test.ts` (deleted with their subjects), `searchUrlState.test.ts` (extended, never weakened) | pending Phase D — enumerate exactly before committing |
| Integration — `IT-148` re-grounded on the **narrowing** oracle (§7 step 9), GREEN on fix / RED on `ref:main` | pending Phase D |
| FULL regression (`run-regression.sh ctrib061`): `feature-complete` green · `multi-stack` green · `known-bugs` still-RED · `ingestion-e2e` green | pending Phase D — queues on the heavy-e2e flock (held by co-active ctrib060; `run-regression.sh` blocks automatically) |
| `EXPLAIN (ANALYZE, BUFFERS)` on both predicate directions, seeded corpus | pending Phase D |
| Local patch-coverage (jacoco + the 98% changed-lines check) | pending Phase D |
| Docs read + authored + committed on `release/1.0.0` (5 locations, §7 step 11) | pending Phase D |
| Ontology `/enrich --touched` + re-embed + commit | pending Phase D — queues behind ctrib060's `lineage/**` claim; **the PR stays `draft` until it runs** |
| UI screenshot of the rendered filter, reviewed as a user (G-C12 step 5) | pending Phase D |

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
