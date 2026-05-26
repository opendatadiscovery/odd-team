---
node_id: "odd-platform java IdentityController controller-class:IdentityController"
node_kind: controller-class
axis: controllers
extracted_at_commit: 4ec2b20
enriched_at_commit: 4ec2b20
extractor_version: 0.1.0
prompt_version: file-analyser/0.4.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-25-ZD-IdentityController
schema_version: v0.3.0
pillar: P-09
back_links:
  feature_ids: []  # no F-NNN yet enumerates /api/identity/whoami; sidecar surfaces the feature
  pillar_anchored_ids: ["P-09:F-001 UI authentication", "P-09:F-002 Principal-to-Owner Resolution"]
  refactor_ids: [REFACTOR-185]
  retrospective_ids: []
  adr_candidate_ids: []
  sibling_sidecars:
    - "odd-platform__java__service__service__AuthIdentityProviderImpl.md (the principal resolver this controller's service chain calls)"
    - "odd-platform__java__DisabledAuthSecurityConfiguration__config-key-consumer__auth_type@L10.md (DISABLED-mode wiring — the empty SecurityContext that triggers the dummyOwner fallback)"
    - "odd-platform__java__LoginFormSecurityConfiguration__config-class__LoginFormSecurityConfiguration.md (LOGIN_FORM-mode wiring — alternate auth path; defence-in-depth comparison)"
    - "odd-platform__java__OAuthSecurityConfiguration__config-key-consumer__auth_type@L71.md (OAUTH2-mode wiring)"
    - "odd-platform__java__LDAPSecurityConfiguration__config-key-consumer__auth_type@L51.md (LDAP-mode wiring)"
---

# IdentityController (controller-class) — semantic understanding

## understanding

