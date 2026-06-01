"""GraphQuery — the public query facade over the derived graph + vector index.

Three query shapes, all returning records that carry `source_file:source_line`
so the calling agent never breaks the Gate-9 provenance chain:

* ``query(text)``  — hybrid: vector top-k finds entry points, bounded graph
  traversal does the structural work, Reciprocal Rank Fusion ranks the union.
  Degrades to keyword-seeded traversal when the embedding half is unavailable.
* ``traverse(...)`` — pure graph predicate, no embedding (SCHEMA shape B).
* ``provenance(path)`` — every artefact whose claims rest on a given file
  (SCHEMA shape C — "what do I invalidate if I change this").

Per-query context cost is bounded: every shape caps its result payload at
``config.RESULT_TOKEN_CEILING`` — a query returns a small slice, never a
whole-index load.
"""
from __future__ import annotations

import hashlib
import pickle
import re
from dataclasses import dataclass, field
from pathlib import Path

from lineage_extractor.graph_query import config
from lineage_extractor.graph_query.embedder import Embedder, VectorIndex
from lineage_extractor.graph_query.loaders import load_substrate
from lineage_extractor.graph_query.projector import OntologyGraph, project

_WORD_RE = re.compile(r"[A-Za-z0-9_]{3,}")


@dataclass
class QueryResult:
    """One ranked hit. `hop` is graph distance from a seed (0 = a seed itself);
    `via` records how the node was reached."""

    label: str
    node_id: str
    title: str
    source_file: str
    source_line: int
    score: float
    hop: int = 0
    via: str = ""
    props: dict = field(default_factory=dict)

    def cite(self) -> str:
        """`source_file:source_line` — the clickable provenance anchor."""
        return f"{self.source_file}:{self.source_line}" if self.source_line else self.source_file

    def as_dict(self) -> dict:
        return {
            "label": self.label, "node_id": self.node_id, "title": self.title,
            "cite": self.cite(), "score": round(self.score, 5),
            "hop": self.hop, "via": self.via,
        }


