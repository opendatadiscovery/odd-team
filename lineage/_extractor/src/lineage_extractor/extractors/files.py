"""files axis — universal pre-pass that emits one node per source file.

The file axis is the universal scaffold every other axis attaches to. It
addresses the "did we cover all the files?" question that the axis-first
taxonomy obscures (per the 2026-05-18 retrospective): a file with no
attached non-file node is an uninventoried file. The reducer + sidecar
layers can then ask "which files lack sidecars" and surface uncovered
code immediately.

This module emits `kind: file` nodes only. The `declared_in` edges that
connect non-file nodes (controllers / config-key-consumers / routes / etc.)
back to their parent file node are emitted by the post-process step in
`extractors.__init__.py:run_extraction` after every axis has produced its
nodes — that keeps per-axis extractors independent of file-node bookkeeping.

LSN-016 guardrail: this is NOT a heuristic enumerator that calls itself
lineage. A file node only carries syntactic facts (path, language, LOC,
size). The semantic content (`understanding`, `bugs`, `security`, etc.)
arrives via the file-analyser subagent at the per-file sidecar layer.
"""
from __future__ import annotations

import os
from pathlib import Path

from lineage_extractor.nodes import Edge, Node


# Default file extensions for the universal file walk. Per-project tuning is
# expected — adapt for your stack (Python: .py + .pyi; Go: .go; Rust: .rs;
# Ruby: .rb; etc.). The list intentionally includes config + spec files
# alongside source, because operator-visible behaviour often lives there
# (YAML for Spring properties, JSON for package manifests, TOML for project
# config, XML for Maven, etc.).
DEFAULT_EXTENSIONS: dict[str, str] = {
    # JVM languages
    ".java": "java",
    ".kt": "kotlin",
    ".scala": "scala",
    ".groovy": "groovy",
    # JS / TS
    ".ts": "ts",
    ".tsx": "ts",
    ".js": "js",
    ".jsx": "js",
    ".mjs": "js",
    ".cjs": "js",
    # Python
    ".py": "python",
    ".pyi": "python",
    # Go / Rust / Ruby / PHP
    ".go": "go",
    ".rs": "rust",
    ".rb": "ruby",
    ".php": "php",
    # Config + spec
    ".yml": "yaml",
    ".yaml": "yaml",
    ".json": "json",
    ".toml": "toml",
    ".xml": "xml",
    ".properties": "properties",
    # Database
    ".sql": "sql",
    # Shell
    ".sh": "shell",
    ".bash": "shell",
    # Styling + markup (UI source)
    ".css": "css",
    ".scss": "scss",
    ".less": "less",
    ".html": "html",
}


# Directories that NEVER contain source-in-scope. The walk skips these
# entirely (depth-first prune at directory level, not per-file). Tune for
# your project — but resist removing the build/output directories, since
# scanning generated code introduces false-positive nodes that mask real
# coverage gaps.
DEFAULT_SKIP_DIRS: frozenset[str] = frozenset({
    ".git",
    ".gradle",
    ".idea",
    ".vscode",
    ".mvn",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
    ".tox",
    ".venv",
    ".next",
    ".nuxt",
    ".cache",
    "node_modules",
    "build",
    "target",
    "dist",
    "out",
    "bin",
    "obj",
    "coverage",
    "venv",
    "__pycache__",
    ".terraform",
})


# Filename patterns to skip even when their extension is in DEFAULT_EXTENSIONS.
# Lock files and generated manifests are noise; the per-language manifest
# (pyproject.toml / package.json / pom.xml) is in scope, but its lockfile
# sibling is not.
DEFAULT_SKIP_FILENAMES: frozenset[str] = frozenset({
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "uv.lock",
    "Pipfile.lock",
    "poetry.lock",
    "Cargo.lock",
    "go.sum",
})


def extract_files(
    *,
    repo: str,
    repo_path: Path,
    extensions: dict[str, str] | None = None,
    skip_dirs: frozenset[str] | None = None,
    skip_filenames: frozenset[str] | None = None,
) -> tuple[list[Node], list[Edge]]:
    """Walk `repo_path` and emit one `kind: file` node per matched source file.

    The walk is depth-first via `os.walk` so skip-dir pruning is cheap. Every
    matched file gets a node carrying language, repo-relative path, LOC, and
    size in bytes. No edges are emitted at this layer — `declared_in` edges
    are added by the post-process step in `extractors.__init__.py`.

    Implementation is intentionally extractor-agnostic: no tree-sitter parse,
    no language-specific symbol extraction. The file-analyser subagent does
    the semantic read at enrichment time; this layer is the deterministic
    scaffold (per the three-layer architecture in `APPROACH.md`).
    """
    if not repo_path.is_dir():
        return [], []

    ext_map = extensions or DEFAULT_EXTENSIONS
    skips = skip_dirs or DEFAULT_SKIP_DIRS
    skip_names = skip_filenames or DEFAULT_SKIP_FILENAMES

    nodes: list[Node] = []
    repo_root_abs = repo_path.resolve()

    for dirpath, dirnames, filenames in os.walk(repo_root_abs):
        # Prune skip-dirs in place — os.walk respects mutation of dirnames.
        dirnames[:] = [d for d in dirnames if d not in skips and not d.startswith(".") or d in {".github", ".claude"}]
        # The above keeps .github/.claude (often meaningful) while pruning
        # other dotfile dirs (.git/.idea/etc. listed in DEFAULT_SKIP_DIRS).

        for filename in filenames:
            if filename in skip_names:
                continue
            ext = _file_extension(filename)
            language = ext_map.get(ext)
            if language is None:
                continue
            file_abs = Path(dirpath) / filename
            try:
                rel_path = file_abs.relative_to(repo_root_abs).as_posix()
            except ValueError:
                continue
            try:
                stat = file_abs.stat()
            except OSError:
                continue

            parent_dir = str(Path(rel_path).parent.as_posix())
            if parent_dir == ".":
                parent_dir = ""  # files at repo root carry empty package

            nodes.append(
                Node(
                    id=Node.make_id(repo, language, parent_dir, "file", filename),
                    repo=repo,
                    lang=language,
                    package=parent_dir,
                    kind="file",
                    descriptor=filename,
                    path=rel_path,
                    axis="files",
                    documents=None,
                    metadata={
                        "extension": ext,
                        "size_bytes": stat.st_size,
                        "line_count": _line_count(file_abs, stat.st_size),
                    },
                )
            )

    nodes.sort(key=lambda n: n.path)
    return nodes, []


def _file_extension(filename: str) -> str:
    """Return the lowercase suffix including the dot, or '' for no suffix.

    `pathlib.Path('foo.tar.gz').suffix` returns '.gz' — for our purposes
    the last suffix is the right choice (we want to classify `.tsx` and
    `.tar` distinctly, not both as `.tar`). We lowercase to handle
    `Foo.JAVA` / `bar.YAML` consistently.
    """
    if "." not in filename:
        return ""
    return ("." + filename.rsplit(".", 1)[1]).lower()


def _line_count(path: Path, size_bytes: int) -> int:
    """Count newlines in the file; skip files larger than 4 MB.

    Large files are typically generated assets or vendored data; counting
    their lines is wasted work and may cause memory pressure. The metadata
    just records `line_count: 0` in that case — sidecar enrichment will
    pick up the real shape if the file ever gets analysed.
    """
    if size_bytes > 4 * 1024 * 1024:
        return 0
    try:
        with path.open("rb") as fh:
            return sum(1 for _ in fh)
    except OSError:
        return 0
