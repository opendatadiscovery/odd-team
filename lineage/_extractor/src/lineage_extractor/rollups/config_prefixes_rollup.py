"""config-prefixes.md rollup writer."""
from __future__ import annotations

from collections import defaultdict
from pathlib import Path

from lineage_extractor.nodes import Edge, Node


def write_config_prefixes_rollup(path: Path, nodes: list[Node], edges: list[Edge]) -> None:
    prefixes = sorted(
        [n for n in nodes if n.kind == "config-prefix"], key=lambda n: n.descriptor
    )
    cp_classes = [n for n in nodes if n.kind == "config-properties-class"]
    consumers = [n for n in nodes if n.kind == "config-key-consumer"]

    # Group classes + consumers by their top-level prefix via the configures edges.
    classes_by_prefix: dict[str, list[Node]] = defaultdict(list)
    consumers_by_prefix: dict[str, list[Node]] = defaultdict(list)
    by_id: dict[str, Node] = {n.id: n for n in nodes}
    for e in edges:
        if e.type != "configures":
            continue
        target = by_id.get(e.dst)
        source = by_id.get(e.src)
        if target is None or source is None:
            continue
        if target.kind != "config-prefix":
            continue
        if source.kind == "config-properties-class":
            classes_by_prefix[target.descriptor].append(source)
        elif source.kind == "config-key-consumer":
            consumers_by_prefix[target.descriptor].append(source)

    lines: list[str] = [
        "# config_prefixes rollup",
        "",
        f"Total prefixes: {len(prefixes)}. "
        f"@ConfigurationProperties classes: {len(cp_classes)}. "
        f"@Value consumers: {len(consumers)}.",
        "Auto-derived from `lineage/{repo}/nodes.jsonl` + `edges.jsonl`. "
        "Each top-level YAML namespace in `application.yml` is one node; consumer "
        "classes (config-properties-class) and `@Value` readers (config-key-consumer) "
        "edge into their top-level prefix via `configures` edges.",
        "",
    ]

    if not prefixes:
        lines.append("No top-level keys found in `odd-platform-api/src/main/resources/application.yml`.")
        path.write_text("\n".join(lines) + "\n")
        return

    for prefix in prefixes:
        prefix_classes = sorted(classes_by_prefix.get(prefix.descriptor, []), key=lambda n: n.descriptor)
        prefix_consumers = sorted(
            consumers_by_prefix.get(prefix.descriptor, []),
            key=lambda n: (n.metadata.get("key", ""), n.metadata.get("line", 0)),
        )

        doc_state = ", ".join(prefix.documents) if prefix.documents else "no `@docs`"
        lines.append(f"## {prefix.descriptor}")
        lines.append("")
        lines.append(
            f"YAML anchor: `{prefix.path}` — {doc_state}. "
            f"Classes: {len(prefix_classes)}. Consumers: {len(prefix_consumers)}."
        )
        lines.append("")
        if prefix_classes:
            lines.append("**@ConfigurationProperties classes**")
            for cp in prefix_classes:
                cp_prefix = cp.metadata.get("prefix", prefix.descriptor)
                lines.append(f"- `{cp.descriptor}` (`@ConfigurationProperties(\"{cp_prefix}\")`) — `{cp.path}`")
            lines.append("")
        if prefix_consumers:
            lines.append("**@Value consumers**")
            for c in prefix_consumers:
                key = c.metadata.get("key", "?")
                default = c.metadata.get("default")
                default_part = f" (default `{default}`)" if default else ""
                owner = c.metadata.get("field_or_param") or "?"
                lines.append(
                    f"- `{c.metadata.get('enclosing_class', '?')}.{owner}` "
                    f"reads `${{{key}}}`{default_part} — `{c.path}`"
                )
            lines.append("")
        if not prefix_classes and not prefix_consumers:
            lines.append("(No @ConfigurationProperties class or @Value consumer found bound to this top-level prefix in odd-platform-api.)")
            lines.append("")

    path.write_text("\n".join(lines) + "\n")
