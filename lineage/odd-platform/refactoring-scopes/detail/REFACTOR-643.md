# REFACTOR-643 — `/api/slack/events` has no rate-limit, no request-body size cap, and the JSONB `event` column accepts arbitrarily-sized payloads → partition-fill DoS by any internet caller

**Severity**: HIGH
**Category**: missing-rate-limit + missing-payload-cap + DoS-vector
**Pillars affected**: [P-07 Active Platform Features (Discussions), P-09 Security & Access Control]
**Batch**: ZF (2026-05-25)

**Surfaced by**:
- `odd-platform__java__EventApiController__controller-class__EventApiController.md:performance.known_performance_gaps.[1]` (MEDIUM) — "No rate-limit on the unauthenticated public endpoint. Combined with the no-signature gap, an attacker can flood the endpoint and the JSONB column with forged events until the partition fills."
- `odd-platform__java__EventApiController__controller-class__EventApiController.md:performance.known_performance_gaps.[0]` (MEDIUM) — "No request-body size limit applied at the controller level — Spring WebFlux defaults govern. A 50MB JSON POST is read into memory by `@RequestBody Mono<String>` before parser dispatch."
- `odd-platform__java__EventApiController__controller-class__EventApiController.md:performance.resource_allocation` — "JSONB column in `message_provider_event.event` stores the full Slack payload (V0_0_59__data_collaboration.sql:32) — no payload-size cap. A maliciously-sized Slack event JSON (or one tactically crafted by an attacker exploiting the unauthenticated endpoint) bloats the table without bound."

**Description**: The `/api/slack/events` endpoint is internet-reachable by architectural design (per ADR-CANDIDATE-216), but the absence of three defensive controls makes the endpoint a DoS vector:

1. **No rate-limit at the controller / filter / interceptor layer** — verified by grep across `<odd-platform>` for `RateLimit`, `Bucket4j`, `RedisRateLimiter`, `ConcurrencyLimit`, etc. (zero matches at the EventApiController path).
2. **No request-body size cap at the controller** — `@RequestBody Mono<String> rawRequestBody` (EventApiController.java:23-24) inherits Spring WebFlux's default 256KB `spring.codec.max-in-memory-size` UNLESS the operator explicitly increased it. The sibling IngestionController class sidecar notes the platform-wide setting is `20MB` (application.yml:14-15). A 20MB JSON POST is read into memory before any parsing or filtering.
3. **No JSONB column size cap on `message_provider_event.event`** — the JSONB stores the FULL Slack payload (V0_0_59__data_collaboration.sql:32). A 19MB payload (just under the 20MB body cap) is persisted as one JSONB row.

Combined with the missing signature verification (REFACTOR-633) — the platform has no way to distinguish genuine Slack deliveries from attacker forgeries:

**Attack scenarios**:

1. **Partition-fill DoS** — an attacker sends 1M synthesized events at 100 events/sec for 3 hours; the `message_provider_event` table accumulates 1M JSONB rows of attacker-controlled payload. The table's monthly partition (per `datacollaboration.message-partition-period=30` days, application.yml:203) fills; subsequent legitimate events fail-to-insert.
2. **Memory exhaustion** — an attacker sends 1000 concurrent 19MB JSON POSTs; each POST allocates ~19MB of heap for the `@RequestBody Mono<String>` materialisation; the JVM heap exhausts; the platform OOMs.
3. **Postgres connection exhaustion** — every accepted event triggers one SELECT (getUUIDByProviderInfo) + one INSERT (createMessageEvent) on the request path; sustained 100 events/sec exhausts the R2DBC connection pool; legitimate user requests block.
4. **Slack 3-second-ack deadline collapse** — under load, the SELECT + INSERT may exceed 3 seconds; Slack's retry contract kicks in; combined with REFACTOR-634 (no event_id dedup), duplicate rows compound the load.
5. **Slack retry storm exacerbation** — without rate limiting, an attacker sending forged events at high rate IS effectively a retry storm; Slack itself might rate-limit the platform's IP (impacting legitimate Slack-to-platform deliveries on a different feature).

**Operator-visible failure modes**:

1. Discussions feature becomes unresponsive (event_processor backlog grows, child message rows lag the inbound stream).
2. Platform-wide latency spike due to connection pool exhaustion.
3. Postgres storage fills the `messages` partition; operator alarms fire.
4. Legitimate Slack deliveries fail; the operator sees "platform stopped processing Slack events" but cannot identify the cause.

**Primary source citations**:
- `<odd-platform-api>/src/main/java/.../EventApiController.java:22-27` (no rate-limit / filter / interceptor).
- `<odd-platform-api>/src/main/resources/application.yml:14-15` (20MB body cap; platform-wide, not endpoint-scoped).
- `<odd-platform-api>/src/main/resources/db/migration/V0_0_59__data_collaboration.sql:32` (JSONB `event` column; no size cap).
- `<odd-platform-api>/src/main/java/.../DataCollaborationMessageEventProcessor.java:147-149` (single-leader processor; bottleneck on backlog drainage).

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-216 explicitly enumerates rate-limiting as a missing compensating control; this REFACTOR is the operator-actionable closure. Sibling: REFACTOR-017 (AlertManager endpoint no rate-limit + payload size + duplicate suppression — SAME SHAPE on a different webhook).

**Proposed remedy**: Five-part fix:

1. **Add endpoint-scoped rate-limit** via a Spring WebFlux filter at the `/api/slack/events` path. Use Resilience4j RateLimiter or Bucket4j with a per-IP bucket:
   - Default: 100 events/sec per source IP.
   - Sustained: 6000 events/minute per source IP.
   - 429 Too Many Requests + Retry-After header on overflow.
   - Operators can tune via `datacollaboration.events-rate-limit.requests-per-second`.

2. **Add endpoint-scoped body-size cap** (smaller than the platform-wide 20MB):
   - `spring.codec.max-in-memory-size` at the `@RequestBody` level via custom `WebFluxConfigurer` for the EventApi path.
   - Recommended: 100KB. Slack events are small (a typical message event is ~2-3KB); a 100KB cap accommodates 100x normal size for safety while rejecting attacker-amplification.

3. **Add JSONB column size cap** at the schema level:
   ```sql
   ALTER TABLE message_provider_event
     ADD CONSTRAINT message_provider_event_payload_size_check
     CHECK (octet_length(event::text) <= 100 * 1024);  -- 100KB
   ```

4. **Add per-partition row-count alarm** — operator-visible Prometheus metric or DB observability so the operator sees backlog growth.

5. **Add integration tests**:
   - 1000 events in 1 second from one IP → 100 succeed, 900 get 429.
   - Single 1MB POST → 413 Payload Too Large.
   - Single 50KB POST → 200 OK.

**Severity rationale**: HIGH — DoS vector on an internet-reachable endpoint by architectural design; combined with REFACTOR-633 (signature absent) and REFACTOR-634 (dedup absent), the three-gap bundle is the highest-leverage Discussions-feature security gap. The fix is small and the cost-benefit overwhelming.

**Suggested backlog grouping**: `Slack-events hardening sprint` — bundle with REFACTOR-633 / 634. The four together (signature, dedup, rate-limit, payload-cap) close the operator-actionable webhook-receiver gaps.

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-017 (AlertManager rate-limit gap — same shape on different webhook); REFACTOR-063 (token rotation rate-limit gap — same class).
- SUPERSEDES: none.
- CONFLICTS: none.

---
