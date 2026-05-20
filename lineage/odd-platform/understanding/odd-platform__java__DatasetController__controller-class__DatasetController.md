---
node_id: "odd-platform java DatasetController controller-class:DatasetController"
node_kind: controller-class
axis: controllers
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.3.0
schema_version: v0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-20-W-DatasetController
---

# DatasetController — semantic understanding

## understanding

`DatasetController` is the **per-dataset structure-versioning + relationships HTTP surface** — 60 lines, 4 endpoints across 2 collaborating services (`DatasetVersionService`, `RelationshipsService`), implementing the OpenAPI-generated `DataSetApi` interface (`odd-platform-specification/openapi.yaml:1793-1878`). The class is **pure thin-proxy plumbing**: every method body is a one-line `service.X(...).map(ResponseEntity::ok)` shape (lines 28-30, 38-40, 48-49, 57-58) — no validation, no error handling, no `@PreAuthorize`, no annotations beyond `@RestController` (line 16) + Lombok's `@RequiredArgsConstructor` (line 17). All four endpoints are GET reads — there is NO `SecurityRule` entry for any `/api/datasets/{data_entity_id}/structure/*` or `/api/datasets/{data_entity_id}/relationships` path in `SecurityConstants.java:98-355` (verified Grep — only `/api/datasets/{data_entity_id}/dataqatests/{dataqa_test_id}/severity PUT` line 244-246 exists). Reads fall back to the global authentication-only gate — read-collaborative posture, matching the platform-wide pattern documented across LineageServiceImpl, ReactiveDataEntityRepositoryImpl, and the F-005 cross-owner enumeration line. The controller is the **F-005 schema-versioning + F-004 column-level-XSS read-side surface**: `getDataSetStructureByVersionId` (lines 22-31), `getDataSetStructureLatest` (lines 33-41), `getDataSetStructureDiff` (lines 43-50) return the column-level structure (including the verbatim `internal_description` field per F-004 batch-R) at a chosen revision; `getDataSetRelationships` (lines 52-58) returns the ERD/Graph relationships for a dataset. Three implementation-shaped findings concentrate here: (1) **id-confusion / per-entity-scoping bypass**: `getDataSetStructureByVersionId(dataEntityId, versionId)` does NOT cross-check the `dataEntityId` argument against the `versionId` (`DatasetVersionServiceImpl.java:39-45` + `ReactiveDatasetVersionRepositoryImpl.java:97-144` — query filters `WHERE DATASET_VERSION.ID = datasetVersionId` only, the `dataEntityId` is purely cosmetic at the URL); same for `getDataSetStructureDiff` (`DatasetVersionServiceImpl.java:55-64` + `ReactiveDatasetVersionRepositoryImpl.java:146-157` — query filters `WHERE DATASET_VERSION.ID IN (firstVersionId, secondVersionId)` only). (2) The contributing F-005 cross-owner enumeration extends to the column-level structure surface — any authenticated user can read any dataset version's full column structure across all owners. (3) Spec/code drift on doc surface: `GET /api/datasets/{data_entity_id}/relationships` (the only dataset-scoped relationships endpoint) is in the OpenAPI spec but NOT documented at `https://docs.opendatadiscovery.org/developer-guides/api-reference/relationships` (WebFetched 2026-05-20, status 200, only `/api/relationships*` family documented).

## concepts

- entities: [
    "`DataSetStructure` (the GET /structure response — `dataSetVersion: DataSetVersion + fieldList: [DataSetField]`; assembled by `DatasetVersionMapper::mapDatasetStructure` from `DatasetStructureDto` per `DatasetVersionServiceImpl.java:44, 52`)",
    "`DataSetVersionDiffList` (the GET /structure/diff response — `fieldList: [DataSetVersionDiff]` per `DatasetVersionServiceImpl.java:80, 94`)",
    "`DataSetVersionDiff` (per-field diff — `status: CREATED|UPDATED|DELETED|NO_CHANGES + states: Map<versionId,DataSetFieldDiffState>` per `DatasetVersionServiceImpl.java:120-145`)",
    "`DataEntityRelationshipDetailsList` (the GET /relationships response — list of ERD/Graph relationships)",
    "`RelationshipsType` (the relationships filter — `ERD` / `GRAPH` enum)",
    "`DatasetFieldPojo` (the column-metadata row whose `internal_description` field is the F-004 verbatim-storage XSS-class surface — written via `DatasetFieldController` PUT, READ via THIS controller's structure endpoints — cross-link to ReactiveDatasetFieldRepositoryImpl batch-R sidecar)",
    "`DataSetApi` (the OpenAPI-generated interface this class implements — line 4, line 18)"
  ]
- operations: [
    "`get-structure-by-version-id` — GET /api/datasets/{data_entity_id}/structure/{version_id} → `DatasetVersionServiceImpl.getDatasetVersion(datasetId, datasetVersionId)` (lines 39-45) → `ReactiveDatasetVersionRepositoryImpl.getDatasetVersion(datasetVersionId)` (lines 97-144). **Critical: `datasetId` is unused in the SQL** (line 41-43 only uses `datasetId` inside the NotFoundException message text); the WHERE clause is `DATASET_VERSION.ID = datasetVersionId` (line 129). Calling with any `data_entity_id` returns the version if the `version_id` exists ANYWHERE in the catalog.",
    "`get-structure-latest` — GET /api/datasets/{data_entity_id}/structure → `DatasetVersionServiceImpl.getLatestDatasetVersion(datasetId)` (lines 47-53) → `ReactiveDatasetVersionRepositoryImpl.getLatestDatasetVersion(datasetId)` (lines 160-217). Unlike the by-version endpoint, the latest endpoint DOES use the `datasetId` via the subquery `WHERE DATA_ENTITY.ID = datasetId` (line 167) — this lookup is correctly scoped to the path-supplied DataEntity.",
    "`get-structure-diff` — GET /api/datasets/{data_entity_id}/structure/diff?first_version_id=A&second_version_id=B → `DatasetVersionServiceImpl.getDatasetVersionDiff(datasetId, firstVersionId, secondVersionId)` (lines 55-64) → guards `BadUserRequestException` if A==B (line 59-61) → `ReactiveDatasetVersionRepositoryImpl.getDatasetVersionWithFields(List.of(firstVersionId, secondVersionId))` (lines 146-157). **Critical: `datasetId` is unused** — the WHERE clause is `DATASET_VERSION.ID IN (firstVersionId, secondVersionId)` (line 154); a caller may diff two versions belonging to two DIFFERENT datasets.",
    "`get-dataset-relationships` — GET /api/datasets/{data_entity_id}/relationships?type=ERD|GRAPH → `RelationshipsServiceImpl.getRelationsByDatasetId(dataEntityId, type)` (lines 23-28) → `ReactiveRelationshipsRepository.getRelationsByDatasetIdAndType(dataEntityId, type)` — `dataEntityId` IS used in the underlying query (verified `dataEntityRelationshipRepository.getRelationships` is the analogous path; the relationships variant takes the path id as the filter)."
  ]
