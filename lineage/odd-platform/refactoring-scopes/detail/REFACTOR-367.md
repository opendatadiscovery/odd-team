## REFACTOR-367 — Role name-guard case-sensitivity drift — `RoleServiceImpl.update` uses case-sensitive `.equals(...)` (line 68) while `.delete` uses case-insensitive `.equalsIgnoreCase(...)` (line 82); combined with `.create` missing any name-protection, an operator can CREATE 'administrator' (lowercase), CANNOT DELETE it (matches), CAN UPDATE it (does not match)

**Severity**: MEDIUM
**Category**: case-sensitivity-mismatch (Administrator-name reservation drift; strengthens REFACTOR-189)
**Surfaced by**:
- `ReactiveRoleRepositoryImpl.md:bugs_limitations_corner_cases[DRIFT-FACET-D]` + `ReactiveRoleRepositoryImpl.md:security.known_security_gaps[3]`
- Cross-batch: REFACTOR-189 (batch E — Administrator-name reservation create-vs-update asymmetry)

**Description**: `RoleServiceImpl.update` (line 68) checks `.equals(UserProviderRole.ADMIN.getValue())` — case-sensitive. `RoleServiceImpl.delete` (line 82) checks `.equalsIgnoreCase(role.getName())` — case-insensitive. `RoleServiceImpl.create` (line 51-61) has NO name-protection check at all.

The case-sensitivity asymmetry combined with the create-vs-update asymmetry produces this attack surface:

- (a) Operator (with `ROLE_CREATE` permission) creates a role named `'administrator'` (lowercase). The repository's `role_name_unique` partial index (V0_0_55:42) accepts this because the seeded `'Administrator'` (uppercase) is a different byte string in Postgres.
- (b) Operator CANNOT DELETE the lowercase row — the case-insensitive `.equalsIgnoreCase` matches `'administrator'` ↔ `'Administrator'` and rejects.
- (c) Operator CAN UPDATE the lowercase row's policies — the case-sensitive `.equals` does NOT match `'administrator'` ≠ `'Administrator'`.

**The user can mint a new role named 'administrator' AND attach arbitrary policies to it (including MANAGEMENT/ALL) AND the role survives indefinitely**. Operators viewing the Roles tab see two roles: `'Administrator'` and `'administrator'` (potentially confusing UX).

The case-sensitivity-mismatch is also visible in the cross-action drift:
- DELETE refuses the lowercase role (good — preserves the predefined namespace).
- UPDATE accepts the lowercase role's policy edits (bad — the attacker can grow the role).
- CREATE accepts the lowercase role with attacker-chosen policies (bad — the attacker can mint it in the first place).

**Primary source citations**:
- `RoleServiceImpl.java:51-61` — create with NO name check
- `RoleServiceImpl.java:68` — update with `.equals(...)` case-sensitive
- `RoleServiceImpl.java:82` — delete with `.equalsIgnoreCase(...)` case-insensitive
- `V0_0_55__add_policies_and_roles.sql:42` — partial unique index is case-sensitive (Postgres VARCHAR default)
- Cross-batch: REFACTOR-189 (the original create-vs-update asymmetry primary-source)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-029-037 (the auth-mode family) PRESCRIBES UserProviderRole.ADMIN as a reserved-name protection; REFACTOR-189 documents the create-vs-update asymmetry. This scope is the third dimension — case-sensitivity-mismatch INSIDE the three CRUD methods. The fix:

**Proposed remedy**: Three options:
1. **Unify on case-insensitive** (recommended) — change all three methods (`create`, `update`, `delete`) to use `.equalsIgnoreCase`. Mints, edits, AND deletes of lowercase / mixed-case 'Administrator' all refuse. Aligns with the operator's mental model "Administrator is the reserved name, regardless of case".
2. **Unify on case-sensitive + add normalisation** — normalise role names at write time (lowercase or capitalise). Refuses any byte-different variant. UX trade-off: operators lose case-preservation.
3. **Add a CHECK constraint at the DB layer** — `CHECK (lower(name) != 'administrator' AND lower(name) != 'user')` rejects case-different variants at the DB; the application-side checks remain for explicit error messages.

All three close the gap. Option 1 is the smallest blast radius. Option 3 is the defence-in-depth fix.

Add an integration test:
1. Attempt `POST /api/roles` with `{"name": "administrator"}` — should be REFUSED (HTTP 400 / 409).
2. Attempt `PUT /api/roles/{id}` on the seeded Administrator with `{"policy_ids": [...]}` — should be REFUSED.
3. Attempt `DELETE /api/roles/{id}` on the seeded Administrator — should be REFUSED (already works under .equalsIgnoreCase).

**Severity rationale**: MEDIUM — RBAC reservation-drift; an attacker with `ROLE_CREATE` permission can mint a new role mimicking the seed AND attach arbitrary policies. The privilege-escalation path requires `ROLE_CREATE` (which is itself MANAGEMENT-tier — not casually granted), so the attack requires an already-privileged user. Severity is bounded by that prerequisite; but the same kind of mistake on a less-privileged tier WOULD be HIGH.

**Suggested backlog grouping**: `Authorization audit batch` — pair with REFACTOR-189 (the create-vs-update asymmetry), REFACTOR-188 (no audit on RBAC mutations), REFACTOR-357 (the soft-deleted-policy on Role JOIN).

---
