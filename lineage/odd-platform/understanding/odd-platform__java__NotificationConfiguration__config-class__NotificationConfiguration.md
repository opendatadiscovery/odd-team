---
node_id: "odd-platform java NotificationConfiguration config-class:NotificationConfiguration"
node_kind: config-class
axis: config_prefixes
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.2.0
schema_version: 0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-20-notificationconfiguration
---

# NotificationConfiguration — semantic understanding

## understanding

`NotificationConfiguration` is the Spring `@Configuration` bean factory that wires the outbound alert-notification subsystem at boot: it gates the entire subsystem behind `@ConditionalOnNotifications` (which reads `notifications.enabled` directly from the Environment, defaulting to `false`), enables the two typed `@ConfigurationProperties` POJOs (`NotificationsProperties`, `EmailSenderProperties`), and conditionally instantiates four delivery-channel beans — a shared `java.net.http.HttpClient`, a Spring `JavaMailSender` for SMTP, plus three `NotificationSender<AlertNotificationMessage>` implementations (Slack incoming webhook, generic JSON webhook, SMTP email) — each activated independently by the presence of its trigger key (`notifications.receivers.{slack.url | webhook.url | email.sender}`). It additionally constructs the `AlertNotificationMessageTranslator` consumer bean (gated only by the subsystem condition) which carries the `notifications.message.downstream-entities-depth` knob (default `1`, validated non-negative at bean construction). The class is the single boot-time validation surface for the channel config (blank-field IllegalArgumentExceptions thrown on the bean methods) and the documented home of two doc-anchored caveats: SMTP timeouts are NOT set (infinite JavaMail defaults are accepted verbatim) and per-recipient email delivery is single-loop / fail-stop (causing the silent-partial-delivery hazard captured on the live doc).

## concepts

- entities: [NotificationConfiguration, HttpClient (java.net.http), JavaMailSender / JavaMailSenderImpl, SlackNotificationSender, WebhookNotificationSender, EmailNotificationSender, AlertNotificationMessageTranslator, EmailSenderProperties, NotificationsProperties, SmtpProperties, ConditionalOnNotifications, NotificationsFeatureCondition, freemarker.template.Configuration, DSLContext, JooqRecordHelper]
- operations: [
    "subsystem-level boot gate (`@ConditionalOnNotifications` on the @Configuration class itself — none of the beans below are even considered when notifications.enabled is false)",
    "per-channel boot gate (`@ConditionalOnProperty(name=\"notifications.receivers.{X}\")` on each sender / mail bean — independent activation by presence-of-key)",
    "blank-field validation at bean construction (IllegalArgumentException paths for email sender/host/protocol, slack/webhook empty URI, negative downstream depth, blank notification email list)",
    "JavaMail Properties bag population (mail.transport.protocol / mail.smtp.auth / mail.smtp.starttls.enable) — branch on protocol == 'smtp'",
    "translator construction with depth knob — the only consumer of `notifications.message.downstream-entities-depth`"
  ]
- invariants: [
    "subsystem is fully off-by-default — `@ConditionalOnNotifications` on the class means NONE of the bean methods are evaluated when `notifications.enabled` is unset or false",
    "each outbound channel is independently activated by the presence of its trigger key; channels are NOT mutually-exclusive (operator can enable any subset of {slack, webhook, email})",
    "absence of a channel key is silent (no warning logged, no boot failure) — operator with zero channels configured runs a subscriber with no senders, fan-out loop iterates empty list",
    "channels with non-empty but invalid values fail fast at bean construction: blank sender/host/protocol on email, empty URI on slack/webhook (the post-bind invariants on the bean methods)",
    "all four 'sender' beans share ONE `HttpClient` singleton built from `HttpClient.newHttpClient()` — no operator-tunable pool / timeout",
    "JavaMail `mail.smtp.connectiontimeout` / `mail.smtp.timeout` / `mail.smtp.writetimeout` are NOT set in the Properties bag — JavaMail defaults (infinite) apply",
    "platform-base-url has a hard-coded fallback `http://localhost:8080` baked into the `@Value` default — if unset in production, alert email links point at dev hostname",
    "downstream-entities-depth is read via raw `@Value` (no @ConfigurationProperties typing) — bound directly into the translator bean; rejected at boot if negative"
  ]
- audiences: [platform-operator (configures channels + SMTP creds), notification-recipient (Slack channel / webhook endpoint / email inbox), spring-container (the consumer of the produced beans), data-engineer-analyst + data-quality-engineer (downstream alert audience)]

## dependencies_semantic

- requires-feature: [
    "`notifications.enabled=true` (gate for the @Configuration class itself — read by NotificationsFeatureCondition from the Spring Environment, NOT through the NotificationsProperties POJO)",
    "Alerting feature must produce rows in the `ALERT` table — the translator consumes WAL-decoded ALERT inserts/updates; without alerts, the translator is dormant"
  ]
- requires-config: [
    "notifications.enabled=true — subsystem gate (read at file:line:27 `@ConditionalOnNotifications`)",
    "notifications.receivers.email.sender — channel gate for both `mailSender` (L37) and `emailNotificationSender` (L102); also the validated-non-blank field at L39",
    "notifications.receivers.email.host (L43) — validated non-blank",
    "notifications.receivers.email.protocol (L47) — validated non-blank; if equals 'smtp' the SMTP-specific properties are populated, otherwise raw protocol is passed to JavaMail",
    "notifications.receivers.email.port (L54) — int, no validation (Spring may bind a default 0)",
    "notifications.receivers.email.password (L57-59) — optional; null skips `setPassword(...)` (anonymous SMTP binding allowed)",
    "notifications.receivers.email.smtp.auth (L65) — boxed Boolean populated into `mail.smtp.auth`",
    "notifications.receivers.email.smtp.starttls (L66) — boxed Boolean populated into `mail.smtp.starttls.enable`",
    "notifications.receivers.email.notification.emails (L104) — comma-separated; validated non-blank",
    "notifications.receivers.slack.url (L75, L77) — channel gate + URI; validated non-empty at L81",
    "notifications.receivers.webhook.url (L89, L91) — channel gate + URI; validated non-empty at L94",
    "notifications.message.downstream-entities-depth (L123) — int; validated non-negative at L127",
    "odd.platform-base-url (L105) — only the email sender consumes it; default fallback baked in as `http://localhost:8080`"
  ]
