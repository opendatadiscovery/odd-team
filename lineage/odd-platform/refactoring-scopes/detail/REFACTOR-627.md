## REFACTOR-627 — `GET /api/relationships/erd/{relationship_id}` and `/api/relationships/graph/{relationship_id}` path parameter NAME promises the `relationships` table primary key; the SQL filter uses `data_entity.id` — Category F TRANSLATES_SILENTLY; third-party API consumers reading the OpenAPI spec get 404

**Severity**: HIGH
**Category**: input-name-vs-implementation-drift (Category F)
**Pillars affected**: [P-02 Data Modelling]
**Batch**: ZE (2026-05-25)

**Surfaced by**:
- `odd-platform__java__RelationshipController__controller-class__RelationshipController.md:bugs_limitations_corner_cases.[0]` (HIGH) — "**CATEGORY F TRANSLATES_SILENTLY — `relationshipId` parameter name vs SQL filter target**: the OpenAPI parameter `relationship_id` and Java parameter `relationshipId` promise the relationships-table primary key; the SQL at `ReactiveRelationshipsRepositoryImpl.java:194` filters by `relationshipsDataEntity.field(DATA_ENTITY.ID).eq(relationshipId)` — the data_entity.id, NOT relationships.id. The list endpoint's response maps `.id(item.dataEntityRelationship().getId())` (RelationshipMapper.java:53) — the data_entity id. UI round-trip works (list→detail with same id). Third-party API consumers reading the OpenAPI spec and supplying actual relationships.id values get 404."
- `odd-platform__java__RelationshipController__controller-class__RelationshipController.md:concepts.invariants.[1]` — confirms the alignment claim and the round-trip self-consistency
- `odd-platform__java__RelationshipController__controller-class__RelationshipController.md:stress_findings.name_behavior_pairs.[1]+[2]` — DRIFT_NAME_VS_BEHAVIOR flagged on both ERD and GRAPH paths
- `odd-platform__java__RelationshipController__controller-class__RelationshipController.md:stress_findings.request_inputs.[5]` (the detail path-param walkthrough) — confirms the column-that-matches-the-name (`RELATIONSHIPS.ID`) IS present in the schema but NOT used at the filter site
- Probe `P-128` (pins the name-vs-SQL drift)

**Description**: `RelationshipController.getERDRelationshipById(relationshipId, exchange)` (line 31) and `getGraphRelationshipById(relationshipId, exchange)` (line 39) accept a path parameter named `relationship_id` (OpenAPI) / `relationshipId` (Java). The name PROMISES the `relationships` table primary key — i.e. an integer id obtained from the `relationships` table directly.

The actual SQL at `ReactiveRelationshipsRepositoryImpl.java:194` is:
```java
.where(relationshipsDataEntity.field(DATA_ENTITY.ID).eq(relationshipId))
```

