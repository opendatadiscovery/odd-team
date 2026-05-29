---
doc_page: "docs/active-platform-features/notifications.md"
page_title: "Notifications"
live_url: "https://docs.opendatadiscovery.org/features/active-platform-features/notifications"
live_url_verified_status: "200"
live_url_resolved_slug: "features/active-platform-features/notifications"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "Notifications"
    - "AlertManager Webhook Receiver"
    - "Notification Recipient"
    - "Dispatch Alert Notification via WAL Fan-Out"
    - "Prometheus AlertManager"
    - "Exception-type asymmetry between notification senders"
    - "Slack 429 Retry-After header silently ignored — no rate-limit honour, no exponential back-off, no DLQ (batch Y)"
  features:
    - "F-009"
    - "F-007"
  code_nodes:
    - "odd-platform java service service:NotificationsDispatcher"
    - "odd-platform java notification class:NotificationSubscriber"
    - "odd-platform java notification.processor class:PostgresWALMessageProcessor"
    - "odd-platform java notification.sender class:SlackNotificationSender"
    - "odd-platform java notification.sender class:EmailNotificationSender"
    - "odd-platform java notification.sender class:WebhookNotificationSender"
    - "odd-platform java NotificationConfiguration config-class:NotificationConfiguration"
    - "odd-platform java org.opendatadiscovery.oddplatform.notification.config config-properties-class:EmailSenderProperties"
    - "odd-platform java org.opendatadiscovery.oddplatform.notification.config config-properties-class:NotificationsProperties"
    - "odd-platform java AlertManagerController controller-method:postAlerts"
    - "odd-platform java service service:AlertServiceImpl"
audience: [operator]
doc_claim_vs_code:
  - "Poison-message caveat attributes the WAL-replay loop to the dispatch call — 'The processor has no try/catch around its dispatch call ... a corrupted field, a downstream serialisation failure, an unhandled enum value'. Code: the dispatch call DOES have a try/catch (per-sender catch of NotificationSenderException, AlertNotificationMessageProcessor.java:31); the uncaught call that actually triggers replay is the TRANSLATION step that runs before fan-out — AlertNotificationMessageTranslator throws IllegalArgumentException / IllegalStateException (e.g. unknown alert-type code, missing/duplicate alerted-entity row, an alert pointing at a hard-deleted data_entity oddrn), which propagates out of process() because NotificationSubscriber.java:80 does not wrap process() in try/catch, and the LSN is advanced only on normal return (NotificationSubscriber.java:83-84). The loop is real and HIGH severity, but it is a translation-stage failure, not a dispatch-stage one. Evidence: odd-platform java notification class:NotificationSubscriber / NotificationSubscriber.java:77-91 + odd-platform java service service:NotificationsDispatcher / AlertNotificationMessageProcessor.java:23-24,31 + AlertNotificationMessageTranslator.java:87,94,101."
  - "Page omits: SMTP protocol value is case-sensitive lowercase 'smtp' (NotificationConfiguration.java:63 uses .equals(\"smtp\")), but the operator-side Gmail example writes 'protocol: SMTP' (uppercase). An operator copying the example verbatim hits the ELSE branch — mail.smtp.auth and mail.smtp.starttls.enable are never set regardless of the configured smtp.auth/smtp.starttls, so STARTTLS does not engage and AUTH does not negotiate, with no boot warning. Evidence: odd-platform java NotificationConfiguration config-class:NotificationConfiguration / NotificationConfiguration.java:63. (This is a config-page caveat, not a notifications-feature-page one; logged here because the page cross-links the Gmail example.)"
  - "Page omits: notifications.message.downstream-entities-depth has NO default in the @Value expression (NotificationConfiguration.java:123). The page states the default is 1; that default lives only in shipped application.yml (line 175). An operator who sets notifications.enabled=true but removes/omits the depth key from an override config gets a startup failure (Spring 'Could not resolve placeholder'), not the documented default. Evidence: odd-platform java NotificationConfiguration config-class:NotificationConfiguration / NotificationConfiguration.java:123 + application.yml:174-175."
  - "Page omits a Slack-channel data-loss caveat: Slack incoming webhooks are rate-limited (~1 msg/sec/webhook); on 429 the platform reads neither the status class nor the Retry-After header — AbstractNotificationSender.java only checks statusCode != 200, so a 429 raises the same undifferentiated NotificationSenderException, is logged, and the alert is dropped from Slack with no retry. An alert burst (e.g. one failed dbt run producing 50+ alerts) silently loses most Slack messages. The page's 'Failed deliveries are lost without trace' caveat covers the no-audit angle but does not name the rate-limit-induced loss specifically. Evidence: odd-platform java notification.sender class:SlackNotificationSender / SlackNotificationSender.java:43-48 + AbstractNotificationSender.java:24-29."
  - "Page omits: AlertManager-derived alerts are hard-coded to type DISTRIBUTION_ANOMALY (AlertServiceImpl.java:177) — the AlertManager-side alertname/severity labels are ignored; every inbound webhook payload becomes the same alert type regardless of the alerting rule. The page correctly says each accepted alert 'becomes a Distribution Anomaly alert' but does not state that the type is fixed and provider labels cannot change it. Evidence: odd-platform java service service:AlertServiceImpl / AlertServiceImpl.java:177."
  - "Page omits: the AlertManager webhook path has no idempotency — handleExternalAlerts (AlertServiceImpl.java:151-191) bypasses AlertActionResolver (used by the in-platform ingestion path for dedup), and createAlerts INSERTs with no ON CONFLICT. Two POSTs of the same payload create two duplicate OPEN alert rows. The page's outbound 'no idempotency key' caveat is about delivery; this is a distinct inbound-ingestion idempotency gap. Evidence: odd-platform java service service:AlertServiceImpl / AlertServiceImpl.java:151-191,187."
