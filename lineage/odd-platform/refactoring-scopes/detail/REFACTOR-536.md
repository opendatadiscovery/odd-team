## REFACTOR-536 — Replication connection opened EVERY outer-loop iteration — on stable leader it's long-lived, but on unstable leader (frequent inner-loop exceptions) each retry opens a new Connection + slot probe + publication probe = 3 round-trips per 10s

**Severity**: LOW
**Category**: performance + connection-churn-cost
**Batch**: Y (2026-05-20)
**Pillars affected**: [P-07-active-platform-features (Notifications subsystem performance under instability)]

**Surfaced by**:
- `NotificationSubscriber.md:bugs_limitations_corner_cases.[11]` (LOW) — "**Replication connection is opened EVERY outer-loop iteration** — the try-with-resources at L47 acquires a fresh Connection per leader-acquisition cycle. On a stable leader the outer loop never iterates (the inner while-true holds the stream until interrupted or exception), so the connection is long-lived. But on an unstable leader (frequent exceptions in the inner loop), each retry opens a new Connection + replication-slot probe + publication probe = 3 round-trips per retry, every 10s. Under churn this could overwhelm a stressed Postgres. No connection caching, no probe-result caching."

**Statement**: At `NotificationSubscriber.java:46-92`:
```java
try (final Connection connection = leaderElectionManager.acquire(...)) {
    // slot probe (1 round-trip)
    // publication probe (1 round-trip)
    // open stream (1 round-trip)
    // inner while-true loop
}
```
The try-with-resources scopes the entire WAL processing. Under stable leadership, the inner loop holds the stream indefinitely — one Connection per leader-acquisition. Under instability (frequent inner-loop exceptions per REFACTOR-508), each retry opens a NEW Connection + re-probes the slot + re-probes the publication.

For poison-replay scenarios: 6 retries/minute × 3 round-trips = 18 PG round-trips/minute under churn. Combined with a stressed PG primary, this adds load to the failing component.

**Evidence**:
- `NotificationSubscriber.java:46-92` — the connection lifecycle scope

**Proposed remedy**: Cache the probe results across retries. If the slot existed on attempt N, it still exists on attempt N+1 (the slot is not deleted by the platform). Same for publication.

**Severity rationale**: LOW — only triggers under pre-existing instability; the load amplification is bounded.

**Suggested backlog grouping**: `Notifications throughput optimization`.

---
