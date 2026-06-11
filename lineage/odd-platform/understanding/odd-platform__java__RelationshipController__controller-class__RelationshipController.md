---
node_id: "odd-platform java RelationshipController controller-class:RelationshipController"
node_kind: controller-class
axis: controllers
extracted_at_commit: 4ec2b20
enriched_at_commit: abe51417
extractor_version: 0.1.0
prompt_version: file-analyser/0.5.0
schema_version: v0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-06-12-01-RelationshipController-refresh
feature_hint: "F-037 / P-02 Data Modelling — ERD/graph relationship list + detail surface. Three endpoints (getRelationships / getERDRelationshipById / getGraphRelationshipById) on the /api/relationships top-level path. REFRESH of the 2026-05-25 sidecar: the downstream chain changed on branch contrib/CTRIB-006-relationships-hardening @ abe51417 (the odd-platform#1752 / PLT-056 fix, ships 0.28.0). Pairs with the dataset-scoped variant on DatasetController (getDataSetRelationships → GET /api/datasets/{data_entity_id}/relationships)."
related_features: ["F-037"]
related_pillar_features: ["P-02"]
---

# RelationshipController — semantic understanding

## understanding

A 44-line thin reactive delegate (`odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/RelationshipController.java:14-44`, unchanged at abe51417) that implements the OpenAPI-generated `RelationshipApi` and forwards THREE read operations — `getRelationships` (paged list with type filter + name search), `getERDRelationshipById`, `getGraphRelationshipById` — to `RelationshipsService` (line 17). It is the HTTP surface of `GET /api/relationships`, `GET /api/relationships/erd/{relationship_id}` and `GET /api/relationships/graph/{relationship_id}` (`odd-platform-specification/openapi.yaml:4140-4192`). **As of the #1752 fix (commit 122a0823) the list path applies the catalog's default visibility trio** — `HOLLOW = false`, `STATUS != DELETED(5)`, `EXCLUDE_FROM_SEARCH null/false` (`ReactiveDataEntityRelationshipRepositoryImpl.java:75-80`, mirroring `ReactiveDataEntityRepositoryImpl.getDataEntityDefaultConditions` at lines 970-976) — so soft-deleted / hollow / excluded relationship entities are no longer listed; the **detail-by-id endpoints apply no visibility predicate** and still serve such rows on direct id access. **The `relationship_id` path parameter is, by now-DOCUMENTED contract (commit abe51417, `components.yaml:4391-4402`), the relationship-class data entity's `data_entity.id`** — not the `relationships` table PK; the payload's `erd_relationship_id` / `graph_relationship_id` are internal detail-record ids that do not round-trip (404), as the spec now states and IT-077 green-locks. **No authorization gate exists at any layer** (unchanged, deliberate): no `@PreAuthorize`, no `SECURITY_RULES` matcher for `/api/relationships/**`, no owner/namespace/data-source scoping — the platform-wide read-collaborative posture, now stated on the live feature page.

## concepts

- entities: [
    "DataEntityRelationshipList (paged response — items + PageInfo — `RelationshipController.java:6` + `components.yaml` DataEntityRelationshipList)",
    "DataEntityRelationshipDetails (per-relationship payload, allOf DataEntityRelationship + ERDRelationshipDetails OR GraphRelationshipDetails — `RelationshipController.java:5`)",
    "ERDRelationshipDetails.erd_relationship_id / GraphRelationshipDetails.graph_relationship_id (internal detail-record ids; documented as NOT valid `relationship_id` values — `components.yaml:4138-4143, 4175-4180`; populated from `erd_relationship_details.id` at `ErdRelationshipMapper.java:21`)",
    "RelationshipsType (enum ERD / GRAPH / ALL — `RelationshipController.java:7`; required query param per `components.yaml:4404-4407`)",
    "RelationshipApi (OpenAPI-generated interface — `RelationshipController.java:4` import + `:16` implements clause)",
    "ServerWebExchange (accepted because the generated signature requires it; never read by the body — lines 24, 32, 40)",
    "RelationshipsService (DI dependency — line 17)",
    "implicit: DATA_RELATIONSHIP(9) data-entity-class — the class the list filters by (`ReactiveDataEntityRelationshipRepositoryImpl.java:73`)",
    "implicit: catalog default visibility trio — HOLLOW=false, STATUS != DELETED(5), EXCLUDE_FROM_SEARCH null/false (`ReactiveDataEntityRelationshipRepositoryImpl.java:78-80`; DELETED id=5 per `DataEntityStatusDto.java:16`)"
  ]
- operations: [
    "getRelationships(page, size, type, query, exchange) — `RelationshipController.java:19-27`: forwards to `relationshipsService.getRelationships(page, size, type, query)`. Repository (`ReactiveDataEntityRelationshipRepositoryImpl.java:57-139`) paginates `data_entity` rows WHERE entity_class_ids=[9] AND the visibility trio AND optional `external_name containsIgnoreCase(query)`, ORDER BY data_entity.id ASC, offset `(page-1)*size`; then JOINs relationships + source/target data_entity + data_source + 2× namespace. Type filter sits in the JOIN ON clause (`:107-109`; ALL → DSL.noCondition()). Returns DataEntityRelationshipList.",
    "getERDRelationshipById(relationshipId, exchange) — `RelationshipController.java:29-35`: service hardcodes `RelationshipsType.ERD` (`RelationshipsServiceImpl.java:38-42`); repository `getRelationshipByIdAndType` (`ReactiveRelationshipsRepositoryImpl.java:159-215`) JOINs relationships ON data_entity_id + relationship_type, WHERE `data_entity.id = relationshipId` (`:201`); empty → `NotFoundException(\"Relationship\", id)` → 404. NO visibility predicate on this path.",
    "getGraphRelationshipById(relationshipId, exchange) — `RelationshipController.java:37-43`: symmetric, hardcoded `RelationshipsType.GRAPH` (`RelationshipsServiceImpl.java:44-49`); same SQL site, same 404 shape."
  ]
- invariants: [
    "**Thin-delegate posture** (unchanged): every method body is `service.invoke(...).map(ResponseEntity::ok)` — no branching, no validation, no logging at the controller tier (`RelationshipController.java:19-43`).",
    "**List visibility = catalog default trio** (NEW at 122a0823): the list conditionList carries HOLLOW=false + STATUS != DELETED + EXCLUDE_FROM_SEARCH null/false, with an intent comment citing #1752 and the mirror source (`ReactiveDataEntityRelationshipRepositoryImpl.java:75-80`). The page-total count query shares the SAME conditionList (`:136-138`), so totals count only visible rows — pinned by `ReactiveDataEntityRelationshipRepositoryImplTest.java:58-60`.",
    "**Detail-by-id applies NO visibility predicate** (asymmetry): `getRelationshipByIdAndType` (`ReactiveRelationshipsRepositoryImpl.java:179-202`) has no HOLLOW/STATUS/EXCLUDE_FROM_SEARCH condition — a DELETED/hollow/excluded relationship hidden from the list still returns 200 on direct id access.",
    "**`relationship_id` = relationship-class data entity id, by documented contract** (abe51417): `components.yaml:4391-4398` — 'Id of the relationship-class data entity, i.e. the `id` field of `DataEntityRelationship` / `DataEntityRelationshipDetails` items. The `erd_relationship_id` and `graph_relationship_id` fields ... are internal detail-record ids and are NOT valid values for this parameter.' SQL: `data_entity.id` bind at `ReactiveRelationshipsRepositoryImpl.java:201`; list/detail payload `id` = data_entity.id (`RelationshipMapper.java:53, 67`). Round-trip green-locked by IT-077 step 6 (id resolves detail; erd_relationship_id fed back → 404 USR002).",
    "**No authorization gate at any layer** (unchanged, deliberate per CTRIB-006 scope): no `@PreAuthorize` (`RelationshipController.java:1-44`); zero case-insensitive 'relationship' matches in `auth/util/SecurityConstants.java` (grep scope: that file — the sole definer of SECURITY_RULES — plus its only consumer `AuthorizationCustomizer.java` read end-to-end); no service/repository permission check. Only the catch-all `.pathMatchers(\"/**\").authenticated()` (`AuthorizationCustomizer.java:29-30`) gates non-DISABLED modes.",
    "**Pagination is 1-indexed by arithmetic convention**: `(page - 1) * size` at `ReactiveDataEntityRelationshipRepositoryImpl.java:87`; PageParam/SizeParam declare no minimum/maximum (`components.yaml:4219-4235`). page=0 → negative OFFSET (P-130 pins the observable result).",
    "**Search scope = relationship-row external_name only** (`ReactiveDataEntityRelationshipRepositoryImpl.java:69-71`) — NOT source/target dataset names; now documented on the live feature page ('The search input filters by relationship name only — not by source or target entity name').",
    "**Invalid `type` → enum-bind 400 at the backend; the UI sanitizes since #1752**: `parseRelationshipsType.ts:3-9` degrades unknown `?type=` deep-link values to ALL, its comment naming the backend behaviour ('propagating to the API as an enum-bind 400 that renders like an empty catalog'). `type` is required:true (`components.yaml:4404-4407`).",
    "**Multi-row detail match resolves to silent first row**: `relationships.data_entity_id` has no UNIQUE constraint (V0_0_87__create_relation_tables.sql); on a multi-row match, `jooqReactiveOperations.mono(query)` is `Mono.from(publisher)` (`JooqReactiveOperations.java:37-42`), which emits the first record and cancels — no error, row choice database-plan-dependent (no ORDER BY on the detail query).",
    "**Service-layer dispatch hardcodes the type per endpoint** (unchanged): ERD vs GRAPH are URL-level distinctions; `RelationshipsType.ALL` is reachable only via the list `type` param (`RelationshipsServiceImpl.java:38-49`)."
  ]
