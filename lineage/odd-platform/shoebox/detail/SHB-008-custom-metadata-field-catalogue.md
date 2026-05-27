# SHB-008 — Custom Metadata Field Catalogue (auto-growth, pageInfo theatre, no read permission)

**Category**: merged
**Severity**: MEDIUM

## Hypothesis

Operators see a global "custom metadata fields" autocomplete on every per-entity Metadata edit form (`MetadataCreateFormItem.tsx:24-89`) because `GET /api/metadata/fields` returns the entire non-deleted INTERNAL-origin catalogue. The catalogue is **mutated only as a side effect** of `DataEntityServiceImpl.createMetadata` via `MetadataFieldServiceImpl.getOrCreateMetadataFields`, which silently auto-creates an INTERNAL row when the typed name doesn't exist — and there is NO `CUSTOM_METADATA_FIELD_READ` permission anywhere; any authenticated user enumerates the entire deployment's custom-metadata vocabulary. F-013 (Custom Metadata Field Editing) anchors the per-value write path; this thread is the SIBLING **catalogue read surface** F-013 doesn't capture, plus three drift facets the read surface alone exhibits: (1) pageInfo theatre, (2) unbounded return, (3) no ordering contract.

## Evidence

- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/MetadataFieldController.java:18-23` — single-method controller; `getMetadataFieldList(query)` delegates to `metadataFieldService.listInternalMetadata(query)`.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/repository/reactive/ReactiveMetadataFieldRepositoryImpl.java:44-56` — the SQL: `selectFrom(METADATA_FIELD).where(origin = INTERNAL AND deleted_at IS NULL [AND LOWER(name) LIKE LOWER('%query%')])` — **no LIMIT, no OFFSET, no ORDER BY**. Returns the entire filtered set.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/mapper/MetadataFieldMapperImpl.java:29-33` — `new PageInfo().total((long) pojos.size()).hasNext(false)` — total = items.length always; hasNext = false always. **PageInfo is theatre**; SDK clients implementing "load more" based on `hasNext` cannot detect overflow.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/MetadataFieldServiceImpl.java:43-59` — `getOrCreateMetadataFields` is the side-door that grows the catalogue from per-value writes. Called from `DataEntityServiceImpl.createMetadata`.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/util/SecurityConstants.java:95-355` — grep `/api/metadata/fields` returns ZERO matches; falls through to `pathMatchers("/**").authenticated()` in `AuthorizationCustomizer.java:29-30`.
- Live doc: `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions` (verified 2026-05-25 status 200) — lists `DATA_ENTITY_CUSTOM_METADATA_{CREATE,UPDATE,DELETE}` but NO `CUSTOM_METADATA_FIELD_READ` permission. The platform has no concept of read-scoping for the catalogue.
- `odd-platform-ui/src/components/DataEntityDetails/Metadata/MetadataCreateForm/MetadataCreateFormItem/MetadataCreateFormItem.tsx:24-89` — the React autocomplete; `freeSolo`; debounce 500ms; dispatches `searchMetadata({query: searchText})` on focus + each keystroke; pulls in the catalogue on every modal open.
- `odd-platform-api/src/main/resources/db/migration/V0_0_1__init.sql:166-173, 238-244` — schema: `metadata_field` is a global table, no tenant/owner column; `ix_unique_internal_name` enforces `name` UNIQUE WHERE `origin = INTERNAL` (case-sensitive, so `cost_centre` and `Cost_centre` would mint two rows).

## Notes

- **F-013 covers the per-value WRITE surface** (silent UPDATE-not-UPSERT, no type validation). This thread is the CATALOGUE READ surface that F-013 doesn't explicitly anchor — and the catalogue is the dimension the operator interacts with FIRST (every metadata-add starts with picking a field name from the autocomplete).
- **Cross-deployment exposure**: the catalogue may contain field names that operators intended to scope (e.g. `salary_band`, `phi_classification`, `pii_indicator`). With no `CUSTOM_METADATA_FIELD_READ` permission, every authenticated user (and every anonymous DISABLED-mode caller) enumerates the entire vocabulary regardless of which data entities they can read.
- **Catalogue grows monotonically over deployment lifetime**: no UI delete path, no rate-limit on auto-create, no normalisation (case-folding, trimming, near-duplicate detection). An operator who typo'd `cost-centre` once sees it in the dropdown forever.
- **PageInfo theatre is contract-level**: the OpenAPI response schema (`components.yaml:2111-2120`) embeds `PageInfo` with `total` + `has_next` — SDK clients reading the spec assume pagination, the implementation never paginates. Wire-level lie.
- **Unbounded return**: with 10K INTERNAL metadata fields, every autocomplete-open materialises 10K MetadataField DTOs + the wire payload. Amplification scales linearly with directory cardinality.
- **No live doc page exists for Custom Metadata**: WebFetched `/active-platform-features/metadata` (404), `/active-platform-features/custom-metadata` (404). The Permissions page lists only write-side permissions. A load-bearing feature with zero operator documentation.
- **Type-validation gap mentioned in F-013** is doubly relevant here: the catalogue surfaces a `type` field per row (BOOLEAN/INTEGER/FLOAT/STRING/DATETIME/ARRAY/JSON/UNKNOWN), but the write side doesn't validate values against the type. The catalogue's `type` column is documentation-only.

## Next

1. **Graduate** to `F-NNN — Custom Metadata Field Catalogue` (P-01 Data Discovery / annotation). Primary subjects: `MetadataFieldController.getMetadataFieldList`, `MetadataFieldServiceImpl.{listInternalMetadata, getOrCreateMetadataFields}`, `ReactiveMetadataFieldRepositoryImpl.listInternalMetadata`, `MetadataFieldMapperImpl`, `metadata_field` table.
2. **Cluster** with F-013 (Custom Metadata Field Editing) — the two together form the complete Custom Metadata feature flow (catalogue read + per-value write).
3. **REFACTOR-NNN — HIGH** — implement real pagination on `getMetadataFieldList`: add LIMIT/OFFSET to the SQL, compute `total` via a count subquery, set `hasNext` truthfully. The current pageInfo theatre is a contract-level lie.
4. **DOC-NNN — HIGH** — no live doc page exists for Custom Metadata. Author a new page under `/features/data-discovery/custom-metadata` covering the catalogue, the autocomplete, the auto-create side effect, the INTERNAL/EXTERNAL partition, and the absence of a read-scoping permission.
5. **SEC-NNN — MEDIUM** — consider adding a `CUSTOM_METADATA_FIELD_READ` permission (or scope by parent data-entity visibility). Operators using ODD as a soft-data-governance system have no mechanism to scope which field names are visible to which users.
6. **REFACTOR-NNN — LOW** — case-fold the `ix_unique_internal_name` to prevent `cost_centre`/`Cost_centre` duplicates; add trim() on auto-create.
7. **REFACTOR-NNN — LOW** — add an ORDER BY (name ASC) to `listInternalMetadata` so heap-scan order doesn't surface as UI flicker after vacuum cycles.

## Links

- cluster_with: [F-013]
- merged_into: F-046
- supersedes: []

## evaluation

- **feature-flow-builder 2026-05-26**: graduated — strong evidence (8
  refs across controller / service / repository / migration / UI /
  spec / doc-side axes including a UI component file:line which makes
  the feature UI-complete). The catalogue READ surface is genuinely
  distinct from F-013's WRITE surface — together they form the
  Custom Metadata feature end-to-end. Minted F-046 at
  `lineage/odd-platform/feature-flows/detail/F-046.yaml`
  (P-01:F-010 Custom Metadata Field Catalogue) with 8 drift facets
  + companion_to F-013. SHB-008 hinted "clustering" but the evidence
  + UI completeness supports graduation; the cluster with F-013 is
  recorded via the `companion_to` block on F-046.
