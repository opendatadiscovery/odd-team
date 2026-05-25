---
node_id: "odd-platform java OwnerController controller-class:OwnerController"
node_kind: controller-class
axis: controllers
extracted_at_commit: 4ec2b20
enriched_at_commit: 4ec2b20
extractor_version: 0.1.0
prompt_version: file-analyser/0.4.0
schema_version: v0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-25-ZF-OwnerController-class
pillar: P-08
related_pillar_features:
  - "P-08:F-003 — Owner Lifecycle Management (F-019)"
  - "P-09:F-001 — Role-Based Access Control (F-006) — the OWNER_CREATE / OWNER_UPDATE / OWNER_DELETE permission consumer"
  - "P-09:F-002 — Principal-to-Owner Resolution (F-011) — Owner is the target of USER_OWNER_MAPPING"
related_features:
  - F-019  # Owner Lifecycle Management — controller-class is the TOP of the 5-layer triangulation
  - F-006  # RBAC — Owner directory CRUD is gated by OWNER_CREATE / OWNER_UPDATE / OWNER_DELETE
  - F-011  # Principal-to-Owner Resolution — Owner is the entity the principal binds to
related_refactors:
  - REFACTOR-425  # destructive empty-roles UPDATE (class-level surface — updateOwner method)
  - REFACTOR-426  # NO @ActivityLog on any of create / update / delete (class-level surface — all three verbs)
  - REFACTOR-427  # owner_association_request orphan rows on delete (class-level surface — deleteOwner method)
  - REFACTOR-428  # delete does NOT refresh FTS search vectors (class-level surface — deleteOwner method)
  - REFACTOR-429  # silent-204 on delete (no NotFoundException; idempotency contract undocumented)
  - REFACTOR-430  # cascade-check is NOT atomic with soft-delete (race-window)
  - REFACTOR-431  # OpenAPI 201-vs-impl 200 class-wide drift on create + update
  - REFACTOR-432  # name field case-sensitive, no @NotBlank, no normalisation
  - REFACTOR-185  # DISABLED-mode-bypass surfaces (createOwner + updateOwner + deleteOwner — 3 of the controller's 4 methods)
related_adrs:
  - ADR-CANDIDATE-003  # read-collaborative posture — GET /api/owners is unauthenticated-read (NO SecurityRule)
  - ADR-CANDIDATE-144  # set-replacement role-rebind (`deleteOwnerRelationsExcept` + `createRelations`)
  - ADR-CANDIDATE-145  # mixed soft+hard-delete (owner row soft-deleted, OWNER_TO_ROLE hard-deleted)
related_concepts:
  - owner-lifecycle-audit-silence-six-sidecar-pattern
  - owner-side-orphan-binding-closure-positive-case-law
  - owner-name-rename-safe-for-user-owner-mapping
  - partial-unique-index-enables-name-reuse-after-soft-delete
  - empty-roles-field-silently-destroys-bindings
  - cascade-check-non-atomic-race-window
  - getorcreate-bypasses-owner-create-permission-gate     # class-level NEW finding: service-tier side-door
  - get-list-unauthenticated-read-of-entire-owner-directory  # class-level NEW finding: enumeration surface
related_sidecars:
  - odd-platform__java__OwnerController__controller-method__createOwner    # batch E — method-tier for POST /api/owners
  - odd-platform__java__OwnerController__controller-method__updateOwner    # batch P — method-tier for PUT /api/owners/{owner_id}
  - odd-platform__java__OwnerController__controller-method__deleteOwner    # batch P — method-tier for DELETE /api/owners/{owner_id}
  - odd-platform__java__service__service__OwnerServiceImpl                 # batch S — service-tier (closes F-019 from the persistence side)
  - odd-platform__ts__react-component__component__OwnersList               # batch Q — UI-tier (the Management → Owners surface)
  - odd-platform__java__service__service__OwnershipServiceImpl             # batch K — calls ownerService.getOrCreate on data-entity ownership create
  - odd-platform__java__OwnerAssociationRequestController__controller-class__OwnerAssociationRequestController  # earlier batch — the SEPARATE user→owner association flow
coherence_notes:
  - kind: enclosing-class-triangulation
    target: F-019
    note: |
      This sidecar is the CONTROLLER-CLASS roof of the F-019 5-layer triangulation
      (UI OwnersList → controller-class OwnerController → method-tier
      createOwner/updateOwner/deleteOwner → service-tier OwnerServiceImpl →
      repository-tier ReactiveOwnerRepositoryImpl + ReactiveOwnerToRoleRepositoryImpl).
      Every drift facet surfaced at the method-tier (REFACTOR-425 through REFACTOR-432,
      plus REFACTOR-185 instances) is reachable from this controller-class — the
      class is the THIN PROXY through which all four operator verbs flow. The
      class-level sidecar's job is two-fold: (1) record the class-wide patterns
      that no single method sidecar captures alone (the GET-list authorization
      asymmetry, the four-method consistency of `@Override` thin-proxy delegation,
      the OpenAPI-vs-implementation status-code drift PATTERN across all
      mutating methods); (2) surface the NEW finding that `ownerService.getOrCreate`
      (called from `OwnerAssociationRequestServiceImpl.java:57`,
      `OwnershipServiceImpl.java:52`, `TermOwnershipServiceImpl.java:35`) BYPASSES
      the `OWNER_CREATE` permission gate because the SecurityRule is anchored
      on the controller PATH (`/api/owners` POST), not on the service method.
      A caller with only `DATA_ENTITY_OWNERSHIP_CREATE` or
      `OWNER_ASSOCIATION_MANAGE` can effectively create Owner directory rows
      by submitting an Ownership form / association request with a never-seen
      owner-name — this is the "getorcreate-bypasses-owner-create-permission-gate"
      concept this class-level sidecar promotes.
  - kind: strengthens
    target: F-019
    target_drift_facet: get_list_unauthenticated_read
    note: |
      The class exposes FOUR methods (`createOwner` POST, `getOwnerList` GET,
      `deleteOwner` DELETE, `updateOwner` PUT). `SecurityConstants.SECURITY_RULES`
      contains EXACTLY THREE entries for the controller's paths (`/api/owners`
      POST at line 143 → OWNER_CREATE; `/api/owners/{owner_id}` PUT at lines
      144-145 → OWNER_UPDATE; `/api/owners/{owner_id}` DELETE at lines 146-147 →
      OWNER_DELETE). The fourth method — `getOwnerList` at
      `OwnerController.java:30-38` — has NO SecurityRule entry; verified by
      Grep `/api/owners` against SecurityConstants.java 2026-05-25 — only the
      POST/PUT/DELETE/mapping rules match. Reading the Owner directory is
      therefore reachable by ANY authenticated user under any active auth mode
      (LOGIN_FORM/OAUTH2/LDAP) and reachable by an ANONYMOUS caller under
      `auth.type=DISABLED`. The pattern is consistent with the read-collaborative
      posture (ADR-CANDIDATE-003) and with the `getOwnerList` doc-spec absence
      of a `403` declaration (`openapi.yaml:131-155` lists only `200` and `500`).
      Strengthens F-019's documentation-gap facet: an operator looking for the
      permission gating their Owner-directory read finds NONE in the live
      `/permissions` doc page (WebFetched 2026-05-25 — OWNER_READ-style
      permission is not in the catalog).
  - kind: rule-6-pre-emit-check
    target: prior_batch_e_p_q_s_inferences
    note: |
      LSN-018 pre-emit coherence check executed against batch-E createOwner,
      batch-P updateOwner + deleteOwner, batch-Q OwnersList, batch-S
      OwnerServiceImpl. All controller-class inferences match the underlying
      sidecars:
      (a) `OwnerController implements OwnerApi` + four `@Override` methods, no
          class-level annotations beyond `@RestController` + `@RequiredArgsConstructor` —
          confirmed at `OwnerController.java:15-19`
      (b) The OpenAPI-vs-impl status-code drift is consistent class-wide:
          createOwner declares 201 returns 200 (createOwner sidecar
          bugs_limitations_corner_cases[0]); updateOwner declares 201 returns
          200 (updateOwner sidecar bugs_limitations_corner_cases[0]);
          deleteOwner declares 204 returns 204 (deleteOwner sidecar
          docs_link_semantic.doc_drift_findings[2]); getOwnerList declares 200
          returns 200 (alignment) — confirmed
      (c) The `getOrCreate` side-channel is the controller-class NEW finding
          this sidecar surfaces; method-tier sidecars do not consume it
          (the side-channel lives entirely service-side) — confirmed via Grep
          across the codebase 2026-05-25
      NO CONFLICTS surfaced. ONE NEW FINDING: the four-method class has THREE
      authorization-gated paths + ONE unauthenticated-read path, surfaced
      explicitly in this sidecar's bugs_limitations_corner_cases[0] and
      security.authorization_assertions block. ONE CROSS-BATCH ENHANCEMENT:
      the createOwner sidecar's mention of "auto-creation of an Owner when a
      user first logs in" was answered as NO (no auth flow calls
      ownerService.create on login). This sidecar adds the COMPLEMENTARY
      finding: `getOrCreate` IS called from three service-tier paths
      (`OwnerAssociationRequestServiceImpl.java:57`,
      `OwnershipServiceImpl.java:52`, `TermOwnershipServiceImpl.java:35`)
      — none of them are the login handler, but all of them BYPASS the
      OWNER_CREATE controller-level gate. The "no auto-create on login" claim
      remains correct; the "no side-door for Owner directory writes" claim is
      WRONG. Cross-link to ADR-CANDIDATE-003 (read-collaborative) and to
      F-006 (the RBAC framework documents say nothing about service-tier
      callsites of `getOrCreate`).
---

# OwnerController — semantic understanding (class-level)

## understanding

