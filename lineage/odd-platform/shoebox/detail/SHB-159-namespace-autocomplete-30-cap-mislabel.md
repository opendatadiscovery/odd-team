# SHB-159 — NamespaceAutocomplete mislabels existing namespaces as creatable when total matches exceed 30

**Category**: clustering
**Severity**: MEDIUM

## Hypothesis

When operators register a data source (or term, DEG, collector, lookup-table) in a deployment with many namespaces sharing a prefix, the Namespace combo-box shows a misleading "Create new custom namespace «X»" suggestion for an X that ALREADY exists. The `searchNamespace` call hard-codes `size: 30` (page 1 only, no infinite-scroll); the no-match guard `!options.some(o => o.name === inputValue)` inspects ONLY the 30 fetched rows. An exact-match namespace ranked 31st+ in the backend's result order passes the guard, the synthetic "Create new" option is offered, and the operator clicks it thinking they're creating new — but the backend's `getOrCreate` resolves the existing row (no duplicate is created). The UI label is wrong; the operator was told they were creating something new when they were not.

## Evidence

- `odd-platform-ui/src/components/shared/elements/Autocomplete/NamespaceAutocomplete/NamespaceAutocomplete.tsx:52` — `searchNamespace({query: searchText, page: 1, size: 30})` — fixed cap, no page increment.
- `odd-platform-ui/src/components/shared/elements/Autocomplete/NamespaceAutocomplete/NamespaceAutocomplete.tsx:81` — guard `!options.some(option => option.name === params.inputValue)` operates only on the 30 fetched rows.
- `odd-platform-ui/src/components/shared/elements/AutocompleteSuggestion/AutocompleteSuggestion.tsx:24-29` — the deliberate label: `Create new custom namespace "X"`.
- `odd-platform-api/src/main/java/.../NamespaceServiceImpl.java:37-40` — `getOrCreate(name)` = `getByName(name).switchIfEmpty(createByName(name))` — silently resolves existing names, no duplicate.

## Notes

- Data integrity is SAFE (backend get-or-create dedupes); the UI LABEL is misleading.
- ~7 sibling autocompletes share the pattern (`OwnerAutocomplete`, `RoleAutocomplete`, `TermAutocomplete`, `TagsEditFormAutocomplete`, etc.) — verify whether they hit the same 30-cap mislabel risk.
- Same shape applies to the DQ Dashboard's MultipleFilterItemAutocomplete (per SHB-157).
- LSN-023 retrospective already covered the BACKEND side of this ("namespace_name is a deliberate select-or-create, not a side-door"); THIS thread is the UI-side facet of the operator-confusion-on-30-overflow.
- Fix candidates: (a) add `"Showing 30 of N"` indicator + "load more"; (b) increase size to 100; (c) require operators to click "+ Create new" rather than auto-suggesting; (d) backend-side normalize search to exact-match for matchcase-insensitive duplicate detection.

## Next

1. Probe P-086 (already emitted in NamespaceAutocomplete sidecar): verify the 30-cap mislabel under reproduction.
2. Add a "Showing 30 of N" UI indicator OR raise the cap to 100.
3. Decide whether to add `&exactMatch=true` API parameter for the no-match check (fast exact-name lookup) to eliminate the false-positive guard.
4. Cluster with NamespaceAutocomplete sibling autocompletes to estimate the blast radius.

## Links

- cluster_with: [SHB-157, SHB-170, F-028, F-031]
- merged_into: (open)
- supersedes: []

## evaluation

- **feature-flow-builder 2026-05-26**: cluster — the namespace + 7 sibling autocompletes pattern is cross-pillar (touches P-08 Namespace Lifecycle + P-08 Data Source Lifecycle + P-01 Glossary terms + P-08 Owner Lifecycle + P-08 Collector + P-03 Lookup Tables). Cluster_with SHB-157 (DQ-filter autocomplete debounce/spinner) + SHB-170 (autocomplete stuck spinner on fail) so the next batch can graduate a single "Autocomplete UX class" feature capturing all 3 dimensions (mislabel-on-30-cap + no-debounce + stuck-spinner-on-fail) across the ~11 sibling autocompletes. Coordinate with Slice E for cross-pillar reach.
