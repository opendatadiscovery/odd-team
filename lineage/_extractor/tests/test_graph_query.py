"""Tests for the derived graph query layer.

Hermetic: every test builds a tiny synthetic `lineage/{repo}/` in a tmp dir —
no network, no embedding model. The embedding half is exercised through its
graph-only fallback (`embeddings=False`); the model-backed path is validated
separately by the maiden PROBES run (query-gold-set.yaml).
"""
from __future__ import annotations

import textwrap
from pathlib import Path

import numpy as np
import pytest

from lineage_extractor.graph_query import config
from lineage_extractor.graph_query.embedder import VectorIndex
from lineage_extractor.graph_query.graph_query import GraphQuery, _cap, _matches
from lineage_extractor.graph_query.loaders import load_substrate
from lineage_extractor.graph_query.projector import project

NODE_A = "testrepo java FooController controller-method:bar"
NODE_B = "testrepo java BarConfig config-key-consumer:foo.timeout"
SLUG_A = "testrepo__java__FooController__controller-method__bar"
SLUG_B = "testrepo__java__BarConfig__config-key-consumer__foo.timeout"


def _make_fixture(root: Path) -> Path:
    """Write a minimal but join-exercising `lineage/testrepo/` and return it."""
    ld = root / "lineage" / "testrepo"
    (ld / "understanding").mkdir(parents=True)
    for sub in ("concepts/detail/entities", "implicit-adrs/detail",
                "test-map/detail", "feature-flows/detail", "feature-reflections/detail"):
        (ld / sub).mkdir(parents=True)

    (ld / "nodes.jsonl").write_text(
        '{"id": "%s", "axis": "controllers", "kind": "controller-method", '
        '"repo": "testrepo", "lang": "java", "package": "ctrl", '
        '"descriptor": "bar", "path": "src/FooController.java", "metadata": {}}\n'
        '{"id": "%s", "axis": "config_prefixes", "kind": "config-key-consumer", '
        '"repo": "testrepo", "lang": "java", "package": "cfg", "descriptor": "foo.timeout", '
        '"path": "src/BarConfig.java", "metadata": {}}\n' % (NODE_A, NODE_B)
    )
    (ld / "edges.jsonl").write_text(
        '{"src": "%s", "dst": "%s", "type": "configures", "metadata": {}}\n' % (NODE_A, NODE_B)
    )

    (ld / "understanding" / f"{SLUG_A}.md").write_text(textwrap.dedent(f"""\
        ---
        node_id: "{NODE_A}"
        node_kind: controller-method
        enrichment_status: complete
        confidence_overall: HIGH
        ---

        # FooController.bar — semantic understanding

        ## understanding

        Handles the bar request.

        ## concepts

        - entities: [Foo]

        ## security

        A HIGH severity authorization gap: bar carries no @PreAuthorize.

        ## docs_link_semantic

        - url: "https://docs.example.org/foo"
        """))
    (ld / "understanding" / f"{SLUG_B}.md").write_text(textwrap.dedent(f"""\
        ---
        node_id: "{NODE_B}"
        enrichment_status: complete
        ---

        # BarConfig — semantic understanding

        ## understanding

        Reads the foo.timeout config key.
        """))

    (ld / "concepts/detail/entities" / "foo.yaml").write_text(
        "name: Foo\ndescription: The Foo entity, central to the bar request.\n"
    )
    (ld / "implicit-adrs/detail" / "ADR-CANDIDATE-001.md").write_text(textwrap.dedent(f"""\
        - **ADR-CANDIDATE-001**: Controllers are thin pass-through delegates
          - **Category**: promote
          - **Severity**: HIGH
          - **Surfaced by**:
            - `{SLUG_A}.md:implicit_adrs.[0]`
        """))
    (ld / "test-map/detail" / "TEST-GAP-001.yaml").write_text(textwrap.dedent(f"""\
        gap_id: TEST-GAP-001
        category: missing-unit
        criticality: HIGH
        node_ids:
          - "{NODE_A}"
        behaviour: bar has no unit test
        """))
    (ld / "feature-flows/detail" / "F-001.yaml").write_text(textwrap.dedent(f"""\
        feature_id: F-001
        feature_name: Foo feature
        primary_drift_class: none
        description: the foo feature does foo
        contributing_nodes:
          - "{NODE_A}"
          - "ts react-component:UnresolvedWidget"
        """))
    (ld / "feature-reflections/detail" / "F-001.yaml").write_text(textwrap.dedent(f"""\
        ---
        feature_id: F-001
        feature_name: Foo feature
        hypothesis_summary:
          total: 3
          contradicted: 1
          highest_severity_contradiction:
            one_line: the foo feature contradicts the bar promise
        contributing_sidecars_read:
          - {SLUG_A}.md
        ---
        Prose narrative of the reflection.
        """))
    return ld


@pytest.fixture
def fixture(tmp_path: Path) -> Path:
    return _make_fixture(tmp_path)


# -- loaders ---------------------------------------------------------------

def test_loaders_parse_every_file(fixture: Path) -> None:
    sub = load_substrate(fixture)
    assert len(sub.code_nodes) == 2
    assert len(sub.edges) == 1
    assert len(sub.sidecars) == 2
    assert len(sub.concepts) == 1
    labels = {r.label for r in sub.reducer_nodes}
    assert labels == {"ImplicitADR", "TestGap", "Feature", "FeatureReflection"}
    assert sub.skipped == []


