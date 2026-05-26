## REFACTOR-626 — `/api/relationships/**` has ZERO authorization gate at any layer — cross-tenant + EXCLUDE_FROM_SEARCH bypass; every authenticated user (or anonymous under DISABLED) sees every relationship in the catalog

**Severity**: HIGH
**Category**: missing-auth (catalog-graph cross-tenant exposure)
**Pillars affected**: [P-02 Data Modelling, P-09 Security & Access Control]
**Batch**: ZE (2026-05-25)

**Surfaced by**:
- `odd-platform__java__RelationshipController__controller-class__RelationshipController.md:bugs_limitations_corner_cases.[1]` (HIGH) — "**No authorization gate at any layer — every endpoint is reachable by any authenticated caller (or anonymous under DISABLED)**: no @PreAuthorize, no SECURITY_RULES entry in SecurityConstants.java:95-355 for `/api/relationships/**`, no service-layer permission check, no repository OWNERSHIP JOIN. Cross-data-source visibility, cross-namespace visibility, and visibility of EXCLUDE_FROM_SEARCH=true relationships are all unrestricted. Whether this is intentional (catalog-as-public-metadata) or a security gap is the doc-drift question — the live data-modelling/relationships.md doc does NOT articulate the choice."
- `odd-platform__java__RelationshipController__controller-class__RelationshipController.md:concepts.invariants.[2]` — confirms the no-authz claim across all four layers (controller / SECURITY_RULES / service / repository)
- Probe `P-131` (the no-authz invariant + cross-data-source visibility)

**Description**: All three RelationshipController endpoints (`GET /api/relationships`, `GET /api/relationships/erd/{id}`, `GET /api/relationships/graph/{id}`) are reachable by any authenticated caller (or anonymous under `auth.type=DISABLED`) regardless of:
- Which Data Sources they have owner-scope on
- Which Namespaces are in their Policy
- Whether the underlying source/target entities have `EXCLUDE_FROM_SEARCH = true`
- Whether the underlying entities are `HOLLOW`

Verified across four layers (the no-authz claim is end-to-end):
1. **Controller** — `RelationshipController.java:1-44` has NO `@PreAuthorize` / no `permissionService.hasPermission(...)` call / no `@ConditionalOnProperty`.
2. **Spring Security Rules** — `SecurityConstants.java:95-355` (the full 357-line file) has NO entry matching `/api/relationships/**`. Falls through to `pathMatchers("/**").authenticated()` (LOGIN_FORM / OAUTH2 / LDAP) or `permitAll()` (DISABLED).
3. **Service** — `RelationshipsServiceImpl.java:30-49` has NO permission check; pure delegate to repository.
4. **Repository SQL** — `ReactiveDataEntityRelationshipRepositoryImpl.java:66-75` builds the conditionList from ONLY: `entity_class_ids = [DATA_RELATIONSHIP.id()=9]` AND an optional `DATA_ENTITY.EXTERNAL_NAME.containsIgnoreCase(query)` filter. NO `OWNERSHIP` JOIN, NO `data_source_id` filter, NO `namespace_id` filter, NO `EXCLUDE_FROM_SEARCH = false` predicate, NO `HOLLOW = false` predicate.

**The EXCLUDE_FROM_SEARCH asymmetry is the operator-actionable consequence**. The sibling `/api/dataentities` surface DOES apply the `EXCLUDE_FROM_SEARCH` filter (per batch-T REFACTOR-425). The relationships surface does NOT. An operator's deployment may have:
- A data source `internal_finance` with every entity marked `EXCLUDE_FROM_SEARCH = true` (operator intent: hide from search)
- A relationship row between `internal_finance.orders` and `internal_finance.payments`
- A non-finance user calls `/api/relationships?query=payments`
- The user sees the relationship — including the source/target entity NAMES — even though `/api/dataentities/?query=payments` would not surface those entities

The cross-tenant graph topology is exposed; the underlying entity reads remain access-controlled, but the GRAPH EDGES (which describe the structure) are public.

