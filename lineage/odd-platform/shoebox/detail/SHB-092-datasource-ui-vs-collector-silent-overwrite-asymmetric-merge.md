# SHB-092 — Operator UI edits to Datasource name/description are silently overwritten by the next collector startup (asymmetric merge across two write paths)

**Category**: open
**Severity**: HIGH

## Hypothesis

The same `data_source` table is mutated through TWO disjoint paths that apply DIFFERENT merge semantics: (a) `PUT /api/datasources/{id}` (Management → Datasources tab Edit form) uses MapStruct `@MappingTarget` to FULL-REPLACE every mutable field; (b) `POST /ingestion/datasources` (S2S collector startup) UPSERTs by ODDRN and applies PARTIAL-MERGE of ONLY `name` + `description`. The asymmetry is silent at both ends: an operator's UI edit to a datasource's name is overwritten on the next collector startup with no warning; the operator's edit to (e.g.) connection_url is preserved because the collector never sends that field. No Activity Event records either path; the audit trail cannot reconstruct who-last-touched-which-field.

## Evidence

- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/DataSourceController.java:38-45` — UI update path: `dataSourceService.update(id, form)` → `DataSourceServiceImpl.update` (line 68-83, `@ReactiveTransactional`).
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/mapper/DataSourceMapper.java:49-56` — `applyToPojo(DataSourcePojo, DataSourceUpdateFormData)` uses MapStruct `@MappingTarget` → writes ALL form fields (no field-set narrowing).
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/ingestion/DataSourceIngestionServiceImpl.java:74-92` (S2S sister sidecar, batch S) — UPSERT-by-ODDRN narrows UPDATE to ONLY `name` + `description`.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/DataSourceServiceImpl.java:1-110` — Grep confirms NO `@ActivityLog` on `create/update/delete/regenerateToken`; the entire mutation surface is forensically silent.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/filter/IngestionDataSourceFilter.java` — the S2S path is gated by collector token; the UI path is gated by RBAC permission. Two disjoint auth filters → two disjoint principal models → two disjoint paths to the same table.
- `concepts/detail/canonicalisation_candidates/upsert-by-oddrn-partial-merge-collector-driven-only-name-description.yaml` — concept catalog already names the partial-merge invariant.
- `ADR-CANDIDATE-142` (per DataSourceController sidecar back-link) — the partial-merge is now visible as a deliberate architectural decision: collectors are constrained tenants, operators are admins.

## Notes

- The asymmetry IS deliberate (per ADR-CANDIDATE-142) — collectors should not be able to clobber operator-set fields like connection_url. The intent is sound. The implementation gap: the asymmetry is NOT operator-visible. An operator editing a datasource name in the UI sees a successful save; they have no idea a collector will overwrite it on its next startup.
- Operator-pain scenarios:
  - "Renamed our PG datasource from 'pg-prod-old' to 'pg-prod' in the UI; collector restart overwrote it back to the collector's `name` field" — operators must remember to update the COLLECTOR's `collector_config.yaml` to match, then restart.
  - "Edited description to add ownership/runbook info; collector overwrote with empty description because the collector_config didn't include one."
- The Activity Feed audit-gap compounds: an operator who comes back to find the name reverted has NO way to learn it was the collector's startup that overwrote it — no `data_source_updated_by_collector` event; no `data_source_updated_by_operator` event; no diff record.
- A UI surface element ("This field is operator-set; collectors will not overwrite it" / "This field is collector-set; your edit will be overwritten on the next collector restart") is THE feature that operators need but does not exist. The UI has no awareness of the asymmetry either.
- Cross-link to F-031 (Data Source Lifecycle) and F-008 (Batch Ingestion).

## Next

1. **ENRICH F-031** with this drift facet (`operator_vs_collector_silent_overwrite_asymmetric_merge`). F-031 anchors the Datasource lifecycle but does not enumerate the cross-path interaction.
2. **REFACTOR-NNN**: introduce per-field `operator_set` boolean OR `last_updated_by` enum (operator | collector) on the DataSourcePojo; collector UPSERT respects `operator_set` flags; UI shows a lock icon next to operator-owned fields.
3. **DOC-NNN**: `/features/management` Datasources section must document the asymmetric merge + the silent-overwrite class.
4. **REFACTOR-NNN**: add `@ActivityLog` on all 4 mutating service methods + on the S2S DataSourceIngestionServiceImpl UPDATE — diff visible in the activity feed.

## Links

- cluster_with: [F-031, F-008, F-020, F-021]
- merged_into: (open)
- supersedes: []
