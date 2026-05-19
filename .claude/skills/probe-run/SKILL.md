---
name: probe-run
description: Run one or more dynamic-verification probes against a local ephemeral docker-compose mirror of the target system. Captures observation traces as committed artefacts at `lineage/{repo}/probe-runs/{date}-{probe_id}.yaml` and merges measured values back into `feature-flows.yaml`, `test-map.yaml`, and per-sidecar `confidence_per_field` annotations. Local-only execution per APPROACH.md section 5 rule 12 + section 9 — no remote infrastructure ever. Slice 2 of `adrs/drafts/dynamic-verification-layer.md`.
argument-hint: <probe-id> | --feature <feature-id> | --batch | --dry-run <probe-id> | --show <probe-id> | --validate <probe-id>
allowed-tools: Read Grep Glob Bash(python3 *) Bash(ls *) Bash(cat *) Bash(git *) Bash(docker *) Bash(docker-compose *) Bash(find *)
---

# Run a dynamic-verification probe (slice 2)

Drive the layer-5 dynamic-verification pipeline. Each invocation executes one (or several) declarative probe definitions against an ephemeral local docker-compose stack, captures measurements, and feeds them back into the static-layer artefacts.

This skill is the maintainer-facing entry point per `adrs/drafts/dynamic-verification-layer.md` slice 2.

## Prerequisite

- Local Docker daemon running and reachable as the current user (`docker ps` succeeds without sudo).
- `python3` with `PyYAML` + `requests` installed.
- The probe-stack docker-compose file exists at `lineage/_extractor/probe-stacks/{profile}.docker-compose.yml`.
- The probe definition exists at `lineage/{repo}/probes/{probe-id}.yaml` and is well-formed (`runner.py --validate <id>` passes).
- The substrate has been scanned at least once (`lineage/{repo}/manifest.yaml` exists with `last_scan_commit`).

If any prerequisite fails, the skill reports the missing piece and exits.

## Argument forms

| Form | Behaviour |
|---|---|
| `/probe-run <probe-id>` | Execute one probe; produce one probe-run artefact; merge measured values into the static layers. |
| `/probe-run <id-1> <id-2> ...` | Execute multiple probes in batch mode (shared docker-compose lifecycle). All listed probes must share the same `stack_profile`. Slice-4 capability. |
| `/probe-run --feature <feature-id>` | Slice-5. Resolve `feature_id` against `lineage/{repo}/probes/*.yaml`; run every matching probe in batch mode. Mutually exclusive with positional probe IDs. |
| `/probe-run --batch <id-1> ...` | Explicit batch-mode flag. Implied when multiple positional IDs are given OR when `--feature` matches more than one probe. |
| `/probe-run --dry-run <probe-id>` | Validate + parse + report what WOULD execute, but do not bring up the stack. |
| `/probe-run --show <probe-id>` | Read-only. Print the probe definition + the most recent probe-run artefact for that probe ID. |
| `/probe-run --validate <probe-id>` | Read-only. Parse probe + scope-check; exit 0 if well-formed, non-zero otherwise. |
| `/probe-run <probe-id> --no-merge` | Execute the probe but do NOT merge measured values back into the static layers. Useful for iterating on probe design. |
| `/probe-run <probe-id> --no-summary` | Slice-5. Skip the per-batch summary artefact + investigator-log append. Useful when running probes in tight iterative loops. |
| `/probe-run <probe-id> --allow-stale` | Execute even if the probe's `verified_against_commit` lags the substrate by more than the staleness threshold (5 commits). The maintainer takes responsibility. |

### Slice-5 batch outputs

In batch mode (multiple probes, `--batch`, or `--feature`), the runner emits two additional artefacts on top of the per-probe `probe-runs/{date}-P-NNN.yaml` files:

1. **Per-batch summary** at `lineage/{repo}/probe-runs/{date}-batch-{trigger-slug}.md` — markdown table of per-run outcomes + per-feature aggregation (which test-classes per feature this batch empirically covered).

2. **Investigator-log append** — a new `## Probe-runs YYYY-MM-DD — <trigger>` section appended to `lineage/{repo}/investigator-log.md`, cross-referencing the per-batch summary. Per dynamic-verification ADR slice 5 ("each batch's investigator-log entry now carries a probe-runs section alongside reducer diffs"). Idempotent on (date, trigger) — re-running replaces the existing section in place.

## Protocol

### 1. Orient (read-only — no execution yet)

