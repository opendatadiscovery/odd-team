"""Embedder — section-granularity vectors for the hybrid query's entry points.

Embeds the *distilled natural-language prose* the methodology already produced
(sidecar sections, concept glosses, reducer entries, code descriptors) — never
raw code. The vectors only *find entry points*; deterministic graph traversal
does the structural work. This is the LSN-016 reconciliation in code: embeddings
are a query accelerator, never the representation.

Two design rules carried from the ADR / SCHEMA:

1. **Local + offline.** Embeddings come from a local ONNX model via `fastembed`
   — no hosted endpoint, no per-rebuild API cost.
2. **Graph-only fallback.** `fastembed` is an optional extra. If it (or its
   model) is unavailable, `Embedder.available` is False and the layer degrades
   to a pure deterministic traversal index — still useful, just without the
   semantic-entry shape. The build never fails for want of embeddings.

The embedding cache is keyed `(sha256(text), model_id)` — a section whose text
is byte-identical to a previous run, under the same model, is a cache hit and
is not re-embedded. This mirrors the enrichment-cache invariant and is what
makes "ephemeral, rebuilt each run" practical.
"""
from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np

from lineage_extractor.graph_query import config
from lineage_extractor.graph_query.projector import OntologyGraph


@dataclass
class VectorIndex:
    """An in-memory matrix of L2-normalized embeddings + row provenance.

    `matrix[i]` is the unit vector for `rows[i]` == (graph node key, unit name).
    Cosine similarity is therefore a plain dot product. When `available` is
    False the index is empty and the query layer runs graph-only."""

    model_id: str
    matrix: np.ndarray                       # (N, dim) float32, rows L2-normalized
    rows: list[tuple[str, str]]              # row i -> (node_key, unit_name)
    available: bool = True
    stats: dict = field(default_factory=dict)

    def topk(self, query_vec: np.ndarray, k: int) -> list[tuple[int, float]]:
        """Exact brute-force cosine top-k. At a few thousand vectors this is a
        sub-millisecond, fully deterministic matmul — no ANN index, no ANN
        non-determinism (STACK: "adopt that for the vector half")."""
        if self.matrix.size == 0:
            return []
        scores = self.matrix @ query_vec
        k = min(k, scores.shape[0])
        # argpartition for speed, then a stable sort by (-score, row) so ties
        # break deterministically — required by PROBES family-4.
        top = np.argpartition(-scores, k - 1)[:k]
        ordered = sorted(top, key=lambda i: (-float(scores[i]), i))
        return [(int(i), float(scores[i])) for i in ordered]


class Embedder:
    """Loads the local embedding model (lazily) and embeds the graph corpus."""

    def __init__(self, model_id: str = config.EMBEDDING_MODEL) -> None:
        self.model_id = model_id
        self._model = None
        self.available = False
        self.load_error: str | None = None
        try:
            from fastembed import TextEmbedding

            self._model = TextEmbedding(model_name=model_id)
            self.available = True
        except Exception as exc:  # noqa: BLE001 — any failure -> graph-only
            self.load_error = f"{type(exc).__name__}: {exc}"

    # -- query side --------------------------------------------------------

    def embed_query(self, text: str) -> np.ndarray | None:
        """Embed one query string (uses the model's query-side prefix). Not
        cached — a query is one cheap embed per call."""
        if not self.available:
            return None
        vec = next(iter(self._model.query_embed([text])))
        return _normalize(np.asarray(vec, dtype=np.float32))

    # -- corpus side -------------------------------------------------------

    def embed_graph(self, graph: OntologyGraph, lineage_dir: Path) -> VectorIndex:
        """Embed every graph node's `embed_units` into a VectorIndex.

        Row order is deterministic — node keys sorted, units in stored order —
        so two builds of one commit produce a bit-identical matrix."""
        units: list[tuple[str, str, str]] = []   # (node_key, unit_name, embed_text)
        for key in sorted(graph._key_to_idx):    # noqa: SLF001 — deterministic order
            node = graph.get(key)
            if node is None:
                continue
            for unit_name, unit_text in node.embed_units:
                if unit_text and unit_text.strip():
                    # Contextual prefix (SCHEMA §2) keeps near-identical sections
                    # across nodes distinguishable; the cap bounds the text to
                    # the model's window — see config.MAX_EMBED_CHARS.
                    text = f"{node.node_id}\n{unit_text}"[: config.MAX_EMBED_CHARS]
                    units.append((key, unit_name, text))

        if not self.available:
            return VectorIndex(
                model_id=self.model_id, matrix=np.empty((0, 0), dtype=np.float32),
                rows=[], available=False,
                stats={"reason": self.load_error or "embeddings extra not installed",
                       "vector_count": 0},
            )

        cache_dir = config.embed_cache_dir(lineage_dir, self.model_id)
        cache_dir.mkdir(parents=True, exist_ok=True)

        vectors: list[np.ndarray | None] = [None] * len(units)
        misses: list[tuple[int, str]] = []
        hits = 0
        for i, (_key, _unit, text) in enumerate(units):
            cached = _cache_load(cache_dir, text)
            if cached is not None:
                vectors[i] = cached
                hits += 1
            else:
                misses.append((i, text))

        # Embed the misses in chunks — bounds peak memory and makes a crashed
        # build resumable (each chunk's cache entries are flushed before the
        # next runs).
        for start in range(0, len(misses), config.EMBED_CHUNK):
            chunk = misses[start : start + config.EMBED_CHUNK]
            fresh = self._model.embed(
                [text for _i, text in chunk], batch_size=config.EMBED_BATCH_SIZE
            )
            for (i, text), vec in zip(chunk, fresh):
                v = _normalize(np.asarray(vec, dtype=np.float32))
                vectors[i] = v
                _cache_store(cache_dir, text, v)

        matrix = (
            np.vstack(vectors).astype(np.float32)
            if vectors and all(v is not None for v in vectors)
            else np.empty((0, 0), dtype=np.float32)
        )
        return VectorIndex(
            model_id=self.model_id,
            matrix=matrix,
            rows=[(k, u) for k, u, _t in units],
            available=True,
            stats={
                "vector_count": len(units),
                "cache_hits": hits,
                "cache_misses": len(misses),
                "cache_hit_rate": round(hits / len(units), 4) if units else 0.0,
            },
        )


# --------------------------------------------------------------------------
# Cache + math helpers


def _normalize(vec: np.ndarray) -> np.ndarray:
    norm = float(np.linalg.norm(vec))
    return vec / norm if norm > 0 else vec


def _text_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _cache_load(cache_dir: Path, text: str) -> np.ndarray | None:
    path = cache_dir / f"{_text_hash(text)}.npy"
    if not path.is_file():
        return None
    try:
        return np.load(path)
    except Exception:  # noqa: BLE001 — a corrupt cache entry is just a miss
        return None


def _cache_store(cache_dir: Path, text: str, vec: np.ndarray) -> None:
    path = cache_dir / f"{_text_hash(text)}.npy"
    tmp = path.with_name(path.name + ".tmp")
    # Write through an open handle so numpy does not re-append `.npy`; the
    # atomic rename keeps a concurrent / interrupted build from seeing a
    # half-written cache entry.
    with open(tmp, "wb") as fh:
        np.save(fh, vec)
    tmp.replace(path)
