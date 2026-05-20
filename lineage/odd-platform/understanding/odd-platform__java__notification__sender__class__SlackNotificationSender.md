---
node_id: "odd-platform java notification.sender class:SlackNotificationSender"
node_kind: class
axis: notification_senders
extracted_at_commit: 80637ed
enriched_at_commit: 80637ed
extractor_version: 0.1.0
prompt_version: file-analyser/0.3.0
schema_version: v0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-20-slacknotificationsender
---

# SlackNotificationSender — semantic understanding

## understanding

`SlackNotificationSender` is the Slack-channel implementation of the `NotificationSender<AlertNotificationMessage>` interface and one of the three terminal hops of F-009's WAL-driven outbound notification fan-out. Per `.send(AlertNotificationMessage)`: it invokes `SlackMessageGenerator.generateAlertMessage(...)` to build a `List<LayoutBlock>` (Slack Block Kit composition produced from the alerted-entity name, owners, namespace / data source, downstream-lineage entities up to `notifications.message.downstream-entities-depth`, and the last 3 `AlertChunkPojo.description` strings from the alert's chunk history), wraps the blocks in a single-field `SlackMessage(blocks)` record, serialises it to JSON with a class-local snake-case `ObjectMapper` (jackson-jsr310 + NON_NULL inclusion), and POSTs the body via the shared JDK `HttpClient` to the operator-configured webhook URI. The post-send contract is delegated to `AbstractNotificationSender.sendAndValidate(...)` — the call is treated as successful only when the response is **exactly** HTTP 200; any other status code, any IOException, raises `NotificationSenderException` carrying `receiverId() == "Slack"`. The class carries NO state beyond the immutable webhook URI + the message-builder dependency; it is the simplest of the three sender impls (compared to Webhook which serialises the raw DTO, and Email which renders Freemarker into MIME and iterates recipients).

## concepts

- entities: [SlackNotificationSender, AbstractNotificationSender (parent), NotificationSender (interface), AlertNotificationMessage (input DTO), SlackMessageGenerator (renders mrkdwn LayoutBlocks), SlackMessage (inner record `{blocks}`), LayoutBlock (`com.slack.api.model.block.LayoutBlock` — Slack Block Kit Java SDK type), URI (`java.net.URI` — the webhook target), HttpClient (`java.net.http.HttpClient` — shared singleton), HttpRequest (`java.net.http.HttpRequest`), ObjectMapper (Jackson; class-static, snake-case naming, NON_NULL inclusion, java-time module, FAIL_ON_UNKNOWN_PROPERTIES disabled), NotificationSenderException]
- operations: [
    "build Slack Block Kit message via SlackMessageGenerator.generateAlertMessage (returns List<LayoutBlock>)",
    "wrap blocks in a single-field SlackMessage(blocks) record (Jackson-serialises to `{\"blocks\":[...]}`, the canonical Slack incoming-webhook payload shape)",
    "serialise to JSON with the class-static ObjectMapper — IllegalArgumentException on Jackson failure",
    "build an HttpRequest.POST against the immutable slackWebhookUrl with no headers (no Content-Type, no User-Agent, no Slack-Signing) and no body publisher beyond ofString(payload)",
    "invoke parent sendAndValidate(request) — HTTP send + status-code === 200 check",
    "return receiverId() == \"Slack\" (the string used by the dispatcher's log statements and the NotificationSenderException message prefix)"
  ]
- invariants: [
    "Slack webhook URI is bound ONCE at bean construction (final URI slackWebhookUrl) — there is no per-alert override, no per-channel routing, no map of (alert-type → channel) — one ODD platform deployment can POST to exactly ONE Slack channel via this sender",
    "exactly-HTTP-200 success contract — Slack's incoming-webhook documented responses include 200 'ok' on success AND non-200 status codes on every error (4xx for bad payload, 429 for rate-limit, 5xx for Slack-side outage); ALL non-200 are treated identically here (NotificationSenderException, no retry, no backoff, no 429-distinguishing)",
    "no retry, no backoff, no DLQ — a single failed send results in NotificationSenderException propagating to the dispatcher (which logs at ERROR and continues to the next sender for the SAME alert per F-009 chain semantics)",
    "no rate-limiting client-side — a burst of N alerts becomes N synchronous POSTs back-to-back (the dispatcher loop is serial); Slack's documented 1-msg-per-second-per-webhook limit will return 429 + Retry-After, but the platform does not honour Retry-After",
    "no idempotency key, no de-duplication — re-delivery of the same WAL event after a 10s poison-message backoff (F-009 chain hop-3) re-sends the same alert to Slack",
    "no Content-Type header set on the HttpRequest — Slack incoming webhooks accept both `application/json` and `application/x-www-form-urlencoded`; the JDK HttpClient default for POST with ofString publisher is no explicit Content-Type — Slack's parser infers from body shape, which works empirically but is undocumented at the receiver edge",
    "no scheme allowlist on the URI (bound as raw java.net.URI at NotificationConfiguration.java:77, validated only as non-empty at L81-83); `file:` / `gopher:` / RFC1918 / loopback / metadata-IMDS URIs are accepted at boot and rejected only at HttpClient.send() time"
  ]
- audiences: [platform-operator (owns the webhook URL — the credential), notification-recipient (Slack workspace + channel the webhook targets — receives every alert across every owner / namespace), data-engineer-analyst + data-quality-engineer (the alert-content audience downstream), slack-workspace-bot-installed (the workspace that hosts the webhook; sees the channel-name, the message payload, and the resolved odd.platform-base-url linkback)]

## dependencies_semantic

- requires-feature: [
    "P-07 Active Platform Features > Notifications sub-feature (the F-009 chain producing AlertNotificationMessage instances; without ALERT-table rows + WAL subscription, this sender is dormant)",
    "Slack workspace with an Incoming Webhook configured (per live doc — operator creates a Slack app + adds an Incoming Webhook + paste-the-URL pattern)",
    "AlertNotificationMessageTranslator-produced AlertNotificationMessage (the input DTO; this sender does not call into translation directly)"
  ]
- requires-config: [
    "notifications.receivers.slack.url — the webhook URI; bound as URI at NotificationConfiguration.java:77, validated non-empty at L81-83; THIS sender's bean is created only when this key is present (per @ConditionalOnProperty at NotificationConfiguration.java:75)",
    "(indirect, via SlackMessageGenerator constructor) odd.platform-base-url — the URL prefix used inside the rendered mrkdwn link `<url|text>` for entity-detail pages; consumed by SlackMessageGenerator NOT by this class directly; if unset the link points at the email-sender's :http://localhost:8080 fallback (cross-link to NotificationConfiguration sidecar's platform-base-url asymmetry finding — Slack DOES carry platform-base-url via the SlackMessageGenerator bean, but consumes it transitively, not via @Value here)",
    "notifications.message.downstream-entities-depth — sets the lineage depth for the Affected-data-entities section produced by SlackMessageGenerator.resolveDownstreamSections; indirect dependency",
    "notifications.enabled=true (subsystem gate per @ConditionalOnNotifications on NotificationConfiguration — without it this bean is not created at all)"
  ]
