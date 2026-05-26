---
doc_gap_id: DOC-GAP-312
severity: HIGH
category: drift (Category B — live doc actively wrong; SQL hard-filters STATUS=OPEN while live doc says "open AND resolved" for the All tab)
batch: ZL
generated_at: "2026-05-26T00:00:00Z"
generated_at_commit: 4ec2b20
prompt_version: "doc-gap-finder/0.1.0"
maintainer_curated: false
related_pillar_features:
  - "P-08"           # Alerting (audit-trail surface)
related_features:
  - F-007            # Alerting Integration
related_doc_gaps:
  - DOC-GAP-002      # Alerting feature page audience drift (stewards/admins vs any authenticated user) — sibling drift on the SAME page
  - DOC-GAP-026      # AlertManager DTO drops status:resolved — adjacent "resolved alerts not represented" class on a different surface
  - DOC-GAP-024      # OpenAPI tag alert lacks description (related catalog-coverage gap)
  - DOC-GAP-303      # Activity Feed User filter LSN-020 drift — same drift class (live doc actively reinforces wrong promise)
  - DOC-GAP-082      # META — DISABLED-bypasses-RBAC (cross-link: Alerts list is DISABLED-reachable per DOC-GAP-002)
related_retrospectives:
  - LSN-019          # Category B (TagController.listMostPopular Category B drift class — same shape)
  - LSN-020          # NAME-vs-IMPLEMENTATION drift class
  - LSN-001          # operator-trap canonical
  - LSN-002          # operator-trap canonical
---

## DOC-GAP-312 — Alerts "All" tab live doc says verbatim "Every open and resolved alert across the whole platform" — but `ReactiveAlertRepositoryImpl.java:142-145` hard-filters `ALERT.STATUS.eq(OPEN)`; RESOLVED and RESOLVED_AUTOMATICALLY alerts are INVISIBLE on every global tab (All / My Objects / Dependents); the single-data-entity Alerts tab (via `getAlertsByDataEntityId`, NO status filter) is the ONLY surface that surfaces resolved rows — operator searching the global Alerts page for a recently-resolved alert cannot find it; assumes it was purged

**Severity**: HIGH
**Category**: drift (Category B — live doc actively wrong; LSN-019 class)

### Surfaced by

- `odd-platform__ts__react-component__component__Alerts.md:docs_link_semantic.doc_drift_findings.[0]` ("DRIFT: docs says All tab shows 'Every open and resolved alert across the whole platform' but ReactiveAlertRepositoryImpl.java:142-145 hard-filters `ALERT.STATUS.eq(OPEN.getCode())`. The list NEVER shows RESOLVED or RESOLVED_AUTOMATICALLY alerts in the global tabs — only on a single data entity's Alerts tab via getAlertsByDataEntityId (no status filter, line 182-199). Operator who follows the docs expects to see resolved alerts and cannot find them; mistakes them for purged.") **(NEW batch ZL — Alerts.tsx UI-COMPONENT PRIMARY SOURCE)**
- `odd-platform__ts__react-component__component__Alerts.md:bugs_limitations_corner_cases.[0]` (HIGH per sidecar — "All-tab name vs behaviour mismatch: docs say 'open and resolved'; backend SQL filters STATUS=OPEN only (ReactiveAlertRepositoryImpl.java:145, 166, 230). RESOLVED and RESOLVED_AUTOMATICALLY alerts are invisible in every global tab.")
- `odd-platform__ts__react-component__component__Alerts.md:stress_findings.name_behavior_pairs.[1]` (DRIFT_NAME_VS_BEHAVIOR, STATIC-INFERRED, HIGH per sidecar — "Backend getAllAlerts → listAll → listAllWithStatusOpen filters STATUS=OPEN only. Resolved alerts are absent. UI label promises 'All'; UI shows OPEN-only subset.")
- `odd-platform__ts__react-component__component__Alerts.md:stress_findings.request_inputs.[1]` (TRANSLATES_SILENTLY on the tab route segment 'all' — "Live docs (WebFetch 2026-05-26) state the All tab shows 'every open AND resolved alert'. Backend listAllWithStatusOpen filters STATUS=OPEN. So 'all' = 'all OPEN'. ... Operator searches the global Alerts page for a recently-resolved alert; cannot find it; assumes it was purged. May open a support ticket / re-investigate the underlying issue thinking the alert was lost. Resolved alerts CAN still be viewed via a single DataEntity's Alerts tab (DataEntityController.getDataEntityAlerts uses getAlertsByDataEntityId which has NO status filter — ReactiveAlertRepositoryImpl.java:182-199). So the data exists; the UI just won't surface it on /alerts/*.")
- `concepts.yaml:entities[Alert].status[OPEN, RESOLVED, RESOLVED_AUTOMATICALLY]` (the canonical three-state Alert lifecycle; the global tabs trap the operator at OPEN-only)
- LSN-019 — canonical Category B drift class anchor

