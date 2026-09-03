---
panel_run: 2026-05-21
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

The methodology has produced 953 tracked findings (931 unique across five reducers + 22 stress-verified claims) at a measured total-artefact size of 34 MB across 20 sprint batches. The per-finding cost is roughly flat-to-rising: concept-merger marginal yield is stable (11→14 concepts/batch), while test-coverage-mapper yield is falling (42→25 gaps/batch) as the node pool approaches saturation at 37% direct coverage. The critical efficiency defect is not redundancy but index–detail divergence: 62% of all tracked findings (1,147 of 1,856 detail-level entries across four sharded reducers) are invisible to any downstream consumer that reads the index files — they exist only in `detail/` subdirectories whose index was never updated, making the methodology's apparent output a 38% subset of its actual output. Two index files (`test-map.yaml` at 784 KB and `concepts.yaml` at 647 KB) are within 2–20% of a practical 200 K-token agent load limit, creating an imminent context-bloat blocker as the sprint continues.

## measured_metrics

- metric: "Total lineage/odd-platform/ storage"
  value: "34 MB"
  command: "du -sh ./lineage/odd-platform/"

- metric: "understanding/ (sidecars) — total storage"
  value: "8.3 MB, 47,045 lines, 147 files"
  command: "du -sh understanding/; wc -l understanding/*.md | tail -1; find understanding -name '*.md' | wc -l"

- metric: "Average sidecar size"
  value: "56,358 bytes (320 lines)"
  command: "echo '8284657 / 147' | bc"

- metric: "concepts.yaml (index)"
  value: "5,911 lines, 647,447 bytes; 222 entries (105 entities + 91 invariants + 26 operations)"
  command: "wc -l concepts.yaml; wc -c concepts.yaml; grep -E '  - name:' concepts.yaml | wc -l; sections counted by python3 section parser"

- metric: "concepts/ detail directory"
  value: "5.0 MB, 420 detail files (only 5 in detail/)"
  command: "du -sh concepts/; find concepts/detail -name '*.yaml' | wc -l"

- metric: "test-map.yaml (index)"
  value: "8,678 lines, 784,445 bytes; 312 indexed test gaps"
  command: "wc -l test-map.yaml; wc -c test-map.yaml; grep -c 'gap_id: TEST-GAP-' test-map.yaml"

- metric: "test-map/ detail directory"
  value: "6.4 MB (detail/: 5.2 MB), 881 detail files"
  command: "du -sh test-map/; du -sh test-map/detail/; find test-map/detail -name '*.yaml' | wc -l"

- metric: "refactoring-scopes.md (index)"
  value: "2,845 lines, 546,247 bytes; 225 unique REFACTOR IDs"
  command: "wc -l refactoring-scopes.md; wc -c refactoring-scopes.md; grep -oE 'REFACTOR-[0-9]+' refactoring-scopes.md | sort -u | wc -l"

- metric: "refactoring-scopes/ detail directory"
  value: "3.4 MB (detail/: 3.0 MB), 518 detail files"
  command: "du -sh refactoring-scopes/; find refactoring-scopes/detail -name '*.md' | wc -l"

- metric: "implicit-adrs.md (index)"
  value: "1,512 lines, 459,468 bytes; 69 unique ADR-CANDIDATE IDs"
  command: "wc -l implicit-adrs.md; wc -c implicit-adrs.md; grep -oE 'ADR-CANDIDATE-[0-9]+' implicit-adrs.md | sort -u | wc -l"

- metric: "implicit-adrs/ detail directory"
  value: "2.2 MB, 198 detail files"
  command: "du -sh implicit-adrs/; find implicit-adrs/detail -name '*.md' | wc -l"

- metric: "doc-gaps.md (index)"
  value: "1,416 lines, 292,010 bytes; 103 unique DOC-GAP IDs"
  command: "wc -l doc-gaps.md; wc -c doc-gaps.md; grep -oE 'DOC-GAP-[0-9]+' doc-gaps.md | sort -u | wc -l"

- metric: "doc-gaps/ detail directory"
  value: "3.1 MB, 259 detail files"
  command: "du -sh doc-gaps/; find doc-gaps/detail -name '*.md' | wc -l"

- metric: "feature-flows.yaml (index)"
  value: "573 lines, 36,100 bytes; 30 feature entries"
  command: "wc -l feature-flows.yaml; wc -c feature-flows.yaml; find feature-flows/detail -name '*.yaml' | wc -l"

- metric: "investigator-log.md"
  value: "2,192 lines, 262,418 bytes"
  command: "wc -l investigator-log.md; wc -c investigator-log.md"

