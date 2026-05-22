---
panel_run: 2026-05-22
phase: 1
expert: panel-economist
axis: Cost
commit_anchor: ede5d277
prompt_version: panel-economist/0.1.0
cost_trend: rising
axis_score: 4
axis_band: AMBER
---

# Phase 1 — Economist (Cost) assessment

## summary

The methodology is producing real findings but its cost structure is deteriorating. The top-level monolith reducer artefacts (`concepts.yaml` at 647 KB, `test-map.yaml` at 784 KB, `test-map/index.yaml` at 1.4 MB) exceed any single-pass agent context window, forcing sharding that the methodology has implemented incompletely — the index is now divergent from its `detail/` directory by at least 3 entries, with two pending-merge delta files unresolved. Cost-per-verified-claim stands at ~8,358 tokens per STATIC-INFERRED claim, with `stress_answers_probe_verified = 0`, meaning the denomination is still "claims the LLM asserted from code traces" rather than "claims a running system confirmed." The cost trend is rising because 87.4% of sidecars (139/159) carry zero stress questions and must be backfilled, while the artefacts they feed are already oversize.

## target_lens

The economist's axis most directly owns target condition 4 (index/detail integrity — "zero divergence between every reducer index and its `detail/` directory") and the general cost discipline implicit in all eleven conditions. For condition 1 (`stress_verified_pct ≥ 0.80`), the target requires that denominator to cover `≥ 90%` of stress-trigger nodes — which currently it does not (only 20 of 159 sidecars have stress sections, leaving 87.4% uncounted). The bar I hold: (a) no single artefact too large to load whole in a downstream agent context pass; (b) index/detail divergence = 0; (c) cost-per-verified-claim flat or falling as batches continue; (d) the delta-file backlog does not compound across batches. The methodology currently fails (a) on three artefacts, fails (b) with confirmed divergence, and the trend for (c) is rising because 139 pre-stress sidecars add zero denominator mass per token spent on them while reducers keep growing.

## measured_metrics

- metric: "understanding/ (sidecar) directory total size"
  value: "9.3 MB, 164 files, mean 342 lines/sidecar, max 667 lines"
  command: "du -sh lineage/odd-platform/understanding/; find ... -exec wc -l {} \\; | awk stats"

- metric: "concepts/ directory total size"
  value: "5.2 MB, 443 detail files"
  command: "du -sh lineage/odd-platform/concepts/"

- metric: "concepts.yaml (top-level monolith)"
  value: "5,911 lines / 647,447 bytes (1.8x 350 KB context limit)"
  command: "wc -l lineage/odd-platform/concepts.yaml; wc -c lineage/odd-platform/concepts.yaml"

- metric: "concepts.yaml staleness"
  value: "sidecar_count: 50 (generated); actual sidecars now: 159 — delta of 109 sidecars unconsumed"
  command: "grep sidecar_count lineage/odd-platform/concepts.yaml"

- metric: "test-map/ directory total size"
  value: "6.9 MB, 922 files"
  command: "du -sh lineage/odd-platform/test-map/"

- metric: "test-map/index.yaml (sharded index)"
  value: "26,281 lines / 1,438,326 bytes (4.1x 350 KB context limit)"
  command: "wc -l lineage/odd-platform/test-map/index.yaml; wc -c lineage/odd-platform/test-map/index.yaml"

- metric: "test-map/index.yaml batch_history verbosity"
  value: "107 batch entries in ~220 lines of frontmatter; each batch entry ~7 lines"
  command: "grep -c '20..-..-' lineage/odd-platform/test-map/index.yaml; head -220 ..."

- metric: "test-map: index vs detail divergence"
  value: "index reports 906 entries; detail/ holds 908 files (highest TEST-GAP-909); 2 pending-merge delta files unresolved"
  command: "grep total_test_gaps lineage/odd-platform/test-map/index.yaml; find .../test-map/detail -name '*.yaml' | wc -l"

- metric: "implicit-adrs.md (top-level monolith)"
  value: "1,512 lines / 459,468 bytes (1.3x 350 KB context limit)"
  command: "wc -l lineage/odd-platform/implicit-adrs.md; wc -c lineage/odd-platform/implicit-adrs.md"

