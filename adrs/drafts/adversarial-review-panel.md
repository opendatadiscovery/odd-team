---
id: ADR-DRAFT-adversarial-review-panel
title: "The Adversarial Review Panel — a periodic, independent self-audit subsystem for the agentic-ontology methodology"
status: draft
date: 2026-05-21
scope: workspace-meta (EXTENDS APPROACH.md to revision 6 — adds the meta-review subsystem)
related_drafts: ADR-DRAFT-agentic-code-ontology, ADR-DRAFT-feature-anchored-ontology, ADR-DRAFT-dynamic-verification-layer
trigger_incident: "2026-05-21 maintainer review — after many ontology iterations, hand-picked spot-checks keep surfacing gaps the methodology's own probes (Type 4/6/7) did not. The methodology has no independent oracle: it is graded by the minds that built it, and it improves only by accreting layers (rev 2/3/4/5)."
case_law: retrospectives/LSN-021-methodology-has-no-independent-oracle.md
research: "adrs/drafts/research/adversarial-review-panel/ — PRIOR-ART, PITFALLS, COMPARISON, PROBES, SUMMARY (all 2026-05-21, HIGH confidence except PROBES thresholds MEDIUM)"
revision_1: "2026-05-21 — explicit-target anchoring added after the maiden-run review (LSN-022). The panel measures the methodology against a written, improvable target.md (lineage/{repo}/meta-reviews/target.md); every expert + the chair anchor on it and reflect it through their axis (Rule 0 / target_lens / ## target). Generalized in APPROACH.md §16.2."
---

# ADR-DRAFT: The Adversarial Review Panel

## Context

### The trigger — Failure E

The agentic-ontology methodology (`APPROACH.md`) has improved by accretion: rev 2 added feature-flow composition, rev 3 added the Layer-0 mission anchor, rev 4 added the Stress Protocol, rev 5 added Category F + the reflection layer. Each revision was triggered by a real miss and each fix is locally reasonable. But every one of those revisions was *graded by the same minds that authored the methodology*. The probe protocol (Type 4 adversarial, Type 6 implicit-ADR, Type 7 user-observable) lives inside `APPROACH.md` and is largely maintainer-seeded; `coherence_sweep.py` checks only internal consistency; `/review` and `/probe` are per-change or per-claim.

The one genuinely independent oracle in the entire loop is the **human maintainer's hand-picked spot-check** — and it keeps finding gaps the framework missed. That is the whole signal. It names a failure mode the methodology had not named:

> **Failure E — the methodology cannot audit itself.** It has no independent oracle. It is graded by the minds that built it and improves only by accreting layers. A methodology that adds a layer for every miss, forever, graded only from inside its own frame, accumulates undetected blind spots and unexamined cost — and cannot tell whether it is converging on its target or thrashing.

### The honest metrics make the concern measurable, not paranoid

At the time of writing (`manifest.yaml`, substrate commit `ede5d277`): 144 of 395 nodes have an own sidecar (36.5%); 30 features discovered but only 4 have any probed test cell; 25 stress questions total, **0 probe-verified**. The honest-coverage axes `APPROACH.md` §14 defines are near-empty. The maintainer's worry — *"with this approach we will never hit the target"* — is currently **unmeasured**. It must become a tracked, trended number, audited from outside.

### Why a subsystem, and why now

The methodology's current focus window (the 2026-05 ontology sprint) is finalising the methodology *and* building it out. Finalising a methodology without an independent check on whether it works is finalising a guess. The maintainer asked for a standing subsystem — runnable periodically — that reproduces the independent-oracle spot-check as a repeatable, measured, multi-expert process. This ADR is that subsystem.

This is not a bolt-on. Continuous independent self-review becomes a **first-class principle of the methodology** — `APPROACH.md` gains Failure E (§2), Rule 16 (§5), and a new section 16, at revision 6. The methodology already has a *reactive* self-correction loop — the case-law / LSN system (§8): a miss happens → a retrospective → a new gate. The panel is its missing *proactive* loop.

## Decision

