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
FEATURE_FLOWS_LEGACY = LINEAGE / "feature-flows.yaml"  # pre-slice-9 monolith
FEATURE_FLOWS_DETAIL = LINEAGE / "feature-flows" / "detail"  # post-slice-9 sharded


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


# Stress-protocol coverage (LSN-019) — the honest metric.
#
# Counts confidence labels inside each sidecar's `## stress_findings` section.
# STATIC-INFERRED — analyser traced the code; recorded an answer with file:line evidence.
# PROBE-NEEDED — analyser emitted a probe-skeleton; awaiting probe-runner.
# PROBE-VERIFIED — probe-runner resolved the question; the sidecar carries the measured value.
# REFERENCE — answer lives in another sidecar (cross-node composition).
#
# `stress_verified_pct` = (STATIC-INFERRED + PROBE-VERIFIED) / total stress questions
# is the *honest* coverage axis. PROBE-NEEDED counts as unfinished work; REFERENCE
# counts as deferred-to-another-node (the question isn't answered until the
# referenced sidecar resolves it). The maintainer's reading of "X% coverage"
# changes meaning: not "X% of nodes have a sidecar" (vanity) but "X% of
# load-bearing stress questions are answered with cited evidence" (substantive).
#
# A sidecar with NO `## stress_findings` section pre-dates Rule 9 (file-analyser/0.4.0);
# count it under `sidecars_pre_stress` so the gap is visible until backfilled.

CONFIDENCE_LABELS = (
    "STATIC-INFERRED",
    "PROBE-NEEDED",
    "PROBE-VERIFIED",
    "REFERENCE",
)


def _extract_stress_section(text: str) -> str | None:
    """Return the slice between '## stress_findings' and the next '## ' header.

    None if the sidecar has no stress_findings section (pre-Rule-9 sidecar).
    """
    m = re.search(r'^##\s+stress_findings\s*$', text, re.MULTILINE)
    if not m:
        return None
    start = m.end()
    rest = text[start:]
    nxt = re.search(r'^##\s+\S', rest, re.MULTILINE)
    return rest[: nxt.start()] if nxt else rest


def load_stress_metrics() -> dict:
    """Walk sidecars, count stress confidence labels, return aggregate metrics."""
    counts = {label: 0 for label in CONFIDENCE_LABELS}
    sidecars_with_stress = 0
    sidecars_pre_stress = 0
    sidecars_empty_stress = 0  # has the section but no triggered questions
    total_sidecars = 0
    if not UNDERSTANDING.exists():
        return {
            "sidecars_total": 0,
            "sidecars_with_stress_section": 0,
            "sidecars_pre_stress_protocol": 0,
            "sidecars_empty_stress_section": 0,
            "stress_questions_total": 0,
            **{f"stress_answers_{label.lower().replace('-', '_')}": 0 for label in CONFIDENCE_LABELS},
            "stress_verified_pct": 0.0,
            "stress_unanswered_pct": 0.0,
        }
    for sidecar in UNDERSTANDING.glob("*.md"):
        total_sidecars += 1
        try:
            text = sidecar.read_text()
        except OSError:
            continue
        section = _extract_stress_section(text)
        if section is None:
            sidecars_pre_stress += 1
            continue
        sidecars_with_stress += 1
        local_total = 0
        for label in CONFIDENCE_LABELS:
            n = len(re.findall(rf'\bconfidence:\s*{re.escape(label)}\b', section))
            counts[label] += n
            local_total += n
        if local_total == 0:
            sidecars_empty_stress += 1
    total_questions = sum(counts.values())
    verified = counts["STATIC-INFERRED"] + counts["PROBE-VERIFIED"]
    unanswered = counts["PROBE-NEEDED"] + counts["REFERENCE"]
    return {
        "sidecars_total": total_sidecars,
        "sidecars_with_stress_section": sidecars_with_stress,
        "sidecars_pre_stress_protocol": sidecars_pre_stress,
        "sidecars_empty_stress_section": sidecars_empty_stress,
        "stress_questions_total": total_questions,
        **{f"stress_answers_{label.lower().replace('-', '_')}": counts[label] for label in CONFIDENCE_LABELS},
        "stress_verified_pct": round(100 * verified / total_questions, 1) if total_questions else 0.0,
        "stress_unanswered_pct": round(100 * unanswered / total_questions, 1) if total_questions else 0.0,
    }


