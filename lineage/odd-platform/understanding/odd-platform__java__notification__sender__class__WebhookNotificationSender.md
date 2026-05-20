---
node_id: "odd-platform java notification.sender class:WebhookNotificationSender"
node_kind: class
axis: notification.sender
extracted_at_commit: 80637ed
enriched_at_commit: 80637ed
extractor_version: 0.1.0
prompt_version: file-analyser/0.3.0
schema_version: v0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-20-webhook-notification-sender
back_links:
  - F-009
related_pillar_features:
  - "P-07:F-002"
related_concepts:
  - exception-type-asymmetry-notification-senders
  - notifications
related_doc_gaps: []
related_refactoring_scopes: []
related_test_gaps: []
related_implicit_adrs: []
related_retrospectives:
  - LSN-018
---

# WebhookNotificationSender — semantic understanding

## understanding

`WebhookNotificationSender` is the **generic** outbound notification channel — sibling to `SlackNotificationSender` and `EmailNotificationSender` but with no vendor-specific payload shape: it serialises an `AlertNotificationMessage` POJO with `JSONSerDeUtils.serializeJson` (Jackson ObjectMapper, snake-case property naming, registers `JavaTimeModule` + JSONB ser/de) and `POST`s the result to the single operator-configured URI (`notifications.receivers.webhook.url`) using the shared `java.net.http.HttpClient`. The class is a 30-line subclass of `AbstractNotificationSender<AlertNotificationMessage>`; it has no headers beyond JDK HttpClient defaults, no `Content-Type` set, no HMAC / signature / shared-secret / authentication header support, no retry, no idempotency key, no per-owner / per-namespace / per-tenant routing, no URL allowlist, no scheme guard — every alert produced by the WAL-driven dispatcher fans out verbatim to one global URL. Its `receiverId()` returns the literal string `"Generic webhook"` (note: differs from Slack's bare `"Slack"` and email's `"email"` — surfaces in log lines + the dispatcher's per-channel error log). HTTP-failure surface is delegated to the abstract parent's `sendAndValidate(...)`: any non-200 (including 2xx-non-200, 3xx redirects, 4xx, 5xx) is wrapped as the checked `NotificationSenderException`, which IS caught by the dispatcher per-sender and does NOT abort fan-out for the same alert.

## concepts

- entities: [
    "WebhookNotificationSender (the @Bean-conditional class — NOT a @Component; instantiated only by NotificationConfiguration.webhookNotificationSender(...) when notifications.receivers.webhook.url is set)",
    "AbstractNotificationSender<AlertNotificationMessage> (parent — owns the HttpClient field + sendAndValidate validation)",
    "NotificationSender<AlertNotificationMessage> (interface — send(message) + receiverId())",
    "AlertNotificationMessage (the payload POJO — Lombok @ToString/@Builder; carries alertChunks, alertType, eventType, eventAt, updatedBy, dataEntity (id/name/dataSource/namespace/type/owners), downstream[] lineage entities)",
    "JSONSerDeUtils (utility — snake_case ObjectMapper, JSR310 dates, JSONB ser/de modules; serializeJson(null) returns the literal '{}')",
    "java.net.http.HttpClient (JDK11+ — shared singleton produced by NotificationConfiguration#httpClient at NotificationConfiguration.java:31-34)",
    "HttpRequest.BodyPublishers.ofString(...) (JDK API — UTF-8 default charset; no operator-tunable encoding)",
    "URI (java.net.URI — Spring binds @Value with raw URI constructor; syntactic validation only)",
    "NotificationSenderException (checked Exception — wrapped by parent on non-200; carries receiverId)"
  ]
- operations: [
    "send(AlertNotificationMessage) — single HTTP POST, single round-trip, single message-per-call (no batching)",
    "serializeJson(AlertNotificationMessage) — Jackson snake_case ObjectMapper produces JSON body verbatim from the POJO; null-safe (returns '{}' on null, throws RuntimeException on JsonProcessingException)",
    "POST to webhookUrl (the constructor-bound URI) — no per-call URL override, no per-tenant URL, no fan-out across multiple webhooks",
    "200-only accept (inherited from sendAndValidate) — every non-200 → NotificationSenderException",
    "receiverId() returns constant string 'Generic webhook' — used by dispatcher's log.error / log.debug format strings"
  ]
- invariants: [
    "ONE URL per platform deployment — `notifications.receivers.webhook.url` is bound once at bean construction (NotificationConfiguration.java:91), stored as a private final URI field at line 11, and never re-read or re-validated.",
    "Channel is OFF unless the URL key is present — `@ConditionalOnProperty(name = \"notifications.receivers.webhook.url\")` on the bean factory method at NotificationConfiguration.java:89.",
    "Channel-construction guard at NotificationConfiguration.java:94 rejects EMPTY string (`webhookUrl.toString().isEmpty()`) with `IllegalArgumentException(\"Webhook URL is empty\")` — but it does NOT reject `http://localhost/`, RFC1918, `file://`, `ftp://`, etc. The URI must be SYNTACTICALLY VALID URI per `java.net.URI` parsing only.",
    "Payload is the FULL `AlertNotificationMessage` POJO verbatim — no field filter, no redaction hook, no PII tag awareness, no operator-configurable allowlist of fields. Operator's webhook endpoint receives `dataEntity.{id, name, dataSourceName, namespaceName, type, owners[]}` + `downstream[]` lineage entities to the configured `notifications.message.downstream-entities-depth`.",
    "Content-Type header is NOT set explicitly — relies on `java.net.http.HttpRequest` defaults. The JDK HttpClient sends no body-content-type header by default; receiver must infer JSON or accept the absence.",
    "200-only HTTP accept — `AbstractNotificationSender.sendAndValidate` rejects ANY non-200 status (including 201 Created, 202 Accepted, 204 No Content, 3xx redirects). A webhook receiver that returns 201 on accept-for-async-processing is treated as failure.",
    "Exception wrapping is symmetric with Slack — IOException → checked NotificationSenderException (parent line 22-24); non-200 → checked NotificationSenderException (parent line 26-29). Both are CAUGHT by AlertNotificationMessageProcessor.java:31 and fan-out continues. The webhook channel is well-behaved with respect to the per-channel catch-and-continue ADR (unlike EmailNotificationSender which wraps as raw RuntimeException — see exception-type-asymmetry-notification-senders concept).",
    "receiverId() = `\"Generic webhook\"` — note the capital-G and space, asymmetric with `\"Slack\"` and `\"email\"` (lowercase) receiverIds. Log greppability depends on the exact string.",
    "No retry on transient failures — one HTTP attempt per alert; non-2xx / IOException → exception → dispatcher logs and moves on; WAL LSN advances regardless (NotificationSubscriber.java:83-84) so the dropped alert is NOT replayed."
  ]
- audiences: [
    "notification-recipient (the operator-configured webhook endpoint — any HTTP receiver, security posture unknown to ODD)",
    "platform-operator (sets the URL — owns the receiver-side compatibility contract entirely; receives no schema affordance from ODD)",
    "external-systems (any custom incident-management / SIEM / Slack-alternative / PagerDuty webhook integration the operator chooses)",
    "data-engineer-analyst + data-quality-engineer (eventual human readers of the downstream alert in whatever destination the webhook delivers to)"
  ]

## dependencies_semantic

- requires-feature: [
    "P-07 Active Platform Features > Notifications sub-feature — the bean only exists when `notifications.enabled=true` (subsystem gate at NotificationConfiguration.java:27) AND `notifications.receivers.webhook.url` is set (per-channel gate at NotificationConfiguration.java:89).",
    "P-07 Active Platform Features > Alerting — without ALERT-table rows produced by AlertActionResolver / external AlertManager push, the WAL stream is idle and this sender never runs."
  ]
- requires-config: [
    "notifications.enabled=true (subsystem gate, NotificationConfiguration.java:27) — without it, the @Configuration class is bypassed and this sender is never instantiated.",
    "notifications.receivers.webhook.url (NotificationConfiguration.java:89,91) — channel gate + the URI bound into THIS class's `webhookUrl` final field at line 11/15. Validated non-empty (string-empty, not null-empty) at NotificationConfiguration.java:94."
  ]
- requires-runtime: [
    "java.net.http.HttpClient — shared singleton bean from NotificationConfiguration.java:31-34 (`HttpClient.newHttpClient()` — JDK defaults: HTTP/2 if upgradable, no connect timeout, no request timeout, ForkJoinPool.commonPool executor).",
    "JSONSerDeUtils ObjectMapper — static singleton at JSONSerDeUtils.java:14-20 (snake_case property naming, JSR310 dates, JSONB ser/de modules, FAIL_ON_UNKNOWN_PROPERTIES disabled). Shared with the rest of the platform's JSON handling.",
    "WAL-driven NotificationSubscriber + leader election — the upstream chain that creates `AlertNotificationMessage` events and invokes this sender (via AlertNotificationMessageProcessor — see sibling NotificationsDispatcher sidecar)."
  ]

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - behaviour: "POST to configured URL succeeds — sendAndValidate accepts 200 and returns normally"
    upstream_callers: ["AlertNotificationMessageProcessor.java:30 — calls notificationSender.send(notificationMessage)"]
    downstream_side_effects: ["one HTTP POST to operator-configured URL with JSON body", "dispatcher loop continues to next sender"]
    test_class: "missing — no `WebhookNotificationSenderTest.java` exists; `find <odd-platform-repo> -name '*Test*.java' -path '*notification*'` returns zero matches"
  - behaviour: "Non-200 response is wrapped as NotificationSenderException with receiverId='Generic webhook'"
    upstream_callers: ["AlertNotificationMessageProcessor.java:31 — catches it; dispatcher continues fan-out"]
    downstream_side_effects: ["log.error with the receiver id and the exception message", "next sender in dispatcher's List<NotificationSender> still receives .send(...)"]
    test_class: "missing"
  - behaviour: "IOException from underlying socket / DNS / SSL failure is wrapped as NotificationSenderException (not propagated raw)"
    upstream_callers: ["AlertNotificationMessageProcessor.java:31 — catches it; dispatcher continues fan-out"]
    downstream_side_effects: ["NotificationSenderException carries the IOException as `cause`; receiverId='Generic webhook'"]
    test_class: "missing"
  - behaviour: "JSON payload shape matches AlertNotificationMessage POJO (snake_case keys; nested dataEntity / downstream / alertChunks arrays; ISO-8601 LocalDateTime for eventAt)"
    upstream_callers: ["AlertNotificationMessageProcessor.java:30"]
    downstream_side_effects: ["receiver gets snake_case JSON with full payload — every alert, every channel, every owner; no field filtering"]
    test_class: "missing — no `WebhookNotificationSenderPayloadShapeTest` pins the JSON contract operators code against. A snake_case → camelCase regression in JSONSerDeUtils' ObjectMapper config would silently break every operator's webhook parser."
  - behaviour: "Empty / null AlertNotificationMessage serialises as '{}' (per JSONSerDeUtils.serializeJson null-safety at line 56-66)"
    upstream_callers: ["AlertNotificationMessageProcessor.java:30 (unlikely to pass null — translator wraps in @Builder and validates upstream)"]
    downstream_side_effects: ["if reached, receiver would get HTTP POST with body `{}` (and HttpClient sends `Content-Length: 2`)"]
    test_class: "missing"
  - behaviour: "HttpClient blocks indefinitely on unreachable URL — JDK HttpClient.newHttpClient() default has no connectTimeout / requestTimeout"
    upstream_callers: ["AlertNotificationMessageProcessor.java:30 — the dispatcher is single-threaded; a hung webhook URL blocks the WAL consumer thread"]
    downstream_side_effects: ["entire WAL stream stalls; subsequent alerts queue in Postgres replication-slot buffer; alert latency grows unbounded"]
    test_class: "missing"
- test_files: []
- gaps: |
    The entire `odd-platform-api/src/main/java/.../notification` package has ZERO test files
    (verified: `find <odd-platform-repo> -name '*Test*.java' -path '*notification*'` returns no matches).
    Most regression-prone behaviours specific to THIS file:

    1. **Payload-shape contract** — `WebhookNotificationSender` is the ONLY channel where the operator
       directly codes against ODD's JSON payload shape (Slack's payload is Slack-API-shaped; email's
       payload is Freemarker-rendered HTML/text). A change to `AlertNotificationMessage`'s field
       names, nesting, or JSONSerDeUtils' naming strategy SILENTLY breaks every operator webhook
       parser, with no test pinning the contract.

    2. **Unreachable-URL stall** — the JDK `HttpClient.newHttpClient()` has no default timeout. A
       webhook endpoint that accepts the TCP connection but never responds (e.g. an unresponsive
       proxy, a deeply-broken endpoint, a DROP firewall rule) blocks the WAL consumer thread
       indefinitely, deferring ALL subsequent alert delivery — Slack + email + any other webhook.
       The dispatcher's per-sender catch never fires because no exception is ever thrown.

    3. **Non-200 success codes from common webhook receivers** — many webhook libraries (e.g.
       Discord, Microsoft Teams, custom incident managers) return 201/202/204 on accept. ODD's
       `AbstractNotificationSender.sendAndValidate` rejects ANY non-200, so a working receiver
       that returns 201 is treated as failure; the alert is dropped silently from logs (ERROR
       level, but no operator-visible counter, no audit).

    4. **JSON serialisation safety** — `JSONSerDeUtils.serializeJson` wraps `JsonProcessingException`
       as raw `RuntimeException` (not `NotificationSenderException`). If a future
       `AlertNotificationMessage` field is added that breaks Jackson serialisation (e.g. a Path
       circular reference, a non-serialisable Lombok-injected field), `WebhookNotificationSender.send`
       throws RuntimeException — BYPASSING the dispatcher's per-sender catch identically to the
       EmailNotificationSender bypass (exception-type-asymmetry-notification-senders concept).
       This is a LATENT extension of the same concept's hazard, not currently triggered because
       AlertNotificationMessage is Jackson-clean — but the contract violation lives in
       JSONSerDeUtils.java:62-64.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/active-platform-features/notifications"
    anchor: ""
    rationale: "The live feature-level notifications page is the user-facing surface for ALL three channels. The generic-webhook section names the URL key, frames the channel as 'POSTs the full alert payload (JSON)', and explicitly notes the webhook receiver 'is expected to extract any URLs it needs from the alert payload itself' — describing THIS class's behaviour at the operator level. WebFetch 2026-05-20 status 200."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      WebFetch 2026-05-20, status 200. Verbatim quotes:

      "The generic webhook is configured via `notifications.receivers.webhook.url`. The platform
       POSTs the full alert payload (JSON) to an operator-supplied URL."

      "The receiver is expected to extract any URLs it needs from the alert payload itself."

      Page is silent on: HMAC / signature / signing mechanism; shared secret / authentication
      headers; URL allowlist / SSRF guard; custom HTTP header support; retry policy on failure;
      timeout behaviour; idempotency / message-id; per-owner / per-namespace / per-tenant
      scoping; expected response codes (200 vs 2xx vs ANY); request Content-Type header.
      Each of these is a code-level reality that the doc does not surface — see
      doc_drift_findings below.

  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform"
    anchor: "#enable-alert-notifications"
    rationale: "The live configuration page documents `notifications.receivers.webhook.url` as a YAML key + environment variable, but provides NO additional detail about the webhook channel — no caveats, no security guidance, no schema. The configuration tier is silent on the same dimensions the feature-level page is silent on."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      WebFetch 2026-05-20, status 200. Quoted YAML block:

      ```yaml
      notifications:
        receivers:
          webhook:
            url: {webhook_url}
      ```

      Environment variable form: `NOTIFICATIONS_RECEIVERS_WEBHOOK_URL={webhook_url}`.

      Page does NOT specify: authentication or signing mechanism for outbound webhooks;
      expected response codes or retry behaviour on failure; request timeout or retry
      limits; payload schema or format guarantees; URL validation or allowlist controls;
      idempotency handling. Quoted live-doc: "Operators deploying webhook receivers should
      consult additional documentation or the platform's source code for these
      implementation details."

