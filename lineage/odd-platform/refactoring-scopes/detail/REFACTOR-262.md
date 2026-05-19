## REFACTOR-262 — Ingestion all-or-nothing transactional rollback returns 5xx with no body shape — no partial-success response, no entity-level error detail, debugging requires log access

**Severity**: MEDIUM
**Category**: error-mapping + missing-error-detail
**Surfaced by**:
- `IngestionService.md:bugs_limitations_corner_cases[5]`
- `IngestionService.md:security.data_exposure[3]` ("a failing ingest returns a 5xx with no body shape (`Mono<Void>`), so callers cannot distinguish 'unknown datasource' from 'constraint violation' from 'metadata parser failure' from 'OTLP export error'")

**Description**: `IngestionServiceImpl.ingest` (line 66) is `@ReactiveTransactional` — the entire 3-phase processor chain (per ADR-CANDIDATE-079) runs in ONE transaction. A constraint violation, metadata parser failure, OTLP export error, or any other exception in any of the 14 processors aborts the WHOLE transaction and surfaces as HTTP 5xx.

The controller method `IngestionController.postDataEntityList` returns `Mono<ResponseEntity<Void>>` (per `IngestionController.java:38-45`) — VOID body, no error detail. The collector receives:
- HTTP 5xx (typically 500).
- Empty response body.
- No indication WHICH entity in the 1000-entity payload failed.
- No discriminator between "unknown datasource" (404-shaped), "duplicate ODDRN constraint" (400-shaped), "metadata parser failure" (400-shaped), "OTLP export error" (server-side, transient).

Debugging requires:
- Application log access (collector operators typically don't have this).
- Operators correlate timestamps from the collector run with platform logs.
- Operators read stack traces to determine the failing entity.

The architectural alternatives the maintainer rejected:
- **(alt1)** HTTP 207 Multi-Status with per-entity result array: the standard for batch APIs (RFC 4918). Each entity gets a status code; the response body enumerates success/failure per entity. Requires per-entity isolation (no single transaction for all).
- **(alt2)** HTTP 400 with structured error body: `{"error": "VALIDATION_FAILED", "details": [{"index": 500, "oddrn": "...", "reason": "..."}]}`. Single transaction is preserved (still all-or-nothing) but the error response carries the discriminator.
- **(alt3)** Per-entity transactions with batch coordination: more complex; allows partial success but adds N transactions per batch.

The maintainer chose: single transaction + void response. The single-transaction-per-batch choice IS in ADR-CANDIDATE-067 territory (the @ReactiveTransactional family) and is intentional. The empty-response choice is the gap — no rationale defends "we don't tell the collector which entity failed."

**Primary source citations**:
- `IngestionServiceImpl.java:66` — `@ReactiveTransactional`
- `IngestionController.java:38-45` — `Mono<ResponseEntity<Void>>` return type
- `IngestionService.java:8` — interface returns `Mono<Void>` (no error surface)
- composes with ADR-CANDIDATE-079 (3-phase chain runs in one txn)
- composes with REFACTOR-215 (Unknown data_source_oddrn returns 5xx not 404)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-079 codifies the single-transaction-per-batch. The gap is the error-response shape — the ADR's transactional choice does not require the void response. The fix is refactoring within the existing transactional model (alt2: structured error body) without changing the transaction semantics.

**Proposed remedy**: Two composable fixes (paired with REFACTOR-215):
1. **Structured error response body**: replace `Mono<ResponseEntity<Void>>` with `Mono<ResponseEntity<IngestionResult>>` where `IngestionResult` carries:
   ```json
   {
     "status": "FAILED",
     "errorType": "CONSTRAINT_VIOLATION | UNKNOWN_DATASOURCE | METADATA_PARSE_ERROR | OTLP_EXPORT_ERROR | INTERNAL",
     "message": "<human-readable>",
     "failingEntity": {"index": 500, "oddrn": "//..."}  // when single-entity isolatable
   }
   ```
2. **Per-error mapping at the WebFlux exception handler**: define handlers that translate the typed exception (NotFoundException → 404 + UNKNOWN_DATASOURCE; UniqueConstraintException → 400 + CONSTRAINT_VIOLATION; MetadataParserException → 400 + METADATA_PARSE_ERROR; etc.) into the structured response.

The transaction semantics stay all-or-nothing (per ADR-CANDIDATE-079); only the error reporting is enriched.

**Severity rationale**: MEDIUM — operator pain (debugging collector failures requires log access) + collector-author pain (no programmatic error discrimination). Not a correctness issue; the platform's data integrity is unaffected.

**Suggested backlog grouping**: `Ingestion observability sprint` — pair with REFACTOR-215, REFACTOR-258, REFACTOR-259. Error-response hygiene + observability are the same cluster.

---
