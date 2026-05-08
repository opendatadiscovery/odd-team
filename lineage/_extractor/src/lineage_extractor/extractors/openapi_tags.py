"""openapi_tags axis extractor.

Reads `odd-platform-specification/openapi.yaml` (single-file spec, 4K+ lines)
and emits:

- one `openapi-tag` node per entry under `tags:` (top-level)
- one `exposes` edge from each tag to every controller-method whose name
  matches an operation's `operationId` carrying that tag

The join key is the OpenAPI-generator convention: the controller method's
Java identifier == the spec's `operationId`. The controllers axis must run
in the same extraction pass so the controller-method node IDs exist before
edges are validated downstream.
"""
from __future__ import annotations

from collections import defaultdict
from pathlib import Path
from typing import Any

from ruamel.yaml import YAML

from lineage_extractor.extractors._java import find_rest_controllers
from lineage_extractor.nodes import Edge, Node

OPENAPI_PATH = "odd-platform-specification/openapi.yaml"


def extract_openapi_tags(*, repo: str, repo_path: Path) -> tuple[list[Node], list[Edge]]:
    spec_path = repo_path / OPENAPI_PATH
    if not spec_path.is_file():
        return [], []

    spec = _load_spec(spec_path)
    tags = _tag_names(spec)
    operations = _operations_by_tag(spec)

    # Build operationId → controller-method-node-id map by walking the controller files.
    op_to_method_id = _operation_to_method_node_id(repo, repo_path)

    nodes: list[Node] = []
    edges: list[Edge] = []
    for tag in tags:
        tag_node = _tag_node(repo, tag, operations.get(tag, []))
        nodes.append(tag_node)
        for op in operations.get(tag, []):
            method_node_id = op_to_method_id.get(op["operation_id"])
            if method_node_id is None:
                continue
            edges.append(
                Edge(
                    src=tag_node.id,
                    dst=method_node_id,
                    type="exposes",
                    metadata={
                        "operation_id": op["operation_id"],
                        "http_method": op["http_method"],
                        "path": op["path"],
                    },
                )
            )
    return nodes, edges


def _load_spec(path: Path) -> dict[str, Any]:
    yaml = YAML(typ="safe")
    with path.open("r") as fh:
        return yaml.load(fh) or {}


def _tag_names(spec: dict[str, Any]) -> list[str]:
    tags = spec.get("tags") or []
    out: list[str] = []
    for entry in tags:
        if isinstance(entry, dict) and "name" in entry:
            out.append(str(entry["name"]))
    return out


def _operations_by_tag(spec: dict[str, Any]) -> dict[str, list[dict[str, Any]]]:
    """Return {tag_name: [{operation_id, http_method, path, summary}, ...]}."""
    by_tag: dict[str, list[dict[str, Any]]] = defaultdict(list)
    paths = spec.get("paths") or {}
    for path, path_item in paths.items():
        if not isinstance(path_item, dict):
            continue
        for method, op in path_item.items():
            if method.lower() not in {"get", "post", "put", "delete", "patch", "head", "options"}:
                continue
            if not isinstance(op, dict):
                continue
            op_id = op.get("operationId")
            if not op_id:
                continue
            op_tags = op.get("tags") or []
            entry = {
                "operation_id": op_id,
                "http_method": method.upper(),
                "path": path,
                "summary": op.get("summary", ""),
            }
            for tag in op_tags:
                by_tag[str(tag)].append(entry)
    return by_tag


def _tag_node(repo: str, tag: str, ops: list[dict[str, Any]]) -> Node:
    return Node(
        id=Node.make_id(repo, "openapi", "tags", "openapi-tag", tag),
        repo=repo,
        lang="openapi",
        package="tags",
        kind="openapi-tag",
        descriptor=tag,
        path=f"{OPENAPI_PATH}#tags/{tag}",
        axis="openapi_tags",
        documents=None,
        metadata={
            "operation_count": len(ops),
            "operation_ids": sorted({o["operation_id"] for o in ops}),
        },
    )


def _operation_to_method_node_id(repo: str, repo_path: Path) -> dict[str, str]:
    """Walk controllers and build operationId → controller-method-node-id.

    Method names and operationIds are the same string by the OpenAPI generator's
    convention; we collide-handle by preferring the first-seen mapping (alphabetical
    by controller class). Real collisions are not expected in this codebase
    (operationIds are globally unique in the spec).
    """
    out: dict[str, str] = {}
    for cls in find_rest_controllers(repo_path):
        for method in cls.methods:
            node_id = Node.make_id(repo, "java", cls.name, "controller-method", method.name)
            out.setdefault(method.name, node_id)
    return out
