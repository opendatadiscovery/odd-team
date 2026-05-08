"""Git anchor + diff helpers.

The substrate anchors on commit SHAs. Run modes diff against `last_scan_commit`
in the manifest:

- incremental: HEAD vs last_scan_commit → touched files
- full: entire tree
- ref: branch_ref vs last_scan_commit → touched files (side-artifact)

We use subprocess git rather than a Python git lib to keep the dep surface small.
"""
from __future__ import annotations

import subprocess
from pathlib import Path


def resolve_repo_path(workspace_root: Path, repo: str) -> Path:
    """Resolve `repo` (e.g. 'odd-platform') to its sibling directory under workspace root."""
    return (workspace_root / ".." / repo).resolve()


def git(repo_path: Path, *args: str) -> str:
    """Run a git command in repo_path and return stdout. Raises CalledProcessError on failure."""
    result = subprocess.run(
        ["git", "-C", str(repo_path), *args],
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout


def head_commit(repo_path: Path) -> str:
    return git(repo_path, "rev-parse", "HEAD").strip()


def short_sha(repo_path: Path, ref: str = "HEAD") -> str:
    return git(repo_path, "rev-parse", "--short", ref).strip()


def changed_files(repo_path: Path, base: str, head: str = "HEAD") -> list[tuple[str, str]]:
    """Return [(status, path), ...] from `git diff --name-status` between base and head.

    Status codes per `git diff --name-status -M`: A=added, M=modified, D=deleted,
    R=renamed (followed by oldpath\tnewpath in the raw output — we surface the
    new path here for simplicity; rename tracking is a Phase-2 enhancement).
    """
    out = git(repo_path, "diff", "--name-status", "-M", f"{base}..{head}")
    rows: list[tuple[str, str]] = []
    for line in out.splitlines():
        line = line.strip()
        if not line:
            continue
        parts = line.split("\t")
        status = parts[0][0]
        path = parts[-1]
        rows.append((status, path))
    return rows


def has_commit(repo_path: Path, commit: str) -> bool:
    try:
        git(repo_path, "cat-file", "-e", commit)
        return True
    except subprocess.CalledProcessError:
        return False
