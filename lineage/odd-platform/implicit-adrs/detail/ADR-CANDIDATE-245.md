## ADR-CANDIDATE-245 — Multi-tab list features (Alerts) share ONE Redux state slot across All / My / Dependents tabs; tab-switch dispatches an explicit `changeFilter` action that CLEARS `state.{feature}.items = []` BEFORE the new tab's first-page fetch. The decision is single-slot-with-explicit-clear, not per-tab-slot

**Severity**: MEDIUM
**Classification**: promote
**Pillars affected**: [P-05 Alerts] — primary canonical instance; the convention's reach is currently 1 pillar but the decision is structural for any future multi-tab list pillar
**Batch minted**: ZL (2026-05-26)

**Support count**: 1 sidecar primary-source (Alerts.tsx); the pattern is internally consistent across 3 thunks (fetchAllAlertList / fetchMyAlertList / fetchMyDependentsAlertList) all writing into the SAME `state.alerts.items` Redux slot via a SHARED `updateAlerts` reducer.

**Surfaced by**:
- `odd-platform__ts__react-component__component__Alerts.md:implicit_adrs[1]` (HIGH) — "All three list-fetch thunks (fetchAllAlertList, fetchMyAlertList, fetchMyDependentsAlertList) write into the same Redux slot via a shared `updateAlerts` reducer." — evidence: alerts.slice.ts:42-49 (`builder.addCase(...updateAlerts)` ×3) — intent_anchor: "shared reducer function `updateAlerts` reused for three thunk types" — confidence: HIGH
- `odd-platform__ts__react-component__component__Alerts.md:implicit_adrs[2]` (HIGH) — "Tab-switch performs an explicit clear of items before the new fetch — the navigation event drives state reset, not the thunk." — evidence: AlertsTabs.tsx:44-46 (`changeAlertsFilterAction` dispatched on handleTabChange) + alerts.slice.ts:38-40 (`changeAlertsFilterAction: state => { state.alerts.items = []; }`) — intent_anchor: "explicit named action `changeAlertsFilterAction` whose only effect is to reset items" — confidence: HIGH
- `odd-platform__ts__react-component__component__Alerts.md:concepts.invariants[1]` (HIGH) — "All three tabs share `state.alerts.items` — tab switch always clears items via `changeAlertsFilterAction`."

**Decision statement**: The Alerts pillar implements its three-tab list surface (All / My Objects / Dependents) as a **SINGLE Redux state slot with explicit tab-switch clearing**, NOT as three separate per-tab slots. The architecture has four observable structural commitments:

1. **One slice slot per multi-tab feature** — `state.alerts.items: Alert[]` (alerts.slice.ts:14) is the single backing store for every tab's list view. Three fetch thunks (`fetchAllAlertList`, `fetchMyAlertList`, `fetchMyDependentsAlertList`) all dispatch into the SAME `updateAlerts` reducer (alerts.slice.ts:42-49) which either REPLACES (page=1) or APPENDS (page>1) into the same `items` array.

2. **Tab-switch IS a state-reset event, not a fetch event** — `AlertsTabs.tsx:44-46` dispatches `changeAlertsFilterAction` on every tab click; the reducer (alerts.slice.ts:38-40) clears `state.alerts.items = []` BEFORE the new tab's fetch fires. The architecture deliberately makes navigation an explicit state transition, not a side-effect of the thunk.

3. **No per-tab cache** — the prior tab's items are DROPPED on switch, not stored. The cost: every tab switch requires a fresh page-1 fetch. The benefit: no stale-on-return rendering — re-entering a tab is identical to first-visit; the state machine has fewer corners; offset/cursor state is naturally reset.

4. **Shared infinite-scroll cursor** — `state.alerts.pageInfo.page` is also shared across the three tabs. Tab switch resets the page counter to 1 implicitly (the next fetch uses `page=1`); the prior tab's scroll-position is gone.

The intent: simplify the state machine. Three-tabs-three-slots would require either (a) per-tab pageInfo + items + counters with N×3 reducer cases, or (b) a `Record<tabKey, AlertsState>` shape. The single-slot-with-clear approach has 1× reducer cases + simpler selectors + identical TypeScript types. The trade-off explicitly accepted: lose the prior tab's scroll position + re-fetch on every switch.

**Wisdom test (3-question)**:
1. *Intentional?* YES — the `changeAlertsFilterAction` is EXPLICITLY NAMED for the state-reset purpose; it has no other effect (the reducer body is `state.alerts.items = []`). The shared-reducer convention is also explicit — three `addCase` registrations point to ONE `updateAlerts` handler. The single-slot-vs-per-tab decision was made consciously; the alternative would require multiplying the reducer surface.
2. *Structural impact?* YES — defines the Redux shape for the Alerts pillar; defines the operator UX (no scroll-restoration across tabs); defines the navigation pattern (tab-click = clear + refetch, not just navigation). A future maintainer adding a 4th Alerts tab inherits this shape automatically; choosing per-tab-slots would require slice-level refactoring.
3. *Refactoring or structural?* STRUCTURAL — switching from single-slot-with-clear to per-tab-slots is a slice-shape change that touches every selector + every component reading the slice + the reducer signature. The decision is upstream of every Alerts-page render.
→ ADR.

