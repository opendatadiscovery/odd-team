"""Alignment scorecard — the cross-corpus consistency dashboard.

A deterministic roll-up (NO LLM) over the already-derived ontology. It joins the
substrate + reducer outputs + ground-truth anchors and scores how well the
ontology bridges CODE <-> DOC <-> ADR <-> TEST, **bi-directionally**, then writes
a committed, diffable scorecard + a machine trend series.

It answers the maintainer's standing question — *"what is the level of
alignment, and what blocks us from building contract tests?"* The honest unit is
`aligned / checked / total`: a low contradiction count is reported as
"UNKNOWN over N%", never as "aligned", so the score cannot hide a blind spot
(the single largest failure mode — reflection has run on <1% of features).

This module does NOT re-derive anything. It reads what the reducers already
produced. The expensive agentic re-verification (sampling doc-claims, drift-
checking ADRs, re-firing reflect-feature) is the separate `--deep` mode.

References:
- adrs/drafts/ground-truth-lineage.md — Phase 4 Test layer (the unbuilt half).
- feedback_tests_as_deterministic_gates — every test gates an ontology relation;
  no orphan tests; bidirectional typed-rationale completeness (the Ledger).
- lineage/GRAPH-TOPOLOGY.md — the labels + edges this scorecard rolls up.
"""
from __future__ import annotations

import re
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from lineage_extractor.graph_query import config
from lineage_extractor.graph_query.loaders import load_substrate
from lineage_extractor.graph_query.projector import project

# --------------------------------------------------------------------------
# Grades — three bands. Conservative by construction: a dimension is graded as
# its WORST metric, and alignment-type metrics are capped (never GREEN) while
# the verification layer (reflection) has run on too little of the surface.

GREEN = "GREEN"
AMBER = "AMBER"
RED = "RED"
_ORDER = {GREEN: 2, AMBER: 1, RED: 0}

# Reflection coverage below this caps every "alignment" claim at AMBER and
# the readiness verdict below READY — absence of found drift is not alignment.
REFLECTION_TRUST_FLOOR = 0.5

# The four integrations the maintainer named for local e2e probes. Keyword
# groups are scanned over the probe corpus to report covered-vs-missing.
NAMED_INTEGRATIONS = {
    "great-expectations": ("great expectation", "great_expectation", "great-expectation", "expectations suite"),
    "airflow-lineage": ("airflow",),
    "postgres-ingestion": ("postgres collector", "postgresql collector", "database reflection", "datasource ingestion", "data source ingestion"),
    "webhook-notifications": ("webhook", "alertmanager", "slack alert", "notification dispatch", "notification delivery"),
}

# Typed-gate vocabulary for the Test-Traceability Ledger. Every test/TestGap must
# carry >=1 of these, each pointed at a real ontology subject, or it is `orphan`.
GATE_KINDS = ("enforces", "validates", "regresses", "guards")
_GATE_RE = re.compile(r"\b(enforces?|validates?|regress(?:es|ion)|guards?)\b", re.I)
_ADR_REF = re.compile(r"\bADR-\d{2,4}\b")          # published ADR-0040 (not ADR-CANDIDATE)
_FEATURE_REF = re.compile(r"\bF-\d{2,4}\b")
_REFACTOR_REF = re.compile(r"\bREFACTOR-\d+\b", re.I)
_FINDING_REF = re.compile(r"\b(?:PLT-\d+|SEC-\d+|PERF-\d+|#\d+)\b")
# The two flagship production landmines that MUST have a regression gate.
_LANDMINE_RE = re.compile(
    r"attachment.{0,30}(?:ephemeral|in.?memory|storage default|tmp|local)"
    r"|(?:minio|s3).{0,30}region|region.{0,30}(?:minio|s3|unset|builder)",
    re.I,
)


# --------------------------------------------------------------------------
# Result records


@dataclass
class Metric:
    """One measured fact. `aligned/checked/total` is the honest unit; `aligned`
    is None for pure census metrics (counts that aren't a ratio)."""

    key: str
    label: str
    aligned: int | None
    checked: int
    total: int
    grade: str
    note: str = ""

    @property
    def ratio(self) -> float:
        if self.aligned is None or self.total == 0:
            return 0.0
        return self.aligned / self.total

    def line(self) -> str:
        if self.aligned is None:
            frac = f"{self.checked}"
        else:
            frac = f"{self.aligned}/{self.total}"
            if self.checked != self.total:
                frac += f" (checked {self.checked})"
        n = f"  — {self.note}" if self.note else ""
        return f"{self.grade:5}  {self.label}: {frac}{n}"


