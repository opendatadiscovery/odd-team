## STRENGTHENS — Batch X-TAGGING (ADR-CANDIDATE-065 — 2 new confirmations of tag auto-create-on-miss + a spec-acknowledgment asymmetry refinement)

**Two new sidecars confirm the tag auto-create-on-miss decision at two additional per-entity tag-write paths, and surface a refinement: the spec-acknowledgment that distinguishes the Tag side-channel from the Owner/Title parallels is PRESENT for the data-entity + term paths but ABSENT for the dataset-field path.**

- `createTermTagsRelations.md:implicit_adrs[3]` — "Tag auto-creation on term-tag assignment is INTENTIONAL and documented at the spec layer — `openapi.yaml:3186` explicitly reads 'Also creates corresponding tags in the system if they don't exist.' This is the same deliberate low-friction UX decision as the data-entity tag path." (intent_anchor: the verbatim `openapi.yaml:3186` description). The term path reaches `getOrCreateTagsByName` → `divideTagsByExistence`, which `bulkCreate`s any name not found with `important = false` hardcoded (`TagServiceImpl.java:155`).
- `updateDatasetFieldTags.md:implicit_adrs` + `docs_link_semantic.doc_drift_findings[0]` — the dataset-field path reaches the SAME `getOrCreateTagsByName` and auto-creates with `important = false` — **BUT** "the auto-create-tag side effect is UNDOCUMENTED for this endpoint at every layer. The OpenAPI description (`openapi.yaml:2500`, 'Updates DatasetField's tags') does not mention it; the data-entity sibling endpoint's spec text DOES (`openapi.yaml:1174`)."
- `createTag.md:bugs_limitations_corner_cases[5]` — independently corroborates that the four side-door paths (`TermServiceImpl`, `DataEntityServiceImpl`, `DatasetFieldServiceImpl`, `ExternalTagIngestionRequestProcessor`) reach `getOrCreateTagsByName` / `getOrInjectTagByName` and create directory rows WITHOUT holding `TAG_CREATE`.

**Refinement to the ADR**: ADR-CANDIDATE-065's central claim is that the Tag auto-create is DISTINGUISHED from the Owner/Title side-channels by being **spec-acknowledged**. The batch-X evidence shows the spec-acknowledgment is NOT uniform across the three per-entity tag-write paths:
- **Data-entity** (`PUT /api/dataentities/{id}/tags`) — spec-acknowledged at `openapi.yaml:1174`.
- **Term** (`PUT /api/terms/{term_id}/tags`) — spec-acknowledged at `openapi.yaml:3186`.
- **Dataset-field** (`PUT /api/datasetfields/{dataset_field_id}/tags`) — **NOT** acknowledged; `openapi.yaml:2500` says only "Updates DatasetField's tags".

The ADR draft should be updated to state: the auto-create is intentional and CONSISTENT across all three entity paths (same `getOrCreateTagsByName` code, same `important = false` default), but the SPEC-DOCUMENTATION of it is inconsistent — present for 2 of 3. The dataset-field spec gap is itself a doc-gap (tracked by doc-gap-finder); it does not change the ADR's "intentional" verdict, but it means the "spec-acknowledged" distinguishing property the ADR leans on is only 2/3 true.

**Support count**: 1 → 3 sidecars (`createDataEntityTagsRelations` original + `createTermTagsRelations` + `updateDatasetFieldTags`; `createTag` corroborates the side-door inventory).

**Co-surfaced gap**: REFACTOR-223 (the tag side-door — `*_TAGS_UPDATE` mints directory rows without `TAG_CREATE`) is STRENGTHENED to 4 paths this batch — see `refactoring-scopes/detail/REFACTOR-223.md`'s batch-X STRENGTHENS block.

**Severity unchanged**: MEDIUM.

---
