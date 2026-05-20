## REFACTOR-539 — Three NEW `/ingestion/**` endpoints are UNAUTHENTICATED in EVERY shipped auth mode — the `IngestionDataEntitiesFilter` exact-literal POST-only matcher silently leaves sibling endpoints uncovered; the operator-facing `auth.ingestion.filter.enabled` property name implies broader coverage than the matcher delivers

**Severity**: HIGH
**Category**: missing-auth (cross-cutting; extends REFACTOR-185 family to a 3rd, 4th, 5th surface)
**Batch**: Z (2026-05-20)
**Pillars affected**: [P-10-integrations-ingestion (the entire S2S surface), P-09-security-access-control (the trust gradient), P-04-data-quality (stats ingestion), P-07-active-platform-features (metrics ingestion)]

**Surfaced by**:
- `getDataEntitiesByDEGOddrn.md:bugs_limitations_corner_cases.[0]` (HIGH) — "Endpoint is UNAUTHENTICATED in EVERY shipped deployment mode — including when the operator has enabled `auth.ingestion.filter.enabled=true` believing they have locked down the ingestion surface."
- `postDataSetStatsList.md:bugs_limitations_corner_cases.[0]` (HIGH) — "Endpoint is UNAUTHENTICATED under EVERY combination of `auth.type` AND `auth.ingestion.filter.enabled`."
- `ingestMetrics.md:bugs_limitations_corner_cases.[0]` (HIGH) — "`POST /ingestion/metrics` is UNAUTHENTICATED in every supported deployment posture."
- **LIVE DOC CROSS-VALIDATION** (`postDataSetStatsList.md:docs_link_semantic.inferred_docs.[1]` — WebFetched 2026-05-20 status 200): "All other /ingestion/* paths (e.g. /ingestion/alert/alertmanager, /ingestion/entities/degs/children, /ingestion/entities/datasets/stats) ... remain outside the ingestion filter's coverage." AND: "Unauthenticated under auth.type = DISABLED, OAUTH2, or LDAP — even when the ingestion filter is enabled."

**Statement**: Three NEW `/ingestion/**` endpoints surfaced in batch Z are unauthenticated in EVERY shipped deployment configuration, INCLUDING when the operator has enabled `auth.ingestion.filter.enabled=true` believing they have locked down the ingestion namespace:

1. **`GET /ingestion/entities/{deg_oddrn}`** — S2S DEG-membership read. The endpoint exposes any DEG's full member list (ODDRN + DataEntityType) to any caller; cross-owner enumerable; sequential DEG-id ODDRN generation enables O(N) catalog enumeration.

2. **`POST /ingestion/entities/datasets/stats`** — DQ statistics ingestion. Any caller can write arbitrary statistics to any dataset field by knowing the field ODDRN; the response is `201 Created` regardless of whether real data was written; cross-dataset stats-write with no parent-child consistency check.

3. **`POST /ingestion/metrics`** — Metrics ingestion. Any caller can submit MetricSetList referencing any ODDRN with any labels; the labels are propagated verbatim (PII propagation surface); the INTERNAL_POSTGRES backend has no tenant_id column (no tenant isolation); the PROMETHEUS backend appends `tenant_id={value}` label asymmetrically.

**Root cause — the path-matcher exact-literal scope vs the property-name namespace implication**:
- `IngestionDataEntitiesFilter.java:28`: `PathPatternParserServerWebExchangeMatcher("/ingestion/entities", HttpMethod.POST)` — exact-literal, POST-only.
- `SecurityConstants.java:96`: `WHITELIST_PATHS` includes `/ingestion/**` — the entire ingestion prefix is exempted from UI auth in ALL 4 modes (DISABLED / LOGIN_FORM / OAUTH2 / LDAP).
- `application.yml:46-48`: `auth.ingestion.filter.enabled: false` — the filter is OFF by default; the property name reads as namespace-scoped (a fooled operator believes "the ingestion namespace is protected when I set true").

**The compound** under the bundled defaults: `/ingestion/**` is whitelisted from UI auth + `IngestionDataEntitiesFilter` is OFF + the filter's path matcher excludes the 3 sibling endpoints. ALL 5 `/ingestion/*` paths (`POST /ingestion/entities` for the destructive-write surface tracked by REFACTOR-185 + the 3 NEW endpoints surfaced in batch Z + `POST /ingestion/alert/alertmanager` for the AlertManager webhook per ADR-CANDIDATE-006) have DIFFERENT auth defaults; the operator-facing property name treats them as one namespace.

**Primary source citations**:
- `IngestionController.java:75-79` (getDataEntitiesByDEGOddrn — no @PreAuthorize)
- `IngestionController.java:81-87` (postDataSetStatsList — no @PreAuthorize)
- `IngestionController.java:89-95` (ingestMetrics — no @PreAuthorize)
- `IngestionDataEntitiesFilter.java:28` (exact-literal `/ingestion/entities` POST matcher)
- `IngestionDataSourceFilter.java:20` (`/ingestion/datasources` POST matcher — does NOT match the 3 batch-Z endpoints)
- `SecurityConstants.java:95-96` (`/ingestion/**` WHITELIST_PATHS exemption)
- `application.yml:32-34` (auth.type=DISABLED shipped default)
- `application.yml:46-48` (auth.ingestion.filter.enabled=false shipped default)
- Live security docs WebFetched 2026-05-20 status 200 (cross-validation that the gap IS documented at the security page)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-027 STRENGTHENED batch Z (ingestion auth trust gradient — 5-posture × 6-endpoint matrix), ADR-CANDIDATE-192 NEW batch Z (read-collaborative S2S read posture with AUTH-MODE-ORTHOGONAL property), ADR-CANDIDATE-006 (AlertManager network-delegated auth — sibling). The architectural intent is a 5-tier trust gradient; the implementation provides one toggle that gates one endpoint, leaving the other 5 endpoints with their own per-endpoint defaults.

**Proposed remedy** (cross-cutting):
1. **Rename / clarify `auth.ingestion.filter.enabled`** to `auth.ingestion.entities-filter.enabled` (operator-facing clarity — the property gates ONE filter covering ONE endpoint).
2. **Add per-endpoint filters** for the 3 new sibling endpoints: `IngestionMetricsFilter`, `IngestionDatasetStatsFilter`, `IngestionDEGReadFilter` — each `@ConditionalOnProperty` gated by its own property; operator can opt-in per endpoint.
3. **OR** broaden `IngestionDataEntitiesFilter` to `/ingestion/**` (cross-cutting fix — covers all siblings; the security trade-off is breaking the AlertManager webhook's network-delegated model — explicit opt-out needed).
4. **Add cross-link on the live data-quality page + the metrics-storage page** surfacing the auth posture (the security page already documents the compound, but operators reading the feature pages do not encounter the cross-reference).
5. **Add boot-time security-posture validator** (REFACTOR-073 prescription) extended to compound-check all 5 ingestion paths under `auth.type=DISABLED + auth.ingestion.filter.enabled=false` — emit fail-loud WARN.

**Severity rationale**: HIGH — three production-relevant S2S endpoints unauthenticated by deployment default; the compound with REFACTOR-185 (17+ sidecar DISABLED-mode bypass) means a default ODD deployment exposes EVERY `/ingestion/*` write AND read surface to anonymous network callers. The cross-batch picture is the largest single security gap in the platform's default deployment posture.

**Suggested backlog grouping**: `Authentication / boot-time security posture hardening` — co-batched with REFACTOR-073, REFACTOR-185 (the cross-cutting fix surface).

---