`IdentityController` is a **34-line single-endpoint controller** exposing `GET /api/identity/whoami` — the user-identity exposure surface every UI client hits on application mount (`App.tsx:48` dispatches `fetchIdentity()` once-on-mount with empty dep-array; the SPA's permission gating, toolbar username display, and OwnerAssociation flow all consume this response). The controller delegates principal resolution to `IdentityServiceImpl.whoami()` which chains `authIdentityProvider.getCurrentUser().flatMap(getAssociatedOwner)` (IdentityServiceImpl.java:30-52). When the inner `Mono` emits empty — which happens **whenever the SecurityContext is empty**, the defining DISABLED-mode condition (`DisabledAuthSecurityConfiguration.java:11-19` wires NO `ServerSecurityContextRepository`) — the controller fires `.switchIfEmpty(Mono.just(new ResponseEntity<>(dummyOwner(), HttpStatus.OK)))` (line 27), producing an `AssociatedOwner` with `identity.username = "admin"` and `identity.permissions = Arrays.asList(Permission.values())` — i.e. every single one of the 70+ Permission enum values defined at `components.yaml:158-235` (line 32). This is the **IDENTITY-LAYER FACET of REFACTOR-185**: under default deployment (`auth.type=DISABLED` per `application.yml:32-34`), any anonymous network caller hitting `/api/identity/whoami` receives a 200 OK body claiming they are the "admin" user with every permission — and the UI's `WithPermissionsProvider` (`PermissionProvider.tsx:17-32`) then unlocks every Permission-gated UI control (LookupTables, the management-page surfaces, every WithPermissionsProvider-wrapped button) on the strength of that admin-grant claim. There is no `@PreAuthorize` annotation on the controller (`IdentityController.java:17-34`), no programmatic gate in the service (`IdentityServiceImpl.java:29-52`), no cache-control header on the response (`IdentityController.java:25-28` uses bare `ResponseEntity::ok`), and no admonition in the live docs warning operators that this is the under-DISABLED behaviour (verified via WebFetch of three docs pages, status 200, all silent — see `docs_link_semantic.doc_drift_findings`).

## concepts

- entities:
  - `IdentityController` (the @RestController; lines 17-34)
  - `IdentityApi` (the OpenAPI-generated interface from `openapi.yaml:115-128` — operationId `whoami`, GET `/api/identity/whoami`, returns `AssociatedOwner`)
  - `AssociatedOwner` (DTO carrying `identity: Identity`, `owner: Owner | null`, `associationRequest: OwnerAssociationRequest | null` — the response envelope)
  - `Identity` (DTO with `username: string` + `permissions: Permission[]` — the principal-as-presented-to-UI)
  - `Permission` (enum at components.yaml:158-235 — 70+ values: POLICY_CREATE / ROLE_CREATE / OWNER_CREATE / DATA_ENTITY_STATUS_UPDATE / DATA_SOURCE_TOKEN_REGENERATE / COLLECTOR_TOKEN_REGENERATE / ... — every action-gated capability the platform defines)
  - `IdentityService` (the SPI; one method `Mono<AssociatedOwner> whoami()`; IdentityService.java:6-8)
  - `IdentityServiceImpl` (the concrete service; IdentityServiceImpl.java:22-53)
  - `AuthIdentityProvider` / `AuthIdentityProviderImpl` (the principal-resolver this service calls)
  - `ServerWebExchange` (Spring WebFlux per-exchange handle; received as a parameter (line 24) but UNUSED in the controller body)
- operations:
  - delegate-to-identity-service: `identityService.whoami()` (line 25)
  - wrap-mono-in-ResponseEntity.ok: `.map(ResponseEntity::ok)` (line 26)
  - inject-dummy-fallback-on-empty: `.switchIfEmpty(Mono.just(new ResponseEntity<>(dummyOwner(), HttpStatus.OK)))` (line 27)
  - construct-dummy-admin-with-all-permissions: `new AssociatedOwner().identity(new Identity().username("admin").permissions(Arrays.asList(Permission.values())))` (lines 30-33)
- invariants:
  - "controller is stateless reactive — single private final IdentityService dependency, no per-request state, no in-memory cache (line 21)"
  - "the `ServerWebExchange exchange` parameter is RECEIVED but never read in the controller body (line 24); it is forwarded by OpenAPI-generated IdentityApi signatures but the controller does not introspect headers, cookies, or any per-exchange attribute — including no audit logging"
  - "the dummy fallback is the LITERAL string `\"admin\"` (line 32) — case-sensitive; this collides with operator-named users 'admin' (lowercase) but is distinct from the S2sAuthenticationFilter hardcoded `\"ADMIN\"` (uppercase) per the AuthIdentityProviderImpl sidecar's S2S-collision finding"
  - "the dummy fallback's permission list is `Arrays.asList(Permission.values())` — the FULL set, dynamically expanded as the Permission enum grows; every new Permission added to components.yaml AUTOMATICALLY enters the DISABLED-mode admin-grant blast radius without any explicit code change in this file"
  - "the dummy fallback's `owner` field is null (the no-arg constructor) — under DISABLED, the response says 'you are admin with every permission but you have no Owner', which causes the UI's OwnerAssociation flow (`OwnerAssociation.tsx:33-38`) to render the OwnerAssociationForm (because `isIDOnly = !ownership && identity && isIdentityFetched`)"
  - "no @PreAuthorize, no programmatic authorization check, no rate-limit, no audit logging, no Cache-Control header on the response"
- audiences:
  - "the SPA's `App.tsx:46-51` useEffect — single call per app-mount, no retry, no polling; the response populates `profile.slice.ts:24-26` and feeds every downstream selector"
  - "`AppToolbar.tsx:74` — renders `owner?.name ?? identity?.username` in the user-menu — under DISABLED this shows 'admin' in the top-right corner of every page"
  - "`PermissionProvider.tsx:17-32` — every `WithPermissionsProvider` wrapper consults `getGlobalPermissions` (selectors/profile.selectors.ts:17-20) which under DISABLED returns the ALL-PERMISSIONS list; `isAllowedTo` collapses to TRUE for every Permission check"
  - "`OwnerAssociationForm.tsx:26` — uses `usePermissions().isAllowedTo` to render 'Associate' vs 'Send a request' button — under DISABLED, the form renders the immediate-associate button because the all-permissions admin claim implies the user can self-associate"
  - "indirectly: every authenticated UI user across all four auth modes, plus every anonymous network caller under DISABLED"

## dependencies_semantic

- requires-feature:
  - "**Spring Security WebFlux SecurityContext propagation** — for non-DISABLED auth modes, the controller relies on `ReactiveSecurityContextHolder.getContext()` (via `AuthIdentityProviderImpl.java:25`) carrying a populated `Authentication`. A regression in the WebFilter chain that loses the SecurityContext degrades EVERY authenticated user to the `dummyOwner()` fallback — i.e. they would all receive admin-with-all-permissions, with no 401/403 to surface the failure (IdentityController.java:27 + AuthIdentityProviderImpl.java:24-35)"
  - "**OpenAPI-generated controller scaffolding** — `IdentityController implements IdentityApi` (line 20); the OpenAPI spec at `openapi.yaml:115-128` defines `whoami` with operationId `whoami`, GET `/api/identity/whoami`, returns `AssociatedOwner`. Any spec change (e.g. adding a `provider` field to `Identity`) regenerates the API interface and may require updating the dummyOwner construction at lines 30-33"
  - "**Permission enum constancy across UI and backend** — the dummy returns `Permission.values()` (line 32); the UI selectors return that exact list to `WithPermissionsProvider`. If the backend Permission enum and the UI's generated-sources Permission enum diverge (e.g. a new Permission shipped backend-side but not yet regenerated in UI), the under-DISABLED admin grant either includes Permissions the UI doesn't know about (silently ignored) or excludes a new Permission (the UI Permission-gate now blocks under-DISABLED — surprising change-of-behaviour)"
- requires-config:
  - "**`auth.type` indirectly** — the controller itself reads no config key, but its `switchIfEmpty(dummyOwner())` fallback fires ONLY when SecurityContext is empty, which under stable runtime occurs ONLY under `auth.type=DISABLED` (DisabledAuthSecurityConfiguration.java:11-19 — the sole SecurityConfiguration that wires no ServerSecurityContextRepository). Under LOGIN_FORM / OAUTH2 / LDAP, the dummyOwner path SHOULD be unreachable (probe P-123 asserts this)"
- requires-runtime:
  - "Spring WebFlux + Reactor 3 (`Mono<ResponseEntity<...>>` return shape; `Mono.just`, `.map`, `.switchIfEmpty`) — lines 15, 24-28"
  - "Spring Web MVC annotation set (`@RestController`) — line 17"
  - "Lombok `@RequiredArgsConstructor` for the single private final IdentityService dependency injection (line 18, 21)"
  - "Lombok `@Slf4j` declared (line 19) but **not used in the body** — no log statements are emitted on whoami invocation, including no audit log of who/when/from-which-IP called the identity-exposure surface"
  - "the OpenAPI-generated `IdentityApi` interface, `AssociatedOwner`, `Identity`, `Permission` (lines 6-9)"
- couples-to:
  - "`IdentityService` interface (service/IdentityService.java:6-8) — sole service dependency"
  - "`IdentityServiceImpl` (service/IdentityServiceImpl.java:22-53) — concrete implementation; chains AuthIdentityProvider + UserOwnerMappingRepository + OwnerAssociationRequestRepository + PermissionService + AssociatedOwnerMapper"
  - "`AuthIdentityProviderImpl#getCurrentUser` (auth/AuthIdentityProviderImpl.java:24-35) — the principal-resolution primitive; the empty-Mono propagation that triggers `switchIfEmpty` originates here"
  - "`AssociatedOwnerMapperImpl#mapAssociatedOwnerWithPermissions` (mapper/AssociatedOwnerMapperImpl.java:38-45) — builds the non-dummy response in the happy path"
  - "the SPA's profile slice: `App.tsx:48` (dispatch) + `profile.thunks.ts:6-10` (the fetchIdentity thunk) + `profile.slice.ts:24-26` (the fulfilled reducer) + `profile.selectors.ts:10-43` (the consuming selectors) — the entire UI principal model"

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - behaviour: "Under DISABLED mode, an anonymous caller hitting `GET /api/identity/whoami` receives 200 OK with `identity.username='admin'` and `identity.permissions=[ALL 70+ Permission enum values]`"
    test_class: security
    criticality: CRITICAL
    note: "the central security-posture claim of this controller; without a regression test, a future refactor that 'cleans up' the switchIfEmpty fallback would silently change behaviour"
  - behaviour: "Under LOGIN_FORM / OAUTH2 / LDAP, an authenticated user `alice` hitting `GET /api/identity/whoami` receives 200 OK with `identity.username='alice'`, NEVER 'admin'"
    test_class: security
    criticality: CRITICAL
    note: "the defence-in-depth assertion — if SecurityContext propagation breaks under any of the three authenticated modes, every user silently downgrades to receiving admin-with-all-permissions and no test catches this"
  - behaviour: "Under LOGIN_FORM / OAUTH2 / LDAP, an ANONYMOUS caller hitting `GET /api/identity/whoami` is blocked by the SecurityWebFilterChain (302 to /login OR 401) BEFORE reaching `IdentityController.whoami`"
    test_class: security
    criticality: HIGH
    note: "if a future SecurityConfiguration change moved `/api/identity/whoami` into a permit-all whitelist, the under-DISABLED dummy fallback would become anonymously reachable even under authenticated auth modes"
  - behaviour: "Under DISABLED with an EXISTING USER_OWNER_MAPPING row matching `('admin', NULL)`, the controller still returns the dummy fallback (because getCurrentUser emits empty, never reaching the userOwnerMappingRepository lookup)"
    test_class: integration
    criticality: MEDIUM
    note: "operator edge case — an admin manually inserting a USER_OWNER_MAPPING row for 'admin' to bind an Owner does NOT affect the under-DISABLED response; the controller's `getCurrentUser` empty-Mono is upstream of the repository lookup"
  - behaviour: "The response's permissions list dynamically grows when a new Permission enum value is added to components.yaml"
    test_class: integration
    criticality: MEDIUM
    note: "compile-time-driven blast radius expansion — adding a new Permission to the spec automatically enters the under-DISABLED admin grant without code review of IdentityController"
  - behaviour: "The response carries no `Cache-Control: no-store` header — a shared HTTP intermediate caching keyed on URL alone could serve a stale identity body to a later caller"
    test_class: security
    criticality: MEDIUM
    note: "identity-bearing responses are the canonical case for `Cache-Control: no-store`; bare ResponseEntity.ok() emits none — Spring Security MAY inject a default no-cache header for authenticated requests, but under DISABLED no security chain runs"
  - behaviour: "The Identity DTO surfaces NO provider string — the OAuth2 registration provider name is not in the response body (only the principal name and permissions are)"
    test_class: integration
    criticality: LOW
    note: "absence-of-leakage assertion; the AuthIdentityProviderImpl carries provider on UserDto but AssociatedOwnerMapperImpl does NOT propagate it to the Identity DTO — verified at AssociatedOwnerMapperImpl.java:29-30 (`new Identity().username(dto.username())` — provider not set)"
  - behaviour: "The controller emits no audit log on whoami invocation — under DISABLED + default deployment, every anonymous probe of the identity surface is invisible in application logs"
    test_class: security
    criticality: HIGH
    note: "the @Slf4j is declared (line 19) but the controller body uses no `log.info` / `log.debug` calls; combined with REFACTOR-185, an operator cannot detect anonymous reconnaissance against the identity surface from logs alone"
- test_files: []
- gaps: |
    Zero direct test coverage for this controller. Greps for `IdentityControllerTest`,
    `IdentityApiTest`, `whoami.*test` under `<odd-platform-repo>/odd-platform-api/src/test`
    return no matches. The eight uncovered_behaviours are derived from the 12-line
    controller body + the IdentityServiceImpl chain + the
    AuthIdentityProviderImpl SecurityContext-handling. Critical-class gaps: the
    DISABLED-mode admin-with-all-permissions claim is the centerpiece of REFACTOR-185
    and has zero regression coverage; the defence-in-depth assertion (dummyOwner
    UNREACHABLE under LOGIN_FORM / OAUTH2 / LDAP) is the single most important
    invariant of this controller and has no test asserting it. The highest-leverage
    test-class for closing the gap is `security` — concrete end-to-end probes against
    each of the four auth modes. The probes emitted by this sidecar (P-122, P-123, P-124)
    constitute the concrete test specification.

## docs_link_semantic

- declared_docs: []  # the source file carries no `@docs` annotation
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication"
    anchor: ""
    rationale: "The authentication landing page — the parent surface where the user-identity exposure (whoami) and the under-DISABLED admin-fallback would be documented if at all"
    last_verified_at: "2026-05-25T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      WebFetch 2026-05-25 status 200, prompt asked about whoami / identity-exposure /
      admin fallback under DISABLED / how the UI determines permissions. Response:
      "Based on the content provided, the page does **not** mention: Any whoami endpoint
      or `/api/identity/whoami`, The user-identity exposure API, An 'admin' fallback under
      DISABLED mode, How a UI determines user permissions. The page only provides a
      high-level overview of authentication mechanisms supported by ODD Platform, listing
      five options without detailed implementation information."
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/disabled-authentication"
    anchor: ""
    rationale: "The dedicated DISABLED-mode page — the canonical home for the under-DISABLED admin fallback finding"
    last_verified_at: "2026-05-25T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      WebFetch 2026-05-25 status 200. Response: "The page does **not** mention: A whoami
      endpoint, `/api/identity/whoami`, The user-identity exposure API, That DISABLED mode
      returns username 'admin' with all permissions. The content provided only describes
      how to disable authentication in ODD Platform and includes a security warning against
      using this configuration in production environments."
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization"
    anchor: ""
    rationale: "The authorization landing page — the canonical surface for the Permission list and how the UI obtains permissions; the under-DISABLED all-permissions claim is the inverse of the documented Policies/Permissions/Roles/Owners framework"
    last_verified_at: "2026-05-25T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      WebFetch 2026-05-25 status 200. Response: "Based on the page content provided, **no**
      — the page does not mention: A whoami endpoint, `/api/identity/whoami`, Permissions
      granted in DISABLED auth mode, How the UI obtains user permissions. The page is an
      overview of ODD Platform's authorization system that lists five subtopics (Policies,
      Permissions, Roles, Owners, and User-owner association) with links to detailed
      documentation."
