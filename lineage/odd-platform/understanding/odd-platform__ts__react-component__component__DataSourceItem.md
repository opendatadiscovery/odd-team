---
node_id: "odd-platform ts react-component component:DataSourceItem"
node_kind: react-component
axis: ui-components
extracted_at_commit: 80637ed
enriched_at_commit: 80637ed
extractor_version: 0.1.0
prompt_version: file-analyser/0.5.0
enrichment_status: complete
confidence_overall: MEDIUM
session_id: session-2026-05-22-datasource-ui-reanalysis-DataSourceItem
---

# DataSourceItem — semantic understanding

## understanding

`DataSourceItem` is the per-data-source **card** rendered in the Datasources
management list (the `/management/datasources` tab). Each card shows the
operator one registered data source: its logo (derived from the ODDRN), name,
ODDRN, description, namespace, and — when a token value exists — the connection
token via the `DataSourceItemToken` sub-component
(`DataSourceItem.tsx:34-124`). The card carries two controls in its top-right
`Actions` strip: an **Edit** button that opens the `DataSourceForm` modal in
edit mode, and a **Delete** button that opens a `ConfirmationDialog`
("Are you sure you want to delete this datasource?"). Both controls are
**permission-gated by `WithPermissions`** (`DataSourceItem.tsx:44-75`): an
operator without `DATA_SOURCE_UPDATE` / `DATA_SOURCE_DELETE` sees the card with
the corresponding control entirely absent (not disabled —
`WithPermissions.tsx:27-29` returns `null`). The component is presentational +
one redux action: it holds a single piece of local state (`isHidden`, the
token-masking flag shared with the child) and dispatches exactly one thunk,
`deleteDataSource`, on confirmed delete (`DataSourceItem.tsx:31`).

## concepts

- entities:
  - "DataSource (the `generated-sources` DTO this card renders — `id`, `name`, `oddrn`, `description`, `namespace`, `token`; the sole prop, `DataSourceItem.tsx:21-23`)"
  - "Permission (the `generated-sources` enum — `DATA_SOURCE_UPDATE` gates Edit, `DATA_SOURCE_DELETE` gates Delete; `DataSourceItem.tsx:44,57`)"
  - "DataSourceForm (the create/edit modal — reused here in edit mode with `dataSource` populated; `DataSourceItem.tsx:45-55`)"
  - "ConfirmationDialog (the shared two-stage confirm modal that wraps the Delete button; `DataSourceItem.tsx:58-74`)"
  - "DataSourceItemToken (sibling sub-component — renders the token value + Copy/Regenerate; `DataSourceItem.tsx:103-107`)"
  - "deleteDataSource (the redux thunk dispatched on confirmed delete; `redux/thunks` → `datasources.thunks.ts:79-95`)"
- operations:
  - "render-card: lay out logo + name (xs=8 grid) and the Actions strip (Edit, Delete); `DataSourceItem.tsx:35-77`"
  - "render-metadata: ODDRN (tooltip-wrapped), Description, Namespace as `LabeledInfoItem` rows; `DataSourceItem.tsx:79-94`"
  - "render-token: when `dataSource.token?.value` is truthy, render the `DataSourceItemToken` sub-component; `DataSourceItem.tsx:95-109`"
  - "render-token-warning: when `!isHidden` (token revealed), show a warning admonition 'Save token in a secure location...'; `DataSourceItem.tsx:110-121`"
  - "open-edit: clicking Edit opens `DataSourceForm` in edit mode (handled inside `DataSourceForm`/`DialogWrapper`, not by this component); `DataSourceItem.tsx:45-55`"
  - "confirm-delete: clicking Delete opens `ConfirmationDialog`; on confirm, `onDelete` dispatches `deleteDataSource({ dataSourceId })`; `DataSourceItem.tsx:31,58-74`"
- invariants:
  - "Edit and Delete are each rendered only if the current user `hasAccessTo` the respective permission — `WithPermissions` returns `null` otherwise (`WithPermissions.tsx:27-29`). The controls are hidden, never shown-disabled."
  - "The Delete dispatch happens ONLY via `ConfirmationDialog.onConfirm` — there is no direct one-click delete (`DataSourceItem.tsx:66`)."
  - "`onDelete` passes only `dataSource.id` to the thunk (`DataSourceItem.tsx:31`) — no client-side cascade pre-check; the component cannot know whether the delete will be blocked."
  - "The token block is rendered only when `dataSource.token?.value` is truthy (`DataSourceItem.tsx:95`); a data source with no token shows no Token row."
  - "`isHidden` local state is initialized `true` (`DataSourceItem.tsx:29`) but is OVERWRITTEN by `DataSourceItemToken`'s own `useEffect`, which sets it from whether `token.value` begins with `******` (`DataSourceItemToken.tsx:25-27`). The warning-banner gate `!isHidden` is therefore controlled by the child, not by this component's initializer."
- audiences:
  - "platform-operator — the human browsing the Datasources management tab to review, edit, or remove a registered data source (per the live doc page WebFetched 2026-05-22 status 200, the card is where the operator can 'edit metadata' and 'remove a source no longer ingested')"

## dependencies_semantic

- requires-feature:
  - "`deleteDataSource` thunk (`datasources.thunks.ts:79-95`) — the only redux action this component dispatches. Wraps `dataSourceApi.deleteDataSource` (the generated OpenAPI client → `DELETE /api/datasources/{data_source_id}`)."
  - "`DataSourceForm` (`../DataSourceForm/DataSourceForm.tsx`) — provides the Edit modal; this component supplies it `dataSource` (→ edit mode) and a custom `btnCreateEl` (the Edit button)."
  - "`ConfirmationDialog` (`components/shared/elements/ConfirmationDialog/ConfirmationDialog.tsx`) — provides the delete-confirm modal; this component supplies `onConfirm`, the titles, and `actionBtn` (the Delete button)."
  - "`DataSourceItemToken` (`./DataSourceItemToken/DataSourceItemToken.tsx`) — renders the token value, Copy, and the token-Regenerate confirm flow; receives `isHidden`/`setIsHidden` to share the masking state."
  - "`WithPermissions` (`components/shared/contexts`) — the permission gate; reads `usePermissions().hasAccessTo`."
  - "shared elements: `AppTooltip`, `Button`, `DatasourceLogo`, `InfoItem`, `LabeledInfoItem` (`components/shared/elements`); `AlertIcon`, `DeleteIcon`, `EditIcon` (`components/shared/icons`)."
