---
id: CTRIB-061
title: "ST-7 — Favorites filter (All / Yes / No) + retire the `/favorites` tab + rewire the Favorites panel"
github_issue: 1841
github_issue_url: https://github.com/opendatadiscovery/odd-platform/issues/1841
target_repo: odd-platform
milestone: "1.0.0"
status: plan-approved
classification: feature
stream_id: ctrib061
base_sha: 82e7e70e
branch: contrib/CTRIB-061-favorites-filter
plan_approved_by: "RamanDamayeu"
plan_approved_at: "2026-08-31"
reproduced: "n/a — feature slice, not a bug. The entry gate is spec-gate (G-C17), not reproduce-first."
docs_routing: "documentation@release/1.0.0 — favorites.md (frontmatter :2 + :7 + :29 + :31-33), catalog-overview.md (:43), search.md (unreleased behaviour, G-C11); paired item backlog/docs/DOC-503"
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
| "The mirror-merge trap (the #1858 bug class) … if URL-only, it must be added to that merge" | **REAL, and confirmed exactly.** `Search.tsx:100-106` rebuilds the URL from the redux facet state and merges back precisely three URL-only params — `entityClasses`, `sort`, `assetKinds`. A fourth URL-only param that is not added there is silently dropped by **any** sidebar facet toggle. This is the single highest-risk wiring point in the slice |
| "The backend is mostly assembled. `CurrentUserIdentityResolver` + the favorites semi-join pattern **already serve** `/api/search/assets` (#1856)" | **WRONG on the load-bearing half.** `ReactiveAssetSearchRepositoryImpl` contains **no** reference to `favorite` or to the identity tuple; its only per-caller predicate is my-objects, keyed on the **internal `OwnerPojo`** (`:305-310`) resolved via `AuthIdentityProvider.fetchAssociatedOwner()` (`AssetSearchServiceImpl:67`) — a *different* identity axis from favorites' `(oidc_username, provider)`. `CurrentUserIdentityResolver` is used by the favorites/recently-viewed services, **never** by the search stack. So this slice must **thread a new identity parameter** through 3 repository methods + the service. It is not "a predicate on existing machinery" |
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
| The "(shared)" labelling convention | **`FavoritesColumn.tsx:44`** — `isShared ? t('Favorites (shared)') : t('Favorites')`, off the `isShared` computed from `useAppInfo().authType` at `:32` | Already the shipped convention on the sibling surface; a second phrasing would be a parallel surface with drift |
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
| Docs | On `release/1.0.0`: `favorites.md` (**four** locations — the frontmatter `description:` at `:2`, which is the published meta tag, plus `:7`, `:29`, `:31-33`), `catalog-overview.md:43`, and `search.md`'s facet list. Paired backlog item **DOC-503** (`milestone: "1.0.0"`) is the release-gate hook |
| Ontology | `/enrich --touched` on the asset-search nodes + the `concepts.yaml` favorites gap. **A Definition-of-Done gate, not optional (G-C10):** if `lineage/**` is still claimed by ctrib060 it **queues**, and the PR stays `draft` until it runs — never skipped because the lock was busy |
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

**The decisive fact: splitting costs the user nothing — and the evidence is stronger than doc timing.**
**Favorites has never shipped.** `Favorites.tsx` and `V0_0_94__create_favorite.sql` are both absent from
**0.29.0, 0.28.0 and 0.27.13** (checked with `git cat-file -e` against each tag) — the whole feature exists
only on `main`, heading for 1.0.0. And `docs/data-discovery/favorites.md` is **absent from
`documentation@origin/main`**, present only on `origin/release/1.0.0`. So there is no operator on any
published release who can experience the missing ordering, and no live page asserting the promise. The
"regression" exists only between two unreleased slices of the same milestone.

| Option | What ships | Consequence |
|---|---|---|
| **A (recommended) — ship the filter now; the ordering as ST-7b in the same milestone** | This PR: the filter, the retirement, the redirect, the panel, docs, tests. ST-7b: the `FAVORITED_AT` ordering, sized and scoped like its ST-5 siblings | Nothing regresses publicly (docs publish at 1.0.0). Each PR stays inside one reviewable context. The pagination engine is re-opened deliberately, with its own RED proofs — not as a rider on a filter PR |
| **B — fold the ordering into this PR** | One PR | ~20+ files, re-opens the cursor engine, and three of the plan-check's blockers live entirely inside it. This is the shape that produces a defect a reviewer has to find |
| **C — never do the ordering** | The filter only | The manual's promise must be retracted before 1.0.0, and the "what did I just star" workflow stays broken permanently |

**Recommendation: A.** Same end state as B by the release, in two slices each of which can be reviewed
properly.

**How ST-7b is kept from being lost — the mechanism, already on disk, not a promise.** The bot is
policy-barred from creating GitHub issues (`playbooks/github-write.md`; G-C18), so "I'll file it" would not
have been a mechanism at all. Two artefacts do the job instead:

- **`issues/odd-platform/PLT-257`** — a **paste-ready** ST-7b sub-issue (ASCII, suggested milestone 1.0.0, no
  milestone self-assigned) for you to file under #1825 whenever you choose.
- **`backlog/docs/DOC-503`, carrying `milestone: "1.0.0"`** — this is the part that actually enforces R5. The
  1.0.0 release gate derives its manifest by `grep -rl 'milestone: "1.0.0"' backlog/ contributor/`
  (`playbooks/release-train-merge.md`), so this item **forces the gate to reconcile** `favorites.md`'s
  ordering sentence against what actually merged: keep the claim if ST-7b shipped, drop it if it did not.
  Verified working — that exact grep returns `backlog/docs/DOC-503.md` today.

