# ADR-CANDIDATE-019 — Data Collaboration is shipped disabled-by-default; `@ConditionalOnDataCollaboration` gates the controller bean

## STRENGTHENS — batch ZF (2026-05-25)

**Two new class-level confirmations** widen the pattern: the conditional now applies to TWO distinct controller beans, both gated by the same property (`datacollaboration.enabled`):

- `odd-platform__java__DataCollaborationController__controller-class__DataCollaborationController.md:implicit_adrs.[0]` — "Discussions ships disabled-by-default, opt-in via a single property (`datacollaboration.enabled`)." — evidence: `application.yml:205` (`enabled: false`) + `DataCollaborationFeatureCondition.java:18-22`
- `odd-platform__java__EventApiController__controller-class__EventApiController.md:dependencies_semantic.requires-feature` — "`datacollaboration.enabled=true` (DataCollaborationFeatureCondition.java:18-22 + application.yml:205 default `false`) — controller bean not registered when false; route returns 404."

The architectural insight from batch ZF: **`@ConditionalOnDataCollaboration` is THE feature-isolation pattern for a multi-controller subsystem**. Both the user-facing controller (DataCollabController, three `/api/datacollaboration` + one `/api/messages` route) AND the Slack-events webhook receiver (EventApiController, `/api/slack/events`) share the same gate. An operator setting `datacollaboration.enabled=true` switches on the ENTIRE Discussions stack atomically; an operator setting it to `false` 404s every route across both controllers.

This is a STRONGER form of feature-isolation than the per-controller-bean pattern. Compare:
- **GenAI** (per ADR-CANDIDATE-004) — single controller gated by `genai.enabled`; the controller is the only surface.
- **Notifications** (per ADR-CANDIDATE-040) — `notifications.enabled` gates a WAL subscriber (not a controller bean); there are no Notifications controllers, so the pattern is asymmetric.
- **Data Collaboration** (this ADR, strengthened by ZF) — `datacollaboration.enabled` gates TWO controller beans + a background processor + a sender job + the WAL subscriber for Slack events. The condition resolves at FIVE distinct beans simultaneously.

The 5-bean atomic gating is the architectural insight; the existing ADR-019 documents only the controller-class instance. The ADR should be extended to enumerate the atomic-gating set explicitly:
1. `DataCollaborationController` (the user-facing /api/datacollaboration + /api/messages routes)
2. `EventApiController` (the Slack-events webhook receiver at /api/slack/events)
3. `DataCollaborationMessageSenderJob` (the background sender, leader-elected via the `sender-message-advisory-lock-id`)
4. `DataCollaborationMessageEventProcessor` (the background event processor, leader-elected via the `receive-event-advisory-lock-id`)
5. The Slack SDK `AsyncMethodsClient` bean (constructed at `DataCollaborationConfiguration.java:27`)

The 5-bean gating shape makes Data Collaboration the canonical "complex subsystem behind a single feature flag" — a pattern other feature-flagged subsystems (when added) can mirror.

---
