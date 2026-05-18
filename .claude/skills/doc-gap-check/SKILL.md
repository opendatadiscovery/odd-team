---
name: doc-gap-check
description: Run the doc-gap-finder reducer subagent over the per-node enrichment sidecars + the concept catalog + the live documentation site. Produces or refreshes `lineage/{repo}/doc-gaps.md` — a ranked list of DOC-NNN candidates (broken URLs, missing anchors, code-doc drift, missing pages, coverage gaps, stale pages) with full citations the maintainer triages into the backlog.
argument-hint: [<repo>] [--show] [--diff]
allowed-tools: Read Grep Glob Bash(ls *) Bash(jq *) Bash(diff *) WebFetch
---

# Doc-gap check (DOC-164 slice 7+)

Build or refresh the cross-sidecar doc-gap report at `lineage/{repo}/doc-gaps.md`. The doc-gap-finder reducer walks every per-node sidecar's `docs_link_semantic` block, re-WebFetches each claimed URL to verify status + anchor + content alignment, joins the concept catalog (`concepts.yaml`) against the live `documentation/docs/SUMMARY.md` to surface concept-without-page gaps, runs the Type-5 bidirectional drift probe per `adrs/drafts/research/agentic-code-ontology/PROBES.md`, and writes a ranked candidate list the maintainer triages.

This skill is the third reducer in the agentic-code-ontology layer (per `adrs/drafts/agentic-code-ontology.md` rev 2). The first per-node enrichment slice was `/enrich` (slice 5). The first reducer was `/concepts` (slice 6 — concept catalog). `/doc-gap-check` (slice 7) consumes both.

## Argument forms

| Form | Behaviour |
|---|---|
| `/doc-gap-check [<repo>]` | Default. Run `doc-gap-finder` in **incremental mode** (per `playbooks/reducer-incremental-mode.md`) against the sidecar set + concepts.yaml + live docs (default repo: `odd-platform`). Refreshes `lineage/{repo}/doc-gaps.md` by appending+annotating only the sidecars whose `node_id` is not yet in the prior artefact's `processed_node_ids`. Preserves any maintainer-curated entries from a prior version. |
| `/doc-gap-check --full [<repo>]` | Forces FULL mode — re-reads every sidecar and re-WebFetches every URL from scratch. Use when prior artefact is corrupt or after a sweep recalibration. |
| `/doc-gap-check --show [<repo>]` | Read-only. Print the existing report's summary (counts per category + severity, top-5 highest-severity findings, cross-references). No subagent invocation. |
| `/doc-gap-check --diff [<repo>]` | Read-only. Compare the existing `doc-gaps.md` to a freshly-generated one (in a temp file) and surface the diff. Useful for previewing what a refresh would change. |

## Incremental input resolution

Before spawning the subagent in default (`incremental`) mode, the skill computes:

- `PROCESSED_NODE_IDS` — read from prior `doc-gaps.md`'s frontmatter `processed_node_ids:`. Missing → `--full` fallback.
- `NEW_SIDECAR_FILES` — sidecars whose `node_id` is not in `PROCESSED_NODE_IDS`. Empty set → exit.
- `PRIOR_HEAD` — one line per existing `DOC-GAP-NNN` from prior `doc-gaps.md`, derived via `grep -E '^## DOC-GAP-'` + severity + category. Compact-head shape per the playbook.
- `CURATED_ENTRIES` — verbatim Markdown of every entry flagged `maintainer_curated: true`.
- `NEXT_AVAILABLE_ID` — max existing `DOC-GAP-NNN` + 1.

These get passed to the subagent in place of the legacy "full prior artefact" block. Live URLs are still re-verified per Rule 1 (the playbook does NOT relax the live-URL requirement — only the prior-artefact-reading cost).

## Prerequisites

- `lineage/{repo}/understanding/{slug}.md` sidecars exist (i.e. `/enrich` has been run at least once).
- `lineage/{repo}/concepts.yaml` exists (i.e. `/concepts` has been run after the most recent enrichment).
- `documentation/docs/SUMMARY.md` is reachable (local at `../documentation/docs/SUMMARY.md` preferred; live `https://docs.opendatadiscovery.org/` fallback).
- `WebFetch` tool is available — every URL gets verified live; stale verification copied from sidecars is forbidden by the subagent's Rule 1.
- `findings/docs-coverage-undocumented-features/2026-05-08.md` is read for cross-reference (existing F-047..F-060 candidates) so the reducer doesn't duplicate.

## Protocol

### 1. Orient

Read these (skip if loaded this session):

