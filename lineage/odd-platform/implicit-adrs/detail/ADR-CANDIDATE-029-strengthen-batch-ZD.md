## STRENGTHENS — Batch ZD (IdentityController-class — IDENTITY-LAYER FACET of the DISABLED-as-default stance)

**One new sidecar promotes ADR-CANDIDATE-029's support count from 1 (DisabledAuthSecurityConfiguration primary) to 2** — the IdentityController class-level enrichment is the IDENTITY-LAYER FACET of the same operator-onboarding-velocity stance: under `auth.type=DISABLED` the SPA mounts as `admin` with every permission unlocked, with zero configuration.

**New surfaced_by entry**:
- `odd-platform__java__IdentityController__controller-class__IdentityController.md:implicit_adrs.[0,2]` ("Defence-in-depth via SecurityContext-empty fallback rather than fail-fast. The controller's `.switchIfEmpty(Mono.just(new ResponseEntity<>(dummyOwner(), HttpStatus.OK)))` (line 27) is a deliberate choice: rather than return 401/403 when the principal resolution chain emits empty (which would surface 'you are not authenticated' on every UI mount under DISABLED, breaking the user-onboarding flow), the controller returns a 200 OK with an admin identity so the SPA can mount, populate the toolbar, and the user can navigate. The maintainer accepted the trade-off: under DISABLED, the platform is 'dev-mode-permissive-by-design' and the dummyOwner is the convenience that makes the SPA work without configuring auth.")

**Architectural refinement**: ADR-CANDIDATE-029 anchors the deployment-architecture commitment ("DISABLED is the shipped default; operators opt-OUT, not opt-IN"); ADR-CANDIDATE-210 (NEW this batch) anchors the SPECIFIC consequence at the identity-exposure surface (dummyOwner = literal "admin" + `Permission.values()`). The two ADRs are tightly coupled: without 029, the maintainer would NOT have shipped the dummyOwner fallback; without 210, ADR-CANDIDATE-029's operator-onboarding velocity would NOT be deliverable (the SPA mount would 401 on every fresh deployment).

**Cross-batch refinement**: The IdentityController sidecar adds a new dimension of evidence — the LITERAL `Permission.values()` enumeration at line 32 demonstrates the maintainer's commitment to dynamic blast-radius expansion. Every new Permission added to `components.yaml` automatically enters the under-DISABLED admin grant; the maintainer encoded this as a positive structural choice, not an oversight.

**Severity unchanged**: HIGH — deployment-architecture decision affecting every fresh ODD deployment.

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-210 (the IDENTITY-LAYER FACET — newly minted this batch); REFACTOR-185 (DISABLED bypasses SECURITY_RULES — the cross-cutting consequence at the request-routing layer).
- SUPERSEDES: none.
- CONFLICTS: none.
