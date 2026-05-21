"""Probe harness — score the graph query layer against the maintainer gold set.

Implements PROBES family 1 (retrieval quality) + a family-2 bounded-context
check. Reads `lineage/{repo}/query-gold-set.yaml`, runs every authored query
through `GraphQuery`, scores it by its declared metric (recall@k / MRR /
nDCG@k / exact-set), aggregates per query class, and checks the absolute
floors from the PROBES thresholds table.

The harness is the mechanics; the gold set is maintainer-authored. Until the
gold set is authored the harness reports `gold-set-not-authored` and exits
clean — the query layer runs in shadow mode regardless (ADR §Validation).
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from pathlib import Path

from ruamel.yaml import YAML

from lineage_extractor.graph_query import config
from lineage_extractor.graph_query.graph_query import GraphQuery

_yaml = YAML(typ="safe")

# Absolute floors (PROBES.md thresholds table). A class clears the gate when
# its mean metric is >= the floor (and, separately, >= the grep baseline —
# the baseline comparison is a maintainer-run step, noted in the report).
FLOORS = {
    "feature-locate": ("mrr", 0.75),
    "dedup-nearest": ("mrr", 0.75),
    "depends-on": ("recall", 0.90),
    "concept-discuss": ("recall", 0.90),
    "impact-of-change": ("ndcg", 0.80),
    "cross-axis-join": ("exact", 1.00),
}


@dataclass
class GoldQuery:
    id: str
    question: str
    intent: str
    metric: str
    answer_set: list[dict]
    status: str = "authored"


@dataclass
class ProbeReport:
    status: str
    scored_count: int = 0
    per_class: dict = field(default_factory=dict)      # class -> {mean, floor, pass, queries}
    payload_ceiling_breaches: int = 0
    overall_pass: bool = False
    notes: list[str] = field(default_factory=list)


# --------------------------------------------------------------------------
# Metrics


def recall_at_k(retrieved: list[str], answer: set[str], k: int) -> float:
    if not answer:
        return 1.0
    return len(answer & set(retrieved[:k])) / len(answer)


def mrr(retrieved: list[str], answer: set[str]) -> float:
    for rank, node in enumerate(retrieved, start=1):
        if node in answer:
            return 1.0 / rank
    return 0.0


def ndcg_at_k(retrieved: list[str], grades: dict[str, int], k: int) -> float:
    dcg = sum(
        grades.get(node, 0) / math.log2(i + 2)
        for i, node in enumerate(retrieved[:k])
    )
    ideal = sorted(grades.values(), reverse=True)[:k]
    idcg = sum(g / math.log2(i + 2) for i, g in enumerate(ideal))
    return dcg / idcg if idcg else 0.0


def exact_set(retrieved: list[str], answer: set[str], k: int) -> float:
    return 1.0 if set(retrieved[:k]) == answer else 0.0


# --------------------------------------------------------------------------
# Harness


def load_gold_set(path: Path) -> tuple[list[GoldQuery], dict]:
    raw = _yaml.load(path.read_text()) or {}
    meta = raw.get("meta") or {}
    out: list[GoldQuery] = []
    for entry in raw.get("queries") or []:
        out.append(
            GoldQuery(
                id=str(entry.get("id", "?")),
                question=str(entry.get("question", "")),
                intent=str(entry.get("intent", "")),
                metric=str(entry.get("metric", "")),
                answer_set=list(entry.get("answer_set") or []),
                status=str(entry.get("status", "authored")),
            )
        )
    return out, meta


def _score(query: GoldQuery, retrieved: list[str]) -> float:
    answer = {str(a.get("node")) for a in query.answer_set}
    grades = {str(a.get("node")): int(a.get("grade", 1)) for a in query.answer_set}
    metric = query.metric.lower().replace(" ", "")
    if metric.startswith("recall"):
        return recall_at_k(retrieved, answer, _k_of(metric, 20))
    if metric.startswith("mrr"):
        return mrr(retrieved, answer)
    if metric.startswith("ndcg"):
        return ndcg_at_k(retrieved, grades, _k_of(metric, 10))
    if metric.startswith("exact"):
        return exact_set(retrieved, answer, max(len(answer), 1))
    # default — fall back to the class's declared metric family
    family, _floor = FLOORS.get(query.intent, ("recall", 0))
    return {"recall": recall_at_k(retrieved, answer, 20),
            "mrr": mrr(retrieved, answer),
            "ndcg": ndcg_at_k(retrieved, grades, 10),
            "exact": exact_set(retrieved, answer, max(len(answer), 1))}[family]


def _k_of(metric: str, default: int) -> int:
    digits = "".join(c for c in metric if c.isdigit())
    return int(digits) if digits else default


def run(lineage_dir: Path, gold_path: Path | None = None) -> ProbeReport:
    """Score the gold set. Family 1 + a family-2 payload-ceiling check."""
    gold_path = gold_path or (lineage_dir / "query-gold-set.yaml")
    if not gold_path.is_file():
        return ProbeReport(status="gold-set-absent",
                           notes=[f"no gold set at {gold_path}"])
    queries, meta = load_gold_set(gold_path)
    scored = [q for q in queries if q.status != "example"]
    if not scored:
        return ProbeReport(
            status="gold-set-not-authored",
            notes=["gold set is still a template — author ~60 queries per "
                   "query-gold-set.yaml; the layer stays in shadow mode until then."],
        )

    gq = GraphQuery.build(lineage_dir)
    per_class: dict[str, list[tuple[str, float]]] = {}
    breaches = 0
    for q in scored:
        results = gq.query(q.question, k=config.DEFAULT_K, limit=40)
        retrieved = [r.node_id for r in results]
        per_class.setdefault(q.intent, []).append((q.id, _score(q, retrieved)))
        payload = sum((len(r.title) + len(r.node_id) + len(r.source_file) + 48)
                      * config.TOKENS_PER_CHAR for r in results)
        if payload > config.RESULT_TOKEN_CEILING:
            breaches += 1

    report = ProbeReport(status="scored", scored_count=len(scored),
                          payload_ceiling_breaches=breaches)
    overall = True
    for intent, scores in sorted(per_class.items()):
        mean = sum(s for _id, s in scores) / len(scores)
        _family, floor = FLOORS.get(intent, ("recall", 0.0))
        passed = mean >= floor
        overall = overall and passed
        report.per_class[intent] = {
            "mean": round(mean, 4), "floor": floor, "pass": passed,
            "query_count": len(scores),
        }
    report.overall_pass = overall and breaches == 0
    if meta.get("status") == "TEMPLATE":
        report.notes.append("meta.status is still TEMPLATE — flip to `authored`.")
    report.notes.append(
        "baseline (grep/Python) comparison is a separate maintainer-run step — "
        "the candidate must also beat the baseline per query class (PROBES family 1)."
    )
    return report
