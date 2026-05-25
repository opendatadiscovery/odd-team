# ADR-CANDIDATE-142 — Partial-merge UPSERT semantics for S2S DataSource; collectors own identity, operators own metadata

## STRENGTHENS — batch ZF (2026-05-25)

**Class-level confirmation** via the IngestionController-class consolidation:

- `odd-platform__java__IngestionController__controller-class__IngestionController.md:coherence_check.strengthens.[ADR-CANDIDATE-142]` — "**STRENGTHENS by CLASS-LEVEL COUNTERFACTUAL**. The class-level view confirms ADR-142 is the ASYMMETRY between THIS controller (S2S, narrow merge for createDataSource) and DataSourceController (UI, full-form replace). The architectural intent visible at the class level: 'collectors own the IDENTITY of a datasource (ODDRN, namespace via Collector); operators own the METADATA (name, description, connection_url, type, owner) via the UI'. The 5-handler class-level surface ENFORCES this division: createDataSource is the ONLY mutating endpoint here that touches DataSourcePojo, and it narrows to name+description."

The class-level enrichment provides the architectural counterfactual that the per-method sidecars established only by inference: the IngestionController has exactly ONE write path that touches `data_source` (`createDataSource`), and that one path narrows to name+description. The OTHER 4 endpoints touch DIFFERENT tables entirely (`data_entity`, `dataset_field`, `metric_series`/`metric_point`, `group_entity_relations`). The class-level view PROVES the architectural division is not coincidental — it is consistent across the entire S2S surface.

The strengthening also resolves a potential ambiguity in the original ADR-142 (which was method-tier): "is the narrow-merge a feature of THIS endpoint, or of the S2S surface generally?". The class-level answer: **the narrow-merge is a feature of the createDataSource endpoint specifically because it is the ONLY S2S endpoint that touches data_source; the broader principle (collectors own identity; operators own metadata) is enforced by the FACT that other S2S endpoints write to OTHER tables**.

The architectural division (collector-identity vs operator-metadata) is now confirmed at the class level. A future maintainer extending the S2S surface should be alerted: NEW endpoints that need to write to `data_source` will violate ADR-142 unless they similarly narrow their merge scope. The default expectation should be that NEW S2S endpoints write to non-`data_source` tables.

---