The filter binds to `data_entity.id` (the relationship-class data entity's primary key), NOT `relationships.id`. The two are DIFFERENT bigserial counters: a relationship-class data_entity row may have id=42, while the corresponding `relationships` row may have id=17.

**The UI round-trip masks the drift**:
- The list endpoint (`GET /api/relationships`) returns items with `id = data_entity.id` (per `RelationshipMapper.java:53`: `.id(item.dataEntityRelationship().getId())`).
- The UI clicks an item from the list → the detail endpoint receives `data_entity.id` as `relationshipId`.
- The SQL filter receives `data_entity.id` → finds the row → returns 200 with the payload.
- The round-trip works END-TO-END because both sides use `data_entity.id` consistently.

**The third-party API consumer fails**:
- A consumer reads the OpenAPI spec: `GET /api/relationships/erd/{relationship_id}` with description "Get information about an ERD relationship by its id" — name promises `relationships.id`.
- The consumer obtains a `relationships.id = 17` via direct DB query OR generated from a Postman test set OR inferred from the OpenAPI spec semantics.
- The consumer calls `GET /api/relationships/erd/17`.
- The SQL filter binds 17 to `data_entity.id`; no row matches; returns 404 (`NotFoundException("Relationship", 17)` at `RelationshipsServiceImpl.java:40-47`).
- The consumer cannot tell from the 404 that the parameter was wrong; the error is just "not found".
- Worse, the consumer may HAPPEN to provide a `data_entity.id` that collides with a `relationships.id` (both are bigserial — collision unlikely but admissible) and receive a payload for an UNRELATED relationship — silently wrong data.

**Compounded by no UNIQUE constraint** (per REFACTOR-628): `relationships.data_entity_id` has NO UNIQUE constraint, so the schema admits one relationship-class data_entity owning multiple `relationships` rows. The detail endpoint uses `mono()` expecting one row (line 197); on multi-match the behaviour is JOOQ-driver-specific (TooManyResultsException OR silent first-row).

**The available-but-unused column**: `RELATIONSHIPS.ID` IS the jOOQ column the name promises. The fix candidate is changing line 194 from `relationshipsDataEntity.field(DATA_ENTITY.ID).eq(relationshipId)` to `RELATIONSHIPS.ID.eq(relationshipId)` — AND updating the list endpoint's mapper to surface `relationshipPojo().getId()` as the `id` instead of `dataEntityRelationship().getId()`. Both halves are needed; either half alone breaks round-trip.

**Primary source citations**:
- `RelationshipController.java:31, 39` (path parameter declarations)
- `RelationshipsServiceImpl.java:38-49` (service-layer pass-through)
- `ReactiveRelationshipsRepositoryImpl.java:194` (the SQL site with the data_entity.id binding)
- `ReactiveRelationshipsRepositoryImpl.java:197` (the `mono()` expects single row)
- `RelationshipMapper.java:53` (`item.dataEntityRelationship().getId()` — surfaces data_entity.id as the list response's `id`)
- `V0_0_87__create_relation_tables.sql:1-10` (the `relationships` table with separate id from data_entity.id)
- `openapi.yaml:4162-4166, 4181-4183` (OpenAPI parameter declaration)
- `components.yaml:4385-4391` (relationship_id parameter spec)
- `documentation/docs/developer-guides/api-reference/relationships.md:11` (the doc declaration that does NOT warn about the binding)

**Existing-ADR-or-implied-prescription**: none directly. The platform's convention (per LSN-020) is "input names match the column they query"; this is a deliberate input-name-vs-implementation drift documented as Category F TRANSLATES_SILENTLY. Sibling cases: REFACTOR-496 (getPopularTagList `ids` parameter description mismatched against TAG id filter — same LSN-020 shape).

**Proposed remedy**: Two-path; the maintainer chooses based on UI-breakage tolerance:

1. **RENAME (operator-clarifying)** — change the path parameter name to `data_entity_id` (matching the SQL binding). Update the OpenAPI spec, the controller, the service signature, the mapper. The UI continues to work; third-party consumers reading the new name correctly will supply `data_entity.id` values; consumers using `relationships.id` will still 404, but now the OpenAPI spec makes the expected input explicit.

2. **FIX TO MATCH NAME (UI-breaking-without-coordinated-change)** — change `ReactiveRelationshipsRepositoryImpl.java:194` from `relationshipsDataEntity.field(DATA_ENTITY.ID).eq(relationshipId)` to `RELATIONSHIPS.ID.eq(relationshipId)`. The detail endpoint now binds to `relationships.id` (matching the name). BUT: the list endpoint's mapper at `RelationshipMapper.java:53` must ALSO change (`.id(item.relationshipPojo().getId())` instead of `.id(item.dataEntityRelationship().getId())`) — otherwise the UI's list→detail round-trip breaks. Coordinated change across two files + integration test.

Option (1) is preferred: less risk, less coordinated change, clearer API contract.

**Severity rationale**: HIGH — third-party API contract drift on a load-bearing read endpoint. The UI masks the bug; non-UI consumers (mobile, CLI, integration tests, Postman) hit it. Pairs with REFACTOR-628 (no UNIQUE constraint → multi-row mono() risk) and REFACTOR-626 (the no-authz framing — third-party consumers having access to the endpoint at all is itself a consequence of the no-authz posture).

**Suggested backlog grouping**: `API contract hardening sprint` — couple with REFACTOR-496 (sibling Category F shape on `ids` param), REFACTOR-628 NEW (no UNIQUE constraint compound), REFACTOR-545 (status-code drift across controllers — operator-facing API-contract pattern).

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-496 (sibling LSN-020-class input-name-vs-implementation drift); REFACTOR-628 NEW (the multi-row compound).
- SUPERSEDES: none.
- CONFLICTS: none.

---
