## ADR-CANDIDATE-181 — Notification subscriber uses fixed-cadence polling (10ms inner, 10s outer) — non-blocking `readPending()` chosen over blocking `read()` for shutdown ergonomics; no exponential back-off, no operator-tunable knob

**Severity**: MEDIUM
**Classification**: promote (NEW ADR; POSITIVE-INTENT — deliberate shutdown-ergonomics over latency-optimisation)
**Pillars affected**: [P-07-active-platform-features (Notifications sub-feature operational characteristics)]
**Support count**: 1 sidecar primary source (batch Y NotificationSubscriber)
**Axes present**: notification
**Batch**: Y (2026-05-20)

**Surfaced by**:
- `NotificationSubscriber.md:implicit_adrs.[6]` (HIGH) — "**Inner-loop polling, not event-driven** — the polling pattern (`buffer = stream.readPending(); if (buffer == null) { TimeUnit.MILLISECONDS.sleep(10L); continue; }`) is a deliberate choice over the alternative `stream.read()` blocking call. The 10 ms sleep gives the thread a yield window and makes the inner loop interruptable at the `Thread.interrupted()` check at L62. The trade-off: ~10 ms median latency added to each alert vs the simplicity of an interruptible inner loop without a separate timeout thread. The intent is clean shutdown ergonomics." — intent_anchor: `final ByteBuffer buffer = stream.readPending(); if (buffer == null) { TimeUnit.MILLISECONDS.sleep(10L); continue; }` (NotificationSubscriber.java:68-72)
- `NotificationSubscriber.md:implicit_adrs.[7]` (MEDIUM) — "**10s outer-loop retry cadence** — on any uncaught Exception in the inner streaming loop (decoder failure, processor failure, PG connection drop, leader-lock-loss), the outer catch logs the error and the run loop sleeps for 10 seconds before re-acquiring the lock and rebuilding the stream. The decision encodes a fixed back-off rather than exponential — a flapping Postgres relay produces 6 retries/minute, capped by the lock-acquire blocking semantics." — intent_anchor: `log.debug("Released a lock, waiting 10 seconds for next iteration"); try { TimeUnit.SECONDS.sleep(10L); } ...` (NotificationSubscriber.java:94-100)

**Decision statement**: ODD's WAL subscriber uses TWO hardcoded polling cadences:

