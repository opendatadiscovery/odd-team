## STRENGTHENS — ToolbarTabs as the 9-tab UI primary source (batch ZJ)

DOC-GAP-186 documents that the live `/features/management` page claims "Tab visibility is permission-aware" while the implementation renders the Management top-nav tab unconditionally. Batch ZJ adds the **DEFINITIVE PRIMARY SOURCE** — the ToolbarTabs sidecar — and extends the finding from "Management tab specifically" to "ALL 9 primary navigation tabs uniformly".

### Added surfaced_by (new sidecar cited)

- `odd-platform__ts__components_shared_elements_AppToolbar_ToolbarTabs__ui-shell-widget__ToolbarTabs.md:bugs_limitations_corner_cases[0]` — **NEW PRIMARY SOURCE**: "Tab visibility is structurally unconditional — there is no Permission / Role / feature-flag gate on any tab. A READ_ONLY user sees the 'Management' tab the same as an ADMIN user; users from any backend that lacks one of the supporting features (e.g. an instance with no Lookup Tables data) still see 'Master Data' as a top-level affordance. The operator-visible impact: tabs lead to pages that may render empty or 403-redirect, with no upstream signal that the affordance was inapplicable to this user. Note: the downstream `Management/*` routes are individually permission-gated by WithPermissionsProvider, but only the page bodies — not the tab visibility." **(severity HIGH per sidecar)**
- `odd-platform__ts__components_shared_elements_AppToolbar_ToolbarTabs__ui-shell-widget__ToolbarTabs.md:security.known_security_gaps[0]` — **NEW**: "Tab visibility is structurally unconditional — READ_ONLY users see the 'Management' tab the same as ADMIN. The downstream Management page is permission-gated per route (cross-ref ZH WithPermissionsProvider non-blocking finding), but the discovery affordance — 'this feature exists' — is leaked to every authenticated user. For instances with strict separation-of-duties requirements, this leaks the EXISTENCE of management capabilities to non-management users. Whether intentional (consistent UI for all users) or accidental, undocumented." **(severity MEDIUM per sidecar)**
- `odd-platform__ts__components_shared_elements_AppToolbar_ToolbarTabs__ui-shell-widget__ToolbarTabs.md:stress_findings.auth_gates[0]` — **NEW**: verbatim Q "What does a wrong-role caller see (e.g. READ_ONLY hitting the toolbar)?" / A "READ_ONLY users see ALL 9 tabs — IDENTICAL to an ADMIN. The 'Management' tab is visible to every authenticated user regardless of whether they have any Management permissions." + "Where does the gate live — component, parent, route, or nowhere?" / A "**Nowhere at the tab-visibility layer.** Each downstream route may have its own gate (e.g. `App.tsx:75-88` wraps LookupTables in WithPermissionsProvider; per ZH the wrapper is NON-blocking — it renders the page anyway with reduced UI). Permission-based tab hiding is NOT implemented; this is intentional-or-accidental and undocumented."

### New evidence (supplementary)

- `ToolbarTabs.tsx:34-82` (verbatim full Read this session): the hard-coded 9-tab literal array — Catalog / Directory / Data Quality / Data Modelling / Master Data / Management / Dictionary / Alerts / Activity — declared as the SOLE source-of-truth for the primary nav. No `useAppSelector(getGlobalPermissions)`, no `WithPermissions` wrap, no per-tab conditional. The ToolbarTabs sidecar primary source confirms the unconditional-rendering pattern at the originating layer; the original DOC-GAP-186 used App.tsx + WithPermissionsProvider as triangulation but ToolbarTabs IS the structural source.
- Grep `usePermissions|getGlobalPermissions|hasGlobalPermission|Permission\.` (per sidecar primary source) inside the AppToolbar subtree returns 0 matches — verifies the absence is structural, not incidental.
- The ToolbarTabs sidecar explicitly enumerates ALL 9 tabs as affected (not just Management): the 9-tab pattern extends DOC-GAP-186 from "Management tab specifically" to "every primary tab — Catalog, Directory, Data Quality, Data Modelling, Master Data, Management, Dictionary, Alerts, Activity — is rendered unconditionally regardless of feature-flag state, role, or permissions".
- New sub-drift surfaced by the ToolbarTabs sidecar: feature-flag-vs-tab drift. `Feature.DATA_COLLABORATION`-gated destinations (Data Modelling → Query Examples — `Message.tsx:59`, `MainThreadMessage.tsx:36`, `DataEntityDetailsHeader.tsx:132` all wrap children in `<WithFeature featureName={Feature.DATA_COLLABORATION}>`) have NO matching tab-entrypoint gate. Under default deployment (`datacollaboration.enabled=false`), clicking Data Modelling navigates to `/data-modelling/query-examples` but the user sees an empty/non-functional surface. ToolbarTabs sidecar primary source: "tabs render regardless of feature-flag state". The original DOC-GAP-186 framing addressed Management-permissions; this NEW dimension extends the gap to Data-Modelling-feature-flag.

### New operator-impact dimensions surfaced

