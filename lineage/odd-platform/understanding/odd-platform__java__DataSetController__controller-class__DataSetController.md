---
node_id: "odd-platform java DataSetController controller-class:DataSetController"
node_kind: controller-class
axis: controllers
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.4.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-25-batch-ZG
---

# DatasetController — semantic understanding

## understanding

DatasetController is the thin Spring-WebFlux controller that exposes four
GET endpoints under `/api/datasets/{data_entity_id}/...`: three for dataset
schema-version retrieval (latest, by-version-id, diff between two versions)
and one for dataset relationships (ERD / GRAPH). Each method is a one-liner
that forwards to `DatasetVersionService` or `RelationshipsService` and wraps
the response in `ResponseEntity.ok`. All real semantics live downstream —
in particular the repository layer of `ReactiveDatasetVersionRepositoryImpl`
defines what "latest" means (`max(DATASET_VERSION.VERSION)` — monotonic
version number, NOT `created_at`) and how cross-version diffs are computed
(via a server-side join + in-memory tree comparison in
`DatasetVersionServiceImpl.buildDataSetVersionDiffList`). The controller
itself enforces no authorization beyond Spring Security's `.authenticated()`
default; the `data_entity_id` path parameter is consumed but never re-checked
against the version-ids supplied — a Category F drift.

## concepts

- entities:
    - DataSetStructure (response — dataset version + field list)
    - DataSetVersion (one row of dataset_version table; carries `version` bigint + createdAt)
    - DataSetVersionDiffList (response — paired field states across two versions)
    - DataEntityRelationshipDetailsList (response — relationship records by type)
    - RelationshipsType (request enum — ERD | GRAPH | ALL)
- operations:
    - get-dataset-structure-by-version-id (point lookup, version-id keyed)
    - get-latest-dataset-structure (max-version-number lookup)
    - compute-dataset-structure-diff (two version-ids → field-level diff with CREATED/UPDATED/DELETED/NO_CHANGES status)
    - list-dataset-relationships-by-type (ERD/GRAPH per-dataset slice)
- invariants:
    - dataset versions are numbered monotonically (+1 per re-ingest) by `DatasetStructureIngestionRequestProcessor.incrementDatasetVersion` (DatasetStructureIngestionRequestProcessor.java:171-178). "Latest" relies on this monotonicity.
    - diff endpoint REJECTS identical version_ids at the service layer (DatasetVersionServiceImpl.java:59-61).
    - field diff comparison is structure-hash-based (DatasetVersionServiceImpl.java:218-224 — invokes `DatasetVersionHashCalculator`).
- audiences:
    - odd-platform UI: Structure tab (`DatasetStructureOverview.tsx:27-39`) and Compare tab (`DatasetStructureCompare.tsx:30-35`); Relationships tab on dataset detail.
    - third-party API consumers reading dataset schemas / change-streams for downstream data-contracts tooling.

## dependencies_semantic

- requires-feature:
    - dataset-version ingestion pipeline (the only writer to `dataset_version` + `dataset_structure` tables; without it, all four endpoints return 404).
    - relationships ingestion (ERD / GRAPH edges populated via collector adapters; without it, the relationships endpoint returns an empty list).
- requires-config:
    - none directly on this controller; transitively requires `spring.r2dbc.*` (DB), `auth.type` (which decides whether `.authenticated()` is a no-op or a real gate via `DisabledAuthSecurityConfiguration` vs the active LOGIN_FORM/OAUTH2/LDAP config).
- requires-runtime:
    - Spring WebFlux reactor stack (Mono signatures).
    - PostgreSQL with `dataset_version`, `dataset_structure`, `dataset_field`, `data_entity`, plus relationship tables.
    - JOOQ + `JooqReactiveOperations`.

## tests_coverage_semantic

- covered_behaviours:
    - behaviour: "Happy-path diff between two adjacent versions returns field-level diff with NO_CHANGES / UPDATED / DELETED / CREATED states"
      test_class: integration
      test_files: ["odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/api/ingestion/DatasetVersionDiffTest.java:39-76"]
    - behaviour: "GET structure by version_id returns the expected DataSetStructure body"
      test_class: integration
      test_files: ["odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/api/ingestion/DatasetVersionDiffTest.java:88-97"]
    - behaviour: "GET structure (latest) after first ingestion returns a structure body"
      test_class: integration
      test_files: ["odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/BaseIngestionTest.java:170-186"]
    - behaviour: "DatasetVersionMapper produces a DataSetStructure with expected mapped fields"
      test_class: unit
      test_files: ["odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/mapper/DatasetVersionMapperTest.java"]
- uncovered_behaviours:
    - behaviour: "Cross-dataset version_id leak: GET /api/datasets/{X}/structure/{V} returns dataset Y's structure when V belongs to Y (data_entity_id is never validated against the version's owning dataset)"
      test_class: security
      criticality: HIGH
      note: "See P-147; data-exposure scope is dataset-structure payload (fields + types + tags + terms), not row data."
    - behaviour: "Cross-dataset diff: GET .../structure/diff with versionIds from two different datasets returns a 200 diff response (data_entity_id is documentation-only)"
      test_class: security
      criticality: HIGH
      note: "See P-147; the SQL fetches by id-list only and the dataEntityId is dropped after the controller method."
    - behaviour: "Latest semantics under non-monotonic ingestion (manual SQL fixup or replay): a row with version=N but older created_at is returned as 'latest' over a newer-but-lower-version row"
      test_class: integration
      criticality: MEDIUM
      note: "See P-148; documents the name-vs-behavior gap between API-contract 'latest' and code-path `max(version)`."
    - behaviour: "Diff endpoint returns HTTP 500 instead of 404 when one or both version_ids do not exist (RuntimeException for size != 2 falls through ControllerAdvice)"
      test_class: integration
      criticality: MEDIUM
      note: "See P-149; status-code drift, small UX defect."
    - behaviour: "Auth-mode matrix — endpoint behaviour for DISABLED / LOGIN_FORM / OAUTH2 / LDAP / unauthenticated"
      test_class: security
      criticality: MEDIUM
      note: "Static analysis confirms `.authenticated()` is the only gate; runtime confirmation across modes is not in CI."
    - behaviour: "Concurrent ingestion races: if two ingestion attempts increment to the same `version` number concurrently, which row wins the `max(version)` query?"
      test_class: integration
      criticality: LOW
      note: "Out of this controller's scope but composes; flagged for visibility."
