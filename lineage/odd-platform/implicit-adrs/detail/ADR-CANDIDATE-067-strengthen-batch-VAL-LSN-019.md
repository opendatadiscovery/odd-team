## ADR-CANDIDATE-067 — STRENGTHENED BATCH VAL-LSN-019 — @ReactiveTransactional boundary asymmetry now confirmed at the TagServiceImpl tier — 4 of 9 methods carry the annotation; the 5 non-transactional methods are EITHER race-protected by upstream (upsert / partial-unique-index) OR EXPLICITLY the gap (deleteRelationsWithTerm)

**Severity unchanged**: MEDIUM
**Updated support count**: now **15-sidecar** (14 prior + 1 batch VAL-LSN-019 service-tier — TagServiceImpl)
**Batch**: VAL-LSN-019 (2026-05-20)

**New surfaced_by**:
- `TagServiceImpl.md:implicit_adrs[TX scope is the multi-statement orchestration, not the call-site]` (MEDIUM) — explicit framing: "four methods carry `@ReactiveTransactional` (`update`, `delete`, `updateRelationsWithDataEntity`, `createRelationsWithTerm`) because they issue multi-statement DB sequences; the others delegate single-step to the repository (which has its own TX or carries the inherited one)"
- `TagServiceImpl.md:stress_findings.S-E-1` (the per-method TX coverage map — 4 transactional, 5 non-transactional)
- `TagServiceImpl.md:bugs_limitations_corner_cases[bulkCreate-no-local-tx]` (LOW) — "`bulkCreate` (`:37-42`) has NO `@ReactiveTransactional` at this layer. It depends entirely on the inherited annotation at `ReactiveAbstractCRUDRepository.bulkCreate` (`:113-114`)."
- `TagServiceImpl.md:bugs_limitations_corner_cases[deleteRelationsWithTerm-no-tx]` (MEDIUM — see REFACTOR-551) — the NEGATIVE case at this service tier — a multi-step method without `@ReactiveTransactional`; the inconsistency-with-siblings is the same shape as the PolicyServiceImpl negative case (batch I) but with less rationale ("there is no comment, no exception message, no naming convention defending the absence")

**Per-method TX coverage map** (TagServiceImpl tier — the new evidence):

| Method | `@ReactiveTransactional`? | DB statements | TX rationale per the sidecar |
|---|---|---|---|
| `bulkCreate` (`:37`) | NO (inherits from repository's `bulkCreate` `:113-114`) | 1 (INSERT batch) | Inherited TX boundary |
| `update` (`:45`) | YES (`:45`) | 5 (getDto, update, 3× search-vector refresh) | Multi-step write |
| `delete` (`:57`) | YES (`:58`) | 5 (getDto, deleteTermRel, deleteDataEntRel, delete tag, term-search-vector) | Multi-step write |
| `listMostPopular` (`:73`) | NO | 1 (CTE select) | Read-only |
| `getOrCreateTagsByName` (`:80`) | NO | 2-3 (listByNames, optional bulkCreate) | **TOCTOU surface** (gap REFACTOR-549) |
| `getOrInjectTagByName` (`:89`) | NO | 2-3 (listByNames, optional ingestData) | TOCTOU race silenced by upsert (intentional) |
| `updateRelationsWithDataEntity` (`:97`) | YES (`:97`) | 5-7 (listTagRelations, listByNames, optional bulkCreate, deleteDataEntRel, createDataEntRel, listDataEntDtos) | Multi-step write |
| `deleteRelationsWithTerm` (`:124`) | NO | 2 (listByTerm, deleteTermRel) | **Multi-step read+write without TX — gap REFACTOR-551** |
| `createRelationsWithTerm` (`:137`) | YES (`:137`) | 1 (createTermRel) but called within a caller's multi-step chain | TX continuity for the caller's preceding writes (subtle — see batch I's PolicyServiceImpl negative case for sibling case-law) |

**Findings summary (from stress_findings.S-E-1)**:
- (i) **`deleteRelationsWithTerm` is multi-step read+write WITHOUT @ReactiveTransactional** — the canonical negative case at this service tier; logged as REFACTOR-551.
- (ii) **`getOrCreateTagsByName` is multi-step read+write WITHOUT @ReactiveTransactional** — TOCTOU surface; logged as REFACTOR-549.
- (iii) **`getOrInjectTagByName` is multi-step but the upsert silences the race** — INTENTIONAL; the architectural choice from ADR-CANDIDATE-194 NEW (dual-method create design).
- (iv) **`createRelationsWithTerm` carries @ReactiveTransactional for a single-statement method** — the rationale must be TX-continuity from the caller (the caller's preceding `getOrCreateTagsByName` writes need to be in the same TX as the relation-bind for atomicity). Subtle: removing `@ReactiveTransactional` from `createRelationsWithTerm` would not change THIS method's TX boundary (one statement), but would lose the propagation. This is the FOURTH sidecar surfacing this composition pattern (batch I's `LineageServiceImpl.replaceLineagePaths` confirms the same intent for ingestion atomicity).

**Decision-statement strengthening**: ADR-CANDIDATE-067's existing decision statement extends to TagServiceImpl as the 15th supporting sidecar. The pattern is consistent:
- WRITE-paths with multi-statement orchestration carry `@ReactiveTransactional` at the service tier (4 of 9 methods on this service).
- READ-paths and SINGLE-statement writes do NOT carry it (5 of 9 methods on this service).
- The negative cases (REFACTOR-549 + REFACTOR-551 on this service; REFACTOR-266 on PolicyServiceImpl in batch I) are operator-visible consequences of the maintainer omitting the annotation on a multi-step method.

The TagServiceImpl case adds a NEW dimension to the ADR-CANDIDATE-067 corpus: the **race-silenced-by-DB-design** case (`getOrInjectTagByName`'s upsert) is a DELIBERATE non-transactional choice — race resolution is delegated to the DB-layer `ON CONFLICT DO UPDATE` mechanism (ADR-CANDIDATE-070's partial unique index). This is the FIRST sidecar in the catalog where a multi-step service method INTENTIONALLY omits `@ReactiveTransactional` because the underlying DB primitive silences the race; previously the pattern was "multi-step writes ALWAYS need @ReactiveTransactional." Batch VAL-LSN-019's TagServiceImpl refines this to "multi-step writes need @ReactiveTransactional UNLESS the underlying DB primitive silences the race AND the maintainer documents the choice." The lack of a defending comment on `getOrInjectTagByName` is a doc gap (REFACTOR — should be added as a Javadoc on the interface method describing the race-semantic).

**Severity unchanged at MEDIUM**: the pattern is consistent across the platform; the negative cases are individually MEDIUM (REFACTOR-549 HIGH due to the TOCTOU-with-Collector composition; REFACTOR-551 MEDIUM). The TagServiceImpl strengthening adds the DB-layer-race-silence case to the ADR's case-law.

**Proposed action update**: The ADR-CANDIDATE-067 promotion should add a paragraph:
> "TagServiceImpl provides the canonical case-law for the DB-layer-race-silence pattern: `getOrInjectTagByName` is a multi-step read+write WITHOUT `@ReactiveTransactional` because the underlying `ingestData` upsert's `ON CONFLICT DO UPDATE` silences the race. The sibling `getOrCreateTagsByName` is the unsafe variant (uses `bulkCreate` without `onConflict`); the caller's choice of method determines the race posture. This pattern is documented in ADR-CANDIDATE-194 (dual-method create design)."

---