- audiences: [
    "End-users browsing Data Modelling → Relationships (`/data-modelling/relationships`) — `Relationships.tsx:20-24` infinite-scrolls getRelationships at size 30 with the `?type=` value sanitized through `parseRelationshipsType` (line 19).",
    "End-users opening a relationship-class entity's overview — the list row links to `dataEntityDetailsPath(item.id)` (`RelationshipsListItem.tsx:52`); the overview stats fire `useGetEDRRelationshipById(dataEntityDetails.id)` / `useGetGraphRelationshipById(dataEntityDetails.id)` (`OverviewEntityRelationship.tsx:18`, `OverviewGraphRelationship.tsx:14`).",
    "Direct API consumers — any authenticated caller (or any X-API-Key holder where S2S grants ADMIN globally); the spec now tells them the id contract (`components.yaml:4391-4402`).",
    "Anyone under `auth.type=DISABLED` — endpoints reachable unauthenticated (LSN-001-shape posture; documented on the live feature page as the no-RBAC caveat).",
    "The IT-077 e2e rail (`integration-tests/e2e/specs/erd-graph-relationships.spec.ts` in odd-team) — a test-class entry point driving all three endpoints."
  ]

## dependencies_semantic

- requires-feature: [
    "F-037 / P-02 Data Modelling — Relationships: this controller IS the feature's global HTTP boundary; the dataset-scoped sibling (`getRelationsByDatasetIdAndType`, now with STATUS+HOLLOW-only visibility, `ReactiveRelationshipsRepositoryImpl.java:135-144`) is exposed via DatasetController and is NOT this node's surface.",
    "OpenAPI-generated `RelationshipApi` (`RelationshipController.java:4, :16`); contract at `odd-platform-specification/openapi.yaml:4140-4192` + `components.yaml` (RelationshipIdParam 4391-4402; PageParam 4219-4226; SizeParam 4228-4235; RelationshipTypeParam 4404-4407).",
    "Spring WebFlux reactive stack + Lombok `@RequiredArgsConstructor` (lines 9-15).",
    "`RelationshipsService` → `RelationshipsServiceImpl` (list → `ReactiveDataEntityRelationshipRepository.getRelationships`; detail → `ReactiveRelationshipsRepository.getRelationshipByIdAndType`).",
    "`RelationshipMapper` (+ `ErdRelationshipMapper`, `GraphRelationshipMapper`, `DataSourceSafeMapper`, `DataEntityMapper`) — payload `id` = data_entity.id (`RelationshipMapper.java:53, 67`); `erd_relationship_id` = erd_relationship_details.id (`ErdRelationshipMapper.java:21`).",
    "Adjacent, not on this path: `ReactiveRelationshipsRepository.getRelationshipByDataEntityIds` (`ReactiveRelationshipsRepositoryImpl.java:76-84`) has no callers — drafted upstream issue `issues/odd-platform/PLT-219.md`."
  ]
- requires-config: [
    "No `@Value` reads at the controller. Indirect: `auth.type` decides whether the catch-all `.authenticated()` fires (`AuthorizationCustomizer.java:29-30`); `auth.s2s.enabled` admits ADMIN-granting X-API-Key callers (REFACTOR-108 cross-ref)."
  ]
- requires-runtime: [
    "PostgreSQL with `relationships` + `erd_relationship_details` + `graph_relationship` tables (V0_0_87) and `data_entity.status/hollow/exclude_from_search` columns the trio reads.",
    "Reactor + JOOQ + `JooqQueryHelper.paginate/pageifyResult` (paged envelope; count fallback shares the conditionList — `ReactiveDataEntityRelationshipRepositoryImpl.java:123-138`).",
    "`JooqReactiveOperations.mono` = `Mono.from` first-row semantics on the detail query (`JooqReactiveOperations.java:37-42`)."
  ]

## tests_coverage_semantic

- covered_behaviours:
  - behaviour: "GET /api/relationships hides soft-DELETED, exclude_from_search and hollow relationship entities AND the page total counts only visible rows (the #1752 Defect 2 fix). Failing-first Testcontainers test over the real repository."
    test_class: integration
    test_files: ["odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/reactive/ReactiveDataEntityRelationshipRepositoryImplTest.java:44-72 (@validates F-037, @regresses PLT-056)"]
  - behaviour: "type=ERD and name-query filters keep working on the visibility-filtered listing; the DTO carries DISTINCT source and target datasets."
    test_class: integration
    test_files: ["ReactiveDataEntityRelationshipRepositoryImplTest.java:61-69, 74-95"]
  - behaviour: "Dataset-tab sibling (DatasetController surface, same service): deleted/hollow hidden, exclude_from_search KEPT — both halves of the deliberate scoping pinned. Recorded here because it pins the exclude_from_search-is-a-discovery-flag decision that also explains this controller's list behaviour."
    test_class: integration
    test_files: ["odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/reactive/ReactiveRelationshipsRepositoryImplTest.java:41-79"]
  - behaviour: "E2E (UI→API→DB): 5-column render; Source ×1 / Target ×1 (D1 fix); DELETED+excluded rows absent with total counting visible rows (D2); `?type=foo` deep-link degrades to ALL with the All tab active and a 200 (D4); graph overview labels Source/Target correctly; id-contract green-locks (list `id` resolves the erd detail; `erd_relationship_id` fed back → 404 USR002) (D5). Run log 2026-06-12: RED proof vs `ODD_SUT=ref:main` + GREEN on the working-tree SUT."
    test_class: integration
    test_files: ["integration-tests/protocols/IT-077-erd-graph-relationships.md (status: ready)", "integration-tests/e2e/specs/erd-graph-relationships.spec.ts"]
