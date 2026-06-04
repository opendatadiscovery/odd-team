---
id: IT-045
title: "Stats ingestion input-validation gaps — 500 on empty body, silent-accept of unknown field, out-of-range stored (pins PLT-142)"
gates:
  validates: [F-095]
  enforces: []
  regresses: [PLT-142]
test_class: integration
stack: odd-minimal
automation: "e2e:stats-validation-gaps.spec.ts"
plan_ref: I5
status: ready
---

# IT-045 — F-095 Statistics Ingestion: input-validation gaps (pins PLT-142)

## 1. What this checks

The stats endpoint (`POST /ingestion/entities/datasets/stats`) does NO input validation — three
unverified F-095 promises, all CONTRADICTED, pinned as LSN-029 characterization pins:

- **UC-11:** an empty/`null` body returns **500**, not a clean 4xx.
- **UC-10:** stats for an unknown/typo field ODDRN are **silently accepted (201)** — no failure signal.
- **UC-5:** out-of-range stats (negative counts, inverted min/max) are **stored verbatim** (read-back proves it).

**Operator consequence:** garbage column statistics enter the catalog silently; a typo'd ODDRN is a
no-op with a success response. Each pin flips RED when PLT-142 (input validation) lands.

## 2. Preparation

- **Stack:** `odd-minimal` (DISABLED). `ODD_STACK_EXTERNAL=1` to reuse a running stack.
- **Seed:** a raw `data_source` + a TABLE entity with one TYPE_NUMBER field (for UC-10/UC-5).

## 3. Readiness check

- Health: `curl -fsS http://localhost:18080/actuator/health` → UP
- Stats endpoint live: `POST .../datasets/stats {"items":[]}` → 201

## 4. Run protocol

1. UC-11: `POST .../datasets/stats` with body `''` and `'null'` → **500** each.
2. UC-10: ingest a dataset+field; `POST` stats keyed by a non-existent field ODDRN → **201** (silent).
3. UC-5: `POST` stats `{low_value:100, high_value:1, nulls_count:-5, unique_count:-9}` → 201; `GET
   /api/datasets/{id}/structure` → the field's `number_stats` carries those out-of-range values verbatim.

**Automated rail:** `ODD_STACK_EXTERNAL=1 integration-tests/run-suite.sh IT-045`.

## 5. Assertions

- **PASS (today)** when: empty/null → 500; unknown field → 201; out-of-range stored verbatim (bugs reproduced).
- **FLIPS** when: validation lands (empty→4xx / unknown→4xx-or-warn / out-of-range→reject-or-normalise) — invert the pins.

## 6. Result log

Appends to `integration-tests/run-log/{YYYY-MM-DD}-IT-045.md`.

## Cross-references
- Source: F-095 UC-11 / UC-10 / UC-5; pins PLT-142 (stats endpoint no input validation).
- Plan: `lineage/odd-platform/test-plan.md` batch I5
