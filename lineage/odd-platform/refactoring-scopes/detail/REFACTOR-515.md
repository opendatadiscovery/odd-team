## REFACTOR-515 — Shared `HttpClient` has NO connect / request / response timeout — unreachable Slack / Webhook URL hangs the WAL consumer thread indefinitely; ALL channels block; cluster-wide delivery stalls until OS-level socket timeout (~75-120s on Linux)

**Severity**: HIGH
**Category**: missing-timeout + blocking-thread + cascading-failure
**Batch**: Y (2026-05-20)
**Pillars affected**: [P-07-active-platform-features (Notifications HTTP channels operational fragility), P-10-deployment-architecture]

**Surfaced by**:
- `SlackNotificationSender.md:bugs_limitations_corner_cases.[4]` (HIGH) — "**No connect / request timeout on the shared HttpClient bean.** The HttpClient is constructed via `HttpClient.newHttpClient()` at NotificationConfiguration.java:32-34 — the JDK's default factory method that does NOT set a connectTimeout. For an unreachable Slack endpoint (Slack regional outage, DNS hijack, network partition), `httpClient.send(...)` at AbstractNotificationSender.java:21 will block on the underlying socket layer until the OS-level timeout (Linux default ~75-120s for SYN_SENT). The notification-subscriber thread is single-threaded; a slow Slack endpoint blocks ALL subsequent alert delivery (Slack + Webhook + Email) across the WHOLE platform deployment."
- `WebhookNotificationSender.md:bugs_limitations_corner_cases.[8]` (HIGH) — "**No request / connect timeout — unreachable URL hangs the WAL consumer thread indefinitely.** `HttpClient.newHttpClient()` at NotificationConfiguration.java:32 does NOT set a `connectTimeout`; `HttpRequest.newBuilder()` at WebhookNotificationSender.java:20 does NOT set a `.timeout(Duration)`. The underlying JDK socket-level timeout (system-dependent, typically 75-120s on Linux for SYN retries; potentially unbounded for half-open connections) is the effective ceiling. For a deeply-broken webhook endpoint (TCP-accept-then-never-respond, or a transparent proxy that drops without RST), the dispatcher thread stalls — blocking all subsequent alerts on ALL channels for this one alert's delivery."

**Statement**: The shared `HttpClient` bean produced by `NotificationConfiguration.java:32-34` calls `HttpClient.newHttpClient()` — the JDK default factory method. This factory sets NO connection timeout, NO request timeout, NO response timeout. The Slack + Webhook senders both consume this shared instance via `AbstractNotificationSender.httpClient`.

Per `AbstractNotificationSender.java:21`:
```java
final HttpResponse<String> response = httpClient.send(request, BodyHandlers.ofString());
```
The call blocks until either (a) response arrives OR (b) OS-level socket timeout fires (Linux default ~75-120s for SYN_SENT retries; potentially unbounded for half-open TCP connections where the peer accepts but never responds).

**Cascading failure mode**:
1. Slack regional outage / DNS hijack / network partition / receiver TCP-accept-then-hang.
2. `httpClient.send(slackRequest)` blocks for 75-120s OR indefinitely.
3. The WAL consumer thread (`NotificationSubscriber` — leader-elected single thread) is STUCK in this call.
4. The 10ms inner-poll loop never iterates because the dispatcher (`AlertNotificationMessageProcessor.process`) is synchronous and the thread is blocked at `slack.send`.
5. Slack's sequential position in the senders list means Webhook + Email never fire for THAT alert.
6. The NEXT alert in the WAL stream is BUFFERED in PG's replication slot — `stream.readPending()` returns null because the subscriber thread is blocked elsewhere — but the slot's LSN never advances.
7. PG WAL retention grows (per REFACTOR-509).
8. Cluster-wide notification delivery is stalled for the duration of the OS socket timeout.

**Why this is more severe than the poison-replay loop (REFACTOR-508)**:
- Poison-replay (508) is bounded by the 10s retry cadence — at most 6 attempts/minute consuming ~50-200ms each. Steady-state CPU usage is bounded.
- No-timeout (515) is bounded by OS socket timeout — 75-120s per stuck call, potentially unbounded. The dispatcher thread is held captive; alerts queue up; PG WAL accumulates.
- A SLOW Slack endpoint (high latency but eventually responds) is operationally worse than a FAILING endpoint (immediately throws): the failing endpoint at least triggers the 10s outer-loop retry, exiting the WAL position; the slow endpoint just blocks.

**Symmetric across HTTP channels**: Both `SlackNotificationSender` (line 43-48) and `WebhookNotificationSender` (line 18-23) use the same shared HttpClient and neither calls `.timeout(Duration)` on the per-request builder. The same gap applies to both.

**Evidence**:
- `NotificationConfiguration.java:31-34` — `HttpClient.newHttpClient()` factory; no timeout config
- `AbstractNotificationSender.java:21` — the blocking `httpClient.send(...)` call
- `SlackNotificationSender.java:43-46` — no `.timeout(...)` on HttpRequest builder
- `WebhookNotificationSender.java:20-23` — no `.timeout(...)` on HttpRequest builder
- JDK `HttpClient.newHttpClient()` default behaviour (no timeout)

**Existing-ADR-or-implied-prescription**:
- ADR-CANDIDATE-186 NEW batch Y (one-shot fire-and-forget) codifies the exactly-200 contract but is SILENT on timeout — the ADR's stance does NOT defend the absence of timeout, which is a refactoring gap.
- ADR-CANDIDATE-181 NEW batch Y (fixed-cadence polling for WAL) shows the maintainer's chosen rhythm for the WAL side; the HTTP-send side has no analogous timeout commitment — the asymmetry is itself a finding.
- Cross-link to REFACTOR-130 from batch C (SMTP infinite timeouts blocks ALL Notifications channels — the SMTP-side companion; HIGH).

**Proposed remedy**:

1. **Path A (per-request timeout — minimum)** — Add `.timeout(Duration.ofSeconds(10))` (or operator-tunable) on every HttpRequest builder at SlackNotificationSender.java:43-46 and WebhookNotificationSender.java:20-23. The JDK HttpClient throws `HttpTimeoutException` (extends IOException) which is caught by `sendAndValidate(...)` and wrapped as `NotificationSenderException`.

2. **Path B (HttpClient connectTimeout)** — Build the HttpClient bean with `.connectTimeout(Duration.ofSeconds(5))` at NotificationConfiguration.java:32. Covers connection-establishment hangs but NOT response-read hangs.

3. **Path C (both A + B — recommended)** — Connect-timeout at the client level + per-request timeout at the request level. Connect-timeout catches DNS hangs + SYN_SENT retries; per-request timeout catches half-open / receiver-stalled scenarios.

4. **Path D (operator-tunable knobs)** — Surface as `notifications.receivers.http.connect-timeout-ms` + `notifications.receivers.http.request-timeout-ms` config keys with sensible defaults (5000ms / 30000ms).

Path A is the SHIP-FAST minimum. Path C is the recommended structural fix. Path D adds operator flexibility on top.

**Severity rationale**: HIGH — single point of failure for the entire Notifications subsystem; a slow / hung Slack endpoint can stall cluster-wide alert delivery for 75-120s+ per alert; cross-references REFACTOR-130 (SMTP-side equivalent), REFACTOR-509 (WAL retention compounds the stall), REFACTOR-508 (the poison-replay loop's lighter cousin).

**Suggested backlog grouping**: `Notifications hardening sprint` (per REFACTOR-508 family).

---
