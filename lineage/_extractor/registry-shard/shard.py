#!/usr/bin/env python3
"""Registry-sharding migration for feature-anchored-ontology rev 2 (slice 6).

Splits the five reducer monoliths into `{artefact}/index.{md|yaml}` (high-fidelity
multi-paragraph headlines, dedup surface) + `{artefact}/detail/{ID}.{md|yaml}`
(one file per entry, full content).

Run once per repo. Idempotent on re-run (recreates index + detail/).

Per ADR rev 2 principle 6 — index entries are multi-paragraph and carry the
discriminating context needed for dedup; per ADR rev 2 principle 7 — these
files are read by the `registry-search` subagent, never by reducers directly.
"""
from __future__ import annotations

import re
import sys
import yaml
from pathlib import Path

LINEAGE = Path(__file__).resolve().parents[2] / "odd-platform"

# ----------------------------------------------------------------------
# Helpers


def _split_markdown_entries(text: str, id_prefix: str) -> tuple[str, list[tuple[str, str, str]]]:
    """Split a Markdown artefact into (preamble, [(id, headline, body), ...]).

    Entries appear in TWO formats across the rev-1 artefacts:
    - Old (nested-list) — `- **{ID}**: <headline>` at column 0, followed by
      two-space-indented sub-bullets (Category / Surfaced by / Description / etc.).
    - New (header) — `## {ID} — <headline>` at column 0.

    Body runs from the entry's start to the next entry's start, or to a
    structural section break (`^# ` / `^## ` non-entry / `^### ` non-entry).
    """
    # Combined matcher — capture id, headline-text, format-kind.
    # The list-bullet format permits one optional parenthetical annotation
    # between the bold-closing `**` and the colon (e.g.
    #   - **REFACTOR-045** (NEW 2026-05-10A): <headline>
    #   - **REFACTOR-044** (formerly part of ADR-CANDIDATE-021): <headline>
    # ). Without it the splitter mis-counts entries (e.g. 54 of 211 caught).
    header_re = re.compile(
        rf"^(?P<full>(?:- \*\*(?P<id_l>{re.escape(id_prefix)}-\d+)\*\*\s*(?:\([^)]*\))?\s*:\s*(?P<head_l>[^\n]+))"
        rf"|(?:## (?P<id_h>{re.escape(id_prefix)}-\d+)\s*[—-]\s*(?P<head_h>[^\n]+)))",
        re.MULTILINE,
    )
    matches = list(header_re.finditer(text))
    if not matches:
        return text, []

    preamble = text[: matches[0].start()].rstrip() + "\n"
    entries: list[tuple[str, str, str]] = []

    # Section-break heuristic — lines that bound an entry but are NOT entries.
    # The killer cases are `### MEDIUM severity` / `### LOW severity` between
    # nested-list entries, and `## Cross-references` / `## Maintainer notes`
    # at the end. We trim those off each body.
    section_break_re = re.compile(
        rf"^(?:## (?!{re.escape(id_prefix)}-\d+)[^\n]*|### [^\n]*|# (?!{re.escape(id_prefix)}-\d+)[^\n]*)$",
        re.MULTILINE,
    )

    for i, m in enumerate(matches):
        entry_id = m.group("id_l") or m.group("id_h")
        headline = (m.group("head_l") or m.group("head_h") or "").strip()
        body_start = m.start()
        body_end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        body_raw = text[body_start:body_end]

        # If a section_break appears INSIDE this body, truncate at the break.
        # (Catches the trailing `### MEDIUM severity` after the last HIGH entry.)
        for sb in section_break_re.finditer(body_raw):
            # Skip section_breaks at body_raw[0] (own entry's header masked elsewhere).
            if sb.start() == 0:
                continue
            # Only respect a section_break that's at column 0 AND after the entry's
            # own content has actually ended (preceded by a blank line).
            cut = sb.start()
            preceding = body_raw[:cut]
            if preceding.rstrip("\n").endswith("\n") or preceding.endswith("\n\n"):
                body_raw = body_raw[:cut].rstrip()
                break

        entries.append((entry_id, headline, body_raw.rstrip()))

    return preamble, entries


