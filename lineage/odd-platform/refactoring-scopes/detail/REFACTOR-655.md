## REFACTOR-655 — Data Quality Dashboard filter combinations using BOTH `ownerIds` AND `titleIds` enforce same-ownership-row AND constraint — operator-surprising AND semantics across two distinct dimensions

**Severity**: LOW
**Category**: operator-surprise-AND-semantics
**Batch**: ZG (2026-05-25)
**Pillars affected**: [P-04 Data Quality, P-11 Platform API (filter semantics)]

**Surfaced by**:
- `odd-platform__java__DataQualityRunsController__controller-class__DataQualityRunsController.md:bugs_limitations_corner_cases.[9]` (LOW) — "**Filter combinations using BOTH ownerIds AND titleIds enforce same-ownership-row AND constraint — operator-surprising AND semantics across two distinct dimensions.** The combined branch at `ReactiveDataQualityRunsRepositoryImpl.java:297-302`: when both ownerIds and titleIds are non-empty, the SQL joins ONE `OWNERSHIP` row that must satisfy `OWNER_ID.in(ownerIds) AND TITLE_ID.in(titleIds)` — i.e. that single ownership entry must have both the owner AND the title. An operator selecting 'Owner: Alice' AND 'Title: Data Steward' will see ONLY datasets where Alice is specifically the Data Steward — not datasets where Alice is the owner under a different title, and not datasets where someone else is the Data Steward."

**Statement**: The Data Quality Dashboard accepts 10 filter parameters (5 tests-side × 5 tables-side dimensions: namespace / datasource / owner / title / tag). When BOTH `ownerIds` and `titleIds` are supplied, the SQL joins ONE `OWNERSHIP` row that must satisfy BOTH conditions:

```sql
-- ReactiveDataQualityRunsRepositoryImpl.java:297-302 (the combined branch)
.join(OWNERSHIP).on(
  OWNERSHIP.DATA_ENTITY_ID.eq(DATA_ENTITY.ID)
  AND OWNERSHIP.OWNER_ID.in(ownerIds)
  AND OWNERSHIP.TITLE_ID.in(titleIds)
)
```

The single-row AND semantics produces operator-surprising results:
- Operator selects "Owner: Alice" AND "Title: Data Steward"
- Operator expects: "datasets where Alice is an owner AND datasets where someone is the Data Steward" (a UNION of two sets)
- Actual: "datasets where Alice is specifically the Data Steward" (an INTERSECTION on the ownership-row tuple)

The branching in the SQL is asymmetric:
- ownerIds only (titleIds empty) — joins OWNERSHIP on `OWNER_ID.in(ownerIds)` only (line 303-306)
- titleIds only (ownerIds empty) — joins OWNERSHIP on `TITLE_ID.in(titleIds)` only (line 307-311)
- BOTH supplied — joins ONE OWNERSHIP row with both predicates (line 297-302)

The combined branch's semantics is internally consistent (a single OWNERSHIP row IS the entity-owner-title triple); the operator-surprise is the cross-dimension AND. Most filter UIs interpret cross-dimension as INDEPENDENT predicates (entity matches X dimension AND entity matches Y dimension); this filter interprets cross-dimension as ROW-LEVEL AND.

**Evidence**:
- Combined branch: `ReactiveDataQualityRunsRepositoryImpl.java:297-302`
- Owner-only branch: `ReactiveDataQualityRunsRepositoryImpl.java:303-306`
- Title-only branch: `ReactiveDataQualityRunsRepositoryImpl.java:307-311`

**Existing-ADR-or-implied-prescription**: no governing ADR. The combined-branch semantic was not anchored to a decision.

**Proposed remedy**:
- **Option A (UI-side fix)**: add a UI hint explaining the cross-dimension AND ("filtering by both Owner AND Title narrows to ownership rows matching BOTH").
- **Option B (semantic change)**: change the SQL to use two separate OWNERSHIP joins (one per dimension), producing the INDEPENDENT-predicate semantic the operator likely expects. May produce wider result sets.
- **Option C (UI-side disjunction)**: rename the combined filter or add an explicit operator-toggle (AND vs OR / row-level vs independent).

Option A is the smallest change; the maintainer's preference depends on the operator's actual mental model (unknown from static analysis; would require user research).

**Severity rationale**: LOW — minor operator-surprise; the SQL is consistent; affects only the multi-dimension filter case.

**Suggested backlog grouping**: `Quality Dashboard observability sprint` (consolidates with REFACTOR-593 — titleIds drift, REFACTOR-594 — namespaceIds widening, REFACTOR-600 — doc incompleteness).

**Coherence check** (LSN-018):
- STRENGTHENS: none directly.
- SUPERSEDES: none.
- CONFLICTS: none.

---
