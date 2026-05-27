"""Per-axis Markdown rollup writers.

Rollups are the diffable surface for PR review — JSONL is the machine surface,
rollups summarise per-axis state in human-readable form.
"""
from __future__ import annotations

from pathlib import Path

from lineage_extractor.nodes import Edge, Node
from lineage_extractor.rollups.config_prefixes_rollup import write_config_prefixes_rollup
from lineage_extractor.rollups.controllers_rollup import write_controllers_rollup
from lineage_extractor.rollups.openapi_tags_rollup import write_openapi_tags_rollup
from lineage_extractor.rollups.ui_components_rollup import write_ui_components_rollup
from lineage_extractor.rollups.ui_routes_rollup import write_ui_routes_rollup
from lineage_extractor.rollups.ui_shell_rollup import write_ui_shell_rollup

_ROLLUP_REGISTRY = {
    "ui_shell": write_ui_shell_rollup,
    "controllers": write_controllers_rollup,
    "openapi_tags": write_openapi_tags_rollup,
    "ui_routes": write_ui_routes_rollup,
    "ui_components": write_ui_components_rollup,
    "config_prefixes": write_config_prefixes_rollup,
}


def write_rollups(
    rollups_dir: Path,
    *,
    nodes: list[Node],
    edges: list[Edge],
    axes: set[str],
) -> None:
    rollups_dir.mkdir(parents=True, exist_ok=True)
    for axis in axes:
        writer = _ROLLUP_REGISTRY.get(axis)
        if writer is None:
            continue
        axis_nodes = [n for n in nodes if n.axis == axis]
        axis_edges = [
            e
            for e in edges
            if any(n.id == e.src or n.id == e.dst for n in axis_nodes)
        ]
        writer(rollups_dir / f"{axis.replace('_', '-')}.md", axis_nodes, axis_edges)
