## REFACTOR-661 — DatasetFieldController's `createEnumValue` is BULK-REPLACE-AS-STATE (per ADR-CANDIDATE-226 NEW): a partial body silently soft-deletes the omitted live enum values; a third-party API consumer or a future UI refactor sending only the changed item will corrupt the data

**Severity**: HIGH
**Category**: replace-as-state silent-data-loss
**Batch**: ZG (2026-05-25)
**Pillars affected**: [P-01 Data Discovery (column-level enum values), P-11 Platform API (operator-facing contract clarity)]

**Surfaced by**:
- `odd-platform__java__DatasetFieldController__controller-class__DatasetFieldController.md:bugs_limitations_corner_cases.[8]` (HIGH) — "**`createEnumValue` is BULK-REPLACE, not BULK-CREATE — the operationId NAME promises CREATE.** A partial body (one item) submitted against a field that has three existing items WILL soft-delete the other two. Operator-visible failure: a UI that does not preserve the full current item list when sending the form can silently destroy data. The DatasetFieldEnumsForm at `<odd-platform-repo>/odd-platform-ui/src/components/.../DatasetFieldEnumsForm/DatasetFieldEnumsForm.tsx:90-105` correctly sends the FULL `data.enums` array (every item), avoiding this trap; a third-party API consumer or a future UI refactor that sends only the changed item would corrupt the data."

**Statement**: `POST /api/datasetfields/{id}/enum_values` accepts a `BulkEnumValueFormData` body and reconciles state via:

```java
// EnumValueServiceImpl.java:91-122
public Mono<EnumValueList> createEnumValues(long datasetFieldId, BulkEnumValueFormData formData) {
  List<EnumValueFormData> items = formData.getItems();
  Set<Long> idsToKeep = items.stream()
    .filter(i -> i.getId() != null)
    .map(EnumValueFormData::getId)
    .collect(toSet());

  return enumValueRepository.softDeleteExcept(datasetFieldId, idsToKeep)
    // ↑ HERE: soft-deletes EVERY existing row whose id is NOT in idsToKeep
    .then(enumValueRepository.bulkUpdate(...))
    .then(enumValueRepository.bulkCreate(...))
    .then(...);
}
```

The architectural intent is REPLACE-AS-STATE per ADR-CANDIDATE-226 NEW. The gap: the wire contract has NO warning that omitted items are deleted. The operationId `createEnumValue` (singular, verb=CREATE) is operator-misleading. The OpenAPI summary "Enum Value CRUD" hints at multi-action shape; the operation description "Creates/updates/deletes enum values with their description" does NOT explicitly warn that OMITTED items are deleted.

The UI defends against the trap correctly: `DatasetFieldEnumsForm.tsx:90-105` sends the FULL `data.enums` array on every submit — the form preserves every existing item even when the user only edits one. The UI is the SOLE defence; the wire contract has no safeguard.

Operator-visible failure modes:
- **Third-party API consumer** writes a script: `POST /api/datasetfields/42/enum_values {"items": [{"value": "NEW_VALUE"}]}`. The field had 3 existing items; the script's intent is "add one new value"; the actual effect is "delete the 3 existing values, create the new one". Silent data loss.
- **Future UI refactor** introduces a partial-edit form: the developer sees the endpoint name `createEnumValue` and assumes additive semantics; the form sends only the changed item; the form silently destroys the other items on every submit.
- **Activity feed reveals the loss** — `DATASET_FIELD_VALUES_UPDATED` event captures the row identities, but operators inspecting it see "fewer items" without understanding why (and the audit trail churns row ids on every submit — REFACTOR-662).

**Evidence**:
- Service: `EnumValueServiceImpl.java:91-122` (the softDeleteExcept + bulkUpdate + bulkCreate three-step)
- Controller: `DatasetFieldController.java:65-72`
- OpenAPI: `openapi.yaml:2536-2554` (operationId `createEnumValue`; summary "Enum Value CRUD"; description does not warn)
- UI defence: `DatasetFieldEnumsForm.tsx:90-105` (sends FULL array — the operative defence)
- Hypothesis: `lineage/odd-platform/probes/P-154.yaml`

**Existing-ADR-or-implied-prescription**: **ADR-CANDIDATE-226 NEW** captures the architectural intent (REPLACE-AS-STATE is deliberate). THIS REFACTOR captures the operator-visible HAZARD the intent creates: the wire contract has no warning; the UI defence is unspoken assumption.

**Proposed remedy**:
- **Option A (wire-contract clarification)**: rename operationId to `replaceEnumValues` (plural, REPLACE-AS-STATE explicit); update OpenAPI summary + description; alert third-party API consumers via the live developer docs.
- **Option B (semantic change to ADDITIVE)**: change the service to ADDITIVE PATCH semantics; add an explicit `DELETE /api/datasetfields/{id}/enum_values/{value_id}` for deletions. Breaks REPLACE-AS-STATE; safer-by-default; matches operator expectation. Reverses ADR-CANDIDATE-226 NEW.
- **Option C (transitional safeguard)**: when `items.size() < existing_count`, require an explicit `?confirm_partial=true` query parameter. Without it, return HTTP 400 with a warning. Compromise: keeps the existing semantic but adds operator-friendly safety.

Option A is the smallest change preserving the architectural intent; Option C is the operator-defensive choice. The maintainer's preference depends on whether REPLACE-AS-STATE was a deliberate operator-facing contract or an implementation convenience that became contract.

**Severity rationale**: HIGH — silent data loss; operator-facing data-integrity hazard; the UI is the only defence; the wire contract has no safeguard against third-party API consumers or future UI refactors.

**Suggested backlog grouping**: `Authorization audit batch` (cross-reference REFACTOR-008 — the path-mismatch case-law for systemic fix questions; should the platform CI-check controller-vs-service contract for "OMITTED items are deleted" hazards?).

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-226 NEW (captures the WHY); REFACTOR-585 (`PUT /api/datasources/{id}` is a full-form REPLACE — same shape on a different resource); REFACTOR-425 (Owner role-rebind on `PUT /api/owners/{owner_id}` with `roles` omitted/empty SILENTLY DESTROYS all role bindings — same destructive-default shape).
- SUPERSEDES: none.
- CONFLICTS: none.

---
