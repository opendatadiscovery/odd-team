---
name: triage
description: Convert raw scanner findings into atomic work items in the backlog. Assigns priority, category, effort, and identifies file conflicts.
argument-hint: <findings-path>
allowed-tools: Read Grep Glob Bash(ls *) Bash(find *)
---

# Triage Findings

Convert findings at `$ARGUMENTS` into backlog work items.

## Protocol

1. **Orient** — Read:
   - `CLAUDE.md`
   - `backlog/README.md` (work item format and lifecycle)
   - `state/file-registry.yaml` (existing file claims)
   - Check existing items in `backlog/` to avoid duplicates and get next ID numbers

2. **Read findings** — Load the findings file at `$ARGUMENTS`

3. **Triage each finding** — For each, decide:
   - **Actionable?** — Reject false positives with brief explanation
   - **Category** — DOC (documentation), TST (test), NAV (navigation), SPC (specification)
   - **Granularity** — One work item per logical change (split complex findings, merge trivial ones)
   - **Priority** — critical (wrong info) > high (missing tests for fragile code) > medium (gaps) > low (cosmetic)
   - **Affected files** — Which files will be created/modified?
   - **Dependencies** — Does this item require another to complete first?
   - **Effort** — small (<30min), medium (30-90min), large (>90min)

4. **Create work items** — Write to `backlog/{category}/{ID}.md`:
   - Follow format exactly from `backlog/README.md`
   - Write testable acceptance criteria (not vague goals)
   - Include scanner source and found date

5. **Update file registry** — Add to `state/file-registry.yaml`:
   - Map each affected file to the new work item ID

6. **Update progress** — Edit `state/PROGRESS.md`:
   - Update backlog counts by category and status

7. **Report** — State:
   - Findings processed: N accepted, M rejected (with reasons)
   - Work items created: breakdown by category and priority
   - Any dependency chains identified

## Splitting Heuristics

Split when:
- Finding spans multiple repos
- Finding requires both code and doc changes in different repos
- Finding affects >5 files

Merge when:
- Multiple findings are same root cause
- Multiple findings need the same single-file change

## Rules

- If `$ARGUMENTS` is empty, list available findings in `findings/` and ask which to triage
- Don't write implementation details — just acceptance criteria
- Flag functional bugs → note as "related bug, log as GitHub Issue" in work item
- If two items touch the same file, note dependency explicitly in both