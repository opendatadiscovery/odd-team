## STRENGTHENS — Batch ZJ (2026-05-26 — scope broadens from operator-link-only to ALL FIVE link sites in AppInfoMenu)

Prior REFACTOR-629 enumerated only the operator-configured `odd.links` rendering at `AppInfoMenu.tsx:61` as the rel=noopener-missing surface. Batch ZJ's AppInfoMenu primary-source sidecar confirms ALL FIVE link sites in the widget share the defect: the four hardcoded targets (gitbookLink at line 95, slackLink at line 103, github-by-version at line 41, reviewLink at line 112) AND the operator-configured loop at line 61 ALL use `<Link target='_blank'>` WITHOUT `rel='noopener noreferrer'`.

**New surfaced_by entry**:
- `odd-platform__ts__components_shared_elements_AppToolbar_AppInfoMenu__ui-shell-widget__AppInfoMenu.md:bugs_limitations_corner_cases[0]` (MEDIUM) — "ALL FIVE link sites in this widget use `<Link target='_blank'>` WITHOUT `rel='noopener noreferrer'` — including the hardcoded gitbook (line 95), slack (line 103), github (line 41), feedback (line 112) AND every operator-configured link (line 61). This is broader than the F-035 facet records (which only enumerates the operator-configured surface): the four hardcoded targets are first-party but the JavaScript context still leaks `window.opener` to docs.opendatadiscovery.org, go.opendatadiscovery.org, github.com, and producthunt.com. The third-party targets (github, producthunt) are TRUSTED today but a future XSS on those domains would have lateral movement into the ODD Platform tab via window.opener.navigate."

- `odd-platform__ts__components_shared_elements_AppToolbar_AppInfoMenu__ui-shell-widget__AppInfoMenu.md:security.known_security_gaps[0]` (MEDIUM) — "ALL five external links use `target='_blank'` without `rel='noopener noreferrer'` — reverse tabnabbing vector from any rendered destination. Operator-configured URLs are the broadest attack surface (a less-trusted role with config-edit could weaponise); the four hardcoded targets (docs/slack/github/producthunt) are first-party-trusted but inherit the same window.opener leak as a defence-in-depth gap"

**What this strengthening adds**: the scope expands from the operator-only surface (1 line, line 61) to the FULL widget (5 lines: 41, 61, 95, 103, 112). The fix obligation extends correspondingly: any one-line fix is no longer sufficient; all five sites need `rel='noopener noreferrer'` AND the ESLint `react/jsx-no-target-blank` rule needs to be enabled/un-suppressed to prevent regression.

**Defence-in-depth framing**: the four hardcoded targets are TRUSTED first-party (docs.opendatadiscovery.org, go.opendatadiscovery.org, github.com, producthunt.com), so the realistic-exploit window is narrow. But the broader principle — every `target='_blank'` deserves `rel='noopener noreferrer'` — applies; the operator-configured surface is the highest-risk variant and is the one F-035 originally enumerated.

**Triangulation count after ZJ**: 2 sidecars (was 1 — LinksController; ZJ adds the AppInfoMenu primary-source widget sidecar).

**Severity unchanged**: MEDIUM. Modern-browser-default `noopener` semantics (Chrome 88+ / Firefox 79+ / Safari 12.1+) softens the realistic exploit window even for the operator-link surface; the four hardcoded targets are first-party trusted; the cost-vs-benefit of the 5-line fix is overwhelmingly favourable but the priority remains MEDIUM.

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-630 (URL scheme not validated — composes for the operator-link site specifically); ADR-CANDIDATE-234 NEW this batch (AppInfoMenu five-surface consolidation — the architectural choice that aggregates all five link sites into one widget the same defect now applies to).
- SUPERSEDES: none.
- CONFLICTS: none.

---
