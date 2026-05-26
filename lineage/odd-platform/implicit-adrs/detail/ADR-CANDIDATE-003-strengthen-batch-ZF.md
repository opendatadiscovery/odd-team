# ADR-CANDIDATE-003 — GET endpoints intentionally outside `SECURITY_RULES`; read-collaborative posture

## STRENGTHENS — batch ZF (2026-05-25)

**Four new read-surfaces join the family** (was 17-sidecar after batch ZD; batch ZE strengthened to 18 with Relationship reads; batch ZF brings to **22-sidecar**):

- `odd-platform__java__OwnerController__controller-class__OwnerController.md:coherence_notes.[strengthens]` — "the GET `/api/owners` path has NO rule … `getOwnerList` at `OwnerController.java:30-38` has NO SecurityRule entry … Reading the Owner directory is therefore reachable by ANY authenticated user under any active auth mode."
- `odd-platform__java__MetadataFieldController__controller-class__MetadataFieldController.md:concepts.invariants.[Auth-required-but-NO-per-permission-gate]` — "`/api/metadata/fields` is not in `SecurityConstants.WHITELIST_PATHS` and has no `SECURITY_RULES` entry; falls through to `pathMatchers(\"/**\").authenticated()`."
- `odd-platform__java__DataCollaborationController__controller-class__DataCollaborationController.md:concepts.invariants.[All-three-endpoints-RBAC-ungated]` — covers `GET /api/datacollaboration/providers/slack/channels` (channel autocomplete) + `GET /api/messages/{message_id}/url` (the redirect). Both are GET reads.
- `odd-platform__java__IngestionController__controller-class__IngestionController.md:concepts.invariants` — `GET /ingestion/dataentitygroups/{deg_oddrn}/entities` is one of 5 ingestion endpoints; reachable unauthenticated under default deployment (no filter + WHITELIST_PATHS exempts /ingestion/**). The READ side of the S2S surface follows the same read-collaborative posture.

Batch ZF widens the pattern's surface area in three new ways:

1. **The pattern extends to S2S read endpoints** (IngestionController's GET) — previously the pattern was characterised as "UI-side GET endpoints". Batch ZF demonstrates it also applies to S2S `/ingestion/dataentitygroups/{deg_oddrn}/entities`, with the additional layer of WHITELIST_PATHS exempting the ingestion namespace.

2. **The pattern extends to webhook-shaped reads via redirect** (DataCollab `GET /api/messages/{message_id}/url`) — a GET that returns a 302 to a Slack permalink. The read-collaborative posture means any authenticated user can probe message IDs and resolve them to Slack permalinks (operator-visible consequence: combined with the no-404-on-missing gap, becomes a message-existence-by-id oracle — REFACTOR-638).

3. **The pattern is operator-visible for PII-bearing directory enumeration** (Owner GET) — `getOwnerList` returns the FULL directory (only soft-delete-filtered) to ANY authenticated caller. Owner names may carry PII (`alice@acme.com`, `[Pseudonymous Researcher]`, internal team names). The read-collaborative posture is the canonical default; the operator-actionable consequence is REFACTOR-640.

**Cumulative read surfaces covered by this ADR** (22 confirmed):
- Catalog reads: DataEntity / DataSet / Term / Tag / Title / Owner (directory) / Metadata field directory / Policy / Permission / Role
- Lifecycle reads: Identity (whoami) / Permission resource-permissions
- Graph reads: Relationship / Lineage
- Operator-config reads: Feature / Links / Integration
- Discussions reads: DataCollab channel autocomplete / DataCollab redirect / DataCollab message-list
- S2S reads: Ingestion DEG membership

The ADR is the LOAD-BEARING ONE for the platform's read posture. Every refactoring scope that asks "should this read be gated?" must reference ADR-003 first.

**Sub-pattern emerging — borderline cases**: batch ZF surfaces three borderline reads that deserve maintainer triage rather than auto-acceptance under ADR-003:

- **Owner directory GET** — names carry PII; the read-collaborative posture is operator-visible-significant. Operator might want an `OWNER_LIST_READ` permission gate. REFACTOR-640 surfaces this.
- **Metadata field directory GET** — vocabulary like `salary_band`, `phi_classification`, `pii_indicator` may leak governance intent. Operator might want `CUSTOM_METADATA_FIELD_READ`. REFACTOR-642 surfaces this.
- **DataCollab message-id redirect GET** — guess-an-id reaches anyone's message URL. Operator might want owner-scoping. REFACTOR-638 + REFACTOR-636 surface this.

These three should be flagged in the ADR-003 doc as the canonical instances where operators can override the read-collaborative posture per-endpoint.

The 22-sidecar evidence base preserves ADR-003 as a load-bearing platform decision; the borderline cases STRENGTHEN rather than supersede it (they are TRIAGE POINTS for the maintainer, not contradictions).

---