- uncovered_behaviours:
  - behaviour: "GET /api/relationships?page=0 boundary — negative OFFSET; observable status (500 vs 400) unpinned. Same for page=null / size=0 / size=Integer.MAX_VALUE."
    test_class: integration
    criticality: MEDIUM
    note: "P-130 pending-stress-protocol."
  - behaviour: "Auth-mode matrix: 200-to-anonymous under DISABLED; 200 to any authenticated caller under LOGIN_FORM/OAUTH2/LDAP; no owner/cross-data-source narrowing anywhere."
    test_class: security
    criticality: HIGH
    note: "P-131 pending-stress-protocol; zero automated security coverage on this surface."
  - behaviour: "Cross-type negative: GET /api/relationships/erd/{id} on a GRAPH-type row → 404 (type bind in the JOIN ON at ReactiveRelationshipsRepositoryImpl.java:184-185)."
    test_class: integration
    criticality: MEDIUM
  - behaviour: "Detail-by-id of a DELETED/excluded/hollow relationship returns 200 (no visibility predicate on getRelationshipByIdAndType) — the list/detail asymmetry is unpinned in either direction."
    test_class: integration
    criticality: MEDIUM
  - behaviour: "Multi-row data_entity_id match → silent first row via Mono.from (no UNIQUE constraint; row choice plan-dependent)."
    test_class: integration
    criticality: LOW
    note: "Statically derived (JooqReactiveOperations.java:37-42); a runtime pin would need a two-row seed."
  - behaviour: "Mapper defaults any non-'ERD' relationship_type value (null/lowercase/corrupt) to GRAPH_RELATIONSHIP (RelationshipMapper.java:60-62, 74-76)."
    test_class: integration
    criticality: LOW
- test_files: ["ReactiveDataEntityRelationshipRepositoryImplTest.java", "ReactiveRelationshipsRepositoryImplTest.java", "integration-tests/e2e/specs/erd-graph-relationships.spec.ts (odd-team)"]
- gaps: |
    The 2026-05-25 zero-coverage state is closed for the #1752 defect cluster:
    the visibility fix is pinned failing-first at the repository tier (both
    listings) and end-to-end by the re-grounded IT-077, which also green-locks
    the documented id contract. The worst remaining bucket is SECURITY — still
    zero automated tests across the four auth modes for a surface that is
    deliberately catalog-global (P-131 pending). Next-worst: the page=0/size
    boundaries (P-130 pending) and the detail-by-id visibility asymmetry,
    which no test asserts in either direction.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/data-modelling/relationships"
    anchor: ""
    rationale: "The feature page for the Relationships surface; documents the list columns, ERD/GRAPH classes, search scope, id contract and the no-RBAC caveat. Matches `documentation/docs/data-modelling/relationships.md`."
    last_verified_at: "2026-06-12T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      "page size is 30 by default" — matches Relationships.tsx:23.
      "The search input filters by relationship name only — not by source or
      target entity name." — matches ReactiveDataEntityRelationshipRepositoryImpl.java:69-71.
      The `relationship_id` parameter represents "the relationship's data-entity
      id, not the `relationships` table primary key." — matches the abe51417 spec
      contract + ReactiveRelationshipsRepositoryImpl.java:201.
      "There is no RBAC gate on the Relationships endpoints — any authenticated
      caller can list every relationship in the catalog." — matches the unchanged
      auth posture.
      Known Caveats (live page, describing 0.27.x): "The Target column displays
      the source entity on list pages (data-binding error)"; "The `?type=`
      parameter accepts invalid values and silently renders blank results"; the
      repository "does not filter by owner, namespace, or `exclude_from_search`".
  - url: "https://docs.opendatadiscovery.org/developer-guides/api-reference/relationships"
    anchor: ""
    rationale: "API-reference page tabulating the three endpoints this controller serves."
    last_verified_at: "2026-06-12T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      "The `{relationship_id}` path parameter is the relationships-class data
      entity id, not the row id of the relationship itself" — matches the code +
      spec.
      "The list endpoint is a full enumeration of the relationship class — it
      does not apply the catalog-visibility rules" — TRUE for the published
      0.27.x release; STALE versus HEAD (see drift findings).
  - pending_release: "0.28.0"
    train_ref: "release/0.28.0 @ f61b9c2 docs/data-modelling/relationships.md + docs/developer-guides/api-reference/relationships.md"
    rationale: "DOC-446 (review-ready, milestone 0.28.0) re-words both pages on the documentation train: Target-column + ?type= caveats become fixed-in-0.28.0 notes; visibility defaults stated positively incl. the dataset-tab exclude_from_search nuance; the erd_relationship_id/graph_relationship_id round-trip trap added; the API-reference visibility hint re-worded to 'applies as of 0.28.0'. Live WebFetch deliberately not used for these — GitBook publishes the released train only."
    confidence: HIGH
- doc_drift_findings:
  - "EXPECTED-STALE (release-train, tracked): the live feature page's Known Caveats still describe the pre-fix 0.27.x behaviour (Target column data-binding error; `?type=` silent blank results; list 'does not filter by ... exclude_from_search') while HEAD (abe51417, ships 0.28.0) fixes all three. NOT a doc bug: the live manual describes the latest published release; `backlog/docs/DOC-446.md` (review-ready) rides the 0.28.0 train and flips these at the release gate. No action for this sidecar beyond recording the status."
  - "RESOLVED since the 2026-05-25 sidecar: the id-contract drift finding (parameter documented nowhere) is closed — the OpenAPI spec (`components.yaml:4391-4402` + the `*_relationship_id` field descriptions at 4138-4143/4175-4180, commit abe51417) AND both live pages now state the contract; IT-077 step 6 verifies it end-to-end."
  - "RESOLVED since the 2026-05-25 sidecar: the undocumented EXCLUDE_FROM_SEARCH asymmetry between /api/dataentities and /api/relationships is closed in code (the trio now applies to the relationships list) and the remaining deliberate nuance (dataset tab keeps excluded rows) is documented on the 0.28.0 train per DOC-446."
  - "Still-open minor: neither live page documents the page>=1 convention (page=0 yields an error, not an empty first page) — PageParam carries no minimum in the spec (`components.yaml:4219-4226`). Surfaces with P-130."

## implicit_adrs

- "**Relationship listings apply the catalog's default visibility predicates; exclude_from_search scopes DISCOVERY surfaces only.** The list mirrors `getDataEntityDefaultConditions` verbatim (trio at `ReactiveDataEntityRelationshipRepositoryImpl.java:78-80`); the dataset-tab sibling applies STATUS+HOLLOW but deliberately NOT exclude_from_search. Both decisions carry in-code rationale." — evidence: ReactiveDataEntityRelationshipRepositoryImpl.java:75-80 + ReactiveRelationshipsRepositoryImpl.java:138-143 + ReactiveDataEntityRepositoryImpl.java:970-976 — intent_anchor: "'the catalog's default visibility predicates (mirrors getDataEntityDefaultConditions): soft-DELETED, hollow and exclude_from_search relationship entities are hidden from the listing, exactly as the data-entity list/search tier hides them (#1752)' and 'DELIBERATELY NOT exclude_from_search: that flag scopes discovery surfaces ... hiding a dataset's real relationship from its own contextual detail tab would be silent incompleteness (#1752)'" — confidence: HIGH
- "**`relationship_id` is the relationship-class data entity id — keep the behaviour, document the contract.** #1752 Defect 5 was resolved by spec documentation (abe51417), not by re-keying the endpoints to relationships.id: the param description names the contract and explicitly bans the payload's internal detail-record ids." — evidence: components.yaml:4391-4402 + components.yaml:4138-4143 + components.yaml:4175-4180 + ReactiveRelationshipsRepositoryImpl.java:201 — intent_anchor: "'Id of the relationship-class data entity, i.e. the `id` field of `DataEntityRelationship` / `DataEntityRelationshipDetails` items. The `erd_relationship_id` and `graph_relationship_id` fields exposed in the details payload are internal detail-record ids and are NOT valid values for this parameter.'" — confidence: HIGH
- "**The relationships surface is a CATALOG-GLOBAL read-collaborative surface** — the #1752 hardening fixed visibility but deliberately did NOT add owner/namespace/data-source scoping, and the live docs state the posture ('no RBAC gate ... any authenticated caller can list every relationship'). DOC-446's editorial note downgrades the caveat danger→warning as 'the documented platform-wide read-collaborative posture'." — evidence: ReactiveDataEntityRelationshipRepositoryImpl.java:67-80 (conditionList has no OWNERSHIP/namespace/data-source clause) + live feature page (WebFetched 2026-06-12, 200) + backlog/docs/DOC-446.md:52-54 — intent_anchor: "live-page caveat text + DOC-446 'the remaining content is the documented platform-wide read-collaborative posture'" — confidence: HIGH
- "**Malformed `?type=` deep-links are sanitized at the UI boundary, not the backend**: the fix point for #1752 Defect 4 is `parseRelationshipsType` falling back to ALL ('the tab strip's own default') rather than loosening the backend enum bind — the API keeps rejecting invalid enums with 400." — evidence: parseRelationshipsType.ts:3-9 + Relationships.tsx:19 — intent_anchor: "'an unknown value must degrade to the ALL view (the tab strip's own default) instead of propagating to the API as an enum-bind 400 that renders like an empty catalog (#1752)'" — confidence: HIGH
- "**Pagination is 1-indexed by arithmetic convention** (unchanged): `(page - 1) * size` with no guard, platform-wide via JooqQueryHelper.paginate; the UI always starts at `initialPageParam: 1` (`relatioships.ts:38`)." — evidence: ReactiveDataEntityRelationshipRepositoryImpl.java:87 — intent_anchor: "the `(page - 1) * size` literal arithmetic, uniform across paginated endpoints" — confidence: MEDIUM
- "**ERD vs GRAPH are URL-level API distinctions** (unchanged): two path entries + per-method hardcoded type; ALL reachable only via the list filter." — evidence: RelationshipsServiceImpl.java:38-49 + openapi.yaml:4160-4192 — intent_anchor: "the API surface splits at the URL level; the service hardcodes the type per method" — confidence: HIGH

