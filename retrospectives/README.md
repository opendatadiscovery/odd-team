---
directory: retrospectives
purpose: case-law for the framework — one file per lesson
---

# Retrospectives

Each file in this directory is a single lesson — a case that earned a forcing-function rule somewhere in the framework. Gates and playbooks cite these by `LSN-NNN`; they do not embed the cases inline.

This directory is the **case law** of the framework. The framework files (`CLAUDE.md`, `pillars/{name}/gates.md`, `playbooks/*.md`) hold the *rules*; this directory holds the *why* — the concrete incidents that justified each rule.

## File format

Each retrospective is a separate file named `LSN-NNN-{slug}.md`. Use kebab-case slugs that name the failure (`LSN-002-minio-region-unset`, not `LSN-002-incident`).

```
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
One paragraph. The incident in concrete terms — what shipped, what broke, who saw it.
Cite the file:line evidence and the date.

## Why it slipped
One paragraph. What gate didn't exist yet, what assumption masked the failure, what the
maintainer was looking at when the gap formed. The blameless angle: what about the
process let this through?

## Rule that emerged
One paragraph. The gate, playbook, or stance question that now prevents recurrence.
Name the framework file and section that carries the rule.

## Forcing question
One sentence. The question that, if asked at authoring time, would have caught this
incident. The Pre-authoring stance check (`playbooks/pre-authoring-stance.md`) is the
most common home for this question.

## References
- File:line evidence
- Originating finding / backlog item / retro thread
- Related LSN entries
```

## Naming and IDs

- IDs are sequential (`LSN-001`, `LSN-002`, …). Do not skip numbers; do not reuse.
- Allocate the next `LSN-NNN` by listing this directory + `_template.md` and picking `max + 1`.
- Slugs name the failure, not the symptom. `LSN-002-minio-region-unset` (failure) beats `LSN-002-attachments-broken` (symptom).

## When to add a retrospective

Add an LSN when:

- An incident shipped publicly (live-site bug, data loss, user report) and required a rule change to prevent recurrence.
- A scan or review caught a class of failure for the first time and the rule that prevents it was added to the framework in the same period.
- A retrospective writeup currently lives in `state/PROGRESS.md` mixed with activity history — it deserves its own LSN file.

Do *not* add an LSN for:

- A bug that was caught and fixed without changing any rule (just a normal fix)
- A typo or local oversight that didn't reflect a structural gap
- A duplicate of an existing LSN — extend the existing one with new references instead.

## Files in this directory (status as of 2026-05-01)

| File | Status | Phase that populates it |
|---|---|---|
| `_template.md` | scaffold | Phase 1 |
| `LSN-NNN-{slug}.md` × ~7 | not yet | Phase 2 |