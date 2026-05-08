"""Lineage extractor CLI.

Run modes per `adrs/drafts/code-lineage-substrate.md`:
- incremental (default) — git diff last_scan_commit..HEAD → touched files + N-hop graph walk
- --full — entire repo
- --dry-run — emit delta to stdout, do not write artifact
- --ref <branch> — diff against branch; write side artifact at branch-{slug}.delta.json
"""
from __future__ import annotations

import sys
from pathlib import Path

import click

from lineage_extractor import __version__
from lineage_extractor.extractors import run_extraction
from lineage_extractor.manifest import load_manifest, save_manifest
from lineage_extractor.repo import resolve_repo_path


@click.group()
@click.version_option(__version__, prog_name="lineage-extractor")
def main() -> None:
    """ODD lineage substrate extractor."""


@main.command()
@click.argument("repo")
@click.option("--full", "mode_full", is_flag=True, help="Full rebuild (rescan entire repo).")
@click.option("--dry-run", is_flag=True, help="Emit delta without writing artifact.")
@click.option("--ref", default=None, help="Branch ref to diff against (writes side artifact).")
@click.option("--reach", default=1, type=int, help="Graph-walk depth from touched files (default 1).")
@click.option(
    "--axis",
    "axes",
    multiple=True,
    help="Restrict to specific axes (default: all enabled in manifest). Repeatable.",
)
@click.option(
    "--workspace",
    type=click.Path(file_okay=False, path_type=Path),
    default=None,
    help="Workspace root (default: parent of lineage/).",
)
def scan(
    repo: str,
    mode_full: bool,
    dry_run: bool,
    ref: str | None,
    reach: int,
    axes: tuple[str, ...],
    workspace: Path | None,
) -> None:
    """Scan REPO and update lineage artifacts.

    REPO is a sibling-directory name under the workspace root (e.g., 'odd-platform',
    'odd-collectors').
    """
    workspace_root = workspace or _default_workspace_root()
    repo_path = resolve_repo_path(workspace_root, repo)
    if not repo_path.is_dir():
        raise click.ClickException(f"Repo path not found: {repo_path}")

    lineage_dir = workspace_root / "lineage" / repo
    lineage_dir.mkdir(parents=True, exist_ok=True)

    if mode_full:
        run_mode = "full"
    elif ref:
        run_mode = "ref"
    else:
        run_mode = "incremental"

    manifest = load_manifest(lineage_dir / "manifest.yaml")

    result = run_extraction(
        repo=repo,
        repo_path=repo_path,
        lineage_dir=lineage_dir,
        workspace_root=workspace_root,
        mode=run_mode,
        ref=ref,
        reach=reach,
        axes=set(axes) if axes else None,
        manifest=manifest,
        dry_run=dry_run,
    )

    if dry_run:
        click.echo("--- dry-run: lineage NOT written ---")
        click.echo(result.summary)
        return

    if not result.ok:
        click.echo(f"extraction failed: {result.error}", err=True)
        sys.exit(1)

    save_manifest(lineage_dir / "manifest.yaml", result.manifest)
    click.echo(result.summary)


@main.command()
@click.option(
    "--workspace",
    type=click.Path(file_okay=False, path_type=Path),
    default=None,
    help="Workspace root (default: parent of lineage/).",
)
def probe(workspace: Path | None) -> None:
    """Run probe-driven validation against the current lineage artifacts.

    Reads `lineage/PROBES.md` + per-repo `lineage/{repo}/nodes.jsonl` and reports
    PASS / FAIL classified per the probe protocol.
    """
    workspace_root = workspace or _default_workspace_root()
    probes_file = workspace_root / "lineage" / "PROBES.md"
    if not probes_file.is_file():
        raise click.ClickException(f"Probes file not found: {probes_file}")
    click.echo("probe runner not yet implemented (pending second-slice commit)")


def _default_workspace_root() -> Path:
    """Resolve the workspace root from the extractor's install location.

    The extractor lives at `lineage/_extractor/src/lineage_extractor/cli.py`;
    workspace root (the directory containing `lineage/`) is four levels up.
    Falls back to CWD if the expected layout is missing.
    """
    here = Path(__file__).resolve()
    candidate = here.parents[4]
    if (candidate / "lineage").is_dir():
        return candidate
    return Path.cwd()


if __name__ == "__main__":
    main()
