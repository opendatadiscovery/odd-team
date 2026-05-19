## ADR-CANDIDATE-099 — Sequential synchronous fan-out across notification senders; no parallelism, no thread pool, no async; one slow sender delays subsequent senders for the same alert

**Classification**: promote
**Severity**: MEDIUM
**Pillars affected**: [P-07-active-platform-features]
**Support**: surfaced by 1 sidecar (`NotificationsDispatcher`) — primary-source; structural concurrency-architecture decision
**Batch**: K (2026-05-19)

**Surfaced by**:
- `odd-platform__java__service__service__NotificationsDispatcher.md:implicit_adrs.[1]` (HIGH confidence) — "Sequential synchronous fan-out — no parallelism across channels. The dispatcher iterates `List<NotificationSender>` with a `for` loop and blocks per sender on `.send(...)`. Encodes a deliberate-simplicity stance."

**Decision statement**: The dispatcher iterates `List<NotificationSender>` with a synchronous `for` loop (`AlertNotificationMessageProcessor.java:25-36`); each sender's `.send(...)` call is a blocking HTTP/SMTP round-trip on the calling thread. There is NO thread pool, NO `Mono.zip(...)`, NO `Flux.fromIterable(senders).flatMap(...)` parallel fan-out, NO per-channel SLA budget. The architectural posture: keep the dispatcher's structure minimal — one method, one loop, one connection per sender — and accept that one slow sender delays all subsequent senders for the SAME alert. The decision is reinforced by the upstream `NotificationSubscriber` running on a single-thread executor (`NotificationSubscriberStarter.java:21-23` — `Executors.newSingleThreadExecutor`), so cluster-wide notifications throughput is bounded by the leader-elected single thread × per-alert sender-loop latency.

**Wisdom test**: PASS. (1) Deliberate (the for-loop is the simplest possible fan-out — the maintainer could have used `Flux.fromIterable(senders).parallel().runOn(boundedElastic())` for parallelism, but chose not to); (2) Structural impact (the single-thread upstream + sequential fan-out together encode the concurrency model — a future change to parallelism would require both ends to change); (3) The alternative (parallel fan-out + per-sender SLA budgets + per-sender timeout) would be a STRUCTURAL change, not a refactor within the existing structure.

**Evidence**:
- NotificationsDispatcher.md says: "`for (final NotificationSender<AlertNotificationMessage> notificationSender : notificationSenders) { ... notificationSender.send(...) ... }`" (AlertNotificationMessageProcessor.java:25-36)
- NotificationsDispatcher.md says (upstream pairing): "the upstream NotificationSubscriber is a SINGLE-THREAD executor (`Executors.newSingleThreadExecutor`) on the leader node only. Cluster-wide throughput is bounded by the dispatcher's serial latency." (NotificationSubscriberStarter.java:21-23 + NotificationSubscriber.java:39-46)

**Existing ADR**: none. Composes with **ADR-CANDIDATE-043** (Notifications single-leader WAL + advisory-lock namespace) — together they describe the full concurrency model: cluster-wide single leader × leader-local single thread × per-alert sequential fan-out. Composes with **ADR-CANDIDATE-098** (per-channel catch-and-continue) — together they form the dispatcher's runtime posture.

**Cross-link gaps** (refactoring-scopes anchored on the absence this ADR endorses):
- REFACTOR-129 (batch C) — no rate-limiting at any layer (HIGH; cross-batch).
- REFACTOR-130 (batch C) — SMTP infinite timeouts block ALL channels (the sequential fan-out makes the SMTP-timeout problem worse).
- REFACTOR-252 NEW — no rate-limiting / no batching / no throttle.
- REFACTOR-254 NEW — sender iteration order undefined (Spring bean-collection-order-dependent; the sequential fan-out makes the order a perf concern).
- REFACTOR-250 NEW — translate-failure WAL replay loop blocks the single thread (the single-thread model amplifies the poison-message blast radius).

**Proposed action**: Promote to `adrs/drafts/notifications-sequential-fan-out.md` (new ADR). Document the concurrency model explicitly — single-thread upstream × sequential fan-out × per-sender catch-and-continue × no parallelism. Cross-link with REFACTOR-129/-130/-252 as the operational gaps that the simplicity stance does NOT defend.

**Severity rationale**: MEDIUM — concurrency-model decision; affects per-alert latency and throughput characteristics. The alternative (parallel fan-out + per-sender timeouts) would close the SMTP-timeout-blocks-all-channels gap (REFACTOR-130) and is a plausible future evolution.

---
