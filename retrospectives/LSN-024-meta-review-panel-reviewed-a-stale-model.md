---
id: LSN-024
title: The meta-review panel reviewed a stale model of the methodology — six correlated experts, no memory, re-recommended a superseded fix
date: 2026-05-22
domain: methodology / meta-review subsystem
severity: medium
gates_informed: [feedback_minimal_resources_maximum_value.md, feedback_linus_torvalds_engineering_bar.md]
status: open
---

# LSN-024: The meta-review panel reviewed a stale model of the methodology

## What happened

The Adversarial Review Panel (rev-6, `APPROACH.md` §16) — six expert subagents + a chair — ran its third meta-review on 2026-05-22. The maintainer ran it specifically to verify that the §0 operating-stance change had landed. The run cost ~480k tokens (lite mode).

It re-recommended, as its #3 `what_must_improve` item, *"shard `test-map/index.yaml` to a summary-row index"* — measuring the file at 1.44 MB and calling it context bloat. But the methodology had already answered index bloat: **rev-7 / §17 — the derived graph query layer** — builds an ephemeral graph + vector index from the `detail/` files and retires whole-index loading; §17 even cites *the panel's own prior index-bloat finding* as its trigger. Of the seven panel documents, exactly one (the methodologist's) so much as contained the string "rev 7", and only as a number in a list. The panel re-proposed a solution the methodology had already superseded, because no expert had traced the methodology's own evolution.

The maintainer also observed that the panel produced no fresh improvement proposals — it re-listed the same top-three findings it had raised in the two prior runs — and questioned the cost-to-value of the whole subsystem.

## Why it slipped

- **No expert traced the methodology's own design decisions.** The six experts measured the *artefact state* against a fixed `target.md` and reconstructed "what should be" fresh each run. None was required to read the ADRs / `APPROACH.md` §17 / the revision history and ask *"what has the methodology already decided or built about this?"* The economist measured a byte count; it never asked whether anything still loads that file, given rev-7.
- **No memory.** The panel re-discovered fresh every run, with no diff against the prior report — so it looped: it flagged index bloat, the maintainer answered with rev-7, the panel re-flagged index bloat.
- **Conformance, not improvement.** Each expert scored its axis against `target.md`'s fixed conditions and emitted "condition N unmet." That yields a gap list, not improvement proposals.
- **A correlated committee paid 6× for decorrelation it never delivered.** §16.3 itself concedes the six Claude experts share blind spots. The committee structure cost 7-13 agent invocations for an independence it did not have.
- **`lite` mode** (chosen to save tokens) skipped the Phase-2 cross-examination — the one place the methodologist could have caught the economist's superseded finding.

## Rule that emerged

`APPROACH.md` §16 rev-9: the six-expert panel is replaced by a single `methodology-reviewer` agent. Its contract (`.claude/agents/methodology-reviewer.md`) mandates: Rule 1 — read the WHOLE current methodology (APPROACH every section + every revision, the ADRs, the agent contracts, the skills, the playbooks, the case-law, the live artefacts) before any finding; Rule 2 — check every finding against what the methodology has already decided (a finding that re-proposes a superseded solution is a defect of the review); Rule 3 — diff against the prior review (memory; no re-listing); Rule 4 — emit real gaps AND real improvement proposals, including subtraction. One pass, ~1/7 the cost. The kernel that worked — fresh blind spot-checks against real source — is kept (Rule 5). The seven `panel-*` agents are removed.

## Forcing question

Before flagging a gap or proposing a fix: **have I read the latest revision of the methodology, and has the methodology already decided or built something about this?**

## References

- `lineage/odd-platform/meta-reviews/2026-05-22/panel-report.md` — the run that re-recommended the superseded index-shard.
- `APPROACH.md` §17 (the graph query layer the panel missed) + §16 rev-9 (the fix).
- `.claude/agents/methodology-reviewer.md` — the single-reviewer contract that replaces the seven `panel-*` agents.
- Related LSN: LSN-021 (the subsystem was created because the methodology had no independent oracle); LSN-023 (a sibling — analysis that did not trace the actual current state).
- `adrs/drafts/adversarial-review-panel.md` — the rev-6 panel design; superseded by rev-9, pending the maintainer's ADR update.

## Closure condition

This LSN stays `open` until the `methodology-reviewer` has run at least once and demonstrably (a) traced the whole current methodology including the latest revision and (b) produced a `what_changed_since_last_review` diff rather than re-listing — i.e. the review did not repeat the failure recorded here.