@dataclass
class Dimension:
    key: str
    title: str
    metrics: list[Metric] = field(default_factory=list)
    note: str = ""

    @property
    def grade(self) -> str:
        if not self.metrics:
            return AMBER
        return min((m.grade for m in self.metrics), key=lambda g: _ORDER[g])


@dataclass
class Scorecard:
    repo: str
    generated_at: str
    readiness: str
    blockers: list[str]
    ready_now: list[str]
    trust: list[Metric]
    dimensions: list[Dimension]
    actions: list[str]
    flat: dict[str, Any]  # machine metrics for the trend series


# --------------------------------------------------------------------------
# Helpers


def _grade_ratio(r: float, green: float = 0.8, amber: float = 0.4) -> str:
    if r >= green:
        return GREEN
    if r >= amber:
        return AMBER
    return RED


def _cap(grade: str, ceiling: str) -> str:
    return grade if _ORDER[grade] <= _ORDER[ceiling] else ceiling


def _mget(manifest: Any, key: str, default: Any = None) -> Any:
    if isinstance(manifest, dict):
        return manifest.get(key, default)
    return getattr(manifest, key, default)


def _git_head(repo_path: Path) -> str:
    try:
        out = subprocess.run(
            ["git", "-C", str(repo_path), "rev-parse", "--short", "HEAD"],
            capture_output=True, text=True, timeout=10,
        )
        return out.stdout.strip() if out.returncode == 0 else ""
    except Exception:
        return ""


def _git_head_date(repo_path: Path) -> str:
    try:
        out = subprocess.run(
            ["git", "-C", str(repo_path), "log", "-1", "--format=%ci"],
            capture_output=True, text=True, timeout=10,
        )
        return out.stdout.strip()[:10] if out.returncode == 0 else ""
    except Exception:
        return ""


def _read_yaml(path: Path) -> dict:
    if not path.is_file():
        return {}
    try:
        from ruamel.yaml import YAML
        with path.open() as fh:
            data = YAML(typ="safe").load(fh)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _iter_testgap_texts(lineage_dir: Path) -> list[tuple[str, str]]:
    """Raw TestGap detail texts, scanned in FULL — the projected `body` keeps only
    behaviour+evidence+proposed_action and drops `cross_references`, where gate
    keywords live. The ledger must see the whole file."""
    detail = lineage_dir / "test-map" / "detail"
    if not detail.is_dir():
        return []
    out: list[tuple[str, str]] = []
    for p in sorted(detail.glob("TEST-GAP-*.yaml")):
        try:
            out.append((p.stem, p.read_text(errors="ignore")))
        except OSError:
            continue
    return out


def _edges_of_type(graph: Any, etype: str) -> list[tuple[str, str]]:
    """All (src_key, dst_key) for one edge type, each counted once (out-side)."""
    out: list[tuple[str, str]] = []
    for label in graph.label_counts():
        for key in graph.keys_by_label(label):
            for direction, t, other in graph.edges_of(key):
                if direction == "out" and t == etype:
                    out.append((key, other))
    return out


def _has_in_edge(graph: Any, key: str, etype: str) -> bool:
    return any(d == "in" and t == etype for d, t, _o in graph.edges_of(key))


def _scan_gates(text: str) -> dict[str, list[str]]:
    """Extract typed gate targets from a test/TestGap body. Returns
    {kind: [target,...]} for the kinds whose keyword co-occurs with a target ref.
    A gap with an empty result is an `orphan` (no typed rationale)."""
    found: dict[str, list[str]] = {}
    if not _GATE_RE.search(text or ""):
        return found
    refs = {
        "enforces": _ADR_REF.findall(text),
        "validates": _FEATURE_REF.findall(text),
        "regresses": _FINDING_REF.findall(text) + (["LANDMINE"] if _LANDMINE_RE.search(text) else []),
        "guards": _REFACTOR_REF.findall(text),
    }
    for kind, targets in refs.items():
        if targets:
            found[kind] = sorted(set(targets))
    return found


# --------------------------------------------------------------------------
# The computation


