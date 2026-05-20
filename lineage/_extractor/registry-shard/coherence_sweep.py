#!/usr/bin/env python3
"""Coherence sweep — post-batch cross-registry contradiction detector.

Per LSN-018 (cross-batch reducer contradiction): the reducers' dedup
protocol catches "do we already have this fact?" but NOT "does this fact
contradict what we already have?". This script runs as Phase 3 step 3.5
of /next-batch — enumerates artefacts created or strengthened THIS batch,
extracts named entities (table names, class names, file:line citations,
keyword anchors), greps the other four registries for occurrences, and
surfaces candidate contradictions for maintainer review BEFORE commit.

Output: state/coherence-sweep-batch-{N}.md
- Empty → no contradictions detected → batch commits as usual
- Non-empty → contradictions surfaced → maintainer reviews; either supersedes
  the old or corrects the new artefact before committing.

Design constraints:
- Bounded cost: O(batch-new × log registry-size) via grep-then-narrow-Read,
  same pattern as the reducer dedup protocol.
- No semantic NLP / vector store / LLM round-trips at the sweep layer —
  it's a syntactic anchor-overlap detector that surfaces CANDIDATES; the
  maintainer (or a future agent re-pass) decides if a candidate is a real
  contradiction.
- The signal source is BACK-LINK ABSENCE + ANCHOR OVERLAP: if artefact-A
  names entity-X and artefact-B names entity-X but neither back-links to
  the other, the sweep flags the pair for inspection.

Usage:
    python3 coherence_sweep.py --batch N --since-commit <ref>
    python3 coherence_sweep.py --batch N --all  # full sweep (slow; bootstrap mode)
"""
import argparse
import re
import sys
from pathlib import Path
from collections import defaultdict

# Discover paths relative to this script's location — matches the convention
# used by coverage.py and rebuild_indexes.py. No hardcoded absolute paths.
# Path layout: <WORKSPACE_ROOT>/lineage/_extractor/registry-shard/coherence_sweep.py
SCRIPT = Path(__file__).resolve()
LINEAGE_ROOT = SCRIPT.parents[2] / "odd-platform"   # <WS>/lineage/odd-platform
WORKSPACE_ROOT = SCRIPT.parents[3]                   # <WS>

REGISTRIES = {
    "feature-flows": ("F-", LINEAGE_ROOT / "feature-flows" / "detail"),
    "test-map": ("TEST-GAP-", LINEAGE_ROOT / "test-map" / "detail"),
    "doc-gaps": ("DOC-GAP-", LINEAGE_ROOT / "doc-gaps" / "detail"),
    "refactoring-scopes": ("REFACTOR-", LINEAGE_ROOT / "refactoring-scopes" / "detail"),
    "implicit-adrs": ("ADR-CANDIDATE-", LINEAGE_ROOT / "implicit-adrs" / "detail"),
    "concepts": ("", LINEAGE_ROOT / "concepts" / "detail"),
}

# Anchor patterns — strings whose appearance across artefacts likely indicates
# they're referring to the SAME thing. These are syntactic ID-shaped strings.
#
# Each pattern in HIGH_SPECIFICITY emits a multi-token identifier where false
# positives are rare ("HousekeepingJobManager"). LOW_SPECIFICITY adds looser
# matches (single capitalized words) that produce noisy candidates — gated by
# the --loose flag.
HIGH_SPECIFICITY = [
    # Compound camelCase class names with the well-known Spring/JOOQ suffixes
    # — minimum 2 capital-letter boundaries, so "Popular" alone won't match.
    re.compile(r"\b([A-Z][a-z]+(?:[A-Z][a-zA-Z]+){1,}(?:Repository|Service|Controller|Job|Manager|Properties|Handler|Filter|Helper|Extractor|Config|Bean|Builder)(?:Impl)?)\b"),
    # File paths with line numbers (the strongest possible anchor)
    re.compile(r"\b([A-Za-z][A-Za-z0-9_.]+\.(?:java|sql|yml|yaml|ts|tsx|tf|py)(?::\d+(?:-\d+)?)?)\b"),
    # Spring config keys with at least one dot
    re.compile(r"\b((?:housekeeping|odd|spring|server|management|security|notification)\.[a-z][a-z_.\-]*[a-z])\b"),
    # Pillar-anchored feature IDs
    re.compile(r"\b(P-\d{2}:F-\d{3})\b"),
    # Migration filenames
    re.compile(r"\b(V0_0_\d+__\w+\.sql)\b"),
    # Postgres table/column refs in `snake_case` form (4+ chars, must contain underscore)
    re.compile(r"\b([a-z][a-z_]{4,30}_[a-z]+)\b"),
]
LOW_SPECIFICITY = HIGH_SPECIFICITY + [
    re.compile(r"\b([A-Z][a-zA-Z]{4,})\b"),  # single capitalized word ≥5 chars (noisy)
]