**Evidence**:
- `alerts.slice.ts:14` — `items: []` initialised in state
- `alerts.slice.ts:25-32` — `updateAlerts` reducer with REPLACE-vs-APPEND logic based on `pageInfo.page > 1`
- `alerts.slice.ts:37-41` — `changeAlertsFilterAction` reducer (state-clear only)
- `alerts.slice.ts:42-49` — three `builder.addCase(...).fulfilled` registrations all pointing to `updateAlerts`
- `AlertsTabs.tsx:44-46` — `handleTabChange` dispatches `changeAlertsFilterAction()` on every tab click
- `AlertsList.tsx:79-81` — child component dispatches `fetchAlerts` (the bound thunk) on mount of each tab-route
- intent_anchor: the explicit named action `changeAlertsFilterAction` whose ONLY effect is `state.alerts.items = []`; the architectural commitment is the EXPLICIT NAMING + the SHARED REDUCER.

**Existing ADRs / composition**:
- COMPOSES WITH **ADR-CANDIDATE-097** (one-shot mount fetch with no refresh cadence — Redux as SPA-session cache) — Alerts shares the same Redux-as-cache stance but adds the tab-switch-clear semantics on top.
- COMPOSES WITH **ADR-CANDIDATE-230** (query-string vs path-segment view-mode dispatch) — Alerts uses path-segment view modes (`/alerts/all` / `/alerts/my` / `/alerts/dependents`); this ADR explains WHY the path-segment choice is compatible with a single Redux slot (each route re-mounts the AlertsList child which re-dispatches the bound thunk after the clear).
- COMPOSES WITH **ADR-CANDIDATE-227** (bare base URL redirects to canonical first tab) — `/alerts` → `/alerts/all` redirect ensures the entry-point tab is well-defined; the single-slot-with-clear design assumes a canonical landing tab.
- CONTRASTS WITH **the per-tab-slot pattern** used by some sibling features (Activity uses query-string `?type=` with a SINGLE thunk that branches on `type`; Search uses server-side session UUID with per-session state) — three distinct shapes for three distinct view-mode dispatch conventions.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-NNN (MEDIUM) — Race: simultaneous in-flight `page=2` from prior tab + new tab's `page=1` can both land into the slice; stale-response wins per arrival order. The race window is bounded by the redux thunk dispatch ordering, but the design has no AbortController to cancel the prior in-flight fetch on tab-switch.
- REFACTOR-NNN (LOW) — Tab badges (totals.total, myTotal, dependentTotal) are fetched ONCE on Alerts mount (Alerts.tsx:15-17, empty deps) and never refresh after a Resolve action. The single-slot-with-clear architecture doesn't invalidate the totals on item-state change. (Separately tracked as REFACTOR-707.)

**Proposed action**: Promote to `adrs/drafts/multi-tab-list-single-redux-slot-with-tab-switch-clear.md`. Document:
- The single-slot decision (state.{feature}.items as one array; no per-tab partition).
- The shared-reducer convention (one `update{Feature}` handler registered against N thunks).
- The explicit tab-switch state-reset action (`change{Feature}FilterAction` — same shape across any future multi-tab feature).
- The trade-offs (lose scroll-restoration; re-fetch on switch).
- The pattern's compatibility with path-segment view modes (ADR-CANDIDATE-230) and the bare-base-redirect convention (ADR-CANDIDATE-227).
- The maintenance obligation: every new multi-tab list feature follows the same single-slot-with-clear pattern OR documents the deviation.
- The naming convention: the state-reset action is named `change{Feature}FilterAction` — preserve the semantic across the codebase even if "filter" is a misnomer (per the name-vs-behaviour finding in the Alerts sidecar, the reducer doesn't apply a filter — it just clears items; the name persists for backwards consistency).

**Severity rationale**: MEDIUM — pattern-shaping decision for multi-tab list features; currently 1 pillar (Alerts) but the architectural commitment is upstream of any future multi-tab list. The single-slot vs per-tab-slot choice is observable and structural; renaming or restructuring would touch every Alerts page render.

**Suggested backlog grouping**: `UI architecture codification` — pair with ADR-CANDIDATE-097 (Redux as SPA-session cache) and ADR-CANDIDATE-230 (URL-mode dispatch) which together define the multi-tab list state model.

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-097 (Redux session cache); ADR-CANDIDATE-227 (bare-base redirect — Alerts' `/alerts` → `/alerts/all` matches the canonical-first-tab pattern); ADR-CANDIDATE-230 (URL-mode dispatch — Alerts uses path-segment).
- SUPERSEDES: none.
- CONFLICTS: none.
- BACK-LINKS: Alerts.tsx sidecar receives `related_implicit_adrs: [ADR-CANDIDATE-245]` in next refresh.

---
