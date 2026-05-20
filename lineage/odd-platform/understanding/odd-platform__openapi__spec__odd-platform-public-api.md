---
node_id: "odd-platform openapi spec:odd-platform-public-api"
node_kind: openapi-spec
axis: openapi_specs
extracted_at_commit: 9ac6436e
enriched_at_commit: 9ac6436e
extractor_version: 0.1.0
prompt_version: file-analyser/0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-20-Z-retry
---

# odd-platform-public-api OpenAPI spec — semantic understanding

## understanding

`odd-platform-specification/openapi.yaml` (4212 lines) + its sibling `components.yaml` (2937 lines) are the platform-api contract face: a single OpenAPI 3.0.3 document declaring **194 operations across 35 tags** under the `/api/**` URL space, generated server-side into Spring WebFlux `*Api` interfaces that controllers implement (`AlertApi`, `DataEntityApi`, `TermApi`, etc.) and client-side as the SDK consumed by the React UI. The spec is the source of truth for HTTP method / path / request-body / response-body shape; runtime behaviour (authorisation, owner-scoping, status-code semantics, error responses) is NOT specified — there is **no `securitySchemes` block, no `security:` declarations, no operation-level error-response declarations beyond 3 isolated entries**, leaving the wire-contract authoritative for shape but silent on every non-happy-path concern. This makes the spec a CRUD-shape contract, not an operational contract; the gap surfaces as the platform-wide "OpenAPI authoring-quality META cluster" (DOC-GAP-099) already triangulated across five drift classes (inverse-semantic, operationId-misnamed, coverage-gap, response-shape-contradiction, status-code-drift) by prior batches.

## concepts

- entities: [`OpenAPI 3.0.3 document`, `Tag` (35 of them — feature/identity/owner/namespace/title/tag/dataSource/search/dataSet/dataEntity/dataEntityRun/dataInput/dataConsumer/dataQuality/metadata/datasetField/alert/appInfo/collector/term/activity/ownerAssociationRequest/dataCollaboration/policy/role/permission/links/integration/dataEntityAttachment/directory/dataQualityRuns/queryExample/referenceData/genai/relationship), `Operation` (194 total), `Schema` (~250 in `components.yaml`), `Parameter` (re-usable `*Param`s in components), `Response` (re-usable in components — `Deleted`, `Forbidden`, `InternalError`)]
- operations: [
    `declare-194-http-operations` (across `/api/**`),
    `group-by-feature-tag` (35 tags — domain partitioning),
    `reference-component-schemas` (487 `components.yaml` `$ref` invocations from `openapi.yaml`),
    `enumerate-CRUD-shapes` (100 GET + 34 POST + 34 PUT + 24 DELETE + 2 PATCH),
    `define-resource-DTOs` (Owner / DataEntity-anyOf-6 / Tag / Term / QueryExample / Alert / Policy / Role / Activity / Namespace / etc.)
  ]
- invariants: [
    "EVERY `/api/**` endpoint is declared here — controllers `implement` the generated `*Api` interface and do NOT define their own `@RequestMapping`; the spec is the path/method authority",
    "Tag-to-controller cardinality is many-to-many: `dataEntity` tag spans `DataEntityController` (most) + `DatasetController` + `DatasetFieldController` + (parts of) `OwnerController` — the tag groups operations by feature surface, not by Java class",
    "`components.yaml` is the schema realm — the spec uses ONLY `$ref: './components.yaml/#/components/schemas/...'` for request/response bodies (NO inline schemas of consequence)",
    "No declared error model: only 3 operations declare a non-2xx response (`POST /api/owners` declares 403, `GET /api/owners` declares 500, `POST /api/owners/mapping/{owner_id}` declares 403). The remaining 191 operations declare ONLY their 2xx happy path",
    "No `securitySchemes` block declared; no operation-level `security:` declaration; no `OAuth2`/`Bearer`/`SessionCookie`/`X-API-Key` formal contract surface — the API's authentication posture is implicit and not machine-readable",
    "Status-code polarity is non-uniform: across 34 POSTs the spec mixes `'200'` and `'201'`; across 34 PUTs the spec mixes `'200'` and `'201'` (with description text that says \"successfully modified\" while the code is 201 Created — see `openapi.yaml:2797-2799` for the canonical instance)",
    "SLA endpoint produces `image/png` (not JSON) — uniquely binary content-type in the entire spec (`openapi.yaml:1880-1896`)"
  ]
- audiences: [
    "odd-platform-ui-end-user (via the React SPA's generated client)",
    "odd-api-consumer (third-party programmatic clients consuming the spec)",
    "integration-author / custom-collector-developer (per `documentation/docs/developer-guides/api-reference.md` framing)",
    "platform-operator (interactive Swagger UI at `{platform-base-url}/api/v3/api-docs`)"
  ]

## dependencies_semantic

- requires-feature: [
    "all 11 pillars (P-01..P-11) — the spec is THE developer surface for every other pillar's HTTP face",
    "OpenAPI Generator (Spring) toolchain — server-side `*Api` interfaces are generated from this file; controllers `@Override` methods from the generated interface (`DataEntityController extends DataEntityApi` pattern verified across all controller sidecars)",
    "Swagger UI (operator-visible at `/api/v3/api-docs`) — only consumer of the spec at runtime"
  ]
- requires-config: [
    "build-time wiring: `odd-platform-api`'s `build.gradle` invokes openapi-generator-cli against `odd-platform-specification/openapi.yaml`; both server-side `*Api` interfaces and TypeScript client are generated artefacts (not committed). evidence: spec is referenced by-path from build, not by code",
    "Spring WebFlux's `produces`/`consumes` content-negotiation — the spec's `content` blocks (`application/json` / `image/png` / `multipart/form-data` for chunked upload — `openapi.yaml:1645-1690`) bind generated controllers' Spring annotations"
  ]