- requires-config:
  - "N/A — the component reads no config key; the auth-mode and permission model it depends on are resolved server-side and surfaced via `usePermissions`."
- requires-runtime:
  - "React 18 + `react-i18next` (`useTranslation`) — every visible label is wrapped in `t(...)`; the locale catalog is the runtime source of the actual displayed strings."
  - "`@reduxjs/toolkit` store + `useAppDispatch` — the thunk dispatch path."
  - "MUI (`Grid`, `Typography`) for layout."
- coupling:
  - "The component is a CHILD of the Datasources-list view (the node `ts react-component:datasources-list` referenced as `unresolved` in `F-031`'s chain). It receives one `dataSource` from the list's mapped render; it does not fetch."
  - "It is COUPLED to `DataSourceItemToken` through the shared `isHidden` state lifted into this component (`DataSourceItem.tsx:29,104-106`) — but the source-of-truth update of that state lives in the CHILD's `useEffect` (`DataSourceItemToken.tsx:25-27`), an inverted-ownership coupling worth noting."

## tests_coverage_semantic

- covered_behaviours:
  - behaviour: "ZERO direct coverage. There is no `DataSourceItem.test.tsx` / `.spec.tsx`, no test for the Datasources management list. (Glob `odd-platform-ui/src/components/Management/DataSourcesList/**/*.{test,spec}.{ts,tsx}` returned nothing this session.) The card, its permission gating, the delete-confirm flow, and the token-warning gate are all uncovered."
    test_class: integration
    test_files: []
- uncovered_behaviours:
  - behaviour: "Delete-of-active-source: clicking Delete → confirming on a data source that still has live data_entity children — the backend returns HTTP 400 (`CascadeDeleteException`); the UI must surface a comprehensible message and the dialog state must recover (not stay stuck-loading)."
    test_class: integration
    criticality: HIGH
    note: "The §0 user-facing failure. The operator sees a generic error toast carrying the raw backend string and a ConfirmationDialog that stays open with isLoading never reset (see bugs). Pinned by P-078."
  - behaviour: "Happy-path delete: confirming delete on a source with no live children dispatches `deleteDataSource`, the dialog closes, and a 'Datasource successfully deleted.' success toast appears."
    test_class: integration
    criticality: HIGH
    note: "Pinned by P-078."
  - behaviour: "Permission gating: a user without `DATA_SOURCE_DELETE` sees no Delete button; a user without `DATA_SOURCE_UPDATE` sees no Edit button; the card itself still renders."
    test_class: security
    criticality: HIGH
    note: "WithPermissions returns null for the gated child (WithPermissions.tsx:27-29). Pinned by P-080."
  - behaviour: "Edit opens DataSourceForm in edit mode with fields pre-populated from `dataSource`, and the ODDRN input is disabled."
    test_class: integration
    criticality: MEDIUM
    note: "ODDRN disabled in edit mode — DataSourceForm.tsx:120. A regression making ODDRN editable would let an operator silently re-key a data source's identity."
  - behaviour: "Token block conditional render: a data source with `token.value` undefined renders no Token row; one with a value renders `DataSourceItemToken`."
    test_class: unit
    criticality: LOW
    note: "DataSourceItem.tsx:95 — `dataSource.token?.value &&` short-circuit."
  - behaviour: "Token warning banner: the 'Save token in a secure location' admonition appears only when the token is revealed (`!isHidden`)."
    test_class: unit
    criticality: LOW
    note: "DataSourceItem.tsx:110-121. The `isHidden` value is driven by the child's useEffect; a unit test must mount both components together."
  - behaviour: "Delete-of-already-deleted / concurrently-deleted source: a second operator's card still shows Delete; clicking it issues a DELETE for an id whose row may already be soft-deleted."
    test_class: integration
    criticality: LOW
    note: "Backend response for a no-row-matched delete is itself runtime-undetermined (backend sidecar P-049); the UI just shows whatever toast results."
- test_files:
  - "NONE — no `DataSourceItem.test.tsx` / `.spec.tsx` exists (Glob this session: no test files anywhere under `DataSourcesList/`)."
- gaps: |
    The entire Datasources management UI is untested. The highest-leverage
    gap is an `integration` test of the Delete-of-active-source path: the
    backend returns 400 with `CascadeDeleteException`, and the current UI
    handles that with a generic error toast plus a ConfirmationDialog that
    never recovers its loading state — a senior product owner would not ship
    that without a regression test pinning the intended recovery behaviour.
    The `security` class is also entirely uncovered: the `WithPermissions`
    gating of Edit/Delete is the only thing standing between a READ-only user
    and the controls, and nothing asserts it. `unit`-level coverage of the
    two conditional renders (token block, token warning) is the lowest-value
    gap.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/management"
    anchor: ""
    rationale: "The canonical doc page for the Datasources management tab — the UI surface this card is rendered into. WebFetched this session; it describes the card as the place an operator edits metadata and removes a source, and mentions the per-card redacted token + Regenerate action."
    last_verified_at: "2026-05-22T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
    fetched_excerpts: |
      WebFetched 2026-05-22 (status 200). The page mentions deletion only as
      the workflow phrase, verbatim: "remove a source no longer ingested".
      The WebFetch summary, probed on delete preconditions: the page "does NOT
      detail (1) any preconditions or blocks when deleting a source with
      existing data entities, (2) error handling or warnings during removal,
      (3) technical constraints around orphaned catalog data." On the card's
      controls: it references that operators can "edit metadata" and that each
      card displays "a partially-redacted Collector token with a Regenerate
      action"; it does not elaborate on the Edit modal or token mechanics.
- doc_drift_findings:
  - "The Management page (WebFetched 2026-05-22, status 200) frames the Delete control as 'remove a source no longer ingested' and documents NONE of the operator-visible failure path. In reality, clicking Delete on a data source that still has live data_entity children produces an HTTP 400 (the backend `deleteDataSource` sidecar confirms `CascadeDeleteException`), which this component surfaces as a GENERIC error toast (`showServerErrorToast`, `errorHandling.tsx:48-68`) carrying the raw backend message — not a deletion. The doc gives the operator no hint that an actively-ingested source is effectively undeletable from the UI. Documented-feature gap; the priority finding for this card."
  - "The doc says the operator can 'edit metadata' but does not state that the ODDRN field is immutable in edit mode (`DataSourceForm.tsx:120` disables it when `dataSource.oddrn` is set). An operator expecting to correct a mistyped ODDRN via Edit cannot. Minor documented-feature gap."

