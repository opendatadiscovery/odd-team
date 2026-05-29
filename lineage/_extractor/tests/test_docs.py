"""Tests for the documentation axis — the ground-truth doc-lineage layer.

Hermetic: the mechanical extractor tests write a tiny synthetic `docs/` tree
under tmp_path and invoke `ingest_docs`; the projector test builds a synthetic
`Substrate` directly. No network, no embedding model, no git required
(`_safe_short_sha` degrades to "unknown" outside a repo).
"""
from __future__ import annotations

import json
from pathlib import Path

from lineage_extractor.extractors.docs import (
    extract_links,
    ingest_docs,
    normalize_for_hash,
    parse_summary,
    section_content_hash,
    slugify,
    split_sections,
)
from lineage_extractor.graph_query import config
from lineage_extractor.graph_query.projector import project
from lineage_extractor.graph_query.records import (
    ConceptRecord,
    DocNodeRecord,
    DocUnderstandingRecord,
    Substrate,
)


# -- text helpers ----------------------------------------------------------


def test_slugify_github_style():
    assert slugify("Attaching a file") == "attaching-a-file"
    assert slugify("S3-compatible storage (MinIO)") == "s3-compatible-storage-minio"
    assert slugify("  Trailing/leading  ") == "trailingleading"
    # Underscores are word chars in GitHub/GitBook anchors — preserved, not hyphenated.
    assert slugify("CHUNK_BASE_PATH override") == "chunk_base_path-override"


def test_normalize_for_hash_collapses_trailing_and_blank_whitespace():
    # Trailing spaces + runs of blank lines normalise away; leading indentation
    # is markdown-significant and is intentionally preserved.
    a = "line one   \n\n\n\nline two\n"
    b = "line one\n\nline two"
    assert normalize_for_hash(a) == normalize_for_hash(b)


def test_section_content_hash_stable_and_whitespace_insensitive():
    h1 = section_content_hash("Some prose.\n\n\nmore.   ")
    h2 = section_content_hash("Some prose.\n\nmore.")
    assert h1 == h2
    assert h1.startswith("sha256:")
    assert section_content_hash("different") != h1


# -- split_sections --------------------------------------------------------


def test_split_sections_nesting_and_body():
    md = "# Page Title\nintro\n\n## Section A\nbody a\n\n### Sub\nbody sub\n\n## Section B\nbody b\n"
    secs = split_sections(md)
    names = [s.heading_path for s in secs]
    assert names == [
        ["Page Title"],
        ["Page Title", "Section A"],
        ["Page Title", "Section A", "Sub"],
        ["Page Title", "Section B"],
    ]
    assert secs[1].anchor == "section-a"
    assert "body a" in secs[1].body
    # H3 closes when a sibling H2 opens (Section B is not under Sub).
    assert secs[3].heading_path == ["Page Title", "Section B"]


def test_split_sections_skips_fenced_code_headings():
    md = "# Title\n\n```bash\n# not a heading\necho hi\n```\n\n## Real\nbody\n"
    secs = split_sections(md)
    assert [s.heading_path[-1] for s in secs] == ["Title", "Real"]
    assert "# not a heading" in secs[0].body  # the fenced line stays in the body


def test_split_sections_dedupes_anchors():
    md = "# T\n\n## Notes\na\n\n## Notes\nb\n"
    secs = split_sections(md)
    anchors = [s.anchor for s in secs]
    assert anchors == ["t", "notes", "notes-1"]


# -- parse_summary ---------------------------------------------------------


def test_parse_summary_groups_and_unescapes():
    summary = (
        "# Table of contents\n\n## Features\n\n"
        "* [Data Discovery](data-discovery.md)\n"
        "  * [Attachments](data-discovery/attachments.md)\n\n"
        "## Configuration and Deployment\n\n"
        "* [EKS](configuration-and-deployment/quick\\_launch\\_on\\_eks.md)\n"
    )
    mapping = parse_summary(summary)
    assert mapping["data-discovery.md"] == "Features"
    assert mapping["data-discovery/attachments.md"] == "Features"
    # The `\_` escaping in the SUMMARY link must be normalised to match disk.
    assert "configuration-and-deployment/quick_launch_on_eks.md" in mapping


# -- extract_links ---------------------------------------------------------