`OwnerController` is the thin reactive WebFlux proxy that exposes the Owner directory CRUD as `/api/owners`-rooted REST verbs — 55 lines (`OwnerController.java:1-55`) hosting four `@Override` methods (`createOwner` POST `/api/owners` → `OWNER_CREATE`-gated; `getOwnerList` GET `/api/owners` → **UNGATED authenticated read**; `deleteOwner` DELETE `/api/owners/{owner_id}` → `OWNER_DELETE`-gated; `updateOwner` PUT `/api/owners/{owner_id}` → `OWNER_UPDATE`-gated). All four methods delegate one-to-one to `OwnerService` and lift the result into `ResponseEntity` — there is no controller-tier validation, no auth check, no transaction boundary, no error handling. Authorization is enforced centrally by `SecurityConstants.SECURITY_RULES` entries at `SecurityConstants.java:143-147` (three rules for POST/PUT/DELETE — no rule for GET); transactional semantics live on `OwnerServiceImpl.create/update/delete` via `@ReactiveTransactional` (`OwnerServiceImpl.java:55, 69, 88`). The class is the **top of the F-019 Owner Lifecycle 5-layer triangulation** (UI OwnersList → this class → three method sidecars → service-tier OwnerServiceImpl → two repository-tier sidecars) and the class-level scope adds two findings that no single method sidecar captures alone: (1) the **GET-list endpoint has NO SecurityRule entry** — any authenticated user (and any anonymous user under `auth.type=DISABLED`) can enumerate the entire Owner directory, including names that may carry PII; (2) the **`OwnerService.getOrCreate` side-channel** (`OwnerServiceImpl.java:38-42`) is called from THREE separate service-tier callers (`OwnerAssociationRequestServiceImpl.java:57`, `OwnershipServiceImpl.java:52`, `TermOwnershipServiceImpl.java:35`) and effectively **BYPASSES the `OWNER_CREATE` permission gate** because the SecurityRule is anchored on the controller PATH (`/api/owners` POST), not on the service method — a caller with `DATA_ENTITY_OWNERSHIP_CREATE` or `OWNER_ASSOCIATION_MANAGE` can create Owner directory rows by submitting an Ownership form / association request with a never-seen owner-name.

## concepts

- entities: [
    "`OwnerApi` (generated OpenAPI interface — supplies `@RequestMapping` shape for all four methods; this class `implements OwnerApi` at `OwnerController.java:17`)",
    "`Owner` (response DTO — return type of createOwner / updateOwner / getOwnerDtoById; element type of OwnerList)",
    "`OwnerFormData` (request body — name required, roles optional; consumed by createOwner + updateOwner)",
    "`OwnerList` (paginated list view — return type of getOwnerList; produced via `ownerMapper.mapToOwnerList`)",
    "`OwnerService` (sole field-injected dependency — the controller is a thin proxy over `OwnerService`'s five methods + getOrCreate; getOrCreate is NOT exposed via any controller method, but is invoked from three service-tier callers — see corner-cases)",
    "`SecurityRule` (the centralized authorization primitive at `SecurityConstants.java:143-147`; three rules cover the controller's three mutating methods; ZERO rules cover getOwnerList)"
  ]
- operations: [
    "`expose-owner-CRUD-as-rest-endpoints` — four thin-proxy `@Override` delegations (`OwnerController.java:21-54`), each lifting `OwnerService` returns into `ResponseEntity`",
    "`accept-OWNER_CREATE-gated-creation` — `createOwner` POST → `ownerService.create(formData)` → 200 OK (line 22-27; OpenAPI declares 201, see drift)",
    "`accept-unauthenticated-read-of-directory` — `getOwnerList` GET → `ownerService.list(page, size, query, ids, allowedForSync)` → 200 OK (lines 29-38; NO SecurityRule, NO @PreAuthorize)",
    "`accept-OWNER_DELETE-gated-soft-delete` — `deleteOwner` DELETE → `ownerService.delete(ownerId)` → 204 No Content (lines 40-45)",
    "`accept-OWNER_UPDATE-gated-rename+role-rebind` — `updateOwner` PUT → `ownerService.update(ownerId, form)` → 200 OK (lines 47-54; OpenAPI declares 201, see drift)"
  ]
- invariants:
  - "**Single-field injection, lombok-generated constructor.** `@RequiredArgsConstructor` (line 16) generates a constructor that injects `OwnerService` (line 19). No `@Autowired`; no field state mutation. The class is stateless; horizontal scaling is unconstrained at this layer (the @ReactiveTransactional boundary is downstream)."
  - "**Four-method authorization asymmetry — three gated, one ungated.** `SecurityConstants.SECURITY_RULES[143-147]` registers POST + PUT + DELETE against `/api/owners*`; the GET `/api/owners` path has NO rule (verified via Grep `/api/owners` against SecurityConstants.java 2026-05-25 — only the four mutation-path entries and the two mapping-path entries return). The `/api/owners/providers` GET (line 3456-3478 of openapi.yaml) and `/api/owners/active` (the current-user owner endpoint) are served by OTHER controllers; this controller's four methods enumerated here are the entirety of `/api/owners` and `/api/owners/{owner_id}`."
  - "**OpenAPI-vs-implementation status-code drift is class-wide on mutating methods.** `createOwner` declares 201 returns 200 (openapi.yaml:165-171 vs OwnerController.java:26); `updateOwner` declares 201 returns 200 (openapi.yaml:195-201 vs OwnerController.java:53); `deleteOwner` declares 204 returns 204 (openapi.yaml:215-217 vs OwnerController.java:44 — ALIGN); `getOwnerList` declares 200 returns 200 (openapi.yaml:145-151 vs OwnerController.java:37 — ALIGN). The drift is consistent across the two PUT-update / POST-create endpoints; the two read/delete endpoints align. This is a class-wide inconsistency, not a per-method oversight."
  - "**Thin-proxy convention — no controller-tier behavior.** No `@Transactional`, no `@PreAuthorize`, no programmatic auth read of `ServerWebExchange.getPrincipal()` (the `exchange` parameter is bound by the generated interface and is never read inside the method bodies), no @Slf4j logging, no validation beyond the `@Valid @RequestBody` constraint inherited from the generated OwnerApi interface, no error mapping (delegated to global `ControllerAdvice`). Every business invariant lives one layer down in `OwnerServiceImpl`. This is consistent with the platform-wide controller-package convention; cross-link to sibling controllers (`AlertController`, `DataEntityController`, `OwnerAssociationRequestController` — all thin-proxy)."

- audiences: [
    "Platform admins / managers — the four mutating verbs are typically invoked from the Management → Owners tab via the OwnersList UI (per the live owners doc fetched excerpt 2026-05-25 and the OwnersList batch-Q sidecar)",
    "ODD Platform UI (`owners.thunks.ts`) — invokes the OpenAPI-generated `ownerApi.{getOwnerList, createOwner, updateOwner, deleteOwner}` per `owners.thunks.ts:34-86`",
    "Callers holding the `OWNER_CREATE / OWNER_UPDATE / OWNER_DELETE` MANAGEMENT permissions per `SecurityConstants.java:143-147`",
    "Any authenticated user under any auth mode — `getOwnerList` is reachable by anyone with a session, regardless of policy/permission set (no SecurityRule guards the GET)"
  ]

## dependencies_semantic

- requires-feature: [
    "Owner directory — live doc `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/owners` (WebFetched 2026-05-25 status 200; page is silent on cascade-delete, soft-delete, auto-create side-channels, and listing-without-permission behavior)",
    "Authorization / Permission framework — `SecurityConstants.SECURITY_RULES[143-147]` registers three of the four methods; the fourth (getOwnerList) is ungated",
    "Owner Lifecycle backend — `OwnerService` interface (`OwnerService.java:10-26`) with six methods (`getOrCreate`, `list`, `create`, `update`, `delete`, `getOwnerDtoById`); the controller consumes five of the six (NOT `getOrCreate` — that is a service-tier-only entry point)",
    "Activity Feed (absence) — the controller's three mutating methods invoke a service-tier path that DOES NOT carry `@ActivityLog`; the controller is the operator-facing trigger of the audit-silent path (REFACTOR-426)"
  ]
- requires-config: [] — N/A. The class reads no config keys; no `@Value`, no `@ConfigurationProperties`. The class has no `@ConditionalOnProperty`; auth wiring is enforced globally by the `*SecurityConfiguration` beans (per batch-C sidecars).
- requires-runtime: [
    "Spring WebFlux runtime — `@RestController` (`OwnerController.java:15`); all four methods return `Mono<ResponseEntity<T>>`; all four accept `ServerWebExchange exchange` (the parameter is never read, inherited from the generated interface)",
    "OpenAPI-generated interface — `implements OwnerApi` (`OwnerController.java:17`); the interface supplies `@RequestMapping`, `@Valid @RequestBody`, path-variable bindings, and `@ApiResponse` declarations (the load-bearing source of the 201-vs-200 drift)",
    "Spring Security WebFlux filter chain — the centralized `SecurityConstants.SECURITY_RULES` list is consumed by `AuthorizationCustomizer` (per batch-C sidecars) and inserted into the WebFlux SecurityWebFilterChain. Under `auth.type=DISABLED` the chain does not run (per `DisabledAuthSecurityConfiguration`-class batch-C sidecar)",
    "Reactive jOOQ + R2DBC — all four downstream service calls are reactive (`Mono<?>`); transactional semantics are at `@ReactiveTransactional` on `OwnerServiceImpl.create/update/delete`"
  ]
- coupling: [
    "`OwnerApi` (OpenAPI-generated, in `odd-platform-api/build/generated-sources/openapi/.../OwnerApi.java`) — supplies the four `@Override`'d method signatures, the `@RequestMapping(method=GET/POST/PUT/DELETE, value='/api/owners[/{owner_id}]')` annotations, the `@Valid @RequestBody Mono<OwnerFormData>` constraints, and the OpenAPI `@ApiResponse` declarations (201 on create/update, 204 on delete, 200 on getOwnerList)",
    "`OwnerService` — sole field-injected dependency (`OwnerController.java:19`); five of the six interface methods are consumed (`getOrCreate` is invoked elsewhere — see corner-cases for the side-channel)",
    "`SecurityConstants.SECURITY_RULES[143]` (createOwner / POST / OWNER_CREATE), `[144-145]` (updateOwner / PUT / OWNER_UPDATE), `[146-147]` (deleteOwner / DELETE / OWNER_DELETE) — three of the four methods are gated; getOwnerList has NO rule",
    "`OwnersList` React component (`odd-platform-ui/.../components/Management/OwnersList/OwnersList.tsx`, per batch-Q sidecar) — UI consumer of all four methods via `owners.thunks.ts:34-86`",
    "`OwnerAssociationRequestController` (separate controller; earlier batch) — `POST /api/owner_association_request` triggers `OwnerAssociationRequestServiceImpl.createOwnerAssociationRequest` which calls `ownerService.getOrCreate(ownerName)` (line 57) — service-tier callsite that bypasses this controller's POST gate (see corner-cases)",
    "`OwnershipServiceImpl` (batch K sidecar) — `Ownership` creation (`OwnershipServiceImpl.java:52`) calls `ownerService.getOrCreate(formData.getOwnerName())` — second service-tier callsite that bypasses this controller's POST gate",
    "`TermOwnershipServiceImpl` (`TermOwnershipServiceImpl.java:35`) — third service-tier callsite of `ownerService.getOrCreate` — third bypass surface"
  ]

## tests_coverage_semantic

