## REFACTOR-554 — `TagController.getPopularTagList` has NO RBAC SecurityRule entry — global tag-directory enumeration available to every authenticated user; under DISABLED, anonymous

**Severity**: MEDIUM
**Category**: missing-auth (open-read)
**Surfaced by**:
- `TagController.md:bugs_limitations_corner_cases[4]` ("No RBAC gate on `getPopularTagList` — global tag directory enumeration available to every authenticated user — Combined with the side-door write paths, an authenticated user with only `DATA_ENTITY_TAGS_UPDATE` can both READ and WRITE the global tag directory without holding any `TAG_*` permission" — MEDIUM)
- `TagController.md:invariants[3]` ("`getPopularTagList` is NOT RBAC-gated — only the three write endpoints have SecurityRule entries (`SecurityConstants.java:138-142`). The read endpoint inherits the catch-all `authenticated()` rule.")
- `TagController.md:security.known_security_gaps[2]` ("Open-read posture on `getPopularTagList`")
- `TagController.md:docs_link_semantic.doc_drift_findings[3]` ("Live permissions page does NOT mention that GET `/api/tags` has NO RBAC gate beyond authentication")
- `TagController.md:stress_findings.auth_gates[0]` (the absence-of-gates finding for the GET endpoint)
- `TagController.md:tests_coverage_semantic.uncovered_behaviours[getPopularTagList authorisation absence]` (MEDIUM)
- `TagServiceImpl.md:security.data_exposure` (`Mono<TagsResponse>` from `listMostPopular` → globally-ordered tag directory → any authenticated user, no owner filter, no per-tag permission check)

**Description**: `SecurityConstants.SECURITY_RULES` (`:138-142`) registers permission gates for THREE write endpoints on the tag directory:
- POST `/api/tags` → `TAG_CREATE`
- PUT `/api/tags/{tag_id}` → `TAG_UPDATE`
- DELETE `/api/tags/{tag_id}` → `TAG_DELETE`

The READ endpoint `GET /api/tags` (mapped to `TagController.getPopularTagList`) has NO entry. It falls through to `AuthorizationCustomizer.customize`'s catch-all `pathMatchers("/**").authenticated()` (`AuthorizationCustomizer.java:29-30`). The effective auth posture:

| Auth mode | `GET /api/tags` reachable by |
|---|---|
| `DISABLED` | ANYONE (no auth at all) — REFACTOR-185 cross-cutting bypass |
| `LOGIN_FORM` | Any logged-in user |
| `OAUTH2` | Any authenticated user |
| `LDAP` | Any LDAP-authenticated user |

There is no per-Owner filter, no per-tenant scoping, no namespace partition — the response is the GLOBAL tag directory, in toto. Combined with the side-door write paths (REFACTOR-223 — `DATA_ENTITY_TAGS_UPDATE` mints global rows), the consequence:

- A user holding only `DATA_ENTITY_TAGS_UPDATE` on a single data entity can both:
  - WRITE global tag rows via `PUT /api/dataentities/{id}/tags` (REFACTOR-223 side-door)
  - READ the entire global tag directory via `GET /api/tags` (this REFACTOR)

The `TAG_CREATE` permission, marketed as the gate for tag-directory mutation, is BYPASSED on both sides — write via REFACTOR-223, read via this REFACTOR.

**Cross-cutting context**: This is the Tag-tier instance of ADR-CANDIDATE-003 (GET endpoints are intentionally outside SECURITY_RULES; reads are uniformly authenticated-only). The pattern is consistent across the platform; the QUESTION is whether the Tag READ endpoint is in the same trust-collaborative-read family. Per the live tagging doc page (WebFetch 2026-05-20), the Tag directory is described as "operator-managed catalog vocabulary" — implying a globally-shared namespace. The read-collaborative posture is INTERNALLY consistent with this UX framing.

