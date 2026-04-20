---
name: implement
description: Execute an approved work item from the backlog — write tests, docs, comments, or spec fixes. One atomic commit per item.
argument-hint: <work-item-id>
allowed-tools: Read Grep Glob Edit Write Bash(ls *) Bash(find *) Bash(cd *) Bash(git *) Bash(./gradlew *) Bash(pnpm *) Bash(poetry *) Bash(pytest *) Bash(npm *)
---

# Implement Work Item

Execute work item `$ARGUMENTS`.

## Protocol

1. **Orient** — Read:
   - `CLAUDE.md`
   - `navigation/features.yaml` → relevant `navigation/domains/*.md`
   - The work item file (find it in `backlog/` by searching for `$ARGUMENTS`)

2. **Pre-flight checks**:
   - Status must be `pending` (not blocked, not in-progress)
   - Check `state/file-registry.yaml` — no conflicting in-progress items on same files
   - Read all affected files listed in the work item
   - If a file doesn't exist where expected, check navigation for updated path

3. **Set status** — Update work item frontmatter: `status: in-progress`

4. **Implement** — Make changes per acceptance criteria:
   - Work in the target repo directory (e.g., `../odd-platform`)
   - Stay within scope — no adjacent fixes, no unrelated refactoring
   - For tests: write them and verify they pass
   - For docs: write and verify rendering/accuracy
   - For comments: verify accuracy against surrounding code

5. **Verify**:
   - Check every acceptance criterion is met
   - Run relevant tests
   - Ensure no regressions

6. **Commit** — In the target repo:
   - Stage only the files this item touches
   - Message format: `{category}: {title} [{ID}]`
   - Example: `tests: add integration test for PostgreSQL relationships [TST-012]`

7. **Update state**:
   - Set work item status to `done`
   - Update `state/PROGRESS.md` counts
   - Update `navigation/domains/*.md` if any pointers changed

## Rules

- **No functional changes** to application code — only docs, tests, comments, spec alignment
- If you discover a bug: note in work item Context section, do NOT fix it
- If acceptance criteria are impossible: set status to `blocked`, explain why
- If item is larger than estimated: complete what fits, create follow-up item for the rest
- If `$ARGUMENTS` is empty, show pending items sorted by priority and ask which to implement

## Batch Mode

You may batch multiple items in one session IF:
- Same target repo
- No overlapping files
- All small effort
- Commit each separately