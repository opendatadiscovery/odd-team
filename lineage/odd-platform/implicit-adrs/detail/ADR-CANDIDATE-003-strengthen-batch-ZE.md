## STRENGTHENS — Batch ZE (Discovery + Search + Links + Feature + Relationship + Title — 5 new read-collaborative confirmations; the read-surface bookend is now exhaustive across the catalog)

**Five new class-level sidecars confirm ADR-CANDIDATE-003's GET-uniformly-authenticated pattern.** All 5 batch-ZE controllers are READ-only surfaces (no POST/PUT/DELETE on TitleController, FeatureController, LinksController, RelationshipController; only POST/PUT on SearchController is for SESSION CREATION — not data mutation). Every endpoint falls through to `pathMatchers("/**").authenticated()`. The ADR's read-collaborative posture now triangulates across **22 sidecars** (was 17 after batch ZD).

**New surfaced_by entries (the GET-uniformly-authenticated pattern)**:
- `odd-platform__java__SearchController__controller-class__SearchController.md:implicit_adrs.[2]` — confirms the convention across ALL 7 search endpoints (the entire P-04 Data Discovery search surface is read-collaborative): `POST /api/search` (session create), `GET /api/search/{id}` (re-read), `PUT /api/search/{id}` (state merge — still read-collaborative because it merges into the caller's-own session state, not into a shared-data resource), `GET /api/search/{id}/results`, `GET /api/search/{id}/facet/{facet_type}`, `GET /api/search/suggestions`, `GET /api/search/{id}/data_entities/{de_id}/highlights`. The full search surface is uniformly read-collaborative.
- `odd-platform__java__TitleController__controller-class__TitleController.md:concepts.invariants.[3]+[4]` — confirms the read-collaborative posture for the Title directory: "in LOGIN_FORM / OAUTH2 any authenticated user can list ALL titles regardless of policy, role, or owner scope" + "No owner-scoping on read — the controller does not filter titles by which Data Entities the caller can see; the entire directory is enumerable by any authenticated user"
- `odd-platform__java__FeatureController__controller-class__FeatureController.md:stress_findings.auth_gates.[0]` — "What does a wrong-role caller see? All four auth modes: 200 OK. There is no role-gated access; the endpoint requires only AUTHENTICATION (not authorization). A READ_ONLY user, a USER, and an ADMIN all receive identical responses — the role distinction has no effect on this endpoint. This is by design; the FeatureList is intentionally not role-scoped (the same flags apply to all users)."
- `odd-platform__java__RelationshipController__controller-class__RelationshipController.md:implicit_adrs.[1]` — confirms the read-collaborative posture for the P-02 Data Modelling relationship surface (cross-link ADR-CANDIDATE-215 NEW — the catalog-global stance on relationship metadata that EXTENDS the read-collaborative posture to also ignore EXCLUDE_FROM_SEARCH).
- `odd-platform__java__LinksController__controller-class__LinksController.md:implicit_adrs.[1]` (HIGH) — "The 'additional links' surface is GLOBAL (visible to every authenticated user), not per-user or per-role; an operator cannot show different links to different roles via this feature." — cross-link ADR-CANDIDATE-214 NEW.

**Cross-batch refinement** (batch ZE confirms the read-collaborative posture spans EVERY platform pillar):

The 22-sidecar coverage now spans:
- **P-01 Data Discovery**: SearchController (7 endpoints) — NEW batch ZE
- **P-02 Data Modelling**: RelationshipController (3 endpoints) — NEW batch ZE; PLUS lineage (per batch J)
- **P-03 Data Quality**: prior batches
- **P-04 Data Catalog**: DataEntityController detail / popular / list (per batches F, G)
- **P-05 Ownership**: TitleController + OwnerController reads — NEW batch ZE adds Title
- **P-06 Configuration**: FeatureController + LinksController — NEW batch ZE adds both
- **P-07 Alerting**: AlertController reads (per batch A)
- **P-08 Activity**: ActivityController (per prior batches)
- **P-09 Security & Access Control**: PermissionController + PolicyController reads + IdentityController (per batch ZD)
- **P-10 Ingestion**: prior batches

Every pillar has at least one read-collaborative endpoint confirming the convention. The convention HOLDS without exception (modulo the EXCLUDE_FROM_SEARCH asymmetry on relationships per ADR-CANDIDATE-215's borderline_flag).

**Cumulative count update**: ADR-CANDIDATE-003 now triangulates across **22 sidecars** (was 17 after batch ZD). The borderline_flag remains open for the maintainer's triage — is the GET-uniformly-authenticated posture intentional read-collaboration OR forgotten gates? The 22-sidecar coverage with NO counter-examples on the read side increases the confidence that it IS deliberate, but the maintainer's resolution requires reading the platform's product intent (multi-tenant deployments would prefer ownership-scoped reads; single-tenant teams prefer the read-collaborative posture).

**Severity unchanged**: HIGH — the canonical read-collaborative authorization stance.

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-002 (centralised SECURITY_RULES — read-collaborative is the convention's READ-side application); ADR-CANDIDATE-212 NEW (Title directory side-effect-only mutation — the Title-specific instance of the read-collaborative pattern on a dimension directory); ADR-CANDIDATE-214 NEW (additional links global surface — the Links-specific instance); ADR-CANDIDATE-215 NEW (relationships catalog-global read — the Relationships-specific instance with the EXCLUDE_FROM_SEARCH asymmetry).
- SUPERSEDES: none.
- CONFLICTS: none.

---
