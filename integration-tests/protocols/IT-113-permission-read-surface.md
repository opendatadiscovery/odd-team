---
id: IT-113
title: "Permission read surface — contextual (200) vs non-contextual (400 USR001) split + the DISABLED [] divergence"
gates:
  validates: [F-090]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:permission-read-surface.spec.ts"
plan_ref: I1
status: ready
---

# IT-113 — F-090 Permission Read Surface — Contextual vs Non-Contextual Split

## 1. What this checks

The permission read surface is bisected by `PolicyTypeDto.hasContext`, and the OpenAPI enum hides the split.
This pins the contract a third-party integrator must otherwise discover by reading source.

- **H-001:** `GET /api/resource/MANAGEMENT/{id}/permissions` → **400 USR001** `"Resource type MANAGEMENT
  does not have context"` (MANAGEMENT.hasContext=false). A spec-compiled SDK trusting the 4-value
  PermissionResourceType enum (components.yaml:3381-3387) wrongly expects 200 here — the spec/runtime drift.
- **H-002 + H-006:** `GET /api/resource/DATA_ENTITY/{seeded}/permissions` → **200** (contextual half works,
  NOT a 400), with body **`[]`** under DISABLED — the documented UI-vs-API divergence: the contextual READ
  resolves from the policy graph (empty for the unresolved DISABLED principal) while the WRITE API is permitAll.
- **H-001 corner:** TERM and QUERY_EXAMPLE are also contextual (they never raise "does not have context");
  only MANAGEMENT is rejected — the 3-of-4 split.
- **H-003:** the MANAGEMENT-scope permissions live on `GET /api/identity/whoami` → `identity.permissions`
  (the global half). Under DISABLED that carries the full admin set (POLICY_CREATE, OWNER_CREATE, LOOKUP_TABLE_*).

The structural contract (200 vs 400 USR001, and the whoami location of management perms) is
auth-mode-independent and stays GREEN; only the contextual BODY (`[]`) is DISABLED-specific (LSN-029 note).

## 2. Preparation

- **Stack:** `odd-minimal` (auth.type=DISABLED). `ODD_STACK_EXTERNAL=1` to reuse a running stack.
- **Seed:** one DATA_SET data_entity (id 21130, class `{1}`) so the contextual DATA_ENTITY probe resolves an
  existing entity (else 404 USR002). Idempotent; band 21130-21139; name `it113_*`.

## 3. Readiness check

- Health: `curl -fsS http://localhost:18080/actuator/health` → UP
- Seed present: `GET /api/dataentities/21130` → 200.

## 4. Run protocol

1. `GET /api/resource/MANAGEMENT/0/permissions` → 400, body `code=USR001`, message contains
   "does not have context" + "MANAGEMENT".
2. `GET /api/resource/DATA_ENTITY/21130/permissions` → 200, body `[]` (DISABLED contextual divergence).
3. `GET /api/resource/{TERM,QUERY_EXAMPLE}/0/permissions` → body must NOT contain "does not have context".
4. `GET /api/identity/whoami` → `identity.permissions` includes POLICY_CREATE / OWNER_CREATE / LOOKUP_TABLE_CREATE.

**Automated rail:** `ODD_STACK_EXTERNAL=1 integration-tests/run-suite.sh IT-113`.

## 5. Assertions

- **PASS** when: MANAGEMENT → 400 USR001 "does not have context"; DATA_ENTITY → 200 `[]`; TERM/QUERY_EXAMPLE
  never raise the MANAGEMENT rejection; whoami carries the management-scope permissions.
- **FAIL / FLIPS** when: MANAGEMENT returns 200 (the spec was tightened or the discriminator changed —
  re-scope); DATA_ENTITY returns 400 (a contextual type wrongly treated as non-contextual); the contextual
  body is non-empty (NOT DISABLED — re-ground H-006).

## 6. Result log

Appends to `integration-tests/run-log/{YYYY-MM-DD}-IT-113.md`.

## Cross-references
- Source: F-090 H-001/H-002/H-003/H-006; PermissionController.java:19-25; PermissionServiceImpl.java:24-40;
  PolicyTypeDto.java:8-12; components.yaml:3381-3387 (4-value PermissionResourceType enum).
- Plan: `lineage/odd-platform/test-plan.md` batch I1 (auth-mode posture)
- Related: IT-111 (whoami = the global half), F-006 (RBAC write-side complement).
