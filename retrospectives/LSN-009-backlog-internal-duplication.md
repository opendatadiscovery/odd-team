---
id: LSN-009
title: Proposed DOC-062 canonical Integrations page was already covered by DOC-042 in richer form
date: 2026-04-23
domain: documentation
severity: medium
gates_informed:
  - grep-backlog-before-creating-new-items
  - gate-9-factual-provenance-class-existing-in-flight-work
status: closed
---

# LSN-009: Proposed DOC-062 canonical Integrations page was already covered by DOC-042 in richer form

## What happened

On 2026-04-23, during a triage pass, a new backlog item DOC-062 was drafted to propose a canonical Integrations page. A retrospective sweep found that DOC-042 already covered the same concept — a richer, more detailed canonical-Integrations-hub item with content-type homing baked in. DOC-062 would have created parallel, partial in-flight work that fragmented the implementation path. The duplicate was caught before implementation started; the proposed DOC-062 was withdrawn and DOC-042's acceptance criteria were extended where DOC-062 had a delta.

## Why it slipped

The duplication sweep at the time targeted the *documentation tree* (Gate 1 — bi-directional sweep across `docs/`). It did not target the **backlog itself** as an SoT class. Triagers added items by reasoning forward from findings without reasoning backward from the existing in-flight work. The cost of grepping the backlog ("is there already an item that covers this concept under a different title?") is two minutes; the cost of duplicate items fragmenting implementation is multiple sessions of partial overlap and confused acceptance criteria.

## Rule that emerged

**Grep the backlog before creating a new item.** The backlog is a canonical SoT class for "existing in-flight work" under Gate 9 (Factual claim provenance). Search by title keywords, affected files, and `scanner_source` before proposing a new `DOC-NNN`. If an existing item already covers the concept, extend its acceptance criteria instead of creating a parallel entry. The rule lives in `CLAUDE.md` "Autonomous Execution and Batching" → "Follow-up work must be logged on disk"; Phase 3 of the architecture refactor moves it into the universal-framework section of `CLAUDE.md` and the relevant playbook (`playbooks/follow-up-on-disk.md`).

## Forcing question

Before I create a new backlog item, what existing items did I just grep for — and which one's acceptance criteria am I about to extend instead?

## References

- DOC-042 backlog item (`backlog/docs/DOC-042.md` — the existing canonical-integrations-hub item)
- DOC-062 (withdrawn before creation; the proposed-but-redundant item)
- `state/PROGRESS.md` 2026-04-23 retrospective entries
- Related: LSN-003 (a sibling-class failure where the same gap — sweep doesn't cover new content the change is introducing — manifested for outbound URLs rather than backlog items)