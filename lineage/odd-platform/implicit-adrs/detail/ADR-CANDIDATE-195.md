## ADR-CANDIDATE-195 — Activity table is schema-rooted "data-entity audit log", NOT "platform audit log" — `data_entity_id BIGINT NOT NULL` + FK to `data_entity(id)` is the structural enforcement; RBAC mutations / Owner CRUD / Datasource registration / Collector-token rotation are STRUCTURALLY EXCLUDED from this surface

**Severity**: HIGH
**Classification**: promote (new — codifies a load-bearing schema decision that 9+ sidecars across multiple batches surface)
**Support count**: 5 sidecars (`ReactiveActivityRepositoryImpl` PRIMARY-SOURCE + `ActivityController` confirms via the read perimeter + `ActivityServiceImpl` confirms via the write perimeter + `ActivityHandler` confirms via the data-entity-scoped state-snapshot contract + cross-batch F-006 9-sidecar consolidation on audit-silence)
**Axes present**: schema, repository, service, controller, audit-log architecture
**Pillars affected**: P-01, P-05, P-06, P-09 — cross-pillar (audit scope, compliance, security architecture)

**Surfaced by**:
- `ReactiveActivityRepositoryImpl.md:implicit_adrs[0]` (PRIMARY-SOURCE — "Audit is structurally scoped to data-entity events: `activity.data_entity_id` is `NOT NULL` with FK constraint to `data_entity(id)`. The decision encodes that this table is the 'data-entity audit log', not a 'platform audit log'. RBAC mutations (Role / Policy / Owner CRUD), Datasource registration, Collector token rotation, integration-wizard config changes — none can write here. A separate platform-event audit surface would be required to capture them")
- `ReactiveActivityRepositoryImpl.md:security.known_security_gaps[2]` ("**Audit-silence on RBAC / Owner / Datasource / Collector-token mutations** is structurally enforced at the schema (NOT a missing-annotation bug)")
- `ActivityController.md:security.known_security_gaps[5]` (CRITICAL — "Audit-trail SILENCE on RBAC/Owner CRUD/Datasource/Collector mutations (F-006 9-sidecar pattern, batch R schema-rooted): this controller surfaces only what `activity.data_entity_id NOT NULL` permits — a Role creation, Policy edit, Owner deletion, or Collector token rotation produces NO row in this feed. A security-compliance reviewer reading the feed cannot detect a Policy edited to remove a permission gate")
- `ActivityServiceImpl.md:security.known_security_gaps[0]` (the entire Activity Feed is visible to any authenticated user across all owners — confirms the scope is data-entity-only by SQL evidence)
- `ActivityHandler.md:concepts.entities.ActivityHandler` (the 18 concrete handlers ALL bind to data-entity events — confirms the handler dispatch is structurally scoped to data-entity event types)
- `V0_0_48__add_activity.sql:4` (`data_entity_id bigint NOT NULL`) + `V0_0_48__add_activity.sql:12` (`CONSTRAINT activity_data_entity_id_fk FOREIGN KEY (data_entity_id) REFERENCES data_entity (id)`)
- Cross-batch F-006 (9-sidecar pattern surfaced earlier in batch R — RBAC + Datasource + Collector + Owner + Role + Policy + Permission all surface the activity-silence concern from their respective angles)

**Decision statement**: The platform's activity table (`public.activity`) is schema-rooted as the "data-entity audit log" via a NOT NULL FK constraint on `data_entity_id`. Structurally, NO activity row can be written that doesn't reference a data-entity. RBAC mutations (Role, Policy, Permission creation / edit / deletion), Owner CRUD (the directory-tier ownership management), Datasource registration, Collector-token rotation, and integration-wizard config changes are STRUCTURALLY EXCLUDED from this surface — they cannot persist activity rows here.

The decision is BACKED BY:
- A NOT NULL constraint on `data_entity_id` (V0_0_48__add_activity.sql:4) — schema-level enforcement.
- A FK to `data_entity(id)` (V0_0_48__add_activity.sql:12) — referential integrity.
- The 18 `ActivityHandler` implementations ALL bind to data-entity event types (the `ActivityEventTypeDto` enum has 27 values, but they are categorically "data-entity events": DATA_ENTITY_CREATED, DESCRIPTION_UPDATED, TAGS_UPDATED, OWNERSHIP_CREATED, etc.).
- The repository's INNER JOIN to DATA_ENTITY (`ReactiveActivityRepositoryImpl.java:219`) — read paths assume the FK is unbreakable.
- The repository has NO `deleteFrom(ACTIVITY)` and does NOT extend any soft-delete CRUD inheritance — append-only, data-entity-scoped, by design.

The maintainer's intent (per the FK naming convention `activity_data_entity_id_fk` + the explicit NOT NULL + the consistent handler shape) is to make this a focused audit log for data-entity lifecycle events. A platform-level audit log (capturing RBAC / Owner / Datasource events) would require a SEPARATE table (e.g. `platform_audit_log`) with different schema.