Adopt the **Adversarial Review Panel**: a subsystem of **six independent expert subagents + one chair**, run **periodically and on demand** via a new `/panel` skill, in **three phases** — independent assessment → one cross-examination round → chair synthesis. Each run, the experts audit the methodology's *process*, *progress*, and *cost* from outside its frame; the Adversary generates **fresh, blind spot-checks** against the real target codebase; the chair synthesises one structured verdict report (`GO` / `GO-WITH-CHANGES` / `STRUCTURAL-RETHINK`) with a scorecard, consensus-vs-contested findings, an LSN-regression check, and a trend row. Findings are emitted as triage-ready candidates; the maintainer triages. The panel **augments and aims** the maintainer's review — it does not replace it.

The architecture is research-backed (`adrs/drafts/research/adversarial-review-panel/`, five artefacts, HIGH confidence). The chosen shape — independent panel → one cross-examination → chair synthesis — is COMPARISON's option (d), ranked `(d) > (b) >> (c) > (a)`: it keeps the independent panel's bias-cancellation, adds debate's one robust contribution (a single structured peer-review exchange), and structurally excludes debate's failure modes (multi-round sycophantic convergence, measured to 85.5% modal sycophancy).

## The subsystem in detail

### The six experts — six orthogonal lenses

No two experts share a job; orthogonality is what keeps the panel itself non-redundant (it is *not* a six-judge jury voting one verdict — it is six specialists on six axes).

| Expert | Axis | The question it owns |
|---|---|---|
| `panel-adversary` | Coverage | Does the ontology actually cover reality? (fresh blind spot-checks) |
| `panel-methodologist` | Process | Is the process sound — converging, or thrashing? |
| `panel-economist` | Cost | Is it efficient, or burning tokens on redundancy? |
| `panel-engineer` | Depth | Does the ontology show real mastery of the target stack? |
| `panel-practitioner` | Usefulness | Could a maintainer actually use the ontology to do real work? |
| `panel-skeptic` | Honesty | Is the system's self-assessment honest — is HIGH-confidence actually right? |

The six are the maintainer's floor of five plus one: the Skeptic earns its seat because *confidently wrong* (HIGH-confidence + actually-wrong, the `listMostPopular` shape) is the most dangerous failure for a published doc, and no other lens owns calibration. `panel-chair` (the seventh agent) assesses nothing — it synthesises.

### The three-phase protocol

- **Phase 1 — independent assessment (parallel, isolated).** All six experts run at once, each blind to the others, each on a *different context slice* with an explicit blindfold. Each commits a Phase-1 report to disk **before** any peer is visible — independence preserved (anchoring + sycophancy counter).
- **Phase 2 — one cross-examination round (parallel).** Each expert reads the other five Phase-1 reports and files a short bounded memo: corroborate / dispute / adjust-severity / new-finding — on *independent evidence only*, never to seek consensus. Exactly one round: the evidence is consistent that round 2+ adds <1pp and degrades into conformity. `/panel lite` skips Phase 2.
- **Phase 3 — chair synthesis.** The chair reads all twelve documents, builds the scorecard, separates consensus from contested findings (weighting by cited-evidence strength, never headcount), runs the LSN-regression check, and emits the verdict report + trend row.

### The Adversary — the crux

The Adversary reproduces the maintainer's pain as a repeatable role. Three disciplines make it work:
1. **Blindfold.** It may not read `retrospectives/`, `APPROACH.md`, `lineage/PROBES.md`, `probes/`, `probe-runs/`, `refactoring-scopes`, `doc-gaps`, `implicit-adrs`, `feature-reflections/`, `findings/`, `backlog/` — anything that leaks what the methodology already found. It works from primary sources: the target source, live docs, the OpenAPI spec.
2. **Ground truth before the ontology.** For each check: trace the truth in the real source first; *only then* open the ontology artefacts; then verdict. Reversing the order lets the ontology's claim anchor the "truth."
3. **Fresh checks, never reused.** 5-8 checks per run across four sampling strategies (random-walk / capability / boundary / negative-space); a targets-only ledger (no verdicts) prevents re-testing without leaking the answer key. A static check-set gets gamed; a freshly-sampled one cannot be pre-satisfied.