- doc_drift_findings:
  - "**The under-DISABLED admin-with-all-permissions fallback is undocumented on EVERY relevant doc page.** The live `authentication`, `disabled-authentication`, and `authorization` pages are SILENT on the fact that `GET /api/identity/whoami` returns a hardcoded `identity.username='admin'` with ALL 70+ Permission enum values when SecurityContext is empty (i.e., default deployment). The `disabled-authentication` page's warning 'DO NOT use this method in your production environment!' is the only generic indicator; the specific identity-surface consequence is absent. An operator reading the docs cannot derive that under DISABLED, every anonymous network caller is told they are admin. Severity: HIGH doc-drift. evidence: IdentityController.java:25-33 + DisabledAuthSecurityConfiguration.java:11-19 + the three live doc pages WebFetched 2026-05-25 status 200 (all silent)."
  - "**The UI permission-gate model under DISABLED is undocumented.** The live `authorization` page lists Policies / Permissions / Roles as the authorization mechanism but does not document that under DISABLED, the UI's `WithPermissionsProvider` (which consults the whoami response's permissions list) bypasses the entire RBAC framework — every Permission-gated UI control evaluates `isAllowedTo: true` because the response claims the user has every permission. The doc-side framing implies the Policies-Permissions-Roles framework is the authorization decision boundary; the code shows that under DISABLED the framework is INERT and the UI is permissive on the strength of the whoami response alone. Severity: HIGH doc-drift. evidence: PermissionProvider.tsx:17-32 + profile.selectors.ts:17-20 + IdentityController.java:30-33 + live authorization doc WebFetched 2026-05-25 status 200 (silent)."
  - "**The identity-surface anonymous reach is the central case of REFACTOR-185 — undocumented.** The `disabled-authentication` page's warning is generic ('DO NOT use this in production'); the specific blast radius — that any anonymous caller can probe `/api/identity/whoami` to confirm DISABLED mode AND receive a literal admin identity AND walk the API surface as that admin — is absent. The doc says 'this is the default configuration and no additional settings are required' but does not enumerate the operator-onboarding hazard of binding the platform to a non-loopback interface while DISABLED is active. Severity: HIGH doc-drift. evidence: IdentityController.java:25-33 + DisabledAuthSecurityConfiguration.java:11-19 + REFACTOR-185 (16-sidecar triangulation, this controller is the 17th)."
  - "**The whoami endpoint is the auth-mode probe surface — undocumented as such.** The endpoint's documented purpose ('Get authed user identity', openapi.yaml:118) does not surface that an anonymous probe of this URL is the canonical way to identify which auth mode the platform is running in: 200 with username='admin'+all-permissions → DISABLED; 302 to /login → LOGIN_FORM; 302 to /oauth2/authorization/... → OAUTH2; 401 → LDAP. An attacker can determine the platform's auth posture with a single anonymous request to a documented endpoint. Severity: MEDIUM doc-drift. evidence: IdentityController.java:23-28 + the four `*SecurityConfiguration` classes' WebFilterChain wiring."

## implicit_adrs

- "**Defence-in-depth via SecurityContext-empty fallback rather than fail-fast.** The controller's `.switchIfEmpty(Mono.just(new ResponseEntity<>(dummyOwner(), HttpStatus.OK)))` (line 27) is a deliberate choice: rather than return 401/403 when the principal resolution chain emits empty (which would surface 'you are not authenticated' on every UI mount under DISABLED, breaking the user-onboarding flow), the controller returns a 200 OK with an admin identity so the SPA can mount, populate the toolbar, and the user can navigate. The maintainer accepted the trade-off: under DISABLED, the platform is 'dev-mode-permissive-by-design' and the dummyOwner is the convenience that makes the SPA work without configuring auth. Routing to implicit_adrs because the literal 'admin' + `Permission.values()` construction at lines 30-33 IS the intent statement — the maintainer explicitly designed the under-DISABLED experience to be 'fully unlocked admin'." — evidence: IdentityController.java:27 + lines 30-33 (the dummyOwner construction) — intent_anchor: "`return identityService.whoami().map(ResponseEntity::ok).switchIfEmpty(Mono.just(new ResponseEntity<>(dummyOwner(), HttpStatus.OK)));` — the switchIfEmpty branch with a hardcoded admin identity IS the design decision; if the intent had been fail-fast, this line would be `.switchIfEmpty(Mono.error(new AuthenticationException(...)))` or `.switchIfEmpty(Mono.just(new ResponseEntity<>(HttpStatus.UNAUTHORIZED)))`" — confidence: HIGH
- "**The identity-exposure surface deliberately omits @PreAuthorize.** Every other sensitive controller in the codebase carries @PreAuthorize annotations (per the SecurityConstants/SECURITY_RULES table). IdentityController does NOT (line 23-28; the @Override has no auth annotation, the IdentityApi-generated interface carries none either). The maintainer's intent: the whoami endpoint is the 'who am I?' question — answering it for the caller is the SOURCE of authorization, not a gated operation. Under LOGIN_FORM/OAUTH2/LDAP, the SecurityWebFilterChain blocks anonymous callers before reaching this controller (the WhoAmI URL is NOT in the WHITELIST_PATHS per SecurityConstants); under DISABLED, the maintainer accepts permissiveness. The absence of @PreAuthorize is consistent with this: there is no permission gate appropriate for 'reveal the caller their own identity'." — evidence: IdentityController.java:23 (no @PreAuthorize) + IdentityApi interface (OpenAPI-generated, no annotations) — intent_anchor: "the controller and its OpenAPI-spec'd interface are uniformly free of @PreAuthorize; the design choice 'whoami needs no permission to call' is encoded by absence and is consistent across the spec + implementation" — confidence: MEDIUM (the absence-as-intent inference is consistent across the spec + impl but no comment defends it; the @PreAuthorize ABSENCE is universal for self-introspection endpoints in similar Spring Boot designs)
- "**The dummyOwner construction uses `Permission.values()` rather than an explicit subset — the all-permissions blast radius is dynamic.** Line 32 expands to whatever the Permission enum currently contains. Adding a new Permission to `components.yaml` (e.g., a future `WEBHOOK_CREATE`) automatically enters the under-DISABLED admin grant without ANY code change in this controller. The maintainer's intent (inferable): 'DISABLED-mode admin should always be the maximally-permissive caller; whenever the codebase adds a new capability, that capability is automatically included in the dev-mode admin grant.' This is the dual-edged decision — convenient for dev iteration, blast-radius-amplifying under any deployment-misconfiguration that exposes DISABLED to a network." — evidence: IdentityController.java:32 (`Arrays.asList(Permission.values())`) — intent_anchor: "`Arrays.asList(Permission.values())` — the enumeration-of-all-values literal IS the decision; if the intent had been a curated minimum set, this would be `Arrays.asList(Permission.DATA_ENTITY_INTERNAL_NAME_UPDATE, ...)` enumerating a subset" — confidence: HIGH

