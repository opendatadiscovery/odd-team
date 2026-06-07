---
id: IT-108
title: "Active-tab Remove — binding lists; DELETE /api/owners/mapping/{owner_id} 500s under DISABLED"
gates:
  validates: [F-173]
  enforces: []
  regresses: [PLT-148, PLT-040]
test_class: integration
stack: odd-minimal
automation: "e2e:remove-user-owner-mapping.spec.ts"
plan_ref: I1
status: ready
---

# IT-108 — Active-tab Remove UserOwnerMapping (F-173)

> A protocol is the source of truth — a human can execute every step below without tooling.

## 1. What this checks
The Active tab (`/management/associations/active` → `GET /api/owner_association_request?status=APPROVED`)
lists each APPROVED request (= a live binding) with a per-row Remove (unbind) behind a ConfirmationDialog;
Remove fires `DELETE /api/owners/mapping/{owner_id}`. This IT verifies the READ surface renders a seeded
APPROVED binding with its Remove affordance (UC-001), and characterization-pins that Remove currently
**500s and leaves the `user_owner_mapping` row live (deleted_at NULL)** under `auth.type=DISABLED` because
`deleteActiveUserOwnerMapping → cancelAssociationByOwnerId → getCurrentUser().switchIfEmpty(error)`
(`OwnerAssociationRequestServiceImpl.java:158-159`) and DISABLED installs no security context (**PLT-148**).
Independently noted: the UI gates Remove on `OWNER_ASSOCIATION_MANAGE` while the backend gates this DELETE
on `OWNER_RELATION_MANAGE` (**PLT-040**); the synthetic admin holds both, so PLT-040 is not the failure
here. RED on the pin ⇒ the unbind path started succeeding (PLT-148 fix). Source: feature-flow F-173;
`ActiveAssociationRequest.tsx`; `OwnerAssociationRequestServiceImpl.deleteActiveUserOwnerMapping`;
`SecurityConstants.java:159-162`.

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` (AUTH_TYPE=DISABLED), already running (`ODD_STACK_EXTERNAL=1`).
- **Seed data**: an APPROVED `owner_association_request` for owner 21080 (so the Active tab lists it) + a
  LIVE `user_owner_mapping` row (owner 21080, deleted_at NULL) the Remove targets. `dbQuery`, idempotent.
  Namespace ids 21080-21089. (Seeded directly because the create paths are themselves broken under DISABLED.)

## 3. Readiness check
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`.
- Seed present: `SELECT status FROM owner_association_request WHERE owner_id=21080;` → APPROVED;
  `SELECT deleted_at FROM user_owner_mapping WHERE owner_id=21080;` → NULL (live).

## 4. Run protocol
1. SUCCESS/UC-001: open `/management/associations/active`; wait for the APPROVED list GET; observe the row +
   Remove button.
2. CHARACTERIZATION/UC-001: `DELETE /api/owners/mapping/21080`; read back `user_owner_mapping.deleted_at`.
3. CORNER/UC-003: from the browser, fire the (failing) DELETE; reload the Active tab; observe the row still present.

**Automated rail**: `ODD_STACK_EXTERNAL=1 npx playwright test specs/remove-user-owner-mapping.spec.ts`.

## 5. What it checks — assertions
- **UC-001 read (PASS):** the bound user + owner render AND a per-row Remove button is visible.
- **UC-001 write (PASS):** Remove returns 500 AND the binding row still exists with `deleted_at` NULL (not
  soft-deleted). (RED ⇒ PLT-148 fixed.)
- **UC-003 (PASS):** after a failed Remove, the binding is still listed in the Active tab.

## 6. Result log
- 2026-06-07 — authored; Active-tab render + DISABLED-auth unbind 500 (PLT-148) ground-truth verified live
  (:18080); 3/3 pass. PLT-040 UI/backend gate mismatch noted (masked by all-perms admin). Run via
  `npx playwright test specs/remove-user-owner-mapping.spec.ts`.
