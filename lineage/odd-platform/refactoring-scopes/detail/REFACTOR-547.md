## REFACTOR-547 — `TagServiceImpl` service-tier ZERO authorisation gates — controller perimeter is SOLE auth defence; any path-pattern drift (REFACTOR-217 class) silently bypasses

**Severity**: MEDIUM
**Category**: missing-authz-gate (defence-in-depth)
**Surfaced by**:
- `TagServiceImpl.md:stress_findings.S-D-1` (CANARY HEADLINE — SERVICE-LAYER AUTH POSTURE) — "Across all 9 public methods (`:37, 45, 57, 73, 80, 89, 97, 124, 137`), the service has: ZERO @PreAuthorize, ZERO permissionService.hasPermission, ZERO OwnerAuthorizationFacade, ZERO SecurityContextHolder reads, ZERO programmatic permission checks"
- `TagServiceImpl.md:stress_findings.auth_gates[]` — `[]` empty with rationale "no gates at this layer" (verified end-to-end line-by-line)
- `TagServiceImpl.md:bugs_limitations_corner_cases` (multiple entries pointing at the auth-zero posture)
- `TagServiceImpl.md:security.authorization_assertions` `[]` (verified absence; 168-line file end-to-end)
- `TagServiceImpl.md:security.known_security_gaps[0]` (the auth-zero posture confirmed)
- `TagServiceImpl.md:implicit_adrs[0]` (frames the auth-zero as intentional; this REFACTOR is the GAP framing — the absence is intentional BUT undefended by anything except path-pattern matching)
- `TagController.md:invariants[5]` ("Authorisation is controller-tier-only — the service-tier (`TagServiceImpl`) has ZERO `@PreAuthorize` or programmatic permission checks (`:1-167` end-to-end). The controller perimeter is the SOLE defence.")
- `TagController.md:security.known_security_gaps[2]` ("Service-tier zero-checks posture — controller perimeter is SOLE authorisation defence; any path-pattern drift (REFACTOR-217 class) bypasses authorisation. — severity: MEDIUM")

**Description**: `TagServiceImpl.java:1-167` contains ZERO authorization gates of any kind. The five side-door surfaces that invoke `TagServiceImpl` methods (`TermServiceImpl.upsertTags`, `DataEntityServiceImpl.upsertTags`, `DatasetFieldServiceImpl` x2 call sites, `ExternalTagIngestionRequestProcessor.process`) each apply their own per-feature permission gate (`TERM_TAGS_UPDATE`, `DATA_ENTITY_TAGS_UPDATE`, `DATASET_FIELD_TAGS_UPDATE`, S2S filter respectively) — but `TAG_CREATE` is NEVER held even though directory rows are minted (the REFACTOR-223 side-door is the canonical case-law). The controller perimeter is the SOLE auth defence; any path-pattern drift (REFACTOR-217 class — `/term` vs `/terms` silent disabling) silently bypasses authorisation with NO secondary defence.

