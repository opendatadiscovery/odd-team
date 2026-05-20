## REFACTOR-486 — `updateLookupTableField` discards `lookupTableId` — a `LOOKUP_TABLE_DEFINITION_UPDATE` holder can edit a column belonging to a different lookup table by URL-spoofing

**Severity**: MEDIUM
**Category**: auth-scope-bypass + parameter-discard + missing-validation
**Batch**: V (2026-05-20)
**Pillars affected**: [P-03-master-data-management, P-09-security-access-control]

**Surfaced by**:
- `ReferenceDataController__controller-class__ReferenceDataController.md:bugs_limitations_corner_cases.[5]` (MEDIUM) — "`updateLookupTableField(columnId, formData)` discards the `lookupTableId` path parameter — the service signature is `updateLookupTableField(final Long columnId, final LookupTableFieldUpdateFormData formData)` (no table-id) so a client could PATCH `/api/referencedata/table/999/column/{column_id}` and the update succeeds regardless of whether columnId belongs to table 999. Inconsistent with `getLookupTableField` which validates the parent-table linkage (`ReferenceDataServiceImpl.java:62-66`)."
- `ReferenceDataController__controller-class__ReferenceDataController.md:security.known_security_gaps.[3]` (MEDIUM) — "`updateLookupTableField` discards path-param `lookupTableId` at the service layer — an authorized caller with `LOOKUP_TABLE_DEFINITION_UPDATE` (granted via Policy on table A) can PATCH a column belonging to table B by spoofing the URL. The NO_CONTEXT permission doesn't catch the cross-table jump."

**Statement**: At `ReferenceDataController.java:131-141` + `ReferenceDataServiceImpl.java:126-143`:

The controller method signature accepts `lookupTableId` AS A PATH PARAMETER:
```java
@Override
public Mono<ResponseEntity<LookupTableField>> updateLookupTableField(
    final Long lookupTableId,
    final Long columnId,
    final Mono<LookupTableFieldUpdateFormData> formData,
    final ServerWebExchange exchange) {
    return formData
        .flatMap(form -> referenceDataService.updateLookupTableField(columnId, form))
        // ^^^^^ NOTE: lookupTableId is DROPPED here
        .map(ResponseEntity::ok);
}
```

The service signature accepts ONLY `columnId` (no `lookupTableId`):
```java
public Mono<LookupTableField> updateLookupTableField(
    final Long columnId,
    final LookupTableFieldUpdateFormData formData) {
    // proceeds to update the column WITHOUT cross-checking columnId.lookupTableId == path's lookupTableId
}
```

This is INCONSISTENT with `getLookupTableField` which DOES validate the parent-table linkage at `ReferenceDataServiceImpl.java:62-66`:
```java
public Mono<LookupTableField> getLookupTableField(final Long lookupTableId, final Long columnId) {
    return referenceDataRepository.getColumn(columnId)
        .handle((col, sink) -> {
            if (!col.getLookupTableId().equals(lookupTableId)) {
                sink.error(new BadUserRequestException("Column does not belong to table %d".formatted(lookupTableId)));
            } else {
                sink.next(col);
            }
        });
}
```

**Attack scenario**:

1. Attacker holds `LOOKUP_TABLE_DEFINITION_UPDATE` permission via a Policy attached to a Role attached to an Owner. Per ADR-CANDIDATE-168, the permission is GLOBAL (NO_CONTEXT resolver) — it permits modifying ANY column definition.

2. (Or stricter setup): suppose the operator configured a `LOOKUP_TABLE_DEFINITION_UPDATE` policy with a Condition restricting to a SPECIFIC lookup_table_id (the policy framework supports per-policy conditions; an operator-curated Condition could narrow the NO_CONTEXT permission to a subset of tables). Even with this narrowing, the bug allows bypass.

3. Attacker discovers a target column belonging to a lookup table they do NOT have permission on (table B), but they DO have permission on table A.

4. Attacker issues `PATCH /api/referencedata/table/{A_id}/column/{B_column_id}` — the URL claims the column belongs to table A; the column actually belongs to table B.

