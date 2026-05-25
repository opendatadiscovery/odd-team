# ADR-CANDIDATE-219 — `metadata_field` directory is bifurcated by `origin` into INTERNAL (user-typed via UI) and EXTERNAL (collector-ingested) sub-namespaces — partial unique indices encode the partition; read endpoints hardcode `origin=INTERNAL` to enforce sub-namespace isolation

**Classification**: promote
**Severity**: MEDIUM
**Pillars affected**: [P-10 Ingestion, P-04 Data Discovery (Custom Metadata)]
**Batch**: ZF (2026-05-25)

**Surfaced by**:
- `odd-platform__java__MetadataFieldController__controller-class__MetadataFieldController.md:implicit_adrs.[1]` (HIGH) — "**Origin partition between INTERNAL and EXTERNAL is enforced at read** — `listInternalMetadata` line 46 explicitly filters by `origin = 'INTERNAL'`; EXTERNAL fields populated by collectors are NEVER returned. The schema-level partial unique indices (`ix_unique_internal_name` on name WHERE origin = INTERNAL; `ix_unique_external_name_type` on (type, name) WHERE origin <> INTERNAL, per V0_0_1__init.sql:238-244) reinforce this stance"
- `odd-platform__java__MetadataFieldController__controller-class__MetadataFieldController.md:concepts.invariants.[origin-filter-pinned-to-INTERNAL]`
- `odd-platform__java__MetadataFieldController__controller-class__MetadataFieldController.md:dependencies_semantic.requires-feature.[External-ingestion-Collector-pipeline]`

**Decision statement**: The `metadata_field` table is a **PARTITIONED NAMESPACE**: rows with `origin='INTERNAL'` are platform-user-typed fields (created via the UI's Custom Metadata form, side-effect-grown by `MetadataFieldServiceImpl.getOrCreateMetadataFields`); rows with `origin='EXTERNAL'` are collector-ingested fields (populated via `MetadataFieldServiceImpl.ingestMetadataFields` from the collector pipeline's metadata payloads). The partition is enforced at THREE distinct schema-and-code layers:

1. **Schema-level partial unique indices** (V0_0_1__init.sql:238-244):
   - `ix_unique_internal_name` — UNIQUE on `name` WHERE `origin = 'INTERNAL'`. The INTERNAL namespace requires globally unique names; users cannot create two STRING and INTEGER fields both named `cost_centre`.
   - `ix_unique_external_name_type` — UNIQUE on `(type, name)` WHERE `origin <> 'INTERNAL'`. The EXTERNAL namespace allows the same `name` with different `type` values; a collector can register both a STRING-typed `cost_centre` and an INTEGER-typed `cost_centre` from different sources.

2. **Service-tier method partition**:
   - `MetadataFieldServiceImpl.getOrCreateMetadataFields(metadataObjects)` (lines 43-59) — the USER-side path; only writes INTERNAL rows.
   - `MetadataFieldServiceImpl.ingestMetadataFields(metadataObjects)` (lines 62-71) — the COLLECTOR-side path; only writes EXTERNAL rows.

3. **Wire-surface partition**:
   - `GET /api/metadata/fields` → `listInternalMetadata` — hardcodes `origin=INTERNAL` (`ReactiveMetadataFieldRepositoryImpl.java:46`); EXTERNAL fields are NEVER returned via this endpoint regardless of the query.
   - Collector ingestion paths → write EXTERNAL only; never expose them on a UI-side read endpoint.

The partition encodes the architectural intent: **user-typed custom metadata** (the "Custom Metadata" feature shown in the UI's `MetadataCreateFormItem` autocomplete) is a DISJOINT namespace from **collector-emitted metadata** (the data-source-discovered metadata that appears on a data entity's metadata tab as a separate section). The two are stored in the same physical table for join-friendliness with `metadata_field_value` (which carries the FK on `metadata_field.id` regardless of origin), but they are NEVER intermixed at the user-visible layer.

