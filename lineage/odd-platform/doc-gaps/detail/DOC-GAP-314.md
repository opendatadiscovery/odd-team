---
doc_gap_id: DOC-GAP-314
severity: MEDIUM
category: drift (Category F NAME-vs-IMPLEMENTATION — UI form types as CREATE-shape, mutation parameter NAME promises UPDATE-shape, wire reality includes a field the schema rejects; UX-disabled-field hides the discrepancy)
batch: ZL
generated_at: "2026-05-26T00:00:00Z"
generated_at_commit: 4ec2b20
prompt_version: "doc-gap-finder/0.1.0"
maintainer_curated: false
related_pillar_features:
  - "P-03"           # Master Data Management
related_features:
  - F-018            # Lookup Tables
related_doc_gaps:
  - DOC-GAP-215      # Lookup Tables compound doc-coverage gap — sibling backend-tier finding
  - DOC-GAP-313      # Lookup Tables InfiniteScroll 30-row cap (sibling UI bug)
  - DOC-GAP-181      # PUT /api/owners/{owner_id} silent destructive UPDATE (analogous "UI form silently sends fields the API ignores" class)
related_retrospectives:
  - LSN-020          # NAME-vs-IMPLEMENTATION drift class
  - LSN-023          # do not interpret backend-named field semantically without checking the UI form
---

## DOC-GAP-314 — Lookup Table EDIT form silently submits `namespace_name` on the wire (`LookupTableFormData` CREATE shape) even though the OpenAPI `LookupTableUpdateFormData` schema rejects it (only `name` + `description` are valid); the form's namespace field is UX-disabled on edit (`disabled={!!lookupTable}` at `LookupTableForm.tsx:120`) but the value travels in EVERY edit PUT; live page documents UPDATE permission as "renaming a lookup table or editing its description" — implying namespace IS NOT updateable, which the OpenAPI schema confirms, but the UI form's actual wire shape contradicts the doc + the schema

**Severity**: MEDIUM
**Category**: drift (Category F NAME-vs-IMPLEMENTATION at the mutation parameter; live doc accidentally correct on policy, but blind to the form-shape-vs-schema-shape divergence operators observe in the network tab)

### Surfaced by

- `odd-platform__ts__react-component__component__LookupTables.md:docs_link_semantic.doc_drift_findings.[0]` (MEDIUM per sidecar — "Doc page says 'Renaming a lookup table or editing its description' under LOOKUP_TABLE_UPDATE, implying the namespace is NOT updateable — and the OpenAPI schema confirms this (`LookupTableUpdateFormData` defines only `name` + `description`, components.yaml:3853-3862). The UI form (`LookupTableForm.tsx:117-123`) disables the namespace field on edit (`disabled={!!lookupTable}`) AND sends it anyway in the request body via `lookupTableUpdateFormData: data` (LookupTableForm.tsx:63) — drift between UX intent (field disabled = field not editable) and wire reality (field sent and silently discarded). Operator inspecting the network tab on edit sees `namespace_name` on the wire, but reading the docs would assume the field is not transmitted.")
- `odd-platform__ts__react-component__component__LookupTables.md:bugs_limitations_corner_cases.[2]` (HIGH per sidecar — "Edit-form DTO drift: `LookupTableForm.tsx:49` types form data as `LookupTableFormData` (the CREATE shape with required `namespaceName`). On edit (line 60-66), it submits the SAME shape to `editLookupTable({ lookupTableUpdateFormData: data, ... })`, but the OpenAPI contract for UPDATE (`LookupTableUpdateFormData`, components.yaml:3853-3862) defines ONLY `name` + `description`. The `namespace_name` field is sent on the wire on every edit but silently discarded by the server (assuming Spring's default lenient binding). The form-visual `disabled={!!lookupTable}` (line 120) hides this from the user.")
- `odd-platform__ts__react-component__component__LookupTables.md:tests_coverage_semantic.uncovered_behaviours.[4]` (HIGH integration-class uncovered — "Editing an existing lookup table sends `namespace_name` in the request body even though `LookupTableUpdateFormData` schema rejects it") **(PROBE-NEEDED P-191)**
- `odd-platform__ts__react-component__component__LookupTables.md:stress_findings.request_inputs.[lookupTableUpdateFormData]` (DRIFT_INPUT_NAME_VS_IMPLEMENTATION, PROBE-NEEDED — "the parameter NAME says 'lookupTableUpdateFormData' implying the UPDATE schema, but the SHAPE on the wire is the CREATE schema (namespace_name included). Spring's default JSON binding (Jackson FAIL_ON_UNKNOWN_PROPERTIES = false) silently discards the extra field. Operator inspecting the network tab sees namespace_name on every edit.")

### Evidence

