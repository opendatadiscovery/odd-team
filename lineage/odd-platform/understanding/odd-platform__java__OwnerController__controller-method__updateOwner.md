---
node_id: "odd-platform java OwnerController controller-method:updateOwner"
node_kind: controller-method
axis: controllers
extracted_at_commit: 9ac6436e
enriched_at_commit: 9ac6436e
extractor_version: 0.1.0
prompt_version: file-analyser/0.2.0
schema_version: v0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-20-P-OwnerController-updateOwner
pillar: P-09
related_pillar_features:
  - P-09:F-002  # Principal-to-Owner Resolution (Owner-Scoping Mechanism) — F-011
  - P-09:F-001  # Role-Based Access Control — F-006
related_features:
  - F-011
  - F-006
related_refactors:
  - REFACTOR-355  # orthogonal — OIDC_USERNAME-side cross-provider row duplication; this sidecar is the OWNER.NAME-side rename surface
  - REFACTOR-391  # contrast — GitHub login rename orphans USER_OWNER_MAPPING (irreparable); OWNER.NAME rename is the SAFE direction
  - REFACTOR-024  # tangential — cross-owner read posture; this is a directory write, not a read
related_adrs:
  - ADR-CANDIDATE-015  # tangential — owner-scoped routes; rename does not affect reactor-Context principal resolution
related_concepts:
  - user-owner-mapping
  - auth-mode
related_sidecars:
  - odd-platform__java__OwnerController__controller-method__createOwner  # twin write surface — same patterns inherited; rename adds role re-binding + search-vector + name-collision concerns
  - odd-platform__java__repository__reactive__repository__ReactiveUserOwnerMappingRepositoryImpl  # batch N — confirms USER_OWNER_MAPPING.OWNER_ID FK, NOT name FK
coherence_notes:
  - kind: strengthens
    target: F-011
    target_drift_facet: compound_key_silent_in_docs
    note: |
      Adds the OWNER.NAME-rename surface as a SECOND rename-related concern complementing
      the OIDC_USERNAME-rename surface (F-011 drift class
      `github_ghes_hard_coded_login_rename_orphan`). The two surfaces are ORTHOGONAL:
      OIDC_USERNAME rename orphans USER_OWNER_MAPPING (REFACTOR-391 — irreparable without
      stable-id fallback); OWNER.NAME rename does NOT orphan USER_OWNER_MAPPING because
      USER_OWNER_MAPPING.OWNER_ID is the FK (V0_0_4__add_user_owner_mapping.sql:3 +
      ReactiveUserOwnerMappingRepositoryImpl batch-N sidecar invariants). The OWNER.NAME
      rename IS the safe direction, but the surface still carries five DISTINCT concerns
      (no audit log, name-collision behaviour as 500 not 409, search-vector race window,
      role re-bind diff semantics, OpenAPI 201-vs-200 drift) — surfaced in this sidecar's
      bugs_limitations_corner_cases and known_security_gaps blocks.
  - kind: strengthens
    target: F-006
    target_drift_facet: forensic_silence_on_rbac_mutations
    note: |
      OwnerServiceImpl.update (OwnerServiceImpl.java:69-85) re-binds roles via
      ownerToRoleRepository.deleteOwnerRelationsExcept(owner.getId(), newRoles).then(
      createRelations(owner.getId(), newRoles)) — a destructive role-rebinding on every
      update call. NO @ActivityLog annotation; no audit trail records "owner X had roles
      [A, B] before, now has [B, C]". Mirrors the createOwner sidecar's identical absence
      (createOwner.md:bugs_limitations_corner_cases[4]) and extends the
      forensic_silence_on_rbac_mutations facet from policy/role mutations into the OWNER
      mutation surface.
  - kind: distinguishes-from
    target: REFACTOR-391
    note: |
      REFACTOR-391 says: GitHub login rename ORPHANS USER_OWNER_MAPPING because the
      handler uses oidc_username='login' (a free-rename string) and no stable-id
      fallback. THIS sidecar says: OWNER.NAME rename via PUT /api/owners/{owner_id}
      does NOT orphan USER_OWNER_MAPPING because the FK is by owner_id (the
      bigserial PK), not by name. The two findings together describe the rename
      hazard surface: the OIDC_USERNAME side is the dangerous direction; the
      OWNER.NAME side is the safe direction. Cite both in any future
      "owner-mapping-stability" documentation.
---

# OwnerController#updateOwner — semantic understanding

## understanding

`updateOwner` is the reactive `PUT /api/owners/{owner_id}` handler — five lines of
WebFlux delegation that read `Mono<OwnerFormData>` from the body, call
`ownerService.update(ownerId, form)`, and wrap the resulting `Owner` in `200 OK`
(`OwnerController.java:47-54`). It is the platform's sole Owner-rename / role-rebind
surface — every change to `owner.name` or to an Owner's attached Role bundle flows
through this endpoint. The transactional shape lives one layer down:
`OwnerServiceImpl.update` (`OwnerServiceImpl.java:69-85`) is `@ReactiveTransactional`
and runs a five-step pipeline: (1) `ownerRepository.get(id)` with
`switchIfEmpty → NotFoundException` (line 72-73); (2) `OwnerMapper.applyToPojo`
applying the form's new `name` and `roles` to the existing pojo (line 74); (3)
`ownerRepository.update(pojo)` issuing an UPDATE with a new `updated_at` and the
non-updatable id/created_at fields masked
(`ReactiveAbstractCRUDRepository.java:162-173`); (4) destructive role-rebind via
`ownerToRoleRepository.deleteOwnerRelationsExcept(ownerId, newRoles).then(createRelations(ownerId, newRoles))`
(lines 76-81); (5) search-vector refresh via `updateChangedOwnerVectors` against
both the data-entity search entrypoint and the term search entrypoint (lines 82,
109-114). Authorization is enforced centrally by
`SecurityConstants.SECURITY_RULES[144-145]`: `new SecurityRule(NO_CONTEXT,
PathPatternParserServerWebExchangeMatcher("/api/owners/{owner_id}", PUT), OWNER_UPDATE)`.
The controller method has no `@PreAuthorize` and no programmatic auth check.

## concepts

- entities: [
    "`Owner` (response payload — `OwnerController.java:48`)",
    "`OwnerFormData` (request body: `name: String` required + `roles: List<Role>` optional — `components.yaml:414-424`)",
    "`OwnerPojo` (jOOQ row mutated in place by `OwnerMapper.applyToPojo` — `OwnerServiceImpl.java:74`)",
    "`OwnerToRole` (join-table — re-built on every update via deleteOwnerRelationsExcept + createRelations — `OwnerServiceImpl.java:76-81`)",
    "`USER_OWNER_MAPPING` row — referenced by `OWNER_ID` FK, NOT by `name`; survives this rename intact (V0_0_4__add_user_owner_mapping.sql:3)",
    "`SEARCH_ENTRYPOINT` + `TERM_SEARCH_ENTRYPOINT` rows — refreshed via `updateChangedOwnerVectors` (`OwnerServiceImpl.java:109-114`)"
  ]
