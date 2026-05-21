---
research: adversarial-review-panel
artifact: COMPARISON
date: 2026-05-21
mode: research (single-thread)
overall_confidence: HIGH
---

# COMPARISON — Panel architectures for an LLM adversarial review panel: single judge vs independent aggregation vs debate vs panel-then-cross-examination

## Scope

The ADR asks how to architect the Adversarial Review Panel: how many agents, whether
they interact, how many rounds, how findings aggregate. Four candidate architectures:

- **(a) Single LLM judge** — one agent produces the verdict.
- **(b) Independent panel + aggregate** — N judges assess independently, no interaction;
  aggregate by vote (categorical) or average (scored). The "Panel of LLM evaluators" (PoLL) / jury pattern.
- **(c) Multi-agent debate** — judges interact over multiple rounds, argue, revise toward consensus.
- **(d) Panel → one cross-examination round → chair synthesis** — N independent assessments;
  then ONE round where each agent reads the others and files a rebuttal/corroboration memo;
  then a synthesizer ("chair") produces the verdict. No convergence pressure, no multi-round drift.

The panel audits an AI-built code-ontology methodology and runs **periodically** (cost-conscious),
not per-commit. That shapes the recommendation: accuracy and bias-robustness dominate; raw latency
does not; but per-run token cost still matters because the panel recurs.

## Comparison table

| Dimension | (a) Single judge | (b) Independent panel + aggregate | (c) Multi-agent debate | (d) Panel + 1 cross-exam + chair |
|---|---|---|---|---|
| Accuracy vs human | Baseline. Verga: GPT-4 κ 0.627 on NQ | **Best of the cheap options.** PoLL κ 0.763 vs GPT-4 0.627; Arena Pearson 0.917 vs 0.817 | Modest gain *when it works* (ChatEval +2.5–6.2pp; JudgeBench +4.4pp) but frequently negative | Independent-panel accuracy as the floor; cross-exam catches the errors aggregation silently averages in |
| Robustness to known biases | Worst — full self-preference, verbosity, position bias, single point of failure | Strong vs self-preference *if families differ* (variance 2.2 vs 6.1 single); does not fix correlated error | **Adds sycophancy/conformity bias** — modal sycophancy to 85.5%, disagreement-collapse 27–86% | Strong: independence preserved through round 1; cross-exam surfaces correlated blind spots without convergence pressure |
| Cost (tokens / run) | 1× | ~Nx parallel calls; PoLL of small models 7–8× *cheaper* than one GPT-4 | 2.1–3.4× vs independent for equal-or-worse accuracy | ~N + N + 1 calls ≈ 2–2.5× independent panel; bounded, no round explosion |
| Operational complexity | Lowest | Low — N parallel calls + a vote/average function | Highest — turn-taking, transcript routing, termination detection, drift monitoring | Moderate — fixed 3-phase pipeline, no loop, no convergence logic |
| What the literature reports | Reliable but biased; "single-call judgments fundamentally unreliable" | PoLL/jury beats single large judge on accuracy AND cost; 3–5 judges a sweet spot | Contested: ChatEval/Du positive; "Talk Isn't Always Cheap", "Cost of Consensus", problem-drift papers strongly negative for homogeneous unguided debate | No single paper names this exact shape, but every component is literature-backed: independent-first (agreeableness-bias paper), one structured exchange (debate-as-oversight), synthesis aggregation (meta-judge work) |

## (a) Single LLM judge

**Reliability.** A competent baseline and the cheapest option, but the floor. Verga et al.
(arXiv:2404.18796) measure GPT-4-as-judge at Cohen's κ 0.627 on Natural Questions, 0.841 on
TriviaQA — and a panel of three *smaller* models beats it (0.763 / 0.906). On Chatbot Arena
ranking GPT-4 reaches Pearson 0.817 vs the panel's 0.917. A single judge is also a single point
of failure: token sampling makes "single-call judgments fundamentally unreliable" (Galileo;
the jury-on-demand line of work).

