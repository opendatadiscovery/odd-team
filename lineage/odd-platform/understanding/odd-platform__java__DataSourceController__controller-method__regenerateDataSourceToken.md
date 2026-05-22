---
node_id: "odd-platform java DataSourceController controller-method:regenerateDataSourceToken"
node_kind: controller-method
axis: controllers
extracted_at_commit: 80637ed
enriched_at_commit: 80637ed
extractor_version: 0.1.0
prompt_version: file-analyser/0.5.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-21-batch-ZB-regenerateDataSourceToken
---

# DataSourceController.regenerateDataSourceToken — semantic understanding

## understanding

Reactive HTTP handler for `PUT /api/datasources/{data_source_id}/token` (OpenAPI
`operationId: regenerateDataSourceToken`, `openapi.yaml:507-525`): rotates the shared-secret
bearer token a Push-client / Collector-backed data source uses to authenticate
`POST /ingestion/entities` against the S2S `IngestionDataEntitiesFilter`. The 5-line
controller body (`DataSourceController.java:53-59`) is a pure proxy — it delegates to
`DataSourceService.regenerateDataSourceToken(dataSourceId)` and wraps the result in
`ResponseEntity::ok`. The service (`DataSourceServiceImpl.java:99-106`) loads the existing
`DataSourceDto`, hands its `TokenPojo` to `tokenGenerator.regenerateToken` (an in-memory
mutation), persists via `tokenRepository.updateToken` (a single jOOQ `UPDATE token SET
value=<new> WHERE id=:id`), and returns the refreshed `DataSource` whose `token.value` carries
the **new 40-character plaintext token in clear text** (`showToken=true` on the rotation path).
Rotation is a destructive **in-place UPDATE**: the old token value is overwritten with no
grace window, no old/new overlap, and no separate revoke step. **Load-bearing finding,
primary-source confirmed for this batch**: the service method `regenerateDataSourceToken` is
**NOT `@ReactiveTransactional`** (`DataSourceServiceImpl.java:99` — the surrounding `create` at
line 52, `update` at line 69, `delete` at line 86 ALL carry the annotation) — the missing
annotation is a code-shape inconsistency, though the single-statement DB write makes the
rotation atomic at the database level regardless (see `stress_findings.resource_boundaries`).

## concepts

- entities:
  - "DataSource (OpenAPI response model `org.opendatadiscovery.oddplatform.api.contract.model.DataSource`; carries the refreshed token in `token.value`)"
  - "DataSourceDto (record `DataSourceDto(DataSourcePojo dataSource, NamespacePojo namespace, TokenDto token)` — DataSourceDto.java:6; the service rebuilds it with the new TokenDto at DataSourceServiceImpl.java:104)"
  - "TokenPojo (the `token` table row — value + createdAt/By + updatedAt/By; 1:1 with the data_source via DataSourcePojo.token_id)"
  - "TokenDto (record wrapping TokenPojo + a `showToken` boolean; `updateToken` returns it with showToken=true — ReactiveTokenRepositoryImpl.java:38)"
  - "Token (40-char alphanumeric shared secret — `RandomStringUtils.randomAlphanumeric(40)` at TokenGeneratorImpl.java:49)"
- operations:
  - "regenerate-data-source-token (PUT /api/datasources/{data_source_id}/token — rotate the ingestion credential)"
  - "issue-in-place (UPDATE the existing token row's value; not append-new)"
  - "return-plaintext-token (the response body carries the new secret unmasked so the operator can copy it)"
- invariants:
  - "Endpoint is gated by Permission `DATA_SOURCE_TOKEN_REGENERATE` (MANAGEMENT tier) via SecurityConstants.SECURITY_RULES (SecurityConstants.java:124-126 + PolicyPermissionDto.java:54) — no @PreAuthorize on the controller, no programmatic permission check."
  - "Rotation is an in-place UPDATE of the single `token` row joined to the data source — there is NO window where both old and new tokens validate, and NO `previous_token` / `valid_until` column anywhere in the schema."
  - "The new token is RETURNED in the response body in plaintext (40 alphanumeric chars; showToken=true on the regenerate path) and stored likewise in plaintext in the `token` table — no hashing layer."
  - "404 NotFoundException if `data_source_id` does not resolve (DataSourceServiceImpl.java:101 `switchIfEmpty(Mono.error(new NotFoundException(\"Data source\", id)))`)."
  - "RuntimeException(\"Token is null\") if the resolved data source has no token row (TokenGeneratorImpl.java:45-47) — maps to HTTP 500 via the catch-all ControllerAdvice handler (ControllerAdvice.java:61-66)."
- audiences:
  - "platform-operator (rotates a leaked / scheduled-rotation data-source token from the Management → Datasources tab; the tab's screenshot caption per WebFetch 2026-05-21 status 200 of features/management notes 'a partially-redacted Collector token with a Regenerate action')"
  - "odd-api-consumer (an S2S X-API-Key caller — under auth.s2s.enabled, the ADMIN identity satisfies DATA_SOURCE_TOKEN_REGENERATE)"
  - "odd-collector / push-client (NOT a caller — the downstream consumer of the rotated credential; its next POST /ingestion/entities with the stale token starts failing)"

## dependencies_semantic

- requires-feature:
  - "`DataSourceApi` OpenAPI-generated interface (DataSourceController implements it at line 18) — the HTTP method/path/operationId for this endpoint come from `odd-platform-specification/openapi.yaml:507-525`, NOT from a @PutMapping on the controller."
  - "`DataSourceService.regenerateDataSourceToken(long id)` (interface DataSourceService.java:21; impl DataSourceServiceImpl.java:99-106) — owns the entire rotation flow: load DTO, regenerate, persist, remap."
  - "`TokenGenerator` bean (TokenGeneratorImpl.java:26-32) — `regenerateToken(TokenPojo)` mutates the passed-in pojo in place (`setValue(RandomStringUtils.randomAlphanumeric(40)).setUpdatedAt(now).setUpdatedBy(username)`); throws `RuntimeException(\"Token is null\")` if the pojo is null (line 45-47)."
  - "`ReactiveTokenRepository.updateToken(TokenPojo)` (ReactiveTokenRepositoryImpl.java:30-39) — issues `DSL.update(TOKEN).set(record).where(TOKEN.ID.eq(id)).returning()` and re-reads into a TokenDto with showToken=true."
  - "`SecurityConstants.SECURITY_RULES` (SecurityConstants.java:124-126) — the (path, method, permission) tuple `(/api/datasources/{data_source_id}/token, PUT, DATA_SOURCE_TOKEN_REGENERATE)`; enforced by AuthorizationCustomizer before the controller is reached."
  - "`ControllerAdvice` (ControllerAdvice.java:30-34 maps NotFoundException → 404; lines 61-66 map any other Exception including the TokenGenerator RuntimeException → 500)."
