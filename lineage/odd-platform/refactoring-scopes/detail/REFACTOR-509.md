## REFACTOR-509 — WAL retention disk-exhaustion via replication-slot orphan/rename — PG primary disk fills with un-released WAL when slot accumulates undelivered messages or when operator renames slot without dropping the old one

**Severity**: HIGH
**Category**: missing-cleanup + buggy-default + observability
**Batch**: Y (2026-05-20)
**Pillars affected**: [P-07-active-platform-features (Notifications sub-feature operational fragility), P-10-deployment-architecture (PG-primary-disk failure mode)]

**Surfaced by**:
- `NotificationSubscriber.md:bugs_limitations_corner_cases.[4]` (MEDIUM) — "**Replication-slot orphan on slot-name rename** — if an operator changes `notifications.wal.replication-slot-name` between deploys without first running `SELECT pg_drop_replication_slot('<old_name>')` (per the live doc cleanup SQL), the OLD slot accumulates WAL forever on the primary. Risk: primary disk exhaustion. The lazy-create at L113-120 creates the NEW slot fine — the OLD slot is now invisible to ODD Platform but still pinned by Postgres."
- `NotificationSubscriber.md:performance.known_performance_gaps.[3]` (HIGH) — "**Poison-message replay loop pins WAL position** — the un-advanced LSN on a persistently-failing process() call means PG WAL grows indefinitely. Under sustained poison-replay conditions, primary disk exhaustion is real. This is the F-009 pillar's load-bearing performance pathology and the single most consequential operator-facing risk in the subsystem."

**Statement**: ODD's PostgreSQL primary can run out of disk space due to ONE of two WAL-retention failure modes — both structural consequences of the lazy-create-no-drop replication-artefact policy (per ADR-CANDIDATE-028):

1. **Orphan-slot via rename without drop**. The operator changes `notifications.wal.replication-slot-name` from `odd_platform_replication_slot` to `odd_platform_replication_slot_v2` (e.g. during a config-refactor) and redeploys. The lazy-create at `NotificationSubscriber.java:113-120` correctly creates the NEW slot. The OLD slot is now invisible to ODD Platform — but Postgres still has it registered in `pg_replication_slots` with `confirmed_flush_lsn` pinned at whatever value it was at when the operator changed the config. PG retains ALL WAL since that pinned LSN, growing the primary's `pg_wal/` directory indefinitely. The live doc names the cleanup SQL (`SELECT pg_drop_replication_slot('<replication_slot_name>')`) but the rename-vs-drop sequencing is documented only at the very bottom of the page.

2. **Pinned-slot via poison-message replay**. A persistently-failing alert (per REFACTOR-508) means the LSN-advance at NotificationSubscriber.java:83-84 NEVER fires for that message; the slot's `confirmed_flush_lsn` stays at the bad message's LSN; every subsequent alert's WAL is retained behind it. After hours-to-days of accumulation, the PG primary's disk fills.

**Operational consequences**:
- **Primary disk exhaustion is the load-bearing operational risk.** Postgres requires WAL writes to succeed for ALL transactions on the primary — when `pg_wal/` fills, the primary stops accepting writes. The platform's ENTIRE data plane (ingestion, UI mutations, RBAC, search) blocks. This is potentially the most severe operational failure mode the Notifications subsystem can cause.
- **No ODD-side telemetry surfaces the risk.** Operators must query `pg_replication_slots.confirmed_flush_lsn` / `pg_wal_lsn_diff(pg_current_wal_lsn(), confirmed_flush_lsn)` to observe subscriber-induced WAL retention. ODD does NOT emit a Prometheus gauge for slot lag.
- **The lazy-create-no-drop policy (ADR-CANDIDATE-028) is the DELIBERATE design choice** that enables this failure mode. The policy is deliberate (operators own cleanup is a documented commitment); the missing TELEMETRY is the GAP.
- **The two failure modes can compound.** A poison-message replay can persist for days unnoticed; if the operator then attempts to rotate the slot name (without dropping the bad one), the orphan-slot retention accumulates ON TOP of the already-retained WAL — the second failure mode amplifies the first.

**Evidence**:
- `NotificationSubscriber.java:104-126` — lazy-create slot with no rename detection
- `NotificationSubscriber.java:128-158` — lazy-create publication
- `NotificationSubscriber.java:77-91` — the LSN-advance-after-process pattern (the poison-replay enabler)
- Live doc at `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform#enable-alert-notifications` verbatim: "ODD Platform doesn't clean up replication slot it has created." + cleanup SQL block
- ADR-CANDIDATE-028 (lazy-create-no-drop pattern) — the deliberate design choice
- ADR-CANDIDATE-180 NEW batch Y (at-least-once via LSN-after-process) — the poison-replay enabler
- REFACTOR-508 NEW batch Y (poison-message replay loop) — the LOAD-BEARING peer failure

**Existing-ADR-or-implied-prescription**:
- ADR-CANDIDATE-028 codifies the lazy-create-no-drop policy — this scope is the OPERATIONAL CONSEQUENCE.
- ADR-CANDIDATE-180 NEW batch Y codifies LSN-after-process — this scope is the OPERATIONAL CONSEQUENCE of that design.
- Live doc names the cleanup SQL but does NOT name (a) the orphan-slot-on-rename hazard or (b) the poison-replay slot-pin hazard. DOC-NNN follow-up needed.

**Proposed remedy**:

1. **Path A (observability — minimum risk)** — Add a Prometheus gauge `notifications_wal_slot_lag_bytes` that periodically queries `pg_wal_lsn_diff(pg_current_wal_lsn(), confirmed_flush_lsn)` from `pg_replication_slots` filtered by `slot_name = notifications.wal.replication-slot-name`. Alert operators when lag > threshold (e.g. 10 GB). Does NOT prevent the failure; surfaces it before disk fills.

2. **Path B (orphan-detection at boot)** — At `NotificationSubscriber` startup, query `pg_replication_slots WHERE slot_name LIKE 'odd_platform%' AND slot_name != <configured>`. Log WARN for each orphan found with cleanup SQL guidance. Optional fail-fast on detection (operator-tunable).

3. **Path C (poison-message-replay-aware retention metric)** — Add a Prometheus counter `notifications_wal_consecutive_failures_total` (per REFACTOR-508). Cross-correlate with the slot-lag gauge — high lag + high consecutive failures = poison-replay diagnosis.

4. **Path D (operator-friendly cleanup)** — Add a Spring Actuator endpoint OR a maintenance REST endpoint `DELETE /api/maintenance/wal/orphan-slots` that runs the documented `pg_drop_replication_slot(...)` for slots matching ODD's naming convention. Operator-driven cleanup without needing PG-direct access.

Path A is the SHIP-FAST minimum (operationally critical observability). Path B is the boot-time-detection complement. Path C is the diagnostic correlator for REFACTOR-508. Path D is the operator-control-plane convenience.

**Severity rationale**: HIGH — primary PG disk exhaustion is potentially the most severe operational failure ODD can cause; the absence of telemetry means operators discover the problem only after disk fills; cross-references REFACTOR-508 (the poison-replay enabler) and ADR-CANDIDATE-028 (the design choice that enables both failure modes).

**Suggested backlog grouping**: `Notifications hardening sprint` (per REFACTOR-508).

---
