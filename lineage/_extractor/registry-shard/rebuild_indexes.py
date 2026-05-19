#!/usr/bin/env python3
"""Rebuild sharded indexes from detail/ directories.

Detail files are the source of truth; indexes are derived headlines. Whenever
delta-merge fails (key-name mismatch, YAML emit bug, agent skipped the delta
file, etc.) the indexes go stale but detail/ stays intact. This script
regenerates the indexes from detail/ idempotently.

Designed to be called by /next-batch Phase 3 after the reducer phase
(replaces the brittle merge_deltas.py + index-append.md workflow). Idempotent
on re-run.

Handles all 6 sharded artefacts:
  - test-map/{index.yaml, detail/{TEST-GAP-NNN}.yaml}
  - concepts/{index.yaml, detail/{kind}/{slug}.yaml}
  - feature-flows/{index.yaml, detail/{F-NNN}.yaml}
  - implicit-adrs/{index.md, detail/{ADR-CANDIDATE-NNN}.md}   ← Markdown
  - refactoring-scopes/{index.md, detail/{REFACTOR-NNN}.md}    ← Markdown
  - doc-gaps/{index.md, detail/{DOC-GAP-NNN}.md}               ← Markdown

YAML artefacts rebuild fully from detail/. Markdown artefacts (the three
big ones — adrs, scopes, doc-gaps) are too prose-heavy to rebuild blindly
from detail; for those we only verify integrity (every detail file has an
index headline AND every index headline has a detail file) and surface
discrepancies; the orchestrator (/next-batch) does the markdown index
appends via awk.

Usage:
  python3 rebuild_indexes.py             # rebuild YAML indexes; verify MD
  python3 rebuild_indexes.py yaml        # rebuild only YAML
  python3 rebuild_indexes.py verify-md   # verify MD only
  python3 rebuild_indexes.py all         # rebuild all
"""
from __future__ import annotations

import re
import sys
import yaml
from pathlib import Path

LINEAGE = Path(__file__).resolve().parents[2] / "odd-platform"


def _safe_yaml_load(path: Path):
    try:
        with path.open() as f:
            return yaml.safe_load(f)
    except (yaml.YAMLError, OSError):
        return None


def rebuild_test_map() -> dict:
    detail_dir = LINEAGE / "test-map" / "detail"
    if not detail_dir.exists():
        return {"status": "no_detail_dir"}
    entries = []
    crit_counts = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0, "UNSPECIFIED": 0}
    cat_counts = {}
    skipped = []
    for path in sorted(detail_dir.glob("*.yaml")):
        d = _safe_yaml_load(path)
        if not isinstance(d, dict):
            skipped.append(path.name)
            continue
        gid = d.get("gap_id") or path.stem
        crit = d.get("criticality") or "UNSPECIFIED"
        if crit in crit_counts:
            crit_counts[crit] += 1
        cat = d.get("test_class") or d.get("category") or "uncategorised"
        cat_counts[cat] = cat_counts.get(cat, 0) + 1
        entries.append({
            "gap_id": gid,
            "behaviour": d.get("behaviour") or d.get("uncovered_behaviour") or "",
            "test_class": d.get("test_class") or d.get("category") or "",
            "criticality": crit,
            "node_id": d.get("node_id") or "",
            "feature_id": d.get("feature_id"),
            "proposed_test_files_count": len(d.get("proposed_test_files") or []),
            "related_refactor_ids": d.get("related_refactor_ids") or [],
            "related_doc_gap_ids": d.get("related_doc_gap_ids") or [],
            "detail_path": f"detail/{path.name}",
        })

    def sort_key(e):
        m = re.search(r"(\d+)", e.get("gap_id") or "")
        return int(m.group(1)) if m else 0
    entries.sort(key=sort_key)

    index_path = LINEAGE / "test-map" / "index.yaml"
    existing = _safe_yaml_load(index_path) or {}
    fm = existing.get("source_monolith_frontmatter", {})
    fm["total_test_gaps"] = len(entries)
    fm["gaps_by_criticality"] = {k: v for k, v in crit_counts.items() if v > 0}
    fm["gaps_by_category"] = cat_counts

    out = {
        "artefact": "test-map-index",
        "shape_version": "rev-2-sharded",
        "source_monolith_frontmatter": fm,
        "total_entries": len(entries),
        "notice": "Rebuilt from detail/ by lineage/_extractor/registry-shard/rebuild_indexes.py. The detail files are the source of truth; this index is derived headlines for the registry-search subagent.",
        "test_gaps_index": entries,
    }
    with index_path.open("w") as f:
        yaml.safe_dump(out, f, sort_keys=False, allow_unicode=True)
    return {"status": "ok", "entries": len(entries), "skipped_broken_yaml": skipped, "by_criticality": crit_counts}


