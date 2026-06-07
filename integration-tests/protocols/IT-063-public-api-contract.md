---
id: IT-063
title: "Platform Public API Contract — spec <-> running-platform conformance (does not depend on the hung spec endpoint)"
gates:
  validates: [F-029]
  enforces: []
  regresses: [PLT-141]
test_class: integration
stack: odd-minimal
automation: "e2e:public-api-contract.spec.ts"
plan_ref: I10
status: ready
---

# IT-063 — F-029 Platform Public API Contract (UC-14 + UC-12)

## 1. What this checks

F-029's structural root finding (UC-12) is that there is **zero** end-to-end conformance check between the
4212-line `odd-platform-specification/openapi.yaml` and the running platform — every other drift class
accumulates undefended. IT-042 already covers the Swagger UI shell + pins the hung spec endpoint (PLT-141:
springdoc 2.2.0 × Spring 6.2). This protocol does something **different**: a SPEC→PLATFORM conformance check
that does **not** depend on the hung `/api/v3` spec endpoint. It takes documented GET operations straight from
`openapi.yaml` and asserts the LIVE platform honours them (status + spec-declared response shape).

- **UC-14 (CONFIRMED):** the spec is the path/method authority — documented GETs are served live with their
  spec-declared response field-set: `/api/dataentities/classes` → `DataEntityClassAndTypeDictionary.entity_classes`;
  `/api/dataentities/usage` → `DataEntityUsageInfo.{total_count,unfilled_count,data_entity_classes_info}` (all
  required); `/api/identity/whoami` → `AssociatedOwner.identity` (required).
- **UC-12 (conformance gap, GREEN pin):** paginated lists (`/api/tags`) honour the spec `{items,page_info}`
  envelope **with** the spec-required `page`+`size` params, but return **500 SYS001** when the required params
  are omitted — not the spec-declared 200, and not a typed 400.
- **UC-12 / PLT-141 pin:** the live OpenAPI document still fails to load (no machine-readable contract to
  conform against on a running deployment) — the reason the conformance endpoints must be hand-picked.

**Operator caveat (why pin it):** with no spec↔platform conformance gate, status-code/response-shape drift
ships undetected (F-029 catalogues 14 such drift classes). A consumer that omits a required query param gets an
opaque 500 instead of a 400, and there is no served spec to code-generate a correct client from.

## 2. Preparation

- **Stack:** `odd-minimal` (auth.type=DISABLED — the default; every GET is reachable anon). `ODD_STACK_EXTERNAL=1`
  to reuse a running stack.
- **Seed:** none required — the asserted endpoints return their envelope shape even on an empty catalog.
- **Spec source (read-only ground truth):** `odd-platform-specification/openapi.yaml` + `components.yaml`
  (PageParam/SizeParam `required: true`; the response schemas above).

## 3. Readiness check

- Health: `curl -fsS http://localhost:18080/actuator/health` → UP
- `curl -s 'http://localhost:18080/api/dataentities/classes'` → 200 JSON with `entity_classes`.

## 4. Run protocol

1. `GET /api/dataentities/classes` → 200, body has `entity_classes` (array).
2. `GET /api/dataentities/usage` → 200, body has `total_count`, `unfilled_count`, `data_entity_classes_info`.
3. `GET /api/identity/whoami` → 200, body has `identity`.
4. `GET /api/tags?page=1&size=10` → 200, body has `items` (array) + `page_info`.
5. `GET /api/tags` (no page/size) → 500 with `{"code":"SYS001"}`.
6. `GET /api/v3/swagger-ui.html` (the served OpenAPI document) within an 8s budget → does NOT return an
   `"openapi"`/`"paths"` document (hangs/errors) — PLT-141 pin.

**Automated rail:** `ODD_STACK_EXTERNAL=1 integration-tests/run-suite.sh IT-063`.

## 5. Assertions

- **PASS** when: steps 1-4 return the spec-declared status + top-level field-set; step 5 returns 500/SYS001;
  step 6's spec does not load (PLT-141 still open).
- **FLIPS** when: a documented GET drifts off its spec status/shape (a real conformance regression — investigate);
  OR step 5 starts returning 200/400 (the platform began validating required params — re-scope UC-12); OR step 6's
  spec loads (PLT-141 fixed — **invert** the pin to drive conformance from the live spec).

## 6. Result log

Appends to `integration-tests/run-log/{YYYY-MM-DD}-IT-063.md`.

## Cross-references
- Source: F-029 UC-14 (spec path/method authority — CONFIRMED) + UC-12 (no spec↔platform conformance gate); PLT-141 (hung spec endpoint, shared with IT-042 from the UI-shell angle).
- Spec: `odd-platform-specification/openapi.yaml` (info.title legacy "ProspectLog…" = UC-10) + `components.yaml` (PageParam/SizeParam required).
- Plan: `lineage/odd-platform/test-plan.md` batch I10 (public-API contract + operator-introspection exposure).