def _load_features() -> list:
    """Prefer the sharded form (feature-flows/detail/*.yaml); fall back to the
    legacy monolith (feature-flows.yaml) for pre-slice-9 repos.
    """
    if FEATURE_FLOWS_DETAIL.exists():
        features = []
        for path in sorted(FEATURE_FLOWS_DETAIL.glob("*.yaml")):
            try:
                with path.open() as f:
                    feat = yaml.safe_load(f)
                if isinstance(feat, dict):
                    features.append(feat)
            except (yaml.YAMLError, OSError):
                continue
        if features:
            return features
    # Fallback to monolith.
    if not FEATURE_FLOWS_LEGACY.exists():
        return []
    try:
        with FEATURE_FLOWS_LEGACY.open() as f:
            docs = list(yaml.safe_load_all(f))
        for doc in docs:
            if isinstance(doc, dict) and "features" in doc:
                return doc["features"] or []
    except (yaml.YAMLError, OSError):
        return []
    return []


def load_feature_flow_touched_node_ids() -> tuple[set[str], int, int]:
    """Walk every feature (sharded or legacy); return:
    - the set of node_ids appearing in any feature's `contributing_nodes` AND `chain[*].node`
    - features_discovered (total feature count)
    - features_with_>=1_cell_PROBED (any test_matrix cell in PROBED-* state)
    """
    touched = set()
    features = _load_features()
    if not features:
        return touched, 0, 0
    try:
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
    stress = load_stress_metrics()

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
        # Stress Protocol (LSN-019) — the honest metric.
        **stress,
    }


