---
doc_page: "docs/configuration-and-deployment/trylocally.md"
page_title: "Try locally"
live_url: "https://docs.opendatadiscovery.org/configuration-and-deployment/trylocally"
live_url_verified_status: "200"
live_url_resolved_slug: "configuration-and-deployment/trylocally"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "Collector"
    - "Collector Token"
    - "S2S Ingestion Pipeline"
    - "Ingestion Filter"
    - "Register Collector"
  features:
    - "F-020"
    - "F-031"
  code_nodes:
    - "odd-platform java CollectorController controller-method:registerCollector"
    - "odd-platform java IngestionController controller-method:postDataEntityList"
audience: [operator, developer]
doc_claim_vs_code:
  - "Step 2 (L44-58) frames the Collector token as a credential the operator must obtain ('Copy the token by clicking Copy') and wire into `docker/config/collector_config.yaml` under the `token` entry before the Collector can ingest — implying the token gates ingestion. Code shows the bundled demo stack ships ingestion UNAUTHENTICATED: `POST /ingestion/entities` (`IngestionController.java:37`) carries no authorization annotation and delegates auth ENTIRELY to the path-scoped `IngestionDataEntitiesFilter`, which is `@ConditionalOnProperty(\"auth.ingestion.filter.enabled\")` defaulting to `false` (entitie:ingestion-filter; entitie:s2s-ingestion-pipeline — `/ingestion/**` is whitelisted out of the UI auth chain in every mode AND the token filter is off by default). In the demo the pasted token is therefore decorative — any unauthenticated caller can POST to the local platform. Page-bounded: the page explicitly scopes itself to a demo sandbox and routes production to Deployment Options (L7), so this is a caveat, not a critical misstatement. DOC-GAP candidate: note that the demo does not enforce the token, and link the production hardening to `auth.ingestion.filter.enabled`."
maintainer_curated: false
---

# Try locally — doc understanding

This page is the operator-facing docker-compose quick-start: clone `odd-platform`, run `docker-compose -f docker/demo.yaml up -d odd-platform-enricher` to bring up the Platform + PostgreSQL + the metadata enricher (which injects a 10-data-source sample), then optionally create a Collector entity, copy its token into `docker/config/collector_config.yaml`, and run `odd-collector` to pull metadata from a real source. Live URL verified 200 at the guessed slug (no GitBook rewrite). Most of the page's mechanics are docker-compose / `docker/` demo-stack wiring that lives outside the enriched odd-platform Java/TS substrate (the `demo.yaml` compose file, the enricher image, `collector_config.yaml`), which is expected for a quick-start router page, not a substrate coverage gap.

What the page DOES bind into the substrate is the Collector-and-ingestion workflow. Step 2's "go to `/management/collectors` → Add collector → Save → copy token" maps to the Collector Lifecycle Management feature (F-020, whose `entry_point` is exactly `ui_route:/management/collectors`) and the `registerCollector` code node (`CollectorController.registerCollector`, which mints the Collector row + auto-issues the 40-char token confirmed via operation:register-collector). The token itself is the `Collector Token` concept. Step 1/Step 2 "Results" ("see 10 / 11 data sources in `/management/datasources`") map to the Data Source Lifecycle feature (F-031, `entry_point` `ui_route:/management/datasources`). The act both the enricher and the `odd-collector` perform — pushing the sample/real metadata into the catalog — is the `S2S Ingestion Pipeline` concept, whose canonical entry point is `IngestionController.postDataEntityList` (`POST /ingestion/entities`, `IngestionController.java:37`). The `Ingestion Filter` concept is bound because it is the token-auth gate the page implies but the demo leaves disabled (recorded as the single drift finding above).

## Maintainer notes
