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

## Batch U append

#### Batch 2026-05-20-U STRENGTHENS — 5-angle OpenAPI authoring-quality cluster on the Business Glossary controller; status-code drift on TWO Term-CRUD operations adds simplest-instance evidence to the META

Batch U adds the Term layer's controller-class sidecar as a NEW primary source for the broader OpenAPI authoring-quality cluster DOC-GAP-099 META anchors. The 4-angle triangulation that DOC-GAP-099 already establishes (SPEC layer + SERVICE layer + REPOSITORY layer + CONTROLLER methods) is now COMPLEMENTED by a fifth angle — the SIMPLEST-INSTANCE class:

- **(NEW batch U) — SIMPLEST-INSTANCE class — status-code-drift on createTerm + updateTerm** — per `odd-platform__java__TermController__controller-class__TermController.md:bugs_limitations_corner_cases.[2]` + `invariants.[5]` + `docs_link_semantic.doc_drift_findings.[1]`: the controller returns HTTP 200 on both `createTerm` and `updateTerm`; the OpenAPI spec at `openapi.yaml:2760-2761, 2798-2799` declares HTTP 201 for both. The spec ALSO declares description "The resource has been successfully created" for the UPDATE endpoint — a copy/paste defect within the spec itself.

The 5-angle picture (cross-batch composition):
- **(i) Inverse-semantic class** (DOC-GAP-099 original) — `getMyObjectsWithUpstream` / `getMyObjectsWithDownstream` summary text is the INVERSE of the implementation; the spec describes returning owner-scoped lineage, the implementation returns NON-owned-but-reachable.
- **(ii) Operation-misnamed class** (DOC-GAP-098 sibling) — `createDataEntityTagsRelations` operationId is "create" but semantic is "replace-all-internal-tags"; the operationId actively misleads about CRUD semantic.
- **(iii) Coverage-gap class** (DOC-GAP-009 sibling) — the api-reference hub has no `data-quality` sub-page despite the OpenAPI spec defining 5+ data-quality operations; the developer-guide layer abdicates to Swagger UI.
- **(iv) Response-shape-contradiction class** (DOC-GAP-198 batch-T sibling) — `getSLA` returns `image/png` but the live doc page describes a JSON response; the OpenAPI spec aligns with the controller, the live operator-facing doc page describes the WRONG sibling endpoint's shape.
- **(v) NEW batch U: SIMPLEST-INSTANCE class — status-code-drift on createTerm + updateTerm** — the controller returns 200, the spec declares 201, the spec's own update description claims "created" for an UPDATE operation. The simplest instance of the pattern: spec authoring quality is non-uniform across the operations, the controller behaviour is non-uniform with the spec, the api-reference page is silent on which is canonical.

**NEW structural insight: the OpenAPI authoring-quality META is now ANCHORED across FIVE failure shapes (inverse-semantic / operationId-misnamed / coverage-gap / response-shape-contradiction / status-code-drift). The pattern is platform-wide: the OpenAPI spec was authored aspirationally + by-convention, the controllers were authored against business intent, and the gaps accumulated**. The MEDIA's previous emphasis on the inverse-semantic class is one of five sibling classes; the simplest-instance (status-code drift on Term CRUD) is the cheapest fix and the highest-leverage starting point for a platform-wide audit.

The doc-side action expands from "fix the spec on the inverse-semantic lineage endpoints" to:
- **Cluster-wide audit (NEW batch U)**: enumerate every `'201'` declaration in `openapi.yaml` and verify each against the controller's actual `ResponseEntity` return shape. Per the TermController sidecar's observation: "The platform-wide convention (Create returns 200 uniformly) is uniformly wrong in the spec" — this means a single PR can close the entire status-code-drift cluster.
- **Cluster-wide audit (NEW batch U sibling)**: enumerate every `operationId` in `openapi.yaml` and verify each against the controller's actual method body shape. DOC-GAP-098's `createDataEntityTagsRelations` is the canonical instance; other Create operations with replace-semantics may exist.
- **Cluster-wide audit (NEW batch U sibling)**: every operation `summary` text should be verified against the implementation's actual behaviour — DOC-GAP-099's inverse-semantic class is one instance; more may exist.
- **Cluster-wide audit (NEW batch U sibling)**: every `response[200].content` schema declaration should be verified against the controller's actual `ResponseEntity<T>` type parameter — DOC-GAP-198's `getSLA` JSON-vs-PNG drift is one instance; more may exist.

