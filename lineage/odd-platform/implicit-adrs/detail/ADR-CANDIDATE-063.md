## ADR-CANDIDATE-063 — Description / internal_name fields are stored as raw Markdown / free-text with no backend transformation; UI is the sole renderer

**Severity**: MEDIUM
**Classification**: promote
**Support count**: 1 sidecar (load-bearing — primary write surface; cross-ref to controller-level sidecar)
**Axes present**: controllers, services, repositories
**Surfaced by**:
- `upsertDataEntityInternalDescription.md:implicit_adrs[0]` ("Description is stored as raw Markdown / free-text with no backend transformation — the platform delegates rendering entirely to the UI.")
- `upsertDataEntityInternalDescription.md:concepts.invariants[3]` (no backend sanitisation; `text` column unbounded; UI uses `@uiw/react-markdown-preview` with `rehype-raw`)

**Decision statement**: The internal_description field is stored as the raw Markdown text the client submits — no server-side transformation, no HTML escape, no length cap, no sanitisation. The OpenAPI summary at `openapi.yaml:929-930` explicitly states "in markdown format." Rendering is entirely the UI's responsibility (`@uiw/react-markdown-preview` + `rehype-raw`). The platform's storage layer treats the description as opaque text — only the term-linker (`[[ns:term]]`) regex inspects content for side effects (term relations). The architectural decision is: descriptions are a UI-rendered surface; the platform does not interpret their content beyond the term-linker.

**Evidence**:
- `upsertDataEntityInternalDescription.md` says: "the OpenAPI description states the format intent inline" (`openapi.yaml:929-930` — "Upserts DataEntity's internal description in markdown format")
- `upsertDataEntityInternalDescription.md` says: "`setInternalDescription` is `DSL.update(DATA_ENTITY).set(INTERNAL_DESCRIPTION, …)` — writes verbatim, normalising only empty-string-to-null"

**Rationale (wisdom test 3-question)**:
1. *Intentional?* YES — explicit in the OpenAPI summary ("in markdown format"). The decision is stated.
2. *Structural impact?* YES — affects the rendering pipeline, the search-index processing (FTS weight B), the activity-feed payload shape, and the trust boundary (UI renderer is the sole interpreter).
3. *Refactoring or structural?* STRUCTURAL — switching to "server-rendered HTML" or "AST stored" would be a major redesign.
→ ADR-CANDIDATE for the storage-format intent.

**Note on split**: the no-sanitisation absence is a separate GAP-shaped concern (REFACTOR-218 — stored-XSS surface). The ADR is "we store Markdown raw"; the gap is "but we should also sanitise it." Per the prompt's split-rule, ADR-CANDIDATE-063 captures the intent; REFACTOR-218 captures the absent defence.

**Existing ADR**: none; mentioned in batch-F sidecars indirectly via the activity-feed-leakage finding.

**Proposed action**: Promote to `adrs/drafts/data-entity-description-markdown-storage.md`. The ADR should articulate the intent (Markdown is the contract; UI is the renderer; term-linker is the sole content interpreter) and separately reference REFACTOR-218 as the defence-in-depth gap the ADR does not absolve.

**Severity rationale**: MEDIUM — pattern-shaping decision affecting the largest free-text write surface in the platform; structurally significant because the trust-boundary placement (UI = sole renderer) is the architecture, not an implementation detail.

---
