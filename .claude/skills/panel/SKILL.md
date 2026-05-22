---
name: panel
description: Run the methodology meta-review — a single methodology-reviewer agent that traces the whole current methodology (APPROACH.md, the ADRs, the agent contracts, the skills, the playbooks, the case-law, the live artefacts), diffs against the prior review, runs fresh blind spot-checks against real source, and emits real gaps + improvement proposals at lineage/{repo}/meta-reviews/{date}/review.md. `/panel` runs it; `/panel --show` prints the latest; `/panel validate` runs the acceptance-corpus check.
argument-hint: "[--repo <repo>] | validate | --show [<date>]"
allowed-tools: Read Bash Glob Agent
---

# /panel — methodology meta-review

One invocation = one full meta-review of the agentic-ontology methodology. A single `methodology-reviewer` agent traces the whole current methodology end-to-end — `APPROACH.md`, the ADRs, the agent contracts, the skills, the playbooks, the case-law, and the live artefacts — diffs against the prior review, runs fresh blind spot-checks against the real target source, and emits real gaps + real improvement proposals. Per `APPROACH.md` §16.

**History.** Through rev-8 this was the *Adversarial Review Panel* — six expert subagents + a chair, 7-13 agent invocations a run. Rev-9 (`retrospectives/LSN-024`) replaced the committee with one tracing review: the six were correlated Claude agents scoring conformance against a fixed target, with no memory; they re-listed stale findings every run and missed a whole methodology revision (rev-7's graph query layer). The `/panel` invocation is kept for continuity; it now runs one agent at roughly one-seventh the cost.

Runs **periodically — per milestone, never per-commit** (cost discipline). Findings are candidates the maintainer triages; the review never auto-acts.

## Argument forms

| Form | Behaviour |
|---|---|
| `/panel` | Run the methodology-reviewer — one pass. |
| `/panel --repo <repo>` | Target a repo other than `odd-platform`. |
| `/panel --show [<date>]` | Print the latest `review.md` (or the one for `<date>`). No agent spawned. |
| `/panel validate` | Run the maintainer-authored acceptance-corpus check (see `meta-reviews/validation/README.md`). |

## Path resolution (run BEFORE pre-flight)

Substitute these at runtime; never hardcode an absolute path into a committed file (memory: `feedback_no_hardcoded_absolute_paths`).

```bash
WORKSPACE_ROOT=$(git rev-parse --show-toplevel)
REPO=odd-platform                                   # or the --repo argument
REPO_ROOT=$(realpath "$WORKSPACE_ROOT/../$REPO")
SPEC_REPO=$(realpath "$WORKSPACE_ROOT/../opendatadiscovery-specification")
LINEAGE_DIR="$WORKSPACE_ROOT/lineage/$REPO"
DATE=$(date +%F)
RUN_DIR="$LINEAGE_DIR/meta-reviews/$DATE"
```

## Pre-flight (in order — abort if any fails)

1. **`--show` short-circuit.** If the argument is `--show`, read `$RUN_DIR/review.md` (or the most recently modified `meta-reviews/*/review.md`; fall back to a legacy `panel-report.md`; or the `<date>` given), print it, and exit. No agent.
2. **`validate` short-circuit.** If the argument is `validate`, jump to "/panel validate" below.
3. **Substrate present.** `lineage/$REPO/manifest.yaml` must exist. Read `COMMIT_ANCHOR` = the substrate commit it records. If absent → abort: "no substrate for $REPO — run the extractor first."
4. **Run dir.** `mkdir -p "$RUN_DIR"`. If `$RUN_DIR/review.md` already exists, this is a re-run for today — rename the prior `$DATE` dir to `$DATE-aN` before proceeding (never silently overwrite a prior review).
5. **Prior review.** `PRIOR_REVIEW_PATH` = the newest prior `meta-reviews/*/review.md`; if none exists, the newest legacy `meta-reviews/*/panel-report.md`; else `none`.

## The run — one agent

Fire ONE `Agent` call, `subagent_type: methodology-reviewer`, `model: opus`, `run_in_background: false`, prompt = the Input block:

```
REVIEW_RUN: <DATE>
WORKSPACE_ROOT_ABS: <WORKSPACE_ROOT>
REPO_ROOT_ABS: <REPO_ROOT>
SPEC_REPO_ABS: <SPEC_REPO>
LINEAGE_DIR_ABS: <LINEAGE_DIR>
COMMIT_ANCHOR: <COMMIT_ANCHOR>
TARGET_PATH: lineage/<REPO>/meta-reviews/target.md
PRIOR_REVIEW_PATH: <…or none>
REVIEW_REPORT_PATH: lineage/<REPO>/meta-reviews/<DATE>/review.md
TREND_PATH: lineage/<REPO>/meta-reviews/trend.md
LEDGER_PATH: lineage/<REPO>/meta-reviews/spot-check-ledger.md
```

The turn BLOCKS until it completes (foreground). Expect 10-30 min.

**Agent-registration fallback.** `methodology-reviewer` is registered from `.claude/agents/` at session start. If `/panel` is run in the *same* session that authored or edited that file, the type is not yet registered and the `Agent` call errors "agent type not found". Then spawn `subagent_type: general-purpose` (`model: opus`) with the first prompt line: *"Read `.claude/agents/methodology-reviewer.md` in full and execute it as your system prompt."* — the same pattern `/next-batch` uses. A fresh session needs no fallback.

**Failure handling.** If the agent fails (timeout / error), leave `$RUN_DIR` and surface the failure — there is no partial state to resume.

## Post-run — commit + surface

1. Verify `$RUN_DIR/review.md` exists and its frontmatter has `verdict`.
2. Stage and commit to the current branch (no push — the maintainer pushes):
   ```bash
   git add "lineage/$REPO/meta-reviews/$DATE/" \
           "lineage/$REPO/meta-reviews/trend.md" \
           "lineage/$REPO/meta-reviews/spot-check-ledger.md"
   git commit -m "panel: methodology review $DATE — <verdict>"
   ```
3. Surface to the maintainer: the verdict, the gap count, the improvement-proposal count (and how many are subtractions), the count of `needs_human_verification` items, and — if `validation_status: pre-acceptance-gate` — that findings are provisional until `/panel validate` passes.

## /panel validate — the acceptance / drift gate

The review's reports are provisional until a maintainer-authored acceptance corpus validates the reviewer.

1. Check for the corpus: `meta-reviews/validation/gold-set.yaml` (hand-labelled ontology slices: real-gap present/absent + severity) and `meta-reviews/validation/seeded-corpus/` (mutated known-wrong artefacts).
2. **If absent** → print `meta-reviews/validation/README.md` (how to build it — it MUST be maintainer-authored; an LLM-authored gold set is correlated with the reviewer and worthless) and exit.
3. **If present** → spawn `methodology-reviewer` against the gold set + seeded corpus; compute recall + seeded-defect detection rate (overall + the data-loss/security class); write `meta-reviews/validation/<date>-gate.md`; update `baseline.yaml`.

## Safety rails

- NEVER `git push --force`, `git reset --hard`, `rm -rf`, or push automatically.
- The review is READ-ONLY against `$REPO_ROOT`, `$SPEC_REPO`, and the live docs.
- It writes ONLY under `lineage/$REPO/meta-reviews/`. It NEVER edits `APPROACH.md`, `CLAUDE.md`, the ADRs, the agents, the backlog, the sidecars, or the source — findings are candidates the maintainer triages.
- If a tool call hits a permission prompt → that is a `settings.local.json` gap; surface it, do not bypass.
- Self-kill: if the last 3 reviews report zero actionable findings, surface "the review has found nothing actionable for 3 runs — consider pausing it."

## Cross-references

- `APPROACH.md` §16 — the meta-review subsystem; §2 Failure E; §5 Rule 16.
- `.claude/agents/methodology-reviewer.md` — the reviewer's contract.
- `lineage/{repo}/meta-reviews/` — `README.md`, `target.md`, `trend.md`, `spot-check-ledger.md`, `validation/`, the dated run dirs.
- `retrospectives/LSN-021` — the case-law that created the subsystem; `retrospectives/LSN-024` — the case-law that simplified it to a single reviewer.
- `adrs/drafts/adversarial-review-panel.md` — the original rev-6 panel design; superseded by rev-9, pending the maintainer's ADR update.
