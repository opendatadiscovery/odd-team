# ADR-CANDIDATE-218 — RBAC SecurityRules are anchored on the CONTROLLER PATH, not on the SERVICE METHOD — `getOrCreate`-shape side-channels at the service tier BYPASS the controller-level permission gate (`OwnerService.getOrCreate` is the canonical case; three other callsites bypass `OWNER_CREATE`)

**Classification**: promote
**Severity**: HIGH
**Pillars affected**: [P-09 Security & Access Control (RBAC), P-08 Management & Administration (Owner directory)]
**Batch**: ZF (2026-05-25)

**Surfaced by**:
- `odd-platform__java__OwnerController__controller-class__OwnerController.md:bugs_limitations_corner_cases.[1]` (HIGH) — "**`OwnerService.getOrCreate` BYPASSES the `OWNER_CREATE` permission gate via three service-tier callsites** — `SecurityConstants.java:143` gates `POST /api/owners` with `OWNER_CREATE`; the rule applies to the controller-path POST only. `OwnerServiceImpl.getOrCreate` (`OwnerServiceImpl.java:38-42`) is reached from THREE separate callers"
- `odd-platform__java__OwnerController__controller-class__OwnerController.md:coherence_notes.[enclosing-class-triangulation]` — "the SecurityRule is anchored on the controller PATH (`/api/owners` POST), not on the service method. A caller with only `DATA_ENTITY_OWNERSHIP_CREATE` or `OWNER_ASSOCIATION_MANAGE` can effectively create Owner directory rows by submitting an Ownership form / association request with a never-seen owner-name"
- `odd-platform__java__OwnerController__controller-class__OwnerController.md:implicit_adrs.[1]` — "Centralized authorization via `SecurityConstants.SECURITY_RULES`"

**Decision statement**: The platform's RBAC enforcement model is **PATH-ANCHORED, NOT METHOD-ANCHORED**. `SecurityConstants.SECURITY_RULES` declares `{path, http-method, permission}` triples; the WebFlux SecurityWebFilterChain matches inbound REQUESTS by URL path + verb and applies the permission check BEFORE the controller method runs. Service-tier methods reached through DIFFERENT controller paths bypass the gate even when they perform the same persistence-level write.

The canonical case in batch ZF is `OwnerService.getOrCreate(name)`:
- The controller path `POST /api/owners` is gated by `OWNER_CREATE` (SecurityConstants.java:143).
- The service method `OwnerServiceImpl.getOrCreate` (OwnerServiceImpl.java:38-42) is called from THREE other controller paths:
  1. `POST /api/owner_association_request` → `OwnerAssociationRequestServiceImpl.createOwnerAssociationRequest` (OwnerAssociationRequestServiceImpl.java:57) — UNGATED at the controller (no SecurityRule entry; falls through to authenticated()).
  2. `POST /api/dataentities/{id}/ownerships` → `OwnershipServiceImpl.create` (OwnershipServiceImpl.java:52) — gated by `DATA_ENTITY_OWNERSHIP_CREATE`.
  3. `POST /api/terms/{id}/ownerships` → `TermOwnershipServiceImpl.create` (TermOwnershipServiceImpl.java:35) — gated by `TERM_OWNERSHIP_CREATE`.
- A caller holding ANY of {`DATA_ENTITY_OWNERSHIP_CREATE`, `TERM_OWNERSHIP_CREATE`, just-authenticated} can supply a never-seen ownerName, and `getOrCreate` silently inserts a new row into `OWNER`. The new Owner appears in `GET /api/owners` immediately.

The pattern is NOT a bug of the Owner subsystem alone. It is the SYSTEMIC consequence of the PATH-ANCHORED authorization model — any "directory-shaped" service method (`getOrCreate(name) → MetadataField`, `getOrCreate(name) → Tag`, `getOrCreate(name) → Title`, `getOrCreate(name) → Namespace`) is reachable from feature-level controller paths with feature-level permissions, NOT from the directory-level controller paths with directory-level permissions. The Tag case is INTENTIONALLY ACKNOWLEDGED (ADR-CANDIDATE-065 — "Tag auto-create-on-miss is INTENTIONAL and spec-acknowledged"); Owner / Title / Metadata are SILENTLY in the same pattern but neither acknowledged nor documented.

The architectural choice the platform makes is:
- (+) Operators wire authorization centrally in one file (SecurityConstants) — auditable.
- (+) Permission decisions are URL-routable; an operator's reverse proxy can pre-filter by path.
- (-) Service-tier callsites of "directory creator" methods are INVISIBLE to the SecurityConstants reader. A reviewer looking at `SecurityConstants.java` to answer "who can create an Owner?" gets a partial answer.
- (-) The "directory" / "feature" permission split (e.g. OWNER_CREATE vs DATA_ENTITY_OWNERSHIP_CREATE) is structurally undermined when the feature-level write can side-effect-create a directory entry.
- (-) Audit-trail silence — combined with the no-`@ActivityLog` on the affected paths (per the OwnerController sidecar), Owner creation via side-channel is forensically invisible.

