## ADR-CANDIDATE-076 — Application-level data-integrity invariants enforced at the SERVICE layer via read-then-throw guards with hand-written English error messages, not via DB-level UNIQUE constraints / FOR UPDATE / advisory locks

**Severity**: MEDIUM
**Classification**: promote
**Support count**: 4 sidecars (batch I — AlertService reopen-conflict + PolicyService Administrator-reservation + PolicyService cascade-delete + DataEntityService createMetadata duplicate-detection; cross-corroborated with batch H repository-layer `selective FOR UPDATE` ADR-073)
**Axes present**: services, repositories, schema

**Surfaced by**:
- `AlertServiceImpl.md:implicit_adrs[2]` ("The reopen-conflict guard is server-enforced application logic, not a DB constraint. Lines 124-131 conditionally run `openAlertWithTheSameTypeExistsForDataEntity` BEFORE the update, then `BadUserRequestException` if true. The check is application-level: there is no `UNIQUE (data_entity_oddrn, type) WHERE status = OPEN` partial-index on the ALERT table.")
- `PolicyServiceImpl.md:implicit_adrs[2]` ("The `Administrator` policy is name-reserved against UPDATE and DELETE but NOT against CREATE — the operator-visible bootstrap admin path is protected against accidental destruction via standard endpoints… The constant `ADMINISTRATOR_POLICY = \"Administrator\"` and the explicit rejection text `\"Administrator policy cannot be updated\"` / `\"...cannot be deleted\"` are the maintainer's surfaced intent.")
- `PolicyServiceImpl.md:implicit_adrs[3]` ("Cascade-delete is HARD-BLOCKED at the service layer rather than implemented as a cascading cleanup. When the operator tries to delete a policy still bound to any role, the platform raises `CascadeDeleteException(\"Policy is attached to a role\")` — it does NOT auto-detach the bindings.")
- `DataEntityServiceImpl.md:bugs_limitations_corner_cases[8]` ("createMetadata duplicate-detection error message is confusingly worded: `\"Metadata with this name already exists\"` — server-side check at the service tier raising BadUserRequestException, not a DB-level error")

**Decision statement**: Across the platform's mutating service-tier paths, data-integrity invariants that have an operator-visible meaning are encoded as **read-then-throw application-level guards with hand-written English error messages**, NOT as DB-level UNIQUE constraints, `SELECT FOR UPDATE` fences, or advisory locks. The canonical pattern: (1) service reads the current state (`openAlertWithTheSameTypeExistsForDataEntity`, `policyRepository.get(id)`, `roleToPolicyRepository.isPolicyAttachedToRole(id)`, `dataEntityMetadataFieldValueRepository.existsByDataEntityIdAndMetadataField`); (2) service evaluates the guard in Java (`if (AlertStatusEnum.OPEN == status)`, `if (formData.getName().equals(ADMINISTRATOR_POLICY))`, `if (isAttached)`, `if (exists)`); (3) service raises a project-specific exception with a hand-written English message (`BadUserRequestException("Cannot reopen alert since the system already has an open alert of the same type")`, `BadUserRequestException("Administrator policy cannot be updated")`, `CascadeDeleteException("Policy is attached to a role")`, `BadUserRequestException("Metadata with this name already exists")`). The error message is the operator-facing contract — explicit, English, hand-curated.