- requires-config:
  - "`auth.type` (DISABLED / LOGIN_FORM / OAUTH2 / LDAP) — gates whether the SecurityConstants permission rule is enforced. Under LOGIN_FORM/OAUTH2/LDAP the caller must hold DATA_SOURCE_TOKEN_REGENERATE. Under DISABLED the SecurityConstants rule chain is bypassed entirely — any caller reaching the platform can rotate any data source's token (see security.known_security_gaps)."
  - "`auth.s2s.enabled` (default false) — when true an X-API-Key caller is granted ADMIN identity, which satisfies the MANAGEMENT-tier DATA_SOURCE_TOKEN_REGENERATE permission regardless of any per-user policy."
  - "`auth.ingestion.filter.enabled` — gates registration of `IngestionDataEntitiesFilter` (@ConditionalOnProperty at IngestionDataEntitiesFilter.java:20). Only when true does the rotated data-source token actually matter for ingestion authentication; when false, `/ingestion/entities` is unauthenticated and the token is inert."
- requires-runtime:
  - "Spring WebFlux + Reactor — the controller returns `Mono<ResponseEntity<DataSource>>`; the chain is non-blocking."
  - "jOOQ-on-R2DBC — `updateToken` is a reactive jOOQ UPDATE. NOTE: the service method is NOT @ReactiveTransactional, so no R2DBC transaction boundary wraps the call (the single UPDATE is still atomic at the statement level)."
  - "ReactiveSecurityContextHolder — the principal propagates implicitly; TokenGeneratorImpl reads `AuthIdentityProvider.getCurrentUser()` purely to stamp `token.updated_by` (TokenGeneratorImpl.java:28-31), NOT for authorization."
- coupling:
  - "The rotated data-source token is consumed by `IngestionDataEntitiesFilter` for `POST /ingestion/entities` (IngestionDataEntitiesFilter.java:43-58): the filter resolves `dataSourceRepository.getDtoByOddrn(...)`, takes `dto.token()` if non-null, and does a literal plaintext `.equals(token)` (line 56-57) — throwing `AccessDeniedException(\"Token is not correct\")` on mismatch. The moment `updateToken` commits, an in-flight ingestion request carrying the old token starts 401-ing."
  - "Token-rotation does NOT route through `IngestionDataSourceFilter` (which validates the COLLECTOR token via `collectorRepository.getByToken` — IngestionDataSourceFilter.java:33). The data-source token and the collector token are distinct credentials; this endpoint rotates ONLY the data-source token."
  - "Path mapping is OpenAPI-contract-driven; RBAC coupling is declarative via SecurityConstants. Adding/renaming this endpoint requires coordinated changes in openapi.yaml + the controller + SecurityConstants + PolicyPermissionDto (the FAIL-OPEN risk the class sidecar documents)."

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - behaviour: "Happy-path rotation: PUT /api/datasources/{id}/token returns 200 with a DataSource whose token.value differs from the previous value and is a full 40-char plaintext string."
    test_class: integration
    criticality: HIGH
    note: "No DataSourceControllerTest / DataSourceServiceImplTest exists (class sidecar verified by Glob — all return 'No files found')."
  - behaviour: "404 on rotation of a non-existent data_source_id: PUT /api/datasources/999999/token returns 404 NotFoundException."
    test_class: integration
    criticality: MEDIUM
    note: "DataSourceServiceImpl.java:101 switchIfEmpty path."
  - behaviour: "500 when the resolved data source has a null token: confirm RuntimeException(\"Token is null\") (TokenGeneratorImpl.java:45-47) maps to HTTP 500. This is an unguarded data-integrity edge — a data_source row with token_id pointing at a deleted/absent token."
    test_class: unit
    criticality: MEDIUM
    note: "TokenGeneratorImpl.regenerate(null) throws; the controller surfaces it as an opaque 500."
  - behaviour: "Destructive rotation cross-path: after PUT /api/datasources/{id}/token, the OLD token receives 401 on POST /ingestion/entities and the NEW token receives non-401."
    test_class: integration
    criticality: CRITICAL
    note: "The single most operationally important uncovered behaviour — pinned by probe P-051."
  - behaviour: "Missing @ReactiveTransactional: if tokenRepository.updateToken fails (mock DB failure) after tokenGenerator.regenerateToken succeeds in-memory, confirm the response is 500 AND the OLD token is still valid in DB (no partial write because regenerate is in-memory-only and updateToken is a single statement)."
    test_class: integration
    criticality: MEDIUM
    note: "Verifies the no-partial-write claim; the in-memory regenerate cannot leave half-written DB state."
  - behaviour: "Concurrent double-rotation: two simultaneous PUTs against the same data source — last-write-wins, both responses carry distinct plaintext tokens, only the later-committed value authenticates ingestion, no duplicate token row."
    test_class: integration
    criticality: HIGH
    note: "Pinned by probe P-050."
  - behaviour: "RBAC matrix: a LOGIN_FORM user WITHOUT DATA_SOURCE_TOKEN_REGENERATE gets 403; WITH it gets 200; unauthenticated gets 401; under auth.type=DISABLED any caller gets 200 (permission bypass)."
    test_class: security
    criticality: CRITICAL
    note: "Pinned by probe P-052 — credential-rotation-hijack surface under DISABLED."
  - behaviour: "Activity Feed audit gap: rotation emits NO Activity Event (no activityEventEmitter call in DataSourceServiceImpl)."
    test_class: integration
    criticality: MEDIUM
    note: "Class sidecar verified the absence by Grep; security incident review cannot reconstruct rotation history."
- test_files:
  - "NO file named DataSourceControllerTest.* exists (class sidecar verified by Glob)."
  - "NO file named DataSourceServiceImplTest.* / DataSourceServiceTest.* exists (class sidecar verified)."
  - "NO file named TokenGeneratorImplTest.* exists (verified by Glob this batch — `**/TokenGenerator*Test*.java` returns no files)."
  - "<odd-platform-repo>/odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/CollectorRepositoryImplTest.java — repository-layer test for the analogous Collector path; does NOT exercise the data-source token-rotation flow."
