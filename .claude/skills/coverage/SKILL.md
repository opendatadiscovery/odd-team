---
name: coverage
description: Show scan coverage across all scanners — what's been analyzed, what remains, what changed since last scan.
argument-hint: [scanner-path]
allowed-tools: Read Grep Glob Bash(ls *) Bash(find *) Bash(git log *) Bash(git rev-parse *)
---

# Coverage Report

Show scan coverage status. If `$ARGUMENTS` is provided, show details for that specific scanner. Otherwise show summary across all scanners.

## Protocol

### Summary Mode (no arguments)

1. List all manifests in `state/coverage/`
2. For each, read and extract: scanner_id, total_items, scanned_items, coverage_pct, last_enumerated
3. List scanners that have NO manifest yet (from `scanners/` directory)
4. Display:

```
## Scan Coverage

| Scanner | Coverage | Scanned | Total | Last Active | Stale? |
|---------|----------|---------|-------|-------------|--------|
| tests/collectors-adapters | 23% | 10 | 43 | 2026-04-20 | No |
| tests/collectors-sdk | 100% | 8 | 8 | 2026-04-19 | No |
| docs/accuracy/feature-behavior | 0% | 0 | 25 | - | - |
| ... | | | | | |

Not yet enumerated:
- scanners/docs/accuracy/architecture-drift.md
- scanners/docs/completeness/missing-limitations.md
- ...

Overall: X/Y items scanned across all scanners (Z%)
```

5. Flag "stale" if last_enumerated is >7 days ago (repo may have new files)
6. Recommend next action: enumerate un-manifested scanners, or continue scanning lowest-coverage ones

### Detail Mode (scanner path provided)

1. Read manifest for `$ARGUMENTS`
2. Display:
   - Full item list grouped by status (scanned, not-scanned, changed-since-scan, new, error)
   - Dates and commit refs for scanned items
   - Suggested next batch (first 10-15 not-scanned items)
3. Check if target repo has new commits since last enumeration:
   - `git log --oneline {repo_commit_at_enumeration}..HEAD -- {scope paths}`
   - If yes, recommend re-enumeration

## Staleness Detection

A manifest is stale when:
- `last_enumerated` is >7 days ago AND target repo has new commits since
- Items marked `scanned` have files that changed (detected via git log)

Report: "N items may need re-scanning. Run `/enumerate $ARGUMENTS` to refresh."

## Rules

- This is read-only — never modify manifests, only report
- If no manifests exist at all, explain the system and suggest starting with `/enumerate`
- Show actionable next steps, not just numbers