## bugs_limitations_corner_cases

- "**Under `auth.type=DISABLED`, an anonymous network caller hitting `GET /api/identity/whoami` receives 200 OK with `identity.username='admin'` and ALL 70+ Permission enum values.** The UI's `WithPermissionsProvider` consumes this response and unlocks every Permission-gated control. This is the IDENTITY-LAYER FACET of REFACTOR-185 (17th sidecar). Combined with the rest of the REFACTOR-185 cluster (the centerpiece read/write endpoints are anonymously reachable), an anonymous network caller can confirm DISABLED mode + receive an admin identity claim + walk the API surface as that admin AND walk the SPA as that admin (no UI control is permission-gated against an anonymous caller because the SPA believes them to be admin-with-all-permissions). severity: HIGH (the central case of REFACTOR-185; the operator-visible blast radius is the entire platform surface). evidence: IdentityController.java:25-33 + DisabledAuthSecurityConfiguration.java:11-19 + AuthIdentityProviderImpl.java:24-35 + PermissionProvider.tsx:17-32."
- "**No `Cache-Control: no-store` on the identity-bearing response.** The controller uses bare `ResponseEntity::ok` (line 26) and `new ResponseEntity<>(dummyOwner(), HttpStatus.OK)` (line 27) — no cache-control headers, no Pragma, no Expires. Any shared HTTP intermediate (NGINX, browser back/forward cache, mobile carrier proxy) caching on URL alone could serve the previous caller's identity body to a later caller. Spring Security's default WebFluxSecurityHeadersConfiguration MAY inject `Cache-Control: no-cache, no-store, max-age=0, must-revalidate` for authenticated responses, but under DISABLED no security chain runs (DisabledAuthSecurityConfiguration.java:14-17 only chains `.csrf(disable)` + `.permitAll()` — no header customization). severity: MEDIUM (latent — depends on intermediate cache behaviour; the identity response is the canonical case for explicit no-store). evidence: IdentityController.java:25-28 + DisabledAuthSecurityConfiguration.java:11-19."
- "**No audit log on `/api/identity/whoami` invocation.** The class carries `@Slf4j` (line 19) but emits NO log statement in the controller body or the IdentityServiceImpl body (IdentityServiceImpl.java:22-53). Under DISABLED + default deployment, every anonymous probe of the identity-exposure surface is INVISIBLE in application logs. An operator forensically reconstructing a security incident cannot determine that an attacker reconnoitered the platform's auth posture via whoami probing, nor that an attacker confirmed an 'admin' identity grant. severity: HIGH (combined with REFACTOR-185, the under-DISABLED admin grant is undetectable from logs). evidence: IdentityController.java:19 (@Slf4j) + lines 24-28 (no log calls) + IdentityServiceImpl.java:30-52 (no log calls)."
- "**Provider field NOT propagated to the response Identity DTO — but the principal-resolution provider IS the silently-discriminating key.** AuthIdentityProviderImpl carries the OAuth2 registrationId as `UserDto.provider` (AuthIdentityProviderImpl.java:29-30), but `AssociatedOwnerMapperImpl.mapAssociatedOwner` constructs `new Identity().username(dto.username())` (AssociatedOwnerMapperImpl.java:29-30) — the provider is NOT included in the Identity DTO. The UI cannot distinguish a LOGIN_FORM `alice` from an OAUTH2 `alice` from an LDAP `alice` from the whoami response alone. Under the LOGIN_FORM↔LDAP cross-mode bleed (AuthIdentityProviderImpl sidecar's first bugs_limitations entry), both modes' alice receive the same Identity body and the UI has no signal to surface that 'this is OAuth2 alice, not LOGIN_FORM alice'. severity: LOW (information completeness gap; not currently a security boundary issue but blocks a future audit-trail surfacing requirement). evidence: AssociatedOwnerMapperImpl.java:29-30 (provider not set on Identity) + Identity DTO (no provider field in components.yaml's Identity schema)."
- "**`ServerWebExchange exchange` parameter is RECEIVED but UNUSED.** Line 24 receives the per-exchange handle from the OpenAPI-generated signature but the controller body never reads it. No header inspection (e.g., `X-Forwarded-For` for client-IP audit logging), no cookie introspection, no request-attribute reading. This is a missed instrumentation surface — the per-exchange data is right there in the method signature, free for the taking, but discarded. severity: LOW (latent — a future audit-logging requirement could trivially add `exchange.getRequest().getRemoteAddress()` reading without changing the signature, but today the controller declares it shouldn't matter). evidence: IdentityController.java:24 (parameter received) + lines 25-28 (parameter never read in the body)."
- "**The dummy username collision with operator-named 'admin' user.** The literal `\"admin\"` (lowercase, line 32) collides with a LOGIN_FORM or LDAP user named 'admin' (lowercase). If an operator inserts USER_OWNER_MAPPING `('admin', NULL, <some-owner-id>)` for a real LOGIN_FORM admin user, AND the platform later transitions to DISABLED mode (a misconfiguration or rollback), every anonymous caller's whoami response claims to be 'admin' — and downstream calls (if a future refactor added a USER_OWNER_MAPPING lookup in the dummy path) would resolve to the real admin user's Owner. Today the dummy path does NOT do that lookup (the controller's switchIfEmpty short-circuits BEFORE the AuthIdentityProvider-fetched-owner step), so the collision is latent — but a future regression that 'fixed' the dummy fallback to also resolve an Owner would activate the collision. severity: LOW (latent regression vector). evidence: IdentityController.java:32 + ReactiveUserOwnerMappingRepositoryImpl.java:116-127 (the (oidc_username='admin', provider=NULL) lookup that would fire if the dummy path called getAssociatedOwner)."

## stress_findings

