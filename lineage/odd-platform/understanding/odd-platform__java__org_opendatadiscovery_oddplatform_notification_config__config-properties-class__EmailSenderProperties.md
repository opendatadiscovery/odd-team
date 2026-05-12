---
node_id: "odd-platform java org.opendatadiscovery.oddplatform.notification.config config-properties-class:EmailSenderProperties"
node_kind: config-properties-class
axis: config_prefixes
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.2.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-12-emailsenderproperties
---

# EmailSenderProperties — semantic understanding

## understanding

`EmailSenderProperties` is the `@ConfigurationProperties("notifications.receivers.email")` POJO that carries the SMTP-channel credentials and transport settings for ODD Platform's outbound alert-notification subsystem. It is the **only** typed config surface for the email channel — six top-level fields (`sender`, `password`, `host`, `port`, `protocol`, `smtp`) plus a nested `SmtpProperties` (`auth`, `starttls`) — consumed by `NotificationConfiguration#mailSender` to construct a Spring `JavaMailSenderImpl`. The recipient list (`notifications.receivers.email.notification.emails`) is NOT modelled on this POJO; it is read via raw `@Value` in `NotificationConfiguration#emailNotificationSender`. The class is `@EnableConfigurationProperties`-registered alongside `NotificationsProperties` and is bean-conditionally activated by `@ConditionalOnNotifications` (gating the whole subsystem) plus `@ConditionalOnProperty("notifications.receivers.email.sender")` (gating the email channel specifically) — if `sender` is unset, the email beans are never created and the channel silently no-ops.

## concepts

- entities: [EmailSenderProperties, SmtpProperties, JavaMailSenderImpl (Spring), MimeMessage (Jakarta Mail), AlertNotificationMessage]
- operations: [SMTP-credential carrier, JavaMail Properties bag population (`mail.transport.protocol`, `mail.smtp.auth`, `mail.smtp.starttls.enable`), boot-time blank-field validation in the consumer]
- invariants: [
    "boot fails fast if `sender` / `host` / `protocol` are blank when the bean is constructed (the consumer throws `IllegalArgumentException`)",
    "the channel only activates when `notifications.receivers.email.sender` is set — bean is `@ConditionalOnProperty`",
    "`password` is optional — when null, `JavaMailSenderImpl.setPassword(...)` is skipped (PLAIN/LOGIN with anonymous binding is permitted)",
    "no JavaMail SMTP timeout (connection / read / write) is configured — defaults are infinite",
    "no TLS-trust / certificate-pinning / cipher / implicit-TLS config is exposed — only STARTTLS toggle",
    "`SmtpProperties.auth` and `SmtpProperties.starttls` are boxed `Boolean` — null is a runtime hazard (see corner-cases)"
  ]
- audiences: [platform operator (configures SMTP relay), alert recipient (inbox owner; receives full alert payload rendered via `email.ftlh`)]

## dependencies_semantic

- requires-feature: ["notifications subsystem must be enabled (`notifications.enabled=true`) — `@ConditionalOnNotifications` wraps the whole `NotificationConfiguration`"]
- requires-config: [
    "notifications.receivers.email.sender (required — IllegalArgumentException on blank; also doubles as `JavaMailSenderImpl.username`)",
    "notifications.receivers.email.host (required — IllegalArgumentException on blank)",
    "notifications.receivers.email.protocol (required — IllegalArgumentException on blank; if equals 'smtp' then `mail.transport.protocol=smtp` + auth/starttls toggles are populated; otherwise the protocol value is passed through to `mail.transport.protocol` unchanged — non-smtp values are accepted silently)",
    "notifications.receivers.email.port (int; defaults to 0 when unset because the field is a primitive — port 0 to JavaMail means 'use the protocol default', i.e. 25 for smtp — opaque to operators)",
    "notifications.receivers.email.password (optional; null permitted — anonymous SMTP path)",
    "notifications.receivers.email.smtp.auth (Boolean; null causes NPE when unboxing for `mail.smtp.auth` if protocol=smtp — see corner-cases)",
    "notifications.receivers.email.smtp.starttls (Boolean; null causes NPE for `mail.smtp.starttls.enable` if protocol=smtp — see corner-cases)",
    "notifications.receivers.email.notification.emails (CSV of recipient addresses; NOT bound to this POJO — consumed via raw `@Value` in `NotificationConfiguration#emailNotificationSender`)",
    "odd.platform-base-url (used to render `https://{host}/dataentities/{id}/alerts` deep links in the email body; default `http://localhost:8080` — leaks dev hostname into outbound mail if unset)"
  ]