5. The SecurityConstants gate at line 335-338 (`PATCH /api/referencedata/table/{lookup_table_id}/column/{column_id}` → `LOOKUP_TABLE_DEFINITION_UPDATE`) PASSES because the URL's `{lookup_table_id}` is `A_id` which the attacker has permission on.

6. The service-tier `updateLookupTableField` DISCARDS `lookupTableId` and operates on `columnId` directly. The column belonging to table B is updated successfully.

7. The attacker can rename / change the type / change the default-value / drop the column of any column in any lookup table they have NO permission on.

**Combined with the NO_CONTEXT scoping** (per ADR-CANDIDATE-168 known security gap on NO_CONTEXT resolver) — even WITHOUT the parameter-discard bug, NO_CONTEXT permits any holder to mutate any lookup table — but the parameter-discard bug means EVEN context-narrowing Policy Conditions are bypassed.

**Evidence**:
- `ReferenceDataController.java:131-141` — controller passes `lookupTableId` in but the service-call only uses `columnId`
- `ReferenceDataServiceImpl.java:126-143` — service signature drops `lookupTableId` from the parameter list
- `ReferenceDataServiceImpl.java:62-70` — contrast: `getLookupTableField` enforces the cross-check
- `PolicyPermissionDto.java:80-88` — the 9-permission enumeration includes `LOOKUP_TABLE_DEFINITION_UPDATE` with MANAGEMENT category
- `SecurityConstants.java:335-338` — the gate that permits the cross-table jump

**Existing-ADR-or-implied-prescription**:
- ADR-CANDIDATE-168 (NEW batch V) codifies the three-tier RBAC design — this scope is the auth-scope-bypass within the DEFINITION tier; the NO_CONTEXT resolver framing AMPLIFIES the bypass.
- ADR-CANDIDATE-166 (NEW batch V) frames lookup tables as first-class data entities — this scope means even per-table ownership doesn't restrict edits via this endpoint.
- Cross-link with REFACTOR-024 family (cross-owner enumeration) — same shape at the data-entity tier; this scope is the lookup-table-tier mirror.

**Proposed remedy**:

1. **Path A — Add the parent-table linkage check** at `ReferenceDataServiceImpl.updateLookupTableField` (lines 126-143). Change the signature to `updateLookupTableField(final Long lookupTableId, final Long columnId, final LookupTableFieldUpdateFormData formData)` and add the same `handle` check that `getLookupTableField` uses at lines 62-66:
   ```java
   .handle((col, sink) -> {
       if (!col.getLookupTableId().equals(lookupTableId)) {
           sink.error(new BadUserRequestException("Column does not belong to table %d".formatted(lookupTableId)));
       }
   });
   ```

2. **Path B — Mirror the fix at all sibling endpoints**: audit `deleteLookupTableField`, `updateLookupTableRow`, `deleteLookupTableRow` for the same parameter-discard pattern. ReferenceDataServiceImpl.java should be reviewed end-to-end for the consistency of cross-checks; any READ method that validates linkage should have a corresponding WRITE method that ALSO validates linkage.

3. **Path C — Migrate to context-scoped permissions** at the SECURITY_RULES tier: change the NO_CONTEXT resolver to a LOOKUP_TABLE-context resolver (cross-link with ADR-CANDIDATE-002's existing context-scoped sub-pattern). This is the structural fix for ADR-CANDIDATE-168's known security gap on NO_CONTEXT scoping. But this is a larger refactor; Path A is the immediate fix.

Path A is the minimum security fix; Path B is the audit-sweep to ensure no sibling bug exists; Path C is the long-term architectural improvement.

**Severity rationale**: MEDIUM — privilege-bypass within the authenticated-user pool; reachable by any holder of `LOOKUP_TABLE_DEFINITION_UPDATE` (typical steward role grant); operationally significant (a steward can mutate columns of lookup tables they do not own); not security-critical at the platform-wide level so MEDIUM (not HIGH); cross-link with REFACTOR-024 family elevates the seriousness if the maintainer chooses to group.

**Suggested backlog grouping**: `Lookup-tables hardening sprint` — covers REFACTOR-486 (this), REFACTOR-485 (rename breaks downstream SQL), and any future lookup-table-tier scopes; cross-link with `Authorization audit batch` (REFACTOR-482 + REFACTOR-073 + REFACTOR-185).

---