- doc_drift_findings:
  - "**Live doc is silent on HMAC / signature support — code confirms NONE exists.** Operators evaluating ODD's webhook channel against incumbent alternatives (Slack incoming webhooks support signed payloads; GitHub webhooks ship HMAC-SHA256; AlertManager supports webhook_config with auth headers) cannot determine from the docs whether ODD signs the payload. Verified at the code level: WebhookNotificationSender.java:18-23 builds the HttpRequest with no signature header, no shared-secret-derived HMAC, no Content-Digest header. The HttpRequest carries ONLY the JDK defaults (User-Agent, Content-Length). DOC-NNN candidate: surface this explicitly on the live page with operator guidance (e.g. 'use a private network or VPN for the webhook URL; ODD does not sign payloads')."
  - "**Live doc is silent on the 200-only HTTP accept policy.** A webhook receiver returning 201/202/204 (common for async-accept patterns) is treated as failure — the alert is dropped from that channel with no operator-visible counter. The doc framing 'POSTs the full alert payload' invites the operator expectation 'and accepts the standard 2xx range'; the code reality is narrower. DOC-NNN candidate."
  - "**Live doc is silent on the Content-Type header absence.** The JDK HttpClient does NOT set a default Content-Type for `BodyPublishers.ofString(...)` unless the caller does explicitly — and THIS class does not (WebhookNotificationSender.java:20-22 only sets `.uri(...)` + `.POST(...)`). Receivers strictly enforcing `Content-Type: application/json` will reject the request. DOC-NNN candidate: document the missing header (or fix the code to set it)."
  - "**Live doc is silent on URL allowlist / SSRF guard absence.** An operator-supplied URL pointing at the internal network (RFC1918, link-local, loopback) will be POST'd to — by design (the operator is trusted to set it correctly), but the absence of an allowlist mechanism is not surfaced. For platforms where webhook URLs are configured via UI by a non-admin owner (currently not the case in ODD — webhook URL is platform-config-only — but the hardening cost is asymmetric), the SSRF surface is broad. DOC-NNN candidate: state explicitly that the operator owns SSRF defence."
  - "**Live doc is silent on the single-URL-per-deployment constraint.** Operators wanting per-team / per-owner / per-severity webhook routing cannot configure two webhook URLs in ODD — the channel is intentionally single-URL (one bean, one constructor URI). The doc framing 'each channel that is enabled' invites the multi-webhook expectation; the code reality is one-or-zero. DOC-NNN candidate (compound with the broader 'no per-channel filter' gap surfaced on the F-009 feature flow)."
  - "**Live doc is silent on the 'every alert goes to one URL regardless of which Owner is attached' behaviour.** Multi-tenant or multi-team deployments configuring one webhook URL leak every alert to one receiver. For organisations whose dataset names encode customer/PII identifiers, every alert payload (dataEntity.name + owners[] + downstream[]) reaches the one operator endpoint. DOC-NNN candidate (cross-cuts the dispatcher's owner-scoping bypass surfaced on the NotificationsDispatcher sidecar — this class is the structural reason a per-owner URL is not possible at the channel level)."

