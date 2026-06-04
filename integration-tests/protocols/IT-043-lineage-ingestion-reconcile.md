---
id: IT-043
title: "Lineage via ingestion — a transformer establishes input→job→output edges; a partial re-ingest drops the omitted edge"
gates:
  validates: [F-005, F-008]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:lineage-ingestion-reconcile.spec.ts"
plan_ref: I6
status: ready
---

# IT-043 — Lineage via ingestion + UC-13 (lineage-edge half)

## 1. What this checks

A collector that ingests a JOB transformer (`data_transformer.inputs=[A]`, `outputs=[B]`) must produce
the lineage edges `A→job` and `job→B` (verified empirically — two edges, not a collapsed A→B). And the
edge half of F-008-UC-13: re-ingesting the job with `outputs=[]` **removes** the omitted `job→B` edge
(`replaceLineagePaths` — replace, not merge). **Operator consequence:** a transient/incomplete collector
scrape of a job silently drops the missing lineage edges (the LSN-001 silent-loss class, at the edge
level). IT-035 already covered the entity level (omitted ENTITIES survive — non-destructive).

## 2. Preparation

- **Stack:** `odd-minimal` (DISABLED). `ODD_STACK_EXTERNAL=1` to reuse a running stack.
- **Seed:** a raw `data_source`; entities A, B (TABLE) + a JOB transformer T are created by the ingestion POST.

## 3. Readiness check

- Health: `curl -fsS http://localhost:18080/actuator/health` → UP
- Ingest works: `POST /ingestion/entities` → 200

## 4. Run protocol

1. `POST /ingestion/entities` items = [TABLE A, TABLE B, JOB T{inputs:[A], outputs:[B]}] → 200.
2. `SELECT … FROM lineage` → edges `A→T` and `T→B` exist.
3. Re-ingest item = [JOB T{inputs:[A], outputs:[]}] → 200; re-query → the `T→B` edge is GONE.

**Automated rail:** `ODD_STACK_EXTERNAL=1 integration-tests/run-suite.sh IT-043`.

## 5. Assertions

- **PASS** when: both edges exist after ingest; the `T→B` edge is removed after the output-less re-ingest.
- **FAIL** when: ingestion produces no lineage edge (lineage broken), or the omitted edge survives (then
  the behaviour is merge, not replace — invert the caveat).

## 6. Result log

Appends to `integration-tests/run-log/{YYYY-MM-DD}-IT-043.md`.

## Cross-references
- Source: F-005 (lineage traversal) + F-008-UC-13 (re-ingest reconciliation, edge half); complements IT-035 (entity half).
- Plan: `lineage/odd-platform/test-plan.md` batch I6 (lineage safety)
- Re-probed with the read-the-config discipline after an earlier wrong "not tractable" dismissal.
