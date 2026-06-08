import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import { upLdapStack, downLdapStack, LDAP_BASE_URL, LDAP_USER } from '../helpers/ldap-stack';

/**
 * IT-124 — F-006 Role-Based Access Control: the policy-grant lifecycle (soft-delete with
 * permission-grant PERSISTENCE — the headline F-006 security pin).
 *
 * Protocol: integration-tests/protocols/IT-124-rbac-policy-lifecycle.md
 * Gates: validates F-006 (UC-002 "a deleted (soft-deleted) policy stops granting permissions on
 *        every authorized request" — CONTRADICTED here; characterization-pins the H-002/PLT-110
 *        ghost-grant bug per LSN-029). Enforces, in passing, the no-ADMIN-bypass authz backbone
 *        (ADR-0002/0003) that IT-010 owns.
 *
 * WHY LDAP: LDAP is the ONLY locally-reproducible mode that wires the AuthorizationCustomizer AND
 * gives a real per-user role (alice → USER). DISABLED is open; LOGIN_FORM grants every credential
 * ADMIN and leaves the rules inert. So a real "grant → authorized-action-allowed → revoke" lifecycle
 * for a concrete principal is only observable here.
 *
 * THE GRANT CHAIN (read from source — RoleServiceImpl.getCurrentUserRoles →
 * ReactiveUserOwnerMappingRepositoryImpl.getUserRolesByOwner, :99-114):
 *   user_owner_mapping(alice, provider=NULL)  →  owner_to_role(owner)  →  role_to_policy(role)  →  policy
 * Permissions are resolved PER REQUEST from this chain (ReactiveNonContextPermissionAuthorizationManager
 * → ManagementPermissionExtractor → PolicyServiceImpl.getCurrentUserPolicies), so a DB grant change
 * takes effect on the very next request with NO re-login (verified live 2026-06-07).
 *
 * THE BUG (F-006 H-002 / drift `permission_persistence_after_soft_delete`, tracked PLT-110):
 * getUserRolesByOwner's LEFT JOIN to POLICY (ReactiveUserOwnerMappingRepositoryImpl.java:103-104)
 * has NO `policy.deleted_at IS NULL` predicate. So a soft-deleted policy whose role_to_policy edge
 * survives STILL resolves into the user's permissions. PolicyServiceImpl.list() filters deleted_at —
 * so an operator sees the policy as "gone" — yet the authorization hot path keeps granting it.
 *
 * REACHABILITY (per PLT-110's 2026-05-30 re-scope — important, do not mischaracterize the bug): the
 * UI/API policy-delete is cascade-BLOCKED while the policy is attached to a role
 * (PolicyServiceImpl.delete throws CascadeDeleteException "Policy is attached to a role"), so
 * "delete via UI → silent grant" is unreachable. The genuine, narrower defense-in-depth gap is a
 * soft-delete that does NOT go through that delete path — a direct `UPDATE policy.deleted_at` (DB
 * hot-fix / GDPR-erasure script / data migration) that leaves the edge intact. THIS spec models
 * exactly that reachable path: it sets deleted_at directly in the DB, never via the cascade-blocked
 * API. The pin is the grant-path JOIN omission, not a claim that the UI delete leaks.
 *
 * GROUND TRUTH (probed live 2026-06-07 against this stack, :18083 / pg :15435, AUTH_TYPE=LDAP):
 *   - baseline (alice, no policies):                     DELETE /api/owners/{id} -> 403 (denied; = IT-010)
 *   - after grant (alice→owner→role→policy[OWNER_DELETE]): same DELETE       -> 204 (ALLOWED; authz passed,
 *       the delete is an idempotent no-op on a non-existent id — F-006 batch-P "no NotFound validation")
 *   - after SOFT-DELETE of the policy (edge intact):       same DELETE       -> 204 (GHOST-GRANT — bug)
 *   - after removing the role_to_policy EDGE (real revoke): same DELETE       -> 403 (correctly revoked —
 *       the negative control proving the 204 was the genuine grant, not a fluke)
 * The 403↔204 flip is the enforcement signal: 403 = authz DENIED; 204 = authz ALLOWED (request reached
 * the controller). We assert on those real authz outcomes, never on assumed behaviour.
 *
 * Self-contained: brings up its own OpenLDAP + LDAP-mode platform stack (:18083) in beforeAll, tears
 * it down in afterAll. Talks to the stack's OWN Postgres (:15435) via a local pg Client (the shared
 * db.ts defaults to odd-minimal's :15432). Run with ODD_STACK_EXTERNAL=1.
 *
 * Namespace: ids 21240-21249; names it124_; idempotent (cleans its rows before + after).
 */