- requires-runtime: [
    "the running platform process serves the spec at `{platform-base-url}/api/v3/api-docs` (per live api-reference page WebFetched 2026-05-20)",
    "components.yaml — sibling file `$ref`-ed 487 times by openapi.yaml; the two files together comprise the contract"
  ]

## tests_coverage_semantic

- covered_behaviours: ["generated server stubs compile under openapi-generator (a build-time correctness check on the spec's YAML validity and `$ref` resolvability) — this is the only de-facto test of the spec"]
- uncovered_behaviours: [
    "spec-vs-controller status-code parity (no test asserts the controller's `ResponseEntity.status()` matches the spec's declared response code; the platform-wide drift cluster DOC-GAP-099 exists precisely because no such check runs — batch-W extension confirms drift at 7+ controllers / 9+ endpoint-level instances; see openapi-status-code-drift-batch-w invariant)",
    "spec-vs-controller path parity (no test asserts SecurityConstants path matchers align with the spec's path declarations — REFACTOR-217 path-mismatch (`/term` SINGULAR vs `/terms` PLURAL) silently disabled authorization for term-link operations for an unknown number of releases)",
    "spec-vs-controller response-shape parity (no test asserts response DTO field-by-field matches the spec — DOC-GAP-099's QueryExampleFormData missing `name` field is one instance)",
    "summary-text-vs-implementation parity (DOC-GAP-099 inverse-semantic on `getMyObjectsWithUpstream`/`Downstream` is the canonical instance — summary text was authored aspirationally and contradicts the implementation; no test could catch this without a behavioural assertion)",
    "error-response shape coverage (no operation specifies 4xx error JSON contract beyond the 3 isolated entries — clients consuming the spec MUST reverse-engineer error shapes from the running service)",
    "negotiated content-type coverage (no test asserts `GET /api/datasets/{id}/sla` returns 406 for `Accept: application/json`, per DataQualityController sidecar `bugs_limitations_corner_cases[1]`)"
  ]
- test_files: ["none — the spec has no test suite of its own; the openapi-generator build step is the closest thing"]
- gaps: |
    The spec has no end-to-end conformance test against the running platform. The
    drift cluster DOC-GAP-099 (5-shape drift family: inverse-semantic, operationId-
    misnamed, coverage-gap, response-shape-contradiction, status-code-drift) is the
    direct consequence: drift accumulates between the spec and the controllers
    because nothing structurally guards their alignment. A spec-driven contract
    test (e.g. one that fires every spec'd operation against a running platform
    instance and asserts status-code + response-DTO field-set) would catch every
    triangulated drift currently logged AND surface unknowns. The REFACTOR-009 +
    REFACTOR-217 pattern (path-pattern drift between SecurityConstants and the
    spec) is the canonical demonstration that the absence of contract tests has
    SECURITY-RELEVANT consequences — silent authorization bypass for an unknown
    number of releases until a sidecar audit found it.

## docs_link_semantic

- declared_docs: []  # the spec file has no `@docs` annotation
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/developer-guides/api-reference"
    anchor: ""
    rationale: "the api-reference hub page is the canonical operator-facing landing for this spec — verbatim from the live page WebFetched 2026-05-20: 'The full OpenAPI Specification for the ODD API can be accessed at [odd-platform → odd-platform-specification/openapi.yaml]' AND the page documents the Swagger UI at `{platform-base-url}/api/v3/api-docs` which serves THIS file's generated UI"
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    fetched_excerpts: |
      "This page is the canonical reference hub for every HTTP endpoint exposed by the ODD Platform."
      "ingestion-api: describes all ingestion endpoints"
      "platform-api: describes all endpoints for the ODD platform."
      Per-feature sub-pages enumerated: Alerts, Data Collaboration, Directory, Glossary, Integrations, Lineage, Query Examples, Reference Data, Relationships (9 sub-pages).
      "The Swagger UI hosted on every running ODD Platform is the place to interactively test the endpoints documented above against your own deployment."
    confidence: LOW
