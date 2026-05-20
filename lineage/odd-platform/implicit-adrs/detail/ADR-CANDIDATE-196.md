## ADR-CANDIDATE-196 — Activity-row INSERT shares the business mutation's `@ReactiveTransactional` boundary — the aspect's annotation placement encodes the "audit-or-rollback" semantic: forensic completeness > best-effort audit; an audit-write failure rolls back the originating business mutation

**Severity**: HIGH
**Classification**: promote (new — extends ADR-CANDIDATE-067 with the activity-emit-specific transactional commitment)
**Support count**: 3 sidecars (`ActivityServiceImpl` PRIMARY-SOURCE + `ActivityHandler` confirms via aspect-orchestration + `ActivityAspect` source-code evidence verified)
**Axes present**: aspect-orchestration, transactional-boundary, service-layer
**Pillars affected**: P-01, P-05, P-06 — cross-pillar (audit consistency, operability, security)

**Surfaced by**:
- `ActivityServiceImpl.md:implicit_adrs[2]` (PRIMARY-SOURCE — "**The activity row is in the same TX as the business mutation, via the aspect's @ReactiveTransactional** — evidence: `ActivityAspect.java:42` `@ReactiveTransactional` on `monoActivityAspect` (the @Around advice that wraps @ActivityLog methods); `ActivityServiceImpl` itself has NO @ReactiveTransactional; the design depends on the aspect for TX wrapping; intent_anchor: the aspect's annotation placement (on the @Around method, not on the @ActivityLog annotation or on the activity service) IS the explicit design choice — alternative designs (separate TX for activity, async fire-and-forget) would require removing or relocating the annotation. The aspect-level annotation forces atomicity")
- `ActivityHandler.md:implicit_adrs[0]` (CORROBORATES — "the aspect's transactional wrap makes the audit-emit failure roll back the business mutation — `audit or nothing` semantic")
- `ActivityHandler.md:stress_findings.S-E-3` (CONFIRMED — "TRANSACTIONAL COUPLING — emit failure rolls back business mutation... R2DBC will roll back on any reactive error in the chain")
- `ActivityServiceImpl.md:stress_findings.S-E-1` (THE THREE CALL-PATHS — @ActivityLog AOP + AlertServiceImpl + ActivityIngestionRequestProcessor all share this transactional posture)
- `ActivityAspect.java:42, 62` (the verified `@ReactiveTransactional` annotation + joinPoint location)
- `AlertServiceImpl.java:201` (the secondary call-site)
- `IngestionServiceImpl.java:66` (the tertiary call-site, with the LARGEST blast radius)

**Decision statement**: The platform's `@ActivityLog` AOP framework places the `@ReactiveTransactional` annotation on `ActivityAspect.monoActivityAspect` (`:42`) — the around-advice method that wraps every `@ActivityLog`-annotated business method. The annotation placement encodes the "audit-or-rollback" transactional semantic:

1. The business mutation (`joinPoint.proceed()` at `ActivityAspect.java:62`) runs INSIDE the aspect's TX.
2. The activity-row write (`postActivity` → `createActivityEvent` → `activityRepository.saveReturning` at `ActivityServiceImpl.java:50`) runs INSIDE THE SAME TX.
3. If the activity write fails (transient DB hiccup, partition-coverage gap, R2DBC connection pool exhaustion, constraint violation), the ENTIRE TX rolls back → the business mutation is reverted → the user sees an HTTP 500.

The pattern extends to TWO secondary call-paths:
- `AlertServiceImpl.applyAlertActions` (`AlertServiceImpl.java:201`) — `@ReactiveTransactional`; wraps alert mutation + registerNewAlertsActivityEvents + registerAutomaticallyResolvedAlertsActivityEvents in ONE TX.
- `IngestionServiceImpl.ingest` (`IngestionServiceImpl.java:66`) — `@ReactiveTransactional`; wraps the WHOLE ingestion pipeline including the activity emit. LARGEST blast radius: a single activity-write failure can roll back N data entities.

The annotation choice is DELIBERATE — alternative designs would require:
- Removing the `@ReactiveTransactional` from the aspect (best-effort audit; the activity row may be missing).
- Moving the activity write to a separate TX (independent atomicity; activity row may persist even if business mutation rolls back, OR vice versa).
- Async fire-and-forget queueing (outbox pattern; eventual consistency).

The maintainer chose "audit-or-rollback" — forensic completeness over best-effort audit.

