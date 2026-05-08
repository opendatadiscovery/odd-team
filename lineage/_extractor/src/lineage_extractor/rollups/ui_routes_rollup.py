"""ui-routes.md rollup writer."""
from __future__ import annotations

from pathlib import Path

from lineage_extractor.nodes import Edge, Node


def write_ui_routes_rollup(path: Path, nodes: list[Node], edges: list[Edge]) -> None:
    routes = sorted(nodes, key=lambda n: n.descriptor)

    lines: list[str] = [
        "# ui_routes rollup",
        "",
        f"Total routes: {len(routes)}.",
        "Auto-derived from `lineage/{repo}/nodes.jsonl`. One node per `*Routes.ts` file under `odd-platform-ui/src/routes/`.",
        "",
    ]

    if not routes:
        lines.append("No route files found under `odd-platform-ui/src/routes/`.")
        path.write_text("\n".join(lines) + "\n")
        return

    for route in routes:
        base = route.metadata.get("base_path") or "(no BASE_PATH)"
        all_paths = route.metadata.get("all_paths") or []
        sub_routes = route.metadata.get("sub_routes") or {}
        extra_paths = route.metadata.get("extra_paths") or {}
        inline_paths = route.metadata.get("inline_paths") or []

        doc_state = ", ".join(route.documents) if route.documents else "no `@docs`"
        imported_from = route.metadata.get("base_path_imported_from")
        lines.append(f"## {route.descriptor}")
        lines.append("")
        lines.append(f"File: `{route.path}` — {doc_state}")
        lines.append(f"Base path: `{base}`")
        if imported_from:
            lines.append(f"BASE_PATH imported from: `{imported_from}` (paths are relative)")
        if sub_routes:
            sub_list = ", ".join(f"`{k}={v}`" for k, v in sorted(sub_routes.items()))
            lines.append(f"Sub-routes: {sub_list}")
        if extra_paths:
            extras_list = ", ".join(f"`{k}={v}`" for k, v in sorted(extra_paths.items()))
            lines.append(f"Extra paths: {extras_list}")
        if inline_paths:
            inline_list = ", ".join(f"`{p}`" for p in inline_paths)
            lines.append(f"Inline-returned paths: {inline_list}")
        if all_paths:
            urls = ", ".join(f"`{p}`" for p in all_paths)
            lines.append(f"Full URL set: {urls}")
        lines.append("")

    path.write_text("\n".join(lines) + "\n")