## implicit_adrs

- "Destructive and mutating per-card controls are PERMISSION-GATED by hiding, not disabling — `WithPermissions` renders the child only when `hasAccessTo` is true and returns `null` otherwise. The decision is the consistent `WithPermissions`-wrap pattern applied to both Edit and Delete (and, in the sibling, to token-Regenerate). — evidence: DataSourceItem.tsx:44-75 + WithPermissions.tsx:27-29 — intent_anchor: \"return hasAccessTo(permissionTo) ? <>{children}</> : null;\" — confidence: HIGH"
- "Delete is gated behind an explicit two-stage confirmation — the Delete icon button only opens a `ConfirmationDialog` whose modal restates the action and the target name before any dispatch. The decision is the deliberate use of the shared `ConfirmationDialog` wrapper rather than an inline `onClick={onDelete}`. — evidence: DataSourceItem.tsx:58-74 — intent_anchor: \"actionTitle={t('Are you sure you want to delete this datasource?')}\" — confidence: HIGH"
- "Token reveal carries an inline security admonition — when the token is shown unmasked, the card renders a warning ('Save token in a secure location. You will not be able to retrieve it again.'). The decision is to couple token-reveal with an explicit non-retrievability warning. — evidence: DataSourceItem.tsx:110-121 — intent_anchor: \"Save token in a secure location. You will not be able to retrieve it again.\" — confidence: HIGH"

## bugs_limitations_corner_cases

- "**The Delete-confirm dialog gives the operator no forewarning that the delete may be blocked, and on the 400 it neither explains the cause in product terms nor recovers its own state.** The backend `deleteDataSource` returns HTTP 400 (`CascadeDeleteException`, 'Data source cannot be deleted: there are still data entities attached') whenever the source still has live `data_entity` children — confirmed by the backend method sidecar `odd-platform__java__DataSourceController__controller-method__deleteDataSource.md`. From the user's seat: (1) the `ConfirmationDialog` body (`DataSourceItem.tsx:58-65`) carries NO `additionalContent` warning that an actively-ingested source cannot be deleted; (2) on confirm, the thunk's error path (`handleResponseThunk.ts:34-42`) calls `showServerErrorToast`, which surfaces the RAW backend string in a generic red toast (`errorHandling.tsx:48-68`); (3) `ConfirmationDialog.onClose` does `action().then(() => { setIsLoading(false); handleClose(); }).catch(() => {})` (`ConfirmationDialog.tsx:28-34`) — on rejection the `.catch` swallows the error, so `handleClose()` is NEVER called (the dialog stays open) and `setIsLoading(false)` is NEVER called (the dialog's confirm button stays in its loading state). The operator is left with a stuck-loading modal plus a backend-jargon toast, and no in-product guidance to stop the collector / soft-delete the entities first. Severity: HIGH (the primary user-facing defect of the DataSource UI surface). Pinned by P-078." — evidence: DataSourceItem.tsx:31,58-74 + ConfirmationDialog.tsx:25-35 + handleResponseThunk.ts:34-42 + errorHandling.tsx:48-68 — severity: HIGH
- "**`isHidden` ownership is inverted between this component and `DataSourceItemToken`.** This component declares `useState(true)` for `isHidden` (`DataSourceItem.tsx:29`) and uses `!isHidden` to gate the token-warning banner (`DataSourceItem.tsx:110`), but the value is actually computed by the CHILD's `useEffect`, which sets it from whether `token.value` starts with `******` (`DataSourceItemToken.tsx:25-27`). The parent's `true` initializer is dead on the first committed render after the child mounts. The warning banner therefore depends on a child effect firing, and a future refactor that removes the child's effect would silently break the parent's banner. Severity: LOW (works today; fragile, non-obvious ownership). The fix anchor is to hoist the `******`-prefix derivation into the parent or make `isHidden` derived rather than stateful." — evidence: DataSourceItem.tsx:29,110 + DataSourceItemToken.tsx:25-27 — severity: LOW
- "**`onDelete` has no `.then`/`.catch` and no in-component feedback.** `onDelete = () => dispatch(deleteDataSource(...))` (`DataSourceItem.tsx:31`) returns the dispatch promise to `ConfirmationDialog`, but the component itself does nothing with success or failure — all feedback is the global toast and (on success) the parent list re-rendering when the deleted source drops out of the store. There is no card-local empty/error state. Severity: LOW (toast is the intended channel; noted because it means a swallowed toast = a silent failure)." — evidence: DataSourceItem.tsx:31 + datasources.thunks.ts:79-95 — severity: LOW
- "**The card cannot show the operator that a delete will succeed before they click.** There is no client-side equivalent of the backend's `existsNonDeletedByDataSourceId` cascade-check; the component renders the Delete control identically for a deletable and an undeletable data source. A senior product owner would expect either a disabled-with-tooltip state or a pre-flight check. Severity: MEDIUM (UX gap — the operator discovers undeletability only by failing). Captured here as the product-shape limitation behind the HIGH bug above." — evidence: DataSourceItem.tsx:57-75 (no pre-check) + backend deleteDataSource sidecar (cascade-guard) — severity: MEDIUM

## stress_findings