### Evidence

- **Code primary source — the SQL filter**: `ReactiveAlertRepositoryImpl.java:142-145` (verified via the Alerts UI sidecar primary source quoting the repository): `selectFrom(ALERT).where(ALERT.STATUS.eq(OPEN.getCode()))...` — the OPEN status code is hard-bound at the predicate construction site. The repository's `listAllWithStatusOpen` is the method name; the public `listAll` wrapper just delegates. The `STATUS=OPEN` filter is also applied at `listByOwner` (line 160-179) and at `listDependentObjectsAlerts` (line 217-243) — all three global tabs share the OPEN-only filter.
- **The asymmetric per-entity surface**: `ReactiveAlertRepositoryImpl.java:182-199` (`getAlertsByDataEntityId`) — NO status filter. Resolved + RESOLVED_AUTOMATICALLY alerts ARE surfaced via `GET /api/dataentities/{id}/alerts` (consumed by the per-data-entity Alerts tab). The data exists in the database; only the global Alerts page tabs hide it.
- **Live doc primary source (verbatim — WebFetched 2026-05-26 status 200 via Alerts.tsx sidecar inferred_docs[0] + ZH-batch index references)**: verbatim quoted in the Alerts.tsx sidecar `docs_link_semantic.fetched_excerpts`:
  - "Every open and resolved alert across the whole platform." (All tab description)
  - "Alerts raised on data entities where the signed-in user is a registered owner." (My Objects)
  - "Alerts raised on data entities that are downstream of entities the signed-in user owns (via lineage)." (Dependents)
- **The available-but-unused mechanism**: `ALERT.STATUS` column has three values (`OPEN`, `RESOLVED`, `RESOLVED_AUTOMATICALLY`) per the platform's Alert state-machine. The global list-API endpoints (`AlertController.getAllAlerts` / `getAssociatedUserAlerts` / `getDependentEntitiesAlerts`) DO NOT expose a `status` query parameter — operators CANNOT request resolved alerts via the API. The available-but-unused column shape is canonical LSN-020/LSN-019 family: a column the docs name as "open and resolved" IS in the schema, IS read for display, but is NEVER PARAMETERISED in the list-side API.
- **The single-entity escape hatch makes the global-tab gap more confusing**: an operator who learns "resolved alerts are visible on a single-entity's Alerts tab" still cannot use the global page to find a resolved alert they don't already know the parent entity for. The forensic question "did this alert ever fire on ANY entity?" cannot be answered from the global Alerts page — only from the audit log (no audit log exists per DOC-GAP-220 sibling) or from already-knowing the entity.
- **Cross-reference to LSN-019 (TagController.listMostPopular Category B drift class)**: same shape — the SQL has an additional WHERE that the doc-copy / UI label doesn't acknowledge. LSN-019 was authored to catch exactly this class. The Alerts All-tab drift is the second canonical Category B instance on a load-bearing operator-facing surface.
- **Operator-impact narrative (incident retrospective lookup)**: a security analyst follows a post-incident notification: "alert X was reported by Prometheus at 14:32." They navigate to the global Alerts page expecting to find the row. The All tab shows OPEN-only; the alert was auto-resolved at 14:35 (STATUS_AUTOMATICALLY); it's gone from the All tab. The analyst assumes the alert was purged (or never existed). The actual data is reachable only via `/dataentities/{entity_id}/alerts` if they know which entity to navigate to (which is what they're trying to find). The investigation stalls.