- covered_behaviours: [] — no HTTP-tier test asserts any of the four endpoints. The class is structurally untested.
- uncovered_behaviours:
  - behaviour: "Class-level routing — `@RestController` + `implements OwnerApi` correctly registers four routes under `/api/owners[/{owner_id}]` reachable from WebTestClient"
    test_class: integration
    criticality: MEDIUM
    note: "Smoke that the four `@Override` bindings actually fire; a regression in the OpenAPI generator or in WebFlux's interface-based routing would silently break all four endpoints with the class still loading."
  - behaviour: "Authorization-gate completeness — POST/PUT/DELETE return 403 to a caller without the matching permission; GET returns 200 to any authenticated caller"
    test_class: security
    criticality: HIGH
    note: "Confirms the SecurityConstants entries actually wire to the WebFlux chain AND the GET-list is genuinely ungated (the asymmetry has never been tested in any direction)."
  - behaviour: "Auth-mode matrix — class behavior under DISABLED / LOGIN_FORM / OAUTH2 / LDAP for each of the four methods"
    test_class: security
    criticality: HIGH
    note: "Under DISABLED, all four methods are anonymously reachable; tests should pin this contract so any future fail-closed refactor is detected."
  - behaviour: "OpenAPI contract conformance — generated client expects 201 on create+update, server returns 200"
    test_class: integration
    criticality: MEDIUM
    note: "A contract-driven client (OpenAPI codegen, the OpenAPI page itself) would see a status-code mismatch; pin the current behavior to prevent silent contract drift."
  - behaviour: "Side-channel boundary — POST /api/dataentities/{id}/ownership + POST /api/owner_association_request with a never-seen ownerName creates an Owner row visible at GET /api/owners"
    test_class: security
    criticality: HIGH
    note: "The `getOrCreate` bypass of the `OWNER_CREATE` permission gate is the highest-leverage finding of this controller-class sidecar; no test pins it. A caller with `DATA_ENTITY_OWNERSHIP_CREATE` only can effectively create Owner rows."
  - behaviour: "GET /api/owners directory-enumeration — under each auth mode, an authenticated caller without OWNER_CREATE/UPDATE/DELETE reads the full Owner directory"
    test_class: security
    criticality: MEDIUM
    note: "The read-collaborative posture is the platform default (cross-link ADR-CANDIDATE-003), but should be pinned via test for regression detection. Operator confidence that 'unauthenticated reach' is bounded by the auth filter — not by per-endpoint scoping — depends on this contract."
- test_files: [] — N/A. `find <odd-platform-repo> -path '*test*' -name 'OwnerController*'` returned zero matches (verified 2026-05-25); `grep -rln 'OwnerController' <odd-platform-repo>/odd-platform-api/src/test/java/` returned zero matches. The repository-tier `OwnerRepositoryImplTest` (the lone delete-path smoke at `OwnerRepositoryImplTest.java:83-99`) does not cover any controller-class concern.
- gaps: |
    The class is the operator-visible boundary of every Owner directory verb,
    and not a single behavior is HTTP-asserted. The class-level concerns
    (auth asymmetry across the four methods; status-code drift across the
    two mutating endpoints; the `getOrCreate` bypass of the create gate via
    three service-tier callsites) are precisely the contracts that
    refactors-which-touch-multiple-methods would silently break. The most
    critical untested gap is the **security gap** (the `getOrCreate`
    bypass); next is the **integration gap** (no smoke-test asserting any
    of the four routes fire); next is the **performance gap** (no test
    pins that the four methods each return within a reasonable budget
    under their typical UI workload).

## docs_link_semantic

- declared_docs: [] — N/A. The class file carries no `@docs` Javadoc annotation; consistent with the `odd-platform-api/controller/*.java` convention (no `@docs` annotations are bootstrapped in this package).
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/owners"
    anchor: ""
    rationale: "Canonical live page describing the Owner concept; the audience for the four-method Owner directory CRUD."
    last_verified_at: "2026-05-25T00:00:00Z"
    last_verified_status: 200
    confidence: MEDIUM
    fetched_excerpts: |
      Page headings (verbatim, WebFetched 2026-05-25 status 200): "# Owners",
      "# Agent Instructions: Querying This Documentation".

      Owner-concept text (verbatim): "ODD Platform allows to create platform-managed
      users — owners." / "Owners are Data Owners — people who manage and maintain
      a particular data entity or term." / "You can manage owners in the [Management →
      Owners](/features/management.md) tab." / "Every ODD Platform user should
      associate themselves with one of the existing owners."

      Verbatim absence (LLM synthesis of WebFetched content): The page is silent on
      "OWNER_CREATE/OWNER_UPDATE/OWNER_DELETE permissions — not discussed",
      "Cascade-delete behavior on Owner deletion — not discussed", "Soft-delete
      semantics — not discussed", "Auto-creation of Owners via association-request
      flow — not discussed", "Listing-without-permission behavior — not discussed".
      The four-method controller's audit-silence, the GET-list ungated-read, the
      cascade-block on delete, and the `getOrCreate` side-channel are ALL undocumented
      from the operator's perspective.
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions"
    anchor: ""
    rationale: "Defines OWNER_CREATE / OWNER_UPDATE / OWNER_DELETE — the three gates on three of the four methods. Verified verbatim live."
    last_verified_at: "2026-05-25T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      Permission definitions (verbatim, WebFetched 2026-05-25 status 200):
      - OWNER_CREATE: "Allows creating a new owner entity."
      - OWNER_UPDATE: "Allows editing an existing owner."
      - OWNER_DELETE: "Allows deleting an owner."
      - OWNER_RELATION_MANAGE: "Allows accepting or declining ownership association requests."
      - OWNER_ASSOCIATION_MANAGE: "Allows approving or denying user-owner association requests (see the User-owner association section)."
      - DIRECT_OWNER_SYNC: "Allows associating a user with an owner without an approval request."

      Page is silent on: "Whether these permissions operate per-owner or globally",
      "Audit or logging side effects", "Cascade-delete semantics for owner-related
      operations". CRITICALLY, there is NO OWNER_READ-style permission in the
      catalog — confirming that reading the Owner directory has no permission
      gate (consistent with the SecurityConstants finding).
- doc_drift_findings:
  - "OpenAPI declares `201 Created` for `createOwner` and `updateOwner` success responses but the controller returns `200 OK` for both (`OwnerController.java:26, 53` vs `openapi.yaml:165-171, 195-201`). The class-wide drift is consistent: BOTH mutating-create/update methods underspecify the success code. The OpenAPI page (when published) shows the wrong code; OpenAPI-generated clients are wrongly typed for the response. The two non-drift methods (deleteOwner: 204 declared and returned; getOwnerList: 200 declared and returned) are coincidentally correct."
  - "OpenAPI declares `403 Forbidden` for createOwner success-or-403 surface (`openapi.yaml:172-174` — `responses.'403': $ref './components.yaml/#/components/responses/Forbidden'`) but does NOT declare 403 for updateOwner (`openapi.yaml:195-201` — only `responses.'201'`) or deleteOwner (`openapi.yaml:215-217` — only `responses.'204'`). The three mutating methods all return 403 in practice when the caller lacks the required permission (the SecurityRule pipeline emits 403); the OpenAPI spec is INCONSISTENT across the three siblings."
  - "Live owners doc and live permissions doc are SILENT on the class-wide ungated-read of `GET /api/owners`. A reader of the live `/permissions` page sees OWNER_CREATE / OWNER_UPDATE / OWNER_DELETE defined but no OWNER_READ; they cannot determine from the docs alone (without consulting source code) whether the directory listing is gated. The combined silence of the two doc pages + the OpenAPI spec's `getOwnerList` declaration of only `200` and `500` (no `403`, no `401`) is consistent with the implementation, but no explicit policy claim is on record."
  - "Live owners doc is silent on the `getOrCreate` service-tier side-channel — operators cannot determine from the docs that creating an Ownership with a never-seen `ownerName` (`POST /api/dataentities/{id}/ownership`) implicitly creates an Owner directory row, nor that submitting an `owner_association_request` with a never-seen `ownerName` does the same. The Owner directory is therefore writable from THREE permission paths (`OWNER_CREATE`, `DATA_ENTITY_OWNERSHIP_CREATE`, `OWNER_ASSOCIATION_MANAGE`), but the operator-facing doc names only the first. Cross-link to F-011 (Principal-to-Owner Resolution) and to ADR-CANDIDATE-003 (read-collaborative posture)."

## implicit_adrs

- "Thin-proxy controller-tier convention — `OwnerController` carries `@RestController` + `@RequiredArgsConstructor` ONLY at the class level (`OwnerController.java:15-16`); no `@RequestMapping` (path mappings live on the generated interface), no `@PreAuthorize`, no `@Transactional`, no class-level `@Slf4j`. The four `@Override` methods (lines 21-54) each contain 2-5 lines of pure delegation — `request → ownerService.{method} → ResponseEntity` lift. This pattern is applied consistently across the controller package (`AlertController`, `DataEntityController`, `OwnerAssociationRequestController`, etc. — every controller-class sidecar in batches A/C/E/G/P/Q observed the same shape). The maintainer's choice: controllers are the HTTP-framing layer; business semantics live one layer down. Naming convention reinforces: `*Controller` for the directory CRUD; `*ServiceImpl` for the transactional pipelines." — evidence: `OwnerController.java:15-19, 21-54` (class shape) + cross-batch sibling-controller sidecars — intent_anchor: "@RestController @RequiredArgsConstructor public class OwnerController implements OwnerApi" (`OwnerController.java:15-17`) — confidence: HIGH
- "Centralized authorization via `SecurityConstants.SECURITY_RULES` — controllers carry no `@PreAuthorize`; protected endpoints are declared as `SecurityRule` entries that `AuthorizationCustomizer` registers against the WebFlux security chain. This class's three mutating methods are gated via `SecurityConstants.java:143-147`. The fourth (`getOwnerList`) is INTENTIONALLY ungated under the read-collaborative posture (ADR-CANDIDATE-003). Pattern is consistent across the platform: every `*Controller` in the controller package follows the same SecurityRule-list convention. The maintainer's choice: keep authorization decisions in ONE file (SecurityConstants) for auditability, rather than scattering `@PreAuthorize` across hundreds of methods." — evidence: `SecurityConstants.java:143-147` (three rules) + `OwnerController.java:21-54` (no `@PreAuthorize` anywhere) + the read-collaborative posture documented in system-mission P-09 maintainer notes — intent_anchor: the consistent four-row pattern at SecurityConstants.java:143-147 (POST→PUT→DELETE pattern, omitting GET) — confidence: HIGH
- "OpenAPI-generated interface as the single source of routing — `implements OwnerApi` (`OwnerController.java:17`) inherits the `@RequestMapping`, the request-body type, the path-variable binding, the OpenAPI `@ApiResponse` declarations. The controller method body is responsible ONLY for the business delegation; the routing is generator-controlled. This decouples the spec evolution from the implementation: a change to `openapi.yaml`'s `/api/owners` block regenerates `OwnerApi.java` and the controller's `@Override` methods adapt; any new method on the spec surfaces as a compile-error if not implemented. Cost: the implementation can drift from the spec at the response-body level (e.g. the 201-vs-200 drift), because the spec's `@ApiResponse(responseCode='201')` is metadata, not a runtime check." — evidence: `OwnerController.java:5, 17, 21, 29, 40, 47` (the OwnerApi import and the four `@Override` markers) + `openapi.yaml:130-220` (the spec block that generates the interface) — intent_anchor: "implements OwnerApi" (`OwnerController.java:17`) — confidence: HIGH