def rebuild_concepts() -> dict:
    detail_dir = LINEAGE / "concepts" / "detail"
    if not detail_dir.exists():
        return {"status": "no_detail_dir"}
    kinds = ["entities", "audiences", "invariants", "operations", "canonicalisation_candidates"]
    by_kind = {}
    skipped = []
    total = 0
    for kind in kinds:
        kdir = detail_dir / kind
        entries = []
        if kdir.exists():
            for path in sorted(kdir.glob("*.yaml")):
                c = _safe_yaml_load(path)
                if not isinstance(c, dict):
                    skipped.append(f"{kind}/{path.name}")
                    continue
                desc = c.get("description") or c.get("summary") or ""
                if isinstance(desc, str) and len(desc) > 600:
                    desc = desc[:600].rsplit(" ", 1)[0] + "…"
                entries.append({
                    "slug": path.stem,
                    "name": c.get("name") or c.get("canonical_name") or c.get("concept_name") or c.get("proposed_canonical") or "unnamed",
                    "canonical_in_docs": c.get("canonical_in_docs"),
                    "canonical_candidate": c.get("canonical_candidate"),
                    "axes_present": c.get("axes_present") or [],
                    "nodes_count": len(c.get("nodes") or []),
                    "contributors_count": len(c.get("contributors") or []),
                    "security_aggregate_overall": (c.get("security_aggregate") or {}).get("overall"),
                    "performance_aggregate_overall": (c.get("performance_aggregate") or {}).get("overall"),
                    "description": desc,
                    "detail_path": f"detail/{kind}/{path.name}",
                })
        by_kind[kind] = entries
        total += len(entries)

    index_path = LINEAGE / "concepts" / "index.yaml"
    existing = _safe_yaml_load(index_path) or {}
    fm = existing.get("source_monolith_frontmatter", {})
    extras = existing.get("extras", {})

    out = {
        "artefact": "concepts-index",
        "shape_version": "rev-2-sharded",
        "source_monolith_frontmatter": fm,
        "total_concepts": total,
        "counts_by_kind": {k: len(v) for k, v in by_kind.items()},
        "notice": "Rebuilt from detail/{kind}/{slug}.yaml by lineage/_extractor/registry-shard/rebuild_indexes.py. Detail files are the source of truth.",
        "by_kind": by_kind,
        "extras": extras,
    }
    with index_path.open("w") as f:
        yaml.safe_dump(out, f, sort_keys=False, allow_unicode=True)
    return {"status": "ok", "total_concepts": total, "by_kind": {k: len(v) for k, v in by_kind.items()}, "skipped_broken_yaml": skipped}


