"""Projector — turn a parsed `Substrate` into an in-process property graph.

The graph is a **pure projection**: it adds no facts the canonical files do not
already state. It joins them. `nodes.jsonl` / `edges.jsonl` / sidecars / the six
reducers are six loosely-coupled file sets; the projector wires them into one
traversable labeled-property graph so a query can mix a structural hop with a
semantic hop in a single walk.

Universal provenance (SCHEMA §1): every node and every edge carries
`source_file` + `source_line`. A graph element with no provenance is a build
bug — `project()` raises rather than emit it.

Determinism (SCHEMA §3.1): nodes/edges are added in a fixed label order over
the already-sorted loader output, so two builds of one commit are identical and
rustworkx node indices are stable.
"""
from __future__ import annotations

import posixpath
import re
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Iterator

import rustworkx

from lineage_extractor.graph_query import config
from lineage_extractor.graph_query.records import Substrate

# Sidecar sections that are findings in their own right — each becomes a Finding
# node carrying that section's vector; the remaining sections embed on the Sidecar.
FINDING_SECTIONS = (
    "bugs_limitations_corner_cases",
    "security",
    "performance",
    "stress_findings",
)
_URL_RE = re.compile(r"https?://[^\s)\]<>\"'`]+")
_LIST_TOKENS_RE = re.compile(r"(?:entities|operations)\s*:\s*\[([^\]]*)\]")


# --------------------------------------------------------------------------
# Graph element payloads


@dataclass
class GraphNode:
    """A node payload. `key` is the internal label-prefixed unique id;
    `node_id` is the human-facing id a query result cites."""

    label: str
    key: str
    node_id: str
    title: str
    source_file: str
    source_line: int
    props: dict = field(default_factory=dict)
    # (unit_name, text) pairs the embedder turns into vectors. May be empty
    # (CodeNodes with no descriptor, Doc nodes — graph-only nodes).
    embed_units: list[tuple[str, str]] = field(default_factory=list)


@dataclass
class GraphEdge:
    """An edge payload — a typed relationship asserted by `source_file`."""

    type: str
    source_file: str
    source_line: int
    props: dict = field(default_factory=dict)


# --------------------------------------------------------------------------
# The graph


class OntologyGraph:
    """A rustworkx-backed labeled property graph + the indices a query needs."""

    def __init__(self, repo: str) -> None:
        self.repo = repo
        self._g: rustworkx.PyDiGraph = rustworkx.PyDiGraph()
        self._key_to_idx: dict[str, int] = {}
        self._label_keys: dict[str, list[str]] = defaultdict(list)
        self._edge_keys: set[tuple[int, int, str]] = set()
        self.stub_count = 0
        self.skipped: list[tuple[str, str]] = []

    # -- construction ------------------------------------------------------

    def add_node(self, node: GraphNode) -> int:
        idx = self._key_to_idx.get(node.key)
        if idx is not None:
            return idx
        idx = self._g.add_node(node)
        self._key_to_idx[node.key] = idx
        self._label_keys[node.label].append(node.key)
        return idx

    def add_edge(self, src_key: str, dst_key: str, edge: GraphEdge) -> bool:
        """Add a typed edge. Returns False (no-op) if an endpoint is unknown or
        the (src, dst, type) edge already exists — keeps the graph a simple
        deterministic multigraph without parallel duplicates."""
        src = self._key_to_idx.get(src_key)
        dst = self._key_to_idx.get(dst_key)
        if src is None or dst is None:
            return False
        sig = (src, dst, edge.type)
        if sig in self._edge_keys:
            return False
        self._edge_keys.add(sig)
        self._g.add_edge(src, dst, edge)
        return True

    # -- lookup ------------------------------------------------------------

    def has(self, key: str) -> bool:
        return key in self._key_to_idx

    def get(self, key: str) -> GraphNode | None:
        idx = self._key_to_idx.get(key)
        return self._g[idx] if idx is not None else None

    def keys_by_label(self, label: str) -> list[str]:
        return list(self._label_keys.get(label, ()))

    def all_nodes(self) -> Iterator[GraphNode]:
        for idx in self._g.node_indices():
            yield self._g[idx]

    def node_count(self) -> int:
        return self._g.num_nodes()

    def edge_count(self) -> int:
        return self._g.num_edges()

    def label_counts(self) -> dict[str, int]:
        return {label: len(keys) for label, keys in sorted(self._label_keys.items())}

    def edge_type_counts(self) -> dict[str, int]:
        counts: dict[str, int] = defaultdict(int)
        for _s, _d, edge in self._g.weighted_edge_list():
            counts[edge.type] += 1
        return dict(sorted(counts.items()))

    # -- traversal ---------------------------------------------------------

    def edges_of(self, key: str) -> list[tuple[str, str, str]]:
        """[(direction, edge_type, other_key)] for one node — `direction` is
        'out' or 'in'."""
        idx = self._key_to_idx.get(key)
        if idx is None:
            return []
        out: list[tuple[str, str, str]] = []
        for _s, dst, edge in self._g.out_edges(idx):
            out.append(("out", edge.type, self._g[dst].key))
        for src, _d, edge in self._g.in_edges(idx):
            out.append(("in", edge.type, self._g[src].key))
        return out

    def neighbourhood(
        self, start_key: str, hops: int, edge_filter: set[str] | None = None
    ) -> dict[str, int]:
        """Bounded bidirectional BFS — {node_key: hop_distance} within `hops`
        of `start_key`. The bound is the safety rail against pulling the whole
        graph into a query result (SCHEMA §4.1)."""
        start = self._key_to_idx.get(start_key)
        if start is None:
            return {}
        dist: dict[int, int] = {start: 0}
        frontier = [start]
        for hop in range(1, hops + 1):
            nxt: list[int] = []
            for idx in frontier:
                for _s, dst, edge in self._g.out_edges(idx):
                    if edge_filter and edge.type not in edge_filter:
                        continue
                    if dst not in dist:
                        dist[dst] = hop
                        nxt.append(dst)
                for src, _d, edge in self._g.in_edges(idx):
                    if edge_filter and edge.type not in edge_filter:
                        continue
                    if src not in dist:
                        dist[src] = hop
                        nxt.append(src)
            frontier = nxt
            if not frontier:
                break
        return {self._g[idx].key: d for idx, d in dist.items()}


