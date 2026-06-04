---
id: IT-047
title: "Stats-ingestion tag handling — tags created via stats (anon under DISABLED); a re-push silently drops omitted tags"
gates:
  validates: [F-095]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:stats-tag-handling.spec.ts"
plan_ref: I5
status: ready
---

# IT-047 — F-095 Statistics Ingestion: tag handling (UC-6 + UC-7)

## 1. What this checks

The stats endpoint accepts a per-field `tags` block. Two unverified F-095 promises, both CONTRADICTED
(LSN-029 characterization pins, read-back-confirmed):

- **UC-6:** under DISABLED, tags pushed via stats are created + linked to the field by an ANONYMOUS
  caller (no TAG_CREATE) — the DISABLED open posture extends to tag minting.
- **UC-7:** a re-push OMITTING a previously-sent tag SILENTLY DROPS it (replace, not merge) — the
  producer-tag (EXTERNAL_STATISTICS) replace semantics. **Operator caveat:** a transient/partial scrape
  silently loses field tags. (INTERNAL/UI-curated tags are NOT clobbered — F-095-UC-9.)

## 2. Preparation

- **Stack:** `odd-minimal` (DISABLED). `ODD_STACK_EXTERNAL=1` to reuse a running stack.
- **Seed:** a raw `data_source` + a TABLE entity with one TYPE_NUMBER field.

## 3. Readiness check

- Health: `curl -fsS http://localhost:18080/actuator/health` → UP

## 4. Run protocol

1. Ingest a dataset+field; `POST .../datasets/stats` with the field's `tags:[{name:tagA},{name:tagB}]` → 201.
2. `GET /api/datasets/{id}/structure` → the field's `tags` contains both.
3. Re-push the field stats with `tags:[{name:tagA}]` (omit tagB) → 201; `GET .../structure` → field tags = `[tagA]` (tagB dropped).

**Automated rail:** `ODD_STACK_EXTERNAL=1 integration-tests/run-suite.sh IT-047`.

## 5. Assertions

- **PASS** when: both tags created on the first push; the omitted tag is dropped on the re-push (tagA kept).
- **FLIPS** when: tag minting requires auth (UC-6) or the re-push preserves omitted tags (UC-7) — re-scope the pins.

## 6. Result log

Appends to `integration-tests/run-log/{YYYY-MM-DD}-IT-047.md`.

## Cross-references
- Source: F-095 UC-6 (tag create via stats) + UC-7 (re-push tag reconciliation); complements F-095-UC-9 (INTERNAL tags preserved).
- Plan: `lineage/odd-platform/test-plan.md` batch I5
