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
from lineage_extractor.manifest import load_manifest, save_manifest, today_iso
from lineage_extractor.repo import resolve_repo_path
from lineage_extractor.validators import format_result, validate_sidecar


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


@main.command("docs-ingest")
@click.argument("repo")
@click.option("--dry-run", is_flag=True, help="Emit summary without writing artifacts.")
@click.option(
    "--workspace",
    type=click.Path(file_okay=False, path_type=Path),
    default=None,
    help="Workspace root (default: parent of lineage/).",
)
def docs_ingest_cmd(repo: str, dry_run: bool, workspace: Path | None) -> None:
    """Ingest the live documentation manual into REPO's lineage as Doc nodes.

    Walks `../documentation/docs/**/*.md`, splits each page by heading/anchor,
    and writes `lineage/{repo}/doc-nodes.jsonl` + `documentation/_manifest.yaml`.
    Mechanical, no LLM, no network — doc prose stays in ../documentation (the
    embedder reads it at graph-build). The agentic reverse-links (DESCRIBES) are
    the separate `doc-analyser` pass. See adrs/drafts/ground-truth-lineage.md.

    REPO is the lineage to attach docs to (e.g., 'odd-platform') — the docs join
    that graph so doc↔code cross-modal queries work in one index.
    """
    from lineage_extractor.extractors.docs import DOC_REPO, ingest_docs

    workspace_root = workspace or _default_workspace_root()
    documentation_path = resolve_repo_path(workspace_root, DOC_REPO)
    if not documentation_path.is_dir():
        raise click.ClickException(f"documentation repo not found: {documentation_path}")
    lineage_dir = workspace_root / "lineage" / repo
    lineage_dir.mkdir(parents=True, exist_ok=True)

    result = ingest_docs(documentation_path, lineage_dir, dry_run=dry_run)
    if not result.ok:
        click.echo(f"docs-ingest failed: {result.error}", err=True)
        sys.exit(1)
    click.echo(result.summary)
    if result.missing:
        click.echo(f"  WARNING — {len(result.missing)} SUMMARY page(s) missing on disk: "
                   f"{', '.join(result.missing[:5])}{'…' if len(result.missing) > 5 else ''}")
    if result.orphan:
        click.echo(f"  note — {len(result.orphan)} page(s) on disk not in SUMMARY: "
                   f"{', '.join(result.orphan[:5])}{'…' if len(result.orphan) > 5 else ''}")
    if dry_run:
        click.echo("--- dry-run: artifacts NOT written ---")


@main.command("adrs-ingest")
@click.argument("repo")
@click.option("--dry-run", is_flag=True, help="Emit summary without writing artifacts.")
@click.option(
    "--workspace",
    type=click.Path(file_okay=False, path_type=Path),
    default=None,
    help="Workspace root (default: parent of lineage/).",
)
def adrs_ingest_cmd(repo: str, dry_run: bool, workspace: Path | None) -> None:
    """Ingest the published Architecture Decision Records into REPO's lineage as ADR nodes.

    Walks `../documentation/docs/developer-guides/architecture-decision-log/ADR-*.md`
    (the published, human-ratified decisions — the positive-space counterpart to
    the derived ImplicitADR candidates), joins each `adr_id` to its workspace
    sidecar `backlog/adr/{adr_id}.md` for the ontology links (promoted_from /
    realises / superseded_by), and writes `lineage/{repo}/adr-nodes.jsonl`.
    Mechanical, no LLM, no network. See adrs/drafts/ground-truth-lineage.md (Phase 2).

    Prints the ADR count and any unresolved joins (a published page with no
    workspace sidecar, a sidecar with no published page).
    """
    from lineage_extractor.extractors.adrs import ingest_adrs
    from lineage_extractor.extractors.docs import DOC_REPO

    workspace_root = workspace or _default_workspace_root()
    documentation_path = resolve_repo_path(workspace_root, DOC_REPO)
    if not documentation_path.is_dir():
        raise click.ClickException(f"documentation repo not found: {documentation_path}")
    lineage_dir = workspace_root / "lineage" / repo
    lineage_dir.mkdir(parents=True, exist_ok=True)

    result = ingest_adrs(documentation_path, lineage_dir, workspace_root, dry_run=dry_run)
    if not result.ok:
        click.echo(f"adrs-ingest failed: {result.error}", err=True)
        sys.exit(1)
    click.echo(result.summary)
    if result.unresolved:
        click.echo(f"  WARNING — {len(result.unresolved)} unresolved join(s):")
        for line in result.unresolved:
            click.echo(f"    - {line}")
    if dry_run:
        click.echo("--- dry-run: artifacts NOT written ---")


