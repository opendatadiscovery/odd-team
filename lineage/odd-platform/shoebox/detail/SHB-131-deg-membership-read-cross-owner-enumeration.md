# SHB-131 — `GET /ingestion/dataentitygroups/{degOddrn}/entities` lets any HTTP caller enumerate DEG membership in every deployment configuration

**Category**: clustering
**Severity**: HIGH

## Hypothesis

The read-side companion to the ingestion-controller's S2S write path is an unauthenticated GET endpoint that returns the member list of any Data Entity Group (DEG) — given the DEG's ODDRN. The controller has no `@PreAuthorize`; the service has no owner-scoping; the repository performs a flat SELECT filtered only by `GROUP_ODDRN.eq(:degOddrn).and(IS_DELETED.isFalse())`. The path is in `SecurityConstants.WHITELIST_PATHS` (`/ingestion/**`) and is not matched by any `AbstractIngestionFilter` subclass (the data-entities filter binds exact-literal `POST /ingestion/entities`; the data-source filter binds exact-literal `POST /ingestion/datasources`). Result: unauthenticated in every shipped configuration, even when the operator has set `auth.type=OAUTH2 + auth.s2s.enabled=true + auth.ingestion.filter.enabled=true` (the most-hardened posture). Combined with deterministic ODDRN naming (`{platform-host}/dataentitygroup/{id}`-shaped with sequential numeric ids), the catalog is enumerable in O(N) anonymous GETs.

## Evidence

- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/ingestion/IngestionController.java:75-79` — 3-line proxy, no `@PreAuthorize`, no programmatic auth check, no input validation.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/DataEntityGroupServiceImpl.java:92-108` — `listEntitiesWithinDEG` makes no `fetchAssociatedOwner()` call, no SecurityContext lookup, no `@PreAuthorize`. Read-only path; no `@ReactiveTransactional` either.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/repository/reactive/ReactiveDataEntityRepositoryImpl.java:318-326` — `getDEGEntities(String groupOddrn)`: flat join `GROUP_ENTITY_RELATIONS` to `DATA_ENTITY`, filtered ONLY by `GROUP_ODDRN.eq(:degOddrn).and(IS_DELETED.isFalse())`. No `DATA_ENTITY.STATUS != DELETED`, no `DATA_ENTITY.HOLLOW = false`, no OWNERSHIP join.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/filter/IngestionDataEntitiesFilter.java:28` — exact-literal matcher `POST /ingestion/entities`; doesn't match the GET-by-path-variable here.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/utils/SecurityConstants.java:95-96` — `WHITELIST_PATHS` contains `/ingestion/**`.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/DataEntityGroupServiceImpl.java:193-195` (per getDataEntitiesByDEGOddrn sidecar) — `ODDPlatformDataEntityGroupPath` generation uses `{platform-host}/dataentitygroup/{id}` shape with sequential numeric DEG ids → trivial enumeration `for id in 1..N: GET /ingestion/dataentitygroups/{platform-host}/dataentitygroup/{id}/entities`.

## Notes

- Three asymmetries compose:
  1. **Cross-owner read posture** — the platform's read-collaborative invariant (per system-mission P-09) means cross-owner enumeration is the DEFAULT for read endpoints. UI-side this is intentional and operator-observable (Search/Directory/Catalog all return cross-owner). The S2S read endpoint inherits the posture WITHOUT the UI's authentication layer — so the cross-owner enumeration is also UNAUTHENTICATED. The UI-API sibling endpoint on `/api/dataentitygroups/{id}/lineage` (F-016) is at least authenticated under OAUTH2/LDAP/LOGIN_FORM; this S2S read sibling is NOT.
  2. **404-vs-empty-200 silent conflation** — an unknown DEG, an empty DEG, a malformed ODDRN, and a NULL-equivalent ODDRN all produce `200 OK` with `items: []`. The closely-related `getDataEntityGroupLineage` sibling DOES raise 404 on the same empty-membership condition (`LineageServiceImpl.java:62`) — the same platform produces two different contracts for the same semantic situation. An attacker probing the endpoint can enumerate DEG existence by some other channel and confirm via the membership endpoint, OR can use the 200-on-empty as a "no DEG here" signal during catalog mapping.
  3. **Soft-deleted members surface in the response** — the SQL filters only the EDGE soft-delete; the joined `DATA_ENTITY` rows are not filtered by `STATUS != DELETED` or `HOLLOW = false`. A DEG containing a soft-deleted entity exposes that entity in the response, deviating from the platform's `getDataEntityDefaultConditions` pattern applied across every UI-side surface. An attacker enumerating a DEG sees BOTH live and soft-deleted members.
