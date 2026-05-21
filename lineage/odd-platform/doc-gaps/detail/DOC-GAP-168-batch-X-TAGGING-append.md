## STRENGTHENS — batch X-TAGGING (2026-05-21) — controller-method PRIMARY SOURCES enumerate the 4 side-door paths; `createTag`'s TAG_CREATE gate confirmed as the perimeter-only defence

DOC-GAP-168 was originally surfaced from the `ReactiveTagRepositoryImpl` REPOSITORY-tier sidecar (batch N — the persistence layer performs zero authorization). Batch X-TAGGING (directed tagging-coverage batch) supplies the **controller-METHOD-tier** primary sources that complete the picture: `createTag` (the gated front-door), `createTermTagsRelations` + `updateDatasetFieldTags` (two of the four side-door write paths), and the openapi-tag `tag` sidecar (the spec-level confirmation that authorization is wholly out-of-band).

### New `surfaced_by` (batch X-TAGGING)

- `odd-platform__java__TagController__controller-method__createTag.md:bugs_limitations_corner_cases.[5]` (HIGH per sidecar) — verbatim: *"Side-door directory growth bypasses `createTag`'s `TAG_CREATE` gate — this endpoint requires `TAG_CREATE`, but four distinct paths mint global `tag` rows WITHOUT it: `TagServiceImpl.updateRelationsWithDataEntity` (via `PUT /api/dataentities/{id}/tags`, gated `DATA_ENTITY_TAGS_UPDATE`), `TermServiceImpl.upsertTags` (`TermServiceImpl.java:257`, via `PUT /api/terms/{term_id}/tags`, gated `TERM_TAGS_UPDATE`), `DatasetFieldServiceImpl` (via `PUT /api/datasetfields/{id}/tags`, gated `DATASET_FIELD_TAGS_UPDATE`), and `ExternalTagIngestionRequestProcessor.process` (`:104`, via `POST /ingestion/entities` Collector push, gated only by the S2S `auth.ingestion.filter.enabled` filter). All reach `tagService.getOrCreateTagsByName` / `getOrInjectTagByName`."* **(NEW batch X-TAGGING — controller-METHOD PRIMARY SOURCE — the `createTag` sidecar enumerates ALL FOUR side-door paths from the gated-front-door's perspective)**
- `odd-platform__java__TagController__controller-method__createTag.md:stress_findings.auth_gates` (the `POST /api/tags` auth-gate block) — verbatim: *"a 403 on `createTag` does NOT mean the user cannot create directory rows."* This is the controller-tier confirmation of the exact operator-trap DOC-GAP-168 describes.
- `odd-platform__java__TermController__controller-method__createTermTagsRelations.md:bugs_limitations_corner_cases.[2]` (MEDIUM per sidecar) — verbatim: *"Permission side-door: `TERM_TAGS_UPDATE` mints global Tag directory rows without `TAG_CREATE`. A caller with `TERM_TAGS_UPDATE` on any single term can submit `tag_name_list: ['arbitrary-new-name']` and a new row appears in the global `tag` directory... `TAG_CREATE` is `MANAGEMENT`-scoped (`PolicyPermissionDto.java:62`), while `TERM_TAGS_UPDATE` is `TERM`-scoped (`PolicyPermissionDto.java:48`, conditionally grantable)."* **(NEW batch X-TAGGING — controller-METHOD PRIMARY SOURCE for the TERM side-door path)**
- `odd-platform__java__DatasetFieldController__controller-method__updateDatasetFieldTags.md:bugs_limitations_corner_cases.[1]` (MEDIUM per sidecar) — verbatim: *"Permission side-door: `DATASET_FIELD_TAGS_UPDATE` mints global Tag directory rows without `TAG_CREATE` — submitting `tags: ['arbitrary-new-name']` runs `getOrCreateTagsByName`, which auto-creates a row in the global `tag` directory... A per-data-entity owner can therefore mint global tag rows. Same pattern shape as the `createDataEntityTagsRelations` side-door — but with one WORSE property: the data-entity endpoint's spec text at least documents the auto-create (`openapi.yaml:1174`); the dataset-field endpoint's spec (`openapi.yaml:2500`) does not mention it at all."* **(NEW batch X-TAGGING — controller-METHOD PRIMARY SOURCE for the DATASET-FIELD side-door path)**
- `odd-platform__openapi__tags__openapi-tag__tag.md:docs_link_semantic.doc_drift_findings.[4]` — verbatim: *"The spec encodes no `security:` and no `securitySchemes`; a consumer reading the contract cannot derive that the three write operations need `TAG_CREATE` / `TAG_UPDATE` / `TAG_DELETE` while `getPopularTagList` needs only `authenticated()`."* **(NEW batch X-TAGGING — openapi-tag-tier confirmation: the side-door is invisible at the spec layer too)**

### Live re-verification (batch X-TAGGING, 2026-05-21 — non-negotiable per Rule 1)

- WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions` 2026-05-21 status **200** (direct fetch this session): the page lists the entity-level tag permissions with single-action descriptions — `DATA_ENTITY_TAGS_UPDATE` = *"Allows editing a data entity's tags."*, `TERM_TAGS_UPDATE` = *"Allows editing tags for a term."*, `DATASET_FIELD_TAGS_UPDATE` = *"Allows adding or removing tags from an individual dataset field."* The page **does NOT** state that any of these can create new global tag-directory rows. The drift is live and has NOT decayed.
- WebFetch `https://docs.opendatadiscovery.org/features/data-discovery/tagging` 2026-05-21 status **200** (direct fetch this session): the page describes the three `TAG_*` permissions and mentions *"create a new tag inline"* but is silent that inline creation runs under a per-entity permission, NOT `TAG_CREATE`. Local source `documentation/docs/data-discovery/tagging.md:26,32` confirmed by Read this session — same gap.

### Scope expansion — the side-door is now confirmed at THREE entity surfaces + the ingestion path

DOC-GAP-168's original framing centred on `DATA_ENTITY_TAGS_UPDATE`. Batch X-TAGGING confirms the SAME architectural side-door at the **term** surface (`TERM_TAGS_UPDATE`) and the **dataset-field** surface (`DATASET_FIELD_TAGS_UPDATE`), each via the shared `getOrCreateTagsByName` chain. The `createTag` sidecar's enumeration is the canonical 4-path list:

| Path | Endpoint | Gated by | Reaches |
|---|---|---|---|
| `createTag` (the FRONT DOOR) | `POST /api/tags` | `TAG_CREATE` | `bulkCreate` |
| `updateRelationsWithDataEntity` | `PUT /api/dataentities/{id}/tags` | `DATA_ENTITY_TAGS_UPDATE` | `getOrCreateTagsByName` |
| `TermServiceImpl.upsertTags` | `PUT /api/terms/{term_id}/tags` | `TERM_TAGS_UPDATE` | `getOrCreateTagsByName` |
| `DatasetFieldServiceImpl` | `PUT /api/datasetfields/{id}/tags` | `DATASET_FIELD_TAGS_UPDATE` | `getOrCreateTagsByName` |
| `ExternalTagIngestionRequestProcessor.process` | `POST /ingestion/entities` | S2S `auth.ingestion.filter.enabled` only | `getOrInjectTagByName` |

The proposed doc-action's permissions-page edit (item 2) should expand from the single `DATA_ENTITY_TAGS_UPDATE` row to ALL THREE entity-level tag-permission rows — `DATA_ENTITY_TAGS_UPDATE`, `TERM_TAGS_UPDATE`, `DATASET_FIELD_TAGS_UPDATE` each gets the same caveat sentence ("**This permission ALSO authorizes minting new rows in the global Tag directory**...").

### Relationship to DOC-GAP-208 (term + namespace side-door)

DOC-GAP-208 (batch U) already documents the `TERM_TAGS_UPDATE` → `TAG_CREATE` side-door from the TermController controller-CLASS sidecar's perspective. This batch's `createTermTagsRelations` controller-METHOD sidecar is the finer-grained primary source for the SAME term-side-door strand — the two are consistent; DOC-GAP-168 remains the canonical Tag-directory-side-door finding, DOC-GAP-208 remains the canonical Business-Glossary-permission-table finding, and they cross-reference each other. No new finding is minted for the term strand.

### Cross-reference additions

- **DOC-GAP-208** (Term-CRUD side-doors NAMESPACE_CREATE + TAG_CREATE) — the term-side strand of this same side-door; co-surfaced this batch from the `createTermTagsRelations` method sidecar.
- **DOC-GAP-098** (operationId-misnaming) — the dataset-field + term replace-all surfaces that DOC-GAP-098-batch-X-TAGGING-append now extends; the side-door and the replace-all are two distinct undocumented facets of the same three endpoints.
- **REFACTOR-223** (`refactoring-scopes/index.md:3188`) — the canonical refactor scope; `feature-flows/index.yaml` confirms REFACTOR-223 has advanced to a 4-path side-door enumeration (incl. the `postDataSetStatsList` UNAUTHENTICATED stats-ingestion path) — consistent with this batch's 5-row table above.

### Coherence note (Rule 6)

Cross-registry sweep this batch: `refactoring-scopes/index.md` REFACTOR-223 + `feature-flows/index.yaml` F-018 drift facet `tag_create_bypass_via_upsert_tags` + `implicit-adrs/index.md` invariants `spec-documented-auto-create-with-scope-asymmetry-tag-side-door-past-tag-create` and `namespace-create-tag-create-side-doors-via-termcontroller-unguarded-paths` + `test-map/index.yaml` TEST-GAP-763 — ALL same polarity (the side-door exists; it bypasses `TAG_CREATE`). No registry asserts the opposite. This batch STRENGTHENS DOC-GAP-168 with controller-tier primary sources; it does not contradict. `coherence_strengthens: 1` for this entry.
