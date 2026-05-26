# SHB-151 — App Info menu is hover-only and keyboard-inaccessible despite ARIA claims

**Category**: open
**Severity**: MEDIUM

## Hypothesis

Operators using keyboard-only navigation (or screen readers, or touch devices like tablets/phones) cannot open the App Info menu — the icon button only wires `onMouseEnter` and offers no `onClick`, `onKeyDown`, or `onFocus` handler. The button declares `aria-haspopup='true'` and `aria-controls={menuId}`, implying keyboard activation works — but the menu cannot actually be opened by Enter / Space, only by mouse hover. Touch users (iOS Safari, Android Chrome) generate no mouseenter on the icon and are completely locked out of the menu's contents: project version, GitHub link, Documentation / Slack / Feedback shortcuts, and any operator-configured `odd.links[]`.

## Evidence

- `odd-platform-ui/src/components/shared/elements/AppToolbar/AppInfoMenu/AppInfoMenu.tsx:78-82` — IconButton declares `aria-haspopup='true'`, `aria-controls={menuId}`, but only `onMouseEnter={handleAppMenuOpen}` is wired.
- `odd-platform-ui/src/components/shared/elements/AppToolbar/AppInfoMenu/AppInfoMenu.tsx:29-31` — `handleAppMenuOpen` is the only handler; no onClick / onKeyDown / onFocus path.
- WCAG 2.1 SC 2.1.1 (Keyboard) violation per AppInfoMenu sidecar bug #2.

## Notes

- The ARIA attributes are a "type-system lie" — they claim keyboard-popover semantics that the implementation does not provide.
- On touch devices the menu is COMPLETELY UNREACHABLE — there's no equivalent gesture to mouseenter; the user simply cannot access version, docs, or operator-configured links from a phone/tablet.
- Fix is trivial: add `onClick={handleAppMenuOpen}` and the menu becomes touch-and-keyboard reachable. The icon already has visible affordance.
- Accessibility class, not exploit class — but a real operator-impact issue for assistive-tech users and for the increasing share of catalog browsing happening from mobile.
- guess: an a11y audit (axe-core / Lighthouse) on the ODD Platform SPA would flag this immediately — worth running.

## Next

1. Add onClick handler to IconButton — one-line fix.
2. Run axe-core / Lighthouse on the SPA to enumerate other a11y gaps (probably many — zero accessibility audit history visible).
3. File a backlog item titled "App Info menu — keyboard/touch accessibility (WCAG 2.1 SC 2.1.1)".

## Links

- cluster_with: [F-041]
- merged_into: (open)
- supersedes: []
