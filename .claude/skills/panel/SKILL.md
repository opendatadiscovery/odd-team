---
name: panel
description: Run the Adversarial Review Panel — a periodic, independent self-audit of the agentic-ontology methodology. Spawns 6 expert subagents for independent assessment, one cross-examination round, then a chair synthesis, producing a structured verdict report (GO / GO-WITH-CHANGES / STRUCTURAL-RETHINK) at lineage/{repo}/meta-reviews/{date}/panel-report.md. `/panel` full run; `/panel lite` skips cross-examination; `/panel validate` runs the acceptance/drift gate; `/panel --show` reads the latest report.
argument-hint: "[lite] [--repo <repo>] | validate | --show [<date>]"
allowed-tools: Read Write Edit Bash Glob Grep Agent
---

# /panel — the Adversarial Review Panel

One invocation = one full meta-review of the agentic-ontology methodology, end-to-end. Six independent expert subagents audit the **process**, **progress**, and **cost** from outside the methodology's own frame; one cross-examination round lets them challenge each other; a chair synthesizes one verdict report. Per `adrs/drafts/adversarial-review-panel.md` + `APPROACH.md` §16.

This is a meta-review subsystem, not a pipeline layer. It runs **periodically — per milestone or weekly, never per-commit** (cost discipline). The maintainer reads the verdict; the panel never auto-acts on it.

## Argument forms

| Form | Behaviour |
|---|---|
| `/panel` | Full run — Phase 1 (6 experts) + Phase 2 (cross-examination) + Phase 3 (chair). |
| `/panel lite` | Cheaper run — Phase 1 + Phase 3 only; skips the cross-examination round (7 agents instead of 13). |
| `/panel --repo <repo>` | Target a repo other than the default `odd-platform`. |
| `/panel validate` | Run the maiden acceptance gate (first time) or the periodic drift gate against the maintainer-authored validation corpus. |
| `/panel --show [<date>]` | Print the latest `panel-report.md` (or the one for `<date>`). No agents spawned. |

## Path resolution (run BEFORE pre-flight)

Substitute these at runtime; never hardcode an absolute path into a committed file (memory: `feedback_no_hardcoded_absolute_paths`).

```bash
WORKSPACE_ROOT=$(git rev-parse --show-toplevel)
REPO=odd-platform                                   # or the --repo argument
REPO_ROOT=$(realpath "$WORKSPACE_ROOT/../$REPO")
SPEC_REPO=$(realpath "$WORKSPACE_ROOT/../opendatadiscovery-specification")
LINEAGE_DIR="$WORKSPACE_ROOT/lineage/$REPO"
DATE=$(date +%F)                                    # YYYY-MM-DD
RUN_DIR="$LINEAGE_DIR/meta-reviews/$DATE"
```

## Pre-flight (in order — abort if any fails)

1. **`--show` short-circuit.** If the argument is `--show`, read `lineage/$REPO/meta-reviews/$DATE/panel-report.md` (or the newest `meta-reviews/*/panel-report.md`, or the `<date>` given), print it, and exit. No agents.
2. **`validate` short-circuit.** If the argument is `validate`, jump to the "/panel validate" section below.
3. **Substrate present.** `lineage/$REPO/manifest.yaml` must exist. Read `COMMIT_ANCHOR` = the substrate commit it records. If absent → abort: "no substrate for $REPO — run the extractor first."
4. **Run dir.** `mkdir -p "$RUN_DIR/raw"`. If `$RUN_DIR/panel-report.md` already exists, this is a re-run for today — rename the prior `$DATE` dir to `$DATE-aN` before proceeding (do not silently overwrite a prior verdict).
5. **Maiden-run + validation status.** `IS_MAIDEN_RUN` = true if no prior `meta-reviews/*/panel-report.md` exists. `VALIDATION_STATUS` = `acceptance-gate-passed` if `meta-reviews/validation/baseline.yaml` exists and records a pass; `drift-alarm` if the last validation gate raised an alarm; else `pre-acceptance-gate`.
6. **Target.** `TARGET_PATH` is `lineage/$REPO/meta-reviews/target.md` — the explicit yardstick the panel measures against (per APPROACH.md §16.2). Pass it to every agent regardless. If the file is absent the run still proceeds, but every expert flags it (their Rule 0) and the chair marks the verdict provisional — surface a reminder that an explicit, maintainer-ratified `target.md` is required for an interpretable verdict.
6. **Resumability.** If `$RUN_DIR/raw/phase1-*.md` already exist for all 6 experts (a prior interrupted run), skip Phase 1. If `phase2-*.md` also exist, skip Phase 2.

