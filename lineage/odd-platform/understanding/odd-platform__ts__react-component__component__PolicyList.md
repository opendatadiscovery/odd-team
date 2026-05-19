---
node_id: "odd-platform ts react-component component:PolicyList"
node_kind: react-component
axis: ui_components
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.3.0
schema_version: v0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-20-Q-policy-list-ui
related_features:
  - F-006
related_pillar_features:
  - P-08:F-003   # Owner Lifecycle Management (sibling Management tab — pattern reference)
  - P-09:F-001   # Role-Based Access Control (the policy half — sibling to F-006)
related_retrospectives:
  - LSN-001   # silent no-op pattern — catalogue-as-shown vs GRANT-as-resolved
  - LSN-017   # useEffect dep-array doubling shape — explicitly tested and refuted here
  - LSN-018   # coherence: cross-checks F-006 + ReactivePolicyRepositoryImpl
---

# PolicyList (Management → Policies tab) — semantic understanding

## understanding

`PolicyList.tsx` (lines 1-128) is the Management → Policies tab's root component — a 128-line React shell that lists every policy the current user is allowed to see, paginates via infinite scroll, debounces a search query, and gates the "Create policy" CTA behind `WithPermissions permissionTo={Permission.POLICY_CREATE}` (lines 91-98). The shell renders ONLY each policy's `id` and `name` (line 119, `policyList?.map(({ id, name }) => …)`); the actual policy STATEMENTS (the permission grants — the operative authorization) are loaded ONLY when the operator clicks a row and routes to `PolicyDetails.tsx`, where `PolicyForm.tsx` mounts `AppJSONEditor` against the JSON-Schema document returned by `GET /api/policies/schema` (`PolicyServiceImpl.getPolicySchema` at `PolicyServiceImpl.java:97-100` → `policy_schema.json`). The implication is load-bearing: the catalogue the operator AUTHORS against is the schema's enumerated permission codes (e.g. `DATA_ENTITY_VIEW`, `MANAGEMENT_CONTROL`, `POLICY_CREATE` — the 75-value Permission enum statically defined in `components.yaml:158-235`), NOT a human-readable grant table; the GRANT the backend resolves at request time comes from `getRolesPolicies` which JOINs `policy ↔ role_to_policy` per `ReactivePolicyRepositoryImpl.java:32-38` (see sibling sidecar). **The PolicyList component itself sits ABOVE the LSN-018-area soft-delete drift surfaced in F-006: this list endpoint cannot show soft-deleted policies because the underlying `policyRepository.list(...)` query auto-applies `WHERE deleted_at IS NULL` via the soft-delete base class — but a ROLE bound to a soft-deleted policy continues to confer permissions through the un-filtered `getRolesPolicies` JOIN, so the operator audit experience is asymmetric: deleted-policy invisible HERE, still-granting THERE.**

## concepts

- entities:
  - "Policy (OpenAPI-generated DTO, `generated-sources` Policy interface — surfaced as `{ id, name }` rows in `policyList?.map(...)` at PolicyList.tsx:118-120)"
  - "Permission.POLICY_CREATE (enum value — passed to `WithPermissions` at line 91; ALSO referenced at PolicyItem.tsx:42-49 for POLICY_UPDATE and at line 54 for POLICY_DELETE on each row)"
  - "PoliciesState (Redux slice — `state.policies.policies` holds the `EntityAdapter`-backed list + `pageInfo: { total, page, hasNext }` per `policy.slice.ts:15-22`)"
  - "CurrentPageInfo (interfaces type — `{ total, page, hasNext }` per `policy.slice.ts:17`; consumed at PolicyList.tsx:33)"
  - "PolicyListSkeleton (loading-placeholder component — rendered as InfiniteScroll's `loader={isPoliciesFetching && <PolicyListSkeleton length={5} />}` at line 116)"
  - "EmptyContentPlaceholder (rendered at line 123 when `contentNotExists` — i.e. fetch resolved and the list is empty)"
- operations:
  - "On mount + on every `query` change → dispatch `fetchPolicyList({ page: 1, size: 100 })` IF query is empty (PolicyList.tsx:39-41)"
  - "On every `total` change → setTotalPolicies(total) IF query is empty (lines 43-45) — this preserves the 'X policies overall' count while the user is search-filtering"
  - "On user keypress in the search input → setQuery + handleSearch (lines 59-62); handleSearch is a 500ms debounced callback that dispatches `fetchPolicyList({ page: 1, size: 100, query })` (lines 52-57)"
  - "On Enter keypress in the search input → handleSearch (line 65)"
  - "On infinite-scroll next-page trigger → `fetchNextPage` dispatches `fetchPolicyList({ page: page + 1, size: 100, query })` IF `hasNext` (lines 47-50)"
  - "Mount of each `<PolicyItem key={id} policyId={id} name={name} />` per row (line 119) — each row internally exposes Edit/View (gated by POLICY_UPDATE + Administrator-name check) + Delete (gated by POLICY_DELETE + Administrator-name check)"
  - "WithPermissions checks `usePermissions().hasAccessTo(POLICY_CREATE)` via the React context populated by `WithPermissionsProvider` (passed in `allowedPermissions` / `resourcePermissions` upstream — the permissions list ultimately comes from `PermissionController.getResourcePermissions` per the sibling sidecar)"
