## ADR-CANDIDATE-146 — STRENGTHENED BATCH Y — Audit silence at notification-delivery surface is DOUBLE-STRUCTURALLY-ROOTED: (a) the activity-table schema (`data_entity_id NOT NULL FK`) per batch R + (b) the WAL bridge SPI (no correlation-id / no audit hook) per batch Y; F-006 ENUM-ROOTED audit-silence pattern extends from RBAC-tier into notification-delivery-tier with a NEW structural reason

**Severity unchanged**: HIGH
**Updated support count**: now **3 sidecars** (batch R ReactiveActivityRepositoryImpl primary source + batch V DatasetFieldController scope correction + batch Y PostgresWALMessageProcessor seam-SPI evidence)
**Batch**: Y (2026-05-20)

**New surfaced_by**:
- `PostgresWALMessageProcessor.md:bugs_limitations_corner_cases.[4]` (HIGH) — "NO notification-delivery audit-event is emitted from the seam OR the implementor — `ActivityEventTypeDto.java:3-31` enumerates 26 activity event types (OWNERSHIP_CREATED, ALERT_STATUS_UPDATED, OPEN_ALERT_RECEIVED, RESOLVED_ALERT_RECEIVED, etc.) but ZERO of them name notification delivery. F-006's `audit_silence_enum_rooted` drift class names this exact enum gap as a root cause. From the seam's perspective: a dispatcher implementor cannot emit a notification-delivery activity event because the enum has no constant to name; the enum gap is a STRUCTURAL silence on this entire subsystem's observability." — evidence: PostgresWALMessageProcessor.java (seam interface) + ActivityEventTypeDto.java:3-31 (no NOTIFICATION_SENT / NOTIFICATION_FAILED / NOTIFICATION_DELIVERY_* constants)
- `PostgresWALMessageProcessor.md:security.known_security_gaps.[0]` (MEDIUM) — "seam carries no authentication / authorization context for the dispatcher to consume — `process(DecodedWALMessage)` has no principal, no scope, no audit-correlation id; an implementor wanting to emit an audit-event 'platform service identity sent alert X to channels [Y, Z]' has no per-message id to anchor it to — the LSN is only known to the caller (`NotificationSubscriber`)"
- `SlackNotificationSender.md:bugs_limitations_corner_cases.[3]` (HIGH) — "**No retry, no DLQ, no audit on failed Slack delivery (file-local manifestation of F-009 REFACTOR-127).** The contract here is single-attempt-or-fail. The dispatcher catches NotificationSenderException and moves on — there is no record in the ALERT table, no row in any audit table, no metric counter increment, no Prometheus 'notifications_sent_total{channel=\"Slack\",result=\"failure\"}' increment. An operator asking 'how many alerts went to Slack last week' or 'which alerts failed Slack delivery between 14:00 and 14:30 yesterday' has no answer beyond grep'ping log files for `Notification sender Slack:` substring."
- `WebhookNotificationSender.md:security.known_security_gaps.[5]` (MEDIUM) — "**No retry / no DLQ / no audit** — silent alert drop on transient failures. Operators auditing 'did the webhook receive alert X' have nothing beyond log-greppable receiver-id strings. — evidence: WebhookNotificationSender.java:19-23 + AlertNotificationMessageProcessor.java:30-35 + NotificationSubscriber.java:83-84 — severity: MEDIUM"

**Cross-batch insight (DOUBLE-STRUCTURAL-ROOT)**: F-006's audit-silence pattern was previously rooted in TWO structural causes by batches R and V:
1. **Schema-tier (batch R)** — `activity.data_entity_id NOT NULL FK` constraint at `V0_0_48__add_activity.sql:4,12` means non-data-entity events cannot be persisted to the activity table. ADR-146's original framing.
2. **Scope-correction tier (batch V)** — the data-entity tier (including DatasetFieldController) has SYMMETRIC audit coverage; F-006's audit-silence is SCOPED to the RBAC-directory-CRUD tier (Role / Policy / Owner) — per ADR-CANDIDATE-146 strengthen batch V.