# --------------------------------------------------------------------------
# Key helpers — internal label-prefixed unique keys


def _code_key(node_id: str) -> str:
    return f"code::{node_id}"


def _sidecar_key(node_id: str) -> str:
    return f"sidecar::{node_id}"


def _reducer_key(label: str, entry_id: str) -> str:
    return f"{label.lower()}::{entry_id}"


def _adr_key(adr_id: str) -> str:
    return f"adr::{adr_id}"


def _test_key(test_id: str) -> str:
    return f"test::{test_id}"


# --------------------------------------------------------------------------
# Projection


def project(substrate: Substrate) -> OntologyGraph:
    """Project a parsed Substrate into an OntologyGraph. Pure, deterministic."""
    g = OntologyGraph(substrate.repo)
    g.skipped = list(substrate.skipped)

    node_id_to_sidecar_key: dict[str, str] = {}
    slug_to_sidecar_key: dict[str, str] = {}
    concept_name_index: dict[str, str] = {}

    # 1 — CodeNodes (the structural spine).
    code_ids = {cn.node_id for cn in substrate.code_nodes}
    for cn in substrate.code_nodes:
        descriptor = f"{cn.kind} {cn.descriptor} {cn.package} {cn.path}".strip()
        g.add_node(
            GraphNode(
                label=config.L_CODE_NODE,
                key=_code_key(cn.node_id),
                node_id=cn.node_id,
                title=cn.descriptor or cn.node_id,
                source_file=cn.source_file,
                source_line=cn.source_line,
                props={
                    "axis": cn.axis, "kind": cn.kind, "repo": cn.repo,
                    "lang": cn.lang, "package": cn.package, "path": cn.path,
                    "metadata": cn.metadata,
                },
                embed_units=[("descriptor", descriptor)] if descriptor else [],
            )
        )

    # 1.5 — Documentation: content-bearing Doc nodes (ground-truth-lineage).
    # Projected before sidecars so the sidecar LINKS_DOC step can resolve a
    # code→doc URL to a real anchored section instead of a bare-URL stub.
    doc_url_index, doc_path_index = _project_doc_nodes(g, substrate)

    # 2 — Sidecars + Findings + Docs; wire ENRICHED_BY / SURFACES_FINDING / LINKS_DOC.
    for sc in substrate.sidecars:
        sc_key = _sidecar_key(sc.node_id)
        node_id_to_sidecar_key[sc.node_id] = sc_key
        slug_to_sidecar_key[sc.slug] = sc_key
        sidecar_embed: list[tuple[str, str]] = []
        for section in sc.sections:
            if not section.body or section.body.strip() in ("", "[]"):
                continue
            if section.name in FINDING_SECTIONS:
                f_key = f"finding::{sc.node_id}#{section.name}"
                g.add_node(
                    GraphNode(
                        label=config.L_FINDING,
                        key=f_key,
                        node_id=f"{sc.node_id}#{section.name}",
                        title=f"{section.name} — {sc.slug}",
                        source_file=sc.source_file,
                        source_line=section.line,
                        props={
                            "finding_kind": section.name,
                            "severity": _severity(section.body),
                        },
                        embed_units=[(section.name, section.body)],
                    )
                )
            else:
                sidecar_embed.append((section.name, section.body))
        g.add_node(
            GraphNode(
                label=config.L_SIDECAR,
                key=sc_key,
                node_id=sc.node_id,
                title=sc.slug,
                source_file=sc.source_file,
                source_line=1,
                props={
                    "slug": sc.slug,
                    "enrichment_status": sc.frontmatter.get("enrichment_status", ""),
                    "confidence_overall": sc.frontmatter.get("confidence_overall", ""),
                    "node_kind": sc.frontmatter.get("node_kind", ""),
                },
                embed_units=sidecar_embed,
            )
        )
        # ENRICHED_BY — CodeNode -> Sidecar (stub the CodeNode if unscaffolded).
        if sc.node_id not in code_ids:
            _add_stub_code_node(g, sc.node_id, sc.source_file)
        g.add_edge(
            _code_key(sc.node_id), sc_key,
            GraphEdge(config.E_ENRICHED_BY, sc.source_file, 1),
        )
        # SURFACES_FINDING — Sidecar -> Finding.
        for section in sc.sections:
            if section.name in FINDING_SECTIONS and section.body.strip() not in ("", "[]"):
                g.add_edge(
                    sc_key, f"finding::{sc.node_id}#{section.name}",
                    GraphEdge(config.E_SURFACES_FINDING, sc.source_file, section.line),
                )
        # LINKS_DOC — Sidecar -> Doc, one per unique URL in docs_link_semantic.
        # Resolve the WebFetched URL to a content-bearing Doc node when the live
        # URL matches an ingested section; otherwise fall back to a bare-URL stub
        # (an unresolved stub is itself a signal: code links to a doc URL that is
        # not in the ingested manual — a slug rewrite or a broken/external link).
        for section in sc.sections:
            if section.name != "docs_link_semantic":
                continue
            for url in sorted(set(_URL_RE.findall(section.body))):
                doc_key = _resolve_doc_url(url, doc_url_index)
                if doc_key is None:
                    doc_key = f"doc::{url}"
                    if not g.has(doc_key):
                        g.add_node(
                            GraphNode(
                                label=config.L_DOC, key=doc_key, node_id=url,
                                title=url, source_file=sc.source_file,
                                source_line=section.line,
                                props={"url": url, "ingested": False},
                            )
                        )
                g.add_edge(sc_key, doc_key,
                           GraphEdge(config.E_LINKS_DOC, sc.source_file, section.line))

    # 3 — Concepts.
    for concept in substrate.concepts:
        c_key = f"concept::{concept.concept_id}"
        g.add_node(
            GraphNode(
                label=config.L_CONCEPT,
                key=c_key,
                node_id=concept.concept_id,
                title=concept.canonical_name,
                source_file=concept.source_file,
                source_line=concept.source_line,
                props={"concept_type": concept.concept_type, "aliases": concept.aliases},
                embed_units=[("concept", f"{concept.canonical_name}. {concept.body}")],
            )
        )
        for name in [concept.canonical_name, *concept.aliases]:
            if name:
                concept_name_index.setdefault(name.strip().lower(), c_key)
        # MENTIONS_CONCEPT from a concept's own `nodes:` back-reference (audiences).
        for node_id in concept.cited_node_ids:
            sc_key = node_id_to_sidecar_key.get(node_id)
            if sc_key:
                g.add_edge(sc_key, c_key,
                           GraphEdge(config.E_MENTIONS_CONCEPT, concept.source_file, 1))

    # 4 — Reducer nodes (ImplicitADR / RefactoringScope / DocGap / TestGap /
    #     Feature / FeatureReflection).
    for rn in substrate.reducer_nodes:
        g.add_node(
            GraphNode(
                label=rn.label,
                key=_reducer_key(rn.label, rn.entry_id),
                node_id=rn.entry_id,
                title=rn.title,
                source_file=rn.source_file,
                source_line=rn.source_line,
                props=dict(rn.props),
                embed_units=[("entry", f"{rn.title}. {rn.body}".strip())],
            )
        )

    # 5 — Join edges from reducer nodes back to the sidecars / code nodes they cite.
    _join_label = {
        config.L_IMPLICIT_ADR: config.E_IMPLIES_ADR,
        config.L_DOC_GAP: config.E_HAS_DOC_GAP,
        config.L_REFACTOR_SCOPE: config.E_HAS_REFACTOR_SCOPE,
    }
    all_slugs = sorted(slug_to_sidecar_key)
    for rn in substrate.reducer_nodes:
        rkey = _reducer_key(rn.label, rn.entry_id)
        edge_type = _join_label.get(rn.label)
        if edge_type:  # markdown reducers cite sidecars by slug
            for slug in rn.cited_sidecar_slugs:
                sc_key = _resolve_sidecar(slug, slug_to_sidecar_key, all_slugs)
                if sc_key:
                    g.add_edge(sc_key, rkey,
                               GraphEdge(edge_type, rn.source_file, rn.source_line))
        elif rn.label == config.L_TEST_GAP:  # cites node_ids
            for node_id in rn.cited_node_ids:
                src = node_id_to_sidecar_key.get(node_id) or _code_key(node_id)
                if not g.has(src):
                    _add_stub_code_node(g, node_id, rn.source_file)
                    src = _code_key(node_id)
                g.add_edge(src, rkey,
                           GraphEdge(config.E_HAS_TEST_GAP, rn.source_file, rn.source_line))
        elif rn.label == config.L_FEATURE:  # PART_OF_FEATURE from contributing_nodes
            for node_id in rn.cited_node_ids:
                if not g.has(_code_key(node_id)):
                    _add_stub_code_node(g, node_id, rn.source_file)
                g.add_edge(_code_key(node_id), rkey,
                           GraphEdge(config.E_PART_OF_FEATURE, rn.source_file, rn.source_line))

    # 6 — REFLECTED_BY — Feature F-NNN -> FeatureReflection F-NNN (same id).
    for rn in substrate.reducer_nodes:
        if rn.label == config.L_FEATURE_REFLECTION:
            feature_key = _reducer_key(config.L_FEATURE, rn.entry_id)
            refl_key = _reducer_key(config.L_FEATURE_REFLECTION, rn.entry_id)
            g.add_edge(feature_key, refl_key,
                       GraphEdge(config.E_REFLECTED_BY, rn.source_file, rn.source_line))

    # 6.5 — Published ADRs (ground-truth-lineage Phase 2): ADR nodes +
    #       PROMOTED_TO / REALISES / SUPERSEDED_BY. Projected after the reducer
    #       nodes (so the ImplicitADR a PROMOTED_TO points back from exists) and
    #       after the code nodes (so a REALISES resolves to a real CodeNode).
    _project_adr_nodes(g, substrate)
    _project_test_nodes(g, substrate)

    # 7 — Structural edges from edges.jsonl (uppercased type), stub missing ends.
    for edge in substrate.edges:
        for endpoint in (edge.src, edge.dst):
            if not g.has(_code_key(endpoint)):
                _add_stub_code_node(g, endpoint, edge.source_file)
        g.add_edge(
            _code_key(edge.src), _code_key(edge.dst),
            GraphEdge(edge.type.upper(), edge.source_file, edge.source_line, dict(edge.metadata)),
        )

    # 8 — MENTIONS_CONCEPT from each sidecar's `concepts` section (best-effort
    #     name match against the concept catalogue).
    for sc in substrate.sidecars:
        sc_key = _sidecar_key(sc.node_id)
        for section in sc.sections:
            if section.name != "concepts":
                continue
            for token in _concept_tokens(section.body):
                c_key = concept_name_index.get(token.lower())
                if c_key:
                    g.add_edge(sc_key, c_key,
                               GraphEdge(config.E_MENTIONS_CONCEPT, sc.source_file, section.line))

    # 9 — DESCRIBES — Doc(page) -> Concept|Feature|CodeNode, from the agentic
    #     doc-understanding sidecars (the reverse of LINKS_DOC).
    _project_describes(g, substrate, doc_path_index, concept_name_index)

    # 10 — DOC_REFERENCES — Doc -> Doc, from each section's intra-manual links.
    _project_doc_references(g, substrate, doc_path_index)

    _assert_provenance(g)
    return g