- invariants: [
    "**Thin-proxy class — zero business logic in the controller.** Every method body is a one-line `service.X(...).map(ResponseEntity::ok)` shape — no validation, no error handling, no logging, no `@PreAuthorize`. The four methods total 25 lines of method body across lines 22-58.",
    "**NO `SecurityRule` entry for any `/api/datasets/{data_entity_id}/structure/*` or `/api/datasets/{data_entity_id}/relationships` path.** Verified by reading `SecurityConstants.java:98-355` end-to-end — the only `/api/datasets/` rule is for `/api/datasets/{data_entity_id}/dataqatests/{dataqa_test_id}/severity PUT` (line 244-246, gated by `DATASET_TEST_RUN_SET_SEVERITY`). All four endpoints in this controller fall back to global authentication-only gate (read-collaborative posture, consistent with platform-wide pattern at `LineageServiceImpl.getLineage`, `ReactiveDataEntityRepositoryImpl` invariant 6, `ReactiveDatasetFieldRepositoryImpl.listByTerm` invariant 6).",
    "**`getDataSetStructureByVersionId` ignores the `data_entity_id` URL parameter.** `DatasetController.java:23-30` takes `dataEntityId` and `versionId`, calls `datasetVersionService.getDatasetVersion(dataEntityId, versionId)`. `DatasetVersionServiceImpl.java:39-45` passes `datasetVersionId` to the repo and uses `datasetId` ONLY in the NotFoundException message (line 42-43 — `\"Dataset version with id %s for dataset with id %s not found\".formatted(datasetVersionId, datasetId)`). `ReactiveDatasetVersionRepositoryImpl.java:129` filters `WHERE DATASET_VERSION.ID = datasetVersionId` only. A request to `GET /api/datasets/999999/structure/{valid_version_id_for_other_dataset}` returns the structure of the OTHER dataset's version.",
    "**`getDataSetStructureDiff` ignores the `data_entity_id` URL parameter.** `DatasetController.java:43-50` takes `dataEntityId`, `firstVersionId`, `secondVersionId`. `DatasetVersionServiceImpl.java:55-64` does NOT use `datasetId` in any query; `ReactiveDatasetVersionRepositoryImpl.java:154` filters `WHERE DATASET_VERSION.ID IN (firstVersionId, secondVersionId)` only. A caller may pass two version_ids from two completely different datasets — the diff is computed over the raw column lists of those two versions regardless of their parent DataEntities. The error message and the response shape do not signal the parent mismatch.",
    "**`getDataSetStructureLatest` DOES use `data_entity_id`.** `ReactiveDatasetVersionRepositoryImpl.java:167` — the subquery `WHERE DATA_ENTITY.ID.eq(datasetId)` correctly scopes the latest-version lookup. This is the ONLY one of the three structure endpoints with correct id-scoping.",
    "**Diff semantics rely on the column-level versioning-by-reference model.** `DatasetVersionServiceImpl.calculateStatus` (lines 192-209) computes the per-field status `(CREATED | UPDATED | DELETED | NO_CHANGES)` by comparing the two version's `DatasetFieldPojo` rows by `oddrn`. The structure-hash discriminator at `DatasetVersionHashCalculator` (cited in `ReactiveDatasetFieldRepositoryImpl` batch-R invariant 3) is the canonical 'has this column changed?' decision — but the diff endpoint computes hash equality on-the-fly (lines 218-225) rather than reading the pre-computed hash. The same hash function is used; the result is the same.",
    "**Diff has a parent-field cascade rule** — `DatasetVersionServiceImpl.getParentOddrnChangedPojos` (lines 156-180) treats every child field of a parent-renamed-or-deleted column as itself DELETED+CREATED, surfacing the parent restructure to ALL descendants. The result is amplified diff output for parent-field changes — a single struct rename can cascade DELETE+CREATE rows for every nested field. Behaviour intentional (the diff IS the visible side of column-level versioning-by-reference, batch-R `dataset_field_versioning_by_reference` invariant) but NOT documented at the live API-reference surface.",
    "**Identical-versions diff returns 400 BadUserRequestException.** `DatasetVersionServiceImpl.java:59-61` — `if (firstVersionId == secondVersionId) return Mono.error(new BadUserRequestException(\"Couldn't show diff for identical versions\"))`. The check is correctly defensive; not documented on the spec.",
    "**NotFoundException semantics asymmetric between by-version and latest.** `getDatasetVersion` throws NotFoundException with the dataset-id-formatted message; `getLatestDatasetVersion` throws with a dataset-only message. `getDatasetVersionDiff` does NOT throw NotFoundException on a missing version — `getDatasetVersionWithFields` (lines 146-157) returns whatever rows match `IN (...)`; the diff calculator's `if (versionFields.size() != 2)` check (line 69-71) throws a generic RuntimeException (NOT BadUserRequestException, NOT NotFoundException) when one of the version ids does not exist. The runtime exception surfaces as 500 — a missing version on the diff endpoint is therefore a 500, not a 404.",
    "**Live API-reference docs do not mention any of the four endpoints.** Live page `https://docs.opendatadiscovery.org/developer-guides/api-reference` (WebFetched 2026-05-20, status 200) lists 9 feature-sub-page hubs (Alerts / Data Collaboration / Directory / Glossary / Integrations / Lineage / Query Examples / Reference Data / Relationships) — NONE describe `/api/datasets/{id}/structure/*`. The `relationships` sub-page (WebFetched 2026-05-20, status 200) lists three endpoints `GET /api/relationships`, `GET /api/relationships/erd/{id}`, `GET /api/relationships/graph/{id}` but explicitly omits `GET /api/datasets/{data_entity_id}/relationships`. Feature `https://docs.opendatadiscovery.org/features/data-discovery` (WebFetched 2026-05-20, status 200) names 'Dataset schema diff' as a sub-feature but provides no API anchor or permission model."
  ]
- audiences: [
    "operators-via-API — UI calls hitting `/api/datasets/{id}/structure/...` from the data-entity detail page's 'Structure' tab and 'Version history' / 'Compare versions' surfaces. Direct REST clients building catalog-tooling that reads dataset structure or compares schema revisions.",
    "`DataSetApi` (OpenAPI-generated interface — the contract surface this controller implements; spec at `odd-platform-specification/openapi.yaml:1793-1878` defines path/verb/payload shapes)",
    "downstream consumers of the verbatim-stored `internal_description` field — the F-004 XSS-class read-side. PUT writes (DatasetFieldController) persist user-supplied Markdown / HTML to `dataset_field.internal_description`; THIS controller's `getDataSetStructure*` endpoints surface that content back to the UI via the `DataSetField` payload."
  ]

## dependencies_semantic

- requires-feature: [
    "`DatasetVersionService` (3 calls: `getDatasetVersion`, `getLatestDatasetVersion`, `getDatasetVersionDiff`)",
    "`RelationshipsService` (1 call: `getRelationsByDatasetId`)",
    "OpenAPI-generated `DataSetApi` (the implements-target; the contract that defines path/verb/payload shapes for all 4 endpoints; spec at `openapi.yaml:1793-1878`)"
  ]
- requires-config: [] — N/A. The controller reads no config keys; no `@Value`, no `@ConditionalOnProperty`. The two collaborating services also have no config dependencies (verified `DatasetVersionServiceImpl` and `RelationshipsServiceImpl` constructors take only repository + mapper dependencies, no `@Value` / `@ConfigurationProperties`).
- requires-runtime: [
    "Spring WebFlux (`@RestController` at line 16; reactive `Mono<ResponseEntity<...>>` signatures throughout)",
    "Lombok (`@RequiredArgsConstructor` at line 17 generates the 2-service constructor injection)",
    "PostgreSQL — the actual reads target `dataset_version`, `dataset_structure` (M:N), `dataset_field`, `data_entity` (latest-version subquery), plus the F-004 description payload at `dataset_field.internal_description`; relationships endpoint reads from the relationships tables (cross-ref to ReactiveRelationshipsRepository sidecar — outside this batch)"
  ]
- coupling: [
    "**`DatasetVersionServiceImpl`** — the dominant collaborator. The id-confusion / per-entity-scoping bypass invariants 3+4 live at this service layer, NOT this controller — but a future refactor inserting `datasetId` into the WHERE clause at the service tier would silently change the contract surfaced by THIS controller (calls to `GET /api/datasets/{wrong_id}/structure/{valid_version_id}` would start returning 404 instead of the version payload).",
    "**`ReactiveDatasetVersionRepositoryImpl`** — the SQL layer where the id-confusion is observable. `getDatasetVersion` (lines 97-144) and `getDatasetVersionWithFields` (lines 146-157) both filter on `DATASET_VERSION.ID` only — these query shapes ARE the per-entity-scoping bypass.",
    "**`ReactiveDatasetFieldRepositoryImpl`** (batch-R sidecar) — the `internal_description` field surfaced by `getDataSetStructure*` endpoints is written verbatim by the column-level description-edit path (DatasetFieldController PUT /api/datasetfields/{id}/description); this controller READS that verbatim content back into the UI's DatasetField render path. F-004 batch-R class fingerprint flows through THIS controller's response shape.",
    "**`DatasetVersionHashCalculator`** — invoked by the diff calculator's `fieldsAreTheSameBetweenVersions` (lines 218-225) to determine NO_CHANGES vs UPDATED status. A change to the hash function (factors `name`, `type`, `is_key`, `is_value`, `is_primary_key`, `is_sort_key`, `external_description`) silently changes diff output stability.",
    "**`SecurityConstants.SECURITY_RULES`** — the absence of any matching rule for `/api/datasets/{data_entity_id}/structure/*` paths is itself a coupling: the controller's authorization posture (any-authenticated-user-can-read) is enforced by NOT being in the list. If a future refactor adds owner-scoping to other read endpoints (e.g. P-09 maintainer-note remediation of REFACTOR-024 / REFACTOR-203), this endpoint family is the next candidate — its absence from SECURITY_RULES is the path of least resistance for a regression.",
    "**OpenAPI `DataSetApi` interface** — every controller method signature is dictated by the OpenAPI generator. The controller is purely a thin proxy implementing this interface; signature drift between spec and impl is a compile error."
  ]

