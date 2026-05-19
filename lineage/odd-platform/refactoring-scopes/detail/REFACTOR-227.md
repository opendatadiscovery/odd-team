## REFACTOR-227 — Description-update side-effect bypasses `DATA_ENTITY_ADD_TERM` permission via `[[ns:term]]` injection

**Severity**: MEDIUM
**Category**: permission-bypass
**Surfaced by**:
- `upsertDataEntityInternalDescription.md:security.known_security_gaps[3]`

**Description**: A caller with only `DATA_ENTITY_DESCRIPTION_UPDATE` (no `DATA_ENTITY_ADD_TERM` permission) can still create term-relation rows by injecting `[[ns:term]]` mentions into the description body. `DataEntityServiceImpl.upsertDescription` (line 328) invokes `termService.handleDataEntityDescriptionTerms` unconditionally. `TermServiceImpl.handleDataEntityDescriptionTerms` (line 200) emits `TERM_ASSIGNMENT_UPDATED` regardless of the caller's term-write permission. The dedicated `DATA_ENTITY_ADD_TERM` permission (`SecurityConstants.java:237-239`) is BYPASSED by the description-write path. The Policy framework's separation between "edit description" and "link terms" — captured in ADR-CANDIDATE-062 (Two-permission split) — is structurally undermined for the description-mediated term-link case. Combined with REFACTOR-217 (the path-mismatch silently disables `DATA_ENTITY_ADD_TERM` ANYWAY), the practical impact is low TODAY but the latent gap is structural: even after REFACTOR-217 is fixed, this side-channel will remain unless explicitly addressed.

**Primary source citations**:
- `DataEntityServiceImpl.java:328` (`termService.handleDataEntityDescriptionTerms` invoked unconditionally)
- `TermServiceImpl.java:200` (the method emits `TERM_ASSIGNMENT_UPDATED` regardless of caller's term-write permission)
- `SecurityConstants.java:194-197` (DESCRIPTION_UPDATE rule)
- `SecurityConstants.java:237-239` (ADD_TERM rule — the rule that should also gate the side-channel)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-062 (Two-permission split) is the prescription this scope violates. ADR-CANDIDATE-064 (Manual vs description-link coexistence) documents the dual-channel model that creates the side-channel — the architectural intent is OK; the missing permission check at the inner channel is the gap.

**Proposed remedy**: In `TermServiceImpl.handleDataEntityDescriptionTerms`, check that the caller has `DATA_ENTITY_ADD_TERM` on the data entity before allowing description-mediated term-relation writes. Alternatively, document this as an intentional simplification (description-edit implies term-link consent) and remove `DATA_ENTITY_ADD_TERM` from the permission model — but this would conflict with ADR-CANDIDATE-062. The Permissions doc should articulate whichever decision is made.

**Severity rationale**: MEDIUM — structural permission-bypass; latent today because REFACTOR-217 silently disables the dedicated permission anyway, but becomes acute once REFACTOR-217 is fixed.

**Suggested backlog grouping**: SEC-NNN authorization-audit sprint. Bundle with REFACTOR-217 — fixing 217 without addressing 227 leaves the side-channel open.

---