```yaml
stress_findings:
  tunables:
    - location: "DataSourceItem.tsx:38"
      name: "DatasourceLogo width / padding props"
      value: "width={32} padding={1}"
      questions:
        - q: "What at N = 0? At N = 1?"
          a: "Pure presentational sizing of the logo glyph (32px wide, padding 1 unit). At 0 the logo would collapse; these are layout constants, not behavioural limits — no operator-observable consequence beyond cosmetics."
          confidence: STATIC-INFERRED
          evidence: "DataSourceItem.tsx:38"
        - q: "What at N = tunable x 100?"
          a: "A 3200px logo would break the card layout; this is a hard-coded literal, not operator-tunable, so the case is unreachable in the product."
          confidence: STATIC-INFERRED
          evidence: "DataSourceItem.tsx:38"
        - q: "What does the operator see at each boundary?"
          a: "Nothing — `width`/`padding` are fixed in source. Not a behavioural tunable; recorded for completeness only."
          confidence: STATIC-INFERRED
          evidence: "DataSourceItem.tsx:38"
    - location: "DataSourceItem.tsx:37,80,89,92,96"
      name: "Grid `xs` / `labelWidth` layout literals"
      value: "xs={8} (name column), labelWidth={4} (metadata label column)"
      questions:
        - q: "What at N = 0? At N = 1?"
          a: "MUI 12-column grid constants. `xs={8}` gives the name+logo 8/12 and the Actions strip the remaining 4/12; `labelWidth={4}` sets the `LabeledInfoItem` label column. Layout-only; no behavioural edge."
          confidence: STATIC-INFERRED
          evidence: "DataSourceItem.tsx:37,80"
        - q: "What at N = tunable x 100?"
          a: "Out of range for a 12-column grid; literals are not operator-tunable. Unreachable."
          confidence: STATIC-INFERRED
          evidence: "DataSourceItem.tsx:37"
        - q: "What does the operator see at each boundary?"
          a: "Cosmetic only — a long data-source name is truncated/wrapped by the `xs={8}` column with `title={dataSource.name}` providing the full string on hover (DataSourceItem.tsx:39). No data or behaviour affected."
          confidence: STATIC-INFERRED
          evidence: "DataSourceItem.tsx:39"
  name_behavior_pairs:
    - name: "Delete button / ConfirmationDialog onConfirm -> deleteDataSource"
      promise: "Delete this data source — remove the card and the source from the catalog."
      implementation: "Opens a ConfirmationDialog; on confirm, dispatches `deleteDataSource({ dataSourceId })` -> `DELETE /api/datasources/{id}`. The backend (per the deleteDataSource method sidecar) performs a GUARDED SOFT-delete: HTTP 204 only if the source has no live data_entity children, otherwise HTTP 400 `CascadeDeleteException` and NO deletion. On 204 the thunk shows 'Datasource successfully deleted.' and the source drops from the store; on 400 the UI shows a generic error toast with the raw backend message and the dialog stays stuck-open."
      drift: DRIFT_NAME_VS_BEHAVIOR
      operator_visible_consequence: "The 'Delete' control does not reliably delete: on an actively-ingested data source it produces an HTTP 400 surfaced as a backend-jargon error toast plus a non-recovering modal, with no in-product explanation that the operator must remove the data entities (or stop the collector) first."
      confidence: STATIC-INFERRED
      evidence: "DataSourceItem.tsx:31,58-74 + datasources.thunks.ts:79-95 + odd-platform__java__DataSourceController__controller-method__deleteDataSource.md"
    - name: "Edit button / DataSourceForm (edit mode)"
      promise: "Edit this data source's metadata."
      implementation: "Renders `DataSourceForm` with the `dataSource` prop set, which puts the form in edit mode (title 'Edit datasource', DataSourceForm.tsx:85) and dispatches `updateDataSource` on Save (DataSourceForm.tsx:69-81). The ODDRN field is `disabled` whenever `dataSource.oddrn` is set (DataSourceForm.tsx:120) — so 'edit metadata' EXCLUDES the ODDRN."
      drift: MINOR
      operator_visible_consequence: "Edit lets the operator change name / namespace / description but NOT the ODDRN — the ODDRN input is greyed out. An operator who opened Edit to correct a mistyped ODDRN finds the field locked. Minor (intentional immutability of the identity key) but undocumented."
      confidence: STATIC-INFERRED
      evidence: "DataSourceItem.tsx:45-55 + DataSourceForm.tsx:85,120"
  orderings: []   # DataSourceItem renders a single data source passed as a prop; it does not sort, paginate, or aggregate. Ordering of the list is the parent datasources-list view's concern.
  auth_gates:
    - location: "DataSourceItem.tsx:44-56"
      endpoint: "Edit control (WithPermissions permissionTo=DATA_SOURCE_UPDATE)"
      questions:
        - q: "What does this endpoint return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "This is a UI control, not an endpoint. `WithPermissions` calls `usePermissions().hasAccessTo(DATA_SOURCE_UPDATE)` (WithPermissions.tsx:17,27) — the permission set is resolved server-side per the active auth mode. Under DISABLED, per the backend updateDataSource/class sidecars, the platform's documented stance opens all paths, so the permission set is expected to grant the control; under LOGIN_FORM/OAUTH2/LDAP the control is shown only if the user's bound policy grants DATA_SOURCE_UPDATE. The exact per-mode permission resolution lives in the permissions API the UI consumes, not in this component."
          confidence: REFERENCE
          evidence: "odd-platform java DataSourceController controller-method:updateDataSource (auth analysis) + WithPermissions.tsx:17"
        - q: "What does an unauthenticated caller see?"
          a: "Under LOGIN_FORM/OAUTH2/LDAP an unauthenticated user never reaches the Datasources route (the app shell gates it); the question does not arise at the card level. Under DISABLED the user is effectively always 'authenticated' with the open permission set. The card itself renders the Edit control purely from `hasAccessTo` — it has no auth-state branch of its own."
          confidence: REFERENCE
          evidence: "odd-platform java DataSourceController controller-class:DataSourceController (auth.type analysis) + WithPermissions.tsx:27"
        - q: "What does a wrong-role caller see?"
          a: "A user lacking DATA_SOURCE_UPDATE sees the card WITHOUT the Edit button — `WithPermissions` returns `null` for the gated child (WithPermissions.tsx:27-29). The control is absent, not disabled. The card name/ODDRN/metadata/token still render."
          confidence: STATIC-INFERRED
          evidence: "DataSourceItem.tsx:44-56 + WithPermissions.tsx:27-29"
        - q: "Where does the gate live — controller, service, repository, or nowhere?"
          a: "TWO layers. (1) UI: the `WithPermissions` wrap hides the Edit control from a user without the permission (DataSourceItem.tsx:44). (2) Server: `PUT /api/datasources/{id}` is independently bound to DATA_SOURCE_UPDATE in `SecurityConstants` (per the updateDataSource sidecar) and enforced before the controller. The UI gate is UX-only; the server gate is the security boundary — a user who crafts the PUT directly is still rejected server-side."
          confidence: STATIC-INFERRED
          evidence: "DataSourceItem.tsx:44 + WithPermissions.tsx:27-29 + odd-platform java DataSourceController controller-method:updateDataSource"
    - location: "DataSourceItem.tsx:57-75"
      endpoint: "Delete control (WithPermissions permissionTo=DATA_SOURCE_DELETE)"
      questions:
        - q: "What does this endpoint return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "UI control, not an endpoint. Same model as Edit: shown iff `hasAccessTo(DATA_SOURCE_DELETE)`. Under DISABLED the open permission set grants it; under the three real modes it is shown only with the bound policy. The backend `DELETE /api/datasources/{id}` is separately gated by DATA_SOURCE_DELETE (deleteDataSource sidecar, SecurityConstants.java:121-123)."
          confidence: REFERENCE
          evidence: "odd-platform java DataSourceController controller-method:deleteDataSource (auth_gates) + WithPermissions.tsx:17"
        - q: "What does an unauthenticated caller see?"
          a: "Same as Edit — an unauthenticated user does not reach the route under the three real modes; under DISABLED the open permission set applies. No card-level auth branch."
          confidence: REFERENCE
          evidence: "odd-platform java DataSourceController controller-class:DataSourceController (auth.type analysis)"
        - q: "What does a wrong-role caller see?"
          a: "A user lacking DATA_SOURCE_DELETE sees the card WITHOUT the Delete button (WithPermissions.tsx:27-29). A READ_ONLY user therefore sees a read-only card — name, ODDRN, metadata, token value (still visible), but no Edit and no Delete. Pinned by P-080."
          confidence: PROBE-NEEDED
          evidence: "P-080"
        - q: "Where does the gate live — controller, service, repository, or nowhere?"
          a: "TWO layers, same as Edit. (1) UI: `WithPermissions` hides the Delete control (DataSourceItem.tsx:57). (2) Server: `DELETE /api/datasources/{id}` bound to DATA_SOURCE_DELETE in SecurityConstants.java:121-123, enforced by the ReactiveAuthorizationManager before the controller (deleteDataSource sidecar). The UI gate is UX-only; the server gate is the boundary."
          confidence: STATIC-INFERRED
          evidence: "DataSourceItem.tsx:57 + WithPermissions.tsx:27-29 + odd-platform java DataSourceController controller-method:deleteDataSource"
  resource_boundaries:
    - location: "DataSourceItem.tsx:31 (deleteDataSource dispatch via ConfirmationDialog)"
      kind: idempotency
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "A double-click on the confirm button is mostly blocked by ConfirmationDialog: on confirm it sets `isLoading=true` (ConfirmationDialog.tsx:27) which the DialogWrapper uses to disable the action button while the promise is in flight. Two operators on two browsers deleting the same source: each dispatches a DELETE; the backend `deleted_at IS NULL` predicate makes the second a no-op (deleteDataSource sidecar). No client-side corruption — the second client's card simply disappears on the next list refresh. NOT statically certain that the in-flight disable fully prevents a fast double-confirm; runtime-dependent."
          confidence: PROBE-NEEDED
          evidence: "P-079"
        - q: "Is the call replay-safe?"
          a: "Yes at the data layer — the backend soft-delete is idempotent (`deleted_at IS NULL` guard, deleteDataSource sidecar). At the UI layer, a replayed delete after the source is already gone would 404/204 and show whatever toast results; the card is already removed from the store so there is no second card to act on."
          confidence: STATIC-INFERRED
          evidence: "datasources.thunks.ts:79-95 + odd-platform java DataSourceController controller-method:deleteDataSource (replay-safety)"
        - q: "If a cache fronts this, what is the TTL / eviction key / staleness window?"
          a: "No cache. The thunk goes straight to `dataSourceApi`; on success the deleted id is returned (datasources.thunks.ts:84-87) and a reducer drops it from the store. The staleness window is between a successful delete in another browser and this browser's next `fetchDataSourcesList` — a stale card stays clickable until then, and clicking Delete on it issues a DELETE for an already-soft-deleted id."
          confidence: STATIC-INFERRED
          evidence: "datasources.thunks.ts:79-95 (no cache layer)"
  request_inputs:
    - location: "DataSourceItem.tsx:21-25"
      input_kind: body-field
      input_name: "dataSource (the sole prop)"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "One registered data source — the full `DataSource` DTO whose fields the card renders. The name is specific and names the data_source entity."
          confidence: STATIC-INFERRED
          evidence: "DataSourceItem.tsx:21-25 (DataSourceItemProps)"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Rendered field-by-field: `oddrn` -> logo name + ODDRN row (lines 38,87); `name` -> heading + delete-confirm text (lines 39,63); `description` -> Description row (line 90); `namespace?.name` -> Namespace row (line 93); `token?.value` -> gates and feeds the DataSourceItemToken sub-component (lines 95,104); `id` -> the only field sent to a thunk, as `deleteDataSource({ dataSourceId: dataSource.id })` (line 31). Edit passes the whole `dataSource` object to `DataSourceForm` (line 46)."
          confidence: STATIC-INFERRED
          evidence: "DataSourceItem.tsx:31,38,39,46,63,87,90,93,95,104"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — every use of `dataSource` operates on that same data-source object; no field is re-interpreted as a different entity. `dataSource.id` is the data_source primary key the delete thunk needs."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "DataSourceItem.tsx:31,46"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — the prop MATCHES; no silent translation."
          confidence: STATIC-INFERRED
          evidence: "DataSourceItem.tsx:21-25"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "The `DataSource` DTO carries fields the card does NOT render — notably `connection`-related and `pulling`-related fields and (per `DataSourceForm`) `pullingInterval`. The card deliberately shows a metadata subset (name/ODDRN/description/namespace/token); this is a presentational choice, not a name-vs-scope drift. No misuse — recorded so a future 'why doesn't the card show X' question has the answer."
          confidence: STATIC-INFERRED
          evidence: "DataSourceItem.tsx:79-122 (rendered subset) + DataSourceForm.tsx:25-27 (DataSourceFormData includes pullingInterval)"
      routes_to_finding: "N/A — prop MATCHES; no drift finding routed."
    - location: "DataSourceItem.tsx:29,104-106"
      input_kind: local-variable
      input_name: "isHidden (local state passed down to DataSourceItemToken)"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "Whether the connection token is currently masked (hidden) in the card. The name promises a boolean masking flag."
          confidence: STATIC-INFERRED
          evidence: "DataSourceItem.tsx:29"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "`!isHidden` gates the 'Save token in a secure location' warning banner (DataSourceItem.tsx:110); `isHidden`+`setIsHidden` are passed to `DataSourceItemToken` (lines 105-106), where the CHILD's useEffect actually SETS it from `token.value.substring(0,6) === '******'` (DataSourceItemToken.tsx:25-27)."
          confidence: STATIC-INFERRED
          evidence: "DataSourceItem.tsx:29,105-106,110 + DataSourceItemToken.tsx:25-27"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES in meaning (it is the token-masking flag) but the OWNERSHIP is inverted: the parent declares the state and the initializer (`true`), yet the child computes the real value. The name is honest; the data-flow is the smell, recorded under bugs."
          drift: MINOR
          confidence: STATIC-INFERRED
          evidence: "DataSourceItem.tsx:29 + DataSourceItemToken.tsx:25-27"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "Not a name-translation issue. The operator-visible effect of the inverted ownership: the warning banner is correct in practice because the child's effect runs on mount; the risk is a future refactor silently breaking it (captured in bugs, severity LOW)."
          confidence: STATIC-INFERRED
          evidence: "DataSourceItem.tsx:110 + DataSourceItemToken.tsx:25-27"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "NONE — `isHidden` is the only masking flag; there is no unused name-aligned variable."
          confidence: STATIC-INFERRED
          evidence: "DataSourceItem.tsx:29"
      routes_to_finding: "bugs_limitations_corner_cases (the `isHidden` inverted-ownership entry, severity LOW)"
  probes_emitted:
    - probe_id: P-078
      question: "When Delete is confirmed on a data source that still has live data_entity children, what does the operator actually see — and does the ConfirmationDialog recover its state after the HTTP 400?"
      probe_path: "lineage/odd-platform/probes/P-078.yaml"
    - probe_id: P-079
      question: "Does ConfirmationDialog's in-flight isLoading disable reliably prevent a double-confirm from dispatching deleteDataSource twice?"
      probe_path: "lineage/odd-platform/probes/P-079.yaml"
    - probe_id: P-080
      question: "Does a user without DATA_SOURCE_DELETE / DATA_SOURCE_UPDATE see the DataSourceItem card with the Delete / Edit controls absent (WithPermissions returns null)?"
      probe_path: "lineage/odd-platform/probes/P-080.yaml"
  stress_summary:
    triggers_total: 7
    questions_total: 27
    answers_static_inferred: 19
    answers_probe_needed: 4
    answers_reference: 4
    drift_flags: 2
```