## tests_coverage_semantic

- covered_behaviours: [
    "`getDatasetVersion(versionId)` returns a populated DatasetStructureDto for a known version id (`ReactiveDatasetVersionRepositoryImplTest.testGetDatasetVersion` lines 51-74 — uses bulkCreate to seed; asserts only on `getDatasetVersion` and `getDatasetFields` non-null, NOT on cross-entity scoping)",
    "`getDatasetVersion(versionId)` returns Mono.empty for unknown version id (`ReactiveDatasetVersionRepositoryImplTest.testGetDatasetVersionNotFound` lines 76-83 — but does NOT assert on the NotFoundException-at-service-layer wrapping)"
  ]
- uncovered_behaviours: [
    "{behaviour: 'GET /api/datasets/{wrong_id}/structure/{valid_version_id_for_other_dataset} returns the OTHER dataset's structure (id-confusion bypass)', test_class: 'security'} — the per-entity-scoping bypass at the structure-by-version endpoint",
    "{behaviour: 'GET /api/datasets/{any_id}/structure/diff?first_version_id=A&second_version_id=B where A and B belong to two DIFFERENT datasets returns a cross-dataset diff', test_class: 'security'} — the per-entity-scoping bypass at the diff endpoint",
    "{behaviour: 'GET /api/datasets/{id}/structure/diff with a non-existent version_id returns HTTP 500, NOT 404', test_class: 'integration'} — the `if (versionFields.size() != 2) throw RuntimeException` (DatasetVersionServiceImpl.java:69-71) contract surfaces as 500",
    "{behaviour: 'GET /api/datasets/{id}/structure/diff?first_version_id=A&second_version_id=A returns HTTP 400 BadUserRequest', test_class: 'integration'} — the identical-versions guard (line 59-61)",
    "{behaviour: 'GET /api/datasets/{id}/structure surfaces dataset_field.internal_description verbatim including <script> / Markdown payloads — F-004 read-side fingerprint', test_class: 'security'} — F-004 batch-R column-level XSS-class through THIS controller's read path",
    "{behaviour: 'GET /api/datasets/{id}/structure under auth.type=DISABLED is anonymously reachable', test_class: 'security'} — no SecurityRule + DISABLED bypasses global auth; the no-rule + DISABLED-anonymous combination is the worst-case read posture",
    "{behaviour: 'GET /api/datasets/{id}/structure for a dataset owned by another team is reachable by any authenticated user — read-collaborative posture verification', test_class: 'security'} — the cross-owner read class consistent with REFACTOR-024 / REFACTOR-203 family",
    "{behaviour: 'GET /api/datasets/{id}/relationships returns ERD/Graph relationships for the dataset and includes relationships into entities owned by other teams', test_class: 'security'} — cross-owner read at the relationships surface",
    "{behaviour: 'GET /api/datasets/{id}/structure/diff with a parent-field rename cascades DELETE+CREATE rows for every nested field (parent-cascade semantic)', test_class: 'integration'} — DatasetVersionServiceImpl.getParentOddrnChangedPojos lines 156-180",
    "{behaviour: 'GET /api/datasets/{id}/structure returns soft-deleted Tags filtered out by TAG.DELETED_AT IS NULL (line 119, 126, 193, 200 of ReactiveDatasetVersionRepositoryImpl)', test_class: 'integration'} — the soft-delete filter on tag join unverified at the HTTP boundary"
  ]
- test_files: [
    "(NO direct controller test) — Grep `DatasetController` in `odd-platform-api/src/test/java/**` returns ZERO matches (verified). No HTTP-boundary tests for any of the 4 endpoints.",
    "(Repository-tier) — `ReactiveDatasetVersionRepositoryImplTest.java:1-99` — 2 tests on `getDatasetVersion` (positive + empty) AND 1 test on `getVersions`; does NOT exercise `getLatestDatasetVersion`, `getDatasetVersionWithFields`, or the id-confusion contract.",
    "(Mapper) — `DatasetVersionMapperTest.java` exercises the DatasetVersionMapper shape; does NOT drive controller requests.",
    "(Service tier) — Grep `DatasetVersionService|DatasetVersionServiceImpl` in `odd-platform-api/src/test/java/**` returns zero matches; no service-tier tests on `getDatasetVersionDiff` / `getDatasetVersion` / `getLatestDatasetVersion`."
  ]
- gaps: |
    The controller has ZERO direct HTTP-boundary tests; the service tier has ZERO direct tests. Every behaviour observable at the HTTP boundary — the id-confusion / per-entity-scoping bypass at by-version-id + diff endpoints, the 500-on-missing-version-id on diff (vs 404 elsewhere), the identical-versions 400 contract, the F-004 verbatim-description read-side surface, the cross-owner read posture under all four auth modes including DISABLED, the parent-field cascade semantics in diff — is unverified.

    Five regression classes that would fail silently:

    1. **The id-confusion bypass at `getDataSetStructureByVersionId` and `getDataSetStructureDiff`** — a future refactor that ADDS a `datasetId` WHERE clause to the SQL would silently change the contract; no test asserts the current bypass behaviour OR the corrected scoping. Either direction would land without a regression test surfacing it.

    2. **The 500-on-missing-version-id contract for diff** — the `if (versionFields.size() != 2) throw RuntimeException` (DatasetVersionServiceImpl.java:69-71) is generic and bubbles as 500. A refactor to NotFoundException would silently change clients' error-handling assumptions.

    3. **The F-004 verbatim-storage read-side surface** — `dataset_field.internal_description` payloads written by the PUT path (DatasetFieldController batch-V) surface verbatim via THIS controller's `getDataSetStructure*` endpoints. The UI render-layer defence-in-depth (probe P-009 — Markdown.tsx) is the operative safeguard; no test asserts that `<script>` / `<img onerror>` payloads round-trip verbatim through GET → render-stage.

    4. **The read-collaborative posture across all four auth modes** — the no-SecurityRule + global-auth-only gate means LOGIN_FORM / OAUTH2 / LDAP all reach this endpoint, and DISABLED is anonymously reachable. No test asserts the per-mode reachability + the cross-owner data exposure.

    5. **The parent-field cascade DELETE+CREATE amplification in diff** — `getParentOddrnChangedPojos` (lines 156-180) treats every child of a renamed-or-deleted parent as itself DELETED+CREATED; for nested struct types, this cascades widely. No test asserts the amplification, the diff payload size growth, or the UI render impact.

## docs_link_semantic

