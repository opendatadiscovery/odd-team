---
node_id: "odd-platform ts react-component component:Overview"
node_kind: react-component
axis: ui_components
extracted_at_commit: 9ac6436e
enriched_at_commit: 9ac6436e
extractor_version: 0.1.0
prompt_version: file-analyser/0.2.0
schema_version: v0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-20-ZA
---

# Overview (component:Overview) — semantic understanding

## understanding

`Overview` is the platform's **home page** — a 64-line top-level React component rendered at the SPA root route (the catalog home) that composes SIX sub-surfaces in a fixed vertical sequence: `<MainSearch>` → `<TopTagsList>` (size=30) → `<Domains>` → `<DataEntitiesUsageInfo>` (per-class Entities report) → `<Directory>` → conditionally-rendered `<OwnerAssociation>` wrapped in `<WithPermissionsProvider allowedPermissions={[Permission.DIRECT_OWNER_SYNC]}>` (`Overview.tsx:44-60`). The component is the **entry point** for the F-001 / F-003 Popular Entities Ranking inflation loop on the home-page UI side: when the conditional renders, `<OwnerAssociation>` mounts `<OwnerEntitiesList>` (gated on `identity && ownership` — `OwnerAssociation.tsx:84-86`), which fires `dispatch(fetchPopularDataEntitiesList({page:1, size:5}))` once on mount (`OwnerEntitiesList.tsx:58-64`) and renders the four `<DataEntityList>` columns including the Popular tile strip. Overview itself fetches NO data for the Popular column directly; it just controls VISIBILITY of the wrapper. The `<OwnerAssociation>` rendering gate is **boolean-coerced** `Boolean(appInfo?.authType && appInfo.authType !== 'DISABLED')` (`Overview.tsx:25-27`) — a string-equality check against the single literal `'DISABLED'`, with NO normalization, NO enum validation, NO fallback safety. The gate consumes the value that `AppInfoController.java:18`'s `@Value("${auth.type}")` round-trips verbatim from the operator's `application.yml` / env var — and as the upstream sidecar `AppInfoController.controller-class` already pins, that backend consumer has NO `@Value` default and NO enum validation either. The two layers compose into the **OwnerAssociation card mis-gating** finding: any operator-supplied `auth.type` that is empty, whitespace, falsy, or typo'd silently triggers the wrong UI branch with no diagnostic.

## concepts

- entities: [
    "`AppInfo` (response DTO returned by `GET /api/appInfo`; consumed via `useAppInfo()` at `lib/hooks/api/appInfo.ts:4-9` — React-Query cached under key `['appInfo']`) — only `authType: string` is read by Overview (line 26)",
    "`isShowOwnerAssociation: boolean` (local derived state at Overview.tsx:25-27) — single-call gating predicate, recomputed on every render but stable when `appInfo` is React-Query-cached",
    "Six sub-surfaces composed vertically: `<MainSearch>` / `<TopTagsList>` / `<Domains>` / `<DataEntitiesUsageInfo>` / `<Directory>` / `<OwnerAssociation>` — each owns its own data fetch and is independently loadable",
    "`Permission.DIRECT_OWNER_SYNC` (enum value imported from `generated-sources:6`) — the permission scope injected via `WithPermissionsProvider` around OwnerAssociation (line 55); used downstream by `OwnerAssociationRequestServiceImpl.java:64` to permit operator-driven direct owner-sync flow",
    "`tags: Tag[]` from `useGetPopularTags({page:1, size:30})` (`Overview.tsx:20-23` + `lib/hooks/api/tags.ts:5-14`) — the 30 most-used tags rendered as TopTagsList",
    "`isLoading: boolean` (React.useMemo at Overview.tsx:29-32) — composite skeleton trigger that ORs ONLY `isIdentityFetching` and `isTagsFetching` — does NOT wait on `useAppInfo`, `useGetDomains`, `useGetDataSourceTypes`, or `useDataEntitiesUsage`",
    "`getIdentityFetchingStatuses` Redux selector (line 3, 19) — provides `isIdentityFetching` (whether the whoami call is in flight)",
    "`SkeletonWrapper` (line 4) renders `<OverviewSkeleton>` with random width while `isLoading` is true"
  ]
- operations: [
    "render fixed-sequence composition of 6 sub-surfaces (`Overview.tsx:44-60`)",
    "derive `isShowOwnerAssociation` from `appInfo?.authType` via string-equality against the literal `'DISABLED'` (Overview.tsx:25-27)",
    "render OverviewSkeleton when EITHER identity fetch OR top-tags fetch is in flight; ignore appInfo / domains / directory / usage-info loading states (Overview.tsx:29-42)",
    "conditionally render `<OwnerAssociation>` inside `<WithPermissionsProvider allowedPermissions={[Permission.DIRECT_OWNER_SYNC]} resourcePermissions={[]}>` (Overview.tsx:53-59)",
    "delegate ALL data-fetching to children — Overview fires NO direct API call besides `useAppInfo()` (line 24) and `useGetPopularTags()` (line 20); the `<OwnerEntitiesList>` Popular fetch is two layers downstream (OwnerAssociation → OwnerEntitiesList → useEffect dispatch)"
  ]
- invariants: [
    "the OwnerAssociation card visibility depends on raw-string equality with the literal `'DISABLED'` — a string that isn't exactly `'DISABLED'` and isn't falsy (e.g. `'OUATH2'`, `'disabled'` lower-case, `' DISABLED'` with whitespace, `'LOGINFORM'` typo) renders OwnerAssociation as if auth were enabled (Overview.tsx:25-27)",
    "the gating predicate evaluates `false` for: `authType === undefined` (appInfo still loading), `authType === null`, `authType === ''` (operator set `AUTH_TYPE=`), `authType === 'DISABLED'` (the application.yml default) — these four cases ALL hide the OwnerAssociation card, but ONLY the last is the documented intent",
    "no validation of `authType` against the documented `DISABLED | LOGIN_FORM | OAUTH2 | LDAP` enum — the SPA mirrors the backend's lack of validation; both layers fail-open into surprising UI states",
    "the `isLoading` useMemo composes ONLY `isIdentityFetching || isTagsFetching` (lines 29-32) — appInfo, domains, directory, and entities-usage can be mid-flight while the page paints; the OwnerAssociation gate may flip false→true seconds after first paint when appInfo arrives",
    "no error boundary, no fallback UI, no retry — if any child throws, React's default error behaviour applies (page goes blank in production builds)",
    "Overview is mounted on the SPA home route; React-Query caches `appInfo` and `popularTags` across navigations, so re-entering home from elsewhere does NOT re-fetch unless the queries are invalidated",
    "Overview itself is rendered REGARDLESS of authentication — there is no `<RequireAuth>` wrapper at this level; the page composes whatever the active SecurityWebFilterChain allows the user to see (under DISABLED, an anonymous caller reaches this page)"
  ]
- audiences: [
    "odd-platform-ui-end-user — every authenticated user landing on the SPA home AFTER sign-in (LOGIN_FORM / OAUTH2 / LDAP modes)",
    "anonymous network caller reaching `/` under `auth.type=DISABLED` — gets the SAME home page (minus OwnerAssociation, since the gate hides it on DISABLED)",
    "data-engineer-analyst / data-scientist-ml-engineer (per pillar P-01 Data Discovery audiences) — Overview is the discovery-pillar entry surface"
  ]

## dependencies_semantic

