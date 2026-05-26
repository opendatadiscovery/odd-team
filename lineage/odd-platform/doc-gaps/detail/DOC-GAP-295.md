---
doc_gap_id: DOC-GAP-295
severity: HIGH
category: drift
batch: ZG
generated_at: "2026-05-25T00:00:00Z"
generated_at_commit: 4ec2b20
prompt_version: "doc-gap-finder/0.1.0"
maintainer_curated: false
related_pillar_features:
  - "P-01:F-008"   # Schema versioning / diff — the user-facing feature backed by these endpoints
  - "P-02"         # Data Modelling — schema is one of the modelled facets
  - "P-09"         # Security & Access Control — the cross-dataset leak is a security-class drift
related_features: []
related_doc_gaps:
  - DOC-GAP-001    # SecurityConstants wiring family — sibling permission-vs-path silent drift class
  - DOC-GAP-287    # cross-owner read posture cluster — this leak is an additional facet (cross-DATASET, not just cross-owner)
related_retrospectives:
  - LSN-020        # input-name-vs-implementation drift class (here: the `dataEntityId` path parameter is documentation-only)
---

## DOC-GAP-295 — `DatasetController` accepts `data_entity_id` as the load-bearing path-prefix on FOUR endpoints (`GET /api/datasets/{data_entity_id}/structure[/{version_id}|/diff]` + `GET /api/datasets/{data_entity_id}/relationships`) but the parameter is DOCUMENTATION-ONLY on the version-id-keyed and diff variants: the SQL at `ReactiveDatasetVersionRepositoryImpl.java:128-129` filters `DATASET_VERSION.ID.eq(datasetVersionId)` ONLY, with NO `dataset_oddrn` predicate; the diff variant at `ReactiveDatasetVersionRepositoryImpl.java:147-157` filters `DATASET_VERSION.ID.in(datasetVersionIds)` ONLY, with the same omission; ANY authenticated user can request `GET /api/datasets/X/structure/V` with version V belonging to dataset Y and receive Y's full structure (field names + types + descriptions + tags + terms + lookup-table definitions) with HTTP 200 — silent cross-dataset metadata leak via sequential bigserial version_id enumeration; the live `/features/data-discovery/schema-diff` page (status 200) describes the feature but is SILENT on the dataEntityId-is-decorative semantic; the `DATASET_VERSION.DATASET_ODDRN` column IS in the schema AND is JOINED by the latest-path subquery (`ReactiveDatasetVersionRepositoryImpl.java:163-168`) — one-line WHERE clause closure available; this is the LSN-020 input-name-vs-implementation drift instantiated as a security-class leak (operator-visible: the URL pattern looks scoped, the response is not)

**Severity**: HIGH
**Category**: drift (security-class — the input-name promises containment, the SQL does not enforce it; cross-dataset enumeration is unblocked by any layer)

### Surfaced by