- declared_docs: [] — no `@docs` annotation in the source file (Grep across `DatasetController.java` confirms no `@docs`, `// @docs`, or JavaDoc `{@link docs}` pattern; the class is 60 lines and uses zero JavaDoc beyond the OpenAPI-generated `DataSetApi` interface).
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/developer-guides/api-reference"
    anchor: ""
    rationale: "The API-reference hub is the canonical home for any `/api/*` endpoint surface. The 4 endpoints in this controller are part of the OpenAPI spec at `odd-platform-specification/openapi.yaml:1793-1878` (tag `dataSet`) but NO sub-page on the live API-reference hub documents the `dataSet` tag — the hub lists 9 feature-sub-pages (Alerts / Data Collaboration / Directory / Glossary / Integrations / Lineage / Query Examples / Reference Data / Relationships); a `dataSet` sub-page is missing."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    fetched_excerpts: |
      Verbatim from the live page (2026-05-20, status 200):
      "The reference hub documents these feature areas: Alerts, Data Collaboration, Directory, Glossary, Integrations, Lineage, Query Examples, Reference Data, Relationships. None of these sections mention dataset-specific CRUD operations, versioning, or diff functionality."
    confidence: HIGH
  - url: "https://docs.opendatadiscovery.org/developer-guides/api-reference/relationships"
    anchor: ""
    rationale: "The relationships sub-page is the closest live documentation for `getDataSetRelationships` (GET /api/datasets/{data_entity_id}/relationships). The live page documents the 3 `/api/relationships*` family endpoints but explicitly OMITS the dataset-scoped variant — drift class `endpoint-in-spec-but-not-in-docs`."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    fetched_excerpts: |
      Verbatim from the live page (2026-05-20, status 200):
      "This page lists three endpoints:
       1. GET /api/relationships?page=N&size=M&type=ERD|GRAPH|ALL&query=...
       2. GET /api/relationships/erd/{relationship_id}
       3. GET /api/relationships/graph/{relationship_id}
       Regarding GET /api/datasets/{data_entity_id}/relationships — No, this endpoint is not mentioned on this page."
    confidence: HIGH
  - url: "https://docs.opendatadiscovery.org/features/data-discovery"
    anchor: "#change-and-freshness-signals"
    rationale: "The Data Discovery feature page mentions 'Dataset schema diff' as a sub-feature: 'visual side-by-side comparison of dataset schema revisions, with backwards-incompatible changes additionally raising an alert.' The text describes the UI behaviour but provides no API anchor, permission model, or per-entity-scoping commentary."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    fetched_excerpts: |
      Verbatim from the live page (2026-05-20, status 200):
      "What it describes: The feature provides a 'visual side-by-side comparison of dataset schema revisions, with backwards-incompatible changes additionally raising an alert.'
       What it does NOT describe: The documentation does not elaborate on:
       - How to access or use the feature
       - Owner-scoping or permission requirements
       - Who can view dataset versions or diffs
       - Specific UI mechanics or workflows"
    confidence: HIGH
- doc_drift_findings:
  - "Live API-reference hub (`https://docs.opendatadiscovery.org/developer-guides/api-reference`, WebFetched 2026-05-20, status 200) lists 9 feature-sub-pages — NONE describe the `dataSet` OpenAPI tag's endpoints. The four endpoints in this controller (`GET /api/datasets/{id}/structure/{version_id}`, `GET /api/datasets/{id}/structure`, `GET /api/datasets/{id}/structure/diff`, `GET /api/datasets/{id}/relationships`) are in the spec but have NO documented surface. Operators discovering these endpoints rely on Swagger UI at `{platform-base-url}/api/v3/api-docs`."
  - "Live `https://docs.opendatadiscovery.org/developer-guides/api-reference/relationships` (WebFetched 2026-05-20, status 200) lists `/api/relationships`, `/api/relationships/erd/{id}`, `/api/relationships/graph/{id}` but explicitly OMITS `GET /api/datasets/{data_entity_id}/relationships`. The dataset-scoped relationships endpoint is in the spec at `odd-platform-specification/openapi.yaml:1810-1826` (tag `dataSet`) but has no doc anchor. Operators wanting to retrieve relationships scoped to ONE dataset have to discover this endpoint by reading the spec or the Swagger UI."
  - "Live `https://docs.opendatadiscovery.org/features/data-discovery` (WebFetched 2026-05-20, status 200) names 'Dataset schema diff' as a sub-feature but provides NO API anchor and NO mention of permission model / owner-scoping. The actual implementation accepts any version_id pair regardless of parent dataset — operators reading the feature description cannot infer the id-confusion behaviour."
  - "Live docs do NOT describe the parent-field cascade DELETE+CREATE semantics in `getDataSetStructureDiff`. A parent-field rename surfaces as DELETE+CREATE for every nested child; the diff payload size grows non-linearly with struct depth. Operators comparing two versions of a nested-struct dataset see amplified diff output with no documentation of why."
  - "Live docs do NOT describe the cross-owner read posture at the dataset structure surface. Operators reading 'Dataset schema diff' on Data Discovery have no signal that the endpoint is reachable by any authenticated user (LOGIN_FORM / OAUTH2 / LDAP) AND anonymously under DISABLED. Same read-collaborative pattern as P-05 lineage (F-005 REFACTOR-203 cross-owner enumeration) — extends to this controller's surface."

## implicit_adrs

- "**Thin-proxy controller — every method body is a one-line `service.X(...).map(ResponseEntity::ok)` shape with NO controller-layer validation or error handling.**" — evidence: DatasetController.java:22-58 — intent_anchor: "Lines 28-30 (`getDataSetStructureByVersionId` body): `return datasetVersionService.getDatasetVersion(dataEntityId, versionId).map(ResponseEntity::ok);` — and the same shape repeats for every endpoint. The controller is a deliberate passthrough; the OpenAPI-generated `DataSetApi` interface dictates the signatures and the services own the business logic. Convention applied uniformly across all 4 endpoints AND across the controller package (sibling: DatasetFieldController, ActivityController, AlertController — all the same thin-proxy shape per batch-V + batch-Q sidecars)." — confidence: HIGH

- "**All four endpoints are GET reads with NO `SecurityRule` entry — intentional read-collaborative posture matching the platform-wide pattern.**" — evidence: DatasetController.java:22-58 (all four `@Override` methods return `Mono<ResponseEntity<...>>`, no PUT/POST/DELETE) + SecurityConstants.java:98-355 (verified — only `/api/datasets/{data_entity_id}/dataqatests/{dataqa_test_id}/severity PUT` line 244-246 has a rule for `/api/datasets/`) — intent_anchor: "The platform-wide pattern is consistent: WRITES are in `SECURITY_RULES`, READS fall back to global authentication-only. `SecurityConstants.SECURITY_RULES` (lines 98-355) contains 89 rules — every one is for a POST / PUT / PATCH / DELETE endpoint or for the specific GET endpoints intentionally gated (`/api/owner_association_request` GET line 148-150 — the only GET in the list). The omission of structure/relationship READS from SECURITY_RULES is intentional and uniform across the catalog. Read-collaborative posture documented at `system-mission.md` P-09 maintainer notes." — confidence: HIGH

- "**Diff semantics encode the column-level versioning-by-reference model — a parent-field rename cascades DELETE+CREATE rows for every nested child field.**" — evidence: DatasetVersionServiceImpl.java:156-180 (getParentOddrnChangedPojos) + 110-147 (calculateVersionDiff branches on parentOddrnChanged) — intent_anchor: "Lines 156-180 implement a recursive fixed-point algorithm that propagates `parentFieldChanged` from any field whose parent oddrn was renamed to ALL its descendants. The downstream `calculateVersionDiff` (lines 110-134) then emits TWO rows for every descendant: one DELETED (line 121, minVersionDiff) + one CREATED (line 129, maxVersionDiff). The intent is explicit: a struct rename invalidates every nested column's identity at the dataset_field row level (consistent with the versioning-by-reference invariant in `ReactiveDatasetFieldRepositoryImpl` batch-R + concept `dataset-field-versioning-by-reference-no-soft-delete-orphan-accumulation`)." — confidence: HIGH

- "**Identical-versions diff explicitly rejected via BadUserRequestException (400) — defensive guard at the service tier.**" — evidence: DatasetVersionServiceImpl.java:59-61 — intent_anchor: "Lines 59-61: `if (firstVersionId == secondVersionId) { return Mono.error(new BadUserRequestException(\"Couldn't show diff for identical versions\")); }` — the explicit error message names the user-error class. Intentional input validation at the service tier rather than the controller; consistent with the thin-proxy pattern." — confidence: HIGH

