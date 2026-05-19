## ADR-CANDIDATE-127 — Dual-contract write paths — `bulkCreate` (inherited, fail-on-duplicate) is the OPERATOR-EXPLICIT path; `ingestData` (declared here, conflict-tolerant upsert) is the INGESTION-RACE-SAFE path; both exist deliberately to express different conflict semantics through different repository methods

**Severity**: MEDIUM
**Classification**: promote
**Pillars affected**: [P-01-data-discovery, P-08-management, P-10-integrations]
**Support count**: 1 sidecar (batch N ReactiveTagRepositoryImpl) — the pattern is currently Tag-specific but the dual-contract design is the architectural commitment for any future ingestion-vs-operator-CRUD write surface
**Axes present**: repositories, controllers
**Batch**: N (2026-05-19)

**Surfaced by**:
- `ReactiveTagRepositoryImpl.md:implicit_adrs.[5]` (HIGH) — "`bulkCreate` is the ONE create path that does NOT use `onConflict` — the inherited `ReactiveAbstractCRUDRepository.bulkCreate` (`:114-126`) has no `onConflict` clause; it relies on `ExceptionUtils.translateDatabaseException` to surface the `UniqueConstraintException` to the caller. This is the DIFFERENT contract from `ingestData` — `bulkCreate` is a fail-on-duplicate operation, `ingestData` is an upsert. Both exist intentionally because `TagController.createTag` (operator-explicit creation gated by `TAG_CREATE`) MUST fail on duplicate to surface the error to the user, while ingestion-side calls (the Collector pushing entity data with associated tags) MUST not fail because a tag with the same name was added moments earlier by a parallel pipeline." — intent_anchor: "Two distinct repository methods (`bulkCreate` inherited, `ingestData` declared) with different conflict semantics — the dual-method design is the architectural choice"

**Decision statement**: ODD's persistence layer codifies a **dual-contract write surface** for entities that can be created from BOTH operator-explicit paths AND ingestion-race-prone paths. The two contracts are exposed as TWO distinct repository methods with different conflict semantics:

1. **`bulkCreate(Collection<TagPojo>)` — inherited from `ReactiveAbstractCRUDRepository`** — issues plain `INSERT INTO tag(name, ...) VALUES (?, ...), (?, ...), ...` with no `onConflict` clause. A duplicate-name violation triggers Postgres SQLSTATE-23505, which is translated by `ExceptionUtils.translateDatabaseException` (per ADR-CANDIDATE-071) into `UniqueConstraintException("Tag with this name already exists")`. The operator-facing controller (`TagController.createTag` gated by `TAG_CREATE`) surfaces this as HTTP 409 / 400 to the user, allowing them to recover (pick a different name, refresh the list, etc.).
2. **`ingestData(List<TagPojo>)` — declared in this repository** — issues `INSERT INTO tag(name, ...) VALUES (...) ON CONFLICT (name) WHERE deleted_at IS NULL DO UPDATE SET name = EXCLUDED.name RETURNING *` (per ADR-CANDIDATE-125). The duplicate-name case is silently merged to the existing row; the caller gets the existing row's id; the upsert is idempotent under concurrent novel-name pressure. The ingestion-side caller (`ExternalTagIngestionRequestProcessor`) processes Collector pushes where two parallel pipelines may submit the same tag name simultaneously; failing one of them with `UniqueConstraintException` would surface as a 500 to the Collector and an alarm to the operator.

