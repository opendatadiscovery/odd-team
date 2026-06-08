---
id: IT-075
title: "Microservices lineage renders on the uniform Hierarchy canvas — no distinct surface exists"
gates:
  validates: [F-054]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:microservices-lineage.spec.ts"
plan_ref: I6
status: ready
---

# IT-075 — Microservices Lineage (F-054)

> A protocol is the source of truth — a human can execute every step below without tooling.

## 1. What this checks
F-054 was seeded as a "doc-promised DISTINCT pillar surface that has NO code-side anchor." This pins the
REALITY: a MICROSERVICE-class entity (type 13 → class DATA_TRANSFORMER 2, NOT ENTITY_GROUP) routes through
the SAME `/dataentities/{id}/lineage` dispatcher (`isDEG` is false → `<HierarchyLineage/>`) and renders on
the uniform Hierarchy canvas — identical to a Postgres table — with the Hierarchy-only controls ("Show full
names", "Depth", "Expand all nested items") that the DEG branch lacks and that no microservice-specific
surface adds. There is no distinct microservices-lineage component/route/dispatcher branch (config probe:
grep `isMicroservice`/`microservice` over the lineage components + `microservices` over src/routes → 0
hits). Per F-054 scanner-review SR-20260527T1700Z the live doc was UPDATED to acknowledge "same UI surface
as Data Objects Lineage" — so today this is a doc-CONFIRMED uniform surface, not a contradiction. Source:
feature-flow F-054 (UC-1, UC-7).

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` (AUTH_TYPE=DISABLED). Shared stack reused via `ODD_STACK_EXTERNAL=1`.
- **Seed data** (via the INGESTION API — the faithful path; own ids/oddrn `//e2e-it075/`, names `it075_*`):
  two MICROSERVICE entities (`it075_ms`, `it075_down`) with a call edge `ms → down`, ingested through
  `POST /ingestion/entities` (helpers/ingest.ts). Ingestion composes a proper transformer entity the
  detail endpoint can render; a RAW `data_entity` transformer seed 500s on the detail composer (seed
  fidelity, not an F-054 product bug). The auto-assigned id is resolved by oddrn lookup (`entityByOddrn`).

## 3. Readiness check
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`.
- Detail: `curl -s -o /dev/null -w '%{http_code}' http://localhost:18080/api/dataentities/{msId}` → 200.
- API: `curl -s http://localhost:18080/api/dataentities/{msId}/lineage/downstream?lineage_depth=1` →
  200, `downstream.nodes[]` contains `it075_ms` (entity_classes:[DATA_TRANSFORMER], type MICROSERVICE) +
  `it075_down`, edge `ms → down`.

## 4. Run protocol
1. Ingest the two MICROSERVICE entities (assert 200); resolve `msId` by oddrn.
2. UC-1 (render): open `/dataentities/{msId}/lineage`; wait for `GET …/lineage/(up|down)stream`; observe
   the downstream neighbour node.
3. UC-7 (uniform surface): on the same canvas, observe the Hierarchy-only controls "Show full names",
   "Depth", "Expand all nested items".

**Automated rail**: `cd integration-tests/e2e && PATH="$HOME/.local/node/bin:$PATH" ODD_STACK_EXTERNAL=1
npx playwright test specs/microservices-lineage.spec.ts --reporter=line`.

## 5. What it checks — assertions
- **UC-1 (PASS):** the microservice's downstream neighbour (`it075_down`) renders on the lineage canvas.
  (FAIL: absent → microservices do not participate in the uniform graph.)
- **UC-7 (PASS):** the MS root renders AND the three Hierarchy-only controls are present → the microservice
  routed to the standard hierarchy renderer; there is NO distinct microservices-lineage surface. (FAIL: a
  microservice-specific surface/affordance appeared → the uniform-surface contract changed → revisit F-054.)

## 6. Result log
- 2026-06-07 — authored; stack_commit `dd52f520`; runner AI (Claude). Outcome PASS (2/2). Evidence: config
  probe confirmed NO microservice-specific lineage component/route/dispatcher branch; ingested-MS detail
  200 + downstream/upstream 200 + both nodes + the three Hierarchy-only controls render (curl + browser
  probe before asserting). NOTE: a raw `data_entity` transformer seed 500s on the detail composer →
  seeded via ingestion (the faithful path) to avoid mis-pinning a seed-fidelity artifact as an F-054 bug.
