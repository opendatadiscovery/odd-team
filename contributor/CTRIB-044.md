---
ctrib: CTRIB-044
github_issue_number: 1816
github_issue_url: https://github.com/opendatadiscovery/odd-platform/issues/1816
title: "Recently Viewed / Recommended — alert-row highlight on Favorites+RV home columns; horizontal scroll + pinned Name column on the 3 list tables"
class: feature-followup
milestone: "1.0.0"
status: pending-release   # MERGED #1830 @ 9fa5fea9 (Part of #1816). GATE 2 complete (maintainer merge). | LEDGER-RECONCILED 2026-08-30: was `done`; PR #1830 (`9fa5fea9`) merged, but NOT released — milestone 1.0.0, which is OPEN/UNRELEASED (latest release 0.29.0, 2026-06-26). GATE 2 is done; `/review release:1.0.0` owns the flip to `done`.
reproduced: "maintainer found in the running UI (2026-06-29): (1) the home Recommended Favorites + Recently Viewed columns do NOT highlight rows with open alerts the way Popular does; (2) on the DE / Term / Query-Example list views the Recently-viewed cell + its remove control clip on narrow screens with no way to reach them."
adr_required: false         # presentation-only; conforms to the shipped RV/favorites/Popular surfaces
tracking: "maintainer-directed follow-up to #1816 (CTRIB-042/043 precedent); no new GitHub issue; PR refs #1816 (already closed)"
plan_approved_by: "RamanDamayeu (maintainer) — GATE-1 AskUserQuestion 2026-06-29 (defect 1 = reuse Popular's highlight; defect 2 = horizontal scroll with the Name column PINNED)"
plan_approved_at: "2026-06-29"
docs_routing: "release/1.0.0 (recently-viewed.md note — TBD)"
pr_url: "https://github.com/opendatadiscovery/odd-platform/pull/1830 (DRAFT, Part of #1816; author odd-contributor[bot]; base main)"
pr_draft: true
stream: ctrib044
started: "2026-06-29"
---

# CTRIB-044 — Recommended alert highlight + list-table horizontal scroll (#1816 follow-up)

## Maintainer feedback (the two defects)

After CTRIB-042/043 merged, the maintainer flagged two list/recommended-surface defects:

1. **Alert highlight missing on the Recommended Favorites + Recently Viewed columns.** The **Popular**
   column highlights rows whose data entity has open alerts (a red `alert.OPEN` background + an alert icon);
   the Favorites and Recently Viewed columns do not. "Check how it's done for Popular and replicate."
2. **The Recently-viewed list cell + its remove control clip on narrow screens.** On the Data Entity search,
   the Dictionary term list, and the Query Examples list, when the viewport is too narrow the trailing
   columns (including the Recently-viewed cell + its `✕` remove) get compressed off-screen with no way to
   reach them. Ask: make the tables **horizontally scrollable** (AWS-Athena style) with the Name column
   **pinned**.

## GATE 1 — APPROVED (2026-06-29)

- Defect 1: a clean reuse of the Popular highlight (no decision needed).
- Defect 2: **pin the Name column** (Athena-style frozen first column) — the maintainer's pick over a simple
  scroll or a column-min-width-only fix.

## Design-before-build (Gate 4 / reuse)

- **Defect 1 is FE-only.** Traced the full chain: the home Favorites/RV columns resolve each row's
  `DataEntityRef` via the shared `AssetRefResolver` → `ReactiveDataEntityRepository.getDimensionsByIds` (the
  SAME full-dimensions CTE the Popular list uses) → `DataEntityMapperImpl.mapReference` which sets
  `.hasAlerts(dto.isHasAlerts())`. So the backend **already sends `hasAlerts`** for data-entity items in both
  lists — no backend change. Reused the Popular treatment: a shared `ListRow` (in `DataEntityListStyles`, the
  `$hasAlerts` `alert.OPEN` background) + the `AlertIcon`, applied to `FavoritesColumn` + `RecentlyViewedColumn`
  for data-entity rows (`asset.dataEntity?.hasAlerts`). Terms / Query Examples carry no alerts — untouched.
- **Defect 2 is FE-only.** A **single-scroll-container** sticky-table pattern per list: the scroll container is
  `overflow: auto` (both axes); the header is sticky to the **top**; the Name (first) column is sticky to the
  **left**; the header + rows floor at a min-width so they stop compressing and scroll right together.
  - **Two pixel-verify catches (why this took iteration — the value of looking at the rendered pixels):**
    (1) a first attempt — a separate horizontal-scroll wrapper with `overflow-x: clip` on the vertical
    container — rendered BROKEN: the rows scrolled while the header stayed put, because the vertical container
    is itself a horizontal scroll container that captured the sticky column. Switched to the single container.
    (2) Even then the header stayed put: the `InfiniteScroll` wrapper is its OWN `overflow: auto` box (1320px
    content / 644px clip) that scrolled the rows independently of `#results-list` (where the header lives). Fix:
    `style={{ overflow: 'visible' }}` on the InfiniteScroll so the rows overflow up to the single scroll
    container. Confirmed by a browser-injected repro before the rebuild (header + rows then scroll together,
    Name pinned).

