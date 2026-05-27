# Scanners

Scanners are self-contained instruction sets for auditing specific aspects of the ODD project. Each scanner can be executed in a single Claude Code session.

## How to Run a Scanner

1. Open a new Claude Code session in the `odd-team` directory
2. Tell it: "Run scanner `scanners/{category}/{name}.md`"
3. The scanner file contains all instructions: scope, method, criteria, output format
4. Results go to `findings/{scanner-id}/YYYY-MM-DD.md`
5. Any discovered code locations should update `navigation/domains/` files

## MANDATORY pre-scan step for docs scans

**Before** running any scanner whose target is the `documentation` repo (`../documentation`), fetch and checkout `origin/main`:

```bash
git -C ../documentation fetch origin main
git -C ../documentation checkout origin/main
```

**Why**: GitBook's web editor commits straight to `main` as `[GITBOOK-NN]` commits. Any local feature/hotfix branch lags behind quickly. On 2026-04-22 a stale checkout caused the `docs/accuracy/feature-behavior` scan to mis-report 6 backlog items (2 false positives, 4 partials needing narrowing). The live docs site (`docs.opendatadiscovery.org`) reflects `main` — scanning any other branch is scanning fiction. See the stale-branch re-verification note in `state/PROGRESS.md`.

The same rule applies to any other GitBook-synced or remote-managed repo. For remote-only repos (`odd-docs`, `odd-dbt`, `odd-spark-adapter`, `odd-airflow-2`, `odd-cli`), clone fresh or `gh api` fetch rather than trusting a stale checkout.

If a scanner emits a "feature is completely undocumented" / "zero docs" finding, treat it as high false-positive risk: cross-check `origin/main` and the live docs site before accepting into the backlog.

## Scanner Categories

### docs/accuracy/ (Priority: CRITICAL)
Verify that existing documentation matches actual implementation.
Wrong docs are worse than missing docs — they actively mislead.

### docs/completeness/ (Priority: HIGH)
Find gaps within existing documentation pages — missing sections, incomplete descriptions, undocumented corner cases.

### docs/coverage/ (Priority: MEDIUM)
Find features that have no documentation at all.

### docs/quality/ (Priority: HIGH)
Verify the **published** docs site — not source markdown. Catches rendering issues that source-level scanners can't see: GitBook shortcut fallbacks to raw GitHub URLs, orphaned pages (file exists but not in SUMMARY.md), dead sidebar entries, broken internal link resolution. Every other `docs/*` scanner reads markdown; this one reads `docs.opendatadiscovery.org`.

### tests/ (Priority: HIGH)
Find code paths without test coverage — services, repositories, adapters, UI components.

### navigation/ (Priority: MEDIUM)
Build the navigation index by mapping features to code entry points, and identify places where cross-references are missing.

### spec/ (Priority: HIGH)
Verify the ODD specification matches actual Ingress API behavior.

## Deduplication

Scanners overlap — multiple scanners may discover the same gap from different angles. Before writing findings, the scan protocol requires loading ALL existing findings across all `findings/*/` directories. When a new gap matches an existing finding:

- **Same scanner, same issue** → skip (already covered)
- **Different scanner, same issue** → create an enrichment entry instead of a duplicate finding. This adds new evidence, a cross-reference, and optionally adjusts severity. The original finding gets a back-link.

This ensures each real-world gap has ONE canonical finding that accumulates evidence over time, rather than N duplicates from N scanners.

## Scanner Decomposition Rules

1. Each scanner must fit in one session (~100K tokens working context)
2. If scope is too large, include a chunking strategy (e.g., "10 adapters per run")
3. Scanners are idempotent — running twice produces same findings
4. Scanners report what IS, not what to do about it (that's the triager's job)

## Output Format

All findings use this structure:
```markdown
# Findings: {scanner-id}
# Date: YYYY-MM-DD
# Target: {repo/path scanned}
# Scope: {what was covered this run}

## Summary
- Total items scanned: N
- Gaps found: M
- Severity breakdown: X critical, Y high, Z medium

## Findings

### F-001: {short title}
- **Location**: {file path or doc page}
- **Issue**: {what's wrong or missing}
- **Evidence**: {how you know — code snippet, comparison, etc.}
- **Severity**: critical|high|medium|low
- **Suggested fix**: {brief direction, not full implementation}
```

## Ontology-fed mode *(rev 13, 2026-05-27)*

Every scanner can run in one of two modes per scan-run (mode-locked at start; never switched mid-run):

- **Mode A — standalone.** The original behaviour described above. Default for any scanner without an `ontology_feed:` frontmatter block.
- **Mode B — ontology-fed.** Opt-in via `ontology_feed.enabled: true` in the scanner's frontmatter. The scanner iterates `lineage/{repo}/feature-flows/detail/F-*.yaml` as its primary investigation target and consumes the ontology's clue sources alongside its existing axes. Clues are verified against the codebase (never trusted as ground truth); write-back is annotate-only frontmatter on feature-flow / sidecar / doc-gap files.

The full protocol — pseudo-protocol, verification ladder, write-back contract, the 13 hard rules — lives in `APPROACH.md §20` + `adrs/drafts/research/scanner-ontology-fusion/{SUMMARY,INTEROP,PITFALLS}.md`. This section is the scanner-author's quick-reference.

### Opting a scanner into mode B

Add the `ontology_feed:` block to your scanner's frontmatter. Minimum 8 lines; expandable to ~15:

```yaml
---
id: docs/accuracy/feature-behavior
target_repo: documentation + odd-platform
scope: ...
estimated_items: 20-40
chunking: ...
depends_on: []
priority: critical
ontology_feed:
  enabled: true
  substrate_repo: odd-platform                  # which lineage/{repo}/ to read from
  primary_investigation_target: feature-flows   # always (per Rule 21); literal value
  feature_scope_filter:                         # subset of features this scanner audits
    pillar_id: [P-07]                           # by pillar; or
    target_repo_overlap: documentation+odd-platform   # by repo overlap; or omit for all
  clue_sources:                                 # ordered = consumption order; feature-flows ALWAYS first
    - feature-flows/detail/F-*.yaml
    - lineage/odd-platform/concepts/index.yaml
    - lineage/odd-platform/shoebox/detail/SHB-*.md
    - lineage/odd-platform/doc-gaps/             # dedup/priority hint ONLY — never coverage signal
  verification_requirements:
    - "every clue cited as Source: Ontology[F-NNN] must be independently verified against file:line"
    - "no scanner finding may repeat a chain[].evidence string verbatim — re-state from the re-opened file"
  consultation_budget:
    graph-retriever: 5
    feature-reflector: 3
    odd-sme: 2
  write_back:
    enabled: true
    targets: [feature-flows, sidecars, doc-gaps, shoebox]
  staleness_threshold_commits: 50               # WARN if ontology consulted_commit < HEAD - 50
  staleness_action: warn                        # warn | abort
---
```

Absent `ontology_feed:` → scanner runs in standalone mode unchanged.

### Mode B per-feature pseudo-protocol

For every in-scope F-NNN (filtered by `feature_scope_filter`):

1. **Read the feature flow.** `feature-flows/detail/F-{NNN}.yaml` — extract `feature_name`, `pillar_id`, `pillar_anchored_feature_name`, `description`, `contributing_nodes[]`, `chain[].evidence`, `observed_vs_expected.facets[]`, `status`.
2. **Derive expected doc location.** From `pillar_id` + `pillar_anchored_feature_name` + `system-mission.md`. Check whether `documentation/docs/{expected_doc_path}` exists.
3. **Verify against code (4-tier ladder).** `file_exists` (Read ±5 lines) / `assertion_about_code` (mechanical match) / `cross_layer_behaviour` (run probe if available, else file probe-needed) / `doc_drift` (fresh WebFetch, compare description vs live doc).
4. **Emit findings:** `missing-page` if doc absent; `drift` if description/doc diverge; `missing-caveat` per facet not mentioned in doc; `ontology-drift` per stale hop.
5. **Write back** a `scanner_reviews:` entry on F-NNN with `doc_status`, `ontology_corroborated`, `scanner_finding_ids`, `ontology_commit_consulted`.
6. **Dedup lookup** against `lineage/{repo}/doc-gaps.md` — matching DOC-GAP-NNN gets a `corroborated_by_scanner:` block (no duplicate finding).
7. **Per-scan-run consultation budget enforced.** Excess triggers → backlog escalation, never silent drop.

### Citing the Ontology Source-of-Truth class

Every mode-B finding cites BOTH the ontology clue AND the underlying primary source:

```
Source-of-truth: Ontology[F-001:hop-1] → Repo[DataEntityDetails.tsx:56-64]
```

A finding citing ONLY `Ontology[...]` (without a primary-source class) is rejected by Gate 9 — same shape as Gate 9 already rejects "the doc might be wrong" without an SoT. The `Ontology` class is additive (12th class after the existing 11); it does NOT replace any existing class.

### What mode B is NOT — out of scope

- NO substrate mutation outside `scanner_reviews:` blocks. The scanner never edits a sidecar's body, never edits a feature-flow's `chain` or `observed_vs_expected.facets`, never edits `concepts.yaml`'s entries. Only the new `scanner_reviews:` frontmatter block is writable.
- NO trusting `doc-gaps.md` as exhaustive. doc-gaps is a dedup/priority hint. A feature absent from doc-gaps is NOT presumed documented. The scanner ALWAYS iterates feature-flows independently.
- NO consulting feature-reflector / odd-sme / graph-retriever above the per-run budgets (3 / 2 / 5). Above budget → backlog escalation, not silent skip.
- NO ontology-fed mode for `spec/*` or `tests/*` scanners (circular feedback risk — those domains are themselves substrate inputs).

### Pilot opt-in roster (rev-13 Day 1)

Two scanners pilot mode B; the rest stay standalone until the pilot data justifies broader rollout (Day 30 target):

| Scanner | Status | Rationale |
|---|---|---|
| `docs/coverage/undocumented-features` | PILOT | Already enumerates from code (5 axes); ontology's feature-flows IS an enumeration. Cheapest natural fit. |
| `docs/accuracy/feature-behavior` | PILOT | Canonical accuracy scanner; feature-flows' `observed_vs_expected.facets[]` ARE the drift-class taxonomy this scanner pass A targets. Highest-value fit. |
| All other 27 scanners | STANDALONE (Day 1) | Default. Broaden at Day 30 from pilot data. |

### References

- `APPROACH.md §20` — the static-protocol description; Rule 21 — the workspace-level invariant.
- `adrs/drafts/research/scanner-ontology-fusion/SUMMARY.md` — opinionated synthesis, the design's rationale anchor.
- `adrs/drafts/research/scanner-ontology-fusion/INTEROP.md` — concrete file shapes, agent contracts, budgets, the per-feature pseudo-protocol in full.
- `adrs/drafts/research/scanner-ontology-fusion/PITFALLS.md` — the 13 hard rules (D1-D13) every mode-B scanner must respect.
- `.claude/skills/scan/SKILL.md` — the orchestrator; the conditional branch for mode B.
- `.claude/skills/triage/SKILL.md` — consumes `scanner-feed/{date}-{scan_run_id}.yaml` and lifts priority on ontology-corroborated findings.