- test_files:
    - "odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/api/ingestion/DatasetVersionDiffTest.java:31-114"
    - "odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/api/ingestion/DatasetFieldIngestionTest.java:336-362"
    - "odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/BaseIngestionTest.java:170-186"
    - "odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/mapper/DatasetVersionMapperTest.java"
- gaps: |
    The integration tests verify the happy path (re-ingest, fetch, diff two adjacent
    versions, compare to expected). There are no negative tests: no test exercises
    the `data_entity_id` mismatch with the supplied `version_id` (the cross-dataset
    leak), no test exercises non-existent version ids (the 500-vs-404 drift), no
    test exercises an unauthenticated caller against `.authenticated()`. The biggest
    gap is the **security** test class — the four GETs surface dataset structure to
    any authenticated user without owner-scoping; this is consistent with the rest
    of the dataset-read surface in odd-platform but is documented nowhere in the
    feature page.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
    - url: "https://docs.opendatadiscovery.org/features/data-discovery/schema-diff"
      anchor: ""
      rationale: "Feature page for dataset structure / schema diff; user-facing companion of getDataSetStructureDiff."
      last_verified_at: "2026-05-25T00:00:00Z"
      last_verified_status: 200
      fetched_excerpts: |
        Verbatim (paraphrased from WebFetch): "Every re-ingest of a dataset that
        **changes the structure** creates a new **revision**." — "The revision
        history is browsable per dataset: pick any two revisions to see exactly
        what changed between them." — Page sections: Where to find it / Revision
        history / Backwards-incompatible alerts / Activity-feed surfacing / Where
        to next.
      confidence: LOW
    - url: "https://docs.opendatadiscovery.org/features/data-modelling/relationships"
      anchor: ""
      rationale: "Feature page for dataset relationships; user-facing companion of getDataSetRelationships."
      last_verified_at: "2026-05-25T00:00:00Z"
      last_verified_status: 200
      fetched_excerpts: |
        Verbatim (paraphrased from WebFetch): ERD (ENTITY_RELATIONSHIP) =
        "Foreign-key-style edges between two table-class entities"; GRAPH
        (GRAPH_RELATIONSHIP) = "Free-form graph edges between graph-store
        entities". Per-entity view: "only the relationships in which the current
        entity participates as Parent or Child". The page asserts the platform
        "shows every relationship the user can see across all data sources,
        implying role-based visibility" — this language implies a role/permission
        filter that the code does NOT implement (the GET path falls to
        `.authenticated()` only).
      confidence: LOW
    - url: "https://docs.opendatadiscovery.org/developer-guides/api-reference/relationships"
      anchor: ""
      rationale: "API-reference page covering RelationshipController's three endpoints; does NOT cover this controller's per-dataset relationships endpoint."
      last_verified_at: "2026-05-25T00:00:00Z"
      last_verified_status: 200
      fetched_excerpts: |
        Verbatim (paraphrased): "List Relationships: GET /api/relationships
        ?page=N&size=M&type=ERD|GRAPH|ALL&query=..." / "Get ERD Relationship:
        GET /api/relationships/erd/{relationship_id}" / "Get Graph Relationship:
        GET /api/relationships/graph/{relationship_id}". The page does NOT list
        the four `DataSetApi` endpoints implemented by this controller.
      confidence: LOW
- doc_drift_findings:
    - "Schema-diff feature page does not state that the dataEntityId path component is documentation-only (the SQL filters by version_id only); any authenticated user can request structure for any version_id across the platform — see Category F finding routed to bugs_limitations_corner_cases."
    - "Relationships feature page claims 'role-based visibility' / 'every relationship the user can see' — the code path runs no permission filter; output is identical for any authenticated user. Drift: doc implies authorization that code does not implement."
    - "API-reference page covers /api/relationships/* (the global RelationshipController) but NOT /api/datasets/{id}/relationships (this controller); 4 endpoints on DatasetController are missing from developer-facing API reference."
    - "Schema-diff feature page does not define 'latest'; the code uses `max(version)`, which assumes ingestion-time monotonicity. The doc page should state this assumption explicitly so operators doing manual data fixups understand what 'Latest' returns."

## implicit_adrs

- "Dataset structure versions are surfaced as a thin pass-through from DatasetVersionService — no caching, no aggregation, one DB round-trip per call" — evidence: DatasetController.java:22-59 — intent_anchor: "the entire class is `Mono<ResponseEntity<T>>` from `service.method(...).map(ResponseEntity::ok)` with no extra logic — explicit single-responsibility split between controller (HTTP) and service (semantics)" — confidence: HIGH
- "The version diff endpoint refuses identical version_ids by design with a typed BadUserRequestException (not just an empty diff)" — evidence: DatasetVersionServiceImpl.java:59-61 — intent_anchor: '"Couldn't show diff for identical versions"' — confidence: HIGH

## bugs_limitations_corner_cases

