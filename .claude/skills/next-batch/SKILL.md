---
name: next-batch
description: Autonomous batch driver for the rev-2 agentic-ontology sprint. Picks the next pending theme from state/sprint-themes.yaml, spawns 5 file-analyser subagents in parallel, then 5 reducers in parallel, merges deltas, refreshes coverage, appends the investigator-log entry, commits, pushes to remote, marks the theme done. Designed to be fired by `/loop` overnight without maintainer input.
allowed-tools: Read Write Edit Bash Glob Grep Agent
---

# /next-batch — autonomous rev-2 batch driver

This skill is the inner-body of the overnight autonomous loop. One invocation = one full batch end-to-end. `/loop 75m /next-batch` fires this every 75 minutes; each invocation runs to completion synchronously within a single agent turn.

## Path resolution (run BEFORE pre-flight)

The agent-prompt templates in this SKILL use `<WORKSPACE_ROOT>`, `<REPO_ROOT>`, and `<DOCS_REPO>` as placeholders so the SKILL does not embed any maintainer-specific absolute path. The orchestrator (you, the agent invoking the SKILL) MUST substitute them at runtime before passing prompts to subagents. Resolve them like this:

```bash
WORKSPACE_ROOT=$(git rev-parse --show-toplevel)     # current repo root
REPO_ROOT=$(realpath "$WORKSPACE_ROOT/../odd-platform")
DOCS_REPO=$(realpath "$WORKSPACE_ROOT/../documentation")
```

Substitute these into every Agent prompt below. Never hardcode an absolute path into a committed file (memory: `feedback_no_hardcoded_absolute_paths`).

## Pre-flight (FIRST 5 actions in order — abort if any fails)

0. **Resolve sprint branch.** Read `state/sprint-themes.yaml` and extract `policy.push_target_branch`. This is the long-lived sprint branch every batch commits to. Substitute `<SPRINT_BRANCH>` everywhere below with that value. If the key is absent or empty → ABORT with "sprint-themes.yaml policy.push_target_branch unset".

1. **Branch check.** `git rev-parse --abbrev-ref HEAD` must equal `<SPRINT_BRANCH>`. If it doesn't, ABORT — surface "wrong branch, halting loop" and exit. Never run on `main`.

2. **Clean-tree check.** `git status -s` should show no uncommitted unrelated changes. The only acceptable state is "clean working tree" OR pending changes confined to `lineage/` / `state/` / `.claude/` from a prior interrupted batch. If foreign changes exist, ABORT.

3. **Theme pick.** Read `state/sprint-themes.yaml`. Find the FIRST entry with `status: pending`. If none → exit cleanly with "no pending themes — autonomous loop completed all queued work" and SUGGEST to the maintainer that they extend the queue or stop the loop.

4. **Consecutive-failure halt.** Walk `batch_history` from the tail. If the last 3 entries all have `status: blocked` → ABORT with "3 consecutive failed batches, halting loop for maintainer review" and exit. Don't loop forever.

5. **Theme lock.** Edit `state/sprint-themes.yaml` — change the picked theme's `status` from `pending` to `in_progress` + add `started_at: <ISO timestamp>`. Stage + commit ONLY this file with message `[next-batch] theme {theme_id} in_progress`. Push. (This commit lets parallel sessions see the lock if you ever add parallelism later.)

## Phase 1 — 5 file-analyser subagents IN PARALLEL (foreground)

In ONE assistant message, fire 5 Agent tool calls with `subagent_type: file-analyser` and `run_in_background: false`. Each prompt follows this template (substitute per target_node from the picked theme):

```
You are the file-analyser subagent. Enrich ONE node end-to-end per your system prompt's non-negotiable rules. This is batch {THEME_ID} of the ODD agentic-ontology rev-2 sprint (autonomous overnight run on <SPRINT_BRANCH>).

WORKSPACE_ROOT_ABS: <WORKSPACE_ROOT>
REPO_ROOT_ABS: <REPO_ROOT>
SCHEMA: v0.3.0 (rev 2) — sidecar MUST include `upstream_callers` and `downstream_side_effects` blocks; every `uncovered_behaviour` needs `test_class`.

TARGET NODE
- node_id: {synthetic_node_id from theme entry}
- source file: {source_file from theme entry}
- output sidecar: <WORKSPACE_ROOT>/lineage/odd-platform/understanding/{slugified-node-id}.md

CONTEXT: Theme rationale: {rationale from theme entry}. Cross-reference existing sidecars where material (use Glob/Grep against lineage/odd-platform/understanding/). Live doc WebFetch on `docs.opendatadiscovery.org` for any doc-link claim; if WebFetch is denied this session, inherit verifications from neighbour sidecars at status 200 within the last 11 days per the stale-probe cadence (established pattern across batches D/E/F/G).

OUTPUT: reply with (1) `Wrote: <repo-relative path>` (2) `Summary: <N counts + headline finding>`.
```