- requires-runtime: [
    "java.net.http.HttpClient (shared singleton from NotificationConfiguration.java:31-34 — same instance also serves WebhookNotificationSender)",
    "outbound HTTPS connectivity to hooks.slack.com (Slack's documented endpoint) — no proxy support in the shared HttpClient bean, no operator-tunable connect/request timeout (JDK default for HttpClient.newHttpClient() is no connectTimeout, infinite by default)",
    "Slack Block Kit Java SDK (com.slack.api:slack-api-model — included via libs.slack.api.model at odd-platform-api/build.gradle:37-38) — provides LayoutBlock + Section/Header/Context/Divider DSL imported by SlackMessageGenerator",
    "Jackson 2.x with JavaTimeModule (transitively required by the class-static ObjectMapper at L21-25; for serialising eventAt-style LocalDateTime fields inside LayoutBlock — though the current SlackMessage record only carries List<LayoutBlock>, not eventAt, so JavaTimeModule is defensive against future schema changes)"
  ]

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours: [
    "Success path — HTTP 200 from Slack — sendAndValidate returns silently, no exception",
    "Slack returns 429 (rate-limited) — observed behaviour: NotificationSenderException raised, Retry-After header silently ignored; no retry, no backoff",
    "Slack returns 400 (malformed payload — e.g. block JSON exceeds Slack's 3000-char-per-section limit) — NotificationSenderException raised, no distinction from rate-limit, no caller-visible signal that the payload is structurally invalid",
    "Slack returns 404 (webhook revoked / regenerated by workspace admin) — NotificationSenderException raised, no operator-visible alarm that the credential has been invalidated; every subsequent alert re-fails identically",
    "IOException on HttpClient.send (e.g. DNS failure, connection-refused, TLS handshake failure, infinite hang on unreachable Slack endpoint due to no connectTimeout) — NotificationSenderException raised (per AbstractNotificationSender.java:22-24)",
    "InterruptedException on HttpClient.send — propagated by sendAndValidate per AbstractNotificationSender.java:18 (the interface signature declares `throws InterruptedException`); the dispatcher's per-sender try/catch at AlertNotificationMessageProcessor.java:31 catches NotificationSenderException only, so InterruptedException bypasses the catch — symmetric with the EmailNotificationSender RuntimeException-bypass asymmetry already catalogued as REFACTOR-305",
    "JsonProcessingException inside serializePayload — thrown as IllegalArgumentException at line 64; this is a RuntimeException, also bypasses the dispatcher's per-sender catch (same severity class as the email-RuntimeException-bypass)",
    "null AlertNotificationMessage input — NPE at line 41 (message.getDataEntity() inside SlackMessageGenerator chain); not caught here",
    "Empty alertChunks list — SlackMessageGenerator.buildDescriptionsFromChunks renders empty string; message still POSTs (no validation that meaningful description exists)",
    "alertChunks containing PII — Slack-side workspace stores the full payload in channel history (no redaction here)",
    "alertChunks.description containing mrkdwn metacharacters (`*`, `_`, `~`, `<`, `>`, `@channel`, `@here`) — rendered as Slack mrkdwn directly without sanitisation, producing operator-unintended @-mentions, formatting, or fake-link injection (mrkdwn-injection class)"
  ]
- test_files: []
- gaps: |-
    `find <odd-platform-repo> -name '*Test*.java' -path '*notification*'` returns zero matches —
    the entire notification/ package is untested. Specific to THIS class:

    1. **Status-code-200-only contract** — Slack's incoming-webhook docs say success is 200 + body
       "ok"; on rate-limit Slack returns 429 with body "rate_limited" and a `Retry-After` header.
       The platform's `AbstractNotificationSender.java:26` test is `response.statusCode() != 200` —
       every non-200 maps to NotificationSenderException with NO classification (rate-limit vs.
       payload-invalid vs. webhook-revoked vs. Slack-outage). Operators investigating "why didn't
       my Slack alert arrive" must read the platform's log.error line and infer the underlying
       cause from the receiver's HTTP response status, which is NOT logged here (the abstract
       parent does not include the response body or status code in the exception message —
       confirmed at AbstractNotificationSender.java:27-29).

    2. **Exception asymmetry (compounds REFACTOR-305)** — TWO RuntimeException paths inside this
       class bypass the dispatcher's NotificationSenderException-only catch:
         (a) IllegalArgumentException at line 64 on Jackson serialisation failure
         (b) NullPointerException at line 41 if the message argument is null
       Both bypass the dispatcher's try/catch at AlertNotificationMessageProcessor.java:31. The
       EmailNotificationSender RuntimeException-wrap is already catalogued (REFACTOR-305 HIGH);
       this class has the same exception-type-asymmetry issue along a different path, untested.

    3. **Retry-After ignored** — Slack documents the 429 response with a `Retry-After: 1` (or
       higher) header. The platform never reads response headers (no HttpResponse.headers().firstValue
       call anywhere in AbstractNotificationSender.send code path). An operator hitting Slack rate
       limits gets EVERY subsequent alert failed-and-dropped for the duration of the limit; the
       only signal is repeated log.error lines.

    4. **No payload size limit enforcement** — Slack incoming webhooks reject blocks > 50 / message
       > 40k chars with HTTP 400. SlackMessageGenerator.buildDescriptionsFromChunks .limit(3) is the
       only chunk-count cap; chunk.description string-length is unbounded and AlertChunkPojo is
       populated from ingestion-side AlertActionResolverImpl.java:162 (operator-controlled
       upstream). A pathologically long ingested description triggers a 400 + NotificationSenderException
       for the affected alert with NO operator-visible signal pointing at the payload-size cause.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/active-platform-features/notifications"
    anchor: ""
    rationale: "The live notifications page is the only doc page that names the Slack channel; describes the one-way fire-and-forget delivery semantic, distinguishes the alert-webhook from the Data Collaboration Slack app, lists the four outbound-carried fields, and (silently) does NOT document rate-limiting / retries / mrkdwn / channel override — which matches the code's silent treatment of these concerns."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      WebFetch 2026-05-20, status 200. Quoted hints:

      Info (alert webhook vs Discussions Slack app):
        "This is the alert webhook, not the Discussions Slack app... alerting Slack integration is
         a one-way `notifications.receivers.slack.url` POST — no replies, no thread state"
        Matches THIS file's one-shot HTTP POST shape (lines 40-49) — no thread tracking, no
        per-alert channel override, no inbound listener.

      Delivery semantic (explicit framing):
        "The platform POSTs a formatted alert message to a Slack incoming webhook URL"
        "outgoing-only — there is no thread state, no reply ingestion, no per-channel routing
         logic; the platform writes one message per alert dispatch"
        Matches THIS file's bean shape — ONE final URI bound at construction; no override path.

      Outbound carries (the live doc enumerates 4 items):
        1. Entity name
        2. Data source and namespace
        3. Entity owners
        4. Affected downstream entities (within `notifications.message.downstream-entities-depth`
           levels, default 1)
        Matches SlackMessageGenerator.generateAlertMessage(...) lines 66-93 — the four sections
        rendered onto LayoutBlocks (plus the alert-chunk description text, which the live doc
        does NOT explicitly enumerate as a carried field — see doc_drift_findings below).

      Silent on:
        - rate-limiting (Slack 429 + Retry-After)
        - retry behaviour on failed delivery
        - mrkdwn metacharacter handling / mrkdwn injection risk
        - per-alert channel-name override (NOT supported by Slack incoming webhooks anyway —
          the webhook is bound to the channel at install time on the Slack workspace side)
        - message format customisation
        These silences match the code's behaviour — the platform does not implement any of these
        features. The doc's silence is consistent with the code's absence.

  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform"
    anchor: "#enable-alert-notifications"
    rationale: "The configuration doc page provides the `notifications.receivers.slack.url` config-key example (verbatim YAML snippet) and the prose framing of slack-url-as-Incoming-Webhook. Pairs with this class's `@Value(\"${notifications.receivers.slack.url}\")` binding at NotificationConfiguration.java:77."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      WebFetch 2026-05-20, status 200. Quoted hints:

      Slack URL config (verbatim YAML):
        notifications:
          receivers:
            slack:
              url: {slack_incoming_webhook_url}
        Matches NotificationConfiguration.java:75-86 (the @Bean factory) → the URI value flows
        into THIS class's constructor at line 30-37.

      Distinction (Slack webhook vs Slack app):
        "Slack here is the outgoing alert webhook, not the Discussions Slack app... It is
         distinct from the full Slack app used by Data Collaboration."
        Matches THIS class's lack of any OAuth / Events-API import — `com.slack.api.model.block.LayoutBlock`
        is purely a payload-shape DSL; no Slack-app-side wiring is referenced here.

      Silent on (verified across the configuration page):
        - rate limiting / 429 / Retry-After
        - retry / backoff / DLQ
        - certificate validation / TLS pinning
        - message format / mrkdwn injection
        Code matches: THIS class implements NONE of these. The doc silence is consistent.

