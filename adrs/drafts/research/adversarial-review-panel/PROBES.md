---
research: adversarial-review-panel
artifact: PROBES
date: 2026-05-21
mode: research (single-thread)
overall_confidence: MEDIUM
---

# PROBES — meta-evaluating the panel: how we know the auditor is not theater

## The problem this artefact solves

The Adversarial Review Panel is itself a set of LLM agents. Trusting its reports without
meta-evaluation reproduces the exact failure the panel exists to catch — a plausible-sounding
artefact nobody verified. The literature is blunt that this is not paranoia: LLM judges "are
imperfect predictions for the underlying truth and can exhibit systematic, non-random errors"
(Noisy-but-Valid, arXiv 2601.20913), they "miss threats … and can be tricked by adversarial
prompts" (Trend Micro), and SWE-ABS showed a benchmark's *measured* agent success rate dropping
from 78.80% to 62.20% once planted defects tested what the verifier actually catches (arXiv
2603.00520). A panel never tested the same way is a 78.80% number waiting to be deflated.

This artefact translates the meta-evaluation-of-LLM-judges literature into a concrete
validation procedure: a **maiden run** (acceptance gate before the panel's reports are trusted
at all) and a **periodic run** (drift / regression gate every subsequent cycle). The hardest
requirement — measuring what the panel *misses*, not what it flags — drives the design.

---

## Technique 1 — Agreement with ground-truth human judgment

**Established technique.** Percent agreement is rejected as the headline metric because it
ignores chance agreement; the field standardised on **Cohen's kappa** (binary / categorical
verdicts) and rank correlations (Spearman ρ, Kendall τ) for ordinal scores. Thakur et al. (2024)
on TriviaQA "emphasized Cohen's kappa over percent agreement … revealing that models aligned
with human judgments may not excel at ranking tasks"; κ "addresses … systematic bias where an
LLM could have perfect correlation while consistently being too harsh or lenient." The *Judge's
Verdict* study (arXiv 2510.09738) gives the sharpest acceptance bar: a **two-step** test —
Step 1, Pearson r ≥ 0.80 ("very strong"); Step 2, κ converted to a **human-likeness z-score**
`z = (κ_LLM − μ_human) / σ_human` against measured human-to-human agreement (μ_human κ = 0.801
in their corpus). A judge is "human-like" at `|z| < 1`; `z < −1` is a failure. The Landis & Koch
bands (κ 0.81–1.0 almost perfect, 0.61–0.80 substantial, 0.41–0.60 moderate) give an absolute
floor when no human-human baseline exists. eugeneyan's evaluator guide adds: for binary verdicts,
prefer **classification metrics** (recall, precision, F1) over correlation because they
"translate to performance in production" — directly relevant since panel findings are binary
(real-gap / not-a-gap).

**How it applies here.** The maintainer builds a **gold set** of 50–100 ontology slices each
carrying a human verdict (real gap present / absent, and if present its severity). Each panel
agent runs the gold set; we compute, per agent: (a) Cohen's κ vs maintainer verdict;
(b) recall and precision treating "real gap" as the positive class. **Acceptance gate:**
κ ≥ 0.6 (substantial — matches the agentic-code-ontology PROBES bar) AND recall ≥ 0.80.
Recall is gated separately and harder because a panel that catches few real gaps but is
confident on those it does catch can still post a respectable κ. Where a human-human κ can be
obtained (two maintainers, or maintainer + a trusted external reviewer on a 20-item subset),
prefer the `|z| < 1` human-likeness test over the absolute κ floor.

## Technique 2 — Calibration: does the panel's confidence match its accuracy

