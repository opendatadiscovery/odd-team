---
node_id: "odd-platform java notification.sender class:EmailNotificationSender"
node_kind: class
axis: notification.sender
extracted_at_commit: 80637ed
enriched_at_commit: 80637ed
extractor_version: 0.1.0
prompt_version: file-analyser/0.2.0
schema_version: 0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-20-emailnotificationsender
---

# EmailNotificationSender — semantic understanding

## understanding

`EmailNotificationSender` is the SMTP-delivery `NotificationSender<AlertNotificationMessage>` implementation in ODD's outbound notification fan-out: per WAL-decoded alert event, it renders the `email.ftlh` Freemarker template with 9 alert variables, sets the message subject and HTML body via Spring's `MimeMessageHelper`, then iterates a constructor-provided recipient list calling `helper.setTo(...)` + `emailSender.send(...)` per recipient on a single re-used `MimeMessage`. The sender extends `AbstractNotificationSender` (inheriting only the HttpClient handle, which is unused for SMTP) and declares its `receiverId()` as the lowercase literal `"email"`. Three load-bearing properties of the file are not local to this class but commit its operator-facing behaviour: (a) all SMTP transport tuning (host/port/protocol/auth/STARTTLS/password) is decided by `NotificationConfiguration#mailSender` and the JavaMailSender bean it produces — this class is purely the alert→message→send glue; (b) exception handling wraps `MessagingException | TemplateException | IOException` as a raw `new RuntimeException(...)` (line 59) which BYPASSES the dispatcher's `catch (NotificationSenderException)` at `AlertNotificationMessageProcessor.java:31` and ABORTS fan-out for that alert across all remaining channels; (c) the per-recipient delivery loop (lines 54-57) re-uses one MimeMessage with mutating `setTo(...)` calls — combined with the parent fan-out's RuntimeException semantics, if recipient N fails the loop aborts AND the per-alert outer try/catch propagates the RuntimeException upstream, terminating fan-out for that alert entirely.

## concepts

- entities: [
    "EmailNotificationSender (this class)",
    "AbstractNotificationSender<AlertNotificationMessage> (parent — holds shared HttpClient, unused here)",
    "JavaMailSender (Spring abstraction — concrete is JavaMailSenderImpl from NotificationConfiguration.java:51)",
    "MimeMessage (jakarta.mail)",
    "MimeMessageHelper (org.springframework.mail.javamail — sets subject, text/html, recipients)",
    "AlertNotificationMessage (input DTO — alert payload from translator)",
    "AlertedDataEntity (record inside AlertNotificationMessage — id/name/dataSourceName/namespaceName/type/owners)",
    "AlertTypeEnum (BACKWARDS_INCOMPATIBLE_SCHEMA / FAILED_DQ_TEST / FAILED_JOB / DISTRIBUTION_ANOMALY)",
    "freemarker.template.Configuration (template resolver — injected from Spring Boot freemarker autoconfig)",
    "email.ftlh (HTML template under src/main/resources/templates/)",
    "NotificationSenderException (declared but NEVER thrown by this class — see RuntimeException bypass)",
    "platformHost (operator-configured `odd.platform-base-url`; default `http://localhost:8080`)",
    "notificationsEmails (List<String> built from comma-split string)"
  ]
- operations: [
    "receiverId() returns literal lowercase `\"email\"` (line 41) — drives the channel-id in NotificationSenderException error wrapping and in log lines emitted by AlertNotificationMessageProcessor.java:27,33",
    "send(AlertNotificationMessage) — template-render + per-recipient SMTP send loop (lines 44-61)",
    "getEmailContent(AlertNotificationMessage) — populates a model HashMap with 9 string values and processes the `email.ftlh` template into a StringWriter (lines 63-82)",
    "getStringValue(String) — null/blank-safe helper returning StringUtils.EMPTY for blank input (lines 84-86) — used on EVERY model field so blank entity attributes render as empty strings rather than NPE",
    "alertUrl construction by string interpolation: `platformHost + ALERT_PATH.replace(\"{dataEntityId}\", ...)` — line 66-67",
    "subject construction: `EMAIL_SUBJECT_TEMPLATE.replace(\"${alertType}\", message.getAlertType().name())` (line 51) — manual string-replace, NOT Freemarker, NOT the template engine"
  ]
- invariants: [
    "Per-recipient delivery is sequential, single-threaded, fail-stop within the inner loop (lines 54-57) — if recipient N's `emailSender.send(mimeMessage)` throws MessagingException, the for-loop never reaches recipient N+1",
    "One MimeMessage instance is REUSED across all recipients (line 46 — single createMimeMessage); each iteration overwrites the `To` header via `helper.setTo(notificationsEmail)` (line 55) — JavaMail's MimeMessageHelper handles the header replacement, but a downstream MimeMessage inspector seeing the message after iteration sees only the LAST `To` set",
    "RuntimeException wraps MessagingException | TemplateException | IOException (lines 58-60) — NOT NotificationSenderException; this is asymmetric to SlackNotificationSender + WebhookNotificationSender which throw via AbstractNotificationSender.sendAndValidate → NotificationSenderException",
    "Subject is set BEFORE body (line 51 then 52) but BOTH inside the try block — a template-rendering failure (line 49 throws IOException / TemplateException) prevents subject set entirely; the RuntimeException then bubbles up before any recipient is contacted",
    "`helper.setText(emailContent, true)` (line 52) — the second arg `true` marks the content as HTML (Spring MimeMessageHelper convention). Plaintext alternative is NOT generated — recipients with HTML-disabled clients see raw HTML markup",
    "The MimeMessageHelper is constructed WITHOUT multipart support and WITHOUT explicit charset (line 47 — `new MimeMessageHelper(mimeMessage)`); defaults are no-multipart, JVM default charset (NOT UTF-8 unless `JAVA_TOOL_OPTIONS=-Dfile.encoding=UTF-8` is set per live-doc charset caveat)",
    "From header is NOT set in this class — it defaults to the JavaMailSender's `setUsername(...)` value (`emailProperties.getSender()` at NotificationConfiguration.java:55). No explicit `helper.setFrom(...)` call",
    "Alert subject template hard-codes the prefix `ODD Platform - ` (line 21) — operator-non-tunable; the only operator-influenced subject portion is the `${alertType}` substitution which renders the AlertTypeEnum's name() (uppercase enum constant, NOT the human-readable description)",
    "Recipient list is bound at construction time (line 36) — not refreshed per-message, not re-read from config. Operator changes to `notifications.receivers.email.notification.emails` require a Spring context restart to take effect",
    "Constructor accepts HttpClient (line 27) to satisfy the parent class — HttpClient is NEVER used for SMTP delivery; the field is dead-wired through AbstractNotificationSender for symmetry with Slack/Webhook senders"
  ]
- audiences: [
    "notification-recipient (each email inbox in `notifications.receivers.email.notification.emails`)",
    "platform-operator (configures the recipient list + sender identity)",
    "spring-container (bean lifecycle — constructed via NotificationConfiguration.java:114)",
    "downstream consumers of NotificationSender<AlertNotificationMessage> (AlertNotificationMessageProcessor as the sole consumer at line 19)"
  ]

## dependencies_semantic

- requires-feature: [
    "Notifications subsystem enabled — `notifications.enabled=true` (sibling NotificationConfiguration sidecar invariant 1)",
    "Email channel enabled — `notifications.receivers.email.sender` present + non-blank (NotificationConfiguration.java:37,102 conditional)",
    "JavaMailSender bean — produced by NotificationConfiguration#mailSender (file:line:36-72) — depends on Spring Boot `spring-boot-starter-mail` autoconfig",
    "freemarker.template.Configuration bean — autoconfigured by Spring Boot's `org.springframework.boot.autoconfigure.freemarker` starter; this class assumes it picks up the `templates/` classpath root",
    "Alert feature must produce AlertNotificationMessage payloads — via the WAL subscriber + AlertNotificationMessageTranslator pipeline"
  ]
