"""ui_routes axis extractor.

Walks `odd-platform-ui/src/routes/**/*.ts` (excluding `index.ts` re-exports),
parses each with tree-sitter-typescript, and emits one `route` node per file.

Each route file follows a stable convention in this codebase:

    const BASE_PATH = '/feature';
    export const FeatureRoutes = { TAB_A: 'a', TAB_B: 'b' } as const;
    export function featurePath(...) { return `${BASE_PATH}/${tab}`; }

We extract:
- `BASE_PATH` (the URL prefix) — primary path for the route node
- Other top-level `*_PATH` constants (e.g., `TERMS_SEARCH_PATH`) → secondary paths
- `XxxRoutes` const-with-object → sub-paths (string values become tab/sub paths)

Routes that are inline-returned by helper functions (e.g., `dataQualityPath`
returning `'/data-quality'` literally) are captured by the inline-string fallback
that scans return statements when no BASE_PATH constant is found.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

import tree_sitter
import tree_sitter_typescript

from lineage_extractor.nodes import Edge, Node


ROUTES_DIR = "odd-platform-ui/src/routes"


@lru_cache(maxsize=1)
def _ts_language() -> tree_sitter.Language:
    return tree_sitter.Language(tree_sitter_typescript.language_typescript())


def extract_ui_routes(*, repo: str, repo_path: Path) -> tuple[list[Node], list[Edge]]:
    routes_root = repo_path / ROUTES_DIR
    if not routes_root.is_dir():
        return [], []

    nodes: list[Node] = []

    for path in sorted(routes_root.rglob("*.ts")):
        # Skip re-export aggregator files (index.ts)
        if path.name == "index.ts":
            continue
        info = _parse_route_file(path)
        if info is None:
            continue
        nodes.append(_route_node(repo, path, info, routes_root))

    return nodes, []


@dataclass
class _RouteInfo:
    feature: str
    base_path: str | None
    extra_paths: dict[str, str] = field(default_factory=dict)
    sub_routes: dict[str, str] = field(default_factory=dict)
    inline_paths: list[str] = field(default_factory=list)
    base_path_imported_from: str | None = None

    def all_paths(self) -> list[str]:
        out: list[str] = []
        if self.base_path:
            out.append(self.base_path)
            for sub in self.sub_routes.values():
                out.append(f"{self.base_path}/{sub}".replace("//", "/"))
        out.extend(self.extra_paths.values())
        out.extend(self.inline_paths)
        # Deduplicate while preserving order
        seen: set[str] = set()
        deduped: list[str] = []
        for p in out:
            if p not in seen:
                seen.add(p)
                deduped.append(p)
        return deduped


def _parse_route_file(path: Path) -> _RouteInfo | None:
    parser = tree_sitter.Parser(_ts_language())
    tree = parser.parse(path.read_bytes())
    root = tree.root_node

    feature = path.stem
    if feature.endswith("Routes"):
        feature = feature[: -len("Routes")]

    info = _RouteInfo(feature=feature, base_path=None)

    for child in root.named_children:
        if child.type == "import_statement":
            _read_import_for_base_path(child, info)
        elif child.type == "lexical_declaration":
            _read_lexical_decl(child, info)
        elif child.type == "export_statement":
            for sub in child.named_children:
                if sub.type == "lexical_declaration":
                    _read_lexical_decl(sub, info)

    if info.base_path is None and not info.extra_paths and not info.sub_routes:
        # Fallback: scan return statements for "/path"-shaped string literals
        # AND template-literal suffixes (e.g. `${BASE_PATH}/query-examples`).
        for ret_path in _inline_return_paths(root):
            info.inline_paths.append(ret_path)
        for tmpl_suffix in _template_literal_suffixes(root):
            info.inline_paths.append(tmpl_suffix)
        # Deduplicate
        info.inline_paths = list(dict.fromkeys(info.inline_paths))

    if (
        info.base_path is None
        and not info.extra_paths
        and not info.sub_routes
        and not info.inline_paths
    ):
        return None
    return info


def _read_import_for_base_path(import_node, info: _RouteInfo) -> None:
    """Detect `import { BASE_PATH } from './foo'` and record the source module."""
    has_base_path = False
    source_module: str | None = None
    for c in import_node.named_children:
        if c.type == "import_clause":
            for sub in c.named_children:
                if sub.type == "named_imports":
                    for spec in sub.named_children:
                        if spec.type == "import_specifier":
                            ident = _first_named_of(spec, "identifier")
                            if ident and ident.text and ident.text.decode("utf-8") == "BASE_PATH":
                                has_base_path = True
        elif c.type == "string":
            source_module = _string_value(c)
    if has_base_path and source_module:
        info.base_path_imported_from = source_module


def _read_lexical_decl(node, info: _RouteInfo) -> None:
    """Inspect `const x = ...` declarations for path-shaped values."""
    for declarator in _children_of(node, "variable_declarator"):
        name_node = _first_named_of(declarator, "identifier")
        if name_node is None or name_node.text is None:
            continue
        name = name_node.text.decode("utf-8")
        value_node = _last_value_node(declarator)
        if value_node is None:
            continue

        if value_node.type == "string":
            literal = _string_value(value_node)
            if literal is None:
                continue
            if name == "BASE_PATH":
                info.base_path = literal
            elif name.endswith("_PATH") or name.endswith("Path"):
                info.extra_paths[name] = literal

        elif value_node.type == "as_expression":
            inner = _first_named_of(value_node, "object")
            if inner is not None and name.endswith("Routes"):
                info.sub_routes.update(_object_string_entries(inner))

        elif value_node.type == "object":
            if name.endswith("Routes"):
                info.sub_routes.update(_object_string_entries(value_node))


def _last_value_node(declarator):
    """Return the value side of a `variable_declarator` (last named child)."""
    if not declarator.named_children:
        return None
    return declarator.named_children[-1]


def _children_of(node, type_name: str):
    return [c for c in node.named_children if c.type == type_name]


def _first_named_of(node, type_name: str):
    for c in node.named_children:
        if c.type == type_name:
            return c
    return None


def _string_value(node) -> str | None:
    """Return the inside of a tree-sitter string node (handles quoted strings)."""
    if node is None or node.text is None:
        return None
    raw = node.text.decode("utf-8")
    if len(raw) >= 2 and raw[0] in {"'", '"'} and raw[-1] == raw[0]:
        return raw[1:-1]
    return raw


def _object_string_entries(object_node) -> dict[str, str]:
    """Return {key: value} for object members where value is a string literal."""
    out: dict[str, str] = {}
    for member in object_node.named_children:
        if member.type != "pair":
            continue
        key_node = _first_named_of(member, "property_identifier") or _first_named_of(
            member, "string"
        )
        value_node = member.named_children[-1] if member.named_children else None
        if key_node is None or value_node is None:
            continue
        if value_node.type != "string":
            continue
        key = key_node.text.decode("utf-8") if key_node.text else ""
        if key_node.type == "string":
            key = _string_value(key_node) or key
        value = _string_value(value_node)
        if key and value is not None:
            out[key] = value
    return out


def _inline_return_paths(root) -> list[str]:
    """Walk the AST and collect string literals from `return '/...'` statements."""
    out: list[str] = []

    def walk(node):
        if node.type == "return_statement":
            # First named child is typically the returned expression
            for c in node.named_children:
                if c.type == "string":
                    literal = _string_value(c)
                    if literal and literal.startswith("/"):
                        out.append(literal)
        for c in node.named_children:
            walk(c)

    walk(root)
    return out


def _template_literal_suffixes(root) -> list[str]:
    """Walk template literals and return text fragments that look like path
    suffixes (start with `/` and don't contain interpolations).

    Example: `${BASE_PATH}/query-examples` → ['/query-examples'].
    Example: `${BASE_PATH}/${tab}` → [] (no clean suffix).
    """
    out: list[str] = []

    def walk(node):
        if node.type == "template_string":
            # tree-sitter shape: template_string contains "`" tokens, optional
            # template_substitution nodes, and string_fragment nodes between them.
            buffered = ""
            had_interp = False
            for c in node.children:
                if c.type == "template_substitution":
                    if buffered.startswith("/") and had_interp is False:
                        # Suffix-only literal before any interpolation; skip.
                        # This catches edge cases where the path doesn't have a leading
                        # interpolation (rare in this codebase).
                        out.append(buffered)
                    buffered = ""
                    had_interp = True
                elif c.type == "string_fragment":
                    if c.text:
                        buffered += c.text.decode("utf-8")
            if had_interp and buffered.startswith("/"):
                out.append(buffered)
        for c in node.named_children:
            walk(c)

    walk(root)
    return out


def _route_node(
    repo: str, path: Path, info: _RouteInfo, routes_root: Path
) -> Node:
    # routes_root = <repo>/odd-platform-ui/src/routes; repo root is 3 parents up.
    rel_path = str(path.relative_to(routes_root.parent.parent.parent))
    return Node(
        id=Node.make_id(repo, "ts", "routes", "route", info.feature),
        repo=repo,
        lang="ts",
        package="routes",
        kind="route",
        descriptor=info.feature,
        path=rel_path,
        axis="ui_routes",
        documents=None,
        metadata={
            "base_path": info.base_path,
            "extra_paths": info.extra_paths,
            "sub_routes": info.sub_routes,
            "inline_paths": info.inline_paths,
            "all_paths": info.all_paths(),
            "base_path_imported_from": info.base_path_imported_from,
        },
    )