def compute(lineage_dir: Path, workspace_root: Path, repo: str, repo_path: Path) -> Scorecard:
    """Build the alignment scorecard for `repo` from its canonical files NOW
    (a fresh load_substrate + project — independent of when graph-build last ran)."""
    sub = load_substrate(lineage_dir)
    g = project(sub)
    labels = g.label_counts()

    manifest = _read_yaml(lineage_dir / "manifest.yaml")
    build_info = _read_yaml(config.graph_dir(lineage_dir) / config.BUILD_INFO_FILENAME)
    doc_manifest = _read_yaml(lineage_dir / "documentation" / "_manifest.yaml")

    from lineage_extractor.manifest import today_iso
    generated_at = today_iso()

    # --- node sets -------------------------------------------------------
    real_code_ids = {c.node_id for c in sub.code_nodes}
    testgap_texts = _iter_testgap_texts(lineage_dir)
    features = g.keys_by_label(config.L_FEATURE)
    feature_count = len(features)
    reflection_count = labels.get(config.L_FEATURE_REFLECTION, 0)
    reflection_cov = reflection_count / feature_count if feature_count else 0.0

    flat: dict[str, Any] = {}

    # --- E — TRUST META-GATE (computed first; it discounts the rest) -----
    trust: list[Metric] = []
    head = _git_head(repo_path)
    last_commit = str(_mget(manifest, "last_scan_commit", "") or "")
    substrate_current = bool(head) and (head[:7] == last_commit[:7] or last_commit.startswith(head) or head.startswith(last_commit))
    trust.append(Metric(
        "E1.substrate", "substrate scan == code HEAD",
        1 if substrate_current else 0, 1, 1,
        GREEN if substrate_current else RED,
        f"scan {last_commit or '?'} @ {_mget(manifest, 'last_scan_date', '?')} · HEAD {head or '?'} @ {_git_head_date(repo_path) or '?'}",
    ))
    emb = bool(build_info.get("embeddings_available"))
    trust.append(Metric(
        "E2.embeddings", "graph embeddings present", 1 if emb else 0, 1, 1,
        GREEN if emb else AMBER,
        f"built {build_info.get('built_at', '?')} · vectors {build_info.get('vector_count', 0)}"
        + ("" if emb else " — semantic queries degraded; rebuild without --no-embeddings"),
    ))
    panel_verdict = _latest_panel_verdict(lineage_dir)
    trust.append(Metric(
        "E3.panel", "latest /panel verdict", None, 0, 0,
        GREEN if panel_verdict == "accept" else AMBER,
        panel_verdict or "no meta-review found",
    ))
    trust.append(Metric(
        "E4.reflection", "reflection coverage (alignment discount)",
        reflection_count, reflection_count, feature_count,
        _grade_ratio(reflection_cov, 0.5, 0.2),
        f"{reflection_count}/{feature_count} features reflected → alignment UNKNOWN over "
        f"{100 * (1 - reflection_cov):.0f}% of features",
    ))
    flat["reflection_coverage"] = round(reflection_cov, 4)
    contradictions = sum(
        int(r.props.get("contradiction_count") or 0)
        for r in sub.reducer_nodes if r.label == config.L_FEATURE_REFLECTION
    )
    trust.append(Metric(
        "E5.contradictions", "intent↔impl contradictions surfaced", None, contradictions, contradictions,
        AMBER if contradictions else GREEN,
        f"{contradictions} contradictions across {reflection_count} reflected features — the deepest "
        f"alignment-drift findings; triage feature-reflections/detail/ (HIGH → bug-fix or operator caveat)",
    ))
    flat["contradictions"] = contradictions
    flat["substrate_current"] = substrate_current
    flat["embeddings_available"] = emb
    flat["panel_verdict"] = panel_verdict
    alignment_ceiling = GREEN if reflection_cov >= REFLECTION_TRUST_FLOOR else AMBER

    dims: list[Dimension] = []

    # --- A — ONTOLOGY <-> CODE ------------------------------------------
    a = Dimension("A", "Ontology ↔ Code fidelity")
    enriched = labels.get(config.L_SIDECAR, 0)
    code_total = len(real_code_ids)
    a.metrics.append(Metric(
        "A1.enrichment", "code nodes enriched (selective)", enriched, enriched, code_total,
        AMBER,  # selective by design — coverage_pct is a secondary metric (README)
        f"{enriched}/{code_total} nodes have a sidecar — enrichment is entry-point-selective, not a defect on its own",
    ))
    declared_axes = set((_mget(manifest, "axes", {}) or {}).keys())
    sidecar_axes = [s.frontmatter.get("axis") for s in sub.sidecars if s.frontmatter.get("axis")]
    informal = sorted({ax for ax in sidecar_axes if ax not in declared_axes})
    in_axis = sum(1 for ax in sidecar_axes if ax in declared_axes)
    a.metrics.append(Metric(
        "A2.axis_integrity", "sidecar axis ∈ substrate axes",
        in_axis, len(sidecar_axes), len(sidecar_axes),
        _grade_ratio(in_axis / len(sidecar_axes) if sidecar_axes else 1.0),
        f"{len(informal)} informal axis labels not declared in substrate"
        + (f" (e.g. {', '.join(informal[:4])})" if informal else ""),
    ))
    flat["enrichment"] = f"{enriched}/{code_total}"
    flat["informal_axes"] = len(informal)
    dims.append(a)

    # --- B — ONTOLOGY <-> DOC (bi-directional) --------------------------
    b = Dimension("B", "Ontology ↔ Doc (bi-directional)")
    describes_to_code = [(s, d) for s, d in _edges_of_type(g, config.E_DESCRIBES) if d.startswith("code::")]
    resolved = sum(1 for _s, d in describes_to_code if d[len("code::"):] in real_code_ids)
    dtc_total = len(describes_to_code)
    b.metrics.append(Metric(
        "B1.doc_to_code", "doc claims resolving to real code (fwd)",
        resolved, dtc_total, dtc_total,
        _cap(_grade_ratio(resolved / dtc_total if dtc_total else 1.0), alignment_ceiling),
        "DESCRIBES→CodeNode landing on a real (non-stub) node — 'if docs claim it, code exists'",
    ))
    feat_documented = sum(1 for fk in features if _has_in_edge(g, fk, config.E_DESCRIBES))
    b.metrics.append(Metric(
        "B2.code_to_doc", "features documented (reverse)",
        feat_documented, feature_count, feature_count,
        _cap(_grade_ratio(feat_documented / feature_count if feature_count else 0.0), alignment_ceiling),
        "features with an inbound DESCRIBES — 'if implemented, it is documented'",
    ))
    doc_gaps = [r for r in sub.reducer_nodes if r.label == config.L_DOC_GAP]
    crit_doc = sum(1 for r in doc_gaps if str(r.props.get("severity", r.props.get("criticality", ""))).upper() in ("CRITICAL", "HIGH"))
    b.metrics.append(Metric(
        "B3.doc_drift", "open doc gaps (lower better)", None, len(doc_gaps), len(doc_gaps),
        RED if crit_doc else (AMBER if doc_gaps else GREEN),
        f"{len(doc_gaps)} open DocGap ({crit_doc} critical/high)",
    ))
    drifted = sum(1 for d in sub.doc_nodes if d.drifted)
    complete = bool((doc_manifest.get("completeness") or {}).get("complete"))
    b.metrics.append(Metric(
        "B4.doc_freshness", "doc nodes not drifted",
        len(sub.doc_nodes) - drifted, len(sub.doc_nodes), len(sub.doc_nodes),
        GREEN if (drifted == 0 and complete) else AMBER,
        f"{drifted} drifted · SUMMARY completeness={'complete' if complete else 'incomplete'}",
    ))
    flat["doc_to_code_resolved"] = f"{resolved}/{dtc_total}"
    flat["features_documented"] = f"{feat_documented}/{feature_count}"
    flat["open_doc_gaps"] = len(doc_gaps)
    dims.append(b)

    # --- C — ONTOLOGY <-> ADR -------------------------------------------
    c = Dimension("C", "Ontology ↔ ADR")
    published = _published_adr_ids(workspace_root)
    ingested = labels.get(config.L_ADR, 0)
    c.metrics.append(Metric(
        "C1.adr_ingested", "published ADRs ingested as nodes",
        ingested, ingested, len(published) or ingested,
        _grade_ratio(ingested / len(published) if published else 1.0),
        f"{ingested} ADR nodes vs {len(published)} published pages — re-run adrs-ingest + graph-build",
    ))
    adr_keys = g.keys_by_label(config.L_ADR)
    realised = sum(1 for ak in adr_keys if _has_in_edge(g, ak, config.E_REALISES))
    rj_adrs, rj_nodeid, rj_prose = _realises_join_health(workspace_root)
    rj_note = (
        f"; join broken: {rj_prose}/{rj_nodeid + rj_prose} backlog realises entries are prose "
        f"citations not substrate node-ids → not projected as edges"
    ) if rj_prose and rj_prose > rj_nodeid else ""
    c.metrics.append(Metric(
        "C2.realises", "ADRs with a REALISES code link",
        realised, ingested, len(published) or ingested,
        RED if (len(published) and realised / len(published) < 0.4) else AMBER,
        f"{realised} of {ingested} ingested have REALISES; effective {realised}/{len(published)} vs published{rj_note}",
    ))
    implicit = labels.get(config.L_IMPLICIT_ADR, 0)
    promoted = len(_edges_of_type(g, config.E_PROMOTED_TO))
    c.metrics.append(Metric(
        "C3.candidates", "ImplicitADR candidates (disposition)", None, implicit, implicit,
        AMBER,
        f"{implicit} candidates · {promoted} promoted (1:1 promotion NOT required — wisdom test governs)",
    ))
    flat["adr_ingested"] = f"{ingested}/{len(published)}"
    flat["adr_realises"] = realised
    flat["realises_prose_vs_nodeid"] = f"{rj_prose}:{rj_nodeid}"
    dims.append(c)

    # --- D — TEST-TRACEABILITY LEDGER (the centrepiece) -----------------
    d = Dimension("D", "Test-Traceability Ledger")
    # Ledger: scan every TestGap for a typed gate; collect anchored subjects.
    gated = 0
    enforced_adrs: set[str] = set()
    validated_features: set[str] = set()
    regressed_subjects: set[str] = set()
    guarded_scopes: set[str] = set()
    landmine_gated = False
    for _entry_id, text in testgap_texts:
        gates = _scan_gates(text)
        if gates:
            gated += 1
        enforced_adrs.update(gates.get("enforces", []))
        validated_features.update(gates.get("validates", []))
        regs = gates.get("regresses", [])
        regressed_subjects.update(regs)
        if "LANDMINE" in regs:
            landmine_gated = True
        guarded_scopes.update(gates.get("guards", []))
    tg_total = len(testgap_texts)
    landmine_gaps = [eid for eid, text in testgap_texts if _LANDMINE_RE.search(text)]

    # Real Test nodes (Phase-4 ingest) + their ground-truth edges. The "no orphan
    # tests" rule applies to EXISTING tests first — a test in the suite with no
    # typed gate cannot tell you what breaks when it goes red.
    test_keys = g.keys_by_label(config.L_TEST)
    test_count = len(test_keys)
    covers_edges = len(_edges_of_type(g, config.E_COVERS))
    enforced_adrs_real = {g.get(dk).node_id for _s, dk in _edges_of_type(g, config.E_ENFORCES) if g.get(dk)}
    validated_feats_real = {g.get(dk).node_id for _s, dk in _edges_of_type(g, config.E_VALIDATES) if g.get(dk)}
    regresses_edges = len(_edges_of_type(g, config.E_REGRESSES))
    orphan_tests_real = sum(1 for k in test_keys if not (g.get(k).props.get("gates_total") or 0))
    enforced_all = enforced_adrs | enforced_adrs_real
    validated_all = validated_features | validated_feats_real

    d.metrics.append(Metric(
        "D0.test_layer", "Test nodes ingested (+ COVERS to code)",
        covers_edges, test_count, test_count,
        GREEN if covers_edges else (AMBER if test_count else RED),
        f"{test_count} existing tests ingested · {covers_edges} COVERS edges resolved to substrate code"
        + ("" if test_count else " — Phase-4 Test layer NOT built (run tests-ingest)")
        + (" — 0 resolve: substrate is axis-selective (services/repos aren't code nodes) "
           "and test names don't all map to a descriptor" if test_count and not covers_edges else ""),
    ))
    total_units = test_count + tg_total
    gated_units = (test_count - orphan_tests_real) + gated
    d.metrics.append(Metric(
        "D1.no_orphans", "tests/gaps carrying a typed gate (why)",
        gated_units, total_units, total_units,
        _grade_ratio(gated_units / total_units if total_units else 1.0),
        f"{orphan_tests_real}/{test_count} EXISTING tests are ORPHAN (no typed gate → add "
        f"@enforces/@validates/@regresses); {tg_total - gated}/{tg_total} gaps orphan (lenient match)",
    ))
    d.metrics.append(Metric(
        "D2.adr_alignment", "ADRs with an enforcing test/gap",
        len(enforced_all), len(enforced_all), len(published) or 1,
        RED if not enforced_all else AMBER,
        f"are we checking ADR ALIGNMENT? {len(enforced_all)}/{len(published)} ADRs gated "
        f"({len(enforced_adrs_real)} via real ENFORCES edge, rest via gated gaps)",
    ))
    d.metrics.append(Metric(
        "D3.functionality", "features with a validating test/gap",
        len(validated_all), len(validated_all), feature_count,
        RED if not validated_all else AMBER,
        f"are we checking FUNCTIONALITY? {len(validated_all)}/{feature_count} features gated "
        f"({len(validated_feats_real)} via real VALIDATES edge)",
    ))
    finding_total = labels.get(config.L_FINDING, 0) + labels.get(config.L_REFACTOR_SCOPE, 0)
    d.metrics.append(Metric(
        "D4.regression", "bugs/scopes with a regress/guard test",
        len(regressed_subjects) + len(guarded_scopes), len(regressed_subjects) + len(guarded_scopes), finding_total,
        RED if not (regressed_subjects or guarded_scopes) else AMBER,
        f"are we checking REGRESSION? {len(regressed_subjects) + len(guarded_scopes)}/{finding_total} findings/scopes gated"
        + (f" · LSN-001/002 landmines captured as {len(landmine_gaps)} gated TestGaps but NO regression test authored yet"
           if landmine_gated else " · LSN-001/LSN-002 landmines UNGATED (critical)"),
    ))
    # Probe execution + named integrations
    probes_defined = len(list((lineage_dir / "probes").glob("*.yaml"))) if (lineage_dir / "probes").is_dir() else 0
    # Count DISTINCT probe-ids that have a run artefact — NOT the number of run
    # files. Counting files lets a re-run of the same probe inflate the metric;
    # the honest signal is "how many distinct probes have ever executed".
    _run_ids: set[str] = set()
    _prd = lineage_dir / "probe-runs"
    if _prd.is_dir():
        for _f in _prd.glob("*.yaml"):
            _m = re.search(r"\bP-\d+\b", _f.name)
            if _m:
                _run_ids.add(_m.group(0))
    probe_runs = len(_run_ids)
    stacks_dir = workspace_root / "lineage" / "_extractor" / "probe-stacks"
    stack_count = len(list(stacks_dir.glob("*.docker-compose.yml"))) if stacks_dir.is_dir() else 0
    integ_covered, integ_detail = _named_integration_coverage(lineage_dir)
    d.metrics.append(Metric(
        "D5.probe_exec", "probes executed / defined", probe_runs, probe_runs, probes_defined,
        _grade_ratio(probe_runs / probes_defined if probes_defined else 0.0, 0.5, 0.1),
        f"{probe_runs}/{probes_defined} run · {stack_count} probe-stack(s) · named-integration keyword hits "
        f"{integ_covered}/4 ({integ_detail}) — KEYWORD scan, NOT verified e2e",
    ))
    test_layer_built = test_count > 0
    flat["test_layer_built"] = test_layer_built
    flat["test_nodes"] = test_count
    flat["covers_edges"] = covers_edges
    flat["orphan_tests"] = f"{orphan_tests_real}/{test_count}"
    flat["testgaps_gated"] = f"{gated}/{tg_total}"
    flat["adr_enforced"] = f"{len(enforced_all)}/{len(published)}"
    flat["adr_enforced_real_edges"] = len(enforced_adrs_real)
    flat["features_validated"] = f"{len(validated_all)}/{feature_count}"
    flat["landmine_gated"] = landmine_gated
    flat["landmine_gaps"] = len(landmine_gaps)
    flat["probes"] = f"{probe_runs}/{probes_defined}"
    flat["probe_stacks"] = stack_count
    flat["named_integrations_keyword"] = f"{integ_covered}/4"
    dims.append(d)

    # --- readiness verdict + ready-now subset + actions -----------------
    # REFLECTED_BY is Feature->FeatureReflection; a reflected feature has it as an
    # OUT edge. Direction-agnostic match is safe (the edge only attaches to features).
    ready_now = [
        g.get(fk).node_id for fk in features
        if any(t == config.E_REFLECTED_BY for _d, t, _o in g.edges_of(fk))
    ]
    blockers = []
    if not test_layer_built:
        blockers.append("[D] Phase-4 Test layer unbuilt (0 Test nodes — run tests-ingest)")
    elif orphan_tests_real == test_count and not enforced_all:
        blockers.append(f"[D] Test layer built ({test_count} nodes) but every test is ORPHAN + 0 ADRs enforced — gates not yet authored")
    if reflection_cov < REFLECTION_TRUST_FLOOR:
        blockers.append(f"[E] reflection {reflection_count}/{feature_count} → alignment unverified at scale")
    if not substrate_current:
        blockers.append("[A] substrate scan behind code HEAD")
    if len(published) and ingested / len(published) < 0.5:
        blockers.append(f"[C] {len(published) - ingested} published ADRs not ingested")

    if not test_layer_built:
        readiness = "NOT-READY"
    elif reflection_cov < REFLECTION_TRUST_FLOOR or any(dd.grade == RED for dd in dims):
        readiness = "PILOT-READY"
    else:
        readiness = "READY"

    actions = _actions(
        test_layer_built, orphan_tests_real, test_count, landmine_gaps,
        len(published), ingested, emb, reflection_count, feature_count,
        stack_count, gated, tg_total,
    )

    return Scorecard(
        repo=repo, generated_at=generated_at, readiness=readiness,
        blockers=blockers, ready_now=ready_now, trust=trust,
        dimensions=dims, actions=actions, flat=flat,
    )


