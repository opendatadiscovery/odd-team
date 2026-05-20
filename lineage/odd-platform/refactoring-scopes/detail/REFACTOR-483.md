## REFACTOR-483 — DIRECT_OWNER_SYNC + `getOrCreate` privilege-escalation chain (OwnerAssociationRequestServiceImpl.java:60-67 + :57) — a DIRECT_OWNER_SYNC holder can MINT a new Owner AND immediately self-bind without OWNER_CREATE permission

**Severity**: HIGH
**Category**: privilege-escalation + permission-bypass
**Batch**: V (2026-05-20)
**Pillars affected**: [P-09-security-access-control, P-08-management-administration (Owner lifecycle + Associations tab)]

**Surfaced by**:
- `OwnerAssociationRequestController__controller-class__OwnerAssociationRequestController.md:security.known_security_gaps.[3]` (HIGH) — "DIRECT_OWNER_SYNC permission applies SYNCHRONOUSLY at request-creation time (OwnerAssociationRequestServiceImpl.java:60-67) but the permission CHECK is `permissionService.getNonContextualPermissionsForCurrentUser(MANAGEMENT)` — which returns ALL MANAGEMENT permissions held by the user. A user holding DIRECT_OWNER_SYNC can self-bind to ANY existing Owner directory entry (including the deployment's most-privileged Owner). Combined with the side-door at OwnerService.getOrCreate (no OWNER_CREATE required), a DIRECT_OWNER_SYNC holder can MINT a new Owner and immediately self-bind to it — a complete privilege-escalation chain (the new Owner inherits no roles by default, but the auto-create + immediate-bind chain is permission-bypass-class)."
- `OwnerAssociationRequestController__controller-class__OwnerAssociationRequestController.md:bugs_limitations_corner_cases.[0]` (MEDIUM) — "createOwnerAssociationRequest (POST /api/owner_association_request) accepts an arbitrary ownerName from the requesting user and routes through OwnerService.getOrCreate (OwnerAssociationRequestServiceImpl.java:57). Per F-019 line 267-281 (`getOrCreate` permission-bypass side-door), the request flow can SILENTLY MINT new Owner directory rows on behalf of any authenticated user without that user holding OWNER_CREATE. A user attempting to associate with a non-existent owner name does NOT receive a 'not found' — the Owner is auto-created."
- `OwnerAssociationRequestController__controller-class__OwnerAssociationRequestController.md:implicit_adrs.[2]` (MEDIUM) — "AUTO-APPROVE permission as an escalation mechanism — the DIRECT_OWNER_SYNC permission collapses the two-step workflow into one for designated principals so the platform can be deployed in a 'trust the IdP' configuration where association is policy-derived not workflow-driven."

**Statement**: The chain at `OwnerAssociationRequestServiceImpl.java` produces a complete permission-bypass escalation surface:

```java
// OwnerAssociationRequestServiceImpl.java:55-67 (the escalation chain)

// Step 1: get current user (line 55-56)
authIdentityProvider.getCurrentUser()
    .switchIfEmpty(Mono.error(() -> new RuntimeException("There is no current authorization")))

// Step 2: mint a new Owner if it doesn't exist (line 57) - NO OWNER_CREATE CHECK
.zipWith(ownerService.getOrCreate(formData.getName()))

// Step 3: check MANAGEMENT permissions (line 60-63)
.zipWith(permissionService.getNonContextualPermissionsForCurrentUser(MANAGEMENT))

// Step 4: if DIRECT_OWNER_SYNC, auto-approve in-line (line 64-67)
.flatMap(tuple -> {
    if (tuple.getT2().contains(Permission.DIRECT_OWNER_SYNC)) {
        // create the request AS APPROVED + create USER_OWNER_MAPPING immediately
        return mapToApprovedRequest(...);
    } else {
        return mapToPendingRequest(...);  // normal flow
    }
})
```

**The three-step escalation**:

1. A user holding `DIRECT_OWNER_SYNC` MANAGEMENT permission (granted via OIDC group-claim mapping per ADR-CANDIDATE-167 framing, or via an operator-curated Policy) calls `POST /api/owner_association_request` with `OwnerFormData{name: "PRIVILEGED_OWNER_NAME"}` for a non-existent owner.

2. The service-layer chain at line 57 calls `ownerService.getOrCreate(ownerName)`. This method (per F-019 line 267-281) MINTS a fresh `OwnerPojo` row when the name doesn't exist, WITHOUT requiring `OWNER_CREATE` permission. The user is now associated with creating a brand-new Owner directory entry — a write the user could NOT perform directly via `POST /api/owners` (gated by `OWNER_CREATE`).

3. The branch at line 64 detects `DIRECT_OWNER_SYNC` and AUTO-APPROVES the request, creating the `USER_OWNER_MAPPING` row in-line. The user is now BOUND to the new Owner. Subsequent owner-scoped reads (My Objects, owner-filtered alerts, ownership badges) treat the user as that Owner.

