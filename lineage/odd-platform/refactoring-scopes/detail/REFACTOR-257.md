## REFACTOR-257 — No bulk endpoints for the 22 single-id methods on DataEntityService — catalog-wide N-request inefficiency for batch UI/script consumers

**Severity**: LOW
**Category**: missing-quota / api-shape (bulk-endpoint absence)
**Surfaced by**:
- `DataEntityServiceImpl.md:bugs_limitations_corner_cases[10]`

**Description**: `DataEntityService` (the interface) exposes 22 public methods, MOST of which take a single id parameter (`getDetails(long)`, `upsertDescription(long, ...)`, `upsertBusinessName(long, ...)`, `addDataEntityToDEG(long, long)`, `updateStatus(long, ...)`, etc.). Two methods are bulk-shaped: `getDimensions(Collection<String> oddrns)` and `getDimensionsByIds(Set<Long> ids)` — but these are internal-only (called by `DataQualityServiceImpl`, etc.); no public HTTP endpoint exposes bulk-detail or bulk-write.

The consequence:
- A consumer wanting to fetch details for 100 entities issues 100 calls (100 × `getDataEntityDetails` round-trips, each with its own @ReactiveTransactional + view-count increment per ADR-CANDIDATE-054).
- A UI / script wanting to update descriptions on 100 entities issues 100 PUT calls (100 × transactions + 100 × FTS-vector rebuilds + 100 × activity emissions).
- The cost scales linearly with N; no batching at any layer.

This is a CATALOG-WIDE concern. Recorded in `concepts.yaml` batch F line 496 as the inferred performance characteristic. The maintainer's choice is implicit: per-resource REST conventions over batch-write efficiency.

**Primary source citations**:
- `DataEntityService.java:34-95` — the 22-method interface, mostly single-id signatures
- `DataEntityServiceImpl.java:141-161` — the only bulk-shaped reads (`getDimensions`)
- composes with REFACTOR-201 (`view_count` UPDATE inflation under N reads) and REFACTOR-211 (`view_count` hot-key contention)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-001 (controllers-as-delegates) + OpenAPI-generated interfaces — the per-resource REST shape is the contract. Adding bulk endpoints requires extending the OpenAPI spec. The fix is refactoring within the existing pattern (add bulk methods on the OpenAPI spec, regenerate, add service methods).

**Proposed remedy**: Two composable fixes:
1. **Bulk read endpoints** (highest leverage):
   - `POST /api/dataentities/details` with body `{ids: [...]}` returning `List<DataEntityDetails>` — replaces N × single-detail calls with 1.
   - Inside the service, batch the enrichment (the 5-way zip already batches via `listByOddrns`); the bulk endpoint just exposes it.
   - View-count increment should be batched too: one `bulkIncrementViewCount(ids)` call instead of N single increments.
2. **Bulk write endpoints**:
   - `PUT /api/dataentities/descriptions/bulk` with body `{updates: [{id, description}]}` — one transaction, one FTS-vector rebuild for the batch, one activity row per updated entity.
   - Similar for tags, terms, business-name, status.

The trade-off:
- Bulk write semantics must specify per-failure behaviour (all-or-nothing vs partial-success).
- The activity-feed emission must remain per-entity (per ADR-CANDIDATE-060 — programmatic per-entity emission for bulk).
- The FTS-vector rebuild cost is dominated by the per-entity work; batching saves the per-request overhead but not the per-entity SQL cost.

**Severity rationale**: LOW — performance characteristic, not a runtime defect. Operators using the platform at scale (10K+ entities, scripted-bulk-edit workflows) feel the cost; small deployments don't notice.

**Suggested backlog grouping**: `Bulk-endpoint expansion sprint` — pair with REFACTOR-211 (view_count hot-key) and the broader catalog-wide bulk-write concerns. A sprint scoped to "bulk-write APIs for the 5 most-used single-id endpoints" is a natural unit.

---
