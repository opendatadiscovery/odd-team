---
research: adversarial-review-panel
artifact: SUMMARY
date: 2026-05-21
mode: ecosystem (synthesis of PRIOR-ART, PITFALLS, COMPARISON, PROBES)
overall_confidence: HIGH
---

# SUMMARY — firm recommendations for the Adversarial Review Panel ADR

This synthesises four research threads — PRIOR-ART (the field of LLMs evaluating LLMs), PITFALLS (the failure modes), COMPARISON (panel architectures), PROBES (validating the panel itself). The recommendations below are decision-grade: the ADR should adopt them as written unless it states a reason not to.

## The one finding that dominates the design

**A panel of same-family agents auditing same-family artefacts is, in the worst case, one correlated draw masquerading as a 6-of-6 signal.** Correlated errors are real, measured (~0.42-0.60 agreement-when-both-wrong vs ~0.13-0.33 random), and *rise with model capability* — stronger models converge on the *same* mistakes ([arXiv:2506.07962](https://arxiv.org/html/2506.07962v1)). Diverse-family juries reduce this; a homogeneous panel does not. The Claude Code harness can only spawn Claude-family subagents. Therefore the panel's **primary residual risk is correlated blind spots, and it is HIGH and not removable by panel design alone.** Every other recommendation is downstream of managing this.

## Firm recommendations

1. **Architecture: independent panel → one cross-examination round → chair synthesis (option d).** COMPARISON ranks (d) > (b) >> (c) > (a) at HIGH confidence. Pure debate (c) is rejected — it manufactures the premature consensus an adversarial panel exists to prevent (modal sycophancy measured to 85.5%). Independent assessment first preserves uncorrelated judgement; one structured cross-examination recovers the correct-minority signal that pure voting averages away; the chair replaces brittle voting with reasoned synthesis.

2. **Exactly ONE cross-examination round.** The evidence is consistent: most value lands in round 1; round 2+ adds <1pp and frequently degrades into sycophantic drift. Do not loop.

3. **5-6 expert agents + a chair.** The literature's "3-5 judges" sweet spot is about N judges scoring the *same* question; this panel runs 6 experts on 6 *orthogonal axes* (Coverage / Process / Cost / Depth / Usefulness / Honesty) — that is coverage breadth, a different axis from jury redundancy. 6 + chair is defensible; do not exceed it.

4. **Decorrelate by every available lever, and state the residual loudly.** Cross-family is unavailable in-harness → use: model-TIER spread (Opus + Sonnet across the experts); strongly distinct role-prompts (six expertise lenses); per-expert distinct context slices and blindfolds; per-expert fresh spot-checks. None of these fully removes correlated error — the ADR's risk section must say so in plain language and never let panel unanimity be reported as confidence.

5. **Code-anchored verdicts are the deepest counter to correlated judgement.** Correlated models share *opinions*; they cannot make a failing `grep` pass or a missing `file:line` resolve. Every finding must cite re-runnable evidence. The Adversary's "ground truth from source BEFORE the ontology" ordering is exactly this discipline.

6. **Adversarial framing + negative prior.** Each expert is a hostile auditor; the prior is "AI-built artefacts carry undetected drift — find it." "Nothing wrong" is the expensive answer needing evidence. This inverts self-preference and sycophancy, which inflate *approval*, not a *forced search for failure*.

7. **Independent verdict committed BEFORE any peer is seen.** Phase-1 reports are written to disk before Phase-2 reads them. No prior verdicts, scores, or self-assessment text in an auditor's context (anchoring bias).

8. **Treat unanimity as weak evidence.** A 6/6 "all fine" verdict is the correlated-consensus failure mode. The chair weights findings by *cited-evidence strength*, never by headcount; it preserves minority and contested findings verbatim.

9. **Fresh spot-checks every run — never a fixed reused suite.** A static check-set gets gamed (the methodology tunes to pass it); freshly-sampled, never-pre-disclosed targets cannot be pre-satisfied. This is also the "external oracle" that the self-correction literature proves is required for AI critique to be reliable at all.

10. **The panel is validated, not assumed.** PROBES is unambiguous: an untrusted-until-tested panel reproduces the exact failure it exists to catch. The panel needs a **maiden acceptance gate** (Cohen's κ ≥ 0.6 vs maintainer labels, recall ≥ 0.80, seeded-defect detection ≥ 0.80 / ≥ 0.90 for data-loss-security, ECE ≤ 0.15, McDonald's ω ≥ 0.70, label-flip rejection ≈ 100%) and a **periodic drift gate** (frozen-baseline regression; fresh unannounced seeded sample; approval-rate trend). The gold set + seeded-defect corpus must be **maintainer-authored** — they are the external oracle; an LLM-authored gold set is correlated and worthless.

11. **Cost discipline: periodic, not per-commit; bounded fixed call count; report the panel's own cost.** ~6 + 6 + 1 ≈ 13 calls per full run (7 in lite mode, skipping cross-examination). Run per milestone / weekly. The panel must report its own run cost and carry a self-kill criterion.

12. **Keep the human as the final reader.** The chair's verdict is surfaced to the maintainer, never auto-acted-upon. The panel augments the maintainer's review and aims their scarce human spot-checks (via a `needs_human_verification` list); it does not replace them.

## What the ADR must explicitly hedge (contested in the literature)

- Whether a diverse jury achieves *real* independence — it reduces but never removes correlated error.
- Whether multi-agent debate helps — contested and fragile; the ADR takes only debate's robust part (one structured exchange) and discards the fragile part (multi-round convergence).
- The numeric validation thresholds — reasoned starting points; re-fit after the first two panel cycles produce a real score distribution.

## Net

The panel is **justified and on-trend** — diverse juries beat single judges on quality and cost; parallel-independent-then-aggregate is the validated topology; Anthropic ships essentially this pattern internally (alignment-auditing agents). It is **not a guaranteed oracle** — its correlated-blind-spot risk is HIGH and permanent, which is precisely why its design centres on code-anchored evidence, fresh external spot-checks, an explicit validation gate, and an honest hand-off of residual uncertainty to the human maintainer. Build it; validate it; never let it speak with more authority than its evidence carries.

## Confidence

**HIGH.** The architecture recommendation, the round-count, the panel-size band, the independence-first ordering, and the correlated-error risk are each corroborated by multiple 2024-2026 sources, several directly contradicting the naive "more agents / more debate is better" intuition. The single MEDIUM-confidence element is the numeric validation thresholds (PROBES), explicitly flagged for re-fitting.
