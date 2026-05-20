---
node_id: "odd-platform java service service:OwnerServiceImpl"
node_kind: service
axis: services
extracted_at_commit: 9ac6436e
enriched_at_commit: 9ac6436e
extractor_version: 0.1.0
prompt_version: file-analyser/0.2.0
schema_version: v0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-20-S-OwnerServiceImpl
pillar: P-08
related_pillar_features:
  - "P-08:F-003 — Owner Lifecycle Management (F-019)"
  - "P-09:F-001 — Role-Based Access Control (F-006) — service-tier closure of the 6-sidecar audit-silence pattern"
  - "P-09:F-002 — Principal-to-Owner Resolution (F-011) — `isOwnerAssociated` cascade-block leg"
related_features:
  - F-019
  - F-006
  - F-011
related_refactors:
  - REFACTOR-425  # confirmed primary source: destructive empty-roles UPDATE
  - REFACTOR-426  # confirmed primary source: NO @ActivityLog on any of create/update/delete
  - REFACTOR-427  # owner_association_request orphan rows (delete cascade-block incompleteness)
  - REFACTOR-428  # delete does NOT refresh FTS search vectors
  - REFACTOR-429  # silent-204 on delete (no NotFoundException; idempotency contract undocumented)
  - REFACTOR-430  # cascade-check is NOT atomic with soft-delete (race-window REFACTOR-430)
  - REFACTOR-431  # OpenAPI 201-vs-impl 200 class-wide drift on create + update
  - REFACTOR-432  # name field case-sensitive, no @NotBlank, no normalisation
  - REFACTOR-185  # 17th + 18th DISABLED-mode-bypass surfaces (updateOwner + deleteOwner)
related_adrs:
  - ADR-CANDIDATE-144  # set-replacement role-rebind (`deleteOwnerRelationsExcept` + `createRelations`)
  - ADR-CANDIDATE-145  # mixed soft+hard-delete (owner row soft-deleted, OWNER_TO_ROLE hard-deleted)
related_concepts:
  - owner-lifecycle-audit-silence-six-sidecar-pattern
  - empty-roles-field-silently-destroys-bindings
  - owner-side-orphan-binding-closure-positive-case-law
  - owner-name-rename-safe-for-user-owner-mapping
  - partial-unique-index-enables-name-reuse-after-soft-delete
  - delete-no-not-found-validation-owner-side
  - delete-search-vector-not-refreshed-owner-side
  - owner-association-request-orphan-rows-persist
  - cascade-check-non-atomic-race-window
related_sidecars:
  - odd-platform__java__OwnerController__controller-method__createOwner   # batch E — controller-tier of `create`
  - odd-platform__java__OwnerController__controller-method__updateOwner   # batch P — controller-tier of `update`
  - odd-platform__java__OwnerController__controller-method__deleteOwner   # batch P — controller-tier of `delete`
  - odd-platform__ts__react-component__component__OwnersList               # batch Q — UI-tier of all three verbs
  - odd-platform__java__repository__reactive__repository__ReactiveUserOwnerMappingRepositoryImpl  # batch N — `isOwnerAssociated` cascade-block leg
