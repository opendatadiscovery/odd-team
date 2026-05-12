---
node_id: "odd-platform java PermissionController controller-method:getResourcePermissions"
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

# PermissionController#getResourcePermissions — semantic understanding

## understanding

`getResourcePermissions` is the reactive `GET /api/resource/{permission_resource_type}/{resource_id}/permissions` handler — a one-statement delegation that calls `permissionService.getResourcePermissionsForCurrentUser(resourceType, resourceId)` and lifts the resulting `Flux<Permission>` into `200 OK`. The response is **authoritative**, not a UI hint: the service loads the current user's policies via `RoleService.getCurrentUserRoles → PolicyRepository.getRolesPolicies`, fetches the resource's context (e.g. data-entity dimensions + tags + caller's associated owner for DATA_ENTITY), evaluates every policy statement against that context via `PolicyPermissionExtractor`, and emits the union as a `Flux<Permission>`. The endpoint is the read-side dual of the server-side authorization that `AuthorizationCustomizer` performs on mutation endpoints — same policy graph, same context-resolution path, evaluated for "what does the current caller have right now" instead of "is this mutation request allowed." The UI uses the response to enable/disable buttons; mutations are *separately* enforced server-side by `AuthorizationCustomizer` against `SecurityConstants.SECURITY_RULES`, so a forged response that returns more permissions than the user actually has does NOT bypass mutation gating.

## concepts

- entities: [`Permission` (response item — enum value matching `PolicyPermissionDto` names), `PermissionResourceType` (path param enum — DATA_ENTITY / TERM / QUERY_EXAMPLE / MANAGEMENT — maps 1-1 to `PolicyTypeDto`), `PolicyDto` (the materialised policy graph evaluated server-side), `DataEntityPolicyResolverContext` (the context object built per resource — entity + tags + caller's owner)]
- operations: [`evaluate-current-user-permissions-on-contextual-resource` — load roles → load policies → load resource context → evaluate statements → emit permission set]
- invariants: [
    "Resource type MUST have context (`PolicyTypeDto.hasContext == true`) — DATA_ENTITY, TERM, QUERY_EXAMPLE are valid; passing MANAGEMENT triggers `BadUserRequestException('Resource type MANAGEMENT does not have context')` (`PermissionServiceImpl.java:24-27`)",
    "Resource MUST exist — DATA_ENTITY extractor calls `dataEntityService.getDimensions(resourceId).switchIfEmpty(NotFoundException(...))` (`DataEntityPermissionExtractor.java:64-66`); missing resource returns 404, not an empty permission list",
    "Response is the union of permissions from ALL roles' ALL policies that match the resource — not a single role's view; `getCurrentUserPolicies` flattens roles → policies (`PolicyServiceImpl.java:103-107`) and `AbstractContextualPermissionExtractor` flatMaps statements (`AbstractContextualPermissionExtractor.java:28-34`)",
    "No principal parameter on the endpoint — caller identity comes only from `SecurityContextHolder` via `authIdentityProvider`; the URL has no `{user_id}` slot, so the endpoint cannot be coerced to read another user's permissions",
    "Response is computed per-request — no caching layer between the controller and the policy/role tables; a role change committed to DB is observable on the next call (subject to LOGIN_FORM's static admin-authority caveat — see `bugs_limitations_corner_cases`)"
  ]
- audiences: [
    "ODD Platform UI (the React app) — primary consumer; drives button-enabled state for actions on Data Entities, Terms, Query Examples (per ADR-CANDIDATE-003 read-collaborative posture in this workspace; live docs do NOT document this consumption pattern — see `docs_link_semantic.doc_drift_findings`)",
    "Any authenticated API caller in LOGIN_FORM/OAUTH2/LDAP modes — the endpoint is `.authenticated()` only (no `SecurityRule` entry in `SecurityConstants.SECURITY_RULES`); any caller can query their own permissions on any resource they pass an id for (subject to resource existence)"
  ]

## dependencies_semantic

- requires-feature: [
    "Authorization framework — Policies / Permissions / Roles / Owners / User-owner association (live doc `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization`)"
  ]
- requires-config: [] — N/A (the method reads no config; the controller class also reads no config keys). The endpoint's behaviour shifts based on `auth.type` (DISABLED yields empty result; LOGIN_FORM yields admin-all; OAUTH2/LDAP yield role-derived) but the coupling is in the auth-config classes, not this method.
- requires-runtime: [
    "Spring WebFlux runtime — `Mono<ResponseEntity<Flux<Permission>>>` return type and `ServerWebExchange exchange` parameter (`PermissionController.java:11-12, 20-22`)",
    "Reactive SecurityContext propagation — the downstream service eventually reads `ReactiveSecurityContextHolder.getContext()` via `AuthIdentityProviderImpl` (`AuthIdentityProviderImpl.java:25, 39`); the WebFlux security filter chain must populate the context before this controller runs",
    "jOOQ reactive DB session — policy and role-policy reads are jOOQ queries through `PolicyRepository.getRolesPolicies` and `ReactiveUserOwnerMappingRepository.getUserRolesByOwner` (`PolicyServiceImpl.java:103-107`, `RoleServiceImpl.java:95-101`)"
  ]
- couples-to: [
    "`PermissionApi.getResourcePermissions` (generated interface) — supplies `@RequestMapping(method = GET, value = '/api/resource/{permission_resource_type}/{resource_id}/permissions', produces = 'application/json')` and the `200 OK → List<Permission>` response schema (`openapi.yaml:3681-3702`)",
    "`PermissionService.getResourcePermissionsForCurrentUser(PermissionResourceType, long)` — sole downstream call (`PermissionController.java:23` + `PermissionService.java:8-9`)",
    "`PermissionServiceImpl` — dispatches by resource type via `getExtractor(...)` (`PermissionServiceImpl.java:42-49`); validates `hasContext` invariant; throws `BadUserRequestException` for non-contextual types and `IllegalArgumentException` if no extractor registered",
    "`ContextualPermissionExtractor` implementations — `DataEntityPermissionExtractor`, `TermPermissionExtractor`, `QueryExamplePermissionExtractor` (one per `PolicyTypeDto` with `hasContext == true`); each extends `AbstractContextualPermissionExtractor` for the shared `policies × context → permissions` evaluation",
    "`PolicyService.getCurrentUserPolicies()` → `RoleService.getCurrentUserRoles()` → `PolicyRepository.getRolesPolicies(roleIds)` — the role-to-policy join (`PolicyServiceImpl.java:103-107` + `RoleServiceImpl.java:95-101`)",
    "`AuthIdentityProvider.getCurrentUser/getCurrentUserProviderRole/fetchAssociatedOwner` — the principal-resolution path (`AuthIdentityProviderImpl.java:23-53`); the DataEntity extractor specifically uses `fetchAssociatedOwner` to include the caller's owner in the context (`DataEntityPermissionExtractor.java:51`)",
    "`Permission` (OpenAPI-generated enum) ↔ `PolicyPermissionDto` (Java enum) — names map by `Permission.fromValue(p.name())` (`AbstractContextualPermissionExtractor.java:33`); a divergence between the two enums would silently drop or mis-name permissions"
  ]

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours: [
    "HTTP-level smoke test — no `@WebFluxTest(PermissionController.class)` or `WebTestClient` test asserts `GET /api/resource/DATA_ENTITY/{id}/permissions` returns 200 with a deserialisable `List<Permission>`",
    "Resource-type validation — no test exercises `MANAGEMENT` (or any non-contextual type) hitting `getResourcePermissionsForCurrentUser` and expecting `BadUserRequestException` to surface as 400",
    "Missing resource — no test exercises a non-existent `resource_id` and confirms 404 (via `DataEntityPermissionExtractor.getDataEntityWithTags`'s `NotFoundException`)",
    "Per-mode behaviour — no test asserts that under DISABLED auth mode the response is empty (the runtime behaviour traced in `bugs_limitations_corner_cases`), nor that under LOGIN_FORM the admin always sees ALL permissions regardless of policy table state",
    "Policy correctness — no test asserts the join across roles → policies → statements → context returns the expected permission set for canonical fixtures (admin sees ALL on data-entity; user-without-policy sees [])",
    "Cross-extractor consistency — no test asserts that adding a fourth `PolicyTypeDto` (with `hasContext = true`) without a corresponding `ContextualPermissionExtractor` produces the documented `IllegalArgumentException` (`PermissionServiceImpl.java:47-48`)"
  ]
- test_files: [] — N/A. `find <odd-platform> -name 'PermissionController*Test*' -o -name 'PermissionService*Test*' -o -name 'PermissionExtractor*Test*'` returned zero matches. `grep -rln 'getResourcePermissionsForCurrentUser\|/api/resource/' <odd-platform>/odd-platform-api/src/test` returned zero matches. The only permission-adjacent test is `PolicyDeserializerTest.java` (JSON deserialization of the policy document, not endpoint behaviour).
- gaps: |
    The endpoint sits at the centre of the platform's authorization read path — every UI button that depends on a permission flows through here. There is no integration test, no unit test of the service, no test of any extractor, and no test of the policy-evaluation chain. A regression in `PolicyPermissionExtractor`, in `AbstractContextualPermissionExtractor.getContextualResourcePermissions`'s zip/flatMap, in the `Permission ↔ PolicyPermissionDto` name mapping, or in the `getRolesPolicies` jOOQ query would silently change what the UI shows as "you can do this" without breaking any test. The DataEntity case is especially fragile because the policy resolver depends on the caller's associated *owner* (`DataEntityPermissionExtractor.java:51`) — if the user-owner association is missing or stale, the resolved permissions diverge from what the same user receives after re-association. No test asserts that boundary.

## docs_link_semantic

- declared_docs: [] — N/A. The source file carries no `@docs` Javadoc annotation; consistent with the repo-wide convention.
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization"
    anchor: ""
    rationale: "Canonical authorization-vocabulary page (Policies / Permissions / Roles / Owners / User-owner association). The endpoint is the read-side surface of this entire model; the live page enumerates the five subsystems by name but does not describe runtime querying"
    last_verified_at: "2026-05-12T00:00:00Z"
    last_verified_status: 200
    confidence: MEDIUM
    fetched_excerpts: |
      Vocabulary inventory (verbatim from live page response 2026-05-12): "five authorization subsystems: Policies, Permissions, Roles, Owners, and User-owner association".
      Format note (verbatim): "ODD Platform uses 'JSON schema' for policies".
      Explicit absences (verbatim from page-level audit 2026-05-12):
        - "no 'what can I do on this resource' endpoint or UI mechanism is documented here";
        - "hierarchical or functional relationships between Policy/Permission/Role/Owner/User-owner association are not explained";
        - "no mention of buttons or UI elements that enable/disable based on permissions";
        - "/api/resource/{type}/{id}/permissions endpoint: Not documented on this page";
        - "no discussion of cache behavior, freshness, or refresh timing after role changes";
        - "DISABLED auth mode effects: Not addressed on this page".
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions"
    anchor: ""
    rationale: "Permission catalog page — the only page that enumerates permission types by category. Closest match to the endpoint's response semantics"
    last_verified_at: "2026-05-12T00:00:00Z"
    last_verified_status: 200
    confidence: MEDIUM
    fetched_excerpts: |
      Categorical structure (verbatim from page-level audit 2026-05-12): "permissions into five categories (Data entity, Term, Query Example, Lookup table, and Management)".
      Explicit absences (verbatim from page-level audit 2026-05-12):
        - "no discussion of a /api/resource/{type}/{id}/permissions endpoint or getResourcePermissions function";
        - "documentation does not describe how the user interface validates whether the current user possesses permissions to perform specific actions on resources";
        - "does not reference or enumerate PermissionResourceType values such as DATA_ENTITY, TERM, QUERY_EXAMPLE, or MANAGEMENT as an explicit enum";
        - "no distinction between contextual permissions (tied to specific resources) and non-contextual permissions";
        - "no mention of permissions becoming stale or requiring a login refresh".
      Drift note: the live page lists five categories (Data entity / Term / Query Example / Lookup table / Management). The code's `PermissionResourceType` enum exposes four values (DATA_ENTITY / TERM / QUERY_EXAMPLE / MANAGEMENT) — Lookup table is not a `PermissionResourceType` and cannot be passed as `permission_resource_type` to this endpoint. Lookup-table permissions are LOOKUP_TABLE_* entries inside the MANAGEMENT (non-contextual) statements per `SecurityConstants.java:325-354`; from this endpoint's surface, LOOKUP_TABLE_* is not a resource-typed permission query.
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/policies"
    anchor: ""
    rationale: "Policy structure page — the policy document is the input the server evaluates against the context to produce this endpoint's response"
    last_verified_at: "2026-05-12T00:00:00Z"
    last_verified_status: 200
    confidence: MEDIUM
    fetched_excerpts: |
      Explicit absences (verbatim from page-level audit 2026-05-12):
        - "no discussion of how end-users discover available actions before attempting them on Data Entities, Terms, or Query Examples";
        - "no reference exists to: 'what can I do' endpoints, 'getResourcePermissions' operations, '/api/resource/{type}/{id}/permissions' paths, UI mechanisms for permission checks";
        - "documentation makes no mention of LOGIN_FORM, OAUTH2, LDAP, or DISABLED authentication modes, nor their role in policy evaluation";
        - "no discussion of an Administrator built-in role or whether it possesses 'ALL permissions' across resource types".
- doc_drift_findings:
  - "The entire read-side permission discovery model is undocumented. Three live pages (`/authorization`, `/authorization/permissions`, `/authorization/policies`) WebFetched 2026-05-12 status 200 contain no mention of the `/api/resource/{permission_resource_type}/{resource_id}/permissions` endpoint, `getResourcePermissions`, the UI's consumption pattern, contextual vs non-contextual evaluation, or the Administrator role's ALL-permission default. The endpoint is the canonical mechanism by which the UI decides 'show this button enabled / disabled'; it is invisible to operators reading the public docs. Severity: HIGH for doc completeness; the doc-gap-finder reducer should rank this as a DOC-NNN candidate."
  - "Live `/authorization/permissions` page lists five categories — Data entity, Term, Query Example, Lookup table, Management — but the code's `PermissionResourceType` enum exposes four values (DATA_ENTITY, TERM, QUERY_EXAMPLE, MANAGEMENT — `PolicyTypeDto.java:8-12`). 'Lookup table' is documented as a permission category but is not a resource type addressable through `GET /api/resource/{permission_resource_type}/{resource_id}/permissions`; lookup-table operations live as LOOKUP_TABLE_* permissions inside the non-contextual MANAGEMENT bucket (per `SecurityConstants.java:325-354`). The doc's category list is informationally accurate but does not reflect the enum-level resource-type structure callers must use against this endpoint. Severity: MEDIUM (doc-code shape mismatch)."
  - "Live `/authorization/permissions` page lists Lookup table as a permission category, but the seeded Administrator policy (`V0_0_56__add_predefined_roles_and_policies.sql:1-31` + `V0_0_88__add_query_example_policy.sql:1-11`) covers DATA_ENTITY / TERM / QUERY_EXAMPLE / MANAGEMENT only — no LOOKUP_TABLE statement was added in a corresponding migration. The Administrator built-in role's effective scope on lookup tables is whatever the LOOKUP_TABLE_* permissions resolve to under the MANAGEMENT statement's `'permissions': ['ALL']` — which depends on whether `policyPermissionExtractor` treats `'ALL'` on the MANAGEMENT type as expanding to every LOOKUP_TABLE_* constant. This is unverified at this node (it lives in `PolicyPermissionExtractor`, outside this method's scope) but is a candidate to surface as a refactoring-scopes item. Severity: MEDIUM (out-of-scope to fully verify here)."

## implicit_adrs

- "Read-side permission discovery is a first-class endpoint, not a derived computation client-side — the platform deliberately exposes the policy-evaluation pipeline as `GET /api/resource/{type}/{id}/permissions` so the UI does not have to reconstruct policy semantics. The decision is structurally visible: the same `PermissionService` bean and the same `ContextualPermissionExtractor`s are wired into `OAuthSecurityConfiguration.AuthorizationCustomizer` for mutation enforcement (`OAuthSecurityConfiguration.java:87-98`) AND consumed by this controller for UI discovery — the read path and the enforcement path share one evaluation graph, which is the architectural decision." — evidence: `PermissionController.java:17, 20-25` (delegation to `permissionService`) + `OAuthSecurityConfiguration.java:87-98` (same `permissionService` bean wired into `AuthorizationCustomizer`) + `AbstractContextualPermissionExtractor.java:25-35` (shared evaluation method `getContextualResourcePermissions`) — intent_anchor: "`new AuthorizationCustomizer(permissionService, extractors)` ... `private final PermissionService permissionService;`" (`OAuthSecurityConfiguration.java:98` + `AuthorizationCustomizer.java:16`) — confidence: HIGH

- "Authoritative server-side evaluation, not UI-only hint — the response is the **same** permission set that would be enforced if the user attempted the mutation, computed via the **same** policy graph the mutation enforcer uses. The decision is to never trust a UI-shaped permission cache: every read recomputes against the live policy/role tables. The intent is visible in the lack of caching, the shared extractor abstraction, and the deliberate reuse of `PolicyService.getCurrentUserPolicies` for both read and enforce paths." — evidence: `PermissionServiceImpl.java:22-30` (delegates directly to the live extractor) + `AbstractContextualPermissionExtractor.java:25-35` (per-call zip of context + policies, no memoisation) + `PolicyServiceImpl.java:103-107` (per-call jOOQ query for role-policies) — intent_anchor: "`final Mono<List<PolicyPojo>> policiesMono = policyService.getCurrentUserPolicies();` ... `Mono.zip(contextMono, policiesMono).flatMapIterable(...)`" (`AbstractContextualPermissionExtractor.java:27-28`) — confidence: HIGH

- "Resource-type ↔ context coupling encoded at the enum, not at the controller — `PolicyTypeDto` carries a `hasContext` boolean (`PolicyTypeDto.java:8-14`) and `PermissionServiceImpl` enforces the invariant `hasContext == true` for this endpoint (`PermissionServiceImpl.java:25-27`); the symmetric endpoint for non-contextual permissions enforces `hasContext == false` (`PermissionServiceImpl.java:35-37`). The decision is to surface the resource-type's contextual nature through an enum field rather than a class hierarchy or controller-level dispatch — both endpoints share one service and one enum, with the invariant guarded by `BadUserRequestException`." — evidence: `PolicyTypeDto.java:8-14` + `PermissionServiceImpl.java:24-30, 32-40` — intent_anchor: "`if (!policyTypeDto.isHasContext()) { throw new BadUserRequestException('Resource type ' + resourceType + ' does not have context'); }`" (`PermissionServiceImpl.java:25-27`) — confidence: HIGH

- "Read-side endpoint deliberately left out of `SECURITY_RULES` — `GET /api/resource/.../permissions` carries no `SecurityRule` entry in `SecurityConstants.SECURITY_RULES` (`SecurityConstants.java:98-355`); the path falls through to `pathMatchers('/**').authenticated()` (`AuthorizationCustomizer.java:29-30`). The decision is the read-collaborative posture: any authenticated user may query their own permissions on any resource — there is no permission gate guarding the meta-query 'what can I do?', because the answer is computed for the caller alone and reveals only what the policy graph would grant them anyway. The decision is consistent with the convention that `SECURITY_RULES` enumerates mutations (POST/PUT/PATCH/DELETE) and reads typically fall through; the rule-list is overwhelmingly non-GET (per `SecurityConstants.java:98-355` scan)." — evidence: `SecurityConstants.java:98-355` (rule list shape; no `/api/resource/.../permissions` entry, no GET-shaped rules except one `OWNER_ASSOCIATION_MANAGE` at line 149) + `AuthorizationCustomizer.java:29-30` (catch-all `.authenticated()`) — intent_anchor: "`spec.pathMatchers(\"/**\").authenticated();`" (`AuthorizationCustomizer.java:29-30`) — confidence: HIGH

## bugs_limitations_corner_cases

- "Under `auth.type=DISABLED`, this endpoint returns an empty `Flux<Permission>` regardless of the resource — DisabledAuth's `permitAll()` skips the security filter chain (`DisabledAuthSecurityConfiguration.java:13-17`), so `ReactiveSecurityContextHolder.getContext()` is empty in `AuthIdentityProviderImpl.getCurrentUser` (`AuthIdentityProviderImpl.java:24-35`) and `getCurrentUserProviderRole` (`AuthIdentityProviderImpl.java:37-47`). The reactive chain in `RoleServiceImpl.getCurrentUserRoles` (`RoleServiceImpl.java:95-101`) cascades through empty switchIfEmpty branches to `Mono.just(List.of())`; `PolicyRepository.getRolesPolicies([])` then returns an empty policy list; `AbstractContextualPermissionExtractor` emits no permissions. The UI consuming this endpoint would render every action button as disabled — while server-side mutation endpoints under DISABLED accept any caller (per `AuthorizationCustomizer`'s `.permitAll()` for DISABLED, and per the absence of any `*SecurityConfiguration` bean activating `SECURITY_RULES` enforcement in DISABLED mode). The UI says 'you can do nothing'; the API says 'anyone can do anything.' The contradiction is silent: no error, no log, no admonition." — evidence: `DisabledAuthSecurityConfiguration.java:13-17` + `AuthIdentityProviderImpl.java:24-47` + `RoleServiceImpl.java:95-101` + `PolicyServiceImpl.java:103-107` + `PermissionController.java:20-25` — severity: HIGH

- "Under `auth.type=LOGIN_FORM`, the seeded admin user always receives the ADMIN authority — `GrantedAuthorityExtractor.getAuthorities(true)` (`GrantedAuthorityExtractor.java:12-14`) returns `Set.of(new SimpleGrantedAuthority(UserProviderRole.ADMIN.name()))`. `RoleServiceImpl.getCurrentUserRoles` falls through to `getUserProviderRole` which looks up the `Administrator` role by name (`RoleServiceImpl.java:123-126`); the Administrator role's seeded policy carries `'ALL'` on DATA_ENTITY / TERM / QUERY_EXAMPLE / MANAGEMENT (`V0_0_56__add_predefined_roles_and_policies.sql:1-31` + `V0_0_88__add_query_example_policy.sql:1-11`). The implication: in LOGIN_FORM mode, EVERY caller authenticates as admin and EVERY `getResourcePermissions` call returns the full permission set for the requested resource type — regardless of whether the operator subsequently revoked policies in the UI, because the in-memory admin authority is static and the role mapping bypasses the database `user_owner` join (`RoleServiceImpl.java:96-100`)." — evidence: `LoginFormSecurityConfiguration.java:74-82` (admin authority hard-coded on user details) + `GrantedAuthorityExtractor.java:12-14` (the `isAdmin=true` branch) + `RoleServiceImpl.java:95-101` (the `switchIfEmpty(getUserProviderRole)` fallback) + `V0_0_56__add_predefined_roles_and_policies.sql:1-31` (admin policy seed) — severity: HIGH

- "Lookup-table permissions are unreachable through this endpoint — `PermissionResourceType` exposes DATA_ENTITY / TERM / QUERY_EXAMPLE / MANAGEMENT only (per `PolicyTypeDto.java:8-12`, and the OpenAPI parameter `PermissionResourceTypeParam` at `components.yaml/#/components/parameters`). Lookup-table operations live as LOOKUP_TABLE_* permissions inside the non-contextual MANAGEMENT bucket (per `SecurityConstants.java:325-354`). A UI page rendering buttons for a single lookup table cannot ask 'what can I do on lookup table X?' through this endpoint — it can only ask 'what management permissions do I have globally?' via the sibling `getNonContextualPermissionsForCurrentUser` path. If lookup-table permissions are intended to be per-instance gated (e.g. lookup-table-level owner association), the read-side discovery model does not support it." — evidence: `PolicyTypeDto.java:8-12` + `SecurityConstants.java:325-354` (LOOKUP_TABLE_* live under NO_CONTEXT rules) + live `/authorization/permissions` page listing Lookup table as a category — severity: MEDIUM

- "The response shape exposes the caller's actual permission set on a resource — privilege enumeration is structurally possible, but bounded by the caller's own permissions. A caller cannot pass another user's identity (no `{user_id}` slot in the URL); the endpoint always evaluates for `current user`. A caller CAN, however, iterate `resource_id` values to discover which resources they have elevated permissions on (e.g. spotting that they have `DATA_ENTITY_OWNERSHIP_UPDATE` only on entities they own — useful for legitimate UI, also useful for an internal recon-shaped enumeration). The endpoint does not log resource-id parameters, does not rate-limit, and returns a deterministic shape per (caller, resource). Severity: LOW (the leak is bounded to what the policy graph would grant the same caller anyway; not a privilege escalation, only a discoverability surface)." — evidence: `PermissionController.java:20-22` (signature has no userId) + `AuthIdentityProviderImpl.java:24-35` (caller from SecurityContext only) + `AbstractContextualPermissionExtractor.java:25-35` (no audit log emission) + class-level `PermissionController.java` carries no rate-limit annotation — severity: LOW

- "Resource-existence response is asymmetric — for DATA_ENTITY, missing resource → 404 via `dataEntityService.getDimensions(...).switchIfEmpty(NotFoundException(...))` (`DataEntityPermissionExtractor.java:64-66`). For TERM and QUERY_EXAMPLE the corresponding extractor's `getContext` resolution path is not verified in scope of this enrichment node, but if any of them returns an empty Mono on miss instead of throwing, the controller would emit a `Flux.empty()` permission set (interpretable as 'you can do nothing here') rather than a 404. The 200-with-empty vs 404 distinction matters because callers can otherwise enumerate resource ids: a 404 reveals 'this id does not exist'; a 200-empty might also mean 'you have no permissions here', but is indistinguishable from the not-exists case. Severity: MEDIUM (out-of-scope to fully verify here; surface for term/query-example extractor enrichment)." — evidence: `DataEntityPermissionExtractor.java:50-56, 64-66` (explicit `NotFoundException`) — severity: MEDIUM

- "No HTTP-level test, no unit test of `PermissionService`, no test of any `ContextualPermissionExtractor`. A regression in any layer of the read path (`PermissionController` → `PermissionServiceImpl` → `DataEntityPermissionExtractor` → `AbstractContextualPermissionExtractor` → `PolicyService.getCurrentUserPolicies` → `PolicyPermissionExtractor`) would silently change what the UI shows as 'you can do this' without breaking any test. Smallest reproducer: `@WebFluxTest(PermissionController.class)` + `WebTestClient.get().uri('/api/resource/DATA_ENTITY/{id}/permissions', existingId).exchange().expectStatus().isOk()` for the happy path; an integration test against an in-memory or test-container Postgres for the role → policy → context evaluation chain." — evidence: `find <odd-platform> -name 'PermissionController*Test*' -o -name 'PermissionService*Test*' -o -name 'PermissionExtractor*Test*'` returned no matches (run during enrichment session 2026-05-12) — severity: HIGH

## security

- **auth_mode_relevance**: `LOGIN_FORM | OAUTH2 | LDAP` (the three modes that protect the UI/API surface this controller is mounted on). Under `DISABLED` the endpoint is anonymously reachable but returns empty (per `bugs_limitations_corner_cases[0]`). Under LOGIN_FORM the response is always the admin's full permission set (per `bugs_limitations_corner_cases[1]`). The method itself carries no `@ConditionalOnProperty`; auth wiring is enforced globally by the `*SecurityConfiguration` beans (`LoginFormSecurityConfiguration.java:31`, `OAuthSecurityConfiguration.java:71`, `DisabledAuthSecurityConfiguration.java:10`).
- **ingestion_filter_relevance**: `NO — UI/API surface, not /ingestion/entities`. The `IngestionDataEntitiesFilter` matches `/ingestion/entities` POST only; `GET /api/resource/...` does not match.
- **authorization_assertions**: [] — `PermissionController.java:14-26` carries no `@PreAuthorize`, no `@Secured`, no programmatic `permissionService.hasPermission(...)` call. `SecurityConstants.SECURITY_RULES` (`SecurityConstants.java:98-355`) contains no entry for `GET /api/resource/{permission_resource_type}/{resource_id}/permissions` — the path therefore falls through to `pathMatchers('/**').authenticated()` in `AuthorizationCustomizer.java:29-30`. Authentication is required; authorization-on-the-read is not enforced. (This is intentional per `implicit_adrs[3]` — the endpoint reveals only the caller's own resolved permissions.)
- **owner_scoping**: `RESPECTS — context resolution includes the caller's associated owner`. The DATA_ENTITY extractor explicitly fetches `authIdentityProvider.fetchAssociatedOwner()` and includes it in `DataEntityPolicyResolverContext` (`DataEntityPermissionExtractor.java:51-55`); the policy resolver uses the owner to evaluate ownership-conditional statements. A caller without an associated owner falls through to a null-owner context (`DataEntityPermissionExtractor.java:54-55`), so policies conditioned on ownership evaluate `false` for that caller — they still receive global-grant permissions (e.g. admin's `'ALL'`) but not owner-conditional grants.
- **data_exposure**:
  - "`List<Permission>` payload (enum values such as `DATA_ENTITY_DESCRIPTION_UPDATE`, `DATA_ENTITY_OWNERSHIP_CREATE`, etc.) → the calling authenticated user under LOGIN_FORM/OAUTH2/LDAP — payload reveals only what the policy graph would grant the same caller on the same resource if they attempted the mutation. No other user's permissions are exposed." — evidence: `PermissionController.java:20-25` + `AbstractContextualPermissionExtractor.java:25-35`
  - "Empty payload (`Flux.empty()` serialised as `[]`) → ANONYMOUS callers under `auth.type=DISABLED` — the endpoint is anonymously reachable but the policy chain returns no permissions for an unauthenticated context. Misleading semantic: UI consuming this would render buttons disabled, while the actual mutation API is unprotected in DISABLED mode." — evidence: `DisabledAuthSecurityConfiguration.java:13-17` + the empty-context cascade traced in `bugs_limitations_corner_cases[0]`
  - "Resource-existence signal: 404 when the requested DATA_ENTITY id does not exist (`DataEntityPermissionExtractor.java:64-66` throws `NotFoundException`) — a caller iterating resource ids can confirm/deny existence of a data entity. Bounded by the caller's authenticated identity; no cross-user disclosure." — evidence: `DataEntityPermissionExtractor.java:64-66`
- **known_security_gaps**:
  - "Under DISABLED auth mode, the endpoint returns an empty permission set while the corresponding mutation endpoints are simultaneously `.permitAll()` (no `SECURITY_RULES` enforcement chain registered). UI consumers will render buttons disabled, but a direct API caller can perform every mutation. This is a UI-vs-API-vs-doc contradiction, not a typical privilege escalation — but operators reading the UI may believe the platform is locked down when it is not. The deception is silent: no log, no warning, no admonition in the docs or in the UI." — evidence: `DisabledAuthSecurityConfiguration.java:13-17` + traced empty-permission cascade in `bugs_limitations_corner_cases[0]` — severity: HIGH
  - "LOGIN_FORM mode returns ALL permissions for every caller because the static admin authority is wired in `LoginFormSecurityConfiguration.java:74-82` and the Administrator role's policy carries `'ALL'` on every contextual resource type. The endpoint cannot distinguish a 'real admin reviewing a permission' from 'the platform is in single-tenant dev mode'; both look identical in the response. Operators using LOGIN_FORM for staging environments may believe per-resource permission gating is honoured when the underlying admin authority short-circuits it." — evidence: `LoginFormSecurityConfiguration.java:74-82` + `GrantedAuthorityExtractor.java:12-14` + `V0_0_56__add_predefined_roles_and_policies.sql:1-31` — severity: MEDIUM
  - "No `SecurityRule` entry — the endpoint is reachable by any authenticated caller in OAUTH2/LDAP modes for any resource type and any resource id (subject to existence). This is intentional per `implicit_adrs[3]`, but operators auditing `SecurityConstants.SECURITY_RULES` for read-side gating will find no enforcement and may wrongly conclude the endpoint is unprotected. The docs do not record the design intent." — evidence: `SecurityConstants.java:98-355` (no GET-shaped rule for `/api/resource/...`) + `AuthorizationCustomizer.java:29-30` + live `/authorization` page audit 2026-05-12 (no documentation of the read-side surface) — severity: LOW (intentional design; gap is in documentation, not enforcement)

## performance

- **hot_paths**:
  - "Per-resource-page-render request on the ODD Platform UI — every data-entity, term, or query-example detail page renders buttons whose enabled state depends on this endpoint's response. The downstream chain executes (a) `getRolesPolicies` jOOQ query (`PolicyServiceImpl.java:103-107`), (b) `dataEntityService.getDimensions` jOOQ query (`DataEntityPermissionExtractor.java:65`), (c) `tagRepository.listDataEntityDtos` jOOQ query (`DataEntityPermissionExtractor.java:67`), (d) `authIdentityProvider.fetchAssociatedOwner` jOOQ query (`AuthIdentityProviderImpl.java:51-52`). For a typical data-entity page, the controller alone induces 4 DB round-trips for the permission check." — evidence: `PermissionController.java:20-25` + `AbstractContextualPermissionExtractor.java:25-35` + `DataEntityPermissionExtractor.java:50-69` + `AuthIdentityProviderImpl.java:51-52` + `PolicyServiceImpl.java:103-107`
- **throughput_characteristics**:
  - "Per-resource call shape — the endpoint takes one `(resource_type, resource_id)` pair; there is no batch variant. A UI rendering a list of N data entities cannot ask 'permissions for these N entities in one call'; it must issue N requests, each inducing the 4-query fan-out described in `hot_paths[0]`. Severity: a list view with 50 entities triggers ~200 DB round-trips for permission checks alone — N+1 scaled by the per-resource fan-out." — evidence: `PermissionController.java:20-22` (signature: single `Long resourceId`) + `openapi.yaml:3681-3702` (path param is single `resource_id`, not an array)
  - "Reactive non-blocking signature — `Mono<ResponseEntity<Flux<Permission>>>`; no thread is held during DB await, but the 4 round-trips remain sequential within the reactive chain (the inner `Mono.zip(contextMono, policiesMono)` zips two parallel monos, each of which further fans out)" — evidence: `AbstractContextualPermissionExtractor.java:26-28` (`Mono.zip(contextMono, policiesMono)`)
- **resource_allocation**:
  - "Per-request allocations bounded by the policy count × statement count × permission count for the caller's roles — for a typical user with a single role and a 3-statement policy, the allocation is trivial; for the Administrator role (1 policy, 4 statements, `'ALL'` permission), the resolver expands `'ALL'` to every constant in `PolicyPermissionDto` for the resource type, materialising every `Permission` enum value into the response Set." — evidence: `AbstractContextualPermissionExtractor.java:30-33` (the `Set<PolicyPermissionDto>` accumulation)
  - "Per-request DB connection cost — 4 jOOQ queries per call (policies + dimensions + tags + owner) drawn from the reactive pool; no pooling at this layer beyond the global jOOQ/R2DBC reactive pool config" — evidence: `DataEntityPermissionExtractor.java:50-69`
- **scaling_characteristics**:
  - "Stateless controller — horizontal scaling unconstrained at this layer" — evidence: `PermissionController.java:14-26` (no instance state)
  - "No caching at any layer — every call re-runs the full 4-query fan-out; a role / policy change committed to DB is reflected on the next call without invalidation logic (the LOGIN_FORM admin-static caveat in `bugs_limitations_corner_cases[1]` is a different layer — the in-memory authority bypass)" — evidence: `PermissionController.java:20-25` + `PermissionServiceImpl.java:22-30` + `AbstractContextualPermissionExtractor.java:25-35` (no caching annotations or memoisation primitives)
  - "Per-resource call shape forces UI N+1 for list views — see `throughput_characteristics[0]`" — evidence: `PermissionController.java:20-22` + `openapi.yaml:3681-3702`
- **known_performance_gaps**:
  - "No batch variant — UI list views requesting permissions for N resources induce N × 4 = 4N DB round-trips. A `POST /api/resource/{type}/permissions` accepting `{resource_ids: [...]}` returning `Map<resourceId, List<Permission>>` would reduce the fan-out to one policies+roles fetch and one batched dimensions+tags+owner fetch. This is a structural perf gap, not a config-tuning gap." — evidence: `PermissionController.java:20-22` + `openapi.yaml:3681-3702` — severity: HIGH (list-view rendering on data-entity-heavy platforms)
  - "No per-request caching of `getRolesPolicies` — within a single page render the UI may call this endpoint for multiple resources; each call re-fetches the same policy list for the same user. A request-scoped cache (e.g. `Mono.cache()` keyed on user) would eliminate the redundant policy fetch." — evidence: `PolicyServiceImpl.java:103-107` + `AbstractContextualPermissionExtractor.java:27` (per-call `policyService.getCurrentUserPolicies()`) — severity: MEDIUM
  - "No method-level observability — no `@Timed`, no Micrometer counter, no structured log entry. Latency regressions on this hot path would surface only at the WebFlux / DB metric layer, not at the controller boundary. For an endpoint hit on every UI permission-check, observability would be valuable." — evidence: `PermissionController.java:14-26` — severity: LOW

## sources

- understanding ← `PermissionController.java:14-26` (the entire controller class) + `PermissionService.java:8-9` (interface contract) + `PermissionServiceImpl.java:22-30, 42-49` (dispatch + invariant) + `AbstractContextualPermissionExtractor.java:25-35` (the shared evaluation method) + `DataEntityPermissionExtractor.java:50-69` (a representative concrete extractor)
- concepts.entities.Permission ← `PermissionController.java:5` (import) + `AbstractContextualPermissionExtractor.java:33` (`Permission.fromValue(p.name())`)
- concepts.entities.PermissionResourceType ← `PermissionController.java:6, 20` (import + parameter) + `PolicyTypeDto.java:8-14` (the corresponding internal enum)
- concepts.entities.PolicyDto ← `AbstractContextualPermissionExtractor.java:9, 29-31` (the materialised policy graph)
- concepts.entities.DataEntityPolicyResolverContext ← `DataEntityPermissionExtractor.java:50-55` (context construction)
- concepts.operations ← `PermissionController.java:20-25` + `PermissionServiceImpl.java:22-30` + `AbstractContextualPermissionExtractor.java:25-35`
- concepts.invariants[0] ← `PermissionServiceImpl.java:24-27` (`hasContext` check + `BadUserRequestException`)
- concepts.invariants[1] ← `DataEntityPermissionExtractor.java:64-66` (`switchIfEmpty(NotFoundException(...))`)
- concepts.invariants[2] ← `PolicyServiceImpl.java:103-107` (roles → policies flatten) + `AbstractContextualPermissionExtractor.java:28-34` (statements flatMap)
- concepts.invariants[3] ← `PermissionController.java:20-22` (signature without userId) + `AuthIdentityProviderImpl.java:24-35` (caller from SecurityContext only)
- concepts.invariants[4] ← `AbstractContextualPermissionExtractor.java:25-35` (no caching primitives) + `PolicyServiceImpl.java:103-107` (per-call jOOQ query)
- concepts.audiences ← `PermissionController.java:14-26` + WebFetch `/authorization` page 2026-05-12 + workspace ADR-CANDIDATE-003 reference
- dependencies_semantic.requires-feature ← WebFetch `/authorization` page 2026-05-12 status 200
- dependencies_semantic.requires-runtime[0] ← `PermissionController.java:11-12, 20-22`
- dependencies_semantic.requires-runtime[1] ← `AuthIdentityProviderImpl.java:25, 39` (`ReactiveSecurityContextHolder.getContext()` reads)
- dependencies_semantic.requires-runtime[2] ← `PolicyServiceImpl.java:103-107` + `RoleServiceImpl.java:95-101`
- dependencies_semantic.couples-to[0] ← `openapi.yaml:3681-3702` (the path + operation definition) + `PermissionController.java:4, 19` (interface implementation)
- dependencies_semantic.couples-to[1] ← `PermissionController.java:23` (the delegation call) + `PermissionService.java:8-9` (interface)
- dependencies_semantic.couples-to[2] ← `PermissionServiceImpl.java:22-30, 42-49`
- dependencies_semantic.couples-to[3] ← `PermissionServiceImpl.java:18` (the extractor list field) + `DataEntityPermissionExtractor.java:23-25` (one concrete extractor) + `AbstractContextualPermissionExtractor.java:20`
- dependencies_semantic.couples-to[4] ← `PolicyServiceImpl.java:103-107` + `RoleServiceImpl.java:95-101`
- dependencies_semantic.couples-to[5] ← `AuthIdentityProviderImpl.java:23-53` + `DataEntityPermissionExtractor.java:51`
- dependencies_semantic.couples-to[6] ← `AbstractContextualPermissionExtractor.java:33` (`Permission.fromValue(p.name())` — the name-mapping seam)
- tests_coverage_semantic.test_files ← `find <odd-platform> -name 'PermissionController*Test*' -o -name 'PermissionService*Test*' -o -name 'PermissionExtractor*Test*'` returned no matches; `grep -rln 'getResourcePermissionsForCurrentUser\|/api/resource/' <odd-platform>/odd-platform-api/src/test` returned no matches (run 2026-05-12)
- docs_link_semantic.inferred_docs[0] ← WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization` 2026-05-12 status 200
- docs_link_semantic.inferred_docs[1] ← WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions` 2026-05-12 status 200
- docs_link_semantic.inferred_docs[2] ← WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/policies` 2026-05-12 status 200
- docs_link_semantic.doc_drift_findings[0] ← WebFetch responses 2026-05-12 (three pages, all 200, all absent on the endpoint) + `PermissionController.java:20-25` (the undocumented endpoint)
- docs_link_semantic.doc_drift_findings[1] ← WebFetch `/authorization/permissions` page 2026-05-12 ("five categories ... Lookup table") + `PolicyTypeDto.java:8-12` (four-value enum)
- docs_link_semantic.doc_drift_findings[2] ← `V0_0_56__add_predefined_roles_and_policies.sql:1-31` + `V0_0_88__add_query_example_policy.sql:1-11` (no LOOKUP_TABLE statement in admin policy) + WebFetch `/authorization/permissions` page 2026-05-12 (Lookup table category)
- implicit_adrs[0] ← `PermissionController.java:17, 20-25` + `OAuthSecurityConfiguration.java:87-98` (shared `permissionService` wiring) + `AuthorizationCustomizer.java:16` + `AbstractContextualPermissionExtractor.java:25-35`
- implicit_adrs[1] ← `PermissionServiceImpl.java:22-30` + `AbstractContextualPermissionExtractor.java:25-35` + `PolicyServiceImpl.java:103-107`
- implicit_adrs[2] ← `PolicyTypeDto.java:8-14` + `PermissionServiceImpl.java:24-30, 32-40`
- implicit_adrs[3] ← `SecurityConstants.java:98-355` (the rule-list shape; the absence of GET rules) + `AuthorizationCustomizer.java:29-30`
- bugs_limitations_corner_cases[0] ← `DisabledAuthSecurityConfiguration.java:13-17` + `AuthIdentityProviderImpl.java:24-47` + `RoleServiceImpl.java:95-101` + `PolicyServiceImpl.java:103-107` + `PermissionController.java:20-25`
- bugs_limitations_corner_cases[1] ← `LoginFormSecurityConfiguration.java:74-82` + `GrantedAuthorityExtractor.java:12-14` + `RoleServiceImpl.java:95-101, 123-126` + `V0_0_56__add_predefined_roles_and_policies.sql:1-31` + `V0_0_88__add_query_example_policy.sql:1-11`
- bugs_limitations_corner_cases[2] ← `PolicyTypeDto.java:8-12` + `SecurityConstants.java:325-354` (LOOKUP_TABLE_* under NO_CONTEXT) + WebFetch `/authorization/permissions` 2026-05-12
- bugs_limitations_corner_cases[3] ← `PermissionController.java:20-22` + `AuthIdentityProviderImpl.java:24-35` + `AbstractContextualPermissionExtractor.java:25-35`
- bugs_limitations_corner_cases[4] ← `DataEntityPermissionExtractor.java:50-56, 64-66`
- bugs_limitations_corner_cases[5] ← `find` command absence-of-tests result run 2026-05-12
- security.auth_mode_relevance ← `PermissionController.java:14-26` (no `@ConditionalOnProperty`) + `LoginFormSecurityConfiguration.java:31` + `OAuthSecurityConfiguration.java:71` + `DisabledAuthSecurityConfiguration.java:10`
- security.ingestion_filter_relevance ← `LoginFormSecurityConfiguration.java:50` (`/ingestion/entities` whitelist) + `SecurityConstants.java:95-96` (WHITELIST_PATHS) — `/api/resource/...` does not match
- security.authorization_assertions ← `PermissionController.java:14-26` (no security annotations) + `SecurityConstants.java:98-355` (no rule entry for this path) + `AuthorizationCustomizer.java:29-30` (catch-all `.authenticated()`)
- security.owner_scoping ← `DataEntityPermissionExtractor.java:51-55` (owner included in context) + `AuthIdentityProviderImpl.java:50-53`
- security.data_exposure[0] ← `PermissionController.java:20-25` + `AbstractContextualPermissionExtractor.java:25-35`
- security.data_exposure[1] ← `DisabledAuthSecurityConfiguration.java:13-17` + empty-context cascade
- security.data_exposure[2] ← `DataEntityPermissionExtractor.java:64-66`
- security.known_security_gaps[0] ← `DisabledAuthSecurityConfiguration.java:13-17` + empty-context cascade
- security.known_security_gaps[1] ← `LoginFormSecurityConfiguration.java:74-82` + `GrantedAuthorityExtractor.java:12-14` + admin policy seed migrations
- security.known_security_gaps[2] ← `SecurityConstants.java:98-355` + `AuthorizationCustomizer.java:29-30` + WebFetch `/authorization` page 2026-05-12 (absence)
- performance.hot_paths[0] ← `PermissionController.java:20-25` + `AbstractContextualPermissionExtractor.java:25-35` + `DataEntityPermissionExtractor.java:50-69` + `AuthIdentityProviderImpl.java:51-52` + `PolicyServiceImpl.java:103-107`
- performance.throughput_characteristics[0] ← `PermissionController.java:20-22` + `openapi.yaml:3681-3702`
- performance.throughput_characteristics[1] ← `AbstractContextualPermissionExtractor.java:26-28`
- performance.resource_allocation[0] ← `AbstractContextualPermissionExtractor.java:30-33`
- performance.resource_allocation[1] ← `DataEntityPermissionExtractor.java:50-69`
- performance.scaling_characteristics[0] ← `PermissionController.java:14-26`
- performance.scaling_characteristics[1] ← `PermissionController.java:20-25` + `PermissionServiceImpl.java:22-30` + `AbstractContextualPermissionExtractor.java:25-35`
- performance.scaling_characteristics[2] ← `PermissionController.java:20-22` + `openapi.yaml:3681-3702`
- performance.known_performance_gaps[0] ← `PermissionController.java:20-22` + `openapi.yaml:3681-3702`
- performance.known_performance_gaps[1] ← `PolicyServiceImpl.java:103-107` + `AbstractContextualPermissionExtractor.java:27`
- performance.known_performance_gaps[2] ← `PermissionController.java:14-26` (no observability annotations)

## confidence_per_field

- understanding: HIGH (every claim verified against the controller, service, abstract extractor, and a concrete extractor at cited lines)
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH (absence-of-tests verified by file-system + grep search)
- docs_link_semantic: MEDIUM (no `@docs` annotation in source; three URLs WebFetched 2026-05-12 status 200; the absences are documented verbatim from the page-level audits returned by the fetch model — drift findings are HIGH-confidence as absence claims, MEDIUM-confidence on the enricher's binding endpoint→pages)
- implicit_adrs: HIGH (each decision has structural evidence and a quoted intent_anchor at cited file:line)
- bugs_limitations_corner_cases: HIGH for the DISABLED-empty-cascade, LOGIN_FORM-admin-static, and absent-tests findings (each fully traced); MEDIUM for the lookup-table-asymmetry finding (cross-references SecurityConstants and the docs) and the per-extractor existence-asymmetry finding (out-of-scope for full verification of term/query-example extractors)
- security: HIGH (every claim is structural and traces to the controller, service, security config classes, and migration seed)
- performance: HIGH (the 4-query fan-out, the per-resource shape, and the absence of caching/observability are all directly visible at cited lines)

## Maintainer notes

