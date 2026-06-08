---
id: IT-125
title: "Search deep-link to a non-existent/expired session 500s (not 404) → SPA 'Unknown Error' (PLT-150 pin)"
gates:
  validates: [F-017]
  enforces: []
  regresses: [PLT-150]
test_class: integration
stack: odd-minimal
automation: "e2e:search-session-not-found.spec.ts"
plan_ref: I7
status: ready
---

# IT-125 — F-017 search: deep-link to a non-existent / expired search session

## 1. What this checks
A user who opens a bookmarked/shared `/search/{id}` URL, or returns after the ephemeral search session
is evicted by the housekeeping TTL, hits a session id that no longer exists. CURRENT behaviour (the gap
the happy-path catalog-search spec never exercises — maintainer-found 2026-06-08):
- API `GET /api/search/{missing}/results` → **500 SYS001** (should be 404 — the session is just gone).
- UI `/search/{missing}` → the SPA error boundary shows a generic **"Unknown Error / Return to the Home
  Page"** (should be a graceful "search expired — start a new one"). Source: PLT-150.

## 2. Preparation
- **Stack:** `odd-minimal` (DISABLED). Persistent/reused (`run-suite.sh` manages it; `ODD_STACK_EXTERNAL=1`).
- **Seed:** none — the whole point is a session id that does NOT exist.

## 3. Readiness check
- Health: `curl -fsS http://127.0.0.1:18080/actuator/health` → UP.

## 4. Run protocol
1. `GET /api/search/ffffffff-1125-4125-8125-ffffffffffff/results?page=1&size=30` → 500 `SYS001`.
2. Browser `/search/ffffffff-1125-4125-8125-ffffffffffff` → "Unknown Error" + "Home Page" rendered.

**Automated rail:** `ODD_STACK_EXTERNAL=1 integration-tests/run-suite.sh IT-125`.

## 5. Assertions
- **PASS (now):** the missing-session read returns 500 SYS001; the SPA renders the "Unknown Error" boundary.
- **FLIPS RED (fix landed):** the API returns 404 for a missing session, and/or the SPA renders a graceful
  expired-search state instead of the generic boundary. Re-scope the pin to the fixed contract.

## 6. Result log
Appends to `integration-tests/run-log/{YYYY-MM-DD}-IT-125.md`.

## Cross-references
- Source: PLT-150 (search-session-not-found → 500 + SPA Unknown Error); `SearchServiceImpl.getFacets`
  (no `switchIfEmpty(NotFoundException)`); ControllerAdvice catch-all (same 500-not-4xx class as PLT-143).
- Plan: `lineage/odd-platform/test-plan.md` batch I7 (search/session).
