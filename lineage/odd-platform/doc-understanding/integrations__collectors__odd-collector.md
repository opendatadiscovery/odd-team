---
doc_page: "docs/integrations/collectors/odd-collector.md"
page_title: "odd-collector (generic)"
live_url: "https://docs.opendatadiscovery.org/integrations/integrations/odd-collector"
live_url_verified_status: "200"
live_url_resolved_slug: "integrations/integrations/odd-collector"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts: ["Collector", "Collector Token", "ODD Collector (runtime)"]
  features: []
  code_nodes: []
audience: [operator]
doc_claim_vs_code:
  - "Page introduces the collector-level `token: <COLLECTOR_TOKEN>` field (L83) as a static config value and delegates token lifecycle entirely to the hub, with no caveat that rotation has NO grace window. Code: `regenerateCollectorToken` rewrites the token in-place (CollectorController.java:48 → TokenGenerator.regenerate), and the S2S auth filter compares with literal `.equals(token)` (IngestionDataEntitiesFilter.java:56), so every running collector starts getting auth failures the instant an admin regenerates — operator-critical (LSN-001/002 class). Evidence: operation:regenerate-collector-token; entitie:collector-token. Low severity here (the page legitimately points token mechanics elsewhere) — the missing caveat belongs on the hub / build-and-run config-reference target, not necessarily this adapter-reference page."
maintainer_curated: false
---

# odd-collector (generic) — doc understanding

This is the operator-facing reference for the general-purpose pull collector: it
catalogues the 41 adapters registered in `odd_collector/domain/plugin.py`
(`PLUGIN_FACTORY`), gives a minimal `collector_config.yaml`, three deep-dive
spotlights (PostgreSQL / Snowflake / Kafka), a per-field config table for the
remaining 38 adapters, a cross-adapter feature matrix, and a Known-limitations
section. It binds to the three platform-side concepts the collector *interacts
with*: it deploys the **Collector** (`entitie:collector` — container of pull
adapters + runtime, authenticated by a shared-secret bearer token), it configures
the **Collector Token** (`entitie:collector-token` — the 40-char token its
`token:` field carries, compared S2S via `IngestionDataEntitiesFilter`), and it
is the guide for the **ODD Collector (runtime)** audience
(`audience:odd-collector-runtime` — the deployed container that consumes the
token and runs the scheduled pulls).

The page deliberately delegates the shared top-level config schema and token /
datasource registration to the [Integrations hub] and [Build and run ODD
Collectors] pages; its own scope is the `plugins[*]` shape. The bulk of its
factual content (the Pydantic plugin models, the per-adapter fields, the
`config_examples/*.yaml`) lives in the cross-repo `odd-collectors` repository,
which the odd-platform substrate has not enriched — so only the three
platform-touching concepts are bound here, and no `F-NNN` / odd-platform
`CodeNode` is a genuine subject of this page (the platform-side collector-admin
operations `register-collector` / `regenerate-collector-token` and the S2S
`register-data-source-from-collector-s2s` are documented on the hub /
management surfaces, not on this adapter-config page).

Live-URL note: the mechanical guess `/integrations/collectors/odd-collector`
404s, as does the title-derived `/integrations/collectors/odd-collector-generic`.
GitBook serves this page (and its siblings) under a **doubled** segment —
`/integrations/integrations/odd-collector` — because the `## Integrations`
SUMMARY divider and the `integrations/` directory each contribute a path
segment. Verified 200 with the `supported-adapters` anchor present and the meta
description matching frontmatter (raw-HTML check).

## Maintainer notes