- requires-runtime: [
    "Spring `spring-boot-starter-mail` on the classpath (provides `JavaMailSenderImpl`)",
    "Freemarker template `email.ftlh` on the classpath (resolved via the shared `freemarker.template.Configuration` bean)",
    "Reachable SMTP relay on `host:port` — no health-check at boot, only at first send",
    "JVM truststore must trust the SMTP server's certificate when STARTTLS=true (no per-application override exposed)"
  ]

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours: [
    "Boot-time blank-field validation (sender / host / protocol — three `IllegalArgumentException` paths in `NotificationConfiguration#mailSender`)",
    "Null `password` path (anonymous SMTP) — does the `JavaMailSenderImpl` actually authenticate when `mail.smtp.auth=true` but no password? — no test asserts behaviour",
    "Null `SmtpProperties.auth` / `SmtpProperties.starttls` path with protocol=smtp — current code unboxes the Boolean into a `Properties#put(Object, Object)` call (which accepts the boxed value), but downstream JavaMail expects a String — boundary not tested",
    "Non-'smtp' protocol path (e.g. `smtps`, `imap`) — protocol string is passed through to JavaMail unchanged; no test asserts the protocol pass-through works for any protocol other than smtp",
    "Per-recipient silent partial delivery (see `EmailNotificationSender.send` — recipient N+1 never receives if recipient N throws) — zero test coverage of recipient iteration",
    "SMTP connection timeout / read timeout / write timeout — none configured by ODD; behaviour against a hung SMTP server is untested and documented as 'will hang' on the live doc"
  ]
- test_files: []
- gaps: |
    The entire `org.opendatadiscovery.oddplatform.notification` package contains ZERO test classes (verified via grep for test files referencing `EmailSenderProperties` or `notifications.receivers.email` — no matches). For an integration that carries SMTP credentials + STARTTLS toggle + recipient loop + freemarker template rendering, the highest-risk regressions are:
      1. Recipient loop fault tolerance — adding a per-recipient try/catch would change observed behaviour, and there is no regression test to catch the change.
      2. Protocol-string pass-through — an operator setting `protocol: smtps` (uppercase, alternative spelling) hits the `else` branch in `NotificationConfiguration.java:67-69` and is silently passed through; misconfigurations against JavaMail's expected protocol names are not detected.
      3. Boolean unboxing in the SMTP `Properties` bag — `props.put("mail.smtp.auth", emailProperties.getSmtp().getAuth())` puts a `Boolean` object, not a String; JavaMail's documented expectation is a String (`"true"` / `"false"`). Whether JavaMail tolerates boxed `Boolean` keys is undocumented and untested here.
      4. Freemarker template rendering with non-ASCII data-entity names — live doc warns of mangled subjects/bodies; no encoding test covers this.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform"
    anchor: "#enable-alert-notifications"
    rationale: "The `Enable Alert Notifications` section on `configuration-and-deployment/odd-platform` is the canonical configuration page for every `notifications.receivers.email.*` key consumed via this POJO. It documents the keys, an example Gmail SMTP block, and the SMTP-specific caveats (infinite timeouts, STARTTLS-only TLS, no `ssl.trust` override, non-ASCII mangling, silent partial delivery)."
    last_verified_at: "2026-05-12T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      Section: "Enable Alert Notifications"
      Quoted email-config keys (WebFetch 2026-05-12, status 200):
        - `notifications.receivers.email.host` — the SMTP server
        - `notifications.receivers.email.port` — the port for email protocol
        - `notifications.receivers.email.protocol` — email protocol type (SMTP, SMTPS, IMAP, IMAPS, POP3, POP3S)
        - `notifications.receivers.email.smtp.auth` — boolean for SMTP authentication requirement
        - `notifications.receivers.email.smtp.starttls` — boolean to enable STARTTLS
        - `notifications.receivers.email.password` — password for email authentication
        - `notifications.receivers.email.sender` — sender email address
        - `notifications.receivers.email.notification.emails` — list of notification recipients
      Quoted statement: "ODD Platform builds its `JavaMailSender` with only the keys documented above."
      Quoted caveats verbatim:
        - "An unreachable SMTP server will hang notification delivery."
        - "Only STARTTLS is supported — implicit-TLS ports (e.g. Gmail port 465, many corporate relays) will not work."
        - "Self-signed or internal-CA SMTP certificates require a JVM-level workaround." (`mail.smtp.ssl.trust` is not exposed.)
        - "Non-ASCII subjects and bodies may be mangled."
        - "If one recipient fails, subsequent recipients are skipped."
      Live-doc-supplied operator remediation for non-ASCII: set `JAVA_TOOL_OPTIONS=-Dfile.encoding=UTF-8` on the container.
      Example block confirmed: a Gmail SMTP example with `smtp.gmail.com`, port 587, protocol smtp, STARTTLS enabled.
  - url: "https://docs.opendatadiscovery.org/features/active-platform-features/notifications"
    anchor: "#email-smtp"
    rationale: "The feature-level overview page for notifications has an `Email (SMTP)` subsection documenting the channel from the alert-recipient perspective: how email is enabled (`notifications.receivers.email.sender` triggers the bean), recipient list shape, the SMTP-timeout warning, and the silent-partial-delivery danger box."
    last_verified_at: "2026-05-12T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      Heading: "### Email (SMTP)"
      Quoted (WebFetch 2026-05-12, status 200):
        - "Configured by the `notifications.receivers.email.*` family of keys (host, port, protocol, sender, password, recipient list, optional STARTTLS)."
        - Warning box: "SMTP timeouts are unset — an unreachable SMTP server will hang notification delivery."
        - Danger box: "Silent partial delivery if one recipient fails. The sender processes recipients sequentially; if one fails, the loop stops — recipients N+1, N+2, … never receive the alert."
        - Operator guidance: keep recipient lists short and use server-side distribution lists.
