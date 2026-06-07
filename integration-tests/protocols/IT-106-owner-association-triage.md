---
id: IT-106
title: "Owner-association triage — Pending tab lists requests; Accept/Reject 500 under DISABLED auth"
gates:
  validates: [F-171]
  enforces: []
  regresses: [PLT-148]
test_class: integration
stack: odd-minimal
automation: "e2e:owner-association-triage.spec.ts"
plan_ref: I1
status: ready
---

# IT-106 — Operator-Facing Owner-Association Triage (F-171)

> A protocol is the source of truth — a human can execute every step below without tooling.

## 1. What this checks
The New-requests tab (`/management/associations/new` → `GET /api/owner_association_request?status=PENDING`)
lists pending requests with per-row Accept/Reject (the operator-USE side of F-075's branch A). This IT
verifies the READ surface renders a seeded PENDING request with its Accept/Reject affordances (H-001), and
characterization-pins that Accept/Reject (`PUT /api/owner_association_request/{id}`) currently **500s and
leaves the request PENDING with no mapping** under `auth.type=DISABLED`, because
`updateOwnerAssociationRequest` resolves the acting user via `getCurrentUser().switchIfEmpty(error)`
(`OwnerAssociationRequestServiceImpl.java:92-93`) and DISABLED installs no security context (**PLT-148**).
A RED on the pins ⇒ the approve/decline path started succeeding (PLT-148 fix). Source: feature-flow F-171;
`NewAssociationRequest.tsx`; `OwnerAssociationRequestServiceImpl.updateOwnerAssociationRequest`.

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` (AUTH_TYPE=DISABLED), already running (`ODD_STACK_EXTERNAL=1`).
- **Seed data**: one PENDING `owner_association_request` for owner 21060 (`dbQuery`, idempotent — clears
  prior request/activity/mapping rows first). Namespace ids 21060-21069. (Seeded directly because the
  normal create path is itself broken under DISABLED — PLT-148.)

## 3. Readiness check
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`.
- Seed present: `SELECT id,status FROM owner_association_request WHERE owner_id=21060;` → one PENDING row.
- API: `curl -s 'http://localhost:18080/api/owner_association_request?page=1&size=30&status=PENDING'` → row present.

## 4. Run protocol
1. SUCCESS/H-001: open `/management/associations/new`; wait for the PENDING list GET; observe the row +
   Accept + Reject buttons.
2. CHARACTERIZATION/H-001: `PUT /api/owner_association_request/{id} {status:APPROVED}`; read back the row +
   `user_owner_mapping`.
3. CHARACTERIZATION/H-002: `PUT .../{id} {status:DECLINED}`; read back the row status.

**Automated rail**: `ODD_STACK_EXTERNAL=1 npx playwright test specs/owner-association-triage.spec.ts`.

## 5. What it checks — assertions
- **H-001 read (PASS):** the pending requester + target owner render AND per-row Accept + Reject buttons are visible.
- **H-001 write (PASS):** Accept returns 500 AND the row stays PENDING (status_updated_by NULL) AND no
  `user_owner_mapping` row was created. (RED ⇒ PLT-148 fixed.)
- **H-002 write (PASS):** Reject returns 500 AND the row stays PENDING.

## 6. Result log
- 2026-06-07 — authored; Pending-list render + DISABLED-auth triage 500 (PLT-148) ground-truth verified
  live (:18080); 3/3 pass. Run via `npx playwright test specs/owner-association-triage.spec.ts`.