The assistant turn BLOCKS until all 5 file-analysers complete (parallel-foreground). Expect 5-15 min wall-clock for the slowest.

Slug rule for the output filename: replace spaces and special chars with `__` between axis segments, single `_` within identifiers (mirroring the existing convention — see existing files in `lineage/odd-platform/understanding/` for shape).

**Failure handling.** If 1-2 of 5 file-analysers fail (timeout / error / refusal) → continue with the 3-4 that succeeded. If 3+ fail → mark the theme `blocked` (see Phase 4 failure path) and exit. Log per-agent outcomes in a per-batch `state/batch-{theme_id}-trace.yaml` file.

## Phase 2 — 5 reducers IN PARALLEL (foreground)

Verify all expected sidecar paths exist on disk before proceeding (Glob + ls). For any missing → log + continue with the present subset.

**Pre-step — warm the graph (rev 7.1).** Before spawning the reducers, run ONCE:
`lineage/_extractor/.venv/bin/lineage-extractor graph-build odd-platform`. This rebuilds the ephemeral graph + vector index from the canonical `detail/` files (cache-checked) so every reducer's dedup `graph-search` hits a current, warm index reflecting all *committed* prior findings — and the 5 reducers do not each cold-build in parallel. Per `adrs/drafts/agentic-graph-retriever.md`.

In ONE assistant message, fire 5 Agent tool calls IN PARALLEL with `run_in_background: false`. Each reducer dedups via **semantic `graph-search`** per `playbooks/registry-search-spawn.md` (rev 7.1 — superseding the registry-search grep). Subagent types:

- `concept-merger` — refresh `concepts/` from the new sidecars; dedup `graph-search --label Concept`.
- `adr-archaeologist` — refresh `implicit-adrs/` + `refactoring-scopes/`; dedup `graph-search --label ImplicitADR` / `--label RefactoringScope`. Write append-files (`*/index-batch-{theme_id}-append.md`) for index updates.
- `doc-gap-finder` — refresh `doc-gaps/`; dedup `graph-search --label DocGap`. WebFetch if available; otherwise inherit from neighbour sidecars per stale-probe cadence.
- `test-coverage-mapper` — refresh `test-map/`; dedup `graph-search --label TestGap`. Output a `test-map/index.delta.yaml` for the orchestrator to merge.
- `feature-flow-builder` — refresh `feature-flows/`; dedup `graph-search --label Feature`. Detail-file writes must use YAML-safe scalars: never emit a bare scalar containing `: ` or starting with `@` — use `|-` block scalar.

Per-agent prompts follow the same shape as batch H's reducer prompts (see `lineage/odd-platform/investigator-log.md` batch H entry for the canonical structure). The 5 new sidecar paths are the only sidecars to read in full; PROCESSED_NODE_IDS for the prior batches inherits from the existing index frontmatters.

The assistant turn BLOCKS until all 5 reducers complete. Expect 15-45 min for the slowest (typically concept-merger or adr-archaeologist).

**Failure handling.** If 1-2 reducers fail → still commit + push the partial state with those reducers' artefacts marked `stale_after_batch_{theme_id}` in the manifest. If 3+ reducers fail → mark theme `blocked` and exit.

## Phase 3 — YAML autofix + rebuild indexes + coverage + investigator-log + commit + push

Run these Bash commands in sequence:

1. **YAML safety pass first** — catches broken scalars before they pollute the indexes:
   ```bash
   python3 lineage/_extractor/registry-shard/yaml_safe_fix.py 2>&1 | tail -20
   ```
   Reports `fixed: N`, `unfixable: M`. The unfixable files are quarantined to `.broken-yaml-pending-fix` (data preserved in `.broken-yaml-backup`). If M > 0 — surface in investigator-log under "Follow-ups" but do NOT block the batch; the data is recoverable next batch when the reducer prompt's YAML-safe rule fires.

