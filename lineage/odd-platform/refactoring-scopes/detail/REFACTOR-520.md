## REFACTOR-520 — `ActivityEventTypeDto` enum has NO `NOTIFICATION_*` constants — STRENGTHENS F-006 ENUM-ROOTED audit-silence; notification-delivery events cannot be audited via the activity-feed surface even if the schema were extended

**Severity**: MEDIUM
**Category**: missing-audit + enum-rooted-silence
**Batch**: Y (2026-05-20)
**Pillars affected**: [P-07-active-platform-features (Notifications audit), F-006 audit-silence family]

**Surfaced by**:
- `PostgresWALMessageProcessor.md:bugs_limitations_corner_cases.[4]` (HIGH) — "NO notification-delivery audit-event is emitted from the seam OR the implementor — `ActivityEventTypeDto.java:3-31` enumerates 26 activity event types (OWNERSHIP_CREATED, ALERT_STATUS_UPDATED, OPEN_ALERT_RECEIVED, RESOLVED_ALERT_RECEIVED, etc.) but ZERO of them name notification delivery. F-006's `audit_silence_enum_rooted` drift class names this exact enum gap as a root cause. From the seam's perspective: a dispatcher implementor cannot emit a notification-delivery activity event because the enum has no constant to name; the enum gap is a STRUCTURAL silence on this entire subsystem's observability."

**Statement**: `ActivityEventTypeDto.java:3-31` declares 26 activity event types. The full enumeration includes alert-lifecycle events (`OPEN_ALERT_RECEIVED`, `RESOLVED_ALERT_RECEIVED`, `ALERT_STATUS_UPDATED`, `RESOLVED_AUTOMATICALLY_ALERT_RECEIVED`) but ZERO notification-delivery events. There is NO:
- `NOTIFICATION_SENT`
- `NOTIFICATION_FAILED`
- `NOTIFICATION_DELIVERY_RETRIED`
- `NOTIFICATION_CHANNEL_HEALTH_CHANGED`

**Triple-structural barrier composition** (per ADR-CANDIDATE-146 strengthen-batch-Y):
- (a) ENUM-ROOTED (this scope): the enum has no constant to name a notification-delivery event.
- (b) SCHEMA-ROOTED (REFACTOR-085 cross-batch + ADR-CANDIDATE-146): `activity.data_entity_id NOT NULL FK` to `data_entity(id)` — even if the enum had constants, a notification-delivery event scoped to a Slack 429 affecting a 50-alert burst cannot be persisted because it has no specific data_entity_id.
- (c) SPI-SEAM-ROOTED (ADR-CANDIDATE-182 NEW batch Y): the SPI carries no correlation-id / LSN / audit-context.

All three structural barriers must be addressed to achieve notification-delivery audit.

**Why this is a SCOPE not an ADR**: F-006 captures this enum-rooted audit-silence as a DRIFT class (not an architectural decision). The gap has no stated rationale; adding `NOTIFICATION_*` constants to the enum + service-tier emission is refactoring within existing structure. Per the wisdom test, this is a REFACTORING SCOPE.

**Evidence**:
- `ActivityEventTypeDto.java:3-31` — the 26-value enumeration
- F-006.yaml drift_class `audit_silence_enum_rooted_activity_event_type_dto_term_namespace_owner_lifecycle`
- ADR-CANDIDATE-146 + strengthen-batch-Y (the schema commitment + cross-layer structural barriers)
- ADR-CANDIDATE-182 NEW batch Y (the SPI-seam barrier)

**Existing-ADR-or-implied-prescription**:
- F-006 names this as a drift class — implied prescription is to widen the enum.
- ADR-CANDIDATE-146 + strengthen-batch-Y explicitly enumerates the three structural barriers — this scope is one of the three.

**Proposed remedy**:

1. **Path A (widen enum + service emission — partial fix)** — Add 4 constants to `ActivityEventTypeDto`: `NOTIFICATION_SENT`, `NOTIFICATION_FAILED`, `NOTIFICATION_RETRIED`, `NOTIFICATION_CHANNEL_HEALTH_CHANGED`. Emit at service tier from each sender. But: cannot persist to the `activity` table (per ADR-CANDIDATE-146's schema commitment). Would require Path B simultaneously.

2. **Path B (dedicated `notification_delivery_audit` table — per ADR-CANDIDATE-167 pattern)** — Follow OwnerAssociationRequest's pattern: dedicated audit table + dedicated event-type enum + service-tier emission. AVOIDS the `data_entity_id NOT NULL FK` schema barrier. Symmetric with OwnerAssociationRequest's audit table.

3. **Path C (Path B + SPI extension — full fix)** — Path B + extend `PostgresWALMessageProcessor.process(DecodedWALMessage, AuditContext context)` to pass correlation-id. Full architectural answer.

Path B is the recommended structural answer (matches the existing OwnerAssociationRequest pattern). Path C is the cleanest long-term but breaks the SPI.

**Severity rationale**: MEDIUM — the audit silence at notification-delivery is operationally significant (per REFACTOR-518) but the enum gap on its own (without the schema and SPI fixes) doesn't surface to operators; the structural triple-barrier framing makes the impact clearer.

**Suggested backlog grouping**: `Notifications hardening sprint` + `F-006 audit-silence family resolution`.

---
