"""ui-shell.md rollup writer.

The rollup is the human-readable summary of the ui_shell axis. It groups
nodes by kind, lists each node's path + descriptor, and the doc-linkage state.
"""
from __future__ import annotations

from collections import defaultdict
from pathlib import Path

from lineage_extractor.nodes import Edge, Node


def write_ui_shell_rollup(path: Path, nodes: list[Node], edges: list[Edge]) -> None:
    by_kind: dict[str, list[Node]] = defaultdict(list)
    for node in nodes:
        by_kind[node.kind].append(node)

    lines: list[str] = [
        "# ui_shell rollup",
        "",
        f"Total nodes: {len(nodes)}. Total edges: {len(edges)}.",
        "",
        "Auto-derived from `lineage/{repo}/nodes.jsonl` by the lineage extractor.",
        "Hand-written intent + gotchas live in `navigation/notes/ui-shell.md` (when migrated).",
        "",
    ]

    if not nodes:
        lines.extend([
            "No nodes yet — extractor body lands in commit 2 of the MVP-scaffold branch.",
            "",
            "When commit 2 ships, this rollup must list (per `findings/docs-coverage-undocumented-features/2026-05-08.md`):",
            "",
            "- `i18n-bootstrap` for `odd-platform-ui/src/locales/i18n.ts` (F-047)",
            "- `ui-shell-widget` for each `AppToolbar/{SelectLanguage,AppInfoMenu,ToolbarTabs}` (F-049)",
            "- `ui-shell-widget` for `AppErrorPage` (F-048)",
            "- `ui-shell-bootstrap` for the `fetchActiveFeatures()` runtime feature-flag surface (F-050)",
            "- `ui-shell-widget` for the Logout menu item (F-051)",
            "",
            "Each node's `documents:` field MUST be `null` (or list a doc page if one is later authored).",
        ])
        path.write_text("\n".join(lines) + "\n")
        return

    for kind in sorted(by_kind):
        kind_nodes = by_kind[kind]
        lines.append(f"## {kind} ({len(kind_nodes)})")
        lines.append("")
        for node in sorted(kind_nodes, key=lambda n: n.path):
            doc_state = (
                ", ".join(node.documents) if node.documents else "(no `@docs` annotation)"
            )
            lines.append(f"- `{node.path}` — {node.descriptor} — {doc_state}")
        lines.append("")

    path.write_text("\n".join(lines) + "\n")
