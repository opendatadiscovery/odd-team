"""Per-axis extractors.

The substrate's axis registry. New axes are added by importing the
extractor module and calling `_register_axis(name)(callable)`. Each
extractor returns `(nodes, edges)` for its axis; the orchestrator
unions them and post-processes universal cross-axis edges (currently
`declared_in` from every non-file node back to its parent `file` node).

Per `APPROACH.md` section 3, the file axis runs first as the universal
scaffold. The concepts axis runs last, after sidecars + concept-merger
have produced `lineage/{repo}/concepts.yaml`.
"""
from __future__ import annotations

import inspect
import re
from dataclasses import dataclass, field
from pathlib import Path

from lineage_extractor.manifest import Manifest, today_iso
from lineage_extractor.nodes import Edge, Node, write_edges, write_nodes
from lineage_extractor.repo import head_commit, short_sha
from lineage_extractor.rollups import write_rollups


# Universal post-processing: a non-file node's `path` field points at a
# source file (optionally with a `:line` line-anchor or `#fragment` sub-anchor
# suffix, or a trailing `/` for directory-rooted nodes like ui-shell-widget).
# We strip the suffix and emit a `declared_in` edge if a matching file-node
# exists. Directory-rooted nodes don't resolve to a single file and are
# skipped — the per-file sidecar layer covers their members individually.
_PATH_SUFFIX_RE = re.compile(r"[:#].*$")


@dataclass
class ExtractionResult:
    ok: bool
    manifest: Manifest
    summary: str = ""
    error: str | None = None
    nodes: list[Node] = field(default_factory=list)
    edges: list[Edge] = field(default_factory=list)


def run_extraction(
    *,
    repo: str,
    repo_path: Path,
    lineage_dir: Path,
    workspace_root: Path,
    mode: str,
    ref: str | None,
    reach: int,
    axes: set[str] | None,
    manifest: Manifest | None,
    dry_run: bool,
) -> ExtractionResult:
    """Drive extraction across all enabled axes.

    Order matters for two axes only: `files` runs first (its nodes are the
    targets of `declared_in` edges emitted in the post-process step), and
    `concepts` runs last (its `embodied_by` edges target nodes from every
    other axis). Other axes can run in any order.
    """
    if manifest is None:
        manifest = Manifest(repo=repo)

    enabled_axes = axes or set(_AXIS_REGISTRY.keys())

    nodes: list[Node] = []
    edges: list[Edge] = []
    axis_summaries: list[str] = []

    for axis in _ordered_axes(enabled_axes):
        impl = _AXIS_REGISTRY.get(axis)
        if impl is None:
            axis_summaries.append(f"  - {axis}: not yet implemented (skipped)")
            continue
        axis_nodes, axis_edges = _call_extractor(
            impl, repo=repo, repo_path=repo_path, lineage_dir=lineage_dir
        )
        nodes.extend(axis_nodes)
        edges.extend(axis_edges)
        if not dry_run:
            manifest.axis(axis).version = max(manifest.axis(axis).version, 1)
            manifest.axis(axis).last_built = today_iso()
        axis_summaries.append(f"  - {axis}: {len(axis_nodes)} nodes, {len(axis_edges)} edges")

    # Universal post-process: emit `declared_in` edges from every non-file
    # node to its parent `file` node. Cheap (O(N) over nodes; dict lookup).
    declared_in_edges = _declared_in_edges(nodes)
    edges.extend(declared_in_edges)
    if declared_in_edges:
        axis_summaries.append(f"  - declared_in (universal): {len(declared_in_edges)} edges")

    if not dry_run:
        nodes_path = lineage_dir / "nodes.jsonl"
        edges_path = lineage_dir / "edges.jsonl"
        node_count = write_nodes(nodes_path, nodes)
        edge_count = write_edges(edges_path, edges)
        write_rollups(lineage_dir / "rollups", nodes=nodes, edges=edges, axes=enabled_axes)

        manifest.last_scan_commit = short_sha(repo_path)
        manifest.last_scan_date = today_iso()
        manifest.last_scan_mode = mode
        manifest.node_count = node_count
        manifest.edge_count = edge_count

    summary = "\n".join(
        [
            f"lineage scan ({mode}) — repo={repo} HEAD={head_commit(repo_path)[:8]}",
            f"axes: {', '.join(sorted(enabled_axes))}",
            *axis_summaries,
            f"nodes total: {len(nodes)}, edges total: {len(edges)}",
        ]
    )
    return ExtractionResult(ok=True, manifest=manifest, summary=summary, nodes=nodes, edges=edges)


