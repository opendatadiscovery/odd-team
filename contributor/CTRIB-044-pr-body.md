## Recommended alert highlight + horizontal scroll on the list tables (Favorites / Recently Viewed / Search / Terms / Query Examples)

Two FE follow-ups to #1816, found by the maintainer in the running UI.

### 1. Alert-row highlight on the Recommended Favorites + Recently Viewed columns
The **Popular** column highlights rows whose data entity has open alerts (a red background + an alert icon).
The **Favorites** and **Recently Viewed** columns now do the same. They already receive `hasAlerts` from the
backend (the shared asset resolver hydrates each data entity via the full-dimensions query, exactly like
Popular), so this is presentation-only — no backend change. Terms / Query Examples carry no alerts and are
unchanged.

### 2. Horizontal scroll + pinned Name column on the list tables
On the **Data Entity search**, the **Dictionary term list**, and the **Query Examples list**, narrow screens
compressed the trailing columns so the **Recently viewed** cell and its remove control clipped off-screen with
no way to reach them. Each list is now a single horizontally-scrollable table — the header is pinned to the
top and the **Name column is pinned to the left** (the AWS-Athena wide-table pattern), floored at a min-width
so the columns stop compressing.

### Verification
- **Unit**: `tsc --noEmit` clean.
- **Integration (IT-149, extended)**: two new tests — the Recommended Recently-Viewed column highlights an
  alerted entity (the Popular treatment); the Search list scrolls horizontally with the Name pinned and the
  recency remove control reachable at a 900px viewport. GREEN on this branch; RED on `ref:main` (the columns
  carry no alert marker, and the list compresses instead of scrolling).
- **Full e2e regression** on the image built from this branch: `feature-complete` green-for-change (the
  restructured `catalog-search` / `term-search` / `query-examples` surfaces all green; IT-149 5/5);
  `known-bugs` at its baseline.

Milestone: 1.0.0
Docs: no change — presentation polish, no new user-facing concept.

Part of #1816

🤖 Generated with [Claude Code](https://claude.com/claude-code)
