---
id: IT-011
title: "Notifications (off by default) create the WAL replication slot + publication only when enabled"
gates:
  validates: []
  enforces: [ADR-0040, ADR-0044]
  regresses: []
test_class: integration
stack: odd-notifications
automation: "e2e:specs/notifications-wal-lifecycle.spec.ts"
plan_ref: "I3 (notifications WAL) — Tier-3; the deterministic lifecycle pin"
status: ready
expected_result: "GREEN — disabled (odd-minimal) has no replication slot; enabled (odd-notifications) lazily creates the slot + publication on the alert table."
---

# IT-011 — notifications WAL lifecycle (ADR-0040 / ADR-0044)

> **The deterministic backbone of the I3 notifications subsystem** (zero coverage before).
> It pins what is reliably true: the WAL machinery exists ONLY when notifications are
> enabled. End-to-end delivery (alert → WAL → webhook) is real but flaky on fresh boot
> due to a create-order wedge (PLT-139) — so the stable gate is the slot/publication
> lifecycle, not delivery. (Delivery is reproducible manually; see §4.)

## 1. What this checks
With `notifications.enabled=false` (the shipped default, ADR-0040) there is no WAL
subscriber and no logical-replication slot/publication. Enabling it makes the subscriber
(the advisory-lock leader, ADR-0043) **lazily create** a logical-replication slot
(`odd_platform_replication_slot`) + a publication (`odd_platform_publication_alert`) on
the `alert` table (ADR-0044). PASS = OFF stack has **0** such slots; ON stack has the slot
**and** the publication.

**Operator-facing consequence if it FAILS:** if the WAL infra were created while disabled,
an operator running the default config would silently carry a replication slot (which
retains WAL → disk growth); if it were NOT created when enabled, notifications would be
dead. Source: ADR-0040 (`NotificationsFeatureCondition`) · ADR-0044 (`NotificationSubscriber.java:104-158`) · `application.yml:172-179`.

## 2. Preparation — build the test stand
- **Stacks (two):**
  - OFF = the shared `odd-minimal` stack (`:18080`, pg `:15432`) — notifications disabled by default; brought up by the e2e global setup.
  - ON = `odd-notifications` (`lineage/_extractor/probe-stacks/odd-notifications.docker-compose.yml`): postgres **`wal_level=logical`** + the platform with `NOTIFICATIONS_ENABLED=true` + `NOTIFICATIONS_RECEIVERS_WEBHOOK_URL` → a webhook-echo stub. Platform `:18084`, pg `:15436`, project `oddnotif`. Brought up/torn down by the spec.
- **Run note:** do NOT run focused with `ODD_STACK_EXTERNAL=1` — that skips the OFF (odd-minimal) stack this test's first half needs.

## 3. Readiness check — is the stand ready?
- OFF platform: `curl -fsS http://localhost:18080/actuator/health` → UP.
- ON platform: `curl -fsS http://localhost:18084/actuator/health` → UP.

## 4. Run protocol — what to run
- **Automated rail**: `integration-tests/run-suite.sh I3-notifications-wal`
  (or `cd integration-tests/e2e && npx playwright test notifications-wal-lifecycle`).
- **Manual — the lifecycle gate:**
  1. OFF: `psql postgresql://odd-platform:odd-platform-password@localhost:15432/odd-platform -tAc "SELECT count(*) FROM pg_replication_slots WHERE slot_name='odd_platform_replication_slot'"` → **0**.
  2. ON: same query at `:15436` → **1**; `SELECT count(*) FROM pg_publication WHERE pubname='odd_platform_publication_alert'` → **1**.
- **Manual — end-to-end delivery (informational; flaky per PLT-139):** seed an entity, then
  `INSERT INTO alert (data_entity_oddrn,status,type,status_updated_at,last_created_at) VALUES ('<oddrn>',1,1,NOW(),NOW())` on the ON stack's DB; `docker logs probe-webhook-stub` should show the POSTed AlertNotificationMessage within ~5s. If it does not and `pg_replication_slots.active` is false with a "publication does not exist" error in the platform log, you have hit the PLT-139 wedge.

## 5. What it checks — assertions
- **PASS** when: OFF has 0 `odd_platform_replication_slot` slots; ON has the slot + the publication.
- **FAIL (ADR-0040)** when: the OFF (default) stack has the slot — WAL infra created while disabled.
- **FAIL (ADR-0044)** when: the ON stack lacks the slot or publication — enabling failed to create the WAL infra.

## 6. Result log
`integration-tests/run-log/{YYYY-MM-DD}-{suite-or-IT}.md`. Log fields:
`date · stack_commit · runner · outcome · evidence (OFF slot count, ON slot+pub counts) · notes`.

## Cross-references
- Source: ADR-0040 (notifications off by default — `NotificationsFeatureCondition`) · ADR-0043 (advisory-lock leader) · ADR-0044 (lazy slot+publication, no-drop — `NotificationSubscriber.java:104-158`) · F-009
- **Filed bug found building this:** **PLT-139** — the subscriber wedges permanently on fresh boot when the slot is created before the publication ("publication does not exist"), unrecoverable (no DROP path). This is why delivery is not the automated gate.
- Adjacent: **PLT-016** (WAL subsystem hardening), TEST-GAP-455/796.
- Plan: `lineage/odd-platform/test-plan.md` batch I3 (notifications WAL) + Tier-3.
- Automation: `integration-tests/e2e/specs/notifications-wal-lifecycle.spec.ts` (stack `helpers/notifications-stack.ts` + generic `helpers/stack.ts`).
