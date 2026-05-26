---
doc_gap_id: DOC-GAP-296
severity: MEDIUM
category: coverage-gap
batch: ZG
generated_at: "2026-05-25T00:00:00Z"
generated_at_commit: 4ec2b20
prompt_version: "doc-gap-finder/0.1.0"
maintainer_curated: false
related_pillar_features:
  - "P-01:F-008"   # Schema versioning / diff
  - "P-02"         # Data Modelling — relationships are P-02
related_features: []
related_doc_gaps:
  - DOC-GAP-009    # developer-guides/api-reference hub coverage gaps — sibling structural finding
  - DOC-GAP-244    # api-reference Tag sub-page coverage gap — sibling structural finding
  - DOC-GAP-198    # api-reference data-quality sub-page coverage gap — sibling structural finding
  - DOC-GAP-295    # sibling — same controller's cross-dataset leak
related_retrospectives: []
---

## DOC-GAP-296 — `DatasetController`'s FOUR endpoints are missing from `developer-guides/api-reference/relationships` AND every other api-reference sub-page; SECONDARILY the diff endpoint exhibits a 500-vs-404 status-code asymmetry on missing version_ids (`BadUserRequestException` 400 for IDENTICAL ids vs bare `RuntimeException("Query returned %s rows for diff request")` 500 for NON-EXISTENT ids — same path, different error class, surfacing 400 + 500 instead of 400 + 404 for the natural error pair); the live `developer-guides/api-reference/relationships` page (WebFetched 2026-05-25 status 200) enumerates the THREE `RelationshipController` endpoints (`GET /api/relationships`, `GET /api/relationships/erd/{relationship_id}`, `GET /api/relationships/graph/{relationship_id}`) but does NOT list the `DatasetController.getDataSetRelationships` endpoint at `GET /api/datasets/{data_entity_id}/relationships` — operators reading the api-reference cannot discover the per-dataset relationships read path; the structure / diff endpoints have NO api-reference home at all

**Severity**: MEDIUM
**Category**: coverage-gap (api-reference structural absence + an asymmetric error-class contract; the doc-coverage gap is structural, the status-code drift is internal-API quality)

### Surfaced by

- `odd-platform__java__DataSetController__controller-class__DataSetController.md:docs_link_semantic.doc_drift_findings.[2]` — verbatim: *"API-reference page covers /api/relationships/* (the global RelationshipController) but NOT /api/datasets/{id}/relationships (this controller); 4 endpoints on DatasetController are missing from developer-facing API reference."*
- `odd-platform__java__DataSetController__controller-class__DataSetController.md:bugs_limitations_corner_cases.[2]` (MEDIUM per sidecar) — verbatim: *"Diff endpoint returns HTTP 500 for non-existent version_ids (size != 2 path): `buildDataSetVersionDiffList` throws bare `RuntimeException('Query returned %s rows for diff request')` (DatasetVersionServiceImpl.java:69-71) when one or both ids are missing. ControllerAdvice maps this to 500. Callers cannot distinguish 'wrong id' from 'platform broken' from the status code alone. Identical-version_ids gets a clean 400 via `BadUserRequestException` (line 60); non-existent gets a 500. Asymmetric."*
- `odd-platform__java__DataSetController__controller-class__DataSetController.md:stress_findings.request_inputs[firstVersionId / secondVersionId]` — verbatim: *"For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong? Cross-dataset diff returns 200 with a diff body where the per-field statuses are computed across two unrelated datasets' fields. (c) GET /api/datasets/X/structure/diff?first=V1&second=NON_EXISTENT: response 500 with 'Query returned N rows for diff request' (DatasetVersionServiceImpl.java:69-71) — not the expected 404."*
- `odd-platform__java__DataSetController__controller-class__DataSetController.md:tests_coverage_semantic.uncovered_behaviours[Diff endpoint returns HTTP 500 instead of 404]` (MEDIUM per sidecar) — verbatim: *"See P-149; status-code drift, small UX defect."*
- `odd-platform__java__DataSetController__controller-class__DataSetController.md:docs_link_semantic.inferred_docs.[2]` — verbatim: *"API-reference page covering RelationshipController's three endpoints; does NOT cover this controller's per-dataset relationships endpoint."* WebFetch 2026-05-25 status 200.

