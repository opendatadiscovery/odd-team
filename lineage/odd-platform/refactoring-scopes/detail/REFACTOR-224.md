## REFACTOR-224 — `getMyObjects` returns silent empty Flux for unlinked users — operator-UX trap

**Severity**: LOW
**Category**: missing-error-translation (UX framing)
**Surfaced by**:
- `getMyObjects.md:bugs_limitations_corner_cases[0]`
- `getMyObjects.md:security.known_security_gaps[0]`

**Description**: A user authenticated under LOGIN_FORM/OAUTH2/LDAP who has not been linked to an `Owner` record via `OwnerAssociationRequest` admin-resolution OR direct `POST /api/owners/{owner_id}/users` mapping receives `200 OK` with body `[]` from `GET /api/dataentities/my`. There is no 401, no 403, no `OwnerNotAssociatedException`, no flash banner via `getDataEntitiesUsage`, no header signalling "you need an owner link." A new user landing on the `Recommended → My Objects` panel sees an empty strip with no explanation, indistinguishable from "I own nothing yet." The cure is documented elsewhere (operator must accept their association request via `/management/owner-associations`) but this endpoint's response shape gives the consumer no signal.

**Primary source citations**:
- `DataEntityServiceImpl.java:212-216` (the `.flatMapMany` on an empty `fetchAssociatedOwner()` produces empty Flux; no `.switchIfEmpty(Mono.error(...))`)
- `AuthIdentityProviderImpl.java:50-53` (no fallback for unlinked users)
- live `catalog-overview` doc fetched_excerpt: "Both sections require the signed-in user to be linked to an Owner record for personalized functionality to work"

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-015 (Owner-scoped routes) documents the architecture. The UX-affordance gap is implicit — the live doc tells operators to expect owner-linking, but the API doesn't signal when the link is missing.

**Proposed remedy**: Two options:
1. **Add a sentinel error**: `.switchIfEmpty(Mono.error(new OwnerNotAssociatedException("Current user is not linked to an Owner; ask your administrator to accept your owner-association request")))`. The UI then catches this and renders a flash banner. Breaking change for existing UI clients that expect empty Flux on no owner — needs UI coordination.
2. **Add a response header**: Emit `X-Owner-Link-Status: missing` when the owner lookup is empty. Non-breaking; UI can choose to surface the banner.

Either remedy needs a `@WebFluxTest` regression that asserts the chosen signal for the unlinked case.

**Severity rationale**: LOW — UX gap, not a security or correctness gap. The empty Flux IS technically correct. The fix is UX polish.

**Suggested backlog grouping**: DOC-NNN OR UX-NNN — depending on whether the remedy is "document the gotcha" or "fix the signal." TEST-GAP-020 already names the test that would cover the un-linked case.

---