**The META's promotion candidate**: DOC-GAP-099 META should be re-anchored as a PLATFORM-WIDE OpenAPI authoring-quality META — not specifically about the lineage inverse-semantic but about the FIVE failure shapes that collectively reveal a CI gap (the platform's CI does not validate spec-vs-controller conformance). The proposed fix at the META level: add an OpenAPI contract conformance test suite to the build pipeline that exercises every operation in the spec against a running controller and asserts (a) the status code matches, (b) the response schema matches, (c) the summary's semantic claim is testable (where possible). This is the structural fix that closes the META's whole class.

**Live-page state cross-batch (this session — within LSN-018 stale-probe cadence)**:
- `https://docs.opendatadiscovery.org/developer-guides/api-reference` (batch-T inherited 2026-05-20 status 200) — does NOT establish a contract-conformance posture; operators can't tell whether spec or controller is authoritative when they diverge.
- `https://docs.opendatadiscovery.org/developer-guides/api-reference/glossary` (batch-U TermController + TermServiceImpl sidecars, 2026-05-20 status 200) — enumerates the Term endpoints but does NOT document response status codes; this finding adds the Term-CRUD status code as a documented gap.
- `https://docs.opendatadiscovery.org/features/data-lineage` (batch-M inherited 2026-05-20 status 200) — does NOT mention `/my/upstream` / `/my/downstream` endpoints, contributing to the api-reference incomplete-ness across the broader cluster.

The 5-angle status-code anchor + 5-failure-shape framing turns DOC-GAP-099 META from "fix two operation summaries" into "audit the platform's OpenAPI authoring conformance and add a CI gate for spec-vs-controller divergence." The 5-failure-shape cluster (now anchored by the Term-CRUD simplest-instance) is the broadest pattern in the catalog. The Term-layer additions ship as part of the Business Glossary doc-improvement sprint AND feed the platform-wide audit candidate.

**Doc-side action additions this batch (cross-link)**:
- **Doc-side cross-link** — `developer-guides/api-reference.md` hub: add a "Contract conformance" note (per DOC-GAP-209 NEW batch U sibling action item) — "The OpenAPI specification is the canonical wire contract; mismatches between the documented status code / response shape and the runtime should be filed at the [specification repository](https://github.com/opendatadiscovery/opendatadiscovery-specification)." This is the operator-protection that establishes WHERE the authoritative source lives.
- **CI-side action (NEW META promotion candidate)** — add an OpenAPI contract conformance test suite to `odd-platform-api` that exercises every operation against a running test container and asserts spec-vs-runtime alignment on the five failure shapes. Bounded scope; high coverage value.
- **DOC-side cross-link** — `developer-guides/api-reference/glossary.md` (per DOC-GAP-209 NEW batch U sibling): surface the actual response status codes ("Returns HTTP 200 with the created Term object on success") for the Term CRUD endpoints. Symmetric coverage for the sibling api-reference subpages.

The META is now anchored across 5 failure shapes + ~10 specific instances (DOC-GAP-009 / 068 / 098 / 099 / 167 / 198 / 209 + this expansion). The OpenAPI authoring-quality story is the largest authoring-defect family in the catalog. Severity stays HIGH on the META framing because the failures' downstream consequences range from silent typed-client failure (DOC-GAP-209) to security-impact inverse-semantic (DOC-GAP-099 lineage) to operator-trap response-shape (DOC-GAP-198 SLA-PNG); the single CI gate plus the per-instance fixes close the whole class.

## Batch Z append

## Batch Z append

#### Batch 2026-05-20-Z STRENGTHENS — openapi-spec PRIMARY SOURCE confirms WHICH SIDE IS RIGHT + DOC-GAP-099 META cluster now anchors 6 failure shapes

Batch Z's `odd-platform__openapi__spec__odd-platform-public-api.md` sidecar provides the FIFTH layer of triangulation for DOC-GAP-099. The 4-layer triangulation established in batch M (spec layer + service layer + repository SQL + controller methods) is now extended with the OpenAPI spec as a separately-enriched primary source axis. Critically, the spec-side sidecar names the inverse-semantic finding VERBATIM under its own bugs_limitations_corner_cases AND attributes the SEVERITY at HIGH (a security-relevant load-bearing source of the misframe) AND names it as a member of the broader OpenAPI authoring-quality META cluster.