```yaml
stress_findings:
  tunables: []
  name_behavior_pairs:
    - name: "GET /api/identity/whoami (operationId: whoami)"
      promise: "Return the authenticated user's identity — username, owner-association state, and the permissions the user has."
      implementation: "Delegates to IdentityServiceImpl.whoami → AuthIdentityProviderImpl.getCurrentUser → SecurityContext-read. When SecurityContext is empty (DISABLED mode, or any regression that loses the SecurityContext), `.switchIfEmpty(Mono.just(new ResponseEntity<>(dummyOwner(), HttpStatus.OK)))` substitutes a hardcoded admin identity with ALL 70+ Permission enum values, returned as 200 OK with no audit log, no Cache-Control header, and no warning. The endpoint name promises 'whoami'; the implementation under DISABLED answers 'admin' to every anonymous caller — a behaviour the name does not surface."
      drift: DRIFT_NAME_VS_BEHAVIOR
      operator_visible_consequence: "Under DISABLED + default deployment, an anonymous network caller probing /api/identity/whoami receives a 200 OK claiming they are 'admin' with every permission, with no indication the response is a fallback rather than a real identity — and the UI's permission-gate framework then treats them as admin across the entire SPA."
      confidence: STATIC-INFERRED
      evidence: "IdentityController.java:25-33 (the chain + the dummy fallback) + DisabledAuthSecurityConfiguration.java:11-19 (the empty-SecurityContext condition) + components.yaml:158-235 (the 70+ Permission enum values)"
    - name: "dummyOwner()"
      promise: "Return a default/placeholder Owner — the name suggests a low-privilege or read-only fallback."
      implementation: "Constructs an AssociatedOwner with identity.username='admin' and identity.permissions=Arrays.asList(Permission.values()) — i.e. the MAXIMUM-PRIVILEGE caller the platform can construct, not a low-privilege placeholder. The 'dummy' in the method name suggests inert/safe; the implementation is maximally-permissive."
      drift: DRIFT_NAME_VS_BEHAVIOR
      operator_visible_consequence: "A maintainer reading 'dummyOwner' may assume the fallback is benign (read-only, no-permissions, no-owner). The actual implementation is the most-privileged identity the platform constructs. A future refactor that 'cleans up the dummy' under the assumption of inertness would be misreading the original intent. The name elides the deliberate maximum-permissiveness choice."
      confidence: STATIC-INFERRED
      evidence: "IdentityController.java:30-33"
  orderings: []
  auth_gates:
    - location: "IdentityController.java:23-28"
      endpoint: "GET /api/identity/whoami"
      questions:
        - q: "What does this endpoint return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "DISABLED: 200 OK with identity.username='admin' and identity.permissions=[all 70+] — the dummyOwner fallback (line 27) fires because DisabledAuthSecurityConfiguration wires NO SecurityContext (DisabledAuthSecurityConfiguration.java:11-19). LOGIN_FORM: under an authenticated session, 200 OK with the real principal name + the user's mapped permissions; under anonymous request, 302 to /login (the SecurityWebFilterChain rejects before reaching the controller; the whoami URL is NOT in the WHITELIST_PATHS per SecurityConstants). OAUTH2: under an authenticated session, 200 OK with the real principal name + provider-namespaced owner mapping + permissions; under anonymous request, 302 to /oauth2/authorization/{provider}. LDAP: under an authenticated request with valid LDAP basic-auth header, 200 OK; under anonymous request, 401 (LDAPSecurityConfiguration.java:118-130 wires HTTP basic auth)."
          confidence: PROBE-NEEDED
          evidence: "P-122 (DISABLED probe) + P-123 (LOGIN_FORM defence-in-depth probe); WebFlux SecurityWebFilterChain wiring traced statically but the actual response codes per auth mode require runtime verification"
        - q: "What does an unauthenticated caller see (no cookie / no token)?"
          a: "Under DISABLED: 200 OK with dummyOwner (admin + all permissions). Under LOGIN_FORM / OAUTH2: 302 redirect to the auth provider. Under LDAP: 401. The DISABLED response is the load-bearing security finding (probe P-122)."
          confidence: PROBE-NEEDED
          evidence: "P-122"
        - q: "What does a caller with a wrong-role see (e.g. READ_ONLY hitting whoami)?"
          a: "N/A — there is no role-gating on the whoami endpoint by design (implicit_adr[1]). A caller of any role authenticates and receives their own identity body; there is no 'wrong-role' state for self-introspection."
          confidence: STATIC-INFERRED
          evidence: "IdentityController.java:23 (no @PreAuthorize) + IdentityApi interface (no annotations) + implicit_adr[1]"
        - q: "Where does the gate live — controller, service, repository, or nowhere?"
          a: "The gate lives in the SecurityWebFilterChain at the framework layer (LoginFormSecurityConfiguration.java:50-57 + OAuthSecurityConfiguration.java + LDAPSecurityConfiguration.java) — anonymous calls are rejected BEFORE reaching the controller under LOGIN_FORM / OAUTH2 / LDAP. Under DISABLED, NO gate exists (DisabledAuthSecurityConfiguration.java:14-17 wires `.anyExchange().permitAll()`). Controller / service / repository / mapper are all UN-gated; the entire auth model for this endpoint is in the SecurityWebFilterChain."
          confidence: STATIC-INFERRED
          evidence: "DisabledAuthSecurityConfiguration.java:11-19 + LoginFormSecurityConfiguration.java:50-57 + AuthIdentityProviderImpl.java:24-35"
  resource_boundaries:
    - location: "IdentityController.java:25-28"
      kind: cache
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "No. The controller and service chain are stateless reactive — no shared mutable state, no in-memory cache, no synchronized block, no @Transactional. Two simultaneous /whoami calls from two different sessions each resolve their own SecurityContext via ReactiveSecurityContextHolder (per-reactor-Context isolation) and produce independent responses."
          confidence: STATIC-INFERRED
          evidence: "IdentityController.java:17-34 (no state) + IdentityServiceImpl.java:22-53 (no state) + AuthIdentityProviderImpl.java:17-21 (only the repository dependency, no state)"
        - q: "Is the call replay-safe?"
          a: "Yes. GET /api/identity/whoami is idempotent — same caller → same response body (modulo USER_OWNER_MAPPING data changes between calls). No side effects on the server."
          confidence: STATIC-INFERRED
          evidence: "IdentityController.java:23-33 (no writes, no DB mutations) + IdentityServiceImpl.java:30-52 (pure reads)"
        - q: "If a cache fronts this, what is the TTL / eviction key / staleness window?"
          a: "The application sets NO Cache-Control header (probe P-124 records actuals). Under DISABLED, no security chain runs, so Spring Security's default no-cache header is NOT injected. The HTTP/1.1 default heuristic caching treats a cookie-bearing 200 response with no Cache-Control as cacheable for a short heuristic window — a shared cache keyed on URL alone (no Vary: Cookie unless explicitly set) could serve the previous caller's identity body to a later caller. Under LOGIN_FORM / OAUTH2 / LDAP, Spring Security MAY inject `Cache-Control: no-cache, no-store, max-age=0, must-revalidate` (verify via P-124)."
          confidence: PROBE-NEEDED
          evidence: "P-124 (cache-control posture across login state); IdentityController.java:25-28 (no header customization) + DisabledAuthSecurityConfiguration.java:11-19 (no header injection in DISABLED)"
  request_inputs:
    - location: "IdentityController.java:24"
      input_kind: local-variable
      input_name: "exchange (ServerWebExchange)"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "ServerWebExchange is the per-exchange handle — promises that the controller has access to the full request (headers, cookies, query string) and the response (response headers, cookies). The parameter being received explicitly suggests the controller will use it for something — header inspection, audit logging, custom response headers, or content-negotiation."
          confidence: STATIC-INFERRED
          evidence: "IdentityController.java:24"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Nothing. The controller body (lines 25-27) does not read `exchange` at all. The parameter is forwarded from the OpenAPI-generated IdentityApi signature but discarded. No headers are inspected, no cookies are read, no audit data is captured."
          confidence: STATIC-INFERRED
          evidence: "IdentityController.java:25-28 (parameter unused in body)"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "TRANSLATES_LEGITIMATELY — the parameter is required by the OpenAPI-generated interface contract (the controller MUST implement the IdentityApi method signature). The maintainer cannot remove it without spec changes. Routing as legitimate-translation because the unused parameter is a consequence of the OpenAPI scaffolding, not a bug — but it is an OBSERVABLE missed instrumentation surface (see bugs_limitations.[4])."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "IdentityController.java:23 (@Override on IdentityApi interface method) + the OpenAPI-generated IdentityApi declares whoami(ServerWebExchange exchange) for all controllers implementing it"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — TRANSLATES_LEGITIMATELY."
          confidence: STATIC-INFERRED
          evidence: "N/A"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "Yes — ALL of `exchange.getRequest().getHeaders()`, `exchange.getRequest().getRemoteAddress()`, `exchange.getRequest().getCookies()`, `exchange.getResponse().getHeaders()` are available and unused. The most operator-relevant unused capability is `exchange.getResponse().getHeaders().setCacheControl(CacheControl.noStore())` — the controller has direct access to the response headers and could set `Cache-Control: no-store` in two lines but does not. This is the available-but-unused smell for the cache-control gap."
          confidence: STATIC-INFERRED
          evidence: "IdentityController.java:24 (parameter received) + the response-mutation API on ServerWebExchange is available + the controller body emits no response-header mutation"
      routes_to_finding: "bugs_limitations_corner_cases.[4] (parameter received but unused) + bugs_limitations_corner_cases.[1] (no Cache-Control header — the unused exchange parameter is the available-but-unused mechanism to fix it)"
  probes_emitted:
    - probe_id: P-122
      question: "Under DISABLED + default deployment, does an anonymous GET /api/identity/whoami return 200 with identity.username='admin' and all 70+ Permission enum values?"
      probe_path: lineage/odd-platform/probes/P-122.yaml
    - probe_id: P-123
      question: "Under LOGIN_FORM, does an authenticated user receive their REAL principal name (never 'admin'), and does an anonymous caller get blocked by the SecurityWebFilterChain (302/401) BEFORE reaching the controller (i.e., the dummyOwner fallback is UNREACHABLE under authenticated auth modes)?"
      probe_path: lineage/odd-platform/probes/P-123.yaml
    - probe_id: P-124
      question: "Does the controller emit any Cache-Control header on the whoami response, across each of the four auth modes? Does Spring Security's stock header injection apply under DISABLED?"
      probe_path: lineage/odd-platform/probes/P-124.yaml
  stress_summary:
    triggers_total: 6
    questions_total: 14
    answers_static_inferred: 10
    answers_probe_needed: 4
    answers_reference: 0
    drift_flags: 2
```

