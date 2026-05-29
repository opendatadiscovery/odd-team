---
doc_page: "docs/developer-guides/build-and-run/README.md"
page_title: "Build and run"
live_url: "https://docs.opendatadiscovery.org/developer-guides/build-and-run"
live_url_verified_status: "200"
live_url_resolved_slug: "developer-guides/build-and-run"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts: []
  features: []
  code_nodes: []
audience: [developer]
doc_claim_vs_code:
  - "Mechanical live_url guess in doc-nodes.jsonl (`.../developer-guides/build-and-run/readme`, doc-nodes.jsonl:642) 404s; GitBook serves this README at the section root `.../developer-guides/build-and-run` (verified 200 this session). The `/readme` slug returns the Page-Not-Found shell. Not a content defect — a mechanical-guess vs resolved-slug correction; recorded here per Rule 5 (the resolved slug lives in live_url_resolved_slug, not in the regenerated mechanical file). The `#contents` anchor on the guessed `/readme` URL is therefore also dead; the real page has no separate `Contents` rendering distinct from the body link list."
maintainer_curated: false
---

# Build and run — doc understanding

This is the developer-facing landing/navigation page for the "Build and run" section: it routes a developer to one of three build-from-source recipes — the ODD Platform (Java + Gradle + Spring WebFlux + jOOQ + Flyway backend, TypeScript + React frontend), the bundled ODD Collectors family (`odd-collector`, `-aws`, `-gcp`, `-azure`, plus the standalone `odd-collector-profiler`) under a Python/Poetry setup, and the `odd-collector-sdk` path for authoring a brand-new collector/adapter. The one cross-link out is to [Try locally](../../configuration-and-deployment/trylocally.md) for the no-build Docker path.

The page binds to ZERO odd-platform graph nodes, and this is the correct, honest result — not a coverage miss in this sidecar. The page documents the **build toolchain and source-setup workflow** (how to compile and run the artefacts), whereas the odd-platform substrate enriches **runtime code** (controllers, React components, config-key consumers, OpenAPI tags). There is no Gradle/`package.json`/Dockerfile/Poetry build-tooling node in the graph for this page to DESCRIBE. Confirmed by three scoped graph-searches: the only CodeNode hits are generic React widgets (`react-component:App`, `TestRunStatusReasonModal`, score ~0.67-0.70 — vector proximity to "build/run/platform" wording, not documentation targets); the only Concept hit is `StaticArgumentMappingContext (platform_url substitution)` (0.62, a runtime ingestion-mapping concept); the only Feature hit is **F-020 Collector Lifecycle Management** (0.70). F-020 was read in full via graph-node and ruled OUT: it is the operator-facing *Management → Collectors* CRUD + token-rotation surface (`/management/collectors` SPA route — registering and rotating tokens for *already-running* collectors), the opposite of this page's developer *build-and-run-a-collector-from-source* topic. Binding it would be a synonym-swap false positive (manage-a-collector vs build-a-collector), so it is omitted per Rule 2/Rule 3 (empty-but-honest over full-but-wrong).

Two of the three child pages (`build-and-run-odd-collectors.md`, `custom-collectors.md`) document the **odd-collectors** and **odd-collector-sdk** repositories, which are entirely out of scope for the odd-platform graph; the third (`build-and-run-odd-platform.md`) targets the platform's build toolchain, which the substrate has not enriched (substrate scope = runtime semantics, not build scripts). This is a `pillar-undocumented`-class structural signal for doc-gap triage — the build/dev-setup capability surface has no ontology coverage on the platform side — rather than a doc-claim-vs-code contradiction. The only recorded `doc_claim_vs_code` entry is the mechanical live-URL slug correction (`/readme` 404 → section-root 200), which the doc-gap-finder needs so the doc-nodes guess is not treated as authoritative.

## Maintainer notes
<!-- preserved across re-analysis; the only block a human hand-edits -->
