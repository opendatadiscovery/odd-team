## REFACTOR-709 — Alerts list has NO request cancellation on tab-switch; a slow page-2 fetch initiated before tab-switch resolves into the (just-cleared) new-tab state, briefly displaying wrong-tab items. InfiniteScroll has no AbortController; useEffect cleanup absent

**Severity**: LOW
**Category**: missing-request-cancellation / late-response-leak
**Batch**: ZL (2026-05-26)
**Pillars affected**: [P-05 Alerts]

**Surfaced by**:
- `odd-platform__ts__react-component__component__Alerts.md:bugs_limitations_corner_cases[4]` (MEDIUM) — "InfiniteScroll auto-fetches based on `scrollThreshold='200px'` (AlertsList.tsx:91) — fast-scroll on a large list will issue page=N+1 requests faster than the backend can return, but the slice's pageInfo.page mirrors the response page (alerts.thunks.ts:41), so a stale-response could overwrite a fresher-response slot. No request cancellation on tab-switch — switching tabs while a fetch is in-flight may cause the late response to land into the (just-cleared) new-tab state." — evidence: AlertsList.tsx:73-91 + alerts.slice.ts:25-32 — severity: MEDIUM
- `odd-platform__ts__react-component__component__Alerts.md:performance.known_performance_gaps[1]` (LOW) — "No request cancellation on tab-switch — `useEffect([fetchAlerts])` (AlertsList.tsx:79-81) does not return a cleanup function. A slow page-2 fetch initiated before tab-switch resolves into the new tab's now-cleared state." — evidence: AlertsList.tsx:79-81 — severity: LOW
- `odd-platform__ts__react-component__component__Alerts.md:performance.scaling_characteristics[1]` — "InfiniteScroll has no cancellation on unmount/tab-switch (AlertsList.tsx:86-93). A stale fetch from a previous tab can resolve into the (just-cleared) new-tab state, briefly displaying wrong-tab items."
- `odd-platform__ts__react-component__component__Alerts.md:stress_findings.resource_boundaries` (HIGH) — "Yes — limited corruption is reachable. Slice reducer `updateAlerts` always reads pageInfo.page from the action payload. If page-1 and page-2 fetches race AND page-2 returns first, the page-2 branch (pageInfo.page > 1) APPENDS items 31-60. Then page-1 returns, sees pageInfo.page == 1, REPLACES items with rows 1-30, dropping page-2's already-received rows. State is now coherent (rows 1-30) but the user briefly saw a longer list. No persistent corruption."

**Statement**: `AlertsList.tsx:79-81` declares `useEffect(() => { dispatch(fetchAlerts({page:1, size:30})); }, [fetchAlerts])` with no cleanup function. The `InfiniteScroll` wrapper (AlertsList.tsx:74-93) dispatches additional `fetchAlerts({page:N+1, size:30})` on scroll-threshold-cross. None of these dispatches use AbortController; the fetch chain (thunk → axios → backend → response) is uncancellable.

When the user switches tabs (e.g. /alerts/all → /alerts/my):
1. The Alerts page-root remains mounted (per ADR-CANDIDATE-245); only the inner Route changes.
2. `AlertsTabs.tsx:44-46` dispatches `changeAlertsFilterAction` which clears `state.alerts.items = []`.
3. The new tab's AlertsList re-mounts, dispatches `fetchAlerts` for the new tab's thunk binding.
4. **Meanwhile**, any in-flight fetches from the prior tab are STILL IN FLIGHT — backend doesn't know about the tab-switch.
5. When the prior fetch resolves, the redux action (e.g. `fetchAllAlertList.fulfilled`) lands; the SHARED `updateAlerts` reducer (per ADR-CANDIDATE-245) writes the items into the SAME slot.
6. The user sees old-tab items briefly in the new tab.

A worse variant: two concurrent fetches on the SAME tab race. If page-1 and page-2 race AND page-2 returns first → reducer's page>1 branch APPENDS items 31-60 into items[]; THEN page-1 returns → reducer's page==1 branch REPLACES items with rows 1-30 → page-2's items are dropped. State converges to a coherent page-1 view but the user briefly saw page-1+page-2 merged.

**Operator-visible impact**:
- Rare in practice (requires slow backend or fast tab-switching by the operator)
- When triggered: items flicker between two tabs' content for 100-500ms
- No persistent state corruption (the final state converges via reducer ordering)
- No functional bug; cosmetic only

**Evidence**:
- `AlertsList.tsx:79-81` — `useEffect(() => { dispatch(fetchAlerts({...})); }, [fetchAlerts])` with no `return () => ...` cleanup
- `AlertsList.tsx:74-93` — InfiniteScroll wrapper dispatching pages on scroll
- `alerts.thunks.ts:33-70` — three fetch thunks with no AbortSignal plumbing
- `alerts.slice.ts:25-32` — shared `updateAlerts` reducer with REPLACE-vs-APPEND logic on pageInfo.page
- contrast: well-architected React surfaces use `AbortController` in the useEffect cleanup; e.g. some Activity / Catalog code uses it (per other sidecars). Alerts hasn't adopted it.

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-245 (multi-tab Redux single-slot) is the architecture that makes this race observable — because all three tabs share `state.alerts.items`, a stale fetch can land anywhere. The architecture itself isn't wrong; the missing piece is request cancellation on tab-switch / unmount.

**Proposed remedy**: Two options, complementary:

1. **LOW cost — AbortController in useEffect cleanup**:
   - At `AlertsList.tsx:79-81`, add an AbortController:
   ```tsx
   useEffect(() => {
     const ac = new AbortController();
     dispatch(fetchAlerts({ page:1, size:30, signal: ac.signal }));
     return () => ac.abort();
   }, [fetchAlerts]);
   ```
   - Plumb the signal through `alerts.thunks.ts` into the axios call
   - On unmount / dep-change, the in-flight fetch is aborted; reducer never sees the fulfilled action
   - Effort: small; touches 1-2 files

2. **MEDIUM cost — Redux Toolkit's built-in requestId for stale-response protection** (cross-link REFACTOR-277):
   - Use `arg.requestId` provided by Redux Toolkit on every dispatch
   - In the reducer, track the LATEST requestId per slot; ignore fulfilled actions whose requestId is stale
   - Effort: medium; requires reducer logic change but reuses Redux Toolkit machinery

**Recommended**: Option 1 (AbortController) for tab-switch case. Option 2 (requestId guard) for the within-tab fast-scroll race. Together they close both observable failure modes.

**Severity rationale**: LOW — cosmetic-only; no data corruption; rare in practice. Trust-impact bounded:
- Users on fast networks rarely see the race
- Users on slow networks see brief flicker but the state converges correctly
- No security implications

Not zero because:
- The race is observable in the wild; operators reporting "I clicked My Objects and saw All-tab items briefly" cannot tell whether it's the race or a real bug
- The fix is small and well-understood; leaving it costs incremental debug overhead

**Suggested backlog grouping**: `UX-NNN Alerts clarity sprint` — pair with REFACTOR-705, REFACTOR-706, REFACTOR-707. Also pair with REFACTOR-277 (handleResponseAsyncThunk requestId-not-propagated — the same class of stale-response issue on a different surface).

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-245 NEW this batch (multi-tab Redux single-slot — this scope is a failure-mode of the shared-slot architecture without request cancellation); REFACTOR-277 (handleResponseAsyncThunk requestId protection — sibling class on a different surface).
- SUPERSEDES: none.
- CONFLICTS: none.

---
