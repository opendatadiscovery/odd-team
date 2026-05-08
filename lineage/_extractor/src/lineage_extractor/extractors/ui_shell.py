"""ui_shell axis extractor — closes the i18n-class blind spot (LSN-013).

Cross-cutting client-side capabilities not reachable from `routes/`:
- src/locales/i18n.ts (i18n bootstrap)
- src/locales/translations/*.json (translation resources)
- src/components/shared/elements/AppToolbar/<Widget>/ (toolbar widgets)
- src/components/shared/elements/AppErrorPage/ (error pages)
- Any TS file imported directly by src/index.tsx (ui-shell-bootstrap)
- Any <Component /> mounted inside <AppToolbar>'s render (ui-shell-widget)

Cross-validation reference: every F-047..F-051 evidence file in
`findings/docs-coverage-undocumented-features/2026-05-08.md` MUST appear as a
node here. See `lineage/PROBES.md` "Cross-validation against DOC-163 findings".
"""
from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

import tree_sitter
import tree_sitter_typescript

from lineage_extractor.nodes import Edge, Node


UI_DIR = "odd-platform-ui/src"
LOCALES_DIR = f"{UI_DIR}/locales"
TRANSLATIONS_DIR = f"{LOCALES_DIR}/translations"
APPTOOLBAR_DIR = f"{UI_DIR}/components/shared/elements/AppToolbar"
APPERRORPAGE_DIR = f"{UI_DIR}/components/shared/elements/AppErrorPage"
INDEX_TSX = f"{UI_DIR}/index.tsx"
APPTOOLBAR_TSX = f"{APPTOOLBAR_DIR}/AppToolbar.tsx"


@lru_cache(maxsize=2)
def _ts_language(flavour: str) -> tree_sitter.Language:
    if flavour == "tsx":
        return tree_sitter.Language(tree_sitter_typescript.language_tsx())
    return tree_sitter.Language(tree_sitter_typescript.language_typescript())


def _parse(path: Path, flavour: str) -> tree_sitter.Tree:
    parser = tree_sitter.Parser(_ts_language(flavour))
    return parser.parse(path.read_bytes())


