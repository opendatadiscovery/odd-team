- **DOC-GAP-099**: `getMyObjectsWithUpstream` / `getMyObjectsWithDownstream` OpenAPI summary literally describes the wrong semantic — claims response is owned-with-lineage; actual response is NON-owned entities reachable from owned set
  - **Category**: drift (OpenAPI contract drift; spec summary is the inverse of implementation)
  - **Surfaced by**: `getMyObjects.md:docs_link_semantic.doc_drift_findings[2]` + `getMyObjects.md:implicit_adrs[3]` + `getMyObjects.md:bugs_limitations_corner_cases[5]`
  - **Evidence**:
    - `openapi.yaml:842-844` — summary for `getMyObjectsWithUpstream`: "Returns list of data entities owned by current user with upstream dependencies"
    - `openapi.yaml:860-862` — parallel for `getMyObjectsWithDownstream`.
    - `DataEntityRelationsServiceImpl.java:25-31` — actual flow: (a) fetch user's owned entities (anchor), (b) traverse lineage one hop, (c) filter to entities NOT in owned set (`Predicate.not(oddrns::contains)` line 37) — response is entities the user does NOT own but ARE reachable from entities they DO own.
    - Lineage variants use different code path than `getMyObjects`: NO direct SQL owner-filter at response layer; owner-scoping implicit via anchor-set correctness.
  - **Proposed doc action**: (a) Rewrite OpenAPI summary on both methods to: "Returns data entities reachable in one lineage hop from entities owned by the current user (excludes owned entities themselves)"; (b) document the security-relevant consequence: response is data-ecosystem context, NOT owned set; (c) add developer-guide note that owner-scoping for these two methods is anchor-set correctness (not a downstream SQL filter).
  - **Severity rationale**: HIGH — security-impact gap. Operator believing they're returning owner-scoped results (per OpenAPI summary) might publish endpoints in multi-tenant deployment expecting tenant isolation; instead returning cross-tenant lineage neighbours. The summary is the INVERSE of behaviour.

#### Batch 2026-05-19-H STRENGTHENS

- Sidecar `odd-platform__java__repository_reactive__repository__ReactiveLineageRepositoryImpl.md` adds the SQL primary-source confirmation that `DataEntityRelationsServiceImpl.getDependentOddrns` (the call site backing `getMyObjectsWithUpstream` / `getMyObjectsWithDownstream`) invokes the recursive CTE with `LineageDepth.empty()` (depth=-1 → seed-only) AND owner-scoping at the ANCHOR SET only, NOT at the JOIN.
- Specifically: `ReactiveLineageRepositoryImpl.java:122-176` (the CTE body) has NO owner JOIN, NO owner predicate; the only filters are `is_deleted = false` and the depth bound. The owner-scoping at `DataEntityRelationsServiceImpl.java:25-39` (the `authIdentityProvider.fetchAssociatedOwner()` → seed-oddrns pattern) is the **batch-G "anchor-set defence-in-depth" pattern**: the seed set is owner-scoped, the CTE expansion is owner-blind, the response filter at line 37 (`Predicate.not(oddrns::contains)`) yields entities NOT in the owner's set but reachable from it.
- The compound finding: with `LineageDepth.empty()` (depth=-1; `LineageDepth.java:16-18`), the CTE recursion terminates after the seed step — the response is the depth-1 edges around the owner's anchor set. This means **the platform's primary "show me my data ecosystem context" feature returns cross-owner immediate-neighbour data with no upstream/downstream owner check** — confirmed at the SQL primary source.
- The OpenAPI inversion is now triangulated 3-angle: (i) summary text inversion (original surface, batch F), (ii) service-layer flow (`DataEntityRelationsServiceImpl`), (iii) repository-layer SQL (no owner JOIN, no owner predicate). All three agree the response semantic is the inverse of the spec claim; the multi-tenant deployment-risk severity remains HIGH.
- Cross-link **DOC-GAP-105** (the new compound finding on the lineage recursive-CTE primary source).

#### Batch 2026-05-19-M STRENGTHENS — 4-angle controller-method primary source on BOTH halves

Batch M adds TWO controller-method-tier primary sources for DOC-GAP-099: `getMyObjectsWithUpstream.md` AND `getMyObjectsWithDownstream.md` — each independently confirms the inverse-semantic claim at the CONTROLLER METHOD layer. The triangulation now spans **FOUR independent layers**:

- **(i) OpenAPI spec** — `openapi.yaml:843-844` (UPSTREAM) + `openapi.yaml:861-862` (DOWNSTREAM): the summary text is the contract layer; both summaries claim "owned by current user with [upstream|downstream] dependencies".
- **(ii) Service-layer flow** — `DataEntityRelationsServiceImpl.java:25-39` (already triangulated at batch I via DOC-GAP-115): the anchor + expand + exclude pipeline at the service layer.
- **(iii) Repository-layer SQL** — `ReactiveLineageRepositoryImpl.java:122-176` (already triangulated at batch H via DOC-GAP-105): no owner JOIN at SQL.
- **(iv) Controller-method primary sources (NEW batch M)** — `getMyObjectsWithUpstream.md:bugs_limitations_corner_cases[1]` + `getMyObjectsWithDownstream.md:bugs_limitations_corner_cases[1]` + corresponding `implicit_adrs` blocks. Both sidecars verbatim quote the spec-vs-implementation inversion; both attribute it to the `Predicate.not(oddrns::contains)` filter at `DataEntityRelationsServiceImpl.java:37`; both surface the UI consumer label (`OwnerEntitiesList.tsx:87` "Upstream dependents" / "Downstream dependents") as semantically accurate while the OpenAPI summary is inverted.

The 4-angle picture: the SPEC layer says "owned by current user with X dependencies"; the SERVICE layer explicitly excludes the owned set; the REPOSITORY layer has no owner JOIN; the CONTROLLER methods are pass-through to the service. EVERY LAYER below the spec contradicts the spec. The single load-bearing change is the OpenAPI summary correction.

**UI confirmation** (per `getMyObjectsWithUpstream.md:concepts.audiences[0]`): `OwnerEntitiesList.tsx:85-91` renders the panel as "Upstream dependents" (NOT "My Upstream"); the UI is semantically aligned with the IMPLEMENTATION, NOT with the OpenAPI summary. Third-party API consumers reading the spec are the affected audience — the UI is correct.

**Live-page state (current-session re-verified)**:
- `https://docs.opendatadiscovery.org/features/data-lineage` 200 — does NOT mention `/my/upstream` / `/my/downstream` endpoints or owner-aware lineage view. Sub-finding feeds DOC-GAP-167 META.
- `https://docs.opendatadiscovery.org/developer-guides/api-reference/lineage` 200 — does NOT enumerate `/my/upstream` / `/my/downstream`. Sub-finding feeds DOC-GAP-167 META.
- `https://docs.opendatadiscovery.org/developer-guides/api-reference/data-entity` 404 — Data Entity sub-page of the API Reference is MISSING (cross-link DOC-GAP-009).

The doc-side action (rewrite the OpenAPI summary on BOTH operations) now has 4-angle primary-source evidence; the severity remains HIGH. Cross-link **DOC-GAP-167 META** (the pillar-level overpromise on P-05 Data Lineage that this 4-angle triangulation feeds).