def _actions(test_built, orphan_tests, test_count, landmine_gaps, published, ingested, emb,
             refl, feats, stack_count, gated, tg_total) -> list[str]:
    out: list[str] = []
    if not test_built:
        out.append("Build Phase-4 Test layer — run tests-ingest to project existing tests as Test nodes + enable the gate edges")
    elif orphan_tests:
        out.append(f"Annotate the {orphan_tests}/{test_count} ORPHAN existing tests with @enforces/@validates/@regresses gates — the Test layer is built but no test is yet wired to a decision/feature/bug")
    if landmine_gaps:
        tail = "…" if len(landmine_gaps) > 5 else ""
        out.append(f"Author the landmine regression tests WITH @regresses gates ({', '.join(landmine_gaps[:5])}{tail}) — LSN-001/002 pins, project as REGRESSES edges [CRITICAL]")
    if published and ingested < published:
        out.append(f"Re-run adrs-ingest + graph-build — {published - ingested} published ADRs are not yet graph nodes (unblocks C2 enforcement)")
    if not feats or refl / feats < REFLECTION_TRUST_FLOOR:
        out.append(f"Raise reflection coverage on ADR-bearing features ({refl}/{feats}) — the layer that proves alignment")
    if stack_count <= 1:
        out.append("GE / Airflow / Postgres-ingestion / webhooks have no dedicated probe stack (only odd-minimal: postgres+platform) → add multi-service stacks + regresses/validates-gated TestGaps")
    if tg_total and gated / tg_total < 0.8:
        out.append(f"Backfill typed gates on {tg_total - gated} orphan TestGaps (the test-coverage-mapper should emit a `gates:` block)")
    if not emb:
        out.append("Rebuild graph WITH embeddings (currently off) — restores semantic retrieval for /retrieve + deep mode")
    return out


