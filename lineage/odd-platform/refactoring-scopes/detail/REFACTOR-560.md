## REFACTOR-560 — Ingestion-path activity events silently persist `created_by = NULL` without a discriminator column distinguishing "system event" from "auth context bug" — operators cannot determine whether a null-author row is a legitimate system action OR an unattributed user action via DISABLED-mode anonymous traffic

**Severity**: MEDIUM (forensic-attribution gap)
**Category**: missing-audit-attribution
**Surfaced by**:
- `ActivityHandler.md:stress_findings.S-E-5` (CANARY HEADLINE — SYSTEM EVENT USERNAME — "the auth-context fallback at `ActivityServiceImpl.createActivityEvent:46-49` produces `username = null` when no security context is present. `ActivityIngestionRequestProcessor.process` runs on the ingestion thread → no security context → null username → ActivityPojo.created_by_user_id = NULL. The systemEvent flag exists on the ActivityCreateEvent DTO (`:13`) but its propagation to the ActivityPojo column needs verification" — probe P-020)
- `ActivityHandler.md:bugs_limitations_corner_cases[3]` ("System-event username silently null... no `log.warn`, no metric, no `IllegalStateException` for the system-event case... The `systemEvent` boolean exists on `ActivityCreateEvent` (`:13`) but is not used to distinguish a null-username system event from a null-username auth-context-bug user event" — MEDIUM)
- `ActivityServiceImpl.md:implicit_adrs[0]` (the implicit ADR — system events have NULL created_by, intentionally — codified in ADR-CANDIDATE-197 NEW)
- `ActivityServiceImpl.md:security.known_security_gaps[3]` ("system-event detection is via `created_by IS NULL` and `is_system_event = TRUE`")
- `ReactiveActivityRepositoryImpl.md:bugs_limitations_corner_cases[2]` ("`activity.created_by` is `varchar(512)` NULLABLE — anonymous mutations and ingestion-path system events write null... Under DISABLED-mode, the anonymous mutations LOOK like system events" — MEDIUM)
- `ActivityServiceImpl.java:46-49` (the `switchIfEmpty(Mono.defer(() -> Mono.just(activityMapper.mapToPojo(event, activityCreateTime, null))))` line — explicit null fallback)
- `ActivityCreateEvent.java:13` (the `systemEvent` boolean — exists on the DTO)
- `ActivityIngestionRequestProcessor.java:24-32` (the ingestion-path consumer — runs without security context)
- `DisabledAuthSecurityConfiguration.java:16` (the DISABLED-mode anonymous-permitted configuration)

**Description**: The activity persistence at `ActivityServiceImpl.createActivityEvent` (`:43-52`) resolves the actor via:

```java
return authIdentityProvider.getCurrentUser()
  .map(UserDto::username)
  .map(username -> activityMapper.mapToPojo(event, activityCreateTime, username))
  .switchIfEmpty(Mono.defer(() ->
    Mono.just(activityMapper.mapToPojo(event, activityCreateTime, null))     // line 49 — NULL fallback
  ))
  .flatMap(activityRepository::saveReturning);
```

The `.switchIfEmpty` clause fires when `authIdentityProvider.getCurrentUser()` returns `Mono.empty()` — i.e. no SecurityContext is present. This happens in TWO scenarios:

1. **Legitimate system events**:
   - `ActivityIngestionRequestProcessor.process` (`:24-32`) — the S2S ingestion path runs on a scheduling/IO thread with NO ReactiveSecurityContext. Emits DATA_ENTITY_CREATED activity events with `created_by = null`.
   - `AlertServiceImpl` background flows that emit OPEN_ALERT_RECEIVED / RESOLVED_ALERT_RECEIVED / ALERT_STATUS_UPDATED events via scheduler-driven paths; the `ActivityCreateEvent.systemEvent` flag is set to `true` per ActivityCreateEvent.java:13.
   - Auto-resolution events emitted by Alerting (per the live docs page WebFetch: "Auto-resolution events emitted from the Alerting subsystem are recorded as system events on the feed (no operator identity attached)").

2. **Legitimate-but-undesirable user events under DISABLED auth.type**:
   - `DisabledAuthSecurityConfiguration.java:16` calls `.anyExchange().permitAll()` — anonymous traffic is admitted. The anonymous request creates NO ReactiveSecurityContext.
   - Anonymous user submits a mutation (description edit, tag assignment, status update) → the wrapping `@ActivityLog` aspect's `createActivityEvent` invocation hits the null-username fallback at line 49 → the activity row commits with `created_by = NULL`.
   - This row is **VISUALLY INDISTINGUISHABLE** from a legitimate system event at the UI surface.

**The discriminator gap**: the `is_system_event` BOOLEAN column on the ActivityPojo (referenced via `event.systemEvent` per ActivityCreateEvent line 13) WOULD discriminate the two scenarios — but only IF the boolean is reliably set to TRUE for case (1) and FALSE for case (2). The verification trail:
- Case 1a (ActivityIngestionRequestProcessor): looking at the source, ActivityCreateEvent.builder doesn't appear to set systemEvent — needs verification (probe P-020 emitted).
- Case 1b (AlertServiceImpl): explicit `.systemEvent(true)` per the AlertServiceImpl code (referenced indirectly via sidecar evidence; not verified in this batch).
- Case 2 (DISABLED-mode anonymous): the wrapping aspect's `createActivityEvent` call (or the `@ActivityLog` event-construction in business methods) does NOT set systemEvent — defaults to FALSE.

