## REFACTOR-708 — Alerts list has NO DOM virtualisation; every loaded AlertItem (with Collapse-wrapped history) is mounted as a real DOM node. With 30K+ unresolved alerts paging through, the tab freezes the browser; resource_allocation grows O(N) without bound

**Severity**: MEDIUM
**Category**: missing-virtualisation / unbounded-DOM-growth
**Batch**: ZL (2026-05-26)
**Pillars affected**: [P-05 Alerts]

**Surfaced by**:
- `odd-platform__ts__react-component__component__Alerts.md:performance.resource_allocation` (HIGH) — "No DOM virtualisation — every alert in the loaded items array mounts as an AlertItem with Collapse-wrapped history. Memory grows O(N) in DOM nodes. For an operator with 10K+ unresolved alerts paging through, the page becomes the bottleneck before the backend does. ... Each AlertItem mounts useMemo for resolvedInfo (AlertItem.tsx:72-111) and useState ×3 (showHistory, disableResolve, isUpdating). At 10K items: ≈30K useState slots + 10K useMemo computations."
- `odd-platform__ts__react-component__component__Alerts.md:performance.known_performance_gaps[0]` (MEDIUM) — "No DOM virtualisation on a list that is intentionally page-by-page-infinite. Pages 1..10 (300 alerts) are OK; pages 1..100 (3000 alerts) degrade visibly; pages 1..1000 (30000 alerts) likely freeze the tab." — evidence: AlertsList.tsx:84-99 (Grid container + map, no react-window) — severity: MEDIUM
- `odd-platform__ts__react-component__component__Alerts.md:stress_findings.tunables[0]` (PROBE-NEEDED) — "What at tunable × 100 = 3000 items? Backend lists in fixed pages of 30 indefinitely (no max-page guard in repository); UI's InfiniteScroll appends to a single JS array on the heap. With 3000 alerts the items array holds 3000 React-rendered AlertItem rows (DOM virtualisation is NOT used — AlertsList.tsx:84-99 wraps a Grid container directly, not a react-window list). Memory and scroll-render cost grow O(N)."

**Statement**: `AlertsList.tsx:84-99` renders the loaded `state.alerts.items` array via `items.map(item => <AlertItem .../>)` inside a MUI `Grid` container. Each `AlertItem` mounts:
- A useMemo for `resolvedInfo` (AlertItem.tsx:72-111)
- Three `useState` hooks: `showHistory`, `disableResolve`, `isUpdating`
- A `Collapse`-wrapped alert chunk history view
- The Resolve/Reopen button (per REFACTOR-706)

Combined with the `InfiniteScroll` pattern (AlertsList.tsx:74-93) that APPENDS pages on scroll, the loaded items array grows monotonically until the user navigates away. Tabs share the slot (per ADR-CANDIDATE-245); tab-switch clears items; but within a single tab session, the array grows.

The backend `AlertController.getAllAlerts` paginates in fixed pages of 30 with no `total` cap and no max-page guard (per AlertController + ReactiveAlertRepositoryImpl sidecars). The UI dispatches `page=N+1` via InfiniteScroll as the user scrolls; each page adds 30 items to the React render tree.

**Operator-visible impact** (graduated by alert population):
- 1-300 alerts (pages 1-10): no visible perf issue
- 300-3000 alerts (pages 10-100): scroll feels sluggish; tab-switch shows latency
- 3000-30000 alerts (pages 100-1000): visible scroll stutter; clicking Resolve has noticeable lag
- 30000+ alerts: tab freezes / browser unresponsive

This is the classic "infinite scroll + no virtualisation" trap. For deployments with high alert volumes (ML monitoring, CI/CD alerting fan-out, large-org data quality), the cliff is reachable.

**Evidence**:
- `AlertsList.tsx:84-99` — `Grid container` + `items.map` rendering with no `react-window` / `react-virtualized` wrapper
- `AlertItem.tsx:72-111` + `useState ×3` — per-row hook count
- `AlertsList.tsx:74-93` — `InfiniteScroll` wrapper that APPENDS pages on scroll-threshold-cross
- `AlertController.java:36-41` — backend pagination with no max-page guard
- `ReactiveAlertRepositoryImpl.java:147` — offset = (page-1)*size, no clamping
- contrast: the rest of the codebase generally uses MUI Grid + map for finite lists; only Alerts has the unbounded-DOM hazard because of its open-ended infinite-scroll model

**Existing-ADR-or-implied-prescription**: The InfiniteScroll choice (UI commits to lazy pagination) implies the design assumption "operator stops scrolling before N gets large". This is reasonable for typical alert volumes (hundreds) but fails for high-alert-volume deployments. The architectural fix is to ADD virtualisation OR add a max-load ceiling with a "show all results" affordance.

**Proposed remedy**: Two options, in increasing scope:

1. **MEDIUM cost — adopt `react-window` for AlertsList**:
   - Replace the `Grid container + map` with a `react-window` `FixedSizeList` or `VariableSizeList`
   - Each row is virtualised; only ~30 rows in the visible viewport are mounted at any time
   - Memory becomes O(viewport) instead of O(total-loaded)
   - Trade-off: Collapse animation for alert-chunk-history needs careful handling (variable row height)
   - Effort: medium; requires AlertItem refactor to compute row height accurately

2. **LOW cost — soft cap with "show more"**:
   - After 500 items loaded, stop auto-scrolling; show a "Load more (X remaining)" button
   - Operator opts in to load more; UI doesn't unbounded-grow
   - Trade-off: less seamless UX
   - Effort: small; gate the `fetchNextPage` dispatch with a counter

**Recommended**: Option 1 for the high-alert-volume case. Option 2 as an interim cheap mitigation.

**Severity rationale**: MEDIUM — affects deployments with high alert volumes (3000+ unresolved); not visible at typical small-deployment sizes. The performance cliff is reachable but bounded by operator behaviour (people don't scroll through 1000 pages typically).

Below HIGH because:
- The default state (small alert volume) is fine
- The bad state (high alert volume) requires operator action (continuous scrolling) to reach
- Most operators are unlikely to scroll past 50-100 pages

Above LOW because:
- A large enterprise deployment WITHOUT alert housekeeping (REFACTOR-142) can accumulate 30K+ alerts within months
- Once reached, the tab is functionally unusable

**Suggested backlog grouping**: `PERF-NNN Alerts list scalability sprint` — pair with REFACTOR-142 (AlertHousekeepingJob operator-precedence bug that prevents RESOLVED-alert cleanup) and REFACTOR-705 (All-tab STATUS=OPEN filter — the bug that makes accumulation harder to spot). Cross-link with PERF-NNN for similar virtualisation gaps on other large lists.

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-142 (AlertHousekeepingJob predicate bug — compound with this scope because broken housekeeping accelerates alert accumulation toward the perf cliff); ADR-CANDIDATE-245 NEW this batch (multi-tab Redux single-slot — tab-switch DOES clear the items, providing a natural reset point that can be exploited as a "tab-switch as DOM reset" UX affordance).
- SUPERSEDES: none.
- CONFLICTS: none.

---
