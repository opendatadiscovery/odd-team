## ADR-CANDIDATE-194 — Dual-method create design — `bulkCreate` (fail-on-duplicate via `UniqueConstraintException`) vs `ingestData` (upsert via `ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING *`) — UI write paths surface duplicate-name conflicts; Collector push paths silence them idempotently

**Severity**: HIGH
**Classification**: promote
**Support count**: 2 sidecars (TagServiceImpl + ReactiveTagRepositoryImpl — full intent across service-tier choice points and repository-tier implementation)
**Axes present**: services, repositories, OpenAPI spec

**Surfaced by**:
- `ReactiveTagRepositoryImpl.md:implicit_adrs[bulkCreate vs ingestData dual-method]` (HIGH) — "The dual-method design is intentional: `TagController.createTag` (operator-explicit creation gated by `TAG_CREATE`) MUST fail on duplicate to surface the error to the user; ingestion-side calls MUST not fail because a tag with the same name was added moments earlier by a parallel pipeline." — intent_anchor: "Two distinct repository methods with different conflict semantics — the dual-method design is the architectural choice"
- `ReactiveTagRepositoryImpl.md:implicit_adrs[RETURNING-trigger no-op]` (HIGH) — "the upsert sets the conflicting row's name to itself (`DSL.excluded(TAG.NAME)` at `:209`). The semantic-equivalent of `DO NOTHING` would NOT return the existing row's id; the no-op update exists solely to trigger the RETURNING clause."
- `ReactiveTagRepositoryImpl.md:implicit_adrs[dynamic conflict-target]` (HIGH) — "`ingestData` dynamically resolves the conflict fields (`:199-202`) from the jOOQ-generated index handle. A migration that changes the index to `(name, namespace_id)` would automatically propagate. By contrast, the `WHERE TAG.DELETED_AT.isNull()` predicate is hardcoded (`:207`)"
- `TagController.md:implicit_adrs[Bulk-create as the operator-explicit API shape]` (HIGH) — "The dual create-shape design (bulk-explicit `bulkCreate` vs upsert-side-door `getOrCreateTagsByName`) is intentional" — intent_anchor: "Two distinct service methods with different conflict semantics — the dual-method design IS the architectural choice"
- `TagServiceImpl.md:stress_findings.S-B-4` ("Method names do NOT advertise the race difference. A caller choosing `getOrCreateTagsByName` over `getOrInjectTagByName` without reading both implementations will be surprised.")
- `TagServiceImpl.md:concepts.operations[bulkCreate, getOrCreateTagsByName, getOrInjectTagByName]` — three distinct API shapes with three distinct conflict semantics

**Decision statement**: The platform exposes TWO distinct create-paths for `tag` rows, with deliberately DIFFERENT conflict semantics:

1. **`bulkCreate(List<TagPojo>)`** — FAIL-on-duplicate. Inherited from `ReactiveAbstractCRUDRepository.bulkCreate` (`:113-126`) which emits a plain `INSERT INTO tag (...) RETURNING *` with NO `ON CONFLICT` clause. A duplicate-name attempt hits the partial unique index `tag_name_unique ON tag (name) WHERE tag.deleted_at IS NULL` (`V0_0_64:105`) and raises `UniqueConstraintException("Tag with this name already exists")` via `ExceptionUtils.translateDatabaseException` (`:54-56`). The caller (e.g. `TagController.createTag`) propagates the exception; the user sees a 4xx with the explicit "already exists" message.

2. **`ingestData(List<TagPojo>)`** — UPSERT (silent merge). Defined at `ReactiveTagRepositoryImpl.java:191-213` with explicit clauses:
   - **Conflict-target**: `Indexes.TAG_NAME_UNIQUE.getFields()` (`:199-202`) — DYNAMIC, resolved from the jOOQ-generated index handle. A migration that changes the index to `(name, namespace_id)` would automatically propagate.
   - **Conflict-predicate**: `WHERE TAG.DELETED_AT.isNull()` (`:207`) — HARDCODED, MUST MATCH the partial-index predicate.
   - **Update-clause**: `.doUpdate().set(TAG.NAME, DSL.excluded(TAG.NAME))` (`:208-209`) — no-op (sets name to itself). The semantic-equivalent of `DO NOTHING` would NOT return the existing row's id; the no-op exists SOLELY to trigger the RETURNING clause.
   - **Returning**: `.returning()` — the caller receives the row's id whether the row was just-inserted OR pre-existed.

The two methods are called from different code paths by deliberate design:

| Path | Method | Why |
|---|---|---|
| `TagController.createTag` (POST `/api/tags`, gated by `TAG_CREATE`) | `bulkCreate` | Operator EXPLICITLY creates a tag; duplicate name is a user-facing error worth surfacing |
| `TagServiceImpl.getOrCreateTagsByName` (auto-create-on-miss for `Term`, `DataEntity`, `DatasetField` side-doors) | `bulkCreate` | The auto-create UX surfaces the duplicate as 4xx; user can retry with a different name |
| `TagServiceImpl.getOrInjectTagByName` (Collector ingest via `ExternalTagIngestionRequestProcessor`) | `ingestData` | Collector push is idempotent; a duplicate from a concurrent Collector batch must SILENTLY merge |

The Collector's ingestion path is the canonical use case for the upsert: a Collector that crashes and retries the same batch should produce the SAME directory state, not an error. The dynamic conflict-target via `Indexes.TAG_NAME_UNIQUE.getFields()` ensures schema-migration safety; the hardcoded `WHERE deleted_at IS NULL` ensures the soft-delete-aware uniqueness contract holds.

**Wisdom test**: PASS. All three questions resolve toward ADR:

