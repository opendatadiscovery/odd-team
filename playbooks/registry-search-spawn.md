---
trigger: any reducer subagent (concept-merger / adr-archaeologist / doc-gap-finder / test-coverage-mapper / feature-flow-builder) is about to commit a fresh finding from a new sidecar; needs to know whether the finding should strengthen an existing entry or mint a new ID
applies_to: cross-pillar — universal to the agentic-code-ontology layer (rev 2 slice 7)
goal: cut per-batch reducer-context tokens from 200-800 KB of monolithic prior-artefact reads to ~50-150 KB by routing dedup through the registry-search subagent
case_law: 2026-05-12 batch F test-coverage-mapper stream-idle timeout; 2026-05-12 batches B/E rate-limit hits — all caused by reducers loading the full monolith every batch. Rev 2 introduces this protocol as the structural fix.
---

# Registry-search spawn — PROTOCOL (rev 2)

## When to fire

Every time one of the 5 reducer subagents (`concept-merger`, `adr-archaeologist`, `doc-gap-finder`, `test-coverage-mapper`, `feature-flow-builder`) is about to commit a fresh finding from a new sidecar. The reducer fires this protocol BEFORE writing to the sharded registry (`{artefact}/index.{md|yaml}` + `{artefact}/detail/{id}.{md|yaml}`).

Skipped (falls back to "always mint new") only when:

- The sharded index file does not yet exist (first batch after a fresh shard — happens once per repo per artefact).
- The reducer's `prompt_version` has bumped MAJOR and the registry shape is incompatible.
- The maintainer passes `--no-dedup` (debug-only override).

## Inputs the reducer prepares

For each fresh finding it is about to commit, the reducer gathers:

```
QUERY_TEXT: |
  <the verbatim discriminating sidecar field — e.g. the full
   `bugs_limitations_corner_cases[N]` entry, or `implicit_adrs[N]` line,
   or `tests_coverage_semantic.uncovered_behaviours[N]`, etc.>
  Source sidecar: {slug}.md
  Source field path: bugs_limitations_corner_cases.[N]
  Cross-references in source: [REFACTOR-NNN, TEST-GAP-NNN, DOC-GAP-NNN, ...]
  Node anchor: {node_id} ({file}:{line})

INDEX_PATH: <absolute path to the target artefact's sharded index>
ARTEFACT_KIND: <concepts | implicit-adrs | refactoring-scopes | doc-gaps | test-map>
MAX_CANDIDATES: 5     # default; can be increased to 10 for cross-cutting categories
```

The reducer's orchestrator passes these in the Task tool's prompt to the `registry-search` subagent.

## Reducer's decision tree on the subagent's output

The subagent returns a YAML block of candidates + a `verdict:` line. The reducer acts on the verdict:

| Verdict | Reducer's next move |
|---|---|
| `verdict: 0 matches — create new` | Mint NEXT_AVAILABLE_ID + 1. Write `{artefact}/detail/{NEW_ID}.{md|yaml}` with the full new entry. Append a multi-paragraph headline to `{artefact}/index.{md|yaml}` (use the same headline shape as the existing entries — see `lineage/_extractor/registry-shard/shard.py`'s `_index_headline_*` functions for the canonical format). Record `surfaced_by: [{slug}.md:{field-path}]` in the new entry. |
| `verdict: 1 strong match — strengthen {ID}` | Read `{artefact}/detail/{ID}.{md|yaml}`. Append to it: the new sidecar slug to `surfaced_by`, any new file:line evidence to the evidence block, any refinement narrative under a `STRENGTHENS — {new_sidecar} (batch {batch_id})` heading. Do NOT rewrite existing prose. Update the headline in `{artefact}/index.{md|yaml}` ONLY if the new evidence changes severity / classification / category — otherwise leave the headline untouched (the detail file carries the strengthen). |
| `verdict: N candidates — maintainer-triage-ambiguous` | Mint NEXT_AVAILABLE_ID + 1 as if creating new, BUT add `maintainer_triage_pending: true` to the new entry's frontmatter + a top-of-entry block: `## Maintainer triage pending\n\nregistry-search surfaced {N} ambiguous candidates: {ID1}, {ID2}, ... — please confirm whether to merge or keep separate.`. Surface the ambiguity in the batch's investigator-log entry (`lineage/{repo}/investigator-log.md`'s next batch block) so the maintainer triages explicitly during the per-batch review pass. |

The reducer NEVER auto-merges across HIGH-confidence candidates. Per rev-2 risk mitigation (`adrs/drafts/feature-anchored-ontology.md` "Emergent-feature registry never converges" row), merges are maintainer-triggered.

## Why this is mechanical, not heuristic

- The reducer's decision is determined by the subagent's verdict line.
- The subagent's verdict is determined by textual overlap (file:line anchors, distinctive phrases, cross-reference IDs).
- The reducer's write back to the sharded registry is shape-bound by the index headline format established at shard time.

The judgment surface the reducer keeps: the QUERY_TEXT choice (which sidecar field to dedup against — typically the most discriminating one). All else is rails.

## Exit criteria per finding

- Either a new detail file landed at `{artefact}/detail/{NEW_ID}.{md|yaml}` + an index headline appended, OR
- An existing detail file gained a STRENGTHENS block, OR
- A new detail file landed with `maintainer_triage_pending: true` and the ambiguity is surfaced in the batch's investigator-log entry.

In all three cases: the reducer's context per finding is bounded by the subagent's response size (~5-20 KB) + the detail-file read (when strengthening; ~3-30 KB) — NOT by the full registry size.

## Per-batch aggregated invariants

After processing all findings in a batch:

- `{artefact}/index` is consistent: every detail file has an index entry; every index entry has a detail file.
- `processed_sidecars:` block at the head of the index (rev 2 carries this forward from rev 1's monolith) lists every sidecar that contributed this batch.
- The batch's investigator-log entry records: per-reducer findings-count + new-entry-count + strengthen-count + ambiguous-count.

## Fail-modes

- **registry-search returns a malformed YAML block** → reducer treats as `verdict: 0 matches — create new` and logs a quality warning. The maintainer sees the warning in the next investigator-log entry and re-runs the offending finding manually.
- **Mint-new collides with an existing ID** (the prior NEXT_AVAILABLE_ID was wrong — likely a hand-edit drift) → reducer aborts the finding, escalates with the existing detail file's content + the new one's content side-by-side, asks the maintainer to triage. Do not silently overwrite.
- **detail file the verdict points to does not exist** (the index entry references a detail that was deleted out-of-band) → reducer treats as `verdict: 0 matches — create new` AND logs `registry_inconsistency: true` in the batch's investigator-log entry. The maintainer re-runs `shard.py` to re-sync.

## Cross-references

- `adrs/drafts/feature-anchored-ontology.md` rev 2 — principle 6 (sharding) + principle 7 (registry-search subagent) + slice 7 (this protocol's host slice).
- `.claude/agents/registry-search.md` — the subagent's system prompt (what it reads, what it returns, the safety rules).
- `.claude/agents/{concept-merger,adr-archaeologist,doc-gap-finder,test-coverage-mapper,feature-flow-builder}.md` — the 5 reducer prompts that call this playbook.
- `lineage/_extractor/registry-shard/shard.py` — the conversion script + canonical headline-shape functions.
- `playbooks/reducer-incremental-mode.md` — the rev-1 playbook this rev-2 protocol succeeds (rev-1's compact-head approach is OBSOLETE under rev 2; this playbook replaces it).