def rebuild_feature_flows() -> dict:
    detail_dir = LINEAGE / "feature-flows" / "detail"
    if not detail_dir.exists():
        return {"status": "no_detail_dir"}
    entries = []
    skipped = []
    for path in sorted(detail_dir.glob("*.yaml")):
        f = _safe_yaml_load(path)
        if not isinstance(f, dict):
            skipped.append(path.name)
            continue
        fid = f.get("feature_id") or path.stem
        tm = f.get("test_matrix") or {}
        matrix_summary = {
            cell: (tm.get(cell) or {}).get("state", "GAP")
            for cell in ("unit", "integration", "performance", "security")
        }
        description = f.get("description") or ""
        if isinstance(description, str) and len(description) > 600:
            description = description[:600].rsplit(" ", 1)[0] + "…"
        contributing_nodes = []
        for n in f.get("contributing_nodes") or []:
            if isinstance(n, str):
                bare = n.split("(")[0].strip()
                if bare:
                    contributing_nodes.append(bare)
        entries.append({
            "feature_id": fid,
            "pillar_id": f.get("pillar_id"),
            "pillar_anchored_id": f.get("pillar_anchored_id"),
            "pillar_anchored_feature_name": f.get("pillar_anchored_feature_name"),
            "feature_name": f.get("feature_name"),
            "primary_drift_class": f.get("primary_drift_class"),
            "drift_class_summary": f.get("drift_class_summary") or [],
            "discovered_from_entry_point": f.get("discovered_from_entry_point"),
            "description_excerpt": description,
            "amplification_factor": f.get("amplification_factor"),
            "contributing_nodes": contributing_nodes,
            "terminal_side_effect_class": (f.get("terminal_side_effect") or {}).get("side_effect_class"),
            "test_matrix_summary": matrix_summary,
            "control_summary": f.get("control_summary"),
            "related_refactoring_scopes": f.get("related_refactoring_scopes") or [],
            "related_test_gaps": f.get("related_test_gaps") or [],
            "related_doc_gaps": f.get("related_doc_gaps") or [],
            "related_concepts": f.get("related_concepts") or [],
            "related_retrospectives": f.get("related_retrospectives") or [],
            "maintainer_curated": f.get("maintainer_curated", False),
            "merge_candidate_with": (f.get("rev3_reclassification") or {}).get("merge_candidate_with"),
            "detail_path": f"detail/{path.name}",
        })

    def sort_key(e):
        m = re.search(r"(\d+)", e.get("feature_id") or "")
        return int(m.group(1)) if m else 0
    entries.sort(key=sort_key)

    index_path = LINEAGE / "feature-flows" / "index.yaml"
    existing = _safe_yaml_load(index_path) or {}
    fm = existing.get("source_monolith_frontmatter", {})
    extras = existing.get("extras", {})

    out = {
        "artefact": "feature-flows-index",
        "shape_version": "rev-2-sharded",
        "source_monolith_frontmatter": fm,
        "total_features": len(entries),
        "notice": "Rebuilt from detail/ by lineage/_extractor/registry-shard/rebuild_indexes.py. Detail files are the source of truth.",
        "features_index": entries,
        "extras": extras,
    }
    with index_path.open("w") as f:
        yaml.safe_dump(out, f, sort_keys=False, allow_unicode=True)
    return {"status": "ok", "entries": len(entries), "skipped_broken_yaml": skipped}


def verify_markdown_indexes() -> dict:
    """For markdown artefacts (implicit-adrs, refactoring-scopes, doc-gaps), verify
    that every detail file has an index headline AND vice versa. Surface
    discrepancies; do NOT auto-rewrite (markdown index files are prose-heavy).
    """
    results = {}
    for artefact, id_prefix in [
        ("implicit-adrs", "ADR-CANDIDATE"),
        ("refactoring-scopes", "REFACTOR"),
        ("doc-gaps", "DOC-GAP"),
    ]:
        adir = LINEAGE / artefact
        detail_dir = adir / "detail"
        index_path = adir / "index.md"
        if not detail_dir.exists() or not index_path.exists():
            results[artefact] = {"status": "missing"}
            continue
        detail_ids = {p.stem for p in detail_dir.glob(f"{id_prefix}-*.md")}
        index_text = index_path.read_text()
        index_ids = set(re.findall(rf"^## ({id_prefix}-\d+)\b", index_text, re.MULTILINE))
        detail_without_index = sorted(detail_ids - index_ids)
        index_without_detail = sorted(index_ids - detail_ids)
        results[artefact] = {
            "detail_count": len(detail_ids),
            "index_count": len(index_ids),
            "detail_without_index": detail_without_index[:10],  # cap noise
            "detail_without_index_total": len(detail_without_index),
            "index_without_detail": index_without_detail[:10],
            "index_without_detail_total": len(index_without_detail),
        }
    return results


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "all"
    print(f"=== rebuild_indexes.py ({mode}) ===")
    if mode in ("yaml", "all"):
        print("--- test-map ---")
        print(rebuild_test_map())
        print("--- concepts ---")
        print(rebuild_concepts())
        print("--- feature-flows ---")
        print(rebuild_feature_flows())
    if mode in ("verify-md", "all"):
        print("--- markdown verify ---")
        for art, r in verify_markdown_indexes().items():
            print(f"  {art}: {r}")


if __name__ == "__main__":
    main()
