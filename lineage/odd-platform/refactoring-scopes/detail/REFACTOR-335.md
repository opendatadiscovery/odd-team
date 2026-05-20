## REFACTOR-335 — `upsertDataEntityMetadataFieldValue` accepts any `String` value regardless of the field's declared `MetadataFieldType` enum (INTEGER / FLOAT / BOOLEAN / DATETIME / ARRAY / JSON / STRING / UNKNOWN) — STRING-typed and INTEGER-typed fields both accept "not a number" without coercion or rejection

**Severity**: MEDIUM
**Category**: missing-validation
**Pillars affected**: [P-01-data-discovery]
**Batch**: L (2026-05-19)

**Surfaced by**:
- `odd-platform__java__DataEntityController__controller-method__upsertDataEntityMetadataFieldValue.md:bugs_limitations_corner_cases.[2]` (MEDIUM) — "No type validation against `metadata_field.type` — `formData.getValue()` is written verbatim into `metadata_field_value.value` (a `text` column) regardless of the field's declared `MetadataTypeEnum` (INTEGER / FLOAT / BOOLEAN / DATETIME / ARRAY / JSON / STRING / UNKNOWN per `MetadataTypeEnum.java:3-12`). A user can write `\"not a number\"` to an INTEGER-typed field, or `\"true\"` to a JSON-typed field. No coercion, no validation, no rejection. Downstream readers must defend against arbitrary string content regardless of the declared type"

**Description**: The `metadata_field` table carries a `type` column (`V0_0_1__init.sql:166-173`) populated with one of 8 enum values: INTEGER, FLOAT, BOOLEAN, DATETIME, ARRAY, JSON, STRING, UNKNOWN (per `MetadataTypeEnum.java:3-12`). The expectation from the OpenAPI spec (`MetadataFieldType` enum at `components.yaml:2077-2086`) is that the value column carries content matching the declared type — operators / API clients selecting INTEGER expect numeric strings, JSON expect parseable JSON, etc. The platform DOES NOT VALIDATE THIS.

`DataEntityServiceImpl.upsertMetadataFieldValue` at line 292-295 extracts only `formData.getValue()` (a raw `String`) and writes it verbatim into the `text` column. No coercion to `INTEGER`, no `JsonParseException` check for `JSON`, no `Pattern` match for `DATETIME`, no `Boolean.parseBoolean` for `BOOLEAN`. A user with `DATA_ENTITY_CUSTOM_METADATA_UPDATE` can:
- Write `"not a number"` to an INTEGER-typed field.
- Write `"true"` to a JSON-typed field.
- Write `"2026-13-32T25:99:99"` to a DATETIME-typed field.
- Write arbitrary text to a BOOLEAN-typed field.

The MetadataFieldType enum is documentation-only — the OpenAPI spec describes the type but does not enforce shape constraints. Downstream readers (the UI rendering a custom-metadata table, BI tools consuming the metadata via API) must defend against arbitrary string content regardless of the declared type.

**Primary source citations**:
- `DataEntityServiceImpl.java:292-295` (pojo built with only `value`; no type-aware coercion)
- `ReactiveMetadataFieldValueRepositoryImpl.java:95-104` (UPDATE sets the `value` text column without inspecting field type)
- `V0_0_1__init.sql:179` (`value text` — unbounded text column)
- `MetadataTypeEnum.java:3-12` (the 8-value enum that the value is NOT validated against)

**Existing-ADR-or-implied-prescription**: none. The OpenAPI spec declares the type as a `MetadataFieldType` enum but does not declare validation rules for the value. The IMPLIED prescription is that the platform SHOULD enforce type at write-time (the declared type is the API contract).

**Proposed remedy**: At the entry of `upsertMetadataFieldValue` (and the matching `createMetadata` path), validate `formData.getValue()` against `metadataField.getType()`:
- INTEGER → `Long.parseLong(value)` → `IllegalArgumentException` → BadUserRequestException
- FLOAT → `Double.parseDouble(value)`
- BOOLEAN → match against `"true"|"false"` (case-insensitive)
- DATETIME → `LocalDateTime.parse(value)` or `OffsetDateTime.parse(value)`
- JSON → `objectMapper.readTree(value)` → JsonProcessingException → BadUserRequestException
- ARRAY → likely JSON-array shape; same as JSON with a top-level array check
- STRING → no validation (any string accepted)
- UNKNOWN → no validation

Companion: doc-side, the live custom-metadata page (currently absent — see REFACTOR-NNN doc-gap) should describe the type semantics. The OpenAPI spec for `MetadataFieldValueUpdateFormData.value` could carry a `description` clarifying that the string MUST be coercible to the field's declared type.

Cross-batch with REFACTOR-336 (no origin check) and REFACTOR-337 (no `@ActivityLog`) — the upsert path has three latent integrity gaps in one method body.

**Severity rationale**: MEDIUM — write-side data-quality bug; the platform commits to a type system at the schema and OpenAPI layers but enforces it nowhere. Downstream readers / BI tools must defend against arbitrary content. Not HIGH because the gap is operator-trap-shaped (a careful operator notices and adapts) rather than a security gap; the value is stored verbatim, not interpreted.

**Suggested backlog grouping**: `Custom-metadata hardening sprint` (group with REFACTOR-333, REFACTOR-334, REFACTOR-336, REFACTOR-337 — five related gaps on the same method).

---