def _call_extractor(
    extractor,
    *,
    repo: str,
    repo_path: Path,
    lineage_dir: Path,
) -> tuple[list[Node], list[Edge]]:
    """Invoke an extractor, passing only the kwargs its signature accepts.

    Existing per-axis extractors take `(repo, repo_path)`; the concepts
    extractor additionally takes `lineage_dir`. Inspecting the signature
    keeps the orchestrator open to new shapes without touching every
    extractor when a new universal kwarg appears.
    """
    sig = inspect.signature(extractor)
    kwargs = {"repo": repo, "repo_path": repo_path}
    if "lineage_dir" in sig.parameters:
        kwargs["lineage_dir"] = lineage_dir
    return extractor(**kwargs)


def _declared_in_edges(nodes: list[Node]) -> list[Edge]:
    """Emit a `declared_in` edge for every non-file node whose path resolves to a file-node.

    Path forms in existing extractors:
        - `pkg/file.java`            → resolves
        - `pkg/file.java:25`         → strip `:25`, resolves
        - `pkg/file.yaml#anchor`     → strip `#anchor`, resolves
        - `pkg/folder/`              → directory; skipped (no single parent file)
    """
    by_path: dict[str, str] = {n.path: n.id for n in nodes if n.kind == "file"}
    edges: list[Edge] = []
    for node in nodes:
        if node.kind == "file":
            continue
        if node.path.endswith("/"):
            continue
        base_path = _PATH_SUFFIX_RE.sub("", node.path)
        file_id = by_path.get(base_path)
        if file_id is None:
            continue
        edges.append(Edge(src=node.id, dst=file_id, type="declared_in"))
    return edges


# Axes that need ordering: `files` first (scaffold for declared_in),
# `concepts` last (depends on sidecars + concept-merger having run).
# All other axes are order-independent and run in alphabetical order
# for determinism.
_AXIS_ORDER_HEAD = ("files",)
_AXIS_ORDER_TAIL = ("concepts",)


def _ordered_axes(enabled: set[str]) -> list[str]:
    head = [a for a in _AXIS_ORDER_HEAD if a in enabled]
    tail = [a for a in _AXIS_ORDER_TAIL if a in enabled]
    middle = sorted(a for a in enabled if a not in _AXIS_ORDER_HEAD and a not in _AXIS_ORDER_TAIL)
    return head + middle + tail


# Axis implementation registry. Each entry is a callable matching
# `(*, repo: str, repo_path: Path, [lineage_dir: Path]) -> (list[Node], list[Edge])`.
_AXIS_REGISTRY: dict[str, callable] = {}


def _register_axis(name: str):
    def deco(func):
        _AXIS_REGISTRY[name] = func
        return func
    return deco


# Axis registrations (each axis lives in its own module).
from lineage_extractor.extractors.concepts import extract_concepts  # noqa: E402
from lineage_extractor.extractors.config_prefixes import extract_config_prefixes  # noqa: E402
from lineage_extractor.extractors.controllers import extract_controllers  # noqa: E402
from lineage_extractor.extractors.files import extract_files  # noqa: E402
from lineage_extractor.extractors.openapi_tags import extract_openapi_tags  # noqa: E402
from lineage_extractor.extractors.ui_routes import extract_ui_routes  # noqa: E402
from lineage_extractor.extractors.ui_shell import extract_ui_shell  # noqa: E402

_register_axis("files")(extract_files)
_register_axis("ui_shell")(extract_ui_shell)
_register_axis("controllers")(extract_controllers)
_register_axis("openapi_tags")(extract_openapi_tags)
_register_axis("ui_routes")(extract_ui_routes)
_register_axis("config_prefixes")(extract_config_prefixes)
_register_axis("concepts")(extract_concepts)
