---
id: IT-010
title: "Under LDAP, a non-admin USER is denied a permission-gated admin mutation (SECURITY_RULES enforce)"
gates:
  validates: []
  enforces: [ADR-0002, ADR-0003]
  regresses: []
test_class: integration
stack: odd-ldap
automation: "e2e:specs/ldap-rbac-enforcement.spec.ts"
plan_ref: "I1 (auth-mode + authz) — Tier-3b; the RBAC-enforcement half"
status: ready
expected_result: "GREEN — a non-admin LDAP USER is denied OWNER_DELETE (403). A RED here means SECURITY_RULES stopped enforcing under LDAP (ADR-0002 regression) or LDAP auth broke."
---

# IT-010 — LDAP RBAC enforcement (the authz backbone)

> **The RBAC half of the auth story** (IT-009 was the authentication boundary). It proves
> that under an enforcing mode the centralised path-matcher authorization (ADR-0002)
> actually denies a principal who lacks the required permission. LDAP is the ONLY mode
> that exercises this locally: DISABLED is open; LOGIN_FORM grants every credential ADMIN
> and leaves the AuthorizationCustomizer UNwired (rules inert). There is **no ADMIN
> bypass** — `ReactiveNonContextPermissionAuthorizationManager` resolves permissions from
> policies — so a freshly-authenticated USER with no policies is denied every gated
> mutation.

## 1. What this checks
Log in as a non-admin LDAP user (alice; the stack configures NO admin-groups → USER
role), then attempt a SECURITY_RULES-gated admin mutation (`DELETE /api/owners/{id}`,
requiring `OWNER_DELETE`). PASS = **403** (the AuthorizationCustomizer applied the rule
and denied it). The 403-vs-404 distinction is the enforcement signal: **404 would mean
authz was BYPASSED** (the request reached the controller and the owner simply didn't
exist) — exactly the inert-rules behaviour LOGIN_FORM exhibits.

**Operator-facing consequence if it FAILS:** if SECURITY_RULES stopped enforcing under an
enabled auth mode, every authenticated user would silently have admin powers — the RBAC
the operator configured would be a no-op. Source: ADR-0002 (`AuthorizationCustomizer.java`,
`SecurityConstants.java:143-147` OWNER_DELETE) · ADR-0003 · `ReactiveNonContextPermissionAuthorizationManager.java` (no ADMIN bypass) · `LDAPSecurityConfiguration.java:145`.

## 2. Preparation — build the test stand
- **Stack**: `odd-ldap` (`lineage/_extractor/probe-stacks/odd-ldap.docker-compose.yml`):
  OpenLDAP (`osixia/openldap`) + a one-shot init that seeds `cn=alice,ou=users,dc=example,dc=org`
  (password `alicepassword`) + postgres + the platform with `AUTH_TYPE=LDAP`. Distinct
  ports (platform `:18083`, pg `:15435`, ldap `:1389`) + project `oddldap`. The spec brings
  it up/tears it down. Manually: `docker-compose -p oddldap -f .../odd-ldap.docker-compose.yml up -d`.
- **Key config**: `AUTH_LDAP_DN_PATTERN=cn={0},ou=users` — **relative to** `AUTH_LDAP_BASE=dc=example,dc=org`
  (Spring `BindAuthenticator` appends the base; an absolute pattern doubles the base and
  the bind fails). No `admin-groups` → alice maps to USER.
- **Browser toolchain**: Node 18+ → `cd integration-tests/e2e && npm install`. No browser (REST + docker).
- **Seeding/timing**: the openldap-init seeds alice within ~10s; the platform boots in
  ~15-30s, so alice exists well before the platform is healthy (no race).

## 3. Readiness check — is the stand ready?
- Platform: `curl -fsS http://localhost:18083/actuator/health` → `{"status":"UP"}`
- alice seeded: `docker exec probe-openldap ldapsearch -x -H ldap://localhost:389 -b dc=example,dc=org -D cn=admin,dc=example,dc=org -w adminpassword "(cn=alice)" dn` → 1 entry.
- alice binds: `docker exec probe-openldap ldapwhoami -x -D cn=alice,ou=users,dc=example,dc=org -w alicepassword` → `dn:cn=alice,...`.

## 4. Run protocol — what to run
- **Automated rail**: `integration-tests/run-suite.sh I1-auth-mode-authz`
  (or `cd integration-tests/e2e && ODD_STACK_EXTERNAL=1 npx playwright test ldap-rbac` — self-contained; skips the unused odd-minimal bring-up).
- **Manual (human-carryable)**:
  1. Log in (form, LDAP-validated; keep the session cookie): `curl -s -c cj.txt -X POST http://localhost:18083/login --data-urlencode username=alice --data-urlencode password=alicepassword -D - | grep -i location` → `Location: /` (success; `/login?error` = bind failed).
  2. Authenticated USER attempts an admin mutation: `curl -s -b cj.txt -o /dev/null -w '%{http_code}' -X DELETE http://localhost:18083/api/owners/999999` → **403** (denied). (404 would mean authz bypassed.)

## 5. What it checks — assertions
- **PASS** when: login succeeds (302→/) AND the authenticated USER's `DELETE /api/owners/{id}` returns **403** — SECURITY_RULES enforced.
- **FAIL (regression)** when: the DELETE returns **404** — authz bypassed (rules not applied; the LOGIN_FORM inert-rules behaviour leaking into an enforcing mode), or **204** (succeeded).
- **FAIL (setup)** when: login returns `/login?error` (LDAP bind failed — check the relative dn-pattern + seed) or the DELETE is 302/401 (no session established).

## 6. Result log
`integration-tests/run-log/{YYYY-MM-DD}-{suite-or-IT}.md`. Log fields:
`date · stack_commit · runner · outcome · evidence (login Location; DELETE status) · notes`.

## Cross-references
- Source: ADR-0002 · ADR-0003 · `SecurityConstants.java:143-147` (OWNER_DELETE rule) · `ReactiveNonContextPermissionAuthorizationManager.java` (permission resolution, no ADMIN bypass) · `LDAPSecurityConfiguration.java:62-98,145` (BindAuthenticator + AuthorizationCustomizer wired) · `GrantedAuthorityExtractor.java` (admin-groups → ADMIN else USER)
- Sibling: **IT-009** (the authentication boundary; this is the authorization/RBAC half). LOGIN_FORM cannot show this (rules inert + everyone ADMIN) — only LDAP wires the AuthorizationCustomizer locally.
- Confirmed-but-not-pinned-here authz GAPS (documented postures / need 2 users): attachment read-openness (F-027 H-004 — reads have no SECURITY_RULE → any authenticated USER reads; the read-collaborative posture, ADR-0003), genai no-authz (F-039 H-001 — disabled by default), cross-entity mutation escalation (F-027 H-005 / PLT-086 — needs per-entity ownership).
- Plan: `lineage/odd-platform/test-plan.md` batch I1 (auth-mode + authz) + Tier-3.
- Automation: `integration-tests/e2e/specs/ldap-rbac-enforcement.spec.ts` (stack `helpers/ldap-stack.ts` + generic `helpers/stack.ts`).
