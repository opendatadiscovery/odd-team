## REFACTOR-421 — Session-state-loss on `/ingestion/datasources` surfaces as HTTP 500 with `IllegalStateException("Collector id is null")` — operator-misleading; not converted to 401 / re-auth signal

**Severity**: MEDIUM
**Category**: missing-error-mapping
**Pillars affected**: [P-10-integrations-ingestion, P-09-security-access-control]
**Batch**: P (2026-05-20)

**Surfaced by**: `IngestionController__controller-method__createDataSourceEntity.md:bugs_limitations_corner_cases.[0]` + `:security.known_security_gaps.[1]`

**Description**: `IngestionController.java:53-55` reads the `COLLECTOR_ID_SESSION_KEY` and throws `IllegalStateException("Collector id is null")` when missing. The parent filter `AbstractIngestionFilter.java:40` only catches `AccessDeniedException` (mapped to 401); `IllegalStateException` propagates to the default reactive error handler as HTTP 500. Operators debugging cluster issues see a 500 in logs and reasonably conclude "platform crashed," not "session lost — re-establish connection." An attacker with a valid token but probing session-state-corrupt scenarios can distinguish "session intact (200)" from "session corrupt (5xx)" — a minor info-leak about deployment topology (clustered without sticky sessions vs single-instance).

**Primary source citations**:
- `IngestionController.java:53-55`
- `AbstractIngestionFilter.java:40`

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-141 + the cluster-fragility scope REFACTOR-419 share the prescription — convert the IllegalStateException to a meaningful HTTP error (401 with `Re-authenticate; session lost`).

**Proposed remedy**: Replace the `throw new IllegalStateException("Collector id is null")` with `return Mono.error(new AuthenticationException("Session lost; re-establish connection"))`. Add `AbstractIngestionFilter.java:40`-style catch for the new exception type → 401 mapping. Add an INFO-level log entry on entry into the controller for forensic correlation.

**Severity rationale**: MEDIUM — error-mapping hygiene; small info-leak (deployment-topology fingerprint); operator-facing UX bug under cluster deployments.

**Suggested backlog grouping**: `Ingestion error-mapping hardening` (small focused PR).

---
