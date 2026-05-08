---
research: agentic-code-ontology
artifact: PROBES
date: 2026-05-08
mode: validation methodology
overall_confidence: HIGH (methodology) / MEDIUM (acceptance thresholds — calibrate after first probe round)
---

# PROBES — semantic-claim validation

## Recommended protocol

The substrate's PROBES.md (`lineage/PROBES.md`, `adrs/drafts/research/code-lineage-substrate/PROBES.md`) validates **syntactic existence claims** ("is this file enumerated under the right axis?") with a four-step protocol: name capability → locate in code → query → pass/fail. The agentic ontology adds **semantic claims** — what a node *means*, what implicit ADR it embodies, what its caveats are, what mode it matters in — that the syntactic protocol cannot validate. The semantic protocol layered on top (extends, does not replace):

1. **Sample-then-judge** is the default scaling mechanism (5% per refresh, LLM-as-judge with reasoning, escalate below-threshold to maintainer). Single-maintainer constraint forbids exhaustive human review.
2. **Six probe types** (existence, semantic-content, cross-axis, adversarial, doc-as-ground-truth, implicit-ADR) each with a tailored 4-step protocol — PASS criteria differ per type (string match for existence, faithfulness score for semantic content, ground-truth diff for doc-as-truth, maintainer-only for implicit-ADR).
3. **LLM-as-judge** with binary `correct`/`incorrect` rubric + chain-of-thought reasoning — calibrated against a gold set of 50-100 maintainer-graded probes per Anthropic's evaluation guidance.
4. **Adversarial round per refresh** — three maintainer-picked unannounced probes (capabilities that exist) + three nonexistent capabilities the ontology should answer "no" to (ReEval-pattern adversarial).
5. **Caught bugs become permanent regression probes** — same as substrate, but the assertion shape changes from "node exists" to "field `X` of node `Y` still mentions concept `Z`."
6. **Acceptance is multi-dimensional**: ≥85% sample faithfulness, ≥0.6 Cohen's kappa (LLM-judge vs maintainer on calibration set), ≥4/6 adversarial PASS, ≥3/5 implicit-ADR confirmation.

## Probe types (taxonomy)

