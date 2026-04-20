---
name: navigate
description: Find where a feature, component, or concept lives in the ODD codebase. Uses the navigation index for O(1) lookups.
argument-hint: <feature-or-keyword>
allowed-tools: Read Grep Glob
---

# Navigate

Find code locations for `$ARGUMENTS`.

## Protocol

1. **Search navigation index** — Check in order:
   - `navigation/features.yaml` — does `$ARGUMENTS` match a domain name or summary?
   - If match: read and display the relevant `navigation/domains/{feature}.md`
   - If no match: grep across all `navigation/domains/*.md` for the keyword

2. **If found in navigation** — Display:
   - The domain file contents (code entry points, tests, docs, related domains)
   - Highlight the most relevant paths for the query

3. **If NOT in navigation** — Fall back to search:
   - Grep across repo directories for the keyword
   - Report what you find
   - **Update navigation**: add discovered paths to the relevant domain file
   - Tell the user the navigation has been enriched for next time

4. **Cross-repo view** — If the feature spans repos:
   - Show entry points in each repo
   - Show the connection between them (e.g., "spec defines it → platform implements it → collectors populate it")

## Rules

- Always try navigation index FIRST — it's the whole point of this system
- If navigation is empty/stale for this feature, fix it as part of answering
- Keep output concise — show file paths, not file contents
- If multiple domains match, list them and ask which to drill into