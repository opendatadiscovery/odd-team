## ADR-CANDIDATE-131 — Single-query DTO materialisation via `jsonArrayAgg(table.asterisk())` + `jooqRecordHelper.extractAggRelation` — the platform's standard idiom for projecting one-to-many relations into a parent DTO without N+1 round-trips, repeating across 16+ repositories

**Severity**: HIGH
**Classification**: promote
**Pillars affected**: [P-01-data-discovery, P-06-data-glossary, P-08-management, P-09-security]
**Support count**: 4 sidecars (batch H ReactivePolicyRepositoryImpl + batch I ReactiveOwnerRepositoryImpl/ReactiveDatasetFieldRepositoryImpl + batch N ReactiveTermRepositoryImpl + batch N ReactiveRoleRepositoryImpl) + cross-batch Grep returning 16 files using the same idiom
**Axes present**: repositories
**Batch**: N (2026-05-19)

**Surfaced by**:
- `ReactiveRoleRepositoryImpl.md:implicit_adrs.[4]` (HIGH) — "The dto-aggregation methods use `jsonArrayAgg(POLICY.asterisk())` to materialise the policies-attached-to-a-role view in a SINGLE query rather than N+1 round-trips (ReactiveRoleRepositoryImpl.java:43, 67, 85). The deserialization path is the project's standard `jooqRecordHelper.extractAggRelation(r, fieldName, PolicyPojo.class)` (RoleRecordMapper.java:21, 27). The decision is uniform across every Reactive*Repository that returns a multi-table dto: tag relations (ReactiveTermRepositoryImpl, ReactiveOwnerRepositoryImpl, ReactiveLookupTableRepositoryImpl, etc. — Grep returned 16 files using `jsonArrayAgg`). The pattern is the platform-wide commitment: 'one query per logical view, not one query per row of a join.'" — intent_anchor: "the static import is `org.jooq.impl.DSL.jsonArrayAgg` and the helper class is named `JooqRecordHelper`; both names are explicit about the JSON-aggregation intent"
- `ReactiveTermRepositoryImpl.md` — `getTermDetailsDto` (lines 194-238) materialises 7 `jsonArrayAgg(...)` projections on a single root row: ownerships, owners, titles, tags, assigned-terms, assigned-term-namespaces, assigned-term-relations — see ADR-CANDIDATE-124's cross-reference to the 11-LEFT-JOIN density.
- Cross-batch: 16 repository files use `jsonArrayAgg` (per the Grep result in ReactiveRoleRepositoryImpl sidecar).

**Decision statement**: ODD's reactive repositories use `org.jooq.impl.DSL.jsonArrayAgg(table.asterisk())` as the **canonical idiom** for materialising one-to-many relations into a parent DTO's collection field in a single query. The mechanical recipe is:

1. Build the parent SELECT with `LEFT JOIN`s to every relation table.
2. Project EVERY relation table's columns as `jsonArrayAgg(relationTable.asterisk()).as(AGG_X_FIELD)` — the alias is a constant naming the field (e.g., `AGG_POLICY_FIELD = "policy_relations"`).
3. `GROUP BY` the parent table's full field list (typically `TERM.fields()` + `NAMESPACE.fields()` if a 1:1 JOIN is present).
4. Map the result via `jooqRecordHelper.extractAggRelation(record, AGG_X_FIELD, RelationPojo.class)` — which parses the Postgres-emitted JSON array, deserialises each element via Jackson into the typed POJO class, and returns a `Set<RelationPojo>` or `List<RelationPojo>`.

