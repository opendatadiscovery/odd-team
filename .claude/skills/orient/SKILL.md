---
name: orient
description: Quick orientation for a new session — shows system overview, current state, and available actions.
allowed-tools: Read Glob
---

# Orient

Quick orientation for working in the ODD Team maintenance system.

## Protocol

1. Read and summarize `CLAUDE.md` (2-3 sentences)
2. Read `state/PROGRESS.md` and show current phase and counts
3. List available skills:
   - `/scan <path>` — run an audit scanner
   - `/triage <path>` — convert findings to work items
   - `/implement <id>` — execute a work item
   - `/review <id>` — verify completed work
   - `/status` — full progress report
   - `/navigate <feature>` — find code locations
4. Show recommended next action based on current progress
5. List any blockers or items needing attention

## Output Format

```
## ODD Team Maintenance System

{2-3 sentence summary of what this is and current phase}

### Current State
Scanners: {done}/{total} | Backlog: {count} items | Done: {count}

### Available Commands
/scan <scanner-path>     — audit a specific aspect
/triage <findings-path>  — create work items from findings
/implement <item-id>     — execute approved work item
/review <item-id>        — verify completed work
/status                  — detailed progress report
/navigate <feature>      — find code locations

### Recommended Next
{what to do next and why}
```