- **Code primary source — the type assertion**: `odd-platform-ui/src/components/LookupTables/LookupTableForm.tsx:49` (per sidecar primary source): `const methods = useForm<LookupTableFormData>(...)`. The form is TYPED as `LookupTableFormData` (the CREATE OpenAPI schema with required `name`, `description`, and `namespaceName` per `components.yaml:3840-3852`).
- **Code primary source — the edit-submit branch**: `LookupTableForm.tsx:60-66` (per sidecar primary source): on edit (`if (lookupTable)`), submits `editLookupTable({ lookupTableUpdateFormData: data, lookupTableId: lookupTable.id })`. The `data` parameter has the CREATE shape (with `namespaceName`); the mutation NAME promises the UPDATE shape; the wire payload includes the field the UPDATE schema rejects.
- **OpenAPI schema primary source**: `components.yaml:3853-3862` (per sidecar primary source): `LookupTableUpdateFormData` defines ONLY `name` (string, required) + `description` (string, optional). NO `namespace_name` field. The UPDATE schema is intentionally narrower than CREATE — the live doc page's permission description "renaming a lookup table or editing its description" is consistent with this schema.
- **UI disabled-field deception**: `LookupTableForm.tsx:117-123` + `:120` (per sidecar primary source): `<TextField disabled={!!lookupTable} ...>` — the namespace field is rendered visually disabled on edit (operator cannot type a new value), giving the operator the impression the field is not transmitted. But the form-state's `namespaceName` is initialized from `lookupTable.namespace.name` (line 44) AND submitted with the rest of the form data (line 63). The operator inspecting the network tab on a PUT request sees:
  ```json
  {
    "name": "Customer Lookups",
    "description": "...",
    "namespace_name": "team-a"
  }
  ```
  The `namespace_name` field is present on the wire, but the OpenAPI contract excludes it.
