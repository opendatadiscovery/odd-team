## ADR-CANDIDATE-027 — STRENGTHENED BATCH P — Ingestion-token verification opt-in trust gradient now confirmed at method-tier for all three `/ingestion/*` siblings

**Severity unchanged**: HIGH
**Updated support count**: now **4-sidecar** (1 batch B config-key-consumer + 1 batch O class-level + 2 batch P method-level)
**Batch**: P (2026-05-20)

**New surfaced_by**:
- `IngestionController__controller-method__createDataSourceEntity.md:concepts.invariants.[0]` (HIGH) — "Controller has no `@PreAuthorize`, no programmatic `permissionService.hasPermission(...)`. Authentication is delegated to `IngestionDataSourceFilter` (sibling unconditional filter) which validates the bearer token against the COLLECTOR table and writes `COLLECTOR_ID_SESSION_KEY` into the session BEFORE this method runs. If the filter rejects, the controller never executes."
- `AlertManagerController__controller-method__postAlerts.md:security.auth_mode_relevance` (HIGH) — "NONE — operator-delegated network-layer auth (the F-007 `unauthenticated_payload_trust` facet, confirmed at method tier). The method itself carries no `@ConditionalOnProperty` and no `@PreAuthorize`. … The endpoint accepts any AlertManager-shaped POST from any caller with network reach to the platform port, under all four `auth.type` modes and under all values of `auth.ingestion.filter.enabled`."

**The three-tier trust gradient is now confirmed at THREE LAYERS (config / class / method) across all three ingestion paths**:
1. `POST /ingestion/datasources` — ALWAYS-AUTH (filter UNCONDITIONAL) — batch P createDataSourceEntity method tier
2. `POST /ingestion/entities` — OPT-IN-AUTH (filter conditional + explicit YAML false) — batch B + batch O
3. `POST /ingestion/alert/alertmanager` — NETWORK-DELEGATED (no filter) — batch A class-level + batch P postAlerts method tier

The cross-batch evidence is now COMPLETE for ADR-CANDIDATE-027's gradient claim. Every layer of the substrate (config, class, method) at every endpoint of the gradient (datasources, entities, alertmanager) is anchored at primary source.

**Cross-link with ADR-CANDIDATE-140 (NEW batch P)**: ADR-CANDIDATE-027 is the CONFIG-AXIS view of the gradient; ADR-CANDIDATE-140 is the CONTROLLER-METHOD-AXIS view. They are complementary descriptions of the same architecture. The maintainer triaging into `adrs/drafts/` should consider consolidating ADR-CANDIDATE-027 + ADR-CANDIDATE-140 + ADR-CANDIDATE-006 + ADR-CANDIDATE-014 + ADR-CANDIDATE-141 into a single "Ingestion architecture" ADR family (5-section combined doc).

**Severity unchanged at HIGH**.

---
