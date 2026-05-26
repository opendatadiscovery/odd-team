# SHB-010 — Dataset Field per-column annotation surface (replace-all tags, BULK-REPLACE enums, description-link DELETE quirk, XSS verbatim storage)

**Category**: clustering
**Severity**: HIGH

## Hypothesis

Operators see a per-column annotation surface on the dataset Structure tab that lets them edit description, business-name, tags, enum values, and add/remove glossary terms — all gated by `DATASET_FIELD_*_UPDATE` permissions that resolve PARENT-DATA-ENTITY-SCOPED via `DatasetFieldResourceExtractor`. The aggregate surface is the **per-column half** of F-004 (per-entity description editing) and contains four distinct correctness defects no F-NNN anchors: (1) `updateDatasetFieldTags` is **delete-all-then-recreate** for INTERNAL relations (NOT a diff), so submitting `tags: []` clears every INTERNAL tag; (2) `createEnumValue` is named CREATE but implemented BULK-REPLACE — partial-body submission silently soft-deletes omitted items; (3) `deleteTermFromDatasetField` removes only manual term-links — `IS_DESCRIPTION_LINK.isFalse()` filter leaves description-derived links in place, so a term linked via both manual-add AND a `[[ns:term]]` description marker cannot be removed via this endpoint; (4) description body stores verbatim — no Jsoup, no Encode, no length cap — F-004 XSS-class fingerprint at the per-column surface, defence-in-depth lives only at UI render.

## Evidence

- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/DatasetFieldController.java:35-103` — 7 endpoints, thin-proxy. Three PUTs (description, internal-name, tags), one POST (enum_values), two GETs, two term endpoints.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/DatasetFieldServiceImpl.java:117-132` — `updateDatasetFieldTags` calls `deleteDatasetFieldInternalRelations(datasetFieldId)` first (unconditional DELETE filtered by `origin = INTERNAL`), then re-inserts the full submitted set. NOT a diff like `TagServiceImpl.updateRelationsWithDataEntity` (which computes current\\updated).
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/repository/reactive/ReactiveTagRepositoryImpl.java:289-295` — the unconditional DELETE: `DELETE FROM tag_to_dataset_field WHERE dataset_field_id = ? AND origin = 'INTERNAL'`.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/EnumValueServiceImpl.java:91-122` — BULK-REPLACE semantics: items with `id != null` → bulkUpdate; items with `id == null` → bulkCreate; rows whose `id` is NOT in `idsToKeep` → `softDeleteExcept`. Partial body silently deletes others.
- `odd-platform-specification/openapi.yaml:2536-2554` — operationId `createEnumValue` — the verb says CREATE singular; implementation is bulk-replace. Schema name `BulkEnumValueFormData` (`:2547`) is honest about bulk shape; the operationId hides it.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/repository/reactive/TermRelationsRepositoryImpl.java:179` — DELETE filter: `.and(DATASET_FIELD_TO_TERM.IS_DESCRIPTION_LINK.isFalse())`. Description-derived term-link rows survive the DELETE endpoint.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/repository/reactive/ReactiveDatasetFieldRepositoryImpl.java:73-80` — `updateDescription` is `UPDATE dataset_field SET internal_description = ? WHERE id = ?` with only empty-to-null normalisation. No Jsoup.clean, no Encode.html, no length cap.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/permission/extractor/DatasetFieldResourceExtractor.java:21-27` — every authorized request issues a 3-table JOIN (`dataset_field → dataset_structure → dataset_version → data_entity`) to map dataset_field_id to parent data_entity_id BEFORE the controller method runs.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/util/SecurityConstants.java:295-299` — TWO HIGH-severity wiring bugs in the security-rules table:
  - line 299: `POST /api/datasetfields/{dataset_field_id}/terms` is gated by `DATA_ENTITY_ADD_TERM` (DataEntity-scope) instead of `DATASET_FIELD_ADD_TERM` (the documented field-scope permission)
  - line 295-296: `PUT /api/alerts/{alert_id}/status` is gated by `DATASET_FIELD_ADD_TERM` (copy-paste bug — an alert path gated by a field-scope term permission)
- Live doc: `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions` (verified 2026-05-25 status 200): `DATASET_FIELD_ADD_TERM: "Allows linking a business glossary term to a specific field within a dataset."` — the documented gate. Code wires `DATA_ENTITY_ADD_TERM`. Docs-vs-code drift.
- Cross-ref: `lineage/odd-platform/understanding/odd-platform__java__DatasetFieldController__controller-class__DatasetFieldController.md` (six HIGH-severity findings catalogued).

## Notes