- requires-runtime: [
    "PostgreSQL with logical replication enabled (consumed downstream by NotificationSubscriber to feed AlertNotificationMessage events through the translator constructed here)",
    "Freemarker template `email.ftlh` on classpath (required by EmailNotificationSender; passed via `freemarker.template.Configuration` autoconfigured by Spring Boot — `org.springframework.boot.autoconfigure.freemarker` starter)",
    "jOOQ DSLContext + JooqRecordHelper — for the recursive downstream lineage CTE in AlertNotificationMessageTranslator",
    "java.net.http.HttpClient — JDK11+ HTTP client; one singleton shared across Slack and Webhook senders (and reachable from EmailNotificationSender's constructor though unused for SMTP)",
    "Spring Mail autoconfiguration (`spring-boot-starter-mail`) — provides `JavaMailSenderImpl`",
    "Spring Boot autoconfiguration for `@ConfigurationProperties` binding"
  ]

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours: [
    "Boot-time IllegalArgumentException on blank `sender` / `host` / `protocol` in `mailSender(...)` (lines 39-49)",
    "Boot-time IllegalArgumentException on empty Slack/webhook URI (lines 81-83 / 94-96)",
    "Boot-time IllegalArgumentException on negative `downstream-entities-depth` (line 127)",
    "Boot-time IllegalArgumentException on blank `notifications.receivers.email.notification.emails` (line 110)",
    "Conditional-bean activation matrix: subsystem-on + zero channels (all three `@ConditionalOnProperty` triggers absent) → which beans materialise? The expected behaviour is the @Configuration class is loaded + httpClient bean is created + the translator bean is created + ZERO senders are created — but no test asserts this exact bean-graph shape",
    "Conditional-bean activation: subsystem-off (`notifications.enabled=false`) → NONE of the beans (including HttpClient) are created — but no test asserts the absence",
    "Protocol-branch behaviour in `mailSender`: protocol == 'smtp' populates auth + starttls; any other protocol value populates only `mail.transport.protocol` — line 63-69; ambiguity around protocol=='SMTP' (uppercase) which would take the else branch (case-sensitive `.equals(\"smtp\")`)",
    "Password-null path: `mailSender.setPassword(...)` skipped when `emailProperties.getPassword()` is null (lines 57-59)",
    "Notification-emails parsing: `.trim().split(\",\")` (line 118) — behaviour with leading/trailing whitespace, with empty entries between commas, with a single email",
    "Downstream-entities-depth boundary: depth=0 returns empty downstream list (AlertNotificationMessageTranslator#fetchDownstream:143); no test asserts this",
    "Bean wiring with @Value resolution failure: what happens when `notifications.message.downstream-entities-depth` is unset (no default in @Value)? Spring's behaviour is property-placeholder-resolution failure at boot — no test asserts the operator-facing error"
  ]
