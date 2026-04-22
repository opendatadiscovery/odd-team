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