- doc_drift_findings:
  - "The live doc enumerates 4 outbound-carried items (entity name, data source + namespace, owners, downstream entities) but DOES NOT explicitly name **alertChunks.description text** as a carried field. SlackMessageGenerator.generateAlertMessage at lines 76-77 + the buildDescriptionsFromChunks helper at lines 95-101 render `.description` strings (sorted by created_at descending, limit 3) into the primary mrkdwn body section — this is the operator-visible alert content that explains WHY the alert fired. The doc's omission is operator-relevant: a reader of the doc would not realise that upstream-ingestion-controlled description strings reach the Slack channel verbatim — relevant to PII surface, mrkdwn-injection class, and operator-trust assessment. Candidate doc-drift / coverage-gap finding."
  - "The live doc states 'no per-channel routing logic; the platform writes one message per alert dispatch' — confirmed at code level (the webhook URI is a single immutable field at L27 of THIS file, no override path). But the doc does NOT explain WHY: Slack's incoming-webhook API itself binds the channel at install time on the Slack-workspace side (one webhook = one channel; operators wanting multiple channels create multiple webhooks). This is structurally undocumented at the ODD doc layer — operators who want per-alert-type channel routing have no path forward and the doc does not explicitly close the door. Candidate documentation-improvement (cross-link to F-009 `unconditional_broadcast_no_routing` drift class)."
  - "The live doc is SILENT on Slack 429 rate-limit handling. The code's behaviour: every non-200 status code (including 429) raises NotificationSenderException uniformly; Retry-After header is not read; subsequent alerts continue to fire at the same cadence and continue to fail. The doc's silence + code's silence-without-mitigation = compound operator-trap (Slack-side outage / rate-limit translates into 'alerts silently dropped' on the platform side). Candidate doc-drift + REFACTOR candidate (cross-link to REFACTOR-129 batch-C 'no rate-limiting at any layer')."
  - "The live doc is SILENT on mrkdwn injection. AlertChunkPojo.description text is rendered as Slack `markdownText(...)` at SlackMessageGenerator.java:77 — Slack interprets `*bold*`, `_italic_`, `<url|text>`, `@channel`, `@here`, `<!here>`, `<!channel>` as markup. An ingestion-side actor with control over alert descriptions (which originate from upstream collectors / source-system metadata per AlertActionResolverImpl.java:162) can inject `@channel` / `@here` to broadcast-notify the Slack workspace's channel members. The doc says NOTHING about this and the code performs NO escaping. Candidate doc-drift + REFACTOR (cross-link to F-009 drift class candidate `mrkdwn_injection_via_alert_description`)."

## implicit_adrs

- "Slack delivery is one-shot fire-and-forget with exactly-HTTP-200 success semantic — every non-200 (including 429 rate-limit) raises a single uniform `NotificationSenderException` that the dispatcher catches and logs; there is NO retry, NO backoff, NO Retry-After honoring, NO DLQ, NO per-status-class handling. This encodes a deliberate 'don't queue at the platform; let Slack be the source-of-truth for delivery; if Slack is unavailable, accept the loss' stance — consistent with the broader F-009 catch-and-continue ADR-CANDIDATE-098." — evidence: SlackNotificationSender.java:40-49 + AbstractNotificationSender.java:16-30 — intent_anchor: "`sendAndValidate(request)` (no retry loop, no scheduled retry) + AbstractNotificationSender.java:26 `if (response.statusCode() != HttpStatus.OK.value()) { throw new NotificationSenderException(...); }` — uniform-on-failure" — confidence: HIGH

- "The webhook URI is bound ONCE at bean construction (`private final URI slackWebhookUrl;` at L27 + the constructor at L30-37) — no per-alert routing override, no map of (alert-type → URI), no operator-configurable channel-name field. This encodes the architectural decision that one ODD deployment maps to exactly one Slack channel (and the operator who wants multiple channels deploys multiple webhooks at the Slack-workspace level and accepts that EVERY alert goes to EVERY configured webhook). Combined with NotificationConfiguration.java:75-86 (single bean factory, single URL, no list) this is committed at boot." — evidence: SlackNotificationSender.java:27,30-37 + NotificationConfiguration.java:75-86 — intent_anchor: "`private final URI slackWebhookUrl;` (final, no setter, single field, no list / map equivalent)" — confidence: HIGH