### The constitution — de-biasing rules baked into every expert

PITFALLS catalogues twelve failure modes of LLM-judge systems. The counters are baked into the agent prompts as non-negotiable rules: adversarial framing with a negative prior; mandatory code-anchored evidence (no PASS on fluency); independent verdict committed before cross-examination; no prior verdicts/scores in an auditor's context; substance-over-style (never credit confident tone or citations unverified); bounded output (verbosity counter); banned hedge-phrases; the chair treats unanimity as weak and preserves minority opinions verbatim. The agent prompts + their rubrics + this ADR + `APPROACH.md` §16 together are the panel's written constitution — AI judging is reliable only when rubric-grounded.

## The load-bearing residual risk — correlated blind spots

**This must be read before the panel's verdicts are trusted.** The Claude Code harness spawns only Claude-family subagents. The panel is therefore six Claude-family agents auditing artefacts built by Claude-family agents. The research is unambiguous (`PITFALLS` P7, `PRIOR-ART` §2, `COMPARISON` Q4): same-family agents have **correlated errors** — they fail together on the same inputs — and correlation *rises* with capability. A homogeneous panel's unanimity is, in the worst case, *one correlated draw masquerading as a six-of-six signal*. Genuine cross-family diversity is the real fix and **it is not available in-harness.**

This residual risk is **HIGH and not removable by panel design alone.** It is mitigated, never eliminated, by:
- **Model-tier spread** — experts run across Opus and Sonnet (a weak decorrelation lever; same family, partial).
- **Distinct role-prompts, context slices, blindfolds, and per-expert fresh spot-checks** — the experts do not even examine the same evidence the same way.
- **Code-anchored verdicts** — the deepest counter: correlated models share *opinions* but cannot make a failing `grep` pass or a missing `file:line` resolve. Every finding cites re-runnable evidence.
- **The chair treats unanimity as weak evidence** — findings are weighted by cited-evidence strength, never headcount.
- **The non-LLM gate** — `coherence_sweep.py`, the `probe-runner` (docker execution), and above all the maintainer's own human spot-audit remain outside the correlated population. The panel's `needs_human_verification` list exists to *aim* that human attention.
- **Maintainer-driven cross-family check (strongest available)** — the maintainer can periodically run a parallel review through a different provider (e.g. Codex) outside the automated panel. This is the only genuine cross-family decorrelation and is recommended as a standing practice, not automated here.

Every panel report carries a standing `correlated_blind_spot_caveat` section stating this. The panel is a diagnostic instrument that makes the gap-rate measurable and aims the human oracle — it is not itself an oracle.

## Validation — how we know the panel is not theatre

An untested panel reproduces the exact failure it exists to catch. Per `PROBES`, the panel is validated by two gates; **until the maiden acceptance gate passes, the panel's reports are explicitly provisional** and every report says so (`validation_status` in the chair's output).

- **Maiden acceptance gate** — a maintainer-authored gold set (~30-100 ontology slices, hand-labelled real-gap-present/absent + severity) and a maintainer-authored seeded-defect corpus (~40 mutants: claim-inversion / citation-corruption / caveat-deletion / cross-axis-fabrication / severity-downgrade; 25% held out). Thresholds: Cohen's κ ≥ 0.60 vs maintainer labels; recall ≥ 0.80; seeded-defect detection ≥ 0.80 overall and ≥ 0.90 for the data-loss/security severity class; ECE ≤ 0.15; McDonald's ω ≥ 0.70; label-flip rejection ≈ 100%.
- **Periodic drift gate** — every cycle: a fresh unannounced seeded sample; frozen-baseline regression on the gold set (alarm on any metric dropping > 0.10, or data-loss/security detection < 0.90); approval-rate trend check; re-run the full maiden gate when the underlying model version changes.

