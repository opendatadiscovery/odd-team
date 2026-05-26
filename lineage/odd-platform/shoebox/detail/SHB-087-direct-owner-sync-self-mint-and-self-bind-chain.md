# SHB-087 — DIRECT_OWNER_SYNC + getOrCreate compose into a self-mint-then-self-bind privilege escalation chain

**Category**: open
**Severity**: HIGH

## Hypothesis

A user holding `DIRECT_OWNER_SYNC` (a MANAGEMENT permission per `PolicyPermissionDto.java:70`) can: (1) submit `POST /api/owner_association_request` with a never-seen `ownerName` of their choice; (2) `OwnerAssociationRequestServiceImpl.createOwnerAssociationRequest` mints the new Owner via `ownerService.getOrCreate(ownerName)` (SHB-084 side-door — no `OWNER_CREATE` consulted); (3) detects `DIRECT_OWNER_SYNC` in the current user's permissions and AUTO-APPROVES the request synchronously (no Admin gate); (4) creates the `USER_OWNER_MAPPING` row binding the requesting user to the newly-minted Owner. End state: the user is now bound to an Owner they just created, and any subsequent permission grants on `dataEntity:owner == 'their-new-owner'` apply to them.

## Evidence

- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/OwnerAssociationRequestServiceImpl.java:55-67` — `createOwnerAssociationRequest`: `authIdentityProvider.getCurrentUser()` → `ownerService.getOrCreate(ownerName)` (line 57) → `permissionService.getNonContextualPermissionsForCurrentUser(MANAGEMENT)` (line 60-63) → `if (permissions.contains(Permission.DIRECT_OWNER_SYNC)) mapToApprovedRequest(...) else PENDING` (lines 64-67).
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/OwnerServiceImpl.java:38-42` — `getOrCreate` impl: no permission check.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/dto/PolicyPermissionDto.java:70` — `DIRECT_OWNER_SYNC(MANAGEMENT)` — the only MANAGEMENT permission that auto-approves an OPERATION rather than gating one.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/util/SecurityConstants.java:148-162` — `POST /api/owner_association_request` has NO SecurityRule entry; reachable by any authenticated user (the DIRECT_OWNER_SYNC check is in-service, not at the SecurityRule layer).
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/OwnerAssociationRequestServiceImpl.java:184-190` — on approval, creates the `USER_OWNER_MAPPING` row via `userOwnerMappingService.createRelation(...)`.
- Live `/configuration-and-deployment/enable-security/authorization/user-owner-association` doc (WebFetched 2026-05-20, status 200) — describes only the two-step SELF-request + Admin-approve flow; makes NO mention of DIRECT_OWNER_SYNC auto-approve.
- Live `/permissions` doc — names `DIRECT_OWNER_SYNC: Allows associating a user with an owner without an approval request` — does not warn that this composes with the OwnerService.getOrCreate side-door to enable self-mint.

## Notes

- This is the explicit operator-relevant security chain composed across SHB-084 + the auto-approve branch. The new Owner row inherits NO roles by default (so the user doesn't immediately escalate to admin), but ANY policy condition like `dataEntity:owner == 'X'` becomes attacker-controllable for the new Owner name X.
- The intent of DIRECT_OWNER_SYNC (per the comment-less branch) is "for OIDC-group-mapped users where the IdP authoritatively binds users to owners." The implementation does NOT verify the OIDC group mapping; the permission alone is sufficient.
- The OpenAPI-generated permission editor in the UI likely allows operators to grant `DIRECT_OWNER_SYNC` directly to ad-hoc Policies without warning them about this composition.
- Mitigation: a `getOrCreate` permission gate (per SHB-084) would close half the chain by preventing the mint; OR DIRECT_OWNER_SYNC could be restricted to ONLY existing Owners (reject if owner-name is novel); OR could require an additional `OWNER_CREATE_FROM_ASSOCIATION_REQUEST` permission.
- The activity-trail does capture this (the `owner_association_request_activity` table receives `REQUEST_APPROVED` with `isManual=false`), so forensically the chain is recoverable — but the mint itself is audit-silent (no `@ActivityLog` on `OwnerServiceImpl.getOrCreate`).

## Next

1. **PROMOTE** to feature: `F-NNN — User-Owner Association DIRECT_OWNER_SYNC auto-approve flow` with explicit anchoring of the self-mint-and-self-bind composition as a security-relevant facet. Pillar: P-09.
2. **REFACTOR-NNN**: either (a) add an existence-check guard in `OwnerAssociationRequestServiceImpl.java:57` that REJECTS the request if `ownerService.getOrCreate` would mint (require pre-existing Owner for DIRECT_OWNER_SYNC users); OR (b) require a second permission for the mint path; OR (c) add `@ActivityLog` on the mint so at least the audit trail is complete.
3. **DOC-NNN**: rewrite the live `/user-owner-association` page to document the DIRECT_OWNER_SYNC auto-approve flow + the self-mint-and-self-bind composition + the OIDC-group-mapped use case the permission was designed for.
4. **SEC-NNN**: dedicated backlog item with the chain as a chained-CVE-style finding.

## Links

- cluster_with: [SHB-084, F-019, F-011]
- merged_into: (open)
- supersedes: []
