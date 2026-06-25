---
id: IT-145
title: "Core collect→store→visualize through the REAL pipeline: a postgres source's tables/columns/types/descriptions/rows/view-lineage ingested by the real odd-collector match ODD's API + UI, and a source CHANGE (add column/edit comment/add table/add rows; drop table) is reflected after the next collection"
gates:
  validates: [F-045, F-005, F-008]
  enforces: []
  regresses: []
test_class: integration
stack: odd-ingestion-dataset
automation: "e2e:dataset-pipeline-lifecycle.spec.ts"
plan_ref: I5
status: ready
---

# IT-145 — Dataset pipeline lifecycle (F-045 / F-005 / F-008, ingestion-grade)

> A protocol is the source of truth — a human can execute every step below without tooling.
> This is the **second INGESTION-GRADE protocol** (after IT-128) and the "dataset-structure
> stand" follow-on named in `adrs/drafts/ingestion-grade-e2e-stands.md`: the stand contains a
> REAL source postgres and the REAL odd-collector — nothing is seeded into the platform DB.
> The assertion model is *seed a KNOWN truth in the source; assert ODD agrees — then CHANGE
> the source, re-collect, and assert ODD reflects exactly the delta.*

## 1. What this checks

The core ODD capability — collect, store, and visualize data from an external system — end to
end through the product pipeline, plus the change-data lifecycle an operator lives every day:

```
source-postgres "warehouse" (2 tables + 1 view, COMMENTs, rows)
        │  odd-collector (postgresql plugin; real one-shot token; pulls at startup + every min)
        ▼
odd-platform (SUT image) ─→ GET /api/dataentities|datasets ─→ the dataset UI (:18089)
```

Asserted truths (each derives from the seed + the adapter mapping code at
`odd-collectors/.../adapters/postgresql`, read 2026-06-25 — NOT from a copy of platform rows):

1. **Datasets.** Each source table ingests as a `TABLE` entity, the view as a `VIEW`
   (`mappers/tables.py`, `views.py`), attributed to the collector datasource
   `it145_postgres_warehouse`.
2. **Columns + types.** Every column reaches the Structure surface with the ODD type the
   adapter maps from `pg_type.typname` (`mappers/types.py` `TYPES_SQL_TO_ODD`): `int8/int4 →
   TYPE_INTEGER`, `text/varchar → TYPE_STRING`, `numeric → TYPE_NUMBER`, `date/timestamp →
   TYPE_DATETIME`; the PK column is flagged `is_primary_key`.
3. **Descriptions.** `COMMENT ON TABLE` → entity `external_description`; `COMMENT ON COLUMN` →
   field `external_description` (`repository.py` `obj_description`/`col_description`).
4. **Stats.** `rows_count` = the seeded row count (the adapter's `reltuples` after `ANALYZE` →
   `DataSet.rows_number`); `fields_count` = the column count. (Field-level statistics are NOT
   emitted by the postgres adapter — that contract is covered by the direct-seed tier
   IT-044/045/047, not here.)
5. **Lineage.** A `VIEW` becomes a `DataTransformer` whose input is the table it reads
   (`adapter.py` `create_lineage`); the view's upstream lineage contains `products` and
   `products.consumers_count ≥ 1`.
6. **The change lifecycle.** After `ALTER TABLE … ADD COLUMN`, `COMMENT` edit, `CREATE TABLE`,
   `INSERT` (+`ANALYZE`), the next collection reflects the new column, the new description, the
   new dataset, and the new `rows_count`/`fields_count` — in both the API and the UI.
7. **Deletion reconciliation (characterization).** After `DROP TABLE` + re-collect, the dropped
   dataset **persists** in ODD (not removed, not flagged hollow/deleted). A pull re-ingest does
   not reconcile source deletions — an operator-facing gap pinned here (flips the day ODD adds
   deletion reconciliation, then re-ground to assert removal).
8. **Collector bootstrap is the real flow.** Registered via `POST /api/collectors` (one-shot
   token reveal); the collector pushes with that token.

## 2. Preparation — build the test stand

- **Stack**: `odd-ingestion-dataset`
  (`lineage/_extractor/probe-stacks/odd-ingestion-dataset.docker-compose.yml`, project
  `oddingestds`) — platform (SUT image, **:18089**) + its postgres (:15440) + `postgres:latest`
  source DB `warehouse` (:15441, `warehouse`/`warehouse-password`) + the
  `ghcr.io/opendatadiscovery/odd-collector:latest` container behind the `collector` profile.
  Fully ephemeral (`down -v` after the run).
- **Source seed** (`odd-ingestion-dataset/source-postgres-init.sql`, runs at first start):
  `products(id PK bigint, sku text, title varchar(200), price numeric(10,2), released_on date,
  created_at timestamp, in_stock integer)` with `COMMENT ON TABLE` + `COMMENT ON COLUMN
  products.sku`; `categories(id PK, name text)`; view `active_products AS SELECT … FROM products
  WHERE in_stock > 0`; 3 product rows + 2 category rows; `ANALYZE`.
- **Collector config** (`odd-ingestion-dataset/collector_config.yaml`): one `postgresql` plugin
  (`port` is a bare int — `PostgreSQLPlugin.port: int`), `default_pulling_interval: 1`, token
  via `!ENV ${COLLECTOR_TOKEN}`.
