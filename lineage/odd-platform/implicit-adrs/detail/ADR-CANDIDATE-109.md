## ADR-CANDIDATE-109 — Description-mention guard blocks rename/delete; allows definition-only updates — a term cannot be renamed or deleted while any active description mentions it via `[[ns:term]]`, but its definition CAN be edited freely

**Classification**: promote
**Severity**: MEDIUM
**Pillars affected**: [P-06-data-glossary]
**Support**: surfaced by 1 sidecar (`TermServiceImpl`) — primary-source; structural Term-lifecycle decision
**Batch**: K (2026-05-19)

**Surfaced by**:
- `odd-platform__java__service__service__TermServiceImpl.md:implicit_adrs.[2]` (HIGH confidence) — "Description-mention guard blocks rename/delete; allows definition-only updates. A term cannot be renamed or deleted while any active (non-soft-deleted parent) description mentions it via `[[ns:term]]`. A term's definition CAN be edited freely because mentions are stored by `(ns, name)` text, not term-id — definition edits don't break link resolution."

**Decision statement**: `TermServiceImpl.updateTerm` (`TermServiceImpl.java:125-134`) and `TermServiceImpl.delete` (`TermServiceImpl.java:156-160`) both gate on `hasDescriptionRelations(termId)`. `updateTerm` first checks `nameOrNamespaceHasChanged` (line 125): if the name AND namespace are BOTH unchanged, the description-mention guard is SKIPPED — definition-only edits proceed. Otherwise (rename or namespace move), the guard ERRORs with `BadUserRequestException('Can't update term, which was mentioned in description')`. `delete` always invokes the guard. The guard's repository implementation (`ReactiveTermRepositoryImpl.java:408-433`) checks all three link tables filtered to `is_description_link=TRUE` AND parent-entity status `!= DELETED` — a term mentioned ONLY in a soft-deleted parent's description CAN be deleted. The architectural posture: description-mention rows store `(ns, name)` text — NOT a term-id reference — so a rename would break every mention's resolution; the guard prevents the breakage. Definition-only edits don't affect mention resolution and are therefore allowed.

**Wisdom test**: PASS. (1) Deliberate (the guard's narrowness — rename-only blocks rather than any-update blocks — is the explicit choice; the cross-table query of `hasDescriptionRelations` is consistent across all three link tables); (2) Structural impact (every operator-facing Term-rename / Term-delete interaction inherits this guard; a UI rendering the rename button must anticipate the 400 surface); (3) Changing the shape (storing term-id in mentions instead of `(ns, name)` text) would be a STRUCTURAL change to the auto-link side-channel.

**Evidence**:
- TermServiceImpl.md says: "`sink.error(new BadUserRequestException(\"Can't update term, which was mentioned in description\"));`" (`TermServiceImpl.java:130-131`)
- TermServiceImpl.md says: "`updateTerm` skips the `hasDescriptionRelations` check entirely when name AND namespace are BOTH unchanged (`TermServiceImpl.java:125-127`). This lets an operator edit a term's DEFINITION even when it is mentioned by descriptions — the rename-only guard exists because mentions are stored by `(ns, name)` text, not term-id (rename would break link resolution). Definition edits don't break references."

**Existing ADR**: none. Composes with **ADR-CANDIDATE-108** (NEW — description-link flag) — the guard relies on the `is_description_link=TRUE` filter to find affected rows. Composes with **ADR-CANDIDATE-110** (NEW — unhandled-mention staging) — the asymmetry that staging resolves forward (term-create triggers backward-resolve) but NOT backward (term-delete does NOT migrate mentions to staging) IS the guard's necessary consequence.

**Cross-link gaps**:
- REFACTOR-262 NEW — `nameOrNamespaceHasChanged` method name is the inverse of its boolean (the method returns TRUE when name AND namespace are BOTH UNCHANGED; the name suggests TRUE means "something changed"; a future "fix" inverting the branch would silently allow rename-while-referenced).

**Proposed action**: Promote to `adrs/drafts/term-rename-delete-mention-guard.md` (new ADR). Document the guard's narrowness (rename/delete blocks; definition-edit passes) AND the rationale (mentions are text-based, not id-based). The doc-side description of this guard is a DOC-NNN follow-up (the live page does not surface the 400 surface).

**Severity rationale**: MEDIUM — Term-lifecycle architecture decision; affects every operator-facing Term-rename interaction.

---
