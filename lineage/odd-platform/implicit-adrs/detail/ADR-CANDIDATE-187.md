## ADR-CANDIDATE-187 — Notification channels are single-destination-per-deployment — one Slack webhook URL + one Webhook URL + one email recipient list, all bound at bean construction; no per-alert routing, no per-owner/namespace/tenant destinations

**Severity**: HIGH
**Classification**: promote (NEW ADR; POSITIVE-INTENT — deliberate "one ODD deployment = one notification destination per channel" stance)
**Pillars affected**: [P-07-active-platform-features (Notifications sub-feature routing model), P-09-security-access-control (cross-tenant data exposure consequences)]
**Support count**: 3 sidecars primary source (batch Y SlackNotificationSender + WebhookNotificationSender + EmailNotificationSender)
**Axes present**: notification.sender
**Batch**: Y (2026-05-20)

**Surfaced by**:
- `SlackNotificationSender.md:implicit_adrs.[1]` (HIGH) — "The webhook URI is bound ONCE at bean construction (`private final URI slackWebhookUrl;` at L27 + the constructor at L30-37) — no per-alert routing override, no map of (alert-type -> URI), no operator-configurable channel-name field. This encodes the architectural decision that one ODD deployment maps to exactly one Slack channel (and the operator who wants multiple channels deploys multiple webhooks at the Slack-workspace level and accepts that EVERY alert goes to EVERY configured webhook). Combined with NotificationConfiguration.java:75-86 (single bean factory, single URL, no list) this is committed at boot." — intent_anchor: `private final URI slackWebhookUrl;` (SlackNotificationSender.java:27)
- `WebhookNotificationSender.md:implicit_adrs.[3]` (HIGH) — "**ONE webhook URL per platform deployment — the bean factory binds the constructor argument once and never re-reads.** `WebhookNotificationSender(HttpClient, URI)` makes `webhookUrl` a private final field at line 11; there is no setter, no reload mechanism, no re-read of the Spring Environment. To change the URL the operator must redeploy. Encodes 'webhook is a static destination, not a dynamic routing decision'. The choice flows from the broader notification subsystem's stance (the dispatcher has no routing knob — see NotificationsDispatcher sidecar implicit_adrs)." — intent_anchor: `private final URI webhookUrl;` at line 11 + `this.webhookUrl = webhookUrl;` at line 15
- `EmailNotificationSender.md:invariants.[7]` (MEDIUM) — "Recipient list is bound at construction time (line 36) — not refreshed per-message, not re-read from config. Operator changes to `notifications.receivers.email.notification.emails` require a Spring context restart to take effect." — intent_anchor: `private final List<String> notificationsEmails;` + constructor binding

**Decision statement**: Each of ODD's three notification channels (Slack + Webhook + Email) has a SINGLE destination per platform deployment, bound at bean construction time, never re-read:

1. **Slack**: `private final URI slackWebhookUrl` at `SlackNotificationSender.java:27`. The URI is bound by `NotificationConfiguration.java:77` via `@Value("${notifications.receivers.slack.url}")`. Slack's incoming-webhook API itself binds the channel at install time on the Slack-workspace side (one webhook URL = one channel) — so the platform-side single-URL constraint is consistent with Slack's API model.
2. **Webhook**: `private final URI webhookUrl` at `WebhookNotificationSender.java:11`. The URI is bound by `NotificationConfiguration.java:91` via `@Value("${notifications.receivers.webhook.url}")`. No map, no list, no per-tenant route.
3. **Email**: `private final List<String> notificationsEmails` at `EmailNotificationSender.java:36`. The list is bound by `NotificationConfiguration.java:104-118` via `@Value` + `notificationEmails.trim().split(",")`. The list is FROZEN at construction; the same recipients receive every alert regardless of which entity the alert concerns.

All three are `final` fields, all three are bound once via Spring `@Value` resolution at bean construction, none has a setter, none has a `@RefreshScope` / `@ConfigurationProperties` watch / Spring-Cloud-Config-style live-reload integration. Operator changes to any of the three config keys require a Spring context restart.

