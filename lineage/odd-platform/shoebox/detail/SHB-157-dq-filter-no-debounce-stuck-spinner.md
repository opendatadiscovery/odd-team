# SHB-157 — DQ Dashboard filter autocompletes have no debounce + stuck-spinner-on-fail; operators see request bursts and broken loading states

**Category**: open
**Severity**: MEDIUM

## Hypothesis

When operators interact with the DQ Dashboard's 10 filter autocompletes (5 dimensions × 2 sides), each keystroke fires a fresh `GET /api/{namespaces|datasources|owners|titles|tags}` request — there is no debounce, no minimum-character gate, no in-flight de-dup. Typing a 10-character namespace name fires up to 10 list requests. Worse: if the list request errors, the autocomplete's `optionsLoading` flag remains `true` forever because the cleanup is gated behind `if (hookResult.isSuccess)` and `hookResult` isn't in the effect's dep array — the spinner strands on, `noOptionsText` renders as empty string, and the operator can neither see options nor a "No options" message.

## Evidence

- `odd-platform-ui/src/components/DataQuality/DataQualityFilters/MultipleFilterItemAutocomplete.tsx:57-66` — `onInputChange` calls `setSearchText(query)` immediately, no debounce wrap.
- `odd-platform-ui/src/components/DataQuality/DataQualityFilters/hooks/index.ts:13-17` — `useFilter`'s `useHook({page: 1, size: 30, query: searchText})` — `searchText` is the React-Query key; each character is a new fetch.
- `odd-platform-ui/src/components/DataQuality/DataQualityFilters/MultipleFilterItemAutocomplete.tsx:91-104` — stale-closure effect: `setOptionsLoading(true)` runs unconditionally; `setOptionsLoading(false)` runs ONLY inside `if (hookResult.isSuccess)`. Dep array `[searchText, autocompleteOpen]` excludes `hookResult`.
- `odd-platform-ui/src/components/DataQuality/DataQualityFilters/MultipleFilterItemAutocomplete.tsx:162` — `noOptionsText={optionsLoading ? '' : 'No options'}` — empty string when stuck.

## Notes

- The stuck-spinner is invisible on a healthy backend but surfaces immediately on flaky network; the operator sees a permanent spinner with no options and no error message.
- The 30-row fetch cap (per SHB-159 sibling thread on NamespaceAutocomplete) compounds: catalogs with >30 namespaces show 30, with no "load more" — a namespace past position 30 is unreachable through that prefix.
- React-Query's per-key cache de-duplicates repeats but NOT the distinct prefixes typed; a fast typist generates a request burst regardless.
- Same shape applies to the OTHER autocomplete in the codebase (NamespaceAutocomplete used by 5 forms — see SHB-159). The pattern is widespread.
- guess: backend `/api/namespaces` and friends have no rate limit; an automated UI testing fuzzer could DoS via the autocomplete with the right pattern.

## Next

1. Add `useDebouncedCallback` (already in deps for NamespaceAutocomplete) around `setSearchText` in `MultipleFilterItemAutocomplete` — one-line fix.
2. Fix the stale-closure: add `hookResult.isLoading`/`isError` to the dep array, or refactor to set `optionsLoading` from `hookResult.isLoading` directly.
3. Add a "Showing 30 of N" indicator OR implement infinite-scroll for catalogs with >30 namespaces / owners / tags.

## Links

- cluster_with: [F-032, SHB-159]
- merged_into: (open)
- supersedes: []
