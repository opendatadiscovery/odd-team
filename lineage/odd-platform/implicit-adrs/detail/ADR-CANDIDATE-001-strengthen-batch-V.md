## ADR-CANDIDATE-001 — STRENGTHENED BATCH V — Controllers-as-delegates pattern reaches 24-sidecar support across class+method axes (5 new class-level controllers)

**Severity unchanged**: HIGH
**Updated support count**: now **24-sidecar** (was 19 after batch F; batch V adds 5 new class-level sidecars)
**Batch**: V (2026-05-20)

**New surfaced_by** (5 — all `controller-class` axis):
- `QueryExampleController__controller-class__QueryExampleController.md:implicit_adrs.[0]` (HIGH) — "Pure-stub controller pattern — every method body is a one-or-two-line reactive delegation to a service; no business logic at the HTTP layer. Embodies the architectural decision that the OpenAPI-generated `*Api` interface is the contract and controllers are stub-implementations." — intent_anchor: `public class QueryExampleController implements QueryExampleApi` + the consistent 1-line `.flatMap().map(ResponseEntity::ok)` shape across all 13 methods (lines 1-125)
- `ReferenceDataController__controller-class__ReferenceDataController.md:dependencies_semantic.requires-feature.[0]` (HIGH) — "OpenAPI codegen — controller implements the generated `ReferenceDataApi` interface (`ReferenceDataController.java:6, 29`)" — 14 endpoints in `/api/referencedata/*` all match the pattern; every method is a one-line dispatch from `Mono<FormData>` / `Flux<RowFormData>` straight into either `ReferenceDataService` or `LookupDataSearchService`
- `OwnerAssociationRequestController__controller-class__OwnerAssociationRequestController.md:concepts.invariants.[0]` (HIGH) — "The class implements OwnerAssociationRequestApi (line 23) — an OpenAPI-generated interface; method bodies are thin delegations (every method = formData.flatMap → service-call → ResponseEntity.ok-or-noContent — lines 31-33, 43-44, 51-52, 60-62, 69-71, 77-78, 83-84). No domain logic at the controller layer."
- `DataEntityAttachmentController__controller-class__DataEntityAttachmentController.md:concepts.invariants.[0]` (HIGH) — "thin-delegate convention: every method is a single `attachmentService.X(...).map(ResponseEntity::ok)` (or `.thenReturn(ResponseEntity.noContent().build())` for void responses) — no business logic at controller layer" — 10 methods, all 1-2 statements
- `DatasetFieldController__controller-class__DatasetFieldController.md:implicit_adrs.[0]` (HIGH) — "**Thin-proxy controllers — every method body is a one-line `formDataMono.flatMap(...).map(ResponseEntity::ok)` shape with NO controller-layer validation or error handling.**" — intent_anchor: Lines 36-43 + the same shape repeats for every endpoint across 7 methods totaling 64 lines of method body across lines 36-103

**Cross-batch insight**: The 24-sidecar pattern now covers four complete pillar feature families at the controller-class level:

1. **P-02 Data Modelling** — QueryExampleController (13 endpoints)
2. **P-03 Master Data Management** — ReferenceDataController (14 endpoints)
3. **P-08 Management — Associations + P-09 RBAC** — OwnerAssociationRequestController (7 endpoints)
4. **P-01 Data Discovery — Attachments + per-column metadata** — DataEntityAttachmentController + DatasetFieldController (10 + 7 endpoints)

Combined with batches before V (DataEntityController, AlertController, AlertManagerController, DataCollaborationController, GenAIController, DirectoryController, SearchController, RoleController, PolicyController, OwnerController, PermissionController, CollectorController, ActivityController, TermController, IngestionController) — every controller in the platform's surfaced sample follows the pattern.

**Three CANONICAL EXCEPTION confirmations within batch V**:
- DatasetFieldController has 4 collaborating services (DatasetFieldService, EnumValueService, MetricService, TermService) injected through `@RequiredArgsConstructor` — the multi-service injection is consistent with the thin-proxy stance (the controller doesn't orchestrate the services; each method picks ONE service to dispatch to).
- DataEntityAttachmentController has SECONDARY storage-strategy wiring through ADR-CANDIDATE-164 — the storage backend is injected via Spring at construction, NOT visible at the controller layer; the controller stays storage-agnostic.
- OwnerAssociationRequestController has DUAL services (OwnerAssociationRequestService + OwnerAssociationRequestActivityService) — the audit emission is service-tier (per ADR-CANDIDATE-167); the controller dispatches READS to the activity service and WRITES to the lifecycle service.

**Pattern strengthening rationale**: The class-level sidecars (rather than per-method) confirm the pattern at full-controller granularity. A maintainer reading any one of these five files sees the same shape repeated 7-14 times within ONE controller class — the per-class consistency is itself the strongest evidence of intent.

**Severity unchanged at HIGH**. The 24-sidecar pattern across class+method axes, across 4 distinct pillar feature families, with consistent per-class repetition of the 1-line `.flatMap().map(ResponseEntity::ok)` shape, is the strongest support of any ADR in the catalog.

**Updated full triangulation enumeration** (now 24 — 19 prior + 5 new):

Prior 19 (across batches 2026-05-08 base through 2026-05-12F):
- AlertController, DataEntityAttachmentController (class), GenAIController, ActivityController.getActivity, AlertController.getAllAlerts, CollectorController.regenerateCollectorToken, DataCollaborationController.postMessageInSlack, DataEntityAttachmentController.uploadFileChunk, SearchController.search, OwnerController.createOwner, PolicyController.createPolicy, RoleController.createRole, PermissionController.getResourcePermissions, DataEntityController.getDataEntityDetails, .createOwnership, .updateStatus, .getDataEntityDownstreamLineage, IngestionController.postDataEntityList, DirectoryController

NEW batch V (5 class-level):
- QueryExampleController (class)
- ReferenceDataController (class)
- OwnerAssociationRequestController (class)
- DataEntityAttachmentController (class) — note: per-method sidecar `uploadFileChunk` was prior; the class-level sidecar is NEW in batch V
- DatasetFieldController (class)

---