- requires-config: [
    "notifications.receivers.email.sender — sender email address; used by Spring's JavaMailSenderImpl.setUsername (NotificationConfiguration.java:55) AND becomes the de-facto From-header on the outgoing message (JavaMail default behaviour when no explicit setFrom)",
    "notifications.receivers.email.notification.emails — comma-separated recipient list; consumed by NotificationConfiguration.java:104 via @Value, parsed at L118 (`notificationEmails.trim().split(\",\")`), passed into this constructor as parameter `notificationsEmails`",
    "odd.platform-base-url — passed into constructor as `platformHost`; default fallback `http://localhost:8080` is provided by the @Value at NotificationConfiguration.java:105 (NOT in this class); used to build the click-through link `platformHost + /dataentities/{id}/alerts` at line 66-67",
    "Indirectly: notifications.receivers.email.host / .port / .protocol / .smtp.auth / .smtp.starttls / .password — consumed by the JavaMailSender bean factory at NotificationConfiguration.java:51-72; this class delegates all SMTP transport behaviour to the JavaMailSender it receives"
  ]
- requires-runtime: [
    "Classpath `templates/email.ftlh` (Freemarker HTML template — verified present at odd-platform-api/src/main/resources/templates/email.ftlh:1-46)",
    "Working SMTP relay reachable at `notifications.receivers.email.host:port` — no per-recipient DNS resolution caching, no SMTP connection pool configured in JavaMailSenderImpl by default",
    "JVM default charset OR `JAVA_TOOL_OPTIONS=-Dfile.encoding=UTF-8` if alert payloads carry non-ASCII characters (per live-doc charset caveat)"
  ]

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours: [
    "send() with empty `notificationsEmails` list — for-loop iterates zero times; no email sent, no exception; verifies the empty-recipient-list silent-no-op shape",
    "send() with single recipient — happy-path subject + HTML body delivery; verifies template rendering wires through MimeMessageHelper correctly",
    "send() with multiple recipients — verifies the per-recipient mutation-of-shared-MimeMessage pattern correctly delivers N copies",
    "send() recipient N fails — MessagingException at line 56 raised by JavaMailSender.send — for-loop aborts at N, recipients N+1..M skipped, RuntimeException propagated upward, fan-out aborts across all OTHER channels (the load-bearing asymmetry)",
    "send() Freemarker template rendering failure (e.g. corrupted email.ftlh, missing variable) — IOException | TemplateException at line 79, RuntimeException propagated upward BEFORE any recipient contacted, fan-out aborts for that alert",
    "send() with a recipient containing a malformed address (e.g. empty string from `'a@b.com,'` parsing) — AddressException via MimeMessageHelper.setTo on the empty entry; same fail-stop pattern",
    "getEmailContent() with AlertedDataEntity missing optional fields (dataSourceName=null, namespaceName=null) — verifies getStringValue() empty-string substitution; verifies no NPE on .name()/.dataSourceName() calls",
    "getEmailContent() with each of the 4 AlertTypeEnum values — verifies subject substitution renders the enum name() (uppercase) and the alertType/alertDescription model fields populate correctly",
    "Alert URL construction with platformHost containing a trailing slash vs no slash — verifies the line 66 concatenation does not double-slash or drop-slash (no normalisation in this code)",
    "Subject Template Injection — what happens if AlertTypeEnum.name() contained `${...}` text? (impossible per current enum constants, but a future enum addition could break the manual string-replace)",
    "HTML escaping in template — what if dataEntityName contained `<script>...</script>`? (Freemarker's default escaping behaviour for `${...}` in a `.ftlh` template is auto-escape ON, but no test asserts this for THIS template — see bugs_limitations_corner_cases)",
    "Constructor with null notificationsEmails — NPE on for-loop iteration; no defensive null-check at L36",
    "receiverId() returns lowercase `\"email\"` — pinning the contract (used in NotificationSenderException message formatting at NotificationSenderException.java:26)"
  ]
- test_files: []
- gaps: |
    The entire `odd-platform-api/src/main/java/.../notification` package has ZERO test files
    (verified via `find <odd-platform-repo> -path '*notification*' -name '*Test*.java'` — no matches).
    Most regression-prone behaviours specific to THIS file:

    1. **The RuntimeException-vs-NotificationSenderException asymmetry** — F-009.yaml flags this as
       drift facet `exception_type_asymmetry_across_senders`. A test that drops a malformed
       template OR a closed SMTP connection through the dispatcher + asserts subsequent senders
       still fire would pin the contract. Without such a test, a future refactor that "fixes"
       the asymmetry could silently regress the fan-out abort semantics that the F-009 chain
       depends on.

    2. **Per-recipient fail-stop loop** — the live doc explicitly warns about silent partial
       delivery: "If recipient N fails ... the loop stops — recipients N+1, N+2, … never receive
       the alert. There is no retry and no partial-failure metric." No test asserts this — a
       refactor that adds a per-recipient try/catch (to deliver to remaining recipients) would
       silently change operator-facing behaviour with no test failure.

    3. **MimeMessage reuse mutation pattern** — the same MimeMessage instance is reused across
       recipients with `setTo(...)` mutating the To header. A future change to MimeMessageHelper
       (e.g. switching to `setBcc` or a List<String> setTo) could silently change the recipient
       envelope semantics; no test pins the per-recipient envelope shape.

    4. **HTML-only body (no plaintext alternative)** — `helper.setText(emailContent, true)`
       declares HTML; no `setText(plaintext, html)` overload usage. An accessibility audit or
       a mail client that prefers plaintext receives raw HTML markup. No test pins the body
       format.

    5. **getStringValue() blank-safety** — used on EVERY model field but the function itself is
       unverified. If a future refactor inlines it differently (e.g. replaces with
       `Optional.ofNullable(...).orElse("")`), the StringUtils.EMPTY contract is broken with
       no test failure. Lightweight unit test of getStringValue would pin the contract.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/active-platform-features/notifications"
    anchor: ""
    rationale: "The feature-level overview of the three outbound channels names the email channel and its caveats verbatim (silent partial delivery, STARTTLS only, SMTP timeouts unset, custom-CA workaround, charset). The user-observable promise — 'An alert dispatched to multiple channels is delivered to every channel that is enabled' — frames the contract this class implements one side of."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      WebFetch 2026-05-20, status 200. Quoted from the Email (SMTP) Channel section:

      Configuration keys named: host, port, protocol, sender, password, recipient
      list, optional STARTTLS support — matches the field set this class consumes
      via the JavaMailSender bean.

      Email payload contents (4 bullets, live doc):
        1. Entity name and its data source/namespace
        2. Attached owners
        3. Downstream entities (within configurable depth, default 1 level)
        4. Clickable links back to the platform UI (using `odd.platform-base-url`)
      Matches the model HashMap populated at lines 69-77 of THIS file (entity id /
      name / dataSourceName / namespaceName / type / alertUrl / alertType /
      alertDescription / eventAtTime) — but NOTE: the doc says "owners" is in the
      payload; THIS file's template model does NOT include owners (the 9 model.put
      calls at lines 69-77 cover everything EXCEPT owners). The downstream entities
      are computed by the translator but ARE NOT in the template either. See
      doc_drift_findings.

      Critical caveat (timeouts): "SMTP timeouts are unset — an unreachable SMTP
      server will hang notification delivery." — code-side primary source is at
      NotificationConfiguration.java:61-69 (Properties bag absent of timeout keys);
      THIS file does not address timeouts directly.

      Critical caveat (silent partial delivery): "If any recipient fails, 'the loop
      stops — recipients N+1, N+2, … never receive the alert.' No retry mechanism
      or partial-failure metrics exist. The recommendation is to keep recipient
      lists short and use distribution lists on the SMTP side for fan-out."
      — code-side primary source is EmailNotificationSender.java:54-60 of THIS
      file (the for-loop + catch block).

  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform"
    anchor: "#enable-alert-notifications"
    rationale: "The operator-side configuration reference lists every `notifications.receivers.email.*` key the JavaMailSender bean consumes, plus the Gmail example showing `protocol: SMTP` (uppercase). Although THIS class does not consume the protocol key directly (it receives the already-configured JavaMailSender), the case-sensitivity trap at NotificationConfiguration.java:63 affects the SMTP transport this class delegates to."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      WebFetch 2026-05-20, status 200. Quoted hints:

      Email keys: host, port, protocol (e.g., SMTP, SMTPS, IMAP, IMAPS, POP3, POP3S),
      smtp.auth, smtp.starttls, password, sender, notification.emails — matches
      the JavaMailSender bean factory at NotificationConfiguration.java:38-72 that
      produces the bean injected here as `emailSender`.

      Gmail example YAML uses `protocol: SMTP` (uppercase) — sibling sidecar
      records this as drift versus the lowercase case-sensitive check at
      NotificationConfiguration.java:63.

      Caveat — silent partial delivery (paraphrased from live doc): "If recipient
      N fails (bad address, mailbox full, server-side policy rejection), the
      exception is wrapped as a RuntimeException and the loop terminates" —
      code-side primary source is at EmailNotificationSender.java:54-60.

      Caveat — STARTTLS only: "ODD Platform exposes
      notifications.receivers.email.smtp.starttls but does not expose
      mail.smtp.ssl.enable" — confirmed at NotificationConfiguration.java:61-69
      (Properties bag does not surface implicit-TLS).

      Caveat — self-signed certificates: no in-platform path to trust custom CAs —
      operator must modify JVM truststore. THIS class delegates entirely to
      JavaMailSender so the workaround applies at the JVM level, not at this code
      level.

      Caveat — non-ASCII charset: requires `JAVA_TOOL_OPTIONS=-Dfile.encoding=UTF-8`.
      MATCHES THIS file's MimeMessageHelper construction at line 47 (no charset
      argument passed — JVM default applies).