// The LDAP stack's Postgres (probe-database-ldap, port 15435 — distinct from odd-minimal's 15432).
const LDAP_DB_URL =
  process.env.ODD_LDAP_DB_URL ?? 'postgresql://odd-platform:odd-platform-password@localhost:15435/odd-platform';

// A SECURITY_RULES-gated MANAGEMENT mutation: DELETE /api/owners/{id} requires OWNER_DELETE
// (SecurityConstants.java:146-147). Same endpoint IT-010 uses for the denied case.
const GATED_DELETE = '/api/owners/2147483600'; // an id that does not exist → 204 when authz allows
const OWNER_NAME = 'it124_owner';
const ROLE_NAME = 'it124_role';
const POLICY_NAME = 'it124_policy';
// Grant exactly the permission the gated action requires (a MANAGEMENT/NO_CONTEXT permission).
const POLICY_JSON = JSON.stringify({
  statements: [{ resource: { type: 'MANAGEMENT' }, permissions: ['OWNER_DELETE'] }],
});

async function withLdapDb<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: LDAP_DB_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

// Remove every it124_ row (FK order: edges → mapping → leaves). Idempotent setup + teardown.
async function cleanGrant(): Promise<void> {
  await withLdapDb(async (c) => {
    await c.query(`DELETE FROM role_to_policy WHERE policy_id IN (SELECT id FROM policy WHERE name LIKE 'it124_%')`);
    await c.query(`DELETE FROM owner_to_role WHERE role_id IN (SELECT id FROM role WHERE name LIKE 'it124_%')`);
    await c.query(`DELETE FROM user_owner_mapping WHERE owner_id IN (SELECT id FROM owner WHERE name LIKE 'it124_%')`);
    await c.query(`DELETE FROM policy WHERE name LIKE 'it124_%'`);
    await c.query(`DELETE FROM role WHERE name LIKE 'it124_%'`);
    await c.query(`DELETE FROM owner WHERE name LIKE 'it124_%'`);
  });
}

// Build alice → owner → role → policy(OWNER_DELETE). provider IS NULL for an LDAP principal
// (AuthIdentityProviderImpl: only OAuth2 sets a provider; LDAP/form users get null).
async function seedGrantChain(): Promise<void> {
  await withLdapDb(async (c) => {
    const ownerId = Number((await c.query(`INSERT INTO owner (name) VALUES ($1) RETURNING id`, [OWNER_NAME])).rows[0].id);
    const roleId = Number((await c.query(`INSERT INTO role (name) VALUES ($1) RETURNING id`, [ROLE_NAME])).rows[0].id);
    const policyId = Number(
      (await c.query(`INSERT INTO policy (name, policy) VALUES ($1, $2) RETURNING id`, [POLICY_NAME, POLICY_JSON]))
        .rows[0].id,
    );
    await c.query(`INSERT INTO user_owner_mapping (owner_id, oidc_username, provider) VALUES ($1, $2, NULL)`, [
      ownerId,
      LDAP_USER.username,
    ]);
    await c.query(`INSERT INTO owner_to_role (owner_id, role_id) VALUES ($1, $2)`, [ownerId, roleId]);
    await c.query(`INSERT INTO role_to_policy (role_id, policy_id) VALUES ($1, $2)`, [roleId, policyId]);
  });
}