The architectural commitments:
- **(a) One deployment = one destination per channel.** A platform with multiple Slack channels uses multiple ODD deployments OR a Slack-side fan-out gateway. A platform with per-team alert routing cannot configure it at the ODD layer.
- **(b) No per-alert routing decisions.** The dispatcher (`AlertNotificationMessageProcessor`) does NOT inspect `dataEntity.owners` / `dataEntity.namespaceName` / `alertType` to choose a destination. Every alert reaches every configured channel.
- **(c) Configuration immutability per process.** `@Value` resolution at Spring bean construction is the binding mechanism; no `@RefreshScope`, no Actuator `/actuator/refresh` integration, no SIGHUP-style reload. The choice composes with the broader Spring `@Value` convention in ODD (most config is `@Value`-resolved at boot).
- **(d) Credential rotation is restart-only.** Slack workspace admins rotating an incoming-webhook URL (e.g. on credential leak) require an ODD restart. The webhook URL IS a bearer credential (anyone with the URL can post to the channel); the no-in-app-rotation constraint is the operational cost.
- **(e) Cross-tenant data exposure is STRUCTURAL.** A multi-team / multi-tenant deployment configuring one Slack URL leaks every team's alerts to that one channel. ODD's data-residency posture cannot extend across the receiver boundary. The architectural decision is "deploy ODD per-tenant or per-team if data residency requires" — the platform does NOT solve multi-tenant alert routing at the notification layer.
- **(f) Symmetric across all three channels.** The pattern is identical for Slack + Webhook + Email — not a Slack-specific design but a platform-wide convention.

**Wisdom test**: PASS on all three questions.
1. **Intentional?** YES — three independent commitments:
   - All three senders use `private final` fields for the destination — consistent across the family.
   - No `Map` / `List<URI>` / `@RefreshScope` patterns exist — the maintainer rejected the routing-table model.
   - The Slack-side API constraint (one webhook URL = one channel at Slack-workspace level) is consistent with ODD's design — the platform did not paper over the Slack API model with a fan-out abstraction.
2. **Structural impact?** YES — every future "add per-team / per-owner alert routing" feature requires either (a) adding a destination-resolution step in the dispatcher (changes the SPI shape per ADR-CANDIDATE-182) or (b) running multiple ODD deployments per team (operator-deployment-topology change). Both structural.
3. **Refactoring or structural?** STRUCTURAL — changing from `final URI` to `Map<TeamId, URI>` requires reshaping the dispatcher's per-alert work, the bean factories, the `@ConfigurationProperties` POJO. Not a small refactor.

**Existing ADR**: none in `adrs/`. Composes with ADR-CANDIDATE-186 (one-shot fire-and-forget — the destinations operate this way), ADR-CANDIDATE-182 (single-implementor SPI — the dispatcher has no routing extension point), ADR-CANDIDATE-179 (single-thread WAL subscriber — the architecture that drives unconditional broadcast).

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-514 NEW batch Y (Webhook + Slack + Email cross-tenant data exposure — every configured destination receives every alert regardless of owners[]; HIGH)
- REFACTOR-532 NEW batch Y (no fan-out scoping by data-entity owner / namespace / tenant — the dispatcher cannot express owner-aware routing; MEDIUM)
- REFACTOR-528 NEW batch Y (Webhook no custom auth header support — deployment burden of running HTTP gateway in front; MEDIUM)

**Proposed action**: Promote to `adrs/drafts/single-destination-per-channel.md` (new ADR). Document the three commitments + the per-deployment-per-team operator topology + the no-in-app-rotation constraint for Slack URLs. Doc-side: the live notifications page should mention the cross-tenant exposure consequence explicitly so operators evaluating multi-tenant deployments understand the architectural commitment.

**Severity rationale**: HIGH — defines the platform's notification routing model (no per-alert routing); load-bearing for multi-tenant / multi-team deployments; cross-references REFACTOR-514 (cross-tenant exposure) which is the HIGH-severity operator-visible consequence.

---
