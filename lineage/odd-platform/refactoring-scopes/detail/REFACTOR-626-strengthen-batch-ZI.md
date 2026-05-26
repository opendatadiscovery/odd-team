## STRENGTHENS — Batch ZI (2026-05-26 — relationships UI route surfaces the OPERATOR-FACING entry point + the live doc silence)

The relationships UI route sidecar provides the UI-side primary-source confirmation of the zero-authz relationship catalog exposure. Where REFACTOR-626 originally pinned the gap at the backend (controller / SecurityRules / service / repository — four layers all open), batch ZI adds the FIFTH layer: the UI route mount at `DataModellingRoutes.tsx:40` carries no `WithPermissionsProvider` wrapper — the unguarded chain is now visible end-to-end from the browser URL to the SQL.

**New surfaced_by entries**:

- `odd-platform__ts__routes__route__relationships.md:bugs_limitations_corner_cases[1]` (MEDIUM) — "Zero-authz exposure of the relationship catalog to every authenticated user: the route at `DataModellingRoutes.tsx:40` is unwrapped (no `WithPermissionsProvider`); the backend at ZE (`RelationshipController`) has no @PreAuthorize, no SECURITY_RULES match for `/api/relationships/**`, no service check, no owner-scoping. Under `LOGIN_FORM | OAUTH2 | LDAP` every authenticated user sees the entire relationship catalog; under `DISABLED` every caller able to reach the application port sees it. This is consistent with the read-collaborative intent (per ZH sidecar `implicit_adrs`), but the absence is undocumented — the operator deploying ODD with RBAC expectations from the `/configuration-and-deployment/enable-security/authorization` doc has no signal that Relationships are exempt."

- `odd-platform__ts__routes__route__relationships.md:docs_link_semantic.doc_drift_findings[3]` (LOW) — "Doc is silent on visibility scoping for Relationships — neither the pillar page nor the per-feature page mentions who can VIEW relationships. The code has no @PreAuthorize, no SECURITY_RULES match, no owner scoping (per ZE sidecar). This is consistent (silent on both sides) but the absence is operator-relevant: a future operator deploying ODD assumes their relationship catalog is gated based on the platform's overall RBAC story and is wrong. Route as a doc-gap-finder follow-up rather than a hard drift."

**What this strengthening adds**: prior coverage was backend-side only. Batch ZI adds:

1. **The UI route mount is the entry point operators TYPE** — the literal `/data-modelling/relationships` URL is the operator-facing manifestation of the zero-authz chain. An operator deploying ODD and exploring the URL space finds Relationships from the in-page Data Modelling sidebar tab and types the URL into the address bar. There is no UI signal that the page is read-collaborative; the operator's mental model (carried in from the live `/configuration-and-deployment/enable-security/authorization` doc) is that ODD has an RBAC system and pages are gated.

2. **The UI route IS the correct shape per ADR-229's negative-control** — for a read-only collaborative endpoint, the route SHOULD omit `WithPermissionsProvider` rather than mislead with a Provider that doesn't gate. The relationships route correctly omits. Contrast: the queryExamples sub-route at `DataModellingRoutes.tsx:19-25, 31-37` IS wrapped in a misleading Provider (per REFACTOR-668). The relationships pattern is the right architectural shape but the doc-side silence is the operator-actionable failure mode.

3. **The live doc silence is now a tracked DOC-NNN-style follow-up** — WebFetched both `/features/data-modelling/relationships` and the pillar page `/features/data-modelling`. Neither mentions visibility. Both verified 2026-05-26 status 200. The doc-side fix is required regardless of whether the maintainer chooses the DOC-DISCLOSE or STRUCTURAL remedy at REFACTOR-626.

**Triangulation count after ZI**: 4 sidecars (was 3 — RelationshipController class + the relationships-method sidecars; ZI adds the UI route module + the live-doc-fetch confirmation).

**Severity unchanged**: HIGH for the cross-tenant exposure; LOW additionally at the UI layer (the UI does the right thing structurally; only the doc absence is the UI-side gap).

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-229 (two-tier primitive — the relationships route is the negative-control / correct example); REFACTOR-668 (route-mount Provider misleading — the relationships route is the contrast case).
- SUPERSEDES: none.
- CONFLICTS: none.

---
