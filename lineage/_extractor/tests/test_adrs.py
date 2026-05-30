"""Tests for the ADR-axis ingester + projector (ground-truth-lineage Phase 2).

Pure mechanical extractor → deterministic, no network, no LLM. The tests pin the
contract the loader + projector depend on: the published-page ↔ workspace-sidecar
join, idempotent output, the reference-upstream rule (page prose is NOT copied),
the code/external `realises` split (with forgiving node_id resolution), and the
three ground-truth edges (PROMOTED_TO / REALISES / SUPERSEDED_BY).
"""
from __future__ import annotations

import json
from pathlib import Path

from lineage_extractor.extractors.adrs import ingest_adrs
from lineage_extractor.graph_query import config
from lineage_extractor.graph_query.loaders import load_substrate
from lineage_extractor.graph_query.projector import (
    _adr_key,
    _code_key,
    _reducer_key,
    project,
)

# The real substrate node_id for the AlertController class (kind `controller`,
# package as the 3rd segment) — what the forgiving resolver must reach.
SUBSTRATE_CODE_ID = (
    "odd-platform java org.opendatadiscovery.oddplatform.controller "
    "controller:AlertController"
)
# The hand-authored `realises` ref the backlog item carries — a near-miss
# (kind `controller-class`, package guessed as the class name). The resolver
# must still bind it to SUBSTRATE_CODE_ID by the (repo, lang, descriptor) identity.
REALISES_CODE_REF = "odd-platform java AlertController controller-class:AlertController"
EXTERNAL_REF = "odd-platform-specification: openapi.yaml (HTTP contract source)"


def _write(p: Path, text: str) -> None:
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding="utf-8")


def _make_docs_repo(tmp_path: Path) -> Path:
    """A minimal documentation repo: SUMMARY.md + one published ADR page +
    a README in the ADR log (which the ingester must skip)."""
    repo = tmp_path / "documentation"
    docs = repo / "docs"
    _write(docs / "SUMMARY.md", "\n".join([
        "# Table of contents",
        "",
        "## Developer Guides",
        "* [architecture-decision-log](developer-guides/architecture-decision-log/README.md)",
        "",
    ]))
    adr_log = docs / "developer-guides" / "architecture-decision-log"
    _write(adr_log / "README.md", "# Architectural Decision Log\n\nIndex page — skipped.\n")
    _write(adr_log / "ADR-0001-contract-first.md", "\n".join([
        "---",
        "adr_id: ADR-0001",
        "title: Contract-first HTTP layer",
        "status: accepted",
        'date: "2026-05-30"',
        "description: The controllers implement OpenAPI-generated interfaces.",
        "---",
        "",
        "# ADR-0001: Contract-first HTTP layer",
        "",
        "## Decision",
        "",
        "Adopt contract-first: the OpenAPI YAML is the source of truth.",
        "",
    ]))
    return repo


def _make_workspace(tmp_path: Path) -> Path:
    """A minimal workspace: backlog/adr/ADR-0001.md (the join) + a lineage tree
    carrying the AlertController CodeNode and the ADR-CANDIDATE-001 ImplicitADR
    that PROMOTED_TO points back from."""
    ws = tmp_path / "ws"
    _write(ws / "backlog" / "adr" / "ADR-0001.md", "\n".join([
        "---",
        "adr_id: ADR-0001",
        "promoted_from: ADR-CANDIDATE-001",
        "realises:",
        f'  - "{REALISES_CODE_REF}"',
        f'  - "{EXTERNAL_REF}"',
        "superseded_by: null",
        "status: published",
        "title: Contract-first HTTP layer",
        'date: "2026-05-30"',
        "---",
        "",
        "# workspace lineage record",
        "",
    ]))
    lineage = ws / "lineage" / "odd-platform"
    _write(lineage / "nodes.jsonl", json.dumps({
        "id": SUBSTRATE_CODE_ID, "axis": "controllers", "kind": "controller",
        "repo": "odd-platform", "lang": "java",
        "package": "org.opendatadiscovery.oddplatform.controller",
        "descriptor": "AlertController",
        "path": "odd-platform-api/.../AlertController.java", "metadata": {},
    }))
    _write(lineage / "edges.jsonl", "")
    # The implicit-ADR candidate the published ADR was promoted from.
    _write(lineage / "implicit-adrs" / "detail" / "ADR-CANDIDATE-001.md", "\n".join([
        "## ADR-CANDIDATE-001 — Contract-first HTTP layer",
        "",
        "The candidate detail body.",
        "",
    ]))
    return ws