- doc_drift_findings:
  - "Live doc says outbound email payload includes 'Attached owners' (live-doc bullet 2 of 4). THIS class's template model (`getEmailContent` at lines 64-78) populates NINE fields — dataEntityId, dataEntityName, dataEntityDataSourceName, dataEntityNamespaceName, dataEntityType, link, alertType, alertDescription, eventAtTime — NONE of which carries owners. Inspection of `email.ftlh` (verified at templates/email.ftlh:34-44) confirms the template renders the alerted entity attributes + alert type + event time only; there is no `<#list owners as o>` block, no `${owners}` reference. The AlertedDataEntity record DOES carry `Set<OwnershipPair> owners` (AlertNotificationMessage.java:36) but it is never threaded into the email template model. The live doc OVERPROMISES the email channel's payload. Slack channel (sibling SlackNotificationSender + SlackMessageGenerator) may include owners — operator reading the live doc reasonably assumes parity but the parity does not hold for email."
  - "Live doc says outbound email payload includes 'Downstream entities (within configurable depth, default 1 level)' (live-doc bullet 3 of 4). THIS class's template model contains NO downstream block; AlertNotificationMessage.downstream (the List<AlertedDataEntity> at AlertNotificationMessage.java:30) is computed by the translator (`notifications.message.downstream-entities-depth` knob) but NEVER read by this file's getEmailContent method. The email channel ignores the downstream list entirely. Verified against `email.ftlh:1-46` which has no `<#list downstream as d>` block. Operator copying the live-doc framing into runbooks ('email includes downstream entities to default depth 1') is misled — Slack/webhook may carry it, email does not."
  - "Live doc / `application.yml:174-175` describes the recipient list configuration as `notifications.receivers.email.notification.emails: \"yourFirst@gmail.com,yourSecond@gmail.com\"`. THIS class receives the parsed `List<String>` from `notificationEmails.trim().split(\",\")` (NotificationConfiguration.java:118) but no per-element trim is performed — recipient ` b@c.com` retains the leading space. JavaMail's address parser may accept this, but operators reading the doc 'comma-separated' may not realise inter-element whitespace is delivered verbatim into the To header."
  - "Live doc framing 'An alert dispatched to multiple channels is delivered to every channel that is enabled' (active-platform-features/notifications page) is contradicted in practice when EMAIL fails: the RuntimeException wrap at line 58-60 propagates past the dispatcher's `catch (NotificationSenderException)` (AlertNotificationMessageProcessor.java:31) and aborts the OUTER fan-out loop — subsequent channels (Slack, Webhook) for the SAME alert are skipped. The live doc does not warn that an email failure aborts the multi-channel delivery for that alert. F-009.yaml drift facet `exception_type_asymmetry_across_senders` captures this; doc-side coverage missing."

## implicit_adrs

- "**Email body is rendered via Freemarker, NOT via Java string concatenation** — the class injects `freemarker.template.Configuration` (line 24) and processes a template `email.ftlh` (line 79) rather than building HTML inline. This encodes a deliberate template-engine boundary: visual changes to the alert email (layout, styling, fields rendered) are operator-non-tunable but maintainer-tunable by editing the `.ftlh` file under `src/main/resources/templates/` without code recompilation in some deployment shapes." — evidence: EmailNotificationSender.java:24,79 + templates/email.ftlh:1-46 — intent_anchor: "`configuration.getTemplate(\"email.ftlh\").process(model, stringWriter);` — using the engine pattern rather than `String.format` / Jakarta-EE templating / Spring's MessageSource" — confidence: HIGH

- "**Per-recipient delivery loop with FAIL-STOP semantics is intentional** — the for-loop at lines 54-57 has NO inner try/catch; the FIRST recipient that throws MessagingException aborts ALL subsequent recipients. The live notifications doc page WebFetched 2026-05-20 explicitly documents this as 'silent partial delivery' with operator guidance ('keep recipient lists short and use distribution lists on the SMTP side for fan-out'). The decision to NOT add a per-recipient try/catch is therefore deliberate — the doc page explains the trade-off + names the workaround." — evidence: EmailNotificationSender.java:54-57 (no inner try/catch) + WebFetched live-doc 'silent partial delivery' caveat — intent_anchor: "Live-doc-published caveat: 'If recipient N fails ... the loop stops — recipients N+1, N+2, … never receive the alert. There is no retry and no partial-failure metric.'" — confidence: HIGH

- "**HTML-only body (no plaintext alternative)** — `helper.setText(emailContent, true)` (line 52) — the boolean `true` signals to MimeMessageHelper that the body is HTML. NO `helper.setText(plaintextAlternative, htmlBody)` overload is used. The template (`email.ftlh`) is HTML-only. The decision encodes 'every recipient mail client is HTML-capable' — true for corporate gmail/outlook, fragile for accessibility tooling or text-only mail clients." — evidence: EmailNotificationSender.java:52 + templates/email.ftlh:1-46 (no `.txt` companion template) — intent_anchor: "`helper.setText(emailContent, true);` — explicit boolean for HTML mode" — confidence: MEDIUM (the choice IS explicit; whether it's a deliberate decision or an oversight isn't documented in a comment)