2. **Markdown-index appends** (if `index-batch-{theme_id}-append.md` files exist):
   ```bash
   for art in implicit-adrs refactoring-scopes; do
     append="lineage/odd-platform/${art}/index-batch-${THEME_ID}-append.md"
     if [ -f "$append" ]; then
       awk '/^-->/{flag=1;next} flag' "$append" >> "lineage/odd-platform/${art}/index.md"
       rm "$append"
     fi
   done
   ```
   Then update the frontmatter of each merged index.md per the append-file's HTML-comment instructions (counts + new batch summary key). Use Edit calls. **If the append file produces a known prose-only narrative without `## ID — headline` lines for the new entries**, the index integrity audit in step 3 surfaces a "detail without index" gap — that's acceptable for one batch (reducers grep detail/ directly), but flag for follow-up.

3. **Rebuild YAML indexes from detail/** (idempotent; replaces the brittle `merge_deltas.py` workflow):
   ```bash
   python3 lineage/_extractor/registry-shard/rebuild_indexes.py all 2>&1 | tail -25
   ```
   Detail files are the source of truth; this regenerates `concepts/index.yaml`, `test-map/index.yaml`, `feature-flows/index.yaml` from the parseable subset under `detail/`. Also runs `verify-md` for the three markdown artefacts and surfaces any detail-vs-index discrepancies (non-blocking).

3.5. **Coherence sweep (LSN-018 — pre-commit anomaly detector):**
   ```bash
   python3 lineage/_extractor/registry-shard/coherence_sweep.py --batch {THEME_ID} 2>&1 | tail -5
   ```
   Sweeps the new artefacts emitted this batch (and pre-existing ones) for cross-registry anchor overlaps where one side asserts a NEGATION about an entity another side positively names. Output: `state/coherence-sweep-batch-{THEME_ID}.md`. Empty → batch commits as usual. Non-empty top-tier (no-existing-back-link) candidates → READ the report, decide for each top candidate whether to: (a) supersede the older claim per Rule 6 of the reducer prompts, (b) accept the older claim and rewrite the new artefact, or (c) accept both as legitimately-different facts and add back-links. The sweep does not block the batch by itself — but each unresolved anomaly becomes a follow-up captured in the investigator-log "Follow-ups" section.

4. **Cleanup leftover delta files** (no longer needed after rebuild):
   ```bash
   find lineage/odd-platform -name 'index.delta.yaml' -delete
   find lineage/odd-platform -name 'concepts.delta.batch-*.yaml' -delete
   ```

5. **Refresh coverage:**
   ```bash
   python3 lineage/_extractor/registry-shard/coverage.py --write-manifest
   ```

6. **Append investigator-log entry.** Construct a multi-section batch entry (sidecars added, reducer diffs, cumulative state, next-batch notes if any). Pattern: read batch H's + batch I's investigator-log entries as template. Use `cat >> investigator-log.md << HEREDOC`. **Always include** a "Follow-ups" section listing any `.broken-yaml-pending-fix` files this batch produced + any markdown-index detail-without-index discrepancies.

7. **Stage + commit + push:**
   ```bash
   git add lineage/odd-platform/understanding/{new-sidecars-glob} \
           lineage/odd-platform/{concepts,implicit-adrs,refactoring-scopes,doc-gaps,test-map,feature-flows}/ \
           lineage/odd-platform/manifest.yaml \
           lineage/odd-platform/investigator-log.md \
           state/sprint-themes.yaml \
           state/batch-{THEME_ID}-trace.yaml
   git commit -m "batch {THEME_ID} (autonomous) — {THEME_NAME}; coverage {direct%} direct / {effective%} effective"
   git push origin <SPRINT_BRANCH>
   ```

   If push fails (non-fast-forward — unlikely in single-session mode):
   ```bash
   git pull --rebase origin <SPRINT_BRANCH>
   git push origin <SPRINT_BRANCH>
   ```
   If push still fails → mark theme `blocked` with `blocked_reason: push-conflict-after-rebase` and exit.

8. **Preserve `.broken-yaml-pending-fix` files** (if any) in a follow-up commit so they reach the remote:
   ```bash
   if ls lineage/odd-platform/**/*.broken-yaml-pending-fix 2>/dev/null | grep -q .; then
     git add lineage/odd-platform/**/*.broken-yaml-pending-fix lineage/odd-platform/**/*.broken-yaml-backup 2>/dev/null
     git commit -m "[next-batch] theme {THEME_ID} — preserve broken-yaml-pending-fix files for next-batch recovery"
     git push origin <SPRINT_BRANCH>
   fi
   ```
   No force-push needed — this is a fresh commit appended to the sprint branch.

## Phase 4 — Mark theme done (success path)

Edit `state/sprint-themes.yaml`:
- Change the picked theme's `status` from `in_progress` to `done`
- Add `completed_at: <ISO>`
- Append to top-level `batch_history`: `{batch_id: {THEME_ID}, status: done, completed_at: ..., sidecars_added: <N>, delta_summary: "..."}`

Commit + push this single-file change with message `[next-batch] theme {theme_id} done`.

## Phase 4 (failure path) — Mark theme blocked

If at any point a non-recoverable failure occurred (≥3 file-analysers failed, ≥3 reducers failed, or push hard-failed):
- Edit `state/sprint-themes.yaml` — change `status` to `blocked`, add `blocked_at` + `blocked_reason: "<one-line>"`.
- Commit + push: `[next-batch] theme {theme_id} blocked — {short-reason}`.
- Exit (do NOT halt the loop unless 3 consecutive blocks).

## Exit message format

Reply with EXACTLY ONE of these formats (the loop driver's status surface):

- Success: `BATCH {THEME_ID} DONE — sidecars +{N}, direct {direct%}, effective {effective%}, features {total_features} ({new_features_count} new), {total_test_gaps} test-gaps ({critical_count} CRITICAL).`
- Blocked: `BATCH {THEME_ID} BLOCKED — {blocked_reason}. Loop continues; mark for maintainer review.`
- Halt: `LOOP HALTING — {reason}. {THEME_ID or N/A} state preserved; resume manually after investigation.`
- Queue empty: `QUEUE EMPTY — all themes done or blocked. Loop has nothing further; safe to stop.`

## Safety rails (universal)

- NEVER run `git push --force`, `git reset --hard`, `git checkout main`, `rm -rf`, `git branch -D` autonomously.
- NEVER write to source repos at `<REPO_ROOT>`, `<DOCS_REPO>`, etc. — these are READ-ONLY from this skill's perspective. Only the workspace at `<WORKSPACE_ROOT>` is writeable.
- NEVER edit `adrs/drafts/*` — those are maintainer-authored design docs.
- NEVER edit `CLAUDE.md` — it is the governance surface; the maintainer hand-authors changes.
- `APPROACH.md` is the deliverable — update it when methodology insights land (new failure modes, new rules, new layers, new probe classes, new bootstrapping signals). Do NOT rewrite the methodology unilaterally; do NOT delete sections; preserve revision history. Substantive additions land alongside an LSN entry that triggered them.
- If a tool call hits a permission prompt → that's a settings.local.json gap; halt the loop (don't try to bypass).

## Resumption after a halt

When the maintainer resumes after a halt:
1. Read `state/sprint-themes.yaml` to see the last-attempted theme + its status.
2. Read `state/batch-{theme_id}-trace.yaml` (if present) for the per-agent outcomes.
3. Manually fix the root cause (broken sidecar, conflicted yaml, etc.).
4. Either reset the theme to `pending` (retry) or leave as `blocked` and skip to the next.
5. Resume `/loop 75m /next-batch`.

## Cross-references

- `adrs/drafts/feature-anchored-ontology.md` rev 2 — the methodology this skill implements at scale.
- `state/sprint-themes.yaml` — the priority queue this skill consumes.
- `lineage/_extractor/registry-shard/shard.py` — canonical sidecar/index shapes.
- `lineage/_extractor/registry-shard/coverage.py` — coverage refresh.
- `lineage/_extractor/registry-shard/merge_deltas.py` — uniform delta-merge helper (referenced from this skill; created by slice-9 follow-up).
- `lineage/odd-platform/investigator-log.md` (batch H entry) — template for the per-batch log entry this skill appends.
- `.claude/agents/file-analyser.md`, `.claude/agents/{concept-merger,adr-archaeologist,doc-gap-finder,test-coverage-mapper,feature-flow-builder}.md` — the subagent contracts.
- `playbooks/registry-search-spawn.md` — the dedup protocol the reducers follow.