_NODEID_SHAPE = re.compile(r"^\S+ (?:java|ts|py|python|yaml|go|sql)\b")


def _frontmatter(text: str) -> dict:
    if not text.startswith("---"):
        return {}
    end = text.find("\n---", 3)
    if end < 0:
        return {}
    try:
        from ruamel.yaml import YAML
        return YAML(typ="safe").load(text[3:end]) or {}
    except Exception:
        return {}


def _realises_join_health(workspace_root: Path) -> tuple[int, int, int]:
    """Classify backlog ADR `realises:` entries as node-id-shaped (→ projectable
    as a REALISES edge) vs prose citation (→ filed as realises_external text,
    never an edge). Returns (adrs_with_realises, node_id_entries, prose_entries).
    This is WHY a REALISES count can be ~0 despite every ADR citing code."""
    base = workspace_root / "backlog" / "adr"
    if not base.is_dir():
        return (0, 0, 0)
    adrs_with = node_shaped = prose = 0
    for p in base.glob("ADR-*.md"):
        entries = _frontmatter(p.read_text(errors="ignore")).get("realises") or []
        entries = [str(e) for e in entries] if isinstance(entries, list) else []
        if entries:
            adrs_with += 1
        for e in entries:
            if _NODEID_SHAPE.match(e.strip()):
                node_shaped += 1
            else:
                prose += 1
    return adrs_with, node_shaped, prose


