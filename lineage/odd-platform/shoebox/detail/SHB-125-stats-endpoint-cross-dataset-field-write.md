# SHB-125 — `POST /ingestion/entities/datasets/stats` lets any caller write field statistics to any dataset by knowing the field's ODDRN

**Category**: merged
**Severity**: HIGH

## Hypothesis

The dataset-statistics ingestion endpoint resolves dataset_fields by the FIELD ODDRN supplied in the payload's `fields` map; the surrounding `DataSetStatistics.datasetOddrn` parent identifier is used only for FTS-vector recalculation, not for parent-child consistency validation. An attacker (or a misconfigured profiler collector) can submit a payload `{datasetOddrn: A, fields: {<oddrn-of-field-in-dataset-B>: <stats>}}`, the platform writes the supplied statistics to that field's `dataset_field.stats` JSONB column, and the lying parent FTS-recalcs dataset A — completely uncoupled from where the field actually lives. Combined with the unauthenticated posture (this endpoint is NOT covered by any ingestion filter and is whitelisted out of UI auth), it is enumerable + writable by any HTTP caller.

## Evidence

- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/DatasetFieldServiceImpl.java:158-181` — `updateStatistics` is `@ReactiveTransactional`. The dataset_oddrn from the payload feeds `datasetOddrns` for FTS recalc (line 168-170, 179); the actual writes target `dataset_field` rows resolved BY FIELD ODDRN from `statistics.keySet()` (line 172-174). NO parent-child cross-check anywhere.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/DatasetFieldServiceImpl.java:233-251` — `updateFieldsStatistics` iterates `existingFields`, deserialises each supplied `DataSetFieldStat`, and writes it to the field's `stats` column via `field.setStats(JSONB.jsonb(JSONSerDeUtils.serializeJson(stat)))` + `bulkUpdate(fieldsToUpdate)`. No ownership check, no parent-validation.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/ingestion/IngestionController.java:81-87` — the controller is a 4-line proxy; no `@PreAuthorize`, no programmatic auth check, no empty-payload guard (unlike sibling `postDataEntityList`).
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/filter/IngestionDataEntitiesFilter.java:28` — the filter's path matcher is exact-literal `/ingestion/entities` POST. The sub-path `/ingestion/entities/datasets/stats` is unmatched. Filter coverage = none.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/utils/SecurityConstants.java:95-96` — `WHITELIST_PATHS` contains `/ingestion/**`. UI auth modes (OAUTH2/LDAP/LOGIN_FORM) do not protect this endpoint.
- `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security` (WebFetched 2026-05-20 per postDataSetStatsList sidecar) — verbatim: "All other /ingestion/* paths (e.g. /ingestion/alert/alertmanager, /ingestion/entities/degs/children, /ingestion/entities/datasets/stats) ... remain outside the ingestion filter's coverage."
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/DatasetFieldServiceImpl.java:172-181` — `getLastVersionDatasetFieldsByOddrns(statistics.keySet())` uses the payload's field-ODDRN set as input. The repository performs no JOIN to dataset_oddrn to enforce parent-child consistency.

## Notes

- Field ODDRNs follow a deterministic convention (`{datasource_oddrn}/datasets/{dataset_name}/fields/{field_name}`-shaped) and are visible in the catalog's UI to every authenticated user via the Dataset Structure tab. Enumeration cost is O(number of fields catalog-wide); writes are anonymous, low-cost.
- The destructive blast radius:
  - **Stats overwrite** — operator-visible at the Dataset Structure tab (rendered values for `nulls_count`, `low_value`, `mean_value`, etc. are attacker-controlled).
  - **Quality Dashboard rings** — `dataset_field.stats` feeds the per-dataset DQ surface (F-022, F-032); attacker-controlled stats poison the visualisation.
  - **BI tools reading `dataset_field.stats`** — JSONB blob is consumed by downstream tools per the cross-pillar consumer mapping.
- The `dataset_oddrn` parent in the payload is functionally a free-form "where to recalc the search vector" pointer; an attacker can name dataset A as parent (triggering an FTS recalc on A) while writing to dataset B's field. This is also a cheap DoS amplifier — repeatedly recalc-ing FTS on a heavy dataset with no actual stats writes is operator-visible only as Postgres CPU load.
- Cross-link to F-040 (DQ Test Run History — diagnostic-text leak via `status_reason`). Both are "DQ-related surface ships attacker-controlled text into a visible field." This thread is the WRITE-side equivalent of F-040's read-side leak.
- Also cross-link to F-008 — same `silent_destruction_replace_not_merge` class. A re-POST with FEWER tags than the previous POST silently removes the absent EXTERNAL_STATISTICS-origin tags from the affected fields (per DatasetFieldServiceImpl.java:221-223). The tag-removal-on-absence is the same class of contract; the SCOPE is different (per-field tags, not per-entity lineage).
- The fix is structural: either (a) add a parent-validation check that the resolved field's `dataset_id` matches the payload's `dataset_oddrn`'s `dataset_id`, OR (b) accept the payload's `dataset_oddrn` as the ONLY identity and look up child fields by parent-id (constrains the write to the payload's named dataset).
- This is an OPEN thread because evidence is rich but the user-observable SYMPTOM (operators noticing tampered stats on their datasets) has not been confirmed via probe. The mechanism is verified; the witnessing of the symptom requires the dynamic-verification slice to fire a probe.

## Next

1. Promote to `F-NNN` in pillar P-04 ("Dataset Field Statistics Ingestion — cross-dataset write surface"). Test matrix: (a) cross-dataset payload → confirm write lands on field B; (b) attacker payload + fake parent → confirm FTS recalc on A; (c) unauthenticated payload → confirm 201; (d) replay-with-fewer-tags → confirm tag removal.
2. Probe-NNN: fire a probe payload with mismatched `datasetOddrn` and `fields.<field-of-other-dataset>` against a local docker-compose mirror. Capture the resulting `dataset_field.stats` row. Slice 2 dynamic-verification layer would cover this.
3. SEC-NNN: add parent-validation at `DatasetFieldServiceImpl.updateStatistics` line 172 — assert the resolved field's dataset_id matches the payload's `datasetOddrn`'s dataset_id; if mismatch, throw `BadUserRequestException("Field does not belong to declared dataset")`.
4. DOC-NNN: the live `features/data-quality` page mentions `POST /ingestion/entities/datasets/stats` by name but says nothing about payload validation. Add a caveat (or link to a security page) once the security gap is closed.

## Links

- cluster_with: [F-008, F-022, F-040]
- merged_into: F-095
- supersedes: []

## evaluation

- **feature-flow-builder 2026-05-26**: graduate — SHB-125 evidence (7 file:line refs across controller / service / filter / WHITELIST / live security docs + cross-link to F-008 silent-destruction class) is rich; the cross-dataset write surface + FTS-recalc-on-lying-parent + replay-with-fewer-tags shape composes a distinct user-observable feature anchored on the `/ingestion/entities/datasets/stats` endpoint. Minted F-095 at lineage/odd-platform/feature-flows/detail/F-095.yaml (pillar P-10:F-003). Pillar choice: P-10 (endpoint-surface) rather than P-04 (subject-domain DQ) — keeps slice-G ownership consistent and aligned with F-094's auth-coverage matrix. Cross-links F-008 (silent_destruction shared class) + F-022/F-032/F-040 (DQ consumers).