- test_files: []
- gaps: |
    The entire `odd-platform-api/src/main/java/.../notification` package has **zero** test files
    (verified: `find <odd-platform-repo> -path '*notification*' -name '*Test*.java'` returns no matches).
    Most regression-prone behaviours specific to THIS file:

    1. **Conditional-bean wiring matrix** — the seven boot states across `@ConditionalOnNotifications` × three
       `@ConditionalOnProperty` channels are entirely unverified. A maintainer refactoring channel keys
       (e.g. renaming `notifications.receivers.email.sender` to `.email.from`) will silently disable
       the email channel — no test catches the missed condition rename.

    2. **Protocol case sensitivity** — `emailProperties.getProtocol().equals("smtp")` at line 63 is
       case-sensitive. An operator who configures `protocol: SMTP` (uppercase, JavaMail's documented
       convention) will get the ELSE branch — `mail.smtp.auth` and `mail.smtp.starttls.enable` are
       never set; SMTP delivery proceeds without STARTTLS regardless of the `smtp.starttls` setting.
       This is a silent misconfiguration trap with zero test coverage.

    3. **Downstream-entities-depth missing**: `@Value("${notifications.message.downstream-entities-depth}")` at
       line 123 has NO default value embedded. If an operator turns on `notifications.enabled=true`
       but forgets to set `notifications.message.downstream-entities-depth`, the bean fails to wire
       at boot with a property-placeholder-resolution error — distinct from the other validated
       failure paths and unique among the @Value injections in this file (the platform-base-url
       at L105 has a `:http://localhost:8080` fallback, this one does not).

    4. **Translator bean is registered unconditionally** when the subsystem is on — even if no
       sender is registered. An operator with `notifications.enabled=true` and zero channels
       configured still pays the boot cost of the translator + the DSLContext dependency (no test
       asserts the empty-channels case is detected at boot).

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform"
    anchor: "#enable-alert-notifications"
    rationale: "The live `configuration-and-deployment/odd-platform` page lists every `notifications.*` key that THIS @Configuration class consumes — the channel triggers, the SMTP family, the message depth knob — and surfaces the SMTP-side caveats (timeouts, STARTTLS-only, self-signed cert workaround, charset issue, partial delivery) that THIS file's `mailSender` / `emailNotificationSender` beans codify."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      WebFetch 2026-05-20, status 200. Quoted from the Known Limitations / Enable Alert Notifications section:

      Configuration keys enumerated by live doc — match this file's @Value / @ConditionalOnProperty references:
        - notifications.enabled, notifications.message.downstream-entities-depth
        - notifications.wal.advisory-lock-id, notifications.wal.replication-slot-name, notifications.wal.publication-name
        - notifications.receivers.slack.url, notifications.receivers.webhook.url
        - notifications.receivers.email.{host, port, protocol, smtp.auth, smtp.starttls, password, sender, notification.emails}

      SMTP timeouts: "an unreachable SMTP server will hang notification delivery" — JavaMail defaults
      for connection / read / write timeouts are infinite, ODD does not override.

      STARTTLS only: "implicit-TLS ports (e.g. Gmail port 465, many corporate relays) will not work" —
      the `smtp.starttls` field on EmailSenderProperties is mapped into `mail.smtp.starttls.enable` at
      line 66 of THIS file, but no implicit-TLS knob is constructed.

      Self-signed certificates: "The configuration exposes no path to trust custom CAs without modifying
      the container's truststore" — confirmed by inspection: this file's Properties bag (L61-69) sets
      only protocol / auth / starttls; `mail.smtp.ssl.trust` is not surfaced.

      Charset: non-ASCII subjects/bodies require `JAVA_TOOL_OPTIONS=-Dfile.encoding=UTF-8` — confirms
      that THIS file does not set a default charset on the MimeMessage.

      Gmail example (live doc): `smtp.starttls: true`, `auth: true`, port 587, protocol: SMTP (uppercase) —
      live doc shows operator-facing uppercase 'SMTP', this file's branch at L63 compares case-sensitive
      to lowercase 'smtp' — DRIFT candidate (see doc_drift_findings below).

  - url: "https://docs.opendatadiscovery.org/features/active-platform-features/notifications"
    anchor: ""
    rationale: "Feature-level overview page describing the three outbound channels (Slack incoming webhook / Email SMTP / Generic webhook) — the user-facing semantic surface of the three sender beans constructed by THIS file."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      WebFetch 2026-05-20, status 200. Quoted hints:

      Info (alert vs Discussions):
        "This is the alert webhook, not the Discussions Slack app. The alerting Slack integration is
         a one-way `notifications.receivers.slack.url` POST — no replies, no thread state."
        Matches `slackNotificationSender(...)` at lines 76-86 of THIS file (one-shot HTTP POST per
        AlertNotificationMessage; no thread tracking).

      Warning (SMTP timeouts):
        "SMTP timeouts are unset — an unreachable SMTP server will hang notification delivery. The
         JavaMail defaults for connection / read / write timeouts are infinite, and ODD Platform does
         not override them."
        Matches `mailSender(...)` at lines 36-72: the JavaMail Properties bag is populated with
        protocol / auth / starttls only — no timeout keys.

      Danger (silent partial delivery):
        "Silent partial delivery if one recipient fails. The email sender iterates through
         `notifications.receivers.email.notification.emails` recipient by recipient; if recipient N
         fails (bad address, mailbox full, server-side rejection), the loop stops — recipients N+1,
         N+2, … never receive the alert."
        Matches `emailNotificationSender(...)` at lines 101-119 — the `List.of(notificationEmails.trim().split(","))`
        is consumed by EmailNotificationSender#send in a single try/catch around the for-loop.

      Outbound carries (4 bullets, live doc):
        1. Entity name
        2. Data source and namespace
        3. Owners attached to the entity
        4. Affected downstream entities within `notifications.message.downstream-entities-depth`
           levels (default: `1`).
        Matches the AlertNotificationMessageTranslator bean at lines 121-132 of THIS file (downstream
        depth knob) + AlertNotificationMessageTranslator.java:73-83 (the payload builder).

- doc_drift_findings:
  - "Live-doc Gmail example uses `protocol: SMTP` (uppercase) while THIS file's branch at line 63 compares case-sensitive to lowercase `'smtp'` (`emailProperties.getProtocol().equals(\"smtp\")`). An operator copying the live-doc YAML verbatim will hit the ELSE branch — `mail.smtp.auth` and `mail.smtp.starttls.enable` are never populated; STARTTLS silently does not engage even with `smtp.starttls: true`. Candidate operator-copy-paste-from-docs-silently-fails finding (cross-cutting concept already catalogued in concepts.yaml)."
  - "Live doc treats `notifications.receivers.email.notification.emails` as a top-level recipient list; the YAML key uses `notification.emails` (singular `notification`, plural `emails`) — which Spring binds as a NESTED key inside `notifications.receivers.email.notification`. THIS file consumes it via `@Value(\"${notifications.receivers.email.notification.emails}\")` at L104, which works, but `EmailSenderProperties` (the typed POJO for `notifications.receivers.email`) does NOT model a `notification.emails` sub-field — so the typed-POJO surface is incomplete (already flagged on EmailSenderProperties sidecar)."
  - "The live doc says channels are 'independently configurable' — confirmed at code level by three independent `@ConditionalOnProperty` annotations (L37 / L75 / L89). But the live doc does NOT explicitly warn that subsystem-on + zero channels is a silently-valid configuration: the @Configuration class loads, the translator bean materialises, the WAL subscriber starts, but no fan-out happens. Operator-facing gap."

## implicit_adrs

- "The notification subsystem is gated at the @Configuration class level (not at the bean-method level), via `@ConditionalOnNotifications` which delegates to `NotificationsFeatureCondition.matches(...)` reading `notifications.enabled` directly from the Spring Environment with default `false`. This encodes a single-source-of-truth, off-by-default stance — bypassing the typed `NotificationsProperties.enabled` field on the boot path so the gate is uniform across `NotificationConfiguration`, `NotificationSubscriberStarter`, and `AlertNotificationMessageProcessor` (all three annotated `@ConditionalOnNotifications`)." — evidence: NotificationConfiguration.java:27 (`@ConditionalOnNotifications` on the class) + ConditionalOnNotifications.java:8-13 + NotificationsFeatureCondition.java:8-13 — intent_anchor: "`@Conditional(NotificationsFeatureCondition.class)` (custom meta-annotation) + `context.getEnvironment().getProperty(FeatureResolver.NOTIFICATIONS_ENABLED_PROPERTY, Boolean.class, false)`" — confidence: HIGH