- invariants:
  - "**The list shows ONLY soft-undeleted policies.** `PolicyServiceImpl.list` (PolicyServiceImpl.java:53-60) routes through `policyRepository.list(page, size, query)` for ADMIN users (the ADMIN branch via `switchIfEmpty` at line 58); for non-ADMIN users the in-memory `getRolePolicies` (lines 109-116) returns the user's role-attached policies. Both paths use `EntityAdapter.setMany / setAll` semantics in the slice (policy.slice.ts:29-39) — the UI has no surface for showing soft-deleted policies. There is **NO status filter UI control on this component** (verified by reading PolicyList.tsx lines 73-125 end-to-end: only one Input (`variant='search-m'`) plus one Button (Create policy) — no status dropdown, no toggle, no 'show deleted' switch)."
  - "**The Create-policy CTA is permission-gated; the LIST itself is NOT gated at the route level by this component.** `WithPermissions permissionTo={Permission.POLICY_CREATE}` (lines 91-98) wraps ONLY the Create button. The list rendering at lines 109-122 is unconditional — every authenticated user who reaches `/management/policies` sees ALL policy NAMES (subject to the service-layer ADMIN/non-ADMIN branching: ADMIN users see every policy, non-ADMIN users see only policies attached to their own roles per PolicyServiceImpl.java:54-58). Permission GATING for reaching the route lives elsewhere (the Management route shell + the Permission-context provider chain) — NOT in this file."
  - "**`isAdministrator` defence is a pure-NAME string check.** `PolicyItem.tsx:23` checks `isAdministrator = name === 'Administrator'` to hide Edit/Delete on the seeded Administrator policy. The check is brittle by design: it depends on the literal name 'Administrator' matching `PolicyServiceImpl.ADMINISTRATOR_POLICY` (PolicyServiceImpl.java:29) — if the seeded policy is ever renamed in a migration OR if a SECOND policy named 'Administrator' is ever created (the partial unique index `policy_name_unique WHERE deleted_at IS NULL` permits a fresh Administrator policy after the seeded row is soft-deleted, per F-006 batch-H finding), the UI guard fires on the WRONG row. The check is also case-SENSITIVE (`===`) — matching the case-sensitivity-mismatch pattern documented in F-006 batch-N (RoleServiceImpl.update vs .delete). Cross-batch link: F-006 drift_class `role_create_administrator_name_asymmetry_mirror` and `role_service_predefined_name_case_sensitivity_mismatch` both describe symmetrically-shaped risks at the SERVICE layer; this UI guard inherits the same brittleness."
  - "**Total-count drift across search.** Lines 43-45 (`useEffect [total]: if (!query) setTotalPolicies(total)`) freeze the 'X policies overall' subtitle (line 78) at the most-recent unfiltered total. While the user is filtering, the subtitle continues to say e.g. '12 policies overall' even when only 3 are visible. The intent is reasonable (the count is the catalogue size, not the filter-result size), but no caption distinguishes 'overall' from 'matching' — a careful operator reading '12 policies overall' alongside 3 visible rows may infer that the list is paginated and hit 'load more' (which dispatches with the query — `fetchNextPage` at line 49 always passes `query`)."
  - "**Single InfiniteScroll target.** `id='policy-list'` (line 109) is the scroll container; `scrollableTarget='policy-list'` (line 115) wires `react-infinite-scroll-component` to that container. The `scrollThreshold='200px'` (line 114) triggers `fetchNextPage` when the user scrolls within 200px of the bottom — `fetchNextPage` is the one path that increments the page counter (line 49: `page + 1`)."
- audiences:
  - "platform-operator — the Management tab is operator-facing; reaching this route requires (a) authenticated session or (b) `auth.type=DISABLED` per the documentation pillar P-09"
  - "data-steward-owner — Owners attached to RBAC roles see the policies their roles grant; non-ADMIN users see only their role-attached policies per PolicyServiceImpl.java:53-60"
  - "odd-platform-ui-end-user — anyone reaching the Management → Policies tab via the SPA navigation"

## dependencies_semantic

- requires-feature:
  - "F-006 / P-09:F-001 Role-Based Access Control (POLICY half) — this UI is the operator-facing list of the same POLICY entities that `ReactivePolicyRepositoryImpl` persists and `getRolesPolicies` resolves on every authorized request. The four-layer chain is PolicyList.tsx → fetchPolicyList thunk → PolicyApi.getPolicyList (generated client) → PolicyController.getPolicyList → PolicyServiceImpl.list → ReactivePolicyRepository.list (or in-memory `getRolePolicies` for non-ADMIN)."
  - "F-019 / P-08:F-003 Owner Lifecycle Management (pattern reference) — both Owner and Policy lists in Management share the same shell-shape: `WithPermissions` wraps the Create CTA, `InfiniteScroll` renders rows, `usePermissions().hasAccessTo` decides per-row Edit/Delete visibility. The Owner-side audit-silence pattern (5-sidecar from F-006 batch P) applies symmetrically to Policy mutations — UI-level Create / Update / Delete events produce NO log line and NO Activity Feed entry."
  - "F-006 batch-H `ReactivePolicyRepositoryImpl` primary-source — the soft-delete + partial-unique-index design — is what makes `policyList` here a STABLE-NAME view (auto `deleted_at IS NULL` filter at the repository), in contrast to the GRANT path where soft-deleted policies still grant permissions per `getRolesPolicies` orphan-binding drift."
- requires-config:
  - "(none operator-controllable at this component) — the hardcoded page size `100` (line 35) is build-time; the search debounce `500ms` (line 55) is build-time; the scroll threshold `200px` (line 114) is build-time. No `application.yml` / env-var controls the UI behaviour of this component. Per the substrate's UI sidecar conventions, this is N/A for `requires-config` rather than a finding."
- requires-runtime:
  - "React 18+ — `React.useState` (lines 36-37), `React.useEffect` (lines 39, 43), `React.useMemo` (line 68), `React.useCallback` (line 52) — the standard hook set"
  - "Redux Toolkit — `useAppDispatch` + `useAppSelector` (`redux/lib/hooks`); the `policiesSlice` (policy.slice.ts:24-57) owns the merge-on-fetch logic"
  - "`react-infinite-scroll-component` — the InfiniteScroll wrapper around the row list (lines 110-117)"
  - "`use-debounce` — `useDebouncedCallback(..., 500)` provides the search debounce (lines 52-57)"
  - "`react-i18next` — `useTranslation()` (line 27); all label strings pass through `t('...')` — `t('Policies')`, `t('policies overall')`, `t('Search policies')`, `t('Create policy')`, `t('Policy name')`. The translation table lookup is at the i18n initialisation layer (verified at `<odd-platform-repo>/odd-platform-ui/src/lib/i18n.ts` — outside this file's scope)"
  - "MUI 5 (`@mui/material`) — `Grid`, `Typography` (line 2); plus shared design-system components `Button`, `EmptyContentPlaceholder`, `Input`, `NumberFormatted` (lines 14-19)"
  - "OpenAPI-generated `Permission` enum + `Policy` type (from `generated-sources`, lines 5, 20) — the wire contract owned by `openapi.yaml` / `components.yaml`"
- couples-to:
  - "`PolicyItem` (PolicyItem.tsx:1-82) — the per-row component; receives only `{ policyId, name }` (line 119), then internally re-uses `usePermissions` to gate Edit/View vs Delete actions"
  - "`fetchPolicyList` thunk (`redux/thunks/policy.thunks.ts:15-26`) — calls `policyApi.getPolicyList({ page, size, query })`; the only consumer of `GET /api/policies` (verified by Grep over `<odd-platform-ui-repo>/src` returning only this thunk and the slice's extraReducer for fulfilled state)"
  - "`policiesSlice.extraReducers.fetchPolicyList.fulfilled` (policy.slice.ts:29-40) — page === 1 path calls `setAll` (replaces the entity adapter contents); page > 1 path calls `setMany` (merges). The slice has NO de-duplication beyond what `EntityAdapter` does by `id`."
  - "`getPoliciesList` / `getPoliciesListPageInfo` / `getPoliciesFetchingStatuses` selectors (policies.selectors.ts:12-39) — the read surface from Redux"
  - "`WithPermissions` / `usePermissions` context (`components/shared/contexts/Permission/WithPermissions.tsx:1-34` + `lib/hooks/usePermissions.ts:1-17`) — the permission-gating primitive. `WithPermissions` renders `null` when `hasAccessTo(permissionTo)` is false (line 28); the Create button is therefore *invisible* (not disabled) to users without POLICY_CREATE."

## upstream_callers

