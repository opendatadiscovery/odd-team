---
id: IT-068
title: "Search class-tab filter — clicking Datasets narrows results to dataset class; a transformer-class result currently 500s the list (PLT-147 pin)"
gates:
  validates: [F-148]
  enforces: []
  regresses: [PLT-147]
test_class: integration
stack: odd-minimal
automation: "e2e:search-class-tab-filter.spec.ts"
plan_ref: I9
status: ready
---

# IT-068 — F-148 Search Result Class-Tab Filter

## 1. What this checks

Two things on the 9-tab class strip atop `/search` (a distinct UX surface from the 7-facet sidebar):

1. **(F-148 UC-001, GREEN)** Clicking the **Datasets** tab narrows the result list to dataset-class (SET)
   entities — a non-dataset row drops out. **Operator consequence if it FAILS:** the class tabs (the most-used
   search-scoping control) don't actually scope.
2. **(PLT-147 characterization pin, GREEN today / RED on fix)** A **DATA_TRANSFORMER**-class entity in the
   result set currently makes the results GET return **500 SYS001** — `DataEntityMapperImpl.mapPojo`
   (`DataEntityMapperImpl.java:99`, via `mapPojos:175`) dereferences `getDataTransformerDetailsDto().sourceList()`
   with no null guard. The user sees zero rows + an error panel even though the tab strip shows
   `Transformers | 1`. **Operator consequence:** any search whose result page contains such an entity fails
   entirely. This pin asserts the CURRENT broken behaviour and flips RED when the mapper is null-guarded.

The happy-path test uses **DATA_SET vs DATA_ENTITY_GROUP** (both map cleanly); DATA_TRANSFORMER is
disqualified for the happy path precisely because of PLT-147.

## 2. Preparation

- **Stack:** `odd-minimal` (DISABLED). `ODD_STACK_EXTERNAL=1` to reuse a running stack.
- **Seed (success):** a searchable DATA_SET entity (`seedSearchableEntity`, class {1}) + a searchable
  DATA_ENTITY_GROUP entity (class {8}, via `dbQuery` on the test's own id) sharing term T_a.
- **Seed (pin):** a searchable DATA_TRANSFORMER entity (class {2}, via `dbQuery`) on a DISJOINT term T_b
  (must not share an FTS token with T_a, or the success search would also match the transformer and 500).
- **Cleanup (MANDATORY — added 2026-06-11, CTRIB-005):** `test.afterAll` deletes all three seeded rows
  (+ their `search_entrypoint` rows). The PLT-147 transformer seed is TOXIC residue on the persistent
  stack: an EMPTY-query search matches every entity, so a leftover row 500s the plain Catalog page and
  every expired-search recovery for all later users (the maintainer hit it live browsing the stack).
  The FTS-token isolation protects other specs' queries, NOT empty searches.

## 3. Readiness check

- Health: `curl -fsS http://localhost:18080/actuator/health` → UP
- Class facet: `PUT /api/search/{id}` with `filters.entity_classes=[{entity_id:1,selected:true}]` narrows to
  class-1 results (verified live).

## 4. Run protocol

1. **Success:** seed dataset + group (term T_a); open `/search`, type T_a, Enter; confirm both rows render
   under "All"; click the **Datasets** tab; observe the result list.
2. **Pin:** seed a transformer (term T_b); open `/search`, type T_b, Enter; capture the results GET status.

**Automated rail:** `ODD_STACK_EXTERNAL=1 integration-tests/run-suite.sh IT-068`.

## 5. Assertions

- **Success PASS** when: after clicking Datasets, the dataset row remains AND the group row is filtered out.
- **Pin PASS (GREEN-now)** when: the transformer-term results GET returns ≥500 AND no transformer row renders.
- **Pin FAIL → fix landed:** the results GET returns 200 and the transformer row renders — null-guard shipped;
  flip the pin to assert the row renders (and move PLT-147 to resolved).

## 6. Result log

Appends to `integration-tests/run-log/{YYYY-MM-DD}-IT-068.md`.

## Cross-references
- Source: F-148 UC-001 (class-tab narrows). Bug: PLT-147 (`issues/odd-platform/PLT-147.md`) — mapper NPE on
  null transformer/quality-test details DTO. Code: `SearchResultsTabs.tsx:29-31`, `Results.tsx:83-100`,
  `DataEntityMapperImpl.java:99,298`.
- Plan: `lineage/odd-platform/test-plan.md` batch I9 (UI cross-tier e2e)