@main.command("tests-ingest")
@click.argument("repo")
@click.option("--dry-run", is_flag=True, help="Emit summary without writing artifacts.")
@click.option(
    "--workspace",
    type=click.Path(file_okay=False, path_type=Path),
    default=None,
    help="Workspace root (default: parent of lineage/).",
)
def tests_ingest_cmd(repo: str, dry_run: bool, workspace: Path | None) -> None:
    """Ingest REPO's existing test suite as ground-truth Test nodes (Phase 4).

    Walks the repo's test files (Java `src/test/**/*.java`, TS `*.spec.ts`/
    `*.test.ts`), emits one Test node per class/spec with a mechanically-inferred
    COVERS descriptor + any declared `@enforces`/`@validates`/`@regresses`/
    `@covers` gates, and writes `lineage/{repo}/test-nodes.jsonl`. The projector
    wires COVERS/ENFORCES/VALIDATES/REGRESSES edges. Mechanical, no LLM, no
    network. See adrs/drafts/ground-truth-lineage.md (Phase 4) and the Test-
    Traceability Ledger in `/align`.
    """
    from lineage_extractor.extractors.tests import ingest_tests

    workspace_root = workspace or _default_workspace_root()
    repo_path = resolve_repo_path(workspace_root, repo)
    if not repo_path.is_dir():
        raise click.ClickException(f"repo path not found: {repo_path}")
    lineage_dir = workspace_root / "lineage" / repo
    lineage_dir.mkdir(parents=True, exist_ok=True)

    result = ingest_tests(repo_path, lineage_dir, repo, dry_run=dry_run)
    if not result.ok:
        click.echo(f"tests-ingest failed: {result.error}", err=True)
        sys.exit(1)
    click.echo(result.summary)
    if dry_run:
        click.echo("--- dry-run: artifacts NOT written ---")


@main.command("docs-verify")
@click.argument("repo")
@click.option("--json", "as_json", is_flag=True, help="Emit JSON for machine consumers.")
@click.option(
    "--workspace",
    type=click.Path(file_okay=False, path_type=Path),
    default=None,
    help="Workspace root (default: parent of lineage/).",
)
def docs_verify_cmd(repo: str, as_json: bool, workspace: Path | None) -> None:
    """Consistency dashboard for REPO's documentation lineage (mechanical, cheap).

    Reports the three drift/consistency axes from `adrs/drafts/ground-truth-lineage.md`:
    completeness (SUMMARY denominator), content drift (committed hash vs live
    upstream prose), and agentic-enrichment coverage (pages with a DESCRIBES
    sidecar + their live-URL verification status). No network, no LLM — the
    drift check is the loader recomputing each section's hash against upstream.
    """
    import json as _json

    from lineage_extractor.graph_query.loaders import load_substrate

    lineage_dir = _resolve_lineage_dir(repo, workspace)
    sub = load_substrate(lineage_dir)
    if not sub.doc_nodes:
        raise click.ClickException(
            f"no doc-nodes.jsonl in {lineage_dir} — run `docs-ingest {repo}` first"
        )

    pages = {dn.repo_rel_path for dn in sub.doc_nodes}
    drifted = [dn.node_id for dn in sub.doc_nodes if dn.drifted]
    bodyless = sum(1 for dn in sub.doc_nodes if not dn.body.strip())
    enriched_pages = {du.doc_page for du in sub.doc_understanding}
    unenriched = sorted(pages - enriched_pages)
    live_status: dict[str, int] = {}
    for du in sub.doc_understanding:
        s = du.live_url_verified_status or "unverified"
        live_status[s] = live_status.get(s, 0) + 1

    manifest_path = lineage_dir / "documentation" / "_manifest.yaml"
    completeness: dict = {}
    if manifest_path.is_file():
        from ruamel.yaml import YAML

        data = YAML(typ="safe").load(manifest_path.read_text()) or {}
        completeness = data.get("completeness", {})

    report = {
        "repo": repo,
        "doc_sections": len(sub.doc_nodes),
        "doc_pages": len(pages),
        "completeness": completeness,
        "drift": {"drifted_sections": len(drifted), "examples": drifted[:5]},
        "embeddable_sections": len(sub.doc_nodes) - bodyless,
        "enrichment": {
            "pages_enriched": len(enriched_pages & pages),
            "pages_unenriched": len(unenriched),
            "unenriched_examples": unenriched[:5],
            "live_url_status": live_status,
        },
    }
    if as_json:
        click.echo(_json.dumps(report, indent=2, default=str))
        return
    click.echo(f"doc-lineage consistency — {repo}")
    click.echo(f"  sections: {report['doc_sections']} ({report['embeddable_sections']} embeddable)"
               f"  pages: {report['doc_pages']}")
    comp_ok = completeness.get("complete")
    click.echo(f"  completeness: {'OK' if comp_ok else 'INCOMPLETE'}"
               f"  missing={len(completeness.get('missing', []))}"
               f"  orphan={len(completeness.get('orphan', []))}")
    click.echo(f"  content drift: {len(drifted)} section(s) differ from upstream"
               + (f" (e.g. {drifted[0]})" if drifted else ""))
    click.echo(f"  enrichment (DESCRIBES): {report['enrichment']['pages_enriched']}/{report['doc_pages']}"
               f" pages; {report['enrichment']['pages_unenriched']} await doc-analyser")
    if live_status:
        click.echo(f"  live-url status: {live_status}")