- "Payload serialisation uses a class-static ObjectMapper with snake-case naming + NON_NULL inclusion + JavaTimeModule + FAIL_ON_UNKNOWN_PROPERTIES disabled — chosen specifically to match Slack incoming-webhook's documented JSON shape (`{ \"blocks\": [...] }` with snake_case field names for the Slack Block Kit DTOs). The disabled FAIL_ON_UNKNOWN_PROPERTIES is the conventional defensive shape for serialiser-side; NON_NULL inclusion avoids sending null fields that Slack's parser may reject." — evidence: SlackNotificationSender.java:21-25 — intent_anchor: "`new ObjectMapper().disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES).registerModules(new JavaTimeModule()).setPropertyNamingStrategy(PropertyNamingStrategies.SNAKE_CASE).setSerializationInclusion(JsonInclude.Include.NON_NULL)`" — confidence: HIGH

- "The class wraps its blocks in a private inner record `SlackMessage(List<LayoutBlock> blocks)` rather than sending the raw List<LayoutBlock> as the request body. This is the deliberate shape-match for Slack's documented incoming-webhook JSON contract — `{\"blocks\": [...]}` is what Slack's parser expects at top-level; bare arrays at top-level would be rejected. The record is private (file-local), unexported, and named precisely for the wire-format role." — evidence: SlackNotificationSender.java:45,68 — intent_anchor: "`private record SlackMessage(List<LayoutBlock> blocks) {}` + `new SlackMessage(slackMessage)` at the POST construction" — confidence: HIGH

## bugs_limitations_corner_cases

- "**Slack 429 rate-limit returns NotificationSenderException undifferentiated from 4xx / 5xx — Retry-After header silently ignored.** Slack documents its incoming-webhooks as rate-limited to ~1 message per second per webhook (short bursts allowed); on excess, Slack returns 429 with a `Retry-After: N` header. `AbstractNotificationSender.java:26` checks only `response.statusCode() != 200` — every non-200 raises an identical NotificationSenderException with the same message string and no body / status-code / header information. The dispatcher logs at ERROR and proceeds to the next sender for the SAME alert. The NEXT alert (and the one after, and the one after) re-attempts the Slack POST at the same cadence, which Slack continues to 429 until the burst clears. Operators with high-cardinality alert bursts (e.g. a single failed dbt run that produces 50+ alerts) will silently lose most of them to rate-limiting with no operator-visible signal beyond the log-line." — evidence: SlackNotificationSender.java:43-48 + AbstractNotificationSender.java:24-29 (no header read, no status-class branch) — severity: HIGH

- "**No URI scheme allowlist / no SSRF guard at sender layer (inherited from boot-side gap).** The slackWebhookUrl is bound at NotificationConfiguration.java:77 as raw `java.net.URI` via `@Value`, with only an empty-string check at L81-83. THIS class accepts the URI verbatim and invokes `HttpRequest.newBuilder().uri(slackWebhookUrl)` at line 44 — no scheme allowlist (operator can configure `file:` or `gopher:` and only the JDK HttpClient rejection at send-time prevents the request), no host allowlist (operator can configure `http://169.254.169.254/...` for AWS instance-metadata, `http://localhost:NNNN/...` for loopback services, or any RFC1918 address), no certificate-pinning to hooks.slack.com. An attacker with config-modification capability (e.g. via `/actuator/refresh` or environment-variable injection) can use the Slack notification path as an SSRF vector. Cross-link: batch-X REFACTOR-498 'no URI scheme allowlist on notifications.receivers.*.url' (already catalogued at the NotificationConfiguration sidecar)." — evidence: SlackNotificationSender.java:27,30-37,44 (no validation of slackWebhookUrl beyond accepting it as-is) + NotificationConfiguration.java:75-86,77,81-83 — severity: MEDIUM

- "**Mrkdwn injection via AlertChunkPojo.description.** AlertChunkPojo.description strings flow into Slack as `markdownText(...)` at SlackMessageGenerator.java:77 (lines 95-101 build the description block from the latest 3 chunks). Slack interprets `*bold*`, `_italic_`, `~strikethrough~`, `<url|text>`, `@channel`, `@here`, `<!channel>`, `<!here>` as mrkdwn markup. AlertChunkPojo populates `.description` from ingestion-side `AlertActionResolverImpl.java:162` which sets it from upstream collector-supplied content (e.g. a dbt test description, a Great Expectations expectation result string, a schema-diff narrative). An upstream-side actor with control over the description string can inject `@channel` to broadcast-notify the entire Slack channel membership, inject `<https://attacker.example/|click here>` to render a fake-link, or inject `<!here>` to alert online users — all rendered as Slack-side markup with NO platform-side escaping. The risk is bounded by the trust posture toward upstream collectors (which is itself unbounded in ODD — ingestion accepts arbitrary descriptions). No `MrkdwnUtils.escape(...)` exists in MrkdwnUtils.java:1-14; the only mrkdwn helpers are `bold(...)` and `buildLink(...)` for platform-controlled strings — operator-supplied / ingestion-supplied strings are passed through raw." — evidence: SlackNotificationSender.java:41 (`messageBuilder.generateAlertMessage(message)`) + SlackMessageGenerator.java:77,95-101 + MrkdwnUtils.java:1-14 (no escape function) + AlertActionResolverImpl.java:162 (ingestion-side population) — severity: HIGH

- "**No retry, no DLQ, no audit on failed Slack delivery (file-local manifestation of F-009 REFACTOR-127).** The contract here is single-attempt-or-fail. The dispatcher catches NotificationSenderException and moves on — there is no record in the ALERT table, no row in any audit table, no metric counter increment, no Prometheus 'notifications_sent_total{channel=\"Slack\",result=\"failure\"}' increment. An operator asking 'how many alerts went to Slack last week' or 'which alerts failed Slack delivery between 14:00 and 14:30 yesterday' has no answer beyond grep'ping log files for `Notification sender Slack:` substring." — evidence: SlackNotificationSender.java:40-49 (no retry call) + AbstractNotificationSender.java:16-30 (no metrics emit, no audit write) + AlertNotificationMessageProcessor.java:29-35 (per-sender catch-and-log only) — severity: HIGH (operability + compliance gap)

