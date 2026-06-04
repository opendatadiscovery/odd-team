---
name: reflect-feature
description: Run the feature-reflector subagent (Layer 4b — top-down product-owner reflection) over one composed feature flow. Produces `lineage/{repo}/feature-reflections/detail/{F-NNN}.yaml` with a stepped-back product-owner narrative + 5-15 falsifiable user-facing hypotheses + per-hypothesis verdicts (confirmed / contradicted / partial / probe-needed) traced through the implementation chain. Contradictions are surfaced as bug-candidate / caveat-candidate findings — cross-file intent-vs-implementation drifts no single sidecar can see in isolation. Per APPROACH.md section 15 + rev-5 LSN-020 case-law.
argument-hint: <F-NNN> [--repo <repo>] | --list [<repo>] | --show <F-NNN> [--repo <repo>]
allowed-tools: Read Grep Glob Bash(date *) Bash(ls *)
---

# /reflect-feature — top-down product-owner reflection (Layer 4b, rev 5)

Layer 4b of the agentic-code-ontology pipeline. Where `feature-flow-builder` (Layer 4a) composes the chain bottom-up from sidecar `upstream_callers` + `downstream_side_effects`, this skill spawns the **`feature-reflector`** subagent to run the complementary **top-down pass**: step back from the assembled chain, look at the feature as a product owner, generate falsifiable user-facing hypotheses, and validate each by tracing the implementation chain.

The reflection answers: *"this feature is named X, it takes these inputs, it returns these outputs, it dispatches across these view modes — what would a user expect each of those parts to do, and does the implementation deliver it?"*. Contradictions become the highest-priority bug-candidate or caveat-candidate findings; probe-needed verdicts emit probe-skeletons; doc-claim-vs-code mismatches surface as DOC-GAP candidates.

The canonical catch (LSN-020): Activity Feed's `userIds` query parameter promises filtering by which-user-performed-the-action; the implementation filters by `USER_OWNER_MAPPING.OWNER_ID.in(userIds)`. A `userIds=[42]` hypothesis traced through the chain surfaces the contradiction: users without owner mappings vanish from the filter; owner-user association changes retroactively rewrite past attribution; the actual actor column (`activity.created_by`) is JOINED but never FILTERED.

## Argument forms

| Form | Behaviour |
|---|---|
| `/reflect-feature <F-NNN> [--repo <repo>]` | Default. Spawn feature-reflector on the named feature flow. Produces `lineage/{repo}/feature-reflections/detail/{F-NNN}.yaml`. Repo defaults to `odd-platform`. |
| `/reflect-feature` (no args) | Prompt for the feature_id via `AskUserQuestion`, then proceed as above. |
| `/reflect-feature --show <F-NNN> [--repo <repo>]` | Read-only. Print an existing reflection. |
| `/reflect-feature --list [<repo>]` | Read-only. List all reflections for the repo with `feature_id`, `feature_name`, `hypotheses_total`, `contradictions`, `reflected_at`. |

## Prerequisites

- `lineage/{repo}/feature-flows/detail/{F-NNN}.yaml` exists (i.e. `feature-flow-builder` has composed this feature; if not, run `/next-batch` or the equivalent batch driver first).
- `lineage/{repo}/system-mission.md` exists (i.e. `domain-extractor` Layer-0 pass has run).
- `lineage/{repo}/concepts.yaml` exists (i.e. `/concepts` has been run).
- At least one contributing sidecar for the feature exists at `lineage/{repo}/understanding/`.

If any prerequisite is missing, the skill aborts with the specific missing artefact + the command to produce it.

## Protocol

### 1. Orient (skip if loaded this session)

- `CLAUDE.md` — workspace quality bar
- `APPROACH.md` section 15 — top-down reflection design rationale
- `.claude/agents/feature-reflector.md` — the subagent system prompt + output schema

### 2. Resolve the feature_id

If the maintainer passed the feature_id as the first argument, use it verbatim. If no argument was passed, use `AskUserQuestion`:

> 1. "Which feature do you want to reflect on? Pass the `F-NNN` id (e.g. `F-021` for Activity Feed). The agent reads the feature flow + contributing sidecars + system-mission.md + concepts.yaml + live docs (as cross-reference), writes a product-owner narrative, generates 5-15 falsifiable user-facing hypotheses, and validates each by tracing the implementation chain."

### 3. Resolve inputs

Derive these (the skill does this; the agent receives them as inputs):

