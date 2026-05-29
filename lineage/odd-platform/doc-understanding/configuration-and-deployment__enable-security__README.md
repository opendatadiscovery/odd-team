---
doc_page: "docs/configuration-and-deployment/enable-security/README.md"
page_title: "Enable security"
live_url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security"
live_url_verified_status: "200"
live_url_resolved_slug: "configuration-and-deployment/enable-security"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "Ingestion Filter"
    - "Two ingestion filters with asymmetric auth — datasource always-on, entity opt-in; FOUR sibling endpoints uncovered"
    - "Cross-dataset stats-write — payload dataset_oddrn NOT validated against field-ODDRN parent relationship"
    - "Auth Mode"
    - "S2S Ingestion Pipeline"
  features:
    - "F-094"   # Ingestion API Authentication Coverage Matrix — auth.ingestion.filter.enabled covers 1 of 5
    - "F-095"   # Dataset-Field Statistics Ingestion — cross-dataset write surface
    - "F-008"   # Ingestion-replace destruction surface (replay-with-fewer-tags destroys absent ones)
  code_nodes:
    - "odd-platform java auth filter:IngestionDataEntitiesFilter"
    - "odd-platform java IngestionDataEntitiesFilter config-key-consumer:auth.ingestion.filter.enabled@L20"
audience: [operator]
doc_claim_vs_code:
  - "MECHANICAL LIVE-URL DRIFT: doc-nodes.jsonl guesses live_url=.../configuration-and-deployment/enable-security/readme which returns HTTP 404 (curl -sIL, 2026-05-29); the README resolves to the section root .../configuration-and-deployment/enable-security (HTTP 200, title 'Enable security | ODD Platform', anchors #ingestion-authentication / #deployment-matrix-per-endpoint-per-auth-config / #statistics-endpoint-write-shape-and-replay-behaviour all present). Correction lives in live_url_resolved_slug; doc-nodes.jsonl is regenerated, not hand-edited."
  - "OMITTED OPERATOR-CRITICAL CAVEAT (LSN-001 class — forensic invisibility): the 'Statistics endpoint' danger hint documents the cross-dataset write/poisoning surface but does NOT state that the write is UNAUDITED. DatasetFieldServiceImpl.updateStatistics (DatasetFieldServiceImpl.java:158-181) carries no @ActivityLog, unlike the audited siblings updateInternalName (line 99) and updateDatasetFieldTags (line 119). An attacker poisoning dataset_field.stats via POST /ingestion/entities/datasets/stats leaves NO Activity-Feed trace — material for an operator weighing detection vs. perimeter-only mitigation. Evidence: invariant:cross-dataset-stats-write-no-parent-child-consistency-check ('The audit-trail amplifier' facet) / DatasetFieldServiceImpl.java:158-181. → DOC-GAP candidate (add an 'unaudited write' note to the stats hint)."
maintainer_curated: false
---

# Enable security — doc understanding

This page is the operator's authoritative answer to "what authenticates my ODD
Platform, and what is left open by default." It establishes the page's load-bearing
thesis — **two independent authentication surfaces** (UI/API via `auth.type`,
ingestion via `auth.ingestion.filter.enabled`) where enabling one does not protect
the other — then drills into the ingestion side: the two `WebFilter`s, the
off-by-default entity filter, the uncovered sibling paths, the stats-endpoint write
hazards, and a per-endpoint × per-auth-config deployment matrix. Audience is the
**operator** deciding how to expose the platform; the page is framed entirely around
network reachability and mitigation, not developer integration.

The page binds to the ontology's security spine and is unusually code-faithful — it
appears authored from the same evidence the substrate carries:

- The **two-filter asymmetry** (datasource filter always-on, entity filter opt-in;
  four sibling paths uncovered) is the concept
  `invariant:two-ingestion-filters-asymmetric-auth`, which cites
  `IngestionDataSourceFilter` @Component line 15 (ungated → always runs),
  `IngestionDataEntitiesFilter` @Component line 19 /
  `@ConditionalOnProperty(auth.ingestion.filter.enabled, havingValue=true)`,
  default `false` per `application.yml:48`, the exact-literal POST-only matcher at
  `IngestionDataEntitiesFilter.java:28`, and the `/ingestion/**` glob in
  `SecurityConstants.WHITELIST_PATHS` line 96. The page's "Ingestion paths the filter
  does not cover" section and its sibling list (alertmanager, datasets/stats, metrics,
  degs children) match this invariant verbatim.
- The **stats-endpoint danger hint** (cross-dataset write resolved by field-ODDRN with
  no parent-child JOIN) is `invariant:cross-dataset-stats-write-no-parent-child-consistency-check`,
  citing `DatasetFieldServiceImpl.updateStatistics:158-181`, and feature `F-095`. The
  **replay-with-fewer-tags destroys absent ones** paragraph is the
  ingestion-replace-destruction surface `F-008`.
- The **deployment matrix** and the `auth.type` enumeration (`DISABLED / LOGIN_FORM /
  OAUTH2 / LDAP`) is concept `entitie:auth-mode`; the **S2S composes-not-mutex** caveat
  in the matrix preamble (valid `X-API-Key` accepts every endpoint regardless of
  `auth.type` / the ingestion filter) is concept `entitie:s2s-ingestion-pipeline`. The
  whole page is the operator-facing realisation of feature `F-094` (the coverage
  matrix), and the closing "platform-side fix is tracked upstream" line maps to F-094's
  refactoring scope.

Two drift findings recorded (see frontmatter): one **mechanical live-URL drift** (the
`/readme` guess 404s; real slug is the section root) and one **omitted operator-critical
caveat** — the poisoning write the stats hint warns about is *unaudited* (no
`@ActivityLog` on `DatasetFieldServiceImpl.updateStatistics:158-181`, unlike its audited
siblings), so it leaves no Activity-Feed trace. Both are DOC-GAP candidates for the
maintainer; the page is otherwise faithful to the code it documents.

## Maintainer notes
<!-- preserved across re-analysis; the only block a human hand-edits -->
