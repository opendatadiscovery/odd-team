---
node_id: "odd-platform ts components/Search/Filters/FavoritesFilter react-component:FavoritesFilter"
node_kind: react-component
axis: ui_components
extracted_at_commit: 82e7e70e
enriched_at_commit: 82e7e70e
enriched_from: "WORKING TREE of branch `contrib/CTRIB-061-favorites-filter` (worktree `odd-platform-ctrib061`). The branch tip EQUALS its `origin/main` base `82e7e70e` — the worktree reflog holds exactly two entries (branch creation + `reset: moving to HEAD`), so the whole ST-7 slice is UNCOMMITTED at enrichment time. Every `file:line` below is a working-tree line and can shift when the slice is committed, rebased or squashed. Re-resolve anchors on the merge commit."
extractor_version: 0.1.0
prompt_version: file-analyser/0.5.0
schema_version: v0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-08-31-FavoritesFilter-ctrib061
substrate_status: "ABSENT from lineage/odd-platform/nodes.jsonl — `grep -c FavoritesFilter lineage/odd-platform/nodes.jsonl` returns 0 (search root: the single substrate node file). This component postdates the last substrate scan, so the ontology graph and `/retrieve` will NOT reach this sidecar until a rescan re-extracts the `ui_components` axis."
feature_hint: "Data Discovery pillar — the Catalog search (`/search`) Filters rail. ST-7 of the #1825 unified-search overhaul (issue #1841, workspace record `contributor/CTRIB-061.md`). The Favorites scope control: a URL-only on/off toggle (`?favorites=yes`) that replaces the retired top-level `/favorites` tab. Rendered unconditionally by `Filters.tsx:66-68` beside `AssetTypeFilter` / `DataEntityTypeFilter`. Backend partner is `AssetSearchServiceImpl.searchAssets` -> `ReactiveAssetSearchRepositoryImpl.conditions` predicate `(5b)`."
related_features: []          # no feature-flow anchors Favorites yet — see doc/ontology gap below
related_pillar_features: []
related_retrospectives:
  - LSN-020   # Category F — a named input whose control does not represent its full domain
  - LSN-023   # a request field's meaning is what the UI control feeding it means
  - LSN-033   # measured against a fossil — this node exists ONLY in the ctrib061 worktree
  - LSN-017   # dep-array vs read-set; this component is a clean counter-example (see resource_boundaries)
related_contributions:
  - "CTRIB-061"
related_issues:
  - "1841"   # ST-7 — the Favorites filter + tab retirement (this slice)
  - "1825"   # the unified search overhaul this is ST-7 of
  - "1858"   # the dropped-selection class the merge-back exists to prevent
  - "1815"   # the Favorites PRD that shipped the star + the favorite table
related_integration_tests:
  - "IT-148"   # integration-tests/e2e/specs/favorites-star-see-loop.spec.ts (re-grounded by this slice)
related_probes:
  - P-396   # ?favorites=no renders an unchecked control over a narrowed list
  - P-397   # the (shared) disclosure fails open when GET /api/info is unavailable
---

# FavoritesFilter (Catalog search — the Favorites scope toggle) — semantic understanding

## understanding

