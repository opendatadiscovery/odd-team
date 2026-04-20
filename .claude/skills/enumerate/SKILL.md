---
name: enumerate
description: Generate or refresh coverage manifest for a scanner — lists ALL items in scope so scans can track progress across sessions.
argument-hint: <scanner-path>
allowed-tools: Read Grep Glob Bash(ls *) Bash(find *) Bash(git log *) Bash(git rev-parse *) Bash(wc *)
---

# Enumerate Scanner Scope

Generate or refresh the coverage manifest for scanner at `$ARGUMENTS`.

## Protocol

1. **Read scanner definition** at `$ARGUMENTS`:
   - Extract target repo, scope, and what constitutes an "item"
   - Identify the glob pattern or enumeration method for items in scope

2. **Check for existing manifest** at `state/coverage/{scanner-id-dashed}.yaml`:
   - If exists: this is a re-enumeration (detect new/changed/deleted items)
   - If not: this is initial enumeration

3. **Enumerate all items in scope**:
   - Use the appropriate method from `state/coverage/README.md` enumeration table
   - For code: glob the target repo for matching files/directories
   - For docs: fetch/read SUMMARY.md or file listing
   - For spec: list models/endpoints from spec files
   - Record the current commit hash of the target repo

4. **Write or update manifest** at `state/coverage/{scanner-id-dashed}.yaml`:

   ```yaml
   scanner_id: "{scanner-id}"
   scanner_path: "{path to scanner definition}"
   scope_description: "{what's being enumerated}"
   scope_source: "{glob pattern or method used}"
   target_repo: "{relative path to repo}"
   repo_commit_at_enumeration: "{current HEAD commit}"
   last_enumerated: "YYYY-MM-DD"
   total_items: N
   scanned_items: 0
   coverage_pct: 0

   items:
     - path: "{relative path within repo}"
       status: not-scanned
     # ... one entry per item
   ```

5. **For re-enumeration** (manifest already exists):
   - Compare current file list against manifest
   - New files → add with status `new`
   - Deleted files → mark status `deleted`
   - For scanned items: check if changed since scan date via `git log --since={date} -- {path}`
   - Changed items → set status `changed-since-scan`, record `changed_commit`
   - Update `total_items`, `scanned_items`, `coverage_pct`

6. **Report**:
   - Total items in scope
   - If re-enumeration: new items added, items changed, items deleted
   - Suggested batch size for scanning (aim for 10-15 items per session)

## Rules

- If `$ARGUMENTS` is empty, list available scanners and ask which to enumerate
- If target repo doesn't exist locally, report and stop (don't silently skip)
- Manifest must be deterministically ordered (alphabetical by path) for easy diffing
- Record exact commit hashes — they're how we detect changes later