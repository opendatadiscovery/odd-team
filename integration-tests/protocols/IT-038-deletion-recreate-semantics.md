---
id: IT-038
title: "Deletion semantics — a deleted datasource's name can be re-created (soft-delete is not a unique-constraint landmine)"
gates:
  validates: [F-123]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:deletion-recreate-semantics.spec.ts"
plan_ref: I5
status: ready
---

# IT-038 — F-123 Deletion Semantics Per-Resource Contract

## 1. What this checks

A resource deleted and then re-created with the SAME name must succeed — a soft-deleted row must not
leave a unique-constraint landmine. Verified for DataSource: create → DELETE (204) → re-create same
name+oddrn (200). **Operator consequence if it FAILS:** "name already exists" on a name the operator
just deleted — a data-loss-adjacent dead end. Confirmed live (create 200 → delete 204 → recreate 200).

## 2. Preparation

- **Stack:** `odd-minimal` (DISABLED → permitAll, so the management API is reachable). `ODD_STACK_EXTERNAL=1` to reuse a running stack.
- **Seed:** none — the test creates/deletes its own datasources via `/api/datasources`.

## 3. Readiness check

- Health: `curl -fsS http://localhost:18080/actuator/health` → UP
- `POST /api/datasources {name,oddrn,namespace_name}` → 200 (+ a token in the body)

## 4. Run protocol

1. `POST /api/datasources` (name X, oddrn O) → 200; capture `id`.
2. `DELETE /api/datasources/{id}` → 204.
3. `POST /api/datasources` (same name X, oddrn O) → **200** (re-create succeeds).
4. Effectiveness: create+delete a second datasource, then `GET /api/datasources?page=1&size=1000`
   → its oddrn absent from `items`.

**Automated rail:** `ODD_STACK_EXTERNAL=1 integration-tests/run-suite.sh IT-038`.

## 5. Assertions

- **PASS** when: the post-delete re-create returns 200, and the deleted datasource is absent from the active list.
- **FAIL** when: the re-create 4xx/5xx (soft-deleted-row collision), or the deleted datasource still lists.

## 6. Result log

Appends to `integration-tests/run-log/{YYYY-MM-DD}-IT-038.md`.

## Cross-references
- Source: F-123 UC-1 (per-resource deletion/re-creation contract)
- Plan: `lineage/odd-platform/test-plan.md` batch I5
