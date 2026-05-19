## ADR-CANDIDATE-090 — Glossary terms are linked from descriptions via the platform-specific `[[Namespace:TermName]]` syntax, NOT via a separate term-attach UI control — operators discover the contract via the InformationIcon tooltip in the editor

**Severity**: MEDIUM
**Classification**: promote
**Support count**: 1 sidecar primary-source (DataEntityDescription) + cross-batch with batch-G `upsertDataEntityInternalDescription` (the backend half)
**Axes present**: ui_components, ui_hooks
**Pillars affected**: [P-01, P-06] — Data Discovery × Data Glossary

**Surfaced by**:
- `DataEntityDescription.md:implicit_adrs[0]` (|-
    "The platform uses `[[Namespace:TermName]]` syntax to link Glossary terms from description bodies — terms are assigned BY THE DESCRIPTION TEXT, not via a separate term-attach control on the UI." — intent_anchor: the verbatim tooltip text "You can link an existing term by entering information about the term according to the pattern [[NamespaceName:TermName]]" at `InternalDescriptionHeader.tsx:22-25`)

**Decision statement**: ODD's Glossary integration into entity descriptions uses a **textual-mention syntax** as the SOLE attachment mechanism: an operator writes `[[Namespace:TermName]]` inside the description body; the UI's `useTermWiki` hook (`useTermWiki.ts:30-228`) parses the syntax via the regex `TERM_PATTERN = /\\[\\[([^:\\]]+):([^\\]]+)\\]\\]/g` (`lib/constants.ts:177`), resolves each match against `GET /api/terms/namespaces/{namespaceName}/names/{termName}`, and at render time substitutes the token with a Markdown link `[name](termPath "definition")`. The backend on save reads the same syntax in the persisted description, walks the regex, and inserts `term_relations` rows binding the entity to each resolved term.

The team rejected two alternatives:
- **(a) Dedicated term-attach UI control** (e.g. a side-panel autocomplete to attach a Term entity to the current Data Entity) — would require a separate `DATA_ENTITY_ADD_TERM` permission gate, a separate API call, a separate UI surface.
- **(b) Markdown-link convention** (`[Term Name](/glossary/term-id)`) — would require operators to know term ids and would couple the description to URL structure.

The chosen syntax is documented to operators in EXACTLY ONE place: the InformationIcon tooltip at `InternalDescriptionHeader.tsx:22-28` — the verbatim text "You can link an existing term by entering information about the term according to the pattern [[NamespaceName:TermName]]" is the entire user-facing contract.

Consequences encoded:
- **(a) Description editing IS term-attachment** — `DATA_ENTITY_DESCRIPTION_UPDATE` is the implicit permission for adding terms. The separate `DATA_ENTITY_ADD_TERM` permission exists in the model but does NOT gate the syntax-driven path (batch-G + this batch primary-source REFACTOR-227).
- **(b) The UI regex is STRICTER than the backend regex** — UI requires non-empty groups (`[^:\\]]+`); backend allows empty groups (`[^:]*?:[^\\]]*?`). The asymmetry produces silent surprises (`[[:foo]]` ignored by UI, partially parsed by backend).
- **(c) Term resolution is per-keystroke** — every editor keystroke scans for matches and fires `GET /api/terms/namespaces/{ns}/names/{name}` for new unique terms; cached in `fetchedTerms` / `unsuccessfulTerms` maps.
- **(d) Unresolved mentions render verbatim** — at preview time, terms not in `fetchedTerms` show as raw `[[ns:term]]` text; inline error appears only during editing.

**Wisdom test (3-question)**:
1. *Intentional?* YES — the `useTermWiki` hook name and the `TERM_PATTERN` top-level constant + the operator-facing tooltip are all explicit. The maintainer chose the textual-mention syntax deliberately.
2. *Structural impact?* YES — defines how Glossary integrates with Discovery; affects the OpenAPI contract (`InternalDescription.terms: List<LinkedTerm>`), the backend regex implementation, the activity log shape (`TERM_ASSIGNMENT_UPDATED` events fire on description-driven mutations).
3. *Refactoring or structural?* STRUCTURAL — switching to a dedicated term-attach control would change the API contract, the permission model, and the UI surface.
→ ADR.

**Evidence**:
- DataEntityDescription.md says: "the verbatim tooltip text 'You can link an existing term by entering information about the term according to the pattern [[NamespaceName:TermName]]' at `InternalDescriptionHeader.tsx:22-25`"
- DataEntityDescription.md says: "`useTermWiki.ts:30-228` (the hook is named `useTermWiki` and is the cluster's central abstraction)"
- intent_anchor: the InformationIcon tooltip IS the operator-facing contract

**Existing ADR**: none. Composes with:
- **ADR-CANDIDATE-088** (WithPermissions context primitive) — the Edit button gating uses this primitive but the term-attach side-effect bypasses it (REFACTOR-227)
- **ADR-CANDIDATE-089** (partial permission gating) — the description content IS the term-attach surface; the partial-gating means anyone with `DATA_ENTITY_DESCRIPTION_UPDATE` can implicitly grant terms

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-227 (existing — description-update side-effect bypasses `DATA_ENTITY_ADD_TERM` permission via `[[ns:term]]` injection — STRENGTHENED with UI-side primary-source: `useTermWiki.ts:103-149` has no permission check around mention parse + lookup)
- REFACTOR-283 (NEW — UI vs backend regex divergence: UI requires non-empty groups, backend allows empty; descriptions like `[[:foo]]` render verbatim in UI but partially parse on backend)
- REFACTOR-284 (NEW — Tooltip is the ONLY operator-facing documentation of the syntax; no public doc page covers the contract, the lookup-failure error, or the side-effect of bypassing DATA_ENTITY_ADD_TERM)

**Proposed action**: Promote to `adrs/drafts/glossary-term-mention-syntax-in-descriptions.md`. Document:
- The `[[Namespace:TermName]]` syntax and its tooltip-only documentation.
- The implicit term-attachment via description editing (no separate UI control).
- The regex divergence between UI (strict) and backend (lenient).
- The permission model (description-edit IS term-attach in practice; explicit `DATA_ENTITY_ADD_TERM` is a no-op for this path).
- The maintenance obligation: any UI doc-page covering Glossary OR Descriptions should describe the syntax.
- The migration path if the team ever adds a separate term-attach UI: the permission model needs explicit alignment.

**Severity rationale**: MEDIUM — pattern-shaping decision for the Discovery × Glossary intersection. Below HIGH because the syntax is feature-local rather than cross-cutting.

**Suggested backlog grouping**: `UI architecture codification` + `Doc completeness sprint` (the syntax needs public-doc coverage).

---
