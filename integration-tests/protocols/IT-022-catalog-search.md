---
id: IT-022
title: "Catalog-wide search finds a data entity by name and filters out non-matches"
gates:
  validates: [F-017]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:specs/catalog-search.spec.ts"
plan_ref: ""
status: ready
---

# IT-022 — Catalog search on /search (F-017)

> A protocol is the source of truth — a human can execute every step below without tooling.

## 1. What this checks
The platform's primary discovery surface (`/search`): the operator types into the main **"Search"**
box and presses Enter → a search session is created (`POST /api/search`) and the matching data
entities render (`GET /api/search/{id}/results`). This IT verifies a seeded entity is **findable by
name** and that the search **filters** (a non-matching entity is excluded), plus that a non-matching
query returns nothing — the real UI→backend→DB catalog-search path. If it FAILS, the platform's
central discovery feature (F-017) is broken. Source: feature-flow F-017; `MainSearch`/`Search.tsx` +
`SearchController` `/api/search*`.

> Catalog search matches the FTS `search_entrypoint.data_entity_vector` — a raw `data_entity` INSERT
> is INVISIBLE to search; the helper seeds the entrypoint vector (KEY LESSON 3). The main query box
> has placeholder "Search" exactly (sidebar facet inputs are "Search by name") and searches on Enter.

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` (AUTH_TYPE=DISABLED). Brought up by the runner during the e2e run.
- **Seed data**: `helpers/db.ts seedSearchableEntity(id, name)` — seeds a data entity (type TABLE,
  class DATA_SET) + its `search_entrypoint.data_entity_vector`. IT-022-specific ids (2022/2023) so it
  never clobbers the shared entity 2001.

## 3. Readiness check
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`.
- Seed searchable: `POST /api/search {"query":"<name>","filters":{}}` → `total >= 1`;
  `GET /api/search/{search_id}/results` → the entity in `items[]`.

## 4. Run protocol
1. SUCCESS: `seedSearchableEntity(2022,"<name>")` + `seedSearchableEntity(2023,"<other>")`; open
   `/search`; type `<name>` into "Search" + Enter; wait for `GET …/results`; observe.
2. NEGATIVE: open `/search`; type a non-matching query (`ZZZNoSuchEntityZZZ`) + Enter; wait for results; observe.

**Automated rail**: `integration-tests/run-suite.sh IT-022` (Playwright `e2e/specs/catalog-search.spec.ts`).

## 5. What it checks — assertions
- **SUCCESS (PASS):** the searched entity appears in the results AND the other seeded entity is
  filtered out (visible count 0). (FAIL: the entity never appears, or filtering does not happen.)
- **NEGATIVE (PASS):** a non-matching query returns neither entity (visible count 0).

## 6. Result log
- 2026-06-03 — authored; catalog-search API + UI flow ground-truth verified (POST/GET 200, entity
  rendered, filtering confirmed) before authoring; run via run-suite.sh IT-022 (see run-log/).