The decision codifies the platform's stance:
- **(a) Operator UX over schema strictness**: hand-written messages give operators the *why*, not just a 23505 unique-constraint code. The trade-off is accepted: the DB schema is intentionally **less strict** than it could be (no `UNIQUE (data_entity_oddrn, type) WHERE status = OPEN`, no `FK roleToPolicy ON DELETE RESTRICT`, no `UNIQUE (entity, metadata_field)` partial). The schema captures storage shape; the service captures *meaning*.
- **(b) Per-write-shape curation**: the maintainer chose which invariants warrant the read-then-throw treatment. Not every potential invariant is guarded; the pattern is opt-in per mutation, parallel to the @ActivityLog opt-in pattern (per ADR-CANDIDATE-060).
- **(c) Asymmetric protection across CRUD axes**: the Administrator-name reservation is enforced on UPDATE + DELETE but NOT on CREATE; the cascade-delete check is enforced on policy.delete but the inverse asymmetry exists at RoleService.delete which DOES auto-clean role_to_policy edges (per PolicyServiceImpl.md:implicit_adrs[3]). The maintainer chose where to be strict and where to defer to DB constraints / cascade behaviour.
- **(d) Concurrency unfenced by design (sometimes by oversight)**: every guard above is read-then-write OUTSIDE any `@ReactiveTransactional` boundary (or inside a transactional boundary that doesn't include `SELECT FOR UPDATE`). The maintainer accepts the brief invariant-violation window under high concurrency. This composes with ADR-CANDIDATE-073 (selective FOR UPDATE on ingestion-read paths only — user-driven mutation reads deliberately unfenced).

The architectural alternative is a **schema-first** approach: encode the invariants in `CREATE UNIQUE INDEX ... WHERE`, `CHECK CONSTRAINT`, `FOREIGN KEY ... ON DELETE RESTRICT`, and let Postgres' constraint-violation errors translate via `ExceptionUtils.translateDatabaseException` (per ADR-CANDIDATE-071) into HTTP errors. The platform DOES use this approach in places (the partial UNIQUE INDEX `policy_name_idx WHERE deleted_at IS NULL` per ADR-CANDIDATE-070, the `metadata_field_value` FK constraints, the `role_to_policy` PK). But for invariants where operator UX outweighs schema enforceability, the service-tier read-then-throw pattern is chosen.

**Wisdom test (3-question)**:
1. *Intentional?* YES — the constant `ADMINISTRATOR_POLICY = "Administrator"` (PolicyServiceImpl.java:29), the hand-written English exception messages, the dedicated `CascadeDeleteException` class with `ErrorCode.CASCADE_DELETE`, the explicit existence checks pre-mutation — these are deliberate design choices visible in the source. The intent is documentable from the code alone.
2. *Structural impact?* YES — affects the entire service-tier shape (every mutating endpoint follows this pattern), affects the operator UX (English errors vs constraint codes), affects the schema design (intentionally less strict than possible), affects concurrency semantics (read-then-write outside FOR UPDATE).
3. *Refactoring or structural?* STRUCTURAL — moving to a schema-first approach would require database migrations, exception-translation rewrites, and a redesign of the operator UX (the English error messages would lose specificity). The decision is architectural, not implementation-level.
→ ADR-CANDIDATE.

**Evidence**:
- `AlertServiceImpl.md` says: "`if (exists) { sink.error(new BadUserRequestException(\"Cannot reopen alert since the system already has an open alert of the same type\")); }` (lines 127-129) — the literal English message confirms the server-side application-level contract"
- `PolicyServiceImpl.md` says: "PolicyServiceImpl.java:62-95 (validate + name guard + cascade check all in service) + ReactivePolicyRepositoryImpl.java:1-40 (no business invariants in repository) + batch-H sidecar implicit_adrs[3] confirms this is the consistent pattern across every Reactive*Repository"
- `PolicyServiceImpl.md` says (cascade): "PolicyServiceImpl.java:89-92 (CascadeDeleteException raised) vs RoleServiceImpl.java:89 (`then(roleToPolicyRepository.deleteRoleRelationsExcept(id, List.of()))` — auto-cleanup before delete) + CascadeDeleteException.java:1-7 (project-specific exception type with ErrorCode.CASCADE_DELETE)"
- `DataEntityServiceImpl.md` says: "createMetadata duplicate-detection at lines 277-278: `BadUserRequestException(\"Metadata with this name already exists\")` — service-tier check, not DB-uniqueness fall-through"

**Existing ADR**: composes with:
- **ADR-CANDIDATE-071** (centralised DB-error translation via ExceptionUtils) — the OPPOSITE pattern for invariants that ARE schema-enforced (DB constraint → ExceptionUtils → HTTP error).
- **ADR-CANDIDATE-073** (selective FOR UPDATE on ingestion-read paths only) — confirms the maintainer's concurrency stance: ingestion paths get FOR UPDATE; user-driven mutation paths get read-then-throw with the race window accepted.
- **ADR-CANDIDATE-070** (partial UNIQUE INDEX `WHERE deleted_at IS NULL`) — the schema-first counterpart for name-uniqueness; the service-tier name-reservation (Administrator) layers on top.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-037 (existing — reopen-conflict guard read-then-write race window; AlertServiceImpl.md:bugs_limitations_corner_cases[0] strengthens to 3-sidecar full-stack)
- REFACTOR-266 (NEW — Policy lost-update race on PUT /api/policies/{id}: read-then-write outside any txn, no version column)
- REFACTOR-267 (NEW — Policy cascade-delete check non-atomic with delete: concurrent role-bind + delete race produces orphan-binding permission leak)
- REFACTOR-189 (referenced from batch-E — Administrator-name CREATE-side asymmetry: confirmed primary-source at PolicyServiceImpl.java:62-69)

**Proposed action**: Promote to `adrs/drafts/service-tier-application-invariants.md`. Document:
- The read-then-throw pattern with hand-written English error messages as the contract surface.
- The trade-off: operator UX + per-write-shape curation vs schema strictness + uniform constraint-violation handling.
- The concurrency acceptance: read-then-write outside FOR UPDATE is deliberate for user-driven paths; the race window is tolerated (composes with ADR-CANDIDATE-073).
- The CRUD-axis asymmetry: each invariant is enforced on the axes the maintainer chose (Administrator-reservation on UPDATE/DELETE not CREATE; cascade-block on policy.delete vs auto-cascade-clean on role.delete).
- Cross-link with ADR-CANDIDATE-071 (the schema-first counterpart for DB-enforced invariants) and ADR-CANDIDATE-073 (the selective-FOR-UPDATE concurrency stance).

**Severity rationale**: MEDIUM — pattern-shaping decision for every mutating service method on the platform; affects operator UX, schema design, and concurrency semantics. Not load-bearing for security architecture (the gates live at SECURITY_RULES per ADR-CANDIDATE-002), but architectural for data-integrity invariants.

---