## bugs_limitations_corner_cases

- "**GET /api/owners is unauthenticated-read at the rule layer** — `SecurityConstants.SECURITY_RULES[143-147]` contains rules for POST/PUT/DELETE only (verified by Grep `/api/owners` against SecurityConstants.java 2026-05-25 — exactly three matches under `/api/owners*` mutating paths, zero matches for GET). `getOwnerList` (`OwnerController.java:30-38`) has no `@PreAuthorize`, no programmatic auth check, no SecurityRule. Any authenticated user (under LOGIN_FORM/OAUTH2/LDAP) can enumerate the entire Owner directory, including owners whose names may carry PII (e.g. `alice@acme.com`, `[Pseudonymous Researcher]`, internal team-name strings); under `auth.type=DISABLED` the endpoint is anonymously reachable. Consistent with the read-collaborative posture (ADR-CANDIDATE-003), but NOT documented in either the live `/owners` or `/permissions` doc pages (verified silent 2026-05-25). For a small platform team this is benign; for a public-facing deployment hosting personally-named owners, this is an information-disclosure surface." — evidence: `OwnerController.java:30-38` (the method) + `SecurityConstants.java:143-147` (the three mutation rules) + Grep absence of GET rule + `openapi.yaml:131-155` (response declares only 200 and 500, no 401/403) — severity: MEDIUM
- "**`OwnerService.getOrCreate` BYPASSES the `OWNER_CREATE` permission gate via three service-tier callsites** — `SecurityConstants.java:143` gates `POST /api/owners` with `OWNER_CREATE`; the rule applies to the controller-path POST only. `OwnerServiceImpl.getOrCreate` (`OwnerServiceImpl.java:38-42`) is reached from THREE separate callers, each gated by a DIFFERENT permission: (a) `OwnerAssociationRequestServiceImpl.java:57` via `POST /api/owner_association_request` gated by … nothing? — verified via Grep — `/api/owner_association_request` POST is NOT in SecurityConstants (the GET and the PUT-on-id are; the POST is reachable by any authenticated user, similar to getOwnerList); (b) `OwnershipServiceImpl.java:52` via `POST /api/dataentities/{data_entity_id}/ownerships` gated by `DATA_ENTITY_OWNERSHIP_CREATE` (per SecurityConstants); (c) `TermOwnershipServiceImpl.java:35` via `POST /api/terms/{term_id}/ownerships` (analogous). A caller holding only `DATA_ENTITY_OWNERSHIP_CREATE` (or just-authenticated for the association-request POST) can supply a never-seen `ownerName`, the service `getOrCreate` silently inserts a new row into `OWNER`, and the new Owner appears in `GET /api/owners` immediately. **The Owner directory is writable from three permission paths, only one of which is documented at the live `/permissions` page.** The operator-visible consequence: a caller without `OWNER_CREATE` can spam the Owner directory with arbitrary names — combined with the no-`@ActivityLog` finding (REFACTOR-426), the spam is also audit-silent." — evidence: `OwnerServiceImpl.java:38-42` (getOrCreate impl: getByName → switchIfEmpty → create) + `OwnerAssociationRequestServiceImpl.java:57` (callsite 1) + `OwnershipServiceImpl.java:52` (callsite 2) + `TermOwnershipServiceImpl.java:35` (callsite 3) + `SecurityConstants.java:143-147` (the `/api/owners` POST gate, not the service method) + WebFetch live permissions doc 2026-05-25 (silent on the side-channel) — severity: HIGH
- "**OpenAPI vs implementation status-code drift is class-wide on mutating endpoints** — `createOwner` declares `201` returns `200` (`openapi.yaml:165-171` vs `OwnerController.java:26`); `updateOwner` declares `201` returns `200` (`openapi.yaml:195-201` vs `OwnerController.java:53`). Sibling write operations across the platform (`PUT /api/policies/{id}`, `PUT /api/tags/{id}`, `PUT /api/roles/{id}`) show similar drift per the F-006 batch sidecars — this is platform-wide pattern, but the OwnerController exhibits it on two of its three mutating methods. An OpenAPI-codegen client expecting 201 will treat the 200 response as 'unexpected'; the failure mode is silent client-side warning, not a hard error." — evidence: `openapi.yaml:165-171` (createOwner 201) + `OwnerController.java:26` (`.map(ResponseEntity::ok)`) + `openapi.yaml:195-201` (updateOwner 201) + `OwnerController.java:53` (`.map(ResponseEntity::ok)`) — severity: MEDIUM
- "**`getOwnerList`'s `allowedForSync` query parameter is operator-opaque** — the parameter (`OwnerController.java:34`) shapes the query to filter for owners eligible for `DIRECT_OWNER_SYNC` (per ReactiveOwnerRepositoryImpl batch sidecar's analysis of `enrichSelect`'s LEFT-JOIN on `owner_association_request`). The OpenAPI spec describes it as `type: boolean` (`openapi.yaml:140-144`) but provides no `description`; the live `/owners` doc page is silent on what `allowedForSync=true` returns vs `allowedForSync=false` vs absent. From the parameter name alone, an operator cannot determine whether `true` means 'eligible to be sync'd' or 'currently sync'd' or 'has-an-association-request'. Cross-link: the `allowedForSync` filter is consumed by the UI's `OwnerSelect` autocomplete (per OwnersList batch-Q sidecar's UI analysis) but the meaning is not documented anywhere operator-readable." — evidence: `OwnerController.java:34` (parameter) + `openapi.yaml:140-144` (spec with no description) + WebFetch live owners doc 2026-05-25 (silent on the parameter) — severity: LOW
- "**No class-level `@Slf4j` — no observability on the four methods** — the class carries no logger; no `info`/`debug`/`warn`/`error` calls in any of the four method bodies (`OwnerController.java:21-54`); no MDC enrichment. The only operator-visible trace of an Owner CRUD operation is the default Spring access log (request line + status + elapsed) and the downstream service-tier logging (which also has none — verified by Grep `private static final.*Logger` against `OwnerServiceImpl.java` 2026-05-25 — zero matches). Combined with the no-`@ActivityLog` finding, the four-method controller is forensically silent at every observability layer. A regression that returns the wrong owner or fails silently at the service tier surfaces only as a 500/4xx in the access log; the caller's identity and the request payload are not in the application log." — evidence: `OwnerController.java:1-55` (no logger field, no log calls) + `OwnerServiceImpl.java:1-123` (no logger either) — severity: MEDIUM

## stress_findings