| # | Probe type | Validates | Automatable? | Cost shape |
|---|---|---|---|---|
| 1 | **Existence-of-capability** | Node exists, axis-correct, kind-correct | Fully (substrate's existing protocol) | O(N) string comparisons |
| 2 | **Semantic-content** | `understanding`, `purpose`, `responsibility` fields are accurate to the code | LLM-judge | $0.01-0.05/probe |
| 3 | **Cross-axis** | Joins between axes (controllers × docs, config × caveats, etc.) hold | Fully (graph queries) | O(N×M) for join axes |
| 4 | **Adversarial** | Ontology answers "no" / "I don't know" when the capability doesn't exist | LLM-judge + maintainer | $0.05-0.10/probe (lower volume) |
| 5 | **Doc-as-ground-truth** | Code-side `understanding` field aligns with doc page's content | LLM-judge (faithfulness) | $0.05/probe |
| 6 | **Implicit-ADR confirmation** | Ontology surfaced ADRs the maintainer holds tacitly | Maintainer-only (manual) | ~30 min/probe (rare) |

The taxonomy maps to the agentic ontology's three claim classes:
- **Type 1 (existence)** — same as substrate; semantic ontology inherits the substrate's protocol verbatim.
- **Types 2, 5 (content / doc-as-truth)** — RAG-style faithfulness validation: extract claims, verify against context (code or doc), compute faithfulness score.
- **Types 3, 4, 6 (cross-axis / adversarial / implicit-ADR)** — knowledge-graph integrity validation: tests the ontology's *judgment*, not just its data.

## Probe protocol per type

### Type 1 — Existence-of-capability (inherited from substrate)

The substrate's protocol applies verbatim. Reproduced for completeness:

1. Name a user-visible capability (one sentence).
2. Locate it in code (file:line).
3. Query the ontology by axis + expected kind.
4. PASS if located code is present with expected kind; FAIL classified as axis-gap / extractor-bug / annotation-gap.

PASS criterion: **path string match** in the result set.

### Type 2 — Semantic-content

1. Pick a node from the ontology (existing PASS from Type 1).
2. Read its `understanding` / `purpose` / `responsibility` fields.
3. Open the same node's source file. Read it as a maintainer would.
4. PASS if every claim in the field is supported by the code (RAGAS-style faithfulness — see [RAGAS faithfulness](https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/faithfulness/) — `supported claims / total claims ≥ 0.85`).

Faithfulness is computed by an LLM-judge in two steps (per RAGAS):
- **Claim extraction**: decompose the `understanding` field into atomic statements ("X handles Y"; "X delegates to Z"; "X depends on W").
- **Claim verification**: for each, ask the judge whether the claim is supported by the source file.

The LLM-judge prompt follows Anthropic's [evaluation guidance](https://platform.claude.com/docs/en/docs/test-and-evaluate/develop-tests): binary `correct`/`incorrect`, reasoning before scoring (CoT), output reasoning then verdict in tagged form. **Use a different model family from the one that authored the ontology** to avoid the self-preference bias (LLM-judge bias literature: [Justice or Prejudice?](https://llm-judge-bias.github.io/), [Self-Preference Bias in LLM-as-a-Judge](https://arxiv.org/html/2410.21819v1)).

FAIL classified as:
- **Hallucination** — claim not supported by source. Log as a regression probe and note in the next refresh.
- **Out-of-date** — claim was true at extraction commit, code drifted since. Triggers re-extraction of the node.
- **Vague** — claim is technically true but uninformative ("handles HTTP requests"). Log as authoring-quality finding; not a hard FAIL.

### Type 3 — Cross-axis

These probes test the ontology's *joined* claims — the graph queries that span multiple axes. The protocol is mostly a SQL-style assertion against the ontology + a syntactic check on the result.

Examples:
- *"Find every controller-method whose `documents:` link is broken."* Query: `WHERE kind = controller AND documents IS NOT NULL AND documents NOT IN <SUMMARY.md keys>`. PASS if result count matches the substrate's existing broken-link rollup.
- *"Find every config consumer with no doc explanation of its `caveats` field."* Query: `WHERE kind = config-key-consumer AND caveats IS NOT NULL AND (documents IS NULL OR documents->'caveats' IS NULL)`. PASS if every result item is verified by maintainer to be a real undocumented caveat (sample 5 per round).
- *"Find every undocumented ADR (`implicit_adrs` not in `adrs/{slug}.md`)."* Query: `SELECT DISTINCT implicit_adr FROM nodes WHERE implicit_adr NOT IN (SELECT slug FROM adrs/)`. PASS if every result item is *plausibly* an ADR per maintainer review.

Type 3 protocol:
1. Specify the cross-axis query as a stated invariant.
2. Run it.
3. Sample 5-10 results.
4. Maintainer (or LLM-judge with calibrated rubric) verifies each.

PASS criterion: ≥4 of 5 sampled results are correct positives.

### Type 4 — Adversarial

The ontology should answer "no" / "I don't know" / "no node found" when a probe names a capability that doesn't exist. If it confidently fabricates a node or surfaces a real-but-unrelated node and claims it's the answer, that's a **knowledge-graph hallucination** — the failure mode the ReEval framework targets in retrieval-augmented systems ([ReEval: Automatic Hallucination Evaluation](https://arxiv.org/html/2310.12516)).

Adversarial probes are constructed by:
- **Capability negation**: take a real capability ("dark mode"), flip a key attribute ("a dark-mode-tied-to-user-locale feature" — doesn't exist).
- **Cross-product fabrication**: pick two real concepts from different axes, combine them into a capability the ontology shouldn't claim ("OIDC-driven scheduled job that emits Prometheus metrics" — when the codebase has no such bridge).
- **Synonym-swap with negation**: take a real capability, replace its name with a related-but-different concept ("server-side i18n" when the codebase only has client-side i18n).

Type 4 protocol:
1. Construct adversarial probe (3 per refresh round, maintainer-authored).
2. Query the ontology as if the capability existed.
3. Expected response: empty result + "no matching node" / `null` `understanding`. **Not** a confident match to a real-but-different node.
4. PASS if the ontology returns empty/null. FAIL if it returns a confident match.

The ReEval result generalises here: even capable LLMs drop accuracy 15-25 points under adversarial perturbation. Treat ≥66% adversarial PASS (2 of 3) as the floor; ≥85% as the goal after calibration.

### Type 5 — Doc-as-ground-truth

Some nodes have a `documents:` link pointing at an existing doc page. The doc page's content is a stated ground truth (the team published it; an operator may rely on it). Probe: ask the ontology to summarize what the linked-from node does, then compare to the doc page's actual content. **Mismatches are findings — drift between code's `understanding` and docs' `published-understanding`.**

This is the most actionable probe type for the maintainer's day-to-day work — every mismatch is a backlog candidate (DOC-NNN follow-up).

Type 5 protocol:
1. Pick a node with non-null `documents:`.
2. Read the node's `understanding` field.
3. WebFetch / read the doc page at `docs.opendatadiscovery.org/{documents}`.
4. PASS if the two are semantically equivalent (faithfulness in both directions: every claim in `understanding` is supported by docs; every claim in docs is supported by code-side `understanding`).

The bidirectional check matters because:
- **`understanding` → docs**: if `understanding` has a claim docs don't, either docs have a gap (log DOC-NNN) or `understanding` is hallucinated (log regression probe).
- **Docs → `understanding`**: if docs have a claim `understanding` doesn't, either `understanding` is impoverished (log extractor bug) or docs are stale (log DOC-NNN).

Use the [BERTScore](https://bertscore.com/) F1 ≥ 0.85 threshold as the cheap-pass shortcut for Type 5; escalate to LLM-judge faithfulness only when BERTScore is between 0.75 and 0.85. (BERTScore [is brittle on antonymy and named entities](https://www.shadecoder.com/topics/bertscore-a-comprehensive-guide-for-2025), so it must not be the only check.)

### Type 6 — Implicit-ADR confirmation

The hardest validation. The ontology claims to surface implicit ADRs ("decisions held tacitly that were never written down"). The validation cannot use the ontology's own output as ground truth — that's circular. The maintainer is the only oracle for this claim; documented patterns from [tacit-knowledge research](https://www.frontiersin.org/journals/built-environment/articles/10.3389/fbuil.2025.1674307/full) and [reverse-engineering knowledge construction](https://link.springer.com/chapter/10.1007/978-3-319-33111-9_39) confirm: tacit knowledge surfaces only via expert review, never via automated extraction.

Type 6 protocol:
1. **Maintainer-side**: write down 3-5 implicit ADRs you know are followed across the codebase (e.g., "we use OpenAPI-generator interfaces for HTTP mapping, never hand-written controllers"; "every config key has a `@ConfigurationProperties` class, never a bare `@Value` for new code"; "every collector adapter inherits from `BaseAdapter` for lifecycle methods"). Phrase each as one sentence + 2-3 example file:line citations.
2. **Ontology-side**: query `SELECT implicit_adrs FROM nodes WHERE implicit_adrs IS NOT NULL` and aggregate by frequency. Top-10 list is the ontology's claimed implicit ADRs.
3. Compare the two lists.
4. PASS criterion: ≥3 of the 5 maintainer-written ADRs appear (at least as a clear semantic match) in the ontology's top-10 claimed list.

If 3 of 5 PASS but the other 2 are missing, that's the **extractor gap** — the ontology saw the pattern in some files but not enough to surface it. Log a follow-up to refine the implicit-ADR extractor's heuristics for that pattern.

If <3 of 5 PASS, the implicit-ADR claim of the ontology is not yet supported. **Block ontology MVP acceptance** until the extractor improves.

The reverse direction (ontology surfaces ADRs the maintainer didn't list) is *possible signal*, not failure — the ontology may have caught a real implicit decision the maintainer hadn't articulated. Each such case is reviewed individually by maintainer; confirmed-true ones become explicit ADRs in `adrs/`.

## LLM-as-judge integration

### When to use

LLM-as-judge is the workhorse for Types 2, 3, 5 — anywhere the question is "does claim X correspond to evidence Y?". The evaluation literature ([G-Eval, EMNLP 2023](https://aclanthology.org/2023.emnlp-main.153/), [LLM-as-Judge survey, arXiv 2024](https://arxiv.org/abs/2411.15594)) reports 80% agreement with human evaluators at GPT-4-grade reliability, with 500-5000× cost savings over human review ([Comet: LLM-as-a-Judge](https://www.comet.com/site/blog/llm-as-a-judge/)).

The exact reliability is task-specific. For **fact-grounding tasks** like RAG faithfulness, the reliability is high (Spearman ρ ≈ 0.6-0.7 with human; G-Eval reports 0.514 on summarization, [RAGAS validates faithfulness](https://aclanthology.org/2024.eacl-demo.16/) at production grade). For **subjective tasks** like "is this a good explanation?", reliability degrades. Our Types 2, 3, 5 are fact-grounding tasks; Type 6 is **not** appropriate for LLM-judge (tacit knowledge requires the maintainer).

### Configuration recipe

Per Anthropic's [evaluation guidance](https://platform.claude.com/docs/en/docs/test-and-evaluate/develop-tests) and the [Empirical Study of LLM-as-a-Judge design choices, arXiv 2025](https://arxiv.org/html/2506.13639v1):

| Setting | Recommendation | Source |
|---|---|---|
| **Output format** | Binary `correct`/`incorrect` for Types 2, 5; integer 1-5 for Type 3 | Anthropic ("output only 'correct' or 'incorrect', or judge from a scale of 1-5") |
| **Reasoning** | Chain-of-thought before verdict, in `<thinking>` tags, then verdict in `<result>` tags | Anthropic ("Encourage reasoning") |
| **Decoding** | Non-deterministic sampling (temperature 0.3-0.7) + score averaging (3 runs, mean) | arXiv 2025 ("averaging scores shows the highest correlation with humans") |
| **Score description** | Provide rubric for endpoints (1, 5) only; intermediate scores self-calibrate | arXiv 2025 ("descriptions only for scores 1 and 5 yields the most reliable results") |
| **Position bias** | Randomize position when comparing multiple candidate `understanding` fields | LLM-judge bias literature |
| **Self-preference** | Use a different model family from the one that authored the ontology (e.g., judge with Sonnet if Opus authored) | [Self-Preference Bias, arXiv 2024](https://arxiv.org/html/2410.21819v1) |
| **Calibration set** | 50-100 maintainer-graded probes; tune prompt until LLM-judge ≥85% agreement with maintainer on this set | [RAGAS judge-alignment guide](https://docs.ragas.io/en/stable/howtos/applications/align-llm-as-judge/) ("100-200 examples covering diverse scenarios is sufficient") |
| **Agreement metric** | Cohen's κ (binary) or quadratic-weighted κ (1-5) ≥ 0.6 against calibration set | [Judge's Verdict, arXiv 2025](https://arxiv.org/html/2510.09738v1) |

### When NOT to use

- **Type 6 (implicit-ADR)**: tacit knowledge isn't in the LLM's training data in the form needed; only the maintainer is oracle.
- **Subjective rubrics with no operator-aligned definition**: "is this code well-organized?" — defer or rephrase.
- **High-stakes single-point decisions**: never let LLM-judge be the only signal that flips item `done`. Always keep maintainer in the loop on a sampled subset (≥5% of judged probes).
- **Adversarial Type 4 probes**: the LLM-judge can confirm "ontology returned empty" trivially without a judge call. Use code-based grading (`assert result.isEmpty()`) — fastest, most reliable per Anthropic's grading hierarchy.

## Sample-then-judge MVP design

Single maintainer cannot human-review 1000+ ontology nodes per refresh. The sample-then-judge protocol scales review without losing reliability. Flow:

```
                  ┌─────────────────────────────────────┐
                  │  ONTOLOGY REFRESH (e.g., monthly)   │
                  │  N = 1000-5000 nodes                │
                  └──────────────┬──────────────────────┘
                                 ▼
                  ┌──────────────────────────────────────┐
                  │  STRATIFIED RANDOM SAMPLE (5%)       │
                  │  Stratify by: axis × kind            │
                  │  Sample size: ~50-250 nodes          │
                  └──────────────┬───────────────────────┘
                                 ▼
                  ┌──────────────────────────────────────┐
                  │  LLM-AS-JUDGE (Types 2, 3, 5)        │
                  │  Score each: correct / incorrect     │
                  │  Cost: ~$5-25 per refresh            │
                  └──────────────┬───────────────────────┘
                                 ▼
                  ┌──────────────────────────────────────┐
                  │  THRESHOLD GATE                      │
                  │  ≥85% correct → trusted              │
                  │  75%-85% → maintainer spot-check 10  │
                  │  <75% → BLOCK; refresh extractor     │
                  └──────────────┬───────────────────────┘
                                 ▼
                  ┌──────────────────────────────────────┐
                  │  ADVERSARIAL ROUND (Type 4)          │
                  │  3 maintainer-authored probes        │
                  │  ≥2/3 PASS                           │
                  └──────────────┬───────────────────────┘
                                 ▼
                  ┌──────────────────────────────────────┐
                  │  IMPLICIT-ADR ROUND (Type 6)         │
                  │  5 maintainer-written ADRs vs        │
                  │  top-10 ontology-claimed             │
                  │  ≥3/5 surface in top-10              │
                  └──────────────┬───────────────────────┘
                                 ▼
                  ┌──────────────────────────────────────┐
                  │  ACCEPT / BLOCK / DEFER              │
                  └──────────────────────────────────────┘
```

### Stratification

Per [stratified sampling guidance](https://online.stat.psu.edu/stat506/Lesson06), stratify by `axis × kind` so high-importance categories (controllers, config-key-consumers, sdk-builders) aren't under-represented when adapter nodes dominate volume. Allocate sample proportionally per stratum, with a minimum of 5 per stratum to keep estimation usable.

### Sample size

For 1000 ontology nodes and 95% confidence ± 5%, simple random sample of ~280 nodes; for 5000 nodes, ~360 nodes. The 5% rule above (50-250 sample for 1000-5000 nodes) is a budget shortcut, not a statistically rigorous CI calculation. Tighten if the maintainer cares about precision over budget.

For acceptance threshold (≥85% correct), the [verification sampling plan literature](https://variation.com/stat-12-verification-validation-sampling-plans-for-proportion-nonconforming/) gives concrete guidance — n=125 with c=2 (accept if ≤2 incorrect of 125) provides 95% confidence the true defect rate is ≤5%. For our application, n=200 with c=30 (accept if ≤15% incorrect) tracks the 85% threshold at 95% confidence — practical and aligned with cost shape.

### Cost shape

| Component | Cost per refresh |
|---|---|
| Stratified sample → 200 nodes | (free, indexing) |
| LLM-judge ×3 runs ×200 nodes (Types 2,3,5) | $15-60 (Sonnet/Haiku — judge model is cheaper than authoring model) |
| Maintainer spot-check 10 nodes | ~30 min |
| Adversarial round (3 probes) | ~30 min maintainer + $1 LLM-judge |
| Implicit-ADR round | ~60 min maintainer (rare — quarterly, not per-refresh) |
| **Total per refresh** | **$15-60 + 1-2 hours maintainer time** |

For a quarterly refresh schedule, that's ~$60-240/year + 4-8 maintainer-hours/year. Tractable for OSS-no-budget. Compare to "exhaustive human review of 5000 nodes": ~250 hours/refresh = unworkable.

## Acceptance criteria

MVP semantic ontology is accepted when **all** the following hold:

| Check | Threshold | Source rationale |
|---|---|---|
| **Existence probes** (Type 1, inherited from substrate) | All 12 substrate seed probes PASS | Substrate's existing PROBES.md MVP criterion |
| **Sample faithfulness** (Type 2 across stratified sample) | ≥85% correct, n≥200 | RAGAS faithfulness production threshold; verification sampling plan |
| **Cross-axis joins** (Type 3 across 5 invariants) | ≥4/5 invariants hold; sampled positives ≥80% true | Best-practice graph integrity; conservative |
| **Doc-as-ground-truth** (Type 5 across non-null `documents` nodes) | ≥85% bidirectional faithfulness; BERTScore F1 ≥0.85 OR LLM-judge `correct` | RAGAS + BERTScore production thresholds |
| **Adversarial PASS** (Type 4) | ≥2/3 maintainer-authored adversarial probes return empty/null | ReEval's accuracy-drop floor; substrate's existing 2/3 rule |
| **Implicit-ADR confirmation** (Type 6) | ≥3/5 maintainer-written ADRs appear in top-10 ontology-claimed | Tacit-knowledge floor — circular validation impossible, this is the only oracle |
| **Calibration agreement** (LLM-judge vs maintainer on calibration set) | Cohen's κ ≥ 0.6 | Judge's Verdict 2025 — Tier-1 LLM-judge alignment |

If **any** one fails: BLOCK the ontology MVP. Classify the failure (extractor bug / authoring quality / hallucination / tacit-knowledge gap) and refresh. Substrate's three-class FAIL taxonomy applies and is extended:

- **Axis gap** — ontology lacks a node type for the kind of capability tested.
- **Extractor bug** — node exists but `understanding` / `implicit_adrs` / `caveats` field is wrong.
- **Annotation gap** — node exists but lacks `documents:` link.
- **Hallucination** — `understanding` claim not supported by source. **New, semantic-specific.**
- **Drift** — `understanding` was true at extraction commit; code changed. **New, semantic-specific.**
- **Tacit-knowledge gap** — implicit ADR present in code but not surfaced. **New, Type 6 only.**

Each FAIL produces a regression probe per the substrate's pattern + a follow-up logged via `playbooks/follow-up-on-disk.md`.

## Adversarial round design

The adversarial round runs every refresh. Three probes; ≥2 PASS. Maintainer-only authorship — the implementer cannot see the probes before the round (substrate's "implementer only optimizes for visible probe list" rule).

### Construction patterns

Each refresh round must include at least one of each:

1. **Capability-negation probe** — take a real capability, flip a key attribute. ("dark mode that ties to user locale" — when codebase has dark mode and i18n but they're not bridged.)
2. **Cross-product-fabrication probe** — combine two real concepts into a capability the codebase doesn't have. ("OIDC-driven scheduled jobs that emit Prometheus metrics".)
3. **Synonym-swap-with-negation probe** — replace a real concept's name with a related but different concept. ("server-side i18n" — when only client-side exists.)

### Construction protocol

Maintainer (10 min per round):
1. Pick three real capabilities from the codebase.
2. Apply one of the three patterns above to each.
3. Verify by grep that the fabricated capability does not in fact exist (commit-pinned).
4. Submit the three probes to the ontology *exactly as a real query would arrive*.

### Pass criterion

For each probe:
- **Empty result set** → PASS.
- **Empty result + explanatory `null`-cause field** ("no node matches: combinations of axes X and Y are not represented") → PASS+ (best case — ontology can self-explain its limits).
- **Confident match to a real-but-different node** → FAIL (false-positive hallucination).
- **Made-up node not present in nodes.jsonl** → CRITICAL FAIL (the ontology should never fabricate the node set).

### Rhythm

- **Every refresh**: 3 capability-negation/cross-product/synonym probes — fast.
- **Quarterly**: a 10-probe extended adversarial round (5 from above + 5 maintainer-authored "we'll see" probes) — covers categories not exercised by routine probes.
- **Per blind-spot incident**: one new adversarial probe added permanently. Same as substrate's regression-probe rule.

## Cross-validation against the existing substrate's syntactic probes

The substrate's PROBES.md tests **whether nodes exist where they should**. The agentic ontology's PROBES.md tests **whether nodes mean what they should**. The two layers must compose:

| Substrate probe | Semantic-extension |
|---|---|
| "i18n is enumerated under `ui_shell`" | "the i18n node's `understanding` says 'six-language UI bootstrap via react-i18next' — verifiable against `i18n.ts`" |
| "every controller is enumerated" | "every controller node carries an `responsibility` field that aligns with its OpenAPI tag's description" |
| "every config-key-consumer is found" | "every config-key-consumer node's `caveats` field documents the runtime risk (LSN-001/002 class)" |
| "every SDK builder is enumerated (Phase 2)" | "every SDK builder node's `unset_parameter_audit` matches the result of Gate 5 at extraction commit" |

Operational rules for composition:
1. **A semantic probe presupposes the substrate probe passed** — don't run Type 2 on a node the substrate's Type 1 already says doesn't exist.
2. **Substrate FAIL stops semantic** — until the node is enumerated, there's nothing to score the semantics of.
3. **Semantic FAIL doesn't invalidate substrate PASS** — the node still exists; only its description is wrong. Log as hallucination + refresh extractor for that node only.
4. **Substrate's regression-probe set is a superset of semantic's** — every semantic probe targets a node, that node is in the substrate set. The substrate set is the universe.
5. **Adversarial probes operate on the union** — they ask "does the ontology answer correctly when nothing should match?", same shape across both layers.

When the substrate ships first (per ADR's phase sequencing — substrate MVP → agentic ontology layered on top), the existing 12 seed probes become the **enumeration baseline** for the semantic layer. Semantic acceptance threshold (`≥85% correct`) applies to the universe the substrate already enumerated; it does not paper over substrate gaps.

## Probe-set ownership

Same as substrate — the probe list is co-authored with the maintainer, lives in this file (workspace-canonical) at `lineage/PROBES.md` once MVP ships, and grows on every blind-spot incident. The semantic-side maintenance contract:

1. **Per refresh**: maintainer authors 3 adversarial probes, reviews 10 spot-check Type 2 results.
2. **Per quarter**: maintainer authors 5 implicit-ADR probes, runs the extended adversarial round.
3. **Per LSN incident**: the new LSN's "rule that emerged" includes one adversarial probe + one Type-2/5 regression probe targeting the failure mode.
4. **Per release-train**: doc-as-ground-truth (Type 5) runs against every page in `documentation/docs/SUMMARY.md`, drift findings become DOC-NNN follow-ups via `playbooks/follow-up-on-disk.md`.
5. **Per ontology refresh**: the LLM-judge prompt itself is re-validated against the calibration set; if drift in the judge's agreement (Cohen's κ drops below 0.55), recalibrate the judge prompt before accepting that refresh.

The maintainer holds ultimate veto on every accepted refresh. The sample-then-judge gates are the floor, not the ceiling — no automation removes the need for maintainer eyes on a sampled subset.

## What MVP probe-pass concretely looks like

Single concrete number set the maintainer can hold the implementer to:

> **MVP semantic ontology accepted when:**
> 1. **All 12 substrate seed probes PASS** (existence-of-capability, syntactic).
> 2. **≥85% sample faithfulness** on a stratified sample of n=200 (Types 2/3/5 combined; LLM-judge with reasoning, three-run averaging, against a model from a different family than the authoring model).
> 3. **≥4/5 cross-axis joined invariants hold** with ≥80% true-positive rate on sampled positives.
> 4. **Adversarial round: ≥2/3 PASS** on maintainer-authored capability-negation probes (refresh round) + extended adversarial round 10/10 within ≥66% over the calibration period.
> 5. **Implicit-ADR confirmation: ≥3/5** maintainer-written ADRs surface in top-10 ontology-claimed.
> 6. **Cohen's κ ≥ 0.6** between LLM-judge and maintainer on the 50-100 calibration probe set.
> 7. **Every FAIL is classified** (axis-gap / extractor-bug / annotation-gap / hallucination / drift / tacit-gap) and a follow-up logged on disk.
> 8. **No fabricated nodes** (Type 4 CRITICAL FAIL must be 0/N).

## Sources

### LLM-as-judge foundational literature

- [G-Eval: NLG Evaluation using GPT-4 with Better Human Alignment, EMNLP 2023](https://aclanthology.org/2023.emnlp-main.153/) — chain-of-thought judge with form-filling paradigm; Spearman ρ 0.514 with human on summarization.
- [Empirical Study of LLM-as-a-Judge: How Design Choices Impact Evaluation Reliability, arXiv 2025](https://arxiv.org/html/2506.13639v1) — score averaging > greedy decoding; rubric for endpoints (1, 5) only; CoT marginal when criteria are clear.
- [LLM-as-a-Judge survey, arXiv 2024](https://arxiv.org/abs/2411.15594) — taxonomy of 50+ LLM-judge methods.
- [Judge's Verdict, arXiv 2025](https://arxiv.org/html/2510.09738v1) — 27/54 LLMs achieve Tier-1 alignment via Cohen's κ.
- [Justice or Prejudice? Quantifying Biases in LLM-as-a-Judge](https://llm-judge-bias.github.io/) — verbosity, position, self-preference biases.
- [Self-Preference Bias in LLM-as-a-Judge, arXiv 2024](https://arxiv.org/html/2410.21819v1) — judges favour their own model family even when source is anonymized.
- [Position Bias in Pairwise LLM-as-a-Judge, arXiv 2024](https://arxiv.org/html/2406.07791v5) — win-rate flips 2.5%→82.5% when output position changes.

### RAG / faithfulness evaluation

- [RAGAS: Automated Evaluation of Retrieval Augmented Generation, arXiv 2023](https://arxiv.org/abs/2309.15217) — reference-free RAG evaluation framework.
- [RAGAS faithfulness metric documentation](https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/faithfulness/) — `faithfulness = supported_claims / total_claims`; threshold 1.0 = perfect.
- [RAGAS judge-alignment guide](https://docs.ragas.io/en/stable/howtos/applications/align-llm-as-judge/) — 100-200 calibration examples sufficient.
- [Mistral: Evaluating RAG with LLM as a Judge](https://mistral.ai/news/llm-as-rag-judge) — production RAG evaluation patterns.

### Knowledge-graph + ontology hallucination evaluation

- [GraphEval: A Knowledge-Graph Based LLM Hallucination Evaluation Framework, arXiv 2024](https://arxiv.org/abs/2407.10793) — KG-triple decomposition + NLI verification for hallucination detection.
- [Knowledge Graphs, LLMs, and Hallucinations, JoWS 2024](https://vbn.aau.dk/ws/portalfiles/portal/756595643/JoWS_position.pdf) — survey: KGs as grounding scaffold for LLM claims.
- [Ontology-grounded knowledge graphs for clinical QA, ScienceDirect 2025](https://www.sciencedirect.com/science/article/abs/pii/S1532046426000171) — ontology + KG mitigates hallucinations in clinical-domain QA.

### Adversarial probing

- [ReEval: Automatic Hallucination Evaluation for Retrieval-Augmented LLMs via Transferable Adversarial Attacks, arXiv 2023](https://arxiv.org/html/2310.12516) — answer-swapping + context-enriching adversarial probes; 90% natural-attack rate per human eval.
- [Multi-model assurance against adversarial hallucination attacks, Nature 2025](https://www.nature.com/articles/s43856-025-01021-3) — adversarial fabrication framework for clinical decision support.

### Embedding-based semantic similarity

- [BERTScore: Evaluating Text Generation with BERT, ICLR 2020](https://arxiv.org/abs/1904.09675) — embedding-based semantic similarity.
- [BERTScore production guide 2025](https://www.shadecoder.com/topics/bertscore-a-comprehensive-guide-for-2025) — F1 ≥0.85 production threshold; antonymy/named-entity blind spots.
- [CodeBERTScore for code summarization](https://aclanthology.org/2023.emnlp-main.859.pdf) — code-specific embedding similarity, more correlated with execution correctness than BLEU/CodeBLEU.

### Anthropic-specific evaluation guidance

- [Anthropic: Define success criteria and build evaluations](https://platform.claude.com/docs/en/docs/test-and-evaluate/develop-tests) — binary `correct`/`incorrect` or 1-5 scale; reasoning before scoring; cross-family judge to mitigate self-preference; LLM-graded only after reliability validation.
- [Anthropic Cookbook](https://platform.claude.com/cookbook/) — practical eval recipes.

### Tacit-knowledge / implicit-ADR validation

- [BEACON: AI-assisted tacit knowledge extraction, Frontiers 2025](https://www.frontiersin.org/journals/built-environment/articles/10.3389/fbuil.2025.1674307/full) — only domain-expert review surfaces tacit decisions.
- [Knowledge and Information Structuring in Reverse Engineering, Springer 2016](https://link.springer.com/chapter/10.1007/978-3-319-33111-9_39) — collaborative knowledge construction with SME oversight.
- [Tacit knowledge elicitation for industry 4.0, Springer 2022](https://link.springer.com/article/10.1007/s44163-022-00020-w) — elicitation patterns for tacit organizational knowledge.

### Sampling / acceptance plans

- [Stratified random sampling, PSU STAT 506](https://online.stat.psu.edu/stat506/Lesson06) — stratification by category for proportional sample.
- [Verification/Validation Sampling Plans for Proportion Nonconforming](https://variation.com/stat-12-verification-validation-sampling-plans-for-proportion-nonconforming/) — n=200, c=30 acceptance plan for 85% threshold.

### Workspace-internal references

- `lineage/PROBES.md` (workspace-canonical, 2026-05-08)
- `adrs/drafts/research/code-lineage-substrate/PROBES.md` (substrate research artefact)
- `adrs/drafts/research/code-lineage-substrate/SUMMARY.md` (synthesis with confidence levels)
- `adrs/drafts/code-lineage-substrate.md` (substrate ADR draft, revision 2)
- `playbooks/follow-up-on-disk.md` (the FAIL→follow-up routing)
- `retrospectives/LSN-001`, `LSN-002`, `LSN-006`, `LSN-007` (the failure modes both PROBES artefacts target)
- `CLAUDE.md` Gate 9 (factual claim provenance — the discipline this artefact extends to semantic claims)
