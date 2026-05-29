---
id: ADR-DRAFT-ground-truth-lineage
title: "Ground-truth lineage — anchor the ontology to its four external surfaces (live docs, published ADRs, GitHub issues, the test suite)"
status: draft
date: 2026-05-29
revision: 1 (research-backed; Phase 1 — documentation — shipped)
scope: agentic-code-ontology (lineage/) — adds positive-space anchor nodes + the doc-lineage substrate
related_drafts: ADR-DRAFT-code-lineage-substrate, ADR-DRAFT-graph-query-layer, ADR-DRAFT-feature-anchored-ontology, ADR-DRAFT-agentic-graph-retriever
research_dir: adrs/drafts/research/ground-truth-lineage/ (DOC-INGESTION / TRACEABILITY-TAXONOMY / CONSISTENCY-MAINTENANCE)
research_methodology: deep-research playbook (parallel-researcher; 3 threads)
topology_doc: lineage/GRAPH-TOPOLOGY.md
trigger: maintainer request 2026-05-29 — "build the digital twin of a Principal engineer's mental model; the ontology must link to the live docs, the ADR log, real GitHub issues, and the test registry."
---

# ADR-DRAFT: Ground-Truth Lineage

## Context

The ontology graph (`adrs/drafts/{code-lineage-substrate,graph-query-layer,feature-anchored-ontology}.md`) is, today, **derivation- and gap-centric**. Its node labels are almost all things analysis *produced* — `CodeNode`, `Sidecar`, `Concept`, `Feature`, `FeatureReflection`, `Finding` — or things analysis found *missing*: `ImplicitADR`, `DocGap`, `TestGap`, `RefactoringScope`. That is half of a Principal engineer's mental model.

The other half is pinned to **real, addressable, external reality**: the published documentation an operator Googles, the ADR log the team agreed on, the GitHub issue tracker, the test suite. The graph *derives knowledge about* these surfaces but has **no node for the thing itself**:

- `Doc` nodes were **bare URLs with no body and no embeddings** (`projector.py`); code→doc links were rich (per-sidecar `docs_link_semantic`) but **one-directional** — you could not search doc content, nor traverse from a doc section to the code that implements it.
- `ImplicitADR` are *derived candidates*; there was no node for an **agreed** ADR, nor a link from candidate to ratified.
- `Finding` + on-disk issue drafts (`issues/{repo}/*.md`, whose frontmatter already reserves `github_issue_url`) existed; there was no node for the **real filed issue**.
- `TestGap` existed; `test_axis` was *defined* in the feature-anchored ADR but **never projected** as a node — there was no node for an **existing** test, nor for *why* it exists.

This ADR closes that loop.

## Decision

Add a **ground-truth-lineage layer**: positive-space **anchor nodes** for the four external surfaces, each ingested as a **derived-but-committed mirror**, embedded into the existing shared vector index, and linked to the existing derived/gap nodes with an **OSLC-derived edge vocabulary**. Every finding can then point at the real thing; every real thing is searchable and traversable. The topology is catalogued for humans in **`lineage/GRAPH-TOPOLOGY.md`**.

### New labels (positive-space; the gap-sibling keeps the qualifier)

`Doc` (upgraded to content-bearing) · `ADR` · `Issue` · `IssueDraft` · `Test`. The bare-noun asymmetry **is** the documentation: `ADR` vs `ImplicitADR`, `Test` vs `TestGap`, `Doc` (content) vs `DocGap` (divergence). Positive-space and gap labels are kept **separate** — collapsing them would let a regenerated candidate silently overwrite a human-ratified decision (the exact category error the layer exists to prevent).

### New edges (OSLC RM vocabulary → UPPER_SNAKE)

`DESCRIBES` (Doc→Concept/Feature/CodeNode — the reverse of `LINKS_DOC`) · `DOC_REFERENCES` (Doc→Doc) · `PROMOTED_TO` (ImplicitADR→ADR) · `REALISES` (CodeNode→ADR) · `SUPERSEDED_BY` (ADR→ADR) · `FILED_AS` (IssueDraft→Issue) · `TRACKS` (Finding/RefactoringScope→Issue) · `CLOSED_BY` (Issue→CodeNode) · `COVERS` (Test→CodeNode) · `VALIDATES` (Test→Feature) · `REGRESSES` (Test→Issue/Finding) · `ENFORCES` (Test→ADR). Full from→to table: `GRAPH-TOPOLOGY.md`.

