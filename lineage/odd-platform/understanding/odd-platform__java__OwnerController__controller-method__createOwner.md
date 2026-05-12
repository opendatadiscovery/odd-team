---
node_id: "odd-platform java OwnerController controller-method:createOwner"
node_kind: controller-method
axis: controllers
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.2.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-12-E
---

# OwnerController#createOwner — semantic understanding

## understanding

`createOwner` is the reactive `POST /api/owners` handler — four lines of WebFlux delegation that read the request body as `Mono<OwnerFormData>`, call `ownerService.create(formData)`, and lift the resulting `Owner` into `200 OK`. The endpoint creates an **Owner** entity (a platform-managed object that "Data Owners — people who manage and maintain a particular data entity or term" map to per the live authorization docs) plus the owner→role links from the form's optional `roles` list. The method itself does no validation, no authorisation, no error handling, and never reads the calling user's identity; authorization is enforced centrally by a `SecurityRule` for `POST /api/owners` in `SecurityConstants.SECURITY_RULES` that demands the `OWNER_CREATE` permission (`SecurityConstants.java:143`). No user→owner association is created at this endpoint — that flow lives behind `POST /api/owner_association_request` (`OwnerAssociationRequestServiceImpl.java:52-76`); a freshly created Owner sits unattached until a separate association step runs.

## concepts

- entities: [`Owner` (response payload), `OwnerFormData` (request body: `name: String` required + `roles: List<Role>` optional), `OwnerPojo` (jOOQ row), `OwnerToRole` (join-table link, one row per role in `formData.roles`)]
- operations: [`create-owner-with-optional-roles` (single transactional insert + per-role link insert + read-back as DTO)]
- invariants: [
    "Reactive transactional — `OwnerServiceImpl.create` is annotated `@ReactiveTransactional` (`OwnerServiceImpl.java:55`); the row insert, the role-link inserts, and the read-back run inside one DB transaction. The controller method itself has no transaction annotation; the boundary lives at the service.",
    "OpenAPI declares `201 Created` for the success response (`openapi.yaml` `createOwner` `responses.201`) but the controller returns `200 OK` (`OwnerController.java:26` `.map(ResponseEntity::ok)`). The contract and the implementation disagree on the status code.",
    "`name` is the only required field at the contract surface — `@NotNull` lives on `OwnerFormData.getName()` (`OwnerFormData.java:57`); `roles` is `@NotRequired` (`OwnerFormData.java:86`). No length, character-set, or pattern constraint is declared in the OpenAPI spec (`components.yaml` `OwnerFormData.properties.name`) or on the model. The DB enforces `varchar(255) NOT NULL UNIQUE` (`V0_0_1__init.sql` `owner` table)."
  ]
- audiences: [
    "Platform admins / managers (per the live owners doc, owners are managed in `Management → Owners`); a successful `createOwner` call requires the caller to hold a Policy granting `OWNER_CREATE` (`SecurityConstants.java:143`)",
    "ODD Platform UI — the `Management → Owners` tab uses this endpoint to create new owner rows (per live owners doc fetched excerpt)"
  ]

## dependencies_semantic

- requires-feature: [
    "ownership / data-owner feature — live doc `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/owners`",
    "authorization / policy framework — the SecurityRule pipeline that turns `OWNER_CREATE` into an enforced permission gate (`SecurityConstants.java:143` + `AuthorizationCustomizer.java`)"
  ]
- requires-config: [] — N/A (method reads no config; the controller class reads no config keys; the gating SecurityRule is unconditional, not config-gated)
- requires-runtime: [
    "Spring WebFlux runtime — `Mono<ResponseEntity<Owner>>` return type and `ServerWebExchange exchange` parameter (`OwnerController.java:13, 23`)",
    "jOOQ reactive DB session — downstream `ReactiveOwnerRepositoryImpl.create` inserts into `OWNER`, `ownerToRoleRepository.createRelations` inserts into `OWNER_TO_ROLE`, `ownerRepository.getDto` reads back with role aggregation (`OwnerServiceImpl.java:56-66`)",
    "Postgres `owner` and `owner_to_role` tables — `owner` has `(id PRIMARY KEY, name varchar(255) NOT NULL UNIQUE, is_deleted boolean DEFAULT FALSE, created_at, updated_at)` (`V0_0_1__init.sql` `owner` table). Note: `name UNIQUE` is a NON-partial unique — soft-deleted rows still hold the name, blocking re-creation under the same name (see `bugs_limitations_corner_cases`)."
  ]
