---
artefact: shoebox
repo: odd-platform
rev: 10
purpose: |
  A first-class place for unfinished thoughts during reverse-engineering.
  Any session that encounters code whose product purpose is not clear
  from local context appends a SHB-NNN thread here rather than forcing
  a sidecar conclusion or skipping the observation entirely.
---

# Shoebox — odd-platform investigation threads

Per APPROACH.md §18 (rev 10). The shoebox is the methodology's note-taking layer between deterministic substrate extraction (Layer 1) / per-node enrichment (Layer 2) and cross-layer composition (Layer 4). It accumulates hypotheses with incomplete evidence so reverse-engineering can proceed bottom-up + top-down opportunistically without losing observations to "doesn't fit a finalized artefact yet."

## Why this layer exists

Three converging bodies of work describe the same shape, and our methodology was missing the first stage of it:

- **Pirolli & Card sense-making model** (2005). Two-loop architecture: information foraging populates a **shoebox** (anything potentially relevant, no close examination yet); selected snippets promote into an **evidence file**; sense-making refines them into **schema → hypothesis → report**. Progress involves *much backtracking*; top-down and bottom-up mix opportunistically. *Source: P. Pirolli & S. Card, "The Sensemaking Process and Leverage Points for Analyst Technology", 2005.*
- **Von Mayrhauser & Vans Integrated Comprehension Model** (1995/96). Program comprehension is active, goal-driven, *hypothesis-based*; analysts switch between top-down (domain model) and bottom-up (program model) as required. *Source: "Program understanding behavior during debugging of large-scale software".*
- **Votipka et al. observational study of reverse engineers** (USENIX Security 2020). Empirical: REs form hypotheses (questions or conjectures), systematic exploration, and *note-taking* is the unit of work. *Source: "An Observational Investigation of Reverse Engineers' Processes and Mental Models".*

The methodology had foraging output (sidecars) and finalized structure (feature flows / concepts / reducer outputs). It had no shoebox. Without a place for unfinished thoughts the analyst either forces an observation into a structured artefact prematurely (and gets it wrong — `permission_side_door` in LSN-023) or drops the observation (and misses the feature — Data Entity Staleness, Compact lineage view-mode, 2026-05-26 case-law). The shoebox closes that gap.

## What this is, what this is not

| | |
|---|---|
| **Is** | A flat directory of one-file-per-thread investigation notes. Free-form body. Minimal frontmatter. Any session appends; nothing requires finalization. |
| **Is** | The graph layer's first-class input alongside sidecars / reducer outputs — `ShoeboxThread` is a node label in the labeled-property-graph projection (`config.L_SHOEBOX`), so semantic search picks shoebox hypotheses up immediately. |
| **Is NOT** | A backlog item. Backlog is *work the maintainer commits to doing*. Shoebox is *evidence the maintainer is still triangulating*. |
| **Is NOT** | A finalized feature. A thread graduates to `feature-flows/detail/F-NNN.yaml` when enough evidence has accumulated. Until then it stays in the shoebox. |
| **Is NOT** | A bug report. Bugs surface as `refactoring-scopes` / `feature-flow` drift facets / DOC-NNN. The shoebox captures *what feature does this observation belong to* — the bug, if any, comes later. |

## File layout

```
lineage/odd-platform/shoebox/
├── README.md                                       (this file)
└── detail/
    ├── SHB-001-data-entity-staleness.md            (one file per thread)
    └── SHB-002-compact-lineage-view-mode.md
```

Each `SHB-NNN-{slug}.md` is loaded by `_load_markdown_reducer` (lineage/_extractor/src/lineage_extractor/graph_query/loaders.py) into a `ReducerNodeRecord` with `label=L_SHOEBOX`. The body becomes the embedding target — semantic queries that match the hypothesis text or evidence notes hit the thread directly.

## Thread schema

Each `detail/SHB-NNN-{slug}.md`:

```markdown
# SHB-NNN — {one-sentence hypothesis}

**Category**: open | clustering | merged | dead-end
**Severity**: HIGH | MEDIUM | LOW                    # operator-impact estimate; can be omitted for early threads

## Hypothesis
{One falsifiable sentence stating the suspected feature: "Operators see X because Y."}

## Evidence
- `path/to/file.ext:line` — one-line note on what this proves / suggests.
- `path/to/another.ext:line` — ...

## Notes
{Free-form running text. Any session may extend. Speculation welcome — mark uncertain claims with `?` or wrap them in "guess:" prefix.}

## Next
{Concrete actions the next session can take to advance or close the thread.}

## Links
- cluster_with: [SHB-NNN, ...]        # threads that probably describe the same feature
- merged_into: F-NNN                  # set when the thread graduates to a feature flow
- supersedes: [SHB-NNN, ...]          # threads this one absorbed
```

Body sections beyond the four above are fine — keep them flat and short. The shoebox is intentionally low-ceremony; over-structuring defeats the purpose.

## Lifecycle (the four legal statuses)

