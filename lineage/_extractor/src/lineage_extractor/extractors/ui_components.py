"""ui_components axis extractor — closes the major UI-component substrate gap.

Walks `odd-platform-ui/src/components/**/*.tsx`, identifies each file with a
top-level default export of a React component, and emits one node per such
file with `axis: "ui_components"`, `kind: "react-component"`.

Per the 2026-05-26 diagnosis (lineage/odd-platform/shoebox/triage-reports/
2026-05-26-step-0-parallel.md §"Why these two features aren't captured"):
the methodology was discovering UI components only via hand-curated paths fed
to /enrich. The substrate had axes `ui_routes` (12 nodes) + `ui_shell`
(13 nodes) covering ~25 UI files — but the platform ships several hundred
`*.tsx` components. F-075 (User-Owner Association Request Flow) graduated as
backend-only because the entire `Management/OwnerAssociations/` UI directory
was invisible to the substrate. The per-DataEntity Overview tab's 14
sub-components and the EntityClassItem / EntityTypeItem badges had the same
shape of invisibility.

This extractor makes the substrate exhaustive for the UI-components axis.
Downstream `/enrich` runs and the `feature-flow-builder` Step 0 / Rule 0b
pass can now SEE every UI surface.

Exclusions (do NOT emit nodes for):
- `*.test.tsx`, `*.spec.tsx`, `*.stories.tsx` (test / story files)
- `*Styles.ts(x)`, `*.styles.ts(x)` (style modules — no JSX surface)
- Files under `__tests__/` directories
- Files with NO default export (utility / type-only / hook-only modules)
- Files that re-export defaults from elsewhere (`export { default } from './X'`)
  — the target file is the real component anchor

Coexistence with `ui_shell`: ui_shell emits slot-level nodes (`AppToolbar`
as a directory-anchored widget; `AppErrorPage` as a directory-anchored
widget). This extractor emits file-level nodes for the underlying .tsx
components inside those directories. Both granularities are useful — the
ui_shell "what mounts where" semantic is preserved; the ui_components
"every .tsx surface" semantic is added. Node IDs differ by (kind, package)
so there are no collisions.

The cost is bounded — tree-sitter parses ~500 .tsx files in <2s on a modern
laptop. Memory usage is per-file (no global AST retained).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Iterable

import tree_sitter
import tree_sitter_typescript

from lineage_extractor.nodes import Edge, Node


COMPONENTS_DIR = "odd-platform-ui/src/components"

# Skip patterns (filename / directory matchers)
_SKIP_FILENAME_SUFFIXES = (
    ".test.tsx",
    ".spec.tsx",
    ".stories.tsx",
    ".styles.ts",
    ".styles.tsx",
    "Styles.ts",
    "Styles.tsx",
)

_SKIP_DIR_NAMES = {"__tests__", "__mocks__", "__snapshots__"}


@lru_cache(maxsize=1)
def _ts_language() -> tree_sitter.Language:
    return tree_sitter.Language(tree_sitter_typescript.language_tsx())


def _parse(path: Path) -> tree_sitter.Tree:
    parser = tree_sitter.Parser(_ts_language())
    return parser.parse(path.read_bytes())


def extract_ui_components(*, repo: str, repo_path: Path) -> tuple[list[Node], list[Edge]]:
    """Extract ui_components axis nodes from `repo_path`.

    `repo_path` is the absolute path to the repo root (e.g.,
    `~/work/odd/odd-platform`). Returns `(nodes, edges)` — edges is always
    `[]` in this MVP; child-JSX mount edges land in a follow-up commit once
    the cross-component resolution table is available.
    """
    components_root = repo_path / COMPONENTS_DIR
    if not components_root.is_dir():
        return [], []

    nodes: list[Node] = []
    for tsx_path in _walk_tsx_files(components_root):
        try:
            info = _parse_component_file(tsx_path)
        except Exception:
            # Tree-sitter parse failure — file is malformed or contains
            # unsupported syntax. Skip silently; downstream tooling can
            # still discover the file via the `files` axis.
            continue
        if info is None:
            continue
        node = _component_node(repo, tsx_path, info, components_root)
        nodes.append(node)

    return nodes, []


def _walk_tsx_files(root: Path) -> Iterable[Path]:
    """Yield non-excluded .tsx files under `root` in deterministic order."""
    for path in sorted(root.rglob("*.tsx")):
        if any(part in _SKIP_DIR_NAMES for part in path.relative_to(root).parts):
            continue
        if any(path.name.endswith(suffix) for suffix in _SKIP_FILENAME_SUFFIXES):
            continue
        yield path


@dataclass
class _ComponentInfo:
    """What the extractor records about one .tsx file."""

    descriptor: str
    """The default-export identifier name (or filename stem if anonymous)."""

    default_export_kind: str
    """One of: function-declaration | arrow-function | identifier-reference
    | anonymous | class-component | unknown."""

    hooks_used: list[str] = field(default_factory=list)
    """All identifiers matching `^use[A-Z]` invoked as call_expression."""

    react_query_hooks: list[str] = field(default_factory=list)
    """Subset of hooks_used that are react-query (useQuery / useMutation / etc.)."""

    redux_hooks: list[str] = field(default_factory=list)
    """Subset of hooks_used that are react-redux (useDispatch / useSelector / etc.)."""

    jotai_hooks: list[str] = field(default_factory=list)
    """Subset of hooks_used that are jotai (useAtom / useAtomValue / etc.)."""

    child_jsx: list[str] = field(default_factory=list)
    """PascalCase JSX-element names rendered inside the component."""

    imports_count: int = 0
    """Number of top-level import statements (for size signal)."""

    lines_of_code: int = 0
    """Non-blank line count (rough size signal)."""


# Hook category prefixes (well-known third-party libs in this codebase)
_REACT_QUERY_PREFIXES = ("useQuery", "useMutation", "useInfiniteQuery", "useQueries", "useQueryClient")
_REDUX_HOOKS = {"useDispatch", "useSelector", "useStore", "useAppDispatch", "useAppSelector"}
_JOTAI_HOOKS = {"useAtom", "useAtomValue", "useSetAtom", "useResetAtom"}


def _parse_component_file(path: Path) -> _ComponentInfo | None:
    """Parse one .tsx file and return its component info, or None to skip."""
    tree = _parse(path)
    root = tree.root_node

    default_export = _find_default_export(root, path)
    if default_export is None:
        return None  # No default export — not a primary component

    descriptor, default_export_kind = default_export

    hooks = _collect_hooks(root)
    child_jsx = sorted(_collect_jsx_components(root))
    imports_count = _count_top_level_imports(root)
    lines_of_code = _count_non_blank_lines(path)

    react_query = sorted(h for h in hooks if any(h.startswith(p) for p in _REACT_QUERY_PREFIXES))
    redux = sorted(h for h in hooks if h in _REDUX_HOOKS)
    jotai = sorted(h for h in hooks if h in _JOTAI_HOOKS)

    return _ComponentInfo(
        descriptor=descriptor,
        default_export_kind=default_export_kind,
        hooks_used=sorted(hooks),
        react_query_hooks=react_query,
        redux_hooks=redux,
        jotai_hooks=jotai,
        child_jsx=child_jsx,
        imports_count=imports_count,
        lines_of_code=lines_of_code,
    )


def _find_default_export(root, path: Path) -> tuple[str, str] | None:
    """Locate the file's top-level default export.

    Returns `(descriptor, kind)` where `kind` is one of:
        - `function-declaration` — `export default function Foo() {...}`
        - `arrow-function`       — `export default Foo;` where Foo is `const Foo = () => ...`
        - `identifier-reference` — `export default Foo;` where Foo is declared elsewhere
        - `anonymous`            — `export default () => ...` or similar; descriptor is filename
        - `class-component`      — `export default class Foo extends ...`
        - `unknown`              — default export exists but doesn't match recognised patterns

    Returns `None` if the file has no default export AT ALL, or if the default
    export is an object literal (re-export aggregator pattern) or `export { default } from`.
    """
    for child in root.named_children:
        # Pattern: export_statement → "export" + "default" + value
        if child.type != "export_statement":
            continue
        if not _has_default_keyword(child):
            continue

        # Case: `export { default } from './X'` (re-export aggregator)
        # Tree-sitter shape: export_statement → export_clause (with `default` specifier)
        if _is_default_re_export(child):
            return None

        # Inspect the exported value (the named child after `export` / `default`)
        for value_child in child.named_children:
            t = value_child.type
            if t == "function_declaration":
                # export default function Foo() {...}
                name = _identifier_text(_first_child_of_type(value_child, "identifier"))
                if name:
                    return (name, "function-declaration")
                return (path.stem, "anonymous")
            if t == "class_declaration":
                name = _identifier_text(_first_child_of_type(value_child, "type_identifier"))
                if name:
                    return (name, "class-component")
                return (path.stem, "anonymous")
            if t == "arrow_function":
                # export default () => ... (anonymous arrow)
                return (path.stem, "anonymous")
            if t == "identifier":
                # export default Foo  (referenced — find what Foo is)
                name = _identifier_text(value_child)
                kind = _resolve_identifier_kind(root, name) if name else "identifier-reference"
                return (name or path.stem, kind)
            if t == "call_expression":
                # export default memo(Foo) / observer(Foo) — common HOC pattern
                inner = _hoc_inner_identifier(value_child)
                if inner:
                    return (inner, "hoc-wrapped")
                return (path.stem, "anonymous")
            if t == "object":
                # export default { Foo, Bar } — re-export object; not a component file
                return None

    return None


def _has_default_keyword(export_statement) -> bool:
    """Detect whether the `export_statement` carries the `default` keyword.

    Tree-sitter exposes literal keywords as unnamed children. We scan the raw
    children for a `default` text token.
    """
    for child in export_statement.children:
        if child.type == "default" or (child.text and child.text == b"default"):
            return True
    return False


def _is_default_re_export(export_statement) -> bool:
    """Detect `export { default } from './X'` re-export aggregators."""
    has_from = False
    has_default_specifier = False
    for child in export_statement.named_children:
        if child.type == "export_clause":
            for spec in child.named_children:
                if spec.type == "export_specifier":
                    for c in spec.named_children:
                        if c.type == "identifier" and c.text == b"default":
                            has_default_specifier = True
        if child.type == "string":
            has_from = True
    return has_default_specifier and has_from


def _resolve_identifier_kind(root, name: str) -> str:
    """Find what `name` refers to in the file's top-level declarations."""
    if not name:
        return "identifier-reference"
    for child in root.named_children:
        if child.type == "function_declaration":
            decl_name = _identifier_text(_first_child_of_type(child, "identifier"))
            if decl_name == name:
                return "function-declaration"
        if child.type == "class_declaration":
            decl_name = _identifier_text(_first_child_of_type(child, "type_identifier"))
            if decl_name == name:
                return "class-component"
        if child.type == "lexical_declaration":
            # const Foo = (...) => ...   OR   const Foo = function (...)
            for declarator in child.named_children:
                if declarator.type != "variable_declarator":
                    continue
                decl_name = _identifier_text(_first_child_of_type(declarator, "identifier"))
                if decl_name == name:
                    value = _value_of_declarator(declarator)
                    if value is None:
                        return "identifier-reference"
                    if value.type == "arrow_function":
                        return "arrow-function"
                    if value.type == "function_expression":
                        return "function-declaration"
                    if value.type == "call_expression":
                        inner = _hoc_inner_identifier(value)
                        if inner:
                            return "hoc-wrapped"
                    return "identifier-reference"
    return "identifier-reference"


