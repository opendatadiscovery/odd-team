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

## STRENGTHENS — TermServiceImpl (batch K, SERVICE-LAYER triangulation + COMPOUNDING with defence-in-depth absence)

**Service-layer triangulation confirms the bypass is COMPOUND**. The batch-I sidecar surfaced this from the controller-method side (`addDataEntityTerm`); the batch-K TermServiceImpl sidecar adds the SERVICE-LAYER framing: the service tier has ZERO permission checks (per REFACTOR-318 NEW batch K — defence-in-depth absence), so the path-mismatch IS the SOLE control. Combined, the failure mode is COMPOUNDED: the primary gate fails AND there is no secondary gate.

**New batch-K evidence**:
- `TermServiceImpl.md:bugs_limitations_corner_cases.[0]` (HIGH): "REFACTOR-217 path-mismatch primary source — `DATA_ENTITY_ADD_TERM` is unenforced for `POST /api/dataentities/{id}/terms`. `SecurityConstants.java:237-239` registers a matcher on `/api/dataentities/{data_entity_id}/term` (singular); OpenAPI declares the operation at `/api/dataentities/{data_entity_id}/terms` (plural — `openapi.yaml:973`). The matcher never fires; the `linkTermWithDataEntity` service method (`TermServiceImpl.java:170-179`) is reachable by any authenticated user."
- `TermServiceImpl.md:security.authorization_assertions: []` (NEW finding): "N/A. `TermServiceImpl` performs NO service-tier permission checks. All authorization is supposed to happen at the controller perimeter via `SecurityConstants.SECURITY_RULES` matchers in `AuthorizationCustomizer`. The service tier blindly trusts the call. Per the REFACTOR-217 path-mismatch finding, the controller-tier gate does NOT fire for `POST /api/dataentities/{id}/terms` and `DELETE /api/dataentities/{id}/terms/{term_id}` — making the entire term-linkage surface effectively unauthenticated-mutation-allowed."

**Compounding finding**: REFACTOR-217 + REFACTOR-318 NEW = the failure mode where BOTH the primary gate AND the absence of a secondary gate compose. Fixing REFACTOR-217 alone closes the path-mismatch but leaves the defence-in-depth absence; fixing REFACTOR-318 alone (adding service-tier checks) closes the bypass but leaves the path-mismatch in the SECURITY_RULES table as a misleading artefact. Both should be fixed.

**Cross-batch triangulation**:
- batch-I (addDataEntityTerm controller-method): controller-side framing
- batch-K (TermServiceImpl PRIMARY SERVICE-LAYER): service-side framing + NEW defence-in-depth absence finding

**Severity unchanged**: HIGH. Cross-link with REFACTOR-318 NEW (defence-in-depth absence at TermServiceImpl), REFACTOR-314 NEW (second SecurityConstants bug — `/api/alerts/{id}/status` PUT gated by DATASET_FIELD_ADD_TERM).

## STRENGTHENS — `deleteTermFromDataEntity` controller-method (batch L, DELETE-half PRIMARY-SOURCE confirmed symmetrically)

**The DELETE half of the path-mismatch is now PRIMARY-SOURCE confirmed from its own dedicated sidecar.** Batch I surfaced the DELETE-mismatch as a secondary finding in the `addDataEntityTerm` sidecar (`bugs_limitations_corner_cases.[1]`); batch L adds the `deleteTermFromDataEntity` controller-method sidecar with FOUR independent primary-source citations triangulating the mismatch — closing the loop with full per-endpoint sidecar evidence.

**New batch-L evidence**:
- `deleteTermFromDataEntity.md:understanding` (headline) — "the `DATA_ENTITY_DELETE_TERM` permission gate is silently dead due to a SecurityRule path-mismatch. `SecurityConstants.java:240-242` registers `new PathPatternParserServerWebExchangeMatcher(\"/api/dataentities/{data_entity_id}/term/{term_id}\", DELETE)` (SINGULAR `term`); the OpenAPI spec at `openapi.yaml:1042` declares the operation path as `/api/dataentities/{data_entity_id}/terms/{term_id}` (PLURAL); the controller `@Override` inherits the plural path from the generated `DataEntityApi`. `AuthorizationCustomizer.customize` (`AuthorizationCustomizer.java:24-30`) only fires the permission check when `rule.matcher()` matches the request — the singular matcher never matches — and the no-match fallback is `.pathMatchers(\"/**\").authenticated()` (line 29-30)"
- `deleteTermFromDataEntity.md:bugs_limitations_corner_cases.[0]` (HIGH) — "HEADLINE: SecurityRule path mismatch silently disables `DATA_ENTITY_DELETE_TERM` authorization (PRIMARY-SOURCE confirmed) — Net effect: ANY authenticated user under LOGIN_FORM/OAUTH2/LDAP can `DELETE /api/dataentities/{id}/terms/{termId}` and unlink any term from any data entity, regardless of whether their Policy set includes `DATA_ENTITY_DELETE_TERM`. SYMMETRIC counterpart of the addDataEntityTerm finding (batch G). REFACTOR-217 covers the fix for BOTH POST and DELETE"
- `deleteTermFromDataEntity.md:security.authorization_assertions` (verbatim): "INTENDED: `SecurityRule(DATA_ENTITY, '/api/dataentities/{data_entity_id}/term/{term_id}' DELETE, DATA_ENTITY_DELETE_TERM)` — declared in `SecurityConstants.SECURITY_RULES[240-242]`. ACTUAL: not enforced (path mismatch). FALLBACK ACTUAL: `.pathMatchers(\"/**\").authenticated()` — `AuthorizationCustomizer.java:29-30`. Any authenticated caller passes; no permission is required for the actual endpoint"

**Compounding finding STRENGTHENED with the HARD-DELETE finality** (`deleteTermFromDataEntity.md:bugs_limitations_corner_cases.[4]`):
> "HARD-DELETE finality — no audit-restore path — once a term-relation is removed, the only record of its prior existence is the `TermAssignmentActivityHandler` BEFORE/AFTER JSON state in `activity` rows. The row in `data_entity_to_term` is physically gone (migration `V0_0_76__term_relations_hard_delete.sql:5-6` dropped the `deleted_at` column). An operator wanting to RESTORE a removed term-link must inspect the activity log and re-issue an `addDataEntityTerm` call (which writes a NEW row, not a restoration — the relation has no continuity-id). For high-stakes deployments with extensive term taxonomies, accidental removals via the path-mismatch-bug-enabled unauthorized caller require manual restoration via API calls."

This is a NEW compounding factor: REFACTOR-217 + HARD-DELETE finality = under `auth.type=DISABLED` on a network-reachable port, anyone can mass-delete all term-to-data-entity links and corrupt taxonomy data with no restore-from-row path. The activity-feed event provides the only forensic trail.

**Cross-batch triangulation (3-batch substrate)**:
- batch-I (addDataEntityTerm controller-method): POST-side framing
- batch-K (TermServiceImpl PRIMARY SERVICE-LAYER): service-side framing + defence-in-depth absence
- **batch-L (deleteTermFromDataEntity controller-method): DELETE-side PRIMARY-SOURCE confirmation + HARD-DELETE finality compounding**

**Severity unchanged**: HIGH. The DELETE-half PRIMARY-SOURCE confirmation completes the substrate's evidence basis — both POST and DELETE are now fully triangulated against `SecurityConstants` + `openapi.yaml` + `AuthorizationCustomizer` + the respective controller methods.

---