| Status | Meaning | Transition out |
|---|---|---|
| `open` | New observation; one or a few evidence references; hypothesis tentative. | → `clustering` when more evidence accumulates; → `dead-end` if a later session disproves it; → `merged` if it's discovered to be a facet of an existing feature. |
| `clustering` | Multiple evidence references; hypothesis sharpening; may have cluster-siblings. | → `merged` when the maintainer graduates the thread to `feature-flows/detail/F-NNN.yaml` with `seeded_from: SHB-NNN`. |
| `merged` | Thread graduated to a feature flow. `Links.merged_into: F-NNN` set. File kept for traceability (provenance: this feature was reverse-engineered FROM this thread). | Terminal. |
| `dead-end` | Investigation refuted the hypothesis (the observation belongs to no user-observable feature, or duplicates a closed thread). `Notes` records why. | Terminal. |

## Who writes shoebox entries

Any session that encounters something it can't anchor in a sidecar or composition. The two seed cases:

- **The file-analyser subagent** (`.claude/agents/file-analyser.md`). When enriching a node, if a piece of the code's product purpose is not derivable from local context — i.e. the field/method exists, the predicate runs, but *why does this exist*? — append a shoebox note rather than forcing a sidecar conclusion. Cite the unanswered question.
- **The maintainer**, during `/code-walk` / `/enrich` / casual reading. When the maintainer notices a feature missing from `feature-flows/` (a "compact" toggle, a DTO field with no flow anchor, a UI control with unclear purpose), append SHB-NNN with the initial observation.
- **The feature-flow-builder subagent** (`.claude/agents/feature-flow-builder.md`). At the start of every run, reads `shoebox/detail/*.md` and evaluates each `open|clustering` thread for graduation / merging / clustering. The shoebox is its first-class input, alongside sidecars + concepts.yaml + the substrate edge graph.

## The per-run evaluation (feature-flow-builder responsibility)

Every feature-flow-builder run executes the following pass over the shoebox **before** composing new flows:

1. **Read all `shoebox/detail/SHB-*.md`** with `Category: open` or `clustering`.
2. **For each thread, decide one of four verdicts:**
   - **Graduate to feature.** If the evidence list is sufficient (>3 evidence refs spanning at least 2 substrate axes; hypothesis falsifiable; product surface clear), author `feature-flows/detail/F-NNN.yaml` with `seeded_from: SHB-NNN` and flip the thread's status to `merged`.
   - **Merge into existing feature.** If the hypothesis maps to a facet of an existing F-NNN, append the evidence to that flow as a facet (or as `contributing_nodes`) and flip status to `merged` with `merged_into: F-NNN`.
   - **Cluster with siblings.** If two-or-more `open` threads share substantial keyword overlap in their hypothesis or share ≥1 evidence file, set their `Links.cluster_with` to each other. Once a cluster has enough evidence to graduate, treat it as a single feature.
   - **Leave as note.** Insufficient evidence to graduate or merge — extend `Notes` with what the builder considered and why it deferred. The next run reconsiders.
3. **Append an `## evaluation` block to each thread** the builder touched, dated and signed (`feature-flow-builder 2026-MM-DD: deferred (insufficient evidence in axis X)` / `graduated to F-NNN` / etc.). This makes the thread's lifecycle traceable.

Threads accumulate. Multi-run convergence is the norm — a thread may stay `open` for several runs before crossing the graduation threshold. That is the point: hypotheses with thin evidence stay hypotheses until the foraging catches up.

## Stable IDs

Threads use a monotonically-increasing `SHB-NNN` zero-padded counter. The next-free ID is `MAX(existing SHB-NNN) + 1`. The ID is permanent; statuses and bodies change but the ID does not. A thread that ends `dead-end` keeps its ID — it is part of the methodology's audit trail, not a deletion candidate.

## What the shoebox replaces

This layer is intentionally subtractive in two places:

- It **deletes the proposal** (2026-05-26, this conversation) to add a "DTO-field decomposition reducer + cross-cutting predicates substrate axis + per-mechanic requirement reconstruction artefact + clustering composition reducer + new spot-check type + redefined coverage metric." Those abstractions are not added. Hypotheses about DTO fields and lateral predicates are now legal artefacts in flight — the shoebox is their home.
- It **redefines coverage honestly**. "Effective coverage" of nodes-touched-by-any-feature-flow continues to be computed, but the headline metric for *feature-anchoring* now includes the open-shoebox count. The work list is `shoebox/detail/SHB-*.md` with `Category: open` or `clustering` — bounded, traceable, ageable.

## Cross-references

- `APPROACH.md` §18 — the shoebox layer (rev 10); §3 (the four-layer architecture, now five with shoebox as Layer 2.5); §15 (top-down PO reflection — Layer 4b — which uses shoebox graduations as one of its inputs).
- `.claude/agents/feature-flow-builder.md` — the per-run evaluation pass is its responsibility.
- `.claude/agents/file-analyser.md` — Rule 11 (append a shoebox note when product purpose isn't local-derivable).
- `retrospectives/LSN-023` — the `permission_side_door` mis-read that comes from forcing structure on incomplete evidence; the shoebox is the corrective for that class of error.
- `lineage/_extractor/src/lineage_extractor/graph_query/{config.py,loaders.py}` — `L_SHOEBOX` label + `_load_markdown_reducer(... "shoebox", "SHB", ...)` registration.
