---
node_id: "odd-platform java OwnerAssociationRequestController controller-class:OwnerAssociationRequestController"
node_kind: controller-class
axis: controllers
extracted_at_commit: 9ac6436e
enriched_at_commit: 9ac6436e
extractor_version: 0.1.0
prompt_version: file-analyser/0.2.0
schema_version: v0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-20-V01
related_features:
  - F-019   # P-08:F-003 Owner Lifecycle Management — REFACTOR-427 orphan owner_association_request rows on Owner delete
  - F-011   # P-09:F-NN Principal-to-Owner Resolution — THIS controller IS the operator-facing surface for that resolution
  - F-006   # P-09:F-001 RBAC + audit-silence asymmetry — controller is the POSITIVE half (HAS a dedicated activity table; not a privacy gap)
related_pillar_features:
  - P-08:F-003    # Owner Lifecycle Management — direct cascade-orphan finding (REFACTOR-427) targets the OWNER_ASSOCIATION_REQUEST table this controller writes
  - P-09:F-NN     # Principal-to-Owner Resolution — the request/approve flow IS the principal-to-owner binding mechanism
  - P-09:F-001    # RBAC — controller exposes one MANUAL-flow gated by OWNER_RELATION_MANAGE, one APPROVE-flow gated by OWNER_ASSOCIATION_MANAGE, one SELF-flow ungated, one VIEW-flow gated, one LIST-MAPPING-ACTIVITY-flow gated, one PROVIDER-DISCOVERY-flow ungated
related_concepts:
  - read-collaborative-cross-owner-enumeration-posture
  - audit-log-presence-asymmetry-2-tier-audit-story
  - permission-bypass-via-owner-auto-create-side-door-write-path
  - provider-null-cross-mode-bleed