- `odd-platform__java__DataSetController__controller-class__DataSetController.md:bugs_limitations_corner_cases.[0]` (HIGH per sidecar) — verbatim: *"`dataEntityId` path parameter is documentation-only (Category F drift): controller accepts `dataEntityId` but it is consumed and dropped by `DatasetController.getDataSetStructureByVersionId` (line 28-30) — only `versionId` reaches `reactiveDatasetVersionRepository.getDatasetVersion` (ReactiveDatasetVersionRepositoryImpl.java:129) which filters by `DATASET_VERSION.ID.eq(datasetVersionId)`. Any authenticated user can request `/api/datasets/X/structure/V` with V belonging to dataset Y and get Y's structure back. The diff variant has the same shape: `getDatasetVersionWithFields(List.of(firstVersionId, secondVersionId))` (line 154) ignores dataEntityId entirely. Operator-visible failure modes: (a) cross-dataset data-exposure of schema metadata (fields, types, tags, terms, lookup-table definitions); (b) URL pattern looks scoped but is not — operators reading the URL might assume containment that doesn't exist."*
- `odd-platform__java__DataSetController__controller-class__DataSetController.md:bugs_limitations_corner_cases.[6]` (HIGH per sidecar) — verbatim: *"`getDatasetVersionWithFields` does not constrain by dataset: the SQL at ReactiveDatasetVersionRepositoryImpl.java:149-156 is `WHERE DATASET_VERSION.ID.in(datasetVersionIds)` with no `dataset_oddrn` predicate; this is the SQL-level confirmation of the Category F drift recorded above."*
- `odd-platform__java__DataSetController__controller-class__DataSetController.md:security.known_security_gaps.[1]` (HIGH per sidecar) — verbatim: *"dataEntityId path component is not validated against the version_id at any layer; cross-dataset enumeration of dataset_version IDs (sequential bigserial) reveals other datasets' schemas"*
- `odd-platform__java__DataSetController__controller-class__DataSetController.md:docs_link_semantic.doc_drift_findings.[0]` — verbatim: *"Schema-diff feature page does not state that the dataEntityId path component is documentation-only (the SQL filters by version_id only); any authenticated user can request structure for any version_id across the platform — see Category F finding routed to bugs_limitations_corner_cases."*
- `odd-platform__java__DataSetController__controller-class__DataSetController.md:stress_findings.request_inputs[dataEntityId]` — Category-F drift `DRIFT_INPUT_NAME_VS_IMPLEMENTATION`; pinned by probe **P-147** (`lineage/odd-platform/probes/P-147.yaml`)
- `odd-platform__java__DataSetController__controller-class__DataSetController.md:stress_findings.name_behavior_pairs[getDataSetStructureDiff]` — `DRIFT_NAME_VS_BEHAVIOR` with operator-visible-consequence: *"The endpoint claims 'diff between two dataset structure versions' but accepts any two version_ids across the platform regardless of the dataset id in the URL; cross-dataset diff produces a 200 response. Missing-id case produces 500, not 404."*
- `odd-platform__java__DataSetController__controller-class__DataSetController.md:tests_coverage_semantic.uncovered_behaviours[Cross-dataset version_id leak]` (HIGH per sidecar)
- `concepts.yaml:entities[DataSetVersion]` + `entities[DataSetStructure]` — the leaked payload concepts.

### Evidence

- `odd-platform/odd-platform-api/src/main/java/.../controller/DatasetController.java:22-50` — the four GET endpoints; each accepts `dataEntityId` at the path-prefix; each forwards `versionId` only (the by-id variant) or both `versionId`s only (the diff variant) to the downstream service.
- `odd-platform/odd-platform-api/src/main/java/.../service/DatasetVersionServiceImpl.java:38-45` — the service uses `datasetId` ONLY in the "not found" error message (lines 41-43); it never reaches the SQL.
- `odd-platform/odd-platform-api/src/main/java/.../repository/reactive/ReactiveDatasetVersionRepositoryImpl.java:128-129` — verbatim from sidecar: `WHERE DATASET_VERSION.ID.eq(datasetVersionId)` — single-predicate filter on the version_id alone. NO `dataset_oddrn` predicate, NO JOIN-side constraint, NO containment check.
- `odd-platform/odd-platform-api/src/main/java/.../repository/reactive/ReactiveDatasetVersionRepositoryImpl.java:147-157` — the diff path SQL: `WHERE DATASET_VERSION.ID.in(datasetVersionIds)` — same shape, multiplied by 2.
- `odd-platform/odd-platform-api/src/main/java/.../repository/reactive/ReactiveDatasetVersionRepositoryImpl.java:160-217` — the latest-path SQL DOES filter by `DATA_ENTITY.ID.eq(datasetId)` (subquery at line 166-167) — so the asymmetry is internally inconsistent: the latest variant honors the path-id; the by-id and diff variants do not.
- `odd-platform/odd-platform-api/src/main/java/.../repository/reactive/ReactiveDatasetVersionRepositoryImpl.java:163-168` (the available-but-unused fix anchor): the latest-path subquery SELECTS `DATASET_VERSION.DATASET_ODDRN` and JOINS `DATA_ENTITY.ODDRN` on it — so a one-line WHERE predicate `AND DATASET_VERSION.DATASET_ODDRN = (SELECT ODDRN FROM DATA_ENTITY WHERE ID = :datasetId)` on the by-id and diff paths would close the leak with zero schema migration.
- WebFetch `https://docs.opendatadiscovery.org/features/data-discovery/schema-diff` 2026-05-25 status **200** (per sidecar `docs_link_semantic.inferred_docs.[0]`) — verbatim excerpt: *"Every re-ingest of a dataset that changes the structure creates a new revision. The revision history is browsable per dataset: pick any two revisions to see exactly what changed between them."* — the page DOES describe the per-dataset framing but says nothing about the lack of server-side enforcement.
- `odd-platform/odd-platform-specification/openapi.yaml:1828-1849` — the OpenAPI for `getDataSetStructure` and `getDataSetStructureByVersionId`: *"Get DataSet structure information ... by DataSet's id and version"* — the spec language strongly implies containment ("by DataSet's id AND version"); the implementation accepts the second alone.
- `odd-platform/odd-platform-specification/openapi.yaml:1853-1854` — the diff OpenAPI: *"Gets difference between two dataset structure versions"* — same containment implication.
- `odd-platform/odd-platform-ui/src/components/.../DatasetStructureCompareHeader.tsx:99,129` — the UI's defence: the Compare-Header sets `disabled` on dropdown options that would pick the same version, but the dropdown is populated from the SAME dataset's versions only (UI-side scope); the URL-level cross-dataset request is unblocked by the backend.
- **The exploit narrative**: an authenticated low-privilege user wants to enumerate sensitive datasets they don't own. `dataset_version.id` is a `bigserial` (sequential). They write a 5-line script: `for v in 1..10000: GET /api/datasets/{any_id}/structure/{v}` — each successful 200 returns the schema of whichever dataset owns `version_id = v`, regardless of the `{any_id}` in the URL. The script enumerates the catalog's schema metadata in O(version_count). The platform emits no audit log of the access (per the read-collaborative posture cluster — DOC-GAP-287).
- **The structural-pattern observation**: the `DATASET_VERSION.DATASET_ODDRN` column exists in the schema, is already joined by the latest-path SQL, and is filterable in a one-line predicate. The fix is mechanically trivial (one WHERE clause per variant); the doc-side disclosure is the immediate operator-facing recourse pending the code fix.

