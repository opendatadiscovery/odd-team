## STRENGTHENS — Batch X-TAGGING (REFACTOR-223 — the tag side-door is confirmed at 4 paths; primary-source controller-method evidence for the term + dataset-field paths)

**Three new sidecars confirm the tag side-door — `*_TAGS_UPDATE` mints global `tag` directory rows without `TAG_CREATE` — at additional entry points, bringing the confirmed-path count to 4 with controller-method primary-source evidence.**

The original REFACTOR-223 surfaced from the `createDataEntityTagsRelations` sidecar (the data-entity path: `DATA_ENTITY_TAGS_UPDATE` → `getOrCreateTagsByName`). Batch X-TAGGING adds:

1. **Term path** — `createTermTagsRelations.md:bugs_limitations_corner_cases[2]`: "Permission side-door: `TERM_TAGS_UPDATE` mints global Tag directory rows without `TAG_CREATE`. A caller with `TERM_TAGS_UPDATE` on any single term can submit `tag_name_list: ['arbitrary-new-name']` and a new row appears in the global `tag` directory." The scope asymmetry: `TERM_TAGS_UPDATE` is `TERM`-scoped (`PolicyPermissionDto.java:48`, conditionally grantable); `TAG_CREATE` is `MANAGEMENT`-scoped (`:62`, unconditional). Evidence: `TagServiceImpl.java:80-86` + `SecurityConstants.java:138, 185-186` + `PolicyPermissionDto.java:48, 62`.

2. **Dataset-field path** — `updateDatasetFieldTags.md:bugs_limitations_corner_cases[1]`: "Permission side-door: `DATASET_FIELD_TAGS_UPDATE` mints global Tag directory rows without `TAG_CREATE`. ... Worse than the data-entity sibling: that endpoint's OpenAPI text documents the auto-create (`openapi.yaml:1174`); the dataset-field endpoint's spec (`openapi.yaml:2500`) does not mention it at all." `DATASET_FIELD_TAGS_UPDATE` is `DATA_ENTITY`-scoped (`PolicyPermissionDto.java:32`) — a per-data-entity owner can mint global tag rows. Evidence: `TagServiceImpl.java:79-86` + `SecurityConstants.java:288-290` + `PolicyPermissionDto.java:32`.

3. **`createTag` inventory corroboration** — `createTag.md:bugs_limitations_corner_cases[5]` independently enumerates ALL FOUR side-door call sites: `TagServiceImpl.updateRelationsWithDataEntity` (data-entity), `TermServiceImpl.upsertTags` (term), `DatasetFieldServiceImpl` (dataset-field), and `ExternalTagIngestionRequestProcessor.process` (S2S Collector ingestion). The fourth path — S2S ingestion — is gated only by the `auth.ingestion.filter.enabled` filter (default OFF — REFACTOR-078 family), so it is a side-door with an even weaker gate.

**Refined finding**: REFACTOR-223 is now a **4-path** permission-bypass — `DATA_ENTITY_TAGS_UPDATE` + `TERM_TAGS_UPDATE` + `DATASET_FIELD_TAGS_UPDATE` + S2S ingestion all mint global `tag` directory rows without `TAG_CREATE`. The dataset-field path is the WORST documented (its spec does not even acknowledge the auto-create — see the ADR-CANDIDATE-065 batch-X STRENGTHENS block). The remedy options in the original REFACTOR-223 (accept-and-document / require-`TAG_CREATE`-for-novel-names / allowlist-only) now apply across all four paths, and the chosen fix must be consistent across them.

**Severity unchanged**: MEDIUM — the additional confirmations strengthen the finding (4 entry points, controller-method primary source) but do not change the severity calculus: the blast radius is still "the global tag dropdown is polluted across tenants", bounded by the absence of name-length validation (REFACTOR-493). The fix is now a 4-path coordinated change.

---