The architectural choices encoded:
- **(a) ONE query per logical view, not per row of join** — the alternative split-query design (one round-trip for the parent + N round-trips for each relation's rows + assembly in Java) would be O(N) DB round-trips per detail-page render. The jsonArrayAgg idiom collapses to ONE round-trip per detail page. The Postgres planner is well-tuned for jsonArrayAgg; the application-side Jackson deserialization is a small fixed cost.
- **(b) Uniform idiom across 16+ repositories** — Term (7 aggregations), Role (1 aggregation), Owner (multi-aggregation), DatasetField (multi-aggregation), LookupTable (multi-aggregation), Policy (no aggregation needed — flat), DataEntity (full detail page with 7+ aggregations) all use the same pattern. The maintainer-extension contract is implicit: any new repository returning a parent-with-relations DTO uses this idiom.
- **(c) Composition with the CTE-first paginate-then-aggregate** (ADR-CANDIDATE-123 NEW) — list-DTO methods first paginate via CTE (bounded primary-entity rows), THEN apply jsonArrayAgg over the bounded set. The CTE is the row-count discipline; the jsonArrayAgg is the projection discipline. Detail-DTO methods (`getTermDetailsDto`, `getRoleByName`, etc.) skip the CTE because they're single-row lookups.
- **(d) The cost: GROUP BY captures every primary-table field** — for Term, the GROUP BY includes `TERM.fields() + NAMESPACE.fields()` (two `toList()`'d arrays). The Postgres planner sees a wide GROUP key; correctness is preserved but the query plan is fragile to JOIN reordering and statistics drift. Documented as REFACTOR-373 (LOW) — `getTermDetailsDto` Cartesian fan-out scales O(N×M×P×Q×R) before the DISTINCT-via-COUNT-DISTINCT reduces.
- **(e) Schema-name dependency** — the `jsonArrayAgg(POLICY.asterisk())` projection serialises column names verbatim; the `extractAggRelation` deserialiser uses Jackson with the matching POJO field names. A Flyway-renamed column without corresponding jOOQ-regeneration silently corrupts the deserialised result. Documented as the schema-drift risk in the cross-batch known_security_gaps.

**Wisdom test**: PASS on all three questions.
1. **Intentional?** YES — the static import `org.jooq.impl.DSL.jsonArrayAgg` and the helper class name `JooqRecordHelper` are explicit about the JSON-aggregation intent. The 16-file consistency is the maintainer-extension contract. The constant naming (`AGG_X_FIELD`) is a deliberate ergonomic.
2. **Structural impact?** YES — affects every DTO-shaped repository read; affects the per-request query count; affects the Jackson dependency surface; affects every future repository's read shape; affects the schema-vs-application coupling for column renames.
3. **Switching to split-queries is REFACTORING or STRUCTURAL?** STRUCTURAL — switching every aggregation to N+1 round-trips would explode the per-page DB cost (a Term detail page with 100 linked entities + 50 dataset-fields + 30 query-examples would go from 1 round-trip to ~200). The performance budget is structural; the pattern IS the architecture.

**Evidence**:
- ReactiveRoleRepositoryImpl.md says: "The dto-aggregation methods use `jsonArrayAgg(POLICY.asterisk())` to materialise the policies-attached-to-a-role view in a SINGLE query rather than N+1 round-trips ... The decision is uniform across every Reactive*Repository that returns a multi-table dto ... The pattern is the platform-wide commitment: 'one query per logical view, not one query per row of a join.'"
- ReactiveTermRepositoryImpl.java:194-238 — `getTermDetailsDto` with 7 jsonArrayAgg projections on a single row + 4 countDistinct aggregates
- ReactiveRoleRepositoryImpl.java:43, 67, 85 — `jsonArrayAgg(POLICY.asterisk())` three times across the three custom methods
- RoleRecordMapper.java:21, 27 — `jooqRecordHelper.extractAggRelation` consumer side

**Existing ADR**: none. **Composes with ADR-CANDIDATE-123 NEW** (CTE-first paginate-then-aggregate — the row-count discipline that jsonArrayAgg works within). **Composes with ADR-CANDIDATE-068** (two-tier soft-delete — the LEFT JOINs that jsonArrayAgg consumes must filter `deleted_at IS NULL` per ADR-CANDIDATE-068's invariant; missing-filter is the REFACTOR-357 / REFACTOR-230 gap).

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-357 NEW — Role.getDto/listDto/getByName don't filter soft-deleted policies on the LEFT JOIN feeding `jsonArrayAgg(POLICY.asterisk())`; orphan role_to_policy bindings still grant permissions — mirror of batch-H REFACTOR-230 (HIGH).
- REFACTOR-373 NEW — `getTermDetailsDto` Cartesian fan-out scales O(N×M×P×Q×R) before DISTINCT reduces; performance ceiling undocumented (LOW).

**Proposed action**: Promote to `adrs/drafts/jsonarrayagg-single-query-dto-materialisation.md` (new ADR). Document:
- The idiom (`jsonArrayAgg(table.asterisk()).as(AGG_X_FIELD)` + `extractAggRelation`).
- The cross-repository consistency (16+ files; verbatim pattern).
- The composition with ADR-CANDIDATE-123 (CTE-first for list-DTOs; direct for single-row detail-DTOs).
- The cost (GROUP BY captures full parent field list; Cartesian fan-out before DISTINCT).
- The schema-drift risk (column rename without jOOQ regeneration silently corrupts deserialisation).
- The maintainer-extension contract: new DTO methods use this idiom; future schema migrations renaming relation columns trigger jOOQ regeneration.
- The soft-delete-filter discipline (every relation LEFT JOIN consumed by jsonArrayAgg MUST filter `deleted_at IS NULL` — see REFACTOR-357 / -230 for the gap surface).

Cross-link with ADR-CANDIDATE-123, -068, -070, -071.

**Severity rationale**: HIGH — codebase-wide query architecture. Affects every repository's read-shape, every DTO-payload's serialisation cost, every detail-page render's DB-round-trip count, every future repository's idiomatic discipline. Compatible-change calculus for any future read-side refactor requires understanding this ADR. The 16-file consistency is the architectural anchor; a regression in one file would be visible as immediate performance / correctness drift.

---
