---
id: IT-110
title: "User-owner association home affordance — hidden under auth.type=DISABLED"
gates:
  validates: [F-142]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:user-owner-association-home.spec.ts"
plan_ref: I1
status: ready
---

# IT-110 — User-Owner Association home affordance (F-142)

> A protocol is the source of truth — a human can execute every step below without tooling.

## 1. What this checks
The home page (`Overview.tsx`) renders the OwnerAssociation request card ONLY when
`isShowOwnerAssociation = Boolean(appInfo?.authType && appInfo.authType !== 'DISABLED')`
(`Overview.tsx:25-27`). This IT characterizes the affordance for the current (synthetic admin, unbound)
user on the running `auth.type=DISABLED` stack: the home page renders fully (main search present) but the
OwnerAssociation card (form / pending / declined branches) is NOT shown. It also confirms the precondition
that WOULD show the form on a non-DISABLED posture holds — the synthetic admin is unbound (no
associated owner) — so the result is "eligible-but-hidden", not "hidden-because-already-bound". (Even were
the predicate satisfied, the underlying create POST 500s under DISABLED — PLT-148 / IT-105.) A RED ⇒ the
home affordance started rendering under DISABLED (a deliberate change to reconcile). Source: feature-flow
F-142; `Overview.tsx:25-27,53-58`, `OwnerAssociation.tsx`.

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` (AUTH_TYPE=DISABLED), already running (`ODD_STACK_EXTERNAL=1`).
- **Seed data**: none — the synthetic admin (`whoami` dummyOwner fallback) is unbound on a fresh stack.
  Namespace ids 21100-21109 reserved (unused).

## 3. Readiness check
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`.
- Identity: `curl -s http://localhost:18080/api/identity/whoami` → `identity.username = "admin"`, no `owner`.
- Note: `GET /api/info` returns 500 on this stack (separate defect), which independently forces
  `isShowOwnerAssociation=false` (appInfo undefined). Either path yields the hidden affordance.

## 4. Run protocol
1. SUCCESS/UC-011: open `/`; observe the home page renders (main search visible) AND the OwnerAssociation
   card text surfaces ("Request is being checked" / "association request rejected" / a "Send a request"
   submit) are ALL absent.
2. CORNER: `GET /api/identity/whoami`; confirm `identity.username = "admin"` and no associated `owner`
   (the unbound precondition).

**Automated rail**: `ODD_STACK_EXTERNAL=1 npx playwright test specs/user-owner-association-home.spec.ts`.

## 5. What it checks — assertions
- **UC-011 (PASS):** the home main search is visible AND none of the OwnerAssociation card surfaces render.
- **CORNER (PASS):** whoami returns 200 with `identity.username="admin"` and no associated owner (unbound).

## 6. Result log
- 2026-06-07 — authored; DISABLED-auth home hidden-affordance characterization ground-truth verified live
  (:18080), incl. proof the home page fully renders (not an error page) so the absence is real; 2/2 pass.
  Run via `npx playwright test specs/user-owner-association-home.spec.ts`.