- couples-to: [
    "`OwnerApi.createOwner` (generated interface, `OwnerApi.java:43-86`) — supplies `@RequestMapping(method = POST, value = '/api/owners', consumes/produces 'application/json')`, the `@Valid @RequestBody Mono<OwnerFormData>` constraint, and the OpenAPI-declared 201/403 response codes. The controller's `@Override` (`OwnerController.java:21`) inherits the routing; the controller's `.map(ResponseEntity::ok)` overrides the declared 201 to 200.",
    "`OwnerService.create(OwnerFormData)` — sole downstream call; the service is `@ReactiveTransactional`, inserts the Owner via `ownerRepository::create`, calls `ownerToRoleRepository.createRelations(ownerId, roleIds)`, then reads back via `ownerRepository.getDto(id)` and maps to `Owner` (`OwnerServiceImpl.java:55-66`).",
    "`OwnerMapper` (MapStruct, `OwnerMapper.java:16`) — `mapToPojo(OwnerFormData)` produces `OwnerPojo`; the mapper has no custom logic for `name` (no trim, no lowercase, no length clamp).",
    "`SecurityConstants.SECURITY_RULES[143]` — `new SecurityRule(NO_CONTEXT, PathPatternParserServerWebExchangeMatcher('/api/owners', POST), OWNER_CREATE)`; the authoritative authorization gate for this method.",
    "`OwnerAssociationRequestServiceImpl.createOwnerAssociationRequest` (`OwnerAssociationRequestServiceImpl.java:52-76`) — the **separate** flow that links an authenticated user to an existing (or `getOrCreate`-created) Owner. NOT called from this endpoint; surfaced here to make the absence explicit."
  ]

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours: [
    "HTTP-level smoke test — no `@WebFluxTest(OwnerController.class)` or `WebTestClient` test asserts `POST /api/owners` with a minimum body returns success and a deserialisable `Owner`.",
    "Status-code contract divergence — no test catches that the controller returns 200 OK while OpenAPI declares 201 Created; a contract-checking test would fail.",
    "Name uniqueness — no test asserts the behaviour when `POST /api/owners` is called with a `name` that already exists (live row) or that was soft-deleted (the `varchar UNIQUE` on a non-partial index makes re-create-after-soft-delete a hard DB error, not a graceful 409).",
    "Roles propagation — no test asserts that a `roles: [{id: 1}, {id: 2}]` payload creates exactly two rows in `OWNER_TO_ROLE` linking the new owner; no test asserts the behaviour when a role id does not exist (no FK error mapping).",
    "Authorization regression — no test asserts that a caller WITHOUT `OWNER_CREATE` receives 403, and a caller WITH `OWNER_CREATE` receives 200/201. The SecurityRule entry (`SecurityConstants.java:143`) is verified by code reading, not by an HTTP test.",
    "Auth-mode coverage — no test exercises `DISABLED / LOGIN_FORM / OAUTH2 / LDAP` behaviour against this endpoint.",
    "Input validation — no test exercises name=null (should be rejected by `@NotNull`), name='' (NOT rejected by current model — no `@NotBlank`), name with 256+ characters (DB-level `varchar(255)` constraint, no contract-level rejection), or name containing control characters / SQL-shaped strings."
  ]
- test_files: [] — N/A. `find <odd-platform> -path '*test*' -name 'OwnerController*'` returned zero matches; `grep -rln 'createOwner\\|OwnerService' <odd-platform>/odd-platform-api/src/test/java/` returned only `OwnershipServiceImplTest.java` (Ownership ≠ Owner) and `ReactiveOwnerAssociationRequestRepositoryImplTest.java` (the association-request flow, not owner creation). The owner-creation HTTP boundary has no test of any kind.
- gaps: |
    Owner creation is a primary write surface — it produces the row everything else (Ownership rows, user-owner mappings, alert filters, `/my*` routes) reads from. The HTTP boundary, the OpenAPI-declared status code, the name-uniqueness behaviour, the role-link side effect, and the authorization gate together form a contract every UI flow and every operator script depends on, and none of it is covered. A regression in the OpenAPI generator (`createOwner` operationId binding), in WebFlux routing, in the MapStruct mapper, in the soft-delete-aware `ownerRepository.create`, or in the SecurityRule pipeline would silently break this endpoint with the build still green.

## docs_link_semantic

- declared_docs: [] — N/A. The source file carries no `@docs` Javadoc annotation; consistent with this repo's convention (no `@docs` annotations are bootstrapped in `odd-platform-api`).
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/owners"
    anchor: ""
    rationale: "Canonical live page describing what an Owner is and where it is managed in the UI; the audience for an Owner-creation endpoint."
    last_verified_at: "2026-05-12T00:00:00Z"
    last_verified_status: 200
    confidence: MEDIUM
    fetched_excerpts: |
      Owner definition (verbatim from live page): "ODD Platform allows to create platform-managed users — owners. Owners are Data Owners — people who manage and maintain a particular data entity or term."
      Management location (verbatim): "You can manage owners in the Management → Owners tab."
      User-owner expectation (verbatim): "Every ODD Platform user should associate themselves with one of the existing owners."
      Coverage absence (verbatim, what is NOT on this page): "the page notably does not address — how owners are actually created (mechanics or step-by-step process); the OWNER_CREATE permission or any permission framework; specific details about user-owner association mechanics; constraints on owner uniqueness, deletion policies, or prevention of owner sprawl."
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions"
    anchor: ""
    rationale: "Defines `OWNER_CREATE` and the surrounding permission vocabulary the SecurityRule for this endpoint references."
    last_verified_at: "2026-05-12T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      Permission definition (verbatim): "OWNER_CREATE: 'Allows creating a new owner entity.'"
      Sibling-permission inventory (verbatim): "OWNER_UPDATE: 'Allows editing an existing owner.' OWNER_DELETE: 'Allows deleting an owner.' OWNER_RELATION_MANAGE: 'Allows accepting or declining ownership association requests.' OWNER_ASSOCIATION_MANAGE: 'Allows approving or denying user-owner association requests.' DIRECT_OWNER_SYNC: 'Allows associating a user with an owner without an approval request.'"
