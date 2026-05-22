## REFACTOR-585 — `PUT /api/datasources/{id}` is a full-form REPLACE — a partial body silently nulls the omitted fields; an API consumer sending `{name}` to rename a source wipes its `description` and detaches its `namespace`; there is no MERGE option

**Severity**: MEDIUM
**Category**: silent-data-loss (REPLACE-not-MERGE via MapStruct default null-handling)
**Pillars affected**: [P-08 (Data-Source Lifecycle Management)]
**related_features**: [F-008]
**Batch**: ZB (2026-05-21)

**Surfaced by**:
- `odd-platform__java__DataSourceController__controller-method__updateDataSource.md:bugs_limitations_corner_cases.[0]` (MEDIUM) — "**Partial-edit data loss**: a PUT body omitting `description` nulls the existing description; omitting `namespace_name` nulls `namespace_id` and detaches the namespace. An API consumer (or a UI bug) sending a partial body to 'rename' a source silently wipes the other two fields. There is no MERGE option on this endpoint." — evidence: `DataSourceMapper.java:49-56` + `MapperConfig.java:7-11`.
- `odd-platform__java__DataSourceController__controller-method__updateDataSource.md:stress_findings.name_behavior_pairs` (the `update` / `updateDataSource` `DRIFT_NAME_VS_BEHAVIOR` — "REPLACE. ... `MapperConfig` sets `componentModel`/`unmappedTargetPolicy`/`injectionStrategy` but NO `nullValuePropertyMappingStrategy`; MapStruct's default for an unspecified strategy is `SET_TO_NULL`. ... an omitted JSON field deserialises to a null Java field and is written as null onto the existing pojo").
- Probe `P-043` (`lineage/odd-platform/probes/P-043.yaml`) — pins REPLACE-vs-MERGE.

**Description**: `DataSourceServiceImpl.update` (lines 68-83) applies the request form to the loaded `DataSourcePojo` through the MapStruct mapper `DataSourceMapper.applyToPojo` (`DataSourceMapper.java:49`), a `@MappingTarget` method. `MapperConfig` (`MapperConfig.java:7-11`) sets `componentModel`, `unmappedTargetPolicy`, and `injectionStrategy` but does NOT set `nullValuePropertyMappingStrategy` — so MapStruct's documented default `SET_TO_NULL` governs `applyToPojo`. `DataSourceUpdateFormData` (`components.yaml:1317-1325`) has 3 optional fields (`name`, `description`, `namespace_name`) with no `required` block; a field omitted from the JSON body deserialises to a null Java field and is written as `null` onto the existing row. The namespace overload (`DataSourceMapper.java:51-56`) explicitly sets `namespace_id` to null when `namespace == null` (i.e. when `namespace_name` was empty/omitted), detaching the namespace. Net effect: a caller PUTting a partial body to change ONE field silently NULLs the other two. The endpoint name `update` does not signal that callers must resend every field they want to keep, and the live `features/management` page does not document REPLACE-vs-MERGE semantics. The UI form presumably sends all three fields (masking the gap for UI users), but any programmatic API consumer — or a UI regression — that sends a partial body wipes data.

**Why GAP-shaped, not an ADR** (3-question wisdom test): (1) *Intentional?* The `@MappingTarget` over the whole form is deliberate, but the `SET_TO_NULL` behaviour is the MapStruct **framework default** for an unspecified strategy — there is NO comment, NO spec text, NO doc page defending "we want REPLACE semantics." The behaviour is inherited, not stated. → leans gap. (2) *Structural impact?* It's an API-contract semantics question (REPLACE vs MERGE) — moderate scope. (3) *Refactoring or structural?* Switching to MERGE is a one-line `MapperConfig` change (`nullValuePropertyMappingStrategy = IGNORE`) — refactoring within the existing structure. → gap. 2-of-3 lean gap → `refactoring-scopes`, not `implicit-adrs`.

**Primary source citations**:
- `DataSourceMapper.java:49` (`applyToPojo(@MappingTarget DataSourcePojo, DataSourceUpdateFormData)`) + `:51-56` (the namespace overload — `namespace == null` → `namespace_id = null`)
- `MapperConfig.java:7-11` (sets `componentModel`/`unmappedTargetPolicy`/`injectionStrategy`; NO `nullValuePropertyMappingStrategy`)
- `components.yaml:1317-1325` (`DataSourceUpdateFormData` — 3 optional fields, no `required` block)
- Probe `P-043` (`lineage/odd-platform/probes/P-043.yaml`)

**Existing-ADR-or-implied-prescription**: None. The REPLACE behaviour is a consequence of the global `MapperConfig`'s unset `nullValuePropertyMappingStrategy`. A future global `IGNORE` setting would silently convert this endpoint (and every other `@MappingTarget` mapper) from REPLACE to MERGE — which is itself a coupling hazard worth noting. There is no ADR codifying REPLACE-vs-MERGE; the platform has not made an explicit, stated decision here.

**Proposed remedy**: Decide REPLACE-vs-MERGE explicitly and codify it. If MERGE is intended (the safer default for a PUT that callers may use partially): set `nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE` on `applyToPojo` (per-method) or on `MapperConfig` (global — but audit every other `@MappingTarget` consumer first). If REPLACE is intended: keep the behaviour but (a) document it prominently on `features/management` and the API reference, (b) consider marking the `DataSourceUpdateFormData` fields `required` in the OpenAPI contract so spec-generated clients send all of them, (c) emit a WARN when a partial body is received. Whichever is chosen, the decision should be stated (an ADR draft or an explicit `MapperConfig` comment) so it stops being an unstated framework-default leak.

**Severity rationale**: MEDIUM — silent data loss on a partial-body edit; bounded because the UI form presumably sends all fields (so UI-driven edits are safe), but any programmatic API consumer following the OpenAPI contract (which marks all three fields optional) and sending only the field it wants to change wipes the other two with an HTTP 200. The `namespace` detachment is the most surprising — editing only the `name` silently unlinks the namespace.

**Suggested backlog grouping**: `DOC-NNN data-source-update-semantics` (if REPLACE is kept — document it) OR a small code-change item (if MERGE is chosen — the `MapperConfig` / per-method `nullValuePropertyMappingStrategy` fix). Pair with the OpenAPI-contract-hardening batch (the `required`-block question).

---
