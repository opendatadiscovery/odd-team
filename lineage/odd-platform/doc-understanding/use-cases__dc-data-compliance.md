---
doc_page: "docs/use-cases/dc-data-compliance.md"
page_title: "Data compliance for Data Scientists"
live_url: "https://docs.opendatadiscovery.org/use-cases/use-cases/dc-data-compliance.md"
live_url_verified_status: "200"
live_url_resolved_slug: "use-cases/use-cases/dc-data-compliance.md"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts: ["Tag"]
  features: ["F-018", "F-017"]
  code_nodes: []
audience: [data-consumer]
doc_claim_vs_code:
  - "Page Solution claims the platform 'provides a PII-sensitive search mechanism to assist in identifying confidential data using tags, labels and metadata' — code has NO PII-aware / sensitivity-aware search. Search exposes exactly seven facets (Datasource / Type / Namespace / Owner / Tag / Groups / Statuses) and none is a PII or sensitivity dimension — evidence: F-017 / SearchController.java:30-40 (getFiltersForFacet over MultipleFacetType = TAGS/OWNERS/TYPES/GROUPS/STATUSES). PII identification is the operator manually reading an entity's Tag/label/metadata values (the page's own Scenario steps 5-6), not a search capability the platform performs. A tag literally named 'PII' is ordinary free-text, not a system-recognised sensitivity class — TAG.NAME matching is case-sensitive so 'PII' and 'pii' are distinct rows — evidence: Tag / entitie:tag concept (case-sensitive listByNames, finding (c))."
maintainer_curated: false
---

# Data compliance for Data Scientists — doc understanding

A use-case narrative aimed at a **data-consumer** (data scientist): faced with building an ML model on customer data, the reader uses ODD Platform to inspect which catalog objects carry PII before deciding what to anonymise. The operational mechanism the page actually relies on — visible in its own Scenario (steps 4-6) — is **searching the catalog for the tables, then reading each object's tags, labels, and metadata** to judge GDPR/PCI-DSS sensitivity. That maps to the **Tag** concept (`entitie:tag`, the taxonomic-labelling directory) applied to entities via **F-018 Manual Object Tagging**, with the catalog **search/facets** surface (**F-017**, `SearchController.java:30-40`) as the discovery entry point. The page binds the `tagging.md` page directly from its Solution section.

The page's headline framing — a "**PII-sensitive search mechanism**" — overstates the platform: search has no PII or sensitivity facet/filter (the seven facets are Datasource/Type/Namespace/Owner/Tag/Groups/Statuses per F-017). Sensitivity is communicated entirely through human-authored Tag/metadata values the data scientist reads, not through any PII-aware search behaviour. This is recorded as the one doc-claim-vs-code drift above. No code node is bound directly — the page documents operator-facing behaviour at the concept/feature altitude, and the implementing code is reachable transitively through F-018/F-017.

## Maintainer notes