## bugs_limitations_corner_cases

- "**No authorization gate at any layer — deliberate, now documented, still unprobed at runtime**: no `@PreAuthorize`; zero 'relationship' matches in `auth/util/SecurityConstants.java` (the SECURITY_RULES definer; consumer `AuthorizationCustomizer.java` read end-to-end); no service/repository check; catch-all `.authenticated()` only (non-DISABLED). Cross-data-source + cross-namespace visibility unrestricted; under DISABLED, unauthenticated. The live feature page states the posture; P-131 pins the runtime matrix." — evidence: RelationshipController.java:1-44 + AuthorizationCustomizer.java:29-30 + live feature page (2026-06-12, 200) — severity: MEDIUM (documented deliberate posture; was HIGH when undocumented)
- "**Page-zero boundary still unguarded**: `(page - 1) * size` at ReactiveDataEntityRelationshipRepositoryImpl.java:87; PageParam has no `minimum` (`components.yaml:4219-4226`); a 0-indexed caller gets an opaque error, not a first page. Unchanged by #1752. P-130 pins the observable status." — evidence: ReactiveDataEntityRelationshipRepositoryImpl.java:87 + components.yaml:4219-4226 — severity: MEDIUM
- "**Detail-by-id serves rows the list hides**: `getRelationshipByIdAndType` applies no visibility predicate (`ReactiveRelationshipsRepositoryImpl.java:179-202`), so a DELETED/excluded/hollow relationship entity returns 200 with full payload on direct id access while being absent from `GET /api/relationships`. No comment defends the asymmetry on this method (the #1752 fix scoped visibility to the two LISTING queries only); whether direct-id access to soft-deleted rows is intended is undecided in code." — evidence: ReactiveRelationshipsRepositoryImpl.java:179-202 (no trio) vs ReactiveDataEntityRelationshipRepositoryImpl.java:78-80 (trio) — severity: LOW
- "**`relationship_id` id-translation is now a documented trap rather than a silent one**: the param consumes data_entity.id (`ReactiveRelationshipsRepositoryImpl.java:201`); payload `erd_relationship_id`/`graph_relationship_id` do NOT round-trip (404). Documented in the spec (abe51417) + both live pages; green-locked by IT-077 step 6. Residual risk: a consumer who skips the description and feeds the payload's detail-record id still gets a plausible-looking 404 (or, on bigserial collision, an unrelated 200)." — evidence: components.yaml:4391-4402 + ReactiveRelationshipsRepositoryImpl.java:201 + ErdRelationshipMapper.java:21 + IT-077 result log 2026-06-12 — severity: LOW (was HIGH pre-documentation)
- "**No UNIQUE on `relationships.data_entity_id` → silent first-row on multi-match**: `mono()` = `Mono.from` (first record, cancel) at `JooqReactiveOperations.java:37-42`; the detail query has no ORDER BY, so which row wins is plan-dependent. Admissible-but-unproduced data shape (no current collector emits two rows per entity)." — evidence: ReactiveRelationshipsRepositoryImpl.java:204 + JooqReactiveOperations.java:37-42 — severity: LOW
- "**Mapper defaults unknown relationship_type to GRAPH_RELATIONSHIP**: any value not exactly 'ERD' (null, 'erd', corruption) maps to GRAPH_RELATIONSHIP (`RelationshipMapper.java:60-62, 74-76`); `relationship_type` is unconstrained varchar." — evidence: RelationshipMapper.java:60-62 — severity: LOW
- "**Spec defect on the graph detail payload (adjacent)**: `GraphRelationshipAttributes` requires a 'field' property that does not exist (properties are name/value) — drafted as `issues/odd-platform/PLT-218.md`; affects generated-client validation of getGraphRelationshipById responses." — evidence: issues/odd-platform/PLT-218.md (draft) — severity: LOW
- "**Uncapped `size`**: SizeParam has no `maximum` (`components.yaml:4228-4235`); a direct caller can pull the entire relationship catalog in one page." — evidence: components.yaml:4228-4235 + ReactiveDataEntityRelationshipRepositoryImpl.java:87 — severity: LOW
- "**Status-code clean bill**: openapi.yaml declares 200 for all three endpoints; controller returns ResponseEntity::ok on all three; 404 via NotFoundException ControllerAdvice. No drift." — evidence: openapi.yaml:4150-4192 + RelationshipController.java:26, 34, 42 — severity: N/A (explicit clean-bill-of-health)

## stress_findings