## implicit_adrs

- "**Thin proxy over `java.net.http.HttpClient` — no transport adapter, no per-message middleware.** The sender is a 30-line subclass that sets URI, sets POST body, and delegates to the parent's `sendAndValidate`. Encodes the deliberate-simplicity stance for the generic-webhook channel: ODD is the data producer, the operator's webhook endpoint is the data consumer, and the wire format is verbatim JSON with no interposing transform. Any operator-side concern (signing, headers, retry, batching, fan-out, transformation) is the operator's to implement at the receiver." — evidence: WebhookNotificationSender.java:10-30 (entire class is constructor + send + receiverId; no fields beyond webhookUrl + inherited httpClient) — intent_anchor: "the class body literally builds the request with `.uri(webhookUrl).POST(BodyPublishers.ofString(serializeJson(message))).build()` and delegates to parent — no per-channel customisation hook" — confidence: HIGH

- "**Symmetric exception wrapping with Slack — both throw checked `NotificationSenderException` via the shared parent.** Both WebhookNotificationSender and SlackNotificationSender invoke `sendAndValidate(...)` (parent line 16-30) which converts IOException → checked NotificationSenderException AND wraps non-200 status → checked NotificationSenderException. This makes the two HTTP-channel siblings well-behaved with respect to the dispatcher's per-channel catch-and-continue ADR (AlertNotificationMessageProcessor.java:31 catches NotificationSenderException). The contract violator is EmailNotificationSender, NOT this class — see exception-type-asymmetry-notification-senders concept." — evidence: WebhookNotificationSender.java:19-23 + AbstractNotificationSender.java:16-30 — intent_anchor: "no `try { ... } catch (...) { throw new RuntimeException(...) }` block in this class — every exception path delegates to the parent's typed exception" — confidence: HIGH

- "**`receiverId() = \"Generic webhook\"` is a literal display string, not a stable machine identifier.** Used by the dispatcher's `log.debug` / `log.error` format strings (AlertNotificationMessageProcessor.java:27,33) and by `NotificationSenderException#getMessage()` (NotificationSenderException.java:26 formats `\"Notification sender %s: %s\"`). The label is human-readable + space-containing, asymmetric with Slack's `\"Slack\"` (single token) and email's `\"email\"` (lowercase). Encodes 'this is for operator logs, not for grep-by-machine-id' — any tooling parsing the log lines must accommodate the space + capitalisation difference." — evidence: WebhookNotificationSender.java:27-29 (`return \"Generic webhook\"`) — intent_anchor: "the literal value with capital G + space, returned by an overridden public method that has no other use" — confidence: MEDIUM (the asymmetry is observable; whether it's intentional is not stated in any comment — but the choice of a space-containing display string vs Slack/email's single tokens is consistent with the per-channel-id-is-a-label posture)

