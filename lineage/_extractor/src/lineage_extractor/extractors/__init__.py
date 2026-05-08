"""Per-axis extractors.

The MVP scaffold ships ui_shell first (the i18n-class fix from LSN-013).
Other axes (controllers, openapi_tags, ui_routes, config_prefixes) will land
in subsequent commits on this branch.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

from lineage_extractor.manifest import Manifest, today_iso
from lineage_extractor.nodes import Edge, Node, write_edges, write_nodes
from lineage_extractor.repo import head_commit, short_sha
from lineage_extractor.rollups import write_rollups


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

    Wire-up only; per-axis extractor bodies are stubbed in MVP-scaffold commit 1
    and filled in subsequent commits on this branch. The CLI surface, manifest
    advancement rules, and JSONL/rollup wiring are the deliverables of this commit.
    """
    if manifest is None:
        manifest = Manifest(repo=repo)

    enabled_axes = axes or set(_AXIS_REGISTRY.keys())

    nodes: list[Node] = []
    edges: list[Edge] = []
    axis_summaries: list[str] = []

    for axis in enabled_axes:
        impl = _AXIS_REGISTRY.get(axis)
        if impl is None:
            axis_summaries.append(f"  - {axis}: not yet implemented (skipped)")
            continue
        axis_nodes, axis_edges = impl(repo=repo, repo_path=repo_path)
        nodes.extend(axis_nodes)
        edges.extend(axis_edges)
        if not dry_run:
            manifest.axis(axis).version = max(manifest.axis(axis).version, 1)
            manifest.axis(axis).last_built = today_iso()
        axis_summaries.append(f"  - {axis}: {len(axis_nodes)} nodes, {len(axis_edges)} edges")

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


# Axis implementation registry. Filled in subsequent commits on this branch.
# Each entry is a callable: (repo: str, repo_path: Path) -> (list[Node], list[Edge]).
_AXIS_REGISTRY: dict[str, callable] = {}


def _register_axis(name: str):
    def deco(func):
        _AXIS_REGISTRY[name] = func
        return func
    return deco


# Axis registrations (each axis lives in its own module).
from lineage_extractor.extractors.controllers import extract_controllers  # noqa: E402
from lineage_extractor.extractors.openapi_tags import extract_openapi_tags  # noqa: E402
from lineage_extractor.extractors.ui_routes import extract_ui_routes  # noqa: E402
from lineage_extractor.extractors.ui_shell import extract_ui_shell  # noqa: E402

_register_axis("ui_shell")(extract_ui_shell)
_register_axis("controllers")(extract_controllers)
_register_axis("openapi_tags")(extract_openapi_tags)
_register_axis("ui_routes")(extract_ui_routes)
