---
node_id: "odd-platform ts react-component component:DataSourceForm"
node_kind: react-component
axis: ui-components
extracted_at_commit: 80637ed
enriched_at_commit: 80637ed
extractor_version: 0.1.0
prompt_version: file-analyser/0.5.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-22-datasource-ui-reanalysis-DataSourceForm
---

# DataSourceForm — the "Add datasource" / "Edit datasource" modal — semantic understanding

## understanding

`DataSourceForm` is the modal dialog an operator uses to register a new data
source or edit an existing one, reached from the Management → Datasources tab.
A trigger element (`btnCreateEl` — the "+ Add datasource" button on create, a
row "edit" control on edit) opens the dialog; the dialog presents four fields —
**Name** (required, asterisk-marked), **ODDRN** (required, asterisk-marked,
disabled when editing an existing source), **Namespace** (a select-or-create
combo-box rendered by `NamespaceAutocomplete`), and **Description** (free text,
optional) — plus a single full-width **Save** button. The component is mode-aware
from one prop: when `dataSource` is supplied it titles itself "Edit datasource"
and on submit dispatches `updateDataSource` (PUT); when `dataSource` is absent it
titles itself "Add datasource" and dispatches `registerDataSource` (POST). The
Save button is disabled until `react-hook-form` reports the form valid (`mode:
'all'`), success closes the modal and shows a green toast, and the modal asks
"Are you sure you want to close this form?" if the operator dismisses it
mid-edit (`confirmOnClose`).

## concepts

- entities:
  - "DataSourceFormData (the react-hook-form form shape on create — generated from the OpenAPI schema; fields name/oddrn/namespaceName/description — components.yaml:1303-1315)"
  - "DataSourceFormDataValues (a local type alias exported for NamespaceAutocomplete's prop typing — DataSourceForm.tsx:25-27 — re-types pullingInterval, a field the UPSTREAM OpenAPI DataSourceFormData does not carry; see bugs_limitations_corner_cases)"
  - "DataSource (the optional `dataSource` prop — present in edit mode, absent in create mode; its presence is the create-vs-edit discriminator — DataSourceForm.tsx:22,70)"
  - "NamespaceAutocomplete (the combo-box rendered for the Namespace field — DataSourceForm.tsx:124-129; a select-or-create control reused ~7× across the UI)"
  - "DialogWrapper (the modal shell that owns open/close state, the confirm-on-close prompt, and the loading bar — DataSourceForm.tsx:157-170)"
  - "registerDataSource / updateDataSource (the two redux thunks the form dispatches — DataSourceForm.tsx:6,71-77)"
- operations:
  - "open-form — the trigger element (btnCreateEl) is cloned with an onClick that opens the DialogWrapper (DataSourceForm.tsx:159-161)"
  - "edit-vs-create branch — onSubmit dispatches updateDataSource when `dataSource` is set, else registerDataSource (DataSourceForm.tsx:69-81)"
  - "validate — Name and ODDRN are required and rejected if blank-after-trim; the Save button is disabled while `isValid` is false (DataSourceForm.tsx:98-101,110-113,153)"
  - "submit — handleSubmit(onSubmit) serialises the four fields and dispatches the thunk; `.then(clearState)` resets the form afterwards (DataSourceForm.tsx:69-81,90)"
  - "reset-on-prop-change — a useEffect resets the form to default values whenever the `dataSource` prop identity changes (DataSourceForm.tsx:61-63)"
- invariants:
  - "Create-vs-edit is decided ENTIRELY by whether the `dataSource` prop is truthy — there is no explicit mode flag (DataSourceForm.tsx:70,85,165-166)"
  - "ODDRN is editable on create and DISABLED on edit — `disabled={!!dataSource?.oddrn}` (DataSourceForm.tsx:120); the identity string of an existing data source cannot be changed through this form"
  - "Name and ODDRN are blank-rejected: `validate: value => !!value.trim()` — a string of only whitespace fails validation even though `required: true` alone would pass it (DataSourceForm.tsx:100,112)"
  - "The Namespace field has NO `required` rule and NO validate rule — an empty namespace is a valid submission (DataSourceForm.tsx:124-129)"
  - "The Description field has NO validation — any value (including empty) submits (DataSourceForm.tsx:130-142)"
  - "The form submits whatever the four Controllers hold as ONE flat `data` object straight to the thunk — there is no field renaming, no client-side transform (DataSourceForm.tsx:69-81)"
- audiences:
  - "platform-operator — registers or edits a data source through the Management → Datasources tab; this modal is the entire create/edit surface (the '+ Add datasource' button is documented on the live Management doc page, inherited from the registerDataSource backend sidecar, WebFetched 2026-05-21 status 200)"

## dependencies_semantic

- requires-feature:
  - "registerDataSource thunk (datasources.thunks.ts:34-47) → DataSourceApi.registerDataSource → POST /api/datasources — the create path"
  - "updateDataSource thunk (datasources.thunks.ts:49-62) → DataSourceApi.updateDataSource → PUT /api/datasources/{id} — the edit path"
  - "NamespaceAutocomplete (NamespaceAutocomplete.tsx:36-181) — renders the Namespace field as a debounced select-or-create combo-box; submits the chosen-or-typed namespace as a plain string into the `namespaceName` field"
  - "DialogWrapper (DialogWrapper.tsx:32-157) — owns modal open/close, the confirm-on-close secondary dialog, the indeterminate progress bar, and the auto-close-on-success effect"
  - "react-hook-form `useForm` (DataSourceForm.tsx:50-59) — `mode: 'all'` + `reValidateMode: 'onChange'` drive the live validity that gates the Save button"
  - "getDatasourceCreatingStatuses / getDatasourceUpdatingStatuses selectors (datasources.selectors.ts:16,20) — supply isLoading (drives the modal progress bar) and isLoaded (drives auto-close on success)"
  - "Asterisk styled-component (DataSourceForm.tsx:18,92) — renders the required-field `*` marker"
- requires-config:
  - "N/A — this is a UI component; it reads no application.yml key. Its behaviour shifts only with the backend it calls (the backend's auth.type / RBAC gate is what decides whether the POST/PUT it issues succeeds)."
- requires-runtime:
  - "React + redux (useAppDispatch / useAppSelector — DataSourceForm.tsx:34-38) — the dispatch + status-selector wiring"
  - "react-i18next `useTranslation` — every label (Name, Description, Save, the titles, the required-field sentence) is run through `t(...)` (DataSourceForm.tsx:33,85,103,148)"
  - "The generated `DataSourceApi` client and a reachable odd-platform-api backend — the thunks call the generated client; without the backend the form's submit rejects"