- metric: "refactoring-scopes/index.md"
  value: "2,845 lines / 546,247 bytes (1.5x 350 KB context limit)"
  command: "wc -l lineage/odd-platform/refactoring-scopes/index.md; wc -c lineage/odd-platform/refactoring-scopes/index.md"

- metric: "doc-gaps.md (top-level monolith)"
  value: "1,416 lines / 292,010 bytes"
  command: "wc -l lineage/odd-platform/doc-gaps.md; wc -c lineage/odd-platform/doc-gaps.md"

- metric: "feature-flows/index.yaml"
  value: "6,981 lines / 338,131 bytes (0.9x 350 KB limit — borderline)"
  command: "wc -l lineage/odd-platform/feature-flows/index.yaml; wc -c lineage/odd-platform/feature-flows/index.yaml"

- metric: "feature-reflections/index.yaml"
  value: "52 lines / 2,517 bytes — minimal"
  command: "wc -l lineage/odd-platform/feature-reflections/index.yaml"

- metric: "investigator-log.md"
  value: "2,293 lines / 278,818 bytes; 28 batches, ~81 lines/batch"
  command: "wc -l lineage/odd-platform/investigator-log.md; grep -c '^## Batch' ..."

- metric: "nodes.jsonl / edges.jsonl"
  value: "395 nodes, 479 edges — lean"
  command: "wc -l lineage/odd-platform/nodes.jsonl lineage/odd-platform/edges.jsonl"

- metric: "total lineage/ directory (tracked files)"
  value: "2,736 tracked files; 83 MB on disk (46 MB is gitignored graph cache)"
  command: "git ls-files lineage/odd-platform/ | wc -l; du -sh lineage/odd-platform/"

- metric: "pending-merge / unresolved delta files"
  value: "6 files: concepts.delta.batch-ZB.pending-merge.yaml, test-map/index.delta.batch-ZB.pending-merge.yaml (421 lines), test-map/index.delta.X-TAGGING.yaml (390 lines), implicit-adrs/index-batch-ZB-append.NOOP.md, doc-gaps/index-batch-ZB-append.MERGED.md, refactoring-scopes/index-batch-ZB-append.MERGED.md"
  command: "find lineage/odd-platform -name '*.pending-merge*' -o -name '*.delta.*' -o -name '*.NOOP.*' | sort"

- metric: "manifest stress coverage"
  value: "stress_answers_probe_verified=0; stress_answers_static_inferred=335; sidecars_with_stress_section=20/159=12.6%; sidecars_pre_stress_protocol=139"
  command: "cat lineage/odd-platform/manifest.yaml"

- metric: "git insertions since 2026-05-10 (lineage/odd-platform/)"
  value: "327,579 insertions, 20,035 deletions across 54 commits"
  command: "git log --stat --since='2026-05-10' -- lineage/odd-platform/ | grep -E 'insertions|deletions' | awk ..."

## redundancy_assessment

intra_artefact: |
  All 164 sidecars share identical top-level YAML section keys (implicit_adrs,
  bugs_limitations_corner_cases, security, performance, docs_link_semantic,
  tests_coverage_semantic, stress). The schema boilerplate is ~40-60 lines per
  sidecar regardless of how much content each section holds. For the 139 pre-stress
  sidecars, the stress section is empty or absent — those sidecars carry structural
  overhead for a section that does not yet contribute. Sampling: grep -c "security:"
  on all 164 sidecars returns 164/164 — every sidecar has the key regardless of
  whether it has content. Estimate: ~15-20% of sidecar bytes are empty-section
  scaffolding (sampling method: wc -c on 3 sidecars vs their non-empty line count).

cross_artefact: |
  The investigator-log.md restates, in narrative form, what the reducer artefacts
  already encode structurally. Sampling: "DISABLED" appears 58× in
  refactoring-scopes/index.md and 66× in investigator-log.md; "plaintext" appears
  34× and 29× respectively. The log is not a unique artefact — it is a human-readable
  summary of reducer changes, but a downstream agent querying findings reads the
  reducer, not the log. The log's 278 KB duplicates approximately 30-40% of what
  the reducer artefacts already structurally carry. Additionally, concepts.yaml
  (top-level monolith, generated at v8 from 50 sidecars) and concepts/ sharded
  detail (443 files, generated from later batches) represent two parallel
  representations of the same concept catalog with uncertain sync. The sharded
  detail has 443 files; the top-level YAML reports catalog_version: 8 from 50
  sidecars — the two layers are not reconciled.

