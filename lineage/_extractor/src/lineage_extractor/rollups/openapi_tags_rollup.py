"""openapi-tags.md rollup writer."""
from __future__ import annotations

from collections import defaultdict
from pathlib import Path

from lineage_extractor.nodes import Edge, Node


def write_openapi_tags_rollup(path: Path, nodes: list[Node], edges: list[Edge]) -> None:
    tag_nodes = [n for n in nodes if n.kind == "openapi-tag"]
    edges_by_tag: dict[str, list[Edge]] = defaultdict(list)
    for e in edges:
        if e.type == "exposes":
            edges_by_tag[e.src].append(e)

    lines: list[str] = [
        "# openapi-tags rollup",
        "",
        f"Total tags: {len(tag_nodes)}. Total tag→method edges: {sum(len(es) for es in edges_by_tag.values())}.",
        "Auto-derived from `lineage/{repo}/nodes.jsonl` + `edges.jsonl`. Edges join on operationId == controller method name (OpenAPI generator convention).",
        "",
    ]

    if not tag_nodes:
        lines.append("No tags found in `odd-platform-specification/openapi.yaml`.")
        path.write_text("\n".join(lines) + "\n")
        return

    for tag in sorted(tag_nodes, key=lambda n: n.descriptor):
        tag_edges = sorted(
            edges_by_tag.get(tag.id, []),
            key=lambda e: (e.metadata.get("path", ""), e.metadata.get("http_method", "")),
        )
        op_count = tag.metadata.get("operation_count", 0)
        lines.append(f"## {tag.descriptor} ({op_count} operations, {len(tag_edges)} bound to controllers)")
        lines.append("")
        if not tag_edges:
            unbound = tag.metadata.get("operation_ids") or []
            if unbound:
                lines.append(f"Unbound operations (no matching controller method): `{', '.join(unbound)}`")
                lines.append("")
            continue
        for e in tag_edges:
            method = e.metadata.get("http_method", "?")
            path_str = e.metadata.get("path", "?")
            op_id = e.metadata.get("operation_id", "?")
            lines.append(f"- `{method} {path_str}` → `{op_id}`")
        lines.append("")

    path.write_text("\n".join(lines) + "\n")