- "**dataEntityId path parameter is documentation-only** (Category F drift): controller accepts `dataEntityId` but it is consumed and dropped by `DatasetController.getDataSetStructureByVersionId` (line 28-30) — only `versionId` reaches `reactiveDatasetVersionRepository.getDatasetVersion` (ReactiveDatasetVersionRepositoryImpl.java:129) which filters by `DATASET_VERSION.ID.eq(datasetVersionId)`. Any authenticated user can request `/api/datasets/X/structure/V` with V belonging to dataset Y and get Y's structure back. The diff variant has the same shape: `getDatasetVersionWithFields(List.of(firstVersionId, secondVersionId))` (line 154) ignores dataEntityId entirely. Operator-visible failure modes: (a) cross-dataset data-exposure of schema metadata (fields, types, tags, terms, lookup-table definitions); (b) URL pattern looks scoped but is not — operators reading the URL might assume containment that doesn't exist." — evidence: DatasetController.java:22-50 + ReactiveDatasetVersionRepositoryImpl.java:97-157 — severity: HIGH
- "**No owner-scoping** at any layer: GET endpoints fall through to `AuthorizationCustomizer.spec.pathMatchers('/**').authenticated()` (AuthorizationCustomizer.java:29-30) and `SecurityConstants.SECURITY_RULES` (lines 98-end) declares no rule for `/api/datasets/{data_entity_id}/structure*` or `/api/datasets/{data_entity_id}/relationships`. Every authenticated user reads every dataset's structure. With `auth.type=DISABLED` (DisabledAuthSecurityConfiguration.java:13-17) every caller — authenticated or not — reads every dataset's structure. The feature page implies role-based visibility (see doc_drift_findings)." — evidence: DatasetController.java:1-60 + AuthorizationCustomizer.java:20-32 + SecurityConstants.java:243-289 — severity: MEDIUM
- "**Diff endpoint returns HTTP 500 for non-existent version_ids** (size != 2 path): `buildDataSetVersionDiffList` throws bare `RuntimeException('Query returned %s rows for diff request')` (DatasetVersionServiceImpl.java:69-71) when one or both ids are missing. ControllerAdvice maps this to 500. Callers cannot distinguish 'wrong id' from 'platform broken' from the status code alone. Identical-version_ids gets a clean 400 via `BadUserRequestException` (line 60); non-existent gets a 500. Asymmetric." — evidence: DatasetVersionServiceImpl.java:56-71 — severity: MEDIUM
- "**'Latest' = max(version), not max(created_at)**: `getLatestDatasetVersion` (ReactiveDatasetVersionRepositoryImpl.java:160-217) computes `max(DATASET_VERSION.VERSION).as('dsv_max')` in a subquery joined back to the row with that version. In normal ingestion (DatasetStructureIngestionRequestProcessor.java:171-178: `version.getVersion() + 1`), this matches the latest-by-time. After manual SQL fixup / replay / backfill, the highest-version row may have an older `created_at` than another row; the endpoint returns the version-max row. Operator copying the URL `/api/datasets/{id}/structure` with the expectation 'most-recently-ingested' is not exactly what the code returns under those conditions." — evidence: ReactiveDatasetVersionRepositoryImpl.java:160-217 + DatasetStructureIngestionRequestProcessor.java:171-178 — severity: LOW
- "**`findGreaterVersionId` reads `versionPojo().getVersion()`, not the version_id passed by the caller**: `getDatasetVersionDiff` accepts (firstVersionId, secondVersionId) as ids, but the diff body's `maxVersionId` / `minVersionId` classification is by the `version` column value, not the order the caller asked for. Result: the diff's status semantics (CREATED = present in max, absent in min; DELETED = inverse) are anchored to the higher-numbered version regardless of caller order. Caller-friendly behaviour, but the directionality is not documented in the contract." — evidence: DatasetVersionServiceImpl.java:77-79 + 211-216 — severity: LOW
- "**Diff endpoint loads 2 versions' full field lists in-memory** for recursive `getParentOddrnChangedPojos` (DatasetVersionServiceImpl.java:156-180). For very-wide datasets (hundreds-of-thousands of nested fields), this is a memory-bound operation; no streaming, no pagination, no row-count guard." — evidence: DatasetVersionServiceImpl.java:66-180 — severity: LOW
- "**`getDatasetVersionWithFields` does not constrain by dataset**: the SQL at ReactiveDatasetVersionRepositoryImpl.java:149-156 is `WHERE DATASET_VERSION.ID.in(datasetVersionIds)` with no `dataset_oddrn` predicate; this is the SQL-level confirmation of the Category F drift recorded above." — evidence: ReactiveDatasetVersionRepositoryImpl.java:147-157 — severity: HIGH

## stress_findings

