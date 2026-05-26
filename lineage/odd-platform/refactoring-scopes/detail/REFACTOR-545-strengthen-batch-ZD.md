## STRENGTHENS — Batch ZD (PolicyController + RoleController class-level — class-level enumeration of the 200-vs-201 status-code drift cluster)

**Two new class-level sidecars promote REFACTOR-545's triangulation by enumerating the status-code drift at the FULL controller scope (not just per-method)**:

- **PolicyController (CLASS-LEVEL)** — `PolicyController.java:24` createPolicy returns 200 (spec declares 201 at openapi.yaml:3528); `PolicyController.java:49` updatePolicy returns 200 (spec declares 201 at openapi.yaml:3566). Per `bugs_limitations_corner_cases[4]`: "Response-code drift: spec declares 201 on create/update success; controller returns 200. A third-party API consumer following the OpenAPI spec will expect 201; the bundled React UI tolerates the drift because it inspects the response BODY for content. The drift is consistent across the codebase."
- **RoleController (CLASS-LEVEL)** — `RoleController.java:24` createRole returns 200 (spec declares 201 at openapi.yaml:3629); `RoleController.java:42` updateRole returns 200 (spec declares 201 at openapi.yaml:3656). The DELETE endpoint at line 49 correctly returns 204 (consistent); the GET endpoint at line 33 correctly returns 200 (consistent). Per `bugs_limitations_corner_cases[0]`: "Status-code drift on POST /api/roles AND PUT /api/roles/{role_id} — code returns 200, OpenAPI spec declares 201. Two of the four endpoints disagree with the spec."

**Updated cross-controller enumeration**: REFACTOR-545 now spans 13+ controllers including the batch-ZD-confirmed Role + Policy class-level evidence. The cluster table:

| Controller | Operation | Spec | Returns | Batch |
|---|---|---|---|---|
| OwnerController | createOwner / updateOwner | 201 | 200 | E |
| RoleController | createRole / updateRole | 201 | 200 | E + ZD (CLASS-LEVEL CONFIRMED) |
| PolicyController | createPolicy / updatePolicy | 201 | 200 | E + ZD (CLASS-LEVEL CONFIRMED) |
| IngestionController | postDataEntityList | 201 | 200 | F |
| TermController | createTerm / updateTerm | 201 | 200 | U |
| QueryExampleController | updateQueryExample | 201 | 200 | U |
| TagController | createTag / updateTag | 201 | 200 | W |
| DataSourceController | registerDataSource / updateDataSource | 201 | 200 | W |
| CollectorController | registerCollector / updateCollector | 201 | 200 | W |

The Role + Policy class-level reads CROSS-VALIDATE the per-method findings from batch E — there is no per-method override; the entire controller class is uniformly 200-on-success across every Create/Update endpoint.

**Cross-batch refinement**: The class-level confirmations make the cluster's scope more precise — every CREATE + UPDATE in the RBAC management half (Policy + Role + Owner = 6 endpoints) returns 200 against spec's 201. The DELETE endpoint on Role + Owner correctly returns 204 (consistent); GET endpoints correctly return 200 (consistent). The drift is specifically POST + PUT.

**Severity unchanged**: MEDIUM — affects SDK clients; functional impact zero (200 and 201 are both success responses); fix in either direction (controller switches to 201 or spec switches to 200) is one-line per controller.

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-189 (the spec-vs-impl status-code drift IS the canonical failure mode of contract-first stance; ADR-CANDIDATE-189 explicitly enumerates it).
- SUPERSEDES: none.
- CONFLICTS: none.
