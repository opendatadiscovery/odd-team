## REFACTOR-523 — Slack 429 rate-limit response treated as undifferentiated NotificationSenderException — Retry-After header silently ignored; bursts of alerts to a rate-limited webhook silently lost

**Severity**: MEDIUM
**Category**: missing-retry-after + missing-rate-limit + silent-burst-loss
**Batch**: Y (2026-05-20)
**Pillars affected**: [P-07-active-platform-features (Notifications Slack channel)]

**Surfaced by**:
- `SlackNotificationSender.md:bugs_limitations_corner_cases.[0]` (HIGH) — "**Slack 429 rate-limit returns NotificationSenderException undifferentiated from 4xx / 5xx — Retry-After header silently ignored.** Slack documents its incoming-webhooks as rate-limited to ~1 message per second per webhook (short bursts allowed); on excess, Slack returns 429 with a `Retry-After: N` header. `AbstractNotificationSender.java:26` checks only `response.statusCode() != 200` — every non-200 raises an identical NotificationSenderException with the same message string and no body / status-code / header information. ... Operators with high-cardinality alert bursts (e.g. a single failed dbt run that produces 50+ alerts) will silently lose most of them to rate-limiting with no operator-visible signal beyond the log-line."

**Statement**: Slack documents incoming-webhooks at ~1 message/second per webhook (with short bursts allowed). On excess, Slack returns HTTP 429 with `Retry-After: N` header indicating seconds to wait. ODD's check at `AbstractNotificationSender.java:26` is `response.statusCode() != 200` — 429 is treated identically to any other non-200 status:
- Single uniform `NotificationSenderException` thrown
- Dispatcher catches + logs + moves on
- Alert is LOST from the Slack channel
- Retry-After header is never read

A burst of 50 alerts (e.g. dbt run failing 50 test rules) -> ~49 alerts lost to 429.

**Compound effect with REFACTOR-518**: No retry, no DLQ, no audit = burst losses are silent + unrecoverable.

**Evidence**:
- `AbstractNotificationSender.java:24-29` — no Retry-After / no rate-limit handling
- Slack incoming-webhook documentation (~1 msg/s rate limit)

**Existing-ADR-or-implied-prescription**:
- ADR-CANDIDATE-186 NEW batch Y codifies "one-shot fire-and-forget; no Retry-After honoring" — this IS the design choice. The ADR explicitly lists REFACTOR-523 as a co-surfaced gap (Slack 429 silently dropped).

**Proposed remedy**:

1. **Path A (per-status-class branching)** — On 429, read `Retry-After` header and sleep before returning failure. Allows the next alert to be delivered after the rate-limit window. Requires extending `AbstractNotificationSender.sendAndValidate` with per-status-class logic.

2. **Path B (client-side rate limiter)** — Add a token-bucket rate limiter to `SlackNotificationSender`. Slow burst delivery to match Slack's ~1msg/s limit. Trade-off: backs up the WAL dispatcher under high-burst scenarios.

3. **Path C (per-channel retry queue with Retry-After honoring)** — Persist failed-with-429 alerts to a retry table. Background scheduler retries respecting Retry-After. Structural change.

Path B is the SHIP-FAST minimum (matches Slack's documented limit). Path C is the cleanest long-term answer.

**Severity rationale**: MEDIUM — bounded by Slack's specific behaviour; burst losses are real for high-cardinality alert sources; cross-references REFACTOR-518 (no retry/DLQ compounds this).

**Suggested backlog grouping**: `Notifications hardening sprint`.

---
