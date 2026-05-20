## REFACTOR-312 — NotificationsDispatcher PII pass-through across channels — every channel gets full `AlertNotificationMessage` payload (data-entity name, owner, namespace, downstream lineage) regardless of channel-side access control or security posture; no redaction hook, no allowlist

**Severity**: MEDIUM
**Category**: pii-disclosure
**Pillars affected**: [P-07-active-platform-features]
**Batch**: K (2026-05-19)

**Surfaced by**:
- `odd-platform__java__service__service__NotificationsDispatcher.md:bugs_limitations_corner_cases.[8]` (MEDIUM) — "PII surface: every channel gets full payload regardless of channel security posture. `AlertNotificationMessage` carries `dataEntity.{id,name,dataSourceName,namespaceName,owners[]}` + `downstream[]` lineage entities. The Slack channel (corporate workspace, potentially many viewers), the webhook (operator-defined URL, security posture unknown to ODD), and the email (inbox security varies) all receive the same payload. For organisations whose dataset names encode customer/PII identifiers, every dispatched alert leaks them to every channel. No redaction hook, no allowlist."

**Description**: `AlertNotificationMessageTranslator.java:73-83` populates the `AlertNotificationMessage` with `(alertType, eventType, eventAt, updatedBy, dataEntity.{id,name,dataSourceName,namespaceName,type,owners[]}, downstream[] lineage entities to configured depth, alertChunks[])`. The same fully-populated message is passed verbatim to every `NotificationSender` in the fan-out loop. There is no redaction step, no field-allowlist per channel, no per-channel data minimisation. For organisations whose dataset / namespace / owner names encode customer-identifying or PII content (e.g. `cust_acme_corp_orders`, `team:finance.privileged-data-stewards`), every dispatched alert leaks the content to every configured channel — including Slack workspaces with potentially many viewers, operator-defined webhook URLs whose security posture is unknown to ODD, and SMTP recipients whose inbox security varies.

**Failure mode**: An ODD deployment in a regulated industry uses dataset names like `cust_<customer_name>_pii_*` to scope per-customer data lakes. A DQ failure on `cust_acme_corp_pii_orders` produces an alert; the Slack channel receives the dataset name verbatim. 50 humans on the Slack workspace see the customer name. The organisation's GDPR / SOX compliance audit flags this as an information-disclosure incident.

**Primary source citations**:
- `AlertNotificationMessageProcessor.java:24-30` (notificationMessage passed verbatim to every sender)
- `AlertNotificationMessageTranslator.java:73-83` (full DB-row payload populated)
- `EmailNotificationSender.java:60-89` (template variables consume full payload)
- `SlackNotificationSender.java:40-49` (payload to Slack message)
- `WebhookNotificationSender.java:18-23` (`JSONSerDeUtils.serializeJson` — full payload to webhook body)

**Existing-ADR-or-implied-prescription**: None. ADR-CANDIDATE-100 (translate-before-fan-out atomic) defends the bifurcation-of-error-handling but says nothing about payload shape. The IMPLIED prescription is that operators in regulated industries need per-channel data-minimisation; the absence is a feature gap.

**Proposed remedy**: Two composable fixes. (a) **Per-channel redaction config**: `notifications.receivers.slack.redact-fields: ["dataEntity.name", "downstream[].name"]`; the sender bean reads the config and emits `[REDACTED]` for redacted fields. (b) **PII-tag-aware filter**: if the alerted entity has a `PII` Tag (per the existing Tag taxonomy), gate the channel delivery on a per-channel `accept-pii: false` config; alerts on PII-tagged entities skip the channel entirely (operator-visible via a boot-time policy summary). Cross-link with REFACTOR-137 (batch C — no structured notification audit log) — together they describe the audit gap.

**Severity rationale**: MEDIUM — compliance-relevant; affects operators in regulated industries with PII-encoding naming conventions. Workaround exists (don't encode PII in dataset names) but constraints the organisation's data-modelling decisions.

**Suggested backlog grouping**: `Notifications hardening sprint` (PII-handling bundle, cross-batch with REFACTOR-137 / -181 Lombok-toString leak family)

---
