#!/usr/bin/env python3
"""Uniform delta-merge helper for the rev-2 sharded reducer artefacts.

Called by /next-batch (Phase 3) after reducers land. Handles the artefacts
where reducers emit a separate `index.delta.yaml` or `index-batch-{id}-append.md`
file rather than editing the live index directly (which they fall back to
when the index file exceeds their Read window — exactly the rev-2 design).

Usage:
  python3 merge_deltas.py test-map        # merge test-map/index.delta.yaml into test-map/index.yaml
  python3 merge_deltas.py concepts        # merge concepts/index.delta.yaml into concepts/index.yaml
  python3 merge_deltas.py feature-flows   # merge feature-flows/index.delta.yaml into feature-flows/index.yaml
  python3 merge_deltas.py all             # merge whatever delta files exist

The Markdown artefacts (implicit-adrs, refactoring-scopes, doc-gaps) use a
separate append-file convention (index-batch-{theme_id}-append.md); those are
merged with awk one-liners in the /next-batch skill's Phase 3 (not by this script).
"""
from __future__ import annotations

import sys
import yaml
from pathlib import Path

LINEAGE = Path(__file__).resolve().parents[2] / "odd-platform"


def _merge_yaml_index(artefact: str, list_key: str) -> dict:
    """Generic merger for YAML-shaped sharded indexes.

    Expected delta shape:
      frontmatter_updates:
        source_monolith_frontmatter: { field: value, ..., batch_history_append: [...] }
      strengthened_entries: [ { <id_key>: ..., field: value, ... }, ... ]
      <list_key>_append: [ { <id_key>: ..., ... }, ... ]
    """
    index_path = LINEAGE / artefact / "index.yaml"
    delta_path = LINEAGE / artefact / "index.delta.yaml"

    if not delta_path.exists():
        return {"status": "no_delta", "artefact": artefact}
    if not index_path.exists():
        return {"status": "no_index", "artefact": artefact}

    with index_path.open() as f:
        index = yaml.safe_load(f) or {}
    with delta_path.open() as f:
        delta = yaml.safe_load(f) or {}

    # 1. Apply frontmatter_updates
    fm_updates = (delta.get("frontmatter_updates") or {}).get("source_monolith_frontmatter") or {}
    fm = index.setdefault("source_monolith_frontmatter", {})
    for key, value in fm_updates.items():
        if key == "batch_history_append":
            existing = fm.setdefault("batch_history", [])
            if isinstance(value, list):
                existing.extend(value)
        elif isinstance(value, dict) and isinstance(fm.get(key), dict):
            fm[key].update(value)
        else:
            fm[key] = value

    # 2. Apply strengthened_entries
    id_key = _id_key_for(list_key)
    strengthened = delta.get("strengthened_entries") or []
    if strengthened:
        by_id = {e.get(id_key): e for e in (index.get(list_key) or []) if isinstance(e, dict)}
        for upd in strengthened:
            target = upd.get(id_key)
            if target and target in by_id:
                for k, v in upd.items():
                    if k == id_key:
                        continue
                    if isinstance(v, list) and isinstance(by_id[target].get(k), list):
                        for item in v:
                            if item not in by_id[target][k]:
                                by_id[target][k].append(item)
                    else:
                        by_id[target][k] = v

    # 3. Append new entries
    new_entries = delta.get(f"{list_key}_append") or delta.get("test_gaps_index_append") or delta.get("concepts_index_append") or delta.get("features_index_append") or []
    if new_entries:
        existing_list = index.setdefault(list_key, [])
        existing_ids = {e.get(id_key) for e in existing_list if isinstance(e, dict)}
        for entry in new_entries:
            entry_id = entry.get(id_key)
            if entry_id not in existing_ids:
                existing_list.append(entry)

    # 4. Update aggregate counts
    index["total_entries"] = len(index.get(list_key, []))

    with index_path.open("w") as f:
        yaml.safe_dump(index, f, sort_keys=False, allow_unicode=True)

    return {
        "status": "ok",
        "artefact": artefact,
        "total_entries": index["total_entries"],
        "strengthened": len(strengthened),
        "appended": len(new_entries),
    }


