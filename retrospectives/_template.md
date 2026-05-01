---
id: LSN-NNN
title: <one-line title>
date: YYYY-MM-DD
domain: documentation | tests | features | code-quality
severity: critical | high | medium | low
gates_informed:
  - <gate or playbook name>
  - <gate or playbook name>
status: open | closed
---

# LSN-NNN: <title>

## What happened
One paragraph. The incident in concrete terms — what shipped, what broke, who saw it. Cite the file:line evidence and the date.

## Why it slipped
One paragraph. What gate didn't exist yet, what assumption masked the failure, what the maintainer was looking at when the gap formed. Blameless: what about the process let this through?

## Rule that emerged
One paragraph. The gate, playbook, or stance question that now prevents recurrence. Name the framework file and section that carries the rule.

## Forcing question
One sentence. The question that, if asked at authoring time, would have caught this incident.

## References
- File:line evidence
- Originating finding / backlog item / retro thread
- Related LSN entries