ANCHOR_PATTERNS = HIGH_SPECIFICITY

# Anchor stoplist — common English words that match the patterns but are
# never real artefact anchors. Lowercase comparison.
ANCHOR_STOP = {
    # English / Postgres / methodology vocabulary — not real anchors
    "popular", "default", "current", "filter", "filters", "search", "facets",
    "request", "response", "entity", "owner", "tag", "term", "result",
    "config", "service", "policy", "policies", "role", "data",
    "create", "delete", "update", "insert", "select", "where", "context",
    "value", "values", "type", "level", "count", "total", "table", "column",
    # Methodology-vocabulary field names that show up everywhere
    "implicit_adrs", "feature_id", "node_id", "node_ids", "test_class",
    "pillar_id", "pillar_ids", "test_files_existing", "test_files_proposed",
    "test_gaps_related", "doc_gaps_related", "refactors_related",
    "related_features", "related_pillar_features", "related_test_gaps",
    "related_doc_gaps", "related_refactoring_scopes", "related_concepts",
    "related_adrs", "related_retrospectives", "related_probes",
    "uncovered_behaviour", "uncovered_behaviours", "covered_behaviours",
    "bugs_limitations_corner_cases", "performance", "security",
    "known_security_gaps", "known_performance_gaps", "upstream_callers",
    "downstream_side_effects", "data_entity", "data_entity_id",
    "test_matrix", "drift_class", "drift_class_summary",
    "pillar_anchored_id", "pillar_anchored_feature_name",
    "primary_drift_class", "control_summary",
    # Common Postgres tables / table-shaped words — too broad for anchor
    "data_entity", "data_source", "name_unique", "is_deleted",
}

# Negation patterns — phrases that assert ABSENCE of something. When a
# negation anchor overlaps with a positive assertion of the same entity in
# another artefact, that's the LSN-018 contradiction class.
NEGATION_PHRASES = [
    "no TTL", "NO TTL", "never implemented", "does NOT exist", "is not implemented",
    "has NO ", "has no ", "no row deletion", "no cleanup", "no archive",
    "no test", "NO test", "no entry", "NO entry", "not addressed",
    "no audit", "no rate-limit",
]

def extract_anchors(text, patterns=ANCHOR_PATTERNS):
    """Pull all anchor candidates from a text body. Returns set of (kind, value)."""
    anchors = set()
    for pat in patterns:
        for m in pat.finditer(text):
            v = m.group(1) if m.groups() else m.group(0)
            if len(v) >= 4 and v.lower() not in ANCHOR_STOP:
                anchors.add(("anchor", v))
    return anchors

def extract_negations(text):
    """Return list of (negation_phrase, surrounding_context_snippet)."""
    hits = []
    for phrase in NEGATION_PHRASES:
        idx = 0
        while True:
            i = text.find(phrase, idx)
            if i == -1:
                break
            ctx_start = max(0, i - 60)
            ctx_end = min(len(text), i + len(phrase) + 60)
            hits.append((phrase, text[ctx_start:ctx_end].replace("\n", " ")))
            idx = i + len(phrase)
    return hits

def load_artefact(path):
    """Read a YAML/MD artefact and return raw text. (We don't yaml.parse to
    keep the sweep robust against the broken-yaml class.)"""
    try:
        return path.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return ""

