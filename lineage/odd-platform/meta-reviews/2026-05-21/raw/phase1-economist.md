---
panel_run: 2026-05-21
phase: 1
expert: panel-economist
axis: Cost
commit_anchor: ede5d277
prompt_version: panel-economist/0.1.0
cost_trend: rising
axis_score: 5
axis_band: AMBER
---

# Phase 1 — Economist (Cost) assessment

## summary

The methodology has produced 1,856 tracked findings at 34 MB total. The 62%-invisible
defect from the maiden run has been partially resolved: 25.8% orphaned now (480/1,856),
down from 62%. However two new blockers have replaced it: test-map/index.yaml is at 157%
of the 800 KB agent load limit (a hard stop today, not a warning), and concepts/index.yaml
is frozen at sidecar_count 55 while 147 sidecars exist — 92 sidecars of concept extraction
absent from the catalog. The Cost score rises from AMBER-4 to AMBER-5 because the dominant
maiden defect improved substantially, but two high-severity blockers independently threaten
continued operation.

## target_lens

The target's Cost-axis condition is Condition 4: zero index–detail divergence. The
economist's bar extends to: (a) no single artefact may exceed the agent load limit —
a reducer that cannot load its prior state cannot produce incremental output; (b) the
concept catalog must be current so downstream reducers (test-coverage-mapper, doc-gap-finder)
rank findings on a complete concept graph; (c) the 29-batch backfill needed to hit
stress_verified_pct ≥ 0.80 across all 144 sidecars must be affordable with the current
reducer infrastructure. On all three counts the methodology is not yet on target.

## measured_metrics

- metric: "Total lineage/odd-platform/ storage"
  value: "34 MB"
  command: "du -sh lineage/odd-platform/"

- metric: "Sidecars (understanding/) — 147 files, 8.3 MB, 47,045 lines"
  command: "du -sh understanding/; find understanding -name '*.md' | wc -l; wc -l understanding/*.md | tail -1"

- metric: "test-map/index.yaml"
  value: "23,365 lines; 1,257,706 bytes (157% of 800 KB limit); 864 indexed entries"
  command: "wc -l test-map/index.yaml; wc -c test-map/index.yaml; grep -c 'gap_id: TEST-GAP-' test-map/index.yaml"

- metric: "test-map/detail files"
  value: "881 files; orphans = 17 (1.9%)"
  command: "find test-map/detail -name '*.yaml' | wc -l; echo '881-864'"

- metric: "concepts/index.yaml"
  value: "9,456 lines; 446,738 bytes (56% of limit); catalog_version 9; sidecar_count 55 (stale — actual 147)"
  command: "wc -l concepts/index.yaml; wc -c concepts/index.yaml; grep 'catalog_version:\\|sidecar_count:' concepts/index.yaml"

- metric: "concepts/detail files"
  value: "431 files across 5 subdirs (entities:62 invariants:208 operations:82 audiences:13 canonicalisation:66)"
  command: "find concepts/detail -type f | wc -l"

- metric: "refactoring-scopes/index.md"
  value: "3,446 lines; 436,078 bytes; 240 unique IDs indexed; 518 detail files; orphans = 278 (53.7%)"
  command: "wc -l refactoring-scopes/index.md; wc -c refactoring-scopes/index.md; grep -oE 'REFACTOR-[0-9]+' refactoring-scopes/index.md | sort -u | wc -l; find refactoring-scopes/detail -name '*.md' | wc -l"

- metric: "implicit-adrs/index.md"
  value: "1,471 lines; 354,460 bytes; 75 unique IDs indexed; 198 detail files; orphans = 123 (62.1%)"
  command: "wc -l implicit-adrs/index.md; wc -c implicit-adrs/index.md; grep -oE 'ADR-CANDIDATE-[0-9]+' implicit-adrs/index.md | sort -u | wc -l; find implicit-adrs/detail -name '*.md' | wc -l"

