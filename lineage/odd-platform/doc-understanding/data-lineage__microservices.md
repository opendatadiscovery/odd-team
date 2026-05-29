---
doc_page: "docs/data-lineage/microservices.md"
page_title: "Microservices Lineage"
live_url: "https://docs.opendatadiscovery.org/features/data-lineage/microservices"
live_url_verified_status: "200"
live_url_resolved_slug: "features/data-lineage/microservices"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts: ["Lineage Graph Traversal", "Traverse Lineage Graph (recursive-CTE)", "Data Entity"]
  features: ["F-054"]
  code_nodes:
    - "odd-platform java service service:LineageServiceImpl"
    - "odd-platform java DataEntityController controller-method:getDataEntityDownstreamLineage"
    - "odd-platform java repository reactive repository:ReactiveLineageRepositoryImpl"
audience: [operator, developer]
doc_claim_vs_code:
  - "Page claims microservice-specific OpenTelemetry fields (operation_name, span_kind, error_rate, p95_latency, callsPerMinute, service-call cardinality) are 'silently dropped at the response-DTO mapper' — CONFIRMED by code, not just doc assertion: getLineage's signature carries no EntityClass parameter and produces one class-agnostic DataEntityLineage shape for every class; the terminal projection is lineageMapper.mapLineageDto (LineageServiceImpl.java:121). No class-discriminated payload union exists. Evidence: F-054 facet microservice_specific_payload_fields_silently_dropped_at_response_dto_mapper (LineageGraph.md:182 bugs[7]; LineageMapper.mapLineageDto); node odd-platform java service service:LineageServiceImpl."
  - "Page's Access model claim — 'the platform's lineage repository does not perform an ownership-side filter on the read path' — CONFIRMED: getLineage resolves the root via reactiveDataEntityRepository.getDataEntityWithDataSourceAndNamespace (LineageServiceImpl.java:92) WITHOUT calling authIdentityProvider.fetchAssociatedOwner(); the recursive-CTE walk applies no owner filter at any layer (ReactiveLineageRepositoryImpl.java:122-176). This is the negative-case sibling of the anchor-set owner-scoping pattern. Evidence: odd-platform java service service:LineageServiceImpl finding:bugs_limitations_corner_cases (REFACTOR-203); odd-platform java repository reactive repository:ReactiveLineageRepositoryImpl."
  - "Page does NOT carry a DISABLED-mode caveat. The warning hint frames exposure as 'every authenticated catalog user', but under auth.type=DISABLED the upstream controller is unauthenticated and the same cross-owner microservice-topology read is reachable by any unauthenticated network probe (REFACTOR-185 inheritance through DataEntityController lineage methods). F-054 facet cross_owner_enumeration_amplified_on_microservices_class rates this HIGH because service-call operational data is more sensitive than schema lineage. Evidence: odd-platform java service service:LineageServiceImpl finding:security (auth_mode_relevance INTERNAL_ONLY; REFACTOR-185)."
  - "Page's 'Where to next' links the lineage API as 'the same lineage HTTP surface used for both data-object and microservice lineage' but does not warn that that surface carries an unimplemented documented default: the API-reference page states lineage_depth 'Unset returns the platform's default depth' which is UNIMPLEMENTED — a null Integer autoboxes to int and NPEs at LineageServiceImpl.java:96 (LineageDepth.of), and there is no @Max depth cap (DoS-amplification). This drift is inherited by the microservices page via the shared-surface claim. Evidence: odd-platform java DataEntityController controller-method:getDataEntityDownstreamLineage bugs_limitations_corner_cases.[0]; LineageServiceImpl.java:96."
maintainer_curated: false
---

# Microservices Lineage — doc understanding

This page documents how microservice-based applications surface in ODD: a microservice instrumented with OpenTelemetry emits traces; the standalone `odd-tracing-gateway` push adapter (an auxiliary integration, not odd-platform code) infers the service topology and ingests `MICROSERVICE`-class transformer entities plus their call edges through the Ingestion API; the platform then renders those nodes on the **same** lineage canvas as data-object lineage. The implementing read surface in this repo is the class-agnostic lineage chain — `DataEntityController.getDataEntityDownstreamLineage` (sibling `/upstream`) → `LineageServiceImpl.getLineage` (no EntityClass parameter; LineageServiceImpl.java:87-122) → the recursive-CTE walk in `ReactiveLineageRepositoryImpl` (java:122-176). The page maps cleanly to feature **F-054**, the product-owner reflection that already traced this surface end-to-end.

The page (as of `../documentation` HEAD `30795b4`) has been rewritten to **align with the code rather than over-promise**: it explicitly states microservices use the same UI surface, that OTel-specific per-call fields are silently dropped at the response-DTO mapper, and (in the Access model / warning hint) that the read path has no ownership-side filter and exposes operational topology. This narrows F-054's original `doc_promises_distinct_surface` drift framing — most of that facet is now satisfied by the page text. The bindings above are confirmed via `graph-node`: F-054 (exact feature match), the three concept names verbatim from `concepts.yaml`, and the three lineage code nodes via Sidecar search.

The residual drift findings recorded above are not contradictions the page introduces; they are caveats the code makes operator-critical that the page either confirms (the silent-drop and no-owner-filter claims — now grounded in code, a strength) or still omits (the DISABLED-mode reachability of this cross-owner topology read, and the inherited `lineage_depth` null-default NPE / no-depth-cap drift carried by the shared lineage HTTP surface). These are DOC-GAP candidates for the maintainer to triage; the access-model exposure narrative on this page is otherwise notably well-aligned with REFACTOR-203 / F-054.

## Maintainer notes
