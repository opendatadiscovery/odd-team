---
name: implement
description: Execute an approved work item from the backlog — write tests, docs, comments, or spec fixes. One atomic commit per item.
argument-hint: <work-item-id>
allowed-tools: Read Grep Glob Edit Write WebFetch Bash(ls *) Bash(find *) Bash(cd *) Bash(git *) Bash(./gradlew *) Bash(pnpm *) Bash(poetry *) Bash(pytest *) Bash(npm *)
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
   - Check `adrs/` for any decisions constraining the area being changed
   - Read all affected files listed in the work item
   - If a file doesn't exist where expected, check navigation for updated path
   - If your planned change would violate an ADR, note it and adjust approach
   - **If `target_repo: documentation`**: fetch and checkout `origin/main` in `../documentation` before authoring. GitBook commits land directly on main as `[GITBOOK-NN]` commits; any local branch lags. Skipping this step caused the 2026-04-22 stale-branch re-verification sweep (2 false positives, 4 scope narrowings).

3. **Set status** — Update work item frontmatter: `status: in-progress`

4. **Implement** — Make changes per acceptance criteria:
   - Work in the target repo directory (e.g., `../odd-platform`)
   - Stay within scope — no adjacent fixes, no unrelated refactoring
   - For tests: write them and verify they pass
   - For docs: write and verify rendering/accuracy
   - For comments: verify accuracy against surrounding code
   - **For `target_repo: documentation` specifically**:
     - Never hand-author `[text](target.md "mention")` links — GitBook's `"mention"` shortcut is editor-native and falls back to raw GitHub URLs when authored in git. Use plain markdown links `[Title](target.md)`.
     - When creating a new page, the same PR must include: the page file, the `SUMMARY.md` entry, and any index/README.md link. Splitting these has caused cached fallbacks on the live site.
     - After commit, grep the diff for `"mention"` — if present in new/modified lines, rewrite as plain links before pushing.

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
   - If a new architectural decision was made → create draft ADR in `adrs/drafts/`

8. **Post-merge verification** (MANDATORY for `target_repo: documentation`):
   - After the PR merges to `main`, wait for the GitBook build (typically < 5 minutes).
   - Compute the live URL for every affected page (`docs/a/b/c.md` → `https://docs.opendatadiscovery.org/a/b/c`; `README.md` collapses to its directory URL).
   - WebFetch each URL and verify:
     - Page loads with the intended change visible
     - No `github.com/opendatadiscovery/documentation/blob/` substrings appear in the body (that's the GitBook fallback signature)
     - Any relative links touched by this change resolve to `docs.opendatadiscovery.org` URLs, not to GitHub
     - The sidebar entry is present for any newly-added page
   - If verification fails, reopen the item: `status: blocked`, add a `## Live-site verification failure` section with the URL, the observed fallback, and the suggested fix (usually: replace `"mention"` with plain link, or ensure SUMMARY.md entry is on main).
   - If verification passes, note the live URL(s) in the work item's Context section and leave as `done`.

   Non-documentation items skip this step.

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