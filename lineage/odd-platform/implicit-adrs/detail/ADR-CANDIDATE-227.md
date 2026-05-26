## ADR-CANDIDATE-227 — Bare base URL of every multi-tab pillar redirects to its canonical first tab via `<Navigate>`; the bare path is NEVER a chooser screen and NEVER a renderable view — operator following the global nav lands directly on the canonical-first sub-feature, deep-linkers to bare base bounce to the same destination

**Severity**: HIGH
**Classification**: promote
**Pillars affected**: [P-02 Data Modelling, P-04 Data Quality, P-06 Data Glossary, P-07 Alerts, P-08 Management]

**Support count**: 3 PRIMARY-source sidecars + 2 confirmation references + 1 anti-pattern (terms — VIOLATES the convention; pinned by REFACTOR-670)

**Surfaced by** (5 sidecars across 5 distinct pillars):
- `dataModelling.md:implicit_adrs[2]` — "The bare `/data-modelling` URL is not a renderable view — landing on it always redirects to `/data-modelling/query-examples` via `<Navigate to='query-examples' />` at `components/DataModelling/DataModellingRoutes.tsx:16`. Equivalent pattern is used by Alerts (`/alerts` → `/alerts/all`), Search, Management. The decision: every multi-tab pillar's bare base URL is a redirect to the canonical first tab, not a 404 and not a chooser screen."
- `management.md:implicit_adrs[2]` — "redirectTo='../namespaces' matches `<Navigate to='namespaces' replace />` — both treat namespaces as the safe-default management landing" (`ManagementRoutes.tsx:151` declares `<Route path='' element={<Navigate to='namespaces' replace />} />`)
- `alerts (sibling sidecar cross-reference)` — `/alerts` → `/alerts/all` via the same Navigate redirect pattern
- `terms.md:bugs_limitations_corner_cases[0]` (ANTI-PATTERN / VIOLATION) — "Visiting bare `/terms` renders a blank page. App.tsx:66 declares `<Route path={termsPath()}>` as a parent with one child route (`:termId/*`) and NO `index` route, NO `element` prop on the parent itself, NO `Navigate` fallback." → the convention IS violated for terms; the violation is recorded as REFACTOR-670 (mint this batch)
- `masterData.md:bugs_limitations_corner_cases[0]` (PARTIAL ANTI-PATTERN) — "Visiting `/master-data` directly (no nested path) produces no `<Route>` match — react-router renders nothing and there is no fallback / no redirect to `/master-data/lookup-tables`" → another violation; recorded as REFACTOR-669

**Decision statement**: Every multi-tab pillar surface in the odd-platform-ui SPA is structured such that the BARE base URL (`/<pillar>`, no nested path) is NEVER a renderable view. Three patterns implement the convention:

1. **`<Navigate to='<first-tab>' replace />` as the empty-path child** — the canonical pattern. Used by:
   - `/data-modelling` → `/data-modelling/query-examples` (`DataModellingRoutes.tsx:16`)
   - `/management` → `/management/namespaces` (`ManagementRoutes.tsx:151`)
   - `/alerts` → `/alerts/all` (`AlertsRoutes.tsx`)
2. **Bare URL never reached** — the global toolbar tab links DIRECTLY to the canonical first sub-route, bypassing the bare URL entirely. Both reinforcements coexist: a redirect catches deep-linkers + bookmarks, the toolbar bypass keeps the common path fast.
3. **`RestrictedRoute redirectTo='../<first-tab>'` for gated sibling sub-routes** — when a sub-route is permission-gated and the user lacks the permission, the redirect target IS the same canonical first tab. `ManagementRoutes.tsx:101-110` redirects `/management/associations/*` users without `OWNER_ASSOCIATION_MANAGE` to `../namespaces` — matching the bare-`/management` Navigate target.

The intent: the operator clicking the pillar's global-nav tab gets a usable surface immediately (the canonical-first sub-feature), regardless of whether they hit the bare URL or the explicit first-tab URL or got redirected from a denied sibling. The convention also defines a "safe default" tab per pillar — Query Examples for Data Modelling, Namespaces for Management, All Alerts for Alerts.

**Wisdom test (3-question)**:
1. *Intentional?* YES — three distinct sidecars surface the exact same `<Navigate to='<first-tab>'>` pattern across three pillars, with `ManagementRoutes.tsx:151` AND `ManagementRoutes.tsx:106` (RestrictedRoute fallback) BOTH converging on the same destination. The convergence is structural design, not coincidence.
2. *Structural impact?* YES — defines the URL-shape contract for every multi-tab pillar. Adding a new pillar requires the maintainer to (a) choose the canonical-first tab, (b) declare the bare-URL Navigate redirect, (c) decide whether the toolbar tab links to bare OR to the first-tab explicitly. The decision is upstream of every new pillar.
3. *Refactoring or structural?* STRUCTURAL — abandoning the convention (e.g., letting bare `/management` render a chooser screen or a 404) is a structural change to the URL contract that affects deep-link reliability, operator mental model, and the toolbar-tab implementation.
→ ADR.

