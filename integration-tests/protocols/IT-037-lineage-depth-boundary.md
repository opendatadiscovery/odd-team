---
id: IT-037
title: "Lineage depth boundary — unset lineage_depth returns the default-depth graph (200), not a 500 (#1758 fixed)"
gates:
  validates: [F-055]
  enforces: []
  regresses: [PLT-100]   # #1758 — the unset-depth NPE→500 fix this IT now guards
test_class: integration
stack: odd-minimal
automation: "e2e:lineage-depth-boundary.spec.ts"
plan_ref: I6
status: ready
---

# IT-037 — F-055 Lineage Depth Boundary Contract

## 1. What this checks

The downstream lineage endpoint takes an OPTIONAL `lineage_depth`. The api-reference doc says
"Unset returns the platform's default depth". This was unimplementable until **#1758**: the impl bound
the param as a primitive `int`, so a null autoboxed → NPE → **HTTP 500**. **FIXED in #1758** by
declaring `default: 1` on the parameter in the OpenAPI spec — an omitted `lineage_depth` now binds to 1
and returns the depth-1 graph (200), matching the documented default. This IT regresses the fixed
contract (it was a GREEN @pins of the 500 per LSN-029 until the fix landed).

## 2. Preparation

- **Stack:** `odd-minimal` (DISABLED). `ODD_STACK_EXTERNAL=1` to reuse a running stack.
- **Seed:** one ingested TABLE entity (via the ingestion-API helper).

## 3. Readiness check

- Health: `curl -fsS http://localhost:18080/actuator/health` → UP
- Endpoint live (not SPA fallback): `GET /api/dataentities/{id}/lineage/downstream?lineage_depth=1`
  → `200` with `content-type: application/json`

## 4. Run protocol

1. Ingest one entity `E`; resolve its id.
2. `GET /api/dataentities/{id}/lineage/downstream?lineage_depth=1` → **200** (explicit depth works).
3. `GET /api/dataentities/{id}/lineage/downstream` (NO depth) → **200** (the contract's default depth — #1758 fixed; was a 500 NPE on base).

**Automated rail:** `ODD_STACK_EXTERNAL=1 integration-tests/run-suite.sh IT-037`.

## 5. Assertions

- **PASS** when: explicit depth → 200; unset depth → **200** (the documented default-depth graph —
  #1758 fixed). Re-grounded RED→GREEN per G-C15/LSN-029 when the fix landed (`default: 1` in the spec).
- **RED on `ref:main`** (the surviving RED proof): unset depth → 500 (the NPE) ≠ 200 — so this still
  fails on the pre-fix base, proving it regresses the fix and was not neutered.

## 6. Result log

Appends to `integration-tests/run-log/{YYYY-MM-DD}-IT-037.md`.

## Cross-references
- Source: F-055; F-005 probe P-008; DOC-GAP-089; TEST-GAP-279
- Plan: `lineage/odd-platform/test-plan.md` batch I6 (lineage safety)
