## ADR-CANDIDATE-001 — STRENGTHENED BATCH Z — All 5 batch-Z sidecars confirm the OpenAPI-Generator-emitted `*Api` interface pattern; the openapi-spec sidecar PRIMARY SOURCE anchors the SPEC SIDE of the contract-first stance complementing the 19+ controller-side enumeration

**Severity unchanged**: HIGH
**Updated support count**: now **24 + sidecars** (19 prior at batch Y + 5 batch Z: getDataEntitiesByDEGOddrn + postDataSetStatsList + ingestMetrics + openapi-spec + IngestionServiceImpl)
**Batch**: Z (2026-05-20)

**New surfaced_by**:
1. `getDataEntitiesByDEGOddrn.md:implicit_adrs.[2]` (HIGH) — "Path mapping is OpenAPI-contract-driven (no `@GetMapping`)" — evidence: IngestionController.java:75-79 (`@Override` only, no `@GetMapping`) + the consistent pattern across every method on this controller (postDataEntityList, createDataSource, postDataSetStatsList, ingestMetrics — all OpenAPI-driven per existing sibling sidecars) — intent_anchor: the convention is applied uniformly; only `AlertManagerController` deviates with hand-rolled `@PostMapping`.

2. `postDataSetStatsList.md:dependencies_semantic.coupling.[0]` (HIGH) — "Path is OpenAPI-driven — `/ingestion/entities/datasets/stats` POST is declared in the external `opendatadiscovery-specification` repository (loaded as the `ingestion-contract-server:0.1.40` gradle dep per libs.versions.toml:6,65,142). Changing the path requires bumping the dep AND regenerating. No `@PostMapping` annotation on `IngestionController` (consistent with the package convention — every method is an `@Override` of an `IngestionApi` interface method)."

3. `ingestMetrics.md:dependencies_semantic.coupling.path_contract_driven` (HIGH) — "Path is contract-driven — `/ingestion/metrics` POST is declared in the published `ingestion-contract-server` artifact (verified test-side: `BaseIngestionTest.java:92`). The controller method is `@Override`-only (line 89-95), no `@PostMapping` annotation — consistent with the rest of `IngestionController` per the `postDataEntityList.md:implicit_adrs.[0]` implicit ADR (every `IngestionController` method is `@Override` of the generated interface)."

4. **PRIMARY SOURCE — SPEC-side framing** — `openapi.yaml.md:implicit_adrs.[0]` (HIGH) — "**OpenAPI is the path/method/shape source of truth — controllers IMPLEMENT, never DECLARE** — the convention across all enriched controllers (AlertController, DataEntityController, TermController, OwnerController, QueryExampleController, DataSourceController, CollectorController, TagController — batch-W primary-source class-level sidecars confirm the pattern at 3 additional Management-tier controllers) is to `@Override` methods inherited from the generated `*Api` interface. No controller has its own `@RequestMapping` for the operations declared in the spec." — **this is the SPEC FILE's PRIMARY SOURCE confirmation of the architectural pattern** — the spec-side framing of ADR-001 emerges as a NEW ADR per ADR-CANDIDATE-189 NEW batch Z; together ADR-001 (controller-side) + ADR-189 (spec-side) form the contract-first ARCHITECTURAL PAIR.

5. `IngestionServiceImpl.md` — INDIRECT corroboration via the architectural composition with the `IngestionService` interface that controllers `@Override`; the impl sidecar confirms NO `@RequestMapping` at the SERVICE LAYER either (the pattern is "shape lives on the spec, behaviour at the service").

**Cross-batch picture — the pattern is the platform's strongest single architectural commitment**:
- **24+ sidecars** confirm the controller-side `@Override` pattern (every enriched controller across batches A through Z)
- **NEW batch Z PRIMARY SOURCE** at the spec file itself (openapi-spec sidecar): 4212 lines of `openapi.yaml` + 2937 lines of `components.yaml` declare 194 operations across 35 tags; controllers inherit routing from generated `*Api` interfaces
- **The cross-tier symmetry** (controller-side ADR-001 + spec-side NEW ADR-CANDIDATE-189) is the canonical contract-first stance for the platform-api surface
- The ONE deliberate exception (`AlertManagerController.java` — hand-rolled `@PostMapping` for the third-party Prometheus AlertManager webhook contract) is documented at ADR-CANDIDATE-014 NEW batch P

**Severity unchanged at HIGH** — the pattern is the load-bearing architectural decision for every `/api/**` endpoint in the platform. The batch-Z SPEC-SIDE primary source (the openapi-spec sidecar) is the strongest single confirmation; before batch Z, the pattern was enumerable from controller sidecars only — batch Z anchors the SPEC-side framing as a co-equal architectural component.

**Cross-link to NEW ADR-CANDIDATE-189**: ADR-001 (controller-side) and ADR-189 (spec-side) compose into the contract-first ARCHITECTURAL PAIR. They are not duplicates — ADR-001 covers WHAT controllers do (`@Override`, no `@RequestMapping`); ADR-189 covers WHAT THE SPEC IS (the authoritative declaration, the two-file split, the 35-tag partition, the dual-spec one-per-audience architecture). Future ADR consumers reading the pair get both axes of the same contract-first commitment.

---