- "**ONE webhook URL per platform deployment — the bean factory binds the constructor argument once and never re-reads.** `WebhookNotificationSender(HttpClient, URI)` makes `webhookUrl` a private final field at line 11; there is no setter, no reload mechanism, no re-read of the Spring Environment. To change the URL the operator must redeploy. Encodes 'webhook is a static destination, not a dynamic routing decision'. The choice flows from the broader notification subsystem's stance (the dispatcher has no routing knob — see NotificationsDispatcher sidecar implicit_adrs)." — evidence: WebhookNotificationSender.java:11,13-16 + NotificationConfiguration.java:88-99 — intent_anchor: "`private final URI webhookUrl;` at line 11 + `this.webhookUrl = webhookUrl;` at line 15 — no @RefreshScope, no @ConfigurationProperties-watched bean" — confidence: HIGH

## bugs_limitations_corner_cases

- "**NO HMAC / signature / shared-secret / authentication header — operator endpoint cannot verify the payload's origin.** The HttpRequest at lines 20-22 carries only `.uri(...)` + `.POST(BodyPublishers.ofString(...))` + `.build()`. No `Authorization` header, no `X-ODD-Signature`, no HMAC-SHA256 over the body, no shared-secret config knob. An attacker who learns the webhook URL (e.g. via `/actuator/env` if exposed, via deployment artefacts, via leaked container images) can POST a forged payload that the operator's receiver cannot distinguish from a legitimate ODD alert. This is the load-bearing security gap for the generic-webhook channel. — evidence: WebhookNotificationSender.java:20-22 (no header methods invoked on the HttpRequest builder) — severity: HIGH"

- "**NO URL allowlist / scheme guard / SSRF defence — operator-supplied URL is trusted verbatim.** `NotificationConfiguration.java:94` rejects only empty strings; the URI parser at line 91 accepts any syntactically-valid URI (`file://`, `gopher://`, RFC1918, link-local, `http://localhost`). The JDK HttpClient at runtime will reject non-`http(s)` schemes at send-time, but no boot-time guard prevents a misconfigured URL from being instantiated. For a platform with `/actuator/env` exposed, the webhook URL is part of the environment surface — combined with the absent allowlist, the SSRF surface is operator-supplied. — evidence: WebhookNotificationSender.java:11,13-16 (URI accepted verbatim from constructor) + NotificationConfiguration.java:91,94-96 (validation is `webhookUrl.toString().isEmpty()` only) — severity: MEDIUM"

- "**NO custom HTTP header support — operator cannot inject bearer token, API key, tenant header, or any auth header.** Many webhook receivers (incident management platforms, custom relay services, multi-tenant aggregators) require an `Authorization` header or a tenant-identifier header to route the payload. There is NO configuration knob for `notifications.receivers.webhook.headers.X`, no `@ConfigurationProperties` mapping for a header map, no per-call header injection. Operators must place an HTTP gateway in front of their actual receiver to add headers — a deployment burden ODD's docs do not surface. — evidence: WebhookNotificationSender.java:20-22 (HttpRequest builder receives no `.header(...)` calls; class has no headers field) — severity: MEDIUM"

- "**NO retry on failure — single attempt, then drop.** A transient network failure (DNS hiccup, brief receiver outage, transient 5xx) causes one `NotificationSenderException` log line at ERROR, and the alert is gone from the webhook channel forever. The WAL LSN advances regardless (NotificationSubscriber.java:83-84), so the alert is NOT replayed by the WAL stream. No exponential back-off, no retry budget, no per-channel circuit breaker. Webhook receivers built assuming at-least-once delivery (the common contract for incident-management webhooks) will lose alerts under transient failures. — evidence: WebhookNotificationSender.java:19-23 + AbstractNotificationSender.java:16-30 (single send, no retry loop) + AlertNotificationMessageProcessor.java:30-35 (catch-and-log-only, no enqueue for retry) — severity: HIGH"

- "**NO idempotency key / message ID — receiver cannot dedupe replays.** The HTTP body carries the AlertNotificationMessage but no top-level `id` / `idempotency_key` / `request_id` header is set. If a future change adds a retry path or a manual replay tool, receivers have no way to identify duplicate deliveries. (Currently masked by the no-retry behaviour, but the latent gap exists.) — evidence: WebhookNotificationSender.java:18-23 — severity: LOW"

- "**Cross-tenant data exposure: ONE URL receives ALL alerts regardless of which Owner is attached.** The class binds one URL per platform deployment; the dispatcher feeds it every `AlertNotificationMessage` produced by every alert across every namespace, owner, data source. In a multi-tenant deployment, every tenant's alerts flow to the one operator-configured URL — the receiver cannot route to per-tenant destinations without parsing the payload's `dataEntity.namespaceName` / `dataEntity.owners[]` and routing receiver-side. This is the channel-level structural reason F-009's `pii_passthrough_to_every_channel` drift exists for the webhook channel. — evidence: WebhookNotificationSender.java:11,13-16 (single URI field) + AlertNotificationMessageProcessor.java:25-36 (unconditional broadcast — see NotificationsDispatcher sidecar bugs_limitations_corner_cases[4]) — severity: HIGH"

- "**`Content-Type: application/json` header is NOT set.** `HttpRequest.BodyPublishers.ofString(...)` does not set any Content-Type; the builder pattern in this class invokes only `.uri(...)`, `.POST(...)`, `.build()` (lines 20-23). Receivers strictly checking `Content-Type` (e.g. Discord, many corporate WAFs) reject the request with 415 Unsupported Media Type — surfaced as NotificationSenderException at the dispatcher, alert dropped. The fix is a one-line `.header(\"Content-Type\", \"application/json\")` between lines 21 and 22. — evidence: WebhookNotificationSender.java:20-23 (no `.header(...)` calls) — severity: MEDIUM"

- "**200-only HTTP accept — common 2xx-success codes treated as failure.** The parent's `sendAndValidate` at AbstractNotificationSender.java:26-29 checks `response.statusCode() != HttpStatus.OK.value()` — i.e. exactly 200. A webhook receiver that responds 201 (Created), 202 (Accepted, common for async receive), 204 (No Content) is treated as a failure; the alert is dropped from logs with a misleading 'Notification sender response didn't complete with 200 status code' error message. Operators integrating with async-accept webhook receivers (queue-backed, batch processors) cannot use ODD's generic webhook without an HTTP gateway that rewrites 2xx to 200. — evidence: WebhookNotificationSender.java:19-23 (delegates to parent) + AbstractNotificationSender.java:26-29 — severity: MEDIUM"