- "Each outbound channel (Slack / Webhook / Email) is **independently activated by the presence of its trigger key** via `@ConditionalOnProperty(name = \"notifications.receivers.{X}\")` on the respective bean method — not by a single 'enable-channel' toggle, not by a list of receiver names, not by enum dispatch. Absence of a key = no bean = silently no-op for that channel. This is a deliberate ergonomic: operators configure only the channels they want by populating only those keys; an operator using only Slack does not need to defensively set `notifications.receivers.webhook.url=`." — evidence: NotificationConfiguration.java:37 (email mailSender) + L75 (slack sender) + L89 (webhook sender) + L102 (email sender) — intent_anchor: "`@ConditionalOnProperty(name = \"notifications.receivers.slack.url\")` / `... webhook.url` / `... email.sender`" — confidence: HIGH

- "All HTTP-delivering senders share a single `java.net.http.HttpClient` constructed via `HttpClient.newHttpClient()` — connection-reuse-by-default, no per-channel client, no operator-tunable pool. The bean is registered unconditionally (under the subsystem gate) so the translator bean and any future HTTP-delivering channel can inject it." — evidence: NotificationConfiguration.java:31-34 — intent_anchor: "`@Bean public HttpClient httpClient() { return HttpClient.newHttpClient(); }` — no `@ConditionalOnProperty` on the HttpClient bean itself" — confidence: HIGH

- "The email channel is gated on `notifications.receivers.email.sender` specifically (not on `host`, `port`, `protocol`, or `notification.emails`). The implicit decision: SENDER is the smallest-surface mandatory key — if the operator sets a sender they have committed to wanting email; missing other fields fail fast at bean construction with explicit IllegalArgumentException messages. This trades a Spring-side boot abort for an operator-friendly error stack with field names." — evidence: NotificationConfiguration.java:37 + L39-49 (the four validation branches) — intent_anchor: "`throw new IllegalArgumentException(\"senderEmail is empty\");` / `\"host is empty\"` / `\"protocol is empty\"`" — confidence: HIGH

- "Email transport branch (`protocol.equals(\"smtp\")` at L63) splits handling into 'populate full SMTP Properties bag' vs 'pass protocol raw to JavaMail'. This encodes a deliberate accommodation for non-SMTP JavaMail transports (e.g. smtps, custom session providers), while keeping SMTP the documented happy-path. The case-sensitivity (lowercase only) is a latent trap when read against the live doc's uppercase Gmail example — captured under doc_drift_findings." — evidence: NotificationConfiguration.java:63-69 — intent_anchor: "`if (emailProperties.getProtocol().equals(\"smtp\")) { ... } else { props.put(\"mail.transport.protocol\", emailProperties.getProtocol()); }`" — confidence: MEDIUM (the branch shape encodes intent; the case-sensitivity is more likely an oversight than an explicit decision — see bugs_limitations_corner_cases)

- "`odd.platform-base-url` has a hard-coded `@Value` default `:http://localhost:8080` baked into the email sender's parameter list — encoding 'do not fail boot if platform-base-url is unset; render localhost links instead'. This trades a fail-fast boot against the risk of dev-hostname leakage into production alert emails. NotificationConfiguration is the ONLY place in the notification package consuming `odd.platform-base-url` (verified via grep on the package)." — evidence: NotificationConfiguration.java:105 — intent_anchor: "`@Value(\"${odd.platform-base-url:http://localhost:8080}\")`" — confidence: HIGH

## bugs_limitations_corner_cases

- "**Protocol case-sensitivity trap**: `emailProperties.getProtocol().equals(\"smtp\")` at L63 is case-sensitive lowercase, while the live doc's Gmail example (WebFetched 2026-05-20) writes `protocol: SMTP` (uppercase). An operator copying the live-doc YAML verbatim hits the ELSE branch — `mail.smtp.auth` and `mail.smtp.starttls.enable` are NEVER set in the Properties bag, regardless of what `smtp.starttls: true` and `smtp.auth: true` are configured to. Result: STARTTLS does not engage, SMTP AUTH does not negotiate; depending on the relay, the connection either fails plaintext or sends credentials in the clear. No boot warning, no log line — operator discovers the misconfiguration only after the first failed delivery." — evidence: NotificationConfiguration.java:63 + WebFetched live-doc Gmail example with uppercase protocol — severity: HIGH

- "**Missing default on `notifications.message.downstream-entities-depth`**: `@Value(\"${notifications.message.downstream-entities-depth}\")` at L123 has NO default value in the @Value expression. If an operator enables `notifications.enabled=true` but forgets to set the depth knob, the platform fails to start with Spring's generic `IllegalArgumentException: Could not resolve placeholder ...` — distinct from the file's other validation paths and inconsistent with the platform-base-url default at L105. Application.yml ships with `notifications.message.downstream-entities-depth: 1` (line 175) which masks the trap during default runs, but any override that removes the key triggers it." — evidence: NotificationConfiguration.java:123 + application.yml:174-175 — severity: MEDIUM

- "**Translator bean is unconditional within the subsystem**: `alertNotificationMessageTranslator(...)` at L121-132 is registered as long as `@ConditionalOnNotifications` is satisfied — even if ZERO `@ConditionalOnProperty` triggers fire (no slack, no webhook, no email configured). An operator with `notifications.enabled=true` and zero receivers still pays the cost of the translator bean (DSLContext + JooqRecordHelper wiring) plus the WAL subscriber thread, and the fan-out loop iterates an empty `List<NotificationSender>` silently. No log line warns about the empty-channels case." — evidence: NotificationConfiguration.java:121-132 (no @ConditionalOnProperty on the translator) + AlertNotificationMessageProcessor.java:25-36 (silent empty-list fan-out per sibling sidecar) — severity: MEDIUM

