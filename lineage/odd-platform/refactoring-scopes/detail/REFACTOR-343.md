## REFACTOR-343 — DEG-lineage cross-owner CO-MEMBERSHIP enumeration — the DEG-anchored sibling of REFACTOR-203 with materially wider blast radius via per-connected-component subgraph leakage; multi-team Domains disclose organisational structure to any authenticated user

**Severity**: HIGH
**Category**: enumeration-vector (read-collaborative blast radius)
**Pillars affected**: [P-01-data-discovery, P-05-data-lineage, P-09-security-access-control]
**Batch**: M (2026-05-19)

**Surfaced by**:
- `odd-platform__java__DataEntityController__controller-method__getDataEntityGroupsLineage.md:bugs_limitations_corner_cases.[0]` (HIGH) — "**Anchor-set defence-in-depth is NOT applied** — `getDataEntityGroupLineage` accepts the DEG ID from the controller path and resolves the member set via `groupEntityRelationRepository.getDEGEntitiesOddrns(dataEntityGroupId)` (LineageServiceImpl.java:61) WITHOUT calling `authIdentityProvider.fetchAssociatedOwner()` or any owner check. The service has no `AuthIdentityProvider` field (verified by reading LineageServiceImpl.java:54-57). Any authenticated user (or under DISABLED any unauthenticated probe) can read ANY DEG's lineage graph including the member entity metadata for entities owned by other teams. This is the **DEG-anchored sibling** of REFACTOR-203 (per-entity lineage cross-owner enumeration); the DEG itself is treated as the anchor with no per-DEG permission gate."
- `odd-platform__java__DataEntityController__controller-method__getDataEntityGroupsLineage.md:bugs_limitations_corner_cases.[1]` (HIGH) — "**DEG cross-owner enumeration is GRAPH-SHAPED on a per-component basis** — the response surface is wider than per-entity lineage in one sense: the operator reading a DEG's lineage sees the CO-MEMBERSHIP shape of every team's entities that happen to be in that DEG (the per-connected-component partitioning at `establishDEGRelations` LineageServiceImpl.java:200-216 emits one stream per disjoint subgraph). For a multi-team DEG (e.g. a Domain organising entities owned by several teams), this leaks 'team A's entity X is on the same data-pipeline as team B's entity Y' even when the individual entities would not be searchable across teams."
- `odd-platform__java__DataEntityController__controller-method__getDataEntityGroupsLineage.md:security.known_security_gaps.[0]` + `[1]` (HIGH × 2)

**Description**: The endpoint `GET /api/dataentitygroups/{data_entity_group_id}/lineage` (`DataEntityController.getDataEntityGroupsLineage`) inherits the read-collaborative-GET posture of ADR-CANDIDATE-003 on a NEW vector — **the DEG-anchored sibling of REFACTOR-203's per-entity lineage cross-owner enumeration**. Three distinguishing features make this finding materially wider than the per-entity-instance:

1. **The service has NO AuthIdentityProvider dependency at all**: `LineageServiceImpl.java:54-57` (verified by reading the field list) — the service does not even import the principal-resolution chokepoint. The DEG ID is the anchor; visibility of the DEG implies visibility of its full transitive member graph + reachable lineage edges + per-member metadata.

2. **Per-connected-component CO-MEMBERSHIP leakage**: `LineageServiceImpl.establishDEGRelations` (lines 200-216) partitions the DEG's edge graph into disjoint connected components and emits ONE stream per component. For a multi-team DEG (e.g. a Domain organising entities owned by Team A, Team B, Team C — the canonical use case), the response leaks "Team A's entity X is on the same data-pipeline as Team B's entity Y" even when the individual entities would not be cross-team-searchable. The DEG was designed to MODEL organisational structure (a Domain represents a business concept); surfacing that structure to any authenticated user discloses the very organisational shape the DEG models.

3. **Write-side / read-side authorization asymmetry**: The DEG WRITE paths ARE gated — `addDataEntityDataEntityGroup` (POST `/api/dataentities/{id}/data_entity_group`) is gated by `DATA_ENTITY_ADD_TO_GROUP` Permission (`SecurityConstants.java:228-231`); `deleteDataEntityFromDataEntityGroup` (DELETE) is gated by `DATA_ENTITY_DELETE_FROM_GROUP` Permission (`SecurityConstants.java:232-236`). But the DEG-lineage READ has NO matching `DATA_ENTITY_VIEW_GROUP_LINEAGE` permission — the read falls through to `.authenticated()`. An operator who configures the WRITE permissions expecting symmetric READ control is surprised that ANY authenticated user can read every DEG's full member-graph regardless of the permission model.

