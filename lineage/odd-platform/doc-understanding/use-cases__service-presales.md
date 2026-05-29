---
doc_page: "docs/use-cases/service-presales.md"
page_title: "Service Provider and Pre-Sales"
live_url: "https://docs.opendatadiscovery.org/use-cases/use-cases/service-presales"
live_url_verified_status: "200"
live_url_resolved_slug: "use-cases/use-cases/service-presales"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: MEDIUM
describes:
  concepts: ["invariant:platform-api-architectural-shape-194-ops-35-tags"]
  features: ["F-054"]
  code_nodes: []
audience: [operator, developer]
doc_claim_vs_code:
  - "Mechanical live_url guess (docs/use-cases/service-presales.md#live_url = https://docs.opendatadiscovery.org/use-cases/service-presales) 404s. GitBook serves this page (and every sibling use-case) at the DOUBLED slug /use-cases/use-cases/service-presales (200 OK). Verification artifact, not a per-page break: the doubling is the structural GitBook pattern for the whole use-cases space (confirmed against the /use-cases index — dc-data-compliance, de-deprecation, dq-visibility, viz-preparation all resolve at /use-cases/use-cases/...). Evidence: doc-nodes.jsonl row id 'documentation docs/use-cases/service-presales.md' live_url field; live WebFetch 2026-05-29."
  - "Page sells the API for gathering 'Microservices / tools client is using' and frames Microservices as a first-class discovery surface; at the code level Microservices Lineage is doc-promised as a distinct pillar but rendered by the class-agnostic dataset-lineage canvas with NO class-aware affordances at any layer — there is no microservice-specific capability behind the framing. Low severity (use-case is illustrative narrative, not a feature contract). Evidence: F-054 / feature-flows/detail/F-054.yaml:1 (entry_point)."
maintainer_curated: false
---

# Service Provider and Pre-Sales — doc understanding

This is a use-case narrative, not a feature reference: a service-provider / IT-consultancy persona uses the ODD Platform during pre-sales to gather a prospective client's architectural landscape and toolset, so scope, team setup, and solution design are better-informed and scope-creep is reduced. The only concrete platform surface the page names is the Platform API — both the Solution and Scenario sections direct the reader to "integrate the ODD API" (linked to `developer-guides/api-reference.md`) to gather information on the microservices/tools in use and the landscape's maturity. That API surface is the canonical `invariant:platform-api-architectural-shape-194-ops-35-tags` (194 operations / 35 tags; the developer-facing HTTP surface whose doc hub is exactly the `developer-guides/api-reference` page this use-case links to). The page's "Key words" line links to microservices lineage (`../data-lineage/microservices.md`), confirmed via F-054 (the microservices-lineage feature, entry_point `ui_route:/dataentities/{id}/lineage`).

Bindings are deliberately narrow. F-097 (Swagger UI / OpenAPI discoverability) and any specific data-source operation are NOT bound: the page mentions neither the Swagger discoverability surface nor the data-source admin surface — it references the API generically as the gathering mechanism, which the API-shape invariant already captures. Confidence is MEDIUM because the page is an illustrative sales scenario with no concrete endpoint/config claims to anchor stronger code bindings.

## Maintainer notes
