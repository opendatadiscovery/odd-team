## REFACTOR-597 — Dashboard filter autocompletes have NO debounce — every keystroke triggers a list-API GET; typing a 10-char namespace fires up to 10 backend requests; with 5 filters × 2 sides = 10 autocompletes, an operator filling out the panel generates a measurable request burst

**Severity**: MEDIUM
**Category**: performance / no-debounce
**Pillars affected**: [P-04 Data Quality — F-032 Quality Dashboard | P-01 Data Discovery — list APIs]
**related_features**: [F-032]
**related_pillar_features**: [P-04:F-002]
**Batch**: ZC (2026-05-22)

**Surfaced by**:
- `odd-platform__ts__react-component__component__DataQualityFilters.md:bugs_limitations_corner_cases.[1]` (MEDIUM) — |-
    "**`MultipleFilterItemAutocomplete` has no debounce on the search input — every keystroke triggers a list-API request.** The autocomplete's `onInputChange` calls `setSearchText(query)` directly (`MultipleFilterItemAutocomplete.tsx:57-66`); `searchText` is passed straight into `useFilter`'s `useHook({ page: 1, size: 30, query: searchText })` (`hooks/index.ts:13-17`), and `searchText` is the React-Query key (`namespace.ts:7`), so each character types a fresh GET to `/api/namespaces` (or datasources/owners/titles/tags). Typing a 10-character namespace name fires up to 10 list requests. There is no `useDebounce`, no minimum-character gate. React Query's per-key cache de-duplicates repeats but not the distinct prefixes."
- Probe `P-111` (`lineage/odd-platform/probes/P-111.yaml`) — pins the per-keystroke list-API request count.

**Description**: The autocomplete component (`MultipleFilterItemAutocomplete.tsx:57-66`) directly forwards every `'input'` event's value into `setSearchText`. `searchText` is part of the react-query queryKey (`namespace.ts:6-9`), so each distinct prefix produces a distinct cache entry and a distinct backend GET. Typing 'production' into the Namespace filter fires 10 list-API requests (`p`, `pr`, `pro`, `prod`, `produ`, `produc`, `product`, `producti`, `productio`, `production`). React Query de-duplicates IDENTICAL keys but not distinct prefixes, so the cache offers no relief.

Compounded with the panel's structure (5 filter dimensions × 2 sides = 10 autocompletes) and the typical operator workflow of filling out multiple filters in sequence, a full filter-panel build-out fires a measurable burst:

- **Burst per filter typed**: ~1 GET per character of the search prefix (a 6-char tag name → 6 GETs).
- **Cross-filter compound**: an operator filling 4 filters (Namespace + Datasource + Owner + Tag) at 6 chars each = ~24 GETs to four different list endpoints.
- **Backend impact**: each list-API GET is a paginated SELECT with an ILIKE filter — cheap individually, but the per-keystroke pattern scales linearly with operator typing.

**Wisdom-test classification**: GAP. (1) Intentional? NO — no comment defends "no debounce"; the absence is a standard oversight in a hand-rolled autocomplete; many MUI Autocomplete code samples include debounce by default. (2) Structural impact? NO — adding a `useDebounce` is a 5-line change within the existing component. (3) Refactoring or structural? REFACTORING. → Refactoring scope.

**Primary source citations**:
- `MultipleFilterItemAutocomplete.tsx:57-66` (`onInputChange` → `setSearchText` direct, no debounce)
- `hooks/index.ts:11-17` (`searchText` → `query` param, no minimum-character gate)
- `namespace.ts:6-9` (`searchText` is part of the queryKey — every distinct prefix is a distinct cache entry)
- Probe `P-111`

**Existing-ADR-or-implied-prescription**: none — debounce-vs-no-debounce on autocomplete inputs is a standard UI hygiene concern, not an architectural decision. The dashboard is one of several autocomplete surfaces in the SPA; a project-wide debounce primitive would benefit all of them.

**Proposed remedy**: Two layers.

1. **Smallest** — wrap `setSearchText` in a `useDebounce(value, 300)` hook in `MultipleFilterItemAutocomplete.tsx:57-66`. 300ms is the standard human-typing debounce; reduces the per-character burst to one GET per typing pause. Add a minimum-character gate (e.g. require >= 2 chars before firing) for an additional cut.
2. **Medium** — extract a project-wide `useDebouncedAutocomplete` primitive that wraps MUI Autocomplete with the debounce + minimum-character logic. Apply to the dashboard autocompletes first, then sweep other autocomplete sites in the SPA.

Pair with REFACTOR-598 (no pagination beyond first 30) — the two are siblings, and a debounce-plus-load-more design should be the joined approach.

**Severity rationale**: MEDIUM — performance gap, not a correctness bug. Operator-visible only at slow connections (where the per-keystroke latency lags the typing) and on backend logs (where the autocomplete-driven list-API traffic dominates legitimate list-API traffic). Not a guide-off-a-cliff but a noticeable inefficiency that compounds the dashboard's per-filter-change refetch burden (REFACTOR-599).

**Suggested backlog grouping**: `Quality Dashboard hardening sprint` + cross-cutting `autocomplete hygiene` if the Option 2 primitive extraction is adopted.

---
