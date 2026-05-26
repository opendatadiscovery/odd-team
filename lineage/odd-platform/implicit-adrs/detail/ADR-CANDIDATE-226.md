# ADR-CANDIDATE-226 — `createEnumValue` is BULK-REPLACE-AS-STATE: the request body IS the desired enum-value set; omitted items are SOFT-DELETED; the operation name says "create" but the implementation reconciles

**Classification**: promote
**Severity**: MEDIUM
**Pillars affected**: [P-01 Data Discovery (column-level enum values), P-10 Ingestion (EXTERNAL-origin enum-value handling)]
**Batch**: ZG (2026-05-25)

**Surfaced by**:
- `odd-platform__java__DatasetFieldController__controller-class__DatasetFieldController.md:implicit_adrs.[5]` (MEDIUM) — "**Enum-value bulk-replace semantics — the EnumValueService.createEnumValues body IS the new state.**" — intent_anchor: "Lines 97-105 partition input by `id != null`, then `softDeleteExcept(datasetFieldId, idsToKeep)` removes every existing row whose id is NOT preserved in the request. The pattern is the documented Bulk-Replace contract: the body IS the desired state. The OpenAPI summary 'Enum Value CRUD' (openapi.yaml:2537) hints at it."

**Decision statement**: `POST /api/datasetfields/{id}/enum_values` accepts a `BulkEnumValueFormData` body whose `items: [EnumValueFormData]` array IS the new state. The reconciliation algorithm at `EnumValueServiceImpl.java:91-122`:

```java
// Pseudocode of the implementation
public Mono<EnumValueList> createEnumValues(long datasetFieldId, BulkEnumValueFormData formData) {
  List<EnumValueFormData> items = formData.getItems();

  // Partition by id-presence
  List<EnumValueFormData> toUpdate = items.stream().filter(i -> i.getId() != null).toList();
  List<EnumValueFormData> toCreate = items.stream().filter(i -> i.getId() == null).toList();

  // The reconciliation step: any existing row whose id is NOT in idsToKeep is soft-deleted
  Set<Long> idsToKeep = toUpdate.stream().map(EnumValueFormData::getId).collect(toSet());

  return enumValueRepository.softDeleteExcept(datasetFieldId, idsToKeep)
      .then(enumValueRepository.bulkUpdate(toUpdate))
      .then(enumValueRepository.bulkCreate(toCreate, datasetFieldId))
      .then(enumValueRepository.getEnumValuesByDatasetFieldId(datasetFieldId))
      .map(...);
}
```

The three-step reconciliation: (1) soft-delete every row not in `idsToKeep`; (2) update rows whose id is preserved; (3) create rows with no id. The body IS the desired state; the existing state is reconciled to match.

EXTERNAL-origin enum values follow a description-only-update path (the row identities are owned by the collector, not the operator-via-UI); the bulk-replace only applies to INTERNAL-origin enum values. The reconciliation algorithm is the canonical case-law for "REPLACE-AS-STATE" semantics in the platform.

The operation name `createEnumValue` (singular, verb=CREATE) understates this. The OpenAPI summary `Enum Value CRUD` hints at the multi-action shape but the operation id frames the operation as a unitary create. The wire-side schema name `BulkEnumValueFormData` is the most honest signal — "Bulk" names the shape, but the operationId hides the REPLACE semantics.

The maintainer chose REPLACE-AS-STATE semantics over additive-PATCH semantics (where the body would be a delta). The rationale is implicit in the algorithm:
- **REPLACE-AS-STATE** (current): the UI sends the FULL state every time; the backend reconciles. Operator deletes an item by omitting it from the next submit.
- **Additive PATCH** (alternative): the UI sends a delta (`+add: [X], -remove: [Y]`); the backend applies. Operator deletes an item by explicitly listing it in `-remove`.

REPLACE-AS-STATE is simpler for the UI (no diff tracking) but trades silent-data-loss risk: a partial body (one item) submitted against a field with three existing items WILL soft-delete the other two. The DatasetFieldEnumsForm at `<odd-platform-repo>/odd-platform-ui/src/components/.../DatasetFieldEnumsForm/DatasetFieldEnumsForm.tsx:90-105` correctly sends the FULL `data.enums` array — the UI is contracted to preserve the full set; a third-party API consumer or a future UI refactor that sends only the changed item would corrupt the data (gap-side: REFACTOR-661).

