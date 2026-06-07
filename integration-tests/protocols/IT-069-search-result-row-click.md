---
id: IT-069
title: "Search-result row click — the entire row navigates to /dataentities/{id}/overview"
gates:
  validates: [F-147]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:search-result-row-click.spec.ts"
plan_ref: I9
status: ready
---

# IT-069 — F-147 Search Result Row tile (row onClick → entity overview)

## 1. What this checks

Clicking a search result row navigates to that entity's `/dataentities/{id}/overview` detail page, and the
detail page composes (the clicked entity's name renders on it) (F-147 UC-001). **Operator consequence if it
FAILS:** the platform's second-most-trafficked click surface (search → entity) is broken or lands on the
wrong entity.

## 2. Preparation

- **Stack:** `odd-minimal` (DISABLED). `ODD_STACK_EXTERNAL=1` to reuse a running stack.
- **Seed:** one searchable entity (`seedSearchableEntity`, helpers/db.ts) matching a query term.

## 3. Readiness check

- Health: `curl -fsS http://localhost:18080/actuator/health` → UP
- The row is the click target: `ResultItem.tsx:72-76` — `[data-testid=search-result-item]` with
  `onClick={() => navigate(detailsLink)}`, `detailsLink = dataEntityDetailsPath(id)` → `/dataentities/{id}/overview`.

## 4. Run protocol

1. Seed entity E (id K) matching term T.
2. Browser: open `/search`, type T, Enter; wait for the results GET; confirm E's row renders.
3. Click the row.

**Automated rail:** `ODD_STACK_EXTERNAL=1 integration-tests/run-suite.sh IT-069`.

## 5. Assertions

- **PASS** when: the URL becomes `/dataentities/{K}/overview` AND the Overview renders E's name.
- **FAIL** when: the URL does not navigate, navigates to a different id, or the detail page does not compose.

## 6. Result log

Appends to `integration-tests/run-log/{YYYY-MM-DD}-IT-069.md`.

## Cross-references
- Source: F-147 UC-001 (row click → /overview). Code: `ResultItem.tsx:42,75-76` +
  `dataEntitiesRoutes.ts:66-73` (default path `overview`).
- Plan: `lineage/odd-platform/test-plan.md` batch I9 (UI cross-tier e2e)