- "**Port has no validation**: `emailProperties.getPort()` at L54 is bound as `int` (primitive) in EmailSenderProperties.java:11. Spring binds the default `0` if the key is unset, and `mailSender.setPort(0)` silently configures JavaMail to fall back to its default port (25 for SMTP). An operator who forgets the port AND has SMTP relay reachable on port 25 will silently send unencrypted SMTP. No boot warning, no validation branch (compare with the explicit blank-string checks at L39/L43/L47)." — evidence: NotificationConfiguration.java:54 + EmailSenderProperties.java:11 — severity: MEDIUM

- "**SMTP timeouts are not set** — confirmed live-doc warning. The Properties bag populated at L61-69 contains `mail.transport.protocol`, `mail.smtp.auth`, `mail.smtp.starttls.enable` ONLY. None of `mail.smtp.connectiontimeout`, `mail.smtp.timeout` (read), `mail.smtp.writetimeout` is set — JavaMail defaults (infinite) apply. A hung SMTP relay blocks the notification-subscriber thread indefinitely, stalling delivery on ALL channels (not just email — the subscriber is single-threaded per sibling NotificationSubscriber.java)." — evidence: NotificationConfiguration.java:61-69 + WebFetched live-doc 'Known limitations' — severity: HIGH

- "**STARTTLS-only — no implicit TLS support**: the SmtpProperties model exposes `auth` + `starttls` only (EmailSenderProperties.java:14-19). No `mail.smtp.ssl.enable`, no `mail.smtp.socketFactory.class`, no implicit-TLS port handling is constructed. An operator pointing at an implicit-TLS port (e.g. Gmail 465, many corporate relays) cannot connect — confirmed by live-doc 'Known limitations'." — evidence: NotificationConfiguration.java:61-69 + EmailSenderProperties.java:14-19 + WebFetched live-doc — severity: MEDIUM

- "**No custom-CA trust path**: `mail.smtp.ssl.trust` and other certificate-trust JavaMail keys are NOT surfaced as ODD config keys. An operator on an internal SMTP relay with a self-signed or internal-CA certificate has no in-app path to trust the relay — JVM truststore modification is the only workaround (live-doc-documented)." — evidence: NotificationConfiguration.java:61-69 (Properties bag does not include any ssl.trust / ssl.checkserveridentity / ssl.protocols keys) + WebFetched live-doc — severity: MEDIUM

- "**`SmtpProperties.auth` and `.starttls` are boxed `Boolean`** (sibling EmailSenderProperties.java:18-19); the Properties bag at L65-66 calls `props.put(\"mail.smtp.auth\", emailProperties.getSmtp().getAuth())` and `props.put(\"mail.smtp.starttls.enable\", emailProperties.getSmtp().getStarttls())`. If either is null (operator omitted the key under `smtp:`), JavaMail receives a null value for the property — which JavaMail handles by treating the property as unset (the documented default for `mail.smtp.auth` is false; for `mail.smtp.starttls.enable` is false). Net effect: silent disablement of AUTH or STARTTLS when the operator merely omits the key (rather than getting a boot error). Less common than the case-sensitivity trap but related operator-trap." — evidence: NotificationConfiguration.java:65-66 + EmailSenderProperties.java:18-19 — severity: LOW

- "**Notification-emails parsing is fragile**: `List.of(notificationEmails.trim().split(\",\"))` at L118 — no per-entry trim (only the whole string is trimmed), no de-duplication, no empty-entry filter. Operator config `notifications.receivers.email.notification.emails: 'a@b.com, b@c.com,'` produces three entries: `'a@b.com'`, `' b@c.com'` (leading space), `''` (empty string). The empty string and the space-prefixed address will both be attempted as `helper.setTo(...)` recipients downstream — the empty string throws `AddressException` and triggers the silent-partial-delivery loop abort (live-doc-documented). Combined with the absence of recipient validation here, this is a hidden footgun." — evidence: NotificationConfiguration.java:118 — severity: MEDIUM

- "**Slack and Webhook URI binding accepts ANY scheme**: `@Value(\"${notifications.receivers.X.url}\") final URI` at L77 / L91 — Spring's URI binder accepts `file:`, `gopher:`, anything URI-shaped. The post-bind check is only `slackWebhookUrl.toString().isEmpty()` / `webhookUrl.toString().isEmpty()`. No scheme allowlist, no `@URL`, no SSRF guard. A misconfigured `notifications.receivers.slack.url=file:///etc/passwd` fails at HTTP-send time (HttpClient rejects non-http schemes), but no boot-time guard catches the mistake." — evidence: NotificationConfiguration.java:77,81-83,91,94-96 — severity: LOW

- "**Plain `URI` (not `java.net.URL`) — no length/host validation**: a very long URI string (>2048 chars) or a localhost / RFC1918 URI is accepted unchallenged. The `@Value` parses to `java.net.URI` which performs only syntactic validation. Operators who reuse a webhook URL across environments without rotation have no in-platform mechanism to detect the URL is pointed at the wrong target." — evidence: NotificationConfiguration.java:77,91 — severity: LOW