- metric: "doc-gaps/index.md"
  value: "1,849 lines; 94,519 bytes; 197 unique IDs indexed; 259 detail files; orphans = 62 (23.9%)"
  command: "wc -l doc-gaps/index.md; wc -c doc-gaps/index.md; grep -oE 'DOC-GAP-[0-9]+' doc-gaps/index.md | sort -u | wc -l; find doc-gaps/detail -name '*.md' | wc -l"

- metric: "Total index–detail divergence (four sharded reducers)"
  value: "1,376 indexed / 1,856 detail; 480 orphans (25.8%)"
  command: "per-reducer orphan counts summed; pct = 480*100/1856 via bc"

- metric: "feature-flows/index.yaml"
  value: "6,775 lines; 326,330 bytes (41% of limit); 30 features; 0 orphans"
  command: "wc -l feature-flows/index.yaml; wc -c feature-flows/index.yaml; find feature-flows/detail -name '*.yaml' | wc -l"

- metric: "manifest.yaml — stress coverage"
  value: "stress_verified_pct 88% over 25 questions from 3 sidecars; 141/144 sidecars pre-stress-protocol"
  command: "cat manifest.yaml coverage_metrics section"

- metric: "Non-canonical scratch files committed in lineage/"
  value: "8 files (*.tmp, *.append, *.batch-*, *.delta.*, *.head)"
  command: "find lineage/odd-platform -maxdepth 4 -type f -name '*.tmp*' -o -name '*.append' -o -name '*.batch-*' -o -name '*.delta.*' -o -name '*.head' | wc -l"

## redundancy_assessment

intra_artefact: "Low. Header boilerplate (implicit_adrs: + tests_coverage_semantic: in all 147
sidecars) ≈ 41 KB = 0.5% of 8.3 MB sidecar volume. Commands: grep -rl 'implicit_adrs:'
understanding/ | wc -l → 147; grep -rl 'tests_coverage_semantic:' understanding/ | wc -l → 147."

cross_artefact: "Low. 150 strengthen/rediscovery mentions in investigator-log (command: grep -c
'strengthen\\|rediscovery\\|VALIDATED' investigator-log.md → 150) are deliberate citation chains.
feature-flows/index.yaml at 326 KB carries full layer breakdowns rather than summary stubs —
primary inflation vector here."

cross_batch: "Moderate and structural. Concepts frozen at sidecar_count 55 while 147 exist (92
sidecars unprocessed). Coverage delta held constant at ~+1.0–1.2 pp/batch through final batches
(batch Z: 35.2%, batch ZA: 36.2%) — substrate is evenly distributed; per-node cost is constant.
480 orphan detail files are a structural symptom of incomplete index refresh, not re-derivation."

overall_redundancy_estimate: "LOW-MODERATE (15–20% of artefact volume is inaccessible orphan
content; true text-level redundancy is low; primary waste is structural inaccessibility and
stale reducer state)."

## cost_per_verified_claim

estimate_now: "~5,100 tokens per INDEXED finding. Basis: 7 M total sprint tokens (28 batches
× ~250 K tokens/batch) / 1,376 indexed findings = ~5,087 tokens/finding. At detail-file count:
~3,771 tokens/finding. The 41% gap between these two numbers quantifies the indexing debt."

trend: rising

basis: "Marginal test-coverage-mapper yield: batches K–M averaged ~42 gaps/batch; batches
V–VAL-LSN-019 averaged ~18 gaps/batch (batch Z: +21, ZA: +19, VAL-LSN-019: +13) — 57%
throughput reduction on same 5-sidecar input. Direct coverage increment: ~+1.0 pp/batch in
final batches vs ~+1.3 pp early. Concept-merger non-functional for final sprint batch (ZA).
Per-batch reducer overhead constant at ~5 × 45 K tokens = 225 K tokens/batch regardless of
sidecar density."

## cut_candidates