- **REPO**: from `--repo` flag or default `odd-platform`.
- **FEATURE_ID**: the resolved id (e.g. `F-021`).
- **WORKSPACE_ROOT_ABS**: `pwd`.
- **LINEAGE_DIR_ABS**: `<workspace>/lineage/{repo}`.
- **REPO_ROOT_ABS**: `<workspace>/../{repo}` (the target repo — for the rare Rule-8-exception Read).
- **FEATURE_FLOW_DETAIL_PATH**: `lineage/{repo}/feature-flows/detail/{F-NNN}.yaml`. Confirm exists; otherwise abort with "feature flow not found — run the batch driver to produce it".
- **SYSTEM_MISSION_PATH**: `lineage/{repo}/system-mission.md`. Confirm exists; otherwise abort with "Layer 0 not initialised — run `domain-extractor` first".
- **CONCEPTS_YAML_PATH**: `lineage/{repo}/concepts.yaml`. Confirm exists; otherwise abort with "no concepts — run `/concepts` first".
- **EXISTING_REFLECTION**: read `lineage/{repo}/feature-reflections/detail/{F-NNN}.yaml` if present; pass verbatim so the agent preserves `maintainer_curated: true` hypotheses.
- **TARGET_PATH**: `lineage/{repo}/feature-reflections/detail/{F-NNN}.yaml`.
- **INDEX_PATH**: RETIRED (2026-06-04 directive). No index file is written — navigation is the derived graph + the graph-retriever; the detail file is embedded on the next `graph-build`. Do not pass INDEX_PATH.

If the `feature-reflections/` directory does not exist, the agent's Write will create it (Write tool creates parent dirs).

### 4. Spawn the feature-reflector subagent

Invoke via `Agent` tool with `subagent_type: feature-reflector`. Construct the prompt:

```
FEATURE_ID: <id>
REPO: <repo>
WORKSPACE_ROOT_ABS: <abs>
LINEAGE_DIR_ABS: <abs>
REPO_ROOT_ABS: <abs>
FEATURE_FLOW_DETAIL_PATH: <relative>
SYSTEM_MISSION_PATH: <relative>
CONCEPTS_YAML_PATH: <relative>
EXISTING_REFLECTION: <verbatim YAML if present, OR "none">
TARGET_PATH: <relative>
```

The subagent reads the inputs, runs the 8-step workflow defined in its system prompt, writes the reflection detail (the SOLE artefact — no index file; see its Rule 5) + the feature-flow `use_cases` promise layer, and replies with two lines (Wrote: + Reflection summary).

### 5. Parse the reply + surface the headline

Read the subagent's reply. Surface the second line to the maintainer with:
- The contradiction count (the bug-candidates surfaced)
- The **net-new vs already-tracked split**. The agent dedups each bug/caveat candidate against `issues/` + `backlog/` at emission (`dedup_status` per candidate, `feature-reflector/0.2.0`). Surface "N net-new / M corroborated" so the maintainer triages only the net-new ones and reads the corroborations as convergent validation (two independent methods agreeing — high confidence; cross-link, don't re-file).
- The probe-emitted count (the runtime questions the reflection raised)
- The highest-severity contradiction's one-line summary (so the maintainer immediately sees the headline finding)
- The path to the reflection detail file

If the reflection contains `contradictions >= 1 with severity HIGH` tagged `dedup_status: net_new`, add a one-line followup recommendation: "Triage the NET-NEW HIGH contradictions; each is a candidate bug-fix or operator-facing caveat to log via `/log-issue` (upstream) or as a backlog item (in-repo). Already-tracked ones are convergent confirmation of existing items — cross-link, don't re-file."

### 6. Exit

The skill produces NO artefact of its own (the agent does). Just surface the reflection's path + headline.

## Failure modes to surface explicitly

- **Feature flow not yet composed**: abort with "feature flow not found at <path> — run feature-flow-builder to produce it".
- **Layer 0 missing**: abort with "system-mission.md not found — run `domain-extractor` first; reflection cannot proceed without the pillar shape".
- **Concepts.yaml missing**: abort with "no concepts catalog — run `/concepts` first".
- **Zero contributing sidecars enriched**: abort with "feature flow has no enriched contributing sidecars — run `/enrich` on the contributing nodes first".
- **Agent reply does not parse**: surface verbatim to the maintainer with "reflection agent reply did not match expected shape; inspect manually".

## Cross-references

- `APPROACH.md` section 15 — Top-down product-owner reflection (Layer 4b, rev 5).
- `.claude/agents/feature-reflector.md` — the subagent's system prompt.
- `retrospectives/LSN-020-activity-userids-filter-binds-to-owner-id-no-top-down-reflection.md` — the case-law that motivated this skill.
- `lineage/{repo}/feature-reflections/detail/{F-NNN}.yaml` — the canonical output path.
- (`feature-reflections/index.yaml` is RETIRED — navigation is the derived graph + the graph-retriever; refresh with `graph-build {repo}`. See ADR-0077.)
- `.claude/skills/code-walk/SKILL.md` — the closest sibling skill (feature-advisor query-time, vs feature-reflector refresh-time).