def collect_anchors_per_registry(patterns=ANCHOR_PATTERNS):
    """Build {registry: {artefact_id: (set_of_anchors, list_of_negations, has_backlinks)}}."""
    per_registry = {}
    for reg_name, (id_prefix, detail_dir) in REGISTRIES.items():
        per_registry[reg_name] = {}
        if not detail_dir.exists():
            continue
        for f in sorted(detail_dir.rglob("*.yaml")) + sorted(detail_dir.rglob("*.md")):
            artefact_id = f.stem
            text = load_artefact(f)
            if not text.strip():
                continue
            anchors = extract_anchors(text, patterns=patterns)
            negations = extract_negations(text)
            has_backlink_block = any(
                marker in text for marker in (
                    "related_features:", "related_pillar_features:",
                    "related_test_gaps:", "related_doc_gaps:",
                    "related_refactoring_scopes:", "related_adrs:",
                )
            )
            per_registry[reg_name][artefact_id] = {
                "path": f,
                "anchors": anchors,
                "negations": negations,
                "has_backlink_block": has_backlink_block,
                "text_len": len(text),
            }
    return per_registry

def find_candidate_contradictions(per_registry, focus_ids=None, local_window=150, anchor_patterns=ANCHOR_PATTERNS):
    """For each artefact, find other artefacts in other registries that
    share a meaningful anchor AND that anchor appears WITHIN the local
    window around a negation phrase on the LEFT side. Returns a list of
    candidate-pair dicts.

    Key signal-sharpening over a naive overlap sweep:
      - The shared anchor must appear within `local_window` chars of the
        negation phrase on the left side. Class names mentioned elsewhere
        in a 60KB sidecar don't count.
      - Skip same-registry pairs (those are dedup candidates, not coherence).
      - Existing back-link suppresses the candidate (already reconciled).
    """
    # Build anchor -> artefact reverse map across ALL registries.
    anchor_to_artefacts = defaultdict(list)
    for reg_name, artefacts in per_registry.items():
        for artefact_id, data in artefacts.items():
            for kind, value in data["anchors"]:
                anchor_to_artefacts[value].append((reg_name, artefact_id, data))

    findings = []
    seen_pairs = set()

    for reg_name, artefacts in per_registry.items():
        for artefact_id, data in artefacts.items():
            if focus_ids is not None and artefact_id not in focus_ids:
                continue
            if not data["negations"]:
                continue  # only inspect artefacts that ASSERT something absent
            left_text = load_artefact(data["path"])
            for neg_phrase, neg_ctx in data["negations"]:
                # Find the local window around THIS negation in the left text
                # and only count anchors that appear inside it.
                neg_idx = left_text.find(neg_phrase)
                if neg_idx == -1:
                    continue
                local_start = max(0, neg_idx - local_window)
                local_end = min(len(left_text), neg_idx + len(neg_phrase) + local_window)
                local_text = left_text[local_start:local_end]

                # Anchors appearing IN the local window
                local_anchors = set()
                for pat in anchor_patterns:
                    for m in pat.finditer(local_text):
                        v = m.group(1) if m.groups() else m.group(0)
                        if len(v) >= 4 and v.lower() not in ANCHOR_STOP:
                            local_anchors.add(v)

                # Cross-registry partners sharing one of those LOCAL anchors
                for anchor_value in local_anchors:
                    partners = anchor_to_artefacts.get(anchor_value, [])
                    for (other_reg, other_id, other_data) in partners:
                        if other_reg == reg_name:
                            continue  # dedup, not coherence
                        # Pair key dedupes left↔right vs right↔left
                        pair_key = (
                            tuple(sorted([f"{reg_name}/{artefact_id}", f"{other_reg}/{other_id}"])),
                            anchor_value,
                        )
                        if pair_key in seen_pairs:
                            continue
                        seen_pairs.add(pair_key)
                        # Existing back-link suppresses the candidate
                        other_text = load_artefact(per_registry[other_reg][other_id]["path"])
                        backlink_exists = (
                            artefact_id in other_text
                            or other_id in left_text
                        )
                        if backlink_exists:
                            continue  # already reconciled — don't pollute the report
                        findings.append({
                            "left": f"{reg_name}/{artefact_id}",
                            "left_path": str(data["path"].relative_to(WORKSPACE_ROOT)),
                            "right": f"{other_reg}/{other_id}",
                            "right_path": str(per_registry[other_reg][other_id]["path"].relative_to(WORKSPACE_ROOT)),
                            "shared_anchor": anchor_value,
                            "left_negation_phrase": neg_phrase,
                            "left_negation_context": neg_ctx,
                            "backlink_exists": False,
                        })
    return findings

