---
id: IT-067
title: "Search-result stale signal — the orange-clock icon renders on a stale result row and not on a fresh one"
gates:
  validates: [F-146]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:search-result-stale-signal.spec.ts"
plan_ref: I9
status: ready
---

# IT-067 — F-146 Search Result Item rendering of the per-entity is_stale signal

## 1. What this checks

A stale entity (last-ingested past the deployment stale-period) renders the orange-clock stale icon on its
Search result row (F-146 UC-1); a fresh entity renders NO icon — the fresh state IS the absence of the icon
(F-146 UC-2). **Operator consequence if it FAILS:** the at-a-glance "this source stopped publishing"
indicator is invisible (or false-positive on fresh rows) in the platform's primary discovery list.

This is the SEARCH-RESULT-LIST rendering surface specifically — distinct from IT-041 (which checks the
`is_stale` field via the entity-detail API). Here we drive the browser and assert the rendered icon.

## 2. Preparation

- **Stack:** `odd-minimal` (DISABLED). `ODD_STACK_EXTERNAL=1` to reuse a running stack.
- **Seed:** two searchable entities sharing a query term (`seedSearchableEntity`) — one aged to 60 days via
  `setEntityLastIngestedDaysAgo(id, 60)` (→ is_stale=true), one at 0 days (→ is_stale=false). The default
  stale-period is active on this image (verified: 60-day-old → is_stale=true).

## 3. Readiness check

- Health: `curl -fsS http://localhost:18080/actuator/health` → UP
- Wire shape: `GET /api/search/{id}/results` items carry `is_stale` (snake_case on the wire).

## 4. Run protocol

1. Seed a STALE entity + a FRESH entity matching term T.
2. Browser: open `/search`, type T, Enter; wait for the results GET; confirm both rows render.
3. Inspect each row's Name cell for the orange-clock `StaleIcon` (an `svg path[fill="#FFAA00"]` —
   MetadataStale.tsx renders `<StaleIcon/>` only when isStale, else null).

**Automated rail:** `ODD_STACK_EXTERNAL=1 integration-tests/run-suite.sh IT-067`.

## 5. Assertions

- **PASS** when: the stale row shows the orange-clock icon AND the fresh row has ZERO such icon.
- **FAIL** when: the stale row has no icon (signal dead) OR the fresh row shows the icon (false positive).

## 6. Result log

Appends to `integration-tests/run-log/{YYYY-MM-DD}-IT-067.md`.

## Cross-references
- Source: F-146 UC-1 (stale row renders icon) + UC-2 (fresh row renders no icon). Predicate:
  `DataEntityStaleDetector.java:13`; render: `ResultItem.tsx:87-90` + `MetadataStale.tsx:20-32`.
- Plan: `lineage/odd-platform/test-plan.md` batch I9 (UI cross-tier e2e)
