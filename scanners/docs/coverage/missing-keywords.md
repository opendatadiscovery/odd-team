---
id: docs/coverage/missing-keywords
target_repo: odd-docs (remote)
scope: Documentation pages without search-friendly keywords or metadata
estimated_items: 20-40
chunking: All pages in one session (keyword check is fast per page)
depends_on: [docs/coverage/undocumented-features]
priority: low
---

## Purpose

Identify documentation pages that lack keywords, tags, or search-friendly terminology that would help users (human or AI) find them via search.

## Method

1. Fetch documentation pages from odd-docs
2. For each page, assess:
   - Does the page title clearly indicate what it covers?
   - Does the page contain synonyms/aliases for the feature? (e.g., "lineage" page should also mention "data flow", "provenance", "dependency graph")
   - Are technical terms defined or at least present? (e.g., "ODDRN" should appear on pages that describe entity identification)
   - Would a user searching for common phrases find this page?

## Criteria for a Finding

- Page about a feature uses only one term (no synonyms/aliases)
- Page uses jargon without defining it or linking to a glossary
- Page title is generic (e.g., "Overview") without topic context
- Page doesn't mention the common user problem it solves

## Output

Write to: `findings/docs-coverage-missing-keywords/YYYY-MM-DD.md`

Per finding:
- Doc page
- Missing keywords/synonyms that should be present
- Why they'd help (what would a user search for to find this page?)
