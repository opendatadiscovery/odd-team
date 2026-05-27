---
name: scan
description: Run an audit scanner against ODD repositories. Reads scanner definition, picks unscanned items from coverage manifest, writes findings, updates navigation.
argument-hint: <scanner-path>
allowed-tools: Read Grep Glob Bash(ls *) Bash(find *) Bash(wc *) Bash(git log *) Bash(git show *) Bash(git rev-parse *)
---

# Run Scanner

Execute the audit scanner at `$ARGUMENTS`.

## Protocol

1. **Orient** — Read these files (do NOT skip):
   - `CLAUDE.md` (system overview — nine-gate Quality Bar and Gate 9 Source-of-Truth table)
   - `navigation/features.yaml` (feature index)
   - `navigation/architecture.md` (integration-pattern + canonical-repo map; every repo name encountered during the scan is classified against this file)
   - The relevant `navigation/domains/*.md` for the scanner's target domain

2. **Load scanner definition** at `$ARGUMENTS`. Extract:
   - Target repo and scope
   - Method (step-by-step)
   - Criteria (what counts as a finding)
   - Output format
   - Chunking strategy (if applicable)
   - **`ontology_feed:` block (if present)** — determines run mode (see step 2.5)

2.5. **Determine run mode** *(rev 13)*:
   - **If `ontology_feed:` is absent OR `ontology_feed.enabled: false`** → **Mode A (standalone)**. Continue with steps 3-10 unchanged. This is backward-compatible — every existing scanner runs as before.
   - **If `ontology_feed.enabled: true`** → **Mode B (ontology-fed)**. Execute mode B sub-protocol below before continuing to step 3. Mode is LOCKED for the run — never switched mid-session.

   ### Mode B sub-protocol *(rev 13, per APPROACH.md §20 + scanners/README.md "Ontology-fed mode")*
   
   2.5.1. **Substrate-presence check**: verify `lineage/{substrate_repo}/` exists with `manifest.yaml`, `nodes.jsonl`, `feature-flows/index.yaml`. If ANY is missing → ABORT with `INSUFFICIENT-ONTOLOGY-COVERAGE: substrate not found at lineage/{substrate_repo}/`. NO silent fallback to mode A — explicit mode-A re-run (with the `ontology_feed:` block disabled or absent) is the only path to standalone behaviour.
   
   2.5.2. **Stamp ontology commit**: read `lineage/{substrate_repo}/manifest.yaml:current_substrate_commit` (or equivalent — `last_scan_commit`). Record as `ontology_commit_consulted:` on every emission in this run. If `current_substrate_commit < HEAD - staleness_threshold_commits` (default 50) OR last-modified >48h, emit `WARNING: stale-ontology — trust downgraded` and set `ontology_corroborated: stale_warning` on every emission for this run. (Per-scanner override: `ontology_feed.staleness_action: abort` blocks the run instead.)
   
   2.5.3. **Load coverage check**: enumerate intended F-NNN entries per the scanner's `ontology_feed.feature_scope_filter:` (e.g. `pillar_id: [P-07]` or `target_repo_overlap`). If the filtered set is empty AND the scanner declares `feature_scope_filter:` → ABORT with `ZERO-FEATURES-IN-SCOPE`. If the filtered set covers <50% of the maintainer-expected count for this scanner's scope → emit `coverage_gap_for_scan: <missing entities>` to the scan-feed log and continue.
   
   2.5.4. **Load clue sources** in the order declared by `ontology_feed.clue_sources:` (always `feature-flows/detail/F-*.yaml` first per Rule 21):
   - Glob `lineage/{substrate_repo}/feature-flows/detail/F-*.yaml`; filter by `feature_scope_filter:`; sort by `feature_id`. This is the iteration set for steps 5.B.
   - Read `lineage/{substrate_repo}/concepts/index.yaml` + relevant detail shards (only when scanner enables `concepts.yaml` consultation).
   - Read `lineage/{substrate_repo}/shoebox/detail/SHB-*.md` with `Category: open | clustering` (only when scanner enables shoebox consultation).
   - Read `lineage/{substrate_repo}/doc-gaps/index.md` + per-finding details — **DEDUP/PRIORITY HINT ONLY**. A feature absent from doc-gaps is NOT presumed documented.