- "**Same MimeMessage reused across recipients via mutation** — the for-loop creates ONE MimeMessage (line 46) and mutates its To header per iteration (line 55 `helper.setTo(notificationsEmail)`). This encodes a memory-efficiency stance (avoid N MimeMessage allocations + N template renders), but TIES the per-recipient envelope to whatever MimeMessageHelper's `setTo` does internally. Spring's MimeMessageHelper.setTo replaces (rather than appends) — verified by Spring docs (referenced indirectly via the contract that subsequent calls overwrite); this code RELIES on that semantic." — evidence: EmailNotificationSender.java:46-57 — intent_anchor: "Single `createMimeMessage()` outside the loop + mutating `setTo` inside the loop is a deliberate envelope-reuse pattern" — confidence: HIGH

- "**Subject is built by manual string-replace, NOT by Freemarker** — line 51 uses `EMAIL_SUBJECT_TEMPLATE.replace(\"${alertType}\", ...)` (Java's String.replace) rather than running the subject through the Freemarker engine. This avoids the cost of a second template-engine invocation for a single-variable subject, and avoids a separate `email.subject.ftlh` template file. Trade-off: the subject template is hard-coded in the .java file (line 21) rather than living alongside the body template." — evidence: EmailNotificationSender.java:21,51 — intent_anchor: "`EMAIL_SUBJECT_TEMPLATE.replace(\"${alertType}\", message.getAlertType().name());` — explicit String.replace, not configuration.getTemplate(...)" — confidence: MEDIUM (the choice is explicit, but no comment documents why)

- "**ALERT_PATH constant is hard-coded to `/dataentities/{dataEntityId}/alerts`** (line 20) — operator-non-tunable, baked into the class. The link rendered in the email body is always `${platformHost}/dataentities/{id}/alerts`. Decision: the URL scheme of the alert detail page is part of the SPA's routing contract — coupling this constant tightly couples the email body to the SPA route table." — evidence: EmailNotificationSender.java:20,66-67 — intent_anchor: "`private static final String ALERT_PATH = \"/dataentities/{dataEntityId}/alerts\";`" — confidence: MEDIUM (the URL is hard-coded by intent, but there is no comment explaining the routing-table coupling)

## bugs_limitations_corner_cases

- "**RuntimeException wraps MessagingException | TemplateException | IOException — bypasses dispatcher's per-sender catch** (lines 58-60). `AlertNotificationMessageProcessor.java:31` catches only `NotificationSenderException`; the RuntimeException from THIS class propagates upstream, aborting fan-out for ALL subsequent senders for that alert. The other two senders (Slack, Webhook) correctly throw NotificationSenderException via AbstractNotificationSender.sendAndValidate (AbstractNotificationSender.java:23,27). F-009.yaml drift facet `exception_type_asymmetry_across_senders` documents this — this class is the ASYMMETRY's primary source. Recommendation captured: either email should throw NotificationSenderException OR the dispatcher should catch Exception. Live doc does not warn about cross-channel abort on email failure." — evidence: EmailNotificationSender.java:58-60 + AlertNotificationMessageProcessor.java:31 + AbstractNotificationSender.java:23,27 — severity: HIGH

- "**Per-recipient delivery is fail-stop within the alert** — for-loop at lines 54-57 has NO inner try/catch. The FIRST recipient that throws MessagingException aborts ALL subsequent recipients for that alert. Combined with the RuntimeException wrap above, the alert delivery also aborts fan-out across other channels. So a single bad recipient address (e.g. an empty string from `'a@b.com,'` parsing or a defunct mailbox returning a permanent SMTP error) silently breaks delivery to: (a) remaining email recipients; (b) Slack channel; (c) generic webhook. Live-doc-documented behaviour, but the live doc does not connect the dots about cross-channel impact." — evidence: EmailNotificationSender.java:54-60 + AlertNotificationMessageProcessor.java:31 — severity: HIGH

- "**Same MimeMessage instance mutated across recipients** — line 46 creates ONE MimeMessage; lines 54-57 reuse it. The header `To` is overwritten each iteration via `helper.setTo(...)`. Subtle implication: if a downstream code path inspects the MimeMessage AFTER the loop (e.g. for logging, auditing), it sees only the LAST recipient. There is no such inspection in this class, but a future addition (e.g. an audit-log row capturing 'sent to whom') that reads the message post-loop would silently capture only the last recipient. Also: any header set BEFORE the loop (subject, body) persists; any mutation INSIDE the loop other than To would compound across recipients." — evidence: EmailNotificationSender.java:46,55 — severity: LOW

- "**No `helper.setFrom(...)` call — From header derived implicitly from JavaMailSender.setUsername** — line 47-53 uses MimeMessageHelper but never sets From. JavaMail's default behaviour: if From is unset, the message takes the session's `mail.from` property OR the JavaMailSender's username (`emailProperties.getSender()` at NotificationConfiguration.java:55) as the envelope From. Operator-visible result: the From header on outgoing alerts equals the `notifications.receivers.email.sender` value — but this isn't documented in this class nor in the live doc. Spoofing prevention: an attacker with config-write capability could set `sender` to any address; no allowlist, no domain-match, no SPF/DKIM consideration (those are SMTP-relay-side concerns). The code-side risk surface is bounded by config-write capability — but for a multi-team deployment where the same SMTP relay is shared with other ODD instances, this is a misconfiguration trap." — evidence: EmailNotificationSender.java:46-53 (no setFrom) + NotificationConfiguration.java:55 (setUsername is the only place sender flows in) — severity: MEDIUM

- "**HTML-only body — no plaintext alternative** — `helper.setText(emailContent, true)` declares HTML. No `setText(plain, html)` 2-arg overload is used. Recipients on text-only mail clients OR accessibility tools that prefer plaintext OR mail clients that aggressively strip HTML for security receive raw HTML markup. Live doc does not warn about HTML-only delivery." — evidence: EmailNotificationSender.java:52 + templates/email.ftlh:1-46 (HTML only, no `.txt` companion) — severity: LOW

- "**MimeMessageHelper construction does NOT specify charset** — line 47 `new MimeMessageHelper(mimeMessage)` (1-arg constructor) defaults to the JVM default charset. Spring's MimeMessageHelper offers a 2-arg `(mimeMessage, encoding)` and 3-arg constructors that take an encoding string; neither is used. Result: a JVM started without `-Dfile.encoding=UTF-8` (e.g. a containerised deployment that did not set `JAVA_TOOL_OPTIONS`) renders non-ASCII alert content (e.g. data entity names with international characters) in whatever the platform default charset is — usually US-ASCII on minimal Linux containers, mangling the body. Live doc captures the JAVA_TOOL_OPTIONS workaround but does not point at this code line as the origin." — evidence: EmailNotificationSender.java:47 (1-arg constructor) + WebFetched live-doc — severity: MEDIUM

- "**Subject template is hard-coded in Java string literal** (`ODD Platform - ${alertType} Alert` at line 21) — operator-non-tunable. Operator can override the body via `email.ftlh` (template under classpath), but NOT the subject. A future internationalisation effort would have to touch this constant in code." — evidence: EmailNotificationSender.java:21,51 — severity: LOW

- "**Recipient list bound at construction, NOT refreshed per-message** — `this.notificationsEmails = notificationsEmails;` at line 36. The list is the value passed by NotificationConfiguration#emailNotificationSender (file:line:118) at bean-construction time. Operator changes to `notifications.receivers.email.notification.emails` require Spring context restart to take effect. Spring Boot's `@ConfigurationProperties` rebind (e.g. via Actuator's `/actuator/refresh`) does not cover this code path because the value is passed by `@Value` resolution into the bean constructor, not via a `@ConfigurationProperties` POJO that supports refresh." — evidence: EmailNotificationSender.java:36 + NotificationConfiguration.java:104,118 — severity: LOW

