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
   - `CLAUDE.md` (system overview — nine-gate Quality Bar and Gate 9 Source-of-Truth table)
   - `navigation/features.yaml` (feature index)
   - `navigation/architecture.md` (integration-pattern + canonical-repo map; every repo name encountered during the scan is classified against this file)
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

4. **Load existing findings** — Before scanning, read ALL existing findings files in `findings/`:
   - Scan every `findings/*/` directory (not just the current scanner's directory — gaps cross scanner boundaries)
   - Build a mental index of: finding ID, location, short title, severity
   - During scanning, if you discover a gap that matches an existing finding (same location, same issue), do NOT create a duplicate — instead note an enrichment (see step 5)
   - Match broadly: same file + same general issue = match, even if wording differs or the scanner that found it was different

5. **Execute the scan** on the selected batch:
   - Follow the scanner's method systematically for EACH item in the batch
   - Apply criteria to each item
   - **Every finding must cite a Source of Truth by Gate 9 class** (Repo / Integration / Config / Builder / Spec / Term / Lifecycle / Dep / Handler / Cross-repo / Backlog) — full table in `pillars/{active}/gates.md` Gate 9 + executable procedure in `playbooks/claim-inventory.md`. "The doc says X but the code/SoT says Y" is a finding; "the doc might be wrong" is not. If you cannot cite an SoT, the gap is speculation — either find the SoT or drop the finding.
   - For SDK-backed integrations, run `playbooks/unset-parameter-audit.md` (Gate 5) — every unset builder parameter with an unsafe SDK default is a finding (`retrospectives/LSN-002` is the canonical case).
   - For every outbound URL referenced in the doc under scan (`github.com/opendatadiscovery/*`, `docs.opendatadiscovery.org/*`, external docs), resolve the URL against `navigation/architecture.md` or (if missing) WebFetch / `gh repo view`. A broken or mis-targeted URL is a finding with SoT class `Repo` or `Integration` (`retrospectives/LSN-003` is the canonical case).
   - Record findings as you go, each with its SoT citation inline
   - Do NOT modify any files in target repos (read-only scan)

6. **Write findings** — Create the output file:
   - Path: `findings/{scanner-id-dashed}/YYYY-MM-DD[-batch-N].md`
   - Format: follow `scanners/README.md` output format exactly
   - Include summary counts at the top
   - Note which specific items were covered in this run
   - **Dedup rules**:
     - New gap with no prior match → new finding ID (F-NNN), written normally
     - Gap matches an existing finding from the SAME scanner → skip (already covered)
     - Gap matches an existing finding from a DIFFERENT scanner → create an enrichment entry (see format below)
   - **Enrichment format** (append to the findings file):
     ```
     ### F-NNN ← enriches F-XXX ({original-scanner-id})
     - **Original**: F-XXX in `findings/{original-scanner-dir}/{file}.md`
     - **New evidence**: {what this scanner found that adds to the original}
     - **Severity adjustment**: {unchanged | escalate to X | de-escalate to X} — {reason}
     ```
   - After writing, update the original finding file: append a `- **Cross-ref**: enriched by F-NNN in \`findings/{this-scanner-dir}/{file}.md\`` line to the original finding

7. **Update coverage manifest**:
   - For each item scanned: set `status: scanned`, record `scanned_date` and `scanned_commit`
   - Set `findings_ref` to the findings file path
   - Recalculate `scanned_items` and `coverage_pct`

8. **Update navigation** (MANDATORY):
   - Every file path discovered during scanning → add to relevant `navigation/domains/*.md`
   - Every **repo name or integration pattern** discovered (a new collector, a push-client, a platform module the scanner touched) → update `navigation/architecture.md` so future Gate 9 verifications can resolve the repo in O(1) without a fresh WebFetch
   - This is a core output, not optional bookkeeping

9. **Update progress** — Edit `state/PROGRESS.md`:
   - If scanner is now 100% covered, mark as completed

10. **Report**:
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
- If you find a bug in target code, note it in findings but do NOT fix it. If the defect is clearly actionable upstream (concrete file:line, operator-visible failure mode, suggested fix obvious), the triager who picks up this scan will draft it as an `issues/{repo}/{PREFIX}-NNN.md` upstream issue (see `issues/README.md` and `/log-issue`); record enough detail in the finding (`file:line`, severity, repro shape) that the triager doesn't have to re-read the code.
- If an item can't be scanned (file missing, access issue), mark status as `error` with note