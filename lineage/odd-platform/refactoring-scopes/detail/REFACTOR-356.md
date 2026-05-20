## REFACTOR-356 — `term_to_term.deleted_at` retained at V0_0_91 but never filtered at 7+ read sites in ReactiveTermRepositoryImpl — either dead schema (V0_0_NNN cleanup needed mirroring V0_0_76) or missing-filter (application-side soft-delete-resurrection surface)

**Severity**: HIGH
**Category**: schema-vs-application drift (architectural inconsistency in soft-delete pattern)
**Surfaced by**:
- `ReactiveTermRepositoryImpl.md:bugs_limitations_corner_cases[0]` (PRIMARY-SOURCE — the 7-site enumeration)
- `ReactiveTermRepositoryImpl.md:security.known_security_gaps[0]`
- Cross-batch: ADR-CANDIDATE-069 (edge tables hard-delete) + V0_0_76 (the cleanup migration)

**Description**: The V0_0_76 migration (`V0_0_76__term_relations_hard_delete.sql:1-22`) was a deliberate architectural cleanup: it DELETED rows where `deleted_at IS NOT NULL` then DROPPED the `deleted_at` column at THREE term-related link tables (`data_entity_to_term`, `dataset_field_to_term`, `tag_to_term`). The migration's name is the architectural commit message. The cleanup made term-link tables hard-delete-only per ADR-CANDIDATE-069 (edge tables are hard-delete by design).

A later migration **V0_0_91** (`V0_0_91__add_term_to_term.sql:1-12`) created a NEW term-link table `term_to_term` with the schema:

```sql
CREATE TABLE term_to_term (
  target_term_id BIGINT NOT NULL,
  assigned_term_id BIGINT NOT NULL,
  is_description_link BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at TIMESTAMP,   -- ← RETAINED, unlike the V0_0_76 cleanup
  PRIMARY KEY (target_term_id, assigned_term_id, is_description_link),
  ...
);
```

The `deleted_at` column was RETAINED — unlike its V0_0_76-cleaned siblings. The application code at **7 distinct read sites** in `ReactiveTermRepositoryImpl` queries `term_to_term` WITHOUT filtering `deleted_at IS NULL`:

- Line 198-199 — `getTermDetailsDto` assigned-terms aggregation
- Line 227-231 — `getTermDetailsDto` linked-terms count
- Line 324-325 — `findByState` linked_terms count
- Line 345 — `findByState` count side
- Line 429-430 — `hasDescriptionRelations` term-to-term branch
- Line 448-454 — `getLinkedTermsByTargetTermId`
- Line 472-491 — `listByTerm`
- Line 510-523 — `getTermByIdAndLinkedTermId`

The asymmetry is the architectural drift:

- **(a) If the V0_0_91 column-retention was an OVERSIGHT**: a future V0_0_NNN migration mirroring V0_0_76's data_entity_to_term cleanup would `DELETE FROM term_to_term WHERE deleted_at IS NOT NULL` then `DROP COLUMN deleted_at`. The migration would close the schema inconsistency under ADR-CANDIDATE-069.
- **(b) If the V0_0_91 column-retention was DELIBERATE (future soft-delete provision)**: the application code MUST add `term_to_term.deleted_at IS NULL` filter to every read site, OR a deliberate operator-driven workflow that writes `deleted_at` would silently leave soft-deleted relationships visible to all reads — producing soft-delete-resurrection-on-edit behaviour that no other term-link table exhibits.

**Today's status**: no code path writes `term_to_term.deleted_at`, so the concern is theoretical. A direct DB UPDATE setting the column (operator hot-fix; future admin tool) would NOT remove the relationship from any read path. The maintainer's intent is ambiguous from the migration alone; both interpretations are defensible from the code.

**Primary source citations**:
- `V0_0_91__add_term_to_term.sql:6` — `deleted_at TIMESTAMP` retained
- `V0_0_76__term_relations_hard_delete.sql:1-22` — the comparator (the cleanup that V0_0_91 did NOT mirror)
- `V0_0_77__data_entity_term_description.sql:13-14, 28-29` — the PK extension that depends on hard-delete (composes with -069's "PK can include is_description_link only because edges are hard-delete")
- `ReactiveTermRepositoryImpl.java:198-199, 227-231, 324-325, 345, 429-430, 448-454, 472-491, 510-523` — the 7 read sites (verified by primary-source grep)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-069 (edge tables are hard-delete by design) PRESCRIBES the cleanup; this scope is the conformance gap. The maintainer-extension contract under -069 is "future edge tables follow hard-delete-by-default; V0_0_76 is the precedent migration for cleaning up legacy soft-delete edge tables". The V0_0_91 migration adds an edge-style table WITHOUT cleanup — the inconsistency is the architectural drift.

**Proposed remedy**: Three options:
1. **Schema cleanup (recommended)** — add migration V0_0_NNN mirroring V0_0_76: `DELETE FROM term_to_term WHERE deleted_at IS NOT NULL` (today zero rows) then `DROP COLUMN deleted_at`. Closes the schema inconsistency. No application-code changes required.
2. **Application-side filter** — add `term_to_term.deleted_at IS NULL` to every read site. Preserves the column for future soft-delete provision. UX consequence: every term-to-term read now has an extra predicate; if a future feature DOES write `deleted_at`, the read paths are already prepared. The cost is the 7 code edits today PLUS a maintainer-extension contract for every new term_to_term read.
3. **Document the asymmetry** — accept the V0_0_91 retention as a deliberate future-provision, document the absence of soft-delete behaviour in `documentation/docs/features/data-glossary.md`, and add a CHECK constraint preventing writes to `deleted_at` (CHECK `deleted_at IS NULL`) so the column remains unused.

Option 1 is the cleanest; Option 2 hedges. Option 3 is the smallest-blast-radius documentation fix.

**Severity rationale**: HIGH — schema-vs-application drift on a load-bearing audit-trail table. The `term_to_term` table participates in the Term-rename-protection / Term-delete-protection guard (`hasDescriptionRelations` per ADR-CANDIDATE-124 NEW). A future operator-driven hot-fix that sets `term_to_term.deleted_at` would silently soft-resurrect the relationship at every read site — including the `hasDescriptionRelations` branch — producing a corner case where a Term mentioned in a description-soft-deleted-but-not-hard-deleted relation passes the rename-protection guard incorrectly. The scope is HIGH not because today's behaviour is broken (no writes today) but because the schema retention creates a HIDDEN OPERATIONAL DEFAULT that is misaligned with the architecture.

**Suggested backlog grouping**: `Schema-cleanup batch` — pair with REFACTOR-239 (Policy's `is_deleted` dead schema). Both are schema-vs-application drift cleanups where the migration intent is clear.

---