```yaml
stress_findings:
  tunables: []
  name_behavior_pairs:
    - name: "getLatestDatasetVersion"
      promise: "Returns the most recently ingested version of the dataset's structure"
      implementation: "ReactiveDatasetVersionRepositoryImpl.getLatestDatasetVersion (line 160-217) computes `max(DATASET_VERSION.VERSION).as('dsv_max')` in a subquery joined to DATA_ENTITY by ODDRN, then joins back to DATASET_VERSION on `VERSION = dsv_max`. The `created_at` column exists but is not referenced. In normal ingestion flow, version is monotonically incremented by +1 per re-ingest (DatasetStructureIngestionRequestProcessor.java:171-178), so highest-version == most-recently-created. Under manual data fixup or replay, this can diverge."
      drift: MINOR
      operator_visible_consequence: "Under non-monotonic ingestion (manual SQL or replay), the row labelled 'Latest' may have an older createdAt than another existing row."
      confidence: STATIC-INFERRED
      evidence: "ReactiveDatasetVersionRepositoryImpl.java:160-217 + DatasetStructureIngestionRequestProcessor.java:171-178"
    - name: "getDataSetStructureDiff"
      promise: "Computes the difference between two structure versions of a dataset"
      implementation: "DatasetVersionServiceImpl.getDatasetVersionDiff (line 56-64) rejects identical ids (throws BadUserRequestException → HTTP 400), then SELECTs both versions by id, then if size != 2 throws bare RuntimeException → HTTP 500. The `dataEntityId` parameter is accepted but never reaches the SQL — `getDatasetVersionWithFields(List.of(firstVersionId, secondVersionId))` filters by version-id only."
      drift: DRIFT_NAME_VS_BEHAVIOR
      operator_visible_consequence: "The endpoint claims 'diff between two dataset structure versions' but accepts any two version_ids across the platform regardless of the dataset id in the URL; cross-dataset diff produces a 200 response. Missing-id case produces 500, not 404."
      confidence: STATIC-INFERRED
      evidence: "DatasetController.java:43-50 + DatasetVersionServiceImpl.java:56-64 + ReactiveDatasetVersionRepositoryImpl.java:147-157"
    - name: "getDataSetRelationships"
      promise: "Returns the relationships for the dataset identified by dataEntityId, optionally filtered by RelationshipsType"
      implementation: "Delegates to RelationshipsServiceImpl.getRelationsByDatasetId (line 22-28) which forwards to ReactiveRelationshipsRepository.getRelationsByDatasetIdAndType. The dataEntityId is consumed (downstream sidecar required to confirm the exact SQL); the response is mapped to DataEntityRelationshipDetailsList. No owner-filtering at this layer."
      drift: NONE
      operator_visible_consequence: ""
      confidence: REFERENCE
      evidence: "odd-platform java RelationshipsServiceImpl method:getRelationsByDatasetId (downstream sidecar — not yet enriched)"
  orderings:
    - location: "ReactiveDatasetVersionRepositoryImpl.java:160-217"
      questions:
        - q: "What is the actual ORDER BY at the lowest layer?"
          a: "No explicit ORDER BY; the WHERE `DATASET_VERSION.VERSION = max(DATASET_VERSION.VERSION)` from the subquery returns exactly 1 row per dataset_oddrn (the max-version row). Implicit selection by aggregation, not by ordering."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDatasetVersionRepositoryImpl.java:161-203"
        - q: "What is the tie-breaker when sort-key values are equal?"
          a: "Tie cannot occur in normal ingestion (version is monotonically +1). If two rows had identical version (e.g. manual fixup creating a duplicate), the JOIN at line 187-189 matches BOTH; downstream GROUP BY on `selectFields` would produce 2 rows; `findFirst` (line 208) picks one — undefined by SQL but PostgreSQL preserves insertion order under no ORDER BY. NOT a contract."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDatasetVersionRepositoryImpl.java:187-217"
        - q: "Which subset is returned when result-set > page size?"
          a: "N/A — getLatestDatasetVersion is not paginated (single-row return); getDatasetVersion is single-row; diff returns 2 rows by id-list."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDatasetVersionRepositoryImpl.java:97-157"
        - q: "Does any upstream layer re-sort or filter the result?"
          a: "UI DatasetStructureCompareHeader.tsx:56-58 sorts `datasetVersions` ascending by `.version` for the dropdown labels. UI Compare flow consumes the diff result as-is."
          confidence: STATIC-INFERRED
          evidence: "DatasetStructureCompareHeader.tsx:56-58"
  auth_gates:
    - location: "DatasetController.java:22-50 (all 4 endpoints) + AuthorizationCustomizer.java:20-32 + SecurityConstants.java:243-289"
      endpoint: "GET /api/datasets/{data_entity_id}/structure[/{version_id}|/diff] and GET /api/datasets/{data_entity_id}/relationships"
      questions:
        - q: "What does this endpoint return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "DISABLED: any caller (no auth) gets 200. LOGIN_FORM / OAUTH2 / LDAP: any authenticated user (any role, any permissions) gets 200 — there is no SecurityRule for these paths and the catch-all `.pathMatchers('/**').authenticated()` (AuthorizationCustomizer.java:29-30) is the only gate. The DisabledAuthSecurityConfiguration sets `anyExchange().permitAll()`."
          confidence: STATIC-INFERRED
          evidence: "AuthorizationCustomizer.java:20-32 + SecurityConstants.java:243-289 + DisabledAuthSecurityConfiguration.java:13-17"
        - q: "What does an unauthenticated caller see?"
          a: "Under LOGIN_FORM / OAUTH2 / LDAP: redirected to login (or 401 for API clients without session). Under DISABLED: 200."
          confidence: STATIC-INFERRED
          evidence: "AuthorizationCustomizer.java:29-30 (`.authenticated()` redirects to login for browser flows) + DisabledAuthSecurityConfiguration.java:14-17"
        - q: "What does a wrong-role caller see?"
          a: "There is no role gating — the catch-all `.authenticated()` matches any role. A 'read-only viewer' role gets the same response as an 'admin' role."
          confidence: STATIC-INFERRED
          evidence: "SecurityConstants.java (no rule for these paths) + AuthorizationCustomizer.java:29-30"
        - q: "Where does the gate live — controller, service, repository, or nowhere?"
          a: "Catch-all `.authenticated()` at the Spring Security layer. No `@PreAuthorize` on the controller, no `permissionService` call in the service, no owner-filter at the repository. The dataset's owner has no influence on visibility."
          confidence: STATIC-INFERRED
          evidence: "DatasetController.java:1-60 + DatasetVersionServiceImpl.java + RelationshipsServiceImpl.java:22-28"
  resource_boundaries: []
  request_inputs:
    - location: "DatasetController.java:24"
      input_kind: path-param
      input_name: "dataEntityId"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "The id of the dataset whose structure / version / diff / relationships the caller wants — i.e. the bag the version_id should belong to."
          confidence: STATIC-INFERRED
          evidence: "DatasetController.java:24 + OpenAPI spec: 'Get DataSet structure information ... by DataSet's id and version' (openapi.yaml:1828-1849)"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "getDataSetStructureByVersionId: forwarded to DatasetVersionServiceImpl.getDatasetVersion(datasetId, datasetVersionId) (line 39); the service uses `datasetId` only inside the 'not found' error message (line 41-43) — it is NEVER passed to the SQL. ReactiveDatasetVersionRepositoryImpl.getDatasetVersion(line 97-144) filters by `DATASET_VERSION.ID.eq(datasetVersionId)` only. getDataSetStructureLatest: forwarded to DatasetVersionServiceImpl.getLatestDatasetVersion(datasetId); here it is used — the subquery at ReactiveDatasetVersionRepositoryImpl.java:166-167 joins DATA_ENTITY on ODDRN and filters `DATA_ENTITY.ID.eq(datasetId)`. getDataSetStructureDiff: forwarded to DatasetVersionServiceImpl.getDatasetVersionDiff(...) — never reaches SQL. getDataSetRelationships: forwarded to RelationshipsServiceImpl.getRelationsByDatasetId(dataEntityId, type) — usage at the repository requires the neighbour sidecar."
          confidence: STATIC-INFERRED
          evidence: "DatasetController.java:22-59 + DatasetVersionServiceImpl.java:38-64 + ReactiveDatasetVersionRepositoryImpl.java:97-157,160-217"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "getLatestDatasetVersion: MATCHES — datasetId reaches the SQL and filters correctly. getDataSetStructureByVersionId: TRANSLATES_SILENTLY — the name and the URL imply the call is scoped to this dataset, but the SQL filters by version_id only. A request with mismatched dataset/version returns the version's true dataset's structure with HTTP 200. getDataSetStructureDiff: TRANSLATES_SILENTLY — same shape, version_ids drive the SQL, dataEntityId is discarded. getDataSetRelationships: UNRESOLVED — depends on downstream repository (not yet enriched)."
          drift: DRIFT_INPUT_NAME_VS_IMPLEMENTATION
          confidence: STATIC-INFERRED
          evidence: "DatasetController.java:28-30 + DatasetVersionServiceImpl.java:39-45 + ReactiveDatasetVersionRepositoryImpl.java:97-129,147-157"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "(a) GET /api/datasets/X/structure/V where V belongs to dataset Y: response 200 with dataset Y's structure — small data-exposure leak (schema + types + tags + terms; no row data). (b) GET /api/datasets/X/structure/diff?first=V1&second=V2 where V1,V2 belong to different datasets: response 200 with a cross-dataset diff (the diff status semantics are still computed against the higher-version row, which is meaningless across datasets but produces a non-error body). (c) GET /api/datasets/X/structure/diff?first=V1&second=NON_EXISTENT: response 500 with 'Query returned N rows for diff request' (DatasetVersionServiceImpl.java:69-71) — not the expected 404."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDatasetVersionRepositoryImpl.java:128-129 + DatasetVersionServiceImpl.java:69-71"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "Yes. dataset_version.dataset_oddrn (line 161-188 in ReactiveDatasetVersionRepositoryImpl) is SELECTED by the latest-version subquery to anchor the join, and DATA_ENTITY.ODDRN is JOINED on. A predicate of the form `AND DATASET_VERSION.DATASET_ODDRN = (SELECT ODDRN FROM DATA_ENTITY WHERE ID = :datasetId)` would close the cross-dataset leak in getDatasetVersion and getDatasetVersionWithFields with one line each. The unused-but-available column is DATASET_VERSION.DATASET_ODDRN — already in the schema, already joinable, already filterable."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDatasetVersionRepositoryImpl.java:163-168 (the FK join is right there; the WHERE clause for the by-id and diff paths skips it)"
      routes_to_finding: "bugs_limitations_corner_cases.[0,1,6] AND docs_link_semantic.doc_drift_findings.[0,2]"
    - location: "DatasetController.java:25"
      input_kind: path-param
      input_name: "versionId"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "The id of a specific dataset_version row within the dataset identified by dataEntityId."
          confidence: STATIC-INFERRED
          evidence: "DatasetController.java:25 + OpenAPI 'by DataSet's id and version' (openapi.yaml:1831)"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Filters DATASET_VERSION.ID via reactiveDatasetVersionRepository.getDatasetVersion(versionId) — `DATASET_VERSION.ID.eq(datasetVersionId)` (ReactiveDatasetVersionRepositoryImpl.java:129). The dataset constraint is not enforced."
          confidence: STATIC-INFERRED
          evidence: "DatasetController.java:29 + ReactiveDatasetVersionRepositoryImpl.java:129"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES at the column level (versionId → DATASET_VERSION.ID is correct) but the implicit constraint 'within the dataset identified by dataEntityId' is not honored — see the dataEntityId entry above."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "ReactiveDatasetVersionRepositoryImpl.java:129"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — drift is on the dataEntityId param, not versionId."
          confidence: STATIC-INFERRED
          evidence: "DatasetController.java:25"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "NONE — versionId maps cleanly to DATASET_VERSION.ID."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDatasetVersionRepositoryImpl.java:129"
      routes_to_finding: ""
    - location: "DatasetController.java:45-46"
      input_kind: query-param
      input_name: "firstVersionId / secondVersionId"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "Two version ids whose structures the caller wants to diff — both belonging to the dataset identified by dataEntityId."
          confidence: STATIC-INFERRED
          evidence: "DatasetController.java:45-46 + OpenAPI 'Gets difference between two dataset structure versions' (openapi.yaml:1853-1854)"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "DatasetVersionServiceImpl.getDatasetVersionDiff(dataEntityId, firstVersionId, secondVersionId): only the version ids are passed to `getDatasetVersionWithFields(List.of(firstVersionId, secondVersionId))` (line 62) which filters `DATASET_VERSION.ID.in(...)` only. The dataEntityId is discarded entirely (not even used in the error message)."
          confidence: STATIC-INFERRED
          evidence: "DatasetController.java:44-49 + DatasetVersionServiceImpl.java:55-64 + ReactiveDatasetVersionRepositoryImpl.java:147-157"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "TRANSLATES_SILENTLY — same drift shape as the by-version-id endpoint, multiplied by 2 (both versionIds bypass dataset containment)."
          drift: DRIFT_INPUT_NAME_VS_IMPLEMENTATION
          confidence: STATIC-INFERRED
          evidence: "DatasetVersionServiceImpl.java:56-64 + ReactiveDatasetVersionRepositoryImpl.java:147-157"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "Cross-dataset diff returns 200 with a diff body where the per-field statuses (CREATED / DELETED / NO_CHANGES / UPDATED) are computed across two unrelated datasets' fields — operator-visible as 'every field is deleted, every field is created' or similar nonsensical-but-200 response."
          confidence: PROBE-NEEDED
          evidence: "P-147 (this probe verifies the response body shape)"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "Same as the by-version-id case — DATASET_VERSION.DATASET_ODDRN is in scope (selected by the join in the latest-version path; unused in the diff/by-id paths)."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDatasetVersionRepositoryImpl.java:147-157"
      routes_to_finding: "bugs_limitations_corner_cases.[0,6] AND docs_link_semantic.doc_drift_findings.[0]"
    - location: "DatasetController.java:55"
      input_kind: query-param
      input_name: "type (RelationshipsType)"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "The relationship class to filter by: ERD (foreign-key) or GRAPH (graph-store)."
          confidence: STATIC-INFERRED
          evidence: "DatasetController.java:55 + live doc page features/data-modelling/relationships"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Forwarded to RelationshipsServiceImpl.getRelationsByDatasetId(dataEntityId, type) → ReactiveRelationshipsRepository.getRelationsByDatasetIdAndType(dataEntityId, type). The exact SQL is in the downstream repository sidecar (not yet enriched)."
          confidence: REFERENCE
          evidence: "odd-platform java ReactiveRelationshipsRepository (downstream sidecar)"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "UNRESOLVED — depends on downstream sidecar."
          drift: NONE
          confidence: REFERENCE
          evidence: "odd-platform java ReactiveRelationshipsRepository (downstream sidecar)"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A pending the downstream trace; flagged for resolution."
          confidence: REFERENCE
          evidence: "odd-platform java ReactiveRelationshipsRepository (downstream sidecar)"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used?"
          a: "UNRESOLVED — downstream sidecar required."
          confidence: REFERENCE
          evidence: "odd-platform java ReactiveRelationshipsRepository (downstream sidecar)"
      routes_to_finding: ""
  probes_emitted:
    - probe_id: P-147
      question: "Does the dataEntityId path parameter actually constrain the version_id lookup, or is it documentation-only? Verify cross-dataset response."
      probe_path: "lineage/odd-platform/probes/P-147.yaml"
    - probe_id: P-148
      question: "When version monotonicity diverges from creation-time monotonicity (manual fixup / replay), does 'Latest' return max(version) or max(created_at)?"
      probe_path: "lineage/odd-platform/probes/P-148.yaml"
    - probe_id: P-149
      question: "What HTTP status does the diff endpoint return for non-existent version_ids and for identical version_ids? Confirm the 400-vs-500 asymmetry."
      probe_path: "lineage/odd-platform/probes/P-149.yaml"
  stress_summary:
    triggers_total: 11
    questions_total: 36
    answers_static_inferred: 29
    answers_probe_needed: 1
    answers_reference: 6
    drift_flags: 2
```