def _extract_field(body: str, *labels: str) -> str | None:
    """Find the first occurrence of any `**Label**: value` (any leading whitespace, dash-bullet optional)."""
    for label in labels:
        m = re.search(rf"^\s*-?\s*\*\*{re.escape(label)}\*\*:\s*([^\n]+(?:\n(?!\s*-?\s*\*\*)[^\n]*)*)", body, re.MULTILINE)
        if m:
            return m.group(1).strip()
    return None


def _extract_surfaced_by(body: str) -> str | None:
    """The Surfaced by block is a nested list; capture the indented sub-bullets."""
    m = re.search(
        r"^\s*-?\s*\*\*Surfaced by\*\*:\s*\n((?:\s+[-*][^\n]*\n)+)",
        body,
        re.MULTILINE,
    )
    if not m:
        return None
    return m.group(1).rstrip()


def _extract_severity(body: str) -> str:
    """Severity can appear as `**Severity**: HIGH`, `**Severity rationale**: HIGH — ...`, or be implicit by section."""
    m = re.search(r"^\s*-?\s*\*\*Severity\*\*:\s*([A-Z]+)", body, re.MULTILINE)
    if m:
        return m.group(1).strip()
    m = re.search(r"^\s*-?\s*\*\*Severity rationale\*\*:\s*([A-Z]+)", body, re.MULTILINE)
    if m:
        return m.group(1).strip()
    return "UNSPECIFIED"


def _index_headline_md(entry_id: str, headline: str, body: str) -> str:
    """Compose a multi-paragraph index entry. Per ADR rev 2 principle 6:
    minimum content = id_anchor + discriminating behaviour + cross-refs + severity.
    """
    severity = _extract_severity(body)
    category = _extract_field(body, "Category")
    surfaced_block = _extract_surfaced_by(body)
    description_first = _extract_field(body, "Description", "Statement", "Finding")
    if description_first and len(description_first) > 600:
        description_first = description_first[:600].rsplit(" ", 1)[0] + "…"

    parts = [f"## {entry_id} — {headline}", ""]
    parts.append(f"**Severity**: {severity}")
    if category:
        parts.append(f"**Category**: {category}")
    if surfaced_block:
        parts.append("**Surfaced by**:")
        parts.append(surfaced_block)
    if description_first:
        parts.append("")
        parts.append(f"**Discriminating context**: {description_first}")
    parts.append(f"\n**Full detail**: `detail/{entry_id}.md`")
    return "\n".join(parts)


def _index_headline_adr(entry_id: str, headline: str, body: str) -> str:
    """Index headline shape for implicit-adrs entries."""
    classification = _extract_field(body, "Classification") or "UNSPECIFIED"
    severity = _extract_severity(body)
    surfaced_block = _extract_surfaced_by(body)
    decision_first = _extract_field(body, "Decision", "Rationale", "Description", "Statement")
    if decision_first and len(decision_first) > 600:
        decision_first = decision_first[:600].rsplit(" ", 1)[0] + "…"

    parts = [f"## {entry_id} — {headline}", ""]
    parts.append(f"**Classification**: {classification}")
    parts.append(f"**Severity**: {severity}")
    if surfaced_block:
        parts.append("**Surfaced by**:")
        parts.append(surfaced_block)
    if decision_first:
        parts.append("")
        parts.append(f"**Discriminating context**: {decision_first}")
    parts.append(f"\n**Full detail**: `detail/{entry_id}.md`")
    return "\n".join(parts)


def _index_headline_doc_gap(entry_id: str, headline: str, body: str) -> str:
    """Index headline shape for doc-gaps entries."""
    severity = _extract_severity(body)
    category = _extract_field(body, "Category")
    url = _extract_field(body, "Live URL", "URL", "Page URL", "Source URL", "Page")
    status = _extract_field(body, "Last verified status", "Verification status", "Status")
    desc_first = _extract_field(body, "Description", "Drift", "Finding", "Statement")
    if desc_first and len(desc_first) > 600:
        desc_first = desc_first[:600].rsplit(" ", 1)[0] + "…"

    parts = [f"## {entry_id} — {headline}", ""]
    parts.append(f"**Severity**: {severity}")
    if category:
        parts.append(f"**Category**: {category}")
    if url:
        parts.append(f"**Page**: {url}")
    if status:
        parts.append(f"**Last verified**: {status}")
    if desc_first:
        parts.append("")
        parts.append(f"**Discriminating context**: {desc_first}")
    parts.append(f"\n**Full detail**: `detail/{entry_id}.md`")
    return "\n".join(parts)