Note on probe-id range: this node reserved P-078..P-081; three probes (P-078,
P-079, P-080) were authored. P-081 is left unallocated — the remaining
PROBE-NEEDED question (Edit-mode ODDRN-disabled / token-conditional-render
behaviours) is statically certain enough not to warrant a runtime probe, and
the resource-boundary double-click question is folded into P-079. P-081 is
recorded here as reserved-but-unused so a refresh can allocate it without a
collision check.

## security

- auth_mode_relevance: LOGIN_FORM, OAUTH2, LDAP
  notes: |
    The component is a UI surface reached only after the app shell has
    authenticated the user under one of the three real modes (or under
    DISABLED, where the platform's documented stance opens all paths — per the
    backend DataSourceController class sidecar). The card has no auth-mode
    branch of its own; it consumes the resolved permission set via
    `usePermissions`. Listed as the three real modes because those are when the
    `WithPermissions` gating is load-bearing.
- ingestion_filter_relevance: "N/A — not an HTTP endpoint; a React component. The ingestion S2S filter has no bearing here."
- authorization_assertions:
  - "`<WithPermissions permissionTo={Permission.DATA_SOURCE_UPDATE}>` wraps the Edit control — the control renders only if `usePermissions().hasAccessTo(DATA_SOURCE_UPDATE)` is true. — evidence: DataSourceItem.tsx:44 + WithPermissions.tsx:17,27-29"
  - "`<WithPermissions permissionTo={Permission.DATA_SOURCE_DELETE}>` wraps the Delete control — same model. — evidence: DataSourceItem.tsx:57 + WithPermissions.tsx:17,27-29"