- coupling:
  - "Coupled to the OpenAPI-generated `DataSourceFormData` type — `getDefaultValues` (DataSourceForm.tsx:40-48) and the four `Controller name=` props are typed against it; an OpenAPI schema change to DataSourceFormData propagates here through the generated type."
  - "Coupled to NamespaceAutocomplete via a SHARED TYPE EXPORT — `DataSourceFormDataValues` is exported from this file (DataSourceForm.tsx:25) purely so NamespaceAutocomplete.tsx:21,31 can type its `controllerProps`. A circular-feeling import: the form imports the component, the component imports the form's type."
  - "Coupled to the redux thunk's response contract — `onSubmit`'s `.then()` (DataSourceForm.tsx:78-80) assumes the dispatch promise always resolves; it does (handleResponseAsyncThunk catches and rejectWithValue's — it never re-throws), so `.then()` runs on success AND failure (see bugs_limitations_corner_cases)."

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - behaviour: "Create mode: opening the modal with no `dataSource` titles it 'Add datasource', and a complete submit dispatches registerDataSource (POST) once."
    test_class: integration
    criticality: HIGH
    note: "No DataSourceForm.test.* found (Glob — see test_files)."
  - behaviour: "Edit mode: opening with a `dataSource` titles it 'Edit datasource', pre-fills the four fields from the prop, disables ODDRN, and a submit dispatches updateDataSource (PUT) once."
    test_class: integration
    criticality: HIGH
  - behaviour: "Save button is disabled while Name or ODDRN is blank/whitespace-only, and enabled once both are non-blank."
    test_class: unit
    criticality: HIGH
    note: "The `validate: value => !!value.trim()` rule + `disabled={!isValid}` — the core gating invariant."
  - behaviour: "Namespace select-or-create: choosing an existing namespace submits its name; typing an unknown name and picking the 'Create new custom namespace' suggestion submits that string; an empty namespace submits with namespaceName=''."
    test_class: integration
    criticality: HIGH
    note: "The LSN-023 affordance — the user-facing half of the backend get-or-create. Probe P-074."
  - behaviour: "On success the modal auto-closes (handleCloseSubmittedForm flips to the isLoaded selector) and a green success toast appears."
    test_class: integration
    criticality: MEDIUM
  - behaviour: "On a backend rejection (e.g. 400 ODDRN collision) the modal does NOT stay open with a field error — it closes via `.then(clearState)` and the only error feedback is the global server-error toast."
    test_class: integration
    criticality: HIGH
    note: "Operator-visible defect class — probe P-075. The form has no errorText wiring; the rejected dispatch still runs `.then()`."
  - behaviour: "Editing only the Name (leaving Description blank in the modal) submits a body that nulls description server-side (REPLACE-not-MERGE on the PUT path)."
    test_class: integration
    criticality: HIGH
    note: "Cross-references the updateDataSource backend sidecar's P-043 — the partial-edit data-loss class is reachable FROM this modal. Probe P-076."
- test_files:
  - "No `DataSourceForm.test.*` / `DataSourceForm.spec.*` exists — Glob `odd-platform-ui/src/components/Management/DataSourcesList/DataSourceForm/**` returned only `DataSourceForm.tsx` (no sibling test file)."
- gaps: |
    The modal has zero direct test coverage. The worst-covered class is
    `integration`: nothing asserts the create-vs-edit dispatch branch, nothing
    asserts the auto-close-on-success path, and — the highest-leverage gap —
    nothing asserts what the operator sees when the backend REJECTS the submit.
    Because `handleResponseAsyncThunk` resolves the dispatch promise even on
    failure, the form's `.then(clearState)` closes the modal on a 400/404 just
    as it does on success; the operator's only signal that the registration
    failed is a transient red toast, and any field values they typed are gone.
    An integration test across the modal + thunk + a mocked-400 backend would
    catch this. The second gap is the partial-edit / REPLACE-not-MERGE hazard:
    an operator who opens "Edit datasource" to change only the name does not
    see that leaving Description untouched in the modal will null it on the
    PUT — that is the updateDataSource backend sidecar's P-043 class, reachable
    straight from this UI.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/management"
    anchor: ""
    rationale: "The canonical doc page for the Management → Datasources tab — the surface this modal lives on. Inherited at status 200 from the registerDataSource backend sidecar (WebFetched 2026-05-21, within the 11-day stale-probe window); no separate fetch this session because the backend sidecar's fetched excerpts already establish what the page does and does not say about the create/edit flow."
    last_verified_at: "2026-05-21T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
    fetched_excerpts: |
      Inherited verbatim from `odd-platform__java__DataSourceController__controller-method__registerDataSource.md` (docs_link_semantic.inferred_docs[0], WebFetched 2026-05-21 status 200): "+ Add datasource button at the top-right is the entry-point for registering a source." And: "add, edit, or remove a piece of catalog configuration" (inherited from the updateDataSource backend sidecar). The page documents the '+ Add datasource' affordance and the edit action but documents NO field-level detail of this modal — not the Name/ODDRN required markers, not that the Namespace field is a select-or-create combo-box, not that editing replaces (rather than merges) the description.
- doc_drift_findings:
  - "The live Management page describes the '+ Add datasource' affordance but does not document the modal's field set, its required-field markers, or — load-bearing — that the Namespace field is a select-or-create combo-box. An operator reading the docs cannot learn from them that they can create a namespace inline while registering a data source."
  - "The Management page does not warn that editing a data source is a full-form REPLACE: an operator who edits only the Name and leaves the Description field empty in the modal will null the stored description (the updateDataSource backend sidecar's REPLACE-not-MERGE finding). The UI gives no warning either."

## implicit_adrs

- "The Namespace field is a deliberate select-or-create combo-box, not a plain select — the operator picks an existing namespace OR creates one inline through a labelled suggestion" — evidence: DataSourceForm.tsx:124-129 (the Namespace field renders `NamespaceAutocomplete`) + NamespaceAutocomplete.tsx:74-89 (`getFilterOptions` appends `{ name: params.inputValue }` as an extra option when the typed text matches no existing namespace) + NamespaceAutocomplete.tsx:165-177 (`renderOption` shows that synthetic option through `AutocompleteSuggestion`) + AutocompleteSuggestion.tsx:24-29 (renders the literal text `No result. Create new custom namespace "X"`) — intent_anchor: the `AutocompleteSuggestion` component renders a deliberate, labelled `Create new {optionLabel} "{optionName}"` affordance, and the option is shown ONLY when `!options.some(option => option.name === params.inputValue)` (NamespaceAutocomplete.tsx:81) — the create path is an intentional, visible UX branch with its own label and its own `option.id ? name : <AutocompleteSuggestion>` render fork. — confidence: HIGH
- "Create-vs-edit is encoded as one optional prop, not two components or a mode enum — the same modal serves both lifecycles" — evidence: DataSourceForm.tsx:22 (`dataSource?: DataSource` — optional prop) + DataSourceForm.tsx:70,85,165-166 (every mode-dependent branch is a ternary on the truthiness of `dataSource`) — intent_anchor: the title, the dispatched thunk, the `handleCloseSubmittedForm` source selector, and the `isLoading` source selector are ALL `dataSource ? ... : ...` ternaries on the same prop — a consistent single-prop convention deliberately applied across the component rather than a duplicated edit-form. — confidence: HIGH
- "ODDRN is immutable after creation — the field is rendered disabled in edit mode" — evidence: DataSourceForm.tsx:120 (`disabled={!!dataSource?.oddrn}`) + the OpenAPI `DataSourceUpdateFormData` has no `oddrn` field (components.yaml:1317-1325) — intent_anchor: the disabled-binding is coupled to the data source's EXISTING oddrn (`!!dataSource?.oddrn`), and the update DTO deliberately omits `oddrn` entirely — the UI and the API contract agree that a data source's identity string is set once at registration and never edited. — confidence: HIGH
- "Closing a half-filled form requires explicit confirmation — accidental dismissal is guarded" — evidence: DataSourceForm.tsx:168 (`confirmOnClose` passed to DialogWrapper) + DialogWrapper.tsx:64-79 (`handleDialogClose` shows a secondary 'Are you sure you want to close this form?' dialog when `confirmOnClose` is set) — intent_anchor: `confirmOnClose` is an opt-in prop and this form opts in; the DialogWrapper's `handleDialogClose` branches specifically on it to mount a confirmation dialog — a deliberate guard against losing typed input on a stray backdrop click. — confidence: HIGH