```yaml
stress_findings:
  tunables:
    - location: "ReactiveDataEntityRelationshipRepositoryImpl.java:87"
      name: "(page - 1) * size — offset arithmetic"
      value: "no Math.max guard; PageParam/SizeParam carry no minimum/maximum (components.yaml:4219-4235)"
      questions:
        - q: "What at page=0?"
          a: "offset = -size; Postgres rejects negative OFFSET. Observable status (500 vs 400) unpinned."
          confidence: PROBE-NEEDED
          evidence: "P-130 (pending-stress-protocol)"
        - q: "What at page=null?"
          a: "NPE at unboxing in the arithmetic; param is required:true but reactive binding behaviour on absence unpinned."
          confidence: PROBE-NEEDED
          evidence: "P-130"
        - q: "What at size=0?"
          a: "LIMIT 0 → items=[]; count query still runs. Expected 200 with total=N."
          confidence: PROBE-NEEDED
          evidence: "P-130"
        - q: "What at size=Integer.MAX_VALUE?"
          a: "Postgres accepts LIMIT 2147483647 — whole-catalog pull admissible (no cap)."
          confidence: PROBE-NEEDED
          evidence: "P-130"
        - q: "What does the operator see at each boundary?"
          a: "page=0 → opaque error rather than a graceful first page (JS 0-indexed callers hit it)."
          confidence: PROBE-NEEDED
          evidence: "P-130"
    - location: "odd-platform-ui/src/components/DataModelling/Relationships.tsx:23"
      name: "size: 30 — UI page size"
      value: "30"
      questions:
        - q: "Does the value match the docs?"
          a: "Yes — live feature page says 'page size is 30 by default' (WebFetched 2026-06-12, 200)."
          confidence: STATIC-INFERRED
          evidence: "Relationships.tsx:23 + live feature page excerpt"
        - q: "Is it configurable at runtime?"
          a: "No — hardcoded literal at the useSearchRelationships call site (developer edit + rebuild to change)."
          confidence: STATIC-INFERRED
          evidence: "Relationships.tsx:20-24 + relatioships.ts:20-41"
  name_behavior_pairs:
    - name: "getRelationships"
      promise: "Paginated list of the catalog's VISIBLE relationships matching type filter and name query."
      implementation: "data_entity WHERE entity_class_ids=[9] AND HOLLOW=false AND STATUS!=DELETED(5) AND EXCLUDE_FROM_SEARCH null/false AND optional external_name match; paginate ORDER BY data_entity.id ASC; JOIN relationships (type bind in ON) + source/target/data_source/namespaces. Count shares the conditionList."
      drift: NONE
      operator_visible_consequence: ""
      confidence: STATIC-INFERRED
      evidence: "ReactiveDataEntityRelationshipRepositoryImpl.java:57-139 + ReactiveDataEntityRelationshipRepositoryImplTest.java:44-95"
    - name: "getERDRelationshipById"
      promise: "Get an ERD relationship by 'id' — where 'id' is, per the documented contract, the relationship-class data entity id."
      implementation: "WHERE data_entity.id = relationshipId AND relationship_type='ERD' (join bind); 404 on miss. Contract documented at components.yaml:4391-4402 (abe51417)."
      drift: MINOR
      operator_visible_consequence: "Face-value readers of the NAME alone can still feed relationships.id or erd_relationship_id and get 404 — but the spec description now warns them; IT-077 green-locks both directions."
      confidence: PROBE-VERIFIED
      evidence: "IT-077 step 6 + result log 2026-06-12 (RED vs ref:main, GREEN on working tree) + ReactiveRelationshipsRepositoryImpl.java:184-185, 201"
    - name: "getGraphRelationshipById"
      promise: "Symmetric to ERD."
      implementation: "Same SQL site with relationship_type='GRAPH'."
      drift: MINOR
      operator_visible_consequence: "Same as ERD path."
      confidence: PROBE-VERIFIED
      evidence: "IT-077 + ReactiveRelationshipsRepositoryImpl.java:159-215"
  orderings:
    - location: "ReactiveDataEntityRelationshipRepositoryImpl.java:85-87"
      questions:
        - q: "What is the actual ORDER BY at the lowest layer?"
          a: "jooqQueryHelper.paginate builds ORDER BY data_entity.id ASC inside the CTE; the outer 6-table JOIN select adds no ORDER BY of its own."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataEntityRelationshipRepositoryImpl.java:85-87, 99-121"
        - q: "Tie-breaker on equal sort keys?"
          a: "None needed — data_entity.id is the PK (unique). Fully deterministic."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataEntityRelationshipRepositoryImpl.java:87"
        - q: "Which subset when result-set > page size?"
          a: "The (page-1)*size..page*size slice in id ASC order — oldest-first; newly-ingested relationships append at the END of the infinite scroll."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataEntityRelationshipRepositoryImpl.java:87"
        - q: "Does any upstream layer re-sort or filter?"
          a: "No — mapper iterates in order; InfiniteScroll appends pages in arrival order. The UI DOES narrow the type param (parseRelationshipsType) before the request, never after."
          confidence: STATIC-INFERRED
          evidence: "RelationshipMapper.java:39-49 + Relationships.tsx:63-77 + Relationships.tsx:19"
  auth_gates:
    - location: "RelationshipController.java:14-44 (entire file)"
      endpoint: "GET /api/relationships + /api/relationships/erd/{relationship_id} + /api/relationships/graph/{relationship_id}"
      questions:
        - q: "What does each endpoint return per auth mode (DISABLED / LOGIN_FORM / OAUTH2 / LDAP)?"
          a: "DISABLED: 200 to anonymous. LOGIN_FORM/OAUTH2/LDAP: 200 to ANY authenticated caller — no SECURITY_RULES narrowing. Unchanged by #1752 (deliberately out of fix scope). P-131 pins at runtime."
          confidence: STATIC-INFERRED
          evidence: "AuthorizationCustomizer.java:20-31 + grep -i relationship auth/util/SecurityConstants.java → zero matches"
        - q: "Unauthenticated caller?"
          a: "DISABLED: full payload. Other modes: 401/redirect from the catch-all .authenticated()."
          confidence: STATIC-INFERRED
          evidence: "AuthorizationCustomizer.java:29-30"
        - q: "Wrong-role caller?"
          a: "200 — no role/permission gate exists for these paths."
          confidence: STATIC-INFERRED
          evidence: "auth/util/SecurityConstants.java (no matcher) + RelationshipController.java:1-44 (no @PreAuthorize)"
        - q: "Where does the gate live?"
          a: "Only the catch-all .pathMatchers(\"/**\").authenticated() under non-DISABLED; nowhere under DISABLED."
          confidence: STATIC-INFERRED
          evidence: "AuthorizationCustomizer.java:29-30"
  resource_boundaries:
    - location: "ReactiveDataEntityRelationshipRepositoryImpl.java:99-138 + ReactiveRelationshipsRepositoryImpl.java:179-215"
      kind: concurrency
      questions:
        - q: "Can two simultaneous calls corrupt state?"
          a: "No — pure SELECTs end-to-end; no write on any of the three paths."
          confidence: STATIC-INFERRED
          evidence: "RelationshipController.java:19-43 + both repository methods (SELECT only)"
        - q: "Replay-safe?"
          a: "Yes — pure GETs, no side effects."
          confidence: STATIC-INFERRED
          evidence: "RelationshipController.java:19-43"
        - q: "Cache TTL / staleness?"
          a: "No backend cache (@Cacheable absent across controller/service/repositories). Client-side react-query caches per queryKey only."
          confidence: STATIC-INFERRED
          evidence: "RelationshipController.java:1-44 + RelationshipsServiceImpl.java:1-50 + relatioships.ts:6-41"
    - location: "ReactiveRelationshipsRepositoryImpl.java:204"
      kind: concurrency
      questions:
        - q: "What happens when the detail query matches MULTIPLE rows (no UNIQUE on relationships.data_entity_id)?"
          a: "jooqReactiveOperations.mono = Mono.from(publisher): first record emitted, subscription cancelled — silent first-row, no error; winner is plan-dependent (no ORDER BY). Resolved statically this refresh (was PROBE-NEEDED in the 2026-05-25 sidecar)."
          confidence: STATIC-INFERRED
          evidence: "JooqReactiveOperations.java:37-42 + ReactiveRelationshipsRepositoryImpl.java:179-202"
  request_inputs:
    - location: "RelationshipController.java:20"
      input_kind: query-param
      input_name: "page"
      questions:
        - q: "Name promise?"
          a: "Page number of the paginated list (1-indexed by platform convention; UI initialPageParam: 1)."
          confidence: STATIC-INFERRED
          evidence: "relatioships.ts:38 + components.yaml:4219-4226"
        - q: "Actual use?"
          a: "controller → RelationshipsServiceImpl.java:33 → offset (page-1)*size at ReactiveDataEntityRelationshipRepositoryImpl.java:87."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataEntityRelationshipRepositoryImpl.java:87"
        - q: "MATCH?"
          a: "MATCHES (generic name; 1-indexed convention unstated in the spec — boundary gap, not name drift)."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataEntityRelationshipRepositoryImpl.java:87"
        - q: "TRANSLATES_SILENTLY consequence?"
          a: "N/A."
          confidence: STATIC-INFERRED
          evidence: "N/A"
        - q: "Available-but-unused column?"
          a: "NONE."
          confidence: STATIC-INFERRED
          evidence: "N/A"
      routes_to_finding: "bugs_limitations_corner_cases.[1] (page-zero boundary, P-130)"
    - location: "RelationshipController.java:21"
      input_kind: query-param
      input_name: "size"
      questions:
        - q: "Name promise?"
          a: "Items per page."
          confidence: STATIC-INFERRED
          evidence: "components.yaml:4228-4235"
        - q: "Actual use?"
          a: "LIMIT bind via paginate at ReactiveDataEntityRelationshipRepositoryImpl.java:87."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataEntityRelationshipRepositoryImpl.java:87"
        - q: "MATCH?"
          a: "MATCHES; no maximum declared (uncapped pull)."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "components.yaml:4228-4235"
        - q: "TRANSLATES_SILENTLY consequence?"
          a: "N/A."
          confidence: STATIC-INFERRED
          evidence: "N/A"
        - q: "Available-but-unused column?"
          a: "NONE."
          confidence: STATIC-INFERRED
          evidence: "N/A"
      routes_to_finding: "bugs_limitations_corner_cases.[7] (uncapped size)"
    - location: "RelationshipController.java:22"
      input_kind: query-param
      input_name: "type"
      questions:
        - q: "Name promise?"
          a: "Filter by relationship type — ERD / GRAPH / ALL (required param)."
          confidence: STATIC-INFERRED
          evidence: "components.yaml:4404-4407"
        - q: "Actual use?"
          a: "JOIN ON bind: relationships.relationship_type = type.getValue(); ALL → DSL.noCondition() (ReactiveDataEntityRelationshipRepositoryImpl.java:107-109). Invalid raw values never reach the SQL: the enum bind 400s at the WebFlux boundary; since #1752 the UI sanitizes deep-link values to ALL before sending (parseRelationshipsType.ts:3-9; IT-077 D4 verifies the UI path)."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataEntityRelationshipRepositoryImpl.java:107-109 + parseRelationshipsType.ts:3-9"
        - q: "MATCH?"
          a: "MATCHES — the param filters by the relationship row's type column."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataEntityRelationshipRepositoryImpl.java:107-109"
        - q: "TRANSLATES_SILENTLY consequence?"
          a: "N/A."
          confidence: STATIC-INFERRED
          evidence: "N/A"
        - q: "Available-but-unused column?"
          a: "NONE."
          confidence: STATIC-INFERRED
          evidence: "N/A"
      routes_to_finding: "implicit_adrs.[3] (UI-boundary sanitization decision)"
    - location: "RelationshipController.java:23"
      input_kind: query-param
      input_name: "query"
      questions:
        - q: "Name promise?"
          a: "Free-text list filter; UI placeholder 'Search relationships'."
          confidence: STATIC-INFERRED
          evidence: "RelationshipsSearchInput.tsx (placeholder) + openapi.yaml:4148"
        - q: "Actual use?"
          a: "DATA_ENTITY.EXTERNAL_NAME containsIgnoreCase on the RELATIONSHIP-class entity row (ReactiveDataEntityRelationshipRepositoryImpl.java:69-71) — not on source/target dataset names."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataEntityRelationshipRepositoryImpl.java:69-71"
        - q: "MATCH?"
          a: "MATCHES — and the scope is now DOCUMENTED on the live feature page ('filters by relationship name only — not by source or target entity name')."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataEntityRelationshipRepositoryImpl.java:69-71 + live feature page excerpt (2026-06-12)"
        - q: "TRANSLATES_SILENTLY consequence?"
          a: "N/A — UI label, SQL semantic and live docs aligned."
          confidence: STATIC-INFERRED
          evidence: "N/A"
        - q: "Available-but-unused column?"
          a: "source/target data_entity.external_name are JOINed+SELECTed (lines 110-113, 102) but not text-matched — a friendlier search would include them; feature gap, tracked as the documented search-scope limitation."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataEntityRelationshipRepositoryImpl.java:69-71 vs :110-113"
      routes_to_finding: "docs_link_semantic (documented limitation; no code defect)"
    - location: "RelationshipController.java:31"
      input_kind: path-param
      input_name: "relationshipId (ERD)"
      questions:
        - q: "Name promise?"
          a: "Face value: 'the relationship's id'. Documented contract (abe51417): the relationship-class data entity's id — the `id` field of list/detail payloads; payload `erd_relationship_id`/`graph_relationship_id` explicitly banned."
          confidence: STATIC-INFERRED
          evidence: "components.yaml:4391-4402"
        - q: "Actual use?"
          a: "RelationshipsServiceImpl.java:39 → WHERE data_entity.id = relationshipId (ReactiveRelationshipsRepositoryImpl.java:201) with relationship_type='ERD' in the JOIN ON (:184-185); payload id = data_entity.id (RelationshipMapper.java:53, 67) — self-consistent round-trip."
          confidence: STATIC-INFERRED
          evidence: "ReactiveRelationshipsRepositoryImpl.java:184-185, 201 + RelationshipMapper.java:53, 67"
        - q: "MATCH?"
          a: "TRANSLATES_LEGITIMATELY — the data_entity.id consumption is documented in the spec param description + both live doc pages (reason citation: components.yaml:4391-4398, commit abe51417). Was TRANSLATES_SILENTLY in the 2026-05-25 sidecar."
          drift: MINOR
          confidence: STATIC-INFERRED
          evidence: "components.yaml:4391-4402 + live pages (2026-06-12, 200)"
        - q: "What does a caller see when their assumption is wrong?"
          a: "Feeding erd_relationship_id (or relationships.id) → 404 USR002 — VERIFIED end-to-end by IT-077 step 6 (run 2026-06-12: RED vs ref:main spec-blind expectation, GREEN with the documented contract). Residual: bigserial collision can return an unrelated 200."
          confidence: PROBE-VERIFIED
          evidence: "IT-077 result log 2026-06-12 + integration-tests/e2e/specs/erd-graph-relationships.spec.ts"
        - q: "Available-but-unused column matching the name?"
          a: "RELATIONSHIPS.ID exists and is never filtered on — by documented design, not omission, as of abe51417. Re-keying would require flipping the payload id mapping in lockstep (RelationshipMapper.java:53, 67)."
          confidence: STATIC-INFERRED
          evidence: "ReactiveRelationshipsRepositoryImpl.java:201 + components.yaml:4391-4398"
      routes_to_finding: "bugs_limitations_corner_cases.[3] + implicit_adrs.[1]"
    - location: "RelationshipController.java:39"
      input_kind: path-param
      input_name: "relationshipId (GRAPH)"
      questions:
        - q: "Name promise?"
          a: "Same documented contract as the ERD path."
          confidence: STATIC-INFERRED
          evidence: "components.yaml:4391-4402"
        - q: "Actual use?"
          a: "Same SQL site with relationship_type='GRAPH' (RelationshipsServiceImpl.java:46)."
          confidence: STATIC-INFERRED
          evidence: "ReactiveRelationshipsRepositoryImpl.java:159-215"
        - q: "MATCH?"
          a: "TRANSLATES_LEGITIMATELY — same documentation."
          drift: MINOR
          confidence: STATIC-INFERRED
          evidence: "components.yaml:4391-4402"
        - q: "Wrong-assumption consequence?"
          a: "Same as ERD: 404 on the internal detail-record id (graph_relationship_id) — documented at components.yaml:4175-4180."
          confidence: PROBE-VERIFIED
          evidence: "IT-077 (id-contract green-locks) + components.yaml:4175-4180"
        - q: "Available-but-unused column?"
          a: "RELATIONSHIPS.ID — same as ERD path."
          confidence: STATIC-INFERRED
          evidence: "ReactiveRelationshipsRepositoryImpl.java:201"
      routes_to_finding: "bugs_limitations_corner_cases.[3]"
  probes_emitted:
    - probe_id: P-130
      question: "page=0 / page=null / size=0 / size=MAX boundary statuses on GET /api/relationships"
      probe_path: "lineage/odd-platform/probes/P-130.yaml (on disk, status pending-stress-protocol; emitted by the 2026-05-25 pass, still valid at abe51417 — the arithmetic moved to line 87 unchanged)"
    - probe_id: P-131
      question: "auth-mode matrix + cross-data-source visibility posture at runtime"
      probe_path: "lineage/odd-platform/probes/P-131.yaml (on disk, status pending-stress-protocol; the EXCLUDE_FROM_SEARCH half of its hypothesis is now FIXED in code — the probe's expected_outcome needs a refresh before the probe-runner executes it)"
  stress_summary:
    triggers_total: 15
    questions_total: 53
    answers_static_inferred: 42
    answers_probe_needed: 5
    answers_probe_verified: 6
    answers_reference: 0
    drift_flags: 2   # both MINOR — the documented relationship_id translation (ERD + GRAPH)
```

