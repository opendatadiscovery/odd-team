## ADR-CANDIDATE-138 — Body-buffered-BEFORE-auth at `IngestionDataEntitiesFilter` is STRUCTURAL — the Ingestion API contract embeds the datasource identity in the payload (`dataSourceOddrn`), NOT in a header; the filter cannot authenticate without parsing the body first. The trade-off is per-request heap pressure + DoS amplification; the alternative requires breaking the Ingestion API wire contract

**Severity**: HIGH
**Classification**: promote
**Pillars affected**: [P-09-security-access-control, P-10-integrations-ingestion]
**Support count**: 1 sidecar (batch O IngestionDataEntitiesFilter — class-level layer; the companion config-key-consumer sidecar from batch B already established the annotation-layer)
**Axes present**: filters
**Batch**: O (2026-05-19)

**Surfaced by**:
- `IngestionDataEntitiesFilter.md:implicit_adrs.[2]` (HIGH) — "Body-buffered-before-auth: the filter reads the entire request body (up to 20MB) before checking the token, because the datasource identity is in the body, not in a header" — evidence: IngestionDataEntitiesFilter.java:37-44 (`super.getBody().collectList().flatMapMany(dataBuffer -> { final DataEntityList body = readBody(dataBuffer, DataEntityList.class); final String token = resolveToken(exchange.getRequest()); return dataSourceRepository.getDtoByOddrn(body.getDataSourceOddrn())...`) + application.yml:14-15 (`spring.codec.max-in-memory-size: 20MB`) + AbstractIngestionFilter.java:53-64 (`readBody` materialises the entire `List<DataBuffer>` into a byte array in heap) — intent_anchor: "the ordering is structural — `getDataSourceOddrn()` is a body field, not a header, so the platform cannot route to the correct token without parsing the body. The design choice was to embed the datasource identity in the payload (the Ingestion API contract owns this), which forces the filter to materialise + parse before authenticating. A protocol redesign (e.g. requiring `X-Datasource-Oddrn` header) would let the filter authenticate without body materialisation; that redesign would break the Ingestion API contract."

**Decision statement**: ODD's `IngestionDataEntitiesFilter` is FORCED to BUFFER + JACKSON-PARSE the entire request body (up to `spring.codec.max-in-memory-size: 20MB`) BEFORE checking the bearer token, because:

- The **Ingestion API wire contract embeds the datasource identity in the payload body**, not in an HTTP header. The `DataEntityList` payload's top-level `dataSourceOddrn` field (`opendatadiscovery-specification` repo) is the routing key the platform needs to look up the per-datasource token in the `TOKEN` table.
- The bearer token comparison at `IngestionDataEntitiesFilter.java:56` requires the resolved datasource's token (or, on fallback, the parent collector's token). The filter cannot resolve which token to compare against without first knowing `dataSourceOddrn`.
- Therefore the filter's reactor pipeline at `IngestionDataEntitiesFilter.java:37-44` is structurally: (1) `super.getBody().collectList()` — materialise the entire byte stream into a `List<DataBuffer>`; (2) `readBody(dataBuffer, DataEntityList.class)` — Jackson-parse to extract `dataSourceOddrn`; (3) `resolveToken(exchange.getRequest())` — extract the Authorization Bearer header; (4) `dataSourceRepository.getDtoByOddrn(body.getDataSourceOddrn())` — look up the datasource's token row; (5) compare via `String.equals(...)` at line 56; (6) re-emit the buffered bytes to the controller for re-parsing.

The architectural choices encoded:

- **(a) Body-first ordering is FORCED by the Ingestion API wire contract** — embedding `dataSourceOddrn` in the body is a deliberate ODD-Specification design choice. The Ingestion API was designed for "one collector reports many datasources' entities in one HTTP request" — the collector posts a single DataEntityList containing entities across multiple datasources, with the top-level `dataSourceOddrn` being the bulk owner. A header-based routing would force one POST per datasource (operational regression for high-volume collectors).
- **(b) The trade-off is heap pressure + DoS amplification** — an attacker submitting 20MB invalid-token requests forces the platform to allocate + Jackson-parse before token rejection. Repeated bad requests can saturate heap. The platform has no rate-limit, no concurrent-request cap, no per-IP throttle — REFACTOR-412 captures the DoS surface.
- **(c) Body is parsed TWICE per request** — the filter parses to extract `dataSourceOddrn`; the controller re-parses the same payload to `Mono<DataEntityList>` via the OpenAPI-generated `IngestionApi` deserialisation. The filter cannot avoid the duplicate parse because the buffered DataBuffers are re-emitted unchanged via `flatMapIterable(ignored -> dataBuffer)` at line 60. The performance cost (~half of per-request parse CPU) is the price — REFACTOR-416 captures the gap.
- **(d) A protocol redesign would break the Ingestion API contract** — moving `dataSourceOddrn` to a header (e.g., `X-Datasource-Oddrn`) would let the filter authenticate without body materialisation. But this would break every existing collector (odd-collector + odd-collector-aws + odd-collector-azure + odd-collector-gcp + 41 pull adapters) PLUS every push adapter (odd-airflow-2 + odd-dbt + odd-spark-adapter + odd-great-expectations + odd-cli + odd-tracing-gateway) — a wire-contract break. The maintainer accepted the body-buffer cost rather than break the contract.
- **(e) The cost is bounded** — `spring.codec.max-in-memory-size: 20MB` (application.yml:14-15) caps per-request memory; Reactor's reactive backpressure handles concurrent requests; no in-memory state accumulates across requests. The DoS surface is amplification, not unbounded growth.

