---
doc_page: "docs/configuration-and-deployment/enable-security/authorization/permissions.md"
page_title: "Permissions"
live_url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions"
live_url_verified_status: "200"
live_url_resolved_slug: "configuration-and-deployment/enable-security/authorization/permissions"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "Permission (Authorization)"
    - "PermissionController accepts MANAGEMENT as enum value but rejects at runtime (USR001 400)"
    - "Cross-controller permission split — QueryExample owns _CREATE/_UPDATE/_DELETE, DataEntity owns _DATASET_*, Term owns _TERM_* link permissions (pattern invariant from batch V)"
    - "RBAC read endpoints (Role/Policy/Permission/Policy-Schema lists) have NO SecurityRule — any authenticated user reads"
    - "DatasetController per-entity-scoping BYPASS — data_entity_id URL parameter NOT enforced at SQL on by-version + diff endpoints (HIGH severity, batch W primary source)"
    - "Query Resource Permissions"
  features:
    - "F-006"
    - "F-207"
  code_nodes:
    - "odd-platform java PermissionController controller-method:getResourcePermissions"
    - "odd-platform java IdentityController controller-method:whoami"
    - "odd-platform openapi tags openapi-tag:permission"
audience: [operator, developer]
doc_claim_vs_code:
  - "ALIGNED — page claims the permission list is 'generated from the Permission enum in odd-platform-specification/components.yaml'; the canonical Permission enum is at components.yaml:158 (DATA_ENTITY_ADD_TERM:172, LOOKUP_TABLE_CREATE:194, NAMESPACE_CREATE:218, ALL:3162), ~75 entries matching the page's 5 categories + ALL. The doc's external link target and filename are correct — evidence: odd-platform-specification/components.yaml:158 / odd-platform openapi tags openapi-tag:permission."
  - "ALIGNED — page's 'PermissionResourceType is a valid spec enum value but the runtime rejects it on the contextual endpoint' (HTTP 400 USR001, 'Resource type MANAGEMENT does not have context') is exact. PermissionResourceType is 4 values at components.yaml:3381; the runtime throw is PermissionServiceImpl.java:25-27 guarded by PolicyTypeDto.java:12 (MANAGEMENT hasContext=false) — evidence: invariant:permission-controller-management-rejection-asymmetric-enum-vs-runtime + odd-platform java PermissionController controller-method:getResourcePermissions (concepts/invariants section)."
  - "ALIGNED — page's 'Five categories versus four resource types' framing matches the code: Permission enum spans 5 doc categories but PermissionResourceType exposes 4 contextual values, with LOOKUP_TABLE_* resolved on the management/whoami surface rather than a LOOKUP_TABLE resource type — evidence: components.yaml:3381 (4 values) + odd-platform java PermissionController controller-method:getResourcePermissions (PermissionResourceType maps 1-1 to PolicyTypeDto)."
  - "ALIGNED — page's two-endpoint read-surface table (contextual GET /api/resource/{type}/{id}/permissions vs non-contextual GET /api/identity/whoami → Identity.permissions) is structurally confirmed; getResourcePermissions delegates to permissionService.getResourcePermissionsForCurrentUser and is described as the read-side dual of mutation enforcement — evidence: odd-platform java PermissionController controller-method:getResourcePermissions (PermissionController.java:19-26) + odd-platform java IdentityController controller-method:whoami (IdentityController.java:23)."
  - "ALIGNED — page's 'Read access on Management catalogs is granted to every authenticated user by design' warning (GET /api/owners, /namespaces, /datasources, /collectors, /policies fall through to any-authenticated) is corroborated by the no-SecurityRule fall-through invariant — evidence: invariant:rbac-read-endpoints-no-securityrule-authenticated-only-fall-through (RBAC read endpoints have NO SECURITY_RULES entry, fall through to pathMatchers('/**').authenticated())."
  - "ALIGNED — page's 'Surfaces without per-resource permission gating today' section (GET /api/datasets/{data_entity_id}/structure[/{version_id}|/diff] — data_entity_id consumed by the controller but not used by the underlying query) matches the HIGH-severity bypass invariant: data_entity_id is used ONLY in the NotFoundException message text, not in the SQL filter — evidence: invariant:datasetcontroller-per-entity-scoping-bypass-data-entity-id-not-enforced-at-sql-batch-w (DatasetVersionServiceImpl.java:42-43)."
  - "NAMING NOTE (not drift) — the page links to the spec 'Permission enum' (correct canonical name in components.yaml:158). The internal Java enum is PolicyPermissionDto; the OpenAPI-generated client enum is Permission and mirrors PolicyPermissionDto by name. Both names are correct in their own layer; the doc page correctly references the spec-side Permission enum — evidence: entitie:permission-authorization ('the Permission OpenAPI-generated enum mirrors PolicyPermissionDto by name') + odd-platform java PermissionController controller-method:getResourcePermissions (sources: AbstractContextualPermissionExtractor.java:33 'Permission.fromValue(p.name())')."
maintainer_curated: false
---

# Permissions — doc understanding

This page is the operator-and-integrator reference for ODD Platform's authorization vocabulary: it enumerates the full `Permission` set (~75 keys) across five operator-readable categories — Data entity / Term / Query Example / Lookup table / Management — and is generated from the canonical `Permission` enum in `odd-platform-specification/components.yaml:158` (confirmed: `DATA_ENTITY_ADD_TERM:172`, `LOOKUP_TABLE_CREATE:194`, `NAMESPACE_CREATE:218`, `ALL:3162`). Each key's operator caveat (write-collaborative DEG membership, custom-metadata catalogue side-channel, stored-XSS Markdown surfaces, tag-directory minting, namespace auto-create side-doors, destructive PUT-empty-roles, token-regeneration no-grace) is documented inline as the operator-trust framing the LSN-001/LSN-002 class exists to capture.

The page binds to the read-side of the policy graph via two confirmed controller endpoints: `getResourcePermissions` (`GET /api/resource/{type}/{id}/permissions`, contextual) and `whoami` (`GET /api/identity/whoami`, management-scope) — the two scopes the page's orchestration table calls out as orthogonal (`odd-platform java PermissionController controller-method:getResourcePermissions`). Its three code-grounded caveat sections are each backed by a confirmed invariant: the `MANAGEMENT`-rejection asymmetry (`PermissionServiceImpl.java:25-27` + `PolicyTypeDto.java:12`), the read-collaborative Management-catalog posture (no-SecurityRule fall-through invariant), and the dataset-structure-read per-entity-scoping bypass (`DatasetVersionServiceImpl.java:42-43`, HIGH severity). The page is exceptionally well-aligned with code — every audited claim is a confirmation, not a contradiction; the only nuance is the `Permission` (spec) vs `PolicyPermissionDto` (internal Java) enum naming, which the page references correctly at the spec layer.

## Maintainer notes
