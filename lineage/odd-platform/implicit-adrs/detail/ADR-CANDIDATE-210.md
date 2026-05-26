## ADR-CANDIDATE-210 — `IdentityController.whoami` returns a synthetic `dummyOwner` (literal `admin` + `Permission.values()` — every Permission enum value) on empty SecurityContext — defence-in-depth-via-permissive-fallback / dev-mode-fully-unlocked-by-design

**Severity**: HIGH (load-bearing — defines the centerpiece security posture under `auth.type=DISABLED`)
**Classification**: unique-load-bearing (single primary source, but the decision shapes every SPA mount, every UI permission gate, every anonymous probe under default deployment)
**Batch**: ZD (2026-05-25)
**Pillars affected**: [P-09 Security & Access Control (the centerpiece DISABLED-mode behaviour for the identity surface), P-08 Management & Administration (the UI's `WithPermissionsProvider` consumes this response on every SPA mount)]
**Support**: 1 sidecar PRIMARY SOURCE (batch-ZD IdentityController-class) — the decision is unique-load-bearing because the literal `Permission.values()` construction at IdentityController.java:32 is the canonical embodiment of "DISABLED is dev-mode-fully-unlocked", cross-validated by the four `*SecurityConfiguration` consumers, the DisabledAuthSecurityConfiguration's `.permitAll()` posture, and the UI's `PermissionProvider` consumer chain.

**Surfaced by**:
- `odd-platform__java__IdentityController__controller-class__IdentityController.md:implicit_adrs.[0]` (HIGH) — "**Defence-in-depth via SecurityContext-empty fallback rather than fail-fast.** The controller's `.switchIfEmpty(Mono.just(new ResponseEntity<>(dummyOwner(), HttpStatus.OK)))` (line 27) is a deliberate choice: rather than return 401/403 when the principal resolution chain emits empty (which would surface 'you are not authenticated' on every UI mount under DISABLED, breaking the user-onboarding flow), the controller returns a 200 OK with an admin identity so the SPA can mount, populate the toolbar, and the user can navigate. The maintainer accepted the trade-off: under DISABLED, the platform is 'dev-mode-permissive-by-design' and the dummyOwner is the convenience that makes the SPA work without configuring auth." — intent_anchor: "`return identityService.whoami().map(ResponseEntity::ok).switchIfEmpty(Mono.just(new ResponseEntity<>(dummyOwner(), HttpStatus.OK)));` — the switchIfEmpty branch with a hardcoded admin identity IS the design decision; if the intent had been fail-fast, this line would be `.switchIfEmpty(Mono.error(new AuthenticationException(...)))` or `.switchIfEmpty(Mono.just(new ResponseEntity<>(HttpStatus.UNAUTHORIZED)))`"
- `odd-platform__java__IdentityController__controller-class__IdentityController.md:implicit_adrs.[1]` (MEDIUM) — "**The identity-exposure surface deliberately omits @PreAuthorize.** Every other sensitive controller in the codebase carries @PreAuthorize annotations (per the SecurityConstants/SECURITY_RULES table). IdentityController does NOT (line 23-28; the @Override has no auth annotation, the IdentityApi-generated interface carries none either). The maintainer's intent: the whoami endpoint is the 'who am I?' question — answering it for the caller is the SOURCE of authorization, not a gated operation."
- `odd-platform__java__IdentityController__controller-class__IdentityController.md:implicit_adrs.[2]` (HIGH) — "**The dummyOwner construction uses `Permission.values()` rather than an explicit subset — the all-permissions blast radius is dynamic.** Line 32 expands to whatever the Permission enum currently contains. Adding a new Permission to `components.yaml` (e.g., a future `WEBHOOK_CREATE`) automatically enters the under-DISABLED admin grant without ANY code change in this controller. The maintainer's intent (inferable): 'DISABLED-mode admin should always be the maximally-permissive caller; whenever the codebase adds a new capability, that capability is automatically included in the dev-mode admin grant.'" — intent_anchor: "`Arrays.asList(Permission.values())` — the enumeration-of-all-values literal IS the decision; if the intent had been a curated minimum set, this would be `Arrays.asList(Permission.DATA_ENTITY_INTERNAL_NAME_UPDATE, ...)` enumerating a subset"

**Decision statement**: `IdentityController.whoami` (`IdentityController.java:23-28`) is the SOLE endpoint behind `GET /api/identity/whoami`, the one URL every SPA mount hits on `App.tsx:48` (`dispatch(fetchIdentity())`). Its body is exactly three reactor operations:

```java
return identityService.whoami()
    .map(ResponseEntity::ok)
    .switchIfEmpty(Mono.just(new ResponseEntity<>(dummyOwner(), HttpStatus.OK)));
```

The architectural commitment is THREE-FOLD:

1. **Empty-SecurityContext is treated as "dev-mode anonymous, NOT unauthenticated".** When `authIdentityProvider.getCurrentUser()` emits `Mono.empty()` (the load-bearing condition that fires under `auth.type=DISABLED` because `DisabledAuthSecurityConfiguration.java:11-19` wires NO `ServerSecurityContextRepository`), the controller does NOT fail-fast with 401/403. Instead it substitutes a `dummyOwner()` body and returns 200 OK so the SPA mounts cleanly. This is the operator-onboarding-velocity choice: a fresh container clone+run + browser open works without configuring auth.

2. **The fallback identity is `admin` (literal lowercase) with `Permission.values()` (ALL 70+ enum values).** `dummyOwner()` at lines 30-33 constructs:
```java
new AssociatedOwner().identity(new Identity()
    .username("admin")
    .permissions(Arrays.asList(Permission.values())));
```
The choice of `Permission.values()` (vs an explicit subset) is the deliberate dynamic-blast-radius commitment: every new Permission added to `components.yaml` (e.g. a future `WEBHOOK_CREATE`) automatically enters the under-DISABLED admin grant without any code review of this file. The maintainer's encoded intent: "DISABLED-mode admin is always maximally permissive — whenever the codebase grows a new capability, the dev-mode admin gets it."

3. **The whoami endpoint deliberately carries no `@PreAuthorize`.** Whoami is the SOURCE of authorization, not a gated operation — answering "who am I?" for the caller cannot itself require a permission, because the answer IS the permission set. The SecurityWebFilterChain blocks anonymous callers under LOGIN_FORM/OAUTH2/LDAP (the whoami URL is NOT in WHITELIST_PATHS); under DISABLED no chain runs and the dummy fires. The absence of @PreAuthorize is uniform across the controller AND the OpenAPI-generated `IdentityApi` interface — the architectural choice IS encoded by absence.

The decision delivers ONE coherent property: **under DISABLED, the SPA mounts as `admin` with every permission unlocked, with zero configuration**. The trade-off accepted: under DISABLED + default deployment, any anonymous network caller hitting `/api/identity/whoami` receives 200 OK claiming they are `admin` with all permissions; the UI's `WithPermissionsProvider` (`PermissionProvider.tsx:17-32`) consumes the response and unlocks every Permission-gated UI control on the strength of the admin claim; combined with REFACTOR-185 (DISABLED bypasses every SECURITY_RULES gate), an anonymous caller can confirm DISABLED mode + receive an admin identity claim + walk the API surface as that admin + walk the SPA as that admin. This is the centerpiece blast radius of the DISABLED posture, and the maintainer's commitment to operator-onboarding velocity is what makes it the shipped default.

**Wisdom test**: PASS on all three questions.
1. **Intentional?** YES — three independent intent anchors: (a) the explicit `.switchIfEmpty(Mono.just(...))` construction at line 27 (fail-fast would have been `.switchIfEmpty(Mono.error(...))` or `.switchIfEmpty(Mono.just(401))` — both shorter; the chosen shape is the longer + more permissive option); (b) the literal `Permission.values()` enumeration at line 32 (a curated subset would have been a more cautious choice; the maintainer chose maximally-permissive); (c) the universal absence of `@PreAuthorize` on this controller AND the generated `IdentityApi` interface (consistent across the spec + impl).
2. **Structural impact?** YES — defines the centerpiece security posture under DISABLED for the identity exposure surface; every UI control gated by permissions, every anonymous probe of the auth posture, every SPA mount under default deployment flows through this 12-line controller body.
3. **Addition vs structural change?** Removing the dummy fallback (returning 401 instead) would be a STRUCTURAL change to the operator-onboarding model, not a refactor. A maintainer adding a curated subset of permissions to the dummy (vs `Permission.values()`) would be making an opposing architectural choice — the dynamic-blast-radius commitment is the load-bearing decision.

**Evidence**:
- IdentityController.md says: "`IdentityController.java:27` (`.switchIfEmpty(Mono.just(new ResponseEntity<>(dummyOwner(), HttpStatus.OK)))`)"
- IdentityController.md says: "`IdentityController.java:30-33` (`new AssociatedOwner().identity(new Identity().username(\"admin\").permissions(Arrays.asList(Permission.values())))`)"
- IdentityController.md says: "`IdentityController.java:23` (no `@PreAuthorize`) + IdentityApi interface (OpenAPI-generated, no annotations)"
- IdentityController.md says: "`DisabledAuthSecurityConfiguration.java:11-19` (the SOLE SecurityConfiguration that wires no ServerSecurityContextRepository — the empty-SecurityContext condition)"
- IdentityController.md says: "`PermissionProvider.tsx:17-32` (UI consumer — `WithPermissionsProvider` consults the response's permissions list)"
- IdentityController.md says: "`AppToolbar.tsx:74` (renders `owner?.name ?? identity?.username` — under DISABLED this shows 'admin' in the top-right corner)"

**Existing ADR**: none directly. Composes with ADR-CANDIDATE-029 (`auth.type=DISABLED` is the shipped default — this ADR is the IDENTITY-LAYER FACET of the same operator-onboarding-velocity stance) and ADR-CANDIDATE-002 (centralised SECURITY_RULES — the whoami endpoint is the canonical "no rule" surface because it's the SOURCE of authorization).

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-185 STRENGTHENED (DISABLED bypasses SECURITY_RULES — the whoami response is the IDENTITY-LAYER FACET; without REFACTOR-185 the dummy fallback would have no operator-visible blast radius; with REFACTOR-185 the entire SPA + API surface unlocks as admin to any anonymous caller)
- REFACTOR-606 NEW (Permission.values() dynamic blast-radius — every new Permission auto-enters the DISABLED admin grant without code review)
- REFACTOR-607 NEW (whoami response shape is the auth-mode probe surface — anonymous response discriminates DISABLED/LOGIN_FORM/OAUTH2/LDAP)
- REFACTOR-608 NEW (no audit log on whoami — anonymous probes invisible)
- REFACTOR-062 STRENGTHENED (no `Cache-Control: no-store` on identity-bearing response — the canonical case for explicit no-store)

**Proposed action**: Promote to `adrs/drafts/whoami-empty-context-permissive-fallback.md` (new ADR). Document the three architectural commitments + the intent anchor (the line-by-line construction) + the maintainer's accepted trade-off ("operator-onboarding velocity vs anonymous-admin blast radius under DISABLED"). Cross-link with ADR-CANDIDATE-029 (DISABLED-as-default) as the operator-onboarding-velocity sibling. Doc-side: the live `disabled-authentication` page must enumerate the centerpiece consequence — anonymous `GET /api/identity/whoami` returns 200 OK with `username='admin'` + all permissions; the UI mounts as admin; this is the central case operators must understand before binding the platform to a non-loopback interface under DISABLED.

**Severity rationale**: HIGH — security-architecture decision defining the centerpiece DISABLED-mode behaviour for the identity exposure surface. A future PR proposing to add `@PreAuthorize`, return 401 on empty SecurityContext, or restrict the dummy to a curated subset would be a structural change to the operator-onboarding model — captured by this ADR. Without the ADR, a maintainer "cleaning up the dummy fallback" under the assumption it is inert would silently change behaviour for every fresh deployment.

## STRENGTHENS — none (initial entry — primary source)

This is the unique-load-bearing primary source. The decision is anchored at the single-sidecar level but the construction (lines 25-33) is the canonical embodiment of the operator-onboarding-velocity stance; cross-validates with ADR-CANDIDATE-029 (DISABLED-as-default) at the operator-onboarding-velocity layer and ADR-CANDIDATE-002 (centralised SECURITY_RULES) at the absence-encoding layer.

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-029 (DISABLED-as-default — this ADR is the IDENTITY-LAYER FACET); ADR-CANDIDATE-002 (centralised SECURITY_RULES — the whoami endpoint is the SOURCE of authorization, deliberately rule-free).
- SUPERSEDES: none.
- CONFLICTS: none.