3. **Check coverage manifest** at `state/coverage/{scanner-id-dashed}.yaml`:
   - **If manifest exists**: read it, pick next batch of `not-scanned` or `changed-since-scan` items
   - **If no manifest exists**: run enumeration first (follow `/enumerate` protocol inline), then pick first batch
   - Batch size: 10-15 items per session (adjust based on item complexity)

4. **Load existing findings** — Before scanning, read ALL existing findings files in `findings/`:
   - Scan every `findings/*/` directory (not just the current scanner's directory — gaps cross scanner boundaries)
   - Build a mental index of: finding ID, location, short title, severity
   - During scanning, if you discover a gap that matches an existing finding (same location, same issue), do NOT create a duplicate — instead note an enrichment (see step 5)
   - Match broadly: same file + same general issue = match, even if wording differs or the scanner that found it was different

5. **Execute the scan** on the selected batch:
   - Follow the scanner's method systematically for EACH item in the batch
   - Apply criteria to each item
   - **Every finding must cite a Source of Truth by Gate 9 class** (Repo / Integration / Config / Builder / Spec / Term / Lifecycle / Dep / Handler / Cross-repo / Backlog / **Ontology** *(rev 13, additive)*) — full table in `pillars/{active}/gates.md` Gate 9 + executable procedure in `playbooks/claim-inventory.md`. "The doc says X but the code/SoT says Y" is a finding; "the doc might be wrong" is not. If you cannot cite an SoT, the gap is speculation — either find the SoT or drop the finding.
   - **For mode B (rev 13)**: every finding sourced from an ontology clue cites BOTH the ontology and the underlying primary-source class — e.g. `Source-of-truth: Ontology[F-001:hop-1] → Repo[DataEntityDetails.tsx:56-64]`. A finding citing ONLY `Ontology[...]` (without a primary-source class) is rejected by Gate 9 — same shape as Gate 9 already rejects "the doc might be wrong" without an SoT. The `Ontology` class is additive (12th class after the existing 11); it does NOT replace any existing class.
   - For SDK-backed integrations, run `playbooks/unset-parameter-audit.md` (Gate 5) — every unset builder parameter with an unsafe SDK default is a finding (`retrospectives/LSN-002` is the canonical case).
   - For every outbound URL referenced in the doc under scan (`github.com/opendatadiscovery/*`, `docs.opendatadiscovery.org/*`, external docs), resolve the URL against `navigation/architecture.md` or (if missing) WebFetch / `gh repo view`. A broken or mis-targeted URL is a finding with SoT class `Repo` or `Integration` (`retrospectives/LSN-003` is the canonical case).
   - Record findings as you go, each with its SoT citation inline
   - Do NOT modify any files in target repos (read-only scan)
   
   ### 5.B. Mode B per-feature investigation *(rev 13 — runs INSTEAD of step 5 when `ontology_feed.enabled: true`)*
   
   The scanner's PRIMARY investigation target is `lineage/{substrate_repo}/feature-flows/detail/F-*.yaml`, not the scanner's traditional axes. For each in-scope F-NNN (the iteration set loaded in step 2.5.4):
   
   1. **Read F-NNN end-to-end.** Extract: `feature_name`, `pillar_id`, `pillar_anchored_feature_name`, `description`, `contributing_nodes[]`, `chain[].evidence`, `observed_vs_expected.facets[]`, `status`, `seeded_from` (if any).
   2. **Derive expected doc location.** From `pillar_id` + `pillar_anchored_feature_name` + `system-mission.md`'s pillar-to-doc-path map. Check whether the page exists at `documentation/docs/{expected_doc_path}` and (if scanner is the canonical-accuracy variant) WebFetch the live URL.
   3. **Verify against code (4-tier clue ladder):**
      - `file_exists` (sidecar says `X.java:139`) → Read the cited file ±5 lines. Verified iff cited symbol present at cited line ±5.
      - `assertion_about_code` (sidecar says "method returns 200 OK") → Read the cited region + verify mechanically (regex / direct match). Verified iff textual claim and read evidence agree.
      - `cross_layer_behaviour` (chain-hop multiplicity, end-to-end DB-delta) → if `probe_verifications:` populated, run the cited probe; else file a `probe-needed` finding.
      - `doc_drift` (sidecar's `docs_link_semantic` claim) → fresh WebFetch in this session. Verified iff live status + key excerpt match sidecar within 30 days.
   4. **Compare `description` field against the live doc.** If the feature's `description` paragraph and the live doc materially disagree → emit a `drift` finding.
   5. **Emit findings (per finding, cite Source-of-truth dual-class):**
      - `missing-page` if the doc doesn't exist.
      - `drift` if description and live doc diverge.
      - `missing-caveat` per `observed_vs_expected.facets[]` entry not mentioned in doc.
      - `ontology-drift` per hop whose `evidence` line moved or vanished (the code shifted since the sidecar was authored).
   6. **Write back** (mandatory; per scanners/README.md "Ontology-fed mode" + APPROACH.md §20.5):
      - Append a `scanner_reviews:` entry to `feature-flows/detail/F-{NNN}.yaml`. APPEND-ONLY (never overwrite). Idempotency key: `(scanner_id, scan_run_date)`.
      - If the finding pins a per-node defect (e.g. `@Value` consumer with unsafe default) → also annotate the relevant sidecar under `lineage/{substrate_repo}/understanding/*.md` (max 5 sidecars per run; above that, the cluster belongs on the F-NNN flow).
      - If the same gap already exists as a DOC-GAP-NNN in `doc-gaps.md`: append a `corroborated_by_scanner:` block to its per-finding detail file — NO new finding emitted (dedup).
      - If the F-NNN's description disagrees with the chain (intent-vs-implementation drift) AND the disagreement is structural → append a NEW shoebox thread at `lineage/{substrate_repo}/shoebox/detail/SHB-NNN-{slug}.md` with `Category: open` (the correction surface; feature-flow-builder picks it up on next pass).
   7. **Per-scan-run consultation budget enforced** (hard caps from `ontology_feed.consultation_budget:`):
      - `graph-retriever` ≤5: spawn for ad-hoc "does ontology cover {topic}?" queries beyond enumerated axes.
      - `feature-reflector` ≤3: spawn when a feature-flow's product framing disagrees with its chain AND the scanner can't independently judge.
      - `odd-sme` ≤2: spawn when pillar-mapping or industry-vocabulary alignment is ambiguous.
      - Above budget → backlog escalation entry (`escalation: pending-sme-review`), never silent drop.
   8. **Coherence check** before emit: grep `lineage/{substrate_repo}/{refactoring-scopes,doc-gaps,test-map,implicit-adrs}.md` for any existing finding matching the same `(file:line)` evidence. Duplicates extend via back-link, never create parallel entries.
   9. **Verdict tagging**: every emission tagged `STATIC-INFERRED` or `PROBE-VERIFIED` (rev-13 Rule 21 D7). A scan-run emitting only `STATIC-INFERRED OK` rows gets `verification_class: descriptive-only` and does not count toward "feature audited" status.
   10. **`ontology-confirmed` vs `ontology-extended` distinction**: each finding marks whether it verified what the feature-flow already named (`ontology-confirmed`) or surfaced new behaviour beyond it (`ontology-extended`).
   
   Mode B's findings file shape is the same as mode A; the `Source-of-truth:` field carries the dual-class citation.

6. **Write findings** — Create the output file:
   - Path: `findings/{scanner-id-dashed}/YYYY-MM-DD[-batch-N].md`
   - Format: follow `scanners/README.md` output format exactly
   - Include summary counts at the top
   - Note which specific items were covered in this run
   - **Dedup rules**:
     - New gap with no prior match → new finding ID (F-NNN), written normally
     - Gap matches an existing finding from the SAME scanner → skip (already covered)
     - Gap matches an existing finding from a DIFFERENT scanner → create an enrichment entry (see format below)
   - **Enrichment format** (append to the findings file):
     ```
     ### F-NNN ← enriches F-XXX ({original-scanner-id})
     - **Original**: F-XXX in `findings/{original-scanner-dir}/{file}.md`
     - **New evidence**: {what this scanner found that adds to the original}
     - **Severity adjustment**: {unchanged | escalate to X | de-escalate to X} — {reason}
     ```
   - After writing, update the original finding file: append a `- **Cross-ref**: enriched by F-NNN in \`findings/{this-scanner-dir}/{file}.md\`` line to the original finding

7. **Update coverage manifest**:
   - For each item scanned: set `status: scanned`, record `scanned_date` and `scanned_commit`
   - Set `findings_ref` to the findings file path
   - Recalculate `scanned_items` and `coverage_pct`

8. **Update navigation** (MANDATORY):
   - Every file path discovered during scanning → add to relevant `navigation/domains/*.md`
   - Every **repo name or integration pattern** discovered (a new collector, a push-client, a platform module the scanner touched) → update `navigation/architecture.md` so future Gate 9 verifications can resolve the repo in O(1) without a fresh WebFetch
   - This is a core output, not optional bookkeeping

9. **Update progress** — Edit `state/PROGRESS.md`:
   - If scanner is now 100% covered, mark as completed

9.5. **Mode B only — write scanner-feed log** *(rev 13)*:
   - Always emit (even if zero ontology clues were consumed — absence is informative).
   - Path: `lineage/{substrate_repo}/scanner-feed/{YYYY-MM-DD}-{scan_run_id}.yaml`.
   - Shape (per `adrs/drafts/research/scanner-ontology-fusion/INTEROP.md` §2.5):
     ```yaml
     artefact: scanner-feed
     scanner_id: <scanner id from frontmatter>
     scan_run_id: SR-{ISO8601-compact}
     scan_run_date: 2026-05-27
     ontology_commit_consulted: <sha>
     mode: B                         # A | B | mixed
     clues_consumed:                 # ordered by consumption time
       - source: feature-flow
         id: F-NNN
         fields_read: [...]
         verified_against_code: true
         findings_produced: [F-NNN, F-MMM]
       - source: doc-gap
         id: DOC-GAP-NNN
         fields_read: [...]
         findings_produced: []
         dedup_action: wrote_back_corroboration
       - source: concept | shoebox | graph-search
         ...
     agent_consultations:
       feature_reflector_calls: <int>
       odd_sme_calls: <int>
       graph_retriever_calls: <int>
     write_backs:
       feature_flows: [F-NNN, ...]
       sidecars: [<slug>, ...]
       doc_gaps: [DOC-GAP-NNN, ...]
       shoebox: [SHB-NNN, ...]
     warnings:
       - "<staleness / coverage gap / budget exceeded entries>"
     ```
   - **Verification-class verdict** (per Rule 21 D13): if `clues_consumed[]` contains zero `source: feature-flow` entries within scope → set `verification_class: corroboration-only` and emit a warning. The scan-run does NOT count toward "feature audited" status until the next mode-B run completes the per-feature iteration.

10. **Report**:
   - Items scanned this session: N
   - Findings this session: M
   - Coverage progress: X% (Y/Z items total)
   - Remaining items: list next batch to scan
   - Suggested: "Run `/scan $ARGUMENTS` again to continue (N items remaining)"

## Rules

- Always check coverage manifest before scanning — never re-scan already covered items
- If manifest shows 100% coverage and no `changed-since-scan` items, report "fully scanned" and suggest re-enumeration if it's been >7 days
- If the scanner path doesn't exist, list available scanners from `scanners/` and ask which to run
- Prefer false positives over missed gaps (triager will filter later)
- If you find a bug in target code, note it in findings but do NOT fix it. If the defect is clearly actionable upstream (concrete file:line, operator-visible failure mode, suggested fix obvious), the triager who picks up this scan will draft it as an `issues/{repo}/{PREFIX}-NNN.md` upstream issue (see `issues/README.md` and `/log-issue`); record enough detail in the finding (`file:line`, severity, repro shape) that the triager doesn't have to re-read the code.
- If an item can't be scanned (file missing, access issue), mark status as `error` with note