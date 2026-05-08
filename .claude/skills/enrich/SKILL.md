---
name: enrich
description: Run the file-analyser subagent against one or more substrate nodes to produce per-node semantic enrichment sidecars. Resolves a path / node-id / batch spec to substrate nodes; spawns file-analyser per node; validates the resulting sidecar against the schema; updates the manifest's `enrichment` block.
argument-hint: <path> | --node <node-id> | --touched | --batch <axis> [--max-nodes N]
allowed-tools: Read Grep Glob Bash(ls *) Bash(find *) Bash(jq *) Bash(git *) WebFetch
---

# Enrich an ontology node (DOC-164 slice 5+)

Drive the agentic-code-ontology pipeline for one or more substrate nodes. Each invocation produces (or refreshes) Markdown sidecars at `lineage/{repo}/understanding/{slug}.md`, written by the `file-analyser` subagent with the live-URL-only doc rule and Gate 9 code-anchor mandate.

This skill is the maintainer-facing entry point for the per-node enrichment layer per `adrs/drafts/agentic-code-ontology.md` revision 2.

## Prerequisite

The substrate scaffold (DOC-164 slices 1-4) must have run against the target repo. `lineage/{repo}/nodes.jsonl` must exist. If it doesn't, run `/scan scanners/code-lineage/{axis}.md` first or invoke the substrate's `lineage-extractor scan {repo} --full`.

## Argument forms

