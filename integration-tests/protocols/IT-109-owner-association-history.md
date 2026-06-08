---
id: IT-109
title: "Owner-Association History tab — resolved requests render with their status badge"
gates:
  validates: [F-174]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:owner-association-history.spec.ts"
plan_ref: I1
status: ready
---

# IT-109 — Owner-Association History tab (F-174)

> A protocol is the source of truth — a human can execute every step below without tooling.

## 1. What this checks
The History tab (`/management/associations/history` →
`GET /api/owner_association_request/activity?status=RESOLVED`) is the only operator-visible audit surface
in the Associations subtree. It renders one row per `owner_association_request_activity` entry with a
status badge (APPROVED → "Approved", DECLINED → "Declined"). This IT verifies a seeded approved AND a
seeded declined activity both appear with the correct status badge (H-004), and that the header search
filters History to the matching requester (H-005). RESOLVED = `activity.status != 'PENDING'`
(`ReactiveOwnerAssociationRequestActivityRepositoryImpl.getConditions` default branch). This is a pure
READ surface — unaffected by the DISABLED-auth write 500 (PLT-148) that breaks the sibling write tabs.
Source: feature-flow F-174; `OwnerAssociationsResolved.tsx`, `RequestStatus.tsx:9-15`;
`OwnerAssociationRequestController.getOwnerAssociationRequestActivityList`.

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` (AUTH_TYPE=DISABLED), already running (`ODD_STACK_EXTERNAL=1`).
- **Seed data**: two resolved entries via `dbQuery` (idempotent): an `owner_association_request`
  (status=APPROVED, owner 21090) + its `owner_association_request_activity` (REQUEST_APPROVED/APPROVED), and
  a declined pair (owner 21091, DECLINED). Namespace ids 21090-21099. (Seeded directly because the write
  paths that would normally produce these are broken under DISABLED — PLT-148.)

## 3. Readiness check
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`.
- Seed present: `SELECT status FROM owner_association_request WHERE owner_id IN (21090,21091);` → APPROVED, DECLINED.
- API: `curl -s 'http://localhost:18080/api/owner_association_request/activity?page=1&size=30&status=RESOLVED'`
  → both entries in `items[]`.

## 4. Run protocol
1. SUCCESS/H-004: open `/management/associations/history`; wait for the activity GET; observe both rows +
   their "Approved"/"Declined" badges.
2. CORNER/H-005: type the approved requester into "Search requests"; wait for the activity GET; observe the
   list narrows to the match (the declined requester is filtered out).

**Automated rail**: `ODD_STACK_EXTERNAL=1 npx playwright test specs/owner-association-history.spec.ts`.

## 5. What it checks — assertions
- **H-004 (PASS):** the approved requester + owner + "Approved" badge render, AND the declined requester +
  owner + "Declined" badge render.
- **H-005 (PASS):** after searching the approved requester, it stays listed and the declined requester is
  filtered out (visible count 0).

## 6. Result log
- 2026-06-07 — authored; History render of approved+declined activity (status badges) + search filter
  ground-truth verified live (:18080), incl. positive+negative controls; 2/2 pass. Run via
  `npx playwright test specs/owner-association-history.spec.ts`.