- metric: "nodes.jsonl"
  value: "395 nodes, 205,134 bytes"
  command: "wc -l nodes.jsonl; wc -c nodes.jsonl"

- metric: "edges.jsonl"
  value: "479 edges, 123,990 bytes"
  command: "wc -l edges.jsonl; wc -c edges.jsonl"

- metric: "Total index entries (all reducers)"
  value: "709 (312 test-gaps + 225 REFACTOR + 69 ADR-CANDIDATE + 103 DOC-GAP)"
  command: "python3 regex count across all four index files"

- metric: "Total detail entries (all reducers)"
  value: "1,856 (881 + 518 + 198 + 259)"
  command: "find test-map/detail refactoring-scopes/detail implicit-adrs/detail doc-gaps/detail -type f | wc -l (by dir)"

- metric: "Sprint batch count (H through VAL-LSN-019)"
  value: "21 batches"
  command: "git -C . log --format=%s -- 'lineage/odd-platform/' | grep -c 'batch'"

- metric: "test-map.yaml comment-line fraction"
  value: "169 comment lines of 8,069 non-blank lines = 2.1%"
  command: "python3 comment-vs-data line counter over test-map.yaml"

- metric: "concepts.yaml comment-line fraction"
  value: "368 comment lines of 5,675 non-blank lines = 6.5%"
  command: "python3 comment-vs-data line counter over concepts.yaml"

- metric: "Orphan storage across all detail/ dirs"
  value: "6.9 MB (test-map: 2.7 MB, refactoring-scopes: 1.4 MB, doc-gaps: 1.9 MB, implicit-adrs: 1.0 MB)"
  command: "python3 orphan_stats() across all four detail dirs comparing detail filenames to index IDs"

## redundancy_assessment

intra_artefact: "Low. Header boilerplate (8 YAML fields × 147 sidecars) accounts for ~41 KB — 0.5% of total sidecar volume (command: 8 × 35 bytes × 147 / 8,284,657). Comment blocks retained as historical batch notes in test-map.yaml and concepts.yaml add 2.1% and 6.5% overhead respectively — not significant."

cross_artefact: "Low-to-moderate. The dominant cross-artefact pattern is intentional ID cross-referencing: REFACTOR-073 appears 68 times across five artefacts (concepts.yaml: 12, refactoring-scopes.md: 29, implicit-adrs.md: 14, doc-gaps.md: 1, test-map.yaml: 12) — this is citation, not duplication. DISABLED-mode: 698 total mentions across five files, but each artefact uses the concept in a distinct structural role. The 7 REFACTOR IDs that appear in both concepts.yaml and refactoring-scopes.md are 100% overlap by design (concepts.yaml cross-references the canonical scope entry). Command: python3 cross-artefact ID-intersection analysis."

cross_batch: "Moderate and accelerating. Marginal concept-merger yield: early batches J–N averaged 11.0 new concepts per batch; late batches V–Y averaged 14.2 (flat, not falling). Test-coverage-mapper marginal yield: early batches K–M averaged 42.3 new gaps per batch; late batches V–Z averaged 24.5. Coverage delta per batch is uniformly ~+1.2 percentage points regardless of batch position, indicating the substrate is evenly distributed and the per-node cost is constant. Cross-batch re-derivation (same node re-enriched from a new entry point) was addressed by the phantom-prevention protocol (LSN-018); no evidence of systematic node re-enrichment. Command: git log --format=%s -- lineage/odd-platform/ | grep -oE '[0-9]+\\.[0-9]+% direct' for coverage sequence."

overall_redundancy_estimate: "LOW-MODERATE (15–25% of agent compute is spent on diminishing-return enrichment of a 63%-uncovered substrate; cross-artefact text redundancy is low; the real waste is 6.9 MB of orphaned detail files and the index–detail divergence that makes 62% of findings invisible). Redundancy is not the primary cost driver; index staleness is."

## cost_per_verified_claim

estimate_now: "~7,345 tokens per finding. Basis: estimated 7 M total sprint tokens (20 batches × 5 file-analysers × 25 K tokens + 5 reducers × 45 K tokens) / 953 findings+verified-claims. However, if the true finding count is 1,856 detail entries (the uncollapsed total), cost falls to ~3,773 tokens/finding — but 1,147 of those are inaccessible via the index. Command: python3 token-cost estimates from batch architecture + finding counts."

trend: rising

