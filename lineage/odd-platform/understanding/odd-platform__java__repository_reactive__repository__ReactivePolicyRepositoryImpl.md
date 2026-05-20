---
node_id: "odd-platform java repository reactive repository:ReactivePolicyRepositoryImpl"
node_kind: repository
axis: repositories
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.2.0
schema_version: v0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-19-H-ReactivePolicyRepositoryImpl
---

# ReactivePolicyRepositoryImpl — semantic understanding

## understanding

The persistence-layer bean owning every read and write to the `policy` table — the table that holds the named JSON authorization rules that, the moment they are bound to a role, become operative authorization policy for every platform request. The implementation file itself is a 40-line shell (`ReactivePolicyRepositoryImpl.java:1-40`): it adds exactly one method (`getRolesPolicies`, the policy-by-role JOIN used to resolve the current user's effective policies on every authorized request) and inherits all standard CRUD — `create / update / get / list / delete / bulkCreate / bulkUpdate` — from `ReactiveAbstractSoftDeleteCRUDRepository` (`ReactivePolicyRepositoryImpl.java:19`). The soft-delete base means `delete(id)` is an UPDATE setting `deleted_at = NOW()`, never an actual `DELETE FROM`, and every `get` / `list` is automatically scoped to `WHERE deleted_at IS NULL`. The DB-side counterpart is a partial UNIQUE INDEX `policy_name_unique ON policy(name) WHERE deleted_at IS NULL` (`V0_0_55__add_policies_and_roles.sql:30`) — the SQL-layer recreation-after-soft-delete invariant that the controller-layer `Administrator`-name asymmetry (batch E) depends on.

## concepts

- entities: [PolicyPojo (jOOQ-generated row record — id, name, policy text, created_at, updated_at, is_deleted, deleted_at), PolicyRecord (the typed jOOQ record), POLICY (jOOQ Tables constant referring to the `policy` table), ROLE_TO_POLICY (jOOQ Tables constant referring to the `role_to_policy` join table), policy_name_unique (partial unique index — DB-layer enforcement), Role (referenced via ROLE_TO_POLICY.ROLE_ID, not loaded here)]
- operations: [getRolesPolicies (JOIN policy ↔ role_to_policy on POLICY.ID, filter by ROLE_ID IN (...), return Mono<List<PolicyPojo>>), inherited create (INSERT INTO policy ... RETURNING ALL), inherited update (UPDATE policy SET ... WHERE id = ? AND deleted_at IS NULL RETURNING ALL), inherited get (SELECT FROM policy WHERE id = ? AND deleted_at IS NULL), inherited list (SELECT FROM policy WHERE deleted_at IS NULL [+ name ILIKE]), inherited delete (UPDATE policy SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL RETURNING ALL — soft delete), inherited bulkCreate / bulkUpdate (transactional, batched at BATCH_SIZE=1000)]
- invariants:
  - "Every read and the inherited delete are auto-scoped to `deleted_at IS NULL` by ReactiveAbstractSoftDeleteCRUDRepository.addSoftDeleteFilter (ReactiveAbstractSoftDeleteCRUDRepository.java:96-104) — soft-deleted policies are invisible to `get` / `list` and double-deletion is a no-op (the UPDATE matches zero rows)."
  - "The custom getRolesPolicies method does NOT carry the soft-delete filter (ReactivePolicyRepositoryImpl.java:32-38) — it returns soft-deleted policies if any `role_to_policy` row still references them. There is no foreign-key cascade on policy soft-delete (no service-layer cleanup of `role_to_policy` rows when a policy is soft-deleted); the schema's FK is on hard-delete only (V0_0_55__add_policies_and_roles.sql:52)."
  - "Policy-name uniqueness is enforced at the DATABASE layer via the partial unique index `policy_name_unique ON policy(name) WHERE deleted_at IS NULL` (V0_0_55__add_policies_and_roles.sql:30). The repository has no service-layer pre-check; a duplicate INSERT fails as a Postgres SQLSTATE 23505 which `JooqReactiveOperations.mono` maps to `UniqueConstraintException` via `ExceptionUtils.translateDatabaseException` (JooqReactiveOperations.java:41) with the message `'Policy with this name already exists'` (ExceptionUtils.java:60-62)."
  - "Soft-delete and the partial unique index together implement the platform's documented behaviour: a policy with name X can be soft-deleted, then a new policy with the same name X can be created (the partial index excludes the soft-deleted row from uniqueness). The soft-delete column `deleted_at` (LocalDateTime) is the SQL-layer flag; the `is_deleted` boolean column (V0_0_55__add_policies_and_roles.sql:26) exists in the DDL but the soft-delete base repository only writes `deleted_at`, NOT `is_deleted`. The `is_deleted` column is therefore effectively unused by this code path — confirmed by Grep — and is a candidate dead column."
  - "Single-statement INSERT / UPDATE on `create` / `update` (ReactiveAbstractCRUDRepository.java:103-110, 158-173) — NO @ReactiveTransactional on these inherited methods. Only bulkCreate / bulkUpdate are transactional (lines 113, 129). The Policy create / update / delete paths therefore commit per-statement; if a hypothetical audit-side-effect were added in the service layer (currently absent), it would NOT be atomic with the INSERT/UPDATE."
- audiences: [PolicyServiceImpl (only caller of every method on this repository — see upstream_callers), AbstractContextualPermissionExtractor / ManagementPermissionExtractor (transitive consumers of `getRolesPolicies` via `policyService.getCurrentUserPolicies()` — these run on EVERY authorized HTTP request that traverses the permission framework), database operators investigating the policy table directly]

## dependencies_semantic

- requires-feature:
  - "ReactiveAbstractSoftDeleteCRUDRepository (ReactivePolicyRepositoryImpl.java:19 — the entire CRUD surface lives in the base; this file adds only one method). Soft-delete semantics, the addSoftDeleteFilter helper, the deletedAtField wiring all come from the base."
  - "ReactiveAbstractCRUDRepository (the grandparent — defines create / update / get / list / bulkCreate / bulkUpdate, the pojoToRecord / recordToPojo / insertOne / updateOne plumbing, and the @ReactiveTransactional gate on bulk paths)."
  - "JooqReactiveOperations bean (constructor param at ReactivePolicyRepositoryImpl.java:22 — the wrapper around `DatabaseClient.inConnection` that runs every jOOQ query through R2DBC and maps DataAccessException → ExceptionWithErrorCode via ExceptionUtils.translateDatabaseException at JooqReactiveOperations.java:41,48)."
  - "JooqQueryHelper bean (constructor param at line 23 — supplies the pagination helper used by inherited list-with-paging; not exercised by getRolesPolicies)."
  - "jOOQ-generated `model.tables.POLICY` and `model.tables.ROLE_TO_POLICY` constants (static imports at lines 15-16). These are produced at build time from the Flyway-migrated PostgreSQL schema by the jOOQ codegen plugin (build.gradle)."
- requires-config:
  - "No `@Value` reads, no `@ConfigurationProperties`, no `spring.datasource.*` lookups inline. The bean's behaviour is configured exclusively through DI of JooqReactiveOperations (whose own `DatabaseClient` is configured by Spring R2DBC autoconfiguration — `spring.r2dbc.url`, `spring.r2dbc.username`, `spring.r2dbc.password` at the application level)."
  - "The Flyway migrations V0_0_55__add_policies_and_roles.sql (creates `policy`, `role`, `role_to_policy`) and V0_0_56__add_predefined_roles_and_policies.sql (seeds the Administrator policy + role + role-to-policy edge) must have executed at boot or jOOQ codegen would not have produced the POLICY constant. Migrations are wired via Flyway autoconfig."
- requires-runtime:
  - "Spring WebFlux (reactive Mono / Flux pipeline)."
  - "Reactor Core (Mono.just, .map, .collectList)."
  - "jOOQ-on-R2DBC (DSL.select / .from / .join / .where / .in — translated to a parameterised R2DBC SQL execution)."
  - "PostgreSQL with the `policy`, `role_to_policy` tables present and the `policy_name_unique` partial index in place (the unique-constraint translation in ExceptionUtils.java:60-62 depends on the Postgres error message containing `POLICY_NAME_UNIQUE`)."
- coupling:
  - "Strong coupling to the soft-delete base class — changing the soft-delete column name (`deleted_at`) or replacing the soft-delete pattern with hard delete would silently break the partial unique index assumption that operators rely on for the `recreate-after-delete` behaviour batch-E surfaced."
  - "Tight coupling to the schema's foreign-key choice on ROLE_TO_POLICY: the FK is on `policy_id` referencing `policy(id)` with NO `ON DELETE CASCADE` and NO trigger removing role_to_policy rows when `policy.deleted_at` is set. The implicit contract is: a soft-deleted policy with surviving role_to_policy rows will still appear in `getRolesPolicies(...)` results — because the JOIN does not filter `deleted_at IS NULL`. This is either a bug (orphan binding leaking permissions from a 'deleted' policy) or intentional (policy soft-delete is reversible AND keeps role bindings warm) — no code comment or migration note disambiguates."
  - "Implicit coupling to PolicyServiceImpl as sole caller: the repository is referenced ONLY by PolicyServiceImpl.java:18,31 and by its own interface. Every CRUD invariant the platform depends on — `Administrator`-name protection on update/delete, JSON-schema validation, the create/update asymmetry, the role-binding cascade-delete check — lives in the service, NOT the repository. The repository is intentionally policy-agnostic at the persistence layer."

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - "getRolesPolicies returns the JOIN'd policies for a list of roleIds with proper PolicyPojo deserialization — including the edge case of a roleId without bindings (returns empty list)."
    test_class: "ReactivePolicyRepositoryImplTest"
  - "getRolesPolicies returns Mono.just(List.of()) when the input roleIds list is empty or null — short-circuit at ReactivePolicyRepositoryImpl.java:29-31."
    test_class: "ReactivePolicyRepositoryImplTest"
  - "getRolesPolicies does NOT filter by `deleted_at IS NULL` — soft-deleted policies still attached to a role appear in the result. Pin the current (potentially-buggy) behaviour."
    test_class: "ReactivePolicyRepositoryImplTest"
  - "create() persists a new PolicyPojo and returns the populated row including the DB-assigned id and timestamps."
    test_class: "ReactivePolicyRepositoryImplTest"
  - "create() with a name colliding against an EXISTING live policy raises UniqueConstraintException with message 'Policy with this name already exists' — verified through the ExceptionUtils translation path (JooqReactiveOperations.java:41 → ExceptionUtils.java:60-62)."
    test_class: "ReactivePolicyRepositoryImplTest"
  - "create() with a name colliding against a SOFT-DELETED policy succeeds (the partial unique index excludes deleted_at IS NOT NULL rows). This is the soft-delete-aware recreation invariant the platform relies on."
    test_class: "ReactivePolicyRepositoryImplTest"
  - "delete() on a live policy sets `deleted_at = NOW()` (UPDATE, not DELETE) and returns the soft-deleted PolicyPojo. The is_deleted boolean column is NOT touched (dead column)."
    test_class: "ReactivePolicyRepositoryImplTest"
  - "delete() on an already-soft-deleted policy: idCondition adds `deleted_at IS NULL` filter, so the UPDATE matches zero rows and the Mono completes empty (not an error). Pin the current behaviour as it differs from a hard-delete semantic."
    test_class: "ReactivePolicyRepositoryImplTest"
  - "update() on a soft-deleted policy: idCondition adds `deleted_at IS NULL` filter so no rows match; the returning UPDATE produces no record and the Mono completes empty rather than raising NotFoundException. The NotFound semantic lives at the SERVICE layer (PolicyServiceImpl.java:74-75: `switchIfEmpty(Mono.error(new NotFoundException(...)))`) — a service-bypassing caller silently no-ops."
    test_class: "ReactivePolicyRepositoryImplTest"
  - "update() never mutates the `created_at` or `id` columns (ReactiveAbstractCRUDRepository.getNonUpdatableFields() + ReactiveAbstractSoftDeleteCRUDRepository.getNonUpdatableFields() which appends `deleted_at`). The `deleted_at` immutability via update is a defence against accidentally undeleting via the update path."
    test_class: "ReactivePolicyRepositoryImplTest"
  - "list() pagination plus name-query case-insensitive containsIgnoreCase filtering (inherited from base) — verify the soft-delete filter is appended (addSoftDeleteFilter at lines 87-89)."
    test_class: "ReactivePolicyRepositoryImplTest"
  - "Concurrency: two simultaneous create() with the same name — one succeeds, the other surfaces UniqueConstraintException (DB serialises via partial unique index)."
    test_class: "ReactivePolicyRepositoryImplConcurrencyTest"
  - "bulkCreate / bulkUpdate transactional rollback: when one record in the batch violates the unique constraint, are previously-inserted records rolled back? This exercises the @ReactiveTransactional on the base class (ReactiveAbstractCRUDRepository.java:113, 129) and is currently untested anywhere in the suite."
    test_class: "ReactivePolicyRepositoryImplTransactionalTest"
- test_files: []
- gaps: |
    Zero test coverage of any path through this repository — `Grep policyRepository|ReactivePolicyRepository|ReactivePolicyRepositoryImpl odd-platform-api/src/test`
    returns no matches (verified 2026-05-19). The only policy-related test
    file in the entire suite is `PolicyDeserializerTest.java` (DTO Jackson
    polymorphism, no DB / repository / service interaction). The repository
    sits on the critical RBAC path — every authorized HTTP request resolves
    permissions by calling `policyService.getCurrentUserPolicies()` which
    delegates to `policyRepository.getRolesPolicies(...)` (see
    upstream_callers below). A regression that (a) inverted the WHERE
    clause in getRolesPolicies; (b) broke the soft-delete filter in
    addSoftDeleteFilter; (c) silently changed the partial unique index
    behaviour during a schema migration; or (d) introduced a bug in
    bulkUpdate's transactional partitioning would all ship unchallenged.
    The soft-deleted-policy-still-in-getRolesPolicies behaviour
    (uncovered_behaviour 3 above) is the highest-leverage missing
    test — it pins a corner case that could become a vulnerability if
    soft-deletion ever becomes a UI-reachable operation that operators
    use to "revoke" a policy (today the platform protects against this
    by also requiring removal of `role_to_policy` edges through
    `PolicyServiceImpl.delete`'s cascade-attached check at
    PolicyServiceImpl.java:89-92, but a future refactor could weaken that).

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/policies"
    anchor: ""
    rationale: "Canonical operator-facing page for the Policies concept. The batch-E sibling sidecar (PolicyController.createPolicy) verified this page live 2026-05-12 status 200: it documents the policy JSON shape (resource types / conditions / permissions / the `ALL` keyword) but is silent on persistence — no mention of the `policy` table, the partial unique index, soft-delete semantics, the `Administrator` policy seed in V0_0_56, or audit logging. WebFetch was unavailable in this session so the verified state is inherited from the batch-E sidecar's fetch — see docs_link_semantic.inferred_docs[0] in odd-platform__java__PolicyController__controller-method__createPolicy.md."
    last_verified_at: "2026-05-12T00:00:00Z"
    last_verified_status: 200
    last_verified_via: "batch-E sidecar inheritance — direct WebFetch unavailable in batch-H session"
    confidence: LOW
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions"
    anchor: ""
    rationale: "Catalogue of platform Permissions referenced by SECURITY_RULES that gate the calling controller endpoints. Same batch-E verified state: page lists POLICY_CREATE / POLICY_UPDATE / POLICY_DELETE but does not name which `policy` table fields the operations touch or any DB-layer semantics. The repository layer is properly invisible to operator docs (correct abstraction) so the absence of repository-level coverage is not a doc gap PER SE — but the SOFT-DELETE-VS-RECREATION behaviour IS operator-visible (a deleted policy's name can be reused; a re-created policy starts fresh with new id) and should appear somewhere in the docs."
    last_verified_at: "2026-05-12T00:00:00Z"
    last_verified_status: 200
    last_verified_via: "batch-E sidecar inheritance — direct WebFetch unavailable in batch-H session"
    confidence: LOW
- fetched_excerpts: |
    Direct WebFetch was unavailable in this session (Permission to use WebFetch
    has been denied — 2026-05-19). The above doc-link records inherit the
    verified-2026-05-12 state captured in the batch-E sibling sidecar at
    `lineage/odd-platform/understanding/odd-platform__java__PolicyController__controller-method__createPolicy.md`
    docs_link_semantic.inferred_docs[0] and [1], where the policies page and
    permissions page were both confirmed status 200 and confirmed silent on
    persistence-layer details. No fresh excerpts are claimed in this sidecar.
- doc_drift_findings:
  - "REPOSITORY-DOC-GAP-A: The Policies operator page (verified 2026-05-12 batch-E) does not document the soft-delete-aware recreation invariant — that deleting a policy named X and creating a new policy named X yields a NEW id with EMPTY role bindings, and that any historical references to the old policy id (in `role_to_policy` if any survived, or in any audit log) are NOT remapped. A reader expecting hard-delete semantics will be surprised. The repository code (ReactivePolicyRepositoryImpl.java:19 + ReactiveAbstractSoftDeleteCRUDRepository.java:50-59 + V0_0_55__add_policies_and_roles.sql:30) is the source of this behaviour; the docs are silent."
  - "REPOSITORY-DOC-GAP-B: The Policies page does not document the absence of an FK cascade between `policy.deleted_at` and `role_to_policy.policy_id` — a policy can be soft-deleted with surviving role_to_policy edges that the custom `getRolesPolicies` method WILL return (because it does not filter `deleted_at IS NULL` at ReactivePolicyRepositoryImpl.java:32-38). The PolicyServiceImpl.delete path defends against this by raising CascadeDeleteException if `isPolicyAttachedToRole` returns true (PolicyServiceImpl.java:89-92), but the defence lives in the service, not the schema. A direct DB UPDATE setting `deleted_at` bypasses the defence and produces ghost-permission policies. The docs do not warn against direct DB manipulation of policy rows."

## upstream_callers

The exhaustive set of source-code locations that invoke any method on this repository. All discovered by `Grep policyRepository\\.|ReactivePolicyRepository <odd-platform-repo>` (verified 2026-05-19). The ONLY caller is `PolicyServiceImpl`:

- PolicyServiceImpl.java:47 — `policyRepository.get(id)` from `getPolicyDetails(long id)` — used by `GET /api/policies/{id}` (read path).
- PolicyServiceImpl.java:58 — `policyRepository.list(page, size, query)` from `list(page, size, query)` — used by `GET /api/policies` when the current user is an ADMIN (non-ADMIN users use the in-memory role-policy filter at PolicyServiceImpl.java:109-116, NOT the repository list).
- PolicyServiceImpl.java:67 — `policyRepository::create` from `create(PolicyFormData formData)` — used by `POST /api/policies` (batch-E PolicyController.createPolicy enrichment captures this end-to-end).
- PolicyServiceImpl.java:74 — `policyRepository.get(id)` from `update(long id, PolicyFormData formData)` — read-then-write under no transaction (lost-update race possible if two PUTs collide; verified by reading PolicyServiceImpl.java:71-81 end-to-end).
- PolicyServiceImpl.java:79 — `policyRepository::update` from same update flow.
- PolicyServiceImpl.java:85 — `policyRepository.get(id)` from `delete(long id)` — exists check before soft-delete.
- PolicyServiceImpl.java:93 — `policyRepository.delete(id)` from same delete flow — invokes the soft-delete inherited from ReactiveAbstractSoftDeleteCRUDRepository (UPDATE policy SET deleted_at = NOW() ...).
- PolicyServiceImpl.java:106 — `policyRepository::getRolesPolicies` from `getCurrentUserPolicies()` — invoked from `ManagementPermissionExtractor.getNonContextualPermissions` (ManagementPermissionExtractor.java:33) AND from `AbstractContextualPermissionExtractor.getContextualResourcePermissions` (AbstractContextualPermissionExtractor.java:27) — this is the HOT PATH for permission resolution on every authorized request. Any caller that traverses the `ReactiveNonContextPermissionAuthorizationManager` or `ReactiveResourcePermissionAuthorizationManager` chain (i.e. every entry in `SecurityConstants.SECURITY_RULES`) routes through this method.

No other source file invokes `policyRepository.*` or `ReactivePolicyRepository.*` (verified by exhaustive Grep). The repository is a single-consumer bean.

## downstream_side_effects

Every external system the repository touches when invoked:

- **PostgreSQL `policy` table (READ)**: `get`, `list`, `update` and `delete` issue `SELECT * FROM policy ...` or `UPDATE policy SET ... RETURNING ...` translated by jOOQ into parameterised R2DBC statements (ReactiveAbstractCRUDRepository.java:69-110, 144-156 and ReactiveAbstractSoftDeleteCRUDRepository.java:50-74). Read-set: every column on `policy`. Write-set: `policy.policy`, `policy.name`, `policy.updated_at` (on update); `policy.deleted_at` (on soft-delete).
- **PostgreSQL `policy` table (WRITE — INSERT)**: `create` issues `INSERT INTO policy(name, policy, created_at, updated_at, is_deleted, deleted_at) VALUES (?, ?, NOW(), NOW(), FALSE, NULL) RETURNING ALL` via `insertOne` (ReactiveAbstractCRUDRepository.java:158-160). The `created_at`, `updated_at`, `is_deleted` columns receive their DB defaults from V0_0_55__add_policies_and_roles.sql:24-26. The DB enforces the `policy_name_unique` partial index on (name) — collision raises SQLSTATE 23505 → UniqueConstraintException with message "Policy with this name already exists" (ExceptionUtils.java:60-62).
- **PostgreSQL `policy` and `role_to_policy` tables (READ JOIN)**: `getRolesPolicies` issues `SELECT policy.* FROM policy JOIN role_to_policy ON role_to_policy.policy_id = policy.id WHERE role_to_policy.role_id IN (?, ?, ...)` (ReactivePolicyRepositoryImpl.java:32-35). NO `deleted_at IS NULL` filter on policy — see invariants[2] and known_security_gaps below. This query is invoked on EVERY authorized HTTP request (transitively from both permission extractors).
- **R2DBC connection pool (the platform's `DatabaseClient`)**: every method acquires a connection via `JooqReactiveOperations.mono` / `.flux` which calls `databaseClient.inConnection(...)` / `.inConnectionMany(...)` (JooqReactiveOperations.java:31-48). Connection lifecycle is managed by the R2DBC pool; this code does not open or close connections directly.
- **Logging (via jOOQ → Slf4j)**: jOOQ's SQL logging is governed by application logging properties (typical level `INFO` or `WARN` for `org.jooq` — not overridden in this code). Parameterised statements (with `?` placeholders) are emitted at DEBUG level; jOOQ does NOT log full bind values at INFO. The repository itself emits no `log.info / .warn / .error` calls — the inherited base classes emit only a single `log.error("Database exception", e)` in ExceptionUtils.translateDatabaseException (ExceptionUtils.java:34) when the SQL state is NOT a uniqueness violation. Policy creates / updates / deletes — including security-critical mutations to the `Administrator` policy — produce NO application-level log line.
- **NO outbound HTTP**, **NO file I/O**, **NO message-queue publication**, **NO metric emission**. The repository is purely DB-bound.

The downstream side-effect picture confirms batch-E's "no-audit-log-on-RBAC-mutations" 3-sidecar pattern at the repository layer: the persistence-layer code emits ZERO security-relevant log lines on any of {create, update, delete} a policy. The pattern is consistent with RoleController.createRole (sibling sidecar) and PolicyController.createPolicy (parent sidecar) — RBAC mutations across the stack are forensically silent.

## implicit_adrs

- "The `policy` table uses SOFT-DELETE (UPDATE setting `deleted_at = NOW()`, never DELETE FROM) — inherited via `ReactiveAbstractSoftDeleteCRUDRepository.delete` (ReactiveAbstractSoftDeleteCRUDRepository.java:50-59,61-74). The decision is encoded structurally — this repository extends the soft-delete base class rather than the non-soft-delete `ReactiveAbstractCRUDRepository` — and is consistent with how `role`, `owner`, `data_source`, `collector`, `namespace`, `tag`, `term`, `data_entity` etc. are persisted (every CRUDable platform entity that operators might want to recover uses the soft-delete pattern; only join tables and immutable audit-like tables use hard delete)." — evidence: ReactivePolicyRepositoryImpl.java:19 (extends ReactiveAbstractSoftDeleteCRUDRepository) + ReactiveAbstractSoftDeleteCRUDRepository.java:25-26 (DEFAULT_DELETED_AT_FIELD + the protected deletedAtField) + V0_0_55__add_policies_and_roles.sql:27 (`deleted_at TIMESTAMP WITHOUT TIME ZONE`) — intent_anchor: the soft-delete base class is named `ReactiveAbstractSoftDeleteCRUDRepository` (explicit), pairs with the migration's `deleted_at` column, and is the consistent pattern across every operator-facing entity in the platform — confidence: HIGH

- "Policy-name uniqueness is enforced VIA A PARTIAL UNIQUE INDEX FILTERED BY `WHERE deleted_at IS NULL`, allowing the same name to be re-used after soft-delete. The combination is intentional: the soft-delete pattern would otherwise either (a) trap unique names forever after deletion, or (b) require a separate 'undeleted' table. The partial-index design splits the difference — names are unique among live rows, soft-deleted rows are 'parked' but their names are freed." — evidence: V0_0_55__add_policies_and_roles.sql:30 (`CREATE UNIQUE INDEX IF NOT EXISTS policy_name_unique ON policy (name) WHERE deleted_at IS NULL;`) + the parallel pattern at V0_0_55__add_policies_and_roles.sql:42 (`role_name_unique`) — intent_anchor: the explicit `WHERE deleted_at IS NULL` predicate on the `CREATE UNIQUE INDEX` statement is the SQL-syntactic affirmation of the design — and it matches the `addSoftDeleteFilter` at the application layer — confidence: HIGH

- "Unique-constraint violations from the DB are translated to a project-specific `UniqueConstraintException` carrying a HUMAN-READABLE message keyed by index name — NOT propagated as the raw jOOQ DataAccessException — through a centralised translation layer (`ExceptionUtils.translateDatabaseException`) wired into every R2DBC query via `JooqReactiveOperations`'s `.onErrorMap(DataAccessException.class, ...)`. The decision is uniform: every Reactive*Repository inherits this translation; no repository can leak raw Postgres errors to the API layer." — evidence: JooqReactiveOperations.java:41 (`.onErrorMap(DataAccessException.class, ExceptionUtils::translateDatabaseException)`) + JooqReactiveOperations.java:48 (same on `.flux`) + ExceptionUtils.java:30-36 (`translateDatabaseException` returns UniqueConstraintException OR generic DatabaseException) + ExceptionUtils.java:60-62 (POLICY_NAME_UNIQUE → "Policy with this name already exists") — intent_anchor: the `ExceptionUtils` class is `@UtilityClass` and explicitly named `translateDatabaseException`; every known unique index name is enumerated and mapped to a tailored message, demonstrating the deliberate-and-curated nature of the translation — confidence: HIGH

- "Repository CRUD is policy-AGNOSTIC at the persistence layer — there is NO Administrator-name protection, NO JSON-schema validation, NO role-binding cascade check inside the repository. All those invariants live in the SERVICE layer (PolicyServiceImpl). The repository is intentionally a thin, dumb persistence shell; business invariants are owned by the service. This is the consistent pattern across every Reactive*Repository in the codebase." — evidence: ReactivePolicyRepositoryImpl.java:1-40 (no name checks, no validation, no cascade logic — the entire file is one custom JOIN method) + PolicyServiceImpl.java:64 (JSON validation), 76,87 (Administrator name protection), 89-92 (cascade delete check) — intent_anchor: the package layout itself — `repository.reactive.*` for persistence, `service.*` for business invariants — is the architectural commitment; the absence of policy-name validation from any Reactive*Repository file confirms the rule — confidence: HIGH

- "The `is_deleted` boolean column in the DDL (V0_0_55__add_policies_and_roles.sql:26) is functionally REDUNDANT with `deleted_at`: the soft-delete base writes ONLY `deleted_at` (ReactiveAbstractSoftDeleteCRUDRepository.java:106-110 — `getDeleteChangedFields` only adds `deletedAtField`) and reads use only `deletedAtField.isNull()` (line 102). `is_deleted` is therefore dead schema — no application code writes or reads it. Whether this is an intentional defensive 'belt-and-braces' design or a stale schema column is ambiguous; the absence of any application-level read/write of `is_deleted` argues 'stale'." — evidence: V0_0_55__add_policies_and_roles.sql:26 (`is_deleted boolean NOT NULL DEFAULT FALSE`) + ReactiveAbstractSoftDeleteCRUDRepository.java:106-110 (only deletedAtField touched) + Grep for `IS_DELETED|is_deleted` returns no application-code reads — intent_anchor: the column is present in the DDL but no `policyRecord.set(IS_DELETED, ...)` or `WHERE IS_DELETED = FALSE` clause exists in any repository — confidence: MEDIUM (the absence of comment makes the intent unclear)

## bugs_limitations_corner_cases

- "getRolesPolicies does NOT filter soft-deleted policies — the SQL JOIN at ReactivePolicyRepositoryImpl.java:32-35 selects every `policy` row where `policy.id = role_to_policy.policy_id AND role_to_policy.role_id IN (...)` with NO `policy.deleted_at IS NULL` predicate. Combined with the absence of a cascade between `policy.deleted_at` and `role_to_policy`, a soft-deleted policy with surviving role bindings continues to confer permissions on users in those roles. Today the PolicyServiceImpl.delete path defends by raising CascadeDeleteException if the policy is still bound (PolicyServiceImpl.java:89-92), but: (a) any DB-direct UPDATE setting `deleted_at` (operator hot-fix, schema migration mistake, broken admin script) bypasses the defence; (b) a future refactor weakening the cascade check would silently re-open the gap. The correct repository-layer defence is `AND policy.deleted_at IS NULL` in the JOIN's WHERE clause." — evidence: ReactivePolicyRepositoryImpl.java:32-35 (JOIN without deleted_at filter) + V0_0_55__add_policies_and_roles.sql:44-53 (role_to_policy FK with NO cascade) + PolicyServiceImpl.java:89-92 (the service-layer defence) — severity: HIGH

- "No service-layer transaction boundary across the read-then-write `update` path. PolicyServiceImpl.update (PolicyServiceImpl.java:71-81) issues `policyRepository.get(id)` then `policyRepository.update(...)` — two separate R2DBC calls outside any @ReactiveTransactional. A concurrent UPDATE of the same policy by a different caller can interleave: client A reads policy v1, client B reads v1, A writes v2 (success), B writes v3 BASED ON v1 (success, but A's v2 was clobbered). The `update_at` column moves monotonically so no exception is raised. Lost-update race. The single-row INSERT/UPDATE on `policyRepository.create/update/delete` does NOT have @ReactiveTransactional (ReactiveAbstractCRUDRepository.java:103-110, 158-173 — neither method carries the annotation; only the BULK variants at 113, 129 do)." — evidence: ReactiveAbstractCRUDRepository.java:103-110 (no @ReactiveTransactional on create/update) + PolicyServiceImpl.java:71-81 (read-then-write under no transaction) + ReactiveTransactional.java:9-13 (the annotation, applied selectively) — severity: MEDIUM

- "Duplicate-name INSERT surfaces as `UniqueConstraintException` (not `BadUserRequestException`) — the project's ExceptionsHandler may or may not map UniqueConstraintException to a 409 Conflict / 400 Bad Request. The PolicyServiceImpl.create path has NO pre-check for an existing live policy with the same name, so the only error surface is the DB-layer translation. The error message 'Policy with this name already exists' is at least clean, but the HTTP status mapping is not verified by tests." — evidence: PolicyServiceImpl.java:62-69 (no pre-check) + ReactivePolicyRepositoryImpl.java:1-40 (inherits create from base) + ReactiveAbstractCRUDRepository.java:158-160 (insertOne — DB enforces uniqueness) + ExceptionUtils.java:60-62 (translation to UniqueConstraintException) — severity: LOW

- "`is_deleted` column dead schema: the DDL declares `is_deleted boolean NOT NULL DEFAULT FALSE` (V0_0_55__add_policies_and_roles.sql:26) but the soft-delete base only writes `deleted_at`. A schema reader expecting `is_deleted` to track delete state will reach a wrong conclusion — the column will always be `FALSE` even for soft-deleted rows. Either remove the column (schema cleanup) or trigger-mirror it to `deleted_at IS NOT NULL` (defensive)." — evidence: V0_0_55__add_policies_and_roles.sql:26 + ReactiveAbstractSoftDeleteCRUDRepository.java:106-110 — severity: LOW

- "PolicyRecord pojoToRecord uses `mappingDSLContext.newRecord(table, source)` (JooqReactiveOperations.java:86-89). The conversion relies on Lombok-generated getters on PolicyPojo (jOOQ-generated POJO with constants matching column names). Any divergence between the POJO field name and the DB column name — e.g. a Flyway-renamed column without corresponding jOOQ-regeneration — silently loses the field on every INSERT/UPDATE. There is no schema-version check at boot." — evidence: JooqReactiveOperations.java:86-89 + ReactiveAbstractCRUDRepository.java:286-288 (pojoToRecord) — severity: LOW

- "No batch-size or rate-limit on getRolesPolicies — a caller passing a roleIds list of 10,000 elements (artificial but possible if the role model ever grows) issues `WHERE role_to_policy.role_id IN (10K params)` which Postgres handles up to its parameter limit (default 32,767) but the result-set materialisation into Mono<List<PolicyPojo>> via `.collectList()` (ReactivePolicyRepositoryImpl.java:38) loads everything into memory. Today's role cardinality is small (single-digit per user typically) so this is theoretical, but no defensive bound is enforced." — evidence: ReactivePolicyRepositoryImpl.java:32-38 (no LIMIT, no batch partition) + JooqReactiveOperations.java:51-84 (executeInPartition exists but is NOT used here) — severity: LOW

## security

- **auth_mode_relevance**: `INTERNAL_ONLY` — repository is a persistence bean, not on the HTTP surface. Auth mode does not apply directly. However, the repository is invoked on every authorized request through the permission-extractor chain (see upstream_callers): the auth-mode-dependent SECURITY_RULES gate ALWAYS resolves policies through `policyRepository.getRolesPolicies(...)`. Under `auth.type=DISABLED` the SECURITY_RULES gate is bypassed (DisabledAuthSecurityConfiguration — see batch-E PolicyController.createPolicy enrichment), but the repository's methods are still callable via any service-bypass path AND the `getCurrentUserPolicies()` consumer chain still runs if invoked (it just resolves to whatever roles the request's principal carries, which under DISABLED is typically the synthesised anonymous-admin principal).
- **ingestion_filter_relevance**: `NO — repository persistence, not ingestion`. The `IngestionDataEntitiesFilter` (referenced in the batch-E sidecar) is a path-matcher on `/ingestion/entities`; this repository is on the RBAC mutation/read path, never on the ingestion path.
- **authorization_assertions**:
  - "No `@PreAuthorize`, no `@Secured`, no programmatic permission check on any method in this file or its base classes (ReactivePolicyRepositoryImpl.java:1-40 + ReactiveAbstractSoftDeleteCRUDRepository.java:1-118 + ReactiveAbstractCRUDRepository.java:1-300). Authorization is enforced UPSTREAM at the controller boundary via SECURITY_RULES (see batch-E PolicyController.createPolicy sidecar). The repository trusts its caller." — evidence: complete absence of authorization-annotation imports in any of the three source files
- **owner_scoping**: `N/A — Policy is a platform-global resource`. The `policy` table has no `owner_id` column (verified at V0_0_55__add_policies_and_roles.sql:19-28); policies are not owner-scoped. The repository's `getRolesPolicies` resolves the CURRENT USER's policies through their roles (via the upstream consumer in PolicyServiceImpl.getCurrentUserPolicies which calls `roleService.getCurrentUserRoles`), but the repository itself does not perform owner filtering.
- **data_exposure**:
  - "getRolesPolicies → returns the FULL PolicyPojo (id, name, policy text including all statements, created_at, updated_at, is_deleted, deleted_at) for every role the caller belongs to. The result is consumed by the permission extractors which compute permissions; the policy NAMES and full JSON statements leak to in-memory caller code on every authorized request. Not directly returned over HTTP from this repo, but the data flows transitively."
  - "list / get → exposes the FULL PolicyPojo to PolicyServiceImpl, which maps to PolicyDetails (id, name, role assignments, parsed statements, timestamps) and returns over HTTP. Audience is the operator with POLICY_CREATE / POLICY_UPDATE / POLICY_DELETE / POLICY_READ permission (under non-DISABLED auth modes)."
- **known_security_gaps**:
  - "getRolesPolicies returns SOFT-DELETED policies that still have surviving role bindings. A soft-deleted policy retains its statements; transitively, a soft-deleted MANAGEMENT/ALL policy bound to a user's role continues to grant ALL Management permissions to that user. The single line `AND policy.deleted_at IS NULL` is missing from ReactivePolicyRepositoryImpl.java:32-35. Today the cascade-delete defence at PolicyServiceImpl.java:89-92 prevents this in normal flows by refusing to soft-delete a bound policy, BUT (a) any direct DB UPDATE setting deleted_at on a bound policy creates the orphan-binding security gap; (b) any future refactor weakening the service-layer check re-opens the gap. The repository should defensively filter at the SQL layer." — evidence: ReactivePolicyRepositoryImpl.java:32-35 + V0_0_55__add_policies_and_roles.sql:44-53 (no cascade FK) + PolicyServiceImpl.java:89-92 (service defence) — severity: HIGH
  - "RBAC mutations are forensically silent at the repository layer. No `log.info` / `log.warn` / audit-table-write on create / update / delete. ExceptionUtils.translateDatabaseException emits one `log.error` ONLY on non-uniqueness DB errors (ExceptionUtils.java:34). A security incident reviewer reconstructing 'who created/modified/deleted the MANAGEMENT/ALL policy on date X' has zero in-application records. Pattern is consistent with the controller and service layers (3-sidecar pattern from batch E)." — evidence: ReactivePolicyRepositoryImpl.java:1-40 (no log imports beyond inherited) + ReactiveAbstractSoftDeleteCRUDRepository.java:1-118 (no @Slf4j-emitted lines on mutations) + ReactiveAbstractCRUDRepository.java:35-36 (`@Slf4j` on class but no application-level log call on success paths) — severity: HIGH
  - "Soft-delete recreation invariant + Administrator-name asymmetry compound risk. Batch E established: PolicyServiceImpl.update / .delete reject `Administrator` by name, but `create` does NOT. The repository layer enforces uniqueness via `policy_name_unique WHERE deleted_at IS NULL`, so a duplicate-Administrator INSERT against the live seeded row will fail with UniqueConstraintException. HOWEVER, if the seeded Administrator row is ever soft-deleted by any path (today no service-layer path soft-deletes Administrator because of the rejection at PolicyServiceImpl.java:87-88, but a direct DB UPDATE setting `policy.deleted_at` on the Administrator row could do it), the partial unique index would free the name, AND PolicyServiceImpl.create has no name-protection check — a new policy named `Administrator` with attacker-chosen statements could be created. The repository's partial-unique-index design is correct; the gap is in the service layer's create-path missing-symmetry, but the repository's soft-delete-aware uniqueness rule MAKES the gap exploitable." — evidence: V0_0_55__add_policies_and_roles.sql:30 (partial unique index) + PolicyServiceImpl.java:62-69 (create — no name check) vs 76, 87 (update/delete — name check) + ReactivePolicyRepositoryImpl.java:19 (soft-delete base) — severity: MEDIUM (gap-of-gaps; controller layer is the proper fix site)
  - "No tenant / instance isolation. The platform is single-tenant by design; the `policy` table has no tenant_id column. If a future multi-tenant refactor were attempted, the repository's CRUD plus the unbounded `getRolesPolicies(roleIds)` JOIN would leak policies cross-tenant. Not a current vulnerability — flagged because the inherited base class CRUD assumes global-row semantics." — evidence: V0_0_55__add_policies_and_roles.sql:19-28 (no tenant column) + ReactiveAbstractCRUDRepository.java:69-110 (global selects) — severity: LOW

## performance

- **hot_paths**:
  - "getRolesPolicies is on the AUTHORIZATION HOT PATH. ManagementPermissionExtractor.getNonContextualPermissions (ManagementPermissionExtractor.java:31-41) and AbstractContextualPermissionExtractor.getContextualResourcePermissions (AbstractContextualPermissionExtractor.java:24-35) both call `policyService.getCurrentUserPolicies()` → `policyRepository.getRolesPolicies(roleIds)` on EVERY authorized HTTP request that traverses the permission framework. The query is a single JOIN (policy ⋈ role_to_policy) with `WHERE role_id IN (...)` — sub-millisecond on typical row counts (single-digit policies per user). The result list is collected to memory (`.collectList()`) and consumed in-memory by the extractor. NO caching layer is present at the repository, service, or extractor level — every request hits Postgres." — evidence: ReactivePolicyRepositoryImpl.java:32-38 + ManagementPermissionExtractor.java:33 + AbstractContextualPermissionExtractor.java:27 + PolicyServiceImpl.java:102-107
  - "create / update / delete are admin-rare paths. Per-call cost dominated by single R2DBC round-trip + jOOQ's parameter binding." — evidence: PolicyServiceImpl.java:62-95 + ReactiveAbstractCRUDRepository.java:103-110, 158-173
- **throughput_characteristics**:
  - "Single-policy create / update / delete — no bulk endpoint exposed via the service for policies (PolicyServiceImpl exposes only single-item operations). The base class supports bulkCreate / bulkUpdate (ReactiveAbstractCRUDRepository.java:113-142) and those ARE @ReactiveTransactional, but PolicyService does not invoke them."
  - "getRolesPolicies: single batched JOIN per call, no streaming — `.collectList()` materialises the result. Acceptable for typical role-cardinality."
- **resource_allocation**:
  - "Per call: one R2DBC connection acquired via DatabaseClient.inConnection (JooqReactiveOperations.java:31-48) — non-blocking on the reactive thread, returned to pool on terminal signal."
  - "Per call (getRolesPolicies): the result List<PolicyPojo> is held in memory through the lifetime of the extractor's flatMapIterable consumption (ManagementPermissionExtractor.java:34-40). For typical user policies (~1-10 PolicyPojos, ~500 bytes each), trivial. A pathological user attached to thousands of policies would see proportional heap allocation per request."
- **scaling_characteristics**:
  - "Stateless. No locks, no advisory locks, no session state. Concurrent INSERTs of the same policy name serialise at the DB via the partial unique index. Concurrent UPDATEs of the same policy id can lost-update (no @ReactiveTransactional, no optimistic-concurrency token — verified at ReactiveAbstractCRUDRepository.java:103-110 by absence of `version` field handling)."
  - "Horizontal scaling: instances behind a load balancer share the Postgres backend; concurrency is bounded by the R2DBC connection pool size (`spring.r2dbc.pool.max-size`)."
- **known_performance_gaps**:
  - "No caching of getRolesPolicies. The result for a stable (roleIds) set is stable for the lifetime of the role-policy edges (changes only on POST /api/roles, PUT /api/roles/{id}, DELETE /api/roles/{id}, POST /api/policies, PUT /api/policies/{id}, DELETE /api/policies/{id}). On a busy platform with N authorized req/s, this is N+M DB calls (N for permission resolution, M ≪ N for actual mutations). A short-TTL request-scoped or user-scoped cache would significantly reduce DB load. Today's behaviour is correct (always fresh) but not optimised." — evidence: ReactivePolicyRepositoryImpl.java:32-38 (no @Cacheable) + ManagementPermissionExtractor.java + AbstractContextualPermissionExtractor.java (per-request invocation) — severity: LOW
  - "getRolesPolicies returns the FULL POLICY_TEXT column on every call. The `policy` column is `text` (V0_0_55__add_policies_and_roles.sql:23) — typical policies are ~1KB, but a pathological policy could be megabytes. The query has no projection to omit `policy` text when only the id/name are needed — but every consumer DOES need the policy text to compute permissions, so this is not a real gap, just an observation that the data shape forces a full-row read." — evidence: ReactivePolicyRepositoryImpl.java:32 (`select(POLICY.fields())`) — severity: LOW

## sources

- understanding ← ReactivePolicyRepositoryImpl.java:1-40 + ReactiveAbstractSoftDeleteCRUDRepository.java:50-118 + V0_0_55__add_policies_and_roles.sql:19-30 + odd-platform__java__PolicyController__controller-method__createPolicy.md (batch-E sibling)
- concepts.entities ← ReactivePolicyRepositoryImpl.java:8-9, 15-16 + V0_0_55__add_policies_and_roles.sql:19-30, 44-53
- concepts.operations ← ReactivePolicyRepositoryImpl.java:27-39 + ReactiveAbstractSoftDeleteCRUDRepository.java:50-74 + ReactiveAbstractCRUDRepository.java:69-156, 158-173
- concepts.invariants[0] ← ReactiveAbstractSoftDeleteCRUDRepository.java:76-104
- concepts.invariants[1] ← ReactivePolicyRepositoryImpl.java:32-38 (no deleted_at filter)
- concepts.invariants[2] ← V0_0_55__add_policies_and_roles.sql:30 + JooqReactiveOperations.java:41 + ExceptionUtils.java:60-62
- concepts.invariants[3] ← V0_0_55__add_policies_and_roles.sql:26-30 + ReactiveAbstractSoftDeleteCRUDRepository.java:106-110 + Grep for `is_deleted` returning zero application-code reads
- concepts.invariants[4] ← ReactiveAbstractCRUDRepository.java:103-110, 158-173 + ReactiveAbstractCRUDRepository.java:113, 129 (@ReactiveTransactional only on bulk)
- dependencies_semantic.requires-feature ← ReactivePolicyRepositoryImpl.java:18-25 + ReactiveAbstractSoftDeleteCRUDRepository.java:22-48 + JooqReactiveOperations.java:21-49
- dependencies_semantic.requires-config ← ReactivePolicyRepositoryImpl.java:22-25 + V0_0_55, V0_0_56 migrations
- dependencies_semantic.requires-runtime ← ReactivePolicyRepositoryImpl.java:13-16 + JooqReactiveOperations.java:16-19 + ExceptionUtils.java:60-62
- dependencies_semantic.coupling[0] ← ReactiveAbstractSoftDeleteCRUDRepository.java:25-26, 96-104
- dependencies_semantic.coupling[1] ← ReactivePolicyRepositoryImpl.java:32-35 + V0_0_55__add_policies_and_roles.sql:44-53
- dependencies_semantic.coupling[2] ← PolicyServiceImpl.java:18, 31 + Grep for `ReactivePolicyRepository` returning only the impl, interface, and service
- tests_coverage_semantic.uncovered_behaviours ← Grep for `policyRepository|ReactivePolicyRepository|ReactivePolicyRepositoryImpl <odd-platform-repo>/odd-platform-api/src/test` returns zero matches; only PolicyDeserializerTest.java exists in `src/test`
- tests_coverage_semantic.gaps ← same Grep + ReactivePolicyRepositoryImpl.java:32-35 + PolicyServiceImpl.java:89-92
- docs_link_semantic.inferred_docs[0] ← batch-E sidecar inheritance — see `odd-platform__java__PolicyController__controller-method__createPolicy.md` docs_link_semantic.inferred_docs[0]
- docs_link_semantic.inferred_docs[1] ← same — batch-E sidecar inheritance docs_link_semantic.inferred_docs[1]
- docs_link_semantic.doc_drift_findings ← ReactivePolicyRepositoryImpl.java:32-35 + ReactiveAbstractSoftDeleteCRUDRepository.java:50-59 + V0_0_55__add_policies_and_roles.sql:30, 44-53 + PolicyServiceImpl.java:89-92 + batch-E sibling sidecar (live page silence on persistence details)
- upstream_callers ← Grep `policyRepository\.|ReactivePolicyRepository` across `<odd-platform-repo>/odd-platform-api/src/main` (verified 2026-05-19) + ManagementPermissionExtractor.java:33 + AbstractContextualPermissionExtractor.java:27 + PolicyServiceImpl.java:47, 58, 67, 74, 79, 85, 93, 106
- downstream_side_effects ← ReactivePolicyRepositoryImpl.java:32-38 + ReactiveAbstractCRUDRepository.java:69-160 + ReactiveAbstractSoftDeleteCRUDRepository.java:50-110 + JooqReactiveOperations.java:21-96 + ExceptionUtils.java:30-83 + V0_0_55__add_policies_and_roles.sql:19-30
- implicit_adrs[0] ← ReactivePolicyRepositoryImpl.java:19 + ReactiveAbstractSoftDeleteCRUDRepository.java:25-26 + V0_0_55__add_policies_and_roles.sql:27
- implicit_adrs[1] ← V0_0_55__add_policies_and_roles.sql:30 + 42
- implicit_adrs[2] ← JooqReactiveOperations.java:41, 48 + ExceptionUtils.java:30-83
- implicit_adrs[3] ← ReactivePolicyRepositoryImpl.java:1-40 + PolicyServiceImpl.java:62-95
- implicit_adrs[4] ← V0_0_55__add_policies_and_roles.sql:26 + ReactiveAbstractSoftDeleteCRUDRepository.java:106-110
- bugs_limitations_corner_cases[0] ← ReactivePolicyRepositoryImpl.java:32-35 + V0_0_55__add_policies_and_roles.sql:44-53 + PolicyServiceImpl.java:89-92
- bugs_limitations_corner_cases[1] ← ReactiveAbstractCRUDRepository.java:103-110, 158-173 + PolicyServiceImpl.java:71-81 + ReactiveTransactional.java:9-13
- bugs_limitations_corner_cases[2] ← PolicyServiceImpl.java:62-69 + ReactiveAbstractCRUDRepository.java:158-160 + ExceptionUtils.java:60-62
- bugs_limitations_corner_cases[3] ← V0_0_55__add_policies_and_roles.sql:26 + ReactiveAbstractSoftDeleteCRUDRepository.java:106-110
- bugs_limitations_corner_cases[4] ← JooqReactiveOperations.java:86-89 + ReactiveAbstractCRUDRepository.java:286-288
- bugs_limitations_corner_cases[5] ← ReactivePolicyRepositoryImpl.java:32-38 + JooqReactiveOperations.java:51-84
- security.auth_mode_relevance ← ReactivePolicyRepositoryImpl.java:1-40 (no HTTP surface) + ManagementPermissionExtractor.java:31-41 + batch-E PolicyController.createPolicy sidecar
- security.ingestion_filter_relevance ← ReactivePolicyRepositoryImpl.java:1-40 + batch-E PolicyController.createPolicy sidecar
- security.authorization_assertions ← ReactivePolicyRepositoryImpl.java:1-40 + ReactiveAbstractSoftDeleteCRUDRepository.java:1-118 + ReactiveAbstractCRUDRepository.java:1-300
- security.owner_scoping ← V0_0_55__add_policies_and_roles.sql:19-28
- security.data_exposure ← ReactivePolicyRepositoryImpl.java:32-38 + PolicyServiceImpl.java:46-69
- security.known_security_gaps[0] ← ReactivePolicyRepositoryImpl.java:32-35 + V0_0_55__add_policies_and_roles.sql:44-53 + PolicyServiceImpl.java:89-92
- security.known_security_gaps[1] ← ReactivePolicyRepositoryImpl.java:1-40 + ReactiveAbstractCRUDRepository.java:35-36 + ExceptionUtils.java:34
- security.known_security_gaps[2] ← V0_0_55__add_policies_and_roles.sql:30 + PolicyServiceImpl.java:62-69, 76, 87 + ReactivePolicyRepositoryImpl.java:19
- security.known_security_gaps[3] ← V0_0_55__add_policies_and_roles.sql:19-28 + ReactiveAbstractCRUDRepository.java:69-110
- performance.hot_paths ← ReactivePolicyRepositoryImpl.java:32-38 + ManagementPermissionExtractor.java:33 + AbstractContextualPermissionExtractor.java:27 + PolicyServiceImpl.java:102-107
- performance.throughput_characteristics ← PolicyServiceImpl.java:62-95 + ReactiveAbstractCRUDRepository.java:113-142
- performance.resource_allocation ← JooqReactiveOperations.java:31-48 + ManagementPermissionExtractor.java:34-40
- performance.scaling_characteristics ← ReactiveAbstractCRUDRepository.java:103-110 (no version field) + V0_0_55__add_policies_and_roles.sql:30 (partial unique index)
- performance.known_performance_gaps[0] ← ReactivePolicyRepositoryImpl.java:32-38 + ManagementPermissionExtractor.java + AbstractContextualPermissionExtractor.java
- performance.known_performance_gaps[1] ← ReactivePolicyRepositoryImpl.java:32 + V0_0_55__add_policies_and_roles.sql:23

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: LOW (WebFetch unavailable in this session; inherits batch-E verified state from 2026-05-12)
- upstream_callers: HIGH
- downstream_side_effects: HIGH
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: HIGH

## Maintainer notes

