## ADR-CANDIDATE-168 — Three-surface permission split for LookupTable RBAC (TABLE / DEFINITION / DATA) — operators can grant `edit-the-data` without `edit-the-schema`

**Severity**: MEDIUM
**Classification**: promote (NEW ADR; POSITIVE-INTENT — encodes RBAC design choice for P-03 pillar)
**Pillars affected**: [P-03-master-data-management, P-09-security-access-control, P-08-management-administration (steward role design)]
**Support count**: 1 sidecar primary-source (batch V ReferenceDataController class) + live-doc anchor at `https://docs.opendatadiscovery.org/features/master-data-management/lookup-tables` (verified 2026-05-20, status 200) explicitly enumerating the three-tier split with the rationale
**Axes present**: controllers, openapi-tag (cross-referenced)
**Batch**: V (2026-05-20)

**Surfaced by**:
- `ReferenceDataController__controller-class__ReferenceDataController.md:implicit_adrs.[2]` (HIGH) — "Three-surface permission split (table / definition / data) — operators can grant 'edit the data' without 'edit the schema'." — evidence: PolicyPermissionDto.java:80-88 (the 9-permission enumeration with MANAGEMENT category) + live doc page WebFetched 2026-05-20 quoting "The split lets operators grant edit-the-data without grant-edit-the-schema (a typical pattern for steward-curated reference lists)" — intent_anchor: doc quote + the consistent _CREATE/_UPDATE/_DELETE triad across LOOKUP_TABLE / LOOKUP_TABLE_DEFINITION / LOOKUP_TABLE_DATA in `PolicyPermissionDto`

**Decision statement**: LookupTable RBAC is split into THREE independent permission triads (9 permissions total), each gating a distinct surface of the lookup-table lifecycle:

- **TABLE tier** (3 permissions) — `LOOKUP_TABLE_CREATE / _UPDATE / _DELETE`
  - Gates create / rename (RENAME TO at `ReferenceDataRepositoryImpl.java:181-202`) / delete (DROP TABLE at lines 268-277) of the table itself.
  - Wired at SecurityConstants.java:114-115 (POST /table → LOOKUP_TABLE_CREATE), 326-330 (PUT/DELETE /table/{id} → LOOKUP_TABLE_UPDATE/DELETE).
- **DEFINITION tier** (3 permissions) — `LOOKUP_TABLE_DEFINITION_CREATE / _UPDATE / _DELETE`
  - Gates create / rename / delete of columns (schema changes via ALTER TABLE ADD COLUMN / RENAME COLUMN / DROP COLUMN).
  - Wired at SecurityConstants.java:331-342 (POST /columns → LOOKUP_TABLE_DEFINITION_CREATE; PATCH /column/{id} → _UPDATE; DELETE /column/{id} → _DELETE).
- **DATA tier** (3 permissions) — `LOOKUP_TABLE_DATA_CREATE / _UPDATE / _DELETE`
  - Gates create / update / delete of rows (operator-curated reference values).
  - Wired at SecurityConstants.java:343-354 (POST /data → LOOKUP_TABLE_DATA_CREATE; PUT /data/{id} → _UPDATE; DELETE /data/{id} → _DELETE).

