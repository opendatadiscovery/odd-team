---
name: status
description: Show current progress of the audit and implementation system — scanner completion, backlog counts, blockers.
allowed-tools: Read Grep Glob Bash(ls *) Bash(find *) Bash(wc *)
---

# System Status

Show the current state of the ODD Team maintenance system.

## Protocol

1. Read `state/PROGRESS.md` and display its contents
2. Count actual files to verify accuracy:
   - Scanner completion: check `findings/` for output from each scanner
   - Backlog counts: count files in `backlog/{category}/` by status (grep frontmatter)
   - Navigation coverage: count domain files with vs. without populated code entry points
3. If counts don't match PROGRESS.md, update it
4. Report:
   - Overall phase (audit / triage / implementation / review)
   - What's been done
   - What's next (highest priority pending scanner or work item)
   - Any blockers or stale items

## Quick View Format

```
Phase: {current phase}
Scanners: {done}/{total} complete
Backlog: {total} items ({critical} critical, {high} high, {medium} medium, {low} low)
In Progress: {count} items
Done: {count} items
Navigation: {populated}/{total} domains have code pointers

Next action: {recommended next step}
```