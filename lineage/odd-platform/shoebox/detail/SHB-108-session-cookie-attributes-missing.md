# SHB-108 — Session cookie attributes never configured; sessions never expire

**Category**: open
**Severity**: HIGH

## Hypothesis

Operators deploying ODD Platform on session-based auth modes (LOGIN_FORM, OAUTH2, LDAP — all three rely on `WebSession`) see **session cookies with no `Secure` flag, no operator-configured `SameSite` directive, and a `spring.session.timeout: -1` default meaning sessions NEVER expire**. The platform offloads cookie security to the deployment topology (reverse proxy adding flags externally) — but no doc warns operators of this responsibility and no code path stamps the flags. A stolen session cookie remains valid until manual platform-side invalidation or JVM restart; on a non-HTTPS deployment, the cookie travels in clear; on a multi-tenant proxy with permissive `SameSite=lax`, cross-site GET / top-level-navigation cookie leakage applies. The feature is **"session cookie posture under default config"** — an operator-observable defence-in-depth surface the platform delegates entirely outward.

## Evidence

- `odd-platform-api/src/main/resources/application.yml:1-3` — `spring.session.timeout: -1` — Spring Session semantic: sessions NEVER expire. Sessions live for the JVM lifetime (`IN_MEMORY` mode) or until manual invalidation. Combined with the absence of session revocation hooks across the codebase, a compromised cookie is valid indefinitely.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/config/SessionConfiguration.java:1-65` — no `CookieWebSessionIdResolver` bean, no `SameSite` directive, no `HttpOnly` override, no `Secure` flag setter. `grep CookieWebSession|SameSite|HttpOnly|Secure.*cookie|sessionIdResolver|WebSessionIdResolver` across the entire odd-platform repo returns ZERO matches (verified by SessionConfiguration sidecar).
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/repository/JooqSessionRepository.java:138-148` — under `INTERNAL_POSTGRESQL` provider with `spring.session.timeout: -1`, `recordFromSession` sets `expiry_time = lastAccessedTime.plusSeconds(maxInactiveInterval.toSeconds())` — when `maxInactiveInterval` is unset or negative the expiry is effectively never reached. The `PostgreSQLSessionHousekeepingJob` (`PostgreSQLSessionHousekeepingJob.java:30`) deletes via `expiry_time < now()` — under `-1` this predicate never matches; the table grows monotonically.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/config/SessionConfiguration.java:28-30` — `session.provider: IN_MEMORY` is the SHIPPED DEFAULT. Combined with multi-replica deployments behind non-sticky load-balancers, sessions are per-process — the `/ingestion/datasources` collector-identity bridge (via `SessionConstants.COLLECTOR_ID_SESSION_KEY` written by `IngestionDataSourceFilter`, read by `IngestionController.createDataSource`) breaks on the second request hop, surfacing as HTTP 500 `IllegalStateException("Collector id is null")` (`IngestionController.java:50-58`). REFACTOR-419 is the cluster-fragility tracker; this thread complements it on the cookie-attribute axis.
- Live docs WebFetched 2026-05-20 (`/configuration-and-deployment/odd-platform#select-session-provider`) — documents `session.provider` values but is SILENT on cookie attributes (HttpOnly / Secure / SameSite / Path / Domain). Operators inheriting framework defaults have no guidance on whether `Secure` is set (it is NOT, by Spring default) — the operator must front the platform with TLS + a reverse proxy that adds the `Secure` flag externally, OR configure a `WebSessionIdResolver` bean (neither documented).
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/repository/JooqSessionRepository.java:156, 188` — under `INTERNAL_POSTGRESQL`, the session attribute payload is JAVA-SERIALISED via `SerializationUtils.serialize(...)`/`deserialize(...)` (deprecated in newer Spring versions for exactly the deserialization-gadget reason). A database compromise yields deserialisation gadgets on attribute-load.

## Notes

- Cross-link with F-017 (search filter facets): the `search_facets` table also has session-ish state (per-search UUIDs) but is NOT user-bound; logout doesn't clean it; TTL housekeeping is the sole eviction. Different session-state shape, different leakage surface.
- The session never-expires default is the LSN-001-shape: silent insecure default + warning-only doc + no programmatic guardrail. Cross-batch consistency: the SessionConfiguration sidecar explicitly cites this as the same pattern as `auth.type=DISABLED`, `attachment.storage=LOCAL`, `metrics.storage=INTERNAL_POSTGRES` — the platform-wide "OOTB experience is zero-external-deps; production-requires-explicit-config" stance.
- Caveat: under LOGIN_FORM specifically (per `LoginFormSecurityConfiguration` sidecar's `bugs_limitations_corner_cases`), the session cookie is the principal credential bearer AND CSRF is unconditionally disabled (`LoginFormSecurityConfiguration.java:54`). A logged-in browser session is the canonical CSRF target (state-changing POST/PUT/DELETE rides automatically with the session cookie) — but the platform disables CSRF AND ships with no `SameSite=strict` directive AND ships with non-`Secure` cookies on non-HTTPS deployments. Triple compounding under LOGIN_FORM.
- Caveat: under OAUTH2 + multi-replica deployment with no shared session store (`IN_MEMORY` default), the user's OAuth2 callback may hit a different pod than the initiating `/oauth2/authorization` — Spring's authorization-request-context is per-pod, the callback fails with "authorization request not found". REFACTOR-419 captures the cluster-fragility; this thread anchors the cookie+session-store interaction.
- Caveat: the housekeeping `@Scheduled` job at `PostgreSQLSessionHousekeepingJobHandler.java:13` has NO `@SchedulerLock` annotation — on a multi-instance `INTERNAL_POSTGRESQL` deployment every instance runs the cleanup hourly, producing N× DB load. Inconsistent with other ODD `@Scheduled` jobs that DO use Postgres advisory locks (notifications, partitions, data-collaboration).
- Operational-visibility gap: under `REDIS` session provider, `management.health.redis.enabled: false` is the default in `application.yml:244-245`. A Redis outage on a session-Redis-only deployment causes 5xx on every authenticated request but `/actuator/health` does not reflect it.
- This thread is "open" not "clustering" — evidence is mature (8+ refs) BUT the feature shape is genuinely new (no existing F-NNN anchors session cookie posture). Could be promoted on next sweep.

## Next

1. Probe — fresh deployment via Docker Compose, `auth.type=LOGIN_FORM`, log in, inspect the `SESSION` cookie via `curl -v`. Confirm absence of `Secure`, `HttpOnly`, `SameSite` attributes (or whatever Spring's defaults emit — likely `HttpOnly` is on, `Secure` is off, `SameSite` is implicit `lax`). Then leave the session for 7 days and confirm it remains valid.
2. Read Spring WebFlux's default `WebSessionStore` cookie-attribute defaults to triangulate the as-shipped surface (vs. the maintainer's "I haven't touched it" state).
3. Promote to a NEW `F-NNN — Session Cookie Security Posture` with `seeded_from: SHB-108` and `primary_subject: [SessionConfiguration, JooqSessionRepository, PostgreSQLSessionHousekeepingJob, application.yml:1-3,28-30, LoginFormSecurityConfiguration, OAuthSecurityConfiguration, LDAPSecurityConfiguration]`. Test matrix: cookie-attribute defaults × auth mode × session provider × HTTPS-vs-HTTP deployment.
4. DOC-NNN — add a "Session cookie security" section to the operator docs naming: (a) the default attribute set, (b) the `spring.session.timeout: -1` never-expire default, (c) the operator's responsibility to front with TLS + add `Secure` externally, (d) the operator's path to override via a `CookieWebSessionIdResolver` bean.
5. REFACTOR-NNN — consider adding a `CookieWebSessionIdResolver` bean that sets `HttpOnly=true`, `SameSite=Strict`, `Secure=true-when-detected-https`, and a sensible `Max-Age`. Backward-compatible (operators with no explicit override get a safer baseline).
6. SEC-NNN — change `spring.session.timeout` default to a safe value (e.g. 8 hours) AND emit a startup WARN log when the timeout is `-1`.

## Links

- cluster_with: [F-011]
- merged_into: (open)
- supersedes: []
