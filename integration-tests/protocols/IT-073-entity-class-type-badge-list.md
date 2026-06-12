---
id: IT-073
title: "The class badge encodes an entity's class as the operator-scannable short token on the search result row"
gates:
  validates: [F-206]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:specs/entity-class-type-badge-list.spec.ts"
plan_ref: "I9"
status: ready
---

# IT-073 — Entity class/type badge on SEARCH/LIST rows (F-206)

> A protocol is the source of truth — a human can execute every step below without tooling.

## 1. What this checks
F-206 anchors the shared class/type badge primitives. On a Search result row
(`Search/Results/ResultItem/ResultItem.tsx:110-117`) the row renders one `EntityClassItem` per
`entityClasses[]`, gated by `showClassIcons` (true for an "All"/text search — `Results.tsx:157`).
`EntityClassItem` renders the SHORT label from `DataEntityClassLabelMap`: DATA_SET → "DS". This pins
F-206-UC-7's previously-untested half — the badge on a SEARCH row (only the detail header was
e2e-verified by IT-018/F-177). If it FAILS, the class badge does not reach the search/list surface.
Source: feature-flow F-206 (UC-7).

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` (AUTH_TYPE=DISABLED). Reuse the shared stack (`ODD_STACK_EXTERNAL=1`).
- **Seed data**: a searchable DATA_SET/TABLE entity (ids 20730/20731) via `seedSearchableEntity`
  (`entity_class_ids={1}` + the `search_entrypoint` FTS vector so the row is findable and renders 200).

> ⚠ KNOWN BUG (PLT-147, convergently re-confirmed live during this build): a non-DATA_SET class
> (DATA_TRANSFORMER, DATA_QUALITY_TEST, DATA_CONSUMER, DATA_INPUT) that is FTS-findable but lacks its
> class-specific details row makes `GET /api/search/{id}/results` **500** —
> `DataEntityMapperImpl.java:99` dereferences `getDataTransformerDetailsDto().sourceList()` with no
> null guard (only the DATA_SET branch is null-safe via `mapStats`). So a "distinct class" corner
> cannot use a second class via this raw-seed path; the encoding-distinctness corner therefore runs on
> the DATA_SET row itself (DS present, the transformer token "TS" absent).
>
> **[2026-06-12 — constraint LIFTED: PLT-147/#1755 FIXED (CTRIB-009 null-guards every class branch;
> IT-068 carries the regression lock). Widening this corner to a second raw-seeded class = TST-047;
> the box above is kept as the build-time rationale for the current DATA_SET-only shape.]**

## 3. Readiness check
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`.
- Findable: `POST /api/search {query:"IT073DatasetEntity",filters:{}}` then
  `GET /api/search/{id}/results` → the seeded entity (`total:1`).

## 4. Run protocol
1. SUCCESS: seed the DATA_SET entity; open `/search`; type its name + Enter; wait for the
   `/api/search/{id}/results` response; observe the result row + its "DS" class badge.
2. CORNER (encoding-distinctness): on the same DATA_SET row, observe the "DS" badge IS present and the
   DATA_TRANSFORMER short token "TS" is ABSENT — the badge is class-driven, not a constant chip.

**Automated rail**: `integration-tests/run-suite.sh IT-073` (Playwright `e2e/specs/entity-class-type-badge-list.spec.ts`).

## 5. What it checks — assertions
- **SUCCESS (PASS):** the searched DATA_SET entity appears AND its row renders the "DS" short badge.
- **CORNER (PASS):** the DATA_SET row renders "DS" AND does NOT render "TS" (visible count 0).
- **FAIL:** the "DS" badge is missing on the search row, or a wrong-class token appears.

## 6. Result log
- 2026-06-07 — authored; ResultItem class-badge render verified against primary source
  (DataEntityClassLabelMap SET→'DS'). Both tests PASS via Playwright (ODD_STACK_EXTERNAL=1).
  Side-finding: re-confirmed PLT-147 (search-results NPE on a class-2 entity with null details) — no
  new PLT filed (already on disk; discovered during IT-068).
