# Methodology meta-review — artefacts

This directory holds the output of the methodology **meta-review**: a periodic, independent review of the agentic-ontology methodology, from outside its own build loop. Methodology integration: `APPROACH.md` §16 (Failure E, Rule 16). Run it with the `/panel` skill.

**History.** Through rev-8 the meta-review was the *Adversarial Review Panel* — six expert subagents + a chair, run in three phases. Rev-9 (`retrospectives/LSN-024`) replaced the committee with a single `methodology-reviewer` agent: the six were correlated Claude agents scoring conformance with no memory; they re-listed stale findings and missed a whole methodology revision. The `/panel` invocation is kept for continuity. Older `panel-report.md` files in the dated dirs are the legacy panel runs.

The `methodology-reviewer` traces the WHOLE current methodology end-to-end — `APPROACH.md` (every section + revision), the ADRs, the agent contracts, the skills, the playbooks, the case-law, and the live artefacts — diffs against the prior review, runs fresh blind spot-checks against the real codebase, and emits real gaps + real improvement proposals (including subtraction). One agent, one pass.

## Layout

```
meta-reviews/
  README.md                  # this file
  target.md                  # the explicit target the review measures against — maintainer-owned, improvable
  trend.md                   # one row per run — the trajectory over time
  spot-check-ledger.md       # the review's spot-check targets — TARGETS ONLY, no verdicts
  validation/                # the maintainer-authored acceptance corpus (see validation/README.md)
  {YYYY-MM-DD}/
    review.md                # the review (rev-9+); older dirs hold the legacy panel-report.md + raw/
```

## How to read a `review.md`

Top to bottom — it is ordered by what matters most:

1. **`verdict`** — `on-track` / `changes-needed` / `structural-rethink`, with a plain-language paragraph.
2. **`what_changed_since_last_review`** — per prior finding: fixed / partial / unactioned / superseded / obsolete. The review has memory; it does not re-list.
3. **`pipeline_trace`** — the end-to-end trace of the live methodology pipeline.
4. **`gaps`** — ranked, each evidence-cited and checked against the methodology's own decisions.
5. **`improvement_proposals`** — ranked, concrete, including subtraction.
6. **`fresh_spot_checks`** — fresh blind checks against real source.
7. **`cost`** + **`correlated_blind_spot_caveat`** / **`needs_human_verification`** — read this every time (next section).

## The standing caveat

The reviewer is a **Claude-family** agent reviewing artefacts built by **Claude-family** agents. It shares blind spots — by construction. A finding carries weight only from its **cited evidence** (a `file:line` that resolves, a verdict traced to source), never from the reviewer's confidence. The review **does not replace** the maintainer's own spot-checks — it **aims** them: every report ends with a `needs_human_verification` list. Until `/panel validate` passes a maintainer-authored acceptance corpus, every report is `validation_status: pre-acceptance-gate` and its findings are **provisional**.

## Findings are candidates, not actions

The review emits findings as triage-ready **candidates**. The maintainer triages them. The review never edits `APPROACH.md`, `CLAUDE.md`, the ADRs, the agents, the backlog, or the source.
