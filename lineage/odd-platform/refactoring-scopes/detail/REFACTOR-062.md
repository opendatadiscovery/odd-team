- **REFACTOR-062** (NEW 2026-05-10A): Token-rotation response body returns the new plaintext token without `Cache-Control: no-store` or other sensitive-body headers — every reverse-proxy / API-gateway / browser-history / response-logging middleware between UI and backend records the credential
  - **Category**: response-cache-leak
  - **Surfaced by**:
    - `odd-platform__java__CollectorController__controller-method__regenerateCollectorToken.md:bugs_limitations_corner_cases.[3]` (MEDIUM)
    - `odd-platform__java__CollectorController__controller-method__regenerateCollectorToken.md:security.known_security_gaps.[0]` (MEDIUM)
  - **Statement**: `CollectorController.java:50` returns the rotated Collector via `.map(ResponseEntity::ok)` with NO response-header customisation. The new plaintext token is in the body. Any logging / caching / proxying middleware on the response path captures the credential. No header marks the body as sensitive (no `Cache-Control: no-store`, no custom `X-Sensitive-Body` signal for downstream tooling).
  - **Evidence**: `CollectorController.java:50` + `TokenMapper.java:15-18` (plaintext returned when showToken=true)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-017 (token rotation semantics) requires returning plaintext on rotate (the user has no other way to learn the secret); the ADR does NOT defend the absence of cache/log-prevention headers — those are a gap-shape orthogonal to the rotation model.
  - **Proposed remedy**: Add `Cache-Control: no-store, no-cache, must-revalidate` and `Pragma: no-cache` to the rotation response. Optionally add a custom `X-Sensitive-Body: token` advisory header for downstream log-redaction tooling. Document on the live `enable-security` page that operators should redact response bodies for `PUT /api/collectors/*/token` in any logging tier.
  - **Severity rationale**: MEDIUM — credential exposure via standard middleware behaviour.
  - **Suggested backlog grouping**: `Token rotation hardening`

---

## STRENGTHENS — Batch ZB (2026-05-21) — the DataSource token-rotation response has the SAME bare `.map(ResponseEntity::ok)` with no sensitive-body header; the gap is platform-wide across both credential families

**New surfaced_by**:
- `odd-platform__java__DataSourceController__controller-method__regenerateDataSourceToken.md:bugs_limitations_corner_cases.[4]` (MEDIUM) — "The new token is returned in the response body in plaintext (40 alphanumeric chars). Any reverse-proxy, API-gateway, browser response cache, or server-side response-body logging between the UI and the backend records the new credential. The controller sets no response header marking the body sensitive (no `Cache-Control: no-store`) — `DataSourceController.java:56-58` is a bare `.map(ResponseEntity::ok)`."
- `odd-platform__java__DataSourceController__controller-method__regenerateDataSourceToken.md:security.known_security_gaps` (MEDIUM) — confirms the rotated data-source token traverses every layer between controller and client with no `Cache-Control: no-store`.

**Why a STRENGTHEN, not a new entry**: `DataSourceController.regenerateDataSourceToken` (lines 56-58) is a bare `.map(ResponseEntity::ok)` — the IDENTICAL response-construction shape as `CollectorController.java:50`. Both return the plaintext token in the body with zero sensitive-body headers. The `registerDataSource` and `registerCollector` create paths share the same shape (the create response also carries the plaintext token — see TEST-GAP-750 in the test-map registry, which already records the controller-tier plaintext-token chain across all four endpoints). The remedy (add `Cache-Control: no-store` + `Pragma: no-cache` to every plaintext-token-bearing response) covers both. Title should be re-scoped on triage to "ODD token-bearing responses (Collector + DataSource register & regenerate)".

**Severity unchanged: MEDIUM** — credential exposure via standard middleware on the data-source token rotation/registration responses, the same shape as the Collector path.

---
