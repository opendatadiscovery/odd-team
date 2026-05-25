## STRENGTHENS — Batch ZD (RBAC + Integration controllers — 5 new class-level confirmations)

**Five new class-level sidecars promote the support count of ADR-CANDIDATE-001 from 18 to 23** — the strongest single pattern in the catalog continues to hold across every controller-class inspected this batch. Each of the five sidecars enriched in batch ZD (IdentityController, PermissionController, RoleController, PolicyController, IntegrationController) explicitly cites the OpenAPI-generated `*Api` interface `implements` + `@Override`-only convention.

**New surfaced_by entries**:
- `odd-platform__java__IdentityController__controller-class__IdentityController.md:dependencies_semantic.requires-feature.[OpenAPI-generated controller scaffolding]` ("`IdentityController implements IdentityApi` (line 20); the OpenAPI spec at `openapi.yaml:115-128` defines `whoami` with operationId `whoami`, GET `/api/identity/whoami`, returns `AssociatedOwner`. Any spec change (e.g. adding a `provider` field to `Identity`) regenerates the API interface and may require updating the dummyOwner construction at lines 30-33")
- `odd-platform__java__PermissionController__controller-class__PermissionController.md:concepts.entities.[PermissionApi]` ("OpenAPI-generated controller interface (line 4, 16); the contract this @RestController implements. The single method signature is auto-derived from `openapi.yaml:3681-3702`")
- `odd-platform__java__RoleController__controller-class__RoleController.md:implicit_adrs.[OpenAPI-generated RoleApi]` ("All four RBAC role endpoints share the OpenAPI-generated `RoleApi` interface — the controller implements it (line 16). The contract is owned by the spec repo (openapi.yaml:3601-3679 + components.yaml RoleFormData schema), not by the controller. This is consistent with sibling generated *Api interfaces (DataEntityApi, PolicyApi, OwnerApi etc.). The platform's deliberate decision: 'the API contract is spec-first; the controller is the runtime adapter'.")
- `odd-platform__java__PolicyController__controller-class__PolicyController.md:implicit_adrs.[0]` ("Controller is a thin proxy onto the service tier — zero business logic at the HTTP boundary. The class is 64 lines, contains NO conditionals, NO field validation, NO error translation, NO logging, NO transaction bracket; every method is two-to-three Mono operations. The decision is consistent across the codebase: every controller in `controller/` directory that implements a generated `*Api` interface follows this exact pattern.")
- `odd-platform__java__IntegrationController__controller-class__IntegrationController.md:dependencies_semantic.requires-feature.[IntegrationApi]` ("OpenAPI-generated interface (`odd-platform-api-contract`) — supplies the `@GetMapping`-annotated method signatures, the `String integrationId` path-variable binding, and the response-type erasure (`Mono<ResponseEntity<Integration>>`, `Mono<ResponseEntity<IntegrationPreviewList>>`).")

**Updated support count**: 23-sidecar coverage (was 18 after batch X-TAGGING). The pattern is now confirmed across:
- Mutation surfaces: every batch-E + batch-F + batch-X-TAGGING + batch-ZD controller.
- Read surfaces: detail, lineage, attachments, directory, alerts, activity, search, permissions discovery, identity, integrations.
- RBAC management: Policy + Role + Owner + Permission controllers ALL `@Override`-only.
- Integration / wizard surface: IntegrationController is the second public-by-design + open-read surface (alongside AppInfoController) that uniformly applies the pattern.

**Cross-batch refinement**: The batch-ZD coverage extends the pattern to ALL FOUR RBAC controllers' CLASS-LEVEL sidecars (Policy + Role + Owner + Permission) — previously only controller-METHOD sidecars confirmed; the class-level confirmation cross-validates that the convention holds at the file scope (the entire 27/52/64/28-line files contain no `@RequestMapping` / `@PostMapping` / `@DeleteMapping`).

**Severity unchanged**: HIGH — the strongest single architectural pattern in the catalog; defines the entire HTTP surface's contract-source-of-truth.

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-189 (the spec-side primary source — every batch-ZD class confirms the controller-side mirror of the contract-first stance).
- SUPERSEDES: none.
- CONFLICTS: none.