**Wisdom test**: PASS. Four intent anchors:
1. **Centralisation discipline** — `SecurityConstants.SECURITY_RULES` is a SINGLE-FILE list (lines 95-355); the maintainer deliberately CHOSE this central-list shape over `@PreAuthorize` scattered across hundreds of methods. The decision is positive, not absent.
2. **Cross-controller propagation** — the same path-anchored pattern applies across EVERY controller in the package (confirmed by 23-sidecar STRENGTHENED on ADR-CANDIDATE-002). The platform-wide consistency is the architectural shape.
3. **Service-tier callsite naming** — `getOrCreate(name)` is a deliberate API; the method exists because the platform CHOSE to allow feature-level callers to create directory entries by side-effect rather than forcing them to obtain `OWNER_CREATE` first. The Tag-side ADR-CANDIDATE-065 acknowledges the same pattern for Tag — confirming the pattern is intentional, not accidental, across the codebase.
4. **No `@PreAuthorize` at the service-method tier** — verified across `OwnerServiceImpl`, `TagServiceImpl`, `MetadataFieldServiceImpl`, `TitleServiceImpl`: none of the `getOrCreate` methods carry method-level permission annotations. The absence is platform-consistent.

Structural impact (changes the trust model of every "directory" surface — Tag / Owner / Title / MetadataField / Namespace); alternative (per-method `@PreAuthorize` on every `getOrCreate`) is a structural change to the authorization-enforcement architecture.

**Operator-visible consequence**:
- Operator wires `OWNER_CREATE` only to the platform-admin role, intending to restrict who can populate the Owner directory.
- Any user with `DATA_ENTITY_OWNERSHIP_CREATE` (a much-broader permission, typically granted to data entity stewards) can submit an Ownership form with a never-seen ownerName and silently create a new Owner row.
- The Owner directory grows uncontrollably; the operator's intent is silently undermined.
- Combined with no `@ActivityLog` and no `@Slf4j` on the affected controllers, the operator has no audit trail of who created which Owner.

**Existing ADR**: composes with **ADR-CANDIDATE-002** (centralised SecurityConstants — the PATH-anchored authorization model is the load-bearing primitive). Composes with **ADR-CANDIDATE-049** (identity-decoupled Owner directory CRUD — same shape; Owner-row ownership is decoupled from creator-identity by design). Composes with **ADR-CANDIDATE-065** (Tag auto-create acknowledged — the Tag side is the ONLY acknowledged instance of this pattern; Owner / Title / MetadataField are the UN-acknowledged siblings).

DISTINCT FROM ADR-CANDIDATE-049: ADR-049 says "Owner row creation does not bind to caller identity" (no `created_by` field is captured from the principal). ADR-218 says "Owner row creation does not bind to caller PERMISSION" (the OWNER_CREATE check does not apply at service-tier callsites). The two compose: the directory is identity-decoupled AND permission-decoupled at the service tier.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- **REFACTOR-636** NEW (HIGH) — Operator-actionable fix: either (a) move the OWNER_CREATE gate to the service tier via @PreAuthorize on `getOrCreate`, OR (b) document the side-channel explicitly in the live `/permissions` page so operators reason about the actual trust model.
- DOC-GAP — `docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions` lists OWNER_CREATE / OWNER_UPDATE / OWNER_DELETE but is silent on the three side-channel paths. The live `/owners` page is silent on the side-channel.

**Proposed action**: Promote to `adrs/drafts/rbac-path-anchored-service-side-channels.md` (new ADR). Document:
1. The decision: SECURITY_RULES are PATH-anchored, not method-anchored.
2. The consequence: `getOrCreate`-shape service methods reachable from non-directory paths bypass directory-level permission gates.
3. The four canonical instances:
   - **Owner**: `OwnerService.getOrCreate` reached from 3 paths bypassing OWNER_CREATE (this ADR's case).
   - **Tag**: acknowledged in ADR-CANDIDATE-065.
   - **Title**: same pattern, side-effect-only (canonical instance per ADR-CANDIDATE-212).
   - **MetadataField**: same pattern; `MetadataFieldServiceImpl.getOrCreateMetadataFields` reached from `DataEntityServiceImpl.createMetadata`.
4. The trade-off: centralised SecurityConstants auditability vs service-tier permission accuracy.
5. The doc-disclosure responsibility: every directory entity's `/{entity_name}` doc page should disclose which controller paths can side-effect-create that directory entry.
6. The maintainer's choice between: (a) keep path-anchored, doc-disclose; (b) move gates to service tier (a structural change to the authorization-enforcement model).

**Severity rationale**: HIGH — load-bearing systemic security-architecture decision affecting at least FOUR directory surfaces (Owner / Tag / Title / MetadataField); operator-visible consequence is undermined RBAC intent. The Tag case is acknowledged; the other three are silent. Pairs with REFACTOR-636 (Owner-specific operator-actionable closure).

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-002 (path-anchored authorization centralisation) — this ADR is the systemic CONSEQUENCE; ADR-CANDIDATE-049 (Owner identity-decoupling) — same Owner-directory architectural family; ADR-CANDIDATE-065 (Tag auto-create) — sibling acknowledged instance.
- SUPERSEDES: none.
- CONFLICTS: none. ADR-CANDIDATE-049 / -065 / -002 / -212 all compose with this ADR; they each capture a facet, ADR-218 captures the SYSTEMIC framing.

---