- requires-feature: [
    "F-001 + F-003 Popular Entities Ranking (P-01:F-001) — Overview is the home-page chrome that conditionally mounts the wrapper chain (OwnerAssociation → OwnerEntitiesList) that hosts the Popular column; the loop's UI closure depends on Overview's gating predicate being TRUE",
    "AppInfoController `GET /api/appInfo` (`AppInfoController.java:24-28`) — Overview's gate at line 25-27 reads the round-tripped `authType` field; the loop is: backend `@Value(\"${auth.type}\")` → AppInfo DTO → SPA fetch → gate predicate → conditional render. Per the upstream sidecar `AppInfoController.controller-class` (this is the 1st UI-side sidecar in that chain), the AppInfo response is the SPA's runtime auth-mode discovery surface",
    "P-09 Authentication framework — Overview itself does NOT enforce auth; it inherits whatever the active `SecurityWebFilterChain` decides for the SPA root route. Under DISABLED, anonymous callers reach Overview; under the other three modes, sign-in is required before Overview renders",
    "P-09 User-owner association — the OwnerAssociation child surface (line 14, 57) embodies the user-owner-association feature; Overview's gate at 25-27 is the FIRST of two gates (the second is `OwnerAssociation.tsx:84-86`'s `identity && ownership` check)",
    "P-08 RBAC — `Permission.DIRECT_OWNER_SYNC` from generated-sources (line 6) is the RBAC scope wired via WithPermissionsProvider (line 55); the permission's evaluation happens INSIDE `<OwnerAssociation>` (the WithPermissionsProvider only INJECTS context, it does NOT gate rendering — see bugs[3])",
    "P-01 Data Discovery sub-features — every other rendered child belongs to P-01: TopTagsList (Manual Object Tagging sub-feature), Domains (Data Entity Groups & Domains sub-feature), DataEntitiesUsageInfo (Catalog Overview entities-usage report), Directory (Directory sub-feature), MainSearch (Search and Filtering sub-feature)"
  ]
- requires-config: [] — N/A; Overview reads NO config keys directly. The only runtime input is `appInfo.authType` which is the backend's round-trip of `${auth.type}`; that's a config-key dependency at the BACKEND consumer (AppInfoController.java:18), not at this UI component.
- requires-runtime: [
    "React 18 + react-redux (Overview.tsx:2, 7)",
    "Redux Toolkit (`useAppSelector` at line 7 + `getIdentityFetchingStatuses` selector at line 3)",
    "React-Query / `@tanstack/react-query` (`useAppInfo` + `useGetPopularTags` both wrap `useQuery` — appInfo.ts:5 + tags.ts:5)",
    "OpenAPI-generated `appInfoApi.getAppInfo()` from `lib/api` (appInfo.ts:2,7)",
    "OpenAPI-generated `tagApi.getPopularTagList()` from `lib/api` (tags.ts:2,9)",
    "MUI `@mui/material` Grid component (line 1)",
    "generated-sources `Permission` enum (line 6) — must contain the literal `DIRECT_OWNER_SYNC` value at runtime",
    "an active SecurityWebFilterChain bean (one of the four `auth.type`-conditional configurations) — Overview itself renders without this, but the upstream HTTP path `/` is gated by it"
  ]
- couples-to: [
    "`useAppInfo` hook (`lib/hooks/api/appInfo.ts:4-9`) — React-Query wrap of `appInfoApi.getAppInfo()` under key `['appInfo']`",
    "`useGetPopularTags` hook (`lib/hooks/api/tags.ts:5-14`) — React-Query wrap of `tagApi.getPopularTagList({page,size})` under key `['popularTags']`",
    "`getIdentityFetchingStatuses` selector (redux/selectors) — fetching-status of the whoami call",
    "`MainSearch` shared element (`components/shared/elements`) — the catalog-wide full-text-search input",
    "`SkeletonWrapper` + `OverviewSkeleton` — the loading-state placeholder",
    "`WithPermissionsProvider` (`components/shared/contexts/Permission/WithPermissionsProvider.tsx:12-49`) — context-only wrapper, NOT a rendering gate",
    "`OwnerAssociation` (`./OwnerAssociation/OwnerAssociation.tsx:84-86`) — owns the `identity && ownership` inner gate that decides which of OwnerAssociationForm / PendingMessage / DeclinedMessage / OwnerEntitiesList renders",
    "`TopTagsList`, `Domains`, `DataEntitiesUsageInfo`, `Directory` — the five other sub-surfaces"
  ]

## upstream_callers

What renders OR navigates to this component — the inbound graph.

- **SPA root route `/`** — the React Router registration mounts `<Overview>` on the platform's home route. Overview is the SPA's landing page; every cold load that doesn't redirect (e.g. to `/login`) renders this component.
- **Sign-in completion redirect (LOGIN_FORM / OAUTH2 / LDAP)** — after the user authenticates, the SPA redirects to `/`, which renders Overview. Verified by grep on `dataentities/popular` callers returning only the OwnerEntitiesList path (`<odd-platform-repo>/odd-platform-ui/src` — no preload happens before mount).
- **Browser back-navigation from any other SPA route** — react-router-dom v6 default behaviour unmounts and remounts the route component; Overview re-runs the two top-level hooks (`useAppInfo`, `useGetPopularTags`) but React-Query returns the cached value so no network request fires unless cache is stale (default staleTime=0 means the query DOES refetch on mount unless overridden — verified appInfo.ts:4-9 + tags.ts:5-14 set NO `staleTime` so refetch on mount IS the default).
- **No other dispatchers / no other parents** — grep on `import.*Overview` against `<odd-platform-repo>/odd-platform-ui/src` finds the SPA route registration only.

## downstream_side_effects

What this component causes when rendered — the outbound graph.

- **HTTP request fired on mount**: `GET /api/appInfo` (via `useAppInfo()` → `appInfoApi.getAppInfo()`; appInfo.ts:7). React-Query staleTime is unset (default = 0), so each mount of Overview triggers a network fetch even on warm reload. Server-side: `AppInfoController.getAppInfo` returns `{projectVersion, authType}` (per the upstream `AppInfoController.controller-class` sidecar bugs[3]: under `auth.type=DISABLED` this is anonymously reachable).
- **HTTP request fired on mount**: `GET /api/tags/popular?page=1&size=30` (via `useGetPopularTags({page:1, size:30})` → `tagApi.getPopularTagList()`; tags.ts:9). 30 records per request, hardcoded, no pagination control. The TopTagsList renders all 30 inline as chips.
- **Indirect HTTP requests** via the five rendered children, EACH firing their own data fetch on their own mount:
  - `<Domains>` (`Overview.tsx:50` → `Domains.tsx:10`) — fires `useGetDomains()` (`<odd-platform-ui>/src/lib/hooks/api/dataEntity.ts`)
  - `<DataEntitiesUsageInfo>` (`Overview.tsx:51` → `DataEntitiesUsageInfo.tsx:21`) — fires `useDataEntitiesUsage()`
  - `<Directory>` (`Overview.tsx:52` → `Directory.tsx:10`) — fires `useGetDataSourceTypes()` (`<odd-platform-ui>/src/lib/hooks/api/directory.ts`)
  - `<OwnerAssociation>` (when gated true) — runs `useAppSelector` over identity / ownership / requestStatus; if `identity && ownership` then `<OwnerEntitiesList>` fires FOUR dispatches: `fetchMyDataEntitiesList`, `fetchMyUpstreamDataEntitiesList`, `fetchMyDownstreamDataEntitiesList`, `fetchPopularDataEntitiesList` (`OwnerEntitiesList.tsx:58-64`) — page=1, size=5 each.