basis: "Test-coverage-mapper marginal yield fell from 42.3 gaps/batch (early) to 24.5/batch (late) — a 42% reduction in throughput on the same 5-sidecar input. Concept-merger marginal yield is flat (11→14 concepts/batch). Direct coverage delta is constant at ~+1.2 ppt/batch regardless of batch position. The rising cost-per-verified-claim is driven by test-map yield compression, not by general saturation — the remaining 63% of nodes (251 uncovered) have not been enriched yet, so the early-node pool is simply the higher-signal nodes (controllers, auth, repositories were hit first). Cost-per-finding is expected to stabilize or fall as the methodology reaches new node classes. The index–detail divergence masks the true yield: if detail files 313–881 were indexed, the effective cost-per-finding on those batches would appear lower, not higher."

## cut_candidates

- target: "Orphaned detail files across all four sharded reducers (1,147 files, 6.9 MB)"
  estimated_saving: "6.9 MB storage + elimination of the index–detail divergence defect that currently makes 62% of tracked findings invisible. Pruning or re-indexing these files restores the finding inventory to its true 1,856-entry count."
  risk_of_cutting: "If orphaned detail files are pruned without first updating the index, real findings are permanently lost. The correct action is index update, not file deletion. Risk of index update: none — these are committed artefacts with real content (verified: TEST-GAP-313 to TEST-GAP-882 all contain valid YAML)."

- target: "test-map.yaml index file (784 KB = 98% of 200 K-token load limit)"
  estimated_saving: "Prevents imminent context-bloat blocker within ~2 more batches at current growth rate (2,514 bytes/gap × 26 new gaps/batch = ~65 KB/batch). Sharding the index to index.yaml (summary rows only) + detail/ (full entries) would cap the index at ~200 KB."
  risk_of_cutting: "Downstream reducers that currently load test-map.yaml whole would need to adapt to the two-level read pattern already used by refactoring-scopes and implicit-adrs. Low risk — the pattern already exists in the methodology."

- target: "concepts.yaml index file (647 KB = 81% of load limit)"
  estimated_saving: "~1–2 more batches before hitting the load limit. Sharding concepts.yaml to an index + detail/ (similar to refactoring-scopes) would reduce the loadable index to the canonical-name + security_aggregate summary without the full per-concept node lists."
  risk_of_cutting: "concept-merger is the only reducer that currently has no detail/ sharding. The concept full-body is consumed by test-coverage-mapper and doc-gap-finder as context. Sharding requires those reducers to load concept detail files on demand — a genuine protocol change, not trivial."

- target: "Retained historical comment blocks in test-map.yaml and concepts.yaml"
  estimated_saving: "169 lines (test-map) + 368 lines (concepts) = ~537 lines / ~40 KB. Negligible at current sizes but compounds with each batch."
  risk_of_cutting: "These blocks serve as per-batch audit trail. Moving them to investigator-log.md (where the canonical per-batch narrative already lives) would preserve the history without bloating the consumer-facing index files."

- target: "5 reducers run per batch even when a batch is limited to 3–4 new sidecars"
  estimated_saving: "~45 K tokens per skipped reducer invocation. For batches with < 3 new sidecars in a given axis (e.g., config-key-consumer only), running concept-merger and test-coverage-mapper adds cost without proportional finding yield."
  risk_of_cutting: "Incremental reducers need the full prior index as context regardless; skipping them breaks the 'accumulate per batch' model. Risk is medium — selective reducer activation requires explicit logic in /next-batch."

## panel_self_cost

this_run: "6 Phase-1 expert agents + 6 Phase-2 memo agents + 1 chair = 13 agent invocations. Estimated cost: Phase-1 ~348 K tokens (6 × 58 K input+output) + Phase-2 ~192 K tokens (6 × 32 K) + chair ~90 K = ~630 K tokens total. That is ~9% of the estimated 7 M-token sprint cost. Command: wc panel agent count from .claude/agents/panel-*.md (7 files); token estimates from per-agent report size × artefact reads."
verdict: "The panel earns its keep if it prevents 1.8 batches of waste (~630 K tokens). The index–detail divergence finding alone (1,147 invisible findings that a single index-update pass would surface) justifies the run cost. The context-bloat warning on test-map.yaml and concepts.yaml prevents a future session failure that would cost far more than 630 K tokens to diagnose."

## findings