def _hoc_inner_identifier(call_expr) -> str | None:
    """For `memo(Foo)` / `observer(Foo)`, return `Foo`. Returns None otherwise."""
    for c in call_expr.named_children:
        if c.type == "arguments":
            for arg in c.named_children:
                if arg.type == "identifier":
                    return _identifier_text(arg)
    return None


def _value_of_declarator(declarator):
    """Return the right-hand-side node of a `const X = <value>` declarator."""
    # variable_declarator → identifier + (optional type_annotation) + value
    seen_identifier = False
    for c in declarator.named_children:
        if c.type == "identifier":
            seen_identifier = True
            continue
        if c.type == "type_annotation":
            continue
        if seen_identifier:
            return c
    return None


def _identifier_text(node) -> str | None:
    if node is None or node.text is None:
        return None
    return node.text.decode("utf-8")


def _first_child_of_type(parent, type_name: str):
    for c in parent.named_children:
        if c.type == type_name:
            return c
    return None


def _collect_hooks(root) -> set[str]:
    """Collect identifiers matching `^use[A-Z]` invoked as `call_expression`."""
    found: set[str] = set()

    def visit(node) -> None:
        if node.type == "call_expression":
            func = _first_child_of_type(node, "identifier")
            if func is not None:
                name = _identifier_text(func) or ""
                if name.startswith("use") and len(name) > 3 and name[3].isupper():
                    found.add(name)
        for c in node.named_children:
            visit(c)

    visit(root)
    return found


