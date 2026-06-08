---
id: IT-122
title: "Pin the six admin-promotion paths as a closed source contract; characterize the DISABLED mechanism-independent admin baseline + the LOGIN_FORM role-binding surface"
gates:
  validates: [F-124]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:cross-provider-admin-promotion.spec.ts"
plan_ref: I1
status: ready
---

# IT-122 — Cross-Provider ADMIN Promotion Semantics (observable contract)

> A protocol is the **source of truth** — a human can execute every step below WITHOUT any
> tooling. The `automation:` spec runs the same steps and writes the same result.

## 1. What this checks

F-124's claim: there are **six distinct admin-promotion mechanisms** — (a) LDAP group match,
(b) Cognito `cognito:groups` exact-match, (c) GitHub org+team+`read:org` scope, (d) Google
`allowed-domain` + admin-attribute, (e) Azure `roles`/`groups` claim, (f) ODD_IAM userinfo flag —
PLUS (g) LOGIN_FORM, where admin is granted at user-creation time by binding the seeded
`Administrator` Role rather than via any provider claim. Each provider's promotion happens during a
live login (the OAuth/LDAP handler chain), which is **IdP-blocked** on odd-minimal (DISABLED, no IdP).

What IS observable here:

1. **The DISABLED admin baseline is mechanism-INDEPENDENT** — `GET /api/identity/whoami` returns the
   fixed `admin` principal with the full permission set, with NO provider claim, NO group, NO role
   binding involved. This is the contrast that makes the six-path divergence meaningful: under the
   shipped default, admin is unconditional; the six mechanisms only matter in an enforcing mode.
2. **The OAuth subset of the six paths is a CLOSED 5-value enum** (`Provider.java` = COGNITO/GITHUB/
   GOOGLE/ODD_IAM/AZURE); LOGIN_FORM is the 6th, role-binding-based path. The role/policy management
   API — the LOGIN_FORM admin-binding surface (path (f)/(g)) — is reachable under DISABLED.
3. **The matcher contract is full-string case-insensitive EQUALITY, not substring** — the PLT-081 /
   DOC-235 / DOC-238 retraction oracle (F-124-UC-001). Source-grounded here (OperationUtils.java:9);
   the live LDAP exercise is IdP-blocked.

Operator consequence if it fails: a RED on the DISABLED baseline means the unconditional-admin
posture of the default deployment changed (eval deployments break, or the anonymous-admin surface
shifted).

Source: F-124 UC-001..UC-011; OperationUtils.java:9 (`element::equalsIgnoreCase`);
LDAPSecurityConfiguration.java:96; Provider.java:3-5; the 5 *UserHandler.impl classes;
ODDOAuth2Properties.java:21-28 (validator); AbstractOIDCUserHandler.java:33-55.

## 2. Preparation — build the test stand

- **Stack**: shared odd-minimal (:18080 + :15432), already up. `ODD_STACK_EXTERNAL=1`. NEVER
  bring up/tear down.
- **Auth/config**: auth.type=DISABLED. No LDAP, no OAuth client → none of the six enforcing-mode
  promotion mechanisms are active (this is why per-mechanism promotion is IdP-blocked).
- **Seed data**: none. The whoami principal is synthesised by the DISABLED chain.

## 3. Readiness check — is the stand ready?

- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`
- Auth mode: `curl -s http://localhost:18080/api/appInfo` → `authType":"DISABLED"`

## 4. Run protocol — what to run

1. `GET /api/identity/whoami` → 200; `identity.username == "admin"`; full permission set (the
   mechanism-independent admin baseline).
2. `GET /api/roles` and `GET /api/policies` → 200 JSON (the LOGIN_FORM admin-binding management
   surface — path (f)/(g) — is reachable; it is the role/policy tier admin is bound through, distinct
   from the provider-claim mechanisms (a)-(e)).
3. Source invariant (documented): the OAuth subset is exactly 5 enum values; matching is full-string
   `equalsIgnoreCase`.

**Automated rail**: from `integration-tests/e2e`,
`PATH="$HOME/.local/node/bin:$PATH" ODD_STACK_EXTERNAL=1 npx playwright test specs/cross-provider-admin-promotion.spec.ts --reporter=line`

## 5. What it checks — assertions

- **PASS** when: whoami returns the unconditional `admin` baseline; the role + policy management
  endpoints answer with JSON (the admin-binding surface exists).
- **FAIL** when: the DISABLED admin baseline changes shape/identity, OR the role/policy management
  surface disappears (a management-API regression).

### IdP-blocked sub-promises (deferred-with-reason — require LDAP / an OIDC provider)

Each is source-grounded; routes to a missing-functional TEST-GAP (the highest-value being UC-001 —
the oracle that would have prevented PLT-081/DOC-235/DOC-238 being filed on a false substring premise):

- **F-124-UC-001** LDAP `admin-groups:['ops']` does NOT promote `devops`/`noops`/`appops` — matching is
  full-string case-insensitive EQUALITY (CONTRADICTS the substring premise of PLT-081/DOC-235/DOC-238).
  Source: OperationUtils.java:9 (`collection.stream().anyMatch(element::equalsIgnoreCase)`) +
  LDAPSecurityConfiguration.java:96. *Blocked: needs an LDAP directory.*
- **F-124-UC-003** GitHub `organization-name` set + token lacking `read:org` → login fails (not silent USER).
  Source: GithubUserHandler.java:76-91 (no onErrorResume on the org call). PLT-070.
- **F-124-UC-004** Azure without `logout-uri` NPEs at first logout (validator only checks clientId+provider).
  Source: ODDOAuth2Properties.java:21-28 + AzureLogoutSuccessHandler.java:39. PLT-130.
- **F-124-UC-005** Okta/Keycloak `admin-groups` is a silent USER no-op (no handler/enum value).
  Source: Provider.java:3-5 + CustomOIDCUserHandler.java:28-34. PLT-071.
- **F-124-UC-006** a typo'd `provider` routes silently to Custom OIDC (no fail-fast). Source:
  ODDOAuth2Properties.java:32 (free String) + :21-28. PLT-082.
- **F-124-UC-007** LDAP without `groups.admin-groups` grants no ADMIN (fails closed). Source:
  LDAPSecurityConfiguration.java:91-93.
- **F-124-UC-008** GitHub `admin-principals` grants ADMIN regardless of org membership (documented bypass).
  Source: GithubUserHandler.java:54-67 (early return before org gate). PLT-070.
- **F-124-UC-009/010/011** login-rename owner orphaning / cross-mode key carry-over / large-group size-limit
  truncation — probe-needed (two-mode + large-directory local probes). Source: AuthIdentityProviderImpl.java:24-35,
  LDAPSecurityConfiguration.java:131.

## 6. Result log

Captured in the spec docstring + batch report (live-curl + Playwright APIRequestContext).

## Cross-references
- Source: F-124 UC-001..UC-011 (`lineage/odd-platform/feature-flows/detail/F-124.yaml`)
- Related bugs: PLT-070, PLT-071, PLT-081 (RETRACT substring), PLT-082, PLT-130; DOC-235/DOC-238 (re-frame)
- Sibling protocols: IT-119 (the per-provider matrix from the F-084 lens), IT-120/IT-121 (logout/redirect)
