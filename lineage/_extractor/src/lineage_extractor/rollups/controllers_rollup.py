"""controllers.md rollup writer."""
from __future__ import annotations

from collections import defaultdict
from pathlib import Path

from lineage_extractor.nodes import Edge, Node


def write_controllers_rollup(path: Path, nodes: list[Node], edges: list[Edge]) -> None:
    controllers = [n for n in nodes if n.kind == "controller"]
    methods = [n for n in nodes if n.kind == "controller-method"]
    methods_by_controller: dict[str, list[Node]] = defaultdict(list)
    for m in methods:
        methods_by_controller[m.metadata.get("controller", "")].append(m)

    lines: list[str] = [
        "# controllers rollup",
        "",
        f"Total controllers: {len(controllers)}. Total controller-methods: {len(methods)}.",
        "Auto-derived from `lineage/{repo}/nodes.jsonl`. HTTP method/path metadata lives on each controller-method via the openapi_tags axis join (operationId == method name).",
        "",
    ]

    if not controllers:
        lines.append("No `@RestController`-annotated classes found under `odd-platform-api/src/main/java`.")
        path.write_text("\n".join(lines) + "\n")
        return

    for controller in sorted(controllers, key=lambda n: n.descriptor):
        controller_methods = sorted(
            methods_by_controller.get(controller.descriptor, []), key=lambda n: n.descriptor
        )
        implements = controller.metadata.get("implements") or []
        impl_str = f" implements {', '.join(implements)}" if implements else ""
        lines.append(f"## {controller.descriptor}{impl_str}")
        lines.append("")
        lines.append(f"Path: `{controller.path}` ({len(controller_methods)} methods)")
        lines.append("")
        for m in controller_methods:
            doc_state = (
                ", ".join(m.documents) if m.documents else "no `@docs`"
            )
            lines.append(f"- `{m.descriptor}` (line {m.metadata.get('line', '?')}) — {doc_state}")
        lines.append("")

    path.write_text("\n".join(lines) + "\n")
