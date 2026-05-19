## REFACTOR-235 — Recursive CTE in `ReactiveAlertRepositoryImpl.getChildOddrnsLinageByOwnOddrnsCte` uses array-membership cycle check that is O(N²) in jOOQ-emitted SQL on heavy-fanout graphs

**Severity**: MEDIUM
**Category**: performance-redundant-work (recursive-CTE evaluation cost)
**Surfaced by**:
- `ReactiveAlertRepositoryImpl.md:bugs_limitations_corner_cases[4]`
- `ReactiveAlertRepositoryImpl.md:performance.scaling_characteristics`

**Description**: `getChildOddrnsLinageByOwnOddrnsCte` (`ReactiveAlertRepositoryImpl.java:429-454`) implements a separate recursive CTE for the **dependent-objects alerts tab** — distinct from `ReactiveLineageRepositoryImpl`'s lineage-canvas CTE. It accumulates parent oddrns in a `String[]` field per row and adds `LINEAGE.PARENT_ODDRN.notEqual(DSL.all(parentOddrnArrayField))` to the recursive step as cycle prevention.

The cycle check operates at the array-membership level. On a heavily-fanout graph with no cycle but many overlapping paths:
- Each recursive iteration appends the current parent oddrn to the per-row `parent_oddrn` array.
- The array grows linearly with depth: O(N) per row.
- The recursive step's `notEqual(DSL.all(parent_oddrn))` check evaluates O(N) elements per row per iteration.
- Total work for D-depth, B-branching is O(D × B^D × N) — quadratic-in-depth on top of the exponential-in-depth row count.

For a typical lineage with depth 5 + branching 10, that's ~100K row evaluations with array sizes 1-5 — bounded. For a pathological deployment (depth 10+ branching 50+ — possible in a deeply-pipelined ELT environment), the cost spikes into the multi-million-row CTE evaluation. Postgres CPU saturation manifests; the read returns eventually but the platform-wide latency degrades for other reads sharing the same R2DBC connection pool.

The cycle check works for sane graphs (it prevents pure cycles like A→B→A). The gap is the **work-amplification on legitimate deep graphs**: there is no `RECURSION DEPTH` ceiling, no `LIMIT` clause inside the CTE, no Postgres `WITH RECURSIVE ... CYCLE` clause (PG14+ feature, which this codebase appears not to use — verified across all migrations).

**Distinct from REFACTOR-207** (which covers `ReactiveLineageRepositoryImpl`'s lineage-canvas CTE). Two separate recursive-CTE call sites; both have cycle/cost issues; both deserve hardening; the fix for one does not automatically fix the other.

**Primary source citations**:
- `ReactiveAlertRepositoryImpl.java:429-454` — the recursive CTE for dependent-objects alerts
- specifically line 435 (`parent_oddrn || parent_oddrn` — the array concat in the recursive step) and the `notEqual(DSL.all(parentOddrnArrayField))` check
- contrast: `ReactiveLineageRepositoryImpl.java:163-175` — different CTE (REFACTOR-207's site); uses depth bound only with no array cycle check
- Postgres `WITH RECURSIVE ... CYCLE` clause documentation: <https://www.postgresql.org/docs/14/queries-with.html#QUERIES-WITH-CYCLE>

**Existing-ADR-or-implied-prescription**: implicit — the recursive-CTE pattern is used in two places (alerts + lineage); each has a slightly different cycle/cost strategy (alerts uses array-membership; lineage uses depth-only). The asymmetry suggests neither is the platform's canonical choice; both have gaps. Refactoring within the existing CTE shape.

**Proposed remedy**: Three composable fixes:
1. **Add a depth ceiling**: parameterise the CTE with a maximum depth bound (e.g. `MAX_DEPTH = 50`) and add a `WHERE depth < MAX_DEPTH` predicate to the recursive step. This bounds the worst-case row count.
2. **Migrate to PG14+ `WITH RECURSIVE ... CYCLE`**: Postgres 14 added native cycle detection that doesn't grow per-row state quadratically. Replace the manual array-membership check with `CYCLE parent_oddrn SET is_cycle USING path` — the planner handles the cycle bookkeeping efficiently.
3. **Add an integration regression test** that constructs a cycle and a deep fanout graph and asserts the CTE terminates within an acceptable time budget (e.g. < 1 second). No such test currently exists for either recursive-CTE site.

The remedy chain is preferable in order: depth ceiling first (small change, big safety net) → migration to CYCLE clause (larger change, requires PG14 minimum) → regression test (always last but always needed).

**Severity rationale**: MEDIUM — DoS amplification vector on pathological graphs. The cycle check works correctly today; the gap is the cost amplification on legitimate large graphs. Combined with REFACTOR-024 (the dependent-objects tab is cross-owner readable for any authenticated user) and REFACTOR-068 (DISABLED-mode default), an anonymous network probe can drive arbitrarily-expensive recursive-CTE queries by submitting deep lineage chains and querying the dependent-objects tab.

**Suggested backlog grouping**: `Lineage performance hardening` — pair with REFACTOR-207 (the other recursive-CTE site). Both should land together since they share the architectural pattern.

---