### Proposed doc action

**TWO-PART action — doc-side correction + code-side optional fix.**

1. **Doc-side PRIMARY — rewrite the All tab description in `documentation/docs/features/active-platform-features/alerting.md`** (the live doc page).

   Replace the current verbatim copy ("Every open and resolved alert across the whole platform") with an accurate description:

   > **All** — every alert in `OPEN` status across the whole platform.
   >
   > **Visibility caveat (resolved alerts).** The global Alerts page (All / My Objects / Dependents) filters to `OPEN` only. Alerts in `RESOLVED` or `RESOLVED_AUTOMATICALLY` status do NOT appear in any global tab. To view a resolved alert, navigate to the parent data entity's Alerts tab (`/dataentities/{id}/alerts`) — the per-entity surface has no status filter and surfaces all three states.
   >
   > **What this tab is NOT for.** Historic-alert audit / post-incident lookup of resolved alerts cannot be performed from this page. Use the per-entity Alerts tab, or query the platform's API directly at `/api/dataentities/{data_entity_id}/alerts` if the parent entity is known. For platform-wide audit of historical alert activity, see [F-007 housekeeping](/configuration-and-deployment/odd-platform#housekeeping) — resolved alerts are deleted after `housekeeping.ttl.resolved_alerts_days` (default 30 days; manual resolutions vanish on the next 15-minute cycle per DOC-GAP-062).
   >
   > **What this tab IS for.** Current open-alert triage. Use this tab to see what's currently firing across the platform.

2. **Doc-side COMPANION — extend the per-tab description preamble** with a short note: *"All three tabs (All / My Objects / Dependents) filter to `OPEN` only at the SQL layer. The per-entity Alerts tab is the only surface that includes `RESOLVED` and `RESOLVED_AUTOMATICALLY` rows."*

3. **Code-side OPTIONAL (file `/log-issue odd-platform`)** — three ordered options:

   - **Minimum (add status filter param)**: extend `GET /api/alerts` and the two sibling endpoints with a `status` query parameter (multi-valued, default `OPEN`). Allows callers (including a UI status-filter dropdown) to opt into resolved alerts. Backward-compatible (default behaviour unchanged). The repository predicate becomes `ALERT.STATUS.in(statuses)`.

   - **Medium (UI status-filter dropdown)**: add a status multi-select filter at the AlertsTabs row in the UI (`components/Alerts/AlertsTabs.tsx`). Defaults to `[OPEN]`. Operator can choose to include resolved. Requires the Minimum option to land first. Aligns the operator's mental model with the SQL.

   - **Full (rename tabs OR remove the OPEN filter)**: rename the All tab to "Open" (consistent with UI behaviour) OR remove the OPEN filter entirely (full alert population — but then operators routinely see thousands of stale alerts). Both are breaking changes; not recommended without operator survey.

   **Recommended path**: doc-side correction (Step 1) lands first; Code-side Minimum option (Step 3.a) is a small Spring controller addition + repository predicate refactor; UI dropdown (Step 3.b) follows.

### Cross-references

