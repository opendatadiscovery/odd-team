## REFACTOR-317 — `nameOrNamespaceHasChanged` method name is the inverse of its boolean — the method returns TRUE when name AND namespace are BOTH UNCHANGED; the name suggests TRUE means "something changed"; a future "fix" inverting the branch would silently allow rename-while-referenced

**Severity**: MEDIUM
**Category**: misleading-code (regression-trap)
**Pillars affected**: [P-06-data-glossary]
**Batch**: K (2026-05-19)

**Surfaced by**:
- `odd-platform__java__service__service__TermServiceImpl.md:bugs_limitations_corner_cases.[6]` (MEDIUM) — "`nameOrNamespaceHasChanged` method name is the inverse of its boolean. The method body returns TRUE when name AND namespace are BOTH unchanged; the name `nameOrNamespaceHasChanged` suggests TRUE means 'something changed'. Calling code at line 125 uses the boolean correctly given the actual semantics (`if (returnTrue → unchanged) skip the description-relation guard`), but the name is misleading. A future refactor that reads the call site by the method name and 'fixes' the if-branch direction would invert the logic and silently allow rename-while-referenced."

**Description**: `TermServiceImpl.java:331-335` declares `private boolean nameOrNamespaceHasChanged(...)` with body `return existingTerm.getNamespace().getName().equalsIgnoreCase(formData.getNamespaceName()) && existingTerm.getTerm().getName().equalsIgnoreCase(formData.getName());`. The method returns TRUE iff BOTH namespace and name are unchanged. The name "nameOrNamespaceHasChanged" suggests the opposite (TRUE means "something has changed"). The call site at line 125 uses the boolean CORRECTLY GIVEN THE ACTUAL BODY: `if (nameOrNamespaceHasChanged(...)) skip the hasDescriptionRelations check` — i.e. "if BOTH are unchanged (the boolean is TRUE), skip the description-mention guard because it's not a rename/move." But a future maintainer reading the method NAME (without inspecting the body) would expect TRUE = "something changed" and might "fix" the if-branch to its inverted form, silently allowing rename-while-referenced (breaking ADR-CANDIDATE-109's guard).

**Failure mode**: A maintainer is refactoring `updateTerm` and reads `if (nameOrNamespaceHasChanged(...))` at line 125, parses the method name as "if something changed," and changes the if-branch from "skip the guard" to "skip the guard UNLESS something changed" (i.e. inverting the gate). The compiler is happy, the test suite (per TermServiceImpl sidecar: ZERO tests) does not catch it. The next operator who renames a term referenced in 100 descriptions discovers the descriptions silently lose their links (mentions now point at a non-existent (ns, name)).

**Primary source citations**:
- `TermServiceImpl.java:125` (call site)
- `TermServiceImpl.java:331-335` (the method body)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-109 (NEW batch K — description-mention guard on rename/delete) is the prescription this regression-trap could violate. The fix preserves the ADR.

**Proposed remedy**: One-line refactor — rename the method to `nameAndNamespaceUnchanged(...)` (or invert the body to `!equalsIgnoreCase || !equalsIgnoreCase` and rename to `nameOrNamespaceHasChanged`). Inverting the body is the cleaner fix because it aligns the method name with the boolean semantics. Add a unit test asserting the rename-while-referenced guard fires; this is the test-gap that makes the regression trap real.

**Severity rationale**: MEDIUM — regression-trap; the misalignment between method name and body is a real hazard for future maintainers; the one-line fix is high-leverage.

**Suggested backlog grouping**: `Data Glossary hardening sprint` (code-hygiene bundle)

---
