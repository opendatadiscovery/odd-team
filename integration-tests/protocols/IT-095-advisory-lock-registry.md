---
id: IT-095
title: "Advisory-lock registry — four distinct ids, deliberate partition share, silent collision"
gates:
  validates: [F-065]
  enforces: []
  regresses: [PLT-089]
test_class: integration
stack: odd-minimal
automation: "e2e:advisory-lock-registry.spec.ts"
plan_ref: I8
status: ready
---

# IT-095 — Postgres advisory-lock-id registry

> A protocol is the **source of truth** — a human can execute every step below
> WITHOUT any tooling. The `automation:` probe (if any) is a convenience rail
> that runs the same steps and writes the same result; it never replaces the
> protocol. Reproducible by construction: same preparation + same run = same check.

## 1. What this checks
The platform hand-numbers four Postgres advisory-lock ids across three `@ConfigurationProperties`
prefixes — `partition.advisory-lock-id=90`, `notifications.wal.advisory-lock-id=100`,
`datacollaboration.receive-event-advisory-lock-id=110`, `datacollaboration.sender-message-advisory-lock-id=120`
(`application.yml:177,197-202`) — acquired via blocking `pg_advisory_lock(id)`
(`PostgreSQLLeaderElectionManagerImpl.java:22`), with no central enum and no boot-time collision
validator. Falsifiable claims:
- **F-065-UC-1 (success)**: the four ids are distinct, valid advisory slots — a single session
  `pg_try_advisory_lock`-acquires all four (returns true ×4) and holds four distinct objids
  `[90,100,110,120]`. No collision.
- **F-065-UC-3 (pin)**: the partition id (90) is the single orchestrator slot, distinct from the three
  subsystem-private ids; the cross-subsystem share is by ONE acquisition over the `List<PartitionManager>`
  (`PostgreSQLPartitionCreationJob.java:31`), NOT by id duplication — so a naive all-distinct validator
  would wrongly reject it.
- **PLT-089 / UC-2+UC-5 (pin)**: a collision is SILENT — session A holds id 100, session B's acquire on
  100 fails (the real blocking `pg_advisory_lock` would hang forever) with NO error raised and no signal.

**Observable-scope note (honest)**: on odd-minimal the platform holds NO advisory lock — the partition
lock 90 is released when `PostgreSQLPartitionCreationJob`'s `@PostConstruct` connection closes, and
notifications + datacollaboration are disabled by default so 100/110/120 are never acquired. The
held-lock state is therefore NOT observable here; this protocol characterizes the distinctness +
silent-collision CONTRACT empirically instead. The spec asserts the empty `pg_locks` explicitly.

## 2. Preparation — build the test stand
- **Stack**: bring up `odd-minimal`. No seeds. ids 20950-20959 reserved; the spec transiently acquires
  the platform ids (90/100/110/120) inside sessions it then releases (`pg_advisory_unlock_all`) — it never
  leaves a lock held.
- **Auth/config**: odd-minimal defaults (DISABLED; notifications/datacollaboration off — the reason the
  locks are unheld).

## 3. Readiness check — is the stand ready?
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`
- No platform advisory locks held: `SELECT objid FROM pg_locks WHERE locktype='advisory'` → 0 rows.

## 4. Run protocol — what to run
1. Confirm `pg_locks` has no advisory rows (the platform holds none on odd-minimal).
2. In ONE session: `pg_try_advisory_lock(90/100/110/120)` then read this backend's held advisory objids;
   release.
3. Confirm 90 is distinct from {100,110,120} and independently acquirable (the shared partition slot).
4. Two sessions: A `pg_advisory_lock(100)`; B `pg_try_advisory_lock(100)` → observe false + no error.

**Automated rail**: `cd integration-tests/e2e && PATH="$HOME/.local/node/bin:$PATH" ODD_STACK_EXTERNAL=1 npx playwright test specs/advisory-lock-registry.spec.ts --reporter=line`

## 5. What it checks — assertions
- **PASS** when: all four try-acquires return true and yield distinct objids `[90,100,110,120]`; 90 is
  distinct from the private ids and acquirable; the collision on 100 returns false with NO error.
- **FAIL** when: two ids collapse to one objid (registry collision); OR the collision raises an error /
  a validator now rejects it (PLT-089 fixed — move the pin to the fail-fast promise).

## 6. Result log
Every run appends a dated entry to `integration-tests/run-log/{YYYY-MM-DD}-{suite-or-IT}.md`.
Log fields: `date · stack_commit · runner (AI/human + name) · outcome (PASS|FAIL) · evidence (captured values) · notes`.

## Cross-references
- Source: F-065 UC-1 / UC-2 / UC-3 / UC-5 (`lineage/odd-platform/feature-flows/detail/F-065.yaml`)
- Bug: PLT-089 (advisory-lock collision silent wedge; no registry/validator/readiness degradation)
- Code: `PostgreSQLLeaderElectionManagerImpl.java:22`, `PostgreSQLPartitionCreationJob.java:31`,
  `application.yml:177,197-202`
- Related: F-065-UC-6 is already covered by IT-012 (notifications WAL leader election + failover).
- Plan: `lineage/odd-platform/test-plan.md` batch I8
