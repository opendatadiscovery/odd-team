---
doc_gap_id: DOC-GAP-317
severity: MEDIUM
category: drift (UI stale-state on the Alerts page; live doc silent on the badge refresh contract)
batch: ZL
generated_at: "2026-05-26T00:00:00Z"
generated_at_commit: 4ec2b20
prompt_version: "doc-gap-finder/0.1.0"
maintainer_curated: false
related_pillar_features:
  - "P-08"           # Alerting
related_features:
  - F-007            # Alerting Integration
related_doc_gaps:
  - DOC-GAP-312      # Alerts All-tab OPEN-only Category B drift (sibling Alerts UI finding)
  - DOC-GAP-002      # Alerting feature page audience drift
  - DOC-GAP-109      # Alert listByOwner platform-wide total drift
related_retrospectives:
  - LSN-020
---

## DOC-GAP-317 — Alerts page tab badge totals (`totals.totalCount` / `myObjectsCount` / `dependentCount`) are fetched ONCE on mount via `Alerts.tsx:15-17` `useEffect([])` (empty dependency array); they DO NOT refresh after a Resolve action, after navigating tabs, or after the backend creates new alerts; an operator who resolves alerts watches the badge stay stale until a full page reload — live doc page describes the three tabs and their semantics but is silent on the badge-refresh contract; combined with the tab-clear behaviour (every tab switch CLEARS `state.alerts.items` then re-fetches), the operator's mental model "the badges reflect the current state of my alerts" is wrong

**Severity**: MEDIUM
**Category**: drift (UI stale-state; doc-silent)

### Surfaced by

- `odd-platform__ts__react-component__component__Alerts.md:bugs_limitations_corner_cases.[2]` (MEDIUM per sidecar — "Tab badge totals (totals, myTotal, dependentTotal) are fetched ONCE on mount (Alerts.tsx:15-17, `useEffect([])` no deps) — they do not refresh after a Resolve action, after navigating tabs, or after the backend creates new alerts. An operator who resolves alerts watches the badge stay stale until full reload.")
- `odd-platform__ts__react-component__component__Alerts.md:performance.known_performance_gaps.[totals-stale]` (LOW per sidecar — "Totals are fetched once on Alerts mount and never refreshed — operator who resolves an alert sees the badge stay stale (off-by-one) until they leave and re-enter /alerts. Not a correctness bug, but an obvious UX gap.")
- `odd-platform__ts__react-component__component__Alerts.md:bugs_limitations_corner_cases.[6]` (MEDIUM per sidecar — "Tab list rendering when API totals are absent: AlertsTabs.tsx:23,28,34 fall back to `?? 0` — when fetchAlertsTotals fails (network error / 403) all three tabs show '0' with no visible failure indicator.")
- `odd-platform__ts__react-component__component__Alerts.md:stress_findings.resource_boundaries.[concurrency].cache-staleness` ("No cache. Each tab visit re-fetches; totals fetched once on mount (Alerts.tsx:15-17) and never invalidated — that IS the staleness gap. After Resolve, totals.total still reflects pre-Resolve count until full page reload.")

### Evidence

