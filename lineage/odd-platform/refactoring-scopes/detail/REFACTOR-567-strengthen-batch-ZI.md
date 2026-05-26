## STRENGTHENS — Batch ZI (2026-05-26 — activity UI route surfaces the operator-facing label + the live doc reinforces the wrong promise)

The activity UI route sidecar surfaces the SAME `userIds` axis-mismatch defect at the LSN-020-tracked drift category, this time at the UI Filters component layer where the operator first encounters the misleading label. Combined with the live doc page's "performed by" framing, the drift now spans three layers: SQL (REFACTOR-567 original), UI label (`t('User')` on the Filters panel), and live doc copy.

**New surfaced_by entry**:

- `odd-platform__ts__routes__route__activity.md:bugs_limitations_corner_cases[4]` (HIGH) — "Backend `userIds` filter does not honour the parameter name (LSN-020) — bound to `USER_OWNER_MAPPING.OWNER_ID.in(userIds)` not to `activity.created_by`. The UI Filters panel (`components/Activity/Filters/Filters.tsx:93-98`) labels the filter `t('User')` — and the live doc reinforces the wrong promise — but the SQL filters by owner-of-entity. The label is operator-misleading; this is the route's most material LSN-020 exposure point."

- `odd-platform__ts__routes__route__activity.md:docs_link_semantic.doc_drift_findings[0]` (HIGH) — "The live doc page's User filter description ('show events **performed by** one or more selected users') promises filtering by who-performed-the-action, but the Filters component (`components/Activity/Filters/Filters.tsx:93-98`) binds `userIds` to a query parameter that — per the existing `ActivityController.getActivity` sidecar and LSN-020 — translates at the SQL layer to `USER_OWNER_MAPPING.OWNER_ID.in(userIds)` (i.e. filters by owner-of-entity via the user-owner mapping). The doc copy reinforces the wrong promise: a user without an owner mapping returns empty; reassigning a user-owner association retroactively rewrites who looks responsible for past actions. This is the same drift category as LSN-020, surfaced now at the UI layer where the operator first encounters the misleading label."

**What this strengthening adds**: prior coverage was SQL-layer + service-layer. Batch ZI adds the THREE outer surface layers: (1) the UI Filters component label `t('User')` directly facing the operator; (2) the live doc's verbatim phrasing `'show events performed by one or more selected users'` confirming the operator-facing promise; (3) the UI's defaulting behaviour (the userIds filter is wide-open multi-select with no validation, exposing the misleading promise the moment the operator opens the panel).

**Compounded operator impact**: a security/compliance reviewer following the live doc page → opening the Activity panel → selecting an insider-suspect user from the User filter → getting rows showing activity ON ENTITIES the suspect owns (rather than activity PERFORMED BY the suspect) is the canonical broken workflow. The reviewer:
- Does not see what the suspect actually did (`activity.created_by` is never filtered).
- Does see what was changed on entities tied to the suspect via user-owner mapping — which could be a different user's actions if multiple users share an owner.
- Cannot tell from the doc page that the result is not what was promised.

The drift is operator-facing across all three layers. The fix span widens from "rename the SQL column / add a parallel filter" to "rename SQL + relabel UI + rewrite doc copy." The maintainer triaging REFACTOR-567 now has the full surface area.

**Triangulation count after ZI**: 4 sidecars (was 3 — ReactiveActivityRepositoryImpl + ActivityServiceImpl + ActivityController.getActivity; ZI adds the UI route module + the live doc fetch).

**Severity unchanged**: MEDIUM. The cross-layer corroboration tightens the impact framing (the drift is operator-visible across UI label + doc copy + SQL) but does not change the architectural priority — the fix remains a labelling / parallel-filter remedy, not a security-hardening one.

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-053 (audit-trail exposure — the userIds label miss is in the same activity-feature audit-misleading family); ADR-CANDIDATE-022 (View-modes for activity streams).
- SUPERSEDES: none.
- CONFLICTS: none.

---