| Form | Behaviour |
|---|---|
| `/enrich <path>` | Single-file enrichment. Resolves `<path>` (relative to a repo) to its substrate node(s) and enriches each. If the path matches multiple nodes (e.g. a controller file with multiple methods), enrich the file-level node first, then the maintainer can drill into method nodes via `/enrich --node <id>`. |
| `/enrich --node <node-id>` | Single-node enrichment by node ID (verbatim from `nodes.jsonl`'s `id` field). |
| `/enrich --touched` | Per-PR incremental. Reads `lineage/{repo}/manifest.yaml`'s `enrichment.last_enriched_commit`; computes `git diff` against repo HEAD; enriches every node whose source file appears in the diff (1-hop fanout NOT YET — slice 5 is single-file granularity). |
| `/enrich --batch <axis>` | Backfill mode. Picks the next N (default 5) unenriched-or-stale nodes from a given axis (`ui_shell`, `ui_routes`, `controllers`, `openapi_tags`, `config_prefixes`). Useful for working through the backlog one axis at a time. |
| `/enrich --max-nodes N` | Cap how many enrichments this session runs. Default 5 (fits comfortably in a session's context budget; tune empirically). Caps any of the above forms. |

## Protocol

### 1. Orient

Read these (skip if already loaded this session):

- `CLAUDE.md` — the workspace's quality bar
- `adrs/drafts/agentic-code-ontology.md` — the layered ADR + the per-node sidecar schema
- `.claude/agents/file-analyser.md` — the subagent system prompt you'll invoke (so you know what input shape it expects)

### 2. Resolve the worklist

Build a list of `(node_id, path, kind, axis)` tuples for this invocation:

- For `<path>` form: `jq -c 'select(.path == "<path>" or (.path | startswith("<path>:")))'  lineage/{repo}/nodes.jsonl`. Pick the file-level match first; if multiple symbol-level nodes also match, list them but don't enrich them this invocation (one node at a time).
- For `--node <id>`: `jq -c 'select(.id == "<id>")' lineage/{repo}/nodes.jsonl`. Exactly one match expected; error if 0 or >1.
- For `--touched`: read `lineage/{repo}/manifest.yaml`'s `enrichment.last_enriched_commit` (or `last_scan_commit` if no enrichment block yet). `git -C ../{repo} diff --name-only <commit>..HEAD` → list of touched files. For each touched file, `jq` for nodes whose `path` starts with that file. Cap at `--max-nodes`.
- For `--batch <axis>`: `jq -c 'select(.axis == "<axis>")' lineage/{repo}/nodes.jsonl` → all nodes; filter out those with an existing `lineage/{repo}/understanding/{slug}.md` whose `enriched_at_commit` matches current HEAD; pick the first `--max-nodes`.

If the worklist is empty, report "Nothing to enrich (all nodes current)" and exit.

### 3. Resolve the sidecar slug for each node

Slug rule (matches the ADR): `node_id.replace(' ', '__').replace('/', '_').replace(':', '__').replace('.', '_')`. Filesystem-safe, reversible, greppable.

Sidecar path: `lineage/{repo}/understanding/{slug}.md`.

### 4. Resolve scaffold edges per node (1-hop)

For each node in the worklist, read `lineage/{repo}/edges.jsonl` and collect:

- `imports`: edges where this node is `src` and type=`imports`
- `imported-by`: edges where this node is `dst` and type=`imports`
- `exposes`: src→dst with type=`exposes`
- `configures`: src→dst with type=`configures`
- `mounts`: src→dst with type=`mounts`

This goes into the file-analyser's prompt as `SCAFFOLD_EDGES`.

### 4.5. Cache check (slice 6+)

Before spawning `file-analyser` for a node, check whether the sidecar is already current:

- If `lineage/{repo}/understanding/{slug}.md` does NOT exist → CACHE MISS, proceed to spawn.
- If the sidecar exists, parse its frontmatter:
  - `enriched_at_commit` — substrate commit at which the sidecar was authored
  - `prompt_version` — the file-analyser prompt version that authored it
  - (planned: `extracted_at_commit`, `model`, `scaffold_hash` for finer cache keys)
- Compare to the current substrate state (manifest's `last_scan_commit`) AND the current file-analyser prompt version (read the frontmatter of `.claude/agents/file-analyser.md` — typically `file-analyser/0.1.0` for slice 5/6).
- **Skip the spawn IF:**
  - `enriched_at_commit == last_scan_commit` (substrate hasn't moved)
  - `prompt_version == current file-analyser version` (prompt unchanged)
  - The node's source file hasn't changed since `enriched_at_commit` (use `git -C ../{repo} log --oneline <enriched_at_commit>..HEAD -- <source_path>` — empty output = unchanged)
- **Force re-enrichment** when the maintainer passes `--no-cache` or `--force`. Default is cache-on; this is the cheap/fast path.

Cache hits are reported as `<node-id>: cached (no change since <commit>)`. Cache misses fall through to the spawn step.

The cache invariant per the ADR: an enrichment is reused iff `(node_id, scaffold_hash_of_file, prompt_version, model)` matches. MVP slice-6 collapses this to `(node_id, source_unchanged_since_enriched_at_commit, prompt_version)` — the source-unchanged check is a proxy for `scaffold_hash`. Future slices may add explicit content-hash keys if false-cache-misses surface.

### 5. Spawn the file-analyser per cache-missed node

Invoke the `file-analyser` subagent via the `Agent` tool, one node at a time (parallel-spawn is fine for independent nodes — they don't share state). Construct the prompt as:

```
NODE_ID: <id>
NODE_KIND: <kind>
AXIS: <axis>
PATH: <path>
REPO: <repo>
REPO_ROOT_ABS: <absolute, e.g. /home/.../work/odd/{repo}>
SCAFFOLD_EDGES:
  imports: [...]
  imported-by: [...]
  exposes: [...]
  configures: [...]
  mounts: [...]
NODE_METADATA: <verbatim from nodes.jsonl's metadata block>
SIDECAR_TARGET: <absolute path>
WORKSPACE_ROOT_ABS: <absolute, e.g. /home/.../work/odd/odd-team>
EXISTING_SIDECAR: <if a sidecar exists, the verbatim content; else "(none)">
```

The subagent's tool surface is fixed by the `.claude/agents/file-analyser.md` frontmatter (`Read, Grep, Glob, WebFetch, Write`). It writes the sidecar via `Write` to `SIDECAR_TARGET` and replies with `Wrote: <path>` + `Confidence: ...`.

### 6. Validate the resulting sidecar

For each sidecar produced:

- Run the validator: `python -m lineage_extractor.cli validate-sidecar <sidecar-path>` (Bash). The validator parses YAML frontmatter + named Markdown sections and verifies required fields are present.
- If validation fails, log the failure to `lineage/{repo}/enrichment.log` and surface to the maintainer. Do NOT auto-retry in slice 5 — single-shot per invocation; the maintainer iterates the prompt if quality is wrong.

### 7. Update the manifest

After all nodes in the worklist complete (success or failure):

- Read `lineage/{repo}/manifest.yaml`.
- Add or update the `enrichment` block:
  - `schema_version: 0.1.0`
  - `subagent_versions.file-analyser: file-analyser/0.1.0`
  - `last_enriched_commit: <repo's HEAD commit>` (only advance if every node in the worklist succeeded)
  - `enriched_node_count: <count of unique sidecars under understanding/>`
  - `total_node_count: <count of unique node IDs in nodes.jsonl>`
  - `enrichment_coverage: <pct>`
  - `last_session_id: <Claude Code session id, if available; else timestamp>`
- Append to `lineage/{repo}/enrichment.log`: one line per node — `<timestamp>\t<session_id>\t<node_id>\t<sidecar_path>\t<confidence>\t<doc_urls_fetched>`.

### 8. Report

Concise output:

- Worklist size: N
- Successful enrichments: M
- Failed enrichments: K (list them with the validator's reason)
- Coverage now: X% (Y/Z nodes)
- Suggested next: `/enrich --batch <axis>` for the next N unenriched nodes, or `/enrich <specific-path>` for ad-hoc work.

## Rules

- **Live-URL-only doc rule is non-negotiable.** If a sidecar has a `documents.declared_docs` entry without `last_verified_status`, validation fails. The file-analyser prompt enforces this; the validator double-checks.
- **One sidecar per node.** Don't enrich neighbour nodes in the same invocation — they get their own `/enrich` call when the maintainer chooses.
- **Don't auto-fix the source code.** The file-analyser's tool surface excludes `Edit`. If enrichment surfaces a bug, log it as a backlog item via `playbooks/follow-up-on-disk.md`; don't patch the code.
- **Preserve `## Maintainer notes`.** If a sidecar already exists, pass its content as `EXISTING_SIDECAR` so the file-analyser preserves the maintainer notes block.
- **Skip auto-advance if any node failed.** `last_enriched_commit` only advances when every node in the worklist passed validation. Partial success leaves the mark where it was.
- **Cap at `--max-nodes`.** Token budget per session is the constraint. Default 5; the maintainer can raise if files are small.

## Failure modes to surface (not auto-fix)

- Validator rejects sidecar (missing required field, fabricated file:line, banned phrase) → log + report; maintainer iterates the prompt.
- WebFetch fails (404 doc URL) → the sidecar records `last_verified_status: 404`; the doc-gap-finder reducer (slice 7) will surface these as DOC-NNN candidates.
- Source file hash differs from substrate's `nodes.jsonl` (substrate is stale relative to current HEAD) → report; recommend `lineage-extractor scan {repo} --full` first.

## Cross-references

- Subagent: `.claude/agents/file-analyser.md`
- Validator: `lineage/_extractor/src/lineage_extractor/validators.py`
- ADR: `adrs/drafts/agentic-code-ontology.md` revision 2
- Substrate ADR: `adrs/drafts/code-lineage-substrate.md` revision 2
- Probe set: `lineage/PROBES.md` (extended for semantic claims per `adrs/drafts/research/agentic-code-ontology/PROBES.md`)