- "**No connect / request timeout on the shared HttpClient bean.** The HttpClient is constructed via `HttpClient.newHttpClient()` at NotificationConfiguration.java:32-34 — the JDK's default factory method that does NOT set a connectTimeout. For an unreachable Slack endpoint (Slack regional outage, DNS hijack, network partition), `httpClient.send(...)` at AbstractNotificationSender.java:21 will block on the underlying socket layer until the OS-level timeout (Linux default ~75-120s for SYN_SENT). The notification-subscriber thread is single-threaded (F-009 hop-2 invariant); a slow Slack endpoint blocks ALL subsequent alert delivery (Slack + Webhook + Email) across the WHOLE platform deployment. This is structurally identical to the SMTP-timeouts-unset finding catalogued on the NotificationConfiguration sidecar (HIGH severity) but applies to outbound HTTP rather than SMTP." — evidence: SlackNotificationSender.java:43-48 + AbstractNotificationSender.java:21 + NotificationConfiguration.java:31-34 (no `.connectTimeout(...)` builder call) — severity: HIGH

- "**No Content-Type / User-Agent / X-Slack-* request headers set.** The HttpRequest construction at SlackNotificationSender.java:43-46 calls only `.uri(...)` and `.POST(...)` on the builder — no `.header(\"Content-Type\", \"application/json\")`, no User-Agent identifying the platform version (`ODD-Platform/X.Y.Z`), no correlation ID for tracing across the operator's monitoring stack. Slack's incoming-webhook parser accepts JSON content without an explicit Content-Type empirically, but the behaviour is undocumented at Slack's receiver edge and could change. The User-Agent / correlation-ID absence makes it hard for operators to disambiguate ODD-originated alerts from any other tool POSTing to the same workspace's webhook namespace." — evidence: SlackNotificationSender.java:43-46 — severity: LOW

- "**Class is not Spring-managed (`@Component`-less); instantiated manually by NotificationConfiguration.** Unlike most service classes in the codebase, this is plain Java instantiated via `new SlackNotificationSender(...)` at NotificationConfiguration.java:85 inside a `@Bean` factory. This means: (a) the class is not eligible for AOP-based cross-cutting concerns (no `@Transactional`, no `@Timed`, no Spring-Retry annotations), (b) the class cannot inject other Spring beans beyond what the @Bean factory passes via constructor, (c) Spring's @Validated / @Validated-on-method does not apply. Architecturally this is a deliberate immutability choice (per implicit ADR #2 above) but it means future mitigations (retry, metric emission, audit) cannot be added via Spring annotations and must be implemented either in `sendAndValidate(...)` parent OR as a decorator at the NotificationConfiguration bean-factory layer." — evidence: SlackNotificationSender.java:20 (no @Component / @Service annotation) + NotificationConfiguration.java:85 (`new SlackNotificationSender(...)`) — severity: LOW

- "**ObjectMapper is class-static; no per-instance customisation possible.** The ObjectMapper at SlackNotificationSender.java:21-25 is `private static final` — a single instance shared across all `serializePayload(...)` invocations. Thread-safety of Jackson ObjectMapper is documented OK for read-only operations (no `registerModule` / `configure(...)` after construction). The static-final shape means an operator with a strange Slack-side parser quirk (e.g. wanting tab-indented JSON, wanting a different naming strategy, wanting bigDecimal-as-string) has no platform-side knob — modification requires source change. Acceptable for the documented Slack contract; flagged as a constraint." — evidence: SlackNotificationSender.java:21-25 — severity: LOW

- "**No per-instance HttpClient configurability — bound to the shared singleton.** The constructor at line 30-37 accepts an `HttpClient` parameter, but the sole call site at NotificationConfiguration.java:85 passes the shared bean — there is no operator-tunable override. An operator wanting a separate HttpClient for Slack (with a specific proxy, a specific connectTimeout, a Slack-specific TLS truststore) cannot achieve this via configuration; modifying NotificationConfiguration is required." — evidence: SlackNotificationSender.java:30-37 + NotificationConfiguration.java:85 — severity: LOW

- "**Webhook URL is a credential bound at boot — no rotation hook.** Slack's incoming-webhook URLs are de-facto bearer tokens (anyone with the URL can post to the channel). The URL is bound at bean construction (Spring's @Value resolution at NotificationConfiguration.java:77 → constructor parameter at this file's line 31 → final field at line 27). A workspace admin who rotates the webhook URL (e.g. on credential leak) requires the operator to restart the ODD process with the new value — no in-app rotation, no SIGHUP-style refresh, no Spring-Cloud-Config-style live-reload integration. This is the same constraint that applies to every @Value-bound config in ODD, but it is operationally load-bearing for credential-class config." — evidence: SlackNotificationSender.java:27,30-37 + NotificationConfiguration.java:77 — severity: LOW (architectural; design-intentional)

## security

- **auth_mode_relevance**: `INTERNAL_ONLY` — `SlackNotificationSender` is an outbound-delivery class on the boot-wired bean graph. ODD's UI auth modes (DISABLED / LOGIN_FORM / OAUTH2 / LDAP) do not gate this code directly. Behaviour shifts based on the FEATURE gate (`notifications.enabled` + `notifications.receivers.slack.url` presence), not the AUTH mode. The class is not on any HTTP-inbound path. — evidence: SlackNotificationSender.java:20 (plain class, no `@RestController` / `@RequestMapping` / `@Path`) + NotificationConfiguration.java:75-86 (single-bean factory, no auth-mode condition).

- **ingestion_filter_relevance**: `NO — outbound delivery, not /ingestion/*`. The class POSTs to an operator-configured webhook; nothing here participates in the `IngestionDataEntitiesFilter` chain. — evidence: SlackNotificationSender.java:1-70 (no `/ingestion` references, no servlet filter).

- **authorization_assertions**: [] — `NotificationSender` impl; no `@PreAuthorize` is applicable. The architectural decision is that all configured channels receive all alerts regardless of which Owner the alerted data entity belongs to (per F-009 `unconditional_broadcast_no_routing` drift class). The absence of any owner-scoping check IS the security decision and is documented as such on the F-009 feature-flow.

- **owner_scoping**: `BYPASSES — fan-out is unconditional across data-entity owners.` Every alert reaches the single configured Slack channel regardless of the alerted data entity's Owner set. AlertNotificationMessage carries `dataEntity.owners` (per AlertNotificationMessage.java:36) but this class never reads it for routing — `owners` is only consumed by SlackMessageGenerator for rendering in the message body (as @-prefixed owner names + title strings). — evidence: SlackNotificationSender.java:40-49 (no read of `message.getDataEntity().owners()` for routing decisions) + AlertNotificationMessage.java:31-37 (owners Set is part of the carried DTO) + SlackMessageGenerator.java:128-140 (owners used only for rendering, not gating).

