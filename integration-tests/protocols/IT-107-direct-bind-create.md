---
id: IT-107
title: "Admin direct-bind — Create-association affordance renders; POST /api/owners/mapping 500s under DISABLED"
gates:
  validates: [F-172]
  enforces: []
  regresses: [PLT-148]
test_class: integration
stack: odd-minimal
automation: "e2e:direct-bind-create.spec.ts"
plan_ref: I1
status: ready
---

# IT-107 — Admin Direct-Bind UserOwnerMapping Create (F-172)

> A protocol is the source of truth — a human can execute every step below without tooling.

## 1. What this checks
The Associations header exposes a "+ Create association" button (behind `OWNER_RELATION_MANAGE`) that opens
the `OwnerAssociationForm` modal (Owner / User / Provider); submit fires
`POST /api/owners/mapping {ownerId, oidcUsername, provider}` — Branch C, a direct user_owner_mapping write.
This IT verifies the affordance renders and the modal opens (READ/UI, H-001), the Owner field is an
existing-owner picker so no owner can be minted from this form (H-002 positive), and
characterization-pins that the bind currently **500s and writes nothing** under `auth.type=DISABLED`
because `createManualAssociationRequest` resolves the acting user via `getCurrentUser().switchIfEmpty(error)`
(`OwnerAssociationRequestServiceImpl.java:134-135`, and `:158-159`) and DISABLED installs no security
context (**PLT-148**). RED on the pin ⇒ the bind path started succeeding (PLT-148 fix). Source: feature-flow
F-172; `OwnerAssociationsHeader.tsx:29-39`, `OwnerAssociationForm.tsx`;
`OwnerAssociationRequestServiceImpl.createUserOwnerMapping`; `SecurityConstants.java:155-158`.

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` (AUTH_TYPE=DISABLED), already running (`ODD_STACK_EXTERNAL=1`).
- **Seed data**: an existing owner (id 21070) via `dbQuery`; clear prior mapping/request/activity rows for
  it + the bind username. Namespace ids 21070-21079.

## 3. Readiness check
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`.
- Seed present: `SELECT name FROM owner WHERE id=21070;` → `it107_owner`.

## 4. Run protocol
1. SUCCESS/H-001: open `/management/associations/new`; observe the "Create association" button; click it;
   observe the modal (User field + Save button).
2. CHARACTERIZATION/H-001: `POST /api/owners/mapping {ownerId:21070, oidcUsername:"it107_bind_user",
   provider:"github"}`; read back `user_owner_mapping` + `owner_association_request` for owner 21070.
3. CORNER/H-002: open the modal; confirm the Owner field is a combobox (existing-owner autocomplete), not a
   free-text owner-name input.

**Automated rail**: `ODD_STACK_EXTERNAL=1 npx playwright test specs/direct-bind-create.spec.ts`.

## 5. What it checks — assertions
- **H-001 UI (PASS):** the "Create association" button is visible AND clicking it opens the modal (User field + Save).
- **H-001 write (PASS):** the POST returns 500 AND no `user_owner_mapping` AND no `owner_association_request`
  row exists for owner 21070. (RED ⇒ PLT-148 fixed.)
- **H-002 (PASS):** the Owner field renders as a combobox (no-mint design).

## 6. Result log
- 2026-06-07 — authored; Create-association affordance/modal + DISABLED-auth direct-bind 500 (PLT-148)
  ground-truth verified live (:18080); 3/3 pass. Run via `npx playwright test specs/direct-bind-create.spec.ts`.
