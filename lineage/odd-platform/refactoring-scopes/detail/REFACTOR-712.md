## REFACTOR-712 — LookupTableForm types submissions as `LookupTableFormData` (CREATE shape with required `namespaceName`) and routes them to the UPDATE endpoint. `LookupTableUpdateFormData` OpenAPI schema rejects `namespaceName`; the field is sent on the wire on every edit but silently discarded by the server (Spring Jackson FAIL_ON_UNKNOWN_PROPERTIES = false default)

**Severity**: HIGH
**Category**: drift-input-name-vs-implementation / silent-discard / DTO-shape-mismatch
**Batch**: ZL (2026-05-26)
**Pillars affected**: [P-03 Master Data Management]

**Surfaced by**:
- `odd-platform__ts__react-component__component__LookupTables.md:bugs_limitations_corner_cases[2]` (HIGH) — "Edit-form DTO drift: `LookupTableForm.tsx:49` types form data as `LookupTableFormData` (the CREATE shape with required `namespaceName`). On edit (line 60-66), it submits the SAME shape to `editLookupTable({ lookupTableUpdateFormData: data, ... })`, but the OpenAPI contract for UPDATE (`LookupTableUpdateFormData`, components.yaml:3853-3862) defines ONLY `name` + `description`. The `namespace_name` field is sent on the wire on every edit but silently discarded by the server (assuming Spring's default lenient binding). The form-visual `disabled={!!lookupTable}` (line 120) hides this from the user." — evidence: LookupTableForm.tsx:49, 60-66, 117-123 + components.yaml:3853-3862 + ReferenceDataServiceImpl.java (no `updateNamespace` path) — severity: HIGH
- `odd-platform__ts__react-component__component__LookupTables.md:docs_link_semantic.doc_drift_findings[0]` (MEDIUM) — "Doc page says 'Renaming a lookup table or editing its description' under LOOKUP_TABLE_UPDATE, implying the namespace is NOT updateable — and the OpenAPI schema confirms this (`LookupTableUpdateFormData` defines only `name` + `description`, components.yaml:3853-3862). The UI form (`LookupTableForm.tsx:117-123`) disables the namespace field on edit (`disabled={!!lookupTable}`) AND sends it anyway in the request body via `lookupTableUpdateFormData: data` (LookupTableForm.tsx:63) — drift between UX intent (field disabled = field not editable) and wire reality (field sent and silently discarded). Operator inspecting the network tab on edit sees `namespace_name` on the wire, but reading the docs would assume the field is not transmitted."
- `odd-platform__ts__react-component__component__LookupTables.md:stress_findings.request_inputs[1]` (PROBE-NEEDED) — "TRANSLATES_SILENTLY — the parameter NAME says 'lookupTableUpdateFormData' implying the UPDATE schema, but the SHAPE on the wire is the CREATE schema (namespace_name included). Spring's default JSON binding (Jackson FAIL_ON_UNKNOWN_PROPERTIES = false) silently discards the extra field. Operator inspecting the network tab sees namespace_name on every edit. PROBE-NEEDED to confirm the discard-vs-reject behaviour." — drift: DRIFT_INPUT_NAME_VS_IMPLEMENTATION

**Statement**: `LookupTableForm.tsx:49` declares `useForm<LookupTableFormData>(...)` — the CREATE shape per `components.yaml:3840-3852` which has `name: required`, `description: required`, `namespaceName: required`. On edit (line 60-66), the same shape is submitted to the UPDATE mutation: `editLookupTable({ lookupTableUpdateFormData: data, lookupTableId })`.

The mutation calls `referenceDataApi.updateLookupTable({ lookupTableId, lookupTableUpdateFormData })` — the OpenAPI generated client serializes the body as JSON. `lookupTableUpdateFormData` (per components.yaml:3853-3862) defines ONLY `name` + `description` (no `namespaceName`). The mismatched field `namespace_name` ends up on the wire.

Server-side, `ReferenceDataController.updateLookupTable` deserializes the request body via Spring Jackson with `FAIL_ON_UNKNOWN_PROPERTIES = false` (the framework default). The `namespace_name` field is silently discarded; only `name` and `description` reach the service layer. `ReferenceDataServiceImpl` has no `updateNamespace` path; the namespace is NEVER touched.

