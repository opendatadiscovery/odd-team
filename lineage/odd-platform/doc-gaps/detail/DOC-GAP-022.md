- **DOC-GAP-022**: Pagination `size` parameter is unbounded at spec + controller layers — undocumented runtime cap
  - **Category**: drift
  - **Surfaced by**: `concepts.yaml:invariants[Pagination unconstrained]`; multiple sidecars (alert, dataEntity, AlertController.getAllAlerts, ActivityController.getActivity).
  - **Evidence**: spec encodes `size` as int32 with no min/max; `size=2147483647` permissible.
  - **Proposed doc action**: Add "Pagination" section to `developer-guides/api-reference.md` noting unbounded `size` + conservative values guidance.
  - **Cross-references**: DOC-GAP-018.
  - **Severity rationale**: MEDIUM.

## Batch ZB append

#### Batch 2026-05-21-ZB STRENGTHENS — `GET /api/datasources` is a NEW unbounded-`size` instance with a controller-method PRIMARY SOURCE; the unbounded read additionally drives 2 LEFT JOINs into one in-memory list

Batch ZB's `getDataSourceList` controller-method sidecar adds `GET /api/datasources?page=&size=&query=` as a fresh instance of the platform-wide unbounded-`size` pattern DOC-GAP-022 catalogs, with controller-method + repository + OpenAPI-spec evidence at one commit (80637ed).

- **NEW surfaced_by (batch ZB)**:
  - `odd-platform__java__DataSourceController__controller-method__getDataSourceList.md:bugs_limitations_corner_cases.[4]` — verbatim: "`size` has no upper bound — the OpenAPI SizeParam declares no `maximum`; the value flows unclamped into SQL `LIMIT`. A caller can request the entire catalog (incl. 2 LEFT JOINs) in one query." (severity LOW per sidecar — catalog-size-dependent)
  - `getDataSourceList.md:docs_link_semantic.doc_drift_findings.[2]` — "The management doc page is SILENT on pagination and on any `size` limit. The OpenAPI SizeParam has no `maximum` (components.yaml:4222-4229); the endpoint accepts arbitrarily large `size` with no clamp. Documented-feature gap."
  - `getDataSourceList.md:performance.known_performance_gaps.[0]` — "`size` has no upper bound — at a very large catalog a single oversized request degrades response time and memory; no clamp, no default ceiling."
  - `getDataSourceList.md:stress_findings.tunables[size]` + `:stress_findings.request_inputs[size]` — probe P-037 ("Is `size` unbounded (size=Integer.MAX_VALUE accepted), and what is the size=0 / negative-size / page=0 boundary behaviour?").

- **NEW evidence (batch ZB)**:
  - Code anchors: `components.yaml:4222-4229` (SizeParam — `int32, required, NO minimum, NO maximum`) + `DataSourceController.java:22-26` (no clamp at the controller) + `ReactiveDataSourceRepositoryImpl.java:62` (`size` → `jooqQueryHelper.paginate(homogeneousQuery, (page-1)*size, size)` → SQL `LIMIT <size>`).
  - The ZB sidecar adds a dimension not present in the original DOC-GAP-022 framing: at `GET /api/datasources` the unbounded `size` materialises the entire `data_source` table PLUS 2 LEFT JOINs (against `NAMESPACE` and `TOKEN`) into one in-memory list — `jooqReactiveOperations.flux(query).collectList()` at `ReactiveDataSourceRepositoryImpl.java:75-76` — before mapping. `size=Integer.MAX_VALUE` emits `LIMIT 2147483647`. So the unbounded-`size` cost on this endpoint is not just a large result page but a 2-join in-memory collection — an unbounded-response surface.
  - WebFetch `https://docs.opendatadiscovery.org/features/management` 2026-05-21 status 200 (DIRECT this session) — probed specifically: the page "does not mention pagination, page size, or any limit on the number of data sources displayed."
  - The ZB sidecar also records `size=0` / negative `size` / `page=0` as statically-undetermined boundary behaviour (`LIMIT 0`, negative `LIMIT`, negative `OFFSET` — failure mode not statically determinable; pinned by P-037) — a corner case the DOC-GAP-022 pagination section should also name.

- **Coherence (LSN-018 Rule 6 pre-emit)**: no cross-registry contradiction — the unbounded-`size` pattern is consistent across the controller sidecars DOC-GAP-022 already lists; the ZB instance is additive (same polarity). No CONTRADICTS, no SUPERSEDES.

- **Severity stays MEDIUM** at the doc-gap level (the proposed "Pagination" section on `developer-guides/api-reference.md` covers the whole class; the per-endpoint instance is LOW on its own per the ZB sidecar). The DOC-GAP-022 proposed doc action is unchanged; the ZB contribution is one more enumerated endpoint + the 2-LEFT-JOIN-in-memory-collection refinement + the `size=0`/negative-`size`/`page=0` boundary note.

- **Cross-reference additions**: DOC-GAP-018 (existing) + DOC-GAP-009 (the `developer-guides/api-reference` hub does not document the DataSource operations — `GET /api/datasources` and its unbounded `size` have no API-reference home; the planned Pagination section and the missing DataSource sub-page are the same doc-hub gap).
