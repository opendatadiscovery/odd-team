---
id: IT-077
title: "Relationships listing renders the fixed two-column contract, hides DELETED/excluded entities, survives ?type= typos; graph detail labels correct (#1752)"
gates:
  validates: [F-037]
  enforces: []
  regresses: [PLT-056]
test_class: integration
stack: odd-minimal
automation: "e2e:erd-graph-relationships.spec.ts"
plan_ref: I6
status: ready
---

# IT-077 — ERD/Graph Relationships Listing (F-037)

> A protocol is the source of truth — a human can execute every step below without tooling.

## 1. What this checks
The Data Modelling → **Relationships** list page (`/data-modelling/relationships` → `GET /api/relationships`)
renders the relationships surface — a 5-column table (Name | Type | Namespace,Datasource | Source | Target),
30-row infinite scroll, `?q` search on the relationship-row name — under the **#1752 fixed contract**
(PLT-056 / CTRIB-006):
1. the Target column renders the TARGET entity (`RelationshipsListItem.tsx` reads `item.targetDataEntity`);
2. soft-DELETED and `exclude_from_search` relationship entities are NOT listed (the repository applies the
   catalog default predicates — `ReactiveDataEntityRelationshipRepositoryImpl`);
3. a mistyped `?type=` deep-link degrades to the ALL view with the All tab active (validated fallback in
   `Relationships.tsx` + `RelationshipsTabs.tsx`), not a dead "0 relationships overall" screen;
4. the graph-relationship overview labels its endpoints correctly ("Source:" = source dataset, "Target:" =
   target dataset — `GraphRelationship.tsx`);
5. GREEN-LOCKS for the id contract (#1752 Defect 5, behaviour unchanged + now documented in the OpenAPI
   spec): the list `id` IS the `{relationship_id}` path param; the payload's `erd_relationship_id` does NOT
   round-trip (404).

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` (AUTH_TYPE=DISABLED). Shared stack reused via `ODD_STACK_EXTERNAL=1`.
- **Seed data** (own ids `2077x`, namespace `//e2e-it077/`, names `it077_*`; idempotent — spec's
  `seedRelationships()`): healthy ERD relationship `20771` (`it077_rel`, class `{9}`, type 25) with
  DISTINCT source `20772` (`it077_source`) / target `20773` (`it077_target`) + `relationships` row +
  `erd_relationship_details` row; hidden pair `20774` (`it077_hidden_deleted`, status=5) and `20775`
  (`it077_hidden_excluded`, exclude_from_search=true) with their own `relationships` rows; GRAPH
  relationship `20776` (`it077_graph`, type 26) + `relationships` row (GRAPH) + `graph_relationship` row.
  All seeded entities set `hollow=false, status=1, exclude_from_search=false` explicitly, then flip the
  hidden pair's flag.

## 3. Readiness check
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`.
- API: `curl -s 'http://localhost:18080/api/relationships?page=1&size=30&type=ALL&query=it077_rel'` → 200,
  `items[0].source_data_entity.external_name="it077_source"` AND
  `target_data_entity.external_name="it077_target"` (distinct + present).

## 4. Run protocol
1. H-001 (surface): open `/data-modelling/relationships?q=it077_rel`; assert the title, the row
   `it077_rel`, and `it077_source` render.
2. H-002 (re-grounded D1 guard): same page — `it077_source` renders exactly ONCE (Source column) and
   `it077_target` exactly ONCE (Target column).
3. Visibility (D2): open `?q=it077_hidden` — H1 reads "0 relationships overall"; neither
   `it077_hidden_deleted` nor `it077_hidden_excluded` renders.
4. `?type=foo` (D4): open `?type=foo&q=it077_rel` — the API request goes out with `type=ALL` and 200s;
   the row renders; the All tab has `aria-selected=true`.
5. Graph labels: open `/dataentities/20776/overview` — the "Source:" block contains `it077_source`, the
   "Target:" block contains `it077_target`.
6. Id contract (D5 green-locks, API): `GET /api/relationships/erd/20771` → 200, `id=20771`,
   `erd_relationship.erd_relationship_id` present and ≠ 20771; `GET /api/relationships/erd/{that id}` →
   404 USR002.

**Automated rail**: `cd integration-tests/e2e && PATH="$HOME/.local/node/bin:$PATH" ODD_STACK_EXTERNAL=1
npx playwright test specs/erd-graph-relationships.spec.ts --reporter=line`.

## 5. What it checks — assertions
- **H-001 (PASS):** the surface renders the seeded relationship (title + name + source).
- **H-002 (PASS):** source ×1 + target ×1 — each endpoint in its own column. (FAIL = the D1 copy-paste
  regressed: source ×2 / target ×0.)
- **Visibility (PASS):** DELETED + excluded relationship entities are absent and the total counts only
  visible rows. (FAIL = the default predicates regressed.)
- **?type=foo (PASS):** validated fallback to ALL + active All tab + 200. (FAIL = raw param propagates:
  400 + dead empty state.)
- **Graph labels (PASS):** "Source:" carries the source, "Target:" the target. (FAIL = the swap is back.)
- **Id contract (PASS):** list id resolves the detail; `erd_relationship_id` fed back → 404 (the
  documented trap — spec `RelationshipIdParam` description).

## 6. Result log
- 2026-06-07 — authored as the PLT-056 D1 characterization pin (LSN-029): H-002 asserted the BUG
  (source ×2 / target ×0). Outcome PASS (2/2 — bug present). stack_commit `dd52f520`; runner AI (Claude).
- 2026-06-12 — RE-GROUNDED to the #1752 fixed contract (CTRIB-006; flip pre-authored in the 2026-06-07
  entry: "RED = bug FIXED → flip F-037 H-002 to confirmed and retire this pin"). H-002 now asserts the
  fix; new visibility / ?type= / graph-label asserts (RED pre-fix); D5 id-contract green-locks added.
  RED proof vs `ODD_SUT=ref:main` + GREEN on the working-tree SUT recorded in `run-log/` (this date).