def extract_ui_shell(*, repo: str, repo_path: Path) -> tuple[list[Node], list[Edge]]:
    """Extract ui_shell axis nodes + edges from `repo_path`.

    `repo_path` is the absolute path to the repo root (e.g., `~/work/odd/odd-platform`).
    Returns `(nodes, edges)`. Empty lists if the expected directories don't exist
    (e.g., a non-platform repo lacks `odd-platform-ui/`).
    """
    ui_root = repo_path / UI_DIR
    if not ui_root.is_dir():
        return [], []

    nodes: list[Node] = []
    edges: list[Edge] = []

    # 1. App entry point (index.tsx) + i18n bootstrap from its side-effect imports
    index_path = repo_path / INDEX_TSX
    if index_path.is_file():
        index_node = Node(
            id=Node.make_id(repo, "ts", "src", "ui-shell-app-entry", "index.tsx"),
            repo=repo,
            lang="ts",
            package="src",
            kind="ui-shell-app-entry",
            descriptor="index.tsx",
            path=INDEX_TSX,
            axis="ui_shell",
            documents=None,
            metadata={"app_root": True},
        )
        nodes.append(index_node)

        bootstrap_imports = _bootstrap_imports_from_index(index_path)
        for import_path in bootstrap_imports:
            if import_path.startswith("locales/"):
                bootstrap_node = Node(
                    id=Node.make_id(repo, "ts", "locales", "ui-shell-bootstrap", "i18n.ts"),
                    repo=repo,
                    lang="ts",
                    package="locales",
                    kind="ui-shell-bootstrap",
                    descriptor="i18n.ts",
                    path=f"{LOCALES_DIR}/i18n.ts",
                    axis="ui_shell",
                    documents=None,
                    metadata={
                        "imported_by": [INDEX_TSX],
                        "import_specifier": import_path,
                        "side_effect_only": True,
                    },
                )
                nodes.append(bootstrap_node)
                edges.append(Edge(src=index_node.id, dst=bootstrap_node.id, type="imports"))

    # 2. Translation resources (one node per locale json)
    translations_path = repo_path / TRANSLATIONS_DIR
    if translations_path.is_dir():
        for json_path in sorted(translations_path.glob("*.json")):
            locale = json_path.stem
            node = Node(
                id=Node.make_id(repo, "json", "locales/translations", "i18n-resource", locale),
                repo=repo,
                lang="json",
                package="locales/translations",
                kind="i18n-resource",
                descriptor=locale,
                path=f"{TRANSLATIONS_DIR}/{json_path.name}",
                axis="ui_shell",
                documents=None,
                metadata={"locale": locale},
            )
            nodes.append(node)

    # 3. AppToolbar (the toolbar root) + each widget subdirectory under AppToolbar/
    apptoolbar_path = repo_path / APPTOOLBAR_DIR
    widget_nodes_by_name: dict[str, Node] = {}
    apptoolbar_node: Node | None = None
    if apptoolbar_path.is_dir():
        apptoolbar_node = Node(
            id=Node.make_id(
                repo, "ts", "components/shared/elements/AppToolbar", "ui-shell-widget", "AppToolbar"
            ),
            repo=repo,
            lang="ts",
            package="components/shared/elements/AppToolbar",
            kind="ui-shell-widget",
            descriptor="AppToolbar",
            path=f"{APPTOOLBAR_DIR}/AppToolbar.tsx",
            axis="ui_shell",
            documents=None,
            metadata={"toolbar_root": True},
        )
        nodes.append(apptoolbar_node)
        for entry in sorted(apptoolbar_path.iterdir()):
            if not entry.is_dir():
                continue
            widget_name = entry.name
            node = Node(
                id=Node.make_id(
                    repo, "ts", "components/shared/elements/AppToolbar", "ui-shell-widget", widget_name
                ),
                repo=repo,
                lang="ts",
                package="components/shared/elements/AppToolbar",
                kind="ui-shell-widget",
                descriptor=widget_name,
                path=f"{APPTOOLBAR_DIR}/{widget_name}/",
                axis="ui_shell",
                documents=None,
                metadata={"toolbar_slot": True},
            )
            nodes.append(node)
            widget_nodes_by_name[widget_name] = node

    # 4. AppErrorPage
    apperror_path = repo_path / APPERRORPAGE_DIR
    if apperror_path.is_dir():
        node = Node(
            id=Node.make_id(
                repo, "ts", "components/shared/elements", "ui-shell-widget", "AppErrorPage"
            ),
            repo=repo,
            lang="ts",
            package="components/shared/elements",
            kind="ui-shell-widget",
            descriptor="AppErrorPage",
            path=f"{APPERRORPAGE_DIR}/AppErrorPage.tsx",
            axis="ui_shell",
            documents=None,
            metadata={"error_page_family": True},
        )
        nodes.append(node)

    # 5. AppToolbar render — find JSX elements that match widget names → mount edges
    apptoolbar_tsx = repo_path / APPTOOLBAR_TSX
    if apptoolbar_tsx.is_file() and apptoolbar_node is not None and widget_nodes_by_name:
        mounted_widgets = _mounted_jsx_components(apptoolbar_tsx)
        for widget_name in mounted_widgets:
            widget_node = widget_nodes_by_name.get(widget_name)
            if widget_node is None:
                continue
            edges.append(Edge(src=apptoolbar_node.id, dst=widget_node.id, type="mounts"))

    return nodes, edges


@dataclass(frozen=True)
class _Import:
    specifier: str
    is_side_effect: bool


def _bootstrap_imports_from_index(index_path: Path) -> list[str]:
    """Return import specifiers that are side-effect imports (no `from` clauses other than the path).

    For `import 'locales/i18n';` → returns `'locales/i18n'`.
    For `import x from 'foo';` → not returned (has a clause).
    For `import './side';` → returned.
    """
    tree = _parse(index_path, "tsx")
    root = tree.root_node
    side_effects: list[str] = []
    for child in root.named_children:
        if child.type != "import_statement":
            continue
        # Side-effect import has shape: import_statement -> import + string (no import_clause)
        has_clause = any(c.type == "import_clause" for c in child.named_children)
        if has_clause:
            continue
        for c in child.named_children:
            if c.type == "string":
                literal = c.text.decode("utf-8") if c.text else ""
                # Strip surrounding quotes (single or double)
                if len(literal) >= 2 and literal[0] in {"'", '"'} and literal[-1] == literal[0]:
                    literal = literal[1:-1]
                side_effects.append(literal)
    return side_effects


def _mounted_jsx_components(tsx_path: Path) -> set[str]:
    """Return the set of JSX component names rendered inside the file.

    A name is "mounted" if a `jsx_element` or `jsx_self_closing_element` whose
    opening tag is an identifier appears anywhere in the file. We don't try to
    distinguish toolbar-render vs other-render in this MVP — toolbars are small
    files and false positives are rare.
    """
    tree = _parse(tsx_path, "tsx")
    found: set[str] = set()

    def walk(node) -> None:
        for kind in ("jsx_self_closing_element", "jsx_opening_element"):
            if node.type == kind:
                # First named child is the tag name (identifier or member_expression)
                for c in node.named_children:
                    if c.type == "identifier":
                        text = c.text.decode("utf-8") if c.text else ""
                        if text and text[0].isupper():
                            found.add(text)
                        break
        for c in node.named_children:
            walk(c)

    walk(tree.root_node)
    return found