The architectural choices encoded:
- **(a) Different semantics for different audiences** — operators creating tags via UI EXPECT to see an error when they pick a duplicate (it's a UX affordance, not a data corruption surface). Collectors pushing entity data CANNOT recover from a duplicate-name error — there's no operator in the loop to intervene; the push would either retry forever or drop the entity's tag metadata. The two contracts match the two audiences.
- **(b) Both contracts in ONE repository class** — the methods are co-located; the maintainer reading the class sees both contracts side-by-side. The naming distinguishes (`bulkCreate` vs `ingestData` — the latter explicitly names the audience).
- **(c) The cost: callers must pick the correct method** — `TagServiceImpl.getOrCreateTagsByName` (the in-between case, where neither operator nor collector but service-tier orchestration creates tags) chose `bulkCreate` (the unsafe one) and gets a TOCTOU race vs the partial unique index (REFACTOR-358 — HIGH). The maintainer-extension contract: future callers must pick `ingestData` for any racy create-on-missing path; `bulkCreate` for fail-fast operator-explicit paths only.

**Wisdom test**: PASS on all three questions.
1. **Intentional?** YES — two distinct methods, two distinct call sites, two distinct contracts. The maintainer co-authored both intentionally (the inherited `bulkCreate` was not arbitrary; the declared `ingestData` is deliberately scoped to the ingestion path).
2. **Structural impact?** YES — affects the operator-vs-collector audience-split at the persistence layer; affects every future create-path's choice (the maintainer-extension contract); affects the controller-vs-IngestionRequestProcessor binding (different repositories methods for different upstream paths).
3. **Merging to a single contract is REFACTORING or STRUCTURAL?** STRUCTURAL — merging to `bulkCreate` everywhere would break ingestion-side race safety (one Collector push out of N would 500 randomly); merging to `ingestData` everywhere would break operator UX (operators silently get the existing tag instead of an error). The dual-contract IS the architecture; both must coexist.

**Evidence**:
- ReactiveTagRepositoryImpl.md says: "Two distinct repository methods (`bulkCreate` inherited, `ingestData` declared) with different conflict semantics — the dual-method design is the architectural choice. ... `TagController.createTag` (operator-explicit creation gated by `TAG_CREATE`) MUST fail on duplicate to surface the error to the user, while ingestion-side calls (the Collector pushing entity data with associated tags) MUST not fail because a tag with the same name was added moments earlier by a parallel pipeline."
- ReactiveAbstractCRUDRepository.java:113-126 — the inherited `bulkCreate` with no onConflict
- ReactiveTagRepositoryImpl.java:191-213 — the declared `ingestData` with onConflict
- TagController.java:23-28 — the operator-explicit caller of `bulkCreate` (via the service)
- ExternalTagIngestionRequestProcessor.java:71-72 — the ingestion-side caller of `ingestData`

**Existing ADR**: none. **Composes with ADR-CANDIDATE-125 NEW** (the onConflict DO UPDATE no-op idiom — the SQL mechanism that powers `ingestData`). **Composes with ADR-CANDIDATE-070** (partial unique index — the schema-layer enforcement under both contracts). **Composes with ADR-CANDIDATE-071** (centralised DB-error translation — the translation layer that turns the `bulkCreate` SQLSTATE-23505 into `UniqueConstraintException`). **Composes with ADR-CANDIDATE-065** (Tag auto-create-on-miss is INTENTIONAL — this ADR explains the WRITE-PATH mechanism that powers -065's spec acknowledgement).

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-358 NEW — `TagServiceImpl.getOrCreateTagsByName` uses the unsafe `listByNames + bulkCreate` instead of the safe `ingestData`; HIGH — TOCTOU race produces UniqueConstraintException → 500 on the user.

**Proposed action**: Promote to `adrs/drafts/dual-contract-write-paths.md` (new ADR). Document:
- The architecture (two distinct methods for two distinct audiences).
- The naming convention (`bulkCreate` for fail-on-duplicate operator paths; `ingestData` for upsert ingestion paths).
- The maintainer-extension contract: future callers MUST pick the contract that matches the upstream audience; in-between callers MUST pick `ingestData` if any concurrency exists.
- The TOCTOU surface (REFACTOR-358 — the service-tier in-between case picked the wrong contract).
- The cross-link with ADR-CANDIDATE-125 / -070 / -071 / -065.

**Severity rationale**: MEDIUM — pattern-shaping decision for the ingestion-vs-operator write boundary. Affects the Tag write surface today; intended to extend to Owner / Title / Term auto-create-on-miss family (REFACTOR-199 + REFACTOR-206 cross-batch). Less load-bearing than ADR-CANDIDATE-068 (the soft-delete taxonomy) but the architectural framing that explains WHY two write methods coexist for the same table.

---
