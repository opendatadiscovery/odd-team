---
artefact: research/summary
draft_for: ADR-scanner-ontology-fusion
date: 2026-05-27
research_phase: complete (5 threads + synthesis)
authored_by: maintainer-pair (NOT delegated — synthesis is the critical step)
target_signoff: maintainer
---

# SCANNER ↔ ONTOLOGY FUSION — synthesis & opinionated proposal

This is the one document the maintainer reads to decide. Five research threads
fed in:

- **STATE.md** — the actual current state of the two pipelines
- **GAPS.md** — 20 concrete gaps + 8 reverse-direction (R-01..R-08) framings
- **DESIGN-CHOICES.md** — 7 technical decisions, mostly HIGH-confidence
- **PITFALLS.md** — 9 LSN classes + 8 fusion-specific + 3 prior-art (Sourcegraph / GraphRAG / Glean) → 12 hard rules
- **INTEROP.md** — exact file shapes, agent contracts, budgets, idempotency keys

This SUMMARY synthesises them — opinionated, with HIGH/MED/LOW confidence per
call. Read this. Sign off. Then I implement against the locked design.

---

## 1. The one-sentence proposition

> **The ontology IS the precomputed answer key the scanner has been re-deriving
> by hand.** Rev 13 wires the scanner to consume it as a clue source (always
> code-verified, never trusted) and to write back annotate-only status flips
> so the ontology learns which features the scanner already audited.

The strongest single insight across all five threads is the reverse-direction
framing from GAPS §4 (R-01..R-08): every flow the scanner does today has a
matching precomputed slice on the ontology side that the scanner cannot see.
Today's air-gap (STATE §"Today's air-gap" — zero one direction, one half-leak
the other) leaves **~726 candidate findings** (103 doc-gaps + 211 refactoring-
scopes + 312 test-gaps) in the ontology unreachable by `/triage` and the
scanner re-discovering them week after week.

The fix is small. Per DESIGN-CHOICES §1, the orchestrator grows by ~80 lines.
Per INTEROP §2, every existing artefact shape ports forward unchanged
(`scanner_reviews:` mirrors `probe_verifications:`). The cost-shape stays
inside the workspace's published constraints (per-scan-run budgets:
graph-retriever ≤5, feature-reflector ≤3, odd-sme ≤2).

---

## 2. The recommendation, decision-by-decision

