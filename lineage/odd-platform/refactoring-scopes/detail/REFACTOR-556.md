## REFACTOR-556 — Activity-row INSERT shares the business mutation's `@ReactiveTransactional` boundary — a transient repository error on the audit-write silently ROLLS BACK the operator's successful business mutation and surfaces a 500

**Severity**: HIGH
**Category**: transactional-coupling
**Surfaced by**:
- `ActivityServiceImpl.md:stress_findings.S-E-1` (CANARY HEADLINE — TRANSACTIONAL BOUNDARY — "an activity-write failure rolls back the business mutation (surprising to operators expecting the mutation to be the primary side-effect and audit to be best-effort)")
- `ActivityServiceImpl.md:bugs_limitations_corner_cases[5]` ("Activity-row write failures roll back business mutations (via the aspect's `@ReactiveTransactional`)")
- `ActivityServiceImpl.md:implicit_adrs[2]` (the implicit ADR — **the activity row is in the same TX as the business mutation, via the aspect's @ReactiveTransactional** — codified in ADR-CANDIDATE-196 NEW)
- `ActivityHandler.md:stress_findings.S-E-3` (CONFIRMED — "emit failure rolls back business mutation" — transactional coupling)
- `ActivityHandler.md:implicit_adrs[0]` ("the aspect's transactional wrap makes the audit-emit failure roll back the business mutation — `audit or nothing` semantic")
- `ActivityAspect.java:42, 62` (the `@ReactiveTransactional` annotation on `monoActivityAspect` — the TX boundary)
- `AlertServiceImpl.java:201` (the secondary call-site: `applyAlertActions` wraps alert mutation + activity emit in ONE TX)
- `IngestionServiceImpl.java:66` (the tertiary call-site: ingestion wraps the WHOLE pipeline + activity emit — the LARGEST blast radius)

**Description**: The activity-row INSERT (`ActivityServiceImpl.createActivityEvent` line 50 → `activityRepository.saveReturning(...)`) is wrapped in the SAME transactional boundary as the business mutation it audits. Three call-paths share this property:

1. **`@ActivityLog` AOP path** (most common — 18+ annotated business methods): `ActivityAspect.monoActivityAspect` (`:42`) is `@ReactiveTransactional`. The around-advice wraps `joinPoint.proceed()` (the business mutation) AND `postActivity` (which calls `createActivityEvent`) in ONE TX. Failure on the activity write → rollback of the wrapped business method.
2. **AlertServiceImpl batch flows**: `applyAlertActions` (`AlertServiceImpl.java:201`) is `@ReactiveTransactional`; wraps the alert mutation + `registerNewAlertsActivityEvents` + `registerAutomaticallyResolvedAlertsActivityEvents` calls in ONE TX. Failure on the activity batch → rollback of the alert mutations.
3. **Ingestion pipeline**: `IngestionServiceImpl.ingest` (`:66`) is `@ReactiveTransactional`; wraps the WHOLE pipeline including `ActivityIngestionRequestProcessor.process` → `createActivityEvents`. Failure on the activity batch → rollback of the ENTIRE ingestion request (potentially N data entities).

**Operator-visible consequence**: An operator submits a description update via the UI. The DB write succeeds. The activity-row INSERT then fails (e.g. transient DB hiccup, R2DBC connection pool exhausted, partition coverage gap at midnight boundary, a constraint violation on the activity-row mapper). The user sees an HTTP 500. They retry. The 2nd retry succeeds (activity row writes fine). The user has NO way to know that the FIRST mutation actually committed-then-rolled-back; they see "first attempt failed, second attempt succeeded" — and the database state is consistent (the rollback erased the first commit). But:

- For the AlertManager/Ingestion paths, the blast radius is larger: N alerts/entities ingested → if even ONE activity-row INSERT in the batch fails, ALL N business mutations roll back. The operator sees "alert/ingestion failed" but the platform's state is unchanged.
- For the UI mutation paths: every operator action carries an invisible cost ratio "audit-write success rate" × "mutation success rate".

**Cross-cutting context**: This is a STRUCTURAL trade-off, not a defect — the maintainer explicitly chose "audit-or-rollback" semantics via the aspect-level `@ReactiveTransactional`. The intent is forensic integrity: every committed business mutation MUST have a corresponding activity row, OR the business mutation must not have committed either. The cost is paid in operator UX (transient audit-write failures surface as mutation failures).

The decision is captured as ADR-CANDIDATE-196 (NEW — extends ADR-CANDIDATE-067 `@ReactiveTransactional` boundary asymmetry). The REFACTOR concern is whether the operator-UX cost is acceptable and whether the docs surface the trade-off.

**Primary source citations**:
- `ActivityAspect.java:42` (`@ReactiveTransactional` on `monoActivityAspect`)
- `ActivityAspect.java:62` (the `joinPoint.proceed()` inside the transactional advice)
- `ActivityAspect.java:81-95` (the `postActivity` invocation inside the same TX)
- `ActivityServiceImpl.java:50` (`saveReturning` — the activity write)
- `AlertServiceImpl.java:201` (the alert-batch transactional wrapper)
- `IngestionServiceImpl.java:66` (the ingestion pipeline transactional wrapper)
- `ActivityServiceImpl.java:33-273` (verified absence of any local TX boundary or fail-soft emit handler)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-067 (`@ReactiveTransactional` boundary asymmetry — list-shaped reads stay OUTSIDE TX; per-resource writes ARE INSIDE TX) is the broader stance. ADR-CANDIDATE-196 (NEW from this batch) specifically codifies the activity-emit-in-same-TX choice with the audit-or-rollback semantic. The intent IS clear in the code; the GAP is that:
1. The docs do NOT surface this contract — operators reading `activity-feed.md` cannot infer that the audit subsystem can fail-and-rollback their mutations.
2. There is no fail-soft escape hatch — operators who prefer best-effort audit (vs strict-audit) have no config toggle.
3. The largest-blast-radius case (ingestion: N entities rollback on 1 audit failure) is NOT documented anywhere.

**Proposed remedy**: Three options the maintainer can choose between (in increasing structural impact):

1. **Document the contract (LOWEST cost)**: Add an admonition to `activity-feed.md` and to the ingestion configuration page: "The activity audit log is transactionally consistent with the data-entity mutations it describes. A transient failure writing the audit row will roll back the originating mutation. For ingestion batches, a single audit-write failure rolls back the entire batch." Pair with a clear forensic-integrity rationale ("forensic completeness > best-effort audit").

2. **Add a config-toggle for best-effort audit (MEDIUM cost)**: Introduce `odd.activity.audit-mode: strict|best-effort` (default `strict`). In `best-effort` mode, the activity emit is wrapped in `.onErrorResume(e -> { log.warn("Activity emit failed; mutation committed without audit row", e); return Mono.empty(); })` — the business mutation succeeds, the audit row is missing, a log line + metric records the gap. Operators who prioritize UX/operability over forensic completeness can opt in.

3. **Decouple via outbox pattern (HIGHEST cost)**: Move the activity emit out of the synchronous TX into a Postgres "outbox" table (insert during TX, async drainer writes to `activity` table out-of-band). Preserves forensic completeness while decoupling failure modes. Requires a new outbox table + drainer job + retry/dlq infrastructure.

**Recommended**: Option 1 (document) + Option 2 (config toggle, default `strict`). The structural intent (forensic-integrity) is sound; the gap is operator awareness + opt-out mechanism for the bounded-cost case.

**Severity rationale**: HIGH — operator-visible surprise pattern. A transient audit-write failure rolling back a successful business mutation is operationally hostile UX; the operator has no way to diagnose whether their mutation actually committed. Combined with the LARGEST blast radius (ingestion: N entities rollback), this is a known-issue class that deserves explicit framing. Severity is bounded by:
- The architectural intent is sound (forensic integrity).
- The empirical failure rate is bounded by the activity-write success rate (high on healthy DB).
- The audit subsystem is critical for compliance use-cases (SOX, GDPR records-of-processing).

**Suggested backlog grouping**: `SEC-NNN activity-audit hardening sprint` + `DOC-NNN activity-feed contract documentation sprint`. Pair with REFACTOR-558 (the oldState race; also activity-audit-correctness), REFACTOR-560 (system_event flag asymmetry), REFACTOR-566 (activity emit non-idempotency).

---