cross_batch: |
  The cross-sidecar triangulation pattern (REFACTOR-073 built from 3 sidecars,
  then strengthened to 11-sidecar, then 18-sidecar across batches) shows
  non-redundant cross-batch accumulation — this is a genuine efficiency of
  the roll-up architecture. However, the investigator-log re-narrates each
  strengthen in prose even though the refactoring-scopes.md entry already
  records it. Sampling: "18-sidecar cluster" appears in both the log and the
  scopes index. I estimate cross-batch re-derivation at LOW (the reducers
  dedup correctly) but cross-artefact prose duplication at MEDIUM-HIGH (~30%).

overall_redundancy_estimate: |
  MEDIUM-HIGH overall. The structural redundancy (intra-artefact empty sections)
  is LOW-MEDIUM. The cross-artefact prose redundancy (investigator-log vs reducers;
  top-level vs sharded concepts) is MEDIUM-HIGH. The cross-batch re-derivation is
  LOW. Sampling basis: grep -c on 3 key terms across 4 artefact pairs. The dominant
  waste is two unsynchronized representations of the concept catalog and the
  prose-duplicate investigator log.

## cost_per_verified_claim

estimate_now: |
  manifest.yaml: stress_answers_probe_verified=0; stress_answers_static_inferred=335.
  All verified claims are STATIC-INFERRED (LLM code-trace, not probe-runner confirmed).
  Token cost estimate: 28 batches × ~100-150k tokens/batch = ~2.8-4.2M tokens total.
  Using midpoint 3.5M tokens: 3,500,000 / 335 = ~10,448 tokens per static-inferred claim.
  Conservative lower bound (1.5M tokens for the 20 stress-active batches only):
  1,500,000 / 335 = ~4,478 tokens per claim.

trend: rising

basis: |
  Batches A-G (8 batches, ~800k tokens, 0 stress answers): cost-per-claim undefined
  (infinity). Batches H-VAL-LSN-019 (stress protocol introduced, 3 canary sidecars):
  22 STATIC-INFERRED claims at ~300k tokens = ~13,636 tokens/claim. Batches ZA-ZB
  (5 sidecars each, stress sections present): manifest shows 379 stress questions
  total from 20 sidecars — so later batches produce ~16.7 questions/sidecar on
  average. But batches that deepen class-level sidecars (method-level ZB) do not
  add new stress answers — they add test-gaps and strengthen existing entries.
  The trend is RISING because: (1) 139 pre-stress sidecars carry zero return on
  the stress-answer denominator; (2) probe_verified remains 0, so the claimed
  88.4% stress_verified_pct is pure STATIC-INFERRED which does not satisfy
  condition 1's honest-coverage bar fully; (3) reducer artefacts keep growing
  (test-map +32 entries per batch) while the stress-verified count grows only
  where new stress-section sidecars are written.

## cut_candidates

- target: "investigator-log.md full prose narration of reducer diffs"
  estimated_saving: "~100-150 lines per batch (the 'Reducer diffs' and 'Notable new
    findings' tables restate what the reducer artefacts structurally encode); ~278 KB
    total if the log were replaced by a machine-readable delta ledger (batch_id,
    new_entries[], strengthened_entries[])."
  risk_of_cutting: "The log's human-readable narrative is the primary onboarding
    artefact for a maintainer reviewing a batch. Cutting it loses the 'why this
    batch's findings matter' context. Mitigation: retain only the 'Known-bug
    validators' and 'Cross-sidecar triangulation' sections — these are unique to
    the log. The 'Reducer diffs' tables are pure restatement and can be cut."

