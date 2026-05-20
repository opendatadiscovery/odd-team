## REFACTOR-532 — No fan-out scoping by data-entity owner / namespace / tenant — every WAL ALERT event is broadcast to every configured channel; cross-team alert visibility is structural; SPI seam has no shape to express owner-aware routing

**Severity**: MEDIUM
**Category**: missing-scoping + structural-broadcast
**Batch**: Y (2026-05-20)
**Pillars affected**: [P-07-active-platform-features (Notifications dispatch), P-09-security-access-control (data-residency)]

**Surfaced by**:
- `NotificationSubscriber.md:security.known_security_gaps.[4]` (MEDIUM)
- `NotificationSubscriber.md:security.owner_scoping` (BYPASSES)
- `PostgresWALMessageProcessor.md:security.owner_scoping` (BYPASSES — "the seam carries a `DecodedWALMessage` with no owner / namespace / principal context. The implementor's downstream translator (AlertNotificationMessageTranslator.java:74-83) materialises `dataEntity.owners[]` but never consults it for routing — every configured channel receives every alert regardless of the alerted data entity's Owner.")

**Statement**: The dispatcher iterates all configured senders sequentially with NO routing. The SPI (`PostgresWALMessageProcessor.process(DecodedWALMessage)`) carries no owner / namespace / scope context. The translator materialises `dataEntity.owners[]` but ONLY for payload rendering (mentions in Slack, owner list in webhook payload) — never for routing.

This is the structural consequence of ADR-CANDIDATE-187 (single-destination-per-deployment) + ADR-CANDIDATE-182 (narrow SPI seam with no owner context). REFACTOR-514 covers the cross-tenant exposure ANGLE; this scope covers the architectural ROUTING SHAPE gap.

**Evidence**:
- `AlertNotificationMessageProcessor.java:25-36` — unconditional sender iteration
- `PostgresWALMessageProcessor.java:6` — SPI shape
- `AlertNotificationMessageTranslator.java:74-83` — owners materialized but not consulted for routing
- ADR-CANDIDATE-182 + ADR-CANDIDATE-187 NEW batch Y

**Proposed remedy**: Cross-link with REFACTOR-514's Path B / Path C (per-owner / per-namespace channel routing). Requires extending the SPI seam.

**Severity rationale**: MEDIUM — the architectural shape; operator-visible consequence is REFACTOR-514 (cross-tenant); both should be addressed together.

**Suggested backlog grouping**: `Multi-tenancy architecture review` (cross-link REFACTOR-514).

---