@main.command("validate-sidecar")
@click.argument("paths", nargs=-1, type=click.Path(exists=True, dir_okay=False, path_type=Path))
@click.option(
    "--strict",
    is_flag=True,
    help="Treat warnings as errors (exit non-zero on any warning).",
)
def validate_sidecar_cmd(paths: tuple[Path, ...], strict: bool) -> None:
    """Validate one or more per-node enrichment sidecars against the schema.

    Used by the /enrich skill (DOC-164 slice 5+) after each file-analyser
    invocation. Pure parser — no LLM calls. Catches missing required fields,
    missing required sections, doc-link entries without WebFetch verification,
    and (as warnings) banned phrases per CLAUDE.md Gate 9.
    """
    if not paths:
        raise click.UsageError("provide at least one sidecar path")

    failed = 0
    warned = 0
    for path in paths:
        result = validate_sidecar(path)
        click.echo(format_result(result))
        if not result.ok:
            failed += 1
        if result.warnings:
            warned += 1
    click.echo("")
    click.echo(f"summary: {len(paths) - failed} ok, {failed} failed, {warned} with warnings")
    if failed or (strict and warned):
        sys.exit(1)


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


# --------------------------------------------------------------------------
# Derived graph query layer (adrs/drafts/graph-query-layer.md)


@main.command("graph-build")
@click.argument("repo")
@click.option("--no-embeddings", is_flag=True, help="Graph-only build — skip the vector index.")
@click.option(
    "--workspace",
    type=click.Path(file_okay=False, path_type=Path),
    default=None,
    help="Workspace root (default: parent of lineage/).",
)
def graph_build_cmd(repo: str, no_embeddings: bool, workspace: Path | None) -> None:
    """Build (or refresh) the ephemeral graph query layer for REPO and report stats.

    The graph + vector index are written under lineage/{repo}/graph/ — git-ignored,
    deterministically rebuilt from the canonical files, never committed.
    """
    from lineage_extractor.graph_query import GraphQuery

    lineage_dir = _resolve_lineage_dir(repo, workspace)
    gq = GraphQuery.build(lineage_dir, embeddings=not no_embeddings)
    _write_build_info(lineage_dir, gq)
    s = gq.stats()
    click.echo(f"graph query layer built for {s['repo']}")
    click.echo(f"  nodes={s['nodes']}  edges={s['edges']}  stub_nodes={s['stub_nodes']}")
    click.echo(f"  labels: {s['labels']}")
    click.echo(f"  edge_types: {s['edge_types']}")
    click.echo(f"  embeddings_available={s['embeddings_available']}  "
               f"vectors={s['vector_count']}  model={s['embedding_model']}")
    if s["skipped_files"]:
        click.echo(f"  skipped_files={s['skipped_files']} (see graph/build-info.yaml)")