maintainer_curated: false
---

# Notifications — doc understanding

This operator-facing page describes ODD Platform's Notifications subsystem: the **outbound** WAL-driven alert fan-out to Slack incoming webhook / generic webhook / SMTP email (feature `F-009`, implemented by `NotificationSubscriber` → `PostgresWALMessageProcessor`/`AlertNotificationMessageProcessor` → the three `NotificationSender` impls, all gated off-by-default behind `notifications.enabled` per `NotificationConfiguration`), and the **inbound** Prometheus AlertManager webhook at `POST /ingestion/alert/alertmanager` that creates Distribution-Anomaly alerts (feature `F-007`, `AlertManagerController.postAlerts` → `AlertServiceImpl.handleExternalAlerts`). Every binding here was confirmed via `graph-node`.

The page is unusually accurate and operator-honest: its caveat blocks map almost one-to-one onto the substrate's HIGH-severity findings, with the same code-grounded shape. Specifically confirmed against primary code:

- **Exception-type asymmetry — a failing email channel aborts Slack + webhook on the same alert.** The dispatcher catches only the checked `NotificationSenderException` per sender (`AlertNotificationMessageProcessor.java:31`), but `EmailNotificationSender` wraps SMTP/template/IO failures as a raw `RuntimeException` (`EmailNotificationSender.java:58-60`), which bypasses that catch and aborts fan-out — exactly as the page warns. (`odd-platform java service service:NotificationsDispatcher`, `odd-platform java notification.sender class:EmailNotificationSender`.)
- **Silent partial delivery on email recipient N.** The per-recipient loop has no inner try/catch (`EmailNotificationSender.java:54-57`); the first failing recipient aborts the rest — and, via the RuntimeException wrap above, the whole alert's fan-out.
- **No idempotency key / no DLQ / no per-channel audit; `send` returns void.** `PostgresWALMessageProcessor.process(...)` returns `void`, `NotificationSubscriber.java:83-84` advances `AppliedLSN`/`FlushedLSN` unconditionally after normal return — there is no shape on which a delivery-status surface could be expressed without an API change. (`odd-platform java notification.processor class:PostgresWALMessageProcessor`.)
- **Owner list dispatched verbatim, no redaction/scoping.** `AlertNotificationMessage` carries `dataEntity.owners[]` (`AlertNotificationMessageTranslator.java:73-83`) but no sender consults it for routing — every configured channel receives every alert. Confirmed across all three senders' `owner_scoping: BYPASSES`.
- **Lineage walk runs even with zero senders configured.** The translator bean (and its recursive downstream-lineage CTE bounded by `notifications.message.downstream-entities-depth`) is registered whenever `notifications.enabled=true`, independent of any `notifications.receivers.*` trigger key (`NotificationConfiguration`, translator bean unconditional within the subsystem).
- **Slack markdown injection (`@channel`, fake-link payloads).** `SlackNotificationSender` passes the alert chunk descriptions verbatim into Slack Block Kit markdown (`SlackMessageGenerator`), and the AlertManager-supplied `generatorURL`/description reach Slack unsanitised. Compounded with the unauthenticated inbound webhook, this is the cross-tenant Slack-broadcast surface the page calls out.
- **Generic webhook unsigned; `odd.platform-base-url` not consumed by it.** `WebhookNotificationSender.java:20-22` issues a bare POST with no auth/HMAC header and serialises the raw payload (no base-url link rendering); Slack and Email do consume `odd.platform-base-url` (`EmailNotificationSender` line 66). All as stated on the page.
- **Inbound AlertManager webhook is unauthenticated; `entity_oddrn` required.** `/ingestion/**` is whitelisted at the Spring Security layer (`SecurityConstants.java:96`), and `IngestionDataEntitiesFilter` (`auth.ingestion.filter.enabled`) matches only `POST /ingestion/entities` (`IngestionDataEntitiesFilter.java:28`), so this endpoint is reachable by any caller with network reach under every auth mode. The platform maps `labels["entity_oddrn"]` straight to `AlertPojo.dataEntityOddrn` with no validation (`AlertServiceImpl.java:178`); a missing label produces a null-FK orphaned alert. (`odd-platform java AlertManagerController controller-method:postAlerts`, `odd-platform java service service:AlertServiceImpl`.)
- **SMTP timeouts unset (unreachable relay hangs delivery); STARTTLS-only.** `NotificationConfiguration.java:51-71` populates no `mail.smtp.{connectiontimeout,timeout,writetimeout}` keys (JavaMail defaults are infinite) and only the `starttls` toggle — implicit-TLS (port 465 / `mail.smtps.*`) is never set. (`odd-platform java NotificationConfiguration config-class:NotificationConfiguration`, `odd-platform java org.opendatadiscovery.oddplatform.notification.config config-properties-class:EmailSenderProperties`.)

The `doc_claim_vs_code` block records the one genuine drift nuance (the poison-message caveat attributes the replay loop to the dispatch call when the uncaught failure is actually the pre-fan-out translation step) plus six code-confirmed caveats the page does not surface (lowercase-`smtp` protocol trap, missing `@Value` default on the depth knob, Slack 429 rate-limit silent loss, hard-coded DISTRIBUTION_ANOMALY type on inbound alerts, and the inbound-ingestion idempotency gap). None of these contradict the page's overall correctness; they are sharpening additions for a `doc-gap-finder` / maintainer pass.

## Maintainer notes
(none — net-new sidecar.)
