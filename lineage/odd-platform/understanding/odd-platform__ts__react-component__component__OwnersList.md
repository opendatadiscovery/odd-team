---
node_id: "odd-platform ts react-component component:OwnersList"
node_kind: react-component
axis: ui_components
extracted_at_commit: 9ac6436e
enriched_at_commit: 9ac6436e
extractor_version: 0.1.0
prompt_version: file-analyser/0.2.0
schema_version: v0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-20-Q-OwnersList
pillar: P-08
related_pillar_features:
  - P-08:F-003  # Owner Lifecycle Management — F-019 (NEW batch P)
  - P-09:F-001  # Role-Based Access Control — F-006 (the OWNER_CREATE/UPDATE/DELETE gate consumer)
related_features:
  - F-019  # Owner Lifecycle Management (the trinity this UI directly invokes)
  - F-006  # RBAC (WithPermissions consumer of OWNER_CREATE/UPDATE/DELETE)
  - F-011  # Principal-to-Owner Resolution (the Owner entities listed here are the target of USER_OWNER_MAPPING)
related_refactors:
  - REFACTOR-425  # destructive empty-roles UPDATE — UI form does NOT force role selection; submit-with-empty-roles is reachable
  - REFACTOR-426  # no-audit-on-Owner-mutations — UI surfaces are the operator-facing trigger of the audit-silent path
  - REFACTOR-427  # owner_association_request orphans on delete — UI delete affordance triggers the orphaning DB path
  - REFACTOR-432  # soft-deleted-Owner by-id visibility — UI list correctly HIDES soft-deleted owners (via list endpoint listCondition)
related_adrs:
  - ADR-CANDIDATE-003  # read-collaborative posture — the GET /api/owners listing has NO SecurityRule, so any authenticated user enumerates the entire owner directory
related_concepts:
  - Owner Directory (Management)
  - Owner Lifecycle Audit Silence (6-sidecar pattern — UI is the operator-facing trigger)
  - Owner-side orphan-binding closure (UI delete invokes the positive case-law path)
  - permission-gated-ui-affordance (WithPermissions wrapping the Create/Edit/Delete buttons)
related_sidecars:
  - odd-platform__java__OwnerController__controller-method__createOwner    # POST /api/owners — invoked by this UI's Create button (via OwnerForm dialog)
  - odd-platform__java__OwnerController__controller-method__updateOwner    # PUT  /api/owners/{id} — invoked by Edit (via EditableOwnerItem → OwnerForm dialog)
  - odd-platform__java__OwnerController__controller-method__deleteOwner    # DELETE /api/owners/{id} — invoked by Delete (via EditableOwnerItem ConfirmationDialog)