- **Code primary source — the bootstrap**: `odd-platform-ui/src/components/Alerts/Alerts.tsx:15-17` (per sidecar primary source): `useEffect(() => { dispatch(fetchAlertsTotals()); }, []);` — empty deps array. The thunk fires ONCE per component mount.
- **The Resolve action does NOT invalidate the totals**: per sidecar `downstream_side_effects[Resolve-click]`: "Resolve/Reopen click dispatches GET fetchResourcePermissions (permission probe) + (conditional) PUT /api/alerts/{id}/status (changeAlertStatus). Two API calls per click." Neither call dispatches `fetchAlertsTotals` post-success.
- **The tab-switch behaviour compounds the staleness**: per sidecar `concepts.invariants` + `implicit_adrs[tab-clear]`: every tab switch dispatches `changeAlertsFilterAction` which clears `state.alerts.items`. The list re-fetches from page=1. But the TOTALS are SEPARATE Redux state and are NOT refetched. An operator clicks resolve on an alert → the list refreshes (because the backend's STATUS_UPDATED triggers a state change visible on the next fetch) → but the BADGE next to the All tab still shows the pre-resolve count.
- **The fail-silently mode**: `AlertsTabs.tsx:23,28,34` (per sidecar `bugs_limitations_corner_cases[6]`) — the badges render `totals ?? 0`. When `fetchAlertsTotals` fails (network error, 403 under non-DISABLED auth with no session, transient backend failure), the badges show "0" with no visible failure indicator. The operator interprets "0 alerts" as "no alerts exist" rather than "backend unreachable."
- **The cumulative-totals on-mount design**: `AlertServiceImpl.java:90-109` per sidecar `performance.hot_paths.totals`: "Tab badge totals (fetchAlertsTotals) runs `Mono.zipDelayError(allCount, countByOwner, countDependent)` — three COUNT queries on first page mount. countDependent walks a recursive lineage CTE (ReactiveAlertRepositoryImpl.java:282-294) — proportional to lineage-graph depth for the current user's owned oddrns." Refresh-on-every-action would be expensive; the once-on-mount design is operator-trading-cost-for-stale-state.
- **Live doc primary source (WebFetched 2026-05-26 status 200 via Alerts.tsx sidecar inferred_docs)**: `https://docs.opendatadiscovery.org/features/active-platform-features/alerting` — verbatim quoted: "Every open and resolved alert across the whole platform." (All tab — see DOC-GAP-312 for the OPEN-only drift) + "Alerts raised on data entities where the signed-in user is a registered owner." (My Objects) + "Alerts raised on data entities that are downstream of entities the signed-in user owns (via lineage)." (Dependents). The page does NOT mention:
  - The badge counts are fetched once on mount
  - The badge counts do not refresh after a Resolve action
  - The badge counts may show "0" on backend failure (silently, no error indicator)
  - The cost-vs-staleness tradeoff (3 COUNT queries + lineage CTE traversal per refresh)
- **Operator-impact narrative (alert triage workflow)**: a steward opens the Alerts page in the morning. Badge shows "All: 47, My: 12, Dependents: 5." They start resolving alerts in the All tab. After resolving 10 alerts, the list visibly shrinks (re-fetched), but the badge still shows "All: 47." Confused, they refresh the page. Now "All: 37." They resolve 5 more. The list shrinks. Badge still shows 37. Refresh again. Badge shows 32. The steward concludes the badge is "unreliable" and develops a habit of refreshing the page constantly during triage. Productivity drops; trust in the platform erodes.

### Proposed doc action

**TWO-PART action — code-side primary (small refresh fix) + doc-side companion.**

1. **Code-side PRIMARY (file `/log-issue odd-platform`)** — three options ordered by scope:

   - **Minimum (refresh on resolve)**: in the Resolve/Reopen click handler at `AlertItem.tsx:55-70` (per sidecar `downstream_side_effects[Resolve-click]`), dispatch `fetchAlertsTotals()` after the `changeAlertStatus` thunk fulfills. One-line addition. Refreshes the badges on every operator-resolve action. Cost: 3 COUNT queries per resolve (acceptable for the typical interactive cadence).

   - **Medium (refresh on tab-switch + on visibility change)**: extend `AlertsTabs.tsx:44-46` (tab-switch dispatch) to also dispatch `fetchAlertsTotals()`. Add a `document.visibilitychange` listener at `Alerts.tsx` to refetch when the browser tab regains focus. Operator-friendly cadence.

   - **Full (debounced refresh on every state-changing action + WebSocket push)**: add a WebSocket subscription from the platform to the UI for alert-state-change events (the platform already has WebSocket infrastructure for DataCollaboration — F-006). When any alert transitions OPEN→RESOLVED, push to subscribed clients; clients invalidate the totals + re-fetch. Real-time correctness; bigger architectural change.

   **Recommended path**: Minimum option (refresh on resolve) lands first; Medium option follows in next release.

2. **Doc-side COMPANION — extend `documentation/docs/features/active-platform-features/alerting.md`**:

   > **Tab badge counts — refresh behaviour**: the count next to each tab (All / My Objects / Dependents) reflects the total alert population AT THE TIME THE PAGE LOADED. The badges DO NOT refresh after a Resolve action, after navigating tabs, or after new alerts arrive at the backend. To see updated counts, reload the page (browser refresh).
   >
   > **If badges show "0"**: under transient backend failure (network error, 503), the badges silently fall back to "0" with no visible error indicator. If you see "0" alerts unexpectedly, verify the backend is reachable (check `/actuator/health` if exposed, or reload the page).
   >
   > **Why not auto-refresh**: each badge refresh issues 3 COUNT queries (one per tab) + a lineage-CTE traversal for the Dependents count; over-frequent refresh on a high-volume platform would consume database resources. The current design trades real-time correctness for query-cost efficiency. Tracked at odd-platform issue #NNNN for refresh-on-resolve.

### Cross-references

- **DOC-GAP-312** (Alerts All-tab OPEN-only Category B drift) — direct sibling: both findings on the same Alerts.tsx UI sidecar; combined the two findings document the structural gaps in the global Alerts page badge + filter semantics.
- **DOC-GAP-002** (Alerting feature page audience drift) — sibling drift on the SAME page; THIS finding adds the BADGE-REFRESH dimension to the audience-drift + cross-owner-visibility dimensions.
- **DOC-GAP-109** (Alert listByOwner empty-result total uses platform-wide count) — adjacent UI badge correctness gap: the My-Objects badge counts the entire platform (not the owner's scope) when the owner has zero alerts, which compounds with the once-on-mount staleness here.
- **F-007** (Alerting Integration feature flow) — THIS finding extends F-007's UI behavior documentation.
- **LSN-020** (NAME-vs-IMPLEMENTATION drift class) — adjacent: the badge promises "live count" intuitively, implementation provides "count at load time."

### Severity rationale

MEDIUM. The drift is operator-noticeable and erodes trust but is NOT data-corrupting. Severity classification:

1. **Operator-visible during the canonical alert-triage workflow**: every steward resolving alerts experiences the stale badge. The frequency is the highest among the Alerts findings (every resolve action surfaces the gap).
2. **The workaround is well-known (reload the page)** but operator-trust erodes over the workflow.
3. **The fix is one line of code (refresh on resolve)**: cost-benefit is asymmetric — bounded fix, deterministic operator-experience improvement.
4. **The doc-product gap compounds the bug**: operators reading the docs cannot anticipate the behaviour; they discover it experientially during triage.
5. **The "0 on backend failure" silent fallback is a separate small dimension**: operators interpret "0" as "no alerts exist" rather than "backend unreachable" — minor but real.

Severity is NOT HIGH because: (a) no data is lost or corrupted; (b) the workaround exists and is operator-discoverable; (c) the consequence is trust erosion, not operational failure. Severity is NOT LOW because: (a) the frequency is high (every resolve action surfaces the gap); (b) the fix is bounded; (c) the cumulative trust-damage on the canonical alert-triage surface is structurally significant.

### Last verified

- 2026-05-26 — Alerts.tsx UI-component sidecar PRIMARY SOURCE at substrate commit `4ec2b20`; live WebFetch `https://docs.opendatadiscovery.org/features/active-platform-features/alerting` status **200** (badge-refresh behaviour confirmed absent from the page per the Alerts.tsx sidecar `inferred_docs[0]` + my cross-read).
