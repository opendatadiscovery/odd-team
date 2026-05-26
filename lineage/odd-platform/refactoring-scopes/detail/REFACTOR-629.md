## REFACTOR-629 — `AppInfoMenu` renders operator-configured `odd.links` with `target='_blank'` but WITHOUT `rel='noopener noreferrer'` — every operator-configured URL can `window.opener` the ODD Platform tab to a phishing page (reverse tabnabbing)

**Severity**: MEDIUM
**Category**: missing-security-attribute (UI; reverse-tabnabbing)
**Pillars affected**: [P-06 Configuration & Deployment, P-09 Security & Access Control]
**Batch**: ZE (2026-05-25)

**Surfaced by**:
- `odd-platform__java__LinksController__controller-class__LinksController.md:bugs_limitations_corner_cases.[0]` (MEDIUM) — "UI renders operator-configured links with target='_blank' but WITHOUT rel='noopener noreferrer' (AppInfoMenu.tsx:61) — any URL the operator configures can use `window.opener` to navigate the ODD Platform tab to a phishing page (reverse tabnabbing). Since odd.links values are typically trusted internal URLs, the realistic threat is a compromised internal wiki; severity is non-zero but bounded by who controls the configured URLs."
- `odd-platform__java__LinksController__controller-class__LinksController.md:docs_link_semantic.doc_drift_findings.[0]` — "Doc says 'opening in a new tab' — code DOES set target='_blank' (AppInfoMenu.tsx:61) but does NOT set rel='noopener noreferrer'; doc fails to warn operators that arbitrary URLs they configure inherit a reverse-tabnabbing vector"
- `odd-platform__java__LinksController__controller-class__LinksController.md:security.known_security_gaps.[2]` — "UI does not set rel='noopener noreferrer' on target='_blank' link rendering — reverse tabnabbing vector from any operator-configured URL"

**Description**: The `AppInfoMenu` React component renders each operator-configured link as:
```tsx
// AppInfoMenu.tsx:60-66
<Link key={link.url} to={link.url} target='_blank'>
  {link.title}
</Link>
```

The `target='_blank'` opens the URL in a new tab. WITHOUT `rel='noopener noreferrer'`, the newly-opened page receives a non-null `window.opener` reference pointing at the ODD Platform tab. The opened page can then:

```javascript
// In the destination page's JavaScript:
window.opener.location = 'https://phishing.example.com/odd-login-fake'
```

— navigating the ODD Platform tab to an arbitrary URL. This is the classic "reverse tabnabbing" attack ([OWASP HTML5 Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html#tabnabbing)). The user clicks an `odd.links` URL, opens it in a new tab, switches back to the ODD Platform tab later — and discovers it has been silently redirected to a phishing page that asks for their credentials.

**The threat model**:
- Realistic: operator-configured URLs typically point at INTERNAL wikis / runbooks / dashboards. A compromised internal wiki page (compromised via XSS or stored-payload on the wiki itself) can use this vector.
- More realistic: an operator with edit access to `odd.links` config (e.g. via `kubectl edit configmap`) deliberately configures a malicious URL. Other users hitting the platform's toolbar then trigger the redirect on click.
- Less realistic: an operator who copies a public URL into `odd.links` from an untrusted source.

**The fix is one line in the UI** — add `rel='noopener noreferrer'`:
```tsx
<Link key={link.url} to={link.url} target='_blank' rel='noopener noreferrer'>
  {link.title}
</Link>
```

`noopener` blocks `window.opener` access; `noreferrer` additionally strips the Referer header (preventing the destination from seeing where the user came from). The two are the platform-recommended pair for `target='_blank'` ([MDN target=_blank security note](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/a#target)).

**Modern browser default**: Chrome 88+ / Firefox 79+ / Safari 12.1+ apply `noopener` semantics BY DEFAULT for `target='_blank'` links rendered from React's `<a>` elements (per the [HTML spec change in 2020](https://html.spec.whatwg.org/multipage/links.html#link-type-noopener)). HOWEVER:
- The `<Link>` component from `react-router-dom` may or may not pass-through `target='_blank'` to a raw `<a>` element; React's `<Link>` wrapper has its own semantics.
- Older browsers (or users with custom browser builds) do NOT apply the default; explicit `rel='noopener noreferrer'` is the platform-portable defence.
- The platform's own React linter / ESLint plugin should catch the missing attribute (the `react/jsx-no-target-blank` rule); the platform's build is presumably emitting a warning that's being ignored.

**Primary source citations**:
- `AppInfoMenu.tsx:60-66` (the rendering code with `target='_blank'` and no `rel`)
- `LinksController.java:25-36` + `AdditionalLinkProperties.java:6-9` (the backend that supplies the URLs — no scheme validation per REFACTOR-630)
- WebFetched ODD doc page `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform` — confirms the public-facing "opening in a new tab" promise but does not warn about the security implication

**Existing-ADR-or-implied-prescription**: none. The platform's React component conventions presumably enforce `rel='noopener'` via ESLint (`react/jsx-no-target-blank`); the `AppInfoMenu` either suppresses the rule or predates it. Sibling instance: any other React component rendering operator-configured URLs (the `WithFeature`-wrapped Slack-message-open link at `Message.tsx:59` — verify whether the same pattern recurs).

**Proposed remedy**: One-line UI fix:
1. Edit `AppInfoMenu.tsx:61` — add `rel='noopener noreferrer'` to the `<Link>` element.
2. Search the codebase for `target='_blank'` without `rel='noopener'` — apply the same fix to all sites (likely 2-5 occurrences).
3. Enable / un-suppress the ESLint `react/jsx-no-target-blank` rule to prevent regression.

The fix is local; no schema / API / service change.

**Severity rationale**: MEDIUM — non-zero security risk bounded by who controls the operator-configured URLs. The modern-browser-default `noopener` semantics softens the realistic impact (Chrome/Firefox/Safari users on recent versions are protected). The fix is one line; the cost-vs-benefit is overwhelmingly favourable.

**Suggested backlog grouping**: `UI security hygiene sprint` — couple with REFACTOR-630 NEW (no URL-scheme validation — javascript:/data: URLs pass through), other React `target='_blank'` sites.

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-630 NEW (sibling on the same operator-link surface — no scheme validation compounds the tabnabbing risk).
- SUPERSEDES: none.
- CONFLICTS: none.

---
