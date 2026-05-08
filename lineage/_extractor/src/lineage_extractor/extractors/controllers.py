"""controllers axis extractor.

Walks `odd-platform-api/src/main/java/.../controller/*Controller.java`, parses
each with tree-sitter-java, and emits:

- one `controller` node per `@RestController` class
- one `controller-method` node per public method on that class
- `exposes` edges from each controller to its methods

The HTTP-method/path/tag metadata for each controller-method is **not** present
on the controller class — it lives on the OpenAPI-generator interface
(e.g., `AlertApi`) the controller `implements`. The controller-method's
descriptor IS the operationId, by the OpenAPI generator's convention. The
`openapi_tags` axis joins on this convention.
"""
from __future__ import annotations

from pathlib import Path

from lineage_extractor.extractors._java import (
    JavaClass,
    JavaMethod,
    find_rest_controllers,
)
from lineage_extractor.nodes import Edge, Node


def extract_controllers(*, repo: str, repo_path: Path) -> tuple[list[Node], list[Edge]]:
    classes = find_rest_controllers(repo_path)
    if not classes:
        return [], []

    nodes: list[Node] = []
    edges: list[Edge] = []
    for cls in classes:
        controller_node = _controller_node(repo, cls)
        nodes.append(controller_node)
        for method in cls.methods:
            method_node = _controller_method_node(repo, cls, method)
            nodes.append(method_node)
            edges.append(
                Edge(
                    src=controller_node.id,
                    dst=method_node.id,
                    type="exposes",
                    metadata={"line": method.line},
                )
            )
    return nodes, edges


def _controller_node(repo: str, cls: JavaClass) -> Node:
    rel_path = _relative_path(cls.file_path, repo)
    return Node(
        id=Node.make_id(repo, "java", cls.package, "controller", cls.name),
        repo=repo,
        lang="java",
        package=cls.package,
        kind="controller",
        descriptor=cls.name,
        path=rel_path,
        axis="controllers",
        documents=None,
        metadata={
            "annotations": cls.annotations,
            "implements": cls.implements,
        },
    )


def _controller_method_node(repo: str, cls: JavaClass, method: JavaMethod) -> Node:
    rel_path = _relative_path(cls.file_path, repo)
    return Node(
        id=Node.make_id(repo, "java", cls.name, "controller-method", method.name),
        repo=repo,
        lang="java",
        package=cls.name,
        kind="controller-method",
        descriptor=method.name,
        path=f"{rel_path}:{method.line}",
        axis="controllers",
        documents=None,
        metadata={
            "operation_id": method.name,
            "annotations": method.annotations,
            "line": method.line,
            "controller": cls.name,
        },
    )


def _relative_path(file_path: Path, repo: str) -> str:
    """Best-effort relative path from the repo root.

    `file_path` is absolute; we look for the `{repo}/` segment and slice from there.
    Falls back to the file basename if the segment isn't found (defensive only —
    `find_rest_controllers` always returns paths under the repo root).
    """
    parts = file_path.parts
    if repo in parts:
        idx = parts.index(repo)
        return "/".join(parts[idx + 1:])
    return file_path.name
