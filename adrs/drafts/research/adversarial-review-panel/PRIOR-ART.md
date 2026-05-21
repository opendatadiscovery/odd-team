---
research: adversarial-review-panel
artifact: PRIOR-ART
date: 2026-05-21
mode: research (single-thread)
overall_confidence: HIGH
---

# PRIOR-ART — using LLMs to evaluate LLM-built artefacts

Survey of established prior art and 2023-2026 practice for "AI reviewing AI": single LLM judges, panels/juries, multi-agent debate, code-specific judging, agentic-trajectory evaluation, self-critique/RLAIF, and automated red-teaming. The artefact is opinionated on what is **solid** vs. **contested**, and is written to inform the Adversarial Review Panel ADR's design decisions directly — each section closes with an explicit *Panel implication*.

**Headline for the ADR.** The single most-replicated finding in this space is double-edged. (1) A strong LLM judge tracks human preference at ~80-85% agreement — about the rate two humans agree with each other ([Zheng et al. 2023, arXiv:2306.05685](https://arxiv.org/abs/2306.05685)) — so an LLM panel is a *defensible* auditor. (2) But LLM judges and LLM ensembles have **correlated errors**: independent models agree ~60% of the time *when both are wrong* vs. a ~33% random baseline, and correlation *rises* with model capability ([Correlated Errors, arXiv:2506.07962](https://arxiv.org/html/2506.07962v1)). The panel's core design problem is therefore not "is one judge good enough" — it is **engineering genuine independence into a system whose members are not naturally independent**. Everything below is in service of that problem.

## 1. LLM-as-a-judge (single judge) — solid but biased

**Established result.** A strong LLM (GPT-4-class) used as a judge matches human preference at **>80% agreement on MT-Bench and Chatbot Arena — the same rate at which two humans agree** ([Zheng et al. 2023, arXiv:2306.05685](https://arxiv.org/abs/2306.05685)). G-Eval (GPT-4 + chain-of-thought + form-filling) reached 0.514 Spearman correlation with humans on summarisation, far above BLEU/ROUGE ([Liu et al. 2023, arXiv:2303.16634](https://arxiv.org/abs/2303.16634)). This is why LLM-as-judge is now the default eval mechanism for chatbots, RAG, and agents across the industry ([OpenAI Evaluation best practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices)).

**The contested / negative side is equally well-replicated — single judges carry systematic bias:**

- **12 distinct bias types** are catalogued by the CALM "attack-and-detect" framework: position, verbosity, bandwagon, authority (crediting fabricated citations), self-enhancement, sentiment, distraction, fallacy-oversight, and others. Even GPT-4-Turbo shows "unexpected vulnerabilities"; Claude-3.5 was the most resilient but not immune ([Justice or Prejudice?, arXiv:2410.02736](https://arxiv.org/html/2410.02736v1)).
- **Position bias** is severe: in pairwise judging, swapping presentation order shifts accuracy by >10%, and robustness drops below 0.5 with more candidates ([Justice or Prejudice?, arXiv:2410.02736](https://arxiv.org/html/2410.02736v1)).
- **Self-preference bias** is mechanistic, not incidental: GPT-4 scores low-perplexity (more "familiar") text higher, so a judge structurally favours text from its own family ([Self-Preference Bias, arXiv:2410.21819](https://arxiv.org/html/2410.21819v2)).
- **Verbosity bias**: judges tend to prefer longer/more-fluent answers regardless of substance — an RLHF artefact ([Justice or Prejudice?, arXiv:2410.02736](https://arxiv.org/html/2410.02736v1)).
- A 2024-2025 survey concludes current LLMs are **"still not sufficiently reliable"** as judges for tasks needing logical reasoning ([LLMs-as-Judges survey, arXiv:2412.05579](https://arxiv.org/html/2412.05579v2)).

**Practitioner consensus on how to deploy a single judge safely** ([OpenAI Evaluation best practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices); [Survey on LLM-as-a-Judge, arXiv:2411.15594](https://arxiv.org/abs/2411.15594)): calibrate against a labelled gold set (target 75-90% human agreement) *before* trusting it; use the strongest available grader; supply the judge the right inputs (e.g. a faithfulness eval without the retrieved context is meaningless); treat a 100% pass rate as a sign the eval is too easy, not as success; keep humans in the loop to complement rather than replace.

**Panel implication.** A single LLM auditor of the ontology methodology is *usable* but inherits position/verbosity/self-preference bias wholesale, and is unreliable exactly on the reasoning-heavy judgements the panel cares about ("is this enrichment sidecar's claim load-bearing?"). The panel design is justified specifically because the methodology-audit task is reasoning-heavy. But the panel must still be *calibrated* — a gold set of known-good and known-bad ontology fragments the chair can score the panel against.

## 2. Panels / juries / ensembles of judges — beat single judges, with caveats

**The PoLL result (the most-cited panel paper).** "Replacing Judges with Juries" proposes a **Panel of LLM evaluators (PoLL)**: three *small* models from **disjoint families** — Command-R, GPT-3.5, Claude-3 Haiku — each scoring independently, aggregated by **max-voting** (binary judgements) or **average-pooling** (1-5 scale) ([Verga et al. 2024, arXiv:2404.18796](https://arxiv.org/html/2404.18796v2)). Measured results:

- **Higher human correlation than a single GPT-4 judge.** Single-hop QA Cohen's κ: PoLL 0.763 / 0.906 / 0.867 vs. GPT-4 0.627 / 0.841 / 0.830. Chatbot Arena: PoLL Pearson 0.917 / Kendall-τ 0.778 vs. GPT-4 0.817 / 0.667.
- **7-8× cheaper** than a single GPT-4 judge.
- **Less intra-model bias.** GPT-4 ranked a GPT-4 variant 2nd when its true position was 4th; PoLL had the smallest score spread across judges (σ=2.2).
- **Stated limitations (from the authors):** only 3 panel compositions tested; *not* validated on math/reasoning evals "where language models often struggle"; optimal panel selection left as future work.

**Why panels help (the theory).** Diverse-family ensembles reduce *intra-model* (self-preference) bias because no single family's blind spot dominates the vote. Production guidance converges on the same point: "plurality or weighted voting across diverse judge families is usually more valuable than repeated calls to the same judge, because it reduces correlated blind spots" ([Correlated Errors discussion, arXiv:2506.07962](https://arxiv.org/html/2506.07962v1)).

**The hard caveat — panels do NOT eliminate the shared blind spot.** This is the contested finding the ADR must respect. The "Correlated Errors" study shows even *architecturally distinct, different-provider* models make **correlated mistakes**: agreement-when-both-wrong is 0.60 on HELM (random baseline 0.33) and 0.42 on the HF leaderboard (baseline 0.13); 97.5-100% of model pairs exceed random. Worse, **correlation rises with capability** — the strongest models converge on the *same* mistakes ([arXiv:2506.07962](https://arxiv.org/html/2506.07962v1)). "Diversity doesn't guarantee independence ... apparent agreement may reflect a consensus of correlated errors rather than independent verification." A 2024 survey similarly classifies bias types that survive ensembling ([Survey, arXiv:2411.15594](https://arxiv.org/abs/2411.15594)).

**Panel implication.** A diverse panel is the right baseline — it is cheaper *and* better-correlated-with-humans than one big judge, which is a rare free lunch. But "6 independent experts" is an overclaim if all 6 are the same base model with different prompts: prompt-diversity is *not* model-diversity, and the self-preference literature says same-family judges share a perplexity-driven bias. Two concrete consequences for the ADR: **(a)** vary the panel along the axes that actually decorrelate — model family where the Claude Code harness allows, and failing that, *adversarial role assignment* + *fresh independent spot-checks* (each expert generates its own probes against the real codebase, so they cannot all miss the same thing the same way); **(b)** treat panel unanimity as a **weak** signal, not a strong one — a 6/6 "the methodology is fine" verdict is exactly the correlated-consensus failure mode. The chair should weight *surfaced disagreements and concrete defects* over agreement.

## 3. Multi-agent debate — real but oversold; needs heterogeneity

**The founding result.** Du et al. — multiple LLM instances "propose and debate their individual responses and reasoning over multiple rounds to arrive at a common answer" — improves arithmetic/strategic reasoning and **factual validity, reducing fallacious answers and hallucinations**; works on black-box models with identical prompts across tasks ([Du et al. 2023, arXiv:2305.14325](https://arxiv.org/abs/2305.14325), ICML 2024).

**The major correction (2025).** "Stop Overvaluing Multi-Agent Debate" finds debate produces **minimal gains when agents have similar capabilities and knowledge** — same-model copies "merely amplify shared misconceptions" and the discussion is "circular." Debate helps substantively *only* when agents are **heterogeneous** so one can identify and correct another's mistakes; the recommendation is explicitly to "embrace model diversity" over homogeneous teams ([arXiv:2502.08788](https://arxiv.org/pdf/2502.08788)).

**The failure mode most relevant to an audit panel — conformity / sycophancy.** A cluster of 2024-2026 papers documents that LLM agents in debate **conform to perceived majority opinion** and "frequently abandon correct answers in favour of peer consensus, prioritising agreement over critical evaluation." Sycophancy *propagates* through multi-agent systems, producing **wrong consensus delivered with high apparent confidence** — "unanimous answers can still be wrong" ([Too Polite to Disagree, arXiv:2604.02668](https://arxiv.org/html/2604.02668); [Peacemaker or Troublemaker, arXiv:2509.23055](https://arxiv.org/html/2509.23055v1); [Talk Isn't Always Cheap, arXiv:2509.05396](https://arxiv.org/pdf/2509.05396)).

**Panel implication.** Cross-examination between the 6 experts is valuable *only* if it is genuinely adversarial. A naive "agents read each other and discuss" round will, on this evidence, **regress toward conformity** and manufacture false confidence — the opposite of what an adversarial panel is for. The ADR should: (a) assign each expert a *distinct stance/role* and instruct them to defend a critical reading, never to seek consensus; (b) keep each expert's *fresh independent spot-check* private until after the first independent verdict, so cross-examination critiques evidence rather than anchoring on a majority; (c) have the chair score **whether disagreement was preserved** — a debate that collapsed to unanimity in round 1 is a red flag, not a success; (d) bound rounds (one or two) — the self-refine literature (§5) shows diminishing returns and instability with more iterations.

## 4. LLM-as-judge for CODE and for agentic pipelines

**Code-judging works without test cases — surprisingly well.** CodeJudge (step-by-step functional analysis → binary decision; plus an error-taxonomy severity score) beats GPT-3.5-based code evaluators with no test cases and no fine-tuning, and even a Llama-3-8B backbone outperforms larger baselines across Java/C++/Python/JS/Go ([CodeJudge, arXiv:2410.02184](https://arxiv.org/pdf/2410.02184)). On CodeJudgeBench (code generation, code repair, unit-test generation), **"thinking" models substantially outperform non-thinking ones** — Qwen3-8B (thinking) beats purpose-trained 70B judges ([CodeJudgeBench, arXiv:2507.10535](https://arxiv.org/abs/2507.10535)).

**But code judges are brittle and easily fooled.** CodeJudgeBench: "all models still exhibit significant randomness," and response-order swaps "substantially impact accuracy" ([arXiv:2507.10535](https://arxiv.org/abs/2507.10535)). "Don't Judge Code by Its Cover" finds **six code-specific biases** with large effects, all models susceptible across five languages, and **scale does not help** (larger models sometimes *more* vulnerable) ([arXiv:2505.16222](https://arxiv.org/html/2505.16222v1)):

- **Self-declared correctness** — a `# correct code` comment lifts accept rate by up to **+34.3 pts**.
- **Misleading task description** — an inaccurate internal description drops accuracy by **−26.7 pts** on correct code.
- **Authority bias** — "written by a senior engineer" comments add positive bias; reverse-authority ("I'm a beginner") subtracts ~5.6 pts.
- **Illusory complexity** — unused functions inflate perceived sophistication.

**Agentic pipelines: evaluate the trajectory, not just the output.** Agent-as-a-Judge uses an *agent* (with graph-construction, file-location, code-search, trajectory-retrieval, requirement-verification modules) to evaluate another agent's *full thought-and-action trajectory*, not the final answer. On DevAI (55 dev tasks, 365 hierarchical requirements) it hit **92.07% alignment with human consensus vs. 70.76% for plain LLM-as-a-Judge**, at **2.3% of the cost and time** of human evaluation ($30.58 / 118 min vs. $1,297 / 86.5 h) — and aligned *better than individual human evaluators* ([Agent-as-a-Judge, arXiv:2410.10934](https://arxiv.org/html/2410.10934v2)). Caveats from the authors: the judge's own planning/memory modules were **counterproductive due to error propagation**. On web-agent trajectories, AgentRewardBench found the best of four LLM judges reached only **80.6%** against a rule-based evaluator ([AgentRewardBench, arXiv:2504.08942](https://arxiv.org/pdf/2504.08942)).

**Panel implication.** Three direct lessons. **(a) Use thinking/extended-reasoning models for the experts** — code-judging quality tracks reasoning ability more than parameter count. **(b) The panel's spot-checks must inspect the methodology's *trajectory*** — the substrate→sidecar→reducer chain, the prompts, the cache keys — not only the final ontology artefacts; Agent-as-a-Judge's 92% vs 71% gap is the size of the prize. **(c) Defend against the methodology's artefacts fooling the panel** — sidecars and reducer outputs are LLM-written prose that may contain confident self-declarations ("this enrichment is complete and correct"); the +34-pt self-declared-correctness bias means an expert reading a sidecar that *claims* correctness will over-accept it. Experts must verify claims against the real codebase (fresh spot-checks), never against the methodology's own narration.

## 5. Constitutional AI / RLAIF / self-critique & self-refinement — works *with* a principle or external signal, fails *intrinsically*

**Constitutional AI / RLAIF.** Anthropic's Constitutional AI trains a harmless assistant with **no human harm-labels** — the model self-critiques and revises against a written list of principles (SL stage), then a model judges which of two responses is better to build a preference model for RL (RLAIF stage) ([Bai et al. 2022, arXiv:2212.08073](https://arxiv.org/abs/2212.08073); [Anthropic](https://www.anthropic.com/research/constitutional-ai-harmlessness-from-ai-feedback)). The load-bearing element is the **explicit constitution** — AI feedback is only as good as the written principles it is anchored to. RLAIF works because the judging is *rubric-grounded*, not free-form.

**Self-Refine.** Same LLM as generator + feedback-giver + refiner, iteratively; ~20% absolute average gain across tasks, no training needed ([Madaan et al. 2023, arXiv:2303.17651](https://arxiv.org/abs/2303.17651)). Stated limits: needs a **strong** base model with good instruction-following; **non-uniform** — math sees little benefit; **diminishing returns** with more iterations; can make the model **more unstable**; relies on task-specific prompts.

**The sharp negative result — intrinsic self-correction does not work for reasoning.** "Large Language Models Cannot Self-Correct Reasoning Yet": with *no external feedback*, an LLM asked to judge and fix its own reasoning **does not improve, and performance often degrades** on GSM8K / CommonSenseQA. Self-correction helps **only with an oracle / external signal** (e.g. knowing the answer is wrong, or being told the error location) ([Huang et al. 2023, arXiv:2310.01798](https://arxiv.org/abs/2310.01798), ICLR 2024). A companion result: LLMs "cannot find reasoning errors but can correct them given the error location" ([arXiv:2311.08516](https://arxiv.org/pdf/2311.08516)). G-Eval's authors separately warn that using an LLM's own scores as a tuning signal causes **self-reinforcement / over-fitting to the model's own criteria** ([arXiv:2303.16634](https://arxiv.org/abs/2303.16634)).

**Panel implication.** The panel must be **architecturally external** to the methodology — agents that did not build the ontology, auditing artefacts they did not author. A panel made of the *same* subagents that built the sidecars, asked to grade their own work, is the intrinsic-self-correction setup that the literature says *degrades* quality. Two design rules follow: **(a)** the panel needs a **written constitution / rubric** — explicit criteria for "good ontology process / progress / cost" — because RLAIF and CALM both show AI judging is reliable only when rubric-anchored, never free-form; **(b)** the panel's **fresh spot-checks against the real codebase are the "external signal"** that the self-correction papers prove is required — they convert an unreliable intrinsic critique into a reliable oracle-grounded one. Spot-checks are not a nice-to-have; they are the mechanism that makes the panel work at all.

## 6. Automated red-teaming — mature; scales beyond human reach but needs an external classifier

**Established result.** "Red Teaming Language Models with Language Models" — use one LM to generate adversarial test cases against a target LM, then **score replies with a separate classifier**; this surfaced *tens of thousands* of offensive replies in a 280B chatbot, with methods from zero-shot to RL trading off diversity vs. difficulty ([Perez et al. 2022, arXiv:2202.03286](https://arxiv.org/abs/2202.03286)). Later work formalises red-teaming as an MDP with hierarchical RL and token-level harm rewards to find multi-turn vulnerabilities humans miss ([Automatic LLM Red Teaming, arXiv:2508.04451](https://arxiv.org/abs/2508.04451)); holistic top-down test-case generation extends coverage ([arXiv:2409.16783](https://arxiv.org/html/2409.16783v1)).

**Anthropic's 2025 alignment-auditing agents — the closest production precedent to this ADR.** Three agents: an **investigator** (open-ended deep-dives with chat/data/interpretability tools), an **evaluation agent** (designs/codes/runs evals), and a **breadth-first red-teaming agent** ([Anthropic, Building and evaluating alignment auditing agents](https://alignment.anthropic.com/2025/automated-auditing/)). Measured:

- Investigator solves the auditing game **13%** alone (17% with a hint); access to interpretability tools / semantic search is **critical (+10-20%)**.
- Evaluation agent discriminates implanted behaviours in **88%** of runs; failures cluster on subtle behaviours.
- Red-teaming agent finds **7/10** implanted behaviours but **requires human review** of transcripts.
- **The aggregation finding directly validates a panel-with-chair.** A **"super-agent" that reviewed reports from 10 independent investigations had significantly higher win rates than any single investigator** — parallel-then-aggregate beats one long investigation.
- Stated limits: **dev/test contamination** (same environment for tuning and testing), synthetic-vs-real gap, agents "go down the wrong path early and fail to recover," agents struggle with subjective/subtle behaviours, agents "do not use tools the way expert human auditors would."
- Anthropic open-sourced **Petri** (Parallel Exploration Tool for Risky Interactions) for automated multi-agent auditing ([Anthropic, Petri](https://alignment.anthropic.com/2025/petri/)).

**Panel implication.** This ADR's design is *on-trend* and has a credible precedent — Anthropic ships essentially this pattern internally. Adopt three specifics directly: **(a)** the "super-agent reviews 10 reports" result is empirical support for the **chair-synthesises-N-experts** shape — parallel-independent-then-aggregate is the validated topology. **(b)** Each expert *generating fresh spot-checks* is exactly LM-red-teaming applied to a methodology; give experts the tools (codebase read access, the ability to run probes) the way the investigator agent needed interpretability tools — tooling was worth +10-20%. **(c)** Heed the failure modes: avoid dev/test contamination (the panel's spot-checks must be *freshly generated each run*, never a fixed reused suite the methodology can be tuned to pass), expect "wrong path early," and keep the chair's verdict reviewable by the human maintainer rather than auto-acted-upon — Anthropic explicitly keeps humans in the loop.

## 7. "AI reviewing AI" meta-evaluation — the consensus

Synthesising the surveys ([Survey on LLM-as-a-Judge, arXiv:2411.15594](https://arxiv.org/abs/2411.15594); [LLMs-as-Judges, arXiv:2412.05579](https://arxiv.org/html/2412.05579v2); [Can You Trust LLM Judgments?, arXiv:2412.12509](https://arxiv.org/abs/2412.12509)) and production guidance:

**Solid (high-confidence) findings:**
- A strong LLM judge ≈ human-human agreement (~80-85%) on preference tasks ([arXiv:2306.05685](https://arxiv.org/abs/2306.05685)).
- Diverse-family **juries beat single judges** on human-correlation *and* cost ([PoLL, arXiv:2404.18796](https://arxiv.org/html/2404.18796v2)).
- LLM judges carry **systematic, measurable bias** (position, verbosity, self-preference) — replicated across many studies ([arXiv:2410.02736](https://arxiv.org/html/2410.02736v1)).
- **Intrinsic self-correction of reasoning fails**; external/rubric signal is required ([arXiv:2310.01798](https://arxiv.org/abs/2310.01798)).
- **Calibration against a labelled gold set is mandatory** before trusting any judge in a gate ([OpenAI](https://developers.openai.com/api/docs/guides/evaluation-best-practices)).
- **Reliability needs multiple samples** — judgements are temperature-sensitive; single-sample verdicts are noisy ([Can You Trust LLM Judgments?, arXiv:2412.12509](https://arxiv.org/abs/2412.12509)).
- Parallel-independent-then-aggregate (chair over N investigators) **outperforms a single long run** ([Anthropic auditing](https://alignment.anthropic.com/2025/automated-auditing/)).

**Contested / unsettled findings — the ADR must hedge these:**
- **Whether a diverse jury achieves real independence.** Disputed: PoLL says juries cut intra-model bias; Correlated-Errors says even cross-provider models err together and correlation *worsens* with capability ([arXiv:2506.07962](https://arxiv.org/html/2506.07962v1)). **Net: juries reduce but do not remove the shared blind spot.**
- **Whether multi-agent debate helps.** The 2023 result is real but the 2025 correction shows it needs heterogeneity and is otherwise circular ([arXiv:2502.08788](https://arxiv.org/pdf/2502.08788)); debate can also regress to sycophantic wrong-consensus ([arXiv:2509.23055](https://arxiv.org/html/2509.23055v1)).
- **Preference leakage / contamination.** If a judge and the thing it judges share base model, training data, or instruction-tuning preferences, the judge over-rates that output; mitigation = different-lineage judges, documented judge provenance, cross-validation with structurally different models ([Preference Leakage, arXiv:2502.01534](https://arxiv.org/pdf/2502.01534)).
- **LLM judges on reasoning-heavy tasks** are explicitly called "not sufficiently reliable" by one survey ([arXiv:2412.05579](https://arxiv.org/html/2412.05579v2)) — and methodology-auditing *is* reasoning-heavy.

## Summary of design directives for the ADR

1. **The panel is justified** — diverse juries beat single judges on quality *and* cost (PoLL), and parallel-then-aggregate beats one long run (Anthropic). Both are measured results, not speculation.
2. **Engineer independence deliberately; do not assume it.** Correlated errors are the dominant risk. Vary model family where the harness allows; where it does not, decorrelate via distinct adversarial roles + **per-expert fresh spot-checks** against the real codebase. Prompt-diversity alone is not independence.
3. **Treat unanimity as weak evidence.** A 6/6 "all fine" verdict is the correlated-consensus / sycophancy failure mode. The chair should weight *concrete surfaced defects* and *preserved disagreement* over agreement, and flag debates that collapsed to consensus in round 1.
4. **The panel must be external to the methodology** — agents that did not build the ontology, auditing artefacts they did not author. Self-grading is the intrinsic-self-correction setup that degrades quality.
5. **Anchor the panel in a written constitution/rubric** for "good process / progress / cost." RLAIF and CALM both show AI judging is reliable only when rubric-grounded.
6. **Fresh spot-checks are the external oracle** that makes the panel reliable — and they must be *freshly generated each run* to avoid dev/test contamination and prevent the methodology being tuned to pass a fixed suite.
7. **Inspect the trajectory, not just artefacts** — Agent-as-a-Judge's 92% vs 71% gap is the value of auditing the substrate→sidecar→reducer chain and prompts, not only final outputs.
8. **Use thinking/extended-reasoning models for the experts** — code-judging quality tracks reasoning ability over parameter count.
9. **Beware artefact self-declarations** — a sidecar that claims "complete and correct" triggers the +34-pt self-declared-correctness bias; experts must verify against the codebase, never against the methodology's narration.
10. **Bound debate to 1-2 rounds, sample more than once, calibrate against a gold set, keep the human maintainer as the final reader** of the chair's verdict — do not auto-act on it.

## Sources

- [Zheng et al. 2023 — Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena (arXiv:2306.05685)](https://arxiv.org/abs/2306.05685)
- [Liu et al. 2023 — G-Eval: NLG Evaluation using GPT-4 (arXiv:2303.16634)](https://arxiv.org/abs/2303.16634)
- [Verga et al. 2024 — Replacing Judges with Juries / PoLL (arXiv:2404.18796)](https://arxiv.org/html/2404.18796v2)
- [Justice or Prejudice? Quantifying Biases in LLM-as-a-Judge (arXiv:2410.02736)](https://arxiv.org/html/2410.02736v1)
- [Self-Preference Bias in LLM-as-a-Judge (arXiv:2410.21819)](https://arxiv.org/html/2410.21819v2)
- [Gu et al. 2024 — A Survey on LLM-as-a-Judge (arXiv:2411.15594)](https://arxiv.org/abs/2411.15594)
- [Li et al. 2024 — LLMs-as-Judges: A Comprehensive Survey (arXiv:2412.05579)](https://arxiv.org/html/2412.05579v2)
- [Can You Trust LLM Judgments? Reliability of LLM-as-a-Judge (arXiv:2412.12509)](https://arxiv.org/abs/2412.12509)
- [Du et al. 2023 — Improving Factuality and Reasoning through Multiagent Debate (arXiv:2305.14325)](https://arxiv.org/abs/2305.14325)
- [Stop Overvaluing Multi-Agent Debate (arXiv:2502.08788)](https://arxiv.org/pdf/2502.08788)
- [Peacemaker or Troublemaker: How Sycophancy Shapes Multi-Agent Debate (arXiv:2509.23055)](https://arxiv.org/html/2509.23055v1)
- [Talk Isn't Always Cheap: Failure Modes in Multi-Agent Debate (arXiv:2509.05396)](https://arxiv.org/pdf/2509.05396)
- [Too Polite to Disagree: Sycophancy Propagation in Multi-Agent Systems (arXiv:2604.02668)](https://arxiv.org/html/2604.02668)
- [CodeJudge: Evaluating Code Generation with LLMs (arXiv:2410.02184)](https://arxiv.org/pdf/2410.02184)
- [CodeJudgeBench: Benchmarking LLM-as-a-Judge for Coding Tasks (arXiv:2507.10535)](https://arxiv.org/abs/2507.10535)
- [Don't Judge Code by Its Cover: Biases in LLM Judges for Code (arXiv:2505.16222)](https://arxiv.org/html/2505.16222v1)
- [Zhuge et al. 2024 — Agent-as-a-Judge: Evaluate Agents with Agents (arXiv:2410.10934)](https://arxiv.org/html/2410.10934v2)
- [AgentRewardBench: Evaluating Automatic Evaluations of Web Agent Trajectories (arXiv:2504.08942)](https://arxiv.org/pdf/2504.08942)
- [Bai et al. 2022 — Constitutional AI: Harmlessness from AI Feedback (arXiv:2212.08073)](https://arxiv.org/abs/2212.08073)
- [Anthropic — Constitutional AI](https://www.anthropic.com/research/constitutional-ai-harmlessness-from-ai-feedback)
- [Madaan et al. 2023 — Self-Refine: Iterative Refinement with Self-Feedback (arXiv:2303.17651)](https://arxiv.org/abs/2303.17651)
- [Huang et al. 2023 — Large Language Models Cannot Self-Correct Reasoning Yet (arXiv:2310.01798)](https://arxiv.org/abs/2310.01798)
- [LLMs Cannot Find Reasoning Errors, But Can Correct Them Given the Error Location (arXiv:2311.08516)](https://arxiv.org/pdf/2311.08516)
- [Perez et al. 2022 — Red Teaming Language Models with Language Models (arXiv:2202.03286)](https://arxiv.org/abs/2202.03286)
- [Automatic LLM Red Teaming (arXiv:2508.04451)](https://arxiv.org/abs/2508.04451)
- [Holistic Automated Red Teaming via Top-Down Test Case Generation (arXiv:2409.16783)](https://arxiv.org/html/2409.16783v1)
- [Anthropic — Building and evaluating alignment auditing agents](https://alignment.anthropic.com/2025/automated-auditing/)
- [Anthropic — Petri: open-source auditing tool](https://alignment.anthropic.com/2025/petri/)
- [Correlated Errors in Large Language Models (arXiv:2506.07962)](https://arxiv.org/html/2506.07962v1)
- [Preference Leakage: A Contamination Problem in LLM-as-a-judge (arXiv:2502.01534)](https://arxiv.org/pdf/2502.01534)
- [OpenAI — Evaluation best practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices)

## Confidence + open questions

**Overall confidence: HIGH.** The seven themes are each backed by multiple peer-reviewed or frontier-lab sources, and the two pivotal claims for this ADR — (1) diverse juries beat single judges, (2) LLM judges/ensembles have correlated, capability-rising errors — are independently replicated. The "solid vs. contested" split above is itself well-supported: the contested items are contested *in the literature*, not merely uncertain to this author.

**Open questions the ADR should resolve with its own design, not further literature search:**
1. **Model-family diversity inside Claude Code.** The strongest decorrelation lever (disjoint model families, per PoLL) may be unavailable if all subagents run on one model. The ADR must decide how much independence is recoverable from role-diversity + fresh-spot-check-diversity alone — the literature gives no clean number for that substitute.
2. **Calibrating a *methodology* auditor.** Gold-set calibration is well-defined for output-quality judging; calibrating a panel that judges *process/progress/cost* of a methodology has no direct precedent. The ADR will need to define what a "labelled gold set" even means here (e.g. seeded known-bad ontology fragments / known process violations).
3. **Cost of the panel itself.** PoLL's 7-8× saving is *small judges vs. one big judge for output scoring*; a 6-expert panel that each generates fresh spot-checks and runs probes is a different, heavier cost shape. The ADR's COST artefact should model this directly rather than inherit PoLL's figure.
4. **Run cadence vs. drift.** None of the surveyed work addresses how often to re-audit a continuously-evolving methodology — "periodic, on-demand" is a reasonable default but is an ADR design choice, not a literature finding.
