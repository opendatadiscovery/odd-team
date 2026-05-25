# ADR-CANDIDATE-224 — Per-column DATASET_FIELD permissions are PARENT-SCOPED via `DatasetFieldResourceExtractor` — every field-level permission resolves to the parent DataEntity's permission; there is NO field-level permission check

**Classification**: promote
**Severity**: HIGH
**Pillars affected**: [P-09 Security & Access Control, P-01 Data Discovery (column-level metadata editing)]
**Batch**: ZG (2026-05-25)

**Surfaced by**:
- `odd-platform__java__DatasetFieldController__controller-class__DatasetFieldController.md:implicit_adrs.[1]` (HIGH) — "**Authorization is parent-scoped — every DATASET_FIELD permission resolves to the parent DataEntity's permission via `DatasetFieldResourceExtractor`; there is NO field-level permission check.**" — intent_anchor: "`DatasetFieldResourceExtractor.java:26`: `.flatMap(datasetFieldRepository::getDataEntityIdByDatasetFieldId)` — the resolver's final step returns the parent `data_entity.id`, not the `dataset_field.id`. The downstream `ReactiveAuthorizationManager` then evaluates the permission against the parent DataEntity."

**Decision statement**: Authorization for the 7 DatasetField endpoints under `/api/datasetfields/{dataset_field_id}/...` runs through `DatasetFieldResourceExtractor` (`DatasetFieldResourceExtractor.java:21-27`), a custom `ResourceExtractor` whose final step is `reactiveDatasetFieldRepository.getDataEntityIdByDatasetFieldId(id)` — the resolver returns the PARENT `data_entity.id`, NOT the `dataset_field.id`. The downstream `ReactiveAuthorizationManager` then evaluates the permission against the parent DataEntity, NOT against the individual field.

The structural primitives:
1. **Six `SecurityRule` entries** at `SecurityConstants.java:282-303` keyed on `AuthorizationManagerType.DATASET_FIELD`. The type name says "field" but the extractor resolves to the parent.
2. **The resolution chain**: `DatasetFieldResourceExtractor.extractResourceId(exchange)` → reads `dataset_field_id` from the path → calls `getDataEntityIdByDatasetFieldId(fieldId)` → returns the parent DataEntity id → the permission manager evaluates `DATASET_FIELD_DESCRIPTION_UPDATE` (or whichever permission) AGAINST that DataEntity.
3. **No field-level permission storage** — `dataset_field` table has no permission rows; `policy` documents bind to DataEntity-scope resources only.

The architectural choice: a user holding `DATASET_FIELD_DESCRIPTION_UPDATE` on `data_entity_id=42` can update the description of ANY field of entity 42; the same user holding that permission on a different DataEntity cannot update fields of entity 42. The permission's grain is per-DataEntity; the per-FIELD path component is purely a routing detail, not a permission key.

The decision encodes a design hypothesis: per-column permissions would be operationally infeasible — a Data Entity has typically 10-100 columns; per-column grant/revoke would require N×M (users × columns) permission rows; the operator's mental model is "Alice owns Customer table" not "Alice owns Customer.email but not Customer.address".

**Wisdom test**: PASS. Three intent anchors:
1. **Custom extractor exists** — the platform defines `DatasetFieldResourceExtractor` specifically for this resolution; the SQL join (`dataset_field → dataset_structure → dataset_version → data_entity`) is purpose-built for this lookup.
2. **Type name vs behaviour** — `AuthorizationManagerType.DATASET_FIELD` is the type name, but the resolution returns DataEntity id. The disjunction is deliberate — the type name carries the URL-routing semantic, the resolution carries the permission semantic.
3. **Schema-level** — no `dataset_field` column or `policy` document references field-level grants. The schema commits to per-DataEntity grants only.

Structural impact: every DATASET_FIELD permission inherits the parent's scope. Adding a true field-level permission would require (a) a new `policy` document type, (b) a new `policy_field` table or equivalent, (c) a new extractor that returns the field id, (d) a different `ReactiveAuthorizationManager` that evaluates against the field-level row. Four-site structural change.

**Operator-visible consequence**:
- An operator granting `DATASET_FIELD_DESCRIPTION_UPDATE` on DataEntity X gives the grantee description-edit rights on EVERY field of X.
- A "this column is sensitive — only Alice can edit its description" policy CANNOT be expressed in the current model.
- Per-request authorization incurs ONE DB round-trip (the extractor's parent lookup) BEFORE the controller method runs (gap-side surfaced as REFACTOR-666 — no cache on the parent lookup).

**Existing ADR**: closely related to **ADR-CANDIDATE-051** (Resource-type↔context coupling at PolicyTypeDto.hasContext — the platform's permission model is resource-scoped, not column-scoped). This ADR is the COLUMN-SURFACE consequence of the resource-scoped permission model: since the policy model has no column-level resource context, the column-level permissions inherit the parent.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- **REFACTOR-666 NEW** — per-request DB round-trip via `DatasetFieldResourceExtractor.extractResourceId`. The structural choice (per-request resolution, no cache) is the perf-side gap.
- **REFACTOR-482** STRENGTHENED — TWO SecurityConstants wiring bugs at lines 295-299 (alert-status gated by DATASET_FIELD_ADD_TERM + datasetfields/terms gated by DATA_ENTITY_ADD_TERM). The parent-scoping ADR exists, but the wiring bugs mean the wrong permission keys are checked.

**Proposed action**: Promote to `adrs/drafts/dataset-field-parent-scoped-authz.md` (new ADR). Document:
1. The decision: per-column DATASET_FIELD permissions resolve to the parent DataEntity's permission via `DatasetFieldResourceExtractor`.
2. The structural anchor: the resolver's `getDataEntityIdByDatasetFieldId` SQL join.
3. The operator-facing implication: per-column granular permissions CANNOT be expressed; the operator's grant scope is per-DataEntity.
4. The rationale: per-column permissions would be operationally infeasible; the operator's mental model is per-DataEntity.
5. The performance trade-off: per-request resolution incurs one DB round-trip (no cache); REFACTOR-666 captures the perf-side gap.
6. The doc-side gap: the live permission docs document `DATASET_FIELD_*` permissions without explaining the parent-scoping resolution; an operator may infer field-level granularity from the names.

**Severity rationale**: HIGH — security-architecture decision affecting the entire column-metadata-editing surface; load-bearing for the operator's grant model + the policy schema's resource-scoping choice. Defines what permissions the platform CAN express and what it CANNOT.

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-051 (resource-scoped permission model — the column-surface consequence).
- SUPERSEDES: none.
- CONFLICTS: live permission docs (e.g., `/configuration-and-deployment/enable-security/authorization/permissions`) describe DATASET_FIELD permissions without explaining parent-scoping resolution; the ADR exposes a doc-side gap (operators reading docs may infer field-level granularity).

---