1. **9-tab scope, not 1-tab scope**: DOC-GAP-186 originally framed the gap as Management-specific; batch ZJ's ToolbarTabs sidecar establishes the gap is STRUCTURAL across all 9 tabs. Every tab — including future tabs added to the array — inherits the unconditional rendering by default. The doc-product fix needs to address the GENERAL contract, not just the Management special case.
2. **Feature-flag dimension (NEW)**: per the ToolbarTabs sidecar's name_behavior_pair on "Data Modelling tab", clicking Data Modelling under default deployment (`datacollaboration.enabled=false`) lands on an empty/non-functional Query Examples surface. The Data Modelling tab inherits the unconditional rendering AND has no feature-flag check at the tab layer. The same pattern would apply to any future feature-flagged sub-feature whose entrypoint is a top-nav tab.
3. **Cross-locale uniformity**: per the ToolbarTabs sidecar's i18n analysis (cross-ref DOC-GAP-309 NEW), the tab labels are uniformly rendered across all 6 locales (English/Spanish/Chinese/French/Ukrainian/Armenian); the unconditional-visibility pattern thus ships uniformly. The Management tab is visible to every authenticated user IN EVERY LOCALE; no locale-specific behaviour exists.

### Triangulation update

DOC-GAP-186 was originally surfaced by 4 sidecars (AppToolbar component + RolesList + OwnersList + WithPermissionsProvider). Batch ZJ adds 1 NEW PRIMARY SOURCE (the ToolbarTabs sidecar — the 9-tab array's originating component) + 1 supporting source (AppToolbar UI-shell-tier widget enrichment). **Coverage: 4 → 6 sidecars; the new sidecars are the STRUCTURAL primary sources for the 9-tab array, not the parent shell.**

### Proposed doc action update

The original DOC-GAP-186 two-part proposed action (correct the live `/features/management.md` "Tab visibility is permission-aware" claim + add a "What permission absence looks like in the UI" sub-section to `permissions.md`) STILL APPLIES; batch ZJ adds one specific dimension to the recommended `features/management.md` rewrite:

- **Add a "Top-level navigation visibility model" section** (in BOTH `features/management.md` AND in the new `features/ui-overview.md` proposed by DOC-GAP-307 NEW):

  > "**Top-level navigation visibility model**: ALL nine primary navigation tabs (Catalog, Directory, Data Quality, Data Modelling, Master Data, Management, Dictionary, Alerts, Activity) are visible to every signed-in user regardless of role, permission set, or backend feature-flag state. This is intentional, consistent with the platform's read-collaborative posture. Per-feature permission checks happen at the page-body / per-button layer, NOT at the tab-visibility layer. Operators expecting tab-level hiding (e.g. 'hide Management for non-admin users') should treat the 9-tab visibility as a discovery affordance; the actual administrative authority is enforced at the per-button gates inside each Management sub-page."

- **Add a "Feature-flag visibility caveat"** (new bullet under the Top-level navigation section):

  > "**Feature-flag caveat**: when an operator disables a backend feature via configuration (e.g. `datacollaboration.enabled=false`, the default), the corresponding top-level tab REMAINS VISIBLE — the tab leads to a destination that the disabled feature has rendered empty or non-functional. The Data Modelling tab specifically is feature-flagged at its destination (Query Examples is a Data Collaboration sub-feature) but unflagged at the tab entry point; under default deployment, clicking Data Modelling lands on an empty Query Examples surface. The fix is to add a `<WithFeature>` wrap at the ToolbarTabs layer for any feature-flagged tab; tracked at DOC-GAP-186-batch-ZJ-append (this entry)."

### Cross-references update

Add to existing DOC-GAP-186 cross-references:
- **DOC-GAP-307 NEW** (UI-shell canonical doc page absent) — this finding's "Top-level navigation visibility model" section belongs in the new UI-shell page (with a back-link from `features/management.md`)
- **DOC-GAP-308 NEW** (label↔URL drift on 4 primary tabs) — sibling toolbar finding; the same 9-tab widget affected
- **DOC-GAP-309 NEW** (3 primary-nav tabs missing i18n keys) — sibling toolbar finding; the 9-tab visibility pattern ships uniformly across all 6 locales with the same labels (and the same 3 untranslated labels)
- **DOC-GAP-302 META** (WithPermissionsProvider naming-vs-behaviour) — this finding is the cross-pillar META that DOC-GAP-186 surfaces at the top-nav level

### Severity update

Severity remains **MEDIUM** — the 6-sidecar triangulation confirms the assessment. Batch ZJ widens the SCOPE (1-tab → 9-tab + feature-flag dimension) without changing the SECURITY CLASS (no auth gate bypassed). Severity is MEDIUM, not HIGH, because: (a) the per-button gates DO hide mutation affordances correctly; (b) the gap is operator-experience class (Management tab visible to non-admin users → operator confusion) + reconnaissance class (the existence of Management features is leaked). Severity is MEDIUM, not LOW, because: (a) the live docs REINFORCE the wrong promise verbatim ("Tab visibility is permission-aware"); (b) the gap affects ALL 9 tabs uniformly (every operator-impact pattern is multiplied by 9); (c) the cross-locale uniformity means the gap ships identically to every multilingual deployment.

---

**Batch ZJ contribution**: 1 NEW DEFINITIVE PRIMARY SOURCE (ToolbarTabs sidecar) + 1 supporting source; coverage 4 → 6 sidecars; gap scope widened from Management-specific to ALL-9-tab structural + feature-flag dimension added; severity unchanged (MEDIUM); proposed doc action extended with two new sections in the recommended rewrite.