- "**No request / connect timeout — unreachable URL hangs the WAL consumer thread indefinitely.** `HttpClient.newHttpClient()` at NotificationConfiguration.java:32 does NOT set a `connectTimeout`; `HttpRequest.newBuilder()` at WebhookNotificationSender.java:20 does NOT set a `.timeout(Duration)`. The underlying JDK socket-level timeout (system-dependent, typically 75-120s on Linux for SYN retries; potentially unbounded for half-open connections) is the effective ceiling. For a deeply-broken webhook endpoint (TCP-accept-then-never-respond, or a transparent proxy that drops without RST), the dispatcher thread stalls — blocking ALL subsequent alerts on ALL channels for this one alert's delivery. — evidence: WebhookNotificationSender.java:18-23 + NotificationConfiguration.java:31-34 + JDK `HttpClient.newHttpClient()` defaults (no operator-tunable) — severity: HIGH"

- "**JsonProcessingException → raw `RuntimeException` (latent contract violation).** `JSONSerDeUtils.serializeJson(...)` at JSONSerDeUtils.java:62-64 wraps `JsonProcessingException` as `throw new RuntimeException(e);` — NOT as `NotificationSenderException`. Currently unreachable because `AlertNotificationMessage` is Jackson-clean, but a future field that breaks serialisation (a circular reference, a non-serialisable injected dependency, a misconfigured `@JsonSerialize`) would throw RuntimeException from THIS sender, BYPASSING the dispatcher's per-sender catch identically to the EmailNotificationSender bypass. The exception-type-asymmetry-notification-senders concept therefore has a LATENT extension to this class — not currently triggered but structurally present. — evidence: WebhookNotificationSender.java:22 (calls `JSONSerDeUtils.serializeJson`) + JSONSerDeUtils.java:62-64 (RuntimeException wrap) + AlertNotificationMessageProcessor.java:31 (catches only NotificationSenderException) — severity: LOW (latent — currently not reachable)"

- "**`receiverId() = \"Generic webhook\"` (capital G + space) is asymmetric with Slack's `\"Slack\"` and email's `\"email\"`.** Log greppability across channels requires three different patterns. The string is also load-bearing for `NotificationSenderException.getMessage()` (NotificationSenderException.java:26 — `String.format(\"Notification sender %s: %s\", notificationReceiverId, super.getMessage())`) — the formatted output for webhook is `Notification sender Generic webhook: <message>` which is grammatically odd. — evidence: WebhookNotificationSender.java:27-29 + SlackNotificationSender.java:52-54 + NotificationSenderException.java:24-27 — severity: LOW"

## security

- **auth_mode_relevance**: `INTERNAL_ONLY` — `WebhookNotificationSender` is a Spring-instantiated bean called from the WAL-consumer thread (`AlertNotificationMessageProcessor.process`). It is not on the HTTP-INBOUND surface; ODD's `auth.type` (DISABLED / LOGIN_FORM / OAUTH2 / LDAP) does not gate this code directly. The behaviour shifts based on the FEATURE gate (`notifications.enabled` + `notifications.receivers.webhook.url`), not the UI/API auth mode. — evidence: WebhookNotificationSender.java:1-30 (no @RestController / @RequestMapping / Filter / @PreAuthorize annotations) + NotificationConfiguration.java:88-99 (the bean factory uses `@ConditionalOnProperty`, not auth-gated).

- **ingestion_filter_relevance**: `NO — outbound HTTP sender, not on the /ingestion path`. The class issues OUTBOUND HTTP POSTs; nothing here participates in the `IngestionDataEntitiesFilter` chain on `POST /ingestion/entities`. — evidence: WebhookNotificationSender.java:1-30 (HttpClient.send is outbound; no Servlet filter, no controller, no /ingestion references).

