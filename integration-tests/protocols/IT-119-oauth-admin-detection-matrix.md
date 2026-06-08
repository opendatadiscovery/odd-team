---
id: IT-119
title: "Pin the OAuth per-provider admin-detection contract (config schema + detection logic) observable without an IdP"
gates:
  validates: [F-084]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:oauth-admin-detection-matrix.spec.ts"
plan_ref: I1
status: ready
---

# IT-119 — OAuth Provider Admin-Detection Matrix (observable contract)

> A protocol is the **source of truth** — a human can execute every step below
> WITHOUT any tooling. The `automation:` spec is a convenience rail that runs the
> same steps and writes the same result; it never replaces the protocol.

## 1. What this checks

F-084's claim is that the SAME OAuth config keys (`admin-attribute`, `admin-groups`,
`admin-principals`, `allowed-domain`, `organization-name`) have **divergent semantics
per provider**, and that only 5 providers are enum-recognised. Most of that claim is
about behaviour during a live OAuth login — which is **IdP-blocked** on the odd-minimal
stack (auth.type=DISABLED, no OIDC provider). This protocol pins the part that IS
observable / statically verifiable without an IdP:

1. **The DISABLED identity contract** the SPA actually sits on: `GET /api/identity/whoami`
   returns a fixed `admin` principal with the FULL permission set — i.e. under the shipped
   default there is no per-provider admin *detection* at all; everyone is admin. This is
   the operator-observable baseline against which the OAuth matrix is the *enforcing-mode*
   alternative.
2. **The provider-detection contract is a closed 5-value set** — `Provider.java` enumerates
   exactly `{COGNITO, GITHUB, GOOGLE, ODD_IAM, AZURE}`; `CustomOIDCUserHandler.shouldHandle`
   returns true for ANY value NOT in that set. Pinned as a source invariant (the spec asserts
   the live OAuth-init endpoints are inert under DISABLED, and documents the enum as the
   IdP-blocked-but-source-grounded contract).

Operator consequence if it fails: if the DISABLED `whoami` posture silently changed (e.g.
stopped granting admin, or changed username), every "works out-of-the-box" eval deployment
breaks; if a future change widened the principal, the anonymous-admin surface widened.

Source: F-084 (feature-flows/detail/F-084.yaml); GoogleUserHandler.java:37-64,
GithubUserHandler.java:54-96, AbstractOIDCUserHandler.java:33-55, Provider.java:3-5,
CustomOIDCUserHandler.java:28-34, OperationUtils.java:9.

## 2. Preparation — build the test stand

- **Stack**: the shared odd-minimal stack (platform :18080 + Postgres :15432), already up.
  Reuse it — `ODD_STACK_EXTERNAL=1`. NEVER bring it up/tear it down.
- **Auth/config**: auth.type=DISABLED (odd-minimal shipped default). No OAuth client is
  configured, so NONE of the per-provider `@Conditional` handlers/conditions are active —
  this is exactly why the live admin-promotion path is IdP-blocked.
- **Seed data**: none. The whoami principal is synthesised by the DISABLED chain.

## 3. Readiness check — is the stand ready?

- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`
- Auth mode: `curl -s http://localhost:18080/api/appInfo` → `authType":"DISABLED"`

## 4. Run protocol — what to run

1. `GET /api/identity/whoami` → expect 200 JSON; `identity.username == "admin"`;
   `identity.permissions` is a non-empty array (the full ADMIN permission set).
2. `GET /oauth2/authorization/google` and `/oauth2/authorization/cognito` → expect 200
   `text/html` (the SPA index fallback), NOT a 302 to an external IdP authorize endpoint —
   proving no OAuth client is registered (the live OAuth flow is unreachable here).
3. Source invariant (documented, not executable against the running stack): `Provider.java`
   has exactly 5 values; any 6th provider string routes to `CustomOIDCUserHandler`.

**Automated rail**: from `integration-tests/e2e`,
`PATH="$HOME/.local/node/bin:$PATH" ODD_STACK_EXTERNAL=1 npx playwright test specs/oauth-admin-detection-matrix.spec.ts --reporter=line`

## 5. What it checks — assertions

- **PASS** when: whoami returns the `admin` principal with a non-empty permission set;
  the OAuth-init endpoints return the SPA fallback (no external 302) under DISABLED.
- **FAIL** when: whoami changes shape/identity (widened or broken anonymous fingerprint),
  OR an OAuth-init endpoint unexpectedly redirects to an IdP (config drift on the minimal
  stack).

### IdP-blocked sub-promises (deferred-with-reason — require an OIDC provider)

Cannot be verified on odd-minimal (no IdP); each is **source-grounded** here and routes to
a missing-functional TEST-GAP for a future Keycloak-realm probe:

- **F-084 H-001** Google `admin-principals` (email claim) → ADMIN. Source: GoogleUserHandler.java:56-64
  (adminAttribute defaults to literal `email`, line 31/57-58). *Blocked: needs a Google-shaped ID token.*
- **F-084 H-002** Google `admin-groups` is a **silent no-op** (CONTRADICTED). Source:
  GoogleUserHandler.java:37-73 never calls `getAdminGroups()`; ODDOAuth2Properties.java:48 binds it. Tracked PLT-069.
- **F-084 H-003** GitHub `admin-principals` **bypasses** the `organization-name` org-gate (CONTRADICTED).
  Source: GithubUserHandler.java:54-67 returns ADMIN before the org check at line 68. Tracked PLT-070.
- **F-084 H-004** GHES operators are locked out by the hard-coded `https://api.github.com`. Source:
  GithubUserHandler.java:39. Tracked PLT-070 Thread B.
- **F-084 H-005** `allowed-domain` is honoured ONLY for Google (silent no-op elsewhere). Source:
  OAuthSecurityConfiguration.java:168-175 + GoogleUserHandler.java:50-55. DOC-235.
- **F-084 H-006** Okta/Keycloak `admin-groups` → ADMIN (docs-claimed parity) is FALSE. Source:
  Provider.java:3-5 (5 values) + CustomOIDCUserHandler.java:28-34 (no per-provider mapping; getDefaultGroupsClaim()=null). Tracked PLT-071.
- **F-084 H-007** `admin-groups` / `admin-principals` matching is full-string case-insensitive EQUALITY,
  NOT substring. Source: OperationUtils.java:9 (`element::equalsIgnoreCase`). (Corrects PLT-081's substring premise.)
- **F-084 H-008** a typo'd `provider` value does NOT fail boot (routes to Custom OIDC). Source:
  ODDOAuth2Properties.java:32 (free String) + :21-28 (validator checks only non-empty). Tracked PLT-082.
- **F-084 H-010/H-011** additive principals+groups & deterministic dispatch — base-class providers only;
  Google/GitHub diverge; dispatch is first-match over an unordered list. Source: AbstractOIDCUserHandler.java:33-55,
  OAuthSecurityConfiguration.java:185-197.

## 6. Result log

Run output is captured in the spec's docstring + this batch's report. The probe runtime is not
used (this is a live-curl + Playwright APIRequestContext characterization).

## Cross-references
- Source: F-084 H-001..H-011 (`lineage/odd-platform/feature-flows/detail/F-084.yaml`)
- Related bugs: PLT-069, PLT-070, PLT-071, PLT-081, PLT-082; DOC-235
- Sibling protocols: IT-122 (cross-provider admin promotion), IT-120/IT-121 (logout/redirect)