## security

- **auth_mode_relevance**: `LOGIN_FORM | OAUTH2 | LDAP | DISABLED`. The controller is invoked under all four UI auth modes. The CRITICAL mode is DISABLED — the empty SecurityContext triggers the `switchIfEmpty(dummyOwner())` fallback, returning a hardcoded admin identity with all 70+ Permission enum values. Under LOGIN_FORM / OAUTH2 / LDAP, the SecurityWebFilterChain rejects anonymous calls before reaching the controller; authenticated calls flow through the real principal-resolution chain (AuthIdentityProviderImpl → ReactiveUserOwnerMappingRepository → AssociatedOwnerMapperImpl). evidence: IdentityController.java:25-33 + DisabledAuthSecurityConfiguration.java:11-19 + AuthIdentityProviderImpl.java:24-35.
- **ingestion_filter_relevance**: `NO — UI/API surface, not ingestion`. The whoami endpoint is on the user-facing API surface; the ingestion filter (`IngestionDataEntitiesFilter`) only applies to `POST /ingestion/entities`.
- **authorization_assertions**: [] — the controller has NO @PreAuthorize annotation and no programmatic permission check. By design (implicit_adr[1]) — whoami is the SOURCE of authorization, not a gated operation. The gate is in the SecurityWebFilterChain at the framework layer (only under LOGIN_FORM / OAUTH2 / LDAP); under DISABLED, no gate exists. evidence: IdentityController.java:23-33 + IdentityApi interface (no annotations) + DisabledAuthSecurityConfiguration.java:11-19.
- **owner_scoping**: `N/A — the response is the caller's own identity`. There is no owner-scoping question for whoami — it answers 'who is the caller'. Under LOGIN_FORM / OAUTH2 / LDAP, the response's `owner` field is the user's mapped Owner via `fetchAssociatedOwner` (downstream service); under DISABLED, the response's `owner` is null (dummy fallback). evidence: IdentityController.java:25-33 + IdentityServiceImpl.java:36-52.
- **data_exposure**:
  - "AssociatedOwner payload (identity.username + identity.permissions[] + owner | null + associationRequest | null) → any authenticated user (under LOGIN_FORM / OAUTH2 / LDAP) AND any anonymous network caller (under DISABLED). The permissions array is the full Permission enum under DISABLED, revealing the entire capability surface of the platform to an unauthenticated probe. evidence: IdentityController.java:25-33 + AssociatedOwnerMapperImpl.java:25-45."
  - "Implicit auth-mode signal: an anonymous GET to /api/identity/whoami returns DIFFERENT response shapes per auth mode: 200+dummy(admin/all-perms) under DISABLED; 302 to /login under LOGIN_FORM; 302 to /oauth2/authorization/{provider} under OAUTH2; 401 under LDAP. Any anonymous network caller can determine the platform's auth mode with a single request to a documented endpoint. evidence: IdentityController.java:23-28 + the four `*SecurityConfiguration` classes' WebFilterChain wiring."
  - "Provider field absence in the response: the OAuth2 registration provider name (Github / Cognito / etc.) is carried internally as UserDto.provider but is NOT included in the response Identity DTO (AssociatedOwnerMapperImpl.java:29-30). UI cannot distinguish per-IDP identities from the whoami response. evidence: AssociatedOwnerMapperImpl.java:29-30."
- **known_security_gaps**:
  - "**Under DISABLED + default deployment, anonymous network callers receive 200 OK claiming they are admin-with-all-permissions.** This is the IDENTITY-LAYER FACET of REFACTOR-185 — the 17th sidecar in the 16-sidecar triangulation. The blast radius compounds with REFACTOR-185's other facets: anonymous network callers can confirm DISABLED mode AND receive an admin identity claim AND walk the API surface as that admin AND walk the SPA as that admin (the UI's WithPermissionsProvider unlocks every Permission-gated control). severity: HIGH. evidence: IdentityController.java:25-33 + DisabledAuthSecurityConfiguration.java:11-19 + PermissionProvider.tsx:17-32."
  - "**No Cache-Control: no-store on the identity-bearing response.** The most user-specific response body on the API surface is emitted with no explicit cache-prevention. Under DISABLED (no security chain runs), Spring Security's default no-cache headers are not injected; the response is heuristic-cacheable by HTTP/1.1 intermediates. severity: MEDIUM (latent — depends on intermediate cache behaviour; identity responses are the canonical case for explicit no-store). evidence: IdentityController.java:25-28 + DisabledAuthSecurityConfiguration.java:11-19 (no header customization)."
  - "**No audit log on /api/identity/whoami invocation.** The @Slf4j annotation is declared (line 19) but the controller body and the service body emit no log statements. Under DISABLED, every anonymous probe of the identity-exposure surface is invisible in application logs — an operator forensically reconstructing a security incident cannot detect anonymous reconnaissance against the auth posture. severity: HIGH (combined with REFACTOR-185, the under-DISABLED admin-grant is undetectable from logs). evidence: IdentityController.java:19 (@Slf4j) + lines 24-28 (no log calls) + IdentityServiceImpl.java:30-52 (no log calls)."
  - "**Defence-in-depth assumption is not regression-tested.** The controller's invariant 'the switchIfEmpty fallback is UNREACHABLE under LOGIN_FORM / OAUTH2 / LDAP' is the load-bearing security boundary; if a future SecurityConfiguration change broke SecurityContext propagation under any of the three authenticated modes, every user would silently downgrade to receiving the dummyOwner admin-with-all-permissions response, with NO 401/403 surfacing the failure. No test asserts the invariant. severity: HIGH (latent regression vector — the LOGIN_FORM hard-codes-every-user-ADMIN already, so a SecurityContext-loss bug under LOGIN_FORM would be VERY hard to detect from response shape alone). evidence: IdentityController.java:27 + AuthIdentityProviderImpl.java:24-35 + LoginFormSecurityConfiguration.java:81 (every user is ADMIN; the dummy is also admin)."

## performance

