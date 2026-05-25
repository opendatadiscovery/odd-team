---
doc_gap_id: DOC-GAP-263
severity: HIGH
category: drift
batch: ZC
generated_at: "2026-05-25T00:00:00Z"
generated_at_commit: ede5d277
prompt_version: "doc-gap-finder/0.1.0"
maintainer_curated: false
related_pillar_features:
  - "P-04:F-002"  # Quality Dashboard — the surfaced surface
related_features:
  - F-022  # Per-dataset DQ test reports — SIBLING P-04 surface; same read-collaborative posture
related_doc_gaps:
  - DOC-GAP-082   # META — DISABLED-bypasses-RBAC primary surface
  - DOC-GAP-149   # P-09 pillar-claim vs doc-page coverage drift (REV-3 LAYER-0)
  - DOC-GAP-198   # DataQualityController class — sibling P-04 doc-drift cluster
related_retrospectives:
  - LSN-001   # operator-trap canonical
  - LSN-002   # operator-trap canonical
  - LSN-018   # coherence-conflict (Rule-6 mechanism)
---

## DOC-GAP-263 — Standalone `/data-quality` Quality Dashboard route has NO client-side permission gate AND every live Data Quality doc page is silent on access control — any authenticated user (under LOGIN_FORM/OAUTH2/LDAP) and any anonymous caller (under `auth.type=DISABLED`) can open `/data-quality` and view the CATALOG-WIDE aggregate quality posture (per-namespace/datasource/owner table-health + monitored counts + per-category test-run breakdowns), but the live `features/data-quality/dashboard` page + `features/data-quality` landing make NO statement about who can see this surface

**Severity**: HIGH
**Category**: drift (operator-facing access-control silence on a catalog-wide aggregate surface)

### Surfaced by

- `odd-platform__ts__react-component__component__DataQuality.md:docs_link_semantic.doc_drift_findings.[0]` — verbatim: *"DOC GAP — access control / 'who can see the dashboard' is silent on every Data Quality doc page. The live `dashboard.md` (WebFetched 2026-05-22 status 200) and the live `data-quality.md` landing (same date, status 200) make NO statement about access control or permissions. The code is unambiguous: the `/data-quality` route is mounted at `App.tsx:73` with NO `WithPermissionsProvider` wrapper (contrast `/lookup-tables` at `App.tsx:75-88`, which IS wrapped), and the 'Data Quality' top-bar tab is rendered unconditionally (`ToolbarTabs.tsx:45-49`)."*
- `odd-platform__ts__react-component__component__DataQuality.md:security.known_security_gaps.[0]` (MEDIUM per sidecar — "If the backend dashboard endpoint also lacks an authorization gate (hypothesis under P-090), the catalog-wide aggregate health of every dataset is visible to every authenticated principal — coherent with the platform's documented read-collaborative posture (the DataQualityController sidecar records the same for the four DQ read endpoints) but undocumented on every live Data Quality doc page.")
- `odd-platform__ts__react-component__component__DataQuality.md:bugs_limitations_corner_cases.[0]` (MEDIUM per sidecar — primary-source contrast between `App.tsx:73` bare route and `App.tsx:75-88` gated sibling)
- `odd-platform__ts__react-component__component__DataQualityContent.md:security.data_exposure` — verbatim: *"Catalog-wide DQ aggregate (per-category run-status counts + tables-health counts + monitored-tables counts) → any authenticated user under LOGIN_FORM/OAUTH2/LDAP via the `/data-quality` page"* + *"Same aggregate → anonymous callers under `auth.type=DISABLED`"*
- `odd-platform__ts__react-component__component__DataQualityContent.md:security.known_security_gaps.[0]` (MEDIUM per sidecar — confirms the absence of any WithPermissionsProvider AND the live-doc silence)
- `odd-platform__ts__react-component__component__DataQualityContent.md:implicit_adrs.[1]` (the read-only owner-unscoped catalog-wide view ADR — consistent with ADR-CANDIDATE-003 read-collaborative posture)

### Evidence

- WebFetch `https://docs.opendatadiscovery.org/features/data-quality/dashboard` 2026-05-25 status **200** (DIRECT FETCH this session) — verbatim: *"No information provided. The page contains no mentions of access control, permissions, user roles, or who can view the dashboard."*
- WebFetch `https://docs.opendatadiscovery.org/features/data-quality` 2026-05-25 status **200** (DIRECT FETCH this session) — verbatim: *"No information about access control, permissions, or visibility restrictions is mentioned in this page."*
- `odd-platform-ui/src/App.tsx:73` — verbatim: `<Route path={dataQualityPath()} element={<DataQuality />} />` (a bare `<Route>` with NO `WithPermissionsProvider` wrapper)
- `odd-platform-ui/src/App.tsx:75-88` — the IMMEDIATELY-ADJACENT `/lookup-tables` route IS wrapped: `<Route path={...} element={<WithPermissionsProvider allowedPermissions={[Permission.LOOKUP_TABLE_CREATE, Permission.LOOKUP_TABLE_UPDATE, Permission.LOOKUP_TABLE_DELETE]} ...>` — the contrast is deliberate and visible in adjacent lines of the route registry
- `odd-platform-ui/src/components/Toolbar/ToolbarTabs/ToolbarTabs.tsx:45-49` — the "Data Quality" tab is rendered UNCONDITIONALLY (no permission check, no conditional render) for every user who reaches the app shell
- `DataQualityContent.tsx:22-147` — the component imports no `Permission` enum, declares no `WithPermissionsProvider`, and issues only `useGetDataQualityDashboard(filterState)` (a GET)

