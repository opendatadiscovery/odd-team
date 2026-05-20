## ADR-CANDIDATE-006 — STRENGTHENED BATCH P — AlertManager Webhook Receiver auth is operator-delegated to network layer — METHOD-TIER PRIMARY SOURCE CONFIRMED

**Severity unchanged**: HIGH
**Updated support count**: now **3-sidecar** (batch A class-level + batch B config-key-consumer + batch P method-level)
**Batch**: P (2026-05-20)

**New surfaced_by**:
- `AlertManagerController__controller-method__postAlerts.md:implicit_adrs.[1]` (HIGH) — "Authentication for the AlertManager receiver is delegated to operator-side network controls (reverse proxy / mTLS / NetworkPolicy) rather than handled in-platform. The endpoint is in the `/ingestion/**` whitelist (SecurityConstants.java:96), and unlike `/ingestion/entities` (which is covered by IngestionDataEntitiesFilter when `auth.ingestion.filter.enabled=true`), there is no shared-secret or token mechanism for this path. The decision is recorded in the live doc page verbatim ('Apply perimeter controls (network segmentation, authenticating reverse proxy, mTLS) for any deployment where these endpoints are reachable from outside the trusted network')." — evidence: SecurityConstants.java:96 (`/ingestion/**` whitelist) + IngestionDataEntitiesFilter.java:28 (the filter's matcher is `/ingestion/entities` POST only — confirms NO sibling filter covers /alert/alertmanager) + WebFetch live doc 2026-05-20 (the doc-side acknowledgment) — intent_anchor: "The AlertManager webhook endpoint is not authenticated. ODD Platform whitelists the entire `/ingestion/**` namespace in Spring Security…" (live doc, 2026-05-20)

**The triangle is now complete at three layers**:
- **Class-level** (batch A `AlertManagerController` class sidecar) — surfaced the architectural choice from the controller-class perspective
- **Config-level** (batch B `IngestionDataEntitiesFilter` config sidecar — confirmed NO sibling filter for `/alert/alertmanager`)
- **Method-level** (NEW batch P `postAlerts` controller-method sidecar — the canonical primary source with WebFetched live-doc confirmation 2026-05-20)

**Doc-side surfacing improvement (batch P observation)**: the previously-404 `/active-platform-features/alerting` page is NOW 200 (verified WebFetch 2026-05-20); the page documents the unauthenticated posture verbatim + the AlertManager-driven-alerts halt-toggle limitation. The doc-side coverage that the prior class-level sidecar (batch A 2026-05-08) called out as missing has been REMEDIED at the doc layer between 2026-05-08 and 2026-05-20.

**Cross-link with ADR-CANDIDATE-140 (NEW batch P)**: ADR-CANDIDATE-140 codifies the asymmetric ingestion architecture (three different postures across three endpoints) — ADR-CANDIDATE-006 is the AlertManager-side individual posture; ADR-CANDIDATE-140 is the meta-level pattern across all three.

**Severity unchanged at HIGH**.

---