**Bias.** Worst on every known axis. Self-preference is direct and measured: Verga shows GPT-4
ranking a sibling GPT-4 variant at position 2 instead of its true position 4, and "individual
models showed highest positive bias when judging their own family's outputs." Verbosity bias,
position bias, and leniency all land undiluted with no second opinion to cancel them.

**Verdict.** Adequate only when cost is the sole constraint. For an *adversarial* panel whose
entire purpose is independent scrutiny, a single judge contradicts the mandate. Rejected.

## (b) Independent panel + aggregate (PoLL / jury)

**Reliability.** The strongest evidence base of any option here. Verga et al.'s PoLL — Command R
(35B), Claude-3 Haiku, GPT-3.5, aggregated by max-vote for categorical and average-pool for
scored output — beats single GPT-4 on every dataset tested AND costs 7–8× less. The jury pattern
generalizes: "multiple judges voting by majority consensus dramatically outperforms single calls."

**Bias.** Strong against *uncorrelated* error. Cross-family panels cut self-preference and
intra-model bias — PoLL's score variance is 2.2 vs GPT-3.5's 6.1. The unfixed weakness is
**correlated error**: Goel et al. "Correlated Errors in Large Language Models" (arXiv:2506.07962)
find model pairs agree on errors at 0.423 (HuggingFace) / 0.60 (Helm) vs random baselines of
0.127 / 0.333; same-developer models add +0.022 to +0.066 agreement; and — critically — *more
accurate* models have *more* correlated errors. When errors correlate, majority vote and
averaging "provide little gain or even amplify systematic mistakes." Aggregation also has an
**Oracle Gap**: the "Cost of Consensus" paper (arXiv:2605.00914) measures gaps up to 32.3pp
where the panel *contains* the right answer but the vote discards it.

**Cost / complexity.** Low. N parallel, independent calls + a deterministic aggregation function.
No transcript routing, no turn-taking, embarrassingly parallel.

**Verdict.** The right *base layer*. Its one real weakness — silently averaging away a correct
minority, and shared blind spots surviving the vote — is exactly what a cross-examination round
fixes. Strong as a foundation; insufficient alone for adversarial review.

## (c) Multi-agent debate

**Reliability — genuinely contested.** The optimistic evidence is real: ChatEval (arXiv:2308.07201)
improves judge accuracy +2.5pp (GPT-4) to +6.2pp (ChatGPT) on FairEval and lifts GPT-4's
Topical-Chat Spearman by 0.096; the adaptive-stability debate-judge paper (arXiv:2510.12697)
reports JudgeBench +4.4pp, LLMBar +5.15pp, TruthfulQA +4.81pp over single/majority-vote;
debate-as-oversight (arXiv:2402.06782) lifts non-expert judge accuracy from 54% to 76%. But the
pessimistic evidence is just as strong and more recent. "Talk Isn't Always Cheap" (arXiv:2509.05396)
finds "debate always harms performance" on CommonSenseQA — 3 Mistral agents 44.4% → 39.4%; mixed
2-LLaMA-1-Mistral 58.2% → 50.2%. The "Cost of Consensus" paper shows isolated self-correction
*beating* debate by up to 27.6pp (Ministral-8B GSM-Hard 48.3% vs 20.7%, p<0.001). The
multi-agent-debate literature review (arXiv:2506.00066) cites Becker et al.: only ~0.5% of
discussions benefit while ~0.8% degrade. Gain depends heavily on heterogeneous *roles* — ChatEval
with homogeneous roles drops to 53.8%, identical to single-agent.

