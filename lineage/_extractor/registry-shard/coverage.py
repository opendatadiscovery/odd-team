#!/usr/bin/env python3
"""Coverage-metrics computer for feature-anchored-ontology rev 2 slice 8.

Reads the substrate (nodes.jsonl), the per-node sidecars (understanding/),
and the feature-flows artefact, then emits the two-dimension coverage
report (direct enrichment + feature-flow-touched) anchored on the FIXED
substrate denominator (total_substrate_nodes).

Per `adrs/drafts/feature-anchored-ontology.md` rev 2 principle 8:
- nodes_with_own_sidecar / total_substrate_nodes — direct enrichment
- nodes_touched_by_any_feature_flow / total_substrate_nodes — effective coverage
- features_discovered + features_with_>=1_cell_PROBED — informational only

Run: python3 lineage/_extractor/registry-shard/coverage.py [--write-manifest]
"""
from __future__ import annotations

import json
import re
import sys
import yaml
from pathlib import Path

LINEAGE = Path(__file__).resolve().parents[2] / "odd-platform"
MANIFEST = LINEAGE / "manifest.yaml"
NODES = LINEAGE / "nodes.jsonl"
UNDERSTANDING = LINEAGE / "understanding"
FEATURE_FLOWS = LINEAGE / "feature-flows.yaml"


def load_substrate_node_ids() -> set[str]:
    """Read nodes.jsonl, return the set of substrate node IDs (the fixed denominator)."""
    ids = set()
    with NODES.open() as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                d = json.loads(line)
                nid = d.get("id") or d.get("node_id")
                if nid:
                    ids.add(nid)
            except json.JSONDecodeError:
                continue
    return ids


def load_sidecar_node_ids() -> set[str]:
    """Read each per-node sidecar and extract its node_id from frontmatter."""
    ids = set()
    if not UNDERSTANDING.exists():
        return ids
    for sidecar in UNDERSTANDING.glob("*.md"):
        try:
            text = sidecar.read_text()
            m = re.search(r'^node_id:\s*"?([^"\n]+)"?\s*$', text, re.MULTILINE)
            if m:
                ids.add(m.group(1).strip())
        except OSError:
            continue
    return ids


def load_feature_flow_touched_node_ids() -> tuple[set[str], int, int]:
    """Read feature-flows.yaml; return:
    - the set of node_ids appearing in any feature's `contributing_nodes` AND `chain[*].node`
    - features_discovered (total feature count)
    - features_with_>=1_cell_PROBED (any test_matrix cell in PROBED-* state)
    """
    touched = set()
    if not FEATURE_FLOWS.exists():
        return touched, 0, 0
    try:
        with FEATURE_FLOWS.open() as f:
            docs = list(yaml.safe_load_all(f))
        # feature-flows.yaml has one doc with `features:` list (some versions also have frontmatter as first doc).
        features = []
        for doc in docs:
            if isinstance(doc, dict) and "features" in doc:
                features = doc["features"]
                break
        if not features:
            return touched, 0, 0
        features_with_probed = 0
        for feat in features:
            if not isinstance(feat, dict):
                continue
            # `contributing_nodes` (list of strings)
            for n in feat.get("contributing_nodes") or []:
                if isinstance(n, str):
                    # Extract bare node_id (some entries are "node-id (UNRESOLVED — …)")
                    bare = n.split("(")[0].strip().strip('"').strip("'")
                    if bare:
                        touched.add(bare)
            # `chain` (list of hops each with `node:` field)
            for hop in feat.get("chain") or []:
                if isinstance(hop, dict):
                    n = hop.get("node")
                    if isinstance(n, str):
                        bare = n.split("(")[0].strip().strip('"').strip("'")
                        if bare:
                            touched.add(bare)
            # Check test_matrix for any PROBED-* state
            tm = feat.get("test_matrix") or {}
            for cell_name in ("unit", "integration", "performance", "security"):
                cell = tm.get(cell_name) or {}
                state = cell.get("state") if isinstance(cell, dict) else None
                if isinstance(state, str) and state.startswith("PROBED"):
                    features_with_probed += 1
                    break
        return touched, len(features), features_with_probed
    except (yaml.YAMLError, OSError):
        return touched, 0, 0