- doc_drift_findings:
  - "Recipient list key path: live doc says `notifications.receivers.email.notification.emails` (dotted leaf), which matches the consumer at `NotificationConfiguration.java:104` and the application.yml comment at line 194-195. This is structurally awkward — `notification.emails` is a SUB-prefix under `notifications.receivers.email.notification` rather than a leaf on `notifications.receivers.email`. An operator reading the YAML hierarchy might expect the key to be `notifications.receivers.email.emails` or `notifications.receivers.email.recipients`. Cosmetic but a small UX trap."
  - "`port` defaults to 0 (Java `int` primitive) when unset, because `EmailSenderProperties.port` is `int`, not `Integer`. The live doc does not warn about this; an operator omitting `port` will get JavaMail's protocol-default port behaviour. The behaviour is benign with Gmail SMTP (port 587 is documented), but for self-hosted relays expecting an explicit port it is silently wrong. Candidate live-doc admonition (DOC-NNN follow-up)."
  - "`SmtpProperties.auth` / `SmtpProperties.starttls` are Boolean (boxed) — null is a binding-time legal value. The live doc shows them with values in the Gmail example but never states they are required. If `protocol=smtp` and either field is null, `props.put('mail.smtp.auth', null)` is the result — JavaMail's behaviour on a null property value is unspecified. Candidate live-doc admonition (DOC-NNN follow-up)."

## implicit_adrs

- "Email channel is **off by default and presence-gated** by the single key `notifications.receivers.email.sender` — `@ConditionalOnProperty(name = \"notifications.receivers.email.sender\")` on BOTH the `mailSender` and `emailNotificationSender` beans. There is no separate 'email enabled' toggle; absence of the sender address = no beans = silent no-op for the channel. This mirrors the slack / webhook channel pattern (slack.url, webhook.url) and is a consistent ergonomic choice across the three channels." — evidence: NotificationConfiguration.java:37 + NotificationConfiguration.java:102 — intent_anchor: "`@ConditionalOnProperty(name = \"notifications.receivers.email.sender\")`" — confidence: HIGH

- "Boot **fails fast** on blank required fields. The consumer throws `IllegalArgumentException` for blank `sender` / `host` / `protocol` at bean-construction time, encoding 'half-configured email = no boot' rather than 'half-configured email = runtime failures.' This is a deliberate fail-closed stance applied uniformly to the three string-required fields (sender / host / protocol) but NOT to `password` (null permitted) or `port` (defaults to 0 via int primitive) or the `SmtpProperties` Booleans (null permitted)." — evidence: NotificationConfiguration.java:39-49 — intent_anchor: "`if (StringUtils.isBlank(...)) { throw new IllegalArgumentException(\"... is empty\"); }`" — confidence: HIGH

- "Protocol is a **string pass-through** for non-smtp values: the `if (protocol.equals(\"smtp\"))` branch populates the SMTP-specific JavaMail properties; the `else` branch simply forwards the protocol string to `mail.transport.protocol`. This encodes 'we know SMTP, we delegate everything else to JavaMail' — a minimal, deliberate scope-of-support stance. Operators using `smtps`, `imap`, etc. inherit JavaMail defaults end-to-end." — evidence: NotificationConfiguration.java:63-69 — intent_anchor: "`if (emailProperties.getProtocol().equals(\"smtp\")) { ... } else { props.put(\"mail.transport.protocol\", emailProperties.getProtocol()); }`" — confidence: MEDIUM (the asymmetry is clear evidence; whether the maintainers intend the else-branch to be a supported path or a we-tolerate-this-but-do-not-test-it path is ambiguous from the code alone)

## bugs_limitations_corner_cases

- "SMTP timeouts unset — `JavaMailSenderImpl` is constructed with NO `mail.smtp.connectiontimeout`, `mail.smtp.timeout`, or `mail.smtp.writetimeout` in the Properties bag. JavaMail's documented defaults are infinite. A hung SMTP relay blocks the WAL subscriber thread indefinitely, stopping ALL notification delivery (Slack and webhook too — fan-out is sequential on a single thread). The live doc warns operators about this explicitly. This is the same class of bug as LSN-002 (minio-region-unset) and LSN-001 (attachment-ephemeral-default): an SDK builder leaves a critical parameter unset and the default is silently wrong." — evidence: NotificationConfiguration.java:51-71 (no timeout keys populated) + WebFetch live-doc 'Known limitations' — severity: HIGH