def test_loader_frontmatter_style_reflection(fixture: Path) -> None:
    """The reflection detail file is `--- yaml --- prose` — must still parse."""
    sub = load_substrate(fixture)
    refl = next(r for r in sub.reducer_nodes if r.label == "FeatureReflection")
    assert refl.entry_id == "F-001"
    assert SLUG_A in refl.cited_sidecar_slugs


def test_loader_skips_malformed_yaml_without_crashing(tmp_path: Path) -> None:
    ld = _make_fixture(tmp_path)
    (ld / "test-map/detail" / "TEST-GAP-002.yaml").write_text("gap_id: TEST-GAP-002\nbad: : :\n")
    sub = load_substrate(ld)
    assert any("TEST-GAP-002" in path for path, _reason in sub.skipped)
    # the rest still loaded
    assert len(sub.code_nodes) == 2


# -- projector -------------------------------------------------------------

def test_projection_wires_join_edges(fixture: Path) -> None:
    g = project(load_substrate(fixture))
    et = g.edge_type_counts()
    for expected in ("CONFIGURES", "ENRICHED_BY", "SURFACES_FINDING", "LINKS_DOC",
                     "IMPLIES_ADR", "HAS_TEST_GAP", "PART_OF_FEATURE",
                     "REFLECTED_BY", "MENTIONS_CONCEPT"):
        assert et.get(expected, 0) >= 1, f"missing edge type {expected}"


def test_projection_creates_stub_for_unresolved_feature_node(fixture: Path) -> None:
    g = project(load_substrate(fixture))
    # F-001 lists an un-scaffolded `ts react-component:UnresolvedWidget`.
    assert g.stub_count >= 1


def test_every_node_and_edge_carries_provenance(fixture: Path) -> None:
    """SCHEMA §1 universal-provenance invariant — project() raises otherwise,
    so reaching here at all is the assertion; we also check explicitly."""
    g = project(load_substrate(fixture))
    for node in g.all_nodes():
        assert node.source_file, f"{node.key} has no source_file"


def test_projection_is_deterministic(fixture: Path) -> None:
    g1 = project(load_substrate(fixture))
    g2 = project(load_substrate(fixture))
    assert g1.node_count() == g2.node_count()
    assert g1.edge_count() == g2.edge_count()
    assert g1.label_counts() == g2.label_counts()
    assert g1.edge_type_counts() == g2.edge_type_counts()


def test_neighbourhood_is_hop_bounded(fixture: Path) -> None:
    g = project(load_substrate(fixture))
    code_a = next(k for k in g.keys_by_label("CodeNode") if "bar" in k and "Foo" in k)
    one_hop = g.neighbourhood(code_a, hops=1)
    two_hop = g.neighbourhood(code_a, hops=2)
    assert set(one_hop) <= set(two_hop)
    assert all(d <= 2 for d in two_hop.values())


# -- GraphQuery (graph-only fallback path) ---------------------------------

def test_build_graph_only(fixture: Path) -> None:
    gq = GraphQuery.build(fixture, embeddings=False)
    assert gq.vectors.available is False
    s = gq.stats()
    assert s["nodes"] > 0 and s["edges"] > 0


def test_query_graph_only_keyword_seeded(fixture: Path) -> None:
    gq = GraphQuery.build(fixture, embeddings=False)
    results = gq.query("authorization gap bar", k=5)
    assert results, "keyword-seeded query returned nothing"
    assert all(r.source_file for r in results)
    assert results == sorted(results, key=lambda r: (-r.score, r.hop, r.node_id))


def test_traverse_predicate(fixture: Path) -> None:
    gq = GraphQuery.build(fixture, embeddings=False)
    findings = gq.traverse(label="Finding", where={"finding_kind": "security"})
    assert len(findings) == 1
    assert findings[0].props.get("severity") == "HIGH"


def test_provenance_finds_dependents(fixture: Path) -> None:
    gq = GraphQuery.build(fixture, embeddings=False)
    prov = gq.provenance("FooController.java", hops=1)
    labels = {r.label for r in prov}
    assert "CodeNode" in labels  # the file's own node + its neighbourhood


# -- pure units ------------------------------------------------------------

def test_vector_index_topk_orders_and_breaks_ties_deterministically() -> None:
    matrix = np.array([[1.0, 0.0], [0.0, 1.0], [1.0, 0.0]], dtype=np.float32)
    vi = VectorIndex(model_id="x", matrix=matrix,
                     rows=[("a", "u"), ("b", "u"), ("c", "u")], available=True)
    top = vi.topk(np.array([1.0, 0.0], dtype=np.float32), k=3)
    # rows 0 and 2 tie at score 1.0 — the lower row index wins the tie.
    assert [r for r, _s in top] == [0, 2, 1]


def test_matches_predicate() -> None:
    assert _matches({"kind": "controller-method"}, {"kind": "controller-method"})
    assert _matches({"kind": "Controller-Method"}, {"kind": "controller-method"})  # case-insensitive
    assert not _matches({"kind": "controller"}, {"kind": "controller-method"})
    assert _matches({"kind": "x"}, None)


def test_cap_enforces_token_ceiling() -> None:
    from lineage_extractor.graph_query.graph_query import QueryResult

    big = [
        QueryResult(label="L", node_id="n" * 500, title="t" * 500,
                    source_file="f" * 500, source_line=1, score=1.0)
        for _ in range(10_000)
    ]
    capped = _cap(big)
    assert len(capped) < len(big)
    cost = sum((len(r.title) + len(r.node_id) + len(r.source_file) + 48)
               * config.TOKENS_PER_CHAR for r in capped)
    assert cost <= config.RESULT_TOKEN_CEILING