If the verification (P-020) confirms the asymmetry — case 1a defaults to FALSE, case 1b defaults to TRUE, case 2 defaults to FALSE — then the UI cannot reliably distinguish a NULL-attributed ingestion-event (case 1a) from a NULL-attributed anonymous user mutation (case 2).

**Operator-visible consequence**: forensic-attribution gap. An operator reading the audit feed for "who changed X" finds a row with `created_by = null`. They cannot tell:
- Was this a legitimate ingestion-path event (case 1a)?
- Was this an alert-system auto-resolution (case 1b — if `is_system_event = true`, then yes)?
- Was this an anonymous user via DISABLED mode (case 2)?

For deployments using DISABLED in production (against the docs' "dev-only" framing — per REFACTOR-068 the docs do not warn loudly enough), the per-row attribution gap is a forensic issue.

**Cross-cutting context**: combines with REFACTOR-068 (`/api/appInfo` fingerprinting under DISABLED), REFACTOR-072 (LOGIN_FORM bypasses AuthorizationCustomizer), REFACTOR-073 (no boot-time security-posture validator), REFACTOR-185 (DISABLED-mode bypasses SECURITY_RULES) — all DISABLED-mode footguns. The activity-attribution gap is the audit-trail tail end of "DISABLED is silent-insecure-by-default."

**Primary source citations**:
- `ActivityServiceImpl.java:46-49` (the null-fallback — verified)
- `ActivityServiceImpl.java:53-63` (the batch `createActivityEvents` — same fallback pattern at line 60)
- `ActivityCreateEvent.java:13` (the `systemEvent` boolean exists on the DTO)
- `V0_0_48__add_activity.sql:8` (`is_system_event` column on the table — NOT NULL — exists)
- `V0_0_48__add_activity.sql:10` (`created_by varchar(512)` — NULLABLE allowed)
- `ActivityIngestionRequestProcessor.java:24-32` (consumer-side; no security context)
- `AlertServiceImpl.java:309-325` (the batch-emit caller with explicit `.systemEvent(true)`)
- `DisabledAuthSecurityConfiguration.java:16` (the DISABLED-mode permission)
- `ActivityMapper.java:79-81` (the mapper that translates `event.systemEvent` to the row column — needs verification per S-E-5)
- Probe `P-020` (pending) to verify the `is_system_event` column propagation across the three call-paths.

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-197 (NEW from this batch — "System events have NULL created_by, intentionally documented") codifies the design intent that null-`created_by` IS the legitimate system-event signal. The docs (WebFetch 2026-05-20) explicitly anchor this: "Auto-resolution events emitted from the Alerting subsystem are recorded as system events on the feed (no operator identity attached)". The intent IS clear; the GAP is that the SAME null-`created_by` shape is ALSO produced by DISABLED-mode anonymous mutations — without a discriminator.

**Proposed remedy**: Three options:

1. **LOWEST cost — verify and fix `is_system_event` propagation (P-020)**: First, run P-020 to verify whether the ingestion-path and alert-path consistently set `is_system_event = true`. If the alert path does but the ingestion path does NOT, fix the ingestion-path consumer to explicitly set `.systemEvent(true)` on the ActivityCreateEvent constructions. After the fix:
   - case 1a (ingestion): `is_system_event = true, created_by = null`
   - case 1b (alert system): `is_system_event = true, created_by = null`
   - case 2 (anonymous DISABLED): `is_system_event = false, created_by = null`
   The UI can then discriminate via `is_system_event`. Documents the contract clearly.

2. **MEDIUM cost — add a `source` column to discriminate**: Introduce an `activity.source ENUM('USER', 'INGESTION', 'ALERT_SYSTEM', 'ANONYMOUS_DISABLED')` column. The wrapping aspect / ingestion processor / alert-emit chain sets the source explicitly. Schema migration + mapper update. Provides cleanest forensic discrimination.

3. **HIGHER cost — refuse anonymous mutations under DISABLED**: Add a fail-soft check at the `@ActivityLog` boundary: if no SecurityContext AND `systemEvent != true`, log a WARN with diagnostic info ("anonymous mutation under DISABLED — no auth context, no system-event flag — please configure auth.type"). Forensic gap closes, operator gets a loud signal that DISABLED-mode is leaking through to mutations. Architecturally: requires a system-property flag to know we're in DISABLED mode.

**Recommended**: Option 1 (verify and fix is_system_event propagation) — addresses the forensic-discrimination concern without schema migration. Pair with Option 3's WARN log for DISABLED-mode anonymous mutations (cheap and high-signal).

**Severity rationale**: MEDIUM — forensic-attribution gap. The activity feed's primary use is compliance audit and incident response; null-`created_by` rows ambiguous between system and anonymous-user attribution undermine the audit trail's usability. Severity is bounded by:
- Most production deployments use LOGIN_FORM/OAUTH2/LDAP, not DISABLED — so case (2) is rare in practice.
- The information leaked is per-event attribution, not platform-wide data.
- The fix is incremental (mapper update + propagation audit).

**Suggested backlog grouping**: `SEC-NNN activity-audit correctness sprint`. Pair with REFACTOR-556 (transactional coupling), REFACTOR-558 (oldState race), REFACTOR-580 (cross-mode bleed). The four activity-audit-correctness scopes together define "activity audit log is approximate, not authoritative" — the maintainer can choose to invest in tightening.

---