The novelty here is the COMBINATION with the side-door (REFACTOR-223): the tag directory is BOTH read-collaborative AND write-collaborative (via the side-door). This is the Tag-tier embodiment of "trust gradient is bidirectional but undefended" — the read posture says "global namespace, all authenticated users see it" AND the write posture says "any data-entity-owner can grow it." Without per-tenant / per-namespace partition, the directory IS the global shared state.

**Primary source citations**:
- `TagController.java:36-44` (the read endpoint, no `@PreAuthorize`)
- `SecurityConstants.java:138-142` (the three write-side entries; no GET entry)
- `AuthorizationCustomizer.java:29-30` (catch-all fallback `.authenticated()`)
- `TagServiceImpl.java:72-77` (service-tier, no programmatic check)
- `ReactiveTagRepositoryImpl.java:137-167` (repository-tier — no per-owner filter; `listMostPopular` is globally scoped)
- The live permissions doc page (WebFetched 2026-05-19/2026-05-20) does NOT document this open-read posture

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-003 (GET-uniformly-authenticated) prescribes this pattern across the platform. The pattern is intentional for the read-collaborative posture. The GAP here is the COMBINATION with REFACTOR-223 (side-door write), which together produce the "tag directory is globally read-write to any per-entity-owner" surface. The maintainer's choice to leave GET unguarded is consistent with the platform's read-collaborative stance; the COMPOSITION with side-door writes is undocumented.

**Proposed remedy**: This is borderline ACCEPT vs HARDEN. The maintainer should choose:

1. **Accept and document (recommended given ADR-CANDIDATE-003)**: Add an admonition to the live permissions doc page (`docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions`) clarifying that `GET /api/tags` has NO RBAC gate. Update the tagging doc page (`docs.opendatadiscovery.org/features/data-discovery/tagging`) to clarify that the tag directory is globally shared. Pair with REFACTOR-223's "accept" remedy. This is the simplest path AND aligns with the architectural commitment.

2. **Harden with a SecurityRule entry**: Add `new SecurityRule(NO_CONTEXT, new PathPatternParserServerWebExchangeMatcher("/api/tags", GET), TAG_READ)` to `SecurityConstants.SECURITY_RULES`. Trade-off: requires a new `TAG_READ` permission (MANAGEMENT scope?), breaks the read-collaborative pattern, changes the UX for users without `TAG_READ` (they can't see the tag-search facet — bad UX). Operators would need to grant `TAG_READ` to every user role that needs to read tags (which is every role).

3. **Harden with per-tenant scoping (architectural)**: Introduce a `namespace_id` or `owner_id` column on the `tag` table. Per-tenant filter on reads. Trade-off: massive architectural change; breaks the spec-acknowledged auto-create UX (ADR-CANDIDATE-065); changes the operator's mental model.

**Recommended**: Option 1. Tied to REFACTOR-223's accept path. The doc-side hardening covers the UX gap without breaking the architectural pattern. If a future use case demands per-tenant tag isolation, Option 3 is a structural undertaking that warrants its own ADR.

**Severity rationale**: MEDIUM — pattern-shape information disclosure with broad blast radius (every authenticated user sees every tag in the directory). Bounded by:
- ADR-CANDIDATE-003 (read-collaborative GET) makes this consistent with the platform's posture; not a defect, an intentional design.
- The information leaked is "tag names + popular usage counts" — operationally sensitive but not high-value (no PII, no credentials).
- Under `auth.type=DISABLED` (REFACTOR-185), the anonymous-reach concern dominates; under non-DISABLED modes, the user-population is bounded to authenticated platform users.

The compounding with REFACTOR-223 (side-door write) elevates the severity above pure read-only-information disclosure: an attacker who can WRITE the directory AND READ it can use the directory as a covert-channel / namespace pollution vector across tenants.

**Suggested backlog grouping**: SEC-NNN authorization-audit sprint. Pair with REFACTOR-223, REFACTOR-024, REFACTOR-053, REFACTOR-187 — the read-collaborative-blast-radius family. The Tag-tier instance is the smallest by data-volume but the most fundamental (the tag directory is referenced across every feature).

---
