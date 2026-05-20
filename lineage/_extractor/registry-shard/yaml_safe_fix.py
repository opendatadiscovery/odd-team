#!/usr/bin/env python3
"""Auto-fix YAML parse errors in rev-2 sharded detail files.

The recurring failure mode: reducer subagents emit YAML scalars containing
unquoted `: ` substrings (e.g. `@ReactiveTransactional on update` after a
colon-space, or `(proposed: ...)` parentheticals inside list items, or
`resolved: true` inside prose). YAML scanner rejects these as ambiguous
mapping keys.

This helper:
1. Scans a directory tree (default: lineage/odd-platform) for *.yaml files
2. For each: attempt `yaml.safe_load`. If OK → skip. If broken → autofix.
3. Autofix walks back from the error line to find the most recent `key: value`
   anchor and rewrites the value as a `|-` block scalar.
4. Re-validates after autofix. If still broken → log + leave for human review.

Designed to be called by /next-batch Phase 3 after each reducer phase.
Idempotent on re-run. Never destroys data — a backup of the original
broken file is kept as `{file}.broken-yaml-backup` if the autofix can't
recover (so the maintainer can hand-edit later).

Usage:
  python3 yaml_safe_fix.py [<directory>]   # default: lineage/odd-platform
  python3 yaml_safe_fix.py --dry-run       # report broken files without modifying
"""
from __future__ import annotations

import re
import sys
import yaml
from pathlib import Path

DEFAULT_ROOT = Path(__file__).resolve().parents[2] / "odd-platform"


def _try_parse(text: str):
    """Return (ok, error_mark_line, error_problem) tuple. Handles both
    single-doc and multi-doc YAML (frontmatter + body separated by `---`).
    """
    # Try multi-doc first (covers files with frontmatter + body — probes,
    # legacy monoliths). Multi-doc is intentional and not a bug.
    try:
        list(yaml.safe_load_all(text))
        return True, None, None
    except yaml.YAMLError as e:
        mark = getattr(e, "problem_mark", None)
        line = mark.line if mark is not None else None
        return False, line, str(e)


def _find_key_anchor(lines: list[str], error_line: int) -> tuple[int, int, str] | None:
    """Walk back from error_line to find the most recent `key: value` line at
    the outer-most indent that includes error_line as a continuation.

    Returns (key_line_index, key_indent, key_name) or None.
    """
    error_line_indent = len(lines[error_line]) - len(lines[error_line].lstrip())
    for prev in range(error_line, -1, -1):
        ln = lines[prev]
        m = re.match(r"^(\s*)([\w][\w-]*):\s+(.*?)$", ln)
        if not m:
            continue
        prev_indent = len(m.group(1))
        if prev_indent <= error_line_indent:
            return prev, prev_indent, m.group(2)
    return None


def _find_value_end(lines: list[str], key_line: int, key_indent: int) -> int:
    """Return the last line index that is part of the value of the key at key_line.

    A value continuation line has indent > key_indent OR is a blank line followed
    by more continuation. Stop at a line whose indent <= key_indent AND non-blank.
    """
    end = key_line
    for nxt in range(key_line + 1, len(lines)):
        ln = lines[nxt]
        if not ln.strip():
            end = nxt
            continue
        line_indent = len(ln) - len(ln.lstrip())
        if line_indent <= key_indent:
            return end
        end = nxt
    return end


def _rewrite_as_block_scalar(lines: list[str], key_line: int, key_indent: int, key_name: str, value_end: int) -> list[str]:
    """Replace lines[key_line..value_end] with `key: |-` + indented value lines.

    The original first-line value (after `key: `) becomes the first content line
    of the block scalar. Subsequent lines keep their relative indentation but get
    aligned to (key_indent + 2).
    """
    first_line = lines[key_line]
    m = re.match(r"^(\s*)([\w][\w-]*):\s+(.*?)$", first_line)
    if not m:
        return lines  # safety net
    first_value = m.group(3)
    pad = " " * (key_indent + 2)
    new_block = [f"{' ' * key_indent}{key_name}: |-", f"{pad}{first_value}"]
    for i in range(key_line + 1, value_end + 1):
        ln = lines[i]
        if not ln.strip():
            new_block.append("")
            continue
        # Strip the original leading whitespace; re-align to pad.
        stripped = ln.lstrip()
        new_block.append(f"{pad}{stripped}")
    return lines[:key_line] + new_block + lines[value_end + 1:]


