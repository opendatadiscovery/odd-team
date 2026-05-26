# REFACTOR-634 — Slack at-least-once event delivery produces duplicate downstream `message_provider_event` rows → duplicate child `message` rows; no `event_id` dedup, no uniqueness constraint, no `ON CONFLICT`

**Severity**: HIGH
**Category**: missing-idempotency + missing-uniqueness-constraint
**Pillars affected**: [P-07 Active Platform Features (Discussions), P-02 Data Modelling]
**Batch**: ZF (2026-05-25)

**Surfaced by**:
- `odd-platform__java__EventApiController__controller-class__EventApiController.md:bugs_limitations_corner_cases.[2]` (HIGH) — "**No idempotency / dedup on Slack at-least-once delivery.** Slack documents that the Events API retries undelivered events for up to 3 attempts and may double-deliver under load (`https://api.slack.com/apis/events-api#retries`). The `message_provider_event` table (V0_0_59__data_collaboration.sql:25-39) has no unique constraint on `(provider, event_id)` or any equivalent — `id` is a BIGSERIAL and the only constraints are the PK on `id` and an FK on `(parent_message_uuid, parent_message_created_at)`. The repository INSERT (ReactiveMessageRepositoryImpl.java:136-155) performs a plain `INSERT INTO message_provider_event` with no `ON CONFLICT` clause."
- `odd-platform__java__EventApiController__controller-class__EventApiController.md:security.known_security_gaps.[2]` — same finding cross-referenced.
- `odd-platform__java__EventApiController__controller-class__EventApiController.md:stress_findings.resource_boundaries.[0]` — "**Two simultaneous deliveries of the same Slack event_id insert two `message_provider_event` rows** (no unique constraint per V0_0_59__data_collaboration.sql:25-39, no ON CONFLICT in the INSERT). The downstream processor then materialises two child message rows; `getUUIDByProviderInfo` (ReactiveMessageRepositoryImpl.java:188-195) under multi-row matches returns an arbitrary uuid because the SELECT has no LIMIT and no ORDER BY."

**Description**: Slack's Events API explicitly documents at-least-once delivery — events are retried for up to 3 attempts if the receiver does not respond with 2xx within 3 seconds (`https://api.slack.com/apis/events-api#retries`). Receivers MUST dedupe by `event_id` (a unique UUID per event Slack assigns) to avoid duplicate processing.

The platform does NONE of:
1. Capture `event_id` from the inbound event payload (the parser at SlackEventParser.java:22-111 extracts type / channel / thread_ts / ts / user / text — but never reads `event_id`).
2. Persist `event_id` to `message_provider_event` (the schema at V0_0_59__data_collaboration.sql:25-39 has no `event_id` column).
3. Apply a UNIQUE constraint on `(provider, event_id)` (no such constraint exists).
4. Use `INSERT ... ON CONFLICT DO NOTHING` when persisting (the repository INSERT is plain).

The result of a Slack at-least-once retry (a routine occurrence under high event load):
1. First delivery → controller acks 200 → row inserted into `message_provider_event` → processor materialises a child message.
2. Slack retries because of timeout / network glitch / load spike → controller acks 200 → second row inserted with a DIFFERENT BIGSERIAL `id` but SAME logical event (same `thread_ts`, same `text`, same `user`, same `ts`) → processor materialises a SECOND child message.

Combined with the downstream materialisation behaviour at `ReactiveMessageRepositoryImpl.getUUIDByProviderInfo` (line 188-195) which does `select uuid from message where provider_message_id = ? and provider = ?` WITH NO `LIMIT 1` and NO `ORDER BY`, the duplicate rows behave per JOOQ's `mono(query)` undefined-on-multi-row contract — effectively first-row-returned but order undefined under multi-row.

**Operator-visible failure modes**:

1. **Duplicate messages in Discussions tab** — a Slack thread reply appears twice (or N times) in the data-entity's Discussions tab, with identical text but different message UUIDs. The platform displays both.

