# SHB-127 — Collectors that mix a single bad entity into a 1000-entity payload lose the entire batch with a 5xx body-shape, no per-entity error report, no DLQ

**Category**: clustering
**Severity**: MEDIUM

## Hypothesis

Operators authoring custom collectors against the OpenAPI ingestion contract reasonably assume the response shape `POST /ingestion/entities` returns per-item status (200 with body OR 207 Multi-Status) — most modern batch-ingestion APIs do. The implementation is binary: ALL items in one `@ReactiveTransactional` transaction; one failing item (constraint violation, OOM in metadata processing, deadlock against a concurrent ingest) rolls back the entire batch + every downstream side-effect (FTS recompute, alert raising, OTLP export). The HTTP response is `Mono<ResponseEntity<Void>>` — no body shape on success OR on failure. A 5xx tells the collector author NOTHING about WHICH item failed; the application log on the platform side carries the discriminator. There is no DLQ, no async-accept (202) mode, no idempotency key, no partial-success contract.

## Evidence

- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/ingestion/IngestionServiceImpl.java:65-74` — `@ReactiveTransactional` on `ingest(...)`. The entire chain (datasource lookup → entity upsert → 14-processor chain → OTLP export) executes in ONE Postgres transaction; one failure anywhere rolls back EVERYTHING.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/ingestion/IngestionServiceImpl.java:83-86` — `Collectors.toMap(DataEntityIngestionDto::getOddrn, identity())` uses the default throwing merger. A payload with two items sharing the same ODDRN throws `IllegalStateException: Duplicate key` → 5xx, no per-item error report, no `(a,b)->a` merge function defending the choice.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/ingestion/IngestionController.java:38-45` — controller returns `Mono<ResponseEntity<Void>>` (`Void`, no body). A 5xx response carries only the default Spring reactive error-handler's payload (typically a generic `{"status":500,"error":"Internal Server Error","path":"/ingestion/entities"}` shape). No per-item error array.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/ingestion/IngestionServiceImpl.java:53` — `@Slf4j` annotation present; verified no `log.*` call in the file (per IngestionServiceImpl sidecar known_security_gaps[0]). Even DEBUG logging gives the operator no service-tier diagnostic on the destruction paths.
- `odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/BaseIngestionTest.java:74-80` — the test scaffold asserts `expectStatus().isOk()` (200). The 5xx-on-bad-batch case is NOT tested. The platform's contract for partial failure is invisible to the test suite.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/ingestion/IngestionServiceImpl.java:68` — `getIdByOddrnForUpdate` holds the `data_source` row lock for the FULL pipeline duration. Concurrent ingestions targeting the SAME datasource serialise on the lock; the loser may timeout (manifesting as the 5xx-no-detail body shape on the collector side).
- `odd-platform-specification/specification/odd_api.yaml:23-25` (per postDataEntityList sidecar) — declared response is `201 Created` (no body shape). The OpenAPI contract carries NO declared 4xx/5xx error response shape either.

## Notes

- The "no partial success" contract is intentional per `IngestionService.md:implicit_adrs[0]` — the maintainer chose the explicit `@ReactiveTransactional` annotation to make the boundary visible. The trade-off is operator-relevant but uncontentious for the inner architecture.
- The OPERATOR-FACING SYMPTOM that's not yet anchored as a feature:
  - **Custom-collector author authoring against the OpenAPI spec** has no machine-readable error shape to expect. They write retry-with-backoff logic blindly.
  - **Collector retry storms** — a collector that emits a problematic payload (e.g. one item with a too-long name) retries on 5xx, hits the same crash, retries again. The `data_source` row lock is held during each crash-pipeline, blocking concurrent collectors targeting the same datasource. No backoff signal; no DLQ to drain the bad payload into.
  - **Operations debugging** — an SRE looking at a collector's logs sees "ingest failed: HTTP 500" with no further info. They need platform-side access to the application log to find the actual exception. In multi-tenant deployments, the collector operator and the platform operator may be different teams.
- This is the SHAPE the operator EXPERIENCES regardless of what the architectural intent was. The implicit-ADR captures the intent; the FEATURE catalog needs the operator-symptom captured separately.
- Specific contract drifts that compound the operator pain:
  - **Spec-vs-impl response code drift** — spec says 201, impl says 200 (per postDataEntityList sidecar). Collector author following the spec expects 201; receives 200; may treat as anomaly.
  - **No 4xx contract for unknown `data_source_oddrn`** — surfaces as 5xx instead of 404 (per IngestionServiceImpl sibling). Collector author treats configuration error indistinguishably from transient platform crash.
  - **No 413 contract for oversized payload** — surfaces as 5xx (`DataBufferLimitException`) instead of 413 Payload Too Large. Collector author may not realise they need to split.
- This is `clustering`, not `open`: evidence is mature, the shape is verified at 6 file:line refs spanning service / controller / test / spec. The graduation gate is the maintainer's call: a standalone `F-NNN — Ingestion Batch Atomicity Contract` OR an enricher folded into F-008. Likely an F-NNN because the OPERATOR-VISIBLE CONTRACT (response shape, retry semantics, DLQ absence, per-item errors absence) is distinct from F-008's existing destruction-narrative.
- A 2-axis test matrix once promoted: (a) HTTP error shape per failure class — partial-success / unknown-datasource / oversize-body / duplicate-ODDRN-in-batch / constraint-violation-on-one-item / OTLP-down. (b) Concurrent-ingestion behaviour against the same datasource — serialisation latency, timeout, retry-storm.

## Next

1. Promote to `F-NNN — Ingestion Batch Atomicity & Error Contract` in pillar P-10. Test matrix per the 2 axes above; coverage estimate: ~5%.
2. ADR-NNN: formalise the "single-transaction-per-batch, no partial success, no DLQ" decision in `adrs/drafts/` so the spec-vs-impl response code drift can be resolved one way (currently undecided).
3. DOC-NNN: extend the live S2S doc page to enumerate the response codes a collector author can expect (200 OK, 5xx) and the body shape (`Void` / generic error). Document the "one bad item rolls back all" contract.
4. REFACTOR-NNN: change `Collectors.toMap` at IngestionServiceImpl.java:86 from the default throwing merger to a merger that throws `BadUserRequestException("Duplicate ODDRN in batch: {oddrn}")` → caller sees 400, not 500.
5. REFACTOR-NNN: add `@ExceptionHandler(NotFoundException)` returning 404 on the ingestion path so unknown-datasource is distinguishable from a real 5xx.

## Links

- cluster_with: [F-008]
- merged_into: (open — likely a new F-NNN)
- supersedes: []