- "STARTTLS-only TLS: the only TLS toggle exposed is `notifications.receivers.email.smtp.starttls` (mapped to `mail.smtp.starttls.enable`). The implicit-TLS keys (`mail.smtp.ssl.enable`, `mail.smtps.*` namespace) are never set. Gmail port 465 and many corporate SMTP relays REQUIRE implicit TLS — those will not work with this config surface. The live doc confirms this is a known limitation." — evidence: NotificationConfiguration.java:63-69 (only starttls key populated) + EmailSenderProperties.java:17-20 (only auth + starttls in `SmtpProperties`) — severity: MEDIUM

- "No `mail.smtp.ssl.trust` override exposed. Operators using self-signed or internal-CA SMTP certificates cannot configure the trust store from ODD's YAML — they must add the cert to the JVM's truststore or pass `-Djavax.net.ssl.trustStore=...` at boot. The live doc surfaces this as a known limitation but the config surface offers no remediation." — evidence: EmailSenderProperties.java (no `ssl.trust` field) + NotificationConfiguration.java:51-71 (no ssl.trust key populated) — severity: MEDIUM

- "Password is bound as a plain `String` field with no masking annotation (`@Sensitive`, `@ToString.Exclude` on Lombok's `@Data`-generated `toString`, or similar). Lombok's `@Data` generates `toString()` that includes `password=<value>` — any log line that calls `emailProperties.toString()` (or a logger configured to dump bean state, e.g. via Spring's `EnvironmentEndpoint` text rendering) will surface the password in plaintext. Spring's `/actuator/env` masks keys whose name matches `password` by default, so the actuator path is partially protected — but `EmailSenderProperties.toString()` is not." — evidence: EmailSenderProperties.java:7 (`private String password;`) + EmailSenderProperties.java:5 (`import lombok.Data;`) + EmailSenderProperties.java:6 (`@Data`) — severity: MEDIUM

- "No sender-address validation. `sender` is a free-form String with only a `StringUtils.isBlank` check. `@Email` (Jakarta validation) is not applied; spoofed or malformed sender addresses are accepted silently and only fail at SMTP-send time. Worse, the same field doubles as `JavaMailSenderImpl.username` — if the relay's SMTP-AUTH username is NOT the sender address (a common enterprise pattern), there is no way to express that distinction in ODD config." — evidence: NotificationConfiguration.java:39-41,55 (only blank-check; `mailSender.setUsername(emailProperties.getSender())`) + EmailSenderProperties.java:9 (no `@Email` annotation) — severity: MEDIUM

- "`port` is a Java `int` primitive — defaults to 0 when the YAML key is absent. JavaMail interprets port=0 as 'use the protocol default'. For an operator who intends to set port explicitly but typos the key (`port: 587` vs `port-number: 587`), the symptom is 'mail goes to port 25' with no boot-time warning. There is no `@Min(1) @Max(65535)` validation." — evidence: EmailSenderProperties.java:12 (`private int port;`) — severity: LOW

- "`SmtpProperties.auth` and `SmtpProperties.starttls` are boxed `Boolean` — null is a legal value at binding time. When `protocol=smtp`, the consumer calls `props.put(\"mail.smtp.auth\", emailProperties.getSmtp().getAuth())` and `props.put(\"mail.smtp.starttls.enable\", ...)` — if either field is null, the Properties bag receives a null value (which `Properties#put` actually rejects with NPE, but the call uses `Hashtable#put` via `Properties` inheritance — null-value put throws). The first SMTP send will NPE rather than fail at boot, leaking a misconfiguration past the boot-time validation block." — evidence: EmailSenderProperties.java:18-20 + NotificationConfiguration.java:65-66 — severity: MEDIUM

- "`SmtpProperties.auth` and `SmtpProperties.starttls` values are boxed `Boolean` objects, not the String values JavaMail documents. `Properties#put(\"mail.smtp.auth\", Boolean.TRUE)` is undefined behaviour per JavaMail's documentation (which expects `String` values like `\"true\"` / `\"false\"`). In practice the boxed Boolean's `toString()` is invoked downstream, so it works — but this is implicit-contract-dependent and a JavaMail version bump could break it without an ODD code change." — evidence: NotificationConfiguration.java:65-66 — severity: LOW

- "Recipient list (`notifications.receivers.email.notification.emails`) is NOT modelled on this `@ConfigurationProperties` POJO — it is read via raw `@Value` in `NotificationConfiguration.java:104`. The typed config surface is incomplete vs the actual config-key namespace. An operator inspecting the `EmailSenderProperties` source to understand the email channel will miss the recipient-list key entirely." — evidence: EmailSenderProperties.java (no `notification.emails` field) + NotificationConfiguration.java:104 — severity: LOW

