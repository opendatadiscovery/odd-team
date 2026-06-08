---
id: IT-105
title: "User-owner association create (POST /api/owner_association_request) — reachable, but 500s under DISABLED auth"
gates:
  validates: [F-075]
  enforces: []
  regresses: [PLT-148]
test_class: integration
stack: odd-minimal
automation: "e2e:owner-association-request.spec.ts"
plan_ref: I1
status: ready
---

# IT-105 — User-Owner Association request create (F-075)

> A protocol is the source of truth — a human can execute every step below without tooling.

## 1. What this checks
`POST /api/owner_association_request {name}` is the write side of the user-owner association (F-075). It
has NO `SECURITY_RULES` entry, so any caller reaches the controller (H-004); the permission decision is
in-service (DIRECT_OWNER_SYNC → auto-approve+bind, else PENDING request). This IT pins TWO facts on the
running `auth.type=DISABLED` stack: (a) the endpoint is reachable (it fails IN-SERVICE with 500, not 403
at the filter / 404 no-route — H-004), and (b) it currently **500s and writes nothing** because the
service resolves the acting user via `getCurrentUser().switchIfEmpty(error)`
(`OwnerAssociationRequestServiceImpl.java:55-56`) and DISABLED auth installs no security context
(**PLT-148**). If the SUCCESS pin goes RED, the create path started succeeding (the PLT-148 fix landed) —
re-point the test to assert the real auto-approve/PENDING outcome.
Source: feature-flow F-075; `OwnerAssociationRequestController.createOwnerAssociationRequest`;
`SecurityConstants.java:148-162` (no POST rule).

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` (AUTH_TYPE=DISABLED), already running (`ODD_STACK_EXTERNAL=1`).
- **Seed data**: an existing owner (id 21050) via `dbQuery`; clean any prior request/mapping rows for it;
  ensure the brand-new owner name (`it105_brand_new_owner`) does NOT pre-exist. Namespace ids 21050-21059.

## 3. Readiness check
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`.
- Seed present: `SELECT name FROM owner WHERE id=21050;` → `it105_existing_owner`.

## 4. Run protocol
1. CHARACTERIZATION/H-001: `POST /api/owner_association_request {name:"it105_existing_owner"}`; read back
   `owner_association_request` + `user_owner_mapping` for owner 21050.
2. CORNER/H-004: same POST; inspect the status code class (not 404, not 403, = 500).
3. CORNER/H-005: `POST {name:"it105_brand_new_owner"}` (unseen); read back `owner` for that name.

**Automated rail**: `ODD_STACK_EXTERNAL=1 npx playwright test specs/owner-association-request.spec.ts`.

## 5. What it checks — assertions
- **H-001 (PASS):** the POST returns 500 AND no `owner_association_request` row AND no `user_owner_mapping`
  row exists for owner 21050. (RED ⇒ the write path was fixed — PLT-148 closed.)
- **H-004 (PASS):** the POST status is not 404 and not 403, and is 500 (reached the service, failed there).
- **H-005 (PASS):** the unseen owner name is NOT minted (`owner` row absent) by the failed create.

## 6. Result log
- 2026-06-07 — authored; create-endpoint reachability + DISABLED-auth 500 (PLT-148) ground-truth verified
  live (:18080); 3/3 pass. Run via `npx playwright test specs/owner-association-request.spec.ts`.
