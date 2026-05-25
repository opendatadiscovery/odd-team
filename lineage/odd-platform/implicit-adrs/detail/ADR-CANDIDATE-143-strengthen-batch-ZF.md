# ADR-CANDIDATE-143 — Namespace is INHERITED from Collector on the S2S path; S2S endpoints never accept a namespace from the payload

## STRENGTHENS — batch ZF (2026-05-25)

**Class-level confirmation** via the IngestionController-class consolidation:

- `odd-platform__java__IngestionController__controller-class__IngestionController.md:coherence_check.strengthens.[ADR-CANDIDATE-143]` — "**STRENGTHENS** with the class-level evidence: createDataSource is the SOLE handler on this controller that creates/updates DataSourcePojo, and it inherits namespace from `CollectorDto.namespace()` (DataSourceIngestionServiceImpl.java:106 per batch-P sidecar). The UI counterpart (DataSourceController.registerDataSource) accepts namespace from the form. The class-level view confirms: the ingestion controller has ZERO endpoints that accept a namespace from the payload."

The class-level enrichment is the **NEGATIVE-SPACE CONFIRMATION** of ADR-143 — by enumerating all 5 endpoints and observing that NONE of them accept a `namespace` field in their payload, the class-level view proves the absence is consistent across the entire S2S surface. ADR-143 is therefore not a property of the createDataSource endpoint specifically; it is a property of the ENTIRE INGESTION CONTROLLER.

A future maintainer extending the S2S surface should be alerted: NEW endpoints on this controller MUST NOT accept a namespace from the payload. If a new endpoint needs to write namespace-scoped data, the namespace MUST be inherited from the Collector identity (via `IngestionDataSourceFilter`'s session attribute or the `CollectorDto.namespace()` resolution path).

The strengthening adds no new evidence to the ADR's positive claim; it adds NEGATIVE-SPACE evidence that the absence is comprehensive at the class level.

---
