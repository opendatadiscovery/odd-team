# SHB-064 — Notification channel routing is impossible — every configured channel receives every alert regardless of owner / severity / namespace

**Category**: clustering
**Severity**: MEDIUM

## Hypothesis

Operators of multi-team or multi-namespace ODD deployments expect "route Critical alerts to the on-call channel, route low-severity to a less-urgent channel, route data-quality alerts to the DQ engineering channel" — basic notification-routing primitives that every incident-management platform offers. The ODD platform offers NONE: the dispatcher iterates `List<NotificationSender>` UNCONDITIONALLY per alert. Every configured channel receives every alert regardless of alert TYPE (DISTRIBUTION_ANOMALY / FAILED_DQ_TEST / FAILED_JOB / BACKWARDS_INCOMPATIBLE_SCHEMA), regardless of the alerted entity's OWNER set, regardless of NAMESPACE, regardless of SEVERITY (no severity field exists on the platform's alert model — Prometheus severity labels are DISCARDED by `handleExternalAlerts`). The operator's only routing options are: (a) deploy multiple ODD instances each with one channel + one filter (operationally absurd), OR (b) handle routing receiver-side (Slack channel-routing rules, webhook gateway that fans out by content). The platform commits to "one channel = whole alert stream"; the live doc names this architectural decision but does not flag the operator-side burden it creates.

## Evidence

- `odd-platform-api/src/main/java/.../notification/processor/AlertNotificationMessageProcessor.java:25-36` — the fan-out loop: `for (final NotificationSender<...> notificationSender : notificationSenders) { try { notificationSender.send(notificationMessage); } catch (...) }`. Unconditional iteration; no filter, no predicate, no severity check, no owner check, no namespace check.
- `AlertNotificationMessageTranslator.java:73-83` (referenced in NotificationsDispatcher sidecar) — translator POPULATES `dataEntity.owners[]`, `namespaceName`, `dataSourceName` on the AlertNotificationMessage, but the dispatcher never reads them for routing.
- `SlackNotificationSender.java:27` + `WebhookNotificationSender.java:11` — both senders bind one URI per platform deployment at bean construction; no `List<URI>`, no `Map<criterion, URI>`, no per-call URL override.
- `EmailNotificationSender.java:36` — recipient list is bound at construction; no per-alert recipient selection.
- Live notifications doc (`features/active-platform-features/notifications`, verified 2026-05-20 status 200): explicitly states "every channel that is enabled" receives every alert + "no per-channel filtering of any kind" (per NotificationsDispatcher sidecar `docs_link_semantic.fetched_excerpts`). The architectural decision is named but the operator-side workaround burden is not.
- `AlertServiceImpl.handleExternalAlerts` lines 168-185 — AlertManager `labels` (which include `severity` per Prometheus convention) are DISCARDED except for `entity_oddrn`; the platform's AlertPojo carries no severity field.
- NotificationsDispatcher sidecar `bugs_limitations_corner_cases.[3]` MEDIUM severity: "No per-channel filtering by alert type / severity / owner / namespace."
- SlackNotificationSender sidecar `implicit_adrs.[1]` HIGH confidence: "single-channel-per-deployment commit at boot."

## Notes

- This is an ENRICHER for **F-009 (WAL-driven Notification Delivery)**. F-009 already covers `unconditional_broadcast_no_routing` as a drift facet. This thread elevates it: routing IS the feature operators reach for first when adopting an alerting platform, and the platform's absence is the operator-visible MISSING FEATURE — not just a "facet of the existing one."
- The architecture is a deliberate "thin proxy + operator owns routing" stance (per dispatcher's `implicit_adrs` + live-doc framing). The decision is internally consistent, but it creates a steep onboarding cliff:
  - Tiny teams with one Slack channel + one on-call rotation: ODD works out-of-the-box.
  - Medium teams with per-team channels: must deploy a routing gateway upstream of the webhook channel OR use Slack's per-channel "ignore from bot" filtering OR live with the noise.
  - Large multi-tenant deployments: structural cross-team alert leakage (cross-link SHB-053, SHB-055 — the same `pii_passthrough_to_every_channel` drift).
- The platform's missing alert-severity field is a compound concern: even if a routing primitive existed, operators couldn't say "critical to channel A, info to channel B" because the alert model has no severity. This is BLOCKED by the alert-model design, not just by the absence of a routing knob.
- An incremental fix path:
  - Add `severity` enum to AlertPojo + DTOs + AlertManager label mapping. (Schema change.)
  - Add `notifications.routing.rules` config knob — list of `{criterion, channel}` predicates evaluated per alert.
  - Add per-channel filter beans implementing `Predicate<AlertNotificationMessage>` that operators register.
- Concept candidate: "alert routing" — currently absent from `concepts.yaml`; should be added as a known-limitation entry.

## Next

1. **Graduate** as F-NNN "Alert routing primitives (severity + per-channel filters)" — pillar P-07. MEDIUM. Frame as the missing operator-visible feature with the workarounds enumerated.
2. **REFACTOR-NNN MEDIUM** — schema migration adding `alert.severity` enum; populate from AlertManager `labels.severity` in `handleExternalAlerts`; add to AlertNotificationMessage DTO.
3. **REFACTOR-NNN MEDIUM** — `Predicate<AlertNotificationMessage>` Spring bean discovery in `AlertNotificationMessageProcessor`; if no predicates registered, fall back to today's "broadcast all" behaviour for backward compatibility.
4. **DOC-NNN MEDIUM** — `features/active-platform-features/notifications` should explicitly enumerate the operator-side routing options (Slack filtering, gateway, multi-instance) until the in-platform feature ships.

## Links

- cluster_with: [F-007, F-009, SHB-053, SHB-055]
- merged_into: (open)
- supersedes: []

## evaluation

- **feature-flow-builder 2026-05-26**: merge — into F-009 WAL-driven Notification Delivery. F-009 batch K already lists `unconditional_broadcast_no_routing` in drift_class_summary, primary-source at AlertNotificationMessageProcessor.java:25-36 (fan-out loop with no filter/predicate) + AlertNotificationMessageTranslator.java:73-83 (populates owners/namespace/dataSourceName but dispatcher never reads them) + SlackNotificationSender.java:27 + WebhookNotificationSender.java:11 + EmailNotificationSender.java:36 (single-URL-per-bean construction). The SHB-064 thread elevates the existing drift facet from "implementation reality" to "missing operator-visible feature" — but F-009's facet already names the absence. The compound with the missing alert.severity field (AlertManager labels.severity discarded by handleExternalAlerts) is captured under F-007's batch P secondary facet on DTO silently dropping wire fields. Thread marked merged. F-009: WAL-driven outbound alert notification fan-out — drift_class facet `unconditional_broadcast_no_routing` already captures the full SHB-064 hypothesis.