- owner_scoping: "N/A — the card is not data-scoped. It renders whatever `dataSource` the parent list passes. `DATA_SOURCE_UPDATE`/`DATA_SOURCE_DELETE` are MANAGEMENT-tier permissions (per the backend sidecars) — not per-owner — so a user with the permission can edit/delete ANY data source's card, consistent with the backend."
- data_exposure:
  - "The card exposes a data source's full metadata (name, ODDRN, description, namespace) to any user who can reach the Datasources route. The ODDRN is rendered verbatim in an `AppTooltip` (DataSourceItem.tsx:87)."
  - "The connection token VALUE is rendered into the DOM whenever `dataSource.token?.value` is truthy (DataSourceItem.tsx:95-109). Masking is the `******`-prefix convention; an unmasked token (after Regenerate) is shown in plaintext alongside a Copy button and the 'Save token in a secure location' warning. The token visibility is NOT permission-gated at this component — only the Regenerate ACTION is (in the child). A user who can view the Datasources page sees token values for every source. Whether that is intended is a feature-level question for concept-merger; recorded here as the per-card observation."
- known_security_gaps:
  - "Token VALUE rendering is not behind a permission gate — only the Edit/Delete/Regenerate ACTIONS are. Any user reaching the Datasources route sees every data source's token value (masked or, post-regenerate, plaintext). If the threat model intends token values to be visible only to source-managers, this card leaks them to all viewers. — evidence: DataSourceItem.tsx:95-109 (token block has no WithPermissions wrap) + DataSourceItemToken.tsx:33-34 — severity: MEDIUM"
  - "The 400-on-attached-entities error toast surfaces the raw backend message verbatim (`errorHandling.tsx:48-68`). The backend `CascadeDeleteException` message ('there are still data entities attached') is benign, but the pattern means any future backend error string reaches the operator unfiltered — a minor information-shaping concern, not an active leak. — evidence: handleResponseThunk.ts:34-42 + errorHandling.tsx:48-68 — severity: LOW"

## performance

- hot_paths:
  - "Not a hot path — the card is rendered once per data source in a paginated management list (the parent fetches a page via `fetchDataSourcesList`). Render cost is a small static MUI tree. — evidence: DataSourceItem.tsx:33-124"
- throughput_characteristics:
  - "One `deleteDataSource` dispatch per confirmed delete; no batching, no bulk-delete control on the card. The card itself issues no fetch. — evidence: DataSourceItem.tsx:31"
