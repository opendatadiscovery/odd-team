## REFACTOR-705 — Alerts "All" tab claims "open AND resolved" alerts per the live docs, but the SQL hard-filters `ALERT.STATUS.eq(OPEN)` only — RESOLVED + RESOLVED_AUTOMATICALLY alerts are invisible in every global tab (Category B drift: name vs implementation)

**Severity**: HIGH
**Category**: misleading-api / drift-name-vs-behaviour
**Batch**: ZL (2026-05-26)
**Pillars affected**: [P-05 Alerts]

**Surfaced by**:
- `odd-platform__ts__react-component__component__Alerts.md:bugs_limitations_corner_cases[0]` (HIGH) — "All-tab name vs behaviour mismatch: docs say 'open and resolved'; backend SQL filters STATUS=OPEN only (ReactiveAlertRepositoryImpl.java:145, 166, 230). RESOLVED and RESOLVED_AUTOMATICALLY alerts are invisible in every global tab." — evidence: ReactiveAlertRepositoryImpl.java:142-145 (listAllWithStatusOpen), 160-179 (listByOwner), 217-243 (listDependentObjectsAlerts) — severity: HIGH
- `odd-platform__ts__react-component__component__Alerts.md:docs_link_semantic.doc_drift_findings[0]` (HIGH) — "DRIFT: docs says All tab shows 'Every open and resolved alert across the whole platform' but ReactiveAlertRepositoryImpl.java:142-145 hard-filters `ALERT.STATUS.eq(OPEN.getCode())`. The list NEVER shows RESOLVED or RESOLVED_AUTOMATICALLY alerts in the global tabs — only on a single data entity's Alerts tab via getAlertsByDataEntityId (no status filter, line 182-199). Operator who follows the docs expects to see resolved alerts and cannot find them; mistakes them for purged."
- `odd-platform__ts__react-component__component__Alerts.md:stress_findings.name_behavior_pairs[1]` (HIGH) — "AlertsTabs labels — 'All', 'My Objects', 'Dependents': 'All' tab shows the full alert population across the platform (per live docs: 'Every open and resolved alert'). Backend getAllAlerts → listAll → listAllWithStatusOpen filters STATUS=OPEN only. ... DRIFT_NAME_VS_BEHAVIOR. ... An operator searching for a resolved alert on the global page cannot find it. They may assume the alert was purged. This is the same Category B failure class as LSN-019 (TagController.listMostPopular)."
- `odd-platform__ts__react-component__component__Alerts.md:stress_findings.request_inputs[1]` (HIGH) — Category F surface confirming the path-segment view-mode `all` translates silently to `all OPEN`; the ALERT.STATUS column is available-but-unused in the WHERE clause (no `status` query parameter on getAllAlerts / getAssociatedUserAlerts / getDependentEntitiesAlerts).

**Statement**: The Alerts page's "All" tab label promises "all alerts" and the live doc page (`https://docs.opendatadiscovery.org/features/active-platform-features/alerting`, WebFetch 2026-05-26, status 200) reinforces "Every open and resolved alert across the whole platform." The backend SQL at `ReactiveAlertRepositoryImpl.java:142-145` (listAllWithStatusOpen) hard-filters `ALERT.STATUS.eq(OPEN.getCode())`; the same `STATUS=OPEN` filter appears at line 166 (listByOwner — My Objects tab) and line 230 (listDependentObjectsAlerts — Dependents tab). All three global tabs return OPEN-only alerts.

The ALERT.STATUS column has three values (OPEN, RESOLVED, RESOLVED_AUTOMATICALLY); the global list-API ignores all values except OPEN. There is NO `status` query parameter on getAllAlerts / getAssociatedUserAlerts / getDependentEntitiesAlerts (`AlertController.java:36-57`).

**Operator-visible impact**: An operator searching the global `/alerts` page for a recently-resolved alert cannot find it. They may assume the alert was purged. The data is NOT lost — RESOLVED alerts can be viewed via a single DataEntity's Alerts tab (`DataEntityController.getDataEntityAlerts` uses `getAlertsByDataEntityId` which has NO status filter — `ReactiveAlertRepositoryImpl.java:182-199`). But there is no global view of resolved alerts; the only way to find a specific resolved alert is to know which DataEntity it belonged to.

