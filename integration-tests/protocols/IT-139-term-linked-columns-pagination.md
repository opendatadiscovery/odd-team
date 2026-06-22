---
id: IT-139
title: "Term Linked-columns tab paginates past the size cap; backend page_info reports the real total/hasNext"
gates:
  validates: [F-153]
  enforces: []
  regresses: [PLT-058]
test_class: integration
stack: odd-minimal
automation: "e2e:term-linked-columns-pagination.spec.ts"
plan_ref: I9
status: ready
---

# IT-139 — Term linked-columns pagination (#1754 Defect 4 / CTRIB-028)

> A protocol is the **source of truth** — a human can execute every step below WITHOUT any tooling.
> The `automation:` spec runs the same steps and writes the same result; it never replaces the protocol.

## 1. What this checks
The term detail "Linked columns" tab (`/terms/{id}/linked-columns`) lists **every** column linked to the term,
not a silent first page. Pre-fix (LSN-024 silent-empty class): `LinkedColumnsList` pinned page 1 with a noop
`InfiniteScroll next`, and `DatasetFieldListMapperImpl` hardcoded `page_info(total=<returned page size>,
hasNext=false)` — so a term with 60 linked columns showed a tab badge "60" over a list that stopped at 50, with
no loader and no error. The fix: FE `useInfiniteQuery` + wired `fetchNextPage`, and the backend returns the real
windowed total + `hasNext`. If this regresses, glossary-governance audits ("which columns reference PII?")
silently truncate.

Source: F-153 / #1754 Defect 4 (`LinkedColumnsList.tsx`, `lib/hooks/api/terms.ts` `useGetTermLinkedColumns`,
`GET /api/terms/{id}/linked_columns` → `DatasetFieldServiceImpl.listByTerm` →
`ReactiveDatasetFieldRepositoryImpl.listByTerm` + `countByTerm`, `DatasetFieldListMapperImpl`).

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` at `http://localhost:18080` (`ODD_STACK_EXTERNAL=1` for a shared stack).
- **Auth/config**: `AUTH_TYPE=DISABLED` (odd-minimal default).
- **Seed data** (`//it139/` oddrn prefix; names `it139_*`): namespace `it139_ns`; term `it139_PiiTerm`; one
  dataset entity `it139_pii_table` (+ data_source + dataset_version); **60** `dataset_field` rows, each in a
  `dataset_structure` row of that version AND a `dataset_field_to_term` row linking it to the term. (The
  spec's `seedTermWith60LinkedColumns` does this idempotently.)

## 3. Readiness check — is the stand ready?
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`.
- Seed present: `GET /api/terms/{id}` → `columns_using_count: 60`;
  `GET /api/terms/{id}/linked_columns?page=1&size=50` → `page_info {total:60, hasNext:true}`.

## 4. Run protocol — what to run
1. Navigate `/terms/{PiiTerm.id}/linked-columns`; await `GET /api/terms/{id}/linked_columns`.
2. Read the tab badge ("Linked columns 60").
3. Scroll the list container (`#term-linked-columns-list`) to the bottom repeatedly to pull subsequent pages.
4. Count the rendered column rows.

**Automated rail**: `cd integration-tests/e2e && PATH="$HOME/.local/node/bin:$PATH" ODD_STACK_EXTERNAL=1 npx playwright test specs/term-linked-columns-pagination.spec.ts --reporter=line`

## 5. What it checks — assertions
- **PASS** when: the tab badge shows 60 AND all 60 `it139_col_*` rows are reachable by scrolling.
- **FAIL (RED on `ref:main`)** when: the list stops at 50 (the silent cap) while the badge shows 60.

## 6. Result log
Append a dated entry to `integration-tests/run-log/{YYYY-MM-DD}-IT-139.md`.

## Cross-references
- Source: F-153 / #1754 Defect 4; work record `contributor/CTRIB-028.md`.
- Backend unit coverage: `ReactiveDatasetFieldRepositoryImpl.listByTerm`/`countByTerm` honest page_info.
- Automation spec: `integration-tests/e2e/specs/term-linked-columns-pagination.spec.ts`.