- **Manual bring-up** (what the automation does):
  1. `docker compose -p oddingestds -f …/odd-ingestion-dataset.docker-compose.yml up -d`
  2. `curl -s -X POST http://localhost:18089/api/collectors -H 'Content-Type: application/json'
     -d '{"name":"it145-dataset-stand"}'` → note `.token.value` (shown ONCE).
  3. `COLLECTOR_TOKEN=<value> docker compose -p oddingestds --profile collector -f … up -d
     probe-ingestds-collector`
  4. Re-collect after a source change: mutate via `docker exec … psql` then
     `docker restart probe-ingestds-collector` (forces an immediate startup pull).

## 3. Readiness check

- Platform health: `curl -fsS http://localhost:18089/actuator/health` → `{"status":"UP"}`.
- Ingestion landed (collector pulls at startup; allow ≤3 min): `products` resolves and
  `GET /api/datasets/{products id}/structure` returns **7 fields**. (Resolve ids by
  `external_name` — they are sequence-assigned, never stable across runs.)

## 4. Run protocol

**Phase A — initial collection vs the source truth:**
1. Resolve `products`, `categories`, `active_products`; `GET /api/dataentities/{id}` → types
   `TABLE`, `TABLE`, `VIEW`; datasource `it145_postgres_warehouse`.
2. `GET /api/datasets/{products}/structure` → 7 fields with the ODD types in §1.2; `id`
   `is_primary_key=true`.
3. `external_description` = `Catalog of sellable products`; `sku` field `external_description` =
   `Stock keeping unit, unique per product`.
4. `GET /api/dataentities/{products}` → `stats.rows_count=3`, `fields_count=7`.
5. `GET /api/dataentities/{active_products}/lineage/upstream?lineage_depth=1` → nodes contain
   `products`; products `stats.consumers_count ≥ 1`.
6. UI: `/dataentities/{products}/structure` renders the `sku` column;
   `/dataentities/{products}/overview` renders the description.

**Phase B — change the source → re-collect → reflect the delta:**
7. `ALTER TABLE products ADD COLUMN discount numeric(5,2)`; `COMMENT ON TABLE products IS
   '… (v2)'`; `CREATE TABLE suppliers …` (+COMMENT); `INSERT` one product row; `ANALYZE`;
   restart the collector.
8. Structure now includes `discount` (`TYPE_NUMBER`); `external_description` = `… (v2)`;
   `rows_count=4`; `fields_count=8`; `suppliers` resolves as a `TABLE` with its COMMENT.
9. UI: `/dataentities/{products}/structure` now renders the `discount` column.

**Phase C — source deletion reconciliation (characterization):**
10. `DROP TABLE categories`; bump products comment to `(v3)` as the re-collection sentinel;
    restart the collector; wait until products `external_description` = `… (v3)`.
11. `categories` STILL resolves (not removed) and is not flagged hollow — the current
    no-reconcile-on-absence behavior.

**Automated rail**: `cd integration-tests/e2e && PATH="$HOME/.local/node/bin:$PATH"
ODD_STACK_EXTERNAL=1 npx playwright test specs/dataset-pipeline-lifecycle.spec.ts
--reporter=line` (the spec manages the whole stand — up, register, collect, mutate, re-collect,
assert, down), or via the suite: `integration-tests/run-suite.sh ingestion-e2e`.

## 5. What it checks — assertions

- **Structure (PASS):** all source columns + correct ODD types + PK flag reach the Structure
  surface. (FAIL = adapter type-map drift, a dropped column, or a platform structure-read
  regression.)
- **Descriptions (PASS):** table/column COMMENTs land as external descriptions. (FAIL = the
  collector stopped reading `obj_/col_description`, or the platform dropped them.)
- **Stats (PASS):** rows_count/fields_count match the seed. (FAIL = `reltuples`/ANALYZE or
  the platform stats path regressed.)
- **Lineage (PASS):** the view's upstream contains its source table. (FAIL = `create_lineage`
  or the platform lineage path regressed.)
- **Delta (PASS):** a source add-column/edit-comment/add-table/add-row is reflected after the
  next collection, in API and UI. (FAIL = re-ingestion does not upsert the change — the
  F-008-UC-04/UC-13 reconcile contract broke.)
- **Deletion (PASS = current behavior):** a dropped source table persists in ODD. (When this
  test FLIPS — the entity is removed/flagged — ODD has GAINED deletion reconciliation; re-ground
  the assertion to require removal and move the finding to `regresses:`.)

## 6. Result log

Every run appends a dated entry to `integration-tests/run-log/{YYYY-MM-DD}-ingestion-e2e.md`.
- 2026-06-25 — authored as the second ingestion-grade protocol (the dataset-structure stand the
  ingestion-grade ADR named). Truth tables observed live on the real pipeline before authoring
  (SUT `odd-platform:odd-team-sut`; collector `odd-collector:latest` v0.1.72): all 7 type
  mappings, both descriptions, `rows_count` 3→4, `fields_count` 7→8, view→table upstream
  lineage, and the source-deletion no-reconcile characterization all confirmed.

## Cross-references
- Source: F-045 (dataset structure) · F-005 (lineage) · F-008 (batch ingestion, UC-04/UC-13
  re-ingest reconcile) · `adrs/drafts/ingestion-grade-e2e-stands.md` (the named follow-on)
- Plan: `lineage/odd-platform/test-plan.md` batch I5 (ingestion identity / reconcile)
- Reference instance: IT-128 (relationships ingestion-grade stand)
- Adapter truth: `odd-collectors/odd-collector/odd_collector/adapters/postgresql/{adapter.py,
  repository.py, mappers/{tables,views,columns,types}.py}`
