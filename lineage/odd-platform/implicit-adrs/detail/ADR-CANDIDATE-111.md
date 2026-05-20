## ADR-CANDIDATE-111 — DEG-propagation is opt-in via form-data `propagate: Boolean`, gated by `DATA_ENTITY_GROUP` entity-class membership, and uses CREATE/DELETE action-enum branching with title-overwriting `createOrUpdate` semantics on existing children

**Classification**: promote
**Severity**: MEDIUM
**Pillars affected**: [P-09-security-access-control, P-01-data-discovery]
**Support**: surfaced by 1 sidecar (`OwnershipServiceImpl`) — primary-source; structural ownership-cascade decision
**Batch**: K (2026-05-19)

**Surfaced by**:
- `odd-platform__java__service__service__OwnershipServiceImpl.md:implicit_adrs.[4]` (HIGH confidence) — "DEG-propagation is opt-in via the form-data `propagate: Boolean`, gated by `DATA_ENTITY_GROUP` entity-class membership, and uses action-enum-driven CREATE/DELETE branching."

**Decision statement**: `OwnershipServiceImpl` propagates ownership lifecycle operations from a Data Entity Group (DEG) to every child of the group when the caller explicitly opts in via `formData.propagate == TRUE`. The propagation pipeline: (a) `create` / `delete` / `update` invokes `propagateIfDEG(ownershipPojo, action)` where `action ∈ {CREATE, DELETE}` (the private `OwnershipPropagateAction` enum at lines 151-153); (b) `propagateIfDEG` (lines 121-132) fetches the data-entity's `entity_class_ids` array and short-circuits to `Mono.just(List.of())` if `DATA_ENTITY_GROUP.getId()` is NOT a member — silent no-op for non-DEG targets; (c) for DEGs, `propagateOwnership` (lines 134-149) reads the children's oddrns via `groupEntityRelationRepository.getDEGEntitiesOddrns`, fetches the child entities, builds per-child `OwnershipPojo` rows with the SAME `(owner_id, title_id)`, and dispatches via switch: CREATE→`createOrUpdate(pojos)` (title-overwriting per batch-H — `ON CONFLICT DO UPDATE SET TITLE_ID = EXCLUDED.TITLE_ID`); DELETE→`deleteByDataEntityAndOwner(pojos)`. The `update` flow piggybacks on `OwnershipPropagateAction.CREATE` (line 110) — the CREATE branch's `createOrUpdate` is the correct cascade for both new-row inserts AND title-rewrites of existing rows. The architectural posture: (1) cascade is OPT-IN — operators retain the choice to set DEG-level ownership without affecting children; (2) the cascade is CLASS-GATED — non-DEG targets silently no-op rather than error (defensive against UI-form misuse); (3) the action-enum is THE explicit symmetry — CREATE and DELETE are first-class, not collapsed into a boolean.

**Wisdom test**: PASS. (1) Deliberate (the enum + switch construction is a positive choice — a single boolean would have collapsed CREATE/DELETE into one method, losing the symmetry; the enum makes the symmetry first-class); (2) Structural impact (the cascade contract is reused across all three public methods of the service AND the `createOrUpdate` repository method's title-overwriting semantics is the load-bearing implementation invariant per batch-H); (3) Changing the shape (cascade-by-default, or per-child opt-in, or no cascade at all) would be a STRUCTURAL change to the operator-facing UX contract.

**Evidence**:
- OwnershipServiceImpl.md says: "`enum OwnershipPropagateAction { CREATE, DELETE }` + `switch (action) { case CREATE -> ownershipRepository.createOrUpdate(pojos); case DELETE -> ownershipRepository.deleteByDataEntityAndOwner(pojos); }`" (lines 144-147, 151-153)
- OwnershipServiceImpl.md says: "The gate `ArrayUtils.contains(pojo.getEntityClassIds(), DATA_ENTITY_GROUP.getId())` at line 127 ensures non-DEG targets short-circuit to `Mono.just(List.of())` at line 128 — silent no-op, NOT an error."
- OwnershipServiceImpl.md says (update piggyback): "`update` calls `propagateIfDEG` with CREATE; the CREATE branch routes to `createOrUpdate` which does `ON CONFLICT DO UPDATE SET TITLE_ID = EXCLUDED.TITLE_ID` per batch-H."

**Existing ADR**: none. Composes with **ADR-CANDIDATE-112** (NEW — principal-independent owner_name / self-grant decoupling) — the cascade carries the caller-supplied owner-id through every child, no per-child principal check. Composes with **ADR-CANDIDATE-058** (data-entity status state machine + soft-delete-as-state) — the cascade respects entity-class membership including DEG. Composes with batch-H's `createOrUpdate` title-overwriting ADR (cross-batch).

**Cross-link gaps**:
- The live `enable-security/authorization/owners` and `permissions` docs do NOT name the DEG-propagation contract — a DOC-NNN follow-up is the maintainer companion deliverable.

**Proposed action**: Promote to `adrs/drafts/ownership-deg-propagation.md` (new ADR). Document the opt-in × class-gated × enum-driven contract explicitly, plus the `update`-piggybacks-on-CREATE detail (a child without the ownership gets a new row INSERTed during an update-cascade, contract-asymmetrically). Cross-link with ADR-CANDIDATE-112 (principal-independent owner_name).

**Severity rationale**: MEDIUM — operator-facing cascade contract; affects every DEG-ownership operation and the operator-visible cascade semantics.

---