def _published_adr_ids(workspace_root: Path) -> set[str]:
    """The ratified ADR set — published pages in the documentation manual."""
    try:
        from lineage_extractor.repo import resolve_repo_path
        doc_repo = resolve_repo_path(workspace_root, "documentation")
    except Exception:
        doc_repo = workspace_root.parent / "documentation"
    base = doc_repo / "docs" / "developer-guides" / "architecture-decision-log"
    if not base.is_dir():
        return set()
    return {"-".join(p.stem.split("-")[:2]) for p in base.glob("ADR-*.md")}


def _latest_panel_verdict(lineage_dir: Path) -> str:
    base = lineage_dir / "meta-reviews"
    if not base.is_dir():
        return ""
    reviews = sorted((p for p in base.glob("*/review.md")), reverse=True)
    if not reviews:
        return ""
    head = reviews[0].read_text(errors="ignore")[:600]
    m = re.search(r"verdict:\s*([a-z-]+)", head)
    return m.group(1) if m else ""


def _named_integration_coverage(lineage_dir: Path) -> tuple[int, str]:
    """Scan the probe corpus for each named integration; return (covered, detail)."""
    blob = ""
    for sub in ("probes", "probe-runs"):
        d = lineage_dir / sub
        if d.is_dir():
            for p in d.glob("*.yaml"):
                blob += p.read_text(errors="ignore").lower() + "\n"
    covered = []
    for name, kws in NAMED_INTEGRATIONS.items():
        hit = any(kw in blob for kw in kws)
        covered.append(name if hit else f"~{name}")
    n = sum(1 for c in covered if not c.startswith("~"))
    detail = ", ".join(c.replace("~", "✗") for c in covered)
    return n, detail