- "Recipient list is comma-split with `notificationEmails.trim().split(\",\")` — no per-address trimming, no `@Email` validation, no deduplication. A leading space (`'a@x.com, b@x.com'`) yields recipients `'a@x.com'` and `' b@x.com'` (with a leading space) — JavaMail will reject the second as an invalid `InternetAddress`, aborting the recipient loop before subsequent emails are sent." — evidence: NotificationConfiguration.java:118 (`List.of(notificationEmails.trim().split(\",\"))`) + EmailNotificationSender.java:54-57 (per-recipient loop with no continue-on-error) — severity: MEDIUM

- "Silent partial delivery in the recipient loop: `EmailNotificationSender#send` iterates `notificationsEmails`, reusing the same `MimeMessage` and calling `helper.setTo(email); emailSender.send(mimeMessage);` per iteration. The outer try/catch wraps the entire loop — any `MessagingException` thrown at recipient N aborts the loop, and recipients N+1, N+2, … never receive the alert. The exception is then re-thrown as `RuntimeException`, which `AlertNotificationMessageProcessor` catches as `NotificationSenderException`... but the original exception is `RuntimeException`, NOT `NotificationSenderException` — so the catch in `AlertNotificationMessageProcessor.java:30` does NOT match, and the `RuntimeException` propagates up to the WAL-decode loop, where the next-message handling may be affected. (Verify the actual processor catch type.)" — evidence: EmailNotificationSender.java:54-60 + AlertNotificationMessageProcessor.java:30 (catch clause type) — severity: HIGH

- "PII surface: the email body is rendered from `email.ftlh` with `dataEntityName`, `dataEntityDataSourceName`, `dataEntityNamespaceName`, `dataEntityType`, `link` (deep link including data-entity id), `alertType`, `alertDescription`, `eventAtTime`. If any of these contain operator-supplied free text (table names with customer identifiers, dataset descriptions with PII), the values are rendered verbatim into the email body — no redaction, no allowlist, no opt-out per channel. For tenants whose dataset names encode customer info, this is a data-exfiltration surface (anyone with mailbox access). Same observation applies to slack and webhook channels (the AlertNotificationMessage payload is the shared source)." — evidence: EmailNotificationSender.java:64-79 (model population) + email.ftlh template — severity: MEDIUM

- "Authentication mechanism is hard-coded to JavaMail's default. ODD exposes only the binary `mail.smtp.auth` toggle; it does NOT expose `mail.smtp.auth.mechanisms`, `mail.smtp.auth.login.disable`, or any modern-auth knob. SMTP-AUTH OAUTH2 (XOAUTH2) is not configurable — operators on Microsoft 365 / Gmail with OAUTH2-only SMTP cannot use this channel. Live doc does not call this out as a limitation." — evidence: EmailSenderProperties.java:18-20 (only `auth` Boolean + `starttls` Boolean) + NotificationConfiguration.java:51-72 (no auth-mechanism keys) — severity: MEDIUM

- "No connection-pool / per-message reuse policy. `JavaMailSenderImpl` opens a new SMTP connection per `.send()` call by default (no `mail.smtp.connectionpoolsize` etc.). For a burst of alerts, each `send()` is a fresh TCP+STARTTLS handshake — latency-amplified and load-amplified on the SMTP relay." — evidence: NotificationConfiguration.java:51-71 (no connection-pool keys) — severity: LOW

- "No `Reply-To`, `Cc`, `Bcc`, custom headers, or DKIM-signing surface. Operators wanting to set `Reply-To: alerts@team.example.com` so that recipients can reply to the team rather than the bot sender cannot configure this. The freemarker template controls body only; the headers are controlled by `MimeMessageHelper.setTo()` / `setSubject()` and nothing else." — evidence: EmailNotificationSender.java:51,55 (only `setSubject` and `setTo` called) — severity: LOW

## security

- **auth_mode_relevance**: `INTERNAL_ONLY` — `EmailSenderProperties` is a config-binding POJO, not an HTTP surface. ODD's auth mode (DISABLED / LOGIN_FORM / OAUTH2 / LDAP / S2S) does not gate this code directly. However, the email channel's outbound recipient list is independent of ODD's authentication model: any address in `notifications.receivers.email.notification.emails` receives every alert regardless of whether the recipient is an ODD user, an ODD owner, or completely external. The aggregated picture is owner-routing-bypass — surfaced on `NotificationsProperties`.

- **ingestion_filter_relevance**: `NO — outbound subsystem, not on the /ingestion/entities path`. The email sender never reaches the `IngestionDataEntitiesFilter`; it consumes from `ALERT` rows via the WAL replication stream.

- **authorization_assertions**: [] — config POJO; no `@PreAuthorize` applicable.

- **owner_scoping**: `BYPASSES — recipient list is a flat global CSV`. There is no mapping from data-entity owner → email recipient subset. Every configured recipient receives every alert event, regardless of which Owner / Role / Permission would have been entitled to the underlying data entity in the UI. — evidence: `notifications.receivers.email.notification.emails` consumed once at boot in `NotificationConfiguration.java:104` as a single `List<String>` passed to the constructor of a singleton `EmailNotificationSender`.

