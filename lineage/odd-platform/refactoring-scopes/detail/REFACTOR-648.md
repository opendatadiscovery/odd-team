# REFACTOR-648 — IngestionController has 5 endpoints with 3 different response-code shapes (200/201/201/200); the OpenAPI spec declares 201 for postDataEntityList but the impl returns 200; tests lock the drift in via `expectStatus().isOk()`

**Severity**: LOW (class-level enumeration of the existing platform-wide REFACTOR-545 cluster on the ingestion surface)
**Category**: openapi-spec-impl-drift + status-code-drift + class-level-roll-up
**Pillars affected**: [P-10 Ingestion, P-06 Configuration & Deployment]
**Batch**: ZF (2026-05-25)

**Surfaced by**:
- `odd-platform__java__IngestionController__controller-class__IngestionController.md:concepts.invariants.[Response-code-drift-across-the-3-mutating-service-path-handlers]` — "**Response-code drift across the 3 mutating service-path handlers**: `postDataEntityList` → 200 OK (line 44), `postDataSetStatsList` → 201 Created (line 86), `ingestMetrics` → 201 Created (line 94). Per existing batch-F postDataEntityList sidecar (concepts.invariants[2]), the OpenAPI spec declares 201 for postDataEntityList; the implementation returns 200. The drift is locked in by `BaseIngestionTest.java:79` asserting `expectStatus().isOk()` (200) for postDataEntityList vs `isCreated()` (201) for the other two (BaseIngestionTest.java:87, 95). Spec-vs-impl drift has shipped."
- `odd-platform__java__IngestionController__controller-class__IngestionController.md:downstream_side_effects.[Response-code-drift-across-the-3-mutating-handlers]` — "This is the canonical case-study of the `openapi-200-vs-201-status-code-drift` concept (cross-pillar from `concepts/detail/invariants/openapi-200-vs-201-status-code-drift.yaml`)."

**Description**: The IngestionController class-level enrichment surfaces the 5-endpoint status-code matrix:

| Endpoint | OpenAPI declares | Impl returns | Test asserts | Drift? |
|---|---|---|---|---|
| POST `/ingestion/datasources` | (varies by spec version) | 200 OK | (smoke) | unknown |
| POST `/ingestion/entities` | 201 | 200 OK | `isOk()` (200) | YES — spec wrong |
| POST `/ingestion/entities/datasets/stats` | 201 | 201 Created | `isCreated()` (201) | align |
| POST `/ingestion/metrics` | 201 | 201 Created | `isCreated()` (201) | align |
| GET `/ingestion/dataentitygroups/{deg_oddrn}/entities` | 200 | 200 OK | (smoke) | align |

The drift is on ONE endpoint (`postDataEntityList`) within the 5-endpoint controller. Two siblings ALIGN (postDataSetStatsList + ingestMetrics return 201 per spec); one drifts. The drift is locked in by `BaseIngestionTest.java:79` asserting `isOk()` (200) for postDataEntityList.

The class-level view makes the drift IMPOSSIBLE TO MISS: a maintainer reading IngestionController sees `ResponseEntity.ok().build()` (line 44) NEXT TO `HttpStatus.CREATED` (lines 86, 94) in the SAME FILE. The asymmetry is structurally visible.

**Operator-visible failure modes**:

Identical to REFACTOR-641 (Owner status-code drift) + REFACTOR-545 (the cluster anchor):

1. Spec-generated clients mis-handle (expecting 201, getting 200).
2. Live docs may display incorrect status code.
3. Future maintainers introducing new endpoints may copy the WRONG choice (200) from postDataEntityList expecting it to be the canonical pattern.

**Primary source citations**:
- `<odd-platform-api>/src/main/java/.../IngestionController.java:44` (postDataEntityList returns ok()).
- `<odd-platform-api>/src/main/java/.../IngestionController.java:86` (postDataSetStatsList returns CREATED).
- `<odd-platform-api>/src/main/java/.../IngestionController.java:94` (ingestMetrics returns CREATED).
- `<odd-platform-api>/src/test/java/.../BaseIngestionTest.java:79, 87, 95` (the tests that lock the drift).
- `<opendatadiscovery-specification>/openapi.yaml` (the spec that declares 201 for postDataEntityList).

**Existing-ADR-or-implied-prescription**: **REFACTOR-545** (status-code drift cluster — 9+ endpoint-level instances across 7+ controllers) is the cluster anchor. The maintenance principle: fix-spec-not-code; preserve the impl; add tests to lock in.

**Proposed remedy**: Same pattern as REFACTOR-545 / 641:

1. **Fix the OpenAPI spec** (upstream in `opendatadiscovery-specification`): change `postDataEntityList` response from 201 to 200. Bump the spec version.
2. **Update existing test** at BaseIngestionTest.java:79 — already asserts `isOk()`; no change needed.
3. **Add explicit "200 vs 201" regression test** for the three mutating endpoints to lock in the chosen postures.

**Severity rationale**: LOW — the drift is class-level visible but bounded to one of five endpoints; the existing test (`isOk()`) already locks in the choice; the fix is a spec-only update. Pairs with REFACTOR-545 (cluster anchor) — the IngestionController instance is the 12th in the cluster.

Lower severity than REFACTOR-641 (Owner) because the Ingestion drift is on ONE endpoint within a 5-endpoint controller (less "class-wide" than Owner's 2-of-3 mutating). The bigger value of this REFACTOR is the CLASS-LEVEL ENUMERATION of the matrix — future maintainers reading the controller see the three different response shapes structurally.

**Suggested backlog grouping**: `OpenAPI spec drift hardening sprint` — bundle with REFACTOR-545's existing instances + REFACTOR-641 + REFACTOR-639 + REFACTOR-642 PageInfo facet. One spec-update PR closes multiple drifts.

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-545 (cluster anchor — 12th instance); REFACTOR-641 (sibling — Owner mutating); REFACTOR-639 (sibling — DataCollab redirect 302-vs-301).
- SUPERSEDES: none.
- CONFLICTS: none.

---
