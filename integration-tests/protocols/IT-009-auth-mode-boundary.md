---
id: IT-009
title: "The auth mode decides whether a protected endpoint requires authentication (DISABLED open vs LOGIN_FORM authenticated)"
gates:
  validates: []
  enforces: [ADR-0074]
  regresses: []
test_class: integration
stack: odd-loginform
automation: "e2e:specs/auth-mode-boundary.spec.ts"
plan_ref: "I1 (auth-mode + authz) — Tier-3 foundation; TEST-GAP-778"
status: ready
expected_result: "GREEN — DISABLED leaves a non-whitelisted endpoint anonymously reachable; LOGIN_FORM requires authentication (401/302). A RED here is a real ADR-0074 regression."
---

# IT-009 — auth-mode boundary (ADR-0074)

> **The foundational auth-mode contract** (zero coverage before this): `auth.type`
> selects the `SecurityWebFilterChain`, and that choice decides whether a request needs
> to be authenticated at all. Everything else in the authz story (RBAC, cross-owner
> scoping) sits on top of this. It contrasts the shared odd-minimal (DISABLED) stack
> against a self-managed LOGIN_FORM stack in one run.

## 1. What this checks
`DISABLED` does `anyExchange().permitAll()` — every route is open. Every other mode ends
its chain with `.pathMatchers("/**").authenticated()`, so a non-whitelisted route
requires authentication. PASS = the same endpoint is **open under DISABLED** and
**rejected (401/302) under LOGIN_FORM**.

**Scope honesty (ADR-0074):** LOGIN_FORM proves only the **authentication** boundary — it
grants every credential the ADMIN role and does NOT wire the `AuthorizationCustomizer`
(SECURITY_RULES are inert), so per-user RBAC is a separate tier that needs LDAP
(group→role mapping). This test does not claim to cover RBAC.

**Operator-facing consequence if it FAILS:** if switching `auth.type` away from DISABLED
did not actually start requiring authentication, an operator who "turned on auth" would
still be running wide open — the worst kind of silent security failure. Source: ADR-0074 ·
TEST-GAP-778 · `DisabledAuthSecurityConfiguration.java:16` · `LoginFormSecurityConfiguration.java:57`.

## 2. Preparation — build the test stand
- **Stacks (two):**
  - DISABLED = the shared `odd-minimal` stack (`:18080`), brought up by the e2e global setup.
  - LOGIN_FORM = `odd-loginform` (`lineage/_extractor/probe-stacks/odd-loginform.docker-compose.yml`, platform `:18082`, pg `:15434`, project `oddlf`), brought up/torn down by the spec. `AUTH_TYPE=LOGIN_FORM`, `AUTH_LOGIN_FORM_CREDENTIALS=admin:admin`.
- **Browser toolchain**: Node 18+ (workspace pins 24) → `cd integration-tests/e2e && npm install`. No browser (REST + docker).
- **Run note:** do NOT run this focused with `ODD_STACK_EXTERNAL=1` — that skips the shared odd-minimal (DISABLED) stack this test's first half needs.

## 3. Readiness check — is the stand ready?
- DISABLED platform: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`
- LOGIN_FORM platform: `curl -fsS http://localhost:18082/actuator/health` → `{"status":"UP"}` (health is whitelisted, so it answers without auth).

## 4. Run protocol — what to run
- **Automated rail**: `integration-tests/run-suite.sh I1-auth-mode-authz`
  (or `cd integration-tests/e2e && npx playwright test auth-mode-boundary`).
- **Manual (human-carryable)** — pick a non-whitelisted endpoint with no required params (`/api/dataentities/classes`):
  1. `curl -i http://localhost:18080/api/dataentities/classes` → **200** (DISABLED: open).
  2. `curl -i http://localhost:18082/api/dataentities/classes` → **401 or 302→/login** (LOGIN_FORM: auth required). Do NOT follow redirects (`curl` without `-L`).

## 5. What it checks — assertions
- **PASS** when: DISABLED returns 2xx (open) AND LOGIN_FORM returns non-2xx (401 or 302→/login) for the same endpoint.
- **FAIL (DISABLED side)** when: the DISABLED endpoint is not 2xx — the stand/probe is wrong (e.g. an endpoint that needs query params), not a real signal.
- **FAIL (LOGIN_FORM side)** when: the LOGIN_FORM endpoint returns 2xx — the auth-mode switch failed to enforce authentication (a real ADR-0074 regression).

## 6. Result log
`integration-tests/run-log/{YYYY-MM-DD}-{suite-or-IT}.md`. Log fields:
`date · stack_commit · runner · outcome · evidence (DISABLED status vs LOGIN_FORM status) · notes`.

## Cross-references
- Source: ADR-0074 (pluggable auth modes) · TEST-GAP-778 · `DisabledAuthSecurityConfiguration.java:16` · `LoginFormSecurityConfiguration.java:50,57` · `auth.login-form-credentials`
- Next tier (RBAC, NOT this test): the per-user authz bugs (F-027 H-004 attachment read-openness, F-039 H-001 genai authz, cross-owner reads) need DISTINCT-permission users — only LDAP wires the `AuthorizationCustomizer` + maps groups→roles locally (LOGIN_FORM = everyone ADMIN; OAUTH2 = cloud IdP). A local-LDAP RBAC tier is the follow-on.
- Plan: `lineage/odd-platform/test-plan.md` batch I1 (auth-mode + authz) + Tier-3.
- Automation: `integration-tests/e2e/specs/auth-mode-boundary.spec.ts` (stack `helpers/loginform-stack.ts` + the generic `helpers/stack.ts`).
