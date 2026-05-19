## ADR-CANDIDATE-123 — CTE-first paginate-then-aggregate is the platform's standard read shape for multi-relation DTO list views — `paginate(homogeneousQuery, orderFields, offset, limit).asTable('X_cte')` wraps the LIMIT scope BEFORE the wide aggregation joins, eliminating JOIN-fan-out × LIMIT row-multiplicity bug across every repository's list-DTO surface

**Severity**: HIGH
**Classification**: promote
**Pillars affected**: [P-01-data-discovery, P-06-data-glossary, P-08-management, P-09-security]
**Support count**: 4 sidecars (batch K TermServiceImpl + batch N ReactiveTermRepositoryImpl + batch N ReactiveRoleRepositoryImpl + batch N ReactiveTagRepositoryImpl) + cross-batch evidence from ReactiveDataEntityRepositoryImpl + ReactiveOwnerRepositoryImpl
**Axes present**: repositories
**Batch**: N (2026-05-19)

**Surfaced by**:
- `ReactiveTermRepositoryImpl.md:implicit_adrs.[2]` (HIGH) — "The CTE-first paginate-then-aggregate pattern is the load-bearing read shape for `listTermRefDtos` / `findByState` / `listByTerm`. Each method first builds a `paginate(homogeneousQuery, orderFields, offset, limit)` Select over the TERM table (with name + namespace JOINs but BEFORE the wide aggregation JOINs), then wraps it as a CTE (`termCTE = paginate(...).asTable('term_cte')`), then joins NAMESPACE + the link tables + the json-aggregations OUTSIDE the CTE. The design prevents row multiplication from the LEFT JOIN fan-out... identical to `ReactiveDataEntityRepositoryImpl`'s `cteDataEntitySelect` helper."
- `ReactiveRoleRepositoryImpl.md:implicit_adrs.[5]` (HIGH) — "The listDto method uses a CTE-then-join pattern (ReactiveRoleRepositoryImpl.java:55-71) — first paginate the ROLE rows ASC by id, then LEFT JOIN role_to_policy + policy and aggregate. This is deliberate: without the CTE, a role with N policies would expand into N rows BEFORE pagination, so a `LIMIT 5` would not yield 5 roles but rather a corrupted page boundary. The CTE pattern correctly decouples row-multiplicity from page size. The pattern is the platform's standard 'paginate-then-aggregate' shape across multi-relation dto views — same pattern in ReactiveTermRepositoryImpl, ReactiveOwnerRepositoryImpl listDto views."
- `ReactiveTagRepositoryImpl.md` evidence — `listMostPopular` (`:137-167, 373-392`) uses the same CTE-first shape with `tag_cte` alias wrapping the paginated tag select before the UNION-ALL across the relation tables for aggregate.
- Cross-batch: `ReactiveDataEntityRepositoryImpl.md` (batch H) — `cteDataEntitySelect` helper named verbatim as the architectural anchor.

**Decision statement**: ODD's repository layer codifies a **CTE-first paginate-then-aggregate** read shape for every list-DTO method that needs to project a primary entity with N>=1 LEFT-JOINed relation aggregations. The mechanical recipe is:

1. Build `homogeneousQuery` — a single-SELECT over the primary table (TERM / ROLE / TAG / DATA_ENTITY) with only the JOINs that DON'T fan-out (e.g., `JOIN NAMESPACE` for Term — 1:1) plus the `WHERE` predicates.
2. Wrap with `paginate(homogeneousQuery, orderFields, (page-1)*size, size)` — applies `ORDER BY` + `LIMIT` + `OFFSET` to bound the row set to exactly `size` primary rows.
3. Materialise as a CTE via `.asTable('{primary}_cte')` — the CTE alias is naming-conventional (`term_cte`, `role_cte`, `tag_cte`, `data_entity_cte`).
4. Build the outer SELECT joining the CTE to the wide relation tables (LEFT JOIN `role_to_policy + policy`, or LEFT JOIN `data_entity_to_term + dataset_field_to_term + tag_to_term + ...`).
5. Project `jsonArrayAgg(...)` of each relation column; GROUP BY the CTE's projection fields (jOOQ's `remapCte` helper unwraps the CTE-aliased fields).
6. Wrap the result via `jooqQueryHelper.pageifyResult(stream, totalCountMono)` to produce `Page<DTO>` with `total + hasNext`.

The architectural design solves a load-bearing correctness bug: WITHOUT the CTE, a primary entity with N>1 fan-out relations would multiply into N rows BEFORE `LIMIT` — a `LIMIT 5` over a 10-policy role would return 1 distinct role (not 5), or worse, fragment a single role across two paginated pages. The CTE bounds the row count to exactly `size` primary entities, then performs the fan-out over EXACTLY those rows, with the GROUP BY collapsing back to one DTO per primary entity.