## security

- **auth_mode_relevance**: `LOGIN_FORM | OAUTH2 | LDAP | DISABLED` — all four endpoints are reachable in every auth mode; under DISABLED no authentication is required at all.
- **ingestion_filter_relevance**: `NO — UI/API surface, not ingestion`. These are read endpoints under `/api/datasets/...`; the ingestion filter applies on `/ingestion/entities` only.
- **authorization_assertions**: `[]` — no `@PreAuthorize`, no `permissionService.hasPermission(...)`, no `SecurityRule` declared for `/api/datasets/{data_entity_id}/structure*` or `/api/datasets/{data_entity_id}/relationships` in SecurityConstants. The catch-all `.pathMatchers('/**').authenticated()` (AuthorizationCustomizer.java:29-30) is the only assertion.
- **owner_scoping**: `BYPASSES — returns data across owners (admin-equivalent path)`. Any authenticated user reads any dataset's structure / relationships. The dataset's owner has no bearing on visibility. The Compare-Header UI presents `disabled` dropdown options when both selectors would pick the same version (DatasetStructureCompareHeader.tsx:99,129) but does not constrain cross-dataset access (the URL still allows it).
- **data_exposure**:
    - "DataSetStructure payload (dataSetVersion + fieldList with name + type + descriptions + tags + terms + lookup-table definitions) → any authenticated user, across owners; under DISABLED → any caller"
    - "DataEntityRelationshipDetailsList (relationship records: source/target datasets, cardinality, namespace) → any authenticated user, across owners"
    - "Cross-dataset version_id leak: a known version_id outside the URL-named dataset returns that other dataset's structure with HTTP 200 (P-147)"