The gold set and seeded corpus **must be maintainer-authored** — they are the external oracle; an LLM-authored gold set is correlated with the panel and worthless. Building them is the maintainer's task; the subsystem ships with the validation protocol specified and a `meta-reviews/validation/` scaffold, and `/panel validate` runs the gate once the corpus exists. Thresholds are reasoned starting points (`PROBES` confidence MEDIUM on the numbers) — re-fit after two cycles.

## Cost, cadence, and the self-kill criterion

A full run is ≈ 6 + 6 + 1 = 13 agent invocations (7 in `lite` mode); a fixed bounded count, no debate loop. The panel runs **per milestone or weekly — never per-commit**. Each report includes the panel's *own* run cost (the Economist measures it). The panel carries a **self-kill criterion**: three consecutive runs with no actionable finding means the panel has become the waste it audits, and it is paused. Single-run-per-cycle is a deliberate cost choice over median-of-3 (which would triple cost); the resulting score noise is acknowledged — the verdict leans on evidence-anchored findings, which are noise-robust, not on score precision.

## Relationship to the rest of the methodology

The panel is the methodology's **proactive self-correction loop** — sibling to the *reactive* case-law loop (`APPROACH.md` §8). It is a **governance subsystem that audits the 0-4b pipeline; it is not itself a pipeline layer and not a probe class.** It is distinct from, and complementary to, every existing mechanism: `/probe` validates specific claims (in-methodology, maintainer-seeded); `coherence_sweep.py` checks internal consistency (silent, embedded in `next-batch`); `/review` gates per-change work; retrospectives are reactive case-law. None audits the methodology's process/progress/cost from outside. The panel's findings feed the existing machinery — an LSN candidate routes into a retrospective; an `approach-rev` candidate routes into an `APPROACH.md` revision; a `cut-this-step` candidate is the methodology's first structured channel for *subtraction*.

## What is NOT in scope

- The panel is **static** — it reads code and artefacts. Runtime questions become probe-skeletons handed to the existing `/probe-run`; the panel never executes the system itself.
- The panel **emits candidates**; it never auto-edits `APPROACH.md`, `CLAUDE.md`, the ADRs, the backlog, or the source. The maintainer triages.
- No remote infrastructure — consistent with `APPROACH.md` §5 rule 12 (local-only).

## Consequences

**Positive.** The methodology gains an independent, periodic, measured check on whether it is converging; the gap-rate becomes a trended number; an honest `STRUCTURAL-RETHINK` verdict becomes possible (and is the most valuable thing the panel can deliver); the maintainer's scarce human spot-checks get aimed at the highest-risk, lowest-panel-confidence areas; `APPROACH.md` gains its missing proactive self-correction loop.

**Negative / accepted.** The panel costs ≈ 13 agent invocations per run; its correlated-blind-spot risk is HIGH and permanent; its scores carry run-to-run noise; it is unvalidated until the maintainer authors the gold set + seeded corpus. All four are stated openly, in this ADR and in every panel report. The mitigation for all of them is the same: the panel never speaks with more authority than its cited evidence carries.

## References

- Research: `adrs/drafts/research/adversarial-review-panel/{PRIOR-ART,PITFALLS,COMPARISON,PROBES,SUMMARY}.md`.
- Case-law: `retrospectives/LSN-021-methodology-has-no-independent-oracle.md`.
- Methodology: `APPROACH.md` §2 (Failure E), §5 (Rule 16), §8 (the reactive case-law loop), §16 (the subsystem).
- Agents: `.claude/agents/panel-{adversary,methodologist,economist,engineer,practitioner,skeptic,chair}.md`. Skill: `.claude/skills/panel/SKILL.md`.
- Key external sources (full list in the research artefacts): Verga et al. PoLL (arXiv:2404.18796); Correlated Errors (arXiv:2506.07962); Anthropic alignment-auditing agents; the multi-agent-debate failure-mode literature (arXiv:2502.08788, 2509.05396, 2605.00914); the LLM-judge meta-evaluation literature (arXiv:2510.09738, 2412.12509, 2401.05940).
