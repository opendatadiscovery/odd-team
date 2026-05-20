## REFACTOR-294 — Single skeleton for four parallel columns means slow column blocks visual content of three fast columns; splitting into per-column skeletons would let fast columns render as their data arrives

**Severity**: LOW
**Category**: performance-redundant-work + ux-bug
**Pillars affected**: [P-01] — Data Discovery
**Surfaced by**:
- `PopularStrip.md:performance.known_performance_gaps[1]` (|-
    "**Single skeleton for four parallel columns means one slow column blocks the visual content of three fast columns.** The aggregator `getIsOwnerEntitiesFetching` (mainContentLoader.selectors.ts:10-17) OR-combines the four columns' isLoading flags. Splitting into per-column skeletons inside each DataEntityList would let the fast columns render as their data arrives, giving the user a sense of progress instead of a blocking skeleton.")

**Description**: The Recommended panel's loading-state is gated by `getIsOwnerEntitiesFetching` (`mainContentLoader.selectors.ts:10-17`), which OR-combines the four columns' `isLoading` flags. The entire panel renders as `OwnerEntitiesListSkeleton` until ALL four fetches resolve.

The four fetches fire in parallel from `OwnerEntitiesList.tsx:58-64`, so the user-perceived latency is `max(t_my, t_upstream, t_downstream, t_popular)`. For the typical case where three columns return quickly (5-20ms) but Popular hits the non-indexed sort and takes 50-200ms, the panel stays as skeleton for the slow-column duration even though three columns are ready.

Splitting into per-column skeletons inside each `DataEntityList` (with `isFetching` prop driving each column's individual skeleton) would let fast columns render as their data arrives. The user gets a sense of progressive load instead of a binary skeleton-vs-content flip.

**Primary source citations**:
- `OwnerEntitiesList.tsx:68-73` — the single skeleton check
- `mainContentLoader.selectors.ts:10-17` — the OR aggregation
- `PopularStrip.md` documents the gap

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-095 codifies the uniform-treatment pattern. Per-column skeletons break the uniform-treatment slightly but improve UX. The ADR accepts the trade-off as a future-evolution choice.

**Proposed remedy**: Split the skeleton:
1. Move the skeleton render into each `DataEntityList` column.
2. Drive each column's skeleton from its own `fetchingStatus.isLoading` prop.
3. The outer `OwnerEntitiesList` renders the four columns + their internal skeletons.
4. The aggregator `getIsOwnerEntitiesFetching` becomes a fallback for the "all four columns loading" case if any all-columns-loading optimization is needed.

The change is non-invasive (additive); the visual contract changes slightly (no whole-panel skeleton anymore).

**Severity rationale**: LOW — UX polish; affects perceived latency on home-page load; trivially fixable.

**Suggested backlog grouping**: `UI UX polish sprint`.

---