- "**Hard-coded `:http://localhost:8080` fallback for platform-base-url** at L105 — encodes operator-friendly boot, but dev-hostname leakage into production alert emails if the operator forgets to set `odd.platform-base-url`. The Slack sender does NOT carry this fallback (no `@Value` for platform-base-url in the slack bean factory — the live doc confirms only the email sender consumes platform-base-url), so misconfiguration manifests asymmetrically: Slack messages are fine (no link), email links go to localhost. Asymmetry is undocumented." — evidence: NotificationConfiguration.java:76-86 (no platform-base-url in slack bean) + L105 (platform-base-url in email bean) + WebFetched live-doc 'What an outbound notification carries' which states 'The generic webhook receiver does **not** consume `odd.platform-base-url`' (silent on Slack's consumption asymmetry) — severity: LOW

## security

- **auth_mode_relevance**: `INTERNAL_ONLY` — `NotificationConfiguration` is a Spring `@Configuration` class on the bean-wiring side, not an HTTP surface. ODD's `auth.type` (DISABLED / LOGIN_FORM / OAUTH2 / LDAP) does not gate this code directly. Behaviour shifts based on the FEATURE gate (`notifications.enabled`), not the AUTH mode. — evidence: NotificationConfiguration.java:27 (`@ConditionalOnNotifications` — the only conditional on the class).

- **ingestion_filter_relevance**: `NO — bean factory for an outbound subsystem, not on the /ingestion path`. The senders this class produces consume `AlertNotificationMessage` events from the WAL subscriber and POST OUTBOUND; nothing here participates in the `IngestionDataEntitiesFilter` chain on `POST /ingestion/entities`. — evidence: NotificationConfiguration.java:1-133 (no controller mapping, no servlet filter, no `/ingestion/*` references).

- **authorization_assertions**: [] — `@Configuration` class; no `@PreAuthorize` is applicable to bean factory methods.

- **owner_scoping**: `BYPASSES — fan-out is unconditional` (semantic inherited from the senders this class produces). Every configured channel receives every alert event regardless of which data-entity owners would have been entitled to see it. The boot-time wiring here makes the policy decision — the choice to construct one Slack URL / one webhook URL / one comma-separated email list per platform deployment, with no per-owner / per-namespace / per-tenant scoping bean. — evidence: NotificationConfiguration.java:76-86 (single Slack URL bean) + L88-99 (single Webhook URL bean) + L101-119 (single email-list bean) + sibling NotificationsProperties sidecar's `security.owner_scoping` confirming `BYPASSES`.

- **data_exposure**: [
    "SMTP credentials (`notifications.receivers.email.password`) consumed at L57-58 of THIS file — surfaced into a Spring-managed `JavaMailSenderImpl` bean → reachable via `/actuator/beans` and `/actuator/env` if actuator endpoints are exposed. Spring's `/actuator/env` masks `password` by default (key-name pattern), so this is partially mitigated by Spring, but ODD does not assert the masking explicitly nor set `@Sensitive` / `@JsonIgnore` on the EmailSenderProperties field.",
    "Slack webhook URL (`notifications.receivers.slack.url`) at L77 — a credential by nature (anyone with it can post to the Slack channel). Spring's default `/actuator/env` sanitisation does NOT include the 'url' substring in its mask list. If actuator is exposed unprotected, the slack URL is fetchable via HTTP.",
    "Generic webhook URL at L91 — same exposure shape as Slack URL; if the receiver is a payload-bearing endpoint (e.g. an HMAC-signed receiver, an authenticated webhook receiver passing the URL as a bearer-token-equivalent), it is a secret.",
    "Boot-time IllegalArgumentException messages at L40 / L44 / L48 / L82 / L95 / L111 / L128 are operator-friendly but DO NOT echo the underlying value, so credential leakage via logged stack-trace on misconfiguration is mitigated."
  ]

- **known_security_gaps**: [
    "Slack and Webhook URI scheme allowlist absent — operator can set `file:` / arbitrary schemes; HttpClient will reject at send time but no boot guard. — evidence: NotificationConfiguration.java:77,81-83,91,94-96 — severity: LOW",
    "Email password bound as plain `String` field (sibling EmailSenderProperties.java:7) and consumed verbatim at L57-58 — partially mitigated by Spring's default `/actuator/env` password-name masking, but ODD does not assert the masking and does not annotate the field as sensitive. If actuator endpoints are exposed AND Spring's default sanitisation is overridden to be more permissive, password is exposed. — evidence: NotificationConfiguration.java:57-58 + EmailSenderProperties.java:7 — severity: MEDIUM",
    "Slack webhook URL is not masked by Spring's default sanitisation (no 'url' keyword in default mask list) — if `/actuator/env` is exposed on a default config, the Slack URL is fetchable. — evidence: NotificationConfiguration.java:77 — severity: MEDIUM",
    "No URL allowlist / SSRF guard on outbound URIs — the platform will issue HTTP requests to any operator-supplied URI, including private-network targets. An attacker with config-modification capability can use the notification subsystem as an SSRF vector to internal endpoints. — evidence: NotificationConfiguration.java:75-86,88-99 — severity: MEDIUM",
    "No fan-out scoping by data-entity owner / namespace / tenant — every configured channel receives every alert (architectural decision inherited from the senders constructed here; the wiring choice is committed at boot). For multi-team or multi-tenant deployments, this means cross-team alert visibility is unavoidable without separate notification endpoints. — evidence: NotificationConfiguration.java:76-86 (one URL bean) + L101-119 (one email-list bean) — severity: MEDIUM"
  ]

## performance

- **hot_paths**: [
    "None at runtime — this @Configuration class executes during Spring boot only. The beans it produces (HttpClient, JavaMailSender, three NotificationSender variants, AlertNotificationMessageTranslator) are themselves on the hot path of WAL-driven notification delivery (sibling NotificationsProperties sidecar covers the runtime hot paths)."
  ]

- **throughput_characteristics**: [
    "Boot-only — class is loaded once at Spring context startup; bean methods run exactly once each (Spring's default singleton scope).",
    "No batching / no parallel sender construction — beans are instantiated in declaration order under Spring's standard `@Configuration` semantics.",
    "Translator bean is registered unconditionally when subsystem is on — wired even if no senders are present (see bugs_limitations_corner_cases)."
  ]

- **resource_allocation**: [
    "Single shared `HttpClient` bean from `HttpClient.newHttpClient()` at L32-34 — JDK11 default thread pool (ForkJoinPool.commonPool with cached SelectorProvider), no operator-tunable pool size, no operator-tunable per-host max connections, no connect / response timeout. The same client serves Slack + Webhook sender beans (and is reachable to Email sender, though SMTP does not use it).",
    "JavaMailSenderImpl bean holds an SMTP session (Properties bag at L61-69) — connection is opened per `send(...)` call by JavaMail (not pooled across alerts in this default config). No operator-tunable SMTP connection pool.",
    "Translator bean carries a DSLContext + JooqRecordHelper handle — same DataSource as the rest of the platform; no read-replica / dedicated-connection-pool affinity for notification queries (sibling NotificationsProperties sidecar covers the recursive CTE cost)."
  ]

- **scaling_characteristics**: [
    "Statelessness of the bean factory itself — re-running the @Configuration on context refresh produces identical bean topology. The subsystem's actual scaling characteristic (leader-elected single-thread WAL consumer at advisory lock 100) is implemented downstream of THIS file in NotificationSubscriber + NotificationSubscriberStarter (siblings).",
    "No horizontal scaling of senders — exactly one Slack sender / one webhook sender / one email sender per @Configuration load. A multi-channel-of-same-kind setup (two Slack channels with separate URLs) is NOT supported by THIS file's bean topology — operators wanting it must run two ODD instances or a Slack-side fan-out.",
    "Bean methods complete synchronously during boot — no async initialisation, no lazy bean (no `@Lazy`); slow `JavaMailSender` construction (which performs no I/O — pure Properties bag manipulation) is bounded but synchronous."
  ]

- **known_performance_gaps**: [
    "Shared `HttpClient` has no operator-tunable knobs: no `connectTimeout`, no `requestTimeout`, no `executor`, no `version`. Default behaviour: HTTP/2 if upgradable, infinite default for connect (`HttpClient.newHttpClient()` does NOT set a connectTimeout). For unreachable Slack / webhook endpoints, the send blocks until the JDK's underlying socket timeout (system-dependent, usually 75-120s on Linux). — evidence: NotificationConfiguration.java:32 — severity: MEDIUM",
    "JavaMail timeouts unset — confirmed by live-doc and re-verified here: the Properties bag at L61-69 sets protocol / auth / starttls only. SMTP connection / read / write timeouts default to infinite. — evidence: NotificationConfiguration.java:61-69 + WebFetched live-doc — severity: HIGH",
    "Single shared HttpClient + serial fan-out (in downstream AlertNotificationMessageProcessor) means slow Slack endpoint blocks subsequent webhook / email delivery for the same alert — wiring decision committed here by using one HttpClient + one bean topology rather than per-channel clients with bulkheads. — evidence: NotificationConfiguration.java:31-99 (one HttpClient, three senders sharing it) — severity: MEDIUM",
    "Translator bean is always constructed when the subsystem is on, even if zero senders are registered — wastes the wiring cost (DSLContext + JooqRecordHelper + downstream-depth knob) but no runtime cost beyond bean construction. — evidence: NotificationConfiguration.java:121-132 — severity: LOW"
  ]

## sources

- understanding ← odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/config/NotificationConfiguration.java:1-133 + odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/config/ConditionalOnNotifications.java:1-13 + odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/config/NotificationsFeatureCondition.java:1-15 + odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/config/EmailSenderProperties.java:1-21 + odd-platform-api/src/main/resources/application.yml:172-195
- concepts.entities.NotificationConfiguration ← NotificationConfiguration.java:26-29
- concepts.entities.HttpClient ← NotificationConfiguration.java:31-34
- concepts.entities.JavaMailSender ← NotificationConfiguration.java:36-72
- concepts.entities.SlackNotificationSender ← NotificationConfiguration.java:74-86
- concepts.entities.WebhookNotificationSender ← NotificationConfiguration.java:88-99
- concepts.entities.EmailNotificationSender ← NotificationConfiguration.java:101-119
- concepts.entities.AlertNotificationMessageTranslator ← NotificationConfiguration.java:121-132
- concepts.entities.ConditionalOnNotifications ← NotificationConfiguration.java:27 + ConditionalOnNotifications.java:1-13
- concepts.entities.NotificationsFeatureCondition ← NotificationsFeatureCondition.java:1-15
- concepts.invariants.subsystem-off-by-default ← NotificationConfiguration.java:27 (@ConditionalOnNotifications) + NotificationsFeatureCondition.java:13 (`Boolean.class, false`) + application.yml:173 (`enabled: false`)
- concepts.invariants.channel-independent-activation ← NotificationConfiguration.java:37,75,89,102
- concepts.invariants.channel-zero-silent ← NotificationConfiguration.java:36-119 (no @ConditionalOnProperty on the translator at L121-132; no else-branch / warn / log)
- concepts.invariants.fail-fast-blank-fields ← NotificationConfiguration.java:39-49,81-83,94-96,110-112,127-129
- concepts.invariants.shared-httpclient ← NotificationConfiguration.java:31-34
- concepts.invariants.smtp-timeouts-unset ← NotificationConfiguration.java:61-69 (Properties bag absent of timeout keys) + WebFetched live-doc (https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform — verified 2026-05-20 status 200)
- concepts.invariants.platform-base-url-fallback ← NotificationConfiguration.java:105
- concepts.invariants.downstream-depth-no-default ← NotificationConfiguration.java:123 (@Value with no fallback) + application.yml:174-175 (default in YAML, not in code)
- dependencies_semantic.requires-config — all keys ← NotificationConfiguration.java:37,43-49,54,57,65-66,75,77,89,91,102,104-105,123 + EmailSenderProperties.java:6-21
- dependencies_semantic.requires-runtime.freemarker ← NotificationConfiguration.java:106 (freemarker.template.Configuration injection)
- dependencies_semantic.requires-runtime.dslcontext ← NotificationConfiguration.java:124 (DSLContext injection)
- dependencies_semantic.requires-runtime.spring-mail ← NotificationConfiguration.java:23-24 (Spring mail imports) + L51 (JavaMailSenderImpl construction)
- tests_coverage_semantic.test_files ← `find <odd-platform-repo> -path '*notification*' -name '*Test*.java'` returns zero matches (verified via Glob)
- docs_link_semantic.inferred_docs[0] ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform (verified 2026-05-20 status 200)
- docs_link_semantic.inferred_docs[1] ← WebFetch https://docs.opendatadiscovery.org/features/active-platform-features/notifications (verified 2026-05-20 status 200)
- docs_link_semantic.doc_drift_findings[0] (uppercase SMTP vs lowercase code) ← WebFetched live-doc Gmail YAML + NotificationConfiguration.java:63
- docs_link_semantic.doc_drift_findings[1] (notification.emails not modelled on EmailSenderProperties) ← NotificationConfiguration.java:104 (@Value) + EmailSenderProperties.java:1-21 (no `notification` sub-class)
- docs_link_semantic.doc_drift_findings[2] (subsystem-on + zero channels silent) ← NotificationConfiguration.java:36-119 + WebFetched live-doc (no explicit warning)
- implicit_adrs.[0] (subsystem-class-level gate) ← NotificationConfiguration.java:27 + ConditionalOnNotifications.java:1-13 + NotificationsFeatureCondition.java:8-13
- implicit_adrs.[1] (channel-key-presence activation) ← NotificationConfiguration.java:37,75,89,102
- implicit_adrs.[2] (shared HttpClient) ← NotificationConfiguration.java:31-34
- implicit_adrs.[3] (sender-is-the-smallest-surface email gate) ← NotificationConfiguration.java:37,39-49
- implicit_adrs.[4] (protocol branch) ← NotificationConfiguration.java:63-69
- implicit_adrs.[5] (platform-base-url default) ← NotificationConfiguration.java:105
- bugs_limitations_corner_cases.[0] (protocol case-sensitivity) ← NotificationConfiguration.java:63 + WebFetched live-doc Gmail example
- bugs_limitations_corner_cases.[1] (downstream-depth missing default) ← NotificationConfiguration.java:123 + application.yml:174-175
- bugs_limitations_corner_cases.[2] (translator unconditional within subsystem) ← NotificationConfiguration.java:121-132
- bugs_limitations_corner_cases.[3] (port no validation) ← NotificationConfiguration.java:54 + EmailSenderProperties.java:11
- bugs_limitations_corner_cases.[4] (SMTP timeouts unset) ← NotificationConfiguration.java:61-69 + WebFetched live-doc
- bugs_limitations_corner_cases.[5] (STARTTLS-only) ← NotificationConfiguration.java:61-69 + EmailSenderProperties.java:14-19 + WebFetched live-doc
- bugs_limitations_corner_cases.[6] (no custom-CA trust) ← NotificationConfiguration.java:61-69 + WebFetched live-doc
- bugs_limitations_corner_cases.[7] (boxed Boolean smtp fields) ← NotificationConfiguration.java:65-66 + EmailSenderProperties.java:18-19
- bugs_limitations_corner_cases.[8] (recipient parsing) ← NotificationConfiguration.java:118
- bugs_limitations_corner_cases.[9] (URI scheme allowlist absent) ← NotificationConfiguration.java:77,81-83,91,94-96
- bugs_limitations_corner_cases.[10] (URL length / host validation) ← NotificationConfiguration.java:77,91
- bugs_limitations_corner_cases.[11] (platform-base-url localhost fallback) ← NotificationConfiguration.java:76-86,105 + WebFetched live-doc 'What an outbound notification carries'
- security.auth_mode_relevance ← NotificationConfiguration.java:27
- security.ingestion_filter_relevance ← NotificationConfiguration.java:1-133 (no `/ingestion` references in this file)
- security.owner_scoping ← NotificationConfiguration.java:76-86,88-99,101-119 (single-URL / single-list per channel)
- security.data_exposure ← NotificationConfiguration.java:57-58,77,91 + EmailSenderProperties.java:7
- security.known_security_gaps.[0] (URI scheme allowlist) ← NotificationConfiguration.java:77,91
- security.known_security_gaps.[1] (password masking) ← NotificationConfiguration.java:57-58 + EmailSenderProperties.java:7
- security.known_security_gaps.[2] (slack URL masking) ← NotificationConfiguration.java:77
- security.known_security_gaps.[3] (SSRF guard) ← NotificationConfiguration.java:75-86,88-99
- security.known_security_gaps.[4] (no fan-out scoping) ← NotificationConfiguration.java:76-86,101-119
- performance.hot_paths ← NotificationConfiguration.java:1-133 (boot-time only; runtime hot paths are in sibling sidecars)
- performance.resource_allocation.httpclient ← NotificationConfiguration.java:31-34
- performance.resource_allocation.javamail-session ← NotificationConfiguration.java:36-72
- performance.scaling_characteristics ← NotificationConfiguration.java:76-86 (single URL bean per channel)
- performance.known_performance_gaps.[0] (HttpClient no knobs) ← NotificationConfiguration.java:32
- performance.known_performance_gaps.[1] (JavaMail timeouts unset) ← NotificationConfiguration.java:61-69 + WebFetched live-doc
- performance.known_performance_gaps.[2] (shared HttpClient + serial fan-out coupling) ← NotificationConfiguration.java:31-99
- performance.known_performance_gaps.[3] (translator constructed unconditionally) ← NotificationConfiguration.java:121-132

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

(none — net-new sidecar for NotificationConfiguration, the bean factory wiring side of the
notification subsystem. Cross-references the existing NotificationsProperties and
EmailSenderProperties sidecars; deliberately does not duplicate runtime-hot-path analysis
already captured on those siblings. Findings unique to THIS file: the protocol case-sensitivity
trap at L63 vs live-doc Gmail example (HIGH severity, candidate doc-drift), the missing default
on `notifications.message.downstream-entities-depth` at L123, the translator-unconditional-within-
subsystem observation, and the platform-base-url consumption asymmetry between Slack/email beans.
The advisory-lock-id collision risk and the lazy-create-no-drop replication artefacts are
canonicalisation candidates already in the concept catalog — referenced but not re-evidenced here.)