- resource_allocation:
  - "Minimal — one `useState` (`isHidden`) and one `useTranslation` hook per card. The `DataSourceForm` and `ConfirmationDialog` modal subtrees are mounted as part of the card tree but their dialog content renders only when opened (DialogWrapper-gated). — evidence: DataSourceItem.tsx:25-32,45-74"
- scaling_characteristics:
  - "The card scales linearly with the page size of the Datasources list — N cards for N data sources on the current page. There is no virtualization at this component; list-level pagination (the parent's concern) bounds N. Each card eagerly constructs its `DataSourceForm` and two `ConfirmationDialog` element trees, so a large page size multiplies that construction cost — a list-level, not card-level, scaling note. — evidence: DataSourceItem.tsx:45-74"
- known_performance_gaps:
  - "Each card constructs a full `DataSourceForm` (with its `useForm`, selectors, and `useEffect`) and a `ConfirmationDialog` even before the operator opens either modal (DataSourceItem.tsx:45-74). On a large Datasources page this is N form instances mounted. Severity: LOW (the Datasources list is typically small — tens of sources — and the forms are cheap; recorded as a list-scaling note, not a current problem). — evidence: DataSourceItem.tsx:45-74 + DataSourceForm.tsx:50-63 — severity: LOW"

## upstream_callers

- entry_point: "ui_route:/management/datasources (Datasources management tab)"
  caller_node: "ts react-component:datasources-list (the Datasources-list view that maps the fetched page to one DataSourceItem per data source)"
  multiplicity_per_trigger: "N — one DataSourceItem rendered per data source on the current list page"
  evidence: "DataSourceItem.tsx:21-25 — the component takes a single `dataSource` prop and is therefore instantiated once per source by the list; the list node is referenced as `unresolved` in F-031's chain (LSN-023) and is not yet enriched."
  observation_class: ui-call
  unresolved: true   # the parent datasources-list view node is not yet enriched

## downstream_side_effects

- side_effect_class: external-call
  description: "On confirmed Delete, dispatches `deleteDataSource` -> `DELETE /api/datasources/{data_source_id}`. The user-observable consequence: a backend soft-delete (HTTP 204) OR an HTTP 400 cascade-block."
  evidence: "DataSourceItem.tsx:31 + datasources.thunks.ts:79-95"
  cardinality_per_call: "1 DELETE request per confirmed delete"
  reachable_from_entry_points:
    - "ui_route:/management/datasources"
- side_effect_class: page-render
  description: "On a successful delete, the deleted data source's id is returned by the thunk and a reducer drops it from the store, so this card UNMOUNTS from the list. On a failed delete (400) the card stays and the ConfirmationDialog stays open."
  evidence: "datasources.thunks.ts:84-87 (returns dataSourceId on success) + ConfirmationDialog.tsx:28-34 (handleClose only in .then)"
  cardinality_per_call: "1 card unmount on success; 0 on failure"
  reachable_from_entry_points:
    - "ui_route:/management/datasources"
- side_effect_class: page-render
  description: "Shows a global toast — 'Datasource successfully deleted.' (success) or a generic error toast carrying the raw backend message (failure). The toast is the operator's only feedback channel for the delete outcome."
  evidence: "datasources.thunks.ts:90-93 (setSuccessOptions) + handleResponseThunk.ts:28-42 + errorHandling.tsx:40-68"
  cardinality_per_call: "1 toast per delete outcome"
  reachable_from_entry_points:
    - "ui_route:/management/datasources"
- side_effect_class: external-call
  description: "REFERENCE — clicking Edit then Save dispatches `updateDataSource` -> `PUT /api/datasources/{id}`; this side effect originates inside the child `DataSourceForm` (DataSourceForm.tsx:69-81), not in DataSourceItem. Recorded so the chain resolves when DataSourceForm is enriched."
  evidence: "DataSourceItem.tsx:45-55 (mounts DataSourceForm in edit mode) + DataSourceForm.tsx:69-81"
  cardinality_per_call: "1 PUT per Save in the Edit modal — owned by DataSourceForm"
  reachable_from_entry_points:
    - "ui_route:/management/datasources"
- side_effect_class: external-call
  description: "REFERENCE — the token Copy / Regenerate side effects originate in the child `DataSourceItemToken` (Regenerate dispatches `regenerateDataSourceToken` -> `POST /api/datasources/{id}/token/regenerate`; Copy writes to the clipboard). Recorded so the chain resolves when DataSourceItemToken is enriched."
  evidence: "DataSourceItem.tsx:103-107 (mounts DataSourceItemToken) + DataSourceItemToken.tsx:29-30,52"
  cardinality_per_call: "owned by DataSourceItemToken"
  reachable_from_entry_points:
    - "ui_route:/management/datasources"

## coherence_notes