- "**Alert URL construction has no slash normalisation** — line 66-67 builds `platformHost + ALERT_PATH.replace(...)` where ALERT_PATH starts with `/`. If operator sets `odd.platform-base-url=https://odd.example.com/` (trailing slash), the URL becomes `https://odd.example.com//dataentities/.../alerts` (double-slash). Most browsers and the SPA's React-Router treat the double-slash as one (and most mail clients normalize the URL), but a strict URL validator or a CDN with path-based caching could surface the discrepancy. No normalisation logic exists in this code." — evidence: EmailNotificationSender.java:20,66-67 — severity: LOW

- "**HTML escaping in `email.ftlh` relies on Freemarker's default for `.ftlh` extension (auto-escape ON)** — Freemarker 2.3+ auto-escapes interpolations in `.ftlh` files. This means `${dataEntityName}` would render `&lt;script&gt;` for an entity name containing `<script>`. The code does NOT explicitly configure the auto-escape behaviour (no `configuration.setAutoEscapingPolicy(...)` call); it relies on the file extension convention. If a future refactor renamed the template to `.ftl` (or migrated to a different template engine), XSS via dataEntityName / dataEntityDataSourceName / dataEntityNamespaceName / alertDescription would become possible (an alert email rendered in a webmail client that executes JS in HTML emails could be exploited). The convention coupling is implicit." — evidence: EmailNotificationSender.java:79 (`configuration.getTemplate(\"email.ftlh\")` — relies on extension) + templates/email.ftlh:1 (the `.ftlh` extension) + Freemarker convention (auto-escape ON for `.ftlh`) — severity: MEDIUM

- "**Constructor accepts HttpClient that is never used** — line 27 receives HttpClient, line 32 calls `super(httpClient)` which stores it in AbstractNotificationSender.httpClient (AbstractNotificationSender.java:14). SMTP delivery does NOT route through HttpClient — JavaMailSender uses java.mail.Session under the hood. The HttpClient is effectively dead code on this code path. A maintainer reading the constructor might assume HttpClient is required for email delivery; it is not. Cleanup candidate (REFACTOR-class observation)." — evidence: EmailNotificationSender.java:27,32 + AbstractNotificationSender.java:14 — severity: LOW

- "**No retry on transient SMTP failures** — JavaMailSender#send blocks until the transport returns (success) or throws MessagingException (failure). There is no exponential back-off, no per-recipient retry, no DLQ. A transient SMTP outage (relay temporarily unreachable, mailbox temporarily over quota) causes immediate per-alert delivery failure. Combined with the RuntimeException bypass above, even a transient failure aborts cross-channel fan-out for that alert. No retry knob, no recovery path." — evidence: EmailNotificationSender.java:54-60 + JavaMailSenderImpl construction at NotificationConfiguration.java:51-72 (no retry configuration) — severity: MEDIUM

- "**Owner-scoping is not enforced — all configured recipients see all alerts regardless of entity ownership**. The `notificationsEmails` list is a single global list bound at bean construction (line 36 + NotificationConfiguration.java:104,118). There is NO per-owner / per-namespace / per-team recipient routing. An alert on an entity owned by Team A is delivered to EVERY address in the global list — including any operator on Team B's distribution list. The AlertedDataEntity record carries `Set<OwnershipPair> owners` (AlertNotificationMessage.java:36) but THIS file never reads `message.getDataEntity().owners()`. F-009.yaml drift facet `pii_passthrough_to_every_channel` covers this at the dispatcher level; THIS file is the email-channel-specific anchor." — evidence: EmailNotificationSender.java:36,54-57 (no owner consultation) + AlertNotificationMessage.java:36 (owners field exists but unused) — severity: MEDIUM

## security

- **auth_mode_relevance**: `INTERNAL_ONLY` — `EmailNotificationSender` is not an HTTP surface; it's a Spring bean constructed by NotificationConfiguration and invoked by AlertNotificationMessageProcessor on WAL-decoded alert events. ODD's `auth.type` (DISABLED / LOGIN_FORM / OAUTH2 / LDAP) does not gate this code. Behaviour shifts on the FEATURE gate `notifications.enabled` + the CHANNEL gate `notifications.receivers.email.sender` (both at NotificationConfiguration.java:27,37,102). — evidence: EmailNotificationSender.java:1-87 (no controller mapping, no @PreAuthorize, no HTTP-surface annotations).

- **ingestion_filter_relevance**: `NO — outbound notification sender, not on the /ingestion path`. The S2S `IngestionDataEntitiesFilter` chain on `POST /ingestion/entities` does not interact with this code. — evidence: EmailNotificationSender.java:1-87 (no `/ingestion/*` references).

- **authorization_assertions**: [] — bean class invoked by a system thread (WAL-subscriber leader-elected), not in a request context with a Spring Security Authentication. No `@PreAuthorize`, no programmatic `permissionService.hasPermission(...)`, no Owner check before delivery.

- **owner_scoping**: `BYPASSES — global recipient list per platform deployment`. The `notificationsEmails` list is bound once at construction time from the operator's `notifications.receivers.email.notification.emails` comma-string (NotificationConfiguration.java:104,118 → this constructor at L36). Every alert is delivered to every recipient regardless of which Owner(s) the alerted data entity belongs to. `AlertedDataEntity.owners` exists (AlertNotificationMessage.java:36) but is never consulted. — evidence: EmailNotificationSender.java:36 (constructor binding) + L54-57 (loop iterates the static list).

- **data_exposure**: [
    "**Alert payload to global recipient list** — every email contains: dataEntityId, dataEntityName, dataEntityDataSourceName, dataEntityNamespaceName, dataEntityType, alertType (uppercase enum), alertDescription (human-readable), eventAtTime, and a deep-link to the ODD UI. Recipients have NO scoping by ownership — see owner_scoping above. The downstream lineage list (AlertNotificationMessage.downstream) is computed by the translator but NOT rendered in the email template (see doc_drift_findings).",
    "**Click-through link reveals platform-base-url** — line 66 embeds `odd.platform-base-url` verbatim into a clickable HTML link. If `odd.platform-base-url` resolves to an internal hostname (e.g. `https://odd.internal.corp.local/`), that hostname is exposed to every email recipient and any mail-aggregation / search system the recipient's mailbox feeds into.",
    "**Subject reveals AlertType verbatim** — the email subject is `ODD Platform - ${alertType} Alert` where alertType is the uppercase enum constant (BACKWARDS_INCOMPATIBLE_SCHEMA / FAILED_DQ_TEST / FAILED_JOB / DISTRIBUTION_ANOMALY). Subject lines are typically visible in mail notifications + lock-screen previews even on encrypted inboxes; the alert type is therefore leaked at a lower confidentiality tier than the body.",
    "**No body redaction hook** — the model HashMap (lines 69-77) is populated directly from `message.getDataEntity().*()` accessors. If the data entity name itself is sensitive (e.g. a customer-table name containing PII like `customers_2024_eu_gdpr_subjects`), the entity name appears verbatim in every recipient's inbox.",
    "**HTML-only body — relies on Freemarker `.ftlh` auto-escape for XSS protection** — a future template rename from `.ftlh` to `.ftl` (or a misconfigured Freemarker autoescape policy) would expose every entity-attribute model field to HTML injection — see bugs_limitations_corner_cases."
  ]

