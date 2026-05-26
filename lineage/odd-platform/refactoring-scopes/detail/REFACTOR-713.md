## REFACTOR-713 — LookupTables H1 row leaks GLOBAL POPULATION SIZE — "X lookup tables overall" counter is rendered for every authenticated user regardless of LOOKUP_TABLE permissions; `facets.total` is computed by `LookupDataSearchServiceImpl.countByState` with NO owner-filter, NO namespace-scope, NO per-permission filter

**Severity**: MEDIUM
**Category**: cross-owner-information-disclosure / global-count-leak
**Batch**: ZL (2026-05-26)
**Pillars affected**: [P-03 Master Data Management, P-09 Authorization]

**Surfaced by**:
- `odd-platform__ts__react-component__component__LookupTables.md:bugs_limitations_corner_cases[4]` (MEDIUM) — "Counter leaks population size: the H1 row renders `<NumberFormatted value={facets?.total} /> {t('lookup tables overall')}` (line 60-62). `facets.total` comes from `LookupDataSearchServiceImpl.countByState` which counts ALL tables matching the (empty) query — there is no owner-filter, no namespace-scope, no per-permission filter applied. Any authenticated user (per the read-collaborative posture confirmed in the ReferenceDataController sidecar known_security_gaps[0]) sees the global lookup-table population size, even if backend RBAC would limit which individual rows they can act on." — evidence: LookupTables.tsx:60-62 + LookupDataSearchServiceImpl.java:62-68 + cross-ref ReferenceDataController sidecar — severity: MEDIUM
- `odd-platform__ts__react-component__component__LookupTables.md:security.known_security_gaps[1]` (MEDIUM) — "Global count leak via the 'X lookup tables overall' counter — every authenticated user sees the platform-wide population size. No owner-filter applied at LookupDataSearchServiceImpl.countByState."
- `odd-platform__ts__react-component__component__LookupTables.md:security.data_exposure[0]` (HIGH) — "Global lookup-table count → any authenticated user (via the 'X lookup tables overall' counter at LookupTables.tsx:60-62) — even users with no LOOKUP_TABLE permissions see the count of all tables in the platform"

**Statement**: `LookupTables.tsx:60-62` renders `<NumberFormatted value={facets?.total} /> {t('lookup tables overall')}` in the H1 row of the Master Data Management page. The `facets.total` value comes from the search-session GET endpoint (`GET /api/referencedata/search/{searchId}`) which returns `LookupDataSearchServiceImpl.countByState` (per `LookupDataSearchServiceImpl.java:62-68`).

The `countByState` method counts ALL lookup tables matching the (empty default) query. There is:
- NO owner-filter (the user's owner-mapping is NOT consulted)
- NO namespace-scope (cross-namespace count is returned)
- NO per-permission filter (the count includes tables the user can't write to, can't delete, can't read individual rows from)

The counter renders for EVERY authenticated user, including users with ZERO LOOKUP_TABLE permissions (no CREATE, no UPDATE, no DELETE). Such a user sees "47 lookup tables overall" without being able to use ANY of them via UI affordances.

**Operator-visible impact**:
- A read-only user sees the global lookup-table count. They cannot create/edit/delete, but they CAN see how many tables exist.
- An external consultant or auditor sees the population size, which reveals organisational structure (small/medium/large data infrastructure).
- A user enumerating the platform's data scope sees the counter as a quick indicator of platform usage.

The information leak is BOUNDED:
- The counter is JUST A NUMBER — no row content, no table names, no namespace identification at the H1 level.
- The list below the counter DOES leak per-row content (name, description, namespace) per security.data_exposure — that's a separate finding but compounds with this one.
- The counter is consistent with the read-collaborative posture (ADR-CANDIDATE-003) — GETs are uniformly visible to all authenticated users.

**Evidence**:
- `LookupTables.tsx:60-62` — `<NumberFormatted value={facets?.total} />` + `t('lookup tables overall')` rendering
- `LookupDataSearchServiceImpl.java:62-68` — `countByState` body with no owner/permission filter
- `ReferenceDataController.java:64-69` — `GET /api/referencedata/search/{searchId}` returns the count
- `ReferenceDataController` sidecar `known_security_gaps[0]` — confirms read endpoints have no RBAC at SECURITY_RULES
- intent_anchor: the `total` field on `SearchFacetsData` IS the architectural surface for the count; the absence of any per-permission filter is the structural choice

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-003 (read-collaborative posture — GETs are authenticated-only with no role/owner gate). The Master Data Management pillar follows this posture; the counter leak is the OPERATOR-FACING manifestation. The architectural fix decisions are:

- Accept the read-collaborative posture and DOCUMENT the count leak as a deliberate design choice.
- OR: add owner-scoping to the count (would require API change + permission framework extension).
- OR: hide the counter for users without LOOKUP_TABLE_VIEW (a permission that doesn't exist today).

**Proposed remedy**: Three options, in increasing scope:

1. **LOWEST cost — documentation**:
   - Update the live docs to state "every authenticated user sees the global lookup-table count"
   - The current docs (`https://docs.opendatadiscovery.org/features/master-data-management/lookup-tables`) don't address this either way
   - Effort: small

2. **MEDIUM cost — hide counter for non-LOOKUP_TABLE users**:
   - Wrap the counter row in `<WithPermissions permissionTo={Permission.LOOKUP_TABLE_*}>` (any of CREATE/UPDATE/DELETE)
   - Users with zero LOOKUP_TABLE permissions don't see the counter
   - Trade-off: changes the UX shape; the counter is a useful affordance for users with at least one permission
   - Effort: small

3. **HIGHEST cost — owner-scoped count**:
   - Add owner-filter to `countByState`
   - Return only the count of tables the current user can act on
   - Requires permission framework extension (per-namespace permissions or LOOKUP_TABLE_LIST permission)
   - Effort: high; breaks compat with the read-collaborative posture across the platform

**Recommended**: Option 1 (documentation) for short-term. Option 2 if the design wants to gate the counter affordance. Option 3 only if the entire platform is migrating away from read-collaborative posture.

**Severity rationale**: MEDIUM — the leak is operator-visible (the H1 counter is the first thing on the page) and informational (population size is a meaningful signal). Severity is bounded by:
- The leak is JUST A NUMBER — no row content at the counter site (per-row content leak is REFACTOR-NNN-counter sibling, not this one)
- The leak is consistent with the platform's read-collaborative posture (ADR-CANDIDATE-003)
- The leak is undocumented (no docs explain the visibility model — see Option 1)

Not LOW because:
- The counter is a Front-and-centre H1 affordance, not buried in a sub-page
- A user with ZERO LOOKUP_TABLE permissions still sees the counter — the worst case for this leak

**Suggested backlog grouping**: `DOC-NNN Master Data Management pillar fix sprint` — pair with REFACTOR-711 (InfiniteScroll mismatch), REFACTOR-712 (namespace_name silent discard), REFACTOR-714 (per-keystroke PUT). Also pair with REFACTOR-024 family (cross-owner data exposure — broader read-collaborative posture documentation).

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-003 (read-collaborative posture — this is one operator-facing manifestation); REFACTOR-024 family (cross-owner data exposure); REFACTOR-057 (Activity counts cross-owner exposure — sibling pattern on a different feature).
- SUPERSEDES: none.
- CONFLICTS: none.

---
