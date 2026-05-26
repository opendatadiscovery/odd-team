## REFACTOR-689 — AppInfoMenu is hover-activated only (onMouseEnter) — no `onClick`, no `onKeyDown`, no `onFocus`; keyboard users and touch-device users cannot open the menu; ARIA attributes (`aria-haspopup`, `aria-controls`) claim keyboard accessibility that does not exist — WCAG 2.1 SC 2.1.1 (Keyboard) violation plus mobile-UX gap

**Severity**: MEDIUM
**Category**: accessibility-violation / mobile-unreachable / WCAG-2.1-violation
**Batch**: ZJ (2026-05-26)
**Pillars affected**: [P-08 Operator Experience, P-09 Accessibility-compliance-obligation]

**Surfaced by**:
- `odd-platform__ts__components_shared_elements_AppToolbar_AppInfoMenu__ui-shell-widget__AppInfoMenu.md:bugs_limitations_corner_cases[1]` (MEDIUM) — "Menu opens on `onMouseEnter` only (line 81) — touch-device users (iOS Safari, Android Chrome on phone/tablet) generate NO mouseenter on the icon button; the menu is unreachable. The ARIA attributes (`aria-haspopup='true'` at line 80, `aria-controls={menuId}` at line 79) indicate the AUTHOR expected the menu to be activatable by AT users / keyboard users, but no `onClick`, `onKeyDown`, or `onFocus` handler is wired. This is a WCAG 2.1 SC 2.1.1 (Keyboard) violation in addition to a mobile-UX gap."

- `odd-platform__ts__components_shared_elements_AppToolbar_AppInfoMenu__ui-shell-widget__AppInfoMenu.md:security.known_security_gaps[3]` (MEDIUM, accessibility class) — "Menu is keyboard-inaccessible (only `onMouseEnter`, no `onClick` / `onKeyDown`) — WCAG 2.1 SC 2.1.1 violation. The `aria-haspopup='true'` + `aria-controls` ARIA attributes claim keyboard support that does not exist. AT users (screen-readers + keyboard navigation) cannot reach the version display or operator-configured links."

**Statement**: `AppInfoMenu.tsx:78-82` declares an icon button with ARIA attributes `aria-haspopup='true'` + `aria-controls={menuId}` AND `onMouseEnter={handleAppMenuOpen}` as the ONLY event handler. There is no `onClick`, no `onKeyDown`, no `onFocus` — the menu cannot be opened by:
1. **Keyboard users** — tab to the icon button, press Enter or Space → nothing happens. The menu is unreachable for keyboard-only navigation.
2. **Screen-reader users (AT)** — the ARIA attributes ANNOUNCE that the button has a popup, but the popup never opens through AT activation. The ARIA contract is broken (the menu claims interactive behaviour it doesn't deliver).
3. **Touch-device users** — iOS Safari and Android Chrome on phones/tablets do NOT generate `mouseenter` events on tap. The menu is completely unreachable for the entire mobile user population.

The WCAG 2.1 Level A criterion 2.1.1 "Keyboard" requires that "all functionality of the content is operable through a keyboard interface" — the App Info menu (containing the version display + operator-configured links + community shortcuts) is content; it is operable; therefore it must be keyboard-accessible. The current implementation fails this criterion.

For an open-source platform with public-internet deployments, ACCESSIBILITY-COMPLIANCE may be a legal obligation depending on the operator's jurisdiction (US Section 508 / Rehabilitation Act / ADA Title III; EU EN 301 549; UK Public Sector Bodies Regulations). The maintainer cannot know which operators have legal obligations, so the defensive baseline is WCAG 2.1 Level A compliance for all chrome.

**Operator-visible impact**:
- A platform admin running a screen-reader cannot reach the version display (needed for bug reports).
- A mobile-tablet user cannot reach the operator-configured links (which may be runbooks they need to act on incidents).
- A keyboard-only user cannot reach the Documentation / Slack shortcuts.

**Evidence**:
- AppInfoMenu.tsx:78-82 (the button declaration with `aria-haspopup`, `aria-controls`, `onMouseEnter` — but NO `onClick`, `onKeyDown`, `onFocus`)
- AppInfoMenu.tsx:29-31 (`handleAppMenuOpen` — wired only to `onMouseEnter`)
- AppInfoMenu.tsx:33-35 (`handleAppMenuClose` — invoked via `PaperProps.onMouseLeave`; no symmetric keyboard-close handler)
- WCAG 2.1 SC 2.1.1 ([w3.org/TR/WCAG21/#keyboard](https://www.w3.org/TR/WCAG21/#keyboard)) — the canonical criterion

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-234 NEW this batch codifies the App Info menu's five-surface consolidation. The implied accessibility prescription is the ARIA attributes themselves — by setting `aria-haspopup='true'` + `aria-controls`, the author committed to the contract that the button is interactive in an accessible way; the contract is currently broken.

**Proposed remedy**: Add `onClick` and `onKeyDown` handlers to the icon button:

```tsx
<IconButton
  aria-label="App Info"
  aria-haspopup="true"
  aria-controls={menuId}
  aria-expanded={Boolean(anchorEl)}
  onClick={handleAppMenuOpen}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleAppMenuOpen(e);
    }
  }}
  onMouseEnter={handleAppMenuOpen}
>
  <InfoIcon />
</IconButton>
```

Add a symmetric keyboard-close handler (Escape key closes the menu — MUI Menu provides this by default once `onKeyDown` is wired). Also consider adding `aria-expanded` to honour the open/closed state. Effort: 30 minutes. The fix preserves the existing hover-activation UX while adding the missing keyboard + touch + AT paths.

A more involved fix would be a click-also-opens variant where the hover behaviour is preserved on desktop but click is the canonical activation across all device types; the codebase already has this pattern in other menus (the user-account menu at `AppToolbar.tsx:68-82` uses `onClick={handleProfileMenuOpen}`, so the pattern is consistent in the codebase elsewhere).

**Severity rationale**: MEDIUM — accessibility-compliance gap; affects screen-reader, keyboard, and mobile users. Not HIGH because the affected content (version, doc shortcuts, operator links) is not critical-path; the operator-configured links may carry runbook URLs which IS critical-path under incident response, but the user can also access them via the docs or via the configured-source. Not LOW because WCAG Level A violations are a baseline compliance obligation for any public-facing OSS UI.

**Suggested backlog grouping**: `Accessibility hardening sprint` — couple with other ARIA / keyboard / mobile gaps surfaced across the chrome. The AppInfoMenu is likely not the only such gap.

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-234 NEW (AppInfoMenu five-surface consolidation — the architectural choice that makes this gap span 5 surfaces simultaneously).
- SUPERSEDES: none.
- CONFLICTS: none.

---
