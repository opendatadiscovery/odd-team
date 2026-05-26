# SHB-166 — All Markdown rendering in ODD Platform UI lacks rehype-sanitize; defence-in-depth depends on Chromium HTML-parser policy

**Category**: clustering
**Severity**: HIGH

## Hypothesis

Every Markdown surface in the ODD Platform UI — entity descriptions, dataset-field descriptions, term definitions, query examples, alert messages, owner descriptions, in-app discussion messages — renders user-authored content through `@uiw/react-md-editor`'s default rehype pipeline which INCLUDES `rehype-raw@6.1.1` (raw HTML passes through) but EXCLUDES `rehype-sanitize` (no allowlist filter). Probe P-009 empirically confirms `<script>`, `<img>`, `<iframe>` tags reach the rendered DOM. Event-handler attributes (`onerror=`) are stripped by React's attribute filter, and script execution is closed by Chromium's HTML-parser policy of NOT executing scripts inserted via innerHTML — but those are EXTERNAL defences, not application-layer ones. A future code change (switching to `dangerouslySetInnerHTML`, relaxing CSP, adopting an SVG payload using `onload`, migrating off React) re-opens the surface invisibly.

## Evidence

- `odd-platform-ui/src/components/shared/elements/Markdown/Markdown.tsx:112-124` — `<MDEditor.Markdown components={{...}} source={value} wrapperElement={...} disableCopy={...} />` — no `rehypePlugins` override.
- `odd-platform-ui/pnpm-lock.yaml:5911-5938` — `rehype-raw@6.1.1` IS in the dep tree; `rehype-sanitize` is NOT (verified `grep -rln 'rehype-sanitize' odd-platform-ui` → 0 matches).
- `lineage/odd-platform/probes/P-009.yaml:147-167` — assertions `dom_has_script_tag == True`, `dom_has_xss_img_id == True`, `dom_has_xss_iframe_id == True`, `dom_has_onerror_attr == False`, `xss_dialog_fired == 0`, `xss_leak_count == 0` (Chromium policy + React attribute filter both engaged).
- F-004 (Entity Description Editing) captures the description-cluster instance; THIS thread is the CROSS-CUTTING PLATFORM-WIDE finding — every other Markdown surface inherits the same posture.

## Notes

- The Markdown wrapper is the SOLE renderer for: entity descriptions, dataset-field descriptions, term definitions, query examples, alerts, owner descriptions, discussion messages, attachments display, integration preview.
- Fix is ONE FILE: add `rehypePlugins={[[rehypeSanitize, schema]]}` to `Markdown.tsx:112-124`. The npm install + schema authoring is one PR.
- Per-surface trade-off: rehype-sanitize strips `<script>` and `<iframe>` AND can strip attributes like `title` (used to carry term-mention tooltip definitions); the schema must allowlist the platform's known-safe extensions.
- F-004 has the description-cluster anchor; this thread is the PLATFORM-WIDE generalisation that the doc-gap-finder and feature-flow-builder need to see as one cross-feature issue, not 8 separate ones.
- For deployments where untrusted users can write descriptions (multi-tenant SaaS), the lack of sanitisation is a HIGH-severity stored content-injection vector.
- Operators have no documented surface that warns them about the XSS posture; this is also a Cornerstone-3 caveat doc-gap.

## Next

1. Add `rehype-sanitize` to the shared `Markdown.tsx` — one file change + schema.
2. Verify every dependent surface still renders correctly (term-definition tooltips, query example syntax highlight, etc.).
3. DOC-NNN: file "XSS defence posture — operator must enforce trusted-writer policy" caveat.
4. Promote: ENRICHER to F-004 + reference the cross-cutting nature explicitly.

## Links

- cluster_with: [F-004, SHB-167, SHB-168]
- merged_into: (open)
- supersedes: []

## evaluation

- **feature-flow-builder 2026-05-26**: cluster — F-004 (Entity Description Editing) is P-01 Data Discovery (CROSS-PILLAR outside H1 slice). This thread is also distinct from F-004 (which covers the description-surface instance); the platform-wide Markdown XSS posture is a CROSS-PILLAR cross-cutting concern spanning P-01 (descriptions), P-06 (glossary terms), P-07 (discussion messages + alert messages), P-02 (query examples), P-08 (owner descriptions). Strong graduation candidate as "Stored XSS Surface Audit" — but the pillar anchoring is ambiguous (5 plausible pillars). Marking `sme_consultation_recommended` because the right home is a maintainer decision: either supersede F-004's existing markdown facet with a platform-wide cross-pillar feature, OR keep it as a Cornerstone-3 caveat across N doc-gaps. Defer to maintainer triage with the P-009 probe evidence as the strong empirical anchor. HIGH severity but cross-pillar.

**SME consultation recommended**: true — pillar anchoring ambiguous (P-01 / P-06 / P-07 / P-02 / P-08 all plausible homes); maintainer decides whether to graduate as a cross-cutting "Stored XSS Surface Audit" feature OR keep as N doc-gap caveats anchored on each pillar's content surface.
