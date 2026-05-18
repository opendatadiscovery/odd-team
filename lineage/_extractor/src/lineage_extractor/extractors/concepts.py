"""concepts axis — promotes the concept-merger's catalog to first-class nodes.

After the concept-merger reducer runs and emits `lineage/{repo}/concepts.yaml`,
this extractor reads that catalog and emits one `kind: concept` node per
catalog entry (entities, operations, invariants, audiences). Each concept
node carries `embodied_by` edges to the node IDs the concept-merger listed
under the entry's `nodes:` field.

The result: a maintainer can ask "which files embody the Policy concept?"
as a graph query (`SELECT ... WHERE type='embodied_by' AND src=concept-id`)
instead of a free-text search through concepts.yaml.

Concept nodes are derivative — they depend on the reducer having run.
A repo with no concepts.yaml emits zero concept nodes; that's the expected
state on a fresh substrate scan, before any sidecars exist.
"""
from __future__ import annotations

import re
from pathlib import Path

from ruamel.yaml import YAML

from lineage_extractor.nodes import Edge, Node


_yaml = YAML(typ="safe")


def extract_concepts(
    *,
    repo: str,
    repo_path: Path,
    lineage_dir: Path | None = None,
) -> tuple[list[Node], list[Edge]]:
    """Read concepts.yaml (if present) and emit concept nodes + embodied_by edges.

    `lineage_dir` is the workspace's `lineage/{repo}/` directory; defaults
    to a sibling of repo_path's workspace root resolved best-effort. When
    invoked from the extractor's registry the value is supplied by the
    orchestrator (`run_extraction` passes it explicitly).
    """
    concepts_path = _resolve_concepts_path(repo, repo_path, lineage_dir)
    if concepts_path is None or not concepts_path.is_file():
        return [], []

    # The concept-merger emits concepts.yaml with frontmatter as the first
    # YAML document, the catalog payload as the second. We pick whichever
    # document carries one of the catalog top-level keys.
    data: dict = {}
    with concepts_path.open("r") as fh:
        for doc in _yaml.load_all(fh):
            if not isinstance(doc, dict):
                continue
            if any(k in doc for k in ("entities", "operations", "invariants", "audiences")):
                data = doc
                break

    nodes: list[Node] = []
    edges: list[Edge] = []

    for category in ("entities", "operations", "invariants", "audiences"):
        entries = data.get(category) or []
        for entry in entries:
            name = (entry or {}).get("name")
            if not name:
                continue
            slug = _slugify(name)
            node = Node(
                id=Node.make_id(repo, "concept", category, "concept", slug),
                repo=repo,
                lang="concept",
                package=category,
                kind="concept",
                descriptor=slug,
                path=f"lineage/{repo}/concepts.yaml#{category}/{slug}",
                axis="concepts",
                documents=None,
                metadata={
                    "canonical_name": name,
                    "canonical_in_docs": bool(entry.get("canonical_in_docs", False)),
                    "canonical_candidate": bool(entry.get("canonical_candidate", False)),
                    "category": category,
                    "axes_present": list(entry.get("axes_present", []) or []),
                    "contributing_file_count": len(entry.get("contributing_files", []) or []),
                    "security_overall": _aggregate_overall(entry.get("security_aggregate")),
                    "performance_overall": _aggregate_overall(entry.get("performance_aggregate")),
                },
            )
            nodes.append(node)
            for embodying_node_id in entry.get("nodes", []) or []:
                edges.append(
                    Edge(
                        src=node.id,
                        dst=str(embodying_node_id),
                        type="embodied_by",
                        metadata={"concept_name": name, "category": category},
                    )
                )

    nodes.sort(key=lambda n: n.id)
    return nodes, edges


def _resolve_concepts_path(
    repo: str,
    repo_path: Path,
    lineage_dir: Path | None,
) -> Path | None:
    """Resolve the concepts.yaml path. Prefer the explicit lineage_dir."""
    if lineage_dir is not None:
        return lineage_dir / "concepts.yaml"
    # Fallback: walk up from repo_path looking for a sibling `lineage/{repo}/`.
    here = repo_path.resolve()
    for ancestor in [here, *here.parents]:
        candidate = ancestor / "lineage" / repo / "concepts.yaml"
        if candidate.is_file():
            return candidate
    return None


_SLUG_NON_ALPHANUM = re.compile(r"[^a-z0-9]+")


def _slugify(name: str) -> str:
    """Lowercase + collapse non-alphanumerics to dashes; trim leading/trailing.

    Reversible enough for human inspection; uniqueness comes from category
    namespacing (`entities/data-entity` vs `operations/data-entity`).
    """
    base = _SLUG_NON_ALPHANUM.sub("-", name.lower()).strip("-")
    return base or "unnamed"


def _aggregate_overall(aggregate: dict | None) -> str | None:
    """Pull the `overall:` severity from a security or performance aggregate."""
    if not aggregate:
        return None
    overall = aggregate.get("overall")
    if overall is None:
        return None
    return str(overall)