- **Total cold-mount HTTP calls** for an owner-associated user on a non-DISABLED deployment: `1 + 1 + 1 + 1 + 1 + 0 + 4 = 9 GETs` (appInfo, popularTags, domains, entities-usage, directory, identity-selector-only-no-fetch, plus four MyEntities thunks). Under DISABLED the conditional wrapper hides OwnerAssociation entirely so the 4 thunks DON'T fire.
- **Indirect F-001 loop closure** via Popular click: per the upstream PopularStrip sidecar `downstream_side_effects`, every click on a Popular tile (rendered inside OwnerEntitiesList) navigates to `/dataentities/{id}/overview` which mounts `<DataEntityDetails>` → fires `fetchDataEntityDetails` → backend `GET /api/dataentities/{id}` → `+1 view_count` (per LSN-017, the useEffect dep-array bug doubles this to `+2` per user page-open). **Overview is the upstream-most home-page surface from which this UI inflation loop is reachable** — but Overview's role is purely to MOUNT the wrapper chain; the dispatch and the dep-array bug live two and three layers downstream respectively.
- **NO direct view_count interaction** by Overview itself — the component does NOT call `getPopular`, does NOT read `view_count`, does NOT render the popular tile. The substrate's note "Popular strip — does the UI fetch view_count or compute client-side?" resolves to: **neither happens here**; Popular is fetched by OwnerEntitiesList (one layer down) and the API does NOT include `view_count` in the response projection (per F-003 facet `Popular tile API exposes 9 fields, view_count NOT among them` + PopularStrip sidecar concepts.entities[0]).
- **NO useEffect / NO LSN-017 dep-array exposure at THIS layer** — Overview.tsx contains ONE `React.useMemo` (lines 29-32) deriving `isLoading` from two booleans. There is NO `useEffect` in this file. The LSN-017 self-feeding-loop pattern (response-derived value in the dep-array) is NOT present here. The LSN-017 bug lives at `DataEntityDetails.tsx:56-64` (one of the destinations users click into FROM the Popular tile, but accessed via the routing layer, not Overview).

## tests_coverage_semantic

- covered_behaviours: [] — N/A; no test file exists for `Overview.tsx`. Verified by Glob on `<odd-platform-ui>/src/components/Overview/**/Overview*.test.tsx` (returns no matches under the Overview folder or anywhere on the path).
- uncovered_behaviours:
  - statement: "OwnerAssociation rendering gate — assert that under each of the four `authType` values (DISABLED / LOGIN_FORM / OAUTH2 / LDAP) the gate evaluates as documented; and that under the bug-shaped values (empty string, undefined, null, typo'd 'OUATH2', whitespace ' DISABLED', lowercase 'disabled') the gate behaves predictably (or rejects with a diagnostic)"
    test_class: behaviour-correctness
    suggested_test_file: "<odd-platform-repo>/odd-platform-ui/src/components/Overview/__tests__/Overview.test.tsx"
  - statement: "skeleton-trigger correctness — assert that OverviewSkeleton renders when `isIdentityFetching || isTagsFetching`, AND assert that NEITHER `useAppInfo` loading state NOR domains / directory / entities-usage fetch states affect skeleton visibility (the asymmetry is intentional but undocumented)"
    test_class: rendering-state
    suggested_test_file: "<odd-platform-repo>/odd-platform-ui/src/components/Overview/__tests__/Overview.test.tsx"
  - statement: "fixed-vertical-sequence composition — assert that the six sub-surfaces render in the documented order (MainSearch / TopTagsList / Domains / DataEntitiesUsageInfo / Directory / OwnerAssociation) and that re-ordering this is a breaking change for the documented home-page flow"
    test_class: layout-regression
    suggested_test_file: "<odd-platform-repo>/odd-platform-ui/src/components/Overview/__tests__/Overview.test.tsx"
  - statement: "WithPermissionsProvider context wiring — assert that the provider passes `allowedPermissions=[Permission.DIRECT_OWNER_SYNC]` AND `resourcePermissions=[]` to OwnerAssociation; assert that the provider does NOT itself gate rendering (per the bug-shaped finding that the wrapper is context-only)"
    test_class: context-wiring
    suggested_test_file: "<odd-platform-repo>/odd-platform-ui/src/components/Overview/__tests__/Overview.test.tsx"
  - statement: "DISABLED-mode home-page invariant (the F-001/F-003 loop closure check) — assert that under `appInfo.authType = 'DISABLED'` Overview renders WITHOUT the Recommended panel (including the Popular column), i.e. the UI inflation loop is unreachable from the home page UI even under anonymous reach; pair with the documented contradiction at `catalog-overview.md:43` to surface the doc-vs-code drift"
    test_class: integration-cross-feature
    suggested_test_file: "<odd-platform-repo>/odd-platform-ui/src/components/Overview/__tests__/Overview.test.tsx"
  - statement: "popular-tags fetch invariant — assert size=30 hardcoded, assert no pagination, assert error-state silent (no error fallback in Overview itself)"
    test_class: behaviour-correctness
    suggested_test_file: "<odd-platform-repo>/odd-platform-ui/src/components/Overview/__tests__/Overview.test.tsx"
- test_files: []
- gaps: |
    Zero direct test coverage on Overview. The Overview folder has three test files (`DataEntitiesUsageInfo.test.tsx`, `DataEntitiesUsageInfoView.test.tsx`, `DataEntitiesUsageInfoCard.test.tsx`) — ALL on the single sub-feature DataEntitiesUsageInfo. No test for the composition itself, the OwnerAssociation gate predicate, the WithPermissionsProvider wiring, or the asymmetric skeleton trigger. The likeliest regression vectors that today's suite would miss:
    1. A typo in the gate literal (`'DISABELD'` instead of `'DISABLED'`) would silently render OwnerAssociation on all deployments — no test catches the change.
    2. A change to `WithPermissionsProvider` that DID start gating rendering on the permission would silently hide OwnerAssociation for users without DIRECT_OWNER_SYNC — no test catches the broken contract.
    3. A future contributor adds a new ConditionalOnProperty-like value to `auth.type` (e.g. `SAML`) — Overview's gate would render OwnerAssociation (since SAML !== 'DISABLED'), but the SPA's own auth-mode rendering rules (login form selection) might not handle it — no test catches the new-value-not-handled gap.
    4. The asymmetric `isLoading = isIdentityFetching || isTagsFetching` would mask a slow `useAppInfo` response by painting the page before the gate evaluates — the OwnerAssociation card would flicker in seconds after first paint (gate flips false→true). No visual-regression test catches this.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/data-discovery/catalog-overview"
    anchor: ""
    rationale: "Catalog Overview is the documented user-facing surface that Overview.tsx implements; this is the natural home for any documentation of the home page's section composition, gating predicates, and DISABLED-mode behaviour"
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
- fetched_excerpts: |
    From `https://docs.opendatadiscovery.org/features/data-discovery/catalog-overview` (WebFetched 2026-05-20, status 200):
    The page describes the home-page sections top-to-bottom: "Main search", "Top tags", "Domains", "Entities" (per-class usage report), "Directory", "Recommended" (with four columns: My Objects / Upstream Dependencies / Downstream Dependencies / Popular).
    On DISABLED-mode visibility:
    "The Recommended panel requires the signed-in user to be linked to an Owner; without the user-owner association in place, the Recommended panel is **empty** (and on **auth-disabled deployments the panel is visible but the per-user filtering does not apply**)."
    On OwnerAssociation card visibility:
    "On **auth-disabled deployments the section is hidden** (no user identity, nothing to associate)."
    On Popular tile click destination:
    "Clicking a tile opens that entity's **Structure page**."