## Implementation

Branch `contrib/CTRIB-044-recommended-alerts-and-list-hscroll` (off origin/main `4c0dbfc6` = #1828+#1829 merged;
same-name, never main-tracked). Worktree `../odd-platform-ctrib044`. FE-only.

- **Defect 1** (3 files): `DataEntityList/DataEntityListStyles.ts` (a shared `ListRow` mirroring `ListLink`'s
  `$hasAlerts` highlight) + `FavoritesColumn.tsx` + `RecentlyViewedColumn.tsx` (use `ListRow` + `AlertIcon` for
  data-entity rows with open alerts).
- **Defect 2** — Search (`Results.styles.ts`, `Results.tsx`, `TableHeader.tsx`, `ResultItem.tsx` + its styles,
  `SearchResultsSkeleton.tsx`): `ListContainer` is the single scroll container; `ResultsTableHeader` sticky-top;
  the Name `SearchCol` sticky-left (`$sticky`); header + rows `min-width SEARCH_TABLE_MIN_WIDTH`.
- **Defect 2** — Terms (`TermSearchResultsStyles.ts`, `TermSearchResults.tsx`, `TermSearchResultItem*`): the same
  pattern (`TermSearchListContainer` single container; header sticky-top; Term-name `colsm` sticky-left;
  `TERM_TABLE_MIN_WIDTH`).
- **Defect 2** — Query Examples (`StyledComponents/Table.ts` — shared, additive opt-in `$sticky`/`$minWidth`
  props default-off so the linked-QE / Relationships tables are unaffected; `QueryExamplesListHeader/Item`;
  `QueryExamplesList.tsx` — the header moved INSIDE the `ScrollableContainer`, sticky-top; first cell sticky-left;
  `QE_TABLE_MIN_WIDTH`, gated to the standalone list via the existing `showRecentlyViewed`/`showFavorite`).

## Test ledger (DoD)

- **Unit FE:** `tsc --noEmit` GREEN (the only eslint hits are `import/no-extraneous-dependencies` false
  positives from the symlinked `generated-sources` during local dev — absent in the real build).
- **Integration / IT-149 (extended +2 tests):** test 4 — the Recommended Recently-Viewed column highlights a
  data entity with open alerts (`[data-qa=recommended-alert]`); test 5 — the Search list scrolls horizontally
  with the Name pinned + the recency remove control reachable at a 900px-wide viewport. **Run-confirmed: IT-149
  5/5 GREEN** on the final SUT (`4e9977a4`).
- **Full e2e regression** (`run-regression.sh ctrib044`, SUT from worktree, digest `fea1477`): GREEN-FOR-CHANGE.
  **feature-complete 326 pass / 1 fail** — the 1 = the co-stream `ctrib039gb` Group-B test (independent); the
  restructured surfaces (`catalog-search`, `term-search`, `query-examples-crud-search`, IT-149 tests 1-3) all
  GREEN; known-bugs 3-RED-expected. (The `data-qa` hook added post-build is inert — an SVG attribute — so this
  no-breakage run stands for the final image; IT-149's 2 new tests were re-run 5/5 GREEN on the data-qa SUT.)
- **RED proof — run-confirmed:** IT-149 on `ODD_SUT=ref:4c0dbfc6` (the pre-CTRIB-044 base) → **3 pass / 2 fail**.
  Tests 1-3 pass (CTRIB-041/042/043 are on the base); **test 4 FAILS** (`[data-qa=recommended-alert]` not
  visible — the RV column has no alert marker on the base) and **test 5 FAILS** (`#results-list` `scrollWidth ==
  clientWidth` → `Expected true, Received false` — the list compresses to fit, not scrollable). Surviving-RED ✓.
- **Pixel review (G-C12):** home alert highlight CONFIRMED (the RV column flags the alerted entity with the red
  background + alert icon, matching Popular); the Search list scroll/pin CONFIRMED via two pixel-verify rounds
  (header + rows scroll together, Name pinned, recency remove reachable). Screenshots
  `it149-recommended-alert-highlight.png`, `it149-list-hscroll.png`.

## Docs (G-C10)

**No doc change** — both are presentation polish with no new user-facing concept: defect 1 mirrors the existing
(UI-detail) Popular alert treatment that the manual does not separately document; defect 2 is responsive layout
for the list marker that `data-discovery/recently-viewed.md` already documents as a dedicated column. Page read;
no claim to add or correct.

## Ontology (G-C10)

No refresh — presentation-only (no new/changed backend node); same basis as CTRIB-041/042/043.

## Status

`implementing` → pixel re-verify (2 rounds, caught 2 CSS bugs) → IT-149 5/5 GREEN + RED proof (4+5 RED on base)
+ full regression GREEN-for-change → pushed → **DRAFT PR #1830** (`Part of #1816`) → `/review` (separate session) → GATE 2.