def _write_sharded_markdown(
    monolith_path: Path,
    out_dir: Path,
    id_prefix: str,
    index_headline_fn,
    artefact_label: str,
) -> dict:
    text = monolith_path.read_text()
    preamble, entries = _split_markdown_entries(text, id_prefix)
    if not entries:
        return {"status": "no_entries", "monolith": str(monolith_path)}

    out_dir.mkdir(parents=True, exist_ok=True)
    detail_dir = out_dir / "detail"
    # Wipe stale detail files from prior runs to keep the sharded set canonical.
    if detail_dir.exists():
        for f in detail_dir.glob("*.md"):
            f.unlink()
    detail_dir.mkdir(parents=True, exist_ok=True)

    index_path = out_dir / "index.md"
    index_parts: list[str] = []
    index_parts.append(preamble.rstrip())
    index_parts.append("")
    index_parts.append(f"# {artefact_label} — index (rev 2 sharded)")
    index_parts.append("")
    index_parts.append(
        "Per `adrs/drafts/feature-anchored-ontology.md` rev 2: this index holds "
        "the high-fidelity discriminating context per entry; full content lives "
        "in `detail/{id}.md`. The `registry-search` subagent reads THIS file; "
        "reducers read the subagent's surfaced candidates verbatim and decide "
        "strengthen-vs-new. Do not hand-edit headline blocks below the index "
        "summary unless the entry's discriminating field changes — re-run "
        "`shard.py` or rely on the reducer to refresh."
    )
    index_parts.append("")
    index_parts.append(f"**Total entries**: {len(entries)}")
    index_parts.append("")
    index_parts.append("---")
    index_parts.append("")

    for entry_id, headline, body in entries:
        index_parts.append(index_headline_fn(entry_id, headline, body))
        index_parts.append("")
        index_parts.append("---")
        index_parts.append("")
        detail_path = detail_dir / f"{entry_id}.md"
        detail_path.write_text(body.rstrip() + "\n")

    index_path.write_text("\n".join(index_parts).rstrip() + "\n")
    return {
        "status": "ok",
        "monolith": str(monolith_path),
        "index": str(index_path),
        "detail_count": len(entries),
        "detail_dir": str(detail_dir),
    }


def _load_multi_doc_yaml(path: Path):
    """concepts.yaml + test-map.yaml use multi-document YAML (frontmatter + body)."""
    with path.open() as f:
        docs = list(yaml.safe_load_all(f))
    return docs


def shard_refactoring_scopes() -> dict:
    return _write_sharded_markdown(
        LINEAGE / "refactoring-scopes.md",
        LINEAGE / "refactoring-scopes",
        id_prefix="REFACTOR",
        index_headline_fn=_index_headline_md,
        artefact_label="refactoring-scopes",
    )


def shard_implicit_adrs() -> dict:
    return _write_sharded_markdown(
        LINEAGE / "implicit-adrs.md",
        LINEAGE / "implicit-adrs",
        id_prefix="ADR-CANDIDATE",
        index_headline_fn=_index_headline_adr,
        artefact_label="implicit-adrs",
    )


def shard_doc_gaps() -> dict:
    return _write_sharded_markdown(
        LINEAGE / "doc-gaps.md",
        LINEAGE / "doc-gaps",
        id_prefix="DOC-GAP",
        index_headline_fn=_index_headline_doc_gap,
        artefact_label="doc-gaps",
    )


