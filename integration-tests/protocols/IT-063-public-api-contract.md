---
id: IT-063
title: "Platform Public API Contract — spec-file <-> running-platform conformance + the live OpenAPI document loads (locks the #1759/PLT-141 fix)"
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
accumulates undefended. IT-042 covers the Swagger UI surface end-to-end. This protocol does something
**different**: a SPEC-FILE→PLATFORM conformance check — documented GET operations straight from
`openapi.yaml` asserted against the LIVE platform (status + spec-declared response shape). It was authored
hand-picked BECAUSE the served OpenAPI document was dead (PLT-141: springdoc 2.2.0 × Spring 6.2 — **fixed
2026-06-12**, #1759/CTRIB-008: springdoc → 2.8.17); step 6 now LOCKS the fixed state from the contract angle.

- **UC-14 (CONFIRMED):** the spec is the path/method authority — documented GETs are served live with their
  spec-declared response field-set: `/api/dataentities/classes` → `DataEntityClassAndTypeDictionary.entity_classes`;
  `/api/dataentities/usage` → `DataEntityUsageInfo.{total_count,unfilled_count,data_entity_classes_info}` (all
  required); `/api/identity/whoami` → `AssociatedOwner.identity` (required).
- **UC-12 (conformance gap, narrowed 2026-06-11):** paginated lists (`/api/tags`) honour the spec
  `{items,page_info}` envelope **with** the spec-required `page`+`size` params; omitting them now returns a
  typed **400 USR001** (the advice pass-through — #1760/#1761, CTRIB-005; was an opaque 500 SYS001). The
  residual gap stays pinned: the spec declares only 200 (no error responses), so even the correct 400 is
  spec-undeclared.
- **UC-12 / PLT-141 lock (inverted pin, 2026-06-12):** the live platform-api OpenAPI document LOADS —
  a machine-readable contract exists on a running deployment. (Driving the whole conformance loop from the
  live document is the follow-up PENDING-F-029-1.)

**Operator caveat (why lock it):** with no spec↔platform conformance gate, status-code/response-shape drift
ships undetected (F-029 catalogues 14 such drift classes). A consumer that omits a required query param gets a
typed 400 (since the #1761-class fix), and — since the #1759 fix — the served document is again available to
code-generate clients from / drive conformance against.

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
5. `GET /api/tags` (no page/size) → 400 with `{"code":"USR001"}` (the advice pass-through — #1760/#1761,
   CTRIB-005; was an opaque 500 SYS001).
6. `GET /api/v3/swagger-ui.html/platform-api` (the served OpenAPI document) within an 8s budget → returns a
   genuine `openapi`+`paths` document — locks the #1759/PLT-141 fix (was the GREEN-while-broken hang pin;
   inverted 2026-06-12).

**Automated rail:** `ODD_STACK_EXTERNAL=1 integration-tests/run-suite.sh IT-063`.

## 5. Assertions

- **PASS** when: steps 1-4 return the spec-declared status + top-level field-set; step 5 returns 400/USR001;
  step 6's document loads (`openapi` + non-empty `paths`).
- **FLIPS (investigate a regression)** when: a documented GET drifts off its spec status/shape; OR step 5
  regresses to an opaque 500 (the #1761 class returning); OR step 6 fails/hangs again (a springdoc × Spring
  binary-drift recurrence — the #1759 class).

## 6. Result log

Appends to `integration-tests/run-log/{YYYY-MM-DD}-IT-063.md`.

## Cross-references
- Source: F-029 UC-14 (spec path/method authority — CONFIRMED) + UC-12 (no spec↔platform conformance gate); regression-locks PLT-141/#1759 (fixed by CTRIB-008: springdoc 2.2.0 → 2.8.17; shared with IT-042 from the UI angle).
- Spec: `odd-platform-specification/openapi.yaml` (info.title legacy "ProspectLog…" = UC-10) + `components.yaml` (PageParam/SizeParam required).
- Plan: `lineage/odd-platform/test-plan.md` batch I10 (public-API contract + operator-introspection exposure).
