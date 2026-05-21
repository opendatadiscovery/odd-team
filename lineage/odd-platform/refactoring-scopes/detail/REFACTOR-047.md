- **REFACTOR-047** (NEW 2026-05-10A): Collector token rotation has no grace period — in-flight ingestion using the previous token 401s the moment the UPDATE commits; no `previous_token` column, no `valid_until` window
  - **Category**: missing-grace-period
  - **Surfaced by**:
    - `odd-platform__java__CollectorController__controller-method__regenerateCollectorToken.md:bugs_limitations_corner_cases.[0]` (severity HIGH)
    - `odd-platform__java__CollectorController__controller-method__regenerateCollectorToken.md:security.known_security_gaps.[5]` (severity HIGH operational)
  - **Statement**: ADR-CANDIDATE-017's "in-place UPDATE" rotation model has a structural consequence: there is NO overlap window during which the old token still authenticates. The moment `UPDATE token SET value = ... WHERE id = :id` commits, every in-flight ingestion request using the old token starts 401-ing with `"Token is not correct"` (`IngestionDataEntitiesFilter.java:55-58` — single-value `String.equals(...)`). Operators rotating during active ingestion cause an outage that lasts until every collector picks up the new token (config-file change + restart). Neither the docs site nor the response body warns of this.
  - **Evidence**: `TokenGeneratorImpl.java:44-52` + `ReactiveTokenRepositoryImpl.java:30-39` + `IngestionDataEntitiesFilter.java:55-58`
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-017 codifies the in-place UPDATE model. This scope is a structural consequence of the model, not a violation. The absence of defending documentation IS a gap (the operator has no warning); the absence of a grace-period mechanism is a feature gap (adding `previous_token` + `valid_until` would be a structural change requiring an extension ADR).
  - **Proposed remedy**: At minimum, document the operational consequence on a new "Token Rotation" doc section (under `enable-security`). At maximum, add a `previous_token` + `previous_token_valid_until` columns to the TOKEN table; modify `IngestionDataEntitiesFilter` to accept either the current or the (still-valid) previous token; expose `attachment.token.rotation-grace-minutes` as an operator config. The structural change requires extending or superseding ADR-CANDIDATE-017.
  - **Severity rationale**: HIGH — operational severity. Operators rotating during incident response can cascade into ingestion outages.
  - **Suggested backlog grouping**: `Token rotation hardening`

---

## STRENGTHENS — Batch ZB (2026-05-21) — the DataSource token-rotation path has the SAME no-grace-window destructive cutover; the gap is platform-wide across both credential families

**New surfaced_by**:
- `odd-platform__java__DataSourceController__controller-method__regenerateDataSourceToken.md:bugs_limitations_corner_cases.[1]` (HIGH) — "No rotation grace period — rotation is a destructive in-place UPDATE with no old/new overlap. A collector / push-client still using the old token starts failing `POST /ingestion/entities` with 401 `Token is not correct` the moment the UPDATE commits (`IngestionDataEntitiesFilter.java:56-57`). An operator rotating a data-source token during active ingestion locks out ingestion until the collector picks up the new token (typically a config-file change + restart). No warning is logged, no notification fires, the docs do not document it."
- `odd-platform__java__DataSourceController__controller-method__regenerateDataSourceToken.md:stress_findings.name_behavior_pairs` — "the operator should understand rotation is instantaneous and binary, not a staged revoke/issue — there is no grace window to coordinate the collector restart."

**Why a STRENGTHEN, not a new entry**: the in-place-UPDATE rotation model (`ReactiveTokenRepositoryImpl.updateToken` — single `DSL.update(TOKEN)` statement) and its downstream 401-on-stale-token verification (`IngestionDataEntitiesFilter.java:56-57` plaintext `.equals`) are the SAME code on BOTH the Collector and the DataSource rotation paths. The data-source token is what `IngestionDataEntitiesFilter` validates for `POST /ingestion/entities` (the data-source token; the collector token goes through `IngestionDataSourceFilter`) — so the no-grace-window consequence is, if anything, the PRIMARY surface for the data-source token. The remedy (a `previous_token` + `valid_until` window, or at minimum a doc section) covers both. Title should be re-scoped on triage to "ODD token rotation (every `token` row)".

**Severity unchanged: HIGH** — operational severity confirmed on the data-source rotation path; an operator rotating a data-source token during active ingestion locks out that data source's ingestion with zero grace window.

---
