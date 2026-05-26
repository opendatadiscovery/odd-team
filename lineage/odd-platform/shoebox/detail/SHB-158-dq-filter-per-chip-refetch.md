# SHB-158 — DQ Dashboard fires a full dashboard refetch on every single filter-chip toggle; no batch-apply, no debounce

**Category**: clustering
**Severity**: MEDIUM

## Hypothesis

Operators building a multi-chip filter slice on the DQ Dashboard see the dashboard reload after EVERY chip toggle, not once at the end of their selection. Picking 3 namespaces + 2 owners + 1 tag in succession fires SIX `GET /api/data-quality/test-runs` backend calls, with the dashboard rings flashing through five intermediate filter states before settling. There is no "Apply Filters" button, no debounce, no batch. The behaviour is a sibling-component design property (DataQualityFilters writes formFiltersAtom synchronously per chip → filtersAtom re-derives synchronously → useGetDataQualityDashboard sees a new queryKey on each derivation → React Query refetches each time).

## Evidence

- `odd-platform-ui/src/components/DataQuality/DataQualityStore.ts:32-42` — `filtersAtom` is a synchronous derived atom; updates on every `formFiltersAtom` write.
- `odd-platform-ui/src/components/DataQuality/DataQualityContent.tsx:23-24` — `useGetDataQualityDashboard(filterState)` with no debounce around it; React-Query keys on `filterState`.
- `odd-platform-ui/src/components/DataQuality/DataQualityFilters/hooks/index.ts:19-37` — `onSelectOption`/`onDeselectOption` write `formFiltersAtom` immediately per chip.

## Notes

- Per-chip-refetch is a perf issue: each backend dashboard call runs the test-runs CTE (large catalogs make this expensive). N chips = N backend calls.
- The optimal UX is well-known: a non-empty "Pending Filters" indicator + an "Apply" button (or implicit apply on autocomplete-close). Today the platform just refetches on every keystroke equivalent.
- React-Query DOES dedupe identical queryKeys but each intermediate selection IS a distinct queryKey.
- LSN-017 class shape but at the filter granularity: response state isn't in the dep array, but each operator action triggers a fetch where one would do.
- guess: the backend dashboard endpoint has no rate-limit; a user mashing chips on a large catalog can DoS the backend or the database.
- Adjacent: also applies to `/search` filter facets if those have a similar paradigm (verify).

## Next

1. Decide: add "Apply Filters" button OR add a debounce around the filtersAtom→useGetDataQualityDashboard handoff (300-500ms).
2. Measure: how expensive is one `getDataQualityTestsRuns` call against a 10k-entity catalog?
3. Promote: cluster_with F-032 (Quality Dashboard) as a perf-class facet.

## Links

- cluster_with: [F-032, SHB-156, SHB-157]
- merged_into: (open)
- supersedes: []

## evaluation

- **feature-flow-builder 2026-05-26**: cluster — F-032 is in P-04 (cross-pillar; defer F-032 enrichment to P-04-pillar batch). Cluster_with sibling DQ-filter UX threads (SHB-156/157) so a future graduation captures the per-chip-refetch facet alongside label-drift + debounce-gap as one comprehensive "DQ Dashboard Filter UX" feature.
