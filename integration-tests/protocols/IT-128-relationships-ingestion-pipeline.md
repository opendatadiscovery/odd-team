---
id: IT-128
title: "Relationships through the REAL pipeline: neo4j + postgres-FK truth ingested by the real odd-collector matches ODD's API + UI (graph direction, ERD child→parent, cardinality, is_identifying)"
gates:
  validates: [F-037]
  enforces: []
  regresses: []
test_class: integration
stack: odd-ingestion
automation: "e2e:relationships-ingestion-pipeline.spec.ts"
plan_ref: I6
status: ready
---

# IT-128 — Relationships ingestion pipeline (F-037, ingestion-grade)

> A protocol is the source of truth — a human can execute every step below without tooling.
> **This is the first INGESTION-GRADE protocol** (maintainer directive 2026-06-12;
> `adrs/drafts/ingestion-grade-e2e-stands.md`): the stand contains REAL source systems and
> the REAL odd-collector — nothing is seeded into the platform database. The assertion
> model is: *seed a KNOWN truth in the source system; assert ODD agrees with that truth.*

## 1. What this checks

The full product pipeline for the Data Modelling → Relationships surface:

```
neo4j (4 labelled nodes / 5 typed, DIRECTED relationships)   ─┐
                                                              ├─→ odd-collector ─→ ingestion
postgres "shop" DB (3 tables / 2 named FK constraints)        ─┘    API ─→ odd-platform
                                                                          ─→ GET /api/relationships
                                                                          ─→ /data-modelling/relationships UI
```

Asserted truths (each derives from the seed + the adapter mapping code, NOT from a copy of
platform rows):

1. **GRAPH mapping + direction.** The collector's neo4j adapter emits one
   `GRAPH_RELATIONSHIP` per DISTINCT `(labels(s), type(r), labels(t))` triple, named
   `{Source}_{TYPE}_{Target}`, with **source = the cypher edge's START node** and
   **target = its END node** (`odd-collectors …/adapters/neo4j/adapter.py`
   `MATCH (s)-[r]->(t)`; `mappers/relationships.py`). The seed's 5 edges must land as
   exactly 5 relationships with those directions — e.g. `(:Person)-[:WORKS_AT]->(:Company)`
   must show Source=Person, Target=Company on the list and on the entity overview labels
   (the #1752 D1 / graph-label-swap contract, verified through the real pipeline rather
   than a DB seed).
2. **GRAPH details.** `is_directed=true`; the edge's property NAMES land as attributes
   with the literal value `UNKNOWN` (the adapter cannot introspect property types without
   APOC — known limitation); the payload's `graph_relationship_id` is an internal
   detail-record id — a DIFFERENT id space from the path param, though the numeric values
   can coincide on a fresh DB (the documented `relationship_id` contract trap).
3. **ERD mapping + direction.** The postgresql adapter emits one `ENTITY_RELATIONSHIP`
   per FK constraint, **named by the constraint name**, with **source = the FK-holding
   (child) table** and **target = the referenced (parent) table**
   (`…/postgresql/mappers/relationships/mapper.py`).
4. **ERD derivations.** `cardinality` = `ONE_TO_ZERO_OR_ONE` when the FK column is
   unique/PK on the child, else `ONE_TO_ZERO_ONE_OR_MORE` (`cardinality_checker.py`);
   `is_identifying` = FK ⊆ child PK AND referencing the parent's full PK
   (`identifying_checker.py`). The two seeded constraints exercise both paths.
5. **Collector bootstrap is the real flow.** The collector is registered via
   `POST /api/collectors` (one-shot token reveal) and pushes with that token.

## 2. Preparation — build the test stand

- **Stack**: `odd-ingestion` (`lineage/_extractor/probe-stacks/odd-ingestion.docker-compose.yml`,
  project `oddingest`) — platform (SUT image, **:18087**) + its postgres (:15438) +
  `neo4j:latest` (**browser :17474**, bolt :17687, `neo4j` / `odd-neo4j-password`) +
  `postgres:latest` source DB `shop` (:15439, `shop` / `shop-password`) + the
  `ghcr.io/opendatadiscovery/odd-collector:latest` container behind the `collector`
  compose profile. Fully ephemeral (`down -v` after the run).
