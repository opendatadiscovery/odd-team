---
ctrib: CTRIB-042
github_issue_number: 1816
github_issue_url: https://github.com/opendatadiscovery/odd-platform/issues/1816
title: "Recently Viewed — recency as a dedicated list column (DE / Terms / Query Examples)"
class: feature-followup
milestone: "1.0.0"
status: pr-draft            # GATE 1 approved; DoD met; DRAFT PR #1828 (follow-up to #1816). /review -> GATE 2.
reproduced: "UX defect on the merged S2 (#1827): the list-surface recency marker is inline in the DE name cell (truncates the name) + only on Data Entities"
adr_required: false         # presentation refactor; conforms to the shipped RV foundation
tracking: "maintainer-directed follow-up to #1816 (CTRIB-040 precedent); no new GitHub issue; PR refs #1816"
plan_approved_by: "RamanDamayeu (maintainer) — GATE-1 AskUserQuestion 2026-06-29"
plan_approved_at: "2026-06-29"
docs_routing: "release/1.0.0 (DOC-494 update @ 7cb1773)"
pr_url: "#1828 (DRAFT, follow-up to #1816)"
pr_draft: true
stream: ctrib042
started: "2026-06-29"
---

# CTRIB-042 — Recently Viewed: recency as a dedicated list column (#1816 follow-up)

## Maintainer feedback (the defect)

After merging S2 (#1827), the maintainer flagged the **list-surface** recency marker as "weird and
inconsistent": it is rendered **inline next to the favorite star in the Data-Entity search row, which
truncates the name**, and it is **only on the Data-Entity list** (not Terms, not Query Examples). The
ask: make it **a separate field/column in the table**, on **all three** list surfaces, and (later) allow
**sorting by recently-viewed**. (The detail-header marker is fine — only the list placement is the defect.)

This is owned as my S2 miss: a per-asset marker on a list table belongs in the table's own column system,
consistent across kinds — not crammed inline. (Memory: `feedback_reuse_platform_ui_patterns`.)

## GATE 1 — APPROVED (2026-06-29)

- **Tracking:** maintainer-directed, no new issue (CTRIB-040 precedent); the PR refs #1816 (1.0.0).
- **Column position:** trailing, by Created/Updated.

## Design-before-build (the three list surfaces)

All three are column tables; the cell **reuses the existing `RecentlyViewedTag`** (shows "Viewed {when}"
+ remove when the asset is in the user's history, else nothing) — no new component:

- **Data Entity search** (`Search/Results`): a proportional 12-col grid (`gridSizes`, 9 tab-variants ×
  lg/md) + `TableHeader` + `ResultItem` cells. Added an `rv` column carved from the **namespace/owner/group**
  widths (nd/ow/gr) in every variant — the **Name column (nm) keeps its full 2.68 width** and gains room now
  the inline marker is gone (the whole point). Removed the inline tag from the name cell; updated the skeleton.
- **Terms (Dictionary)** (`TermSearchResults` + `TermSearchResultItem`): flex columns (`$colType`) — added a
  `colsm` "Recently viewed" header + cell; the flex redistributes (no manual rebalance).
- **Query Examples** (`QueryExamplesListHeader` + `QueryExamplesListItem`): flex `Table.Cell`s. The item +
  header are **shared with the linked-QE tables** (term/dataset details), so the column is gated to the
  **standalone** list (`showRecentlyViewed` on the header, the existing `showFavorite` on the item) — the
  linked tables are untouched.
- i18n: a "Recently viewed" column header in all 7 locales (the tag strings already shipped in S2).
- **Sort by recency:** deferred (a later enhancement; needs a backend sort key on the search/list APIs). The
  column is its foundation. The #1825 Search overhaul will consolidate these three surfaces into one
  configurable column system — this fixes the three current surfaces in the interim.

## Implementation

Branch `contrib/CTRIB-042-recently-viewed-list-column` @ `0e5cc70c` (off merged main 3cbb3b85; same-name,
never main). Worktree `../odd-platform-ctrib041` (reused; ctrib041 PRs merged). 16 FE files (the 9
components/styles + 7 locales). The RecentlyViewedTag component is unchanged.

## Test ledger (DoD)

- **Unit FE:** `tsc --noEmit` GREEN · `eslint` GREEN (after prettier). The `recentlyViewed` slice test is
  unchanged (still green); the changed files are presentation (type-covered by tsc; behaviour by IT-149).
- **Integration / IT-149 (extended):** added a second test — *the list surface shows recency as a dedicated
  column, not inline*: seed a searchable entity, open it (record), then on `/search` assert the **"Recently
  viewed" column header** + the entity row's **recency marker** (`data-qa=recently-viewed-tag`). RED on
  `ref:main` (3cbb3b85 — the S2 inline placement, no column) by construction; GREEN on this fix. Pixel
  screenshot captured (`it149-recency-list-column.png`).
- **Full e2e regression** (`run-regression.sh ctrib042`, SUT from worktree @ 0e5cc70c): GREEN-FOR-CHANGE.
  feature-complete **325 pass / 1 fail** — IT-149 BOTH tests GREEN (test 264 the open->see loop; test 265 the
  new list-column "recency in a dedicated column, not inline"); the 1 fail = the unchanged co-stream Group-B
  Description test (not mine). The rebalanced DE search table + the Term/QE lists regressed nothing:
  catalog-search, term-search, query-examples-crud-search, search-class-tab-filter, search-result-row-click
  all GREEN (the CTRIB-004 shared-surface guard). known-bugs 3-RED-expected/0-unexpected-green; multi-stack 9;
  ingestion-e2e 15.
- **RED proof:** IT-149 list-column test on `ODD_SUT=ref:main` (3cbb3b85) — RUNNING; the "Recently viewed"
  column header is absent on the merged-S2 inline placement, so test 265 is RED on base while test 264 stays
  GREEN (run-confirmed result appended on completion).

## Docs (G-C10)

DOC-494 updated: `documentation@release/1.0.0` @ `7cb1773` — `recently-viewed.md` "last viewed marker"
section now describes the dedicated **Recently viewed column** across the three list surfaces (name keeps
full width). Publishes at the 1.0.0 release gate.

## Ontology (G-C10)

No refresh — presentation-only change (no new/changed backend node); same deferral basis as S2.

## Status

`implementing` → (regression + RED proof) → DRAFT PR (refs #1816) → `/review` (separate session) → GATE 2.
