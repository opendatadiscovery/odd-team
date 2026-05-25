## REFACTOR-599 — Every single dashboard filter chip toggle fires a full `GET /api/dataqatests/runs` (multi-CTE, multi-join SQL) — no debounce, no Apply gate; building a 4-chip filter slice fires 4 backend dashboard queries when 1 would suffice

**Severity**: MEDIUM
**Category**: performance-redundant-work
**Pillars affected**: [P-04 Data Quality — F-032 Quality Dashboard]
**related_features**: [F-032]
**related_pillar_features**: [P-04:F-002]
**Batch**: ZC (2026-05-22)

**Surfaced by**:
- `odd-platform__ts__jotai-store__store__DataQualityStore.md:performance.known_performance_gaps` (MEDIUM) — |-
    "Every single filter chip toggle triggers a full dashboard re-fetch (no debounce / batch-apply): `formFiltersAtom` write → `filtersAtom` re-derive → new React Query `queryKey` → network request. An operator building a multi-chip filter slice fires one backend dashboard query per chip rather than one on an 'Apply' action."
- `odd-platform__ts__react-component__component__DataQualityFilters.md:performance.known_performance_gaps[1]` (MEDIUM) — confirms from the panel side: "No debounce / no Apply gate between filter selection and dashboard re-query — the full `getDataQualityTestsRuns` (multi-CTE, multi-join SQL) runs on every single filter change."
- `odd-platform__ts__react-component__component__DataQualityFilters.md:name_behavior_pairs[formFiltersAtom]` (MINOR drift) — "the naming `formFiltersAtom` mildly over-promises a draft stage; behaviour (live filtering) is fine but not what the name suggests."

**Description**: The dashboard's filter-state propagation chain is fully synchronous:

```
user toggles chip → formFiltersAtom write
                  → filtersAtom re-derives (jotai sync; DataQualityStore.ts:32-42)
                  → DataQualityContent reads new filterState (re-render)
                  → useGetDataQualityDashboard sees new params
                  → react-query computes new queryKey
                  → react-query fires GET /api/dataqatests/runs
                  → backend zips 3 DB queries (getLatestDataQualityRunsResults
                    + getLatestTablesHealth + getMonitoredTables) into one DTO
                  → ~hundreds-of-ms round-trip
                  → re-render with new data
```

There is NO step in this chain that batches, debounces, or gates the propagation. Each chip toggle (the click on `<FilterChip />`'s ×, or the selection of a new option in the autocomplete) IS a chip-toggle write that produces a new queryKey that produces a new fetch.

An operator building a typical 4-chip filter slice ("Filter to entities in namespace=A, datasource=B, owner=C, tag=D") fires FOUR full dashboard fetches in sequence — each fetch is the heavy multi-CTE SQL — before they see the final result. The first three fetches' results are immediately discarded as each subsequent chip toggle invalidates the queryKey. Three of the four are pure waste.

Compounded with REFACTOR-597 (no autocomplete debounce — typing the 4 filter values fires ~24 list-API GETs), a single operator workflow of building a 4-chip filter generates ~28 backend requests where ~5 would suffice (4 list-API GETs after typing settles + 1 final dashboard GET after Apply).

**Wisdom-test classification**: GAP. (1) Intentional? The immediate-propagation IS deliberate under ADR-CANDIDATE-207 (jotai derived atom propagates synchronously) — that ADR's pattern produces live filtering by design. But the lack of debounce / Apply gate on top of that immediate propagation is NOT defended anywhere; the immediate-propagation is the substrate, the debounce-or-Apply is the missing UX layer. (2) Structural impact? NO — adding a debounce-wrapped `useGetDataQualityDashboard` call OR an explicit "Apply" button + a separate "applied filters" atom is purely additive. (3) Refactoring or structural? REFACTORING. → Refactoring scope.

**Primary source citations**:
- `DataQualityStore.ts:32-42` (`filtersAtom` derived atom — recomputes on every formFiltersAtom write)
- `DataQualityContent.tsx:23-24` (the read + the hook call — no debounce wrapper)
- `dataQuality.ts:74-82` (the react-query hook — no `enabled` gate, no debounce primitive)
- `DataQualityRunsServiceImpl.java:36-42` (the backend's three-query fan-out — the cost of each dashboard fetch)

**Existing-ADR-or-implied-prescription**: composes with ADR-CANDIDATE-207 (immediate jotai propagation by design). The fix is to add a UX layer ON TOP of the substrate, not to change the substrate. The `formFiltersAtom` name actually anticipates this — 'form' implies a draft stage; today there is no apply step, so the name mildly over-promises (per the sidecar's name_behavior_pairs MINOR drift). A real apply step would justify the name.

**Proposed remedy**: Two options.

1. **Smallest — debounce the derived `filtersAtom`** (or debounce the `useGetDataQualityDashboard` call in DataQualityContent): wrap with a 250-500ms debounce. The operator builds their 4-chip slice; after they stop interacting, one fetch fires. Lives entirely in DataQualityContent / DataQualityStore.
2. **Larger — make `filtersAtom` actually-derived only on Apply**: introduce an explicit `appliedFiltersAtom` and an Apply button that copies `formFiltersAtom` → `appliedFiltersAtom`. The dashboard reads `appliedFiltersAtom`. Reflects the "form-then-apply" name convention; gives the operator explicit control over when they pay the round-trip; matches enterprise dashboard patterns (Looker / Tableau / Grafana all gate filter changes behind Apply).

Option 2 is the better long-term UX (explicit operator control, no surprise refetch on accidental chip toggle, supports complex multi-chip slice construction) but is a meaningful UX change. Option 1 is the conservative fix that retains live filtering but eliminates the waste.

**Severity rationale**: MEDIUM — performance + UX inefficiency, not a correctness bug. Operator-visible at every filter-build session (every workflow fires N-1 wasted dashboard fetches); backend-visible in `/api/dataqatests/runs` traffic (3-4x amplification under normal use). Severity is MEDIUM rather than HIGH because each fetch is correct; the waste is in their count, not their content.

**Suggested backlog grouping**: `Quality Dashboard hardening sprint` — pair with REFACTOR-597 (autocomplete debounce) as the two halves of the dashboard's "debounce hygiene" pass. If Option 2 is adopted, it composes with REFACTOR-595 (per-mount reset) — the `appliedFiltersAtom` could be the natural sessionStorage candidate.

---