**Established technique.** Calibration is distinct from accuracy and from reliability: "a
perfectly calibrated LLM that says it's 90% confident should be correct about 9 out of 10
times" (Can-You-Trust-LLM-Judgments, arXiv 2412.12509). The measured reality is **systematic
overconfidence**: judges "cluster predictions at high confidence (90–100%) while achieving
substantially lower accuracy" (Overconfidence in LLM-as-a-Judge, arXiv 2508.06225). That paper
reports Expected Calibration Error (ECE) from 11.78% (best) to 74.22% (worst) and 39.25% for
GPT-4o — even strong models are badly miscalibrated by default. It introduces **TH-Score**
= `(e^(accuracy−0.5) − 1) × percentage`, measuring confidence-accuracy alignment in the high-
and low-confidence tails (ε = 0.1). The key mechanism finding: **verbalized confidence is
overconfident; self-consistency and semantic entropy across multiple generations calibrate
well** (Calibrating LLM Judges, arXiv 2512.22245). The mitigation that works is ensembling —
LLM-as-a-Fuser cut Mistral-Nemo's ECE by 53.73 points.

**How it applies here.** Require every panel finding to carry a numeric confidence (0–100).
On the gold set, bin findings by stated confidence and plot a **reliability diagram**
(accuracy-per-bin vs stated confidence); compute **ECE**. **Acceptance gate:** ECE ≤ 0.15
(a deliberately lenient bar given the literature's baselines; a tighter 0.10 is the aspiration
once the panel is tuned). Because verbalized confidence is the known-bad signal, do NOT take
the agent's self-reported number at face value — derive panel confidence from **self-consistency
across N=3–5 re-runs** (fraction of runs voting "real gap"). A panel that is both overconfident
AND miscalibrated is the rubber-stamp signature: high stated confidence, low ECE-bin accuracy.

## Technique 3 — False-negative rate: the gaps the panel MISSES

