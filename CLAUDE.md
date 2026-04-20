# ODD Team - AI Maintenance System

This repository is the coordination hub for AI-assisted maintenance of the Open Data Discovery project. It manages gap discovery, work item tracking, navigation, and coordinated implementation across multiple ODD repositories.

## Quick Start for Any Session

1. Type `/orient` for a quick briefing, or read this file manually
2. Read `navigation/features.yaml` to orient on what exists
3. Read the relevant `navigation/domains/{feature}.md` for your specific task
4. Never grep/glob across entire repos — use navigation pointers instead

## Available Skills (Slash Commands)

| Command | Purpose |
|---------|---------|
| `/orient` | Quick orientation — shows state and available actions |
| `/enumerate <scanner-path>` | Generate coverage manifest — list ALL items in scope |
| `/scan <scanner-path>` | Run audit scanner on next unscanned batch from manifest |
| `/coverage [scanner-path]` | Show what's been scanned vs. what remains |
| `/triage <findings-path>` | Convert findings into backlog work items |
| `/implement <item-id>` | Execute an approved work item |
| `/review <item-id>` | Verify a completed work item |
| `/status` | Show detailed progress dashboard |
| `/navigate <feature>` | Find where a feature lives in code |

## System Overview

```
scanners/    → Define what to audit (instructions for focused scans)
findings/    → Raw audit output (timestamped, per scanner)
backlog/     → Reviewable work items (atomic, trackable, prioritized)
navigation/  → Token-efficient knowledge map (pointers, not docs)
state/       → Coordination (progress, file locks, decisions)
agents/      → Reusable agent prompts for each role
```

## Roles

### Scanner (audit phase)
1. Read scanner definition from `scanners/{category}/{scanner}.md`
2. Execute scan against target repo (parent directory `../` or remote)
3. Write findings to `findings/{scanner-name}/YYYY-MM-DD.md`
4. Update `navigation/domains/` with any code locations discovered

### Triager (after audit)
1. Read raw findings from `findings/`
2. Create work items in `backlog/{category}/` per `backlog/README.md` format
3. Update `state/file-registry.yaml` with affected files
4. Update `state/PROGRESS.md` counts

### Implementer (execution phase)
1. Check `state/PROGRESS.md` for next priority items
2. Pick a `pending` item, verify no file conflicts in `state/file-registry.yaml`
3. Set status to `in-progress`, execute the change, commit atomically, set to `done`
4. If navigation pointers are stale, update them immediately

### Reviewer (verification phase)
1. Check completed items against their acceptance criteria
2. Verify cross-references remain consistent
3. Run relevant tests
4. Update `state/PROGRESS.md`

## Repository Locations

| Repo | Local Path | Tech Stack |
|------|-----------|------------|
| odd-platform | `../odd-platform` | Java 17, Spring Boot, React/TS, PostgreSQL |
| odd-collectors | `../odd-collectors` | Python, Poetry, 40+ adapters |
| odd-specification | `../opendatadiscovery-specification` | OpenAPI YAML |
| odd-docs | Remote: `github.com/opendatadiscovery/odd-docs` | Gitbook markdown |

## Token Budget Protocol

| Step | What to read | Purpose |
|------|-------------|---------|
| Orient | This file + `navigation/features.yaml` | Know the system, find your domain |
| Focus | `navigation/domains/{relevant}.md` | Get exact file pointers |
| Execute | Only files identified in navigation | Do the work |
| **Never** | Full directory traversals or grep across entire repos | Wastes tokens |

The navigation layer converts O(n) exploration into O(1) lookups. Always check navigation first.

## Key Principles

- One work item = one atomic commit
- No functional changes — only docs, tests, comments, spec alignment
- Human reviews backlog before implementation begins
- Parallel execution allowed only for non-conflicting file sets
- Navigation files are living pointers — update immediately when stale
- Incorrect documentation has higher priority than missing documentation
- Scanner decomposition must fit in a single session (~100K tokens of working context)

## Priority Order

1. **Critical**: Incorrect documentation (actively misleading)
2. **High**: Missing tests for complex/fragile features, incomplete docs
3. **Medium**: Missing documentation for existing features, code navigation gaps
4. **Low**: Keyword additions, cosmetic cross-references, nice-to-have comments