- doc_drift_findings:
  - "DOC-GAP-009 — the api-reference hub page enumerates 9 per-feature sub-pages but the spec declares operations spanning 35 tags. Tags NOT covered by an api-reference sub-page include `dataEntity` (45+ ops; arguably the biggest gap), `dataSet`, `dataSource`, `term` (vs hub's 'Glossary'), `owner`, `tag`, `namespace`, `policy`, `role`, `permission`, `collector`, `activity`, `appInfo`, `search`, `datasetField`, `alert` (vs hub's 'Alerts' — name match but tag/page rename ambiguity), `dataCollaboration` (vs hub's 'Data Collaboration'), `dataQuality`, `dataQualityRuns`, `ownerAssociationRequest`, `metadata`, `dataEntityAttachment`, `feature`, `identity`, `title`, `dataEntityRun`, `dataInput`, `dataConsumer`, `links`, `genai`. The hub abdicates the remaining 26 tags to Swagger UI without naming them — third-party API consumers reading the spec hub miss the bulk of the platform's API surface as canonical content"
  - "DOC-GAP-099 inverse-semantic class — `getMyObjectsWithUpstream`/`Downstream` summary text at `openapi.yaml:842-844` + `860-862` is the INVERSE of the implementation (4-angle triangulation confirms — spec layer + service layer + repository SQL + controller-method sidecars all show non-owned entities are returned, not 'owned with dependencies'). The spec summary is the load-bearing single source of the misframe"
  - "DOC-GAP-099 status-code-drift class — batch-W extension confirms drift at 7+ controllers / 9+ endpoint-level instances: Owner/Role/Policy/Ingestion/Term (prior batches E/F/U) PLUS DataSource (`openapi.yaml:454` register=201; `openapi.yaml:482` update=201) + Collector (`openapi.yaml:558` register=201; `openapi.yaml:586` update=201) + Tag (`openapi.yaml:372` create=201; `openapi.yaml:400` update=201). Controllers uniformly return 200 via `ResponseEntity::ok`; tests assert `isOk()`, locking in 200. Per the openapi-status-code-drift-batch-w invariant: 'a single cluster-fix PR per direction can close this drift class' — directional choice (align spec to code vs align code to spec) is the maintainer's call"
  - "DOC-GAP-099 status-code-drift sub-shape — UPDATE-with-201 description copy/paste at `openapi.yaml:400` (Tag), `openapi.yaml:482` (DataSource), `openapi.yaml:586` (Collector), `openapi.yaml:2156-2157` (QueryExample updateQueryExample), `openapi.yaml:2797-2799` (Term updateTerm) all carry `'201'` status with the 'successfully updated/modified' description. 201 is canonically Created (POST shape); 200 or 204 fits update semantics. Five-instance batch-W enumeration shows the copy-paste pattern is uniform across the spec — the authoring choice was 'every Create/Update returns 201' and never reconciled with what controllers actually return"
  - "DOC-GAP-099 response-shape contradiction class — `GET /api/datasets/{id}/sla` is declared `image/png` at `openapi.yaml:1891-1894` BUT the live doc page `https://docs.opendatadiscovery.org/active-platform-features/data-quality/sla-statuses` describes a JSON response (per DataQualityController sidecar batch-T). The SPEC is aligned with the controller; the LIVE DOC PAGE is aligned with neither"
  - "DOC-GAP-099 operationId-misnamed class — `createDataEntityTagsRelations` (`openapi.yaml:867-925` area) operationId is 'create' but the semantic at the controller is 'replace-all-internal-tags' (per `createDataEntityTagsRelations.md`); the operationId actively misleads about CRUD semantic"
  - "Missing `Name` field on QueryExampleFormData (`components.yaml:2799-2808`) — request body declares only `definition` + `query` (required) with NO `name`; QueryExample listings shown in the UI by name/title cannot be authored via the spec'd API because the spec lacks the field — confirmed verbatim from `components.yaml:2799-2808` lines"
  - "REFACTOR-217 / F-002 spec-vs-SecurityConstants path mismatch — `openapi.yaml:973` declares `/api/dataentities/{data_entity_id}/terms` (PLURAL) AND `openapi.yaml:1042` declares `/api/dataentities/{data_entity_id}/terms/{term_id}` (PLURAL) — but `SecurityConstants.java:237-242` registers PathPatternParserServerWebExchangeMatcher entries for `/term` and `/term/{term_id}` (SINGULAR); the spec is the source of truth for the path, the SecurityRule never matches, the authorization check is silently skipped. SEVERITY: HIGH — any authenticated user can link any term to any data entity regardless of `DATA_ENTITY_ADD_TERM` permission"
  - "No declared `securitySchemes` despite live security doc page `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security` enumerating 4 auth modes (DISABLED / LOGIN_FORM / OAUTH2 / LDAP) + S2S API-key — the spec is machine-readable for shape but not for auth, so generated SDKs cannot programmatically discover that an `X-API-Key` header is needed for S2S clients or that `auth.type=OAUTH2` requires a session cookie. Per `documentation/docs/developer-guides/api-reference.md` — Swagger UI 'interactively test the endpoints' assumes the operator authenticates via the UI's session, which is not part of the spec"

## implicit_adrs