- **Neo4j seed** (one-shot `probe-ingest-neo4j-seed` container, idempotent —
  `odd-ingestion/neo4j-seed.cypher`): nodes `Person(Alice)`, `Company(Acme Analytics)`,
  `City(Berlin)`, `Project(Apollo)`; edges `Person-WORKS_AT->Company {since, position}`,
  `Person-LIVES_IN->City`, `Company-HEADQUARTERED_IN->City`, `Person-CONTRIBUTES_TO->Project`,
  `Company-SPONSORS->Project`. A human can inspect the truth at the Neo4j browser
  (http://localhost:17474 → connect to bolt://localhost:17687).
- **Postgres seed** (`odd-ingestion/source-postgres-init.sql`, runs at first start):
  `customers(id PK)`; `orders(id PK, customer_id → customers.id, CONSTRAINT
  orders_customer_fk)` — plain FK, NOT unique → expect `ONE_TO_ZERO_ONE_OR_MORE` /
  `is_identifying=false`; `customer_profiles(customer_id PK → customers.id, CONSTRAINT
  customer_profiles_customer_fk)` — FK IS the child PK → expect `ONE_TO_ZERO_OR_ONE` /
  `is_identifying=true`.
- **Collector config** (`odd-ingestion/collector_config.yaml`): two plugins —
  `neo4j` (port **must be a quoted string** — the generic `WithPort.port: str`) and
  `postgresql` (port int) — `default_pulling_interval: 1`, token via `!ENV ${COLLECTOR_TOKEN}`.
- **Manual bring-up** (what the automation does):
  1. `docker compose -p oddingest -f …/odd-ingestion.docker-compose.yml up -d`
  2. `curl -s -X POST http://localhost:18087/api/collectors -H 'Content-Type: application/json'
     -d '{"name":"it128-relationships-stand"}'` → note `.token.value` (shown ONCE).
  3. `COLLECTOR_TOKEN=<value> docker compose -p oddingest --profile collector
     -f … up -d probe-ingest-collector`

## 3. Readiness check

- Platform health: `curl -fsS http://localhost:18087/actuator/health` → `{"status":"UP"}`.
- Ingestion landed (collector pulls at startup, then every minute; allow ≤3 min):
  `curl -s 'http://localhost:18087/api/relationships?page=1&size=30&type=GRAPH'` →
  **5 `items`**; `…type=ERD` → **2 `items`**. Count the ITEMS, not `page_info.total` —
  the total is type-blind (pre-existing PLT-220: the count query never sees the type
  filter, so both reads report the all-types 7). This stand reproduced PLT-220 through
  the real pipeline on its first run (run-log 2026-06-12).

## 4. Run protocol

**GRAPH half (neo4j truth):**
1. List `type=GRAPH`: 5 items named `Person_WORKS_AT_Company`, `Person_LIVES_IN_City`,
   `Company_HEADQUARTERED_IN_City`, `Person_CONTRIBUTES_TO_Project`,
   `Company_SPONSORS_Project`; for each, `source_data_entity.external_name` /
   `target_data_entity.external_name` equal the cypher START / END node label.
2. Detail: `GET /api/relationships/graph/{list id of Person_WORKS_AT_Company}` → 200;
   `is_directed=true`; attribute names = `position`, `since` (values `UNKNOWN`);
   `graph_relationship_id` present. Do NOT check it for numeric inequality with the list
   id — the id SPACES differ but the VALUES can collide on a fresh ingestion-only DB
   (observed run 3: they were equal — the doc caveat's "numeric coincidence" clause live).
3. UI: open `/data-modelling/relationships?q=Person_WORKS_AT_Company` on :18087 — the row
   shows `Person` once (Source) and `Company` once (Target).
4. UI: open `/dataentities/{list id}/overview` — the "Source:" block carries `Person`,
   the "Target:" block carries `Company`.

**ERD half (postgres-FK truth):**
5. List `type=ERD`: 2 items named exactly `orders_customer_fk` (source `orders`, target
   `customers`) and `customer_profiles_customer_fk` (source `customer_profiles`, target
   `customers`) — child→parent direction.
6. Details by list id: `orders_customer_fk` → `cardinality=ONE_TO_ZERO_ONE_OR_MORE`,
   `is_identifying=false`; `customer_profiles_customer_fk` → `ONE_TO_ZERO_OR_ONE`, `true`.
7. UI: open `/data-modelling/relationships?q=orders_customer_fk` — the row shows `orders`
   once (Source) and `customers` once (Target).

**Automated rail**: `cd integration-tests/e2e && PATH="$HOME/.local/node/bin:$PATH"
npx playwright test specs/relationships-ingestion-pipeline.spec.ts --reporter=line`
(the spec manages the whole stand itself — up, register, collect, assert, down).

## 5. What it checks — assertions

- **GRAPH direction (PASS):** every triple's source/target = the cypher edge's start/end.
  (FAIL = adapter or platform inverted a direction, or the UI swapped a column/label —
  the #1752 D1/Finding-A class, now guarded through the REAL pipeline.)
- **GRAPH details (PASS):** directed; property names as UNKNOWN-typed attributes; internal
  id ≠ path-param id. (FAIL = mapping/contract drift.)
- **ERD direction (PASS):** source = child (FK holder), target = parent (referenced).
  (FAIL = the FK direction inverted anywhere in the chain.)
- **ERD derivations (PASS):** cardinality + is_identifying per the adapter's documented
  checkers for both seed shapes. (FAIL = derivation drift in the adapter or platform.)
- **Pipeline liveness (PASS):** a freshly registered collector token ingests within ~3 min.
  (FAIL = registration/token/ingestion path broken.)

## 6. Result log

- 2026-06-12 — authored as the first ingestion-grade protocol (maintainer directive: real
  multi-component stands, no mocks; reuses the maintainer's throwaway
  `docker/relationships-test/` rig shape). Truth tables derived from the seeds + the
  adapter mappers read at odd-collectors HEAD (shallow clone, this date).
- 2026-06-12 — authoring runs 1-3 (run-log, same date): run 1 = compose `:?`-var bug (0
  tests); run 2 = the ingestion-wait predicate tripped over the TYPE-BLIND total —
  **PLT-220 reproduced through the real pipeline** (measured during run 4's window:
  `?type=GRAPH` items=5/total=7, `?type=ERD` items=2/total=7; evidence appended to the
  draft); run 3 = 5/6, the GRAPH-detail id-inequality assert hit the documented "numeric
  coincidence" (internal detail id == entity id on a fresh DB) — relaxed to presence.
- 2026-06-12 — **GREEN 6/6 (1.0m) on the fix SUT (contrib/CTRIB-006 @ abe51417)** +
  **RED proof vs `ODD_SUT=ref:main` (39b54eef): 3 failed / 3 passed exactly as
  pre-authored** — API truth green on both (backend mapping always correct); the 3 UI
  direction asserts RED pre-fix (D1 both-columns, swapped overview labels, ERD list).
  The stand detects the #1752 UI class through the real pipeline. Runner AI (Claude).
