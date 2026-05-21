# Panel validation — the maiden acceptance gate + periodic drift gate

The Adversarial Review Panel is itself a set of LLM agents. An untested panel reproduces the exact failure it exists to catch — a plausible-sounding artefact nobody verified. Until the **maiden acceptance gate** passes, every `panel-report.md` is marked `validation_status: pre-acceptance-gate` and its findings are **provisional**.

This directory holds the validation corpus and the gate results. Run the gate with `/panel validate`. Design + thresholds: `adrs/drafts/adversarial-review-panel.md` "Validation" + `adrs/drafts/research/adversarial-review-panel/PROBES.md`.

## Why the corpus must be MAINTAINER-authored

The gold set and the seeded-defect corpus are the panel's **external oracle**. If they are authored by an LLM of the same family as the panel, they share its blind spots — a correlated oracle is worthless. **The maintainer hand-authors them.** This is real, irreducible human effort; it is also the single most valuable thing the maintainer can do to make the panel trustworthy. (`/panel` still runs without the corpus — its reports just stay marked provisional.)

## What to build

### 1. `gold-set.yaml` — hand-labelled ontology slices

30-100 slices of the ontology (a sidecar claim, a feature-flow entry, a concepts.yaml row). For each, the maintainer records the ground truth, having checked the real code:

```yaml
- id: GS-001
  artefact: "lineage/odd-platform/understanding/<slug>.md"
  claim: "<the specific claim being judged>"
  verdict: real-gap-present | clean        # the maintainer's ground truth
  severity: CRITICAL | HIGH | MEDIUM | LOW  # if a gap is present
  note: "<one line — why, with the file:line the maintainer checked>"
```

Stratify by severity so the data-loss / security class is represented (mirrors LSN-001, LSN-002 — the failure modes whose miss is unacceptable).

### 2. `seeded-corpus/` — mutated known-wrong artefacts

~40 copies of *correct* ontology artefacts, each mutated into a known-wrong one by exactly one operator. Each mutant is a known positive; the panel must catch it. Five operators:

| Operator | Mutation |
|---|---|
| claim-inversion | Negate an `understanding` / responsibility claim. |
| citation-corruption | Change a cited `file:line` to a wrong-but-plausible location. |
| caveat-deletion | Remove a true caveat block (models the LSN-001 / LSN-002 undocumented-caveat failure). |
| cross-axis-fabrication | Invent a controller×doc (or other cross-axis) join that does not exist. |
| severity-downgrade | Relabel a data-loss caveat as cosmetic. |

Hold out 25% of the corpus — never shown during any panel tuning — as the un-gameable check. Each periodic run draws a **fresh, unannounced** seeded sample.

## The thresholds

| Property | Metric | Maiden gate | Periodic alarm |
|---|---|---|---|
| Agreement | Cohen's κ vs maintainer labels | ≥ 0.60 | drop > 0.10 |
| False negatives | recall on the gold set | ≥ 0.80 | drop > 0.10 |
| False negatives | seeded-defect detection | ≥ 0.80 (≥ 0.90 data-loss/security) | < 0.90 on data-loss/security |
| Calibration | ECE (from self-consistency, not verbalized confidence) | ≤ 0.15 | rise > 0.10 |
| Test-retest | McDonald's ω | ≥ 0.70 | drop > 0.10 |
| Rubber-stamp | label-flip rejection rate | ≈ 100% | any sustained fall |

Thresholds are reasoned starting points (`PROBES` confidence MEDIUM on the numbers) — re-fit after the first two cycles produce a real score distribution.

## Files the gate produces

- `baseline.yaml` — the frozen maiden-run metrics; the reference for every periodic run.
- `{YYYY-MM-DD}-gate.md` — each gate run's measured metrics + pass/alarm.

## Caught real gaps become permanent seeds

Every genuine gap the panel finds — or misses, once the maintainer catches it — is added to the seeded corpus, so it grows from real failure modes (the same discipline as the agentic-ontology probe set).