- **Server-side behaviour (Spring's default lenient binding)**: Jackson's `FAIL_ON_UNKNOWN_PROPERTIES = false` is the platform default (per ObjectMapper configuration). The unknown field is silently discarded server-side; the namespace is NOT updated; the LOOKUP_TABLE row's `namespace_id` remains whatever it was before. The behaviour is operator-correct (the namespace is not updated, as the docs imply) but the WIRE SHAPE is operator-misleading.
- **The `available-but-unused-correctly` smell at the form layer**: per sidecar `stress_findings.request_inputs[lookupTableUpdateFormData].is-there-a-column-that-is-not-used`: "the form's `defaultValues.namespaceName` is computed from `lookupTable.namespace.name` on edit (LookupTableForm.tsx:44). This IS in the form state, IS submitted on the wire, but is NOT a valid UpdateFormData field. The available-but-unused-correctly smell: there is no separate `LookupTableUpdateFormData`-typed useForm; one form type is shared across create and update."
- **Live doc primary source (WebFetched 2026-05-26 status 200 via LookupTables.tsx sidecar inferred_docs)**: verbatim quoted in the sidecar:
  - "`LOOKUP_TABLE_UPDATE` — Renaming a lookup table or editing its description"
  - The doc page does NOT mention that the namespace cannot be updated post-create
  - The doc page does NOT warn operators that the network-tab on edit shows `namespace_name` (which would prompt an operator to file a confused bug report)
- **The probe P-191 is the operational confirmation gate**: the doc-drift conclusion is STATIC-INFERRED with HIGH confidence; the runtime behaviour (Spring discards-vs-rejects the unknown field) is PROBE-NEEDED. Either failure mode is doc-relevant:
  - **silent-discard (likely)**: namespace_name on the wire, server discards, no error — operator's edit succeeds, namespace unchanged. Doc-product gap: "what does the wire look like on edit?" unanswered.
  - **strict-rejection (less likely)**: server returns 400 for the unknown field, edit always fails. Operator-blocking; would have surfaced as a bug report long ago.
- **Cross-reference to DOC-GAP-181 family**: DOC-GAP-181 documents the analogous Owner `PUT` family where the UI form silently sends fields the API ignores. THIS finding is the Lookup-Table analog with a less destructive consequence (silent-discard rather than silent-data-loss), but the SAME class: UI form types match CREATE shape, mutation NAME promises UPDATE shape, wire reality drifts.
- **Operator-impact narrative**: a developer integrating with the ODD API directly (not via the UI) reads the OpenAPI contract for `PUT /api/referencedata/table/{lookupTableId}` and sees `LookupTableUpdateFormData` with `name` + `description` only. They build their integration accordingly. Later they inspect the ODD UI's network tab to compare and see `namespace_name` on the wire from the platform's own UI. Confused, they file a bug report: "the platform UI sends a field the OpenAPI contract rejects — which is canonical?" The maintainer's answer: "the OpenAPI contract is canonical; the UI form's wire shape is a known drift." The doc page should pre-empt this conversation.

### Proposed doc action

**TWO-PART action — doc-side disclosure + code-side form-shape fix.**

1. **Code-side PRIMARY (file `/log-issue odd-platform`)** — split the form types:

   - Create a `LookupTableUpdateFormSchema` type (or use `Pick<LookupTableFormData, 'name' | 'description'>`).
   - Re-type `useForm` to `LookupTableFormData | LookupTableUpdateFormSchema` and conditionally cast based on edit/create mode at submit time.
   - On edit-submit, send `{ name, description }` ONLY (no `namespace_name`).
   - Regression test: assert the edit PUT body shape matches `LookupTableUpdateFormData`.

2. **Doc-side COMPANION (until code fix lands)** — extend `documentation/docs/features/master-data-management/lookup-tables.md`:

   > **Update behaviour — namespace immutability**: a lookup table's namespace is fixed at creation and CANNOT be changed via the UPDATE endpoint. The `LookupTableUpdateFormData` schema includes only `name` and `description` (see [API Reference](../../developer-guides/api-reference/reference-data.md)). To move a table between namespaces, delete it and recreate in the target namespace (caveat: deletion cascades — see DOC-GAP-215 for the cascade behaviour).
   >
   > **Known UI drift (network-tab observation)**: the platform UI's edit form currently sends an extra `namespace_name` field on every PUT request; the server silently discards the field (the namespace remains unchanged). This is tracked at odd-platform issue #NNNN; the UI fix is planned for the next release. The behaviour is operator-correct (namespace IS NOT updated) but the wire payload includes a field the OpenAPI contract excludes — operators inspecting the network tab should not be alarmed.

3. **API-reference COMPANION** — `documentation/docs/developer-guides/api-reference/reference-data.md` (when authored per DOC-GAP-215 proposed action 4): include the namespace-immutability semantics + the wire-tab caveat in the per-endpoint description.

### Cross-references

- **DOC-GAP-215** (ReferenceData/LookupTables compound doc-coverage gap) — direct family match: THIS finding adds the SIXTH operational dimension (form-shape-vs-schema-shape wire drift on edit). DOC-GAP-215's "cascade on delete + XSS + per-tenant + buildTableName collision + UI 30-row cap (DOC-GAP-313) + THIS edit-form drift" forms a 6-dimension P-03 cluster on the same doc page.
- **DOC-GAP-313** (Lookup Tables InfiniteScroll 30-row cap) — direct sibling: both findings on the same UI sidecar; combined the two findings (313 + 314) form the UI-tier complement to DOC-GAP-215's backend-tier compound gap.
- **DOC-GAP-181** (`PUT /api/owners/{owner_id}` silent destructive UPDATE) — analogous "UI form silently sends fields the API contract excludes" class. DOC-GAP-181 is HIGH severity (silent data loss); THIS finding is MEDIUM (silent-discard, no data effect) but same class.
- **F-018** (Lookup Tables feature flow) — THIS finding extends F-018's documentation coverage at the UI-tier.
- **LSN-020** (NAME-vs-IMPLEMENTATION drift class) — direct class instance: parameter NAME `lookupTableUpdateFormData` promises UPDATE shape; wire reality is CREATE shape.
- **LSN-023** (do not interpret backend-named field semantically without checking the UI form) — direct case-law application: the form is what ships, the schema is what the contract promises; the two diverge.

### Severity rationale

MEDIUM. The drift is real and operator-observable but NOT data-corrupting. Severity classification:

1. **The behaviour is operator-correct (silent-discard preserves namespace immutability)**: the namespace is not updated, as the docs imply. Compared to DOC-GAP-181 (HIGH — silent data loss), THIS finding's runtime consequence is benign.
2. **The wire-shape discrepancy IS operator-visible**: any developer/operator inspecting the network tab will see `namespace_name` on the wire; the inevitable bug report wastes maintainer time and erodes operator trust ("the platform's own UI doesn't follow its OpenAPI contract").
3. **The fix is a small UI refactor (one form-type split + one regression test)**: cost-benefit is asymmetric — bounded code fix, eliminates the operator-confusion vector.
4. **The doc-product gap compounds the bug**: the live page describes the UPDATE permission as "renaming a lookup table or editing its description" — accurate at the policy level, blind to the form-shape drift. Operators reading the docs cannot reconcile what they see in the network tab with what the docs imply.
5. **The cluster context**: DOC-GAP-215 + DOC-GAP-313 + THIS finding form a 6-dimension P-03 cluster. The doc-side fix is bounded (one section with three subsections — cascade, list-cap, namespace-immutability + wire-tab caveat).

Severity is NOT HIGH because: (a) no data is lost or corrupted; (b) no security boundary is crossed; (c) the operator-visible UI behaviour matches the docs (namespace unchanged); the drift is in the wire-tab observation, not in the user-facing outcome. Severity is NOT LOW because: (a) the drift is structurally visible to any operator with developer-tools open; (b) the bug report it generates wastes maintainer time; (c) the fix is bounded enough that NOT fixing is a quality defect.

### Last verified

- 2026-05-26 — LookupTables.tsx UI-component sidecar PRIMARY SOURCE at substrate commit `4ec2b20`; live WebFetch `https://docs.opendatadiscovery.org/features/master-data-management/lookup-tables` status **200** (verbatim "Renaming a lookup table or editing its description" copy confirmed in the LookupTables.tsx sidecar `inferred_docs[0]` fetched 2026-05-26); OpenAPI schema `LookupTableUpdateFormData` at `odd-platform-api-contract/components.yaml:3853-3862` (per sidecar primary source).
- Probe **P-191** is the operational confirmation gate (silent-discard vs strict-rejection determination); the DOC-GAP finding holds either way.
