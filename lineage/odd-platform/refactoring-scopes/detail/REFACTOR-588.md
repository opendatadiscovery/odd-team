## REFACTOR-588 — `oddrn` is required-at-runtime but optional-in-the-OpenAPI-contract — `DataSourceFormData` marks only `name` as `required`, yet `POST /api/datasources` rejects an empty `oddrn` with HTTP 400; a spec-generated client omitting `oddrn` receives a surprising rejection

**Severity**: LOW
**Category**: contract-typo (OpenAPI contract understatement)
**Pillars affected**: [P-08 (Data-Source Lifecycle Management)]
**related_features**: [F-008]
**Batch**: ZB (2026-05-21)

**Surfaced by**:
- `odd-platform__java__DataSourceController__controller-method__registerDataSource.md:bugs_limitations_corner_cases.[3]` (LOW) — "`oddrn` is required at runtime but optional in the OpenAPI contract" — evidence: `DataSourceServiceImpl.java:119-120` (`if (StringUtils.isEmpty(form.getOddrn())) throw new BadUserRequestException`) vs `components.yaml:1314-1315` (`required: [name]` — `oddrn` not listed).
- `odd-platform__java__DataSourceController__controller-method__registerDataSource.md:docs_link_semantic.doc_drift_findings.[3]` — "The OpenAPI `DataSourceFormData` schema marks only `name` as required (`components.yaml:1314-1315`), but the code rejects an empty `oddrn` at runtime with HTTP 400 (`DataSourceServiceImpl.java:119-120`) — `oddrn` is de-facto required; the contract understates the requirement."
- `odd-platform__java__DataSourceController__controller-method__registerDataSource.md:stress_findings.request_inputs` (the `oddrn` body-field — `drift: MINOR` — "the OpenAPI schema marks `oddrn` OPTIONAL ... while the code rejects an empty `oddrn` with HTTP 400. The field-name is honoured; the requiredness contract is understated").

**Description**: `DataSourceServiceImpl.createDataSource` (lines 119-120) throws `BadUserRequestException("ODDRN must be filled for data source")` → HTTP 400 (via `ControllerAdvice`) if `form.getOddrn()` is empty. But the OpenAPI `DataSourceFormData` schema (`components.yaml:1303-1315`) lists ONLY `name` in its `required` block — `oddrn` is declared optional. So `oddrn` is **de-facto required at runtime** but **declared optional in the published contract**. A client generated from the OpenAPI spec treats `oddrn` as omittable; a caller who omits it (believing the contract) receives a surprising HTTP 400 rejection of an apparently-valid body. This is a spec-vs-implementation contract drift — the contract understates a hard runtime requirement.

**Primary source citations**:
- `DataSourceServiceImpl.java:119-120` (`if (StringUtils.isEmpty(form.getOddrn())) throw new BadUserRequestException("ODDRN must be filled for data source")`)
- `components.yaml:1303-1315` (`DataSourceFormData` schema — `required: [name]` at lines 1314-1315; `oddrn` declared but not in `required`)
- `ControllerAdvice.java:24-26` (`@ExceptionHandler(BadUserRequestException.class)` → HTTP 400)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-061 (OpenAPI-contract-driven path with controller-side semantic validation — "schema describes shape, code enforces semantics") frames the platform's split as deliberate: the schema describes the shape, the code enforces the semantics. The empty-`oddrn` rejection is a legitimate semantic-validation instance of that pattern. But the gap here is narrower and IS a defect: the OpenAPI schema actively MIS-states `oddrn` as optional when it is a hard precondition. ADR-CANDIDATE-061 does not justify a contract that LIES about requiredness — it justifies enforcing semantics the schema cannot express, not contradicting the schema's own `required` block. The `required: [name]` declaration is a contract typo / understatement.

**Proposed remedy**: Add `oddrn` to the `DataSourceFormData` `required` block in `components.yaml` (`required: [name, oddrn]`). This brings the published contract into line with the runtime behaviour; spec-generated clients then correctly mark `oddrn` mandatory and reject the omission client-side before the request is sent. The `name`-only `required` block appears to be an oversight at schema authoring time.

**Severity rationale**: LOW — a contract-understatement / hygiene gap. The runtime behaviour is correct (an empty `oddrn` SHOULD be rejected — a data source needs an identity); the defect is purely that the published OpenAPI contract under-declares the requirement, causing a spec-generated client to send an incomplete body and receive a 400 it could have prevented. Doc-product hygiene, not a functional bug.

**Suggested backlog grouping**: `OpenAPI contract hardening` — a one-line `components.yaml` `required`-block fix; pair with the broader OpenAPI-contract-drift cluster.

---
