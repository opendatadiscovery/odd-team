## REFACTOR-217 — SecurityRule `/term` singular vs OpenAPI `/terms` plural — path mismatch silently disables DATA_ENTITY_ADD_TERM and DATA_ENTITY_DELETE_TERM permission gates

**Severity**: HIGH
**Category**: buggy-default (path-mismatch class)
**Surfaced by**:
- `addDataEntityTerm.md:bugs_limitations_corner_cases[0]` (the POST mismatch — headline finding)
- `addDataEntityTerm.md:bugs_limitations_corner_cases[1]` (the DELETE mismatch — same shape, same root cause)

**Description**: `SecurityConstants.java:237-239` registers `new PathPatternParserServerWebExchangeMatcher("/api/dataentities/{data_entity_id}/term", POST)` (SINGULAR `term`); the OpenAPI spec at `openapi.yaml:973` declares the operation path as `/api/dataentities/{data_entity_id}/terms` (PLURAL). The controller `@Override` (`DataEntityController.java:149-156`) inherits the plural path from the generated `DataEntityApi`. `AuthorizationCustomizer.customize` (`AuthorizationCustomizer.java:24-30`) only invokes the `manager(rule.type(), extractors, permissionService, rule.permission())` permission check when `rule.matcher()` matches the request — the SINGULAR matcher does NOT match the PLURAL request path. The customizer's fallback at line 29-30 is `.pathMatchers("/**").authenticated()`. **Net effect: ANY authenticated user under LOGIN_FORM/OAUTH2/LDAP can `POST /api/dataentities/{id}/terms` and link any term to any data entity, regardless of whether their Policy set includes `DATA_ENTITY_ADD_TERM`.** The identical path-mismatch applies to the DELETE counterpart (`SecurityConstants.java:240-242` registers `…/term/{term_id}` SINGULAR vs `openapi.yaml:1042` PLURAL `…/terms/{term_id}`). The DataEntityPermissionExtractor / Policy-resolver pipeline is unreachable for term-linking on data entities.

**Primary source citations**:
- `SecurityConstants.java:237-239` (POST rule — SINGULAR `/term`)
- `SecurityConstants.java:240-242` (DELETE rule — SINGULAR `/term/{term_id}`)
- `openapi.yaml:973` (POST operation — PLURAL `/terms`)
- `openapi.yaml:1042` (DELETE operation — PLURAL `/terms/{term_id}`)
- `AuthorizationCustomizer.java:24-30` (path-pattern dispatch + fallback to `.authenticated()`)
- `DataEntityController.java:149-156` (POST `addDataEntityTerm` — inherits PLURAL path from `DataEntityApi`)
- `DataEntityController.java:158-163` (DELETE `deleteTermFromDataEntity` — same)

**Existing-ADR-or-implied-prescription**: The live Permissions doc (`https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions`, verified by batch F WebFetch on 2026-05-12 at status 200) lists `DATA_ENTITY_ADD_TERM` and `DATA_ENTITY_DELETE_TERM` and describes them as "allows adding/removing terms to/from a data entity." The IMPLIED prescription is that those permissions gate the term-link/unlink operations. The code intent (the SecurityRule entry exists, the permission enum exists, the UI `WithPermissions` wrap exists — `OverviewTerms.tsx:31, 94`) confirms the intended behaviour. ADR-CANDIDATE-062 (Two-permission split) is the prescription this scope violates: the architectural intent is fine-grained per-data-entity permission gating, and a path-string typo silently nullifies it.

**Proposed remedy**: Change the SecurityRule path strings to PLURAL to match the OpenAPI surface:
```
SecurityConstants.java:238  →  "/api/dataentities/{data_entity_id}/terms"
SecurityConstants.java:241  →  "/api/dataentities/{data_entity_id}/terms/{term_id}"
```
Add a `@WebFluxTest` regression in `DataEntityControllerTest` that asserts a user WITHOUT `DATA_ENTITY_ADD_TERM` receives 403 on `POST /api/dataentities/{id}/terms`. A single test would have caught this on commit. Cross-reference REFACTOR-009 (no compile-time / test-time guard against SECURITY_RULES path-pattern drift) — the long-term remedy is a build-time check that every OpenAPI path with a SECURITY_RULES match has a literal-string match.

**Severity rationale**: HIGH — silently disables authorization on a per-data-entity write surface; ANY authenticated user can link any term to any data entity; the UI's `WithPermissions` wrap creates a false sense of protection (UI hides the button while the server accepts the request from anyone). Under DISABLED mode, the gap is anonymous reachable. This is the highest-severity finding on the term-management surface and aligns with the format of REFACTOR-008 (an earlier identification of this exact bug). REFACTOR-217 is the PRIMARY-SOURCE confirmation with full triangulation.

**Suggested backlog grouping**: SEC-NNN authorization-audit sprint. Pair with TEST-GAP-017 (the authorization regression test) and REFACTOR-009 (the build-time path-pattern guard).

---
