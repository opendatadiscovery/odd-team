---
name: review
description: Verify a completed work item meets acceptance criteria and has no regressions.
argument-hint: <work-item-id>
allowed-tools: Read Grep Glob Bash(ls *) Bash(find *) Bash(cd *) Bash(git *) Bash(./gradlew *) Bash(pnpm *) Bash(poetry *) Bash(pytest *) Bash(npm *)
---

# Review Work Item

Review completed work item `$ARGUMENTS`.

## Protocol

1. **Orient** — Read:
   - `CLAUDE.md`
   - The work item file (status should be `done`)
   - The commit that implemented it (from git log in target repo)

2. **Check acceptance criteria** — For each criterion:
   - Read the modified/created files
   - Verify the criterion is actually met (not just superficially)
   - For "test passes" criteria → run the test
   - For "doc is accurate" criteria → verify against implementation code

3. **Check for regressions**:
   - Run the relevant test suite for the target repo
   - For doc changes: verify links, references still valid
   - For code comments: verify accuracy against surrounding code
   - For test additions: verify they test what they claim

4. **Check navigation consistency**:
   - Are file paths in `navigation/domains/*.md` still correct?
   - Did the change affect any cross-references?

5. **Verdict** — Append to work item file:

   ```markdown
   ## Review (YYYY-MM-DD)
   - **Result**: ACCEPTED | REJECTED
   - **Criteria check**: [pass/fail per criterion]
   - **Regressions**: none | [description]
   - **Notes**: [if rejected, what needs fixing]
   ```

   If REJECTED: set status back to `pending` with explanation.

## Rules

- Be strict on acceptance criteria
- Be lenient on style (if correct and functional, don't nitpick)
- If test passes but tests the wrong thing → reject
- If doc is technically correct but misleading → reject with specific feedback
- If `$ARGUMENTS` is empty, list items with status `done` that haven't been reviewed