- operations: [
    "`update-owner-name-and-roles` — transactional pipeline: get-or-404 → applyToPojo → UPDATE owner → delete-stale-role-links → create-new-role-links → refresh-search-vectors → re-read-as-DTO (`OwnerServiceImpl.java:69-85`)",
    "`role-set-diff-by-replace` — `deleteOwnerRelationsExcept(ownerId, newRoles)` removes all current role-links that are NOT in the new set, then `createRelations(ownerId, newRoles)` inserts the new set; the operation is NOT a true diff (no compute-add / compute-remove) but a replace-by-set-difference (`OwnerServiceImpl.java:76-81`)",
    "`search-vector-refresh` — both `searchEntrypointRepository.updateChangedOwnerVectors(id)` and `termSearchEntrypointRepository.updateChangedOwnerVectors(id)` run via `Mono.zip` (parallel) (`OwnerServiceImpl.java:109-114`)"
  ]
- invariants:
  - "Reactive transactional — `OwnerServiceImpl.update` is `@ReactiveTransactional` (`OwnerServiceImpl.java:68-70`); the UPDATE owner, role-link delete, role-link insert, two search-vector UPDATEs, and final read-back run inside one DB transaction. The controller is annotation-free (`OwnerController.java:47-54`)."
  - "**Rename does NOT orphan USER_OWNER_MAPPING.** The FK is `user_owner_mapping.owner_id REFERENCES owner(id)` (V0_0_4__add_user_owner_mapping.sql:3) — `owner.id` is the bigserial PK, stable across name changes. Rename mutates `owner.name` only (`OwnerMapper.applyToPojo` + `ReactiveAbstractCRUDRepository.updateOne`). USER_OWNER_MAPPING rows continue to point at the same Owner identity. This is the LOAD-BEARING contrast to REFACTOR-391's OIDC_USERNAME-rename orphan: the OWNER-side rename is safe, the principal-side rename is not."
  - "**404 on missing ownerId.** `ownerRepository.get(id).switchIfEmpty(Mono.error(new NotFoundException(\"Owner\", id)))` (`OwnerServiceImpl.java:72-73`). Unknown owner_id produces HTTP 404 via the platform's `ControllerAdvice` mapping. The check fires before any mutation; idempotency holds in the failure direction (no partial write on a missing target)."
  - "**OpenAPI declares HTTP 201 for an UPDATE.** `openapi.yaml:195-201` declares `responses.'201': 'The resource has been successfully updated'` for the `updateOwner` operationId. The controller returns `ResponseEntity.ok` = 200 (`OwnerController.java:53`). This is doubly anomalous: (a) PUT-as-update should declare 200, not 201 (201 is for POST-creates); (b) the implementation disagrees with the contract."
  - "**Role-set replacement is set-based, not diff-based.** `deleteOwnerRelationsExcept(ownerId, newRoles)` (`OwnerServiceImpl.java:76-78`) deletes all current role-links NOT in `newRoles`, then `createRelations(ownerId, newRoles)` (lines 79-81) inserts the new set. If `newRoles` is empty (the form omitted `roles` or sent `roles: []`), ALL existing role-links are deleted — an empty `roles` list is destructive, not 'don't-touch'."
  - "**Name field is fully overwritten — no merge / null-skip semantics.** `OwnerMapper.applyToPojo` (`OwnerMapper.java:18`, MapStruct-generated with `@MappingTarget OwnerPojo pojo`) applies the form's `name` directly onto the existing pojo. The OpenAPI `OwnerFormData.name` is required (`components.yaml:423-424`); a missing name fails Bean Validation (`@NotNull` on `OwnerFormData.getName()`). An empty string is NOT rejected (no `@NotBlank`); a 256-character name would fail at the DB layer (`varchar(255)` per V0_0_1__init.sql:4)."
  - "**Search vectors refresh AFTER role update, AFTER name update — but within the same transaction.** `updateSearchVectors` runs in the post-role-rebind position (`OwnerServiceImpl.java:82, 109-114`); both `Mono.zip`'d UPDATE statements complete before the final `getDto(owner.getId())` re-read. The transaction boundary covers all six writes; a rollback restores name, role-bindings, AND search vectors."
- audiences: [
    "Platform admins / managers (per the live owners doc; the `Management → Owners` tab uses this endpoint to rename owners + adjust their role assignments)",
    "ODD Platform UI — `owners.thunks.ts` invokes the OpenAPI-generated `updateOwner` (`odd-platform-ui/src/redux/thunks/owners.thunks.ts`); WebFlux deserialises the body, returns the updated `Owner` for UI store hydration",
    "Callers holding the `OWNER_UPDATE` MANAGEMENT permission per `SecurityConstants.java:144-145`; the live permissions doc page describes `OWNER_UPDATE` as 'Allows editing an existing owner.' (WebFetched 2026-05-20, status 200)"
  ]

## dependencies_semantic

- requires-feature: [
    "Owner directory — live doc `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/owners` (WebFetched 2026-05-20 status 200; doc is silent on rename semantics — see docs_link_semantic.doc_drift_findings)",
    "Authorization / Permission framework — `SecurityConstants.SECURITY_RULES[144-145]` registers `OWNER_UPDATE` against `/api/owners/{owner_id}` PUT; the live permissions doc names this permission verbatim",
    "Search-vector indexing — `ReactiveSearchEntrypointRepository.updateChangedOwnerVectors` + `ReactiveTermSearchEntrypointRepository.updateChangedOwnerVectors` (`OwnerServiceImpl.java:111-112`); the owner name appears in full-text-search rows for both data-entity and term-side search indexes",
    "Role-binding mechanics — `ReactiveOwnerToRoleRepository.deleteOwnerRelationsExcept` + `createRelations` (`OwnerServiceImpl.java:76-81`); the destructive replace-by-set-difference pattern is the platform's standard role-rebind shape"
  ]
- requires-config: [] — N/A. The method reads no config keys; no `@Value`, no `@ConfigurationProperties`; the gating SecurityRule at SecurityConstants.java:144-145 is unconditional (not config-gated).
- requires-runtime: [
    "Spring WebFlux runtime — `Mono<ResponseEntity<Owner>>` return type and `ServerWebExchange exchange` parameter (`OwnerController.java:48-50`)",
    "jOOQ reactive DB session — downstream UPDATE owner, DELETE+INSERT owner_to_role, two UPDATE search_entrypoint+term_search_entrypoint, SELECT-join read-back (`ReactiveAbstractCRUDRepository.java:162-173` + `OwnerServiceImpl.java:69-85`)",
    "PostgreSQL `owner` table with partial-unique on name — V0_0_36__refactor_unique_index.sql:9 + V0_0_64__remove_is_deleted_field.sql:68-70 declare `CREATE UNIQUE INDEX owner_name_unique ON owner (name) WHERE owner.deleted_at IS NULL`. Soft-deleted owners do NOT block rename to their name — but two active owners cannot share a name.",
    "PostgreSQL `user_owner_mapping` schema — V0_0_4__add_user_owner_mapping.sql:3 declares `owner_id bigint UNIQUE` referencing `owner(id)`; the FK is by id, not name (the load-bearing invariant for the safe-rename claim)"
  ]