### Evidence

- `odd-platform/odd-platform-api/src/main/java/.../service/DatasetVersionServiceImpl.java:56-71` — the diff service method: identical-ids path throws `BadUserRequestException("Couldn't show diff for identical versions")` (line 60) — maps to HTTP 400 via `ControllerAdvice`. Missing-ids path throws bare `RuntimeException("Query returned %s rows for diff request")` (lines 69-71) — maps to HTTP 500.
- `odd-platform/odd-platform-api/src/main/java/.../exception/ControllerAdvice.java:24-28` (per sidecar reference) — `BadUserRequestException` → HTTP 400.
- `odd-platform/odd-platform-api/src/main/java/.../exception/ControllerAdvice.java:55-59` (per sidecar reference) — bare `RuntimeException` → HTTP 500 with the verbatim formatted message.
- WebFetch `https://docs.opendatadiscovery.org/developer-guides/api-reference/relationships` 2026-05-25 status **200** (per sidecar fetched_excerpts) — verbatim: *"List Relationships: GET /api/relationships?page=N&size=M&type=ERD|GRAPH|ALL&query=... / Get ERD Relationship: GET /api/relationships/erd/{relationship_id} / Get Graph Relationship: GET /api/relationships/graph/{relationship_id}"* — the page DOES NOT list the `DatasetController.getDataSetRelationships` endpoint at `GET /api/datasets/{data_entity_id}/relationships`.
- `odd-platform/odd-platform-api/src/main/java/.../controller/DataSetController.java:22-59` — the four endpoints' source:
  - `GET /api/datasets/{data_entity_id}/structure/{version_id}` (`getDataSetStructureByVersionId`, lines 22-31)
  - `GET /api/datasets/{data_entity_id}/structure` (`getDataSetStructureLatest`, lines 34-41)
  - `GET /api/datasets/{data_entity_id}/structure/diff` (`getDataSetStructureDiff`, lines 43-50)
  - `GET /api/datasets/{data_entity_id}/relationships` (`getDataSetRelationships`, lines 52-59)
- `odd-platform/odd-platform-specification/openapi.yaml:1793-1878` — the OpenAPI spec for all four operations under the `dataSet` tag; the spec is the only documentation surface that currently lists them.
- WebFetch `https://docs.opendatadiscovery.org/developer-guides/api-reference` 2026-05-25 (the api-reference hub) — no sub-page for `datasets` exists; the hub enumerates ~9 feature sub-pages (per DOC-GAP-009 framing); the per-dataset structure / diff / relationships read surface has no home.
- **The exploit-by-confusion narrative for the 500 drift**: a third-party API consumer scripting a diff workflow handles 400 (bad request — user-facing message) and 404 (not found — retry with corrected id) cleanly; a 500 is normally interpreted as "platform broken — retry later". The diff endpoint's 500-for-missing-id therefore produces noise in alerting systems (false-positive platform-health alerts) and confuses operators ("the platform is failing on diff calls" → investigate uptime → find that the version_id was wrong). The clean fix is one error-class change: `throw new NotFoundException("DatasetVersion", String.join(",", datasetVersionIds))` at `DatasetVersionServiceImpl.java:70` → maps to HTTP 404 via the existing `ControllerAdvice`.

### Drift narrative

The api-reference hub structure (per DOC-GAP-009 + DOC-GAP-244 + DOC-GAP-198) is the canonical operator-facing surface for the REST API contract. The hub has a `relationships` sub-page covering the `RelationshipController` endpoints (HTTP 200, verified this session) — but `DatasetController.getDataSetRelationships` shares the same conceptual surface (relationships of a dataset) AND lives in the same operator workflow (dataset-details page → Relationships tab). The natural surface for it is either (a) a new `datasets` api-reference sub-page covering all four DatasetController endpoints, or (b) an extension of the `relationships` page with a "Per-dataset relationships" section pointing to `/api/datasets/{id}/relationships`.

The four endpoints' coverage gap is amplified by the absence of a `datasets` api-reference sub-page entirely: the structure endpoint (latest / by-version-id) and the diff endpoint have no api-reference home anywhere. A third-party integrator wiring a schema-evolution check must read the OpenAPI spec directly (the api-reference page that should describe `dataSet`-tag operations is missing).