- **hot_paths**:
  - "**Per-app-mount whoami round-trip.** Every SPA mount fires `App.tsx:48 dispatch(fetchIdentity())` once-per-mount. For a single user opening 5 tabs to ODD across a working day, that is 5 × (GET /api/identity/whoami → IdentityServiceImpl.whoami → 3 zipped DB reads via Mono.zip(getAssociatedOwner, getLastRequestForUsername, getNonContextualPermissionsForCurrentUser)) per day. evidence: IdentityController.java:24-28 + IdentityServiceImpl.java:36-52 + App.tsx:46-51."
  - "**3 DB round-trips per whoami call under authenticated auth modes.** The service chain at IdentityServiceImpl.java:37-43 issues Mono.zip of (1) USER_OWNER_MAPPING JOIN OWNER lookup; (2) OWNER_ASSOCIATION_REQUEST query; (3) PermissionService.getNonContextualPermissionsForCurrentUser. The three are in parallel (Mono.zip), so latency is max(t1, t2, t3) not sum, but each contributes a DB connection acquisition. evidence: IdentityServiceImpl.java:37-43."
- **throughput_characteristics**:
  - "stateless reactive — instances scale horizontally with no coordination"
  - "single-request, no batching — one whoami response per HTTP request"
  - "non-blocking Mono signatures — does not pin the event-loop thread on DB read"
- **resource_allocation**:
  - "no per-instance caching — every whoami invocation issues fresh DB reads (the upstream AuthIdentityProviderImpl carries no caching either per its sidecar)"
  - "the underlying queries are small (single-row USER_OWNER_MAPPING lookup; bounded permission lookup) and indexed"
  - "no measurable resource hot-spot at the controller layer; the service-chain DB reads dominate latency"
- **scaling_characteristics**:
  - "stateless — instances scale horizontally"
  - "no advisory locks, no in-memory state, no leader-election"
  - "no pagination concern (single-record response)"
  - "no rate-limiting — an anonymous attacker can probe whoami at request-rate under DISABLED to enumerate auth mode + dummy identity, with no throttle"
- **known_performance_gaps**:
  - "**No rate-limiting on the identity-exposure surface.** Under DISABLED, an attacker can probe /api/identity/whoami at maximum request rate to confirm the auth posture and the admin-fallback identity — no IP-based throttle, no per-session limit. The attack is reconnaissance not resource exhaustion, but the absence of any throttle is a latency-amplifier for the REFACTOR-185 blast radius. severity: LOW (performance gap; the actual risk is the security finding not the throughput cost). evidence: IdentityController.java:23-28 (no rate-limit annotation; no Spring filter wired) + DisabledAuthSecurityConfiguration.java:11-19 (no rate-limit filter)."

## upstream_callers

- entry_point: "ui_route:/ (Overview) AND every other UI route — fetchIdentity is dispatched once per App component mount"
  caller_node: "ts react-component:App.tsx (App.tsx:46-51 useEffect with empty dep-array)"
  multiplicity_per_trigger: 1
  evidence: "App.tsx:48 (`dispatch(fetchIdentity()).catch(() => {})`) inside useEffect([]) — fires exactly once per App mount; the SPA's React root is a single App component, so the call fires once per full SPA mount"
  observation_class: ui-call
- entry_point: "ui_action:OwnerAssociationForm.onSubmit (after createOwnerAssociationRequest resolves)"
  caller_node: "ts react-component:OwnerAssociationForm.tsx (OwnerAssociationForm.tsx:121-129)"
  multiplicity_per_trigger: 1
  evidence: "OwnerAssociationForm.tsx:128 (`dispatch(fetchIdentity())` inside onSubmit after a successful createOwnerAssociationRequest, to refresh the user's Owner association state) — fires once per successful Owner-association submission"
  observation_class: ui-call
- entry_point: "rest:GET /api/identity/whoami (direct third-party API consumer)"
  caller_node: "external-http-caller (not a substrate node; any external client invoking the REST endpoint directly)"
  multiplicity_per_trigger: 1
  evidence: "openapi.yaml:115-128 (the public OpenAPI contract; whoami is exposed under the `identity` tag with no auth metadata in the spec — any client can call it)"
  observation_class: rest-call
- entry_point: "ui_route:* (any anonymous reconnaissance probe under DISABLED — REFACTOR-185 facet)"
  caller_node: "external-http-caller (anonymous network probe under default deployment)"
  multiplicity_per_trigger: "unbounded"
  evidence: "DisabledAuthSecurityConfiguration.java:11-19 (.anyExchange().permitAll() — no rate-limit, no auth requirement); an anonymous attacker can probe at request-rate to confirm auth mode and receive admin identity"
  observation_class: rest-call

## downstream_side_effects

- side_effect_class: page-render
  description: "Returns AssociatedOwner JSON payload (identity{username, permissions[]} + owner | null + associationRequest | null) to the caller — under DISABLED, the payload claims `identity.username='admin'` with all 70+ Permission enum values"
  evidence: "IdentityController.java:25-33"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "ui_route:/ (every SPA mount via App.tsx:48)"
    - "ui_action:OwnerAssociationForm.onSubmit (refresh after Owner-association submission)"
    - "rest:GET /api/identity/whoami (direct API consumer)"
    - "ui_route:* (under DISABLED — anonymous reconnaissance)"
- side_effect_class: db-write
  description: "None directly — the controller and service are pure reads. (The service chain issues 3 DB SELECTs under authenticated modes; under DISABLED the chain is short-circuited by getCurrentUser's empty-Mono so no DB calls fire at all.)"
  evidence: "IdentityController.java:24-28 (no mutations) + IdentityServiceImpl.java:30-52 (Mono.zip of three pure reads, no writes)"
  cardinality_per_call: 0
  reachable_from_entry_points: []
- side_effect_class: db-write
  description: "DOWNSTREAM REFERENCE — under authenticated modes, IdentityServiceImpl.whoami issues USER_OWNER_MAPPING JOIN OWNER (read), OWNER_ASSOCIATION_REQUEST (read), permission lookup (read). All reads, no writes. See AuthIdentityProviderImpl sidecar's downstream_side_effects for the per-DB-call details."
  evidence: "IdentityServiceImpl.java:37-43"
  cardinality_per_call: 0
  reachable_from_entry_points: []
  unresolved: false
- side_effect_class: log-emit
  description: "NONE — @Slf4j is declared but no log statement is emitted in the controller or service body. Under DISABLED, anonymous /api/identity/whoami probes are invisible in application logs."
  evidence: "IdentityController.java:19 (@Slf4j declared) + lines 24-28 (no log calls); IdentityServiceImpl.java:22-53 (no log calls)"
  cardinality_per_call: 0
  reachable_from_entry_points: []
- side_effect_class: header-set
  description: "NONE — the controller uses bare `ResponseEntity::ok` (line 26) and `new ResponseEntity<>(...HttpStatus.OK)` (line 27); no Cache-Control, no Pragma, no Expires, no custom headers. (Spring Security MAY inject default no-cache headers under authenticated modes; under DISABLED none are injected.)"
  evidence: "IdentityController.java:25-28 (no `.header()` calls, no header customization)"
  cardinality_per_call: 0
  reachable_from_entry_points: []

## sources