## Phase 1 — 6 experts, independent assessment, IN PARALLEL

In ONE assistant message, fire **6 `Agent` tool calls** with `run_in_background: false`. Subagent types and model assignment (model-tier spread is a deliberate, documented decorrelation lever per the ADR — Opus for the deepest code-tracing + the synthesis, Sonnet for the rest):

| subagent_type | model |
|---|---|
| `panel-adversary` | opus |
| `panel-engineer` | opus |
| `panel-methodologist` | sonnet |
| `panel-economist` | sonnet |
| `panel-practitioner` | sonnet |
| `panel-skeptic` | sonnet |

**Agent-registration fallback.** The `panel-*` subagent types are registered from `.claude/agents/` at session start. If `/panel` is run in the *same* session that authored or edited those agent files, the new types are not yet in the registry and the `Agent` call errors with "agent type not found". In that case, spawn `subagent_type: general-purpose` instead and make the first line of each prompt: *"Read `.claude/agents/panel-<role>.md` in full and execute it as your system prompt."* — the same pattern `/next-batch` uses for `feature-flow-builder`. A fresh session needs no fallback. This applies to Phase 2 and Phase 3 identically.

Each prompt is the agent's Input block (the agent's own system prompt declares which fields it uses; passing all fields is harmless):

```
PANEL_RUN: <DATE>
PHASE: 1
WORKSPACE_ROOT_ABS: <WORKSPACE_ROOT>
REPO_ROOT_ABS: <REPO_ROOT>
SPEC_REPO_ABS: <SPEC_REPO>
LINEAGE_DIR_ABS: <LINEAGE_DIR>
COMMIT_ANCHOR: <COMMIT_ANCHOR>
TARGET_PATH: lineage/<REPO>/meta-reviews/target.md
SPOT_CHECK_LEDGER_PATH: lineage/<REPO>/meta-reviews/spot-check-ledger.md
PHASE1_REPORT_PATH: lineage/<REPO>/meta-reviews/<DATE>/raw/phase1-<role>.md
```

(`<role>` is the part of the subagent type after `panel-`.) The assistant turn BLOCKS until all 6 complete (parallel-foreground). Expect 5-20 min for the slowest.

**Failure handling.** If 1-2 of 6 experts fail (timeout / error) → continue with the survivors; note the gap for the chair. If 3+ fail → abort the run, leave `$RUN_DIR` for resumption, surface the failure.

## Phase 2 — cross-examination, IN PARALLEL (skipped in `lite` mode)

Verify all 6 `phase1-*.md` exist. In ONE assistant message, fire **6 `Agent` calls** (same subagent types + models as Phase 1), each with:

```
PANEL_RUN: <DATE>
PHASE: 2
WORKSPACE_ROOT_ABS: <WORKSPACE_ROOT>
LINEAGE_DIR_ABS: <LINEAGE_DIR>
PEER_REPORTS_DIR: lineage/<REPO>/meta-reviews/<DATE>/raw/
PHASE2_MEMO_PATH: lineage/<REPO>/meta-reviews/<DATE>/raw/phase2-<role>.md
```

Each expert reads the other 5 Phase-1 reports and files a bounded cross-examination memo. The turn BLOCKS until all 6 complete.

## Phase 3 — chair synthesis

Fire ONE `Agent` call, `subagent_type: panel-chair`, `model: opus`, with:

