## REFACTOR-334 — `metadata_field_value.active` column silently drops to NULL on every UPDATE because the pojo's `getActive()` is null and `boolean DEFAULT TRUE` applies on INSERT only — buggy-default; affects every metadata edit

**Severity**: MEDIUM
**Category**: buggy-default (silent state-corruption)
**Pillars affected**: [P-01-data-discovery]
**Batch**: L (2026-05-19)

**Surfaced by**:
- `odd-platform__java__DataEntityController__controller-method__upsertDataEntityMetadataFieldValue.md:bugs_limitations_corner_cases.[4]` (MEDIUM) — "`active` column dropped to NULL on every UPDATE — `ReactiveMetadataFieldValueRepositoryImpl.java:98` writes `.set(METADATA_FIELD_VALUE.ACTIVE, pojo.getActive())`, but the upsert path's pojo construction at `DataEntityServiceImpl.java:292-295` never calls `setActive(...)`. The jOOQ-generated `MetadataFieldValuePojo.getActive()` returns boxed `Boolean` null when unset. The DB column is `boolean DEFAULT TRUE`, but DEFAULTs apply on INSERT only; an UPDATE that sets the column writes the explicit NULL, dropping a previously-TRUE row to NULL. This is a silent state-corruption bug — every edit converts an active=TRUE row to active=NULL"

**Description**: The `metadata_field_value` table is defined as `(data_entity_id, metadata_field_id, value text, active boolean DEFAULT TRUE)` per `V0_0_1__init.sql:175-186`. The DEFAULT TRUE applies on INSERT only — Postgres column DEFAULTs do NOT apply on UPDATE that explicitly SETs the column.

The UPDATE statement at `ReactiveMetadataFieldValueRepositoryImpl.java:97-98` is:
```java
DSL.update(METADATA_FIELD_VALUE)
    .set(VALUE, pojo.getValue())
    .set(ACTIVE, pojo.getActive())    // <-- the bug
    .where(METADATA_FIELD_ID.eq(...).and(DATA_ENTITY_ID.eq(...)))
    .returning()
```

The pojo is constructed at `DataEntityServiceImpl.java:292-295`:
```java
final MetadataFieldValuePojo pojo = new MetadataFieldValuePojo()
    .setDataEntityId(dataEntityId)
    .setMetadataFieldId(metadataFieldId)
    .setValue(formData.getValue());   // no setActive(...) call
```

The jOOQ-generated `MetadataFieldValuePojo.getActive()` returns boxed `Boolean` `null` when the field was never set. The `.set(ACTIVE, null)` writes an explicit NULL to the column, dropping a previously-TRUE row to NULL.

The failure mode: every metadata edit on a previously-active field flips the `active` flag from TRUE to NULL. If any downstream platform code filters `WHERE metadata_field_value.active = TRUE` (rather than `IS DISTINCT FROM FALSE`), the edited rows would silently disappear from those queries. The actual downstream usage of the `active` column needs auditing to gauge severity — neither the file-analyser sidecar nor this scope identified the consumers definitively; the gap is the SILENT state corruption regardless of consumer impact.

This is the SECOND buggy-default scope on the cross-batch substrate (cross-link **REFACTOR-198** — `applyStatus` ordering bug nulls `statusUpdatedAt` on every status transition; same shape — silent column-state drop on update). Both bugs share the failure mode "UPDATE writes the wrong value silently because the calling code didn't set the field on the pojo." The cross-batch pattern: write-path pojos that bypass setter calls + UPDATE statements that explicitly SET every column from the pojo + DB defaults that protect INSERT but not UPDATE = silent state corruption on every edit. Future maintainers should audit every `.set(column, pojo.getX())` site against the pojo's construction to verify the field is initialised before the UPDATE.

**Primary source citations**:
- `ReactiveMetadataFieldValueRepositoryImpl.java:97-98` (the SET clause writing null)
- `DataEntityServiceImpl.java:292-295` (pojo construction without setActive)
- `V0_0_1__init.sql:180` (the `active boolean DEFAULT TRUE` column definition)
- Cross-batch: REFACTOR-198 (`applyStatus` ordering bug — same buggy-default shape)

**Existing-ADR-or-implied-prescription**: none. The maintainer's narrow-validator stance (per ADR-CANDIDATE-048 — `@PostConstruct` validators throwing `IllegalStateException`) is intentionally LIMITED to boot-time properties; runtime pojo-construction is not validated. The IMPLIED prescription is that every UPDATE statement should defend against null-pojo-fields either by reading the existing row's state first OR by using jOOQ's UPDATE-without-setting-unset-fields idiom.

**Proposed remedy**: Two options. **(a) Read-then-write**: at the entry of `upsertMetadataFieldValue`, fetch the existing pojo via `reactiveMetadataFieldValueRepository.get(dataEntityId, metadataFieldId)`, copy the `active` value onto the upsert pojo before the UPDATE. Cost: one extra DB round-trip per edit. **(b) Skip-null-fields update**: use jOOQ's coalesce idiom `coalesce(?, ACTIVE)` so the column is updated only when the pojo carries a non-null value; bind the pojo's `active` as a bind parameter. Lower cost (no extra round-trip) but more fragile (depends on every callsite respecting the convention). **(c) Default Boolean.TRUE in pojo constructor**: change `DataEntityServiceImpl.java:292-295` to call `.setActive(true)` on the pojo. Lowest cost; matches the column DEFAULT explicitly. The maintainer's triage between (a) and (c) depends on whether the `active` flag is intended to be operator-toggleable through this endpoint (in which case the form should accept it) or always-true (in which case (c) is the simplest fix).

Companion: audit the `active` column's CONSUMERS to determine whether NULL-vs-TRUE is currently affecting any downstream behaviour. If any query filters `WHERE active = TRUE`, the cumulative impact is "every edited metadata row disappears from that view"; if every consumer uses `IS DISTINCT FROM FALSE`, the impact is zero.

**Severity rationale**: MEDIUM — silent state corruption on every metadata edit; the downstream impact is consumer-dependent. Cross-batch with REFACTOR-198 (same shape, different column); the pattern is bigger than this one file. Not HIGH because no data is lost (the value column is correctly written; only the auxiliary `active` flag is mishandled) but the systematic nature (every edit corrupts the flag) merits attention.

**Suggested backlog grouping**: `DataEntityController buggy-default audit sprint` (paired with REFACTOR-198 applyStatus reorder). Companion `TEST-NNN — pin the active=TRUE invariant across UPDATE statements`.

---
