## REFACTOR-602 — `MultipleFilterItemAutocomplete`'s options-loading effect has a stale-closure + stuck-spinner bug — `hookResult` is missing from the dep array; on a slow/failed list query the spinner shows blank empty-string forever, and freshly-arrived options never flush

**Severity**: LOW
**Category**: race-condition / stale-closure / observability-blind
**Pillars affected**: [P-04 Data Quality — F-032 Quality Dashboard | cross-cutting any other surface using `MultipleFilterItemAutocomplete`]
**related_features**: [F-032]
**related_pillar_features**: [P-04:F-002]
**Batch**: ZC (2026-05-22)

**Surfaced by**:
- `odd-platform__ts__react-component__component__DataQualityFilters.md:bugs_limitations_corner_cases.[2]` (MEDIUM-LOW) — |-
    "**`MultipleFilterItemAutocomplete`'s options-loading effect has a stale-closure / stuck-spinner bug.** The effect at `MultipleFilterItemAutocomplete.tsx:91-104` sets `setOptionsLoading(true)` unconditionally, then sets it back to `false` ONLY inside `if (hookResult.isSuccess)`. Its dependency array is `[searchText, autocompleteOpen]` — `hookResult` is NOT in it. Consequences: (a) if the list query is still pending or has errored when the effect runs, `optionsLoading` stays `true` and the `noOptionsText` renders empty-string forever (`MultipleFilterItemAutocomplete.tsx:162`), so a failed list call shows neither options nor a 'No options' message; (b) because `hookResult` is excluded from deps, the effect does not re-run when the query later resolves, so freshly-arrived options are not flushed into `options` until the next `searchText`/`autocompleteOpen` change. The autocomplete can show stale or empty options after a slow/failed metadata fetch."

**Description**: `MultipleFilterItemAutocomplete.tsx:91-104` runs a `useEffect` with `[searchText, autocompleteOpen]` dependency. The effect body sets `setOptionsLoading(true)` unconditionally, then flushes options + sets `setOptionsLoading(false)` only inside `if (hookResult.isSuccess)`. The `hookResult` is captured by the closure on the LAST RENDER when the dep array fired — so:

- **Failure path**: list query errors. `hookResult.isError` is true, `hookResult.isSuccess` is false. Effect runs, sets loading=true, never sets it false. Spinner persists. `noOptionsText={optionsLoading ? '' : 'No options'}` (line 162) renders empty string. Operator sees the spinner forever; nothing tells them the query failed.
- **Slow path**: list query is still pending when the effect runs. `isSuccess` still false. Loading stays true. When the query LATER resolves, the effect does NOT re-run (because `hookResult` is NOT in the deps), so the new options never flush into local `options` state. The autocomplete shows nothing until the next `searchText` change (which is a fresh keystroke from the operator).

This is the classic React-hooks stale-closure trap. The eslint-plugin-react-hooks exhaustive-deps rule would catch it; verify whether it is on in the project lint config.

**Wisdom-test classification**: GAP. (1) Intentional? NO — it is a missed dependency, a standard React-hooks mistake. (2) Structural impact? NO — adding `hookResult` to deps (or refactoring to a `useMemo`-based pattern) is local. (3) Refactoring or structural? REFACTORING. → Refactoring scope.

**Primary source citations**:
- `MultipleFilterItemAutocomplete.tsx:91-104` (the effect with missing `hookResult` dep)
- `MultipleFilterItemAutocomplete.tsx:162` (the empty `noOptionsText` when loading)

**Existing-ADR-or-implied-prescription**: none.

**Proposed remedy**: Two options.

1. **Smallest** — add `hookResult` (or specifically `hookResult.isSuccess`, `hookResult.isError`, `hookResult.data`) to the dependency array. The effect re-runs when the query state transitions, options flush correctly, loading clears on both success and error. Add an `isError` branch that surfaces "Failed to load options" in `noOptionsText`.
2. **Better** — refactor to remove the local `options` state entirely; compute the options array via `useMemo` directly from `hookResult.data` + `searchText` + selected options. Eliminates the stale-closure surface; reduces re-renders.

Either is a small local change. Pair with REFACTOR-596 (no error UI) for a uniform "list-API failure surfaces visibly" pass.

**Severity rationale**: LOW — bug manifests only when a list-API call is slow or errors, AND the operator does not change search prefix during the lag. The failure path produces a confusing UI (blank spinner) rather than a wrong result. Severity LOW because (a) the list APIs are typically fast; (b) the operator can recover by typing more characters; (c) no data corruption. Worth fixing in the dashboard sprint but not a blocking issue.

**Suggested backlog grouping**: `Quality Dashboard hardening sprint`. Apply the fix to `MultipleFilterItemAutocomplete` (the shared component) so all autocomplete sites benefit.

---