| Caller (file:line) | Method invoked | Call context | Owner-scoping at caller? | Notes |
|---|---|---|---|---|
| Management SPA route (`/management/policies` per the Management route shell — outside this file) renders `<PolicyList />` as the children of the route segment | Renders the default-export functional component (line 128) | Tab change on the Management page; user navigates to Policies tab | N/A — UI; ROLE-scoping happens at the service layer (ADMIN/non-ADMIN branch in PolicyServiceImpl.java:53-60) | Single rendering entry. No props (the component is a no-props default export); all state comes from Redux + route context. |
| `PolicyItem.tsx:42-72` | Per-row mounting of PolicyList's mapped rows | Renders inside `<InfiniteScroll>` at PolicyList.tsx:118-120 | N/A — row-level; the row uses `usePermissions` for Edit/Delete gating but does not perform owner-scoping (Policy is a platform-global entity per F-006 / ReactivePolicyRepositoryImpl `security.owner_scoping: N/A`) | The row's Delete action calls `dispatch(deletePolicy({ policyId }))` (PolicyItem.tsx:25-28) → `policyApi.deletePolicy` → `PolicyController.deletePolicy` → `PolicyServiceImpl.delete` (PolicyServiceImpl.java:83-95). The delete flow inherits all F-006 drift facets (cascade-delete defence at PolicyServiceImpl.java:89-92; forensic silence at all three layers; lost-update race on update). |

## downstream_side_effects

| Trigger | Effect | RW shape | Failure modes |
|---|---|---|---|
| Mount + `query` becomes empty | `dispatch(fetchPolicyList({ page: 1, size: 100 }))` (line 40) | Redux state write via slice extraReducer (replaces entire policy list with page 1) | The thunk wraps in `handleResponseAsyncThunk` (`policy.thunks.ts:15`); on rejection the slice does not transition (no `.rejected` reducer registered in `policiesSlice.extraReducers` per policy.slice.ts:28-56), so the UI shows the previous list with `isPoliciesFetching: false` and `contentNotExists: false` — stale display on transient errors. |
| Search-input keypress | `setQuery` + 500ms-debounced `dispatch(fetchPolicyList({ page: 1, size: 100, query }))` | Redux state write — replaces list with filtered page 1 | Debounce coalesces rapid typing into one dispatch; if the user clears the input within 500ms the second `useEffect` at line 39 fires `fetchPolicyList({ page: 1, size: 100 })` — TWO dispatches can race (one debounced with stale query, one effect-driven empty); whichever resolves SECOND wins via slice `setAll`. Net behaviour is eventually consistent but not strictly ordered. |
| Enter keypress in search input | Same debounced dispatch (line 65) | Same as above | Same. Note: Enter does NOT bypass the 500ms debounce — `useDebouncedCallback` returns one trailing-edge call irrespective of trigger. |
| Scroll to within 200px of bottom of `#policy-list` container | `fetchNextPage` dispatch (line 49: `fetchPolicyList({ page: page + 1, size: 100, query })`) | Redux state write — `setMany` merges new page into existing list (preserves prior pages) | If `hasNext` is false the dispatch is skipped (line 48). If `query` is non-empty the next-page request carries the query — non-ADMIN users will fetch via the in-memory `getRolePolicies` (PolicyServiceImpl.java:53-60) which returns `Page.hasNext = false` regardless (line 115: `new Page<>(filteredPolicies, filteredPolicies.size(), false)`), so infinite-scroll naturally terminates for non-ADMINs after one page. |
| Click `Create policy` button (visible only with `Permission.POLICY_CREATE`) | Navigates to `createPolicy` route (line 94: `to='createPolicy'`); routes to PolicyDetails+PolicyForm | No state write here — write happens on PolicyForm submit | The Permission check is UI-only — the backend `PolicyController.createPolicy` (PolicyController.java:19-25) accepts the request without re-checking POLICY_CREATE at the controller method (authorization is wired upstream via SECURITY_RULES per the sibling PermissionController sidecar). A user without POLICY_CREATE who manually navigates to the `createPolicy` URL bypasses the UI hide-the-button defence; the backend authorization framework is what STOPS the create. |

## implicit_adrs

- "**Default page size 100, hardcoded.** Line 35 sets `const size = 100;` — not user-configurable, not env-controlled. The decision encodes 'one page covers most operator deployments' (a fresh ODD Platform has 2 seeded policies; an enterprise deployment with custom RBAC may have 20-50). 100 is generous enough to render most catalogues without infinite-scroll, but the explicit literal (not a constant import, not a config) commits the decision at the call site." — evidence: PolicyList.tsx:35 — intent_anchor: the literal 100 appears nowhere else in the codebase as `policy-page-size` (Grep verified); the value is per-feature-component, consistent with NamespaceList / OwnerList / TagList in `Management/` which use similar single-component-scoped page sizes — confidence: MEDIUM (the value is hardcoded, but no comment explains the choice)

- "**Search debounce is 500ms.** `useDebouncedCallback(() => dispatch(...), 500)` at lines 52-57 encodes a 500ms trailing-edge debounce. This is the same value used in SearchController-facing UI components per the substrate's UI conventions; the magic number is consistent across Management's search-input surfaces." — evidence: PolicyList.tsx:55 — intent_anchor: the same 500ms appears in the search-input pattern in OwnerList and TagList (verified by Grep of `useDebouncedCallback` across `odd-platform-ui/src/components/Management`) — confidence: HIGH

