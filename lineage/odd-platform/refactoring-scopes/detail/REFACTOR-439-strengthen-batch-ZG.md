## STRENGTHENS — Batch ZG (DatasetFieldController controller-class sidecar reconfirms verbatim-storage XSS-class at the per-column description surface — F-004 family)

**New surfaced_by entry**:

- `odd-platform__java__DatasetFieldController__controller-class__DatasetFieldController.md:bugs_limitations_corner_cases.[4]` (MEDIUM) — "**Description body persists verbatim — F-004 XSS-class fingerprint at the per-column surface.** PUT /api/datasetfields/{id}/description with `<script>` / `<img onerror>` / `javascript:` payloads stores them in `dataset_field.internal_description` and surfaces them through the field-description tab on the data-entity detail page. Defence-in-depth lives only at the UI render layer (probe P-009 — Markdown.tsx pipeline strips dangerous tags at DOM-render); cross-tab coverage of the DatasetField description render path is unverified per F-004 batch-R notes."

**Cross-batch refinement**:

The verbatim-storage class is now reconfirmed at the controller-class layer for DatasetField with line-anchored evidence:
- `DatasetFieldController.java:36-43` — controller body is a one-line `formDataMono.flatMap(formData -> datasetFieldService.updateDescription(datasetFieldId, formData)).map(ResponseEntity::ok)` — NO validation, NO sanitisation.
- `ReactiveDatasetFieldRepositoryImpl.java:73-80` — `DSL.update(DATASET_FIELD).set(INTERNAL_DESCRIPTION, newDescription).where(ID.eq(?))` with only empty-to-null normalisation (line 75). NO `Jsoup.clean`, NO `Encode.html`, NO length cap, NO allowlist.

The XSS-class hazard fingerprint is the SAME as the entity-level sibling (`ReactiveDataEntityRepositoryImpl.setInternalDescription`). The two surfaces (entity + column) form the COMPLETE verbatim-storage description surface; both rely on UI-layer defence (Markdown.tsx pipeline strips dangerous tags at DOM-render — probe P-009).

The doc-side gap (live docs don't describe the column-level XSS surface) is now anchored at the DatasetFieldController sidecar's `docs_link_semantic.doc_drift_findings.[4]` — "Live docs do not describe the column-level XSS-class verbatim-storage surface. Operators reading the description-editing surface have no way to discover that Markdown / HTML payloads persist verbatim to `dataset_field.internal_description` with defence-in-depth only at the UI render layer."

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-439 (the entity-level sibling on the same description-storage class).
- SUPERSEDES: none.
- CONFLICTS: none.

---
