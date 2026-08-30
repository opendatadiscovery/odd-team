---
id: IT-068
title: "Search class filter — selecting Datasets narrows results to dataset class; a null-details transformer renders in the list and its detail page loads (PLT-147 regression lock)"
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

> **RE-POINTED 2026-08-31 by ST-8 (#1842 / CTRIB-062).** This protocol was written against the 9-tab class
> strip atop `/search`. ST-4 (#1838) retired the seven per-class tabs — class selection became the
> **Data entity type** filter in the Filters sidebar (`#filter-entityClasses`) — and ST-8 retired the last tab
> (`My Objects`), so the strip no longer exists. Both claims below are unchanged in substance and strength;
> only the control exercised in step 1 has moved from the tab strip to that sidebar filter. The PLT-147
> regression lock is entirely unaffected (it never touched a tab).

Two things about narrowing `/search` by entity class (a control that lived in a tab strip until ST-4/ST-8,
and now lives in the Filters sidebar):

1. **(F-148 UC-001, GREEN)** Selecting the **Datasets** entity class narrows the result list to dataset-class (SET)
   entities — a non-dataset row drops out. **Operator consequence if it FAILS:** the class filter (the most-used
   search-scoping control) doesn't actually scope.
2. **(PLT-147 / #1755 regression lock — FIXED 2026-06-12, CTRIB-009)** A **DATA_TRANSFORMER**-class entity
   whose details DTO is null (class id present, `specific_attributes` block absent) renders as a result row
   (results GET **200**, empty Sources/Targets cells), and clicking through, its **detail page loads**
   (entity GET 200 — the `mapDtoDetails` surface). History: `DataEntityMapperImpl` used to dereference
   `getDataTransformerDetailsDto()` with no null guard (`mapPojo:99` via `mapPojos`, `mapDtoDetails:298`) —
   one such entity 500d (SYS001) the WHOLE results page (while the tab strip showed `Transformers | 1`) and
   its detail page. This test was the GREEN-while-broken LSN-029 characterization pin of that behaviour; it
   flipped RED on the null-guard fix and is re-grounded to lock the fixed contract on both surfaces.
   **Operator consequence if it FAILS:** the mapper null-guard regressed — one partially-ingested entity
   kills search + detail again. (The QUALITY_TEST / CONSUMER / INPUT branches share the same guard; their
   per-branch coverage is the `DataEntityMapperImplTest` unit suite in odd-platform.)

The happy-path test uses **DATA_SET vs DATA_ENTITY_GROUP** (both map cleanly); DATA_TRANSFORMER was
originally disqualified for the happy path because of PLT-147 — fixed now; the class choice stays, and the
second test locks the transformer contract end-to-end on its own.

## 2. Preparation

- **Stack:** `odd-minimal` (DISABLED). `ODD_STACK_EXTERNAL=1` to reuse a running stack.
- **Seed (success):** a searchable DATA_SET entity (`seedSearchableEntity`, class {1}) + a searchable
  DATA_ENTITY_GROUP entity (class {8}, via `dbQuery` on the test's own id) sharing term T_a.
- **Seed (regression lock):** a searchable DATA_TRANSFORMER entity (class {2}, via `dbQuery`) on a
  DISJOINT term T_b — the same NULL-`specific_attributes` shape that used to 500 both surfaces.
  (The FTS-token disjointness vs T_a is kept: it keeps the two tests' result sets independent.)
- **Cleanup (MANDATORY — added 2026-06-11, CTRIB-005):** `test.afterAll` deletes all three seeded rows
  (+ their `search_entrypoint` rows). History: while PLT-147 was open, a leftover null-details
  transformer was TOXIC residue — an EMPTY-query search matches every entity, so the row 500d the plain
  Catalog page for all later stack users (the maintainer hit it live browsing the stack). The #1755 fix
  removed the 500; seed hygiene stays (leftovers still pollute other specs' counts and empty-query pages).

## 3. Readiness check

- Health: `curl -fsS http://localhost:18080/actuator/health` → UP
- Class facet: `PUT /api/search/{id}` with `filters.entity_classes=[{entity_id:1,selected:true}]` narrows to
  class-1 results (verified live).

## 4. Run protocol

1. **Success:** seed dataset + group (term T_a); open `/search`, type T_a, Enter; confirm both rows render
   under "All"; click the **Datasets** tab; observe the result list.
2. **Regression lock:** seed a null-details transformer (term T_b); open `/search`, type the transformer
   name, Enter; capture the results GET status + the rendered row; click the row; capture the entity-detail
   GET status + the rendered detail page.

**Automated rail:** `ODD_STACK_EXTERNAL=1 integration-tests/run-suite.sh IT-068`.

## 5. Assertions

- **Success PASS** when: after clicking Datasets, the dataset row remains AND the group row is filtered out.
- **Regression-lock PASS** when: the transformer-term results GET returns 200 AND the transformer row
  renders AND the click-through entity-detail GET returns 200 AND the detail page renders the entity name.
- **Regression-lock FAIL** = the `DataEntityMapperImpl` null-guard regressed (#1755 reopens — a
  null-details entity 500s search results and/or entity detail again).
- *(Flip provenance: until 2026-06-12 this was the inverse LSN-029 pin — GREEN at ≥500 + no row — flipped
  RED by the CTRIB-009 fix and re-grounded per its own pre-authored flip note; PLT-147 → resolved.)*

## 6. Result log

Appends to `integration-tests/run-log/{YYYY-MM-DD}-IT-068.md`.

## Cross-references
- Source: F-148 UC-001 (class-tab narrows). Bug (FIXED): PLT-147 (`issues/odd-platform/PLT-147.md`) =
  odd-platform#1755 — mapper NPE on null transformer/quality-test details DTO, null-guarded 2026-06-12
  (CTRIB-009); this protocol's second test is the e2e regression lock, `DataEntityMapperImplTest`
  (odd-platform unit bucket) covers every guarded branch. Code: `SearchResultsTabs.tsx:29-31`,
  `Results.tsx:83-100`, `DataEntityMapperImpl.java` mapPojo/mapDtoDetails class branches.
- Plan: `lineage/odd-platform/test-plan.md` batch I9 (UI cross-tier e2e)
