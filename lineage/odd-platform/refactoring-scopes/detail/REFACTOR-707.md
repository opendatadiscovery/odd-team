## REFACTOR-707 — Alerts tab badge totals (`totals.total`, `myTotal`, `dependentTotal`) are fetched ONCE on Alerts.tsx mount (`useEffect([])`) and never refresh — Resolve actions, tab navigation, and new backend alerts do not invalidate the badge counts; operator who resolves alerts watches the badge stay stale until full page reload

**Severity**: MEDIUM
**Category**: stale-data / no-cache-invalidation
**Batch**: ZL (2026-05-26)
**Pillars affected**: [P-05 Alerts]

**Surfaced by**:
- `odd-platform__ts__react-component__component__Alerts.md:bugs_limitations_corner_cases[2]` (MEDIUM) — "Tab badge totals (totals, myTotal, dependentTotal) are fetched ONCE on mount (Alerts.tsx:15-17, `useEffect([])` no deps) — they do not refresh after a Resolve action, after navigating tabs, or after the backend creates new alerts. An operator who resolves alerts watches the badge stay stale until full reload." — evidence: Alerts.tsx:15-17 — severity: MEDIUM
- `odd-platform__ts__react-component__component__Alerts.md:performance.known_performance_gaps[2]` (LOW) — "Totals are fetched once on Alerts mount and never refreshed — operator who resolves an alert sees the badge stay stale (off-by-one) until they leave and re-enter /alerts. Not a correctness bug, but an obvious UX gap."
- `odd-platform__ts__react-component__component__Alerts.md:bugs_limitations_corner_cases[6]` (MEDIUM) — "Tab list rendering when API totals are absent: AlertsTabs.tsx:23,28,34 fall back to `?? 0` — when fetchAlertsTotals fails (network error / 403) all three tabs show '0' with no visible failure indicator. Operator may interpret as 'no alerts' rather than 'backend unreachable'."

**Statement**: `Alerts.tsx:15-17` dispatches `fetchAlertsTotals` ONCE on mount (empty `useEffect` deps array). The thunk hits `GET /api/alerts/totals` which runs `Mono.zipDelayError(allCount, countByOwner, countDependent)` — three COUNT queries on the alerts table (per `AlertServiceImpl.java:90-109`). The result populates `state.alerts.totals.total`, `myTotal`, `dependentTotal` — three numeric badges rendered next to the All / My / Dependents tab labels.

These badges are NEVER REFRESHED until the user navigates away from `/alerts` and back. Specifically:
- Resolving an alert (PUT `/api/alerts/{id}/status`) does NOT trigger a totals refresh.
- Switching tabs (which clears `state.alerts.items = []` per ADR-CANDIDATE-245) does NOT trigger a totals refresh.
- New alerts created by the backend (e.g., notifications fan-out, alert-housekeeping job) are not reflected.
- The Resolve button at AlertItem.tsx:159-166 (per REFACTOR-706) dispatches `updateAlertStatus` which updates `state.alerts.items` but NOT `state.alerts.totals`.

**Operator-visible impact**:
- User opens `/alerts` → sees "All: 47" badge.
- User resolves 5 alerts → list shows 42 OPEN items (the items array updates).
- Badge still says "All: 47" — discrepancy with the visible list.
- User refreshes → badge says "All: 42" (now accurate).

The drift is COSMETIC (badge stale by N where N = #resolved in current session) but ERODES TRUST in the badge as a count signal. An operator trying to "burn down the alert queue" sees the badge stay at 47 despite their work and may think the platform is buggy.

**Additional failure mode**: if `fetchAlertsTotals` fails (network error / 403 / backend offline), the three tab badges fall back to `?? 0` (AlertsTabs.tsx:23,28,34) — all three tabs show "0" with no visible failure indicator. The operator sees "All: 0 / My: 0 / Dependents: 0" and may interpret as "no alerts" rather than "backend unreachable".

**Evidence**:
- `Alerts.tsx:15-17` — `useEffect(() => { dispatch(fetchAlertsTotals()); }, [])` with empty deps
- `alerts.thunks.ts:27-31` — `fetchAlertsTotals` thunk wrapping `GET /api/alerts/totals`
- `AlertServiceImpl.java:90-109` — `getAlertTotals` body with the 3-COUNT `Mono.zipDelayError`
- `AlertsTabs.tsx:23,28,34` — `value ?? 0` fallback rendering for each tab badge
- `alerts.thunks.ts:78-88` — `changeAlertStatus` thunk updates `state.alerts.items` but does NOT dispatch a fresh `fetchAlertsTotals`
- contrast: no `invalidateTotals` reducer; no thunk chains the totals-refetch after a status change

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-097 (one-shot mount fetch with no refresh cadence — Redux as SPA-session cache for slowly-changing list endpoints) is the architectural anchor: most list-shaped data is fetched once and trusted for the SPA session. But the Alerts totals are NOT slowly-changing — every Resolve action in the SPA INVALIDATES the count. The mismatch between the SPA-session-cache stance and the actual change rate is the structural cause.

**Proposed remedy**: Three options, in increasing scope:

1. **LOWEST cost — invalidate after Resolve**:
   - After successful `updateAlertStatus.fulfilled`, dispatch `fetchAlertsTotals` to refresh
   - Add to `alerts.slice.ts` extraReducers (alongside the `updateAlerts` cases)
   - Effort: small; 5-line change

2. **MEDIUM cost — periodic refresh**:
   - Add a 30-second polling interval at the Alerts page mount (`useEffect` with cleanup) to re-dispatch `fetchAlertsTotals`
   - Trade-off: more backend traffic; doesn't solve the immediate-refresh-after-resolve UX issue
   - Effort: small-medium

3. **HIGHEST cost — server-side push (SSE / WebSocket)**:
   - Subscribe to a `/api/alerts/totals/events` SSE stream
   - Backend pushes totals on every alert state change
   - Trade-off: requires SSE infrastructure; significant backend change
   - Effort: high

**Recommended**: Option 1 for immediate fix. Option 2 as enhancement to cover backend-side alert creations (housekeeping, notifications fan-out).

**Severity rationale**: MEDIUM — UX stale-data; trust-impact on the badge count. Severity is bounded by:
- The drift is RECOVERABLE (refresh fixes it).
- The drift direction is BENIGN (badge OVERSTATES the count; the operator sees more work pending than reality, not less).
- The visible list (items array) is correct; only the badge is stale.

Not LOW because the badge is a primary navigation signal — operators look at "All: N" to decide which tab to visit; a stale count erodes the signal-to-noise ratio.

**Suggested backlog grouping**: `UX-NNN Alerts clarity sprint` — pair with REFACTOR-705, REFACTOR-706, REFACTOR-709. Together they close the class of "Alerts page is confusing" UX defects.

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-097 (one-shot mount fetch — Alerts totals fit the cache stance but the change rate doesn't match the design assumption); ADR-CANDIDATE-245 NEW this batch (multi-tab Redux single-slot — totals are slice-level state, not tab-level; the architecture supports a single invalidation point).
- SUPERSEDES: none.
- CONFLICTS: none.

---