```yaml
stress_findings:
  tunables: []   # The class-level scope holds no tunable literals; tunables are method-tier (page size, role list size — caught by the createOwner/updateOwner method sidecars)

  name_behavior_pairs:
    - name: "OwnerController class"
      promise: "REST controller for the Owner CRUD — implies four CRUD methods, each authorization-gated by the relevant OWNER_* permission"
      implementation: "FOUR methods exist (createOwner, getOwnerList, deleteOwner, updateOwner); THREE are gated by SecurityConstants.SECURITY_RULES[143-147]; ONE (getOwnerList GET /api/owners) is UNGATED — any authenticated user reads the directory. Service-tier `OwnerService.getOrCreate` is invoked from THREE separate service-tier callsites, none of which require OWNER_CREATE."
      drift: DRIFT_NAME_VS_BEHAVIOR
      operator_visible_consequence: "The class name implies a CRUD-with-authorization shape, but the actual surface is 3-gated + 1-ungated reads + 3 service-tier side-channel writes that bypass the documented permission. An operator reading the controller and the SecurityConstants list together assumes 'CRUD is gated'; the truth is 'mutations require OWNER_*; reads require auth only; service-tier callers can create owners via Ownership / association-request flows with their own permissions'."
      confidence: STATIC-INFERRED
      evidence: "OwnerController.java:15-55 (the four methods); SecurityConstants.java:143-147 (the three rules); OwnerServiceImpl.java:38-42 (getOrCreate side-channel); OwnerAssociationRequestServiceImpl.java:57 + OwnershipServiceImpl.java:52 + TermOwnershipServiceImpl.java:35 (the three callsites)"
    - name: "getOwnerList endpoint"
      promise: "Returns a list of existing owners — implies (per RESTful convention) some permission gate or scope-narrowing"
      implementation: "Returns the full Owner directory (filtered ONLY by the soft-delete `listCondition` + the `query / ids / allowedForSync` request parameters); NO permission gate, NO scope-by-caller-identity narrowing"
      drift: DRIFT_NAME_VS_BEHAVIOR
      operator_visible_consequence: "Any authenticated user enumerates the entire Owner directory, including names that may carry PII. The OpenAPI declares 403 nowhere on this endpoint (`openapi.yaml:131-155` declares only 200 and 500), implicitly confirming the design intent — but the live doc pages are silent on the policy."
      confidence: STATIC-INFERRED
      evidence: "OwnerController.java:30-38 + SecurityConstants.java (no GET rule for /api/owners) + openapi.yaml:131-155"
    - name: "implements OwnerApi"
      promise: "Provides the full OwnerApi surface as declared in the OpenAPI spec"
      implementation: "Provides four `@Override` methods covering the four operationIds (createOwner, getOwnerList, deleteOwner, updateOwner); status-code drift on two of the four (createOwner + updateOwner declare 201 but return 200); response-body shape matches"
      drift: MINOR
      operator_visible_consequence: "OpenAPI-codegen clients see status-code mismatch; functional behavior matches; the spec page itself shows the wrong status code (until the spec is corrected)"
      confidence: STATIC-INFERRED
      evidence: "OwnerController.java:21-54 (the four @Override methods) + openapi.yaml:130-220 (the spec block) + ALIGNMENT on response body shape verified by reading the generated OwnerApi.java (per method sidecars)"

  orderings:
    - location: "OwnerController.java:30-38 (getOwnerList delegation)"
      questions:
        - q: "What is the actual ORDER BY at the lowest layer?"
          a: "The repository-tier method `ReactiveOwnerRepositoryImpl.list` is the source — out of this class's scope. Per the method-tier createOwner sidecar's cross-link and the OwnerServiceImpl sidecar's notes, the list ordering is the default jOOQ-paginate ordering (likely ID ASC) without an explicit ORDER BY on a domain-meaningful column. The class-level concern is that the controller exposes `query / ids / allowedForSync / page / size` parameters but no `sort` / `orderBy` parameter — the caller cannot influence the order."
          confidence: REFERENCE
          evidence: "odd-platform__java__service__service__OwnerServiceImpl + repository-tier list method (out of class-level scope)"
        - q: "What is the tie-breaker when sort-key values are equal?"
          a: "Out of class-level scope — see repository-tier sidecar"
          confidence: REFERENCE
          evidence: "odd-platform__java__service__service__OwnerServiceImpl"
        - q: "Which subset is returned when result-set > page size?"
          a: "Out of class-level scope — the controller forwards `page` and `size` unchanged to `ownerService.list` (`OwnerController.java:36`). The list method applies the paginate-wrapper at the repository tier."
          confidence: REFERENCE
          evidence: "OwnerController.java:36 + OwnerServiceImpl.java:50"
        - q: "Does any upstream layer re-sort or filter the result?"
          a: "The UI's `OwnersList` (batch-Q sidecar) does NOT re-sort; it consumes the response in the order returned. The mapper `OwnerMapper.mapToOwnerList` (per OwnerServiceImpl sidecar) preserves order."
          confidence: STATIC-INFERRED
          evidence: "OwnerController.java:30-38 + OwnerServiceImpl.java:44-52 + cross-link OwnersList batch-Q"

  auth_gates:
    - location: "OwnerController.java:21-27 (createOwner)"
      endpoint: "POST /api/owners"
      questions:
        - q: "What does this endpoint return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "LOGIN_FORM/OAUTH2/LDAP: 200 OK (createOwner returns 200 despite OpenAPI 201 declaration) if caller has OWNER_CREATE; 403 Forbidden otherwise. DISABLED: 200 OK to ANY caller (filter chain bypassed)."
          confidence: STATIC-INFERRED
          evidence: "SecurityConstants.java:143 + DisabledAuthSecurityConfiguration batch-C sidecar"
        - q: "What does an unauthenticated caller see?"
          a: "Under LOGIN_FORM/OAUTH2/LDAP: 401 Unauthorized (or 302 redirect to login under LOGIN_FORM, per batch-C sidecar). Under DISABLED: 200 OK (anonymous create)."
          confidence: STATIC-INFERRED
          evidence: "batch-C *SecurityConfiguration sidecars + SecurityConstants.java:143"
        - q: "What does a wrong-role caller see?"
          a: "403 Forbidden via AuthorizationCustomizer's permission check"
          confidence: STATIC-INFERRED
          evidence: "SecurityConstants.java:143 (NO_CONTEXT, OWNER_CREATE)"
        - q: "Where does the gate live — controller, service, repository, or nowhere?"
          a: "ONLY at the SecurityRule list (`SecurityConstants.java:143`) — NOT at the controller (no `@PreAuthorize` at OwnerController.java:21-27), NOT at the service (`OwnerServiceImpl.java:54-66` has no permission check), NOT at the repository (`ReactiveOwnerRepositoryImpl.create` is unchecked). The gate is centralized in one file."
          confidence: STATIC-INFERRED
          evidence: "OwnerController.java:21-27 + OwnerServiceImpl.java:54-66 + SecurityConstants.java:143"
    - location: "OwnerController.java:30-38 (getOwnerList)"
      endpoint: "GET /api/owners"
      questions:
        - q: "What does this endpoint return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "LOGIN_FORM/OAUTH2/LDAP: 200 OK with the full directory listing (only soft-delete-filtered) to ANY authenticated caller — there is no permission check. DISABLED: 200 OK to ANY caller including anonymous."
          confidence: STATIC-INFERRED
          evidence: "SecurityConstants.java (Grep `/api/owners` confirms NO GET rule) + OwnerController.java:30-38 (no `@PreAuthorize`)"
        - q: "What does an unauthenticated caller see?"
          a: "Under LOGIN_FORM/OAUTH2/LDAP: 401 / 302-redirect-to-login (the default authenticated-traffic gate, NOT a permission gate; per batch-C sidecars). Under DISABLED: 200 OK with full listing."
          confidence: STATIC-INFERRED
          evidence: "batch-C *SecurityConfiguration sidecars"
        - q: "What does a wrong-role caller see?"
          a: "200 OK — there is no role/permission requirement. A caller holding only DATA_ENTITY_VIEW reads the full Owner directory; a caller holding only QUERY_EXAMPLE_VIEW reads the full Owner directory. ANY authenticated session is sufficient."
          confidence: STATIC-INFERRED
          evidence: "SecurityConstants.java (Grep absence of GET rule) + OwnerController.java:30-38"
        - q: "Where does the gate live — controller, service, repository, or nowhere?"
          a: "NOWHERE — for the read direction. The controller has no `@PreAuthorize`, the service `OwnerServiceImpl.list` (`OwnerServiceImpl.java:44-52`) has no permission check, the repository `ReactiveOwnerRepositoryImpl.list` (per batch sidecars) only applies the soft-delete filter. This is the **explicit read-collaborative posture** (cross-link ADR-CANDIDATE-003), but it is not documented at the live doc pages."
          confidence: STATIC-INFERRED
          evidence: "OwnerController.java:30-38 + OwnerServiceImpl.java:44-52 + SecurityConstants.java (Grep absence)"
    - location: "OwnerController.java:40-45 (deleteOwner)"
      endpoint: "DELETE /api/owners/{owner_id}"
      questions:
        - q: "What does this endpoint return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "LOGIN_FORM/OAUTH2/LDAP: 204 No Content (cascade-block passes) OR 400 USR004 (cascade-block fails) OR 204 silent-no-op (already deleted, see corner cases) if caller has OWNER_DELETE; 403 Forbidden otherwise. DISABLED: 204/400 to ANY caller."
          confidence: STATIC-INFERRED
          evidence: "SecurityConstants.java:146-147 + deleteOwner method sidecar"
        - q: "What does an unauthenticated caller see?"
          a: "Under LOGIN_FORM/OAUTH2/LDAP: 401/302. Under DISABLED: 204/400 (anonymous delete)."
          confidence: STATIC-INFERRED
          evidence: "batch-C sidecars"
        - q: "What does a wrong-role caller see?"
          a: "403 Forbidden"
          confidence: STATIC-INFERRED
          evidence: "SecurityConstants.java:146-147"
        - q: "Where does the gate live — controller, service, repository, or nowhere?"
          a: "ONLY at SecurityConstants.java:146-147 — same centralized pattern as createOwner"
          confidence: STATIC-INFERRED
          evidence: "OwnerController.java:40-45 + OwnerServiceImpl.java:87-100 + SecurityConstants.java:146-147"
    - location: "OwnerController.java:47-54 (updateOwner)"
      endpoint: "PUT /api/owners/{owner_id}"
      questions:
        - q: "What does this endpoint return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "LOGIN_FORM/OAUTH2/LDAP: 200 OK (despite OpenAPI 201) if caller has OWNER_UPDATE; 404 if owner not found; 400 USR003 on name collision; 403 otherwise. DISABLED: same set without 403."
          confidence: STATIC-INFERRED
          evidence: "SecurityConstants.java:144-145 + updateOwner method sidecar"
        - q: "What does an unauthenticated caller see?"
          a: "Under LOGIN_FORM/OAUTH2/LDAP: 401/302. Under DISABLED: 200/404/400 (anonymous rename)."
          confidence: STATIC-INFERRED
          evidence: "batch-C sidecars"
        - q: "What does a wrong-role caller see?"
          a: "403 Forbidden"
          confidence: STATIC-INFERRED
          evidence: "SecurityConstants.java:144-145"
        - q: "Where does the gate live — controller, service, repository, or nowhere?"
          a: "ONLY at SecurityConstants.java:144-145 — same centralized pattern as siblings"
          confidence: STATIC-INFERRED
          evidence: "OwnerController.java:47-54 + OwnerServiceImpl.java:68-85 + SecurityConstants.java:144-145"

  resource_boundaries: []   # Class-level scope holds no resource boundaries; @ReactiveTransactional lives on OwnerServiceImpl, not on the controller. The controller is stateless. No cache, no lock, no concurrency primitive at this layer.

  request_inputs:
    - location: "OwnerController.java:22 (createOwner)"
      input_kind: body-field
      input_name: "ownerFormData (Mono<OwnerFormData>)"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "An OwnerFormData payload — name (required string) + roles (optional list of {id}). Implies the caller specifies the new Owner's directory shape and initial role bindings."
          confidence: STATIC-INFERRED
          evidence: "OwnerController.java:22 (parameter) + components.yaml (OwnerFormData schema)"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Forwarded to `ownerService.create(formData)` (line 25) → mapped to OwnerPojo + INSERTED into OWNER + role-link INSERTs into OWNER_TO_ROLE (per OwnerServiceImpl.java:55-66 + createOwner method sidecar)"
          confidence: STATIC-INFERRED
          evidence: "OwnerController.java:24-25 + OwnerServiceImpl.java:54-66"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — the form's `name` becomes `owner.name`; the form's `roles` produces `owner_to_role` rows. No naming asymmetry."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "OwnerController.java:22-27 + OwnerServiceImpl.java:54-66"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — no silent translation"
          confidence: STATIC-INFERRED
          evidence: "N/A"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "NONE — every field on OwnerFormData (name, roles) is consumed downstream"
          confidence: STATIC-INFERRED
          evidence: "OwnerServiceImpl.java:54-66 (consumes both name and roles)"
      routes_to_finding: "N/A — no finding routes"
    - location: "OwnerController.java:30-35 (getOwnerList)"
      input_kind: query-param
      input_name: "page / size / query / ids / allowedForSync"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "page+size: standard pagination. query: a substring/full-text filter on owner names. ids: a specific-id filter (return only owners whose id is in the list). allowedForSync: a boolean filter — the name implies 'owners eligible for synchronization' but is generic enough to leave the scope ambiguous."
          confidence: STATIC-INFERRED
          evidence: "OwnerController.java:30-35 (parameters) + openapi.yaml:131-155 (spec, no descriptions)"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Forwarded to `ownerService.list(page, size, query, ids, allowedForSync)` (OwnerController.java:36) → repository-tier `ReactiveOwnerRepositoryImpl.list` with paginate wrapper + name-LIKE filter + ID-IN filter + LEFT-JOIN-on-association-request filter (per repository sidecar). The `allowedForSync` flag becomes a predicate against the `owner_association_request` LEFT JOIN's presence/absence."
          confidence: STATIC-INFERRED
          evidence: "OwnerController.java:36 + OwnerServiceImpl.java:44-52 + repository sidecar reference"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "page/size/query/ids: MATCHES. allowedForSync: TRANSLATES_SILENTLY — the name implies 'eligible for sync' but the actual SQL predicate is 'has-or-has-not an owner_association_request row' (the LEFT JOIN on owner_association_request); whether 'eligible' equals 'has an APPROVED request' or 'has any request' or 'has no request' is not derivable from the parameter name. The OpenAPI spec has no description (only `type: boolean`); the live doc page is silent."
          drift: DRIFT_INPUT_NAME_VS_IMPLEMENTATION
          confidence: STATIC-INFERRED
          evidence: "OwnerController.java:34 + openapi.yaml:140-144 (no description) + repository-tier sidecar reference"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "An operator querying `allowedForSync=true` expecting 'owners eligible to be sync'd with a user account' may receive owners who have a PENDING/DECLINED owner_association_request (semantically 'has a request, not yet eligible'), or the inverse (filtered out as 'has a request, not eligible because still pending'). Without a description, the caller cannot tell. The UI's OwnerSelect autocomplete (per OwnersList batch-Q sidecar) is the only operator-visible documentation of which interpretation is in effect; an API consumer outside the UI has no path to learn the semantics."
          confidence: STATIC-INFERRED
          evidence: "OwnerController.java:34 + openapi.yaml:140-144 + OwnersList batch-Q sidecar"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "NONE direct — there is no `owner.allowed_for_sync` column. The semantic lives in the LEFT JOIN predicate on `owner_association_request`."
          confidence: STATIC-INFERRED
          evidence: "schema reading (V0_0_1__init.sql owner + V0_0_51__add_owner_association_request.sql) + repository-tier sidecar"
      routes_to_finding: "bugs_limitations_corner_cases[3] (allowedForSync semantics undocumented) + docs_link_semantic.doc_drift_findings[3] (operator-opaque parameter name)"
    - location: "OwnerController.java:41 (deleteOwner)"
      input_kind: path-param
      input_name: "ownerId (Long)"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "The id of the Owner to delete — a direct path key against the OWNER table primary key"
          confidence: STATIC-INFERRED
          evidence: "OwnerController.java:41 + openapi.yaml:204-219"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Forwarded to `ownerService.delete(ownerId)` (line 43) → three-leg cascade-block + role-binding hard-delete + owner soft-delete (per OwnerServiceImpl.java:87-100 + deleteOwner method sidecar)"
          confidence: STATIC-INFERRED
          evidence: "OwnerController.java:43 + OwnerServiceImpl.java:87-100"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — the id is used as the owner-row primary key against OWNER, OWNERSHIP, TERM_OWNERSHIP, USER_OWNER_MAPPING, and OWNER_TO_ROLE. No naming asymmetry."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "OwnerController.java:41-45 + OwnerServiceImpl.java:87-100"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — no silent translation"
          confidence: STATIC-INFERRED
          evidence: "N/A"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "NONE"
          confidence: STATIC-INFERRED
          evidence: "OwnerServiceImpl.java:87-100"
      routes_to_finding: "N/A"
    - location: "OwnerController.java:48-49 (updateOwner)"
      input_kind: path-param + body-field
      input_name: "ownerId (Long) + ownerFormData (Mono<OwnerFormData>)"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "ownerId: the Owner to update (primary key). ownerFormData: the new shape — new name + new roles. Implies a PUT-replace operation."
          confidence: STATIC-INFERRED
          evidence: "OwnerController.java:48-49 + openapi.yaml:177-203"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Forwarded to `ownerService.update(ownerId, form)` (line 52) → existence-check + UPDATE owner + destructive role-rebind + search-vector refresh + read-back (per updateOwner method sidecar). **The roles field, if omitted/empty, silently deletes ALL of the owner's role bindings — REFACTOR-425.**"
          confidence: STATIC-INFERRED
          evidence: "OwnerController.java:51-52 + OwnerServiceImpl.java:68-85 + updateOwner method sidecar"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "ownerId: MATCHES. ownerFormData.name: MATCHES (overwrites owner.name). ownerFormData.roles: TRANSLATES_SILENTLY in the omit-or-empty case — the operator submitting `{name: 'Alice'}` expecting 'rename only' instead triggers ALL-role-deletion. The PUT semantics are full-replace, not field-merge; the operator cannot infer this from the controller signature alone."
          drift: DRIFT_INPUT_NAME_VS_IMPLEMENTATION
          confidence: STATIC-INFERRED
          evidence: "OwnerController.java:47-54 + OwnerServiceImpl.java:68-85, 117-122 + updateOwner method sidecar bugs_limitations_corner_cases[3] (REFACTOR-425)"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "An API consumer (script, integration) submitting `PUT /api/owners/{id}` with `{name: 'NewName'}` expecting 'rename only' receives a 200 OK with the renamed Owner — but the response also reflects an empty role list, because all role bindings were silently deleted. The mistake is observable only via the response body's `roles: []` field; combined with the no-`@ActivityLog` finding, the destructive change leaves NO trail."
          confidence: STATIC-INFERRED
          evidence: "OwnerServiceImpl.java:71, 76-81, 117-122 (the empty-roles collapse to List.of() and the destructive deleteOwnerRelationsExcept) + updateOwner method sidecar"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "NONE — every field is used; the issue is the destructive default, not an unused column"
          confidence: STATIC-INFERRED
          evidence: "OwnerServiceImpl.java:74 (applyToPojo consumes name) + line 76-81 (consumes roles)"
      routes_to_finding: "Cross-link to updateOwner method sidecar bugs_limitations_corner_cases[3] (REFACTOR-425); class-level surface re-affirms via stress finding"

  probes_emitted:
    - probe_id: P-141
      question: "Does `OwnerService.getOrCreate` (called from OwnershipServiceImpl / OwnerAssociationRequestServiceImpl / TermOwnershipServiceImpl) bypass the OWNER_CREATE permission gate? Concrete test: a caller with ONLY DATA_ENTITY_OWNERSHIP_CREATE (no OWNER_CREATE) POSTs an Ownership form with a never-seen ownerName; does the new Owner row appear in GET /api/owners?"
      probe_path: "lineage/odd-platform/probes/P-141.yaml"
    - probe_id: P-142
      question: "Is GET /api/owners reachable by an authenticated caller holding ONLY a benign read permission (no OWNER_*), and reachable by an anonymous caller under auth.type=DISABLED?"
      probe_path: "lineage/odd-platform/probes/P-142.yaml"

  stress_summary:
    triggers_total: 14
    questions_total: 31
    answers_static_inferred: 23
    answers_probe_needed: 2
    answers_reference: 6
    drift_flags: 3
```