- "**`getLatestDatasetVersion` correctly cross-checks `data_entity_id`; `getDatasetVersion` and `getDatasetVersionDiff` do NOT — three different SQL shapes in the SAME repository, only one of which scopes.**" — evidence: ReactiveDatasetVersionRepositoryImpl.java:160-217 (latest, uses `DATA_ENTITY.ID.eq(datasetId)` line 167) vs 97-144 (by-version, no DATA_ENTITY join) + 146-157 (with-fields-for-diff, no DATA_ENTITY join) — intent_anchor: "The three SQL shapes are written by the same author in the same file. The `getLatestDatasetVersion` shape MUST use the `data_entity_id` because there is no single 'latest version' without a dataset anchor. The other two shapes COULD use it (the path provides it) but don't — the author chose to scope only by `dataset_version.id`. This MAY be an implementation shortcut (the dataset_version id is a globally unique surrogate so the join is redundant for correctness) — OR it MAY be an oversight (the URL implies parent-scoping but the SQL does not enforce it). No comment in the file frames the intent. The decision-shape is ambiguous — this entry is HEDGED at MEDIUM confidence; the alternative routing is `bugs_limitations_corner_cases` if the maintainer reads it as oversight rather than intent." — confidence: MEDIUM

## bugs_limitations_corner_cases

- "**Per-entity-scoping bypass at `getDataSetStructureByVersionId` — the `data_entity_id` URL parameter is NOT enforced against the `version_id`.** A client calling `GET /api/datasets/{any_id}/structure/{valid_version_id_for_other_dataset}` receives the OTHER dataset's structure. The only consumer of the `datasetId` argument at the service tier is the NotFoundException message text (`DatasetVersionServiceImpl.java:41-43`); the SQL filters `WHERE DATASET_VERSION.ID = datasetVersionId` only (`ReactiveDatasetVersionRepositoryImpl.java:129`). Cross-link to F-005 cross-owner enumeration class (same blast radius — any authenticated user can enumerate any dataset's version history by guessing version ids). Severity HIGH because: (a) URL parameter implies a parent-child relationship that the implementation does not enforce; (b) operator wiring permission policies on `/api/datasets/{id}/...` would assume the parent is scoped; (c) audit logs / tracing tools tagging requests by `data_entity_id` may attribute reads to the wrong dataset." — evidence: DatasetController.java:23-30 + DatasetVersionServiceImpl.java:39-45 + ReactiveDatasetVersionRepositoryImpl.java:97-144 — severity: HIGH

- "**Per-entity-scoping bypass at `getDataSetStructureDiff` — `data_entity_id` URL parameter is NOT enforced against `first_version_id` or `second_version_id`.** A client calling `GET /api/datasets/{any_id}/structure/diff?first_version_id=A&second_version_id=B` where A and B belong to two DIFFERENT datasets receives a cross-dataset structure diff. The diff computation operates on the raw column lists keyed by `oddrn` (`DatasetVersionServiceImpl.java:86-106`); columns from two unrelated datasets compare by oddrn-mismatch as DELETED+CREATED — producing a nonsensical but well-formed diff payload. Severity HIGH for the same reasons as the by-version bypass." — evidence: DatasetController.java:43-50 + DatasetVersionServiceImpl.java:55-64 + ReactiveDatasetVersionRepositoryImpl.java:146-157 — severity: HIGH

- "**Missing version_id on diff endpoint returns HTTP 500, not 404.** `DatasetVersionServiceImpl.buildDataSetVersionDiffList` line 69-71 throws a generic `RuntimeException` when `versionFields.size() != 2` (i.e., one of the requested version ids does not exist). The runtime exception is NOT translated to a `BadUserRequestException` or `NotFoundException` — it bubbles as HTTP 500. The other two structure endpoints throw `NotFoundException` correctly (`DatasetVersionServiceImpl.java:41-43, 50-51`). Inconsistent error contract within the same controller's surface." — evidence: DatasetVersionServiceImpl.java:69-71 + DatasetController.java:43-50 — severity: MEDIUM

- "**Verbatim-storage F-004 read-side surface at the column-level.** `getDataSetStructureByVersionId` / `getDataSetStructureLatest` return the full `DataSetField` payload including `internal_description` — the field where DatasetFieldController PUT writes user-supplied Markdown / HTML payloads verbatim (batch-V + batch-R `ReactiveDatasetFieldRepositoryImpl.updateDescription`). The read path's UI consumer renders the description via the Markdown.tsx pipeline (probe P-009 PASS for entity-description render); cross-tab coverage of the DatasetField description render path is unverified per F-004 batch-R notes. THIS controller is the canonical READ surface for the F-004 column-level write surface." — evidence: DatasetController.java:22-41 (getDataSetStructure return shape includes `DataSetField.internalDescription`) + ReactiveDatasetVersionRepositoryImpl.java:97-144 (no sanitisation, no length cap, no allowlist on the returned `internal_description` field) + cross-ref to ReactiveDatasetFieldRepositoryImpl batch-R bugs_limitations_corner_cases[1] (verbatim-storage write path) — severity: MEDIUM

- "**Endpoints not documented at the live API-reference surface.** All four endpoints are in the OpenAPI spec at `odd-platform-specification/openapi.yaml:1793-1878` (tag `dataSet`) but NO live doc page describes them. Operators discovering the structure / diff / dataset-relationships endpoints rely on Swagger UI at runtime. `GET /api/datasets/{data_entity_id}/relationships` is particularly impacted because the closest live page (`https://docs.opendatadiscovery.org/developer-guides/api-reference/relationships`) lists OTHER relationships endpoints but explicitly omits this one (`drift_class: endpoint-in-spec-but-not-in-docs`)." — evidence: WebFetch `https://docs.opendatadiscovery.org/developer-guides/api-reference` (status 200, 2026-05-20) + WebFetch `https://docs.opendatadiscovery.org/developer-guides/api-reference/relationships` (status 200, 2026-05-20) — severity: MEDIUM