- `CLAUDE.md` — quality bar
- `adrs/drafts/agentic-code-ontology.md` — the layered ADR + reducer pattern
- `.claude/agents/doc-gap-finder.md` — the subagent's system prompt
- `findings/docs-coverage-undocumented-features/2026-05-08.md` — DOC-163 prior findings (cross-reference target so the reducer doesn't double-file)

### 2. Resolve inputs

- **Sidecar set**: `Glob` `lineage/{repo}/understanding/*.md`. Confirm at least one sidecar exists; otherwise report "no sidecars to walk — run `/enrich` first" and exit.
- **Concepts catalog**: `lineage/{repo}/concepts.yaml`. Confirm exists; if not, report "concepts.yaml missing — run `/concepts` first" and exit (the reducer joins concepts × SUMMARY.md).
- **Existing doc-gaps**: `lineage/{repo}/doc-gaps.md`. Capture maintainer-curated entries (`maintainer_curated: true`) for preservation.
- **SUMMARY.md**: prefer `../documentation/docs/SUMMARY.md` (local sibling). Fallback: WebFetch `https://docs.opendatadiscovery.org/`.
- **Substrate state**: read `lineage/{repo}/manifest.yaml`'s `last_scan_commit` so the produced report can record `generated_at_commit`.
- **Existing F-NNN findings**: read `findings/docs-coverage-undocumented-features/*.md` paths so the subagent can cross-reference (not duplicate).

### 3. Spawn the doc-gap-finder subagent

Invoke via `Agent` tool with `subagent_type: doc-gap-finder` (after `.claude/agents/doc-gap-finder.md` is loaded; in transient sessions general-purpose is the fallback). Construct the prompt as:

```
REPO: <repo>
WORKSPACE_ROOT_ABS: <absolute>
SIDECAR_DIR_ABS: /home/.../lineage/{repo}/understanding/
CONCEPTS_YAML_PATH: /home/.../lineage/{repo}/concepts.yaml
DOC_SUMMARY_PATH: <absolute path to ../documentation/docs/SUMMARY.md or live URL>
SUBSTRATE_LAST_SCAN_COMMIT: <from manifest.yaml>
EXISTING_DOC_GAPS: <verbatim content of lineage/{repo}/doc-gaps.md if present, else "(none)">
EXISTING_DOC_NNN_FINDINGS: <list of paths to findings/docs-coverage-undocumented-features/*.md for cross-reference>
TARGET_PATH: lineage/{repo}/doc-gaps.md
SIDECAR_COUNT: <N>
```

The subagent's tool surface per its frontmatter is `Read, Glob, Grep, WebFetch, Write`. It writes the report and replies with `Wrote: ...` + `Findings: ...`.

### 4. Validate the resulting report

After completion:

- Confirm `lineage/{repo}/doc-gaps.md` exists.
- Parse YAML frontmatter (`generated_at`, `total_findings`, `findings_by_severity`, etc.). Missing keys are an error.
- Verify each finding entry has `category`, `surfaced_by`, `evidence`, `proposed_doc_action`, `severity`. Missing field = log warning + report.
- Spot-check 3-5 random findings: do their `surfaced_by` sidecar references resolve to real files? Do their `evidence` URLs resolve when re-fetched?
- HIGH-severity findings get an extra check: the maintainer triages these first; if the evidence is thin (single sidecar, no live-fetch confirmation), demote to MEDIUM and warn.

### 5. Report

Concise output:

- Report path
- Counts: `<H> HIGH / <M> MEDIUM / <L> LOW = <N> total findings`
- Categories: `broken-url: n, missing-anchor: n, drift: n, missing-page: n, stale-page: n, coverage-gap: n`
- Top-5 HIGH findings (one-liners with finding IDs)
- Cross-references to DOC-163's F-NNN: `<count>` findings overlap with prior cataloged gaps
- Suggested next: `/triage findings/docs-coverage-undocumented-features/2026-05-08.md` to catalog these as DOC-NNN backlog items, then `/concepts` to refresh the catalog if doc additions changed canonical-vocab.

## Rules

- **Live-URL-only re-verification.** The doc-gap-finder MUST WebFetch every URL fresh in the session. Stale verifications copied from sidecars are forbidden — the subagent's prompt enforces this; the skill double-checks via spot-fetch on 3-5 sampled URLs.
- **Cross-reference, don't duplicate.** If a finding matches DOC-163's F-NNN catalog, the entry's `cross_references` field cites the F-NNN; the finding does NOT re-file the same gap as a new entry.
- **Severity is anchored to operator impact.** HIGH = operator follows the doc → broken/insecure deployment. MEDIUM = partial coverage / wrong-slug-but-resolvable. LOW = cosmetic. The skill rejects HIGH findings with thin evidence and warns to demote.
- **Maintainer-curated entries preserved.** Existing `maintainer_curated: true` entries in prior `doc-gaps.md` survive verbatim through refreshes (the subagent reads `EXISTING_DOC_GAPS` and preserves; the skill verifies preservation in step 4).
- **Reducer doesn't fix.** The subagent surfaces gaps; it doesn't author doc pages. Maintainer triages into DOC-NNN, then `/implement` slices ship the doc updates.

## Failure modes to surface

- WebFetch fails repeatedly (network outage, rate-limit on docs.opendatadiscovery.org) → surface as a partial run; the existing `doc-gaps.md` is preserved; no auto-write.
- Subagent reports HIGH findings whose `surfaced_by` doesn't cite a sidecar → CRITICAL; reject the report; ask for prompt revision.
- More than 50% of findings cite the same single sidecar → likely sidecar-quality issue, not doc gap; surface to maintainer for sidecar refresh via `/enrich --node <id>`.
- Severity distribution skewed (e.g. >70% HIGH) → likely severity-inflation; surface for maintainer recalibration.

## Cross-references

- Subagent: `.claude/agents/doc-gap-finder.md`
- Inputs: `lineage/{repo}/understanding/*.md` + `lineage/{repo}/concepts.yaml`
- Output: `lineage/{repo}/doc-gaps.md`
- Live source-of-truth: `https://docs.opendatadiscovery.org/` + `../documentation/docs/SUMMARY.md`
- Cross-reference target: `findings/docs-coverage-undocumented-features/*.md` (DOC-163 F-NNN catalog)
- ADR: `adrs/drafts/agentic-code-ontology.md` rev 2 (slice 7)
- Probe spec: `adrs/drafts/research/agentic-code-ontology/PROBES.md` (Type-5 bidirectional drift probe)
- Cornerstone enforced: documentation pillar Cornerstone 1 (discoverability without context)
