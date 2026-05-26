# SHB-146 — Activity tab link carries a 5-day window baked at SPA-bundle load time, not click time

**Category**: merged
**Severity**: LOW

## Hypothesis

If an operator keeps the SPA tab open for days without reload (a common laptop-suspend pattern) and then clicks the Activity tab from any non-Activity page, they land on `/activity?<query>` where the 5-day window's begin/end dates were computed at MODULE-IMPORT TIME (when the JS bundle loaded), not at click time. So an operator clicking Activity 8 days after first SPA load sees a window that ends 3 days ago instead of today, with no visual cue that the window is stale. The window only refreshes on a full page reload.

## Evidence

- `odd-platform-ui/src/components/shared/elements/Activity/common.ts:33-41` — `defaultActivityQuery` is a module-level constant; `beginDate: addDays(new Date(), -5)`, `endDate: new Date()` are evaluated AT MODULE LOAD, not in a function.
- `odd-platform-ui/src/components/shared/elements/AppToolbar/ToolbarTabs/ToolbarTabs.tsx:75-79` — Activity tab uses `activityPath(activityQueryString)`.
- `odd-platform-ui/src/components/shared/elements/AppToolbar/ToolbarTabs/ToolbarTabs.tsx:31-32, 77, 81` — `activityQueryString` derives from `useQueryParams(defaultActivityQuery)` on the CURRENT page; when the user is NOT on the Activity page (so no URL params are set), it falls through to `defaultActivityQuery` whose values were baked at bundle load.
- `odd-platform-ui/src/components/shared/elements/AppToolbar/ToolbarTabs/ToolbarTabs.tsx:81` — useMemo dep `activityQueryString` rebuilds the tab list when the query changes, but the underlying defaults still derive from the module-load timestamp.

## Notes

- The bug is invisible unless the SPA has been idle for >24 hours; for power users keeping the SPA pinned, the window slides further out of date each day.
- Operator impact: an SRE checking "what changed today" via the Activity tab sees a window that ends N days ago (where N = days since SPA bundle load).
- The fix is trivial — replace the module-level constants with a function call inside `useQueryParams` defaults — but the bug is exactly the class an integration test would never catch (you'd need to mock Date.now across module reload boundaries).
- guess: same shape applies to any other module-level `new Date()` or `addDays(new Date(), ...)` — worth a grep audit across `common.ts` / `constants.ts` modules.

## Next

1. Grep for `new Date()` outside of functions in `odd-platform-ui/src/**/*.ts` to find other module-load-time date snapshots.
2. Decide whether to file as a REFACTOR-NNN (move the date into a function) or as a feature-candidate ("Activity window — stale-default footgun") graduating into F-NNN if other surfaces share the shape.
3. Verify whether the Activity page on landing immediately rewrites the URL to the now-time window or honours the stale param.

## Links

- cluster_with: []
- merged_into: F-041
- supersedes: []

## evaluation

- **feature-flow-builder 2026-05-26**: merge — adds a NEW facet to F-041 capturing the module-load-time `new Date()` evaluation on the Activity tab's query window. The bug surfaces THROUGH the toolbar (the tab's `to=` href carries the stale dates), so F-041's chrome is the operator-visible site even though the root cause is in Activity/common.ts. F-041: Application Toolbar — drift_class: module_load_time_date_snapshot_stale_window_across_spa_session.