- coupling: [
    "`OwnerApi.updateOwner` (OpenAPI-generated interface, `odd-platform-api/build/generated-sources/openapi/.../OwnerApi.java` per the @Override at `OwnerController.java:47`) — supplies `@RequestMapping(method = PUT, value = '/api/owners/{owner_id}')`, the `@Valid @RequestBody Mono<OwnerFormData>` constraint, the path-variable binding, and the OpenAPI-declared `201` response code. The controller's `.map(ResponseEntity::ok)` overrides the declared 201 to 200.",
    "`OwnerService.update(long, OwnerFormData)` (`OwnerService.java:21`) — sole downstream call; the service is `@ReactiveTransactional` (`OwnerServiceImpl.java:69`) and orchestrates the six-write transaction.",
    "`OwnerMapper.applyToPojo` (MapStruct, `OwnerMapper.java:18`) — applies the form's name + roles onto the existing pojo (in-place via `@MappingTarget`).",
    "`ReactiveOwnerRepository.get` + `.update` (`ReactiveOwnerRepository.java:11` extends `ReactiveCRUDRepository<OwnerPojo>` → `ReactiveAbstractCRUDRepository.update` at `ReactiveAbstractCRUDRepository.java:108-110`).",
    "`ReactiveOwnerToRoleRepository.deleteOwnerRelationsExcept` + `.createRelations` (`OwnerServiceImpl.java:76-81`) — the role-rebind primitives.",
    "`ReactiveSearchEntrypointRepository.updateChangedOwnerVectors` + `ReactiveTermSearchEntrypointRepository.updateChangedOwnerVectors` (`OwnerServiceImpl.java:111-112`) — search-vector refresh.",
    "`SecurityConstants.SECURITY_RULES[144-145]` — `new SecurityRule(NO_CONTEXT, new PathPatternParserServerWebExchangeMatcher('/api/owners/{owner_id}', PUT), OWNER_UPDATE)` — the authoritative authorization gate.",
    "`NotFoundException` (`OwnerServiceImpl.java:13, 73`) + `ControllerAdvice` — error-mapping to HTTP 404 on missing ownerId."
  ]

## tests_coverage_semantic

- covered_behaviours: [] — no test asserts any aspect of this endpoint. `grep -rln 'OwnerController|ownerService.update\|updateOwner' <odd-platform-api>/src/test/java/` returned zero matches (run 2026-05-20).
- uncovered_behaviours: [
    "HTTP-level smoke test — no `@WebFluxTest(OwnerController.class)` or `WebTestClient` test asserts `PUT /api/owners/{owner_id}` with a minimum body returns success and the updated `Owner` DTO.",
    "Status-code contract divergence — no test catches that the controller returns 200 OK while OpenAPI declares 201 Created (`openapi.yaml:196`).",
    "404 on missing ownerId — no test asserts that PUT to a non-existent owner_id produces 404 via the `NotFoundException` path (`OwnerServiceImpl.java:73`).",
    "Rename collision — no test asserts the behaviour when the new `name` matches another ACTIVE Owner's name. The partial-unique `owner_name_unique WHERE deleted_at IS NULL` (V0_0_64__remove_is_deleted_field.sql:70) raises a unique-violation; the platform's jOOQ-error translation produces a `UniqueConstraintException` mapped to HTTP 400 USR003 via `ControllerAdvice.handleUniqueConstraint`. No test verifies this mapping for this endpoint specifically.",
    "Rename to soft-deleted name — no test asserts that renaming to a name held by a SOFT-DELETED Owner succeeds (the partial index allows it). This is the OWNER-side mirror of the createOwner sidecar's bugs_limitations_corner_cases[2] observation that a soft-deleted owner's name was previously blocking re-creation — the partial migration FIXED that for both create and update.",
    "Role-rebind semantics — no test asserts that PUT with `roles: []` deletes all role-links (the destructive-empty semantics of `deleteOwnerRelationsExcept`); no test asserts that PUT with `roles: null` (omitted) is equivalent to `roles: []` per `getRoleIdsList`'s `CollectionUtils.isEmpty` branch (`OwnerServiceImpl.java:117-122`).",
    "USER_OWNER_MAPPING survival — no test asserts that after rename, the previously-associated user can still log in and resolve to the SAME Owner (the load-bearing safe-rename invariant).",
    "Search-vector refresh — no test asserts that after rename, searches by the OLD name no longer match, AND searches by the NEW name DO match. Both vectors must update; a regression in either updateChangedOwnerVectors would leave stale indexes.",
    "Authorization regression — no test asserts that a caller WITHOUT `OWNER_UPDATE` permission receives 403, and WITH it receives 200. The SecurityRule entry is verified by code reading, not by an HTTP test.",
    "Auth-mode coverage — no test exercises DISABLED / LOGIN_FORM / OAUTH2 / LDAP behaviour against this endpoint.",
    "Concurrent-rename race — no test exercises two concurrent PUTs renaming Owner A to name `X` and Owner B to name `X`. The partial unique index serialises; one wins, the other receives USR003. Behaviour is plausibly correct, but unproven."
  ]
- test_files: [] — N/A. The owner-update HTTP boundary has no test of any kind. Confirmed by `grep -rln 'updateOwner|OwnerController' <odd-platform-api>/src/test/java/` 2026-05-20 (zero matches).
- gaps: |
    Owner rename is a privileged, broad-impact write: it mutates a row read by every
    Ownership join, every USER_OWNER_MAPPING-bridged lookup, every search query, and
    the owner-listing in the UI. Five distinct correctness contracts are bundled into
    this one endpoint (UPDATE owner.name + DELETE/INSERT owner_to_role + UPDATE search
    vectors × 2 + read-back) and not a single one is HTTP-asserted. A regression in
    the MapStruct mapper (`applyToPojo` silently dropping a field), in the role-rebind
    diff (the `deleteOwnerRelationsExcept` predicate misfiring), in the search-vector
    refresh (one of the two `updateChangedOwnerVectors` returning Mono.empty), or in
    the unique-constraint mapping (USR003 becoming a 500) would silently break this
    endpoint with the build still green.

## docs_link_semantic

- declared_docs: [] — N/A. The source file carries no `@docs` Javadoc annotation; consistent with odd-platform-api convention (no `@docs` annotations are bootstrapped).
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/owners"
    anchor: ""
    rationale: "Canonical live page describing what an Owner is and where it is managed in the UI; the audience for an Owner-update endpoint."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    confidence: MEDIUM
    fetched_excerpts: |
      WebFetched 2026-05-20 status 200; page is SILENT on Owner rename — does not
      describe: rename mechanics, side effects on USER_OWNER_MAPPING, audit
      behaviour, name-collision behaviour, case-sensitivity rules, or idempotence.
      Verbatim absence (LLM-summary of WebFetched content): "page does not
      address renaming operations, their effects on mappings, audit logging,
      name collisions, case sensitivity, or idempotence." The owner-rename
      surface is undocumented from the operator's perspective.
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions"
    anchor: ""
    rationale: "Defines `OWNER_UPDATE` permission name verbatim — the gate on this endpoint."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      OWNER_UPDATE permission definition (verbatim from live page, WebFetched
      2026-05-20 status 200): "Allows editing an existing owner."
      The page does NOT describe what 'editing' covers (name? roles? both?),
      and does NOT describe any caveats (audit, idempotence, USER_OWNER_MAPPING
      side effects, name collisions, case-sensitivity).