Note on probe hygiene: the 2026-05-25 sidecar referenced "P-128" for the id-contract question, but the on-disk `lineage/odd-platform/probes/P-128.yaml` belongs to LinksController (a slot-allocation race recorded in that sidecar). No replacement probe is needed: the id-contract question is now answered by the spec documentation (abe51417) + the IT-077 e2e green-locks (run log 2026-06-12), and the multi-row sub-case resolved statically via `JooqReactiveOperations.mono` = `Mono.from` first-row semantics. The stale P-128 references are removed by this refresh.

## security

- auth_mode_relevance: ["DISABLED (200 to anonymous — full payload)", "LOGIN_FORM (200 to any authenticated user)", "OAUTH2 (200 to any authenticated user)", "LDAP (200 to any authenticated user)", "S2S (200 to any X-API-Key holder; the filter grants ADMIN globally per REFACTOR-108 cross-ref)"]
- ingestion_filter_relevance: "NO — UI/API surface, not ingestion."
- authorization_assertions: []
- owner_scoping: "BYPASSES — deliberate, documented catalog-global read posture. The list now applies the VISIBILITY trio (ReactiveDataEntityRelationshipRepositoryImpl.java:78-80) but still no OWNERSHIP JOIN, no data_source/namespace permission filter (conditionList at :67-80); detail path likewise (ReactiveRelationshipsRepositoryImpl.java:179-202). Live feature page states: 'There is no RBAC gate on the Relationships endpoints'."
- data_exposure: ["DataEntityRelationship list (id, name, oddrn, source/target entity refs, dataSource ref, type) → any authenticated caller (anyone under DISABLED). Since 122a0823 the list NO LONGER discloses soft-deleted / hollow / exclude_from_search relationship entities — the 0.27.x leak of operator-hidden rows is closed on this surface.", "DataEntityRelationshipDetails (+ erd fields_pairs with FK column oddrns/ids, or graph attributes) → same audience; ALSO still serves DELETED/excluded/hollow rows on direct id access (no visibility predicate on the detail path)."]
- known_security_gaps:
  - "no @PreAuthorize on the controller; no SECURITY_RULES matcher (grep -i 'relationship' in odd-platform-api/src/main/java/.../auth/util/SecurityConstants.java → zero matches; wiring consumer AuthorizationCustomizer.java read end-to-end); only the catch-all .authenticated() under non-DISABLED — evidence: RelationshipController.java:1-44 + AuthorizationCustomizer.java:20-31 — severity: MEDIUM (documented read-collaborative posture; DOC-446 downgrades the doc caveat danger→warning on the 0.28.0 train)"
  - "reachable unauthenticated under auth.type=DISABLED (LSN-001-shape default-insecure posture; DISABLED is dev-only per docs) — evidence: AuthorizationCustomizer wiring absent under DisabledAuthSecurityConfiguration — severity: MEDIUM"
  - "cross-data-source / cross-namespace visibility unrestricted for any authenticated caller — deliberate (implicit_adrs.[2]), documented on the live page; P-131 pins the runtime matrix — evidence: ReactiveDataEntityRelationshipRepositoryImpl.java:67-80 (no owner/namespace/data-source clause) — severity: MEDIUM"
  - "detail-by-id serves rows the operator hid (DELETED / exclude_from_search / hollow) — the visibility fix covers the two LISTING queries only — evidence: ReactiveRelationshipsRepositoryImpl.java:179-202 — severity: LOW"
  - "S2S X-API-Key holders get ADMIN globally (REFACTOR-108); key compromise = full relationship-catalog read — evidence: REFACTOR-108 cross-ref — severity: HIGH (when S2S enabled)"
  - "RESOLVED at 122a0823: the 0.27.x EXCLUDE_FROM_SEARCH bypass on the list (hidden rows enumerated by /api/relationships while /api/dataentities hid them) is closed — pinned by ReactiveDataEntityRelationshipRepositoryImplTest — evidence: ReactiveDataEntityRelationshipRepositoryImpl.java:78-80 — severity: N/A (recorded as closed)"