**Established technique.** The hardest and most important property: a judge that only reports
what it finds never reveals what it missed. The literature's answer is that false negatives
cannot be observed from the judge's own output — you need an **independent ground truth
containing known positives** and you measure how many were *not* flagged. "Evaluating false
negatives refers to the frequency in which a labeling error is missed by the method" (Label
Studio). Recall = TP / (TP + FN) is the direct false-negative metric, and it must be tracked
*separately* from specificity: a cited study found gpt-3.5-turbo identified ">95% of consistent
summaries but only 30–60% of inconsistent ones" (eugeneyan) — a near-perfect-looking evaluator
with a catastrophic miss rate on the cases that matter. The only reliable instruments are
(a) a human-labelled set with known positives (Technique 1's recall figure), and (b) **seeded
defects** (Technique 4) where the positive count is known by construction.

**How it applies here.** The panel's false-negative rate is measured two ways, never inferred
from its reports:
1. **Recall on the human gold set** (Technique 1) — FN = real gaps the maintainer marked that
   no panel agent surfaced.
2. **Seeded-defect detection rate** (Technique 4) — FN = injected known defects the panel
   passed as clean.
**Acceptance gate:** seeded-defect detection ≥ 0.80 overall AND ≥ 0.90 for the
data-loss / security severity class (mirrors LSN-001 attachment-ephemeral-default and LSN-002
minio-region-unset — the failure modes whose miss is unacceptable). Report the FN rate *as a
headline number in every panel cycle*; a panel summary that reports only findings, with no
miss-rate estimate, is non-compliant by construction.

## Technique 4 — Seeded / held-out known-defect test sets ("planted-bug" evaluation)

**Established technique.** Inject known defects, measure the detection rate — the standard way
to evaluate a reviewer/verifier without trusting its self-report. Mutation-based Consistency
Testing (MCT, arXiv 2401.05940) "deliberately injects artificial inconsistencies between code
and its description using program mutation"; its **MCT Score = |P| / (|P| + |F|) × 100** is
exactly a detection rate, where |F| are seeded defects wrongly passed as consistent — the false
negatives. MCT used four operators (Arithmetic / Relational Operator Replacement, Literal Value
Replacement, Statement Deletion) and found GPT-4 at 85.1% vs GPT-3.5 at 34.0% — a spread that
proves the test discriminates. SWE-ABS (arXiv 2603.00520) "synthesizes plausible-but-incorrect
patches" — syntactically valid, functionally near-miss — deflating a verifier's measured
success by 16.6 points. The design rule from all of these: **seeded defects must be plausible**
(a defect an LLM author would actually produce), and a fraction of the corpus must be **held
out** so the panel cannot be tuned to the test.

**How it applies here.** Build a **seeded-defect corpus** by mutating *correct* ontology
sidecars / feature-flows into known-wrong ones. Five operators, adapted from MCT to ontology
artefacts: **claim inversion** (negate an `understanding`/`responsibility` claim — the
synonym-swap-with-negation attack from the agentic-ontology probe skill); **citation
corruption** (change a cited `file:line` to a wrong-but-plausible location); **caveat deletion**
(remove a true caveat block — directly models the LSN-001 / LSN-002 undocumented-caveat
failure); **cross-axis fabrication** (invent a controller × doc join that does not exist);
**severity downgrade** (relabel a data-loss caveat as cosmetic). Each mutant is a known
positive. **Maiden run:** seed ~40 defects (8 per operator), run the full panel, compute
detection rate per operator and per severity; **hold out 25%**, never shown during any panel
tuning, as the un-gameable check. **Periodic run:** draw a fresh maintainer-authored,
unannounced seeded sample each cycle (same discipline as the agentic-ontology Type-4
adversarial round) so detection rate is re-measured and the panel cannot memorise the corpus.

## Technique 5 — Test-retest reliability: same verdict on re-run

**Established technique.** LLM judges are stochastic — "the same case scored by the same judge
model can get 0.8 on one run and 0.7 on the next" (Braintrust). Test-retest reliability
"quantifies how often an LLM judge repeats the same verdict on identical cases under a fixed
rubric and prompt" (arXiv 2603.05399, Judge Reliability Harness); JRH measures it via a
**stochastic-stability** test — duplicate identical samples, compare outputs — observing
68–85% repeat-agreement for that family. The Can-You-Trust-LLM-Judgments paper (arXiv 2412.12509)
frames the same property as **internal consistency reliability** and recommends **McDonald's
omega (ω)** over Cronbach's alpha, with psychometric bands ω > 0.9 excellent, 0.8–0.9 good,
0.7–0.8 acceptable, < 0.7 questionable — and reports real judges mostly land in the
*questionable* 0.6–0.7 range. The standard noise mitigation: **score each case 3 times, take
the median** — Braintrust reports this "cuts false-positive regressions by roughly 60%." A trap:
at temperature 0, ω hits 1.0, but that is "artificial reliability without meaningful variation"
— determinism is not a robust verdict.

**How it applies here.** Re-run the panel on a fixed 30-item subset **3–5 times** (production
temperature, not 0). Compute: (a) verdict repeat-rate per item; (b) McDonald's ω across the
runs. **Acceptance gate:** ω ≥ 0.7 (acceptable band) and verdict repeat-rate ≥ 0.80. Adopt
**median-of-3** as the panel's standing operating mode so single-run noise does not produce
phantom findings or phantom regressions. Report ω every periodic cycle — a falling ω is itself
a degradation signal (Technique 6).

## Technique 6 — Detecting drift into a rubber stamp

**Established technique.** The rubber-stamp failure is the central risk: an evaluator that
emits plausible reports while having quietly stopped discriminating. Causes named in the
literature: **sycophancy / agreement bias** — "the LLM's tendency to agree … even when
factually incorrect," an RLHF artefact (SycEval, arXiv 2502.08177); **model drift** — "upstream
provider updates change model behavior without any changes to the application code" (Coverge);
**prompt drift** — accumulated wording changes. Detection is by **regression testing against a
frozen baseline** — comparing "against stored baselines … detecting relative degradation even
when absolute scores look acceptable" (Coverge), via "rolling quality scores … with baseline
threshold lines" (Braintrust). The JRH **label-flip** test is the direct rubber-stamp probe —
rewrite a response to *violate* the rubric and confirm the verdict flips; a judge that still
passes it is rubber-stamping. SWE-ABS is the same idea at benchmark scale.

**How it applies here.** Three standing rubber-stamp detectors, run every periodic cycle:
1. **Frozen-baseline regression.** Re-run the full gold set + held-out seeded corpus each
   cycle; compare κ, recall, ECE, ω, and seeded-detection-rate to the maiden-run baseline.
   **Regression alarm:** any metric drops > 0.10 absolute, OR seeded-detection on the
   data-loss/security class falls below 0.90 — halt and have the maintainer inspect before
   trusting that cycle's reports.
2. **Label-flip / approval-floor probe.** Inject obviously-broken sidecars (inverted claims,
   deleted caveats). A healthy panel rejects ~100% of these. A rising *pass* rate on
   known-broken input is the rubber-stamp signature — escalate immediately.
3. **Approval-rate trend.** Track the panel's clean-pass rate across cycles. A monotone climb
   toward "everything passes" with no corresponding improvement in the audited artefact is
   sycophancy/drift, not success. Pair with model-version pinning: when the underlying Claude
   model updates, re-run the maiden gate in full — an upstream model change invalidates the
   prior baseline (model drift).

---

## Validation procedure for the panel

### Maiden run — acceptance gate (panel reports are NOT trusted until this passes)

1. **Build the gold set** — maintainer hand-labels 50–100 ontology slices: real-gap present /
   absent + severity. Stratify by severity so the data-loss/security class is represented.
2. **Build the seeded-defect corpus** — ~40 mutants across the five operators (Technique 4);
   hold out 25%, never shown during tuning.
3. **Run agreement + false-negative** — every panel agent runs the gold set. Compute Cohen's κ,
   recall, precision per agent. Gate: **κ ≥ 0.6 AND recall ≥ 0.80**.
4. **Run calibration** — reliability diagram + ECE from self-consistency (N=3–5), not verbalized
   confidence. Gate: **ECE ≤ 0.15**.
5. **Run seeded-defect detection** — full corpus. Gate: **detection ≥ 0.80 overall AND ≥ 0.90
   on the data-loss/security class**.
6. **Run test-retest** — 30-item subset × 3–5 re-runs at production temperature. Compute
   McDonald's ω + verdict repeat-rate. Gate: **ω ≥ 0.7 AND repeat-rate ≥ 0.80**.
7. **Run the label-flip rubber-stamp probe** — inject obviously-broken artefacts. Gate:
   **rejection rate ≈ 100%**.
8. **Freeze the baseline** — record every metric above + the pinned model version. This is the
   reference for all periodic runs. If any gate fails, the panel is not yet trustworthy: tune
   prompts / add agents / ensemble (LLM-as-a-Fuser) and re-run the full maiden gate.

### Periodic run — drift / regression gate (every panel cycle)

1. **Fresh unannounced seeded sample** — maintainer authors a new seeded batch each cycle (the
   panel cannot have seen it); re-measure detection rate per operator and severity.
2. **Re-run the frozen gold set + held-out seeded corpus** — recompute κ, recall, ECE, ω,
   seeded-detection. **Regression alarm** on any > 0.10 absolute drop, or data-loss/security
   detection < 0.90.
3. **Median-of-3** is the standing run mode — every finding and every metric is a median over
   3 re-runs (Technique 5 noise control).
4. **Approval-rate trend check** — log clean-pass rate; flag a monotone climb with no artefact
   improvement (Technique 6 detector 3).
5. **Model-version check** — if the underlying Claude model changed since the frozen baseline,
   re-run the *full maiden gate*, not just the periodic subset (model drift invalidates the
   baseline).
6. **Caught real gaps become regression probes** — every genuine gap the panel finds (or
   misses, once the maintainer catches it) is added as a permanent seeded case, so the corpus
   grows from real failure modes (same discipline as the agentic-code-ontology PROBES).
7. **Publish the FN estimate** — every cycle's panel report carries its measured
   false-negative rate as a headline number. A report with findings but no miss-rate is
   non-compliant.

### Acceptance thresholds — summary

| Property | Metric | Maiden gate | Periodic alarm |
|---|---|---|---|
| Agreement | Cohen's κ vs maintainer | ≥ 0.60 | drop > 0.10 |
| False negatives | recall on gold set | ≥ 0.80 | drop > 0.10 |
| False negatives | seeded-defect detection | ≥ 0.80 (≥ 0.90 data-loss/sec) | < 0.90 on data-loss/sec |
| Calibration | ECE (from self-consistency) | ≤ 0.15 | rise > 0.10 |
| Test-retest | McDonald's ω | ≥ 0.70 | drop > 0.10 |
| Test-retest | verdict repeat-rate | ≥ 0.80 | drop > 0.10 |
| Rubber-stamp | label-flip rejection rate | ≈ 100% | any sustained fall |

Thresholds are deliberately at the lenient end of the literature's bands (κ 0.6 not 0.8;
ECE 0.15 not 0.10) for the maiden run, because the literature shows even strong models start
below the aspirational marks — the gate must be passable while still excluding a non-functional
panel. Tighten after the first two cycles once a real distribution of panel scores exists.