**The 5-layer triangulation** (each layer independently primary-source confirmed):
- **(i) Spec layer** (DOC-GAP-099 original + NEW batch-Z openapi-spec sidecar): `openapi.yaml:842-844` summary text "Returns list of data entities owned by current user with upstream dependencies" + `openapi.yaml:861-862` Downstream sibling — confirmed at primary source.
- **(ii) Service layer** (batch I via DOC-GAP-115): `DataEntityRelationsServiceImpl.java:25-31` anchor + expand + exclude pipeline.
- **(iii) Repository layer** (batch H via DOC-GAP-105): `ReactiveLineageRepositoryImpl.java:122-176` recursive-CTE with no owner JOIN.
- **(iv) Controller methods** (batch M): both `getMyObjectsWithUpstream.md` and `getMyObjectsWithDownstream.md` controller-method sidecars + the UI consumer `OwnerEntitiesList.tsx:87` rendering "Upstream dependents" (UI is correct, spec is wrong).
- **(v) OpenAPI spec axis (NEW batch Z)**: the openapi-spec sidecar names the inverse-semantic finding under its OWN bugs_limitations_corner_cases at SEVERITY HIGH, anchoring to `openapi.yaml:841-878` and cross-linking to the existing 4 layers. The spec sidecar is the FIRST sidecar that frames the finding as a SECURITY-RELEVANT load-bearing source in third-party API-consumer integrations.

**The directional confirmation (per sidecar `security.known_security_gaps.[2]`)** — the spec sidecar explicitly names WHICH SIDE IS RIGHT (the spec is wrong; the implementation + UI + service + repository are right):
> "**Inverse-semantic on `getMyObjects*` family** — the spec summary states 'owned by current user with [upstream|downstream] dependencies' but the implementation returns non-owned reachable entities. SDK clients consuming the spec for multi-tenant deployments would assume tenant isolation that does not exist."

The spec sidecar's framing — "SDK clients consuming the spec for multi-tenant deployments would assume tenant isolation that does not exist" — names the OPERATIONAL CONSEQUENCE in the third-party-SDK-consumer dimension. The directional fix is unambiguous: **rewrite the OpenAPI summary**. The implementation is the canonical behaviour; the spec summary is the misframe.

**The DOC-GAP-099 META cluster promotion to 6 failure shapes (per DOC-GAP-242 NEW)**:
- Inverse-semantic (DOC-GAP-099 — THIS finding)
- OperationId-misnamed (DOC-GAP-098)
- Coverage-gap (DOC-GAP-009 + DOC-GAP-244 NEW)
- Response-shape-contradiction (DOC-GAP-198)
- Status-code-drift (DOC-GAP-074 + DOC-GAP-074 batch-Z strengthen to 9+ endpoints)
- **No-security-model (DOC-GAP-242 NEW batch Z)**

