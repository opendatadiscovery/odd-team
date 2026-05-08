---
node_id: "odd-platform openapi tags openapi-tag:dataEntity"
node_kind: openapi-tag
axis: openapi_tags
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.1.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-08-01
---

# openapi-tag:dataEntity — semantic understanding

## understanding

The `dataEntity` tag is the largest grouping in the platform OpenAPI contract,
covering 40 operations on the canonical `Data Entity` concept (the platform's
unit of metadata — datasets, transformers, consumers, quality tests, groups, and
inputs). The tag spans full CRUD plus relationship management: read paths
(details, my-objects, popular, group children, lineage upstream/downstream,
alerts, runs, activity, messages, channels, metadata, attachments), mutation
paths (description / name / status updates, term linking, tag relations,
metadata field values, ownership lifecycle, alert config), and DataEntityGroup
lifecycle (`createDataEntityGroup`, `updateDataEntityGroup`, group lineage,
domain enumeration). All operations are exposed by a single
`DataEntityController` that implements the generated `DataEntityApi` interface
derived from these spec entries; spec-side this is the contract surface, and
authorization, owner-scoping, pagination defaults, and lineage-depth limits
live entirely in the consumer code, not in the spec.

## concepts

- entities: ["Data Entity", "DataEntityGroup", "DataEntityRef", "DataEntityDetails", "DataEntityLineage", "DataEntityLineageStream", "DataEntityLineageNode", "DataEntityLineageEdge", "Ownership", "MetadataFieldValue", "InternalDescription", "InternalName", "DataEntityAlertConfig", "Tag", "LinkedTerm", "QueryExample", "DataEntityDomain", "Activity", "MessageList", "MetricSet"]
- operations: ["get-data-entity-details", "list-my-objects", "list-my-objects-with-upstream", "list-my-objects-with-downstream", "list-popular", "get-classes-dictionary", "upsert-internal-description", "upsert-internal-name", "add-term", "delete-term", "add-query-example-relationship", "delete-query-example-relationship", "update-status", "add-to-group", "remove-from-group", "create-ownership", "update-ownership", "delete-ownership", "create-tags-relations", "create-metadata-field-value", "upsert-metadata-field-value", "delete-metadata-field-value", "get-upstream-lineage", "get-downstream-lineage", "list-alerts", "get-alerts-counts", "get-activity", "list-messages", "get-messages", "list-channels", "get-alert-config", "update-alert-config", "get-metrics", "get-usage", "list-domains", "list-group-children", "list-group-items", "create-group", "update-group", "get-group-lineage"]
- invariants: ["Data Entity ID is a path-level int64", "lineage_depth has minimum=1 (no maximum)", "PageParam/SizeParam are required int32 with no min/max/default", "all 40 operations live under /api/dataentities or /api/dataentitygroups", "no operation declares its own security: block; spec inherits no top-level security either"]
- audiences: ["UI client (catalog browsing, ownership, descriptions, lineage rendering)", "platform integrations writing back metadata (terms, tags, alert config)", "operators inspecting alerts/runs/activity for a Data Entity"]

## dependencies_semantic

- requires-feature: ["Data Discovery (Data Entity model)", "Lineage", "Ownership model", "Activity Log", "Alerts", "Tags & Terms", "Metadata fields", "DataEntityGroup / Domains", "Data Collaboration (messages/channels)"]
- requires-config: ["auth.type (DISABLED | LOGIN_FORM | OAUTH2 | LDAP) — selects which Spring Security wiring protects this surface", "auth.ingestion.filter.enabled — does not gate this tag's endpoints (this tag is the UI/API surface, NOT /ingestion/entities), but operators conflating the two would think they have it covered"]
- requires-runtime: ["DataEntityController bean (odd-platform-api)", "generated DataEntityApi interface from this spec", "Spring Security filter chain (authorization is wired post-hoc — not declared in the spec)"]

## tests_coverage_semantic

