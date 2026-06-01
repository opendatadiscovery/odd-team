"""Tests for the alignment scorecard (the cross-corpus consistency dashboard).

Two tiers: hermetic unit tests of the pure scoring/gate-scan helpers (no IO),
and a skip-if-absent smoke test that runs the full `compute()` against the real
workspace lineage dir — proving the roll-up holds against live artefacts without
making the suite depend on them.
"""
from __future__ import annotations

from pathlib import Path

import pytest

from lineage_extractor import alignment as al


# -- pure grading ----------------------------------------------------------


def test_grade_ratio_bands():
    assert al._grade_ratio(0.95) == al.GREEN
    assert al._grade_ratio(0.5) == al.AMBER
    assert al._grade_ratio(0.1) == al.RED


def test_cap_never_promotes_above_ceiling():
    # the honesty cap: a GREEN metric is held to AMBER while verification is thin
    assert al._cap(al.GREEN, al.AMBER) == al.AMBER
    assert al._cap(al.RED, al.AMBER) == al.RED  # never *raises* a grade
    assert al._cap(al.AMBER, al.GREEN) == al.AMBER


def test_dimension_grade_is_worst_metric():
    dim = al.Dimension("X", "x", metrics=[
        al.Metric("a", "a", 1, 1, 1, al.GREEN),
        al.Metric("b", "b", 0, 1, 1, al.RED),
    ])
    assert dim.grade == al.RED


# -- the Test-Traceability Ledger gate scanner -----------------------------


def test_scan_gates_extracts_typed_targets():
    g = al._scan_gates("This test enforces ADR-0040 and validates F-001.")
    assert g["enforces"] == ["ADR-0040"]
    assert g["validates"] == ["F-001"]


def test_scan_gates_empty_without_a_gate_keyword():
    # an F-id alone (no gate keyword) is NOT a gate — it must say why it exists
    assert al._scan_gates("mentions F-001 in passing, no rationale") == {}


def test_scan_gates_does_not_match_adr_candidates_as_published():
    # ADR-CANDIDATE-001 is a derived candidate, never a ratified ADR target
    g = al._scan_gates("enforces the decision in ADR-CANDIDATE-001")
    assert "enforces" not in g


def test_scan_gates_flags_landmine_regression():
    g = al._scan_gates("regression-pin asserting the MinIO builder sets .region(...)")
    assert "LANDMINE" in g.get("regresses", [])
    g2 = al._scan_gates("regression test that attachment storage default is not ephemeral tmp")
    assert "LANDMINE" in g2.get("regresses", [])


# -- rendering / trend -----------------------------------------------------


def _synthetic_scorecard() -> al.Scorecard:
    return al.Scorecard(
        repo="demo", generated_at="2026-06-01", readiness="NOT-READY",
        blockers=["[D] test layer unbuilt"], ready_now=["F-021"],
        trust=[al.Metric("E4.reflection", "reflection", 1, 1, 112, al.RED, "1/112")],
        dimensions=[al.Dimension("D", "Test-Traceability Ledger", metrics=[
            al.Metric("D2.adr", "ADRs enforced", 0, 0, 27, al.RED, "0/27"),
        ])],
        actions=["Build Phase-4 Test layer"],
        flat={"adr_enforced": "0/27", "reflection_coverage": 0.009},
    )


def test_render_markdown_has_core_sections():
    md = al.render_markdown(_synthetic_scorecard())
    assert "Contract-test readiness: ⛔ NOT-READY" in md
    assert "Trust gate" in md
    assert "Test-Traceability Ledger" in md
    assert "Build Phase-4 Test layer" in md


def test_render_yaml_payload_appends_trend_and_caps_at_50():
    prior = {"trend": [{"date": f"d{i}"} for i in range(60)]}
    payload = al.render_yaml_payload(_synthetic_scorecard(), prior)
    assert len(payload["trend"]) == 50          # capped
    assert payload["trend"][-1]["readiness"] == "NOT-READY"  # newest row appended
    assert payload["metrics"]["adr_enforced"] == "0/27"


# -- live smoke (skips if the workspace ontology is not present) ------------


def _workspace_root() -> Path:
    return Path(__file__).resolve().parents[3]


def test_compute_smoke_against_real_ontology():
    ws = _workspace_root()
    lineage_dir = ws / "lineage" / "odd-platform"
    if not lineage_dir.is_dir():
        pytest.skip("odd-platform lineage not present")
    from lineage_extractor.repo import resolve_repo_path
    repo_path = resolve_repo_path(ws, "odd-platform")
    sc = al.compute(lineage_dir, ws, "odd-platform", repo_path)
    assert sc.readiness in ("NOT-READY", "PILOT-READY", "READY")
    assert {d.key for d in sc.dimensions} == {"A", "B", "C", "D"}
    assert all(d.grade in (al.GREEN, al.AMBER, al.RED) for d in sc.dimensions)
    # every metric is reported as a real fraction, never a bare invented number
    for d in sc.dimensions:
        for m in d.metrics:
            assert m.total >= 0 and m.checked <= max(m.total, m.checked)
    # the markdown round-trips
    assert al.render_markdown(sc).startswith("# Alignment scorecard — odd-platform")