**Wisdom test**: PASS on all three questions.
1. **Intentional?** YES — the body-first ordering is structurally forced by the API contract. The maintainer's intent is preserved in the `super.getBody().collectList().flatMapMany(...)` pipeline shape — the body materialisation is the FIRST step, NOT a step that could be reordered. The wire contract was designed with body-embedded routing in mind; the filter reflects that.
2. **Structural impact?** YES — affects every ingestion request's per-request heap cost; affects the DoS amplification surface; affects future protocol versioning (any "Ingestion API v2" that wants header-based routing must contend with the existing body-embedded `dataSourceOddrn`); affects the per-batch parse-cost-tax that scales with payload size.
3. **Switching to header-based routing is REFACTORING or STRUCTURAL?** STRUCTURAL — a protocol redesign would require: (i) `opendatadiscovery-specification` v2 with header-based routing; (ii) breaking-change migration for every collector + adapter; (iii) per-version filter logic in `IngestionDataEntitiesFilter` to support both body-routing (v1) and header-routing (v2); (iv) operator coordination across deployments. A multi-quarter project, not a refactor.

**Evidence**:
- IngestionDataEntitiesFilter.java:37-44 (the body-first pipeline — `super.getBody().collectList().flatMapMany(dataBuffer -> readBody(dataBuffer, DataEntityList.class) → resolveToken → dataSourceRepository.getDtoByOddrn(body.getDataSourceOddrn())`)
- IngestionDataEntitiesFilter.java:56 (the token comparison — requires the datasource's row, which requires the body's `dataSourceOddrn`)
- IngestionDataEntitiesFilter.java:60 (the body re-emit via `flatMapIterable(ignored -> dataBuffer)` — the controller re-parses)
- IngestionController.java:38-44 (the controller's re-parse via the generated `IngestionApi` deserialisation)
- AbstractIngestionFilter.java:53-64 (the shared `readBody` helper — materialises List<DataBuffer> into byte array in heap)
- application.yml:14-15 (`spring.codec.max-in-memory-size: 20MB` — the per-request cap)
- opendatadiscovery-specification repo (DataEntityList contract — `dataSourceOddrn` is a top-level field, NOT a header)

**Existing ADR**: none. **Composes with ADR-CANDIDATE-027** (ingestion-token opt-in via filter — this ADR specifies the WHY of the body-first ordering within that filter). **Composes with ADR-CANDIDATE-017** (plaintext-equality shared-secret stance — the body-buffered token comparison uses the plaintext-equality model). **Composes with ADR-CANDIDATE-139** (ingestion filter is the SOLE defender — body-first ordering is the price the SOLE defender pays).

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-412 NEW — IngestionDataEntitiesFilter body-buffered DoS amplification (MEDIUM)
- REFACTOR-416 NEW — IngestionDataEntitiesFilter duplicate body parse (filter + controller) (MEDIUM)
- REFACTOR-418 NEW — IngestionDataEntitiesFilter no token cache (per-request DB hit) (MEDIUM)

**Proposed action**: Promote to `adrs/drafts/ingestion-body-buffered-before-auth.md` (new ADR). Document:
- The body-first ordering as structurally forced by the Ingestion API wire contract.
- The trade-off explicit: heap pressure + DoS amplification accepted vs. breaking the wire contract.
- The duplicate parse cost as part of the design (filter + controller both deserialise).
- The cap (20MB) as the bounded mitigation.
- The maintainer-extension contract: any future Ingestion API version must decide whether to retain body-embedded routing OR break-and-redesign; the cost-benefit is captured here.

**Severity rationale**: HIGH — protocol-architecture decision. Affects every ingestion request's performance profile + DoS surface; affects future protocol versioning; affects the operator's runtime resource sizing (heap, GC, connection-pool). The wire-contract dependency is the load-bearing element; future maintainers must understand it to evaluate protocol-version proposals.

---
