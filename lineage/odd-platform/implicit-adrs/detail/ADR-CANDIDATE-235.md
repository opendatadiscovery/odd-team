## ADR-CANDIDATE-235 — Primary navigation tabs (9 hard-coded entries in fixed order: Catalog / Directory / Data Quality / Data Modelling / Master Data / Management / Dictionary / Alerts / Activity) are encoded as a literal array in `ToolbarTabs.tsx`, NOT config-driven, NOT registry-driven, NOT permission/role/feature-flag-aware — the tab list IS the product taxonomy

**Severity**: MEDIUM
**Classification**: promote
**Batch**: ZJ (2026-05-26)
**Pillars affected**: [ALL — every pillar's surface is the destination of a ToolbarTabs entry]

**Surfaced by**:
- `odd-platform__ts__components_shared_elements_AppToolbar_ToolbarTabs__ui-shell-widget__ToolbarTabs.md:implicit_adrs[0]` (MEDIUM) — "Tab list is hard-coded in source, not config-driven or registry-driven — evidence: ToolbarTabs.tsx:34-82 — intent_anchor: 'no comment defends the design, but the tab list is constructed inside a `useMemo` literal array that takes no parameter except `activityQueryString` and `t` — the pattern signals \"this is a static product taxonomy, not a runtime composition\"' — confidence: MEDIUM"

**Decision statement**: The platform's primary navigation tabs are hard-coded in `ToolbarTabs.tsx:34-82` as a fixed 9-element array: Catalog / Directory / Data Quality / Data Modelling / Master Data / Management / Dictionary / Alerts / Activity, in exactly that order. The array is the canonical source for "what tabs exist"; reordering, adding, removing, or feature-flag-gating tabs requires a code change in this file (and a release). There is no admin UI for tab management; there is no per-operator tab customization; there is no per-role or per-feature-flag tab visibility model.

The decision composes with the upstream architectural choice that the platform's pillars are a CLOSED SET — the 9 tabs ARE the public taxonomy of the platform's deliverables. New pillars enter via PR + release, not via runtime configuration.

**Wisdom test (3-question)**:
1. *Intentional?* YES — the tab list is a literal array inside a `useMemo` that takes no parameter except `activityQueryString` and `t`. There is no codepath that reads from config, from a backend, from a registry, or from anything dynamic. The maintainer-author chose a literal array.
2. *Structural impact?* YES — the choice shapes the platform's public taxonomy AND determines that pillar visibility is a code-only concern. Operators reading the docs can rely on the 9 tabs being the same across every deployment of the same version; consumers building automation against the SPA can rely on the tab corpus being stable. The decision also forces a release every time a pillar is added, renamed, or hidden.
3. *Refactoring or structural?* STRUCTURAL — flipping to a config-driven / registry-driven / role-aware tab system would change the chrome's runtime shape and the operator's mental model. Today's "Management tab is visible to every user" surprise (REFACTOR-687 NEW this batch) is consequence-of-this-ADR, not a defect to refactor around — the decision is to surface the SAME taxonomy to every user regardless of role / permission / feature-flag state. A future PR adding role-based tab visibility would supersede this ADR.
→ ADR.

**Evidence**:
- ToolbarTabs.md says: "Tab list is hard-coded in source, not config-driven or registry-driven"
- ToolbarTabs.tsx:34-82 (the literal array; deps are `[activityQueryString, t]`, neither of which encodes role / permission / feature flag)
- AppToolbar.tsx:64 (mounts `<ToolbarTabs />` unconditionally; no per-user variant)
- App.tsx:56 (mounts AppToolbar above every Routes block; no per-route variant)
- Grep `usePermissions|getGlobalPermissions|hasGlobalPermission|WithFeature|WithPermissionsProvider` inside the AppToolbar subtree returns 0 matches.

**Existing ADR**: none for the hard-coded tab list. Composes with:
- ADR-CANDIDATE-227 (bare base URL redirects to canonical first tab) — also a routing-architecture decision.
- ADR-CANDIDATE-228 (per-pillar routes/{pillar}*.ts module with path-builder functions) — the source of truth for tab destinations.
- ADR-CANDIDATE-236 NEW this batch (Catalog/Dictionary tab onClick mints fresh search-id) — the dynamic-link override for two of the 9 tabs.

**Proposed action**: Promote to `adrs/drafts/primary-navigation-tabs-hard-coded-taxonomy.md` (new ADR). Document:
- The 9-tab canonical list and the fixed order.
- The intentional absence of runtime configurability (no admin UI; no role gate; no feature-flag gate).
- The maintenance obligation: a new tab requires editing this file PLUS adding a route helper PLUS adding the i18n keys PLUS updating the doc page that enumerates the pillars.
- The cross-feature impact: tab destinations may be feature-gated downstream (e.g. Data Modelling → Query Examples may be feature-gated on a future GenAI flag), but the tab entrypoint will continue to render.
- The implied operator contract: tab corpus is stable per release; doc pages can reference tabs by name without versioning.

**Severity rationale**: MEDIUM — pattern-shaping product/architecture decision; uniformly applied; affects every pillar. Not HIGH because the tab list itself doesn't leak data or expose security gaps (the consequences — REFACTOR-687 unconditional visibility — are separately tracked refactoring scopes). Not LOW because the decision is load-bearing for the public taxonomy and the operator's mental model of "what features exist".

**Suggested backlog grouping**: `UI architecture codification`.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-687 NEW this batch (unconditional tab visibility — Management visible to non-admin users; consequence-of-this-ADR, separately tracked)
- REFACTOR-694 NEW this batch (Catalog/Dictionary silent thunk rejection on click)
- REFACTOR-695 NEW this batch (substring-match selectedness heuristic — fragile-by-design)
- REFACTOR-690 NEW this batch (3 of 9 tab labels — Data Quality / Data Modelling / Master Data — missing i18n keys in en.json)

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-227 (bare base URL redirects), ADR-CANDIDATE-228 (per-pillar routes/{pillar}*.ts), ADR-CANDIDATE-236 NEW this batch.
- SUPERSEDES: none.
- CONFLICTS: none.

---
