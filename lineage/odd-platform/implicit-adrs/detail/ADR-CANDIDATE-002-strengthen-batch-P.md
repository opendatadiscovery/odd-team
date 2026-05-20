## ADR-CANDIDATE-002 — STRENGTHENED BATCH P — Centralised endpoint authorization via `SecurityConstants.SECURITY_RULES` now 19-sidecar (updateOwner + deleteOwner added)

**Severity unchanged**: HIGH
**Updated support count**: now **19-sidecar triangulated** (17 prior in batch N → +2 batch P controller-method primary sources)
**Batch**: P (2026-05-20)

**New surfaced_by**:
- `OwnerController__controller-method__updateOwner.md:implicit_adrs.[0]` (HIGH) — "Centralised endpoint authorization via `SecurityConstants.SECURITY_RULES` — the controller carries no `@PreAuthorize`; PUT /api/owners/{owner_id} is registered with `OWNER_UPDATE` (`SecurityConstants.java:144-145`)" — intent_anchor: "new SecurityRule(NO_CONTEXT, new PathPatternParserServerWebExchangeMatcher(\"/api/owners/{owner_id}\", PUT), OWNER_UPDATE)" (`SecurityConstants.java:144-145`)
- `OwnerController__controller-method__deleteOwner.md:implicit_adrs.[3]` (HIGH) — "Centralised endpoint authorization via `SecurityConstants.SECURITY_RULES` — controllers carry no `@PreAuthorize`; protected endpoints are declared as `SecurityRule` entries. `DELETE /api/owners/{owner_id}` IS registered with `OWNER_DELETE` (`SecurityConstants.java:146-147`)" — intent_anchor: "new SecurityRule(NO_CONTEXT, new PathPatternParserServerWebExchangeMatcher(\"/api/owners/{owner_id}\", DELETE), OWNER_DELETE)"

**Cross-batch insight**: The full CRUD on `/api/owners` is now triangulated end-to-end at the SECURITY_RULES table:
- `createOwner` (batch E, OWNER_CREATE at line 143)
- `updateOwner` (batch P, OWNER_UPDATE at lines 144-145)
- `deleteOwner` (batch P, OWNER_DELETE at lines 146-147)

All three writes are NO_CONTEXT (global management permissions, NOT per-Owner scoping); all three controller methods carry no `@PreAuthorize`. The pattern is now complete for the Owner directory CRUD.

**Cross-reference**: The full SECURITY_RULES triangulation by batch:
- Batches A-D: AlertController + AlertManagerController class-level + DataEntityAttachmentController + DataCollaborationController + GenAIController (5 controller class-level sidecars)
- Batch E: SearchController + RoleController + PolicyController + OwnerController.createOwner + PermissionController (5)
- Batch F: DataEntityController.createOwnership + .updateStatus + .getDataEntityDetails + .getDataEntityDownstreamLineage + IngestionController.postDataEntityList (5)
- Batch G-N: various controller-method strengthens (totaling 2 more)
- **Batch P: OwnerController.updateOwner + OwnerController.deleteOwner (2 NEW)** — completing the Owner directory CRUD coverage

**Severity unchanged at HIGH**.

---
