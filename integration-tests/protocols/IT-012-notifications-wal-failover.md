---
id: IT-012
title: "Notification WAL leadership fails over: exactly one replica leads via an advisory lock; killing it hands over to a standby"
gates:
  validates: []
  enforces: [ADR-0043]
  regresses: []
test_class: integration
stack: odd-notifications-ha
automation: "e2e:specs/notifications-wal-failover.spec.ts"
plan_ref: "I3 (notifications WAL) — Tier-3; the 2-replica advisory-lock failover"
status: ready
expected_result: "GREEN — one replica holds the advisory lock (leader) + the other blocks; killing the leader hands the lock to the standby within seconds."
---

# IT-012 — notification WAL leader failover (ADR-0043)

> **The HA half of the notification subsystem** (zero coverage before). It proves the
> single-leader election + failover: two replicas share one Postgres; exactly one acquires
> the blocking advisory lock and reads the WAL, the other blocks, and when the leader dies
> the standby takes over.

## 1. What this checks
ADR-0043: the subscriber's first action is a **blocking** `acquire(advisoryLockId=100)`,
so exactly ONE replica leads (holds the lock, reads the WAL) and the other **blocks**.
PASS = one GRANTED advisory lock (the leader) + at least one WAITING (the standby); after
killing the leader, a **different** backend holds the granted lock (the standby took over).

**Operator-facing consequence if it FAILS:** if leadership did not fail over, a single
platform-pod restart/crash would silently stop all alerting until that exact pod came back
(or, if two led at once, duplicate notifications). HA notification delivery depends on this.
Source: ADR-0043 · `NotificationSubscriber.java:47` (blocking acquire) · `NotificationSubscriberStarter.java:21-23` (single named thread).

**Interaction with PLT-139 (important):** a fresh leader may hit the create-order wedge
(PLT-139) — which **destabilises leadership** (the wedged subscriber flaps the advisory
lock instead of holding it, so there is no stable leader). The test therefore first ensures
a **clean** leader (`ha-stack.ensureCleanLeader`: if wedged, drop the slot + restart the
leader so the publication pre-exists). The standby never wedges — it blocks on the lock
*before* the WAL stream. This is a documented precondition for the separately-filed PLT-139,
not part of the failover assertion.

## 2. Preparation — build the test stand
- **Stack**: `odd-notifications-ha` (`lineage/_extractor/probe-stacks/odd-notifications-ha.docker-compose.yml`):
  postgres `wal_level=logical` (pg `:15437`) + TWO platform replicas `probe-odd-platform-a`
  (`:18085`) + `probe-odd-platform-b` (`:18086`), both `NOTIFICATIONS_ENABLED=true`, same DB.
  Project `oddha`. The spec brings up **A first** (deterministic leader), ensures it is clean,
  then **B** (standby); kills A.
- **Browser toolchain**: Node 18+ → `cd integration-tests/e2e && npm install`. No browser (DB-state + docker).

## 3. Readiness check — is the stand ready?
- A healthy: `curl -fsS http://localhost:18085/actuator/health` → UP.
- B healthy: `curl -fsS http://localhost:18086/actuator/health` → UP.
- Clean leader: `psql "$ODD_HA_DB_URL" -tAc "SELECT active FROM pg_replication_slots WHERE slot_name='odd_platform_replication_slot'"` → `t`; one granted advisory lock.

## 4. Run protocol — what to run
- **Automated rail**: `integration-tests/run-suite.sh I3-notifications-wal`
  (or `cd integration-tests/e2e && ODD_STACK_EXTERNAL=1 npx playwright test notifications-wal-failover`).
- **Manual (human-carryable)**:
  1. `psql "$ODD_HA_DB_URL" -tAc "SELECT pid, granted FROM pg_locks WHERE locktype='advisory'"` → one `granted=t` (leader pid) + one `granted=f` (standby blocking). Note the leader pid.
  2. `docker stop probe-odd-platform-a` (kill the leader).
  3. Re-run the query within ~10s → one `granted=t` with a **different** pid (the standby, now leader).

## 5. What it checks — assertions
- **PASS** when: exactly one granted advisory lock + ≥1 waiting before the kill; after killing the leader, the granted advisory lock is held by a different (non-null) backend within the timeout.
- **FAIL (election)** when: zero or two granted advisory locks before the kill — no single leader (note: a PLT-139-wedged leader produces zero stable grants; the test un-wedges first).
- **FAIL (failover)** when: after the leader dies no standby acquires the lock (granted stays null) — failover broken.

## 6. Result log
`integration-tests/run-log/{YYYY-MM-DD}-{suite-or-IT}.md`. Log fields:
`date · stack_commit · runner · outcome · evidence (leader pid before; new holder pid after) · notes`.

## Cross-references
- Source: ADR-0043 (WAL single-leader + failover) · `NotificationSubscriber.java:47` · `NotificationSubscriberStarter.java:21-23` · advisory lock id 100 (`application.yml:177`)
- **Blocked-without-the-precondition by PLT-139:** the create-order wedge destabilises leadership (a wedged leader flaps the advisory lock — no stable leader, all alerting dead cluster-wide). IT-012 un-wedges the leader first; the wedge is the higher-severity filed bug.
- Sibling: **IT-011** (notifications WAL lifecycle — slot/publication created when enabled).
- Plan: `lineage/odd-platform/test-plan.md` batch I3 (notifications WAL) + Tier-3.
- Automation: `integration-tests/e2e/specs/notifications-wal-failover.spec.ts` (orchestration `helpers/ha-stack.ts`).
