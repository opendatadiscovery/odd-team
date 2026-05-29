---
doc_page: "docs/Architecture.md"
page_title: "Architecture"
live_url: "https://docs.opendatadiscovery.org/introduction/architecture"
live_url_verified_status: "200"
live_url_resolved_slug: "introduction/architecture"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "ODDRN"
    - "Collector"
    - "S2S Ingestion Pipeline"
    - "Ingestion Filter"
    - "Auth Mode"
    - "Attachment Storage Backend"
  features:
    - "F-027"
  code_nodes:
    - "odd-platform yaml application.yml config-prefix:attachment"
audience: [operator, developer]
doc_claim_vs_code:
  - "Page (Cross-cutting concerns → Attachments, source_line 43) states the LOCAL attachment default is `./attachments/`; the shipped default is `/tmp/odd/attachments` — evidence: odd-platform yaml application.yml config-prefix:attachment / odd-platform-api/src/main/resources/application.yml:218-219. The `./attachments/` string appears nowhere in the code. The real default (`/tmp/...`) is the LSN-001 ephemeral-data-loss path, so the wrong string understates the production hazard the bullet is trying to flag."
maintainer_curated: false
---

# Architecture — doc understanding

This is the structural-overview / landing page for an ODD deployment: a five-stage metadata data flow (Produce → Ingest → Store → Query → Render), a component-topology table (Platform server, Collector, two Push-client shapes, UI), the Pull-vs-Push decision, and an ODDRN explainer, with landing-level pointers out to each cross-cutting concern's canonical home. It binds to the spine of the ingestion architecture rather than to any single feature flow.

The data-flow "Ingest" stage and the "Ingestion API" are the **S2S Ingestion Pipeline** concept (`POST /ingestion/entities`, confirmed via graph-node — path-whitelisted off the UI auth chain in every mode); the producer-traffic auth bullet under Cross-cutting concerns is the **Ingestion Filter** concept (`IngestionDataEntitiesFilter`, `@ConditionalOnProperty("auth.ingestion.filter.enabled")`), and the page's "Disabled / Login form / OAUTH2 / LDAP" enumeration is verbatim the **Auth Mode** concept (`auth.type`). The Collector topology row matches the **Collector** concept (container of pull adapters + runtime, S2S-token authenticated). The dedicated ODDRN section is verbatim aligned with the **ODDRN** concept, including the "gives the AlertManager webhook its `entity_oddrn` routing key" claim (confirmed in the concept's section text and in `invariant:entity-oddrn-trust-from-alertmanager-webhook`).

The page is also a primary operator-facing statement of the attachment storage default (**Attachment Storage Backend** concept + feature **F-027** Attachment Lifecycle + the `attachment` config-prefix node). That is where the one drift lives: the page names the LOCAL default as `./attachments/`, but `application.yml:218-219` ships `/tmp/odd/attachments`. The bullet's operator advice ("switch to REMOTE for production") is correct; the path string is not, and because the real default sits under `/tmp` it is the LSN-001 ephemeral-loss path — the wrong string makes the default look less dangerous than it is. Logged as the single `doc_claim_vs_code` entry for doc-gap triage.

The cross-cutting bullets for Alerting, Lineage, Search, Data Collaboration, and GenAI are one-sentence landing pointers to other canonical pages (each "See <page>"); they are deliberately NOT bound as DESCRIBES targets here — this page is not their canonical doc home, and binding them would inflate the edge set past what the page actually documents.

## Maintainer notes
<!-- preserved across re-analysis; the only block a human hand-edits -->