- doc_drift_findings:
  - "**DOC DRIFT — DISABLED-mode Recommended panel visibility CONTRADICTS code.** The live doc (`catalog-overview.md` published surface, WebFetched 2026-05-20 status 200) states the Recommended panel is **visible** on auth-disabled deployments with per-user filtering disabled. The code at Overview.tsx:25-27 + :53-59 evaluates `isShowOwnerAssociation = Boolean(appInfo?.authType && appInfo.authType !== 'DISABLED')` which equals `false` when `authType === 'DISABLED'` — so the ENTIRE `<OwnerAssociation>` wrapper does NOT render, taking the Recommended panel (with all four columns including Popular) WITH IT. **The doc and the code disagree on a user-observable fact.** This is the SAME drift surfaced at PopularStrip sidecar `doc_drift_findings[1]` and F-001 facet `PopularStrip DISABLED-mode rendering CONTRADICTS docs` and F-003 facet `DISABLED-mode hides the Popular column entirely from home page` — Overview.tsx is the SOURCE of the gating predicate, so this sidecar is the ROOT anchor for the drift class."
  - "**DOC DRIFT — OwnerAssociation card visibility under DISABLED CONFIRMED in code.** The doc says 'On auth-disabled deployments the section is hidden (no user identity, nothing to associate).' The code AGREES on this user-visible outcome — but the IMPLEMENTATION reaches the hidden state via a fragile string-equality predicate on a value that has no validation upstream. The doc does NOT warn operators that empty / typo'd / whitespace-shaped `auth.type` values reach the OPPOSITE outcome (card RENDERS when it shouldn't). The user-visible fact is documented; the failure mode behind the fact is not."
  - "**DOC DRIFT — Popular tile click destination disagreement.** The live doc says 'Clicking a tile opens that entity's Structure page.' The code (`DataEntityList.tsx:38` + `dataEntitiesRoutes.ts:66-73` default `path='overview'`) navigates to `/dataentities/{id}/overview` — the Overview tab. This is the same drift surfaced at F-001 facet `PopularStrip click-target docs mismatch` and F-003 facet `Popular click-target navigates to Overview, doc says Structure`. Note: this drift is downstream of Overview.tsx (it lives at the `<Link>` in DataEntityList) but Overview is the ENCLOSING home-page surface, so the user's mental model is 'on the home page (Overview), clicking Popular goes to X' — Overview is the natural reader entry point for the doc fix."
  - "**DOC GAP — six-section composition NOT named on the doc page.** The doc names the sections in the order they render but does NOT list the order as a contract, does NOT name `<DataEntitiesUsageInfo>` as the documented surface for the per-class Entities report, and does NOT note that the per-class report (`DataEntitiesUsageInfo`) renders BEFORE the Directory but AFTER the Domains list — an order an operator might reasonably expect to be reversed."
  - "**DOC GAP — owner-association vs DISABLED interaction NOT cross-referenced.** The doc treats the OwnerAssociation card and the Recommended panel as separate features; the code wires them under a single Overview gate (Overview.tsx:53-59 wraps OwnerAssociation, and OwnerAssociation owns the second gate at `OwnerAssociation.tsx:84-86` that decides which of OwnerAssociationForm / PendingMessage / DeclinedMessage / OwnerEntitiesList renders). The doc-side framing as 'Recommended panel' + 'OwnerAssociation section' fails to surface that **the same wrapper renders both**, and that the same `authType !== 'DISABLED'` gate hides BOTH on DISABLED-mode deployments. The contradiction with reality (per the first drift finding above) compounds because the doc separates two features that share one rendering gate."

## implicit_adrs

- "The Overview component intentionally delegates ALL gating decisions to its CHILDREN — Overview's own gating predicate (`isShowOwnerAssociation`) is the OUTER gate (auth-mode visibility); the OwnerAssociation child owns the INNER gate (`identity && ownership`); WithPermissionsProvider injects the permission context downstream. This nested-gates-per-layer pattern is consistently applied at this surface — Overview does not flatten the predicates into one expression. The intent is that the OUTER gate is a feature-flag (is this deployment-mode capable of OwnerAssociation?), the INNER gate is a per-user check (is this signed-in user able to USE OwnerAssociation right now?), and the permission gate is a per-action check (can this user direct-sync an owner?)." — evidence: Overview.tsx:25-27 (outer gate) + Overview.tsx:53-59 (WithPermissionsProvider wrap) + OwnerAssociation.tsx:30-89 (inner state-machine over requestStatus + identity + ownership) — intent_anchor: the three layers form a deliberate "deployment-shape → identity-shape → action-permission" cascade where each child knows ONLY its own concern; Overview does not need to know about OwnerAssociationRequestStatus, and OwnerAssociation does not need to know about authType. — confidence: HIGH

- "The `isLoading` skeleton trigger intentionally watches ONLY `isIdentityFetching || isTagsFetching` (`Overview.tsx:29-32`) — NOT `useAppInfo`, NOT domains, NOT directory, NOT entities-usage. The intent: identity and tag-loading are perceptual blockers (the page IS the catalog home — empty tag chips look like 'no tags exist', not 'still loading'); the other surfaces have their own loading states or per-surface fallbacks (DataEntitiesUsageInfo's `isError || !usageInfo` returns null at DataEntitiesUsageInfo.tsx:56). Overview optimises for time-to-first-paint by NOT waiting on everything." — evidence: Overview.tsx:29-32 + DataEntitiesUsageInfo.tsx:56 (its own `null` fallback) + Domains.tsx:12-21 (its own `domains?.length > 0 ?` ternary) + Directory.tsx:12-26 (its own `datasourceTypes?.length > 0 ?` ternary) — intent_anchor: each child sub-surface implements its own conditional render; Overview's skeleton trigger excludes them precisely because each one self-handles missing data. The two surfaces INCLUDED in the skeleton (identity, tags) cannot self-handle missing data in the same way — identity drives the entire Recommended chain, and tags-as-chips have no fallback state that reads as "loading". — confidence: HIGH

- "WithPermissionsProvider is a **context provider, NOT a rendering gate** — wrapping a component in `<WithPermissionsProvider Component={X}>` always renders `<X>`, even when the user lacks the listed `allowedPermissions`. The permission is INJECTED into context (downstream `usePermissions()` hook reads it) but is NOT enforced at this layer. The intent: rendering decisions about WHICH UI element to show belong with the child component (which has its own context: form state, owner status, etc.); the provider only declares 'here is the scope to check IF you check'." — evidence: WithPermissionsProvider.tsx:12-49 (returns `<Component/>` wrapped in PermissionProvider in ALL three render branches; no conditional `if (hasPermission)` check) + Overview.tsx:53-59 (the `isShowOwnerAssociation` outer gate is what actually controls rendering, NOT WithPermissionsProvider) — intent_anchor: the provider's three render branches (render-prop, Component-prop, children) consistently return the wrapped element with NO conditional check; the gating happens at Overview (outer auth-mode), OwnerAssociation (inner identity+ownership), and inside OwnerAssociation's children (where `usePermissions` is consumed). — confidence: HIGH

## bugs_limitations_corner_cases

- "**OwnerAssociation card mis-gating on empty / typo'd / whitespace `auth.type`** (the batch-T AppInfoController finding's UI-side closure). `Overview.tsx:25-27` evaluates `isShowOwnerAssociation = Boolean(appInfo?.authType && appInfo.authType !== 'DISABLED')`. Under each of these operator-misconfiguration scenarios, the gate produces a SURPRISING outcome with NO diagnostic:
    - Operator sets `AUTH_TYPE=` (empty string) → backend `@Value(\"${auth.type}\")` injects `''` (per AppInfoController.controller-class bugs[0]) → AppInfo response carries `authType: ''` → `Boolean('' && ...)` = `false` → OwnerAssociation card HIDDEN. Plus EVERY backend `@ConditionalOnProperty(havingValue=...)` fails to match → NO SecurityWebFilterChain bean → silently degraded security (the SAME deployment shape that AppInfoController bugs[0] flagged). The UI hides the card AS IF auth were intentionally disabled, masking the deployment misconfiguration from the operator looking at the home page.
    - Operator typos `AUTH_TYPE=OUATH2` (transposed 'A' and 'U') → backend injects `'OUATH2'` → AppInfo response carries `authType: 'OUATH2'` → `Boolean('OUATH2' && 'OUATH2' !== 'DISABLED')` = `true` → OwnerAssociation card SHOWS, but the backend has NO matching `@ConditionalOnProperty(havingValue='OUATH2')` → NO SecurityWebFilterChain wired → the operator sees an apparently-functional OwnerAssociation card on a deployment with NO authentication (the OPPOSITE risk of the empty case).
    - Operator sets `AUTH_TYPE=disabled` (lowercase) → backend injects `'disabled'` → AppInfo response carries `authType: 'disabled'` → `Boolean('disabled' && 'disabled' !== 'DISABLED')` = `true` (string-equality is case-sensitive) → OwnerAssociation card SHOWS even though the operator's clear INTENT was to disable auth.
    - Operator sets `AUTH_TYPE=' DISABLED'` (leading whitespace) → same case-sensitive outcome; gate SHOWS the card under what the operator believes is a DISABLED deployment.
   In all four cases the UI fails-open or fails-closed without any error boundary or warning. There is no `console.warn`, no toast, no fallback render that announces 'auth.type is not a recognised value'. The two failure layers (no `@Value` default at AppInfoController.java:18 + no enum validation in Overview.tsx:26) COMPOUND — neither layer catches the other's gap." — evidence: Overview.tsx:25-27 + AppInfoController.java:18 (no `@Value` default per upstream sidecar) + AppInfo response shape (per upstream sidecar) + the four `@ConditionalOnProperty(value=\"auth.type\", havingValue=...)` SecurityConfigurations (no `matchIfMissing` on any per REFACTOR-073 evidence) — severity: HIGH