def _id_key_for(list_key: str) -> str:
    """Map artefact list-key to the per-entry id field."""
    return {
        "test_gaps_index": "gap_id",
        "concepts_index": "slug",      # concepts use {kind: [...]} structure; this path is for flat indexes
        "features_index": "feature_id",
    }.get(list_key, "id")


def shard_test_map_delta() -> dict:
    return _merge_yaml_index("test-map", "test_gaps_index")


def shard_concepts_delta() -> dict:
    """concepts/index.yaml has a nested by_kind structure — needs special handling."""
    artefact = "concepts"
    index_path = LINEAGE / artefact / "index.yaml"
    delta_path = LINEAGE / artefact / "index.delta.yaml"
    if not delta_path.exists():
        return {"status": "no_delta", "artefact": artefact}
    if not index_path.exists():
        return {"status": "no_index", "artefact": artefact}

    with index_path.open() as f:
        index = yaml.safe_load(f) or {}
    with delta_path.open() as f:
        delta = yaml.safe_load(f) or {}

    by_kind_delta = delta.get("by_kind_append") or {}
    by_kind = index.setdefault("by_kind", {})
    appended_total = 0
    for kind, new_entries in by_kind_delta.items():
        existing_list = by_kind.setdefault(kind, [])
        existing_slugs = {e.get("slug") for e in existing_list if isinstance(e, dict)}
        for entry in new_entries:
            if entry.get("slug") not in existing_slugs:
                existing_list.append(entry)
                appended_total += 1

    strengthened_total = 0
    for kind, updates in (delta.get("by_kind_strengthen") or {}).items():
        if kind not in by_kind:
            continue
        by_slug = {e.get("slug"): e for e in by_kind[kind] if isinstance(e, dict)}
        for upd in updates:
            slug = upd.get("slug")
            if slug in by_slug:
                for k, v in upd.items():
                    if k == "slug":
                        continue
                    if isinstance(v, list) and isinstance(by_slug[slug].get(k), list):
                        for item in v:
                            if item not in by_slug[slug][k]:
                                by_slug[slug][k].append(item)
                    else:
                        by_slug[slug][k] = v
                strengthened_total += 1

    fm_updates = (delta.get("frontmatter_updates") or {}).get("source_monolith_frontmatter") or {}
    fm = index.setdefault("source_monolith_frontmatter", {})
    for key, value in fm_updates.items():
        if isinstance(value, dict) and isinstance(fm.get(key), dict):
            fm[key].update(value)
        else:
            fm[key] = value

    index["total_concepts"] = sum(len(v) for v in by_kind.values())
    index["counts_by_kind"] = {k: len(v) for k, v in by_kind.items()}

    with index_path.open("w") as f:
        yaml.safe_dump(index, f, sort_keys=False, allow_unicode=True)

    return {
        "status": "ok",
        "artefact": artefact,
        "total_concepts": index["total_concepts"],
        "appended": appended_total,
        "strengthened": strengthened_total,
    }


def shard_feature_flows_delta() -> dict:
    return _merge_yaml_index("feature-flows", "features_index")


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    target = sys.argv[1]
    runners = {
        "test-map": shard_test_map_delta,
        "concepts": shard_concepts_delta,
        "feature-flows": shard_feature_flows_delta,
    }
    if target == "all":
        results = {name: fn() for name, fn in runners.items()}
    elif target in runners:
        results = {target: runners[target]()}
    else:
        print(f"Unknown artefact '{target}'. Valid: {list(runners.keys()) + ['all']}", file=sys.stderr)
        sys.exit(2)
    for name, result in results.items():
        print(f"=== {name} ===")
        for k, v in result.items():
            print(f"  {k}: {v}")
        print()


if __name__ == "__main__":
    main()
