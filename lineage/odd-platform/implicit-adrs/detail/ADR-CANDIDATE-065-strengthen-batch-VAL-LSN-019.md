## ADR-CANDIDATE-065 — STRENGTHENED BATCH VAL-LSN-019 — Tag auto-create-on-miss now confirmed at the SERVICE-tier choice point AND the REPOSITORY-tier mechanism — the dual-method shape (`getOrCreateTagsByName` vs `getOrInjectTagByName`) materialises the spec-acknowledged UX with two different conflict semantics; the upsert path's RETURNING-trigger no-op is the explicit engineering choice

**Severity unchanged**: MEDIUM
**Updated support count**: now **3 sidecars** (1 batch original + 2 batch VAL-LSN-019 strengthening — service-tier + repository-tier confirmation)
**Batch**: VAL-LSN-019 (2026-05-20)

**New surfaced_by**:
- `TagServiceImpl.md:concepts.operations[getOrCreateTagsByName / getOrInjectTagByName]` — full service-tier shape of the dual-method design; the auto-create-on-miss UX is implemented as `divideTagsByExistence → bulkCreate-or-ingestData` depending on the caller's needed race-semantic
- `TagServiceImpl.md:audiences` — confirms the 4 side-door callers (`TermServiceImpl.upsertTags`, `DataEntityServiceImpl.upsertTags`, `DatasetFieldServiceImpl` x2 call sites) each receive `bulkCreate`-shape race-semantics; the lone `ExternalTagIngestionRequestProcessor.process:104` caller receives `ingestData`-shape (silent merge)
- `ReactiveTagRepositoryImpl.md:implicit_adrs[partial-unique-index-as-race-protection]` (HIGH) — "The `ingestData` upsert (`:204-210`) leans on `ON CONFLICT (name) WHERE deleted_at IS NULL DO UPDATE SET name = EXCLUDED.name` to make concurrent novel-name inserts idempotent without an application-level lock; the same mechanism does NOT protect the `bulkCreate` path used by `TagServiceImpl.getOrCreateTagsByName`"
- `ReactiveTagRepositoryImpl.md:implicit_adrs[RETURNING-trigger no-op]` (HIGH) — "the upsert sets the conflicting row's name to itself (`DSL.excluded(TAG.NAME)` at `:209`). The semantic-equivalent of `DO NOTHING` would NOT return the existing row's id; the no-op update exists solely to trigger the RETURNING clause. The caller (`TagServiceImpl.getOrInjectTagByName`) needs the id of every row (existing or newly inserted) to build `TagToDataEntityPojo` relations."
- `ReactiveTagRepositoryImpl.md:implicit_adrs[bulkCreate vs ingestData dual-method]` (HIGH)

**Decision-statement strengthening**: The original batch's ADR-CANDIDATE-065 framed the auto-create-on-miss as a UX commitment surfaced in the OpenAPI spec text (`openapi.yaml:1174`: "Also creates corresponding tags in the system if they don't exist."). Batch VAL-LSN-019 surfaces the IMPLEMENTATION shape:

- The UX is implemented at TagServiceImpl via TWO sibling methods (`getOrCreateTagsByName` + `getOrInjectTagByName`) with the SAME signature and DIFFERENT race semantics — codified as NEW ADR-CANDIDATE-194 (dual-method create design).
- The repository tier provides TWO distinct primitives (`bulkCreate` + `ingestData`) where `ingestData`'s upsert with `DSL.excluded(TAG.NAME)` is a deliberate engineering choice to trigger the RETURNING clause.
- The schema tier (per ADR-CANDIDATE-070 / V0_0_64:103-105) provides the partial unique index `tag_name_unique ON tag (name) WHERE tag.deleted_at IS NULL` that the upsert PINS via `Indexes.TAG_NAME_UNIQUE.getFields()` (dynamic resolution).

The three-tier picture: ADR-CANDIDATE-065 (UX intent) + ADR-CANDIDATE-194 NEW (implementation-shape) + ADR-CANDIDATE-070 (schema-layer enforcement) describe the full architecture. The original ADR-CANDIDATE-065 was the WHAT; the new strengthening establishes the HOW.

**The auto-create-on-miss callable surface** (from the new sidecars):

| Caller path | Method | Conflict semantic |
|---|---|---|
| `TermServiceImpl.upsertTags:257` (PUT `/api/terms/{term_id}/tags`, gated by `TERM_TAGS_UPDATE`) | `getOrCreateTagsByName` → `bulkCreate` | Fail-on-duplicate — surfaces `UniqueConstraintException` to user on TOCTOU race |
| `DataEntityServiceImpl.upsertTags` (PUT `/api/dataentities/{id}/tags`, gated by `DATA_ENTITY_TAGS_UPDATE`) | `getOrCreateTagsByName` → `bulkCreate` | Fail-on-duplicate — same |
| `DatasetFieldServiceImpl:202, 266` (PUT `/api/datasetfields/{id}/tags`, gated by `DATASET_FIELD_TAGS_UPDATE`) | `getOrCreateTagsByName` → `bulkCreate` | Fail-on-duplicate — same |
| `ExternalTagIngestionRequestProcessor.process:104` (POST `/ingestion/entities`, S2S-filter-gated) | `getOrInjectTagByName` → `ingestData` | Silent merge — race resolved at DB level |

**The 4 UI side-door surfaces ALL use the race-unsafe path; the lone Collector caller uses the race-safe path.** This composition is the operator-visible consequence: REFACTOR-549 (concurrent UI + Collector on same novel name → UI gets 500 with cryptic `UniqueConstraintException`). The gap is logged as REFACTOR-549; the architectural intent (auto-create UX) is logged in this ADR.

**Cross-link narrative (updated)**:
- ADR-CANDIDATE-065 codifies: "auto-create-on-miss is intentional UX, spec-acknowledged, `important = false` by default."
- ADR-CANDIDATE-194 NEW codifies: "the implementation provides two methods with different conflict semantics; the choice per call-site determines the race posture."
- ADR-CANDIDATE-070 codifies: "the partial unique index `(name) WHERE deleted_at IS NULL` is the DB-layer enforcement; the upsert PINS the index handle dynamically."
- REFACTOR-223 captures: "the auto-create UX's permission story is undefended (DATA_ENTITY_TAGS_UPDATE side-doors past TAG_CREATE)."
- REFACTOR-549 NEW captures: "the side-door callers use the race-unsafe method; switching them to `getOrInjectTagByName` would silence the race-with-Collector class."

The four entries together describe the full Tag auto-create-on-miss architecture + the gaps the architecture leaves un-defended. The maintainer's triage on the ADR side can be "promote all three" (each captures a distinct facet); the triage on the refactor side can be "fix REFACTOR-549 per the ADR's race-semantic-per-caller framing."

**Severity unchanged at MEDIUM**: the auto-create UX is intentional; the strengthening clarifies the implementation. The gaps (REFACTOR-223, REFACTOR-549, REFACTOR-550, REFACTOR-554) are separate concerns whose severity is captured at their own entries.

**Proposed action update**: The original ADR text should be extended to reference:
- The dual-method implementation (cross-link to ADR-CANDIDATE-194 NEW)
- The partial-unique-index-pinning shape (cross-link to ADR-CANDIDATE-070)
- The race-asymmetry between UI and Collector callers (cross-link to REFACTOR-549) as the WARNING for future maintainers — the auto-create UX is correct; the choice of which method per call-site needs the maintainer's deliberate attention.

---
