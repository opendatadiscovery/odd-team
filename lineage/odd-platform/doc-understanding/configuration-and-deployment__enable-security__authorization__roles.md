---
doc_page: "docs/configuration-and-deployment/enable-security/authorization/roles.md"
page_title: "Roles"
live_url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/roles"
live_url_verified_status: "200"
live_url_resolved_slug: "configuration-and-deployment/enable-security/authorization/roles"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "Role (Authorization)"
    - "Owner (Authorization directory entry)"
    - "User-Owner Mapping"
    - "Permission (Authorization)"
    - "Create Role"
  features:
    - "F-124"   # User roles section: per-provider ADMIN/USER assignment at sign-in
    - "F-019"   # Owner roles: operator-curated bundles + role-to-Owner attachment (Management -> Owners/Roles)
    - "F-172"   # Setting up an initial admin: the "Create association" admin-direct-bind path the page recommends
  code_nodes:
    - "odd-platform java RoleController controller-method:createRole"   # ROLE_CREATE gate (page para "Attaching a Role to an Owner")
    - "odd-platform java RoleController controller-method:updateRole"   # ROLE_UPDATE gate
    - "odd-platform java RoleController controller-method:deleteRole"   # ROLE_DELETE gate
    - "odd-platform java OwnerController controller-method:updateOwner" # OWNER_UPDATE gate: the role-attachment write to the Owner entity
audience: [operator]
doc_claim_vs_code:
  - "Page claims the Owner-role override is UNCONDITIONAL — 'A user who signed in as ADMIN and then binds to an Owner ... loses the ADMIN privilege' (roles.md:28) and 'trying to rely on the user's sign-in ADMIN authority does not work once the user binds to any Owner that lacks ADMIN' (roles.md:36). Code makes the override CONDITIONAL on the Owner-attached role set being NON-EMPTY: RoleServiceImpl.getCurrentUserRoles() (RoleServiceImpl.java:94-101) resolves owner-attached roles via userOwnerMappingRepository.getUserRolesByOwner (5-table JOIN, ReactiveUserOwnerMappingRepositoryImpl.java:99-114) and only on an EMPTY result does .filter(isNotEmpty).switchIfEmpty(getUserProviderRole()) (RoleServiceImpl.java:98-99) FALL BACK to the auth-mode (User) role. A user bound to an Owner that carries ZERO roles therefore does NOT lose the auth-chain ADMIN — they retain it via the fallback. The page's blanket 'binds to an Owner -> loses ADMIN' omits the empty-owner-roles case. Evidence: operation:get-current-user-roles-authorization-hot-path-service-tier; RoleServiceImpl.java:94-101; corroborated by TEST-GAP-559 ('getUserRolesByOwner with no USER_OWNER_MAPPING row ... returns Mono.just(List.of()) ... Critical for the AUTHORIZATION HOT PATH')."
  - "Page does not mention that the precedence/permission resolution it describes is silently bypassed under auth.type=DISABLED: AuthIdentityProvider returns a synthesised anonymous-admin mapping to UserProviderRole.ADMIN -> roleRepository.getByName('Administrator'), so every authorized callsite runs with full ADMIN regardless of any Owner-role binding. Evidence: operation:get-current-user-roles-authorization-hot-path-service-tier (DISABLED-mode behaviour clause); the same DISABLED-gate-skip is recorded on odd-platform java RoleController controller-method:createRole (dependencies_semantic.requires-feature). Operator-relevant because the page's 'set up an initial admin' workflow presumes an active auth mode where the gate fires."
maintainer_curated: false
---

# Roles — doc understanding

This operator page defines a **Role** as a named permission bundle and draws the platform's
central authorization distinction: **User roles** (`ADMIN` / `USER`, derived from the auth
chain at sign-in) versus **Owner roles** (operator-curated bundles attached to Owner entities),
plus the precedence rule that Owner roles win once a user is bound to an Owner. It maps cleanly
to the concept `Role (Authorization)` (whose own canonical doc anchor is this very page) and to
the Owner / User-Owner Mapping / Permission concepts. The User-roles narrative is the
operator-facing surface of feature F-124 (six per-provider ADMIN-detection mechanisms); the
Owner-role authoring + attachment surface is F-019 (Owner Lifecycle, `OwnerController.updateOwner`,
OWNER_UPDATE-gated); and the recommended initial-admin path ("Create association" on
Management → Associations) is F-172. The page's permission-gate claims are accurate against code:
`ROLE_CREATE`/`ROLE_UPDATE`/`ROLE_DELETE` gate role-bundle authoring on `RoleController`
(SecurityConstants.java:169-173, confirmed on the createRole code node) and `OWNER_UPDATE` gates
the role-attachment write (SecurityConstants.java:144-145, confirmed on `updateOwner`).

The load-bearing drift is in the **precedence** section: the page states the Owner-role override
unconditionally, but the resolver (`RoleServiceImpl.getCurrentUserRoles`, RoleServiceImpl.java:94-101)
falls back to the auth-mode User role when the bound Owner carries **no** roles — so an
ADMIN-signed-in user bound to a zero-role Owner keeps ADMIN. See `doc_claim_vs_code`.

## Maintainer notes