# --------------------------------------------------------------------------
# Documentation projection (ground-truth-lineage)


def _doc_key(node_id: str) -> str:
    return f"doc::{node_id}"


def _project_doc_nodes(
    g: OntologyGraph, substrate: Substrate
) -> tuple[dict[str, str], dict[str, str]]:
    """Project content-bearing Doc nodes and return two resolution indices:

    - ``doc_url_index``  — normalised live-URL (with and without #fragment) -> key,
      for resolving a sidecar's WebFetched code→doc URL.
    - ``doc_path_index`` — docs-relative path (and path#anchor) -> key, for
      resolving an intra-manual hyperlink to its target section.

    The embedding target is the heading breadcrumb + the upstream prose the
    loader attached (reference-upstream); a body-less node (docs repo absent, or
    drift) is graph-only — still traversable, just not a vector seed."""
    doc_url_index: dict[str, str] = {}
    doc_path_index: dict[str, str] = {}
    for dn in substrate.doc_nodes:
        key = _doc_key(dn.node_id)
        breadcrumb = " > ".join(dn.heading_path)
        embed_units = []
        if dn.body.strip():
            embed_units = [("doc", f"{dn.page_title} — {breadcrumb}\n{dn.body}")]
        g.add_node(
            GraphNode(
                label=config.L_DOC,
                key=key,
                node_id=dn.node_id,
                title=dn.heading if dn.level > 1 else dn.page_title,
                source_file=dn.source_file,
                source_line=dn.source_line,
                props={
                    "url": dn.live_url,
                    "repo_rel_path": dn.repo_rel_path,
                    "anchor": dn.anchor,
                    "level": dn.level,
                    "page_title": dn.page_title,
                    "summary_group": dn.summary_group,
                    "in_summary": dn.in_summary,
                    "drifted": dn.drifted,
                    "ingested": True,
                },
                embed_units=embed_units,
            )
        )
        if dn.live_url:
            doc_url_index.setdefault(_norm_url(dn.live_url), key)
            # Page-level (fragment-stripped) — the H1 page-root owns it.
            if dn.level == 1:
                doc_url_index.setdefault(_norm_url(dn.live_url.split("#")[0]), key)
        # Path index: the H1 owns the bare path; every section owns path#anchor.
        if dn.level == 1:
            doc_path_index.setdefault(dn.repo_rel_path, key)
        doc_path_index.setdefault(f"{dn.repo_rel_path}#{dn.anchor}", key)
    return doc_url_index, doc_path_index