---

## Sources

- [Judge's Verdict: A Comprehensive Analysis of LLM Judge Capability Through Human Agreement, arXiv 2510.09738](https://arxiv.org/html/2510.09738v1) — two-step κ + Pearson framework; human-likeness z-score; μ_human κ = 0.801; Landis & Koch bands.
- [Can You Trust LLM Judgments? Reliability of LLM-as-a-Judge, arXiv 2412.12509](https://arxiv.org/html/2412.12509v2) — reliability vs calibration distinction; McDonald's ω over Cronbach's α; psychometric bands; temperature-0 artificial-reliability trap.
- [Overconfidence in LLM-as-a-Judge: Diagnosis and Confidence-Driven Solution, arXiv 2508.06225](https://arxiv.org/abs/2508.06225) — overconfidence phenomenon; TH-Score formula; ECE 11.78%–74.22%; LLM-as-a-Fuser ensemble.
- [Calibrating LLM Judges: Linear Probes for Fast and Reliable Uncertainty Estimation, arXiv 2512.22245](https://arxiv.org/html/2512.22245) — verbalized confidence is overconfident; self-consistency / semantic entropy calibrate well.
- [Mutation-based Consistency Testing for Evaluating the Code Understanding Capability of LLMs, arXiv 2401.05940](https://arxiv.org/html/2401.05940v1) — MCT method; MCT Score = |P|/(|P|+|F|); four mutation operators; GPT-4 85.1% vs GPT-3.5 34.0%.
- [SWE-ABS: Adversarial Benchmark Strengthening Exposes Inflated Success Rates, arXiv 2603.00520](https://arxiv.org/pdf/2603.00520) — planted plausible-but-incorrect patches; measured success deflation 78.80% → 62.20%.
- [Judge Reliability Harness: Stress Testing the Reliability of LLM Judges, arXiv 2603.05399](https://arxiv.org/html/2603.05399v1) — five perturbation families; label-flip test; stochastic-stability 68–85%; "no judge uniformly reliable."
- [SycEval: Evaluating LLM Sycophancy, arXiv 2502.08177](https://arxiv.org/html/2502.08177v2) — sycophancy / agreement bias as an RLHF artefact; the rubber-stamp root cause.
- [Noisy but Valid: Robust Statistical Evaluation of LLMs with Imperfect Judges, arXiv 2601.20913](https://arxiv.org/pdf/2601.20913) — judges as imperfect predictors with systematic non-random error; TPR/FPR correction from a small human calibration set.
- [Evaluating the Effectiveness of LLM-Evaluators (LLM-as-Judge), eugeneyan.com](https://eugeneyan.com/writing/llm-evaluators/) — prefer classification metrics (recall/precision/F1) for binary verdicts; separate sensitivity vs specificity; the 30–60% inconsistent-summary miss-rate finding.
- [LLM regression testing: catching quality drift, Coverge](https://coverge.ai/blog/llm-regression-testing) — frozen-baseline regression; model drift vs prompt drift.
- [What is LLM evaluation? practical guide to evals, metrics, and regression testing, Braintrust](https://www.braintrust.dev/articles/llm-evaluation-guide) — judge noise (0.7/0.8 on re-run); median-of-3 cuts false-positive regressions ~60%; rolling baseline dashboards.
- [LLM as a Judge: Evaluating Accuracy in LLM Security Scans, Trend Micro](https://www.trendmicro.com/vinfo/us/security/news/managed-detection-and-response/llm-as-a-judge-evaluating-accuracy-in-llm-security-scans) — judges miss threats and can be tricked by adversarial prompts.
- [LLM Evaluation: Comparing Four Methods to Automatically Detect Errors, Label Studio](https://labelstud.io/blog/llm-evaluation-comparing-four-methods-to-automatically-detect-errors/) — false-negative rate = frequency a labeling error is missed.

### Workspace-internal references

- `adrs/drafts/research/agentic-code-ontology/PROBES.md` — semantic-claim validation protocol; the κ ≥ 0.6 / adversarial-round / caught-bug-becomes-regression-probe disciplines reused here.
- `adrs/drafts/research/code-lineage-substrate/PROBES.md` — the four-step name→locate→query→pass/fail probe shape.
- `probe` skill (agentic ontology) — Type-4 adversarial (capability-negation / cross-product-fabrication / synonym-swap-with-negation) and Type-6 implicit-ADR rounds; the maintainer-authored-unannounced discipline adopted for the seeded corpus.
- `retrospectives/LSN-001-attachment-ephemeral-default.md`, `retrospectives/LSN-002-minio-region-unset.md` — the data-loss / silent-misconfiguration failure modes that set the ≥ 0.90 detection bar for that severity class.
- `CLAUDE.md` Gate 9 — factual-claim provenance; the discipline this artefact extends to the panel's own outputs.

---

## Confidence + open questions

**Overall confidence: MEDIUM.** The *techniques* are HIGH-confidence — agreement (Cohen's κ),
calibration (ECE / reliability diagrams), seeded-defect detection (MCT, SWE-ABS), test-retest
(McDonald's ω), and frozen-baseline regression are all well-established, each traced to a
fetched 2024–2026 source, and they compose cleanly into a maiden + periodic gate. The MEDIUM
rating is driven entirely by the **acceptance thresholds**: the literature reports wide,
task-dependent score ranges (JRH: "no judge uniformly reliable across benchmarks"; ω mostly
"questionable" 0.6–0.7), so the numbers in the summary table are reasoned starting points, not
empirically calibrated for *this* panel. They must be re-fitted after the first two periodic
cycles produce a real score distribution.

**Open questions for the maintainer to resolve during the maiden run (not blockers):**

1. **Gold-set authorship cost.** 50–100 hand-labelled ontology slices is real solo-maintainer
   effort. A smaller maiden set (~30) is defensible if the seeded corpus carries more of the
   false-negative measurement — seeded positives are cheap and carry a known label.
2. **Severity weighting.** Whether a single missed data-loss defect should *fail the cycle
   outright* (vs alarm-and-inspect) is a risk-tolerance call — recommend fail-outright,
   consistent with the LSN-001/002 stakes.
3. **Self-preference within the panel.** If a panel agent shares a model family with an
   ontology-building agent, self-preference bias (arXiv 2504.03846) can inflate clean-pass
   rates. Add a small cross-family check at the maiden run; the full treatment belongs in the
   panel's *architecture* artefact, not its probe protocol.
4. **Cost of self-consistency.** N=3–5 re-runs triples-to-quintuples panel cost per cycle.
   Median-of-3 is the recommended floor; N=5 only for the calibration measurement where
   tail-bin accuracy needs the resolution.
