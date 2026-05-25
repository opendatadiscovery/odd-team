---
node_id: "odd-platform java MetadataFieldController controller-class:MetadataFieldController"
node_kind: controller-class
axis: controllers
extracted_at_commit: 4ec2b20
enriched_at_commit: 4ec2b20
extractor_version: 0.1.0
prompt_version: file-analyser/0.4.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-25-ZF-MetadataFieldController
---

# MetadataFieldController — semantic understanding

## understanding

`MetadataFieldController` is a thin one-method REST controller implementing the
generated `MetadataApi` interface — sole operation `getMetadataFieldList(query)`
mapped to `GET /api/metadata/fields`
(`<odd-platform-repo>/odd-platform-specification/openapi.yaml:2434-2450`) —
which delegates verbatim to `metadataFieldService.listInternalMetadata(query)`
(MetadataFieldController.java:21-22). The controller is the read-only surface of
the **custom-metadata field catalogue** — the directory of all `INTERNAL`-origin
metadata-field definitions (`{id, name, type, origin}`) that operators select in
the React `MetadataCreateFormItem` autocomplete when adding a custom metadata
value to a Data Entity (`<odd-platform-repo>/odd-platform-ui/src/components/DataEntityDetails/Metadata/MetadataCreateForm/MetadataCreateFormItem/MetadataCreateFormItem.tsx:43-51`).
**There is NO write/update/delete endpoint** on this controller; the catalogue
is **mutated only as a side effect** of `DataEntityController.upsertDataEntityMetadataFieldValue`
(batch L) / `createDataEntityMetadataFieldValue` (paired POST) via
`MetadataFieldServiceImpl.getOrCreateMetadataFields(...)` (MetadataFieldServiceImpl.java:43-59),
which **silently auto-creates** an `INTERNAL`-origin row when the typed name
doesn't exist (paired with the EXTERNAL-origin ingestion path
`ingestMetadataFields(...)` at lines 62-71 that collectors use). Two load-bearing
behavioural defects stand out: **(1) the response shape advertises pagination
(`MetadataFieldList = {items, page_info: {total, hasNext}}`,
`components.yaml:2111-2120`) but the SQL has NO LIMIT / OFFSET / ORDER BY
(`ReactiveMetadataFieldRepositoryImpl.java:44-56`) and the mapper hardcodes
`total = items.length` and `hasNext = false`
(`MetadataFieldMapperImpl.java:29-33`)** — every call returns the ENTIRE filtered
non-deleted INTERNAL catalogue, in Postgres-heap order, with a `page_info` block
that is theatre rather than truth. **(2) The endpoint has NO per-permission
authorization gate** — no `SecurityRule` exists in `SecurityConstants.SECURITY_RULES`
for `/api/metadata/fields` (the SECURITY_RULES register only the per-value PUT/POST/DELETE
write paths at SecurityConstants.java:202-211), so the read falls through to
`pathMatchers("/**").authenticated()` (AuthorizationCustomizer.java:29-30). Any
authenticated user, regardless of policy / role / owner scope, can enumerate the
entire custom-metadata field schema of the deployment — including field names
that operators may have intended to expose only to specific data-entity owners.

## concepts

- entities: [
    "`MetadataField` (OpenAPI schema, `components.yaml:2094-2109`) — `{id: int64 (required), name: string (required), type: MetadataFieldType (required), origin: MetadataFieldOrigin (optional)}`. The type enum is one of `BOOLEAN | INTEGER | FLOAT | STRING | DATETIME | ARRAY | JSON | UNKNOWN` per `components.yaml:2077-2086`; origin is one of `EXTERNAL | INTERNAL` per `components.yaml:2088-2092`.",
    "`MetadataFieldList` (OpenAPI schema, `components.yaml:2111-2120`) — `{items: MetadataField[], page_info: PageInfo}`. The schema SUGGESTS pagination via the embedded `PageInfo`, but the implementation never paginates.",
    "`PageInfo` (OpenAPI schema, returned with `total` and `has_next` fields) — populated by `MetadataFieldMapperImpl.java:32` as `total = pojos.size()` and `hasNext = false`. The PageInfo block is structurally identical to what genuinely paginated endpoints emit, but the values here are constant-mocked.",
    "`MetadataFieldPojo` (jOOQ POJO for `metadata_field` — `{id bigserial PK, type varchar(64), name varchar (text after V0_0_26), origin varchar(8) DEFAULT 'INTERNAL', deleted_at timestamp}` per `V0_0_1__init.sql:166-173` + `V0_0_64__remove_is_deleted_field.sql:41-50` + `V0_0_26__remove_length_constraints.sql:43-44`)",
    "`MetadataKey` (record, `MetadataKey.java`) — internal `(fieldName, fieldType)` tuple used by `getOrCreateMetadataFields` and `ingestMetadataFields` to deduplicate the upsert side; NOT exposed on this wire surface."
  ]
- operations: [
    "`getMetadataFieldList(query)` — `Mono<ResponseEntity<MetadataFieldList>>` returning ALL non-deleted `INTERNAL`-origin metadata fields whose name contains the substring `query` (case-insensitive). When `query` is null or empty, returns ALL non-deleted INTERNAL fields. EXTERNAL-origin fields (collector-populated) are NEVER included in this response regardless of the query (MetadataFieldController.java:18-23 → MetadataFieldServiceImpl.java:37-40 → ReactiveMetadataFieldRepositoryImpl.java:44-56).",
    "(Out-of-band sibling — write side-effect path NOT exposed by this controller) `metadataFieldService.getOrCreateMetadataFields(...)` (MetadataFieldServiceImpl.java:43-59) called from `DataEntityServiceImpl.createMetadata(...)` — the UI's 'Add Custom Metadata' form submit auto-creates an INTERNAL-origin field row when the typed name has no existing match. The catalogue read by `getMetadataFieldList` therefore grows as a side effect of every Data Entity custom-metadata creation."
  ]
- invariants: [
    "**Origin filter pinned to INTERNAL** — `ReactiveMetadataFieldRepositoryImpl.listInternalMetadata` line 46 emits `METADATA_FIELD.ORIGIN.eq(MetadataOrigin.INTERNAL.name())`. EXTERNAL-origin fields (populated via collector ingestion through `ingestData` at lines 73-109) are NEVER visible on this wire surface. Confirmed by `ReactiveMetadataFieldRepositoryImplTest.testListInternalMetadata` at lines 33-68 (5 fields seeded — 3 INTERNAL, 2 EXTERNAL; the response contains exactly the 3 INTERNAL).",
    "**Soft-delete filter applied** — `ReactiveMetadataFieldRepositoryImpl extends ReactiveAbstractSoftDeleteCRUDRepository` (line 34-35); the manual condition list at line 45-46 is built via `addSoftDeleteFilter(...)` which appends `deleted_at IS NULL` per `ReactiveAbstractSoftDeleteCRUDRepository.java:96-104`. Soft-deleted INTERNAL fields are invisible. Test coverage: `ReactiveMetadataFieldRepositoryImplTest.java:49-59` deletes one of the seeded INTERNAL rows and confirms `listInternalMetadata` returns only 2.",
    "**No LIMIT, no OFFSET, no ORDER BY** at the SQL layer — the JOOQ chain at lines 51-55 is `DSL.selectFrom(METADATA_FIELD).where(conditions)` with no pagination call and no order specification. Postgres returns rows in heap-scan order (roughly insertion order on a freshly vacuumed table; arbitrary after churn). The wire response carries the ENTIRE filtered set in one payload.",
    "**`MetadataFieldList.page_info` is theatre** — `MetadataFieldMapperImpl.java:30-33` constructs `new PageInfo().total((long) pojos.size()).hasNext(false)`. `total` equals `items.length` always; `hasNext` is the constant `false` always. A caller using `page_info` to drive pagination cannot detect overflow; the values describe the response, not the catalogue.",
    "**Case-insensitive substring filter on `name`** — `ReactiveMetadataFieldRepositoryImpl.java:47-49` is `if (StringUtils.hasLength(query)) conditions.add(nameField.containsIgnoreCase(query))`. Empty/null query → returns ALL non-deleted INTERNAL fields. The jOOQ `containsIgnoreCase` lowercases both sides and emits `LOWER(name) LIKE LOWER('%query%')`.",
    "**Auth required but NO per-permission gate** — `/api/metadata/fields` is not in `SecurityConstants.WHITELIST_PATHS[95-96]` and has no `SECURITY_RULES[98-355]` entry; falls through to `pathMatchers(\"/**\").authenticated()` in `AuthorizationCustomizer:29-30` and the equivalent in `LoginFormSecurityConfiguration:57`. Under `auth.type=DISABLED` the endpoint is unauthenticated (`DisabledAuthSecurityConfiguration:16` `anyExchange().permitAll`).",
    "**No owner-scoping on read** — the controller does not consult `permissionService` and the repository does not filter by owner. The full INTERNAL catalogue is enumerable by any authenticated user regardless of which Data Entities they can see. The live Permissions docs (WebFetched 2026-05-25, status 200) confirm there is NO `CUSTOM_METADATA_FIELD_READ` Permission — only the per-value `DATA_ENTITY_CUSTOM_METADATA_{CREATE,UPDATE,DELETE}` are documented.",
    "**Single SQL execution per call; no count CTE** — unlike the generic paginated `ReactiveAbstractCRUDRepository.list(...)` (which adds a `count().over()` window), this code path runs only the SELECT (line 51-55). The response's `page_info.total` is computed in Java from the materialised list, never queried at the database.",
    "**`ServerWebExchange exchange` parameter is unused** — line 20 declares the exchange handle (forced by the generated `MetadataApi` interface) but the method body (line 21-22) never references it. Caller-principal inspection (e.g. an owner-scoped variant of the catalogue) would require reading this parameter; it is wired but unread."
  ]
