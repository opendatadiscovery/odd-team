## ADR-CANDIDATE-100 — Translate-before-fan-out atomic; bifurcated "fail-loud on data-integrity, fail-soft on delivery" — translation errors propagate out (WAL re-delivery) while per-sender errors are caught (loop continues)

**Classification**: promote
**Severity**: MEDIUM
**Pillars affected**: [P-07-active-platform-features]
**Support**: surfaced by 1 sidecar (`NotificationsDispatcher`) — primary-source; structural error-handling-architecture decision
**Batch**: K (2026-05-19)

**Surfaced by**:
- `odd-platform__java__service__service__NotificationsDispatcher.md:implicit_adrs.[3]` (HIGH confidence) — "Translation happens INSIDE process() before fan-out, NOT in a separate stage. ... Encodes a 'fail-loud on data-integrity errors, fail-soft on delivery errors' bifurcation."

**Decision statement**: The dispatcher composes translate→fan-out atomically in one method call (`AlertNotificationMessageProcessor.process(DecodedWALMessage)`): line 23 invokes `messageTranslator.translate(message)` UNCAUGHT, line 25-36 iterates senders with per-sender try/catch. A translation failure (e.g. unknown alert type code → `IllegalArgumentException` at `AlertNotificationMessageTranslator.java:87`; missing or duplicate alerted-entity row → `IllegalStateException` at lines 94-101) BYPASSES the dispatcher's per-sender catch and propagates to `NotificationSubscriber.java:90`'s outer catch — which logs, releases the advisory lock, waits 10s, and re-acquires the lock to RE-DELIVER the same WAL LSN. By contrast, a sender failure (HTTP non-2xx, SMTP refused) wrapped in `NotificationSenderException` is caught at line 31 and the loop continues to the next sender. The architectural posture: data-integrity errors are loud (the same WAL message replays until the data is consistent — operators must fix the underlying alert row); delivery errors are soft (failed channels are logged but the message is treated as delivered from the dispatcher's perspective).

**Wisdom test**: PASS. (1) Deliberate (the translate call is intentionally OUTSIDE the per-sender catch — the maintainer could have wrapped the entire process() in try/catch but chose not to); (2) Structural impact (the bifurcation determines the WAL-LSN advancement contract — fail-loud holds the LSN until data is consistent, fail-soft advances the LSN past undeliverable messages); (3) Changing the bifurcation (e.g. catching translation errors too) would be a STRUCTURAL change to the recovery semantics, not a refactor.

**Evidence**:
- NotificationsDispatcher.md says: "Translation is uncaught in `process()`; only sender-layer `NotificationSenderException` is caught. Translator throws `IllegalArgumentException` on unknown alert-type code (AlertNotificationMessageTranslator.java:87) and `IllegalStateException` on missing/duplicate alerted-entity rows (AlertNotificationMessageTranslator.java:94-101) — both bypass the dispatcher's try/catch and reach NotificationSubscriber.java:90."
- NotificationsDispatcher.md says (the LSN-advancement coupling): "the WAL stream's `setAppliedLSN` and `setFlushedLSN` are advanced regardless (NotificationSubscriber.java:83-84) — the dispatcher has no way to signal 'do not advance LSN'." (the delivery-failure side advances the LSN; the translation-failure side does NOT advance because process() never returns)

**Existing ADR**: none. Composes with **ADR-CANDIDATE-098** (per-channel catch-and-continue) — together they form the dispatcher's two-tier error-handling posture. Composes with **ADR-CANDIDATE-020** (decoupled outbound delivery via Postgres WAL + advisory lock) — the WAL-LSN advancement contract is the underlying delivery primitive that this bifurcation exploits.

**Cross-link gaps** (refactoring-scopes anchored on this bifurcation):
- REFACTOR-250 NEW — translate-failure WAL replay loop (HIGH; the fail-loud side has no poison-message escape hatch; a persistently-bad row blocks the WAL stream indefinitely with 10s back-off).
- REFACTOR-251 NEW — no retry / no DLQ / no audit (the fail-soft side has no record of which deliveries actually succeeded).

**Proposed action**: Promote to `adrs/drafts/notifications-fail-loud-vs-fail-soft.md` (new ADR). Document the bifurcation explicitly with the WAL-LSN advancement contract — translation errors HOLD the LSN (replays the same message); delivery errors ADVANCE the LSN (drops the message). Cross-link with REFACTOR-250 (the poison-message hazard the fail-loud side creates) and REFACTOR-251 (the audit gap the fail-soft side creates). Cross-link with ADR-CANDIDATE-098 (the runtime side of the same fail-soft stance).

**Severity rationale**: MEDIUM — error-handling architecture decision; affects every operator-visible recovery posture under partial-failure scenarios. The bifurcation is operationally meaningful (an operator debugging "why are some alerts re-delivered repeatedly" vs "why was this alert silently dropped" needs to know which side of the bifurcation triggered).

---
