## ADR-CANDIDATE-146 — Audit table is STRUCTURALLY scoped to data-entity events via `activity.data_entity_id NOT NULL` FK (schema-rooted, not annotation-rooted)

**Severity**: HIGH
**Classification**: promote (NEW ADR; SCHEMA-ROOTED architectural commitment)
**Pillars affected**: [P-07-active-platform-features, P-09-security-access-control, P-08-management-administration]
**Support count**: 1 sidecar primary-source (batch R ReactiveActivityRepositoryImpl) + cross-batch corroboration with F-006 drift_class `forensic_silence_on_rbac_mutations` (6-sidecar consolidation prior) + concept catalog entries `no-audit-log-on-rbac-mutations-audit-log-presence-asymmetry-refined-in-batch-f` + `audit-log-presence-asymmetry-2-tier-audit-story`
**Axes present**: repositories, schema_migrations, services
**Batch**: R (2026-05-20)

**Surfaced by**:
- `ReactiveActivityRepositoryImpl.md:implicit_adrs.[0]` (HIGH) — "Audit is structurally scoped to data-entity events: `activity.data_entity_id` is `NOT NULL` with FK constraint to `data_entity(id)` (V0_0_48__add_activity.sql:4,12). The decision encodes that this table is the 'data-entity audit log', not a 'platform audit log'. RBAC mutations (Role / Policy / Owner CRUD), Datasource registration, Collector token rotation, integration-wizard config changes — none can write here. A separate platform-event audit surface would be required to capture them." — evidence: V0_0_48__add_activity.sql:4 (`data_entity_id bigint NOT NULL`) + V0_0_48__add_activity.sql:12 (`CONSTRAINT activity_data_entity_id_fk FOREIGN KEY (data_entity_id) REFERENCES data_entity (id)`) + ReactiveActivityRepositoryImpl.java:155, 176, 197, 219 (INNER JOIN to DATA_ENTITY in every read path — assumes the FK is unbreakable) — intent_anchor: "the FK constraint at V0_0_48__add_activity.sql:12 is named `activity_data_entity_id_fk` (verbose, schema-evolution-aware naming) and the column is `NOT NULL` (line 4) — both are explicit choices over the alternative `data_entity_id bigint NULL` which would have left the door open for non-data-entity events. The schema author committed to data-entity-scoped audit." — confidence: HIGH

**Decision statement**: The platform's Activity Feed (`activity` table) is STRUCTURALLY a data-entity audit log, not a platform-wide audit log. The schema commits to this by declaring `activity.data_entity_id` as `NOT NULL` with a non-null foreign-key constraint to `data_entity(id)` (`V0_0_48__add_activity.sql:4,12`). The FK constraint is named verbosely (`activity_data_entity_id_fk`) and was declared `NOT NULL` rather than NULLable — both deliberate choices. Every read path in `ReactiveActivityRepositoryImpl` uses INNER JOIN to DATA_ENTITY (lines 155, 176, 197, 219), assuming the FK is unbreakable.

The consequence: RBAC mutations (Role / Policy / Owner CRUD), Datasource registrations, Collector token rotations, Integration-Wizard config changes — none have a data-entity context and so CANNOT write to this table. The audit-log-presence-asymmetry surfaced across batches D / F / I as a missing-`@ActivityLog` gap is, in fact, STRUCTURAL — adding `@ActivityLog` to `PolicyServiceImpl.create()` would not work because the activity row cannot be persisted without a `data_entity_id`.

A platform-wide audit log would require redesigning the audit subsystem:
- (a) NULLable `data_entity_id` + discriminator column (`event_target_type` with values DATA_ENTITY / ROLE / POLICY / OWNER / DATA_SOURCE / COLLECTOR_TOKEN / ...) + per-target-type read paths
- (b) A sibling `platform_audit` table for non-data-entity events, with its own retention + read API
- (c) A union schema (`event_target_type` + `event_target_id` UUID — polymorphic FK pattern) — more flexible but PG-FK-unfriendly

None of these is "just add an annotation." The ADR codifies the schema-tier commitment so that future maintainers understand the structural barrier.

The architectural commitments:
- **(a) The Activity Feed audits MUTATIONS TO DATA-ENTITY METADATA.** Description edits, tag assignments, ownership changes, status changes — all per-entity, all have a `data_entity_id`.
- **(b) Platform-administrative mutations are NOT in scope.** RBAC, Owner directory, Datasource registry, Collector tokens — these have no data-entity context; the activity table cannot store them.
- **(c) The doc-site framing of "the platform records changes" is INCOMPLETE.** Operators reading the Activity Feed page reasonably assume "every platform change is audited"; the structural scope must be made explicit in docs.
- **(d) A future platform-wide audit subsystem is a SCHEMA decision, not an annotation decision.** The ADR's promotion would make any future refactor work first on the schema commitment.

**Wisdom test**: PASS on all three questions.
1. **Intentional?** YES — three independent commitments to the design:
   - The `NOT NULL` declaration (vs NULLable) at V0_0_48__add_activity.sql:4
   - The verbose FK-constraint name `activity_data_entity_id_fk` at V0_0_48__add_activity.sql:12 (schema-evolution-aware naming pattern)
   - The INNER JOIN read paths at ReactiveActivityRepositoryImpl.java:155, 176, 197, 219 (every read path assumes the FK is unbreakable)
   None of them is "implementation accident".
2. **Structural impact?** YES — every audit-log expectation depends on this; every refactor that wants to log RBAC mutations must change the schema first; every operator's expectation of "the Activity Feed shows me everything" is defined by this; every future maintainer evaluating audit coverage works against this barrier.
3. **Refactoring or structural?** STRUCTURAL — moving to a platform-wide audit requires either a schema migration (NULLable `data_entity_id` + discriminator column) or a parallel audit table. Neither is a "just add annotation" refactor.

**Existing ADR**: none in `adrs/`. Cross-references: F-006 drift_class (cross-batch consolidation — `forensic_silence_on_rbac_mutations` 6-sidecar prior) + concept catalog entries `no-audit-log-on-rbac-mutations-audit-log-presence-asymmetry-refined-in-batch-f` + `audit-log-presence-asymmetry-2-tier-audit-story` (the concept entries describe the symptom; this ADR is the parent decision).

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-188 (no audit on RBAC mutations — the gap; ADR codifies the decision while the scope codifies the fix)
- F-006 family (cross-batch consolidation — RBAC + Owner + Datasource + Collector-token mutations all uncovered)
- REFACTOR-441 NEW (activity-table monotonic growth — the consequence of the audit scope's narrowness colliding with the no-cleanup mechanism)

**Proposed action**: Promote to `adrs/drafts/audit-log-data-entity-scoped-by-schema.md` (new ADR). Document the schema commitment + the explicit consequence (RBAC mutations not audited) + the design choice for any future platform-wide audit (sibling table vs nullable FK + discriminator vs polymorphic-FK union). Live-doc-side: surface the caveat on `features/active-platform-features/activity-feed` — the docs currently frame Activity Feed as "platform changes" without naming the data-entity-only scope.

**Severity rationale**: HIGH — structural commitment; defines audit coverage for every future platform-mutation surface; the doc-site is silent on the scope today; cross-references the highest-severity REFACTOR family (F-006).

---
