## STRENGTHENS — Batch X-TAGGING (ADR-CANDIDATE-002 — 5 new tag-mutation write-path confirmations)

**Five new write-path sidecars confirm that authorization is wired at the `SecurityConstants.SECURITY_RULES` path-matcher layer, not via `@PreAuthorize` on the controller or its generated `*Api` interface.** Every tag-mutation controller-method carries ZERO `@PreAuthorize`; the service tier carries zero programmatic permission checks; the path-pattern `SecurityRule` is the SOLE gate.

- `createTag.md:security.authorization_assertions` — "POST `/api/tags` gated by `TAG_CREATE` (Management scope, `NO_CONTEXT`) — `SecurityConstants.java:138`. No `@PreAuthorize` on the `createTag` method and no programmatic permission check in its chain."
- `updateTag.md:security.authorization_assertions` — "PUT `/api/tags/{tag_id}` gated by `TAG_UPDATE` (Management scope, `NO_CONTEXT`) — `SecurityConstants.java:138-142`. The endpoint inherits the service-tier zero-checks posture."
- `deleteTag.md:security.authorization_assertions` — "`DELETE /api/tags/{tag_id}` → `TAG_DELETE` permission — `SecurityConstants.java:141-142` (the `SecurityRule` with `PathPatternParserServerWebExchangeMatcher`). No `@PreAuthorize` on the controller method and no programmatic `permissionService` call in the service."
- `createTermTagsRelations.md:implicit_adrs[0]` + `security.authorization_assertions` — "`new SecurityRule(TERM, ..."/api/terms/{term_id}/tags", PUT), TERM_TAGS_UPDATE)` — registered at `SecurityConstants.java:185-186`... NOT on the controller method (`TermController.java:129-136` has no `@PreAuthorize`) and NOT in `TermServiceImpl.upsertTags`." This entry also carries a **`TERM` resource-context** (per-term evaluation via the `TERM` `AuthorizationManagerType`) — sharpening the resource-scoped vs `NO_CONTEXT` distinction the catalog tracks.
- `updateDatasetFieldTags.md:security.authorization_assertions` — "`new SecurityRule(DATASET_FIELD, '/api/datasetfields/{dataset_field_id}/tags' PUT, DATASET_FIELD_TAGS_UPDATE)` — `SecurityConstants.java:288-290`. The `DATASET_FIELD` authorization-manager type resolves the path's `dataset_field_id` to the PARENT data-entity id via `DatasetFieldResourceExtractor`, then evaluates the permission against that parent." A **parent-resource-resolved** `SecurityRule` — the `DATASET_FIELD` type resolves a sub-resource id to its owner before evaluation.

**Architectural refinement**: the tag-mutation surface adds three distinct resource-context shapes to the catalog: `NO_CONTEXT` Management-scope (the three `TAG_*` permissions on `/api/tags*`), per-`TERM`-resource-context (`TERM_TAGS_UPDATE`), and parent-resolved `DATASET_FIELD`-context (`DATASET_FIELD_TAGS_UPDATE` resolved to the parent data entity). All three confirm the same core ADR — the gate lives in `SECURITY_RULES`, never on the controller.

**Support count**: extended by 5 write-path sidecars. The DISABLED-mode bypass consequence (REFACTOR-185 family) extends to all five tag-mutation endpoints — see `refactoring-scopes/index-batch-X-TAGGING-append.md`.

**Severity unchanged**: HIGH.

---
