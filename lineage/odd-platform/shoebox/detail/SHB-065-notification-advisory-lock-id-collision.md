# SHB-065 — Four hand-numbered Postgres advisory lock IDs across notification/datacollaboration/partition subsystems have no central registry — collision = silent deadlock-class behaviour

**Category**: open
**Severity**: MEDIUM

## Hypothesis

ODD Platform uses Postgres advisory locks to elect single-leader executors for FOUR distinct background subsystems: WAL notification subscriber (`notifications.wal.advisory-lock-id` = 100), partition creation (`partition.advisory-lock-id` = 90), DataCollaboration receive-event processor (`datacollaboration.receive-event-advisory-lock-id` = 110), DataCollaboration message sender (`datacollaboration.sender-message-advisory-lock-id` = 120). The lock IDs are HAND-ASSIGNED in application.yml — there is no central registry, no enum, no `@PostConstruct` cross-validator. An operator customising any of these via env var to an already-taken value silently makes the two subsystems contend on the same Postgres advisory lock: one acquires + holds, the other blocks forever in `acquire()`. The blocking subsystem produces no log error (it's blocked in `pg_advisory_lock`, not erroring), no metric, no readiness-probe degradation. Operators observe one feature "stopped working" with no diagnostic trail.

## Evidence

- `application.yml:177` (`notifications.wal.advisory-lock-id: 100`) + `:197-198` (`partition.advisory-lock-id: 90`) + `:201` (`datacollaboration.receive-event-advisory-lock-id: 110`) + `:202` (`datacollaboration.sender-message-advisory-lock-id: 120`) — the four hand-numbered IDs.
- `DataCollaborationProperties.java:10-12` — three int fields bound via `@ConfigurationProperties`; only `sending-messages-retry-count >= 0` is validated. No collision check.
- `NotificationsProperties` — top-level POJO carries `wal.advisoryLockId`; no collision check across siblings.
- `ActivityTablePartitionManager` sidecar `dependencies_semantic.coupling.[0]`: `MessageTablePartitionManager` shares the same advisory-lock-id (90) for the partition-creation orchestrator — they coexist by sharing the boot-time advisory lock for serial CREATE. Cross-subsystem sharing IS allowed when intentional; collision is the failure mode when accidental.
- `PostgreSQLLeaderElectionManagerImpl.java:22` — `SELECT pg_advisory_lock(%d)` blocks until acquired. No timeout, no fail-fast.
- NotificationsProperties sidecar `bugs_limitations_corner_cases` references this risk; DataCollaborationProperties sidecar `tests_coverage_semantic.uncovered_behaviours.[4]`: "lock-id-collision detection: no behaviour validates that `senderMessageAdvisoryLockId != receiveEventAdvisoryLockId` and that neither collides with `partition.advisory-lock-id` or `notifications.wal.advisory-lock-id`."
- Live `configuration-and-deployment/odd-platform` page (verified 2026-05-10): documents `notifications.wal.advisory-lock-id` AND `datacollaboration.{sender-message,receive-event}-advisory-lock-id` but NOT `partition.advisory-lock-id`; operators following the docs to remove "undocumented" keys may break partition creation.
- `NotificationSubscriber` sidecar `performance.scaling_characteristics`: "the four lock-id values are managed by convention, not by a central registry."

## Notes

- This is an ENRICHER for **F-009 (notification WAL)** + **F-010 (housekeeping/partitions)** + **F-038 (Data Collaboration)** — three pillars share a load-bearing convention that is unencoded in the type system.
- The fix is small and self-documenting:
  ```
  // platform/config/AdvisoryLockId.java
  public enum AdvisoryLockId {
    PARTITION_CREATION(90),
    NOTIFICATION_WAL(100),
    DATACOLLAB_RECEIVE_EVENT(110),
    DATACOLLAB_SENDER_MESSAGE(120);
    // ... + a startup cross-validator that asserts the configured values match the enum's
    //     defaults OR the operator-overridden values are pairwise distinct
  }
  ```
- The collision risk is bounded by "operator must take action to break it" — but the action is OBVIOUS (an env var that says `OVERRIDE_X=110` because the operator wants to use that number). Without a central registry the operator has no way to know what's already taken.
- The cross-subsystem-share-by-intent case (partition manager shares lock 90 across activity + message tables) means a naive "all IDs must be distinct" validator would be wrong — the validator needs to know that the partition orchestrator deliberately serialises across managers.
- Cross-cuts with the documentation: `partition.advisory-lock-id` is not in the live docs (per ActivityTablePartitionManager sidecar `bugs_limitations_corner_cases.[5]`); a doc fix without a code fix still leaves the collision risk.
- Compound with SHB-054 (poison-message replay): if the notification WAL subsystem deadlocks on a collided lock, NO operator sees the failure mode at the notification surface (alerts just stop firing) — the diagnostic path goes through Postgres `pg_locks` inspection.

## Next

1. **Probe**: configure `notifications.wal.advisory-lock-id: 120` to deliberately collide with the DataCollaboration sender, restart, observe whether (a) ODD boots cleanly, (b) which subsystem actually acquires, (c) what the other subsystem looks like to an operator.
2. **Graduate** as F-NNN "Single-leader-elected background subsystem registry — Postgres advisory locks across notification, partition, datacollaboration" — pillar P-08 (Management). MEDIUM.
3. **REFACTOR-NNN MEDIUM** — implement `AdvisoryLockId` enum + boot-time validator that ensures configured values are either default OR pairwise distinct (with the partition-orchestrator exception explicitly modelled).
4. **DOC-NNN MEDIUM** — `configuration-and-deployment/odd-platform` should add `partition.advisory-lock-id` to the documented set + add a cross-reference table of all four lock IDs + the deliberate-share semantic.
5. **REFACTOR-NNN LOW** — surface a `subsystem_leader_state{subsystem=...}` Prometheus gauge per the F-009 + F-038 telemetry gap; operators alert on "subsystem reports no active leader for > N minutes."

## Links

- cluster_with: [F-009, F-010, F-038]
- merged_into: (open)
- supersedes: []

## evaluation

- **feature-flow-builder 2026-05-26**: graduate — minted F-065 at lineage/odd-platform/feature-flows/detail/F-065.yaml (pillar P-08:F-005 "Single-Leader Background Subsystem Registry"). Evidence list spans application.yml lines 177,197-198,201,202 + three @ConfigurationProperties classes (NotificationsProperties.wal, DataCollaborationProperties, partition.* binding) + PostgreSQLLeaderElectionManagerImpl.java:22 + the deliberate-share invariant at ActivityTablePartitionManager sidecar coupling[0] — sufficient evidence spanning TWO substrate axes (config-tier + boot-time leader-election) plus a third operator-visible-failure axis. The feature is a cross-cutting operational-infrastructure concern serving THREE pillar P-07 sub-features (F-009, F-038, F-021 via F-010). The pillar choice (P-08 Management & Administration) reflects that operators tune these IDs via application.yml — a Management surface. The system-mission.md "Platform-Internal Operational Infrastructure" canonicalisation candidate covers this feature shape; this graduation is one concrete instance of that pillar canonicalisation opportunity. Thread marked merged. cluster_with relationships (F-009, F-010, F-038) preserved as related_features cross-references on F-065.
