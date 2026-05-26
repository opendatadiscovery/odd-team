## STRENGTHENS — Batch ZI (2026-05-26 — UI Routes 2: activity route sidecar surfaces the UI-side primary source of the audit-trail exposure)

The activity route sidecar provides the UI-side primary-source confirmation of the audit-trail-exposure refactor previously documented at the backend ActivityController level (batch 2026-05-10A).

**New surfaced_by entry**:

- `odd-platform__ts__routes__route__activity.md:security.known_security_gaps[0]` + `bugs_limitations_corner_cases[0]` (HIGH) — "Route `<Route path={activityPath()} element={<Activity />} />` at `App.tsx:65` has NO `WithPermissionsProvider` wrapper — unlike `lookupTablesPath()` at `App.tsx:75-87`. Combined with the backend `ActivityController` having no `@PreAuthorize`, this means the platform-wide audit trail (cross-owner activity, including ownership-change events that reveal user-owner associations) is visible to every authenticated user. Under `auth.type=DISABLED` it is visible to every caller able to reach the application port."

- `odd-platform__ts__routes__route__activity.md:docs_link_semantic.doc_drift_findings[2]` (MEDIUM) — "The doc page contains NO discussion of access control / who can view the global Activity page. The page is reachable by every authenticated user (and by every caller under `auth.type=DISABLED`); an operator reading the doc would not know the global audit trail is platform-wide visible. Surface as documentation gap — DOC-NNN candidate."

**What this strengthening adds**: prior coverage was BACKEND-side (no `@PreAuthorize`, no `SECURITY_RULES` entry, no service-layer check). Batch ZI adds the UI-side primary source — the URL `/activity` is reachable WITHOUT a route-mount permission wrapper, mirroring the backend's open posture. The maintainer triaging REFACTOR-053 now has both ends of the chain confirmed: backend unguarded + UI unguarded.

The UI sidecar also makes the **doc-page silence** newly visible as a tracked gap: the live `https://docs.opendatadiscovery.org/features/active-platform-features/activity-feed` page (WebFetched 2026-05-26, status 200) makes NO statement about who can view the global Activity page. An operator deploying ODD with RBAC expectations from the `/configuration-and-deployment/enable-security/authorization` doc has no signal that the audit trail is intentionally readable by every authenticated user. This is the operator-actionable companion to the REFACTOR-053 backend remedy: even if the maintainer picks Option (c) "confirm read-collaborative posture and document on the live security page", the doc-side fix is REQUIRED — the silence is the visible failure mode.

**Triangulation count after ZI**: 3 sidecars (was 2 — ActivityController + ActivityServiceImpl; ZI adds the UI route module + the live-doc-fetch confirmation).

**Severity unchanged**: HIGH.

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-668 (route-mount Provider misleading — the activity route is the negative-control instance: no Provider, no gate, no audit confusion, but the doc silence IS the operator-facing failure mode); REFACTOR-567 (activity userIds axis-mismatch — the activity UI sidecar surfaces the same LSN-020 drift at the UI Filters component layer + the live doc reinforces the wrong promise).
- SUPERSEDES: none.
- CONFLICTS: none.

---