- **data_exposure**: [
    "Full alert payload rendered via `email.ftlh` → any party with access to ANY of the configured email mailboxes, regardless of ODD authentication mode. Variables exposed: dataEntityId, dataEntityName, dataEntityDataSourceName, dataEntityNamespaceName, dataEntityType, alertType, alertDescription, eventAtTime, and a deep-link URL containing the data-entity id. — evidence: EmailNotificationSender.java:64-79 + email.ftlh template",
    "Deep-link URL leaks `odd.platform-base-url` (default `http://localhost:8080`) — if the operator forgets to set `odd.platform-base-url` in production, every alert email contains `http://localhost:8080/dataentities/{id}/alerts` as the actionable link — neither a security issue nor a privacy issue, but a deployment-correctness issue with security-adjacent implications (operators may not realise the deep-link is broken because the email body still 'looks complete'). — evidence: NotificationConfiguration.java:105 + EmailNotificationSender.java:66-67",
    "SMTP password → bound as plain `String` on `EmailSenderProperties.password`. Lombok `@Data` includes the field in the generated `toString()` — any log statement that calls `emailProperties.toString()` (or any debugger inspection dumped to log) exposes the password verbatim. Spring's `/actuator/env` masks keys named `password` by default, so the actuator path is partially mitigated, but the in-process toString path is not. — evidence: EmailSenderProperties.java:6-10",
    "Sender address (`notifications.receivers.email.sender`) is also the SMTP-AUTH username. If the relay's username is sensitive (e.g. a service-account email distinct from the From address), it leaks via the same toString surface AND it forces operators into the awkward 'use the service-account email as the From' pattern."
  ]

- **known_security_gaps**: [
    "SMTP password is included in the Lombok `@Data`-generated `toString()` — no `@ToString.Exclude` annotation. — evidence: EmailSenderProperties.java:6-10 — severity: MEDIUM",
    "No mailbox-to-owner mapping — every recipient gets every alert; cross-team or multi-tenant deployments cannot scope email recipients by data-entity owner. — evidence: NotificationConfiguration.java:104 (flat CSV consumed as a single global list) — severity: MEDIUM",
    "Sender address has no `@Email` validation and no spoofing prevention — a misconfigured `sender` is accepted silently and only fails at SMTP-send time. — evidence: EmailSenderProperties.java:9 + NotificationConfiguration.java:39-41 — severity: LOW",
    "No `mail.smtp.ssl.trust` override exposed — operators on internal-CA SMTP relays cannot configure trust without a JVM-level workaround; the JVM-truststore manipulation is operator-side, not ODD-side. — evidence: live-doc quote + NotificationConfiguration.java:51-71 — severity: MEDIUM",
    "STARTTLS-only TLS — implicit-TLS-required SMTP relays (Gmail port 465, many corporate relays) cannot be used. — evidence: NotificationConfiguration.java:63-69 (only starttls key populated, no `mail.smtp.ssl.enable`) — severity: MEDIUM",
    "Modern SMTP-AUTH mechanisms (XOAUTH2, OAUTH2) are NOT supported — only PLAIN / LOGIN via `mail.smtp.auth=true`. Microsoft 365 and Gmail tenants with OAUTH2-only SMTP cannot use this channel. — evidence: EmailSenderProperties.java:18-20 (only binary `auth` toggle) + NotificationConfiguration.java:51-72 (no auth-mechanism keys) — severity: MEDIUM",
    "Recipient-list comma-split with no per-address trim — a list with whitespace yields invalid `InternetAddress` entries, aborting the loop early. — evidence: NotificationConfiguration.java:118 + EmailNotificationSender.java:54-57 — severity: LOW"
  ]

## performance

- **hot_paths**: [
    "`EmailNotificationSender#send` runs synchronously on the WAL-subscriber thread, once per `AlertNotificationMessage`. The body renders via freemarker (template parse + variable substitution), and a NEW SMTP connection + STARTTLS handshake fires per recipient (because `JavaMailSenderImpl` does not pool by default). End-to-end latency for an alert with N recipients ≈ freemarker render + N × (TCP + STARTTLS + SMTP HELO/AUTH/MAIL/RCPT/DATA). — evidence: EmailNotificationSender.java:45-61 + NotificationConfiguration.java:51-72 (no `mail.smtp.connectionpoolsize` etc.)"
  ]
- **throughput_characteristics**: [
    "Single sender bean per JVM, single WAL subscriber thread per cluster (leader-elected) — email throughput is bounded by SMTP round-trip latency × recipient count, sequentially.",
    "No batching: each alert produces N independent SMTP transactions (one per recipient).",
    "Same `MimeMessage` instance is reused across recipients in the loop — minor allocation savings, but the reuse means a `setTo` mutation on a single MimeMessage drives each send (not a problem in Jakarta Mail, but unusual)."
  ]