def render_dashboard(metrics: dict) -> str:
    total = metrics["total_substrate_nodes"]
    return f"""# Coverage dashboard (rev 2 — feature-anchored-ontology slice 8 + LSN-019 stress axis)

## Static enrichment coverage (vanity axes — kept for trend continuity)

Two-dimension coverage against the FIXED substrate denominator
(`total_substrate_nodes` = {total}, frozen at last substrate scan).
**These metrics count nodes TOUCHED, not claims VERIFIED.** Per LSN-019,
"the operator can trust the ontology" needs the stress axis below.

| Dimension | Count | of {total} |
|---|---|---|
| Direct enrichment (nodes with own sidecar) | {metrics["nodes_with_own_sidecar"]} | **{metrics["nodes_with_own_sidecar_pct"]}%** |
| Effective coverage (touched by any feature-flow OR own sidecar) | {metrics["nodes_touched_by_any_feature_flow"]} | **{metrics["nodes_touched_by_any_feature_flow_pct"]}%** |

## Stress Protocol coverage (LSN-019 — the honest axis)

Counts confidence labels inside each sidecar's `## stress_findings` block.
The denominator is **total stress questions across all sidecars**, not nodes.
A node may produce many questions (a controller with 4 endpoints × 4 auth-mode
questions = 16 just for category D); each question is one unit of coverage.

| Axis | Count | of {metrics["stress_questions_total"]} questions |
|---|---|---|
| Static-inferred (analyser traced the code → answer with file:line evidence) | {metrics["stress_answers_static_inferred"]} | {round(100 * metrics["stress_answers_static_inferred"] / metrics["stress_questions_total"], 1) if metrics["stress_questions_total"] else 0}% |
| Probe-verified (probe-runner resolved → measured value) | {metrics["stress_answers_probe_verified"]} | {round(100 * metrics["stress_answers_probe_verified"] / metrics["stress_questions_total"], 1) if metrics["stress_questions_total"] else 0}% |
| Probe-needed (analyser emitted a skeleton; awaiting probe-runner) | {metrics["stress_answers_probe_needed"]} | {round(100 * metrics["stress_answers_probe_needed"] / metrics["stress_questions_total"], 1) if metrics["stress_questions_total"] else 0}% |
| Reference (answer deferred to another sidecar) | {metrics["stress_answers_reference"]} | {round(100 * metrics["stress_answers_reference"] / metrics["stress_questions_total"], 1) if metrics["stress_questions_total"] else 0}% |
| **Total verified (static-inferred + probe-verified)** | **{metrics["stress_answers_static_inferred"] + metrics["stress_answers_probe_verified"]}** | **{metrics["stress_verified_pct"]}%** |
| **Total unanswered (probe-needed + reference)** | **{metrics["stress_answers_probe_needed"] + metrics["stress_answers_reference"]}** | **{metrics["stress_unanswered_pct"]}%** |

### Sidecar adoption of the Stress Protocol

| Adoption state | Count | of {metrics["sidecars_total"]} sidecars |
|---|---|---|
| With `stress_findings` section (Rule 9 — file-analyser/0.4.0+) | {metrics["sidecars_with_stress_section"]} | {round(100 * metrics["sidecars_with_stress_section"] / metrics["sidecars_total"], 1) if metrics["sidecars_total"] else 0}% |
| Pre-Stress-Protocol (authored before file-analyser/0.4.0) | {metrics["sidecars_pre_stress_protocol"]} | {round(100 * metrics["sidecars_pre_stress_protocol"] / metrics["sidecars_total"], 1) if metrics["sidecars_total"] else 0}% |
| With section but no triggered questions (audit candidate — likely missed triggers) | {metrics["sidecars_empty_stress_section"]} | {round(100 * metrics["sidecars_empty_stress_section"] / metrics["sidecars_total"], 1) if metrics["sidecars_total"] else 0}% |

**Read this as:** the substantive question — *"can the operator trust this ontology?"*
— is answered by the **Total verified** row. Static enrichment coverage at 74%+
sidecars means 74% of nodes have a sidecar; it does NOT mean 74% of operator-observable
claims have been interrogated against the running system. The new metric makes the
gap visible. Backfilling pre-Stress-Protocol sidecars is the path to closing it.

## Informational (no denominator, no target)

- Features discovered: **{metrics["features_discovered"]}**
- Features with ≥1 test-matrix cell PROBED: **{metrics["features_with_at_least_one_cell_probed"]}**

## Integrity audit

- Sidecars referencing nodes NOT in substrate: {len(metrics["nodes_in_sidecar_but_not_in_substrate"])} (sample: {metrics["nodes_in_sidecar_but_not_in_substrate"]})
- feature-flow chains referencing nodes NOT in substrate: {len(metrics["nodes_in_feature_flow_but_not_in_substrate"])} (sample: {metrics["nodes_in_feature_flow_but_not_in_substrate"]})

Both lists should be empty in steady state. Non-empty → either the substrate
is stale (re-scan) or a sidecar / feature-flow references an obsolete ID.

The methodology never gates on "we know all the features"; it gates on the
**Stress Protocol verified percentage** reaching the maintainer's target.
The features_discovered count is monotonic and bounded by the platform's
real feature surface; the static-coverage axes are kept for trend continuity
but are no longer the headline metric (LSN-019).
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
        # LSN-019 — Stress Protocol axes (the honest metric).
        "stress_questions_total": metrics["stress_questions_total"],
        "stress_answers_static_inferred": metrics["stress_answers_static_inferred"],
        "stress_answers_probe_verified": metrics["stress_answers_probe_verified"],
        "stress_answers_probe_needed": metrics["stress_answers_probe_needed"],
        "stress_answers_reference": metrics["stress_answers_reference"],
        "stress_verified_pct": metrics["stress_verified_pct"],
        "stress_unanswered_pct": metrics["stress_unanswered_pct"],
        "sidecars_with_stress_section": metrics["sidecars_with_stress_section"],
        "sidecars_pre_stress_protocol": metrics["sidecars_pre_stress_protocol"],
        "sidecars_empty_stress_section": metrics["sidecars_empty_stress_section"],
        "computed_by": "lineage/_extractor/registry-shard/coverage.py",
        "schema": "feature-anchored-ontology.md rev 2 principle 8 + LSN-019 stress axis",
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
