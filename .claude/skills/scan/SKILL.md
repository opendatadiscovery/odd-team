---
name: scan
description: Run an audit scanner against ODD repositories. Reads scanner definition, picks unscanned items from coverage manifest, writes findings, updates navigation.
argument-hint: <scanner-path>
allowed-tools: Read Grep Glob Bash(ls *) Bash(find *) Bash(wc *) Bash(git log *) Bash(git show *) Bash(git rev-parse *)
---

# Run Scanner

Execute the audit scanner at `$ARGUMENTS`.

## Protocol

1. **Orient** — Read these files (do NOT skip):
   - `CLAUDE.md` (system overview)
   - `navigation/features.yaml` (feature index)
   - The relevant `navigation/domains/*.md` for the scanner's target domain

2. **Load scanner definition** at `$ARGUMENTS`. Extract:
   - Target repo and scope
   - Method (step-by-step)
   - Criteria (what counts as a finding)
   - Output format
   - Chunking strategy (if applicable)

3. **Check coverage manifest** at `state/coverage/{scanner-id-dashed}.yaml`:
   - **If manifest exists**: read it, pick next batch of `not-scanned` or `changed-since-scan` items
   - **If no manifest exists**: run enumeration first (follow `/enumerate` protocol inline), then pick first batch
   - Batch size: 10-15 items per session (adjust based on item complexity)

4. **Execute the scan** on the selected batch:
   - Follow the scanner's method systematically for EACH item in the batch
   - Apply criteria to each item
   - Record findings as you go
   - Do NOT modify any files in target repos (read-only scan)

5. **Write findings** — Create the output file:
   - Path: `findings/{scanner-id-dashed}/YYYY-MM-DD[-batch-N].md`
   - Format: follow `scanners/README.md` output format exactly
   - Include summary counts at the top
   - Note which specific items were covered in this run

6. **Update coverage manifest**:
   - For each item scanned: set `status: scanned`, record `scanned_date` and `scanned_commit`
   - Set `findings_ref` to the findings file path
   - Recalculate `scanned_items` and `coverage_pct`

7. **Update navigation** (MANDATORY):
   - Every file path discovered during scanning → add to relevant `navigation/domains/*.md`
   - This is a core output, not optional bookkeeping

8. **Update progress** — Edit `state/PROGRESS.md`:
   - If scanner is now 100% covered, mark as completed

9. **Report**:
   - Items scanned this session: N
   - Findings this session: M
   - Coverage progress: X% (Y/Z items total)
   - Remaining items: list next batch to scan
   - Suggested: "Run `/scan $ARGUMENTS` again to continue (N items remaining)"

## Rules

- Always check coverage manifest before scanning — never re-scan already covered items
- If manifest shows 100% coverage and no `changed-since-scan` items, report "fully scanned" and suggest re-enumeration if it's been >7 days
- If the scanner path doesn't exist, list available scanners from `scanners/` and ask which to run
- Prefer false positives over missed gaps (triager will filter later)
- If you find a bug in target code, note it in findings but do NOT fix it
- If an item can't be scanned (file missing, access issue), mark status as `error` with note