def _project_describes(
    g: OntologyGraph,
    substrate: Substrate,
    doc_path_index: dict[str, str],
    concept_name_index: dict[str, str],
) -> None:
    """Wire DESCRIBES (Doc page-root -> Concept|Feature|CodeNode) from each
    agentic doc-understanding sidecar. Concepts resolve by canonical name/alias,
    features by `F-NNN`, code by node_id (stub if the id is not yet scaffolded).
    A sidecar for a page that was never mechanically ingested is skipped — the
    mechanical doc-nodes pass is the prerequisite."""
    for du in substrate.doc_understanding:
        page_key = doc_path_index.get(du.doc_page) or doc_path_index.get(
            "docs/" + du.doc_page.lstrip("/")
        )
        if page_key is None or not g.has(page_key):
            continue
        for name in du.describes_concepts:
            c_key = concept_name_index.get(name.strip().lower())
            if c_key and g.has(c_key):
                g.add_edge(page_key, c_key,
                           GraphEdge(config.E_DESCRIBES, du.source_file, du.source_line))
        for fid in du.describes_features:
            f_key = _reducer_key(config.L_FEATURE, fid.strip())
            if g.has(f_key):
                g.add_edge(page_key, f_key,
                           GraphEdge(config.E_DESCRIBES, du.source_file, du.source_line))
        for node_id in du.describes_code:
            node_id = node_id.strip()
            ck = _code_key(node_id)
            if not g.has(ck):
                _add_stub_code_node(g, node_id, du.source_file)
            g.add_edge(page_key, ck,
                       GraphEdge(config.E_DESCRIBES, du.source_file, du.source_line))