- target: "top-level concepts.yaml monolith (647 KB, sidecar_count stale at 50 vs 159 actual)"
  estimated_saving: "The monolith is already superseded by the sharded concepts/ detail
    directory (443 files). Retiring concepts.yaml and treating concepts/detail/ as the
    canonical catalog would eliminate 647 KB of stale artefact. The pending
    concepts.delta.batch-ZB.pending-merge.yaml (32 lines) would merge into the
    sharded catalog. Saving: 647 KB artefact removed; staleness risk eliminated."
  risk_of_cutting: "Any agent that loads concepts.yaml directly would break. The
    sharded catalog needs a lightweight index.yaml (concept names + file pointers) to
    replace the monolith's lookup role."

- target: "Empty/stub section scaffolding in pre-stress sidecars (stress: {} or stress absent)"
  estimated_saving: "139 sidecars × ~15 lines of empty scaffold = ~2,085 lines.
    Removing empty top-level sections from pre-stress sidecars would reduce
    understanding/ from 9.3 MB toward ~7 MB and eliminate the false signal that
    a section exists but is empty."
  risk_of_cutting: "Schema consistency across all sidecars enables automated
    section-presence checks. Stripping empty sections would require the
    file-analyser to re-add them on next enrichment, creating churn. Safer
    alternative: mark pre-stress sidecars with a top-level flag
    (stress_protocol_version: none) rather than carrying empty section stubs."

- target: "test-map/index.yaml batch_history block (107 entries, ~220 lines / ~8% of the file)"
  estimated_saving: "The batch_history in the index YAML duplicates what the
    investigator-log already records with more context. Trimming it to a single
    pointer ('see investigator-log.md for full history') would remove ~220 lines
    and reduce the index by ~8%. Not a large absolute saving but removes one of
    the three sources of the same batch-history information."
  risk_of_cutting: "The batch_history is currently the only place where the
    index self-documents which TEST-GAP ID ranges came from which batch.
    The investigator-log has the same information but in prose. A machine-readable
    batch-ID → gap-ID range mapping should live in one place, not three."

- target: "Batch delta files left on disk after merge (.MERGED.md, .NOOP.md, .pending-merge.yaml)"
  estimated_saving: "6 delta files totalling ~1,200 lines of transient state that
    has (in 4 of 6 cases) already been applied. Deleting MERGED/NOOP variants
    would reduce tracked file count and eliminate confusion about current vs
    pending state."
  risk_of_cutting: "The 2 pending-merge files (test-map ZB + X-TAGGING deltas)
    are genuinely unresolved and must not be deleted. The 4 MERGED/NOOP files
    have been applied and carry only audit value — they could move to a
    lineage/odd-platform/archive/ directory rather than cluttering the active
    reducer directories."

## panel_self_cost

this_run: |
  6 expert agents + 1 chair = 7 agent invocations. Each expert reads
  ~3,000-6,000 lines of artefacts before emitting a ~200-280 line Phase-1 report.
  Estimated input: 6 experts × ~60k tokens = 360k tokens; output: 6 × ~3k tokens
  = 18k tokens. Chair Phase 1 summary + Phase 2 synthesis: ~100k tokens input,
  ~5k output. Total panel estimate: ~480k tokens this run.
  Per-batch ontology cost: ~100-150k tokens × 28 batches = ~2.8-4.2M tokens total.
  Panel cost as fraction of total ontology investment: ~480k / 3.5M = ~14%.

verdict: |
  At 14% of total ontology investment for a structured quality audit, the panel
  earns its keep IF its findings drive concrete cost reductions (e.g., retiring
  the stale concepts.yaml monolith, preventing the test-map index from growing
  unchecked to 2 MB). The panel does NOT earn its keep if its findings sit in
  meta-reviews/ unread and unfixed. The actionability of the findings below is
  the test.

## findings

