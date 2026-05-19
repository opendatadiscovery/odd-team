## REFACTOR-284 — `[[Namespace:TermName]]` term-mention syntax is undocumented in the public docs; the InformationIcon tooltip at `InternalDescriptionHeader.tsx:22-28` is the ONLY operator-facing documentation; the Shift+Enter save shortcut is undocumented anywhere; the side-effect that mentioning a term auto-creates a term_relations row bypassing DATA_ENTITY_ADD_TERM is undocumented

**Severity**: MEDIUM
**Category**: missing-doc + doc-code-drift
**Pillars affected**: [P-01, P-06] — Discovery × Glossary
**Surfaced by**:
- `DataEntityDescription.md:docs_link_semantic.doc_drift_findings` (|-
    "**DOC-GAP candidate**: the `[[Namespace:TermName]]` term-mention syntax is platform-specific and the ONLY operator-facing documentation of it is the InformationIcon tooltip at `InternalDescriptionHeader.tsx:22-28`. No public doc page covers the syntax, its precedence rules, what happens on lookup failure (the inline 'Term {termName} not found in namespace {namespaceName}' error), or the side effect that mentioning a term auto-creates a `term_relations` row regardless of `DATA_ENTITY_ADD_TERM` permission.")
- `DataEntityDescription.md:docs_link_semantic.doc_drift_findings.shift-enter` (|-
    "**DOC-GAP candidate**: the Shift+Enter save-shortcut (`useTermWiki.ts:179-184`) is undocumented in the operator tooltip OR any keyboard-shortcut reference page.")
- `DataEntityDescription.md:docs_link_semantic.doc_drift_findings.markdown-pipeline` (|-
    "**DOC-GAP candidate**: the Markdown rendering pipeline (using `@uiw/react-md-editor` / `@uiw/react-markdown-preview` + `rehype-raw` without `rehype-sanitize`) is undocumented for operators. An operator evaluating ODD for a multi-tenant deployment where untrusted users can write descriptions has no documented surface to learn the XSS-defence posture.")
- `DataEntityDescription.md:docs_link_semantic.doc_drift_findings.partial-gating` (|-
    "**DOC-GAP candidate**: the partial-gating behaviour (Edit button gated by `DATA_ENTITY_DESCRIPTION_UPDATE`, but description CONTENT rendered to every `DATA_ENTITY_VIEW` caller) is undocumented.")

**Description**: Four documentation gaps cluster around the entity description feature surface:

1. **`[[Namespace:TermName]]` syntax** — operator-facing documentation lives ONLY in the InformationIcon tooltip at `InternalDescriptionHeader.tsx:22-28`. No public doc page on docs.opendatadiscovery.org covers:
   - The exact syntax.
   - The precedence rules (what happens with nested brackets, escaped characters).
   - The lookup-failure behaviour (the inline "Term {termName} not found" error).
   - The CRITICAL side-effect: mentioning a term in a description AUTO-CREATES a `term_relations` row regardless of `DATA_ENTITY_ADD_TERM` permission (the REFACTOR-227 permission-bypass surface).

2. **Shift+Enter save shortcut** — `useTermWiki.ts:179-184` implements the shortcut but it is undocumented in the operator tooltip OR any keyboard-shortcut reference page. Power-user feature with zero discoverability.

3. **Markdown rendering pipeline** — uses `@uiw/react-md-editor` + `rehype-raw` WITHOUT `rehype-sanitize` (the REFACTOR-218 stored-content-injection / XSS-defence-in-depth surface). An operator evaluating ODD for a multi-tenant deployment has no documented surface to learn the XSS-defence posture or the dependency-in-depth Chromium/React mitigations.

4. **Partial permission gating** — `DATA_ENTITY_DESCRIPTION_UPDATE` is documented as gating "editing and deleting a data entity's custom description," but the live Permissions page does NOT explain that the VIEW side has no separate permission — the description is effectively cross-owner-readable through the rendered Markdown (the ADR-CANDIDATE-089 partial-gating posture).

**Primary source citations**:
- `InternalDescriptionHeader.tsx:22-28` (tooltip-only doc)
- `useTermWiki.ts:179-184` (Shift+Enter)
- `Markdown.tsx:112-124` (no rehype-sanitize)
- `InternalDescriptionPreview.tsx:21` (unconditional content render)
- Live doc pages — no coverage of any of these surfaces

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-090 codifies the syntax (newly minted in batch J); ADR-CANDIDATE-089 codifies the partial-gating posture. Both need public-doc-product surfaces (DOC-NNN items).

**Proposed remedy**: Four DOC-NNN follow-ups (track via `playbooks/follow-up-on-disk.md`):
1. DOC-NNN — Glossary syntax page: document `[[Namespace:TermName]]` + precedence + lookup-failure UX + the DATA_ENTITY_ADD_TERM bypass caveat.
2. DOC-NNN — Keyboard shortcuts page: catalogue every shortcut (Shift+Enter, Cmd+S, etc.) — likely needs UI-side audit to enumerate all shortcuts first.
3. DOC-NNN — Markdown rendering caveat: document the XSS defence-in-depth posture (REFACTOR-218 + ADR), the rehype-raw default, the dep-on-Chromium/React mitigations, the multi-tenant deployment guidance.
4. DOC-NNN — Permissions page extension: document the view-vs-edit asymmetry on every permission key (DATA_ENTITY_DESCRIPTION_UPDATE, DATA_ENTITY_INTERNAL_NAME_UPDATE, DATA_ENTITY_GROUP_UPDATE, DATA_ENTITY_STATUS_UPDATE) — clarify that VIEW always implies content read regardless of write permission.

**Severity rationale**: MEDIUM — doc gaps for operator-facing power-user features + multi-tenant evaluation criteria. Each is reachable via routine operator self-discovery; the fix is doc-product authoring sprint.

**Suggested backlog grouping**: `Doc completeness sprint` (specifically the Glossary + Permissions + Markdown-rendering sub-sprint).

---