So R5's "verified at the 1.0.0 release gate" is enforceable by a mechanism that already exists, rather than by
an intention that could evaporate between slices.

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
  concept. Handled by the Phase-D `/enrich`, which is a Definition-of-Done gate: if `lineage/**` is still
  claimed it queues and the PR stays `draft` (§7 step 12) — it is never skipped.

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
   `AppSelect` + `AppMenuItem` (§5a). Backend identical either way. **The control writes the URL through
   `searchStateToParams` + `navigate`, never a hand-built string** (the `AssetTypeFilter` pattern) — and T12's
   oracle drives it **by clicking**, so the write path is proven and not merely the read path.
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
     | T10 | filter on + zero favorites -> the teaching text, not "No matches found" | on base the `favorites` param is dropped, so the page is not even empty — it lists the whole catalog and the teaching text appears nowhere on it |
     | T11 | under DISABLED the filter's inline-help tooltip states the shared-bucket consequence | on base there is no filter control at all |
     | T12 | **click** the control (do not navigate): the URL gains `favorites=yes` and the list narrows | on base there is no control to click |
     | T2b | (API-level) `POST /api/search/assets {"favorites":false}` returns the unstarred set | on base the field does not exist, so the response is the unfiltered page |
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
    top-level Favorites tab"); and `search.md`'s facet list gains the filter.
    **The ordering sentence at `:33` is the seam of the split, so it is decided explicitly, not left to
    drift:** this PR rewrites `:31-33` as the *filter* and **drops the "most-recently-favorited first"
    claim**, because ST-7 alone does not deliver it and a page must not promise behaviour that is not there.
    **DOC-503** (`milestone: "1.0.0"`, the release-gate hook) then forces the 1.0.0 gate to put the claim back
    if ST-7b merged, or to confirm its absence if it did not. Neither outcome can be reached by accident.
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
| T2b | The negative direction (not-starred-only) returns exactly the unstarred set | R1 | unit + the API-level IT oracle in §7 step 9. **Conditioned on GATE-1 decision 1:** under the recommended toggle this is reachable by URL/API but has no UI control, so it is an API-level truth, not a rendered one; under the tri-state it is user-observable and gains a UI assertion |
| T3 | Two different signed-in users see different results from the same catalog | R2 | **unit only, deliberately** — the e2e stack is `odd-minimal` with `AUTH_TYPE=DISABLED`, i.e. one shared sentinel identity, so a two-identity proof is not expressible there; it needs the `multi-stack` LOGIN_FORM/LDAP lane. Not a missing mandatory IT under G-C9 |
| T4 | Under `auth.type=DISABLED` the filter is labelled `Favorites (shared)` | R3 | IT |
| T5 | No Favorites tab; `/favorites` lands on the pre-filtered search rather than a blank screen | R4 | IT |
| T7 | The panel's `View all` lands on a search page already narrowed to favorites | R6 | IT |
| T8 | Toggling any sidebar facet leaves an active Favorites filter in force | R7 | vitest + IT |
| T9 | Every new label renders in each of the 7 locales | R8 | the repo's `i18n-key-parity.test.ts`, run explicitly |
| T10 | With the scope on and nothing starred, the results area teaches the star | R9 | IT |
| T11 | Under DISABLED the filter carries inline help stating anyone on the instance can see and remove these stars | R10 | vitest + IT |
| T12 | **Clicking** the control (not navigating to a crafted URL) narrows the list and puts `favorites` in the address bar | R1,R7 | IT — one oracle drives the control by click, so the write path is proven, not just the read path |

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
| `…/components/Search/Filters/FavoritesFilter/FavoritesFilter.tsx` | T4,T11,T12 | `Favorites (shared)`, `InformationIcon` |
| `…/components/Search/Filters/Filters.tsx` | T4,T12 — renders the control **unconditionally** in the rail | `<FavoritesFilter` |
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
| a click on the Favorites control | the canonical search URL | `searchStateToParams` inside `FavoritesFilter`, never a hand-built string | a byte-divergent URL that `Search.tsx`'s mirror immediately rewrites — the control appears to do nothing, or flickers and reverts |

**Two key_links verified as already-wired (traced, not assumed) — so the plan does NOT touch them:**

- **The request build.** Both fetch sites (`Results.tsx:93` scroll-extend, `:101` page 1) read one
  `assetSearchFormData` memo derived from `location.search` (`:85`).
- **The re-query trigger.** Changing `favorites` changes `searchStateToParams`' output, so `Search.tsx`'s
  `urlStateKey` changes, a fresh DE session is created, `searchFacetsSynced` flips, and the settle-effect
  re-fires page 1. Exactly the `asset_kinds` mechanism.

**No scope-reduction language.** Nothing here is `v1`, `static for now`, or `wired later`. ST-7b is a *named
sibling slice with its own tracked issue*, not a deferred shadow of this one — the distinction the plan-check
required, and the reason R5's acceptance is timed to the release gate rather than dropped.

### GATE 1 — APPROVED 2026-08-31

**Maintainer (`RamanDamayeu`) decided both open questions, taking the recommendation on each:**

1. **Filter shape -> the "Favorites only" toggle** (§6.1 option A), not the issue's literal All / Yes / No.
   The wire contract stays the optional boolean, so `favorites=false` remains expressible by API and URL —
   the capability the issue asked for is retained; only the dead on-screen value is dropped. **This is less
   work than the AC states: no `FixedOptionsSingleFilter` is built.** §5(a)'s conditional control row and §7
   step 5's "if tri-state" branch both collapse to the toggle.
2. **Ordering -> its own slice, ST-7b, same milestone** (§6.2 option A). This slice ships the filter; the
   `FAVORITED_AT` ordering follows in 1.0.0. Tracking is already on disk and mechanically verified:
   `issues/odd-platform/PLT-257` (paste-ready sub-issue for the maintainer to file) +
   `backlog/docs/DOC-503` (`milestone: "1.0.0"` — the release-gate hook).

**Consequences folded into the plan:** T2b stays an API-level truth (no UI control for the negative
direction); T12's click-driven oracle drives the toggle; the docs prose describes a toggle and **drops** the
"most-recently-favorited first" claim, which DOC-503 forces the 1.0.0 gate to restore if ST-7b merges.

`plan_approved_by: RamanDamayeu` · `plan_approved_at: 2026-08-31`.

### The scope comment posted to #1841 (G-C5)

Posted immediately after approval, **before any code**. It states both divergences from the issue's written
AC — the toggle instead of All/Yes/No, and the deferred ordering — because the public thread must reflect the
actual PR scope, not just the workspace record. ASCII, self-contained.

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

Two deliberate departures from the AC as written, both agreed before any code:

1. The control ships as a single "Favorites only" toggle rather than an All / Yes / No
   tri-state. A person stars tens of assets out of thousands, so "show me everything I have
   NOT starred" returns a list a user cannot tell apart from "All" - a selected state that
   looks broken, sitting between them and the value they actually want. The request body
   keeps the optional boolean, so favorites=false is still expressible via the API and the
   URL; only the dead on-screen option is dropped. No capability is lost.

2. "Recently favorited" ordering is NOT in this PR. It ships as a sibling slice in the same
   milestone. The retired tab lists favorites newest-starred-first; the search page cannot
   yet, because a per-user ordering has to be threaded through the cursor-pagination engine
   built in ST-5a/5b/5c - eight call sites across the pager, the cursor codec and the sort
   control, two of which fail silently. That is a change the size of its ST-5 siblings, so
   it gets its own reviewable slice rather than riding along here. Nothing regresses for
   users in the meantime: Favorites has never shipped (it is absent from 0.29.0, 0.28.0 and
   0.27.13) and its documentation page is not published yet, so no operator on any released
   version can encounter the gap. This PR's docs describe the filter without claiming an
   ordering; the claim returns with the follow-up slice.

Not touched:
- Favoriting itself: the star, the favorite table, the /api/favorites write and list
  endpoints, and the Overview panel's own list.
- The legacy /api/search path and the per-kind searches.