- doc_drift_findings:
  - "OpenAPI declares HTTP 201 for `updateOwner` success (`openapi.yaml:196` `responses.'201': 'The resource has been successfully updated'`), but the controller returns `ResponseEntity.ok` = 200 (`OwnerController.java:53`). This is a TWO-LAYER doc-drift: (a) the OpenAPI spec uses 201 for an UPDATE (anomalous — 201 is canonically a POST-create status code; PUT-update should declare 200); (b) the implementation disagrees with the spec it declares. Sibling write operations on this controller (`createOwner` per the batch-E sidecar) have the SAME 201-vs-200 pattern; the asymmetry is class-wide."
  - "Live owners doc page (WebFetched 2026-05-20 status 200) is SILENT on Owner-rename semantics — does not describe what happens to USER_OWNER_MAPPING rows when an Owner is renamed (the answer is: nothing — the FK is by `owner_id`, not by `name`; rename is safe; surfaced here for back-link with REFACTOR-391's OIDC_USERNAME-rename hazard). The doc page does not address audit-log absence, name-collision behaviour, case-sensitivity, or idempotence. An operator reading the live page cannot predict any of: (a) whether rename is destructive of role-bindings (yes, if `roles` is omitted/empty); (b) whether rename is destructive of user-owner mappings (no — mappings survive); (c) what HTTP code rename returns on collision (USR003 / 400); (d) whether the rename is audited (no — surfaced as known_security_gaps[0])."
  - "Live permissions doc page (WebFetched 2026-05-20 status 200) names `OWNER_UPDATE` verbatim with the single sentence 'Allows editing an existing owner.' It does NOT enumerate what 'editing' covers, what the surface looks like, what is mutated transactionally, or what the caveats are. Surface for doc-gap-finder triage as the inverse-of-coverage gap: a permission named on the live page maps to an endpoint whose contract semantics are nowhere documented for operators."

## implicit_adrs

- "Centralised endpoint authorization via `SecurityConstants.SECURITY_RULES` — the controller carries no `@PreAuthorize`; PUT /api/owners/{owner_id} is registered with `OWNER_UPDATE` (`SecurityConstants.java:144-145`). The authorization decision is enforced by the SecurityRule pipeline, not by an annotation on the controller method." — evidence: `SecurityConstants.java:144-145` (`new SecurityRule(NO_CONTEXT, new PathPatternParserServerWebExchangeMatcher('/api/owners/{owner_id}', PUT), OWNER_UPDATE)`) + `OwnerController.java:47-54` (controller method has no `@PreAuthorize`, no `@Secured`, no programmatic check) — intent_anchor: "new SecurityRule(NO_CONTEXT, new PathPatternParserServerWebExchangeMatcher(\"/api/owners/{owner_id}\", PUT), OWNER_UPDATE)" (`SecurityConstants.java:144-145`) — confidence: HIGH
- "`@ReactiveTransactional` boundary at the service, not the controller — the controller is a thin reactive proxy (`OwnerController.java:47-54`); the transaction annotation lives on `OwnerServiceImpl.update` (`OwnerServiceImpl.java:68-70`) so the existence-check, UPDATE owner, role-link rebind, two search-vector refreshes, and final read-back are atomic. This pattern is consistent across the platform's `*Controller → *ServiceImpl` chain (createOwner sidecar implicit_adrs[2] confirms the same pattern at the create sibling)." — evidence: `OwnerController.java:47-54` (no `@Transactional`) + `OwnerServiceImpl.java:68-70` (`@ReactiveTransactional`) — intent_anchor: "@ReactiveTransactional" (`OwnerServiceImpl.java:69`) — confidence: HIGH
- "Role-rebinding is set-replacement, not field-merge — `deleteOwnerRelationsExcept(owner.getId(), newRoles).then(createRelations(owner.getId(), newRoles))` (`OwnerServiceImpl.java:76-81`) deletes all existing role-links not in `newRoles` and inserts the new set. An empty `roles` field on the form is interpreted as 'remove all roles', not 'don't touch'. This is a CONVENTION inherited consistently across the platform's `*ServiceImpl` update methods that handle many-to-many relations (the same pattern lives in `OwnerToRoleRepository` callsites elsewhere); the maintainer's choice is to make PUT a full-replace, not a merge — consistent with REST semantics for PUT but ASYMMETRIC with the create path (`createOwner` SETs the same relations, not interpreting the absence)." — evidence: `OwnerServiceImpl.java:76-81` (the replace-via-deleteExcept-then-createRelations pattern) + `OwnerServiceImpl.java:117-122` (`getRoleIdsList` returns empty list for both null and empty `roles` — collapses the two cases) — intent_anchor: "`ownerToRoleRepository.deleteOwnerRelationsExcept(owner.getId(), newRoles).thenReturn(owner)` then `.flatMap(owner -> ownerToRoleRepository.createRelations(owner.getId(), newRoles).thenReturn(owner))`" (`OwnerServiceImpl.java:76-81`) — confidence: HIGH
- "Search-vector refresh is INSIDE the update transaction, not deferred to a background job — `updateChangedOwnerVectors` × 2 are awaited via `Mono.zip` inside the `@ReactiveTransactional` boundary (`OwnerServiceImpl.java:82, 109-114`). The choice trades response latency for read-after-write consistency: an UPDATE that completes guarantees the searches by the new name return the renamed owner immediately. The alternative (background-refresh) would shorten the response time but introduce a search-staleness window." — evidence: `OwnerServiceImpl.java:82, 109-114` (vectors refreshed within the transaction; both `Mono.zip` legs awaited before `getDto` read-back) + the absence of any housekeeping / async pattern around `updateChangedOwnerVectors` in the codebase — intent_anchor: "private Mono<OwnerPojo> updateSearchVectors(final OwnerPojo owner) { return Mono.zip(...).thenReturn(owner); }" (`OwnerServiceImpl.java:109-114`) — confidence: MEDIUM

## bugs_limitations_corner_cases

