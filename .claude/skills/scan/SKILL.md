---
name: scan
description: Run an audit scanner against ODD repositories. Reads scanner definition, executes the scan, writes findings, updates navigation.
argument-hint: <scanner-path>
allowed-tools: Read Grep Glob Bash(ls *) Bash(find *) Bash(wc *) Bash(git log *) Bash(git show *)
---

# Run Scanner

Execute the audit scanner at `$ARGUMENTS`.

## Protocol

1. **Orient** — Read these files (do NOT skip):
   - `CLAUDE.md` (system overview)
   - `navigation/features.yaml` (feature index)
   - The relevant `navigation/domains/*.md` for the scanner's target domain

2. **Load** — Read the scanner definition at `$ARGUMENTS`. Extract:
   - Target repo and scope
   - Method (step-by-step)
   - Criteria (what counts as a finding)
   - Output format
   - Chunking strategy (if applicable)

3. **Execute** — Follow the scanner's method systematically:
   - Work through the target repo using navigation pointers first
   - Apply criteria to each item in scope
   - Record findings as you go
   - Do NOT modify any files in target repos (read-only scan)

4. **Write findings** — Create the output file:
   - Path: `findings/{scanner-id-dashed}/YYYY-MM-DD.md` (today's date)
   - Format: follow `scanners/README.md` output format exactly
   - Include summary counts at the top

5. **Update navigation** (MANDATORY):
   - Every file path discovered during scanning → add to relevant `navigation/domains/*.md`
   - This is a core output, not optional bookkeeping

6. **Update progress** — Edit `state/PROGRESS.md`:
   - Mark the scanner as completed in the audit phase table

7. **Report** — State:
   - Items scanned vs. gaps found
   - Anything you couldn't assess (and why)
   - Suggested next scanner to run

## Rules

- If the scanner path doesn't exist, list available scanners from `scanners/` and ask which to run
- If scope is too large for this session, complete one chunk and note where to resume
- Prefer false positives over missed gaps (triager will filter later)
- If you find a bug in target code, note it in findings but do NOT fix it