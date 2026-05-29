---
doc_page: "docs/configuration-and-deployment/enable-security/authorization/README.md"
page_title: "Authorization"
live_url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization"
live_url_verified_status: "200"
live_url_resolved_slug: "configuration-and-deployment/enable-security/authorization"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "Policy (Authorization)"
    - "Role (Authorization)"
    - "Owner (Authorization directory entry)"
    - "Permission (Authorization)"
    - "User-Owner Mapping"
  features:
    - "F-075"   # User-Owner Association (DIRECT_OWNER_SYNC auto-approve branch = README fact #3)
    - "F-142"   # User-Owner Association Request Workflow (README "user self-request" write-path)
    - "F-172"   # Admin Direct-Bind (README "admin direct-bind" write-path)
    - "F-207"   # RBAC frontend HIDE-not-disable HOCs (README "How the UI surfaces missing permissions")
    - "F-006"   # RBAC policy lifecycle — soft-delete with permission-grant persistence
  code_nodes:
    - "odd-platform java PolicyController controller-method:createPolicy"
    - "odd-platform java RoleController controller-method:createRole"
    - "odd-platform java OwnerController controller-method:createOwner"
    - "odd-platform java PermissionController controller-method:getResourcePermissions"
    - "odd-platform java CollectorController controller-method:regenerateCollectorToken"
audience: [operator]
doc_claim_vs_code:
  - "README fact #3 (DIRECT_OWNER_SYNC mints a new Owner + self-binds in one POST, bypassing request-then-approve) is CONFIRMED by code, and this README surfaces it correctly — but the leaf page it should also live on omits it: F-075 understanding records Branch B (DIRECT_OWNER_SYNC auto-approve composing with OwnerService.getOrCreate self-mint-then-self-bind) is 'UNDOCUMENTED on the live /user-owner-association page'. Cross-page consistency gap: the README carries the caveat; the user-owner-association.md leaf does not. Evidence: Feature F-075; OwnerAssociationRequestServiceImpl.java:52-76."
maintainer_curated: false
---

# Authorization — doc understanding

This section-root README is the operator's mental-model hub for ODD Platform's RBAC: a fixed permission catalogue (`Permission (Authorization)`), bundles of permissions into Roles (`Role (Authorization)`), conditional grants via Policies (`Policy (Authorization)`), the catalog-side identity an authenticated user binds to (`Owner (Authorization directory entry)`), and the user↔owner bridge (`User-Owner Mapping`). It defers the deep dives to five sibling leaf pages (permissions / roles / policies / owners / user-owner-association) and frames the user-identity-vs-owner-identity split as the spine of the whole section. All five concept names are confirmed verbatim in `concepts.yaml`; all binding claims below are graph-node-confirmed.

The README's three "load-bearing operator-trust facts" each trace to enriched code:

* **Read access on Management catalogs is collaborative.** CONFIRMED: `PermissionController.getResourcePermissions` (`PermissionController.java:14-26`) carries no `@PreAuthorize`; `SecurityConstants.SECURITY_RULES` has no entry for the resource-permissions GET, so it falls through to `pathMatchers('/**').authenticated()` — authentication required, read-side authorization not enforced (intentional read-collaborative posture). Corroborated by the catalog's "Read-collaborative cross-owner enumeration" invariant.
* **Token rotation is immediate.** CONFIRMED verbatim: `CollectorController.regenerateCollectorToken` (`CollectorController.java:47`) does an in-place UPDATE of the existing `TOKEN` row — "there is no rotation-grace window, no old/new pair, and no separate token-revocation step." Gated by `COLLECTOR_TOKEN_REGENERATE` (MANAGEMENT tier).
* **`DIRECT_OWNER_SYNC` self-mints + self-binds.** CONFIRMED via Feature F-075 (Branch B auto-approve composing with `OwnerService.getOrCreate`) + the catalog's "Permission-bypass via Owner auto-create" invariant. `OwnerController.createOwner` understanding independently confirms the normal path requires a SEPARATE `POST /api/owner_association_request` step (`OwnerAssociationRequestServiceImpl.java:52-76`), which the side-door bypasses.

The "How the UI surfaces missing permissions" (hide-not-disable) section is exactly Feature **F-207** — the `WithPermissions`/`WithPermissionsProvider` HOCs that remove forbidden controls from the DOM; the UI drives them off the authoritative `getResourcePermissions` response (confirmed in that node's understanding: "the UI uses the response to enable/disable buttons; mutations are separately enforced server-side"). The three user-owner write-paths the README enumerates map to F-142 (user self-request), F-075 Branch B (`DIRECT_OWNER_SYNC` auto-approve), and F-172 (admin direct-bind). Policy/Role structure maps to `PolicyController.createPolicy` (JSON-schema-validated `statements`, `POLICY_CREATE` MANAGEMENT gate) and `RoleController.createRole`.

Live verification: `LIVE_URL_GUESS` (`.../authorization/readme`) is the mechanical guess; the real GitBook slug drops `/readme` and serves the section root at `/configuration-and-deployment/enable-security/authorization` (200, sampled anchors `three-load-bearing-operator-trust-facts` and `how-the-ui-surfaces-missing-permissions` present).

## Maintainer notes
- Substrate-coverage gap (not page drift): the `OwnerAssociationRequestController` controller-method nodes (`createOwnerAssociationRequest`, `updateOwnerAssociationRequest`) are mechanical-descriptor stubs with `enrichment_status: None`. The README's DIRECT_OWNER_SYNC fact is confirmed via Feature F-075 + the concept-catalog invariant rather than via an enriched controller-method sidecar; enriching those two methods would give this README a direct code_nodes anchor for the association write-paths.
- The doc_claim_vs_code entry is a cross-PAGE consistency finding (README carries the DIRECT_OWNER_SYNC caveat; the user-owner-association.md leaf does not per F-075) — a doc-gaps candidate, NOT a defect on this README.
