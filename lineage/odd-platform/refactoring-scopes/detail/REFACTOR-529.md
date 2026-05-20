## REFACTOR-529 — Per-message LSN acknowledgement — every successful `process()` advances `setAppliedLSN` + `setFlushedLSN` individually; no batched ack; under high alert rates this adds measurable PG round-trip overhead

**Severity**: LOW
**Category**: performance + per-message-overhead
**Batch**: Y (2026-05-20)
**Pillars affected**: [P-07-active-platform-features (Notifications WAL throughput)]

**Surfaced by**:
- `NotificationSubscriber.md:performance.known_performance_gaps.[0]` (LOW) — "**Per-message LSN ack** — every successful process() call advances setAppliedLSN + setFlushedLSN individually. Batched ack (advance once per N messages, with a `setFlushedLSN(maxLSN)` periodically) would reduce PG ack traffic but is not implemented. Cost is bounded by per-message latency; under high alert rates this could add measurable PG round-trip overhead."

**Statement**: At `NotificationSubscriber.java:83-84`:
```java
stream.setAppliedLSN(stream.getLastReceiveLSN());
stream.setFlushedLSN(stream.getLastReceiveLSN());
```
Both LSN-advance calls fire per message. The driver internally schedules ack messages back to PG. Under high alert rates (e.g. 1000 alerts/sec), the per-message ack overhead is non-trivial.

The PG replication protocol supports batched ack — the consumer can advance LSN to a maximum value periodically (e.g. every 100 messages or every 100ms). ODD does NOT use this; every message acks individually.

**Evidence**:
- `NotificationSubscriber.java:83-84`

**Existing-ADR-or-implied-prescription**:
- ADR-CANDIDATE-180 NEW batch Y (at-least-once via LSN-after-process) — explicitly codifies per-message ack. ADR notes "cost is bounded by per-message latency" as the design trade-off.

**Proposed remedy**: Batched ack — advance `setFlushedLSN` every N messages OR every X seconds (whichever comes first). Keep `setAppliedLSN` per-message (preserves at-least-once). Trade-off: at-least-once-with-larger-replay-window-on-crash (the crash loses up to N un-flushed messages but still at-least-once delivers them on restart).

**Severity rationale**: LOW — performance optimisation; bounded by alert rate; current rates likely don't trigger noticeable overhead.

**Suggested backlog grouping**: `Notifications throughput optimization` (when triggered by capacity needs).

---