- "OpenAPI declared 201 Created for an UPDATE vs implementation-returned 200 OK — the contract (`openapi.yaml:196` `responses.'201'`) declares 201 for a PUT-update; the controller returns 200 (`OwnerController.java:53`). Doubly anomalous: (a) declaring 201 for a PUT-update is itself unusual (201 canonically signals POST-creation); (b) the implementation disagrees with the spec. This is the IDENTICAL pattern from the createOwner sibling (createOwner.md:bugs_limitations_corner_cases[0]) — class-wide inconsistency, not a per-method oversight." — evidence: `openapi.yaml:195-201` (declared 201) + `OwnerController.java:53` (`.map(ResponseEntity::ok)`) + createOwner.md:bugs_limitations_corner_cases[0] cross-link — severity: MEDIUM
- "**Owner rename emits NO activity-feed event** — `@ActivityLog` is applied to `AlertServiceImpl`, `DataEntityServiceImpl`, `DataEntityGroupServiceImpl`, `AlertHaltConfigServiceImpl`, `DataEntityInternalStateServiceImpl`, `OwnershipServiceImpl` (Ownership ≠ Owner, OWNERSHIP_CREATED/UPDATED/DELETED on data-entity-owner relations) but NOT to `OwnerServiceImpl.update` (verified via `grep '@ActivityLog' OwnerServiceImpl.java` 2026-05-20 → zero matches). The activity-feed surface therefore does NOT record 'owner X was renamed from A to B by C at T' or 'owner X had roles [A, B] before, now has [B, C]'. The role-rebind is silently destructive of audit history. Mirrors createOwner.md:bugs_limitations_corner_cases[4] — the absence is symmetric across the Owner mutation surface." — evidence: `OwnerServiceImpl.java:68-85` (no `@ActivityLog` on update method) + `OwnerServiceImpl.java:38-66, 87-100` (no `@ActivityLog` on create/delete either) + `grep -l '@ActivityLog' <odd-platform-api>/service/*.java` (returns 6 files, none of them OwnerServiceImpl) — severity: MEDIUM
- "**Rename collision is propagated as USR003 / HTTP 400, NOT 409 Conflict** — the `owner_name_unique` partial unique index (V0_0_64__remove_is_deleted_field.sql:70) catches the second rename to the same active name; jOOQ raises `DataAccessException` → `ExceptionUtils.translateDatabaseException` → `UniqueConstraintException` → `ControllerAdvice.handleUniqueConstraint` → HTTP 400 with `ErrorCode.UNIQUE_CONSTRAINT` (per F-006 batch-K cross-batch-correction enumeration). The client receives 400, not the canonically-correct 409 Conflict. NO test verifies this code path; NO API doc indicates which code the client should expect on collision." — evidence: V0_0_64__remove_is_deleted_field.sql:68-70 (partial unique index) + F-006.yaml batch-K cross_batch_corrections[0] (the USR003 4xx-vs-5xx correction; same translation path applies here) + `OwnerServiceImpl.java:69-85` (no pre-check for name collision; no `getByName` call before update) — severity: MEDIUM
- "**Empty `roles` field is destructive of role bindings** — `OwnerFormData.roles` is OpenAPI-optional (`components.yaml:419-422`; `requiredMode` not declared); `getRoleIdsList` (`OwnerServiceImpl.java:117-122`) collapses both null and empty list to `List.of()`. The update transaction then calls `deleteOwnerRelationsExcept(ownerId, List.of()).then(createRelations(ownerId, List.of()))` — the first half DELETES all current role-links (since no existing link is in the empty-set); the second half INSERTS nothing. **An operator updating ONLY the owner name (omitting `roles` to mean 'don't touch') instead REMOVES all role assignments.** This is a silent, destructive UX hazard: the form's `roles` is treated as REPLACE-NULL-WITH-EMPTY, not as IGNORE-IF-OMITTED. The UI in practice always sends the current `roles` list (`owners.thunks.ts` per UI source code), so the hazard is masked in normal UI flows — but any API consumer (script, integration) that omits `roles` will silently strip roles." — evidence: `OwnerServiceImpl.java:71, 76-81, 117-122` + `components.yaml:419-422` (`roles` optional, no `required` marker on field) — severity: HIGH
- "**Name field has no case-sensitivity / homoglyph normalization** — `OwnerMapper.applyToPojo` (`OwnerMapper.java:18`) applies the form's name verbatim. The partial unique index `owner_name_unique` is case-SENSITIVE (no `LOWER(...)` in the index definition per V0_0_36__refactor_unique_index.sql:9 and V0_0_64 reinstatement); 'Alice' and 'alice' are distinct, both can coexist. No `@NotBlank`, no `@Size`, no `@Pattern` constraint on `OwnerFormData.name` (`components.yaml:417-418`); no service-layer trim / lowercase normalisation (`OwnerServiceImpl.java:68-85`); no MapStruct custom mapping. An operator can rename to whitespace-only, empty-string (NOT rejected — `@NotBlank` absent), or homoglyph-collision name. The case-sensitivity differs from many enterprise expectations (LDAP and OIDC tokens use case-insensitive principals in practice) — surface for triage. Mirrors createOwner.md:bugs_limitations_corner_cases[5]." — evidence: V0_0_36__refactor_unique_index.sql:9 + V0_0_64__remove_is_deleted_field.sql:68-70 (no LOWER on the index) + `components.yaml:417-418` (no minLength/maxLength/pattern) + `OwnerServiceImpl.java:68-85` (no normalization) + `OwnerMapper.java:18` — severity: MEDIUM
- "**Idempotence is partial — name UPDATE is idempotent but role-rebind is destructive on each call** — repeated PUTs of the same body should be no-ops per REST conventions. The name UPDATE is idempotent (the row's `name` is overwritten to the same value; `updated_at` does change on each call, but content is stable). The role-rebind path is NOT a true no-op: `deleteOwnerRelationsExcept(ownerId, [A, B]).then(createRelations(ownerId, [A, B]))` issues a DELETE of any role-link NOT in [A, B] (no-op if [A, B] matches current state) AND an INSERT of [A, B] (which DUPLICATES existing rows). The `owner_to_role` table's schema would need a unique constraint on (owner_id, role_id) to prevent duplication — V0_0_55__add_policies_and_roles.sql:55 creates the table but its unique constraint state is not visible in the grep results I gathered; the createRelations behaviour suggests an `INSERT ... ON CONFLICT DO NOTHING` or similar tolerance, or duplicate rows accumulate silently. Surface for triage; a duplicate-rows-on-replay regression would be hard to detect from outside." — evidence: `OwnerServiceImpl.java:76-81` (the rebind shape) + V0_0_55__add_policies_and_roles.sql:55 (`owner_to_role` table creation — full constraint inspection out of scope for this sidecar) — severity: LOW
- "Under `auth.type=DISABLED`, PUT /api/owners/{owner_id} is anonymously reachable — the SecurityRule for `OWNER_UPDATE` (`SecurityConstants.java:144-145`) remains in the rules list but the DISABLED authentication mode bypasses the WebFlux security filter chain (`DisabledAuthSecurityConfiguration.java:11-19` per the batch-C / batch-O REFACTOR-185 enumeration). Anonymous renaming of any Owner is then unbounded; combined with the no-audit-log gap, the directory can be silently rewritten by any caller on a network-reachable port. Cross-link: REFACTOR-185 (the 16-sidecar triangulation; this is the 17th surface)." — evidence: `SecurityConstants.java:144-145` + `DisabledAuthSecurityConfiguration.java:11-19` per batch-C sidecar + REFACTOR-185.md (the cross-cutting enumeration) — severity: LOW (corollary of REFACTOR-185; DISABLED is dev-only per docs)

## security

- **auth_mode_relevance**: `LOGIN_FORM | OAUTH2 | LDAP` (the three modes that protect the UI/API surface; per the batch-C `*SecurityConfiguration` sidecars). Under `DISABLED` the endpoint is anonymously reachable — the SecurityRule remains in the list but the filter chain doesn't run (`DisabledAuthSecurityConfiguration.java:11-19`; REFACTOR-185). `S2S` is not relevant — S2S protects `/ingestion/entities` POST only, not `/api/owners*`. The method carries no `@ConditionalOnProperty`.
- **ingestion_filter_relevance**: `NO — UI/API surface, not /ingestion/entities`. The `IngestionDataEntitiesFilter` matches `/ingestion/entities` POST only (per batch-A class-level sidecar); `PUT /api/owners/{owner_id}` does not match.
- **authorization_assertions**:
  - "`SecurityRule(NO_CONTEXT, '/api/owners/{owner_id}' PUT, OWNER_UPDATE)` — the rule is registered in `SecurityConstants.SECURITY_RULES[144-145]` and consumed by `AuthorizationCustomizer` to add a permission check to the WebFlux security chain. The `NO_CONTEXT` AuthorizationManagerType signals this is a global (non-per-resource) gate, evaluated against the caller's Policy/Permission set — i.e., ANYONE with `OWNER_UPDATE` can rename ANY owner, including unrelated owners they have no ownership-association with. There is NO per-Owner scoping at this gate." — evidence: `SecurityConstants.java:144-145`