The form-visual `disabled={!!lookupTable}` (line 120) DISABLES the namespace field on edit (so the operator can't change it via the UI), but the field's CURRENT VALUE is still in form state (populated from `lookupTable.namespace.name` at line 44) and gets serialized into the body.

**Operator-visible impact**:
- An operator editing a lookup table sees the namespace field grayed out — they assume it's not editable AND not transmitted.
- The Network tab shows `namespace_name` on every edit request — confusing to a careful operator.
- The server silently discards the field; the namespace is correctly preserved.
- No functional bug today — the namespace IS preserved correctly by the server's silent-discard behaviour.

**Latent failure modes**:
1. **Future Jackson config change**: if Spring's `FAIL_ON_UNKNOWN_PROPERTIES` is later set to `true` (security hardening, or a Spring Boot version upgrade that changes the default), every edit will start failing with 400 "Unknown property 'namespace_name'". This is a TIME BOMB.
2. **Future schema rename**: if `LookupTableUpdateFormData` ever adds a `namespaceName` field (e.g., to allow namespace transfer), the silent-discard becomes a silent-DESTRUCTION — the form's current namespaceName (from the existing table) would overwrite the operator's intent (which was to NOT change it, but the form-disabled UI didn't carry that semantic to the wire).
3. **Generated SDKs**: third-party API consumers using the OpenAPI spec to generate clients would NOT send `namespace_name` on update; the inconsistency between the UI's behaviour and the contract is hidden by Spring's lenient binding.

**Evidence**:
- `LookupTableForm.tsx:49` — `useForm<LookupTableFormData>(...)` declares the CREATE shape
- `LookupTableForm.tsx:60-66` — `editLookupTable({ lookupTableUpdateFormData: data, lookupTableId })` (data is the FULL CREATE-shape form state)
- `LookupTableForm.tsx:117-123` — namespace field with `disabled={!!lookupTable}`
- `LookupTableForm.tsx:44` — namespaceName populated from `lookupTable.namespace.name` on edit
- `components.yaml:3840-3852` — `LookupTableFormData` (CREATE shape)
- `components.yaml:3853-3862` — `LookupTableUpdateFormData` (UPDATE shape: `name` + `description` only)
- `ReferenceDataController.java:121-129` — updateLookupTable endpoint receiving the body
- Spring Jackson default: `FAIL_ON_UNKNOWN_PROPERTIES = false`
- contrast: well-behaved forms in the codebase declare separate `XxxCreateForm` and `XxxUpdateForm` types for the two shapes; LookupTableForm shares one type for both

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-246 NEW this batch (modal-dialog form mount pattern) is the architectural anchor for HOW the form is mounted (modal); the CONTENT-shape decision (one form-type vs two) is implementation-level. The fix is purely implementation:

- Split the form's `useForm` declaration into two: `useForm<LookupTableFormData>` for create-mode; `useForm<LookupTableUpdateFormData>` for edit-mode.
- OR: derive a typed adapter that strips `namespaceName` before submitting on edit.
- OR: use a discriminated union type `CreateOrUpdateLookupTableFormData` with branch on `lookupTable` presence.

**Proposed remedy**: Two options, in increasing scope:

1. **LOWEST cost — strip namespaceName on edit submit**:
   ```tsx
   // LookupTableForm.tsx:60-66
   const onSubmit = lookupTable
     ? (data: LookupTableFormData) => {
         const { namespaceName, ...updateData } = data;  // strip namespaceName
         return editLookupTable({ lookupTableUpdateFormData: updateData, lookupTableId: lookupTable.id });
       }
     : (data: LookupTableFormData) => createLookupTable({ lookupTableFormData: data });
   ```
   - Effort: minimal; preserves the single form-type
   - Closes the time-bomb (Jackson config change) and the schema-rename-leak

2. **MEDIUM cost — split form types**:
   - Two `useForm` declarations: one per mode
   - Two separate JSX renders (one with namespace field, one without)
   - Effort: moderate; cleaner separation; allows different validation rules per mode

**Recommended**: Option 1 for short-term (one-line type-narrowing fix). Option 2 if the form's validation rules ever need to diverge between create and update modes.

**Severity rationale**: HIGH — the defect is:
- Operator-confusing (namespace_name visible on wire on every edit, contradicting docs and UI affordance)
- A latent time bomb (Jackson FAIL_ON_UNKNOWN_PROPERTIES default could change)
- A latent silent-destruction risk (future schema rename could turn discard into overwrite)
- Test-uncovered (zero direct tests on LookupTableForm per the sidecar's tests_coverage_semantic.gaps)

Not CRITICAL because:
- Today, the silent-discard behaviour is consistent with the operator's intent (don't change the namespace)
- No data loss is happening RIGHT NOW
- The OpenAPI contract is correct; only the UI's adherence is broken

**Suggested backlog grouping**: `DOC-NNN Master Data Management pillar fix sprint` — pair with REFACTOR-711 (InfiniteScroll mismatch), REFACTOR-713 (counter leak), REFACTOR-714 (per-keystroke PUT). Also pair with REFACTOR-486 (updateLookupTableField discards lookupTableId — sibling LookupTables-tree defect).

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-486 (updateLookupTableField sibling defect); ADR-CANDIDATE-246 NEW this batch (modal-dialog form mount — the architectural context); the broader Category F (input name vs implementation drift) class anchored in LSN-020.
- SUPERSEDES: none.
- CONFLICTS: none.

---