# --------------------------------------------------------------------------
# Rendering


def render_markdown(sc: Scorecard) -> str:
    L: list[str] = []
    L.append(f"# Alignment scorecard — {sc.repo}")
    L.append("")
    L.append(f"_generated {sc.generated_at} · `lineage-extractor alignment {sc.repo}` · deterministic roll-up, no LLM_")
    L.append("")
    icon = {"NOT-READY": "⛔", "PILOT-READY": "🟡", "READY": "✅"}.get(sc.readiness, "❔")
    L.append(f"## Contract-test readiness: {icon} {sc.readiness}")
    L.append("")
    if sc.blockers:
        L.append("**Blockers:**")
        for blk in sc.blockers:
            L.append(f"- {blk}")
        L.append("")
    L.append(f"**Ready-now subset** (contract-testable today — reflected + bridged): "
             + (", ".join(sc.ready_now) if sc.ready_now else "_none yet_"))
    L.append("")
    L.append("## Trust gate")
    L.append("")
    L.append("> Is this scorecard itself trustworthy? Every alignment metric below is discounted by reflection coverage.")
    L.append("")
    for m in sc.trust:
        L.append(f"- `{m.grade}` {m.label} — {m.note}")
    L.append("")
    L.append("## Dimensions")
    L.append("")
    L.append("| Dim | Grade | Title |")
    L.append("|---|---|---|")
    for dim in sc.dimensions:
        L.append(f"| {dim.key} | {dim.grade} | {dim.title} |")
    L.append("")
    for dim in sc.dimensions:
        L.append(f"### {dim.key} — {dim.title}  ({dim.grade})")
        L.append("")
        for m in dim.metrics:
            L.append(f"- `{m.grade}` **{m.label}** — {m.aligned if m.aligned is not None else m.checked}"
                     + (f"/{m.total}" if m.aligned is not None else "")
                     + f" · {m.note}")
        L.append("")
    L.append("## Top actionable items")
    L.append("")
    for i, act in enumerate(sc.actions, 1):
        L.append(f"{i}. {act}")
    L.append("")
    L.append("---")
    L.append("_Machine metrics + trend: `alignment-scorecard.yaml`. "
             "Deep contract audit (sampled, agentic): `lineage-extractor alignment "
             f"{sc.repo} --deep` (phase 2)._")
    L.append("")
    return "\n".join(L)