def _ingest(tmp_path: Path) -> tuple[Path, Path]:
    """Run ingest_adrs into the workspace's lineage dir; return (ws, lineage_dir)."""
    docs_repo = _make_docs_repo(tmp_path)
    ws = _make_workspace(tmp_path)
    lineage_dir = ws / "lineage" / "odd-platform"
    result = ingest_adrs(docs_repo, lineage_dir, ws, dry_run=False)
    assert result.ok, result.error
    assert result.adr_count == 1
    assert result.unresolved == [], result.unresolved
    return ws, lineage_dir


def test_ingest_is_idempotent_and_references_upstream(tmp_path: Path) -> None:
    ws, lineage_dir = _ingest(tmp_path)
    nodes_path = lineage_dir / "adr-nodes.jsonl"
    first = nodes_path.read_text(encoding="utf-8")

    # Re-ingest must be byte-identical (determinism).
    docs_repo = ws.parent / "documentation"
    ingest_adrs(docs_repo, lineage_dir, ws, dry_run=False)
    assert nodes_path.read_text(encoding="utf-8") == first

    row = json.loads(first.strip())
    assert row["adr_id"] == "ADR-0001"
    assert row["promoted_from"] == "ADR-CANDIDATE-001"
    assert row["superseded_by"] == ""          # YAML null coerced to ""
    assert REALISES_CODE_REF in row["realises"]
    assert any(r.startswith("odd-platform-specification") for r in row["realises"])
    # Reference-upstream: page prose is NOT copied; only addressing + hash.
    assert "body" not in row
    assert row["content_hash"].startswith("sha256:")
    assert row["repo_rel_path"].startswith("docs/developer-guides/architecture-decision-log/")
    assert row["live_url"].startswith("https://docs.opendatadiscovery.org/")


def test_join_completeness_flags_missing_sidecar(tmp_path: Path) -> None:
    """A published ADR page with no workspace sidecar is an unresolved join."""
    docs_repo = _make_docs_repo(tmp_path)
    ws = tmp_path / "ws-empty"          # no backlog/adr — no join
    lineage_dir = ws / "lineage" / "odd-platform"
    lineage_dir.mkdir(parents=True)
    result = ingest_adrs(docs_repo, lineage_dir, ws, dry_run=False)
    assert result.ok
    assert result.adr_count == 1
    assert len(result.unresolved) == 1
    assert "ADR-0001" in result.unresolved[0]


def test_projector_wires_adr_node_and_edges(tmp_path: Path) -> None:
    _ws, lineage_dir = _ingest(tmp_path)
    g = project(load_substrate(lineage_dir))

    # ADR node exists with the published attributes + the external realises ref.
    adr = g.get(_adr_key("ADR-0001"))
    assert adr is not None
    assert adr.label == config.L_ADR
    assert adr.props["status"] == "accepted"
    assert adr.props["realises_external"] == [EXTERNAL_REF]   # non-code ref, NOT an edge

    edges = g.edges_of(_adr_key("ADR-0001"))
    # PROMOTED_TO — ImplicitADR ADR-CANDIDATE-001 -> ADR-0001 (inbound on the ADR).
    assert ("in", config.E_PROMOTED_TO,
            _reducer_key(config.L_IMPLICIT_ADR, "ADR-CANDIDATE-001")) in edges
    # REALISES — AlertController CodeNode -> ADR-0001 (inbound), resolved by the
    # forgiving (repo, lang, descriptor) match despite the ref's near-miss kind.
    assert ("in", config.E_REALISES, _code_key(SUBSTRATE_CODE_ID)) in edges
    # The external openapi ref is NOT a REALISES edge.
    assert not any(e[1] == config.E_REALISES and "openapi" in e[2] for e in edges)
    # No SUPERSEDED_BY edge (superseded_by is null for ADR-0001).
    assert not any(e[1] == config.E_SUPERSEDED_BY for e in edges)


def test_superseded_by_edge_when_target_exists(tmp_path: Path) -> None:
    """SUPERSEDED_BY wires ADR -> ADR only when the target ADR node exists."""
    _ws, lineage_dir = _ingest(tmp_path)
    # Hand-add a second ADR row that supersedes ADR-0001, mirroring ingest output.
    extra = {
        "adr_id": "ADR-0002", "title": "Replacement", "status": "accepted",
        "date": "2026-05-31", "repo_rel_path": "docs/.../ADR-0002.md",
        "anchor": "adr-0002", "live_url": "https://docs.opendatadiscovery.org/x",
        "content_hash": "sha256:deadbeef", "promoted_from": "",
        "realises": [], "superseded_by": "ADR-0001",
    }
    nodes_path = lineage_dir / "adr-nodes.jsonl"
    nodes_path.write_text(
        nodes_path.read_text() + json.dumps(extra, sort_keys=True) + "\n", encoding="utf-8"
    )
    g = project(load_substrate(lineage_dir))
    edges = g.edges_of(_adr_key("ADR-0002"))
    assert ("out", config.E_SUPERSEDED_BY, _adr_key("ADR-0001")) in edges