- **DOC-GAP-002** (Alerting feature page audience drift — sibling drift on the SAME page; THIS finding adds the FILTER-PROMISE-DRIFT dimension to the audience-promise drift already documented)
- **DOC-GAP-026** (AlertManager DTO drops status:resolved — adjacent "resolved alerts not represented" class on the AlertManager INGRESS path; both findings share the "resolved alerts are second-class" narrative)
- **DOC-GAP-024** (OpenAPI tag alert lacks description — adjacent catalog-coverage gap; could host the visibility-scope caveat in the externalDocs.url)
- **DOC-GAP-303** (Activity Feed User filter LSN-020 drift) — direct family match: same drift class (live doc actively reinforces wrong promise); both findings demonstrate Category B drift on canonical operator-facing surfaces
- **DOC-GAP-082 META** (DISABLED-bypasses-RBAC) — cross-link: under DISABLED, the global Alerts page is anonymously reachable AND returns OPEN-only across all alerts; the gap compounds for DISABLED deployments
- **DOC-GAP-220** (Alert audit-log absence — sibling find: no audit log exists, so resolved alerts disappearing from the global view leaves operators with NO recovery path beyond knowing the parent entity)
- **DOC-GAP-149 META** (REV-3 LAYER-0 P-09 pillar-claim vs doc-page coverage drift) — THIS finding's HIGH severity reinforces the cluster: the audit-trail surface is operator-load-bearing and the platform's doc product is silent at the highest-leverage detail
- **LSN-019** (canonical Category B drift class) — THIS finding is the second canonical instance: a SQL filter the doc-copy doesn't acknowledge
- **LSN-020** (NAME-vs-IMPLEMENTATION drift class) — adjacent class
- **LSN-001 / LSN-002** (operator-trap canonical) — compliance reviewer or security analyst following the doc gets silently-wrong results

### Severity rationale

HIGH. The doc surface is ACTIVELY WRONG (Category B) — not silent — and the consequence is operator-blocking on the canonical incident-investigation surface. Severity equals DOC-GAP-303's HIGH on the same kind of drift on the same kind of surface because:

1. **The All tab IS the primary post-incident lookup tool**: every alert triage workflow starts with "show me what alerts fired on the platform recently." The All tab is the natural starting point. The doc's "open and resolved" copy tells the operator they're done; the implementation gives them OPEN-only.
2. **Resolved alerts vanish from the operator's view**: an alert that auto-resolves seconds after firing (the common Prometheus pattern) is GONE from the global page immediately; the operator who's notified via Slack/email + clicks the platform link sees nothing.
3. **The escape hatch (per-entity Alerts tab) requires knowing the parent entity** — exactly what the operator is trying to find. The escape hatch is operationally inert for the primary use case.
4. **The available-but-unused column is the canonical Category B + LSN-020 shape**: `ALERT.STATUS` is in the schema, has three values, the data exists — but the global API surface treats it as a single-valued `OPEN`-only constant. The fix is one new query parameter + one repository predicate refactor.
5. **The single-data-entity escape compounds the trust damage**: the operator who eventually learns "I can find resolved alerts on the entity's tab" reasonably asks "why doesn't the global tab show them?" — the platform's answer is "because of an implementation choice we didn't document." The doc-side correction is the trust-recovery surface.

Severity is NOT CRITICAL because the platform does not silently corrupt data (the data exists; the operator just can't reach it from this surface) and there is no security boundary crossed (per DOC-GAP-002 the data IS exposed broadly already — the Category B drift here is about discoverability, not authorization). The harm is operator-misleading at the audit / incident-investigation / forensic surface; the fix is a doc rewrite + an optional small code change.

### Last verified

- 2026-05-26 — Alerts.tsx UI-component sidecar PRIMARY SOURCE at substrate commit `4ec2b20`; live WebFetch `https://docs.opendatadiscovery.org/features/active-platform-features/alerting` status **200** (verbatim "Every open and resolved alert across the whole platform" copy confirmed in the Alerts.tsx sidecar `inferred_docs[0]` fetched 2026-05-26) + inherited PRIMARY SOURCE via DOC-GAP-002's batch-H AlertController sidecar (`ReactiveAlertRepositoryImpl.java:142-145` SQL bind) + LSN-019 case-law anchor.