**Primary source citations**:
- `LineageServiceImpl.java:54-57` (no AuthIdentityProvider field; verified by direct read)
- `LineageServiceImpl.java:59-85` (`getDataEntityGroupLineage` body — no owner-resolution call)
- `LineageServiceImpl.java:200-216` (`establishDEGRelations` — the per-connected-component partitioning)
- `LineageServiceImpl.java:181-198` (the 3-arg `getLineageStream` overload — always passes `List.of()` for groups + `Map.of()` for groupsRelations; groups never populated in DEG-lineage response)
- `ReactiveGroupEntityRelationRepositoryImpl.java:177-204` (recursive CTE walks nested DEGs at the membership layer)
- `ReactiveLineageRepositoryImpl.java:112-119` (the bidirectional bound-set filter — both endpoints in the member set)
- `AuthorizationCustomizer.java:29-30` (catch-all `.authenticated()`)
- `SecurityConstants.java` — no rule entry for `/api/dataentitygroups/{id}/lineage` (verified via Grep `dataentitygroups.*lineage` returning zero matches)
- `SecurityConstants.java:228-231` + `:232-236` (the DEG-WRITE permission entries that have no READ-side counterpart)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-003 (read-collaborative GET, RESOLVED-AS-INTENTIONAL via batch F) MAY defend this — the architectural posture is "any authenticated user can read any catalog entity's relationships". **ADR-CANDIDATE-119 NEW** (DEG-lineage inner-DEG-free deferred-feature carve-out) and **ADR-CANDIDATE-120 NEW** (DEG-lineage internal-edge-fetch) codify the DEG-lineage architecture's response shape, but do NOT defend the cross-owner ENUMERATION consequence — they describe what the response looks like; this REFACTOR captures what the response REVEALS. The maintainer's triage: (i) confirm ADR-CANDIDATE-003 + the DEG-anchored extension as intentional and document the CO-MEMBERSHIP leakage on the live `/features/data-discovery/groups-domains.md` page; OR (ii) add a DEG-LINEAGE-READ permission tied to DEG-membership (members + co-members can read the lineage; outsiders cannot).

**Proposed remedy**: Two-path; the maintainer chooses based on the trust calculus:

1. **DOC-ALIGN** (cheaper — accept the gap, align docs): Update the live `/features/data-discovery/groups-domains.md` page to explicitly disclose: "Any authenticated user with knowledge of a Domain or DEG ID can read its full member graph including entities owned by other teams. This is the intentional consequence of the read-collaborative posture (ADR-CANDIDATE-003 extended to DEG anchors). Multi-team Domains: be aware that grouping multi-team entities under one Domain discloses the organisational structure to every authenticated user." Also update `/configuration-and-deployment/enable-security/authorization` to add the DEG-anchored vector to the read-collaborative blast radius enumeration.

2. **STRUCTURAL** (preferred for security-architecture-aware project): Add a `DATA_ENTITY_VIEW_GROUP_LINEAGE` permission keyed on DEG-membership; gate the read at the controller with a `permissionService.hasPermission(...)` check; resolve the caller's owner-id via `authIdentityProvider.fetchAssociatedOwner()`; check whether any of the caller's owned entities are in the DEG's transitive member set (the `groupEntityRelationRepository.getDEGEntitiesOddrns(dataEntityGroupId)` already exists — invoke it from the permission check). Members + co-members can read; outsiders get 403. The cost: one DB round-trip per DEG-lineage read (membership check); the benefit: per-DEG access boundary aligned with the WRITE-side permission model.

Option (2) is strictly preferable for multi-tenant deployments using Domains to model team boundaries (a stated use case in `/features/data-discovery/groups-domains.md`); option (1) is acceptable for early-stage projects accepting the read-collaborative posture wholesale.

**Severity rationale**: HIGH — DEG-anchored enumeration vector with materially wider blast radius than per-entity lineage; the DEG models organisational structure by design; surfacing all members + their inter-member edges to any authenticated user discloses that structure. The write-side / read-side asymmetry is operator-confusing (someone configuring DATA_ENTITY_ADD_TO_GROUP expects DATA_ENTITY_VIEW_GROUP_LINEAGE; the latter does not exist).

**Suggested backlog grouping**: `Authorization audit batch` — couple with REFACTOR-203 (per-entity lineage cross-owner enumeration — the per-entity instance of this family), REFACTOR-200 (centerpiece detail read), REFACTOR-024 (alerts batch + facet aggregator) + DOC-NNN tranche to align the live `groups-domains` page.

---
