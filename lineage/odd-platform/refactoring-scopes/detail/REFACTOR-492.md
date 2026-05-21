## REFACTOR-492 — Tag status-code drift — `createTag` and `updateTag` return HTTP 200 while the OpenAPI spec declares 201; a spec-conformant client mis-classifies a successful create/update

**Severity**: MEDIUM
**Category**: contract-drift
**Batch**: X-TAGGING
**Related pillar features**: P-08 (Management & Administration — Tags tab), P-11 (Platform API & Developer Surface — the OpenAPI contract)
**related_features**: [F-018]

**Surfaced by**:
- `odd-platform__java__TagController__controller-method__createTag.md:bugs_limitations_corner_cases[0]` ("Status-code drift on `createTag` — the controller returns HTTP 200 ... the OpenAPI operation declares `'201'`.")
- `odd-platform__java__TagController__controller-method__updateTag.md:bugs_limitations_corner_cases[1]` ("Status-code drift on `updateTag` — controller returns HTTP 200 ... OpenAPI declares 201.")
- `odd-platform__openapi__tags__openapi-tag__tag.md:bugs_limitations_corner_cases` ("Status-code drift on `createTag` and `updateTag` — both operations declare `'201'` ... `TagController` returns `200` via `ResponseEntity::ok`.")
- cross-confirm: `feature-flows/index.yaml` F-018 facet `tag_status_code_drift_controller_200_vs_spec_201_create_and_update`

**Statement**: `TagController.createTag` (`:27`) and `TagController.updateTag` (`:51`) both return HTTP 200 via `ResponseEntity::ok`. The OpenAPI spec declares `'201'` for both operations (`openapi.yaml:372` for `createTag`, `:400` for `updateTag`). A client generated strictly from the spec expects 201 on a successful create/update and may treat the actual 200 as an unexpected status. This is the SAME drift class already tracked at the catalog level as the REFACTOR-193 batch-note family (createOwner / createRole / updateRole / createPolicy / `IngestionController.postDataEntityList` / `TermController.createTerm` — all declare 201 in spec, return 200 in code) — the OpenAPI-generator-as-source-of-truth pattern (ADR-CANDIDATE-001) is meant to prevent exactly this class of contract-vs-implementation drift.

**Evidence**: `TagController.java:27` (createTag `ResponseEntity::ok`) + `TagController.java:51` (updateTag `ResponseEntity::ok`) + `openapi.yaml:372` (createTag declares `'201'`) + `openapi.yaml:400` (updateTag declares `'201'`).

**Why this is a gap, not an ADR (wisdom test)**:
1. *Intentional?* NO. The controller and the spec disagree; there is no comment, doc, or ADR defending "we return 200 even though the spec says 201". The same drift exists across ~6 other create/update endpoints (the REFACTOR-193 family) — a class-wide hygiene gap, not a per-endpoint decision. The OpenAPI-generated-interface ADR (ADR-CANDIDATE-001) explicitly intends the spec to be the source of truth; the drift contradicts that.
2. *Structural impact?* NO — the fix is one of: (a) change the controller to `ResponseEntity.status(CREATED)`, or (b) change the spec to declare `'200'`. Either is a one-line change.
3. *Refactoring or structural?* REFACTORING — reconcile the spec and the controller.
→ refactoring scope.

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-001 (controllers implement OpenAPI-generated `*Api` interfaces; the spec is the contract) is the implied prescription — the controller's HTTP status should match the spec. ADR-CANDIDATE-007 (uniform `Mono<ResponseEntity<T>>` with `.map(ResponseEntity::ok)`) is the pattern that PRODUCES the 200: the codebase-wide `.map(ResponseEntity::ok)` convention emits 200 by default; create endpoints that the spec declares 201 for therefore drift unless the controller explicitly uses `.status(CREATED)`. The cleanest fix aligns with the existing REFACTOR-193 family resolution.

**Proposed remedy**: Decide the canonical status per the REFACTOR-193 family resolution (the maintainer should pick one direction for ALL the create/update endpoints in that family — likely amend the spec to `'200'`, since the codebase-wide `.map(ResponseEntity::ok)` convention is entrenched and changing every controller is the larger churn). Apply the chosen direction to `createTag` (`openapi.yaml:372`) and `updateTag` (`openapi.yaml:400`). Add a contract-conformance test (or a spec-lint CI gate) asserting the declared status matches the returned status. Fold this scope into the REFACTOR-193 batch-note family so the fix is one consistent sweep.

**Severity rationale**: MEDIUM — a contract-vs-implementation hygiene gap. A spec-conformant generated client mis-classifies a successful create/update; the practical impact is bounded (the response body is correct, only the status code differs) but it undermines the OpenAPI-as-source-of-truth guarantee that ADR-CANDIDATE-001 promises, and it is part of a class-wide pattern worth one coordinated fix.

**Suggested backlog grouping**: DOC-NNN / OpenAPI contract-hardening sprint — fold into the REFACTOR-193 batch-note family (the 6+ other 200-vs-201 create/update endpoints); fix all of them in one spec sweep + add a spec-lint gate.

---