2. **Confused message-URL resolution** — when a user clicks "Open in Slack" on either duplicate, the redirect resolves to the same Slack permalink. From the user's perspective, two distinct UI rows lead to the same Slack message.

3. **Compounding under network instability** — a Slack outage or platform-side network degradation triggers retries; retries pile up; the duplicate-row count grows non-linearly.

4. **Forged-event amplification** (combined with REFACTOR-633) — an attacker who can forge events can amplify their impact by replaying the same forged payload N times; each replay inserts a new row.

**Primary source citations**:
- `<odd-platform-api>/src/main/java/.../SlackEventParser.java:22-111` (parser; does not read `event_id`).
- `<odd-platform-api>/src/main/java/.../ReactiveMessageRepositoryImpl.java:136-155` (repository INSERT; no ON CONFLICT).
- `<odd-platform-api>/src/main/java/.../ReactiveMessageRepositoryImpl.java:188-195` (downstream multi-row tolerant SELECT).
- `<odd-platform-api>/src/main/resources/db/migration/V0_0_59__data_collaboration.sql:25-39` (schema; no `event_id` column, no UNIQUE constraint).
- Slack docs at `https://api.slack.com/apis/events-api#retries` (the at-least-once contract).

**Existing-ADR-or-implied-prescription**: No ADR prescribes idempotency; the gap is the absence of a defence-in-depth feature. The pattern of "idempotent webhook receivers" is webhook-architecture standard practice. Sibling gap: REFACTOR-234 (AlertManager webhook retries produce duplicate ALERT rows — same class-of-bug on a different webhook).

**Proposed remedy**: Three-part fix:

1. **Add `event_id` column to `message_provider_event`** via a new migration `V0_0_NN__message_provider_event_idempotency.sql`:

```sql
ALTER TABLE message_provider_event
  ADD COLUMN event_id VARCHAR(64);

-- partial unique index (event_id may be NULL for legacy rows pre-migration)
CREATE UNIQUE INDEX uniq_message_provider_event_event_id
  ON message_provider_event(provider, event_id)
  WHERE event_id IS NOT NULL;
```

2. **Update the parser + handler to extract and persist `event_id`**:
   - `SlackEventParser.parse(...)` reads `event_id` from the Slack envelope's top-level `event_id` field.
   - `SlackMessageProviderEventHandler.enqueueEvent(...)` passes `event_id` to the repository.
   - Repository INSERT becomes `INSERT INTO message_provider_event(..., event_id) VALUES (...) ON CONFLICT (provider, event_id) DO NOTHING`.

3. **Add `X-Slack-Retry-Num` short-circuit** (defense-in-depth):
   - Read `X-Slack-Retry-Num` header in the controller.
   - If `retry_num >= 1`, log at INFO level (operator-visible signal that Slack is retrying); proceed with the dedup INSERT (the partial unique index handles the actual dedup).

4. **Add integration tests**:
   - Same event delivered twice → only one downstream message row.
   - Concurrent simultaneous deliveries → only one downstream message row (the partial unique index enforces this).
   - Legacy row (event_id IS NULL, pre-migration) coexists with new rows.

**Severity rationale**: HIGH — duplicate messages are user-visible (Discussions tab shows duplicates); under attacker control (combined with REFACTOR-633), the duplicate row growth is unbounded. The schema fix is small and the cost-benefit overwhelming. This is the canonical idempotency-of-webhook-receivers pattern, applied to one of the platform's most user-visible features.

**Suggested backlog grouping**: `Slack-events hardening sprint` — pair with REFACTOR-633 (signature verification) + REFACTOR-643 (rate-limit). The four together form the complete webhook-hardening backlog item.

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-234 (AlertManager webhook idempotency — same shape on different webhook); REFACTOR-566 (Activity emit non-idempotent — same class-of-bug on different surface).
- SUPERSEDES: none.
- CONFLICTS: none.

---