coherence_notes:
  - kind: strengthens
    target: F-019
    note: |
      F-019's drift facet `owner_association_request_orphan_rows_persist_no_cascade`
      (line 16) and REFACTOR-427 (`3-leg cascade-block missing the owner_association_request
      4th leg at OwnerServiceImpl.java:90-91`) name the orphan rows this controller produces.
      The controller IS the WRITE-ENTRY-POINT for those rows (POST /api/owner_association_request
      at line 28-34 — calls ownerAssociationRequestService.createOwnerAssociationRequest → repository.create).
      Combined with V0_0_51__add_owner_association_request.sql:11 (FK to owner(id) with NO
      `ON DELETE` clause per F-019 line 496), the picture is: an authenticated user
      can create a request against any Owner; if that Owner is later deleted, the request
      row remains pointing at a soft-deleted Owner; the next GET /api/owner_association_request
      (line 36-45) returns rows whose `owner_id` no longer corresponds to a listable Owner.
      This sidecar is the SECOND-WAVE class sidecar at the controller layer for the REFACTOR-427
      orphan-rows pattern that F-019 surfaces at the service layer (OwnerServiceImpl.java:90-91).
  - kind: strengthens
    target: F-011
    note: |
      F-011's "Principal-to-Owner Resolution" feature describes the user → owner binding
      mechanism (per live `/configuration-and-deployment/enable-security/authorization/user-owner-association`
      WebFetched 2026-05-20 status 200: "Admin should approve request for finishing
      association process or deny it if there are any issues with current request"). THIS
      controller IS that mechanism's operator-facing surface:
      - createOwnerAssociationRequest (POST /api/owner_association_request): the SELF-service entry — current
        user requests association with a named Owner (line 28-34).
      - updateOwnerAssociationRequest (PUT /api/owner_association_request/{id}): the ADMIN-approval entry —
        Admin flips status APPROVED/DECLINED (line 56-63); on APPROVED, OwnerAssociationRequestServiceImpl.java:184-190
        creates the USER_OWNER_MAPPING row that F-011's resolution chain reads.
      - createUserOwnerMapping (POST /api/owners/mapping): the MANUAL-bypass entry — Admin
        directly creates a USER_OWNER_MAPPING for ANY user (form carries oidcUsername +
        provider + ownerId — line 65-72; OwnerAssociationRequestServiceImpl.java:109-114).
      - deleteActiveUserOwnerMapping (DELETE /api/owners/mapping/{owner_id}): the
        MANUAL-revoke entry (line 74-79).
      - getAuthProviders (GET /api/owners/providers): returns the available `Provider` enum
        values + the operator's registered providers (line 81-85) — F-011's
        `provider-null-cross-mode-bleed` concept (provider column nullable historically;
        same username under different providers can cross-bleed).
  - kind: strengthens
    target: F-006
    note: |
      F-006's "audit-silence on RBAC mutations" pattern (9-sidecar count at ActivityController
      batch-R class sidecar) is contrasted by THIS controller's behaviour: every mutation
      path here writes to a DEDICATED audit table (`owner_association_request_activity`),
      visible via getOwnerAssociationRequestActivityList (line 47-53) and read by the dedicated
      `activityService` field (line 25). Five activity-type values exist
      (OwnerAssociationRequestActivityType.java:3-8 — REQUEST_CREATED / REQUEST_DECLINED /
      REQUEST_APPROVED / REQUEST_MANUALLY_APPROVED / REQUEST_MANUALLY_DECLINED). This is the
      POSITIVE half of the 2-tier audit story (per `audit-log-presence-asymmetry-2-tier-audit-story`
      concept): the OwnerAssociationRequest workflow HAS forensic recording; the parallel
      RBAC mutation paths (PolicyController + RoleController + OwnerController create/update/delete
      per F-019 line 109-123) do NOT. The asymmetry is load-bearing — operators auditing
      "who approved Alice's mapping to Owner-X at T" CAN reconstruct that event from
      owner_association_request_activity, while "who renamed Owner-X from Alice to Bob at T"
      has no recoverable trace.
  - kind: surfaces_new
    target: F-011
    note: |
      DOC-vs-CODE drift: the live user-owner-association doc (WebFetched 2026-05-20,
      status 200) describes EXACTLY TWO flows ("Select owner which you want to associate
      yourself with and press Send request" — the SELF-request flow; "Admin should approve
      request for finishing association process or deny it" — the APPROVE flow). The doc
      makes NO mention of (a) the MANUAL flow (POST /api/owners/mapping creates an
      AUTO-APPROVED mapping bypassing the request workflow — OwnerAssociationRequestServiceImpl.java:131-148),
      (b) the DIRECT_OWNER_SYNC permission (OwnerAssociationRequestServiceImpl.java:64-67 —
      if the requesting user holds this permission, the request is auto-approved
      synchronously; no Admin click ever happens), (c) the /api/owners/providers
      enumeration endpoint, (d) the request-activity audit view, (e) the
      deleteActiveUserOwnerMapping revocation surface. Five user-observable behaviours
      on a six-method controller are absent from the live doc page. Operators reading
      the doc cannot discover the AUTO-APPROVE side-door (DIRECT_OWNER_SYNC) nor the
      MANUAL-mapping flow (Admin assigning Alice to Owner-X without Alice's consent).
upstream_callers:
  - rest:POST /api/owner_association_request — user-self request creation
  - rest:GET /api/owner_association_request — admin list of pending/approved/declined requests
  - rest:PUT /api/owner_association_request/{owner_association_request_id} — admin approve/decline
  - rest:GET /api/owner_association_request/activity — admin view of the activity log
  - rest:POST /api/owners/mapping — admin manual user-owner mapping (bypasses request flow)
  - rest:DELETE /api/owners/mapping/{owner_id} — admin manual revoke
  - rest:GET /api/owners/providers — discovery of registered auth providers
  - ui:Management → Associations tab (per F-019 batch-Q OwnersList sidecar references; the Associations tab consumes this controller per ts:OwnersList sidecar text in F-019 detail file)
downstream_callees:
  - service:OwnerAssociationRequestService (interface — line 24, 14)
  - service:OwnerAssociationRequestActivityService (interface — line 25, 14)
---

# OwnerAssociationRequestController — semantic understanding

## understanding

`OwnerAssociationRequestController` is the operator-facing surface that
implements ODD's User-to-Owner binding workflow — the mechanism by which an
authenticated platform user (identified by oidc-username + provider) becomes
associated with a catalog-side Owner directory entry so that owner-scoped
behaviours (My Objects, owner-filtered alerts, ownership badges) can resolve.
It exposes seven endpoints across two parallel control planes: a SELF-service
plane (the user submits a request, an admin approves) and an ADMIN-manual
plane (an admin creates the mapping directly, bypassing the request workflow).
The controller delegates uniformly to `OwnerAssociationRequestService` (state
mutations) and `OwnerAssociationRequestActivityService` (audit-trail reads);
authorization is wired EXTERNALLY via path-pattern entries in
`SecurityConstants.SECURITY_RULES` rather than through method-level
`@PreAuthorize` annotations, and the wiring is asymmetric: two of the seven
endpoints have NO authorization rule at all (POST /api/owner_association_request
and GET /api/owners/providers), making them reachable by any authenticated
caller without holding any RBAC permission.

## concepts

- entities:
  - OwnerAssociationRequest (the request entity — pending/approved/declined; OwnerAssociationRequestController.java:5)
  - OwnerFormData (the name-only payload for self-request — line 11)
  - UserOwnerMappingFormData (the {oidcUsername, provider, ownerId} payload for manual mapping — line 13)
  - OwnerAssociationRequestStatusFormData (the status payload for approve/decline — line 9)
  - OwnerAssociationRequestStatusParam (filter for list/activity — line 10)
  - OwnerAssociationRequestList (paginated request page — line 8)
  - OwnerAssociationRequestActivityList (paginated activity-feed page — line 7)
  - Owner (returned by createUserOwnerMapping after the mapping resolves — line 5)
  - ProviderList (the registered/available auth provider enumeration — line 12)
- operations:
  - create-self-association-request (line 28-34)
  - list-pending-requests (line 36-45)
  - list-request-activity (line 47-53)
  - approve-or-decline-request (line 55-63)
  - create-manual-user-owner-mapping (line 65-72)
  - delete-active-user-owner-mapping (line 74-79)
  - discover-auth-providers (line 81-85)
- invariants:
  - The class implements OwnerAssociationRequestApi (line 23) — an OpenAPI-generated interface; method bodies are thin delegations (every method = formData.flatMap → service-call → ResponseEntity.ok-or-noContent — lines 31-33, 43-44, 51-52, 60-62, 69-71, 77-78, 83-84). No domain logic at the controller layer.
  - Two services are co-injected by constructor (`@RequiredArgsConstructor` at line 22): `ownerAssociationRequestService` (lifecycle mutations) and `activityService` (audit-trail read). Activity WRITES are performed by `OwnerAssociationRequestServiceImpl` calling `activityService.createOwnerAssociationRequestActivity(...)` (OwnerAssociationRequestServiceImpl.java:205-221) — NOT by this controller.
  - Authorization is path-pattern-based: 5 of the 7 endpoints have entries in `SecurityConstants.SECURITY_RULES` (lines 148-162 of SecurityConstants.java); 2 endpoints (createOwnerAssociationRequest POST and getAuthProviders GET) have NONE — relying solely on Spring's default `.authenticated()` rule from the global security wiring.
  - Two DUAL approval paths exist on createOwnerAssociationRequest: if the current user holds the `DIRECT_OWNER_SYNC` MANAGEMENT permission (OwnerAssociationRequestServiceImpl.java:64), the request is AUTO-APPROVED in-line (the mapping is created synchronously, no Admin gate); otherwise the request enters the PENDING state awaiting Admin updateOwnerAssociationRequest.
  - The MANUAL flow (createUserOwnerMapping at line 65-72) is a parallel bypass to the request workflow: an Admin holding `OWNER_RELATION_MANAGE` can create a USER_OWNER_MAPPING for ANY oidc-username + provider combination without the target user ever submitting a request; the activity entry is `REQUEST_MANUALLY_APPROVED`.
- audiences:
  - odd-platform-ui-end-user (the SELF-request creator)
  - platform-operator (the Admin who approves / manages / manually-binds via the Management → Associations + Owners tabs)
  - odd-api-consumer (programmatic clients posting to /api/owner_association_request)

## dependencies_semantic

- requires-feature:
  - "F-011 Principal-to-Owner Resolution — the request-approve flow is the producer of the USER_OWNER_MAPPING rows that F-011's downstream consumers (authIdentityProvider.fetchAssociatedOwner, owner-scoped reads) consume"
  - "F-019 Owner Lifecycle Management — the Owner this controller binds the user to must exist and not be soft-deleted; OwnerAssociationRequestServiceImpl.java:57 calls OwnerService.getOrCreate which is the documented permission-bypass-via-side-door per F-019 line 273-281"
  - "F-006 RBAC — three of the five SECURITY_RULES entries for this controller use the MANAGEMENT permission family (OWNER_ASSOCIATION_MANAGE / OWNER_RELATION_MANAGE / DIRECT_OWNER_SYNC) defined in PolicyPermissionDto.java:68-70"
- requires-config:
  - "No direct config-key consumption at the controller layer. Indirectly: auth.type / auth.s2s.enabled gate the upstream Spring Security filter chain (SecurityConstants.SECURITY_RULES.applyFilter); auth.ingestion.filter.enabled does NOT cover /api/* paths."
- requires-runtime:
  - "Reactive WebFlux runtime (Mono / ResponseEntity / ServerWebExchange — lines 19, 16, 18). Spring 6 RestController bean lifecycle (line 21)."
  - "An `AuthIdentityProvider` populated by the active auth mode (LOGIN_FORM / OAUTH2 / LDAP / DISABLED) — OwnerAssociationRequestServiceImpl.java:55 calls `authIdentityProvider.getCurrentUser()` and explicitly throws RuntimeException(\"There is no current authorization\") on empty (line 56). Under auth.type=DISABLED with no current user, the createOwnerAssociationRequest endpoint will throw."
  - "PostgreSQL tables: owner, owner_association_request, owner_association_request_activity, user_owner_mapping — all reactive-jOOQ-mediated."
- requires-permission-model:
  - "PolicyPermissionDto.OWNER_ASSOCIATION_MANAGE (MANAGEMENT) — list-pending-requests + approve-or-decline-request"
  - "PolicyPermissionDto.OWNER_RELATION_MANAGE (MANAGEMENT) — create-manual-user-owner-mapping + delete-active-user-owner-mapping"
  - "PolicyPermissionDto.DIRECT_OWNER_SYNC (MANAGEMENT) — auto-approve-on-self-request (consumed in-service, not in SECURITY_RULES)"

## tests_coverage_semantic

- covered_behaviours:
  - "ReactiveOwnerAssociationRequestRepositoryImpl repository-level CRUD (covered by ReactiveOwnerAssociationRequestRepositoryImplTest.java)"
  - "OwnerAssociationRequestMapper mapping-level coverage (covered by OwnerAssociationRequestMapperTest.java)"
- uncovered_behaviours:
  - "Controller-level @WebFluxTest of all 7 methods + status-mapping (no `OwnerAssociationRequestControllerTest.java` found — Grep across <odd-platform-api>/src/test returned only mapper + repository tests, no controller test)"
  - "DIRECT_OWNER_SYNC auto-approve path — no service-layer test of the branch at OwnerAssociationRequestServiceImpl.java:64-67"
  - "Audit-trail-read filtering — no end-to-end test that approves a request, then asserts the activity-list returns the REQUEST_APPROVED event with correct status_updated_by"
  - "MANUAL-flow side-effects — createUserOwnerMapping silently cancels colliding open requests (cancelAssociationByOwnerId + cancelAssociationByUsername at OwnerAssociationRequestServiceImpl.java:144-145); no test verifies the cancellation activity-log entries are written"
  - "Cross-mode provider-null bleed (per `provider-null-cross-mode-bleed` concept) — no test verifies createUserOwnerMapping rejects a duplicate (username, provider) pair across LOGIN_FORM ↔ OAUTH2 cutover"
  - "DELETE /api/owners/mapping/{owner_id} idempotency — no .switchIfEmpty(NotFoundException) on the cancel-then-delete chain at OwnerAssociationRequestServiceImpl.java:118-122; the 204-vs-404 distinction is untested"
  - "REFACTOR-427 orphan-rows surfacing — no test where an Owner is hard-deleted (or even soft-deleted) and GET /api/owner_association_request is asserted to return / not return the orphan request"
- test_files:
  - "<odd-platform-api>/src/test/java/org/opendatadiscovery/oddplatform/repository/ReactiveOwnerAssociationRequestRepositoryImplTest.java"
  - "<odd-platform-api>/src/test/java/org/opendatadiscovery/oddplatform/mapper/OwnerAssociationRequestMapperTest.java"
  - "<odd-platform-api>/src/test/java/org/opendatadiscovery/oddplatform/repository/OwnerRepositoryImplTest.java"
- gaps: |
    The controller carries no test surface at all (no @WebFluxTest, no MockMvc) — Grep `OwnerAssociationRequestController` across <odd-platform-api>/src/test returns zero matches. The regression most likely to land undetected: a change to authorization wiring (SecurityConstants.SECURITY_RULES editor accidentally moves a permission key, or removes one of the 5 entries) silently enables anonymous mutation of the request lifecycle. The second-most likely: an OpenAPI spec change that flips a path slug from snake_case to camelCase (e.g. /api/owner_association_request → /api/ownerAssociationRequest) breaks the path-pattern match without the controller failing to start — the endpoint becomes unauthenticated by default. Both are detectable by an integration test that asserts the canonical 5 path-pattern entries resolve to the canonical 5 permission keys.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/user-owner-association"
    anchor: ""
    rationale: "The live doc page for the User-Owner association workflow this controller implements (per the F-019 detail file line 653: 'per live /configuration-and-deployment/enable-security/authorization/user-owner-association'). No @docs annotation in source — inferred from F-011 + the URL slug matching the controller's operations."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      "Select owner which you want to associate yourself with and press `Send request` button."
      "Admin should approve request for finishing association process or deny it if there are any issues with current request."
      "you will see the same modal dialog as admins in the bottom of the main page"
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/owners"
    anchor: ""
    rationale: "The Owners-authorization parent doc; this controller manages Owner→User binding state — the page explicitly cross-links to the User-Owner Association sub-page."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      "You can manage owners in the [Management → Owners](/features/management.md) tab."
      "Every ODD Platform user should associate themselves with one of the existing owners"
      "described in the [User-owner association](/configuration-and-deployment/enable-security/authorization/user-owner-association.md) section"
- doc_drift_findings:
  - "Live doc names two flows (SELF-request + ADMIN-approve); the controller exposes SIX distinct user-observable behaviours (SELF, AUTO-APPROVE-via-DIRECT_OWNER_SYNC, ADMIN-approve, MANUAL-mapping, MANUAL-revoke, provider-discovery) + ONE audit-list. Four behaviours absent from the doc."
  - "Live doc has NO mention of DIRECT_OWNER_SYNC. Per OwnerAssociationRequestServiceImpl.java:64-67 a user holding this permission AUTO-APPROVES their own request synchronously — bypassing the Admin gate the doc describes as canonical. An operator reading the doc cannot discover this side-door."
  - "Live doc has NO mention of POST /api/owners/mapping (the MANUAL-mapping flow at OwnerAssociationRequestController.java:65-72 — an Admin assigns ANY oidc-username + provider to ANY ownerId without the target user submitting a request). The doc's narrative ('the user clicks Send Request → Admin approves') excludes this case-class entirely."
  - "Live doc has NO mention of the activity-log read endpoint (GET /api/owner_association_request/activity — line 47-53). The audit-trail surface exists but is doc-invisible."

## implicit_adrs

- "Audit-log SEPARATION OF CONCERNS — the OwnerAssociationRequest workflow gets its own dedicated audit table (owner_association_request_activity) with five typed event values (REQUEST_CREATED / REQUEST_DECLINED / REQUEST_APPROVED / REQUEST_MANUALLY_APPROVED / REQUEST_MANUALLY_DECLINED) rather than reusing the global ActivityEventType enum." — evidence: OwnerAssociationRequestController.java:25 (separate activityService field) + OwnerAssociationRequestActivityType.java:3-8 (the 5-value enum) — intent_anchor: "OwnerAssociationRequestActivityType enum is the entire purpose of this file — exists ONLY to type events for this controller's workflow; not shared with ActivityEventType which has 27 values for entity-metadata changes" — confidence: HIGH
- "Dual-plane approval — both SELF-request-then-approve and MANUAL-mapping flows reach the same end-state (USER_OWNER_MAPPING + audit row), but the MANUAL flow uses distinct `REQUEST_MANUALLY_APPROVED` event-typing so the audit reader can distinguish them." — evidence: OwnerAssociationRequestServiceImpl.java:131-148 (createManualAssociationRequest preserves the request shape but stamps status=APPROVED with REQUEST_MANUALLY_APPROVED activity-type) + OwnerAssociationRequestServiceImpl.java:205-221 (createActivity branches on isManual boolean) — intent_anchor: "the `isManual` parameter threading through createOwnerAssociationRequestWithActivity → createActivity is the design's load-bearing distinction between an operator-direct action and a user-initiated-then-approved action" — confidence: HIGH
- "AUTO-APPROVE permission as an escalation mechanism — the DIRECT_OWNER_SYNC permission collapses the two-step workflow into one for designated principals (typically OIDC group-mapped users) so the platform can be deployed in a 'trust the IdP' configuration where association is policy-derived not workflow-driven." — evidence: OwnerAssociationRequestServiceImpl.java:60-67 (permissionService.getNonContextualPermissionsForCurrentUser(MANAGEMENT) → if contains DIRECT_OWNER_SYNC → bypass; else PENDING) + PolicyPermissionDto.java:70 (DIRECT_OWNER_SYNC(MANAGEMENT) — the only MANAGEMENT permission that auto-approves an OPERATION rather than gating it) — intent_anchor: "the comment-less branch at OwnerAssociationRequestServiceImpl.java:64 IS the design — `if (permissions.contains(Permission.DIRECT_OWNER_SYNC))` and the explicit `mapToApprovedRequest` (line 67) name the intent" — confidence: MEDIUM
- "Self-service request endpoint is intentionally unprotected by RBAC — POST /api/owner_association_request has no SECURITY_RULES entry because by design any authenticated user must be able to initiate their own association regardless of held permissions (a brand-new user can hold zero permissions yet must be able to request association to BECOME an Owner with permissions)." — evidence: SecurityConstants.java:148-162 (the OwnerAssociationRequest path-pattern entries cover GET + PUT but NOT POST) + the FOUR-line createOwnerAssociationRequest delegation at OwnerAssociationRequestController.java:28-34 (no method-level @PreAuthorize) + OwnerAssociationRequestServiceImpl.java:55 (relies on authIdentityProvider.getCurrentUser; throws if absent) — intent_anchor: "the asymmetric SECURITY_RULES layout where every other write verb on this controller has an entry but POST does not is the design — the absence is the decision, anchored by Spring's default `.authenticated()` fallback" — confidence: MEDIUM
- "Provider-discovery endpoint is intentionally unprotected by RBAC — GET /api/owners/providers has no SECURITY_RULES entry; any authenticated user can enumerate the configured `Provider` enum values + the operator's actually-registered providers (typically a stable, low-cardinality set: LOGIN_FORM / OAUTH2_GOOGLE / OAUTH2_GITHUB / LDAP)." — evidence: SecurityConstants.java:148-162 (no entry for `/api/owners/providers`) + OwnerAssociationRequestServiceImpl.java:125-129 (returns the public Provider.values() enum + providerUtils.getRegisteredProviders()) — intent_anchor: "the endpoint exists ONLY to populate the SELF-request form's provider dropdown — auth-mode discovery is intentionally readable by any user who can submit a request" — confidence: MEDIUM
- "Authorization wiring is centralised in SecurityConstants.SECURITY_RULES, NOT in @PreAuthorize annotations on the controller — this mirrors the project-wide pattern (per ActivityController class sidecar coherence note re audit-silence pattern; per F-019 batch P+S sidecars) where every controller relies on path-pattern matching at the Spring Security filter layer rather than declarative method-level guards." — evidence: OwnerAssociationRequestController.java:1-86 (zero @PreAuthorize / zero @Secured / zero @PostAuthorize annotations across the whole file) + SecurityConstants.java:148-162 (the canonical wiring for THIS controller's 5 protected paths) — intent_anchor: "the project-wide consistency — Grep across controller/*.java for @PreAuthorize returns zero hits — is the convention applied here" — confidence: HIGH

## bugs_limitations_corner_cases

- "createOwnerAssociationRequest (POST /api/owner_association_request) accepts an arbitrary ownerName from the requesting user and routes through OwnerService.getOrCreate (OwnerAssociationRequestServiceImpl.java:57). Per F-019 line 267-281 (`getOrCreate` permission-bypass side-door), the request flow can SILENTLY MINT new Owner directory rows on behalf of any authenticated user without that user holding OWNER_CREATE. A user attempting to associate with a non-existent owner name does NOT receive a 'not found' — the Owner is auto-created. This is a write side-door reachable via the audit-trail-recorded request flow." — evidence: OwnerAssociationRequestServiceImpl.java:57 (`ownerService.getOrCreate(ownerName)` — no permission check at this call site) — severity: MEDIUM
- "REFACTOR-427 — orphan owner_association_request rows on Owner delete: when OwnerController deleteOwner (DELETE /api/owners/{id}) soft-deletes an Owner, the 3-leg cascade-check at OwnerServiceImpl.java:90-91 does NOT include owner_association_request. The FK at V0_0_51__add_owner_association_request.sql:11 has NO `ON DELETE` clause. Open requests pointing at the just-deleted Owner persist as orphan rows. The next GET /api/owner_association_request returns them; PUT to approve such an orphan creates a USER_OWNER_MAPPING pointing at a soft-deleted Owner (no cross-check in OwnerAssociationRequestServiceImpl.java:184-190 of mapper-fed pojo.getOwnerId())." — evidence: OwnerAssociationRequestController.java:36-45 (list returns whatever the repository finds) + OwnerAssociationRequestController.java:56-63 (update has no soft-delete check at the controller layer; downstream service likewise calls userOwnerMappingService.createRelation without a soft-delete guard at OwnerAssociationRequestServiceImpl.java:188) + F-019 detail line 721-737 — severity: MEDIUM
- "createUserOwnerMapping (POST /api/owners/mapping) — an Admin holding OWNER_RELATION_MANAGE can assign ANY oidc-username + provider combination to ANY ownerId WITHOUT verifying that a user with that identity exists in the platform's authentication source (LDAP, OIDC, LOGIN_FORM password table). The mapping is created speculatively; the user only sees the binding take effect on their NEXT login. There is no end-of-step verification (e.g. an LDAP existence lookup) — a typo in oidcUsername creates a permanent dangling mapping." — evidence: OwnerAssociationRequestController.java:65-72 + OwnerAssociationRequestServiceImpl.java:109-114 (no AuthIdentityProvider.lookupUser or equivalent existence check) — severity: MEDIUM
- "deleteActiveUserOwnerMapping (DELETE /api/owners/mapping/{owner_id}) is SILENTLY-IDEMPOTENT — a caller cannot distinguish 'I deleted the mapping' from 'no mapping existed' from 'the mapping was already deleted'. There is no .switchIfEmpty(NotFoundException) on the chain at OwnerAssociationRequestServiceImpl.java:118-122; on a non-existent ownerId the response is still 204 No Content (per controller line 75-78 thenReturn(ResponseEntity.noContent().build()))." — evidence: OwnerAssociationRequestController.java:74-79 + OwnerAssociationRequestServiceImpl.java:118-122 — severity: LOW
- "updateOwnerAssociationRequest (PUT /api/owner_association_request/{id}) accepts an arbitrary status param (OwnerAssociationRequestStatusFormData carries a status enum). The service-layer createActivity (OwnerAssociationRequestServiceImpl.java:205-221) handles APPROVED + DECLINED + (default) — a status value that maps to no activity-type branch (currently unreachable because the enum is closed at 3 values) would still write a REQUEST_CREATED activity row. No defensive guard." — evidence: OwnerAssociationRequestServiceImpl.java:205-221 (the else-branch at 217-219 emits REQUEST_CREATED for any non-APPROVED/non-DECLINED status — a future enum extension would silently misclassify) — severity: LOW
- "Test gap — controller-layer @WebFluxTest is ABSENT. No `OwnerAssociationRequestControllerTest.java` exists in the test tree. A SECURITY_RULES editing error that removes one of the 5 entries (e.g. accidentally deleting line 148-150 OWNER_ASSOCIATION_MANAGE for GET) would not be caught by any test — every endpoint would still respond 200/204, just without the expected permission check." — evidence: Grep `OwnerAssociationRequestController` across <odd-platform-api>/src/test returns zero matches — severity: MEDIUM
- "DOC-drift — DIRECT_OWNER_SYNC auto-approve path: the live user-owner-association doc (WebFetched 2026-05-20 status 200) describes ONLY the SELF-request → Admin-approve flow. The auto-approve branch at OwnerAssociationRequestServiceImpl.java:64-67 is operator-invisible. An IdP-integrated deployment where DIRECT_OWNER_SYNC is granted via OIDC group claim presents behaviour the doc says is impossible." — evidence: live doc WebFetch 2026-05-20 (excerpted in docs_link_semantic) + OwnerAssociationRequestServiceImpl.java:60-67 — severity: MEDIUM
- "DOC-drift — MANUAL-mapping flow is doc-invisible: POST /api/owners/mapping creates a binding without the target user's consent or knowledge. An operator reading the doc to understand 'how my user gets associated with an Owner' will not discover that Admins can bind them unilaterally. The audit-trail does record this as `REQUEST_MANUALLY_APPROVED` (per OwnerAssociationRequestServiceImpl.java:209-211) — so the operator-recovery story is correct, but the doc story is incomplete." — evidence: OwnerAssociationRequestController.java:65-72 + live doc WebFetch 2026-05-20 — severity: MEDIUM

## security

- **auth_mode_relevance**: LOGIN_FORM | OAUTH2 | LDAP | DISABLED — controller is on the /api/* HTTP surface, gated by the active UI auth mode. Under DISABLED the authIdentityProvider.getCurrentUser() chain at OwnerAssociationRequestServiceImpl.java:55-56 throws `RuntimeException("There is no current authorization")` — the SELF-request path is effectively fail-fast under DISABLED (NOT silently anonymous, unlike F-019 batch-S finding REFACTOR-185 where Owner CRUD verbs run anonymously). For the GET /api/owners/providers + POST /api/owner_association_request paths (the two without SECURITY_RULES entries), the Spring default `.authenticated()` rule applies — they still require an authenticated principal under non-DISABLED modes.
- **ingestion_filter_relevance**: N/A — controller is on /api/* not /ingestion/*. The S2S filter does not protect these endpoints.
- **authorization_assertions**:
  - "Path-pattern `/api/owner_association_request` GET → OWNER_ASSOCIATION_MANAGE (MANAGEMENT)" — evidence: SecurityConstants.java:148-150
  - "Path-pattern `/api/owner_association_request/{owner_association_request_id}` PUT → OWNER_ASSOCIATION_MANAGE (MANAGEMENT)" — evidence: SecurityConstants.java:151-154
  - "Path-pattern `/api/owners/mapping` POST → OWNER_RELATION_MANAGE (MANAGEMENT)" — evidence: SecurityConstants.java:155-158
  - "Path-pattern `/api/owners/mapping/{owner_id}` DELETE → OWNER_RELATION_MANAGE (MANAGEMENT)" — evidence: SecurityConstants.java:159-162
  - "In-service permission check: `if (permissions.contains(Permission.DIRECT_OWNER_SYNC))` for auto-approve branch on createOwnerAssociationRequest" — evidence: OwnerAssociationRequestServiceImpl.java:64
  - "ABSENT — POST /api/owner_association_request has NO SecurityRule entry; gated only by Spring default `.authenticated()` (no @PreAuthorize on controller method either)" — evidence: SecurityConstants.java:148-162 (gap in the path-pattern set) + OwnerAssociationRequestController.java:27-34
  - "ABSENT — GET /api/owners/providers has NO SecurityRule entry; gated only by Spring default `.authenticated()`" — evidence: SecurityConstants.java:148-162 (gap in the path-pattern set) + OwnerAssociationRequestController.java:81-85
  - "ABSENT — GET /api/owner_association_request/activity has NO SecurityRule entry; gated only by Spring default `.authenticated()` even though it exposes the full audit-trail of who requested/approved which association" — evidence: SecurityConstants.java:148-162 (no entry for `/api/owner_association_request/activity`) + OwnerAssociationRequestController.java:47-53
- **owner_scoping**: BYPASSES — the request-list endpoint (line 36-45 → repository.getDtoList(page, size, query, status)) returns ALL pending/approved/declined requests across all users + all Owners without filtering by the calling user's owner-scope. Per the read-collaborative-cross-owner-enumeration-posture concept, this is consistent with ODD's platform-wide stance (every authenticated MANAGEMENT-permission holder sees all requests). For getOwnerAssociationRequestActivityList — same: full activity-trail across all users.
- **data_exposure**:
  - "Per-request payload (username, provider, ownerId, ownerName, status, statusUpdatedBy, statusUpdatedAt + role list) → any user holding OWNER_ASSOCIATION_MANAGE on list/update paths"
  - "Activity entries (5 typed events × {requester username, approver username, owner_id, owner_name, timestamps}) → any user holding OWNER_ASSOCIATION_MANAGE on the activity-list path"
  - "Available + registered auth providers (Provider.values() enum names: LOGIN_FORM, OAUTH2_GOOGLE, OAUTH2_GITHUB, LDAP, etc. + which are registered) → ANY authenticated user (the endpoint has no permission gate) — minor information disclosure: an authenticated user can enumerate the deployment's auth strategy"
  - "Self-request payload echo (created owner-id + owner-name) → the requesting user; if auto-approve fires (DIRECT_OWNER_SYNC), the immediate creation of USER_OWNER_MAPPING means subsequent owner-scoped reads return as if the user were already approved"
- **known_security_gaps**:
  - "POST /api/owner_association_request has NO SecurityRule entry. The intent appears to be 'any authenticated user can self-request' (no permission held → still able to file a request) — this is consistent with the doc's narrative. However, combined with the side-effect at OwnerAssociationRequestServiceImpl.java:57 (`ownerService.getOrCreate(ownerName)`), the absent SecurityRule lets any authenticated user MINT new Owner directory rows by requesting association with an arbitrary owner-name. Without OWNER_CREATE the user cannot create owners via POST /api/owners; via this endpoint they CAN, with a request row as the only audit anchor." — evidence: SecurityConstants.java:148-162 (no POST entry) + OwnerAssociationRequestServiceImpl.java:57 — severity: MEDIUM
  - "GET /api/owner_association_request/activity has NO SecurityRule entry — the audit-trail surface is reachable by any authenticated user, exposing forensic data (who requested association with which Owner, who approved/declined, when). Contrast with the LIST endpoint (line 148-150 of SecurityConstants requires OWNER_ASSOCIATION_MANAGE for the LIVE-PENDING view but NOT for the historical activity view). The asymmetry is unintended (the activity view is strictly a superset of the list view in sensitivity)." — evidence: SecurityConstants.java:148-162 (gap) + OwnerAssociationRequestController.java:47-53 + OpenAPI spec openapi.yaml:3392-3414 (the operationId is documented but no security rule covers it) — severity: HIGH
  - "GET /api/owners/providers has NO SecurityRule entry — any authenticated user can enumerate the deployment's available auth strategies (Provider.values()) + the operator-registered subset. Low-severity information disclosure: an attacker who has compromised one user can fingerprint the deployment's identity-provider topology." — evidence: SecurityConstants.java:148-162 (gap) + OwnerAssociationRequestController.java:81-85 — severity: LOW
  - "DIRECT_OWNER_SYNC permission applies SYNCHRONOUSLY at request-creation time (OwnerAssociationRequestServiceImpl.java:60-67) but the permission CHECK is `permissionService.getNonContextualPermissionsForCurrentUser(MANAGEMENT)` — which returns ALL MANAGEMENT permissions held by the user. A user holding DIRECT_OWNER_SYNC can self-bind to ANY existing Owner directory entry (including the deployment's most-privileged Owner). Combined with the side-door at OwnerService.getOrCreate (no OWNER_CREATE required), a DIRECT_OWNER_SYNC holder can MINT a new Owner and immediately self-bind to it — a complete privilege-escalation chain (the new Owner inherits no roles by default, but the auto-create + immediate-bind chain is permission-bypass-class)." — evidence: OwnerAssociationRequestServiceImpl.java:60-67 + OwnerAssociationRequestServiceImpl.java:57 (getOrCreate) — severity: HIGH
  - "createUserOwnerMapping (POST /api/owners/mapping) allows an Admin to bind ANY oidc-username + provider to ANY ownerId without that user's consent. This is intentional (operator workflow for onboarding) but the doc's omission (per docs_link_semantic doc_drift_findings) leaves the impersonation/escalation class undocumented — an Admin can give themselves an extra Owner binding, gaining the owner-scoped privileges of any team, with the only trace being a REQUEST_MANUALLY_APPROVED row that they themselves authored." — evidence: OwnerAssociationRequestController.java:65-72 + OwnerAssociationRequestServiceImpl.java:131-148 — severity: MEDIUM
  - "Under auth.type=DISABLED: per F-019 batch-S finding REFACTOR-185 (17th-19th surface), the Owner CRUD verbs run anonymously. THIS controller is the contrast: every method calls authIdentityProvider.getCurrentUser() (OwnerAssociationRequestServiceImpl.java:55, 92, 134, 158) with explicit `.switchIfEmpty(Mono.error(() -> new RuntimeException(\"There is no current authorization\")))`. Under DISABLED the createOwnerAssociationRequest + updateOwnerAssociationRequest + createUserOwnerMapping + deleteActiveUserOwnerMapping paths all throw at the service layer — fail-fast. POSITIVE finding: the user-owner-binding surface is fail-closed under DISABLED, unlike the Owner-CRUD surface." — evidence: OwnerAssociationRequestServiceImpl.java:55-56 + 92-93 + 134-135 + 158-159 (four explicit current-user assertions) — severity: N/A (positive)

## performance

- **hot_paths**:
  - "getOwnerAssociationRequestList (line 36-45) — paginated query joining owner_association_request + owner + role tables via ReactiveOwnerAssociationRequestRepositoryImpl. Page-driven; not in a synchronous request critical path beyond the Management → Associations tab load."
  - "getOwnerAssociationRequestActivityList (line 47-53) — paginated query joining owner_association_request_activity + owner (twice: request_owner + status_updated_owner) + owner_to_role + role via ReactiveOwnerAssociationRequestActivityRepositoryImpl. Twin-join per row; aggressively-paginated reads on long activity histories require index hygiene on (created_at, id)."
- **throughput_characteristics**:
  - "All endpoints are single-item per call. No batch surface. createUserOwnerMapping creates exactly one mapping per call; updateOwnerAssociationRequest mutates exactly one request per call."
  - "Reactive Mono signatures (lines 28, 37, 48, 56, 66, 75, 82) — non-blocking but each call is one DB transaction (per @ReactiveTransactional at OwnerAssociationRequestServiceImpl.java:53, 89, 108, 117)."
  - "Bulk-cancel inside the update path: when a request is APPROVED, cancelCollisionAssociationById (OwnerAssociationRequestServiceImpl.java:192-203) marks all colliding open requests DECLINED — an N+1 activity-row write per cancelled row (OwnerAssociationRequestServiceImpl.java:198-201). For an Owner with many pending requesters, the approval of one cascades into N audit-row INSERTs in the same transaction."
- **resource_allocation**:
  - "No memory pinning: every list endpoint is paginated; no full-table materialisation."
  - "Single DB round-trip per method, plus optional cascade-cancel writes (per cancelCollisionAssociationById fan-out described above)."
- **scaling_characteristics**:
  - "Stateless controller — instances scale horizontally."
  - "@ReactiveTransactional per mutating service method (OwnerAssociationRequestServiceImpl.java:53, 89, 108, 117) — each call is one PostgreSQL transaction. Approvals on an Owner with N pending colliders write N+1 rows; concurrent approvals on the same Owner can deadlock on owner_association_request lock acquisition order (not currently observed; not currently guarded)."
  - "No pagination upper bound on getOwnerAssociationRequestList page-size: the controller passes Integer (line 38-39) straight to the repository (OwnerAssociationRequestServiceImpl.java:80-82). A malicious or careless caller can request size=1_000_000 and force a multi-second join."
- **known_performance_gaps**:
  - "No page-size upper bound on either list endpoint (request list line 36-45; activity list line 47-53). Future operator scenarios with thousands of approved request entries can stall the audit-list UI on a wide query." — evidence: OwnerAssociationRequestController.java:38-39 + OwnerAssociationRequestController.java:48-49 — severity: LOW
  - "Cascade-cancel fan-out: approving one request among N colliders inside @ReactiveTransactional writes N+1 owner_association_request_activity rows in the same transaction, holding row locks on N owner_association_request rows. Worst-case (popular Owner, many pending requesters) is an O(N) lock-window approval." — evidence: OwnerAssociationRequestServiceImpl.java:192-203 + 117 (@ReactiveTransactional) — severity: LOW

## sources

- understanding ← OwnerAssociationRequestController.java:1-86 (entire file) + OwnerAssociationRequestServiceImpl.java:1-222 (delegation target) + SecurityConstants.java:148-162 (authorization wiring) + WebFetch 2026-05-20 doc URLs
- concepts.entities.* ← OwnerAssociationRequestController.java:5-13 (the contract-model imports)
- concepts.operations.* ← OwnerAssociationRequestController.java:28-85 (the 7 @Override method bodies)
- concepts.invariants.* ← OwnerAssociationRequestController.java:23 (implements interface) + OwnerAssociationRequestController.java:22 (@RequiredArgsConstructor) + OwnerAssociationRequestServiceImpl.java:64 (DIRECT_OWNER_SYNC branch)
- dependencies_semantic.requires-feature ← F-019 detail file line 16, 184, 270, 721-741 + F-011 detail file line 96, 653 + PolicyPermissionDto.java:68-70
- dependencies_semantic.requires-runtime ← OwnerAssociationRequestController.java:18-19 (ServerWebExchange + Mono) + OwnerAssociationRequestServiceImpl.java:55-56 (authIdentityProvider.getCurrentUser + RuntimeException on empty)
- tests_coverage_semantic.test_files ← Glob `**/OwnerAssociationRequest*Test.java` returned 3 files (mapper + 2 repository tests, no controller test)
- docs_link_semantic.inferred_docs[0] ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/user-owner-association — 2026-05-20, status 200, excerpted quotes
- docs_link_semantic.inferred_docs[1] ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/owners — 2026-05-20, status 200, excerpted quotes
- docs_link_semantic.doc_drift_findings ← intersection of WebFetched live doc content vs OwnerAssociationRequestController.java:28-85 (the 7 surfaced behaviours) + OwnerAssociationRequestServiceImpl.java:64-67 (DIRECT_OWNER_SYNC) + OwnerAssociationRequestServiceImpl.java:109-114 (MANUAL flow)
- implicit_adrs.[0] ← OwnerAssociationRequestController.java:25 (separate activityService field) + OwnerAssociationRequestActivityType.java:3-8
- implicit_adrs.[1] ← OwnerAssociationRequestServiceImpl.java:131-148 + 205-221
- implicit_adrs.[2] ← OwnerAssociationRequestServiceImpl.java:60-67 + PolicyPermissionDto.java:70
- implicit_adrs.[3] ← SecurityConstants.java:148-162 + OwnerAssociationRequestController.java:28-34 + OwnerAssociationRequestServiceImpl.java:55
- implicit_adrs.[4] ← SecurityConstants.java:148-162 + OwnerAssociationRequestController.java:81-85 + OwnerAssociationRequestServiceImpl.java:125-129
- implicit_adrs.[5] ← OwnerAssociationRequestController.java:1-86 (zero @PreAuthorize across the file) + SecurityConstants.java:148-162
- bugs_limitations_corner_cases.[0] ← OwnerAssociationRequestServiceImpl.java:57 + F-019 detail file line 267-281
- bugs_limitations_corner_cases.[1] ← OwnerAssociationRequestController.java:36-45 + OwnerAssociationRequestController.java:56-63 + OwnerAssociationRequestServiceImpl.java:184-190 + F-019 detail file line 721-741 (REFACTOR-427)
- bugs_limitations_corner_cases.[2] ← OwnerAssociationRequestController.java:65-72 + OwnerAssociationRequestServiceImpl.java:109-114
- bugs_limitations_corner_cases.[3] ← OwnerAssociationRequestController.java:74-79 + OwnerAssociationRequestServiceImpl.java:118-122
- bugs_limitations_corner_cases.[4] ← OwnerAssociationRequestServiceImpl.java:205-221 (the else-branch at 217-219)
- bugs_limitations_corner_cases.[5] ← Grep `OwnerAssociationRequestController` <odd-platform-api>/src/test (zero matches)
- bugs_limitations_corner_cases.[6] ← WebFetch user-owner-association doc 2026-05-20 + OwnerAssociationRequestServiceImpl.java:60-67
- bugs_limitations_corner_cases.[7] ← OwnerAssociationRequestController.java:65-72 + WebFetch user-owner-association doc 2026-05-20
- security.auth_mode_relevance ← OwnerAssociationRequestServiceImpl.java:55-56 + 92-93 + 134-135 + 158-159
- security.authorization_assertions.* ← SecurityConstants.java:148-162 (path-pattern table) + OwnerAssociationRequestServiceImpl.java:64 (in-service DIRECT_OWNER_SYNC check)
- security.owner_scoping ← OwnerAssociationRequestServiceImpl.java:84-86 (repository.getDtoList passes through query/status but no current-user filter) + OwnerAssociationRequestController.java:36-45 (no exchange.getPrincipal use beyond the WebFlux scaffolding)
- security.data_exposure.* ← OpenAPI openapi.yaml:3349-3414 (the response schemas) + OwnerAssociationRequestServiceImpl.java:125-129 (provider enumeration shape)
- security.known_security_gaps.[0] ← SecurityConstants.java:148-162 (gap) + OwnerAssociationRequestServiceImpl.java:57
- security.known_security_gaps.[1] ← SecurityConstants.java:148-162 (gap on /api/owner_association_request/activity) + OwnerAssociationRequestController.java:47-53 + openapi.yaml:3392-3414
- security.known_security_gaps.[2] ← SecurityConstants.java:148-162 (gap on /api/owners/providers) + OwnerAssociationRequestController.java:81-85
- security.known_security_gaps.[3] ← OwnerAssociationRequestServiceImpl.java:60-67 + OwnerAssociationRequestServiceImpl.java:57 (composition: DIRECT_OWNER_SYNC + getOrCreate)
- security.known_security_gaps.[4] ← OwnerAssociationRequestController.java:65-72 + OwnerAssociationRequestServiceImpl.java:131-148 + WebFetch user-owner-association doc 2026-05-20
- security.known_security_gaps.[5] ← OwnerAssociationRequestServiceImpl.java:55-56 + 92-93 + 134-135 + 158-159 (fail-fast on null current user across all four mutating service methods)
- performance.hot_paths.* ← OwnerAssociationRequestController.java:36-45 + 47-53 + ReactiveOwnerAssociationRequestActivityRepositoryImpl.java:36-44 (Tables.OWNER twice via aliases for join shape)
- performance.scaling_characteristics.* ← OwnerAssociationRequestServiceImpl.java:53 + 89 + 108 + 117 (@ReactiveTransactional placement) + OwnerAssociationRequestServiceImpl.java:192-203 (cascade-cancel fan-out)
- performance.known_performance_gaps.[0] ← OwnerAssociationRequestController.java:38-39 + 48-49 (Integer page-size, no upper bound)
- performance.known_performance_gaps.[1] ← OwnerAssociationRequestServiceImpl.java:192-203 + 117 (@ReactiveTransactional)

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: HIGH
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: MEDIUM

## Maintainer notes