| # | Decision | Pick | Confidence | Anchor |
|---|---|---|---|---|
| 1 | **Orchestration shape** | Extend `/scan` with a single conditional branch on `ontology_feed:` frontmatter. Direct file reads (NOT graph-retriever for primary consumption). doc-gap-finder remains independent. | HIGH | DESIGN-CHOICES §1 |
| 2 | **Verification protocol** | 4-tier clue-class ladder (`file_exists` / `assertion_about_code` / `cross_layer_behaviour` / `doc_drift`). New `Ontology` SoT class additive, always **co-cited** with primary source: `Ontology[F-001:hop-1] → Repo[DataEntityDetails.tsx:56-64]`. Disagreement → BOTH annotation AND correction-shoebox-thread. | HIGH | DESIGN-CHOICES §2 + PITFALLS D8/C2 |
| 3 | **Write-back contract** | Append-only `scanner_reviews:` list keyed by `(scanner_id, scan_run_date)`, mirrors existing `probe_verifications:` shape. `doc_status: backlog \| drafted \| reviewed \| live \| invalidated`. Maintainer curation preserved by identity (entries with `maintainer_curated: true` never overwritten). | HIGH | DESIGN-CHOICES §3 + INTEROP §2.1 + PITFALLS D3 |
| 4 | **PO/SME escalation** | 3 explicit triggers (drift on stale reflection; undocumented operator concern; cross-layer contradiction). Hard caps: feature-reflector ≤3/run, odd-sme ≤2/run, graph-retriever ≤5/run. AskUserQuestion escalation on 4th trigger. Routes through existing rev-11 SME pattern verbatim. | HIGH triggers / MED caps | DESIGN-CHOICES §4 + INTEROP §3 + PITFALLS D12 |
| 5 | **Two-mode coexistence** | Explicit per-scanner opt-in via `ontology_feed: { enabled: true, ... }` frontmatter. Mode-LOCKED per scanner-run. **Abort-on-missing-substrate** (no silent fallback — anti-LSN-001). Idempotent under fixed `manifest.yaml:current_substrate_commit`. | HIGH | DESIGN-CHOICES §5 + PITFALLS D10 |
| 6 | **Conflict resolution** | Class-specific: live-fetch wins doc-coverage disputes; enrichment-not-duplicate for severity mismatches; maintainer curation preserved by identity (not lock-by-entire-flow). Append-only writeback is the structural answer. | HIGH | DESIGN-CHOICES §6 + INTEROP §5 + PITFALLS C3 |
| 7 | **Staleness contract** | WARN-and-proceed with reduced trust (default); per-scanner `staleness_action: abort` override. Stamp `ontology_commit_consulted:` on every emission. >50 commits behind OR >48h old → downgrade trust + tag `ontology_corroborated: stale_warning`. | HIGH | INTEROP §5.1 + PITFALLS D1 |
| 8 | **doc-gap category split** | Scanner ingests only `{missing-page, coverage-gap}`. `{broken-url, drift, missing-anchor, stale-page}` stay on `/triage` direct ingest. Avoids re-routing noise; preserves doc-gap-finder's URL-verification role. | HIGH | INTEROP §1.2 |
| 9 | **New file: scanner-feed log** | Per-scan-run reproducibility log at `lineage/{repo}/scanner-feed/{date}-{scan_run_id}.yaml`. Always emitted (absence is informative). Single source of truth for "what did this scan-run consume and write?" | HIGH | INTEROP §2.5 |
| 10 | **Transition path** | Day 1 — 2 pilots (`docs/coverage/undocumented-features` + `docs/accuracy/feature-behavior`); Day 30 — broad rollout (~18 of 28 scanners flip; 10 stay standalone forever); Day 90 — doc-gap-finder restructure decision deferred. | HIGH pilots / MED day-90 | DESIGN-CHOICES §7 + INTEROP §4 |

---

## 3. The 12 hard rules (PITFALLS D1-D12, restated as design invariants)

Every rule maps to ≥1 pitfall it defeats. These are non-negotiable; the
fusion implementation cannot bypass them without a new LSN to justify it.

| # | Rule | Defeats |
|---|------|---------|
| D1 | Every emission stamps `ontology_commit_consulted: <sha>`. Stale >50 commits or >48h → `WARNING: stale-ontology-skip` per-flow. | Staleness B1 + C1 (Sourcegraph Cody embeddings deprecation) + A6 + A9 |
| D2 | Every scanner loads and cites a written `target.md` before verdicts. Implicit target forbidden. | LSN-022 implicit-target trap |
| D3 | `scanner_reviews:` is APPEND-ONLY list. Idempotency `(scanner_id, scan_run_date, scanner_version)`. File-locked. | B3 write-back contention |
| D4 | Every feature-flow carries `status: code-only \| docs-only \| both \| drift`. Scanners route per matrix. | B4 doc-as-requirements drift + C3 Glean dual-source posture |
| D5 | Scanner emissions GREP ontology registries (`refactoring-scopes/`, `doc-gaps.md`, `test-map.yaml`, `implicit-adrs.md`) before writing. Duplicates extend via back-link. | A8 LSN-009 duplication |
| D6 | Post-emit coherence check against the touched flow AND the rest of the ontology. Polarity contradictions halt and surface `state/coherence-conflict-scan-N.md`. | LSN-018 + B3 + B6 |
| D7 | Verdicts tagged `STATIC-INFERRED` or `PROBE-VERIFIED`. A scanner emitting only `STATIC-INFERRED OK` gets `verification_class: descriptive-only`. | LSN-019 descriptive-not-interrogative |
| D8 | Verification logic MUST be self-contained code reading target-repo source directly. **No `Read(lineage/.../*.md)` inside the assert step.** Ontology names *where to look*; expectation comes from scanner's own forcing-question contract. | B2 circular trust + B7 wrong-anchor + C2 GraphRAG hallucination class |
| D9 | Emissions distinguish `ontology-confirmed` (verified what ontology named) from `ontology-extended` (discovered new behaviour). | LSN-017 cross-layer blindness + LSN-020 cross-file drift |
| D10 | Per-scanner `ontology_coverage_check_at_start`: if intended-entity coverage < 50%, ABORT with `INSUFFICIENT-ONTOLOGY-COVERAGE` and emit `coverage_gap_for_scan:` naming missing entities. Silent fallback forbidden. | B8 silent mode-mixing |
| D11 | Scanner coverage metrics denominated by *conceptual ceiling* (rev-12 LSN-025 Type-3.5), NOT enumerated substrate node count. | LSN-023 + LSN-025 axis-undercoverage |
| D12 | Per-scan-run budget: max 3 SME consults + max 5 probe runs + max 5 graph-retriever invocations. Excess → backlog escalation. Hard cap, not soft. | B5 consultation cost explosion |

