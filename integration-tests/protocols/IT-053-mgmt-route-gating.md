---
id: IT-053
title: "Management Section Route Gating — reads bypass authz; under DISABLED mutations do too"
gates:
  validates: [F-105]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:mgmt-route-gating.spec.ts"
plan_ref: I1
status: ready
---

# IT-053 — F-105 Management Section Route Gating (reads bypass authorization)

## 1. What this checks

The Management-section authorization posture at the API tier (the HTTP model the SPA route-gating sits on).
Of the Management surfaces, only the owner-association area is gated at all — `SecurityConstants` has a
`SecurityRule` only on the OAR *pending* list GET (`OWNER_ASSOCIATION_MANAGE`); the UI mirrors this with the
sole `RestrictedRoute` on `/management/associations`. Every other read falls through to `.authenticated()`
(NOT permission-gated). Mutations DO carry `*_CREATE/*_UPDATE/*_DELETE` rules — but the shipped default
`auth.type=DISABLED` (`.anyExchange().permitAll()`) collapses ALL of it: an anonymous caller reaches both
the one gated read AND every gated mutation.

- **H-001 (reads bypass gating):** `GET /api/owner_association_request?...&status=PENDING` — the ONE
  Management read with a `SecurityRule` — is nevertheless served to an anonymous caller under DISABLED
  (200, not 401/403).
- **mutation posture:** `POST /api/tags` (gated by `TAG_CREATE`) succeeds anonymously (200) and the created
  row is then anonymously `DELETE`-able (`TAG_DELETE` → 204, soft-deletes the row).

**Operator caveat:** under DISABLED the entire authorization model is inert — anonymous callers READ the
full admin catalog and MUTATE it. The permission rules only take effect in an enforcing mode
(LOGIN_FORM / OAUTH2 / LDAP). A RED means the DISABLED posture changed.

## 2. Preparation

- **Stack:** `odd-minimal` (auth.type=DISABLED). `ODD_STACK_EXTERNAL=1` to reuse a running stack.
- **Seed (ids 20530–20539):** none required up front; the mutation test creates + deletes its own tag
  (`it053_route_tag`).

## 3. Readiness check

- Health: `curl -fsS http://localhost:18080/actuator/health` → UP
- Auth is DISABLED (the odd-minimal default).

## 4. Run protocol

1. `GET /api/owner_association_request?...&status=PENDING` (no auth) → **200** JSON list (the gated read,
   served anonymously because DISABLED bypasses the `OWNER_ASSOCIATION_MANAGE` rule).
2. `POST /api/tags [{name,important}]` (no auth) → **200** + the created tag id; verify the row exists in DB.
3. `DELETE /api/tags/{id}` (no auth) → **204**; verify no LIVE row remains (`deleted_at` set — soft-delete).

**Automated rail:** `ODD_STACK_EXTERNAL=1 integration-tests/run-suite.sh IT-053`.

## 5. Assertions

- **PASS** when: the gated OAR read returns 200 anonymously; the gated tag create returns 200 + a real DB
  row; the gated tag delete returns 204 + soft-deletes the row.
- **FLIPS** when: any of these returns 401/403 — the DISABLED posture changed (the gate now fires for anon);
  re-confirm against the enforcing-mode contract (IT-009 / IT-010) before treating as a regression.

## 6. Result log

Appends to `integration-tests/run-log/{YYYY-MM-DD}-IT-053.md`.

## Cross-references
- Source: F-105 H-001 (reads not route-gated), H-002 (Associations the lone gated surface). Code:
  `SecurityConstants.java:148-150` (only OAR-pending GET gated; `TAG_CREATE`/`TAG_DELETE` at :138/:141-142),
  `AuthorizationCustomizer.java:29-30` (catch-all), `DisabledAuthSecurityConfiguration.java:13-18` (permitAll).
- Sibling: IT-052 (the ungated-reads posture); IT-009 (auth-mode boundary — the enforcing side); IT-010
  (LDAP RBAC mutation 403). Those carve OUT the read-side bypass; this pins it.
- Plan: `lineage/odd-platform/test-plan.md` batch I1.