- **owner_scoping**: `N/A — code is not data-scoped at this directory layer` AND `BYPASSES at the per-Owner-target dimension` — the endpoint mutates a directory entry by id; there is no concept of "this Owner row belongs to that user, so only that user can rename it." A caller with `OWNER_UPDATE` permission can rename ANY Owner row, not just the one(s) they are associated with via USER_OWNER_MAPPING. This is consistent with the centralised permission model (OWNER_UPDATE is a global management permission, not a per-Owner permission). Whether this is the intended design or a missed per-Owner scope is a maintainer call — surface for triage. Cross-link: REFACTOR-024 family (the broader 'no per-Owner scoping' posture across the platform).
- **data_exposure**:
  - "Updated Owner payload (id, name, roles, associated_user) → caller WITH `OWNER_UPDATE` permission under LOGIN_FORM/OAUTH2/LDAP via `PUT /api/owners/{owner_id}` (echoes back the renamed row including the new role bindings). Only the just-updated row is exposed, not the broader directory." — evidence: `OwnerController.java:47-54` + `OwnerServiceImpl.java:69-85` + `OwnerMapper.mapFromDto` (`OwnerMapper.java:22-23`) + `SecurityConstants.java:144-145`
  - "Same payload → ANONYMOUS callers under `auth.type=DISABLED`" — evidence: `DisabledAuthSecurityConfiguration.java:11-19` (per batch-C sidecar) + `SecurityConstants.java:144-145` (rule exists but filter chain bypassed) + REFACTOR-185.md (16-sidecar triangulation)
- **known_security_gaps**:
  - "Owner rename has NO audit / activity-feed event — no `@ActivityLog` on `OwnerServiceImpl.update` (verified by grep across `service/*.java` 2026-05-20). A privileged operation that mutates platform-wide directory state AND destructively replaces an Owner's role assignments is invisible to the audit. Sibling write operations on data-entity surface (description updates, alert status changes, ownership creations) DO emit activity events. The asymmetry between Owner-mutation (silent) and Ownership-mutation (logged via OwnershipServiceImpl @ActivityLog at OwnershipServiceImpl.java:48,77,100) is undocumented and surface-mismatched. Mirrors createOwner.md:security.known_security_gaps[0] — the absence is consistent across the Owner mutation surface." — evidence: `OwnerServiceImpl.java:68-85` (no `@ActivityLog`) + `grep -l '@ActivityLog' <odd-platform-api>/service/*.java` (returns 6 files, none of them OwnerServiceImpl) + `OwnershipServiceImpl.java:48,77,100` (Ownership IS logged — the asymmetry) — severity: MEDIUM
  - "No per-Owner authorization scoping — `OWNER_UPDATE` is a global management permission (`SecurityConstants.java:144-145` uses `NO_CONTEXT`). A caller with `OWNER_UPDATE` can rename ANY Owner row, regardless of whether they are USER_OWNER_MAPPING-bound to that Owner. There is no `@PreAuthorize` enforcing 'only an admin or the bound user can rename their own owner'. Whether this is intentional (admin-only permission model) or a missed scoping is the maintainer's triage call. The live permissions doc names `OWNER_UPDATE` as 'Allows editing an existing owner' — silent on which owners. Cross-link: REFACTOR-024 family — same posture across the platform (no per-entity scoping at the SecurityRule layer); ADR-CANDIDATE-003 (read-collaborative catalog) may defend this as the intentional posture, but the write-side equivalent (write-collaborative-directory?) is not articulated in any ADR draft." — evidence: `SecurityConstants.java:144-145` (`NO_CONTEXT`) + WebFetch permissions page 2026-05-20 (silent on per-Owner scope) — severity: MEDIUM
  - "Empty `roles` field silently destroys all role bindings — `OwnerFormData.roles` is optional at the OpenAPI contract (`components.yaml:419-422`); `getRoleIdsList` collapses null AND empty list to `List.of()` (`OwnerServiceImpl.java:117-122`); the update transaction then calls `deleteOwnerRelationsExcept(ownerId, List.of())` which deletes ALL existing role-links. An API consumer (script, integration, malformed UI request) that omits `roles` to mean 'don't touch' instead silently strips ALL roles from the Owner. This is a DESTRUCTIVE-DEFAULT UX hazard with NO confirmation step, NO 'are you sure' check, NO partial-update mechanism. Combined with the no-audit-log gap, role-stripping is silent AND irreversible from logs." — evidence: `OwnerServiceImpl.java:71, 76-81, 117-122` + `components.yaml:419-422` — severity: HIGH
  - "Name input is case-sensitive AND has no normalisation — operators can create homoglyph collisions or whitespace-only / control-character names. The partial unique index `owner_name_unique` (V0_0_36 / V0_0_64) is case-sensitive (no `LOWER(...)`); the contract has no `@NotBlank` / `@Size` / `@Pattern`; the service layer has no trim / lowercase / collision-check. Mitigated by the `OWNER_UPDATE` permission gate (callers are pre-trusted), but a UI homoglyph attack against the owner list is unmitigated at this layer. Mirrors createOwner.md:security.known_security_gaps[1]." — evidence: V0_0_36__refactor_unique_index.sql:9 + V0_0_64__remove_is_deleted_field.sql:68-70 + `components.yaml:417-418` (no string constraints) + `OwnerServiceImpl.java:68-85` (no normalisation) + `OwnerMapper.java:18` (verbatim apply) — severity: LOW
  - "Under `auth.type=DISABLED`, anonymous rename — the SecurityRule remains in the rules list but the WebFlux filter chain doesn't run. Combined with no-audit, anonymous callers on a network-reachable port can rename any Owner silently. This is the 17th surface in the REFACTOR-185 enumeration (the 16-sidecar triangulation of DISABLED-mode anonymous reach)." — evidence: `DisabledAuthSecurityConfiguration.java:11-19` per batch-C sidecar + `SecurityConstants.java:144-145` + REFACTOR-185.md (the enumeration) — severity: LOW

## performance

- **hot_paths**: [] — N/A. Owner rename is an admin-time operation (per the live owners doc, "managed in the Management → Owners tab"), not a per-render or per-event call. The endpoint is not on the UI's hot path; no metric tracks its rate.
- **throughput_characteristics**:
  - "Single reactive call — `Mono<ResponseEntity<Owner>>`; non-blocking I/O; no thread is held during the DB awaits" — evidence: `OwnerController.java:47-54`
  - "Per-request: one SELECT (`ownerRepository.get`), one UPDATE (`ownerRepository.update`), one DELETE (`deleteOwnerRelationsExcept`), N INSERTs (`createRelations`, N = `newRoles.size()`), TWO UPDATEs (search vectors via `Mono.zip`), one SELECT-with-joins (`ownerRepository.getDto`) for the read-back. Six DB round-trips for the no-role case (the two search vectors run in parallel via `Mono.zip` but each is a separate UPDATE statement); 5+N round-trips for the role-bearing case (createRelations may batch internally; out-of-scope to verify here)." — evidence: `OwnerServiceImpl.java:69-85, 109-114`
  - "No bulk-update variant — the contract supports one owner per request only (`OwnerFormData` carries a single `name`)" — evidence: `components.yaml:414-424` (single `name` field)
