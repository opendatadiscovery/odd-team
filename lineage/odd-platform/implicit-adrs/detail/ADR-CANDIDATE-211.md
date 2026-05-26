## ADR-CANDIDATE-211 — Permission read surface is intentionally SPLIT: contextual reads on `PermissionController` (`GET /api/resource/{type}/{id}/permissions`); non-contextual MANAGEMENT reads delivered via the `Identity.permissions` payload from `IdentityServiceImpl.whoami`

**Severity**: MEDIUM (architectural-comprehension shape — affects every UI permission gate and every new maintainer reading the RBAC code path)
**Classification**: promote (NEW ADR; POSITIVE-INTENT — deliberate read-surface split mirrored by the `PolicyTypeDto.hasContext` discriminator)
**Batch**: ZD (2026-05-25)
**Pillars affected**: [P-09 Security & Access Control (the read-side surface of the policies/permissions/roles framework), P-08 Management & Administration (the UI's MANAGEMENT-permission gating consumes the Identity-payload path)]
**Support**: 1 sidecar PRIMARY SOURCE (batch-ZD PermissionController-class) — the architectural split is observable across the SPI surface (`PermissionService` exposes 2 methods; controller wires only 1), the response delivery (the OTHER method is consumed by IdentityServiceImpl which populates the Identity DTO consumed by the UI's `getGlobalPermissions` selector), and the OpenAPI contract (PermissionResourceType enum has 4 values but the controller endpoint rejects MANAGEMENT at runtime).

**Surfaced by**:
- `odd-platform__java__PermissionController__controller-class__PermissionController.md:implicit_adrs.[2]` (MEDIUM) — "Single-method controller class is the deliberate shape — the file is NOT a stub waiting for more methods. The non-contextual MANAGEMENT read surface is housed elsewhere (IdentityServiceImpl populates `Identity.permissions` for `getGlobalPermissions` consumption). The split is structural: 'context-dependent reads' here, 'global reads' on Identity. The decision is visible in the absence of a `getNonContextualPermissions` companion method on `PermissionController` despite `PermissionService` exposing one — the controller deliberately wires only the half that needs an endpoint." — intent_anchor: "structural pattern (no comment / no doc; the design intent is observable in the architectural split). Without a class-level comment, the decision-as-intent has MEDIUM confidence — the file may simply not have been refactored to add a non-contextual endpoint, in which case the absence is a gap not an ADR. The evidence weakly favours the ADR reading because `IdentityServiceImpl` correctly populates the field, and the wiring on the UI side (consume from Identity, not via this endpoint) is consistent across all UI surfaces."
- `odd-platform__java__PermissionController__controller-class__PermissionController.md:concepts.invariants.[file-naming-vs-surface mismatch]` (HIGH) — "The file is named `PermissionController` (suggesting it owns the full Permission read surface) but it owns ONLY the contextual half. The non-contextual MANAGEMENT half is on `IdentityServiceImpl` and delivered via `Identity.permissions`. A new maintainer searching for 'where do permissions come back to the UI?' must read BOTH paths."

**Decision statement**: The platform-api's permission read surface is intentionally PARTITIONED into two delivery paths chosen by the resource type's contextual-vs-global character:

1. **Contextual reads (DATA_ENTITY / TERM / QUERY_EXAMPLE)** are served by `GET /api/resource/{permission_resource_type}/{resource_id}/permissions` on `PermissionController` (`PermissionController.java:19-25`). The endpoint accepts a `(resourceType, resourceId)` pair; the service dispatches to a `ContextualPermissionExtractor` matching the type; the extractor zips the resource's context (entity + tags + caller's Owner) with the caller's policies and emits the resolved Permission set. Each UI surface (DataEntityDetails, TermDetails, QueryExampleDetailsContainer, etc.) fetches its own resource-scoped permissions per page-mount.

2. **Non-contextual MANAGEMENT reads** are NOT served by this controller. Instead, `IdentityServiceImpl.whoami` (`IdentityServiceImpl.java:36-52`) zips the user's contextual+non-contextual resolution into the `AssociatedOwner` response body; the `Identity.permissions` field carries the resolved MANAGEMENT-scope permissions. The UI consumes them via `getGlobalPermissions` (`profile.selectors.ts:17-20`) reading `profile.owner?.identity.permissions`. Calling `GET /api/resource/MANAGEMENT/{anyId}/permissions` triggers `BadUserRequestException("Resource type MANAGEMENT does not have context")` at `PermissionServiceImpl.java:25-27` → HTTP 400 USR001.

The split is mirrored at THREE structural layers:

- **Enum layer**: `PolicyTypeDto.hasContext` field (`PolicyTypeDto.java:8-12`) — DATA_ENTITY/TERM/QUERY_EXAMPLE=true, MANAGEMENT=false. Per ADR-CANDIDATE-051 (the discriminator ADR).
- **Service layer**: `PermissionService` interface (`PermissionService.java:7-12`) declares TWO methods — `getResourcePermissionsForCurrentUser(type, id)` AND `getNonContextualPermissionsForCurrentUser()`. The controller wires only the first; the second is consumed by `IdentityServiceImpl`.
- **HTTP / UI layer**: contextual fetches happen per-page-mount via the dedicated endpoint; global fetches happen once-per-SPA-mount via the whoami response. The UI's `WithPermissionsProvider` (`PermissionProvider.tsx:17-32`) unions both into `allowedPermissions` and gates UI controls.

The architectural commitment encodes ONE coherent property: **a contextual read requires a resource id; a global read does not — the URL shape SHOULD reflect that, and the platform chooses to deliver globals via the "who am I?" payload rather than as a dedicated `GET /api/permissions/management` endpoint**. The trade-off accepted: the file naming `PermissionController` is misleading (a new maintainer reading this file gets an incomplete picture of the permission read surface), and the OpenAPI spec lists 4 `PermissionResourceType` enum values but only 3 actually work through the controller endpoint.

**Wisdom test**: PASS (MEDIUM confidence on intentionality; HIGH on structural impact).
1. **Intentional?** MEDIUM — no defending comment; the split is observable in three layers (enum / SPI / response delivery) and the UI consumer chain is consistent across all four surfaces (`getGlobalPermissions` reads from Identity, not from this controller). The cross-layer consistency favours the ADR reading over the "forgot to add a non-contextual endpoint" gap reading; but the absence of a comment defending the choice means the maintainer COULD plausibly add a `getNonContextualPermissions` endpoint to this controller in a future refactor without recognising the existing architectural split.
2. **Structural impact?** YES — every UI Permission-gated control consults BOTH paths; a future refactor that moved MANAGEMENT permissions to a dedicated endpoint (or that added a non-contextual endpoint to this controller) would force a UI rewrite of `WithPermissionsProvider`'s allowedPermissions composition.
3. **Addition vs structural change?** Adding a `getNonContextualPermissions` endpoint to this controller would be a STRUCTURAL change to the read-surface partition — not a refactor of the existing contextual surface. The current architecture is a positive structural choice (even if MEDIUM-confidence intentional).

**Evidence**:
- PermissionController.md says: "`PermissionController.java:1-27` (single method) + `PermissionService.java:11` (the non-contextual interface method is NOT wired through this controller)"
- PermissionController.md says: "`profile.selectors.ts:17-20` (UI consumer of the global half — reads from Identity payload, not this endpoint)"
- PermissionController.md says: "`PermissionServiceImpl.java:25-27` (MANAGEMENT rejected at runtime: `BadUserRequestException(\"Resource type MANAGEMENT does not have context\")`)"
- PermissionController.md says: "`PolicyTypeDto.java:8-12` (`hasContext` discriminator — the enum-level mirror of the split)"
- IdentityController.md says (cross-batch confirmation): "`IdentityServiceImpl.whoami` zips `getNonContextualPermissionsForCurrentUser` into the response (`IdentityServiceImpl.java:37-43`)"

**Existing ADR**: composes with ADR-CANDIDATE-051 (`PolicyTypeDto.hasContext` discriminator — the enum-level mirror of THIS read-surface split; the discriminator IS the load-bearing primitive making the split implementable). Composes with ADR-CANDIDATE-003 (read-collaborative GET — both paths are read-collaborative; the architectural commitment is that "what can I do?" reveals only what the policy graph already grants the caller).

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-609 NEW (PermissionController has no @Slf4j / Logger — privilege-enumeration surface silent)
- REFACTOR-610 NEW (PermissionController `IllegalArgumentException` on missing extractor → catch-all advice → HTTP 500 not 400)
- REFACTOR-194 STRENGTHENED (LOOKUP_TABLE documented as a permission category but NOT a PermissionResourceType — the same split-shaped doc-vs-code drift; lookup-table permissions live in the MANAGEMENT global bucket, unreachable through THIS controller)

**Proposed action**: Promote to `adrs/drafts/permission-read-surface-split.md` (new ADR). Document the three-layer mirror (enum / SPI / delivery path) + the file-naming-vs-surface gap + the UI consumer chain (`WithPermissionsProvider` unions both paths). Cross-link with ADR-CANDIDATE-051 as the enum-level primitive. Doc-side: the live `/authorization` page should explicitly enumerate the split — "MANAGEMENT permissions arrive via /api/identity/whoami's response.identity.permissions; DATA_ENTITY/TERM/QUERY_EXAMPLE permissions arrive via /api/resource/{type}/{id}/permissions". Maintainer triage: the borderline confidence (MEDIUM on intentionality) means the ADR draft should explicitly invite review by the original maintainer to confirm the split was deliberate vs an incomplete refactor.

**Severity rationale**: MEDIUM — architectural-comprehension shape affecting every UI permission gate consumer chain. A future maintainer adding a permission category (e.g., the documented-but-unimplemented `LOOKUP_TABLE`) will hit this ADR's decision point: does the new category get a contextual extractor + this controller, or a non-contextual extractor + the Identity payload, or both? Without the ADR, the decision is made silently per-PR.

## STRENGTHENS — none (initial entry)

This is the primary source. The decision is anchored at the single-sidecar level but the three-layer mirror (enum / SPI / delivery) cross-validates the architectural split.

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-051 (`PolicyTypeDto.hasContext` discriminator — the enum-level mirror); ADR-CANDIDATE-003 (read-collaborative GET — both paths share the posture).
- SUPERSEDES: none.
- CONFLICTS: none.
