---
name: test-coverage
description: Run the test-coverage-mapper reducer subagent over the per-node enrichment sidecars + actual test files in the target repo. Verifies sidecar-claimed test files exist; surfaces uncovered behaviours as TEST-GAP-NNN candidates ranked by node criticality (anchored on concepts.yaml's security/performance aggregates); cross-references with `doc-gaps.md` for double-jeopardy findings (undocumented AND untested). Emits `lineage/{repo}/test-map.yaml`.
argument-hint: [<repo>] [--show] [--diff]
allowed-tools: Read Grep Glob Bash(ls *) Bash(find *) Bash(jq *) Bash(diff *)
---

# Test coverage map (DOC-164 slice 8+)

Run the **test-coverage-mapper** reducer to map node behaviours to test files (verifying every sidecar's `test_files` claim) and surface uncovered behaviours as TEST-GAP-NNN candidates the maintainer triages when the tests pillar activates.

This is the fourth reducer in the agentic-code-ontology layer. The reducer runs alongside (or after) `/find-implicit-adrs` in slice 8.

## Argument forms

| Form | Behaviour |
|---|---|
| `/test-coverage [<repo>]` | Default. Run test-coverage-mapper. Produces or refreshes `lineage/{repo}/test-map.yaml`. |
| `/test-coverage --show [<repo>]` | Read-only. Print summary (counts per criticality + category, top-5 CRITICAL test gaps). |
| `/test-coverage --diff [<repo>]` | Read-only. Compare existing map to a fresh run; surface the diff. |

## Prerequisites

- `lineage/{repo}/understanding/{slug}.md` sidecars exist.
- `lineage/{repo}/concepts.yaml` exists — the reducer needs concept-level security/performance aggregates to anchor test-gap criticality.
- Target repo's test files reachable (e.g. `../odd-platform/odd-platform-api/src/test/**/*.java`).

## Protocol

### 1. Orient

- `CLAUDE.md` — quality bar
- `adrs/drafts/agentic-code-ontology.md` — slice 8
- `.claude/agents/test-coverage-mapper.md` — subagent system prompt

### 2. Resolve inputs

- Sidecar set: `Glob` `lineage/{repo}/understanding/*.md`.
- Concepts catalog: read `lineage/{repo}/concepts.yaml`.
- Test files: `Glob` per language conventions:
  - Java: `{repo_root}/odd-platform-api/src/test/**/*.java`
  - TS: `{repo_root}/odd-platform-ui/**/*.{test,spec}.{ts,tsx}`
  - Python: `{repo_root}/**/test_*.py` + `{repo_root}/**/*_test.py`
- Existing test-map: capture maintainer-curated entries.
- doc-gaps.md (optional): for double-jeopardy cross-reference.

### 3. Spawn the test-coverage-mapper subagent

Invoke via `Agent` tool. Construct the prompt:

```
REPO: <repo>
WORKSPACE_ROOT_ABS: <absolute>
REPO_ROOT_ABS: <absolute path to ../{repo}>
SIDECAR_DIR_ABS: /home/.../lineage/{repo}/understanding/
CONCEPTS_YAML_PATH: /home/.../lineage/{repo}/concepts.yaml
DOC_GAPS_PATH: /home/.../lineage/{repo}/doc-gaps.md  # optional
EXISTING_TEST_MAP: <verbatim or "(none)">
SUBSTRATE_LAST_SCAN_COMMIT: <from manifest.yaml>
TARGET_PATH: lineage/{repo}/test-map.yaml
SIDECAR_COUNT: <N>
```

Tools per frontmatter: `Read, Glob, Grep, Write`. Subagent verifies test_files claims, ranks gaps by criticality, and writes the map.

### 4. Validate

- Confirm `test-map.yaml` exists; parse YAML.
- Verify per_node, test_gaps, cross_cutting_patterns, sidecar_quality_findings sections.
- Spot-check 3-5 verified test_files entries — do they actually exist and contain the cited test name?

### 5. Report

- Report path
- Counts: `<C> CRITICAL / <H> HIGH / <M> MEDIUM / <L> LOW = <N> total test gaps`
- Categories: missing-unit / missing-integration / missing-edge-case / missing-security / missing-performance / sidecar-stale
- Top-5 CRITICAL test gaps (one-liners with gap IDs)
- Cross-cutting patterns count (e.g. "no integration tests exist anywhere")
- Sidecar-quality findings count (test_files claims that didn't verify)
- Double-jeopardy count (gaps that are both untested AND undocumented per doc-gaps.md)

## Rules

- **Verify every test_files claim.** Every cited test path is Glob-checked; every cited test name is Grep-checked.
- **Anchor criticality on concepts.yaml.** A test gap on a node tied to a HIGH-security-aggregate concept is CRITICAL. Don't guess.
- **Don't invent gaps.** Every TEST-GAP-NNN traces to a sidecar's `uncovered_behaviours` entry.
- **Surface sidecar-quality findings separately.** When a sidecar's `test_files` claim doesn't verify, that's a refresh signal — file in `sidecar_quality_findings`, not as a test gap.

## Cross-references

- Subagent: `.claude/agents/test-coverage-mapper.md`
- Inputs: sidecars + concepts.yaml + (optional) doc-gaps.md + actual test files
- Output: `lineage/{repo}/test-map.yaml`
- Future tests-pillar consumer: when `pillars/tests/` activates, the TEST-GAP-NNN list seeds the pillar's backlog.