## bugs_limitations_corner_cases

- "A backend rejection does not keep the modal open with a field error — the modal closes on failure exactly as on success. `onSubmit` chains `.then(() => clearState())` (DataSourceForm.tsx:78-80) onto the dispatch; `handleResponseAsyncThunk` (handleResponseThunk.ts:34-42) CATCHES the error and `rejectWithValue`s it — it never re-throws — so the dispatch promise RESOLVES even on a 400/404, `.then()` runs, and `clearState()` resets the form. The operator's only failure signal is the transient global server-error toast (showServerErrorToast, handleResponseThunk.ts:38); any values they typed are discarded" — evidence: DataSourceForm.tsx:69-81 (`.then(() => clearState())` with no `.catch` and no rejection check) + handleResponseThunk.ts:34-42 (catch → showServerErrorToast → rejectWithValue, no re-throw) + DataSourceForm.tsx:24 (DialogWrapper is given no `errorText` prop) — severity: HIGH
- "The exported `DataSourceFormDataValues` type (DataSourceForm.tsx:25-27) re-types a `pullingInterval` field, but the OpenAPI `DataSourceFormData` schema has NO `pullingInterval` field (components.yaml:1303-1315 — exactly name/namespace_name/oddrn/description). The form never renders or submits a pulling-interval control. The type alias carries a field the form does not use — dead/aspirational typing that could mislead a future maintainer into thinking the create form has a pulling-interval input" — evidence: DataSourceForm.tsx:25-27 (`Omit<DataSourceFormData, 'pullingInterval'> & { pullingInterval: {...} }`) + components.yaml:1303-1315 (no pullingInterval property) + DataSourceForm.tsx:89-144 (formContent renders only the 4 real fields) — severity: LOW
- "The modal renders no inline/blocking error region — `DialogWrapper` supports an `errorText` prop (DialogWrapper.tsx:24,121-125) and renders it above the action buttons, but `DataSourceForm` never passes one (DataSourceForm.tsx:157-169). Combined with the auto-close-on-failure above, the form has no in-context error surface at all" — evidence: DataSourceForm.tsx:157-169 (DialogWrapper invocation — no `errorText`) + DialogWrapper.tsx:121-125 (the unused errorText render slot) — severity: MEDIUM
- "ODDRN is required by the create form (DataSourceForm.tsx:110-113, `required: true` + non-blank validate) but the OpenAPI `DataSourceFormData` schema marks only `name` as required (components.yaml:1314-1315). The UI is STRICTER than the contract — here the strictness matches backend runtime behaviour (the backend rejects an empty oddrn with HTTP 400 per the registerDataSource sidecar), so the UI requiredness is correct; the drift is the OpenAPI schema understating the requirement, not a UI bug. Recorded so the cross-layer picture is explicit" — evidence: DataSourceForm.tsx:110-113 + components.yaml:1314-1315 + registerDataSource backend sidecar (oddrn required-at-runtime finding) — severity: LOW
- "`oddrn`'s `Controller` carries `shouldUnregister` (DataSourceForm.tsx:108) but the other three do not — when the ODDRN input is `disabled` in edit mode it still mounts (disabled, not unmounted), so `shouldUnregister` does not actually drop the field; the asymmetry has no observable effect here but is an inconsistency a maintainer should not have to puzzle over" — evidence: DataSourceForm.tsx:106-123 (`shouldUnregister` on the oddrn Controller only) — severity: LOW

## stress_findings