**Wisdom test (3-question)**:
1. *Intentional?* YES — the aspect-level `@ReactiveTransactional` annotation is explicit. The choice is reflected in THREE different call-paths (aspect + alert + ingestion) consistently. Each call-site that emits activity wraps the activity-write inside its parent TX. The pattern is structural, not incidental.
2. *Structural impact?* YES — affects every `@ActivityLog`-annotated method's failure semantics. Operators expecting "audit is best-effort" are surprised. Ingestion failures cascade ENTIRE batches. Alert flows fail HOLISTICALLY on individual activity-write errors. The decision shapes the platform's audit-trail trust contract.
3. *Refactoring or structural?* STRUCTURAL — relocating the `@ReactiveTransactional` annotation OR introducing an outbox pattern OR adding a fail-soft escape hatch are all STRUCTURAL changes affecting reactive composition + DB connection lifecycle + error-handling semantics. NOT a refactor.

→ ADR.

**Evidence**:
- `ActivityServiceImpl.md` says: "The activity row is in the same TX as the business mutation, via the aspect's @ReactiveTransactional. ... the aspect's annotation placement (on the @Around method, not on the @ActivityLog annotation or on the activity service) IS the explicit design choice"
- `ActivityHandler.md` says: "the aspect's transactional wrap makes the audit-emit failure roll back the business mutation — `audit or nothing` semantic"
- intent_anchor: the annotation placement on `monoActivityAspect` (the around-advice) + the absence of `@ReactiveTransactional` on `ActivityServiceImpl` itself + the consistent transactional posture across THREE call-paths (aspect / alert / ingestion). Three positive signals; zero contradicting evidence.

**Existing ADR**: STRENGTHENS / EXTENDS ADR-CANDIDATE-067 (`@ReactiveTransactional` boundary asymmetry — list-shaped reads stay OUTSIDE TX; per-resource writes ARE INSIDE TX). ADR-CANDIDATE-067 is the BROADER stance; ADR-CANDIDATE-196 is the ACTIVITY-EMIT-SPECIFIC commitment.

Also composes with:
- ADR-CANDIDATE-059 (Multi-step per-data-entity write paths use a service-layer `@ReactiveTransactional` boundary — the broader transactional-on-writes posture)
- ADR-CANDIDATE-060 (Bulk mutations use programmatic activity-event emission — for the SUBSET that need per-resource events vs single-row emit)
- ADR-CANDIDATE-198 (NEW from this batch — Activity table is APPEND-ONLY — composes with this ADR for "append-only + transactionally-consistent" audit semantic)

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-556 (NEW from this batch — the OPERATOR-VISIBLE CONSEQUENCE: activity-write rolls back originating business mutation on emit failure; the gap this ADR codifies)
- REFACTOR-566 (NEW from this batch — non-idempotent emit; activity retries produce duplicate rows; composes with this ADR's transactional posture)
- REFACTOR-572 (NEW from this batch — `save(List)` partial-commit semantics; the BATCH-EMIT case where the transactional wrap is INCOMPLETE)
- REFACTOR-145 (existing — `DataEntityHousekeepingJob.deleteFiles` `.block()` inside jOOQ transaction — the related transactional-failure-cascade pattern)

**Proposed action**: Promote to `adrs/drafts/activity-emit-transactional-coupling.md`. Document:
- The aspect-level `@ReactiveTransactional` annotation placement and its operator-visible consequences.
- The three call-paths (aspect + alert + ingestion) and their respective blast radii.
- The trade-off framing: forensic completeness vs best-effort audit + operator UX.
- The cross-reference to REFACTOR-556 (the operator-UX consequence the maintainer should explicitly accept or mitigate).
- A future-design option: introducing `odd.activity.audit-mode: strict|best-effort` configuration toggle.
- The documentation companion: `activity-feed.md` should surface this transactional contract to operators (currently silent).

**Severity rationale**: HIGH — load-bearing audit-architecture decision affecting every `@ActivityLog`-annotated business method. The decision IS defensible (forensic completeness) but the operator-UX cost (mutations rollback on audit-write failure) is surprising. Documenting the contract via ADR closes the maintainer-knowledge gap and surfaces the trade-off for explicit acceptance.

**Cross-pillar bump**: P-01 × P-05 × P-06 — audit + operability + security. Severity already HIGH.

**Suggested backlog grouping**: ADR draft + REFACTOR-556 (operator-UX consequence) + DOC-NNN companion documentation update.

---