- "**Permission-gated Create CTA via `WithPermissions` (UI hide, NOT auth enforcement).** The decision pattern is: render-nothing rather than render-disabled. `WithPermissions` returns `null` when `hasAccessTo(permissionTo)` is false (WithPermissions.tsx:28). This is the platform's consistent UX pattern across Management — buttons disappear rather than appearing greyed out. The advantage is no operator-visible noise about permissions they don't have; the disadvantage is that operators discovering missing functionality cannot infer 'this action exists, you lack permission' from the UI — they see no trace of the action at all. Authorization is fundamentally enforced at the backend SECURITY_RULES layer; the UI gate is presentation-only." — evidence: PolicyList.tsx:91-98 + WithPermissions.tsx:11-32 + sibling sidecar `odd-platform__java__PermissionController__controller-method__getResourcePermissions.md` — intent_anchor: the pattern is consistently `WithPermissions permissionTo={...}` wrapping the action affordance across PolicyItem.tsx, PolicyList.tsx, and every Management/*/CreateButton — confidence: HIGH

- "**Administrator-policy guard is a NAME-string match at PolicyItem.tsx:23.** `isAdministrator = name === 'Administrator'` is duplicated in `PolicyForm.tsx:28` and verified case-sensitive throughout (no `equalsIgnoreCase`). The backend service-layer guard is symmetric per PolicyServiceImpl.java:29 (`ADMINISTRATOR_POLICY = \"Administrator\"`) + line 76, 87 (case-sensitive `.equals`). The UI inherits the brittleness of the name-string contract: a renamed seeded row or a CASE-VARIANT clone (e.g. 'administrator' lowercase, which the partial unique index permits per F-006 batch-N case-sensitivity-mismatch finding) bypasses the UI guard. This is a CROSS-LAYER pattern: UI guard, service guard, and partial-unique-index all hinge on the case-sensitive 'Administrator' string." — evidence: PolicyItem.tsx:23 + PolicyForm.tsx:28 + PolicyServiceImpl.java:29, 76, 87 + ReactivePolicyRepositoryImpl sidecar + F-006 drift_class `role_service_predefined_name_case_sensitivity_mismatch` (the symmetric Role-side risk) — intent_anchor: literal string `'Administrator'` repeated across UI + service + sql DDL — confidence: HIGH

- "**Total-policies subtitle is FROZEN to last unfiltered total during search.** `useEffect [total]: if (!query) setTotalPolicies(total)` at lines 43-45 explicitly chooses 'subtitle shows the catalogue total, not the filter total'. The `(!query)` guard is the intent expression. The product decision is reasonable but unlabelled: the UI says e.g. '12 policies overall' even when the search filter narrowed the view to 3." — evidence: PolicyList.tsx:43-45, 78 — intent_anchor: the `(!query)` conditional is explicit about preserving the unfiltered count — confidence: HIGH

## bugs_limitations_corner_cases

- "**`fetchPolicyList` in useEffect deps is a stable-reference smell, NOT an LSN-017 doubling.** Lines 39-41: `React.useEffect(() => { if (!query) dispatch(fetchPolicyList({page:1, size})); }, [fetchPolicyList, query]);`. `fetchPolicyList` is a thunk reference imported from `redux/thunks` — it is module-level-constant, never changes per render. Listing it in the dep array is incorrect ESLint guidance (`react-hooks/exhaustive-deps` would flag this as the wrong reference for `dispatch`, since `dispatch` is the actual callee; `fetchPolicyList` is just a closure value passed into `dispatch`). It does NOT cause the LSN-017 doubling shape — the dep is stable, the effect fires once on mount + once per query-change. **Tested by reasoning: under React 18 strict mode the effect fires twice on mount (intentional StrictMode double-render), but that's a development-only artefact, NOT the LSN-017 cross-layer view_count doubling.** Severity is COSMETIC (incorrect dep list per linting hygiene); the production behaviour is correct. The same anti-pattern appears at lines 52-57 (`useCallback(useDebouncedCallback(() => dispatch(fetchPolicyList(...)), 500), [query, size, fetchPolicyList])`) — same stable-ref reasoning, same cosmetic-only consequence." — evidence: PolicyList.tsx:39-41 + 52-57 — severity: LOW

- "**Search-clear race.** When the user types a search term then clears it within 500ms: (a) the debounced search dispatch is still pending in `useDebouncedCallback`'s internal timer; (b) the `query` state becomes empty, triggering the `[query]` effect at line 39, which dispatches `fetchPolicyList({page:1, size})` (NO query). Both dispatches are inflight; the slice's `fetchPolicyList.fulfilled` reducer (policy.slice.ts:29-40) handles whichever resolves second via `setAll` (page === 1 path). Net behaviour is correct (the no-query list eventually wins because (a) the query that ran becomes a stale filter result on top of an empty filter input, and (b) the no-query result replaces via `setAll`), but the order of resolution is not deterministic. The 500ms debounce makes this rare in practice." — evidence: PolicyList.tsx:39-66 + policy.slice.ts:29-40 — severity: LOW

- "**`totalPolicies` initial value lags Redux.** Line 37: `const [totalPolicies, setTotalPolicies] = React.useState(total);` — initialised to the CURRENT value of `total` from the selector. If `PolicyList` is mounted before Redux is hydrated (e.g. cold load of `/management/policies`), `total` is `0` (initialState at policy.slice.ts:17) — so the subtitle reads '0 policies overall' until the first fetch fulfils. The `useEffect [total]` (lines 43-45) updates `totalPolicies` ONLY IF `!query`; on the first fetch this fires correctly. But: if the user lands on `/management/policies` with an active search query (e.g. via deep-link), `totalPolicies` is FROZEN at 0 because `useEffect [total]` is gated by `!query`. No deep-link scenario exists today (the search input has no URL-backing — verified by reading lines 36 + 88 + the absence of `useQueryParams` import), but a future PR adding deep-link search would surface this off-by-one." — evidence: PolicyList.tsx:36-45 — severity: LOW

- "**No URL state for `query`.** The search input is a controlled component bound to local `useState` (line 36); the query string is not URL-backed via `useQueryParams` (no such import in this file — verified). Sharing a search-result URL is impossible; refreshing the page resets the search. This is a deliberate UX choice (the Management → Policies tab is small enough that catalogue-wide deep links aren't expected), but it inconsistently differs from the SearchController page (which DOES use URL-state for facets per the substrate's SearchController.facets sidecar)." — evidence: PolicyList.tsx:36, 59-62 (no URL writes) — severity: LOW

- "**`getRolePolicies` (non-ADMIN branch) returns `Page.hasNext = false` regardless of size.** Backend cross-layer caveat: when the current user is non-ADMIN, `PolicyServiceImpl.list` (PolicyServiceImpl.java:53-60) calls `getRolePolicies(roles, query)` which builds a Page with `new Page<>(filteredPolicies, filteredPolicies.size(), false)` (line 115) — hasNext is HARDCODED FALSE. The UI's infinite-scroll terminates correctly after one page even if a non-ADMIN user has more than 100 role-attached policies. The behaviour is correct (in-memory filter; no DB pagination), but the contract is unobvious to a frontend developer reading just PolicyList.tsx — they would assume pagination always works." — evidence: PolicyServiceImpl.java:53-60, 109-116 + PolicyList.tsx:33, 47-50 (relies on hasNext) — severity: LOW

- "**Catalogue-vs-grant asymmetry across the soft-delete surface.** The LIST endpoint shown by this UI is filtered through the soft-delete base class (`policyRepository.list(...)` auto-applies `WHERE deleted_at IS NULL` per ReactiveAbstractSoftDeleteCRUDRepository sidecar). The GRANT path on every authorized request (`getRolesPolicies(roleIds)`) is NOT filtered (per ReactivePolicyRepositoryImpl batch-H finding `known_security_gaps[0]`). An operator looking at the Policies tab sees a CONSISTENT view ('list shows what exists, deleted policies are gone'); the OPERATING reality is that a role bound to a soft-deleted policy continues to confer that policy's permissions. The UI does NOT (and cannot from this layer) surface this drift; it is invisible to operators who never inspect the SQL layer. Cross-batch link: this is the symmetric UI half of F-006 batch-H + batch-N drift_class `soft_delete_aware_visibility_inconsistency`." — evidence: PolicyList.tsx:1-128 + PolicyServiceImpl.java:53-58 (list path) + ReactivePolicyRepositoryImpl.java:32-38 (getRolesPolicies grant path — sibling sidecar) — severity: MEDIUM

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/policies"
    anchor: ""
    rationale: "Canonical operator-facing page for the Policies concept. The Management → Policies tab IS the UI affordance documented on that page. Live-fetch verification was inherited from sibling sidecars (batch-E PolicyController.createPolicy verified status 200 on 2026-05-12; batch-H ReactivePolicyRepositoryImpl reaffirmed the inheritance). No fresh WebFetch attempted in this session (cost-of-discovery already paid; the doc-side narrative for Policies is well-characterised across the F-006 sidecar set)."
    last_verified_at: "2026-05-12T00:00:00Z"
    last_verified_status: 200
    last_verified_via: "batch-E sidecar inheritance — sibling sidecars confirm live status 200"
    confidence: LOW
  - url: "https://docs.opendatadiscovery.org/features/management"
    anchor: "#policies-tab"
    rationale: "P-08 Management pillar landing page enumerates the Management tabs including Policies (per system-mission.md P-08 sub-feature seed: 'Policies tab (ODDRN-pattern-matched permission rules)'). This UI component IS the Policies tab. The inferred anchor `#policies-tab` is conjectural — derived from the docs' typical heading-slug pattern; NOT WebFetch-verified in this session (confidence reflects this)."
    last_verified_at: "2026-05-19T00:00:00Z"
    last_verified_status: pending-WebFetch-session
    last_verified_via: "deferred — system-mission.md frontmatter records the Management pillar URL as pending-WebFetch-session"
    confidence: LOW
- fetched_excerpts: |
    No fresh WebFetch in this session. The relevant doc-side context inherited from sibling sidecars:
    - The Policies page documents the policy JSON shape (resource types / conditions / permissions / the `ALL` keyword) but is SILENT on the Management → Policies tab UX itself (the list view, the search affordance, the infinite-scroll model, the Create CTA permission gate).
    - The Management pillar page (`docs.opendatadiscovery.org/features/management`) enumerates Policies as a tab but does not document the per-tab UX.
- doc_drift_findings:
  - "**UI-DOC-GAP-A: The live Policies doc page does not document the catalogue-vs-grant asymmetry across soft-delete.** An operator using this UI cannot infer from the Policies tab that a deleted policy may still confer permissions (per F-006 batch-H finding). Recommended doc edit (for a maintainer to triage): add an admonition stating 'A policy soft-deleted via this tab continues to grant permissions to users in any role still bound to it, until the role's policy binding is removed via the Roles tab.' Cross-batch link: this is the same drift surfaced by F-006 + ReactivePolicyRepositoryImpl sidecar `docs_link_semantic.doc_drift_findings`. Severity: HIGH (operator-misleading; a deleted-via-this-UI policy looks gone but isn't gone)."
  - "**UI-DOC-GAP-B: The Policies tab UX itself is undocumented.** No live doc describes (a) the page-size 100 default, (b) the search-debounce 500ms behaviour, (c) the non-ADMIN single-page constraint (`hasNext=false` hardcoded at PolicyServiceImpl.java:115), (d) the 'total policies overall' subtitle being frozen during search. Operators discovering these behaviours have no doc to consult. Severity: LOW (no operator misled; usability friction only)."
  - "**UI-DOC-GAP-C (LSN-001 PATTERN — catalogue-as-shown vs GRANT-as-resolved).** When the operator clicks a policy row and lands on `PolicyDetails`, the `PolicyForm` mounts `AppJSONEditor` against the `policySchema` JSON. The operator AUTHORS against permission CODES (e.g. `DATA_ENTITY_VIEW`, `MANAGEMENT_CONTROL`). The CATALOGUE the operator sees is the 75-value Permission enum from `components.yaml:158-235`. The GRANT that the backend resolves is `getRolesPolicies → role_to_policy join → effective permissions per request`. No live doc page maps the permission codes to user-readable descriptions (e.g. 'What does MANAGEMENT_CONTROL grant? Is it just /api/management/* or also /api/policies/*?'). An operator authoring a policy must read both `components.yaml` and the per-controller code to understand what each permission code grants — there is no human-readable catalogue in the docs. **Mirror of LSN-001: the CATALOGUE the operator sees is not the same shape as the EFFECT the platform applies.** Severity: MEDIUM (UX friction; doc-product editorial finding for the next /review pass)."

## security

- **auth_mode_relevance**: `LOGIN_FORM | OAUTH2 | LDAP` — the Management → Policies tab is a UI/API surface protected by the three non-DISABLED auth modes per the SECURITY_RULES wiring described in the sibling PolicyController.createPolicy sidecar. Under `auth.type=DISABLED` the route is reachable by anyone able to hit the platform's HTTP port (the documented dev-only mode per pillar P-09). The component itself does not gate by auth mode — the upstream route shell + the `WithPermissionsProvider` chain decide whether `PolicyList` mounts at all.
- **ingestion_filter_relevance**: `NO — UI/API surface, not ingestion`. The `auth.ingestion.filter.enabled` filter applies only to `/ingestion/entities` — this component fetches `/api/policies` which is on the UI/API surface, governed by SECURITY_RULES not by the ingestion filter.
- **authorization_assertions**:
  - "`WithPermissions permissionTo={Permission.POLICY_CREATE}` (PolicyList.tsx:91-98) — UI-only hide of the Create CTA. The PolicyItem.tsx row uses `Permission.POLICY_UPDATE` (line 42-49) for Edit-vs-View and `Permission.POLICY_DELETE` (line 54) for Delete visibility."
  - "`usePermissions().hasAccessTo(permission)` is fully client-side (`lib/hooks/usePermissions.ts:10-13` → `React.useContext(PermissionContext)` → context populated by `WithPermissionsProvider`). The list of allowed permissions ultimately comes from `PermissionController.getResourcePermissions` per the sibling sidecar — a per-resource permission lookup. The UI gate is PRESENTATION ONLY; the backend authorization framework is the actual enforcement (SECURITY_RULES + ManagementPermissionExtractor + AbstractContextualPermissionExtractor → getRolesPolicies)."
- **owner_scoping**: `N/A — Policy is a platform-global resource`. Per ReactivePolicyRepositoryImpl sidecar `security.owner_scoping`, the policy table has no `owner_id` column. The non-ADMIN branch of `PolicyServiceImpl.list` (PolicyServiceImpl.java:53-58) returns ROLE-scoped policies (the user's role-attached policies), not OWNER-scoped — but role-scoping at this layer is a service-layer pattern, not the platform's Owner-scoping framework (which applies to data entities + ownership + terms).
- **data_exposure**:
  - "List view exposes `{ id, name }` per policy (PolicyList.tsx:119) → audience is ADMIN users (full catalogue) or non-ADMIN users (their role-attached policies). Names like 'Administrator', 'Management Control', 'Data Quality Admin' may signal organisational structure; the list is informational disclosure of the platform's RBAC vocabulary."
  - "Click-through to PolicyDetails exposes the FULL POLICY JSON (permission grants, resource patterns, conditions) — only visible after clicking a row, but no permission check inside this component prevents that click; the row is rendered for everyone who can see the row. PolicyItem.tsx:46 (`to={\\`${policyId}\\`}`) routes unconditionally. Policy CONTENT exposure is gated only by whether the user can reach `/management/policies/${policyId}` in the first place — same auth-mode/RBAC posture as the list."
  - "Create-policy CTA visibility leaks the user's POLICY_CREATE permission to the DOM (the button is rendered iff the user has POLICY_CREATE). An adversary inspecting the DOM can infer the current user's permission set by enumerating which Management CTAs are visible. This is an architectural pattern across the platform (UI-only hide), not a per-component decision; the SECURITY_RULES backend is the actual defence."
- **known_security_gaps**:
  - "**Create-policy backend-bypass.** The UI hides the Create button when POLICY_CREATE is absent (lines 91-98), but the backend route `POST /api/policies` (PolicyController.createPolicy at PolicyController.java:19-25) does not carry a `@PreAuthorize` on the controller method — authorization is enforced via SECURITY_RULES per the sibling PolicyController sidecar. The UI guard is therefore presentation-only; a user without POLICY_CREATE who knows the URL `/management/policies/createPolicy` can click straight to PolicyForm, fill the form, and submit — the backend rejects at the SECURITY_RULES gate (correctly), but the UX is degraded (form submission, then 403 error from the backend, rather than upfront button hide). Cross-batch link: this is the standard 'UI hides, backend enforces' pattern across the platform; F-006 batches confirm SECURITY_RULES is the operative defence." — evidence: PolicyList.tsx:91-98 + PolicyController.java:19-25 (no @PreAuthorize on method) + WithPermissions.tsx:11-32 — severity: LOW (defence-in-depth is fine)
  - "**Catalogue-vs-grant soft-delete asymmetry (UI-visible half).** Operators viewing the Policies tab see a CONSISTENT post-delete view — the deleted policy is gone from the list (the LIST query auto-applies `deleted_at IS NULL`). The OPERATING reality is that a role bound to that policy continues to confer permissions on every authorized request (per ReactivePolicyRepositoryImpl batch-H + F-006 known_security_gaps[0]). An operator using this UI to 'remove' a policy without checking the Roles tab cannot tell that the role-binding survives and the policy keeps granting. This UI is the SURFACE where the misperception manifests — UI shows 'gone'; backend keeps granting. Cross-batch link: F-006 drift_class `soft_delete_aware_visibility_inconsistency`." — evidence: PolicyList.tsx:118-120 + PolicyServiceImpl.java:53-58 (list-path soft-delete filter) + ReactivePolicyRepositoryImpl.java:32-38 (grant-path NO filter) + F-006.yaml drift facets — severity: HIGH
  - "**`isAdministrator` UI guard is case-sensitive + name-string-coupled.** PolicyItem.tsx:23 + PolicyForm.tsx:28 hardcode `name === 'Administrator'` to hide Edit/Delete on the seeded Administrator policy. If a future migration renames the seeded row to 'Administrator Policy', the UI guard fires on the wrong row (no row matches) — Edit/Delete buttons appear on the seeded Administrator, contradicting the backend's case-sensitive `.equals('Administrator')` guard at PolicyServiceImpl.java:76, 87. Per F-006 batch-N case-sensitivity-mismatch finding, an operator who creates a policy named 'administrator' (lowercase) bypasses the UI guard AND the backend's update guard (case-sensitive) BUT NOT the backend's delete guard (case-INsensitive). Net: the lowercase variant policy is editable (no UI/backend guard fires) but undeletable. UI inherits the cross-layer mismatch." — evidence: PolicyItem.tsx:23 + PolicyForm.tsx:28 + PolicyServiceImpl.java:29, 76, 87 + F-006 drift_class `role_service_predefined_name_case_sensitivity_mismatch` (symmetric Role-side risk) — severity: MEDIUM
  - "**Informational disclosure: policy NAMES are visible to all authenticated users (regardless of POLICY_CREATE).** The list rendering at PolicyList.tsx:118-120 is unconditional (no `WithPermissions` wrap). Any authenticated user who reaches `/management/policies` sees the policy NAMES — the service-layer non-ADMIN branch filters to ROLE-attached policies (PolicyServiceImpl.java:54-58), so the disclosure is bounded to 'policies attached to your roles'. Names like 'Production Data Quality Admin', 'Finance Read-Only', 'PII Custodian' may reveal organisational structure. The Management tab as a whole is operator-facing — the canonical operator path is via an authorized user — but the absence of an explicit POLICY_READ permission check at the list-rendering layer means a future change to the auth-mode wiring (e.g. broadening route access) could surface names to unintended audiences." — evidence: PolicyList.tsx:118-120 (no permission gate around the map) + PolicyServiceImpl.java:53-60 (role-scoped non-ADMIN filter) — severity: LOW
  - "**No audit-log surface on UI-side policy mutations.** Clicking the Create button routes to PolicyForm + dispatches `createPolicy` thunk → backend → no log line, no Activity Feed entry (per F-006 batches E, H, N — 4-sidecar audit-silence pattern). The UI does not surface 'who created this policy when' anywhere — neither PolicyList (showing only id+name) nor PolicyDetails (showing the form) display authorship metadata. An operator investigating 'who added this policy' has no UI affordance to consult." — evidence: PolicyList.tsx:118-120 (no created_at / created_by fields on row) + F-006.yaml drift_class `four_sidecar_audit_silence_pattern_role_repo_confirmation` — severity: MEDIUM (UX manifestation of the cross-batch audit-silence finding)

## performance

- **hot_paths**:
  - "Initial mount fetches one page of policies (`fetchPolicyList({page:1, size:100})` at line 40). Cold-cache cost: one HTTP round-trip + slice extraReducer execution. For typical platforms with <50 policies this is sub-100ms; for an enterprise deployment with 200+ policies the response payload grows linearly (Policy DTO is `~150 bytes` per row including the JSON-Schema permission codes count, so 200 policies ≈ 30KB)." — evidence: PolicyList.tsx:39-41 + policy.thunks.ts:15-26 + policy.slice.ts:29-40
  - "Search-input keypress: each keypress triggers `setQuery` (re-render of PolicyList + every PolicyItem with React's default child-reconciliation) + debounced `handleSearch`. The 500ms trailing-edge debounce coalesces rapid typing into one dispatch. Per-keypress cost: O(visible-rows) component-update + one debouncer reset. For a 100-row visible list, each keystroke triggers 100 PolicyItem re-renders (no `React.memo` on PolicyItem — verified at PolicyItem.tsx:18 — the functional component receives `{policyId, name}` props which are stable per row, but React's default reconciliation does not skip)." — evidence: PolicyList.tsx:59-62 + PolicyItem.tsx:18 (no memo wrap)
- **throughput_characteristics**:
  - "Infinite scroll: per-page load is one HTTP round-trip + one slice merge. The `react-infinite-scroll-component` library handles intersection-observer wiring; no over-fetching."
  - "Single-item create / update / delete — no bulk mutation surface (consistent with the PolicyService backend which exposes only single-item operations per PolicyServiceImpl.java:62-95)."
- **resource_allocation**:
  - "Each PolicyItem mounts as a React element holding `{ policyId, name }` + `usePermissions` hook subscription + `ConfirmationDialog` portal (PolicyItem.tsx:57-73). For a 100-row list, ~100 hook subscriptions to the PermissionContext (lib/hooks/usePermissions.ts:10) — context re-renders on permission changes propagate to all 100 rows."
  - "DOM nodes per row: ~10 (Container Grid + 3 Grid columns + Typography + Button + Button + ConfirmationDialog portal anchor). For 100 rows, ~1000 DOM nodes — well within browser rendering capacity."
- **scaling_characteristics**:
  - "Stateless component (no module-level mutable state — verified by reading PolicyList.tsx:1-128 end-to-end; no `let ` outside the component body). React 18+ Strict Mode double-renders are tolerated."
  - "The InfiniteScroll wrapper expects `dataLength` to be monotone-increasing across renders (`dataLength={policyList.length}` line 113). When the search query changes and the slice does `setAll` (replacing the list), `dataLength` drops abruptly — the library handles this gracefully but the scroll position is reset; the user sees a 'jump to top'."
  - "Concurrent fetches: the search-clear race (see bugs_limitations_corner_cases[1]) is the only meaningful concurrency case; default React+Redux semantics handle it via slice extraReducer ordering."
- **known_performance_gaps**:
  - "**No `React.memo` on PolicyItem.** Every PolicyList re-render (triggered by any state change in PolicyList — query, totalPolicies, infinite-scroll meta) re-renders every PolicyItem child. With `{ policyId, name }` props stable per row, `React.memo` would skip the re-renders. For a 100-row list with ~3 re-renders per minute (typical typing+search interaction), this is ~300 wasted PolicyItem renders/minute — negligible at this scale but a missed optimisation." — evidence: PolicyItem.tsx:18 (no memo wrap) + PolicyList.tsx:118-120 — severity: LOW
  - "**No URL-state for query → no browser-back support.** The search query lives only in `useState` (line 36). Pressing browser-back after searching does not restore the previous query; refreshing resets the search. Per the substrate's UI conventions, this is consistent with the rest of the Management UX (deep-link sharing is not a goal for operator-facing config screens), but the absence is noteworthy." — evidence: PolicyList.tsx:36 (no useQueryParams import) — severity: LOW

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - "Mount + initial fetch of `fetchPolicyList({page:1, size:100})` (PolicyList.tsx:39-41)"
    test_class: "PolicyList.test.tsx"
  - "Search-input debounce: 500ms trailing-edge dispatches `fetchPolicyList({page:1, size:100, query})` (lines 52-57)"
    test_class: "PolicyList.test.tsx"
  - "Search-input Enter-key triggers handleSearch (line 65)"
    test_class: "PolicyList.test.tsx"
  - "Search-clear race: typing then clearing within 500ms — assert no-query result eventually wins (lines 39-41 vs 52-57)"
    test_class: "PolicyList.test.tsx"
  - "Infinite-scroll next-page dispatches `fetchPolicyList({page: page+1, size:100, query})` (lines 47-50)"
    test_class: "PolicyList.test.tsx"
  - "Infinite-scroll terminates when `hasNext === false` (line 48)"
    test_class: "PolicyList.test.tsx"
  - "`totalPolicies` subtitle frozen during search (lines 43-45 + 78)"
    test_class: "PolicyList.test.tsx"
  - "`WithPermissions permissionTo={Permission.POLICY_CREATE}` shows/hides Create CTA based on `usePermissions().hasAccessTo`"
    test_class: "PolicyList.test.tsx"
  - "EmptyContentPlaceholder renders when `!isPoliciesFetching && !policyList.length` (lines 68-71, 123)"
    test_class: "PolicyList.test.tsx"
  - "PolicyListSkeleton renders while `isPoliciesFetching` (line 116)"
    test_class: "PolicyList.test.tsx"
- test_files: []
- gaps: |
    Zero existing tests for this component (Grep verified at `<odd-platform-repo>/odd-platform-ui/src/components/Management/PolicyList/**/*.test.*` returned zero matches). The Management UI tree as a whole is sparsely tested — verified by Glob over `<odd-platform-repo>/odd-platform-ui/src/components/Management/**/*.test.*` returning zero matches. Regression risk: a refactor changing the debounce, the page-size, the `hasNext` handling, or the `WithPermissions` wrap would ship unchallenged. The catalogue-vs-grant soft-delete asymmetry (security.known_security_gaps[1]) IS observable via this UI — a test scenario would be: seed a role with a policy + soft-delete the policy via direct DB UPDATE + render PolicyList + assert the policy is GONE from the list AND assert `getRolesPolicies` still returns it (cross-layer integration test). This is the highest-leverage UI-anchored regression-pin for F-006.

## coherence_check (LSN-018 Rule 6)

Performed pre-emit coherence check across `feature-flows/` + sibling sidecars. Findings:

- **Strengthens** F-006 / P-09:F-001 RBAC drift class `soft_delete_aware_visibility_inconsistency` — this sidecar provides the UI-half evidence for the catalogue-vs-grant asymmetry. The F-006 sidecar describes the SQL-layer and service-layer halves; this UI sidecar describes the user-visible CONSEQUENCE. New back-link added in `related_features: [F-006]` + `related_pillar_features: [P-09:F-001]`.
- **Strengthens** the F-006 4-sidecar (now 5-sidecar per batch-P) `audit_silence_pattern` — this UI sidecar confirms that operators have NO UI affordance to view authorship of policy creates/updates/deletes (the row renders only id+name; no created_by, no created_at). New back-link via `related_features: [F-006]`.
- **Strengthens** the F-006 batch-N + batch-H `role_service_predefined_name_case_sensitivity_mismatch` finding — this sidecar establishes that the SAME case-sensitive 'Administrator' string is the guard on the UI side (PolicyItem.tsx:23 + PolicyForm.tsx:28). The cross-layer mismatch (lowercase 'administrator' editable via UI + uneditable via backend's delete-guard case-insensitive) is the same risk shape on the UI half.
- **Refutes** the prompt's LSN-017 hypothesis ("(d) is there a useEffect dep-array pattern of the LSN-017 doubling shape (multiple fetches per page-open)?"). Verified by reading PolicyList.tsx:39-66 end-to-end + tracing the deps: `fetchPolicyList` in the `[fetchPolicyList, query]` dep is a STABLE module-level thunk reference — the effect fires once on mount + once per `query` change, NOT N times per render. The pattern is a cosmetic ESLint smell, NOT the LSN-017 view_count cross-layer doubling. Sidecar records this as a LOW-severity bug (cosmetic-only).
- **No conflicts surfaced** with existing artefacts. No supersede notes needed.

Back-link emit summary: `related_features: [F-006]`, `related_pillar_features: [P-08:F-003, P-09:F-001]`, `related_retrospectives: [LSN-001, LSN-017, LSN-018]`.

## sources

- understanding ← PolicyList.tsx:1-128 + PolicyServiceImpl.java:53-60, 97-100 + ReactivePolicyRepositoryImpl sibling sidecar (`odd-platform__java__repository_reactive__repository__ReactivePolicyRepositoryImpl.md`) + components.yaml:158-235 (the 75-value Permission enum, referenced by PermissionController sibling sidecar)
- concepts.entities ← PolicyList.tsx:5, 20-22, 33, 116, 119-120 + policy.slice.ts:15-22 + PolicyItem.tsx:5, 42-49, 54
- concepts.operations ← PolicyList.tsx:39-66, 47-50, 109-122 + WithPermissions.tsx:1-32
- concepts.invariants[0] (list filters soft-deleted) ← PolicyServiceImpl.java:53-58 + ReactiveAbstractSoftDeleteCRUDRepository sidecar inheritance + PolicyList.tsx:73-125 (no status filter UI verified by reading end-to-end)
- concepts.invariants[1] (Create CTA gated; LIST itself ungated) ← PolicyList.tsx:91-98 vs 109-122 + WithPermissions.tsx:11-32
- concepts.invariants[2] (isAdministrator brittleness) ← PolicyItem.tsx:23 + PolicyForm.tsx:28 + PolicyServiceImpl.java:29, 76, 87 + F-006 drift_class case-sensitivity-mismatch
- concepts.invariants[3] (total-count drift) ← PolicyList.tsx:43-45, 78
- concepts.invariants[4] (single InfiniteScroll target) ← PolicyList.tsx:109-117
- dependencies_semantic.requires-feature ← PolicyController.java:34-41 + PolicyServiceImpl.java:53-60 + ReactivePolicyRepositoryImpl sidecar + components.yaml:158-235 + F-006.yaml feature record
- dependencies_semantic.requires-config ← PolicyList.tsx:35, 55, 114 (hardcoded literals)
- dependencies_semantic.requires-runtime ← PolicyList.tsx:1-24 (import block)
- dependencies_semantic.couples-to ← PolicyItem.tsx:1-82 + policy.thunks.ts:15-26 + policy.slice.ts:29-40 + policies.selectors.ts:12-39 + WithPermissions.tsx:1-34
- upstream_callers ← PolicyList.tsx (default export at line 128) + PolicyItem.tsx (per-row mount + delete dispatch at line 26)
- downstream_side_effects ← PolicyList.tsx:39-50, 52-66 + policy.thunks.ts:15-73 + policy.slice.ts:28-56 + PolicyController.java:34-57 + PolicyServiceImpl.java:53-95
- implicit_adrs[0] (page size 100) ← PolicyList.tsx:35
- implicit_adrs[1] (debounce 500ms) ← PolicyList.tsx:55
- implicit_adrs[2] (UI hide pattern) ← PolicyList.tsx:91-98 + WithPermissions.tsx:11-32
- implicit_adrs[3] (Administrator name-string guard) ← PolicyItem.tsx:23 + PolicyForm.tsx:28 + PolicyServiceImpl.java:29, 76, 87
- implicit_adrs[4] (totalPolicies frozen during search) ← PolicyList.tsx:43-45, 78
- bugs_limitations_corner_cases[0] (stable-ref dep smell, NOT LSN-017) ← PolicyList.tsx:39-41, 52-57
- bugs_limitations_corner_cases[1] (search-clear race) ← PolicyList.tsx:39-66 + policy.slice.ts:29-40
- bugs_limitations_corner_cases[2] (totalPolicies initial lag) ← PolicyList.tsx:36-45 + policy.slice.ts:15-22
- bugs_limitations_corner_cases[3] (no URL state for query) ← PolicyList.tsx:36, 59-62 (verified absence of useQueryParams import)
- bugs_limitations_corner_cases[4] (non-ADMIN hasNext=false hardcoded) ← PolicyServiceImpl.java:115 + PolicyList.tsx:33, 47-50
- bugs_limitations_corner_cases[5] (catalogue-vs-grant asymmetry) ← PolicyList.tsx:1-128 + PolicyServiceImpl.java:53-58 + ReactivePolicyRepositoryImpl.java:32-38 (sibling sidecar known_security_gaps[0])
- docs_link_semantic ← inherited via sibling sidecars per docs_link_semantic.fetched_excerpts narrative
- security.auth_mode_relevance ← PolicyList.tsx:1-128 + sibling PolicyController.createPolicy sidecar
- security.ingestion_filter_relevance ← PolicyList.tsx:39-50 (fetches /api/policies, not /ingestion/*)
- security.authorization_assertions ← PolicyList.tsx:91-98 + PolicyItem.tsx:42-49, 54 + WithPermissions.tsx:11-32 + usePermissions.ts:10
- security.owner_scoping ← ReactivePolicyRepositoryImpl sibling sidecar `security.owner_scoping: N/A` + PolicyServiceImpl.java:53-60 (role-scoped non-ADMIN)
- security.data_exposure ← PolicyList.tsx:119 (id + name only) + PolicyItem.tsx:46 (unconditional route to details)
- security.known_security_gaps[0] (UI hide bypass via direct URL) ← PolicyList.tsx:91-98 + PolicyController.java:19-25
- security.known_security_gaps[1] (catalogue-vs-grant) ← PolicyList.tsx + PolicyServiceImpl.java:53-58 + ReactivePolicyRepositoryImpl.java:32-38 + F-006.yaml drift facets
- security.known_security_gaps[2] (Administrator name-string guard mismatch) ← PolicyItem.tsx:23 + F-006 case-sensitivity-mismatch finding
- security.known_security_gaps[3] (policy-name disclosure) ← PolicyList.tsx:118-120 + PolicyServiceImpl.java:53-60
- security.known_security_gaps[4] (no audit-log UI surface) ← PolicyList.tsx:118-120 + F-006 4-sidecar audit-silence pattern
- performance.hot_paths ← PolicyList.tsx:39-41, 59-62 + policy.thunks.ts:15-26 + PolicyItem.tsx:18 (no memo)
- performance.throughput_characteristics ← PolicyList.tsx:109-117 + PolicyServiceImpl.java:62-95
- performance.resource_allocation ← PolicyItem.tsx:18-77 + PolicyList.tsx:118-120
- performance.scaling_characteristics ← PolicyList.tsx:1-128 + policy.slice.ts:29-40
- performance.known_performance_gaps[0] ← PolicyItem.tsx:18 + PolicyList.tsx:118-120
- performance.known_performance_gaps[1] ← PolicyList.tsx:36 + sibling SearchController.facets sidecar for contrast

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH (zero tests verified via Glob over `<odd-platform-repo>/odd-platform-ui/src/components/Management/PolicyList/**/*.test.*` returning zero matches)
- docs_link_semantic: LOW (no fresh WebFetch; inherited verified state from sibling batch-E + batch-H sidecars)
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: HIGH

## Maintainer notes