The 500-vs-404 drift on the diff endpoint is the secondary finding: a status-code-class drift where missing version_ids surface as HTTP 500 (platform-error class) instead of HTTP 404 (not-found class). The error-class mismatch is one of the silent operator-trap patterns: callers infer platform health from 5xx vs 4xx, the platform reports 500 for a user-side data error, the caller's alerting fires on platform health → wasted investigation.

The two findings are co-located on the same controller; the same authoring pass closes both.

### Proposed doc action

**Three-part action — author the missing api-reference page + extend the existing relationships page + log the code-side 500→404 fix**.

1. **Doc-side PRIMARY (NEW page)** — author `documentation/docs/developer-guides/api-reference/datasets.md`:
   - Enumerate the four `DatasetController` endpoints with operationIds + URL templates + response shapes.
   - For each, name the gating permission (or the lack of one — per DOC-GAP-295 + the cross-owner read posture cluster).
   - Pre-emptively narrate the `dataEntityId`-is-decorative caveat per DOC-GAP-295 (alongside the proposed code-side fix).
   - Cross-link to the `/features/data-discovery/schema-diff` feature page.

2. **Doc-side COMPANION — extend `documentation/docs/developer-guides/api-reference/relationships.md`** with a "Per-dataset relationships" section:
   - Name the `GET /api/datasets/{data_entity_id}/relationships` endpoint.
   - Cross-link to the proposed `datasets` api-reference page (above) for completeness.
   - Cross-reference the catalog-global cross-owner posture (DOC-GAP-287 — relationships endpoints do not apply owner-scoping).

3. **Code-side `/log-issue odd-platform`** — author a backlog item for the 500→404 fix:
   - At `DatasetVersionServiceImpl.java:69-71`, replace `throw new RuntimeException("Query returned %s rows for diff request".formatted(versions.size()))` with `throw new NotFoundException("DatasetVersion", datasetVersionIds.stream().map(String::valueOf).collect(Collectors.joining(",")))`.
   - The `ControllerAdvice` already maps `NotFoundException` to HTTP 404 (per `DatasetController` sibling endpoints).
   - Add a regression-pin integration test: `getDataSetStructureDiff` with a non-existent `firstVersionId` returns HTTP 404.

### Cross-references

- **DOC-GAP-009 / DOC-GAP-244 / DOC-GAP-198** (api-reference hub coverage gaps) — sibling structural findings; the same hub-restructure pass closes all four
- **DOC-GAP-295** (DataSetController cross-dataset leak — same controller's HIGH-severity sibling) — the same controller authoring pass closes both
- **DOC-GAP-287** (Relationships cross-owner posture cluster) — the relationships endpoint is a NEW invocation site of the cross-owner read posture cluster
- **probe P-149** — dynamic verification of the 400/404/500 status-code matrix
- **Rule 6 coherence** — cross-registry sweep ran: `feature-flows/index.yaml` for F-NNN entries on schema-diff / relationships read surface — no contradictions; `concepts/index.yaml` enumerates `DataSetStructure`, `DataSetVersionDiffList`, `DataEntityRelationshipDetailsList` consistent with the four-endpoint coverage. No CONTRADICTS, no SUPERSEDES.

### Severity rationale

MEDIUM. The api-reference coverage gap is a structural absence on a load-bearing operator-facing surface — operators integrating against the platform via REST cannot discover the four endpoints from the docs; they must read the OpenAPI spec. Operator-impact is friction (custom integration must reverse-engineer), not data-loss / security-exposure. The 500-vs-404 status-code drift is a small UX defect on the diff endpoint — confusing but recoverable. The combined fix is bounded (one new doc page + one section extension + one error-class change + one regression test). Severity is MEDIUM not LOW because the api-reference hub gap is a recurring class (DOC-GAP-009 / DOC-GAP-244 / DOC-GAP-198) that the maintainer is actively addressing, and this finding adds one more sub-page to the queue.

### Last verified

- 2026-05-25 — sidecar's static evidence (the source code line citations + the WebFetched api-reference/relationships page content) re-confirmed at substrate commit `4ec2b20`. WebFetch `developer-guides/api-reference/relationships` 200 (per sidecar fetch this session) confirms the absence of the `DataSetController.getDataSetRelationships` entry.