// Authenticate alice via LDAP form-login and return the session cookie header for reuse. Permissions
// are resolved per-request, so one login suffices across DB-state phases (no re-login needed).
async function loginAlice(request: import('@playwright/test').APIRequestContext): Promise<string> {
  const login = await request.post(`${LDAP_BASE_URL}/login`, {
    form: { username: LDAP_USER.username, password: LDAP_USER.password },
    maxRedirects: 0,
  });
  expect(login.status(), `LDAP login should 302 (got ${login.status()})`).toBe(302);
  expect(
    login.headers()['location'] ?? '',
    `LDAP login as ${LDAP_USER.username} must SUCCEED (Location -> '/', not /login?error). A /login?error ` +
      `means the bind failed — check the relative dn-pattern (cn={0},ou=users) + seeded credentials.`,
  ).not.toContain('error');
  const setCookie = login.headers()['set-cookie'] ?? '';
  const m = /SESSION=([^;]+)/i.exec(setCookie);
  expect(m, `LDAP login must issue a SESSION cookie; got: ${setCookie}`).not.toBeNull();
  return `SESSION=${(m as RegExpExecArray)[1]}`;
}

test.describe('IT-124 F-006 — RBAC policy-grant lifecycle (soft-delete grant persistence)', () => {
  test.beforeAll(async () => {
    test.setTimeout(300_000); // openldap + seed + platform (start_period ~30s)
    await upLdapStack();
    await cleanGrant(); // start from a known-empty grant state
  });

  test.afterAll(async () => {
    test.setTimeout(120_000);
    try {
      await cleanGrant();
    } catch {
      /* the stack may already be torn down on failure; teardown -v wipes the volume anyway */
    }
    await downLdapStack();
  });

  test('PRIMARY/UC-002: a granted policy ALLOWS the gated action; soft-deleting the policy does NOT revoke it (ghost-grant — H-002/PLT-110)', async ({
    request,
  }) => {
    test.setTimeout(150_000);
    await cleanGrant();
    const cookie = await loginAlice(request);

    // ---- Phase A: baseline — alice has no policies → the gated mutation is DENIED (403) ----
    const baseline = await request.delete(`${LDAP_BASE_URL}${GATED_DELETE}`, {
      headers: { cookie },
      maxRedirects: 0,
    });
    expect(
      baseline.status(),
      `F-006 baseline: a USER with no policies must be DENIED OWNER_DELETE (403) — the no-ADMIN-bypass ` +
        `backbone (ADR-0002/0003, = IT-010). Got ${baseline.status()}. 204 here = already granted ` +
        `(stale state); 302/401 = the session didn't establish.`,
    ).toBe(403);

    // ---- Phase B: grant OWNER_DELETE via alice→owner→role→policy → the action is ALLOWED (204) ----
    await seedGrantChain();
    const granted = await request.delete(`${LDAP_BASE_URL}${GATED_DELETE}`, {
      headers: { cookie }, // SAME session — permissions are resolved per-request from the DB
      maxRedirects: 0,
    });
    expect(
      granted.status(),
      `F-006: once a policy granting OWNER_DELETE is bound through alice's owner→role, the gated DELETE ` +
        `must be ALLOWED — authz passes and the controller runs (the id does not exist, so the idempotent ` +
        `soft-delete is a no-op → 204). Got ${granted.status()}. A 403 means the grant chain did not ` +
        `resolve (check user_owner_mapping.provider IS NULL for LDAP, and the owner_to_role/role_to_policy edges).`,
    ).toBe(204);

    // ---- Phase C: SOFT-DELETE the policy (set deleted_at), leave the role_to_policy edge intact ----
    // Direct UPDATE policy.deleted_at — the REACHABLE path per PLT-110 (the API delete is cascade-blocked
    // while attached; a DB hot-fix / GDPR-erasure / migration soft-deletes without removing the edge).
    // PolicyServiceImpl.list() WOULD hide it (filters deleted_at) — the operator sees it as "gone".
    await withLdapDb(async (c) => {
      const r = await c.query(`UPDATE policy SET deleted_at = now() WHERE name = $1`, [POLICY_NAME]);
      expect(r.rowCount, 'the soft-delete must touch exactly the it124_policy row').toBe(1);
      const edge = await c.query(
        `SELECT 1 FROM role_to_policy rtp JOIN policy p ON rtp.policy_id = p.id WHERE p.name = $1`,
        [POLICY_NAME],
      );
      expect(
        edge.rowCount,
        'precondition: the role_to_policy edge SURVIVES the soft-delete (that surviving edge is what the ' +
          'unfiltered getUserRolesByOwner JOIN re-grants — the bug locus).',
      ).toBe(1);
    });

    // KNOWN BUG (PLT-110, F-006 H-002): the soft-deleted policy STILL grants — getUserRolesByOwner's
    // LEFT JOIN to POLICY (ReactiveUserOwnerMappingRepositoryImpl.java:103-104) has no
    // `policy.deleted_at IS NULL` filter. So the gated DELETE is STILL ALLOWED (204). GREEN now; the
    // moment the JOIN gains a deleted_at filter (the PLT-110 fix), this flips to 403 and RED-flags here.
    const afterSoftDelete = await request.delete(`${LDAP_BASE_URL}${GATED_DELETE}`, {
      headers: { cookie },
      maxRedirects: 0,
    });
    expect(
      afterSoftDelete.status(),
      `KNOWN BUG (F-006 H-002 / PLT-110 — permission_persistence_after_soft_delete): a SOFT-DELETED policy ` +
        `MUST stop granting, but it does NOT — getUserRolesByOwner's LEFT JOIN to POLICY has no ` +
        `deleted_at filter, so alice still holds OWNER_DELETE and the gated DELETE is still ALLOWED (204). ` +
        `Operator-facing harm: PolicyServiceImpl.list hides the policy (operator believes it's revoked) ` +
        `while the authz hot path keeps granting it. Got ${afterSoftDelete.status()}. A 403 here means the ` +
        `JOIN-filter fix landed — flip this pin to assert 403 and close PLT-110.`,
    ).toBe(204);
  });

  test('CORNER/UC-002 (negative control): removing the role_to_policy EDGE DOES revoke the grant (403) — proving the soft-delete 204 is the genuine ghost-grant', async ({
    request,
  }) => {
    test.setTimeout(150_000);
    await cleanGrant();
    const cookie = await loginAlice(request);

    // grant, confirm ALLOWED (204)
    await seedGrantChain();
    const granted = await request.delete(`${LDAP_BASE_URL}${GATED_DELETE}`, { headers: { cookie }, maxRedirects: 0 });
    expect(granted.status(), 'with the grant bound, the gated DELETE is ALLOWED (204)').toBe(204);

    // remove the role_to_policy EDGE (the actual revocation path the service uses on role-update/delete)
    await withLdapDb(async (c) => {
      const r = await c.query(
        `DELETE FROM role_to_policy WHERE policy_id IN (SELECT id FROM policy WHERE name = $1)`,
        [POLICY_NAME],
      );
      expect(r.rowCount, 'the edge removal must delete exactly the it124 role_to_policy edge').toBe(1);
    });

    // Now the policy no longer resolves into alice's permissions → the gated DELETE is DENIED again.
    // This is the CONTRAST that makes the PRIMARY test load-bearing: proper edge-removal revokes (403),
    // soft-delete-only does NOT (204). If THIS returned 204, the grant chain wouldn't be real and the
    // PRIMARY 204 would be meaningless — so this negative control guards the test's own validity.
    const afterEdgeRemoval = await request.delete(`${LDAP_BASE_URL}${GATED_DELETE}`, {
      headers: { cookie },
      maxRedirects: 0,
    });
    expect(
      afterEdgeRemoval.status(),
      `F-006: removing the role_to_policy EDGE (the real revocation path) MUST revoke OWNER_DELETE → the ` +
        `gated DELETE is DENIED (403). Got ${afterEdgeRemoval.status()}. A 204 here would mean the grant ` +
        `was never actually edge-bound — invalidating the PRIMARY test's ghost-grant claim. This contrast ` +
        `(edge-removal revokes; soft-delete does not) is exactly the F-006 H-002 defect shape.`,
    ).toBe(403);
  });
});
