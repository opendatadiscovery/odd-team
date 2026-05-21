---
id: ADR-DRAFT-agentic-graph-retriever
title: "The agentic graph retriever — an iterative, self-refining retrieval subagent over the derived graph"
status: draft
date: 2026-05-21
scope: workspace-meta (EXTENDS graph-query-layer.md — adds an agentic layer above the query library; SUPERSEDES the registry-search subagent; updates APPROACH.md §17)
related_drafts: ADR-DRAFT-graph-query-layer, ADR-DRAFT-feature-anchored-ontology, ADR-DRAFT-agentic-code-ontology
trigger: "2026-05-21 — the graph-query-layer's maiden PROBES run: the static query() pipeline FAILS the 60-query gold set on all 6 classes (completeness recall 0.21-0.37, MRR 0.47-0.73). A static retriever — one query vector, fixed 2-hop, fixed RRF — has a recall ceiling that constant-tuning cannot remove."
research: "Agentic RAG survey (arXiv 2501.09136); FAIR-RAG iterative refinement cycle (arXiv 2510.22344); Self-RAG reflection (Asai 2023); Generalized Pseudo-Relevance Feedback (arXiv 2510.25488); LLM-VPRF (arXiv 2504.01448); IterQR iterative LLM query rewrite (arXiv 2504.05309)."
---

# ADR-DRAFT: The agentic graph retriever

## Context

### The problem — a static retriever has a recall ceiling

`graph-query-layer.md` shipped `GraphQuery.query()` — a **static pipeline**: embed the
maintainer's question once, take a fixed vector top-k, expand a fixed 2-hop neighbourhood,
fuse with a fixed-constant RRF. The maiden PROBES run (the 60-query maintainer gold set,
`lineage/odd-platform/query-gold-set.yaml`) measured it: **6 of 6 query classes fail** —
completeness recall 0.21-0.37, MRR 0.47-0.73. Diagnosis (traced against raw output): the
answer nodes are usually *reachable* in the graph, but a single query formulation seeds the
wrong region and the fixed-depth RRF ranks the structurally-relevant nodes below the cutoff.

This is not a tuning miss. A static retriever **commits** — to one query string, one
traversal shape, one fusion weighting — before it has seen a single result. It cannot read
what it got back, reason about the gap between what was asked and what returned, and search
again differently. Tuning the RRF constant moves the ceiling by a few points; it does not
remove it. The maiden gate did its job: it proved the retriever needs a **category change**.

### The category change — retrieval must be agentic

The methodology's substrate is agentic everywhere *except* the retriever: sidecars are
agent-written, reducers are agents, the file-analyser interrogates. Only query stayed a
mechanical function. The 2024-2026 IR consensus is the same: **agentic RAG** replaces
static retrieval with an agent that plans, retrieves, critiques the result, and re-queries
(arXiv 2501.09136); **FAIR-RAG** governs this as an *iterative refinement cycle* —
identify the knowledge gap, formulate a query, retrieve, integrate, repeat (arXiv 2510.22344);
**Self-RAG** evaluates each retrieved item for relevance and re-queries when it falls short;
**pseudo-relevance feedback** (GPRF, arXiv 2510.25488) rewrites the query in natural language
*from the documents the first pass returned*. The retriever should be the last agentic
component the methodology adds.

## Decision

Build the **`graph-retriever`** — an iterative, self-refining retrieval **subagent** that
orchestrates the `graph_query` library's deterministic primitives with LLM intelligence.

- **The Python `graph_query` library stays the tool layer** — vector search, node-content
  fetch, neighbour listing, bounded traversal, exposed as CLI primitives. Deterministic,
  unchanged in character.
- **The `graph-retriever` subagent supplies the intelligence** — it constructs and
  *iteratively refines* the query, reads the full content of what came back, judges the
  gap, decides whether and how deep to traverse, and converges on the answer set.
- **No external LLM.** The intelligence is the subagent's own Claude Code reasoning — a
  filesystem-prompt subagent spawned by a skill, exactly like `file-analyser` and the
  reducers. `LSN-016` Rule 2 / `APPROACH.md` §9 hold: no Anthropic-API driver, no API loop.
- **It supersedes `registry-search`** — the grep-over-sharded-indexes dedup subagent that
  was explicitly "the bridge until the vector store." The vector store now exists; the
  agentic retriever is its consumer.

## The retrieval loop

```
retrieve(need):
  1. CONSTRUCT — rewrite `need` into a strong search query: extract the entities /
                 operations / identifiers, expand with domain synonyms, drop filler.
                 Optionally hold 2-3 query variants.
  for iteration in 1..10:
     a. SEARCH    — graph-search(query) -> candidate entry-point nodes
     b. READ      — graph-node(top candidates) -> the FULL content of each
                    (sidecar sections / reducer detail) — not just the headline
     c. JUDGE     — per candidate: relevant / partial / off-target? Name the GAP
                    between what was asked and what returned.
     d. TRAVERSE? — if a node is on-target but the answer likely sits in its
                    neighbours, graph-neighbours then graph-traverse at a depth
                    THE AGENT chooses from how far the signal seems (adaptive,
                    not a fixed 2).
     e. CONVERGED? — need satisfied with confidence -> stop;
                     no progress for 2 iterations -> stop;
                     iteration == 10 -> stop.
     f. REFINE    — reformulate the query to DISCRIMINATE: add the gap's
                    vocabulary, push away from the returned-but-wrong cluster.
                    This is LLM-driven relevance feedback (GPRF-style).
  2. EMIT     — the answer node set, each cited source_file:source_line, with a
                confidence and the iteration trace.
  3. SUGGEST  — for nodes returned but judged stale / thin / mis-described, append
                STRUCTURED refinement suggestions to the retrieval-feedback queue.
                The retriever NEVER mutates the graph or the substrate.
```