@main.command("alignment")
@click.argument("repo")
@click.option(
    "--workspace",
    type=click.Path(file_okay=False, path_type=Path),
    default=None,
    help="Workspace root (default: parent of lineage/).",
)
@click.option("--json", "as_json", is_flag=True, help="Print the written machine payload (YAML) to stdout.")
def alignment_cmd(repo: str, workspace: Path | None, as_json: bool) -> None:
    """Compute the cross-corpus ALIGNMENT scorecard for REPO.

    A deterministic roll-up (no LLM) over the derived ontology + ground-truth
    anchors: scores CODE <-> DOC <-> ADR <-> TEST alignment bi-directionally and
    surfaces the Test-Traceability Ledger (no orphan tests; every test gates an
    ontology relationship). Writes lineage/{repo}/alignment-scorecard.{md,yaml}
    (the .yaml appends a trend row each run). The deep agentic audit is `--deep`
    (phase 2). See lineage/_extractor/.../alignment.py.
    """
    from lineage_extractor import alignment as al

    workspace_root = workspace or _default_workspace_root()
    repo_path = resolve_repo_path(workspace_root, repo)
    lineage_dir = _resolve_lineage_dir(repo, workspace)
    if not lineage_dir.is_dir():
        raise click.ClickException(f"Lineage dir not found: {lineage_dir}")
    sc = al.compute(lineage_dir, workspace_root, repo, repo_path)
    md_path, yaml_path = al.write_scorecard(lineage_dir, sc)
    if as_json:
        click.echo(yaml_path.read_text())
        return
    icon = {"NOT-READY": "⛔", "PILOT-READY": "🟡", "READY": "✅"}.get(sc.readiness, "❔")
    click.echo(f"alignment scorecard — {sc.repo}")
    click.echo(f"  readiness: {icon} {sc.readiness}")
    for blk in sc.blockers:
        click.echo(f"    blocker: {blk}")
    for dim in sc.dimensions:
        click.echo(f"  [{dim.key}] {dim.grade:5}  {dim.title}")
    click.echo(f"  ready-now: {', '.join(sc.ready_now) or '(none)'}")
    click.echo(f"  top action: {sc.actions[0] if sc.actions else '(none)'}")
    click.echo(f"  written: {md_path.name} + {yaml_path.name}")


@main.command("query")
@click.argument("repo")
@click.argument("text")
@click.option("--k", default=8, type=int, help="Vector top-k seed count.")
@click.option("--hops", default=2, type=int, help="Bounded traversal radius.")
@click.option("--label", "labels", multiple=True, help="Restrict results to these node labels.")
@click.option("--edge", "edges", multiple=True, help="Restrict traversal to these edge types.")
@click.option("--limit", default=20, type=int, help="Max results.")
@click.option("--json", "as_json", is_flag=True, help="Emit JSON for machine consumers.")
@click.option("--no-embeddings", is_flag=True, help="Graph-only (keyword-seeded) query.")
@click.option(
    "--workspace",
    type=click.Path(file_okay=False, path_type=Path),
    default=None,
)
def query_cmd(
    repo: str, text: str, k: int, hops: int, labels: tuple[str, ...],
    edges: tuple[str, ...], limit: int, as_json: bool, no_embeddings: bool,
    workspace: Path | None,
) -> None:
    """Hybrid query over REPO's ontology — vector entry points + graph traversal.

    Returns a bounded, ranked, fully-cited result slice. Example:

        lineage-extractor query odd-platform "per-alert authorization gap"
    """
    from lineage_extractor.graph_query import GraphQuery

    lineage_dir = _resolve_lineage_dir(repo, workspace)
    gq = GraphQuery.build(lineage_dir, embeddings=not no_embeddings)
    results = gq.query(
        text, k=k, hops=hops, limit=limit,
        edge_filter={e.upper() for e in edges} or None,
        label_filter=set(labels) or None,
    )
    _print_results(results, as_json)


@main.command("provenance")
@click.argument("repo")
@click.argument("path_fragment")
@click.option("--hops", default=1, type=int, help="Neighbourhood radius around direct matches.")
@click.option("--limit", default=50, type=int)
@click.option("--json", "as_json", is_flag=True)
@click.option(
    "--workspace",
    type=click.Path(file_okay=False, path_type=Path),
    default=None,
)
def provenance_cmd(
    repo: str, path_fragment: str, hops: int, limit: int, as_json: bool,
    workspace: Path | None,
) -> None:
    """Impact-of-a-file: every ontology artefact whose claims rest on PATH_FRAGMENT.

    PATH_FRAGMENT matches both a code path and a lineage source file. Example:

        lineage-extractor provenance odd-platform AlertServiceImpl.java
    """
    from lineage_extractor.graph_query import GraphQuery

    lineage_dir = _resolve_lineage_dir(repo, workspace)
    gq = GraphQuery.build(lineage_dir, embeddings=False)  # shape C is graph-only
    _print_results(gq.provenance(path_fragment, hops=hops, limit=limit), as_json)


