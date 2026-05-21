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
class Substrate:
    """Everything the loaders parsed out of `lineage/{repo}/` — projector input."""

    repo: str
    code_nodes: list[CodeNodeRecord] = field(default_factory=list)
    edges: list[EdgeRecord] = field(default_factory=list)
    sidecars: list[SidecarRecord] = field(default_factory=list)
    reducer_nodes: list[ReducerNodeRecord] = field(default_factory=list)
    concepts: list[ConceptRecord] = field(default_factory=list)
    # Files that could not be parsed — surfaced, never silently dropped.
    skipped: list[tuple[str, str]] = field(default_factory=list)   # (path, reason)