def compute_coverage_metrics() -> dict:
    substrate_ids = load_substrate_node_ids()
    sidecar_ids = load_sidecar_node_ids()
    touched_ids, features_discovered, features_probed = load_feature_flow_touched_node_ids()

    # nodes_touched_by_any_feature_flow = union of (sidecar coverage + feature-flow coverage)
    # touched_via_feature_flow_only = touched_ids - sidecar_ids
    nodes_touched_total = sidecar_ids | touched_ids

    total = len(substrate_ids)
    return {
        "total_substrate_nodes": total,
        "nodes_with_own_sidecar": len(sidecar_ids),
        "nodes_with_own_sidecar_pct": round(100 * len(sidecar_ids) / total, 1) if total else 0,
        "nodes_touched_by_any_feature_flow": len(nodes_touched_total),
        "nodes_touched_by_any_feature_flow_pct": round(100 * len(nodes_touched_total) / total, 1) if total else 0,
        "features_discovered": features_discovered,
        "features_with_at_least_one_cell_probed": features_probed,
        "nodes_in_sidecar_but_not_in_substrate": sorted(sidecar_ids - substrate_ids)[:5],
        "nodes_in_feature_flow_but_not_in_substrate": sorted(touched_ids - substrate_ids)[:5],
    }


def render_dashboard(metrics: dict) -> str:
    total = metrics["total_substrate_nodes"]
    return f"""# Coverage dashboard (rev 2 — feature-anchored-ontology slice 8)

Two-dimension coverage against the FIXED substrate denominator
(`total_substrate_nodes` = {total}, frozen at last substrate scan):

| Dimension | Count | of {total} |
|---|---|---|
| Direct enrichment (nodes with own sidecar) | {metrics["nodes_with_own_sidecar"]} | **{metrics["nodes_with_own_sidecar_pct"]}%** |
| Effective coverage (touched by any feature-flow OR own sidecar) | {metrics["nodes_touched_by_any_feature_flow"]} | **{metrics["nodes_touched_by_any_feature_flow_pct"]}%** |

## Informational (no denominator, no target)

- Features discovered: **{metrics["features_discovered"]}**
- Features with ≥1 test-matrix cell PROBED: **{metrics["features_with_at_least_one_cell_probed"]}**

## Integrity audit

- Sidecars referencing nodes NOT in substrate: {len(metrics["nodes_in_sidecar_but_not_in_substrate"])} (sample: {metrics["nodes_in_sidecar_but_not_in_substrate"]})
- feature-flow chains referencing nodes NOT in substrate: {len(metrics["nodes_in_feature_flow_but_not_in_substrate"])} (sample: {metrics["nodes_in_feature_flow_but_not_in_substrate"]})

Both lists should be empty in steady state. Non-empty → either the substrate
is stale (re-scan) or a sidecar / feature-flow references an obsolete ID.

The methodology never gates on "we know all the features"; it gates on
`nodes_touched_by_any_feature_flow / total_substrate_nodes` reaching the
maintainer's target threshold. The features_discovered count is monotonic
and bounded by the platform's real feature surface.
"""


def write_to_manifest(metrics: dict) -> None:
    with MANIFEST.open() as f:
        manifest = yaml.safe_load(f) or {}
    manifest["coverage_metrics"] = {
        "total_substrate_nodes": metrics["total_substrate_nodes"],
        "nodes_with_own_sidecar": metrics["nodes_with_own_sidecar"],
        "nodes_touched_by_any_feature_flow": metrics["nodes_touched_by_any_feature_flow"],
        "features_discovered": metrics["features_discovered"],
        "features_with_at_least_one_cell_probed": metrics["features_with_at_least_one_cell_probed"],
        "computed_by": "lineage/_extractor/registry-shard/coverage.py",
        "schema": "feature-anchored-ontology.md rev 2 principle 8",
    }
    with MANIFEST.open("w") as f:
        yaml.safe_dump(manifest, f, sort_keys=False)


def main():
    metrics = compute_coverage_metrics()
    print(render_dashboard(metrics))
    if "--write-manifest" in sys.argv:
        write_to_manifest(metrics)
        print(f"\n[manifest updated] {MANIFEST}")


if __name__ == "__main__":
    main()
