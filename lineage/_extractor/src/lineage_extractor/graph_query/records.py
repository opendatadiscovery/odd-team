"""Typed records — the structured form of the canonical files, before projection.

The loaders parse `lineage/{repo}/` into these; the projector turns them into a
labeled property graph. Records carry `source_file` + `source_line` so the
universal-provenance invariant (SCHEMA §1: every graph element traces to a
canonical file:line) holds from the very first parse step.
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class Section:
    """One `## heading` block of a per-node sidecar."""

    name: str        # heading text, e.g. "understanding", "security"
    body: str        # section body (heading line excluded)
    line: int        # 1-based line of the heading in the sidecar file


@dataclass
class CodeNodeRecord:
    """One row of `nodes.jsonl` — the structural spine."""

    node_id: str
    axis: str
    kind: str
    repo: str
    lang: str
    package: str
    descriptor: str
    path: str               # the code location the node points at
    metadata: dict
    source_file: str        # "nodes.jsonl"
    source_line: int        # 1-based line in nodes.jsonl


@dataclass
class EdgeRecord:
    """One row of `edges.jsonl` — a structural relationship."""

    src: str
    dst: str
    type: str               # raw, lowercase (exposes / configures / mounts / imports)
    metadata: dict
    source_file: str        # "edges.jsonl"
    source_line: int


@dataclass
class SidecarRecord:
    """One per-node enrichment sidecar (`understanding/*.md`)."""

    node_id: str
    slug: str               # filename stem — the key reducers cite sidecars by
    rel_path: str           # "understanding/<file>.md"
    frontmatter: dict
    sections: list[Section]

    @property
    def source_file(self) -> str:
        return self.rel_path


@dataclass
class ADRNodeRecord:
    """A published ADR node parsed from `adr-nodes.jsonl` (ground-truth-lineage
    Phase 2). Identity is `adr_id`; the join fields carry the edges the projector
    wires (`PROMOTED_TO` / `REALISES` / `SUPERSEDED_BY`)."""

    adr_id: str
    title: str
    status: str
    date: str
    repo_rel_path: str
    anchor: str
    live_url: str
    content_hash: str
    promoted_from: str
    realises: list[str]
    superseded_by: str
    source_file: str
    source_line: int


@dataclass
class TestNodeRecord:
    """An existing test parsed from `test-nodes.jsonl` (ground-truth-lineage
    Phase 4). Identity is `test_id` = `{path}::{class}`. `covers` is the
    mechanically-inferred production descriptor; the gate lists carry the
    declared `@enforces`/`@validates`/`@regresses`/`@pins`/`@covers` refs the
    projector turns into COVERS / ENFORCES / VALIDATES / REGRESSES edges.

    `pins` is the characterization-pin relationship (an OPEN, deliberately-unfixed
    bug the test asserts the *incorrect* behaviour of); `status` is the navigable
    derived label — `pins-known-bug` when `pins` is non-empty, else `active`."""

    __test__ = False  # domain record, not a pytest test class (name starts with "Test")

    test_id: str
    repo: str
    lang: str
    framework: str
    test_class: str
    path: str
    class_name: str
    covers: str
    method_count: int
    enforces: list[str] = field(default_factory=list)
    validates: list[str] = field(default_factory=list)
    regresses: list[str] = field(default_factory=list)
    pins: list[str] = field(default_factory=list)
    covers_refs: list[str] = field(default_factory=list)
    content_hash: str = ""
    status: str = "active"
    source_file: str = "test-nodes.jsonl"
    source_line: int = 0


@dataclass
class ReducerNodeRecord:
    """A reducer-derived node — ImplicitADR / RefactoringScope / DocGap / TestGap /
    Feature / FeatureReflection. One per reducer `detail/` entry."""

    label: str                          # config.L_* label
    entry_id: str                       # ADR-CANDIDATE-001 / REFACTOR-001 / F-001 ...
    title: str
    body: str                           # full entry text — the embedding target
    props: dict = field(default_factory=dict)
    cited_node_ids: list[str] = field(default_factory=list)
    cited_sidecar_slugs: list[str] = field(default_factory=list)
    source_file: str = ""
    source_line: int = 0


@dataclass
class ConceptRecord:
    """One concept catalogue entry (`concepts/detail/{type}/*.yaml`)."""

    concept_id: str          # "{concept_type}:{slug}"
    concept_type: str        # entity | operation | invariant | audience
    canonical_name: str
    aliases: list[str]
    body: str                # description / gloss — the embedding target
    cited_node_ids: list[str] = field(default_factory=list)   # audiences carry `nodes:`
    source_file: str = ""
    source_line: int = 0


@dataclass
class DocNodeRecord:
    """One row of `doc-nodes.jsonl` — a documentation section's committed
    addressing (ground-truth-lineage layer). `body` is NOT in the file
    (reference-upstream); the loader fills it by reading the referenced section
    from `../documentation` and sets `drifted` if the live prose no longer
    hashes to `content_hash`. `body` is the embedding target."""

    node_id: str
    repo: str                 # "documentation"
    repo_rel_path: str
    page_title: str
    heading: str
    heading_path: list[str]
    anchor: str
    level: int
    content_hash: str
    live_url: str
    summary_group: str
    in_summary: bool
    links: list[dict] = field(default_factory=list)
    body: str = ""            # filled by the loader from upstream prose (reference-upstream)
    drifted: bool = False     # live prose hash != committed content_hash
    source_file: str = "doc-nodes.jsonl"
    source_line: int = 0


@dataclass
class DocUnderstandingRecord:
    """One agentic per-page doc sidecar (`doc-understanding/*.md`) — the reverse
    doc→ontology links (ground-truth-lineage). The `doc-analyser` subagent emits
    these; the projector turns `describes_*` into DESCRIBES edges from the page's
    Doc node to the concepts / features / code it documents. `prose` is an
    optional embeddable narrative."""

    doc_page: str                 # docs-relative path, e.g. docs/data-discovery/attachments.md
    page_title: str
    describes_concepts: list[str] = field(default_factory=list)
    describes_features: list[str] = field(default_factory=list)
    describes_code: list[str] = field(default_factory=list)
    audience: list[str] = field(default_factory=list)
    doc_claim_vs_code: list[str] = field(default_factory=list)
    live_url: str = ""
    live_url_verified_status: str = ""
    prose: str = ""
    source_file: str = ""
    source_line: int = 1


@dataclass
class Substrate:
    """Everything the loaders parsed out of `lineage/{repo}/` — projector input."""

    repo: str
    code_nodes: list[CodeNodeRecord] = field(default_factory=list)
    edges: list[EdgeRecord] = field(default_factory=list)
    sidecars: list[SidecarRecord] = field(default_factory=list)
    reducer_nodes: list[ReducerNodeRecord] = field(default_factory=list)
    concepts: list[ConceptRecord] = field(default_factory=list)
    doc_nodes: list[DocNodeRecord] = field(default_factory=list)
    doc_understanding: list[DocUnderstandingRecord] = field(default_factory=list)
    adr_nodes: list[ADRNodeRecord] = field(default_factory=list)
    test_nodes: list[TestNodeRecord] = field(default_factory=list)
    # Files that could not be parsed — surfaced, never silently dropped.
    skipped: list[tuple[str, str]] = field(default_factory=list)   # (path, reason)
