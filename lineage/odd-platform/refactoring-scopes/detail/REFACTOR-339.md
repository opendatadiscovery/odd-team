## REFACTOR-339 — `DataEntityDataEntityGroupFormData.data_entity_group_id` is OPTIONAL per OpenAPI (no `required:` clause); a null body field produces a misleading "Entity with id null is not manually created DEG" 400-error

**Severity**: LOW
**Category**: missing-validation (OpenAPI spec hygiene)
**Pillars affected**: [P-11-platform-api-developer-surface, P-01-data-discovery]
**Batch**: L (2026-05-19)

**Surfaced by**:
- `odd-platform__java__DataEntityController__controller-method__addDataEntityDataEntityGroup.md:bugs_limitations_corner_cases.[3]` (LOW) — "`data_entity_group_id` is OPTIONAL per the OpenAPI schema — `DataEntityDataEntityGroupFormData` (`components.yaml:1087-1092`) declares the property without a `required` clause; the schema is `type: object, properties: {data_entity_group_id: {type: integer, format: int64}}`. A POST body `{}` or `{\"data_entity_group_id\": null}` passes OpenAPI validation. The Spring/Jackson deserialiser yields `formData.getDataEntityGroupId() == null`. The service then calls `reactiveDataEntityRepository.get(null)` (line 393) which returns `Mono.empty()`. `switchIfEmpty` fires with `BadUserRequestException(\"Entity with id null is not manually created DEG\")` — a user-visible error mentioning 'id null' is a poor surface for a missing-required-field condition"

**Description**: The OpenAPI schema at `components.yaml:1087-1092` defines `DataEntityDataEntityGroupFormData` as:
```yaml
DataEntityDataEntityGroupFormData:
  type: object
  properties:
    data_entity_group_id:
      type: integer
      format: int64
```
There is NO `required:` clause. A POST body `{}` or `{"data_entity_group_id": null}` passes OpenAPI validation. Spring/Jackson deserialises to `formData.getDataEntityGroupId() == null`. The service calls `reactiveDataEntityRepository.get(null)` at `DataEntityServiceImpl.java:393`, which returns `Mono.empty()`. The `switchIfEmpty` fires with `BadUserRequestException("Entity with id null is not manually created DEG")` — a user-visible error message that mentions "id null" rather than "data_entity_group_id is required."

The failure mode is operator confusion: an API client (e.g., curl) that forgets the body field receives a misleading error pointing at "id null" rather than the missing required field. The error message implies a lookup failure on a literal null id rather than a request-shape validation failure.

A schema fix (adding `required: [data_entity_group_id]` to the schema) is backwards-compatible because omitting the field is already invalid behaviour at the service level — the change tightens the spec to match the implementation's expectations.

**Primary source citations**:
- `components.yaml:1087-1092` (the schema; no `required` clause)
- `DataEntityServiceImpl.java:393` (`reactiveDataEntityRepository.get(formData.getDataEntityGroupId())`)
- `DataEntityServiceImpl.java:395-397` (the `switchIfEmpty` with the misleading message)

**Existing-ADR-or-implied-prescription**: **ADR-CANDIDATE-001** (controllers as delegates, OpenAPI-generator emits the interfaces). The IMPLIED prescription is that the OpenAPI spec should accurately reflect the contract's validation rules — `@Valid @RequestBody` on the controller method generates Spring validation against the spec's `required:` constraints. Adding `required:` would generate a `MethodArgumentNotValidException` returning HTTP 400 with field-name-specific error message BEFORE the service-layer null-check fires.

**Proposed remedy**: Edit `odd-platform-specification/components.yaml:1087-1092`:
```yaml
DataEntityDataEntityGroupFormData:
  type: object
  required:
    - data_entity_group_id
  properties:
    data_entity_group_id:
      type: integer
      format: int64
      minimum: 1
```
Then regenerate the controller / form-data class. Companion: add `@WebFluxTest` covering the missing-field case to lock in the contract.

**Severity rationale**: LOW — UX/spec hygiene; not a security or correctness defect (the operation correctly rejects null ids). The fix is mechanical (one YAML line + regenerate).

**Suggested backlog grouping**: `OpenAPI contract hardening` (cluster with REFACTOR-014, REFACTOR-044, REFACTOR-020 — spec hygiene + missing-required + drift batch).

---
