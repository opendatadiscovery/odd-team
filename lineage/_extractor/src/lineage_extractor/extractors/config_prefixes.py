"""config_prefixes axis extractor.

Closes the F-052..F-060 gap class from DOC-163 (silent-default / undocumented-
config-prefix family). Emits three node kinds:

- `config-prefix` — top-level YAML namespace in `application.yml` (e.g. `auth`,
  `datacollaboration`, `attachment`). One per top-level key.
- `config-properties-class` — Java class annotated with `@ConfigurationProperties("prefix")`.
  Carries the typed schema for some sub-prefix.
- `config-key-consumer` — `@Value("${some.key}")` consumer (field / constructor
  parameter / method parameter). Each occurrence is its own node — multiple
  consumers of the same key produce multiple nodes.

Edges (`configures`):
- `config-properties-class` → `config-prefix` — "this class declares typed
  config under <prefix>"
- `config-key-consumer` → `config-prefix` — "this consumer reads a key under
  <prefix>"

The top-level prefix derivation: take the first segment before the first `.`
of the SpEL key. `auth.ldap.url` → `auth`. This matches DOC-163's enumeration
axis ("Top-level YAML namespaces in application.yml").
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

from ruamel.yaml import YAML

from lineage_extractor.extractors._java import find_config_consumers
from lineage_extractor.nodes import Edge, Node


APP_YAML = "odd-platform-api/src/main/resources/application.yml"


def extract_config_prefixes(*, repo: str, repo_path: Path) -> tuple[list[Node], list[Edge]]:
    yaml_path = repo_path / APP_YAML
    if not yaml_path.is_file():
        return [], []

    nodes: list[Node] = []
    edges: list[Edge] = []

    # 1. Top-level prefix nodes from application.yml
    top_level = _top_level_keys(yaml_path)
    prefix_node_by_top: dict[str, Node] = {}
    for prefix in top_level:
        node = _config_prefix_node(repo, prefix)
        nodes.append(node)
        prefix_node_by_top[prefix] = node

    # 2. @ConfigurationProperties classes + @Value consumers (single Java walk)
    cps_list, value_list = find_config_consumers(repo_path)

    # config-properties-class nodes
    for cp in cps_list:
        rel_path = _relative_path(cp.file_path, repo)
        cp_node = Node(
            id=Node.make_id(repo, "java", cp.package, "config-properties-class", cp.class_name),
            repo=repo,
            lang="java",
            package=cp.package,
            kind="config-properties-class",
            descriptor=cp.class_name,
            path=rel_path,
            axis="config_prefixes",
            documents=None,
            metadata={"prefix": cp.prefix},
        )
        nodes.append(cp_node)
        top = cp.prefix.split(".", 1)[0]
        prefix_node = prefix_node_by_top.get(top)
        if prefix_node is not None:
            edges.append(
                Edge(
                    src=cp_node.id,
                    dst=prefix_node.id,
                    type="configures",
                    metadata={"prefix": cp.prefix},
                )
            )

    # config-key-consumer nodes
    for v in value_list:
        rel_path = _relative_path(v.file_path, repo)
        # Disambiguate multiple consumers in the same class with @L<line> suffix.
        descriptor = f"{v.key}@L{v.line}"
        consumer_node = Node(
            id=Node.make_id(
                repo, "java", v.enclosing_class, "config-key-consumer", descriptor
            ),
            repo=repo,
            lang="java",
            package=v.enclosing_class,
            kind="config-key-consumer",
            descriptor=descriptor,
            path=f"{rel_path}:{v.line}",
            axis="config_prefixes",
            documents=None,
            metadata={
                "key": v.key,
                "default": v.default,
                "field_or_param": v.field_or_param,
                "enclosing_class": v.enclosing_class,
                "line": v.line,
            },
        )
        nodes.append(consumer_node)
        top = v.key.split(".", 1)[0]
        prefix_node = prefix_node_by_top.get(top)
        if prefix_node is not None:
            edges.append(
                Edge(
                    src=consumer_node.id,
                    dst=prefix_node.id,
                    type="configures",
                    metadata={"key": v.key},
                )
            )

    return nodes, edges


def _top_level_keys(yaml_path: Path) -> list[str]:
    yaml = YAML(typ="safe")
    with yaml_path.open("r") as fh:
        data = yaml.load(fh) or {}
    if not isinstance(data, dict):
        return []
    return [str(k) for k in data.keys()]


def _config_prefix_node(repo: str, prefix: str) -> Node:
    return Node(
        id=Node.make_id(repo, "yaml", "application.yml", "config-prefix", prefix),
        repo=repo,
        lang="yaml",
        package="application.yml",
        kind="config-prefix",
        descriptor=prefix,
        path=f"{APP_YAML}#{prefix}",
        axis="config_prefixes",
        documents=None,
        metadata={"top_level_key": prefix},
    )


def _relative_path(file_path: Path, repo: str) -> str:
    parts = file_path.parts
    if repo in parts:
        idx = parts.index(repo)
        return "/".join(parts[idx + 1:])
    return file_path.name
