## STRENGTHENS — Batch ZD (PermissionController-class — class-level confirmation of the enum-field discriminator)

**One new sidecar promotes ADR-CANDIDATE-051's support from 1 (controller-method) to 2 (controller-method + controller-class)** — the class-level PermissionController enrichment confirms the enum-field discriminator at the file scope rather than the per-method scope.

**New surfaced_by entry**:
- `odd-platform__java__PermissionController__controller-class__PermissionController.md:implicit_adrs.[3]` ("Resource-type ↔ context coupling is encoded at the enum (`PolicyTypeDto.hasContext`), not at the controller. The controller is type-agnostic — it accepts every `PermissionResourceType` value the spec allows, and lets the service-tier discriminator raise `BadUserRequestException` for non-contextual values. The decision is to keep the controller a pure stub of `PermissionApi`, push semantic discrimination to the service. Alternative shapes (e.g. two separate path matchers `/api/resource/contextual/...` vs `/api/resource/management/...`) are explicitly avoided." — intent_anchor: "`if (!policyTypeDto.isHasContext()) { throw new BadUserRequestException(\"Resource type \" + resourceType + \" does not have context\"); }` (`PermissionServiceImpl.java:25-27`)")

**Architectural refinement**: The class-level confirmation strengthens the architectural commitment that the discriminator is the LOAD-BEARING primitive enabling the read-surface split between contextual and non-contextual permission reads (per ADR-CANDIDATE-211, NEW this batch). The three-layer mirror is now confirmed across the entire stack:

- **Enum layer**: `PolicyTypeDto.hasContext` (DATA_ENTITY/TERM/QUERY_EXAMPLE=true, MANAGEMENT=false).
- **Service layer**: `PermissionServiceImpl.java:25-27` raises `BadUserRequestException` for `hasContext == false` on the contextual endpoint; `PermissionServiceImpl.java:35-37` raises the symmetric exception for `hasContext == true` on the non-contextual endpoint.
- **HTTP / SPI layer**: `PermissionService` interface declares both methods; the controller wires only the contextual one; the non-contextual is consumed by `IdentityServiceImpl` (per ADR-CANDIDATE-211).

**Cross-batch refinement**: The class-level PermissionController also surfaces a NEW co-surfaced gap — the spec-vs-runtime asymmetry around MANAGEMENT (the OpenAPI enum at `components.yaml:3387` lists MANAGEMENT as a valid path-parameter value, but the runtime rejects it). The architectural commitment IS deliberate per the discriminator, but the operator-visible asymmetry is documented as a class-level finding in batch-ZD.

**Severity unchanged**: MEDIUM — type-system-and-extensibility decision; affects every future resource type addition.

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-211 (the read-surface split — the discriminator IS the primitive that enables the split).
- SUPERSEDES: none.
- CONFLICTS: none.
