## REFACTOR-085 — STRENGTHENED BATCH Y — Activity-table retention absence COMPOUNDS the F-006 + ADR-146 + ADR-182 triple-structural barrier; notification-delivery silence is structurally rooted at THREE layers, with the activity-table retention absence as a fourth aggravation

**Severity unchanged**: HIGH
**Updated support count**: now **5-sidecar triangulated** (was 4 after batch F; batch Y adds NotificationSubscriber + PostgresWALMessageProcessor)
**Batch**: Y (2026-05-20)

**New surfaced_by**:
- `NotificationSubscriber.md:security.known_security_gaps.[3]` (MEDIUM) — "No audit trail of WAL messages consumed / advanced — the LSN advance at L83-84 is silent at the application layer. Operators cannot answer 'which alerts were delivered, when?' from ODD telemetry; only `pg_replication_slots.confirmed_flush_lsn` and `log.debug` at DEBUG-level give signal."
- `PostgresWALMessageProcessor.md:bugs_limitations_corner_cases.[4]` (HIGH) — "NO notification-delivery audit-event is emitted from the seam OR the implementor — `ActivityEventTypeDto.java:3-31` enumerates 26 activity event types but ZERO of them name notification delivery."

**Cross-batch insight (BATCH Y EXPANSION)**: REFACTOR-085 was originally an activity-table-retention absence finding (no TTL on activity rows). Batch Y's discovery of the notification-delivery audit silence (via REFACTOR-518 + REFACTOR-520) COMPOUNDS the original gap in a structurally-significant way:

- **Original (batch B finding)**: The activity table accepts unbounded data-entity-mutation events; no retention; silent monotonic growth. Cross-batch with HousekeepingTTLProperties (batch D) confirming no `activity_days` TTL field.

- **Batch Y compounding**: Even if retention were added, the notification-delivery audit cannot reach the activity table because of the triple-structural barrier (ADR-CANDIDATE-146 strengthen-batch-Y):
  - ENUM-ROOTED (REFACTOR-520 NEW batch Y): no NOTIFICATION_* constants in ActivityEventTypeDto
  - SCHEMA-ROOTED (the original ADR-146): activity.data_entity_id NOT NULL FK
  - SPI-SEAM-ROOTED (ADR-CANDIDATE-182 NEW batch Y): no correlation-id at the bridge SPI

- **5-sidecar triangulation rationale**: ReactiveActivityRepositoryImpl (batch R primary source) + HousekeepingTTLProperties (batch D missing-field) + DatasetFieldController (batch V symmetric-audit scope correction) + NotificationSubscriber (batch Y notification-delivery silence) + PostgresWALMessageProcessor (batch Y SPI-seam structural barrier).

**Refined framing**: REFACTOR-085 is no longer ONLY about activity-table retention; it is now ALSO the operational consequence of the activity audit story's structural narrowness. The activity table:
- Grows unbounded (no retention) — the OG finding
- Cannot accept notification-delivery events (the batch-Y addition)
- Cannot accept RBAC-mutation events (per REFACTOR-188 + ADR-CANDIDATE-146)
- Can accept ALL data-entity-mutation events (per ADR-CANDIDATE-146 strengthen-batch-V)

**Severity unchanged at HIGH** — the structural compound of "grows without bound" + "cannot capture cross-feature audit needs" + "cross-references ADR-146's schema-rooted commitment" + "cross-references the F-006 ENUM-ROOTED drift class" makes this one of the most structurally-significant refactor scopes in the catalog.

**Updated proposed remedy** (extended from original):
- Original Path A: Add `housekeeping.ttl.activity-days` config key + extend ActivityHousekeepingJob.
- NEW Path E (cross-link with REFACTOR-520): The retention question is not "should the activity table have TTL" but "what audit story does the platform commit to" — answer per OwnerAssociationRequest's dedicated-table pattern (ADR-CANDIDATE-167) which spans the gap.

---
