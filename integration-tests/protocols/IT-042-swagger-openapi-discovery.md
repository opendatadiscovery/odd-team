---
id: IT-042
title: "Swagger UI / OpenAPI discovery — UI shell served (lock) + OpenAPI spec fails to load (pins PLT-141)"
gates:
  validates: [F-097]
  enforces: []
  regresses: [PLT-141]
test_class: integration
stack: odd-minimal
automation: "e2e:swagger-openapi-discovery.spec.ts"
plan_ref: I10
status: ready
---

# IT-042 — F-097 Swagger UI / OpenAPI spec discovery

## 1. What this checks

odd-platform ships springdoc-openapi. `application.yml` SWAPS the paths: the Swagger **UI** is at
`/api/v3/api-docs` (302 → the webjars shell) and the OpenAPI **JSON** is at `/api/v3/swagger-ui.html`.
This is the test that was MISSING when the 2026-04 Spring 6.2 upgrade silently broke Swagger.

- **Lock:** the Swagger UI shell is served (and is the real springdoc shell, not the SPA `index.html`
  catch-all).
- **Pin (PLT-141):** the OpenAPI spec request currently **hangs / fails to load** (springdoc 2.2.0 is
  binary-incompatible with Spring 6.2.x → `NoSuchMethodError` on `ControllerAdviceBean`). LSN-029
  characterization pin: GREEN while broken, RED when fixed.

**Operator consequence of the bug:** the live Swagger UI shows "Failed to load API definition" — the
interactive API surface is dead on every current deployment.

## 2. Preparation

- **Stack:** `odd-minimal` (DISABLED — the Swagger surface is anonymously reachable). `ODD_STACK_EXTERNAL=1` to reuse a running stack.
- **Seed:** none — the endpoints are platform-served.

## 3. Readiness check

- Health: `curl -fsS http://localhost:18080/actuator/health` → UP
- UI route real: `curl -i http://localhost:18080/api/v3/api-docs` → 302 (not the SPA 200 HTML)

## 4. Run protocol

1. `GET /api/v3/api-docs` (no-follow) → 302; `GET /api/v3/webjars/swagger-ui/index.html` → 200, body contains "swagger".
2. `GET /api/v3/swagger-ui.html` (the OpenAPI JSON) with an 8s budget → currently **hangs / no document** (PLT-141).

**Automated rail:** `ODD_STACK_EXTERNAL=1 integration-tests/run-suite.sh IT-042`.

## 5. Assertions

- **PASS (today)** when: the UI shell is served (real swagger shell), AND the spec does NOT load (bug reproduced).
- **FLIPS** when: the spec loads (PLT-141 fixed, springdoc → 2.7.x) — invert the pin to assert the spec returns a valid OpenAPI document.

## 6. Result log

Appends to `integration-tests/run-log/{YYYY-MM-DD}-IT-042.md`.

## Cross-references
- Source: F-097 (Swagger discovery); pins PLT-141 (springdoc/Spring spec-hang); docs recovered in `documentation` PR `docs/recover-swagger-api-reference`.
- Plan: `lineage/odd-platform/test-plan.md` batch I10 (API conformance)