**Cross-link with ADR-CANDIDATE-215 NEW**: this REFACTOR is the operator-actionable consequence of the catalog-global read decision codified in ADR-CANDIDATE-215. The ADR carries a `borderline_flag` for the maintainer's triage:
- **If deliberate** (relationships are public-by-design metadata): preserve the absence; DOC-disclose the catalog-global + EXCLUDE_FROM_SEARCH-ignored posture on the live `data-modelling/relationships.md` page.
- **If oversight** (the filter was added to `/api/dataentities` but not extended to `/api/relationships`): add the filters at the repository layer.

**Primary source citations**:
- `RelationshipController.java:1-44` (no annotations)
- `SecurityConstants.java:95-355` (no rule)
- `RelationshipsServiceImpl.java:30-49` (no check)
- `ReactiveDataEntityRelationshipRepositoryImpl.java:66-75` (conditionList omits all access predicates)
- `AuthorizationCustomizer.java:29-30` (catch-all `.authenticated()`)
- `DisabledAuthSecurityConfiguration.java:11-19` (DISABLED-mode bypass)
- batch-T REFACTOR-425 (the EXCLUDE_FROM_SEARCH filter that the sibling endpoint applies but THIS endpoint does not)

**Existing-ADR-or-implied-prescription**: **ADR-CANDIDATE-215 NEW** codifies the catalog-global stance with the borderline_flag for triage; **ADR-CANDIDATE-003** is the parent read-collaborative posture. **REFACTOR-185** (DISABLED bypasses SECURITY_RULES) is the cross-cutting compound — under DISABLED-mode this REFACTOR's exposure extends to anonymous network callers.

**Proposed remedy**: Two-path; the maintainer chooses based on the ADR-CANDIDATE-215 borderline_flag resolution:

1. **DOC-DISCLOSE** (if the catalog-global posture is deliberate):
   - Update `documentation/docs/data-modelling/relationships.md` to disclose: "Relationships are catalog-global metadata — every authenticated user sees every relationship in the catalog regardless of ownership / namespace / `EXCLUDE_FROM_SEARCH` posture on the underlying entities. The graph topology is intentionally always visible; the underlying entity reads remain access-controlled. Multi-tenant deployments expose cross-tenant graph topology to every authenticated user. Operators wishing to hide a relationship must hide BOTH endpoints from ingestion or mark the relationship row itself with a (future) exclusion flag."
   - Add a security-section cross-link from the Policies page that documents `dataEntity:owner:title` conditions.

2. **STRUCTURAL** (if the catalog-global posture is oversight):
   - Add the OWNERSHIP / EXCLUDE_FROM_SEARCH / HOLLOW predicates to `ReactiveDataEntityRelationshipRepositoryImpl.java:66-75`'s conditionList (matching the sibling `/api/dataentities` pattern). The filter shape would JOIN against `OWNERSHIP` for the source AND target entities (asking "does the caller have read on at least one endpoint?") and gate the relationship visibility.
   - Add an integration test (the security class missing per the tests_coverage_semantic gap).

Option (2) is the multi-tenant-deployment-preferred path; option (1) is the read-collaborative-stance-preserved path. The maintainer's choice depends on the platform's target deployment posture.

**Severity rationale**: HIGH — schema-level cross-tenant exposure on a feature surface (P-02 Data Modelling). The blast radius extends to anonymous callers under DISABLED (compound with REFACTOR-185). The EXCLUDE_FROM_SEARCH asymmetry is the canonical concrete consequence — operators believe `EXCLUDE_FROM_SEARCH` hides entities; the relationships surface defies that intent.

**Suggested backlog grouping**: `Authorization audit batch` — couple with REFACTOR-185 (DISABLED bypass), REFACTOR-425 (EXCLUDE_FROM_SEARCH on /api/dataentities), REFACTOR-617 (Policies endpoint no SECURITY_RULES — sibling pattern), ADR-CANDIDATE-215 NEW (the architectural framing).

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-185 (DISABLED-bypass — adds /api/relationships as another anonymously-reachable surface); ADR-CANDIDATE-215 NEW (the architectural decision triage); ADR-CANDIDATE-003 (the read-collaborative parent posture).
- SUPERSEDES: none.
- CONFLICTS: none. (If the maintainer later resolves the borderline_flag toward "close the gate", this REFACTOR's STRUCTURAL remedy becomes the implementation.)

---
