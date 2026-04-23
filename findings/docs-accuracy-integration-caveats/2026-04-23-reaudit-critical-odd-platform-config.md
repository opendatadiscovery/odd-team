# Findings: docs/accuracy/integration-caveats (first run — re-audit)
# Date: 2026-04-23
# Target: odd-platform (local) + documentation branch feature/critical-odd-platform-config
# Scope: Consumer-read re-audit of DOC-005 (email), DOC-006 (session provider), DOC-008 (attachment storage), DOC-018 (platform-base-url) under the new Implementation Quality Bar (`CLAUDE.md` responsibilities #4, #5)

## Why this re-audit exists

On 2026-04-23 a user spot-check revealed that the DOC-008 attachment-storage documentation — which had just shipped under `/implement` with `status: done` — was missing a critical caveat: `MinioConfig.java` never calls `.region(...)` on the MinIO builder, so attachment storage only works against `us-east-1` S3 buckets. The miss was not caught by:

- the config-options scanner (which only cross-referenced `application.yml` against the docs)
- the feature-behavior scanner (which did not run on the attachment domain)
- the `/implement` self-audit (which had no consumer-read gate)
- `/review` (which was never run — the implementer self-closed every item in the batch)

Under the new rails (Phase A of pipeline-hardening, commit `96b28c4`), the same four items are re-audited with a full consumer-read + SDK-builder pass. This file records every caveat the new bar surfaces that the old bar missed.

## Summary

- Items re-audited: 4 (DOC-005, DOC-006, DOC-008, DOC-018)
- New findings: 4 (2 in-scope amendments to in-flight PR; 2 new backlog items)
- Severity breakdown: 2 high (operator-visible silent failures), 2 medium (operator-visible ergonomic traps)

## Findings

### F-CAV-001 — DOC-005 in-scope amendment — JavaMailSender SDK defaults are operator-hostile

- **Location (code)**: `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/config/NotificationConfiguration.java:51-72`
  Additional: `odd-platform-api/.../notification/sender/EmailNotificationSender.java:44-61`
- **Location (doc)**: `documentation/docs/configuration-and-deployment/odd-platform.md` — email notifications section (shipped in DOC-005)
- **Builder audit** — `JavaMailSenderImpl` parameters:

  | Parameter | Status | Operator consequence if left default |
  |-----------|--------|--------------------------------------|
  | `setHost`, `setPort`, `setUsername`, `setPassword` | configured | — |
  | `mail.transport.protocol` | configured | — |
  | `mail.smtp.auth`, `mail.smtp.starttls.enable` | configured (only if protocol=smtp) | — |
  | `mail.smtp.connectiontimeout` | **UNSET** (SDK default: infinite) | Unreachable SMTP server hangs the notification thread indefinitely |
  | `mail.smtp.timeout` (read) | **UNSET** (SDK default: infinite) | Stuck read blocks notification delivery |
  | `mail.smtp.writetimeout` | **UNSET** (SDK default: infinite) | Slow server holds notification thread |
  | `mail.smtp.ssl.enable` | **UNSET** (SDK default: false) | Implicit-TLS SMTP servers (e.g. Gmail port 465, many corporate relays) cannot be used — only STARTTLS is supported |
  | `mail.smtp.ssl.trust` | **UNSET** (SDK default: JVM truststore only) | Internal / self-signed CAs fail unless operator extends the JVM truststore — no ODD config key exposes this |
  | `mail.smtp.ssl.checkserveridentity` | **UNSET** (SDK default varies by JVM) | Hostname verification behavior not operator-controllable |
  | `MimeMessageHelper` charset | **UNSET** (constructor at EmailNotificationSender.java:47 takes no charset) | Non-ASCII subjects / bodies may be mangled depending on default charset |
