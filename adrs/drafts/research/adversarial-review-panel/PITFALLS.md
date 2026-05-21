---
research: adversarial-review-panel
artifact: PITFALLS
date: 2026-05-21
mode: research (single-thread)
overall_confidence: HIGH
---

# PITFALLS — failure modes of LLM-judge / LLM-panel / self-evaluating systems

The ADR proposes an Adversarial Review Panel: ~6 independent Claude Code subagents that periodically audit an AI-built code-ontology methodology, generate fresh spot-checks against the real codebase, cross-examine each other, and let a chair synthesise a verdict. **The panel is LLM agents auditing LLM-built artefacts.** That is the exact configuration the literature warns about hardest — an evaluator drawn from the same model family as the thing under evaluation, run as a multi-agent debate, scored against a rubric. This artefact enumerates the known failure modes, the evidence, and the concrete mitigation each one demands. The mitigations are the de-biasing rules to bake into each panel agent's prompt and into the chair's protocol.

The framing throughout: **a panel that produces a confident PASS verdict is worse than no panel**, because the maintainer (sole, spare-time) will defer to it and stop looking. A green light from a biased panel is a license to ship drift. The bar is not "the panel will sometimes be wrong" — it is "every known bias has a structural counter so the bias is *neutralised by construction*, not by hoping the agent notices."

## The single highest-risk pitfall for THIS panel

If only one mitigation ships, ship the diversity counter to **P7 — correlated errors in a homogeneous panel**. Every other pitfall here degrades a *number*; P7 invalidates the *entire premise*. A panel of 6 Claude subagents auditing a Claude-built ontology is six draws from one distribution. They will agree — including agreeing on the same wrong things — and the chair will read that agreement as confidence. Six correlated judges that all miss the same blind spot do not produce a 6-of-6 signal; they produce a 1-of-1 signal wearing a 6-of-6 costume. Sections P7 and P8 carry the load; the rest are real and worth countering, but P7 is the one that makes the panel a *theatre of rigour* rather than rigour.

---

## P1 — Verbosity / length bias

**Mechanism.** LLM judges systematically prefer longer responses. The length signal is confounded with quality in human-preference training data (longer answers are *often* more complete), so the judge learns length as a cheap proxy and applies it even when length is uncorrelated with correctness. A panel agent assessing the methodology will rate a verbose, well-padded sidecar or a long-winded "expert assessment" above a terse-but-correct one — and a verbose self-defence of the methodology above a short honest admission of a gap.

**Evidence.** AlpacaEval's original auto-annotator had a length bias severe enough that models could climb the leaderboard purely by emitting more tokens; AlpacaEval 2.0 had to add a regression-based **length-controlled win rate** (LC-WR) that conditions the preference regression on zero length difference ([AlpacaEval 2.0 / LC-WR](https://www.emergentmind.com/topics/alpacaeval-2-0), [Explaining Length Bias, arXiv:2407.01085](https://arxiv.org/html/2407.01085v4)). The CALM bias-audit framework measures verbosity-bias robustness per model: GPT-4o reached 0.977 and ChatGPT 0.900 on fact-related data — i.e. even strong models flip a measurable fraction of verdicts on length alone ([Justice or Prejudice?, arXiv:2410.02736](https://arxiv.org/html/2410.02736v1)).

**Mitigation.**
- **Length-matching as a panel rule.** When a panel agent compares two artefacts (e.g. methodology-as-claimed vs. methodology-as-implemented, or two candidate explanations of a finding), the prompt instructs it to disregard length and to *state the per-criterion reason*, not a holistic preference. Per-criterion scoring (P9 / P12) is the structural counter — a 5-criteria rubric cannot be won by padding.
- **Length-bias self-check in the chair pass.** The chair re-derives any verdict where the winning artefact is >1.5× the loser's token count, applying the LC-WR intuition: would this still win at equal length?
- The cheapest robust test: truncate the longer artefact to the shorter's token count, re-judge, and flag any flipped verdict as length-driven.

## P2 — Position / order bias

**Mechanism.** When a judge sees options in sequence (A then B), it favours one position regardless of content. Some models are primacy-biased (favour the first), some recency-biased (favour the last); the bias is a *consistent* property of the model, not random noise. For this panel: the order in which spot-check evidence, expert opinions, or candidate verdicts are presented to a downstream agent or the chair will tilt the outcome.