@main.command("query-probe")
@click.argument("repo")
@click.option("--gold", type=click.Path(path_type=Path), default=None,
              help="Gold-set path (default: lineage/{repo}/query-gold-set.yaml).")
@click.option("--json", "as_json", is_flag=True)
@click.option(
    "--workspace",
    type=click.Path(file_okay=False, path_type=Path),
    default=None,
)
def query_probe_cmd(repo: str, gold: Path | None, as_json: bool, workspace: Path | None) -> None:
    """Score the graph query layer against REPO's maintainer-authored gold set.

    Implements PROBES family 1 (retrieval quality) + the family-2 payload-ceiling
    check. Exits non-zero only when an authored gold set fails the gate.
    """
    from lineage_extractor.graph_query import probe

    lineage_dir = _resolve_lineage_dir(repo, workspace)
    report = probe.run(lineage_dir, gold)
    if as_json:
        import json

        click.echo(json.dumps(report.__dict__, indent=2, default=str))
    else:
        click.echo(f"probe status: {report.status}")
        for intent, row in report.per_class.items():
            mark = "PASS" if row["pass"] else "FAIL"
            click.echo(f"  [{mark}] {intent:18s} mean={row['mean']:.4f} "
                       f"floor={row['floor']} n={row['query_count']}")
        if report.status == "scored":
            click.echo(f"  payload-ceiling breaches: {report.payload_ceiling_breaches}")
            click.echo(f"  overall: {'PASS' if report.overall_pass else 'FAIL'}")
        for note in report.notes:
            click.echo(f"  note: {note}")
    if report.status == "scored" and not report.overall_pass:
        sys.exit(1)


# --------------------------------------------------------------------------
# Agentic-retriever primitives (adrs/drafts/agentic-graph-retriever.md).
# Small, composable, deterministic tools the graph-retriever subagent calls.


@main.command("graph-search")
@click.argument("repo")
@click.argument("text")
@click.option("--k", default=12, type=int, help="Number of entry-point nodes.")
@click.option("--label", "labels", multiple=True,
              help="Restrict results to these node labels (e.g. RefactoringScope). Repeatable.")
@click.option("--json", "as_json", is_flag=True)
@click.option("--workspace", type=click.Path(file_okay=False, path_type=Path), default=None)
def graph_search_cmd(
    repo: str, text: str, k: int, labels: tuple[str, ...], as_json: bool,
    workspace: Path | None,
) -> None:
    """Pure semantic search — vector top-k entry-point nodes, NO graph expansion.

    The retriever agent's entry-point primitive, and the reducers' semantic-dedup
    primitive (`--label` scopes the query to one artefact's nodes). Use `query`
    for the one-shot hybrid (search + traversal + fusion) instead.
    """
    from lineage_extractor.graph_query import GraphQuery

    gq = GraphQuery.build(_resolve_lineage_dir(repo, workspace))
    _print_results(gq.search(text, k=k, label_filter=set(labels) or None), as_json)


@main.command("graph-node")
@click.argument("repo")
@click.argument("node_id")
@click.option("--json", "as_json", is_flag=True)
@click.option("--workspace", type=click.Path(file_okay=False, path_type=Path), default=None)
def graph_node_cmd(repo: str, node_id: str, as_json: bool, workspace: Path | None) -> None:
    """The full content of one node — labels, props, provenance, every section's
    text, and the sections of any finding it surfaces. The retriever reads this
    to judge a candidate's relevance.
    """
    from lineage_extractor.graph_query import GraphQuery

    gq = GraphQuery.build(_resolve_lineage_dir(repo, workspace), embeddings=False)
    detail = gq.node(node_id)
    if detail is None:
        raise click.ClickException(f"node not found: {node_id}")
    if as_json:
        import json

        click.echo(json.dumps(detail, indent=2, default=str))
        return
    click.echo(f"{detail['node_id']}  {detail['labels']}")
    click.echo(f"  cite: {detail['source_file']}:{detail['source_line']}")
    click.echo(f"  props: {detail['props']}")
    click.echo(f"  neighbours: {detail['neighbour_count']}")
    for sec in detail["sections"]:
        click.echo(f"  --- {sec['section']} ---")
        click.echo(f"  {sec['text'][:600]}")


