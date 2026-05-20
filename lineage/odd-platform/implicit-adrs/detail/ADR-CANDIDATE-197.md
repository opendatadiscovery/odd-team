## ADR-CANDIDATE-197 — System events have NULL `created_by`, intentionally; the docs anchor this as the protocol-level "no operator identity attached" signal — the `.switchIfEmpty(Mono.defer(() -> mapToPojo(event, time, null)))` fallback IS the audit-trail convention for ingestion / alert-system / auto-resolution events

**Severity**: MEDIUM
**Classification**: promote (new — codifies the explicit, doc-anchored design choice)
**Support count**: 3 sidecars (`ActivityServiceImpl` PRIMARY-SOURCE + `ActivityHandler` confirms via system-event handling + `ReactiveActivityRepositoryImpl` confirms via the schema-level NULL acceptance)
**Axes present**: service-layer auth-resolution, schema-allowed-null, docs-anchored convention
**Pillars affected**: P-01, P-05, P-06 — audit semantics, alert system, ingestion

**Surfaced by**:
- `ActivityServiceImpl.md:implicit_adrs[0]` (PRIMARY-SOURCE — "**System events have NULL created_by, intentionally** — evidence: ActivityServiceImpl.java:49 + line 60 (`.switchIfEmpty(Mono.defer(() -> Mono.just(activityMapper.mapToPojo(event, activityCreateTime, null))))`); intent_anchor: corroborated by live doc page (WebFetch 2026-05-20 status 200): 'Auto-resolution events emitted from the Alerting subsystem are recorded as system events on the feed (no operator identity attached).' The fallback-to-null pattern IS the protocol-level signal of 'no operator identity'; the docs explicitly anchor this." — confidence: HIGH)
- `ActivityHandler.md:bugs_limitations_corner_cases[3]` (CONTEXT — "System-event username silently null: `ActivityServiceImpl.createActivityEvent` uses `authIdentityProvider.getCurrentUser().map(UserDto::username).switchIfEmpty(Mono.defer(() -> Mono.just(activityMapper.mapToPojo(event, ..., null))))`")
- `ReactiveActivityRepositoryImpl.md:bugs_limitations_corner_cases[2]` ("activity.created_by is `varchar(512)` NULLABLE — anonymous mutations and ingestion-path system events write null")
- `V0_0_48__add_activity.sql:10` (`created_by varchar(512)` — NULLABLE)
- `ActivityServiceImpl.java:46-49` (the `.switchIfEmpty(Mono.defer(...))` block)
- `ActivityServiceImpl.java:57-60` (the equivalent for `createActivityEvents` batch path)
- WebFetch `/features/active-platform-features/activity-feed` (2026-05-20, status 200; explicit docs anchor: "Auto-resolution events emitted from the Alerting subsystem are recorded as system events on the feed (no operator identity attached)")

**Decision statement**: The platform's activity-emit pattern (`ActivityServiceImpl.createActivityEvent:43-52` and `createActivityEvents:54-63`) uses a Reactor `.switchIfEmpty(Mono.defer(...))` fallback to record activity rows with `created_by = NULL` when no SecurityContext is present. The null-username pattern IS the protocol-level signal of "no operator identity attached" — used for:

- **Ingestion-driven events**: `ActivityIngestionRequestProcessor.process` (`:24-32`) runs on a scheduling / I/O thread with no ReactiveSecurityContext. Emits DATA_ENTITY_CREATED activity events with `created_by = NULL`.
- **Alert-system auto-resolutions**: `AlertServiceImpl` background flows that emit OPEN_ALERT_RECEIVED / RESOLVED_ALERT_RECEIVED / ALERT_STATUS_UPDATED events; the `ActivityCreateEvent.systemEvent` flag is set to `true`; the auth-context is absent → `created_by = NULL`.
- **Generic scheduler events**: any platform-driven event emitted outside an HTTP request context.

The decision is BACKED BY:
- The explicit `Mono.defer` block (lines 49, 60) — the maintainer wrote a fall-through specifically for the null-username case (vs throwing or defaulting to a synthetic username).
- The schema-level NULLABLE allowance on `created_by` (`V0_0_48__add_activity.sql:10` — `varchar(512)` with NULL allowed).
- The `is_system_event` BOOLEAN column on the schema (V0_0_48 — exists and is NOT NULL) — discriminator for system events.
- The LIVE DOC page (WebFetch 2026-05-20): "Auto-resolution events emitted from the Alerting subsystem are recorded as system events on the feed (no operator identity attached)." — EXPLICITLY anchors the design.