- **F-004 anchors per-entity description editing**; this thread is the **per-column twin** that F-004 doesn't capture. The XSS verbatim-storage pattern is the same fingerprint; the per-column surface has its own render path (DatasetField description in the Structure tab) that may not be covered by F-004's UI defence-in-depth probe P-009.
- **The two SecurityConstants wiring bugs are HIGH-severity**: an authenticated user holding `DATA_ENTITY_ADD_TERM` (Data Entity scope) can link terms to ANY dataset field of any entity they hold the permission on — the per-field permission is bypassable. The alert-PUT wired to a field-scope term permission means anyone with `DATASET_FIELD_ADD_TERM` can resolve alerts on any entity. Both are operator-policy-bypassable; both are docs-vs-code drift.
- **DELETE term endpoint UX defect**: an operator who linked a term via the explicit `POST /terms` API AND via a description marker `[[ns:term]]` calls DELETE expecting "the term is gone" — DELETE returns 204 No Content, the manual row is gone, the description-link row survives, the term remains visible in the linked-terms tab. Operator's mental model violated; the endpoint description ("Delete term from current dataset field terms list") does not warn.
- **BULK-REPLACE enum values is data-loss-shaped**: a UI / third-party client that submits `items: [{name: 'newValue'}]` against a field with three existing items deletes the other two silently. The DatasetFieldEnumsForm correctly sends the FULL `data.enums` array, but a future UI refactor or a third-party API consumer sending only the changed item destroys data. operationId says CREATE.
- **Concurrency on enum-values write**: no optimistic-lock, no advisory lock at the dataset_field_id level, no SERIALIZABLE isolation. Two concurrent POSTs to the same field's enum values produce silent last-write-wins.
- **Replace-all on tags**: same shape as enum values — submitting `tags: []` clears every INTERNAL tag; the response wire-shape is `Flux<Tag>` which streams the FULL current set. A client comparing response to request can detect the surprise but most clients don't.
- **jOOQ unset-origin INSERT risk**: `TagToDatasetFieldPojo` is constructed without `.setOrigin(...)` — the schema column is `NOT NULL DEFAULT 'INTERNAL'`. Whether jOOQ's `newRecord(table, pojo)` omits the field (default applies) or emits explicit NULL (constraint violation) is unverified by any test. A jOOQ version bump could change null-field-handling silently.
- **HTTP 200 vs spec 201 drift**: spec declares 201 for the three PUT endpoints (`openapi.yaml:2465, 2488, 2511`), controller returns 200 via `ResponseEntity::ok`. Generated SDKs branching on 201 mishandle the response.

## Next

1. **Graduate** to `F-NNN — Dataset Field per-Column Annotation Surface` (P-01 Data Discovery / annotation, per-column variant). Primary subjects: `DatasetFieldController` (7 endpoints), `DatasetFieldServiceImpl.{updateDescription, updateInternalName, updateDatasetFieldTags}`, `EnumValueServiceImpl`, `TermRelationsRepositoryImpl` (the description-link filter), plus the parent-scoped auth chain via `DatasetFieldResourceExtractor`.
2. **REFACTOR-NNN — HIGH** — fix `SecurityConstants.java:299` to gate `POST /api/datasetfields/{id}/terms` with `DATASET_FIELD_ADD_TERM` (matching the documented permission). One-line fix.
3. **REFACTOR-NNN — HIGH** — fix `SecurityConstants.java:295-296` to gate `PUT /api/alerts/{id}/status` with `DATA_ENTITY_ALERT_RESOLVE` (the documented alert-mutation gate). Copy-paste bug; one-line fix.
4. **REFACTOR-NNN — HIGH** — rename the `POST /api/datasetfields/{id}/enum_values` operationId to reflect BULK-REPLACE semantics (e.g. `replaceEnumValues`). OR add a `partial: boolean` form field that defaults to false (mirror current behaviour) and lets clients opt into diff-merge semantics.
5. **REFACTOR-NNN — MEDIUM** — `deleteTermFromDatasetField` should EITHER also remove description-link rows OR return a 409 Conflict with a body that explains "this term is also referenced in the description; edit the description to remove the marker." Current silent-removal-of-only-manual is data-integrity-confusing.
6. **REFACTOR-NNN — MEDIUM** — explicit `.setOrigin(TagOrigin.INTERNAL.name())` on the `TagToDatasetFieldPojo` construction in `getUpdatedRelations`. The current reliance on the DB DEFAULT is jOOQ-version-fragile.
7. **REFACTOR-NNN — LOW** — fix spec-vs-code response code drift (PUT returning 200 instead of spec 201). Use `ResponseEntity.status(HttpStatus.CREATED)` for the three PUTs.
8. **TEST-NNN — HIGH** — the controller has ZERO direct HTTP tests. Highest-leverage gap: probe P-153 (the two SecurityConstants wiring bugs), P-154 (BULK-REPLACE enum-values + concurrency), P-155 (description-link survives DELETE).
9. **DOC-NNN** — the OpenAPI description for `createEnumValue` should explicitly say "the request body IS the desired state; existing items not in the body are soft-deleted."

## Links

- cluster_with: [F-004, F-013]
- merged_into: (open)
- supersedes: []
