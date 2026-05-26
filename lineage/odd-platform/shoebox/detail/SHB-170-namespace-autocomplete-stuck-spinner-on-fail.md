# SHB-170 — NamespaceAutocomplete strands the spinner on backend failure across 5+ form types

**Category**: open
**Severity**: MEDIUM

## Hypothesis

When the namespace search backend is unavailable (5xx, network failure, 4xx) during a form session, the Namespace combo-box's loading spinner strands ON forever with an empty dropdown — visible across at least FIVE form types (datasource, term, DEG, collector, lookup-table) that all reuse the same NamespaceAutocomplete. The dispatch chain `.unwrap().then(...)` has no `.catch()`, so `setLoading(false)` never runs on rejection. Operators see a permanent spinner with no options, no error message, no way to type-and-submit (the freeSolo path requires the loading state to clear before the combo-box accepts input).

## Evidence

- `odd-platform-ui/src/components/shared/elements/Autocomplete/NamespaceAutocomplete/NamespaceAutocomplete.tsx:51-57` — `setLoading(true)` then `dispatch(...).unwrap().then(({namespaceList}) => { setOptions(namespaceList); setLoading(false); })` — no `.catch`.
- `odd-platform-ui/src/components/shared/elements/Autocomplete/NamespaceAutocomplete/NamespaceAutocomplete.tsx:27-34` — type union shows 5 callers (TermForm, DataEntityGroupForm, DataSourceForm, CollectorForm, LookupTableForm).
- Same shape applies to MultipleFilterItemAutocomplete in DQ Dashboard (per SHB-157).

## Notes

- Compounds the silent-failure pattern across the platform (SHB-145 for tab thunks; this for autocompletes; SHB-161 for form submits).
- Fix is two lines: add `.catch(() => setLoading(false))` to the chain.
- Operator-impact: a transient network blip while editing a form mid-session locks the namespace selector. The operator can't proceed without refreshing the page (losing their other form input — see SHB-161 / SHB-162 / SHB-168 for the form-discard pattern).
- The N+1 anti-pattern (each keystroke fires a fresh fetch with no debounce — well, actually it IS debounced 500ms per NamespaceAutocomplete sidecar) reduces the blast radius but doesn't eliminate it.
- Cluster: this is the CANONICAL autocomplete-error-handling gap; ~11 sibling autocompletes share the pattern.

## Next

1. Fix NamespaceAutocomplete with `.catch(() => setLoading(false))`.
2. Grep `.unwrap().then(` in autocomplete folder; estimate sibling-component blast radius (likely ~11).
3. Promote: cluster_with F-031, F-028 (Namespace Lifecycle), F-019 (Owner), etc — many form-based features share the surface.

## Links

- cluster_with: [SHB-145, SHB-157, SHB-161]
- merged_into: (open)
- supersedes: []
