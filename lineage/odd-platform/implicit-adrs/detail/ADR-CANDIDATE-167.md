## ADR-CANDIDATE-167 — OwnerAssociationRequest workflow has a DEDICATED audit table (`owner_association_request_activity`) with 5 typed event values — the POSITIVE half of the 2-tier audit story

**Severity**: HIGH
**Classification**: promote (NEW ADR; POSITIVE-INTENT — codifies workflow-specific audit pattern)
**Pillars affected**: [P-08-management-administration (Associations tab), P-09-security-access-control (Principal-to-Owner Resolution), P-07-active-platform-features (activity-feed family)]
**Support count**: 1 sidecar primary-source (batch V OwnerAssociationRequestController class) + cross-batch resolution of system-mission.md canonicalisation candidate `audit-log-presence-asymmetry-2-tier-audit-story` (lines 386-395)
**Axes present**: controllers, services, schema_migrations (cross-referenced via V0_0_51__add_owner_association_request.sql)
**Batch**: V (2026-05-20)

**Surfaced by**:
- `OwnerAssociationRequestController__controller-class__OwnerAssociationRequestController.md:implicit_adrs.[0]` (HIGH) — "Audit-log SEPARATION OF CONCERNS — the OwnerAssociationRequest workflow gets its own dedicated audit table (owner_association_request_activity) with five typed event values (REQUEST_CREATED / REQUEST_DECLINED / REQUEST_APPROVED / REQUEST_MANUALLY_APPROVED / REQUEST_MANUALLY_DECLINED) rather than reusing the global ActivityEventType enum." — evidence: OwnerAssociationRequestController.java:25 (separate activityService field) + OwnerAssociationRequestActivityType.java:3-8 (the 5-value enum) — intent_anchor: "`OwnerAssociationRequestActivityType` enum is the entire purpose of this file — exists ONLY to type events for this controller's workflow; not shared with `ActivityEventType` which has 27 values for entity-metadata changes"
- `OwnerAssociationRequestController__controller-class__OwnerAssociationRequestController.md:implicit_adrs.[1]` (HIGH) — "Dual-plane approval — both SELF-request-then-approve and MANUAL-mapping flows reach the same end-state (USER_OWNER_MAPPING + audit row), but the MANUAL flow uses distinct `REQUEST_MANUALLY_APPROVED` event-typing so the audit reader can distinguish them." — evidence: OwnerAssociationRequestServiceImpl.java:131-148 + 205-221 — intent_anchor: "the `isManual` parameter threading through createOwnerAssociationRequestWithActivity → createActivity is the design's load-bearing distinction between an operator-direct action and a user-initiated-then-approved action"

**Decision statement**: The OwnerAssociationRequest workflow has its OWN dedicated audit table (`owner_association_request_activity`, queried via `getOwnerAssociationRequestActivityList` at OwnerAssociationRequestController.java:47-53) and a DEDICATED 5-value `OwnerAssociationRequestActivityType` enum (REQUEST_CREATED / REQUEST_DECLINED / REQUEST_APPROVED / REQUEST_MANUALLY_APPROVED / REQUEST_MANUALLY_DECLINED) — rather than reusing the global `ActivityEventType` enum (which has 27 values for entity-metadata changes, all scoped to the `data_entity` audit table per ADR-CANDIDATE-146).

The five event values track the FULL workflow:
1. `REQUEST_CREATED` — a user submitted a self-association request (POST /api/owner_association_request)
2. `REQUEST_APPROVED` — an admin approved a pending request (PUT /api/owner_association_request/{id} with status=APPROVED)
3. `REQUEST_DECLINED` — an admin declined a pending request (PUT /api/owner_association_request/{id} with status=DECLINED)
4. `REQUEST_MANUALLY_APPROVED` — an admin DIRECTLY created a user-owner mapping bypassing the request flow (POST /api/owners/mapping)
5. `REQUEST_MANUALLY_DECLINED` — an admin DIRECTLY revoked a mapping (DELETE /api/owners/mapping/{owner_id}) — the cancellation also writes the REQUEST_MANUALLY_DECLINED event for colliding-open requests via `cancelCollisionAssociationById` at OwnerAssociationRequestServiceImpl.java:192-203

