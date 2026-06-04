---
id: IT-037
title: "Lineage depth boundary — unset lineage_depth 500s (NPE) instead of the documented default depth"
gates:
  validates: [F-055]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:lineage-depth-boundary.spec.ts"
plan_ref: I6
status: ready
---

# IT-037 — F-055 Lineage Depth Boundary Contract

## 1. What this checks

The downstream lineage endpoint takes an OPTIONAL `lineage_depth`. The live api-reference doc says
"Unset returns the platform's default depth"; the impl binds the param as a primitive `int`, so a
null autoboxes → NPE → **HTTP 500**. The documented unset contract is unimplementable. **Operator
consequence:** the lineage canvas / an API caller that omits depth gets a 500, not a default graph.

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
3. `GET /api/dataentities/{id}/lineage/downstream` (NO depth) → **500** (the pinned bug).

**Automated rail:** `ODD_STACK_EXTERNAL=1 integration-tests/run-suite.sh IT-037`.

## 5. Assertions

- **PASS (today)** when: explicit depth → 200; unset depth → 500 (the bug reproduced — GREEN
  characterization pin per LSN-029).
- **FLIPS / FAIL** when: unset depth returns 200 — the fix landed (Integer + default, or required:true).
  At that point invert the pin to assert the default-depth result.

## 6. Result log

Appends to `integration-tests/run-log/{YYYY-MM-DD}-IT-037.md`.

## Cross-references
- Source: F-055; F-005 probe P-008; DOC-GAP-089; TEST-GAP-279
- Plan: `lineage/odd-platform/test-plan.md` batch I6 (lineage safety)