- **data_exposure**: [
    "Full AlertNotificationMessage payload → Slack channel content, with no redaction: Entity name, data source name, namespace name, entity owners (name + title), downstream-lineage entities (name + owners up to `notifications.message.downstream-entities-depth`), and the latest 3 AlertChunkPojo.description strings. The Slack workspace's channel history persists this content indefinitely (subject to the workspace's retention policy — outside the platform's control). Cross-link to F-009 `pii_passthrough_to_every_channel` drift class.",
    "The webhook URL itself (`notifications.receivers.slack.url`) is a credential — bound here as `private final URI slackWebhookUrl` (L27) and emitted INTO the URI of every outbound POST (line 44). The URI is not echoed in any logs from THIS class (no log statement). It IS reachable via `/actuator/beans` if actuator is exposed (the bean's constructor argument list includes `slackWebhookUrl`); Spring's default `/actuator/env` sanitisation does NOT mask the substring 'url' (cross-link to NotificationConfiguration sidecar `data_exposure` finding).",
    "The Slack-side workspace is an external trust boundary not under ODD's control: a workspace admin can read the channel history, the webhook URL itself (visible in the Slack app integration UI), and audit every POST. ODD's data-residency posture cannot extend across this boundary.",
    "Resolved `odd.platform-base-url` is embedded in the rendered mrkdwn `<url|text>` links inside the Slack message (per SlackMessageGenerator.java:209-211); a misconfigured platform-base-url that points at an internal hostname leaks that hostname into the Slack workspace."
  ]

- **known_security_gaps**: [
    "Mrkdwn injection via AlertChunkPojo.description — ingestion-supplied strings rendered as Slack markdownText without escaping; `@channel` / `@here` / fake `<url|text>` links can be injected. — evidence: SlackNotificationSender.java:41 + SlackMessageGenerator.java:77 + MrkdwnUtils.java (no escape helper) — severity: HIGH",
    "No URI scheme allowlist on the webhook URI — `file:` / `gopher:` / RFC1918 / loopback / IMDS URIs accepted at boot; SSRF surface via operator-controlled config. — evidence: SlackNotificationSender.java:27,44 + NotificationConfiguration.java:75-86,77,81-83 — severity: MEDIUM",
    "Webhook URL is plaintext-at-rest in application.yml / environment variables — the URL IS a bearer credential; no support for the alternative-secrets backend (AWS SSM) at the platform side (only `odd-collector` ships the alt-secrets hook today per the system-mission). — evidence: SlackNotificationSender.java:27 + NotificationConfiguration.java:77 (raw @Value binding) + system-mission.md P-10 maintainer notes — severity: MEDIUM",
    "Unconditional broadcast to single Slack channel — every alert reaches every viewer of the configured channel regardless of which Owner / Namespace / Tenant the data entity belongs to. For multi-team deployments, cross-team alert leakage is structural. — evidence: SlackNotificationSender.java:27 (single URI bound at boot) + AlertNotificationMessageProcessor.java:25-36 (unconditional fan-out) — severity: MEDIUM",
    "No webhook signing (e.g. HMAC of body with a shared secret) on outbound — Slack incoming webhooks do not require signing on the inbound side (the URL itself is the auth), so this is per-spec; flagged because a defence-in-depth posture would sign requests to detect Slack-side credential theft. — evidence: SlackNotificationSender.java:43-46 (no `.header(\"X-Slack-Signature\", ...)`, no HMAC computation) — severity: LOW",
    "Slack-side error responses (4xx / 5xx) carry diagnostic information in the response body that THIS class discards. An operator with Slack-side observability AND platform-side observability cannot correlate failures because the response body is never logged. — evidence: AbstractNotificationSender.java:26-29 (status check, no body read) — severity: LOW"
  ]

## performance

- **hot_paths**: [
    "send(...) at line 40-49 runs on the leader-elected NotificationSubscriber single thread, synchronously, per ALERT-row WAL event for the lifetime of the platform deployment (when Slack is configured). One Slack-bound POST per alert event, no batching.",
    "Jackson serialisation at line 62 runs once per send (the static ObjectMapper is thread-safe for serialisation; no per-call allocation of the mapper). Per-call allocation: ONE SlackMessage record, ONE byte[] from writeValueAsString, ONE HttpRequest object, ONE ByteBuffer published.",
    "SlackMessageGenerator.generateAlertMessage at line 41 is a pure-CPU pass (no DB I/O — translator already enriched the DTO); negligible overhead compared to the HTTP send."
  ]

- **throughput_characteristics**: [
    "Single-message-per-send — no batching across alerts. A burst of N alerts is N synchronous Slack POSTs.",
    "Serial within the dispatcher fan-out — slow Slack endpoint delays subsequent sender invocations (Webhook + Email) for the SAME message (cross-link F-009 sequential-fan-out invariant).",
    "Backpressure on the WAL stream: HttpClient.send blocks until response or socket timeout (no connectTimeout set per NotificationConfiguration.java:32 — see known_performance_gaps); subsequent WAL events buffered in NotificationSubscriber's stream.readPending() until the synchronous chain returns.",
    "No async submission — `HttpClient` exposes `.sendAsync(...)` but THIS class uses the synchronous `.send(...)` (parent AbstractNotificationSender.java:21). Acceptable for current scale; will not scale to high-burst alerting without rate-limiting client-side."
  ]

- **resource_allocation**: [
    "No per-instance HttpClient — uses the shared `HttpClient` bean from NotificationConfiguration.java:31-34, which is the JDK default factory (`HttpClient.newHttpClient()`). JDK11+ HTTP client opens an HTTP/2 connection if upgradable, otherwise HTTP/1.1; connection-reuse is JDK-default (idle connection keep-alive per JDK's internal connection pool).",
    "Per-call allocations: one SlackMessage record (12B + List wrapper), one serialised JSON String (size = full payload, typically a few KB for typical alerts with 3 chunks + 1-2 downstream entities), one HttpRequest object, one HttpResponse<String> on receive. Bounded by the upstream cap: SlackMessageGenerator.buildDescriptionsFromChunks .limit(3) caps the chunk list, and the downstream-entities-depth caps the lineage walk.",
    "ObjectMapper is class-static — zero per-call allocation overhead.",
    "No memory pressure beyond the per-send payload."
  ]

- **scaling_characteristics**: [
    "Stateless class — re-running the bean factory produces identical bean topology; horizontal scaling of the platform produces multiple SlackNotificationSender instances but only ONE is active per cluster (the leader-elected NotificationSubscriber thread is the sole caller).",
    "No connection pool tuning surface — the shared HttpClient bean exposes none.",
    "Rate-limit ceiling: Slack documents ~1 message per second per webhook with short bursts allowed; for an ODD deployment with multiple parallel alert sources (e.g. several active ingestion runs producing simultaneous alerts), the structural throughput cap is Slack's webhook rate-limit, not the platform's CPU.",
    "Cluster-wide ONE active Slack POST sender — by design (the leader-elected invariant)."
  ]

