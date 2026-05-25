# ADR-CANDIDATE-043 — Leader-elected single-thread consumer via Postgres advisory lock

## STRENGTHENS — batch ZF (2026-05-25)

**One new class-level confirmation** — EventApiController surface confirms the pattern operates on the INBOUND side as well:

- `odd-platform__java__EventApiController__controller-class__EventApiController.md:implicit_adrs.[0]` — "Inbound Slack events are persisted to a queue table (`message_provider_event`) and materialised asynchronously by a leader-elected processor thread rather than handled synchronously on the request path." — evidence: EventApiController.java:38-40 + DataCollaborationServiceImpl.java:64-69 + DataCollaborationMessageEventProcessor.java:34-76
- `odd-platform__java__EventApiController__controller-class__EventApiController.md:dependencies_semantic.requires-config` — `datacollaboration.receive-event-advisory-lock-id` (=110 per application.yml:201) is the Postgres advisory-lock id the `DataCollaborationMessageEventProcessor.java:147-149` acquires to single-leader the event-to-message materialisation loop.

The pattern is now confirmed at THREE distinct subsystems:
1. **Notifications WAL subscriber** (batch C — the original ADR target) — Postgres logical replication WAL → single-leader notification-sender thread.
2. **DataCollab message SENDER** (batch ZA — postMessageInSlack method-tier) — `datacollaboration.sender-message-advisory-lock-id=120`; single-leader Slack-post thread.
3. **DataCollab event RECEIVER** (batch ZF — this strengthening) — `datacollaboration.receive-event-advisory-lock-id=110`; single-leader event-materialisation thread.

The DataCollab subsystem has TWO advisory locks (sender + receiver), both gated by the same feature flag, both following the same single-leader pattern. The architectural insight: **bidirectional inbound/outbound integrations follow the same single-leader pattern with TWO disjoint locks** — outbound (sender) elects a leader for posting; inbound (receiver) elects a leader for consuming. The two locks are deliberately disjoint to avoid serialising the two halves.

A potential drift risk surfaced by the EventApiController sidecar's `stress_findings.tunables.[0]`: if an operator misconfigures the two advisory-lock ids to be equal, OR if either equals the `partition.advisory-lock-id=90`, the leader connections contend on the same lock and throughput drops to one job at a time. The risk is **silent**: nothing in the platform validates the four advisory-lock-ids are pairwise disjoint. **REFACTOR-175** (DataCollaboration sender/receiver lock-id equality not checked, surfaced in batch ZA) captures the operator-visible consequence; the EventApiController class-level evidence strengthens that finding.

The 3-subsystem support set makes ADR-043 a canonical platform pattern. Combined with ADR-CANDIDATE-179 (the broader advisory-lock-leader-elected pattern), every long-running background consumer/producer in the platform follows the same shape.

---