**Bias — debate ADDS a bias class.** Conformity/sycophancy. "Cost of Consensus" measures modal
sycophancy to 85.5% — agents abandon correct independent reasoning to match the modal peer answer,
inflating consensus to 90.1% while pushing accuracy *below* baseline. "Peacemaker or Troublemaker"
(arXiv:2509.23055) finds disagreement-collapse 27–86% (homogeneous Llama-3.3-70B: 86.36%), and
sycophancy is lowest in round 1 and rises every round after. "Talk Isn't Always Cheap" shows
correct→incorrect flips dominate the reverse, and a strong model is dragged *down* by weaker peers
(GPT-4o-mini + 2 Mistral: 62.4% → 59.4%). For an adversarial panel, manufacturing premature
consensus is the precise opposite of the goal.

**Cost / complexity.** Highest. 2.1–3.4× the tokens of independent assessment ("Cost of
Consensus": 17.4k–28.6k vs 6.2k–12.8k). Operationally heavy: turn-taking, transcript routing,
termination detection, and active monitoring for "problem drift" (arXiv:2502.19559) — systematic
decay where 4.7–69.9% of debates score net-negative as agents converge early then make
cumulatively harmful edits.

**Verdict.** Multi-round convergent debate is the highest-cost, highest-operational-risk option,
and for an *adversarial* mandate its core mechanism (drive toward consensus) is actively wrong.
Rejected as the architecture — but its *one good idea*, having agents read and challenge each
other once, is worth keeping in bounded form.

## (d) Panel → one cross-examination round → chair synthesis

**Reliability.** Inherits independent-panel accuracy as the floor (option b's numbers), then adds
a targeted recovery step. The independent round 1 preserves the diverse, uncorrelated assessments
that produce PoLL's gain. The single cross-examination round is where a missed-this / over-claimed-that
gets surfaced — recovering exactly the correct-minority signal that option (b)'s vote silently
averages away (the up-to-32.3pp Oracle Gap). The chair synthesis replaces brittle vote/average
with reasoned aggregation, the direction the meta-judge literature (arXiv:2504.17087) endorses.
Because there is exactly ONE exchange, the gain lands in the round where debate evidence is
strongest — "most improvement occurs in round 1" — and stops before the rounds where sycophancy
and drift dominate.

**Bias.** Best of the four. Independence is protected where it matters: each agent forms its
verdict with zero peer exposure, so round-1 self-preference and leniency stay *uncorrelated* and
cancel under synthesis. The cross-exam round then directly attacks correlated error — the one
thing pure aggregation cannot fix — by making each agent explicitly inspect the others' reasoning
for shared blind spots. And because agents file written rebuttal/corroboration memos rather than
re-vote, there is no convergence pressure: the 85.5% modal-sycophancy and 27–86% disagreement-collapse
failures need *multiple* rounds of social pressure to compound, and a single structured exchange
denies them that. The agreeableness-bias paper (arXiv:2510.11822) prescribes this exact ordering:
score independently first, aggregate, then use discussion to *understand* disagreement, not
eliminate it — and never let agents revise downward toward consensus.

**Cost / complexity.** Moderate and bounded. Roughly N + N + 1 calls ≈ 2–2.5× the independent
panel — below debate's 2.1–3.4×-on-top-of-a-larger-base and with a *fixed* call count: no loop,
no termination heuristic, no drift monitor. The chair is one extra synthesis call. Operationally
this is a 3-phase pipeline, far simpler than a debate loop.

**Verdict.** Captures the independent panel's accuracy and bias-cancellation, adds debate's one
robust contribution (a single peer-review exchange) while structurally excluding debate's failure
modes, and replaces fragile voting with reasoned synthesis. Best fit for periodic adversarial review.

## Specific questions answered with evidence

**Q1 — Does multi-agent debate actually beat independent aggregation, and by how much? Is the
gain robust or contested?**
Contested, and the gain is *not* robust. Positive: ChatEval +2.5–6.2pp (arXiv:2308.07201);
adaptive-stability debate-judge +4.4pp JudgeBench, +5.15pp LLMBar (arXiv:2510.12697);
debate-as-oversight 54%→76% (arXiv:2402.06782). Negative and recent: "Talk Isn't Always Cheap"
— debate harms CommonSenseQA in every config tested, up to −8.0pp (arXiv:2509.05396); "Cost of
Consensus" — isolated self-correction beats debate by up to 27.6pp (arXiv:2605.00914); the lit
review cites only ~0.5% of discussions benefiting vs ~0.8% degrading (arXiv:2506.00066). The
positive results cluster on *heterogeneous-role* setups with strong, comparable models; the
negative results dominate for homogeneous or capability-mismatched panels. Conclusion: the
debate-beats-aggregation claim does not hold generally — it is conditional, fragile, and
sometimes reversed.

**Q2 — How many debate / cross-examination rounds before diminishing returns?**
One round delivers most of the value; round 2 is the practical ceiling; round 3+ commonly
degrades. Xu et al. (via arXiv:2506.00066): accuracy improves "only until the second round,
after which accuracy declines." He et al.: gain only to round 2, then decline. The lit review's
summary: "most improvement occurs in round 1, with diminishing returns thereafter." Problem-drift
(arXiv:2502.19559): degradation can appear as early as turn 2 and worsens through turn 7; 99% of
agreements form within the first two turns. The adaptive-stability paper (arXiv:2510.12697)
finds distributions already converge to a bimodal pattern by round 2, and full-10-round accuracy
beats early-stop by <1pp. **Direct answer: 1 round is the right design point** — it banks the
round-1 gain and stops before the sycophancy/drift regime. This is the structural argument for
option (d)'s single cross-examination round over an open-ended debate loop.

**Q3 — How much does panel size matter? Is ~3–6 a sweet spot?**
Yes, ~3–5 is the documented sweet spot; marginal value of the Nth judge falls off fast. Verga
et al. (arXiv:2404.18796) build PoLL from **three** disjoint-family models and beat single GPT-4
on accuracy and cost. 2025 jury work converges on the same range: "three to five smaller judges
costs less than one expensive reasoning model while achieving significantly higher accuracy."
For *model-type* diversity specifically, the lit review cites Ye et al.: "additional diversity in
model types beyond two to three agents fails to yield further performance gains." Du et al. is
the outlier (improvement to seven agents) but on math reasoning, not judging. **Direct answer:
3–5 judges; 3 distinct families is the evidence-backed default; do not exceed ~5–6 for a periodic
cost-conscious panel** — the Nth judge past that adds cost, not signal.

**Q4 — How much does model diversity (mixing families/sizes) reduce correlated error?**
Family diversity helps materially but does **not** eliminate correlated error, and the residual
is the main reason aggregation alone is insufficient. PoLL's disjoint-family panel cuts score
variance to 2.2 vs a single model's 6.1 and removes most self-preference. But Goel et al.
(arXiv:2506.07962) show even cross-family pairs agree on errors well above chance (0.423 / 0.60
vs 0.127 / 0.333), same-developer pairs add +0.022–0.066, and *more accurate models converge*
("newer models that differ on the surface may be converging in their outputs"). A homogeneous
(same-family) panel is strictly worse — it shares architecture-level blind spots that vote/average
cannot break. **Direct answer: mix families AND capability tiers; treat diversity as necessary
but not sufficient** — it lowers the correlated-error floor, and option (d)'s cross-examination
round is what attacks the residual that diversity leaves behind.

**Q5 — Independent-first-then-interact vs interact-from-the-start — which preserves judgment
independence?**
Independent-first, decisively. Sycophancy onset under peer exposure is rapid and monotonic:
"Cost of Consensus" measures modal sycophancy to 85.5% and contextual fragility to 70% once
agents see peers; "Peacemaker or Troublemaker" (arXiv:2509.23055) finds agents least sycophantic
in round 1 and progressively less willing to defend correct positions every round after, with
disagreement-collapse 27–86%. Interact-from-the-start contaminates the assessments before they
are formed — there is no independent signal left to aggregate. The agreeableness-bias paper
(arXiv:2510.11822) prescribes the fix as a *protocol*: score independently first, aggregate, and
only then discuss to understand (not erase) disagreement. **Direct answer: form every assessment
in isolation, then interact exactly once under structure that rewards rebuttal over agreement.**
This is the load-bearing reason to choose (d) over (c) — and to never let the cross-exam round
collapse into a re-vote.

## Sources

- Verga et al., "Replacing Judges with Juries: Evaluating LLM Generations with a Panel of Diverse Models" — arXiv:2404.18796 — https://arxiv.org/html/2404.18796v1 (PoLL: 3 disjoint families, κ 0.763 vs GPT-4 0.627, Arena Pearson 0.917 vs 0.817, 7–8× cheaper, self-preference evidence, variance 2.2 vs 6.1)
- Hu et al., "Multi-Agent Debate for LLM Judges with Adaptive Stability Detection" — arXiv:2510.12697 — https://arxiv.org/html/2510.12697v1 (JudgeBench +4.4pp, LLMBar +5.15pp, TruthfulQA +4.81pp; round-2 bimodal convergence; full-10-round beats early-stop by <1pp)
- Becker et al. / problem drift, "Stay Focused: Problem Drift in Multi-Agent Debate" — arXiv:2502.19559 — https://arxiv.org/html/2502.19559v3 (drift from turn 2, 99% agreement within 2 turns, 4.7–69.9% net-negative debates)
- "The Cost of Consensus: Isolated Self-Correction Prevails Over Unguided Homogeneous Multi-Agent Debate" — arXiv:2605.00914 — https://arxiv.org/html/2605.00914 (self-correction beats debate up to 27.6pp; modal sycophancy 85.5%; contextual fragility 70%; Oracle Gap 32.3pp; debate 2.1–3.4× token cost)
- Goel et al., "Correlated Errors in Large Language Models" — arXiv:2506.07962 — https://arxiv.org/html/2506.07962 (error agreement 0.423/0.60 vs 0.127/0.333 random; same-developer +0.022–0.066; more accurate ⇒ more correlated)
- "Peacemaker or Troublemaker: How Sycophancy Shapes Multi-Agent Debate" — arXiv:2509.23055 — https://arxiv.org/html/2509.23055v1 (disagreement-collapse 27–86%; sycophancy lowest in round 1, rises after; heterogeneous + mixed-persona fix)
- Wan et al., "Talk Isn't Always Cheap: Understanding Failure Modes in Multi-Agent Debate" — arXiv:2509.05396 — https://arxiv.org/html/2509.05396 ("debate always harms" on CommonSenseQA, −5.0 to −8.0pp; strong model dragged down by weak peers)
- Chan et al., "ChatEval: Towards Better LLM-based Evaluators through Multi-Agent Debate" — arXiv:2308.07201 — https://ar5iv.labs.arxiv.org/html/2308.07201 (+2.5–6.2pp judge accuracy; 2 agents / 2 turns; homogeneous roles collapse to single-agent 53.8%)
- "A Literature Review of Multi-Agent Debate for Problem-Solving" — arXiv:2506.00066 — https://arxiv.org/html/2506.00066v1 (rounds peak 2–4; Xu/He round-2 ceiling; Becker ~0.5% benefit vs ~0.8% harm; Ye: diversity gain saturates at 2–3 model types)
- Khan et al., "Debating with More Persuasive LLMs Leads to More Truthful Answers" — arXiv:2402.06782 — https://arxiv.org/pdf/2402.06782 (debate lifts non-expert judge accuracy 54%→76%; debate beats single consultant)
- "Beyond Consensus: Mitigating the Agreeableness Bias in LLM Judge Evaluations" — arXiv:2510.11822 — https://arxiv.org/pdf/2510.11822 (prescribes independent scoring first, aggregate, then discuss to understand — not erase — disagreement)
- "Leveraging LLMs as Meta-Judges: A Multi-Agent Framework for Evaluating LLM Judgments" — arXiv:2504.17087 — https://arxiv.org/html/2504.17087v1 (multi-dimensional rubric + reasoned consensus aggregation over plain voting)
- "Who Judges the Judge? LLM Jury-on-Demand: Building Trustworthy LLM Evaluation Systems" — arXiv:2512.01786 — https://arxiv.org/abs/2512.01786 (dynamic jury beats single-judge and static-jury baselines; reliability-weighted aggregation)
- Quanta Magazine, "Debate May Help AI Models Converge on Truth" (2024) — https://www.quantamagazine.org/debate-may-help-ai-models-converge-on-truth-20241108/ (plain-language summary of the debate-as-oversight 54%→76% result and the longer-argument-sways-judges caveat)

## Recommendation

**Adopt architecture (d): independent panel → one cross-examination round → chair synthesis.**
Ranked: **(d) > (b) >> (c) > (a)**.

Rationale in one line per rejected option. **(a) single judge** — single point of failure,
full self-preference bias, contradicts an adversarial mandate. **(c) multi-agent debate** —
highest cost (2.1–3.4× tokens) and operational complexity, contested accuracy gain, and its
core mechanism manufactures the premature consensus an adversarial panel exists to prevent
(modal sycophancy to 85.5%). **(b) independent panel** is genuinely strong and is the *base
layer* of the recommendation — but pure vote/average silently discards a correct minority
(Oracle Gap to 32.3pp) and cannot break the correlated blind spots that family diversity leaves
behind. Option (d) keeps every strength of (b) and adds exactly one structured peer-review
exchange to recover that lost signal — banking debate's robust round-1 gain while structurally
excluding the round-2+ regime where sycophancy and drift take over.

Concrete parameters for a periodic, cost-conscious panel:

- **Agents: 5.** Three distinct families (e.g. a Claude tier, a GPT tier, a Gemini/open tier),
  with at least one capability-tier difference among them. Five sits at the top of the
  3–5 evidence-backed sweet spot — enough that no two agents share a family blind spot and a
  correlated pair cannot carry a majority, without paying for an Nth judge past the point
  marginal signal flattens.
- **Rounds: exactly 1 cross-examination round.** Phase 1 — all 5 assess the methodology in full
  isolation (zero peer exposure; preserves uncorrelated judgment). Phase 2 — each agent reads the
  other 4 assessments once and files a written rebuttal/corroboration memo (concede, defend, or
  escalate each contested finding) — it does NOT re-vote and is NOT asked to converge. No round 2:
  the evidence is consistent that round-2+ adds <1pp at best and frequently degrades.
- **Aggregation: chair synthesis, not vote/average.** A separate synthesizer agent reads the 5
  independent assessments + the 5 cross-exam memos and produces the verdict report, weighting a
  finding up when independent agents corroborate it and treating a finding that survives
  rebuttal as high-confidence. This replaces brittle majority vote (which the correlated-error
  and Oracle-Gap evidence shows can amplify shared mistakes) with reasoned aggregation.
- **Cost envelope:** ~5 + 5 + 1 = 11 calls per run, a fixed count with no debate loop or
  termination heuristic — roughly 2–2.5× a bare independent panel and well under an open debate.
  Acceptable for a periodic audit; the recurrence is exactly why the *bounded, fixed* call count
  matters more than raw minimum cost.

**Overall confidence: HIGH** — the independent-panel-beats-single-judge result, the round-1-is-the-
sweet-spot finding, the 3–5-judge range, and the independence-first ordering are each corroborated
by multiple 2024–2026 sources, several of them directly contradicting the naive "more debate is
better" intuition. The one genuinely contested question — whether interaction beats aggregation —
is resolved here not by picking a side but by taking interaction's robust part (one structured
exchange) and discarding its fragile part (multi-round convergence).
