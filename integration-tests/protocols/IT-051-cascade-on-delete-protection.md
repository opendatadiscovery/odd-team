---
id: IT-051
title: "Cross-Management cascade-on-delete protection — a referenced Owner/Namespace/DataSource cannot be deleted"
gates:
  validates: [F-076]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:cascade-on-delete-protection.spec.ts"
plan_ref: I1
status: ready
---

# IT-051 — F-076 Cross-Management cascade-on-delete protection

## 1. What this checks

The shared cascade-on-delete protection across the three Management-tab parents: a parent that still has a
live referent CANNOT be deleted; an unreferenced one CAN (soft-delete). This is the DATA-LOSS-class guard —
the only thing between an operator's Delete click and an orphaned referent row. F-076 sat at 1/12 verified
promises (the protective promise verified only at the unit tier, ZERO e2e). One known-bug pin is included.

- **H-001 (block):** DELETE a referenced DataSource / Namespace / Owner → **400 `USR004`**, and the parent
  row survives (not soft-deleted).
- **H-001 (allow):** DELETE an unreferenced Owner → **204**, and the row is soft-deleted (`deleted_at` set).
- **H-007 (KNOWN BUG pin, LSN-029):** an Owner referenced ONLY by an `owner_association_request` row is
  STILL deleted (204) — the cascade checks 3 legs (termOwnership / ownership / userOwnerMapping) and OMITS
  the OAR leg, orphaning the request row. The test asserts the CURRENT (wrong) behaviour; it flips RED when
  a 4th cascade leg is added (REFACTOR-427).

**Operator caveat:** the on-screen delete dialog implies unconditional permanent deletion, but the real
contract is a guarded soft-delete that can be rejected (USR004). A RED means a parent with live children
became deletable (orphaning rows) or an empty parent stopped being deletable (a teardown regression).

## 2. Preparation

- **Stack:** `odd-minimal` (auth.type=DISABLED — the default). `ODD_STACK_EXTERNAL=1` to reuse a running stack.
- **Seed (ids 20510–20519):** a DataSource + a referencing `data_entity`; a Namespace + a `data_source`
  whose `namespace_id` points at it; an Owner + an `ownership` row; an empty Owner; an Owner + only an
  `owner_association_request` row. NB image schema: `data_entity` has NO `deleted_at` (uses `hollow`/`status`);
  `data_source` / `namespace` / `owner` DO have `deleted_at`.

## 3. Readiness check

- Health: `curl -fsS http://localhost:18080/actuator/health` → UP
- Seed present, e.g. `SELECT 1 FROM data_source WHERE id = 20510`.

## 4. Run protocol

1. `DELETE /api/datasources/20510` (referent: data_entity 20511) → **400**, body `code=USR004`; row still `deleted_at IS NULL`.
2. `DELETE /api/namespaces/20512` (referent: data_source 20513) → **400** `USR004`; row survives.
3. `DELETE /api/owners/20514` (referent: ownership row) → **400** `USR004`; row survives.
4. `DELETE /api/owners/20518` (no referents) → **204**; `owner.deleted_at IS NOT NULL`.
5. `DELETE /api/owners/20519` (referent: only an OAR row) → **204** (KNOWN BUG); the OAR row is orphaned.

**Automated rail:** `ODD_STACK_EXTERNAL=1 integration-tests/run-suite.sh IT-051`.

## 5. Assertions

- **PASS** when: each referenced parent delete returns 400 + `USR004` AND the parent survives; the empty
  Owner delete returns 204 + soft-delete; the OAR-only Owner delete returns 204 + leaves an orphan OAR row.
- **FAIL** when: a referenced parent returns 2xx (cascade-block broke → orphaned referents) or the empty
  Owner stops deleting. The H-007 pin going RED is the fix landing — flip it to assert the block.

## 6. Result log

Appends to `integration-tests/run-log/{YYYY-MM-DD}-IT-051.md`.

## Cross-references
- Source: F-076 H-001 (cascade-block + allowed-delete), H-007 (missing OAR cascade leg). Code:
  `OwnerServiceImpl.java:88-100`, `NamespaceServiceImpl.java:74-90`, `DataSourceServiceImpl.java:87-95`,
  `ControllerAdvice.java:42-46` (CascadeDeleteException → 400), `ErrorCode.CASCADE_DELETE` = `USR004`.
- Refactoring scope: REFACTOR-427 (add the 4th cascade leg for `owner_association_request`).
- Plan: `lineage/odd-platform/test-plan.md` batch I1.
