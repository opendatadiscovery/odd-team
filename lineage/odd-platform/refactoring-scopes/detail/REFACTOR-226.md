## REFACTOR-226 — `createDataEntityTagsRelations` operationId vs implementation drift — PUT replace-all semantics under create-language naming

**Severity**: MEDIUM
**Category**: name-behaviour-drift
**Surfaced by**:
- `createDataEntityTagsRelations.md:bugs_limitations_corner_cases[1]`
- `createDataEntityTagsRelations.md:docs_link_semantic.doc_drift_findings[1]`

**Description**: The OpenAPI spec, the operationId, the controller method name, and the spec summary all say "create" / "creates" for an operation that diffs-and-deletes. A consumer reading the spec who sends `PUT /api/dataentities/{id}/tags` with `tag_name_list: ['new-tag']` expecting "add new-tag, keep existing" will discover that ALL OTHER internal tags on the data entity are deleted. The UI's redux action is correctly named `updateDataEntityTagsActionType`, masking this drift from UI users — but third-party API consumers reading only the spec have no warning. The actual semantic is "replace internal tag set; preserve external tag set" and is documented in neither the OpenAPI description nor the Permissions doc. **An ingestion-pipeline mistake by a third-party consumer would silently delete a data entity's internal tag history.** Compare with `PUT /api/dataentities/{id}/description` which IS named with update-language (`upsertDataEntityInternalDescription`, "Upsert ... description") even though the implementation is UPDATE-not-UPSERT — at least the verb-shape implies overwrite.

**Primary source citations**:
- `openapi.yaml:1173-1175` (`summary: "Creates tags relations for DataEntity entity"` + `operationId: createDataEntityTagsRelations`)
- `DataEntityController.java:244` (method named `createDataEntityTagsRelations`)
- `TagServiceImpl.java:113-120` (the actual diff-and-delete logic)
- `odd-platform-ui/src/redux/thunks/dataentities.thunks.ts:46` (UI uses the correct `updateDataEntityTagsActionType` action name)

**Existing-ADR-or-implied-prescription**: implicit — API contract consistency. The spec text should match the implementation semantics.

**Proposed remedy**: Three layers of fix:
1. **OpenAPI summary update**: `summary: "Replace internal tag set for DataEntity entity"` (the current text is misleading even after one understands the behaviour).
2. **OpenAPI description expansion**: add explicit text — "Replaces the data entity's internal tag set with the provided list. External (ingested) tag relations are preserved. Tags that exist in the directory are linked; tags that do not exist are auto-created (see `TAG_CREATE` permission for the alternative path)."
3. **Operation rename** (breaking — for v2 of the spec): `replaceDataEntityTagsRelations`. Pair with a deprecation period on the create-named variant.

**Severity rationale**: MEDIUM — spec/implementation contract drift on a write path with silent destructive consequences for unsuspecting API consumers.

**Suggested backlog grouping**: DOC-NNN OpenAPI consistency sprint. Pair with REFACTOR-219 (the upsertDescription misleading-summary case).

---