- **resource_allocation**:
  - "Per-request allocations are bounded by `formData.roles` size — the controller deserialises the JSON body via Jackson with WebFlux's default codec config (no explicit override). Peak memory is a small constant plus the role list. The read-back joins OWNER, OWNER_TO_ROLE, ROLE, and USER_OWNER_MAPPING — all bounded by the just-updated row's relations." — evidence: `OwnerController.java:48-53` + `ReactiveOwnerRepositoryImpl.java:66-83` (the `getDto` join shape)
  - "Two search-vector UPDATE statements potentially scan and rewrite multiple rows in `search_entrypoint` + `term_search_entrypoint` per owner — `updateChangedOwnerVectors(ownerId)` (signature only, downstream SQL not inspected here) updates the rows whose owner-name appears in tsvector columns. Cost scales with the count of search-entries referencing this owner; for a high-cardinality owner with many ownership rows, the rename is amortised O(N) over those rows." — evidence: `OwnerServiceImpl.java:111-112` (the two updateChangedOwnerVectors calls) — confidence: MEDIUM (downstream SQL not inspected in this sidecar's scope)
- **scaling_characteristics**:
  - "Stateless controller method — horizontal scaling unconstrained at this layer" — evidence: `OwnerController.java:47-54` (no instance state)
  - "The `@ReactiveTransactional` boundary at the service holds a DB connection from the existence-check through the final read-back (`OwnerServiceImpl.java:69-85`). Under concurrent load, connection-pool contention scales with request rate × transaction duration; transaction duration grows with role count (one extra INSERT per role) AND with the search-entry cardinality of the owner (more rows to rewrite in the two search-vector UPDATEs)."
  - "Name-uniqueness contention — the `owner_name_unique` partial unique index serializes concurrent renames to the same name (one wins, others throw USR003). Not a perf concern at admin-time rates, but the synchronization point exists. The clean-rename case (target name unused) has no contention." — evidence: V0_0_64__remove_is_deleted_field.sql:70 (`owner_name_unique`)
- **known_performance_gaps**:
  - "No method-level observability — no `@Timed`, no Micrometer counter, no structured log entry beyond the default Spring access log. Admin-time renames that take seconds to complete (high search-entry cardinality, role-rebind cascade) surface only in WebFlux / pool metrics, not at the operation boundary. Mirrors createOwner.md:performance.known_performance_gaps[0]." — evidence: `OwnerController.java:47-54` + `OwnerServiceImpl.java:68-85` — severity: LOW
  - "Six round-trips for the no-role case (existence-check + UPDATE + DELETE-role-links + INSERT-zero-role-links + 2× UPDATE search vectors + SELECT-join read-back) — the existence-check could be folded into the UPDATE's `WHERE id = ?` (a zero-row UPDATE means 'not found'), saving one round-trip; the read-back could be skipped if the response payload were built from the just-updated POJO and the role list passed in, saving another. The current implementation prioritises correctness of the joined `Owner` shape and explicit 404 semantics over latency. Acceptable for admin-time use." — evidence: `OwnerServiceImpl.java:69-85` (the explicit six-step pipeline) — severity: LOW

## sources

- understanding ← `OwnerController.java:47-54` (the five-line method body) + `OwnerServiceImpl.java:68-85` (downstream service transaction) + `OwnerServiceImpl.java:109-114` (search vector helper) + `SecurityConstants.java:144-145` (authorization gate) + WebFetch live owners doc 2026-05-20 status 200 + WebFetch live permissions doc 2026-05-20 status 200
- concepts.entities ← `OwnerController.java:7-8, 48` (`Owner`, `OwnerFormData` imports + return type) + `components.yaml:414-424` (`OwnerFormData` schema) + `OwnerServiceImpl.java:76-81` (`OwnerToRole` link side effect) + V0_0_4__add_user_owner_mapping.sql:3 (USER_OWNER_MAPPING.OWNER_ID FK by id) + `OwnerServiceImpl.java:111-112` (SEARCH_ENTRYPOINT + TERM_SEARCH_ENTRYPOINT)
- concepts.operations ← `OwnerServiceImpl.java:69-85` (the transactional shape) + `OwnerServiceImpl.java:109-114` (search-vector zip)
- concepts.invariants[0] (transactional) ← `OwnerServiceImpl.java:68-70` (`@ReactiveTransactional`) + `OwnerController.java:47-54` (no controller-level transaction)
- concepts.invariants[1] (rename does not orphan USER_OWNER_MAPPING) ← V0_0_4__add_user_owner_mapping.sql:3 (`owner_id bigint UNIQUE` referencing `owner(id)` — the FK is by id) + `ReactiveAbstractCRUDRepository.java:162-173` (UPDATE shape — mutates by id, name is just a column) + ReactiveUserOwnerMappingRepositoryImpl batch-N sidecar invariants (entities — `USER_OWNER_MAPPING` schema clarifies FK shape)
- concepts.invariants[2] (404 on missing) ← `OwnerServiceImpl.java:72-73` (`switchIfEmpty(Mono.error(new NotFoundException("Owner", id)))`)
- concepts.invariants[3] (OpenAPI 201 vs impl 200) ← `openapi.yaml:195-201` (declared 201) + `OwnerController.java:53` (`.map(ResponseEntity::ok)`)
- concepts.invariants[4] (set-based role replacement) ← `OwnerServiceImpl.java:76-81` (replace-via-deleteExcept-then-createRelations) + `OwnerServiceImpl.java:117-122` (`getRoleIdsList` collapses null + empty)
- concepts.invariants[5] (name overwrite, no merge) ← `OwnerMapper.java:18` (`applyToPojo` with `@MappingTarget`) + `components.yaml:417-418, 423-424` (`name` required, no constraints)
- concepts.invariants[6] (search vectors refresh in-transaction) ← `OwnerServiceImpl.java:82, 109-114` + transactional boundary at line 69
- concepts.audiences ← WebFetch live owners doc 2026-05-20 + WebFetch live permissions doc 2026-05-20 + `SecurityConstants.java:144-145`
- dependencies_semantic.requires-feature ← WebFetch live owners doc 2026-05-20 status 200 + WebFetch live permissions doc 2026-05-20 status 200 + `SecurityConstants.java:144-145` + `OwnerServiceImpl.java:111-112, 76-81`
- dependencies_semantic.requires-runtime[2] (Postgres partial-unique) ← V0_0_36__refactor_unique_index.sql:9 + V0_0_64__remove_is_deleted_field.sql:68-70 (`owner_name_unique` partial unique index)
- dependencies_semantic.requires-runtime[3] (USER_OWNER_MAPPING schema) ← V0_0_4__add_user_owner_mapping.sql:3
- dependencies_semantic.coupling[0] (OwnerApi) ← `OwnerController.java:5, 17, 47` (`OwnerApi` import + `implements OwnerApi` + `@Override` on updateOwner)
- dependencies_semantic.coupling[1] (OwnerService) ← `OwnerService.java:21` (`Mono<Owner> update(long, OwnerFormData)`) + `OwnerServiceImpl.java:68-85`
- dependencies_semantic.coupling[2] (OwnerMapper) ← `OwnerMapper.java:18` + `OwnerServiceImpl.java:74`
- dependencies_semantic.coupling[3] (Repository.update inherited) ← `ReactiveOwnerRepository.java:11` (`extends ReactiveCRUDRepository<OwnerPojo>`) + `ReactiveAbstractCRUDRepository.java:108-110, 162-173`
- dependencies_semantic.coupling[4] (role-rebind primitives) ← `OwnerServiceImpl.java:76-81`
- dependencies_semantic.coupling[5] (search-vector refresh) ← `OwnerServiceImpl.java:111-112`
- dependencies_semantic.coupling[6] (SecurityRule) ← `SecurityConstants.java:144-145`
- dependencies_semantic.coupling[7] (NotFoundException + ControllerAdvice) ← `OwnerServiceImpl.java:13, 73`
- tests_coverage_semantic.test_files (empty) ← `grep -rln 'updateOwner|OwnerController' <odd-platform-api>/src/test/java/` 2026-05-20 (zero matches)
- docs_link_semantic.inferred_docs[0] ← WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/owners` 2026-05-20 status 200
- docs_link_semantic.inferred_docs[1] ← WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions` 2026-05-20 status 200
- docs_link_semantic.doc_drift_findings[0] (201-vs-200) ← `openapi.yaml:195-201` + `OwnerController.java:53` + createOwner sibling sidecar cross-link
- docs_link_semantic.doc_drift_findings[1] (live doc silence on rename) ← WebFetch live owners doc 2026-05-20 + V0_0_4 FK shape (the answer the doc fails to provide)
- docs_link_semantic.doc_drift_findings[2] (live permissions doc silence on OWNER_UPDATE scope) ← WebFetch live permissions doc 2026-05-20
- implicit_adrs[0] (centralised SECURITY_RULES) ← `SecurityConstants.java:144-145` + `OwnerController.java:47-54` (no annotation)
- implicit_adrs[1] (@ReactiveTransactional at service) ← `OwnerController.java:47-54` + `OwnerServiceImpl.java:68-70`
- implicit_adrs[2] (set-replace role rebind) ← `OwnerServiceImpl.java:76-81, 117-122`
- implicit_adrs[3] (in-transaction search vector refresh) ← `OwnerServiceImpl.java:82, 109-114`
- bugs_limitations_corner_cases[0] (201-vs-200) ← `openapi.yaml:195-201` + `OwnerController.java:53` + createOwner.md:bugs[0] cross-link
- bugs_limitations_corner_cases[1] (no audit log) ← `OwnerServiceImpl.java:68-85` (no `@ActivityLog`) + `grep '@ActivityLog' <odd-platform-api>/service/*.java` 2026-05-20
- bugs_limitations_corner_cases[2] (USR003 vs 409) ← V0_0_64__remove_is_deleted_field.sql:68-70 + F-006 batch-K cross-batch-corrections
- bugs_limitations_corner_cases[3] (empty roles destroys bindings) ← `OwnerServiceImpl.java:71, 76-81, 117-122` + `components.yaml:419-422`
- bugs_limitations_corner_cases[4] (case-sensitive, no normalisation) ← V0_0_36__refactor_unique_index.sql:9 + V0_0_64 + `components.yaml:417-418` + `OwnerServiceImpl.java:68-85` + `OwnerMapper.java:18`
- bugs_limitations_corner_cases[5] (partial idempotence) ← `OwnerServiceImpl.java:76-81` + V0_0_55__add_policies_and_roles.sql:55 (owner_to_role table)
- bugs_limitations_corner_cases[6] (DISABLED anonymous reach) ← `SecurityConstants.java:144-145` + `DisabledAuthSecurityConfiguration.java:11-19` batch-C sidecar + REFACTOR-185.md
- security.auth_mode_relevance ← `OwnerController.java:47-54` (no `@ConditionalOnProperty`) + batch-C class-level sidecars
- security.ingestion_filter_relevance ← batch-A `IngestionDataEntitiesFilter` class-level sidecar
- security.authorization_assertions[0] ← `SecurityConstants.java:144-145`
- security.owner_scoping ← `SecurityConstants.java:144-145` (`NO_CONTEXT`) + REFACTOR-024 cross-link
- security.data_exposure[0] ← `OwnerController.java:47-54` + `OwnerServiceImpl.java:69-85` + `OwnerMapper.java:22-23` + `SecurityConstants.java:144-145`
- security.data_exposure[1] (DISABLED) ← `DisabledAuthSecurityConfiguration.java:11-19` batch-C sidecar + REFACTOR-185.md
- security.known_security_gaps[0] (no audit log) ← `OwnerServiceImpl.java:68-85` + `OwnershipServiceImpl.java:48,77,100` (asymmetry)
- security.known_security_gaps[1] (no per-Owner scope) ← `SecurityConstants.java:144-145` (NO_CONTEXT) + WebFetch permissions doc 2026-05-20
- security.known_security_gaps[2] (empty roles destroys bindings) ← `OwnerServiceImpl.java:71, 76-81, 117-122` + `components.yaml:419-422`
- security.known_security_gaps[3] (case-sensitive, no normalisation) ← V0_0_36/V0_0_64 + `components.yaml:417-418` + `OwnerServiceImpl.java:68-85`
- security.known_security_gaps[4] (DISABLED anonymous reach) ← `DisabledAuthSecurityConfiguration.java:11-19` + REFACTOR-185.md
- performance.throughput_characteristics[0] ← `OwnerController.java:47-54`
- performance.throughput_characteristics[1] ← `OwnerServiceImpl.java:69-85, 109-114`
- performance.throughput_characteristics[2] ← `components.yaml:414-424`
- performance.resource_allocation[0] ← `OwnerController.java:48-53` + `ReactiveOwnerRepositoryImpl.java:66-83`
- performance.resource_allocation[1] (search vector cost) ← `OwnerServiceImpl.java:111-112`
- performance.scaling_characteristics[0] ← `OwnerController.java:47-54`
- performance.scaling_characteristics[1] ← `OwnerServiceImpl.java:69-85`
- performance.scaling_characteristics[2] ← V0_0_64__remove_is_deleted_field.sql:68-70
- performance.known_performance_gaps[0] ← `OwnerController.java:47-54` + `OwnerServiceImpl.java:68-85` + createOwner.md:performance[0] cross-link
- performance.known_performance_gaps[1] ← `OwnerServiceImpl.java:69-85` (the explicit pipeline)

## confidence_per_field

- understanding: HIGH (every claim verified against the controller, the service, the abstract CRUD base, the security rule list, the OpenAPI spec, the schema migrations, and the WebFetched live docs)
- concepts: HIGH (entities, operations, invariants all anchored at file:line; the load-bearing invariant — that USER_OWNER_MAPPING survives rename — is anchored at V0_0_4__add_user_owner_mapping.sql:3 FK declaration)
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH (absence-of-tests verified by file-system search and grep 2026-05-20)
- docs_link_semantic: HIGH (both URLs WebFetched 2026-05-20 status 200; the binding endpoint→doc is enricher judgment but anchored on the explicit `OWNER_UPDATE` permission name shared verbatim with the permissions page; the SILENCE finding is itself a positive WebFetch result, not pretraining inference)
- implicit_adrs: HIGH (the centralised-`SECURITY_RULES` pattern, the service-layer `@ReactiveTransactional`, the set-replace role-rebind, the in-transaction search-vector refresh — all directly visible at cited lines)
- bugs_limitations_corner_cases: HIGH (every concern cited file:line against the controller, service, mapper, model, schema, and migration history; the empty-roles-destroys-bindings hazard verified by tracing OwnerServiceImpl.java:117-122 → 76-81)
- security: HIGH (every claim is structural and traces to OwnerController, OwnerServiceImpl, SecurityConstants, the database migrations, the related batch-C/batch-A sidecars, REFACTOR-185, and the live authorization/permissions doc pages)
- performance: HIGH (the throughput / round-trip shape is directly visible at the service; the absence of observability and the read-back-cost decision are both anchored in the cited code; the search-vector cost estimate is MEDIUM-anchored — downstream SQL not inspected here)

## Maintainer notes