The two strongest rules (the ones I'd flag for special enforcement at code-review):

- **D8** (self-contained verification) — the GraphRAG hallucination class (PITFALLS C2): LLMs *trust* the graph because it's structured. If the assert step reads the sidecar that produced the clue, the verification is structurally compromised. Code review must reject any verification logic that does `Read(lineage/.../*.md)` inside an `assert_*` function.
- **D10** (no silent mode degradation) — silent fallback to ontology-blind mode is the LSN-001-class footgun: every emission claims `ontology_fed: true` but findings are actually mode-A. Operators trust the badge; the badge lies. Abort is the right rigour.

---

## 4. What this rev IS — concrete acceptance criteria

The fusion is "done" for rev-13 when ALL of the following hold:

1. `/scan` skill (`.claude/skills/scan/SKILL.md`) carries a conditional branch keyed on the scanner's `ontology_feed:` frontmatter; both modes A and B share the same file.
2. 2 pilot scanners (`docs/coverage/undocumented-features` + `docs/accuracy/feature-behavior`) carry `ontology_feed:` blocks per INTEROP §4.
3. `scanners/README.md` documents the two-mode contract + the `ontology_feed:` block schema.
4. Both pilots have produced ≥1 mode-B scan-run that:
   - emits at least one finding citing `Source: Ontology[F-NNN] → Repo[file:line]`
   - writes back a `scanner_reviews:` entry to ≥1 feature-flow
   - emits a complete `scanner-feed/{date}-{scan_run_id}.yaml` log
5. `/triage` skill ingests the `scanner-feed` log per INTEROP §3.5 and lifts priority on ontology-corroborated findings.
6. PITFALLS rules D1, D3, D8, D10, D12 are mechanically enforceable from the SKILL.md (i.e. the scanner cannot pass review while violating any of them).
7. APPROACH.md §20 (currently a placeholder) is rewritten in the static-protocol shape with the rev-13 trigger anchored as `retrospectives/LSN-026` if a fresh case-law incident emerges from pilot data — OR cross-references the existing LSN catalog if no new case-law is needed.

That's it. 7 acceptance criteria. ~80 lines in `/scan`, ~50 lines added to `scanners/README.md`, ~20-30 lines per pilot scanner frontmatter, and the SKILL+playbook scaffolding for the budgets/staleness/coherence rules.

---

## 5. What this rev IS NOT — explicitly out of scope

Per DESIGN-CHOICES §"Out of scope for the MVP" + my own synthesis:

- **NO substrate mutation** outside `scanner_reviews:` blocks (locked constraint).
- **NO changes to reducers** (`feature-flow-builder`, `concept-merger`, `adr-archaeologist`, `test-coverage-mapper`, `doc-gap-finder`) — fusion is scanner-side only. Reducers continue to run on their existing cadences.
- **NO new orchestrator skill** alongside `/scan` — one skill grows, no split.
- **NO Source-of-Truth class** that supersedes existing classes — `Ontology` is additive, always co-cited.
- **NO auto-promotion** of reducer outputs (`refactoring-scopes.md` 211 entries, `test-map.yaml` 312 entries) to backlog. Promotion stays maintainer-in-the-loop; the scanner enables maintainer-driven triage by surfacing the candidates, not by short-circuiting human judgment.
- **NO subsumption of `doc-gap-finder`** into the scanner. The reducer's cross-sidecar dedup role is structurally unique (per `doc-gap-finder.md` Rule 4). Whether to subsume is a rev-14 question, deliberately deferred.
- **NO ontology-fed mode for test scanners or spec scanners** — different domain, circular feedback risk (per INTEROP §4 "Never opt in" table).
- **NO ontology authority in tie-breakers** — Glean's dual-source posture (PITFALLS C3): when sources disagree, cite both and route to maintainer review; never auto-elevate code over docs OR docs over code by default.

---

## 6. Genuine MVP-blocking open questions for the maintainer

Only items where the maintainer's call is required for me to proceed. NOT
technical decisions I should make myself.

### Q1 — The SME-consultation cap value: 2 vs 3 vs 5

DESIGN-CHOICES §4 picks `odd-sme: 2 / feature-reflector: 3 / graph-retriever: 5`
with MEDIUM confidence on the cap values themselves (the triggers are HIGH).
The numbers are an estimate from rev-2 batch sizes; pilot data will tune them.

The maintainer's call: ship with these defaults, or pick conservative
(`odd-sme: 1 / feature-reflector: 2 / graph-retriever: 3`) to keep pilot
cost minimal, or aggressive (`odd-sme: 3 / feature-reflector: 5 / graph-retriever: 10`)
to maximise pilot signal?

My recommendation: **ship the proposed defaults** (2/3/5) and adjust at Day 30
broad-rollout from real pilot data. Conservative caps risk hiding the signal
the pilots exist to gather.

### Q2 — Day-90 doc-gap-finder restructure: defer formally or commit now?

DESIGN-CHOICES §7 punts the restructure decision to Day 90. My recommendation
holds the punt (formal defer): the substrate's `doc-gaps.md` is the
cross-sidecar dedup point; if pilots show 60%+ of doc-gap-finder findings
also surface via the scanner mode-B, restructure becomes interesting; if
pilots show <30% overlap, the reducer stays its own thing.

The maintainer's call: am I formally deferring (recommended), or should I
plan now for the restructure shape?

### Q3 — Does the `Ontology` Source-of-Truth class need Gate 9 ratification?

Gate 9 (`pillars/documentation/gates.md`) currently enumerates 11 SoT classes
(Repo / Integration / Config / Builder / Spec / Term / Lifecycle / Dep /
Handler / Cross-repo / Backlog). DESIGN-CHOICES §2 adds `Ontology` as a 12th,
additive class — always co-cited with one of the existing primary-source
classes.

The maintainer's call: am I OK to ship the Gate 9 extension as part of rev-13,
or does the documentation pillar own that change and I should propose-not-edit
the gates file?

My recommendation: **propose-not-edit**. The fusion ADR proposes the new class;
the documentation-pillar maintainer (you, in a different hat) ratifies via an
explicit gate edit in a follow-up commit. Loose coupling between the
methodology evolution and the active-pillar gates.

That's it. Three open questions. Everything else is committed-by-default in
the proposal.

---

## 7. The implementation sequence (deferred until signoff)

Once you sign off on the proposal, the implementation lands in this order
(each step is a single commit on `feature/scanner-ontology-fusion-rev13`):

1. **APPROACH.md §20 rewrite** — replace the placeholder with the static-protocol
   shape; cite this SUMMARY.md as the rationale anchor. Add Rule 21 (the
   D1-D12 hard rules condensed into one workspace-level rule, similar to
   Rule 20 added in rev 12).
2. **`scanners/README.md` extension** — document the `ontology_feed:` block
   schema, the two-mode contract, and the per-scanner opt-in mechanic.
3. **`.claude/skills/scan/SKILL.md` extension** — add the conditional
   branch (~80 lines): step 2.5 ontology load + step 9.5 writeback +
   coherence + budget enforcement.
4. **Pilot scanner 1**: `scanners/docs/coverage/undocumented-features.md` —
   add the `ontology_feed:` frontmatter; document the diff vs standalone.
5. **Pilot scanner 2**: `scanners/docs/accuracy/feature-behavior.md` — same shape.
6. **Per-pilot test scan-runs** — run both pilots; produce `findings/` +
   `scanner-feed/` artefacts; iterate the verification ladder if pilot data
   surfaces edge cases.
7. **`.claude/skills/triage/SKILL.md` extension** — ingest the `scanner-feed`
   log; lift priority per INTEROP §3.5.
8. **Acceptance check** — verify all 7 criteria from §4 above hold.
9. **PR review** — present to maintainer; merge if approved.

After merge: Day 30 broad rollout (separate PR), Day 90 doc-gap-finder
restructure decision (separate PR if pilots warrant).

I will NOT touch `scanners/`, `.claude/skills/`, `.claude/agents/`, or any
existing F-NNN file until you sign off on this proposal.

---

## 8. Confidence summary

- **HIGH-confidence decisions**: orchestration shape, verification protocol, write-back contract structure, staleness handling, doc-gap category split, transition pilots, the 12 hard rules.
- **MEDIUM-confidence decisions**: SME/PO consultation cap values (pilot data will tune), Day-90 reducer restructure timing.
- **LOW-confidence decisions**: NONE — everything either ports an existing workspace pattern or is anchored in a prior-art lesson from PITFALLS Part C.

The fusion is small. The orchestrator grows ~80 lines. Every existing
artefact shape ports forward unchanged. `scanner_reviews:` mirrors
`probe_verifications:` (proven idempotent across 4 probes on F-001). The
verification ladder forces live-source verification at every clue class.
SME triggers route through the existing rev-11 pattern. Transition is two
pilots → 30-day broad rollout → 90-day restructure decision deferred.

**The fusion's value proposition in one number**: 726 ontology-surfaced
candidate findings (103 doc-gaps + 211 refactoring-scopes + 312 test-gaps)
are today unreachable by `/triage`. Mode B makes them reachable, at a cost
of ~80 lines of `/scan` extension + 3 small skill changes + 2 pilot
scanners' frontmatter. The cost/value ratio is the strongest the methodology
has shipped since rev 7 (graph-query layer).

---

## 9. Maintainer action requested

1. **Read this SUMMARY** + skim the 5 supporting threads (~14,000 words; ~20 min total).
2. **Answer the 3 open questions** (§6) — Q1 cap values, Q2 Day-90 punt, Q3 Gate 9 ratification ownership.
3. **Sign off OR redirect** — if signed off, I commit this SUMMARY and proceed to the implementation sequence (§7). If you want changes, I revise and re-present.

The branch `feature/scanner-ontology-fusion-rev13` carries the placeholder
APPROACH.md edit + the 5 research artefacts; nothing else has been touched.
All implementation lands after your signoff, never before.

---

## References

- `adrs/drafts/research/scanner-ontology-fusion/STATE.md` — pipeline state of both halves
- `adrs/drafts/research/scanner-ontology-fusion/GAPS.md` — 20 concrete gaps + R-01..R-08 reverse direction
- `adrs/drafts/research/scanner-ontology-fusion/DESIGN-CHOICES.md` — 7 opinionated technical decisions
- `adrs/drafts/research/scanner-ontology-fusion/PITFALLS.md` — 9 LSN + 8 fusion-specific + 3 prior-art → 12 hard rules
- `adrs/drafts/research/scanner-ontology-fusion/INTEROP.md` — concrete file shapes, agent contracts, budgets, diagrams
- `APPROACH.md §20` — placeholder section (this SUMMARY replaces it post-signoff)
- `playbooks/deep-research.md` — the playbook this research run followed
- `retrospectives/LSN-{016-025}.md` — the case-law the design defeats
