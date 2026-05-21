# The derived graph query layer

A query accelerator over the agentic-code-ontology files. For each local run it
deterministically builds — **from the canonical `lineage/{repo}/` files** — an
ephemeral property graph + vector index, and answers queries with hybrid
retrieval: vector similarity finds entry points, deterministic graph traversal
does the structural work.

Decision + rationale: **`adrs/drafts/graph-query-layer.md`** (accepted, rev 7).
Methodology section: **`APPROACH.md` §17**.

## The contract — what is canonical, what is disposable

| Canonical (source of truth) | Derived (disposable accelerator) |
|---|---|
| `nodes.jsonl`, `edges.jsonl` | the `rustworkx` property graph |
| the per-node sidecars (`understanding/*.md`) | the embedding vectors |
| the six reducer `detail/` files | `lineage/{repo}/graph/` (git-ignored) |

The graph is **rebuilt from the files every run**, never hand-edited, never
committed. To change what the graph says, edit a sidecar or reducer output and
rebuild. If `lineage/{repo}/graph/` is deleted, nothing is lost — the next
build recreates it. This is why the layer reconciles with `LSN-016`: it is an
index, not a source; the substrate stays agentic.

## Install

```bash
cd lineage/_extractor
uv sync                      # graph-only (rustworkx + numpy)
uv sync --extra embeddings   # + the vector half (fastembed + a local ONNX model)
```

The `embeddings` extra is optional. Without it — or if the model cannot load —
the layer runs **graph-only**: `traverse` and `provenance` are unaffected;
`query` falls back from vector-seeded to keyword-seeded retrieval.

## CLI

```bash
# build / refresh the ephemeral layer and print stats
uv run lineage-extractor graph-build odd-platform

# shape A — hybrid query (vector entry points + bounded graph traversal)
uv run lineage-extractor query odd-platform "per-alert authorization gap"
uv run lineage-extractor query odd-platform "view-count doubling" --label Finding --k 10 --json

# shape C — impact-of-a-file: every artefact resting on a path
uv run lineage-extractor provenance odd-platform AlertServiceImpl.java

# score against the maintainer-authored gold set (PROBES family 1)
uv run lineage-extractor query-probe odd-platform
```

Every result carries `source_file:source_line` — a query never breaks the
Gate-9 provenance chain.

## Library

```python
from pathlib import Path
from lineage_extractor.graph_query import GraphQuery

gq = GraphQuery.build(Path("lineage/odd-platform"))          # cache-checked rebuild

gq.query("per-alert authorization", k=8, hops=2,             # shape A — hybrid
         edge_filter={"SURFACES_FINDING", "IMPLIES_ADR", "EXPOSES"})

gq.traverse(label="Finding",                                 # shape B — graph-only predicate
            where={"finding_kind": "security", "severity": "HIGH"})

gq.provenance("AlertServiceImpl.java")                       # shape C — impact-of-a-file
```

`GraphQuery.build(..., embeddings=False)` skips the vector half entirely
(fast, graph-only).

## How it works

```
canonical files → loaders → records → projector → rustworkx graph ┐
                                                                   ├→ GraphQuery
                          embedder → vector index (cache-checked) ─┘
```

* **loaders** — parse `nodes.jsonl` / `edges.jsonl` / sidecars / the six reducer
  `detail/` dirs into typed records. A file that does not parse is skipped and
  reported, never coerced.
* **projector** — project the records into an 11-label property graph; every
  node and edge carries `source_file:source_line` (the build raises otherwise).
  Deterministic — sorted iteration, content-derived ids.
* **embedder** — embed sidecar sections / concept glosses / reducer entries at
  section granularity; cache keyed `(text-hash, model-id)` so an unchanged
  section is never re-embedded.
* **query** — `query()` = vector top-k seeds → bounded 2-hop BFS → Reciprocal
  Rank Fusion; `traverse()` / `provenance()` are pure graph walks. Every shape
  caps its result payload at 25k tokens.

Build cost (odd-platform substrate, ~4,400 vectors): **cold ~18 min** —
one-time per environment, CPU-bound embedding, parallelisable via `fastembed`'s
`parallel` workers; **warm ~8 s** — only changed sections re-embed, the rest
hit the `(text-hash, model-id)` cache.

## Embedding model

The ADR's lead candidate is EmbeddingGemma-300m; it is **not** in `fastembed`'s
supported-model registry. The research (`STACK`, `SCHEMA`) flagged the model as
a probe-time decision, so the implementation defaults to **`BAAI/bge-small-en-v1.5`**
(MIT, 384-dim, retrieval-tuned, fastembed-native, deterministic on CPU) — a
one-line constant in `config.py` that the embedding cache keys on. The maiden
gold-set run settles the final choice; `fastembed.add_custom_model` keeps
EmbeddingGemma reachable without a code change.

## Status — shadow mode

The layer runs **alongside** the grep/Python query path. It replaces that path
only when the five-family maiden gate passes — which needs the maintainer to
author `lineage/{repo}/query-gold-set.yaml` (a template ships). Until then the
Python path stays authoritative.

Deferred to v0.2 (documented in the ADR): the `CANONICALISES` and `CONTRADICTS`
relationship types (2 of 13); a persistent graph-pickle cache for sub-second
repeat queries within a session.
