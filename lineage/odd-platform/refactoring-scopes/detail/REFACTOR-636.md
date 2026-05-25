# REFACTOR-636 — `OwnerService.getOrCreate` is reachable from THREE service-tier callsites bypassing the `OWNER_CREATE` permission gate; a caller with only `DATA_ENTITY_OWNERSHIP_CREATE` or just-authenticated for `/api/owner_association_request` can silently grow the Owner directory

**Severity**: HIGH
**Category**: missing-auth (side-channel-bypass) + missing-doc (operator-visible RBAC drift)
**Pillars affected**: [P-09 Security & Access Control (RBAC), P-08 Management & Administration (Owner directory)]
**Batch**: ZF (2026-05-25)

**Surfaced by**:
- `odd-platform__java__OwnerController__controller-class__OwnerController.md:bugs_limitations_corner_cases.[1]` (HIGH) — the canonical statement of this gap.
- `odd-platform__java__OwnerController__controller-class__OwnerController.md:coherence_notes.[enclosing-class-triangulation]` — the controller-class-level finding that this is a NEW class-level fact, not a method-tier observation.
- `odd-platform__java__OwnerController__controller-class__OwnerController.md:tests_coverage_semantic.uncovered_behaviours.[Side-channel-boundary]` — the test gap: no test pins this behaviour.

**Description**: The Owner directory `OWNER` table is writable from THREE distinct controller paths, each gated by a DIFFERENT permission:

1. **POST `/api/owners`** → `OwnerController.createOwner` → `OwnerServiceImpl.create` → gated by **`OWNER_CREATE`** (SecurityConstants.java:143).
2. **POST `/api/owner_association_request`** → `OwnerAssociationRequestController.createOwnerAssociationRequest` → `OwnerAssociationRequestServiceImpl.createOwnerAssociationRequest:57` → `ownerService.getOrCreate(ownerName)` → gated by **NOTHING** (no SecurityRule entry; falls through to `authenticated()`).
3. **POST `/api/dataentities/{data_entity_id}/ownerships`** → `DataEntityController.createOwnership` → `OwnershipServiceImpl.create:52` → `ownerService.getOrCreate(formData.getOwnerName())` → gated by **`DATA_ENTITY_OWNERSHIP_CREATE`**.
4. **POST `/api/terms/{term_id}/ownerships`** → `TermOwnershipController.createOwnership` → `TermOwnershipServiceImpl.create:35` → `ownerService.getOrCreate(...)` → gated by **`TERM_OWNERSHIP_CREATE`**.

The `OwnerServiceImpl.getOrCreate` method at lines 38-42 is:
```java
public Mono<OwnerPojo> getOrCreate(String name) {
    return reactiveOwnerRepository.getByName(name)
        .switchIfEmpty(reactiveOwnerRepository.create(new OwnerPojo().setName(name)));
}
```

— a get-or-create with NO permission check, NO audit log, NO activity emission.

A caller holding `DATA_ENTITY_OWNERSHIP_CREATE` (a permission typically granted to data-entity stewards — a much-broader role than the platform-admin who holds `OWNER_CREATE`) can:
1. Submit `POST /api/dataentities/123/ownerships` with `{"ownerName": "Alice Forged"}`.
2. The service-tier calls `ownerService.getOrCreate("Alice Forged")`.
3. The Owner directory now has a NEW row named "Alice Forged".
4. The new Owner appears in `GET /api/owners` immediately.
5. The OWNER_CREATE permission was not consulted.

The same shape applies to the `/api/owner_association_request` path with even WEAKER gating: any authenticated user can submit an association request with a never-seen ownerName.

**Operator-visible failure modes**:

1. **Undermined RBAC intent** — operator restricts `OWNER_CREATE` to platform admins, intending to control the Owner directory. Data-entity stewards (holding `DATA_ENTITY_OWNERSHIP_CREATE`) can still spam Owner rows by submitting ownership forms with never-seen names.

2. **Audit-silence amplifies the gap** — the OwnerController class sidecar's bugs_limitations_corner_cases[4] notes no `@Slf4j` on the controller and no logger on `OwnerServiceImpl`; combined with no `@ActivityLog`, the side-channel Owner creation is forensically invisible. An operator investigating "who created Alice Forged?" gets NO answer from the application logs.

3. **Cross-tenant Owner directory pollution** — a malicious data-entity steward in one team can create Owner rows that appear in the global Owner autocomplete used by every other team's Data Entity ownership form. The directory is not partitioned by tenant.

4. **Live docs mislead operators** — the live `/permissions` page (`https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions`, WebFetched 2026-05-25 status 200) defines `OWNER_CREATE` as "Allows creating a new owner entity" — implying ONE path. Operators reading the docs cannot determine from the page that THREE OTHER paths exist.

