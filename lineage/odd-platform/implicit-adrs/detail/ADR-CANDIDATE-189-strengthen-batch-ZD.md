## STRENGTHENS — Batch ZD (RBAC + Integration + Identity — controller-side primary sources for the contract-first stance)

**Five new class-level sidecars confirm ADR-CANDIDATE-189's spec-side primary source from the controller-side mirror.** Every batch-ZD controller is uniformly `implements *Api` + `@Override`-only — no per-method `@RequestMapping`, no hand-rolled HTTP wiring. The 23-sidecar controller-side count of ADR-CANDIDATE-001 directly cross-validates the 1-sidecar spec-side count of THIS ADR; the architectural pair (controller-side ADR-CANDIDATE-001 + spec-side ADR-CANDIDATE-189) is the canonical contract-first stance the platform implements.

**New surfaced_by entries (controller-side mirror of the spec-first commitment)**:
- `odd-platform__java__IdentityController__controller-class__IdentityController.md:dependencies_semantic.requires-feature.[OpenAPI-generated controller scaffolding]` ("`IdentityController implements IdentityApi` (line 20); the OpenAPI spec at `openapi.yaml:115-128` defines `whoami` with operationId `whoami`, GET `/api/identity/whoami`, returns `AssociatedOwner`. Any spec change ... regenerates the API interface and may require updating the dummyOwner construction at lines 30-33")
- `odd-platform__java__PermissionController__controller-class__PermissionController.md:dependencies_semantic.requires-feature.[PermissionApi]` ("Generated at build time from `odd-platform-specification/openapi.yaml:3681-3702`")
- `odd-platform__java__RoleController__controller-class__RoleController.md:implicit_adrs.[OpenAPI-generated RoleApi]` ("The contract is owned by the spec repo (openapi.yaml:3601-3679 + components.yaml RoleFormData schema), not by the controller. ... The platform's deliberate decision: 'the API contract is spec-first; the controller is the runtime adapter'. Spec-vs-code drift (the 201-vs-200 mismatch on POST and PUT) is a recurring failure mode of this pattern — the spec evolves separately from the code, and no CI guardrail catches the divergence.")
- `odd-platform__java__PolicyController__controller-class__PolicyController.md:dependencies_semantic.requires-feature.[OpenAPI-generated PolicyApi]` ("HTTP wiring (path, method, request-body schema, parameter binding, OperationId, response-shape) comes from `odd-platform-specification/openapi.yaml:3499-3599`. The interface compels the controller to declare every method with `final ServerWebExchange exchange` as a trailing parameter; the controller uses none of them.")
- `odd-platform__java__IntegrationController__controller-class__IntegrationController.md:dependencies_semantic.requires-feature.[IntegrationApi]` ("OpenAPI-generated controller interface (`api.contract.api.IntegrationApi`) the controller implements via `@Override` on each method; the contract is auto-derived from `openapi.yaml:51-84`.")

**Cross-batch refinement** (batch ZD strengthens specifically the contract-vs-impl status-code drift facet of this ADR's commitment #1):
- RoleController.md explicitly names the drift: "POST + PUT spec-says-201, code-returns-200" — class-level confirmation of the cross-cutting REFACTOR-545 pattern.
- PolicyController.md explicitly names the drift: "PolicyController.createPolicy line 24 returns ResponseEntity.ok() (HTTP 200); PolicyController.updatePolicy line 49 returns ResponseEntity.ok() (HTTP 200). openapi.yaml:3528, 3566 declares 201."
- The cross-cutting REFACTOR-545 now spans 12+ controllers including the batch-ZD-confirmed Role + Policy.

**The architectural pair** (the contract-first stance):
- **ADR-CANDIDATE-001 (controller-side, 23-sidecar):** every controller `@Override`s a generated `*Api` interface; no hand-rolled `@RequestMapping`.
- **ADR-CANDIDATE-189 (spec-side, primary source):** every `/api/**` endpoint is declared in `openapi.yaml`; two files split (paths in `openapi.yaml`, schemas in `components.yaml`); 35 tags partition 194 operations.

The 23-sidecar controller-side coverage CONFIRMS the spec-side primary source: across every controller class inspected in batches A-ZD (RBAC + DataEntity + Tag + Term + Owner + Policy + Role + Permission + Identity + Integration + Ingestion + Alert + Activity + Search + DataCollaboration + Attachment + Collector + DataSource + Directory + GenAI + ReferenceData + ManagementHealth + QueryExample + AppInfo + Namespace), the convention HOLDS without exception (except AlertManagerController, the documented intentional exception per ADR-CANDIDATE-014).

**Severity unchanged**: HIGH — the canonical contract-first stance.

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-001 (controller-side mirror); ADR-CANDIDATE-014 (AlertManagerController as the documented exception — batch-ZD did not enrich AlertManager).
- SUPERSEDES: none.
- CONFLICTS: none.
