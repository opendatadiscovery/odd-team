## REFACTOR-310 — NotificationsDispatcher sender iteration order is Spring-bean-order-dependent — `List<NotificationSender>` injected with no `@Order` annotation; order is class-scan-order-dependent in practice; slowest sender may end up first, blocking the others

**Severity**: LOW
**Category**: observability (undefined-order behaviour)
**Pillars affected**: [P-07-active-platform-features]
**Batch**: K (2026-05-19)

**Surfaced by**:
- `odd-platform__java__service__service__NotificationsDispatcher.md:bugs_limitations_corner_cases.[5]` (LOW) — "Sender iteration order is undefined / Spring-bean-order-dependent. `List<NotificationSender>` is injected as a bean collection. The order — Slack first? Email last? — depends on Spring's bean-registration order, which is class-scan-order-dependent in practice. A change to the codebase (rename, package move, conditional registration order change) can silently flip the order and the slowest sender now sits first, blocking the others."

**Description**: `AlertNotificationMessageProcessor.java:19` declares `private final List<NotificationSender<AlertNotificationMessage>> notificationSenders;` — Spring injects all `@Component`-registered NotificationSender beans into the list. The order is Spring's bean-collection-order (typically class-scan-order, which depends on package layout + naming + conditional-registration order). There is NO `@Order` annotation on any sender, NO `Comparator`, NO explicit sort at the dispatcher. A refactor that renames `EmailNotificationSender` to `MailNotificationSender` (moving it alphabetically before `SlackNotificationSender`) or adds a new `@ConditionalOnProperty` to one of the senders could silently flip the iteration order.

**Failure mode**: Combined with the sequential synchronous fan-out (ADR-CANDIDATE-099) and the SMTP infinite timeouts (REFACTOR-130 batch C), a refactor that flips email-from-last to email-first means a 30-second SMTP timeout now delays Slack + webhook delivery by 30 seconds PER ALERT. Operators have no observable signal of the order change beyond timing degradation across all channels.

**Primary source citations**:
- `AlertNotificationMessageProcessor.java:19` (`private final List<NotificationSender<AlertNotificationMessage>> notificationSenders;` — no `@Order` annotation, no `Comparator`, no explicit sort)
- Grep `@Order` against `notification/sender/` directory returns zero matches.

**Existing-ADR-or-implied-prescription**: None. ADR-CANDIDATE-099 (NEW batch K — sequential synchronous fan-out) acknowledges the sequential model; the order question is below the ADR's framing layer. The IMPLIED prescription is that order should be DETERMINISTIC and OPERATOR-CONFIGURABLE if it matters for SLA; the absence is a minor architectural gap.

**Proposed remedy**: One-line fix per sender bean — annotate each `@Component` sender with `@Order(N)` where N is the desired iteration position. Suggested order: fast non-blocking first (Slack 200ms p99) → webhook (operator-controlled, variable) → email (SMTP, slowest). Document the order in the live notifications page.

**Severity rationale**: LOW — latent fragility; today's iteration order is OK by accident (Slack alphabetically before Email), but a future refactor could silently regress it. The fix is one-line per sender.

**Suggested backlog grouping**: `Notifications hardening sprint` (small code-hygiene item)

---