def shard_concepts() -> dict:
    monolith = LINEAGE / "concepts.yaml"
    docs = _load_multi_doc_yaml(monolith)
    # First doc is frontmatter metadata, second is the body (multi-section).
    frontmatter = docs[0] if len(docs) > 0 else {}
    body = docs[1] if len(docs) > 1 else {}
    if not isinstance(body, dict):
        return {"status": "body_not_dict", "monolith": str(monolith)}

    # concepts.yaml groups concepts under five lists: entities / audiences /
    # invariants / operations / canonicalisation_candidates. Plus an opt-in
    # `batch_*_strengthens` block that's a per-batch delta (not a concept list).
    concept_kinds = ["entities", "audiences", "invariants", "operations", "canonicalisation_candidates"]

    out_dir = LINEAGE / "concepts"
    out_dir.mkdir(parents=True, exist_ok=True)
    detail_dir = out_dir / "detail"
    if detail_dir.exists():
        for f in detail_dir.glob("**/*.yaml"):
            f.unlink()
    detail_dir.mkdir(parents=True, exist_ok=True)

    index_entries_by_kind: dict[str, list] = {}
    total_concepts = 0

    for kind in concept_kinds:
        kind_list = body.get(kind) or []
        if not kind_list:
            index_entries_by_kind[kind] = []
            continue
        kind_dir = detail_dir / kind
        kind_dir.mkdir(parents=True, exist_ok=True)
        kind_entries = []
        seen_slugs: set[str] = set()
        for c in kind_list:
            if not isinstance(c, dict):
                continue
            # canonicalisation_candidates use `proposed_canonical`; entities/invariants/etc use `name`.
            name = (
                c.get("name")
                or c.get("canonical_name")
                or c.get("concept_name")
                or c.get("proposed_canonical")
                or "unnamed"
            )
            base_slug = re.sub(r"[^a-z0-9]+", "-", str(name).lower()).strip("-") or f"concept-{len(kind_entries)}"
            slug = base_slug
            i = 2
            while slug in seen_slugs:
                slug = f"{base_slug}-{i}"
                i += 1
            seen_slugs.add(slug)
            detail_path = kind_dir / f"{slug}.yaml"
            detail_path.write_text(yaml.safe_dump(c, sort_keys=False, allow_unicode=True))
            description = c.get("description") or c.get("summary") or ""
            if isinstance(description, str) and len(description) > 600:
                description = description[:600].rsplit(" ", 1)[0] + "…"
            idx_entry = {
                "slug": slug,
                "name": name,
                "canonical_in_docs": c.get("canonical_in_docs"),
                "canonical_candidate": c.get("canonical_candidate"),
                "axes_present": c.get("axes_present") or [],
                "nodes_count": len(c.get("nodes") or []),
                "contributors_count": len(c.get("contributors") or []),
                "security_aggregate_overall": (c.get("security_aggregate") or {}).get("overall"),
                "performance_aggregate_overall": (c.get("performance_aggregate") or {}).get("overall"),
                "description": description,
                "detail_path": f"detail/{kind}/{slug}.yaml",
            }
            kind_entries.append(idx_entry)
        index_entries_by_kind[kind] = kind_entries
        total_concepts += len(kind_entries)

    # Pass-through non-list extras (e.g. batch delta blocks) into the index for traceability.
    extras = {k: v for k, v in body.items() if k not in concept_kinds}

    index_path = out_dir / "index.yaml"
    index_body = {
        "artefact": "concepts-index",
        "shape_version": "rev-2-sharded",
        "source_monolith_frontmatter": frontmatter,
        "total_concepts": total_concepts,
        "counts_by_kind": {k: len(v) for k, v in index_entries_by_kind.items()},
        "notice": (
            "Per adrs/drafts/feature-anchored-ontology.md rev 2 principle 6 — index entries "
            "carry the high-fidelity discriminating fields. registry-search reads this file; "
            "reducers spawn registry-search and consume verbatim excerpts. Full content per "
            "concept lives in detail/{kind}/{slug}.yaml."
        ),
        "by_kind": index_entries_by_kind,
        "extras": extras,
    }
    with index_path.open("w") as f:
        yaml.safe_dump(index_body, f, sort_keys=False, allow_unicode=True)
    return {
        "status": "ok",
        "monolith": str(monolith),
        "index": str(index_path),
        "detail_count": total_concepts,
        "counts_by_kind": {k: len(v) for k, v in index_entries_by_kind.items()},
        "detail_dir": str(detail_dir),
    }