**Wisdom test**: PASS. Three intent anchors:
1. **Algorithm-encoded intent** — the `softDeleteExcept` step is purpose-built for this contract; it has no other meaning. The maintainer wrote a method specifically to delete-everything-not-in-this-set.
2. **Schema-name signal** — `BulkEnumValueFormData` names the bulk shape; the schema is honest about the multi-item semantics.
3. **Structural impact** — every UI surface AND every BI/API consumer of this endpoint must preserve the full item list per submit. A change to additive-PATCH semantics would require a coordinated wire-contract update.

**Operator-visible consequence**:
- An operator using the UI to add ONE new enum value (without seeing the other items) WILL preserve them — the UI sends the full set on every submit.
- A third-party API caller (cURL, custom script, BI tool) that doesn't understand REPLACE-AS-STATE semantics sending `{"items": [{"value": "NEW"}]}` (one item, no ids) WILL silently delete every other live enum value on the field.
- Two concurrent submits race on the `softDeleteExcept` step; last-write-wins (gap-side: REFACTOR-663).
- Replay-safe-for-state-but-not-audit: identical bodies twice produce the same visible state but DIFFERENT row identities (the second call's softDeleteExcept removes the first call's rows; bulkCreate makes new ones) — auditors lose row-id correlation (gap-side: REFACTOR-662).

**Existing ADR**: closely related to **ADR-CANDIDATE-194** (dual-method create design: `bulkCreate` fail-on-duplicate vs `ingestData` upsert). The current ADR is the THIRD variant: REPLACE-AS-STATE (delete everything not in the body, then update + create). The platform now has three patterns:
- **`bulkCreate`** — fail on duplicate (ADR-194)
- **`ingestData`** — upsert with `ON CONFLICT` (ADR-194)
- **`createEnumValues`** — REPLACE-AS-STATE (this ADR)

Each pattern has its own operational semantic; the maintainer chooses based on use case.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- **REFACTOR-661 NEW** — partial-body silent data loss (operator-facing risk; the wire contract should warn or the UI should defend).
- **REFACTOR-662 NEW** — replay-safe-for-state-not-audit (auditors lose row-id correlation across identical resubmits).
- **REFACTOR-663 NEW** — concurrent submits race on softDeleteExcept (last-write-wins; no optimistic lock).

**Proposed action**: Promote to `adrs/drafts/bulk-replace-as-state-enum-values.md` (new ADR). Document:
1. The decision: `createEnumValues` is REPLACE-AS-STATE; the body IS the new state; omitted items are soft-deleted.
2. The algorithm anchor: `softDeleteExcept` + bulkUpdate + bulkCreate three-step at `EnumValueServiceImpl.java:91-122`.
3. The wire-contract commitment: UI consumers must preserve the full set per submit; third-party API consumers must understand REPLACE-AS-STATE.
4. The doc-side gap: the OpenAPI summary "Enum Value CRUD" hints but doesn't warn; the operation description should explicitly state "REPLACE semantics — omitted items are soft-deleted".
5. The compound gaps (link REFACTOR-661/662/663): operators reading the ADR see the semantic; operators reading the gaps see the operational hazards.
6. The cross-platform pattern: distinguish from `bulkCreate` (fail-on-duplicate, ADR-194) and `ingestData` (upsert, ADR-194); this is the THIRD pattern.

**Severity rationale**: MEDIUM — operational-semantic decision affecting one endpoint but with HIGH operator-visible consequence (silent data loss on partial submit). The decision itself is sound; the gaps it creates (REFACTOR-661/662/663) are the operational hazards.

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-194 (dual-method create design — this ADR is the THIRD variant, completing the platform's reconciliation-strategy enumeration).
- SUPERSEDES: none.
- CONFLICTS: the operationId `createEnumValue` understates the REPLACE semantics; the OpenAPI spec page (and the live developer-guides) should explicitly document the REPLACE-AS-STATE contract.

---