`FavoritesFilter.tsx` (87 lines, working tree of `contrib/CTRIB-061-favorites-filter`) is the Catalog
search sidebar's **Favorites scope** control: a single checkbox that narrows the cross-kind result
list to the assets the caller has starred, by writing `?favorites=yes` into the search URL through
the canonical serialiser (`FavoritesFilter.tsx:44-56`) and reading its own checked state straight
back out of `location.search` (`:39-42`) — it holds no local state and no Redux state. It is a
**URL-only** dimension, not a Redux facet: favorites has no server-aggregated counts and no
`SearchFacetNames` key, so it must be merged back in `Search.tsx`'s facet-to-URL mirror
(`Search.tsx:111`) or any unrelated sidebar facet click silently drops it (the #1858 class).
It ships as an on/off toggle while the wire contract stays an *optional boolean*
(`searchUrlState.ts:300-303`), so the negative direction (`favorites=false` — only assets the caller
has **not** starred) stays expressible by API and hand-written URL but has no on-screen control.
The control is the only in-app route to "everything I starred" since this slice retired the
top-level `/favorites` tab, so `Filters.tsx:66-68` renders it unconditionally, and under
`auth.type=DISABLED` — where the server resolves every caller to one shared sentinel identity — the
label reads `Favorites (shared) only` and an inline-help icon carries the consequence sentence the
retired tab displayed as a banner (`:65`, `:68-82`).

## concepts

- entities:
  - "`SearchUrlState.favorites?: 'yes' | 'no'` — the URL-state field this control reads and writes (searchUrlState.ts:154-155). `undefined` is the third, meaningful state: no narrowing at all."
  - "`SEARCH_FAVORITES_PARAM = 'favorites'` — the query-string key (searchUrlState.ts:55), documented in its own JSDoc as URL-only 'like `sort` and `asset_kinds`' (searchUrlState.ts:40-54)."
  - "`AssetSearchFormData.favorites` — the wire field, an OPTIONAL boolean on the unified `POST /api/search/assets` contract only (never on the legacy `SearchFormData`); produced by `searchUrlStateToAssetSearchFormData` (searchUrlState.ts:293-304)."
  - "`FavoritesScopeDto(oidcUsername, provider, favorited)` — the backend value carrying WHOSE favorites and in WHICH direction; `null` means no narrowing (FavoritesScopeDto.java:22-26)."
  - "The caller identity tuple `(oidc_username, provider)` — resolved from the security context by `CurrentUserIdentityResolver.resolve()`, falling back to the reserved shared sentinel `('__shared__', 'DISABLED')` (CurrentUserIdentityResolver.java:21-22, 26-29)."
  - "`favorite` table — `(oidc_username, provider, asset_kind, asset_id, created_at, deleted_at)` with a UNIQUE 4-tuple index `favorite_identity_asset_key` and a newest-first partial index `favorite_identity_created_active_idx` (V0_0_94__create_favorite.sql:6-25)."
  - "`AppInfo.authType` — read via `useAppInfo()` (lib/hooks/api/appInfo.ts:4-9); the ONLY input that changes this component's rendering besides the URL (FavoritesFilter.tsx:36-37)."
  - "`AppTooltip` + `InformationIcon` — ODD's shipped inline-help idiom, reused verbatim here (FavoritesFilter.tsx:8-9, 68-82)."
- operations:
  - "Read the active scope: `paramsToSearchState(location.search).favorites === 'yes'` memoised on `[location.search]` (FavoritesFilter.tsx:39-42)."
  - "Write the scope on toggle: re-parse the LIVE URL, set `favorites: checked ? 'yes' : undefined`, serialise with `searchStateToParams`, `navigate` to `/search?<params>` (FavoritesFilter.tsx:44-56). Toggling OFF removes the key entirely — it does not write `favorites=no`."
  - "Label selection: `isShared ? t('Favorites (shared) only') : t('Favorites only')` (FavoritesFilter.tsx:65)."
  - "Conditional inline help: only when `isShared`, an `AppTooltip` wrapping a `span[data-qa=filter-favorites-info]` around a 14x14 `InformationIcon` (FavoritesFilter.tsx:68-82)."
  - "Downstream (not in this file): the URL change re-derives `assetSearchFormData` (Results.tsx:84-87) and re-fires page 1 (Results.tsx:109-113); `Search.tsx`'s reader creates a fresh DE session per distinct `urlStateKey` (Search.tsx:64-80)."
- invariants:
  - "**URL is the only state.** No `useState`, no Redux, no local cache: the control is a pure projection of `location.search` (FavoritesFilter.tsx:32-56). Back/forward and a shared link therefore reproduce the scope exactly."
  - "**The URL is written through the canonical serialiser, never hand-built.** `searchStateToParams` sorts keys and skips empty values (searchUrlState.ts:164-169, 175-195), so a control-written URL is byte-identical to a mirror-written one; `Search.tsx:113` only navigates when the serialised form differs, so a divergent hand-built URL would be rewritten away. Asserted at FavoritesFilter.test.tsx:82-90 against a real router, not a navigate spy."
  - "**Absent is not `false`.** `searchUrlStateToAssetSearchFormData` maps `undefined -> undefined` and only `'yes'/'no' -> true/false` (searchUrlState.ts:300-303); `AssetSearchServiceImpl.java:73-75` early-returns with a `null` scope when the field is absent, so no identity is resolved and no predicate is added. Asserted at searchUrlState.test.ts:266-271."
  - "**The parse fails closed.** Only the two literal tokens survive; anything else (including `?favorites=maybe`, `true`, `1`, `YES`, empty, `%00`) becomes `undefined` (searchUrlState.ts:252-260). Asserted at searchUrlState.test.ts:240-244 and FavoritesFilter.test.tsx:77-80."
  - "**Identity is never a request input.** The wire field is a bare boolean; whose favorites is decided server-side from the security context (AssetSearchServiceImpl.java:76-78 -> CurrentUserIdentityResolver.java:26-29 -> ReactiveAssetSearchRepositoryImpl.java:331-332). A caller cannot ask for someone else's bucket."
  - "**Clear All clears it.** `Filters.tsx:37-38` rebuilds the URL from `{query, sort, myObjects}` only, so every filter — facets, `asset_kinds` and `favorites` — is dropped. Asserted at favorites-star-see-loop.spec.ts:204-208."
  - "**It renders unconditionally.** `Filters.tsx:66-68` places it in the rail with no feature flag and no 'add a filter' affordance, because it is the only remaining in-app route to the full favorites set."
- audiences:
  - "odd-platform-ui end user on the Catalog page — the person who starred assets and wants them back; under `LOGIN_FORM / OAUTH2 / LDAP` this is their private bucket."
  - "platform-operator running `auth.type=DISABLED` — sees `Favorites (shared) only` plus the inline-help consequence sentence, because every caller on that instance shares one bucket."
  - "Anyone holding an existing `/favorites` bookmark or shared link — `App.tsx:68-81` redirects them onto this control's pre-filtered URL rather than a blank page."

## dependencies_semantic

- requires-feature:
  - "The unified cross-kind search (`POST /api/search/assets`, ST-4/ST-5) — this control only narrows a result set that path produces; it has no effect on the legacy `/api/search` session path or the per-kind searches (AssetSearchServiceImpl.java:144-153 adapts `AssetSearchFormData` to `SearchFormData` and reads `favorites` separately)."
  - "Favoriting itself (#1815) — the star, the `favorite` table and `/api/favorites/*` are untouched by this slice; this control only READS the set they maintain (V0_0_94__create_favorite.sql:6-25)."
  - "`Search.tsx`'s facet-to-URL mirror — a hard runtime dependency, not a soft one: without `favorites: live.favorites` at Search.tsx:111 the scope is dropped by any Redux facet toggle."
- requires-config:
  - "`auth.type` (platform-side) — surfaced to this component only as `AppInfo.authType`; the value `'DISABLED'` is the single magic string that changes the rendering (FavoritesFilter.tsx:37). No build-time flag, no env var, no feature toggle controls this component."
- requires-runtime:
  - "React 18 — `React.useMemo` (FavoritesFilter.tsx:39), `React.useCallback` (:44)."
  - "`react-router-dom` — `useLocation` / `useNavigate` (:3, 34-35); `searchPath()` from the `routes` barrel returns the bare `/search` (searchRoutes.ts:3, 11)."
  - "`react-i18next` — `useTranslation` (:4, 33). Three `t()` keys, all present and translated in all 7 catalogs (`br ch en es fr hy ua`): `Favorites only` and `Favorites (shared) only` at en.json:679-680, the consequence sentence at en.json:659."
  - "`@tanstack/react-query` via `useAppInfo()` (lib/hooks/api/appInfo.ts:4-9) on the app client configured `retry: false`, `refetchOnWindowFocus: false`, no `staleTime`, no `initialData` (index.tsx:30-48)."
  - "`@mui/material` — `Grid`, `FormControlLabel` (:2, 59-67); the shared `Checkbox` wrapper is a thin `forwardRef` over MUI's (`shared/elements/Checkbox/Checkbox.tsx:5-9`)."
  - "`lib/search/searchUrlState` — `paramsToSearchState` / `searchStateToParams` (:7); this module is the contract, not a convenience."
- couples-to:
  - "`Filters.tsx` (parent) — imports at :19, renders at :68, and clears at :35-40."
  - "`Search.tsx` — the merge-back at :105-112 (the silent-failure seam) and the reader effect at :71-80 that turns a URL change into a new search session."
  - "`Results.tsx` — re-derives the request from the same URL (:84-87) and branches its empty state on the same param (:94-97, 213-221)."
  - "`App.tsx:68-81` — the retired `/favorites` route now `<Navigate replace>`s to a URL built by the same serialiser with `favorites: 'yes'`."
  - "`FavoritesColumn.tsx:28-33, 111` — the Catalog Overview panel's 'View all' deep-links to the same serialised URL; `:45-46, 58` is the `(shared)` labelling convention this component reuses."
  - "`AssetTypeFilter.tsx:24-45` — the sibling URL-only filter this component is a faithful clone of (same read memo, same live-URL re-parse on write, same bare `searchPath()` navigate)."

## upstream_callers

- entry_point: "ui_route:/search (index)"
  caller_node: "ts react-component:Filters.tsx-line-68"
  multiplicity_per_trigger: 1
  evidence: "Filters.tsx:19 (import) + :66-68 (`<FavoritesFilter />` rendered unconditionally between `DataEntityTypeFilter` and the Datasource `SingleFilterItem`). `Filters` is itself mounted by Search.tsx:135 inside the left sidebar."
  observation_class: ui-call

- entry_point: "ui_route:/search/:searchId (legacy session deep-link)"
  caller_node: "ts react-component:Filters.tsx-line-68"
  multiplicity_per_trigger: 1
  evidence: "App.tsx:82-85 mounts `<Search/>` for BOTH the index and the `:searchId` route, and `Search.tsx:135` renders `<Filters/>` on both. On the session route `location.search` is empty, so the control renders unchecked; clicking it navigates to the bare `searchPath()` (FavoritesFilter.tsx:53) and abandons the session route. Same behaviour as AssetTypeFilter.tsx:42."
  observation_class: ui-call

- entry_point: "ui_route:/favorites (retired tab URL — bookmarks + shared links)"
  caller_node: "ts app-route:App.tsx-line-68"
  multiplicity_per_trigger: 1
  evidence: "App.tsx:68-81 — a `<Route path={favoritesPath()}>` whose element is `<Navigate replace to={searchPath() + '?' + searchStateToParams({... favorites: 'yes'})} />`. The redirect lands on `/search?favorites=yes`, where this control renders CHECKED. `routes/favoritesRoutes.ts:1-4` survives deliberately as the redirect's source."
  observation_class: ui-call

- entry_point: "ui_button:overview-Favorites-panel-View-all"
  caller_node: "ts react-component:FavoritesColumn.tsx-line-111"
  multiplicity_per_trigger: 1
  evidence: "FavoritesColumn.tsx:28-33 builds the link with the same serialiser and `:111` renders it as `to={favoritesSearchLink}` on a `data-qa='favorites-view-all'` MuiLink (`:114`). Rendered only when the panel has at least one item (`:108`)."
  observation_class: ui-call

- entry_point: "unresolved"
  caller_node: "REFERENCE — any hand-written or shared `/search?favorites=...` URL"
  multiplicity_per_trigger: unresolved
  evidence: "The control's state is derived purely from `location.search` (FavoritesFilter.tsx:39-42), so an externally-authored URL is an entry point on equal footing with a click. This is the path that reaches the `favorites=no` state (P-396)."
  observation_class: ui-call
  unresolved: true

## downstream_side_effects

- side_effect_class: redirect-issue
  description: "Client-side route PUSH to `/search?<canonical params>` on every toggle. `navigate` is called without `{replace:true}` (FavoritesFilter.tsx:53), so each toggle is a distinct back/forward stop — consistent with the mirror, which also PUSHes (Search.tsx:114)."
  evidence: "FavoritesFilter.tsx:52-53"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "ui_route:/search (index)"
    - "ui_route:/search/:searchId (legacy session deep-link)"

- side_effect_class: page-render
  description: "Renders one checkbox + label, plus (only under `authType==='DISABLED'`) an information icon whose tooltip discloses that favorites are an instance-wide shared bucket. The label text itself is the disclosure of the STATE; the tooltip is the disclosure of the CONSEQUENCE."
  evidence: "FavoritesFilter.tsx:58-83 (label at :65, conditional tooltip at :68-82)"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "ui_route:/search (index)"
    - "ui_route:/search/:searchId (legacy session deep-link)"
    - "ui_route:/favorites (retired tab URL — bookmarks + shared links)"
    - "ui_button:overview-Favorites-panel-View-all"

- side_effect_class: external-call
  description: "Indirect but deterministic: the URL change alters `Search.tsx`'s `urlStateKey`, creating a fresh DE search session (`POST /api/search`), and alters `Results.tsx`'s `assetSearchFormData` memo, re-firing page 1 of `POST /api/search/assets` with `favorites: true|false`."
  evidence: "Search.tsx:64-80 (urlStateKey + the create effect) + Results.tsx:84-87 (the memo) + Results.tsx:109-113 (the settle-gated page-1 dispatch)"
  cardinality_per_call: "1 session create + 1 page-1 asset search per distinct URL state; see resource_boundaries for the mirror-window case that can produce an extra pair"
  reachable_from_entry_points:
    - "ui_route:/search (index)"
    - "ui_route:/favorites (retired tab URL — bookmarks + shared links)"
    - "ui_button:overview-Favorites-panel-View-all"

- side_effect_class: db-read
  description: "REFERENCE — the server-side consequence: a correlated `EXISTS` / `NOT EXISTS` against `favorite`, keyed on the caller's `(oidc_username, provider)` plus the polymorphic `(asset_kind, asset_id)` pair and `deleted_at IS NULL`. No JOIN is added to `searchFrom()`, so every other search query keeps its plan."
  evidence: "ReactiveAssetSearchRepositoryImpl.java:328-337 (the `(5b)` block; the explanatory comment is at :316-327) + AssetSearchServiceImpl.java:73-78"
  cardinality_per_call: "1 additional correlated subquery per candidate row, applied identically in `keysetPage` / `relevancePage` / `count` (ReactiveAssetSearchRepositoryImpl.java:57, 97, 110)"
  reachable_from_entry_points:
    - "ui_route:/search (index)"
    - "ui_route:/favorites (retired tab URL — bookmarks + shared links)"
    - "ui_button:overview-Favorites-panel-View-all"
  unresolved: true   # the repository node has no sidecar of its own yet

- side_effect_class: page-render
  description: "REFERENCE — with the scope on and no results, the sibling `Results.tsx` swaps the empty state from 'No matches found' to the teaching line 'Star an asset to pin it here.' This fires on `favorites === 'yes'` ONLY, so the `favorites=no` empty state stays generic (which is the correct copy for that direction)."
  evidence: "Results.tsx:94-97 (`isFavoritesScope`) + Results.tsx:213-221 (the ternary at :216-220)"
  cardinality_per_call: "1 when the scope is on and the result set is empty"
  reachable_from_entry_points:
    - "ui_route:/search (index)"
    - "ui_route:/favorites (retired tab URL — bookmarks + shared links)"
  unresolved: true   # Results.tsx has no sidecar at this commit

## implicit_adrs

- "**The Favorites scope is a URL param, not a Redux facet — and every URL-only param must be registered in the mirror by hand.** The decision and its failure mode are both written down in the source: `favorites` has no server-aggregated counts and no `SearchFacetNames` key, so it rides the URL like `sort` and `asset_kinds`, and the mirror at `Search.tsx:105-112` must merge it back or a sidebar click drops it." — evidence: searchUrlState.ts:40-54 + Search.tsx:95-112 — intent_anchor: "BEING URL-ONLY IS LOAD-BEARING: `Search.tsx`'s facet→URL mirror rebuilds the URL from the redux facet state, which carries none of these params, so `favorites` MUST be merged back there alongside `sort` and `assetKinds` — otherwise any sidebar facet toggle silently drops an active Favorites filter (the #1858 dropped-selection class)." (searchUrlState.ts:50-53) + "EVERY URL-ONLY PARAM MUST BE LISTED HERE. Omitting one is invisible in review and at runtime" (Search.tsx:102) — confidence: HIGH

- "**Ship the on/off toggle; keep the tri-state on the wire.** The control deliberately diverges from the issue's written All/Yes/No AC: the negative direction is judged a selected state indistinguishable from no filter, so it is removed from the screen but retained in the contract." — evidence: FavoritesFilter.tsx:17-21 + searchUrlState.ts:300-303 + contributor/CTRIB-061.md sections 6.1 and "GATE 1 — APPROVED 2026-08-31" — intent_anchor: "Shipped as a single on/off toggle rather than the All / Yes / No tri-state the issue proposed: a person stars tens of assets out of thousands, so \"everything I have NOT starred\" returns a list indistinguishable from \"All\" — a selected state that reads as broken, sitting between the user and the value they want. The wire contract stays an optional boolean, so `favorites=false` is still expressible via the API and a hand-written URL; only the dead on-screen option is gone." (FavoritesFilter.tsx:17-21) — confidence: HIGH

- "**A filter that replaces a navigation tab must be unconditionally visible.** The control is not behind an 'add a filter' affordance, because retiring the tab removed the feature's only advertisement." — evidence: FavoritesFilter.tsx:12-15 + Filters.tsx:66-68 — intent_anchor: "It replaces the retired top-level `/favorites` tab, so this control is the only in-app way to see \"everything I starred\" and therefore renders UNCONDITIONALLY in the Filters rail — never behind an \"add a filter\" affordance." (FavoritesFilter.tsx:13-15) — confidence: HIGH

- "**The `(shared)` label carries the STATE; inline help carries the CONSEQUENCE.** Under `auth.type=DISABLED` the label reuses the Catalog Overview panel's existing convention verbatim, and the sentence the retired tab showed as a banner is preserved in ODD's shipped `AppTooltip` + `InformationIcon` idiom rather than dropped." — evidence: FavoritesFilter.tsx:28-30, 65, 68-82 + FavoritesColumn.tsx:45-46, 58 — intent_anchor: "the label says so (the same `(shared)` convention the Catalog Overview panel uses), and the inline-help icon carries the CONSEQUENCE — the very sentence the retired tab displayed as a banner, so nothing is lost in the move." (FavoritesFilter.tsx:29-30) — confidence: HIGH

- "**Re-read the live URL on write; never close over parsed state.** The toggle handler re-parses `location.search` inside the callback so the whole search state is preserved and only this one dimension changes." — evidence: FavoritesFilter.tsx:46-51 — intent_anchor: "// Re-read the LIVE URL rather than closing over parsed state: the whole search state is preserved and only this dimension changes, exactly as AssetTypeFilter does." (FavoritesFilter.tsx:46-47) — confidence: HIGH

- "**Test hooks go on plain DOM elements, not on styled MUI icons.** The `data-qa` for the info affordance is on a wrapper `span` because a styled `SvgIcon` does not forward unknown DOM props — an explicitly recorded reason, not an accident of markup." — evidence: FavoritesFilter.tsx:75-80 — intent_anchor: "The hook lives on a plain span, not on InformationIcon: MUI's styled SvgIcon does not forward unknown DOM props, so a data-qa placed on the icon never reaches the rendered markup — and both the vitest case and IT-148 select on it." (FavoritesFilter.tsx:75-77) — confidence: HIGH

## bugs_limitations_corner_cases

- "**`?favorites=no` renders an UNCHECKED control over a narrowed list.** `isOn` tests `=== 'yes'` (FavoritesFilter.tsx:40) while the parser accepts both tokens (searchUrlState.ts:57-60, 252-260) and the projection sends the real boolean `false` (searchUrlState.ts:300-303), which becomes `DSL.not(exists(...))` server-side (ReactiveAssetSearchRepositoryImpl.java:336). The operator sees a result list with their starred assets missing and NO active filter anywhere in the sidebar to explain it; the only exits are check-then-uncheck (which writes `favorites=yes` first) or Clear All. Reachable by hand-written URL, by editing a shared link, and by any API-shaped client. The PARSE and PROJECTION of `no` are unit-covered (searchUrlState.test.ts:228, 269) — it is the RENDERED pairing of control and list that nothing asserts: `FavoritesFilter.test.tsx` has 7 cases and none for `no`; `favorites-star-see-loop.spec.ts` has no `favorites=no` case. Probe P-396 pins it." — evidence: FavoritesFilter.tsx:39-42 + searchUrlState.ts:252-260, 300-303 + ReactiveAssetSearchRepositoryImpl.java:328-337 + searchUrlState.test.ts:225-276 + P-396 — severity: MEDIUM

- "**The `(shared)` disclosure fails OPEN when `GET /api/info` is unavailable.** `isShared` is `appInfo?.authType === 'DISABLED'` (FavoritesFilter.tsx:37) over a `useQuery` with `retry: false` and no `initialData` (appInfo.ts:4-9 + index.tsx:39-43). While the request is in flight — and permanently if the single attempt fails — `appInfo` is `undefined`, so the component renders exactly what a secured instance renders: `Favorites only`, no info icon, no error. On a `DISABLED` instance the favorites bucket is still shared (CurrentUserIdentityResolver.java:26-29) and the operator is not told. The same gate is used by FavoritesColumn.tsx:46, RecentlyViewedColumn.tsx:32 and Overview.tsx:27, so this is a four-surface class, not a defect of this file. Probe P-397 pins both the transient and the outage." — evidence: FavoritesFilter.tsx:36-37 + appInfo.ts:4-9 + index.tsx:30-48 + CurrentUserIdentityResolver.java:26-29 + P-397 — severity: MEDIUM

- "**The consequence sentence is hover-only — there is no keyboard path to it.** `AppTooltip` wraps its children in a `Box` (`ChildrenContainer`, AppTooltipStyles.tsx:55-61) and this call site wraps the icon in a plain `span` with no `tabIndex` (FavoritesFilter.tsx:78). Neither element is focusable, so MUI's Tooltip focus listeners can never fire: a keyboard-only operator on a `DISABLED` instance gets `Favorites (shared) only` and nothing else. The checkbox itself is correctly labelled (MUI `FormControlLabel` associates the visible label with the input — IT-148 selects it by role + accessible name at favorites-star-see-loop.spec.ts:73), so this gap is specific to the inline help." — evidence: FavoritesFilter.tsx:68-82 + AppTooltip.tsx:48-65 + AppTooltipStyles.tsx:55-61 — severity: LOW

- "**Toggling the filter from a legacy `/search/{sessionId}` route abandons the session.** `handleToggle` navigates to the bare `searchPath()` (FavoritesFilter.tsx:53), which returns `/search` (searchRoutes.ts:11), while `Search.tsx:72` and `:119` deliberately disable both the URL reader and the mirror on the session route. So a user who arrived by a legacy shared session link and clicks Favorites is moved to the param URL and loses the session's server-side facet state with no warning. This is the established behaviour of the whole URL-only filter class — `AssetTypeFilter.tsx:42` does exactly the same — not a regression introduced here." — evidence: FavoritesFilter.tsx:53 + AssetTypeFilter.tsx:42 + Search.tsx:71-72, 118-121 + searchRoutes.ts:3, 11 — severity: LOW

- "**No substrate node exists for this component.** `grep -c FavoritesFilter lineage/odd-platform/nodes.jsonl` returns 0 (search root: that one file — it is the whole node index for this repo). The component postdates the last substrate scan, so this sidecar is unreachable from the ontology graph and from `/retrieve` until the `ui_components` axis is re-extracted. The same is true of its parent edge (`Filters.tsx` -> `FavoritesFilter`), so no `imported-by` edge will resolve either." — evidence: `grep -c FavoritesFilter lineage/odd-platform/nodes.jsonl` = 0, run 2026-08-31 (search root: `lineage/odd-platform/nodes.jsonl`) — severity: MEDIUM (methodology/navigability, not runtime)

- "**Favorites is absent from the ontology's concept vocabulary.** `grep -ci favorit lineage/odd-platform/concepts.yaml` returns 0 (search root: that one file). A feature that now owns a search filter, a table with two indexes, a redirect and a home-page panel has no canonical concept entry, so cross-feature reducers cannot join on it." — evidence: `grep -ci favorit lineage/odd-platform/concepts.yaml` = 0, run 2026-08-31 — severity: MEDIUM (methodology)

- "**Enriched against uncommitted working-tree state (LSN-033 class).** The branch `contrib/CTRIB-061-favorites-filter` has a single reflog entry and its tip equals its base `82e7e70e`, so nothing in this slice is committed. Every anchor in this sidecar is a working-tree line. If the slice is squashed or rebased before merge, re-resolve anchors rather than trusting them." — evidence: `.git/worktrees/odd-platform-ctrib061/logs/HEAD` (two entries: create at 82e7e70e, then `reset: moving to HEAD`) + `refs/heads/contrib/CTRIB-061-favorites-filter` = 82e7e70e29f05902640a2f69490f33fc65c68ba3 — severity: LOW (artefact hygiene)

- "**The newest-favorited ordering the retired tab provided is not reachable from this control.** `favorite.created_at` and the partial index built for exactly this purpose (`favorite_identity_created_active_idx`, V0_0_94__create_favorite.sql:23-25) exist, but the predicate is a correlated `EXISTS` that adds no join (ReactiveAssetSearchRepositoryImpl.java:316-337), so `created_at` is not available to `orderFields()`. With `?favorites=yes` and no query the list falls back to the browse default ordering. This is a known, maintainer-approved split — the ordering ships as sibling slice ST-7b, tracked by `issues/odd-platform/PLT-257` and forced at the 1.0.0 release gate by `backlog/docs/DOC-503`." — evidence: V0_0_94__create_favorite.sql:23-25 + ReactiveAssetSearchRepositoryImpl.java:316-337 + contributor/CTRIB-061.md section 6.2 + "GATE 1 — APPROVED 2026-08-31" — severity: LOW (accepted trade-off, mechanism on disk)

## stress_findings

```yaml
stress_findings:
  tunables:
    - location: "FavoritesFilter.tsx:37"
      name: "authType magic string 'DISABLED'"
      value: "'DISABLED'"
      questions:
        - q: "What when authType is any of the other three modes (LOGIN_FORM / OAUTH2 / LDAP)?"
          a: "`isShared` is false -> label `Favorites only`, no info icon. Correct: those modes resolve a real principal, so the bucket is per-user (CurrentUserIdentityResolver.java:26-27 returns the authenticated UserDto)."
          confidence: STATIC-INFERRED
          evidence: "FavoritesFilter.tsx:37, 65, 68 + CurrentUserIdentityResolver.java:26-29"
        - q: "What when authType is undefined — the in-flight window and the fetch-failure case?"
          a: "`appInfo?.authType === 'DISABLED'` evaluates false, producing a rendering IDENTICAL to a secured instance. `useAppInfo` is a plain useQuery (appInfo.ts:4-9) on a client with `retry: false` and no `initialData` (index.tsx:39-43), so a single failed GET /api/info leaves the disclosure permanently absent. Fails OPEN."
          confidence: STATIC-INFERRED
          evidence: "FavoritesFilter.tsx:36-37 + appInfo.ts:4-9 + index.tsx:30-48"
        - q: "What if a future auth mode is added (a fifth value)?"
          a: "It is treated as 'not shared'. The comparison is a bare string equality with no exhaustiveness check and no enum import — `authType` is read as a loose string (the test file mocks it as `'OAUTH2' as string`, FavoritesFilter.test.tsx:23-28). A new shared-bucket mode would silently render the private label."
          confidence: STATIC-INFERRED
          evidence: "FavoritesFilter.tsx:37 + FavoritesFilter.test.tsx:23-28"
        - q: "What does the operator see at each boundary?"
          a: "PROBE-NEEDED for the two undefined windows: whether the cold-mount transient is perceptible, and what the outage case actually renders end-to-end. P-397 measures both, with a route-interception applied-guard so an unapplied intercept cannot false-green it."
          confidence: PROBE-NEEDED
          evidence: "P-397"

    - location: "FavoritesFilter.tsx:40 and :50"
      name: "scope magic string 'yes'"
      value: "'yes' (read at :40; written at :50)"
      questions:
        - q: "What at favorites absent?"
          a: "`isOn` false; no param is written on the way in. Server-side `AssetSearchFormData.favorites == null` -> early return with a null scope, no identity resolved, no predicate added (AssetSearchServiceImpl.java:73-75)."
          confidence: STATIC-INFERRED
          evidence: "FavoritesFilter.tsx:39-42 + AssetSearchServiceImpl.java:73-75 + searchUrlState.test.ts:271"
        - q: "What at favorites='no' — the other accepted token?"
          a: "`isOn` is false (the control shows OFF) but the state is NOT absent: `paramsToSearchState` returns `'no'` (searchUrlState.ts:252-260, asserted searchUrlState.test.ts:228), the projection sends `favorites: false` (searchUrlState.ts:302, asserted searchUrlState.test.ts:269), and the repository applies `DSL.not(exists(...))` (ReactiveAssetSearchRepositoryImpl.java:336). An unchecked control over a narrowed list."
          confidence: STATIC-INFERRED
          evidence: "FavoritesFilter.tsx:40 + searchUrlState.ts:252-260, 300-303 + searchUrlState.test.ts:228, 269 + ReactiveAssetSearchRepositoryImpl.java:328-337"
        - q: "What at a garbage value (`?favorites=maybe`, `?favorites=1`, `?favorites=yes&favorites=no`)?"
          a: "All fail closed to `undefined`. The parse requires `typeof rawFavorites === 'string'` (so a repeated key, which query-string parses to an array, is rejected) AND membership in the two-token list (searchUrlState.ts:254-260). Asserted for `true`/`1`/`YES`/empty/`%00` at searchUrlState.test.ts:240-244 and for `maybe` at FavoritesFilter.test.tsx:77-80."
          confidence: STATIC-INFERRED
          evidence: "searchUrlState.ts:252-260 + searchUrlState.test.ts:240-244 + FavoritesFilter.test.tsx:77-80"
        - q: "What does the operator see at the 'no' boundary?"
          a: "PROBE-NEEDED — the rendered consequence (unchecked checkbox + starred asset absent from the list + the param surviving the mirror) requires the running stack. P-396 pins it with an un-starred foil so the narrowing is proved, not just the presence of a row."
          confidence: PROBE-NEEDED
          evidence: "P-396"

    - location: "FavoritesFilter.tsx:79"
      name: "InformationIcon width / height"
      value: "14 / 14"
      questions:
        - q: "Is this a behavioural tunable?"
          a: "No. A fixed pixel size on a decorative icon; it feeds no logic and no request. Recorded so 'I checked' is distinguishable from 'I missed it'. Related: `checkForOverflow={false}` at :70 disables AppTooltip's measurement effect (AppTooltip.tsx:37, 40-46), which is correct for a fixed-size icon that can never truncate, and does not affect whether the tooltip opens (`$isOverflowed` only sets `overflow`/`minWidth`, AppTooltipStyles.tsx:55-61)."
          confidence: STATIC-INFERRED
          evidence: "FavoritesFilter.tsx:70, 79 + AppTooltip.tsx:37, 40-46 + AppTooltipStyles.tsx:55-61"

    - location: "FavoritesFilter.tsx:59, 61, 64"
      name: "MUI spacing literals"
      value: "mt: 2 / ml: -0.25 / mr: 0.5 / mr: 1"
      questions:
        - q: "Is any of these a behavioural tunable?"
          a: "No — theme spacing multipliers on the Grid, the FormControlLabel and the Checkbox. No logic, no request, no user-visible behaviour beyond alignment in the rail."
          confidence: STATIC-INFERRED
          evidence: "FavoritesFilter.tsx:59, 61, 64"

  name_behavior_pairs:
    - name: "FavoritesFilter / the label `Favorites only`"
      promise: "Show me only the assets I have starred."
      implementation: "Writes `?favorites=yes`; Results.tsx:84-87 projects it to `AssetSearchFormData.favorites=true`; AssetSearchServiceImpl.java:76-78 resolves the caller identity and passes a FavoritesScopeDto; ReactiveAssetSearchRepositoryImpl.java:329-336 applies a correlated EXISTS on `favorite` filtered by that identity, `deleted_at IS NULL`, and the polymorphic (asset_kind, asset_id) pair — cross-kind, with no kind guard."
      drift: NONE
      operator_visible_consequence: "Name and implementation agree, across Data Entities, Terms and Query Examples alike."
      confidence: STATIC-INFERRED
      evidence: "FavoritesFilter.tsx:48-53, 65 + Results.tsx:84-87 + AssetSearchServiceImpl.java:73-78 + ReactiveAssetSearchRepositoryImpl.java:316-337"

    - name: "the label `Favorites (shared) only`"
      promise: "On this instance, favorites are one shared pool rather than mine."
      implementation: "Rendered when `appInfo.authType === 'DISABLED'` (FavoritesFilter.tsx:37, 65). Server-side that mode resolves the reserved sentinel `('__shared__','DISABLED')` for every caller (CurrentUserIdentityResolver.java:21-22, 28), so the predicate does key on one instance-wide bucket."
      drift: NONE
      operator_visible_consequence: "The label is true when it renders. The residual risk is the case where it does NOT render but should — see the fail-open finding."
      confidence: STATIC-INFERRED
      evidence: "FavoritesFilter.tsx:36-37, 65 + CurrentUserIdentityResolver.java:21-29"

    - name: "handleToggle (unchecking)"
      promise: "Turning the filter off returns me to the unfiltered list."
      implementation: "Sets `favorites: undefined` (FavoritesFilter.tsx:50), which `searchStateToParams` omits entirely (searchUrlState.ts:191-193) — it does NOT write `favorites=no`, which would be a different, real filter. Asserted at FavoritesFilter.test.tsx:92-96."
      drift: NONE
      operator_visible_consequence: "Correct, and the distinction is deliberate — the test title states it verbatim."
      confidence: STATIC-INFERRED
      evidence: "FavoritesFilter.tsx:44-53 + searchUrlState.ts:191-193 + FavoritesFilter.test.tsx:92-96"

    - name: "isOn (the control's checked state)"
      promise: "The checkbox reflects whether a Favorites narrowing is currently applied."
      implementation: "`paramsToSearchState(location.search).favorites === 'yes'` (FavoritesFilter.tsx:40) — it reflects only ONE of the two narrowing values the parser accepts and the wire honours."
      drift: DRIFT_NAME_VS_BEHAVIOR
      operator_visible_consequence: "On `?favorites=no` the checkbox reads OFF while the list is narrowed to the caller's un-starred assets, so the sidebar shows no active filter and the operator has no on-screen explanation for the missing rows."
      confidence: PROBE-NEEDED
      evidence: "FavoritesFilter.tsx:39-42 + searchUrlState.ts:252-260, 300-303 + P-396"

  orderings:
    - location: "searchUrlState.ts:164-169 (QUERY_STRING_OPTIONS) + FavoritesFilter.tsx:52"
      questions:
        - q: "What is the actual key ordering of the URL this control writes?"
          a: "Alphabetical — `query-string`'s `stringify` sorts keys by default and the module passes no `sort` override (searchUrlState.ts:164-169). `FavoritesFilter.test.tsx:87-89` pins the exact byte string `/search?favorites=yes&q=orders&sort=name` for input `?q=orders&sort=name`."
          confidence: STATIC-INFERRED
          evidence: "searchUrlState.ts:164-169, 175-195 + FavoritesFilter.test.tsx:82-90"
        - q: "Why does the ordering matter — what is the tie-break / equality contract?"
          a: "It is an equality contract, not a display order: `Search.tsx:113` navigates only when `nextParams !== location.search.replace(/^\\?/, '')`. A control that produced the same state in a different key order would be rewritten by the mirror on the next facet toggle, so the filter would appear to flicker or do nothing. This is why the component must use the shared serialiser rather than string concatenation."
          confidence: STATIC-INFERRED
          evidence: "Search.tsx:105-115 + searchUrlState.ts:158-169 + FavoritesFilter.test.tsx:85-86"
        - q: "Does any layer above re-sort or rewrite what this control wrote?"
          a: "Yes — `Search.tsx`'s debounced mirror rebuilds the URL from Redux facet state and merges the four URL-only dimensions back (Search.tsx:106-112). Because `favorites: live.favorites` is present at :111 the value survives; omitting that one line is the silent-failure mode, pinned by favorites-star-see-loop.spec.ts:189-200 (toggle the Datasource facet, assert `favorites=yes` is still in the URL and the list is still narrowed)."
          confidence: STATIC-INFERRED
          evidence: "Search.tsx:94-116 + favorites-star-see-loop.spec.ts:189-200"

    - location: "REFERENCE — the result-list ordering under `?favorites=yes`"
      questions:
        - q: "What is the actual ORDER BY at the lowest layer when the Favorites scope is on and there is no text query?"
          a: "REFERENCE — owned by `ReactiveAssetSearchRepositoryImpl.orderFields(state)` via `effectiveSort` (ReactiveAssetSearchRepositoryImpl.java:56, 58, 98, 241-243). The favorites predicate is a correlated EXISTS that adds no join, so it contributes nothing to the ordering; the browse default applies unchanged."
          confidence: REFERENCE
          evidence: "odd-platform java repository_reactive repository:ReactiveAssetSearchRepositoryImpl (no sidecar yet) + ReactiveAssetSearchRepositoryImpl.java:56-58, 241-243, 316-337"
        - q: "Is there an ordering the FEATURE promises that this path cannot deliver?"
          a: "Yes, and it is a known accepted split: the retired tab listed favorites newest-starred-first, served by `favorite_identity_created_active_idx` (V0_0_94__create_favorite.sql:23-25). The EXISTS form does not expose `favorite.created_at` to `orderFields()`, so a FAVORITED_AT ordering needs the cursor-pagination engine widened — deferred to sibling slice ST-7b, tracked by issues/odd-platform/PLT-257 and forced at the 1.0.0 gate by backlog/docs/DOC-503."
          confidence: STATIC-INFERRED
          evidence: "V0_0_94__create_favorite.sql:23-25 + ReactiveAssetSearchRepositoryImpl.java:316-337 + contributor/CTRIB-061.md section 6.2"
        - q: "Does this component impose or re-sort anything client-side?"
          a: "No. It renders one checkbox and writes a URL; it never touches the result array (FavoritesFilter.tsx:58-83)."
          confidence: STATIC-INFERRED
          evidence: "FavoritesFilter.tsx:32-87"

  auth_gates:
    - location: "FavoritesFilter.tsx:32-87 (the control) + AssetSearchServiceImpl.java:73-78 (the identity resolution it triggers)"
      endpoint: "ui_control:Favorites scope toggle -> POST /api/search/assets {favorites: true|false}"
      questions:
        - q: "What does this control do under each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "DISABLED — renders `Favorites (shared) only` + the info icon; the server resolves `('__shared__','DISABLED')`, so every caller's `favorites=yes` returns the SAME set and any caller can see (and, via the star, remove) any other caller's favorite. LOGIN_FORM / OAUTH2 / LDAP — renders `Favorites only`; the server resolves the authenticated principal's `(username, provider)`, so the scope is that user's private bucket."
          confidence: STATIC-INFERRED
          evidence: "FavoritesFilter.tsx:36-37, 65, 68-82 + CurrentUserIdentityResolver.java:21-29 + ReactiveAssetSearchRepositoryImpl.java:331-332"
        - q: "What does an unauthenticated caller see?"
          a: "Under DISABLED there is no authentication, and this control behaves as above. Under the other three modes the platform's HTTP security layer handles the request before the SPA route mounts, so the control never renders for an unauthenticated caller; enforcement is at the network layer, not here."
          confidence: STATIC-INFERRED
          evidence: "FavoritesFilter.tsx:32-87 (no auth check anywhere in the file) + CurrentUserIdentityResolver.java:26-29"
        - q: "What does a wrong-role caller see?"
          a: "The same control. There is no `WithPermissions` wrap, no `Permission` import, and no role check in this component or in `Filters.tsx:55-95`. That is the platform's read-collaborative posture (only mutations are permission-gated), not an omission: the control narrows a read the caller can already perform, and it cannot widen anyone's visibility because the predicate is an intersection with their own favorites."
          confidence: STATIC-INFERRED
          evidence: "FavoritesFilter.tsx:1-87 (no Permission/WithPermissions import) + Filters.tsx:55-95 + ReactiveAssetSearchRepositoryImpl.java:328-337"
        - q: "Where does the gate that matters actually live?"
          a: "In `CurrentUserIdentityResolver.resolve()` (CurrentUserIdentityResolver.java:26-29), reached from AssetSearchServiceImpl.java:76. The wire field is a bare boolean — there is no user id, owner id or username anywhere in the request — so the ONLY way to name a bucket is to be authenticated as its owner. The DTO's javadoc states this as the design constraint (FavoritesScopeDto.java:10-14)."
          confidence: STATIC-INFERRED
          evidence: "FavoritesScopeDto.java:10-14 + AssetSearchServiceImpl.java:76-78 + CurrentUserIdentityResolver.java:9-17, 26-29"

  resource_boundaries:
    - location: "FavoritesFilter.tsx:39-42 (useMemo) + :44-56 (useCallback)"
      kind: concurrency
      questions:
        - q: "Do the hook dependency arrays match their read sets? (the LSN-017 class)"
          a: "Yes — a clean counter-example. The memo reads `location.search` and depends on `[location.search]` (:41); the callback reads `location.search` and `navigate` and depends on `[location.search, navigate]` (:55). Nothing derived from a response is in either array, so there is no re-fire vector."
          confidence: STATIC-INFERRED
          evidence: "FavoritesFilter.tsx:39-42, 44-56"
        - q: "Can two rapid toggles corrupt the URL state?"
          a: "No. Each click recomputes from `paramsToSearchState(location.search)` inside the handler (:49), and `navigate` is a router push, not a merge. The worst case is two history entries for one intent."
          confidence: STATIC-INFERRED
          evidence: "FavoritesFilter.tsx:46-53"

    - location: "FavoritesFilter.tsx:36 (useAppInfo) -> appInfo.ts:4-9 -> index.tsx:30-48"
      kind: cache
      questions:
        - q: "What is the cache key, TTL and staleness window?"
          a: "Key `['appInfo']` (appInfo.ts:6), shared with FavoritesColumn.tsx:45, RecentlyViewedColumn.tsx:32 and Overview.tsx:27. The client sets `retry: false` and `refetchOnWindowFocus: false` and NO `staleTime` (index.tsx:39-43), so react-query's defaults apply: data is stale immediately and refetched on the next mount, cached data is served instantly meanwhile. A soft in-app hop from Overview therefore warms this control; a cold hard-load of /search does not."
          confidence: STATIC-INFERRED
          evidence: "appInfo.ts:4-9 + index.tsx:30-48 + FavoritesColumn.tsx:45 + Overview.tsx:27"
        - q: "What does the operator see in the stale/empty window?"
          a: "`Favorites only` with no info icon — byte-identical to a secured instance. There is no skeleton, no disabled state and no error branch in this component."
          confidence: STATIC-INFERRED
          evidence: "FavoritesFilter.tsx:36-37, 58-83"
        - q: "How long is that window in practice, and what happens on a hard failure?"
          a: "PROBE-NEEDED — P-397 measures the cold-mount transient (route-delayed /api/info) and the outage case (/api/info -> 500 with `retry:false`), with an applied-guard so an unapplied route intercept cannot false-green the run."
          confidence: PROBE-NEEDED
          evidence: "P-397"

    - location: "FavoritesFilter.tsx:52-53 (immediate navigate) vs Search.tsx:94-116 (400 ms debounced mirror)"
      kind: concurrency
      questions:
        - q: "What happens if the user toggles Favorites inside the mirror's pending 400 ms window after a Redux facet click?"
          a: "The end state is correct, by construction. This control writes a URL built from the OLD facets plus the new scope; the mirror then fires and rebuilds from Redux facets while merging `favorites: live.favorites` from the freshly-written URL (Search.tsx:105-112). Facets come from Redux, URL-only params come from the URL, and neither authority is overwritten by the other."
          confidence: STATIC-INFERRED
          evidence: "FavoritesFilter.tsx:48-53 + Search.tsx:94-116"
        - q: "Is there a cost to that intermediate URL?"
          a: "Yes: the intermediate state is a distinct `urlStateKey`, so `Search.tsx`'s reader effect (:71-80) can dispatch a session create for it before the mirror's final write dispatches another. The `isSearchCreating` guard at :75 DEFERS rather than cancels (the effect re-runs when the create clears, so the newest state always runs), so the visible outcome is correct but a redundant `POST /api/search` round-trip is possible inside the window. Exact cardinality is not statically determinable — it depends on request timing against the 400 ms debounce — and is not claimed here."
          confidence: STATIC-INFERRED
          evidence: "Search.tsx:64-80 (reader + the isSearchCreating defer at :75) + Search.tsx:94-116"

  request_inputs:
    - location: "FavoritesFilter.tsx:40 (read) — query param `favorites`"
      input_kind: query-param
      input_name: "favorites"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "'Restrict these search results to the assets I have marked as favorites.' The value spelling (`yes`/`no`) additionally promises a human-editable, shareable URL rather than an opaque token — stated as the intent in searchUrlState.ts:46-48."
          confidence: STATIC-INFERRED
          evidence: "searchUrlState.ts:40-55 + FavoritesFilter.tsx:11-31"
        - q: "When supplied, what does the implementation USE it for?"
          a: "Full trace: FavoritesFilter.tsx:40 (control state) and Results.tsx:84-87 / 94-97 (request + empty-state) both read it via searchUrlState.ts:252-260 -> projected at searchUrlState.ts:300-303 into `AssetSearchFormData.favorites` -> AssetSearchServiceImpl.java:73-78 (null-check, then `currentUserIdentityResolver.resolve()` and `FavoritesScopeDto.of(identity, favorites)`) -> threaded through keysetPage/relevancePage/count (ReactiveAssetSearchRepositoryImpl.java:57, 97, 110) -> conditions() -> the `(5b)` correlated EXISTS/NOT EXISTS on FAVORITE at :328-337."
          confidence: STATIC-INFERRED
          evidence: "FavoritesFilter.tsx:40 + Results.tsx:84-97 + searchUrlState.ts:252-260, 300-303 + AssetSearchServiceImpl.java:73-78 + ReactiveAssetSearchRepositoryImpl.java:57, 97, 110, 328-337"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES on the entity axis: the param says 'favorites' and the SQL touches the `favorite` table, keyed on the caller's own identity — no translation to a different concept (the LSN-020 shape is absent here). The one gap is representational, not semantic: the RENDERED control covers only the `yes` half of the param's accepted domain."
          drift: MINOR
          confidence: STATIC-INFERRED
          evidence: "ReactiveAssetSearchRepositoryImpl.java:328-337 + FavoritesFilter.tsx:39-42"
        - q: "What does a caller see when their assumption about the param is wrong?"
          a: "Two cases, both real. (a) `?favorites=no` — an unchecked control over a list narrowed to their UN-starred assets (P-396). (b) On a DISABLED instance, `favorites=yes` returns the shared bucket, so a caller who assumes it is personal sees other people's stars; the label and the tooltip exist precisely to head this off, and they only render when `/api/info` has resolved (P-397)."
          confidence: PROBE-NEEDED
          evidence: "P-396 + P-397 + CurrentUserIdentityResolver.java:21-29"
        - q: "Is there a field that DOES match the input's name and is NOT being used? (available-but-unused)"
          a: "YES — `favorite.created_at`, plus the partial index built for exactly this access pattern (`favorite_identity_created_active_idx ... (oidc_username, provider, created_at DESC) WHERE deleted_at IS NULL`, V0_0_94__create_favorite.sql:23-25). The correlated EXISTS never projects it, so the one thing the retired tab did better than this filter — newest-starred-first — is unreachable from this path. That is the fix anchor for ST-7b, and it is why the split was a product decision rather than an omission."
          confidence: STATIC-INFERRED
          evidence: "V0_0_94__create_favorite.sql:23-25 + ReactiveAssetSearchRepositoryImpl.java:316-337"
      routes_to_finding: "bugs_limitations_corner_cases[0] (?favorites=no) AND bugs_limitations_corner_cases[7] (ordering unreachable) AND stress_findings.name_behavior_pairs.isOn"

    - location: "FavoritesFilter.tsx:45, 50 — the toggle's `checked` argument, written into the param"
      input_kind: form-field
      input_name: "checked (MUI FormControlLabel onChange)"
      questions:
        - q: "What does the input NAME promise the caller?"
          a: "Standard checkbox semantics: checked = the filter is applied, unchecked = it is not."
          confidence: STATIC-INFERRED
          evidence: "FavoritesFilter.tsx:60-67"
        - q: "When supplied, what does the implementation USE it for?"
          a: "`favorites: checked ? ('yes' as const) : undefined` (FavoritesFilter.tsx:50), serialised at :52 and navigated at :53. Never `'no'`."
          confidence: STATIC-INFERRED
          evidence: "FavoritesFilter.tsx:44-56"
        - q: "Does the implementation's actual scope MATCH the promise?"
          a: "MATCHES. Unchecked means 'no filter', which is what removing the key produces (searchUrlState.ts:191-193). Asserted round-trip at FavoritesFilter.test.tsx:82-96."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "FavoritesFilter.tsx:50 + searchUrlState.ts:191-193 + FavoritesFilter.test.tsx:82-96"
        - q: "For TRANSLATES_SILENTLY: what would a caller see when wrong?"
          a: "N/A — no silent translation on the write path. The one asymmetry (unchecking cannot reach `no`) is the deliberate two-state UI over a three-state param, recorded in implicit_adrs[1]."
          confidence: STATIC-INFERRED
          evidence: "FavoritesFilter.tsx:17-21, 50"
        - q: "Is there a closer-aligned field unused?"
          a: "NONE. `SearchUrlState` carries exactly the three states this control needs (searchUrlState.ts:154-155); nothing better-aligned exists to write into."
          confidence: STATIC-INFERRED
          evidence: "searchUrlState.ts:143-156"

    - location: "FavoritesFilter.tsx:36-37 — the `authType` field of the AppInfo response"
      input_kind: body-field
      input_name: "authType"
      questions:
        - q: "What does the input NAME promise?"
          a: "The platform's active authentication mode."
          confidence: STATIC-INFERRED
          evidence: "FavoritesFilter.tsx:36-37 + appInfo.ts:4-9"
        - q: "When supplied, what does the implementation USE it for?"
          a: "Exactly two things: choosing between two translation keys (:65) and gating the inline-help icon (:68). It never reaches a request and never changes the scope semantics — the shared-bucket behaviour is decided entirely server-side by CurrentUserIdentityResolver, whatever this field says."
          confidence: STATIC-INFERRED
          evidence: "FavoritesFilter.tsx:36-37, 65, 68-82 + CurrentUserIdentityResolver.java:26-29"
        - q: "Does the actual scope MATCH the promise?"
          a: "MATCHES when the value is present. The failure is the ABSENT case: `appInfo?.authType` collapses undefined into the same branch as a secured mode, so the disclosure is skipped rather than deferred — no loading state, no error state."
          drift: MINOR
          confidence: STATIC-INFERRED
          evidence: "FavoritesFilter.tsx:36-37 + index.tsx:39-43"
        - q: "What does a caller see when the assumption is wrong?"
          a: "PROBE-NEEDED — on a DISABLED instance whose /api/info is unavailable the operator is shown a private-looking label over a shared bucket, with no other warning on the page. P-397 asserts exactly that, including that no other element on the page carries the shared-bucket sentence."
          confidence: PROBE-NEEDED
          evidence: "P-397"
        - q: "Is there a closer-aligned field unused? (available-but-unused)"
          a: "Within this component, no — but the failure is a shared-hook shape, not a field shape: `useAppInfo()` exposes react-query's `isLoading` / `isError`, and this call site destructures only `data` (FavoritesFilter.tsx:36). The unused signal is `isError`/`isLoading`, and the same omission repeats at FavoritesColumn.tsx:45, RecentlyViewedColumn.tsx:32 and Overview.tsx:27 — so the fix seam is the hook, not this file."
          confidence: STATIC-INFERRED
          evidence: "FavoritesFilter.tsx:36 + appInfo.ts:4-9 + FavoritesColumn.tsx:45 + Overview.tsx:27"
      routes_to_finding: "bugs_limitations_corner_cases[1] (the fail-open disclosure) AND probes_emitted.P-397"

  probes_emitted:
    - probe_id: P-396
      question: "On `?favorites=no`, does the control render unchecked while the result list is narrowed to the caller's un-starred assets?"
      probe_path: "lineage/odd-platform/probes/P-396.yaml"
    - probe_id: P-397
      question: "Under `auth.type=DISABLED`, does the `(shared)` label + inline-help disclosure disappear silently while /api/info is in flight, and permanently when it fails (retry:false)?"
      probe_path: "lineage/odd-platform/probes/P-397.yaml"

  stress_summary:
    triggers_total: 17
    questions_total: 46
    answers_static_inferred: 39
    answers_probe_needed: 6
    answers_reference: 1
    drift_flags: 1   # isOn — the control reflects only 'yes' of a two-value narrowing domain
```

## docs_link_semantic

- declared_docs: []            # no `@docs` / `// @docs:` annotation anywhere in FavoritesFilter.tsx (whole-file read, 87 lines)
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/data-discovery/search"
    anchor: ""
    rationale: "The canonical live page for the Catalog search Filters rail — the surface this control is added to. WebFetched live in this session."
    last_verified_at: "2026-08-31T00:00:00Z"
    last_verified_status: 200
    last_verified_via: "WebFetch in this session against the live URL"
    confidence: HIGH
  - url: "https://docs.opendatadiscovery.org/features/data-discovery/favorites"
    anchor: ""
    rationale: "The expected home of the Favorites feature page. Probed live to establish whether the feature is published at all."
    last_verified_at: "2026-08-31T00:00:00Z"
    last_verified_status: 404
    confidence: HIGH
  - url: "https://docs.opendatadiscovery.org/data-discovery/favorites"
    anchor: ""
    rationale: "The alternate (non-`features/`) path shape, probed to rule out a URL-shape miss before recording an absence."
    last_verified_at: "2026-08-31T00:00:00Z"
    last_verified_status: 404
    confidence: HIGH
  - url: "https://docs.opendatadiscovery.org/features/data-discovery/catalog-overview"
    anchor: ""
    rationale: "The page describing the Overview panel whose 'View all' this slice re-points at the pre-filtered search."
    last_verified_at: "2026-08-31T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
- fetched_excerpts: |
    Live WebFetch, 2026-08-31, `https://docs.opendatadiscovery.org/features/data-discovery/search` (200):
    "The Filters panel on the Catalog page exposes these seven facets: 1. Datasource ... 2. Type ...
    3. Namespace ... 4. Owner ... 5. Tag ... 6. Groups ... 7. Statuses." The fetch reported verbatim:
    "The term 'Favorites,' 'favorite,' 'starred,' or 'Asset type' does not appear anywhere on this page."
    'My Objects' IS described, as a tab: "The subset of the above owned by the authenticated user.
    The personal-namespace tab."

    Live WebFetch, 2026-08-31, `https://docs.opendatadiscovery.org/features/data-discovery/favorites` (404):
    "The URL `features/data-discovery/favorites` does not exist. This page may have been moved,
    renamed, or deleted."

    Live WebFetch, 2026-08-31, `https://docs.opendatadiscovery.org/data-discovery/favorites` (404):
    "The URL `data-discovery/favorites` does not exist. This page may have been moved, renamed, or deleted."

    Live WebFetch, 2026-08-31, `https://docs.opendatadiscovery.org/features/data-discovery/catalog-overview` (200):
    reported no occurrence of "Favorites", "favorite", "starred", "star", or a "View all"/"See all" link,
    and no reference to a top-level Favorites tab or page.
- doc_drift_findings:
  - "**The live manual is silent on Favorites in its entirety — there is no published page for the retired tab OR the new filter.** Three live fetches (two 404s + a catalog-overview page with zero mentions) establish the absence; it is not a stale-page problem but an unpublished-feature one, consistent with the finding in contributor/CTRIB-061.md section 12 that Favorites is absent from releases 0.29.0 / 0.28.0 / 0.27.13. Consequence for this node: NO live-doc claim can be cited for or against any behaviour here, in either direction."
  - "**The live search page's facet list is three controls behind the Filters rail this component ships into.** The page enumerates exactly seven facets (Datasource / Type / Namespace / Owner / Tag / Groups / Statuses); `Filters.tsx:64-87` renders `AssetTypeFilter` (ST-4), `DataEntityTypeFilter` and now `FavoritesFilter` in addition to those seven. This is release-train drift, not an error: all three ride the 1.0.0 train. Severity: MEDIUM once 1.0.0 publishes, LOW before."
  - "**The ontology's own vocabulary has the same gap as the manual**: `grep -ci favorit lineage/odd-platform/concepts.yaml` returns 0 and `grep -ril favorit lineage/odd-platform/feature-flows/detail` returns zero files (search roots named). Favorites now spans a table, two indexes, a write API, a home panel, a redirect and a search filter with no concept entry and no feature flow to anchor them."

**Release-train marker** *(`adrs/drafts/release-train-doc-gating.md`)*: the documentation for this control is authored on the **`release/1.0.0`** train, not on docs `main`, so it cannot be verified live and no live fetch was attempted against it.

- pending_release: "1.0.0"
  train_ref: "documentation@release/1.0.0 — docs/data-discovery/favorites.md (frontmatter :2, intro :7, panel :29, tab section :31-33), docs/data-discovery/catalog-overview.md:43, docs/data-discovery/search.md (facet list); routing recorded in contributor/CTRIB-061.md `docs_routing` frontmatter and section 7 step 11, with backlog/docs/DOC-503 as the release-gate hook."
  verification_note: "NOT verified in this session. The local `documentation` checkout has no `docs/data-discovery/favorites.md` in its working tree (a Glob for `**/*favorit*` over the whole repo returns only `.git/refs/heads/docs/CTRIB-061-favorites-filter` and its reflog), so the train content was not readable here — only the existence of the branch ref. Confidence stays LOW until the 1.0.0 gate publishes and a later enrichment verifies the live page."
  confidence: LOW

## security

- **auth_mode_relevance**: `DISABLED | LOGIN_FORM | OAUTH2 | LDAP` — all four, but this component only *renders differently* for `DISABLED`. `FavoritesFilter.tsx:37` is the single coupling: `const isShared = appInfo?.authType === 'DISABLED';`. The scope semantics themselves are decided server-side for every mode by `CurrentUserIdentityResolver.java:26-29`, which never returns empty (it falls back to the shared sentinel), so unlike my-objects there is no empty-page short-circuit.
- **ingestion_filter_relevance**: `NO — UI surface, not ingestion.` This component touches only `/search` routing and the unified `POST /api/search/assets` read path.
- **authorization_assertions**: `[]` — no `WithPermissions`, no `Permission` import, no programmatic check in this component or in its parent (`FavoritesFilter.tsx:1-87`; `Filters.tsx:1-98`). Per ODD's read-collaborative posture this is by design for a read-narrowing control; it is recorded, not flagged. The one assertion that matters is server-side and is an identity resolution, not a permission: `currentUserIdentityResolver.resolve()` (AssetSearchServiceImpl.java:76).
- **owner_scoping**: `N/A — this control is identity-scoped, not owner-scoped.` Deliberately so: `FavoritesScopeDto.java:11-12` records that the key is the `(oidc_username, provider)` tuple and "NOT the internal Owner that `my_objects` uses". The two axes compose as independent ANDs (AssetSearchServiceImpl.java:84-91).
- **data_exposure**:
  - "Under `LOGIN_FORM / OAUTH2 / LDAP`: nothing new is exposed. The predicate is an intersection with the caller's own favorites, so it can only ever narrow a result set they could already retrieve."
  - "Under `auth.type=DISABLED`: `favorites=yes` returns the instance-wide shared bucket, i.e. every user's stars, to every caller — a real cross-user read. This is inherent to the mode (CurrentUserIdentityResolver.java:13-16, 28), and this control's job is to DISCLOSE it, which it does through the label (:65) and the tooltip (:71-73)."
  - "The rendered DOM discloses the platform's auth posture: the presence of `[data-qa=filter-favorites-info]` and the `(shared)` label tell any viewer that authentication is disabled (FavoritesFilter.tsx:65, 78). That is the intended trade — the warning is worth more than the concealment on a mode the tooltip itself says not to run in production."
- **known_security_gaps**:
  - "**The shared-bucket disclosure fails open on an /api/info outage** (retry:false, no initialData): the operator on a DISABLED instance is shown the same label a secured instance shows. Class finding across four surfaces sharing the `['appInfo']` key." — evidence: FavoritesFilter.tsx:36-37 + appInfo.ts:4-9 + index.tsx:39-43 + P-397 — severity: MEDIUM
  - "**The consequence sentence has no keyboard/assistive path** — it lives on a non-focusable `span`/`Box` pair, so it opens on pointer hover only." — evidence: FavoritesFilter.tsx:78 + AppTooltip.tsx:61 + AppTooltipStyles.tsx:55-61 — severity: LOW
  - "**No IDOR surface** (recorded as a verified negative, since a favorites filter is exactly where one would look): the wire field is a bare boolean; there is no user id, username, owner id or provider anywhere in `AssetSearchFormData.favorites`'s path, so a caller cannot address another bucket." — evidence: FavoritesScopeDto.java:10-14 + AssetSearchServiceImpl.java:76-78 + ReactiveAssetSearchRepositoryImpl.java:331-332 — severity: N/A (verified absent)

## performance

- **hot_paths**:
  - "Each toggle is one router push that changes `Search.tsx`'s `urlStateKey`, which creates a fresh DE search session (`POST /api/search`) and re-fires page 1 of `POST /api/search/assets`. The component itself does no I/O." — evidence: FavoritesFilter.tsx:52-53 + Search.tsx:64-80 + Results.tsx:109-113
  - "Server-side, the scope adds one correlated `EXISTS`/`NOT EXISTS` per candidate row to THREE statements per request — `keysetPage`/`relevancePage` AND `count` (ReactiveAssetSearchRepositoryImpl.java:57, 97, 110), which run zipped in parallel (AssetSearchServiceImpl.java:115-116). The subquery probes the UNIQUE 4-tuple index `favorite_identity_asset_key`." — evidence: ReactiveAssetSearchRepositoryImpl.java:328-337 + V0_0_94__create_favorite.sql:20-21 + AssetSearchServiceImpl.java:115-116
- **throughput_characteristics**:
  - "One navigation per click; no debounce on this control (unlike the mirror's 400 ms at Search.tsx:116). A user toggling repeatedly issues one session-create + one asset-search per toggle."
  - "The negative direction is an anti-join rather than a materialised `NOT IN` — chosen for plan quality and NULL-safety, stated at ReactiveAssetSearchRepositoryImpl.java:321-323."
- **resource_allocation**:
  - "Negligible in the component: two memoised closures and one conditional subtree (FavoritesFilter.tsx:39-56, 68-82). `useAppInfo` adds no request of its own on a warm `['appInfo']` cache."
- **scaling_characteristics**:
  - "Stateless and instance-free — the component holds no module-level mutable state (FavoritesFilter.tsx:32-87), so it is safe under React StrictMode double-render; the only external effect is `navigate`, which is idempotent for a given target URL."
  - "`searchFrom()` is deliberately NOT modified by the favorites predicate, so every other search query keeps its existing plan — the scaling cost is confined to requests that actually carry the scope." — evidence: ReactiveAssetSearchRepositoryImpl.java:324 + :248-259 (searchFrom, untouched)
- **known_performance_gaps**:
  - "**A redundant session create is possible when a toggle lands inside the mirror's 400 ms window** — the intermediate URL is a distinct `urlStateKey` and the reader's `isSearchCreating` guard defers rather than cancels. Correct end state, one extra round-trip. Cardinality not claimed (timing-dependent)." — evidence: Search.tsx:71-80 (guard at :75) + Search.tsx:94-116 + FavoritesFilter.tsx:52-53 — severity: LOW
  - "**The anti-join direction is unmeasured on a large corpus at this commit.** The approved plan makes `EXPLAIN (ANALYZE, BUFFERS)` on both directions a Phase-D gate (contributor/CTRIB-061.md section 7 step 10), and that row of the test ledger reads `pending Phase D`. No performance claim about the `NOT EXISTS` path is made here." — evidence: contributor/CTRIB-061.md section 9 (test ledger) + ReactiveAssetSearchRepositoryImpl.java:328-337 — severity: MEDIUM (unmeasured, not known-bad)

## tests_coverage_semantic

- covered_behaviours:
  - behaviour: "The control is unchecked with no scope in the URL, checked on `?favorites=yes`, and fails closed on `?favorites=maybe`."
    test_class: unit
    test_files: ["odd-platform-ui/src/components/Search/Filters/FavoritesFilter/__tests__/FavoritesFilter.test.tsx:67-80"]
  - behaviour: "Clicking it writes the exact canonical URL `/search?favorites=yes&q=orders&sort=name` (asserted through a real router + location probe, not a navigate spy — a spy passes on a byte-divergent URL)."
    test_class: unit
    test_files: ["odd-platform-ui/src/components/Search/Filters/FavoritesFilter/__tests__/FavoritesFilter.test.tsx:82-90"]
  - behaviour: "Clicking it OFF removes the param entirely rather than writing `favorites=no`."
    test_class: unit
    test_files: ["odd-platform-ui/src/components/Search/Filters/FavoritesFilter/__tests__/FavoritesFilter.test.tsx:92-96"]
  - behaviour: "Under a non-DISABLED authType the label is plain and NO info icon renders; under DISABLED the label says `(shared)` AND the info icon is present."
    test_class: unit
    test_files: ["odd-platform-ui/src/components/Search/Filters/FavoritesFilter/__tests__/FavoritesFilter.test.tsx:98-111"]
  - behaviour: "The param's own contract: `yes` and `no` both round-trip through the URL; garbage (`true`/`1`/`YES`/empty/`%00`) fails closed; `yes|no` project to the wire booleans while absent stays absent; and `favorites` never reaches the legacy `SearchFormData`."
    test_class: unit
    test_files: ["odd-platform-ui/src/lib/search/__tests__/searchUrlState.test.ts:225-276"]
  - behaviour: "Clicking the control on a real stack narrows the list (the starred asset present, an un-starred foil matching the same token absent) and puts `favorites=yes` in the address bar."
    test_class: integration
    test_files: ["integration-tests/e2e/specs/favorites-star-see-loop.spec.ts:170-187 (oracle at :77-86)"]
  - behaviour: "Toggling the Datasource redux facet PRESERVES an active favorites scope in the URL and the list stays narrowed — the #1858 dropped-selection class."
    test_class: integration
    test_files: ["integration-tests/e2e/specs/favorites-star-see-loop.spec.ts:189-200"]
  - behaviour: "Clear All drops the favorites scope; unchecking removes the param rather than writing `no`."
    test_class: integration
    test_files: ["integration-tests/e2e/specs/favorites-star-see-loop.spec.ts:202-215"]
  - behaviour: "`/favorites` redirects to the pre-filtered search instead of a blank page, and no Favorites toolbar tab remains."
    test_class: integration
    test_files: ["integration-tests/e2e/specs/favorites-star-see-loop.spec.ts:133-150"]
  - behaviour: "The Overview panel's 'View all' lands on the search already narrowed to favorites."
    test_class: integration
    test_files: ["integration-tests/e2e/specs/favorites-star-see-loop.spec.ts:152-168"]
  - behaviour: "Under DISABLED the rendered label reads `Favorites (shared) only` and the inline-help hook is present on the running stack."
    test_class: integration
    test_files: ["integration-tests/e2e/specs/favorites-star-see-loop.spec.ts:250-260"]
  - behaviour: "With the scope on and nothing starred, the results area teaches the star rather than saying 'No matches found'."
    test_class: integration
    test_files: ["integration-tests/e2e/specs/favorites-star-see-loop.spec.ts:262-273"]
  - behaviour: "The scope is cross-kind — a starred Term is reachable through the same filter."
    test_class: integration
    test_files: ["integration-tests/e2e/specs/favorites-star-see-loop.spec.ts:220-248"]
- uncovered_behaviours:
  - behaviour: "`?favorites=no` — the control renders unchecked while the list is narrowed to un-starred assets."
    test_class: integration
    criticality: HIGH
    note: "The PARSE and PROJECTION halves ARE unit-covered (searchUrlState.test.ts:228, 269) and the SQL direction is covered in the backend unit bucket (AssetSearchFavoritesIntegrationTest, per contributor/CTRIB-061.md section 13). What nothing asserts is the RENDERED pairing — control state against list contents — which is precisely where the defect lives. P-396 emitted."
  - behaviour: "The `(shared)` disclosure while /api/info is in flight, and after it fails (retry:false)."
    test_class: security
    criticality: HIGH
    note: "The vitest cases mock `useAppInfo` to always return data (FavoritesFilter.test.tsx:26-29), so the undefined branch is structurally unreachable in that harness. P-397 emitted."
  - behaviour: "The tooltip actually OPENS and shows the consequence sentence (hover), and whether any keyboard path reaches it."
    test_class: unit
    criticality: MEDIUM
    note: "FavoritesFilter.test.tsx:110 asserts only that the `[data-qa=filter-favorites-info]` hook EXISTS; favorites-star-see-loop.spec.ts:259 asserts only that it is visible. Neither opens it. A hover + `getByRole('tooltip')` assertion would close this cheaply."
  - behaviour: "Toggling the control from a legacy `/search/{sessionId}` route (session abandoned, scope applied on the param URL)."
    test_class: integration
    criticality: LOW
    note: "Class behaviour shared with AssetTypeFilter; worth one shared assertion rather than one per filter."
  - behaviour: "Each of the 7 locales renders the two new labels (not just key parity)."
    test_class: unit
    criticality: MEDIUM
    note: "`i18n-key-parity.test.ts` proves the keys exist in all 7 catalogs (en.json:659, 679-680 + siblings); it does not prove the control RENDERS them under a non-en locale — the distinction that memory `feedback_i18n_done_is_rendered_page_not_catalog_parity` was written for."
- test_files:
  - "odd-platform-ui/src/components/Search/Filters/FavoritesFilter/__tests__/FavoritesFilter.test.tsx (7 cases, :66-112)"
  - "odd-platform-ui/src/lib/search/__tests__/searchUrlState.test.ts:225-276 (the param's parse / serialise / projection contract)"
  - "odd-platform-ui/src/locales/__tests__/i18n-key-parity.test.ts (the repo's existing key-parity guard; CI does not run the FE suite, so it only fires when run explicitly)"
  - "integration-tests/e2e/specs/favorites-star-see-loop.spec.ts (IT-148, re-grounded on the narrowing oracle at :77-86)"
- gaps: |
    Coverage of this component's OWN contract is strong and unusually well-shaped: the unit file
    asserts the write path through a real router (a navigate spy would have passed on a
    byte-divergent URL, which is the actual failure mode), and IT-148 asserts NARROWING with an
    un-starred foil rather than mere presence — so it is RED on base rather than trivially green.

    The two real holes are both in the `undefined`/`no` corners the happy path never visits.
    (1) `?favorites=no` is exercised at the serialiser layer but never as a rendered state, so the
    relationship between an unchecked control and a narrowed list is untested in either bucket —
    the highest-leverage gap, and an integration one, because the defect IS that relationship.
    (2) The `(shared)` disclosure is structurally untestable in the current unit harness, because
    `useAppInfo` is mocked to always return data (FavoritesFilter.test.tsx:26-29) — so the one
    branch where a security-relevant warning can silently vanish is the one branch the tests cannot
    see. Making the mock return `{ data: undefined }` for one case would close half of it at unit
    cost.

    Worst class overall: **security** — one HIGH-criticality uncovered behaviour and no test anywhere
    exercising the disclosure's failure mode.

## sources

- understanding ← FavoritesFilter.tsx:1-87 + searchUrlState.ts:40-60, 300-303 + Search.tsx:94-116 + Filters.tsx:66-68 + App.tsx:63-81
- concepts.entities ← searchUrlState.ts:55, 57-60, 154-155, 293-304 + FavoritesScopeDto.java:22-26 + CurrentUserIdentityResolver.java:21-29 + V0_0_94__create_favorite.sql:6-25 + appInfo.ts:4-9 + FavoritesFilter.tsx:8-9, 68-82
- concepts.operations ← FavoritesFilter.tsx:39-56, 65, 68-82 + Results.tsx:84-87, 109-113 + Search.tsx:64-80
- concepts.invariants ← FavoritesFilter.tsx:32-56 + searchUrlState.ts:164-169, 175-195, 252-260, 300-303 + AssetSearchServiceImpl.java:73-78 + CurrentUserIdentityResolver.java:26-29 + ReactiveAssetSearchRepositoryImpl.java:331-332 + Filters.tsx:35-40, 66-68 + searchUrlState.test.ts:240-244, 266-271 + FavoritesFilter.test.tsx:77-80, 82-90 + favorites-star-see-loop.spec.ts:204-208
- dependencies_semantic ← FavoritesFilter.tsx:1-9, 33-37 + searchRoutes.ts:3, 11 + appInfo.ts:4-9 + index.tsx:30-48 + Checkbox.tsx:5-9 + en.json:659, 679-680 (and the six sibling catalogs at the same keys) + AssetTypeFilter.tsx:24-45 + FavoritesColumn.tsx:28-33, 45-46, 58, 111
- upstream_callers ← Filters.tsx:19, 66-68 + App.tsx:68-85 + FavoritesColumn.tsx:28-33, 108-118 + Search.tsx:135 + favoritesRoutes.ts:1-4
- downstream_side_effects ← FavoritesFilter.tsx:52-53, 58-83 + Search.tsx:64-80, 105-115 + Results.tsx:84-97, 109-113, 213-221 + AssetSearchServiceImpl.java:73-78 + ReactiveAssetSearchRepositoryImpl.java:57, 97, 110, 316-337
- implicit_adrs[0] (URL-only + mandatory merge-back) ← searchUrlState.ts:40-54 + Search.tsx:95-112
- implicit_adrs[1] (toggle on screen, boolean on the wire) ← FavoritesFilter.tsx:17-21 + searchUrlState.ts:300-303 + contributor/CTRIB-061.md sections 6.1 + GATE 1
- implicit_adrs[2] (unconditional render) ← FavoritesFilter.tsx:12-15 + Filters.tsx:66-68
- implicit_adrs[3] (label = state, tooltip = consequence) ← FavoritesFilter.tsx:28-30, 65, 68-82 + FavoritesColumn.tsx:45-46, 58
- implicit_adrs[4] (re-read the live URL on write) ← FavoritesFilter.tsx:46-51
- implicit_adrs[5] (test hooks on plain DOM elements) ← FavoritesFilter.tsx:75-80
- bugs[0] (?favorites=no unchecked-but-narrowed) ← FavoritesFilter.tsx:39-42 + searchUrlState.ts:252-260, 300-303 + ReactiveAssetSearchRepositoryImpl.java:328-337 + searchUrlState.test.ts:225-276 + P-396
- bugs[1] (disclosure fails open) ← FavoritesFilter.tsx:36-37 + appInfo.ts:4-9 + index.tsx:30-48 + CurrentUserIdentityResolver.java:26-29 + P-397
- bugs[2] (hover-only consequence) ← FavoritesFilter.tsx:68-82 + AppTooltip.tsx:48-65 + AppTooltipStyles.tsx:55-61
- bugs[3] (legacy session route abandoned) ← FavoritesFilter.tsx:53 + AssetTypeFilter.tsx:42 + Search.tsx:71-72, 118-121 + searchRoutes.ts:3, 11
- bugs[4] (no substrate node) ← `grep -c FavoritesFilter lineage/odd-platform/nodes.jsonl` = 0, 2026-08-31 (search root: that file)
- bugs[5] (no concept entry) ← `grep -ci favorit lineage/odd-platform/concepts.yaml` = 0, 2026-08-31 (search root: that file)
- bugs[6] (uncommitted worktree) ← `.git/worktrees/odd-platform-ctrib061/logs/HEAD` + `refs/heads/contrib/CTRIB-061-favorites-filter`
- bugs[7] (newest-favorited ordering unreachable) ← V0_0_94__create_favorite.sql:23-25 + ReactiveAssetSearchRepositoryImpl.java:316-337 + contributor/CTRIB-061.md section 6.2
- stress_findings.tunables ← FavoritesFilter.tsx:37, 40, 50, 59, 61, 64, 70, 79 + appInfo.ts:4-9 + index.tsx:30-48 + AppTooltip.tsx:37, 40-46 + AppTooltipStyles.tsx:55-61 + searchUrlState.test.ts:228, 240-244, 269, 271 + P-396 + P-397
- stress_findings.name_behavior_pairs ← FavoritesFilter.tsx:39-56, 65 + searchUrlState.ts:191-193, 252-260, 300-303 + AssetSearchServiceImpl.java:73-78 + ReactiveAssetSearchRepositoryImpl.java:316-337 + CurrentUserIdentityResolver.java:21-29 + FavoritesFilter.test.tsx:82-96
- stress_findings.orderings ← searchUrlState.ts:158-169, 175-195 + Search.tsx:105-115 + FavoritesFilter.test.tsx:82-90 + favorites-star-see-loop.spec.ts:189-200 + ReactiveAssetSearchRepositoryImpl.java:56-58, 241-243, 316-337 + V0_0_94__create_favorite.sql:23-25
- stress_findings.auth_gates ← FavoritesFilter.tsx:1-87 + Filters.tsx:55-95 + FavoritesScopeDto.java:10-14 + AssetSearchServiceImpl.java:76-78 + CurrentUserIdentityResolver.java:9-29 + ReactiveAssetSearchRepositoryImpl.java:328-337
- stress_findings.resource_boundaries ← FavoritesFilter.tsx:36, 39-56 + appInfo.ts:4-9 + index.tsx:30-48 + Search.tsx:64-80, 94-116 + FavoritesColumn.tsx:45 + Overview.tsx:27
- stress_findings.request_inputs.favorites ← FavoritesFilter.tsx:40 + searchUrlState.ts:40-60, 252-260, 300-303 + Results.tsx:84-97 + AssetSearchServiceImpl.java:73-78 + ReactiveAssetSearchRepositoryImpl.java:57, 97, 110, 328-337 + V0_0_94__create_favorite.sql:23-25
- stress_findings.request_inputs.checked ← FavoritesFilter.tsx:44-56, 60-67 + searchUrlState.ts:143-156, 191-193 + FavoritesFilter.test.tsx:82-96
- stress_findings.request_inputs.authType ← FavoritesFilter.tsx:36-37, 65, 68-82 + appInfo.ts:4-9 + index.tsx:39-43 + FavoritesColumn.tsx:45 + RecentlyViewedColumn.tsx:32 + Overview.tsx:27
- stress_findings.probes_emitted ← lineage/odd-platform/probes/P-396.yaml + lineage/odd-platform/probes/P-397.yaml (both written this session)
- docs_link_semantic ← FavoritesFilter.tsx:1-87 (no @docs annotation) + four live WebFetches 2026-08-31 (search 200, favorites 404 x2, catalog-overview 200) + Glob `**/*favorit*` over the local `documentation` checkout + contributor/CTRIB-061.md `docs_routing` + section 7 step 11
- security.auth_mode_relevance ← FavoritesFilter.tsx:36-37 + CurrentUserIdentityResolver.java:9-29
- security.authorization_assertions ← FavoritesFilter.tsx:1-87 + Filters.tsx:1-98 + AssetSearchServiceImpl.java:76
- security.owner_scoping ← FavoritesScopeDto.java:10-14 + AssetSearchServiceImpl.java:84-91
- security.data_exposure ← FavoritesFilter.tsx:65, 71-73, 78 + CurrentUserIdentityResolver.java:13-16, 28 + ReactiveAssetSearchRepositoryImpl.java:328-337
- security.known_security_gaps ← FavoritesFilter.tsx:36-37, 78 + appInfo.ts:4-9 + index.tsx:39-43 + AppTooltip.tsx:61 + AppTooltipStyles.tsx:55-61 + FavoritesScopeDto.java:10-14 + P-397
- performance.hot_paths ← FavoritesFilter.tsx:52-53 + Search.tsx:64-80 + Results.tsx:109-113 + ReactiveAssetSearchRepositoryImpl.java:57, 97, 110, 328-337 + AssetSearchServiceImpl.java:115-116 + V0_0_94__create_favorite.sql:20-21
- performance.scaling_characteristics ← FavoritesFilter.tsx:32-87 + ReactiveAssetSearchRepositoryImpl.java:248-259, 324
- performance.known_performance_gaps ← Search.tsx:71-80, 94-116 + FavoritesFilter.tsx:52-53 + contributor/CTRIB-061.md sections 7 step 10 and 9
- tests_coverage_semantic ← FavoritesFilter.test.tsx:1-112 + searchUrlState.test.ts:225-276 + favorites-star-see-loop.spec.ts:45-86, 88-273 + contributor/CTRIB-061.md section 13 + en.json:659, 679-680

## confidence_per_field

- understanding: HIGH (whole file read; every hop of the chain — parent, serialiser, mirror, results, service, repository, resolver, migration — read first-hand in this session)
- concepts: HIGH
- dependencies_semantic: HIGH (all 7 locale catalogs grepped directly for the three keys; the react-query client config read in full)
- tests_coverage_semantic: HIGH (all three FE test files and the IT spec read; every assertion line range verified against the file, not taken from the workspace record)
- docs_link_semantic: HIGH for the LIVE half (four fetches this session, two of them 404s that establish the absence); LOW for the release-train half, which was not readable from the local checkout and is explicitly marked unverified
- implicit_adrs: HIGH (every entry carries a verbatim intent_anchor from a comment in the file read)
- bugs_limitations_corner_cases: HIGH (each finding traced end-to-end; the two runtime-shaped ones carry probes rather than assertions)
- security: HIGH for the code facts (the identity chain was read end-to-end, including the SQL bind); the read-collaborative posture it sits inside is the platform's documented stance, cited not re-derived
- performance: MEDIUM (the request-shape facts are STATIC-INFERRED; the anti-join's cost on a large corpus is explicitly unmeasured at this commit, per the slice's own pending Phase-D gate)
- upstream_callers: HIGH (all four resolved callers read; the fifth — externally-authored URLs — is honestly marked unresolved)
- downstream_side_effects: MEDIUM (the component-local effects are HIGH; two entries are marked `unresolved: true` because `Results.tsx` and `ReactiveAssetSearchRepositoryImpl` have no sidecars yet)
- stress_findings: HIGH (17 triggers / 46 questions; 39 STATIC-INFERRED, 6 PROBE-NEEDED, 1 REFERENCE. Every load-bearing operator-observable claim — the URL-only merge-back dependency, the toggle-vs-boolean asymmetry, the security-context-only identity, the tab retirement — is STATIC-INFERRED with a first-hand anchor; the PROBE-NEEDED six are all rendered-consequence questions, which is the honest place for a UI node to need runtime)

## Maintainer notes
