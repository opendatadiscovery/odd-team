## ADR-CANDIDATE-112 — `OwnershipServiceImpl` is principal-independent — `owner_name` is taken VERBATIM from the form, never inferred from the authenticated principal; "who can grant" and "to whom granted" are deliberately decoupled

**Classification**: promote
**Severity**: HIGH
**Pillars affected**: [P-09-security-access-control, P-01-data-discovery]
**Support**: surfaced by 1 sidecar (`OwnershipServiceImpl`) — primary-source; structural authorisation-architecture decision with HIGH-severity governance consequences
**Batch**: K (2026-05-19)

**Surfaced by**:
- `odd-platform__java__service__service__OwnershipServiceImpl.md:implicit_adrs.[5]` (HIGH confidence) — "The service is principal-independent — owner_name is taken VERBATIM from the form, never inferred from the authenticated principal. ... A Policy granting `DATA_ENTITY_OWNERSHIP_CREATE` WITHOUT a `\"is\": \"dataEntity:owner\"` condition lets the holder grant ownership on ANY data entity to ANY owner (including a newly auto-created one). The service does NOT infer the owner from the principal; the caller-supplied `owner_name` is honoured verbatim."

**Decision statement**: `OwnershipServiceImpl.create` (line 52) reads `formData.getOwnerName()` and passes it directly to `ownerService.getOrCreate(...)`. There is NO call to `ReactiveSecurityContextHolder.getContext()`, NO call to `authIdentityProvider.fetchAssociatedOwner()`, NO `Authentication` parameter on any of the three public methods, NO principal-derived owner-id lookup. The architectural posture is **self-grant decoupling**: (a) "who can grant ownership on this data entity" is an UPSTREAM Policy decision (gated at `SecurityConstants.SECURITY_RULES[215-227]` via `DATA_ENTITY_OWNERSHIP_CREATE` + `DataEntityPermissionExtractor` per-data-entity Policy evaluation); (b) "to whom is the ownership granted" is a CALLER decision (the form's `owner_name`). The two decisions are deliberately decoupled. A Policy granting `DATA_ENTITY_OWNERSHIP_CREATE` WITH a `"is": "dataEntity:owner"` condition DOES bind "who can call" to "who owns the entity," but it does NOT bind "who is granted ownership" to the caller's principal — the caller can name any Owner (or auto-create one via REFACTOR-199) regardless of who they are.

**Wisdom test**: PASS. (1) Deliberate (line 52 is the explicit choice — `ownerService.getOrCreate(formData.getOwnerName())` reads the name from the form, not from the principal; the absence of any `authIdentityProvider` call across the entire service is consistent); (2) Structural impact (the decoupling determines the operator-facing governance model — admin Policies that grant `DATA_ENTITY_OWNERSHIP_CREATE` unconditionally permit cross-team / cross-tenant ownership transfers; the alternative — bind to principal — would be a fundamentally different security model); (3) Changing the shape (auto-bind owner_name to caller's principal) would be a STRUCTURAL change affecting every operator UX where an admin grants ownership to another user.

**Evidence**:
- OwnershipServiceImpl.md says: "`ownerService.getOrCreate(formData.getOwnerName())` (line 52 — the explicit choice to read the name from the form, NOT from the principal, IS the architectural statement)"
- OwnershipServiceImpl.md says: "grep `authIdentityProvider` against `OwnershipServiceImpl.java` returns zero matches + grep `ReactiveSecurityContextHolder` against `OwnershipServiceImpl.java` returns zero matches"

**Existing ADR**: none. **Contrasts with ADR-CANDIDATE-015** (owner-scoped routes via reactor Context — every `/my*` read DOES infer the principal). The contrast is the explicit design statement: for owner-scoped READS the principal is the input; for ownership-MUTATIONS the principal is the gate (via Policy) but NOT the target. Composes with **ADR-CANDIDATE-049** (identity-decoupled Owner directory CRUD — `OwnerController.createOwner` is similarly principal-independent). Composes with **ADR-CANDIDATE-111** (DEG-propagation) — the cascade preserves the principal-independent owner_name through every child.

**Cross-link gaps** (refactoring-scopes anchored on the consequences this ADR endorses):
- REFACTOR-199 (batch F — primary-source CONFIRMED batch K at OwnershipServiceImpl.java:52) — `DATA_ENTITY_OWNERSHIP_CREATE` is a SECOND path into the Owner directory, bypassing `OWNER_CREATE`. The principal-independence is the structural enabler of the bypass.
- REFACTOR-206 (batch F — primary-source CONFIRMED batch K) — Title auto-create has no allowlist; same shape as REFACTOR-199 for the Title directory.
- The "self-grant ambiguity" doc-drift in the sidecar — the live Policies / Permissions docs are silent on the self-grant surface; a DOC-NNN follow-up is the maintainer companion.

**Proposed action**: Promote to `adrs/drafts/ownership-principal-independent-self-grant-decoupling.md` (new ADR). Document the decoupling explicitly with the operator-facing consequence: an unconstrained `DATA_ENTITY_OWNERSHIP_CREATE` grant lets the holder bind any Owner to any data entity (including a freshly-minted Owner via REFACTOR-199). The maintainer's triage: either accept the model (and document it on the live Policies page so operators know to add `"is": "dataEntity:owner"` conditions or stricter custom predicates) or change the model (bind to principal at the service layer, which is a structural shift). Cross-link with ADR-CANDIDATE-015 (the contrasting read-side principal-flow), ADR-CANDIDATE-049 (the directory-CRUD pattern), ADR-CANDIDATE-111 (DEG-propagation).

**Severity rationale**: HIGH — governance-architecture decision; affects every operator-facing Policy authoring decision. The decoupling is a real operator-trap because it is invisible at the doc layer (no live doc names the self-grant surface).

---