- Read `lineage/{repo}/manifest.yaml` → confirm `last_scan_commit`.
- Read the probe definition(s) at `lineage/{repo}/probes/{probe-id}.yaml`.
- Check `verified_against_commit` on each probe vs `last_scan_commit`. If lag > 5 commits and `--allow-stale` is not set, abort with `STALE_PROBE` and surface the offset.
- Verify Docker daemon is reachable: `docker ps` (zero-exit).
- Verify the runner is installed: `ls lineage/_extractor/probe-runtime/runner.py` (exists, executable).

### 2. Validate (per probe — also a no-execution gate)

Run `python3 lineage/_extractor/probe-runtime/runner.py <probe-id> --validate` for each selected probe. If validation fails on any probe, stop. Report which probes failed; do not proceed.

### 3. Execute (per probe — serial unless future --parallel)

Spawn the `probe-runner` subagent via the `Agent` tool with the probe ID(s) + maintainer options. The subagent does the actual `python3 runner.py <probe-id>` invocation, captures the runner's exit code + stdout, and emits the probe-run artefact.

For `--show` and `--validate` forms, no subagent spawn is needed — the skill directly invokes the runner with the appropriate flag.

### 4. Merge (unless --no-merge)

The runner appends a `## probe_verifications` entry to every contributing sidecar of the probe's `feature_id` (per dynamic-verification ADR Rule 4 — closes the layer-5 → layer-2 feedback loop). Idempotent on `probe_run_id` — re-runs of the same probe don't duplicate entries.

Future merges (slice-6 candidates, not yet automated):
- `lineage/{repo}/feature-flows.yaml` — `observed_vs_expected.observed` gains `measured (run-R-NNN at <iso>)`.
- `lineage/{repo}/test-map.yaml` — per-feature matrix cell flips to `PROBED-PASSING` / `PROBED-PINNING-BUG` / `PROBE-TEST-DISAGREEMENT`.

Currently the feature-flows + test-map merges are **manually authored** by the maintainer per slice convention; the sidecar merge runs automatically. The runner's slice-5 batch-summary artefact (`lineage/{repo}/probe-runs/{date}-batch-*.md`) supplies the consolidated view needed for manual feature-flows / test-map edits.

### 5. Cleanup verification

Run `docker ps --filter "name=probe-"` to confirm no leftover probe containers. If any remain, surface the manual cleanup command and ask the maintainer to confirm before re-running.

### 6. Report

Concise output:

- Counts: `<N> probes executed; <P> PASS, <F> FAIL, <E> ERROR, <T> TIMEOUT, <S> SCOPE_VIOLATION`
- Probe-run artefact paths
- Static-layer merges (which feature_id, which test_class cells flipped, how many sidecar confidence annotations)
- Top-1 headline finding (e.g. "P-002 PASS — anonymous detail-read under DISABLED inflates view_count by 10/10 calls — REFACTOR-073 confirmed at the empirical level")
- Cleanup status

## Rules

- **Local-only execution.** Per APPROACH.md section 5 rule 12 + dynamic-verification ADR Rule 1. No remote URLs in probe definitions; no remote services in the docker-compose stack profiles; nothing outside the maintainer's local docker daemon. The runner enforces ALLOWED_VERBS; the subagent enforces no-arbitrary-Bash; this skill enforces the prerequisite checks.
- **Probe versioning aligned to substrate.** `verified_against_commit` on every probe MUST equal (or lag by ≤5 commits) the substrate's `last_scan_commit`. Stale probes are refused unless `--allow-stale` is explicit.
- **Cleanup is mandatory.** Every probe-run terminates with the stack torn down (`docker-compose down -v`). If a run aborts before cleanup, the subagent emits a cleanup command for the maintainer to run.
- **No source-repo modification.** This skill (via the runner + subagent) never modifies files outside `lineage/{repo}/probe-runs/`, `lineage/{repo}/feature-flows.yaml`, `lineage/{repo}/test-map.yaml`, and per-sidecar confidence_per_field annotations under `lineage/{repo}/understanding/`. Substrate files (`manifest.yaml`, `nodes.jsonl`, `edges.jsonl`) and target-repo source files are never touched.

## Cross-references

- ADR anchor: `adrs/drafts/dynamic-verification-layer.md`
- Subagent: `.claude/agents/probe-runner.md`
- Runner: `lineage/_extractor/probe-runtime/runner.py`
- Stack profiles: `lineage/_extractor/probe-stacks/`
- First-experiment probes (slice 2): `lineage/odd-platform/probes/P-001.yaml`, `P-002.yaml`, `P-003.yaml`
- Trigger case-law: `retrospectives/LSN-017-per-node-scan-cannot-see-cross-layer-user-effects.md`
