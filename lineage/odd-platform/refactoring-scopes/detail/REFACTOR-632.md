## REFACTOR-632 — `RelationshipMapper` silently defaults to `GRAPH_RELATIONSHIP` for ANY `relationship_type` value that's not exactly `'ERD'`; the schema's `relationship_type varchar(256)` has no CHECK constraint — corrupted ingestion is admissible and silently mis-typed

**Severity**: MEDIUM
**Category**: missing-validation + silent-default-bias
**Pillars affected**: [P-02 Data Modelling, P-10 Ingestion]
**Batch**: ZE (2026-05-25)

**Surfaced by**:
- `odd-platform__java__RelationshipController__controller-class__RelationshipController.md:bugs_limitations_corner_cases.[5]` (LOW per sidecar, ELEVATED here to MEDIUM given the corrupt-ingestion-admissible class) — "**Mapper silently defaults to GRAPH_RELATIONSHIP for unknown relationship_type values**: `RelationshipMapper.java:60-62` reads `RelationshipTypeDto.ERD.name().equals(item.relationshipPojo().getRelationshipType()) ? ENTITY_RELATIONSHIP : GRAPH_RELATIONSHIP`. Any value that is NOT exactly 'ERD' falls into GRAPH_RELATIONSHIP — including null, lowercase 'erd', misspellings, or new types added without code updates. The schema's `relationship_type` column is `varchar(256)` with no CHECK constraint (V0_0_87__create_relation_tables.sql:7), so corrupted ingestion is admissible."

**Description**: The `RelationshipMapper.mapListToRelationshipPage` MapStruct mapper applies this type-classification logic:

```java
// RelationshipMapper.java:60-62
RelationshipTypeDto.ERD.name().equals(item.relationshipPojo().getRelationshipType())
  ? ENTITY_RELATIONSHIP
  : GRAPH_RELATIONSHIP
```

— a ternary that classifies any row's `relationship_type` string into one of TWO output types:
- `ENTITY_RELATIONSHIP` if `relationship_type` is EXACTLY the string `'ERD'`
- `GRAPH_RELATIONSHIP` otherwise (the silent default branch)

The "otherwise" branch absorbs:
- `null` (NULL in the database)
- `'erd'` (lowercase)
- `'Erd'` (mixed case)
- `'ERD '` (trailing whitespace)
- `'ER'` (typo)
- `'GRAPH'` (the legitimately-other value, though this case is also handled correctly)
- ANY future value added to the schema without updating the mapper (e.g. a hypothetical `'HIERARCHICAL'` relationship type)
- Garbage / corrupted data injected via direct SQL UPSERT

The schema admits all of these — `relationships.relationship_type varchar(256)` (per `V0_0_87__create_relation_tables.sql:7`) has NO CHECK constraint:

```sql
relationship_type VARCHAR(256)  -- no CHECK (relationship_type IN ('ERD', 'GRAPH'))
```

So the schema-level invariant is "relationship_type is any string up to 256 chars"; the mapper-level interpretation is "any string that's not exactly 'ERD' is a GRAPH". The asymmetry is silent.

**Operator-visible failure modes**:

1. **Case-variation from collectors** — if a collector emits `'erd'` (lowercase) due to a different platform's convention, the row inserts cleanly but the UI / API shows it as a GRAPH relationship. The operator's downstream filters on `type=ERD` miss it.

2. **Schema evolution** — a future relationship_type (e.g. `'HIERARCHICAL'` for parent-child relationships in OLAP cubes) added to the schema via migration BUT not updated in the mapper falls into GRAPH_RELATIONSHIP. Operators selecting `type=HIERARCHICAL` get the GRAPH branch; they cannot distinguish their new type.

3. **Corrupted ingestion** — a buggy adapter version (or manual SQL UPSERT) inserting `''` or `'unknown'` produces rows that ALL render as GRAPH. The operator sees their data as graph relationships even when it isn't.

4. **NULL drift** — if a row has `relationship_type IS NULL`, the mapper's `String.equals` call returns false → row is GRAPH. There's no error, no log line.

**The schema-side fix**:

```sql
ALTER TABLE relationships
  ADD CONSTRAINT relationships_relationship_type_check
  CHECK (relationship_type IN ('ERD', 'GRAPH'));
```

— blocks invalid values at INSERT time. A collector trying to write `'erd'` gets a constraint-violation 400.

**The mapper-side fix**:

```java
// RelationshipMapper.java — replace the ternary with explicit handling
final String type = item.relationshipPojo().getRelationshipType();
if ("ERD".equals(type)) return ENTITY_RELATIONSHIP;
if ("GRAPH".equals(type)) return GRAPH_RELATIONSHIP;
throw new IllegalStateException(
    "Unknown relationship_type: " + type + " (row id: " + item.id() + ")");
```

— fail-loud on unknown values; surface the bad row's id for operator-debugging.

The two fixes together are defence-in-depth: the schema constraint prevents bad ingestion; the mapper validation catches any rows that pre-date the constraint or arrive via paths that bypass the constraint.

**Primary source citations**:
- `RelationshipMapper.java:60-62` (the ternary)
- `V0_0_87__create_relation_tables.sql:7` (the schema without CHECK)
- `RelationshipTypeDto` enum (the Java-side enum)
- `documentation/docs/data-modelling/relationships.md` (the operator-facing doc that describes ERD vs GRAPH as the only two types)

**Existing-ADR-or-implied-prescription**: none. The platform's convention for enum-shaped string columns is to use jOOQ-typed enums + schema CHECK constraints (e.g. `data_entity.entity_class_ids INTEGER[]` references the entity class enum via FK; alert states use `varchar` BUT with `AlertStatusEnum` validation per the AlertController sidecar). The relationships type is an exception — string-based without validation.

**Proposed remedy**: Two-step fix:
1. **Schema** — add the CHECK constraint via a new migration `V0_0_NN__add_relationships_type_check.sql`. Backfill: if any rows have invalid values (NULL, lowercase, etc.), either normalise to canonical case ('ERD'/'GRAPH') or delete them. Per the docs/data-modelling/relationships.md ingestion matrix, only PostgreSQL and Snowflake adapters produce rows today; both produce canonical case, so backfill is trivial in practice.
2. **Mapper** — replace the ternary at `RelationshipMapper.java:60-62` with explicit handling that fails-loud on unknown values. Add an integration test asserting the mapper throws on a corrupted-row scenario.

**Severity rationale**: MEDIUM (elevated from sidecar's LOW) — bounded today by the 1:1-collector-convention, but silently mis-typing data is a class of bug that surfaces on schema evolution, on collector regression, or on manual SQL maintenance. The fix is small and the cost-benefit favours adding the validation now rather than later.

**Suggested backlog grouping**: `Schema hardening sprint` — couple with REFACTOR-628 NEW (no UNIQUE constraint on data_entity_id), REFACTOR-627 NEW (relationship_id name drift), REFACTOR-008 (SECURITY_RULES path mismatch — sibling enum-vs-string-validation gap).

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-628 NEW (sibling schema-fragility on the same table).
- SUPERSEDES: none.
- CONFLICTS: none.

---
