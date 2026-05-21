---
name: retrieve
description: Run the graph-retriever subagent — intelligent, iterative retrieval over the derived graph query layer. The maintainer asks a free-form information-need question ("where is X", "what depends on Y", "which findings concern Z"); the agent constructs a strong query, runs a bounded retrieve→read→judge→refine loop (≤10 iterations) with adaptive traversal, and returns a cited answer set. Emits substrate-refinement suggestions to lineage/{repo}/retrieval-feedback/ without ever mutating the graph. Supersedes the grep-based registry-search. Per adrs/drafts/agentic-graph-retriever.md.
argument-hint: ["<question>"] [--repo <repo>]
allowed-tools: Read Bash(date *) Bash(ls *)
---

# /retrieve — intelligent iterative retrieval over the ontology graph

The query-time companion to the derived graph query layer. Where `query` (the CLI) does
one static hybrid pass, `/retrieve` spawns the **`graph-retriever`** subagent — which
*iterates*: it searches, reads the full content of what came back, reasons about the gap,
reformulates the query to discriminate, traverses neighbours at a self-chosen depth, and
converges on a cited answer. It exists because the static `query()` has a measured recall
ceiling (it fails the maiden gold-set gate); an agentic loop does not commit to one
formulation.

It is also a substrate-quality probe: when a retrieval surfaces a stale / thin /
mis-described node, the agent records a structured refinement suggestion in
`lineage/{repo}/retrieval-feedback/` for a future `/enrich` or reducer batch to apply.
It never mutates the graph — read-only, suggest-only.

## Argument forms

| Form | Behaviour |
|---|---|
| `/retrieve "<question>" [--repo <repo>]` | Default. Spawn `graph-retriever` on the question. Repo defaults to `odd-platform`. |
| `/retrieve` (no args) | Ask the maintainer for the question via `AskUserQuestion`, then proceed. |

## Prerequisites

- The graph query layer is installed: `lineage/_extractor/.venv/` exists with the
  `embeddings` extra (`uv sync --extra embeddings` in `lineage/_extractor`). If not, the
  retriever still runs graph-only (keyword-seeded) — degraded but functional.
- The substrate exists: `lineage/{repo}/nodes.jsonl` + `understanding/` sidecars + the
  reducer `detail/` dirs. The agent's first tool call builds the ephemeral graph (~8 s,
  one-time per substrate change; a build cache makes later calls sub-second).

## Protocol

### 1. Capture the question

If the maintainer passed it as the first argument, use it verbatim. If not, `AskUserQuestion`:

> "What do you want to retrieve? Free-form — the agent searches, reads, refines, and
> returns a cited answer set. Examples: 'every endpoint the alert API exposes', 'what
> reads the notifications config', 'which findings concern the lineage depth parameter'."

### 2. Resolve the repo

`--repo` flag, else default `odd-platform`.

### 3. Spawn the graph-retriever subagent

Spawn `graph-retriever` (`.claude/agents/graph-retriever.md`) with a prompt that gives it:

- the maintainer's question, verbatim;
- the repo;
- the reminder that it has `≤10` iterations, must cite every answer node
  `source_file:source_line`, must stay read-only on the graph, and must write any
  substrate-refinement suggestions to `lineage/{repo}/retrieval-feedback/{date}-{slug}.md`.

The agent owns the loop — query construction, iteration, adaptive traversal depth,
convergence, and the suggestion side-channel. Do not micro-manage it.

### 4. Relay

Relay the agent's answer to the maintainer: the cited answer node set, the confidence, and
the iteration trace. If the agent wrote a `retrieval-feedback/` file, surface its path —
those suggestions are input for the next enrichment batch.

## Notes

- `/retrieve` supersedes the `registry-search` subagent for query/dedup needs. A reducer
  doing cross-batch dedup can spawn `graph-retriever` with a `dedup-nearest`-shaped
  question instead of grep-over-sharded-indexes.
- The retrieval result is advisory. The maintainer applies judgment — the agent finds and
  cites; it does not decide.
- Case-law / design: `adrs/drafts/agentic-graph-retriever.md`; tool layer:
  `adrs/drafts/graph-query-layer.md`.
