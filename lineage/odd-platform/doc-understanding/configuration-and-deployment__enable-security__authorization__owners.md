---
doc_page: "docs/configuration-and-deployment/enable-security/authorization/owners.md"
page_title: "Owners"
live_url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/owners"
live_url_verified_status: "200"
live_url_resolved_slug: "configuration-and-deployment/enable-security/authorization/owners"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "Owner (Authorization directory entry)"
    - "User-Owner Mapping"
    - "Create Owner"
    - "Bind Owner to Data Entity (with optional DEG propagation)"
    - "No-audit-log on RBAC mutations"
    - "Read-collaborative cross-owner enumeration"
    - "Permission-bypass via Owner auto-create (side-door write path)"
    - "DIRECT_OWNER_SYNC + OwnerService.getOrCreate composition — privilege-escalation chain (mint-Owner + self-bind in one transaction, no OWNER_CREATE required)"
  features:
    - "F-019"
    - "F-075"
  code_nodes:
    - "odd-platform java OwnerController controller-method:createOwner"
    - "odd-platform java OwnerController controller-method:updateOwner"
    - "odd-platform java OwnerController controller-method:deleteOwner"
audience: [operator, developer]
doc_claim_vs_code:
  - "Page caveat #3 (lines 79-80) writes the two ownership side-door endpoints as PLURAL `POST /api/dataentities/{id}/ownerships` and `POST /api/terms/{id}/ownerships`; the canonical OpenAPI spec defines both as SINGULAR — `POST /api/dataentities/{data_entity_id}/ownership` (operationId createOwnership) and `POST /api/terms/{term_id}/ownership` (operationId createTermOwnership). Evidence: odd-platform-specification/openapi.yaml:1107 + openapi.yaml:3124. A direct-API operator copying these paths verbatim hits 404. DOC-GAP candidate (factual path error, copy-paste-fatal for the exact 'authoring deployment-time scripts' audience the page names)."
  - "Page §'How Owners are created' (line 25) states the operator-curated path is `POST /api/owners` and the UI Create-owner affordance; CONFIRMED gated by OWNER_CREATE via SecurityConstants.SECURITY_RULES (SecurityConstants.java:143) — evidence node odd-platform java OwnerController controller-method:createOwner. No drift; recorded as a confirmed binding."
  - "Page caveat #2 claims `GET /api/owners` has no permission gate (no OWNER_READ) and any authenticated user enumerates the directory, anonymous under DISABLED. CONFIRMED: the OwnersList read surface has NO SecurityRule entry; reads fall through to pathMatchers('/**').authenticated() (OAUTH2/LDAP) and to permitAll under DISABLED — evidence concept invariant:read-collaborative-cross-owner-enumeration (batch 2026-05-20-Q: 'GET /api/owners has NO SecurityRule entry') + invariant:rbac-read-endpoints-no-securityrule-authenticated-only-fall-through + concept SecurityConstants centralised-SECURITY_RULES ADR (concepts.yaml:3842, LOGIN_FORM/DISABLED inert-table precondition). No drift."
  - "Page caveat #4 claims `PUT /api/owners/{id}` with empty/absent `roles` destroys all role bindings via deleteOwnerRelationsExcept(ownerId, []). CONFIRMED to the line: OwnerServiceImpl.update step (4) is `ownerToRoleRepository.deleteOwnerRelationsExcept(ownerId, newRoles).then(createRelations(ownerId, newRoles))` at OwnerServiceImpl.java:76-81; OwnerFormData.roles is @NotRequired (OwnerFormData.java:86 / components.yaml:414-424) while name is @NotNull — evidence node odd-platform java OwnerController controller-method:updateOwner. No drift; the danger admonition is accurate."
  - "Page caveat #1 + 'Owner names accumulate' claim soft-delete + partial-unique-index allows a deleted Owner name to be re-used by a new row and there is no platform audit of Owner CRUD. CONFIRMED: partial unique index `owner_name_unique ON owner(name) WHERE deleted_at IS NULL` at V0_0_64__remove_is_deleted_field.sql:70; owner row soft-deleted (deleted_at) while owner_to_role bindings hard-deleted via deleteOwnerRelationsExcept(id, List.of()) — evidence node odd-platform java OwnerController controller-method:deleteOwner. No @ActivityLog on createOwner/updateOwner/deleteOwner — evidence concept invariant:no-audit-log-on-rbac-mutations + F-019 'six-sidecar audit-silence'. No drift."
  - "Minor: page caveat #1 states the activity table requires a `data_entity_id` FK on every row, which is why Owner CRUD (no data-entity context) cannot emit to the existing Activity stream. The audit-silence + activity-table-requires-data_entity_id rationale is corroborated at the concept tier (no-audit-log-on-rbac-mutations 'batch R SCHEMA-ROOTED root cause'), but the exact NOT-NULL data_entity_id column constraint on the `activity` table was NOT independently re-confirmed against the migration SQL in this pass. NOT VERIFIED to schema line → if precision is wanted, confirm against the activity-table migration; logged here so the maintainer can spot-check rather than assume."
maintainer_curated: false
---

# Owners — doc understanding

This page is the operator/developer reference for the **Owner** model — the catalog-side data-steward directory entry that is decoupled from the authenticated principal. It maps to the canonical concept "Owner (Authorization directory entry)" (an `owner`-table row, name + soft-delete `deleted_at`, identity-decoupled from the signed-in user, which binds through "User-Owner Mapping") and to feature F-019 "Owner Lifecycle Management" — the `createOwner` / `updateOwner` / `deleteOwner` trinity on `OwnerController` gated by `OWNER_CREATE` / `OWNER_UPDATE` / `OWNER_DELETE` (confirmed nodes `OwnerController controller-method:{createOwner,updateOwner,deleteOwner}`). The user-side write-paths it cross-references (self-service widget, `DIRECT_OWNER_SYNC` auto-approve) are feature F-075 "User-Owner Association".

The page's four "Lifecycle and known caveats" are the high-value content and each is confirmed against primary-source code: caveat #1 (no Activity-Feed event on Owner CRUD; soft-delete + `owner_name_unique ON owner(name) WHERE deleted_at IS NULL` name-reuse — `V0_0_64__remove_is_deleted_field.sql:70`, concept `no-audit-log-on-rbac-mutations`); caveat #2 (`GET /api/owners` ungated, any authenticated user enumerates — concept `read-collaborative-cross-owner-enumeration`, batch-Q "GET /api/owners has NO SecurityRule entry"); caveat #3 (three service-tier side-doors mint Owner rows via `OwnerService.getOrCreate` at `OwnerServiceImpl.java:39-42` without `OWNER_CREATE` — concept `permission-bypass-via-owner-auto-create-side-door-write-path`); caveat #4 (empty/absent `roles` on PUT destroys all role bindings — `OwnerServiceImpl.update` lines 76-81, `OwnerFormData.roles` @NotRequired). The danger admonition on caveat #4 is line-accurate.

One factual drift was found: caveat #3 spells the two ownership side-door endpoints in the **plural** (`.../ownerships`), but the canonical OpenAPI spec defines them in the **singular** (`POST /api/dataentities/{data_entity_id}/ownership`, `POST /api/terms/{term_id}/ownership` — `openapi.yaml:1107` / `:3124`). Because the page explicitly addresses operators "authoring deployment-time scripts," the wrong path is copy-paste-fatal (404) and is logged as the lead DOC-GAP candidate above.

## Maintainer notes
