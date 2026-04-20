---
id: docs/coverage/missing-references
target_repo: documentation (local: ../documentation) + odd-platform (local)
scope: Documentation pages missing cross-references to code, issues, releases
estimated_items: 30-60
chunking: 10 doc pages per session
depends_on: []
priority: medium
---

## Purpose

Identify documentation pages that lack references to:
- Code entry points (where to find the implementation)
- GitHub Issues (related change requests, known bugs)
- Releases (when the feature was added/changed)
- Related documentation pages (cross-references)

## Method

1. Fetch documentation pages from the documentation repo (work through SUMMARY.md listing)
2. For each page, check if it contains:
   - Link or reference to source code file(s) implementing the feature
   - Link to related GitHub Issues
   - Mention of which release introduced or modified the feature
   - Links to related doc pages for adjacent features
3. For code references, verify the referenced files still exist

## Criteria for a Finding

- Feature doc page has zero code references
- Feature doc page has zero issue references
- Feature doc page doesn't mention when it was introduced
- Feature doc page doesn't link to related features that clearly connect
- Code reference in doc points to a file that no longer exists

## Output

Write to: `findings/docs-coverage-missing-references/YYYY-MM-DD-batch-{N}.md`

Per finding:
- Doc page
- What type of reference is missing (code, issue, release, cross-ref)
- Suggested reference (if identifiable from code/git history)
