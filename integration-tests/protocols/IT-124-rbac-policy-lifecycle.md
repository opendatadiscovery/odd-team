---
id: IT-124
title: "A soft-deleted RBAC policy keeps granting permissions (ghost-grant); only removing the role_to_policy edge revokes"
gates:
  validates: [F-006]
  enforces: [ADR-0002, ADR-0003]
  regresses: [PLT-110]
test_class: integration
stack: odd-ldap
automation: "e2e:rbac-policy-lifecycle.spec.ts"
plan_ref: "I1 (auth-mode + authz) — RBAC policy-lifecycle slice"
status: ready
expected_result: "GREEN — baseline DENIED (403); granted ALLOWED (204); soft-deleted policy STILL ALLOWED (204 — the H-002/PLT-110 ghost-grant); edge-removal DENIED again (403). A RED on the soft-delete leg means the getUserRolesByOwner JOIN gained a deleted_at filter (the PLT-110 fix landed) — flip the pin to assert 403 and close PLT-110."
---

# IT-124 — RBAC policy-grant lifecycle (soft-delete grant persistence)

> **The headline F-006 security pin.** F-006 UC-002 promises "a deleted (soft-deleted)
> policy stops granting permissions on every authorized request." It is **contradicted**:
> a soft-deleted policy whose `role_to_policy` edge survives keeps granting, because the
> authorization hot path (`getUserRolesByOwner`) LEFT-JOINs POLICY with **no
> `policy.deleted_at IS NULL` filter** (`ReactiveUserOwnerMappingRepositoryImpl.java:103-104`).
> The operator sees the policy as gone (`PolicyServiceImpl.list` filters `deleted_at`) while
> the backend keeps granting it. SECURITY-class.

## 1. What this checks
Drive the full grant lifecycle for a concrete principal (alice) and assert the **real authz
outcome** of a SECURITY_RULES-gated mutation (`DELETE /api/owners/{id}`, requiring
`OWNER_DELETE`) at each phase:

| Phase | DB state | Expected | Meaning |
|---|---|---|---|
| A baseline | alice, no policies | **403** | authz DENIED (no-ADMIN-bypass; = IT-010) |
| B grant | alice→owner→role→policy(OWNER_DELETE) | **204** | authz ALLOWED (controller reached; idempotent no-op delete on a non-existent id) |
| C soft-delete | `policy.deleted_at` set, edge intact | **204** | **GHOST-GRANT — the bug** (still granting) |
| D edge removal | `role_to_policy` edge deleted | **403** | correctly revoked (the negative control) |

The 403↔204 flip is the enforcement signal (403 = DENIED; 204 = ALLOWED — request reached
the controller). Permissions are resolved **per request** from the grant chain
(`ReactiveNonContextPermissionAuthorizationManager` → `ManagementPermissionExtractor` →
`PolicyServiceImpl.getCurrentUserPolicies`), so each DB phase takes effect on the next
request with **no re-login** (verified live 2026-06-07).