- **Silent failure mode**: `EmailNotificationSender.send()` loops over `notificationsEmails` and calls `emailSender.send()` per recipient. Exception on recipient N wraps as `RuntimeException` (line 59) → **remaining recipients after N do not receive the message**. Not documented anywhere.
- **Severity**: **high** — each caveat is an operator-visible silent failure mode (hang, auth-fail, mangled subject, partial delivery)
- **Classification**: **in-scope for DOC-005** (DOC-005's remit was "document email notifications config completely" — defaults and failure modes are part of complete coverage under Quality Bar #3 + #5)
- **Action**: Amend `feature/critical-odd-platform-config` (documentation) with a "Known limitations" subsection in the email notifications area. No new backlog item.

### F-CAV-002 — DOC-008 in-scope amendment — MinIO HTTP timeout + chunked-upload local filesystem + no retry

- **Location (code)**:
  - `odd-platform-api/.../config/MinioConfig.java:19-25` (client builder)
  - `odd-platform-api/.../service/attachment/remote/RemoteFileUploadServiceImpl.java:60-77` (chunked-upload flow)
  - Same file:107-135 (error handling — no retry)
- **Location (doc)**: `documentation/docs/configuration-and-deployment/odd-platform.md` — attachment storage section (shipped in DOC-008)
- **Builder audit** — `MinioAsyncClient.builder()`:

  | Parameter | Status | Operator consequence |
  |-----------|--------|----------------------|
  | `.endpoint(url)` | configured | — |
  | `.credentials(accessKey, secretKey)` | configured | — |
  | `.region(region)` | **UNSET** → SigV4 default `us-east-1` | **already documented in DOC-008 (0f8e5e3)** ✓ |
  | `.httpClient(OkHttpClient)` | **UNSET** → MinIO SDK default (OkHttp with read/writeTimeout ≈ 5 min) | Large-file uploads (>5 min wall-time) fail; connect timeout not configurable via ODD properties |
- **Chunked upload caveat**: `RemoteFileUploadServiceImpl.completeFileUpload` (line 61-77) reassembles chunks from a LOCAL filesystem directory (`FileUtils.getChunkDirectory(uploadId)`) before upload. **Even in REMOTE mode**, in-flight uploads stage on local disk. In a container restart mid-upload, the chunk directory is wiped — same failure class as the LOCAL-mode ephemeral-default that DOC-008 warns about, but for the REMOTE mode the doc does not warn.
- **No retry**: `putObject`, `getObject`, `removeObject` (lines 107-135) wrap any exception as `MinioException` and fail the call. Transient S3/MinIO errors (503, network blip) are not retried. Undocumented.
- **Max-file-size**: `attachment.max-file-size: 20` MB is already documented, but the single-part-upload threshold of the MinIO SDK means files up to ~5 MB are single-part, above is multipart — not operator-relevant but worth a one-liner.
- **Severity**: **high** (chunked-upload chunk loss on K8s restart is a data-loss caveat identical in class to the LOCAL warning that DOC-008 already carries; HTTP timeout is a medium ergonomic trap; no-retry is a medium operator expectation mismatch)
- **Classification**: **in-scope for DOC-008** (Quality Bar #3 + #5 — attachment-storage section should cover REMOTE caveats completely)
- **Action**: Amend `feature/critical-odd-platform-config` (documentation) with expanded "Known limitations" subsection in the attachment storage area covering HTTP timeout, chunked-upload staging, and no-retry.

### F-CAV-003 — DOC-006 follow-up: session-provider operator caveats (new item DOC-059)

- **Location (code)**:
  - `odd-platform-api/.../config/SessionConfiguration.java` (three provider variants)
  - `odd-platform-api/.../auth/session/PostgreSQLSessionHousekeepingJobHandler.java:13` (`@Scheduled(fixedRate = 1, timeUnit = HOURS)`)
  - `odd-platform-api/.../auth/session/PostgreSQLSessionHousekeepingJob.java` (deletes expired rows)
  - `@EnableRedisWebSession` annotation triggers Spring Session Redis (no local wiring for connection — operator supplies `spring.data.redis.*`)
- **Findings**:
  - `IN_MEMORY`: `ReactiveMapSessionRepository(new ConcurrentHashMap<>())` — no eviction beyond Spring Session TTL. Long-running processes with many short-lived sessions accumulate map entries until Spring Session TTL expires them. **OOM risk in degenerate cases**, not documented.
  - `INTERNAL_POSTGRESQL`: housekeeping cadence is **hardcoded to 1 hour** — expired sessions remain in `SPRING_SESSION` / `SPRING_SESSION_ATTRIBUTES` for up to 1h after expiry. Not configurable. Not documented.
  - `REDIS`: no local configuration wiring — operator must set `spring.data.redis.*` (or `spring.redis.*` on older Spring Boot). TLS / pool sizing / timeout inherit Spring defaults. None of these are documented.
- **Severity**: **medium** (affects operators picking a session backend; each caveat changes deployment posture)
- **Classification**: **out-of-scope for DOC-006** (DOC-006 was a 1-line default-value correction; session-provider deep caveats deserve their own item)
- **Action**: Create `backlog/docs/DOC-059.md` with `scanner_source: "discovered-during-DOC-006-reaudit"`.

### F-CAV-004 — DOC-018 follow-up: third `odd.platform-base-url` consumer with inconsistent default (new item DOC-060)

- **Location (code)**:
  - `odd-platform-api/.../config/SlackMessageGeneratorConfiguration.java:15` — default `http://localhost:8080` (documented in DOC-018)
  - `odd-platform-api/.../notification/config/NotificationConfiguration.java:105` — email sender, default `http://localhost:8080` (documented in DOC-018)
  - `odd-platform-api/.../integration/StaticArgumentMappingContext.java:16` — **default `http://your.odd.platform`** (NOT documented; different default from the other two)
- **Findings**:
  - `StaticArgumentMappingContext` exposes `odd.platform-base-url` as a `platform_url` parameter to integrations (parameter substitution for external tools).
  - **The default value differs** from the notification consumers (`http://your.odd.platform` instead of `http://localhost:8080`). An operator who leaves `odd.platform-base-url` unset will see `http://your.odd.platform` substituted into integration parameters — a placeholder-looking string that will not connect to anything.
  - The doc only covers the notification use; it does not mention integrations consume the same key, nor does it warn about the inconsistent default.
- **Severity**: **medium** (operator confusion; potential silent integration failures if `odd.platform-base-url` is unset)
- **Classification**: **out-of-scope for DOC-018** (DOC-018's scope was narrowly "remove the bogus Slack env var and clarify the shared base-url"; the integrations-parameter use is a separate feature area)
- **Action**: Create `backlog/docs/DOC-060.md` with `scanner_source: "discovered-during-DOC-018-reaudit"`.

## Cross-cutting observations

- **The DOC-008 region miss was not an isolated failure.** The new audit found 3 more caveat-defaulted SDK parameters across the same batch that the old bar also missed (SMTP timeouts, SMTP implicit TLS, MinIO HTTP timeout). The pattern is: every SDK builder that ODD uses has parameters ODD does not set, and the consequences of each unset parameter are invisible to any audit that does not open the builder.
- **Every one of the 17 `done` items prior to this date was self-closed.** Phase C of the remediation (audit of older items) should treat this as the prior for expected finding density.
- **Navigation gap**: Before the re-audit, `navigation/domains/attachments.md` listed `MinioConfig.java` only as a result of the 2026-04-23 region fix. Other bean factories (`NotificationConfiguration.mailSender`, `SlackMessageGeneratorConfiguration.slackNotificationMessageGenerator`, `SessionConfiguration.*`) were not in their respective domain files. Adding them is a Phase C prerequisite so future scans do not have to grep.

## Next steps

1. Amend `feature/critical-odd-platform-config` (documentation) with in-scope caveat content for DOC-005 and DOC-008.
2. Flip DOC-005, DOC-006, DOC-008, DOC-018 from `status: done` to `status: review-ready` on `batch/critical-odd-platform-config-state`. Add Re-Audit (2026-04-23) section to each.
3. Create `backlog/docs/DOC-059.md` and `backlog/docs/DOC-060.md` on `feature/pipeline-hardening`.
4. Run `/review` on each of DOC-005/006/008/018 in a separate session after Phase A merges.
5. Proceed to Phase C: re-audit of older done items (DOC-001/003/013/036/052..057/058/035) for the same class of caveats.
