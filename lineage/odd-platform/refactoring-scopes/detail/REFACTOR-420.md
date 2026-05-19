## REFACTOR-420 — `SessionConstants.COLLECTOR_ID_SESSION_KEY` is a non-`final` `public static String` (`"collectorId"`) — silent runtime breakage if rename refactor misses one of the two consumer sites

**Severity**: MEDIUM
**Category**: missing-compile-time-enforcement (substrate-fragility)
**Pillars affected**: [P-10-integrations-ingestion]
**Batch**: P (2026-05-20)

**Surfaced by**: `IngestionController__controller-method__createDataSourceEntity.md:dependencies_semantic.coupling.[2]` + `:concepts.invariants.[1]`

**Description**: `SessionConstants.java:4` declares `public static String COLLECTOR_ID_SESSION_KEY = "collectorId"` — NOT `final`. The filter writes via `getAttributes().put(SessionConstants.COLLECTOR_ID_SESSION_KEY, ...)`; the controller reads via `getAttribute(SessionConstants.COLLECTOR_ID_SESSION_KEY)`. A refactor that renames the constant in only one of the two files silently desyncs the contract; a misspelling in the controller throws `IllegalStateException("Collector id is null")` at runtime, NOT at compile-time. The `String` is also mutable (non-final); a misbehaving extension could reassign it at runtime, breaking every session bridge.

**Primary source citations**:
- `SessionConstants.java:1-5`
- `IngestionDataSourceFilter.java:8, 37`
- `IngestionController.java:8, 52`

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-141 NEW (batch P) codifies the WebSession-attribute architecture; this scope is a hardening detail.

**Proposed remedy**: Make the field `public static final String` AND consider promoting to a type-safe enum (`SessionAttributeKey.COLLECTOR_ID`) with a stable string projection. Add a static-analysis check (Spotbugs / Sonar rule) catching mutable `static` fields.

**Severity rationale**: MEDIUM — substrate-fragility; not currently producing bugs; matters at refactor time.

**Suggested backlog grouping**: `Type-safety hardening sprint` (low-risk static-analysis fixes).

---