- **known_performance_gaps**: [
    "No connect / request / response timeout on the shared HttpClient bean — an unreachable Slack endpoint blocks the notification-subscriber thread on OS-level socket timeout (Linux default ~75-120s), stalling delivery on ALL channels for the duration. — evidence: NotificationConfiguration.java:32 + AbstractNotificationSender.java:21 — severity: HIGH",
    "No client-side rate-limiting / token bucket / queue — a burst of alerts is sent at line-rate to Slack, triggering 429 rate-limits + silent message loss (the platform does not honour Retry-After). — evidence: SlackNotificationSender.java:43-48 + AbstractNotificationSender.java:24-29 — severity: HIGH (cross-link F-009 / REFACTOR-129)",
    "Synchronous send blocks the dispatcher loop — Slack latency translates into Webhook + Email delays for the SAME alert (sequential fan-out by design at AlertNotificationMessageProcessor.java:25-36). — evidence: SlackNotificationSender.java:40-49 (no .sendAsync, no executor) — severity: MEDIUM",
    "JSON serialisation per call — the static ObjectMapper is efficient but the per-call allocation of the SlackMessage record + the byte[] body is bounded (small payloads) but non-zero. Acceptable at current scale; flagged for completeness. — evidence: SlackNotificationSender.java:45,62 — severity: LOW"
  ]

## sources

- understanding ← odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/sender/SlackNotificationSender.java:1-70 + odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/sender/AbstractNotificationSender.java:1-31 + odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/sender/NotificationSender.java:1-10 + odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/processor/message/SlackMessageGenerator.java:66-93
- concepts.entities.SlackNotificationSender ← SlackNotificationSender.java:20-37
- concepts.entities.AbstractNotificationSender ← SlackNotificationSender.java:20 + AbstractNotificationSender.java:13
- concepts.entities.SlackMessage (inner record) ← SlackNotificationSender.java:68
- concepts.entities.LayoutBlock ← SlackNotificationSender.java:9 (import) + odd-platform-api/build.gradle:37-38 (libs.slack.api / libs.slack.api.model)
- concepts.entities.URI ← SlackNotificationSender.java:10,27
- concepts.entities.HttpClient ← SlackNotificationSender.java:11,30,33
- concepts.entities.ObjectMapper ← SlackNotificationSender.java:21-25
- concepts.operations.build-block-kit ← SlackNotificationSender.java:41 + SlackMessageGenerator.java:66-93
- concepts.operations.wrap-in-SlackMessage ← SlackNotificationSender.java:45,68
- concepts.operations.serialise-via-static-mapper ← SlackNotificationSender.java:21-25,56-66
- concepts.operations.POST-via-shared-HttpClient ← SlackNotificationSender.java:43-48 + AbstractNotificationSender.java:21
- concepts.operations.send-and-validate ← SlackNotificationSender.java:48 + AbstractNotificationSender.java:16-30
- concepts.invariants.one-channel-per-deployment ← SlackNotificationSender.java:27,30-37 + NotificationConfiguration.java:75-86
- concepts.invariants.exactly-200-success ← AbstractNotificationSender.java:26-29
- concepts.invariants.no-retry-no-backoff ← SlackNotificationSender.java:40-49 (no retry loop) + AbstractNotificationSender.java:16-30 (single attempt)
- concepts.invariants.no-rate-limiting ← SlackNotificationSender.java:43-48 (no token bucket, no sleep)
- concepts.invariants.no-idempotency-key ← SlackNotificationSender.java:43-48 (no Slack-Request-Id, no idempotency header)
- concepts.invariants.no-content-type-header ← SlackNotificationSender.java:43-46 (only .uri and .POST called on builder)
- concepts.invariants.no-uri-scheme-allowlist ← NotificationConfiguration.java:77,81-83 + SlackNotificationSender.java:27,44 (accepts URI verbatim)
- dependencies_semantic.requires-config.slack-url ← NotificationConfiguration.java:75-86 + SlackNotificationSender.java:27,30-37
- dependencies_semantic.requires-config.platform-base-url ← SlackMessageGenerator.java:39,209-211 (transitive; consumed via SlackMessageGenerator constructor)
- dependencies_semantic.requires-config.downstream-depth ← SlackMessageGenerator.java:90 (resolveDownstreamSections) + NotificationConfiguration.java:121-132
- dependencies_semantic.requires-config.notifications-enabled ← NotificationConfiguration.java:27 (@ConditionalOnNotifications)
- dependencies_semantic.requires-runtime.httpclient ← NotificationConfiguration.java:31-34 + SlackNotificationSender.java:30-37
- dependencies_semantic.requires-runtime.slack-sdk ← SlackNotificationSender.java:9 + odd-platform-api/build.gradle:37-38
- dependencies_semantic.requires-runtime.jackson-jsr310 ← SlackNotificationSender.java:8,21-25
- tests_coverage_semantic.test_files ← `find <odd-platform-repo> -name '*Test*.java' -path '*notification*'` returns zero matches (verified via Glob on the notification package — Glob output enumerated 21 files in odd-platform-api/.../notification with no Test*.java)
- docs_link_semantic.inferred_docs[0] ← WebFetch https://docs.opendatadiscovery.org/features/active-platform-features/notifications (verified 2026-05-20 status 200)
- docs_link_semantic.inferred_docs[1] ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform (verified 2026-05-20 status 200)
- docs_link_semantic.doc_drift_findings[0] (alertChunks.description not enumerated in live doc) ← WebFetched live-doc + SlackMessageGenerator.java:77,95-101
- docs_link_semantic.doc_drift_findings[1] (per-channel routing undocumented WHY) ← WebFetched live-doc + SlackNotificationSender.java:27 (single URI)
- docs_link_semantic.doc_drift_findings[2] (Slack 429 silent) ← WebFetched live-doc + AbstractNotificationSender.java:24-29
- docs_link_semantic.doc_drift_findings[3] (mrkdwn injection silent) ← WebFetched live-doc + SlackMessageGenerator.java:77 + MrkdwnUtils.java:1-14
- implicit_adrs.[0] (one-shot fire-and-forget exactly-200) ← SlackNotificationSender.java:40-49 + AbstractNotificationSender.java:16-30
- implicit_adrs.[1] (single-channel-per-deployment) ← SlackNotificationSender.java:27,30-37 + NotificationConfiguration.java:75-86
- implicit_adrs.[2] (class-static ObjectMapper snake_case + NON_NULL) ← SlackNotificationSender.java:21-25
- implicit_adrs.[3] (SlackMessage record wraps blocks for Slack wire shape) ← SlackNotificationSender.java:45,68
- bugs_limitations_corner_cases.[0] (Slack 429 undifferentiated) ← SlackNotificationSender.java:43-48 + AbstractNotificationSender.java:24-29
- bugs_limitations_corner_cases.[1] (no SSRF guard inherited) ← SlackNotificationSender.java:27,44 + NotificationConfiguration.java:75-86,77,81-83
- bugs_limitations_corner_cases.[2] (mrkdwn injection) ← SlackNotificationSender.java:41 + SlackMessageGenerator.java:77,95-101 + MrkdwnUtils.java:1-14 + AlertActionResolverImpl.java:162
- bugs_limitations_corner_cases.[3] (no retry / no DLQ / no audit) ← SlackNotificationSender.java:40-49 + AbstractNotificationSender.java:16-30 + AlertNotificationMessageProcessor.java:29-35
- bugs_limitations_corner_cases.[4] (no connect/request timeout) ← SlackNotificationSender.java:43-48 + AbstractNotificationSender.java:21 + NotificationConfiguration.java:31-34
- bugs_limitations_corner_cases.[5] (no Content-Type / User-Agent / X-Slack-* headers) ← SlackNotificationSender.java:43-46
- bugs_limitations_corner_cases.[6] (plain class, not @Component) ← SlackNotificationSender.java:20 + NotificationConfiguration.java:85
- bugs_limitations_corner_cases.[7] (ObjectMapper class-static, no per-instance config) ← SlackNotificationSender.java:21-25
- bugs_limitations_corner_cases.[8] (HttpClient not per-instance configurable) ← SlackNotificationSender.java:30-37 + NotificationConfiguration.java:85
- bugs_limitations_corner_cases.[9] (no in-app webhook rotation hook) ← SlackNotificationSender.java:27,30-37 + NotificationConfiguration.java:77
- security.auth_mode_relevance ← SlackNotificationSender.java:20 (no @RestController) + NotificationConfiguration.java:75-86
- security.ingestion_filter_relevance ← SlackNotificationSender.java:1-70 (no /ingestion references)
- security.authorization_assertions ← SlackNotificationSender.java:1-70 (no @PreAuthorize / no permission check)
- security.owner_scoping ← SlackNotificationSender.java:40-49 (no owners read for routing) + AlertNotificationMessage.java:31-37 + SlackMessageGenerator.java:128-140
- security.data_exposure ← SlackNotificationSender.java:27,41-48 + AlertNotificationMessage.java:22-36 + SlackMessageGenerator.java:66-93,209-211
- security.known_security_gaps.[0] (mrkdwn injection) ← SlackNotificationSender.java:41 + SlackMessageGenerator.java:77 + MrkdwnUtils.java:1-14
- security.known_security_gaps.[1] (no URI scheme allowlist) ← SlackNotificationSender.java:27,44 + NotificationConfiguration.java:77,81-83
- security.known_security_gaps.[2] (webhook plaintext-at-rest) ← SlackNotificationSender.java:27 + NotificationConfiguration.java:77
- security.known_security_gaps.[3] (unconditional broadcast cross-team leakage) ← SlackNotificationSender.java:27 + AlertNotificationMessageProcessor.java:25-36
- security.known_security_gaps.[4] (no webhook signing on outbound) ← SlackNotificationSender.java:43-46
- security.known_security_gaps.[5] (response body discarded) ← AbstractNotificationSender.java:26-29
- performance.hot_paths ← SlackNotificationSender.java:40-49 + AbstractNotificationSender.java:16-30
- performance.throughput_characteristics ← SlackNotificationSender.java:40-49 + AbstractNotificationSender.java:21 + AlertNotificationMessageProcessor.java:25-36
- performance.resource_allocation ← SlackNotificationSender.java:21-25,40-49 + NotificationConfiguration.java:31-34
- performance.scaling_characteristics ← SlackNotificationSender.java:1-70 (stateless) + NotificationSubscriberStarter / NotificationSubscriber (sibling — leader-elected single-thread)
- performance.known_performance_gaps.[0] (no timeouts on HttpClient) ← NotificationConfiguration.java:32 + AbstractNotificationSender.java:21
- performance.known_performance_gaps.[1] (no client-side rate limiting) ← SlackNotificationSender.java:43-48 + AbstractNotificationSender.java:24-29
- performance.known_performance_gaps.[2] (synchronous send blocks dispatcher) ← SlackNotificationSender.java:40-49 + AlertNotificationMessageProcessor.java:25-36
- performance.known_performance_gaps.[3] (per-call serialisation allocation) ← SlackNotificationSender.java:45,62

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