The architecture composes:
- **(a)** ONE canonical pattern for every list-DTO method. Maintainer extension: copy the shape verbatim with a new CTE alias and adjusted JOIN topology.
- **(b)** Per-method consistency for the count side. `pageifyResult` requires a `count(...)` Mono; the count query uses the SAME `homogeneousQuery` predicates (without the JOIN fan-out) to ensure `total` matches the paginated list. (See REFACTOR-363 — `listTermRefDtos` violates this by `fetchCount(nameQuery)` ignoring the `updatedAt` range, exposing the maintainer-extension contract.)
- **(c)** CTE-vs-source-table double-mapping. The `mapRecordToRefDto` helper has TWO overloads — one for CTE-aliased fields (consumed by `listTermRefDtos`, `findByState`, `listByTerm`), one for direct-table fields (consumed by `getTermDetailsDto`, `getDataEntityTerms`). Maintainers must pick the correct overload; the CTE methods use `jooqRecordHelper.remapCte(record, 'term_cte', TERM)` to unwrap.
- **(d)** Cross-table consistency. The Term repository has 3 CTE-using methods all reusing `term_cte` as alias (acceptable because jOOQ composes each query independently — see REFACTOR-376 for the cosmetic name-reuse concern). Role + Tag + DataEntity follow the same naming pattern.

**Wisdom test**: PASS on all three questions.
1. **Intentional?** YES — the CTE alias name (`term_cte`, `role_cte`, `tag_cte`, `data_entity_cte`) is verbatim across 4 repositories. The `paginate(...)` helper is named for the purpose. The CTE-then-aggregate sequence is reproduced as a mechanical recipe across every list-DTO method. The maintainer-extension contract is implicit in the naming consistency.
2. **Structural impact?** YES — affects every list-DTO method's query shape, every `mapRecordToRefDto`-style mapper's overload signature, every count-vs-list pagination contract, every future list-DTO method's recipe. A regression replacing the CTE with a direct JOIN would silently break LIMIT semantics on every list-DTO surface — pagination would either return wrong counts or fragment entities across page boundaries.
3. **Adding/removing the CTE is REFACTORING or STRUCTURAL?** STRUCTURAL — removing the CTE wrapping requires every list-DTO method to switch to a different correctness model (e.g., `SELECT DISTINCT ... LIMIT` which has its own ORDER BY interaction quirks; or `WITH ORDINALITY` ranking; or pre-aggregate sub-selects). The CTE-first paginate-then-aggregate IS the architecture, not a stylistic choice.

**Evidence**:
- ReactiveTermRepositoryImpl.md says: "`ReactiveTermRepositoryImpl.java:116-126` (listTermRefDtos CTE shape) + `:315-327` (findByState CTE shape) + `:467-484` (listByTerm CTE shape) — intent_anchor: the CTE alias `term_cte` is verbatim reused across 4 method bodies; the design rule (paginate first, aggregate after) is consistent across both this repository AND the sibling data-entity repository"
- ReactiveRoleRepositoryImpl.md says: "ReactiveRoleRepositoryImpl.java:55-71 (CTE construction) + jooqQueryHelper.pageifyResult at lines 75-79 — intent_anchor: the `paginate(...)` helper is named for the purpose and the CTE is explicitly named `role_cte` (line 62); the variable name `roleCTE` and the `jooqQueryHelper.pageifyResult` helper both encode the design intent"
- ReactiveTagRepositoryImpl.md evidence — `listMostPopular` (`:137-167, 373-392`) uses `tag_cte` to wrap the paginated tag rows before the UNION-ALL aggregate.

**Existing ADR**: none. **Composes with ADR-CANDIDATE-068** (two-tier soft-delete — the CTE methods all carry soft-delete filter inside the homogeneousQuery, so soft-deleted rows are excluded BEFORE the CTE materialises). **Composes with ADR-CANDIDATE-070** (partial unique index — name uniqueness is enforced separately; the CTE pattern is orthogonal). **Composes with ADR-CANDIDATE-131 NEW** (jsonArrayAgg materialisation — the relation-aggregation idiom that consumes the CTE).

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-363 NEW — `listTermRefDtos` count-vs-list filter mismatch (the `fetchCount(nameQuery)` does NOT respect the `updatedAt` date range; UI shows wrong pagination total).
- REFACTOR-366 NEW — Tag `listByTerm` pagination inconsistency (mirrors the Term repository's `listByTerm` exception to the pattern — outer LIMIT instead of CTE pageifyResult).
- REFACTOR-376 NEW — three CTEs share `term_cte` alias (cosmetic refactoring brittleness).
- REFACTOR-378 NEW — `listMostPopular`'s `tag_cte` is hardcoded (no current caller composes them but defensive concern).

**Proposed action**: Promote to `adrs/drafts/cte-first-paginate-then-aggregate.md` (new ADR). Document:
- The mechanical recipe (6 steps above).
- The bug the pattern prevents (JOIN-fan-out × LIMIT row-multiplicity).
- The cross-table consistency (every list-DTO method on every Reactive*Repository follows this pattern; exceptions like Term `listByTerm` are explicit non-conformers with documented broken-paginator consequence).
- The count-side coupling (count query MUST share the homogeneousQuery predicates — see REFACTOR-363 for the contract failure).
- The CTE-naming convention (`{primary}_cte`).
- The maintainer-extension contract: future list-DTO methods follow this recipe verbatim.

Cross-link with ADR-CANDIDATE-068, ADR-CANDIDATE-070, ADR-CANDIDATE-131 NEW, ADR-CANDIDATE-075 (the repository-architectural-layer family).

**Severity rationale**: HIGH — codebase-wide query-correctness architecture. Affects every list-DTO method on every repository. A regression breaking the CTE bounding would silently corrupt pagination across every catalog enumeration surface; the failure mode is subtle (counts look right, entities fragmented across pages) and would surface to operators as "the catalog list is showing duplicates / skipping rows" with no observability signal. Compatible-change calculus for any future list-DTO endpoint requires understanding this ADR.

---