def format_report(findings, batch_id):
    lines = [
        f"# Coherence sweep — batch {batch_id}",
        "",
        f"Mechanism: anchor-overlap + negation detection per LSN-018.",
        f"Output empty in steady state. Non-empty entries are CANDIDATES; the maintainer or a re-pass agent must decide if each is a real contradiction.",
        "",
        f"Total candidates: **{len(findings)}**",
        "",
    ]
    if not findings:
        lines.append("No coherence anomalies detected. Batch is clean for commit.")
        return "\n".join(lines) + "\n"

    # Group: backlink-missing first (highest signal), then backlink-present
    no_link = [f for f in findings if not f["backlink_exists"]]
    has_link = [f for f in findings if f["backlink_exists"]]

    if no_link:
        lines.append(f"## Candidates WITHOUT existing back-link ({len(no_link)})")
        lines.append("")
        lines.append("These pairs share a named entity AND the LEFT artefact asserts a NEGATION about it, but there's no back-link in either direction. **Inspect first** — this is the LSN-018 class.")
        lines.append("")
        for f in no_link[:200]:  # cap output for readability
            lines.append(f"### {f['left']} ←→ {f['right']}")
            lines.append(f"- **Shared anchor:** `{f['shared_anchor']}`")
            lines.append(f"- **Left negation:** \"{f['left_negation_phrase']}\" — context: `{f['left_negation_context'][:200]}`")
            lines.append(f"- **Left path:** {f['left_path']}")
            lines.append(f"- **Right path:** {f['right_path']}")
            lines.append("")
        if len(no_link) > 200:
            lines.append(f"... (truncated; {len(no_link) - 200} more candidates omitted from this report — increase cap if needed)")
            lines.append("")
    if has_link:
        lines.append(f"## Candidates WITH existing back-link ({len(has_link)}) — low priority")
        lines.append("")
        lines.append("Back-link already present so the maintainer has plausibly already reconciled. Spot-check if the back-link text addresses the negation.")
        lines.append("")
        for f in has_link[:50]:
            lines.append(f"- {f['left']} ←→ {f['right']} via `{f['shared_anchor']}` (neg: \"{f['left_negation_phrase']}\")")
        if len(has_link) > 50:
            lines.append(f"... ({len(has_link) - 50} more omitted)")

    return "\n".join(lines) + "\n"

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--batch", required=True, help="Batch ID (e.g. N, O, P) — used in output filename.")
    ap.add_argument("--focus-ids", nargs="*", default=None, help="Only sweep these artefact IDs (default: all).")
    ap.add_argument("--out", default=None, help="Output path (default: state/coherence-sweep-batch-{N}.md).")
    ap.add_argument("--loose", action="store_true", help="Include low-specificity anchor patterns (more candidates, more noise).")
    args = ap.parse_args()

    patterns = LOW_SPECIFICITY if args.loose else HIGH_SPECIFICITY

    print(f"=== coherence_sweep.py batch={args.batch} (anchors={'LOOSE' if args.loose else 'STRICT'}) ===")
    print("Loading registries...")
    per_registry = collect_anchors_per_registry(patterns=patterns)
    for reg, art_map in per_registry.items():
        print(f"  {reg}: {len(art_map)} artefacts")

    print("Sweeping anchor overlaps + negations...")
    findings = find_candidate_contradictions(per_registry, focus_ids=set(args.focus_ids) if args.focus_ids else None, anchor_patterns=patterns)
    print(f"  candidates: {len(findings)}")

    out_path = Path(args.out) if args.out else WORKSPACE_ROOT / "state" / f"coherence-sweep-batch-{args.batch}.md"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(format_report(findings, args.batch))
    try:
        rel = out_path.relative_to(WORKSPACE_ROOT)
    except ValueError:
        rel = out_path
    print(f"Wrote: {rel}")
    print(f"Status: {'CLEAN' if not findings else f'{len(findings)} CANDIDATES'}")
    sys.exit(0)

if __name__ == "__main__":
    main()