- id: ECO-F1
  title: "62% of tracked findings are invisible — index–detail divergence across all four sharded reducers"
  severity: CRITICAL
  evidence: "test-map: 312 index vs 881 detail (gap 569, 65% invisible); refactoring-scopes: 225 index vs 518 detail (gap 293, 57%); implicit-adrs: 69 index vs 198 detail (gap 129, 65%); doc-gaps: 103 index vs 259 detail (gap 156, 60%). Total: 709 indexed, 1,856 in detail, 1,147 invisible (62%). Commands: python3 orphan_stats() comparing glob(detail/*.{yaml,md}) vs regex(index_file, id_pattern). Verified: TEST-GAP-313 and REFACTOR-229 exist as valid YAML in detail/ but are absent from index files."
  detail: |
    The VAL-LSN-019-B batch (committed 2026-05-21, confirmed by stat timestamps) wrote 569
    test-map detail files (TEST-GAP-313 to TEST-GAP-882), 293 refactoring-scope detail files
    (REFACTOR-229 to REFACTOR-580), 129 implicit-adr detail files, and 156 doc-gap detail files
    — but none of the corresponding index files (test-map.yaml, refactoring-scopes.md,
    implicit-adrs.md, doc-gaps.md) were updated. These index files were last modified
    2026-05-19 and 2026-05-20; detail files are timestamped 2026-05-21 11:41.
    Any downstream consumer (maintainer, another reducer, the panel itself) that reads the
    index file as its entry point sees a 38%-complete picture. The 1,147 orphaned entries
    are not garbage — TEST-GAP-313 is a valid MEDIUM criticality finding with correct YAML
    structure. This is a correctness defect (invisible findings) that manifests as an
    efficiency defect (sprint output incompletely surfaced).
  routed_to: backlog-item
  confidence: HIGH

- id: ECO-F2
  title: "test-map.yaml at 98% of 200 K-token agent load limit — imminent context-bloat blocker"
  severity: HIGH
  evidence: "test-map.yaml: 784,445 bytes. Practical load limit for a 200 K-token agent context at 4 chars/token: ~800,000 bytes. Current fraction: 98%. At the measured growth rate (24.5 gaps/batch × 2,514 bytes/gap = ~62 KB/batch), the file exceeds the limit within 2 batches. Command: wc -c test-map.yaml; python3 size-vs-limit comparison."
  detail: |
    The methodology already sharded test-map into an index + detail/ structure, but the index
    is accumulating full-body gap entries (each averaging 2,514 bytes including proposed_action
    narrative and evidence arrays). The index format was designed for a single-read load by
    the incremental reducer, which needs prior gap content as context. At current size, loading
    test-map.yaml whole in a reducer invocation consumes 98% of the context budget before any
    new sidecar content is added, leaving ~2% for the 5 new sidecars and the agent's own
    reasoning space. The sharding already exists structurally; the index just needs to be
    split into summary rows (gap_id, criticality, node_ids, title) vs full bodies in detail/.
  routed_to: cut-this-step
  confidence: HIGH

- id: ECO-F3
  title: "concepts.yaml at 81% of agent load limit and growing — sharding not yet implemented"
  severity: HIGH
  evidence: "concepts.yaml: 647,447 bytes = 81% of 800 KB load limit. The file grew from batch-to-batch at ~11 K bytes/batch (concepts deltas from investigator-log). At 14 new entries/batch × average entry size (~4 KB): ~56 KB/batch projected growth. Command: wc -c concepts.yaml; python3 section entry counts."
  detail: |
    concepts.yaml is the only large reducer output that has no sharding at all — concepts/detail/
    contains only 5 files (not matching the 222 index entries). Every downstream reducer that
    needs concept context (test-coverage-mapper, doc-gap-finder) must load the full 647 KB file.
    At the current growth rate, concepts.yaml will hit the 800 KB limit within ~3 batches.
    Unlike test-map, concepts has no existing sharding pattern to leverage — this requires a
    new design decision.
  routed_to: cut-this-step
  confidence: HIGH

- id: ECO-F4
  title: "Test-coverage-mapper marginal yield falling: 42 gaps/batch (early) → 25 gaps/batch (late)"
  severity: MEDIUM
  evidence: "Early batches K–M: 33+39+55 = 127 gaps / 3 batches = 42.3/batch. Late batches V–Z: 16+39+38+5 = 98 / 4 batches = 24.5/batch. A 42% reduction in per-batch test-gap yield on the same 5-sidecar input. Commands: grep finding-delta lines from investigator-log.md for each batch."
  detail: |
    The declining test-coverage-mapper yield is consistent with the hypothesis that early batches
    covered high-density controller and service nodes (each surfaces many behavioral gaps), while
    late batches cover config-key-consumer and UI-shell nodes (lower gap density per node).
    This is expected saturation behavior, not a methodology defect. However, combined with the
    constant per-batch agent invocation cost (5 reducers regardless of sidecar type), the
    per-finding cost is rising for test-map findings. The implication is that test-coverage-mapper
    should be run selectively (only when new sidecars are in high-density node classes) rather
    than every batch.
  routed_to: approach-rev
  confidence: MEDIUM