## performance

- hot_paths:
  - "list endpoint: data_entity scan WHERE entity_class_ids=[9] + the trio, then 6-table JOIN per page — the three new predicates ride the same scan (no new round-trip); large catalogs degrade as before — evidence: ReactiveDataEntityRelationshipRepositoryImpl.java:82-121"
  - "count query shares the conditionList and fires inside pageifyResult's empty-result fallback; non-empty pages use the paginate window-function count — evidence: ReactiveDataEntityRelationshipRepositoryImpl.java:123-138"
- throughput_characteristics:
  - "read-only, non-blocking Mono/Flux; one SQL round-trip per list page; one per detail open (UI fires one useQuery per overview mount)."
- resource_allocation:
  - "each list row materialises ~7 nested pojos (RelationshipDto builder at :127-135); ~210 transient pojos per UI page of 30."
  - "detail aggregates DATASET_FIELD rows via jsonArrayAgg (ReactiveRelationshipsRepositoryImpl.java:181) — payload grows with FK column count."
- scaling_characteristics:
  - "stateless controller; horizontal scale safe; no lock, no @Transactional on these paths."
  - "no size cap (SizeParam has no maximum — components.yaml:4228-4235): whole-catalog single-page pull remains possible; O(N) per call DoS-class concern at large N."
- known_performance_gaps:
  - "no maximum-size guard at any layer — evidence: components.yaml:4228-4235 + ReactiveDataEntityRelationshipRepositoryImpl.java:87 — severity: MEDIUM"
  - "window-function COUNT runs on every page (platform-wide JooqQueryHelper pattern, not relationship-specific) — evidence: JooqQueryHelper paginate pattern — severity: LOW (defer to the JooqQueryHelper sidecar)"

## upstream_callers

- entry_point: "ui_route:/data-modelling/relationships"
  caller_node: "ts react-component:Relationships.tsx"
  multiplicity_per_trigger: 1
  evidence: "Relationships.tsx:20-24 — useSearchRelationships (useInfiniteQuery, size 30, initialPageParam 1 at relatioships.ts:38); 1 call per page boundary; ?type= sanitized via parseRelationshipsType (Relationships.tsx:19) so the backend never sees raw deep-link values"
  observation_class: ui-call
- entry_point: "ui_route:/dataentities/{id}/overview (relationship-class entity, ERD)"
  caller_node: "ts react-component:OverviewEntityRelationship.tsx"
  multiplicity_per_trigger: 1
  evidence: "OverviewEntityRelationship.tsx:18 — useGetEDRRelationshipById(dataEntityDetails.id); useQuery fires once per mount per queryKey (relatioships.ts:6-11). The list row link routes here: RelationshipsListItem.tsx:52 → dataEntityDetailsPath(item.id)"
  observation_class: ui-call
- entry_point: "ui_route:/dataentities/{id}/overview (relationship-class entity, GRAPH)"
  caller_node: "ts react-component:OverviewGraphRelationship.tsx"
  multiplicity_per_trigger: 1
  evidence: "OverviewGraphRelationship.tsx:14 — useGetGraphRelationshipById(dataEntityDetails.id); relatioships.ts:13-18"
  observation_class: ui-call
- entry_point: "rest:GET /api/relationships"
  caller_node: "<external — direct API consumer>"
  multiplicity_per_trigger: 1
  unresolved: true
  evidence: "openapi.yaml:4140-4158; no gate beyond authenticated"
  observation_class: rest-call
- entry_point: "rest:GET /api/relationships/erd/{relationship_id} + /graph/{relationship_id}"
  caller_node: "<external — direct API consumer>"
  multiplicity_per_trigger: 1
  unresolved: true
  evidence: "openapi.yaml:4160-4192; the spec param description (components.yaml:4391-4398) is these callers' contract"
  observation_class: rest-call
- entry_point: "test:erd-graph-relationships.spec.ts (IT-077)"
  caller_node: "odd-team integration-tests/e2e/specs/erd-graph-relationships.spec.ts"
  multiplicity_per_trigger: 1
  evidence: "IT-077 run protocol steps 1-6 drive the list (UI), the visibility negatives, the ?type= fallback, and the erd detail endpoint (API) per run"
  observation_class: rest-call

