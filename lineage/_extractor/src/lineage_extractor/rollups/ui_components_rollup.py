"""ui_components.md rollup writer.

The rollup is the human-readable summary of the ui_components axis. Groups
nodes by top-level subdirectory under `components/` and lists one bullet per
component file with descriptor, default-export shape, hook usage signal,
and child-JSX count.
"""
from __future__ import annotations

from collections import defaultdict
from pathlib import Path

from lineage_extractor.nodes import Edge, Node


def write_ui_components_rollup(path: Path, nodes: list[Node], edges: list[Edge]) -> None:
    by_group: dict[str, list[Node]] = defaultdict(list)
    for node in nodes:
        # Group by the first directory level under components/
        # e.g. "components/Management/OwnerAssociations" → "Management"
        pkg = node.package
        if pkg.startswith("components/"):
            parts = pkg[len("components/"):].split("/", 1)
            group = parts[0]
        else:
            group = "(other)"
        by_group[group].append(node)

    lines: list[str] = [
        "# ui_components rollup",
        "",
        f"Total nodes: {len(nodes)}. Total edges: {len(edges)}.",
        "",
        "Auto-derived from `lineage/{repo}/nodes.jsonl`. One node per `*.tsx` file "
        "under `odd-platform-ui/src/components/` with a top-level default export.",
        "",
        f"Grouping: by the first directory level under `components/` "
        f"({len(by_group)} groups).",
        "",
    ]

    if not nodes:
        lines.append("No nodes — the extractor either didn't run or the repo lacks "
                     "`odd-platform-ui/src/components/`.")
        path.write_text("\n".join(lines) + "\n")
        return

    # Summary table — group · count · top hook signals
    lines.append("## Summary")
    lines.append("")
    lines.append("| Group | Components | With react-query | With redux | With jotai |")
    lines.append("|---|---|---|---|---|")
    for group in sorted(by_group):
        group_nodes = by_group[group]
        with_rq = sum(1 for n in group_nodes if n.metadata.get("react_query_hooks"))
        with_redux = sum(1 for n in group_nodes if n.metadata.get("redux_hooks"))
        with_jotai = sum(1 for n in group_nodes if n.metadata.get("jotai_hooks"))
        lines.append(f"| `{group}` | {len(group_nodes)} | {with_rq} | {with_redux} | {with_jotai} |")
    lines.append("")

    # Per-group component listing
    for group in sorted(by_group):
        group_nodes = sorted(by_group[group], key=lambda n: n.path)
        lines.append(f"## {group} ({len(group_nodes)})")
        lines.append("")
        for node in group_nodes:
            shape = node.metadata.get("default_export_kind", "?")
            loc = node.metadata.get("lines_of_code", "?")
            children = node.metadata.get("child_jsx_count", 0)
            hook_signals: list[str] = []
            if node.metadata.get("react_query_hooks"):
                hook_signals.append(f"rq×{len(node.metadata['react_query_hooks'])}")
            if node.metadata.get("redux_hooks"):
                hook_signals.append(f"redux×{len(node.metadata['redux_hooks'])}")
            if node.metadata.get("jotai_hooks"):
                hook_signals.append(f"jotai×{len(node.metadata['jotai_hooks'])}")
            hooks_str = ", ".join(hook_signals) if hook_signals else "no-state-libs"
            lines.append(
                f"- `{node.path}` — **{node.descriptor}** "
                f"({shape}, {loc} loc, {children} child JSX, {hooks_str})"
            )
        lines.append("")

    path.write_text("\n".join(lines) + "\n")
