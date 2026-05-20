## REFACTOR-326 — Housekeeping no rate-limit / no kill-switch / no preview on destructive cycle — once `housekeeping.enabled=true`, the cycle fires unconditionally every 15 minutes; an operator who notices a misconfiguration has 15 minutes before next-cycle fires with no in-cycle abort

**Severity**: MEDIUM
**Category**: missing-validation (no-kill-switch)
**Pillars affected**: [P-08-management-administration]
**Batch**: K (2026-05-19)

**Surfaced by**:
- `odd-platform__java__service__service__HousekeepingJobManager.md:security.known_security_gaps.[1]` (MEDIUM) — "No rate-limit / no kill-switch / no preview mechanism on the destructive cycle. Once `housekeeping.enabled=true`, the cycle fires unconditionally every 15 minutes. There is no operator-overrideable gate to pause an in-progress cycle, no `kill -USR1` style runtime knob, no preview mode. An operator who notices in real-time that `housekeeping.ttl.data_entity_delete_days=1` was accidentally deployed has approximately 15 minutes until the next cycle fires, after which the cascade runs to completion (or to S3 timeout) — there is no in-cycle abort."

**Description**: The housekeeping subsystem has no runtime kill-switch. `housekeeping.enabled=true` AND a misconfigured TTL produces an immediately-destructive deployment. The operator's only mitigations are: (a) restart the JVM during a cycle (kills the connection and rolls back the in-progress transaction, but operator must time it precisely AND only stops THIS cycle — the next 15-minute cycle re-fires); (b) hot-edit the `application.yml` to set `housekeeping.enabled=false` and restart (15 minutes max delay between detection and disabling). Both mitigations are time-sensitive and require operator awareness; there is no per-cycle confirmation, no admin API to pause the subsystem, no in-cycle abort signal.

**Failure mode**: An operator notices at 14:32 that the deployment at 14:30 set `housekeeping.ttl.data_entity_delete_days=0`. The next cycle fires at 14:45 (worst case 15 minutes from 14:30 deployment). The operator has 13 minutes to: (a) rollback the application.yml change AND (b) restart the JVM before 14:45. If they miss the window, the cascade runs at 14:45 to completion.

**Primary source citations**:
- `HousekeepingJobManager.java:25-39` (no rate-limit, no kill-switch field, no preview check before invoking `housekeepingJob.doHousekeeping(connection)`)

**Existing-ADR-or-implied-prescription**: None. ADR-CANDIDATE-046 (opt-out by shipped default) is the shipping stance; the IMPLIED prescription is that the shipping stance assumes operators have CORRECTLY configured the TTLs at deployment time. The absence of a runtime kill-switch is a feature gap, not an ADR-level decision.

**Proposed remedy**: Two composable fixes. (a) **Admin API for runtime pause**: add `PUT /api/admin/housekeeping/{enabled|disabled}` (gated by a dedicated `PLATFORM_OPERATIONAL_CONTROL` permission) that flips an in-memory `AtomicBoolean` consulted at the start of each cycle. The change takes effect on the next cycle (no current-cycle abort). (b) **Per-cycle confirmation gate**: at the start of each cycle, log `INFO: starting housekeeping cycle; will delete approximately N rows from {tables}` (computed via COUNT queries); operator can interrupt within a small window before the DELETEs run. The cost is the COUNT round-trip per table per cycle (negligible compared to the DELETE).

**Severity rationale**: MEDIUM — operability gap; compounds with REFACTOR-325 (no dry-run) and REFACTOR-141 (primitive defaults = 0) to produce the "operator-typo → next-cycle data loss" failure mode. Each mitigation reduces blast radius independently.

**Suggested backlog grouping**: `Housekeeping safety sprint` (with REFACTOR-141, -142, -145, -325)

---
