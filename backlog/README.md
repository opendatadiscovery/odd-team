# Backlog - Work Items

Atomic, reviewable work items triaged from scanner findings. Each item is one file, one commit's worth of work.

## Work Item Format

Each work item is a markdown file with YAML frontmatter:

```markdown
---
id: {CATEGORY}-{NNN}  # e.g., TST-012, DOC-005, NAV-003, SPC-001
title: "Short description of what needs to change"
category: docs|tests|navigation|spec
target_repo: odd-platform|odd-collectors|odd-docs|opendatadiscovery-specification
status: pending|in-progress|review-ready|done|blocked|rejected
priority: critical|high|medium|low
affected_files:
  - path/to/file1 (create|modify|read)
  - path/to/file2 (modify)
depends_on: []      # IDs of items that must complete first
blocks: []          # IDs of items that cannot start until this completes
estimated_effort: small|medium|large  # small <30min, medium 30-90min, large >90min
scanner_source: "{scanner-id}"
found_date: "YYYY-MM-DD"
---

## Description
What needs to change and why.

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Context
How this was discovered, related findings, relevant code snippets.

## Implementation Notes
Any guidance for the implementer (optional, keep brief).
```

## Naming Convention

- `DOC-{NNN}` — Documentation fixes (accuracy, completeness, coverage)
- `TST-{NNN}` — Test additions
- `NAV-{NNN}` — Code navigation improvements (comments, refactoring for clarity)
- `SPC-{NNN}` — Specification fixes

Numbers are sequential within each category.

## Lifecycle

```
pending → in-progress → review-ready → done
   ↓                         ↓
blocked  (dependency                  blocked
   or acceptance failure)             (review rejected)
   ↓
rejected (closed without implementation — false positive, obsolete, or superseded)
```

### Status transitions — who may flip what

| From → To | Who performs it | Rule |
|-----------|-----------------|------|
| `pending` → `in-progress` | `/implement` | No file-conflict with another `in-progress` item |
| `in-progress` → `review-ready` | `/implement` | All acceptance criteria + Quality Bar responsibilities met; commit has `Consumer-read:` footer |
| `in-progress` → `blocked` | `/implement` | Criteria cannot be met; note the blocker in the item |
| `review-ready` → `done` | `/review` **in a separate session** | Every Quality Bar responsibility cited with evidence; live-site fetch passed |
| `review-ready` → `blocked` | `/review` | Missing evidence, failed live-site fetch, or unaddressed caveat — note the failure in the item |
| `pending` / `in-progress` / `review-ready` → `rejected` | any phase | False positive / obsolete / superseded — see below |

**The implementer cannot self-mark `done`.** This is the lesson from 2026-04-23: every item closed before that date was self-closed and then a spot-check uncovered a production data-loss caveat that had been missed. Review is a separate session, and rejection is the default.

A `rejected` item must include a `## Rejection` section at the top of the body documenting why: what changed, what was checked, where the true state lives (link to evidence). The file stays in the backlog as an audit trail — do not delete rejected items.

## Rules

1. One item = one atomic commit (can touch multiple files, but one logical change)
2. Never start an item if its `affected_files` overlap with another `in-progress` item
3. Update `state/file-registry.yaml` when creating or starting an item
4. Update `state/PROGRESS.md` when status changes
5. Items with `priority: critical` should be done before any `high` items start
6. `depends_on` items must be `done` (not `review-ready`) before this item can move to `in-progress`
7. Every implementation commit must carry a `Consumer-read:` footer — see `CLAUDE.md` "Implementation Quality Bar" #4
8. `/review` must run in a session distinct from the `/implement` session that produced the `review-ready` state

## Review Gate

The backlog is populated by the triager agent but NOT implemented until a human reviews and approves the priority ordering and approach. Implementation only begins after explicit approval.
