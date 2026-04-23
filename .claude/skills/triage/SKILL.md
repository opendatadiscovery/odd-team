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
   - **Work we do here, or a handoff to upstream?** — This is the first split:
     - **Work we do here** → backlog item under `backlog/{cat}/{ID}.md` (continue with the fields below).
     - **Handoff to upstream** (the fix lives in a repo we don't directly maintain in this workspace — Java in `odd-platform`, Python in `odd-collectors`, schema in the spec, Helm in `charts`, etc.) → instead of a backlog item, draft a paste-ready GitHub issue at `issues/{repo}/{PREFIX}-NNN.md` via `/log-issue {repo} "title"` (see `issues/README.md` for prefixes). A single finding can produce both — e.g., a missing doc caveat (backlog) **plus** an upstream code fix (issue draft); link them both ways.
   - **Category** (for backlog items) — DOC (documentation), TST (test), NAV (navigation), SPC (specification)
   - **Issue type** (for issue drafts) — bug | feature | adjustment; bugs also need `severity`
   - **Granularity** — One work item / one issue draft per logical change (split complex findings, merge trivial ones)
   - **Priority** — critical (wrong info) > high (missing tests for fragile code) > medium (gaps) > low (cosmetic)
   - **Affected files** — Which files will be created/modified? (For issue drafts: cite upstream `file:line` in the body, not affected_files in this workspace.)
   - **Dependencies** — Does this item require another to complete first?
   - **Effort** — small (<30min), medium (30-90min), large (>90min) — for backlog items only; issue drafts have no in-workspace effort once the body is written.

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
- Functional bugs in upstream code → draft an issue at `issues/{repo}/{PREFIX}-NNN.md` via `/log-issue` (never just narrate "log as GitHub Issue" in a work item; that disappears the moment the conversation ends). If a doc caveat also ships now, pair the backlog item and the issue draft with two-way links.
- If two items touch the same file, note dependency explicitly in both
- A finding that turns into both a backlog item **and** an issue draft must reference each other in their `Context` / `discovered_during:` fields — the audit trail is two-way.