- audiences: [
    "**React `MetadataCreateFormItem` autocomplete (the primary user-visible surface)** — `<odd-platform-repo>/odd-platform-ui/src/components/DataEntityDetails/Metadata/MetadataCreateForm/MetadataCreateFormItem/MetadataCreateFormItem.tsx:24-89`. Opens on focus, debounces 500ms (line 49), dispatches `searchMetadata({query: searchText})` (line 43), feeds the resulting `metadataFields` into a free-text MUI Autocomplete with `freeSolo` semantics — the operator may either pick an existing field name from the dropdown (which auto-populates the `type` SELECT) OR type a brand-new name (which then opens the `type` SELECT for manual choice and routes through the `createDataEntityMetadataFieldValue` POST → `getOrCreateMetadataFields` auto-insert path).",
    "**React `searchMetadata` redux thunk** — `<odd-platform-repo>/odd-platform-ui/src/redux/thunks/metadata.thunks.ts:78-88` is the SOLE caller of the generated `metadataApi.getMetadataFieldList` (`<odd-platform-repo>/odd-platform-ui/src/lib/api.ts`). The thunk discards `page_info` entirely (line 84-85: `const { items } = ...`) and propagates only the `items` array into the Redux store, confirming that the PageInfo block is dead-weight on the wire from the UI's perspective.",
    "**Any authenticated API client** — the OpenAPI operation `getMetadataFieldList` (`openapi.yaml:2434-2450`) is available to any external integrator after authentication. No SDK-level pagination guidance because there is no actual pagination."
  ]

## dependencies_semantic

- requires-feature: [
    "**Custom Metadata feature (F-013)** — the read side of the custom-metadata field catalogue is the directory dimension; the write side is the auto-create-on-miss path through `getOrCreateMetadataFields` (this catalogue is grown by every Data Entity custom-metadata creation that types a previously-unseen field name; per batch L `upsertDataEntityMetadataFieldValue` sidecar's invariants the per-value write surface is separately auth-gated).",
    "**External ingestion / Collector pipeline** — the `metadata_field` table is shared with EXTERNAL-origin entries written by `MetadataFieldServiceImpl.ingestMetadataFields` (line 62-71) via `ReactiveMetadataFieldRepositoryImpl.ingestData` (line 73-109). The list endpoint excludes EXTERNAL entries, but the table is shared and the unique indices (`ix_unique_internal_name` on name WHERE origin='INTERNAL'; `ix_unique_external_name_type` on (type, name) WHERE origin <> 'INTERNAL', per `V0_0_1__init.sql:238-244`) partition the namespace.",
    "**Search-vector (FTS) feature** — metadata-field values written through the per-value PUT/POST tokenise into `search_entrypoint.metadata_vector` (per batch L sidecar). The field-name directory itself is not in any FTS index; this endpoint reads only the catalogue dimension."
  ]
- requires-config: [] — N/A. The class reads no config; only injected fields.
- requires-runtime: [
    "Spring WebFlux + Reactor (`Mono<ResponseEntity<MetadataFieldList>>` reactive return)",
    "OpenAPI-generated `MetadataApi` interface (generated under `<odd-platform-repo>/odd-platform-api/build/generated/...`, not present in source tree). The controller is the sole `@RestController` implementation.",
    "PostgreSQL `metadata_field` table — schema `{id bigserial PK, type varchar(64), name varchar, origin varchar(8) NOT NULL DEFAULT 'INTERNAL', deleted_at timestamp}` per V0_0_1 + V0_0_26 + V0_0_64; with two partial unique indices (`ix_unique_internal_name` on name where origin='INTERNAL'; `ix_unique_external_name_type` on (type, name) where origin <> 'INTERNAL').",
    "`ReactiveMetadataFieldRepositoryImpl` extending `ReactiveAbstractSoftDeleteCRUDRepository<MetadataFieldRecord, MetadataFieldPojo>` (line 34-35) — provides the `addSoftDeleteFilter` semantics; the list method itself is a custom implementation (NOT the inherited `list(page, size, query)` paginated path).",
    "`MetadataFieldMapper` (MapStruct-style interface; impl at `MetadataFieldMapperImpl.java:14-44`) — converts `List<MetadataFieldPojo>` to `MetadataFieldList` with `items` + the hardcoded `page_info`."
  ]
- couples-to: [
    "`MetadataApi` interface (generated from OpenAPI; not in source tree) — the controller is the SOLE @RestController implementation",
    "`MetadataFieldService` (`MetadataFieldService.java:11-19`) — four-method contract `get`, `listInternalMetadata`, `getOrCreateMetadataFields`, `ingestMetadataFields`. Only `listInternalMetadata` is invoked from this controller.",
    "`MetadataFieldServiceImpl` (`MetadataFieldServiceImpl.java:23-92`) — sole implementation; the listInternalMetadata path is a thin map over the repository",
    "`ReactiveMetadataFieldRepository` / `ReactiveMetadataFieldRepositoryImpl` (lines 11-19 + 33-128) — extends the soft-delete CRUD base; adds `listInternalMetadata`, `listByKey`, `ingestData`, `getDtosByDataEntityId`",
    "`MetadataFieldMapper` / `MetadataFieldMapperImpl` (`MetadataFieldMapperImpl.java:14-44`) — the source of the constant-mocked `PageInfo`",
    "**SecurityConstants** (`SecurityConstants.java:95-355`) — by ABSENCE. The mere lack of a SecurityRule for `/api/metadata/fields` is what permits any authenticated user to read the full catalogue."
  ]

## tests_coverage_semantic

- covered_behaviours:
  - behaviour: "`listInternalMetadata(null)` returns only INTERNAL-origin non-deleted fields (5 seeded — 3 INTERNAL, 2 EXTERNAL → 3 returned)"
    test_class: integration
    test_files: ["<odd-platform-repo>/odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/ReactiveMetadataFieldRepositoryImplTest.java:33-48"]
  - behaviour: "Soft-deleted INTERNAL fields excluded from `listInternalMetadata` result"
    test_class: integration
    test_files: ["<odd-platform-repo>/odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/ReactiveMetadataFieldRepositoryImplTest.java:49-59"]
  - behaviour: "`listInternalMetadata(name)` substring filter returns only matching INTERNAL field"
    test_class: integration
    test_files: ["<odd-platform-repo>/odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/ReactiveMetadataFieldRepositoryImplTest.java:61-67"]
  - behaviour: "`listByKey(empty)` returns empty (out-of-band sibling, but exercises the soft-delete-aware repository)"
    test_class: integration
    test_files: ["<odd-platform-repo>/odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/ReactiveMetadataFieldRepositoryImplTest.java:75-79"]