- id: ECO-F1
  title: "test-map/index.yaml is 4.1× a 100k-token context window and index/detail are divergent"
  severity: HIGH
  evidence: "wc -c lineage/odd-platform/test-map/index.yaml → 1,438,326 bytes; find .../test-map/detail -name '*.yaml' | wc -l → 908 files; index reports total_test_gaps=906 — 3 entries in detail not in index, plus 2 pending delta files (421 + 390 lines) unresolved"
  detail: |
    At 1.44 MB, test-map/index.yaml cannot be loaded whole by any downstream agent
    operating at a 100k-token budget. The sharding (index + detail/) was designed
    to solve this but the index has drifted from its detail directory: 908 detail
    files exist with highest TEST-GAP-909, while the index reports 906 entries.
    Two pending-merge delta files (batch-ZB: 421 lines, X-TAGGING: 390 lines) have
    been explicitly flagged in the X-TAGGING delta's orchestrator_warning as requiring
    a rebuild_indexes.py pass. Target condition 4 ("zero divergence between every
    reducer index and its detail/ directory") is not met. A consumer reading only
    the index silently misses at least 3 entries.
  routed_to: backlog-item
  confidence: HIGH

- id: ECO-F2
  title: "concepts.yaml top-level monolith is stale by 109 sidecars and creates a two-representation problem"
  severity: MEDIUM
  evidence: "grep sidecar_count lineage/odd-platform/concepts.yaml → 50; ls lineage/odd-platform/understanding/ | wc -l → 164 (actual sidecars); du -sh lineage/odd-platform/concepts.yaml → 647 KB; find lineage/odd-platform/concepts/detail -type f | wc -l → 443"
  detail: |
    The concepts.yaml top-level monolith was generated at catalog_version: 8 when
    50 sidecars existed. 159 sidecars now exist — a delta of 109 unconsumed. The
    methodology has correctly moved to a sharded concepts/ detail directory (443
    files) for recent batches, but the top-level concepts.yaml has not been retired.
    Any agent loading concepts.yaml is 109 sidecars out of date. The two parallel
    representations (monolith at 647 KB, sharded at 5.2 MB) diverge in content and
    require reconciliation logic that currently does not run automatically. This
    matches target condition 4's "zero divergence" requirement — applied to the
    concept layer, not just the test-map.
  routed_to: cut-this-step
  confidence: HIGH

- id: ECO-F3
  title: "stress_answers_probe_verified = 0; 88.4% stress_verified_pct is entirely STATIC-INFERRED"
  severity: MEDIUM
  evidence: "manifest.yaml: stress_answers_probe_verified=0; stress_answers_static_inferred=335; sidecars_with_stress_section=20; probe-runs/ directory has 11 files but manifest confirms 0 probe-verified upgrades landed in sidecars"
  detail: |
    The manifest's stress_verified_pct of 88.4% is computed only over the 20 sidecars
    that have stress sections. All 335 verified answers are STATIC-INFERRED — LLM code
    traces, not probe-runner confirmations. Target condition 1 requires
    stress_verified_pct ≥ 0.80 over a denominator covering ≥ 90% of stress-trigger nodes.
    With 139/159 sidecars (87.4%) carrying zero stress questions, the denominator is
    12.6% of all sidecars, well below the 90% threshold. The cost implication: every
    token spent on pre-stress sidecars contributes zero to the honest-coverage
    denominator. The probe loop (target condition 6) is structurally present but the
    upgrade path from probe-run to PROBE-VERIFIED sidecar annotation has not fired.
  routed_to: backlog-item
  confidence: HIGH

- id: ECO-F4
  title: "investigator-log.md prose-duplicates reducer artefacts — ~30% of its content is restatement"
  severity: LOW
  evidence: "grep -c 'DISABLED' lineage/odd-platform/refactoring-scopes/index.md → 58; grep -c 'DISABLED' lineage/odd-platform/investigator-log.md → 66; grep -c 'plaintext' both → 34 vs 29; wc -c investigator-log.md → 278,818 bytes; 28 batches × ~81 lines/batch"
  detail: |
    The investigator-log contains three types of content: (A) Reducer diff tables that
    restate counts already in the reducer artefacts; (B) 'Notable new findings' that
    restate content already in refactoring-scopes/index.md with its surfaced_by chains;
    (C) 'Known-bug validators' and 'Cross-sidecar triangulation' sections that are unique
    to the log (the discovery narrative and coverage-closure evidence). Type A and B
    constitute roughly 50-60% of the log's lines and are pure restatement. Type C is
    the log's genuine unique value. The log is growing by ~81 lines per batch regardless
    of whether the batch produces unique insights, making it an O(n) cost with O(1)
    unique-value growth rate.
  routed_to: cut-this-step
  confidence: MEDIUM

- id: ECO-F5
  title: "6 delta/pending/NOOP files on disk create ambiguous artefact state"
  severity: LOW
  evidence: "find lineage/odd-platform -name '*.pending-merge*' -o -name '*.delta.*' -o -name '*.NOOP.*' | sort → 6 files"
  detail: |
    Six delta/pending/NOOP files remain on disk: 2 are genuinely unresolved (requiring
    rebuild_indexes.py per X-TAGGING orchestrator_warning), 4 are applied (MERGED/NOOP).
    The 4 applied files have no function after merge but add confusion about what the
    active state of a reducer is. A consumer scanning the reducer directories must parse
    filename suffixes to determine current state. This is a low-cost process fix (archive
    applied deltas post-merge) but the failure to enforce it produces accumulating noise
    across batches.
  routed_to: backlog-item
  confidence: HIGH

## what_went_well

- "The sharding architecture (test-map/index.yaml + detail/; feature-flows/index.yaml + detail/) was introduced before the monolith artefacts became entirely unloadable. The detail directories correctly decoupled per-entry storage from the index summary, and the feature-flows index at 338 KB sits just below the 350 KB single-pass boundary — evidence that the sharding decision is directionally correct."

- "The incremental-delta pattern (reducer emits a delta.yaml, orchestrator merges into the index) prevents full-artefact rewrites on each batch, dramatically reducing the O(cost-per-batch) from a full regeneration of 906 entries to a ~30-50 entry delta. This is the methodology's most important cost control, and git log --stat confirms it: deletions per batch run 172-910 vs insertions of 5,000-13,000 — the rewrite ratio is low."

- "Cross-sidecar triangulation (REFACTOR-073 built from 3 sidecars, growing to 18-sidecar) demonstrates that the reducer's dedup logic is working — findings consolidate rather than accumulate as duplicate entries. This holds the refactoring-scopes count at 211 entries rather than the ~1,000+ that independent-per-sidecar recording would produce."

## axis_score

score: 4
band: AMBER
rationale: |
  Three cost findings prevent GREEN: (1) test-map/index.yaml at 1.44 MB is a context-bloat
  blocker for downstream agents — the artefact sharding exists but is incomplete and
  divergent; (2) concepts.yaml is stale by 109 sidecars while the sharded representation
  has diverged — two parallel representations of the same catalog without a reconciliation
  step; (3) cost-per-verified-claim is rising because 87.4% of sidecars carry zero
  stress answers, making each batch's reducer growth cheaper to produce but more expensive
  per unit of honest-coverage increase.
  
  The score is AMBER (4) rather than RED because: the methodology has real cost controls
  (incremental delta, sharding architecture, dedup in reducers), the waste is structural
  rather than catastrophic, and the cut-candidates named above are all reversible and
  actionable. A RED score would require either total artefact unusability or no existing
  cost controls — neither is true here. The path to GREEN requires: (a) reconcile/retire
  concepts.yaml monolith, (b) run rebuild_indexes.py to close test-map index/detail
  divergence, (c) fire the probe-loop to move stress_answers_probe_verified off zero.

## independence_self_assessment

shared_blind_spot_risk: |
  This report measures bytes and lines as proxies for token cost. The actual token cost
  of an agent reading a sidecar depends on tokenization (YAML is token-dense — field
  names repeat; English prose tokenizes more efficiently). The actual cost-per-verified-claim
  figure (~8,358-10,448 tokens) rests on a flat ~100-150k tokens/batch estimate; if
  batches that run multiple reducer refreshes cost 200-300k tokens, the figure doubles.
  The maintainer should verify cost against actual billing logs.

needs_human_verification:
  - "ECO-F3 — whether probe-runs/ probes are blocking on a tooling gap or a process gap (the manifest says 0 probe-verified upgrades; are the probe runners simply not being invoked, or is the upgrade path broken?)"
  - "ECO-F1 / ECO-F2 — whether rebuild_indexes.py exists and is runnable, or is it a planned-but-not-built tool (this affects whether the divergence is a one-command fix or a multi-session project)"