- **resource_allocation**: [
    "Freemarker `Configuration` is a shared Spring bean — template cache is warm after first send.",
    "No connection-pool sizing for SMTP — `mail.smtp.connectionpoolsize` is never set. A burst of alerts produces a burst of TCP handshakes against the relay.",
    "No per-message size limit — `email.ftlh` rendering produces a String of unbounded length (bounded only by the underlying `AlertNotificationMessage` size, which is bounded by `notifications.message.downstream-entities-depth × branching factor × chunks`). Very large alerts can produce large emails.",
    "JavaMail SMTP timeouts are infinite (live-doc-documented). A hung SMTP relay holds the WAL-subscriber thread indefinitely, blocking ALL channels (slack and webhook too — they share the thread). This is the highest-severity performance hazard in the email channel."
  ]
- **scaling_characteristics**: [
    "Bottleneck is the single-thread WAL subscriber (per cluster). Email cannot scale horizontally separately from Slack/webhook because all three channels share the loop. A slow SMTP relay back-pressures the entire notifications subsystem.",
    "No backpressure mechanism — if alerts arrive faster than SMTP can send, the WAL replication slot accumulates pending WAL on the Postgres primary (operator-visible as `pg_replication_slots.confirmed_flush_lsn` falling behind `pg_current_wal_lsn`)."
  ]
- **known_performance_gaps**: [
    "SMTP timeouts unset (live-doc-documented): a hung SMTP relay stalls the entire notifications subsystem indefinitely. — evidence: NotificationConfiguration.java:51-71 (no timeout keys) + WebFetch live-doc 'Known limitations' — severity: HIGH",
    "Per-recipient SMTP handshake (no connection pool): N recipients = N TCP+STARTTLS handshakes per alert. — evidence: NotificationConfiguration.java:51-71 (no `connectionpoolsize`) — severity: MEDIUM",
    "No rate-limit / batching: bursty alerts directly translate into bursts of outbound SMTP transactions. — evidence: EmailNotificationSender.java:54-57 (sequential loop, no throttle) — severity: MEDIUM",
    "No async / non-blocking send: every alert blocks the WAL subscriber thread until all recipients are processed (or one fails). — evidence: EmailNotificationSender.java:45-61 — severity: MEDIUM"
  ]

## sources