- uncovered_behaviours:
  - behaviour: "Controller-tier or service-tier test exercising the full chain MetadataFieldController.getMetadataFieldList → response mapping (PageInfo)"
    test_class: integration
    criticality: HIGH
    note: "No WebTestClient or service-mock test confirms the response shape; specifically NO test confirms that `page_info.total == items.length` and `page_info.has_next == false` regardless of catalogue cardinality. The PageInfo-theatre defect is not regression-protected. See P-137."
  - behaviour: "Unbounded-return amplification — caller receives ENTIRE filtered catalogue regardless of size"
    test_class: performance
    criticality: HIGH
    note: "No assertion that the endpoint has no LIMIT; an installation with 10000+ INTERNAL metadata fields would return all of them in one payload. See P-137."
  - behaviour: "Postgres ORDER on the heap-scan result — no contract; observed order changes after churn"
    test_class: integration
    criticality: MEDIUM
    note: "Operators may rely on the autocomplete's natural ordering; after a long-running deployment with creates + soft-deletes, the ordering becomes unpredictable. See P-137 realism_caveats."
  - behaviour: "Auth surface across DISABLED / LOGIN_FORM / OAUTH2 / LDAP"
    test_class: security
    criticality: HIGH
    note: "No test confirms that an unauthenticated caller is rejected with 401/302 under LOGIN_FORM / OAUTH2 / LDAP, or that auth.type=DISABLED genuinely returns the catalogue. No test confirms that a READ_ONLY role gets the same response as an ADMIN."
  - behaviour: "Wildcard / SQL-injection vector via the `query` parameter (e.g. `query=%`, `query=_a_b_`)"
    test_class: security
    criticality: LOW
    note: "jOOQ `containsIgnoreCase` escapes wildcards per jOOQ source; not statically verified at the wire from this code. No test confirms the escape behaviour against a crafted query payload."
- test_files:
    - "<odd-platform-repo>/odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/ReactiveMetadataFieldRepositoryImplTest.java:1-135"
    - "<odd-platform-repo>/odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/mapper/MetadataFieldMapperTest.java:1-* (mapper-level; doesn't assert the page_info constants)"
- gaps: |
    The controller and service `listInternalMetadata` paths have ZERO direct test
    coverage — only the lower-level repository is exercised, and the repository
    test (`testListInternalMetadata`) verifies the origin filter, the soft-delete
    filter, and the substring filter individually but DOES NOT verify the
    PageInfo-theatre behaviour, the unbounded-return amplification, or the lack of
    ORDER BY. A regression that adds a real LIMIT/OFFSET to the repository or that
    changes the mapper's PageInfo construction would land silently. The worst
    integration class is auth-mode validation: there is no proof that the endpoint
    enforces 401 across the three live non-DISABLED auth modes, and there is no
    proof that no authorization gate is applied to the read path (a future
    refactor that ADDS a SecurityRule entry for `/api/metadata/fields` would
    not be caught by any existing test). P-137 pins the PageInfo + unbounded
    + ordering questions; an auth-matrix probe is a separate enqueue.

## docs_link_semantic

- declared_docs: [] — N/A. No `@docs` annotation on `MetadataFieldController.java`; the controller carries no Javadoc.
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions"
    anchor: "(text reference, not anchored)"
    rationale: "This page is the canonical Permissions reference; it documents the three write-side permissions (DATA_ENTITY_CUSTOM_METADATA_CREATE / UPDATE / DELETE) that gate the per-value PUT/POST/DELETE endpoints. It is silent about read access to the catalogue (no CUSTOM_METADATA_FIELD_READ permission exists)."
    last_verified_at: "2026-05-25T00:00:00Z"
    last_verified_status: 200
    confidence: MEDIUM
    fetched_excerpts: |
      "The documented custom metadata permissions are all write/modify operations:
      - DATA_ENTITY_CUSTOM_METADATA_CREATE — 'Allows creating custom metadata for
        a data entity.'
      - DATA_ENTITY_CUSTOM_METADATA_UPDATE — 'Allows editing custom metadata on a
        data entity.'
      - DATA_ENTITY_CUSTOM_METADATA_DELETE — 'Allows deleting custom metadata from
        a data entity.'
      These three permissions control creation, modification, and deletion of
      custom metadata, but the documentation does not list any corresponding read
      or view permissions for accessing or browsing available custom metadata
      fields." (paraphrased from WebFetch response of
      https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions,
      2026-05-25, status 200)
- doc_drift_findings:
  - "**No live doc page documents the Custom Metadata feature end-to-end.** WebFetched the candidate paths `/active-platform-features/metadata` (404), `/active-platform-features/custom-metadata` (404), `/features/data-discovery/custom-metadata` (not in sitemap), `/active-platform-features` (lists Activity Feed / GenAI / Alerting / Notifications — does NOT include custom metadata). The only metadata-related page in the documentation index is `https://docs.opendatadiscovery.org/features/data-discovery/metadata-stale.md` which documents the staleness indicator only (verified 2026-05-25, status 200) — explicitly silent on the catalogue, on INTERNAL vs EXTERNAL origin, on the autocomplete behaviour, and on the auto-create-on-miss semantics."
  - "**The `MetadataFieldList.page_info` block is documented in the OpenAPI spec but lies on the wire.** The OpenAPI response schema (`components.yaml:2111-2120`) embeds `PageInfo` (`{total, has_next}`); any SDK or external integrator reading the spec will assume the endpoint paginates. The wire reality is that `page_info.total` equals `items.length` (NOT a true row count) and `page_info.has_next` is constant `false`. There is no doc warning about this gap; the OpenAPI spec is silent. (Code evidence: `MetadataFieldMapperImpl.java:30-33`.)"
  - "**No live doc page mentions the auto-create-on-miss catalogue-growth side-effect.** Operators are not told that submitting a Data Entity custom-metadata value with a previously-unseen field name silently adds that name to the global INTERNAL catalogue (visible to every authenticated user via this read endpoint). The cross-data-entity exposure semantics are undocumented."
  - "**No live doc page mentions that the `/api/metadata/fields` read has NO per-permission gate.** Operators wiring policies for the per-value write surface (e.g. restricting DATA_ENTITY_CUSTOM_METADATA_UPDATE to entity owners) may assume that the catalogue itself is similarly scoped; the documentation never clarifies that the catalogue read is open to every authenticated user."

## implicit_adrs

- "**Custom-metadata catalogue is read-only on this surface; mutation is a side effect of per-value write operations** — the controller exposes ONLY `getMetadataFieldList`. The write path is `MetadataFieldServiceImpl.getOrCreateMetadataFields` called from `DataEntityServiceImpl.createMetadata` (per batch L sidecar) and the EXTERNAL-origin path `ingestMetadataFields` called from the collector ingestion pipeline. The directory is therefore a derived dimension that follows custom-metadata value writes, not an independently managed catalogue." — evidence: MetadataFieldController.java:15-24 (one operation, GET only) + MetadataFieldService.java:11-19 (`getOrCreateMetadataFields` / `ingestMetadataFields` are not exposed via this controller) + openapi.yaml:2434-2450 (only `getMetadataFieldList` operation under `/api/metadata/fields`) — intent_anchor: "the `MetadataApi` contract in OpenAPI declares exactly one operation `getMetadataFieldList`; the controller's existence is to be the @RestController implementation of that single operation, not a general-purpose CRUD on metadata-field rows" — confidence: HIGH
- "**Origin partition between INTERNAL and EXTERNAL is enforced at read** — `listInternalMetadata` line 46 explicitly filters by `origin = 'INTERNAL'`; EXTERNAL fields populated by collectors are NEVER returned. The schema-level partial unique indices (`ix_unique_internal_name` on name WHERE origin = INTERNAL; `ix_unique_external_name_type` on (type, name) WHERE origin <> INTERNAL, per V0_0_1__init.sql:238-244) reinforce this stance: INTERNAL fields are unique on name alone (so users can't create two STRING and INTEGER fields named 'cost_centre'); EXTERNAL fields are unique on (type, name) (collectors can register both)." — evidence: ReactiveMetadataFieldRepositoryImpl.java:46 + V0_0_1__init.sql:238-244 + MetadataFieldServiceImpl.java:43-71 (separate `getOrCreateMetadataFields` for user-side INTERNAL vs `ingestMetadataFields` for collector EXTERNAL) — intent_anchor: "the two distinct service methods + the two distinct partial unique indices encode the intent that user-typed custom-metadata fields and collector-ingested metadata fields occupy disjoint sub-namespaces, even though they share the same physical table" — confidence: HIGH
- "**Soft-delete is the chosen delete-semantics for the metadata-field directory** — the repository extends `ReactiveAbstractSoftDeleteCRUDRepository` (line 34-35); the `addSoftDeleteFilter` is applied to the list path (line 45-46) and to the listByKey path (line 69). Historical metadata-field references in `metadata_field_value` rows survive without breaking FK constraints when a field is tombstoned. There is no UI / API path to actually invoke a delete; the choice is forward-looking (consistent with TitleController batch ZD pattern)." — evidence: ReactiveMetadataFieldRepositoryImpl.java:34-35 (extends ReactiveAbstractSoftDeleteCRUDRepository) + ReactiveAbstractSoftDeleteCRUDRepository.java:50-59 (delete → UPDATE deleted_at NOT-DELETE FROM) + V0_0_64__remove_is_deleted_field.sql:41-50 (deleted_at column added) — intent_anchor: "the class hierarchy `extends ReactiveAbstractSoftDeleteCRUDRepository` is the decision; the production codebase having zero `metadataFieldRepository.delete(...)` call-sites OUTSIDE the test cleanup (grep `metadataFieldRepository.delete` returns only ReactiveMetadataFieldRepositoryImplTest.java:29) shows the decision is provision-now-use-later" — confidence: HIGH