- Operator-observable downstream effect: an attacker who knows ONE DEG's ODDRN (trivially obtainable via the Swagger UI exposing the spec; via observing public catalog descriptions; via guessing the sequential id format) can:
  - Enumerate every member's ODDRN → trivially derive datasource ODDRNs → trivially derive dataset/transformer/consumer ODDRNs → walk the entire catalog map without authentication.
  - Identify high-value targets (financial datasets, PII-bearing entities) by their ODDRN substring patterns.
  - Combine with SHB-125 (cross-dataset stats write) to identify which datasets to poison.
  - Combine with SHB-130 (open-write metric ingestion) to mint metrics for any ODDRN they discovered.
- The `auth.ingestion.filter.enabled` property name SUGGESTS this endpoint is locked down when the toggle is on — but the filter's exact-literal POST matcher doesn't apply. SHB-123 captures the property-name misdirection class; this thread is one of its concrete victims.
- Single-level (non-recursive) projection is intentional per the getDataEntitiesByDEGOddrn sidecar implicit_adrs[1] — but inner DEGs are returned as DATA_ENTITY_GROUP-typed CompactDataEntity entries WITHOUT a recurse marker. An attacker enumerating a parent DEG must walk inner DEGs separately.
- Cross-link to F-016 (DEG-Anchored Lineage) — F-016 covers the LINEAGE surface with the same read-collaborative posture but lives on `/api/` (authenticated under UI modes); this thread covers the MEMBERSHIP surface on `/ingestion/` (unauthenticated). The two are architectural twins with asymmetric auth gating.
- Cross-link to F-023 (Directory — 4-level catalog drill-down via ODDRN-prefix grouping) — F-023 already anchors operator-observable catalog enumeration. This thread adds the AUTH-DIMENSION facet (the membership surface lacks the UI's auth gate).
- This is `open` because the maintainer call is between two fixes: (a) add the endpoint to the ingestion filter's path-matcher list (broadening the filter's scope; closes the gap under filter-ON), (b) move the endpoint off `/ingestion/**` to `/api/dataentitygroups/{id}/ingestion-members` (re-uses the UI-API filter chain; closes the gap unconditionally). Both are viable; the second is structurally cleaner but breaks the OpenAPI ingestion contract.

## Next

1. Promote to `F-NNN — DEG Membership S2S Read Surface` in pillar P-10 OR direct-promote to high-severity SEC-NNN.
2. Probe-NNN: against a local docker-compose mirror under each auth mode + filter combo, GET `/ingestion/dataentitygroups/<known-deg-oddrn>/entities` unauthenticated; confirm 200 + member list across the 16 cells.
3. SEC-NNN: either (a) extend `IngestionDataEntitiesFilter`'s path matcher to include the GET-by-path-variable form (and re-bind `auth.ingestion.filter.enabled` to cover it), OR (b) move the endpoint to the `/api/` namespace so UI auth applies.
4. SEC-NNN: align the 404-vs-empty-200 contract with the sibling `getDataEntityGroupLineage` — raise NotFoundException on unknown DEG; preserve empty-200 only for DEG-exists-with-no-members.
5. REFACTOR-NNN: apply the platform's standard `getDataEntityDefaultConditions` filter to `getDEGEntities` so soft-deleted/hollow members are hidden by default.
6. DOC-NNN: document the endpoint at `developer-guides/api-reference` — currently NO live doc page describes it.

## Links

- cluster_with: [F-016, F-023, F-094, F-097, F-008]
- merged_into: (cross-pillar — defer to F-016 owner pillar P-05 OR F-023 owner pillar P-01)
- supersedes: []

## evaluation

- **feature-flow-builder 2026-05-26**: cluster — SHB-131 is a CROSS-PILLAR enricher (target F-016 lives in P-05 Data Lineage; target F-023 in P-01 Data Discovery — both outside Slice G's P-10/P-11 ownership). Defer to next pass. The endpoint `/ingestion/dataentitygroups/{degOddrn}/entities` IS technically in /ingestion/** namespace (Slice-G-relevant) — F-094 now anchors the auth-coverage gap and F-094's drift facets cover the unauthenticated-in-every-mode surface. The DEG-MEMBERSHIP-SPECIFIC angles (404-vs-empty-200 silent conflation; soft-delete leak via single-sided IS_DELETED filter; deterministic ODDRN enumeration enabling O(N) anonymous walk) merit a dedicated F-NNN OR an enricher of F-016 — but the home pillar is cross-slice. Cluster maintains link to F-094 (auth-coverage matrix), F-097 (Swagger UI exposes the endpoint), F-008 (already cites s2s_read_side_unauthenticated_get_data_entities_by_deg_oddrn in its drift summary).
