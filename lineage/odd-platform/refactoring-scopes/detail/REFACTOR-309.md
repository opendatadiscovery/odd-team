## REFACTOR-309 — NotificationsDispatcher has no per-channel filter by alert type / severity / owner / namespace — every alert goes to every configured channel; operators wanting "Critical to Slack, all to email" have no expressing mechanism

**Severity**: MEDIUM
**Category**: missing-validation (no-channel-filter)
**Pillars affected**: [P-07-active-platform-features]
**Batch**: K (2026-05-19)

**Surfaced by**:
- `odd-platform__java__service__service__NotificationsDispatcher.md:bugs_limitations_corner_cases.[3]` (MEDIUM) — "No per-channel filtering by alert type / severity / owner / namespace. Every alert goes to every configured channel. An operator wanting 'Critical to Slack, all to email' cannot express that — no filter / predicate / config key for routing exists between the dispatcher and the senders."

**Description**: `AlertNotificationMessageProcessor.process()` (lines 25-36) iterates `List<NotificationSender>` unconditionally — no per-channel filter, no per-channel routing predicate, no severity gate, no owner-match. Operators wanting different alert routing per channel ("send only Critical alerts to Slack; send all alerts to the audit-email; route schema-break alerts to the data-quality team's webhook") have NO mechanism. Every channel receives every alert.

**Failure mode**: Operator configures Slack for the data-quality team (12 humans), webhook for the platform-engineering team (3 humans), and email for archive. A misconfigured DQ run produces 5,000 alerts; all 12 humans on Slack get pinged 5,000 times each; the operator wants to filter Slack to Critical only, but there is no config for it. The operator's only mitigation is to turn off the Slack channel entirely (REFACTOR-041 per-channel URL-presence activation is the only available toggle), losing legitimate Critical-alert delivery in the process.

**Primary source citations**:
- `AlertNotificationMessageProcessor.java:25-36` (the loop iterates `notificationSenders` unconditionally)
- Grep `notifications.receivers.*.filter` / `notifications.routing` against `src/main/resources/application.yml` returns zero matches — no filter config exists.

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-041 (per-channel URL-presence activation) is the binary toggle (channel on / channel off); the ADR does NOT defend the absence of per-channel routing. The IMPLIED prescription is that operators wanting routing would expect a separate config dimension (filter / predicate per channel) — and the absence is a feature gap, not a structural decision.

**Proposed remedy**: Add a per-channel `filter` config block: `notifications.receivers.slack.filter: { severity: ["CRITICAL", "MAJOR"], owner: "data-quality" }`; `notifications.receivers.webhook.filter: { alert_type: ["BACKWARDS_INCOMPATIBLE_SCHEMA"] }`; `notifications.receivers.email.filter: {}` (no filter = all alerts). Wire the filter into `AlertNotificationMessageProcessor.process()` at the per-sender call site — skip the `notificationSender.send(...)` if the filter doesn't match the current `AlertNotificationMessage`. The structural change is small (a Predicate field on each NotificationSender bean + a Predicate evaluation step in the for-loop).

**Severity rationale**: MEDIUM — operability gap; affects every operator running multiple Notifications channels with team-specific routing needs. Workaround exists (one channel only) but defeats the purpose of multi-channel support.

**Suggested backlog grouping**: `Notifications hardening sprint`

---