**Wisdom test**: PASS. Three intent anchors:
1. **Schema design** — partial unique indices are an EXPLICIT positive design choice. The maintainer wrote `WHERE origin = 'INTERNAL'` in the index definition; the absence of a unified UNIQUE(name) is INTENTIONAL.
2. **Service-tier method bifurcation** — `getOrCreateMetadataFields` vs `ingestMetadataFields` are SEPARATE methods on `MetadataFieldService` (the interface declares both at lines 11-19). The two-method shape is the API-level encoding of the partition.
3. **Wire-surface hardcoding** — `origin=INTERNAL` is a literal in the repository SQL (`ReactiveMetadataFieldRepositoryImpl.java:46`), not a parameter. The implementation refuses to expose EXTERNAL on this endpoint regardless of any caller intent.

Structural impact (every Data Entity's metadata UI is built around the INTERNAL/EXTERNAL split; merging the namespaces would break the autocomplete + the metadata-section grouping); alternative (single unified namespace with `origin` as a metadata field) is a structural change to the schema + service-tier + UI.

**Operator-visible consequence**:
- An operator typing `cost_centre` into the Custom Metadata autocomplete sees only INTERNAL fields, even if a Snowflake adapter has ingested a column-level `cost_centre` from the source database.
- A collector pushing metadata via `ingestMetadataFields` cannot conflict with a user-typed INTERNAL field of the same name (the partition isolates them).
- The UI's metadata tab on a Data Entity shows INTERNAL and EXTERNAL fields in SEPARATE sections (per the live docs page `https://docs.opendatadiscovery.org/features/data-discovery/metadata-stale.md`).

**Existing ADR**: no direct overlap. Adjacent to **ADR-CANDIDATE-142** (partial-merge UPSERT semantics — collectors own ODDRN identity; operators own metadata) — the INTERNAL/EXTERNAL partition is the metadata-side facet of the same maintainer-stance ("operator-typed vs collector-emitted are SEPARATE namespaces"). Adjacent to **ADR-CANDIDATE-065** (Tag auto-create acknowledged) — Tag is the closest sibling: single-origin namespace, auto-grown, no UI partition. The MetadataField case is the BIFURCATED variant; the Tag case is the UNIFIED variant.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- **REFACTOR-436** EXISTING — `metadata_field` partial unique indexes NOT migrated for soft-delete (V0_0_64 left this table behind). The partition is preserved but the soft-delete semantics aren't fully integrated.
- **REFACTOR-642** NEW (HIGH) — MetadataField PageInfo theatre + unbounded return + no ORDER BY + no read gate. The READ endpoint that enforces the partition has SEPARATE refactoring scope.
- DOC-GAP — no live doc page documents Custom Metadata end-to-end (verified: `/active-platform-features/metadata` returns 404). The partition is undocumented for operators.

**Proposed action**: Promote to `adrs/drafts/metadata-field-origin-partition.md` (new ADR). Document:
1. The decision: the `metadata_field` table is partitioned by `origin` into INTERNAL (user-typed) and EXTERNAL (collector-ingested) sub-namespaces.
2. The schema encoding: two partial unique indices (V0_0_1__init.sql:238-244).
3. The service-tier encoding: two methods (`getOrCreateMetadataFields` vs `ingestMetadataFields`).
4. The wire-surface encoding: `/api/metadata/fields` hardcodes INTERNAL.
5. The UI behaviour: separate metadata-section groupings per origin.
6. The operator-facing implication: collectors and users cannot conflict on field names at the UI level; the autocomplete is INTERNAL-only.
7. Cross-link the doc-gap: the live `/active-platform-features/metadata` page needs publication and should explain the partition.

**Severity rationale**: MEDIUM — schema-and-API-contract co-design decision; one feature (Custom Metadata) but a load-bearing primitive for any future metadata-extension work. The decision is invisible at the wire surface unless the implementer reads the schema. Pairs with REFACTOR-436 (soft-delete preservation) and REFACTOR-642 (read-side gaps).

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-142 (collector-vs-operator namespace separation — the metadata-side instance); ADR-CANDIDATE-212 (directory-side-effect-only mutation pattern — the INTERNAL side of the partition is a side-effect-grown directory, same shape as Title).
- SUPERSEDES: none.
- CONFLICTS: none.

---