- understanding ← IdentityController.java:1-34 + IdentityServiceImpl.java:30-52 + AuthIdentityProviderImpl.java:24-35 + DisabledAuthSecurityConfiguration.java:11-19 + components.yaml:158-235 (Permission enum) + App.tsx:46-51 + PermissionProvider.tsx:17-32
- concepts.entities.IdentityController ← IdentityController.java:17-34
- concepts.entities.IdentityApi ← openapi.yaml:115-128
- concepts.entities.AssociatedOwner ← AssociatedOwnerMapperImpl.java:25-45 + IdentityController.java:7
- concepts.entities.Identity ← AssociatedOwnerMapperImpl.java:29-30 + IdentityController.java:8
- concepts.entities.Permission ← components.yaml:158-235 (70+ enum values) + IdentityController.java:9
- concepts.entities.IdentityService ← IdentityService.java:6-8
- concepts.entities.IdentityServiceImpl ← IdentityServiceImpl.java:22-53
- concepts.entities.AuthIdentityProvider ← AuthIdentityProvider.java:8-14 + AuthIdentityProviderImpl.java:24-35
- concepts.entities.ServerWebExchange ← IdentityController.java:14, 24
- concepts.operations.delegate-to-identity-service ← IdentityController.java:25
- concepts.operations.wrap-mono-in-ResponseEntity.ok ← IdentityController.java:26
- concepts.operations.inject-dummy-fallback-on-empty ← IdentityController.java:27
- concepts.operations.construct-dummy-admin-with-all-permissions ← IdentityController.java:30-33
- concepts.invariants.[*] ← IdentityController.java:21 (single dependency) + lines 24-33 (dummy fallback construction) + AssociatedOwnerMapperImpl.java:29-30 (no provider on Identity)
- concepts.audiences.[*] ← App.tsx:46-51 (SPA mount) + AppToolbar.tsx:74 (username display) + PermissionProvider.tsx:17-32 (permission gating) + OwnerAssociationForm.tsx:26 (associateImmediately flag)
- dependencies_semantic.requires-feature.[*] ← AuthIdentityProviderImpl.java:24-35 + openapi.yaml:115-128 + components.yaml:158-235
- dependencies_semantic.requires-config ← DisabledAuthSecurityConfiguration.java:11-19 (the condition that triggers the fallback)
- dependencies_semantic.requires-runtime.[*] ← IdentityController.java:1-22 (imports + annotations)
- dependencies_semantic.couples-to.[*] ← cited file:line ranges
- tests_coverage_semantic.uncovered_behaviours.[*] ← Grep for `IdentityControllerTest|IdentityApiTest|whoami.*test` under <odd-platform-repo>/odd-platform-api/src/test returned no matches; the 8 behaviours are derived from the 12-line controller body + the service chain
- docs_link_semantic.inferred_docs.[0] ← live WebFetch 2026-05-25 status 200 of authentication landing page
- docs_link_semantic.inferred_docs.[1] ← live WebFetch 2026-05-25 status 200 of disabled-authentication sub-page
- docs_link_semantic.inferred_docs.[2] ← live WebFetch 2026-05-25 status 200 of authorization landing page
- docs_link_semantic.doc_drift_findings.[*] ← three live WebFetches (all status 200, all silent on whoami/admin-fallback/UI-permission-gate behaviour) + IdentityController.java:30-33 + DisabledAuthSecurityConfiguration.java:11-19 + PermissionProvider.tsx:17-32
- implicit_adrs.[0] (defence-in-depth via fallback) ← IdentityController.java:27 + lines 30-33
- implicit_adrs.[1] (no @PreAuthorize on whoami) ← IdentityController.java:23 + IdentityApi interface (OpenAPI-generated, no annotations)
- implicit_adrs.[2] (dynamic all-permissions blast radius via Permission.values()) ← IdentityController.java:32
- bugs_limitations_corner_cases.[0] (DISABLED admin-with-all-permissions) ← IdentityController.java:25-33 + DisabledAuthSecurityConfiguration.java:11-19 + AuthIdentityProviderImpl.java:24-35 + PermissionProvider.tsx:17-32
- bugs_limitations_corner_cases.[1] (no Cache-Control) ← IdentityController.java:25-28 + DisabledAuthSecurityConfiguration.java:11-19
- bugs_limitations_corner_cases.[2] (no audit log) ← IdentityController.java:19, 24-28 + IdentityServiceImpl.java:30-52
- bugs_limitations_corner_cases.[3] (provider field not propagated) ← AssociatedOwnerMapperImpl.java:29-30 + AuthIdentityProviderImpl.java:29-30 (UserDto carries provider) + components.yaml (Identity schema)
- bugs_limitations_corner_cases.[4] (ServerWebExchange unused) ← IdentityController.java:24-28
- bugs_limitations_corner_cases.[5] (admin literal collision) ← IdentityController.java:32 + ReactiveUserOwnerMappingRepositoryImpl.java:116-127
- stress_findings.name_behavior_pairs ← IdentityController.java:25-33 + openapi.yaml:115-128 (the documented promise of the whoami endpoint)
- stress_findings.auth_gates ← IdentityController.java:23-28 + DisabledAuthSecurityConfiguration.java:11-19 + LoginFormSecurityConfiguration.java:50-57 + AuthIdentityProviderImpl.java:24-35
- stress_findings.resource_boundaries ← IdentityController.java:17-34 (no state) + IdentityServiceImpl.java:22-53 (no state) + AuthIdentityProviderImpl.java:17-21 (no state)
- stress_findings.request_inputs ← IdentityController.java:24 (ServerWebExchange parameter received) + lines 25-28 (parameter unused in body)
- stress_findings.probes_emitted ← P-122 (DISABLED), P-123 (LOGIN_FORM defence-in-depth), P-124 (cache-control posture)
- security.auth_mode_relevance ← IdentityController.java:25-33 + DisabledAuthSecurityConfiguration.java:11-19 + AuthIdentityProviderImpl.java:24-35
- security.ingestion_filter_relevance ← N/A (UI/API surface)
- security.authorization_assertions ← IdentityController.java:23 (no @PreAuthorize) + IdentityApi interface (no annotations)
- security.owner_scoping ← IdentityController.java:25-33 + IdentityServiceImpl.java:36-52
- security.data_exposure.[*] ← IdentityController.java:25-33 + AssociatedOwnerMapperImpl.java:25-45 + four `*SecurityConfiguration` classes' WebFilterChain wiring
- security.known_security_gaps.[*] ← cited file:line ranges within each entry
- performance.hot_paths.[*] ← IdentityController.java:24-28 + IdentityServiceImpl.java:36-52 + App.tsx:46-51
- performance.throughput_characteristics.[*] ← IdentityController.java:17-34 (stateless reactive)
- performance.resource_allocation.[*] ← IdentityController.java + AuthIdentityProviderImpl.java (no caching)
- performance.scaling_characteristics.[*] ← IdentityController.java:17-34 (no state, no locks, no rate-limit)
- performance.known_performance_gaps.[*] ← IdentityController.java:23-28 + DisabledAuthSecurityConfiguration.java:11-19
- upstream_callers.[0] ← App.tsx:48 (useEffect dispatch)
- upstream_callers.[1] ← OwnerAssociationForm.tsx:128 (refresh after Owner-association)
- upstream_callers.[2] ← openapi.yaml:115-128 (public REST contract)
- upstream_callers.[3] ← DisabledAuthSecurityConfiguration.java:11-19 (anonymous reach under DISABLED)
- downstream_side_effects.[*] ← IdentityController.java:25-33 (response shape) + IdentityServiceImpl.java:30-52 (DB read chain) + no log/header customization

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH (zero direct tests verified via Grep)
- docs_link_semantic: HIGH (three live WebFetches against the canonical authentication / disabled-authentication / authorization doc pages, all 200, all silent — doc-drift findings concrete and verifiable)
- implicit_adrs: HIGH (3 decisions anchored to concrete intent evidence: the switchIfEmpty-fallback construction, the absence-of-@PreAuthorize for self-introspection, and the `Permission.values()` dynamic-enumeration choice)
- bugs_limitations_corner_cases: HIGH (every claim traces to specific lines; the admin-with-all-permissions claim is the central security finding and is anchored to a 4-file evidence chain)
- security: HIGH
- performance: HIGH
- upstream_callers: HIGH (one direct UI caller, one direct UI action caller, one public-API caller, one anonymous-reach caller — all anchored to file:line)
- downstream_side_effects: HIGH (the response shape is the primary side effect; absence of audit log / Cache-Control / DB writes is asserted with file:line)
- stress_findings: MEDIUM (10 of 14 questions resolved STATIC-INFERRED; 4 resolved PROBE-NEEDED — 3 emitted probes cover the central security boundary, the defence-in-depth assumption, and the cache-control posture; the operator-observable claim 'DISABLED returns admin+all-perms' is STATIC-INFERRED with strong evidence but the actual response shape across all four auth modes requires runtime verification)

## Maintainer notes