- "**Cross-owner read posture at the dataset structure surface — undocumented.** All four endpoints fall back to global authentication-only (no SecurityRule); any authenticated user can read any dataset's structure / version / relationships, INCLUDING datasets owned by other teams. Under `auth.type=DISABLED`, the endpoints are anonymously reachable. The live `https://docs.opendatadiscovery.org/features/data-discovery` page describes 'Dataset schema diff' as a feature but provides no signal about owner-scoping or who-can-view. Cross-link to F-005 REFACTOR-203 cross-owner enumeration class and the system-mission.md P-09 maintainer-notes 'read-collaborative posture' canonicalisation candidate." — evidence: SecurityConstants.java:98-355 (verified — no rule for `/api/datasets/{id}/structure/*` or `/api/datasets/{id}/relationships`) + WebFetch `https://docs.opendatadiscovery.org/features/data-discovery` (status 200, 2026-05-20) + WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization` (status 200, 2026-05-20 — confirms no doc-side text on read-collaborative posture) — severity: MEDIUM

- "**Parent-field cascade DELETE+CREATE amplification in diff — undocumented.** `DatasetVersionServiceImpl.getParentOddrnChangedPojos` (lines 156-180) propagates a parent-rename through every descendant; the diff payload size grows non-linearly with struct depth. Operators comparing nested-struct datasets see amplified diff output with no doc-side text explaining why. Behaviour intentional (encodes the versioning-by-reference invariant) but unsurfaced to API consumers." — evidence: DatasetVersionServiceImpl.java:156-180 + 110-147 — severity: LOW

## security

- **auth_mode_relevance**: `LOGIN_FORM | OAUTH2 | LDAP` (the three UI auth modes that protect this API surface). `DISABLED` bypasses all gates and exposes all four endpoints to any caller. `S2S` does not apply — `/api/datasets/*` paths are UI/API surface, not `/ingestion/*` paths. The controller itself carries no `@ConditionalOnProperty(auth.type=...)` — it is wired unconditionally.
- **ingestion_filter_relevance**: `NO — UI/API surface, not ingestion`. The S2S ingestion filter (`auth.ingestion.filter.enabled`) gates `POST /ingestion/entities`, which does not reach this controller. Ingestion-side dataset-version creation flows through `DatasetStructureIngestionRequestProcessor → DatasetFieldServiceImpl.createOrUpdateDatasetFields` directly, bypassing this controller (which is read-only).
- **authorization_assertions**:
  - "NO SecurityRule entry for `GET /api/datasets/{data_entity_id}/structure/{version_id}` — falls back to global authentication-only gate." — evidence: SecurityConstants.java:98-355 (verified no matching rule)
  - "NO SecurityRule entry for `GET /api/datasets/{data_entity_id}/structure` (latest) — falls back to global authentication-only gate." — evidence: SecurityConstants.java:98-355
  - "NO SecurityRule entry for `GET /api/datasets/{data_entity_id}/structure/diff` — falls back to global authentication-only gate." — evidence: SecurityConstants.java:98-355
  - "NO SecurityRule entry for `GET /api/datasets/{data_entity_id}/relationships` — falls back to global authentication-only gate." — evidence: SecurityConstants.java:98-355
- **owner_scoping**: `BYPASSES — all four endpoints are platform-wide visible to any authenticated user; no per-owner filter at any layer (controller → service → repository).` Cross-link to the F-005 cross-owner enumeration class — same blast radius extends to dataset structure / version / relationships reads. Same pattern as P-05 LineageServiceImpl batch-I, ReactiveDataEntityRepositoryImpl batch-D invariant 6, ReactiveDatasetFieldRepositoryImpl batch-R invariant 6.
- **data_exposure**:
  - "`DataSetStructure` response (DatasetVersionPojo + List<DataSetField>) → any user authorized via global auth (LOGIN_FORM / OAUTH2 / LDAP) or anonymously under DISABLED. Contains the FULL column metadata including `internal_description` (the F-004 verbatim-storage XSS-class field), `internal_name`, tags, terms, metadata values, enum value counts, lookup-table definitions."
  - "`DataSetVersionDiffList` response (List<DataSetVersionDiff>) → any user authorized via global auth. Each DataSetVersionDiff contains the per-version `DataSetFieldDiffState` showing the CREATED / UPDATED / DELETED / NO_CHANGES status PLUS the verbatim before / after snapshots of each column — the diff IS a structural change-log of the dataset's column-level evolution."
  - "`DataEntityRelationshipDetailsList` response → any user authorized via global auth. Contains ERD / Graph relationships including the referenced data entities' identities (ERD relationships expose foreign-key topology across owner boundaries)."
- **known_security_gaps**:
  - "Per-entity-scoping bypass at `getDataSetStructureByVersionId` — `data_entity_id` URL parameter is NOT enforced; any authenticated user can read any dataset version's full column structure by passing a known `version_id`. Combined with the read-collaborative posture, this is the F-004 verbatim-description read-side blast radius on steroids — every dataset_field.internal_description payload across the catalog is reachable via a brute-forced version_id." — evidence: DatasetController.java:23-30 + DatasetVersionServiceImpl.java:39-45 + ReactiveDatasetVersionRepositoryImpl.java:97-144 — severity: HIGH

  - "Per-entity-scoping bypass at `getDataSetStructureDiff` — `data_entity_id` URL parameter is NOT enforced against `first_version_id` / `second_version_id`. Two unrelated datasets' versions can be diffed; the response is a nonsensical-but-well-formed structural diff payload — useful as an enumeration vector (a caller can prove which version ids exist by observing the diff status fields)." — evidence: DatasetController.java:43-50 + DatasetVersionServiceImpl.java:55-64 + ReactiveDatasetVersionRepositoryImpl.java:146-157 — severity: HIGH

  - "Cross-owner read posture at all four endpoints under all auth modes — any LOGIN_FORM / OAUTH2 / LDAP authenticated user reads any dataset's structure / versions / diff / relationships. Under DISABLED the endpoints are anonymously reachable. No documentation surface advises operators that the catalog is enumerable end-to-end via these endpoints." — evidence: SecurityConstants.java:98-355 (no rule for any of the four paths) + cross-link F-005 cross-owner enumeration class — severity: MEDIUM

  - "F-004 verbatim-storage XSS-class read-side surface at the column level — `getDataSetStructure*` endpoints return `internal_description` verbatim including user-supplied Markdown / HTML / script payloads. UI render-layer defence-in-depth (probe P-009 Markdown.tsx) is the operative safeguard; cross-tab coverage of the DatasetField description render path is unverified." — evidence: DatasetController.java:22-41 (return shape) + cross-link ReactiveDatasetFieldRepositoryImpl batch-R + ReactiveDatasetVersionRepositoryImpl.java:97-144 (no sanitisation on returned field) — severity: MEDIUM

  - "Enumeration vector: the `dataset_version.id` is a monotonically increasing surrogate (jOOQ-generated sequence). A caller probing `/api/datasets/{any_id}/structure/{1..N}` can enumerate every version id and every dataset structure that ever existed in the catalog, regardless of whether the parent DataEntity is soft-deleted or excluded from search. No rate limit, no audit log on these endpoints." — evidence: DatasetController.java:22-41 + ReactiveDatasetVersionRepositoryImpl.java:97-144 (no soft-delete / status filter on join chain) — severity: MEDIUM

## performance

- **hot_paths**:
  - "`getDatasetVersion(versionId)` issues ONE SQL query joining DATASET_VERSION × DATASET_STRUCTURE × DATASET_FIELD × TAG_TO_DATASET_FIELD × TAG × ENUM_VALUE × DATASET_FIELD_METADATA_VALUE × METADATA_FIELD × DATASET_FIELD_TO_TERM × TERM × NAMESPACE × LOOKUP_TABLES_DEFINITIONS (12 tables, 11 LEFT JOINs) with 8 jsonArrayAgg + 1 countDistinct projections (`ReactiveDatasetVersionRepositoryImpl.java:97-130`). The single-query design avoids N+1 fanout but produces a large result row per `dataset_field` × `tag` × `term` × `enum_value` cross-product before the GROUP BY collapses it." — evidence: ReactiveDatasetVersionRepositoryImpl.java:97-144
  - "`getLatestDatasetVersion(datasetId)` adds a subquery layer (`subquery: SELECT DATASET_ODDRN, MAX(VERSION) FROM DATASET_VERSION JOIN DATA_ENTITY WHERE DATA_ENTITY.ID = ?`) before applying the same 12-table join as above (lines 160-203). Two-stage query: (1) the subquery resolves the latest version_id for the dataset; (2) the main query fans out the structure. The subquery's MAX over partitioned versions is correctly indexed via the DATASET_VERSION primary key + DATA_ENTITY.ODDRN join condition." — evidence: ReactiveDatasetVersionRepositoryImpl.java:160-217
  - "`getDatasetVersionDiff` issues ONE SQL query (`getDatasetVersionWithFields`, lines 146-157) for BOTH version_ids via `DATASET_VERSION.ID.in(datasetVersionIds)`. The diff computation (lines 66-147) is in-memory Java: 3 passes over the field maps (parent-cascade fixed-point + first-version forEach + second-version filter+forEach). For a wide dataset (1000+ columns) the in-memory pass is bounded by 2 × column_count × 2 = 4 × column_count operations." — evidence: DatasetVersionServiceImpl.java:55-64 + ReactiveDatasetVersionRepositoryImpl.java:146-157 + DatasetVersionServiceImpl.java:66-147
- **throughput_characteristics**:
  - "Per-dataset reads — single-item-per-call; the UI's Structure tab calls one endpoint per displayed version; the Version Compare flow calls one diff endpoint per pair selection."
  - "Reactive Mono/Flux signatures throughout — non-blocking I/O. Each endpoint issues ONE or TWO DB round-trips (latest = 2 stages, by-version = 1 stage, diff = 1 stage + in-memory compute, relationships = 1 stage)."
  - "NO bulk surface — to inspect 10 datasets' structures, a client makes 10 calls. Same for 10 diffs."
- **resource_allocation**:
  - "Memory: the 8-jsonArrayAgg main query (`getDatasetVersion`, `getLatestDatasetVersion`) builds JSON arrays for tags / metadata / terms / namespaces per dataset_field; for a 1000-column dataset with 10 tags per column + 5 metadata values + 3 terms, the JSON payload can reach single-digit MB before the application-tier collect-and-extract step. The `mapToDatasetVersionFields` pass (line 311-318) deserialises into `DatasetFieldPojo` instances; for a 1000-column dataset, the per-request heap allocation is 1000 × (DatasetFieldPojo + tag-list + metadata-list + term-list) ≈ low-MB allocation."
  - "DB round-trip count per request: 1 (by-version), 2 (latest — subquery + main), 1 (diff — single IN-clause query), 1 (relationships). No N+1 fanout."
- **scaling_characteristics**:
  - "Stateless controller — instances scale horizontally."
  - "Read-only — no transaction span concerns at the controller / service tier."
  - "No pagination on any of the four endpoints. For diff of two ultra-wide-schema versions (1000+ columns each), the response payload size is unbounded. For relationships, the response is bounded by the relationships count for the specific dataset id; no pagination but typically small."
  - "Diff computation is in-memory Java (recursive parent-cascade fixed-point + 2 forEach passes). For pathological inputs (deeply nested struct types with N levels and B branching at each level), the parent-cascade can iterate up to N times before convergence; the per-iteration cost is O(2 × field_count). For a 5-level-deep struct with 100 leaves per level, this is 500 fields × 5 iterations = 2500 hash lookups — still trivially small."
- **known_performance_gaps**:
  - "No pagination on diff endpoint — a comparison of two 1000-column versions returns 1000+ DataSetVersionDiff rows in a single response. With the parent-field cascade amplification (a single parent rename can yield 2N rows for an N-leaf subtree), pathological cases can produce > 10K diff rows in a single payload." — evidence: DatasetController.java:43-50 + DatasetVersionServiceImpl.java:66-147 — severity: LOW

  - "12-table LEFT JOIN with 8 jsonArrayAgg projections per `getDatasetVersion` / `getLatestDatasetVersion` — for a dataset with thousands of columns and many tags / metadata / terms, the intermediate cross-product BEFORE the GROUP BY collapse is large. Postgres planner choices on the JOIN order matter; no explicit JOIN-hint, no `asMaterialized` CTE marker (unlike `ReactiveDatasetFieldRepositoryImpl.listByTerm` line 191-192 which DOES use `asMaterialized`)." — evidence: ReactiveDatasetVersionRepositoryImpl.java:97-130 + 176-203 — severity: LOW

  - "Enumeration vector implies a DoS class: a caller probing `GET /api/datasets/1/structure/{1..1000000}` issues a million reads, each running the 12-table join. No rate-limit, no audit-log, no soft-delete filter exclusion." — evidence: DatasetController.java + ReactiveDatasetVersionRepositoryImpl.java (no filter or limit) — severity: LOW

## sources

- understanding ← DatasetController.java:1-60 + openapi.yaml:1793-1878 + SecurityConstants.java:98-355 (verified no matching rules) + DatasetVersionServiceImpl.java:1-226 + ReactiveDatasetVersionRepositoryImpl.java:97-217
- concepts.entities.DataSetStructure ← DatasetController.java:6, 23, 34 + openapi.yaml:1797, 1806
- concepts.entities.DataSetVersionDiffList ← DatasetController.java:7, 44 + openapi.yaml:1855, 1876
- concepts.entities.DataEntityRelationshipDetailsList ← DatasetController.java:5, 53 + openapi.yaml:1814, 1824
- concepts.entities.RelationshipsType ← DatasetController.java:8, 55 + RelationshipsService.java:10-11
- concepts.operations.get-structure-by-version-id ← DatasetController.java:22-31 + DatasetVersionServiceImpl.java:39-45 + ReactiveDatasetVersionRepositoryImpl.java:97-144
- concepts.operations.get-structure-latest ← DatasetController.java:33-41 + DatasetVersionServiceImpl.java:47-53 + ReactiveDatasetVersionRepositoryImpl.java:160-217
- concepts.operations.get-structure-diff ← DatasetController.java:43-50 + DatasetVersionServiceImpl.java:55-64 + ReactiveDatasetVersionRepositoryImpl.java:146-157
- concepts.operations.get-dataset-relationships ← DatasetController.java:52-58 + RelationshipsServiceImpl.java:23-28
- concepts.invariants[0] thin-proxy ← DatasetController.java:22-58
- concepts.invariants[1] no-SecurityRule-for-this-controller ← SecurityConstants.java:98-355 (verified Grep — only `/api/datasets/{data_entity_id}/dataqatests/...` line 244-246)
- concepts.invariants[2] getDataSetStructureByVersionId-ignores-dataEntityId ← DatasetController.java:23-30 + DatasetVersionServiceImpl.java:39-45 + ReactiveDatasetVersionRepositoryImpl.java:97-144 (line 129 WHERE clause)
- concepts.invariants[3] getDataSetStructureDiff-ignores-dataEntityId ← DatasetController.java:43-50 + DatasetVersionServiceImpl.java:55-64 + ReactiveDatasetVersionRepositoryImpl.java:146-157 (line 154 WHERE clause)
- concepts.invariants[4] getDataSetStructureLatest-DOES-use-dataEntityId ← ReactiveDatasetVersionRepositoryImpl.java:160-217 (line 167 WHERE clause)
- concepts.invariants[5] diff-uses-column-versioning-by-reference ← DatasetVersionServiceImpl.java:192-225 + cross-link ReactiveDatasetFieldRepositoryImpl batch-R sidecar (versioning-by-reference invariant)
- concepts.invariants[6] parent-field-cascade ← DatasetVersionServiceImpl.java:156-180 (getParentOddrnChangedPojos) + 110-134 (calculateVersionDiff DELETED+CREATED branch)
- concepts.invariants[7] identical-versions-400 ← DatasetVersionServiceImpl.java:59-61
- concepts.invariants[8] 500-on-missing-version-in-diff ← DatasetVersionServiceImpl.java:69-71 (generic RuntimeException) vs lines 41-43, 50-51 (NotFoundException elsewhere)
- concepts.invariants[9] no-live-doc-coverage ← WebFetch `https://docs.opendatadiscovery.org/developer-guides/api-reference` (status 200, 2026-05-20) + WebFetch `https://docs.opendatadiscovery.org/developer-guides/api-reference/relationships` (status 200, 2026-05-20) + WebFetch `https://docs.opendatadiscovery.org/features/data-discovery` (status 200, 2026-05-20)
- dependencies_semantic.coupling[0] DatasetVersionServiceImpl-id-confusion ← DatasetVersionServiceImpl.java:39-45, 55-64
- dependencies_semantic.coupling[1] ReactiveDatasetVersionRepositoryImpl-SQL-shapes ← ReactiveDatasetVersionRepositoryImpl.java:97-144, 146-157, 160-217
- dependencies_semantic.coupling[2] cross-link-ReactiveDatasetFieldRepositoryImpl-batch-R ← ReactiveDatasetFieldRepositoryImpl sidecar invariant 1-3 + bugs_limitations_corner_cases[1] (verbatim-storage write path) read by THIS controller
- dependencies_semantic.coupling[3] DatasetVersionHashCalculator ← DatasetVersionServiceImpl.java:218-225 (fieldsAreTheSameBetweenVersions)
- dependencies_semantic.coupling[4] SecurityConstants.SECURITY_RULES-absence ← SecurityConstants.java:98-355 (verified no matching rule for any of the four paths)
- tests_coverage_semantic.test_files ← (NO direct controller test verified via Grep `DatasetController` in `odd-platform-api/src/test/java/**` — 0 matches) + (NO service-tier test verified via Grep `DatasetVersionService|DatasetVersionServiceImpl` — 0 matches) + ReactiveDatasetVersionRepositoryImplTest.java:51-83 (2 tests on `getDatasetVersion` only)
- docs_link_semantic.inferred_docs[0] api-reference-hub ← WebFetch https://docs.opendatadiscovery.org/developer-guides/api-reference (status 200, 2026-05-20) — fetched_excerpt verbatim
- docs_link_semantic.inferred_docs[1] relationships-page-omits-dataset-variant ← WebFetch https://docs.opendatadiscovery.org/developer-guides/api-reference/relationships (status 200, 2026-05-20) — fetched_excerpt verbatim
- docs_link_semantic.inferred_docs[2] data-discovery-schema-diff-mention ← WebFetch https://docs.opendatadiscovery.org/features/data-discovery (status 200, 2026-05-20) — fetched_excerpt verbatim
- docs_link_semantic.doc_drift_findings[0..4] ← combination of three WebFetched live pages above + OpenAPI spec at openapi.yaml:1793-1878
- implicit_adrs[0] thin-proxy ← DatasetController.java:22-58
- implicit_adrs[1] no-SecurityRule-read-collaborative ← DatasetController.java:22-58 + SecurityConstants.java:98-355
- implicit_adrs[2] diff-encodes-versioning-by-reference ← DatasetVersionServiceImpl.java:156-180 + 110-147 + cross-link concept `dataset-field-versioning-by-reference-no-soft-delete-orphan-accumulation`
- implicit_adrs[3] identical-versions-400 ← DatasetVersionServiceImpl.java:59-61
- implicit_adrs[4] latest-scopes-by-dataset-id-others-do-not ← ReactiveDatasetVersionRepositoryImpl.java:160-217 vs 97-144, 146-157 (HEDGED — confidence MEDIUM)
- bugs_limitations_corner_cases[0] per-entity-bypass-by-version ← DatasetController.java:23-30 + DatasetVersionServiceImpl.java:39-45 + ReactiveDatasetVersionRepositoryImpl.java:97-144 (line 129)
- bugs_limitations_corner_cases[1] per-entity-bypass-diff ← DatasetController.java:43-50 + DatasetVersionServiceImpl.java:55-64 + ReactiveDatasetVersionRepositoryImpl.java:146-157 (line 154)
- bugs_limitations_corner_cases[2] 500-on-missing-version-diff ← DatasetVersionServiceImpl.java:69-71
- bugs_limitations_corner_cases[3] F-004-read-side ← DatasetController.java:22-41 + cross-link ReactiveDatasetFieldRepositoryImpl batch-R + ReactiveDatasetVersionRepositoryImpl.java:97-144 (no sanitisation on returned `internal_description`)
- bugs_limitations_corner_cases[4] no-live-doc-coverage ← 3 WebFetched pages (above)
- bugs_limitations_corner_cases[5] cross-owner-read-undocumented ← SecurityConstants.java:98-355 + WebFetch `https://docs.opendatadiscovery.org/features/data-discovery` + WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization`
- bugs_limitations_corner_cases[6] parent-cascade-amplification ← DatasetVersionServiceImpl.java:156-180 + 110-147
- security.auth_mode_relevance ← DatasetController.java:1-60 (no @ConditionalOnProperty) + SecurityConstants.java:98-355
- security.authorization_assertions ← SecurityConstants.java:98-355 (no matching rules)
- security.owner_scoping ← cross-link F-005 cross-owner enumeration + system-mission.md P-09 maintainer notes
- security.data_exposure ← DatasetController.java:22-58 (response types) + ReactiveDatasetVersionRepositoryImpl.java:97-217 (full column metadata in payload)
- security.known_security_gaps[0..4] ← combination of the per-entity bypass at by-version + diff + the read-collaborative posture + the F-004 read-side + the enumeration vector — all file:line-cited
- performance.hot_paths[0] getDatasetVersion-12-table-join ← ReactiveDatasetVersionRepositoryImpl.java:97-130
- performance.hot_paths[1] getLatestDatasetVersion-two-stage ← ReactiveDatasetVersionRepositoryImpl.java:160-217
- performance.hot_paths[2] getDatasetVersionDiff-in-memory-compute ← DatasetVersionServiceImpl.java:55-64 + 66-147 + ReactiveDatasetVersionRepositoryImpl.java:146-157
- performance.known_performance_gaps[0..2] ← above + no asMaterialized hint comparison vs ReactiveDatasetFieldRepositoryImpl.listByTerm line 191-192

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH (the gap is the dominant finding — ZERO direct controller tests, ZERO service-tier tests, observed via Grep)
- docs_link_semantic: HIGH (three doc pages WebFetched at status 200 with verbatim excerpts; the absence of `dataSet` tag documentation is positively confirmed by the API-reference hub page listing the 9 other tags)
- implicit_adrs: MEDIUM (entry [4] HEDGED — the asymmetry between latest-uses-dataEntityId vs by-version/diff-do-not could be either intent OR oversight; no comment in the file frames the intent; the maintainer should consider routing to bugs_limitations_corner_cases if read as oversight)
- bugs_limitations_corner_cases: HIGH (every claim is file:line-cited with reasoning anchor)
- security: HIGH (the two HIGH-severity per-entity-bypass findings are file:line-cited and grounded in the actual SQL queries; the read-collaborative posture is cross-linked to existing F-005 / P-09 substrate)
- performance: HIGH

## Maintainer notes

(none — first enrichment of this node)

## coherence_corrections

This sidecar is the FIRST enrichment of `DatasetController`; it adds NEW findings to F-005 and F-004 without superseding any prior claim.

**NEW findings this sidecar adds (NOT already in batch-R, batch-V, F-004, or F-005):**

1. **Per-entity-scoping bypass at `getDataSetStructureByVersionId`** — `data_entity_id` URL parameter is NOT enforced against the `version_id`. A caller passing any `data_entity_id` with a valid `version_id` for a different dataset receives the other dataset's structure. HIGH severity. New drift facet candidate for F-005: `dataset_structure_by_version_per_entity_scoping_bypass_data_entity_id_unused`.

2. **Per-entity-scoping bypass at `getDataSetStructureDiff`** — `data_entity_id` URL parameter is NOT enforced; two version_ids from two different datasets can be diffed. HIGH severity. New drift facet candidate for F-005: `dataset_structure_diff_per_entity_scoping_bypass_data_entity_id_unused`.

3. **500-on-missing-version-id at diff endpoint vs 404 at by-version/latest endpoints** — error contract inconsistency. MEDIUM severity. New drift facet candidate: `dataset_structure_diff_missing_version_id_returns_500_inconsistent_with_404_elsewhere`.

4. **`getDataSetStructure*` is the READ SIDE of F-004 batch-R column-level XSS-class** — operators consuming the structure response receive `internal_description` verbatim including user-supplied Markdown / HTML payloads. UI defence-in-depth is the operative safeguard; cross-tab coverage of the DatasetField description render path remains unverified. MEDIUM severity. Cross-link to F-004 batch-R, extends the existing class with a NAMED READ-PATH surface.

5. **API-reference hub does not document the `dataSet` tag** — 4 endpoints in spec, 0 in docs. The closest sub-page (relationships) explicitly omits the dataset-scoped variant. MEDIUM severity. New DOC-NNN candidate.

6. **Parent-field cascade DELETE+CREATE amplification in diff** — undocumented behaviour. Operators see amplified diff output for parent renames with no doc-side explanation. LOW severity.

7. **Asymmetric SQL shapes in ReactiveDatasetVersionRepositoryImpl** — `getLatestDatasetVersion` uses `DATA_ENTITY.ID.eq(datasetId)` correctly; `getDatasetVersion` and `getDatasetVersionWithFields` do not. Routed to `implicit_adrs[4]` at MEDIUM confidence with hedging — could equally be oversight (move to `bugs_limitations_corner_cases`) or intent (the dataset_version.id is a globally unique surrogate so the parent join is redundant for correctness). Maintainer triage required.

**CROSS-REFERENCE confirmations** (no contradictions introduced):

- F-005 cross-owner enumeration class (REFACTOR-203) extends to THIS controller's surface — the no-SecurityRule + global-auth-only gate matches the existing pattern at LineageServiceImpl / DataEntityRelationsServiceImpl. Adding this controller to F-005's contributing_nodes list is appropriate.
- F-004 batch-R verbatim-storage write path (`ReactiveDatasetFieldRepositoryImpl.updateDescription`) has a NAMED read counterpart at THIS controller's `getDataSetStructure*` endpoints. Adding this controller to F-004's contributing_nodes list is appropriate.
- The system-mission.md P-01 Data Discovery pillar's "Dataset schema diff" sub-feature anchors to this controller's `getDataSetStructureDiff` endpoint. No conflict with existing pillar mapping.
- Batch-V DatasetFieldController's SecurityConstants wiring bugs (lines 295-299) do NOT extend to this controller — there is no SecurityConstants entry to BE wrong here; the issue is the absence of any rule, not a misrouted permission.

**LSN-018 pre-emit coherence check** — re-read the system-mission.md pillar references AND the F-005 / F-004 detail YAMLs AND the batch-V DatasetFieldController + batch-R ReactiveDatasetFieldRepositoryImpl sidecars before emitting. No claim in this sidecar contradicts any prior claim; the per-entity-scoping bypass and the docs-gap are net-new findings.
