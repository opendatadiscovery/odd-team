---
id: IT-061
title: "Ingestion batch atomicity — malformed item mid-batch rolls back the whole batch (opaque 500); empty batch is a precise 400"
gates:
  validates: [F-096]
  enforces: []
  regresses: [PLT-045]
test_class: integration
stack: odd-minimal
automation: "e2e:ingestion-batch-atomicity.spec.ts"
plan_ref: I5
status: ready
---

# IT-061 — F-096 Ingestion Batch Atomicity & Error Contract

## 1. What this checks

`POST /ingestion/entities` runs the whole batch (datasource lookup + entity upsert + processor chain +
OTLP export) inside ONE `@ReactiveTransactional` (`IngestionServiceImpl.ingest:66-73`); the response is
binary — 200 or a 5xx/4xx with no per-item breakdown (`Mono<ResponseEntity<Void>>`). IT-035 already
covers duplicate-ODDRN-in-one-payload (500). This protocol exercises a **different** failure — a malformed
item **mid-batch** — plus the empty-batch contract:

- **SUCCESS (H-001 direction):** a 2-item all-valid batch → 200, BOTH entities persisted (atomic commit).
- **CORNER 1 (H-001 rollback + error-contract drift):** a batch `[valid, malformed-no-type]` → **500**
  (opaque `SYS001`), AND the valid sibling is **NOT** persisted. Atomicity is CONFIRMED (no half-applied
  catalog); the ERROR CONTRACT is the drift — the collector author gets an opaque 500 indistinguishable
  from a platform crash, with no indication which item/why. **KNOWN BUG** (F-096 `client_error_surfaces_as_5xx`;
  PLT-045 family). The 500 half is a characterization pin — flips when a malformed-item case maps to 4xx.
- **CORNER 2 (clean contract, CONFIRM):** an empty `items[]` → **400 `USR001`** "Ingestion payload is empty"
  (`IngestionController.postDataEntityList:40-42` `.filter(isNotEmpty).switchIfEmpty(BadUserRequestException)`).
  The one error path with a precise, resolvable client-error contract — pinned against regressing to a
  200-no-op or a 5xx.

**Operator consequence:** ship one bad item in a 100-item batch and you correctly lose the whole batch (no
partial catalog) — but you are told only "500", so you cannot tell "you sent bad data" from "the platform
fell over", and you write blind retry-with-backoff against a permanent error.

## 2. Preparation

- **Stack:** `odd-minimal` (`auth.type=DISABLED`). `ODD_STACK_EXTERNAL=1` reuses a running stack.
- **Auth/config:** DISABLED → anonymous `POST /ingestion/entities` permitted.
- **Seed:** one raw `data_source` row (id 20610, oddrn `//e2e-it061/ds`) so the batch resolves its
  `data_source_oddrn` (via `seedIngestionDataSource`). Idempotent.

## 3. Readiness check

- Health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`
- Seed present: `SELECT 1 FROM data_source WHERE oddrn='//e2e-it061/ds'`.

## 4. Run protocol

1. `POST /ingestion/entities {data_source_oddrn, items:[valid_a, valid_b]}` → 200; both `SELECT … data_entity` rows exist.
2. `POST /ingestion/entities {…, items:[valid_good, {oddrn,name,metadata} /* no type */]}` → 500;
   `SELECT count(*) FROM data_entity WHERE oddrn='…/it061_mixed_good'` → 0 (rolled back).
3. `POST /ingestion/entities {…, items:[]}` → 400, body `{"code":"USR001","message":"Ingestion payload is empty"}`.

**Automated rail:** `ODD_STACK_EXTERNAL=1 integration-tests/run-suite.sh IT-061`
(or `PATH=… ODD_STACK_EXTERNAL=1 npx playwright test specs/ingestion-batch-atomicity.spec.ts`).

## 5. Assertions

- **PASS (current platform)** when: all-valid batch → 200 + both persisted; malformed-mid-batch → 500 AND
  the valid sibling absent (rolled back); empty batch → 400 with code `USR001` and an "empty" message.
- **FLIPS (RED)** when: the malformed-item case stops returning 500 (a 4xx mapping shipped — PLT-045 fixed,
  the desirable hardening), OR the valid sibling of a failed batch becomes persisted (atomicity REGRESSION —
  a true defect), OR the empty batch stops being a precise 400. Distinguish: a 500→4xx flip is good news;
  a sibling-persisted flip is a regression.

## 6. Result log

Appends to `integration-tests/run-log/{YYYY-MM-DD}-IT-061.md`.

## Cross-references
- Source: F-096 H-001 (all-or-nothing rollback, confirmed) + the `client_error_surfaces_as_5xx` facet
  (PLT-045 family) + the empty-payload controller short-circuit.
- Plan: `lineage/odd-platform/test-plan.md` batch I5 (ingestion).
- Related: IT-035 (duplicate-ODDRN-in-payload 500 + atomicity) — this protocol does the malformed-mid-batch
  + empty-batch cases instead.
