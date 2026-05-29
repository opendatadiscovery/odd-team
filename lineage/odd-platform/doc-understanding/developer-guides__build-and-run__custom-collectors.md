---
doc_page: "docs/developer-guides/build-and-run/custom-collectors.md"
page_title: "Build a custom collector"
live_url: "https://docs.opendatadiscovery.org/developer-guides/build-and-run/custom-collectors"
live_url_verified_status: "200"
live_url_resolved_slug: "developer-guides/build-and-run/custom-collectors"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "operation:register-data-source-from-collector-s2s"
    - "operation:ingest-data-entity-list-s2s"
    - "entitie:s2s-ingestion-pipeline"
    - "entitie:oddrn"
  features:
    - "F-008"   # S2S ingestion / data-source registration surface (POST /ingestion/entities + /ingestion/datasources)
    - "F-096"   # Ingestion batch atomicity & error contract on POST /ingestion/entities
    - "F-020"   # Collector lifecycle — the Collector entity + token the page tells the operator to create
  code_nodes:
    - "odd-platform java IngestionController controller-method:createDataSource"     # POST /ingestion/datasources
    - "odd-platform java IngestionController controller-method:postDataEntityList"   # POST /ingestion/entities
audience: [developer, operator]
doc_claim_vs_code:
  - "Page (End-to-end skeleton, custom-collectors.md:368) claims the skeleton collector 'sends an empty DataEntityList every 10 minutes' and 'starts cleanly' — but the platform's POST /ingestion/entities handler REJECTS an empty payload: postDataEntityList filters on CollectionUtils.isNotEmpty(del.getItems()) and switchIfEmpty raises BadUserRequestException(\"Ingestion payload is empty\") → HTTP 400. A reader who runs the skeleton verbatim will see a 400 per cycle, not the clean run the page promises. Evidence: odd-platform java IngestionController controller-method:postDataEntityList / odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/IngestionController.java:41-42."
  - "Page (Testing locally + Anatomy) frames data-source registration as automatic on startup and the skeleton as 'starts cleanly', but never states that POST /ingestion/datasources requires the collector token to resolve to a Collector session: createDataSource reads SessionConstants.COLLECTOR_ID_SESSION_KEY from the WebSession and throws IllegalStateException(\"Collector id is null\") (surfacing as HTTP 5xx, not 401) when it is absent — e.g. a wrong/unregistered token, or a non-sticky cluster where the second request lands on another instance. The page's only auth note is the generic PlatformApiError bullet. Evidence: odd-platform java IngestionController controller-method:createDataSource / odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/IngestionController.java:48-54 (cluster-fragility mechanism: F-008 batch X)."
  - "Page never states the success status for the two ingestion POSTs; the implementation returns HTTP 200 (ResponseEntity.ok()) for POST /ingestion/entities. F-096 records a spec-vs-impl drift (the ingestion contract declares 201 Created, impl returns 200), so a collector author who codes to a 201 expectation treats the 200 as an anomaly. The 201-side citation lives in the generated ingestion contract (org.opendatadiscovery.oddplatform.ingestion.contract.api.IngestionApi), which is NOT checked into odd-platform-specification/ in this checkout → NOT VERIFIED here; the impl side is verified. Evidence (impl): odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/IngestionController.java:44; F-096 observed_vs_expected facet spec_says_201_impl_returns_200."
  - "Page's troubleshooting (Testing locally) lists PlatformApiError on ingest_data generically (token / URL / TLS). F-096 documents that distinct CLIENT-error conditions on POST /ingestion/entities all surface as opaque 5xx with no per-item breakdown: duplicate ODDRN within a batch (Collectors.toMap default throwing merger → IllegalStateException), unknown data_source_oddrn (uncaught NotFoundException), and oversized payload (DataBufferLimitException). A custom-collector author cannot distinguish 'I sent malformed data' from 'the platform crashed' — a missing-caveat the page could surface. Evidence: odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/ingestion/IngestionServiceImpl.java:68,:86 (per F-096 scanner review SR-20260527T1700Z, fully-corroborated)."
maintainer_curated: false
---

# Build a custom collector — doc understanding

This developer guide teaches a Python developer to build a collector/adapter against the `odd-collector-sdk` (which lives in the `odd-collectors` repo, not `odd-platform`): the `Plugin`/`PluginFactory` config pattern, the three adapter contracts, the entry point, packaging, and ODDRN generation. Its **only contact surface with the odd-platform codebase** is the two server-to-server ingestion endpoints the SDK calls at runtime — `POST /ingestion/datasources` (register the data source) and `POST /ingestion/entities` (push the `DataEntityList`). Both bind to `IngestionController` (confirmed via graph-node): `createDataSource` at `IngestionController.java:48` and `postDataEntityList` at `IngestionController.java:38`, the s2s ingestion-pipeline concept cluster, and features F-008 (the destruction/auth surface), F-096 (the batch atomicity & error contract), and F-020 (the Collector entity + token the page tells the operator to mint).

The high-value drift is platform-contract behaviour the page's "happy path" framing hides: the skeleton's empty-`DataEntityList` claim is contradicted by the empty-payload rejection at `IngestionController.java:41-42` (HTTP 400), and the "starts cleanly" framing omits both the collector-session requirement on data-source registration (`IngestionController.java:48-54`, 5xx-not-401 when the token doesn't resolve) and the opaque-5xx error contract on entity ingestion (F-096). These are LSN-002-class missing caveats — an operator follows the guide and hits an error the page says will not happen.

## Maintainer notes
<!-- preserved across re-analysis; the only block a human hand-edits -->
