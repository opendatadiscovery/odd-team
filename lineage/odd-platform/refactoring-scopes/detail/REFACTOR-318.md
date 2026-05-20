## REFACTOR-318 — `TermServiceImpl` has ZERO service-tier permission checks — defence-in-depth absence; combined with REFACTOR-217 path-mismatch, the term-linkage surface is effectively unauthenticated-mutation-allowed under LOGIN_FORM/OAUTH2/LDAP

**Severity**: HIGH
**Category**: missing-defence-in-depth (permission-bypass compounding)
**Pillars affected**: [P-06-data-glossary, P-09-security-access-control]
**Batch**: K (2026-05-19)

**Surfaced by**:
- `odd-platform__java__service__service__TermServiceImpl.md:security.authorization_assertions: []` — "N/A. `TermServiceImpl` performs NO service-tier permission checks. All authorization is supposed to happen at the controller perimeter via `SecurityConstants.SECURITY_RULES` matchers in `AuthorizationCustomizer`. The service tier blindly trusts the call. Per the REFACTOR-217 path-mismatch finding, the controller-tier gate does NOT fire for `POST /api/dataentities/{id}/terms` and `DELETE /api/dataentities/{id}/terms/{term_id}` — making the entire term-linkage surface effectively unauthenticated-mutation-allowed."

**Description**: `TermServiceImpl` performs NO programmatic permission checks at any of its 17 methods (verified via grep `@PreAuthorize|hasPermission|hasRole|permissionService` against the file — zero matches). All authorisation is supposed to be enforced UPSTREAM at the WebFilter chain via `SecurityConstants.SECURITY_RULES` matchers. Per ADR-CANDIDATE-075 (repositories take no Principal), the trust boundary is "service is single point of enforcement" — but for TermServiceImpl the service tier is NOT enforcing anything; it relies entirely on the WebFilter chain to have already authorised the call.

This works as long as the WebFilter chain is correctly aligned with the controller endpoints. REFACTOR-217 (batch I — `/term` vs `/terms` plural mismatch) is the demonstration that the alignment is BROKEN for the term-linkage endpoints: the SECURITY_RULES matcher registers the SINGULAR `/term` path while the OpenAPI / controller uses PLURAL `/terms`, so the matcher never fires for the real requests. The `AuthorizationCustomizer.customize` (`AuthorizationCustomizer.java:24-30`) falls through to `.pathMatchers("/**").authenticated()` — ANY authenticated user can `POST /api/dataentities/{id}/terms` and `DELETE /api/dataentities/{id}/terms/{term_id}`.

The defence-in-depth ABSENCE means there is NO secondary check at the service layer. If `DATA_ENTITY_ADD_TERM` were enforced at the service via `permissionService.hasPermission(DATA_ENTITY_ADD_TERM, dataEntityId)`, the REFACTOR-217 path-mismatch would be MITIGATED — the path-mismatch would surface as a UI behaviour mismatch (the UI shows the term-link button per `WithPermissions` but the request still 403s at the service) but the actual permission check would still fire.

**Failure mode (COMPOUNDED)**: Combined with REFACTOR-217, ANY authenticated user can link or unlink any term to any data entity. Combined with REFACTOR-227 (description-edit auto-link side-channel — Description-Update permission alone creates `is_description_link=TRUE` rows), the term-linkage surface has TWO bypasses of the `DATA_ENTITY_ADD_TERM` gate: one structural (the auto-link side-channel — ADR-CANDIDATE-110 endorses this) and one accidental (the path-mismatch — REFACTOR-217 is the defect). The service-tier defence-in-depth absence is the FAILURE TO MITIGATE either one.

**Primary source citations**:
- `TermServiceImpl.java:1-552` — grep `@PreAuthorize|hasPermission|hasRole|permissionService` returns zero matches
- `SecurityConstants.java:237-242` (the broken path-mismatch matcher per REFACTOR-217)
- `AuthorizationCustomizer.java:24-30` (the fall-through to `.authenticated()`)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-075 (repositories take no Principal — owner-scoping caller-resolved at service) frames the trust boundary at the service layer. The ADR's CLAIM is "service is single point of enforcement" but Term endpoints VIOLATE this — the service performs no enforcement. The ADR's IMPLIED prescription is that EVERY mutating service method should have a service-tier permission check; the absence is a gap.

**Proposed remedy**: Add programmatic permission checks at the entry of each mutating method:
- `linkTermWithDataEntity` → `permissionService.hasPermission(DATA_ENTITY_ADD_TERM, dataEntityId).switchIfEmpty(Mono.error(new ForbiddenException()))`
- `removeTermFromDataEntity` → `permissionService.hasPermission(DATA_ENTITY_DELETE_TERM, dataEntityId)`
- `linkTermWithDatasetField` → `permissionService.hasPermission(DATASET_FIELD_ADD_TERM, datasetFieldId)`
- `removeTermFromDatasetField` → `permissionService.hasPermission(DATASET_FIELD_DELETE_TERM, datasetFieldId)`
- `handleDataEntityDescriptionTerms` / `handleDatasetFieldDescriptionTerms` — the auto-link side-channel: defer to the upstream description-update permission (per ADR-CANDIDATE-110's intent) OR add a separate `[ns:term]` scope check.
- `createTerm` / `updateTerm` / `delete` / `upsertTags` — same shape with appropriate permissions.

The cost is one DB round-trip per mutation (per ADR-CANDIDATE-106's stateless / no-cache stance) — acceptable for write paths. The defence-in-depth mitigates ANY future WebFilter / SecurityConstants drift.

**Severity rationale**: HIGH — compounding failure mode (defence-in-depth absence × REFACTOR-217 path-mismatch produces the unauthenticated-mutation surface); fixing either alone partially mitigates; fixing both closes the surface.

**Suggested backlog grouping**: `Authorization audit batch` (paired with REFACTOR-217, REFACTOR-227)

---