coherence_notes:
  - kind: strengthens
    target: F-019
    target_drift_facet: empty_roles_field_silently_destroys_bindings
    note: |
      The batch-P F-019 finding (empty `roles` payload on PUT silently destroys all role
      bindings) escalates from "API-consumer-only hazard, UI in practice always sends the
      current `roles` list" to "UI-REACHABLE-DESTRUCTIVE-DEFAULT" with this sidecar's
      evidence. The OwnerForm dialog (`OwnerForm.tsx:71-106`) validates ONLY `name`
      (`OwnerForm.tsx:77` — `rules={{ required: true, validate: value => !!value.trim() }}`).
      The `roles` field uses `useFieldArray` (`OwnerForm.tsx:40-43`) with no validation
      rules — an operator can `remove` every role and the form's `formState.isValid`
      remains `true` (the Save button is enabled). On submit, `handleOwnerFormSubmit`
      (`OwnerForm.tsx:51-58`) dispatches `updateOwner({ ownerId, ownerFormData })` with
      `roles: []` — which on the API side triggers the F-019 destructive-default path.
      The UI provides NO confirmation modal for "this will remove all role bindings",
      NO red-warning banner, NO before/after diff. The destructive default is reachable
      from the operator UI in three clicks (Edit owner → remove all role TagItems via
      the X icon on each → Save). Mirrors `OwnerForm.tsx:95-103` (the TagItem render
      loop with `removable` + `onRemoveClick={handleRemove(idx)}`).
  - kind: strengthens
    target: F-019
    target_drift_facet: forensic_silence_on_owner_lifecycle_mutations
    note: |
      The 6-sidecar audit-silence pattern (createOwner + updateOwner + deleteOwner —
      none carry @ActivityLog) is OPERATOR-FACING via this UI. The Create / Edit /
      Delete affordances on `OwnersList.tsx` are the three primary triggers; an operator
      acting through the UI cannot later audit "who renamed Owner X from Alice to Bob
      at T" because the platform records no event. The UI itself provides NO local
      audit affordance (no "recent changes" panel, no operator's-own-mutation history).
      Combined with the destructive-empty-roles UX (above), an operator can silently
      strip all roles from any Owner and leave no trace anywhere except the
      `owner_to_role` row count delta.
  - kind: strengthens
    target: F-019
    target_drift_facet: soft_deleted_owner_visible_via_get_by_id_only
    note: |
      The OwnersList component consumes `getOwnerList` (`OwnerController.java:30-38` →
      `OwnerServiceImpl.list` → `ReactiveOwnerRepositoryImpl.list` which uses
      `listCondition` adding `deleted_at IS NULL` per the batch-P deleteOwner sidecar
      invariants). So the visible-in-the-UI Owner directory CORRECTLY HIDES soft-deleted
      Owners. The asymmetric by-id surface (`GET /api/owners/{id}` returns soft-deleted
      rows per the F-019 batch-P finding) is NOT reachable from this list UI. This is
      a POSITIVE finding for OwnersList: the list view is the safe consumer of the
      visibility asymmetry. Surfaces a doc-gap candidate: the live docs should explain
      that "the Owners tab shows only active Owners; soft-deleted Owners persist as
      directory rows visible via direct API calls but hidden here".
  - kind: distinguishes-from
    target: F-006
    note: |
      The Create / Edit / Delete buttons are guarded by `WithPermissions` wrappers
      (`OwnersList.tsx:88-98` for Create — gated by `Permission.OWNER_CREATE`;
      `EditableOwnerItem.tsx:41-54` for Edit — gated by `OWNER_UPDATE`;
      `EditableOwnerItem.tsx:55-74` for Delete — gated by `OWNER_DELETE`). The
      `WithPermissions` HOC returns `null` when the current user lacks the permission
      (`WithPermissions.tsx:27-29`), so users without these permissions see the list
      but NOT the action buttons. This is the UI-side mirror of the F-006 / F-019
      authorization-rule pipeline at `SecurityConstants.java:143-147`. Cross-batch
      coherence: client-side hiding is a UX nicety, NOT a security boundary — the API
      `SecurityRule` is the authoritative gate (callers without permission who craft
      a request directly receive 403). However, the GET /api/owners LISTING endpoint
      itself has NO SecurityRule entry at SecurityConstants.java (verified — only POST
      /api/owners, PUT /api/owners/{owner_id}, DELETE /api/owners/{owner_id} are
      registered; `mapping` endpoints at 157-161 too). The list view is therefore
      readable by any authenticated user — consistent with the platform-wide
      read-collaborative posture (ADR-CANDIDATE-003). Recorded here for back-link.
---

# OwnersList — semantic understanding

## understanding

`OwnersList` is the React component backing the `Management → Owners` directory tab — a
single-page, infinite-scroll, debounced-search view over the platform's Owner
directory (`OwnersList.tsx:29-134`). It is the ONLY UI surface in the platform that
invokes the Owner-lifecycle trinity (POST / PUT / DELETE `/api/owners[/{id}]`) — Create
via the `OwnerForm` dialog wrapped in `WithPermissions(OWNER_CREATE)`
(`OwnersList.tsx:88-98`); Edit via `EditableOwnerItem`'s `OwnerForm` reuse wrapped in
`WithPermissions(OWNER_UPDATE)` (`EditableOwnerItem.tsx:41-54`); Delete via
`EditableOwnerItem`'s `ConfirmationDialog` wrapped in `WithPermissions(OWNER_DELETE)`
(`EditableOwnerItem.tsx:55-74`). State is hydrated via redux thunks
(`fetchOwnersList` at `OwnersList.tsx:14`); the list renders inside an
`react-infinite-scroll-component` with page-size 100 and a 200px scroll threshold
(`OwnersList.tsx:115-126`). Search uses `useDebouncedCallback` at 500ms latency
(`OwnersList.tsx:57-59`). The component is the operator-facing trigger of all 13 F-019
load-bearing drift facets (audit-silence, empty-roles destructive UPDATE,
USR003-vs-409, owner_association_request orphans, FTS-vector refresh asymmetry on
delete, OpenAPI 201-vs-impl-200, etc.) — each surfaces as a clickable affordance
behind a permission gate.

## concepts

- entities: [
    "`Owner` (the listed row — `OwnersList.tsx:23, 123-125`; rendered by `EditableOwnerItem` with id/name/roles props)",
    "`OwnerList` page payload — `{ items: Owner[], pageInfo: CurrentPageInfo }` returned by `ownerApi.getOwnerList` (`owners.thunks.ts:34-44`)",
    "`Permission` enum — `OWNER_CREATE`, `OWNER_UPDATE`, `OWNER_DELETE` consumed by `WithPermissions` (`OwnersList.tsx:23` + `EditableOwnerItem.tsx:41,55`); generated by openapi-generator from `Permission` enum in the OpenAPI spec",
    "`OwnerFormData` — `{ name: string, roles?: Role[] }` per `components.yaml:414-424`; the dialog's submitted payload via `react-hook-form` (`OwnerForm.tsx:34-38, 51-58`)",
    "Redux state slice — `OwnersState` with `byId / allIds / pageInfo` shape (`owners.selectors.ts:1-25`); selectors `getOwnersList`, `getOwnersListPageInfo`, plus the create/update/delete fetching-status triplet"
  ]
- operations: [
    "`fetch-owners-list-on-mount-and-on-mutation` — `useEffect` at `OwnersList.tsx:44-46` fires `fetchOwnersList({ page: 1, size })` when `isOwnerCreating`, `isOwnerDeleting`, or `query` change AND `!query` is true. The TWO mutation-status flags (`isOwnerCreating`, `isOwnerDeleting`) cause a list refetch on create completion AND delete completion — but NOT on update completion (`isOwnerUpdating` is NOT in the dep array). This is a deliberate asymmetry the maintainer should track (see bugs_limitations_corner_cases[0]).",
    "`debounced-search` — `handleSearch` is `useDebouncedCallback` at 500ms (`OwnersList.tsx:57-59`); fires `fetchOwnersList({ page: 1, size, query })` when the user types (`handleInputChange` at `OwnersList.tsx:61-64`) or presses Enter (`handleKeyDown` at `OwnersList.tsx:66-68`). The state.query setter is synchronous; the API call lags by 500ms",
    "`infinite-scroll-pagination` — `fetchNextPage` (`OwnersList.tsx:52-55`) dispatches `fetchOwnersList({ page: page + 1, size, query })` when `hasNext` is true; the `InfiniteScroll` component triggers this via `next` callback when the user scrolls within 200px of the bottom (`OwnersList.tsx:115-122`); size is 100",
    "`permission-gated-affordance-rendering` — `WithPermissions` renders the wrapped child only if `usePermissions().hasAccessTo(permission)` returns true (`WithPermissions.tsx:17-29`); Create/Edit/Delete buttons are HIDDEN (not disabled) when permission is absent",
    "`open-confirmation-dialog-and-dispatch-delete` — `EditableOwnerItem.tsx:55-74` wraps Delete in a `ConfirmationDialog` with title 'Are you sure you want to delete this owner?' and the owner's name interpolated into the warning; on confirm, `handleDelete` (`EditableOwnerItem.tsx:27-30`) dispatches `deleteOwner({ ownerId })`",
    "`open-form-dialog-with-update-or-create-branching` — `OwnerForm.tsx:51-58` branches on `ownerId` presence: with id → `updateOwner({ ownerId, ownerFormData })`, without → `createOwner({ ownerFormData })`"
  ]
- invariants:
  - "**Delete affordance IS guarded by a confirmation modal — UNLIKE the destructive-empty-roles UPDATE path.** `EditableOwnerItem.tsx:56-72` renders a `ConfirmationDialog` with the warning text `'\"<owner-name>\" will be deleted permanently'` (line 60-62). The DELETE verb on the Owner directory is the only Owner-lifecycle action that requires explicit operator confirmation; the destructive UPDATE path (empty-roles silently destroys role bindings) has NO equivalent confirmation. The asymmetry is load-bearing: the API-side DELETE is reversible (soft-delete + partial-unique-index name re-use) while the UPDATE-empty-roles role-strip is IRREVERSIBLE (role bindings are hard-deleted per F-019)."
  - "**Form validation requires non-blank `name` ONLY; `roles` has NO validation.** `OwnerForm.tsx:77` declares `rules={{ required: true, validate: value => !!value.trim() }}` for the name field. The roles field uses `useFieldArray` (line 40-43) with no validation rules; the Save button (`OwnerForm.tsx:108-117`) is disabled only by `!formState.isValid` — which checks ONLY the name rule. An operator who removes every role TagItem via the `onRemoveClick={handleRemove(idx)}` X-icon (line 95-103) can still submit; the resulting `roles: []` payload triggers the F-019 batch-P destructive-empty-roles path on the API side."
  - "**Soft-deleted Owners are correctly hidden from this list.** `fetchOwnersList` invokes `ownerApi.getOwnerList` (`owners.thunks.ts:34-44`) → `OwnerController.getOwnerList` (`OwnerController.java:30-38`) → `OwnerServiceImpl.list` → `ReactiveOwnerRepositoryImpl.list` (per F-019 deleteOwner sidecar: `enrichSelect` calls `listCondition` inherited from `ReactiveAbstractSoftDeleteCRUDRepository` which adds `deleted_at IS NULL`). This is the SAFE half of the F-019 batch-P soft-deleted-owner-visible-via-get-by-id-only finding — list view filters correctly; only the by-id read leaks soft-deleted rows."
  - "**Permission gates HIDE rather than DISABLE.** `WithPermissions.tsx:27-29` returns `null` when `hasAccessTo(permissionTo)` is false. An operator without `OWNER_CREATE` sees the Owners list but no `Create Owner` button (no visual cue that the affordance exists); same for Edit and Delete on each row. This is a UX convention not a security boundary — the API SecurityRule is the authoritative gate. A user crafting a direct API request without the permission receives 403 from the central auth pipeline (per F-006)."
  - "**The list refetches on create/delete completion but NOT on update completion.** `OwnersList.tsx:44-46` dep-array is `[isOwnerCreating, isOwnerDeleting, query]`. When `isOwnerCreating` transitions from `true` to `false` (create succeeded), the effect refires and refetches. Same for delete. `isOwnerUpdating` is NOT in the dep-array — update completion does not trigger a list refetch. The update path relies on the redux store update from the `updateOwner` thunk's response (`owners.thunks.ts:57-72` returns `{ ownerId, owner }`) to hydrate the byId map; the `getOwnersList` selector (`owners.selectors.ts:18-20`) re-runs and re-emits because `byId[ownerId]` changed. This is an OPTIMISTIC-state pattern (rely on the response to update) — works when the response is the full DTO; fragile if a partial update returns or the reducer ignores the update for any reason."
- audiences:
  - "Platform admins / operators with `OWNER_CREATE`, `OWNER_UPDATE`, or `OWNER_DELETE` permission — per the live `/features/management` doc (WebFetched 2026-05-20 status 200): 'Create owners that map to teams or individuals; attach them to data entities (the attach surface is on each entity's page)'. The doc is silent on the form mechanics, empty-roles behaviour, RBAC permission requirements, and confirmation-modal coverage (verified by WebFetch — see docs_link_semantic.doc_drift_findings)"
  - "Any authenticated platform user (read-only audience) — the LIST endpoint (`GET /api/owners`) has NO SecurityRule entry at `SecurityConstants.java` (lines 143-147 only register POST/PUT/DELETE). Any authenticated user can therefore see the full Owner directory + the count + every owner's roles. Consistent with the platform-wide read-collaborative posture (ADR-CANDIDATE-003); surface for back-link"
  - "Redux store / generated OpenAPI client — the component is a pure consumer of `redux/thunks` + `redux/selectors`; the OpenAPI-generated `OwnerApi` client (`ownerApi.getOwnerList` per `owners.thunks.ts:40`) is the wire client"

## dependencies_semantic

- requires-feature:
  - "Owner directory (F-019 Owner Lifecycle Management) — every action affords a downstream OwnerController invocation (`OwnerController.java:21-54`); the trinity's three CRUD verbs + the list endpoint"
  - "RBAC (F-006 — `Permission.OWNER_CREATE / OWNER_UPDATE / OWNER_DELETE`) — the `WithPermissions` HOC consumes the `usePermissions` hook which reads from `PermissionContext` (`WithPermissions.tsx:17`, `usePermissions.ts:1-16`); the context is populated by the `WithPermissionsProvider` higher up in the tree from the `/api/permissions/me` response"
  - "Authentication — the entire page is reachable only inside the authenticated SPA shell; an unauthenticated user receives the SPA's auth redirect (per ODD's `auth.type` configuration). Under `auth.type=DISABLED` the SPA mounts without an auth challenge — see F-019 deleteOwner sidecar's DISABLED-mode anonymous-reach finding (this UI is the operator-facing trigger of the 17th REFACTOR-185 surface)"
- requires-config: [] — N/A. The component reads no runtime config keys directly; the `size=100` constant at `OwnersList.tsx:40` is hard-coded (no `process.env` or runtime config). The 200px scroll threshold at line 120 is hard-coded. The 500ms debounce at line 59 is hard-coded
- requires-runtime:
  - "React 18 — `useState`, `useEffect` (`OwnersList.tsx:1`); `useCallback` consumed via `useDebouncedCallback` (line 57)"
  - "Redux Toolkit + RTK middleware — `useAppDispatch`, `useAppSelector` (`OwnersList.tsx:22`); `createSelector` (`owners.selectors.ts:1`); `handleResponseAsyncThunk` wrapping the OpenAPI-generated client (`owners.thunks.ts:19`)"
  - "react-infinite-scroll-component — `OwnersList.tsx:3, 115-126`; loader + scrollThreshold + next-callback contract"
  - "use-debounce — `OwnersList.tsx:4, 57`; the 500ms debounced search-fire"
  - "react-i18next — `useTranslation` (`OwnersList.tsx:5, 30`); strings 'Owners', 'owners overall', 'Search owner', 'Create Owner', 'Name', 'Roles', 'Edit', 'Delete'"
  - "@mui/material — `Grid`, `Typography` (`OwnersList.tsx:2`)"
  - "OpenAPI-generated `Permission` enum + `Owner`, `OwnerFormData`, `OwnerList` types (`generated-sources`)"
  - "WithPermissions context — `components/shared/contexts` (`OwnersList.tsx:24`)"
- coupling:
  - "`EditableOwnerItem` (`OwnersList.tsx:25, 123-125`) — the row renderer; consumes (ownerId, name, roles) props and itself imports `OwnerForm` for the Edit affordance"
  - "`OwnersSkeletonItem` (`OwnersList.tsx:26`) — the InfiniteScroll loader rendered between pages; length=5"
  - "`OwnerForm` (`OwnersList.tsx:27` + reused at `EditableOwnerItem.tsx:11`) — the create/edit dialog; branches on `ownerId` presence to dispatch `createOwner` vs `updateOwner`"
  - "`fetchOwnersList`, `createOwner`, `updateOwner`, `deleteOwner` (`owners.thunks.ts:34-86`) — the four thunks invoked from the UI"
  - "`getOwnersList`, `getOwnersListPageInfo`, `getOwnerCreatingStatuses`, `getOwnerDeletingStatuses`, `getOwnerListFetchingStatuses` (`owners.selectors.ts:10-25`) — the five selectors consumed; the missing-from-deps `getOwnerUpdatingStatuses` exists in selectors but is unused by OwnersList (consumed by OwnerForm at `OwnerForm.tsx:25-27`)"
  - "`WithPermissions` (`OwnersList.tsx:24` + `EditableOwnerItem.tsx:9`) — the permission-gating HOC"
  - "`OwnerController` REST surface (`OwnerController.java:17-55`) — the backend endpoint set the thunks call"

## tests_coverage_semantic

- covered_behaviours: [] — no test asserts any aspect of this component. `find <odd-platform-ui>/src -name '*OwnersList*' -o -name '*.test.tsx' | xargs grep -l 'OwnersList'` returned zero matches (run 2026-05-20)
- uncovered_behaviours:
  - "Rendering the empty Owners directory — `EmptyContentPlaceholder` should appear only after `!isOwnerListFetching && !ownersList.length` (`OwnersList.tsx:129`); no test asserts the conditional"
  - "Permission-gated affordance hiding — no test asserts that with `OWNER_CREATE`=false the Create button is NOT rendered; same for Edit/Delete per-row"
  - "Debounced search — no test asserts that typing 'foo' fires exactly ONE `fetchOwnersList({page:1, size:100, query:'foo'})` 500ms after the last keystroke (per `useDebouncedCallback` semantics)"
  - "Infinite-scroll fetchNextPage — no test asserts that scrolling within 200px of the bottom dispatches `fetchOwnersList({page: currentPage+1, size:100, query})`; no test asserts `!hasNext` short-circuits the dispatch (`OwnersList.tsx:53`)"
  - "List refetch on create/delete completion — no test asserts that `isOwnerCreating: true → false` triggers a refetch (the `useEffect` dep-array behaviour at `OwnersList.tsx:44-46`); no test asserts the asymmetry (no refetch on `isOwnerUpdating` change)"
  - "Empty-roles destructive UPDATE UX hazard — no test asserts that an operator can submit `OwnerForm` with `roles: []` via remove-all-TagItems flow; no test pins the absence of a confirmation modal for role-stripping"
  - "Delete confirmation modal — no test asserts the `ConfirmationDialog` is shown before dispatching `deleteOwner`; no test pins the warning text 'will be deleted permanently'"
  - "Search-while-paginating race — typing a search query while the user is mid-scroll triggers BOTH a debounced fetch (page 1, query) AND potentially an in-flight fetchNextPage (page N, prior query). No test asserts which response wins or that the store correctly reconciles. Out-of-order responses would mix unrelated owners into the list"
  - "useEffect dep-array stability — no test asserts that the dep array `[isOwnerCreating, isOwnerDeleting, query]` does not double-fire on identity changes of those flags (consistent with LSN-017 useEffect-dep-array shape; the OwnersList variant uses primitive booleans not derived objects, so the LSN-017 doubling pattern does NOT apply here — see bugs_limitations_corner_cases[2])"
- test_files: [] — N/A. The OwnersList component has no test of any kind. Confirmed by `find <odd-platform-ui>/src -name 'OwnersList.test.*'` 2026-05-20 (zero matches)
- gaps: |
    OwnersList is the sole operator-facing trigger of the F-019 Owner Lifecycle
    Management feature's 13 load-bearing drift facets. The destructive-empty-roles
    UPDATE hazard is REACHABLE FROM THE UI in three clicks (Edit → remove-all-TagItems →
    Save) with no confirmation. The delete affordance has a confirmation modal. The
    asymmetry between these two UX choices is itself a finding — the more reversible
    operation (delete is soft + name re-usable; per F-019) carries a confirmation
    barrier, while the irreversible operation (role-strip — role bindings are
    hard-deleted, no audit log) does NOT. A regression-pin test that verifies
    `OwnerForm.formState.isValid` becomes true after the operator removes every role
    AND the Save button is enabled would freeze the current contract (intentional or
    accidental). The audit-silence finding (F-019 batch-P) is operator-triggered
    here: an operator clicking Delete or Save provides the only event a future audit
    pipeline could capture, but none is emitted. Cross-cuts F-019, F-006, F-011 —
    UI tests for each Permission-gated affordance pin the security contract.

## docs_link_semantic

- declared_docs: [] — N/A. The TSX file has no `// @docs:` comment; consistent with the odd-platform-ui convention (no docs annotations declared on UI components)
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/management"
    anchor: ""
    rationale: "Canonical live page for the Management section; the Owners tab is named explicitly. This is the page an operator would Google when learning the Owners tab"
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    confidence: MEDIUM
    fetched_excerpts: |
      WebFetched 2026-05-20 status 200; page contains the Owners-tab description verbatim:
      'Owner entities — the catalog-side identity that gets associated with users and
      attached to data entities for stewardship.' Workflow note: 'Create owners that
      map to teams or individuals; attach them to data entities (the attach surface
      is on each entity's page).' The page does NOT cover: form mechanics (the
      OwnerForm dialog shape), the empty-roles destructive UX hazard, the
      ConfirmationDialog on delete, the RBAC permission gates (OWNER_CREATE /
      OWNER_UPDATE / OWNER_DELETE) at the UI layer, the infinite-scroll + debounced-
      search ergonomics, soft-deleted-Owner visibility behaviour, or the absence of
      a 'recent changes' panel. The page redirects readers to
      '/configuration-and-deployment/enable-security/authorization/owners' for the
      authorization model; per F-019 deleteOwner sidecar, that page is silent on
      cascade-delete behaviour AND on the partial-unique-index name-reuse workflow.
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions"
    anchor: ""
    rationale: "The page that defines OWNER_CREATE / OWNER_UPDATE / OWNER_DELETE permission semantics — the three gates this component consumes via WithPermissions"
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      Per F-019 createOwner + updateOwner + deleteOwner sidecars (WebFetched 2026-05-20
      status 200), the permissions page names OWNER_CREATE ('Allows creating a new
      owner'), OWNER_UPDATE ('Allows editing an existing owner'), OWNER_DELETE
      ('Allows deleting an owner') verbatim. The page is silent on what 'editing'
      covers (name? roles? both?) and silent on the destructive-empty-roles UX
      hazard the UI form enables. Surface for doc-gap-finder: the UI provides three
      gated affordances; the doc defines the gates but not the affordances.
- doc_drift_findings:
  - "Live `/features/management` page (WebFetched 2026-05-20 status 200) is silent on the Owners tab UX — does not describe: the OwnerForm dialog shape (name required, roles optional with no validation), the destructive-empty-roles UPDATE hazard reachable in three clicks, the ConfirmationDialog on delete, the infinite-scroll pagination (size=100), the 500ms debounced search, or the permission-gated affordance hiding (Create/Edit/Delete buttons disappear when permission is absent). An operator reading the page cannot predict: (a) that submitting Edit with all roles removed will silently strip role bindings; (b) that Delete will prompt for confirmation but Edit will not; (c) that scrolling fetches more owners automatically; (d) that the list count update lags 500ms behind typed search."
  - "Live `/configuration-and-deployment/enable-security/authorization/owners` page (per F-019 trinity sidecars — WebFetched 2026-05-20 status 200) is silent on the UI consumer of OWNER_CREATE/UPDATE/DELETE permissions. An operator wondering 'how does a user without OWNER_DELETE experience the Owners tab' has no answer in the live docs."
  - "Live `/features/management` page does not cross-link to the F-019 batch-P findings: (a) the empty-roles destructive UPDATE is reachable from the UI; (b) the audit-silence on all three Owner lifecycle verbs; (c) the soft-deleted-Owner partial-unique-index name re-use workflow. These three operationally-meaningful behaviours are the operator's contract; the doc page is the canonical operator-facing surface for the Owners tab and should describe them."

## implicit_adrs

- "**Client-side permission-gated affordance HIDING (not disabling) — the UX convention is to omit forbidden affordances from the DOM rather than render them with disabled styling.** `WithPermissions.tsx:27-29` returns `null` when `hasAccessTo(permissionTo)` is false; the Create/Edit/Delete buttons are absent from the DOM, not rendered grayed-out. This is applied consistently across the codebase (the `WithPermissions` HOC is used in 30+ places per a grep across `<odd-platform-ui>/src/components`). The convention trades discoverability (users without a permission don't see what they're missing) for cleanliness (no permission-aware-styling forks). An operator wondering why their colleague has a Delete button they lack has no UI cue — they must consult the permissions page. The /permissions-doc and the UI are coupled by an unstated contract (the permission names in the OpenAPI enum drive the UI's `Permission.*` references)." — evidence: `WithPermissions.tsx:27-29` (returns null, not <button disabled>) + `OwnersList.tsx:88-98` + `EditableOwnerItem.tsx:41-74` — intent_anchor: "return hasAccessTo(permissionTo) ? <>{children}</> : null;" (`WithPermissions.tsx:28`) — confidence: HIGH
- "**The Edit / Create form is a SHARED dialog component — OwnerForm branches on `ownerId` presence rather than rendering two separate dialogs.** `OwnerForm.tsx:51-58` uses one `handleSubmit` that dispatches `updateOwner` if `ownerId` is truthy else `createOwner`. The convention reduces code duplication but also forces both flows through the same validation (`name` required only, `roles` optional with no rules) — so the destructive-empty-roles UX hazard is symmetric: it exists on Create (with no existing role bindings, the destructive effect is null), and on Edit (with existing role bindings, the destructive effect is full role-strip). The decision was made deliberately — the Edit dialog reuses the Create form fields one-for-one." — evidence: `OwnerForm.tsx:19-58` (the single component with branching submit) + `OwnersList.tsx:89-96` (no ownerId, Create branch) + `EditableOwnerItem.tsx:42-53` (with ownerId, Update branch) — intent_anchor: "`(ownerId ? dispatch(updateOwner(...)) : dispatch(createOwner(...))).then(() => { clearState(); });`" (`OwnerForm.tsx:52-57`) — confidence: HIGH
- "**Confirmation modal on delete, no confirmation on update (even when update is destructive).** `EditableOwnerItem.tsx:55-74` wraps Delete in a `ConfirmationDialog`; `EditableOwnerItem.tsx:41-54` wraps Edit in an `OwnerForm` (no confirmation step). The choice reflects the conventional UX assumption that DELETE is the destructive verb; the platform's actual semantics (per F-019 batch-P) invert this — delete is soft + name-reusable + role-bindings-hard-deleted (the role bindings ARE lost but the owner row persists), while update-with-empty-roles silently strips the role bindings irreversibly. The implicit-ADR is 'delete needs confirmation; edit does not' — a UX convention applied without reasoning about which operation is actually more destructive." — evidence: `EditableOwnerItem.tsx:55-72` (ConfirmationDialog wrapper on delete) + `EditableOwnerItem.tsx:41-54` (no ConfirmationDialog wrapper on edit) — intent_anchor: "<ConfirmationDialog actionTitle={t('Are you sure you want to delete this owner?')} actionName={t('Delete Owner')} actionText={<>&quot;{name}&quot; {t('will be deleted permanently')}</>} onConfirm={handleDelete} ... />" (`EditableOwnerItem.tsx:56-72`) — confidence: HIGH

## bugs_limitations_corner_cases

- "**`useEffect` dep-array AT `OwnersList.tsx:44-46` does NOT include `dispatch` — React-strict-mode + future React versions may flag this as a missing-dependency warning.** The dep array `[isOwnerCreating, isOwnerDeleting, query]` references `dispatch` in the body but does not list it. ESLint `react-hooks/exhaustive-deps` rule would warn here. Same at `OwnersList.tsx:48-50` (the `total` effect's dep array `[total, query]` references `setTotalOwners` from the same component scope, which is stable — not a real concern). The LSN-017 useEffect dep-array pattern (`details.status?.status` derived from the fetch response, causing call-doubling) does NOT apply: the deps here are primitive booleans (`isOwnerCreating`, `isOwnerDeleting`) and a primitive string (`query`); these are not produced by the fetch response, so the LSN-017 multiplier shape is absent. Specifically: `fetchOwnersList` returns `{ items, pageInfo }` — neither pageInfo nor items modifies `isOwnerCreating` / `isOwnerDeleting` / `query`, so no re-fire chain." — evidence: `OwnersList.tsx:44-46` (the dep array) + LSN-017 (the doubling pattern this code does NOT exhibit) — severity: LOW
- "**`updateOwner` completion does NOT trigger a list refetch — the asymmetry with create + delete is fragile.** `OwnersList.tsx:44-46` lists `isOwnerCreating` and `isOwnerDeleting` in the dep array but NOT `isOwnerUpdating`. Reasoning (the maintainer's implicit choice): the `updateOwner` thunk returns the updated `Owner` DTO (`owners.thunks.ts:57-65`) and the reducer hydrates `byId[ownerId]`; the `getOwnersList` selector (`owners.selectors.ts:18-20`) re-runs because `byId[ownerId]` changed. This works IF the response carries the full DTO matching the list's projection. Edge case: if the response omits any field rendered by `EditableOwnerItem` (id/name/roles), the row will show stale data until a manual reload. The update path also bypasses any server-side filtering: if the rename changed the owner's match against the current `query`, the list keeps showing the (now-non-matching) row. No test pins this contract." — evidence: `OwnersList.tsx:44-46` (`isOwnerUpdating` not in deps) + `owners.thunks.ts:57-72` (the response shape) + `owners.selectors.ts:18-20` (the byId-driven selector) — severity: MEDIUM
- "**Page-1 refetch on create/delete completion discards the user's current scroll position AND any query they're typing.** `OwnersList.tsx:44-46` always dispatches `fetchOwnersList({ page: 1, size })` on create/delete completion — note the gating `if (!query)` (line 45). If the user IS searching, the create/delete-completion refetch is SKIPPED; the new owner does NOT appear in the search results until the user clears the search. The current list of search results becomes stale: a freshly-created Alice does not appear in the 'al' search results until the user re-types or clears + re-searches. Same hazard on delete — a just-deleted Alice continues to appear in the search results until the next manual fetch. The `if (!query)` gate is a deliberate ergonomic choice (avoid clobbering an active search) but the cost is a stale search result." — evidence: `OwnersList.tsx:44-46` (`if (!query) dispatch(fetchOwnersList({ page: 1, size }))`) — severity: MEDIUM
- "**The `total` count badge (`OwnersList.tsx:74-76`) lags the visible list during search.** `totalOwners` state is updated from `total` only when `!query` is true (`OwnersList.tsx:48-50`). During search, the badge continues to show the unfiltered owner count. So a search returning 3 of 1000 owners renders 'Showing 3 results' visually but the page header reads '1000 owners overall'. This is consistent with the prompt 'owners overall' (it's the global count, not the result count), but the UX could mislead an operator into thinking the search filtered nothing. Stated invariant ('owners overall' = global) is fine; the surfaces just deserve cross-link in the doc."
   — evidence: `OwnersList.tsx:48-50, 74-76` — severity: LOW
- "**Search-while-paginating race window — typed query interleaves with in-flight `fetchNextPage` from the previous query.** The user types 'foo' (debounced 500ms); concurrent scroll fires `fetchNextPage({ page: N+1, size, query: '' })`. The 500ms-later debounced fire is `fetchOwnersList({ page: 1, size, query: 'foo' })`. If the network response order is reversed (the page-N+1 unfiltered response arrives AFTER the page-1 'foo' response), the reducer would append unrelated owners after the 'foo' results. The component does not include a request-id / cancellation guard; the reducer's behaviour under out-of-order responses is unverified from the OwnersList scope. The `handleResponseAsyncThunk` infrastructure (`owners.thunks.ts:19`) handles per-request status flags but not response sequencing." — evidence: `OwnersList.tsx:52-55, 57-59` (fetchNextPage + handleSearch dispatch sites) — severity: MEDIUM
- "**Empty-roles destructive UPDATE is fully reachable from the UI — three clicks, no warning.** Flow: (1) Edit on an Owner row → opens `OwnerForm` with existing roles as TagItems (`OwnerForm.tsx:95-103`); (2) click X on each TagItem (`onRemoveClick={handleRemove(idx)}` at line 101); (3) click Save (enabled because `formState.isValid` only checks name — `OwnerForm.tsx:108-117`). The submitted `OwnerFormData` carries `roles: []`. Per F-019 batch-P `OwnerServiceImpl.update`, this triggers `deleteOwnerRelationsExcept(ownerId, []).then(createRelations(ownerId, []))` — DELETES all role-bindings (no audit, no recovery). NO confirmation modal, NO before/after diff, NO warning banner. The Delete affordance HAS a confirmation modal; the more-irreversible Update-with-empty-roles does NOT. Mirrors the F-019 drift facet `empty_roles_field_silently_destroys_bindings` and ELEVATES it from API-consumer-only to UI-operator-reachable." — evidence: `OwnerForm.tsx:40-43, 95-103, 108-117` + F-019 batch-P updateOwner sidecar bugs_limitations_corner_cases[3] — severity: HIGH
- "**No optimistic-update UX — the spinner / status flag races the visual update.** The `OwnerForm` dialog uses `handleCloseSubmittedForm={ownerId ? isOwnerUpdated : isOwnerCreated}` (`OwnerForm.tsx:137`) and `isLoading={ownerId ? isOwnerUpdating : isOwnerCreating}` (line 138). The Owner list does NOT show an inline 'updating...' spinner per row; the row's stale state remains until the response lands and the reducer hydrates. Acceptable for admin-time admin operations; a longer rename (high search-vector cardinality, many role-rebinds) shows up as a delay between the dialog closing and the row updating with no in-flight indicator." — evidence: `OwnerForm.tsx:137-138` + the absence of per-row status in `EditableOwnerItem` (`EditableOwnerItem.tsx:32-77`) — severity: LOW
- "**`EditableOwnerItem`'s `handleDelete` dep array is `[ownerId, deleteOwner]`, not `[ownerId, dispatch]`.** `EditableOwnerItem.tsx:27-30` declares `React.useCallback(() => dispatch(deleteOwner({ ownerId })), [ownerId, deleteOwner])`. The function `deleteOwner` is imported from `redux/thunks` (a module-level constant, stable across renders); `dispatch` is the React-Redux dispatch (also stable). The dep array MISSES `dispatch` and INCLUDES `deleteOwner` (the module-level constant); the inclusion of `deleteOwner` is a no-op (it never changes) but the omission of `dispatch` is technically incorrect per `react-hooks/exhaustive-deps`. No runtime hazard because `dispatch` is stable across renders. Cosmetic — surface for triage if the maintainer cares about ESLint compliance." — evidence: `EditableOwnerItem.tsx:27-30` — severity: LOW

## security

- **auth_mode_relevance**: `LOGIN_FORM | OAUTH2 | LDAP | DISABLED` — the UI mounts only inside the authenticated SPA shell (the auth modes that protect UI access). Under `auth.type=DISABLED`, the page is anonymously reachable (per the F-019 batch-P DISABLED-anonymous-reach finding) AND the destructive verbs PUT / DELETE / POST that this UI invokes are anonymously executable from the backend (the SecurityRule remains in the rules list but the filter chain doesn't run per `DisabledAuthSecurityConfiguration.java:11-19` batch-C sidecar). This UI is the operator-facing trigger for that 17th REFACTOR-185 surface. `S2S` is not relevant (S2S protects `/ingestion/entities` POST only)
- **ingestion_filter_relevance**: `N/A — UI surface, not /ingestion/entities`. The component invokes `/api/owners` (POST, PUT, DELETE, GET) — none match the `IngestionDataEntitiesFilter` matcher
- **authorization_assertions**:
  - "`WithPermissions(Permission.OWNER_CREATE)` wraps the Create-Owner button (`OwnersList.tsx:88-98`). UI hides the button when the current user lacks `OWNER_CREATE`; the API enforces the gate at `SecurityConstants.java:143`" — evidence: `OwnersList.tsx:88-98`
  - "`WithPermissions(Permission.OWNER_UPDATE)` wraps the Edit-Owner button on each row (`EditableOwnerItem.tsx:41-54`); API enforces at `SecurityConstants.java:144-145`" — evidence: `EditableOwnerItem.tsx:41-54`
  - "`WithPermissions(Permission.OWNER_DELETE)` wraps the Delete-Owner button + ConfirmationDialog on each row (`EditableOwnerItem.tsx:55-74`); API enforces at `SecurityConstants.java:146-147`" — evidence: `EditableOwnerItem.tsx:55-74`
- **owner_scoping**: `BYPASSES — the list returns ALL owners across the platform, not the current user's owners.** The component invokes `fetchOwnersList({ page, size, query })` (`OwnersList.tsx:45, 54, 58`) with NO `ids` filter, NO `allowedForSync` filter, NO current-user binding. Per `OwnerServiceImpl.list` (`OwnerServiceImpl.java:45-52`), the query is the unfiltered partial-deleted-aware list. Any authenticated user can see the entire Owner directory. Consistent with the read-collaborative posture (ADR-CANDIDATE-003). Same posture as F-019 — write paths have a global `OWNER_*` permission but no per-Owner scoping; the read path has NO SecurityRule at all (verified via grep — only the three write verbs are registered at `SecurityConstants.java:143-147`)"
- **data_exposure**:
  - "Owner directory rows (id, name, roles) → any authenticated user (no SecurityRule on GET /api/owners; ADR-CANDIDATE-003 read-collaborative posture)" — evidence: `OwnersList.tsx:33, 123-125` (the list render with id/name/roles) + verified `SecurityConstants.java` grep (no entry for GET /api/owners)
  - "Total Owner count badge ('N owners overall') → any authenticated user" — evidence: `OwnersList.tsx:74-76`
  - "Permission-gated mutation affordances rendered or hidden client-side based on the current user's `usePermissions()` snapshot — but the underlying API endpoints are authoritative" — evidence: `OwnersList.tsx:88-98` + `EditableOwnerItem.tsx:41-74` + `usePermissions.ts:1-16`
- **known_security_gaps**:
  - "**Empty-roles destructive UPDATE reachable from UI in three clicks — NO confirmation modal.** Per the bugs_limitations_corner_cases[5] above + the F-019 batch-P drift facet `empty_roles_field_silently_destroys_bindings`. An operator (or anyone shoulder-surfing an operator's session) can strip all roles from any Owner with zero confirmation. Combined with the no-audit-log gap (F-019 trinity), the role-strip leaves NO trace anywhere except the `owner_to_role` row count delta. The UI surface is the operator-facing trigger of this drift facet." — evidence: `OwnerForm.tsx:40-43, 95-103, 108-117` + F-019 updateOwner sidecar security.known_security_gaps[2] — severity: HIGH
  - "**GET /api/owners has NO SecurityRule entry — the entire Owner directory is readable by any authenticated user.** `SecurityConstants.java:143-147` registers only POST, PUT, DELETE on `/api/owners*`; the listing endpoint matches no rule. Per the platform's central authorization design, an endpoint with no matching rule is allowed for any authenticated caller (read-collaborative posture per ADR-CANDIDATE-003). The UI consumes this freely. For deployments where owner-identity is sensitive (e.g. a deployment with operator names as Owner names), the directory readability is a finding. Cross-link: REFACTOR-024 family (the broader read-collaborative posture)." — evidence: `SecurityConstants.java:143-147` (grep) + `OwnersList.tsx:44-46, 52-54, 57-59` (list fetch sites) — severity: LOW (intentional posture; doc-gap candidate)
  - "**Under `auth.type=DISABLED`, the UI page mounts anonymously AND the Owner CRUD it invokes is anonymously executable.** The 17th REFACTOR-185 surface (per F-019 batch-P updateOwner + deleteOwner sidecars). The OwnersList component is the operator-facing affordance trigger; under DISABLED mode, anonymous network-reachable callers can rename or delete any Owner via this UI." — evidence: `DisabledAuthSecurityConfiguration.java:11-19` batch-C sidecar + REFACTOR-185.md + the three write-verb invocation sites on this component — severity: LOW (corollary of REFACTOR-185; DISABLED is dev-only per docs)
  - "**No client-side input sanitisation on the search query — `query` flows into `fetchOwnersList` as-is.** `OwnersList.tsx:61-64` sets `setQuery(event.target.value)` directly; the value flows into `ownerApi.getOwnerList(params)` (`owners.thunks.ts:40`). The server-side query handling is per `OwnerServiceImpl.list` (handled there). No client-side concern; surface noted for completeness in case future server-side mitigation evaluation needs the consumer site." — evidence: `OwnersList.tsx:41, 61-64` — severity: LOW (defensive note; no current concern)

## performance

- **hot_paths**:
  - "List fetch on mount + on every create/delete completion + on every typed search (after 500ms debounce) + on every infinite-scroll near-bottom — the component's `useEffect`s and handlers (`OwnersList.tsx:44-68`) issue `GET /api/owners` calls under several conditions. For an admin clicking around the Owners tab, this is bounded. For a UI under typing-quickly load, the 500ms debounce caps the rate" — evidence: `OwnersList.tsx:44-68`
- **throughput_characteristics**:
  - "Page size = 100 (`OwnersList.tsx:40`) — each fetch returns up to 100 Owner DTOs (`{ id, name, roles, associated_user }`). For 1000-owner directories, ~10 page-fetches to scroll the full list" — evidence: `OwnersList.tsx:40`
  - "Single-call-per-event ergonomic (no batching) — Create, Edit, Delete each issue exactly one API call. No multi-select on the list, no bulk delete, no bulk role re-attach" — evidence: `EditableOwnerItem.tsx:27-30` (single deleteOwner) + `OwnerForm.tsx:51-58` (single createOwner / updateOwner)
- **resource_allocation**:
  - "Component state is bounded by page-size × page-count (`owners.allIds.map` over `owners.byId` per `owners.selectors.ts:18-20`) — for 10k-owner directories with full scroll, ~10k Owner DTOs in redux memory (id + name + roles[] per row). Bounded by the page-size constant" — evidence: `OwnersList.tsx:40` + `owners.selectors.ts:18-20`
  - "OwnerForm dialog state managed by react-hook-form (`OwnerForm.tsx:34-43`) — per-dialog cost is small; one dialog instance at a time per `DialogWrapper`" — evidence: `OwnerForm.tsx:34-43`
- **scaling_characteristics**:
  - "Client-side scaling is bounded by redux store retention and DOM-element count — the InfiniteScroll keeps all loaded rows in the DOM (no row-virtualization is wired here; `EditableOwnerItem` mounts per row). For 10k+ owner directories with full scroll, the DOM grows linearly. Acceptable for admin-time use; not a hot path" — evidence: `OwnersList.tsx:115-126` (InfiniteScroll wraps a straight `.map`, no virtualization)
  - "API backend scaling — each fetch hits the F-019 listing path; the cost is per-page (`ReactiveOwnerRepositoryImpl.list`); search queries with no index on owner.name match-pattern are O(N) over the live-owner count" — evidence: `OwnersList.tsx:45, 54, 58` (page-1 / next-page / search dispatches)
- **known_performance_gaps**:
  - "**No row-virtualization in the InfiniteScroll** — `EditableOwnerItem` mounts for every loaded row (`OwnersList.tsx:123-125`). For deployments with thousands of Owners + full scroll, the DOM accumulates. For admin-time use, acceptable. For a hypothetical operator browsing a 50k-Owner directory, the scroll lag would compound" — evidence: `OwnersList.tsx:115-126` (no `react-window`, no `react-virtuoso`) — severity: LOW
  - "**Search-fetch race with infinite-scroll-fetch — no in-flight cancellation.** Typing during scroll can issue overlapping requests; out-of-order responses could interleave unrelated owners into the list (see bugs_limitations_corner_cases[4]). The `handleResponseAsyncThunk` infrastructure does not include AbortController integration in the OwnersList consumer site. For admin-time use, the race window is narrow; surface noted" — evidence: `OwnersList.tsx:52-68` + `owners.thunks.ts:34-44` — severity: LOW
  - "**The `total` count badge requires a separate state-sync chain** (`OwnersList.tsx:42, 48-50, 74-76`) — when `total` changes but `!query`, the local `totalOwners` updates. Two state sources (`total` from redux + `totalOwners` local) describing one value; potential for divergence if any path skips the sync. Cosmetic — the displayed value would lag, not break" — evidence: `OwnersList.tsx:42, 48-50, 74-76` — severity: LOW

## sources

- understanding ← `OwnersList.tsx:29-134` (the full component body) + `EditableOwnerItem.tsx:19-80` (the row + actions) + `OwnerForm.tsx:19-145` (the create/edit dialog) + `owners.thunks.ts:34-86` (the four thunks) + `owners.selectors.ts:10-25` (the consumed selectors) + `OwnerController.java:17-55` (the backend endpoints invoked) + WebFetch live management doc 2026-05-20 status 200
- concepts.entities ← `OwnersList.tsx:23, 123-125` (Permission, Owner) + `owners.thunks.ts:1-16` (the OpenAPI-generated request types) + `OwnerForm.tsx:5` (OwnerFormData) + `owners.selectors.ts:1-9` (OwnersState shape)
- concepts.operations.fetch-owners-list ← `OwnersList.tsx:44-46`
- concepts.operations.debounced-search ← `OwnersList.tsx:57-68`
- concepts.operations.infinite-scroll ← `OwnersList.tsx:52-55, 115-126`
- concepts.operations.permission-gated-affordance ← `WithPermissions.tsx:17-29` + `OwnersList.tsx:88-98` + `EditableOwnerItem.tsx:41-74`
- concepts.operations.confirmation-modal-on-delete ← `EditableOwnerItem.tsx:27-30, 55-72`
- concepts.operations.form-branching ← `OwnerForm.tsx:51-58, 137-138`
- concepts.invariants[0] (delete has confirmation, update with empty-roles does not) ← `EditableOwnerItem.tsx:55-72` (ConfirmationDialog) + `OwnerForm.tsx:40-43, 95-117` (no confirmation in form)
- concepts.invariants[1] (form validates name only) ← `OwnerForm.tsx:77, 108-117`
- concepts.invariants[2] (soft-deleted Owners hidden) ← F-019 deleteOwner sidecar `bugs_limitations_corner_cases[6]` (the asymmetric visibility) + `OwnerController.java:30-38` (the GET path) + F-019 sidecar evidence on `ReactiveOwnerRepositoryImpl.list`
- concepts.invariants[3] (permission gates hide) ← `WithPermissions.tsx:27-29`
- concepts.invariants[4] (update completion does not refetch) ← `OwnersList.tsx:44-46` (dep array omits `isOwnerUpdating`) + `owners.thunks.ts:57-72`
- concepts.audiences ← WebFetch live `/features/management` 2026-05-20 + `SecurityConstants.java:143-147` (grep verified — no rule for GET /api/owners)
- dependencies_semantic.requires-feature ← `OwnerController.java:17-55` + F-019 feature-flow + F-006 (RBAC consumer) + `WithPermissions.tsx:1-34` + `usePermissions.ts:1-16`
- dependencies_semantic.requires-runtime ← `OwnersList.tsx:1-27` (imports) + `OwnerForm.tsx:1-10` + `EditableOwnerItem.tsx:1-11`
- dependencies_semantic.coupling[*] ← `OwnersList.tsx:25-27` (component imports) + `owners.thunks.ts:34-86` (thunks) + `owners.selectors.ts:10-25` (selectors) + `WithPermissions.tsx:1-34`
- tests_coverage_semantic.test_files ← `find <odd-platform-ui>/src -name 'OwnersList.test.*'` 2026-05-20 (zero matches)
- docs_link_semantic.inferred_docs[0] ← WebFetch `https://docs.opendatadiscovery.org/features/management` 2026-05-20 status 200
- docs_link_semantic.inferred_docs[1] ← per F-019 trinity sidecars' WebFetch records 2026-05-20 status 200
- docs_link_semantic.doc_drift_findings ← WebFetch live management doc 2026-05-20 + cross-check against the component's UX features
- implicit_adrs[0] (permission-gated HIDE not DISABLE) ← `WithPermissions.tsx:27-29`
- implicit_adrs[1] (shared Edit/Create form) ← `OwnerForm.tsx:19-58, 137-138`
- implicit_adrs[2] (confirmation on delete, not on update) ← `EditableOwnerItem.tsx:41-74`
- bugs_limitations_corner_cases[0] (useEffect dep array missing dispatch) ← `OwnersList.tsx:44-46` + LSN-017 (non-applicability anchor)
- bugs_limitations_corner_cases[1] (no refetch on update completion) ← `OwnersList.tsx:44-46` (dep array) + `owners.thunks.ts:57-72`
- bugs_limitations_corner_cases[2] (page-1 refetch discards query) ← `OwnersList.tsx:45`
- bugs_limitations_corner_cases[3] (total count lags during search) ← `OwnersList.tsx:48-50, 74-76`
- bugs_limitations_corner_cases[4] (search-vs-paginate race) ← `OwnersList.tsx:52-68` + `owners.thunks.ts:34-44`
- bugs_limitations_corner_cases[5] (empty-roles destructive UPDATE reachable in UI) ← `OwnerForm.tsx:40-43, 95-103, 108-117` + F-019 batch-P updateOwner sidecar
- bugs_limitations_corner_cases[6] (no inline updating spinner) ← `OwnerForm.tsx:137-138` + absence in `EditableOwnerItem.tsx:32-77`
- bugs_limitations_corner_cases[7] (EditableOwnerItem dep array) ← `EditableOwnerItem.tsx:27-30`
- security.auth_mode_relevance ← batch-C `*SecurityConfiguration` sidecars + F-019 batch-P DISABLED-anonymous-reach finding
- security.authorization_assertions[0-2] ← `OwnersList.tsx:88-98` + `EditableOwnerItem.tsx:41-74` + `SecurityConstants.java:143-147`
- security.owner_scoping ← `OwnersList.tsx:45, 54, 58` (no ids/allowedForSync filter) + `OwnerServiceImpl.java:45-52` + `SecurityConstants.java` grep (no rule for GET /api/owners)
- security.data_exposure ← `OwnersList.tsx:33, 74-76, 123-125` + the SecurityConstants grep result
- security.known_security_gaps[0] (empty-roles UI hazard) ← `OwnerForm.tsx:40-43, 95-103` + F-019 batch-P
- security.known_security_gaps[1] (no SecurityRule on GET /api/owners) ← `SecurityConstants.java:143-147` grep + ADR-CANDIDATE-003 cross-link
- security.known_security_gaps[2] (DISABLED anonymous reach) ← `DisabledAuthSecurityConfiguration.java:11-19` batch-C sidecar + REFACTOR-185.md + F-019 batch-P
- security.known_security_gaps[3] (no client-side sanitisation) ← `OwnersList.tsx:41, 61-64`
- performance.hot_paths ← `OwnersList.tsx:44-68`
- performance.throughput_characteristics ← `OwnersList.tsx:40, 52-55, 57-59`
- performance.resource_allocation ← `OwnersList.tsx:40` + `owners.selectors.ts:18-20` + `OwnerForm.tsx:34-43`
- performance.scaling_characteristics ← `OwnersList.tsx:115-126`
- performance.known_performance_gaps[0] (no virtualization) ← `OwnersList.tsx:115-126`
- performance.known_performance_gaps[1] (search/scroll race) ← `OwnersList.tsx:52-68`
- performance.known_performance_gaps[2] (total count state-sync) ← `OwnersList.tsx:42, 48-50, 74-76`

## confidence_per_field

- understanding: HIGH (every claim anchored to the component body, the neighbour components, the thunks, the selectors, the controller, and the WebFetched live management doc)
- concepts: HIGH (entities, operations, invariants all anchored at file:line; the load-bearing invariants — delete has a confirmation modal but update with empty-roles does not, soft-deleted owners hidden from list — are anchored at `EditableOwnerItem.tsx:55-72` + F-019 deleteOwner sidecar)
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH (absence-of-tests verified by filesystem search 2026-05-20; the empty arrays are positive findings, not omissions)
- docs_link_semantic: HIGH (live management doc WebFetched 2026-05-20 status 200; the SILENCE findings on UX coverage are positive WebFetch results)
- implicit_adrs: HIGH (the HIDE-not-DISABLE convention, the shared-form branching, the confirmation-asymmetry — all visible at cited lines)
- bugs_limitations_corner_cases: HIGH (every concern cited file:line; the empty-roles UI reachability verified by tracing OwnerForm dialog UX → useFieldArray → handleOwnerFormSubmit → updateOwner thunk → F-019 batch-P destructive path)
- security: HIGH (every claim is structural and traces to OwnersList / EditableOwnerItem / OwnerForm / WithPermissions / SecurityConstants / F-019 trinity sidecars / batch-C DISABLED sidecar)
- performance: HIGH (the fetch / scroll / state-sync shape directly visible at cited lines)

## Maintainer notes