def autofix_file(path: Path, dry_run: bool = False) -> str:
    """Attempt to autofix a single YAML file. Returns a status string:
    `ok` | `fixed` | `unfixable` | `dry-run-broken`
    """
    text = path.read_text()
    ok, err_line, err_msg = _try_parse(text)
    if ok:
        return "ok"
    if err_line is None:
        return "unfixable"

    # Try up to 5 fix passes — each fix may surface a deeper error.
    lines = text.split("\n")
    for attempt in range(5):
        anchor = _find_key_anchor(lines, err_line)
        if anchor is None:
            break
        key_line, key_indent, key_name = anchor
        value_end = _find_value_end(lines, key_line, key_indent)
        lines = _rewrite_as_block_scalar(lines, key_line, key_indent, key_name, value_end)
        new_text = "\n".join(lines)
        ok, err_line, err_msg = _try_parse(new_text)
        if ok:
            if dry_run:
                return f"dry-run-broken (would-fix after {attempt + 1} pass)"
            # Backup original then write
            backup = path.with_suffix(path.suffix + ".broken-yaml-backup")
            if not backup.exists():
                backup.write_text(text)
            path.write_text(new_text)
            return f"fixed (after {attempt + 1} pass)"
        # Loop: deeper error revealed; try again.

    if dry_run:
        return f"dry-run-broken (unfixable; last error: {err_msg[:80]})"
    # Final fallback: write backup so the maintainer can hand-edit later.
    backup = path.with_suffix(path.suffix + ".broken-yaml-backup")
    if not backup.exists():
        backup.write_text(text)
    return f"unfixable (last error: {err_msg[:80]})"


def scan(root: Path, dry_run: bool = False) -> dict:
    stats = {"ok": 0, "fixed": 0, "unfixable": 0, "dry-run-broken": 0}
    fixed_files = []
    unfixable_files = []
    for path in root.rglob("*.yaml"):
        if ".broken-yaml-backup" in path.name:
            continue
        status = autofix_file(path, dry_run=dry_run)
        if status == "ok":
            stats["ok"] += 1
        elif status.startswith("fixed"):
            stats["fixed"] += 1
            fixed_files.append(str(path))
        elif status.startswith("dry-run-broken"):
            stats["dry-run-broken"] += 1
            fixed_files.append(f"{path}  →  {status}")
        else:
            stats["unfixable"] += 1
            unfixable_files.append(f"{path}  →  {status}")
    return {"stats": stats, "fixed_files": fixed_files, "unfixable_files": unfixable_files}


def main():
    dry_run = "--dry-run" in sys.argv
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    root = Path(args[0]) if args else DEFAULT_ROOT
    if not root.exists():
        print(f"error: {root} does not exist", file=sys.stderr)
        sys.exit(2)
    result = scan(root, dry_run=dry_run)
    print(f"=== yaml_safe_fix.py {'(dry-run)' if dry_run else ''} ===")
    print(f"  root: {root}")
    print(f"  ok: {result['stats']['ok']}")
    print(f"  fixed: {result['stats']['fixed']}")
    print(f"  dry-run-broken: {result['stats']['dry-run-broken']}")
    print(f"  unfixable: {result['stats']['unfixable']}")
    if result['fixed_files']:
        print("  --- fixed/would-fix ---")
        for f in result['fixed_files']:
            print(f"    {f}")
    if result['unfixable_files']:
        print("  --- unfixable (backups created at .broken-yaml-backup) ---")
        for f in result['unfixable_files']:
            print(f"    {f}")


if __name__ == "__main__":
    main()
