---
id: adrs/completeness
target_repo: odd-team (this repo, adrs/ directory)
scope: Check if accepted ADRs are complete, referenced, and still valid
estimated_items: depends on number of ADRs created
chunking: All ADRs in one session (bounded by what exists)
depends_on: [adrs/reverse-engineer]
priority: medium
---

## Purpose

After ADRs are created and accepted, verify they remain useful:
- Are they referenced from the right places?
- Are they still accurate (code hasn't drifted from the decision)?
- Are they complete (examples, exceptions, consequences all filled)?
- Are cross-references between related ADRs in place?

## Method

1. Read all ADRs in `adrs/` (accepted status)
2. For each ADR:
   - Verify examples still exist at stated file paths
   - Check if exceptions/violations listed are still accurate
   - Search for NEW violations not listed (code drifted since ADR was written)
   - Verify cross-references to other ADRs are correct
   - Check if any Issues/PRs reference this ADR

## Criteria for a Finding

- ADR example points to a file/line that no longer exists
- ADR states a pattern, but new code violates it without being listed as exception
- ADR has empty sections (no examples, no exceptions, no references)
- Two ADRs contradict each other
- ADR status is "accepted" but the decision has clearly been superseded in code
- Major architectural area has no ADR coverage

## Output

Write to: `findings/adrs-completeness/YYYY-MM-DD.md`

Per finding:
- ADR id and title
- What's wrong (stale example, new violation, missing section, contradiction)
- Suggested fix (update example, add exception, supersede ADR)
