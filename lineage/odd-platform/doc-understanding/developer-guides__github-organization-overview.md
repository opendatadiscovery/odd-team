---
doc_page: "docs/developer-guides/github-organization-overview.md"
page_title: "GitHub organization overview"
live_url: "https://docs.opendatadiscovery.org/developer-guides/github-organization-overview"
live_url_verified_status: "200"
live_url_resolved_slug: "developer-guides/github-organization-overview"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts: ["ODDRN"]
  features: []
  code_nodes: []
audience: [developer]
doc_claim_vs_code: []
maintainer_curated: false
---

# GitHub organization overview — doc understanding

This is an ecosystem orientation page for contributors: a one-paragraph
description of every repository in the `opendatadiscovery` GitHub organization
(odd-platform, documentation, odd-models-package, opendatadiscovery-specification,
oddrn-generator, the odd-collectors family, the push adapters odd-spark-adapter /
odd-airflow-2 / odd-airflow, odd-tracing-gateway, charts, odd-examples, and the
auxiliary tools odd-cli / odd-dbt / odd-great-expectations / odd-collector-profiler).
It is a map of *where each kind of code lives*, not a description of any one
runtime behaviour — so it binds to almost no `odd-platform` code.

The single confirmed ontology binding is the **ODDRN** concept (`entitie:oddrn`,
confirmed via graph-node): the `oddrn-generator` paragraph teaches what an Oddrn is
("Open Data Descriptor Resource Name — a standardized naming convention for
identifying data resources") and the `opendatadiscovery-specification` paragraph
cross-links the canonical definition at `../main-concepts.md#oddrn`. The page's
description of ODDRN is consistent with the catalog concept (which records ODDRN as
the unique stable entity identifier, Directory's grouping key and AlertManager's
routing key) — no doc-claim-vs-code drift.

A `graph-search --label CodeNode` for the page's ecosystem-overview topic returned
no hits, and the spec-related `Concept` hits were all narrow auth/API-shape
invariants the page does not document — so `describes.code_nodes` and
`describes.features` are deliberately empty rather than padded. The page's
remaining claims concern *external* repositories (e.g. odd-spark-adapter "v0.0.1
supports Spark 3.3.1 only; Spark Structured Streaming is on the roadmap";
odd-airflow-2 "Apache Airflow 2.5.1 and later"; odd-tracing-gateway's OTLP→entities
bridge); these are out-of-graph for the `odd-platform` substrate, so no code-cited
drift is loggable here per the contract's evidence rule.

## Maintainer notes