The decision INTENT is to make "no operator identity" a first-class auditable concept. The UI surfaces system events as a distinct category (per the docs page); operators can filter / understand the events without confusion.

**Wisdom test (3-question)**:
1. *Intentional?* YES — multiple positive signals:
   - The `.switchIfEmpty(Mono.defer(...))` block is explicit code (not a default fallback).
   - The schema NULLABLE allowance is explicit (the migration could have made `created_by NOT NULL` and failed at insert; it chose NULL-allowed).
   - The `is_system_event` discriminator column exists on schema.
   - The LIVE DOC anchors the design verbatim.
   - Three independent positive signals.
2. *Structural impact?* YES — defines the audit-trail's actor-identity contract. UI rendering, compliance reporting, and forensic queries all depend on this convention.
3. *Refactoring or structural?* STRUCTURAL — changing the convention (e.g. to record "system" string instead of NULL) would require schema migration + UI rendering changes + doc updates. NOT a refactor.

→ ADR.

**Evidence**:
- `ActivityServiceImpl.md` says: "System events have NULL created_by, intentionally — the fallback-to-null pattern IS the protocol-level signal of 'no operator identity'; the docs explicitly anchor this"
- Live doc page (WebFetch 2026-05-20) says: "Auto-resolution events emitted from the Alerting subsystem are recorded as system events on the feed (no operator identity attached)"
- intent_anchor: the `.switchIfEmpty(Mono.defer(...))` block IS explicit code; the schema NULLABLE IS deliberate; the docs IS the public-facing anchor.

**Existing ADR**: NEW (codifies a doc-anchored design choice not yet in ADR form). Composes with:
- ADR-CANDIDATE-195 (NEW from this batch — data-entity-scoped audit log; system events are the SUBSET emitted by non-user paths)
- ADR-CANDIDATE-196 (NEW from this batch — activity-emit transactional coupling; system events are inside the same TX as the parent ingestion / alert flow)
- ADR-CANDIDATE-022 (existing — Activity view-modes; system events appear in the ALL view but NOT in MY_OBJECTS — confirmed via ActivityServiceImpl.java:184-199)

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-560 (NEW from this batch — ingestion-path system_event flag asymmetry; the verification gap that the `is_system_event` column is NOT always set on ingestion path — undermines the discrimination contract this ADR codifies)
- REFACTOR-580 (NEW from this batch — cross-mode actor bleed; the related identity-resolution gap on the READ side)

**Proposed action**: Promote to `adrs/drafts/activity-system-events-null-created-by.md`. Document:
- The `.switchIfEmpty(Mono.defer(...))` fall-through pattern at the write path.
- The schema-level NULLABLE allowance on `created_by` as the explicit affordance.
- The `is_system_event` column as the discriminator (and the REFACTOR-560 gap that must be addressed for the discriminator to be reliable).
- The UI rendering convention: system events render distinctly from user-actor events.
- The doc-cross-reference: `activity-feed.md` already documents the alert auto-resolution case; the ADR should require docs to also explicitly cover ingestion-driven events.
- The cross-mode-bleed concern (REFACTOR-580): null `created_by` is also the DISABLED-mode anonymous-mutation case — the doc + code should clarify which null-cases are legitimate (system events) vs which are operationally undesirable (anonymous user mutations under DISABLED — the REFACTOR-560 + REFACTOR-068 family).

**Severity rationale**: MEDIUM — pattern-shaping decision for audit semantics. Severity is bounded by:
- The convention is doc-anchored (operators have a single source of truth).
- The cross-mode-bleed gap (REFACTOR-580) and the discriminator gap (REFACTOR-560) are AVOIDABLE if the maintainer surfaces them.
- The fix to elevate to ADR is low-cost and high-clarity.

**Cross-pillar bump**: P-01 × P-05 × P-06 — audit + alert system + ingestion. Severity stays MEDIUM.

**Suggested backlog grouping**: ADR draft + DOC-NNN companion (extend `activity-feed.md` to cover the ingestion-path system events).

---
