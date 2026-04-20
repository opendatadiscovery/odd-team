---
id: docs/completeness/missing-limitations
target_repo: odd-docs (remote) + odd-platform (local)
scope: Features with undocumented known limitations, corner cases, or constraints
estimated_items: 20-40
chunking: By feature domain — one domain per session
depends_on: []
priority: high
---

## Purpose

Identify features where documentation exists but fails to mention known limitations, edge cases, performance constraints, or compatibility issues that users would encounter.

## Method

For each feature domain:

1. Read the feature documentation from odd-docs
2. Read the implementation code (service layer, especially error handling and edge cases)
3. Look for:
   - Try/catch blocks that swallow or genericize errors
   - TODO/FIXME/HACK comments mentioning limitations
   - Conditional logic that silently skips cases
   - Configuration limits (max batch size, timeout values, etc.)
   - Database constraints (unique indexes, FK constraints, column limits)
   - Known issues in GitHub Issues (search by feature label)

## Criteria for a Finding

- Code has an explicit limit (e.g., pagination max, bulk operation cap) not mentioned in docs
- Code has a known failure mode (e.g., "if X exceeds Y, operation fails") not in docs
- Code has a workaround comment (TODO, HACK, FIXME) for a user-visible limitation
- Feature has open GitHub issues describing user-encountered limitations
- Feature has a specific database constraint that affects user behavior

## Output

Write to: `findings/docs-completeness-missing-limitations/YYYY-MM-DD-{domain}.md`

Per finding:
- Feature and documentation page
- The limitation (what doesn't work or has constraints)
- Evidence in code (file path, relevant code snippet/comment)
- User impact (would a user hit this? How would they know?)