- **known_security_gaps**: [
    "**No owner-scoping at recipient level — every alert delivered to every recipient regardless of data-entity ownership**. — evidence: EmailNotificationSender.java:36,54-57 + AlertNotificationMessage.java:36 (owners unused) — severity: MEDIUM",
    "**No From-header allowlist or domain check** — JavaMailSender's username (=`notifications.receivers.email.sender`) becomes the From; an operator with config-modification capability can set From to any address — including spoofed addresses claiming to be from other services. The SMTP relay (and downstream SPF/DKIM/DMARC) provides the only protection. ODD does not validate the sender field against any allowlist. — evidence: NotificationConfiguration.java:55 (setUsername is the only sender flow) + EmailNotificationSender.java:46-53 (no setFrom) — severity: LOW",
    "**XSS-class risk if `email.ftlh` rename or autoescape disable** — current code relies on Freemarker `.ftlh` convention (auto-escape ON) for entity-name / data-source-name / namespace-name / alert-description fields. A future change to the template extension or Freemarker configuration would expose every model field to HTML injection through entity attributes. — evidence: EmailNotificationSender.java:79 (template name) + templates/email.ftlh:39-44 (every `${...}` interpolation) — severity: MEDIUM (latent — currently mitigated by the `.ftlh` convention, but unstated as a contract)",
    "**Click-through links embed platform-base-url unconditionally** — an internal-only hostname leaks to every recipient mailbox. — evidence: EmailNotificationSender.java:66-67 — severity: LOW",
    "**No SMTP credential masking in this class** — `notifications.receivers.email.password` is consumed at NotificationConfiguration.java:57-58 + flowed into the JavaMailSenderImpl bean (NotificationConfiguration.java:58 `setPassword`). Spring's default `/actuator/env` password-name masking partially mitigates IF actuator is enabled. The password is NOT touched by this file directly. Sibling NotificationConfiguration sidecar covers this. — evidence: EmailNotificationSender.java:1-87 (no password reference here) + NotificationConfiguration.java:57-58 — severity: N/A for THIS file (covered upstream)",
    "**Subject prefix is hard-coded — operator cannot remove `ODD Platform - ` for stealth deployments** — minor disclosure (the platform's identity is in every email's subject). Mitigation candidate: make the subject prefix operator-tunable. — evidence: EmailNotificationSender.java:21 — severity: LOW"
  ]

## performance

- **hot_paths**: [
    "send(AlertNotificationMessage) — invoked once per configured channel per WAL alert event (sibling F-009.yaml). The inner cost decomposes: (a) Freemarker template render — bounded by template size + model HashMap construction (~9 .put calls per alert); (b) per-recipient sequential `emailSender.send(mimeMessage)` — each call opens an SMTP connection per send (no pooling configured in JavaMailSenderImpl default), waits for SMTP relay round-trip, blocks until ack/error. — evidence: EmailNotificationSender.java:44-61 + AlertNotificationMessageProcessor.java:30 (sequential per-channel invocation)",
    "getEmailContent(AlertNotificationMessage) — runs inside send(); template-engine cost + 9 string allocations + 1 StringWriter buffer. Freemarker caches the parsed template internally (configuration.getTemplate fetches from a thread-safe cache). — evidence: EmailNotificationSender.java:63-82"
  ]

- **throughput_characteristics**: [
    "**SINGLE-THREADED per alert** — the dispatcher (AlertNotificationMessageProcessor) iterates senders sequentially (sibling F-009.yaml chain hop-3); this class's `send(...)` is invoked synchronously and must return before the next channel's `send(...)` runs.",
    "**PER-RECIPIENT SEQUENTIAL within send()** — the for-loop at lines 54-57 issues `emailSender.send(mimeMessage)` per recipient sequentially. N recipients = N SMTP round-trips serialised. There is no batch SMTP send (no BCC delivery), no concurrent recipient fan-out.",
    "**ONE SMTP CONNECTION PER SEND** — JavaMailSenderImpl default behaviour: each `.send(MimeMessage)` call opens an SMTP transport, sends, closes. No connection pooling configured (NotificationConfiguration.java:51-72 does not set `mail.smtp.connectionpool*`). For 5 recipients = 5 connect/disconnect cycles.",
    "**NO BATCHING** — even if 10 alerts come in rapid succession, this class processes them one-at-a-time (the dispatcher is per-WAL-event)."
  ]

- **resource_allocation**: [
    "**Per-send allocations**: one MimeMessage + one MimeMessageHelper + one StringWriter + one HashMap (9 entries) + the rendered HTML string. Modest per call.",
    "**Per-recipient SMTP I/O**: each `emailSender.send(...)` opens a TCP/STARTTLS connection (no pooling configured), exchanges SMTP commands, closes. Round-trip latency dominated by SMTP relay distance.",
    "**Template cache**: Freemarker's Configuration object caches parsed templates internally — after the first invocation, `email.ftlh` is in memory until config refresh.",
    "**No bounded recipient list** — operator can configure 1 recipient or 1000; this code paths through every one sequentially."
  ]

- **scaling_characteristics**: [
    "**Stateless within a JVM instance** — but `notificationsEmails` is bound at construction (line 36), so the recipient list is immutable per Spring context. Horizontal scaling of platform instances is not relevant — the WAL subscriber is leader-elected single-thread (sibling NotificationSubscriber); only ONE instance ever invokes this class at a time per cluster.",
    "**No bulkhead between recipients** — slow recipient N blocks recipients N+1..M (sequential loop). Combined with no per-recipient timeout (JavaMail's mail.smtp.timeout is unset — NotificationConfiguration.java:61-69 does not set timeouts; sibling sidecar flags HIGH severity), a slow SMTP relay can block the entire notification thread.",
    "**No bulkhead between channels** — this class's RuntimeException wrap (line 58-60) aborts fan-out for ALL channels for that alert. No `Future`-based isolation, no per-channel executor."
  ]

- **known_performance_gaps**: [
    "**Sequential per-recipient SMTP I/O with no connection pooling** — for N recipients, N independent SMTP connect/STARTTLS/auth/send/disconnect cycles. A platform with `notification.emails: 'a@x.com,b@y.com,c@z.com,d@w.com,e@v.com'` performs 5 SMTP handshakes per alert. For a 100ms-per-connection relay, that's ~500ms minimum per alert just for email; during this time, Slack and Webhook channels are NOT delivered (they queue behind this class in the dispatcher loop). — evidence: EmailNotificationSender.java:54-57 + NotificationConfiguration.java:51-72 (no `mail.smtp.connectionpool*` properties) — severity: MEDIUM",
    "**No SMTP timeouts set — sibling NotificationConfiguration sidecar covers this (HIGH severity)**. This class inherits the timeout-unset behaviour by using the JavaMailSender bean produced upstream. A hung SMTP relay blocks the for-loop indefinitely. — evidence: EmailNotificationSender.java:56 (sender.send) + NotificationConfiguration.java:61-69 (Properties bag absent of timeouts) — severity: HIGH (upstream-rooted)",
    "**No batching / no BCC fan-out** — for a platform with 50 internal recipients, the code performs 50 SMTP sends rather than one SMTP send with 50 BCC recipients. The latter would reduce per-alert SMTP overhead by ~50x. Live doc recommends 'use distribution lists on the SMTP side for fan-out' — the platform code does not offer in-app BCC. — evidence: EmailNotificationSender.java:54-57 + WebFetched live-doc recommendation — severity: MEDIUM",
    "**Freemarker template rendering on every alert** — `email.ftlh` is parsed once and cached, but the model population + processing runs per alert. Modest cost (~milliseconds), but could be measured vs alert burst rates. — evidence: EmailNotificationSender.java:79 — severity: LOW",
    "**Cross-channel coupling via RuntimeException** — sibling concern: a slow / failing email blocks subsequent channels' delivery (Slack, Webhook are NOT separately threaded). — evidence: EmailNotificationSender.java:58-60 + AlertNotificationMessageProcessor.java:25-36 (sequential fan-out) — severity: MEDIUM"
  ]