### The source-of-truth contract (the maintainer's call, this session)

Each surface is a **derived-but-committed mirror** of an upstream — the `go.sum`/generated-code pattern. The guarantee reduces to **one enforced rule: a mirror is generated, never hand-authored** (humans edit only a survive-refresh `maintainer_curated` / `Maintainer notes` block). A never-hand-authored file can only be *fresh* or *stale*, never a competing source of truth.

For **documentation specifically, prose is referenced, not copied.** `../documentation` (the published manual's own git repo, always present in this workspace) stays the sole prose SoT. The ontology commits only addressing (`doc-nodes.jsonl`), the agentic per-page sidecars (`doc-understanding/*.md`), and the drift/completeness manifest (`documentation/_manifest.yaml`). The graph embedder reads the upstream prose at build time. **Zero prose duplication** — this is what dissolves the maintainer's stated fear of redundancy-driven drift.

Consistency machinery (all four surfaces):
- **Two-tier drift:** tier-0 = the upstream commit anchor; tier-1 = per-node `content_hash` (tells *which* nodes changed → re-embed only the delta).
- **Completeness:** `complete ⟺ missing==[] AND orphan==[]`, denominator **always from the upstream's own index** (docs: `SUMMARY.md`), never the mirror's own listing — the structural fix for the recurring "100% of my own subset" failure (`code-lineage-substrate` trigger; LSN class).
- **Mechanical transcription, not LLM re-summarisation** of the hashed body — else every refresh hashes differently → perpetual false drift. Agentic/semantic output lives in a *separate* sidecar layer, out of the hashed body.
- **Triggers:** git-diff-driven + on-demand. **No daemon** (APPROACH.md Rule 12 — local-only, no recurring infrastructure).
- **Human-deliberate links recorded after the fact, never triggered:** filing an issue and ratifying an ADR are human actions; the graph reads the link from committed frontmatter (`github_issue_number`, `superseded_by`), it never reaches out to GitHub or authors a published ADR.

## Research-backed decisions

Per `playbooks/deep-research.md`, three parallel threads (`adrs/drafts/research/ground-truth-lineage/`).

| Decision | Choice | Confidence | Source thread |
|---|---|---|---|
| Doc chunk granularity | heading/anchor section (= citation unit), ~600-800 nodes | HIGH | DOC-INGESTION |
| Doc node identity | greppable `documentation {path}#{anchor}`; live URL is a re-verified attribute, never identity (GitBook rewrites slugs) | HIGH | DOC-INGESTION |
| Doc prose storage | **reference upstream, do not copy** (embed at build; content-hash drift) | HIGH (maintainer-ratified) | DOC-INGESTION + CONSISTENCY |
| Embedding index | one shared, `node_type`-faceted index (not separate sub-indexes — preserves cross-modal query) | HIGH | DOC-INGESTION |
| Lifecycle edge vocabulary | adopt OSLC RM (`validatedBy`/`satisfies`/`trackedBy`) → UPPER_SNAKE; reject RDF/OWL service layer | HIGH | TRACEABILITY |
| Gap vs ground-truth | separate labels, never collapse | HIGH | TRACEABILITY |
| Mirror consistency | generated-file + lockfile (content hash); single-writer | HIGH | CONSISTENCY |
| GitHub ingestion | offline-first committed snapshot, never live-queried at build; refresh by deliberate batched call | HIGH model / MEDIUM mechanism | TRACEABILITY + CONSISTENCY |

## Phasing

- **Phase 1 — documentation (SHIPPED this session).** Mechanical extractor (`extractors/docs.py` → `doc-nodes.jsonl` + `_manifest.yaml`), `docs-ingest` / `docs-verify` CLIs, graph integration (content-bearing `Doc` + `DESCRIBES` + `DOC_REFERENCES` + sidecar-URL resolution), reference-upstream embedding, the `doc-analyser` subagent, the `/ingest-docs` skill, unit tests, `GRAPH-TOPOLOGY.md`. Result: 102 pages → 966 `Doc` nodes, embedded (vectors 5,847 → 7,523), completeness 102/102, 1,199 `DOC_REFERENCES`, cross-modal query proven (a doc query returns the doc section + the implementing code + the LSN-001/LSN-002 landmines). The agentic `DESCRIBES` pass is validated end-to-end on one page; the remaining 101 are a fireable `/ingest-docs` batch.
- **Phase 2 — ADRs.** Project `ADR` nodes from `adrs/` frontmatter (id/status/superseded_by already present) + add the published ADR-log page under the docs' Developer Guides; wire `PROMOTED_TO`/`REALISES`/`SUPERSEDED_BY`. Small — the frontmatter exists.
- **Phase 3 — issues.** Offline `github-issues.json` snapshot per repo (read-only helper, `GITHUB_TOKEN` when present, degrades to stale snapshot; `gh` not installed); `FILED_AS` from draft `github_issue_number`; `TRACKS`/`CLOSED_BY`.
- **Phase 4 — tests.** `test_axis` extractor → `Test` nodes (classification already specified); `COVERS`/`VALIDATES`/`REGRESSES`/`ENFORCES`; a `Test` with `COVERS` but no rationale edge is itself a finding.

## Consequences

**Enables:** start at a doc section → reach the implementing code/concept/feature (`DESCRIBES`) and vice-versa; "is this documented AND implemented AND tested AND decided?" as one traversal; doc-claim-vs-code drift mechanically surfaceable (page + code both in the graph); the eventual `Finding → Issue → PR` and `Test → ADR/Feature/Bug` provenance chains. The digital-twin mental model the maintainer asked for.

**Costs:** the agentic enrichment (`doc-analyser` per page; later `test_axis` rationale) is the expensive half — bounded, incremental, `/loop`-able, and never on the mechanical hot path. A small new CLI surface (`docs-ingest`, `docs-verify`) + one agent (`doc-analyser`) + one skill (`/ingest-docs`). No new infrastructure, no recurring cost (Rule 12 held).

## Alternatives rejected

- **Copy the doc prose into the ontology (committed mirror).** Rejected for ODD: `../documentation` is always present, so referencing it removes all prose duplication (the stated fear) at the cost of needing the repo at build time — acceptable, since the methodology already depends on it. (The committed-mirror remains the portability fallback for projects whose docs are a website, not a local repo — the `doc-analyser`/ingester can fetch+cache there.)
- **Live site as the prose SoT.** Rejected — GitBook slug rewriting makes the rendered site an unstable identity surface; the markdown is the stable SoT, the live URL a verified attribute.
- **Collapse gap and ground-truth labels** (one `ADR`, one `Test`). Rejected — see Decision; it permits a regenerated candidate to overwrite a ratified fact.
- **RDF/OWL + an OSLC HTTP service layer.** Rejected — re-litigates the already-decided LPG-over-RDF call in `graph-query-layer.md`; we adopt OSLC's *vocabulary and directionality* into the existing labeled property graph, not its serialization or service stack.
- **LLM re-summarisation as the mirror body.** Rejected — non-deterministic → perpetual false drift + merge churn. The mirror body is mechanical, normalised transcription.

## Implementation status

Phase 1 shipped and verified this session (see Phasing). Files: `lineage/_extractor/src/lineage_extractor/extractors/docs.py`; `graph_query/{config,records,loaders,projector,graph_query}.py`; `cli.py` (`docs-ingest`, `docs-verify`); `.claude/agents/doc-analyser.md`; `.claude/skills/ingest-docs/SKILL.md`; `lineage/_extractor/tests/test_docs.py` (11 tests, green); `lineage/GRAPH-TOPOLOGY.md`. Generated: `lineage/odd-platform/{doc-nodes.jsonl, documentation/_manifest.yaml, doc-understanding/}`.

## The decision pending

**Adopt the ground-truth-lineage layer as a permanent part of the ontology (Phase 1 documentation now in `main`; Phases 2-4 designed, to be implemented in subsequent batches) — or defer / reject.** All technical sub-decisions are research-backed and resolved above; this is a single binary call.
