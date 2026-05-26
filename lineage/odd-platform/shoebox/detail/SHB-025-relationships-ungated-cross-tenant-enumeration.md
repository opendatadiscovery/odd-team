# SHB-025 — Relationships list endpoint enumerates the entire cross-tenant relationship catalog with WEAKER scoping than `/api/dataentities`

**Category**: open
**Severity**: HIGH

## Hypothesis

Operators see the Data Modelling → Relationships page (`/data-modelling/relationships`) populated by `GET /api/relationships` and assume the read posture matches the rest of the catalog (read-collaborative + EXCLUDE_FROM_SEARCH respected + HOLLOW excluded). It does NOT. The relationships list endpoint applies **strictly fewer** filters than `/api/dataentities`: no owner-scoping (expected — read-collaborative), no namespace filter, no data-source-permission filter, AND **does not honor the `EXCLUDE_FROM_SEARCH = false` filter that `/api/dataentities` does apply** (per batch-T REFACTOR-425 finding cited in RelationshipController sidecar). Any authenticated user (or anonymous caller under `auth.type=DISABLED`) sees every relationship row across every data source — including relationships that touch entities operators have explicitly excluded from search. The Relationships list is the **strictly more permissive sibling** of the Data Entity list; an operator who hides an entity from search via the catalog's exclude-from-search affordance still leaks the entity's relationship connections via this surface.

## Evidence

- `odd-platform-api/src/main/java/.../RelationshipController.java:14-44` — no `@PreAuthorize`, no programmatic permission check (per RelationshipController sidecar `understanding`).
- `odd-platform-api/src/main/java/.../config/SecurityConstants.java:95-355` — **NO SECURITY_RULES matcher** for `/api/relationships/**` (verified by reading the entire 357-line file end-to-end per RelationshipController sidecar `understanding`).
- `odd-platform-api/src/main/java/.../service/.../RelationshipsServiceImpl.java:30-49` — no service-layer permission check.
- `odd-platform-api/src/main/java/.../repository/.../ReactiveDataEntityRelationshipRepositoryImpl.java:66-75` — `conditionList` contains ONLY `DATA_ENTITY.EXTERNAL_NAME` (when query provided) AND `entity_class_ids = [DATA_RELATIONSHIP.getId()=9]`; no `OWNERSHIP` join, no `EXCLUDE_FROM_SEARCH = false` filter, no `HOLLOW = false` filter, no `data_source_id` filter.
- `lineage/odd-platform/understanding/odd-platform__java__RelationshipController__controller-class__RelationshipController.md:211` (bugs[1]) — "No authorization gate at any layer — every endpoint is reachable by any authenticated caller (or anonymous under DISABLED)... Cross-data-source visibility, cross-namespace visibility, and visibility of EXCLUDE_FROM_SEARCH=true relationships are all unrestricted."
- `lineage/odd-platform/understanding/odd-platform__java__RelationshipController__controller-class__RelationshipController.md:199` (doc-drift[2]) — "Local-repo `data-modelling/relationships.md` does NOT mention that the list endpoint applies NO owner-scoping, NO EXCLUDE_FROM_SEARCH filter, NO HOLLOW filter, and NO data_source-permission filter — every authenticated user sees every relationship across every data source in the catalog. The /api/dataentities endpoint applies the EXCLUDE_FROM_SEARCH filter; the relationships list does NOT. The asymmetry is undocumented."

## Notes

- **The asymmetry is the headline**: F-017 (Search Filter Facets) DOES respect the EXCLUDE_FROM_SEARCH filter per the entity-list path; F-037 (ERD/Graph Relationships Listing) does NOT. An operator who hides a sensitive table (e.g. `prod_pii.customer_ssn_lookup`) from search to keep it off discovery surfaces still leaks the table's existence and its connections via the Relationships page.
- The `EXCLUDE_FROM_SEARCH` flag has a clear operator-visible meaning ("hide this entity from search") — operators set it as an information-hygiene control. The Relationships page silently bypasses that control. This is a **defence-in-depth-control-doesn't-defend-in-depth** finding — same class as F-014 (per-entity alert cross-owner enumeration), F-022's underlying threat model.
- **HOLLOW entities** are stub data-entity rows synthesised by the platform during ingestion before the actual entity arrives (e.g. a referenced parent entity in an OpenLineage event that hasn't been ingested yet); they're typically excluded from UI surfaces because they have no real content. The Relationships page includes them anyway, surfacing rows that point at non-existent entities.
- **F-037 enrichment, not new feature**: F-037 (ERD/Graph Relationships Listing) is the substrate anchor; this thread is an ENRICHER documenting the cross-tenant + filter-asymmetry facet F-037 doesn't currently capture. Set `Category: clustering`, `Links.cluster_with: [F-037]`. The feature-flow-builder should attach the EXCLUDE_FROM_SEARCH bypass + cross-owner + cross-data-source facets to F-037's drift_class field.
- **The page-zero arithmetic bug compounds**: per RelationshipController sidecar bugs[2], `(page - 1) * size` produces negative offset for `page=0` (JavaScript 0-indexed convention) — opaque 500 instead of graceful empty-page. Distinct finding (could be its own thread), but illustrates the "no defensive checks anywhere" character of this controller.
- **Documentation gap**: live `documentation/docs/data-modelling/relationships.md` does not describe the read posture. Operators expecting parity with the entity list are misled.

## Next

1. **Enrich F-037** with the three filter-asymmetry facets: EXCLUDE_FROM_SEARCH bypass, HOLLOW bypass, no data-source-permission filter. Add the cross-owner enumeration facet (already documented for F-017's data-entity list — same shape).
2. **DOC-NNN**: update `documentation/docs/data-modelling/relationships.md` to document the read posture explicitly. Either "/api/relationships is catalog-public-by-design" OR "this is a known gap; track REFACTOR-NNN".
3. **REFACTOR-NNN**: add EXCLUDE_FROM_SEARCH + HOLLOW filters to `ReactiveDataEntityRelationshipRepositoryImpl.java:66-75` `conditionList`. Cheap fix; parity with `/api/dataentities`.
4. **Probe**: seed a relationship between an EXCLUDE_FROM_SEARCH=true entity and a normal entity; verify the row appears in `GET /api/relationships`. If yes, this is the bug; if no, the analysis is wrong and the thread closes.
5. **Cross-link to F-014 + F-017 + F-037**: this is a sibling of F-014 (per-entity alerts cross-owner enumeration) and a strict-superset of F-017's catalog-wide-with-EXCLUDE_FROM_SEARCH posture.

## Links

- cluster_with: [F-037, F-017, F-014]
- merged_into: (open — likely enriches F-037)
- supersedes: []
