---
doc_page: "docs/integrations/push-adapters/odd-great-expectations.md"
page_title: "odd-great-expectations"
live_url: "https://docs.opendatadiscovery.org/integrations/integrations/odd-great-expectations"
live_url_verified_status: "200"
live_url_resolved_slug: "/integrations/integrations/odd-great-expectations"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "Collector Token"
    - "Ingest Data Entity List (S2S)"
    - "Register Data Source from Collector (S2S, upsert by ODDRN)"
    - "Data Quality Test"
    - "Data Quality Dashboard (catalog-wide aggregate quality view)"
  features: []
  code_nodes: []
audience: [operator, developer]
doc_claim_vs_code:
  - "Page presents `platform_token` as a required action field (Configuration table: 'Collector token issued by the platform') and the prose implies the push is authenticated. On the PLATFORM side the receiving endpoint `POST /ingestion/entities` is gated EXCLUSIVELY by `IngestionDataEntitiesFilter`, which is OFF by default (`auth.ingestion.filter.enabled` defaults FALSE) — a bundled deployment ingests these GE results UNAUTHENTICATED, so a wrong/blank token is silently accepted. The page does not surface that the token is only verified when the operator has opted ingestion-token verification in. Evidence: operation:ingest-data-entity-list-s2s / concepts/detail/operations/ingest-data-entity-list-s2s.yaml:1; corroborated by concept 'Collector Token' / concepts.yaml:1809. Caveat-class (cross-repo): the GE adapter itself always sends the token; the gap is platform-side enforcement the page does not mention."
maintainer_curated: false
---

# odd-great-expectations — doc understanding

This page is a **cross-repo push-adapter** guide: the adapter code lives in `opendatadiscovery/odd-great-expectations` (a GE `ValidationAction` named `ODDAction`), not in `odd-platform`. It tells an operator how to bolt the action onto a Great Expectations V3 checkpoint so that, on every checkpoint run, expectation results are serialised into the ODD specification and pushed to the platform. The platform-side bindings are therefore the *receiving* surfaces, not the adapter implementation.

What the page maps to on the platform: the `platform_token` action field is the **Collector Token** concept (40-char shared-secret bearer token; `concepts.yaml:1809`); the push lands on the canonical S2S ingestion entry point **Ingest Data Entity List (S2S)** — `POST /ingestion/entities`, carrying `data_source_oddrn` + `items` (`operation:ingest-data-entity-list-s2s`); the `data_source_name` the operator supplies is the datasource the collector registers/upserts via **Register Data Source from Collector (S2S)** — `POST /ingestion/datasources` (`operation:register-data-source-from-collector-s2s`). The "What gets sent" quality results become **Data Quality Test** entities (`entitie:data-quality-test`, which explicitly names Great Expectations as an external framework ODD aggregates), and the "Where to next" link to the Quality Dashboard maps to the **Data Quality Dashboard (catalog-wide aggregate quality view)** concept (`entitie:data-quality-dashboard`).

`describes.features` and `describes.code_nodes` are intentionally empty: the odd-platform substrate has no Feature node or code node for the GE adapter itself (it is another repo's code). The one drift finding is the cross-repo auth caveat recorded in frontmatter — the page treats `platform_token` as load-bearing, while the platform's ingestion-token verification is off by default.

Live verification: the mechanical `live_url` guess (`/integrations/push-adapters/odd-great-expectations`) **404s**; GitBook serves integrations pages at a **doubled** slug `/integrations/integrations/odd-great-expectations` (status 200, H1 `odd-great-expectations`, sections Requirements / Installation / Configuration / What gets sent / Known limitations / Where to next all present).

## Maintainer notes