def _collect_jsx_components(root) -> set[str]:
    """Collect PascalCase JSX-element tag names."""
    found: set[str] = set()

    def visit(node) -> None:
        if node.type in ("jsx_opening_element", "jsx_self_closing_element"):
            for c in node.named_children:
                if c.type == "identifier":
                    name = _identifier_text(c) or ""
                    if name and name[0].isupper():
                        found.add(name)
                    break
                if c.type == "member_expression":
                    # e.g. <Foo.Bar> — record the head identifier
                    head = _first_child_of_type(c, "identifier")
                    name = _identifier_text(head) or ""
                    if name and name[0].isupper():
                        found.add(name)
                    break
        for c in node.named_children:
            visit(c)

    visit(root)
    return found


def _count_top_level_imports(root) -> int:
    return sum(1 for c in root.named_children if c.type == "import_statement")


def _count_non_blank_lines(path: Path) -> int:
    try:
        return sum(1 for line in path.read_text(encoding="utf-8").splitlines() if line.strip())
    except UnicodeDecodeError:
        return 0


def _component_node(
    repo: str,
    file_path: Path,
    info: _ComponentInfo,
    components_root: Path,
) -> Node:
    """Build a Node record for one discovered component file."""
    # The repo-relative path of the file, e.g. odd-platform-ui/src/components/X/Y.tsx
    repo_root = components_root.parents[2]  # components/ → src/ → odd-platform-ui/ → repo root
    rel_to_repo = file_path.relative_to(repo_root).as_posix()

    # `package` is the directory under `src/` containing the file:
    #   src/components/Management/OwnerAssociations/OwnerAssociations.tsx
    # → "components/Management/OwnerAssociations"
    src_dir = components_root.parent  # odd-platform-ui/src
    rel_dir = file_path.parent.relative_to(src_dir).as_posix()

    metadata: dict = {
        "default_export_kind": info.default_export_kind,
        "lines_of_code": info.lines_of_code,
        "imports_count": info.imports_count,
        "hooks_used": info.hooks_used,
        "child_jsx_count": len(info.child_jsx),
    }
    # Carry hook subsets only when non-empty (keeps the jsonl readable).
    if info.react_query_hooks:
        metadata["react_query_hooks"] = info.react_query_hooks
    if info.redux_hooks:
        metadata["redux_hooks"] = info.redux_hooks
    if info.jotai_hooks:
        metadata["jotai_hooks"] = info.jotai_hooks
    if info.child_jsx:
        # Bound the list to keep node records compact — the full set is
        # re-derivable from the source on demand.
        metadata["child_jsx_top"] = info.child_jsx[:32]

    return Node(
        id=Node.make_id(repo, "ts", rel_dir, "react-component", info.descriptor),
        repo=repo,
        lang="ts",
        package=rel_dir,
        kind="react-component",
        descriptor=info.descriptor,
        path=rel_to_repo,
        axis="ui_components",
        documents=None,
        metadata=metadata,
    )