**Wisdom test (3-question)**:
1. *Intentional?* YES — the FK constraint is explicit; the NOT NULL is explicit; the 18-handler dispatch consistently maps to data-entity event types; the naming convention `activity_data_entity_id_fk` is verbose and schema-evolution-aware (signaling deliberate FK design); the INNER JOIN posture in reads assumes the FK is unbreakable.
2. *Structural impact?* YES — defines the scope of audit coverage for the entire platform. Compliance use-cases (SOX, GDPR records-of-processing) must reckon with this scope. A platform-level audit log is a SEPARATE design that would require new tables.
3. *Refactoring or structural?* STRUCTURAL — adding RBAC/Owner/Datasource events to this table is NOT a refactor; it would require either (a) relaxing the NOT NULL constraint (breaking existing read-side INNER JOIN semantics + downstream consumers) OR (b) creating new event-type+handler+UI surfaces.

→ ADR.

**Evidence**:
- `ReactiveActivityRepositoryImpl.md` says: "Audit is structurally scoped to data-entity events: `activity.data_entity_id` is `NOT NULL` with FK constraint to `data_entity(id)`. The decision encodes that this table is the 'data-entity audit log', not a 'platform audit log'"
- `ActivityController.md` says: "Audit-trail SILENCE on RBAC/Owner CRUD/Datasource/Collector mutations (F-006 9-sidecar pattern, batch R schema-rooted): this controller surfaces only what `activity.data_entity_id NOT NULL` permits"
- 9-sidecar F-006 pattern (cross-batch): every directory-tier sidecar (Role, Policy, Owner, Datasource, Collector) surfaces the audit-absence from its angle; this ADR is the SCHEMA-ROOTED root cause
- intent_anchor: the FK naming `activity_data_entity_id_fk` (verbose, schema-evolution-aware) + the NOT NULL + the INNER JOIN posture in reads + the consistent handler shape — all four signals point to a deliberate "data-entity-scoped" design.

**Existing ADR**: NEW (codifies a structural decision that had been observable across 9+ sidecars but never explicitly framed as an ADR). Composes with:

- ADR-CANDIDATE-068 (Two-tier soft-delete inheritance taxonomy — activity is the architectural EXCEPTION to soft-delete; this ADR-195 explains WHY: data-entity-scoped audit doesn't need soft-delete because the parent FK governs lifecycle).
- ADR-CANDIDATE-069 (Edge tables are HARD-DELETE by design; reconstruction relies on the activity-feed audit trail — this ADR-195 explains the audit-trail SCOPE: data-entity edges can be reconstructed; RBAC/Owner edges CANNOT).
- ADR-CANDIDATE-198 (NEW from this batch — Activity table is APPEND-ONLY — composes: this ADR-195 explains the schema-scope; ADR-198 explains the schema-mutability stance).

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-097 (existing — no audit logging infrastructure for RBAC mutations under DISABLED — this ADR EXPLAINS WHY: the activity table cannot hold those events; the FIX is a separate platform-audit table)
- REFACTOR-559 (NEW from this batch — per-entity activity has no per-data-entity authz — the read-side companion concern)
- REFACTOR-570 (NEW from this batch — strengthens REFACTOR-085: activity table monotonic growth, with FK-cascade concerns)
- REFACTOR-188 (existing — RBAC audit-log absence at the controller tier; this ADR-195 is the SCHEMA-LEVEL root cause)
- REFACTOR-097 (existing — no audit-logging infrastructure codebase-wide; this ADR-195 explains why the activity surface doesn't extend)
- F-006 (cross-batch 9-sidecar consolidation — the existing concept-level entry)

**Proposed action**: Promote to `adrs/drafts/activity-table-data-entity-scoped-audit-log.md`. Document:
- The schema constraints (FK + NOT NULL).
- The handler taxonomy (27 event types, all data-entity-scoped).
- The structural exclusion of platform-tier events.
- The cross-reference to REFACTOR-097 (audit-log absence at the platform tier).
- The recommendation for a future "platform_audit_log" table for RBAC/Owner/Datasource/Collector events — a SEPARATE design decision.
- The compliance implication: SOX / GDPR records-of-processing audits need TWO audit logs — this one (data-entity) + the future platform one — for complete coverage.

**Severity rationale**: HIGH — load-bearing audit-architecture decision affecting every compliance use case. The decision IS sound (focused-scope audit log with structural integrity) but the consequence (platform-tier blindness) requires explicit operator awareness. Promoting to ADR closes the maintainer-knowledge gap and surfaces the cross-cutting concern that operators investigating "platform changes" must consult multiple sources.

**Cross-pillar bump**: P-01 × P-05 × P-06 × P-09 — audit-log scope affects security, observability, compliance, and data-entity-lifecycle pillars. Severity already HIGH.

**Suggested backlog grouping**: ADR draft + DOC-NNN companion (document the audit-scope on `activity-feed.md`) + future-architecture-roadmap entry for the platform-tier audit-log discussion.

---