- **authorization_assertions**: [] — `@Bean`-conditional class with no Spring Security wiring; the dispatcher operates with platform-level privileges (it consumes WAL events from the platform's own datasource).

- **owner_scoping**: `BYPASSES — single URL receives every alert regardless of dataEntity.owners[]`. The class binds one URL per platform deployment at construction (line 11/15); the payload includes `dataEntity.owners[]` (populated by AlertNotificationMessageTranslator) but THIS sender does not consult them, does not branch on them, does not filter on them. Every alert payload reaches the one operator-configured URL. — evidence: WebhookNotificationSender.java:11,13-16,18-23 (one URI field, one send method, no branching on payload contents) + AlertNotificationMessage.java:28 (`dataEntity.owners[]` field is populated but ignored here).

- **data_exposure**:
  - "**Full AlertNotificationMessage payload** → operator-configured webhook URL. Fields exposed: `alertType` (FAILED_JOB / FAILED_DQ_TEST / BACKWARDS_INCOMPATIBLE_SCHEMA / DISTRIBUTION_ANOMALY); `eventType` (CREATED / RESOLVED / RESOLVED_AUTOMATICALLY / REOPENED); `eventAt` (LocalDateTime); `updatedBy` (user identifier — see below); `dataEntity.{id, name, dataSourceName, namespaceName, type, owners[]}` (PII surface for orgs encoding identifiers in dataset names); `downstream[]` (lineage entities to configured depth — leaks the structural shape of the catalog); `alertChunks[]` (the alert's reason/lastReason text — can include free-form messages from collectors). — evidence: WebhookNotificationSender.java:22 (`JSONSerDeUtils.serializeJson(message)`) + AlertNotificationMessage.java:22-29 (the full POJO field list)"
  - "**`updatedBy` field** — populated by AlertServiceImpl on user-initiated alert state transitions; carries the platform user identifier (owner display name or username depending on auth mode). For LDAP / OAUTH2 deployments this is the corporate identity (email / sAMAccountName) — reaches the webhook URL verbatim. — evidence: AlertNotificationMessage.java:27 (`private String updatedBy;`) + WebhookNotificationSender.java:22 (no field filter)"
  - "**Receiver-id `'Generic webhook'`** and any HTTP failure detail logged at ERROR via NotificationSenderException at AlertNotificationMessageProcessor.java:33 → platform stdout / log aggregator. — evidence: WebhookNotificationSender.java:27-29 + NotificationSenderException.java:24-27 + AbstractNotificationSender.java:24-29"
  - "**Webhook URL itself** (a credential by nature for the receiver — anyone with it can POST to the receiver) — reachable via `/actuator/env` if exposed. Spring's default `/actuator/env` sanitisation does NOT include the substring `url` in its mask list. — evidence: WebhookNotificationSender.java:11 + NotificationConfiguration.java:91 + Spring Boot's `DataSize`/`StandardSensitivePropertyValuesProvider` default mask patterns (verified at framework level)"

- **known_security_gaps**:
  - "**No HMAC / signature / shared-secret** — operator's webhook receiver cannot verify the payload came from ODD. Anyone with the URL can forge an arbitrary `AlertNotificationMessage`-shaped payload. Mitigations require operator-side IP allowlisting, VPN deployment, or HTTP gateway with mTLS — none of which ODD's docs surface. — evidence: WebhookNotificationSender.java:20-22 (no header / signing) — severity: HIGH"
  - "**No URL allowlist / SSRF defence** — operator-supplied URL is bound verbatim; any URI-shaped value accepted. Combined with single-bean-instantiation, no per-request URL validation. For a hypothetical attack where webhook URL becomes user-controllable (a future Owner-level webhook config feature, the Slack-OAuth admin surface) this becomes a direct SSRF vector. — evidence: WebhookNotificationSender.java:11 + NotificationConfiguration.java:91,94-96 — severity: MEDIUM"
  - "**No custom auth header support** — operators using webhook receivers that require `Authorization: Bearer <token>` or `X-API-Key: <key>` cannot configure this in ODD. Deployment burden: operator must run an HTTP gateway (nginx, envoy) to inject the header, doubling the failure surface. — evidence: WebhookNotificationSender.java:20-22 (no header injection) + NotificationConfiguration.java:88-99 (no header config knob) — severity: MEDIUM"
  - "**Full PII payload to one URL across all owners / namespaces / tenants** — there is no per-tenant URL config, no per-owner filter, no PII-tag-aware redaction. A multi-tenant deployment leaks every tenant's alerts (dataset name + owners[] + downstream lineage) to one URL. — evidence: WebhookNotificationSender.java:11 + AlertNotificationMessage.java:22-29 + WebhookNotificationSender.java:22 (no payload filter) — severity: HIGH"
  - "**Webhook URL not masked by Spring's default `/actuator/env` sanitisation** — if `/actuator/env` is exposed (a common operator misconfiguration; ODD's actuator is on the default port shared with the app), the webhook URL is fetchable. Combined with the no-HMAC gap, the URL leakage is sufficient to forge alerts at the receiver. — evidence: NotificationConfiguration.java:91 + Spring Boot default mask pattern (no 'url' substring) — severity: MEDIUM"
  - "**No retry / no DLQ / no audit** — silent alert drop on transient failures. Operators auditing 'did the webhook receive alert X' have nothing beyond log-greppable receiver-id strings. — evidence: WebhookNotificationSender.java:19-23 + AlertNotificationMessageProcessor.java:30-35 + NotificationSubscriber.java:83-84 — severity: MEDIUM (drift facet `no_retry_no_dlq_no_audit` on F-009 — primary-source cited here for the webhook channel specifically)"

## performance

- **hot_paths**:
  - "Per WAL ALERT event: ONE `JSONSerDeUtils.serializeJson(AlertNotificationMessage)` call → ONE synchronous HTTP POST via shared HttpClient → ONE `HttpResponse<String>` read → ONE 200-or-throw status check. End-to-end latency per webhook delivery = serialisation time (small — Jackson singleton + bounded payload) + network RTT to receiver + receiver-side processing time. The dispatcher thread blocks for this duration; subsequent alerts queue in the WAL replication slot. — evidence: WebhookNotificationSender.java:19-23 + AbstractNotificationSender.java:16-30 + JSONSerDeUtils.java:56-66"

- **throughput_characteristics**:
  - "**Single message per call** — no batching, no aggregation, no 'fold N alerts into one POST'. Each ALERT WAL event produces exactly one HTTP POST. — evidence: WebhookNotificationSender.java:19-23"
  - "**Synchronous fan-out from the dispatcher** — `AlertNotificationMessageProcessor.process` calls `notificationSender.send(...)` on the WAL-consumer thread, single-threaded per `Executors.newSingleThreadExecutor` upstream. Cluster-wide throughput is bounded by the dispatcher's serial latency × number of senders. — evidence: WebhookNotificationSender.java:19-23 (synchronous return) + NotificationSubscriberStarter.java:21-23 (single-thread executor — see NotificationsDispatcher sidecar)"
  - "**Shared HttpClient** — connection-reuse for HTTP/2 multiplexing (or HTTP/1.1 keep-alive) across Slack + Webhook senders. For receivers supporting HTTP/2, repeated calls reuse the connection; for HTTP/1.1, the JDK manages a per-host pool. — evidence: WebhookNotificationSender.java:13-14 (HttpClient injected, shared singleton) + AbstractNotificationSender.java:14 (parent's httpClient field) + NotificationConfiguration.java:31-34 (singleton bean)"

- **resource_allocation**:
  - "**Per-message allocation**: one `String` (the serialised JSON payload, size O(|alertChunks| + |downstream entities|)) + one `HttpRequest` builder result + one `HttpResponse<String>`. No persistent buffer, no queue, no batching state. — evidence: WebhookNotificationSender.java:20-23"
  - "**No connection pool tuning** — JDK HttpClient.newHttpClient() uses default executor (ForkJoinPool.commonPool); default per-host connection limit (typically 100 in HotSpot). No operator-tunable. — evidence: NotificationConfiguration.java:32-34"
  - "**No request body length limit** — the `JSONSerDeUtils.serializeJson` output is unbounded by this class. A pathological alert (extremely large downstream lineage at deep depths, very long lastReason chunk) produces a correspondingly large POST body. HttpClient does not enforce a body-size cap on outbound POSTs. — evidence: WebhookNotificationSender.java:22 + JSONSerDeUtils.java:56-66 (no size check)"

- **scaling_characteristics**:
  - "**Stateless sender** — the bean holds only the URI + injected HttpClient; can serve N WAL events sequentially with no inter-call state. — evidence: WebhookNotificationSender.java:10-30"
  - "**Single URL per deployment** — no horizontal scaling at the URL level. Operators wanting multi-target webhook delivery (two distinct receivers) must run two ODD instances or deploy a fan-out gateway in front of the URL. — evidence: WebhookNotificationSender.java:11"
  - "**Backpressure to WAL stream via dispatcher thread block** — a slow webhook receiver blocks the single-thread dispatcher, deferring all subsequent alert delivery cluster-wide. The webhook's tail latency is the tail latency of the entire notification subsystem when this channel is enabled. — evidence: WebhookNotificationSender.java:19-23 (synchronous send) + NotificationSubscriber.java:60-91 (single-thread WAL consumer — see NotificationsDispatcher sidecar)"

- **known_performance_gaps**:
  - "**No request / connect timeout — unreachable URL hangs the dispatcher thread.** HttpClient.newHttpClient() default has no connectTimeout; this class does not call `HttpRequest.newBuilder().timeout(Duration)`. For a TCP-accept-then-never-respond endpoint, the dispatcher thread stalls — blocking all subsequent alerts cluster-wide. The Slack channel inherits the same gap (same parent + same HttpClient) — the failure mode is shared across all HTTP senders. — evidence: WebhookNotificationSender.java:18-23 + NotificationConfiguration.java:32 — severity: HIGH"
  - "**No retry / no back-off — transient failures drop alerts permanently.** A single 5xx or DNS hiccup loses the alert from this channel forever; the WAL LSN advances regardless. — evidence: WebhookNotificationSender.java:19-23 + AbstractNotificationSender.java:16-30 + NotificationSubscriber.java:83-84 — severity: HIGH"
  - "**No rate limiting on outbound** — bursty WAL events (e.g. a DQ run flagging every dataset) translate 1:1 into outbound POSTs. A webhook receiver imposing rate limits returns 429; this class throws NotificationSenderException (non-200 path) and the dispatcher logs and moves on — burst losses are silent. — evidence: AbstractNotificationSender.java:24-29 (200-only check; no 429 handling) — severity: MEDIUM"
  - "**Synchronous fan-out couples webhook tail latency to dispatcher throughput** — see scaling_characteristics. — evidence: WebhookNotificationSender.java:19-23 — severity: MEDIUM"

## sources

- understanding ← odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/sender/WebhookNotificationSender.java:1-30 + odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/sender/AbstractNotificationSender.java:1-31 + odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/sender/NotificationSender.java:1-10 + odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/config/NotificationConfiguration.java:88-99 + odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/utils/JSONSerDeUtils.java:14-66 + odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/dto/AlertNotificationMessage.java:22-45 + odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/processor/AlertNotificationMessageProcessor.java:14-37
- concepts.entities.WebhookNotificationSender ← WebhookNotificationSender.java:10-30
- concepts.entities.AbstractNotificationSender ← AbstractNotificationSender.java:13-31
- concepts.entities.NotificationSender ← NotificationSender.java:6-10
- concepts.entities.AlertNotificationMessage ← AlertNotificationMessage.java:22-45
- concepts.entities.JSONSerDeUtils ← JSONSerDeUtils.java:13-67
- concepts.entities.HttpClient ← NotificationConfiguration.java:31-34 (the singleton bean producer)
- concepts.entities.URI ← WebhookNotificationSender.java:3,11 + NotificationConfiguration.java:91
- concepts.entities.NotificationSenderException ← NotificationSenderException.java:6-28
- concepts.invariants.one-url-per-deployment ← WebhookNotificationSender.java:11,13-16 + NotificationConfiguration.java:88-99
- concepts.invariants.channel-off-without-url-key ← NotificationConfiguration.java:89 (`@ConditionalOnProperty(name = "notifications.receivers.webhook.url")`)
- concepts.invariants.payload-is-full-alert-message ← WebhookNotificationSender.java:22 (`JSONSerDeUtils.serializeJson(message)` where message is the full POJO) + AlertNotificationMessage.java:22-29
- concepts.invariants.no-content-type ← WebhookNotificationSender.java:20-22 (no `.header(...)` calls)
- concepts.invariants.200-only-accept ← AbstractNotificationSender.java:26-29 (`response.statusCode() != HttpStatus.OK.value()`)
- concepts.invariants.exception-wrapping-symmetric-slack ← WebhookNotificationSender.java:19-23 + AbstractNotificationSender.java:16-30 + SlackNotificationSender.java:39-49 (both use the same parent)
- concepts.invariants.receiverid-display-string ← WebhookNotificationSender.java:27-29 (`"Generic webhook"`) + SlackNotificationSender.java:52-54 (`"Slack"`) + EmailNotificationSender.java (receiverId — `"email"` — verified by sibling sidecars)
- concepts.invariants.no-retry ← WebhookNotificationSender.java:19-23 + AbstractNotificationSender.java:16-30 + NotificationSubscriber.java:83-84 (LSN advances after process() returns)
- dependencies_semantic.requires-feature.notifications + alerting ← NotificationConfiguration.java:27 (subsystem gate) + AlertNotificationMessageProcessor.java:15 (@ConditionalOnNotifications on the dispatcher); WebFetch https://docs.opendatadiscovery.org/features/active-platform-features/notifications (verified 2026-05-20 status 200) — verbatim quotes in docs_link_semantic.inferred_docs[0].fetched_excerpts
- dependencies_semantic.requires-config.notifications-enabled + webhook-url ← NotificationConfiguration.java:27,89,91,94
- dependencies_semantic.requires-runtime.httpclient + jsonserdeutils ← NotificationConfiguration.java:31-34 + JSONSerDeUtils.java:14-20 + WebhookNotificationSender.java:18-23
- tests_coverage_semantic.test_files ← `find <odd-platform-repo> -name '*Test*.java' -path '*notification*'` returns zero matches (verified via Glob on the notification subtree)
- tests_coverage_semantic.uncovered_behaviours.payload-shape ← WebhookNotificationSender.java:22 + JSONSerDeUtils.java:14-20 (snake_case naming strategy — public contract operators code against)
- tests_coverage_semantic.uncovered_behaviours.unreachable-stall ← NotificationConfiguration.java:32 (`HttpClient.newHttpClient()` — no `connectTimeout`) + WebhookNotificationSender.java:18-23 (no `.timeout(...)`)
- docs_link_semantic.inferred_docs[0] ← WebFetch https://docs.opendatadiscovery.org/features/active-platform-features/notifications (verified 2026-05-20 status 200)
- docs_link_semantic.inferred_docs[1] ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform (verified 2026-05-20 status 200)
- docs_link_semantic.doc_drift_findings[0] (no HMAC) ← WebFetched live-doc silence + WebhookNotificationSender.java:20-22 (no header / signing)
- docs_link_semantic.doc_drift_findings[1] (200-only accept) ← WebFetched live-doc silence + AbstractNotificationSender.java:26-29
- docs_link_semantic.doc_drift_findings[2] (no Content-Type) ← WebFetched live-doc silence + WebhookNotificationSender.java:20-22
- docs_link_semantic.doc_drift_findings[3] (no URL allowlist) ← WebFetched live-doc silence + NotificationConfiguration.java:91,94-96
- docs_link_semantic.doc_drift_findings[4] (single-URL-per-deployment) ← WebFetched live-doc silence + WebhookNotificationSender.java:11
- docs_link_semantic.doc_drift_findings[5] (cross-owner exposure) ← WebFetched live-doc silence + WebhookNotificationSender.java:11,22 + AlertNotificationMessage.java:28 (owners[] populated but not filtered)
- implicit_adrs.[0] (thin proxy) ← WebhookNotificationSender.java:10-30 (entire class)
- implicit_adrs.[1] (symmetric exception wrapping with Slack) ← WebhookNotificationSender.java:19-23 + AbstractNotificationSender.java:16-30 + SlackNotificationSender.java:39-49
- implicit_adrs.[2] (receiverId as display string) ← WebhookNotificationSender.java:27-29 + SlackNotificationSender.java:52-54 + NotificationSenderException.java:24-27
- implicit_adrs.[3] (one URL per deployment) ← WebhookNotificationSender.java:11 + NotificationConfiguration.java:88-99
- bugs_limitations_corner_cases.[0] (no HMAC) ← WebhookNotificationSender.java:20-22
- bugs_limitations_corner_cases.[1] (no URL allowlist / SSRF) ← WebhookNotificationSender.java:11 + NotificationConfiguration.java:91,94-96
- bugs_limitations_corner_cases.[2] (no custom headers) ← WebhookNotificationSender.java:20-22 + NotificationConfiguration.java:88-99
- bugs_limitations_corner_cases.[3] (no retry) ← WebhookNotificationSender.java:19-23 + AbstractNotificationSender.java:16-30 + NotificationSubscriber.java:83-84
- bugs_limitations_corner_cases.[4] (no idempotency) ← WebhookNotificationSender.java:18-23
- bugs_limitations_corner_cases.[5] (cross-tenant exposure) ← WebhookNotificationSender.java:11,22 + AlertNotificationMessageProcessor.java:25-36 + AlertNotificationMessage.java:28
- bugs_limitations_corner_cases.[6] (no Content-Type) ← WebhookNotificationSender.java:20-22
- bugs_limitations_corner_cases.[7] (200-only) ← AbstractNotificationSender.java:26-29
- bugs_limitations_corner_cases.[8] (no timeout — stall) ← WebhookNotificationSender.java:18-23 + NotificationConfiguration.java:32
- bugs_limitations_corner_cases.[9] (JsonProcessingException → RuntimeException latent) ← WebhookNotificationSender.java:22 + JSONSerDeUtils.java:62-64 + AlertNotificationMessageProcessor.java:31
- bugs_limitations_corner_cases.[10] (receiverId asymmetry) ← WebhookNotificationSender.java:27-29 + SlackNotificationSender.java:52-54 + NotificationSenderException.java:24-27
- security.auth_mode_relevance ← WebhookNotificationSender.java:1-30 (no auth annotations / no controller) + NotificationConfiguration.java:88-99
- security.ingestion_filter_relevance ← WebhookNotificationSender.java:1-30 (outbound HTTP, no /ingestion path)
- security.authorization_assertions ← WebhookNotificationSender.java:1-30 (no @PreAuthorize)
- security.owner_scoping ← WebhookNotificationSender.java:11,13-16,18-23 + AlertNotificationMessage.java:28
- security.data_exposure.[0] (full payload) ← WebhookNotificationSender.java:22 + AlertNotificationMessage.java:22-29
- security.data_exposure.[1] (updatedBy) ← AlertNotificationMessage.java:27 + WebhookNotificationSender.java:22
- security.data_exposure.[2] (receiver id in logs) ← WebhookNotificationSender.java:27-29 + NotificationSenderException.java:24-27 + AbstractNotificationSender.java:24-29
- security.data_exposure.[3] (URL in /actuator/env) ← WebhookNotificationSender.java:11 + NotificationConfiguration.java:91
- security.known_security_gaps.[0] (no HMAC) ← WebhookNotificationSender.java:20-22
- security.known_security_gaps.[1] (no URL allowlist) ← WebhookNotificationSender.java:11 + NotificationConfiguration.java:91,94-96
- security.known_security_gaps.[2] (no auth header support) ← WebhookNotificationSender.java:20-22 + NotificationConfiguration.java:88-99
- security.known_security_gaps.[3] (full PII payload) ← WebhookNotificationSender.java:11,22 + AlertNotificationMessage.java:22-29
- security.known_security_gaps.[4] (actuator/env URL leak) ← NotificationConfiguration.java:91
- security.known_security_gaps.[5] (no retry / DLQ / audit) ← WebhookNotificationSender.java:19-23 + AlertNotificationMessageProcessor.java:30-35 + NotificationSubscriber.java:83-84
- performance.hot_paths ← WebhookNotificationSender.java:19-23 + AbstractNotificationSender.java:16-30 + JSONSerDeUtils.java:56-66
- performance.throughput_characteristics ← WebhookNotificationSender.java:19-23 + NotificationSubscriberStarter.java:21-23 (single-thread executor — see NotificationsDispatcher sidecar) + AbstractNotificationSender.java:14 (shared httpClient)
- performance.resource_allocation ← WebhookNotificationSender.java:20-23 + NotificationConfiguration.java:32-34 + JSONSerDeUtils.java:56-66
- performance.scaling_characteristics ← WebhookNotificationSender.java:10-30,11 + NotificationSubscriber.java:60-91 (single-thread upstream)
- performance.known_performance_gaps.[0] (no timeout stall) ← WebhookNotificationSender.java:18-23 + NotificationConfiguration.java:32
- performance.known_performance_gaps.[1] (no retry) ← WebhookNotificationSender.java:19-23 + AbstractNotificationSender.java:16-30 + NotificationSubscriber.java:83-84
- performance.known_performance_gaps.[2] (no rate limiting) ← AbstractNotificationSender.java:24-29 (200-only, no 429 handling)
- performance.known_performance_gaps.[3] (synchronous fan-out coupling) ← WebhookNotificationSender.java:19-23

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: HIGH
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: HIGH

## Maintainer notes

(none — net-new sidecar for the generic webhook channel sender. Sibling to the existing
SlackNotificationSender and EmailNotificationSender code paths; companion to the
NotificationsDispatcher and NotificationConfiguration sidecars. Cross-references the
exception-type-asymmetry-notification-senders concept (this class does NOT violate the
contract at runtime — JSONSerDeUtils' RuntimeException is latent because
AlertNotificationMessage is currently Jackson-clean — but the structural extension
of the asymmetry to webhook is captured at bugs_limitations_corner_cases.[9]).

Six findings unique to THIS class (not duplicated from siblings):

  1. NO HMAC / signature / shared-secret (HIGH security — F-009 expansion: surface a
     new drift facet `no_hmac_signature_operator_receiver_cannot_verify_origin`).
  2. NO custom HTTP header support (MEDIUM — F-009 expansion: surface a new drift
     facet `no_auth_header_config_knob_operator_must_run_gateway`).
  3. NO `Content-Type: application/json` header set (MEDIUM — F-009 expansion: surface
     a new drift facet `no_content_type_header_strict_receivers_reject_415`).
  4. 200-only HTTP accept rejects 2xx success codes (MEDIUM — F-009 expansion: surface
     a new drift facet `200_only_accept_2xx_success_codes_treated_as_failure`).
  5. ONE URL per platform deployment (HIGH — structural reason for the cross-tenant
     leakage; F-009 extension cites this as the channel-level reason
     `pii_passthrough_to_every_channel` is unavoidable for webhook).
  6. Idempotency key absent (LOW — latent given no-retry; cited for completeness).

Cross-reference: the receiverId() string asymmetry across the three senders
("Slack" / "email" / "Generic webhook") is a minor convention drift surfaced here for
the first time — candidate concept-merger observation.

Back-link: F-009 (WAL-driven outbound alert notification fan-out). This sidecar
extends the F-009 contributing_nodes list with primary-source coverage of the
generic-webhook sender — pairing with the batch-K SlackNotificationSender hop-4a +
EmailNotificationSender hop-4c + batch-X NotificationConfiguration boot-tier sidecar.
The five gap-shaped findings above are net-new drift facets for F-009; the
exception-type-asymmetry extension is a LATENT case of the existing concept, not a
new contradiction.

Pre-emit coherence-check (LSN-018):
- No existing sidecar asserts the OPPOSITE of any claim here. NotificationsDispatcher
  states unconditional broadcast at the dispatcher; this sidecar confirms the channel-
  level structural reason (one URL field, no per-payload routing). Symmetric.
- exception-type-asymmetry-notification-senders concept identifies EmailNotificationSender
  as the runtime violator; this sidecar identifies WebhookNotificationSender as a
  latent (JSON-processing-error-path) extension of the same concept. No contradiction.
- F-009 already enumerates `no_retry_no_dlq_no_audit` + `pii_passthrough_to_every_channel`
  + `unconditional_broadcast_no_routing` as drift facets — this sidecar primary-sources
  them at the webhook channel specifically, STRENGTHENS rather than contradicts.
- NotificationConfiguration sidecar enumerates the URL-binding constraint at the bean-
  factory level; this sidecar confirms it at the runtime-class level. Symmetric.
- The live notifications doc + the live configuration-and-deployment doc are silent on
  the dimensions captured here (HMAC, headers, retry, idempotency, allowlist, content
  type, 2xx-vs-200, single-URL-per-deployment) — recorded as DOC-NNN candidates in
  doc_drift_findings. No contradiction with the docs (they are silent, not wrong).)