The architectural commitments:
- **(a) The OwnerAssociationRequest workflow is fully auditable at the workflow level.** Every state transition writes a typed audit row to a workflow-specific table. The reader of the audit table sees who initiated, who approved/declined, when, and via which plane (self-service vs admin-manual).
- **(b) The dual-plane distinction is PRESERVED in the audit data.** A reader can DISTINGUISH "user requested → admin approved" from "admin manually approved" because the event types differ (`REQUEST_APPROVED` vs `REQUEST_MANUALLY_APPROVED`). The `isManual` parameter threading through `createOwnerAssociationRequestWithActivity` → `createActivity` is the design's load-bearing distinguisher.
- **(c) The audit table is DETACHED from the data-entity audit subsystem.** Per ADR-CANDIDATE-146, the global `activity` table requires `data_entity_id NOT NULL` (V0_0_48__add_activity.sql:4,12) — RBAC-tier events cannot be audited there because they have no data-entity context. OwnerAssociationRequest solved this by creating a SEPARATE audit table with no data-entity FK constraint. This is the POSITIVE half of the 2-tier audit story.
- **(d) The pattern is a TEMPLATE for future workflow-specific audit needs.** Datasource registry mutations, Collector token rotations, Integration-Wizard config changes — each could follow this pattern: dedicated audit table + dedicated event-type enum + service-tier emission. The pattern is NOT extending the global `activity` table; it is creating sibling audit tables per workflow domain.

This ADR is the explicit POSITIVE-INTENT companion to the canonicalisation candidate `audit-log-presence-asymmetry-2-tier-audit-story` (system-mission.md lines 386-395). The maintainer can now resolve that candidate as a TWO-tier story:
- **POSITIVE tier** — OwnerAssociationRequest (this ADR): workflow-specific audit table + typed event enum + dual-plane distinguisher.
- **NEGATIVE tier** — RBAC-directory-CRUD (Role/Policy/Owner CRUD): no audit table, no `@ActivityLog`, no forensic trail (captured in F-006 + REFACTOR-188 as the still-open gap).

**Wisdom test**: PASS on all three questions.
1. **Intentional?** YES — three independent commitments: (i) the dedicated table existed at schema-creation time (V0_0_51__add_owner_association_request.sql); (ii) the 5-value enum is a dedicated file (`OwnerAssociationRequestActivityType.java`), not shared with `ActivityEventType`; (iii) the controller injects a SEPARATE `OwnerAssociationRequestActivityService` field beside the lifecycle service. The "isManual" boolean threading through `createOwnerAssociationRequestWithActivity` is the load-bearing distinguisher.
2. **Structural impact?** YES — every audit-log expectation around user-onboarding depends on this; every RBAC mutation that wants a dedicated audit table must follow this pattern (or unify back into the global activity table by extending the schema); the two-tier audit story is the canonical framing of the platform's audit coverage.
3. **Refactoring or structural?** STRUCTURAL — removing the dedicated table would lose the forensic record of who approved which association; merging into the global activity table requires a schema migration (cross-link to ADR-CANDIDATE-146's structural barrier). Adding a new workflow's audit table is a STRUCTURAL DECISION (new schema migration + new entity + new service).

**Existing ADR**: none. Cross-references ADR-CANDIDATE-146 (audit table schema-rooted — the OwnerAssociationRequest table is the architectural WORKAROUND for the data_entity_id NOT NULL constraint).

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-188 family (no audit on Role/Policy/Owner directory-CRUD — the NEGATIVE tier; the OwnerAssociationRequest pattern is the template for fixing this).
- REFACTOR-483 NEW batch V (DIRECT_OWNER_SYNC + getOrCreate escalation chain — uses this audit table but the escalation chain itself bypasses OWNER_CREATE permission; the audit row IS written even for the escalated request, which is forensically valuable but does not BLOCK the escalation).
- Activity-log retention gap: the `owner_association_request_activity` table has NO retention mechanism either (cross-link with REFACTOR-085 / REFACTOR-441 — the activity-retention family).
- Two endpoints (POST /api/owner_association_request, GET /api/owners/providers) intentionally OUTSIDE SECURITY_RULES (per ADR-CANDIDATE-002-strengthen-batch-V); the audit table captures the request even for self-service users with zero permissions.

**Proposed action**: Promote to `adrs/drafts/owner-association-request-dedicated-audit.md` (new ADR). Document the 5-value enum + the dual-plane distinction + the cross-link to ADR-CANDIDATE-146 + the explicit POSITIVE/NEGATIVE tier framing of the audit-asymmetry canonicalisation candidate + the template for future workflow-specific audit needs.

**Severity rationale**: HIGH — security-architecture decision; defines audit coverage for the user-onboarding surface; explicitly resolves the 2-tier audit-story canonicalisation candidate from system-mission.md; establishes the template for future workflow-specific audit subsystems.

---
