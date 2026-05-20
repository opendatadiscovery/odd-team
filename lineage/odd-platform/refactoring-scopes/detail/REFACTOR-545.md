## REFACTOR-545 — OpenAPI status-code drift cluster — 9+ endpoint-level instances across 7+ controllers; spec declares 201 for Create+Update; controllers uniformly return 200; tests assert isOk() locking in 200 — closeable in a single directional-fix PR

**Severity**: MEDIUM
**Category**: spec-vs-impl-drift + missing-contract-conformance-test
**Batch**: Z (2026-05-20)
**Pillars affected**: [P-11-platform-api-developer-surface (the spec is the SDK consumer surface), P-08-management-administration (Owner/Role/Policy/Tag/DataSource/Collector CRUD endpoints), P-10-integrations-ingestion (postDataEntityList), P-06-data-glossary (Term CRUD), P-02-data-modelling (QueryExample CRUD)]

**Surfaced by**:
- `openapi.yaml.md:bugs_limitations_corner_cases.[2]` (MEDIUM) — "**Status-code drift cluster — batch-W extension enumerates 9+ endpoint-level instances across 7+ controllers** — 31 operations declare HTTP 201 in the spec; cross-batch evidence now establishes the drift at 7+ controllers: Owner (batch E), Role (batch E), Policy (batch E), Ingestion postDataEntityList (batch F), Term createTerm + updateTerm (batch U), Alert changeAlertStatus (cross-ref), DataSource registerDataSource + updateDataSource (batch W), Collector registerCollector + updateCollector (batch W), Tag createTag + updateTag (batch W). ... Controllers uniformly use `ResponseEntity::ok` (200); tests assert `isOk()` and lock in 200. The drift is PERVASIVE (every Create/Update method exhibits it) and UNCOORDINATED (the spec author chose 201 by REST convention, the controller authors chose 200 by Spring convention, the test authors locked in 200; no review reconciled the three). severity: MEDIUM (impacts SDK clients with strict `isCreated()` checks; functional impact zero since 200 and 201 are both success responses)."
- `openapi.yaml.md:bugs_limitations_corner_cases.[3]` (LOW) — "**Spec-internal copy/paste defect at `openapi.yaml:2797-2799`** — `updateTerm` declares `'201'` (canonically Created) with description 'The resource has been successfully modified' — the description is for a 200/204 Update, the status code is for a Create. The same shape repeats at `openapi.yaml:400` (updateTag — 201 + 'successfully updated' description), `openapi.yaml:482` (updateDataSource — 201 + 'successfully updated'), `openapi.yaml:586` (updateCollector — 201 + 'successfully updated'), `openapi.yaml:2156-2157` (updateQueryExample — 201 + 'successfully modified'). The spec authors themselves treated the 201 as the platform-wide convention for both Create AND Update, demonstrating the convention was confused at authoring time."

**Statement**: ODD's `odd-platform-specification/openapi.yaml` declares HTTP 201 across 31 operations spanning Create AND Update paths; controllers uniformly use `ResponseEntity::ok` (200) via `ResponseEntity::ok` or `.thenReturn(ResponseEntity.ok().build())`; tests assert `.expectStatus().isOk()` and lock in 200. Specific spec-vs-impl drift confirmed at 9+ endpoint-level instances by batch-Z's spec-file PRIMARY SOURCE evidence:

| Controller | Operation | Spec declares | Controller returns | Test asserts | File:line citation |
|---|---|---|---|---|---|
| OwnerController | createOwner | 201 | 200 | isOk() | per batch E |
| OwnerController | updateOwner | 201 | 200 | isOk() | per batch E |
| RoleController | createRole | 201 | 200 | isOk() | per batch E |
| RoleController | updateRole | 201 | 200 | isOk() | per batch E |
| PolicyController | createPolicy | 201 | 200 | isOk() | per batch E |
| IngestionController | postDataEntityList | 201 | 200 | isOk() | per batch F |
| TermController | createTerm | 201 | 200 | isOk() | `openapi.yaml:2760` per batch U |
| TermController | updateTerm | 201 | 200 | isOk() | `openapi.yaml:2797-2799` per batch U |
| QueryExampleController | updateQueryExample | 201 | 200 | isOk() | `openapi.yaml:2156-2157` |
| TagController | createTag | 201 | 200 | isOk() | `openapi.yaml:372` NEW batch W |
| TagController | updateTag | 201 | 200 | isOk() | `openapi.yaml:400` NEW batch W |
| DataSourceController | registerDataSource | 201 | 200 | isOk() | `openapi.yaml:454` NEW batch W |
| DataSourceController | updateDataSource | 201 | 200 | isOk() | `openapi.yaml:482` NEW batch W |
| CollectorController | registerCollector | 201 | 200 | isOk() | `openapi.yaml:558` NEW batch W |
| CollectorController | updateCollector | 201 | 200 | isOk() | `openapi.yaml:586` NEW batch W |

