## REFACTOR-628 — `relationships.data_entity_id` has NO UNIQUE constraint; the schema admits one relationship-class data_entity owning MULTIPLE `relationships` rows; the detail endpoint's `mono()` call expects ONE — JOOQ-driver-specific behaviour on multi-match

**Severity**: MEDIUM
**Category**: schema-fragility (multi-row admissibility under single-row reader)
**Pillars affected**: [P-02 Data Modelling]
**Batch**: ZE (2026-05-25)

**Surfaced by**:
- `odd-platform__java__RelationshipController__controller-class__RelationshipController.md:bugs_limitations_corner_cases.[3]` (MEDIUM) — "**No UNIQUE constraint on `relationships.data_entity_id`**: schema admits one relationship-class data_entity owning multiple `relationships` rows. The detail endpoint uses `mono()` expecting one row (`ReactiveRelationshipsRepositoryImpl.java:197`); behaviour on multi-match is undefined (JOOQ driver-specific — either TooManyResultsException or silent first-row). No collector currently produces multi-row (per docs/data-modelling/relationships.md ingestion matrix), but a collector regression or manual SQL UPSERT could trigger it."
- `odd-platform__java__RelationshipController__controller-class__RelationshipController.md:concepts.invariants.[9]` — "**`relationships.data_entity_id` has no UNIQUE constraint**: `V0_0_87__create_relation_tables.sql:1-10` declares `data_entity_id bigint` with only a FK constraint, no UNIQUE."
- Probe `P-128` (pins the multi-row sub-case)

**Description**: The `relationships` table schema (`V0_0_87__create_relation_tables.sql:1-10`) declares:

```sql
CREATE TABLE relationships (
    id BIGSERIAL PRIMARY KEY,
    data_entity_id BIGINT,
    relationship_type VARCHAR(256),
    -- FK to data_entity, but no UNIQUE constraint on data_entity_id
    FOREIGN KEY (data_entity_id) REFERENCES data_entity(id)
);
```

`data_entity_id` is a plain `BIGINT` FK; no `UNIQUE`, no `PRIMARY KEY (data_entity_id)` constraint, no partial-index constraint. The schema therefore ADMITS the case where:
- `relationships` row 1: `(id=10, data_entity_id=42, relationship_type='ERD')`
- `relationships` row 2: `(id=11, data_entity_id=42, relationship_type='GRAPH')`

i.e. one relationship-class data_entity (id=42) owning TWO `relationships` rows. The schema even ADMITS the same `relationship_type` for both rows.

The detail endpoint's repository code is:
```java
// ReactiveRelationshipsRepositoryImpl.java:194-197
final Query query = DSL.selectFrom(table)
  .where(relationshipsDataEntity.field(DATA_ENTITY.ID).eq(relationshipId))
  .and(RELATIONSHIPS.RELATIONSHIP_TYPE.eq(type.getValue()));
return jooqReactiveOperations.mono(query);  // ← expects exactly one row
```

`mono()` is jOOQ's "exactly one row" reader. On multi-row matches the behaviour is JOOQ-driver-specific:
- **TooManyResultsException** — the strictest reading (R2DBC default); HTTP 500 with cryptic SQL stack trace
- **Silent first-row** — some driver versions return the first row arbitrarily; the operator sees ONE relationship's details, the OTHER is invisible (silently lost)

The behaviour is non-deterministic; pinning the actual outcome requires Probe P-128.

**Realistic trigger conditions**:
- **No collector produces multi-row** per the `documentation/docs/data-modelling/relationships.md` ingestion matrix (only PostgreSQL and Snowflake adapters; both produce 1:1).
- **A collector regression** — a future bug in an adapter could produce duplicate `relationships` rows for one data_entity_id.
- **Manual SQL UPSERT** — an operator running maintenance scripts or migration tools could accidentally create duplicate rows.
- **A future feature** — relationships supporting multiple "types per pair" (e.g. an ERD relationship AND a GRAPH relationship between the same entities) would require this schema shape.

**Primary source citations**:
- `V0_0_87__create_relation_tables.sql:1-10` (the table definition with no UNIQUE)
- `ReactiveRelationshipsRepositoryImpl.java:194-197` (the `mono()` site)
- `documentation/docs/data-modelling/relationships.md` (the ingestion matrix that documents the current 1:1 invariant)

**Existing-ADR-or-implied-prescription**: none. The platform's convention for FK columns that should be 1:1 is to add UNIQUE constraints (e.g. `data_source.token_id BIGINT UNIQUE` per `V0_0_28__add_token.sql`). The relationships table is an exception; whether it's deliberate (forward-compatibility for multi-type-per-pair) or oversight is the maintainer's triage.

**Proposed remedy**: Three-path:

1. **Add UNIQUE constraint** (if 1:1 is the intent):
   - Schema migration: `ALTER TABLE relationships ADD CONSTRAINT relationships_data_entity_id_uniq UNIQUE (data_entity_id)`.
   - Defensive code change: convert the `mono()` to `monoOptional()` + `switchIfEmpty(NotFoundException)` (the current path is fine, but the schema is now self-enforcing).
   - Cleanup: a migration step that handles existing duplicate rows (which is unlikely but admissible).

2. **Make the reader multi-row aware** (if multi-row is the intent or possible):
   - Change `mono(query)` → `flux(query).collectList()` and map to a list response shape (requires OpenAPI schema change to `DataEntityRelationshipDetails` → `List<DataEntityRelationshipDetails>`).
   - This is a structural change; would also affect the UI consumer of the detail endpoint.

3. **Partial-UNIQUE for type** (compromise):
   - `UNIQUE (data_entity_id, relationship_type)` — allows one ERD AND one GRAPH per data_entity but not two of the same type.
   - Defensive code change: change the SQL WHERE to `data_entity_id = ? AND relationship_type = ?` (already the case at line 195) → `mono()` is now contract-correct (the pair IS unique).

Option (3) is the cleanest: matches the current behaviour at the SQL site (which already filters by type) and admits the future-feature of one-ERD-plus-one-GRAPH-per-pair.

**Severity rationale**: MEDIUM — schema-fragility class. Not currently triggered (no collector produces multi-row), but the platform's defence is "the maintainer's assumption that no collector will ever produce multi-row." A regression in any adapter trips the JOOQ-driver-specific behaviour; HTTP 500 with cryptic stack trace is the realistic outcome.

**Suggested backlog grouping**: `Schema hardening sprint` — couple with REFACTOR-627 NEW (the `relationship_id` name drift compound), REFACTOR-632 NEW (the mapper silent default for unknown `relationship_type`), REFACTOR-365 (no @ReactiveTransactional on userOwnerMappingRepository.createRelation — sibling pattern).

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-627 NEW (compound — the `mono()` expects single row AND the name drift means the parameter binds to a non-unique column).
- SUPERSEDES: none.
- CONFLICTS: none.

---