Batch Y adds a THIRD structural root, ORTHOGONAL to both:
3. **SPI-seam tier (batch Y)** — the WAL bridge SPI (`PostgresWALMessageProcessor`) has `void process(DecodedWALMessage)` (per ADR-CANDIDATE-182). There is NO correlation-id parameter, NO LSN parameter, NO audit-context. The implementor (`AlertNotificationMessageProcessor`) literally cannot emit a notification-delivery audit event because (a) the SPI offers no surface for it AND (b) the `ActivityEventTypeDto` enum at `ActivityEventTypeDto.java:3-31` enumerates 26 event types — `OPEN_ALERT_RECEIVED`, `RESOLVED_ALERT_RECEIVED`, `OWNERSHIP_CREATED`, etc. — but ZERO `NOTIFICATION_*` constants. The enum has no `NOTIFICATION_SENT`, no `NOTIFICATION_FAILED`, no `NOTIFICATION_DELIVERY_RETRIED`.

The audit silence at the notification-delivery surface is therefore DOUBLE-STRUCTURALLY-ROOTED:
- **(a) ENUM-ROOTED** (F-006 original framing): even if the implementor wanted to call `activityService.log(NOTIFICATION_SENT, alertId)`, the enum has no constant to name.
- **(b) SCHEMA-ROOTED** (ADR-146 original framing): even if the enum had `NOTIFICATION_SENT`, the activity table requires `data_entity_id NOT NULL` — a notification-delivery event with no specific data-entity (e.g. a Slack 429 affecting a 50-alert burst) cannot be persisted.
- **(c) SPI-SEAM-ROOTED** (NEW batch Y): even if the schema were widened and the enum had constants, the SPI carries no correlation-id / LSN / audit-context for the implementor to anchor the audit event to.

The three structural barriers compound. Adding notification-delivery audit requires:
1. Widening the enum (`ActivityEventTypeDto`) with NOTIFICATION_* constants — touches F-006's drift surface.
2. Either widening the schema (NULLable `data_entity_id` + discriminator column) OR creating a sibling `notification_delivery_audit` table (per the pattern of OwnerAssociationRequest's dedicated audit table per ADR-CANDIDATE-167) — touches ADR-146's schema commitment.
3. Widening the SPI (`PostgresWALMessageProcessor.process(DecodedWALMessage, AuditContext context)` or adding a `getAuditContext()` companion method) — touches ADR-CANDIDATE-182's narrow-SPI commitment.

**The SPI-seam-rooted structural barrier is NEW in batch Y and was previously INVISIBLE** to the F-006 + ADR-146 framing. Batches D / E / F / R / V each addressed the audit-silence question without naming the SPI layer; batch Y's PostgresWALMessageProcessor sidecar surfaces this hidden structural cause.

**Updated SPI architecture as the third audit-silence-blocker** (now 3 structural barriers, not 2):
- **(a) ENUM** — `ActivityEventTypeDto.java:3-31` has no NOTIFICATION_* constants (the F-006 `audit_silence_enum_rooted_activity_event_type_dto_term_namespace_owner_lifecycle` drift class).
- **(b) SCHEMA** — `activity.data_entity_id NOT NULL FK` to `data_entity(id)` (ADR-146 original).
- **(c) SPI** — `PostgresWALMessageProcessor.process(DecodedWALMessage)` has no correlation-id parameter (NEW batch Y; per ADR-CANDIDATE-182).

**Pattern-strengthening rationale**: The 3-sidecar cross-layer triangulation (schema + enum + SPI) is the strongest possible support for the structural-vs-implementation framing. A future maintainer believing "we just need to add an `@ActivityLog` annotation to fix audit silence" would have to confront ALL THREE structural barriers. This ADR-strengthen makes the multi-layer commitment explicit.

**Severity unchanged at HIGH**. The 3-structural-barrier framing escalates the operator-visibility consequence: notification-delivery audit is BLOCKED at three layers, not two. F-006's audit-silence drift is structurally deeper than previously documented.

**Updated dependency chain** (now 4 ADRs):
- ADR-146 (schema-rooted audit-silence)
- ADR-167 (OwnerAssociationRequest dedicated audit table — the POSITIVE counter-example)
- ADR-182 NEW batch Y (narrow SPI seam — the third structural root)
- F-006 drift class `audit_silence_enum_rooted` (the enum-tier framing)

---