**The architectural opinion is confused**:
- The SPEC AUTHORS chose 201 by REST convention (`201 Created` for POST creating a resource), AND extended it to PUT-update paths with a copy-paste description like "successfully modified" (201 + "modified" is incoherent — 201 is Create semantics, "modified" is Update language)
- The CONTROLLER AUTHORS chose 200 by Spring convention (`ResponseEntity::ok` is the most ergonomic builder; `ResponseEntity.status(HttpStatus.CREATED)` requires explicit status enum)
- The TEST AUTHORS chose 200 by asserting the controller behaviour (`.expectStatus().isOk()` is the WebFlux idiom; the test asserts what the code does, not what the spec says)
- No review reconciled the three viewpoints; the drift accumulated silently

**Functional impact**: zero — both 200 and 201 are success responses; HTTP semantics are equivalent for the client experience. The drift affects:
1. **Strict SDK clients** that assert `response.status_code == 201` on Create paths — these fail unexpectedly against the running platform
2. **OpenAPI-generated TypeScript / Java SDK code** that emits typed `201`-expecting client methods — clients silently coerce 200→201 type mismatch
3. **API consumer documentation experience** — the spec-driven docs (Swagger UI, redocly, the per-feature api-reference sub-pages) display 201 while the platform returns 200

**Sub-shape: spec-internal `updateXxx` carries `201 + "modified"` description** (verified at openapi.yaml:400, 482, 586, 2156-2157, 2797-2799 — 5 instances). The spec authors at some point conflated Create and Update semantics; the controllers correctly returned 200 (the Spring convention for both Create-with-side-effect and Update); but the spec was NEVER updated to PUT-side 200. This is the "copy-paste defect" sub-finding.

**Primary source citations**:
- `openapi.yaml:372` (Tag POST 201)
- `openapi.yaml:400` (Tag PUT 201)
- `openapi.yaml:454` (DataSource POST 201)
- `openapi.yaml:482` (DataSource PUT 201)
- `openapi.yaml:558` (Collector POST 201)
- `openapi.yaml:586` (Collector PUT 201)
- `openapi.yaml:2118` (Owner POST 201 per batch E)
- `openapi.yaml:2156-2157` (QueryExample PUT 201)
- `openapi.yaml:2760` (Term POST 201 per batch U)
- `openapi.yaml:2797-2799` (Term PUT 201)
- Controller implementations uniformly use `ResponseEntity::ok` (200) — cited at each controller-method sidecar
- Tests uniformly assert `isOk()` — cited at each test class

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-001 / ADR-CANDIDATE-189 NEW batch Z (OpenAPI-as-source-of-truth for path/method/shape) — the architectural intent is that the spec IS authoritative for HTTP shape including status codes. The drift IS the violation. Concept catalog `openapi-200-vs-201-status-code-drift` enumerates the pattern; batch-Z's openapi.yaml sidecar provides the PRIMARY-SOURCE file:line evidence.

**Proposed remedy (single directional-fix PR)**:

**Direction A — Align spec to code (LOW effort, recommended)**:
- Update `openapi.yaml` at the 15 file:line citations above to declare `'200':` instead of `'201':`
- Update the response descriptions to "successfully created/updated"
- The change is purely spec-side; controllers + tests unchanged
- SDK consumers downloading the updated spec get accurate 200 expectations
- Single PR: ~30 LOC of YAML across 15 files

**Direction B — Align code to spec (HIGHER effort, less recommended)**:
- Update each controller's `ResponseEntity::ok` to `ResponseEntity.status(HttpStatus.CREATED)`
- Update each test's `.expectStatus().isOk()` to `.expectStatus().isCreated()`
- The change touches 15 controllers + 15 test classes
- Functional consequence: any UI client / Spring filter / proxy interpreting 200 vs 201 differently sees a behavioural change

Recommend: **Direction A** (single spec-update PR). The Spring convention of 200 for Create-with-side-effect is well-established; aligning the spec to match the code is the minimal change with maximum SDK-consumer benefit.

**Severity rationale**: MEDIUM — functional impact zero (success-vs-success); SDK consumer experience non-trivial; the pattern is closeable in a single directional-fix PR per the openapi.yaml sidecar's framing. The drift cluster IS the canonical demonstration of "no contract-conformance test" consequences — a spec-driven contract test (fire every spec'd operation, assert status code matches declared) would surface this drift on commit.

**Suggested backlog grouping**: `Spec quality hardening sprint` co-batched with REFACTOR-541 (no securitySchemes), REFACTOR-217 (path-mismatch), DOC-GAP-099 (the 5-shape spec-coherence cluster). A single sprint closes the spec-side drift class structurally.

---
