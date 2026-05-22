## REFACTOR-591 — OpenAPI declares HTTP `201` for `POST /api/datasources` and `PUT /api/datasources/{id}` but the controllers return `200` — a spec-generated client asserting `status == 201` treats a correct registration/update as a failure; consolidates the previously-unpromoted 201-vs-200 cross-cutting drift

**Severity**: LOW
**Category**: status-code-narrow (OpenAPI contract-vs-implementation drift)
**Pillars affected**: [P-08 (Data-Source Lifecycle Management), P-09 (RBAC), P-10 (Ingestion) — cross-cutting]
**related_features**: [F-008]
**Batch**: ZB (2026-05-21)

**Surfaced by**:
- `odd-platform__java__DataSourceController__controller-method__registerDataSource.md:bugs_limitations_corner_cases.[1]` (LOW-MEDIUM) — "**201-vs-200 status drift**: the controller returns HTTP 200 where the OpenAPI spec declares 201 for operationId `registerDataSource`" — evidence: `DataSourceController.java:35` (`.map(ResponseEntity::ok)` — HTTP 200) vs `openapi.yaml:453-455` (`'201': The resource has been successfully created`). "clients generated from the spec assert `status == 201` and will treat a correct registration as a failure" — verified-by-probe `P-038`.
- `odd-platform__java__DataSourceController__controller-method__updateDataSource.md:bugs_limitations_corner_cases.[4]` (LOW) — "The OpenAPI contract declares response 201 for this PUT (`openapi.yaml:482` `'201': The resource has been successfully updated`) but the controller hard-codes `ResponseEntity.ok()` (200) at `DataSourceController.java:44` — a client checking for 201 per the spec will mis-detect success."
- Probe `P-038` (`lineage/odd-platform/probes/P-038.yaml`) — pins the 201-vs-200 drift on `POST /api/datasources`.

**Description**: `DataSourceController.registerDataSource` (line 35) returns `.map(ResponseEntity::ok)` → HTTP 200, but `openapi.yaml:453-455` declares the `registerDataSource` operation's success response as `'201': The resource has been successfully created`. `DataSourceController.updateDataSource` (line 44) returns `ResponseEntity.ok()` → HTTP 200, but `openapi.yaml:481-487` declares the `updateDataSource` operation's success response as `'201': The resource has been successfully updated`. A client generated from the published OpenAPI spec asserts `status == 201` for these operations and will therefore treat a correct registration or update — which returns 200 — as a failure.

This is the SAME drift shape the catalog observed in earlier batches across `createOwner` / `createRole` / `updateRole` / `createPolicy` (batch E) and `IngestionController.postDataEntityList` (batch F). Those batches noted the drift in cross-cutting batch-notes under a "REFACTOR-193" reference but — per the `refactoring-scopes/index.md` frontmatter ("REFACTOR-193 ... referenced in cross-cutting batch notes but not promoted as standalone entries") — it was NEVER given a standalone registry entry or detail file. REFACTOR-591 is the proper standalone entry for the 201-vs-200 status drift: it anchors on the two DataSourceController endpoints (the batch-ZB primary source) AND consolidates the previously-unpromoted observations from `createOwner`/`createRole`/`updateRole`/`createPolicy`/`postDataEntityList` — the drift is a class-wide OpenAPI-contract-vs-implementation hygiene gap, now given a real home.

**Primary source citations**:
- `DataSourceController.java:35` (`registerDataSource` — `.map(ResponseEntity::ok)` = 200) vs `openapi.yaml:453-455` (`'201'` declared)
- `DataSourceController.java:44` (`updateDataSource` — `ResponseEntity.ok()` = 200) vs `openapi.yaml:481-487` (`'201'` declared)
- Probe `P-038`
- Prior cross-cutting observations (un-promoted): `createOwner` / `createRole` / `updateRole` / `createPolicy` (batch E), `IngestionController.postDataEntityList` (batch F)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-001 (controllers as thin delegates implementing OpenAPI-generator-emitted `*Api` interfaces — the generated interface is the source of truth for path/verb) — the OpenAPI-generator-as-source-of-truth pattern was SUPPOSED to prevent contract-vs-implementation drift. The 201-vs-200 mismatch is precisely the class of drift that pattern does not catch: the generated `*Api` interface fixes the path/verb/signature but does NOT fix the HTTP STATUS CODE the controller body returns — the body's `.map(ResponseEntity::ok)` is hand-written and free to disagree with the spec's declared response code. GAP-shaped — the mismatch has no stated rationale; either the controllers should return 201 (`ResponseEntity.status(CREATED)`) or the spec should declare 200.

**Proposed remedy**: Decide the canonical status per operation and align the two sides. For a CREATE (`POST /api/datasources`), `201 Created` is the REST-conventional and spec-declared answer — change the controller to `ResponseEntity.status(HttpStatus.CREATED)`. For the PUT update, `200 OK` is the conventional answer for an update-of-existing (`201` is unusual for a PUT that does not create) — so for `updateDataSource` the likely fix is to correct the SPEC to `'200'` rather than the controller. Apply the same decision uniformly across the sibling endpoints (`createOwner`/`createRole`/`updateRole`/`createPolicy`/`postDataEntityList`) so the platform's POST-creates consistently return 201 and PUT-updates consistently return 200, matching the published contract.

**Severity rationale**: LOW — a contract-vs-implementation hygiene gap. The operations function correctly; the defect is purely that spec-generated clients asserting the declared `201` mis-detect a correct 200 response as a failure. Doc-product / contract hygiene, not a functional bug — but it is genuinely client-breaking for any consumer that trusts the published OpenAPI contract.

**Suggested backlog grouping**: `OpenAPI contract hardening` — a small per-endpoint fix (controller status OR spec response code); apply uniformly across all the POST-create / PUT-update endpoints exhibiting the drift. This is the standalone home for the formerly-unpromoted cross-cutting 201-vs-200 observation.

---