- **known_security_gaps**:
    - "controller has no @PreAuthorize and no programmatic permission check; the four endpoints fall through to `.authenticated()` only (AuthorizationCustomizer.java:29-30) — anyone with an account can read every dataset's schema metadata" — evidence: DatasetController.java:1-60 + AuthorizationCustomizer.java:20-32 — severity: MEDIUM
    - "dataEntityId path component is not validated against the version_id at any layer; cross-dataset enumeration of dataset_version IDs (sequential bigserial) reveals other datasets' schemas" — evidence: ReactiveDatasetVersionRepositoryImpl.java:97-157 — severity: HIGH
    - "with auth.type=DISABLED (dev/demo default) all four endpoints are reachable unauthenticated; the docs do not flag DISABLED as production-unsafe in this surface specifically" — evidence: DisabledAuthSecurityConfiguration.java:13-17 — severity: LOW (DISABLED is dev-only per platform docs)
    - "feature page implies role-based visibility ('every relationship the user can see across all data sources') — the code path does not implement any role filter; documentation overstates the security model" — evidence: live https://docs.opendatadiscovery.org/features/data-modelling/relationships + DatasetController.java:53-58 — severity: LOW (doc drift, not a runtime risk)

## performance

- **hot_paths**:
    - "getDataSetStructureLatest runs a 14-table LEFT JOIN with multiple jsonArrayAgg per dataset (ReactiveDatasetVersionRepositoryImpl.java:176-203); single round-trip but heavy per-call" — evidence: ReactiveDatasetVersionRepositoryImpl.java:160-217
    - "getDataSetStructureDiff loads 2 versions' field lists in-memory and runs recursive parent-oddrn change detection until convergence (DatasetVersionServiceImpl.java:156-180); cost O(field_count × convergence_depth)" — evidence: DatasetVersionServiceImpl.java:66-180
    - "getDataSetStructureByVersionId runs the same 14-table LEFT JOIN as latest but keyed on a single id (ReactiveDatasetVersionRepositoryImpl.java:97-144)" — evidence: ReactiveDatasetVersionRepositoryImpl.java:97-144
