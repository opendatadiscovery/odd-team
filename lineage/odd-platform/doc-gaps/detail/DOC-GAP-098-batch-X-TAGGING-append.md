## STRENGTHENS — batch X-TAGGING (2026-05-21) — the create-language-for-replace-all drift is confirmed at THREE tag-relation surfaces, not one

DOC-GAP-098 was originally surfaced from the `createDataEntityTagsRelations` sidecar — the **data-entity** tag-relation write endpoint, whose `operationId` says "create" for a replace-all (delete-missing) semantic. Batch X-TAGGING (directed tagging-coverage batch) confirms the SAME drift fingerprint at the **term** and **dataset-field** tag-relation write endpoints — the operationId/summary/method-name say "create" or "update" but every one of the three is a delete-then-recreate replace-all.

### New `surfaced_by` (batch X-TAGGING)

- `odd-platform__java__TermController__controller-method__createTermTagsRelations.md:docs_link_semantic.doc_drift_findings.[0]` — verbatim: *"The `createTermTagsRelations` operationId / OpenAPI summary use create-language for a replace-all operation. `openapi.yaml:3185` reads `summary: Creates tags relations for term` and the `operationId` is `createTermTagsRelations`; the implementation (`TermServiceImpl.java:254-264` → `TagServiceImpl.deleteRelationsWithTerm:124-134`) deletes every tag relation absent from the submitted list. A third-party API consumer reading only the spec who sends repeated `PUT` calls expecting cumulative tagging will silently lose tags between calls. Same drift shape as the data-entity sibling."* **(NEW batch X-TAGGING — controller-METHOD PRIMARY SOURCE for the TERM tag-relation surface)**
- `odd-platform__java__TermController__controller-method__createTermTagsRelations.md:bugs_limitations_corner_cases.[0]` (MEDIUM per sidecar) — *"Operation name vs behaviour drift: PUT replace-all under create-language naming... A consumer sending `PUT /api/terms/{id}/tags` with `tag_name_list: ['new']` expecting 'add new, keep existing' loses ALL other term tags."*
- `odd-platform__java__TermController__controller-method__createTermTagsRelations.md:bugs_limitations_corner_cases.[1]` (MEDIUM per sidecar) — **the empty-list-clears-all sub-defect**: *"Empty `tag_name_list` silently clears ALL term tags. `TagsFormData` declares `tag_name_list` REQUIRED... but an empty array `[]` satisfies the constraint — there is no `minItems`... A buggy client that forgets to populate `tag_name_list` silently wipes a term's tag set."* Pinned by probe **P-027**.
- `odd-platform__java__DatasetFieldController__controller-method__updateDatasetFieldTags.md:docs_link_semantic.doc_drift_findings.[1]` — verbatim: *"The replace-all (delete-then-recreate) semantic is undocumented. The OpenAPI summary 'Update DatasetField's tags' is at least more honest than the data-entity operationId `createDataEntityTagsRelations`... But neither the spec nor the Permissions doc states that submitting `tags: []` clears all internal dataset-field tags, nor that EXTERNAL_STATISTICS (ingested-statistics) tag relations are preserved across the call."* **(NEW batch X-TAGGING — controller-METHOD PRIMARY SOURCE for the DATASET-FIELD tag-relation surface)**

### Scope expansion — the three tag-relation write endpoints, ranked by operationId honesty

| Endpoint | operationId | Spec summary | Underlying semantic | operationId honesty |
|---|---|---|---|---|
| `PUT /api/dataentities/{id}/tags` | `createDataEntityTagsRelations` | "Creates tags relations for DataEntity entity" | replace-all (diff: delete-missing + insert-new) | **MISLEADING** — "create" for replace-all (DOC-GAP-098 original) |
| `PUT /api/terms/{term_id}/tags` | `createTermTagsRelations` | "Creates tags relations for term" | replace-all (delete-by-name-absence + recreate) | **MISLEADING** — "create" for replace-all (NEW batch X-TAGGING) |
| `PUT /api/datasetfields/{id}/tags` | `updateDatasetFieldTags` | "Updates DatasetField's tags" | replace-all (delete-all-INTERNAL + recreate) | **less misleading** — "update" at least implies replace; but the spec STILL omits the replace-all + auto-create + EXTERNAL_STATISTICS-preservation detail |

DOC-GAP-098's proposed rename action (`replaceDataEntityInternalTagsRelations`) should be extended class-wide:
- `createTermTagsRelations` → `replaceTermTagsRelations` (or `replaceTermInternalTagsRelations` — but note `tag_to_term` has NO `external`/`origin` column, so the replace is unconditional: it touches EVERY relation, not just internal ones).
- `updateDatasetFieldTags` — the operationId is acceptable; the FIX here is the spec `description` block, not the operationId (see DOC-GAP-260 NEW, the dataset-field-specific finding for the replace-all + auto-create + EXTERNAL_STATISTICS-preservation doc gaps that are NOT shared with the data-entity/term endpoints).

The PER-ENDPOINT semantic difference is itself a doc gap: the term path's replace-all is UNCONDITIONAL (no external carve-out — `tag_to_term` has no `external`/`origin` column per `V0_0_35__add_terms.sql:18-28`); the data-entity and dataset-field paths PRESERVE Collector-set relations (`external`/`origin` carve-out). A consumer who learns the data-entity replace-all behaviour and assumes the term path is identical will be surprised that the term path removes EVERY tag relation not in the submitted list (the term path has no ingested-tag set to preserve).

### Relationship to DOC-GAP-260 (NEW batch X-TAGGING)

The dataset-field endpoint's replace-all + auto-create + EXTERNAL_STATISTICS-preservation gaps are the subject of the NEW finding **DOC-GAP-260** (minted this batch) — those are dataset-field-SPECIFIC doc gaps with no prior coverage. DOC-GAP-098 remains the canonical "create-language for replace-all" operationId-misnaming finding spanning all three surfaces; DOC-GAP-260 is the dataset-field-surface completeness finding. They cross-reference each other.

### Cross-reference additions

- **DOC-GAP-260** (NEW batch X-TAGGING — `updateDatasetFieldTags` replace-all + auto-create undocumented) — the dataset-field-surface completeness companion.
- **DOC-GAP-208** (Term-CRUD side-doors) — the term endpoint's TAG_CREATE side-door; DOC-GAP-098's extension to the term surface and DOC-GAP-208's side-door are two distinct undocumented facets of `PUT /api/terms/{term_id}/tags`.
- **DOC-GAP-099 META** (OpenAPI authoring-quality cluster) — DOC-GAP-098 is the operationId-misnamed failure shape's primary source; this batch broadens it to 3 endpoints.

### Coherence note (Rule 6)

Cross-registry sweep this batch: `implicit-adrs/index.md` carries `operation-name-vs-behaviour-drift-create-shaped-operationid-for-replace-all-semantic-tag-relations` (an invariant explicitly spanning the create*-shaped operationIds for replace-all tag relations) AND `upsert-internal-tag-relations-replace-all` — both same polarity. `test-map/index.yaml` carries the replace-all test-gap entries at lines 4596 (`tag_name_list=[]` removes internal tags). `feature-flows/index.yaml` F-018 references the replace-all semantic. NO registry asserts these endpoints are additive. This batch STRENGTHENS DOC-GAP-098; it does not contradict. `coherence_strengthens: 1` for this entry.