- doc_drift_findings:
  - "OpenAPI spec declares 201 Created for the success response (`odd-platform-specification/openapi.yaml` `createOwner` `responses.201`) and the generated `OwnerApi.java:57` carries `@ApiResponse(responseCode = '201')`, but the controller implementation returns `ResponseEntity.ok` = 200 (`OwnerController.java:26`). The contract and the implementation disagree; doc consumers reading the OpenAPI page will see 201, real clients receive 200."
  - "The live owners doc explicitly disclaims coverage of: owner creation mechanics, OWNER_CREATE permission, association-request mechanics, and owner-sprawl prevention. Each of these IS a real concern in the code path (the `OWNER_CREATE` SecurityRule gates this endpoint; owner-association is a separate `OwnerAssociationRequestController` flow; the DB's non-partial `name UNIQUE` makes re-creating a soft-deleted name a hard error). The page lists these as future scope without naming the existing mechanism — a documentation gap, not a contradiction. Surface to doc-gap-finder for triage."
  - "The live owners doc states 'Every ODD Platform user should associate themselves with one of the existing owners' — implying the association is a manual user-initiated step. The code confirms this: no auth flow (`AuthIdentityProviderImpl.java`, `LDAPSecurityConfiguration.java`, `OAuthSecurityConfiguration.java`) calls `OwnerService.create` or `ownerService.getOrCreate` on login. `getOrCreate` is invoked ONLY from `OwnerAssociationRequestServiceImpl.createOwnerAssociationRequest` (`OwnerAssociationRequestServiceImpl.java:57`). There is no auto-creation of an Owner when a user first logs in via OAuth or LDAP. The doc's framing aligns with the code's enforcement — no drift here, but worth recording as a verified alignment (cross-ref to batch-C `LDAPSecurityConfiguration` and `OAuthSecurityConfiguration` sidecars)."

## implicit_adrs

- "Centralised endpoint authorization via `SecurityConstants.SECURITY_RULES` — controllers carry no `@PreAuthorize`; protected endpoints are declared as `SecurityRule` entries that `AuthorizationCustomizer` registers against the WebFlux security chain. `POST /api/owners` IS registered with `OWNER_CREATE` (`SecurityConstants.java:143`), so the authorization decision is enforced by the rule pipeline, not by an annotation on the controller method." — evidence: `SecurityConstants.java:143` (`new SecurityRule(NO_CONTEXT, new PathPatternParserServerWebExchangeMatcher('/api/owners', POST), OWNER_CREATE)`) + `OwnerController.java:21-27` (controller method has no `@PreAuthorize`, no `@Secured`, no programmatic check) — intent_anchor: "new SecurityRule(NO_CONTEXT, new PathPatternParserServerWebExchangeMatcher(\"/api/owners\", POST), OWNER_CREATE)" (`SecurityConstants.java:143`) — confidence: HIGH
- "Owner-creation is decoupled from user identity by design — the request body contains only `name` and optional `roles`; the controller never reads the `ServerWebExchange`'s security context; the service `OwnerServiceImpl.create` accepts only `OwnerFormData` (`OwnerServiceImpl.java:55-66`); the user→owner mapping is created only through the explicit association-request flow (`OwnerAssociationRequestServiceImpl.java:52-76`). An admin-style caller creates an Owner as a directory entry; the Owner is then claimed via a separate flow. The naming convention (`OwnerController` for the directory CRUD; `OwnerAssociationRequestController` for the user-claim flow) reinforces the separation." — evidence: `OwnerController.java:22-27` (no security-context read) + `OwnerServiceImpl.java:55-66` (no principal parameter) + `OwnerAssociationRequestServiceImpl.java:52-76` (the separate user→owner flow) — intent_anchor: separation visible across three sibling controllers (`OwnerController`, `OwnerAssociationRequestController`, `UserOwnerMappingService` callers) — confidence: HIGH
- "`ReactiveTransactional` boundary at the service, not the controller — the controller is a thin reactive proxy (`OwnerController.java:22-27`); the transaction annotation lives on `OwnerServiceImpl.create` (`OwnerServiceImpl.java:55`) so the owner-row insert, the role-link inserts, and the read-back are atomic. This pattern is consistent across the platform's `*Controller → *ServiceImpl` chain — visible here, in `AlertServiceImpl`, `OwnerAssociationRequestServiceImpl`, etc." — evidence: `OwnerController.java:21-27` (no `@Transactional`) + `OwnerServiceImpl.java:54-56` (`@ReactiveTransactional`) — intent_anchor: "@ReactiveTransactional" (`OwnerServiceImpl.java:55`) — confidence: HIGH

## bugs_limitations_corner_cases