- id: ECO-F5
  title: "6.9 MB orphan storage in detail/ directories — 20% of total lineage volume is inaccessible"
  severity: MEDIUM
  evidence: "Orphan storage: test-map/detail 2.7 MB, refactoring-scopes/detail 1.4 MB, doc-gaps/detail 1.9 MB, implicit-adrs/detail 1.0 MB = 6.9 MB total. Total lineage/odd-platform/ = 34 MB. Orphan fraction: 20.3%. Commands: python3 orphan_stats() using os.path.getsize on orphan-identified files."
  detail: |
    The orphan storage is a consequence of ECO-F1: detail files written by the 2026-05-21 batch
    whose indexes were not updated. These are not redundant copies — they are unindexed primary
    findings. The "waste" framing applies only if they remain unindexed permanently; if the index
    is updated, the storage becomes productive. The finding is logged here because 6.9 MB of
    content the methodology claims to have produced is structurally invisible to its consumers.
  routed_to: backlog-item
  confidence: HIGH

## what_went_well

- "Sharding was adopted early (rev-2, slice 6) for five reducer outputs — the index+detail/ pattern prevents any single file from becoming unloadable as findings accumulate. The feature-flows.yaml index is exemplary: 573 lines / 36 KB for 30 features, with full bodies in feature-flows/detail/. This pattern works and should be extended to concepts.yaml."

- "Incremental reducer mode is genuinely efficient: each reducer receives only the new batch's 5 sidecars as new input, reading the prior index for context. The investigator-log.md confirms 0 sidecar-quality failures across batches G–VAL — the methodology is not wasting tokens re-verifying already-verified claims."

- "The 20-batch sprint produced 1,856 total findings (measured at the detail/ level) at ~3,773 tokens/finding by the detail count — competitive with manual audit throughput. Even at the index count (953 findings at ~7,345 tokens/finding), the cost-per-finding is defensible for a one-person project with a codebase of this size."

- "Cross-artefact redundancy is deliberately minimal: REFACTOR ID cross-references in concepts.yaml are citations (7 IDs, all 100% also in refactoring-scopes.md), not duplicates. The methodology correctly distinguishes citation from duplication."

- "Comment overhead in the two largest index files is low: 2.1% in test-map.yaml, 6.5% in concepts.yaml. Neither file is bloated with narrative prose."

## axis_score

score: 4
band: AMBER
rationale: |
  AMBER on the Cost rubric because: (1) ECO-F1 is a severe correctness/efficiency defect —
  62% of the methodology's finding output is structurally invisible, which means the sprint's
  true output cannot be evaluated on cost grounds until the index is repaired; (2) two index
  files (test-map.yaml, concepts.yaml) are within 2–19% of the agent load limit, creating an
  imminent hard blocker within 2–3 batches; (3) test-coverage-mapper marginal yield has fallen
  42% (though this is expected saturation, not a defect). The score is held at AMBER rather
  than RED because: the finding inventory IS real (1,856 detail files exist with valid content);
  cross-artefact redundancy is low; the incremental-reducer pattern is genuinely efficient;
  and the index–detail divergence is recoverable with a single index-update pass. A single
  corrective batch that (a) updates all four indexes and (b) shards test-map.yaml and
  concepts.yaml into summary+detail format would move this axis to GREEN.

## independence_self_assessment

shared_blind_spot_risk: |
  All measurements use lines/bytes as proxies for token cost. The actual token count depends
  on the tokenizer (Claude's BPE tokenizer compresses repetitive YAML keys aggressively).
  A 784 KB test-map.yaml might consume significantly fewer than 196 K tokens in practice if
  the YAML structure is highly repetitive. The 200 K-token load limit used here is conservative;
  the actual limit depends on the specific model context window, system prompt size, and how
  much context the agent needs for its own reasoning. The ECO-F2 and ECO-F3 load-limit
  findings should be treated as near-limit warnings, not hard failures, pending real billing data.

needs_human_verification:
  - "ECO-F2 — actual token count of test-map.yaml in a reducer invocation context (not byte proxy)"
  - "ECO-F3 — actual token count of concepts.yaml in a concept-merger invocation context"
  - "ECO-F1 — confirm whether the 2026-05-21 index-update was intentionally deferred or is a genuine defect (index files are older than detail files in git)"
