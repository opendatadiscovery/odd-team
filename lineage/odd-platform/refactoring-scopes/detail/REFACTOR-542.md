## REFACTOR-542 — `postDataSetStatsList` cross-dataset stats-write — payload's `dataset_oddrn` is NOT validated against field ODDRNs' parent-dataset relationship; an attacker can write stats to any dataset field by knowing its ODDRN regardless of the declared parent

**Severity**: HIGH
**Category**: missing-validation + missing-auth + cross-tenant-write-surface
**Batch**: Z (2026-05-20)
**Pillars affected**: [P-04-data-quality (stats are the DQ-ingestion path), P-09-security-access-control (cross-owner write surface)]

**Surfaced by**:
- `postDataSetStatsList.md:bugs_limitations_corner_cases.[1]` (HIGH) — "Cross-dataset stats-write: a payload's `dataset_oddrn` is used ONLY to compute the FTS-recalc set (DatasetFieldServiceImpl.java:168-170, 179); the actual writes target `dataset_field` rows resolved BY FIELD ODDRN from the payload's `fields` map (line 172-174). An attacker who knows a target field's ODDRN can write arbitrary statistics to that field's `stats` JSONB column AND create EXTERNAL_STATISTICS tag relations on it — REGARDLESS of which dataset's ODDRN they declare in the parent `DataSetStatistics.datasetOddrn`. There is no parent-child consistency check."
- `postDataSetStatsList.md:security.known_security_gaps.[3]` (MEDIUM) — "Cross-dataset stats-write: payload `dataset_oddrn` is NOT validated against field ODDRNs' parent-dataset relationship. A malicious payload `{dataset_oddrn: A, fields: {odd:datasource:B:dataset:b:field:b1: <stats>}}` writes stats to field `b1` of dataset B while triggering FTS recalc on dataset A. Useful for cross-dataset audit confusion."

**Statement**: ODD's `POST /ingestion/entities/datasets/stats` endpoint (the `postDataSetStatsList` controller method) accepts a `DatasetStatisticsList` payload structured as:
```json
{
  "items": [
    {
      "dataset_oddrn": "odd:datasource:A:dataset:a",
      "fields": {
        "odd:datasource:B:dataset:b:field:b1": { "integer_stats": {...} }
      }
    }
  ]
}
```

The implementation at `DatasetFieldServiceImpl.updateStatistics` (lines 158-181):
1. Resolves `dataset_field` rows by **field ODDRN** (line 172-174 — `getLastVersionDatasetFieldsByOddrns(statistics.keySet())` where `keySet()` is the map of field ODDRNs from the payload's `fields` map).
2. Writes the stats JSONB blob to each resolved field's row (line 233-251 — `bulkUpdate(fieldsToUpdate)`).
3. Recalculates FTS structure vectors for the **dataset_oddrn** values from the payload (line 168-170, 179 — `updateStructureVectorForDataEntitiesByOddrns(datasetOddrns)`).

There is NO parent-child consistency check: the implementation does NOT verify that the declared `dataset_oddrn` is the parent of the field ODDRNs in the `fields` map. An attacker with knowledge of any field's ODDRN can write statistics to that field's row WHILE declaring an unrelated `dataset_oddrn` as the parent. The mismatched FTS-recalc on the declared dataset_oddrn is the side-effect that may confuse cross-dataset audit logs.

**Combined with REFACTOR-539** (the endpoint is unauthenticated in every mode), this is a write-side cross-owner enumeration surface — the read-collaborative posture extends here to a WRITE primitive that any caller can exercise. Field ODDRNs follow deterministic naming conventions (e.g. `{datasource_oddrn}/datasets/{dataset_name}/fields/{field_name}` per the SDK conventions); they are visible in the platform's UI to all authenticated users. An attacker enumerating field ODDRNs can write arbitrary statistics to any dataset field owned by any team.

**Primary source citations**:
- `IngestionController.java:81-87` (postDataSetStatsList — no auth, no validation)
- `DatasetFieldServiceImpl.java:158-181` (the actual writer — no parent-child check)
- `DatasetFieldServiceImpl.java:172-174` (field ODDRN lookup)
- `DatasetFieldServiceImpl.java:168-170, 179` (FTS recalc uses dataset_oddrn from payload)
- `DatasetFieldServiceImpl.java:233-251` (bulkUpdate of resolved field rows)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-061 (ingestion controller-side semantic validation — the architectural intent is "controller enforces semantics, schema describes shape"; the gap is that NO semantic validation exists for stats-path payload structural integrity). ADR-CANDIDATE-027 STRENGTHENED batch Z (the ingestion auth trust gradient — this endpoint is in the FOURTH tier of "no auth at all"). ADR-CANDIDATE-192 NEW batch Z (read-collaborative S2S surface — extends to WRITE here).

**Proposed remedy** (multi-option):

**Option A — Add parent-child consistency check (LOW effort)**:
```java
// In DatasetFieldServiceImpl.updateStatistics, before the bulkUpdate:
for (DataSetStatistics stats : datasetStatisticsList.getItems()) {
    String declaredDatasetOddrn = stats.getDatasetOddrn();
    for (String fieldOddrn : stats.getFields().keySet()) {
        if (!fieldOddrn.startsWith(declaredDatasetOddrn + "/fields/")) {
            throw new BadUserRequestException(
                "Field " + fieldOddrn + " does not belong to dataset " + declaredDatasetOddrn);
        }
    }
}
```
- One LOC at the controller / service boundary; rejects cross-dataset attempts with 400
- Caveat: the ODDRN format convention varies by collector (the prefix-match may not hold universally); a robust implementation would re-resolve the field's parent in the DB
- Migration cost: existing collectors emitting valid parent-child relationships continue to work; collectors emitting mismatched payloads (rare in practice) need to fix their integration

**Option B — Resolve parent at the DB layer (HIGHER effort)**:
- Repository-side query: for each resolved field row, JOIN to `data_entity` to get the parent dataset ID; compare against the payload's declared dataset ODDRN's resolved ID
- Reject mismatches with 400
- More robust; cost is the extra JOIN per request

**Option C — Add @PreAuthorize gating the endpoint (cross-cutting with REFACTOR-539)**:
- This endpoint is unauthenticated by default per REFACTOR-539; adding auth at all would partly mitigate the cross-dataset write surface by requiring a credentialed caller
- Even with auth, the cross-dataset write would still be possible — the parent-child check (Option A or B) is the SPECIFIC fix; auth is the meta-fix

Recommend: **Option A (immediate)** + **add the endpoint to REFACTOR-539's auth-cluster fix (medium-term)**. The parent-child check is cheap and closes the specific cross-dataset attack vector; the cross-cutting auth fix is the broader scope.

**Severity rationale**: HIGH — cross-owner / cross-dataset WRITE surface under unauthenticated default deployment; field-stats are surfaced in the UI Quality Dashboard + per-entity Test reports tab, so polluted stats become operator-visible across teams. The cross-link with REFACTOR-539 + REFACTOR-543 (TAG_CREATE bypass) makes the postDataSetStatsList endpoint the largest single ingestion-side write-attack surface.

**Suggested backlog grouping**: `Ingestion-write validation hardening sprint` co-batched with REFACTOR-543 (the TAG_CREATE bypass on the same endpoint), REFACTOR-539 (the auth cluster), REFACTOR-540 (tenant isolation).

---
