---
id: IT-054
title: "Principal-to-Owner resolution under DISABLED — phantom all-permissions admin with NO owner"
gates:
  validates: [F-011]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:principal-to-owner-resolution.spec.ts"
plan_ref: I1
status: ready
---

# IT-054 — F-011 Principal-to-Owner resolution under DISABLED

## 1. What this checks

F-011 is the per-request chokepoint that resolves the current user to an owner for owner-scoped
reads/writes. Under `auth.type=DISABLED` there is **no authenticated principal**, and two resolution
endpoints DISAGREE — this is the security boundary the pin characterizes:

- **`GET /api/identity/whoami`** substitutes a **synthetic identity**: `username="admin"` + the FULL
  permission enum (~75 perms, every `Permission.values()`) + `owner:null`
  (`IdentityController.java:24-33`, `dummyOwner()` via `.switchIfEmpty`). The SPA renders this as a
  fully-privileged user.
- **`fetchAssociatedOwner()`** (the owner-scoping resolver, `AuthIdentityProviderImpl.java:50-53`)
  short-circuits to `Mono.empty()` at the **principal** step — `getCurrentUser()` is empty under
  DISABLED, so the `user_owner_mapping` SQL never runs. Every owner-scoped surface therefore
  attributes to **nobody**.

The characterization: under DISABLED the "current user" is a phantom **god-mode admin** (all
permissions) bound to **no owner** — full RBAC authority, zero owner identity.

**Operator caveat (why pin it):** a DISABLED deployment reports a fully-privileged `admin` to the UI
with no real identity behind it; owner-scoped views are empty because there is no owner to scope to.
DISABLED is a trusted-network-only posture; this asymmetry (all perms / no owner) is the shape of it.

## 2. Preparation

- **Stack:** `odd-minimal` (`auth.type=DISABLED` — the default). `ODD_STACK_EXTERNAL=1` to reuse.
- **Seed:** the corner test seeds a real owner + an owned entity (id 20540/20541, `it054_` namespace)
  via `dbQuery`, then cleans up. The whoami test needs no seed.

## 3. Readiness check

- Health: `curl -fsS http://localhost:18080/actuator/health` → UP
- `GET /api/identity/whoami` → 200 (anonymously reachable under DISABLED).

## 4. Run protocol

1. `GET /api/identity/whoami` → 200; assert `identity.username == "admin"`, a large permission set
   incl. destructive perms (`DATA_SOURCE_DELETE`, `OWNER_DELETE`, `POLICY_CREATE`, `COLLECTOR_CREATE`),
   `owner == null`, `association_request == null`.
2. Seed an owned entity (entity owned by a real owner via `ownership`). `GET /api/dataentities/my` →
   200 + `[]` — proving `fetchAssociatedOwner` short-circuits at the empty principal before the data
   layer.

**Automated rail:** `ODD_STACK_EXTERNAL=1 npx playwright test specs/principal-to-owner-resolution.spec.ts`.

## 5. Assertions

- **PASS (DISABLED)** when: whoami yields the synthetic all-perms `admin` with `owner:null`; the
  owner-scoped `/my` read returns `[]` even with an owned entity seeded.
- **FLIPS** when: whoami stops synthesising the phantom admin, OR `/my` returns data under DISABLED
  (the resolver started attributing anonymous traffic to an owner — an owner-scoping regression).

## 6. Result log

Appends to `integration-tests/run-log/{YYYY-MM-DD}-IT-054.md`.

## Cross-references
- Source: `IdentityController.java:24-33` (dummy admin), `AuthIdentityProviderImpl.java:24-53`
  (getCurrentUser empty → fetchAssociatedOwner empty), `IdentityServiceImpl.java:36-52`,
  `DataEntityServiceImpl.java:212-216` (listAssociated/listByOwner).
- Feature: `lineage/odd-platform/feature-flows/detail/F-011.yaml`.
- Related: PLT-120 (provider-null cross-mode bleed — the resolver root-cause in enforcing modes);
  memory `reference_odd_platform_auth_modes` (DISABLED = permitAll, no per-user roles).
- Plan: `lineage/odd-platform/test-plan.md` batch I1 (auth-mode posture).
