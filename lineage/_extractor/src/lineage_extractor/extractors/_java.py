"""Shared Java tree-sitter parsing utilities.

Used by the `controllers` axis (emits controller + controller-method nodes)
and the `openapi_tags` axis (joins openapi operations to controller methods
via the method-name == operationId convention from the OpenAPI generator).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

import tree_sitter
import tree_sitter_java


@lru_cache(maxsize=1)
def java_language() -> tree_sitter.Language:
    return tree_sitter.Language(tree_sitter_java.language())


def parse_java(path: Path) -> tree_sitter.Tree:
    parser = tree_sitter.Parser(java_language())
    return parser.parse(path.read_bytes())


@dataclass
class JavaClass:
    """A parsed Java top-level class."""

    file_path: Path
    name: str
    package: str
    annotations: list[str] = field(default_factory=list)  # marker-annotation names like 'RestController'
    implements: list[str] = field(default_factory=list)
    methods: list["JavaMethod"] = field(default_factory=list)


@dataclass
class JavaMethod:
    name: str
    annotations: list[str] = field(default_factory=list)
    return_type: str | None = None
    line: int = 0


def parse_java_class(path: Path) -> JavaClass | None:
    """Return the first top-level class declared in `path`, or None."""
    tree = parse_java(path)
    root = tree.root_node

    package = _package_decl(root)

    for child in root.named_children:
        if child.type != "class_declaration":
            continue
        name = _identifier_text(_first_named_of_type(child, "identifier"))
        if name is None:
            continue
        annotations = _annotation_names(child)
        implements = _implements_list(child)
        methods = _class_methods(child)
        return JavaClass(
            file_path=path,
            name=name,
            package=package or "",
            annotations=annotations,
            implements=implements,
            methods=methods,
        )
    return None


def _package_decl(root) -> str | None:
    for child in root.named_children:
        if child.type == "package_declaration":
            for sub in child.named_children:
                if sub.type in ("scoped_identifier", "identifier"):
                    return sub.text.decode("utf-8") if sub.text else None
    return None


def _annotation_names(class_node) -> list[str]:
    """Return annotation names (e.g., 'RestController' for `@RestController`).

    Looks in the class_declaration's preceding `modifiers` block.
    """
    out: list[str] = []
    for child in class_node.named_children:
        if child.type != "modifiers":
            continue
        for sub in child.named_children:
            if sub.type in ("marker_annotation", "annotation"):
                name_node = _first_named_of_type(sub, "identifier") or _first_named_of_type(
                    sub, "scoped_identifier"
                )
                if name_node and name_node.text:
                    out.append(name_node.text.decode("utf-8"))
    return out


def _implements_list(class_node) -> list[str]:
    """Return implemented interface names from the `super_interfaces` clause."""
    out: list[str] = []
    for child in class_node.named_children:
        if child.type != "super_interfaces":
            continue
        for sub in child.named_children:
            if sub.type == "type_list":
                for type_node in sub.named_children:
                    if type_node.type in ("type_identifier", "scoped_type_identifier"):
                        if type_node.text:
                            out.append(type_node.text.decode("utf-8"))
                    elif type_node.type == "generic_type":
                        ident = _first_named_of_type(type_node, "type_identifier")
                        if ident and ident.text:
                            out.append(ident.text.decode("utf-8"))
    return out


def _class_methods(class_node) -> list[JavaMethod]:
    """Return method declarations in the class body."""
    methods: list[JavaMethod] = []
    body = _first_named_of_type(class_node, "class_body")
    if body is None:
        return methods
    for child in body.named_children:
        if child.type != "method_declaration":
            continue
        name_node = _first_named_of_type(child, "identifier")
        if name_node is None or name_node.text is None:
            continue
        method_name = name_node.text.decode("utf-8")
        annotations: list[str] = []
        for sub in child.named_children:
            if sub.type == "modifiers":
                for ann in sub.named_children:
                    if ann.type in ("marker_annotation", "annotation"):
                        ann_name = _first_named_of_type(ann, "identifier") or _first_named_of_type(
                            ann, "scoped_identifier"
                        )
                        if ann_name and ann_name.text:
                            annotations.append(ann_name.text.decode("utf-8"))
        methods.append(
            JavaMethod(
                name=method_name,
                annotations=annotations,
                line=child.start_point[0] + 1,
            )
        )
    return methods


def _first_named_of_type(node, type_name: str):
    for c in node.named_children:
        if c.type == type_name:
            return c
    return None


def _identifier_text(node) -> str | None:
    if node is None or node.text is None:
        return None
    return node.text.decode("utf-8")


def find_rest_controllers(repo_path: Path) -> list[JavaClass]:
    """Walk `*Controller.java` files under `odd-platform-api/src/main/java` and
    return the parsed `JavaClass` for each top-level class annotated with
    `@RestController`.
    """
    api_root = repo_path / "odd-platform-api" / "src" / "main" / "java"
    if not api_root.is_dir():
        return []
    out: list[JavaClass] = []
    for path in sorted(api_root.rglob("*Controller.java")):
        cls = parse_java_class(path)
        if cls is None:
            continue
        if "RestController" not in cls.annotations:
            continue
        out.append(cls)
    return out
