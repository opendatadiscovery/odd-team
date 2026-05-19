## REFACTOR-283 — UI vs backend regex divergence for `[[Namespace:TermName]]`: UI requires non-empty groups (`[^:\\]]+`), backend allows empty groups (`[^:]*?:[^\\]]*?`); descriptions with empty groups render verbatim in UI but partially parse on backend

**Severity**: LOW
**Category**: dual-driver-race + doc-code-drift
**Pillars affected**: [P-01, P-06] — Discovery × Glossary
**Surfaced by**:
- `DataEntityDescription.md:invariants` (|-
    "**Term-mention regex is STRICTER than the backend regex** — UI `TERM_PATTERN = /\\[\\[([^:\\]]+):([^\\]]+)\\]\\]/g` (`lib/constants.ts:177`) REQUIRES non-empty namespace AND non-empty term-name (character class `[^:\\]]+` forces ≥1 char excluding `:` and `]`); backend `Pattern.compile(\"\\\\[\\\\[([^:]*?):([^\\\\]]*?)\\\\]\\\\]\")` (`TermServiceImpl.java:67`) allows empty groups (non-greedy `*?` matches zero chars). A description containing `[[:foo]]` or `[[foo:]]` is auto-linked in the UI as a non-match (raw text passes through), while the backend's `findTermsInDescription` will still parse it (though with empty group it short-circuits in `handleDataEntityDescriptionTerms`). The asymmetry is a latent inconsistency.")
- `DataEntityDescription.md:bugs_limitations_corner_cases.regex-divergence` (cross-reference)

**Description**: The platform's `[[Namespace:TermName]]` term-mention syntax is parsed by TWO distinct regex implementations, with different semantics:

- **UI**: `TERM_PATTERN = /\\[\\[([^:\\]]+):([^\\]]+)\\]\\]/g` at `lib/constants.ts:177`
  - Character class `[^:\\]]+` is ONE-or-more characters excluding `:` and `]`.
  - REQUIRES non-empty namespace AND non-empty term-name.
  - `[[:foo]]` → NO MATCH → renders verbatim text.
  - `[[foo:]]` → NO MATCH → renders verbatim text.
  - `[[foo:bar]]` → MATCH → namespace="foo", term-name="bar".

- **Backend**: `Pattern.compile("\\\\[\\\\[([^:]*?):([^\\\\]]*?)\\\\]\\\\]")` at `TermServiceImpl.java:67`
  - Non-greedy `*?` matches zero-or-more characters.
  - ALLOWS empty namespace AND empty term-name.
  - `[[:foo]]` → MATCH → namespace="" (empty), term-name="foo".
  - `[[foo:]]` → MATCH → namespace="foo", term-name="" (empty).
  - `[[foo:bar]]` → MATCH → namespace="foo", term-name="bar".

For the common case `[[foo:bar]]`, both regexes agree. For edge cases with empty groups, they diverge silently:
- A description containing `[[:foo]]` renders as RAW TEXT in the UI (no auto-link), but the backend parses it (empty namespace) and walks the lookup logic (which short-circuits in `handleDataEntityDescriptionTerms` on empty groups, so no harm done — but the divergence exists).
- A programmatic caller (script / odd-cli / collector) writing `[[foo:]]` descriptions has the UI ignore the markup and the backend silently no-op on it; no error surfaces anywhere.

The asymmetry is a latent inconsistency — today both implementations agree on the practical result (no auto-link, no term-relation row), but a future change at EITHER side that starts processing empty-group matches surfaces user-visible divergence.

**Primary source citations**:
- `lib/constants.ts:177` (UI regex)
- `TermServiceImpl.java:67` (backend regex)
- `DataEntityDescription.md` documents the divergence

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-090 codifies the `[[Namespace:TermName]]` syntax. The two regex implementations are a TYPE of dual-driver problem: the same conceptual contract has two enforcers with different semantics.

**Proposed remedy**: Two options:
1. **Single source of truth** — extract the regex to a shared OpenAPI spec extension or a single shared library; generate both Java and TS regex from one source. Heavy-handed; the divergence is currently inconsequential.
2. **Test pair** — write a contract test (Cypress / integration suite) with a fixture description containing each edge case (`[[foo:bar]]`, `[[:foo]]`, `[[foo:]]`, `[[:]]`) and assert the UI rendering + the backend term-relation rows match for each. The test catches future divergence.

Option (2) is the cheap defence; option (1) is the structural fix.

**Severity rationale**: LOW — latent inconsistency, no current user-visible failure. Fix should be paired with REFACTOR-227 (description-side-effect bypasses DATA_ENTITY_ADD_TERM) since both are TermServiceImpl coupling issues.

**Suggested backlog grouping**: `Glossary subsystem hardening sprint`.

---
