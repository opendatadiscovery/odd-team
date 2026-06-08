---
id: IT-066
title: "Exclude-from-search consistency — an exclude_from_search=true entity is hidden from the discovery (search) surface"
gates:
  validates: [F-003]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:popular-entities-ranking.spec.ts"
plan_ref: I9
status: ready
---

# IT-066 — F-003 Popular Entities Ranking / exclude-from-search filter consistency

## 1. What this checks

An entity flagged `data_entity.exclude_from_search=true` is hidden from the user-facing discovery list
surface, while a normal entity matching the same query is shown (F-003 UC-004). **Operator consequence if
it FAILS:** an entity an operator explicitly marked internal/staging leaks into discovery — the hide
control is a lie.

**Scope note (important).** F-003 documents that `exclude_from_search` is applied INCONSISTENTLY across
9 list-shape surfaces: the catalog SEARCH path (`findByState` via `JooqFTSHelper.resultFacetStateConditions`,
line 149) DOES apply it; the Popular CTE (`cteDataEntitySelect`, `ReactiveDataEntityRepositoryImpl.java:909-939`)
does NOT (the leak pinned by probe P-006). The Popular column itself is NOT browser-reachable on this
deployment: `Overview.tsx:25-27` gates the Recommended panel behind `authType !== 'DISABLED'`, and the engine
runs DISABLED auth (F-003-UC-009, confirmed). So the discovery surface a browser CAN drive here is `/search`.
This protocol pins the CORRECT half (search honors the flag); the Popular-CTE leak remains pinned at the
repository layer by probe P-006 and is not browser-reproducible under DISABLED.

## 2. Preparation

- **Stack:** `odd-minimal` (DISABLED). `ODD_STACK_EXTERNAL=1` to reuse a running stack.
- **Seed:** two searchable entities sharing a query term (`seedSearchableEntity`, helpers/db.ts) — one
  normal, one with `exclude_from_search=true` (set via `dbQuery` on the test's own id; no named helper, and
  db.ts must not be edited).

## 3. Readiness check

- Health: `curl -fsS http://localhost:18080/actuator/health` → UP
- Column present: `data_entity.exclude_from_search` boolean (default false).

## 4. Run protocol

1. Seed entity A (normal) + entity B (`exclude_from_search=true`), both matching term T.
2. Browser: open `/search`, type T, Enter; wait for the results GET.
3. Observe the rendered result rows (`[data-testid=search-result-item]`).

**Automated rail:** `ODD_STACK_EXTERNAL=1 integration-tests/run-suite.sh IT-066`.

## 5. Assertions

- **PASS** when: entity A renders as a result row AND entity B does NOT (filtered out of the surface).
- **FAIL** when: entity B (exclude_from_search=true) appears in the search results — the filter regressed
  on `findByState`.

## 6. Result log

Appends to `integration-tests/run-log/{YYYY-MM-DD}-IT-066.md`.

## Cross-references
- Source: F-003 UC-004 (exclude_from_search hidden from list shapes). Popular-CTE leak: probe P-006
  (`lineage/odd-platform/probe-runs/2026-05-19-P-006.yaml`), not browser-reachable under DISABLED auth.
- Plan: `lineage/odd-platform/test-plan.md` batch I9 (UI cross-tier e2e)