```
PANEL_RUN: <DATE>
MODE: <full | lite>
IS_MAIDEN_RUN: <true | false>
WORKSPACE_ROOT_ABS: <WORKSPACE_ROOT>
LINEAGE_DIR_ABS: <LINEAGE_DIR>
COMMIT_ANCHOR: <COMMIT_ANCHOR>
TARGET_PATH: lineage/<REPO>/meta-reviews/target.md
RAW_DIR: lineage/<REPO>/meta-reviews/<DATE>/raw/
PANEL_REPORT_PATH: lineage/<REPO>/meta-reviews/<DATE>/panel-report.md
TREND_PATH: lineage/<REPO>/meta-reviews/trend.md
LEDGER_PATH: lineage/<REPO>/meta-reviews/spot-check-ledger.md
PRIOR_PANEL_REPORT_PATH: <newest prior meta-reviews/*/panel-report.md, or "none">
PANEL_RUN_COST: <13 agent invocations (full) | 7 (lite)>
VALIDATION_STATUS: <pre-acceptance-gate | acceptance-gate-passed | drift-alarm>
```

The chair writes `panel-report.md` and appends the trend row + the run's spot-check targets to `trend.md` / `spot-check-ledger.md`.

## Post-run — commit + surface

1. Verify `$RUN_DIR/panel-report.md` exists and parses (frontmatter has `verdict`).
2. Stage explicit paths and commit to the current branch (no push — the maintainer pushes):
   ```bash
   git add "lineage/$REPO/meta-reviews/$DATE/" \
           "lineage/$REPO/meta-reviews/trend.md" \
           "lineage/$REPO/meta-reviews/spot-check-ledger.md"
   git commit -m "panel: meta-review $DATE — verdict <VERDICT>, overall <SCORE>"
   ```
3. Surface to the maintainer: the verdict, the overall score, the consensus-finding count, the count of `human-verify`-routed items, and — if `VALIDATION_STATUS: pre-acceptance-gate` — the reminder that findings are provisional until `/panel validate` passes.

## /panel validate — the acceptance / drift gate

Per `adrs/drafts/adversarial-review-panel.md` "Validation" + `PROBES`. The panel's reports are provisional until the maiden acceptance gate passes.

1. Check for the maintainer-authored corpus: `meta-reviews/validation/gold-set.yaml` (hand-labelled ontology slices: real-gap present/absent + severity) and `meta-reviews/validation/seeded-corpus/` (mutated known-wrong artefacts).
2. **If absent** → print `meta-reviews/validation/README.md` (how to build the corpus — it MUST be maintainer-authored; an LLM-authored gold set is correlated with the panel and worthless) and exit. The panel still runs without it; its reports just stay marked provisional.
3. **If present** → run the gate: spawn the 6 experts against the gold set + seeded corpus; compute Cohen's κ, recall, seeded-defect detection rate (overall + data-loss/security class), ECE, McDonald's ω, label-flip rejection rate; compare to `baseline.yaml` (maiden) or alarm on regression (periodic). Write `meta-reviews/validation/<date>-gate.md` and update `baseline.yaml`. Maiden thresholds: κ ≥ 0.60, recall ≥ 0.80, detection ≥ 0.80 (≥ 0.90 data-loss/security), ECE ≤ 0.15, ω ≥ 0.70, label-flip rejection ≈ 100%.

## Safety rails

- NEVER `git push --force`, `git reset --hard`, `rm -rf`, or push automatically.
- The panel is READ-ONLY against `$REPO_ROOT`, `$SPEC_REPO`, and the live docs — it never writes to the target repos.
- The panel writes ONLY under `lineage/$REPO/meta-reviews/`. It NEVER edits `APPROACH.md`, `CLAUDE.md`, the ADRs, the backlog, the sidecars, or the source — findings are emitted as candidates the maintainer triages.
- If a tool call hits a permission prompt → that is a `settings.local.json` gap; surface it, do not try to bypass.
- Self-kill criterion: if the last 3 `panel-report.md` files all report zero actionable findings, surface "the panel has found nothing actionable for 3 runs — consider pausing it" (it must not become the waste it audits).

## Cross-references

- `adrs/drafts/adversarial-review-panel.md` — the design + the validation protocol + the correlated-blind-spot residual risk.
- `APPROACH.md` §16 — the meta-review subsystem; §2 Failure E; §5 Rule 16.
- `.claude/agents/panel-{adversary,methodologist,economist,engineer,practitioner,skeptic,chair}.md` — the subagent contracts.
- `lineage/{repo}/meta-reviews/` — `README.md`, `trend.md`, `spot-check-ledger.md`, `validation/`, and the dated run dirs.
- `retrospectives/LSN-021-methodology-has-no-independent-oracle.md` — the case-law that triggered the subsystem.