1. **Inner-loop 10ms sleep on empty buffer** (`NotificationSubscriber.java:68-72`). The pattern is non-blocking `stream.readPending()` + `if (buffer == null) { TimeUnit.MILLISECONDS.sleep(10L); continue; }`. The alternative `stream.read()` (a blocking call that returns when a WAL message is available) was rejected. The 10ms sleep gives the thread a yield window AND makes the inner-loop interruptable at the `Thread.interrupted()` check (L62). The trade-off: ~5ms median latency added per alert (the sleep fires when there's no pending buffer) vs the simplicity of an interruptable inner loop without a separate timeout thread.

2. **Outer-loop 10s retry on uncaught Exception** (`NotificationSubscriber.java:94-100`). When any inner-loop exception propagates to the outer `catch (Exception e)` at line 90, the run loop sleeps `TimeUnit.SECONDS.sleep(10L)` before re-acquiring the leader lock and rebuilding the stream. There is NO exponential back-off, NO jitter, NO operator-tunable retry-delay knob. A flapping PG relay produces at most 6 retries/minute, capped also by lock-acquire blocking semantics on the PG side.

Neither cadence is exposed as an operator config knob. Both are hardcoded constants (`10L` literal at L71 and L96).

The architectural commitments:
- **(a) Shutdown ergonomics over latency optimisation.** The maintainer chose the polling pattern specifically so the inner-loop is interruptable via `Thread.interrupted()` check at L62. A blocking `stream.read()` would require a separate timeout thread + an explicit cancel mechanism + handling of the partial-read case — three structural complications avoided by the 10ms-sleep choice.
- **(b) Operational predictability over adaptive throttling.** The 10s outer retry is deterministic — operators reading logs see a predictable cadence; under-instability the retry pattern is fixed; under-slow-recovery the operator cannot stretch the back-off. The alternative (exponential back-off + jitter) would have produced operationally-better recovery from cascading PG failures but at the cost of harder-to-reason-about logs.
- **(c) ~5ms median latency floor is the design budget.** Under light load (alerts arriving sparsely), the inner-loop spends most of its time in the 10ms sleep — adding ~5ms median to each alert's delivery latency. Under high load (continuous pending buffers), the sleep does not fire and the loop processes at line-rate. The maintainer accepted the latency floor on the basis that alerts are not latency-sensitive at the millisecond scale (Slack RTT + SMTP relay RTT + downstream channel processing dominate).
- **(d) No operator knobs.** Both cadences are file-scope constants. The `notifications.wal.advisory-lock-id` / `replication-slot-name` / `publication-name` knobs are operator-tunable; the polling cadences are NOT. The maintainer's design choice is "operators don't need to tune retry behaviour."
- **(e) Composition with other invariants.** The 10s outer cadence composes with ADR-CANDIDATE-180's poison-message-replay-loop (a poison message produces 6 attempts/minute, each consuming roughly 50-200ms of PG-side connect+probe time before throwing). The 10ms inner cadence composes with ADR-CANDIDATE-179's single-thread architecture (CPU usage is bounded by 1 thread's worth of poll overhead per ODD instance).

**Wisdom test**: PASS on all three questions.
1. **Intentional?** YES — three independent commitments:
   - The explicit choice of `readPending()` (non-blocking) over `read()` (blocking) at NotificationSubscriber.java:68. The JDK driver offers both; the maintainer picked the non-blocking variant.
   - The two-checkpoint interrupt structure (`while (!Thread.interrupted())` at L46 + `if (Thread.interrupted())` at L62) — this is the only reason the polling design is needed (cooperative-shutdown propagates through both checkpoints).
   - The `log.debug("Released a lock, waiting 10 seconds for next iteration")` at L94 — the log line itself names "10 seconds" verbatim, encoding the intent in observable telemetry.
2. **Structural impact?** YES — every future "make notifications low-latency" feature must work AROUND this design (e.g. by switching to async dispatcher + maintaining the polling subscriber as a queue producer). Every future "back-off should be exponential" change must touch the same two `sleep(...)` call sites.
3. **Refactoring or structural?** STRUCTURAL on the polling-vs-blocking choice (switching requires reworking the interrupt-handling); REFACTORING-but-structurally-trivial on the exact cadence values (10/10000 could be config-bound without architecture change — but the maintainer chose NOT to). This ADR codifies "the choice to not tune," which is the structural commitment.

**Existing ADR**: none in `adrs/`. Composes with ADR-CANDIDATE-179 (single-thread leader-elected — the thread these cadences govern), ADR-CANDIDATE-180 (at-least-once with poison-replay — the cadence under which replay happens), ADR-CANDIDATE-182 (SPI seam — the contract this thread calls into).

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-515 NEW batch Y (no connect/request timeout on shared HttpClient — the COMPLEMENTARY gap; the polling cadence is bounded, but the per-channel HTTP send is unbounded; an unreachable Slack endpoint blocks the dispatcher indefinitely)
- REFACTOR-516 NEW batch Y (no SMTP timeout — same shape; the cadence ADR governs the WAL-poll side; the SMTP/HTTP send side has no analogous timeout commitment)
- REFACTOR-530 NEW batch Y (no metrics for in-flight LSN / subscriber progress — the observability companion to the polling design)

**Proposed action**: Promote to `adrs/drafts/notifications-fixed-cadence-polling.md` (new ADR). Document the two cadences + the shutdown-ergonomics rationale + the trade-off (latency floor vs blocking-call complexity). Cross-link with ADR-CANDIDATE-180 (the poison-replay-loop runs at this cadence) and the REFACTOR-515/516/530 gaps (the cadence is bounded but the per-channel SEND latency is NOT — the asymmetry is the operator-visible reality).

**Severity rationale**: MEDIUM — defines the platform's notification-delivery latency floor + retry rhythm; not security-critical; operationally significant (operators tuning retry behaviour have no knob); structural for the polling-vs-blocking choice.

---
