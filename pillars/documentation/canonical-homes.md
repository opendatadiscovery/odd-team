---
pillar: documentation
file: canonical-homes
status: active
since: 2026-04-30
---

# Canonical homes — content type table

Each recurring content type in the documentation has exactly one canonical home. Feature pages and aspect landings link to the home rather than embedding authored fragments. This is `pillars/documentation/cornerstones.md` Cornerstone 5 made operational; Gate 10 (`pillars/documentation/gates.md`) enforces it at review time.

## The recurring content types and their canonical homes

This is an evolving list — extend it when a new type emerges. When extending, add a row in the same commit that introduces the first piece of that content type's content.

| Content type | What it covers | Canonical home |
|---|---|---|
| **Feature description** | What the platform does for users; for-deciding-whether-ODD-fits-a-use-case copy. | `docs/Features.md` (in-page TOC + per-feature sections — the **index**) and per-feature detail pages under aspect landings (Cornerstones 1 & 2 — the **details**). Cross-link direction is one-way: `Features.md` → detail. Detail pages, bucket landings, integration pages, and other surfaces below the index never link back to a `Features.md` anchor for canonical reference (Cornerstone 2 — `Features.md` is the index). |
| **Configuration reference** | Operator-facing — every `application.yml` key, env-var override form, default, caveats. | `docs/configuration-and-deployment/odd-platform.md` (Cornerstone 3 surface). |
| **API reference** | Developer-facing — every HTTP endpoint with operation ID, path, method, request/response schema, status codes, related Sources line. | `docs/developer-guides/api-reference` — **hub + per-feature sub-pages** (post-DOC-088). The hub (`api-reference.md`) carries the per-section index plus the `OpenAPI specifications` and `Interactive testing with Swagger UI` sections that span the whole API surface. Per-feature endpoint listings live on sub-pages: `api-reference/{alerts,data-collaboration,directory,glossary,integrations,lineage,query-examples,reference-data,relationships}.md`. Feature pages link to the matching sub-page (no anchors needed); do not embed endpoint tables on feature pages. |
| **Deployment / install** | Operator-facing — deployment paths, sizing, Helm values, EKS quick-launch. | `docs/configuration-and-deployment/` subtree (Cornerstone 3 surface). |
| **Architectural Decision Records (ADRs)** | The WHY behind a decision with alternatives considered and trade-offs. | `adrs/` directory (in this workspace; cross-linked from feature pages). |
| **Glossary / aliases** | Canonical terminology; alias→canonical resolution. | `docs/main-concepts.md` "Terms & Aliases" table. |
| **Developer guides** | Build-from-source, custom-collector authoring, contribution flow. | `docs/developer-guides/` subtree. |
| **Integrations hub** | Per-integration configuration, capability matrix, secrets backend. | `docs/integrations/` subtree (DOC-042 hub). |
| **Examples / sample configs** | Copy-pasteable artifacts (collector_config snippets, Helm values templates). | **No canonical home today** — log as a future Cornerstone-5 decision when the gap surfaces concretely. Concrete use-site (2026-05-07 deferral, DOC-159): `docs/integrations/ingestion-filters.md` L70 figure caption links at `https://github.com/opendatadiscovery/odd-collectors/blob/main/odd-collector/config_examples/postgresql.yaml` (PostgreSQL filter setup template) for lack of a doc-product per-adapter config-examples surface. |
| **Per-adapter capability matrix** | Cross-adapter table mapping which adapter exposes which feature (ingestion filter, ERD relationship, partitioning, TLS toggles, …). | **No canonical home today** — `docs/integrations/README.md` L108 advertises that the matrix "lives on the per-collector pages" but no actual cross-adapter matrix page exists. Concrete use-sites (2026-05-07 deferral, DOC-159): `docs/integrations/ingestion-filters.md` L86 prose links at the [`odd-collectors` repository's filtering documentation](https://github.com/opendatadiscovery/odd-collectors#ingestion-filters-configuration) for the cross-adapter filter capability list; sister-pattern on `docs/data-modelling/relationships.md` L29 + L58 for the Relationships matrix. The recommended call (DOC-159 Option 1) is to accept the gap — the matrix has limited reader value pre-deployment, and a parallel doc-tree matrix risks drift relative to per-collector pages. Re-evaluate when a per-collector authoring batch (DOC-070-style) gives the matrix a natural home. |
| **Troubleshooting / runbooks** | Error symptoms → diagnosis → fix paths. | **No canonical home today** — same status; log when the gap surfaces. |

## The rule operationalized

When authoring any sub-section, the maintainer asks: *what content type is this?* Then: *where is its canonical home?* Three legitimate outcomes:

1. **Canonical home exists and contains the content.** Link to the relevant section/anchor of the canonical home; do not embed.
2. **Canonical home exists but is sparse or doesn't yet cover this case.** Extend the canonical home with the new content; link from the feature page. The 2026-04-30 lookup-tables case (`retrospectives/LSN-006-lookup-tables-content-homing.md`) should have followed this path: 16 endpoints belong on `docs/developer-guides/api-reference`, with `lookup-tables.md` carrying a one-line "see API Reference → Reference Data" link.
3. **No canonical home today.** The content type is genuinely new in the body of work; propose a canonical home as a Cornerstone-5 decision (extend the table above; possibly add the home before authoring the embedded content, or log a backlog item to add the home then migrate). Do **not** silently embed on a feature page and hope the home appears later.

## How to use this table

- **At authoring time** (Pre-authoring stance check question 2 — see `pillars/documentation/gates.md` Pre-authoring stance check): name the content type, locate its canonical home in this table, and route to one of the three outcomes above before writing.
- **At review time** (Gate 10 — see `pillars/documentation/gates.md`): for every authored sub-section, verify the content type was correctly identified and the change is the canonical home or a link to it. Reject embeddings that should have been links.
- **When extending the table**: a new row is a Cornerstone-5 decision. Treat it as you would a new ADR draft — surface the proposal before authoring the first piece of content of that type, not after several pages have already embedded fragments.