## sources

- understanding ← odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/sender/EmailNotificationSender.java:1-87 + odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/sender/AbstractNotificationSender.java:1-31 + odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/dto/AlertNotificationMessage.java:22-37 + odd-platform-api/src/main/resources/templates/email.ftlh:1-46 + odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/processor/AlertNotificationMessageProcessor.java:14-37 + odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/config/NotificationConfiguration.java:51-72,101-119
- concepts.entities.EmailNotificationSender ← EmailNotificationSender.java:19
- concepts.entities.AbstractNotificationSender ← EmailNotificationSender.java:19 (`extends`) + AbstractNotificationSender.java:13
- concepts.entities.JavaMailSender ← EmailNotificationSender.java:16,22 + NotificationConfiguration.java:38,51
- concepts.entities.MimeMessage ← EmailNotificationSender.java:5,46
- concepts.entities.MimeMessageHelper ← EmailNotificationSender.java:17,47
- concepts.entities.AlertNotificationMessage ← EmailNotificationSender.java:14 + AlertNotificationMessage.java:22
- concepts.entities.AlertedDataEntity ← AlertNotificationMessage.java:31-37
- concepts.entities.AlertTypeEnum ← EmailNotificationSender.java:51,75,76 + AlertTypeEnum.java:11-15
- concepts.entities.freemarker.template.Configuration ← EmailNotificationSender.java:3,24,79
- concepts.entities.email.ftlh ← EmailNotificationSender.java:79 (`configuration.getTemplate(\"email.ftlh\")`) + templates/email.ftlh:1-46 (the file)
- concepts.entities.NotificationSenderException ← EmailNotificationSender.java:15,45 (in throws clause but never thrown in this class)
- concepts.entities.platformHost ← EmailNotificationSender.java:25,30,35
- concepts.entities.notificationsEmails ← EmailNotificationSender.java:23,31,36
- concepts.operations.receiverId ← EmailNotificationSender.java:39-42
- concepts.operations.send ← EmailNotificationSender.java:44-61
- concepts.operations.getEmailContent ← EmailNotificationSender.java:63-82
- concepts.operations.getStringValue ← EmailNotificationSender.java:84-86
- concepts.operations.alertUrl-construction ← EmailNotificationSender.java:66-67
- concepts.operations.subject-construction ← EmailNotificationSender.java:21,51
- concepts.invariants.per-recipient-fail-stop ← EmailNotificationSender.java:54-57 (no inner try/catch)
- concepts.invariants.MimeMessage-reuse ← EmailNotificationSender.java:46,55
- concepts.invariants.RuntimeException-wrap ← EmailNotificationSender.java:58-60
- concepts.invariants.subject-before-body ← EmailNotificationSender.java:51-52
- concepts.invariants.HTML-only-body ← EmailNotificationSender.java:52 + templates/email.ftlh:1-46
- concepts.invariants.no-explicit-charset ← EmailNotificationSender.java:47 (1-arg MimeMessageHelper constructor)
- concepts.invariants.no-setFrom ← EmailNotificationSender.java:46-53 + NotificationConfiguration.java:55 (the implicit From derivation)
- concepts.invariants.subject-prefix-hardcoded ← EmailNotificationSender.java:21
- concepts.invariants.recipients-bound-at-construction ← EmailNotificationSender.java:23,31,36
- concepts.invariants.HttpClient-unused-for-SMTP ← EmailNotificationSender.java:9,27,32 + AbstractNotificationSender.java:14
- dependencies_semantic.requires-feature.notifications-enabled ← NotificationConfiguration.java:27 + ConditionalOnNotifications.java:1-13 + sibling NotificationConfiguration sidecar
- dependencies_semantic.requires-feature.email-channel-enabled ← NotificationConfiguration.java:37,102 (@ConditionalOnProperty)
- dependencies_semantic.requires-config.email.sender ← NotificationConfiguration.java:55 (`setUsername(emailProperties.getSender())`) + EmailSenderProperties.java:9
- dependencies_semantic.requires-config.email.notification.emails ← NotificationConfiguration.java:104,118
- dependencies_semantic.requires-config.platform-base-url ← NotificationConfiguration.java:105 + EmailNotificationSender.java:30,35,66
- dependencies_semantic.requires-runtime.email.ftlh ← templates/email.ftlh:1-46 (verified file exists at this path)
- tests_coverage_semantic.test_files ← `find <odd-platform-repo> -path '*notification*' -name '*Test*.java'` returns zero matches (Glob verified)
- docs_link_semantic.inferred_docs[0] ← WebFetch https://docs.opendatadiscovery.org/features/active-platform-features/notifications (verified 2026-05-20 status 200)
- docs_link_semantic.inferred_docs[1] ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform (verified 2026-05-20 status 200)
- docs_link_semantic.doc_drift_findings[0] (owners missing from email payload) ← templates/email.ftlh:33-44 (no owners block) + EmailNotificationSender.java:64-78 (no owners.put) + AlertNotificationMessage.java:36 (owners exists) + WebFetched live-doc bullet 2
- docs_link_semantic.doc_drift_findings[1] (downstream missing from email payload) ← templates/email.ftlh:1-46 (no downstream block) + EmailNotificationSender.java:64-78 (no downstream.put) + AlertNotificationMessage.java:30 (downstream exists) + WebFetched live-doc bullet 3
- docs_link_semantic.doc_drift_findings[2] (recipient whitespace trimming) ← NotificationConfiguration.java:118 + EmailNotificationSender.java:36,55 + WebFetched live-doc 'comma-separated' framing
- docs_link_semantic.doc_drift_findings[3] (cross-channel abort on email RuntimeException) ← EmailNotificationSender.java:58-60 + AlertNotificationMessageProcessor.java:31 + WebFetched live-doc 'every channel that is enabled' framing
- implicit_adrs.[0] (Freemarker template) ← EmailNotificationSender.java:24,79 + templates/email.ftlh:1-46
- implicit_adrs.[1] (per-recipient fail-stop) ← EmailNotificationSender.java:54-57 + WebFetched live-doc 'silent partial delivery' caveat
- implicit_adrs.[2] (HTML-only body) ← EmailNotificationSender.java:52 + templates/email.ftlh:1-46
- implicit_adrs.[3] (MimeMessage reuse) ← EmailNotificationSender.java:46-57
- implicit_adrs.[4] (manual subject string-replace) ← EmailNotificationSender.java:21,51
- implicit_adrs.[5] (ALERT_PATH hard-coded) ← EmailNotificationSender.java:20,66-67
- bugs_limitations_corner_cases.[0] (RuntimeException bypass) ← EmailNotificationSender.java:58-60 + AlertNotificationMessageProcessor.java:31 + AbstractNotificationSender.java:23,27
- bugs_limitations_corner_cases.[1] (per-recipient fail-stop) ← EmailNotificationSender.java:54-60
- bugs_limitations_corner_cases.[2] (MimeMessage reuse mutation) ← EmailNotificationSender.java:46,55
- bugs_limitations_corner_cases.[3] (no setFrom) ← EmailNotificationSender.java:46-53 + NotificationConfiguration.java:55
- bugs_limitations_corner_cases.[4] (HTML-only no plaintext) ← EmailNotificationSender.java:52 + templates/email.ftlh:1-46
- bugs_limitations_corner_cases.[5] (no charset on MimeMessageHelper) ← EmailNotificationSender.java:47 + WebFetched live-doc charset caveat
- bugs_limitations_corner_cases.[6] (hardcoded subject template) ← EmailNotificationSender.java:21
- bugs_limitations_corner_cases.[7] (recipients bound at construction) ← EmailNotificationSender.java:36 + NotificationConfiguration.java:104,118
- bugs_limitations_corner_cases.[8] (no URL slash normalisation) ← EmailNotificationSender.java:20,66-67
- bugs_limitations_corner_cases.[9] (HTML escape relies on .ftlh convention) ← EmailNotificationSender.java:79 + templates/email.ftlh:1 (extension)
- bugs_limitations_corner_cases.[10] (HttpClient unused) ← EmailNotificationSender.java:27,32 + AbstractNotificationSender.java:14
- bugs_limitations_corner_cases.[11] (no retry on transient SMTP failures) ← EmailNotificationSender.java:54-60 + NotificationConfiguration.java:51-72
- bugs_limitations_corner_cases.[12] (owner-scoping bypass) ← EmailNotificationSender.java:36,54-57 + AlertNotificationMessage.java:36
- security.auth_mode_relevance ← EmailNotificationSender.java:1-87 (no HTTP-surface annotations)
- security.ingestion_filter_relevance ← EmailNotificationSender.java:1-87 (no /ingestion references)
- security.owner_scoping ← EmailNotificationSender.java:36,54-57 + AlertNotificationMessage.java:36
- security.data_exposure ← EmailNotificationSender.java:51,52,66-77 + templates/email.ftlh:33-44
- security.known_security_gaps.[0] (no owner-scoping) ← EmailNotificationSender.java:36,54-57
- security.known_security_gaps.[1] (no From allowlist) ← EmailNotificationSender.java:46-53 + NotificationConfiguration.java:55
- security.known_security_gaps.[2] (XSS-class latent risk on template rename) ← EmailNotificationSender.java:79 + templates/email.ftlh:39-44
- security.known_security_gaps.[3] (platform-base-url leak in email) ← EmailNotificationSender.java:66-67
- security.known_security_gaps.[4] (subject prefix hard-coded) ← EmailNotificationSender.java:21
- performance.hot_paths ← EmailNotificationSender.java:44-61 + AlertNotificationMessageProcessor.java:30
- performance.throughput_characteristics ← EmailNotificationSender.java:54-57 + NotificationConfiguration.java:51-72 + AlertNotificationMessageProcessor.java:25-36
- performance.resource_allocation ← EmailNotificationSender.java:46-82 + NotificationConfiguration.java:51-72
- performance.scaling_characteristics ← EmailNotificationSender.java:54-60 + NotificationSubscriber sibling reference (single-thread leader-elected)
- performance.known_performance_gaps.[0] (sequential per-recipient SMTP) ← EmailNotificationSender.java:54-57 + NotificationConfiguration.java:51-72
- performance.known_performance_gaps.[1] (no SMTP timeouts — upstream-rooted) ← EmailNotificationSender.java:56 + NotificationConfiguration.java:61-69
- performance.known_performance_gaps.[2] (no batching / BCC) ← EmailNotificationSender.java:54-57 + WebFetched live-doc
- performance.known_performance_gaps.[3] (Freemarker render per alert) ← EmailNotificationSender.java:79
- performance.known_performance_gaps.[4] (cross-channel coupling via RuntimeException) ← EmailNotificationSender.java:58-60 + AlertNotificationMessageProcessor.java:25-36

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