**Operator-facing consequence:** a soft-deleted policy whose `role_to_policy` edge survives
keeps granting; the management list hides it (operator believes it's revoked) while every
authorized request keeps honoring it. **Reachability (per PLT-110's 2026-05-30 re-scope):**
the UI/API policy-delete is cascade-BLOCKED while the policy is attached to a role
(`PolicyServiceImpl.delete` throws `CascadeDeleteException`), so "delete via UI → silent
grant" is unreachable. The genuine defense-in-depth gap — and what phase C models — is a
**direct `UPDATE policy.deleted_at`** (DB hot-fix / GDPR-erasure / migration) that leaves the
edge intact; the grant-path JOIN then re-grants it. The pin is the JOIN's missing
`deleted_at` filter, not a claim that the cascade-blocked UI delete leaks.
Source: F-006 H-002 · drift `permission_persistence_after_soft_delete` · PLT-110 ·
`ReactiveUserOwnerMappingRepositoryImpl.java:99-114` (the unfiltered JOIN) ·
`PolicyServiceImpl.java:53-60,103-107` (list filters deleted_at; getCurrentUserPolicies does
not) · `SecurityConstants.java:146-147` (OWNER_DELETE rule).

## 2. Preparation — build the test stand
- **Stack**: `odd-ldap` (`lineage/_extractor/probe-stacks/odd-ldap.docker-compose.yml`):
  OpenLDAP (`osixia/openldap`) + a one-shot init that seeds `cn=alice,ou=users,dc=example,dc=org`
  (password `alicepassword`) + postgres + the platform with `AUTH_TYPE=LDAP`. Distinct ports
  (platform `:18083`, **pg `:15435`**, ldap `:1389`) + project `oddldap`. The spec brings it up in
  `beforeAll` and tears it down in `afterAll`. Manually:
  `docker-compose -p oddldap -f .../odd-ldap.docker-compose.yml up -d`.
- **Key config**: `AUTH_LDAP_DN_PATTERN=cn={0},ou=users` — **relative to** `AUTH_LDAP_BASE=dc=example,dc=org`
  (Spring `BindAuthenticator` appends the base). No `admin-groups` → alice maps to USER.
- **Grant chain** (seeded directly in the stack's own Postgres on **:15435**, NOT odd-minimal's :15432):
  `user_owner_mapping(alice, provider=NULL)` → `owner_to_role(owner)` → `role_to_policy(role)` → `policy`.
  `provider` MUST be NULL for an LDAP principal (`AuthIdentityProviderImpl`: only OAuth2 sets a provider).
  Policy JSON granting the gated permission: `{"statements":[{"resource":{"type":"MANAGEMENT"},"permissions":["OWNER_DELETE"]}]}`.
- **Toolchain**: Node 18+ → `cd integration-tests/e2e && npm install` (uses `pg` against :15435).

## 3. Readiness check — is the stand ready?
- Platform: `curl -fsS http://localhost:18083/actuator/health` → `{"status":"UP"}`.
- alice binds: `docker exec probe-openldap ldapwhoami -x -D cn=alice,ou=users,dc=example,dc=org -w alicepassword` → `dn:cn=alice,...`.
- Predefined seed present: `docker exec -i probe-database-ldap psql -U odd-platform -d odd-platform -tAc "SELECT name FROM role"` → `Administrator` + `User`.

## 4. Run protocol — what to run
- **Automated rail**: `cd integration-tests/e2e && PATH=... ODD_STACK_EXTERNAL=1 npx playwright test specs/rbac-policy-lifecycle.spec.ts --reporter=line` (self-contained; manages its own LDAP stack, leaves odd-minimal untouched).
- **Manual (human-carryable)** — `PSQL() { docker exec -i probe-database-ldap psql -U odd-platform -d odd-platform -tAc "$1"; }`:
  1. Login (keep the cookie): `curl -s -c cj.txt -X POST http://localhost:18083/login --data-urlencode username=alice --data-urlencode password=alicepassword -D - | grep -i location` → `Location: /`.
  2. Baseline: `curl -s -b cj.txt -o /dev/null -w '%{http_code}' -X DELETE http://localhost:18083/api/owners/2147483600` → **403**.
  3. Seed grant: `PSQL "INSERT INTO owner(name) VALUES ('it124_owner')"; PSQL "INSERT INTO role(name) VALUES ('it124_role')"; PSQL "INSERT INTO policy(name,policy) VALUES ('it124_policy','{\"statements\":[{\"resource\":{\"type\":\"MANAGEMENT\"},\"permissions\":[\"OWNER_DELETE\"]}]}')"` then (fetch ids and) `INSERT INTO user_owner_mapping(owner_id,oidc_username,provider) VALUES (<oid>,'alice',NULL)`, `owner_to_role(<oid>,<rid>)`, `role_to_policy(<rid>,<pid>)`.
  4. Granted (same cookie): DELETE → **204**.
  5. Soft-delete: `PSQL "UPDATE policy SET deleted_at=now() WHERE name='it124_policy'"`; DELETE → **204** (ghost-grant).
  6. Edge removal: `PSQL "DELETE FROM role_to_policy WHERE policy_id=(SELECT id FROM policy WHERE name='it124_policy')"`; DELETE → **403** (revoked).
  7. Cleanup the `it124_%` rows.

## 5. What it checks — assertions
- **PASS** when: A=403, B=204, C=204 (ghost-grant), D=403.
- **FAIL (PLT-110 fixed → re-scope the pin)** when: C=403 — the `getUserRolesByOwner` JOIN gained a `policy.deleted_at IS NULL` filter (or another revocation-on-soft-delete fix). Flip the pin to assert 403 and close PLT-110.
- **FAIL (authz regression)** when: A=204 (a USER with no policy is allowed → no-ADMIN-bypass broke, ADR-0002) or D=204 (edge removal did not revoke → the grant chain / negative control is broken).
- **FAIL (setup)** when: login returns `/login?error` (bind failed — check the relative dn-pattern + seed) or B=403 (the grant chain did not resolve — check `user_owner_mapping.provider IS NULL` and the owner_to_role/role_to_policy edges).

## 6. Result log
`integration-tests/run-log/{YYYY-MM-DD}-{suite-or-IT}.md`. Log fields:
`date · stack_commit · runner · outcome · evidence (per-phase DELETE status A/B/C/D) · notes`.

## Cross-references
- Source: F-006 (`feature-flows/detail/F-006.yaml` UC-002; `feature-reflections/detail/F-006.yaml` H-002) · `ReactiveUserOwnerMappingRepositoryImpl.java:99-114` (the unfiltered LEFT JOIN to POLICY — the bug locus) · `PolicyServiceImpl.java:53-60` (list filters deleted_at) / `:103-107` (getCurrentUserPolicies → getRolesPolicies) · `RoleServiceImpl.java:95-101` (getCurrentUserRoles) · `ReactiveNonContextPermissionAuthorizationManager.java` (per-request resolution, no ADMIN bypass) · `SecurityConstants.java:146-147` (DELETE /api/owners/{id} → OWNER_DELETE).
- Tracked code bug: **PLT-110** (soft-deleted policy continues to grant; role-side mirror in the same family). Probe candidate P-198.
- Sibling: **IT-010** owns the no-grant denial (alice, no policies → 403) under LDAP; this spec extends it through the full grant→soft-delete→edge-removal lifecycle. **IT-009** owns the authentication boundary.
- Plan: `lineage/odd-platform/test-plan.md` batch I1.
- Automation: `integration-tests/e2e/specs/rbac-policy-lifecycle.spec.ts` (stack `helpers/ldap-stack.ts` + generic `helpers/stack.ts`; talks to the LDAP stack's own pg on :15435).
