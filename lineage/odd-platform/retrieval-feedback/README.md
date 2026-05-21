# retrieval-feedback — substrate-improvement suggestions from the retriever

One file per `/retrieve` run: `{YYYY-MM-DD}-{slug}.md`. Written by the
**`graph-retriever`** subagent (`.claude/agents/graph-retriever.md`); per
`adrs/drafts/agentic-graph-retriever.md`.

## Why this directory exists

Retrieval is also a **substrate-quality probe**. When the retriever pulls a node
that is returned-but-wrong because the *substrate itself* is weak — a sidecar too
thin to judge, a description that mis-states what the code does, a stale finding,
embed text that buries the signal, an edge that should exist and does not — that
is signal worth keeping. The retriever records it here.

The retriever is **read-only on the graph and the substrate**. It never edits a
sidecar, a reducer file, `nodes.jsonl`, or the graph. It only *suggests*. Applying
a suggestion is a later, deliberate batch action — improving the substrate is the
only legitimate way to improve the graph (the graph is rebuilt from the substrate).

## File shape

```markdown
# Retrieval feedback — {query} — {date}

## Retrieval
- query as asked: "..."
- final query: "..."
- answer: {node_ids} · confidence {LEVEL} · {N} iterations

## Refinement suggestions
- node_id: "..."
  returned_for_query: "..."
  observed_problem: thin-sidecar | mis-description | stale-finding | weak-embed-text | missing-edge
  evidence: "what the retriever saw that flagged it"
  suggested_refinement: "the concrete change a future batch should make"
  retriever_confidence: HIGH | MEDIUM | LOW
```

A run with no substrate problem writes only the `## Retrieval` section, or no file.

## Consumption contract

A future `/enrich` or reducer batch reads this directory, groups suggestions by
`node_id`, and applies the high-confidence ones — re-enriching a thin sidecar,
correcting a mis-description, refreshing a stale finding, or patching a reducer
prompt so a missing edge gets surfaced. Applied suggestions are struck through
(or the file moved to a `applied/` subdir) so the queue does not re-process them.

This operationalises the principle that the graph's information must be
**continuously verified, stressed, and improved** — the retriever is one of its
improvement sources, alongside the Stress Protocol and the Adversarial Review Panel.