- kind: strengthens
  target: "odd-platform java DataSourceController controller-method:deleteDataSource"
  note: |
    The backend `deleteDataSource` sidecar correctly recorded the server half:
    HTTP 400 `CascadeDeleteException` when live data_entity children exist, and
    a `DRIFT_NAME_VS_BEHAVIOR` because 'delete' is a guarded soft-delete. This
    UI sidecar STRENGTHENS that finding with the user-facing half it could not
    see: the `DataSourceItem` card gives the operator NO forewarning of the
    cascade-block (the ConfirmationDialog has no `additionalContent` warning),
    surfaces the 400 as a GENERIC error toast carrying the raw backend string
    (`errorHandling.tsx:48-68`), and — critically — the `ConfirmationDialog`
    swallows the rejection (`.catch(() => {})`, ConfirmationDialog.tsx:33) so
    the modal stays open with `isLoading` never reset. The backend sidecar's
    `name_behavior_pairs` operator-visible consequence ("an operator clicking
    Delete gets HTTP 400, not a deletion") is now confirmed end-to-end: the
    operator sees a stuck modal + a jargon toast. The composed UI->backend
    flow is the load-bearing fact for F-031's Data Source Lifecycle feature.
- kind: refines
  target: "odd-platform java DataSourceController controller-method:deleteDataSource"
  note: |
    The backend sidecar's doc-drift finding noted the Management page documents
    none of the delete preconditions. This UI sidecar REFINES the impact: the
    operator cannot recover the situation from the product either — there is no
    in-card hint, no disabled-with-tooltip Delete state, and no pre-flight
    cascade check (the UI has no client-side equivalent of
    `existsNonDeletedByDataSourceId`). The doc gap and the UI gap compound: the
    operator has neither documentation nor in-product guidance telling them to
    soft-delete the entities (or stop the collector) first.
- kind: relates-to
  target: "odd-platform java DataSourceController controller-method:updateDataSource"
  note: |
    The Edit control on this card opens `DataSourceForm` in edit mode, whose
    Save dispatches `updateDataSource` -> the endpoint the updateDataSource
    sidecar enriched. The UI-side fact this sidecar contributes: the ODDRN
    input is `disabled` in edit mode (DataSourceForm.tsx:120), so the UI never
    sends a changed ODDRN on a PUT — relevant to any updateDataSource analysis
    of which fields are mutable. (The DataSourceForm node itself is the proper
    owner of that detail and is enriched separately in this batch.)
- kind: relates-to
  target: "odd-platform java DataSourceController controller-method:getDataSourceList"
  note: |
    `DataSourceItem` is the per-row renderer for the page that
    `getDataSourceList` (GET /api/datasources) serves. Every `DataSource` DTO
    field the card renders (name, oddrn, description, namespace, token) is a
    field that list response must carry. The card consuming `token.value`
    (DataSourceItem.tsx:95) means the list endpoint returns token values for
    every source on the page — relevant to that endpoint's data-exposure
    analysis.

## sources

- understanding ← DataSourceItem.tsx:25-124 + WithPermissions.tsx:27-29 + datasources.thunks.ts:79-95
- concepts.entities ← DataSourceItem.tsx:1-23 (imports + props)
- concepts.operations ← DataSourceItem.tsx:31,35-121
- concepts.invariants (permission gating) ← DataSourceItem.tsx:44-75 + WithPermissions.tsx:27-29
- concepts.invariants (isHidden ownership) ← DataSourceItem.tsx:29,110 + DataSourceItemToken.tsx:25-27
- dependencies_semantic.requires-feature.deleteDataSource ← datasources.thunks.ts:79-95
- dependencies_semantic.requires-feature.DataSourceForm ← DataSourceItem.tsx:45-55 + DataSourceForm.tsx:29-32,85
- dependencies_semantic.requires-feature.ConfirmationDialog ← DataSourceItem.tsx:58-74 + ConfirmationDialog.tsx:16-79
- tests_coverage_semantic ← Glob `odd-platform-ui/src/components/Management/DataSourcesList/**/*.{test,spec}.{ts,tsx}` (no files this session)
- docs_link_semantic.inferred_docs[0] ← WebFetch https://docs.opendatadiscovery.org/features/management (2026-05-22, status 200)
- docs_link_semantic.doc_drift_findings ← WebFetch (2026-05-22) + odd-platform__java__DataSourceController__controller-method__deleteDataSource.md + DataSourceForm.tsx:120
- implicit_adrs[0] ← DataSourceItem.tsx:44-75 + WithPermissions.tsx:27-29
- implicit_adrs[1] ← DataSourceItem.tsx:58-74
- implicit_adrs[2] ← DataSourceItem.tsx:110-121
- bugs_limitations_corner_cases.delete-no-forewarning ← DataSourceItem.tsx:31,58-74 + ConfirmationDialog.tsx:25-35 + handleResponseThunk.ts:34-42 + errorHandling.tsx:48-68
- bugs_limitations_corner_cases.isHidden-ownership ← DataSourceItem.tsx:29,110 + DataSourceItemToken.tsx:25-27
- bugs_limitations_corner_cases.onDelete-no-feedback ← DataSourceItem.tsx:31
- bugs_limitations_corner_cases.no-pre-flight-check ← DataSourceItem.tsx:57-75
- stress_findings.name_behavior_pairs ← DataSourceItem.tsx:31,45-74 + datasources.thunks.ts:79-95 + DataSourceForm.tsx:85,120
- stress_findings.auth_gates ← DataSourceItem.tsx:44-75 + WithPermissions.tsx:17,27-29
- stress_findings.resource_boundaries ← DataSourceItem.tsx:31 + ConfirmationDialog.tsx:24-35 + datasources.thunks.ts:79-95
- stress_findings.request_inputs ← DataSourceItem.tsx:21-25,29,31,104-106 + DataSourceItemToken.tsx:25-27
- security.authorization_assertions ← DataSourceItem.tsx:44,57 + WithPermissions.tsx:17,27-29
- security.data_exposure ← DataSourceItem.tsx:87,95-109 + DataSourceItemToken.tsx:33-34
- security.known_security_gaps.token-not-gated ← DataSourceItem.tsx:95-109 (no WithPermissions wrap on token block)
- performance ← DataSourceItem.tsx:33-124 + DataSourceForm.tsx:50-63
- upstream_callers ← DataSourceItem.tsx:21-25 (single-prop component → one instance per source)
- downstream_side_effects ← DataSourceItem.tsx:31,45-55,103-107 + datasources.thunks.ts:79-95 + ConfirmationDialog.tsx:28-34
- coherence_notes ← odd-platform__java__DataSourceController__controller-method__{deleteDataSource,updateDataSource,getDataSourceList}.md + DataSourceForm.tsx:120

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: HIGH
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH
- security: MEDIUM
- performance: HIGH
- upstream_callers: MEDIUM
- downstream_side_effects: MEDIUM
- stress_findings: MEDIUM

Overall MEDIUM: the component's structure and the static control-flow of the
delete path are HIGH-confidence and fully anchored — including the load-bearing
finding that the `ConfirmationDialog` swallows the 400 rejection and never
recovers (`ConfirmationDialog.tsx:33`, statically certain). MEDIUM overall
because the four operator-observable claims routed through PROBE-NEEDED — the
exact rendered toast/dialog state after the 400 (P-078), the double-confirm
guard (P-079), and the wrong-role card render (P-080) — are strongly evidenced
from code but finally pinned only when the headless-browser probes run.
`upstream_callers` is MEDIUM because the parent `datasources-list` view is not
yet enriched (recorded `unresolved: true`); `downstream_side_effects` is MEDIUM
because two side effects are REFERENCE entries owned by the not-yet-enriched
`DataSourceForm` and `DataSourceItemToken` siblings; `security` is MEDIUM
because the token-visibility-not-gated finding is a per-card observation whose
intended-vs-bug status is a feature-level (concept-merger) call.

## Maintainer notes

(none)