- "**OpenAPI is the path/method/shape source of truth — controllers IMPLEMENT, never DECLARE** — the convention across all enriched controllers (AlertController, DataEntityController, TermController, OwnerController, QueryExampleController, DataSourceController, CollectorController, TagController — batch-W primary-source class-level sidecars confirm the pattern at 3 additional Management-tier controllers) is to `@Override` methods inherited from the generated `*Api` interface. No controller has its own `@RequestMapping` for the operations declared in the spec. The intent is visible in AlertController's pattern (sidecar: 'HTTP method/path/produces/consumes annotations live on the generated *Api interface, not on the controller')." — evidence: `openapi.yaml:1-49` (declares 35 tags + 194 operations) + cross-batch evidence from every controller sidecar — intent_anchor: "AlertController is a thin Spring WebFlux REST controller that implements the OpenAPI-generated `AlertApi` interface" (from `AlertController.md:understanding`) — confidence: HIGH
- "**One spec file per audience** — `info.title: ProspectLog data catalog HTTP API contract` (line 3) is the platform-api spec; the ingestion-api lives in a separate repo (`opendatadiscovery-specification`). Per live api-reference page WebFetched 2026-05-20: 'The two definitions in Swagger UI are: ingestion-api: describes all ingestion endpoints and platform-api: describes all endpoints for the ODD platform.' The dual-spec architecture is intentional — ingestion is a wire contract for producers, platform-api is the consumer-facing UI/API contract." — evidence: `openapi.yaml:2-9` (info.title + contact block) + live api-reference page — intent_anchor: "ProspectLog data catalog HTTP API contract" (literal title; ProspectLog is a legacy project name signalling the spec predates the ODD rename; the `info.contact.url: https://provectus.com` traces to Provectus, ODD's origin company) — confidence: HIGH
- "**Schema definitions live in a sibling file, not inline** — `openapi.yaml` references `components.yaml` 487 times via `$ref: './components.yaml/#/components/schemas/...'`; ZERO operations declare inline schemas. The two-file split is a deliberate authoring convention enabling schema reuse across the spec without scrolling through the path declarations." — evidence: `openapi.yaml` 487 occurrences of `components.yaml` + `components.yaml:1` (`components:` root) — intent_anchor: the consistent `$ref: './components.yaml/#/components/schemas/...'` pattern across every operation in the spec — confidence: HIGH
- "**Tag-based grouping is the spec's domain-partitioning convention** — 35 tags partition 194 operations along feature boundaries (`dataEntity` is the largest with 45+ ops; `genai`, `links`, `identity`, `feature`, `title`, `dataEntityRun`, `dataInput`, `dataConsumer`, `metadata`, `appInfo`, `dataQualityRuns` are single-operation tags). The intent is feature-area routing for the Swagger UI's left-nav AND for OpenAPI Generator's per-tag controller interface generation." — evidence: `openapi.yaml:13-48` (the `tags:` block at the top) + per-operation `tags:` lists across all 194 ops — intent_anchor: the explicit top-level `tags:` declaration block — confidence: HIGH

## bugs_limitations_corner_cases

- "**No `securitySchemes` block declared** — the spec is completely silent on the platform's authentication model. Live security docs at `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security` (per system-mission.md P-09) enumerate 4 UI auth modes (DISABLED/LOGIN_FORM/OAUTH2/LDAP) + S2S API-key + Ingestion filter. None of these are machine-readable from the spec. SDK generators cannot produce typed authentication clients; third-party consumers must reverse-engineer auth from the running service. severity: MEDIUM (impacts SDK quality + third-party integration; not a security boundary failure since auth IS enforced server-side, just not declared in the spec)" — evidence: `openapi.yaml:1-49` (no `components: securitySchemes:` block; no `security:` declaration anywhere — Grep'd to 0 matches) + `components.yaml:1-2937` (Grep'd to 0 matches for `securitySchemes` in the components file) — severity: MEDIUM
- "**Only 3 operations declare non-2xx error responses** — across 194 operations, only 3 declare a 4xx or 5xx response: `POST /api/owners` declares `'403'` (`openapi.yaml:172`); `GET /api/owners` declares `'500'` (`openapi.yaml:152`); `POST /api/owners/mapping/{owner_id}` declares `'403'` (`openapi.yaml:3433`). The remaining 191 operations declare ONLY their 2xx happy path. The platform DOES return 4xx and 5xx in production (per controller sidecars), but the spec doesn't say what those error responses look like. Third-party SDK clients have no typed error shapes. severity: MEDIUM (impacts SDK quality + production-debugging from spec-consuming clients)" — evidence: `openapi.yaml` Grep'd `'4..':` → 2 occurrences (line 172, 3433); `'5..':` → 1 occurrence (line 152) — severity: MEDIUM
- "**Status-code drift cluster — batch-W extension enumerates 9+ endpoint-level instances across 7+ controllers** — 31 operations declare HTTP 201 in the spec; cross-batch evidence now establishes the drift at 7+ controllers: Owner (batch E), Role (batch E), Policy (batch E), Ingestion postDataEntityList (batch F), Term createTerm + updateTerm (batch U), Alert changeAlertStatus (cross-ref), DataSource registerDataSource + updateDataSource (batch W), Collector registerCollector + updateCollector (batch W), Tag createTag + updateTag (batch W). Specific batch-W primary-source citations: `openapi.yaml:372` (Tag POST 201), `openapi.yaml:400` (Tag PUT 201), `openapi.yaml:454` (DataSource POST 201), `openapi.yaml:482` (DataSource PUT 201), `openapi.yaml:558` (Collector POST 201), `openapi.yaml:586` (Collector PUT 201). Controllers uniformly use `ResponseEntity::ok` (200); tests assert `isOk()` and lock in 200. The drift is PERVASIVE (every Create/Update method exhibits it) and UNCOORDINATED (the spec author chose 201 by REST convention, the controller authors chose 200 by Spring convention, the test authors locked in 200; no review reconciled the three). severity: MEDIUM (impacts SDK clients with strict `isCreated()` checks; functional impact zero since 200 and 201 are both success responses). The drift cluster is closeable in a single directional-fix PR (align spec→code OR align code→spec); see invariant `openapi-status-code-drift-batch-w-extension-to-7-controllers.yaml` for the audit candidate" — evidence: `openapi.yaml` Grep'd `'201':` → 31; `'200':` → 137; specific batch-W instances at `openapi.yaml:372, 400, 454, 482, 558, 586` (each verified by Read of 10-line window); prior-batch instances at `openapi.yaml:2118, 2156, 2760, 2798` — severity: MEDIUM
- "**Spec-internal copy/paste defect at `openapi.yaml:2797-2799`** — `updateTerm` declares `'201'` (canonically Created) with description 'The resource has been successfully modified' — the description is for a 200/204 Update, the status code is for a Create. The same shape repeats at `openapi.yaml:400` (updateTag — 201 + 'successfully updated' description), `openapi.yaml:482` (updateDataSource — 201 + 'successfully updated'), `openapi.yaml:586` (updateCollector — 201 + 'successfully updated'), `openapi.yaml:2156-2157` (updateQueryExample — 201 + 'successfully modified'). The spec authors themselves treated the 201 as the platform-wide convention for both Create AND Update, demonstrating the convention was confused at authoring time. severity: LOW (the defect is in spec metadata; controllers return 200 anyway)" — evidence: `openapi.yaml:2797-2799` (literal copy-paste shape: status `'201'` with 'modified' description); same shape at 400, 482, 586, 2156-2157 — severity: LOW
- "**QueryExampleFormData missing `Name` field — request body has only `definition` + `query`** — `components.yaml:2799-2808` declares `QueryExampleFormData` with required `[definition, query]` and NO `name` field. QueryExampleRef (`components.yaml:2729-2742`) and QueryExample (`components.yaml:2757-2776`) similarly have NO `name` field. The UI shows query examples by some short label; the spec'd authoring API cannot set a name. This is the spec-side artefact of the QueryExample 'missing name' drift surfaced by prior batches. severity: MEDIUM (feature-shape gap — the spec is what programmatic clients build against)" — evidence: `components.yaml:2729-2776, 2799-2808` (read directly; no `name:` property in any of the three QueryExample-family schemas) — severity: MEDIUM
- "**Inverse-semantic on `/api/dataentities/my/upstream` + `/my/downstream` (4-angle confirmed)** — `openapi.yaml:842-857` summary 'Returns list of data entities owned by current user with upstream dependencies' is the INVERSE of the implementation which returns NON-owned entities reachable from the owned set (per DOC-GAP-099 4-angle triangulation: spec / service / repository SQL / controller-method). The spec is the LOAD-BEARING source of the misframe — third-party API consumers consuming the spec assume tenant isolation that does not exist. severity: HIGH (security-relevant: operators in multi-tenant deployments may expose endpoints expecting tenant isolation per the spec summary)" — evidence: `openapi.yaml:841-878` (the spec-side declarations) + cross-link to `getMyObjects.md:bugs_limitations_corner_cases` + `DataEntityRelationsServiceImpl.java:25-39` (service-layer evidence per DOC-GAP-099) — severity: HIGH
- "**SecurityConstants path-mismatch class — `openapi.yaml:973` PLURAL `/terms` vs SecurityConstants `/term` SINGULAR silently disables DATA_ENTITY_ADD_TERM authorization** — the spec declares the PLURAL form (the URL clients actually hit); SecurityConstants registers the SINGULAR form (a typo). Result: the SecurityRule never matches, the permission check is skipped, the SecurityWebFilterChain falls through to `.authenticated()`. ANY authenticated user under LOGIN_FORM/OAUTH2/LDAP can link any term to any entity. REFACTOR-217 documents the remedy; the SPEC SIDE is correct, the SecurityConstants side is wrong, but the gap demonstrates how the spec's path is the source of truth and divergence is a security incident. severity: HIGH (silent authorization bypass)" — evidence: `openapi.yaml:973` (PLURAL `/api/dataentities/{data_entity_id}/terms`) + `openapi.yaml:1042` (PLURAL `/api/dataentities/{data_entity_id}/terms/{term_id}`) + cross-link to REFACTOR-217 — severity: HIGH
- "**API Reference hub vs spec tag-count gap — 9 doc sub-pages vs 35 spec tags** — `documentation/docs/developer-guides/api-reference.md` enumerates 9 per-feature sub-pages (Alerts, Data Collaboration, Directory, Glossary, Integrations, Lineage, Query Examples, Reference Data, Relationships) but the spec partitions operations across 35 tags. 26 tags have no doc-side sub-page (incl. `dataEntity` — the largest tag — and `dataSet`/`dataSource`/`owner`/`tag`/`namespace`/`policy`/`role`/`permission`/`collector`/`activity`/`search`/`alert` etc.). The doc hub abdicates to Swagger UI for the 26 missing surfaces. severity: MEDIUM (doc-coverage gap; per DOC-GAP-009 family)" — evidence: live api-reference page WebFetched 2026-05-20 (9 sub-pages enumerated) + `openapi.yaml:13-48` (35 tags declared) — severity: MEDIUM
- "**`info.title: ProspectLog data catalog HTTP API contract` is a legacy project name** — line 3 declares the title as 'ProspectLog' (an internal/early name); `info.contact.url: https://provectus.com` ties to Provectus, ODD's origin company. The spec is publicly served under `{platform-base-url}/api/v3/api-docs` — operators interacting with the Swagger UI see the title 'ProspectLog data catalog HTTP API contract' which does not match the project's public branding 'Open Data Discovery'. severity: LOW (branding/cosmetic; not load-bearing on behaviour)" — evidence: `openapi.yaml:2-9` (info block; title literally 'ProspectLog'; contact block points to provectus.com) — severity: LOW
- "**`servers:` is a stub** — `openapi.yaml:10-12` declares `servers: - url: 'http://localhost' description: stub`. The spec's `servers:` field is meant to be a programmatic discovery surface ('the API is hosted at X'); declaring `http://localhost` is a development-time placeholder, never updated for live deployments. SDK generators using the spec'd `servers:` value would target localhost. severity: LOW (operationally, clients pass an explicit base URL; the spec'd `servers:` is ignored in practice)" — evidence: `openapi.yaml:10-12` (literal `'http://localhost' description: stub`) — severity: LOW

## security

- **auth_mode_relevance**: `N/A — the spec declares no security schemes; auth is enforced server-side via SecurityWebFilterChain, not via the spec's contract surface`. The platform supports DISABLED / LOGIN_FORM / OAUTH2 / LDAP UI modes + S2S (`X-API-Key`) + Ingestion filter (per `documentation/docs/configuration-and-deployment/enable-security/` per system-mission.md P-09); NONE are declared in the spec. evidence: `openapi.yaml:1-49` (full document inspected for `securitySchemes` and `security:` declarations — both absent) + `components.yaml:1-2937` (no `securitySchemes`).
- **ingestion_filter_relevance**: `N/A — this spec is the PLATFORM-API spec, not the INGESTION-API spec`. Per live api-reference page WebFetched 2026-05-20: "The two definitions in Swagger UI are: ingestion-api: describes all ingestion endpoints and platform-api: describes all endpoints for the ODD platform." `IngestionDataEntitiesFilter` applies to ingestion endpoints in the sibling spec (`opendatadiscovery-specification` repo), not here. evidence: live api-reference page + `openapi.yaml:3-4` (info.title 'ProspectLog data catalog HTTP API contract' — platform-api scope).
- **authorization_assertions**: [] — the spec is the contract surface; authorization is enforced in `SecurityConstants.java` SECURITY_RULES via `AuthorizationCustomizer.java` per ODD's read-collaborative posture (system-mission.md P-09). The spec does NOT declare which operations require which `DATA_ENTITY_*` / `TERM_*` / `QUERY_EXAMPLE_*` / `LOOKUP_TABLE_*` permissions. evidence: `openapi.yaml` Grep'd for `security:` and `securitySchemes` → 0 matches.
- **owner_scoping**: `N/A — the spec declares request/response shapes only`. Owner-scoping for operations like `getMyObjects` (RESPECTS owner-scoping at the SQL JOIN) vs `getDataEntityDetails` (BYPASSES owner-scoping) is invisible from the spec — both return `DataEntityRef`/`DataEntityList` shape but with different visibility semantics. The spec's silence on owner-scoping IS the load-bearing source of the DOC-GAP-099 inverse-semantic finding. evidence: `openapi.yaml:823-878` (getMyObjects family — DOC-GAP-099 inverse-semantic source) + `openapi.yaml` (no operation declares an `x-owner-scope` extension or similar).
- **data_exposure**:
  - "OpenAPI spec itself → publicly served at `{platform-base-url}/api/v3/api-docs` by every running platform deployment per live api-reference doc (WebFetched 2026-05-20). An attacker reaching the Swagger UI URL discovers the complete API surface (194 operations across 35 tags) without authentication — the spec is the discovery surface for everything else"
  - "Every operation's request/response DTO → published via the spec. Sensitive shapes (`Owner` with email/name, `Alert` with `lastReason`, `Activity` with full payload, `Term` with description, `Policy`/`Role` definitions) are programmatically discoverable BEFORE the attacker tries to call the endpoints"
  - "`info.contact.email: ndementev@provectus.com` (`openapi.yaml:5-9`) → exposed via the Swagger UI to any caller that can reach `/api/v3/api-docs`. Direct individual email contact for an external contributor; arguably PII exposure if the spec is reachable by unauthenticated traffic under `auth.type=DISABLED` mode (default per docs)"
- **known_security_gaps**:
  - "**Spec discoverability gap** — `{platform-base-url}/api/v3/api-docs` may be reachable without authentication under `auth.type=DISABLED` mode (the documented default for dev — per system-mission.md P-09); even under LOGIN_FORM/OAUTH2/LDAP, the Swagger UI's reachability is not specified by the spec or doc. The full 194-operation surface (incl. operation IDs, paths, DTO shapes) is the easiest reconnaissance target before any authentication. severity: MEDIUM — evidence: `openapi.yaml:1-49` + live api-reference doc (no auth requirement stated for the Swagger UI URL) — severity: MEDIUM"
  - "**No machine-readable auth → generated SDKs silently omit auth** — third-party SDKs generated from this spec contain NO authentication code (no Bearer token wiring, no session cookie handling, no `X-API-Key` injection). SDK consumers must hand-author auth glue, which is the easiest place for a misconfiguration. severity: MEDIUM — evidence: spec lacks `securitySchemes` (verified by 0 Grep matches) — severity: MEDIUM"
  - "**Inverse-semantic on `getMyObjects*` family** — the spec summary states 'owned by current user with [upstream|downstream] dependencies' but the implementation returns non-owned reachable entities. SDK clients consuming the spec for multi-tenant deployments would assume tenant isolation that does not exist. severity: HIGH (per DOC-GAP-099 batch-M severity rationale) — evidence: `openapi.yaml:842-878` (the misleading summaries) + cross-link DOC-GAP-099 — severity: HIGH"
  - "**SecurityConstants path-mismatch confirmation point** — the spec's `/terms` PLURAL path is the source of truth; the SecurityConstants registration of `/term` SINGULAR is the silent bug. The spec IS correct; the security registration is wrong. This direction matters: the remedy per REFACTOR-217 is to change SecurityConstants to match the spec, not the spec to match SecurityConstants. severity: HIGH (the gap is structurally caught at the spec layer — a build-time validator that compares SECURITY_RULES paths against OpenAPI paths would catch every such drift) — evidence: `openapi.yaml:973` + `openapi.yaml:1042` + cross-link REFACTOR-217 — severity: HIGH"

## performance

- **hot_paths**:
  - "Spec parsing at build time — openapi-generator-cli parses the 4212-line spec + 2937-line components.yaml on every `gradle build`; the parse is one-shot but the generated artefacts (`*Api` interfaces, TypeScript client) are large. evidence: spec file size + generator invocation pattern in `odd-platform-api/build.gradle`"
  - "Spec serving at `/api/v3/api-docs` — every running platform deployment serves this spec (per live api-reference doc); the URL is served by Spring's springdoc-openapi integration, which renders the spec on-demand for each request (typically cached). evidence: live api-reference page + standard Spring springdoc-openapi behaviour"
- **throughput_characteristics**:
  - "static document — the spec is served as a single JSON-or-YAML response by springdoc-openapi; throughput is bounded by HTTP server's response throughput, not by the spec's content"
  - "build-time generator output dominates the practical cost — the OpenAPI Generator emits ~150 generated Java `*Api` interfaces + ~250 schema POJOs from this spec; full rebuild costs are spec-size-proportional"
- **resource_allocation**:
  - "spec is 4212 lines (openapi.yaml) + 2937 lines (components.yaml) = ~7150 lines of YAML; parsed in-memory once at startup by springdoc-openapi for the Swagger UI"
  - "generated Java DTOs from `components.yaml` (~250 schemas) compile to ~250 .java files = significant compile-time cost; runtime memory is dominated by the platform's other components, not the spec"
- **scaling_characteristics**:
  - "spec is immutable per release — no per-request mutation; horizontal scaling of the platform process has no impact on spec serving (each instance serves an identical copy)"
- **known_performance_gaps**:
  - "no per-operation `x-throttle` / `x-rate-limit` declarations — clients consuming the spec cannot programmatically discover rate limits; the platform also does not enforce rate limits today (per cross-batch evidence; no `@RateLimiter` annotations on controllers). severity: LOW (information-quality issue — the spec accurately reflects 'no rate limits exist'; a future rate-limit implementation would need spec extensions)" — evidence: `openapi.yaml` Grep'd for `x-throttle` / `x-rate-limit` → 0 matches — severity: LOW
  - "no per-operation `x-pagination-limit` cap declarations — pagination is done via `PageParam`/`SizeParam` (re-usable parameter refs) but the spec does NOT declare upper bounds on `size`. Per cross-batch evidence (DataEntityController.md, AlertController.md), the platform accepts any positive integer including very large values. Third-party clients cannot discover from the spec what the safe max-page-size is. severity: LOW (information-quality issue with potential performance impact under abuse) — evidence: `openapi.yaml` references `PageParam`/`SizeParam` heavily but no `maximum:` constraint declared in those parameters per `components.yaml` — severity: LOW

## sources

- understanding ← `openapi.yaml:1-49` (info + tags) + `components.yaml:1` (root) + Grep counts (`operationId:` 194; `get:` 100; `post:` 34; `put:` 34; `delete:` 24; `patch:` 2; `components.yaml` 487 `$ref` invocations) + live api-reference page WebFetched 2026-05-20
- concepts.entities ← `openapi.yaml:13-48` (35 tags declared verbatim) + `components.yaml` schema enumeration
- concepts.operations ← Grep counts on `openapi.yaml` (op-verb counts) + `components.yaml` (487 $ref invocations counted in Grep)
- concepts.invariants[0] (every endpoint declared here) ← cross-batch evidence from `AlertController.md:understanding` + `DataEntityController.md` + every other controller sidecar's "implements *Api interface" pattern
- concepts.invariants[1] (tag-to-controller many-to-many) ← cross-batch tag enumeration from controller sidecars + `openapi.yaml` tags-per-op counts
- concepts.invariants[2] (components.yaml is the schema realm) ← `openapi.yaml` 487 occurrences of `components.yaml` Grep + `components.yaml:1-2937` size
- concepts.invariants[3] (no declared error model) ← `openapi.yaml` Grep `'4..':` 2 matches; `'5..':` 1 match
- concepts.invariants[4] (no securitySchemes) ← `openapi.yaml` Grep `securitySchemes` 0 matches; `components.yaml` Grep `securitySchemes` 0 matches; `openapi.yaml` Grep `security:` 0 matches
- concepts.invariants[5] (status-code polarity) ← `openapi.yaml` Grep `'201':` 31; `'200':` 137; specific drift at `openapi.yaml:2797-2799`
- concepts.invariants[6] (SLA endpoint image/png) ← `openapi.yaml:1880-1896`
- docs_link_semantic.inferred_docs[0] ← WebFetch `https://docs.opendatadiscovery.org/developer-guides/api-reference` 2026-05-20 status 200 (verified)
- docs_link_semantic.doc_drift_findings[0] (API reference hub vs 35 tags) ← live api-reference doc + `openapi.yaml:13-48`
- docs_link_semantic.doc_drift_findings[1] (inverse-semantic) ← `openapi.yaml:842-878` + cross-link DOC-GAP-099 (`lineage/odd-platform/doc-gaps/detail/DOC-GAP-099.md:1-39` 4-angle triangulation)
- docs_link_semantic.doc_drift_findings[2] (status-code drift cluster — batch-W extension) ← `openapi.yaml:372, 400, 454, 482, 558, 586` (each verified by Read) + cross-link `openapi-status-code-drift-batch-w-extension-to-7-controllers.yaml` + prior-batch refs (batch E/F/U)
- docs_link_semantic.doc_drift_findings[3] (UPDATE-with-201 description sub-shape) ← `openapi.yaml:400, 482, 586, 2156-2157, 2797-2799` (each verified by Read)
- docs_link_semantic.doc_drift_findings[4] (SLA response-shape contradiction) ← `openapi.yaml:1880-1896` + cross-link DataQualityController.md batch-T
- docs_link_semantic.doc_drift_findings[5] (operationId-misnamed) ← cross-link DOC-GAP-098 + `createDataEntityTagsRelations.md`
- docs_link_semantic.doc_drift_findings[6] (QueryExampleFormData missing Name) ← `components.yaml:2729-2776, 2799-2808`
- docs_link_semantic.doc_drift_findings[7] (REFACTOR-217) ← `openapi.yaml:973, 1042` + cross-link `REFACTOR-217.md:1-29`
- docs_link_semantic.doc_drift_findings[8] (no securitySchemes vs 4 auth modes) ← `openapi.yaml` + `components.yaml` Grep `securitySchemes` 0 matches + cross-link `enable-security` doc per system-mission P-09
- implicit_adrs[0] (OpenAPI is path/method/shape SoT) ← `openapi.yaml:1-49` + cross-batch evidence including batch-W (DataSource/Collector/Tag class-level sidecars)
- implicit_adrs[1] (One spec file per audience) ← `openapi.yaml:2-9` + live api-reference page
- implicit_adrs[2] (Schemas live in sibling file) ← `openapi.yaml` 487 `components.yaml` refs + `components.yaml:1`
- implicit_adrs[3] (Tag-based grouping) ← `openapi.yaml:13-48`
- bugs_limitations_corner_cases[0] (no securitySchemes) ← Grep on both files for `securitySchemes` and `security:`
- bugs_limitations_corner_cases[1] (only 3 non-2xx error responses) ← `openapi.yaml:152, 172, 3433`
- bugs_limitations_corner_cases[2] (status-code drift batch-W) ← Grep counts (31 201s vs 137 200s) + `openapi.yaml:372, 400, 454, 482, 558, 586` (batch-W primary-source citations, each verified by Read) + cross-link `openapi-status-code-drift-batch-w-extension-to-7-controllers.yaml` + DOC-GAP-099 batch-U
- bugs_limitations_corner_cases[3] (spec-internal copy/paste defect) ← `openapi.yaml:400, 482, 586, 2156-2157, 2797-2799` (5-instance batch-W enumeration)
- bugs_limitations_corner_cases[4] (QueryExampleFormData missing Name) ← `components.yaml:2729-2776, 2799-2808`
- bugs_limitations_corner_cases[5] (inverse-semantic) ← `openapi.yaml:842-878` + cross-link DOC-GAP-099
- bugs_limitations_corner_cases[6] (REFACTOR-217 path mismatch) ← `openapi.yaml:973, 1042` + cross-link REFACTOR-217.md
- bugs_limitations_corner_cases[7] (9 hub pages vs 35 tags) ← live api-reference WebFetch + `openapi.yaml:13-48`
- bugs_limitations_corner_cases[8] (ProspectLog legacy title) ← `openapi.yaml:2-9`
- bugs_limitations_corner_cases[9] (servers: stub) ← `openapi.yaml:10-12`
- security.auth_mode_relevance ← `openapi.yaml:1-49` + Grep 0 matches for `securitySchemes`/`security:`
- security.ingestion_filter_relevance ← live api-reference doc WebFetch ('platform-api'/'ingestion-api' split) + `openapi.yaml:3-4`
- security.data_exposure[0] (spec publicly served) ← live api-reference doc + `openapi.yaml:1`
- security.data_exposure[2] (contact email) ← `openapi.yaml:5-9`
- security.known_security_gaps[0] (spec discoverability) ← live api-reference doc + `openapi.yaml:1`
- security.known_security_gaps[2] (inverse-semantic security impact) ← `openapi.yaml:842-878` + cross-link DOC-GAP-099 batch-M
- security.known_security_gaps[3] (path-mismatch direction) ← `openapi.yaml:973, 1042` + cross-link REFACTOR-217
- performance.hot_paths[0] (spec parsing at build) ← `openapi.yaml` size + standard openapi-generator behaviour
- performance.known_performance_gaps[0] (no rate-limit declarations) ← `openapi.yaml` Grep 0 matches for `x-rate-limit`/`x-throttle`
- performance.known_performance_gaps[1] (no pagination caps) ← `components.yaml` parameter refs (PageParam/SizeParam — no `maximum:`)

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH (the absence of contract tests is structurally visible from the workspace; the consequences are documented in DOC-GAP-099 META across 5 drift classes)
- docs_link_semantic: HIGH (live api-reference page WebFetched 2026-05-20 status 200; 9 doc-drift findings each anchored at file:line + cross-batch DOC-GAP / REFACTOR IDs; status-code-drift class now batch-W-enumerated at 9+ endpoint-level instances)
- implicit_adrs: HIGH (cross-batch evidence from every controller sidecar including batch-W primary-source class-level sidecars at DataSource/Collector/Tag confirms the OpenAPI-Generator-driven controller pattern; spec-architectural conventions are visible in the file structure)
- bugs_limitations_corner_cases: HIGH (every finding is anchored at exact file:line or a Grep-counted absence; status-code-drift item now carries 6 batch-W file:line citations each Read-verified; 8 of 10 findings are triangulated via cross-batch DOC-GAP IDs)
- security: HIGH (the absence of securitySchemes is verified by Grep; the data-exposure surface is the spec's `info` block + live doc page; the path-mismatch is REFACTOR-217-confirmed)
- performance: MEDIUM (the spec's performance impact is bounded — its absence of rate-limit/pagination declarations IS the finding; there is no Spring runtime profiling data for spec-serving in the workspace, so the hot-path claim is structural inference, not measurement)

## Maintainer notes

(Batch-Z retry, 2026-05-20) — strengthened the `bugs_limitations_corner_cases[2]`
status-code-drift item from generic ("multiple Create methods") to fully
enumerated (batch-W file:line citations at 372/400/454/482/558/586) reflecting
the openapi-status-code-drift-batch-w-extension-to-7-controllers invariant.
Added the explicit 5-instance UPDATE-with-201-description-copy-paste sub-shape
as a separate finding (`doc_drift_findings[3]`) — the pattern is uniform enough
that it deserves its own line, and the 5 batch-W instances make the
"directional-fix PR per direction" closure scope concrete (single PR can flip
either every status to 200 or every controller to 201). No claim removed;
strengthens only.