1. *Intentional?* YES. Two methods, two conflict semantics, three code-path choices that align consistently across the codebase (UI = fail-loud, Collector = silent-merge). The maintainer chose the upsert specifically for the Collector path; the explicit `DSL.excluded(TAG.NAME)` no-op update is a deliberate engineering choice to trigger RETURNING — it serves no other purpose. The maintainer's choice is the intent anchor.

2. *Structural impact?* YES. The pattern affects:
   - The schema (partial unique index on `name WHERE deleted_at IS NULL`)
   - The repository tier (two distinct methods with different SQL shapes)
   - The service tier (`getOrCreateTagsByName` vs `getOrInjectTagByName` — two sibling methods with the SAME signature and DIFFERENT race semantics)
   - The error-translation layer (`ExceptionUtils.java:54-56` maps the unique-constraint violation to `UniqueConstraintException("Tag with this name already exists")`)
   - The controller / OpenAPI contract (`POST /api/tags` surfaces 4xx; `POST /ingestion/entities` does NOT)

3. *Refactoring or structural?* STRUCTURAL. Unifying on one method would either break Collector idempotency (use `bulkCreate` everywhere → Collector failure on retry) OR break user-explicit-create UX (use `ingestData` everywhere → user no longer sees the "already exists" error). The split is the architectural choice.

→ ADR-CANDIDATE.

**Evidence**:
- `ReactiveTagRepositoryImpl.java:191-213` — `ingestData` upsert with explicit `Indexes.TAG_NAME_UNIQUE.getFields()` + hardcoded `WHERE TAG.DELETED_AT.isNull()` + `DSL.excluded(TAG.NAME)` no-op update
- `ReactiveAbstractCRUDRepository.java:113-126` — inherited `bulkCreate` with no `onConflict` clause
- `ExceptionUtils.java:54-56` — the `TAG_NAME_UNIQUE` translation to `UniqueConstraintException`
- `TagServiceImpl.java:79-86` — `getOrCreateTagsByName` uses `bulkCreate` (UI side-door)
- `TagServiceImpl.java:88-94` — `getOrInjectTagByName` uses `ingestData` (Collector side)
- `TagController.java:22-28` — `createTag` uses `bulkCreate` (operator-explicit)
- `ExternalTagIngestionRequestProcessor.java:104` — the lone caller of `getOrInjectTagByName`
- `V0_0_64__remove_is_deleted_field.sql:103-105` — the partial unique index that's the conflict target

**Existing ADR**: none directly. Composes with:
- **ADR-CANDIDATE-070** (Partial unique index `(name) WHERE deleted_at IS NULL`) — the DB-layer pattern this ADR's `ingestData` upsert PINS via `Indexes.TAG_NAME_UNIQUE.getFields()`. The two together describe the schema + application coordination.
- **ADR-CANDIDATE-071** (Centralised DB-error translation) — the layer that maps the `bulkCreate` path's unique-constraint violation to the user-friendly `UniqueConstraintException`.
- **ADR-CANDIDATE-065** (Tag auto-create-on-miss is spec-acknowledged) — partially overlaps; ADR-CANDIDATE-065 documents the UX intent of auto-create, this ADR documents the IMPLEMENTATION-CHOICE shape of the dual-method-design.
- **ADR-CANDIDATE-067** (`@ReactiveTransactional` boundary asymmetry) — both methods are non-transactional at the service tier; the upsert silences the race in DB, the `bulkCreate` surfaces it; this is the cross-cutting transaction commitment.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- **REFACTOR-549** (TOCTOU between `listByNames` + `bulkCreate` produces UI 500 on race) — the gap is the UI side-door callers using `getOrCreateTagsByName` (race-unsafe `bulkCreate`) when they SHOULD use `getOrInjectTagByName` (race-silent `ingestData`). The dual-method design is the ADR; the wrong-method-per-call-site is the gap.
- **REFACTOR-550** (case-sensitive vs case-insensitive name comparison) — the partial unique index is case-sensitive; the search is case-insensitive; the dual-method design is silent on this.

**Proposed action**: Promote to `adrs/drafts/dual-method-create-fail-vs-upsert.md` (new ADR). Document:
- The TWO methods: `bulkCreate` (fail-loud) and `ingestData` (silent-upsert).
- The TWO conflict semantics: `UniqueConstraintException` vs `ON CONFLICT DO UPDATE`.
- The THREE call paths: operator-explicit-create (UI fail-loud), auto-create-on-miss (UI fail-loud — gap REFACTOR-549 suggests this is wrong), Collector ingest (silent-merge).
- The dynamic-conflict-target pattern (`Indexes.TAG_NAME_UNIQUE.getFields()`) as the schema-migration safety.
- The hardcoded `WHERE deleted_at IS NULL` predicate as the soft-delete-aware uniqueness.
- The `DSL.excluded(TAG.NAME)` no-op update as the RETURNING-trigger engineering choice.
- Cross-link with ADR-CANDIDATE-065 (auto-create UX), ADR-CANDIDATE-070 (partial index), ADR-CANDIDATE-071 (error translation), and REFACTOR-549 (the gap surfacing the wrong-method-choice for side-door callers).

**Severity rationale**: HIGH — the dual-method design is the load-bearing architectural commitment for ingestion idempotency vs operator-fail-loud UX. The pattern is replicated structurally for Owner, Title, and Term (per REFACTOR-199, REFACTOR-206) but the explicit two-method shape is most clearly visible at Tag because the SAME maintainer authored both methods on the same class and chose to keep them distinct. Future maintainers introducing a new directory-shaped entity need to make this choice consciously; the ADR makes the framework available.

---
