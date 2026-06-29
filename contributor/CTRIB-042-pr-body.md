## Recently Viewed: recency as a dedicated list column (Data Entities, Terms & Query Examples)

Follow-up to #1816 (the Recently Viewed feature). Fixes a UX defect in the shipped frontend (#1827): on
the **list** surfaces the recency marker was rendered **inline next to the favorite star in the
Data-Entity search row** — it truncated the name and was only present on that one list.

This makes it a **dedicated "Recently viewed" column**, consistently, across all three list tables.

### What changed
- **Data Entity search** (`Search/Results`): a new `Recently viewed` column (header + cell). Its width is
  carved from the namespace/owner/group columns, so the **Name column keeps its full width** — and gains
  room now the inline marker is gone. The inline marker is removed from the name cell; the skeleton matches.
- **Terms (Dictionary)** and **Query Examples** lists: the same `Recently viewed` column. The Query-Examples
  row/header are shared with the linked-QE tables (term/dataset details), so the column is gated to the
  standalone list — the linked tables are untouched.
- The cell reuses the existing recency marker (shows "Viewed {when}" + a remove control for assets in the
  user's history, empty otherwise). The asset detail-header marker is unchanged.
- i18n: a "Recently viewed" column header in all 7 locales.
- Foundation for a future **sort by recently viewed** (a later enhancement; needs a backend sort key).

### Verification
- **Unit FE**: `tsc --noEmit` clean · `eslint` clean.
- **Integration (IT-149, extended)**: a new test asserts the recency shows in a dedicated column on the
  search list (header present + the row's marker in its column, not inline). GREEN on this branch; RED on
  `ref:main` by construction (the merged frontend renders the marker inline, no column).
- **Full e2e regression** on the image built from this branch: `feature-complete` green-for-change (IT-149
  both tests green; the Data-Entity search / Term / Query-Examples table specs — catalog-search,
  term-search, query-examples-crud-search, search-class-tab-filter, search-result-row-click — all green, so
  the grid rebalance regressed nothing); `multi-stack` + `ingestion-e2e` green; `known-bugs` at its baseline.

Milestone: 1.0.0
Docs: documentation@release/1.0.0 — the Recently Viewed page now describes the column on the three list
surfaces (publishes with the 1.0.0 release).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