- **throughput_characteristics**:
    - "All four endpoints reactive Mono — non-blocking but each call materialises a single result with multiple aggregated jsonb arrays in one query"
    - "No batch / bulk variant: caller wanting structures for N datasets makes N HTTP calls"
    - "Diff endpoint is one round-trip for SQL + in-memory computation; no pagination over fields"
- **resource_allocation**:
    - "DataSetStructure response holds the full field list with tags + metadata + terms + lookup-table definitions in memory — bounded by dataset's field count (typical: tens; pathological: thousands for nested struct/list columns)"
    - "Diff endpoint allocates `versionToFieldsMap`, `firstVersionFields`, `secondVersionFields`, `versionDiffFields` per call — 4 maps over the union of both versions' fields"
- **scaling_characteristics**:
    - "controller is stateless — instances scale horizontally"
    - "no caching at any layer — every call re-runs the LEFT JOIN; for hot datasets (popular tile, lineage canvas previews) this can compound"
    - "no pagination on field list — large nested schemas could exceed `spring.codec.max-in-memory-size` if response serialisation grows"
- **known_performance_gaps**:
    - "no caching of `getLatestDatasetVersion` despite obvious cache-friendliness (changes only on re-ingest, which is the only DB writer)" — evidence: DatasetVersionServiceImpl.java:48-53 — severity: LOW
    - "no row-count guard on diff endpoint; very-wide schema diffs (10K+ fields) materialise everything in-memory" — evidence: DatasetVersionServiceImpl.java:66-180 — severity: LOW

## upstream_callers

- entry_point: "ui_route:/dataentities/{id}/structure/overview"
  caller_node: "ts react-component:DatasetStructureOverview.tsx (unresolved sidecar)"
  multiplicity_per_trigger: 1
  evidence: "DatasetStructureOverview.tsx:27-39 — useEffect dispatches fetchDataSetStructureLatest if no versionId, then fetchDataSetStructure for the resolved version"
  observation_class: ui-call
  unresolved: true

- entry_point: "ui_route:/dataentities/{id}/structure/overview/{versionId}"
  caller_node: "ts react-component:DatasetStructureOverview.tsx (unresolved sidecar)"
  multiplicity_per_trigger: 1
  evidence: "DatasetStructureOverview.tsx:27-39 — direct fetchDataSetStructure with versionId from route"
  observation_class: ui-call
  unresolved: true

- entry_point: "ui_route:/dataentities/{id}/structure/compare"
  caller_node: "ts react-component:DatasetStructureCompare.tsx (unresolved sidecar)"
  multiplicity_per_trigger: 1
  evidence: "DatasetStructureCompare.tsx:30-35 — useDatasetStructureCompare via tanstack-query; refetches on (firstVersionId, secondVersionId, dataEntityId) change"
  observation_class: ui-call
  unresolved: true

- entry_point: "ui_route:/dataentities/{id}/* (relationships tab)"
  caller_node: "ts react-component:useGetDatasetRelationships (unresolved sidecar)"
  multiplicity_per_trigger: 1
  evidence: "datasetApi.ts:36-44 — useGetDatasetRelationships via tanstack-query"
  observation_class: ui-call
  unresolved: true

- entry_point: "rest:GET /api/datasets/{data_entity_id}/structure[/...]"
  caller_node: "third-party api consumer (unresolved)"
  multiplicity_per_trigger: 1
  evidence: "DatasetController.java:34-41,22-31,43-50,52-59 — direct HTTP entrypoints; openapi.yaml:1793-1878 documents all four operations under the dataSet tag"
  observation_class: rest-call
  unresolved: true