**Net effect**: A `DIRECT_OWNER_SYNC` holder can MINT a new Owner AND immediately self-bind to it, bypassing `OWNER_CREATE`. The new Owner inherits NO Roles by default (Roles attach via `OWNER_TO_ROLE` rows, which require separate creation) — so the new Owner has NO permissions of its own beyond the platform-wide read-collaborative posture. The escalation is therefore PARTIAL — the user gains an Owner identity but not new RBAC permissions.

**BUT — the escalation surface widens under operator-side automation**:

- An operator who has wired Roles to be AUTO-ATTACHED to newly-created Owners (via an external onboarding script, an IdP-group-to-Role-mapping, or a future platform feature) inadvertently turns the partial escalation into a FULL escalation.
- An operator who has configured a per-namespace default Role and the new Owner falls into that namespace inherits the namespace's default permissions.
- The escalation is forensically discoverable via `owner_association_request_activity` (per ADR-CANDIDATE-167 NEW batch V) — `REQUEST_APPROVED` rows are written even for DIRECT_OWNER_SYNC auto-approve — but the audit table does NOT BLOCK the escalation; it only records it.

**Doc-side framing of the gap**: The live user-owner-association doc (`https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/user-owner-association` verified 2026-05-20, status 200) describes ONLY the SELF-request → Admin-approve flow. The auto-approve branch is operator-invisible. An IdP-integrated deployment where `DIRECT_OWNER_SYNC` is granted via OIDC group claim presents behaviour the doc says is impossible — combined with this escalation chain, it presents a security surface the operator cannot discover via reading the docs.

**Evidence**:
- `OwnerAssociationRequestServiceImpl.java:55-56` — current user assertion
- `OwnerAssociationRequestServiceImpl.java:57` — `ownerService.getOrCreate(ownerName)` — the side-door write
- `OwnerAssociationRequestServiceImpl.java:60-63` — non-contextual MANAGEMENT permission lookup
- `OwnerAssociationRequestServiceImpl.java:64-67` — DIRECT_OWNER_SYNC branch + auto-approve
- F-019 detail file lines 267-281 — documents the `getOrCreate` permission-bypass side-door at the Owner-lifecycle tier
- `PolicyPermissionDto.java:68-70` — DIRECT_OWNER_SYNC + OWNER_RELATION_MANAGE + OWNER_ASSOCIATION_MANAGE all under MANAGEMENT category
- live doc `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/user-owner-association` — doc-silent on DIRECT_OWNER_SYNC
- ADR-CANDIDATE-167 (NEW batch V) — confirms the audit table DOES record `REQUEST_APPROVED` for the auto-approve case

**Existing-ADR-or-implied-prescription**:
- ADR-CANDIDATE-167 (NEW batch V) frames the audit table as the forensic-recovery surface — but explicitly notes the escalation chain is BYPASSED, not blocked.
- F-019 (Owner Lifecycle Management) documents the `getOrCreate` permission-bypass side-door at the Owner-lifecycle tier; this scope's evidence connects that side-door to the association workflow.

**Proposed remedy**:

1. **Path A — Require OWNER_CREATE for auto-mint via getOrCreate** at OwnerAssociationRequestServiceImpl.java:57. Change the call to a two-step check: (i) `ownerService.findByName(ownerName)` returning `Mono<Optional<Owner>>`; (ii) if absent, check `permissionService.getNonContextualPermissionsForCurrentUser(MANAGEMENT).contains(OWNER_CREATE)` before calling `getOrCreate`. If the user lacks OWNER_CREATE, return `BadUserRequestException("Owner does not exist; request a sponsor with OWNER_CREATE to provision the Owner first.")`. Cross-link with F-019 line 267-281 — this fix would close the side-door at the association tier.

2. **Path B — Require OWNER_CREATE for auto-approve via DIRECT_OWNER_SYNC** at OwnerAssociationRequestServiceImpl.java:64. Change the branch to ADDITIONALLY check OWNER_CREATE when the requested ownerName did not already exist. This keeps DIRECT_OWNER_SYNC's auto-approve semantic intact for EXISTING owners (the deployment's "trust the IdP" workflow per ADR-CANDIDATE-167 intent) but closes the auto-mint escalation.

3. **Path C — Doc-side closure**: ADD operator-facing documentation on the DIRECT_OWNER_SYNC permission + the `getOrCreate` side-door + the audit trail. The behaviour exists; making it operator-visible reduces the surprise factor.

Path A is the minimum security fix; Path B preserves the intent of DIRECT_OWNER_SYNC; Path C is the necessary doc-side companion. Paths A and B can be combined.

**Severity rationale**: HIGH — privilege-escalation surface within the authenticated-user pool; doc-side invisibility means operators cannot discover the gap; the `getOrCreate` side-door + the auto-approve branch + the MANAGEMENT permission framing all conspire to produce a chain that bypasses OWNER_CREATE; operator-side automation (Role auto-attach to new Owners) can promote partial escalation to full escalation.

**Suggested backlog grouping**: `Authorization audit batch` — covers REFACTOR-483 (this), REFACTOR-482 (SecurityConstants wiring bugs), REFACTOR-073 (boot-time validator), REFACTOR-185 (DISABLED bypasses keys-to-the-kingdom RBAC), F-019 REFACTOR-427 (owner_association_request orphan rows on Owner delete).

---
