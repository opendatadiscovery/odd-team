# Scanners

Scanners are self-contained instruction sets for auditing specific aspects of the ODD project. Each scanner can be executed in a single Claude Code session.

## How to Run a Scanner

1. Open a new Claude Code session in the `odd-team` directory
2. Tell it: "Run scanner `scanners/{category}/{name}.md`"
3. The scanner file contains all instructions: scope, method, criteria, output format
4. Results go to `findings/{scanner-id}/YYYY-MM-DD.md`
5. Any discovered code locations should update `navigation/domains/` files

## Scanner Categories

### docs/accuracy/ (Priority: CRITICAL)
Verify that existing documentation matches actual implementation.
Wrong docs are worse than missing docs — they actively mislead.

### docs/completeness/ (Priority: HIGH)
Find gaps within existing documentation pages — missing sections, incomplete descriptions, undocumented corner cases.

### docs/coverage/ (Priority: MEDIUM)
Find features that have no documentation at all.

### tests/ (Priority: HIGH)
Find code paths without test coverage — services, repositories, adapters, UI components.

### navigation/ (Priority: MEDIUM)
Build the navigation index by mapping features to code entry points, and identify places where cross-references are missing.

### spec/ (Priority: HIGH)
Verify the ODD specification matches actual Ingress API behavior.

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