- target: "test-map/index.yaml — split to summary-row index + full bodies stay in detail/"
  estimated_saving: "Reduces index from 1.26 MB to ~200 KB. Each entry: ~1,460 bytes → ~80 bytes
  summary row = 94% reduction. Unblocks the next reducer invocation today."
  risk_of_cutting: "Medium. The incremental reducer needs prior gap content as context; it would
  shift to loading detail files on demand. The pattern already exists in four other reducers."

- target: "concepts/index.yaml — run concept-merger over 92 unprocessed sidecars then shard"
  estimated_saving: "Restores criticality ranking inputs for test-coverage-mapper and doc-gap-finder.
  After update, shard to summary index + concepts/detail/ to cap future growth."
  risk_of_cutting: "None for the update; medium for the shard (downstream reducers load the full
  file today)."

- target: "refactoring-scopes + implicit-adrs — index-rebuild for 401 orphan detail files"
  estimated_saving: "Surfaces 401 real findings (REFACTOR-241..518 + ADR-CANDIDATE-076..198)
  at near-zero token cost — no new sidecars needed."
  risk_of_cutting: "Zero information loss. Rebuild only; detail files are committed and valid."

- target: "8 committed scratch files (*.tmp, *.append, *.batch-*) — prune after verifying
  no content absent from canonical index"
  estimated_saving: "~50–100 KB + cognitive load. inspect test-map/index.delta.yaml first."
  risk_of_cutting: "Low; verify test-map/index.delta.yaml does not carry unindexed entries."

## panel_self_cost

this_run: "13 agent invocations (6 Phase-1 + 6 Phase-2 + 1 chair). Estimated ~770 K tokens
(Phase-1 ~420 K + Phase-2 ~240 K + chair ~110 K). ~22% higher than maiden 7-invocation run;
~11% of 7 M-token sprint total."
verdict: "Earns its keep. ECO-F1 (test-map hard stop) identifies a blocker that would otherwise
halt the next batch's reducer mid-run. Preventing one wasted reducer batch saves ~225 K tokens —
a positive return on the 770 K run cost when the remaining findings justify continued enrichment."

## findings

- id: ECO-F1
  title: "test-map/index.yaml at 157% of agent load limit — hard stop for next batch"
  severity: CRITICAL
  evidence: "1,257,706 bytes (command: wc -c test-map/index.yaml). 800 KB limit at 200 K tokens
  × 4 bytes/token. Current: 157%. Grew 60% since maiden (784,445 bytes → 1,257,706 bytes)
  in 8 batches."
  detail: |
    Maiden ECO-F2 warned this file would hit the limit within 2 batches; it did. The incremental
    test-coverage-mapper must load test-map/index.yaml whole before processing new sidecars.
    At 1.26 MB, loading it alone exhausts the context budget before any sidecar content arrives.
    The sharding structure already exists (detail/ has 881 files); the index needs to emit summary
    rows only. This is the highest-priority action before any further enrichment batch.
  routed_to: cut-this-step
  confidence: HIGH

- id: ECO-F2
  title: "concepts/index.yaml frozen at sidecar_count 55 — 92 sidecars of concept deltas absent"
  severity: HIGH
  evidence: "manifest.yaml nodes_with_own_sidecar: 144 (command: grep nodes_with_own_sidecar
  manifest.yaml). concepts/index.yaml sidecar_count: 55 (command: grep sidecar_count
  concepts/index.yaml). Batch ZA investigator-log: 'concept-merger FAILED (socket error) —
  backfill candidate for next batch.' VAL-LSN-019 added 7 entries from 3 sidecars but did
  not backfill the 86-sidecar gap."
  detail: |
    The catalog powers criticality ranking for test-coverage-mapper and doc-gap-finder. With
    92 sidecars unprocessed, these reducers rank gaps against a partial concept graph. The
    431 detail files under concepts/detail/ reflect only 55 of 147 sidecars. After the backfill
    run, shard concepts/index.yaml to a summary index + concepts/detail/ to prevent breaching
    the load limit as the catalog grows.
  routed_to: backlog-item
  confidence: HIGH

