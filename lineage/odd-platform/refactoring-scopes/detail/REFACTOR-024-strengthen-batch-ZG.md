## STRENGTHENS — Batch ZG (FOUR new cross-owner read invocation sites: runs-history + DQ dashboard + DatasetField GETs + DataSetController GETs)

The cross-owner read posture (REFACTOR-024) family is the platform's load-bearing security-architecture gap class. Batch ZG adds FOUR new invocation sites, extending the family's reach to the COLUMN-GRAIN, the RUN-INSTANCE-LEVEL, the DATASET-STRUCTURE-LEVEL, and the CATALOG-WIDE-DQ-AGGREGATE surfaces:

**New surfaced_by entries**:

1. **DataEntityRunController** (`GET /api/dataentities/{id}/runs` — per-entity run history):
   - `bugs_limitations_corner_cases.[5]` (HIGH) — "Endpoint is NOT in SecurityConstants.SECURITY_RULES — no permission gate; AuthorizationCustomizer catch-all `.pathMatchers(\"/**\").authenticated()` is the only filter. Any authenticated user can read any DQ test's or transformer's run history across the whole catalog. status_reason is a free-form text field set by the test framework — non-owner gets a data-quality-diagnostic leak channel."
   - **Unique blast-shape**: the payload includes `status_reason` — a per-row diagnostic text field commonly carrying Great Expectations / dbt / custom framework failed-row sample values. Cross-owner read of this field is a PII-broadcast channel. The first cross-owner surface in the family where the leaked content is OPERATOR-SUPPLIED row-level data, not just metadata. Carries REFACTOR-652 NEW as its standalone tracker.

2. **DataQualityRunsController** (`GET /api/dataqatests/runs` — catalog-wide DQ dashboard):
   - `bugs_limitations_corner_cases.[3]` (MEDIUM) — "Controller has no @PreAuthorize, no SecurityRule entry; the catalog-wide DQ aggregate is visible to any authenticated user including all five filter dimensions enumerated." + `bugs_limitations_corner_cases.[4]` (LOW) — "Under `auth.type=DISABLED`, the dashboard endpoint is anonymously reachable."
   - **Unique blast-shape**: extends the cross-owner posture to the AGGREGATE LAYER — facet-counts reveal catalog cardinality across all owners (per-category test counts, table-health counts, monitored-table counts). Combined with the filter-completion APIs (namespaces, datasources, owners, titles, tags), an authenticated probe maps the platform's test infrastructure WITHOUT reading individual entities. Same shape as REFACTOR-187 (catalog enumeration via search) and REFACTOR-024's batch-M extension (search-facet aggregator).

3. **DatasetFieldController GETs** (`GET /api/datasetfields/{id}/enum_values`, `GET /api/datasetfields/{id}/metrics`):
   - `bugs_limitations_corner_cases.[6]` (LOW) — "GET endpoints have no `SecurityRule` entry — they are reachable by any authenticated user on any field id, regardless of parent-DataEntity permissions."
   - **Unique blast-shape**: extends the cross-owner posture to the COLUMN-GRAIN — every column's enum-value semantics + every column's metric stats are cross-owner-readable. The deepest extension; the platform's read-collaborative model is now confirmed at every grain (catalog / entity / column).

4. **DataSetController GETs** (4 endpoints: `/structure`, `/structure/{v}`, `/structure/diff`, `/relationships`):
   - `security.known_security_gaps.[0]` (MEDIUM) — "controller has no @PreAuthorize and no programmatic permission check; the four endpoints fall through to `.authenticated()` only — anyone with an account can read every dataset's schema metadata."
   - **Unique blast-shape**: combined with REFACTOR-657 NEW (cross-dataset version_id leak), an authenticated user can enumerate every dataset's structure by guessing sequential `bigserial` version_ids. The cross-dataset leak is a SECOND-LEVEL enumeration vector compounding the cross-owner read posture.

**The cumulative invocation-site catalogue** (across all batches):

| Batch | Endpoint(s) | Vector | Grain | Layer |
|---|---|---|---|---|
| B (origin) | `AlertController.getAllAlerts` | Batch alert read | Catalog | Controller |
| H | `ReactiveAlertRepositoryImpl.listAllWithStatusOpen` | SQL — no OWNERSHIP join | Catalog | Repository |
| L | `DataEntityController.getDataEntityAlerts` | Per-entity alert read | Entity | Controller-method |
| E | `SearchController.search` → `getSearchResults` | Per-entity catalog enumeration | Catalog | Controller-method |
| M | `SearchController.getSearchFacetList` + `getFiltersForFacet` | Facet aggregator: catalog cardinality enumeration | Aggregate | Aggregate-SQL |
| F | `DataEntityController.getDataEntityDetails` + `*Lineage` | Centerpiece detail + lineage subgraph | Entity / Graph | Controller-method |
| **ZG (NEW)** | **`DataEntityRunController.getRuns`** | **Per-entity runs-history + status_reason PII** | **Run-instance with per-row diagnostic text** | **Controller-class** |
| **ZG (NEW)** | **`DataQualityRunsController.getDataQualityTestsRuns`** | **Catalog-wide DQ aggregate** | **Aggregate** | **Controller-class** |
| **ZG (NEW)** | **`DatasetFieldController.getEnumValues` + `getDatasetFieldMetrics`** | **Per-column enum-values + metric stats** | **Column** | **Controller-class** |
| **ZG (NEW)** | **`DataSetController` 4 GETs (structure / by-version / diff / relationships)** | **Per-dataset structure + relationships** | **Dataset structure** | **Controller-class** |

The Read-Collaborative-Catalog architectural posture (ADR-CANDIDATE-003) is now confirmed at EVERY grain in the platform — column, run-instance, entity, dataset-structure, catalog, aggregate. The doc-side gap (live security docs do not enumerate the read-collaborative blast radius) compounds at FOUR new surfaces this batch.

**Severity unchanged at HIGH on aggregate** — the per-instance severity varies (LOW for column-GETs, HIGH for runs-history with PII broadcast), but the cross-cutting nature elevates the family to HIGH. The maintainer's prescription (either confirm the posture with explicit doc disclosure OR add per-surface SecurityRules) remains the structural fix point.

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-003 (the architectural intent — borderline RESOLVED at batch F); ADR-CANDIDATE-114 (the read-cardinality split — DataEntityRunController is the per-entity tier extension); the REFACTOR-024 cumulative family.
- SUPERSEDES: none.
- CONFLICTS: none.

---