The three capabilities the maintainer asked for map onto the loop: **(1)** query
construction is step 1; iterative discriminating refinement is steps b→c→e→f. **(2)** the
suggestion side-channel is step 3. **(3)** adaptive traversal depth is step d.

## The substrate-improvement feedback loop

Retrieval is also a **substrate-quality probe**. When the retriever pulls a node that is
returned-but-wrong — a sidecar too thin to judge, a description that mis-states what the
code does, a stale finding — that is signal: the substrate node needs work. The retriever
emits this as a structured suggestion, never a graph edit:

```yaml
# lineage/{repo}/retrieval-feedback/{date}-{slug}.md  (committed; future-batch input)
- node_id: "..."
  returned_for_query: "..."
  observed_problem: thin-sidecar | mis-description | stale-finding | weak-embed-text | missing-edge
  evidence: "what the retriever saw that flagged it"
  suggested_refinement: "the concrete change a future /enrich or reducer batch should make"
  retriever_confidence: HIGH | MEDIUM | LOW
```

A future `/enrich` or reducer batch reads `retrieval-feedback/` and applies the refinements.
This operationalises "information in the graph should be constantly verified, stressed and
improved" — the retriever is a continuous improvement *source*, while staying strictly
read-only on the graph. The graph is rebuilt from the substrate; improving the substrate is
the only legitimate way to improve the graph, so suggestions target the substrate.

## The tool layer — CLI primitives

The subagent invokes (via `Bash`, `--json`):

| Tool | What it returns |
|---|---|
| `lineage-extractor graph-search REPO TEXT` | vector top-k entry-point nodes — pure semantic, no graph expansion |
| `lineage-extractor graph-node REPO NODE_ID` | one node's full content — label, props, provenance, every section's text, neighbour summary |
| `lineage-extractor graph-neighbours REPO NODE_ID` | the node's adjacency — per edge: direction, type, neighbour id/label/title |
| `lineage-extractor graph-traverse REPO NODE_ID --depth N --edges …` | a bounded subgraph at an agent-chosen depth + edge filter |

`query` (the one-shot hybrid) stays for non-agentic callers. The primitives are the agentic
surface: small, composable, deterministic — the agent is the only intelligence.

## Residual risks

- **Iteration cost.** Each loop is subagent reasoning + tool calls. Bounded hard at 10
  iterations + a no-progress-for-2 early stop. A simple need converges in 1-2; the cap is
  for genuinely hard retrievals.
- **Non-convergence.** The agent could thrash. Mitigated by the no-progress stop and by the
  agent emitting its best partial answer + a `confidence: LOW` rather than failing silently.
- **Suggestion quality / noise.** A retriever that flags every imperfect node floods the
  feedback queue. Mitigated by `retriever_confidence` + the rule: only suggest when the
  retrieval *materially* suffered, not on cosmetic imperfection.
- **Over-traversal.** Adaptive depth could pull a huge subgraph. The `graph-traverse`
  primitive keeps the per-call hop bound; the agent picks depth but the tool still caps the
  payload (the 25k-token ceiling holds).

## Validation

The same maiden gate measures it. The `graph-retriever` clears the PROBES family-1 floors
on the gold set, run through the agentic loop rather than the static `query()`. Until it
does, it runs in shadow beside `query()` and the grep path — unchanged from the
graph-query-layer ADR's shadow-mode discipline. Tuning the agent's prompt against the gold
set is legitimate (the gold set is maintainer-ratified ground truth); reverse-fitting the
gold set to the agent is not.

## What is NOT in scope

- No change to the substrate, the sidecar schema, or the `graph_query` projection.
- The retriever never writes the graph or the substrate — only the `retrieval-feedback/`
  queue.
- No external API, no daemon, no MCP server (still deferred per graph-query-layer.md).
- Auto-applying the refinement suggestions — that is a future `/enrich`-side decision; this
  ADR only produces the queue.

## Consequences

**Positive.** Retrieval gains a reasoning loop — it recovers from a bad first query instead
of returning it. Completeness queries (depends-on, concept-discuss) gain the most: the agent
keeps searching until the set is whole. The retriever becomes a substrate-improvement source
at zero extra cost. `registry-search`'s grep-over-sharded-indexes job is absorbed.

**Negative / accepted.** A retrieval is now a subagent invocation, not a function call —
slower and token-costlier than `query()`. Accepted: correctness over latency for a
maintainer-facing query; `query()` stays for the cheap one-shot path. The agent's quality
depends on its prompt — prompt-tuning is ongoing, gated by the maiden gate.

## References

- `adrs/drafts/graph-query-layer.md` — the derived graph + the `graph_query` tool layer this builds on.
- `adrs/drafts/feature-anchored-ontology.md` principle 7 — `registry-search`, the subagent this supersedes.
- `lineage/odd-platform/query-gold-set.yaml` — the maiden gate that triggered this ADR.
- Agentic RAG survey — arXiv 2501.09136. FAIR-RAG — arXiv 2510.22344. Self-RAG — Asai et al. 2023.
- Generalized Pseudo-Relevance Feedback — arXiv 2510.25488. LLM-VPRF — arXiv 2504.01448. IterQR — arXiv 2504.05309.
- `APPROACH.md` §17 — updated with the agentic-retriever layer.
