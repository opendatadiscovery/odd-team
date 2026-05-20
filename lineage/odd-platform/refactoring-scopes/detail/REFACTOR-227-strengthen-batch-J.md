## REFACTOR-227 — STRENGTHENED by batch J (UI-side primary-source: useTermWiki.handleMarkdownChange has NO permission check around mention parse + lookup; the writer-side bypass is end-to-end unguarded)

This file appends batch-J primary-source confirmations to REFACTOR-227 ("Description-update side-effect bypasses `DATA_ENTITY_ADD_TERM` permission via `[[ns:term]]` injection"). Originally batch-G evidenced (backend); batch J adds the UI-side primary source confirming the writer-side flow has zero permission gating around the term-resolution + auto-link path.

**Batch J new surfaced_by**:
- `DataEntityDescription.md:security.known_security_gaps[3]` (|-
    "**Term-mention auto-link gives effectively-anonymous-writer (under DISABLED) implicit `term_relations` write access** — UI half is unable to prevent this; the backend grants the term-relation row on every description write regardless of `DATA_ENTITY_ADD_TERM` (per batch-G sidecar `upsertDataEntityInternalDescription.md:security.known_security_gaps[3]`). The UI surfaces the lookup result inline but does NOT validate the writer's permission to add terms BEFORE allowing the save. The UI is a passive participant; the actual gap is at the backend.")
- `DataEntityDescription.md:operations.resolve-term-mentions-on-change` (|-
    "for each `TERM_PATTERN` match in the current editor value, `handleMarkdownChange` (`useTermWiki.ts:103-130`) calls `useGetTermByNamespaceAndName` ONCE per unique term (cached in `fetchedTerms` / `unsuccessfulTerms`); a failed lookup sets `error = 'Term {termName} not found in namespace {namespaceName}'`")

**Updated evidence chain**:

The DATA_ENTITY_ADD_TERM bypass via description-update is now end-to-end primary-source confirmed:
1. **UI side (NEW batch-J primary source)**: `useTermWiki.ts:103-149` parses `[[ns:term]]` matches and calls `useGetTermByNamespaceAndName` for each unique mention. The UI does NOT consult the writer's `DATA_ENTITY_ADD_TERM` permission before performing the lookup OR before saving the description with the embedded mention.
2. **Backend side (existing batch-G primary source)**: `upsertDataEntityInternalDescription` saves the description; the term-relation row is inserted by the description-side-effect handler in `TermServiceImpl` regardless of the writer's `DATA_ENTITY_ADD_TERM` permission.

The UI WiTH the writer:
- Author description body: gated by `DATA_ENTITY_DESCRIPTION_UPDATE` (the Edit button gate per ADR-CANDIDATE-089).
- Embed `[[ns:term]]` mentions: NO gate (the UI parses freely).
- Save: gated by `DATA_ENTITY_DESCRIPTION_UPDATE` (the same Edit gate).
- Term-relation rows: NO `DATA_ENTITY_ADD_TERM` gate at either layer.

A writer with `DATA_ENTITY_DESCRIPTION_UPDATE` but NOT `DATA_ENTITY_ADD_TERM` can effectively grant terms by including `[[ns:term]]` mentions in the description. The permission split is meaningless for this path.

**Updated severity**: MEDIUM (unchanged). The UI-side confirmation reinforces the gap but the structural fix lives at the backend (the term-attach side-effect must consult `DATA_ENTITY_ADD_TERM` before inserting term_relations rows).

**Composes with**:
- ADR-CANDIDATE-090 (Glossary `[[ns:term]]` syntax) — the architectural commit codifies the textual-mention pattern; REFACTOR-227 is the resulting permission-bypass gap
- ADR-CANDIDATE-089 (partial UI permission gating) — the writer-side gate is on Edit-button only; the term-attach side-effect bypasses an unrelated permission
- REFACTOR-283 (UI vs backend regex divergence) — a related dual-driver issue

---
