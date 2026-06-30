---
id: CTRIB-046
title: "Right-pin the Recently-viewed column on the Dictionary-term + Query-Examples lists (CTRIB-045 follow-up)"
issue: 1816
status: backlog
target_repo: odd-platform
milestone: "1.0.0"
scanner_source: ctrib-045-followup
effort: small
parent: CTRIB-045
---

## Context

CTRIB-045 pinned the Recently-viewed column to the right edge on the **catalog search** list so its value + ✕
are always on screen at standard widths (verified: IT-149 test 5 + pixel). The **Dictionary term** list
(`TermSearchResults`) and the **Query Examples** list (`QueryExamplesList`) currently get only the CTRIB-045
`max-height` + prominent 12px scrollbar — **not** the right-pin — because their layouts differ from the search
grid (flex columns + an empty trailing spacer column after the recency cell), so the pin needs a
layout-specific change plus its own pixel verification. Deferred rather than shipped unverified (the re-report
that produced CTRIB-045 was itself caused by an unverified fix).

## Scope

- **Terms**: add a right-pin to `TermSearchResultsColContainer` and apply it to the recency `colsm` column
  (header + row); handle the trailing `colxs` spacer (`TermSearchResultItem.tsx` line ~73).
- **Query Examples**: add a right-pin to the recency `Table.Cell` (header + row, `showRecentlyViewed`); handle
  the trailing spacer `Table.Cell` (`QueryExamplesListHeader.tsx` / `QueryExamplesListItem.tsx`).
- Verify each at the lg breakpoint with a seeded-row screenshot **and** an IT assertion that the recency
  remove control is `toBeInViewport()` with **no programmatic scroll** (`retrospectives/LSN-039`).

## Acceptance

- [ ] Terms list: at ≥1200px the recency value + ✕ are in the viewport without scrolling; verified by pixel + IT.
- [ ] Query Examples list: same.
- [ ] No regression on `term-search` / `query-examples-crud-search` (feature-complete green-for-change).