coherence_notes:
  - kind: strengthens
    target: F-019
    target_drift_facet: forensic_silence_on_owner_lifecycle_mutations
    note: |
      Service-tier PRIMARY-SOURCE confirmation: `OwnerServiceImpl.java:38-100`
      contains NO `@ActivityLog` annotation on ANY of the three lifecycle
      methods (`create` lines 54-66, `update` lines 68-85, `delete` lines
      87-100). The Activity Feed therefore records NO events for owner
      directory mutations. Verified via Grep `@ActivityLog` across
      <odd-platform-api>/service/*.java 2026-05-20: 10 service files carry
      `@ActivityLog`, NONE are OwnerServiceImpl. STRENGTHENS the 6-sidecar
      audit-silence pattern (createOwner batch E + updateOwner batch P +
      deleteOwner batch P + RoleController batch N + PolicyController batch
      N + ReactivePolicyRepositoryImpl batch N + ReactiveRoleRepositoryImpl
      batch N) — adds the explicit service-tier primary source under one
      enclosing class.
  - kind: strengthens
    target: F-019
    target_drift_facet: empty_roles_field_silently_destroys_bindings
    note: |
      Service-tier PRIMARY-SOURCE confirmation for REFACTOR-425. The
      destructive UPDATE pipeline lives at `OwnerServiceImpl.java:76-81`:
      `deleteOwnerRelationsExcept(owner.getId(), newRoles).thenReturn(owner)`
      then `createRelations(owner.getId(), newRoles).thenReturn(owner)`.
      The helper `getRoleIdsList` (lines 116-122) collapses both `null`
      and empty list to `List.of()` (CollectionUtils.isEmpty branch). When
      `newRoles` is `List.of()`, the downstream
      `ReactiveOwnerToRoleRepositoryImpl.deleteOwnerRelationsExcept` (lines
      52-56) issues `DELETE FROM OWNER_TO_ROLE WHERE OWNER_ID = ? AND
      ROLE_ID NOT IN ()`. The jOOQ-generated `notIn(emptyCollection)`
      compiles to a predicate that is TRUE for every row (jOOQ folds an
      empty NOT IN list to a tautology, NOT to "match nothing"); the
      result is `DELETE FROM OWNER_TO_ROLE WHERE OWNER_ID = ?` —
      wiping ALL of the owner's role bindings. The same primitive is used
      INTENTIONALLY in `delete` at line 97 with `List.of()` as the
      explicit "wipe all" call — confirming this is not a defaulting
      bug at the persistence layer, but a DELIBERATELY-DESTRUCTIVE
      primitive where the service-tier `update` path inherits the
      destructive default via `getRoleIdsList`'s null+empty collapse.
  - kind: strengthens
    target: F-019
    target_drift_facet: cascade_check_non_atomic
    note: |
      Service-tier PRIMARY-SOURCE confirmation for REFACTOR-430. The
      cascade-check at `OwnerServiceImpl.java:90-93` runs `Mono.zip` over
      three `existsBy*` reads without any row-level lock (`SELECT FOR
      UPDATE`) or Postgres advisory lock on `owner_id`. The downstream
      writes — `deleteOwnerRelationsExcept(id, List.of())` (line 97) and
      `ownerRepository.delete(id)` (line 98) — run inside the SAME
      `@ReactiveTransactional` boundary (line 88), but under `READ
      COMMITTED` isolation (Spring/R2DBC default) the cascade-read +
      write is NOT atomic against a concurrent
      `POST /api/dataentities/{id}/ownership`. The race window is bounded
      by the transaction's duration (~3 EXISTS queries) — narrow but
      observable. The shape MIRRORS F-006 batch I `PolicyServiceImpl.delete`
      cascade-check non-atomicity (the same pattern on the RBAC half).
  - kind: strengthens
    target: F-006
    target_drift_facet: owner_to_role_hard_delete_closes_orphan_binding_positive
    note: |
      Service-tier PRIMARY-SOURCE confirmation for ADR-CANDIDATE-145
      (mixed soft+hard-delete). `OwnerServiceImpl.delete` (lines 87-100)
      issues `deleteOwnerRelationsExcept(id, List.of())` at line 97
      (HARD-DELETE of all owner_to_role rows) followed by
      `ownerRepository.delete(id)` (SOFT-delete UPDATE setting
      `deleted_at = NOW()`). The role-binding hard-delete CLOSES the
      orphan-binding gap that F-006 batch I/N surfaces on the
      Policy/Role half (where the binding tables `ROLE_TO_POLICY` +
      `OWNER_TO_ROLE` inherit soft-delete from the Policy/Role parent and
      leave orphan grants). The OWNER side is the POSITIVE case-law —
      a deliberate choice to revoke permissions immediately while
      preserving owner-row audit history. Cross-link to ADR-CANDIDATE-145.
  - kind: distinguishes-from
    target: REFACTOR-391
    note: |
      REFACTOR-391 (F-011) describes the OIDC_USERNAME-rename hazard:
      renaming a GitHub user's `login` orphans their USER_OWNER_MAPPING
      row because the handler uses `oidc_username='login'` (a free-rename
      string) and no stable-id fallback. THIS sidecar is the SAFE
      counterpart: `OwnerServiceImpl.update` renames `owner.name` via
      `OwnerMapper.applyToPojo` + `ownerRepository.update`, but
      USER_OWNER_MAPPING.OWNER_ID is the FK by `owner.id` (the bigserial
      PK, stable across name changes, per
      `V0_0_4__add_user_owner_mapping.sql:3` — confirmed in batch N
      ReactiveUserOwnerMappingRepositoryImpl sidecar). The two findings
      TOGETHER describe the complete rename-hazard surface: OWNER.NAME
      rename is safe, OIDC_USERNAME rename is hazardous.
  - kind: rule-6-pre-emit-check
    target: prior_batch_p_inferences
    note: |
      LSN-018 pre-emit coherence check executed against the updateOwner
      and deleteOwner sidecars (batch P) and the OwnersList UI sidecar
      (batch Q). All controller-tier inferences about `OwnerServiceImpl`
      behaviour are CONFIRMED at the primary source:
      (a) `@ReactiveTransactional` is on the service, not the controller
          (lines 55, 69, 88) — confirmed
      (b) the `getRoleIdsList` null+empty collapse pattern at lines
          117-122 — confirmed
      (c) the destructive `deleteOwnerRelationsExcept` pattern at lines
          76-81 (update) and 97 (delete) — confirmed
      (d) the `updateSearchVectors` helper at lines 109-114 is invoked
          from `update` (line 82) but NOT from `delete` or `create` —
          confirmed (the update-vs-delete asymmetry; the create-side
          omission is noted below as a new finding)
      (e) the three-leg cascade-block at lines 90-93 — confirmed
      (f) the `switchIfEmpty(NotFoundException)` at line 73 in update
          vs the absence at the delete path (line 98 has no
          switchIfEmpty) — confirmed asymmetry
      NO CONFLICTS surfaced. ONE NEW FINDING surfaces at primary source:
      `create` (lines 54-66) does NOT call `updateSearchVectors` either
      — only `update` (line 82) calls it. This asymmetry was implicit in
      batch P sidecars (each described only its own method's pipeline);
      this enclosing-class sidecar makes the create+delete-vs-update
      asymmetry EXPLICIT: only the rename path refreshes the FTS index,
      not the create OR delete paths. Surface as a new corner-case (see
      bugs_limitations_corner_cases[7] below) and strengthen the F-019
      batch-P drift facet `delete_search_vector_not_refreshed_owner_side`
      with the symmetric finding that `create` is also asymmetric (the
      `mapFromDto` read-back covers the role list but the FTS vectors
      for the new owner row are NOT explicitly seeded — the seeding
      happens lazily when downstream data entities reference the owner).
---

# OwnerServiceImpl — semantic understanding

## understanding

`OwnerServiceImpl` is the **enclosing service-tier class for the Owner directory CRUD trinity** (`create` lines 54-66, `update` lines 68-85, `delete` lines 87-100) + two read paths (`list` lines 44-52, `getOwnerDtoById` lines 102-107) + one fixture-helper write (`getOrCreate` lines 38-42). The class is annotation-light at the class level (`@Service`, `@RequiredArgsConstructor`) — every business semantic is encoded INSIDE the method bodies via reactive pipelines composing seven injected reactive repositories + one MapStruct mapper. The three mutating methods (`create` / `update` / `delete`) each carry `@ReactiveTransactional` (lines 55, 69, 88) — establishing transactional boundaries that scope multi-statement writes against the OWNER, OWNER_TO_ROLE, SEARCH_ENTRYPOINT, and TERM_SEARCH_ENTRYPOINT tables into one logical commit. Three structural decisions are visible across all three mutating methods: (a) the `@ReactiveTransactional` boundary lives at the service, not the controller; (b) role bindings are managed via a SET-REPLACEMENT primitive (`deleteOwnerRelationsExcept` + `createRelations`) where an empty `newRoles` list is treated as DELETE-ALL (the destructive-default at line 97 in delete is intentional; the same primitive's reuse at line 77 in update inherits the destructive semantic via `getRoleIdsList`'s null+empty collapse at lines 116-122 — REFACTOR-425); (c) NONE of the three methods carry `@ActivityLog` — Owner directory mutations are forensically silent (REFACTOR-426). The class is the SERVICE-TIER CLOSURE of F-019 Owner Lifecycle Management + F-006 RBAC audit-silence: every drift facet surfaced by the batch-E createOwner + batch-P updateOwner / deleteOwner + batch-Q OwnersList sidecars has its persistence-layer origin in this file's 123 lines.

## concepts

- entities: [
    "`OwnerPojo` (jOOQ row; mutated in place by `OwnerMapper.applyToPojo` at line 74; written by `ownerRepository::create` line 60 + `ownerRepository::update` line 75; read back by `ownerRepository.getDto` lines 64, 83, 104)",
    "`OwnerFormData` (request body shape from OpenAPI; name required + roles optional; consumed by `mapToPojo` line 59 and `applyToPojo` line 74 + `getRoleIdsList` lines 116-122)",
    "`Owner` (response DTO; produced via `ownerMapper.mapFromDto` lines 65, 84, 106 — the joined view including the role list and associated_user from `OwnerDto`)",
    "`OwnerList` (paginated list view; produced via `ownerMapper.mapToOwnerList` line 51 — the page-info-wrapped list)",
    "`OwnerToRolePojo` (join-table row; managed via `ownerToRoleRepository.deleteOwnerRelationsExcept` lines 77, 97 + `createRelations` lines 62, 80)",
    "`NotFoundException` (raised at line 73 when the update path's `ownerRepository.get(id)` returns empty + at line 105 when `getOwnerDtoById`'s `getDto` returns empty — but NOT raised on `delete` line 98, which is the silent-204 asymmetry)",
    "`CascadeDeleteException` (raised at lines 95-96 when ANY of the 3 cascade-block legs returns true — `existsByOwner` × 2 + `isOwnerAssociated`)",
    "`OWNER` table (the directory row; written by `ownerRepository.create/update`, soft-deleted by `ownerRepository.delete` via `ReactiveAbstractSoftDeleteCRUDRepository`)",
    "`OWNER_TO_ROLE` join table (HARD-DELETED via `deleteOwnerRelationsExcept`; the role-binding history is NOT preserved)",
    "`SEARCH_ENTRYPOINT` + `TERM_SEARCH_ENTRYPOINT` (FTS rows; refreshed in `updateSearchVectors` lines 109-114; called ONLY from `update` line 82, NOT from `create` or `delete`)",
    "`OWNERSHIP` + `TERM_OWNERSHIP` + `USER_OWNER_MAPPING` (cascade-block sources at lines 90-91 — the three tables checked before owner soft-delete)"
  ]
- operations: [
    "`getOrCreate(name)` lines 38-42 — read-by-name, fall through to `ownerRepository.create(new OwnerPojo().setName(name))` if absent. Called by `OwnerAssociationRequestServiceImpl.createOwnerAssociationRequest` (line 57 of that file) — the permission-bypass-via-owner-auto-create side-door write path documented in concepts catalog. This is the ONLY write into the OWNER table that bypasses the `OWNER_CREATE` SecurityRule (the service-method gate is at the `/api/owners` POST controller, not at the service method).",
    "`list(page, size, query, ids, allowedForSync)` lines 44-52 — paginated read via `ownerRepository.list` (filtered through `ReactiveAbstractSoftDeleteCRUDRepository.listCondition` which adds `deleted_at IS NULL`) + `ownerMapper.mapToOwnerList`. Soft-deleted owners are HIDDEN from the list view.",
    "`create(formData)` lines 54-66 — `@ReactiveTransactional`. Pipeline: `Mono.just(formData) → mapToPojo → ownerRepository.create → ownerToRoleRepository.createRelations(ownerId, roleIds) → ownerRepository.getDto(ownerId) → mapFromDto`. 3 DB round-trips for the no-roles case (INSERT owner + INSERT zero owner_to_role + SELECT-with-joins read-back); 2+N for the role-bearing case. NO `updateSearchVectors` call — FTS seeding is lazy.",
    "`update(id, updateEntityForm)` lines 68-85 — `@ReactiveTransactional`. Five-step pipeline: (1) `ownerRepository.get(id).switchIfEmpty(NotFoundException)`, (2) `applyToPojo` mutating the existing pojo with form's new name + roles, (3) `ownerRepository.update(pojo)`, (4) destructive role-rebind via `deleteOwnerRelationsExcept(id, newRoles).then(createRelations(id, newRoles))`, (5) `updateSearchVectors` via `Mono.zip` over two updateChangedOwnerVectors calls, then re-read via `ownerRepository.getDto` and map to `Owner`. 6 round-trips for the no-role case + N extra INSERTs for roles.",
    "`delete(id)` lines 87-100 — `@ReactiveTransactional`. Cascade-block-then-destroy: `Mono.zip(termOwnership.existsByOwner, ownership.existsByOwner, userOwnerMapping.isOwnerAssociated) → .map(BooleanUtils.toBoolean ORs) → .filter(!exists) → .switchIfEmpty(CascadeDeleteException) → .then(deleteOwnerRelationsExcept(id, List.of())) → .then(ownerRepository.delete(id))`. 3 EXISTS reads + 1 DELETE on owner_to_role (N rows) + 1 UPDATE on owner (soft-delete). NO `updateSearchVectors` call — FTS index continues to surface deleted owner's name.",
    "`getOwnerDtoById(ownerId)` lines 102-107 — read-by-id with NotFoundException fallback. The downstream `ownerRepository.getDto` does NOT apply the soft-delete filter on OWNER (per the deleteOwner sidecar's bugs[6] — visibility asymmetry between list and by-id paths).",
    "`updateSearchVectors(owner)` lines 109-114 (private helper) — `Mono.zip` over `searchEntrypointRepository.updateChangedOwnerVectors(id)` and `termSearchEntrypointRepository.updateChangedOwnerVectors(id)` — two parallel UPDATE statements. Called from `update` line 82 ONLY; NOT from `create` or `delete`. The asymmetry is unstated.",
    "`getRoleIdsList(formData)` lines 116-122 (private helper) — collapses null + empty `formData.getRoles()` to `List.of()`. The destructive default at the contract boundary."
  ]
- invariants:
  - "**Transactional boundary at the service-method level, not the class level.** Each of `create` (line 55), `update` (line 69), `delete` (line 88) carries `@ReactiveTransactional` independently. The read methods (`list`, `getOwnerDtoById`, `getOrCreate`) do NOT. A future refactor that consolidates the transactional shape (e.g., a class-level annotation) would silently include the read paths inside transactions — not a correctness break but a connection-pool footprint shift."
  - "**`@ActivityLog` is absent from every method.** Verified by reading the source file at lines 38-122 + Grep of `@ActivityLog` across `<odd-platform-api>/service/*.java` returns 10 files, NONE of them OwnerServiceImpl (TermServiceImpl, OwnershipServiceImpl, DatasetFieldServiceImpl, EnumValueServiceImpl, DataEntityServiceImpl, DatasetFieldInternalInformationServiceImpl, AlertHaltConfigServiceImpl, AlertServiceImpl, DataEntityGroupServiceImpl, DataEntityInternalStateServiceImpl). The Owner directory mutation surface is FORENSICALLY SILENT to the Activity Feed."
  - "**Role-rebind primitive `deleteOwnerRelationsExcept(ownerId, newRoles)` is shared between update and delete.** Line 77 (`update` path with `newRoles = getRoleIdsList(form)`) and line 97 (`delete` path with `List.of()`). The same SQL — `DELETE FROM OWNER_TO_ROLE WHERE OWNER_ID = ? AND ROLE_ID NOT IN (...)` — is the load-bearing implementation. The semantic of an empty `newRoles` (DELETE ALL) is the ONLY way `delete` accomplishes its role-binding hard-delete; the SAME semantic is silently inherited by `update` when the form's `roles` field is null or empty. This is INTENTIONAL at the delete site (line 97 is explicit), and DESTRUCTIVE-BY-DEFAULT at the update site (line 77 is reached via the null+empty collapse in `getRoleIdsList`)."
  - "**`getRoleIdsList` collapses null and empty to `List.of()`** — `if (CollectionUtils.isEmpty(formData.getRoles())) return List.of(); else return formData.getRoles().stream().map(Role::getId).toList()`. The discriminator between 'don't touch' and 'explicitly clear' is LOST at the service layer; the contract (OpenAPI `OwnerFormData.roles` optional with no `required` marker per components.yaml:419-422) carries the ambiguity all the way down."
  - "**`updateSearchVectors` is called from `update` ONLY, not from `create` or `delete`.** Line 82 calls `.flatMap(this::updateSearchVectors)` between the role-rebind and the read-back. The `create` path (lines 54-66) does NOT call `updateSearchVectors` — FTS seeding for the new owner is lazy (happens when a data entity references the owner and triggers `updateChangedOwnerVectors` via OwnershipService). The `delete` path (lines 87-100) does NOT call `updateSearchVectors` — the deleted owner's name continues to surface in FTS results until another event invalidates the affected `search_entrypoint` + `term_search_entrypoint` rows."
  - "**`NotFoundException` asymmetry between update and delete.** `update` line 73 calls `.switchIfEmpty(Mono.error(new NotFoundException(\"Owner\", id)))` BEFORE any mutation — non-existent owner_id produces HTTP 404. `delete` line 98 has NO `switchIfEmpty(NotFoundException)` — non-existent owner_id silently produces HTTP 204 (the downstream `ReactiveAbstractSoftDeleteCRUDRepository.delete` returns empty Mono via the `RETURNING` clause's empty emission). `getOwnerDtoById` line 105 DOES call `.switchIfEmpty(NotFoundException)`. The asymmetry between update (404 on missing) and delete (silent 204 on missing) is unstated."
  - "**Cascade-block is non-atomic.** The three `existsBy*` reads at lines 90-91 (`Mono.zip` over `termOwnership.existsByOwner`, `ownership.existsByOwner`, `userOwnerMapping.isOwnerAssociated`) run inside the `@ReactiveTransactional` boundary but with NO row-level lock on `owner_id` and NO Postgres advisory lock. Under `READ COMMITTED` isolation (Spring/R2DBC default per
        `application.yml` r2dbc defaults), a concurrent `POST /api/dataentities/{id}/ownership` racing with `DELETE /api/owners/{owner_id}` can slip past the cascade-check between the existence read and the soft-delete UPDATE."
  - "**Cascade-block leg asymmetry on soft-delete filters.** `userOwnerMappingRepository.isOwnerAssociated` filters `DELETED_AT IS NULL` per batch-N ReactiveUserOwnerMappingRepositoryImpl sidecar (line 91 of that file). `termOwnership.existsByOwner` (`ReactiveTermOwnershipRepositoryImpl.java:74-80`) and `ownership.existsByOwner` (`ReactiveOwnershipRepositoryImpl.java:120-127`) do NOT filter — but the TERM_OWNERSHIP and OWNERSHIP tables are HARD-DELETE (no `deleted_at` column), so the absence is correct, not a bug. The asymmetry is unstated invariant."
  - "**Soft-delete on owner row + hard-delete on owner_to_role bindings — mixed persistence pattern.** `ownerRepository.delete` (inherited from `ReactiveAbstractSoftDeleteCRUDRepository`) issues `UPDATE owner SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL`. `deleteOwnerRelationsExcept(id, List.of())` issues `DELETE FROM owner_to_role WHERE owner_id = ?`. The choice trades audit history (owner row persists with `deleted_at` set; the partial-unique-index `owner_name_unique ON owner(name) WHERE deleted_at IS NULL` per V0_0_64:70 enables name re-use) against permission revocation (role bindings hard-deleted; permissions revoked immediately; no orphan grant on the owner side). ADR-CANDIDATE-145 codifies this pattern; it is the POSITIVE case-law contrast to F-006's Policy/Role half (which inherits soft-delete on BOTH tiers, leaving orphan grants)."
  - "**OWNER_TO_ROLE has no UNIQUE constraint on (owner_id, role_id) but `createRelations` uses `onDuplicateKeyIgnore()`.** Per `ReactiveOwnerToRoleRepositoryImpl.java:39` the INSERT uses `.onDuplicateKeyIgnore()`. This means: a duplicate role binding (`createRelations(X, [A, A])` or replay of `createRelations(X, [A])` against an existing binding) does NOT throw — the duplicate is silently ignored. Idempotency at the role-binding layer is preserved by this Postgres-side ON CONFLICT semantics."
  - "**`getOrCreate(name)` is the ONLY service-layer write into OWNER that bypasses the `OWNER_CREATE` SecurityRule.** Called by `OwnerAssociationRequestServiceImpl.createOwnerAssociationRequest` (line 57 of that file) to auto-create the Owner row when an authenticated user requests association with an unknown owner name. The OWNER row is created with NO `OWNER_CREATE` permission check; this is intentional (the association-request flow needs to mint the owner so the request has something to point at) but is the documented `permission-bypass-via-owner-auto-create-side-door-write-path` concept in the catalog."
- audiences: [
    "Platform admins / managers (per the live owners doc + the Management → Owners tab; the operator-facing surface that invokes all three lifecycle verbs)",
    "Callers of `getOrCreate` — `OwnerAssociationRequestServiceImpl.createOwnerAssociationRequest` line 57 (the side-door write path) — auto-creates an Owner row during user-owner association request creation",
    "ODD Platform UI — `OwnersList` (batch Q sidecar) is the SOLE UI surface invoking all three lifecycle verbs via OpenAPI-generated thunks",
    "Callers holding the relevant Owner-CRUD permissions per SecurityConstants.SECURITY_RULES[143-147] — `OWNER_CREATE` for POST /api/owners, `OWNER_UPDATE` for PUT /api/owners/{id}, `OWNER_DELETE` for DELETE /api/owners/{id}",
    "OwnershipServiceImpl + TermOwnershipServiceImpl (transitive consumers of `ownerService.getOrCreate(formData.getOwnerName())` to resolve / mint Owner rows during the data-entity ↔ owner relationship establishment) — sole runtime consumers besides OwnerController + OwnerAssociationRequestServiceImpl"
  ]

## dependencies_semantic

- requires-feature: [
    "Owner directory feature — `Management → Owners` (live `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/owners`, WebFetched in batch P 2026-05-20 status 200)",
    "Authorization framework — `OWNER_CREATE` / `OWNER_UPDATE` / `OWNER_DELETE` permissions consumed by `SecurityConstants.SECURITY_RULES[143-147]` (the centralised permission gate — no @PreAuthorize on this class)",
    "Soft-delete CRUD framework — `ReactiveAbstractSoftDeleteCRUDRepository` parent of `ReactiveOwnerRepositoryImpl` (line 43 of that file); the `delete(id)` semantic and the soft-delete `listCondition` enforcement",
    "Search-vector indexing — `SearchEntrypoint` + `TermSearchEntrypoint` tables refreshed by `updateSearchVectors` (lines 109-114)",
    "Cascade-error machinery — `CascadeDeleteException` + `ErrorCode.CASCADE_DELETE` (USR004) + `ControllerAdvice.handleCascadeDelete` mapping to HTTP 400 (per F-006 batch K cross-batch correction)",
    "User-owner-association feature — `userOwnerMappingRepository.isOwnerAssociated` (one of the three cascade-block legs at line 91; protects against deleting an owner whose user-binding is still active)"
  ]
- requires-config: [] — N/A. This class reads NO `@Value`, NO `@ConfigurationProperties`. The class is unconditional on `auth.type` — under `auth.type=DISABLED` the SecurityRule gates at SecurityConstants.SECURITY_RULES[143-147] are bypassed by the WebFlux filter chain (per DisabledAuthSecurityConfiguration.java:11-19 + REFACTOR-185 enumeration), making `create / update / delete` anonymously reachable (17th + 18th + 19th REFACTOR-185 surfaces).
- requires-runtime: [
    "Spring WebFlux runtime — `Mono<...>` return types throughout; reactive composition via `flatMap`, `Mono.zip`, `.then`, `.thenReturn`",
    "jOOQ reactive DB session — every downstream repository call routes through `JooqReactiveOperations` (`R2dbcEntityTemplate`-backed); the @ReactiveTransactional boundary is enforced by Spring's reactive transaction manager",
    "PostgreSQL `owner` table with partial unique index `owner_name_unique ON owner(name) WHERE deleted_at IS NULL` (V0_0_64__remove_is_deleted_field.sql:68-70) — enables name re-use after soft-delete",
    "PostgreSQL `owner_to_role` join table — HARD-DELETE target via `deleteOwnerRelationsExcept`; `onDuplicateKeyIgnore` semantic on `createRelations` (ReactiveOwnerToRoleRepositoryImpl.java:39)",
    "PostgreSQL `ownership`, `term_ownership`, `user_owner_mapping`, `owner_association_request` tables — cascade-check sources (first three checked; `owner_association_request` NOT checked — REFACTOR-427 orphan-row gap)",
    "PostgreSQL `search_entrypoint` + `term_search_entrypoint` FTS-vector tables — refreshed via `updateSearchVectors` on update only, NOT on create or delete"
  ]
- coupling: [
    "Implements `OwnerService` interface (`OwnerService.java:10-26`) — 6 methods: getOrCreate / list / create / update / delete / getOwnerDtoById",
    "Injects 7 reactive repositories + 1 mapper (lines 29-36): `ReactiveOwnerRepository` (line 29) + `ReactiveUserOwnerMappingRepository` (line 30, used in cascade-block leg via `isOwnerAssociated`) + `ReactiveSearchEntrypointRepository` (line 31, used in `updateSearchVectors`) + `ReactiveTermSearchEntrypointRepository` (line 32, used in `updateSearchVectors`) + `ReactiveTermOwnershipRepository` (line 33, used in cascade-block leg via `existsByOwner`) + `ReactiveOwnershipRepository` (line 34, used in cascade-block leg via `existsByOwner`) + `ReactiveOwnerToRoleRepository` (line 35, used in role-rebind primitive) + `OwnerMapper` (line 36, MapStruct, used for pojo↔DTO transformations)",
    "`OwnerMapper.applyToPojo` (line 18 of mapper file) — MapStruct generates IN-PLACE pojo mutation via `@MappingTarget`; the form's `name` field overrides the existing pojo's name; `roles` on the form is NOT a pojo field (roles are managed externally via owner_to_role) — the mapper is silent on it",
    "`OwnerToRolePojo` constructor (used by `ReactiveOwnerToRoleRepositoryImpl.createRelations` lines 29-32) — `new OwnerToRolePojo(ownerId, roleId)` per role",
    "`@ReactiveTransactional` — custom annotation at `org.opendatadiscovery.oddplatform.annotation.ReactiveTransactional` (line 7); the reactive transaction-management AOP aspect enforcing the multi-statement transactional boundary",
    "`CascadeDeleteException` (line 12) — error type raised at lines 95-96; mapped to HTTP 400 USR004 via ControllerAdvice",
    "`NotFoundException` (line 13) — error type raised at lines 73, 105; mapped to HTTP 404 via ControllerAdvice"
  ]

## upstream_callers

- **OwnerController.createOwner** — `OwnerController.java:22-27` invokes `ownerService.create(formData)` via `ownerFormData.flatMap(ownerService::create).map(ResponseEntity::ok)`. The sole HTTP entry point for the `create` method. Confidence: HIGH.
- **OwnerController.getOwnerList** — `OwnerController.java:30-38` invokes `ownerService.list(page, size, query, ids, allowedForSync).map(ResponseEntity::ok)`. The sole HTTP entry point for `list`. Confidence: HIGH.
- **OwnerController.deleteOwner** — `OwnerController.java:41-45` invokes `ownerService.delete(ownerId).thenReturn(ResponseEntity.noContent().build())`. The sole HTTP entry point for `delete`. Confidence: HIGH.
- **OwnerController.updateOwner** — `OwnerController.java:47-54` invokes `ownerService.update(ownerId, form)` via `ownerFormData.flatMap(form -> ownerService.update(ownerId, form)).map(ResponseEntity::ok)`. The sole HTTP entry point for `update`. Confidence: HIGH.
- **OwnerAssociationRequestServiceImpl.createOwnerAssociationRequest** — `OwnerAssociationRequestServiceImpl.java:57` invokes `ownerService.getOrCreate(ownerName)` inside the OwnerAssociationRequest creation flow. This is the **permission-bypass-via-owner-auto-create-side-door** write path: the request submission auto-creates the Owner row IF the named owner does not exist, bypassing the `OWNER_CREATE` SecurityRule (which only gates `POST /api/owners`). The caller needs only `OWNER_ASSOCIATION_*` permissions, not `OWNER_CREATE`. Confidence: HIGH.
- **OwnershipServiceImpl.create** — `OwnershipServiceImpl.java:52` invokes `ownerService.getOrCreate(formData.getOwnerName())` in `Mono.zip(ownerService.getOrCreate(...), titleService.getOrCreate(...))` — auto-creates an Owner if the data-entity-ownership creation references an unknown owner name. Second `permission-bypass-via-owner-auto-create-side-door` site (same pattern, different caller). Confidence: HIGH.
- **TermOwnershipServiceImpl.create** — `TermOwnershipServiceImpl.java:30-something` invokes `ownerService.getOrCreate(formData.getOwnerName())` (parallel to OwnershipServiceImpl — confirmed via Grep of `ownerService\.` returning this file). Same side-door pattern on the term-ownership half. Confidence: HIGH.

## downstream_side_effects

- **INSERT into `owner`** (create line 60 via `ownerRepository::create`, getOrCreate line 41 via the same primitive): writes a new row `(id (auto), name, deleted_at=null, created_at, updated_at)`. The partial unique index `owner_name_unique` (V0_0_64:70) blocks insert when an ACTIVE row with the same name exists. Side-effects: (a) increments row count permanently; (b) NO trigger, NO activity event emitted (REFACTOR-426); (c) the new owner is INVISIBLE to FTS until a downstream event refreshes the affected `search_entrypoint` row (the create path does NOT call `updateSearchVectors`).
- **UPDATE `owner SET name = ?, updated_at = ?`** (update line 75 via `ownerRepository::update`): mutates the row identified by `id` (inherits the soft-delete-aware `idCondition` which adds `deleted_at IS NULL`). Side-effects: (a) updates `updated_at` automatically (Postgres trigger or jOOQ-side timestamp); (b) USER_OWNER_MAPPING.owner_id continues to point at the same Owner identity — the FK is by id, not name; rename is SAFE for the user-owner mapping per the load-bearing batch-N invariant; (c) NO activity event emitted (REFACTOR-426); (d) the partial unique index serializes concurrent renames to the same name (one wins, others throw USR003).
- **UPDATE `owner SET deleted_at = NOW()`** (delete line 98 via `ownerRepository.delete` inheriting `ReactiveAbstractSoftDeleteCRUDRepository.delete`): soft-deletes the row. Side-effects: (a) the name is FREED for re-use via the partial-unique-index pattern; (b) the row persists with `deleted_at` set (audit-history-preserving); (c) FTS search vectors are NOT refreshed — catalog search continues to surface the deleted owner's name until other events invalidate the affected entities; (d) `owner_association_request` rows with this owner_id are LEFT ORPHANED (the cascade-block doesn't check this table — REFACTOR-427); (e) NO activity event emitted (REFACTOR-426).
- **DELETE FROM `owner_to_role` WHERE owner_id = ?** (update line 77 with `newRoles = []` OR explicit empty; delete line 97 with `List.of()`): HARD-DELETES all role bindings for the owner. Side-effects: (a) immediate permission revocation (no orphan grant on the owner side — ADR-CANDIDATE-145 positive case-law); (b) the role-binding history is PERMANENTLY LOST (no soft-delete, no audit row); (c) under the update path with destructive-default semantics (REFACTOR-425), any API consumer omitting `roles` from `OwnerFormData` silently strips all bindings; (d) NO activity event emitted (REFACTOR-426).
- **INSERT INTO `owner_to_role` ... ON DUPLICATE KEY IGNORE** (create line 62 with N-row INSERT; update line 80 with N-row INSERT): writes N rows for the new role set. Side-effects: (a) `onDuplicateKeyIgnore` (ReactiveOwnerToRoleRepositoryImpl.java:39) tolerates pre-existing rows — idempotent at the role-binding layer; (b) NO trigger, NO activity event.
- **UPDATE `search_entrypoint SET search_vector = ...`** (update line 82 via `updateSearchVectors` → `searchEntrypointRepository.updateChangedOwnerVectors(id)`): rewrites FTS vectors for every `search_entrypoint` row referencing this owner's name. Side-effects: (a) cost scales with the count of data entities the owner bears; (b) FTS index reflects the new owner name immediately after the transaction commits; (c) called ONLY on `update` path — not on `create` (FTS seeding is lazy) or `delete` (the deleted name persists in FTS until other events invalidate).
- **UPDATE `term_search_entrypoint SET search_vector = ...`** (update line 82 via `updateSearchVectors` → `termSearchEntrypointRepository.updateChangedOwnerVectors(id)`): symmetric to the above for the term-side FTS index. Same call-site, same semantic. Called via `Mono.zip` in parallel with the data-entity FTS refresh.
- **SELECT EXISTS** (delete lines 90-91 via 3 cascade-block legs — `existsByOwner` × 2 + `isOwnerAssociated`): 3 boolean reads. Side-effects in callers: the cascade-block result determines whether the destructive writes fire (no writes if any leg returns true; CascadeDeleteException raised → HTTP 400 USR004).
- **SELECT-with-joins** (multiple sites — line 64 via `getDto` after create, line 83 via `getDto` after update, line 104 via `getDto` for by-id reads, line 50 via `list`): read paths returning the joined Owner DTO. The `getDto` query does NOT apply the `deleted_at IS NULL` filter on OWNER (visibility asymmetry — soft-deleted owners visible via direct by-id reads); `list` DOES apply the filter via `enrichSelect → listCondition`.

## tests_coverage_semantic

- covered_behaviours: [] — N/A. The service-tier OwnerServiceImpl has NO unit tests; verified via Grep `OwnerServiceImpl|OwnerService\.` across `<odd-platform-api>/src/test` returning zero files (2026-05-20). The closest test is `OwnerRepositoryImplTest.testDeletesOwner` at the repository tier (per deleteOwner sidecar) — covers `ownerRepository.delete` soft-delete contract, not the service's cascade-block + role-rebind + search-vector logic.
- uncovered_behaviours:
  - "`create` happy path — assert (a) INSERT into owner + (b) N INSERTs into owner_to_role + (c) read-back via getDto returns the new Owner with role bindings + (d) NO call to updateSearchVectors. Pin the FTS-seeding-is-lazy contract."
    test_class: "OwnerServiceImplTest"
  - "`create` with name collision against active owner — assert UniqueConstraintException via the partial unique index `owner_name_unique`; verify the mapping to USR003/HTTP 400 (F-006 batch K cross-batch correction)."
    test_class: "OwnerServiceImplTest"
  - "`create` with name matching SOFT-DELETED owner — assert success; the partial unique index excludes soft-deleted rows so the new owner gets a fresh id with the re-used name. Pin the LSN-018 case-law correction (the createOwner batch-E claim of non-partial UNIQUE was wrong — V0_0_64 makes it partial)."
    test_class: "OwnerServiceImplTest"
  - "`update` happy path with new name + new roles — assert (a) ownerRepository.get + applyToPojo + UPDATE owner + DELETE owner_to_role (orphan rows from old roles) + INSERT owner_to_role (new roles) + UPDATE × 2 search_entrypoint/term_search_entrypoint + read-back via getDto. Pin the 6-step pipeline."
    test_class: "OwnerServiceImplTest"
  - "**`update` with `roles=[]` DESTROYS all role bindings — the REFACTOR-425 destructive UX hazard regression pin (HIGHEST PRIORITY)**. Seed Owner X with roles [A, B]; PUT with `OwnerFormData{name: 'X', roles: []}`; assert (a) the call succeeds with HTTP 200; (b) owner_to_role rows for owner_id=X are gone; (c) NO @ActivityLog event in the activity feed. Pin this as the CURRENT destructive contract (regression pin BEFORE the fix; convert to regression FOR the fix once REFACTOR-425 ships Path A — required `roles` field at OpenAPI)."
    test_class: "OwnerServiceImplTest"
  - "`update` with `roles=null` (omitted field) — assert the same destructive behaviour as `roles=[]`. Pin the `getRoleIdsList` null+empty collapse at lines 116-122."
    test_class: "OwnerServiceImplTest"
  - "`update` with non-existent ownerId — assert NotFoundException via `switchIfEmpty` at line 73; verify HTTP 404 mapping."
    test_class: "OwnerServiceImplTest"
  - "`update` USER_OWNER_MAPPING survives rename — seed user_owner_mapping for owner X; PUT with new name; assert the mapping STILL resolves to the same Owner (FK is by id, not name). The structural safety is provable from V0_0_4:3; the regression-pin protects against a future refactor accidentally changing the FK."
    test_class: "OwnerServiceImplTest"
  - "`update` name collision against another active owner — assert UniqueConstraintException via the partial unique index; verify USR003/HTTP 400. Cross-link to F-006 batch K USR003-vs-USR009 correction."
    test_class: "OwnerServiceImplTest"
  - "`update` search-vector refresh in same transaction — seed Owner X with N data entities bearing X as owner; PUT rename; assert FTS searches by OLD name return zero AND searches by NEW name return the N entities. Both `updateChangedOwnerVectors` legs MUST fire."
    test_class: "OwnerServiceImplTest"
  - "`delete` cascade-block leg (a) termOwnership — seed term_ownership row for owner X; DELETE owner X; assert CascadeDeleteException → HTTP 400 USR004."
    test_class: "OwnerServiceImplTest"
  - "`delete` cascade-block leg (b) ownership — seed ownership row for owner X; DELETE owner X; assert CascadeDeleteException."
    test_class: "OwnerServiceImplTest"
  - "`delete` cascade-block leg (c) userOwnerMapping — seed active user_owner_mapping for owner X; DELETE owner X; assert CascadeDeleteException. Cross-ref: F-011 batch-N `isOwnerAssociated returns false after deleteActiveRelationByOwner` uncovered_behaviour — the cascade-block leg is the sole runtime consumer."
    test_class: "OwnerServiceImplTest"
  - "`delete` cascade-block leg independence — separate tests per leg; a regression that flips an OR to an AND in the predicate at lines 92-93 would silently allow deletion when only one cascade was present. Pin the OR semantics."
    test_class: "OwnerServiceImplTest"
  - "`delete` OWNER_TO_ROLE hard-delete — seed Owner X with roles [A, B]; DELETE owner X (no cascade); assert owner_to_role rows for owner_id=X are gone (NOT soft-deleted). Pin the ADR-CANDIDATE-145 mixed-persistence contract."
    test_class: "OwnerServiceImplTest"
  - "`delete` soft-delete of owner row — assert `UPDATE owner SET deleted_at = NOW()` (not DELETE FROM); verify the row persists with `deleted_at IS NOT NULL` (the partial-unique-index name-re-use contract depends on this)."
    test_class: "OwnerServiceImplTest"
  - "`delete` does NOT refresh search vectors — assert NO call to `updateSearchVectors`; verify FTS index still surfaces the deleted owner's name (REFACTOR-428 asymmetry pin)."
    test_class: "OwnerServiceImplTest"
  - "`delete` does NOT cascade owner_association_request — seed owner_association_request for owner X; DELETE owner X (no other cascade); assert success AND the association request row PERSISTS with the now-soft-deleted owner_id (REFACTOR-427 orphan-row pin)."
    test_class: "OwnerServiceImplTest"
  - "`delete` idempotency — call DELETE twice for the same id; assert both succeed with HTTP 204 (the second call's `ownerRepository.delete` returns empty Mono via the `RETURNING` clause filtered by `deleted_at IS NULL`; `.then().thenReturn(noContent())` propagates empty as success). Pin the silent-204 contract (REFACTOR-429)."
    test_class: "OwnerServiceImplTest"
  - "`delete` non-existent id — assert HTTP 204, NOT 404 (the asymmetry vs `update` which raises NotFoundException at line 73)."
    test_class: "OwnerServiceImplTest"
  - "`delete` race-window — concurrent `POST /api/dataentities/{id}/ownership` for owner X racing with `DELETE /api/owners/X`; assert the test pins the CURRENT non-atomic behaviour (occasionally an orphan OWNERSHIP row pointing at the soft-deleted owner). Cross-ref REFACTOR-430."
    test_class: "OwnerServiceImplConcurrencyTest"
  - "`getOrCreate` happy path — assert (a) returns existing OwnerPojo if name matches an active row; (b) creates new OwnerPojo if no active row; (c) returns the soft-deleted-name-recovery case correctly (creates a NEW pojo with a fresh id when the existing name belongs to a soft-deleted row, per V0_0_64 partial-unique-index)."
    test_class: "OwnerServiceImplTest"
  - "`getOrCreate` permission-bypass — confirm `getOrCreate` is callable from `OwnerAssociationRequestServiceImpl.createOwnerAssociationRequest` WITHOUT the caller holding `OWNER_CREATE`. Pin the side-door write path as the EXPECTED behaviour (or surface as a security finding if the maintainer chooses to fix)."
    test_class: "OwnerServiceImplTest + OwnerAssociationRequestServiceImplTest"
  - "`getOwnerDtoById` happy path — assert returns OwnerDto for an active owner; NotFoundException for a non-existent id; **returns the SOFT-DELETED row when called with a soft-deleted owner's id** (the visibility asymmetry per deleteOwner sidecar bugs[6]). Pin the asymmetry."
    test_class: "OwnerServiceImplTest"
  - "`list` happy path — assert pagination, query filter, ids filter, allowedForSync filter; assert soft-deleted owners are HIDDEN (the `listCondition` filter)."
    test_class: "OwnerServiceImplTest"
  - "Audit-silence regression pin — exercise create / update / delete; assert ZERO `OWNER_*_CREATED/UPDATED/DELETED` events in the activity feed (the current REFACTOR-426 contract). Pin BEFORE the fix; convert to regression FOR the fix once @ActivityLog is added."
    test_class: "OwnerServiceImplActivityFeedTest"
  - "Transactional rollback — inject a failure between owner UPDATE and the role-rebind (e.g., a mocked exception from `ownerToRoleRepository.deleteOwnerRelationsExcept`); assert the OWNER row is rolled back to the pre-call state (the @ReactiveTransactional boundary covers all writes including the search-vector UPDATE)."
    test_class: "OwnerServiceImplTransactionalTest"
- test_files: [] — N/A. Zero tests touch this service. The closest test in the entire codebase is `OwnerRepositoryImplTest.testDeletesOwner` (repository-tier soft-delete smoke test, per deleteOwner sidecar tests_coverage_semantic).
- gaps: |
    OwnerServiceImpl is the SERVICE-TIER CLOSURE of the Owner lifecycle —
    every drift facet surfaced by the 3 controller-method sidecars +
    the UI sidecar has its persistence-layer origin in this file. The
    file is 123 lines, contains 6 public methods + 2 private helpers,
    runs 3 transactions per request (one per mutating verb), and HAS
    NOT BEEN UNIT-TESTED. The destructive-empty-roles regression test
    is the HIGHEST-PRIORITY missing test in the entire ODD platform
    repository: a `roles=[]` PUT silently strips all role bindings on
    any Owner, with no audit trail, no UI confirmation, and the API
    contract treats it as a valid request. A `@WebFluxTest` or
    `@SpringBootTest` exercising this scenario would surface the
    REFACTOR-425 hazard immediately. The cascade-block leg
    independence test is the second-highest priority: a maintainer
    refactor that accidentally flipped one of the three OR conjuncts
    to AND would silently allow deletion of Owners with active
    bindings, producing the orphan-row scenarios that REFACTOR-430 +
    REFACTOR-427 enumerate. The transactional rollback test is the
    third-highest priority: any failure mid-pipeline (e.g., the
    second `updateChangedOwnerVectors` UPDATE failing) should rollback
    the owner UPDATE + the role-rebind — this is asserted by code
    reading + the `@ReactiveTransactional` annotation, but not by any
    automated test.

## docs_link_semantic

- declared_docs: [] — N/A. The source file carries no `@docs` Javadoc annotation; consistent with `odd-platform-api` convention.
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/owners"
    anchor: ""
    rationale: "The live owners doc — defines the Owner concept and points operators at Management → Owners. The service-tier shapes the behaviour the operator experiences."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    last_verified_via: "Inherited from updateOwner.md + deleteOwner.md (batch P, WebFetched 2026-05-20 status 200) — within stale-probe cadence window"
    confidence: HIGH
    fetched_excerpts: |
      Coverage absence (verbatim from WebFetched content per batch-P deleteOwner sidecar
      fetched_excerpts): "The page is silent on all requested topics: No description of
      what happens when an Owner is deleted, no mention of association removal behavior,
      no cascade behavior specifications, no soft-delete semantics discussed, no
      idempotency guarantees stated, no clarification on deletion permissions or
      OWNER_DELETE, no reference to orphan bindings or binding persistence after
      deletion, no specification of who can delete owners."
      Owner definition (verbatim from updateOwner.md): "Owners are Data Owners — people
      who manage and maintain a particular data entity or term." + "You can manage
      owners in the Management → Owners tab."
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions"
    anchor: ""
    rationale: "The live permissions doc — defines `OWNER_CREATE` / `OWNER_UPDATE` / `OWNER_DELETE` verbatim. Each gates one of this service's mutating methods."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    last_verified_via: "Inherited from updateOwner.md + deleteOwner.md (batch P, WebFetched 2026-05-20)"
    confidence: HIGH
    fetched_excerpts: |
      Permission definitions (verbatim from batch-P updateOwner + deleteOwner sidecars):
      "OWNER_CREATE: Allows creating a new owner entity."
      "OWNER_UPDATE: Allows editing an existing owner."
      "OWNER_DELETE: Allows deleting an owner."
      "OWNER_RELATION_MANAGE: Allows accepting or declining ownership association requests."
      "OWNER_ASSOCIATION_MANAGE: Allows approving or denying user-owner association requests."
      "DIRECT_OWNER_SYNC: Allows associating a user with an owner without an approval request."
      The page does NOT enumerate what "editing" / "deleting" covers, the cascade-delete
      contract, the destructive-empty-roles UX hazard, the audit-silence pattern, or any
      side effects on USER_OWNER_MAPPING / OWNER_TO_ROLE / search_entrypoint.
- doc_drift_findings:
  - "**Live owners doc is SILENT on Owner-lifecycle mechanics — service-tier confirmation of batch-P controller-tier finding.** The doc defines what an Owner IS but says NOTHING about: rename mechanics (USER_OWNER_MAPPING safe-rename per FK by id), cascade-delete contract (3 legs at lines 90-91; 4th-table orphan-row gap at owner_association_request), soft-delete + name-recovery workflow (partial-unique-index pattern), role-rebind destructive-empty UX (REFACTOR-425), audit-silence (REFACTOR-426), or search-vector refresh asymmetry between update (refreshes) and create/delete (do not). This sidecar's role: surface the service-tier persistence-layer reality as the canonical-source-of-truth for the future doc rewrite."
  - "**Live permissions doc lists `OWNER_*` permissions verbatim but is silent on the per-method side effects.** A maintainer reading `OWNER_UPDATE: Allows editing an existing owner.` cannot predict that 'editing' includes destructive role-rebind on empty `roles` field. A maintainer reading `OWNER_DELETE: Allows deleting an owner.` cannot predict that 'deleting' means soft-delete + hard-delete of OWNER_TO_ROLE bindings + cascade-block on 3 of 4 owner-bearing tables + orphan rows in the 4th. Service-tier source: lines 68-100 are the load-bearing implementation; the live doc carries the names without the semantics."

## implicit_adrs

- "**@ReactiveTransactional boundary at the service-method level, not the controller and not the class** — encoded by the three independent annotations at lines 55, 69, 88. The maintainer's choice: scope each mutating verb's multi-statement write into ONE logical commit, while leaving the read methods (`list`, `getOwnerDtoById`, `getOrCreate`) connection-pool-light. A class-level annotation would have folded the reads into transactions — the maintainer specifically chose per-method placement. Cross-link to the platform-wide pattern (DataEntityServiceImpl, AlertServiceImpl, OwnershipServiceImpl all follow the same shape)." — evidence: `OwnerServiceImpl.java:54-55, 68-69, 87-88` (three @ReactiveTransactional placements; no class-level annotation) + `OwnerServiceImpl.java:44-52, 102-107, 38-42` (the three transaction-free read methods) — intent_anchor: "@ReactiveTransactional placed on `create` (line 55), `update` (line 69), `delete` (line 88) — three independent annotations, not a class-level one — the maintainer deliberately scoped transactions to each mutating verb" — confidence: HIGH

- "**Role-rebind is SET-REPLACEMENT not field-merge — encoded by the `deleteOwnerRelationsExcept(ownerId, newRoles).then(createRelations(ownerId, newRoles))` primitive shared between update line 76-81 and delete line 97.** REST-PUT semantics: PUT means 'the new state IS this set', not 'merge this set into the current state'. The intent is operator-readable: a deleted owner SHOULD NOT continue to confer their previously-attached roles' permissions; a re-binding via update REPLACES the role list. Cross-link to ADR-CANDIDATE-144. The destructive-empty corollary at update (REFACTOR-425) is the operational hazard of the semantic." — evidence: `OwnerServiceImpl.java:76-81` (update path) + `OwnerServiceImpl.java:97` (delete path with `List.of()` explicit) + `OwnerServiceImpl.java:117-122` (getRoleIdsList — the destructive default surface) + ReactiveOwnerToRoleRepositoryImpl.java:52-56 (the SQL primitive) — intent_anchor: "`deleteOwnerRelationsExcept(owner.getId(), newRoles).thenReturn(owner)` + `createRelations(owner.getId(), newRoles).thenReturn(owner)` shared between update and delete — the destructive empty-list call at line 97 is impossible to reach by accident; the maintainer deliberately uses the same primitive on both paths" — confidence: HIGH

- "**Mixed soft+hard-delete persistence at the delete path** — encoded by `deleteOwnerRelationsExcept(id, List.of())` (HARD-delete on owner_to_role, line 97) followed by `ownerRepository.delete(id)` (SOFT-delete UPDATE setting `deleted_at = NOW()`, line 98, inherited from ReactiveAbstractSoftDeleteCRUDRepository). The choice trades audit history (owner row persists with `deleted_at` set; the partial-unique-index `owner_name_unique` enables name re-use per V0_0_64) against permission revocation (role bindings hard-deleted; permissions revoked immediately). ADR-CANDIDATE-145 codifies this as the POSITIVE case-law contrast to F-006's Policy/Role half (which inherits soft-delete on both tiers, leaving orphan grants)." — evidence: `OwnerServiceImpl.java:97-98` (the two-line `delete` cascade) + `ReactiveOwnerToRoleRepositoryImpl.java:52-56` (DSL.delete primitive) + `ReactiveAbstractSoftDeleteCRUDRepository.delete` + V0_0_64__remove_is_deleted_field.sql:68-70 — intent_anchor: "the explicit two-line sequence `.then(ownerToRoleRepository.deleteOwnerRelationsExcept(id, List.of())).then(ownerRepository.delete(id)).then()` — the role-binding hard-delete is the FIRST step, the owner row soft-delete is the SECOND — the ordering is deliberate (revoke permissions before marking the row deleted)" — confidence: HIGH

- "**Cascade-block is FAIL-FAST via Mono.zip + 3-leg OR predicate** — encoded at lines 90-93. The three existence checks fire in PARALLEL (Mono.zip evaluates legs concurrently against the reactive connection pool), the results are OR'd via `BooleanUtils.toBoolean(t.getT1()) || BooleanUtils.toBoolean(t.getT2()) || BooleanUtils.toBoolean(t.getT3())`, and ANY true result short-circuits to `CascadeDeleteException`. The maintainer's choice: amortise the cascade-check across 3 parallel queries rather than 3 sequential ones (latency wins for the no-cascade case)." — evidence: `OwnerServiceImpl.java:90-96` — intent_anchor: "`Mono.zip(termOwnershipRepository.existsByOwner(id), ownershipRepository.existsByOwner(id), userOwnerMappingRepository.isOwnerAssociated(id)).map(t -> BooleanUtils.toBoolean(t.getT1()) || BooleanUtils.toBoolean(t.getT2()) || BooleanUtils.toBoolean(t.getT3())).filter(exists -> !exists).switchIfEmpty(Mono.error(new CascadeDeleteException(...)))`" — confidence: HIGH

- "**Search-vector refresh INSIDE the update transaction, not deferred to a background job** — encoded at line 82 + the `updateSearchVectors` helper at lines 109-114. The choice trades response latency for read-after-write consistency: an UPDATE that completes guarantees searches by the new name return the renamed owner immediately. The alternative (background refresh) would shorten the response time but introduce a search-staleness window. The asymmetry (create + delete do NOT call this helper) is the operational corollary: the maintainer optimised the rename path for read-after-write, accepted lazy-FTS-seeding for new owners (search picks up the name when downstream data entities reference it), and accepted stale-FTS-on-delete (the deleted owner's name lingers in search until other events invalidate)." — evidence: `OwnerServiceImpl.java:82, 109-114` (call + helper) + the absence of the same call at lines 60-64 (create) and lines 96-99 (delete) — intent_anchor: "the private helper `updateSearchVectors` exists and is reachable only from line 82; the create + delete pipelines deliberately omit it; the maintainer's intent is asymmetric (rename refreshes, create + delete defer)" — confidence: MEDIUM (the asymmetry is structural-impact STRUCTURAL but the maintainer's intent for the asymmetry is not commented — could be deliberate or an oversight)

## bugs_limitations_corner_cases

- "**The destructive empty-roles UPDATE lives HERE — service-tier closure of REFACTOR-425.** The hazardous semantic is composed across THREE source-file lines: (a) `OwnerServiceImpl.java:71` (`final List<Long> newRoles = getRoleIdsList(updateEntityForm);`) — the call to the helper; (b) lines 117-122 of the same file (`getRoleIdsList`) — the null+empty collapse to `List.of()`; (c) lines 76-81 — the `deleteOwnerRelationsExcept(ownerId, List.of()).then(createRelations(ownerId, List.of()))` cascade which the empty list reaches at the persistence layer (REFACTOR-425's primary source). An API consumer issuing `PUT /api/owners/{id}` with `OwnerFormData{name: 'X'}` (omitting `roles`) is treated identically to `PUT` with `{name: 'X', roles: []}` — both produce `getRoleIdsList → List.of() → deleteOwnerRelationsExcept(ownerId, []) → DELETE FROM OWNER_TO_ROLE WHERE OWNER_ID = ?`. ALL role bindings are stripped. The destructive behaviour is reachable from the UI in three clicks per the OwnersList batch-Q sidecar (Edit → remove all role TagItems → Save) AND from any API consumer that omits `roles`. NO @ActivityLog. NO confirmation modal in the UI. NO partial-update mechanism. **This sidecar is the load-bearing service-tier primary source for the highest-priority finding in F-019.**" — evidence: `OwnerServiceImpl.java:71, 76-81, 117-122` + REFACTOR-425.md (which cites this sidecar's predecessors as primary sources) + components.yaml:419-422 (roles optional, no required marker) + ReactiveOwnerToRoleRepositoryImpl.java:52-56 (the SQL primitive) — severity: HIGH

- "**`@ActivityLog` is absent from ALL THREE lifecycle methods — service-tier confirmation of REFACTOR-426.** Verified by Grep `@ActivityLog` across `<odd-platform-api>/service/*.java` 2026-05-20 returning 10 files: AlertServiceImpl, AlertHaltConfigServiceImpl, DataEntityServiceImpl, DataEntityGroupServiceImpl, DataEntityInternalStateServiceImpl, DatasetFieldServiceImpl, DatasetFieldInternalInformationServiceImpl, EnumValueServiceImpl, OwnershipServiceImpl, TermServiceImpl — NONE of them OwnerServiceImpl. The Activity Feed therefore records NO events for create / update / delete. The 6-sidecar audit-silence pattern (createOwner E + updateOwner P + deleteOwner P + RoleController N + PolicyController N + Reactive*RepositoryImpls N) is fully service-tier-anchored here. Combined with the destructive empty-roles update (above), role-stripping is silent AND irrecoverable from logs." — evidence: `OwnerServiceImpl.java:38-122` (no @ActivityLog) + Grep 2026-05-20 + OwnershipServiceImpl.java:48,77,100 (the CONTRAST — Ownership IS audited; Owner is not) — severity: HIGH

- "**Cascade-check is NOT atomic with the soft-delete that follows — REFACTOR-430 race-window service-tier primary source.** The three `existsBy*` reads at lines 90-91 do NOT acquire row-level locks (no `SELECT FOR UPDATE`, no Postgres advisory lock on `owner_id`). The downstream writes — `deleteOwnerRelationsExcept(id, List.of())` line 97 and `ownerRepository.delete(id)` line 98 — run inside the @ReactiveTransactional boundary (line 88) but under `READ COMMITTED` isolation (Spring/R2DBC default). A concurrent `POST /api/dataentities/{id}/ownership` racing with `DELETE /api/owners/{owner_id}` can slip a fresh OWNERSHIP row past the cascade-check. Result: an OWNERSHIP row pointing to a soft-deleted OWNER. The race window is bounded by the transaction duration (~3 EXISTS queries) — narrow but observable. MIRRORS F-006 batch I `PolicyServiceImpl.delete` cascade-check non-atomicity." — evidence: `OwnerServiceImpl.java:88-100` (the cascade-check + delete in one @ReactiveTransactional but no FOR UPDATE) + REFACTOR-430.md (the dedicated scope) + F-006 batch I observed_vs_expected.facet `cascade_check_non_atomic` — severity: MEDIUM

- "**`delete` does NOT cascade `owner_association_request` — REFACTOR-427 orphan-row gap, service-tier confirmation.** The cascade-block at lines 90-91 checks `termOwnership` + `ownership` + `userOwnerMapping`. It does NOT check `owner_association_request`. The owner_association_request table has an FK to owner(id) (V0_0_51__add_owner_association_request.sql:11) but NO `ON DELETE` clause (defaults to NO ACTION); because Owner uses soft-delete (UPDATE deleted_at, not DELETE FROM), the FK is never consulted. A `PENDING` or `APPROVED` owner_association_request for the just-deleted Owner persists as an orphan. The next `GET /api/owner_association_request` listing query surfaces the orphan row." — evidence: `OwnerServiceImpl.java:90-91` (3 cascade checks; no owner_association_request) + V0_0_51__add_owner_association_request.sql:11 (FK no ON DELETE) + REFACTOR-427.md — severity: MEDIUM

- "**`delete` does NOT refresh FTS search vectors — REFACTOR-428 asymmetry, service-tier confirmation.** `OwnerServiceImpl.update` calls `updateSearchVectors(owner)` at line 82, refreshing both `searchEntrypointRepository.updateChangedOwnerVectors` and `termSearchEntrypointRepository.updateChangedOwnerVectors` (lines 109-114). `OwnerServiceImpl.delete` does NOT (lines 87-100 contain no such call). After successful delete, the FTS index continues to surface the deleted owner's name when users search the catalog (matches against `search_entrypoint.search_vector` for data entities the owner bore, until those entities are otherwise modified). MIRRORS F-006 batch-K `delete_search_vector_not_refreshed` facet from OwnershipServiceImpl." — evidence: `OwnerServiceImpl.java:82` (update CALLs updateSearchVectors) vs `OwnerServiceImpl.java:87-100` (delete does NOT) + REFACTOR-428.md — severity: MEDIUM

- "**Silent-204 idempotency on `delete` — REFACTOR-429 service-tier confirmation.** `OwnerServiceImpl.delete` has NO `switchIfEmpty(Mono.error(NotFoundException))` on `ownerRepository.delete(id)` (line 98). The repository's soft-delete UPDATE filters `idCondition` which adds `deleted_at IS NULL` (`ReactiveAbstractSoftDeleteCRUDRepository.java:76-79`); calling `delete(id)` against a non-existent or already-soft-deleted id returns an empty `Mono` (the `RETURNING` clause emits nothing because no row matched). The downstream `.then()` (line 99) and `.thenReturn(noContent())` (OwnerController.java:44) propagate empty as success → HTTP 204. Caller cannot distinguish 'I deleted it', 'it was already deleted', and 'it never existed'. The `update` path at line 73 DOES `.switchIfEmpty(Mono.error(new NotFoundException(\"Owner\", id)))`; the asymmetry is unstated." — evidence: `OwnerServiceImpl.java:88-100` (no NotFound check on delete) vs `OwnerServiceImpl.java:69-85` (NotFound check on update at line 73) + REFACTOR-429.md — severity: MEDIUM

- "**`create` does NOT call `updateSearchVectors` — NEW asymmetry discovered at the service-tier sidecar.** Per the LSN-018 pre-emit coherence check (see `coherence_notes.[rule-6-pre-emit-check]`), this asymmetry was IMPLICIT in batch P sidecars but only becomes EXPLICIT at the enclosing-class tier: `OwnerServiceImpl.create` (lines 54-66) does NOT call `updateSearchVectors`. New Owners are seeded into FTS lazily — the `search_entrypoint` row for an owner's name is populated when a downstream data entity references the owner (via OwnershipServiceImpl.create's `updateChangedOwnershipVectors` at line 69 of that file) or via the housekeeping batch refresh. Operationally, a freshly-created Owner is NOT immediately findable by name in catalog search; it becomes findable after the first ownership binding is created. This is plausibly INTENTIONAL (a nameless-owner-row that has no associated entities has nothing to surface in FTS — the lazy seeding is the right shape), but the asymmetry between create (no refresh), update (refresh), delete (no refresh) is unstated and surface-mismatched." — evidence: `OwnerServiceImpl.java:54-66` (create — no updateSearchVectors) vs `OwnerServiceImpl.java:82` (update — calls updateSearchVectors) vs `OwnerServiceImpl.java:87-100` (delete — no updateSearchVectors) — severity: LOW (operationally lazy-seed is plausibly correct; the asymmetry is documentation-worthy not behaviour-worthy)

- "**OWNER_TO_ROLE has no `(owner_id, role_id)` UNIQUE constraint visible at the schema; `onDuplicateKeyIgnore` semantic from the persistence layer.** Per `ReactiveOwnerToRoleRepositoryImpl.java:39` (`insertStep.set(records.get(records.size() - 1)).onDuplicateKeyIgnore()`). The Postgres-side ON CONFLICT DO NOTHING semantic prevents duplicate INSERT failures, but the absence of an explicit UNIQUE constraint on (owner_id, role_id) means duplicates COULD accumulate via direct DB UPDATEs. The `update` path (lines 76-81) issues DELETE-then-INSERT which is idempotent under this semantic — replay produces no new rows. Surface for triage." — evidence: `ReactiveOwnerToRoleRepositoryImpl.java:39` + `OwnerServiceImpl.java:76-81` (the replay-tolerant pipeline) — severity: LOW

- "**`getOrCreate` is a permission-bypass write path for OWNER row creation.** Lines 38-42 — called by `OwnerAssociationRequestServiceImpl.createOwnerAssociationRequest` (line 57 of that file) AND `OwnershipServiceImpl.create` (line 52 of that file) AND `TermOwnershipServiceImpl.create`. The Owner row is auto-created WITHOUT the caller holding `OWNER_CREATE` — the SecurityRule at SecurityConstants.SECURITY_RULES[143] gates `POST /api/owners` (OwnerController.createOwner), NOT `OwnerServiceImpl.getOrCreate`. The bypass is intentional (the association-request and ownership-creation flows need to mint the owner if absent) but is the documented `permission-bypass-via-owner-auto-create-side-door-write-path` concept. Any future per-Owner authorization scoping decision must consider that the side-door produces Owner rows whose `OWNER_CREATE`-permission attribution is the CALLER OF THE SIDE-DOOR, not necessarily a holder of OWNER_CREATE." — evidence: `OwnerServiceImpl.java:38-42` + `OwnerAssociationRequestServiceImpl.java:57` + `OwnershipServiceImpl.java:52` + `TermOwnershipServiceImpl.java:30-something` + concepts/detail/canonicalisation_candidates/permission-bypass-via-owner-auto-create-side-door-write-path.yaml — severity: MEDIUM

- "**Visibility asymmetry: soft-deleted owners visible via `getOwnerDtoById` but hidden from `list`.** `list` at lines 44-52 calls `ownerRepository.list` which routes through `enrichSelect → listCondition` (inherited from `ReactiveAbstractSoftDeleteCRUDRepository`) adding `deleted_at IS NULL`. `getOwnerDtoById` at lines 102-107 calls `ownerRepository.getDto(ownerId)` which (per ReactiveOwnerRepositoryImpl.java:65-83) does NOT filter on `deleted_at IS NULL` for the OWNER side. A soft-deleted owner is invisible from `GET /api/owners` but VISIBLE from `GET /api/owners/{id}`. The `.switchIfEmpty(NotFoundException)` at line 105 fires ONLY when the id does not exist at all — not when it's soft-deleted. This is the deleteOwner sidecar's bugs[6] surface, anchored here at the service tier. **If a soft-deleted Owner's name carries PII or sensitive info, the by-id surface leaks it.**" — evidence: `OwnerServiceImpl.java:44-52` (list — filtered) vs `OwnerServiceImpl.java:102-107` (getOwnerDtoById — unfiltered) + ReactiveOwnerRepositoryImpl.java:65-83 (getDto — no deleted_at filter) — severity: MEDIUM

## security

- **auth_mode_relevance**: `INTERNAL_ONLY — service-tier, behind controller SecurityRules`. The class itself carries no `@ConditionalOnProperty` and no method-level `@PreAuthorize`; auth is enforced at the HTTP boundary by `SecurityConstants.SECURITY_RULES[143-147]` (`OWNER_CREATE` POST /api/owners, `OWNER_UPDATE` PUT /api/owners/{id}, `OWNER_DELETE` DELETE /api/owners/{id}) AND by the *SecurityConfiguration beans that gate `LOGIN_FORM | OAUTH2 | LDAP`. Under `auth.type=DISABLED` the SecurityRules remain in the rules list but the filter chain doesn't run (REFACTOR-185 16+2-sidecar enumeration) — all three lifecycle verbs are anonymously reachable. `S2S` does NOT apply (Owner CRUD is at `/api/owners*`, not `/ingestion/entities`). However, the `getOrCreate` method (lines 38-42) is invoked from `OwnerAssociationRequestServiceImpl.createOwnerAssociationRequest` — that service's HTTP entry point is `POST /api/owner_association_request` gated by NO permission (the request-creation endpoint is open to any authenticated user). This is the `permission-bypass-via-owner-auto-create-side-door` write path.
- **ingestion_filter_relevance**: `NO — UI/API surface, not /ingestion/entities`. The IngestionDataEntitiesFilter matches `/ingestion/entities` POST only; none of this service's methods are reachable through that path.
- **authorization_assertions**:
  - "`SecurityRule(NO_CONTEXT, '/api/owners' POST, OWNER_CREATE)` — gates `create` via OwnerController.createOwner" — evidence: SecurityConstants.java:143 + OwnerController.java:21-27
  - "`SecurityRule(NO_CONTEXT, '/api/owners/{owner_id}' PUT, OWNER_UPDATE)` — gates `update` via OwnerController.updateOwner" — evidence: SecurityConstants.java:144-145 + OwnerController.java:47-54
  - "`SecurityRule(NO_CONTEXT, '/api/owners/{owner_id}' DELETE, OWNER_DELETE)` — gates `delete` via OwnerController.deleteOwner" — evidence: SecurityConstants.java:146-147 + OwnerController.java:41-45
  - "**`getOrCreate` (lines 38-42) is NOT gated by any SecurityRule** — bypasses the OWNER_CREATE gate when reached via OwnerAssociationRequestServiceImpl.createOwnerAssociationRequest or OwnershipServiceImpl.create or TermOwnershipServiceImpl.create. The caller needs OWNER_ASSOCIATION-side or OWNERSHIP-side permissions, NOT OWNER_CREATE." — evidence: `OwnerServiceImpl.java:38-42` (no annotation) + SecurityConstants.java (no rule for any `/api/owner_association*` or `/api/dataentities/*/ownership` path that gates OWNER_CREATE) + OwnerAssociationRequestServiceImpl.java:57 + OwnershipServiceImpl.java:52
- **owner_scoping**: `N/A — code is not data-scoped at this directory layer` AND `BYPASSES at the per-Owner-target dimension`. The service methods accept `long id` and operate on the row identified by that id; there is no concept of "this Owner row belongs to that user, so only that user can mutate it." A caller with `OWNER_UPDATE` permission can rename ANY Owner row, not just one they are USER_OWNER_MAPPING-bound to. Same for `OWNER_DELETE`. Whether this is the intended design or a missed per-Owner scope is a maintainer call — surface for triage. Cross-link: REFACTOR-024 family (the broader 'no per-Owner scoping' posture across the platform) + ADR-CANDIDATE-003 (read-collaborative catalog) which may defend this as the intentional posture but the WRITE-side equivalent ("write-collaborative-directory"?) is not articulated in any ADR draft.
- **data_exposure**:
  - "Created Owner payload (id, name, roles, associated_user) → caller WITH `OWNER_CREATE` permission via POST /api/owners; echoes back the created row including any pre-existing role bindings (none for a fresh owner); only the just-created row is exposed, not the broader directory." — evidence: `OwnerServiceImpl.java:54-66` + OwnerController.java:21-27 + OwnerMapper.mapFromDto + SecurityConstants.java:143
  - "Updated Owner payload (id, name, roles, associated_user) → caller WITH `OWNER_UPDATE` permission via PUT /api/owners/{id}; echoes back the renamed row including new role bindings; only the just-updated row is exposed." — evidence: `OwnerServiceImpl.java:68-85` + OwnerController.java:47-54 + SecurityConstants.java:144-145
  - "No payload exposed on delete (HTTP 204)." — evidence: OwnerController.java:41-45 + `OwnerServiceImpl.java:87-100`
  - "Cascade-block error message (`'Owner cannot be deleted: there are still resources attached'`) is non-specific — does NOT disclose WHICH cascade leg triggered (termOwnership vs ownership vs userOwnerMapping). An attacker probing the directory cannot distinguish 'this owner has data entities' from 'this owner has terms' from 'this owner has an associated user'. The 3 EXISTS queries fire regardless of the value (no short-circuit), so timing-side-channel leakage is bounded." — evidence: `OwnerServiceImpl.java:95-96`
  - "Same payloads → ANONYMOUS callers under `auth.type=DISABLED`" — evidence: DisabledAuthSecurityConfiguration.java:11-19 (per batch-C sidecar) + SecurityConstants.java:143-147 (rules exist but filter chain bypassed) + REFACTOR-185.md (the 17 + 18-sidecar enumeration)
- **known_security_gaps**:
  - "**Owner directory CRUD has NO audit / activity-feed event** — no `@ActivityLog` on any of `create`, `update`, `delete`. Privileged operations that mutate platform-wide directory state AND destructively replace Role bindings are invisible to the audit. Sibling write operations on data-entity surface (description updates, alert status changes, ownership creations) DO emit activity events via @ActivityLog on OwnershipServiceImpl/AlertServiceImpl/DataEntityServiceImpl. The asymmetry between Owner-mutation (silent) and Ownership-mutation (logged) is undocumented and surface-mismatched. **5th + 6th + 7th corroborating sidecars of the audit-silence pattern (this enclosing-class anchor is the SERVICE-TIER CLOSURE).**" — evidence: `OwnerServiceImpl.java:38-122` (no @ActivityLog) + Grep `@ActivityLog` <odd-platform-api>/service/*.java 2026-05-20 (10 hits, none OwnerServiceImpl) + OwnershipServiceImpl.java:48,77,100 (the contrast) — severity: HIGH
  - "**Empty `roles` field silently destroys all role bindings** — `OwnerFormData.roles` is OpenAPI-optional; `getRoleIdsList` (lines 117-122) collapses null AND empty list to `List.of()`; the update transaction at lines 76-81 calls `deleteOwnerRelationsExcept(ownerId, List.of())` which deletes ALL existing role-links. An API consumer (script, integration, malformed UI request) that omits `roles` to mean 'don't touch' instead silently strips ALL roles. Combined with the no-audit-log gap, role-stripping is silent AND irreversible from logs. **PRIMARY-SOURCE service-tier confirmation of REFACTOR-425.**" — evidence: `OwnerServiceImpl.java:71, 76-81, 117-122` + components.yaml:419-422 — severity: HIGH
  - "**No per-Owner authorization scoping** — `OWNER_CREATE` / `OWNER_UPDATE` / `OWNER_DELETE` are global management permissions (NO_CONTEXT). A caller with any of these can mutate ANY Owner row, regardless of USER_OWNER_MAPPING binding. There is no `@PreAuthorize` enforcing 'only an admin or the bound user can rename/delete their own owner'. Surface for triage." — evidence: SecurityConstants.java:143-147 (`NO_CONTEXT` on all 3 rules) + this class's absence of programmatic per-Owner checks — severity: MEDIUM
  - "**`getOrCreate` is a service-tier permission-bypass for OWNER row minting.** Lines 38-42. Reached from OwnerAssociationRequestServiceImpl.createOwnerAssociationRequest (the user-facing 'I want to associate with owner X' flow — open to any authenticated user with no OWNER_CREATE requirement) AND from OwnershipServiceImpl.create + TermOwnershipServiceImpl.create. An authenticated user can mint arbitrary Owner rows by submitting OwnerAssociationRequests with names that do not yet exist (each request creates the corresponding Owner row). The caller's only friction is the partial-unique-index on `owner.name` (prevents collisions). NO @ActivityLog → silent owner sprawl. The bypass is INTENTIONAL but unmonitored." — evidence: `OwnerServiceImpl.java:38-42` + OwnerAssociationRequestServiceImpl.java:57 + OwnershipServiceImpl.java:52 + concepts catalog `permission-bypass-via-owner-auto-create-side-door-write-path` — severity: MEDIUM
  - "**Under `auth.type=DISABLED`, all three lifecycle verbs (POST + PUT + DELETE on /api/owners*) are anonymously reachable** — SecurityRules remain in the list but the WebFlux filter chain doesn't run. Combined with the audit-silence gap, anonymous callers on a network-reachable port can silently mutate the Owner directory: create + rename + delete + role-rebind any owner. **The Owner directory MUTATION surface is COMPLETELY UNAUTHENTICATED under DISABLED** per REFACTOR-185 17+18-sidecar enumeration. Combined with the destructive empty-roles UPDATE (REFACTOR-425) and the role-binding hard-delete on DELETE (ADR-CANDIDATE-145), an anonymous attacker with network reach can: create an Owner, rename it, attach roles via the role-rebind, then delete the original Owner — all without leaving any audit trace." — evidence: `OwnerServiceImpl.java:38-122` (no @ConditionalOnProperty) + SecurityConstants.java:143-147 + DisabledAuthSecurityConfiguration.java:11-19 (per batch-C sidecar) + REFACTOR-185.md — severity: MEDIUM (corollary of REFACTOR-185; DISABLED is dev-only per docs but the no-fail-fast posture makes accidental production exposure plausible)
  - "**Soft-deleted owner visible via `getOwnerDtoById` but hidden from `list`** — the visibility asymmetry at lines 102-107 (returns soft-deleted) vs 44-52 (filters them out). If a soft-deleted Owner's name is sensitive PII (e.g. a personal identifier the operator deleted on purpose), the by-id surface leaks it. Surface for triage." — evidence: `OwnerServiceImpl.java:44-52, 102-107` + ReactiveOwnerRepositoryImpl.java:65-83 — severity: MEDIUM
  - "**Name field is fully overwritten on update with no validation** — `OwnerMapper.applyToPojo` (line 18 of OwnerMapper.java) applies the form's `name` directly onto the existing pojo. The partial-unique-index `owner_name_unique` is case-SENSITIVE. No `@NotBlank`, no `@Size`, no `@Pattern` constraint on `OwnerFormData.name` (`components.yaml:417-418`); no service-layer trim / lowercase normalisation; no MapStruct custom mapping. Operators can rename to whitespace-only, empty-string, or homoglyph-collision name. Mirrors REFACTOR-432." — evidence: V0_0_36__refactor_unique_index.sql:9 + V0_0_64__remove_is_deleted_field.sql:68-70 + components.yaml:417-418 + `OwnerServiceImpl.java:74` (applyToPojo) + OwnerMapper.java:18 — severity: LOW

## performance

- **hot_paths**: [] — N/A. Owner directory CRUD is an admin-time operation (per the live owners doc, "managed in the Management → Owners tab"), not a per-render or per-event call. None of the methods are on the UI's hot path; no metric tracks the rates. The `list` method IS used to populate the Management → Owners tab page, which is reached from the admin navigation — but the cadence is operator-actions-per-day, not requests-per-second.
- **throughput_characteristics**:
  - "All mutating methods are single reactive calls — `Mono<...>` return types; non-blocking I/O; no thread is held during DB awaits" — evidence: `OwnerServiceImpl.java:54-66, 68-85, 87-100`
  - "Per-`create`: 1 INSERT owner + N INSERTs owner_to_role (N = formData.roles.size, batched via the createRelations multi-record INSERT) + 1 SELECT-with-joins read-back via getDto. 3 round-trips for the no-roles case; 2+1+1 for any-N-roles case (the multi-record INSERT folds N rows into 1 statement)." — evidence: `OwnerServiceImpl.java:54-66` + ReactiveOwnerToRoleRepositoryImpl.java:25-41
  - "Per-`update`: 1 SELECT owner (existence check) + 1 UPDATE owner + 1 DELETE owner_to_role + 1 INSERT owner_to_role (multi-record for N roles; not issued if N=0) + 2 UPDATE search-vectors via Mono.zip parallel + 1 SELECT-with-joins read-back. **6-7 round-trips** for the typical case (5+2 parallel + 1 read-back); the two search-vector UPDATEs run in parallel via Mono.zip but each is a separate DB round-trip." — evidence: `OwnerServiceImpl.java:68-85, 109-114`
  - "Per-`delete`: 3 SELECT EXISTS (cascade-block in parallel via Mono.zip) + 1 DELETE owner_to_role (N rows; 1 statement) + 1 UPDATE owner (soft-delete). **5 round-trips** for the happy path; 3 round-trips for the cascade-block-rejection path (the failed `.filter` short-circuits)." — evidence: `OwnerServiceImpl.java:87-100` + ReactiveOwnerToRoleRepositoryImpl.java:52-56
  - "No bulk endpoints — single owner per request on all three verbs" — evidence: `OwnerService.java:10-26` (all methods accept single id / single formData)
- **resource_allocation**:
  - "Per-request allocations bounded by `formData.roles` size (peak memory: a small constant + the role list)" — evidence: `OwnerServiceImpl.java:71, 117-122`
  - "Search-vector UPDATEs scale with the count of `search_entrypoint` + `term_search_entrypoint` rows referencing the owner — for high-cardinality owners (one with many associated data entities), the UPDATE rewrite cost is amortised O(N) over those rows. The Mono.zip parallelism halves wall-clock time but doubles connection-pool footprint" — evidence: `OwnerServiceImpl.java:109-114`
  - "Read-back via `ownerRepository.getDto` joins OWNER + OWNER_TO_ROLE + ROLE + USER_OWNER_MAPPING — bounded by the just-mutated row's relations" — evidence: ReactiveOwnerRepositoryImpl.java:65-83 (the getDto join shape, per deleteOwner sidecar)
- **scaling_characteristics**:
  - "Stateless service — horizontal scaling unconstrained at this layer" — evidence: `OwnerServiceImpl.java:26-36` (no instance state beyond final injected dependencies)
  - "The @ReactiveTransactional boundary holds a DB connection from the existence-check through the read-back. Under concurrent admin load (rare), connection-pool contention scales with request rate × transaction duration; transaction duration grows with role count (one extra row per role in the INSERT) AND with search-entry cardinality (more rows to rewrite in the UPDATE-vectors path)" — evidence: `OwnerServiceImpl.java:55, 69, 88`
  - "Name-uniqueness contention — the partial-unique-index `owner_name_unique` serializes concurrent renames to the same name. Not a perf concern at admin-time rates" — evidence: V0_0_64__remove_is_deleted_field.sql:68-70
  - "Cascade-check Mono.zip parallelism — 3 EXISTS queries fire concurrently; total wall-clock time is bounded by the slowest leg (not sum)" — evidence: `OwnerServiceImpl.java:90-91`
- **known_performance_gaps**:
  - "No method-level observability — no @Timed, no Micrometer counter, no structured log entry beyond default Spring access log. Admin-time renames that take seconds to complete (high search-entry cardinality, role-rebind cascade) surface only in WebFlux / pool metrics, not at the operation boundary" — evidence: `OwnerServiceImpl.java:38-122` (no observability annotations) — severity: LOW
  - "6-7 round-trips on `update` could be folded — the existence-check (line 72) could be combined with the UPDATE's `WHERE id = ?` (a zero-row UPDATE means 'not found'), saving one round-trip; the read-back (line 83) could be skipped if the response payload were built from the just-updated POJO + the role list. Current implementation prioritises correctness of the joined Owner shape + explicit 404 semantics over latency. Acceptable for admin-time use" — evidence: `OwnerServiceImpl.java:69-85` (the explicit 5-step pipeline) — severity: LOW

## sources

- understanding ← `OwnerServiceImpl.java:1-123` (full file) + cross-batch sidecars (createOwner.md batch E + updateOwner.md batch P + deleteOwner.md batch P + OwnersList.md batch Q + ReactiveUserOwnerMappingRepositoryImpl.md batch N) + REFACTOR-425/426/427/428/429/430/431/432/185 scope files + ADR-CANDIDATE-144/145 + F-019.yaml + system-mission.md
- concepts.entities ← `OwnerServiceImpl.java:7-22` (imports) + `OwnerServiceImpl.java:38-122` (usage sites) + OwnerMapper.java:14-30 + ReactiveOwnerRepository.java:11-23 + ReactiveOwnerToRoleRepository.java:6-12
- concepts.operations ← `OwnerServiceImpl.java:38-42` (getOrCreate) + `:44-52` (list) + `:54-66` (create) + `:68-85` (update) + `:87-100` (delete) + `:102-107` (getOwnerDtoById) + `:109-114` (updateSearchVectors) + `:116-122` (getRoleIdsList)
- concepts.invariants ← `OwnerServiceImpl.java:55, 69, 88` (@ReactiveTransactional placements) + `OwnerServiceImpl.java:38-122` (no @ActivityLog) + Grep `@ActivityLog` <odd-platform-api>/service/*.java 2026-05-20 + `OwnerServiceImpl.java:76-81, 97, 117-122` (role-rebind primitive shared sites) + `OwnerServiceImpl.java:82, 109-114` (updateSearchVectors call site + helper) + `OwnerServiceImpl.java:73, 98, 105` (NotFoundException placements + asymmetry) + `OwnerServiceImpl.java:88-100` + R2DBC defaults (READ COMMITTED) + ReactiveOwnerToRoleRepositoryImpl.java:39, 52-56 + V0_0_64__remove_is_deleted_field.sql:68-70 + `OwnerServiceImpl.java:38-42` (getOrCreate side-door)
- concepts.audiences ← OwnerController.java:21-54 + OwnersList batch-Q sidecar + OwnerAssociationRequestServiceImpl.java:57 + OwnershipServiceImpl.java:52 + TermOwnershipServiceImpl.java + SecurityConstants.java:143-147
- dependencies_semantic.requires-feature ← WebFetched live owners doc 2026-05-20 (inherited from batch P) + SecurityConstants.java:143-147 + ReactiveAbstractSoftDeleteCRUDRepository (parent of ReactiveOwnerRepositoryImpl) + CascadeDeleteException.java
- dependencies_semantic.requires-config ← `OwnerServiceImpl.java:1-123` (Grep — no @Value, no @ConfigurationProperties)
- dependencies_semantic.requires-runtime ← `OwnerServiceImpl.java:24` (Mono import) + ReactiveOwnerRepository + ReactiveOwnerToRoleRepository + V0_0_64__remove_is_deleted_field.sql:68-70 + V0_0_51__add_owner_association_request.sql:11
- dependencies_semantic.coupling ← `OwnerServiceImpl.java:5-23` (full import block) + `OwnerServiceImpl.java:28-36` (field declarations)
- upstream_callers ← OwnerController.java:21-54 (HTTP entry points) + OwnerAssociationRequestServiceImpl.java:57 + OwnershipServiceImpl.java:52 + TermOwnershipServiceImpl.java + Grep `ownerService\.` across `<odd-platform-api>/src/main/java` 2026-05-20 (4 files: OwnerController.java + OwnerAssociationRequestServiceImpl.java + OwnershipServiceImpl.java + TermOwnershipServiceImpl.java)
- downstream_side_effects ← `OwnerServiceImpl.java:38-100` (each method's reactive pipeline) + ReactiveOwnerRepository contract + ReactiveAbstractSoftDeleteCRUDRepository.delete + ReactiveOwnerToRoleRepositoryImpl.java:25-56 + V0_0_64:68-70 + V0_0_51:11
- tests_coverage_semantic ← Grep `OwnerServiceImpl|OwnerService\.` across `<odd-platform-api>/src/test` 2026-05-20 (zero hits) + deleteOwner sidecar tests_coverage_semantic (the closest existing test is `OwnerRepositoryImplTest.testDeletesOwner`)
- docs_link_semantic ← inherited from updateOwner.md + deleteOwner.md (batch P, WebFetched 2026-05-20 status 200 for both /authorization/owners and /authorization/permissions)
- implicit_adrs[0] (@ReactiveTransactional placement) ← `OwnerServiceImpl.java:54-55, 68-69, 87-88, 38-42, 44-52, 102-107`
- implicit_adrs[1] (role-rebind set-replacement) ← `OwnerServiceImpl.java:76-81, 97, 117-122` + ReactiveOwnerToRoleRepositoryImpl.java:52-56 + ADR-CANDIDATE-144.md
- implicit_adrs[2] (mixed soft+hard-delete) ← `OwnerServiceImpl.java:97-98` + ReactiveOwnerToRoleRepositoryImpl.java:52-56 + ReactiveAbstractSoftDeleteCRUDRepository.delete + V0_0_64:68-70 + ADR-CANDIDATE-145.md
- implicit_adrs[3] (cascade-block fail-fast Mono.zip) ← `OwnerServiceImpl.java:90-96`
- implicit_adrs[4] (in-transaction search-vector refresh asymmetric) ← `OwnerServiceImpl.java:82, 109-114` + absence at lines 54-66 and 87-100
- bugs_limitations_corner_cases[0] (destructive empty-roles update) ← `OwnerServiceImpl.java:71, 76-81, 117-122` + ReactiveOwnerToRoleRepositoryImpl.java:52-56 + components.yaml:419-422 + REFACTOR-425.md
- bugs_limitations_corner_cases[1] (no @ActivityLog) ← `OwnerServiceImpl.java:38-122` + Grep `@ActivityLog` <odd-platform-api>/service/*.java 2026-05-20 + REFACTOR-426.md
- bugs_limitations_corner_cases[2] (cascade-check non-atomic) ← `OwnerServiceImpl.java:88-100` + REFACTOR-430.md
- bugs_limitations_corner_cases[3] (owner_association_request orphan) ← `OwnerServiceImpl.java:90-91` + V0_0_51:11 + REFACTOR-427.md
- bugs_limitations_corner_cases[4] (delete no FTS refresh) ← `OwnerServiceImpl.java:82` vs `:87-100` + REFACTOR-428.md
- bugs_limitations_corner_cases[5] (silent-204 idempotency) ← `OwnerServiceImpl.java:88-100` vs `:69-85` + REFACTOR-429.md
- bugs_limitations_corner_cases[6] (create no FTS refresh — NEW) ← `OwnerServiceImpl.java:54-66` (absence) + `:82` (present in update only) + `:87-100` (absence in delete) — new finding from this enclosing-class sidecar's pre-emit coherence check
- bugs_limitations_corner_cases[7] (OWNER_TO_ROLE no unique constraint visible) ← ReactiveOwnerToRoleRepositoryImpl.java:39 + `OwnerServiceImpl.java:76-81`
- bugs_limitations_corner_cases[8] (getOrCreate permission-bypass) ← `OwnerServiceImpl.java:38-42` + OwnerAssociationRequestServiceImpl.java:57 + OwnershipServiceImpl.java:52 + TermOwnershipServiceImpl.java + concepts catalog
- bugs_limitations_corner_cases[9] (visibility asymmetry) ← `OwnerServiceImpl.java:44-52, 102-107` + ReactiveOwnerRepositoryImpl.java:65-83
- security.auth_mode_relevance ← `OwnerServiceImpl.java:1-123` (no @ConditionalOnProperty) + SecurityConstants.java:143-147 + batch-C *SecurityConfiguration sidecars
- security.authorization_assertions ← SecurityConstants.java:143-147 + OwnerController.java:21-54 + `OwnerServiceImpl.java:38-42` (getOrCreate bypass)
- security.owner_scoping ← SecurityConstants.java:143-147 (NO_CONTEXT) + REFACTOR-024 family
- security.data_exposure ← OwnerController.java:21-54 + `OwnerServiceImpl.java:54-100` + OwnerMapper.java + DisabledAuthSecurityConfiguration.java:11-19 + REFACTOR-185.md
- security.known_security_gaps[0] (audit silence) ← `OwnerServiceImpl.java:38-122` + Grep + REFACTOR-426
- security.known_security_gaps[1] (empty roles destructive) ← `OwnerServiceImpl.java:71, 76-81, 117-122` + REFACTOR-425
- security.known_security_gaps[2] (no per-Owner scoping) ← SecurityConstants.java:143-147 + class-wide absence of @PreAuthorize
- security.known_security_gaps[3] (getOrCreate bypass) ← `OwnerServiceImpl.java:38-42` + OwnerAssociationRequestServiceImpl.java:57 + concepts catalog
- security.known_security_gaps[4] (DISABLED anonymous reach) ← REFACTOR-185.md + DisabledAuthSecurityConfiguration.java:11-19
- security.known_security_gaps[5] (visibility asymmetry) ← `OwnerServiceImpl.java:102-107` vs `:44-52`
- security.known_security_gaps[6] (name no normalisation) ← `OwnerServiceImpl.java:74` + OwnerMapper.java:18 + V0_0_36/V0_0_64 + components.yaml + REFACTOR-432
- performance.throughput_characteristics ← `OwnerServiceImpl.java:54-100` + ReactiveOwnerToRoleRepositoryImpl.java:25-56
- performance.resource_allocation ← `OwnerServiceImpl.java:109-114` + ReactiveOwnerRepositoryImpl.java:65-83
- performance.scaling_characteristics ← `OwnerServiceImpl.java:55, 69, 88` (@ReactiveTransactional) + V0_0_64:68-70 + `OwnerServiceImpl.java:90-91` (Mono.zip)
- performance.known_performance_gaps ← `OwnerServiceImpl.java:38-122` (no observability) + `OwnerServiceImpl.java:69-85` (the explicit 5-step pipeline)

## confidence_per_field

- understanding: HIGH (every claim verified against `OwnerServiceImpl.java:1-123` end-to-end + 5 cross-batch sidecars + 8 REFACTOR scope files + 2 ADR-CANDIDATE files + F-019.yaml + system-mission.md; the 6-method + 2-helper structural shape is directly visible; the destructive-empty-roles cascade is anchored at lines 71, 76-81, 117-122)
- concepts: HIGH (entities, operations, 12 invariants all anchored at file:line; the LSN-018 pre-emit coherence check confirmed all batch-P inferences and discovered one new asymmetry (create no FTS refresh) at the enclosing-class tier)
- dependencies_semantic: HIGH (7 injected repositories + 1 mapper visible at lines 28-36; 4 upstream HTTP entry points enumerated via Grep)
- tests_coverage_semantic: HIGH (absence-of-tests verified by Grep across `<odd-platform-api>/src/test` 2026-05-20 returning zero matches for `OwnerServiceImpl|OwnerService\.`; the 25 uncovered_behaviours are each anchored at a specific service-method-tier contract)
- docs_link_semantic: HIGH (both URLs WebFetched in batch P 2026-05-20 status 200; the SILENCE findings on both pages are positive WebFetch results, not pretraining inference; this sidecar inherits the freshness window from batch P which is within stale-probe cadence)
- implicit_adrs: HIGH (5 ADRs all anchored at file:line; ADR-CANDIDATE-144 and 145 codify the load-bearing two)
- upstream_callers: HIGH (4 callers enumerated via Grep `ownerService\.` 2026-05-20; OwnerController is the sole HTTP entry; the 3 side-door callers — OwnerAssociationRequestServiceImpl, OwnershipServiceImpl, TermOwnershipServiceImpl — each cite a `getOrCreate` invocation at a specific line)
- downstream_side_effects: HIGH (8 write effects + 2 read effects enumerated; each anchored at the service-method line + the downstream repository/SQL primitive)
- bugs_limitations_corner_cases: HIGH (10 corner cases each anchored at file:line; 6 are service-tier primary-source confirmations of batch-P findings; 1 is a NEW asymmetry surfaced by the LSN-018 pre-emit check at the enclosing-class tier; 3 are positive case-law / structural observations)
- security: HIGH (every claim is structural and traces to OwnerServiceImpl + SecurityConstants + DisabledAuthSecurityConfiguration + the database migrations + REFACTOR-185 + the related batch-C/N sidecars)
- performance: HIGH (the throughput / round-trip shape is directly visible across the three transactional methods; the absence of observability and the asymmetric updateSearchVectors are both anchored at cited code)

## Maintainer notes

