# SHB-032 — `GET /api/dataentitygroups/{id}/lineage` returns the SAME 404 for "DEG not found", "entity is not a DEG", and "DEG has zero members" — three distinct conditions silently conflated

**Category**: open
**Severity**: MEDIUM

## Hypothesis

Operators (and third-party API consumers) calling `GET /api/dataentitygroups/{id}/lineage` see HTTP 404 with the message "Data entity group {id}" in THREE semantically-distinct failure conditions, with no way to tell them apart: (1) the supplied id does not exist as any data entity at all; (2) the supplied id exists as a data entity but its class is NOT `DATA_ENTITY_GROUP` (e.g. it's a Dataset or Transformer); (3) the supplied id IS a valid DEG that exists, but has zero (non-soft-deleted) members. The conflation happens at `LineageServiceImpl.java:62` — `.switchIfEmpty(Flux.error(new NotFoundException("Data entity group", dataEntityGroupId)))` — fires when `groupEntityRelationRepository.getDEGEntitiesOddrns(dataEntityGroupId)` returns an empty flux. The repository's recursive CTE (`ReactiveGroupEntityRelationRepositoryImpl.java:177-204`) enumerates `group_entity_relations` rows keyed on the entity's oddrn; for cases (1) and (2) the CTE returns empty because no matching rows exist; for case (3) it returns empty because the DEG exists but its members are gone. All three paths produce the identical error message. An operator debugging "why doesn't my DEG show lineage" cannot tell whether the DEG is missing, mis-typed, or empty — and a UI client cannot meaningfully surface different remediation guidance.

## Evidence

- `odd-platform-api/src/main/java/.../service/LineageServiceImpl.java:59-85` — `getDataEntityGroupLineage(Long dataEntityGroupId)` chain.
- `odd-platform-api/src/main/java/.../service/LineageServiceImpl.java:62` — `.switchIfEmpty(Flux.error(new NotFoundException("Data entity group", dataEntityGroupId)))`.
- `odd-platform-api/src/main/java/.../repository/.../ReactiveGroupEntityRelationRepositoryImpl.java:177-204` — recursive CTE on `group_entity_relations` keyed by entity oddrn; no class-of-entity validation.
- `lineage/odd-platform/understanding/odd-platform__java__DataEntityController__controller-method__getDataEntityGroupsLineage.md:107` (uncovered_behaviours) — "**DEG-not-found 404** — no test asserts behaviour when the path parameter references a non-existent DEG ID... the error message conflates 'DEG not found' with 'DEG has no members'."
- `lineage/odd-platform/understanding/odd-platform__java__DataEntityController__controller-method__getDataEntityGroupsLineage.md:108` (uncovered_behaviours) — "**Non-DEG-typed ID** — no test asserts behaviour when the path parameter references a data entity that exists but is NOT a DEG (the SQL CTE doesn't validate the entity class — it just enumerates `group_entity_relations` rows keyed on the entity's oddrn; for a non-DEG entity, the CTE returns empty and the user sees a 404 'Data entity group {id}' — misleading: the entity exists, it's just not a DEG)."
- `lineage/odd-platform/understanding/odd-platform__java__DataEntityController__controller-method__getDataEntityGroupsLineage.md:120` (gaps) — "A second high-priority gap is the empty-DEG 404 vs the DEG-not-found 404 — the two error conditions produce the same 404 with the same message ('Data entity group {id}'), conflating two semantically different conditions; the test absence here means a future refactor that splits the conditions has no regression anchor."
- `lineage/odd-platform/understanding/odd-platform__java__service__service__LineageServiceImpl.md:50` (invariants) — "getDataEntityGroupLineage emits `404 NotFoundException` if `getDEGEntitiesOddrns(dataEntityGroupId)` emits an empty Flux (line 62 — `.switchIfEmpty(Flux.error(new NotFoundException(...)))`); a DEG with at least one member entity is treated as 'valid' regardless of whether the members have lineage edges."

## Notes

- **The UX consequence is asymmetric across the three conditions**:
  - Case (1) "DEG not found": user mistyped the id; correct remediation = check the id.
  - Case (2) "not a DEG": user clicked through to a non-DEG entity's URL or used the wrong route; correct remediation = use `/api/dataentities/{id}/lineage/{up,down}stream` instead.
  - Case (3) "empty DEG": the DEG is valid but empty; correct remediation = check the DEG's membership population path (was ingestion expected? was a member soft-deleted?).
- A single "Data entity group {id}" 404 message gives operators no signal about which remediation path applies. Compounds with the live docs' silence on the conditions (per the sidecar `docs_link_semantic`).
- **The fix is layered**: (a) split into three distinct exceptions (`NotFoundException("Data entity", id)` if no row at all; `BadRequestException("Entity {id} is not a Data Entity Group, it is {class}")` if wrong class; `NotFoundException("Data entity group {id} has no members")` if empty); (b) update OpenAPI to document the three response codes / messages; (c) update the UI to surface remediation hints per case.
- **Cross-link to F-016 (DEG-Anchored Lineage)**: F-016 anchors the DEG-lineage feature; this thread captures an error-shape facet F-016 doesn't currently enumerate. Set `Category: open` (could fold into F-016 facets but warrants its own SHB to capture the three-condition decomposition cleanly).
- **The deeper question**: should case (2) "not a DEG" even be a 404 versus a 400? An operator passing a Dataset id to the DEG endpoint is making a contract violation, not a not-found request. HTTP 400 (or 422) would more accurately signal "your request shape is wrong". Worth a small ADR.
- guess: a probe seeding three test entities — one missing, one a Dataset, one an empty DEG — and calling the endpoint for each would surface three identical 404 responses, confirming the conflation.

## Next

1. **REFACTOR-NNN** (split conditions): wrap `getDEGEntitiesOddrns` with a pre-check that resolves the entity by id, validates the class, then proceeds. Three distinct error paths.
2. **DOC-NNN**: update `https://docs.opendatadiscovery.org/developer-guides/api-reference/lineage` to document the three 404 conditions OR (post-fix) the three distinct response codes / messages.
3. **TEST-NNN**: WebTestClient integration tests for all three conditions, pinning the post-fix distinct response shapes.
4. **ADR-NNN** (small): "validation-error vs not-found classification for path-param contract violations" — should case (2) be 400 or 404? Codify the convention platform-wide.
5. **Cross-link to F-016 + F-005**: this is the error-shape facet of the DEG-lineage UI path; F-005 + F-016 already document the cross-owner enumeration + inner-DEG suppression on the success path; this fills the failure-path gap.
6. **Cluster with SHB-023 (microservices lineage)**: both stem from the same controller/service treating "what kind of entity is this id?" as data-driven rather than contract-validated.

## Links

- cluster_with: [F-016, F-005, SHB-023]
- merged_into: (open)
- supersedes: []