@main.command("graph-neighbours")
@click.argument("repo")
@click.argument("node_id")
@click.option("--json", "as_json", is_flag=True)
@click.option("--workspace", type=click.Path(file_okay=False, path_type=Path), default=None)
def graph_neighbours_cmd(repo: str, node_id: str, as_json: bool, workspace: Path | None) -> None:
    """A node's adjacency — one row per edge: direction, edge type, neighbour
    id / label / title. Lets the retriever decide which edges to walk.
    """
    from lineage_extractor.graph_query import GraphQuery

    gq = GraphQuery.build(_resolve_lineage_dir(repo, workspace), embeddings=False)
    rows = gq.neighbours(node_id)
    if as_json:
        import json

        click.echo(json.dumps(rows, indent=2, default=str))
        return
    if not rows:
        click.echo("  (no neighbours / node not found)")
        return
    for r in rows:
        arrow = "->" if r["direction"] == "out" else "<-"
        click.echo(f"  {arrow} {r['edge_type']:18s} [{r['label']}] {r['node_id'][:64]}")
    click.echo(f"\n  {len(rows)} edge(s)")


@main.command("graph-traverse")
@click.argument("repo")
@click.argument("node_id")
@click.option("--depth", default=2, type=int, help="Traversal depth (agent-chosen).")
@click.option("--edge", "edges", multiple=True, help="Restrict to these edge types.")
@click.option("--limit", default=80, type=int)
@click.option("--json", "as_json", is_flag=True)
@click.option("--workspace", type=click.Path(file_okay=False, path_type=Path), default=None)
def graph_traverse_cmd(
    repo: str, node_id: str, depth: int, edges: tuple[str, ...], limit: int,
    as_json: bool, workspace: Path | None,
) -> None:
    """A bounded subgraph around NODE_ID — the retriever picks the depth and the
    edge filter when it judges the answer sits in a node's neighbourhood.
    """
    from lineage_extractor.graph_query import GraphQuery

    gq = GraphQuery.build(_resolve_lineage_dir(repo, workspace), embeddings=False)
    results = gq.subgraph(
        node_id, depth=depth, limit=limit,
        edge_filter={e.upper() for e in edges} or None,
    )
    _print_results(results, as_json)


def _resolve_lineage_dir(repo: str, workspace: Path | None) -> Path:
    workspace_root = workspace or _default_workspace_root()
    lineage_dir = workspace_root / "lineage" / repo
    if not lineage_dir.is_dir():
        raise click.ClickException(f"lineage dir not found: {lineage_dir}")
    return lineage_dir


def _print_results(results: list, as_json: bool) -> None:
    if as_json:
        import json

        click.echo(json.dumps([r.as_dict() for r in results], indent=2))
        return
    if not results:
        click.echo("  (no results)")
        return
    for r in results:
        click.echo(f"  {r.score:8.5f}  h{r.hop}  [{r.label}]  {r.title[:72]}")
        click.echo(f"            {r.cite()}  · {r.via}")
    click.echo(f"\n  {len(results)} result(s)")


def _write_build_info(lineage_dir: Path, gq: object) -> None:
    """Write the ephemeral graph/build-info.yaml observability file."""
    from lineage_extractor.graph_query import config as gq_config

    s = gq.stats()  # type: ignore[attr-defined]
    info_path = gq_config.graph_dir(lineage_dir) / gq_config.BUILD_INFO_FILENAME
    info_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "builder_version": gq_config.BUILDER_VERSION,
        "built_at": today_iso(),
        **{k: v for k, v in s.items() if k != "embedding_stats"},
        "embedding_stats": s["embedding_stats"],
    }
    from ruamel.yaml import YAML

    yaml = YAML()
    yaml.indent(mapping=2, sequence=4, offset=2)
    with info_path.open("w") as fh:
        fh.write(gq_config.GENERATED_HEADER.format(repo=lineage_dir.name))
        yaml.dump(payload, fh)


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
