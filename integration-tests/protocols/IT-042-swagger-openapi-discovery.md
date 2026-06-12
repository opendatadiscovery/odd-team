---
id: IT-042
title: "Swagger UI / OpenAPI discovery — UI shell + both grouped OpenAPI documents + the rendered definition (locks the #1759/PLT-141 fix)"
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
`/api/v3/api-docs` (302 → the springdoc shell; on 2.8.x that is `/api/v3/swagger-ui/index.html` — the
2.2.0-era `webjars` target is gone) and the OpenAPI **JSON** root is `/api/v3/swagger-ui.html` (bare = the
full un-grouped document, 198 operations; group documents at `/platform-api` (191 ops) and `/ingestion-api`
(7 ops); `/swagger-config` for the UI bootstrap).
This is the test that was MISSING when the 2026-04 Spring 6.2 upgrade silently broke Swagger.

- **Lock:** the Swagger UI shell is served (and is the real springdoc shell, not the SPA `index.html`
  catch-all).
- **Lock (inverted pin — #1759/PLT-141):** both grouped OpenAPI documents load (`openapi` 3.x +
  non-empty `paths`), the swagger-config lists exactly the two definitions, and the **rendered** UI
  shows a loaded definition with operations (no "Failed to load API definition").

**History (LSN-029 flip).** Born 2026-06-04 as a characterization PIN: springdoc 2.2.0 was
binary-incompatible with Spring 6.2.x (`NoSuchMethodError` on `ControllerAdviceBean.<init>(Object)`,
treated as JVM-fatal by reactor → the spec request hung forever; the UI sat on "Failed to load API
definition" on every deployment). The pin was GREEN-while-broken. **2026-06-12 (#1759, CTRIB-008):**
springdoc bumped `2.2.0 → 2.8.17` (the Spring-Boot-3.4.x-declared line per the official matrix) — the
pin INVERTED per its own flip protocol to lock the working state. RED proof: on pre-fix `main` the
group-document fetches time out for exactly the pinned reason. Unit-bucket sibling:
`OpenApiDocsContractTest` (odd-platform CI) asserts the same contract in-process.

## 2. Preparation

- **Stack:** `odd-minimal` (DISABLED — the Swagger surface is anonymously reachable). `ODD_STACK_EXTERNAL=1` to reuse a running stack.
- **Seed:** none — the endpoints are platform-served.

## 3. Readiness check

- Health: `curl -fsS http://localhost:18080/actuator/health` → UP
- UI route real: `curl -i http://localhost:18080/api/v3/api-docs` → 302 (not the SPA 200 HTML)

## 4. Run protocol

1. `GET /api/v3/api-docs` (no-follow) → 302; follow the returned `Location` (springdoc-version-owned —
   `/api/v3/swagger-ui/index.html` on 2.8.x) → 200, body contains "swagger".
2. `GET /api/v3/swagger-ui.html/platform-api` + `/ingestion-api` (8s budget each) → 200, genuine OpenAPI
   documents (`openapi` 3.x — 3.1.0 on springdoc 2.8.x, `paths` non-empty); bare
   `GET /api/v3/swagger-ui.html` → 200 (the full document — it HUNG on 2.2.0);
   `GET /api/v3/swagger-ui.html/swagger-config` → 200, `urls[]` = exactly the two definitions.
3. Browser: `page.goto('/api/v3/api-docs')` → the Swagger UI mounts, a definition title renders,
   operations are listed, and "Failed to load API definition" is absent.

**Automated rail:** `ODD_STACK_EXTERNAL=1 integration-tests/run-suite.sh IT-042`.

## 5. Assertions

- **PASS** when: the UI shell is served (real swagger shell), both group documents + the swagger-config
  load, AND the rendered UI shows the loaded definition.
- **FLIPS (investigate a regression)** when: any group document fails/hangs (a springdoc × Spring binary
  drift recurrence — the #1759 class), the swagger-config loses a definition, or the rendered UI shows
  "Failed to load API definition".

## 6. Result log

Appends to `integration-tests/run-log/{YYYY-MM-DD}-IT-042.md`.

## Cross-references
- Source: F-097 (Swagger discovery); regression-locks PLT-141/#1759 (fixed by CTRIB-008: springdoc
  2.2.0 → 2.8.17); docs recovered in `documentation` PR `docs/recover-swagger-api-reference`, caveat
  migrated on the `release/0.28.0` train (DOC-450).
- Sibling: IT-063 locks the same fix from the contract angle (`it20632`); unit-bucket
  `OpenApiDocsContractTest` in odd-platform CI.
- Plan: `lineage/odd-platform/test-plan.md` batch I10 (API conformance)