The OpenAPI authoring-quality cluster is now the LARGEST authoring-defect family in the catalog (6 failure shapes × multiple instances each). The proposed fix at the META level (per DOC-GAP-099's batch-U promotion candidate framing) — add an OpenAPI contract conformance test suite to the build pipeline — closes the META's whole class.

**Doc-side action expansion** (in addition to the original "rewrite the OpenAPI summary on both operations"):
- Add a "Contract conformance" note to `developer-guides/api-reference.md` hub (per DOC-GAP-244 NEW) that names the OpenAPI as authoritative wire contract AND directs SDK consumers to file spec defects upstream.
- The CI contract conformance gate (per DOC-GAP-074's batch-Z directional-fix framing) is the structural fix for the META's whole class — same gate prevents both status-code drift AND summary inversion AND coverage gaps from re-accumulating.

**The spec-side sidecar's primary-source observation** (per its `docs_link_semantic.doc_drift_findings[1]`) — verbatim:
> "DOC-GAP-099 inverse-semantic class — `getMyObjectsWithUpstream`/`Downstream` summary text at `openapi.yaml:842-844` + `860-862` is the INVERSE of the implementation (4-angle triangulation confirms — spec layer + service layer + repository SQL + controller-method sidecars all show non-owned entities are returned, not 'owned with dependencies'). The spec summary is the load-bearing single source of the misframe"

The spec-side sidecar adds the FIFTH angle (the spec is independently primary-source confirmed by a sidecar dedicated to the spec axis) and explicitly identifies "the spec summary is the load-bearing single source of the misframe" — the directional fix is at the spec layer, not the implementation.

**Severity stays HIGH** — security-relevance in multi-tenant deployments + the broader META cluster framing intensifies the operational impact. The 5-layer triangulation + the explicit META cluster membership means this is the most thoroughly-anchored finding in the catalog. Coherence: strengthens DOC-GAP-099 with the openapi-spec axis primary source + the META cluster's 6-failure-shape framing (per DOC-GAP-242 + DOC-GAP-244 batch-Z extensions). No conflicts with existing batch-F/H/I/M/U framing.

## Batch ZA append

#### Batch 2026-05-20-ZA STRENGTHENS — UI-tier consumer-side closure for the OpenAPI authoring-quality cluster

- Batch ZA adds a UI-tier closure to the OpenAPI authoring-quality cluster — specifically, the SUMMARY-vs-IMPLEMENTATION inversion at `getMyObjectsWithUpstream` / `getMyObjectsWithDownstream`:
  - **`Overview.tsx`** (`odd-platform__ts__react-component__component__Overview.md`) — per sidecar's couples_to.OwnerAssociation + the home-page composition — mounts `<OwnerAssociation>` which mounts `<OwnerEntitiesList>` which mounts the FOUR thunks (`fetchMyDataEntitiesList`, `fetchMyUpstreamDataEntitiesList`, `fetchMyDownstreamDataEntitiesList`, `fetchPopularDataEntitiesList`); the Upstream / Downstream variants consume the `getMyObjectsWithUpstream` / `getMyObjectsWithDownstream` REST endpoints whose OpenAPI summary text is the INVERSE of the implementation (per DOC-GAP-099 original framing — the summary says "owned by current user with [upstream|downstream] dependencies" but the actual response is entities REACHABLE in one lineage hop from owned entities, EXCLUDING the owned set). The home-page UI label is `"Upstream dependents"` / `"Downstream dependents"` (per `OwnerEntitiesList.tsx:87`) — semantically ACCURATE; the OpenAPI summary is inverted.
- The 4-angle picture is REINFORCED at the UI tier: the SPEC layer says "owned by current user with X dependencies"; the SERVICE layer (DataEntityRelationsServiceImpl.java:25-39) explicitly excludes the owned set; the REPOSITORY layer (ReactiveLineageRepositoryImpl.java:122-176) has no owner JOIN; the CONTROLLER methods are pass-through to the service; AND the UI layer's column LABEL ("Upstream dependents" / "Downstream dependents") matches the SERVICE / REPOSITORY semantic, NOT the SPEC. **5 layers in total**, with the SPEC layer the SOLE outlier — the load-bearing change is the OpenAPI summary correction.
- **NEW STRUCTURAL DIMENSION (5-layer triangulation)**: the home-page UI is the OPERATOR-FACING manifestation of the inversion's correct semantic. An operator inspecting the home page reads "Upstream dependents" + "Downstream dependents" and forms the correct mental model (these are entities the user is connected to via upstream/downstream edges, not entities the user OWNS). The mental-model mismatch surfaces ONLY when the operator reads the OpenAPI summary — which is the integrator's primary discovery surface (per DOC-GAP-242 + DOC-GAP-244 the OpenAPI spec is the contract surface for third-party SDK generators). Integrators reading the spec construct an INCORRECT mental model that the platform's own UI does not surface.
- The UI-tier inversion-confirmation is the FINAL TRIANGULATION VERTEX: every layer below the spec — including the operator-facing UI label — agrees with the implementation semantic; ONLY the OpenAPI summary text disagrees. The doc-side fix (rewriting the OpenAPI summary) closes the entire cluster.
- **NEW STRUCTURAL DIMENSION (the cross-owner enumeration compound)**: the Overview.tsx sidecar's security.data_exposure[1] surfaces that the Upstream / Downstream columns render entities REACHABLE from the user's owned set — including entities OUTSIDE the user's Owner namespace (per the anchor-set defence-in-depth pattern from batch-G + batch-H). The home page therefore mixes THREE scopes under the "Recommended" h1: My Objects (per-user), Upstream/Downstream (per-user-anchor with cross-owner expansion), Popular (catalog-wide). The doc-side framing implies one uniform scope; the reality is 3 scopes across 4 columns. Per DOC-GAP-250's framing, the 4-column composition compounds the OpenAPI summary inversion: even after the summary is corrected, the per-column scope semantics need to be named at the doc-side surface.
- **STRENGTHENS DOC-GAP-099 cross-references**:
  - The OpenAPI summary inversion is now 5-layer triangulated (was 4-layer at batch M); the additional layer is the UI's column label.
  - The fix point is unchanged — rewrite the OpenAPI summary on both methods to match the actual semantic.
  - The fix's blast radius now extends to OPERATOR DOCS as well: the catalog-overview page's Recommended panel section (per DOC-GAP-253 Axis 4) should name the per-column scope semantics + cross-link to the corrected OpenAPI summary.
- Severity stays HIGH — the OpenAPI summary inversion is the SECURITY-IMPACT gap (operators believing they're returning owner-scoped results per the summary might publish endpoints in multi-tenant deployments expecting tenant isolation; instead returning cross-tenant lineage neighbours). The 5-layer triangulation is the CONFIDENCE-PRODUCING evidence — every layer except the spec agrees.