def render_yaml_payload(sc: Scorecard, prior: dict) -> dict:
    trend = list(prior.get("trend", [])) if isinstance(prior.get("trend"), list) else []
    row = {"date": sc.generated_at, "readiness": sc.readiness, **sc.flat}
    # One row per run-date (latest wins) — same-day reruns refresh, never pile up.
    trend = [r for r in trend if r.get("date") != row["date"]]
    trend.append(row)
    trend = trend[-50:]
    return {
        "repo": sc.repo,
        "generated_at": sc.generated_at,
        "readiness": sc.readiness,
        "blockers": sc.blockers,
        "ready_now": sc.ready_now,
        "dimensions": {d.key: {"grade": d.grade, "title": d.title,
                               "metrics": {m.key: m.line() for m in d.metrics}}
                       for d in sc.dimensions},
        "trust": {m.key: m.line() for m in sc.trust},
        "actions": sc.actions,
        "metrics": sc.flat,
        "trend": trend,
    }


def write_scorecard(lineage_dir: Path, sc: Scorecard) -> tuple[Path, Path]:
    md_path = lineage_dir / "alignment-scorecard.md"
    yaml_path = lineage_dir / "alignment-scorecard.yaml"
    prior = _read_yaml(yaml_path)
    md_path.write_text(render_markdown(sc))
    from ruamel.yaml import YAML
    yaml = YAML()
    yaml.indent(mapping=2, sequence=4, offset=2)
    with yaml_path.open("w") as fh:
        yaml.dump(render_yaml_payload(sc, prior), fh)
    return md_path, yaml_path