### Drift narrative

The URL pattern `/api/datasets/{data_entity_id}/structure/{version_id}` is a load-bearing operator-mental-model anchor: every operator who reads it parses it as "for the dataset identified by data_entity_id, give me the structure at version_id". The OpenAPI spec reinforces the model ("by DataSet's id and version"). The UI's URL routing (`/dataentities/{id}/structure/overview/{versionId}`) reinforces the model again. The model is wrong: the SQL filters by version_id only.

The drift is silent: the by-id and diff endpoints return HTTP 200 with valid-looking responses for cross-dataset requests. The diff response in particular renders with per-field CREATED/DELETED status semantics computed against the higher-version row — meaningless across datasets but indistinguishable at the wire-format level from a legitimate diff. An operator browsing the diff response cannot tell the request was cross-dataset.

The leaked payload is schema metadata: field names, types, internal descriptions, tags, terms, lookup-table definitions. None of these are row-level data — there is no PII column-value leak — but the schema itself is often sensitive (an internal "personally_identifiable" tag on a column, a description that names the column's regulatory classification, a lookup-table mapping that reveals internal taxonomies). For multi-tenant deployments aspiring to schema-level isolation, the leak is real.

The doc-side absence reinforces the trap: the schema-diff feature page describes the per-dataset framing as the canonical use case (status 200, verbatim "The revision history is browsable per dataset"); the page does not mention that the per-dataset scoping is documentation-only and not enforced server-side.

### Proposed doc action

**Three-part action — doc-side warning + code-side `/log-issue` + spec-side rewording**.

1. **Doc-side PRIMARY — extend `documentation/docs/features/data-discovery/schema-diff.md`** with a "Cross-dataset access" admonition near the end of the page:

   > **Authorization caveat (pending code-side fix).** The `dataEntityId` path component on the schema-version endpoints (`GET /api/datasets/{data_entity_id}/structure/{version_id}` and `GET /api/datasets/{data_entity_id}/structure/diff`) is documentation-only — the backend currently filters by `version_id` ONLY and ignores `data_entity_id`. As a result, any authenticated user can request the structure or diff for any `version_id` in the catalog regardless of the `dataEntityId` in the URL, and receive the version's true owning dataset's schema with HTTP 200. The `getDataSetStructureLatest` variant (no `version_id` in the URL) DOES correctly scope by `dataEntityId`. Operators relying on per-dataset URL scoping for schema-level isolation should treat the schema metadata (field names, types, internal descriptions, tags, terms, lookup-table definitions) as catalog-readable across owners until the code-side fix lands (see [the upstream issue]).

2. **Code-side `/log-issue odd-platform`** — author a backlog item with the one-line fix:
   - At `ReactiveDatasetVersionRepositoryImpl.java:128-129`: change `WHERE DATASET_VERSION.ID.eq(datasetVersionId)` to `WHERE DATASET_VERSION.ID.eq(datasetVersionId) AND DATASET_VERSION.DATASET_ODDRN = (SELECT ODDRN FROM DATA_ENTITY WHERE ID = :datasetId)`.
   - At `ReactiveDatasetVersionRepositoryImpl.java:147-157`: change `WHERE DATASET_VERSION.ID.in(datasetVersionIds)` to the same containment-aware predicate keyed on the `datasetId` the service is already given.
   - Add the `dataEntityId` parameter to the repository method signatures (currently dropped at the service layer per `DatasetVersionServiceImpl.java:42`).
   - Add two regression-pin integration tests: cross-dataset by-id returns 404 (or 403), cross-dataset diff returns 4xx.

3. **Spec-side ALIGNMENT — `odd-platform-specification/openapi.yaml:1828-1854`** — once the code-side fix lands, the spec language ("by DataSet's id and version") becomes truthful; add a `description:` field to each parameter narrating the containment semantic explicitly: *"The dataset's id; the version_id MUST belong to this dataset or the endpoint returns 404."*

### Cross-references

- **DOC-GAP-001** (the original SecurityConstants `/term` vs `/terms` path-mismatch silently-disabling-permissions class — same family) — sibling structural permission/path mismatch
- **DOC-GAP-213** (DatasetField SecurityConstants wiring bugs) — sibling code-vs-doc gate mismatch on the same broader controller surface
- **DOC-GAP-287** (Relationships catalog-global cross-owner cluster) — sibling cross-dataset/cross-owner enumeration finding; the schema-version leak extends the cluster to the schema metadata surface
- **DOC-GAP-296** (sibling — `getDataSetStructureDiff` 500-vs-404 + 4 endpoints missing from api-reference) — the same controller's sibling drift; the same authoring pass closes both
- **LSN-020** — input-name-vs-implementation drift class — this is one more instance (the `dataEntityId` input promises containment, the SQL drops it)
- **probe P-147** — dynamic verification of the cross-dataset response
- **Rule 6 coherence** — cross-registry sweep ran: `feature-flows/index.yaml` has no F-NNN entry for schema-diff that contradicts; `concepts/index.yaml` enumerates `DataSetVersion` + `DataSetStructure` as catalog-readable entities consistent with the cross-owner read posture. No CONTRADICTS, no SUPERSEDES.

### Severity rationale

HIGH. The cross-dataset metadata leak is a security-class drift on a load-bearing read surface (every dataset details page consumes the structure endpoint; every Compare tab consumes the diff). The leaked payload is schema metadata — not row data — so the severity is HIGH not CRITICAL: an operator who restricted catalog access at the deployment perimeter (e.g. by data-entity-owner gating in a reverse proxy) is NOT exposed; an operator who relied on URL-scoped per-dataset access for schema isolation IS exposed. The fix is mechanically trivial (one WHERE clause per variant, one column already in scope); the doc-side warning is the immediate recourse. The operator-trap class (LSN-001 / LSN-002) is the same shape as canonical maintainer-pact violations: the URL looks scoped, the response is not.

### Last verified

- 2026-05-25 — sidecar's static evidence (the SQL WHERE clauses at `ReactiveDatasetVersionRepositoryImpl.java:128-129, 147-157, 160-217`) re-confirmed at substrate commit `4ec2b20`. WebFetch `https://docs.opendatadiscovery.org/features/data-discovery/schema-diff` 200 (per sidecar fetch this session); doc-side silence on the leak re-confirmed. Dynamic cross-dataset response shape deferred to probe P-147.