class GraphQuery:
    """A built, queryable projection of one `lineage/{repo}/`."""

    def __init__(
        self,
        lineage_dir: Path,
        graph: OntologyGraph,
        vectors: VectorIndex,
        embedder: Embedder | None,
    ) -> None:
        self.lineage_dir = lineage_dir
        self.graph = graph
        self.vectors = vectors
        self._embedder = embedder
        # node_key -> best vector row + score, for fast seed lookup.
        self._best_vector: dict[str, tuple[int, float]] = {}
        for row, (key, _unit) in enumerate(vectors.rows):
            # rows are processed in score-agnostic order; the per-query topk
            # decides ranking, so here we only need any-row-per-node.
            self._best_vector.setdefault(key, (row, 0.0))
        # human node_id -> the graph keys that share it (a CodeNode and its
        # Sidecar share one node_id) — the resolver for the agentic primitives.
        self._node_id_keys: dict[str, list[str]] = {}
        for n in self.graph.all_nodes():
            self._node_id_keys.setdefault(n.node_id, []).append(n.key)

    # -- construction ------------------------------------------------------

    @classmethod
    def build(
        cls,
        lineage_dir: Path,
        *,
        embeddings: bool = True,
        model_id: str = config.EMBEDDING_MODEL,
    ) -> "GraphQuery":
        """Deterministically rebuild the ephemeral graph + vector index from
        the canonical files. A pickle build-cache keyed on the substrate file
        signature makes a repeat build sub-second — load_substrate + project +
        embed-cache-load only run when the substrate actually changed. This is
        what makes the agentic retriever's many tool calls practical.
        `embeddings=False` skips the embedding half (graph-only, faster)."""
        lineage_dir = Path(lineage_dir)
        sig = _build_signature(lineage_dir)
        cached = _load_built(lineage_dir, sig)
        if cached is not None:
            graph, vectors = cached
            embedder = Embedder(model_id=model_id) if embeddings else None
            if not embeddings:
                vectors = VectorIndex(model_id=model_id, matrix=_empty_matrix(),
                                      rows=[], available=False,
                                      stats={"reason": "graph-only build"})
            return cls(lineage_dir, graph, vectors, embedder)

        substrate = load_substrate(lineage_dir)
        graph = project(substrate)
        embedder = None
        if embeddings:
            embedder = Embedder(model_id=model_id)
            vectors = embedder.embed_graph(graph, lineage_dir)
            _save_built(lineage_dir, sig, graph, vectors)
        else:
            vectors = VectorIndex(
                model_id=model_id, matrix=_empty_matrix(), rows=[],
                available=False, stats={"reason": "embeddings disabled for this build"},
            )
        return cls(lineage_dir, graph, vectors, embedder)

    # -- shape A: hybrid query --------------------------------------------

    def query(
        self,
        text: str,
        *,
        k: int = config.DEFAULT_K,
        hops: int = config.DEFAULT_HOPS,
        edge_filter: set[str] | None = None,
        label_filter: set[str] | None = None,
        limit: int = 30,
    ) -> list[QueryResult]:
        """Hybrid retrieval — vector top-k seeds, bounded BFS, RRF fusion.

        Falls back to keyword-seeded traversal when the embedding half is
        unavailable (the graph-only mode the ADR's residual-risk section
        names)."""
        seeds = self._vector_seeds(text, k) if self.vectors.available else self._keyword_seeds(text, k)
        if not seeds:
            return []

        # Rank-A: the seeds, by retrieval score.
        rank_a = {key: i + 1 for i, (key, _s) in enumerate(seeds)}
        seed_title = {key: (self.graph.get(key).title if self.graph.get(key) else key)
                      for key, _s in seeds}

        # Expand each seed; track the nearest hop + which seed reached it.
        best_hop: dict[str, int] = {}
        reached_via: dict[str, str] = {}
        for key, _score in seeds:
            best_hop.setdefault(key, 0)
            reached_via.setdefault(key, "vector-seed" if self.vectors.available else "keyword-seed")
            for nbr_key, hop in self.graph.neighbourhood(key, hops, edge_filter).items():
                if hop == 0:
                    continue
                if nbr_key not in best_hop or hop < best_hop[nbr_key]:
                    best_hop[nbr_key] = hop
                    reached_via[nbr_key] = f"{hop}-hop from {seed_title[key]}"

        # Rank-B: the whole reached set, by (hop, then seed rank).
        ordered_b = sorted(
            best_hop,
            key=lambda key_: (best_hop[key_], rank_a.get(key_, len(seeds) + 1), key_),
        )
        rank_b = {key: i + 1 for i, key in enumerate(ordered_b)}

        # Reciprocal Rank Fusion of the two signals.
        fused: list[QueryResult] = []
        for key in best_hop:
            node = self.graph.get(key)
            if node is None:
                continue
            if label_filter and node.label not in label_filter:
                continue
            rrf = 0.0
            if key in rank_a:
                rrf += 1.0 / (config.RRF_K + rank_a[key])
            if key in rank_b:
                rrf += 1.0 / (config.RRF_K + rank_b[key])
            fused.append(
                QueryResult(
                    label=node.label, node_id=node.node_id, title=node.title,
                    source_file=node.source_file, source_line=node.source_line,
                    score=rrf, hop=best_hop[key], via=reached_via.get(key, ""),
                    props=node.props,
                )
            )
        fused.sort(key=lambda r: (-r.score, r.hop, r.node_id))
        # A node and its sidecar share a node_id — collapse them to one result
        # so the same logical node is never listed twice.
        return _cap(_dedup_by_node_id(fused)[:limit])

    # -- shape B: pure graph predicate ------------------------------------

    def traverse(
        self,
        *,
        label: str,
        where: dict | None = None,
        expand: str | None = None,
        neighbor_label: str | None = None,
        neighbor_where: dict | None = None,
        limit: int = 200,
    ) -> list[QueryResult]:
        """Graph-only predicate (no embedding). Find `label` nodes matching
        `where`; if `expand` is given, keep only those with an `expand`-typed
        edge to a `neighbor_label` node matching `neighbor_where`."""
        out: list[QueryResult] = []
        for key in self.graph.keys_by_label(label):
            node = self.graph.get(key)
            if node is None or not _matches(node.props, where):
                continue
            if expand is not None:
                if not self._has_qualifying_edge(key, expand, neighbor_label, neighbor_where):
                    continue
            out.append(
                QueryResult(
                    label=node.label, node_id=node.node_id, title=node.title,
                    source_file=node.source_file, source_line=node.source_line,
                    score=1.0, hop=0, via="graph-predicate", props=node.props,
                )
            )
        out.sort(key=lambda r: r.node_id)
        return _cap(_dedup_by_node_id(out)[:limit])

    # -- shape C: provenance / impact-of-a-file ---------------------------

    def provenance(self, path_fragment: str, *, hops: int = 1, limit: int = 200) -> list[QueryResult]:
        """Every artefact whose claims rest on `path_fragment` — matched
        against both the lineage `source_file` and a CodeNode's code `path`.
        Returns the direct matches plus their `hops`-bounded neighbourhood."""
        frag = path_fragment.strip()
        direct: list[str] = []
        for node in self.graph.all_nodes():
            if frag in (node.source_file or "") or frag in str(node.props.get("path", "")):
                direct.append(node.key)
        seen: dict[str, int] = {key: 0 for key in direct}
        for key in direct:
            for nbr, hop in self.graph.neighbourhood(key, hops).items():
                if nbr not in seen or hop < seen[nbr]:
                    seen[nbr] = hop
        out: list[QueryResult] = []
        for key, hop in seen.items():
            node = self.graph.get(key)
            if node is None:
                continue
            out.append(
                QueryResult(
                    label=node.label, node_id=node.node_id, title=node.title,
                    source_file=node.source_file, source_line=node.source_line,
                    score=1.0, hop=hop, via="direct" if hop == 0 else f"{hop}-hop",
                    props=node.props,
                )
            )
        out.sort(key=lambda r: (r.hop, r.label, r.node_id))
        return _cap(_dedup_by_node_id(out)[:limit])

    # -- introspection -----------------------------------------------------

    def stats(self) -> dict:
        return {
            "repo": self.graph.repo,
            "nodes": self.graph.node_count(),
            "edges": self.graph.edge_count(),
            "stub_nodes": self.graph.stub_count,
            "labels": self.graph.label_counts(),
            "edge_types": self.graph.edge_type_counts(),
            "skipped_files": len(self.graph.skipped),
            "embeddings_available": self.vectors.available,
            "vector_count": self.vectors.stats.get("vector_count", 0),
            "embedding_model": self.vectors.model_id,
            "embedding_stats": self.vectors.stats,
        }

    # -- agentic primitives ------------------------------------------------
    # Small, composable, deterministic tools for the graph-retriever subagent
    # (adrs/drafts/agentic-graph-retriever.md). The agent is the intelligence;
    # these never reason, never iterate — they just answer one question each.

    def search(
        self, text: str, *, k: int = 12, label_filter: set[str] | None = None,
    ) -> list[QueryResult]:
        """Pure semantic search — vector top-k entry points, NO graph expansion.
        Degrades to keyword search when the embedding half is unavailable.
        `label_filter` scopes results to specific node labels — used by the
        reducers to dedup a fresh finding against only its own artefact's
        nodes (e.g. a RefactoringScope finding against RefactoringScope nodes)."""
        # When filtering, over-fetch so the post-filter slice still yields ~k.
        pool = k * 8 if label_filter else k
        seeds = (self._vector_seeds(text, pool) if self.vectors.available
                 else self._keyword_seeds(text, pool))
        via = "vector" if self.vectors.available else "keyword"
        out: list[QueryResult] = []
        for key, score in seeds:
            node = self.graph.get(key)
            if node is None:
                continue
            if label_filter and node.label not in label_filter:
                continue
            out.append(QueryResult(
                label=node.label, node_id=node.node_id, title=node.title,
                source_file=node.source_file, source_line=node.source_line,
                score=score, hop=0, via=via, props=node.props))
        return _dedup_by_node_id(out)[:k]

    def node(self, node_id: str) -> dict | None:
        """The full content of one node — every graph node sharing this node_id
        merged, plus the sections of any finding it surfaces. This is the
        'entire node description' the retriever reads to judge relevance."""
        keys = self._node_id_keys.get(node_id)
        if not keys:
            return None
        labels, props, sections, src_file, src_line, title = [], {}, [], "", 0, node_id
        for key in keys:
            n = self.graph.get(key)
            if n is None:
                continue
            labels.append(n.label)
            props.update(n.props)
            src_file = src_file or n.source_file
            src_line = src_line or n.source_line
            if n.title:
                title = n.title
            for unit_name, unit_text in n.embed_units:
                sections.append({"section": unit_name, "text": unit_text})
            # pull in the surfaced findings so one call gives the whole picture
            for direction, etype, other in self.graph.edges_of(key):
                if direction == "out" and etype == config.E_SURFACES_FINDING:
                    fn = self.graph.get(other)
                    if fn is not None:
                        for un, ut in fn.embed_units:
                            sections.append({"section": f"finding:{un}", "text": ut})
        return {
            "node_id": node_id, "labels": labels, "title": title,
            "source_file": src_file, "source_line": src_line, "props": props,
            "sections": sections,
            "neighbour_count": len(self.neighbours(node_id)),
        }

    def neighbours(self, node_id: str) -> list[dict]:
        """The node's adjacency — one row per edge: direction, edge type, and
        the neighbour's id / label / title. Lets the agent decide where to walk."""
        keys = self._node_id_keys.get(node_id) or []
        seen: set[tuple[str, str, str]] = set()
        out: list[dict] = []
        for key in keys:
            for direction, etype, other_key in self.graph.edges_of(key):
                other = self.graph.get(other_key)
                if other is None:
                    continue
                sig = (direction, etype, other.node_id)
                if sig in seen:
                    continue
                seen.add(sig)
                out.append({
                    "direction": direction, "edge_type": etype,
                    "node_id": other.node_id, "label": other.label,
                    "title": other.title,
                })
        out.sort(key=lambda r: (r["direction"], r["edge_type"], r["node_id"]))
        return out

    def subgraph(
        self, node_id: str, *, depth: int = 2, edge_filter: set[str] | None = None,
        limit: int = 80,
    ) -> list[QueryResult]:
        """A bounded subgraph around a node — the agent picks `depth` and the
        `edge_filter`. The hop bound + token cap keep the payload bounded."""
        keys = self._node_id_keys.get(node_id) or []
        best_hop: dict[str, int] = {}
        for key in keys:
            for nbr_key, hop in self.graph.neighbourhood(key, depth, edge_filter).items():
                if nbr_key not in best_hop or hop < best_hop[nbr_key]:
                    best_hop[nbr_key] = hop
        out: list[QueryResult] = []
        for key, hop in best_hop.items():
            n = self.graph.get(key)
            if n is not None:
                out.append(QueryResult(
                    label=n.label, node_id=n.node_id, title=n.title,
                    source_file=n.source_file, source_line=n.source_line,
                    score=1.0 / (1 + hop), hop=hop, via=f"{hop}-hop", props=n.props))
        out.sort(key=lambda r: (r.hop, r.label, r.node_id))
        return _cap(_dedup_by_node_id(out)[:limit])

    # -- internals ---------------------------------------------------------

    def _vector_seeds(self, text: str, k: int) -> list[tuple[str, float]]:
        """Vector top-k -> best row per graph node, score-ordered."""
        qv = self._embedder.embed_query(text) if self._embedder else None
        if qv is None:
            return self._keyword_seeds(text, k)
        # Over-fetch so that collapsing multi-unit nodes still yields ~k seeds.
        raw = self.vectors.topk(qv, k * 4)
        best: dict[str, float] = {}
        for row, score in raw:
            key, _unit = self.vectors.rows[row]
            if key not in best or score > best[key]:
                best[key] = score
        ranked = sorted(best.items(), key=lambda kv: (-kv[1], kv[0]))
        return ranked[:k]

    def _keyword_seeds(self, text: str, k: int) -> list[tuple[str, float]]:
        """Graph-only fallback — score nodes by query-token overlap with their
        title / id / key. Lexical, deterministic, no embedding."""
        tokens = {t.lower() for t in _WORD_RE.findall(text)}
        if not tokens:
            return []
        scored: list[tuple[str, float]] = []
        for node in self.graph.all_nodes():
            haystack = f"{node.node_id} {node.title}".lower()
            hits = sum(1 for t in tokens if t in haystack)
            if hits:
                scored.append((node.key, float(hits)))
        scored.sort(key=lambda kv: (-kv[1], kv[0]))
        return scored[:k]

    def _has_qualifying_edge(
        self, key: str, edge_type: str, neighbor_label: str | None, neighbor_where: dict | None
    ) -> bool:
        for _direction, etype, other_key in self.graph.edges_of(key):
            if etype != edge_type:
                continue
            other = self.graph.get(other_key)
            if other is None:
                continue
            if neighbor_label and other.label != neighbor_label:
                continue
            if _matches(other.props, neighbor_where):
                return True
        return False


