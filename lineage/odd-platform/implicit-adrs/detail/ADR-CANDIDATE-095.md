## ADR-CANDIDATE-095 — Catalog Overview's "Recommended" panel uses a SINGLE `DataEntityList` component for all FOUR columns (My Objects / Upstream / Downstream / Popular) with no column-specific behaviour — uniform-treatment idiom; no per-column refetch / filter / sort / count / view-more

**Severity**: MEDIUM
**Classification**: promote
**Support count**: 1 sidecar primary-source (PopularStrip)
**Axes present**: ui_components
**Pillars affected**: [P-01] — Data Discovery (Catalog Overview)

**Surfaced by**:
- `PopularStrip.md:implicit_adrs[2]` (|-
    "**Single DataEntityList component for all four columns — the Popular column has NO column-specific behaviour, by design.** OwnerEntitiesList.tsx:99-105 renders the same `<DataEntityList>` for Popular as for My Objects / Upstream / Downstream — only the `dataEntitiesList`, `entityListName`, `entityListIcon`, and fetching-status props differ. This means: no per-column refetch button, no per-column filter, no per-column sort, no per-column count, no per-column 'view more' link. The decision: 'all four columns are symmetric; treat them uniformly.' Consequence: hardening any one column (e.g. adding pagination to Popular for inflation-resistance) requires hardening all four together, or splitting the component.")

**Decision statement**: The home-page Recommended panel (`OwnerEntitiesList.tsx:78-105`) renders FOUR `DataEntityList` columns — My Objects / Upstream dependents / Downstream dependents / Popular — using the SAME component implementation. Only four props differ between the columns: `dataEntitiesList` (the data array), `entityListName` (the translation key for the column header), `entityListIcon` (the StarIcon, GroupIcon, etc.), `fetchingStatus` (the column's loading flag).

There are NO column-specific affordances:
- No per-column refetch button.
- No per-column filter.
- No per-column sort.
- No per-column row-count.
- No per-column "view more" / pagination link.
- No per-column empty-state messaging (all four columns use `t('No information to display')` per `EmptyContentPlaceholder.tsx:46`).
- No per-column error tile (a fetch error surfaces via global toast, never per-column).
- No per-column skeleton (a single skeleton wraps all four).

The decision: "all four columns are symmetric; treat them uniformly." The maintainer chose the uniform-treatment idiom over per-column hardening.

Consequences encoded:
- **(a) Hardening one column requires hardening all four** — adding pagination to Popular for inflation-resistance would touch the shared `DataEntityList`, affecting My Objects / Upstream / Downstream symmetrically.
- **(b) Per-column features must be wedged into the column's data source** — Popular's API call is `{page: 1, size: 5}` hardcoded; making size operator-tuneable for Popular would either fork the component or thread the size through all four columns.
- **(c) Symmetric loading skeleton blocks fast columns on slow ones** — the aggregator `getIsOwnerEntitiesFetching` OR-combines the four columns' isLoading flags; a slow Popular fetch holds the entire Recommended panel as skeleton.
- **(d) Symmetric click navigation** — clicking any tile in any column navigates to `dataEntityDetailsPath(id)` which defaults to `/dataentities/{id}/overview`; no column-aware destination.

**Wisdom test (3-question)**:
1. *Intentional?* YES — the structural symmetry (same component, four call-sites, identical prop shape) encodes the uniform-treatment decision; the team chose to NOT differentiate.
2. *Structural impact?* YES — defines how the Recommended panel evolves; any per-column feature requires a structural decision (extend the shared component vs split it).
3. *Refactoring or structural?* STRUCTURAL — splitting into per-column components is a different architecture; uniform-component-with-config is a different one.
→ ADR.

**Evidence**:
- PopularStrip.md says: "OwnerEntitiesList.tsx:78-105 (the four identical DataEntityList invocations) + DataEntityList.tsx:13-19 (the shared props shape) + DataEntityList.tsx:21-70 (the column-agnostic render)"
- intent_anchor: "the structural symmetry — same component, four call-sites, identical prop shape — encodes the 'uniform treatment' decision"

**Existing ADR**: none.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-292 (NEW — Hardcoded `size: 5` precludes operator tuning of home-page recommendation breadth; no config key, no env override, no admin toggle)
- REFACTOR-293 (NEW — Generic empty-state placeholder under each column: "No information to display"; operators get no hint as to WHY Popular is empty — zero traffic vs no entities ingested vs view_count column never written-to)
- REFACTOR-294 (NEW — Single skeleton for four parallel columns means slow column blocks visual content of three fast columns; splitting into per-column skeletons would let fast columns render as their data arrives)

**Proposed action**: Promote to `adrs/drafts/uniform-data-entity-list-for-recommended-panel.md`. Document:
- The single-component four-column pattern.
- The four-prop differentiation surface (data, name, icon, fetching-status).
- The deliberate absence of per-column affordances.
- The maintenance obligation: any new per-column feature must trigger a structural decision (extend or split).
- The migration path if the team ever needs per-column hardening: split into per-column components vs add a config-driven feature matrix.

**Severity rationale**: MEDIUM — pattern-shaping decision for the home-page architecture. Below HIGH because it's a single-panel design choice; affects future evolution but not load-bearing today.

**Suggested backlog grouping**: `UI architecture codification`.

---
