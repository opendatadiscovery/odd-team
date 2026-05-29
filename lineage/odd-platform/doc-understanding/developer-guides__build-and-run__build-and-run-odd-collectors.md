---
doc_page: "docs/developer-guides/build-and-run/build-and-run-odd-collectors.md"
page_title: "Build and run ODD Collectors"
live_url: "https://docs.opendatadiscovery.org/developer-guides/build-and-run/build-and-run-odd-collectors"
live_url_verified_status: "200"
live_url_resolved_slug: "developer-guides/build-and-run/build-and-run-odd-collectors"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: MEDIUM
describes:
  concepts:
    - "ODD Collector (runtime)"
    - "Collector"
    - "Collector Token"
  features:
    - "F-020"
  code_nodes:
    - "odd-platform java CollectorController controller-method:registerCollector"
audience: [developer, operator]
doc_claim_vs_code:
  - "Page §Configure ODD Collector / §Full configuration reference tells the operator to create a collector in the platform and copy its token into collector-config.yaml, but never warns that regenerating that token (the sibling operation on the same Management → Collectors surface the page links to) is an in-place UPDATE with NO grace window — in-flight ingestion using the old token 401s immediately and the collector must be reconfigured + restarted. LSN-002-class runtime caveat absent from the run-the-collector guide. Evidence: `odd-platform java CollectorController controller-method:regenerateCollectorToken` / TokenGeneratorImpl.java:44-52 (\"no rotation-grace window, no old/new pair … in-flight ingestion using the old token will 401 immediately\")."
  - "CROSS-REPO COVERAGE HOLE (not platform drift): the page's authoritative content — the `CollectorConfig` field table (`platform_host_url`, `token`, `default_pulling_interval`, `connection_timeout_seconds`=300, `chunk_size`=250, `misfire_grace_time`, `max_instances`=1, `verify_ssl`=true), `start.sh`, the per-adapter plugin shapes, and the build/poetry workflow — is collector-SDK code in the `odd-collectors` repo, which is NOT in the odd-platform graph. None of these defaults/claims is verifiable against this substrate. The only platform-side touchpoints are the token-issuance prerequisite (Register Collector → Collector Token) and the S2S push target (`platform_host_url` → POST /ingestion/entities). Verifying the config-table defaults requires enriching odd-collectors as its own substrate."
maintainer_curated: false
---

# Build and run ODD Collectors — doc understanding

This is a **developer guide for the collector runtime** (a different repo): how to build one of the four monorepo sub-collectors (`odd-collector` / `-aws` / `-gcp` / `-azure`) into a Docker image, install it with Poetry, point it at a local platform via `collector-config.yaml`, and run it with `start.sh`. Its load-bearing content — the `CollectorConfig` field reference and per-adapter plugin shapes — is **collector-SDK code in `odd-collectors`**, which this odd-platform substrate does not cover; that is a recorded cross-repo coverage hole, not platform drift.

The page touches the odd-platform boundary at exactly two points, both confirmed via `graph-node`: (1) the prerequisite "create a collector in the platform and copy the token" maps to the **Register Collector** operation (`CollectorController.registerCollector`, which mints the **Collector Token**) on the **Collector Lifecycle Management** surface (F-020); (2) `platform_host_url` + `token` make the collector — the **ODD Collector (runtime)** audience concept — push to the platform's S2S ingestion endpoint. The page references these as setup steps; it does not document the platform CRUD itself, so only `registerCollector` is bound on the code side (the other `/api/collectors/*` methods are deliberately omitted).

The one genuine caveat-gap with platform-side evidence: the run-the-collector guide never warns that token regeneration has **no grace window** (in-place `TOKEN` UPDATE; old token 401s in-flight immediately → reconfigure + restart required), evidenced by the `regenerateCollectorToken` sidecar / `TokenGeneratorImpl.java:44-52`. That caveat belongs on this runtime page.

## Maintainer notes
