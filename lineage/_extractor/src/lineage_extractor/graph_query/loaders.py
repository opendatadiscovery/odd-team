"""Loaders — parse the canonical `lineage/{repo}/` files into typed records.

Pure parsing, no LLM, no network. Determinism rules (SCHEMA §3.1) held here:
input files iterate in **sorted path order**; within a file, **source document
order** is preserved. The projector relies on that order being stable.

A file that does not parse is recorded in `Substrate.skipped` with a reason —
never silently dropped (the conform-or-skip contract the reducers already hold).
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from ruamel.yaml import YAML

from lineage_extractor.graph_query import config
from lineage_extractor.graph_query.records import (
    CodeNodeRecord,
    ConceptRecord,
    EdgeRecord,
    ReducerNodeRecord,
    Section,
    SidecarRecord,
    Substrate,
)

_yaml = YAML(typ="safe")

# A reducer-entry id: an uppercase prefix then a numeric suffix
# (ADR-CANDIDATE-001, REFACTOR-001, DOC-GAP-153, TEST-GAP-001, F-021).
_ID_RE = re.compile(r"[A-Z][A-Z0-9-]*-\d+")
# A sidecar filename as cited inside reducer prose: `odd-platform__java__C__k__m.md`.
# The leading segment may carry hyphens (`odd-platform`), so it is matched
# separately from the `__`-joined tail.
_SIDECAR_REF_RE = re.compile(r"[A-Za-z0-9][\w.@+-]*(?:__[\w.@+-]+)+\.md")
_SEVERITY_RE = re.compile(r"\b(CRITICAL|HIGH|MEDIUM|LOW)\b")


# --------------------------------------------------------------------------
# Entry point


def load_substrate(lineage_dir: Path) -> Substrate:
    """Parse every canonical file under `lineage/{repo}/` into a Substrate."""
    sub = Substrate(repo=lineage_dir.name)
    _load_code_nodes(lineage_dir, sub)
    _load_edges(lineage_dir, sub)
    _load_sidecars(lineage_dir, sub)
    _load_concepts(lineage_dir, sub)
    _load_test_map(lineage_dir, sub)
    _load_feature_flows(lineage_dir, sub)
    _load_feature_reflections(lineage_dir, sub)
    _load_markdown_reducer(lineage_dir, sub, "implicit-adrs", "ADR-CANDIDATE", config.L_IMPLICIT_ADR)
    _load_markdown_reducer(lineage_dir, sub, "refactoring-scopes", "REFACTOR", config.L_REFACTOR_SCOPE)
    _load_markdown_reducer(lineage_dir, sub, "doc-gaps", "DOC-GAP", config.L_DOC_GAP)
    return sub


# --------------------------------------------------------------------------
# JSONL substrate spine


def _load_code_nodes(lineage_dir: Path, sub: Substrate) -> None:
    path = lineage_dir / "nodes.jsonl"
    if not path.is_file():
        sub.skipped.append((str(path), "nodes.jsonl absent"))
        return
    for lineno, line in enumerate(path.read_text().splitlines(), start=1):
        line = line.strip()
        if not line:
            continue
        try:
            row = json.loads(line)
        except json.JSONDecodeError as exc:
            sub.skipped.append((f"nodes.jsonl:{lineno}", f"bad JSON: {exc}"))
            continue
        node_id = row.get("id")
        if not node_id:
            sub.skipped.append((f"nodes.jsonl:{lineno}", "row has no `id`"))
            continue
        sub.code_nodes.append(
            CodeNodeRecord(
                node_id=node_id,
                axis=row.get("axis", ""),
                kind=row.get("kind", ""),
                repo=row.get("repo", ""),
                lang=row.get("lang", ""),
                package=row.get("package", ""),
                descriptor=row.get("descriptor", ""),
                path=row.get("path", ""),
                metadata=row.get("metadata") or {},
                source_file="nodes.jsonl",
                source_line=lineno,
            )
        )


def _load_edges(lineage_dir: Path, sub: Substrate) -> None:
    path = lineage_dir / "edges.jsonl"
    if not path.is_file():
        sub.skipped.append((str(path), "edges.jsonl absent"))
        return
    for lineno, line in enumerate(path.read_text().splitlines(), start=1):
        line = line.strip()
        if not line:
            continue
        try:
            row = json.loads(line)
        except json.JSONDecodeError as exc:
            sub.skipped.append((f"edges.jsonl:{lineno}", f"bad JSON: {exc}"))
            continue
        if not row.get("src") or not row.get("dst") or not row.get("type"):
            sub.skipped.append((f"edges.jsonl:{lineno}", "edge missing src/dst/type"))
            continue
        sub.edges.append(
            EdgeRecord(
                src=row["src"],
                dst=row["dst"],
                type=row["type"],
                metadata=row.get("metadata") or {},
                source_file="edges.jsonl",
                source_line=lineno,
            )
        )


# --------------------------------------------------------------------------
# Per-node sidecars


def _load_sidecars(lineage_dir: Path, sub: Substrate) -> None:
    understanding = lineage_dir / "understanding"
    if not understanding.is_dir():
        sub.skipped.append((str(understanding), "understanding/ absent"))
        return
    for path in sorted(understanding.glob("*.md")):
        rel = f"understanding/{path.name}"
        text = path.read_text()
        frontmatter, body_line = _split_frontmatter(text)
        node_id = frontmatter.get("node_id")
        if not node_id:
            sub.skipped.append((rel, "sidecar frontmatter has no node_id"))
            continue
        sub.sidecars.append(
            SidecarRecord(
                node_id=node_id,
                slug=path.stem,
                rel_path=rel,
                frontmatter=frontmatter,
                sections=_parse_sections(text, body_line),
            )
        )


def _split_frontmatter(text: str) -> tuple[dict[str, Any], int]:
    """Return (frontmatter dict, 1-based line where the body starts)."""
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return {}, 1
    for idx in range(1, len(lines)):
        if lines[idx].strip() == "---":
            block = "\n".join(lines[1:idx])
            try:
                data = _yaml.load(block) or {}
            except Exception:  # noqa: BLE001 — malformed frontmatter is a skip, not a crash
                data = {}
            return (data if isinstance(data, dict) else {}), idx + 2
    return {}, 1


def _parse_sections(text: str, body_start_line: int) -> list[Section]:
    """Split a sidecar body into its `## heading` sections, in document order."""
    lines = text.splitlines()
    sections: list[Section] = []
    cur_name: str | None = None
    cur_line = 0
    cur_body: list[str] = []
    for idx in range(body_start_line - 1, len(lines)):
        line = lines[idx]
        if line.startswith("## "):
            if cur_name is not None:
                sections.append(Section(cur_name, "\n".join(cur_body).strip(), cur_line))
            cur_name = line[3:].strip()
            cur_line = idx + 1
            cur_body = []
        elif cur_name is not None:
            cur_body.append(line)
    if cur_name is not None:
        sections.append(Section(cur_name, "\n".join(cur_body).strip(), cur_line))
    return sections


# --------------------------------------------------------------------------
# Concepts


def _load_concepts(lineage_dir: Path, sub: Substrate) -> None:
    detail = lineage_dir / "concepts" / "detail"
    if not detail.is_dir():
        sub.skipped.append((str(detail), "concepts/detail/ absent"))
        return
    for concept_type in ("entities", "operations", "invariants", "audiences"):
        type_dir = detail / concept_type
        if not type_dir.is_dir():
            continue
        for path in sorted(type_dir.glob("*.yaml")):
            rel = f"concepts/detail/{concept_type}/{path.name}"
            data, _body = _read_reducer_yaml(path, rel, sub)
            if data is None:
                continue
            name = data.get("name") or data.get("canonical_name") or path.stem
            body = str(data.get("description") or data.get("statement") or data.get("gloss") or "")
            sub.concepts.append(
                ConceptRecord(
                    concept_id=f"{concept_type[:-1] if concept_type.endswith('s') else concept_type}:{path.stem}",
                    concept_type=concept_type[:-1] if concept_type.endswith("s") else concept_type,
                    canonical_name=str(name),
                    aliases=[str(a) for a in (data.get("aliases") or [])],
                    body=body,
                    cited_node_ids=[str(n) for n in (data.get("nodes") or [])],
                    source_file=rel,
                    source_line=1,
                )
            )


# --------------------------------------------------------------------------
# YAML reducers — test-map, feature-flows, feature-reflections


def _load_test_map(lineage_dir: Path, sub: Substrate) -> None:
    detail = lineage_dir / "test-map" / "detail"
    if not detail.is_dir():
        return
    for path in sorted(detail.glob("TEST-GAP-*.yaml")):
        rel = f"test-map/detail/{path.name}"
        data, _body = _read_reducer_yaml(path, rel, sub)
        if data is None:
            continue
        entry_id = str(data.get("gap_id") or path.stem)
        body_parts = [
            str(data.get("behaviour", "")),
            _join(data.get("evidence")),
            str(data.get("proposed_action", "")),
        ]
        sub.reducer_nodes.append(
            ReducerNodeRecord(
                label=config.L_TEST_GAP,
                entry_id=entry_id,
                title=str(data.get("behaviour", entry_id))[:200],
                body="\n".join(p for p in body_parts if p),
                props={
                    "category": data.get("category", ""),
                    "criticality": data.get("criticality", ""),
                },
                cited_node_ids=[str(n) for n in (data.get("node_ids") or [])],
                source_file=rel,
                source_line=1,
            )
        )


def _load_feature_flows(lineage_dir: Path, sub: Substrate) -> None:
    detail = lineage_dir / "feature-flows" / "detail"
    if not detail.is_dir():
        return
    for path in sorted(detail.glob("F-*.yaml")):
        rel = f"feature-flows/detail/{path.name}"
        data, _body = _read_reducer_yaml(path, rel, sub)
        if data is None:
            continue
        entry_id = str(data.get("feature_id") or path.stem)
        sub.reducer_nodes.append(
            ReducerNodeRecord(
                label=config.L_FEATURE,
                entry_id=entry_id,
                title=str(data.get("feature_name") or data.get("pillar_anchored_feature_name") or entry_id),
                body="\n".join(
                    p for p in (
                        str(data.get("description", "")),
                        _join(data.get("drift_class_summary")),
                    ) if p
                ),
                props={
                    "pillar_id": data.get("pillar_id", ""),
                    "primary_drift_class": data.get("primary_drift_class", ""),
                    "entry_point": data.get("discovered_from_entry_point", ""),
                },
                cited_node_ids=[str(n) for n in (data.get("contributing_nodes") or [])],
                source_file=rel,
                source_line=1,
            )
        )


def _load_feature_reflections(lineage_dir: Path, sub: Substrate) -> None:
    detail = lineage_dir / "feature-reflections" / "detail"
    if not detail.is_dir():
        return
    for path in sorted(detail.glob("F-*.yaml")):
        rel = f"feature-reflections/detail/{path.name}"
        # Reflection detail files are frontmatter-style: a `--- ... ---` YAML
        # block carrying the structured fields, then a prose body.
        data, body = _read_reducer_yaml(path, rel, sub)
        if data is None:
            continue
        entry_id = str(data.get("feature_id") or path.stem)
        summary = data.get("hypothesis_summary") or {}
        contradiction = summary.get("highest_severity_contradiction") or {}
        sub.reducer_nodes.append(
            ReducerNodeRecord(
                label=config.L_FEATURE_REFLECTION,
                entry_id=entry_id,
                title=str(data.get("feature_name") or entry_id),
                body="\n".join(p for p in (str(contradiction.get("one_line", "")), body) if p),
                props={
                    "hypothesis_count": summary.get("total", 0),
                    "contradiction_count": summary.get("contradicted", 0),
                    "feature_id": entry_id,
                },
                cited_sidecar_slugs=[
                    _strip_md(s) for s in (data.get("contributing_sidecars_read") or [])
                ],
                source_file=rel,
                source_line=1,
            )
        )


# --------------------------------------------------------------------------
# Markdown reducers — implicit-adrs, refactoring-scopes, doc-gaps


def _load_markdown_reducer(
    lineage_dir: Path, sub: Substrate, artefact: str, id_prefix: str, label: str
) -> None:
    detail = lineage_dir / artefact / "detail"
    if not detail.is_dir():
        return
    # Group detail files by base id — `ADR-CANDIDATE-001.md` and
    # `ADR-CANDIDATE-001-strengthen-batch-V.md` are one logical entry.
    groups: dict[str, list[Path]] = {}
    for path in sorted(detail.glob("*.md")):
        if not path.stem.startswith(id_prefix):
            sub.skipped.append((f"{artefact}/detail/{path.name}", f"not a {id_prefix} entry"))
            continue
        m = _ID_RE.match(path.stem)
        if not m:
            sub.skipped.append((f"{artefact}/detail/{path.name}", "no parseable entry id"))
            continue
        groups.setdefault(m.group(0), []).append(path)

    for entry_id in sorted(groups):
        paths = sorted(groups[entry_id])
        # The canonical entry is the file whose stem IS the id; the rest
        # (`...-strengthen-batch-V.md`) are appended-evidence fragments.
        primary = next((p for p in paths if p.stem == entry_id), paths[0])
        rel = f"{artefact}/detail/{primary.name}"
        full_text = "\n\n".join(p.read_text() for p in paths)
        sub.reducer_nodes.append(
            ReducerNodeRecord(
                label=label,
                entry_id=entry_id,
                title=_md_entry_title(primary.read_text(), entry_id),
                body=full_text,
                props={
                    "category": _md_field(full_text, "Category"),
                    "severity": _md_severity(full_text),
                },
                cited_sidecar_slugs=sorted(
                    {_strip_md(ref) for ref in _SIDECAR_REF_RE.findall(full_text)}
                ),
                source_file=rel,
                source_line=1,
            )
        )


def _md_entry_title(text: str, entry_id: str) -> str:
    """First-line title of a markdown reducer entry, both `**ID**: t` and `## ID — t`."""
    m = re.search(re.escape(entry_id) + r"\*\*\s*:?\s*(.+)", text)
    if m:
        return m.group(1).strip()[:200]
    m = re.search(r"^#+\s*" + re.escape(entry_id) + r"\s*[—:\-]\s*(.+)$", text, re.MULTILINE)
    if m:
        return m.group(1).strip()[:200]
    return entry_id


def _md_field(text: str, field: str) -> str:
    m = re.search(r"\*\*" + re.escape(field) + r"\*\*\s*:\s*([^\n]+)", text)
    return m.group(1).strip().strip("`").strip() if m else ""


def _md_severity(text: str) -> str:
    """Severity token nearest a `Severity` label, else the first one in the body."""
    m = re.search(r"[Ss]everity[^\n]*?" + _SEVERITY_RE.pattern, text)
    if m:
        return m.group(1)
    m = _SEVERITY_RE.search(text)
    return m.group(1) if m else ""


# --------------------------------------------------------------------------
# Small helpers


def _read_reducer_yaml(path: Path, rel: str, sub: Substrate) -> tuple[dict[str, Any] | None, str]:
    """Load a reducer detail file -> (data, trailing_body).

    Handles both plain single-document YAML (test-map / feature-flows / concept
    entries) and the frontmatter style (`--- <yaml> --- <prose body>`, used by
    feature-reflections). A malformed file is skipped+reported, never coerced.
    """
    try:
        text = path.read_text()
    except OSError as exc:
        sub.skipped.append((rel, f"unreadable: {exc}"))
        return None, ""
    frontmatter, body_line = _split_frontmatter(text)
    if frontmatter:
        body = "\n".join(text.splitlines()[body_line - 1:]).strip()
        return frontmatter, body
    try:
        data = _yaml.load(text)
    except Exception as exc:  # noqa: BLE001 — a malformed reducer file is a skip
        sub.skipped.append((rel, f"YAML parse error: {exc}"))
        return None, ""
    if not isinstance(data, dict):
        sub.skipped.append((rel, "YAML top-level is not a mapping"))
        return None, ""
    return data, ""


def _join(value: Any) -> str:
    if isinstance(value, (list, tuple)):
        return "\n".join(str(v) for v in value)
    return str(value or "")


def _strip_md(ref: str) -> str:
    """Filename / citation -> sidecar slug (`foo.md:section` -> `foo`)."""
    return str(ref).split(":")[0].strip().removesuffix(".md")