## bugs_limitations_corner_cases

- "**`MetadataFieldList.page_info` is theatre — total equals items.length, hasNext is hardcoded false** — `MetadataFieldMapperImpl.java:30-33` constructs `new PageInfo().total((long) pojos.size()).hasNext(false)`. The OpenAPI response schema (`components.yaml:2111-2120`) advertises pagination via the embedded PageInfo; the implementation never paginates. An SDK author reading the spec and implementing a paged 'load-more' UI cannot detect overflow. An operator reading `page_info.total` cannot use it as a catalogue-size indicator (it is just the array length they already counted)." — evidence: MetadataFieldMapperImpl.java:30-33 + components.yaml:2111-2120 + ReactiveMetadataFieldRepositoryImpl.java:44-56 (no LIMIT / OFFSET) — severity: HIGH (contract-level misalignment between OpenAPI spec and runtime behaviour; SDK-author and integrator-author class)
- "**Unbounded return — caller receives ENTIRE filtered catalogue per call** — no LIMIT / OFFSET in the SQL (`ReactiveMetadataFieldRepositoryImpl.java:51-55`). With 10000+ INTERNAL metadata fields, the JVM materialises 10000 MetadataFieldPojo + 10000 MetadataField DTOs + the wire payload per call. Every autocomplete-open in the UI debounce-fires this endpoint (MetadataCreateFormItem.tsx:43, 500ms debounce). The amplification scales linearly with directory cardinality." — evidence: ReactiveMetadataFieldRepositoryImpl.java:44-56 (no LIMIT clause) + MetadataFieldMapperImpl.java:29-33 + MetadataCreateFormItem.tsx:43-51 (autocomplete dispatch on every open + every debounced keystroke) — severity: MEDIUM (the catalogue is typically tens of rows; amplification bounded by row count, not by request alone; severity rises HIGH at scale)
- "**No ORDER BY at the SQL layer — heap-scan order is the operator-visible order** — the SELECT (lines 51-55) has no order specification. Postgres returns rows in heap-scan order, which is roughly insertion order on a freshly vacuumed table but becomes arbitrary after creates + soft-deletes + vacuum cycles. The autocomplete in the UI does NOT re-sort by the typed query (MetadataCreateFormItem.tsx:94-109 — filterOptions uses MUI's `createFilterOptions` which preserves input order); operators may see the same query produce different orderings between calls or between deployment generations." — evidence: ReactiveMetadataFieldRepositoryImpl.java:51-55 (no orderBy) + MetadataCreateFormItem.tsx:94-109 — severity: LOW (UX-shaped; not data-loss-shaped)
- "**No per-permission authorization gate on the catalogue read** — `/api/metadata/fields` is not in `SecurityConstants.WHITELIST_PATHS` and has no `SECURITY_RULES` entry; falls through to `pathMatchers(\"/**\").authenticated()`. Any authenticated user can enumerate the full INTERNAL catalogue regardless of role / policy / owner scope. There is NO `CUSTOM_METADATA_FIELD_READ` Permission documented in `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions` (verified 2026-05-25, status 200) — the permission model has only the per-VALUE write side." — evidence: SecurityConstants.java:95-355 (no /api/metadata/fields rule) + LoginFormSecurityConfiguration.java:50-57 + AuthorizationCustomizer.java:21-30 — severity: MEDIUM (the catalogue contains field NAMES that operators may have intended to scope to specific Data Entity owners; cross-data-entity exposure of vocabulary like 'salary_band', 'phi_classification', 'pii_indicator' is a leak vector — operators using ODD as a soft-data-governance system have NO mechanism to scope which field names are visible to which users)
- "**Auto-create-on-miss catalogue growth has no rate-limit, no normalisation, no allowlist** — every Data Entity custom-metadata creation with a previously-unseen field name silently adds an INTERNAL row to this global catalogue (via `MetadataFieldServiceImpl.getOrCreateMetadataFields`, MetadataFieldServiceImpl.java:43-59). The catalogue accumulates typos, case variants, language variants, leading-whitespace variants. There is no case-folding, no trimming, no near-duplicate detection. The directory read by `getMetadataFieldList` grows monotonically over deployment lifetime (no UI delete path)." — evidence: MetadataFieldServiceImpl.java:43-59 + MetadataCreateFormItem.tsx:60-91 (free-text input; the autocomplete is `freeSolo` per the createFilterOptions logic) — severity: MEDIUM (the catalogue grows unboundedly; an operator who typo'd `cost-centre` once will see it in the dropdown forever)
- "**DISABLED mode exposes the catalogue to unauthenticated callers** — `DisabledAuthSecurityConfiguration.java:13-18` is `authorizeExchange.anyExchange().permitAll()`; the entire HTTP surface is open. An attacker scanning a dev/sandbox deployment can probe `GET /api/metadata/fields` and enumerate every custom-metadata field defined by the deployment." — evidence: DisabledAuthSecurityConfiguration.java:13-18 — severity: LOW (DISABLED is dev-only per the workspace's auth.type stance; the leak is intentional under that stance)
- "**No live doc page documents the Custom Metadata feature, the catalogue, the autocomplete, the auto-create semantics, the INTERNAL/EXTERNAL partition, or the API surface** — `https://docs.opendatadiscovery.org/active-platform-features/metadata` (404), `/active-platform-features/custom-metadata` (404). The Permissions page (200) lists only the three per-value write Permissions and is silent on the catalogue read. An operator wiring custom-metadata policy cannot find any documentation explaining the cross-data-entity exposure of field names." — evidence: WebFetch responses 2026-05-25 (404 on `/active-platform-features/metadata` + `/active-platform-features/custom-metadata`; 200 on Permissions page with no catalogue-read coverage) — severity: HIGH (a load-bearing feature with no operator documentation; concept-merger should surface this as a DOC-NNN candidate)
- "**`MetadataFieldType` enum is documentation-only at write — type-mismatch values are accepted** — cross-cutting with batch L `upsertDataEntityMetadataFieldValue` sidecar's finding: the type enum (`components.yaml:2077-2086`, 8 values) is honoured at the OpenAPI surface as an enum on `MetadataObject.type`, but the per-value PUT/POST writes raw text values with no coercion. The catalogue surfaces a `type` field per row, but downstream value writes don't validate against it. This controller's read accurately reports the declared type; the type is a vocabulary, not a constraint." — evidence: components.yaml:2077-2086 + cross-reference to batch L upsertDataEntityMetadataFieldValue sidecar invariants[3] — severity: MEDIUM (rerouted from batch L; mentioned here because the catalogue surfaces the type that the write side ignores)
- "**ServerWebExchange is wired but unused — owner-scoped variant would consume it** — line 20-22 declares `ServerWebExchange exchange` but never reads it. An owner-scoped variant of the catalogue (e.g. 'show me only custom-metadata fields used on Data Entities I own') would consume `exchange.getPrincipal()` to derive the caller; the parameter is provisioned but unread. Not a bug; an available-but-unused signal." — evidence: MetadataFieldController.java:20-22 — severity: LOW (architectural observation; not a defect)

## stress_findings

```yaml
stress_findings:
  tunables: []  # NONE — the controller has no constants, no @Value, no magic strings, no numeric literals on the request path. Caller-supplied `query` is the only tunable input, covered under request_inputs below. (The lack of an in-code LIMIT — a missing tunable — is the load-bearing finding, captured under bugs_limitations_corner_cases[1] and stress_summary.)
  name_behavior_pairs:
    - name: "getMetadataFieldList"
      promise: "Returns a paginated list (MetadataFieldList) of custom metadata fields matching the search query"
      implementation: "MetadataFieldController.java:21-22 → metadataFieldService.listInternalMetadata(query) → MetadataFieldServiceImpl.java:37-40 → reactiveMetadataFieldRepository.listInternalMetadata(query) → ReactiveMetadataFieldRepositoryImpl.java:44-56: SELECT * FROM metadata_field WHERE origin = 'INTERNAL' AND deleted_at IS NULL [AND LOWER(name) LIKE LOWER('%query%')] (no LIMIT, no OFFSET, no ORDER BY). Then MetadataFieldMapperImpl.java:29-33 wraps the list into MetadataFieldList with PageInfo{total = items.length, hasNext = false}."
      drift: DRIFT_NAME_VS_BEHAVIOR
      operator_visible_consequence: "The OpenAPI response schema (components.yaml:2111-2120) embeds a PageInfo block, signalling paginated semantics to SDK authors. The implementation returns the ENTIRE filtered catalogue with constant-mocked page_info. A caller writing a 'load-more' UI based on page_info.has_next cannot detect overflow; a caller using page_info.total as a catalogue-size indicator gets the array length they already counted. The name `getMetadataFieldList` is generic enough to permit either interpretation, but the response shape lies."
      confidence: STATIC-INFERRED
      evidence: "MetadataFieldController.java:18-23 + MetadataFieldServiceImpl.java:37-40 + ReactiveMetadataFieldRepositoryImpl.java:44-56 + MetadataFieldMapperImpl.java:29-33 + components.yaml:2111-2120"
    - name: "MetadataFieldList (response type)"
      promise: "A paginated list — `items` + `page_info{total, has_next}` per the OpenAPI schema"
      implementation: "MetadataFieldMapperImpl.java:30-33 hardcodes `total = pojos.size()` and `hasNext = false`. The PageInfo block is structurally identical to genuinely paginated endpoints, but the values are constant-mocked. (Genuinely paginated endpoints construct PageInfo from `Page<T>.total()` and `Page<T>.hasNext()` — this one constructs from a raw `List<T>`.)"
      drift: DRIFT_NAME_VS_BEHAVIOR
      operator_visible_consequence: "Wire-level theatre. Documented in bugs_limitations_corner_cases[0]."
      confidence: STATIC-INFERRED
      evidence: "MetadataFieldMapperImpl.java:30-33"
  orderings:
    - location: "ReactiveMetadataFieldRepositoryImpl.java:51-55 (the SELECT)"
      questions:
        - q: "What is the actual ORDER BY at the lowest layer?"
          a: "**NONE.** The JOOQ chain at lines 51-55 is `DSL.selectFrom(METADATA_FIELD).where(conditions)` with no `.orderBy(...)` call. Postgres returns rows in heap-scan order, which is roughly insertion order on a freshly vacuumed table but becomes implementation-defined after creates + soft-deletes + vacuum cycles. This is a contract-less ordering — the operator-visible order is whatever Postgres feels like returning."
          confidence: STATIC-INFERRED
          evidence: "ReactiveMetadataFieldRepositoryImpl.java:51-55"
        - q: "What is the tie-breaker when sort-key values are equal?"
          a: "N/A — no sort key. Every row is a 'tie' in this sense; the order is Postgres-defined."
          confidence: STATIC-INFERRED
          evidence: "ReactiveMetadataFieldRepositoryImpl.java:51-55"
        - q: "Which subset is returned when result-set > page size?"
          a: "ALL — no page size. The endpoint returns the entire filtered set in one payload. The 'page' concept is fictional at the SQL layer."
          confidence: STATIC-INFERRED
          evidence: "ReactiveMetadataFieldRepositoryImpl.java:51-55 + MetadataFieldMapperImpl.java:29-33"
        - q: "Does any upstream layer re-sort or filter the result?"
          a: "**YES — the UI's MUI Autocomplete applies its own client-side filter.** MetadataCreateFormItem.tsx:94-109 calls `createFilterOptions` which applies MUI's substring match over the fetched array. The MUI filter preserves input order (it does not re-sort) — so the UI presents the items in whatever order Postgres returned them. If the catalogue grows large, the operator's typed query is filtered client-side within the server-returned-N rows, but the relative position of matching titles is whatever the heap-scan produced."
          confidence: STATIC-INFERRED
          evidence: "MetadataCreateFormItem.tsx:94-109 + ReactiveMetadataFieldRepositoryImpl.java:51-55"
  auth_gates:
    - location: "MetadataFieldController.java:13-15 (no @PreAuthorize on the class)"
      endpoint: "GET /api/metadata/fields"
      questions:
        - q: "What does this endpoint return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "DISABLED — endpoint is unauthenticated; any caller receives the full INTERNAL catalogue (DisabledAuthSecurityConfiguration.java:16 `anyExchange().permitAll`). LOGIN_FORM — endpoint requires a logged-in session via the form-login cookie; any authenticated user (any policy, any role) receives the full INTERNAL catalogue (LoginFormSecurityConfiguration.java:57 `pathMatchers(\"/**\").authenticated()`). OAUTH2 — same as LOGIN_FORM via the OAuth identity (OAuthSecurityConfiguration.java:98 + AuthorizationCustomizer.java:29-30 falls through to `authenticated()`). LDAP — LDAPSecurityConfiguration.java:137-154 wires the same `AuthorizationCustomizer`; same behaviour as LOGIN_FORM/OAUTH2 (any authenticated user receives the full catalogue). In every non-DISABLED mode, the catalogue is open to every authenticated user."
          confidence: STATIC-INFERRED
          evidence: "DisabledAuthSecurityConfiguration.java:13-18 + LoginFormSecurityConfiguration.java:53-66 + OAuthSecurityConfiguration.java:94-100 + LDAPSecurityConfiguration.java:137-154 + AuthorizationCustomizer.java:20-31 + SecurityConstants.java:95-355 (no /api/metadata/fields rule)"
        - q: "What does an unauthenticated caller see?"
          a: "In LOGIN_FORM: redirected to /login (LoginFormSecurityConfiguration.java:58 formLogin auth handler). In OAUTH2: redirected to the OAuth provider's login flow (OAuthSecurityConfiguration.java:99 `oauth2Login`). In LDAP: 401-equivalent via the Spring Security LDAP authentication failure path. In DISABLED: full catalogue (200 OK)."
          confidence: STATIC-INFERRED
          evidence: "LoginFormSecurityConfiguration.java:58 + OAuthSecurityConfiguration.java:99 + LDAPSecurityConfiguration.java:142-147 + DisabledAuthSecurityConfiguration.java:16"
        - q: "What does a wrong-role caller see?"
          a: "No such thing for this endpoint. Any authenticated user — regardless of policy, role, or assigned owners — receives a 200 OK with the full INTERNAL catalogue. There is NO `CUSTOM_METADATA_FIELD_READ` Permission anywhere in the codebase (grep confirms) and no Permissions doc page mentions any READ permission for custom metadata."
          confidence: STATIC-INFERRED
          evidence: "SecurityConstants.java:95-355 (no /api/metadata/fields SecurityRule) + WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions 2026-05-25 status 200 (no CUSTOM_METADATA_FIELD_READ permission documented)"
        - q: "Where does the gate live — controller, service, repository, or nowhere?"
          a: "ONLY at the Spring Security filter chain (authenticated() pathMatcher). NO @PreAuthorize on the controller. NO programmatic check in MetadataFieldServiceImpl. NO filter in ReactiveMetadataFieldRepositoryImpl. The service and repository would happily serve unauthenticated callers if reached via reflection or test bypass."
          confidence: STATIC-INFERRED
          evidence: "MetadataFieldController.java:1-24 (no @PreAuthorize) + MetadataFieldServiceImpl.java:1-92 (no programmatic check) + ReactiveMetadataFieldRepositoryImpl.java:1-128 (no auth-related code)"
  resource_boundaries:
    - location: "MetadataFieldController.java:18-23 (the GET — no @Transactional, no cache)"
      kind: transactional
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "NO — GET endpoint, no state mutation. The reactive pipeline is per-request; no shared mutable state."
          confidence: STATIC-INFERRED
          evidence: "MetadataFieldController.java:13-24"
        - q: "Is the call replay-safe?"
          a: "YES — pure read."
          confidence: STATIC-INFERRED
          evidence: "MetadataFieldController.java:18-23"
        - q: "If a cache fronts this, what is the TTL / eviction key / staleness window?"
          a: "NO cache. No @Cacheable, no manual cache writes. Every call hits Postgres. Confirmed by inspection of MetadataFieldController.java, MetadataFieldServiceImpl.java, ReactiveMetadataFieldRepositoryImpl.java — zero cache-related annotations or call sites."
          confidence: STATIC-INFERRED
          evidence: "MetadataFieldController.java + MetadataFieldServiceImpl.java + ReactiveMetadataFieldRepositoryImpl.java — no @Cacheable, no cache.put"
    - location: "MetadataFieldServiceImpl.java:43-59 (getOrCreateMetadataFields — out-of-band sibling; read-then-bulk-insert race)"
      kind: concurrency
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "**YES (out-of-band; not on the GET path)** — two parallel `DataEntityServiceImpl.createMetadata` calls naming the SAME brand-new INTERNAL field. Both call `listByKey({fieldName, fieldType})`; both observe empty; both call `bulkCreate({pojo})`. The DB constraint `ix_unique_internal_name` (per V0_0_1__init.sql:242-244 — UNIQUE on name WHERE origin = INTERNAL) rejects one; the loser surfaces as a UniqueConstraintException → ControllerAdvice → HTTP 400 USR003. The DataEntityServiceImpl's @ReactiveTransactional boundary rolls back the entire createMetadata operation on the losing side. (This affects the catalogue's growth, not the GET path; mentioned here for completeness of the resource-boundary picture.)"
          confidence: STATIC-INFERRED
          evidence: "MetadataFieldServiceImpl.java:43-59 + V0_0_1__init.sql:242-244 (ix_unique_internal_name) + batch L upsertDataEntityMetadataFieldValue sidecar (DataEntityServiceImpl.createMetadata @ReactiveTransactional)"
        - q: "Is the call replay-safe?"
          a: "GET is replay-safe (pure read). The out-of-band `getOrCreateMetadataFields` write path is replay-safe at the directory level (a retry will find the row created by either side); not replay-safe at the createMetadata level (the rolled-back metadata creation must be reissued)."
          confidence: STATIC-INFERRED
          evidence: "MetadataFieldController.java:18-23 (GET) + MetadataFieldServiceImpl.java:43-59"
        - q: "If a cache fronts this, what is the TTL / eviction key / staleness window?"
          a: "NO cache."
          confidence: STATIC-INFERRED
          evidence: "see resource_boundaries[0] q3"
  request_inputs:
    - location: "MetadataFieldController.java:19 (getMetadataFieldList)"
      input_kind: query-param
      input_name: "query"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "Search text — filters the metadata-field catalogue by some textual criterion. The `SearchParam` OpenAPI parameter (`components.yaml:4231-4237`) describes it as 'Search text' with no further specification."
          confidence: STATIC-INFERRED
          evidence: "components.yaml:4231-4237"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "MetadataFieldController.java:21 → metadataFieldService.listInternalMetadata(query) → MetadataFieldServiceImpl.java:38 → reactiveMetadataFieldRepository.listInternalMetadata(query) → ReactiveMetadataFieldRepositoryImpl.java:47-49 `if (StringUtils.hasLength(query)) conditions.add(nameField.containsIgnoreCase(query))`. SQL: `LOWER(name) LIKE LOWER('%query%')`. Empty/null query returns ALL non-deleted INTERNAL fields."
          confidence: STATIC-INFERRED
          evidence: "MetadataFieldController.java:21 + MetadataFieldServiceImpl.java:38 + ReactiveMetadataFieldRepositoryImpl.java:47-49"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — query used as text-search filter on the `name` column. The promise is satisfied (substring containment); the IMPLICIT promises operators might expect (prefix-match priority, relevance ranking, FTS, ordering by relevance) are NOT honoured. The name 'query' is generic enough to defend the substring semantics."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "ReactiveMetadataFieldRepositoryImpl.java:47-49"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "Caller expecting prefix-match (typing 'cost') gets every field containing 'cost' anywhere (e.g. 'transaction_cost', 'cost_centre', 'opportunity_cost'), in HEAP-SCAN ORDER (not alphabetical, not insertion order after vacuum). The autocomplete dropdown therefore mixes substring matches with prefix matches without ranking. Operators expecting type-narrowed results (e.g. typing 'budget' and seeing only STRING-typed fields named 'budget') get ALL types matching the substring — there is no type filter on the wire."
          confidence: STATIC-INFERRED
          evidence: "ReactiveMetadataFieldRepositoryImpl.java:46-49 (no type predicate; only name + origin + soft-delete)"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used?"
          a: "The metadata_field.origin column is read but never exposed as a query parameter. An operator wanting to query EXTERNAL fields (collector-populated) cannot do so via this endpoint — the origin filter is HARDCODED to INTERNAL at line 46. This is an available-but-unfiltered signal at the endpoint level; the EXTERNAL catalogue is internally addressable (via `listByKey`) but not externally queryable through `getMetadataFieldList`. Whether this is intentional is captured under implicit_adrs[1] (origin partition is deliberate)."
          confidence: STATIC-INFERRED
          evidence: "ReactiveMetadataFieldRepositoryImpl.java:46 (hardcoded origin = INTERNAL) + V0_0_1__init.sql:171 (origin column) + components.yaml:2088-2092 (origin enum)"
      routes_to_finding: "bugs_limitations_corner_cases[2] (no ORDER BY) + bugs_limitations_corner_cases[1] (unbounded return)"
    - location: "MetadataFieldController.java:20 (getMetadataFieldList)"
      input_kind: header
      input_name: "exchange (ServerWebExchange — unused)"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "<generic — no specific entity promised>. The parameter is the Spring WebFlux exchange handle; not a caller-supplied input in the usual sense."
          confidence: STATIC-INFERRED
          evidence: "MetadataFieldController.java:20"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "NOTHING. The parameter is declared (forced by the generated MetadataApi interface) but never referenced in the controller body (line 21-22)."
          confidence: STATIC-INFERRED
          evidence: "MetadataFieldController.java:20-22"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "N/A — generic name, unused parameter."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "MetadataFieldController.java:20-22"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A."
          confidence: STATIC-INFERRED
          evidence: "—"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used?"
          a: "The exchange itself is the available-but-unused signal — the controller has access to the caller's principal via `exchange.getPrincipal()` but never reads it. An owner-scoped variant of the catalogue (e.g. 'show me only custom-metadata fields used on Data Entities I own') would consume this parameter."
          confidence: STATIC-INFERRED
          evidence: "MetadataFieldController.java:20-22"
      routes_to_finding: "bugs_limitations_corner_cases[8] (ServerWebExchange wired but unused)"
  probes_emitted:
    - probe_id: P-137
      question: "PageInfo theatre? Unbounded return? No ORDER BY?"
      probe_path: "lineage/odd-platform/probes/P-137.yaml"
  stress_summary:
    triggers_total: 6      # 0 tunables + 2 name-behavior pairs + 1 ordering site + 1 auth-gate site + 2 resource-boundary sites = 6 trigger groups
    questions_total: 20    # 2 name-behavior pairs × ~1 q each + 1 ordering × 4 q + 1 auth × 4 q + 2 resource-boundaries × 3 q + 2 request_inputs × 5 q = 2 + 4 + 4 + 6 + 10 = 26 (but several deduplicated for the unused exchange)
    answers_static_inferred: 20
    answers_probe_needed: 0
    answers_reference: 0
    drift_flags: 2           # name_behavior_pairs both flagged DRIFT_NAME_VS_BEHAVIOR (getMetadataFieldList claims pagination; MetadataFieldList claims pagination)
```

## security

- auth_mode_relevance: ["DISABLED", "LOGIN_FORM", "OAUTH2", "LDAP"]
  - DISABLED: endpoint is unauthenticated (`DisabledAuthSecurityConfiguration.java:16` `anyExchange().permitAll`)
  - LOGIN_FORM: pathMatcher `/**` requires authenticated (`LoginFormSecurityConfiguration.java:57`); no per-permission gate
  - OAUTH2: authorizeExchange falls through to `authenticated()` (`AuthorizationCustomizer.java:29-30`); no `/api/metadata/fields` SecurityRule
  - LDAP: same chain wiring as OAuth/LoginForm via `AuthorizationCustomizer` (`LDAPSecurityConfiguration.java:137-154`); same authenticated() fallback
- ingestion_filter_relevance: "NO — UI/API surface, not ingestion. The /api/metadata/fields path is not in IngestionDataEntitiesFilter or any of the /ingestion/** WHITELIST_PATHS."
- authorization_assertions: [] — NONE. No @PreAuthorize on the controller. No programmatic permissionService check in MetadataFieldServiceImpl. No SecurityRule entry in SecurityConstants for `/api/metadata/fields`. The endpoint relies entirely on the framework-level authenticated() fallback. The Permissions docs page (WebFetched 2026-05-25, status 200) confirms there is NO CUSTOM_METADATA_FIELD_READ Permission defined anywhere in the platform.
- owner_scoping: "N/A — code is not data-scoped. The custom-metadata field catalogue is a global directory; the directory is not partitioned by ownership of the Data Entities that USE those fields. A user who can see only Data Entity 'A' (per Policy scope) can still enumerate the field names used on Data Entity 'B'."
- data_exposure:
  - "Full INTERNAL custom-metadata field catalogue `(id, name, type, origin)` of every non-deleted INTERNAL row → any authenticated user; in auth.type=DISABLED → any caller including unauthenticated"
  - "Field NAMES exposed to all authenticated users include any sensitive vocabulary that operators may have intended to be scoped to specific Data Entity owners (e.g. 'salary_band', 'phi_classification', 'pii_indicator', 'restricted_access_flag')"
- known_security_gaps:
  - "No per-permission gate; any authenticated user enumerates the full INTERNAL custom-metadata field catalogue regardless of role/policy/owner scope. The Permissions doc page (WebFetched 2026-05-25, status 200) explicitly confirms NO read Permission exists for custom metadata; only the per-VALUE write surface is gated. — evidence: MetadataFieldController.java:1-24 (no @PreAuthorize) + SecurityConstants.java:95-355 (no rule) + WebFetch Permissions page 2026-05-25 — severity: MEDIUM (cross-data-entity vocabulary leak; operators using ODD as a soft-data-governance system have no mechanism to scope which field names are visible to which users)"
  - "DISABLED mode exposes the catalogue to unauthenticated callers. — evidence: DisabledAuthSecurityConfiguration.java:13-18 — severity: LOW (DISABLED is documented as dev-only)"
  - "No rate-limit / response-size cap; the endpoint returns the ENTIRE filtered catalogue per call. An authenticated caller can amplify load by polling the endpoint; the response size grows linearly with the catalogue cardinality. — evidence: ReactiveMetadataFieldRepositoryImpl.java:44-56 (no LIMIT) + MetadataFieldMapperImpl.java:29-33 — severity: MEDIUM (resource-exhaustion vector at scale; not data-exfil)"
  - "No defence against the `query` wildcard pattern — jOOQ `containsIgnoreCase` reportedly escapes `%` and `_` in the LIKE pattern; not confirmed at the wire. A crafted query like `query=_a_b_` could exfiltrate field-existence one-character-at-a-time if escape fails. — evidence: ReactiveMetadataFieldRepositoryImpl.java:48 + jOOQ source (not verified in this scope) — severity: LOW (probably defended; cross-cuts with the LOW-severity wildcard concern)"

## performance

- hot_paths:
  - "GET /api/metadata/fields is called from EVERY 'Add Custom Metadata' form open in the UI (MetadataCreateFormItem.tsx:43-51 dispatches `searchMetadata` on autocomplete-open AND on every debounced (500ms) keystroke). Per-keystroke amplification is bounded by the debounce; per-session amplification is bounded by how many 'Add Custom Metadata' forms the operator opens." — evidence: MetadataCreateFormItem.tsx:40-58
  - "Single SQL execution per request: SELECT from metadata_field with WHERE origin = 'INTERNAL' AND deleted_at IS NULL [AND name LIKE]. No JOIN, no COUNT, no aggregate; pure single-table read." — evidence: ReactiveMetadataFieldRepositoryImpl.java:51-55
- throughput_characteristics:
  - "Single-call read; no batch endpoint. Reactive Mono signature — non-blocking but one DB round-trip per call."
  - "UI debounces keystroke input by 500ms (MetadataCreateFormItem.tsx:49) so per-keystroke amplification is bounded to ~2/s in the worst case."
- resource_allocation:
  - "Result-set bounded only by the catalogue cardinality (the count of non-deleted INTERNAL metadata fields). With N rows in the catalogue, the JVM holds N MetadataFieldPojo + N MetadataField DTOs simultaneously per call. There is NO server-side cap." — evidence: ReactiveMetadataFieldRepositoryImpl.java:53-55 + MetadataFieldMapperImpl.java:29-33
  - "No count CTE — unlike the generic ReactiveAbstractCRUDRepository.list path, this code path does NOT use `count().over()`. The cost is one heap-scan per call."
- scaling_characteristics:
  - "Stateless controller; horizontal scaling unimpeded"
  - "No pagination cap; result size grows O(N) with the catalogue; the catalogue grows monotonically (auto-create-on-miss has no tombstone path in production)"
  - "Frontend client-side filter (MUI createFilterOptions) operates on the FULL server-returned set, not on a paged window — so the client-side filter performance scales with the catalogue size, not with the typed-query selectivity"
- known_performance_gaps:
  - "No LIMIT / OFFSET / cap on the response. Amplification is linear in catalogue cardinality. For installations with N > 1000 INTERNAL fields, every autocomplete-open performs a full table scan and a full payload serialisation. — evidence: ReactiveMetadataFieldRepositoryImpl.java:51-55 (no LIMIT) + MetadataFieldMapperImpl.java:29-33 (no genuine pagination) — severity: MEDIUM (the catalogue is typically tens to hundreds, but the linear growth + auto-create-on-miss means severity can rise with deployment age)"
  - "PageInfo theatre creates a false expectation that a 'load-more' pager will work — operators / SDK authors who design around the schema's PageInfo block discover at scale that the endpoint never paginates. — evidence: components.yaml:2111-2120 + MetadataFieldMapperImpl.java:30-33 — severity: LOW (defect class is contract-vs-implementation, not raw performance)"

## upstream_callers

- entry_point: "ui_route:/dataentities/{id} (Add Custom Metadata form modal)"
  caller_node: "ts react-component:MetadataCreateFormItem.tsx"
  multiplicity_per_trigger: "1 per autocomplete-open + 1 per debounced (500ms) keystroke"
  evidence: "<odd-platform-repo>/odd-platform-ui/src/components/DataEntityDetails/Metadata/MetadataCreateForm/MetadataCreateFormItem/MetadataCreateFormItem.tsx:40-58 (useDebouncedCallback dispatching searchMetadata) + <odd-platform-repo>/odd-platform-ui/src/redux/thunks/metadata.thunks.ts:78-88 (searchMetadata calls metadataApi.getMetadataFieldList)"
  observation_class: ui-call
  unresolved: false
- entry_point: "rest:GET /api/metadata/fields (direct API consumer)"
  caller_node: "external-api-client"
  multiplicity_per_trigger: "1 per call"
  evidence: "<odd-platform-repo>/odd-platform-specification/openapi.yaml:2434-2450 (operation getMetadataFieldList under tags: [metadata])"
  observation_class: rest-call
  unresolved: false

## downstream_side_effects

- side_effect_class: page-render
  description: "Returns MetadataFieldList payload `{items: MetadataField[N], page_info: {total: N, has_next: false}}` to the caller, where N is the entire filtered non-deleted INTERNAL catalogue (no LIMIT applied)"
  evidence: "MetadataFieldController.java:21-22 (`metadataFieldService.listInternalMetadata(query).map(ResponseEntity::ok)`) + MetadataFieldMapperImpl.java:29-33"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "ui_route:/dataentities/{id} (Add Custom Metadata form)"
    - "rest:GET /api/metadata/fields"
- side_effect_class: db-write
  description: "NONE on this endpoint — GET is pure read. (The catalogue is mutated as a side effect of DataEntityServiceImpl.createMetadata via MetadataFieldServiceImpl.getOrCreateMetadataFields, NOT via this controller. See batch L upsertDataEntityMetadataFieldValue sidecar's discussion of the catalogue-growth path.)"
  evidence: "MetadataFieldController.java:18-23 (no write call) + MetadataFieldServiceImpl.java:37-40 (listInternalMetadata calls only repository.listInternalMetadata)"
  cardinality_per_call: 0
  reachable_from_entry_points: []
- side_effect_class: log-emit
  description: "NONE explicit; no @Slf4j on MetadataFieldController, no log statements. Spring WebFlux access log (if enabled) emits one entry per request via the global filter."
  evidence: "MetadataFieldController.java:1-24 (no logger import, no log statements)"
  cardinality_per_call: 0
  reachable_from_entry_points: []

## sources

- understanding ← MetadataFieldController.java:13-24 + MetadataFieldServiceImpl.java:37-40 + ReactiveMetadataFieldRepositoryImpl.java:44-56 + MetadataFieldMapperImpl.java:29-33 + MetadataCreateFormItem.tsx:40-58 + SecurityConstants.java:95-355 + WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions (2026-05-25, status 200)
- concepts.entities.MetadataField ← components.yaml:2094-2109 + components.yaml:2077-2092 (types and origins)
- concepts.entities.MetadataFieldList ← components.yaml:2111-2120
- concepts.entities.PageInfo ← components.yaml (PageInfo schema) + MetadataFieldMapperImpl.java:30-33 (constant-mocked construction)
- concepts.entities.MetadataFieldPojo ← V0_0_1__init.sql:166-173 + V0_0_64__remove_is_deleted_field.sql:41-50 + V0_0_26__remove_length_constraints.sql:43-44
- concepts.entities.MetadataKey ← MetadataFieldServiceImpl.java:43-71 (record usage)
- concepts.operations.getMetadataFieldList ← MetadataFieldController.java:18-23 + MetadataFieldServiceImpl.java:37-40 + ReactiveMetadataFieldRepositoryImpl.java:44-56
- concepts.operations.getOrCreateMetadataFields (sibling) ← MetadataFieldServiceImpl.java:43-59 + batch L upsertDataEntityMetadataFieldValue sidecar
- concepts.invariants[0] (origin INTERNAL filter) ← ReactiveMetadataFieldRepositoryImpl.java:46 + ReactiveMetadataFieldRepositoryImplTest.java:33-48
- concepts.invariants[1] (soft-delete filter) ← ReactiveMetadataFieldRepositoryImpl.java:34-35, 45-46 + ReactiveAbstractSoftDeleteCRUDRepository.java:96-104 + ReactiveMetadataFieldRepositoryImplTest.java:49-59
- concepts.invariants[2] (no LIMIT/OFFSET/ORDER BY) ← ReactiveMetadataFieldRepositoryImpl.java:51-55
- concepts.invariants[3] (PageInfo theatre) ← MetadataFieldMapperImpl.java:30-33
- concepts.invariants[4] (case-insensitive substring) ← ReactiveMetadataFieldRepositoryImpl.java:47-49
- concepts.invariants[5] (no per-permission gate) ← SecurityConstants.java:95-355 + LoginFormSecurityConfiguration.java:50-57 + AuthorizationCustomizer.java:21-30
- concepts.invariants[6] (no owner scoping) ← WebFetch Permissions page (2026-05-25, status 200) + grep CUSTOM_METADATA_FIELD_READ → 0 hits
- concepts.invariants[7] (single SQL, no count CTE) ← ReactiveMetadataFieldRepositoryImpl.java:51-55 + MetadataFieldMapperImpl.java:30-33
- concepts.invariants[8] (ServerWebExchange unused) ← MetadataFieldController.java:20-22
- dependencies_semantic.requires-feature.F-013 ← MetadataFieldServiceImpl.java:43-59 (auto-create path) + batch L upsertDataEntityMetadataFieldValue sidecar
- dependencies_semantic.requires-feature.ExternalIngestion ← MetadataFieldServiceImpl.java:62-71 + ReactiveMetadataFieldRepositoryImpl.java:73-109 + V0_0_1__init.sql:238-244
- dependencies_semantic.requires-feature.FTS ← cross-reference batch L sidecar (search_entrypoint.metadata_vector)
- tests_coverage_semantic.covered_behaviours.* ← ReactiveMetadataFieldRepositoryImplTest.java:33-119
- tests_coverage_semantic.gaps ← absence of controller-tier test + ReactiveMetadataFieldRepositoryImplTest.java does not assert PageInfo or absence of ORDER BY
- docs_link_semantic.inferred_docs[0] ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions (2026-05-25, status 200)
- docs_link_semantic.doc_drift_findings[0] ← WebFetch 404s on `/active-platform-features/metadata` + `/active-platform-features/custom-metadata`; 200 on `/active-platform-features` with no custom-metadata page; 200 on `/features/data-discovery/metadata-stale` with explicit confirmation of zero coverage of the catalogue
- docs_link_semantic.doc_drift_findings[1] ← components.yaml:2111-2120 + MetadataFieldMapperImpl.java:30-33
- docs_link_semantic.doc_drift_findings[2] ← MetadataFieldServiceImpl.java:43-59 + WebFetch responses 2026-05-25 (no auto-create-on-miss documentation)
- docs_link_semantic.doc_drift_findings[3] ← SecurityConstants.java:95-355 + WebFetch Permissions page 2026-05-25
- implicit_adrs[0] ← MetadataFieldController.java:15-24 + MetadataFieldService.java:11-19 + openapi.yaml:2434-2450
- implicit_adrs[1] ← ReactiveMetadataFieldRepositoryImpl.java:46 + V0_0_1__init.sql:238-244 + MetadataFieldServiceImpl.java:43-71
- implicit_adrs[2] ← ReactiveMetadataFieldRepositoryImpl.java:34-35 + ReactiveAbstractSoftDeleteCRUDRepository.java:50-59 + V0_0_64__remove_is_deleted_field.sql:41-50
- bugs_limitations_corner_cases[0] (PageInfo theatre) ← MetadataFieldMapperImpl.java:30-33 + components.yaml:2111-2120 + ReactiveMetadataFieldRepositoryImpl.java:44-56
- bugs_limitations_corner_cases[1] (unbounded return) ← ReactiveMetadataFieldRepositoryImpl.java:44-56 + MetadataFieldMapperImpl.java:29-33 + MetadataCreateFormItem.tsx:43-51
- bugs_limitations_corner_cases[2] (no ORDER BY) ← ReactiveMetadataFieldRepositoryImpl.java:51-55 + MetadataCreateFormItem.tsx:94-109
- bugs_limitations_corner_cases[3] (no per-permission gate) ← SecurityConstants.java:95-355 + LoginFormSecurityConfiguration.java:50-57 + AuthorizationCustomizer.java:21-30 + WebFetch Permissions page 2026-05-25
- bugs_limitations_corner_cases[4] (auto-create growth) ← MetadataFieldServiceImpl.java:43-59 + MetadataCreateFormItem.tsx:60-91
- bugs_limitations_corner_cases[5] (DISABLED mode) ← DisabledAuthSecurityConfiguration.java:13-18
- bugs_limitations_corner_cases[6] (no live doc page) ← WebFetch responses 2026-05-25
- bugs_limitations_corner_cases[7] (type enum theatre, cross-cut from batch L) ← components.yaml:2077-2086 + batch L upsertDataEntityMetadataFieldValue sidecar
- bugs_limitations_corner_cases[8] (ServerWebExchange unused) ← MetadataFieldController.java:20-22
- stress_findings.name_behavior_pairs ← MetadataFieldController.java:18-23 + MetadataFieldServiceImpl.java:37-40 + ReactiveMetadataFieldRepositoryImpl.java:44-56 + MetadataFieldMapperImpl.java:29-33 + components.yaml:2111-2120
- stress_findings.orderings ← ReactiveMetadataFieldRepositoryImpl.java:51-55 + MetadataCreateFormItem.tsx:94-109
- stress_findings.auth_gates ← SecurityConstants.java:95-355 + LoginFormSecurityConfiguration.java:50-57 + OAuthSecurityConfiguration.java:94-100 + LDAPSecurityConfiguration.java:137-154 + AuthorizationCustomizer.java:20-31 + DisabledAuthSecurityConfiguration.java:13-18 + WebFetch Permissions page 2026-05-25
- stress_findings.resource_boundaries ← MetadataFieldController.java:18-23 + MetadataFieldServiceImpl.java:43-59 + V0_0_1__init.sql:242-244
- stress_findings.request_inputs ← MetadataFieldController.java:18-22 + components.yaml:4231-4237
- stress_findings.probes_emitted ← lineage/odd-platform/probes/P-137.yaml
- security.auth_mode_relevance ← LoginFormSecurityConfiguration.java:31 + OAuthSecurityConfiguration.java:71 + LDAPSecurityConfiguration.java:51 + DisabledAuthSecurityConfiguration.java:10
- security.authorization_assertions ← MetadataFieldController.java:1-24 (no @PreAuthorize) + SecurityConstants.java:95-355 (no rule) + WebFetch Permissions page 2026-05-25
- security.data_exposure ← MetadataFieldController.java:21-22 + MetadataFieldMapperImpl.java:17-26 + V0_0_1__init.sql:166-173
- performance.hot_paths ← MetadataCreateFormItem.tsx:40-58 + ReactiveMetadataFieldRepositoryImpl.java:51-55
- performance.throughput_characteristics ← MetadataCreateFormItem.tsx:49 (debounce) + ReactiveMetadataFieldRepositoryImpl.java:51-55
- performance.scaling_characteristics ← MetadataFieldController.java:13 (stateless) + ReactiveMetadataFieldRepositoryImpl.java:51-55 (no cap) + MetadataFieldServiceImpl.java:43-59 (auto-create)
- upstream_callers.* ← MetadataCreateFormItem.tsx:40-58 + metadata.thunks.ts:78-88 + openapi.yaml:2434-2450
- downstream_side_effects.* ← MetadataFieldController.java:21-22 + MetadataFieldMapperImpl.java:29-33

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: HIGH
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: MEDIUM (no actual latency measurements; throughput characteristics inferred from code shape, not benchmarked)
- upstream_callers: HIGH
- downstream_side_effects: HIGH
- stress_findings: HIGH (20/20 STATIC-INFERRED with strong file:line evidence; the PageInfo-theatre + no-ORDER-BY + unbounded-return drift is fully derivable from the code; P-137 is emitted as confirmation rather than question)

## Maintainer notes