Also found while working on this, reported separately: saving a search does not capture the
Asset-type filter, because the saved-search spec type has no field for it. That is a
pre-existing defect from the saved-search and asset-kind slices, not caused by this change.
A Favorites filter will be dropped by a saved search for the same reason until it is fixed.
```

**Posted:** https://github.com/opendatadiscovery/odd-platform/issues/1841#issuecomment-5471707666 (`odd-contributor[bot]`, 2026-08-30T22:41:05Z). Read back from the API after posting and verified: 2684 chars, **0 non-ASCII**, and both AC divergences present in the live body.

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
| Unit — full `:odd-platform-api:build` (test + checkstyle + assemble) | running (final, on the settled tree) |
| Checkstyle (main + test), run in isolation | **BUILD SUCCESSFUL, 0 violations** — after fixing TWO of mine the gate caught: 2× `CustomImportOrder` (misplaced `FavoritesScopeDto` / `Tables.FAVORITE`) and 1× `Blank line at start of block` in `FavoritesScopeDto`. All three were invisible to a green test run, because Checkstyle emits no JUnit XML — the reason the local script runs `build`, not `test` |
| Unit — `AssetSearchFavoritesIntegrationTest`, 6 cases | **GREEN — BUILD SUCCESSFUL 5m53s** (2026-08-31), after the fixture fix below |
| Unit — RED-on-base for those cases | **Not expressible as a failing run, and that is the honest answer.** `favorites` does not exist in `AssetSearchFormData` on `origin/main` (verified: 0 occurrences in main's schema), so the generated DTO has no accessor and the test **cannot compile** there. A new capability has no "fails then passes" run — the meaningful RED proof for this slice is the INTEGRATION one, where the same URL is driven against both SUTs and only the behaviour differs. That is why IT-148's narrowing oracle carries the weight |
| Unit — FE vitest (`searchUrlState` 31 · `FavoritesFilter` **9** · i18n 17) | **GREEN — 57/57, 3 files** (2026-08-31). The two cases added for the inverted scope were each **re-run by name** (`-t 'INDETERMINATE'` → `1 passed \| 8 skipped`) rather than inferred from the total, because the default reporter had truncated their names out of the listing and "9 `it(` in the file, 9 reported" is arithmetic, not evidence |
| **`i18n-key-parity.test.ts`** — the repo's existing guard, run explicitly (CI does not) | **GREEN — 17/17**; all 7 catalogs at parity with the 2 new keys |
| `tsc --noEmit` (Node 24.13) | **clean** — zero output |
| ESLint on the 9 changed FE paths | **CLEAN** — 0 errors; 7 prettier warnings auto-fixed with `--fix`, then re-verified to 0 problems |
| FE OpenAPI codegen (spec changed) | regenerated; `favorites?: boolean` present in the model |
| **Changed** existing tests — each needs a per-test SoT + a surviving RED on base (G-C15). Expected set, with the ordering split out: `FavoritesAssetTypeFilter.test.tsx` + `Favorites/__tests__/lib.test.ts` (deleted with their subjects), `searchUrlState.test.ts` (extended, never weakened) | pending Phase D — enumerate exactly before committing |
| Integration — `IT-148` re-grounded on the **narrowing** oracle (§7 step 9), GREEN on fix / RED on `ref:main` | pending Phase D |
| FULL regression (`run-regression.sh ctrib061`): `feature-complete` green · `multi-stack` green · `known-bugs` still-RED · `ingestion-e2e` green | pending Phase D — queues on the heavy-e2e flock (held by co-active ctrib060; `run-regression.sh` blocks automatically) |
| `EXPLAIN (ANALYZE, BUFFERS)` on both predicate directions, seeded corpus | pending Phase D |
| Local patch-coverage (98% changed-lines aggregate, via ctrib062's `patch-coverage.py`) | **OPEN — blocked on a full test run for `jacocoTestReport.xml`**; expectation pre-registered at ~100% (§20). Not run ≠ assumed passing |
| Docs read + authored + committed on `release/1.0.0` (5 locations, §7 step 11) | pending Phase D |
| Ontology `/enrich --touched` + re-embed + commit | pending Phase D — queues behind ctrib060's `lineage/**` claim; **the PR stays `draft` until it runs** |
| UI screenshot of the rendered filter, reviewed as a user (G-C12 step 5) | pending Phase D |

## 10. Parallel-stream coordination (three streams co-active)

Registered as `ctrib061` in `state/active-streams.yaml`. Namespace: worktree `../odd-platform-ctrib061`,
tag `odd-platform:odd-team-sut-ctrib061`, compose `ctrib061`, ports 18250/15650 — all verified free.
Phase A/C held **no** shared resource (read-only against `origin/main`).

| Stream | Work | Bearing on this slice |
|---|---|---|
| `ctrib060` | #1840 ST-6 query operators | **Holds the heavy-e2e flock** (`run-regression.sh`, pid 248842 since 23:39:22). My Phase-D regression queues behind it — `run-regression.sh` blocks on the flock, so this is automatic, not a manual wait. Also mid-`/enrich`, so `lineage/**` (the R9 single-writer resource in `playbooks/stream-coordination.md` — not this record's R9) is treated as claimed |
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

| **`issues/odd-platform/PLT-257`** | **Paste-ready ST-7b sub-issue** — "Recently favorited" ordering, with the eight call sites enumerated and the never-shipped evidence. ASCII, suggested milestone 1.0.0, **no milestone self-assigned** | The bot is policy-barred from creating GitHub issues (`playbooks/github-write.md`, G-C18); the maintainer files it under #1825 |
| **`backlog/docs/DOC-503`** | The **release-gate hook** (`milestone: "1.0.0"`): reconcile `favorites.md`'s "most-recently-favorited first" claim against what actually merges into 1.0.0 — keep it if ST-7b shipped, drop it if not | It is a gate obligation, not this PR's work. Verified live: `grep -rl 'milestone: "1.0.0"' backlog/ contributor/` returns it |

**This slice inherits the saved-search gap by construction:** `favorites`, like `asset_kinds`, is a URL-only dimension on
`AssetSearchFormData`, so a saved search will not capture it either. That is *consistent* with the shipped
behaviour rather than a new regression, and PLT-256 fixes both at once. Called out in the PR body so the
maintainer sees the inheritance, not just the new field.

## 12. Plan-check record (G-C19) — three adversarial rounds

Run against `.claude/agents/plan-checker.md` (fresh context, assume-flawed, goal-backward). **Every checkable
claim it made was re-verified here first-hand before being acted on** — an agent finding is a lead, not a fact.
Each round was right, and none of the three was a rubber stamp.

| Round | Verdict | The finding that mattered most |
|---|---|---|
| 1 | **ISSUES FOUND** — 8 blockers, 7 warnings | The `FAVORITED_AT` ordering is not one `ORDER BY` branch but eight call sites across the ST-5 cursor engine, two failing silently. Drove the ST-7/ST-7b split |
| 2 | **ISSUES FOUND** — 4 blockers, 11 warnings | R8 asserted "nothing performs i18n key parity" *as checked*. Wrong — the guard is a vitest test I never grepped for. Also: the re-grounded IT would have been GREEN on base, and the retirement would have shipped the blank-page defect R4 exists to prevent |
| 3 | **ISSUES FOUND** — 1 blocker, 9 warnings; all four round-2 blockers verified closed | §6.2 committed the bot to *filing* the ST-7b sub-issue — an action `playbooks/github-write.md` and G-C18 forbid — and that non-existent mechanism was the only thing keeping R5 tracked |

**Round 3's blocker is closed by a mechanism that exists and was tested, not by an intention:**
`issues/odd-platform/PLT-257` (paste-ready, maintainer files it) + `backlog/docs/DOC-503` carrying
`milestone: "1.0.0"`. The release gate derives its manifest with `grep -rl 'milestone: "1.0.0"' backlog/
contributor/` (`playbooks/release-train-merge.md`); that exact command was run and returns `DOC-503`. All nine
round-3 warnings are folded in, and a grep confirms no stale claim survives.

Round 3 also verified something stronger than this record had argued: **Favorites has never shipped** —
`Favorites.tsx` and `V0_0_94` are absent from 0.29.0, 0.28.0 and 0.27.13, and `favorites.md` is absent from
`documentation@origin/main`. Independently confirmed here with `git cat-file -e` per tag. That makes the
ST-7/ST-7b split materially safer than the doc-timing argument alone suggested: there is no published release
on which the missing ordering can be experienced.

## 13. Phase D — what was built

Branch `contrib/CTRIB-061-favorites-filter` in worktree `../odd-platform-ctrib061`, off `origin/main @ 82e7e70e`,
**no upstream** (asserted before creation, O6/LSN-038) with `push.default=current`.

### Backend

| File | Change |
|---|---|
| `odd-platform-specification/components.yaml` | `AssetSearchFormData.favorites` — optional boolean, with the three-state contract spelled out (absent ≠ `false`) |
| `odd-platform-specification/openapi.yaml` | the `/api/search/assets` prose now lists the dimension (it enumerates the honored contract) |
| `dto/FavoritesScopeDto.java` (new) | `(oidcUsername, provider, favorited)`; `null` = no narrowing. Documents why it is NOT on `FacetStateDto` |
| `ReactiveAssetSearchRepository{,Impl}.java` | one new nullable parameter on `keysetPage` / `relevancePage` / `count`; predicate `(5b)` in `conditions(...)` |
| `AssetSearchServiceImpl.java` | resolves the identity via `CurrentUserIdentityResolver` **only when** `favorites` is present, and runs the search inside that resolution |

The predicate is a correlated `EXISTS` / `NOT EXISTS` on `favorite`, keyed on the polymorphic
`(asset_kind, asset_id)` pair, so it is **cross-kind with no kind guard** — unlike my-objects, which is
DE-only. It probes `favorite_identity_asset_key` (the `V0_0_94` UNIQUE index) and **adds no join**, so
`searchFrom()` is untouched and every other query keeps its plan. `NOT EXISTS` is NULL-safe where `NOT IN`
is not.

**A simplification made during self-review, before the gate ran on it.** The first cut resolved the scope
into a `Mono<FavoritesScopeDto>` and then did `.map(Optional::of).defaultIfEmpty(Optional.empty())` to carry
"no scope" through the reactive chain. Correct, but the kind of cleverness a reviewer has to decode. It is
now two plain branches — an early `return` for the absent case, and `resolve().flatMap(...)` for the present
one. Same behaviour, no `Optional` round-trip.

### Front end

| File | Change |
|---|---|
| `lib/search/searchUrlState.ts` | `SEARCH_FAVORITES_PARAM`, `favorites?: 'yes' \| 'no'`, fail-closed parse, serialise, and the `yes/no → boolean` projection that keeps **absent absent** |
| `components/Search/Search.tsx` | `favorites: live.favorites` in the merge-back at `:101-106` — **the #1858 trap**; the comment now says every URL-only param must be listed there |
| `Search/Filters/FavoritesFilter/FavoritesFilter.tsx` (new) | the toggle; `(shared)` label + `InformationIcon`/`AppTooltip` inline help under DISABLED; writes through `searchStateToParams` |
| `Search/Filters/Filters.tsx` | renders it **unconditionally** in the rail |
| `Search/Results/Results.tsx` | with the scope on, the zero-result state teaches the star instead of "No matches found" |
| `components/App.tsx` | `/favorites` → `<Navigate replace>` to the pre-filtered search. **The route is replaced, not deleted** — there is no catch-all, so deleting it blanks every existing bookmark |
| `AppToolbar/ToolbarTabs/ToolbarTabs.tsx` | the Favorites tab entry removed |
| `Overview/…/FavoritesColumn.tsx` | "View all" → the serialised pre-filtered search |
| **Deleted** | `Favorites.tsx`, `FavoritesListItem/**`, `FavoritesAssetTypeFilter/**` (+ its test), and the four `lib.ts` helpers that died with them |
| `locales/translations/*.json` ×7 | 2 new keys, translated. `Favorites`, `Favorites (shared)`, `Star an asset to pin it here.`, `All`, `Yes`, `No` were already present — reused, not re-added |

`routes/favoritesRoutes.ts` deliberately **survives**: it is the redirect's source.

### Tests authored

- `AssetSearchFavoritesIntegrationTest.java` (new, 6 cases, real Postgres): the narrowing across all three
  kinds; the negative direction; **absent = no narrowing** (never an implicit `false`); per-identity scoping
  proved without authenticating (a star written under a different `(username, provider)` must not leak);
  soft-delete semantics (un-starring leaves the scope); and composition with `asset_kinds`. Every case also
  asserts `total` matches the page — a count that disagrees is a phantom badge.
- `searchUrlState.test.ts` — 6 additive cases (nothing weakened): round-trip, fail-closed, preservation
  alongside the other params, the wire projection, and that `favorites` never reaches the legacy `SearchFormData`.
- `FavoritesFilter.test.tsx` (new, 7 cases): reflects the URL, fails closed, **click writes the canonical URL**
  (asserted through a real router + location probe, not a navigate spy — a spy passes on a byte-divergent URL,
  which is the actual failure mode), unchecking removes the param entirely, and the DISABLED label + inline help.
- `integration-tests` — `IT-148` re-grounded (protocol + spec + both `suites.yaml` lane comments).

### The integration re-grounding, and a defect my own review caught

The spec now seeds a **foil** (`it148_unstarred_foil`) matching the same query token and never starred, and
every case asserts the subject is present **and the foil is absent**. Presence alone is green on `ref:main`,
where the unknown `favorites` param is dropped and the unfiltered list contains the subject anyway.

Reviewing my own draft, one case was **mislabelled and did not test what it claimed**: it was titled as the
#1858 preservation class but asserted only that **Clear All** clears the filter — the opposite behaviour. T8
(a facet toggle must PRESERVE an active scope) had no coverage at all. The case now toggles the **Datasource**
redux facet — the one that actually re-fires the mirror — asserts `favorites=yes` survives it and the list is
still narrowed, and keeps the Clear All assertion separately, where it belongs.

## 14. A coordination hazard I created (recorded, not buried)

Twice during Phase D I stopped my own gradle build with `pkill -f 'scripts/run-platform-tests'`. **That pattern
is not stream-scoped** — every parallel stream runs the same script, so it matches theirs too. `ctrib062` was
running its own build in `../odd-platform-ctrib062base` at the time, and I cannot rule out that my first
`pkill` killed it (a fresh run of theirs appeared seconds later, which is consistent with either an
unrelated start or a restart after being killed).

No lasting damage is possible — a killed gradle run loses time, not work — but it is exactly the class of
cross-stream harm `playbooks/stream-coordination.md` exists to prevent, and the protocol does not currently
name it. **The rule: never `pkill` on a pattern every stream shares. Match the worktree path**
(`pkill -f 'odd-platform-ctrib061'`) or the recorded PID. Raised here rather than quietly fixed, because the
next stream will reach for the same shortcut.

The second `pkill` also killed my own invoking shell (exit 144) mid-script, which silently dropped a Python
edit I thought had applied — caught only by re-grepping the file afterwards. Another reason to scope the
pattern narrowly.

## 15. Two failures that were NOT mine — established, not assumed

The full unit run surfaced one test failure and a FE re-run surfaced another. Both looked like my regressions.
Neither was, and each was settled with evidence rather than a shrug.

**`OpenApiDocsContractTest.platformApiGroupDocumentLoads()` — `TimeoutException`.** It is the regression guard
for PLT-141 (springdoc 2.2.0 × Spring 6.2), and it carries `@AutoConfigureWebTestClient(timeout = "60000")`.
It is **already tracked** as `backlog/tests/TST-057`, whose title names this exact test and whose body records
the identical signature from ctrib059 the day before: *"747 tests completed, 1 failed … GREEN in isolation on
the SAME tree, idle box → 3/3 PASS, with `platformApiGroupDocumentLoads` at **17.79s** against a **60s**
bound."* Three gradle builds were running concurrently on this box (mine, ctrib062's, and a third). The
plausible-but-unverified story is load; the **verification** is the isolation re-run recorded in the ledger —
a ticket describing the same symptom is a strong lead, not proof that today's instance has the same cause.

**`FavoritesFilter > is unchecked when the URL carries no favorites scope`.** Passed, then failed on a re-run,
then **passed 7/7 in isolation**. The failing instance took **5325 ms** for an assertion that takes ~300 ms
when the box is idle — the same load signature. Not a defect; the same TST-057 class, in the FE bucket.

Neither is folded into this slice: TST-057 already owns the class, and adding a fourth instance to its list is
the tests pillar's call, not this PR's.

## 16. The full build found a real defect — in my own test

`753 tests completed, 1 failed`, and the failure was mine:
`favorites=false is a real filter` — `AssertionError at AssetSearchFavoritesIntegrationTest.java:119`.

**The production code was correct; the test was wrong**, and it would have failed against a correct system.
A substring trap:

```
"favnobetaunstarreddataentity".contains("starreddataentity")  ->  true
```

The never-starred fixture *contained* the starred fixture's token, so
`noneMatch(name -> name.contains("starreddataentity"))` rejected the very asset the anti-join had correctly
returned. Reading the test could not have found this; running it did — in the first minute of looking at the
failure, and not before.

Fixed by renaming the never-starred fixtures to `plain…`, with the invariant then **proved rather than
eyeballed**:

```
fixture tokens: [keptasset, mineasset, plaindataentity, plainterm, removedasset,
                 starreddataentity, starredqueryexample, starredterm, theirsasset]
substring collisions: NONE
```

A comment at the `names()` helper records the trap so the next edit does not reintroduce it.

**One correction to §15 while I am here.** `OpenApiDocsContractTest` **passed** in this run, on a quieter box.
That weakens "it is TST-057" as a settled explanation and strengthens the load hypothesis — which is the right
direction, but it also means §15's first entry should be read as what it is: a lead corroborated by one green
run, not a closed attribution.

## 17. Cross-stream agreement: the flock now covers heavy gradle, not just e2e

`ctrib062` (#1842 ST-8) asked to serialize heavy Testcontainers builds, and brought a measurement worth more
than the request: on **clean `origin/main @ 82e7e70e`, isolated**, `OpenApiDocsContractTest.platformApiGroupDocumentLoads`
runs **59.693s against its 60s bound** — it passes by **307 ms with nobody's code in it**. It has also filed
`TST-061` for the substrate gap: `state/active-streams.yaml` serializes *activities* and the heavy-e2e flock
guards *e2e*, so **neither governs CPU or memory** — two unit builds can starve each other with nothing in the
registry showing a conflict.

**Adopted, from my next heavy run onward:** hold `state/locks/heavy-e2e.lock` around a bare `gradlew` /
`run-platform-tests.sh` invocation too. Explicit caveat agreed with them so the convention cannot deadlock:
`run-regression.sh` takes that flock **internally**, so it must be invoked *without* the lock held — hold it
around bare gradle, release before the regression, never nest.

**And I yielded the box.** They have four contaminated measurements and a ~70-minute regression outstanding;
I have one build finishing and integration work that would be equally worthless under contention. They go
first; this stream queues.

**This retires the convenient story in §15.** My own `platformApiGroupDocumentLoads` RED is *probably* still
contention — but "TST-057 covers it" was a half-verified explanation I reached for because it was available.
Their number reframes it: the bound is 307 ms from failing at rest, so on this box the test is not a reliable
signal for anyone. I owe them the three sibling timings (`platformApiGroupDocumentLoads`,
`ingestionApiGroupDocumentLoads`, `swaggerConfigListsBothGroups`) from my build's JUnit XML — proportional
inflation across all three supports contention, whereas **both** group documents hanging is the PLT-141 shape
and a real defect.

**Disclosed to them, unprompted:** my two `pkill -f 'scripts/run-platform-tests'` invocations (§14) may have
killed one of their runs in the 10:35-10:50 window, which would have presented as an unexplained death rather
than contention — i.e. it may be one of the four measurements they withdrew. They needed that to read their
own data correctly.

## 18. The springdoc timing question — and a near-miss that would have shipped

The one non-mine failure in the final build was `OpenApiDocsContractTest.platformApiGroupDocumentLoads()`.
Chasing it properly with `ctrib062` produced a better answer than either of us started with, and cost me a
comfortable story twice.

### The ratio discriminator is WITHDRAWN — in both directions

ctrib062 proposed normalising `platformApi` against its two siblings as internal controls, since neither
change can touch the ingestion document or the static swagger-config list. Applied to my numbers it pointed
**at me**:

| run | platform | controls | ratio |
|---|---|---|---|
| their main baseline | 59.693 | 22.316 | 2.675 |
| their branch (censored) | ≥60.337 | 43.374 | ≥1.391 — reads exculpatory |
| **my branch (censored)** | ≥60.191 | **9.877** | **≥6.094 — reads inculpatory** |

My controls were *faster than their main baseline* yet `platformApi` still pinned the ceiling. That is the
shape a real regression makes, and my change touches the platform-api document specifically.

**It is not evidence, and the reason is structural.** `platformApi` and `ingestionApi` **share springdoc's
lazily-built model**: whichever document is requested FIRST pays the reflection walk over every controller and
`@ControllerAdvice`, and the second reuses it. The "control" is therefore *downstream of the subject*, ordered
by a JUnit method order neither of us controls or observes. `swaggerConfigListsBothGroups` swinging
**1.656 / 9.251 / 15.086s** across three runs is the proof — a control that varies 9× is not a control. My
1.656s (the fastest anyone measured) most likely just means something else warmed the model first in that run.
Add that the reflection walk is memory/GC-bound while the controls are cheap, and the normalisation compares
two different resources. **So my ≥6.094 goes in the bin alongside their ≥1.391.**

### What actually holds

- **Not the PLT-141 shape.** ctrib062's uncensored branch run: `platformApi` **43.75s, PASSES, no hang**, with
  both siblings green. A genuine springdoc break hangs *both* group documents.
- **A structural argument, not a plausibility one.** springdoc's cost driver is the reflection walk over
  operations, controllers and advice. Neither slice adds an operation, path, controller or advice (mine: one
  scalar property; theirs: five scalar properties on two existing schemas). The only mechanism by which a
  property can hang a document build is a schema **cycle**, and a scalar cannot form one. This holds
  independently of any timing — which is why I accept it where I refused the property-count plausibility
  argument (~0.124% of 804 properties ⇒ ~0.075s): that one was the same *kind* of reasoning that told me my
  test fixture was fine an hour before it wasn't.
- **The bound is the real problem.** 59.693s against a 60s bound on clean `main`, isolated — 307 ms of headroom
  with nobody's code present. On this box the test is not a reliable signal for anyone. `TST-057` owns the
  class; `TST-061` (ctrib062) owns the substrate gap.

**Still owed:** my own uncensored absolute on a quiet box. Pre-registered *before* the result: near 43.75s with
controls near the 14.492s quiet-box reference. **Above ~120s with quiet controls and this slice owns it, and
the PR waits.**

### The near-miss: a diagnostic patch that survived its own cleanup

To measure uncensored I patched the bound `60000 → 300000`, in a one-liner that restored it afterwards and
asserted the restore. ctrib062 and I then collided on the box; I killed my run — **and the kill skipped the
restore.** The working tree was left with `@AutoConfigureWebTestClient(timeout = "300000")` on a regression
guard.

Had I not checked, this PR would have carried a **silently 5×-weakened bound on someone else's regression
test** — the exact G-C15 failure ("a red test goes green just as easily by weakening it"), reached by accident
rather than by a bad decision, and invisible in a diff skim because it is a three-character change in a file
otherwise untouched by the slice. Restored and verified (`git status` clean on that file; whole-worktree diff
back to this slice's own files). The re-run wraps the restore in a `trap … EXIT` so a kill cannot skip it, and
ctrib062 was warned since their diagnostic has the same shape.

### Cross-stream note

I also confirmed a hole in my own box-quiet checks: `pgrep -f 'GradleWrapperMain'` does **not** match gradle's
test workers (`java -Dorg.gradle.internal.worker.tmpdir=<worktree>/…`), which are the processes doing the work.
Every "the box is quiet" claim I made earlier today rests on that check and should be treated as unverified.

### 18a. Prediction RE-REGISTERED before my measurement (the baseline moved)

ctrib062's clean-`main` uncensored run, quiet box, under the flock:

```
platformApiGroupDocumentLoads    24.156s
swaggerConfigListsBothGroups      4.657s
ingestionApiGroupDocumentLoads    2.626s      controls = 7.283s
```

My earlier prediction ("near 43.75s") was anchored to **their branch** number, which was taken with controls
at 14.492s — i.e. a **loaded** box. They have since corrected that: 14.5s was never a quiet reference, it was
2x loaded. The real quiet reference is **~7s of controls**, and the real baseline cost of this operation on
this machine is **24.156s**, not ~43s.

**So I am tightening my threshold BEFORE running, not after seeing a result** — which is the only direction a
pre-registration may legitimately move:

- **Contamination gate:** controls must land near **7s**. Materially above and the run is discarded, not
  interpreted.
- **Pass:** platformApi near **24s** ⇒ this slice costs nothing.
- **I own it at >35s with quiet controls** (previously I had said >120s — that number was calibrated against a
  baseline now known to be wrong by ~2x, and keeping it would have made the test unfalsifiable in practice).
  At that point the PR is held and I go find what one scalar property is doing to a document build — which,
  per the structural argument, should be impossible, and would mean the structural argument is wrong.

### 18b. RESULT — measured, and this slice is clear

**My branch, uncensored, quiet box, under the flock, using ctrib062's kill-safe script:**

```
platformApiGroupDocumentLoads    20.671s   PASSES
swaggerConfigListsBothGroups      4.543s
ingestionApiGroupDocumentLoads    2.653s
controls = 7.196s
```

| run | platformApi | controls | verdict |
|---|---|---|---|
| clean `main` @ 82e7e70e (ctrib062) | 24.156s | 7.283s | baseline |
| **this branch** | **20.671s** | **7.196s** | **3.485s FASTER than main** |

Controls within **1.2%** of each other — as close to a controlled pair as this machine gives. Against the
pre-registered threshold (own it above 35s with quiet controls): **PASSES at 20.671s.** This slice adds no
measurable cost to the platform-api document build; the sign is even slightly negative, which at ~22s is
run-to-run noise.

**So the 60.191s failure was load, established by measurement rather than by the ticket that happened to
describe the same symptom.** The bound has ~36s of headroom on a quiet box. `TST-057` (the bound is not sized
against measured cost) and `TST-061` (the registry governs activities, not machine resources) own the class;
nothing here is this slice's to fix.

**The restore was verified by evidence, not habit:** the script's `trap` wrote `RESTORED 1` into the log, the
annotation is back at `timeout = "60000"`, `git status` is empty on that path, and the whole worktree is down
to this slice's own files.

**What I got wrong along the way, in order:** I first reached for "TST-057 covers it" — an available
explanation, half-verified. Then a discriminator that pointed *at* me, which I reported rather than sat on,
and which turned out to be unsound in both directions. Then a threshold calibrated against a baseline that was
2x wrong, which I tightened before measuring rather than after. Only the last step — an absolute, on a quiet
box, at controls matching the baseline's — actually answered the question. Three arguments and one measurement;
the measurement is the only one that counted.

### 18c. Closed — three measurements, both slices clear, and a phantom regression retracted

ctrib062's quiet-box branch run landed at **23.122s @ 7.677s controls — 1.034s FASTER than clean main**. With
mine, that is three independent uncensored measurements at comparable controls:

| subject | controls | platformApi | vs main |
|---|---|---|---|
| clean `origin/main` @ 82e7e70e | 7.283s | 24.156s | baseline |
| this branch (+1 scalar property) | 7.196s | 20.671s | −3.485s |
| ctrib062 (+5 scalar properties) | 7.677s | 23.122s | −1.034s |

Two spec-changing branches and clean main, indistinguishable. **The operation costs ~21-24s quiet; the 60s
bound has ~36s of headroom quiet and effectively none under load.** Neither slice contributes anything
measurable, exactly as the structural argument predicted — and it is now evidenced from opposite directions.

**Logged where it will be found, not just here.** `backlog/tests/TST-057` gains the measurement table **and an
explicit retraction** of three claims in its own previous section, which were written from the censored and
control-normalised data both streams have since withdrawn: the "~116s loaded cost" projection (actual: 43.75s),
the "genuine 3.4x regression in document-build cost that nobody has explained", and the "~17.8s -> ~59.7s
degradation on `main` [that] deserves its own investigation". **There is no regression** — 17.8s and 59.7s are
the same operation at different load. Left standing, that text would have sent the next reader hunting a
phantom for hours; retracting it is worth more than the table.

The section is appended and marked as superseding rather than rewritten in place, because the text it corrects
is another stream's and they may want to fold it in themselves.

**One methodological point worth carrying forward.** ctrib062 observed that their pre-registered rule *very
nearly convicted a correct change*: had they honoured it literally against the first uncensored pair (main
24.156 @ 7.283 vs branch 43.750 @ 14.492), they would have held a correct PR and hunted a 19s regression with
no mechanism. Pre-registration prevents post-hoc rationalisation; it does **not** prevent comparing two runs
taken under different conditions. Both disciplines were required, and either alone would have shipped a wrong
conclusion.

## 19. The ontology gate found two defects the tests had passed over

`/enrich` on the new component is a G-C10 gate I had treated as bookkeeping. It returned two findings in my
own code. **Both were verified first-hand before being acted on** — an agent finding is a lead.

### Finding 1 — MINE, new, FIXED: the control lied about an applied filter

`?favorites=no` is honoured end to end — `paramsToSearchState` keeps the token (`searchUrlState.ts:256`), the
projection sends `favorites: false` (`:302`), and the backend applies the `NOT EXISTS` anti-join. But `isOn`
tested `favorites === 'yes'`, so the checkbox rendered **unchecked over a list narrowed to everything the
caller has NOT starred**. The control asserted "no filter" while a filter was applied — the
FE-contradicts-BE class (`feedback_user_facing_impact_mandatory`, PLT-176).

This is a direct consequence of the GATE-1 decision to ship a two-state toggle over a three-state contract. I
had anticipated *"`no` has no UI control"* (recorded as T2b) and stopped there. I had not asked the next
question — **what does the control show when that state is nonetheless reached** — and the honest answer was
"a lie".

**Fixed:** the inverted scope renders **indeterminate**, and a click **escapes** it (clears to unfiltered)
rather than flipping to `yes`. The handler derives from the URL scope rather than the event's `checked`,
because an indeterminate box reports `checked=true` on click — deriving from the event would have made the
state inescapable through the UI. Required widening the shared `Checkbox` wrapper's prop allow-list by one
pass-through prop (`indeterminate`), justified in a comment at the type.

Two vitest cases pin both halves; the FavoritesFilter suite goes 7 → 9 cases, all green.

**What this says about my test design:** I wrote seven component cases and none covered `?favorites=no`,
because I had reasoned it was "API-only" and let the reasoning substitute for a case. The analyser read the
code; I had tested my intent.

### Finding 2 — REAL but pre-existing and shared: logged as TST-062, deliberately not fixed here

The `(shared)` disclosure **fails open**. `useAppInfo` is a plain `useQuery` and `retry: false` is a global
default (`index.tsx:41`), so one failed `GET /api/info` leaves `isShared` false and the shared-bucket warning
silently disappears — on precisely the deployment that needs it.

**Not fixed in this slice, for two stated reasons.** The pattern is in **three** surfaces
(`FavoritesColumn.tsx:46`, `RecentlyViewedColumn.tsx:32`, both shipped before ST-7, and my filter at `:37`
following the convention) — fixing one would leave three siblings disclosing the same fact by two rules. And
the correct semantics are a genuine decision, not an oversight: assuming *shared* when the mode is unknown
raises a false alarm on a healthy OAUTH2 instance during a blip. `backlog/tests/TST-062` carries the analysis
and an acceptance criterion requiring **all three** surfaces plus a test that drives the failure path.

### What the gate was worth

I had queued `/enrich` as a checkbox to clear before the PR. It found a user-visible defect and a tracked
disclosure gap that seven component tests, 753 unit tests, tsc, ESLint and checkstyle had all passed over —
because every one of those checks the code against what I believed it did.

### 19a. Why the inverted scope needs no integration case

The `favorites=no` *behaviour* — does the anti-join genuinely narrow through the real stack — is already
covered against a real Postgres by `searchAssets_favoritesFalse_narrowsToUnstarred`. What was broken was the
**rendered control state**, which is a component-level question and is now pinned by two vitest cases. No
in-app affordance produces `?favorites=no`, so an e2e case would spend stack time driving a URL nothing
generates, to assert a rendering the component test already asserts. Bucket routing per `pillars/tests`:
in-process where the question is in-process.

## 20. A documented promise of mine with no measurement behind it

ctrib062's patch-coverage finding reframed a gate I had been treating as due diligence. Their uncovered lines
were not incidental — they were **behaviours their own OpenAPI description states as contract** (TIMEOUT vs
NODE_CAP as distinct outcomes with different client advice), shipped unverified. Their framing: *the coverage
number was the symptom; the defect was shipping documented promises unverified.*

Applying that lens to this slice surfaces one:

> "the correlated form probes `favorite_identity_asset_key` … and lets the planner choose a semi-/anti-join"
> — `ReactiveAssetSearchRepositoryImpl` condition (5b), and the same claim in prose on the wire contract.

**That is a documented performance claim with no measurement behind it.** It is already on the gate list as
the `EXPLAIN (ANALYZE, BUFFERS)` run, but I had it filed as "SRE hygiene" rather than as *verifying an
assertion I wrote into the source*. If the plan comes back a sequential scan, the comment is false no matter
how green the tests are — and a future reader would trust the comment over re-measuring.

**Patch coverage — pre-registered before running.** Most of the Java change is in `repository/reactive/`,
which `odd-platform-api/build.gradle` excludes from jacoco, so those files should report **NOT IN REPORT**
(correct, not a bug — CI's aggregate excludes them from both sides). The measurable changed lines are
`service/AssetSearchServiceImpl.java` and `dto/FavoritesScopeDto.java`, both driven by all six behaviour
tests. **Expectation: ~100%.** Whatever it actually returns gets recorded, and an uncovered *documented*
behaviour is the finding — not the percentage.

Blocked on a full test run for `jacocoTestReport.xml`: the last full build died at `:test` before the report
task, and the targeted run only produced exec data for one class, which would understate everything. Queued
behind ctrib062's regression with the IT work. **Not run ≠ assumed passing**; it stays open in the ledger.

**Tooling reused, not rebuilt:** ctrib062's `patch-coverage.py`, reviewed line by line rather than adopted on
trust. One latent trap reported back (`cur` leaks across a deleted file, because `+++ /dev/null` fails the
`startswith('+++ b/')` reset — harmless only because a deletion's `+0,0` hunk yields an empty range). The rest
checks out: three-dot diff, `ci > 0`, OR-merge across reports, and NOT-IN-REPORT rather than 0% for
jacoco-excluded files, which correctly mirrors Madrapps.

### 20a. Measure the GENERATED SQL, not the SQL you reasoned about

ctrib062 caught a flaw in their own perf evidence that applies directly to my pending `EXPLAIN`, and it is the
sharpest methodological point of the day. Their M1-M5 measurements are genuinely good — real EXPLAINs, a 218x
design error caught, a 22x missing index caught, an "obvious" optimisation rejected for measuring slower — and
**every one was taken against hand-written probe SQL on a throwaway Postgres, never through the running
application.** Their claim is about a predicate *shape*; **jOOQ generates the shipped query, not them.** A cast,
a different join order, a materialised subquery, and the measured plan describes a query the platform never
issues.

My planned `EXPLAIN` was about to make exactly that mistake: paste my *intended* `EXISTS` into psql. That would
prove the planner **can** choose an anti-join, not that **mine does** — a different claim from the one my
source comment makes.

**So I captured the generated SQL from the running application instead** — the r2dbc `QUERY` debug log of my
own unit run, which drives the real service against a real Postgres. 8 positive and 2 negative occurrences.
Verbatim:

```sql
-- favorites=true
and exists (select 1 as "one" from "public"."favorite"
            where ("public"."favorite"."oidc_username" = $9
              and "public"."favorite"."provider" = $10
              and "public"."favorite"."deleted_at" is null
              and "public"."favorite"."asset_kind" = "public"."asset_search_entrypoint"."asset_kind"
              and "public"."favorite"."asset_id"   = "public"."asset_search_entrypoint"."asset_id"))

-- favorites=false
and not exists (select 1 as "one" from "public"."favorite" where ( … same correlation … ))
```

**Two things this settles that I had left open:**

1. **jOOQ emits canonical `not exists (…)`, not `not (exists (…))`.** I wrote `DSL.not(DSL.exists(…))`, noted
   that the redundant wrapper was cosmetically imperfect, decided it was plan-equivalent and deferred the check
   to the EXPLAIN. Measured: **0 occurrences of `not (exists`, 2 of `not exists`** — jOOQ normalises it. The
   deferral was right, but it is now *verified* rather than *reasoned*.
2. **The correlation is exactly the intended 4-tuple** — `oidc_username`, `provider`, `deleted_at is null`, and
   both halves of the polymorphic key — with no cast and no join added to `searchFrom()`. That is the shape
   `favorite_identity_asset_key` indexes.

**What remains** is running `EXPLAIN (ANALYZE, BUFFERS)` on *this captured text* against a seeded stack — still
box-blocked, but it will now measure the query the platform actually issues. Saved to
`scratchpad/generated-sql.txt` so the EXPLAIN cannot silently drift back to a hand-written proxy.

**Two of us independently wrote a performance sentence into a public artifact and then verified a proxy for
it.** ctrib062 is right that this is a pattern, not a coincidence, and it deserves a retrospective once both
slices are through — the failure is not laziness, it is that a hand-written query *feels* like the thing you
shipped.

## 21. Traps ctrib062 walked into first, adopted before my IT run

Three of their findings landed on exactly my next step, so they are recorded here as *applied*, not admired.

**1. A bare `run-suite.sh IT-NNN` builds the SUT from the SHARED `../odd-platform` worktree.** No `ODD_STREAM`,
no `ODD_PLATFORM_DIR`, and it silently uses whatever branch the shared checkout happens to be on — for them,
`WORKING TREE @ c54b9c61`, a SUT with none of their feature, so every test failed. Pure `LSN-033`.
`run-regression.sh <id>` had been doing that plumbing silently, which is precisely why the bare form is a trap.
**Applied:** every IT invocation here passes `ODD_STREAM=ctrib061 ODD_PLATFORM_DIR=<my worktree> ODD_SUT=working`
explicitly, and the SUT identity is read out of the run log before any verdict is believed.

**2. `EXIT=0` came back with 4 failures.** Read counts, never exit codes. My own false green earlier today (a
vitest run that exited 0 while failing to start on a bad reporter flag) is the same shape in a different tool.
**Applied:** the monitor greps for pass/fail counts and the SUT line, and the wrapper echoes that the exit code
is not the verdict.

**3. Two ways to catch a wrong-SUT run before trusting it:** the failure is **uniform** — tests that cannot
touch your change fail identically — and a reused prebuilt image must be checked by **digest**, not tag name.

**And the one that generalises past this slice.** They wrote a waiter as
`while pgrep -f "run-regression"; do sleep 15; done` — whose own command line contains that literal, so it
matched **itself** and never exited. Silent: process alive, log empty, indistinguishable from a slow job. That
is the same root as my two shared-pattern `pkill`s (§14), in the opposite direction — one killed other people's
processes, the other refused to stop for its own. **The rule now in `TST-061`: address a process by PID, never
by a pattern.** A PID is the process you started; a pattern is a guess evaluated against a list that includes
you.

**One thing their IT-153 debugging says about mine.** Their first test failed on the plainest assertion while
2-4 passed on the same fixture, and had been 4/4 green in isolation twice — every signal pointing at "flake".
It was not: `openSearch` already waits for the results header, so the search had **resolved** and simply did
not contain the seeded row. A timeout bump would have changed nothing but time-to-fail. The real defect was a
missing **readiness** step (`TEMPLATE.md`: seed -> readiness -> run -> assert), visible only in suite context
because a preceding multi-stack spec tears the stack down and leaves `beforeAll` booting cold. My re-grounded
IT-148 has the same exposure — it seeds through real ingestion and then navigates — so if it fails on a plain
assertion I will look for a missing readiness gate before reaching for "flake" or a timeout.

## 22. The EXPLAIN gate — it found my comment wrong AND a 27x cliff

IT-148 is **7/7 GREEN** on the working-tree SUT (`WORKING TREE @ 82e7e70e+uncommitted`, my own image tag —
SUT identity read from the run log, per §21 trap 1). It took three runs, and the two failures were both mine:

1. `.check()` on a control that **navigates** — Playwright requires the same element to report checked, but
   React re-mounts it. Replaced with `.click()` plus assertions that are *stronger* than the one dropped (URL
   gained the param · the re-rendered control reflects it · the list narrowed). Not a weakening under G-C15.
2. `#filter-datasources` is MUI's **hidden native input**; the visible `role="combobox"` div intercepts every
   pointer event, so the click retried 97 times and timed out. Datasource is a `SingleFilterItem` -> `AppSelect`,
   **not** the Autocomplete that `MultipleFilterItem` renders — a distinction I had *read and written down* in
   §5(a) and then failed to apply. Fixed to role + accessible name.

**Three selector failures in one spec, one root cause:** I write assertions against a *captured real shape* for
API payloads and against an *assumed* shape for the DOM. Every selector is now role-and-accessible-name based.

### The EXPLAIN, on the GENERATED SQL

Measured against 50,001 entrypoint rows / 60,200 favorites across 300 identities:

| query | plan | time |
|---|---|---|
| broad FTS, no favorites predicate (**control**) | Bitmap Heap Scan + top-N sort | **180 ms** |
| broad FTS + `favorites=true` | Nested Loop semi-join, drives from `favorite` | **5.9 ms** |
| broad FTS + `favorites=false` | Nested Loop **Anti Join** | **4,829 ms** |
| selective FTS + `favorites=false` | Merge Anti Join | **6.7 ms** |

**Finding 1 — my source comment was factually wrong, and only measurement could show it.** It asserted the
predicate "probes `favorite_identity_asset_key` … once per candidate row". Measured: the planner uses
**`favorite_identity_created_active_idx`** and drives *from* `favorite`, probing the entrypoint PK. The
key-shaped index is not partial, so `deleted_at` would need rechecking; the partial one satisfies it outright.
The comment is corrected in place. Left alone it would have misled the next reader into thinking
`favorite_identity_asset_key` is load-bearing for search — when the *other* index is.

**Finding 2 — a 27x cliff on the negative direction, filed as `PLT-258`.** Not the predicate shape and not a
missing index: a **~50x GIN row misestimate** (planner 1000, actual 50001) makes a nestloop anti-join look
cheap, the inner side is then materialised (`loops=1`) and filtered in memory — ~10M comparisons. **I created a
partial index on the exact correlated 4-tuple and re-measured: no change** (4.8 s -> 4.8 s). Hypothesis tested
and rejected rather than assumed, which is why the issue says the misestimate is the driver.

**Severity is low *today* only because `favorites=false` has no UI control** — the GATE-1 toggle decision. It
is reachable by hand-built URL or API. If a later slice gives the inverted scope an affordance, this becomes
user-facing and must be fixed first; that condition is written into PLT-258.

**Not silently shipped, not unilaterally re-architected.** The remedies (GIN statistics target, a forced hash
anti-join, capping the candidate set) all sit outside ST-7's approved scope, and the one I could test did not
work. It is measured, tracked, disclosed in the source comment, and surfaced at the gate.

This is the gate I had filed as "SRE hygiene" in the plan. It corrected a false statement in shipped source and
found a measured performance cliff — neither of which any test, lint or coverage check could see.