- covered_behaviours: ["spec-level: structural correctness via openapi-generator codegen on every build (build fails if spec is malformed)"]
- uncovered_behaviours: ["spec does not assert auth requirements per operation — no codegen-side enforcement of authorization", "spec does not assert pagination bounds — no codegen-side enforcement of size limits", "spec does not bound lineage_depth — codegen accepts any positive int32"]
- test_files: ["N/A — this is the spec surface, not a code unit; runtime coverage lives at DataEntityController integration-test layer in odd-platform-api/src/test/java"]
- gaps: |
    The spec is a contract that says nothing about access control, pagination
    safety, or response-size bounds. Any regression where a maintainer wires a
    new endpoint without setting an authorization gate, without enforcing a
    size cap, or without bounding lineage depth will pass openapi-generator
    codegen and pass any contract test that checks only shape. The substrate
    cannot detect "endpoint X is now publicly readable" from the spec alone;
    that finding requires walking the controller + service + Spring Security
    config. This is the structural gap that LSN-002 / LSN-001-style bugs
    exploit.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/main-concepts"
    anchor: "(no anchor — Data Entity is the canonical term; main-concepts is its conceptual home)"
    rationale: "main-concepts.md is the canonical glossary for ODD vocabulary including 'Data Entity'; the dataEntity tag operates on this concept by name"
    last_verified_at: "2026-05-08T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
    fetched_excerpts: |
      WebFetch returned a stub page that links to "Data Entity Attachments"
      but did not render the canonical definition in the response. The page
      exists (200) but the live response did not surface the canonical
      "Data Entity" definition; either the page is JS-rendered and the
      WebFetch summariser missed the body, or the canonical glossary entry
      lives elsewhere. Doc-drift candidate for the concept-merger pass.
  - url: "https://docs.opendatadiscovery.org/developer-guides/api-reference"
    anchor: "(none — page is the API reference index)"
    rationale: "api-reference is the documented entry-point for the platform's HTTP API; the dataEntity tag covers ~40 of those operations"
    last_verified_at: "2026-05-08T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
    fetched_excerpts: |
      Live page returned: "this page does not contain specific information
      about data entity APIs or /api/dataentities/* endpoints. The page
      lists feature areas with links to sub-pages... but there is no
      dedicated section discussing data entity endpoints." The page directs
      readers to check Swagger UI at `{platform-base-url}/api/v3/api-docs`.
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security"
    anchor: "(none — page covers the four auth modes that protect this surface)"
    rationale: "the four auth modes (DISABLED / LOGIN_FORM / OAUTH2 / LDAP) gate every operation in this tag — relevant for the security section below"
    last_verified_at: "2026-05-08T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      "Supported Authentication Modes: DISABLED, LOGIN_FORM, OAUTH2, LDAP."
      "auth.ingestion.filter.enabled defaults to false. With the default in
      place and the platform reachable on the network, any caller who can
      speak the ingress API can POST /ingestion/entities with a spec-valid
      DataEntityList." (Note: ingestion filter does NOT apply to this tag's
      /api/dataentities/* endpoints; documenting this here so the substrate
      records the negative scope.)
- doc_drift_findings:
  - "developer-guides/api-reference does not list any of the 40 dataEntity-tag operations; readers are punted to a Swagger UI URL — large gap between contract and rendered docs"
  - "main-concepts page WebFetch did not surface the canonical 'Data Entity' definition in the live response; either rendering issue or the term's authoritative definition lives off-page"

## implicit_adrs

- "OpenAPI spec contains no top-level security: block and no per-operation security: override; authorization is wired entirely in Spring Security configuration on the consumer side, not declared in the contract" — evidence: openapi.yaml:1-50 (no security:), openapi.yaml:805-2433 (no per-operation security: under any dataEntity-tag block) — confidence: HIGH
- "Pagination parameters (PageParam, SizeParam) are int32 with no min/max/default — page size is at the caller's discretion; backend defends" — evidence: components.yaml:4213-4229 — confidence: HIGH
- "Lineage depth is a non-required int32 with minimum=1 and no maximum — deep-graph response size is bounded by backend service code, not the contract" — evidence: openapi.yaml:1260-1276 (upstream), openapi.yaml:1294-1310 (downstream) — confidence: HIGH
- "Data Entity controllers expose owner-scoped operations (`/my`, `/my/upstream`, `/my/downstream`) as separate endpoints rather than as a query-parameter overlay on the cross-tenant list — implies the platform models 'my objects' as a first-class navigation surface" — evidence: openapi.yaml:823-875 — confidence: HIGH
- "DELETE on `/api/dataentities/{id}/ownership/{ownership_id}` accepts a `propagate` query parameter — implies ownership has a graph-propagation semantics worth surfacing in user docs" — evidence: openapi.yaml:1153-1167 — confidence: MEDIUM
- "Single tag carries 40 heterogeneous operations spanning CRUD, relationships, lineage, alerts, activity, and messaging — operationally a 'mega-tag'; UI-side cohesion does not match domain decomposition (alerts could live under `alert`, activity under `activity`, lineage under a dedicated `lineage` tag)" — evidence: openapi.yaml:13-48 (tag list shows separate `alert`, `activity` tags), openapi.yaml:805-2433 (dataEntity tag covers all of those for the Data Entity scope) — confidence: MEDIUM

## bugs_limitations_corner_cases

- "lineage_depth has no maximum — a caller passing a large depth (e.g. 100) on a deeply-connected Data Entity can produce an unbounded DataEntityLineage response (nodes/edges/groups arrays are also unbounded in DataEntityLineageStream)" — evidence: openapi.yaml:1260-1276 + components.yaml:2033-2065 — severity: HIGH
- "Page and Size are required int32 with no min/max — a caller passing `size=2147483647` will be accepted at codegen layer; protection (if any) is in the controller/service" — evidence: components.yaml:4213-4229 + openapi.yaml:828-866 (every list operation references these unconstrained params) — severity: MEDIUM
- "DataEntityGroup lineage endpoint (`/api/dataentitygroups/{id}/lineage`) accepts no depth parameter at all — response size depends solely on group membership at runtime, with no caller-side or contract-side bound" — evidence: openapi.yaml:2418-2433 — severity: MEDIUM
- "Activity endpoint requires begin_date and end_date but allows arbitrary range; combined with no-max SizeParam this is an unbounded scan over activity history" — evidence: openapi.yaml:1387-1438 — severity: MEDIUM
- "developer-guides/api-reference doc page exists but does not enumerate any dataEntity-tag operation — operators reading the docs are silently redirected to the Swagger UI; doc and contract drift in opposite directions" — evidence: WebFetch 2026-05-08 status 200 (api-reference response excerpt above) — severity: MEDIUM

## security

- **auth_mode_relevance**: `LOGIN_FORM | OAUTH2 | LDAP` — the three modes that protect the platform's UI/API surface per `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security`. `DISABLED` removes auth entirely (dev-only per docs). `S2S` does NOT apply to this tag — it gates only `/ingestion/entities`, not `/api/dataentities/*`. — evidence: openapi.yaml has no `security:` block (lines 1-50, lines 805-2433); auth-mode wiring lives in Spring Security configuration on consumer side, not in the contract.
- **ingestion_filter_relevance**: `NO — UI/API surface, not ingestion`. The 40 operations all live under `/api/dataentities` or `/api/dataentitygroups`; the `IngestionDataEntitiesFilter` matches only `POST /ingestion/entities`. Operators turning on `auth.ingestion.filter.enabled` to "secure the API" are not protecting these 40 operations. — evidence: openapi.yaml:805-2433 (all paths) + enable-security live page (ingestion filter scope).
- **authorization_assertions**: `[]` at the spec layer — the OpenAPI contract declares NO `security:` block (top-level OR per-operation), so codegen produces no Spring Security annotations from the spec. Authorization is enforced post-hoc by Spring Security configuration, controller-level annotations on the consumer (e.g. `@PreAuthorize`), aspects, or service-layer policy checks. — evidence: openapi.yaml:1-50 (no top-level `security:`), openapi.yaml:805-2433 (no per-operation `security:` under any dataEntity-tag entry).
- **owner_scoping**: The spec exposes both owner-scoped (`/api/dataentities/my`, `/my/upstream`, `/my/downstream`) and cross-tenant operations (`/api/dataentities/popular`, `/api/dataentities/{id}/...`) as separate endpoints. The contract does NOT declare which endpoints respect ownership and which bypass it; that's a consumer-code property. The `/my*` paths are owner-scoped by name, but a reader cannot assert from the spec alone whether `/popular` filters by current-user owners or returns global popularity. — evidence: openapi.yaml:823-893.
- **data_exposure**:
  - "Data Entity details (incl. metadata, internal description, internal name, ownership, alerts, runs, activity, lineage, messages) → any authenticated user under LOGIN_FORM/OAUTH2/LDAP, owner-scoping not declared in spec"
  - "Internal description / internal name / status mutation → any authenticated caller able to reach the endpoint; the contract does not gate write access by role/permission"
  - "Ownership create/update/delete (with propagate=true on delete) → any authenticated caller; permission/role gating is on the consumer, not the contract"
  - "DataEntityAlertConfig PUT (changes alert behaviour for a Data Entity) → any authenticated caller; same gap as above"
- **known_security_gaps**:
  - "spec declares zero authentication requirements — a copy-pasted spec would generate clients with no security wiring; integrators relying on spec-driven generation must add auth out-of-band" — evidence: openapi.yaml:1-50 + openapi.yaml:805-2433 — severity: MEDIUM
  - "40 operations including write/delete on description, name, status, ownership, alert config, tags, terms, metadata, group membership share zero declared authorization gates at the contract — any spec-only audit would conclude these are public" — evidence: openapi.yaml:805-2433 — severity: MEDIUM
  - "ownership DELETE accepts `propagate=true`, a graph-cascading destructive action, with no `security:` block on the operation — in a misconfigured deployment with `auth.type=DISABLED` this is unauthenticated cascade-deletion of ownership records" — evidence: openapi.yaml:1153-1167 — severity: HIGH
  - "DataEntityAlertConfig PUT (mutates alerting behaviour for a Data Entity, e.g. could disable alerts for a critical pipeline) has no contract-level authorization assertion; relies entirely on consumer-side Spring Security wiring" — evidence: openapi.yaml:1529-1548 — severity: MEDIUM
  - "developer-guides/api-reference live doc page does not enumerate the dataEntity operations; operators reading docs cannot tell from documentation alone which operations are admin vs general-user — they must run Swagger UI against a live deployment to find out" — evidence: WebFetch 2026-05-08 status 200 (api-reference response above) — severity: MEDIUM

## performance

- **hot_paths**:
  - "list endpoints (/popular, /my, /my/upstream, /my/downstream, /alerts, /runs, /activity, /messages, group children, group items) all run synchronously on user navigation — every catalog page render hits at least one of these" — evidence: openapi.yaml:823-893 + openapi.yaml:1321-1463 + openapi.yaml:2335-2372
  - "lineage upstream/downstream endpoints render the lineage UI graph — invoked on every Data Entity detail page that exposes lineage; depth is caller-controlled with minimum=1 and no maximum" — evidence: openapi.yaml:1253-1319
  - "DataEntityGroup lineage (`/api/dataentitygroups/{id}/lineage`) traverses an entire group's child set with no depth parameter at all" — evidence: openapi.yaml:2418-2433
- **throughput_characteristics**:
  - "single-Data-Entity scope per write operation — no bulk update endpoint for description / name / status / metadata / ownership / tags; UI must issue N requests for N edits" — evidence: openapi.yaml:927-1251 (every PUT/POST/DELETE is `{data_entity_id}` scoped)
  - "no streaming / pagination on lineage responses — full graph returned in one DataEntityLineage payload" — evidence: components.yaml:2033-2065 (DataEntityLineageStream nodes/edges/groups arrays unbounded)
  - "activity endpoint accepts begin_date + end_date with no spec-side range cap — single request can request years of history" — evidence: openapi.yaml:1387-1426
- **resource_allocation**:
  - "DataEntityLineage response is materialised in full on the server — `nodes`, `edges`, and `groups` arrays in DataEntityLineageStream have no `maxItems` constraint, so memory consumption scales with graph size at the runtime-configured depth" — evidence: components.yaml:2033-2065
  - "DataEntityGroup lineage uses DataEntityGroupLineageList (array of DataEntityLineageStream) — N streams in one response, each with unbounded nodes/edges/groups, scaling with group cardinality" — evidence: components.yaml:2067-2075
- **scaling_characteristics**:
  - "Page/Size pagination params are required but unconstrained (int32, no min/max/default) — caller can request `size=Integer.MAX_VALUE`; backend defends or doesn't, but the contract does not" — evidence: components.yaml:4213-4229
  - "lineage_depth optional with minimum=1, NO maximum — `lineage_depth=100` is contract-valid; backend cap (if any) is invisible to clients" — evidence: openapi.yaml:1260-1276
  - "no rate-limit headers, no `429` response definitions, no `X-RateLimit-*` extensions anywhere in the spec" — evidence: openapi.yaml:805-2433 (no `429:` response in any dataEntity-tag operation)
  - "stateless from spec perspective — no session/cookie tokens declared; controllers expected to scale horizontally per Spring Security session backing" — evidence: openapi.yaml has no `security:` block declaring session schemes (lines 1-50)
- **known_performance_gaps**:
  - "lineage_depth unbounded at the contract — a single request with high depth on a connected Data Entity can produce a multi-MB DataEntityLineage payload, both expensive to compute and to transfer" — evidence: openapi.yaml:1260-1276 + components.yaml:2033-2065 — severity: HIGH
  - "DataEntityGroupLineageList has no depth parameter and no `maxItems` on the outer `items` array — large groups produce response sizes proportional to group membership × per-stream graph size" — evidence: openapi.yaml:2418-2433 + components.yaml:2067-2075 — severity: HIGH
  - "no spec-declared rate limiting (no `429` response, no `Retry-After` header schema) — every list operation is a candidate for accidental DoS via small page-size + concurrent UI tabs" — evidence: openapi.yaml:805-2433 — severity: MEDIUM
  - "PageParam/SizeParam unconstrained — `size=2147483647` is contract-valid, deferring all defence to consumer code (DataEntityController + service layer) — substrate cannot tell from spec whether that defence exists" — evidence: components.yaml:4213-4229 + openapi.yaml:823-893 — severity: MEDIUM
  - "no `If-Modified-Since` / `ETag` headers on read endpoints — every Data Entity detail render is a full payload fetch with no cache-coordination mechanism declared" — evidence: openapi.yaml:910-925 (getDataEntityDetails has no cache headers in responses) — severity: LOW

## sources

- understanding ← openapi.yaml:805-2433 (40 operations under dataEntity tag) + openapi.yaml:13-48 (tag block declaration)
- concepts.entities ← openapi.yaml:805-2433 (response schema $refs) + components.yaml:925-2075 (schema definitions for DataEntityRefList, DataEntityList, DataEntityLineage, DataEntityLineageStream, DataEntityLineageNode)
- concepts.invariants ← openapi.yaml:1260-1276 (lineage_depth minimum=1 no maximum) + components.yaml:4213-4229 (PageParam/SizeParam unconstrained)
- dependencies_semantic.requires-config ← https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security WebFetch 2026-05-08 status 200 (auth.type modes, auth.ingestion.filter.enabled scope)
- tests_coverage_semantic.gaps ← openapi.yaml:1-50 (no security: block) + openapi.yaml:805-2433 (no per-operation security:)
- docs_link_semantic.inferred_docs.[0..2] ← WebFetch results 2026-05-08 status 200 for main-concepts, developer-guides/api-reference, configuration-and-deployment/enable-security
- doc_drift_findings.[0] ← WebFetch developer-guides/api-reference 2026-05-08 (response: "page does not contain specific information about data entity APIs")
- doc_drift_findings.[1] ← WebFetch main-concepts 2026-05-08 (response stub did not surface canonical Data Entity definition)
- implicit_adrs.[0] ← openapi.yaml:1-50 (no security:) + openapi.yaml:805-2433 (no per-operation security: under any dataEntity-tag operation)
- implicit_adrs.[1] ← components.yaml:4213-4229 (PageParam/SizeParam definitions)
- implicit_adrs.[2] ← openapi.yaml:1260-1276 + openapi.yaml:1294-1310
- implicit_adrs.[3] ← openapi.yaml:823-875 (/my, /my/upstream, /my/downstream paths)
- implicit_adrs.[4] ← openapi.yaml:1153-1167 (deleteOwnership propagate query param)
- implicit_adrs.[5] ← openapi.yaml:13-48 (tags list) + openapi.yaml:805-2433 (dataEntity tag scope)
- bugs_limitations_corner_cases.[0] ← openapi.yaml:1260-1276 + components.yaml:2033-2065
- bugs_limitations_corner_cases.[1] ← components.yaml:4213-4229 + openapi.yaml:823-866
- bugs_limitations_corner_cases.[2] ← openapi.yaml:2418-2433
- bugs_limitations_corner_cases.[3] ← openapi.yaml:1387-1438
- bugs_limitations_corner_cases.[4] ← WebFetch developer-guides/api-reference 2026-05-08
- security.auth_mode_relevance ← openapi.yaml:1-50 (no security: block) + WebFetch enable-security 2026-05-08 (auth-mode list)
- security.ingestion_filter_relevance ← openapi.yaml:805-2433 (paths /api/dataentities/* and /api/dataentitygroups/*) + WebFetch enable-security 2026-05-08 (ingestion filter scope quoted)
- security.authorization_assertions ← openapi.yaml:1-50 (no top-level security:) + openapi.yaml:805-2433 (no per-operation security:)
- security.owner_scoping ← openapi.yaml:823-893 (/my* path declarations vs /popular, /{id})
- security.known_security_gaps.[0] ← openapi.yaml:1-50 + openapi.yaml:805-2433
- security.known_security_gaps.[1] ← openapi.yaml:805-2433 (write/delete operations enumerated)
- security.known_security_gaps.[2] ← openapi.yaml:1153-1167 (propagate query param on deleteOwnership)
- security.known_security_gaps.[3] ← openapi.yaml:1529-1548 (updateAlertConfig)
- security.known_security_gaps.[4] ← WebFetch developer-guides/api-reference 2026-05-08
- performance.hot_paths.[0] ← openapi.yaml:823-893 + openapi.yaml:1321-1463 + openapi.yaml:2335-2372
- performance.hot_paths.[1] ← openapi.yaml:1253-1319
- performance.hot_paths.[2] ← openapi.yaml:2418-2433
- performance.throughput_characteristics ← openapi.yaml:927-1251 + components.yaml:2033-2065 + openapi.yaml:1387-1426
- performance.resource_allocation ← components.yaml:2033-2065 + components.yaml:2067-2075
- performance.scaling_characteristics ← components.yaml:4213-4229 + openapi.yaml:1260-1276 + openapi.yaml:805-2433
- performance.known_performance_gaps.[0] ← openapi.yaml:1260-1276 + components.yaml:2033-2065
- performance.known_performance_gaps.[1] ← openapi.yaml:2418-2433 + components.yaml:2067-2075
- performance.known_performance_gaps.[2] ← openapi.yaml:805-2433 (no 429 responses)
- performance.known_performance_gaps.[3] ← components.yaml:4213-4229 + openapi.yaml:823-893
- performance.known_performance_gaps.[4] ← openapi.yaml:910-925

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: MEDIUM
- docs_link_semantic: MEDIUM
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: HIGH

## Maintainer notes
