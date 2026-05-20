## REFACTOR-218 — STRENGTHENED by batch J (UI-side primary-source confirmation: `@uiw/react-md-editor` → `rehype-raw@6.1.1` transitive; ZERO `rehype-sanitize` in pnpm-lock; permission gating PARTIAL — edit-gated, view unconditional)

This file appends batch-J primary-source confirmations to REFACTOR-218 ("Markdown / HTML description body stored verbatim without backend sanitisation; UI renders via `rehype-raw` without `rehype-sanitize` — stored-content-injection / potential stored-XSS"). Originally batch-G evidenced (backend persistence side); batch J adds the UI-side primary source pinning the rehype-pipeline absence at file:line precision.

**Batch J new surfaced_by**:
- `DataEntityDescription.md:invariants[0]` (|-
    "**No `rehype-sanitize` is configured anywhere in the UI** — verified by `grep -rln 'rehype-sanitize' <odd-platform-ui>/src` → 0 matches AND `grep 'rehype-sanitize' <odd-platform-ui>/pnpm-lock.yaml` → 0 matches. The `Markdown` wrapper passes ONLY `components`, `source`, `wrapperElement`, `disableCopy` to `MDEditor.Markdown` (`Markdown.tsx:112-123`); no `rehypePlugins` override is supplied, leaving `@uiw/react-markdown-preview@4.2.2`'s defaults active. Those defaults include `rehype-raw@6.1.1` (`pnpm-lock.yaml:5911-5926`) — which parses raw HTML embedded in Markdown into AST nodes that `react-markdown` then renders. The combined backend-no-sanitisation + UI-render-raw-HTML produces the stored-XSS surface F-004 documents.")
- `DataEntityDescription.md:bugs_limitations_corner_cases.no-rehype-sanitize` (verbatim of the above + cross-reference to P-009 empirical pinning)
- `DataEntityDescription.md:invariants[1]` (|-
    "**Permission gating is partial — only the Edit affordance is gated, NEVER the rendered content.** ... The `<Markdown value={value} />` render at `InternalDescriptionPreview.tsx:21` runs unconditionally for ANY caller with `DATA_ENTITY_VIEW`. The description CONTENT (and any embedded HTML) reaches every reader's browser regardless of whether they can edit it.")

**Updated primary-source citations**:
- `Markdown.tsx:112-124` — the rehype-pipeline absence
- `pnpm-lock.yaml:5911-5938` — the `@uiw/react-md-editor` → `@uiw/react-markdown-preview@4.2.2` → `rehype-raw@6.1.1` dependency chain (no `rehype-sanitize`)
- `grep -rln 'rehype-sanitize' <odd-platform-ui>/src` → 0 matches
- `grep 'rehype-sanitize' <odd-platform-ui>/pnpm-lock.yaml` → 0 matches
- Probe P-009 slice-5/-6 empirical pinning: `dom_has_script_tag == True`, `dom_has_xss_img_id == True`, `dom_has_xss_iframe_id == True`, `dom_has_onerror_attr == False`, `xss_dialog_fired == 0`, `xss_leak_count == 0` (defence-in-depth via Chromium HTML-parser + React attribute filtering)

**Updated severity**: HIGH (unchanged). The UI-side primary source CONFIRMS the dependency chain at lock-file precision; the defence-in-depth (REFACTOR-218 sub-finding) is empirically PROVEN by probe P-009 but RELIES on external mitigations (Chromium policy + React attribute stripping) — neither is the platform's own defence.

**Co-surfaced new finding**: ADR-CANDIDATE-089 (partial gating) PROVES the rendering pipeline is exercised UNCONDITIONALLY for every viewer — the partial-gating means the XSS surface is reachable end-to-end without a writer needing edit permission; ONE writer with `DATA_ENTITY_DESCRIPTION_UPDATE` (or anonymous under DISABLED) injects payloads that EVERY viewer's browser renders.

**Defence-in-depth fragility**: P-009 slice-6 measured that:
- TAGS reach DOM (script, img, iframe substrings present) — but
- Event-handler ATTRIBUTES are stripped (React's attribute filter)
- Script EXECUTION blocked (Chromium HTML-parser policy)

A future code change that re-opens the surface:
- Switching `<Markdown>` to `dangerouslySetInnerHTML` — re-enables script execution.
- Relaxing CSP — re-enables script execution.
- Adopting an SVG payload (`<svg onload="...">`) — bypasses the script-tag-via-innerHTML mitigation.
- Migrating to a non-React renderer — loses React's attribute filtering.

The fix shape is to add `rehype-sanitize` to the `Markdown` wrapper:
```tsx
<MDEditor.Markdown
  source={value}
  rehypePlugins={[[rehypeSanitize, customSchema]]}  // ← add this
  components={...}
/>
```
The customSchema must preserve the term-mention auto-link output (which uses `<a href title>` from the transform-to-Markdown step) while stripping dangerous tags and attributes.

**Cross-references**: REFACTOR-218 is the canonical stored-content-injection finding. Composes with:
- REFACTOR-227 (description-update side-effect bypasses DATA_ENTITY_ADD_TERM via [[ns:term]]) — the writer side also bypasses term-attach permissions
- ADR-CANDIDATE-089 (partial gating) — UI-side architectural commit
- ADR-CANDIDATE-090 (Glossary term-mention syntax) — the writer side surface
- Probe P-009 — empirical pinning at commit `ede5d277`

---