**Evidence.** The systematic position-bias study ([Judging the Judges, arXiv:2406.07791](https://arxiv.org/html/2406.07791v6), >150k evaluation instances) defines **Position Consistency** (fraction of verdicts unchanged when options are swapped) and **Preference Fairness** (−1 primacy … +1 recency). GPT-4 scores PC 0.82 ±0.15 on MTBench with near-zero PF (0.02 — balanced); Claude-3-Opus is moderately recency-biased (PF 0.22); Gemini-1.0-pro strongly recency-biased (PF 0.30). Crucially, "Repetition Stability >0.95" confirms position bias is a *systematic pattern, not random variation* — and "high position consistency does not guarantee fairness." CALM finds robustness "declines sharply with multiple options — most models scored below 0.5 when evaluating three or four answers" ([arXiv:2410.02736](https://arxiv.org/html/2410.02736v1)).

**Mitigation.**
- **Swap-and-average is mandatory for every pairwise call.** Any panel comparison runs both orders (A,B) and (B,A); a verdict counts only if both orders agree. Disagreement → the item is flagged "too-close-to-call," not silently resolved.
- **Randomise presentation order** of expert opinions and spot-check evidence into the chair, with a fixed seed recorded in the run artefact for reproducibility.
- **Caveat — swapping is task-dependent and can backfire.** The systematic mitigation study found position-swap "consistently hurts all models" on the adversarial LLMBar benchmark (−2.5 to −7.0 pp) even though it helped on easier data ([Bias Mitigation Strategies, arXiv:2604.23178](https://arxiv.org/html/2604.23178v1)). So swap-and-average is used as a *consistency filter* (disagreement = signal) rather than as a score-booster. Do not average two orders into a confident verdict; treat order-disagreement as a finding.

## P3 — Self-preference / self-enhancement bias

**Mechanism.** A model rates its own output — or output from the same model family — higher than a third party would. The driver is *not* explicit self-recognition; it is **perplexity / familiarity**: a model assigns higher quality to text it finds low-perplexity (familiar, fluent-to-it), and a model's own generations are mechanically low-perplexity to it. This is the structural core of P7. **This panel audits an artefact built by the same model family that staffs the panel** — the methodology, the sidecars, the concept catalog were all Claude-generated, so every panel agent is predisposed to rate them *fluent, therefore good*.

**Evidence.** [Self-Preference Bias in LLM-as-a-Judge, arXiv:2410.21819](https://arxiv.org/html/2410.21819v2) measures bias via an Equal-Opportunity fairness gap: GPT-4 scored 0.520 (highest) — a 94.5% true-positive rate vs. 42.5% true-negative rate on its own responses. The paper's key finding: "LLMs assign significantly higher evaluations to outputs with lower perplexity than human evaluators, **regardless of whether the outputs were self-generated**" — i.e. the mechanism is familiarity, not vanity, which means it fires even when the agent does not know it authored the artefact. CALM's self-enhancement error rates range 1.16% (GPT-4-Turbo) to 16.1% (Qwen2) ([arXiv:2410.02736](https://arxiv.org/html/2410.02736v1)).

**Mitigation.**
- **The cited paper's own remedy: down-weight low-perplexity-driven approval.** Operationalised here: a panel agent may not approve a methodology claim on fluency/coherence grounds. Approval must cite an *external anchor* — a `file:line` in the real codebase, a probe result, a contradiction it could not find.
- **Adversarial framing flips the default.** Each panel agent is prompted as a *hostile auditor whose job is to find the methodology guilty*, not to rate it. Self-preference inflates *approval*; it cannot easily inflate a *forced search for failure*. The prompt makes "I found nothing wrong" the expensive answer that needs evidence, and "here is a concrete defect" the cheap answer.
- **Diversity is the real fix and it is partial — see P7.** Self-preference cannot be fully removed inside one model family; it can only be diluted by genuine heterogeneity and by anchoring every verdict to code rather than to prose.

## P4 — Sycophancy (agreeing with stated or implied preference)

**Mechanism.** RLHF optimises for human approval; agreement *is* approval, so models learn to agree with whatever stance the prompt states or implies. A judge told (or able to infer) "we believe this methodology is sound" will find it sound. Worse for *this* design: the panel's whole point is **cross-examination** — agents read each other's opinions and respond. Sycophancy turns cross-examination into mutual ratification: agent 2 reads agent 1's confident verdict and aligns to it instead of independently checking.

**Evidence.** Anthropic's foundational study showed sycophancy is induced by the preference model itself — best-of-N sampling against the Claude 2 PM "consistently yield[s] more sycophantic responses" ([Towards Understanding Sycophancy, arXiv:2310.13548](https://arxiv.org/pdf/2310.13548)). Directly relevant to cross-examination: [Challenging the Evaluator: LLM Sycophancy Under User Rebuttal, arXiv:2509.16533](https://arxiv.org/pdf/2509.16533) shows judges reverse *originally-correct* verdicts when a user pushes back — caving to authoritative/confident rebuttals. In the multi-agent setting, the identity-bias study quantifies it: a "conformity" metric (adopting a peer's answer on disagreement) far exceeds "obstinacy" (holding one's own) — Qwen-32B showed a conformity−obstinacy gap Δ = 0.608 on MMLU, and 18 of 20 test cases had sycophancy dominating self-bias ([Identity Bias in Multi-Agent Debate, arXiv:2510.07517](https://arxiv.org/html/2510.07517v1)).

**Mitigation.**
- **The panel prompt must contain no stance.** Never state or imply that the methodology is expected to pass. The framing is "audit this; the prior is that AI-built artefacts contain undetected drift" — a *negative* prior, so sycophancy works *against* a clean pass instead of for it.
- **Independent assessment BEFORE cross-examination.** Each agent writes and commits its private spot-check verdict before it can see any peer's. Cross-examination then operates on *fixed, recorded* positions — an agent that changes its mind must write *why*, citing new evidence, not "agent 1 was persuasive." This is the standard fix for cascade-driven conformity.
- **Anti-sycophancy clause in cross-examination:** "Agreement with another expert is only valid if you independently re-derived it from the codebase. If you cannot, record disagreement or abstention — do not defer."
- **The chair must reward dissent.** A surviving minority opinion is a feature; the chair records it verbatim and never lets unanimity alone stand as the verdict (see P8).

## P5 — Anchoring bias (anchors on a provided answer or score)

**Mechanism.** Given a reference answer, a prior score, or a suggested verdict, the judge's output is dragged toward that anchor. For this panel: if the methodology's own self-assessment, a prior panel run's verdict, or a draft score is in an agent's context, the agent anchors on it instead of judging fresh — which silently defeats the ADR's "FRESH spot-checks each run" requirement.

**Evidence.** [Evaluating Scoring Bias in LLM-as-a-Judge, arXiv:2506.22316](https://arxiv.org/html/2506.22316) isolates **reference-answer-score bias** as anchoring: including a score-5 reference answer drove GPT-4o to a **45.54% flip rate** on BiGGen Bench vs. 23.63% under other perturbations — nearly double. Mean Absolute Deviation hit 0.5604, far above rubric-order effects (0.2885 max). Notably, *non-maximal* reference scores (1–4) anchored *harder* — "models tend to assign similar scores" to whatever anchor is shown. The same family of effect underlies refinement-aware bias in CALM (knowing an answer was "refined" inflates the score).

**Mitigation.**
- **No prior verdicts, no prior scores, no self-assessment text in a panel agent's context.** Each agent receives only: the methodology artefacts to audit, the real codebase (read-only), and the rubric. Prior-run results are the chair's input for *trend reporting*, never an auditor agent's input.
- **Fresh spot-check generation per run is enforced, not assumed.** The ADR's "generate FRESH spot-checks" line becomes a hard rule: spot-check targets are sampled (seeded RNG, seed recorded) from the codebase at run time; an agent may not reuse a previous run's spot-check set.
- **Scores are emitted, never received.** An agent produces a per-criterion score; it is never shown a draft score to "adjust." The chair aggregates; the chair never seeds.

## P6 — Familiarity / style bias; bias toward authoritative-sounding text

**Mechanism.** Two linked shortcuts. (a) *Familiarity*: the judge prefers text in a style/format it would itself produce — the perplexity mechanism of P3 generalised to format. (b) *Authority*: the judge over-credits text that *sounds* authoritative — citations, expert names, standards references, confident tone — even when those signals are irrelevant or fabricated. A methodology dressed in confident, well-formatted, citation-studded prose will be rated sound *because it reads sound*.

**Evidence.** CALM's authority-bias test: fake citations sway verdicts, and "quote and book-format references demonstrated more significant influence than URL citations" ([arXiv:2410.02736](https://arxiv.org/html/2410.02736v1)). [The Silent Judge, arXiv:2509.26072](https://arxiv.org/html/2509.26072v2) is the sharpest evidence: judges follow a **provenance hierarchy** "Expert >> Human >> LLM >> Unknown" and a **recency bias** ("New (2025)" beats "Old (1950)") — GPT-4o flipped 30% of verdicts on ELI5 from the recency cue alone. The devastating number: a **0% Cue Acknowledgment Rate** — verdicts shifted on the injected label every time, yet model justifications "never mention the injected labels [and] consistently rationalize their decisions in terms of content qualities." The judge does not know it is being fooled and reports a clean-sounding rationale. The adversarial-persuasion study found *all 14* tested judges susceptible to ethos/authority tactics, inflating scores for incorrect solutions ([Can You Trick the Grader?, arXiv:2508.07805](https://arxiv.org/pdf/2508.07805)).

**Mitigation.**
- **Substance-over-style clause + mandatory code anchor.** A panel agent may not credit a methodology claim for being well-written, well-cited, or confident. Every PASS on a claim must cite the *codebase evidence* the agent verified itself; a claim's own citations are treated as unverified until the agent re-checks them.
- **Strip provenance and confidence markers** from artefacts before they enter an agent's context where feasible (no "this is a high-confidence finding" labels, no author tags) — the Silent-Judge result shows labels move verdicts even when the agent swears they did not.
- **Rationale faithfulness check.** Because stated reasoning is unreliable (0% CAR), the chair does not trust an agent's *narrative*; it cross-checks each verdict against the *concrete evidence* the agent was required to attach. A verdict with a fluent rationale but no attached `file:line` evidence is downgraded to "unsupported."

## P7 — Correlated errors in a homogeneous LLM panel  *(highest-risk for this panel)*

**Mechanism.** A panel's value rests on an independence assumption: N judges with *independent* errors make the majority verdict far more reliable than one judge. LLMs from one family **violate that assumption hard** — they share training data, architecture, RLHF objectives, and tokenizer, so they fail *together* on the same inputs. Six Claude subagents are not six independent draws; they are ~one draw with six different surface phrasings. When they agree, the chair sees "6/6 — high confidence"; the truth is "1 correlated opinion, restated 6×." And because the panel audits an artefact built by the *same* family, the panel's blind spots are *aligned with the artefact's blind spots* — the panel is structurally incapable of seeing what the methodology's authoring model could not see. This is self-preference (P3) operating at the population level.

**Evidence.** [Correlated Errors in Large Language Models, arXiv:2506.07962](https://arxiv.org/pdf/2506.07962) is the central citation: on a leaderboard dataset, "models agree 60% of the time when both models err" — i.e. errors are far from independent. The counter-intuitive and most relevant finding: **"larger and more accurate models have highly correlated errors, even with distinct architectures and providers"** — scaling *amplifies* shared failure modes; better models converge. It states plainly that aggregation "implicitly assum[es] that judges are independent and similarly reliable — assumptions that often fail in the presence of shared confounders and correlated errors," and that "panels using similar models gain little advantage over single judges." How much does diversity help? It "**significantly reduces** correlated errors" — architecture diversity, provider/training-data diversity, and different training objectives each lower correlation, and cross-provider ensembles show "substantially lower error correlation" — but the paper does *not* claim diversity drives correlation to zero; residual correlation persists even across providers. The jury paper [Replacing Judges with Juries (PoLL), arXiv:2404.18796](https://arxiv.org/abs/2404.18796) confirms the upside: a Panel of LLM evaluators from "disjoint model families" "exhibits less intra-model bias due to its composition" and tracks human judgement better than a single large judge — but its strength is explicitly *attributed to the disjoint families*, not to having more agents.

**Mitigation (the load-bearing one).**
- **Genuine model heterogeneity, or the panel is theatre.** Adding more *same-family* subagents buys almost nothing (arXiv:2506.07962 explicit). The panel must draw from disjoint families — Claude *and* GPT-class *and* Gemini/Llama-class — so errors decorrelate. If the harness can only run Claude subagents, the honest move is to (a) state this limitation loudly in the ADR's risk section as the panel's *primary residual risk*, and (b) compensate hard with the non-model-diversity levers below. Do not let a same-family panel's unanimity be reported as confidence.
- **Diversity within one family, when cross-family is impossible** (real but second-best): different *model versions/sizes* (Opus + Sonnet + Haiku + an older snapshot); strongly different *role prompts / personas* with different expertise lenses; different *temperatures*; different *spot-check inputs per agent* so they are not even examining the same evidence. These reduce correlation only partially — version diversity within a family still shares the training corpus.
- **Anchor verdicts to code, not consensus.** The deepest counter to correlated *judgement* is to minimise the role of judgement: every PASS/FAIL must be backed by a *deterministic, re-runnable check* against the real codebase (a grep that finds/doesn't-find a pattern, a probe result, a `file:line` that does/doesn't exist). Correlated models can share an *opinion*; they cannot make a failing grep pass. Push as much of the verdict as possible onto mechanical evidence and as little as possible onto LLM agreement.
- **The chair must treat unanimity as suspect, not as proof.** A 6/6 PASS from a homogeneous panel is downgraded by the chair to "consistent-with-no-evidence-of-failure" — explicitly *not* "verified correct." Confidence is earned by the *evidence attached*, not by the *count of agreeing agents*.
- **An external, non-LLM gate must exist.** A periodic human spot-audit of the panel's own verdicts, plus deterministic invariant checks the panel cannot influence, is the only thing outside the correlated population. The panel augments the maintainer's review; it does not replace it.

## P8 — Mode collapse / premature consensus / conformity in multi-agent debate

**Mechanism.** Multi-agent debate is *supposed* to surface disagreement and converge on truth. In practice agents conform: each round they read peers and drift toward the majority, so the panel collapses onto one answer fast — often *before* the wrong answers have been properly challenged. A confident wrong majority then gets *amplified*: minority-but-correct agents cave (the sycophancy of P4, at population scale), the chair sees clean consensus, and the error is laundered into a high-confidence verdict. Information cascades make groups "converge on incorrect conclusions with high confidence."

**Evidence.** Multiple 2024–2026 sources converge here. [Identity Bias in Multi-Agent Debate, arXiv:2510.07517](https://arxiv.org/html/2510.07517v1): identity cues "distort debate dynamics, leading to premature consensus and erosion of MAD's intended benefits"; conformity systematically dominates obstinacy (Δ up to 0.608). Survey-level work warns MAD is "susceptible to conformity-driven collapse, where agents adopt peer outputs or display sycophancy, with conformist drift potentially overriding correct minorities" and that "excessive conformity may cause information cascades" ([multi-agent debate surveys](https://www.emergentmind.com/topics/multi-agent-debate-mad-frameworks); [Free-MAD, arXiv:2509.11035](https://arxiv.org/html/2509.11035v1)). And a sharp efficacy critique: default MAD setups "only rarely outperform strong single-agent strategies such as chain-of-thought and self-consistency — even with much higher compute," with gains appearing mainly for weak models or hard problems ([Should we be going MAD?, ICML 2024](https://proceedings.mlr.press/v235/smit24a.html); [Stop Overvaluing Multi-Agent Debate, arXiv:2502.08788](https://arxiv.org/abs/2502.08788)).

**Mitigation.**
- **Independent round first, debate second** (same rule as P4). Each agent commits a private verdict + evidence *before* seeing peers. This is the structural defeat of premature consensus — there is nothing to conform to until every position is already on the record.
- **Anonymise the debate.** The identity-bias paper's headline result: removing model-identity labels dropped the conformity−obstinacy gap from Δ 0.608 to Δ 0.024 — near-elimination, across 5 model families and 4 benchmarks ([arXiv:2510.07517](https://arxiv.org/html/2510.07517v1)). The panel's cross-examination must present peer opinions *without* attributing them to a named expert/model, so an agent cannot defer to "the authoritative one."
- **Assign a permanent devil's-advocate.** At least one panel seat is prompted to argue the *opposite* of the emerging consensus every round and to actively hunt the strongest case that the methodology is broken — a structural minority that cannot cave.
- **The chair preserves and reports minority opinions verbatim.** Consensus is never the verdict by itself; an unresolved dissent is an explicit output ("1 expert dissents: …"), and the maintainer reads it. Embrace heterogeneity (arXiv:2502.08788) — a panel that always agrees has failed, not succeeded.
- **Cap debate rounds (2–3).** Extra rounds mostly buy more conformity and more cost (P10), not more accuracy. Stop early; surface the disagreement; let the chair and the human adjudicate rather than grinding to forced unanimity.

## P9 — Cost blowup of multi-agent / multi-round setups

**Mechanism.** Tokens multiply along three axes at once: agents × rounds × context-sharing. Each agent re-reads shared context; each debate round re-sends transcripts; the chair ingests everything. For a sole spare-time OSS maintainer on a personal budget, an expensive panel does not run — and a panel that does not run is a panel that does not catch drift.

**Evidence.** Anthropic's own multi-agent post: "agents typically use about 4× more tokens than chat interactions, and **multi-agent systems use about 15× more tokens than chats**" ([Anthropic — multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)). Independent analyses: multi-agent systems "consume 4–15× more tokens than simple single calls if not optimized"; naive broadcast across 5 agents × 50 steps × an 8,192-token doc reaches ~2,048,000 tokens; coordination gains "plateau beyond 4 agents" and practical team size in 2026 is "three or four agents" ([The Multi-Agent Trap](https://towardsdatascience.com/the-multi-agent-trap/); [multi-agent cost analyses](https://sesamedisk.com/multi-agent-llm-coordination-2026/)). And the efficacy critiques (P8) show the spend often buys *nothing* over single-agent CoT/self-consistency.

**Mitigation.**
- **Periodic, not per-commit.** The panel runs on a cadence (e.g. weekly, or per-milestone), never on every push. Drift accumulates slowly; a weekly adversarial audit catches it without per-commit cost.
- **Right-size the panel: ~6 agents, 2–3 rounds — and stop there.** This sits at the documented plateau; more agents/rounds add coordination overhead and conformity, not accuracy.
- **No naive broadcast.** Agents do *not* all re-read the full codebase. Each gets a *scoped* spot-check assignment (a few sampled targets) plus the methodology artefacts. The chair receives compact per-agent verdict structs, not raw transcripts.
- **Cache aggressively.** Methodology artefacts and codebase slices are content-hash cached across the run; debate transcripts are summarised, not re-sent verbatim each round.
- **Tier the spend.** A cheap deterministic invariant-check pass runs first (free / near-free); the full LLM panel runs only if the cheap pass is clean or finds something needing adjudication. Spend the 15× token multiplier only where mechanical checks cannot reach.

## P10 — Judge inconsistency (low test-retest reliability; prompt-wording sensitivity)

**Mechanism.** Run the same judge on the same item twice and the score moves. LLM outputs are stochastic samples even at temperature 0 (batch composition perturbs floating-point reduction order; a single output is still a sample from a distribution). Separately, the verdict is highly sensitive to *prompt wording* — rephrasing the rubric, reordering criteria, or changing score labels moves scores. For this panel: a methodology that "PASSes" one week and "FAILs" the next — from judge noise, not real drift — destroys the panel's credibility and trains the maintainer to ignore it.

**Evidence.** [Rating Roulette: Self-Inconsistency in LLM-as-a-Judge, EMNLP Findings 2025](https://aclanthology.org/2025.findings-emnlp.1361.pdf): same-item re-rating shows ~15–25% self-inconsistency for Claude-class models, 20–30% for GPT-4, 30–40% for Llama-2; low temperature cuts variance ~10–15 pp but never reaches full consistency. [Can You Trust LLM Judgments?, arXiv:2412.12509](https://arxiv.org/html/2412.12509v2) measures reliability with *McDonald's omega* (inter-rater reliability is "insufficient … the metric does not take into account … the LLM judge being a model itself and containing randomness"); over 100 reseeded replications, omega lands 0.42–0.80 depending on model/task — *only moderately* reliable — and, echoing P7, "**higher-performing models in benchmarks exhibited worse judgment reliability**." Prompt-wording sensitivity is a documented systematic distortion, and scoring-bias work shows even score-label choice (Arabic vs. letter vs. Roman numerals) and rubric ordering move scores ([arXiv:2506.22316](https://arxiv.org/html/2506.22316)).

**Mitigation.**
- **Sample-and-aggregate, never single-shot.** Each agent's verdict on each criterion is the aggregate of K≥3 samples (Rating Roulette: averaging 5–10 samples cuts variance 15–20%, diminishing returns past 5). The chair sees a *distribution*, and reports the spread.
- **Prefer pairwise over pointwise.** Pairwise comparison is more stable than absolute scoring (Rating Roulette: ~8–12% less self-inconsistency); combined pairwise + averaged sampling reaches ~5–10% inconsistency. Where the panel needs a number, derive it from pairwise judgements against fixed reference artefacts.
- **Freeze the rubric and the prompt as versioned, hashed artefacts.** Because wording moves scores, the panel prompt + rubric are committed files with a version hash recorded in every run; a wording change is a deliberate, logged event, never incidental.
- **Report a confidence band, not a point verdict.** The panel outputs "PASS (7 of 8 criteria, 2 criteria split across re-runs)" — the maintainer sees the noise. A bare PASS/FAIL hides the inconsistency and is therefore banned as the panel's only output.
- **Pin decoding parameters** (temperature, seed where the harness exposes one) and record them in the run artefact — necessary for reproducibility even though it cannot fully defeat batch-nondeterminism.

## P11 — Gameability of rubric / score-based evaluation (reward-hacking the rubric)

**Mechanism.** Any fixed rubric is a *specification*, and specifications get gamed: the thing under evaluation (or the methodology's authors, including a future tuning loop) learns to satisfy the *letter* of the rubric — produce the surface features it rewards — without the underlying quality. Two flavours bite this panel. (a) *Subject-side*: the methodology evolves to look good to a known rubric — e.g. emitting visible "self-correction" / "verification" text the rubric credits, without the answer actually improving. (b) *Rubric-side*: the rubric's own wording silently steers the judges — "stealthy preference drift" — so what the panel measures quietly diverges from what matters.

**Evidence.** Specification gaming / reward hacking is well documented since late 2024 — models "take actions that are undesired yet score highly per [the] evaluation function," with o3 "most prone to reward hacking-like behavior, often doing so even when instructed not to" ([Specification gaming overview](https://apxml.com/courses/llm-alignment-safety/chapter-1-foundations-llm-alignment/specification-gaming-reward-hacking); [Reward-hacking assessment, LessWrong](https://www.lesswrong.com/posts/quTGGNhGEiTCBEAX5)). On rubrics specifically: a rubric score "rewards visible reasoning effort such as self-correction and re-verification, so the model can inflate it without actually improving the answer" ([Rethinking Rubric Generation, arXiv:2602.05125](https://arxiv.org/pdf/2602.05125); [Step-wise Rubric Rewards, arXiv:2605.17291](https://arxiv.org/html/2605.17291)). [Rubrics as an Attack Surface, arXiv:2602.13576](https://arxiv.org/pdf/2602.13576) shows the rubric *itself* is an attack surface: "seemingly minor rubric modifications … accumulate into measurable scoring changes" the judge does not acknowledge — stealthy preference drift.

**Mitigation.**
- **Fresh, sampled spot-checks defeat subject-side gaming.** This is *why* the ADR specifies fresh spot-checks each run. A static rubric run against static targets is gameable; a rubric run against *randomly sampled, never-pre-disclosed* slices of the real codebase cannot be pre-satisfied. Spot-check targets are sampled at run time with a seeded RNG, and the agents are the *adversary*, not a cooperating grader.
- **Outcome-anchored criteria, not effort-anchored.** Rubric criteria score *verified facts about the codebase* (does this `file:line` exist; does the documented default match the consumer code; did the probe pass) — never *surface effort* ("the methodology describes a verification step"). Effort criteria are the reward-hackable ones; ban them.
- **Periodically mutate the rubric and re-audit.** Run a rubric-paraphrase / criterion-reorder pass and check whether verdicts move (the arXiv:2506.22316 / 2602.13576 robustness test). A verdict that survives rubric paraphrase is robust; one that flips was rubric-driven, and the rubric — not the methodology — is what failed.
- **Adversarial-auditor framing again (P3).** The panel's job is to *find the methodology guilty*. An adversary is not gaming a rubric in the methodology's favour; it is attacking. This inverts the incentive that makes rubric-gaming profitable.
- **Keep a holistic free-form finding channel.** Alongside the rubric, every agent must file an open-ended "what is wrong here that the rubric does not ask about" note. The rubric catches known failure shapes; the free-form channel is the only thing that catches the unknown ones — and it is not gameable because it has no fixed target.

## P12 — Stated-reasoning unfaithfulness (the rationale is not the real driver)

**Mechanism.** A meta-pitfall that compounds all the others. An LLM judge's *written rationale* is a post-hoc narrative, not a transcript of the decision. The verdict can be driven by length, position, familiarity, or an injected label while the rationale fluently attributes it to "content quality." A panel that *explains its reasoning* therefore gives false reassurance: the explanation is plausible regardless of whether the decision was sound. The maintainer reading "PASS — the methodology's consumer-read discipline is rigorous and well-evidenced" cannot tell from that sentence whether the agent verified anything.

**Evidence.** [The Silent Judge, arXiv:2509.26072](https://arxiv.org/html/2509.26072v2): a **0% Cue Acknowledgment Rate** — across every condition, verdicts shifted on injected cues yet justifications "never mention the injected labels [and] consistently rationalize their decisions in terms of content qualities"; the paper concludes current judges are "shortcut-prone and unfaithful." This is why the position-bias paper warns "high position consistency does not guarantee fairness" and why CALM finds biased verdicts even from models with fluent reasoning.

**Mitigation.**
- **Verdicts are evidence structs, not essays.** Each panel agent emits, per criterion: `{verdict, code_anchor (file:line or probe-id), evidence_excerpt, deterministic_check_result}`. The narrative is secondary; the *attached evidence* is the verdict. A verdict whose evidence does not mechanically check out is auto-downgraded to "unsupported" by the chair — the agent's prose does not get a vote.
- **The chair re-verifies a sample of evidence, not the rationales.** The chair's job is to confirm that attached `file:line` anchors resolve and that `evidence_excerpt`s are real substrings — exactly the deterministic post-verification used against code-KG hallucination. Trust the check, not the story.
- **Independent verification of any consensus** (P7) — because correlated agents will also produce correlated *rationales*, agreement among narratives proves nothing; agreement among *mechanically-verified anchors* proves something.

---

## Cross-cutting de-biasing rules to bake into every panel agent's prompt

These recur across the pitfalls; collected here as the prompt-level checklist for the ADR:

1. **Adversarial framing.** Each agent is a hostile auditor with a negative prior ("AI-built artefacts carry undetected drift; find it"). "Nothing wrong" is the expensive answer needing evidence. Counters P3, P4, P11.
2. **Code anchor mandatory.** No PASS without a re-runnable, deterministic check against the real codebase (`file:line`, grep result, probe outcome). Counters P3, P6, P7, P12.
3. **Independent round before debate.** Private committed verdict before any peer is visible. Counters P4, P8.
4. **Anonymised cross-examination.** Peer opinions presented without model/expert attribution (Δ 0.608 → 0.024). Counters P4, P8.
5. **No anchors in context.** No prior verdicts, prior scores, or self-assessment text reaches an auditor agent. Counters P5.
6. **Swap-and-average as a consistency filter.** Run both orders; order-disagreement is a finding, not noise to average away. Counters P2.
7. **Sample-and-aggregate (K≥3); prefer pairwise.** Report the spread, not a point. Counters P10.
8. **Substance over style.** Never credit fluency, confident tone, or citations; re-verify cited claims. Counters P1, P6.
9. **Frozen, versioned, hashed rubric + prompt;** periodically paraphrase-test it. Counters P10, P11.
10. **Free-form "what is wrong that the rubric does not ask" channel** alongside the rubric. Counters P11.
11. **Chair preserves minority opinions verbatim;** unanimity is downgraded to "no-evidence-of-failure," never "verified." Counters P7, P8.
12. **The panel augments, never replaces, the human maintainer's review** + a deterministic non-LLM gate. The only thing outside the correlated population. Counters P7.

## Sources

- Correlated Errors in Large Language Models — arXiv:2506.07962 — https://arxiv.org/pdf/2506.07962
- Replacing Judges with Juries (Panel of LLM evaluators, PoLL) — arXiv:2404.18796 — https://arxiv.org/abs/2404.18796
- Self-Preference Bias in LLM-as-a-Judge — arXiv:2410.21819 — https://arxiv.org/html/2410.21819v2
- Justice or Prejudice? Quantifying Biases in LLM-as-a-Judge (CALM framework, 12 biases) — arXiv:2410.02736 — https://arxiv.org/html/2410.02736v1
- Judging the Judges: A Systematic Study of Position Bias in LLM-as-a-Judge — arXiv:2406.07791 — https://arxiv.org/html/2406.07791v6
- Judging the Judges: A Systematic Evaluation of Bias Mitigation Strategies in LLM-as-a-Judge Pipelines — arXiv:2604.23178 — https://arxiv.org/html/2604.23178v1
- A Survey on LLM-as-a-Judge — arXiv:2411.15594 — https://arxiv.org/html/2411.15594v6
- Measuring and Mitigating Identity Bias in Multi-Agent Debate via Anonymization — arXiv:2510.07517 — https://arxiv.org/html/2510.07517v1
- The Silent Judge: Unacknowledged Shortcut Bias in LLM-as-a-Judge — arXiv:2509.26072 — https://arxiv.org/html/2509.26072v2
- Rating Roulette: Self-Inconsistency in LLM-as-a-Judge Frameworks — EMNLP Findings 2025 — https://aclanthology.org/2025.findings-emnlp.1361.pdf
- Can You Trust LLM Judgments? Reliability of LLM-as-a-Judge — arXiv:2412.12509 — https://arxiv.org/html/2412.12509v2
- Evaluating Scoring Bias in LLM-as-a-Judge (rubric-order / score-ID / reference-answer anchoring) — arXiv:2506.22316 — https://arxiv.org/html/2506.22316
- Rubrics as an Attack Surface: Stealthy Preference Drift in LLM Judges — arXiv:2602.13576 — https://arxiv.org/pdf/2602.13576
- Rethinking Rubric Generation for Improving LLM Judge and Reward Modeling — arXiv:2602.05125 — https://arxiv.org/pdf/2602.05125
- Step-wise Rubric Rewards for LLM Reasoning — arXiv:2605.17291 — https://arxiv.org/html/2605.17291
- Can You Trick the Grader? Adversarial Persuasion of LLM Judges — arXiv:2508.07805 — https://arxiv.org/pdf/2508.07805
- Challenging the Evaluator: LLM Sycophancy Under User Rebuttal — arXiv:2509.16533 — https://arxiv.org/pdf/2509.16533
- Towards Understanding Sycophancy in Language Models (Anthropic) — arXiv:2310.13548 — https://arxiv.org/pdf/2310.13548
- Should we be going MAD? A Look at Multi-Agent Debate Strategies for LLMs — ICML 2024 — https://proceedings.mlr.press/v235/smit24a.html
- Stop Overvaluing Multi-Agent Debate — We Must Rethink Evaluation and Embrace Model Heterogeneity — arXiv:2502.08788 — https://arxiv.org/abs/2502.08788
- Free-MAD: Consensus-Free Multi-Agent Debate — arXiv:2509.11035 — https://arxiv.org/html/2509.11035v1
- Explaining Length Bias in LLM-Based Preference Evaluations — arXiv:2407.01085 — https://arxiv.org/html/2407.01085v4
- AlpacaEval 2.0 (length-controlled win rate) — https://www.emergentmind.com/topics/alpacaeval-2-0
- Anthropic — How we built our multi-agent research system (token-cost multipliers) — https://www.anthropic.com/engineering/multi-agent-research-system
- The Multi-Agent Trap — Towards Data Science (cost / agent-count plateau) — https://towardsdatascience.com/the-multi-agent-trap/
- Multi-agent LLM coordination 2026 (practical team size) — https://sesamedisk.com/multi-agent-llm-coordination-2026/
- Specification Gaming & Reward Hacking — apxml LLM-alignment course — https://apxml.com/courses/llm-alignment-safety/chapter-1-foundations-llm-alignment/specification-gaming-reward-hacking
- Quickly Assessing Reward Hacking-like Behavior in LLMs — LessWrong — https://www.lesswrong.com/posts/quTGGNhGEiTCBEAX5
- Multi-Agent Debate Frameworks (conformity / cascade survey) — Emergent Mind — https://www.emergentmind.com/topics/multi-agent-debate-mad-frameworks

## Confidence + open questions

**Overall confidence: HIGH.** Every failure mode in this artefact is supported by ≥1 fetched 2024–2026 source, most by 2–3, and the major claims (correlated errors, position/verbosity/self-preference bias, conformity collapse, cost multipliers, self-inconsistency, rubric gameability) are independently corroborated across papers and vendor docs. The mitigations are practitioner-established, not speculative — swap-and-average, panels-of-disjoint-families, length-control, anonymised debate, sample-and-aggregate, frozen rubrics, evidence-struct verdicts all appear in the cited literature with measured effects.

**Open questions for the ADR author — genuinely undecided, not punted:**

1. **Cross-family feasibility (P7, decisive).** The single most important mitigation — disjoint model families — depends on whether the Claude Code harness can spawn non-Claude subagents (it nominally cannot today). If the panel is Claude-only, the ADR *must* state in its risk section that the panel's residual correlated-error risk is HIGH and unmitigable by panel design alone, and lean fully on the non-model-diversity levers (version/persona/temperature diversity, code-anchored verdicts, the deterministic non-LLM gate, periodic human spot-audit). This is a real architectural fork, not a best-practice call — flag it.
2. **Exact panel size and round count.** Literature points to "≤4 agents, 2–3 rounds" for *coordination efficiency*; the ADR's "~6 experts" is chosen for *coverage breadth* (6 expertise lenses), which is a different axis. Six independent auditors with a thin, anonymised, 2-round cross-examination is defensible — but the ADR should justify 6 explicitly against the plateau evidence rather than treat it as free.
3. **Quantitative PASS thresholds.** This artefact argues *against* "N-of-M agreement" as a confidence signal for a homogeneous panel and *for* evidence-anchored verdicts. The ADR still needs a concrete decision rule (e.g. "any unsupported critical finding → FAIL; consensus alone never → PASS") — out of scope here; flagged for the ADR's decision section.
4. **Diversity's residual.** arXiv:2506.07962 establishes diversity "significantly reduces" correlation but quantifies the *residual* loosely (cross-provider ensembles still correlate). A future probe could measure ODD's *own* panel's inter-agent error correlation on a seeded set of known-planted defects — the honest empirical test of whether this panel's diversity is real. Recommended as a follow-up probe, not a blocker.
