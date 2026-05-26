## ADR-CANDIDATE-234 — The App Info menu composes FIVE distinct surfaces (Documentation, Slack, Project Version+GitHub, Feedback, operator-configured `odd.links`) into ONE chrome popover; the AppToolbar separately handles language + logout in the user-account popover — the two-popover split is the deliberate inbound-vs-outbound segregation

**Severity**: MEDIUM
**Classification**: promote
**Batch**: ZJ (2026-05-26)
**Pillars affected**: [P-08 Operator Experience, P-06 Configuration & Deployment]

**Surfaced by**:
- `odd-platform__ts__components_shared_elements_AppToolbar_AppInfoMenu__ui-shell-widget__AppInfoMenu.md:implicit_adrs[0]` (MEDIUM) — "The App Info menu is the SINGLE chrome surface for deployment-meta + operator-configured + community shortcuts — Documentation, Slack, GitHub-by-version, Feedback, and `odd.links` all live in the SAME widget rather than being split across the toolbar. — evidence: AppInfoMenu.tsx:71-122 (the single AppMenu containing all five surfaces in fixed vertical order) + AppToolbar.tsx:67 (the only mount site) — intent_anchor: 'The widget composes all secondary navigation in ONE popover; the AppToolbar separately handles language + logout in the user-account popover. The split is deliberate: app-info popover for OUTBOUND links, account popover for INBOUND identity actions.' — confidence: MEDIUM"

**Decision statement**: The platform's chrome reserves TWO popovers above every authenticated page: (1) the App Info menu (`AppInfoMenu.tsx`, anchored to the information-icon at `AppToolbar.tsx:67`), and (2) the user-account menu (anchored to the user-name dropdown at `AppToolbar.tsx:68-82`). The App Info popover holds FIVE surfaces in fixed vertical order — Documentation (hardcoded gitbookLink to `docs.opendatadiscovery.org`), Slack (hardcoded `slackLink`), Project Version + GitHub link (`useAppInfo()` → `/api/appInfo`), Leave Feedback (hardcoded `reviewLink` to Product Hunt), and operator-configured `odd.links` (`useAppLinks()` → `/api/links`). The user-account popover holds language switcher + Logout.

The split is deliberate: the App Info popover is the OUTBOUND-LINKS surface (the user is leaving the SPA to a docs / community / version / feedback / operator-curated destination); the user-account popover is the INBOUND-IDENTITY-ACTIONS surface (the user is acting on their own identity within the SPA's auth flow). The two never overlap; the AppToolbar architecture commits both popovers to permanent residence above every authenticated page.

**Wisdom test (3-question)**:
1. *Intentional?* YES — the AppInfoMenu deliberately composes ALL secondary navigation in one popover (the alternative would be five separate icons in the toolbar; the platform chose one consolidated popover). The two-popover split (info-icon vs user-name) is observable across every page; the AppInfoMenu's keepMounted (line 90) commits to the long-lived single-popover architecture.
2. *Structural impact?* YES — the choice shapes the chrome's secondary-navigation footprint (one icon button per popover; not five buttons; not a sidebar). It also commits to the boot-immutable @ConfigurationProperties shape on the backend side (LinksController side; cross-ref REFACTOR-631) — once a popover is the destination, the chain from @ConfigurationProperties → React-Query cache → popover render must hold the no-runtime-edit assumption.
3. *Refactoring or structural?* STRUCTURAL — splitting the App Info menu's five surfaces into separate toolbar icons (or absorbing them into the user-account menu, or breaking out the operator-links into a separate sidebar) would change the chrome's spatial vocabulary everywhere. The two-popover discipline is the architectural choice, not a local widget style.
→ ADR.

**Evidence**:
- AppInfoMenu.md says: "The App Info menu is the SINGLE chrome surface for deployment-meta + operator-configured + community shortcuts — Documentation, Slack, GitHub-by-version, Feedback, and `odd.links` all live in the SAME widget rather than being split across the toolbar."
- AppInfoMenu.tsx:71-122 (the single AppMenu wrapping all 5 surfaces)
- AppToolbar.tsx:67 (the only mount site — one icon per popover, two popovers total)
- live doc page at `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform` (verified 2026-05-26, status 200) — "The platform UI surfaces them inside the App Info menu (the popup behind the information icon in the top-right toolbar)." — the maintainer-facing docs name the popover EXPLICITLY, confirming the operator-facing label and the deliberateness of the consolidation.

**Existing ADR**: none for the consolidation choice. Composes with the broader AppToolbar chrome decisions (cross-ref ADR-CANDIDATE-237 NEW this batch — logout-via-full-page-redirect; ADR-CANDIDATE-238 NEW this batch — owner.name precedence).

**Proposed action**: Promote to `adrs/drafts/app-info-menu-five-surface-consolidation.md` (new ADR). Document:
- The five surfaces and their backend sources (`/api/appInfo` for Project Version, `/api/links` for operator-curated, plus three hardcoded URLs).
- The fixed vertical order (Doc → Slack → Version → Feedback → operator links).
- The two-popover split (info-icon = outbound, user-name = identity-inbound).
- The `keepMounted` (`AppInfoMenu.tsx:90`) implication — the menu DOM stays mounted post-first-hover; this couples to the LinksController @ConfigurationProperties boot-immutability (cross-ref REFACTOR-631).
- The consequence operators reading the docs already know: the popover is the canonical home for "where does my operator-configured link live in the UI"; rearranging the popover (e.g. moving the Project Version row) requires updating the doc page.

**Severity rationale**: MEDIUM — pattern-shaping chrome architecture; uniformly applied (one popover, one mount site); operator-facing doc page already names the surface so it has an established operator vocabulary. Not HIGH because no data loss / no security exposure flows from the decision (the disclosure gaps under DISABLED are documented separately in REFACTOR-068 and the new REFACTOR-688). Not LOW because it codifies a chrome layout decision that future PRs (e.g. adding a new operator surface, splitting the menu) need to consider.

**Suggested backlog grouping**: `UI architecture codification`.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-629 (AppInfoMenu rel=noopener missing on the operator-link surface — expanded by batch ZJ to all 5 link sites)
- REFACTOR-630 (URL scheme not validated — javascript:/data: pass through)
- REFACTOR-631 (boot-immutable @ConfigurationProperties — the popover masks the runtime-edit-invisibility because of keepMounted)
- REFACTOR-068 (DISABLED-mode version disclosure via /api/appInfo — the UI's App Info popover is the multiplier)
- REFACTOR-689 NEW this batch (keyboard-inaccessibility — the popover's hover-only activation is a WCAG SC 2.1.1 violation)
- REFACTOR-696 NEW this batch (link.url as React key)
- REFACTOR-697 NEW this batch (hardcoded labels not translatable)

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-237 NEW (the user-account popover's logout-via-full-page-redirect; together they define the two-popover chrome architecture).
- SUPERSEDES: none.
- CONFLICTS: none.

---