**Evidence**:
- `Alerts.tsx + AlertsTabs.tsx:22` — label `t('All')` (the operator-facing name)
- `ReactiveAlertRepositoryImpl.java:142-145` — `listAllWithStatusOpen` body with the STATUS=OPEN filter
- `ReactiveAlertRepositoryImpl.java:160-179` — `listByOwner` with the same STATUS=OPEN filter
- `ReactiveAlertRepositoryImpl.java:217-243` — `listDependentObjectsAlerts` with the same filter
- `ReactiveAlertRepositoryImpl.java:182-199` — `getAlertsByDataEntityId` WITHOUT the filter (the contrast — entity-tab does show all statuses)
- `AlertController.java:36-57` — no `status` query parameter on the global endpoints
- WebFetch `https://docs.opendatadiscovery.org/features/active-platform-features/alerting` (2026-05-26, status 200) — "Every open and resolved alert across the whole platform"

**Existing-ADR-or-implied-prescription**: This is a Category B drift (name vs behaviour) of the same shape as LSN-019 (TagController.listMostPopular returning only top-N by recent activity, not "most popular"). The implicit ADR is the read-collaborative + OPEN-only posture for global views; the drift is between docs/label/parameter-name and implementation. The architectural fix is to ADD the missing functionality OR ALIGN the docs/label to the actual behaviour.

**Proposed remedy**: Three options, in increasing scope:

1. **LOWEST cost — fix the docs and rename labels**:
   - Update `https://docs.opendatadiscovery.org/features/active-platform-features/alerting` to say "Every OPEN alert across the whole platform"
   - Rename the tab from "All" to "All Open" or "Active"
   - Add a doc-side note about the per-entity tab being the way to view resolved alerts
   - Effort: small; backwards-compatible

2. **MEDIUM cost — add a `status` query parameter**:
   - Add `status?: AlertStatus` to the `AlertApi.getAllAlerts` / `getAssociatedUserAlerts` / `getDependentEntitiesAlerts` signatures
   - Plumb through the `where` clause in `ReactiveAlertRepositoryImpl.getCommonConditions` (already exists for facet aggregators; reuse)
   - Default `status=OPEN` for backwards compat
   - UI: add a status filter UI control on the Alerts page
   - Effort: medium; requires UI + API + service + repository changes

3. **HIGHEST cost — split into "All" + "Resolved" tabs (or "All Statuses" view)**:
   - Add a 4th tab "Resolved" (gated by owner-association like My/Dependents)
   - Effort: medium-high; requires UI change + new thunk + new reducer registration; touches the ADR-CANDIDATE-245 single-Redux-slot architecture

**Recommended**: Option 1 + Option 2. Option 1 closes the immediate operator confusion; Option 2 adds the missing functionality without breaking existing clients.

**Severity rationale**: HIGH — the live-docs-vs-implementation drift is operator-misleading; an operator following the docs to find a resolved alert reaches a dead end. The data IS available (per-entity tab), but the global view's silence is misleading. Cross-pillar reach is low (1 pillar — Alerts), but the trust-impact is medium-high (operator follows docs → can't find data → assumes platform broken or data purged).

**Suggested backlog grouping**: `UX-NNN Alerts clarity sprint` — pair with REFACTOR-706 (Resolve button UX leak), REFACTOR-707 (tab badge stale-totals), REFACTOR-709 (no request cancellation on tab-switch). The four together close a class of "the Alerts global page is confusing" UX defects.

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-003 (read-collaborative posture — confirms global views serve unscoped data with no per-status filter); ADR-CANDIDATE-245 NEW this batch (multi-tab Redux single-slot — the architecture choice that informs Option 3); REFACTOR-342 (entity-level `/alerts` has NO status filter parameter — same Category B family on a related endpoint).
- SUPERSEDES: none.
- CONFLICTS: none.

---