- "OpenAPI-declared 201 Created vs implementation-returned 200 OK — the contract (`openapi.yaml` `createOwner` `responses.201` + generated `OwnerApi.java:57` `@ApiResponse(responseCode = '201')`) declares 201; the controller returns `ResponseEntity.ok` = 200 (`OwnerController.java:26`). Any contract-driven client (OpenAPI codegen, schema-aware tests, the OpenAPI page itself) will see a mismatch. Sibling create operations have the same pattern (e.g. `updateOwner` declares 201 in OpenAPI for an update — itself unusual — and the controller returns 200; out-of-scope here but reinforces a class-wide inconsistency)." — evidence: `OwnerApi.java:57` (declared 201) + `OwnerController.java:26` (`.map(ResponseEntity::ok)`) + `openapi.yaml` `/api/owners` POST `responses.201` — severity: MEDIUM
- "Name uniqueness is enforced ONLY at the DB layer, not at the contract or service layer — `owner.name` is `varchar(255) NOT NULL UNIQUE` (`V0_0_1__init.sql` `owner` table). The service does no pre-check; calling `POST /api/owners` with a duplicate name hits the database constraint and produces a 500 Internal Server Error (or whatever the default jOOQ DataAccessException → WebFlux exception mapping yields), not a graceful 409 Conflict. There is no test exercising this path." — evidence: `V0_0_1__init.sql` (`name varchar(255) NOT NULL UNIQUE`) + `OwnerServiceImpl.java:55-66` (no `getByName` precheck before `ownerRepository::create`) + `ReactiveOwnerRepositoryImpl.java:124-128` (`getByName` exists but isn't invoked by the create flow) — severity: MEDIUM
- "Soft-deleted owners block re-creation under the same name — the `owner` table's `UNIQUE` on `name` is a plain (non-partial) unique constraint (`V0_0_1__init.sql`); a soft-deleted row (`is_deleted = true` with the deleted_at field set per the soft-delete CRUD base) still holds the name and prevents `INSERT INTO owner (name, ...)` from succeeding for that name. The user-owner-mapping table received a partial-unique-index update in `V0_0_89__update_user_owner.sql` (`unique_deleted_at_per_owner ON user_owner_mapping (owner_id) WHERE deleted_at IS NULL`), but no equivalent migration was applied to the `owner` table's name index. Operators recovering from an accidental delete cannot 'just re-create' an owner with the same name." — evidence: `V0_0_1__init.sql` (`name varchar(255) NOT NULL UNIQUE` — not partial) + `V0_0_89__update_user_owner.sql:9-15` (partial-unique pattern applied to user_owner_mapping but not owner) — severity: MEDIUM
- "Owner sprawl is unbounded — there is no per-user / per-day / per-tenant rate limit on Owner creation, no max-owner cap, no audit log entry, and (cross-ref) no `@ActivityLog` annotation on `OwnerServiceImpl.create` (verified: `grep '@ActivityLog' OwnerServiceImpl.java` returned no matches). A caller with `OWNER_CREATE` permission can create owners in a loop; the only friction is the `name UNIQUE` constraint. Owner deletion is gated by foreign-key dependencies (the `delete` method checks `termOwnership / ownership / userOwnerMapping`, `OwnerServiceImpl.java:88-100`), so cleanup of an over-spammed directory is laborious." — evidence: `OwnerServiceImpl.java:55-66` (no rate limit, no audit) + `OwnerServiceImpl.java:88-100` (delete has cascade guard) + absence of `@ActivityLog` in `OwnerServiceImpl.java` (grep negative result) — severity: LOW (mitigated by the OWNER_CREATE permission gate — only callers with that permission can spam)
- "Owner creation emits NO activity-feed event — `@ActivityLog` is applied to `AlertServiceImpl`, `DataEntityServiceImpl`, `DataEntityGroupServiceImpl`, `AlertHaltConfigServiceImpl`, `DataEntityInternalStateServiceImpl` (verified by grep), but NOT to `OwnerServiceImpl.create`. The activity feed surface (`ActivityController.getActivity`, batch-A finding) therefore does not include a 'an owner named X was created by Y at T' record. From the operator's perspective: owner directory changes are invisible to the activity audit, even when they cascade into ownership-row changes that ARE recorded." — evidence: `grep '@ActivityLog' OwnerServiceImpl.java` returned no matches + `grep -l '@ActivityLog' <odd-platform-api>/service/*.java` returned only the five files above + `OwnerServiceImpl.java:55-66` (no activity emission in the create path) — severity: MEDIUM
- "Input validation for `name` is one-sided — the contract enforces `@NotNull` (`OwnerFormData.java:57`) but NOT `@NotBlank`, `@Size`, or `@Pattern`. The OpenAPI spec (`components.yaml` `OwnerFormData.properties.name`) declares `type: string` with no `minLength / maxLength / pattern`. Operators can therefore create owners named `''` (empty string), `' '` (whitespace), or names containing control characters / Unicode confusables. The DB caps at `varchar(255)` but accepts any UTF-8 payload up to that length, including names that visually collide with existing owners (homoglyph attack surface)." — evidence: `OwnerFormData.java:57-66` (`@NotNull` but no `@NotBlank` / `@Size`) + `components.yaml` `OwnerFormData.properties.name` (`type: string` only) + `V0_0_1__init.sql` (`varchar(255)`) + `OwnerServiceImpl.java:55-66` (no service-layer normalisation: no trim, no lowercase, no collision check) + `OwnerMapper.java:16` (`mapToPojo(OwnerFormData)` has no custom validator/normalizer) — severity: LOW (LOW because behind `OWNER_CREATE` permission gate; would be HIGHER on an unauthenticated path)
- "Under `auth.type=DISABLED`, the SecurityRule for `OWNER_CREATE` still nominally exists in the rules list, but the DISABLED authentication mode bypasses the entire WebFlux security filter chain (`DisabledAuthSecurityConfiguration.java:10` per batch-C sidecar). DISABLED is documented as dev-only, but operators who run with `auth.type=DISABLED` on a network-reachable port expose unauthenticated owner-creation; the Policy/Permission machinery is unreachable because there is no Policy → Role → User binding in the absence of an authenticated principal." — evidence: `SecurityConstants.java:143` (rule exists) + `DisabledAuthSecurityConfiguration.java` batch-C sidecar (DISABLED bypasses the filter chain) — severity: LOW (under DISABLED, ALL endpoints are anonymously reachable — this is a corollary of REFACTOR-073, not a unique concern of this endpoint)

## security

- **auth_mode_relevance**: `LOGIN_FORM | OAUTH2 | LDAP` (the three modes that protect the UI/API surface this controller is mounted on, per batch-C class-level sidecars for each `*SecurityConfiguration`). Under `DISABLED` the endpoint is anonymously reachable — the SecurityRule remains in the list but the filter chain doesn't run (`DisabledAuthSecurityConfiguration.java:10`). `S2S` is not relevant — S2S protects `/ingestion/entities` POST only, not `/api/owners*`. The method carries no `@ConditionalOnProperty`; auth wiring is enforced globally by the `*SecurityConfiguration` beans.
- **ingestion_filter_relevance**: `NO — UI/API surface, not /ingestion/entities`. The `IngestionDataEntitiesFilter` matches `/ingestion/entities` POST only (per batch-A class-level sidecar); `POST /api/owners` does not match.
- **authorization_assertions**:
  - "`SecurityRule(NO_CONTEXT, '/api/owners' POST, OWNER_CREATE)` — the rule is registered in `SecurityConstants.SECURITY_RULES[143]` and consumed by `AuthorizationCustomizer` to add a permission check to the WebFlux security chain. The `NO_CONTEXT` AuthorizationManagerType signals this is a global (non-per-resource) gate, evaluated against the caller's Policy/Permission set." — evidence: `SecurityConstants.java:143`
- **owner_scoping**: `N/A — code is not data-scoped` (the endpoint creates a top-level directory entry; there is no concept of "this Owner row belongs to that Owner row". Owner-scoping applies to data entities, ownership rows, and `/my*` routes that read across owners; not to Owner-directory CRUD).
- **data_exposure**:
  - "Owner payload (id, name, roles, associated_user) → caller WITH `OWNER_CREATE` permission under LOGIN_FORM/OAUTH2/LDAP via `POST /api/owners` (echoes back the created row including any pre-existing role bindings); only the just-created row is exposed, not the broader directory." — evidence: `OwnerController.java:22-27` + `OwnerServiceImpl.java:55-66` + `OwnerMapper.java:23` (`mapFromDto`) + `SecurityConstants.java:143`
  - "Same payload → ANONYMOUS callers under `auth.type=DISABLED`" — evidence: `DisabledAuthSecurityConfiguration.java:10` (per batch-C sidecar) + `SecurityConstants.java:143` (rule exists but filter chain bypassed)
- **known_security_gaps**:
  - "Owner-creation has NO audit / activity-feed event (no `@ActivityLog` on `OwnerServiceImpl.create`) — a privileged operation that creates platform-wide directory state is invisible to the audit. Sibling write operations on data-entity surface (description updates, alert status changes, ownership creations) DO emit activity events. The asymmetry is undocumented." — evidence: `OwnerServiceImpl.java:55-66` (no `@ActivityLog`) + `grep -l '@ActivityLog' <odd-platform-api>/service/*.java` (returns 5 files, none of them Owner) — severity: MEDIUM
  - "Name input validation is one-sided — `@NotNull` but no `@NotBlank`, `@Size`, `@Pattern` (`OwnerFormData.java:57`); no service-layer normalisation (`OwnerServiceImpl.java:55-66`). A caller can create owners with empty / whitespace / homoglyph / control-character names. Mitigated by the `OWNER_CREATE` permission gate (callers are pre-trusted) and by the DB's `varchar(255) UNIQUE` (length cap + dedupe by exact bytes), but a homoglyph attack against a UI rendering the owner list is unmitigated at this layer." — evidence: `OwnerFormData.java:57-66` + `OwnerServiceImpl.java:55-66` + `OwnerMapper.java:16` (no transformation) + `V0_0_1__init.sql` (`varchar(255) UNIQUE`) — severity: LOW
  - "Non-partial `name UNIQUE` on the `owner` table means a soft-deleted owner permanently blocks re-creating its name — `V0_0_1__init.sql` declares `name varchar(255) NOT NULL UNIQUE` (not a partial index); the soft-delete-aware CRUD base sets `deleted_at` but leaves the row in place. The user_owner_mapping table received a partial-unique migration (`V0_0_89__update_user_owner.sql`); the owner table did not. Operators recovering from an accidental delete encounter an opaque DB error, not a recovery path." — evidence: `V0_0_1__init.sql` (`name varchar(255) NOT NULL UNIQUE`) + `V0_0_89__update_user_owner.sql:9-15` (partial-unique applied elsewhere) + `ReactiveAbstractSoftDeleteCRUDRepository.java:50-58` (delete sets `deleted_at`) — severity: MEDIUM (not strictly a security gap, but a security-adjacent operational concern — recovery from accidental deletion is undocumented)
  - "Under `auth.type=DISABLED`, `POST /api/owners` is anonymously reachable — the SecurityRule remains in the rules list but the WebFlux filter chain doesn't run. Anonymous owner creation is then unbounded; combined with the absence of a rate limit and the absence of an audit log, the directory can be populated with arbitrary names without trace." — evidence: `DisabledAuthSecurityConfiguration.java:10` (per batch-C sidecar) + `SecurityConstants.java:143` + absence of rate limit and `@ActivityLog` in `OwnerServiceImpl.java:55-66` — severity: LOW (corollary of REFACTOR-073; DISABLED is dev-only per docs but the no-fail-fast behaviour makes accidental production exposure plausible)

## performance

- **hot_paths**: [] — N/A. Owner creation is an admin-time operation (per the live owners doc, "managed in the Management → Owners tab"), not a per-render or per-event call. The endpoint is not on the UI's hot path; no metric tracks its rate.
- **throughput_characteristics**:
  - "Single reactive call — `Mono<ResponseEntity<Owner>>`; non-blocking I/O; no thread is held during the DB awaits" — evidence: `OwnerController.java:22-26`
  - "Per-request: one INSERT into `owner`, N INSERTs into `owner_to_role` (where N = `formData.roles.size()`), one SELECT-with-joins for the read-back via `ownerRepository.getDto(id)` (`OwnerServiceImpl.java:55-66` + `ReactiveOwnerRepositoryImpl.java:66-83`). Three DB round-trips for the simple case (no roles); 2+N for the role-bearing case (the `createRelations` call may batch internally — out-of-scope to verify)." — evidence: `OwnerServiceImpl.java:55-66` + `ReactiveOwnerRepositoryImpl.java:66-83`
  - "No bulk-create variant — the contract supports one owner per request only (`OwnerFormData` carries a single `name`)" — evidence: `OwnerFormData.java:25-46` (single `name` field, not a list)
- **resource_allocation**:
  - "Per-request allocations are bounded by `formData.roles` size — the controller deserialises the JSON body via Jackson with WebFlux's default codec config (no explicit override at this method); peak memory is a small constant plus the role list. The read-back joins OWNER, OWNER_TO_ROLE, ROLE, and USER_OWNER_MAPPING — all bounded by the just-created row's relations." — evidence: `OwnerController.java:22-26` + `ReactiveOwnerRepositoryImpl.java:67-83`
- **scaling_characteristics**:
  - "Stateless controller method — horizontal scaling unconstrained at this layer" — evidence: `OwnerController.java:22-27` (no instance state)
  - "The `@ReactiveTransactional` boundary at the service holds a DB connection from the first INSERT through the role-link inserts to the read-back SELECT (`OwnerServiceImpl.java:55-66`). Under concurrent load, connection-pool contention scales with request rate × transaction duration; transaction duration grows with the role count (one extra INSERT per role)." — evidence: `OwnerServiceImpl.java:54-66`
  - "Name-uniqueness contention — the `name UNIQUE` constraint serializes concurrent inserts of the same name (one wins, others throw). Not a perf concern in practice (admin-time operation, low rate), but the synchronization point exists." — evidence: `V0_0_1__init.sql` (`name UNIQUE`)
- **known_performance_gaps**:
  - "No method-level observability — no `@Timed`, no Micrometer counter, no structured log entry beyond the default Spring access log. An admin-time operation that takes seconds to complete (DB contention, role-link cascade) would surface only in WebFlux / pool metrics, not at the operation boundary." — evidence: `OwnerController.java:22-26` + `OwnerServiceImpl.java:54-66` — severity: LOW
  - "Three round-trips for the simple case (INSERT owner; INSERT zero role-links; SELECT-with-joins read-back) — the read-back could be skipped if the response payload were built from the just-inserted POJO and a known-empty role set, saving one round-trip; the current implementation prioritises correctness of the joined `Owner` shape over latency. Acceptable for admin-time use." — evidence: `OwnerServiceImpl.java:60-65` (the explicit `getDto` read-back) — severity: LOW

## sources

- understanding ← `OwnerController.java:21-27` (the four-line method body) + `OwnerServiceImpl.java:55-66` (downstream service) + `SecurityConstants.java:143` (authorization gate) + `OwnerAssociationRequestServiceImpl.java:52-76` (the SEPARATE user→owner association flow) + WebFetch live owners doc 2026-05-12
- concepts.entities ← `OwnerController.java:6-8, 22` (`Owner`, `OwnerFormData`, `OwnerList` imports + return type) + `OwnerServiceImpl.java:60-62` (`OwnerToRole` link side effect)
- concepts.operations ← `OwnerServiceImpl.java:55-66` (the transactional shape: INSERT + role-link + read-back)
- concepts.invariants[0] ← `OwnerServiceImpl.java:54-56` (`@ReactiveTransactional`) + `OwnerController.java:21-27` (no controller-level transaction annotation)
- concepts.invariants[1] ← `OwnerApi.java:57` (declared `@ApiResponse(responseCode = '201')`) + `OwnerController.java:26` (`.map(ResponseEntity::ok)` returns 200) + `openapi.yaml` `/api/owners` POST `responses.201`
- concepts.invariants[2] ← `OwnerFormData.java:57-66` (`@NotNull` on `name`) + `OwnerFormData.java:81-90` (`requiredMode = NOT_REQUIRED` on `roles`) + `components.yaml` `OwnerFormData.properties.name` (no min/max/pattern) + `V0_0_1__init.sql` (`name varchar(255) NOT NULL UNIQUE`)
- concepts.audiences ← WebFetch live owners doc 2026-05-12 ("managed in the Management → Owners tab") + `SecurityConstants.java:143` (`OWNER_CREATE` gate)
- dependencies_semantic.requires-feature ← WebFetch live owners doc 2026-05-12 status 200 + WebFetch live permissions doc 2026-05-12 status 200 + `SecurityConstants.java:143` (the rule that enforces the permission)
- dependencies_semantic.requires-runtime[0] ← `OwnerController.java:13, 23`
- dependencies_semantic.requires-runtime[1] ← `OwnerServiceImpl.java:55-66` + `ReactiveOwnerRepositoryImpl.java:66-83`
- dependencies_semantic.requires-runtime[2] ← `V0_0_1__init.sql` (`owner` table CREATE) + `V0_0_89__update_user_owner.sql:9-15` (partial-unique applied elsewhere, NOT to owner.name)
- dependencies_semantic.couples-to[0] ← `OwnerApi.java:43-86` (the generated `@Operation` + `@RequestMapping` block for `createOwner`) + `OwnerController.java:5, 17, 21` (import, interface, `@Override`)
- dependencies_semantic.couples-to[1] ← `OwnerController.java:9, 19, 25` (`OwnerService` import, field, call) + `OwnerServiceImpl.java:55-66` (service implementation)
- dependencies_semantic.couples-to[2] ← `OwnerMapper.java:16` (`mapToPojo(OwnerFormData)`) + `OwnerServiceImpl.java:59, 65` (mapper invocations)
- dependencies_semantic.couples-to[3] ← `SecurityConstants.java:143` (the SecurityRule entry)
- dependencies_semantic.couples-to[4] ← `OwnerAssociationRequestServiceImpl.java:52-76` (the separate user→owner association flow; not called from this endpoint)
- tests_coverage_semantic.test_files ← `find <odd-platform> -path '*test*' -name 'OwnerController*'` empty result (run 2026-05-12); `grep -rln 'createOwner|OwnerService' <odd-platform>/odd-platform-api/src/test/java/` returned only `OwnershipServiceImplTest.java` (different domain) and `ReactiveOwnerAssociationRequestRepositoryImplTest.java` (association flow, not create flow)
- docs_link_semantic.inferred_docs[0] ← WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/owners` 2026-05-12 status 200
- docs_link_semantic.inferred_docs[1] ← WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions` 2026-05-12 status 200
- docs_link_semantic.doc_drift_findings[0] ← `OwnerApi.java:57` (201) vs `OwnerController.java:26` (200) + `openapi.yaml` `createOwner` `responses.201`
- docs_link_semantic.doc_drift_findings[1] ← WebFetch live owners doc 2026-05-12 (the "what's NOT covered" inventory)
- docs_link_semantic.doc_drift_findings[2] ← WebFetch live owners doc 2026-05-12 ("Every ODD Platform user should associate themselves with one of the existing owners") + `AuthIdentityProviderImpl.java:23-53` (no owner auto-creation) + `LDAPSecurityConfiguration.java` / `OAuthSecurityConfiguration.java` batch-C sidecars (no `OwnerService` injection) + `OwnerAssociationRequestServiceImpl.java:52-76` (the explicit association flow uses `getOrCreate`)
- implicit_adrs[0] ← `SecurityConstants.java:143` (rule entry) + `OwnerController.java:21-27` (no annotation on controller)
- implicit_adrs[1] ← `OwnerController.java:22-27` + `OwnerServiceImpl.java:55-66` (no principal) + `OwnerAssociationRequestServiceImpl.java:52-76` (the separate flow)
- implicit_adrs[2] ← `OwnerController.java:21-27` + `OwnerServiceImpl.java:54-56`
- bugs_limitations_corner_cases[0] ← `OwnerApi.java:57` + `OwnerController.java:26` + `openapi.yaml` `createOwner` `responses.201`
- bugs_limitations_corner_cases[1] ← `V0_0_1__init.sql` (`name UNIQUE`) + `OwnerServiceImpl.java:55-66` (no precheck) + `ReactiveOwnerRepositoryImpl.java:124-128` (`getByName` exists, unused on create)
- bugs_limitations_corner_cases[2] ← `V0_0_1__init.sql` (non-partial `name UNIQUE`) + `V0_0_89__update_user_owner.sql:9-15` (partial-unique pattern applied elsewhere) + `ReactiveAbstractSoftDeleteCRUDRepository.java:50-58` (soft-delete pattern)
- bugs_limitations_corner_cases[3] ← `OwnerServiceImpl.java:55-66` + `OwnerServiceImpl.java:88-100` (delete cascade guard) + grep negative for `@ActivityLog` in `OwnerServiceImpl.java`
- bugs_limitations_corner_cases[4] ← grep `@ActivityLog` in `OwnerServiceImpl.java` (no matches) + grep `-l @ActivityLog` across service/*.java (returns `AlertHaltConfigServiceImpl`, `AlertServiceImpl`, `DataEntityInternalStateServiceImpl`, `DataEntityServiceImpl`, `DataEntityGroupServiceImpl` only)
- bugs_limitations_corner_cases[5] ← `OwnerFormData.java:57-66` + `components.yaml` `OwnerFormData.properties.name` + `V0_0_1__init.sql` (`varchar(255)`) + `OwnerServiceImpl.java:55-66` + `OwnerMapper.java:16`
- bugs_limitations_corner_cases[6] ← `SecurityConstants.java:143` (rule presence) + `DisabledAuthSecurityConfiguration.java:10` batch-C sidecar (filter chain bypass)
- security.auth_mode_relevance ← `OwnerController.java:21-27` (no `@ConditionalOnProperty`) + batch-C class-level sidecars for `LoginFormSecurityConfiguration` / `OAuthSecurityConfiguration` / `LDAPSecurityConfiguration` / `DisabledAuthSecurityConfiguration`
- security.ingestion_filter_relevance ← batch-A `IngestionDataEntitiesFilter` class-level sidecar (path-matcher `/ingestion/entities` POST only)
- security.authorization_assertions[0] ← `SecurityConstants.java:143`
- security.owner_scoping ← `OwnerController.java:21-27` (no data-scoping concept at the directory-CRUD layer)
- security.data_exposure[0] ← `OwnerController.java:22-27` + `OwnerServiceImpl.java:55-66` + `OwnerMapper.java:23` + `SecurityConstants.java:143`
- security.data_exposure[1] ← `DisabledAuthSecurityConfiguration.java:10` (per batch-C sidecar) + `SecurityConstants.java:143`
- security.known_security_gaps[0] ← `OwnerServiceImpl.java:55-66` (no `@ActivityLog`) + grep across `service/*.java`
- security.known_security_gaps[1] ← `OwnerFormData.java:57-66` + `OwnerServiceImpl.java:55-66` + `OwnerMapper.java:16` + `V0_0_1__init.sql`
- security.known_security_gaps[2] ← `V0_0_1__init.sql` + `V0_0_89__update_user_owner.sql:9-15` + `ReactiveAbstractSoftDeleteCRUDRepository.java:50-58`
- security.known_security_gaps[3] ← `DisabledAuthSecurityConfiguration.java:10` batch-C sidecar + `SecurityConstants.java:143`
- performance.throughput_characteristics[0] ← `OwnerController.java:22-26`
- performance.throughput_characteristics[1] ← `OwnerServiceImpl.java:55-66` + `ReactiveOwnerRepositoryImpl.java:66-83`
- performance.throughput_characteristics[2] ← `OwnerFormData.java:25-46` (single-name request shape)
- performance.resource_allocation[0] ← `OwnerController.java:22-26` + `ReactiveOwnerRepositoryImpl.java:67-83`
- performance.scaling_characteristics[0] ← `OwnerController.java:21-27`
- performance.scaling_characteristics[1] ← `OwnerServiceImpl.java:54-66`
- performance.scaling_characteristics[2] ← `V0_0_1__init.sql` (`name UNIQUE`)
- performance.known_performance_gaps[0] ← `OwnerController.java:22-26` + `OwnerServiceImpl.java:54-66`
- performance.known_performance_gaps[1] ← `OwnerServiceImpl.java:60-65`

## confidence_per_field

- understanding: HIGH (every claim verified against the controller, the service, the security rule list, the OpenAPI spec, the database schema, and the WebFetched live docs)
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH (absence-of-tests verified by file-system search and grep)
- docs_link_semantic: MEDIUM (no `@docs` annotation in source; both URLs WebFetched 2026-05-12 status 200; the binding endpoint→doc is enricher judgment but anchored on the explicit `OWNER_CREATE` permission name)
- implicit_adrs: HIGH (the centralised-`SECURITY_RULES` pattern, the controller→service identity-decoupling, and the service-layer `@ReactiveTransactional` are all directly visible at cited lines, with the third confirmed as a cross-controller convention)
- bugs_limitations_corner_cases: HIGH (every concern cited file:line against the controller, service, mapper, model, schema, and migration history; the activity-feed absence verified by grep across all `service/*.java`)
- security: HIGH (every claim is structural and traces to `OwnerController`, `OwnerServiceImpl`, `OwnerFormData`, `SecurityConstants`, the database migrations, the related batch-A/B/C sidecars, and the live authorization/permissions doc pages)
- performance: HIGH (the throughput/round-trip shape is directly visible at the service and repository; the absence of observability and the read-back-cost decision are both anchored in the cited code)

## Maintainer notes