## downstream_side_effects

- side_effect_class: page-render
  description: "Returns DataEntityRelationshipList (items + PageInfo) of VISIBLE relationship entities only (post-122a0823: HOLLOW=false, STATUS != DELETED, EXCLUDE_FROM_SEARCH null/false); total counts visible rows only."
  evidence: "RelationshipController.java:25-26 + ReactiveDataEntityRelationshipRepositoryImpl.java:78-80, 136-138 + RelationshipMapper.java:45-49"
  cardinality_per_call: "1 response with N items, N <= size (30 per UI page; uncapped on direct API)"
  reachable_from_entry_points:
    - "ui_route:/data-modelling/relationships"
    - "rest:GET /api/relationships"
    - "test:erd-graph-relationships.spec.ts (IT-077)"
- side_effect_class: page-render
  description: "Returns DataEntityRelationshipDetails for an ERD relationship — id (= data_entity.id), erdRelationship.{erd_relationship_id (internal detail-record id, non-round-trippable), fields_pairs (FK column oddrns + dataset_field ids), is_identifying, cardinality}. No visibility predicate: serves DELETED/excluded/hollow rows by direct id."
  evidence: "RelationshipController.java:33-34 + RelationshipMapper.java:65-81 + ErdRelationshipMapper.java:15-25 + ReactiveRelationshipsRepositoryImpl.java:179-215"
  cardinality_per_call: "1 if a row matches (data_entity.id + type='ERD'); 0 → HTTP 404 (NotFoundException)"
  reachable_from_entry_points:
    - "ui_route:/dataentities/{id}/overview (relationship-class entity, ERD)"
    - "rest:GET /api/relationships/erd/{relationship_id}"
    - "test:erd-graph-relationships.spec.ts (IT-077)"
- side_effect_class: page-render
  description: "Returns DataEntityRelationshipDetails for a GRAPH relationship — graphRelationship.{graph_relationship_id (internal, non-round-trippable), is_directed, attributes}. Same no-visibility-predicate property."
  evidence: "RelationshipController.java:41-42 + RelationshipMapper.java:65-81 + ReactiveRelationshipsRepositoryImpl.java:179-215"
  cardinality_per_call: "1 if found; 0 → HTTP 404"
  reachable_from_entry_points:
    - "ui_route:/dataentities/{id}/overview (relationship-class entity, GRAPH)"
    - "rest:GET /api/relationships/graph/{relationship_id}"

(No db-write, activity-emit, external-call, sse-push, cache-mutate, log-emit, metric-emit, header-set or redirect-issue — all three operations are pure GETs materialising SQL reads.)

## sources

- understanding ← RelationshipController.java:1-44 + RelationshipsServiceImpl.java:1-50 + ReactiveDataEntityRelationshipRepositoryImpl.java:57-139 + ReactiveRelationshipsRepositoryImpl.java:76-268 + components.yaml:4391-4402 + AuthorizationCustomizer.java:20-31
- concepts.entities ← RelationshipController.java:4-12 + components.yaml:4138-4143, 4175-4180, 4391-4407 + ErdRelationshipMapper.java:21 + DataEntityStatusDto.java:16
- concepts.operations ← RelationshipController.java:19-43 + RelationshipsServiceImpl.java:30-49 + ReactiveDataEntityRelationshipRepositoryImpl.java:57-139 + ReactiveRelationshipsRepositoryImpl.java:159-215 + openapi.yaml:4140-4192
- concepts.invariants ← ReactiveDataEntityRelationshipRepositoryImpl.java:67-87, 107-109, 136-138 + ReactiveRelationshipsRepositoryImpl.java:135-144, 179-204 + ReactiveDataEntityRepositoryImpl.java:970-976 + JooqReactiveOperations.java:37-42 + parseRelationshipsType.ts:3-9 + components.yaml:4219-4235, 4391-4407 + auth/util/SecurityConstants.java (grep -i relationship → zero matches) + RelationshipMapper.java:53, 60-62, 67, 74-76
- concepts.audiences ← Relationships.tsx:19-24 + RelationshipsListItem.tsx:52 + OverviewEntityRelationship.tsx:18 + OverviewGraphRelationship.tsx:14 + relatioships.ts:6-41 + IT-077 protocol
- dependencies_semantic ← RelationshipController.java:4-17 + RelationshipsServiceImpl.java:17-49 + RelationshipMapper.java:19-81 + ErdRelationshipMapper.java:15-25 + issues/odd-platform/PLT-219.md + components.yaml:4219-4235, 4391-4407
- tests_coverage_semantic ← ReactiveDataEntityRelationshipRepositoryImplTest.java:18-147 + ReactiveRelationshipsRepositoryImplTest.java:17-102 + integration-tests/protocols/IT-077-erd-graph-relationships.md:1-89
- docs_link_semantic ← WebFetch https://docs.opendatadiscovery.org/features/data-modelling/relationships (2026-06-12, 200) + WebFetch https://docs.opendatadiscovery.org/developer-guides/api-reference/relationships (2026-06-12, 200) + backlog/docs/DOC-446.md:1-55
- implicit_adrs ← ReactiveDataEntityRelationshipRepositoryImpl.java:75-80 + ReactiveRelationshipsRepositoryImpl.java:138-143 + components.yaml:4391-4402 + parseRelationshipsType.ts:3-9 + backlog/docs/DOC-446.md:52-54 + RelationshipsServiceImpl.java:38-49
- bugs_limitations_corner_cases ← RelationshipController.java:1-44 + ReactiveDataEntityRelationshipRepositoryImpl.java:87 + ReactiveRelationshipsRepositoryImpl.java:179-204 + JooqReactiveOperations.java:37-42 + RelationshipMapper.java:60-62 + components.yaml:4219-4235 + issues/odd-platform/PLT-218.md + IT-077 result log
- stress_findings ← the per-question evidence fields above (each cites file:line, probe_id, or IT-077)
- security ← AuthorizationCustomizer.java:20-31 + auth/util/SecurityConstants.java (zero relationship matches; that single file defines SECURITY_RULES — wiring consumer read end-to-end) + ReactiveDataEntityRelationshipRepositoryImpl.java:67-80 + ReactiveRelationshipsRepositoryImpl.java:179-202 + live feature page excerpt
- performance ← ReactiveDataEntityRelationshipRepositoryImpl.java:82-138 + ReactiveRelationshipsRepositoryImpl.java:181 + components.yaml:4228-4235
- upstream_callers ← Relationships.tsx:19-24 + relatioships.ts:6-41 + OverviewEntityRelationship.tsx:18 + OverviewGraphRelationship.tsx:14 + RelationshipsListItem.tsx:52 + openapi.yaml:4140-4192 + IT-077 protocol steps 1-6
- downstream_side_effects ← RelationshipController.java:19-43 + RelationshipMapper.java:45-81 + ErdRelationshipMapper.java:15-25 + ReactiveDataEntityRelationshipRepositoryImpl.java:78-80, 136-138 + ReactiveRelationshipsRepositoryImpl.java:179-215

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH (both repository tests + IT-077 read end-to-end; run-log evidence on disk)
- docs_link_semantic: HIGH (both live pages WebFetched 2026-06-12, status 200; train state anchored to DOC-446)
- implicit_adrs: HIGH (three of five anchors are verbatim in-code comments or spec descriptions introduced by the fix)
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: HIGH (file-local signals)
- upstream_callers: HIGH (UI list + detail consumers fully located this pass; rest entries are reference-by-intent)
- downstream_side_effects: HIGH
- stress_findings: MEDIUM (5 of 53 questions remain PROBE-NEEDED — the P-130 boundary family; 6 PROBE-VERIFIED via IT-077; the remaining load-bearing claims are STATIC-INFERRED with in-code or test evidence. P-131's runtime auth matrix is still pending, but its static answer is strongly anchored)

## Maintainer notes

(Empty — no maintainer prose recorded on this node yet; heading preserved across refreshes.)