- "**Cross-owner enumeration via the Popular tile rendered downstream** — REFACTOR-024 family at the home-page level. Overview's outer gate (line 25-27) is the FIRST defence against the UI-side popular-inflation loop; the gate succeeds at preventing anonymous DISABLED-mode home-page access to the Popular tile (the tile lives inside OwnerEntitiesList, which lives inside OwnerAssociation, which lives inside the gated block). BUT for ANY authenticated user with an associated Owner under LOGIN_FORM/OAUTH2/LDAP, the gate evaluates TRUE and the Popular column renders with the FULL CATALOG-WIDE popular list — NO owner-scoping, NO per-user filtering, NO per-tenant partition (the backend's `listPopular` CTE has no `WHERE owner_id = current_user_owner_id` clause; per F-003 facet `service tier is a 1-line pass-through` the service adds NO defence). EVERY signed-in user (even those whose Owner has zero data entities) sees the SAME Popular column ranked by global `view_count DESC`. This exposes cross-owner data-entity enumeration: a user in Org A's Owner sees the most-viewed entities in Org B's Owner-namespaced entities (because there is no Owner-namespace partition in the backend's data plane). The doc says 'on auth-disabled deployments the panel is visible but the per-user filtering does not apply' — IMPLYING that on auth-enabled deployments per-user filtering DOES apply, which is FALSE for the Popular column specifically (Popular has never been per-user; only the My-Objects / Upstream / Downstream columns are owner-scoped, NOT Popular). Overview is the home-page chrome that mounts this leak surface." — evidence: Overview.tsx:53-59 (mounts OwnerAssociation when gate true) + OwnerAssociation.tsx:84-86 (mounts OwnerEntitiesList when identity+ownership) + OwnerEntitiesList.tsx:99-105 (Popular column hardcoded as 4th column, identical render for all users) + F-003 facet `service tier is a 1-line pass-through` (DataEntityServiceImpl.listPopular adds NO owner filter) + REFACTOR-024 (read-collaborative posture across the platform's read paths) — severity: HIGH

- "**No LSN-017 dep-array exposure at THIS layer** — Overview.tsx has NO `useEffect`. The component has ONE `React.useMemo` (lines 29-32) for `isLoading`, and that memo's dep array `[isIdentityFetching, isTagsFetching]` is correctly externally-driven (no response-derived values). However, Overview MOUNTS the chain that contains the LSN-017 bug downstream: when a user clicks the Popular tile (rendered in OwnerEntitiesList), they navigate to `/dataentities/{id}/overview` which mounts `<DataEntityDetails>` whose useEffect dep-array IS bugged (per LSN-017 + F-001 hop-1 evidence at `DataEntityDetails.tsx:56-64`: the 5th dep `details.status?.status` is response-derived). The home page is therefore the ENTRY POINT for the LSN-017 amplification — but the bug itself is two routing transitions away. A regression that adds a useEffect to Overview itself (with a response-derived dep like `appInfo?.authType` in the dep-array) would replicate LSN-017 at the home-page layer; today's code is clean but the patterns is reachable through future drift." — evidence: Overview.tsx:29-32 (useMemo only; no useEffect in this file) + DataEntityDetails.tsx:56-64 (the bug, per LSN-017 + F-001 chain hop-1) — severity: LOW (clean today; surfaced as a regression risk and a cross-reference)

- "**Asymmetric skeleton trigger masks slow appInfo flicker**. The `isLoading` useMemo (Overview.tsx:29-32) waits ONLY on `isIdentityFetching || isTagsFetching`. Under a slow `useAppInfo` response (which can happen on cold backend boot, network congestion, or a stalled SecurityWebFilterChain init), Overview can RENDER (skeleton gone) BEFORE `appInfo` arrives. At first paint, `appInfo` is `undefined` so `appInfo?.authType` is `undefined` → `Boolean(undefined && ...)` = `false` → OwnerAssociation HIDDEN. When `appInfo` arrives (e.g. 800ms later), React re-renders, the gate flips to `true` (under any non-DISABLED mode), and OwnerAssociation appears mid-page. The user observes a layout shift / late-card-flicker. There is no `<Suspense>` boundary, no shimmer, no 'still loading' overlay. On a DISABLED-mode deployment the second render is identical to the first (gate stays false), so the flicker is invisible — but on the 99% of production deployments (LOGIN_FORM/OAUTH2/LDAP), the flicker is observable." — evidence: Overview.tsx:24-32 (appInfo NOT in the loading composition) + Overview.tsx:53-59 (gate consumes appInfo) — severity: LOW

- "**`isShowOwnerAssociation` is recomputed every render** — `const isShowOwnerAssociation = Boolean(appInfo?.authType && appInfo.authType !== 'DISABLED')` at Overview.tsx:25-27 is a plain assignment (NOT wrapped in `useMemo`). Since `appInfo` is React-Query-cached under stable identity (same query key), the value is stable across renders even WITHOUT memoisation — the runtime cost is zero, but a future contributor adding more renders or upgrading appInfo to a non-React-Query source might introduce a thrashing re-render. The asymmetry with `isLoading` (which IS `useMemo`-wrapped, lines 29-32) is awkward — either both should be memoised or neither, and the choice today is inconsistent." — evidence: Overview.tsx:25-32 (the two derived values, only one memoised) — severity: LOW

- "**No error boundary** — if any child (Domains, DataEntitiesUsageInfo, Directory, TopTagsList, OwnerAssociation, MainSearch) throws during render, React's default error behaviour propagates to the SPA's root `<App>` boundary (if one exists). The home page going blank on a child error is a recoverable failure mode but is not localised to the failed child. A `<ErrorBoundary>` around each section would surface 'Domains failed to load' inline; today the user gets a blank home." — evidence: Overview.tsx:1-64 (no ErrorBoundary import, no try/catch) — severity: LOW

## security

- **auth_mode_relevance**: `DISABLED | LOGIN_FORM | OAUTH2 | LDAP` — Overview is **relevant to all four modes** as the home-page chrome. The role differs per mode:
  - Under `DISABLED`: anonymous network callers reach `/`, render the home page, see MainSearch + TopTagsList + Domains + DataEntitiesUsageInfo + Directory — but NOT OwnerAssociation (per the gate). The five visible surfaces all hit their own API paths anonymously (per the upstream sub-feature sidecars).
  - Under `LOGIN_FORM` / `OAUTH2` / `LDAP`: the SPA route `/` is `.authenticated()` (per LoginFormSecurityConfiguration.java:49-57 fall-through), so a user reaches Overview only post-sign-in. The gate evaluates `true` and OwnerAssociation mounts; OwnerEntitiesList fires the four MyEntities thunks; the Popular column renders.
- **ingestion_filter_relevance**: `NO — UI/API surface, not ingestion`. Overview is a UI route, not an ingestion path.
- **authorization_assertions**: ZERO direct assertions in Overview itself. The component WRAPS `<OwnerAssociation>` in `<WithPermissionsProvider allowedPermissions={[Permission.DIRECT_OWNER_SYNC]}>` (line 55), but per implicit_adr[3] the provider is context-only, not a rendering gate. `Permission.DIRECT_OWNER_SYNC` is consumed DOWNSTREAM (in OwnerAssociation's children, where `usePermissions()` reads the context); Overview does not check it. — evidence: Overview.tsx:53-59 + WithPermissionsProvider.tsx:12-49
- **owner_scoping**: `BYPASSES — Popular tile is catalog-wide`. Overview itself is not data-scoped (it's chrome), but it MOUNTS the OwnerEntitiesList chain which renders BOTH owner-scoped columns (My Objects / Upstream / Downstream — per the per-user thunks) AND the catalog-wide Popular column (no owner filter; per F-003 facet evidence at the backend service tier). The home page therefore mixes two scopes (per-user + catalog-wide) under a single "Recommended" h1 — surfacing cross-owner data-entity references in the Popular column to every authenticated user. — evidence: Overview.tsx:53-59 + OwnerEntitiesList.tsx:99-105 + F-003 facet `service tier is a 1-line pass-through`
- **data_exposure**:
  - "**Deployment auth mode (`authType` string)** — exposed to the SPA via `useAppInfo()` (line 24) under any reach mode; on DISABLED, the same value is also readable by anonymous network callers via `GET /api/appInfo` (per upstream sidecar AppInfoController bugs[3] — fingerprinting surface). Overview is the UI consumer that exposes the value as a RENDERING DECISION; the value itself does not need to be displayed to the user, but its consequences (OwnerAssociation visibility) are user-observable." — evidence: Overview.tsx:24-27 + AppInfoController.controller-class sidecar data_exposure
  - "**Cross-owner data-entity references via Popular column** — the home page renders the catalog-wide popular list (9-field `DataEntityRef[]` projection: id, oddrn, externalName, internalName, entityClasses[], manuallyCreated, status, isStale, hasAlerts) to every authenticated user with an associated Owner, regardless of which Owner-namespace those entities belong to. A user in Owner A sees entities owned by Owner B in their home-page Popular column. **`view_count` is NOT in the projection** — so the ranking ORDER leaks but the magnitude is opaque (per F-003 facet `Popular tile API exposes 9 fields, view_count NOT among them`). The Popular column is the ONE column under 'Recommended' that is NOT per-user; an operator reading the 'Recommended' heading would reasonably assume all four columns share the same scoping rule." — evidence: Overview.tsx:53-59 + OwnerEntitiesList.tsx:99-105 + F-003 sidecar facet `Popular tile API exposes 9 fields`
  - "**Per-user data-entity references via three sibling columns** — Overview also mounts the three per-user-scoped columns (My Objects / Upstream / Downstream). Under DISABLED these are silently hidden (gate false). Under non-DISABLED, the four thunks fire with no per-tenant scoping beyond the user's resolved Owner — per the read-collaborative posture (REFACTOR-024 family) — meaning a user in Tenant A might see entities cross-linked to Tenant B's Owner if the backend's Owner resolution returns multi-tenant memberships." — evidence: OwnerEntitiesList.tsx:58-64 (the four dispatches)
- **known_security_gaps**:
  - "**OwnerAssociation mis-gating on empty/typo'd `auth.type`** — the batch-T AppInfoController finding's UI-side closure. Operator misconfiguration produces silent UI behaviour disagreement with intent — see bugs[0] above for the four scenarios. The compound is the worst case: empty `auth.type` AND `auth.ingestion.filter.enabled=false` (the default per application.yml:48) AND a network-reachable deployment = REFACTOR-185 / REFACTOR-073's compound. Overview's gate is one symptom surface; the root is the lack of boot-time validation per REFACTOR-073." — evidence: Overview.tsx:25-27 + AppInfoController.controller-class bugs[0,1] + REFACTOR-073 (boot-time security-posture validator) — severity: HIGH
  - "**Cross-owner enumeration via Popular column rendered downstream** (REFACTOR-024 family at the home page). Every signed-in user with an associated Owner sees the catalog-wide popular list on the home page — no per-Owner filter, no per-tenant partition. The 9-field projection includes `externalName` + `internalName` + `entityClasses[]` + `oddrn` + `hasAlerts` — enough metadata to identify entities outside the user's Owner. Combined with F-001's inflation surface (anonymous DISABLED-mode `/api/dataentities/{id}` can pump any entity's view_count), an attacker can promote any chosen entity to the home-page Popular column where every authenticated user sees its `externalName` and `internalName` — exfiltrating naming conventions, table-name patterns, and entity-class distributions across the whole catalog. The drift class is structural: REFACTOR-024 reads as an implicit ADR ('every authenticated user can enumerate the entire catalog' — per system-mission.md P-09 maintainer notes), and Overview is the home-page surface that makes the read paths reachable." — evidence: Overview.tsx:53-59 + OwnerEntitiesList.tsx:99-105 + REFACTOR-024 family + F-001 facet `inflation-attack surface confirmed at repo layer` + F-003 facet `service tier is a 1-line pass-through` — severity: MEDIUM (mitigation: per-Owner Popular filter or documented opt-in to catalog-wide popular)
  - "**Anonymous home-page reach under DISABLED**. Overview is REACHABLE by anonymous network callers under `auth.type=DISABLED` (the application.yml default per AppInfoController sidecar). The home page renders TopTagsList (30 tags, an attacker enumerates the tag taxonomy), Domains (every Domain DEG name + child count), DataEntitiesUsageInfo (per-class counts — total catalog size + per-class breakdown is a sizing fingerprint), Directory (every registered datasource type with entity counts). The OwnerAssociation card and Popular column are correctly hidden (per the gate), but the FOUR other surfaces leak operational fingerprinting data. The doc page (catalog-overview, WebFetched 2026-05-20 status 200) does not warn that under DISABLED the home page is a passive enumeration surface; this is the SAME drift class as AppInfoController bugs[3] (anonymous fingerprinting) but expanded from `{projectVersion, authType}` to the WHOLE home-page surface." — evidence: Overview.tsx:1-64 (no auth check) + DisabledAuthSecurityConfiguration.java:13-18 (per upstream `.anyExchange().permitAll()`) + the four child sub-surfaces — severity: MEDIUM
  - "**No CSRF, no rate-limit, no anti-bot on the home page**. Overview itself initiates no mutations, but the rendered children DO (TopTagsList click → search session create POST per `tagApi.getPopularTagList` / `createSearch`; Directory click → search session; DataEntitiesUsageInfo click → search session). On any DISABLED deployment, anonymous callers can fire these mutations by clicking through. No file-level CSRF token check, no per-user request throttle. The compound risk: anonymous home → click Popular path-equivalent → backend `view_count++` per F-001's inflation pattern. Overview is the UPSTREAM home of the entire home-page mutation surface but adds zero defence at this layer." — evidence: Overview.tsx:46-49 (search button) + TopTagsList.tsx:13-22 (click handler creates search) — severity: LOW (mitigation expected at backend, not UI)

## performance

- **hot_paths**: []. Overview is rendered ONCE per home-page mount. React-Query caches `appInfo` + `popularTags` under stable keys; on warm reload the network calls fire on mount but resolve from cache. No DB round-trip happens in Overview itself; the five children each issue their own (max) one HTTP request per mount. Total cold-mount work: 6 API GETs + 4 thunk dispatches (when OwnerAssociation chain mounts under non-DISABLED + identity+ownership) = 9-10 HTTP calls fan-out on first paint.
- **throughput_characteristics**:
  - "single-shot render — the component returns a tree; no streaming, no chunked render, no progressive enhancement" — evidence: Overview.tsx:34-61
  - "size=30 hardcoded for top tags (`useGetPopularTags({page:1, size:30})` line 20-23) — 30 records on EVERY home-page mount, regardless of viewport" — evidence: Overview.tsx:20-23 + tags.ts:5-14
- **resource_allocation**:
  - "useMemo allocates a memo cache for isLoading (line 29-32); useAppSelector + useAppInfo + useGetPopularTags allocate React-Query / Redux subscriptions — bounded by hook count (4 hooks total: useAppSelector, useAppInfo, useGetPopularTags, useMemo)" — evidence: Overview.tsx:18-32
  - "no large in-memory caches; popular tags array of 30 + popular-entity slice (later managed by OwnerEntitiesList) — trivial heap impact" — evidence: Overview.tsx:20-32
- **scaling_characteristics**:
  - "stateless component (functional, no useState) — Horizontally renders across any number of users / tabs without server-side coordination. Per-user React-Query caches are tab-local" — evidence: Overview.tsx:18-62 (no React.useState)
  - "the home-page render concurrency is bounded by the SPA's request concurrency — 6+ HTTP calls fan out from one mount; under network congestion the page is unresponsive until 2-3 critical paths (appInfo, identity, tags) complete" — evidence: Overview.tsx:24-32 (which two block the skeleton)
- **known_performance_gaps**:
  - "**6-10 fan-out HTTP calls on cold mount with NO `<Suspense>` boundary**. Under slow networks, the user sees the OverviewSkeleton for the duration of the longest of `isIdentityFetching | isTagsFetching`, then the home page renders with some children still loading their own data. The asymmetric skeleton trigger (per implicit_adr[2]) is a deliberate trade-off but is not documented and not bounded. A per-Overview `<Suspense>` with a unified fallback would simplify the UX." — evidence: Overview.tsx:29-32 + the four uncovered loading states — severity: LOW
  - "**Hardcoded `size=30` top tags fetch — no viewport adaptation**. On a small viewport (mobile, narrow desktop), 30 tag chips wrap into many rows; on a wide viewport, 30 may be too few to fill the row. The size is fixed regardless. A `useGetPopularTags({size: dynamic})` based on container width would reduce wasted bytes on small viewports and provide better filling on large viewports." — evidence: Overview.tsx:20-23 — severity: LOW

## sources

- understanding ← Overview.tsx:1-64
- concepts.entities.AppInfo ← Overview.tsx:8,24 + lib/hooks/api/appInfo.ts:4-9
- concepts.entities.isShowOwnerAssociation ← Overview.tsx:25-27
- concepts.entities.six-sub-surfaces ← Overview.tsx:44-60
- concepts.entities.Permission.DIRECT_OWNER_SYNC ← Overview.tsx:6,55 + grep result confirming downstream consumer `OwnerAssociationRequestServiceImpl.java:64`
- concepts.entities.tags ← Overview.tsx:20-23 + lib/hooks/api/tags.ts:5-14
- concepts.entities.isLoading ← Overview.tsx:29-32
- concepts.entities.getIdentityFetchingStatuses ← Overview.tsx:3,19
- concepts.entities.SkeletonWrapper ← Overview.tsx:4,37-39
- concepts.operations.fixed-sequence ← Overview.tsx:44-60
- concepts.operations.gate-derivation ← Overview.tsx:25-27
- concepts.operations.skeleton-trigger ← Overview.tsx:29-42
- concepts.operations.conditional-render ← Overview.tsx:53-59
- concepts.invariants.string-equality-DISABLED ← Overview.tsx:26
- concepts.invariants.gate-evaluates-false-for ← Overview.tsx:25-27 (predicate analysis)
- concepts.invariants.no-validation ← Overview.tsx:25-27 + AppInfoController.controller-class sidecar invariants[1]
- concepts.invariants.isLoading-composition ← Overview.tsx:29-32
- concepts.invariants.no-error-boundary ← Overview.tsx:1-64 (no try/catch / ErrorBoundary import)
- concepts.invariants.SPA-home-route ← grep result confirming Overview is the SPA's home-page mount
- concepts.invariants.rendered-regardless-of-auth ← Overview.tsx:1-64 (no RequireAuth wrapper at this level)
- dependencies_semantic.requires-feature.[0] (F-001/F-003) ← Overview.tsx:53-59 + F-001.yaml:5-44 + F-003.yaml:5-50 + PopularStrip sidecar understanding
- dependencies_semantic.requires-feature.[1] (AppInfoController) ← Overview.tsx:24-27 + AppInfoController.controller-class sidecar
- dependencies_semantic.requires-feature.[2] (P-09 auth) ← system-mission.md P-09 Security & Access Control
- dependencies_semantic.requires-feature.[3] (P-09 user-owner association) ← Overview.tsx:14,53-59 + OwnerAssociation.tsx:84-86
- dependencies_semantic.requires-feature.[4] (P-08 RBAC + DIRECT_OWNER_SYNC) ← Overview.tsx:6,55 + WithPermissionsProvider.tsx:12-49
- dependencies_semantic.requires-feature.[5] (P-01 sub-features) ← Overview.tsx:4,9-16,49-52 + system-mission.md P-01 Data Discovery
- dependencies_semantic.requires-runtime.React ← Overview.tsx:2
- dependencies_semantic.requires-runtime.redux ← Overview.tsx:7 + redux/lib/hooks
- dependencies_semantic.requires-runtime.react-query ← appInfo.ts:1,5 + tags.ts:1,5
- dependencies_semantic.couples-to.useAppInfo ← appInfo.ts:4-9 + Overview.tsx:8,24
- dependencies_semantic.couples-to.useGetPopularTags ← tags.ts:5-14 + Overview.tsx:10,20-23
- dependencies_semantic.couples-to.OwnerAssociation ← Overview.tsx:14,57 + OwnerAssociation.tsx:84-86
- upstream_callers.SPA-root-route ← Overview.tsx:1 (top-level export at line 64) + Overview is React.FC default-export
- upstream_callers.no-other-parents ← grep `import.*Overview` returns SPA route registration only
- downstream_side_effects.appInfo-fetch ← Overview.tsx:24 + appInfo.ts:7
- downstream_side_effects.popularTags-fetch ← Overview.tsx:20-23 + tags.ts:5-14
- downstream_side_effects.children-fetches ← Domains.tsx:10 + DataEntitiesUsageInfo.tsx:21 + Directory.tsx:10 + OwnerEntitiesList.tsx:58-64
- downstream_side_effects.F-001-loop-closure ← Overview.tsx:53-59 + PopularStrip sidecar downstream_side_effects + F-001.yaml hop-1 + DataEntityDetails.tsx:56-64 (the LSN-017 dep-array bug)
- downstream_side_effects.no-view_count-here ← Overview.tsx:1-64 (no view_count, no getPopular call) + grep result on `view_count|getPopular` returning only OwnerEntitiesList match
- downstream_side_effects.no-useEffect-here ← Overview.tsx:1-64 (no useEffect import or invocation)
- tests_coverage_semantic.test_files ← Glob `**/Overview*.test.tsx` returns no match for the Overview.tsx component (only the DataEntitiesUsageInfo sub-feature tests)
- docs_link_semantic.inferred_docs.[0] ← WebFetch https://docs.opendatadiscovery.org/features/data-discovery/catalog-overview (2026-05-20, status 200, names the home-page sections + DISABLED-mode visibility statements + Popular-click-target statement + OwnerAssociation-hidden-on-DISABLED statement)
- docs_link_semantic.doc_drift_findings.[0] (Recommended panel CONTRADICTS) ← WebFetch (2026-05-20) "on auth-disabled deployments the panel is visible but the per-user filtering does not apply" + Overview.tsx:25-27 + Overview.tsx:53-59
- docs_link_semantic.doc_drift_findings.[1] (OwnerAssociation hidden AGREES) ← WebFetch (2026-05-20) "On auth-disabled deployments the section is hidden" + Overview.tsx:25-27 (agreement on outcome) + AppInfoController sidecar bugs[0,1] (disagreement on failure modes)
- docs_link_semantic.doc_drift_findings.[2] (Popular click target Structure vs Overview) ← WebFetch (2026-05-20) "Clicking a tile opens that entity's Structure page" + DataEntityList.tsx:38 + dataEntitiesRoutes.ts:66-73 (default 'overview')
- docs_link_semantic.doc_drift_findings.[3] (six-section composition silent) ← WebFetch (2026-05-20) + Overview.tsx:44-60
- docs_link_semantic.doc_drift_findings.[4] (owner-association vs DISABLED cross-ref) ← WebFetch (2026-05-20) + Overview.tsx:53-59 + OwnerAssociation.tsx:30-89
- implicit_adrs.[0] (nested-gates per layer) ← Overview.tsx:25-27,53-59 + OwnerAssociation.tsx:30-89 + WithPermissionsProvider.tsx:12-49
- implicit_adrs.[1] (asymmetric skeleton trigger) ← Overview.tsx:29-32 + DataEntitiesUsageInfo.tsx:56 + Domains.tsx:12-21 + Directory.tsx:12-26
- implicit_adrs.[2] (WithPermissionsProvider context-only) ← WithPermissionsProvider.tsx:12-49 + Overview.tsx:53-59
- bugs_limitations_corner_cases.[0] (OwnerAssociation mis-gating) ← Overview.tsx:25-27 + AppInfoController.controller-class sidecar bugs[0,1] + the four `@ConditionalOnProperty(value="auth.type", havingValue=...)` per REFACTOR-073 evidence
- bugs_limitations_corner_cases.[1] (cross-owner enumeration via Popular column) ← Overview.tsx:53-59 + OwnerAssociation.tsx:84-86 + OwnerEntitiesList.tsx:99-105 + F-003 facet `service tier is a 1-line pass-through` + REFACTOR-024
- bugs_limitations_corner_cases.[2] (no LSN-017 dep-array here, but mounts the chain) ← Overview.tsx:29-32 (only useMemo) + DataEntityDetails.tsx:56-64 (the downstream bug, per LSN-017 + F-001 hop-1)
- bugs_limitations_corner_cases.[3] (asymmetric skeleton flicker) ← Overview.tsx:24-32 + Overview.tsx:53-59
- bugs_limitations_corner_cases.[4] (recomputed every render) ← Overview.tsx:25-32
- bugs_limitations_corner_cases.[5] (no error boundary) ← Overview.tsx:1-64
- security.auth_mode_relevance ← Overview.tsx:1-64 + DisabledAuthSecurityConfiguration.java:13-18 + LoginFormSecurityConfiguration.java:49-57 (per upstream sidecars)
- security.ingestion_filter_relevance ← Overview.tsx is the SPA root `/`, not `/ingestion/*`
- security.authorization_assertions ← Overview.tsx:53-59 + WithPermissionsProvider.tsx:12-49 (context-only, not a gate)
- security.owner_scoping ← Overview.tsx:53-59 + OwnerEntitiesList.tsx:99-105 + F-003 facet `service tier is a 1-line pass-through`
- security.data_exposure.[0] (authType) ← Overview.tsx:24-27 + AppInfoController.controller-class sidecar data_exposure
- security.data_exposure.[1] (cross-owner via Popular) ← Overview.tsx:53-59 + OwnerEntitiesList.tsx:99-105 + F-003 facet
- security.data_exposure.[2] (per-user three sibling columns) ← OwnerEntitiesList.tsx:58-64
- security.known_security_gaps.[0] (OwnerAssociation mis-gating) ← Overview.tsx:25-27 + AppInfoController bugs[0,1] + REFACTOR-073
- security.known_security_gaps.[1] (cross-owner Popular) ← Overview.tsx:53-59 + REFACTOR-024 + F-001/F-003
- security.known_security_gaps.[2] (anonymous home-page reach under DISABLED) ← Overview.tsx:1-64 + DisabledAuthSecurityConfiguration.java:13-18 + WebFetch catalog-overview 2026-05-20 (no warning)
- security.known_security_gaps.[3] (no CSRF / rate-limit / anti-bot) ← Overview.tsx:46-49 + TopTagsList.tsx:13-22
- performance.throughput_characteristics.[0] ← Overview.tsx:34-61
- performance.throughput_characteristics.[1] ← Overview.tsx:20-23 + tags.ts:5-14
- performance.resource_allocation.[0] ← Overview.tsx:18-32
- performance.scaling_characteristics.[0] ← Overview.tsx:18-62 (no useState)
- performance.known_performance_gaps.[0] (6-10 fan-out, no Suspense) ← Overview.tsx:29-32 + children loading states
- performance.known_performance_gaps.[1] (hardcoded size=30) ← Overview.tsx:20-23

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH (Glob result is definitive — no Overview.test.tsx exists; only the three DataEntitiesUsageInfo sub-feature tests)
- docs_link_semantic: HIGH (WebFetched the catalog-overview page in this session; doc-drift findings anchored on verbatim doc quotes + verbatim file:line in code; the 5 findings are HIGH-confidence factual disagreements)
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH
- security: HIGH (the cross-owner enumeration is anchored on F-003's MEASURED facet at the backend service tier + the file:line gate at Overview.tsx; the OwnerAssociation mis-gating is a logical composition of the AppInfoController consumer's lack of validation + Overview's lack of normalisation, both file:line-anchored)
- performance: HIGH

## related_features

- F-001 (P-01:F-001) Popular Entities Ranking — Overview is the HOME-PAGE MOUNT for the UI inflation loop's closure point (PopularStrip → click → DataEntityDetails → view_count++); Overview's outer gate decides whether the loop is reachable from the home page at all
- F-003 (P-01:F-001) Popular Entities Ranking — exclude-from-search filter consistency — Overview is the HOME-PAGE MOUNT for the Popular column's render; the column's cross-owner enumeration leak surfaces here

## related_retrospectives

- LSN-017 — Per-node code-anchored scan cannot see cross-layer user-observable effects. Overview is the UPSTREAM-most home-page surface from which the LSN-017 amplification (view_count +2 per page-open) is reachable via the F-001 inflation loop. Overview itself does NOT have the dep-array bug (no useEffect in this file), so this sidecar STRENGTHENS LSN-017 by anchoring the home-page entry point that LEADS to the bugged component, while clarifying that the bug is two routing transitions away.
- LSN-018 — Cross-batch reducer contradiction. Overview's doc-drift findings on (a) DISABLED-mode Recommended panel visibility, (b) Popular click destination, (c) six-section composition silence are the SAME drift class as F-001 facet `PopularStrip DISABLED-mode rendering CONTRADICTS docs`, F-001 facet `PopularStrip click-target docs mismatch`, F-003 facet `DISABLED-mode hides the Popular column entirely from home page`, and F-003 facet `Popular click-target navigates to Overview, doc says Structure`. Overview is the ROOT anchor for the DISABLED-mode drift (the gating predicate lives HERE, not in the children that surface the symptom) — back-link bidirectionality between this sidecar and F-001 / F-003 closes the LSN-018-shaped coherence path.

## related_refactoring_scopes

- REFACTOR-073 — No boot-time security-posture validator. Overview's gating predicate is one of the silent-degradation surfaces the validator would catch (empty / typo'd `auth.type` produces a confusing UI render with no error). The fix at REFACTOR-073 (boot-time fail-loud or warn-loud on misconfiguration) prevents Overview from reaching the bug[0] scenarios in the first place.
- REFACTOR-024 — Read-collaborative posture: cross-owner enumeration. The Popular column rendered through Overview's chain is one of the home-page surfaces that exemplifies REFACTOR-024 — every authenticated owner-associated user sees the catalog-wide popular list with no per-Owner filter.
- REFACTOR-185 — DISABLED + ingestion-filter-off compound. Overview's anonymous reach under DISABLED (security.known_security_gaps[2]) is one home-page surface symptomatic of the compound; the four child sub-surfaces (TopTagsList, Domains, DataEntitiesUsageInfo, Directory) leak fingerprinting metadata to anonymous callers.

## Maintainer notes
