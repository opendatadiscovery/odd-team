- **DOC-GAP-074**: OpenAPI declares 201 Created for `POST /api/owners` (and sibling create endpoints) but `OwnerController.java:26` returns 200 OK via `ResponseEntity::ok` — third concrete instance of a class-wide 201-vs-200 OpenAPI/implementation drift on RBAC create operations
  - **Category**: drift
  - **Surfaced by**:
    - `odd-platform__java__OwnerController__controller-method__createOwner.md:docs_link_semantic.doc_drift_findings.[0]` + `:bugs_limitations_corner_cases.[0]` (severity MEDIUM) **(NEW batch E)**
    - `odd-platform__java__RoleController__controller-method__createRole.md:tests_coverage_semantic.uncovered_behaviours.[0]` (sibling drift — RoleController also declares 201 in `openapi.yaml:3629` but returns 200) **(NEW batch E)**
    - `concepts.yaml:entities[Owner (Authorization directory entry)].cross_file_inconsistencies.[0]`
  - **Evidence**:
    - `openapi.yaml` `/api/owners` POST declares `responses.201` (Created); generated `OwnerApi.java:57` carries `@ApiResponse(responseCode = '201')`.
    - `OwnerController.java:26` — `.map(ResponseEntity::ok)` returns HTTP 200 OK.
    - createOwner.md notes: "Sibling create operations have the same pattern (e.g. `updateOwner` declares 201 in OpenAPI for an update — itself unusual — and the controller returns 200)." RoleController.createRole exhibits the same drift (openapi.yaml:3629 declares 201; `RoleController.java:24` returns 200).
    - Class-wide pattern verified across at least 3 RBAC create operations (Owner + Role + Policy — Policy's spec assertion not separately verified in this pass but the controller pattern at PolicyController.java:25 follows the same `.map(ResponseEntity::ok)` shape).
  - **Proposed doc action**: Single upstream fix — file `/log-issue odd-platform` (or extend an existing OpenAPI-vs-impl drift issue) to either (a) update controller returns to `ResponseEntity.status(HttpStatus.CREATED).body(...)` to match the spec, OR (b) update the OpenAPI spec `responses.201` → `responses.200` to match the implementation. Recommended (a) — `POST` returning 201 Created is the REST convention and the OpenAPI page is the authoritative consumer contract. The fix is class-wide: audit every `*Controller.create*` method against its `openapi.yaml` `responses.201` declaration. Doc-side: no immediate page-level action; the spec/codegen mismatch is operationally visible to OpenAPI consumers (the OpenAPI Swagger UI page declares 201 verbatim).
  - **Cross-references**:
    - DOC-GAP-018 (API spec carries no security block — same class of spec-vs-runtime drift)
    - createRole.md:tests_coverage_semantic.uncovered_behaviours.[0] (sibling drift on Role)
    - Drives `/log-issue odd-platform` upstream for the spec-vs-impl alignment audit
  - **Severity rationale**: MEDIUM — operationally visible to OpenAPI clients (codegen produces a method signature expecting 201; runtime receives 200). Contract clients that test for `2xx` succeed; clients that strictly check `status == 201` fail. The class-wide pattern (3+ instances) makes this worth a single audit pass rather than per-endpoint fixes.

#### Batch 2026-05-20-P STRENGTHENS — 5-instance class-wide pattern now spans BOTH create and update operations

- Sidecar `odd-platform__java__OwnerController__controller-method__updateOwner.md:bugs_limitations_corner_cases.[0]` (MEDIUM per sidecar — "OpenAPI declared 201 Created for an UPDATE vs implementation-returned 200 OK") **(NEW batch P — controller-method primary source on the PUT-UPDATE side)**.
- Verbatim shape at `openapi.yaml:195-201`: the `updateOwner` operation declares `responses.'201': 'The resource has been successfully updated'` for the PUT operation. The 201 is DOUBLY anomalous: (a) PUT-update canonically declares 200, not 201 — 201 is the POST-creation status code; (b) the implementation at `OwnerController.java:53` (`.map(ResponseEntity::ok)`) returns 200, disagreeing with the spec.
- The class-wide pattern now spans 5 distinct OpenAPI operations:
  - `POST /api/owners` createOwner — spec declares 201, impl returns 200 (DOC-GAP-074 originally)
  - `POST /api/policies` createPolicy — same pattern (DOC-GAP-074 cross-link)
  - `POST /api/roles` createRole — same pattern (DOC-GAP-074 cross-link)
  - `POST /ingestion/entities` postDataEntityList — spec declares 201, impl returns 200 (DOC-GAP-093 batch F)
  - `PUT /api/owners/{owner_id}` updateOwner — spec declares 201 (anomalous on PUT), impl returns 200 (canonical for PUT) (THIS finding's batch-P extension)
- **The PUT-update instance is structurally distinct from the POST-create instances**: in the POST-create cases, the spec declares the canonical 201 and the impl drifts to 200 (impl wrong, spec right); in the PUT-update case, the spec declares an anomalous 201 (spec wrong; PUT-update should declare 200) and the impl returns the canonical 200 (impl right, spec wrong). The upstream fix must distinguish the two directions.
- **Updated upstream fix recommendation** (extends DOC-GAP-074's original recommendation): the upstream audit should run a class-wide spec-vs-impl reconciliation:
  - For POST-create operations: change impl from `ResponseEntity::ok` to `ResponseEntity.status(HttpStatus.CREATED).body(...)` to MATCH the canonical spec (201).
  - For PUT-update operations: change spec from `responses.201` to `responses.200` to MATCH the canonical impl (200).
  - This converges on REST conventions on both sides and closes the class-wide drift.
- Tracked as **DOC-GAP-184** for back-link convenience; the PUT-update side's batch-P confirmation is recorded under DOC-GAP-184 as a standalone finding for traceability. DOC-GAP-074 remains the canonical class-level finding; DOC-GAP-184 is the 5th instance.
- Doc-side action unchanged: no central-docs-site page-level surface; the spec/codegen surface is the only consumer-visible drift. Severity stays MEDIUM at the class level.

## Batch Z append

## Batch Z append

#### Batch 2026-05-20-Z STRENGTHENS — openapi-spec PRIMARY SOURCE enumerates 31 `'201':` declarations + 4 spec-internal copy-paste defects + the directional-fix question

Batch Z's `odd-platform__openapi__spec__odd-platform-public-api.md` sidecar provides the FIRST spec-axis primary source for DOC-GAP-074. The 5-instance class-wide pattern that batch P established (POST owners + POST roles + POST policies + POST /ingestion/entities + PUT updateOwner) is now enumerated at the SPEC layer at a much larger scale:

- **Spec-side enumeration (per sidecar `bugs_limitations_corner_cases.[2]`)** — Grep'd `'201':` across `openapi.yaml` returns 31 occurrences (vs `'200':` at 137 occurrences). The drift class spans 7+ controllers and 9+ endpoint-level instances explicitly enumerated:
  - Owner (createOwner — batch E; updateOwner — batch P)
  - Role (createRole — batch E)
  - Policy (createPolicy — batch E cross-link)
  - Ingestion postDataEntityList (batch F)
  - Term createTerm + updateTerm (batch U)
  - Alert changeAlertStatus (cross-ref)
  - **DataSource registerDataSource + updateDataSource (NEW batch Z at openapi.yaml:454 + 482)**
  - **Collector registerCollector + updateCollector (NEW batch Z at openapi.yaml:558 + 586)**
  - **Tag createTag + updateTag (NEW batch Z at openapi.yaml:372 + 400)**
  - **QueryExample updateQueryExample (NEW batch Z at openapi.yaml:2156-2157)**

- **Spec-internal copy-paste defect class (per sidecar `bugs_limitations_corner_cases.[3]`)** — five specific instances at `openapi.yaml:2797-2799` (updateTerm — 201 + "successfully modified" description), `openapi.yaml:400` (updateTag — 201 + "successfully updated"), `openapi.yaml:482` (updateDataSource — 201 + "successfully updated"), `openapi.yaml:586` (updateCollector — 201 + "successfully updated"), `openapi.yaml:2156-2157` (updateQueryExample — 201 + "successfully modified"). The shape is consistent: the spec carries the 201 status code (canonically Created — a POST shape) with description text matching an Update operation. The spec authors themselves treated 201 as the platform-wide convention for both Create AND Update, demonstrating the convention was confused at authoring time.

- **The directional-fix question** (per sidecar `bugs_limitations_corner_cases.[2]` related framing): the platform-wide convention spans 9+ endpoint-level instances and is consistent in shape — controllers uniformly return `ResponseEntity::ok` (200); tests uniformly assert `isOk()` (locking in 200); the spec uniformly declares 201 (mismatching the implementation). A single cluster-fix PR per direction can close this drift class:
  - **Option A — Align spec → impl**: change every `'201':` to `'200':` (or `'204':` for PUT operations with no response body); this matches the existing impl + tests. Bounded ~30-50 line spec change.
  - **Option B — Align impl → spec**: change every `ResponseEntity::ok` on POST methods to `ResponseEntity.status(HttpStatus.CREATED).body(...)`; PUT methods stay 200 (the spec's 201 declaration on PUT is the anomalous side). Bounded ~20-30 line code change + update existing `isOk()` test assertions to `isCreated()`. Aligns with REST conventions (POST → 201, PUT → 200).
  - **Recommended**: Option B (align impl to canonical REST convention) — but the directional choice is the maintainer's. Either direction closes the drift cluster in one PR.

- **The DOC-GAP-099 META cluster framing**: the status-code-drift failure shape is one of 6 (per DOC-GAP-242 NEW batch Z) failure shapes in the OpenAPI authoring-quality cluster. The other shapes:
  - Inverse-semantic (DOC-GAP-099)
  - OperationId-misnamed (DOC-GAP-098)
  - Response-shape-contradiction (DOC-GAP-198)
  - Coverage-gap (DOC-GAP-009 + DOC-GAP-244 NEW)
  - No-security-model (DOC-GAP-242 NEW)
  - **Status-code-drift (DOC-GAP-074 — THIS finding, strengthened to 9+ endpoints)**

- **Doc-side action expansion**: in addition to the original spec-vs-impl reconciliation PR, the doc action expands to:
  - Add a "Contract conformance" note to `developer-guides/api-reference.md` (per DOC-GAP-209's note already pending) that names the directional question explicitly.
  - Add a CI gate (per DOC-GAP-099 META's batch-U promotion candidate) that exercises every operation against a running test container and asserts status-code parity.

- **Cross-reference additions**: DOC-GAP-099 META (this finding is the COVERAGE-GAP failure shape's primary source) + DOC-GAP-242 NEW (the no-security-model failure shape; sibling spec-authoring-quality) + DOC-GAP-244 NEW (the coverage-gap failure shape; sibling spec-vs-doc-hub gap).

- **Severity stays MEDIUM** — the 9+-endpoint enumeration is more comprehensive than batch P's 5-instance framing but doesn't change the operational severity (impact: SDK clients with strict `isCreated()` checks fail on POST endpoints; clients with `2xx` checks succeed). The cluster-wide PR is bounded; the closeable-in-one-PR property holds at the larger scope. Coherence: strengthens DOC-GAP-074 with spec-axis primary source + 4 NEW endpoint-level instances (DataSource × 2 + Collector × 2 + Tag × 2 + QueryExample × 1 — at openapi.yaml:372, 400, 454, 482, 558, 586, 2156-2157, 2797-2799) + the directional-fix framing. No conflicts with existing batch-E/P framing.

## Batch ZB append

#### Batch 2026-05-21-ZB STRENGTHENS — the DataSource `registerDataSource` + `updateDataSource` instances (batch Z added them from the SPEC axis) now have the CONTROLLER-METHOD primary source confirming the implementation side returns HTTP 200

Batch Z enumerated `DataSource registerDataSource` (openapi.yaml:454) and `DataSource updateDataSource` (openapi.yaml:482) as 2 of the 9+ instances of the platform-wide 201-vs-200 drift class — but from the OpenAPI-SPEC axis only (the spec declares `'201'`). Batch ZB's `registerDataSource` and `updateDataSource` controller-method sidecars supply the IMPLEMENTATION-axis primary source: both confirm the controller hard-codes `ResponseEntity::ok` (HTTP 200), closing the spec-side ↔ impl-side triangulation for the two DataSource instances at commit 80637ed.

- **NEW surfaced_by (batch ZB)**:
  - `odd-platform__java__DataSourceController__controller-method__registerDataSource.md:docs_link_semantic.doc_drift_findings.[2]` — verbatim: "The OpenAPI spec declares `'201' The resource has been successfully created` for operationId registerDataSource (openapi.yaml:454) but the controller returns HTTP 200 (DataSourceController.java:35) — a spec-vs-implementation contract drift; clients generated from the spec assert the wrong status."
  - `registerDataSource.md:bugs_limitations_corner_cases.[1]` ("201-vs-200 status drift", severity LOW-MEDIUM per sidecar) + `:stress_findings.name_behavior_pairs.[0]` (drift: `DRIFT_NAME_VS_BEHAVIOR` — promise "Register a data source and return 201 Created", implementation `ResponseEntity::ok` = HTTP 200; "confirmed via P-038").
  - `odd-platform__java__DataSourceController__controller-method__updateDataSource.md:bugs_limitations_corner_cases.[4]` — verbatim: "The OpenAPI contract declares response 201 for this PUT (openapi.yaml:482 `'201': The resource has been successfully updated`) but the controller hard-codes `ResponseEntity.ok()` (200) at DataSourceController.java:44 — a client checking for 201 per the spec will mis-detect success."

- **NEW evidence (batch ZB)** — controller-method file:line primary source:
  - `DataSourceController.java:35` — `registerDataSource` body: `dataSourceFormData.flatMap(dataSourceService::create).map(ResponseEntity::ok)` — `ResponseEntity::ok` is HTTP 200 (vs `openapi.yaml:453-455` declared `'201'`).
  - `DataSourceController.java:44` — `updateDataSource` body: `.map(ResponseEntity::ok)` — HTTP 200 (vs `openapi.yaml:481-487` declared `'201'`).
  - These confirm exactly the DIRECTIONAL split DOC-GAP-074's batch-P framing already named: the POST `registerDataSource` is the **impl-wrong / spec-right** direction (the canonical 201 is right for POST-create; the impl should return 201); the PUT `updateDataSource` is the **spec-wrong / impl-right** direction (the spec's 201 on a PUT is anomalous; the canonical 200 the impl returns is correct). The two DataSource instances are one per direction — a clean illustration of the cluster's two-direction fix.
  - Probe P-038 (registerDataSource sidecar) pins the runtime 200-vs-201 assertion.

- **Coherence (LSN-018 Rule 6 pre-emit)**: no cross-registry contradiction — the 201-vs-200 drift is consistent across the spec axis (batch Z), the controller-method axis (this batch ZB), and the existing batch-E/P controller-method instances on Owner/Role/Policy. Same polarity throughout; no CONTRADICTS, no SUPERSEDES. DOC-GAP-099 META (the OpenAPI-authoring-quality META cluster) remains the parent.

- **Severity stays MEDIUM** — the controller-method confirmation does not change the operational severity; it converts the two DataSource instances from spec-axis-only to fully-triangulated (spec + impl). The directional-fix recommendation in the batch-Z append is unchanged and now has the impl-side file:line anchors for the DataSource vertex.

- **Cross-reference additions**: DOC-GAP-009 (the `developer-guides/api-reference` hub omits the DataSource operations — the 201-vs-200 drift on `registerDataSource`/`updateDataSource` is invisible in the per-feature API reference too) + DOC-GAP-099 META (parent OpenAPI-authoring-quality cluster).

#### Batch 2026-05-25-ZD STRENGTHENS — class-wide 201-vs-200 status-code drift cluster grows to 6-endpoint pattern with PRIMARY SOURCE at controller-class layer

Batch ZD adds the RoleController + PolicyController controller-class sidecars as PRIMARY SOURCE for the 201-vs-200 drift cluster — confirming the pattern at the enclosing-class scope:

- **`RoleController`** (NEW batch ZD) — per sidecar `bugs_limitations_corner_cases.[0]` (MEDIUM): "Status-code drift on POST /api/roles AND PUT /api/roles/{role_id} — code returns 200, OpenAPI spec declares 201. Two of the four endpoints disagree with the spec. ... The DELETE endpoint at line 49 correctly returns 204 matching spec; the GET endpoint at line 33 correctly returns 200 matching spec." Verbatim: `RoleController.java:24` (POST returns 200), `:33` (GET returns 200 — consistent), `:42` (PUT returns 200), `:49` (DELETE returns 204 — consistent) + `openapi.yaml:3611` (GET 200 — consistent), `:3629` (POST 201 — DRIFT), `:3656` (PUT 201 — DRIFT), `:3676` (DELETE 204 — consistent).
- **`PolicyController`** (NEW batch ZD) — per sidecar `docs_link_semantic.doc_drift_findings.[A]`: same drift on POST /api/policies AND PUT /api/policies/{id}. Verbatim: `PolicyController.java:24` returns 200; `:49` returns 200; `openapi.yaml:3528` declares 201 for POST; `:3566` declares 201 for PUT.

The class-wide drift cluster now spans **6 controllers × 2 operations each = 12 endpoint instances**:

| Controller | POST status | PUT status | Spec POST | Spec PUT | Source |
|---|---|---|---|---|---|
| Owner | 200 | 200 | 201 | 201 | DOC-GAP-074 + DOC-GAP-184 |
| Role | 200 | 200 | 201 | 201 | **NEW batch ZD** |
| Policy | 200 | 200 | 201 | 201 | **NEW batch ZD** |
| Term | 200 | 200 | 201 | 201 | DOC-GAP-209 |
| QueryExample | 200 | 200 | 201 | 201 | DOC-GAP-216 |
| Tag | 200 | — | 201 | — | (per batch E TagController sidecar) |

The pattern is now **platform-wide** — every CREATE endpoint returns 200, every spec declares 201. The single-PR spec-side fix (change all `'201'` declarations to `'200'` on Create operations) closes the entire cluster on one file. The class-level confirmation in batch ZD (controller-class layer) anchors the cluster as a verified-uniform-deviation rather than per-endpoint typos.

The doc-side action remains as in DOC-GAP-074's original proposal: spec-side authoring change on `opendatadiscovery-specification/openapi.yaml` to align declarations to runtime; doc-side API-reference page updates to surface the actual 200 status code; meta-acknowledgement on the api-reference hub for contract conformance posture. Severity stays MEDIUM — the typed-client failure mode is generator-dependent but uniform across the cluster; the fix is a single-file change closing 12+ endpoint instances at once.