```yaml
stress_findings:
  tunables:
    - location: "NamespaceAutocomplete.tsx:52,58"
      name: "searchNamespace page size / debounce wait — `size: 30` and `useDebouncedCallback(..., 500)`"
      value: "size=30, debounce=500ms"
      questions:
        - q: "What at N = 0 / N = 1 namespaces? (empty/single state)"
          a: "With 0 existing namespaces, the autocomplete dropdown shows only the synthetic 'Create new custom namespace' option once the operator types (NamespaceAutocomplete.tsx:78-84). With 1, it shows that one plus the create-suggestion if the typed text differs. The form itself does not break — an empty namespace is a valid submission."
          confidence: STATIC-INFERRED
          evidence: "NamespaceAutocomplete.tsx:74-89 (getFilterOptions) + DataSourceForm.tsx:124-129 (no required rule on the Namespace field)"
        - q: "What at N > 30 namespaces? (the page-size truncation boundary — owned by NamespaceAutocomplete)"
          a: "`searchNamespace({ query, page: 1, size: 30 })` fetches at most 30 namespaces and only ever page 1 — there is no pagination in the combo-box. If more than 30 namespaces match the typed query, namespaces 31+ are NOT shown; the operator who cannot find their namespace in the list will type its exact name and the combo-box will offer 'Create new custom namespace' for a name that ALREADY EXISTS — risking an apparent duplicate. This is a NamespaceAutocomplete-owned behaviour; recorded here because DataSourceForm is one of its ~7 mount sites."
          confidence: REFERENCE
          evidence: "node:odd-platform ts react-component component:NamespaceAutocomplete — the size=30 truncation + the create-suggestion-on-existing-name interaction is that sibling's to fully resolve; NamespaceAutocomplete.tsx:52,81"
        - q: "What does the operator see at each boundary?"
          a: "At the 30-namespace boundary the operator sees a silently-truncated list with no 'more results' indicator (NamespaceAutocomplete renders `options` directly). The 500ms debounce means the operator sees a perceptible pause + a loading state between keystrokes and results (NamespaceAutocomplete.tsx:47,107,163 isLoading)."
          confidence: STATIC-INFERRED
          evidence: "NamespaceAutocomplete.tsx:49-60,106-111,147-149"
  name_behavior_pairs:
    - name: "DataSourceForm — the component name + the `dataSource ? 'Edit datasource' : 'Add datasource'` title"
      promise: "A form to add a data source, or to edit one — and editing one implies changing the fields you choose to change."
      implementation: "DataSourceForm.tsx:69-81 — onSubmit submits the WHOLE four-field `data` object to the thunk. On the edit (PUT) path the backend update is a full-form REPLACE (per the updateDataSource backend sidecar, DataSourceServiceImpl.java:68-83 + MapStruct null-handling): a field left empty in the modal is sent and nulls the column. So 'edit' does NOT mean 'patch the fields I changed' — it means 'replace name+description+namespace with exactly what the modal holds'."
      drift: DRIFT_NAME_VS_BEHAVIOR
      operator_visible_consequence: "An operator opening 'Edit datasource' to fix a typo in the Name, who leaves Description blank in the modal (or whose Description simply was not pre-filled), nulls the stored description on Save. The modal does not warn that a blank field overwrites."
      confidence: STATIC-INFERRED
      evidence: "DataSourceForm.tsx:69-81 + updateDataSource backend sidecar (REPLACE-not-MERGE, probe P-043) — confirmed FROM the UI by P-076"
    - name: "the Namespace field / NamespaceAutocomplete's 'Create new custom namespace' suggestion"
      promise: "Pick a namespace for this data source — and, when nothing matches, the labelled suggestion promises 'this will create a new namespace named X'."
      implementation: "DataSourceForm.tsx:124-129 submits the chosen-or-typed namespace as the plain string `namespaceName`. The backend (registerDataSource / updateDataSource) calls `namespaceService.getOrCreate(namespaceName)` — get-or-create on that string. The UI's labelled 'Create new' suggestion is HONEST: when the operator picks it, the backend does create the namespace. The name and the behaviour AGREE."
      drift: NONE
      operator_visible_consequence: "n/a — the combo-box is a faithful select-or-create control; the labelled suggestion accurately describes the create-on-submit outcome. This is the LSN-023 finding: the backend `getOrCreate` is the implementation of a deliberate, labelled UX affordance — NOT a side-door."
      confidence: STATIC-INFERRED
      evidence: "NamespaceAutocomplete.tsx:74-89,165-177 + AutocompleteSuggestion.tsx:24-29 + registerDataSource backend sidecar (namespaceService.getOrCreate) — see coherence_notes"
  orderings:
    - location: "NamespaceAutocomplete.tsx:74-89 (getFilterOptions — the order options appear in the dropdown)"
      questions:
        - q: "What is the actual ordering at the lowest layer?"
          a: "The Namespace dropdown shows `options` in the order `fetchNamespaceList` returned them (NamespaceAutocomplete.tsx:54-55 sets `options` straight from `namespaceList`); MUI's `createFilterOptions` filter (line 76) preserves input order. The synthetic 'Create new' option, when present, is APPENDED last (`[...options, { name: params.inputValue }]`, line 83). DataSourceForm imposes no ordering of its own — its four FIELDS render top-to-bottom in source order (Name, ODDRN, Namespace, Description — DataSourceForm.tsx:95-142)."
          confidence: STATIC-INFERRED
          evidence: "NamespaceAutocomplete.tsx:54-55,76,83 + DataSourceForm.tsx:95-142"
        - q: "What is the tie-breaker when sort-key values are equal?"
          a: "n/a — DataSourceForm does no sorting. The namespace list order is the backend `fetchNamespaceList` order (a NamespaceAutocomplete / backend concern, not this node's)."
          confidence: REFERENCE
          evidence: "node:odd-platform ts react-component component:NamespaceAutocomplete"
        - q: "Which subset is returned when result-set > page size?"
          a: "The namespace dropdown shows at most the first 30 (size=30, page 1 — see tunables). The four form fields are a fixed set of 4; no paging applies."
          confidence: STATIC-INFERRED
          evidence: "NamespaceAutocomplete.tsx:52 + DataSourceForm.tsx:95-142"
        - q: "Does any upstream layer re-sort or filter the result?"
          a: "No — DataSourceForm renders NamespaceAutocomplete directly and applies no wrapper sort/filter. The form-field order is fixed in JSX."
          confidence: STATIC-INFERRED
          evidence: "DataSourceForm.tsx:124-129"
  auth_gates:
    - location: "DataSourceForm.tsx (whole component) — a UI component carries no auth gate of its own"
      endpoint: "the modal — dispatches POST /api/datasources or PUT /api/datasources/{id}"
      questions:
        - q: "What does this surface return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "DataSourceForm has NO client-side permission check — it does not read a Permissions selector, does not conditionally disable Save by RBAC, and does not hide itself. Whether the operator may register/edit is decided ENTIRELY backend-side: the POST is gated by DATA_SOURCE_CREATE and the PUT by DATA_SOURCE_UPDATE (per the registerDataSource / updateDataSource backend sidecars, SecurityConstants.java:116-120). Under LOGIN_FORM/OAUTH2/LDAP a principal lacking the permission gets a 403 from the backend; under DISABLED the backend is open. The form behaves identically in all four modes — it always renders, always lets the operator type and click Save."
          confidence: STATIC-INFERRED
          evidence: "DataSourceForm.tsx:1-173 (no Permissions/RBAC import or check) + registerDataSource backend sidecar (auth_gates) + updateDataSource backend sidecar (auth_gates)"
        - q: "What does an unauthenticated caller see?"
          a: "An unauthenticated user never reaches this modal — the whole odd-platform UI is behind the auth-mode login under LOGIN_FORM/OAUTH2/LDAP. If the modal IS reached and the session is invalid, the dispatched POST/PUT is rejected by the backend filter chain and the operator sees the global server-error toast (with the form closing per the bugs finding)."
          confidence: STATIC-INFERRED
          evidence: "DataSourceForm.tsx:69-81 + handleResponseThunk.ts:34-42 (server-error toast on rejection)"
        - q: "What does a wrong-role caller see?"
          a: "A logged-in operator WITHOUT DATA_SOURCE_CREATE/UPDATE sees the modal render fully, types into the fields, clicks an ENABLED Save (the button's `disabled` depends only on form validity, not permission — DataSourceForm.tsx:153), and only THEN gets a 403-driven red toast while the modal closes. The permission failure is discovered late, after the operator has done the work — a UX defect rather than a security hole (the backend does enforce)."
          confidence: STATIC-INFERRED
          evidence: "DataSourceForm.tsx:146-155 (Save disabled only by !isValid) + handleResponseThunk.ts:34-42"
        - q: "Where does the gate live — controller, service, repository, or nowhere?"
          a: "Nowhere in this UI component. The gate lives entirely backend-side in SecurityConstants.SECURITY_RULES (DATA_SOURCE_CREATE / DATA_SOURCE_UPDATE) — see the two backend sidecars. The UI is fail-open by omission: it shows the affordance to everyone and lets the backend reject."
          confidence: STATIC-INFERRED
          evidence: "DataSourceForm.tsx:1-173 + registerDataSource/updateDataSource backend sidecars (SecurityConstants.java:116-120)"
  resource_boundaries:
    - location: "DataSourceForm.tsx:69-81 (onSubmit) + 146-155 (the Save button)"
      kind: idempotency
      questions:
        - q: "Can two simultaneous submits produce corrupted state?"
          a: "Double-click on Save: the button's `disabled` depends only on `isValid` (DataSourceForm.tsx:153) — it is NOT disabled by `isLoading`. So a fast double-click before the first dispatch resolves can fire TWO POSTs. On the create path the backend's data_source ODDRN partial-unique index serialises them — the second POST gets a 400 (per the registerDataSource backend sidecar's concurrency analysis) — so the worst case is a confusing red toast, not two data sources. The DialogWrapper progress bar (isLoading) gives a visual cue but does not block the button."
          confidence: STATIC-INFERRED
          evidence: "DataSourceForm.tsx:146-155 (Save `disabled={!isValid}` — no isLoading guard) + 166 (isLoading drives only the DialogWrapper progress bar) + registerDataSource backend sidecar (ODDRN unique-index serialisation)"
        - q: "Is the submit replay-safe?"
          a: "On the create path, NO — a replayed identical submit collides on the ODDRN unique index → 400 (or, with a different ODDRN, creates a second data source). On the edit path the PUT is idempotent (same body → same row state). There is no client-supplied idempotency key. This mirrors the backend sidecars' replay-safety findings."
          confidence: STATIC-INFERRED
          evidence: "DataSourceForm.tsx:69-81 + registerDataSource backend sidecar (replay-safety) + updateDataSource backend sidecar"
        - q: "If a cache fronts this, what is the TTL / eviction / staleness window?"
          a: "No cache fronts the form submit. The namespace search dropdown re-fetches on every debounced keystroke (NamespaceAutocomplete.tsx:49-60) — no client-side cache; each open of the combo-box re-queries. N/A for the form itself."
          confidence: STATIC-INFERRED
          evidence: "DataSourceForm.tsx:69-81 + NamespaceAutocomplete.tsx:49-60,106-111"
  request_inputs:
    - location: "DataSourceForm.tsx:95-105 (the `name` Controller)"
      input_kind: body-field
      input_name: "name"
      questions:
        - q: "What does the input NAME promise the caller?"
          a: "The display name of the data source — the label shown as `Name` with a required `*` marker."
          confidence: STATIC-INFERRED
          evidence: "DataSourceForm.tsx:96,103 (Controller name='name', Input label={t('Name')})"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "react-hook-form holds it under the `name` key; onSubmit (DataSourceForm.tsx:69-81) passes the whole `data` object — including `name` — into registerDataSource/updateDataSource → DataSourceApi → POST/PUT body field `name` → backend `DataSourceMapper.mapForm` → `data_source.name` column (per the registerDataSource backend sidecar)."
          confidence: STATIC-INFERRED
          evidence: "DataSourceForm.tsx:69-81 + datasources.thunks.ts:34-62 + registerDataSource backend sidecar (name field MATCHES)"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — the modal's `name` field flows unrenamed through the thunk to the backend `name` body field to the `name` column."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "DataSourceForm.tsx:96 + registerDataSource backend sidecar"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "n/a — MATCHES."
          confidence: STATIC-INFERRED
          evidence: "DataSourceForm.tsx:96"
        - q: "Is there a field that DOES match the input's name and is NOT being used?"
          a: "NONE — `name` maps straight through."
          confidence: STATIC-INFERRED
          evidence: "DataSourceForm.tsx:95-105"
      routes_to_finding: "n/a — MATCHES"
    - location: "DataSourceForm.tsx:106-123 (the `oddrn` Controller)"
      input_kind: body-field
      input_name: "oddrn"
      questions:
        - q: "What does the input NAME promise the caller?"
          a: "The ODDRN — the Open Data Discovery Resource Name, the data source's globally-unique identity string. Labelled literally `ODDRN` with a required `*` marker; rendered disabled when editing an existing source."
          confidence: STATIC-INFERRED
          evidence: "DataSourceForm.tsx:107,119,120"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "On create, `oddrn` flows in the `data` object to registerDataSource → POST body field `oddrn` → backend trims it and inserts `data_source.oddrn` under a partial-unique index (registerDataSource backend sidecar). On edit the field is DISABLED (DataSourceForm.tsx:120) AND the OpenAPI `DataSourceUpdateFormData` has no `oddrn` — so on the PUT path `oddrn` is not submitted at all."
          confidence: STATIC-INFERRED
          evidence: "DataSourceForm.tsx:106-123 + components.yaml:1310-1311,1317-1325 + registerDataSource backend sidecar"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — `oddrn` maps to the backend `oddrn` field / `oddrn` column. The field is correctly immutable-after-create both in the UI (disabled) and in the contract (absent from the update DTO)."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "DataSourceForm.tsx:120 + components.yaml:1317-1325"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "n/a — MATCHES. (A separate cross-layer note: the create form requires ODDRN while the OpenAPI schema marks it optional — recorded in bugs_limitations_corner_cases; the UI requiredness is correct, the schema understates.)"
          confidence: STATIC-INFERRED
          evidence: "DataSourceForm.tsx:110-113 + components.yaml:1314-1315"
        - q: "Is there a field that DOES match the input's name and is NOT being used?"
          a: "NONE."
          confidence: STATIC-INFERRED
          evidence: "DataSourceForm.tsx:106-123"
      routes_to_finding: "n/a — MATCHES (the optional-in-schema note is in bugs_limitations_corner_cases)"
    - location: "DataSourceForm.tsx:124-129 (the `namespaceName` Controller → NamespaceAutocomplete)"
      input_kind: body-field
      input_name: "namespaceName"
      questions:
        - q: "What does the input NAME promise the caller?"
          a: "The namespace to place this data source in. The field is LABELLED `Namespace` (NamespaceAutocomplete.tsx:160) and is a combo-box: the operator picks an existing namespace OR — when their typed text matches nothing — accepts a labelled 'Create new custom namespace X' suggestion. The field name + label promise BOTH select and create."
          confidence: STATIC-INFERRED
          evidence: "DataSourceForm.tsx:126 (Controller name='namespaceName') + NamespaceAutocomplete.tsx:160 (label 'Namespace') + AutocompleteSuggestion.tsx:24-29 (the 'Create new ... custom namespace' label)"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "NamespaceAutocomplete's `handleOptionChange` (NamespaceAutocomplete.tsx:113-130) calls `onChange(newField?.name || '')` — it submits the chosen-or-typed namespace as a PLAIN STRING into the `namespaceName` form field. onSubmit passes it in `data` to the thunk → POST/PUT body field `namespace_name` → backend `namespaceService.getOrCreate(namespace_name)` (`getByName(name).switchIfEmpty(createByName(name))` per the registerDataSource backend sidecar). So the typed string is resolved-or-created backend-side."
          confidence: STATIC-INFERRED
          evidence: "NamespaceAutocomplete.tsx:113-130,144 + DataSourceForm.tsx:69-81 + registerDataSource backend sidecar (namespaceService.getOrCreate)"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES. This is the load-bearing LSN-023 finding. The field is a DELIBERATE, labelled select-or-create combo-box; the backend `getOrCreate` is the faithful implementation of the 'Create new custom namespace' affordance the operator explicitly clicked. The UI shows the create option ONLY when the typed name matches no existing namespace (NamespaceAutocomplete.tsx:78-84), renders it with an explicit `Create new ... custom namespace \"X\"` label (AutocompleteSuggestion.tsx:24-29), and visually distinguishes it from real options (`option.id ? name : <AutocompleteSuggestion>` — NamespaceAutocomplete.tsx:168-176). The combo-box and the backend agree; there is NO silent translation."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "NamespaceAutocomplete.tsx:74-89,165-177 + AutocompleteSuggestion.tsx:24-29 + registerDataSource backend sidecar — see coherence_notes (supersedes the backend sidecars' 'side-door' framing)"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "n/a — this input MATCHES; it is NOT a silent translation. The one residual operator hazard is NOT a naming drift: if more than 30 namespaces match the typed query, NamespaceAutocomplete fetches only the first 30 (size=30) — a namespace that exists but is past row 30 will not appear, and the operator typing its exact name is offered 'Create new custom namespace' for a name that already exists, risking an apparent-duplicate namespace. That is a NamespaceAutocomplete pagination limitation (recorded under tunables), not a namespaceName field-name drift."
          confidence: STATIC-INFERRED
          evidence: "NamespaceAutocomplete.tsx:52,78-84 + tunables block above"
        - q: "Is there a field that DOES match the input's name and is NOT being used?"
          a: "There is no `namespaceId` field on the create/update form or DTO — namespace selection is name-based only (components.yaml:1303-1325 has no namespace_id). For THIS UI that absence is correct and intended: the combo-box is BUILT to submit a name (NamespaceAutocomplete.tsx:127 `onChange(newField?.name || '')`) precisely so the same control can express both 'pick existing' and 'create new' through one string. An id-based field would break the create-new half of the affordance. The absence is a design consequence of the select-or-create pattern, not a gap."
          confidence: STATIC-INFERRED
          evidence: "components.yaml:1303-1325 + NamespaceAutocomplete.tsx:113-130 — see coherence_notes"
      routes_to_finding: "coherence_notes (supersedes-direction note on the registerDataSource / updateDataSource backend sidecars' 'permission_side_door' framing) + implicit_adrs[0] (the select-or-create UX pattern is an ADR candidate)"
    - location: "DataSourceForm.tsx:130-142 (the `description` Controller)"
      input_kind: body-field
      input_name: "description"
      questions:
        - q: "What does the input NAME promise the caller?"
          a: "A free-text description of the data source. Labelled `Description`, placeholder `Datasource description`, no required marker."
          confidence: STATIC-INFERRED
          evidence: "DataSourceForm.tsx:138,139"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Flows in `data` to the thunk → POST/PUT body field `description` → backend `data_source.description` column. On the PUT path it is part of the full-form REPLACE set."
          confidence: STATIC-INFERRED
          evidence: "DataSourceForm.tsx:69-81 + datasources.thunks.ts:34-62 + updateDataSource backend sidecar (description in the REPLACE set)"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES on field mapping — `description` → `description`. The caveat is behavioural, not a name drift: on the edit path a description left blank in the modal NULLS the stored description (REPLACE-not-MERGE — see name_behavior_pairs). The field name is honest; the surprise is the replace semantics."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "DataSourceForm.tsx:131 + updateDataSource backend sidecar"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "n/a for naming — MATCHES. The replace-on-blank behaviour is captured in name_behavior_pairs (DataSourceForm DRIFT_NAME_VS_BEHAVIOR) and bugs_limitations_corner_cases, not here."
          confidence: STATIC-INFERRED
          evidence: "DataSourceForm.tsx:131"
        - q: "Is there a field that DOES match the input's name and is NOT being used?"
          a: "NONE."
          confidence: STATIC-INFERRED
          evidence: "DataSourceForm.tsx:130-142"
      routes_to_finding: "n/a — MATCHES (replace-semantics caveat is in name_behavior_pairs)"
    - location: "DataSourceForm.tsx:69 (the `data` local parameter of onSubmit)"
      input_kind: local-variable
      input_name: "data"
      questions:
        - q: "What does the input NAME promise the caller?"
          a: "Generic — `data` is the react-hook-form submit payload; the name implies no specific entity."
          confidence: STATIC-INFERRED
          evidence: "DataSourceForm.tsx:69 (`onSubmit = (data: DataSourceFormData)`)"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "`data` is passed WHOLE and UNTRANSFORMED as `dataSourceFormData` (create) or `dataSourceUpdateFormData` (edit) into the thunk (DataSourceForm.tsx:71-77). On the edit path `data` is typed `DataSourceFormData` (4 fields) but submitted as the update payload — the extra `oddrn` field rides along; the generated update DTO / backend ignore unmapped fields, so this is benign but loose typing."
          confidence: STATIC-INFERRED
          evidence: "DataSourceForm.tsx:55,69-77"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "Generic name — no specific entity promised; nothing to drift. Recorded so the audit trail is explicit (Category F fires on every named input)."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "DataSourceForm.tsx:69"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "n/a — generic name."
          confidence: STATIC-INFERRED
          evidence: "DataSourceForm.tsx:69"
        - q: "Is there a field that DOES match the input's name and is NOT being used?"
          a: "NONE — `data` is the form payload, used in full."
          confidence: STATIC-INFERRED
          evidence: "DataSourceForm.tsx:69-77"
      routes_to_finding: "n/a — generic name"
  probes_emitted:
    - probe_id: P-074
      question: "Does the Namespace combo-box submit a chosen existing namespace's name unchanged, and does picking the 'Create new custom namespace' suggestion submit the typed string such that the backend creates that namespace?"
      probe_path: "lineage/odd-platform/probes/P-074.yaml"
    - probe_id: P-075
      question: "When the backend rejects the submit (e.g. HTTP 400 ODDRN collision), does the modal close (discarding typed values) with only a transient toast as feedback, instead of staying open with an inline error?"
      probe_path: "lineage/odd-platform/probes/P-075.yaml"
    - probe_id: P-076
      question: "Opening 'Edit datasource' and changing only the Name, leaving the Description field as-is/blank — does Save null the stored description (REPLACE-not-MERGE reachable from the UI)?"
      probe_path: "lineage/odd-platform/probes/P-076.yaml"
    - probe_id: P-077
      question: "Does a fast double-click on the Save button (before the first dispatch resolves) fire two POST /api/datasources requests, since the button is disabled only by form validity and not by isLoading?"
      probe_path: "lineage/odd-platform/probes/P-077.yaml"
  stress_summary:
    triggers_total: 11
    questions_total: 38
    answers_static_inferred: 34
    answers_probe_needed: 0
    answers_reference: 4
    drift_flags: 1
