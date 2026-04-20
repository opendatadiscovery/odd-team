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
status: pending|in-progress|done|blocked
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
pending → in-progress → done
   ↓
blocked (when dependency isn't met)
```

## Rules

1. One item = one atomic commit (can touch multiple files, but one logical change)
2. Never start an item if its `affected_files` overlap with another `in-progress` item
3. Update `state/file-registry.yaml` when creating or starting an item
4. Update `state/PROGRESS.md` when status changes
5. Items with `priority: critical` should be done before any `high` items start
6. `depends_on` items must be `done` before this item can move to `in-progress`

## Review Gate

The backlog is populated by the triager agent but NOT implemented until a human reviews and approves the priority ordering and approach. Implementation only begins after explicit approval.