def _project_doc_references(
    g: OntologyGraph, substrate: Substrate, doc_path_index: dict[str, str]
) -> None:
    """Wire DOC_REFERENCES (Doc -> Doc) from each section's intra-manual `.md`
    links, resolving the link target relative to the page's own directory.
    External links, images, and within-page anchors are skipped (no target
    Doc node); unresolved targets are silently dropped — a doc→doc link to a
    page outside the manual is not an ontology edge."""
    for dn in substrate.doc_nodes:
        src_key = _doc_key(dn.node_id)
        page_dir = posixpath.dirname(dn.repo_rel_path)
        for link in dn.links:
            if link.get("kind") != "doc":
                continue
            target = link.get("target", "")
            base, _, frag = target.partition("#")
            if not base:
                continue
            resolved = posixpath.normpath(posixpath.join(page_dir, base))
            dst_key = (
                doc_path_index.get(f"{resolved}#{frag}") if frag else None
            ) or doc_path_index.get(resolved)
            if dst_key and dst_key != src_key:
                g.add_edge(src_key, dst_key,
                           GraphEdge(config.E_DOC_REFERENCES, dn.source_file, dn.source_line))


def _project_adr_nodes(g: OntologyGraph, substrate: Substrate) -> None:
    """Project published ADR nodes + their three ground-truth edges.

    - ``ADR`` node (``L_ADR``), id = ``adr_id``, carrying title/status/live_url/
      content_hash. Non-code ``realises`` refs (e.g. the openapi.yaml spec) are
      kept as a ``realises_external`` node attribute — they are not graph edges.
    - ``PROMOTED_TO`` — the ``ImplicitADR`` whose id == ``promoted_from``
      (``ADR-CANDIDATE-NNN``) -> the ``ADR``. The candidate was ratified into the
      published decision. If the ImplicitADR is not in the graph (the candidate
      reducer hasn't been run, or the id is stale) the edge is skipped and the
      absence recorded on ``g.skipped`` — never a crash.
    - ``REALISES`` — each ``realises`` entry that matches an existing ``CodeNode``
      node_id yields a ``CodeNode -> ADR`` edge (the code realises the decision,
      OSLC satisfiedBy). A non-code ref is NOT stubbed — it becomes the external
      attribute above.
    - ``SUPERSEDED_BY`` — ``ADR -> ADR`` when ``superseded_by`` names another
      ADR node that exists.

    Two passes (nodes, then edges) so a SUPERSEDED_BY to a not-yet-added ADR
    resolves regardless of ingest order.

    A ``realises`` ref is matched to a CodeNode by a forgiving identity (see
    ``_resolve_code_ref``): exact node_id first, then a unique
    ``repo lang …:descriptor`` match so a hand-authored ref need not reproduce
    the mechanically-generated package segment / kind suffix verbatim
    (`…controller-class:AlertController` resolves to the substrate's
    `…controller:AlertController`). A ref that resolves to no real code node is
    the ``realises_external`` attribute — never a stub, never an edge."""
    code_ids = {cn.node_id for cn in substrate.code_nodes}
    code_descriptor_index = _build_code_descriptor_index(substrate)

    def _resolve(ref: str) -> str | None:
        return _resolve_code_ref(ref, code_ids, code_descriptor_index)

    # Pass 1 — nodes (so every SUPERSEDED_BY endpoint can resolve).
    for adr in substrate.adr_nodes:
        # A ref is external iff it resolves to no real code node — keep the
        # edge decision and the external-attribute decision on one rule so a
        # resolved ref is never also listed as external.
        realises_external = sorted(
            ref for ref in adr.realises if _resolve(ref) is None
        )
        g.add_node(
            GraphNode(
                label=config.L_ADR,
                key=_adr_key(adr.adr_id),
                node_id=adr.adr_id,
                title=adr.title or adr.adr_id,
                source_file=adr.source_file,
                source_line=adr.source_line,
                props={
                    "status": adr.status,
                    "date": adr.date,
                    "url": adr.live_url,
                    "repo_rel_path": adr.repo_rel_path,
                    "anchor": adr.anchor,
                    "content_hash": adr.content_hash,
                    "realises_external": realises_external,
                },
                embed_units=[("adr", f"{adr.title}".strip())] if adr.title else [],
            )
        )
    # Pass 2 — the three ground-truth edges.
    for adr in substrate.adr_nodes:
        adr_key = _adr_key(adr.adr_id)
        # PROMOTED_TO — ImplicitADR(ADR-CANDIDATE-NNN) -> ADR.
        if adr.promoted_from:
            cand_key = _reducer_key(config.L_IMPLICIT_ADR, adr.promoted_from)
            if g.has(cand_key):
                g.add_edge(cand_key, adr_key,
                           GraphEdge(config.E_PROMOTED_TO, adr.source_file, adr.source_line))
            else:
                g.skipped.append((
                    adr.source_file,
                    f"{adr.adr_id}: PROMOTED_TO source ImplicitADR "
                    f"{adr.promoted_from} not in graph (edge skipped)",
                ))
        # REALISES — CodeNode -> ADR, only for refs matching a real code node.
        for ref in adr.realises:
            resolved = _resolve(ref)
            if resolved is not None:
                g.add_edge(_code_key(resolved), adr_key,
                           GraphEdge(config.E_REALISES, adr.source_file, adr.source_line))
        # SUPERSEDED_BY — ADR -> ADR (target must exist).
        if adr.superseded_by:
            target_key = _adr_key(adr.superseded_by)
            if g.has(target_key):
                g.add_edge(adr_key, target_key,
                           GraphEdge(config.E_SUPERSEDED_BY, adr.source_file, adr.source_line))
            else:
                g.skipped.append((
                    adr.source_file,
                    f"{adr.adr_id}: SUPERSEDED_BY target {adr.superseded_by} "
                    f"not in graph (edge skipped)",
                ))