The pattern at this service is consistent with ADR-CANDIDATE-002 (centralized SECURITY_RULES — the platform's structural choice to gate at the perimeter via path-pattern matching, not at the service via annotations). BUT the consequence — a single layer of defence with no secondary check — is the cross-cutting gap. The TagServiceImpl is one of N services on the platform with the same posture; this REFACTOR specifically captures the **Tag-tier instance** of the cross-cutting REFACTOR-073 (no boot-time security-posture validator) + REFACTOR-217 (the path-pattern drift class) family.

**Per-method auth coverage map** (from `TagServiceImpl.md:stress_findings.S-D-1`):

| Method | Auth gate | DISABLED | LOGIN_FORM / OAUTH2 / LDAP | S2S |
|---|---|---|---|---|
| `bulkCreate` | Controller `TAG_CREATE` | Open | TAG_CREATE | Not on path |
| `update` | Controller `TAG_UPDATE` | Open | TAG_UPDATE | Not on path |
| `delete` | Controller `TAG_DELETE` | Open | TAG_DELETE | Not on path |
| `listMostPopular` | Controller catch-all `authenticated()` | Open | Any authenticated user — full directory readable | Not on path |
| `getOrCreateTagsByName` | Side-door — varies | Open | TERM_TAGS_UPDATE / DATA_ENTITY_TAGS_UPDATE / DATASET_FIELD_TAGS_UPDATE per call site — **NEVER `TAG_CREATE`** | Not on this path |
| `getOrInjectTagByName` | Side-door — Collector | Open | N/A | `auth.ingestion.filter.enabled` S2S — **NEVER `TAG_CREATE`** |
| `updateRelationsWithDataEntity` | Side-door — DataEntity | Open | DATA_ENTITY_TAGS_UPDATE | Not on path |
| `deleteRelationsWithTerm` | Side-door — Term | Open | TERM_TAGS_UPDATE (inferred) | Not on path |
| `createRelationsWithTerm` | Side-door — Term | Open | TERM_TAGS_UPDATE (inferred) | Not on path |

**Primary source citations**:
- `TagServiceImpl.java:1-167` (verified absence end-to-end)
- `TagController.java:1-53` (perimeter-only enforcement; thin delegate)
- `SecurityConstants.java:138-142` (the THREE write-side SECURITY_RULES entries — no GET entry, no service-tier entry)
- `AuthorizationCustomizer.java:29-30` (catch-all `pathMatchers("/**").authenticated()` — the floor)
- The 5 side-door call sites: `TermServiceImpl.java:257`, `DataEntityServiceImpl.upsertTags` (REFACTOR-223), `DatasetFieldServiceImpl.java:202, 266`, `ExternalTagIngestionRequestProcessor.java:104`

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-002 (centralized SECURITY_RULES at controller perimeter) is the architectural commitment. The maintainer's intent is "auth lives at the perimeter, NOT at the service tier" — this is the structural choice. The GAP is the absence of DEFENCE IN DEPTH: when the perimeter's path-pattern drifts (REFACTOR-217 class), the service-tier doesn't catch it. ADR-CANDIDATE-068 (two-tier soft-delete taxonomy) implicitly carries the same posture for soft-delete enforcement — single-layer at the repository.

**Proposed remedy**: This is borderline ACCEPT vs HARDEN. The maintainer should choose:

1. **Accept and codify**: The "controller perimeter is sole auth defence" stance is an INTENT decision worth its own ADR. ADR-CANDIDATE-002 codifies the perimeter side; a complementary ADR could codify the explicit acceptance that service-tier carries no secondary check, with the trade-off named (single-audit-point vs no-defence-in-depth-on-path-pattern-drift). The acceptance choice means REFACTOR-217-class drifts are caught by **integration tests + CI path-pattern diff checks** (the REFACTOR-009 prescription), not by a runtime gate.

2. **Harden — add programmatic permission check to side-door surfaces**: In `getOrCreateTagsByName`, `getOrInjectTagByName`, `updateRelationsWithDataEntity`, `deleteRelationsWithTerm`, `createRelationsWithTerm`, add a `permissionService.hasPermission(...)` check (programmatic) before mutation. UX trade-off: per-data-entity-owners must hold `TAG_CREATE` to introduce novel names via the side-door — breaks the spec-acknowledged auto-create UX (ADR-CANDIDATE-065). Performance trade-off: per-call permission lookup.

3. **Harden — add @PreAuthorize at service methods**: Spring Security supports `@PreAuthorize` on service beans. UX trade-off: same as Option 2 but cleaner code. Architectural trade-off: contradicts ADR-CANDIDATE-002's "no @PreAuthorize" stance.

**Recommended**: Option 1 (Accept and codify) + investment in REFACTOR-009 (CI path-pattern diff check that catches REFACTOR-217-class drift at PR review). The defence-in-depth concern is real but is best addressed by a CI guard, not by adding a second runtime layer.

**Severity rationale**: MEDIUM — the absence of service-tier defence-in-depth is a known structural trade-off (ADR-CANDIDATE-002 codifies the controller-perimeter stance). The severity is bounded by:
- The perimeter IS enforced under non-DISABLED auth modes (REFACTOR-185 captures the DISABLED bypass cross-cuttingly).
- The side-door surfaces' per-feature permissions ARE checked at their own controllers (REFACTOR-223 captures the scope-asymmetry consequence).
- The path-pattern drift class is rare (REFACTOR-217 is the singular known case).

This is the **service-tier confirmation** of the cross-cutting REFACTOR-073 (no boot-time security-posture validator) family — the Tag-tier instance is one of N. The novelty of this entry is that it surfaces the systematic 9-method auth-zero pattern at one service in detail, providing per-method evidence for the cross-cutting cataloging.

**Suggested backlog grouping**: SEC-NNN authorization-audit sprint. Pair with REFACTOR-223 (side-door scope-asymmetry), REFACTOR-217 (path-pattern drift class), REFACTOR-073 (boot-time validator). The four are facets of the same architectural commitment: ADR-CANDIDATE-002's perimeter stance + the gaps that the stance leaves un-defended-in-depth.

---