- gaps: |
    The token-regeneration path has ZERO direct test coverage at controller, service,
    repository, and integration layers. The worst-covered class is `security` — the
    32-cell auth matrix (permission present/absent x 4 auth modes) is entirely untested
    and the DISABLED-bypass is a credential-rotation-hijack surface (a security gap, not
    a hypothetical). The highest-leverage single test is the cross-path destructive-rotation
    integration test (P-051): rotate → old-token-401-on-ingestion → new-token-200. That one
    test protects the load-bearing operator contract (rotation invalidates the old credential)
    AND would catch a regression that flips the response token to masked (breaking the
    operator's copy-to-clipboard flow). The class sidecar already records an open CRITICAL
    test-gap for this method; this method sidecar refines it with the specific probe ids
    (P-050/P-051/P-052) and test classes.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions"
    anchor: ""
    rationale: "WebFetched 2026-05-21 (status 200) — this page enumerates `DATA_SOURCE_TOKEN_REGENERATE` verbatim as a Management-tier permission, which is the live authorization gate for this endpoint per SecurityConstants.java:124-126. It names the permission but gives no operational guidance (no grace period, no plaintext-in-response shape, no DISABLED-bypass warning, no concurrent-rotation behaviour)."
    last_verified_at: "2026-05-21T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
    fetched_excerpts: |
      Verbatim, WebFetched 2026-05-21 (status 200): "DATA_SOURCE_TOKEN_REGENERATE. Allows regenerating the security token for a data source."
      Verbatim (same page): "COLLECTOR_TOKEN_REGENERATE. Allows regenerating the security token for a collector."
      The page lists both under the Management permissions section; it does NOT describe the operational mechanics of rotation (in-place destructive UPDATE, no grace period, plaintext-in-response, DISABLED-mode bypass, concurrent-rotation last-write-wins).
  - url: "https://docs.opendatadiscovery.org/features/management"
    anchor: ""
    rationale: "WebFetched 2026-05-21 (status 200) — describes the Management → Datasources tab as the operator surface and references a 'Regenerate action' in a screenshot caption, but does NOT document what rotation does to active ingestion, grace periods, or warnings."
    last_verified_at: "2026-05-21T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
    fetched_excerpts: |
      Verbatim, WebFetched 2026-05-21 (status 200): "Issue new tokens, view existing token IDs, regenerate or revoke." (Collectors tab description)
      Verbatim (Datasources tab screenshot caption): "a partially-redacted Collector token with a Regenerate action".
      The page does NOT cover: what happens to active ingestion when a token is rotated, token grace periods, or warnings about ongoing data ingestion during token rotation.
- doc_drift_findings:
  - "The Permissions page (WebFetched 2026-05-21, status 200) names DATA_SOURCE_TOKEN_REGENERATE but documents none of the operationally load-bearing facts: (a) rotation is a DESTRUCTIVE in-place UPDATE — the old token is irrecoverable with no grace period; (b) a collector / push-client still using the old token starts failing `POST /ingestion/entities` with 401 `Token is not correct` the instant rotation commits (IngestionDataEntitiesFilter.java:56-57); (c) the new token is returned in PLAINTEXT in the response body; (d) under auth.type=DISABLED the permission gate is bypassed entirely. A 'Token rotation' operational section under enable-security would be the canonical home — currently no live page covers it."
  - "The Management page (WebFetched 2026-05-21, status 200) shows a 'Regenerate action' in the Datasources-tab screenshot caption but provides zero operational guidance — an operator clicking Regenerate has no warning from the docs that they will lock out a running collector. This is a documented-feature gap: the affordance is visible in the product and the screenshot, but the consequence is undocumented."

## implicit_adrs

- "Token rotation is an in-place UPDATE of the existing token row, not an append-new-then-revoke-old transition" — evidence: ReactiveTokenRepositoryImpl.java:30-39 (`updateToken` issues `DSL.update(TOKEN).set(record).where(TOKEN.ID.eq(id))`) + TokenGeneratorImpl.java:44-52 (`regenerate(...)` mutates the passed-in TokenPojo in place) — intent_anchor: the repository method is named `updateToken` (not `replaceToken` / `revokeAndIssue`) and the generator method is `regenerateToken` (not `rotateToken` / `issueNewToken`) — the vocabulary encodes the in-place semantic; the schema has one `token` row per data_source (1:1 via DataSourcePojo.token_id), so an append model is structurally impossible without a schema change — confidence: HIGH
- "Authorization for token rotation is wired declaratively in SecurityConstants.SECURITY_RULES, not via a @PreAuthorize on the controller method" — evidence: SecurityConstants.java:124-126 (`new SecurityRule(NO_CONTEXT, PathPatternParser(\"/api/datasources/{data_source_id}/token\", PUT), DATA_SOURCE_TOKEN_REGENERATE)`) + DataSourceController.java:53-59 (no annotation, no programmatic check) — intent_anchor: the entire SecurityConstants.SECURITY_RULES list is the file-scoped registry of (path, method, permission) tuples; using `NO_CONTEXT` (path-based, not entity-context-scoped) is the consistent pattern across every mutating endpoint in the platform — confidence: HIGH
- "The rotated token is returned in plaintext on the rotation response; masked on read paths" — evidence: ReactiveTokenRepositoryImpl.java:38 (`updateToken` returns `new TokenDto(r.into(TokenPojo.class), true)` — showToken=true) — intent_anchor: the TokenDto's 2-arg constructor takes an explicit `showToken` boolean and `updateToken` deliberately passes `true`; the design treats token visibility as a per-call-site choice — plaintext on regenerate is intentional because the operator has no other way to learn the new secret — confidence: HIGH

## bugs_limitations_corner_cases

- "The service method `DataSourceServiceImpl.regenerateDataSourceToken` (line 99-106) is NOT `@ReactiveTransactional`, unlike the sibling `create` (line 52), `update` (line 69), `delete` (line 86) which ALL carry the annotation. Confirmed primary-source this batch by reading DataSourceServiceImpl.java end-to-end. The missing annotation is a code-shape inconsistency; it does NOT currently produce a partial-write bug because the only DB write (`tokenRepository.updateToken`) is a single jOOQ UPDATE statement (atomic at the DB level) and `tokenGenerator.regenerateToken` is a purely in-memory mutation. The risk is latent: a future change that adds a second write to this method (an audit-log insert, a notification dispatch, an FTS refresh) would NOT be wrapped in a transaction and could half-commit." — evidence: DataSourceServiceImpl.java:98-106 (no annotation) vs lines 52, 69, 86 (annotated) — severity: LOW
- "No rotation grace period — rotation is a destructive in-place UPDATE with no old/new overlap. A collector / push-client still using the old token starts failing `POST /ingestion/entities` with 401 `Token is not correct` the moment the UPDATE commits (IngestionDataEntitiesFilter.java:56-57). An operator rotating a data-source token during active ingestion locks out ingestion until the collector picks up the new token (typically a config-file change + restart). No warning is logged, no notification fires, the docs do not document it." — evidence: ReactiveTokenRepositoryImpl.java:30-39 (UPDATE, not INSERT) + IngestionDataEntitiesFilter.java:43-58 (single-value plaintext equality) — severity: HIGH
- "Under auth.type=DISABLED the SecurityConstants permission rule chain is bypassed entirely — any caller able to reach the platform can rotate ANY data source's token and receive the new plaintext credential in the response. This is a credential-rotation-hijack surface: an attacker on a DISABLED deployment can break ingestion platform-wide and harvest the new tokens. (Mirrors the CollectorController.regenerateCollectorToken sibling sidecar's DISABLED-bypass HIGH finding.)" — evidence: SecurityConstants.java:124-126 (rule is enforced only by the LOGIN_FORM/OAUTH2/LDAP security configs) + TokenGeneratorImpl.java:31 (no-current-user fallback `regenerate(tokenPojo, null)` — rotation succeeds with `updated_by` NULL) — severity: HIGH (in DISABLED deployments) / N/A (LOGIN_FORM/OAUTH2/LDAP/S2S)
- "Token rotation emits NO Activity Event and writes NO audit log line. The `token` row's `updated_by` column (stamped from `AuthIdentityProvider.getCurrentUser()` at TokenGeneratorImpl.java:30) is the ONLY forensic trail, and it is OVERWRITTEN on the next rotation — the audit record is single-state, not append-only. A security review of 'who rotated data-source token X, and who rotated it before that' cannot be answered from production data. No `log.info/warn` exists on the path (DataSourceController / DataSourceServiceImpl / TokenGeneratorImpl / ReactiveTokenRepositoryImpl carry no log call on the rotation path)." — evidence: TokenGeneratorImpl.java:44-52 (no log; `updated_by` overwritten in place) + DataSourceServiceImpl.java:99-106 (no activityEventEmitter, no log) — severity: HIGH
- "The new token is returned in the response body in plaintext (40 alphanumeric chars). Any reverse-proxy, API-gateway, browser response cache, or server-side response-body logging between the UI and the backend records the new credential. The controller sets no response header marking the body sensitive (no `Cache-Control: no-store`) — DataSourceController.java:56-58 is a bare `.map(ResponseEntity::ok)`." — evidence: DataSourceController.java:56-58 + ReactiveTokenRepositoryImpl.java:38 (showToken=true) — severity: MEDIUM
- "Token entropy uses `RandomStringUtils.randomAlphanumeric(40)` (TokenGeneratorImpl.java:49) which is NOT a cryptographically-secure RNG by default (commons-lang 3.16+ uses ThreadLocalRandom unless the `.secure()` variant is used). A regenerated ingestion credential should be drawn from `SecureRandom`. (Same finding as the CollectorController sibling sidecar — the two share TokenGeneratorImpl.)" — evidence: TokenGeneratorImpl.java:49 (`setValue(RandomStringUtils.randomAlphanumeric(40))`) — severity: HIGH
- "No rate-limit and no `If-Match` ETag on the PUT. (a) An attacker with a stolen session of a DATA_SOURCE_TOKEN_REGENERATE-holding user can rotate every data source's token in a tight loop, breaking ingestion platform-wide. (b) A UI double-submit (slow click, network retry) rotates the token twice — the value the operator copied from the first response is invalidated by the second before they can use it. No comment / backlog item defends either absence." — evidence: DataSourceController.java:53-59 (no @RateLimited, no header consulted) + SecurityConstants.java:124-126 (no throttle metadata) — severity: MEDIUM
- "If the resolved data source's `token` is null (a data_source row whose token_id points at a missing/deleted token), `tokenGenerator.regenerateToken(dto.token().tokenPojo())` first NPEs on `dto.token()` being null OR `TokenGeneratorImpl.regenerate` throws `RuntimeException(\"Token is null\")` (line 45-47). Either way the operator gets an opaque HTTP 500 'Internal Server Error' (ControllerAdvice.java:61-66) with no actionable message — the data source cannot have its token rotated and the error does not say why." — evidence: DataSourceServiceImpl.java:102 (`dto.token().tokenPojo()` — no null guard on `dto.token()`) + TokenGeneratorImpl.java:45-47 — severity: LOW

## stress_findings

```yaml
stress_findings:
  tunables:
    - location: "TokenGeneratorImpl.java:49"
      name: "token length (RandomStringUtils.randomAlphanumeric argument)"
      value: "40"
      questions:
        - q: "What at N > tunable? (e.g. token length far above 40)"
          a: "Not operator-controllable — 40 is a hardcoded literal, not a config key. A longer token would still flow through the same plaintext column and the same .equals() check; no behavioural boundary. Recorded for completeness."
          confidence: STATIC-INFERRED
          evidence: "TokenGeneratorImpl.java:49 (literal 40, not a @Value)"
        - q: "What at tunable x 100?"
          a: "N/A — not a runtime-variable quantity. The 40 is fixed at compile time."
          confidence: STATIC-INFERRED
          evidence: "TokenGeneratorImpl.java:49"
        - q: "What does the operator see at each boundary?"
          a: "No operator-visible boundary — the token length is invariant. The operator-relevant tunable-shaped concern is the RNG quality (RandomStringUtils default is not SecureRandom), recorded as a HIGH security gap, not a tunable boundary."
          confidence: STATIC-INFERRED
          evidence: "TokenGeneratorImpl.java:49"
  name_behavior_pairs:
    - name: "regenerateDataSourceToken"
      promise: "Regenerate (rotate) the data source's token — the name implies the old token stops working and a new one starts working."
      implementation: "Loads the DataSourceDto; calls tokenGenerator.regenerateToken which mutates the existing TokenPojo in place (setValue(new random 40 chars)); calls tokenRepository.updateToken which issues a single `UPDATE token SET value=<new> WHERE id=:id`. There is exactly ONE token row; the UPDATE overwrites the old value. The name is honest: rotation = issue-the-new-value-into-the-same-row, which simultaneously revokes the old value because the old value no longer exists anywhere."
      drift: NONE
      operator_visible_consequence: ""
      confidence: STATIC-INFERRED
      evidence: "DataSourceServiceImpl.java:99-106 + TokenGeneratorImpl.java:44-52 + ReactiveTokenRepositoryImpl.java:30-39"
    - name: "regenerate (revoke-then-issue vs issue-then-revoke vs only-issue?)"
      promise: "A 'regenerate' could mean any of the three sequencings; an operator needs to know which."
      implementation: "Neither revoke-then-issue NOR issue-then-revoke as separable steps — it is a SINGLE in-place UPDATE that writes the new value over the old. There is no separate revoke statement and no separate issue statement; revocation of the old token is a side effect of overwriting it. Consequence: there is no instant where zero valid tokens exist and no instant where two valid tokens exist — the transition is atomic at the UPDATE statement."
      drift: NONE
      operator_visible_consequence: "The operator should understand rotation is instantaneous and binary, not a staged revoke/issue — there is no grace window to coordinate the collector restart."
      confidence: STATIC-INFERRED
      evidence: "ReactiveTokenRepositoryImpl.java:33-38 (single DSL.update statement)"
  orderings: []
  auth_gates:
    - location: "SecurityConstants.java:124-126"
      endpoint: "PUT /api/datasources/{data_source_id}/token"
      questions:
        - q: "What does this endpoint return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "LOGIN_FORM/OAUTH2/LDAP: a caller holding the MANAGEMENT-tier DATA_SOURCE_TOKEN_REGENERATE permission gets 200 + the new plaintext token; a caller without it gets 403 (the path-based ReactiveAuthorizationManager rejects before the controller). DISABLED: the SecurityConstants rule chain is not enforced — any caller gets 200 + the new plaintext token (permission bypass). The 200/403 split for the permission matrix is PROBE-NEEDED — the path-rule-to-403 mapping is inferred from the SecurityConstants pattern but not statically provable end-to-end without the AuthorizationCustomizer + ReactiveAuthorizationManagerFactory wiring."
          confidence: PROBE-NEEDED
          evidence: "P-052"
        - q: "What does an unauthenticated caller see?"
          a: "Under LOGIN_FORM/OAUTH2/LDAP an unauthenticated caller (no session cookie / no token) is rejected by the security filter chain with 401 before the controller is reached — the endpoint is not on any WHITELIST_PATHS entry. Under DISABLED there is no authentication so 'unauthenticated' is the normal state and the caller gets 200."
          confidence: PROBE-NEEDED
          evidence: "P-052"
        - q: "What does a wrong-role caller see?"
          a: "A user authenticated but whose Policy does not grant DATA_SOURCE_TOKEN_REGENERATE (e.g. a READ_ONLY-equivalent user) is rejected — expected 403 from the path-based authorization manager. Pinned by P-052."
          confidence: PROBE-NEEDED
          evidence: "P-052"
        - q: "Where does the gate live — controller, service, repository, or nowhere?"
          a: "The gate lives ONLY in SecurityConstants.SECURITY_RULES (SecurityConstants.java:124-126) — a declarative (path, method, permission) tuple enforced by the security filter chain BEFORE the controller. There is NO @PreAuthorize on DataSourceController.regenerateDataSourceToken, NO programmatic permissionService check in DataSourceServiceImpl.regenerateDataSourceToken, and NO owner-scoping filter in the repository. If the SecurityConstants entry were deleted/typo'd, the endpoint would silently fall back to authenticated-only (fail-open) — the class sidecar documents this as the FAIL-OPEN coupling risk."
          confidence: STATIC-INFERRED
          evidence: "SecurityConstants.java:124-126 + DataSourceController.java:53-59 (no annotation) + DataSourceServiceImpl.java:99-106 (no programmatic check)"
  resource_boundaries:
    - location: "DataSourceServiceImpl.java:99-106"
      kind: transactional
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "No corrupted state and no duplicate row: there is exactly one `token` row per data source (1:1 via token_id) and `updateToken` issues `UPDATE ... WHERE TOKEN.ID.eq(id)` — two simultaneous rotations both UPDATE the same row, last-write-wins. There is NO @Version column and NO optimistic-lock predicate (ReactiveTokenRepositoryImpl.java:33-36), so no lost-update is DETECTED, but the row is never corrupted — it always holds exactly one valid token value. The observable defect of the race is that caller A and caller B each receive a DIFFERENT plaintext token in their 200 response, and only the later-committed value actually authenticates ingestion; the caller who lost the race walks away believing an already-invalid token. The exact authoritative-response determination requires runtime."
          confidence: PROBE-NEEDED
          evidence: "P-050"
        - q: "Is the call replay-safe?"
          a: "No — the PUT is not idempotent. Each call generates a fresh random token and overwrites the row. Replaying the same request (UI double-submit, network retry, client retry-on-timeout) rotates the token AGAIN, invalidating the value returned by the first call. There is no idempotency key and no If-Match ETag (DataSourceController.java:53-59 consults no header). Recorded as a MEDIUM bug."
          confidence: STATIC-INFERRED
          evidence: "DataSourceController.java:53-59 + TokenGeneratorImpl.java:44-52 (fresh random per call)"
        - q: "If a cache fronts this, what is the TTL / eviction key / staleness window?"
          a: "No cache fronts this write path. The endpoint is a write (PUT) and the service has no @Cacheable. N/A."
          confidence: STATIC-INFERRED
          evidence: "DataSourceServiceImpl.java:99-106 (no @Cacheable, no manual cache write)"
    - location: "DataSourceServiceImpl.java:99 (missing @ReactiveTransactional)"
      kind: transactional
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "The missing @ReactiveTransactional does NOT change the concurrency answer above — the single UPDATE is atomic at the statement level whether or not a transaction wraps it. The annotation's absence matters only for MULTI-statement futures (see below)."
          confidence: STATIC-INFERRED
          evidence: "DataSourceServiceImpl.java:99-106 (single write: tokenRepository.updateToken) vs sibling create/update/delete at lines 52/69/86 (all @ReactiveTransactional)"
        - q: "Is the call replay-safe?"
          a: "Replay-safety is unaffected by the missing annotation — see the replay answer above (not idempotent regardless)."
          confidence: STATIC-INFERRED
          evidence: "DataSourceServiceImpl.java:99-106"
        - q: "What is the partial-write window if the write fails midway? (the batch-prompt atomicity question)"
          a: "Trace: regenerateDataSourceToken does (1) dataSourceRepository.getDto(id) — a READ; (2) tokenGenerator.regenerateToken — a PURELY IN-MEMORY mutation of the TokenPojo, NO DB write; (3) tokenRepository.updateToken — the ONLY DB write, a single jOOQ UPDATE. Because step 2 is in-memory and step 3 is one atomic statement, there is NO partial-write window: either the UPDATE commits (new token persisted, old gone) or it fails (old token entirely intact in DB). There is NO state where the old token is invalidated but the new one is not persisted — that failure mode the batch prompt asked about CANNOT occur with the current single-statement implementation. If updateToken fails, the operator sees a 500 and the OLD token remains fully valid; the next retry succeeds. The missing @ReactiveTransactional is therefore a latent-risk code-smell (a future second write would not be atomic) NOT an active atomicity bug. P-051 verifies the binary cutover; P-050 verifies no-corruption under concurrency."
          confidence: STATIC-INFERRED
          evidence: "DataSourceServiceImpl.java:99-106 + TokenGeneratorImpl.java:44-52 (in-memory) + ReactiveTokenRepositoryImpl.java:30-39 (single UPDATE)"
  request_inputs:
    - location: "DataSourceController.java:54"
      input_kind: path-param
      input_name: "dataSourceId"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "Identifies WHICH data source's token to rotate — the numeric primary-key id of the target data_source row. The name promises a data-source-scoped operation."
          confidence: STATIC-INFERRED
          evidence: "DataSourceController.java:54 + openapi.yaml:513-518 (path param `data_source_id`, int64)"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Controller passes dataSourceId straight to dataSourceService.regenerateDataSourceToken(dataSourceId) (DataSourceController.java:56-57) -> DataSourceServiceImpl.regenerateDataSourceToken(long id) (line 99) -> dataSourceRepository.getDto(id) (line 100) which loads the DataSourceDto by data_source primary key. The resolved DTO's token (DataSourceDto.token, the joined `token` row) is the rotation target. The id selects the data_source row; the data_source's token_id FK selects the token row that is actually mutated."
          confidence: STATIC-INFERRED
          evidence: "DataSourceController.java:54-58 + DataSourceServiceImpl.java:99-104"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES. `dataSourceId` selects exactly the data_source whose token is rotated. The one nuance: the row physically UPDATEd is the `token` row (not the `data_source` row), reached via the data_source's token_id FK — but this is a faithful 1:1 resolution of 'the token belonging to data source N', which is exactly what the name promises. No silent translation to a different entity."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "DataSourceServiceImpl.java:99-104 + DataSourceDto.java:6 (record carries the joined TokenDto)"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — the input is not silently translated. The only failure shapes are: a non-existent id => 404 NotFoundException (DataSourceServiceImpl.java:101); a data source whose token_id resolves to no token => 500 (TokenGeneratorImpl.java:45-47). Both are recorded in bugs_limitations_corner_cases."
          confidence: STATIC-INFERRED
          evidence: "DataSourceServiceImpl.java:100-102 + TokenGeneratorImpl.java:45-47"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "NONE — `data_source.id` is the matching column and it IS used (the getDto lookup keys on it). No closer-aligned-but-ignored column exists."
          confidence: STATIC-INFERRED
          evidence: "DataSourceServiceImpl.java:100"
      routes_to_finding: ""
  probes_emitted:
    - probe_id: P-050
      question: "Two simultaneous PUT /api/datasources/{id}/token against the same data source — last-write-wins outcome, distinct plaintext tokens in each response, which value is authoritative, no duplicate row?"
      probe_path: "lineage/odd-platform/probes/P-050.yaml"
    - probe_id: P-051
      question: "Does rotation produce a binary cutover — old token 401s and new token 200s against POST /ingestion/entities the instant rotation commits, with no two-valid and no zero-valid window?"
      probe_path: "lineage/odd-platform/probes/P-051.yaml"
    - probe_id: P-052
      question: "RBAC matrix — {permission absent => 403, permission present => 200, unauthenticated => 401} under LOGIN_FORM, and {any caller => 200} under auth.type=DISABLED?"
      probe_path: "lineage/odd-platform/probes/P-052.yaml"
  stress_summary:
    triggers_total: 6
    questions_total: 22
    answers_static_inferred: 16
    answers_probe_needed: 6
    answers_reference: 0
    drift_flags: 0
```

## security

- **auth_mode_relevance**: `LOGIN_FORM | OAUTH2 | LDAP` — these three modes route through the SecurityWebFilterChain and enforce `SecurityConstants.SECURITY_RULES` (the DATA_SOURCE_TOKEN_REGENERATE rule at SecurityConstants.java:124-126). `DISABLED` short-circuits all permission checks — the rule is not enforced (see known_security_gaps). `S2S` does not gate this endpoint directly, but `auth.s2s.enabled=true` grants ADMIN identity to an X-API-Key caller, which satisfies the MANAGEMENT-tier permission. `INTERNAL_ONLY` does not apply — this is an HTTP-surface endpoint.
- **ingestion_filter_relevance**: `NO — UI/API surface, not ingestion`. The endpoint is `PUT /api/datasources/{data_source_id}/token`; `IngestionDataEntitiesFilter` matches only `POST /ingestion/entities` and `IngestionDataSourceFilter` matches only `POST /ingestion/datasources`. This endpoint CREATES the credential that `IngestionDataEntitiesFilter` later validates (IngestionDataEntitiesFilter.java:43-58 resolves the data-source token via getDtoByOddrn and does a plaintext `.equals`).
- **authorization_assertions**:
  - "`SecurityRule(NO_CONTEXT, /api/datasources/{data_source_id}/token, PUT, DATA_SOURCE_TOKEN_REGENERATE)` — Permission `DATA_SOURCE_TOKEN_REGENERATE` (MANAGEMENT tier) required" — evidence: SecurityConstants.java:124-126 + PolicyPermissionDto.java:54 (`DATA_SOURCE_TOKEN_REGENERATE(MANAGEMENT)`)
  - "No `@PreAuthorize`, no `@Secured`, no programmatic `permissionService.hasPermission(...)` on the controller method or the service method" — evidence: DataSourceController.java:53-59 + DataSourceServiceImpl.java:99-106
- **owner_scoping**: `N/A — the rotation target is a global resource, not data-scoped`. A data source is platform-level infrastructure; the MANAGEMENT-tier permission gates it globally. There is NO owner association consulted on the rotation path — any holder of DATA_SOURCE_TOKEN_REGENERATE can rotate ANY data source's token regardless of which owner registered it. (A reviewer should note: this is the platform-wide MANAGEMENT-tier posture, but it means there is no per-data-source ACL on a security-critical rotation.)
- **data_exposure**:
  - "DataSource resource body including `token.value` (the new 40-char plaintext ingestion credential) → any caller granted DATA_SOURCE_TOKEN_REGENERATE, OR any caller at all in an auth.type=DISABLED deployment"
  - "The plaintext token traverses every layer between the controller and the client — response interceptors, reverse proxies, browser response cache, server-side response-body logging if enabled — with no `Cache-Control: no-store` header marking the body sensitive (DataSourceController.java:56-58)"
- **known_security_gaps**:
  - "In auth.type=DISABLED deployments DATA_SOURCE_TOKEN_REGENERATE is bypassed entirely — any caller reaching the platform can rotate any data source's ingestion credential and receive the plaintext. Credential-rotation-hijack surface: an attacker can break ingestion platform-wide and harvest the new tokens. The docs do not warn against using DISABLED on a network-reachable deployment." — evidence: SecurityConstants.java:124-126 (enforced only by LOGIN_FORM/OAUTH2/LDAP configs) + TokenGeneratorImpl.java:31 (no-user fallback rotates with updated_by NULL) — severity: HIGH (DISABLED deployments)
  - "Rotated token is returned in plaintext via the response body — any logging / caching / proxying middleware on the response path captures the credential. No response header marks the body sensitive." — evidence: DataSourceController.java:56-58 + ReactiveTokenRepositoryImpl.java:38 (showToken=true) — severity: MEDIUM
  - "Token entropy source is `RandomStringUtils.randomAlphanumeric(40)` — not a cryptographically-secure RNG by default (commons-lang requires the `.secure()` variant for SecureRandom). The regenerated ingestion credential should be drawn from SecureRandom." — evidence: TokenGeneratorImpl.java:49 — severity: HIGH
  - "Token rotation is not audit-logged and emits no Activity Event; the `token.updated_by` column is overwritten on every rotation, so the forensic record is single-state. 'Who rotated data-source token X before the last rotation' is unrecoverable from production data." — evidence: TokenGeneratorImpl.java:44-52 (no log; updated_by overwritten) + DataSourceServiceImpl.java:99-106 (no activityEventEmitter, no log) — severity: HIGH
  - "Token is stored in plaintext in the `token` table — a DB read, replica, backup, or jOOQ statement log carries the credential in the clear. No hashing / encryption-at-rest at the application layer (confirmed by IngestionDataEntitiesFilter.java:56-57 doing a literal `.equals` against the stored value)." — evidence: ReactiveTokenRepositoryImpl.java:30-39 (record stored as-is) + IngestionDataEntitiesFilter.java:56-57 — severity: HIGH
  - "No rate-limit on rotation — a stolen session of a DATA_SOURCE_TOKEN_REGENERATE-holding user lets an attacker rotate every data source's token in a loop, breaking platform-wide ingestion." — evidence: DataSourceController.java:53-59 (no @RateLimited) + SecurityConstants.java:124-126 (no throttle metadata) — severity: MEDIUM

## performance

- **hot_paths**:
  - "Endpoint runs synchronously from the caller's perspective: 1 DB SELECT (`dataSourceRepository.getDto(id)` — data_source joined to namespace + token) + 1 in-memory token mutation + 1 DB UPDATE (`tokenRepository.updateToken`). 2 DB round-trips total. Not on the ingestion hot path — it is a low-frequency admin operation." — evidence: DataSourceServiceImpl.java:99-106 + ReactiveTokenRepositoryImpl.java:30-39
- **throughput_characteristics**:
  - "Single-data-source PUT — there is no bulk-rotate endpoint. An operator rotating N data sources makes N HTTP requests; there is no `POST /api/datasources/tokens/rotate-all`." — evidence: DataSourceController.java:54 (signature is `(Long dataSourceId, ServerWebExchange)` — single id)
  - "Reactive Mono signature — non-blocking on the WebFlux thread, but each request still serializes 2 DB round-trips via flatMap." — evidence: DataSourceController.java:53-59 + DataSourceServiceImpl.java:99-106
- **resource_allocation**:
  - "No outbound HTTP, no file I/O. Memory footprint is one DataSourceDto + one TokenPojo + the ResponseEntity-wrapped DataSource projection. Negligible." — evidence: DataSourceServiceImpl.java:99-106
- **scaling_characteristics**:
  - "Stateless controller — instances scale horizontally; no locks, no advisory locks, no shared in-process state." — evidence: DataSourceController.java:16-19 (`@RestController` + `@RequiredArgsConstructor`, only the DI'd DataSourceService field)
  - "Last-write-wins for concurrent rotations of the same data source: two simultaneous PUTs both UPDATE the single `token` row; the second commit wins. The two callers receive different `token.value` strings; only the later-committed value authenticates against the ingestion filter. No optimistic locking (no `@Version`, no `WHERE updated_at = :prev`)." — evidence: ReactiveTokenRepositoryImpl.java:33-36 (raw `UPDATE ... WHERE TOKEN.ID.eq(id)`, no version predicate)
- **known_performance_gaps**:
  - "No bulk-rotate endpoint — rotating all data sources after a credential leak requires N HTTP calls. Operator-time waste on a deployment with many data sources." — evidence: DataSourceController.java:54 (single-id signature) — severity: LOW
  - "Concurrent-rotation race silently discards a credential — an operator issuing rapid retries may keep a token that is not the persisted one. Low-probability, non-zero." — evidence: ReactiveTokenRepositoryImpl.java:33-36 (no optimistic locking) — severity: LOW

## upstream_callers

- entry_point: "ui_route:/management/datasources (Management → Datasources tab — Regenerate action)"
  caller_node: "odd-platform-ui — datasources.thunks.ts / lib/hooks/api/datasource.ts invoking the OpenAPI-generated DataSourceApi.regenerateDataSourceToken against PUT /api/datasources/{id}/token"
  multiplicity_per_trigger: 1
  evidence: "DataSourceController.java:53-59 (the endpoint); the class sidecar's upstream_callers block establishes the UI invokes DataSourceApi.* via the 3 verified UI files (`grep DataSourceApi` returned datasources.thunks.ts + lib/hooks/api/datasource.ts + lib/api.ts). The Datasources-tab Regenerate affordance is the operator origin per WebFetch 2026-05-21 status 200 of features/management (screenshot caption 'a partially-redacted Collector token with a Regenerate action')."
  observation_class: ui-call
  unresolved: true   # the exact UI thunk + onClick handler is not enriched yet — REFERENCE to a future UI-side sidecar
- entry_point: "rest:PUT /api/datasources/{data_source_id}/token (programmatic odd-api-consumer)"
  caller_node: "any authenticated UI-session caller holding DATA_SOURCE_TOKEN_REGENERATE, OR an S2S X-API-Key caller (ADMIN identity) when auth.s2s.enabled=true"
  multiplicity_per_trigger: 1
  evidence: "DataSourceController.java:53-59 + SecurityConstants.java:124-126 (the RBAC rule). S2S admin-elevation per the class sidecar's upstream_callers block."
  observation_class: rest-call

## downstream_side_effects

- side_effect_class: db-write
  description: "Overwrites `token.value` for the data source's single token row with a fresh 40-char random string (UPDATE token SET value=<new>, updated_at=<now>, updated_by=<actor or NULL>). The OLD token value is irrecoverably destroyed — no previous_token column, no history row."
  evidence: "ReactiveTokenRepositoryImpl.java:30-39 (the UPDATE) + TokenGeneratorImpl.java:44-52 (the in-memory value mutation)"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "ui_route:/management/datasources (Regenerate action)"
    - "rest:PUT /api/datasources/{data_source_id}/token"
- side_effect_class: page-render
  description: "Returns a 200 DataSource body whose `token.value` carries the NEW token in PLAINTEXT (showToken=true) — the operator's only opportunity to read the new secret."
  evidence: "DataSourceController.java:56-58 + ReactiveTokenRepositoryImpl.java:38 (`new TokenDto(..., true)`)"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "ui_route:/management/datasources (Regenerate action)"
    - "rest:PUT /api/datasources/{data_source_id}/token"
- side_effect_class: external-call
  description: "DELAYED, INDIRECT consequence (not a direct call from this node): the next `POST /ingestion/entities` from a collector / push-client still presenting the OLD token is rejected by IngestionDataEntitiesFilter with AccessDeniedException `Token is not correct`. The rotation does not itself call out, but it invalidates the credential a separate ingestion request depends on — the observable failure surfaces on the collector's next ingestion attempt."
  evidence: "IngestionDataEntitiesFilter.java:43-58 (resolves the data-source token via getDtoByOddrn, plaintext `.equals` at line 56-57, throws AccessDeniedException)"
  cardinality_per_call: "0..N — one rejection per stale-token ingestion request until the collector picks up the new token"
  reachable_from_entry_points:
    - "ui_route:/management/datasources (Regenerate action)"
    - "rest:PUT /api/datasources/{data_source_id}/token"
  unresolved: true   # the failure manifests in the IngestionDataEntitiesFilter node — REFERENCE to that node's sidecar for the ingestion-side half
- side_effect_class: log-emit
  description: "NONE. The rotation path emits NO log line at any level (DataSourceController / DataSourceServiceImpl / TokenGeneratorImpl / ReactiveTokenRepositoryImpl carry no log call on this path). Recorded explicitly as a downstream-side-effect absence — the audit-trail gap is a HIGH security finding."
  evidence: "DataSourceServiceImpl.java:99-106 (no log) + TokenGeneratorImpl.java:44-52 (no log)"
  cardinality_per_call: 0
  reachable_from_entry_points: []

## coherence_notes

- kind: refines
  target: "odd-platform java DataSourceController controller-class:DataSourceController"
  note: |
    The class sidecar (batch W) flagged regenerateDataSourceToken as MISSING
    @ReactiveTransactional and recorded it as a conflict_surfaced item and an open
    CRITICAL test-gap. This method sidecar REFINES that with primary-source confirmation
    read this batch (DataSourceServiceImpl.java:99 — no annotation; sibling create/update/
    delete at lines 52/69/86 all annotated) AND completes the atomicity analysis the class
    sidecar left open: the missing annotation does NOT produce a partial-write bug today
    because the only DB write (tokenRepository.updateToken) is a single atomic statement
    and tokenGenerator.regenerateToken is purely in-memory — there is no old-invalidated-
    but-new-not-persisted window. The class sidecar's framing ("the new token exists IN
    MEMORY only ... but the next call SHOULD return the still-valid OLD token") is correct
    and this sidecar pins it: severity LOW as a code-smell / latent-risk, not an active
    atomicity bug. The class sidecar's CRITICAL test-gap is refined into three concrete
    probes: P-050 (concurrency), P-051 (binary cutover), P-052 (RBAC matrix).
- kind: strengthens
  target: "odd-platform java DataSourceController controller-class:DataSourceController"
  note: |
    Strengthens the class sidecar's `shared-secret-tokens-stored-plaintext` related-concept
    with the endpoint-level evidence: the rotation response returns the token in plaintext
    (showToken=true at ReactiveTokenRepositoryImpl.java:38) and the credential is validated
    downstream by a literal plaintext `.equals` (IngestionDataEntitiesFilter.java:56-57) —
    confirming no hashing layer end-to-end on the data-source token, the same posture the
    CollectorController sibling found for the collector token.
- kind: strengthens
  target: "odd-platform java CollectorController controller-method:regenerateCollectorToken"
  note: |
    The data-source token-rotation path and the collector token-rotation path are
    STRUCTURALLY IDENTICAL — both delegate to the shared TokenGeneratorImpl.regenerateToken
    + ReactiveTokenRepositoryImpl.updateToken, both are gated by a MANAGEMENT-tier
    *_TOKEN_REGENERATE permission with no @PreAuthorize, both return plaintext, both miss
    @ReactiveTransactional on the service method, both have the DISABLED-bypass and the
    RandomStringUtils-not-SecureRandom and the no-audit-log gaps. This method sidecar's
    findings CONFIRM the CollectorController sibling's findings on the parallel surface;
    a fix to one (SecureRandom, audit logging, grace period) should be applied to both.

## sources

- understanding ← DataSourceController.java:53-59 + DataSourceServiceImpl.java:99-106 + TokenGeneratorImpl.java:26-52 + ReactiveTokenRepositoryImpl.java:30-39 + openapi.yaml:507-525
- concepts.entities ← DataSourceDto.java:6 + ReactiveTokenRepositoryImpl.java:38 (TokenDto showToken) + TokenGeneratorImpl.java:49 (40-char value)
- concepts.invariants[0] ← SecurityConstants.java:124-126 + PolicyPermissionDto.java:54
- concepts.invariants[1] ← ReactiveTokenRepositoryImpl.java:30-39 (UPDATE not INSERT)
- concepts.invariants[2] ← ReactiveTokenRepositoryImpl.java:38 (`new TokenDto(..., true)`)
- concepts.invariants[3] ← DataSourceServiceImpl.java:101 (switchIfEmpty NotFoundException)
- concepts.invariants[4] ← TokenGeneratorImpl.java:45-47 + ControllerAdvice.java:61-66
- dependencies_semantic.requires-feature ← DataSourceService.java:21 + DataSourceServiceImpl.java:99-106 + TokenGeneratorImpl.java:26-52 + ReactiveTokenRepositoryImpl.java:30-39 + ControllerAdvice.java:30-34,61-66
- dependencies_semantic.requires-config ← SecurityConstants.java:124-126 + IngestionDataEntitiesFilter.java:20 (`@ConditionalOnProperty auth.ingestion.filter.enabled`)
- dependencies_semantic.coupling ← IngestionDataEntitiesFilter.java:43-58 + IngestionDataSourceFilter.java:20,33
- tests_coverage_semantic ← Glob `**/DataSourceControllerTest*`, `**/DataSourceServiceImplTest*`, `**/TokenGenerator*Test*` all return no files; CollectorRepositoryImplTest exists for the analogous path
- docs_link_semantic.inferred_docs[0] ← WebFetch 2026-05-21 of https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions (status 200)
- docs_link_semantic.inferred_docs[1] ← WebFetch 2026-05-21 of https://docs.opendatadiscovery.org/features/management (status 200)
- implicit_adrs[0] ← ReactiveTokenRepositoryImpl.java:30-39 + TokenGeneratorImpl.java:44-52
- implicit_adrs[1] ← SecurityConstants.java:124-126 + DataSourceController.java:53-59
- implicit_adrs[2] ← ReactiveTokenRepositoryImpl.java:38
- bugs_limitations_corner_cases[0] ← DataSourceServiceImpl.java:98-106 (no annotation) vs lines 52,69,86
- bugs_limitations_corner_cases[1] ← ReactiveTokenRepositoryImpl.java:30-39 + IngestionDataEntitiesFilter.java:43-58
- bugs_limitations_corner_cases[2] ← SecurityConstants.java:124-126 + TokenGeneratorImpl.java:31
- bugs_limitations_corner_cases[3] ← TokenGeneratorImpl.java:44-52 + DataSourceServiceImpl.java:99-106
- bugs_limitations_corner_cases[4] ← DataSourceController.java:56-58 + ReactiveTokenRepositoryImpl.java:38
- bugs_limitations_corner_cases[5] ← TokenGeneratorImpl.java:49
- bugs_limitations_corner_cases[6] ← DataSourceController.java:53-59 + SecurityConstants.java:124-126
- bugs_limitations_corner_cases[7] ← DataSourceServiceImpl.java:102 + TokenGeneratorImpl.java:45-47
- stress_findings.auth_gates ← SecurityConstants.java:124-126 + DataSourceController.java:53-59 + DataSourceServiceImpl.java:99-106
- stress_findings.resource_boundaries ← DataSourceServiceImpl.java:99-106 + TokenGeneratorImpl.java:44-52 + ReactiveTokenRepositoryImpl.java:30-39
- stress_findings.request_inputs ← DataSourceController.java:54 + DataSourceServiceImpl.java:99-104 + openapi.yaml:513-518
- security.authorization_assertions ← SecurityConstants.java:124-126 + PolicyPermissionDto.java:54
- security.ingestion_filter_relevance ← IngestionDataEntitiesFilter.java:28 + IngestionDataSourceFilter.java:20
- security.known_security_gaps ← TokenGeneratorImpl.java:31,49 + ReactiveTokenRepositoryImpl.java:30-39 + IngestionDataEntitiesFilter.java:56-57 + DataSourceController.java:53-59
- performance.hot_paths ← DataSourceServiceImpl.java:99-106 + ReactiveTokenRepositoryImpl.java:30-39
- performance.scaling_characteristics ← DataSourceController.java:16-19 + ReactiveTokenRepositoryImpl.java:33-36
- upstream_callers ← DataSourceController.java:53-59 + SecurityConstants.java:124-126 + class sidecar upstream_callers block (UI invocation chain)
- downstream_side_effects ← ReactiveTokenRepositoryImpl.java:30-39 + DataSourceController.java:56-58 + IngestionDataEntitiesFilter.java:43-58 + TokenGeneratorImpl.java:44-52

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: MEDIUM
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: HIGH
- upstream_callers: MEDIUM
- downstream_side_effects: HIGH
- stress_findings: HIGH

## Maintainer notes