```

## security

- auth_mode_relevance: LOGIN_FORM | OAUTH2 | LDAP | DISABLED — DataSourceForm is a UI component with NO client-side auth gate of its own. It always renders and always permits typing + Save regardless of auth mode; the gate is entirely backend-side (DATA_SOURCE_CREATE on the POST, DATA_SOURCE_UPDATE on the PUT — see the registerDataSource / updateDataSource backend sidecars). The mode is recorded because the component's net behaviour shifts ONLY through the backend it calls.
- ingestion_filter_relevance: NO — the modal dispatches `/api/datasources` (POST/PUT), the UI admin surface; it has no relationship to the `/ingestion/**` collector path.
- authorization_assertions: [] — the component asserts no permission. Notably it does NOT read a Permissions selector to disable Save for a user lacking DATA_SOURCE_CREATE/UPDATE; the Save button's only `disabled` condition is form validity (DataSourceForm.tsx:153).
- owner_scoping: N/A — a create/edit form; no data is listed or owner-filtered here.
- data_exposure:
  - "On create-success the backend returns the new DataSource WITH a plaintext collector token in the response (per the registerDataSource backend sidecar). DataSourceForm does not display the token (formContent renders only the 4 input fields) and discards the thunk's resolved value — but the token is present in the network response the browser received; a devtools/HAR capture of the POST /api/datasources response taken while this modal was used carries a live secret. The modal neither shows nor warns about this."
- known_security_gaps:
  - "The modal renders the full create/edit affordance to operators who lack DATA_SOURCE_CREATE/DATA_SOURCE_UPDATE — the Save button is enabled by form validity alone (DataSourceForm.tsx:146-155), and the permission failure surfaces only as a post-submit 403 toast. This is a UX defect (work discovered to be wasted only after Save), not a security hole — the backend does enforce the permission" — evidence: DataSourceForm.tsx:146-155 (no Permissions check) + handleResponseThunk.ts:34-42 (post-hoc error toast) — severity: LOW

## performance

- hot_paths:
  - "DataSourceForm is NOT a hot path — it mounts only when an operator opens the modal and submits once. The one repeated network action while the modal is open is the Namespace combo-box's debounced search (NamespaceAutocomplete.tsx:49-60 — one `fetchNamespaceList` per 500ms keystroke burst), and that is owned by NamespaceAutocomplete."
- throughput_characteristics:
  - "One submit dispatches exactly one POST or one PUT (DataSourceForm.tsx:69-81) — single-item; no batch path."
  - "The redux thunks are async/promise-based; the modal's progress bar (DialogWrapper isLoading) reflects the in-flight dispatch."
- resource_allocation:
  - "Per-mount memory is trivial — a 4-field react-hook-form plus the DialogWrapper. The `getDefaultValues` callback and the reset-on-prop-change useEffect (DataSourceForm.tsx:40-63) recompute defaults only when the `dataSource` prop identity changes."
- scaling_characteristics:
  - "Pure client component — no server-side state; scales with the browser, not the platform."
  - "The Save button is NOT disabled while a submit is in flight (only `disabled={!isValid}`, DataSourceForm.tsx:153) — a double-click can issue two concurrent POSTs; the backend ODDRN unique index makes the second a 400 rather than a duplicate (see stress_findings.resource_boundaries / probe P-077)."
- known_performance_gaps:
  - "Save button not guarded by `isLoading` — permits a double-submit; harmless on create (backend unique-index serialises) but produces a confusing second red toast" — evidence: DataSourceForm.tsx:146-155,166 — severity: LOW

## upstream_callers

- entry_point: "ui_route:/management/datasources (Management → Datasources tab — the '+ Add datasource' button)"
  caller_node: "odd-platform ts react-component component:DataSourcesList (the Datasources list view that renders DataSourceForm with the '+ Add datasource' button as btnCreateEl, and per-row 'edit' triggers)"
  multiplicity_per_trigger: 1
  evidence: "DataSourceForm.tsx:20-23 (the `btnCreateEl` prop + optional `dataSource` prop) — the parent supplies the trigger element and, in edit mode, the data source to edit. One trigger click opens one modal; one Save dispatches one thunk. The parent list component is identified by the import shape but not enriched this session."
  observation_class: ui-call
  unresolved: true   # the DataSourcesList parent component node is not yet enriched — REFERENCE per Rule 6

## downstream_side_effects

- side_effect_class: external-call
  description: "Dispatches registerDataSource → POST /api/datasources (create mode) — issues an HTTP POST that, on success, creates a data_source row + a token row + optionally a namespace row server-side."
  evidence: "DataSourceForm.tsx:77 (`dispatch(registerDataSource({ dataSourceFormData: data }))`) + datasources.thunks.ts:34-47"
  cardinality_per_call: "1 per Save in create mode (2 if the operator double-clicks Save before the first resolves — see P-077)"
  reachable_from_entry_points:
    - "ui_route:/management/datasources"
- side_effect_class: external-call
  description: "Dispatches updateDataSource → PUT /api/datasources/{id} (edit mode) — issues an HTTP PUT that REPLACES name/description/namespace on the existing data_source row."
  evidence: "DataSourceForm.tsx:71-76 (`dispatch(updateDataSource({ dataSourceId, dataSourceUpdateFormData: data }))`) + datasources.thunks.ts:49-62"
  cardinality_per_call: "1 per Save in edit mode"
  reachable_from_entry_points:
    - "ui_route:/management/datasources"
- side_effect_class: sse-push
  description: "Shows a global success toast on a resolved submit — 'Datasource X successfully created.' / 'successfully updated.' (the toast text is set by the thunk's setSuccessOptions)."
  evidence: "datasources.thunks.ts:42-46,57-61 (setSuccessOptions) + handleResponseThunk.ts:28-31 (showSuccessToast) — triggered by the dispatch DataSourceForm fires"
  cardinality_per_call: "1 on a successful submit"
  reachable_from_entry_points:
    - "ui_route:/management/datasources"
- side_effect_class: sse-push
  description: "Shows a global server-error toast on a rejected submit (e.g. 400 ODDRN collision, 403 missing permission)."
  evidence: "handleResponseThunk.ts:34-39 (catch → showServerErrorToast) — fired by the thunk DataSourceForm dispatches; DataSourceForm passes no switchOffErrorMessage so the toast is on"
  cardinality_per_call: "1 on a failed submit"
  reachable_from_entry_points:
    - "ui_route:/management/datasources"
- side_effect_class: page-render
  description: "Closes the modal and resets the form after the dispatch settles — runs on BOTH success and failure (the `.then(clearState)` + the DialogWrapper auto-close-on-success effect)."
  evidence: "DataSourceForm.tsx:78-80 (`.then(() => clearState())`) + DataSourceForm.tsx:65-67 (clearState → reset) + DialogWrapper.tsx:81-83 (useEffect closes on handleCloseSubmittedForm change)"
  cardinality_per_call: "1 per settled submit"
  reachable_from_entry_points:
    - "ui_route:/management/datasources"

## coherence_notes

- kind: supersedes
  target: "odd-platform java DataSourceController controller-method:registerDataSource"
  note: |
    The registerDataSource backend sidecar records `namespace_name` as
    `TRANSLATES_SILENTLY` / `DRIFT_INPUT_NAME_VS_IMPLEMENTATION` and routes it to
    a "known_security_gap" — "implicit namespace creation bypasses
    NAMESPACE_CREATE ... escalation by side effect", with the implied fix of a
    `namespace_id` field so the caller SELECTS rather than creates. This UI
    sidecar SUPERSEDES the "side-door" / "escalation by side effect" FRAMING of
    that finding. The `namespace_name → namespaceService.getOrCreate` backend is
    the faithful implementation of `NamespaceAutocomplete` — a DELIBERATE,
    LABELLED select-or-create combo-box (DataSourceForm.tsx:124-129 +
    NamespaceAutocomplete.tsx:74-89,165-177 + AutocompleteSuggestion.tsx:24-29):
    it shows existing namespaces, and offers "Create new custom namespace «X»"
    ONLY when the typed text matches nothing, rendered with an explicit label
    and visually distinct from real options. The create path is what the
    operator explicitly clicked, not a covert side effect. The prescribed fix —
    "add a namespace_id field so the caller SELECTS an existing namespace" —
    would BREAK the create-new half of an intentional, ~7×-reused UX pattern
    (the same NamespaceAutocomplete serves collectors / terms / DEGs / lookup
    tables; OwnerAutocomplete / TagsEditFormAutocomplete are the same pattern).
    The legitimate residue of the backend finding is NOT a "bypass" — it is the
    documentation + RBAC-design questions: (1) should creating-a-namespace-while-
    creating-a-datasource require NAMESPACE_CREATE in addition to
    DATA_SOURCE_CREATE, and (2) the live docs do not mention the inline-create
    affordance. Those are real and worth a backlog item; the "permission
    side-door" / REFACTOR-584 / DOC-GAP-262 framing is not, and this sidecar is
    part of the evidence that retires it (LSN-023).
- kind: supersedes
  target: "odd-platform java DataSourceController controller-method:updateDataSource"
  note: |
    Same correction as above applied to the PUT path: the updateDataSource
    backend sidecar's `namespace_name` analysis inherits the registerDataSource
    "side-door" framing. On the edit path too, `namespace_name` is the submitted
    value of the SAME NamespaceAutocomplete combo-box (DataSourceForm.tsx:124-129
    is shared by create and edit — the `defaultValue={dataSource?.namespace?.name}`
    pre-fills the existing namespace on edit). Picking or typing a namespace and
    having the backend get-or-create it is the intended affordance, not an
    escalation. The genuine edit-path hazard this UI sidecar DOES confirm is
    unrelated to namespaces: the PUT is a full-form REPLACE, so editing only the
    Name nulls a blank Description (the backend sidecar's own P-043 finding) —
    that one is real and is recorded here in name_behavior_pairs + probe P-076.
- kind: refines
  target: "odd-platform java DataSourceController controller-method:registerDataSource"
  note: |
    The registerDataSource backend sidecar's `upstream_callers` records the UI
    caller as `unresolved: true` ("UI thunk node not yet enriched"). This sidecar
    RESOLVES the UI half: the create call originates in `DataSourceForm.onSubmit`
    (DataSourceForm.tsx:69-81), which dispatches the `registerDataSource` thunk
    (datasources.thunks.ts:34-47) → the generated `DataSourceApi.registerDataSource`
    → POST /api/datasources. Multiplicity is 1 per Save (the backend sidecar's
    `multiplicity_per_trigger: 1` is confirmed) — with the caveat that the Save
    button is not isLoading-guarded, so a double-click can produce 2 (probe
    P-077). The OpenAPI `DataSourceFormData` field set the backend sidecar cites
    (name/namespace_name/oddrn/description, components.yaml:1303-1315) is exactly
    the field set this modal renders — confirmed UI-side.

## sources

- understanding ← `odd-platform-ui/src/components/Management/DataSourcesList/DataSourceForm/DataSourceForm.tsx:29-173`
- concepts.entities ← DataSourceForm.tsx:5,22,25-27,124-129,157-170 + `odd-platform-ui/src/redux/thunks/datasources.thunks.ts:34-62`
- concepts.operations ← DataSourceForm.tsx:40-63,69-81,98-101,159-161
- concepts.invariants ← DataSourceForm.tsx:70,85,100,112,120,124-142,165-166
- concepts.audiences ← registerDataSource backend sidecar `docs_link_semantic` (inherited, WebFetched 2026-05-21 status 200)
- dependencies_semantic.requires-feature ← DataSourceForm.tsx:6,8-11,12-18,50-59 + `odd-platform-ui/src/redux/thunks/datasources.thunks.ts:34-62` + `odd-platform-ui/src/components/shared/elements/Autocomplete/NamespaceAutocomplete/NamespaceAutocomplete.tsx:36-181` + `odd-platform-ui/src/components/shared/elements/DialogWrapper/DialogWrapper.tsx:32-157` + `odd-platform-ui/src/redux/selectors/datasources.selectors.ts:16,20`
- dependencies_semantic.coupling ← DataSourceForm.tsx:25,40-48 + NamespaceAutocomplete.tsx:21,31 + DataSourceForm.tsx:78-80 + `odd-platform-ui/src/redux/lib/handleResponseThunk.ts:34-42`
- tests_coverage_semantic.test_files ← Glob `odd-platform-ui/src/components/Management/DataSourcesList/DataSourceForm/**` (only DataSourceForm.tsx returned)
- docs_link_semantic ← inherited from `lineage/odd-platform/understanding/odd-platform__java__DataSourceController__controller-method__registerDataSource.md` docs_link_semantic.inferred_docs[0] (WebFetched 2026-05-21 status 200, within the 11-day stale-probe window) + `odd-platform__java__DataSourceController__controller-method__updateDataSource.md`
- implicit_adrs[0] (select-or-create combo-box) ← DataSourceForm.tsx:124-129 + NamespaceAutocomplete.tsx:74-89,165-177 + `odd-platform-ui/src/components/shared/elements/AutocompleteSuggestion/AutocompleteSuggestion.tsx:24-29`
- implicit_adrs[1] (single-prop create/edit) ← DataSourceForm.tsx:22,70,85,165-166
- implicit_adrs[2] (ODDRN immutable) ← DataSourceForm.tsx:120 + `odd-platform-specification/components.yaml:1317-1325`
- implicit_adrs[3] (confirm-on-close) ← DataSourceForm.tsx:168 + DialogWrapper.tsx:64-79
- bugs_limitations_corner_cases[0] (rejection closes modal) ← DataSourceForm.tsx:69-81 + handleResponseThunk.ts:34-42 + DataSourceForm.tsx:157-169
- bugs_limitations_corner_cases[1] (pullingInterval dead type) ← DataSourceForm.tsx:25-27 + components.yaml:1303-1315
- bugs_limitations_corner_cases[2] (no errorText) ← DataSourceForm.tsx:157-169 + DialogWrapper.tsx:24,121-125
- bugs_limitations_corner_cases[3] (oddrn required-vs-schema) ← DataSourceForm.tsx:110-113 + components.yaml:1314-1315
- bugs_limitations_corner_cases[4] (shouldUnregister asymmetry) ← DataSourceForm.tsx:106-123
- stress_findings ← DataSourceForm.tsx:1-173 + NamespaceAutocomplete.tsx:36-181 + AutocompleteSuggestion.tsx:24-29 + DialogWrapper.tsx:64-83 + handleResponseThunk.ts:34-42 + components.yaml:1303-1325 + registerDataSource/updateDataSource backend sidecars
- security ← DataSourceForm.tsx:1-173,146-155 + handleResponseThunk.ts:34-42 + registerDataSource backend sidecar (plaintext-token + auth-gate findings)
- performance ← DataSourceForm.tsx:40-63,69-81,146-155,166 + NamespaceAutocomplete.tsx:49-60
- upstream_callers ← DataSourceForm.tsx:20-23
- downstream_side_effects ← DataSourceForm.tsx:65-81 + datasources.thunks.ts:34-62 + handleResponseThunk.ts:28-39 + DialogWrapper.tsx:81-83
- coherence_notes ← `odd-platform__java__DataSourceController__controller-method__registerDataSource.md` + `odd-platform__java__DataSourceController__controller-method__updateDataSource.md` (both Read this session) + NamespaceAutocomplete.tsx:74-89,165-177 + AutocompleteSuggestion.tsx:24-29 + DataSourceForm.tsx:124-129 + retrospectives/LSN-023-feature-ontology-built-without-the-ui.md

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH (the absence of a test file is verified by Glob)
- docs_link_semantic: MEDIUM (the Management page status is inherited from the backend sidecars within the stale-probe window, not re-fetched this session; the drift findings about the modal's field set are code-grounded)
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: HIGH
- upstream_callers: MEDIUM (the DataSourcesList parent component is a REFERENCE — not yet enriched)
- downstream_side_effects: HIGH
- stress_findings: HIGH (0 of 38 questions are PROBE-NEEDED; the 4 REFERENCE answers are NamespaceAutocomplete-owned sibling concerns, and the 4 emitted probes — P-074..P-077 — pin operator-observable behaviour the static trace already establishes with strong file:line evidence; confidence is HIGH, not MEDIUM)

## Maintainer notes

(empty — no prior sidecar existed at this path; this is the first enrichment of this node)