def _project_test_nodes(g: OntologyGraph, substrate: Substrate) -> None:
    """Project existing Test nodes (ground-truth-lineage Phase 4) + their edges.

    - ``Test`` node (``L_TEST``), id = ``{path}::{class}``.
    - ``COVERS`` — Test → CodeNode. Mechanical: the inferred ``covers`` descriptor
      resolved against the ``(repo, lang, descriptor)`` index (unique match only);
      plus any explicit ``@covers`` ref via the forgiving ``_resolve_code_ref``.
    - ``ENFORCES`` — Test → ADR (declared ``@enforces ADR-NNNN``).
    - ``VALIDATES`` — Test → Feature (declared ``@validates F-NNN``).
    - ``REGRESSES`` — Test → RefactoringScope / ImplicitADR (declared
      ``@regresses <id>``, exact id match).
    - ``status`` / ``pins`` node props — a ``@pins <bug-id>`` test (a characterization
      pin of an OPEN, deliberately-unfixed bug; GREEN while the bug exists, RED when the
      behaviour changes) carries ``status: pins-known-bug`` so the known-bug register is
      navigable (filter Test nodes by ``status``). No PINS *edge* is projected yet —
      bug-ids (PLT-NNN) are not graph nodes; the status prop is the navigation surface
      until bugs are modelled as Finding nodes. See retrospectives/LSN-029.

    A gate ref to a node not in the graph is recorded on ``g.skipped`` (the
    blind-spot signal), never crashed and never stubbed. A test with zero edges
    is an ``orphan`` — the alignment scorecard, not the projector, scores that."""
    code_ids = {cn.node_id for cn in substrate.code_nodes}
    desc_index = _build_code_descriptor_index(substrate)

    for t in substrate.test_nodes:
        g.add_node(
            GraphNode(
                label=config.L_TEST,
                key=_test_key(t.test_id),
                node_id=t.test_id,
                title=t.class_name or t.test_id,
                source_file=t.source_file,
                source_line=t.source_line,
                props={
                    "framework": t.framework, "test_class": t.test_class,
                    "path": t.path, "lang": t.lang, "covers": t.covers,
                    "method_count": t.method_count,
                    "gates_total": (len(t.enforces) + len(t.validates) + len(t.regresses)
                                    + len(t.pins) + len(t.covers_refs)),
                    "pins": list(t.pins), "status": t.status,
                    "content_hash": t.content_hash,
                },
                embed_units=[("test", t.class_name)] if t.class_name else [],
            )
        )

    for t in substrate.test_nodes:
        key = _test_key(t.test_id)
        # COVERS — mechanical descriptor + explicit @covers refs.
        covered: set[str] = set()
        if t.covers:
            cands = desc_index.get((t.repo, t.lang, t.covers), [])
            if len(cands) == 1:
                covered.add(cands[0])
        for ref in t.covers_refs:
            resolved = _resolve_code_ref(ref, code_ids, desc_index)
            if resolved is not None:
                covered.add(resolved)
        for cid in sorted(covered):
            g.add_edge(key, _code_key(cid),
                       GraphEdge(config.E_COVERS, t.source_file, t.source_line))
        # ENFORCES — Test → ADR.
        for adr_id in t.enforces:
            ak = _adr_key(adr_id)
            if g.has(ak):
                g.add_edge(key, ak, GraphEdge(config.E_ENFORCES, t.source_file, t.source_line))
            else:
                g.skipped.append((t.source_file, f"{t.test_id}: ENFORCES target {adr_id} not in graph"))
        # VALIDATES — Test → Feature.
        for fid in t.validates:
            fk = _reducer_key(config.L_FEATURE, fid)
            if g.has(fk):
                g.add_edge(key, fk, GraphEdge(config.E_VALIDATES, t.source_file, t.source_line))
            else:
                g.skipped.append((t.source_file, f"{t.test_id}: VALIDATES target {fid} not in graph"))
        # REGRESSES — Test → RefactoringScope / ImplicitADR (exact id).
        for rid in t.regresses:
            for label in (config.L_REFACTOR_SCOPE, config.L_IMPLICIT_ADR):
                rk = _reducer_key(label, rid)
                if g.has(rk):
                    g.add_edge(key, rk, GraphEdge(config.E_REGRESSES, t.source_file, t.source_line))
                    break


