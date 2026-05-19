## REFACTOR-419 — Collector identity session-bridge BREAKS on cluster deployments without sticky sessions (`session.provider: IN_MEMORY` default) — COLLECTOR_ID_SESSION_KEY invisible to second-hop instance; surfaces as HTTP 500 not as a re-auth prompt

**Severity**: HIGH
**Category**: cluster-fragility (deployment-topology hazard)
**Pillars affected**: [P-09-security-access-control, P-10-integrations-ingestion]
**Batch**: P (2026-05-20)

**Surfaced by**: `IngestionController__controller-method__createDataSourceEntity.md:bugs_limitations_corner_cases.[1]` (MEDIUM elevated to HIGH after cross-batch consequence analysis)

**Description**: The `IngestionDataSourceFilter` writes `SessionConstants.COLLECTOR_ID_SESSION_KEY = collector.getId()` into the WebSession's attribute map (`IngestionDataSourceFilter.java:36-38`); the `IngestionController.createDataSource` reads it via `exchange.getSession().map(ws -> ws.getAttribute(...))` (`IngestionController.java:50-58`). `application.yml:30` defaults `session.provider: IN_MEMORY` AND `application.yml:2-3` defaults `spring.session.timeout: -1` (unlimited).

On a clustered deployment with multiple platform replicas behind a load balancer WITHOUT sticky sessions, the collector's `POST /ingestion/datasources` (request 1, lands on instance A — session created) followed by any second hop to `/ingestion/datasources` (request 2, lands on instance B — instance B has no session) sees `COLLECTOR_ID_SESSION_KEY` as `null`. The controller then throws `IllegalStateException("Collector id is null")` at `IngestionController.java:54`, which propagates as HTTP 500. There is no 401 conversion, no operator-facing error contract, no re-authentication signal.

The codebase ships `session.provider: REDIS` and `session.provider: INTERNAL_POSTGRESQL` as alternatives (per the comment at application.yml:29), but the default is in-memory. **Operators deploying a clustered platform are not warned about this in any live doc.**

**Primary source citations**:
- `application.yml:28-30` (in-memory default)
- `IngestionDataSourceFilter.java:36-38` (session-write)
- `IngestionController.java:50-58, 54` (session-read + `IllegalStateException`)
- `AbstractIngestionFilter.java:40` (parent only catches `AccessDeniedException`, not `IllegalStateException`)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-141 NEW (batch P — collector identity via WebSession attribute) codifies the architectural choice; this scope is the cluster-deployment manifestation. The implied prescription is that the live doc should warn about cluster-deployment fragility AND optionally the platform should fail-fast at boot.

**Proposed remedy**:
1. Add a `disabled-authentication`-shaped live-doc warning on `configuration-and-deployment/odd-platform.md` documenting the cluster-deployment caveat: "If you deploy with multiple platform replicas, set `session.provider: REDIS` OR enable sticky sessions at the load balancer. The default `IN_MEMORY` session store is per-instance; ingestion datasource registration relies on session state."
2. Convert the `IllegalStateException` to `Mono.error(new AuthenticationException("Session lost; re-establish connection"))` at `IngestionController.java:54` so the surface is HTTP 401 not 500. Pair with a per-request log line at INFO level.
3. (Optional) Emit a fail-loud WARN at boot when `session.provider: IN_MEMORY` AND the platform is detected to be running in a containerised environment.

**Severity rationale**: HIGH — affects every clustered deployment; silent failure mode (500 instead of 401) misleads operators; the architectural choice (ADR-CANDIDATE-141) is sound, but the deployment-topology gap is operationally severe.

**Suggested backlog grouping**: `Cluster-deployment hardening sprint` (group with cross-batch advisory-lock-id-collision findings from batch D).

---
