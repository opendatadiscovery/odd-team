# ADR-CANDIDATE-001 — Controllers are pass-through delegates; HTTP wiring lives on OpenAPI-generator-emitted `*Api` interfaces, not on the controller class

## STRENGTHENS — batch ZG (2026-05-25 — three new controller-class sidecars: DataSetController + DatasetFieldController + DataEntityRunController)

**Three new class-level confirmations** join the 28-sidecar support set established at batch ZF; the running total is now **31 sidecars**:

- `odd-platform__java__DataSetController__controller-class__DataSetController.md:implicit_adrs.[0]` (HIGH) — "Dataset structure versions are surfaced as a thin pass-through from DatasetVersionService — no caching, no aggregation, one DB round-trip per call" — intent_anchor: "the entire class is `Mono<ResponseEntity<T>>` from `service.method(...).map(ResponseEntity::ok)` with no extra logic — explicit single-responsibility split between controller (HTTP) and service (semantics)". 4 endpoints, 60 lines, every body a one-liner.
- `odd-platform__java__DatasetFieldController__controller-class__DatasetFieldController.md:implicit_adrs.[0]` (HIGH) — "**Thin-proxy controllers — every method body is a one-line `formDataMono.flatMap(...).map(ResponseEntity::ok)` shape with NO controller-layer validation or error handling.**" — 7 endpoints across 4 collaborating services (DatasetFieldService, EnumValueService, MetricService, TermService); intent_anchor: "Lines 36-43 (`updateDatasetFieldDescription` body): `return formDataMono.flatMap(formData -> datasetFieldService.updateDescription(datasetFieldId, formData)).map(ResponseEntity::ok);` — and the same shape repeats for every endpoint."
- `odd-platform__java__DataEntityRunController__controller-class__DataEntityRunController.md:implicit_adrs.[2]` (MEDIUM) — "Reactive `Mono` chain with no `onErrorResume` — the controller propagates mapper / SQL exceptions verbatim to Spring's default error handler" + class-level pattern: 1 endpoint, 28 lines, single `service.method(...).map(ResponseEntity::ok)` body. Confidence MEDIUM because the convention is inferred (not file-comment-anchored) but the pattern is consistent.

Notable nuance the batch-ZG additions surface:

- **Multi-service controllers still follow the pattern** — `DatasetFieldController` injects FOUR services (DatasetFieldService, EnumValueService, MetricService, TermService) yet every method body remains a one-line delegation. The pattern is robust against multi-service wiring; the controller is not the composition point even when multiple services collaborate on the column-level surface.
- **`createEnumValue` is the ONE endpoint in the platform returning HTTP 201 from the controller** (`DatasetFieldController.java:71` — `HttpStatus.CREATED`). The three sibling PUT endpoints in the same controller (description / internalName / tags) return 200 — the spec/code 201-vs-200 drift class. The asymmetry within ONE controller (one 201, three 200s) is operator-visible drift; the pattern is preserved (thin proxy), but the response-code commitment varies (REFACTOR-545 cluster captures this).
- **DataSetController is the read-only counterpart** — 4 GET endpoints, all return 200 via `ResponseEntity::ok`, no `@PreAuthorize`, no `@Transactional` — the simplest possible application of the pattern. Demonstrates that the pattern holds even when there's NO service-layer logic to delegate to (DatasetVersionService is also a thin compose-and-return surface).

The 31-sidecar evidence base spans every controller-class enriched across batches J / V / W / X / Y / Z / ZD / ZE / ZF / ZG. The pattern is now the platform's controller-layer architectural primitive. Any future controller deviating from the pass-through pattern should be flagged as an architectural exception requiring its own ADR justification.

**Cross-batch refinement** (batch ZG's contribution): the pattern now confirmed at **READ-ONLY** controllers (DataSetController — 4 GETs), **WRITE-HEAVY** controllers (DatasetFieldController — 7 mutations across 4 services), and **SINGLE-ENDPOINT** controllers (DataEntityRunController — 1 GET). Three different scale shapes; same pattern.

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-001 (canonical pattern). No new sibling ADRs surfaced this batch.
- SUPERSEDES: none.
- CONFLICTS: none.

---
