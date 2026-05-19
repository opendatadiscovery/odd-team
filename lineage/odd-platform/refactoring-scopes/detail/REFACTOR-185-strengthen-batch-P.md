## REFACTOR-185 — STRENGTHENED BATCH P — DISABLED-mode bypass now 17 + 18-sidecar (updateOwner + deleteOwner add the OWNER mutation surface)

**Severity unchanged**: HIGH
**Updated support count**: now **17 + 18-sidecar triangulated** (16 prior at batch O + 17 batch P updateOwner + 18 batch P deleteOwner)
**Batch**: P (2026-05-20)

**New surfaced_by**:
1. `OwnerController__controller-method__updateOwner.md:bugs_limitations_corner_cases.[6]` (LOW) + `:security.known_security_gaps.[4]` (LOW) — "Under `auth.type=DISABLED`, PUT /api/owners/{owner_id} is anonymously reachable — the SecurityRule for `OWNER_UPDATE` (`SecurityConstants.java:144-145`) remains in the rules list but the DISABLED authentication mode bypasses the WebFlux security filter chain (`DisabledAuthSecurityConfiguration.java:11-19` per the batch-C / batch-O REFACTOR-185 enumeration). Anonymous renaming of any Owner is then unbounded; combined with the no-audit-log gap, the directory can be silently rewritten by any caller on a network-reachable port. Cross-link: REFACTOR-185 (the 16-sidecar triangulation; this is the 17th surface)."
2. `OwnerController__controller-method__deleteOwner.md:security.known_security_gaps.[3]` (MEDIUM — elevated above batch-N's MEDIUM-baseline because deletion is destructive vs createOwner's benign anonymous create) — "Under `auth.type=DISABLED`, `DELETE /api/owners/{owner_id}` is anonymously reachable — the SecurityRule remains in the rules list but the WebFlux filter chain doesn't run. Anonymous owner deletion is then unbounded; combined with the absence of an audit log and the role-binding hard-delete, an attacker can permanently delete privileged owner directory entries with no trace. **MIRRORS createOwner sidecar known_security_gaps[3] — same DISABLED-bypass class on a destructive verb (createOwner side is comparatively benign).**"

**Updated full triangulation enumeration (now 18 sidecars)**:
- Batch B: AppInfoController, AuthorizationManagerCondition, IngestionDataEntitiesFilter (config-key-consumer-axis) (3 sidecars)
- Batch C: DisabledAuthSecurityConfiguration (1 sidecar)
- Batch E: OwnerController.createOwner, PolicyController.createPolicy, RoleController.createRole, PermissionController.getResourcePermissions (4 sidecars)
- Batch F: DataEntityController.createOwnership, DataEntityController.updateStatus, DataEntityController.getDataEntityDetails (3 sidecars — centerpiece write paths + centerpiece read)
- Batch M: SearchController.facets (1 sidecar — search-facets reachability + bearer-token-shaped session UUIDs combine into catalog enumeration vector)
- Batch M: getDataEntityGroupsLineage (1 sidecar — DEG-lineage anonymous reach)
- Batch M: getMyObjectsWithUpstream + getMyObjectsWithDownstream (2 sidecars — latent regression vector if owner-default added under DISABLED)
- Batch O: IngestionDataEntitiesFilter class-level layer (1 sidecar — confirms the SIXTEENTH facet)
- **NEW Batch P: OwnerController.updateOwner + OwnerController.deleteOwner (2 sidecars)** — the **17th and 18th** facets, covering OWNER directory MUTATION at the full CRUD level

**Cross-batch picture — the OWNER directory MUTATION surface is now COMPLETELY UNAUTHENTICATED under default deployment**:
- `POST /api/owners` (create) — anonymously reachable (batch E createOwner)
- `PUT /api/owners/{owner_id}` (rename + role-rebind) — anonymously reachable (NEW batch P updateOwner)
- `DELETE /api/owners/{owner_id}` (soft-delete + hard-delete OWNER_TO_ROLE) — anonymously reachable (NEW batch P deleteOwner)

Combined with REFACTOR-426 (no audit on Owner mutations) + REFACTOR-425 (destructive-empty role-rebind), the DISABLED-mode default deployment exposes the platform's privileged Owner-directory mutation surface to anonymous callers with FORENSICALLY-SILENT mutation capability. An attacker with network reach can: create an Owner, rename it, attach roles via the role-rebind, then delete the original Owner — all without leaving any audit trace.

**Triangulation count**: 18 sidecars. The strongest single finding in the catalog by a significant and growing margin.

**Severity unchanged at HIGH**: the deployment-default risk is unchanged. The maintainer's prescription (boot-time validator per REFACTOR-073) remains the highest-leverage cross-cutting fix.

---