- understanding ← odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/config/EmailSenderProperties.java:1-22 + odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/config/NotificationConfiguration.java:28,36-72,101-119
- concepts.entities.EmailSenderProperties ← odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/config/EmailSenderProperties.java:6-15
- concepts.entities.SmtpProperties ← odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/config/EmailSenderProperties.java:17-21
- concepts.entities.JavaMailSenderImpl ← odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/config/NotificationConfiguration.java:24,51
- concepts.entities.MimeMessage ← odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/sender/EmailNotificationSender.java:6,46
- concepts.invariants.fail-fast-on-blank ← odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/config/NotificationConfiguration.java:39-49
- concepts.invariants.channel-presence-gated ← odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/config/NotificationConfiguration.java:37,102
- concepts.invariants.password-optional ← odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/config/NotificationConfiguration.java:57-59
- concepts.invariants.timeouts-unset ← odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/config/NotificationConfiguration.java:51-71 + WebFetch live-doc
- concepts.invariants.starttls-only ← odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/config/EmailSenderProperties.java:17-21 + NotificationConfiguration.java:63-69
- dependencies_semantic.requires-feature ← odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/config/NotificationConfiguration.java:27
- dependencies_semantic.requires-config ← odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/config/EmailSenderProperties.java:6-15 + NotificationConfiguration.java:37-72,101-119 + application.yml:180-195
- dependencies_semantic.requires-runtime.spring-mail ← odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/config/NotificationConfiguration.java:23-24
- dependencies_semantic.requires-runtime.freemarker ← odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/sender/EmailNotificationSender.java:3,24,79
- dependencies_semantic.requires-runtime.smtp-relay ← live doc + NotificationConfiguration.java:53-54
- tests_coverage_semantic.test_files ← grep across odd-platform-api/src/test for `EmailSenderProperties` and `notifications.receivers.email` returns zero matches; find under odd-platform-api/src/test path '*notification*' returns zero files
- docs_link_semantic.inferred_docs[0] ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform (verified 2026-05-12, status 200) — section "Enable Alert Notifications"
- docs_link_semantic.inferred_docs[1] ← WebFetch https://docs.opendatadiscovery.org/features/active-platform-features/notifications (verified 2026-05-12, status 200) — section "Email (SMTP)"
- docs_link_semantic.doc_drift_findings[0] (recipient key path UX) ← NotificationConfiguration.java:104 + application.yml:194-195
- docs_link_semantic.doc_drift_findings[1] (port=0 silent default) ← EmailSenderProperties.java:12
- docs_link_semantic.doc_drift_findings[2] (SmtpProperties Boolean nullability) ← EmailSenderProperties.java:18-20 + NotificationConfiguration.java:65-66
- implicit_adrs.[0] (presence-gated channel) ← NotificationConfiguration.java:37,102
- implicit_adrs.[1] (fail-fast on blank fields) ← NotificationConfiguration.java:39-49
- implicit_adrs.[2] (protocol pass-through) ← NotificationConfiguration.java:63-69
- bugs_limitations_corner_cases.[0] (SMTP timeouts unset) ← NotificationConfiguration.java:51-71 + WebFetch live-doc
- bugs_limitations_corner_cases.[1] (STARTTLS-only) ← EmailSenderProperties.java:17-21 + NotificationConfiguration.java:63-69
- bugs_limitations_corner_cases.[2] (no ssl.trust override) ← EmailSenderProperties.java (absent field) + NotificationConfiguration.java:51-71
- bugs_limitations_corner_cases.[3] (Lombok toString leaks password) ← EmailSenderProperties.java:6-10
- bugs_limitations_corner_cases.[4] (no @Email validation) ← EmailSenderProperties.java:9 + NotificationConfiguration.java:39-41,55
- bugs_limitations_corner_cases.[5] (port=0 primitive default) ← EmailSenderProperties.java:12
- bugs_limitations_corner_cases.[6] (Boolean nullability NPE risk) ← EmailSenderProperties.java:18-20 + NotificationConfiguration.java:65-66
- bugs_limitations_corner_cases.[7] (Boolean as Properties value) ← NotificationConfiguration.java:65-66
- bugs_limitations_corner_cases.[8] (recipient list not in POJO) ← EmailSenderProperties.java (absent) + NotificationConfiguration.java:104
- bugs_limitations_corner_cases.[9] (no per-address trim) ← NotificationConfiguration.java:118 + EmailNotificationSender.java:54-57
- bugs_limitations_corner_cases.[10] (silent partial delivery + RuntimeException re-throw) ← EmailNotificationSender.java:54-60 + AlertNotificationMessageProcessor.java:30
- bugs_limitations_corner_cases.[11] (PII surface) ← EmailNotificationSender.java:64-79 + email.ftlh template
- bugs_limitations_corner_cases.[12] (no OAUTH2 SMTP) ← EmailSenderProperties.java:18-20 + NotificationConfiguration.java:51-72
- bugs_limitations_corner_cases.[13] (no SMTP connection pool) ← NotificationConfiguration.java:51-71
- bugs_limitations_corner_cases.[14] (no Reply-To / Cc / Bcc / DKIM) ← EmailNotificationSender.java:51,55
- security.auth_mode_relevance ← N/A — config POJO
- security.ingestion_filter_relevance ← N/A — outbound subsystem
- security.owner_scoping ← NotificationConfiguration.java:104 (single flat CSV consumed at boot)
- security.data_exposure.[0] (full alert payload) ← EmailNotificationSender.java:64-79 + email.ftlh template
- security.data_exposure.[1] (platform-base-url default leaks localhost) ← NotificationConfiguration.java:105 + EmailNotificationSender.java:66-67
- security.data_exposure.[2] (password in Lombok toString) ← EmailSenderProperties.java:6-10
- security.data_exposure.[3] (sender doubles as SMTP-AUTH username) ← NotificationConfiguration.java:55
- security.known_security_gaps.[0] (password in toString) ← EmailSenderProperties.java:6-10
- security.known_security_gaps.[1] (no owner-to-recipient mapping) ← NotificationConfiguration.java:104
- security.known_security_gaps.[2] (no @Email on sender) ← EmailSenderProperties.java:9 + NotificationConfiguration.java:39-41
- security.known_security_gaps.[3] (no ssl.trust override) ← WebFetch live-doc + NotificationConfiguration.java:51-71
- security.known_security_gaps.[4] (STARTTLS-only) ← NotificationConfiguration.java:63-69
- security.known_security_gaps.[5] (no modern auth) ← EmailSenderProperties.java:18-20 + NotificationConfiguration.java:51-72
- security.known_security_gaps.[6] (no per-address trim) ← NotificationConfiguration.java:118 + EmailNotificationSender.java:54-57
- performance.hot_paths.[0] ← EmailNotificationSender.java:45-61 + NotificationConfiguration.java:51-72
- performance.resource_allocation.smtp-timeouts ← NotificationConfiguration.java:51-71 + WebFetch live-doc
- performance.scaling_characteristics ← EmailNotificationSender.java:45-61 + AlertNotificationMessageProcessor.java:25-36 (single-thread fan-out)
- performance.known_performance_gaps.[0] (timeouts unset) ← NotificationConfiguration.java:51-71 + WebFetch live-doc
- performance.known_performance_gaps.[1] (no connection pool) ← NotificationConfiguration.java:51-71
- performance.known_performance_gaps.[2] (no rate-limit / batching) ← EmailNotificationSender.java:54-57
- performance.known_performance_gaps.[3] (no async) ← EmailNotificationSender.java:45-61

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

(none — net-new sidecar for the email-channel config POJO; paired with NotificationsProperties.md from batch C)