The architectural commitments:
- **(a) Three INDEPENDENT triads.** A Policy can grant `LOOKUP_TABLE_DATA_UPDATE` WITHOUT granting `LOOKUP_TABLE_DEFINITION_UPDATE` — letting reference-data stewards curate the rows of a customer-tier lookup table without altering its schema. This is the typical pattern for steward-curated reference lists (e.g. country-code tables, status-code tables) where the schema is fixed by IT but the rows change with business policy.
- **(b) The tiers are CONSISTENT.** Each tier has the same three verbs (CREATE / UPDATE / DELETE) for symmetry. The 9-permission enumeration in `PolicyPermissionDto.java:80-88` is a closed catalog; future tier additions (e.g. INDEX, CONSTRAINT) would require adding a new tier rather than overloading the existing tiers.
- **(c) Permissions are NO_CONTEXT (platform-wide, not per-table).** All 9 SecurityRule entries use the NO_CONTEXT resolver — a Policy granting `LOOKUP_TABLE_DEFINITION_UPDATE` applies to ALL lookup tables, not just those owned by the granted user's Owner. This is a structural choice consistent with the lookup-tables-as-platform-wide-reference-data mental model (per ADR-CANDIDATE-166) but contradicts the per-table-ownership UX that the RBAC docs imply for DATA_ENTITY/TERM-context-scoped permissions.
- **(d) There is NO `_READ` tier.** All read endpoints (`GET /table/{id}`, `GET /table/{id}/columns/{id}`, `GET /table/{id}/data`, the search endpoints) fall through to `.authenticated()` — the read-collaborative posture (per ADR-CANDIDATE-003). The three-tier split applies ONLY to mutations.

**Wisdom test**: PASS on all three questions.
1. **Intentional?** YES — three independent commitments: the explicit 9-permission enumeration in `PolicyPermissionDto`; the verbatim doc-side rationale ("operators can grant 'edit the data' without 'edit the schema'"); the consistent _CREATE/_UPDATE/_DELETE triad across the three tiers.
2. **Structural impact?** YES — every RBAC policy author chooses which tier to grant; collapsing the three tiers into one `LOOKUP_TABLE_UPDATE` permission would BREAK operator role-design AND remove the steward-curated-data-without-schema-edit affordance.
3. **Refactoring or structural?** STRUCTURAL — adding a 4th tier (e.g. INDEX) requires adding 3 new permissions + 3 new SecurityRule entries + per-tier wiring; collapsing tiers requires migrating existing Policies; both are structural changes.

**Existing ADR**: none in `adrs/`. Cross-references ADR-CANDIDATE-002 (centralized SECURITY_RULES) — the three tiers are wired through the same centralized table; cross-references ADR-CANDIDATE-003 (read-collaborative GET posture) — the absence of a `_READ` tier follows the platform-wide read pattern.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-486 NEW batch V (`updateLookupTableField` discards `lookupTableId` — a holder of `LOOKUP_TABLE_DEFINITION_UPDATE` on table A can edit a column of table B by URL-spoofing because the service signature drops `lookupTableId` from the parameter list; cross-link to the parallel REFACTOR-024 cross-owner enumeration family).
- NO_CONTEXT scoping consequence: a Policy granting `LOOKUP_TABLE_*_UPDATE` permits modifying ANY lookup table (per ReferenceDataController sidecar `security.known_security_gaps.[2]`).
- No `_READ` tier: a lookup table containing sensitive reference data (employee codes, customer-tier mappings) cannot be hidden from non-MANAGEMENT users (per ReferenceDataController sidecar `security.known_security_gaps.[0]`).
- Per-table cascade orphan-row class: deleting a lookup table via the catalog's DataEntity TTL bypasses the controller-orchestrated cascade (per ReferenceDataController sidecar `bugs_limitations_corner_cases.[3]`).

**Proposed action**: Promote to `adrs/drafts/lookup-tables-three-tier-rbac.md` (new ADR). Document the three tiers + the steward-curated-rows use case + the absence of a `_READ` tier (read-collaborative posture) + the NO_CONTEXT resolver consequence (permissions are NOT scoped to individual tables — a policy granting `LOOKUP_TABLE_DEFINITION_UPDATE` applies globally) + the cross-link to ADR-CANDIDATE-166 (the physical-Postgres storage that these permissions gate).

**Severity rationale**: MEDIUM — encodes RBAC design choice for the P-03 pillar; not security-critical but operationally load-bearing for steward role design; the absence of a `_READ` tier + the NO_CONTEXT resolver are structural choices that operators need to understand.

---