# --------------------------------------------------------------------------
# Helpers


def _empty_matrix():
    import numpy as np

    return np.empty((0, 0), dtype=np.float32)


# -- the pickle build-cache --------------------------------------------------
# A built (graph, vectors) pair is pickled keyed on a signature of the
# substrate files. A repeat build with an unchanged substrate unpickles in
# sub-second time instead of re-parsing ~2,700 files. Ephemeral + git-ignored
# (it lives under graph/.cache/); a stale or corrupt entry is silently a miss.

_SUBSTRATE_DIRS = (
    "understanding", "concepts/detail", "implicit-adrs/detail",
    "refactoring-scopes/detail", "doc-gaps/detail", "test-map/detail",
    "feature-flows/detail", "feature-reflections/detail",
    "doc-understanding",
)


def _build_signature(lineage_dir: Path) -> str:
    """A content signature of every canonical substrate file — (path, mtime,
    size). Any edit to any file changes it, correctly invalidating the cache.

    For the documentation axis the doc PROSE lives in `../documentation`
    (reference-upstream — not committed here), so an upstream prose edit would
    otherwise not invalidate the cache. When `doc-nodes.jsonl` exists we fold the
    upstream docs files' (path, mtime, size) into the signature too, so editing a
    doc page and rebuilding re-embeds it (only the changed sections, via the
    embed cache)."""
    parts: list[tuple[str, int, int]] = []
    # All top-level generated mirrors — incl. the ground-truth anchors
    # (adr-nodes / test-nodes), else an `adrs-ingest` / `tests-ingest` does not
    # invalidate the cache and `graph-build` silently serves a stale graph.
    for name in ("nodes.jsonl", "edges.jsonl", "doc-nodes.jsonl", "adr-nodes.jsonl", "test-nodes.jsonl"):
        p = lineage_dir / name
        if p.is_file():
            st = p.stat()
            parts.append((name, st.st_mtime_ns, st.st_size))
    for sub in _SUBSTRATE_DIRS:
        base = lineage_dir / sub
        if base.is_dir():
            for f in base.rglob("*"):
                if f.is_file():
                    st = f.stat()
                    parts.append((str(f.relative_to(lineage_dir)), st.st_mtime_ns, st.st_size))
    if (lineage_dir / "doc-nodes.jsonl").is_file():
        docs_root = (lineage_dir.parent.parent / ".." / "documentation" / "docs").resolve()
        if docs_root.is_dir():
            for f in sorted(docs_root.rglob("*.md")):
                st = f.stat()
                parts.append((f"upstream::{f.relative_to(docs_root)}", st.st_mtime_ns, st.st_size))
    return hashlib.sha256(repr(sorted(parts)).encode()).hexdigest()[:16]


