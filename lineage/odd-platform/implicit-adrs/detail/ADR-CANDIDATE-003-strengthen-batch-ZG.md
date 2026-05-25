# ADR-CANDIDATE-003 — GET endpoints are intentionally outside `SECURITY_RULES`; only mutating routes carry permission gates — reads are uniformly authenticated-only, no role/owner/permission gate

## STRENGTHENS — batch ZG (2026-05-25 — four new invocation sites: DataEntityRunController + DataQualityRunsController + DatasetFieldController GETs + DataSetController GETs)

**Four new invocation-site confirmations** join the 9-sidecar support set established at batch ZF; the running total is now **13+ sidecars** spanning detail / lineage / attachments / directory / alerts / activity / search / permissions discovery / **runs-history (NEW ZG) / DQ-dashboard (NEW ZG) / column-metadata-reads (NEW ZG) / dataset-structure-reads (NEW ZG)**:

- `odd-platform__java__DataEntityRunController__controller-class__DataEntityRunController.md:security.authorization_assertions` — "the controller method carries no `@PreAuthorize`, no programmatic `permissionService.hasPermission(...)` call, no `@Secured` annotation. The catch-all `.pathMatchers('/**').authenticated()` (`AuthorizationCustomizer.java:29-30`) is the entire gate. **The endpoint is NOT listed in `SecurityConstants.SECURITY_RULES`** (verified: grep over SecurityConstants.java:98-355 returns zero matches for `/runs`). This is a NEW invocation site of the read-collaborative posture (REFACTOR-024 family extension to 5th site)." The runs-history payload includes `status_reason` — a free-form diagnostic field commonly carrying Great Expectations / dbt failed-row sample values; cross-owner read of this field is a PII-broadcast channel (gap-side: REFACTOR-652).

- `odd-platform__java__DataQualityRunsController__controller-class__DataQualityRunsController.md:implicit_adrs.[1]` (HIGH) — "**The dashboard exposes the catalog-wide DQ aggregate to any authenticated user with no owner predicate — read-collaborative posture (ADR-CANDIDATE-003) applied to P-04.**" — intent_anchor: "SecurityRule(DATA_ENTITY, new PathPatternParserServerWebExchangeMatcher(\"/api/datasets/{data_entity_id}/dataqatests/{dataqa_test_id}/severity\", PUT), DATASET_TEST_RUN_SET_SEVERITY)" (`SecurityConstants.java:243-246` — a sibling DQ rule WAS registered for severity-set; the absence here is by-contrast deliberate). The DQ-dashboard surface is the catalog-wide aggregate equivalent of REFACTOR-187 (search-result enumeration) — same shape, different vector.

- `odd-platform__java__DatasetFieldController__controller-class__DatasetFieldController.md:implicit_adrs.[3]` (HIGH) — "**Two read endpoints (`getEnumValues`, `getDatasetFieldMetrics`) intentionally OMITTED from `SecurityRule` — any authenticated user can read them on any field-id, matching the platform's read-collaborative posture.**" — intent_anchor: "Lines 74-86 expose `getEnumValues` (GET /enum_values) and `getDatasetFieldMetrics` (GET /metrics). `SecurityConstants.java:282-303` declares SecurityRule entries for `name PUT`, `description PUT`, `tags PUT`, `enum_values POST`, `terms POST`, `terms/{term_id} DELETE` — but NOT for `enum_values GET` or `metrics GET`. The omission is intentional and uniform across the platform — read endpoints fall back to the global authentication-only gate." The COLUMN-LEVEL READ surface is the deepest extension: column-grain reads are unscoped, matching the entity-grain reads.

- `odd-platform__java__DataSetController__controller-class__DataSetController.md:bugs_limitations_corner_cases.[1]` (MEDIUM) — "**No owner-scoping** at any layer: GET endpoints fall through to `AuthorizationCustomizer.spec.pathMatchers('/**').authenticated()` and `SecurityConstants.SECURITY_RULES` declares no rule for `/api/datasets/{data_entity_id}/structure*` or `/api/datasets/{data_entity_id}/relationships`. Every authenticated user reads every dataset's structure." 4 GETs (structure / structure/{v} / structure/diff / relationships) all unscoped — the dataset-structure read surface (column names, types, descriptions, tags, terms, lookup-table definitions, relationships) is cross-owner.

The pattern is now the platform's UNIVERSAL READ POSTURE — every read endpoint in every controller falls under this ADR. The DataEntity write/read asymmetry is uniform: writes have SecurityRules + permission gates; reads have NEITHER. The blast-radius family (REFACTOR-024 et al.) catalogues the operational consequences.

**Cross-batch refinement** (batch ZG's contribution to the read-collaborative architecture):

The ADR's invocation-site count now exceeds 13 controllers + endpoints. Notable batch-ZG additions to the architecture's specificity:

- **Per-test-RUN reads (run-history)** — DataEntityRunController exposes the diagnostic content of every test run including `status_reason` text. The cross-owner posture extends from "you can see which tests exist" to "you can see WHY each test failed, with framework-emitted diagnostics potentially containing PII."
- **Catalog-wide DQ aggregates** — DataQualityRunsController surfaces the catalog cardinality (per-category × per-status test counts, table-health counts, monitored-table counts) cross-owner. The dashboard surface is the QUALITY POSTURE enumeration analogue of REFACTOR-187 (catalog enumeration via search).
- **Column-level metadata reads** — DatasetFieldController's GETs expose enum_values (column value semantics) and metrics (column-level metric stats) cross-owner. The COLUMN-GRAIN surface is the deepest extension — the platform's read-collaborative model is now confirmed at every grain (catalog / entity / column).
- **Dataset structure reads** — DataSetController exposes the full column-level structure cross-owner. Combined with REFACTOR-657 (cross-dataset version_id leak), an authenticated user can enumerate every dataset's schema by guessing version_ids.

The doc-side gap (live security docs do not enumerate the read-collaborative blast radius) is now anchored at FOUR new surfaces this batch; the maintainer's documentation workflow should disclose the cross-owner posture on EVERY feature page that has a read endpoint (P-01 / P-04 / P-05 / P-06 / P-07).

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-003 (canonical posture); ADR-CANDIDATE-114 (read-cardinality split — DataEntityRunController is a per-entity unscoped read, matching the per-entity tier of the split).
- SUPERSEDES: none.
- CONFLICTS: none. The borderline_flag is REMOVED per batch F resolution; this batch adds confirmation, not re-opening.

---