(none — net-new sidecar for EmailNotificationSender, the SMTP-delivery side of the F-009
notification fan-out chain. Corrects the phantom `EmailNotificationReceiver` node naming
per LSN-018's coherence-check requirement — this is the SENDER side (outbound), not a
receiver (the receiver is the operator's mailbox).

Pairs with sibling NotificationConfiguration sidecar (which covers the JavaMailSender
bean factory + SMTP transport tuning). Findings specific to THIS file:

  (1) RuntimeException-vs-NotificationSenderException asymmetry (HIGH) — primary
      source for the F-009 drift facet `exception_type_asymmetry_across_senders`.
  (2) HTML-only body / no plaintext alternative — accessibility + mail-client risk.
  (3) MimeMessageHelper constructed without charset — confirms code-level origin of
      live-doc `JAVA_TOOL_OPTIONS=-Dfile.encoding=UTF-8` workaround.
  (4) Owners and downstream entities are LIVE-DOC PROMISED but NOT in the email
      payload — net-new doc-drift findings (vs sibling NotificationConfiguration
      sidecar which only flagged SMTP-config-side drift). The email template
      omits the two payload bullets the live doc bullet 2+3 promise.
  (5) No setFrom — implicit From-header derivation from JavaMailSender.setUsername
      with no allowlist; spoofing risk bounded by SMTP-relay SPF/DKIM/DMARC.
  (6) ALERT_PATH hard-coded coupling between email body and SPA route table.
  (7) HttpClient is dead-wired for symmetry with Slack/Webhook senders.

Cross-batch coherence-sweep notes (per LSN-018 Rule 6):
  - F-009 already enumerates: poison_message_replay_loop, exception_type_asymmetry_across_senders,
    unconditional_broadcast_no_routing, no_retry_no_dlq_no_audit, pii_passthrough_to_every_channel,
    empty_senders_silent_db_cost, sender_iteration_order_undefined, debug_log_full_payload_leak,
    smtp_protocol_case_sensitive_lowercase_trap, subsystem_off_by_default,
    platform_base_url_consumption_asymmetric_email_only, smtp_timeouts_unset.
  - THIS sidecar STRENGTHENS facets: exception_type_asymmetry_across_senders (provides
    the email-side anchor), pii_passthrough_to_every_channel (email-channel-specific
    confirmation that owners are NOT in the payload despite being in the DTO),
    smtp_timeouts_unset (this class delegates to the JavaMailSender produced by
    NotificationConfiguration, so the timeout-unset behaviour propagates).
  - THIS sidecar ADDS net-new findings: owners-and-downstream-missing-from-email-payload
    (doc-drift — net-new vs live-doc bullets 2-3), HTML-only-body-no-plaintext-alternative,
    no-setFrom-derived-from-setUsername, ALERT_PATH-hard-coded-to-SPA-route,
    HttpClient-dead-wired, no-MimeMessageHelper-charset.
  - SUPERSEDES=0. CONFLICTS=0. No artefact contradicts the findings above; the
    sibling NotificationConfiguration sidecar's findings are upstream-rooted and
    SAME-DIRECTION with this file's findings.

Back-links:
  - F-009 (P-07:F-002 WAL-driven Notification Delivery) — primary feature anchor
  - F-007 AlertManager (cross-feature — Prometheus AlertManager push alerts route
    into the same notification pipeline; this sender carries those alerts on the
    email leg)
  - F-011 Principal-to-Owner Resolution — RELATED-BUT-INVERTED: the email
    channel intentionally BYPASSES per-owner scoping. F-011's resolution logic
    is NOT consulted here; the recipient list is a global static list.
  - REFACTOR-498 (SMTP timeouts unset — batch-X scope) — UPSTREAM-ROOTED in
    NotificationConfiguration; this class inherits the impact via the
    JavaMailSender bean.
  - REFACTOR-499 (SMTP protocol case-sensitivity trap — batch-X scope) —
    UPSTREAM-ROOTED in NotificationConfiguration; this class inherits the
    impact via the JavaMailSender bean.
  - LSN-001 (attachment-storage default — analogous failure mode: a silently-
    falling-off-cliff default; same case-law)
  - LSN-018 (reducer coherence-check) — this sidecar's emit follows Rule 6
    (pre-emit coherence sweep against F-009 drift facets enumerated above).
)
