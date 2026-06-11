---
id: IT-125
title: "Search deep-link to a non-existent/expired session: uniform 404 + graceful expired state + session restore (#1760 fixed contract)"
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

A user who opens a bookmarked/shared `/search/{id}` URL, or returns after the ephemeral search
session is evicted by the housekeeping TTL. FIXED contract (#1760 / CTRIB-005, re-grounded
2026-06-11 per LSN-029):

- **API uniformity:** every read of a missing session — facets `GET /api/search/{id}`, results
  `…/results`, filters `…/facet/{type}` — returns **404 USR002** "Search not found".
- **Advice pass-through (also #1761's class):** an unrouted `/api` path keeps the framework's
  **404** (`NoResourceFoundException`); an invalid `facet_type` enum keeps its **400 USR001**
  (`ServerWebInputException`). Pre-fix both were swallowed into 500 SYS001 by the
  `ControllerAdvice` catch-all.
- **Deep-links restore the session:** `/search/{id}` and `/termsearch/{id}` actually fetch the
  deep-linked session (the #1551 router refactoring mounted `/search/*` splats, so
  `params.searchId` was `undefined` for ~2.5 years and every cold deep-link silently created a
  replacement empty search).
- **Graceful expiry:** a dead link renders "This search has expired" + a **Start new search**
  recovery (asserted to the new-session URL, NOT the results list — deliberately independent of
  PLT-147/#1755 seed residue, which is what made the ORIGINAL "Unknown Error" pin
  order-dependent: it FAILED on a fresh pre-fix stack, run-log 2026-06-11).

## 2. Preparation

- **Stack:** `odd-minimal` (DISABLED). Persistent/reused (`run-suite.sh` manages it).
- **Seed:** none. The valid-session cases create their own search sessions via the API at
  test time (a query string needs no entities); the missing-session id is a never-existing UUID.

## 3. Readiness check

- Health: `curl -fsS http://127.0.0.1:18080/actuator/health` → UP.

## 4. Run protocol

1. API: `GET /api/search/{missing}` + `…/results` + `…/facet/TAGS` → all 404 USR002.
2. API: `GET /api/search/{missing}/filters/entityClasses` (unrouted) → 404 USR002;
   `GET /api/search/{missing}/facet/entityClasses` (bad enum) → 400 USR001.
3. Browser `/search/{missing}` → "This search has expired" + **Start new search** →
   lands on `/search/{new-id}`, expired state gone.
4. API-create a session with query `it125deeplink` → browser `/search/{id}` →
   `GET /api/search/{id}` fires (200), the query is restored in the search box, and NO
   replacement `POST /api/search` happens.
5. Same restore probe for `/termsearch/{id}`; `/termsearch/{missing}` → the expired state.

**Automated rail:** `ODD_STACK_EXTERNAL=1 integration-tests/run-suite.sh IT-125`.

## 5. Assertions

- **PASS (fix landed):** all five protocol steps hold as written.
- **RED (regression):** any missing-session read 500s; an unrouted/invalid request 500s; a
  deep-link is silently replaced by a new search (a `POST /api/search` fires on cold
  `/search/{id}` navigation); the expired state fails to render or recover.

## 6. Result log

Appends to `integration-tests/run-log/{YYYY-MM-DD}-IT-125.md`.

## Cross-references

- Source: PLT-150 / #1760 (CTRIB-005 re-ground; the issue's original Flux-commit theory was
  falsified live — the real mechanics are the advice catch-all + the #1551 splat route +
  the FE error-unwrap defect, see `contributor/CTRIB-005.md`).
- Siblings: #1761/PLT-143 (the `ServerWebInputException` member of the advice class — its
  required-param surface is unit-pinned in `FrameworkErrorStatusMappingTest`); PLT-147/#1755
  (transformer-mapper NPE — the residue that made the original UX pin nondeterministic).
- Plan: `lineage/odd-platform/test-plan.md` batch I7 (search/session).
