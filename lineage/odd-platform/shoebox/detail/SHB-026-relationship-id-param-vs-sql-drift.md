# SHB-026 — `relationship_id` path-param TRANSLATES_SILENTLY to `data_entity.id` — third-party callers 404 on real relationships.id values

**Category**: open
**Severity**: HIGH

## Hypothesis

Operators / SDK consumers reading the OpenAPI spec for `GET /api/relationships/erd/{relationship_id}` and `GET /api/relationships/graph/{relationship_id}` see a path parameter named `relationship_id` and reasonably assume it accepts the `relationships` table primary key. The SQL at `ReactiveRelationshipsRepositoryImpl.java:194` instead filters by `relationshipsDataEntity.field(DATA_ENTITY.ID).eq(relationshipId)` — the relationship-class data-entity's `data_entity.id` column, NOT `relationships.id`. The UI round-trip works because the list endpoint at the SAME controller surfaces `data_entity.id` as the row `id` field (`RelationshipMapper.java:53`), so list-then-detail is self-consistent. A third-party API consumer who obtains a relationships.id from a DB dump, an OpenAPI-generator test fixture, or any non-UI source and supplies it gets HTTP 404. Worse — bigserial collision is admissible — they may get a 200 for an UNRELATED relationship row whose data_entity.id happens to equal the supplied relationships.id (two independent bigserial counters; collision unlikely but not zero). The OpenAPI parameter name, the operation summary "Get erd relationship by id", and the URL path-segment all PROMISE the relationships-table id; the implementation silently substitutes a different identifier with no Javadoc, no comment, no ADR.

## Evidence

- `lineage/odd-platform/understanding/odd-platform__java__RelationshipController__controller-class__RelationshipController.md:42-50` (understanding) — primary finding: "The `relationshipId` path parameter name is misaligned with the SQL — the repository filters by `relationshipsDataEntity.field(DATA_ENTITY.ID).eq(relationshipId)` (`ReactiveRelationshipsRepositoryImpl.java:194`), the relationship-class data entity's `data_entity.id`, NOT the `relationships.id` primary key."
- `odd-platform-api/src/main/java/.../controller/RelationshipController.java:31, 39` — Java parameter declared `Long relationshipId`.
- `odd-platform-specification/openapi.yaml:4162-4166, 4181-4183` — OpenAPI parameter `relationship_id`; operation summary "Get erd relationship by id" / "Get graph relationship by id".
- `odd-platform-api/src/main/java/.../service/.../RelationshipsServiceImpl.java:38-49` — service hardcodes `RelationshipsType.ERD`/`GRAPH` and forwards `relationshipId` unchanged to `getRelationshipByIdAndType`.
- `odd-platform-api/src/main/java/.../repository/.../ReactiveRelationshipsRepositoryImpl.java:194` — SQL `where(relationshipsDataEntity.field(DATA_ENTITY.ID).eq(relationshipId))`.
- `odd-platform-api/src/main/java/.../mapper/RelationshipMapper.java:53` — list response surfaces `.id(item.dataEntityRelationship().getId())` — the data_entity id; so list→detail round-trip is self-consistent for UI callers.
- `odd-platform-api/src/main/resources/db/migration/V0_0_87__create_relation_tables.sql:1-10` — `relationships.data_entity_id bigint` with FK only, **no UNIQUE constraint** — one data_entity COULD own multiple relationships rows; per RelationshipController sidecar bugs[3], `mono()` on multi-row matches has undefined driver behaviour.
- `lineage/odd-platform/understanding/odd-platform__java__RelationshipController__controller-class__RelationshipController.md:210` (bugs[0]) — Category F TRANSLATES_SILENTLY: "Third-party API consumers reading the OpenAPI spec at face value and supplying actual relationships.id values get 404."
- `lineage/odd-platform/understanding/odd-platform__java__RelationshipController__controller-class__RelationshipController.md:466` (request-inputs analysis) — "YES — `relationships.id` IS the column the name promises; the SQL at line 194 uses `relationshipsDataEntity.field(DATA_ENTITY.ID)` INSTEAD OF `RELATIONSHIPS.ID`. The fix candidate is changing line 194 from `relationshipsDataEntity.field(DATA_ENTITY.ID).eq(relationshipId)` to `RELATIONSHIPS.ID.eq(relationshipId)` — AND updating the list endpoint's mapper to surface `relationshipPojo().getId()` as the `id` instead of `dataEntityRelationship().getId()`. Both halves needed for the rename; either half alone breaks round-trip."

## Notes

- **This is a Category F drift** (per RelationshipController sidecar `feature_hint` cross-link to P-128 probe and the request-inputs `DRIFT_INPUT_NAME_VS_IMPLEMENTATION` classification). The name PROMISES X, the implementation consumes Y. UI callers are immune because the list response feeds the round-trip; non-UI callers are harmed.
- **The fix is bilaterally constrained**: changing the SQL alone breaks UI list-then-detail round-trip; changing the mapper alone breaks operators who bookmarked URLs. The correct fix is both halves at once + a deprecation path on the OpenAPI parameter name (or accepting either id via a defensive `WHERE data_entity.id = ? OR relationships.id = ?`).
- **Multi-row sub-case is admissible**: no UNIQUE on `relationships.data_entity_id` means one DEG-like containment could produce two relationship rows pointing at one data_entity. Per the sidecar, no current collector emits this shape, but the schema admits it. `mono()` on a multi-row match is JOOQ-driver-specific (TooManyResultsException or silent first-row).
- **Documentation gap**: `documentation/docs/developer-guides/api-reference/relationships.md` declares the endpoint without warning about the parameter-name vs SQL-target drift. Operators building tooling on the OpenAPI client get silent 404s with no diagnostic.
- **Cross-link to F-037**: F-037 ERD/Graph Relationships Listing is the substrate anchor; this thread enriches F-037's drift surface with the TRANSLATES_SILENTLY facet. Set `Category: clustering`.
- guess: a regression test calling `GET /api/relationships/erd/{relationships.id}` with a real `relationships.id` value (not a data_entity.id) would FAIL today (404 expected) and serve as a regression-pin. A second test calling with a real `data_entity.id` would PASS — pinning both sides of the drift.

## Next

1. **Enrich F-037** with drift_class `relationship_id_path_param_translates_silently_to_data_entity_id` — pillar P-02 Data Modelling.
2. **REFACTOR-NNN**: bilateral fix — either rename to `data_entity_id` in OpenAPI (breaking change for SDK consumers but accurate) OR fix SQL to filter on `relationships.id` AND update the list mapper to surface `relationships.id` (breaking change for UI bookmarks).
3. **DOC-NNN**: until the fix lands, document the drift on the API-reference page with a warning admonition.
4. **TEST-NNN**: WebTestClient integration test that pins BOTH halves — `relationships.id` → 404, `data_entity.id` → 200 — and a regression test for the multi-row case (manually-INSERTed two relationships rows on one data_entity).
5. **Cross-link to RelationshipController sidecar P-128 probe** — the probe is designed exactly to pin this finding.

## Links

- cluster_with: [F-037]
- merged_into: (open — enriches F-037)
- supersedes: []