### Drift narrative

The live `/features/data-quality/dashboard` page and `/features/data-quality` landing collectively form the entirety of the Data Quality user-doc surface. Both are SILENT on access control. The runtime behaviour is:

- Under `LOGIN_FORM` / `OAUTH2` / `LDAP`: every authenticated user (including a minimum-privilege user with zero `Permissions` and zero ownership associations) can open `/data-quality` from the top toolbar tab and view the catalog-wide aggregate quality posture — table-health counts, monitored vs unmonitored counts, test-results breakdown across ALL datasets, per-category panels for ALL test categories.
- Under `auth.type=DISABLED`: the same surface is reachable anonymously (the SPA shell is anonymous; the `/data-quality` route has no permission wrapper; the backend endpoint's auth posture is the only remaining gate — P-090 pins this).

Whether this is the intended read-collaborative posture (consistent with the `DataQualityController` sibling's four DQ read endpoints being unscoped at the controller + repository tiers — see DOC-GAP-198 / DOC-GAP-082 META cluster) or a defect is a maintainer-triage call. Either way, the operator-facing doc must DISCLOSE the posture. Today an operator deploying ODD into an environment where catalog-wide quality posture is sensitive (e.g. a multi-tenant catalog where each tenant's DQ failure rate is competitive intel) has no doc-side signal that any authenticated user can see every tenant's quality view.

This is the LSN-001/LSN-002 class operator-trap: the doc is silent, the operator deploys with their security model assumption, and the surface contradicts the assumption. The Data Quality landing page is the canonical place to disclose the posture.

### Proposed doc action

**Two-part action**.

1. **Doc-side PRIMARY — `documentation/docs/features/data-quality/dashboard.md`** — add a "Visibility" or "Access control" sub-section after the rings + filter description, before the categories matrix:

   > **Visibility — the Quality Dashboard is a read-collaborative catalog-wide view.** Any authenticated user can open `/data-quality` and view the catalog-wide aggregate quality posture, regardless of role or ownership associations. The view aggregates table-health, monitored-tables, and per-category test-result counts across every dataset in the catalog — there is no per-user filtering and no permission gate on this surface. Under `auth.type=DISABLED` the surface is anonymously reachable. Operators who need to restrict catalog-wide quality visibility must do so at the deployment layer (network ACL, reverse-proxy auth) — the platform's own RBAC does not gate this route.

2. **Doc-side COMPANION — `documentation/docs/features/data-quality.md` pillar landing** — add one sentence to the "Quality Dashboard" sub-feature bullet: *"Visible to any authenticated user (or anonymously under `auth.type=DISABLED`) — see the dashboard sub-page for the visibility caveat."*

If the maintainer decides the surface SHOULD be gated, the code-side fix is to wrap the route at `App.tsx:73` in `WithPermissionsProvider` with an appropriate `allowedPermissions` list (e.g. a new `DATA_QUALITY_VIEW` permission, or a reuse of an existing read-class permission) — but that is a feature change, not a doc fix; the doc-gap stands independently.

### Cross-references

- **DOC-GAP-082 META** (DISABLED-bypasses-RBAC primary surface — 29 sidecar triangulation): the `/data-quality` route's anonymous reachability under DISABLED is consistent with the meta pattern. This finding adds the route-mount + dashboard-content vertex to that meta's cluster. STRENGTHENS DOC-GAP-082 META's UI-layer surface coverage.
- **DOC-GAP-149** (REV-3 LAYER-0 — P-09 Security & Access Control pillar-claim vs doc-page coverage drift): the silence on `/data-quality` access control is one more instance of the platform-wide pattern that visibility / access-control posture is documented only sporadically and never on the surfaces operators actually use. Cross-link as a same-pattern instance.
- **DOC-GAP-198** (DataQualityController class — the four DQ read endpoints' read-collaborative posture silence): SIBLING surface — same P-04 pillar, same read-collaborative posture, same doc-side silence. The DataQualityController-side and DataQuality-dashboard-UI-side findings together form the full P-04 read-surface visibility-silence cluster.
- **LSN-001 / LSN-002**: canonical operator-trap class — doc silence + runtime behaviour the operator's security model would not predict. The Quality Dashboard route is the latest UI-layer instance.
- **Rule 6 coherence (LSN-018)**: cross-registry sweep ran — no contradictions. `feature-flows/F-022` (per-dataset DQ surface) and the DataQualityController batch-T finding cluster are SAME-POLARITY (all assert the same P-04 read-collaborative posture); no SUPERSEDES, no CONTRADICTS.

### Severity rationale

HIGH. The /data-quality page is the catalog-wide aggregate quality posture surface. An operator with assumption "tenant-scoped quality visibility" deploying multi-tenant catalog gets cross-tenant exposure without doc-side warning. Same operator-impact shape as LSN-001 (attachment ephemeral default) and LSN-002 (S3 region unset) — the doc said one thing or said nothing, and the deployment behaviour violated the operator's security model. The fix is one paragraph on the live dashboard page — cheap to ship, high in operator value.

### Last verified

- 2026-05-25 — live WebFetch dashboard page (200) + landing page (200); both still silent on access control; sidecar evidence (App.tsx:73, App.tsx:75-88, ToolbarTabs.tsx:45-49) re-confirmed at substrate commit `ede5d277`.
