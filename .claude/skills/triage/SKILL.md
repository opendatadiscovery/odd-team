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

2.5. **Look up the scanner-feed log** *(rev 13)*:
   - Derive the scan_run_id from the findings file path. The matching scanner-feed log lives at `lineage/{substrate_repo}/scanner-feed/{YYYY-MM-DD}-{scan_run_id}.yaml`.
   - **If the log exists** (mode-B scan-run produced it): load it. The log carries `clues_consumed[]`, `agent_consultations`, `write_backs`, `warnings`, and the per-finding `findings_produced` cross-reference.
   - **If no log exists**: the findings came from a mode-A standalone scan; no ontology-corroboration data is available. Proceed with normal triage.
   - **If `verification_class: corroboration-only`**: the scan-run did NOT iterate the feature catalog independently (Rule 21 D13 violation). Flag this in the triage report and recommend a re-run; findings can still be triaged but their coverage is suspect.

3. **Triage each finding** — For each, decide:
   - **Actionable?** — Reject false positives with brief explanation
   - **Work we do here, or a handoff to upstream?** — This is the first split:
     - **Work we do here** → backlog item under `backlog/{cat}/{ID}.md` (continue with the fields below).
     - **Handoff to upstream** (the fix lives in a repo we don't directly maintain in this workspace — Java in `odd-platform`, Python in `odd-collectors`, schema in the spec, Helm in `charts`, etc.) → instead of a backlog item, draft a paste-ready GitHub issue at `issues/{repo}/{PREFIX}-NNN.md` via `/log-issue {repo} "title"` (see `issues/README.md` for prefixes). A single finding can produce both — e.g., a missing doc caveat (backlog) **plus** an upstream code fix (issue draft); link them both ways.
   - **Category** (for backlog items) — DOC (documentation), TST (test), NAV (navigation), SPC (specification)
   - **Issue type** (for issue drafts) — bug | feature | adjustment; bugs also need `severity`
   - **Granularity** — One work item / one issue draft per logical change (split complex findings, merge trivial ones)
   - **Priority** — critical (wrong info) > high (missing tests for fragile code) > medium (gaps) > low (cosmetic). **Rev-13 ontology-corroboration lift**: if the scanner-feed log lists this finding's `findings_produced` against an ontology clue source AND the clue is either `feature-flow` or `doc-gap` corroboration, lift the priority by ONE tier (medium → high, high → critical). Two independent signals (ontology AND scanner) flagging the same gap is published-mistake risk per CLAUDE.md's "wrong docs > missing docs" priority bar. Concept-source clues (non-canonical-term) default to `medium`; shoebox-source clues inherit the shoebox thread's severity.
   - **Affected files** — Which files will be created/modified? (For issue drafts: cite upstream `file:line` in the body, not affected_files in this workspace.)
   - **Dependencies** — Does this item require another to complete first?
   - **Effort** — small (<30min), medium (30-90min), large (>90min) — for backlog items only; issue drafts have no in-workspace effort once the body is written.

4. **Create work items** — Write to `backlog/{category}/{ID}.md`:
   - Follow format exactly from `backlog/README.md`
   - Write testable acceptance criteria (not vague goals)
   - Include scanner source and found date
   - **For findings sourced from ontology clues** (rev 13): include `ontology_source:` in the backlog item's Context section — e.g. `ontology_source: feature-flow F-007 (Source: Ontology[F-007:hop-2] → Repo[AlertManagerController.java:24-31])`. This back-links the work item to the F-NNN it came from, so when the doc PR ships, the maintainer can flip the F-NNN's `doc_status:` field from `backlog` → `drafted` → `live`.

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