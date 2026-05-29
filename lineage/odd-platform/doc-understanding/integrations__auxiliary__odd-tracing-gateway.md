---
doc_page: "docs/integrations/auxiliary/odd-tracing-gateway.md"
page_title: "odd-tracing-gateway"
live_url: "https://docs.opendatadiscovery.org/integrations/integrations/odd-tracing-gateway"
live_url_verified_status: "200"
live_url_resolved_slug: "integrations/integrations/odd-tracing-gateway"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts: []
  features: ["F-054"]
  code_nodes: ["odd-platform java IngestionController controller-method:postDataEntityList"]
audience: [operator, developer]
doc_claim_vs_code:
  - "LIVE-URL SLUG DRIFT (mechanical guess wrong): doc-nodes.jsonl live_url is https://docs.opendatadiscovery.org/integrations/auxiliary/odd-tracing-gateway (404). GitBook flattens the source subfolder `auxiliary/` and serves the page at integrations/integrations/odd-tracing-gateway (verified 200, 2026-05-29). Evidence: WebFetch of the guess → 'Page Not Found'; WebFetch of the resolved slug → 200, H1 'odd-tracing-gateway', first sentence matches local markdown. NOT a content drift — the page renders correctly; the mechanical live_url projection is wrong. SYSTEMIC: the same `integrations/<subfolder>/<page>` → `integrations/integrations/<page>` rewrite applies to EVERY integrations page (control check: integrations/push-adapters/odd-spark-adapter → 404, GitBook suggests integrations/integrations/odd-spark-adapter). doc-gap-finder candidate: correct the live_url derivation for all docs/integrations/**/*.md rows."
  - "CROSS-REPO (not drift, recorded for honesty): this page documents the odd-tracing-gateway repo (opendatadiscovery/odd-tracing-gateway), NOT odd-platform. The gateway's resolvers/processors/Redis-cache/GET-entities surface have no node in the odd-platform substrate — they live in a separate Java service. None of the page's gateway-internal claims (resolver chain, SpanProcessor types, Redis cache, OTLP :9090 receiver, GET /entities :8080) are checkable against this repo's graph. They are cited inline to the gateway source on GitHub by the page itself."
  - "PLATFORM-LEG CLAIM CONFIRMED (not drift): the page's data-flow diagram (lines 53-62) routes gateway entities Platform-ward via a pull collector → `POST /ingestion/entities` → PostgreSQL, and the page corrects the historical 'gateway transfers metadata to the Platform' framing by stating the gateway does NOT call /ingestion/entities itself. Confirmed against odd-platform: `POST /ingestion/entities` is the real S2S ingestion entry point — node `odd-platform java IngestionController controller-method:postDataEntityList` (IngestionController.java:37) accepts a `DataEntityList` from collectors and writes to Postgres. The page is accurate about the Platform leg; no contradiction found."
maintainer_curated: false
---

# odd-tracing-gateway — doc understanding

This page is the operator + developer reference for `odd-tracing-gateway`, an **optional standalone Java service in a separate repo** (`opendatadiscovery/odd-tracing-gateway`) that infers ODD Data Entities from OpenTelemetry distributed traces and exposes them through the standard adapter-contract `GET /entities` endpoint for an ODD pull collector to read. Because the gateway is its own service, its internals (the `ServiceNameResolver` chain, the per-instrumentation `SpanProcessor` types, the Redis cache, the OTLP/gRPC `:9090` receiver, the `:8080` entities surface) have **no counterpart node in the odd-platform substrate** — the page cites them inline to the gateway's GitHub source, and this analysis cannot confirm them against this repo. `describes.concepts` is therefore empty-but-honest rather than padded with the Platform's own datasource/lineage concepts, which this page does not document.

The page binds to the odd-platform substrate at exactly one architectural seam: the **Platform-pulls leg**. Its data-flow diagram routes the gateway's inferred entities Platform-ward through a pull collector that `POST`s to `/ingestion/entities`, landing them in PostgreSQL — the same path every collector uses. That endpoint is the confirmed code node `odd-platform java IngestionController controller-method:postDataEntityList` (`IngestionController.java:37`, the S2S `DataEntityList` ingestion entry point). The page's correction of the legacy "gateway transfers metadata to the Platform" framing — stating the gateway does **not** itself call `/ingestion/entities` — is consistent with that node (the gateway is a pull source; the collector is the caller). The page is also the operator-facing surface of the **microservices-lineage** feature `F-054` (microservices land in the catalog as dataset/service entities rendered by the class-agnostic lineage canvas).

The one substrate-grade finding is a **live-URL slug drift in the mechanical layer**, not a content defect: the `doc-nodes.jsonl` `live_url` guess (`.../integrations/auxiliary/odd-tracing-gateway`) 404s because GitBook flattens the `auxiliary/` source subfolder and serves the page at `.../integrations/integrations/odd-tracing-gateway` (verified 200). A control check on a sibling (`odd-spark-adapter`) shows the rewrite is systemic across every `docs/integrations/**` page — a doc-gap-finder candidate to fix the `live_url` derivation, recorded in `doc_claim_vs_code` above.

## Maintainer notes
