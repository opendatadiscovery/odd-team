---
name: align
description: Compute the cross-corpus ALIGNMENT scorecard — a deterministic, no-LLM roll-up that scores how well the ontology bridges CODE ↔ DOC ↔ ADR ↔ TEST bi-directionally, surfaces the Test-Traceability Ledger (no orphan tests; every test gates an ontology relationship), and emits a Contract-Test Readiness verdict + ranked actionable items + a trend series. Run it as a periodic heartbeat to see what blocks moving forward to contract tests. Writes lineage/{repo}/alignment-scorecard.{md,yaml}.
argument-hint: [<repo>] [--show] [--json] [--deep]
allowed-tools: Read, Glob, Grep, Bash(uv run *)
---

# Alignment scorecard (`/align`)

The cross-corpus consistency dashboard. A **deterministic roll-up — no LLM, no
subagents** in default mode — over the already-derived ontology + ground-truth
anchors. It answers the maintainer's standing question:

> *What is the level of alignment between documentation, ADRs, the codebase, and
> the tests — and what blocks us from building the contract tests that pin
> doc-claims to implementation?*

It does **not** re-derive anything (that's what `/enrich`, `/concepts`,
`/find-implicit-adrs`, `/doc-gap-check`, `/test-coverage`, `/reflect-feature`
produce). It **joins** those outputs + the graph, computes bi-directional
coverage ratios, and scores them. The expensive agentic re-verification is the
separate `--deep` mode (phase 2).

## What it measures (5 dimensions)

| Dim | Question |
|---|---|
| **A** Ontology ↔ Code | is the ontology a fresh, faithful mirror of code? (substrate freshness, enrichment, axis integrity) |
| **B** Ontology ↔ Doc (bi-dir) | *if docs claim it, does code exist?* (DESCRIBES→code resolution) · *if implemented, is it documented?* (features with inbound DESCRIBES) · open DocGaps · doc drift |
| **C** Ontology ↔ ADR | published ADRs ingested · REALISES code links · candidate disposition |
| **D** **Test-Traceability Ledger** | **no orphan tests** (every test/gap carries a typed gate) · ADRs enforced · features validated · bugs/scopes regress-guarded · probe execution + named-integration stacks |
| **E** Trust meta-gate | graph freshness · embeddings on? · latest `/panel` verdict · **reflection coverage** (the discount on every alignment claim) |

**The honesty rule (hard-coded):** every alignment metric is reported as
`aligned / checked / total`. A low contradiction count is rendered as
"UNKNOWN over N%", never "aligned" — because the layer that proves alignment
(feature-reflection) has run on <1% of features. The score cannot hide a blind
spot. The top line is a **Contract-Test Readiness verdict** (NOT-READY /
PILOT-READY / READY) + explicit blockers + the **ready-now subset** (what is
fully bridged and contract-testable today).

The Test-Traceability Ledger implements `feedback_tests_as_deterministic_gates`:
a test is never a free-floating item — it `enforces`→ADR / `validates`→Feature /
`regresses`→Finding-Issue / `guards`→RefactoringScope, checked bidirectionally
(every test has a gate; every test-worthy subject has a test or a gated gap).

## Argument forms

| Form | Behaviour |
|---|---|
| `/align [<repo>]` | **Default** (repo defaults to `odd-platform`). Compute the scorecard from the canonical files NOW (fresh `load_substrate` + `project`, independent of the last graph-build), write `alignment-scorecard.{md,yaml}` (the `.yaml` appends one trend row), print the summary + the top action. Cheap + idempotent — the periodic heartbeat. |
| `/align --show [<repo>]` | Read-only. Print the existing `lineage/{repo}/alignment-scorecard.md` (no recompute). |
| `/align --json [<repo>]` | Emit the machine payload (the written YAML) to stdout for downstream tooling. |
| `/align --deep [<repo>]` | **Phase 2 — not yet built.** The agentic contract audit: fan out subagents to *sample-verify* the cheap signals — re-fire `reflect-feature` on the highest-value un-reflected features, sample Doc→Code claims for live verification, drift-check each ADR's `REALISES`. Each finding logged as a gated `TestGap` via `playbooks/follow-up-on-disk.md`. Until built, the skill says so and runs the default mode. |

## Procedure (default mode)

1. Run `uv run --project lineage/_extractor lineage-extractor alignment <repo>`
   (deterministic; ~15 s; reads the canonical files + the built graph's
   `build-info.yaml` + git HEAD + the published ADR pages + the probe corpus).
2. Read back `lineage/{repo}/alignment-scorecard.md` and relay to the maintainer:
   the readiness verdict, the blockers, the per-dimension grades, the ready-now
   subset, and the top 3 actionable items.
3. If any dimension is RED for a *new* reason vs the prior `trend` row, call it
   out as a regression. The trend series is the periodic-monitoring surface.

## When to run

- **Per sprint checkpoint / milestone** — alongside `/panel` (which audits the
  *methodology*; `/align` audits the *ontology's fidelity* — complementary, and
  `/align` consumes the latest `/panel` verdict in its trust gate).
- **After a batch of `/enrich` + reducers** — to see whether coverage moved the
  alignment numbers.
- **Before starting contract-test work** — the readiness verdict + ready-now
  subset tell you exactly where to aim, and the actionable items name the
  blockers (Phase-4 Test layer, reflection coverage, ADR re-ingest, etc.).

On-demand only — **no daemon, no schedule** (APPROACH.md Rule 12; local-only).

## Outputs

- `lineage/{repo}/alignment-scorecard.md` — human, diffable, committed.
- `lineage/{repo}/alignment-scorecard.yaml` — machine metrics + `trend:` series
  (last 50 runs), committed.

## Cross-references

- `lineage/_extractor/src/lineage_extractor/alignment.py` — the implementation.
- `feedback_tests_as_deterministic_gates` (memory) — the Ledger's spine.
- `adrs/drafts/ground-truth-lineage.md` — Phase 4 (the `Test` layer the readiness
  verdict gates on).
- `lineage/GRAPH-TOPOLOGY.md` — the labels + edges rolled up here.
- `/panel` — the complementary methodology meta-review.
