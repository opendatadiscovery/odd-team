---
trigger: any reducer subagent (concept-merger / adr-archaeologist / doc-gap-finder / test-coverage-mapper / feature-flow-builder) is about to commit a fresh finding from a new sidecar; needs to know whether the finding should strengthen an existing entry or mint a new ID
applies_to: cross-pillar — universal to the agentic-code-ontology layer (rev 7.1 — the agentic-retriever cutover)
goal: dedup a fresh finding against the existing registry by SEMANTIC similarity over the derived graph query layer, not by textual grep — catches a duplicate phrased in different vocabulary, which the grep-based registry-search missed
case_law: 2026-05-12 batches B/E/F reducer monolith-load timeouts (the rev-2 sharding fix); graph-query-layer.md PROBES failure-pressure #3 — "synonym blindness: grep over sharded indexes misses a finding phrased with different vocabulary" — the gap this rev-7.1 protocol closes
supersedes: the rev-2 "spawn the registry-search subagent" mechanism. The filename is kept (`registry-search-spawn.md`) for reference stability across the 5 reducer prompts; the PROTOCOL below is the rev-7.1 semantic-dedup flow.
---

# Semantic dedup — PROTOCOL (rev 7.1)

A reducer, before committing a fresh finding, must decide: **strengthen an existing
registry entry, or mint a new ID?** Through rev 2-7 that decision was fed by the
`registry-search` subagent — a grep over the sharded `index.{md,yaml}` files.
Grep matches *vocabulary*; it misses a duplicate finding phrased in different
words. Rev 7.1 routes the decision through the **derived graph query layer**
(`adrs/drafts/agentic-graph-retriever.md`): a `graph-search` is a vector
similarity query — it matches *meaning*. This is the registry-search → agentic
retriever cutover for the reducer-dedup consumer.

## When to fire

Every time one of the 5 reducer subagents is about to commit a fresh finding from
a new sidecar — BEFORE writing the finding's `{artefact}/detail/{id}.{md|yaml}` file
(the SOLE canonical artefact; the flat `{artefact}/index.{md|yaml}` mirrors are
RETIRED per ADR-0077).

Falls back to "always mint new" only when: the derived graph is not yet built
(first batch on a fresh substrate); or the maintainer passes `--no-dedup`.

## Pre-step (the orchestrator does this once, before the parallel reducers)

The orchestrator (`/next-batch` Phase 2, or a maintainer driving a batch) runs
**`lineage/_extractor/.venv/bin/lineage-extractor graph-build {repo}`** ONCE before
spawning the reducer phase. This rebuilds the ephemeral graph + vector index from
the canonical `detail/` files (cache-checked — sub-second when the substrate is
unchanged) so every reducer's `graph-search` hits a current, warm index that
reflects all *committed* prior findings. The reducers never build it themselves
in parallel.

## Inputs the reducer prepares

For each fresh finding it is about to commit:

```
QUERY_TEXT:     the verbatim discriminating sidecar field — the full
                bugs_limitations_corner_cases[N] entry / implicit_adrs[N] line /
                uncovered_behaviours[N] / concept descriptor. Pick the single
                MOST discriminating field; that is the reducer's judgment call.
ARTEFACT_LABEL: the graph node label of the reducer's own artefact —
                concept-merger        -> Concept
                adr-archaeologist     -> ImplicitADR  (ADR candidates)
                                       + RefactoringScope  (gap-shaped scopes)
                doc-gap-finder        -> DocGap
                test-coverage-mapper  -> TestGap
                feature-flow-builder  -> Feature
INDEX_PATH:     the sharded index path — used ONLY by the grep fallback below.
```

## The dedup query

Run, from the workspace root:

```
lineage/_extractor/.venv/bin/lineage-extractor graph-search {repo} "{QUERY_TEXT}" \
    --label {ARTEFACT_LABEL} --k 8 --json
```

It returns up to 8 existing entries of your artefact's label, ranked by semantic
similarity to the finding. For each promising candidate, read its full content:

```
lineage/_extractor/.venv/bin/lineage-extractor graph-node {repo} "{node_id}" --json
```

`graph-node` returns the entry's sections, props (severity / category), and
provenance — enough to judge "same finding?" without loading the whole index.

## The reducer's decision (judgment, on the candidates)

The reducer reads the candidates and decides — this is the reducer's
intelligence, not a mechanical verdict line:

| Situation | Reducer's next move |
|---|---|
| **No candidate is the same finding** (low similarity, or different subject on inspection) | Mint NEXT_AVAILABLE_ID. Write `{artefact}/detail/{NEW_ID}.{md\|yaml}` with the full new entry — the SOLE canonical artefact; NO index is written (index files RETIRED, ADR-0077; `graph-build` embeds the detail file into the derived graph). Record `surfaced_by: [{slug}.md:{field-path}]`. |
| **One candidate IS the same finding** | Read `{artefact}/detail/{ID}`. Append: the new sidecar slug to `surfaced_by`, new file:line evidence to the evidence block, refinement narrative under a `STRENGTHENS — {new_sidecar} (batch {batch_id})` heading. Do NOT rewrite existing prose. NO index headline to update (RETIRED, ADR-0077); `graph-build` re-embeds the edited detail file. |
| **Two or more candidates are plausibly the same and you cannot disambiguate** | Mint a new ID, BUT add `maintainer_triage_pending: true` to the entry frontmatter + a top block naming the ambiguous candidate IDs. Surface it in the batch's investigator-log entry for the maintainer's per-batch review. NEVER auto-merge HIGH-confidence candidates — merges are maintainer-triggered. |

Apply your artefact's own strengthen logic (concept-merger merges `contributors` /
`nodes` / aggregates; test-coverage-mapper appends regression targets; etc.) — that
logic is unchanged by this cutover; only the candidate-surfacing mechanism changed.

## Fallback — graph layer unavailable

`graph-search` degrades to keyword search on its own when the embedding half is
unavailable, so it almost always returns *something*. If the graph layer is fully
absent — no `lineage/_extractor/.venv/`, or `graph-build` errors — fall back to a
`grep` over the `{artefact}/detail/` files directly (the `index.{md|yaml}` mirrors
are RETIRED, ADR-0077 — there is no index to grep) for the finding's file:line
anchors + distinctive identifiers, and log `dedup_fallback: grep-detail` in the
batch's investigator-log entry.

## Exit criteria per finding

Either a new `detail/{NEW_ID}` + index headline landed; OR an existing detail file
gained a STRENGTHENS block; OR a new detail file landed with
`maintainer_triage_pending: true` and the ambiguity is in the investigator-log.
Per-finding reducer context stays bounded by the `graph-search` result (~5-15 KB)
+ the `graph-node` reads — never the full registry.

## Per-batch aggregated invariants

- `detail/` files are the sole canonical artefacts; no index is written or
  reconciled (index mirrors RETIRED, ADR-0077); `graph-build` embeds `detail/`
  into the derived graph after the batch;
- the batch's investigator-log entry records per-reducer new / strengthen /
  ambiguous counts + any `dedup_fallback: grep-detail`.

## Cross-references

- `adrs/drafts/agentic-graph-retriever.md` — the cutover decision (rev 7.1); the reducer-dedup consumer is build-step-4.
- `adrs/drafts/graph-query-layer.md` — the derived graph query layer + the `graph-search` / `graph-node` primitives.
- `.claude/agents/registry-search.md` — the SUPERSEDED grep subagent; kept only as the documented graph-unavailable fallback.
- `.claude/agents/{concept-merger,adr-archaeologist,doc-gap-finder,test-coverage-mapper,feature-flow-builder}.md` — the 5 reducer prompts that follow this playbook.
- `lineage/_extractor/registry-shard/{shard.py,rebuild_indexes.py}` — canonical headline shapes + the Phase-3 index reconciliation.
