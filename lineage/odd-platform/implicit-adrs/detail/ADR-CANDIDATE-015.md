- **ADR-CANDIDATE-015**: Owner-scoped reads are exposed as separate first-class endpoints (`/my`, `/my/upstream`, `/my/downstream`); principal resolution flows through reactor `Context`, not through controller-method signatures
  - **Category**: promote
  - **Support**: surfaced by 2 sidecars (DataEntityController + dataEntity tag)
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__DataEntityController.md:implicit_adrs.[2]` ("Owner-scoped reads (`/my`, `/my/downstream`, `/my/upstream`) take NO principal parameter — the controller delegates to `dataEntityService.listAssociated(page, size [, kind])` and trusts the service to resolve the current user via reactor `Context` propagation. The implicit ADR: principal resolution is a reactor-context concern, not a controller-method-signature concern.")
    - `odd-platform__openapi__tags__openapi-tag__dataEntity.md:implicit_adrs.[3]` ("Data Entity controllers expose owner-scoped operations (`/my`, `/my/upstream`, `/my/downstream`) as separate endpoints rather than as a query-parameter overlay on the cross-tenant list.")
  - **Decision statement**: Owner-scoped data-entity reads are dedicated routes (`/my*`) rather than overlay query parameters (`?owner=me`). Principal resolution happens via reactor `Context` propagation inside the service layer; controllers do not accept `Authentication`/`Principal`/owner-id parameters. The shape commits the platform to "my objects" as a navigation surface, not a filter.
  - **Wisdom test**: PASS. Deliberate (URL design + reactor-Context Spring convention); structural (route shape + method signatures); affects every owner-scoped operation in the codebase.
  - **Evidence**:
    - DataEntityController.md says: "DataEntityController.java:284-305 (three `getMyObjects*` methods, none accept `Authentication`/`Principal`/owner-id)"
  - **Existing ADR**: none.
  - **Cross-link**: ADR-CANDIDATE-022 — the contrasting "view-modes-as-single-parameter" pattern at ActivityController. The maintainer's triage of the two patterns is overdue.
  - **Proposed action**: Promote to `adrs/drafts/owner-scoped-routes.md` (new ADR). Codifies BOTH the URL-shape choice (`/my*` as endpoints) AND the principal-handling convention (reactor `Context`, not method signatures).
  - **Severity rationale**: LOW — convention decision; affects URL-design and code-review uniformity, not security or data integrity.

## STRENGTHENS — AuthIdentityProviderImpl (batch K)

**Primary-source ANCHOR confirmed at `AuthIdentityProviderImpl.java:25, 39`** — both `ReactiveSecurityContextHolder.getContext()` invocations are the architectural anchor for this ADR. The AuthIdentityProviderImpl sidecar elevates ADR-CANDIDATE-015 from "controller-layer convention" to "service-layer chokepoint." The full plumbing now reads:

- **Controller layer**: `/my*` endpoints take NO `Authentication` parameter (per ADR-CANDIDATE-015 — DataEntityController batch B/F).
- **Service layer (NEW PRIMARY-SOURCE)**: 15 callsites of `authIdentityProvider.fetchAssociatedOwner()` invoke the three Monos with NO `Authentication` parameter — the principal is read INSIDE `AuthIdentityProviderImpl` via `ReactiveSecurityContextHolder.getContext()`.
- **Repository layer**: owner-id flows as a `Long` parameter into the JOIN OWNERSHIP (per ADR-CANDIDATE-075 — batch H repository sidecars).

**New batch-K evidence**:
- `AuthIdentityProviderImpl.md:implicit_adrs.[0]` (HIGH confidence): "Per-request principal resolution flows through reactor Context, not method parameters. Every callsite of `getCurrentUser` / `fetchAssociatedOwner` / `getCurrentUserProviderRole` invokes a Mono with NO Authentication / Principal parameter; the principal is read inside this service via `ReactiveSecurityContextHolder.getContext()`. This is the ARCHITECTURAL ANCHOR for ADR-CANDIDATE-015 (owner-scoped routes via reactor Context)."
- Intent anchor: "the public contract on `AuthIdentityProvider.java:8-14` is three parameter-less Mono returns — no API accepts an Authentication argument; the maintainer's design choice is that the principal is ALWAYS read from the reactor Context, never threaded through method signatures"
- Audiences enumeration: 15 callsites — 9 service classes (SearchServiceImpl, AlertServiceImpl, DataEntityServiceImpl, DataEntityRelationsServiceImpl, ActivityServiceImpl, DataCollaborationServiceImpl, OwnerAssociationRequestServiceImpl, IdentityServiceImpl, RoleServiceImpl) + TokenGeneratorImpl + 4 permission/extractor classes + PolicyService.

**Cross-batch alignment**: ADR-CANDIDATE-015 (controller corollary) + this strengthen (service chokepoint primary-source) + ADR-CANDIDATE-075 (repository corollary) together form the three-layer authorization plumbing. The substrate's coverage of the authorization-plumbing decision is now COMPLETE end-to-end at primary-source.

**Cross-link refinement**: ADR-CANDIDATE-104 (NEW batch K) — OAuth2-only non-null provider distinction — is the primitive that AuthIdentityProviderImpl's `getCurrentUser` produces. ADR-CANDIDATE-105 (NEW batch K) — single-Mono owner resolution — is the primitive that `fetchAssociatedOwner` returns. ADR-CANDIDATE-106 (NEW batch K) — stateless/no-caching — is the implementation stance. ADR-CANDIDATE-015 now sits at the centre of a 4-ADR family describing the platform's full identity-and-owner-resolution architecture.

**Severity unchanged**: LOW (convention decision). The batch-K strengthening makes the convention's reach explicit (15-callsite blast radius) but does not change the severity of the choice itself.

---