def _build_code_descriptor_index(substrate: Substrate) -> dict[tuple[str, str, str], list[str]]:
    """Index CodeNodes by a kind-insensitive identity for forgiving REALISES
    resolution: ``(repo, lang, descriptor)`` -> [node_id, ...].

    The substrate node grammar is ``<repo> <lang> <segment> <kind>:<descriptor>``;
    a hand-authored `realises` ref usually has the right repo/lang/descriptor but
    a guessed `<segment>` (package) and/or a near-miss `<kind>` (`controller-class`
    vs `controller`). Keying on the kind-free identity lets such a ref resolve
    when — and only when — exactly one code node carries that identity."""
    index: dict[tuple[str, str, str], list[str]] = defaultdict(list)
    for cn in substrate.code_nodes:
        descriptor = _node_descriptor(cn.node_id)
        if descriptor:
            index[(cn.repo, cn.lang, descriptor)].append(cn.node_id)
    return index


def _node_descriptor(node_id: str) -> str:
    """The ``<descriptor>`` of a ``<repo> <lang> <segment> <kind>:<descriptor>``
    node id — the part after the last colon. "" if the id has no colon."""
    return node_id.rsplit(":", 1)[1] if ":" in node_id else ""


def _resolve_code_ref(
    ref: str,
    code_ids: set[str],
    descriptor_index: dict[tuple[str, str, str], list[str]],
) -> str | None:
    """Resolve a ``realises`` ref to a substrate CodeNode node_id, or None.

    Exact match first (the precise / future-proof path). Else, when the ref has
    the ``<repo> <lang> <segment> <kind>:<descriptor>`` shape, fall back to the
    kind-insensitive ``(repo, lang, descriptor)`` identity and accept it **only
    when exactly one** code node carries it (an ambiguous descriptor stays
    unresolved → it becomes an external ref, never a wrong edge). A ref that is
    not a code-node shape at all (e.g. ``odd-platform-specification: openapi.yaml
    …``) resolves to None and is handled as external."""
    if ref in code_ids:
        return ref
    parts = ref.split(" ")
    if len(parts) < 4 or ":" not in parts[-1]:
        return None
    repo, lang = parts[0], parts[1]
    descriptor = parts[-1].split(":", 1)[1]
    candidates = descriptor_index.get((repo, lang, descriptor), [])
    return candidates[0] if len(candidates) == 1 else None