**Primary source citations**:
- `<odd-platform-api>/src/main/java/.../OwnerServiceImpl.java:38-42` (getOrCreate impl).
- `<odd-platform-api>/src/main/java/.../OwnerAssociationRequestServiceImpl.java:57` (callsite 1).
- `<odd-platform-api>/src/main/java/.../OwnershipServiceImpl.java:52` (callsite 2).
- `<odd-platform-api>/src/main/java/.../TermOwnershipServiceImpl.java:35` (callsite 3).
- `<odd-platform-api>/src/main/java/.../SecurityConstants.java:143-147` (the `/api/owners` POST gate; the 3 callsites bypass).
- `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions` (the operator-misleading silent doc).

**Existing-ADR-or-implied-prescription**: The newly-promoted **ADR-CANDIDATE-218 NEW** (this batch) captures the SYSTEMIC framing — RBAC is PATH-anchored, so service-tier callers bypass directory-level gates by design. This REFACTOR captures the **Owner-specific operator-actionable closure**. Two reasonable options:

- **Option A (structural — move gates to service tier)**: add `@PreAuthorize("hasPermission(null, 'OWNER_CREATE')")` to `OwnerServiceImpl.getOrCreate`. This forces all four paths to require `OWNER_CREATE`. Operator-actionable but BREAKS the existing ownership-creation UX (data-entity stewards now need a second permission).
- **Option B (doc + audit-disclosure)**: extend live `/permissions` page to enumerate the FOUR callsites of `OwnerService.getOrCreate`; add `@Slf4j` to `OwnerServiceImpl` + log at INFO level on every Owner creation regardless of path; add `@ActivityLog` so the operator has an audit trail. This is the lower-disruption fix; preserves UX.
- **Option C (per-callsite explicit permission)**: gate each of the 3 service-tier callers with EITHER `OWNER_CREATE` OR the calling-path's permission (e.g. `DATA_ENTITY_OWNERSHIP_CREATE`). This is the MOST PERMISSIVE explicit choice; preserves UX and adds traceability.

The maintainer-recommended option (per Linus principle: diagnose the class, not patch the instance) is **Option B** — disclose + audit. The systemic decision is ADR-218 (path-anchored RBAC); the operator-actionable closure is making the side-channel visible.

**Proposed remedy**: Three-part fix (Option B):

1. **Add `@Slf4j` to OwnerServiceImpl + log at INFO on `getOrCreate(name)`**:

```java
public Mono<OwnerPojo> getOrCreate(String name) {
    return reactiveOwnerRepository.getByName(name)
        .switchIfEmpty(reactiveOwnerRepository.create(new OwnerPojo().setName(name))
            .doOnSuccess(o -> log.info("Owner created via getOrCreate side-channel: name={}, id={}", o.getName(), o.getId())));
}
```

2. **Add `@ActivityLog` to all three callsites** (OwnerAssociationRequestServiceImpl.createOwnerAssociationRequest + OwnershipServiceImpl.create + TermOwnershipServiceImpl.create) — emit an Activity with the new Owner's id + the calling-path's identifier so the Activity Feed shows "Alice created via Ownership form on Data Entity 123".

3. **Extend live `/permissions` page** to add a "Side-channel paths" section under OWNER_CREATE:
   > **Side-channels that grow the Owner directory without OWNER_CREATE**: (1) `POST /api/owner_association_request` (any authenticated user); (2) `POST /api/dataentities/{id}/ownerships` (DATA_ENTITY_OWNERSHIP_CREATE); (3) `POST /api/terms/{id}/ownerships` (TERM_OWNERSHIP_CREATE). All three side-effect-create an Owner row when the supplied name is not in the directory.

4. **Add integration tests**:
   - POST `/api/dataentities/123/ownerships` with a never-seen ownerName by a caller holding only DATA_ENTITY_OWNERSHIP_CREATE → 2xx + new Owner row visible at GET `/api/owners`.
   - Verify the Activity Feed receives a side-channel-creation entry.

**Severity rationale**: HIGH — load-bearing systemic RBAC drift; operator-visible consequence is undermined permission gating + audit-silence; combined with ADR-218 (the systemic framing) this is the Owner-specific instance. Three more directory surfaces (Tag, Title, MetadataField) follow the same pattern; the Owner case is the canonical instance with the strongest operator-visibility evidence.

**Suggested backlog grouping**: `RBAC side-channel disclosure sprint` — pair with REFACTOR-185 (DISABLED-bypass cluster) + the Tag/Title/MetadataField sibling closures (currently unflagged — should be opened as REFACTOR-NNN siblings if the maintainer triages the systemic pattern). Cross-link to ADR-CANDIDATE-218.

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-185 (DISABLED-bypass cluster — the request-routing facet); REFACTOR-097 (no audit-log infrastructure — same shape on the audit-side); ADR-CANDIDATE-218 (the systemic framing).
- SUPERSEDES: none.
- CONFLICTS: none.

---