def test_extract_links_classification_and_unescape():
    body = (
        "See [Features](Features.md) and [anchor](#the-chain) and "
        "[site](https://example.com/x). Image at "
        "[img](.gitbook/img/a\\_b.png). <https://bare.example>\n"
        "https://bare2.example/y"
    )
    links = {l["target"]: l["kind"] for l in extract_links(body, "docs/page.md")}
    assert links["Features.md"] == "doc"
    assert links["#the-chain"] == "anchor"
    assert links["https://example.com/x"] == "external"
    assert links[".gitbook/img/a_b.png"] == "other"   # unescaped + non-md
    assert "https://bare2.example/y" in links


# -- ingest_docs end-to-end ------------------------------------------------


def _make_docs(root: Path) -> Path:
    docs = root / "documentation" / "docs"
    (docs / "data-discovery").mkdir(parents=True)
    (docs / "SUMMARY.md").write_text(
        "# Table of contents\n\n## Features\n\n"
        "* [Data Discovery](data-discovery.md)\n"
        "  * [Attachments](data-discovery/attachments.md)\n"
    )
    (docs / "data-discovery.md").write_text("# Data Discovery\nlanding\n")
    (docs / "data-discovery" / "attachments.md").write_text(
        "# Data Entity Attachments\nintro\n\n## Configuration\nset attachment.storage\n"
    )
    return root / "documentation"


def test_ingest_docs_completeness_and_idempotency(tmp_path):
    documentation = _make_docs(tmp_path)
    lineage_dir = tmp_path / "lineage" / "odd-platform"
    lineage_dir.mkdir(parents=True)

    res = ingest_docs(documentation, lineage_dir)
    assert res.ok
    assert res.page_count == 2
    assert res.node_count == 3            # 2 H1 + 1 H2
    assert res.missing == [] and res.orphan == []

    nodes_path = lineage_dir / "doc-nodes.jsonl"
    rows = [json.loads(l) for l in nodes_path.read_text().splitlines()]
    by_id = {r["id"]: r for r in rows}
    sub = by_id["documentation docs/data-discovery/attachments.md#configuration"]
    assert sub["level"] == 2
    assert sub["summary_group"] == "Features"
    assert sub["live_url"] == (
        "https://docs.opendatadiscovery.org/features/data-discovery/attachments#configuration"
    )
    assert sub["content_hash"].startswith("sha256:")

    # Idempotent — a second run produces byte-identical output.
    first = nodes_path.read_bytes()
    ingest_docs(documentation, lineage_dir)
    assert nodes_path.read_bytes() == first

    manifest = (lineage_dir / "documentation" / "_manifest.yaml").read_text()
    assert "complete: true" in manifest
    assert "upstream_repo: ../documentation" in manifest    # Rule 5 — no abs paths


def test_ingest_docs_flags_orphan_page(tmp_path):
    documentation = _make_docs(tmp_path)
    # A page on disk but absent from SUMMARY.md is an orphan, not silently dropped.
    (documentation / "docs" / "stray.md").write_text("# Stray\nx\n")
    lineage_dir = tmp_path / "lineage" / "odd-platform"
    lineage_dir.mkdir(parents=True)
    res = ingest_docs(documentation, lineage_dir)
    assert "stray.md" in res.orphan


# -- projector DESCRIBES path ---------------------------------------------


def test_projector_wires_describes_edges():
    """A doc-understanding sidecar's `describes` becomes DESCRIBES edges from the
    page's Doc node to the concept it documents."""
    sub = Substrate(repo="odd-platform")
    sub.concepts.append(
        ConceptRecord(
            concept_id="entity:attachment", concept_type="entity",
            canonical_name="Attachment", aliases=[], body="a stored file",
            source_file="concepts/detail/entities/attachment.yaml", source_line=1,
        )
    )
    sub.doc_nodes.append(
        DocNodeRecord(
            node_id="documentation docs/data-discovery/attachments.md",
            repo="documentation", repo_rel_path="docs/data-discovery/attachments.md",
            page_title="Data Entity Attachments", heading="Data Entity Attachments",
            heading_path=["Data Entity Attachments"], anchor="data-entity-attachments",
            level=1, content_hash="sha256:abc", live_url="https://x/y",
            summary_group="Features", in_summary=True, body="intro prose",
            source_file="doc-nodes.jsonl", source_line=1,
        )
    )
    sub.doc_understanding.append(
        DocUnderstandingRecord(
            doc_page="docs/data-discovery/attachments.md",
            page_title="Data Entity Attachments",
            describes_concepts=["Attachment"],
            source_file="doc-understanding/data-discovery__attachments.md", source_line=1,
        )
    )
    g = project(sub)
    page_key = "doc::documentation docs/data-discovery/attachments.md"
    concept_key = "concept::entity:attachment"
    out = g.edges_of(page_key)
    assert ("out", config.E_DESCRIBES, concept_key) in out