## downstream_side_effects

- side_effect_class: db-write
  description: "NONE — all four endpoints are read-only"
  evidence: "DatasetController.java:22-59 — every method is `service.method(...).map(ResponseEntity::ok)` against read services (DatasetVersionService + RelationshipsService); no @Transactional, no UPDATE / INSERT path"
  cardinality_per_call: 0
  reachable_from_entry_points:
    - "ui_route:/dataentities/{id}/structure/overview"
    - "ui_route:/dataentities/{id}/structure/overview/{versionId}"
    - "ui_route:/dataentities/{id}/structure/compare"
    - "ui_route:/dataentities/{id}/* (relationships tab)"
    - "rest:GET /api/datasets/{data_entity_id}/structure[/...]"
    - "rest:GET /api/datasets/{data_entity_id}/relationships"

- side_effect_class: page-render
  description: "Returns DataSetStructure (single version + field list) OR DataSetVersionDiffList (paired field states) OR DataEntityRelationshipDetailsList — the body the UI consumes to render the Structure / Compare / Relationships tabs"
  evidence: "DatasetController.java:22-59"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "ui_route:/dataentities/{id}/structure/overview"
    - "ui_route:/dataentities/{id}/structure/overview/{versionId}"
    - "ui_route:/dataentities/{id}/structure/compare"
    - "ui_route:/dataentities/{id}/* (relationships tab)"
    - "rest:GET /api/datasets/{data_entity_id}/structure[/...]"
    - "rest:GET /api/datasets/{data_entity_id}/relationships"

## sources

- understanding ← DatasetController.java:1-60 + DatasetVersionServiceImpl.java:38-64 + ReactiveDatasetVersionRepositoryImpl.java:97-217
- concepts.operations.* ← DatasetController.java:22-59 + openapi.yaml:1793-1878
- concepts.invariants.* ← DatasetStructureIngestionRequestProcessor.java:167-178 + DatasetVersionServiceImpl.java:59-61 + DatasetVersionServiceImpl.java:218-224
- dependencies_semantic.requires-config ← AuthorizationCustomizer.java:20-32 + DisabledAuthSecurityConfiguration.java:11-19
- tests_coverage_semantic.test_files.* ← DatasetVersionDiffTest.java:31-114 + DatasetFieldIngestionTest.java:336-362 + BaseIngestionTest.java:170-186 + DatasetVersionMapperTest.java
- docs_link_semantic.inferred_docs.[0] ← WebFetch https://docs.opendatadiscovery.org/features/data-discovery/schema-diff (status 200, 2026-05-25)
- docs_link_semantic.inferred_docs.[1] ← WebFetch https://docs.opendatadiscovery.org/features/data-modelling/relationships (status 200, 2026-05-25)
- docs_link_semantic.inferred_docs.[2] ← WebFetch https://docs.opendatadiscovery.org/developer-guides/api-reference/relationships (status 200, 2026-05-25)
- implicit_adrs.[0] ← DatasetController.java:22-59
- implicit_adrs.[1] ← DatasetVersionServiceImpl.java:59-61
- bugs_limitations_corner_cases.[0] ← DatasetController.java:22-50 + ReactiveDatasetVersionRepositoryImpl.java:97-157
- bugs_limitations_corner_cases.[1] ← DatasetController.java:1-60 + AuthorizationCustomizer.java:20-32 + SecurityConstants.java:243-289
- bugs_limitations_corner_cases.[2] ← DatasetVersionServiceImpl.java:56-71
- bugs_limitations_corner_cases.[3] ← ReactiveDatasetVersionRepositoryImpl.java:160-217 + DatasetStructureIngestionRequestProcessor.java:171-178
- bugs_limitations_corner_cases.[4] ← DatasetVersionServiceImpl.java:77-79 + 211-216
- bugs_limitations_corner_cases.[5] ← DatasetVersionServiceImpl.java:66-180
- bugs_limitations_corner_cases.[6] ← ReactiveDatasetVersionRepositoryImpl.java:147-157
- security.auth_mode_relevance ← AuthorizationCustomizer.java:20-32 + DisabledAuthSecurityConfiguration.java:11-19
- security.authorization_assertions ← DatasetController.java:1-60 (no annotations) + SecurityConstants.java:243-289 (no matching rule)
- security.known_security_gaps.[0,1] ← DatasetController.java:1-60 + AuthorizationCustomizer.java:29-30 + ReactiveDatasetVersionRepositoryImpl.java:97-157
- performance.hot_paths.[0,1,2] ← ReactiveDatasetVersionRepositoryImpl.java:160-217,97-144 + DatasetVersionServiceImpl.java:66-180
- performance.scaling_characteristics.* ← DatasetController.java + DatasetVersionServiceImpl.java (no @Cacheable, no pagination)
- upstream_callers.[0,1,2,3] ← DatasetStructureOverview.tsx:1-114 + DatasetStructureCompare.tsx:1-62 + datasetApi.ts:1-44
- upstream_callers.[4] ← DatasetController.java:22-59 + openapi.yaml:1793-1878
- downstream_side_effects.[0,1] ← DatasetController.java:22-59

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: MEDIUM (inferred URLs; live-fetched; not source-declared)
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: MEDIUM (no observed load data; characteristics inferred from static read)
- upstream_callers: MEDIUM (UI sidecars not yet enriched; references explicit)
- downstream_side_effects: HIGH
- stress_findings: HIGH (29/36 STATIC-INFERRED, 6/36 REFERENCE-deferred to downstream sidecars, 1/36 PROBE-NEEDED with skeleton emitted; load-bearing claims are all statically anchored)

## Maintainer notes