def _cache_path(lineage_dir: Path) -> Path:
    return config.graph_dir(lineage_dir) / ".cache" / "built.pkl"


def _load_built(lineage_dir: Path, sig: str):
    """Return the cached (graph, vectors) if the signature still matches."""
    path = _cache_path(lineage_dir)
    if not path.is_file():
        return None
    try:
        with open(path, "rb") as fh:
            data = pickle.load(fh)
        if data.get("sig") != sig:
            return None
        return data["graph"], data["vectors"]
    except Exception:  # noqa: BLE001 — a corrupt/incompatible cache is just a miss
        return None


def _save_built(lineage_dir: Path, sig: str, graph, vectors) -> None:
    """Pickle the built (graph, vectors). Best-effort — a failure to cache
    never fails the build."""
    path = _cache_path(lineage_dir)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    try:
        with open(tmp, "wb") as fh:
            pickle.dump({"sig": sig, "graph": graph, "vectors": vectors}, fh,
                        protocol=pickle.HIGHEST_PROTOCOL)
        tmp.replace(path)
    except Exception:  # noqa: BLE001
        tmp.unlink(missing_ok=True)


def _matches(props: dict, where: dict | None) -> bool:
    """A node matches `where` when every key equals (case-insensitively for
    strings) the node's property."""
    if not where:
        return True
    for field_name, expected in where.items():
        actual = props.get(field_name)
        if isinstance(expected, str) and isinstance(actual, str):
            if expected.lower() != actual.lower():
                return False
        elif actual != expected:
            return False
    return True


def _dedup_by_node_id(results: list[QueryResult]) -> list[QueryResult]:
    """Collapse results that share a `node_id` — a CodeNode and its Sidecar are
    one logical node and must not occupy two result slots. Input is assumed
    sorted best-first, so the first occurrence (best-ranked) is kept."""
    seen: dict[str, QueryResult] = {}
    for r in results:
        if r.node_id not in seen:
            seen[r.node_id] = r
    return list(seen.values())


def _cap(results: list[QueryResult]) -> list[QueryResult]:
    """Enforce the PROBES family-2 per-query payload ceiling — a query result
    must never force a monolith-sized load."""
    out: list[QueryResult] = []
    budget = 0.0
    for r in results:
        cost = (len(r.title) + len(r.node_id) + len(r.source_file) + 48) * config.TOKENS_PER_CHAR
        if budget + cost > config.RESULT_TOKEN_CEILING:
            break
        budget += cost
        out.append(r)
    return out