- id: ECO-F3
  title: "refactoring-scopes (53.7%) and implicit-adrs (62.1%) remain severely orphaned"
  severity: HIGH
  evidence: "refactoring-scopes: 240 indexed / 518 detail → 278 orphans. implicit-adrs:
  75 indexed / 198 detail → 123 orphans. Commands: grep -oE 'REFACTOR-[0-9]+' index.md |
  sort -u | wc -l; find detail -name '*.md' | wc -l — for each reducer."
  detail: |
    Batch ZA investigator-log explicitly records '256 detail-without-index in refactoring-scopes;
    110 in implicit-adrs' as known follow-ups — these are unresolved pre-existing debts, not
    regressions from this batch. REFACTOR-241 through REFACTOR-518 and ADR-CANDIDATE-076
    through ADR-CANDIDATE-198 are real findings invisible to index consumers. An index-rebuild
    pass surfaces 401 findings at near-zero token cost.
  routed_to: backlog-item
  confidence: HIGH

- id: ECO-F4
  title: "feature-flows/index.yaml approaching load limit (41%) with no sharding plan"
  severity: MEDIUM
  evidence: "326,330 bytes (command: wc -c feature-flows/index.yaml). 6,775 lines for 30
  features. Average body: ~10,878 bytes/feature. At 41% of 800 KB limit with detail/ files
  already in place for all 30 features."
  detail: |
    A summary-row index (feature_id + pillar + title + layer_count) would reduce the index
    from 326 KB to ~25 KB with no loss (full bodies in detail/ already exist). Preventive
    action now avoids a future hard stop on the feature-reflector which loads the index.
  routed_to: cut-this-step
  confidence: MEDIUM

## what_went_well

- "test-map index–detail orphan rate dropped from 65% to 1.9%: 17 orphans of 881 detail files.
  The VAL-LSN-019-B batch rebuilt the test-map index effectively. Largest single efficiency
  improvement since the maiden run."

- "doc-gaps orphan rate reduced from 60% to 23.9%. Trending toward resolution."

- "feature-flows/detail/ has 30 files, zero orphans — the feature-flow sharding is fully in sync."

- "Incremental-reducer pattern is genuine: no systematic re-enrichment of processed nodes
  (phantom-prevention LSN-018 confirmed operational across batches Q through VAL-LSN-019
  per investigator-log). 0 sidecar-quality failures across all logged batches."

- "probe-runs/ now has 9 artefacts (vs 0 at maiden run). The stress-verified metric (88% over
  3 sidecars) demonstrates the layer produces real output when run."

## axis_score

score: 5
band: AMBER
rationale: |
  AMBER-5 (up from AMBER-4 maiden) because: the dominant maiden defect (62% invisible findings)
  dropped to 25.8% — a concrete improvement. test-map orphan rate is now 1.9%. The score does
  not reach GREEN because: test-map/index.yaml is already at 157% of the load limit (a live
  hard stop, not a warning); concepts/index.yaml is stale by 92 sidecars; and refactoring-scopes
  + implicit-adrs remain severely orphaned (>50%). Target Condition 4 (zero divergence) is not
  met and the load-limit breach on test-map is the most urgent executable blocker in the entire
  methodology today.

## independence_self_assessment

shared_blind_spot_risk: |
  Byte counts proxy token counts throughout. The Claude BPE tokenizer compresses repetitive
  YAML keys — actual token count for test-map/index.yaml may be 20–30% lower than the
  byte-proxy implies. The 800 KB threshold is conservative (200 K tokens × 4 bytes/token).
  If the tokenizer runs at 3 bytes/token, the effective limit drops to 600 KB and the test-map
  file is even further over. Finding direction is unchanged; margin is uncertain.

needs_human_verification:
  - "ECO-F1 — actual token count of test-map/index.yaml in a reducer invocation context"
  - "ECO-F4-scratch — inspect test-map/index.delta.yaml: does it carry entries absent from index.yaml?"
