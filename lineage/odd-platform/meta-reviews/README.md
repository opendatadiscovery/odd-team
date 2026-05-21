# Adversarial Review Panel — meta-review artefacts

This directory holds the output of the **Adversarial Review Panel**: a periodic, independent self-audit of the agentic-ontology methodology. Design: `adrs/drafts/adversarial-review-panel.md`; methodology integration: `APPROACH.md` §16 (Failure E, Rule 16). Run it with the `/panel` skill.

The panel is six expert subagents (on six orthogonal axes) + a chair, run in three phases — independent assessment → one cross-examination round → chair synthesis. It audits the methodology's **process**, **progress**, and **cost** from outside its own frame, generates fresh blind spot-checks against the real codebase, and emits one structured verdict.

## Layout

```
meta-reviews/
  README.md                  # this file
  target.md                  # the explicit target the panel measures against — maintainer-owned, improvable
  trend.md                   # one scorecard row per run — the trajectory over time
  spot-check-ledger.md       # the Adversary's tested targets — TARGETS ONLY, no verdicts
  validation/                # the maiden-acceptance / periodic-drift gate (see validation/README.md)
  {YYYY-MM-DD}/
    panel-report.md          # the headline verdict report
    raw/                     # the 6 Phase-1 expert reports + 6 Phase-2 cross-examination memos
```

## How to read a `panel-report.md`

Read it top to bottom — it is ordered by what matters most:

1. **`verdict`** — `GO` / `GO-WITH-CHANGES` / `STRUCTURAL-RETHINK`, with a plain-language paragraph. This is the blunt answer to "is the methodology on track to hit its target?"
2. **`scorecard`** — six axes (Coverage / Process / Cost / Depth / Usefulness / Honesty), each RED/AMBER/GREEN + 0-10, plus the overall and the delta vs the prior run.
3. **`fresh_spot_check_ledger`** — the Adversary's checks this run and their verdicts.
4. **`consensus_findings`** / **`contested_findings`** — what the panel agreed on vs disagreed on. Contested findings are surfaced, never averaged away.
5. **`what_went_well`** / **`what_must_improve`** — each must-improve item is routed to a concrete destination.
6. **`lsn_regression_check`** — whether a fresh blind finding rediscovered a "closed" LSN (a critical regression).
7. **`cost`** — the methodology's cost verdict + the panel's own run cost.
8. **`correlated_blind_spot_caveat`** + **`needs_human_verification`** — read this every time (next section).

## The standing caveat — read every report with this in mind

The panel is six **Claude-family** agents auditing artefacts built by **Claude-family** agents. They share blind spots. Their unanimity is **weak evidence** — in the worst case it is one correlated opinion restated six times, not six independent confirmations. A panel finding carries weight only from the **cited evidence** attached to it (a `file:line` that resolves, a verdict traced to source), never from how many experts agreed.

The panel **does not replace** the maintainer's own spot-checks — it **aims** them. Every report ends with a `needs_human_verification` list: the checks where the panel is least confident it was independent enough. Spend scarce human attention there.

Until `/panel validate` passes the maiden acceptance gate (`validation/`), every report is marked `validation_status: pre-acceptance-gate` and its findings are **provisional**.

## Findings are candidates, not actions

The panel emits findings as triage-ready **candidates** routed to a destination (`new-gate` / `approach-rev` / `lsn-candidate` / `backlog-item` / `cut-this-step` / `human-verify`). The maintainer triages them. The panel never edits `APPROACH.md`, `CLAUDE.md`, the ADRs, the backlog, or the source.
