"""Tests for the test axis — the ground-truth Phase-4 Test ingester + projection.

Hermetic: the extractor test writes synthetic test files under tmp_path; the
projection test builds a synthetic Substrate directly. No network, no git, no
embedding model.
"""
from __future__ import annotations

import json

from lineage_extractor.extractors.tests import _covers_descriptor, ingest_tests
from lineage_extractor.graph_query import config
from lineage_extractor.graph_query.projector import project
from lineage_extractor.graph_query.records import (
    ADRNodeRecord,
    CodeNodeRecord,
    ReducerNodeRecord,
    Substrate,
    TestNodeRecord,
)


# -- mechanical extraction -------------------------------------------------


def test_covers_descriptor_strips_test_suffix():
    assert _covers_descriptor("AlertControllerTest") == "AlertController"
    assert _covers_descriptor("OwnershipServiceImplTest") == "OwnershipServiceImpl"
    assert _covers_descriptor("FooIT") == "Foo"


def test_ingest_parses_gates_test_class_and_covers(tmp_path):
    test_dir = tmp_path / "repo" / "src" / "test" / "java" / "org" / "x"
    test_dir.mkdir(parents=True)
    (test_dir / "FooServiceTest.java").write_text(
        "package org.x;\n"
        "/** @enforces ADR-0040  @validates F-001  @regresses REFACTOR-034 */\n"
        "import org.junit.jupiter.api.Test;\n"
        "class FooServiceTest {\n"
        "  @Test void a() {}\n"
        "  @Test void b() {}\n"
        "}\n"
    )
    (test_dir / "BarIT.java").write_text(
        "package org.x;\n@SpringBootTest\nclass BarIT { @Test void x() {} }\n"
    )
    lineage = tmp_path / "lineage"
    lineage.mkdir()
    res = ingest_tests(tmp_path / "repo", lineage, "demo", dry_run=False)
    assert res.ok and res.test_count == 2

    nodes = {
        json.loads(r)["class_name"]: json.loads(r)
        for r in (lineage / "test-nodes.jsonl").read_text().splitlines()
    }
    foo = nodes["FooServiceTest"]
    assert foo["covers"] == "FooService"
    assert foo["enforces"] == ["ADR-0040"]
    assert foo["validates"] == ["F-001"]
    assert foo["regresses"] == ["REFACTOR-034"]
    assert foo["method_count"] == 2
    assert foo["test_class"] == "unit"
    assert nodes["BarIT"]["test_class"] == "integration"   # @SpringBootTest marker
    assert res.gated_count == 1                            # only FooServiceTest is gated


def test_dry_run_writes_nothing(tmp_path):
    test_dir = tmp_path / "repo" / "src" / "test" / "java"
    test_dir.mkdir(parents=True)
    (test_dir / "AThingTest.java").write_text("class AThingTest { @Test void t() {} }\n")
    lineage = tmp_path / "lineage"
    lineage.mkdir()
    res = ingest_tests(tmp_path / "repo", lineage, "demo", dry_run=True)
    assert res.ok and res.test_count == 1
    assert not (lineage / "test-nodes.jsonl").exists()


# -- projection: COVERS / ENFORCES / VALIDATES edges -----------------------


def test_projection_wires_test_edges():
    code = CodeNodeRecord(
        node_id="demo java pkg controller:FooService", axis="controllers",
        kind="controller", repo="demo", lang="java", package="pkg",
        descriptor="FooService", path="x.java", metadata={},
        source_file="nodes.jsonl", source_line=1,
    )
    adr = ADRNodeRecord(
        adr_id="ADR-0040", title="t", status="accepted", date="", repo_rel_path="",
        anchor="", live_url="", content_hash="", promoted_from="", realises=[],
        superseded_by="", source_file="adr-nodes.jsonl", source_line=1,
    )
    feat = ReducerNodeRecord(label=config.L_FEATURE, entry_id="F-001", title="f", body="",
                             source_file="feature-flows/detail/F-001.yaml", source_line=1)
    test = TestNodeRecord(
        test_id="t.java::FooServiceTest", repo="demo", lang="java", framework="junit",
        test_class="unit", path="t.java", class_name="FooServiceTest",
        covers="FooService", method_count=1,
        enforces=["ADR-0040"], validates=["F-001"], regresses=[], covers_refs=[],
    )
    g = project(Substrate(
        repo="demo", code_nodes=[code], adr_nodes=[adr],
        reducer_nodes=[feat], test_nodes=[test],
    ))
    assert g.label_counts().get(config.L_TEST) == 1
    et = g.edge_type_counts()
    assert et.get(config.E_COVERS) == 1      # FooService descriptor resolved uniquely
    assert et.get(config.E_ENFORCES) == 1    # → ADR-0040
    assert et.get(config.E_VALIDATES) == 1   # → F-001


def test_merge_gate_map_unions_retrofit_gates(tmp_path):
    from lineage_extractor.extractors.tests import TestNode, _merge_gate_map
    n = TestNode(test_id="t.java::FooTest", repo="demo", lang="java", framework="junit",
                 test_class="unit", path="t.java", class_name="FooTest", covers="Foo", method_count=2)
    (tmp_path / "test-gates.yaml").write_text(
        'gates:\n'
        '  "t.java::FooTest":\n'
        '    validates: [F-001]\n'
        '    enforces: [ADR-0040]\n'
    )
    moved = _merge_gate_map(tmp_path, [n])
    assert moved == 1
    assert n.validates == ["F-001"]
    assert n.enforces == ["ADR-0040"]
    assert n.gates_total >= 2


def test_merge_gate_map_absent_is_noop(tmp_path):
    from lineage_extractor.extractors.tests import TestNode, _merge_gate_map
    n = TestNode(test_id="x::Y", repo="d", lang="java", framework="junit",
                 test_class="unit", path="x", class_name="Y", covers="", method_count=1)
    assert _merge_gate_map(tmp_path, [n]) == 0  # no test-gates.yaml present


def test_orphan_test_projects_node_but_no_gate_edges():
    test = TestNodeRecord(
        test_id="t.java::OrphanTest", repo="demo", lang="java", framework="junit",
        test_class="unit", path="t.java", class_name="OrphanTest",
        covers="Nonexistent", method_count=1,
    )
    g = project(Substrate(repo="demo", test_nodes=[test]))
    assert g.label_counts().get(config.L_TEST) == 1
    et = g.edge_type_counts()
    assert et.get(config.E_ENFORCES, 0) == 0
    assert et.get(config.E_COVERS, 0) == 0   # descriptor resolves to no code node