## security

- **auth_mode_relevance**: `LOGIN_FORM | OAUTH2 | LDAP` (the three modes that protect the controller's three mutating methods; per batch-C `*SecurityConfiguration` sidecars). Under `DISABLED` ALL four methods are anonymously reachable. `S2S` is not relevant (S2S protects `/ingestion/entities` POST only, not `/api/owners*`). The class carries no `@ConditionalOnProperty`; auth wiring is enforced globally by the `*SecurityConfiguration` beans. The fourth method (`getOwnerList`) is reachable by ANY authenticated caller under the three protected modes (no permission gate); anonymous under DISABLED.
- **ingestion_filter_relevance**: `NO — UI/API surface, not /ingestion/entities`. The `IngestionDataEntitiesFilter` (per batch-A class-level sidecar) matches `/ingestion/entities` POST only; none of this controller's four endpoints match.
- **authorization_assertions**:
  - "`SecurityRule(NO_CONTEXT, '/api/owners' POST, OWNER_CREATE)` — `SecurityConstants.java:143`"
  - "`SecurityRule(NO_CONTEXT, '/api/owners/{owner_id}' PUT, OWNER_UPDATE)` — `SecurityConstants.java:144-145`"
  - "`SecurityRule(NO_CONTEXT, '/api/owners/{owner_id}' DELETE, OWNER_DELETE)` — `SecurityConstants.java:146-147`"
  - "**`GET /api/owners` has NO SecurityRule entry** — verified by Grep `/api/owners` against SecurityConstants.java 2026-05-25 (only POST/PUT/DELETE entries match). Any authenticated user reads the directory."
- **owner_scoping**: `BYPASSES at every method — the four methods do NOT narrow by caller's principal identity`. A caller with `OWNER_CREATE` can create any Owner (including one with a name that collides with someone else's expected display name); a caller with `OWNER_UPDATE` can rename ANY Owner (the SecurityRule is `NO_CONTEXT`, not per-Owner); a caller with `OWNER_DELETE` can soft-delete ANY Owner; a caller with any session reads the full directory. This is consistent with the centralized permission model (the permissions are MANAGEMENT-level, not per-entity) and with the read-collaborative posture, but it means **no per-Owner scoping at the controller layer**. Cross-link: REFACTOR-024 family (read-collaborative posture across the platform).
- **data_exposure**:
  - "Full Owner directory (id, name, roles, associated_user, has-association-request flag) → ANY authenticated caller under LOGIN_FORM/OAUTH2/LDAP via `GET /api/owners`; ANY caller under DISABLED" — evidence: `OwnerController.java:30-38` + `OwnerServiceImpl.java:44-52` + `SecurityConstants.java` (no GET rule)
  - "Single Owner payload (id, name, roles, associated_user) → caller with OWNER_CREATE/UPDATE on POST/PUT; caller with OWNER_DELETE on DELETE returns 204 (no body)" — evidence: `OwnerController.java:21-54` + `OwnerServiceImpl.java:54-100`
  - "**Side-channel Owner directory write reach** — A caller with `DATA_ENTITY_OWNERSHIP_CREATE` (or just-authenticated under DISABLED + the `/api/owner_association_request` POST which has no SecurityRule either — verified) can create Owner directory rows by supplying a never-seen `ownerName` to the Ownership / association-request flows. The new row immediately appears in `GET /api/owners`." — evidence: `OwnerServiceImpl.java:38-42` (getOrCreate) + three callsites at `OwnerAssociationRequestServiceImpl.java:57` + `OwnershipServiceImpl.java:52` + `TermOwnershipServiceImpl.java:35` + `SecurityConstants.java:143-147` (the OWNER_CREATE gate at the controller path only)
- **known_security_gaps**:
  - "GET /api/owners has NO permission gate — any authenticated caller enumerates the full Owner directory. Combined with the silence of the live `/owners` and `/permissions` doc pages on this posture, the operator-visible expectation (a 'permission-gated' directory) does not match the actual posture (an 'authentication-gated' directory). For deployments where Owner names carry PII or signal organizational structure, this is information-disclosure." — evidence: `SecurityConstants.java` (Grep absence of GET rule) + `OwnerController.java:30-38` + WebFetch live owners doc 2026-05-25 (silent) + WebFetch live permissions doc 2026-05-25 (no OWNER_READ permission) — severity: MEDIUM
  - "`OwnerService.getOrCreate` bypasses the `OWNER_CREATE` SecurityRule via three service-tier callsites — directly contradicts the documented permission model (the live `/permissions` page names `OWNER_CREATE: 'Allows creating a new owner entity.'` as if it were the SOLE gate; the implementation has three additional gateways under different permissions). A caller with `DATA_ENTITY_OWNERSHIP_CREATE` only can create arbitrary Owner directory rows; combined with the no-`@ActivityLog` finding (REFACTOR-426), the creation is also audit-silent. Severity HIGH because (a) the gateway is undocumented; (b) the creation is audit-silent; (c) the caller's permission set does NOT include OWNER_CREATE — they are exceeding the documented bound." — evidence: `OwnerServiceImpl.java:38-42` + three callsites cross-cited + `SecurityConstants.java:143-147` + WebFetch live permissions doc 2026-05-25 — severity: HIGH
  - "Class-wide forensic silence — no class-level `@Slf4j`, no method-level logging, no `@ActivityLog` on any service-tier delegate (per OwnerServiceImpl batch-S sidecar). The four operator-facing verbs leave no trace beyond the default Spring access log. Combined with the side-channel finding above, an attacker creating arbitrary Owner rows via `DATA_ENTITY_OWNERSHIP_CREATE` leaves no audit signal. **The 6-sidecar audit-silence pattern (cross-link F-006 batch N + F-019 batch S coherence note) is the operator-facing trigger of this class-level concern.**" — evidence: `OwnerController.java:1-55` (no logger) + `OwnerServiceImpl.java:1-123` (no logger; no `@ActivityLog`) + F-006 batch N pattern — severity: MEDIUM
  - "Under `auth.type=DISABLED`, all four methods are anonymously reachable — the three SecurityRule entries remain in the list but the WebFlux filter chain doesn't run (`DisabledAuthSecurityConfiguration.java` per batch-C sidecar + REFACTOR-185 enumeration). Combined with the absence of `@ActivityLog` on all three mutating service methods, anonymous full-CRUD on the Owner directory is silently reachable. Cross-link: REFACTOR-185 (the 18+-sidecar DISABLED-mode-bypass enumeration; this class contributes 3 surfaces — create+update+delete — to the count)." — evidence: `DisabledAuthSecurityConfiguration.java` batch-C sidecar + `SecurityConstants.java:143-147` + REFACTOR-185 — severity: LOW (DISABLED is dev-only per docs; the no-fail-fast behavior is the broader class-of-concern, not unique to this controller)
  - "Per-Owner authorization scoping is absent — `OWNER_UPDATE` and `OWNER_DELETE` are global permissions (`NO_CONTEXT`); a caller with the permission can mutate ANY Owner, not just one they are USER_OWNER_MAPPING-bound to. Whether this is intentional (admin-only permission model) or a missed scoping is a maintainer call. The live permissions doc names the permissions as 'Allows editing/deleting AN owner' (singular), silent on which owners. Cross-link: REFACTOR-024 family." — evidence: `SecurityConstants.java:143-147` (NO_CONTEXT) + WebFetch live permissions doc 2026-05-25 — severity: MEDIUM

## performance

- **hot_paths**: [] — N/A. The four Owner-directory verbs are admin-time operations (per the live `/owners` doc, "managed in the Management → Owners tab"), not per-render / per-event calls. `getOwnerList` IS invoked at UI mount for the Management → Owners route (per OwnersList batch-Q sidecar) but only once per route entry, not on every UI interaction. No Prometheus metric tracks the rate.
- **throughput_characteristics**:
  - "Four reactive methods — `Mono<ResponseEntity<...>>`; non-blocking I/O; no thread held during DB awaits" — evidence: `OwnerController.java:22-54` (all four signatures)
  - "No bulk variant on any of the four methods — each accepts one path/body unit per request. Bulk delete or bulk create requires the caller to fire N HTTP requests." — evidence: `OwnerController.java:22-54` (single-element signatures)
  - "Per-request round-trip counts (from method-tier sidecars): createOwner = 3 (INSERT + role-links + read-back); updateOwner = 6 (existence-check + UPDATE + DELETE role-links + INSERT role-links + 2 search-vector UPDATEs + read-back); deleteOwner = 5 (3 cascade-block + DELETE role-links + UPDATE soft-delete); getOwnerList = depends on paginate wrapper, ~2 (COUNT + SELECT) per repository sidecar." — evidence: method-tier sidecars
- **resource_allocation**:
  - "Single field-injected dependency — `OwnerService` (line 19). No allocation at class level. Per-request allocations are bounded by request body size + paginate buffer at the service tier (per method sidecars)." — evidence: `OwnerController.java:16-19`
  - "WebFlux deserializes the request body via Jackson with default codec config — no explicit override at this class. A maliciously-large `OwnerFormData` (e.g. a `roles` list with 10K elements) would be limited by `spring.codec.max-in-memory-size` (default 256KB, raised to 20MB platform-wide per batch-A AppConfig sidecar)." — evidence: `OwnerController.java:22, 49` + cross-link batch-A AppConfig
- **scaling_characteristics**:
  - "Stateless class — `@RestController` + `@RequiredArgsConstructor` + one final field. Horizontal scaling unconstrained at this layer." — evidence: `OwnerController.java:15-19` (no mutable state)
  - "Transaction boundaries live downstream — connection-pool contention scales with the service-tier transaction durations (per OwnerServiceImpl batch-S sidecar). The controller is a thin pass-through; scaling concerns are inherited from downstream."
  - "Class is a Spring bean — singleton scope under default `@RestController` semantics. No per-request instance allocation."
- **known_performance_gaps**:
  - "No method-level observability across the four methods — no `@Timed`, no Micrometer counter, no request-id correlation log line. Admin-time operations that degrade (slow DB, lock contention, OwnerServiceImpl race-window) surface only via WebFlux pool metrics, not at this layer. Same pattern as the method-tier sidecars; the class-level scope adds the observation that this is a CLASS-WIDE concern, not method-specific." — evidence: `OwnerController.java:21-54` (no observability annotations) — severity: LOW
  - "`getOwnerList` has no caching at any tier — every call hits the database, even when the directory has not changed. For an admin-tab opened repeatedly during a session this is acceptable; for a heavily-used owner-autocomplete (e.g. ownership-create form), the cache could halve the per-character keystroke cost. The UI's `OwnerSelect` (per OwnersList batch-Q sidecar) does its own client-side debouncing but does not cache by `query` value." — evidence: `OwnerController.java:30-38` + `OwnerServiceImpl.java:44-52` (no `@Cacheable`) + batch-Q OwnerSelect — severity: LOW

## upstream_callers

- entry_point: "ui_route:/management/owners (OwnersList component mount)"
  caller_node: "ts react-component:OwnersList.tsx (batch-Q sidecar)"
  multiplicity_per_trigger: 1
  evidence: "owners.thunks.ts:34-44 (fetchOwnersList dispatches ownerApi.getOwnerList); OwnersList batch-Q sidecar upstream_callers"
  observation_class: ui-call
- entry_point: "ui_route:/management/owners (Create button click)"
  caller_node: "ts react-component:OwnerForm.tsx (within OwnersList page)"
  multiplicity_per_trigger: 1
  evidence: "owners.thunks.ts:46-55 (createOwner dispatches ownerApi.createOwner); OwnersList batch-Q sidecar"
  observation_class: ui-call
- entry_point: "ui_route:/management/owners (Edit button click)"
  caller_node: "ts react-component:OwnerForm.tsx (edit mode within EditableOwnerItem)"
  multiplicity_per_trigger: 1
  evidence: "owners.thunks.ts:57-72 (updateOwner dispatches ownerApi.updateOwner); OwnersList batch-Q sidecar"
  observation_class: ui-call
- entry_point: "ui_route:/management/owners (Delete button click)"
  caller_node: "ts react-component:ConfirmationDialog within EditableOwnerItem"
  multiplicity_per_trigger: 1
  evidence: "owners.thunks.ts:74-86 (deleteOwner dispatches ownerApi.deleteOwner); OwnersList batch-Q sidecar"
  observation_class: ui-call
- entry_point: "rest:GET /api/owners (direct API call)"
  caller_node: "external-api-consumer (unresolved — third-party script / curl / Postman)"
  multiplicity_per_trigger: 1
  unresolved: true
  evidence: "OwnerController.java:30-38 (the GET endpoint is reachable by any authenticated caller; SecurityConstants has no rule; OpenAPI declares 200 and 500 only — no client-class restriction)"
  observation_class: rest-call
- entry_point: "ui_route:* (ownership create / association-request submit — indirect via OwnerSelect autocomplete)"
  caller_node: "ts react-component:OwnerSelect.tsx (per OwnersList batch-Q sidecar)"
  multiplicity_per_trigger: "depends on debounced keystroke count"
  unresolved: false
  evidence: "OwnerSelect's autocomplete fires getOwnerList on user typing (per OwnersList batch-Q sidecar's UI analysis); each keystroke (debounced) is one call. This is the OwnerSelect surface, not the OwnersList route mount."
  observation_class: ui-call

## downstream_side_effects

- side_effect_class: db-write
  description: "INSERT into OWNER (createOwner) + INSERT into OWNER_TO_ROLE (createOwner role list)"
  evidence: "OwnerController.java:21-27 (delegation) + OwnerServiceImpl.java:54-66 + method-tier createOwner sidecar"
  cardinality_per_call: "1 OWNER + N OWNER_TO_ROLE rows where N = roles.size()"
  reachable_from_entry_points:
    - "ui_route:/management/owners (Create button)"
    - "rest:POST /api/owners (direct API call)"
- side_effect_class: db-write
  description: "UPDATE owner.name + UPDATE owner.updated_at + DELETE+INSERT in OWNER_TO_ROLE + 2× UPDATE search_entrypoint/term_search_entrypoint (updateOwner)"
  evidence: "OwnerController.java:47-54 + OwnerServiceImpl.java:68-85 + method-tier updateOwner sidecar"
  cardinality_per_call: "1 OWNER UPDATE + variable OWNER_TO_ROLE delta + 2 search-vector UPDATEs that scale with search_entrypoint rows referencing the owner"
  reachable_from_entry_points:
    - "ui_route:/management/owners (Edit button)"
    - "rest:PUT /api/owners/{owner_id} (direct API call)"
- side_effect_class: db-write
  description: "UPDATE owner.deleted_at (soft-delete) + DELETE all OWNER_TO_ROLE rows for the owner (hard-delete) — deleteOwner"
  evidence: "OwnerController.java:40-45 + OwnerServiceImpl.java:87-100 + method-tier deleteOwner sidecar"
  cardinality_per_call: "1 OWNER UPDATE + N OWNER_TO_ROLE DELETEs where N = current role bindings"
  reachable_from_entry_points:
    - "ui_route:/management/owners (Delete button)"
    - "rest:DELETE /api/owners/{owner_id} (direct API call)"
- side_effect_class: page-render
  description: "Returns OwnerList (paginated) payload to caller (getOwnerList)"
  evidence: "OwnerController.java:29-38 + OwnerServiceImpl.java:44-52"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "ui_route:/management/owners (component mount)"
    - "ui_route:* (OwnerSelect autocomplete keystrokes)"
    - "rest:GET /api/owners (direct API call — UNGATED, any authenticated user)"
- side_effect_class: page-render
  description: "Returns single Owner DTO payload (createOwner + updateOwner success)"
  evidence: "OwnerController.java:22-27, 47-54"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "ui_route:/management/owners (Create/Edit success)"
    - "rest:POST/PUT /api/owners[/{owner_id}] (direct API)"
- side_effect_class: external-call
  description: "NONE — the controller makes no outbound HTTP / queue / external call. All side effects route via OwnerService → reactive repositories → Postgres."
  evidence: "OwnerController.java:21-54 (no WebClient, no Kafka, no HTTP client)"
  cardinality_per_call: 0
  reachable_from_entry_points: []
- side_effect_class: activity-emit
  description: "NONE — no `@ActivityLog` on any of the three mutating service methods (verified at OwnerServiceImpl batch-S sidecar). The four operator verbs emit NO activity-feed events. **This is the operator-facing trigger of the 6-sidecar audit-silence pattern.**"
  evidence: "OwnerServiceImpl.java:1-123 (no `@ActivityLog`) + grep across <odd-platform-api>/service/*.java 2026-05-25 (10 service files with `@ActivityLog`; OwnerServiceImpl is NOT one of them)"
  cardinality_per_call: 0
  reachable_from_entry_points: []
- side_effect_class: log-emit
  description: "NONE at the application layer — class has no logger; only the default Spring WebFlux access log emits (request line + status + elapsed)"
  evidence: "OwnerController.java:1-55 (no Logger field, no log calls)"
  cardinality_per_call: 0
  reachable_from_entry_points: []

## sources

- understanding ← `OwnerController.java:1-55` (entire class body) + `OwnerServiceImpl.java:38-122` (service-tier) + `SecurityConstants.java:143-147` (auth gates) + `openapi.yaml:130-220` (OpenAPI spec block) + method-tier sidecars (batches E + P)
- concepts.entities ← `OwnerController.java:5-9, 17, 22, 30-32, 48-49` (imports + return types) + `OwnerService.java:10-26` (interface) + `SecurityConstants.java:143-147` (SecurityRule)
- concepts.operations ← `OwnerController.java:21-54` (four `@Override` method bodies)
- concepts.invariants[0] (single-field injection) ← `OwnerController.java:15-19`
- concepts.invariants[1] (auth asymmetry) ← `SecurityConstants.java:143-147` (three rules; absence of GET rule verified by Grep `/api/owners` 2026-05-25)
- concepts.invariants[2] (status-code drift class-wide) ← `openapi.yaml:165-171, 195-201, 215-217, 145-151` + `OwnerController.java:26, 53, 44, 37`
- concepts.invariants[3] (thin-proxy convention) ← `OwnerController.java:21-54` (no `@PreAuthorize`, no `@Transactional`, no logger) + cross-link batch-C/A/G sibling-controller sidecars
- concepts.audiences ← WebFetch live owners doc 2026-05-25 + WebFetch live permissions doc 2026-05-25 + `owners.thunks.ts:34-86` + OwnersList batch-Q sidecar
- dependencies_semantic.requires-feature ← WebFetch live owners doc 2026-05-25 status 200 + WebFetch live permissions doc 2026-05-25 status 200 + `SecurityConstants.java:143-147` + `OwnerService.java:10-26` + OwnerServiceImpl batch-S sidecar (no `@ActivityLog`)
- dependencies_semantic.coupling[0] (OwnerApi) ← `OwnerController.java:5, 17, 21, 29, 40, 47` (imports + four `@Override` markers)
- dependencies_semantic.coupling[1] (OwnerService) ← `OwnerController.java:9, 19, 25, 36, 43, 52` (import + field + four call-sites)
- dependencies_semantic.coupling[2-3] (SecurityRule entries) ← `SecurityConstants.java:143-147`
- dependencies_semantic.coupling[4] (OwnersList UI) ← `owners.thunks.ts:34-86` + OwnersList batch-Q sidecar
- dependencies_semantic.coupling[5-7] (three side-channel callsites) ← `OwnerAssociationRequestServiceImpl.java:57` + `OwnershipServiceImpl.java:52` + `TermOwnershipServiceImpl.java:35`
- tests_coverage_semantic.uncovered_behaviours ← `find <odd-platform-repo> -path '*test*' -name 'OwnerController*'` 2026-05-25 (zero matches) + grep across test/java/ 2026-05-25 (zero matches)
- tests_coverage_semantic.test_files ← N/A (absence)
- docs_link_semantic.inferred_docs[0] ← WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/owners` 2026-05-25 status 200
- docs_link_semantic.inferred_docs[1] ← WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions` 2026-05-25 status 200
- docs_link_semantic.doc_drift_findings[0] (class-wide 201-vs-200) ← `openapi.yaml:165-171, 195-201` + `OwnerController.java:26, 53`
- docs_link_semantic.doc_drift_findings[1] (inconsistent 403 declaration) ← `openapi.yaml:172-174, 195-201, 215-217`
- docs_link_semantic.doc_drift_findings[2] (ungated-read silence) ← WebFetch live owners + permissions doc 2026-05-25 + `openapi.yaml:131-155` (no 401/403) + `SecurityConstants.java` (no GET rule)
- docs_link_semantic.doc_drift_findings[3] (getOrCreate side-channel silence) ← WebFetch live owners doc 2026-05-25 + `OwnerServiceImpl.java:38-42` + three callsites cross-cited
- implicit_adrs[0] (thin-proxy convention) ← `OwnerController.java:15-19, 21-54` + sibling-controller sidecars
- implicit_adrs[1] (centralised SECURITY_RULES) ← `SecurityConstants.java:143-147` + `OwnerController.java` (no annotations) + system-mission P-09 maintainer notes
- implicit_adrs[2] (OpenAPI-generated interface as routing source) ← `OwnerController.java:5, 17, 21, 29, 40, 47` + `openapi.yaml:130-220`
- bugs_limitations_corner_cases[0] (GET unauthenticated-read) ← `SecurityConstants.java` (Grep absence) + `OwnerController.java:30-38` + WebFetch silence on doc pages
- bugs_limitations_corner_cases[1] (getOrCreate bypass) ← `OwnerServiceImpl.java:38-42` + `OwnerAssociationRequestServiceImpl.java:57` + `OwnershipServiceImpl.java:52` + `TermOwnershipServiceImpl.java:35` + `SecurityConstants.java:143-147`
- bugs_limitations_corner_cases[2] (status-code drift class-wide) ← `openapi.yaml:165-171, 195-201` + `OwnerController.java:26, 53` + method-tier sidecars
- bugs_limitations_corner_cases[3] (allowedForSync opaque) ← `OwnerController.java:34` + `openapi.yaml:140-144` + WebFetch live owners doc 2026-05-25
- bugs_limitations_corner_cases[4] (no class-level observability) ← `OwnerController.java:1-55` + `OwnerServiceImpl.java:1-123`
- security.* ← `OwnerController.java:1-55` + `OwnerServiceImpl.java:1-123` + `SecurityConstants.java:143-147` + DisabledAuthSecurityConfiguration batch-C sidecar + WebFetch live owners + permissions doc 2026-05-25 + REFACTOR-185 enumeration + REFACTOR-024 family + F-006 batch N audit-silence pattern
- performance.* ← `OwnerController.java:15-54` + `OwnerServiceImpl.java` (per batch-S sidecar) + batch-A AppConfig (codec budget) + OwnersList batch-Q sidecar
- upstream_callers ← `owners.thunks.ts:34-86` + OwnersList batch-Q sidecar (UI mounts) + `SecurityConstants.java:143-147` (the three gated REST paths) + `OwnerController.java:30-38` (the ungated GET)
- downstream_side_effects ← OwnerServiceImpl batch-S sidecar + method-tier sidecars (batches E + P) + `OwnerServiceImpl.java:1-123` (no `@ActivityLog`)

## confidence_per_field

- understanding: HIGH (every claim verified against the 55-line class, the four method bodies, the OwnerService interface, the SecurityConstants list, the OpenAPI spec block, and three cross-batch sidecars)
- concepts: HIGH (entities, operations, invariants all anchored at file:line; the class-wide auth-asymmetry invariant verified by Grep absence)
- dependencies_semantic: HIGH (every coupling cited at file:line; the three side-channel callsites verified by Grep `ownerService.getOrCreate`)
- tests_coverage_semantic: HIGH (absence verified by find + grep 2026-05-25; the one repository-tier test enumerated by reading via batch-P deleteOwner sidecar)
- docs_link_semantic: HIGH (both URLs WebFetched 2026-05-25 status 200; the binding endpoint→doc is enricher judgment; the absences are positive WebFetch results, not pretraining inference; the OpenAPI declarations are file-cited)
- implicit_adrs: HIGH (the thin-proxy convention, the centralized-SECURITY_RULES pattern, and the OpenAPI-generated-interface-as-routing-source are all directly visible at cited lines; the convention is cross-confirmed against batches A/C/E/G/P/Q sibling-controller sidecars)
- bugs_limitations_corner_cases: HIGH (every concern cited file:line; the GET-ungated finding verified by Grep absence; the getOrCreate-bypass finding verified by three callsite Greps; the status-code drift cross-confirmed against method-tier sidecars)
- security: HIGH (every claim is structural and traces to OwnerController + OwnerServiceImpl + SecurityConstants + WebFetched live docs + cross-batch sidecars; the DISABLED-mode-bypass class is cross-linked to REFACTOR-185)
- performance: HIGH (the round-trip counts inherited from method-tier sidecars; the absence of observability and caching anchored in cited code; the four reactive signatures verified at file:line)
- stress_findings: HIGH (14 triggers across name-behavior + orderings + auth + request-inputs categories; 31 questions; 23 STATIC-INFERRED, 2 PROBE-NEEDED (P-141 + P-142), 6 REFERENCE — reference answers route to method-tier sidecars and the repository-tier sidecar for downstream specifics. Three DRIFT flags surfaced: the class name-behavior drift (4-method mixed gating), the getOwnerList name drift (no narrowing despite "list" promise), and the updateOwner roles input drift (REFACTOR-425 destructive-default surfaced again at the class level))
- upstream_callers: HIGH (four UI entry points cited at owners.thunks.ts; the direct-REST entry point recorded as unresolved third-party caller — appropriate for an externally-reachable endpoint)
- downstream_side_effects: HIGH (every side-effect class cited at file:line; the activity-emit / external-call / log-emit absences are positive findings, not omissions)

## Maintainer notes