(none — net-new sidecar for `SlackNotificationSender`, the Slack channel impl of F-009's
notification subsystem. The class is the simplest of the three sender impls but carries
several file-local gap findings that compound the cross-cutting concerns already catalogued
on the F-009 feature-flow + the NotificationConfiguration / NotificationsDispatcher sidecars:

1. The 429 rate-limit blind-spot (Retry-After ignored, no client-side rate cap) — HIGH severity,
   pairs with REFACTOR-129 (batch-C 'no rate-limiting at any layer').
2. The mrkdwn-injection class via AlertChunkPojo.description — HIGH severity, NEW finding not
   present on the dispatcher / config sidecars; cross-link candidate to a new F-009 drift
   facet `mrkdwn_injection_via_alert_description`.
3. The no-connect-timeout block-the-subscriber finding — HIGH severity, pairs with the SMTP
   timeouts-unset finding already on the NotificationConfiguration sidecar (the HTTP-side
   analogue: same structural problem, different transport).
4. URI scheme allowlist absence — MEDIUM severity, primary source at the NotificationConfiguration
   sidecar (REFACTOR-498 batch-X already catalogued), confirmed at this sender layer as a
   no-extra-validation pass-through; cross-link to GenAI REFACTOR-016 (the same architectural
   pattern at a different feature surface).

The implicit ADRs are deliberately small and load-bearing: (a) the exactly-200 + uniform-failure
contract, (b) the single-channel-per-deployment commit at boot, (c) the static-final ObjectMapper
configured precisely for Slack's wire shape, (d) the SlackMessage record as the wire-format
wrapper. The maintainer should review the mrkdwn-injection finding as a possible REFACTOR
candidate ('Slack mrkdwn escaping for ingestion-supplied alert chunk descriptions') — the
fix is small (a MrkdwnUtils.escape helper applied at SlackMessageGenerator.java:77 before
markdownText), the security upside is large (closes @channel / @here broadcast injection),
and the operator-trust posture improves materially.

Cross-references confirmed at write-time:
- F-009 feature-flow (lineage/odd-platform/feature-flows/detail/F-009.yaml) — pillar P-07,
  contributing_nodes list includes `odd-platform java sender:SlackNotificationSender` (hop 4a).
- NotificationConfiguration sidecar — wiring side; this sidecar is the runtime side.
- NotificationsDispatcher sidecar — caller side; this sidecar is the callee side.
- REFACTOR-305 — the Email RuntimeException-bypass — applies symmetrically here at this
  file's lines 41 (NPE if message null) and 64 (IllegalArgumentException on Jackson failure);
  both bypass the dispatcher's NotificationSenderException-only catch; cross-link candidate.)
