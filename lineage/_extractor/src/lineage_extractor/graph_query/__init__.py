"""The derived graph query layer.

Per `adrs/drafts/graph-query-layer.md`: for each local run, deterministically
build — from the canonical `lineage/{repo}/` files — an *ephemeral, git-ignored*
property graph + vector index, and query it with hybrid retrieval (vector
similarity finds entry points; deterministic graph traversal does the structural
work).

The canonical file artefacts (`nodes.jsonl`, `edges.jsonl`, the per-node
sidecars, the reducer `detail/` files) are **unchanged and remain the sole
source of truth**. The graph is a disposable accelerator — never hand-edited,
never committed. Per-query context cost is bounded: a query returns a small
subgraph / top-k slice, never a whole-index load.

Public surface:

    from lineage_extractor.graph_query import GraphQuery
    gq = GraphQuery.build(lineage_dir)        # cache-checked rebuild; ephemeral
    gq.query("per-alert authorization", k=8)  # hybrid: vector seed + graph hop
    gq.traverse(label="CodeNode", kind="controller-method", ...)  # graph-only
    gq.provenance(source_file=".../AlertServiceImpl.java")        # impact-of-file
"""
from __future__ import annotations

from typing import Any

__all__ = ["GraphQuery", "QueryResult"]


def __getattr__(name: str) -> Any:
    """Lazy re-export — keeps submodules importable without an eager import chain."""
    if name in __all__:
        from lineage_extractor.graph_query.graph_query import GraphQuery, QueryResult

        return {"GraphQuery": GraphQuery, "QueryResult": QueryResult}[name]
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
