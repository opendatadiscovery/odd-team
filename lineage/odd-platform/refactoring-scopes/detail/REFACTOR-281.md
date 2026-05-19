## REFACTOR-281 — Skeleton flicker on legitimate re-fetch: render gate predicates on BOTH `details.id` AND `!isDataEntityDetailsFetching`, so any refetch hides the chrome until it lands; LSN-017 doubles the flicker frequency

**Severity**: LOW
**Category**: ux-bug
**Pillars affected**: [P-01] — Discovery (detail-page UX)
**Surfaced by**:
- `DataEntityDetails.md:bugs_limitations_corner_cases[4]` (|-
    "**Skeleton-flicker on legitimate re-fetch.** When `isDataEntityGroupUpdated` (or sibling group flag) flips, the useEffect dispatches a fresh `fetchDataEntityDetails` — which sets `isDataEntityDetailsFetching=true` in the slice, hiding the header+tabs and showing the skeleton (line 80's check fails on the `!isDataEntityDetailsFetching` branch). The user briefly loses the page chrome on what should be a transparent refresh. A pattern using `isFetching && !details.id` (skeleton only on first load) vs `isFetching && details.id` (in-place refresh, no skeleton) would smooth the experience.")
- `DataEntityDetails.md:performance.known_performance_gaps[1]` (|-
    "**Skeleton flicker on legitimate re-fetch (DEG mutation, status change) — the render gate predicates on BOTH `details.id` AND `!isDataEntityDetailsFetching`, so any refetch hides the chrome.** Cost is purely UX (a brief flicker) but it compounds the LSN-017 doubling: every status change triggers a +2 view_count + a chrome flicker.")

**Description**: The render gate at `DataEntityDetails.tsx:80` predicates the header + tabs render on BOTH `details.id` being set AND `isDataEntityDetailsFetching` being false. Any re-fetch (legitimate DEG mutation, status change, the LSN-017 buggy refire) flips `isDataEntityDetailsFetching` to true, hides the chrome, shows the skeleton, then re-renders with chrome when the response lands.

For the user, this is a brief flicker on what should be a transparent refresh — the data hasn't disappeared, just the rendering predicate. A better pattern:
- `isFetching && !details.id` → show skeleton (first load).
- `isFetching && details.id` → show in-place refresh (keep chrome visible, optionally show a subtle spinner).

The LSN-017 self-feeding loop doubles the flicker: every page-mount triggers TWO fetches; the chrome flickers TWICE per mount.

**Primary source citations**:
- `DataEntityDetails.tsx:80` — the predicate
- `DataEntityDetails.md` documents the gap and the LSN-017 amplification

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-087 codifies the page-component-owns-data-fetch pattern. The predicate is a sub-behaviour of the pattern; no ADR prescribes the chrome-hide-on-refetch.

**Proposed remedy**: Change the predicate at `DataEntityDetails.tsx:80` from `details.id && !isDataEntityDetailsFetching` to `details.id` (show chrome if details exist, regardless of fetching state). Optionally add a subtle spinner near the entity name to indicate in-flight refresh. Pair with REFACTOR-220 (LSN-017 fix at line 63) to halve the flicker frequency.

**Severity rationale**: LOW — UX flicker, not a correctness or security bug. Compounds with LSN-017 (REFACTOR-220) — fixing both together gives the cleanest result.

**Suggested backlog grouping**: `UI UX polish sprint` (alongside the LSN-017 fix REFACTOR-220).

---
