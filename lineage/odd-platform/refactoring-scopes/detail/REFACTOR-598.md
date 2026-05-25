## REFACTOR-598 — Dashboard filter autocompletes are CAPPED at the first 30 options per search prefix with NO pagination, no infinite-scroll, no 'load more', no truncation indicator — catalogs with >30 namespaces/owners/tags are not fully filterable

**Severity**: MEDIUM
**Category**: size-limit-silent-trunc / missing-pagination
**Pillars affected**: [P-04 Data Quality — F-032 Quality Dashboard]
**related_features**: [F-032]
**related_pillar_features**: [P-04:F-002]
**Batch**: ZC (2026-05-22)

**Surfaced by**:
- `odd-platform__ts__react-component__component__DataQualityFilters.md:bugs_limitations_corner_cases.[3]` (MEDIUM) — |-
    "**The autocomplete fetches a fixed first page of 30 options and never paginates — catalogs with >30 namespaces/owners/tags are not fully filterable.** `useFilter` hard-codes `{ page: 1, size: 30 }` (`hooks/index.ts:13-16`) and there is no page-increment, no infinite-scroll, no 'load more'. The server query DOES receive the `query` text, so server-side name search narrows the 30; but `getFilterOptions` ALSO re-filters client-side (`MultipleFilterItemAutocomplete.tsx:75-89`). If an operator's catalog has 200 owners and the desired owner is not in the first 30 the server returns for a given search prefix, it cannot be selected via that prefix. For short or empty search text the operator sees only the first 30 of the dimension."

**Description**: `useFilter` (`hooks/index.ts:13-16`) calls each list API with hard-coded `{ page: 1, size: 30 }`. There is no mechanism to retrieve page 2; no infinite-scroll on the dropdown; no 'load more' button; no count-indicator showing "Showing 30 of N." For a catalog with more than 30 entries in a filter dimension (a common shape for owners, tags, namespaces in any non-trivial deployment), the operator can ONLY select entities that surface in the first 30 returned for the prefix they have typed.

The server-side search DOES filter by `query` text — so an operator typing 'pos' will narrow the 30 to "options whose name matches 'pos'." But if a user wants to filter the dashboard by owner 'Zeta Team' and types 'z', they get the first 30 owners whose name contains 'z'; if 'Zeta Team' is not in that first 30 (alphabetical or server-side-ordering tail), the operator cannot scroll to find it. The redundant client-side substring filter at `MultipleFilterItemAutocomplete.tsx:75-89` is a useful UX (narrows quickly as the operator types more characters) but operates on an already-truncated 30-element set.

The truncation is SILENT — there is no UI indicator distinguishing "this dimension has 30 entries (showing all)" from "this dimension has 30,000 entries (showing top 30)." The operator cannot tell their search is incomplete.

**Wisdom-test classification**: GAP. (1) Intentional? `size: 30` is a deliberate page size, not an oversight; but the absence of page-2 mechanism is unintentional — the team built the autocomplete with a single-page assumption and did not return to add pagination. (2) Structural impact? NO — adding pagination is purely additive within the existing component. (3) Refactoring or structural? REFACTORING. → Refactoring scope.

**Primary source citations**:
- `hooks/index.ts:13-16` (`page: 1, size: 30` hard-coded; no page-state, no increment)
- `MultipleFilterItemAutocomplete.tsx:75-89` (client-side substring filter — runs on the already-truncated 30)
- `MultipleFilterItemAutocomplete.tsx:146-178` (the render path — no count/truncation hint)
- `interfaces.ts:11-19` (the Hook contract — fixes page/size/query at the interface level)

**Existing-ADR-or-implied-prescription**: none — the dashboard's autocomplete is one instance of a broader project pattern (every filter autocomplete in the SPA likely has the same shape). A project-wide pagination primitive would benefit all.

**Proposed remedy**:

1. **Infinite-scroll**: detect dropdown-scroll-near-bottom and fetch the next page (`page: 2, page: 3, ...`). Append to the existing options array. The standard MUI pattern via `ListboxComponent` + scroll detection.
2. **Count indicator**: surface "Showing N of M" in the dropdown header when the result set might be truncated (when the server returns a `hasNext` page-meta or when `options.length === size`).
3. **Pair with REFACTOR-597 (debounce)** — the two together form the right autocomplete UX: debounce keystrokes, paginate on scroll, indicate truncation.

**Severity rationale**: MEDIUM. Operator-impact depends on catalog size: deployments with <30 entries per filter dimension are unaffected; medium-to-large catalogs (50+ owners, 50+ tags) experience silent unselectability. Not data-loss; the operator has alternative paths (type a more specific prefix to narrow further) — but for short or generic prefixes the alternative paths fail and the operator's only signal is "I can't find what I'm looking for; is it not there or is the UI broken?".

**Suggested backlog grouping**: `Quality Dashboard hardening sprint` + cross-cutting `autocomplete hygiene` (with REFACTOR-597). Consider a project-wide primitive that solves debounce + pagination + truncation-indicator together.

---
