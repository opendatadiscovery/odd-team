## ADR-CANDIDATE-107 — Term natural key is `(namespace, name)` case-insensitively — duplicate-check on create and lookup both use `equalIgnoreCase`; `finance/Customer` and `finance/customer` cannot coexist in the same namespace

**Classification**: promote
**Severity**: MEDIUM
**Pillars affected**: [P-06-data-glossary]
**Support**: surfaced by 1 sidecar (`TermServiceImpl`) — primary-source; structural identity-of-Term-entity decision
**Batch**: K (2026-05-19)

**Surfaced by**:
- `odd-platform__java__service__service__TermServiceImpl.md:implicit_adrs.[0]` (HIGH confidence) — "Term natural key is `(namespace, name)` case-insensitively. Two terms `finance/Customer` and `finance/customer` cannot coexist in the same namespace; lookups are case-insensitive throughout."

**Decision statement**: The Business Glossary's Term entity is uniquely identified by the tuple `(namespace.name, term.name)` compared case-insensitively. The duplicate-check at create (`TermServiceImpl.java:107-113`) and the lookup at `getByNameAndNamespace` (`ReactiveTermRepositoryImpl.java:156-157, 167`) both use jOOQ's `equalIgnoreCase` predicate. Mention-parsing in description text (`findTermsInDescription` at `TermServiceImpl.java:337-360`) compares the parsed `(namespaceName, name)` pair to the dictionary via the same case-insensitive predicate. Unhandled-mention staging (`buildDataEntityUnknownTerms` / `buildDatasetFieldUnknownTerms` / `buildTermUnknownTerms` at lines 501-544) lowercases mentions before insertion, preserving the case-insensitive comparison invariant. The architectural posture: the catalog vocabulary is human-curated and case variations (Customer vs customer vs CUSTOMER) should NOT produce duplicate entries — operators authoring `[[finance:Customer]]` in one description and `[[finance:customer]]` in another both resolve to the same term.

**Wisdom test**: PASS. (1) Deliberate (the `equalIgnoreCase` predicate is the explicit choice — `eq` would have been case-sensitive; the consistency across duplicate-check + lookup + parse-comparison + staging is the design statement); (2) Structural impact (the case-insensitive shape is the identity contract for every consumer of the term dictionary — UI rendering, mention parsing, FTS indexing, term-link rows all assume this invariant); (3) Changing the shape (case-sensitive) would be a STRUCTURAL change requiring data-migration analysis and consumer updates.

**Evidence**:
- TermServiceImpl.md says: "`TERM.NAME.equalIgnoreCase(name).and(TERM.DELETED_AT.isNull()).and(NAMESPACE.NAME.equalIgnoreCase(namespaceName))`" (`ReactiveTermRepositoryImpl.java:156-157`)
- TermServiceImpl.md says: "Term natural key is `(namespace, name)` case-insensitively — duplicate check on create (`createTerm` lines 107-113) and lookup (`ReactiveTermRepositoryImpl.java:156-157, 167`) both use `equalIgnoreCase`."

**Existing ADR**: none. Composes with **ADR-CANDIDATE-110** (NEW — unhandled-mention staging with auto-resolution) — the staging-tables-as-forward-resolution mechanism depends on this case-insensitive comparison for the resolution to match. Composes with **ADR-CANDIDATE-108** (NEW — description-link flag) — the case-insensitive identity feeds both manual link rows and description-link rows.

**Cross-link gaps**:
- REFACTOR-260 NEW — cross-namespace term pollution / no per-tenant scoping (the case-insensitive comparison applies across ALL namespaces uniformly — there is no tenant filter at the repository).

**Proposed action**: Promote to `adrs/drafts/term-natural-key-case-insensitive.md` (new ADR). Document the `(namespace, name)` case-insensitive uniqueness invariant explicitly; cross-link with ADR-CANDIDATE-108 (description-link flag), ADR-CANDIDATE-110 (unhandled staging). The live `data-glossary/business-glossary` doc does not spell out this invariant; a DOC-NNN companion is the maintainer follow-up.

**Severity rationale**: MEDIUM — Glossary-identity architecture decision; affects every term-mention auto-link resolution and every duplicate-prevention error message.

---
