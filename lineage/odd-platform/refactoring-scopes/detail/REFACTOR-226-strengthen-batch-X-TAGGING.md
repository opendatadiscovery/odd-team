## STRENGTHENS — Batch X-TAGGING (REFACTOR-226 — the create-vs-replace operationId drift is confirmed on the TERM sibling endpoint, with the masking unknown)

**One new sidecar confirms the create-language-for-a-replace-all-operation drift on the TERM tag-relation endpoint — the same drift shape REFACTOR-226 surfaced for the data-entity sibling.**

- `createTermTagsRelations.md:bugs_limitations_corner_cases[0]` — "Operation name vs behaviour drift: PUT replace-all under create-language naming. The OpenAPI `operationId` (`createTermTagsRelations`), the spec summary (`Creates tags relations for term`, `openapi.yaml:3185`), and the controller method name all say 'create' for an operation that deletes. `TermServiceImpl.upsertTags` calls `tagService.deleteRelationsWithTerm(termId, names)` FIRST, which removes every `tag_to_term` row whose tag name is absent from `tag_name_list`."
- `createTermTagsRelations.md:stress_findings.name_behavior_pairs[0]` — drift flag `DRIFT_NAME_VS_BEHAVIOR`: "A consumer sending PUT with `tag_name_list:['new']` on a term tagged `{a,b}` ends with `{new}` — `a` and `b` relations are deleted, not preserved."

**Refined finding**: REFACTOR-226 is now a **2-endpoint** create-vs-replace naming drift — the data-entity `createDataEntityTagsRelations` (the original) AND the term `createTermTagsRelations`. Both use create-language at the operationId / spec-summary / controller-method-name layers for a delete-then-recreate replace-all. A KEY DIFFERENCE the term sidecar surfaces: for the data-entity path, the UI's redux thunk is correctly named `updateDataEntityTagsActionType`, which MASKS the drift from UI users (only third-party API consumers reading the spec are exposed). For the TERM path, the term-UI thunk was NOT inspected this batch — so it is UNKNOWN whether the term UI masks the drift. The third-party-API-consumer risk is unmitigated for the term path regardless: a consumer reading only `openapi.yaml:3185` ("Creates tags relations for term") and sending repeated PUT calls expecting cumulative tagging silently loses tags between calls.

**Note**: the term path also has the empty-list-clears-all corner (an empty `tag_name_list` deletes ALL term tags) — tracked separately as REFACTOR-494; the two are the same "replace-all is undisclosed at the API surface" family and should be fixed together.

**Proposed remedy extension**: REFACTOR-226's three-layer remedy (OpenAPI summary update / description expansion / v2 operation rename) now applies to BOTH `createDataEntityTagsRelations` AND `createTermTagsRelations` (and, for completeness, the maintainer should check the dataset-field endpoint — `updateDatasetFieldTags` is at least named with update-language, the more honest verb, so it is the reference). A follow-up should also inspect the term-UI thunk to determine whether the term UI masks the drift.

**Severity unchanged**: MEDIUM — spec/implementation contract drift on a write path with silent destructive consequences for unsuspecting API consumers; the additional endpoint confirmation strengthens the finding without changing the severity calculus.

---