def _norm_url(url: str) -> str:
    """Normalise a doc URL for matching — lowercase, strip trailing slash."""
    return url.strip().rstrip("/").lower()


def _resolve_doc_url(url: str, doc_url_index: dict[str, str]) -> str | None:
    """Resolve a sidecar's WebFetched doc URL to a content-bearing Doc key:
    exact (with fragment) first, then page-level (fragment stripped)."""
    n = _norm_url(url)
    return doc_url_index.get(n) or doc_url_index.get(_norm_url(url.split("#")[0]))


# --------------------------------------------------------------------------
# Helpers


def _add_stub_code_node(g: OntologyGraph, node_id: str, referenced_by: str) -> None:
    """Create a placeholder CodeNode for an id referenced by an edge / feature
    chain / test-gap that has no `nodes.jsonl` row — keeps edges from dangling
    and makes the graph itself a coverage-gap detector (SCHEMA §1.2)."""
    key = _code_key(node_id)
    if g.has(key):
        return
    g.add_node(
        GraphNode(
            label=config.L_CODE_NODE, key=key, node_id=node_id,
            title=node_id, source_file=referenced_by, source_line=0,
            props={"kind": "unresolved", "stub": True},
        )
    )
    g.stub_count += 1


def _resolve_sidecar(
    cited: str, slug_to_key: dict[str, str], all_slugs: list[str]
) -> str | None:
    """Resolve a cited sidecar slug to a Sidecar key. Citations across reducer
    batches use mixed slug conventions (full `odd-platform__java__...` and
    short `Controller__kind__method` forms); accept an exact match, or a unique
    `__`-boundary suffix/prefix match. Ambiguous (>1 candidate) -> unresolved."""
    key = slug_to_key.get(cited)
    if key:
        return key
    candidates = [
        s for s in all_slugs
        if s.endswith("__" + cited) or cited.endswith("__" + s)
    ]
    return slug_to_key[candidates[0]] if len(candidates) == 1 else None


def _severity(text: str) -> str:
    m = re.search(r"\b(CRITICAL|HIGH|MEDIUM|LOW)\b", text)
    return m.group(1) if m else ""


def _concept_tokens(concepts_section: str) -> list[str]:
    """Pull entity/operation name tokens from a sidecar `concepts` section."""
    tokens: list[str] = []
    for inner in _LIST_TOKENS_RE.findall(concepts_section):
        for tok in inner.split(","):
            tok = tok.strip().strip("`\"'")
            if tok:
                tokens.append(tok)
    return tokens


def _assert_provenance(g: OntologyGraph) -> None:
    """SCHEMA §1: a graph element with no provenance is a build bug — raise."""
    for node in g.all_nodes():
        if not node.source_file:
            raise ValueError(f"provenance missing on node {node.key!r} ({node.label})")
    for _s, _d, edge in g._g.weighted_edge_list():  # noqa: SLF001 — internal check
        if not edge.source_file:
            raise ValueError(f"provenance missing on a {edge.type} edge")