def shard_test_map() -> dict:
    monolith = LINEAGE / "test-map.yaml"
    docs = _load_multi_doc_yaml(monolith)
    frontmatter = docs[0] if len(docs) > 0 else {}
    body = docs[1] if len(docs) > 1 else {}
    if not isinstance(body, dict):
        return {"status": "body_not_dict", "monolith": str(monolith)}

    # test-map.yaml uses either a `test_gaps:` flat list or a `per_node:` keyed dict.
    test_gaps = body.get("test_gaps") or []
    if not test_gaps and "per_node" in body:
        # Flatten per_node to list of gaps with node context.
        per_node = body["per_node"]
        if isinstance(per_node, dict):
            for node_id, gaps in per_node.items():
                if isinstance(gaps, list):
                    for g in gaps:
                        g.setdefault("node_id", node_id)
                        test_gaps.append(g)

    if not test_gaps:
        return {"status": "no_test_gaps_found", "monolith": str(monolith), "body_keys": list(body.keys())}

    out_dir = LINEAGE / "test-map"
    out_dir.mkdir(parents=True, exist_ok=True)
    detail_dir = out_dir / "detail"
    detail_dir.mkdir(parents=True, exist_ok=True)

    index_entries = []
    for g in test_gaps:
        gid = g.get("gap_id") or g.get("id") or "TEST-GAP-?"
        detail_path = detail_dir / f"{gid}.yaml"
        detail_path.write_text(yaml.safe_dump(g, sort_keys=False, allow_unicode=True))
        idx_entry = {
            "gap_id": gid,
            "behaviour": g.get("behaviour") or g.get("uncovered_behaviour") or "",
            "test_class": g.get("test_class") or g.get("category") or "",
            "criticality": g.get("criticality") or "",
            "node_id": g.get("node_id") or "",
            "feature_id": g.get("feature_id"),
            "proposed_test_files_count": len(g.get("proposed_test_files") or []),
            "related_refactor_ids": g.get("related_refactor_ids") or [],
            "related_doc_gap_ids": g.get("related_doc_gap_ids") or [],
            "detail_path": f"detail/{gid}.yaml",
        }
        index_entries.append(idx_entry)

    index_path = out_dir / "index.yaml"
    index_body = {
        "artefact": "test-map-index",
        "shape_version": "rev-2-sharded",
        "source_monolith_frontmatter": frontmatter,
        "total_entries": len(index_entries),
        "notice": (
            "Per adrs/drafts/feature-anchored-ontology.md rev 2 principle 6. "
            "registry-search reads this file; full content per gap in detail/{TEST-GAP-NNN}.yaml."
        ),
        "test_gaps_index": index_entries,
    }
    with index_path.open("w") as f:
        yaml.safe_dump(index_body, f, sort_keys=False, allow_unicode=True)
    return {
        "status": "ok",
        "monolith": str(monolith),
        "index": str(index_path),
        "detail_count": len(index_entries),
        "detail_dir": str(detail_dir),
    }


# ----------------------------------------------------------------------
# Driver


def main():
    artefact = sys.argv[1] if len(sys.argv) > 1 else "all"
    runners = {
        "refactoring-scopes": shard_refactoring_scopes,
        "implicit-adrs": shard_implicit_adrs,
        "doc-gaps": shard_doc_gaps,
        "concepts": shard_concepts,
        "test-map": shard_test_map,
    }
    if artefact == "all":
        results = {name: fn() for name, fn in runners.items()}
    elif artefact in runners:
        results = {artefact: runners[artefact]()}
    else:
        print(f"Unknown artefact '{artefact}'. Valid: {list(runners.keys()) + ['all']}", file=sys.stderr)
        sys.exit(2)

    for name, result in results.items():
        print(f"=== {name} ===")
        for k, v in result.items():
            print(f"  {k}: {v}")
        print()


if __name__ == "__main__":
    main()
