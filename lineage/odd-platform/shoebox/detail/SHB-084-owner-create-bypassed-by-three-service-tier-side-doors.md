# SHB-084 — Owner directory mintable from 3 service-tier side-doors, bypassing OWNER_CREATE permission

**Category**: merged
**Severity**: HIGH

## Hypothesis

Operators authoring an RBAC policy expect that withholding `OWNER_CREATE` prevents a user from adding rows to the Owner directory. The actual surface is wider by 3: a user with only `DATA_ENTITY_OWNERSHIP_CREATE`, or `TERM_OWNERSHIP_CREATE`, or `auth.s2s.enabled`-free authenticated POST to `/api/owner_association_request` (no SecurityRule on that POST), can submit a form with a never-seen `owner_name` and silently MINT a new Owner row via `OwnerService.getOrCreate`. The mint emits NO `@ActivityLog` (REFACTOR-426), is invisible in the Activity Feed, and the new Owner appears in `GET /api/owners` immediately — also unauthenticated-read (SHB-085).

## Evidence

- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/OwnerServiceImpl.java:38-42` — `getOrCreate(name)` impl: `getByName(name).switchIfEmpty(repository.create(new OwnerPojo().setName(name)))`. Zero permission check at this call site.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/OwnerAssociationRequestServiceImpl.java:57` — side-door callsite #1: `ownerService.getOrCreate(ownerName)` inside `createOwnerAssociationRequest`.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/OwnershipServiceImpl.java:52` — side-door callsite #2: `Mono.zip(ownerService.getOrCreate(formData.getOwnerName()), titleService.getOrCreate(formData.getTitleName()))` inside `OwnershipServiceImpl.create`.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/TermOwnershipServiceImpl.java:35` — side-door callsite #3 (term-ownership analogue).
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/util/SecurityConstants.java:143` — the `OWNER_CREATE` SecurityRule gates `/api/owners POST` ONLY; the rule is path-anchored, not method-anchored, so the `getOrCreate` service-tier callers bypass it.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/OwnerAssociationRequestController.java:28-34` + `SecurityConstants.java:148-162` — `POST /api/owner_association_request` is NOT in the SECURITY_RULES list at all → reachable by any authenticated user, including users with zero permissions; combined with the side-door, ANY authenticated user can mint Owner rows.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/OwnerServiceImpl.java:38-122` — Grep confirms NO `@ActivityLog` on any of the 3 lifecycle methods; the directory mint produces no audit trace.

## Notes

- The 3 side-door callers each have DIFFERENT permission gates: `DATA_ENTITY_OWNERSHIP_CREATE` (per-data-entity scoped), `TERM_OWNERSHIP_CREATE` (per-term scoped), `(none — just-authenticated)` for the OwnerAssociationRequest POST. None of them are `OWNER_CREATE`.
- Stewardship hazard: a user types `"Bob Smith — DBA"` into the Owner field of an Ownership form; the directory accumulates a duplicate of the existing `"Bob Smith"`. The partial unique index `owner_name_unique ON owner(name) WHERE deleted_at IS NULL` (`V0_0_64:70`) is case-sensitive and exact-match; typos / variants accumulate freely.
- Live `/permissions` doc (WebFetched 2026-05-25) names `OWNER_CREATE` as "Allows creating a new owner entity" — operators reading this cannot discover the 3 side-doors. Live `/owners` doc is silent on the side-channel entirely.
- Compounds with SHB-087 (DIRECT_OWNER_SYNC + getOrCreate = full self-mint + self-bind chain).
- Cross-link: REFACTOR-199 + concept `permission-bypass-via-owner-auto-create-side-door-write-path`.
- F-019 (Owner Lifecycle) anchors the controller surface but does NOT enumerate the 3 service-tier side-doors as feature facets — F-019 describes WHAT the four `/api/owners` methods do; it does not describe the OUT-OF-controller permission bypass that is part of the Owner-mint surface.

## Next

1. **ENRICH F-019** with this drift facet (`owner_create_bypassed_by_three_service_tier_side_doors`). The 3 callsites + the path-anchored rule are the operator-visible feature, not a controller-side bug.
2. **REFACTOR-NNN**: either (a) gate `OwnerService.getOrCreate` with a programmatic `OWNER_CREATE` check (then make the side-door callers' callers ALSO require it — breaks the Ownership form's UX); OR (b) add `@ActivityLog` on the getOrCreate path so mints are at least audit-traceable; OR (c) introduce an `OWNER_MINT_FROM_OWNERSHIP_FORM` Permission that operators can grant separately.
3. **DOC-NNN**: enumerate the 3 side-doors on the `/owners` and `/permissions` doc pages.
4. **TEST-GAP-NNN**: integration test asserting a user with `DATA_ENTITY_OWNERSHIP_CREATE` only can submit an Ownership form with a never-seen ownerName and observe a new Owner row in `GET /api/owners`.

## Links

- cluster_with: [F-019, F-011, SHB-085, SHB-087]
- merged_into: F-019
- supersedes: []

## evaluation

- **feature-flow-builder 2026-05-26**: merged — F-019 already carries `service_tier_get_or_create_permission_bypass_owner_create_side_door`; this thread STRENGTHENS the facet with full three-callsite enumeration + path-anchored-vs-method-anchored distinction + audit-silence cross-reference. F-019: shoebox_extensions_2026_05_26 → drift_class: owner_create_bypassed_by_three_service_tier_side_doors_path_anchored_gate_misnamed_invariant. Category flipped clustering → merged.
