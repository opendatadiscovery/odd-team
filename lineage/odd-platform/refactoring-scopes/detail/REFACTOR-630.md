## REFACTOR-630 — Neither the backend nor the UI validates URL scheme on `odd.links[].url` — an operator can configure `javascript:` or `data:text/html,...` URLs; React 17+ neutralises `javascript:` at runtime but `data:` URLs pass through

**Severity**: MEDIUM
**Category**: missing-validation (UI; URL-scheme allowlist)
**Pillars affected**: [P-06 Configuration & Deployment, P-09 Security & Access Control]
**Batch**: ZE (2026-05-25)

**Surfaced by**:
- `odd-platform__java__LinksController__controller-class__LinksController.md:bugs_limitations_corner_cases.[2]` (MEDIUM) — "Neither the backend nor the UI validates URL scheme — operator can configure `javascript:` or `data:` URLs. React 17+ neutralises `javascript:` in <a href>, but `data:text/html,...` and `vbscript:` are still passed through to the DOM in some browsers. No allowlist of schemes." — evidence: AdditionalLinkProperties.java:8 (`record Link(String title, String url)` — no `@URL` constraint, no `@Pattern`) + LinksController.java:31-33 (passthrough map)
- `odd-platform__java__LinksController__controller-class__LinksController.md:docs_link_semantic.doc_drift_findings.[1]` — "Doc claims 'absolute URL' — code does NOT validate the URL scheme; `javascript:alert(1)` or `data:` URLs would be passed unsanitised to the UI's <a href>."
- `odd-platform__java__LinksController__controller-class__LinksController.md:security.known_security_gaps.[1]` — confirms the gap

**Description**: `AdditionalLinkProperties.Link` is a record with `(String title, String url)` and NO validation annotations (`@URL`, `@Pattern`, etc.). The `LinksController.getLinks` passes the `url` field through verbatim to the response payload. The UI's `AppInfoMenu` renders it as:
```tsx
<Link key={link.url} to={link.url} target='_blank'>
  {link.title}
</Link>
```

The `to={link.url}` attribute renders as a raw `href="..."` on the underlying `<a>` element. Without scheme validation, an operator can configure:

| URL scheme | Behaviour |
|---|---|
| `https://...` | Normal; opens in new tab |
| `http://...` | Normal; opens in new tab |
| `javascript:alert(1)` | **Click fires `alert(1)` in the ODD Platform's origin** (browser-version-dependent; React 17+ neutralises this at runtime by replacing the URL with a noop, but only for `<a>` rendered via `dangerouslySetInnerHTML` or in some Server Side Rendering paths) |
| `data:text/html,<script>...</script>` | Click opens a new tab with the data URL; the script executes in the data: origin (separate from ODD Platform's origin, so cross-origin restrictions limit harm — but the content can still phish / steal clipboard / harvest credentials |
| `vbscript:...` | Legacy IE only; ignored in modern browsers but admitted by config validation |
| `file:///etc/passwd` | Browser-blocked for cross-origin but admitted by config |
| `chrome://settings` | Chrome-specific; admitted by config |

**The threat model**:
- **Operator-typo**: operator typos `httpx://internal-wiki` and the link silently breaks (no error feedback to the operator — the link clicks lead nowhere).
- **Operator-misconfig**: operator copy-pastes a `javascript:` snippet from a developer console output (`javascript:document.title='Test'`) into a URL field; the link clicks fire arbitrary JS in the ODD Platform's origin.
- **Operator-malicious**: an operator with edit access to `odd.links` config deliberately configures a `data:text/html` URL with phishing content. Users clicking it land on the phishing page in a new tab; the new tab may LOOK like ODD Platform (the data URL can mimic the UI).
- **Compromised config-source**: a kubectl-edit or ConfigMap mutation by an attacker (not operator) introduces the malicious URL.

**Browser-side defences (the safety net)**:
- React 17+ sanitises `javascript:` URLs in `<a href>` at runtime by emitting a warning and replacing the URL with a noop. The defence is reactive (the click does nothing) but the warning is dev-mode only.
- Modern browsers (Chrome 89+, Firefox 80+) restrict `data:` URLs in top-level navigation (the URL works for `<img>`, `<script>`, but not for `<a target="_blank">`). The restriction is browser-version-dependent.
- Content-Security-Policy (CSP) headers can block `javascript:` and `data:` URLs entirely. The ODD Platform's CSP posture is not enumerated this pass (likely deferred to a separate sidecar / probe).

**The defence-in-depth fix**:
- Backend validation rejects non-`http(s)` URLs at boot (Spring `@URL` or `@Pattern(regexp = "^https?://...")`).
- UI validation rejects unknown schemes at render-time (a `validateUrlScheme(url)` helper that returns null for non-`http(s)`).

**Primary source citations**:
- `AdditionalLinkProperties.java:8` (`record Link(String title, String url)` — no constraints)
- `LinksController.java:31-33` (the passthrough map)
- `AppInfoMenu.tsx:60-66` (the rendering — no scheme check)
- WebFetched ODD doc page — promises "absolute URL" but does not enforce
- Cross-link [OWASP URL Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html#url-validation)

**Existing-ADR-or-implied-prescription**: none. The platform's input-validation conventions for operator config (per ADR-CANDIDATE-024 — configuration property naming) implicitly trust operators to configure safe values; this URL surface is one where the trust assumption breaks because the URLs are rendered into user-facing HTML.

**Proposed remedy**: Two-path:

1. **Backend validation** — add `@URL(protocol = "http", regexp = "...")` annotation to `AdditionalLinkProperties.Link.url`; enable `@Validated` on the @ConfigurationProperties class. Boot fails with a clear error if any URL has a non-`http(s)` scheme. Recommended for defense-in-depth.

2. **UI validation** — `AppInfoMenu.tsx` adds a `validateUrlScheme(url)` helper that returns `null` for non-`http(s)` URLs; non-validating URLs render as plain text or are filtered out. Recommended as the user-facing safety net.

Both should be applied; the backend stops bad configs at boot, the UI stops bad configs at render.

**Severity rationale**: MEDIUM — non-zero security risk bounded by the threat model (operator-malicious / compromised config). React 17+ and modern browsers provide significant defences-in-depth; the platform's CSP posture (not enumerated) adds another layer. The fix is straightforward; the cost-vs-benefit is favourable.

**Suggested backlog grouping**: `UI security hygiene sprint` — couple with REFACTOR-629 NEW (reverse tabnabbing — sibling on the same surface), REFACTOR-218 (markdown XSS at the rendering layer — sibling pattern).

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-629 NEW (sibling on the same operator-link surface — the two compound — a non-`http(s)` scheme + no `rel='noopener'` is the worst-case path).
- SUPERSEDES: none.
- CONFLICTS: none.

---
