## REFACTOR-241 — `getLineageRelations(List<String>)` builds OR-predicate where both conjuncts are logically equivalent — decorative SQL misleads future maintainers

**Severity**: LOW
**Category**: misleading-code
**Surfaced by**:
- `ReactiveLineageRepositoryImpl.md:bugs_limitations_corner_cases[6]`
- `ReactiveLineageRepositoryImpl.md:performance.known_performance_gaps[5]`

**Description**: `ReactiveLineageRepositoryImpl.getLineageRelations(List<String> oddrns)` (lines 112-119) builds the WHERE clause:

```sql
WHERE is_deleted = false AND (
  (parent_oddrn IN (oddrns) AND child_oddrn IN (oddrns))
  OR
  (child_oddrn IN (oddrns) AND parent_oddrn IN (oddrns))
)
```

The two OR-branches are LOGICALLY EQUIVALENT (both require `parent AND child` to be in the same list, by conjunction commutativity). jOOQ generates the redundant SQL; Postgres's planner collapses it before execution. But the SOURCE CODE is misleading: a future maintainer reading the predicate could plausibly interpret the OR as "edges where parent is in oddrns OR child is in oddrns" — which is materially different from what the code actually executes (BOTH endpoints must be in the same list).

The actual semantic is the DEG-internal-lineage assembly contract: this method returns lineage edges where BOTH endpoints are members of the data-entity-group's oddrn list. The caller (`LineageServiceImpl.getDataEntityGroupLineage`, line 66) passes the full DEG-member oddrn list and gets back the internal edges. The OR is purely decorative.

The existing test `LineageRepositoryTest.getLineageRelationsTest_WithOddrns` (lines 111-128) inserts a SINGLE edge with both endpoints in the queried list, so it does NOT distinguish the two semantics. A future maintainer "fixing" the apparent redundancy by simplifying to one branch would inadvertently rewrite the semantic only if they ALSO interpret the OR as the broader-than-intended pattern.

**Primary source citations**:
- `ReactiveLineageRepositoryImpl.java:113-117` — the redundant OR predicate
- `LineageRepositoryTest.java:111-128` — the existing test (doesn't distinguish semantics)
- `LineageServiceImpl.java:66` — the sole caller passing DEG-member oddrns
- jOOQ canonicalisation: the planner collapses redundant predicates; no perf impact

**Existing-ADR-or-implied-prescription**: implicit — the project's convention is concise SQL via jOOQ DSL. Redundant predicates are not the project norm. The fix is one-line refactoring (simplification + comment).

**Proposed remedy**: Refactor the predicate to the single canonical form and add an explanatory comment:

```java
// DEG-internal-lineage assembly: return edges where BOTH endpoints belong
// to the supplied oddrn list. Used by getDataEntityGroupLineage to project
// the internal subgraph of a DEG.
.where(LINEAGE.IS_DELETED.isFalse())
.and(LINEAGE.PARENT_ODDRN.in(oddrns))
.and(LINEAGE.CHILD_ODDRN.in(oddrns))
```

Add a regression test that distinguishes the two semantics:
1. Insert a 4-edge graph: A→B, A→C, A→D (3 with B/C/D in the queried list), B→E (with E outside the list).
2. Query with `oddrns = [A, B, C, D]`.
3. Assert returned edges are exactly `[A→B, A→C, A→D]` — NOT `[A→B, A→C, A→D, B→E]` (which would be the broader OR semantic).

**Severity rationale**: LOW — misleading code that could cause silent semantic drift on a future refactor. The actual current behaviour is correct (DEG-internal-lineage assembly). The cost is future-maintainer confusion + the risk that a "cleanup" PR changes semantics. The existing test doesn't catch the change.

**Suggested backlog grouping**: `Code-quality cleanup` — bundle with other misleading-SQL findings. Pair with REFACTOR-242 (LineageDepth.empty() folklore — same class of "the code's literal meaning differs from operator's mental model").

---
