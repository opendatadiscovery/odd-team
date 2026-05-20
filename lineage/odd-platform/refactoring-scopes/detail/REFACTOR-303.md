## REFACTOR-303 — No auto-create of Owner on OAUTH2/LDAP first login → silent empty results for unmapped users; `/my` tabs return HTTP 200 + empty body with no on-screen "request your association" prompt

**Severity**: HIGH
**Category**: ux-bug (user-onboarding failure mode)
**Pillars affected**: [P-09-security-access-control, P-01-data-discovery, P-08-management-administration]
**Batch**: K (2026-05-19)

**Surfaced by**:
- `odd-platform__java__service__service__AuthIdentityProviderImpl.md:bugs_limitations_corner_cases.[2]` (HIGH) — "No auto-create of Owner on OAUTH2/LDAP first login — silent empty results for unmapped users. A new OAUTH2 or LDAP user authenticated for the first time has NO USER_OWNER_MAPPING row. `fetchAssociatedOwner` chain emits empty Mono (line 51 → flatMap on a Mono that emits empty). Downstream consumers (AlertService.listByOwner at line 84, DataEntityService.listAssociated, SearchServiceImpl.search with my_objects=true, ActivityServiceImpl.listMyEvents) all degrade to empty results with HTTP 200, not 401/403/404."

**Description**: The platform's user-onboarding flow REQUIRES an explicit OwnerAssociationRequest from the authenticated user followed by admin approval (`OwnerAssociationRequestServiceImpl.java:54-76`) — there is no auto-create of Owner on first login under any of the 4 UI auth modes. A first-time OAUTH2 user (e.g. authenticated via GitHub OAuth) hits the `/my` tab; the controller calls `dataEntityService.listAssociated(...)` which calls `authIdentityProvider.fetchAssociatedOwner()`; the Mono emits EMPTY because the lookup `WHERE OIDC_USERNAME = 'alice' AND PROVIDER = 'github'` returns no row. Downstream consumers consume the empty Mono via `.flatMap` chains that short-circuit; the response body is `[]` with HTTP 200.

**Failure mode**: The user sees `My Objects` empty, `My Alerts` empty, `MY_OBJECTS` activity feed empty. The UI does NOT surface an "this user has no Owner association — click to request one" prompt. The user believes they have NO catalog access (when in fact they have read-collaborative access per ADR-CANDIDATE-003 but no owner-link). They either (a) ask an admin / hit Slack and get told to use the OwnerAssociationRequest flow, or (b) silently bounce off the catalog and never return. The onboarding step that the platform REQUIRES is invisible at the UI level.

**Primary source citations**:
- `AuthIdentityProviderImpl.java:50-53` (no switchIfEmpty on the empty Mono — silent propagation)
- `OwnerAssociationRequestServiceImpl.java:54-76` (the explicit request flow; not auto-triggered)
- `system-mission.md:251-268` (the user-owner-association feature pillar; explicit "Every ODD Platform user should associate themselves with one of the existing owners" per live owners.md doc)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-049 (identity-decoupled Owner directory CRUD) frames the directory-CRUD-vs-user-claim split — Owner directory is admin-curated; user-Owner links are a separate flow. The ADR is the rationale for NOT auto-creating Owners; the IMPLIED prescription is that operators / UI should make the OwnerAssociationRequest flow discoverable at first-login. The code does not enforce discoverability.

**Proposed remedy**: Two options. (a) **UI-fix**: when `fetchAssociatedOwner` returns empty AND `auth.type ∈ {OAUTH2, LDAP}` AND no pending OwnerAssociationRequest exists for the (username, provider), surface an admonition banner on the platform home page: "Welcome alice — click here to request association with an Owner so you can manage data entities." Pair with a deep-link to the OwnerAssociationRequest form. (b) **Service-fix**: emit a `switchIfEmpty(emptyOwner-sentinel)` from `fetchAssociatedOwner` that downstream consumers can react to (404 + structured error body); the UI then renders the discoverability banner from the structured response. The UI fix alone closes the operator-trap; the service fix improves the API contract for non-UI consumers.

**Severity rationale**: HIGH — user-onboarding security UX gap. New federated users may believe they have no access when they have read-collaborative access (per the platform's posture); the invisible onboarding step is the highest-leverage friction in the OAUTH2/LDAP user journey. Cross-link with REFACTOR-224 (`getMyObjects` returns silent empty Flux for unlinked users — same root cause; this scope is the broader user-journey framing).

**Suggested backlog grouping**: `User onboarding UX sprint` + companion DOC-NNN on the live user-owner-association page (the page should describe the empty-state UX for first-time users explicitly)

---