**Anti-patterns / violations** (THIS is the operator-visible value of codifying the convention):
- **Terms** (`/terms`) — `App.tsx:66` declares `<Route path={termsPath()}>` as a parent with one child `:termId/*` and NO `index` route, NO `element`, NO `<Navigate>` fallback. Operator typing `/terms` sees a blank page beneath the toolbar. The convention SHOULD have been: `<Route path='' element={<Navigate to='termsearch' replace />} />` — but the Dictionary tab in ToolbarTabs.tsx:67 uses `termsSearchPath()` (i.e., `/termsearch`) anyway, so the operator never reaches `/terms` through normal navigation. The anti-pattern is the absence of the safety-net redirect for deep-linkers/bookmarks. Recorded as REFACTOR-670.
- **Master Data** (`/master-data`) — `App.tsx:60-89` declares no `<Route path='/master-data'>` parent at all; only `<Route path={lookupTablesPath()}>` (i.e., `/master-data/lookup-tables`) is mounted. Visiting `/master-data` produces no route match → blank page. Toolbar tab uses `lookupTablesPath()` directly, so the operator never reaches `/master-data` through normal navigation; the gap is a deep-link / bookmark hazard. Recorded as REFACTOR-669.

The two violations have the same shape (deep-linkers hit blank pages) but DIFFERENT causes (terms has a parent with no fallback; master-data has no parent at all). Both are deviations from the convention this ADR codifies.

**Evidence**:
- `DataModellingRoutes.tsx:16` says: "`<Route path='' element={<Navigate to='query-examples' replace />} />`"
- `ManagementRoutes.tsx:151` says: "`<Route path='' element={<Navigate to='namespaces' replace />} />`"
- `ManagementRoutes.tsx:101-110` says: "`<RestrictedRoute isAllowedTo={hasAccessTo(OWNER_ASSOCIATION_MANAGE)} redirectTo='../namespaces' />`"
- `ToolbarTabs.tsx:50-54` says: "`{ name: t('Data Modelling'), link: queryExamplesPath() }`" — toolbar bypasses bare URL
- intent_anchor: three distinct sidecars name the same first-tab destination per pillar AND the RestrictedRoute fallback also names the same destination — the convergence is the intent

**Existing ADRs / composition**:
- Composes with **ADR-CANDIDATE-228** (NEW this batch — routes-as-functions convention) — together they form the URL-shape architecture: per-pillar URL prefix + path-builder functions in `routes/`, redirect-to-first-tab on the bare URL.
- Composes with **ADR-CANDIDATE-088** (WithPermissions context primitive) — the RestrictedRoute fallback at `ManagementRoutes.tsx:101-110` is the ONLY route-layer permission gate in the Management subtree; everywhere else uses WithPermissionsProvider (context-only, per ADR-CANDIDATE-229 NEW). The convention codifies that the redirect target on permission denial = the canonical-first tab of the parent pillar.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-669 (NEW — bare `/master-data` URL renders nothing)
- REFACTOR-670 (NEW — bare `/terms` URL renders blank)

**Proposed action**: Promote to `adrs/drafts/multi-tab-pillar-redirect-to-canonical-first-tab.md`. Document:
- The 3-pattern convention (Navigate empty-path child / toolbar bypass / RestrictedRoute fallback to canonical first tab).
- The list of canonical-first tabs per pillar (Data Modelling → Query Examples, Management → Namespaces, Alerts → All).
- The reasoning: deep-link reliability, operator mental model, the "safe default" semantics.
- The maintenance obligation: every new multi-tab pillar must add an empty-path `<Navigate>` child to the parent route AND declare the canonical-first tab in the per-pillar Routes module.
- The two known violations (terms, master-data) and the migration path (REFACTOR-669, REFACTOR-670).

**Severity rationale**: HIGH — the convention is operator-visible (blank pages on the violation surfaces — terms, master-data) and structural (defines every pillar's URL-shape behaviour). Cross-pillar (3 confirming + 2 violating + ADRs reference more — total surface ~6 pillars).

**Cross-pillar bump**: P-02 + P-04 + P-06 + P-07 + P-08 (5 pillars) — already HIGH.

**Suggested backlog grouping**: `URL-shape architecture codification` + `Deep-link reliability sprint`.

---

**STRENGTHENS — batch ZH (2026-05-26 — UI Routes 1: dataModelling/dataQuality/management/masterData/terms sidecars confirm the convention across 5 pillars + identify 2 violations)**

The 5 new route sidecars in batch ZH triangulate the convention with 3 confirming surfaces + 2 explicit anti-patterns. The terms anti-pattern is particularly load-bearing because it's the pillar whose deep-link surface IS the primary navigation flow (post-create redirect at TermsForm.tsx:110 → `termDetailsPath(response.id)`; the parent `/terms` is the structural mount for term details, but the bare `/terms` has no safety net) — a stale `/terms` link from any source (email, bookmark, external reference) lands the operator on a blank page beneath the toolbar with no signal to recover. The convention exists; this batch makes the violations enumerable.
