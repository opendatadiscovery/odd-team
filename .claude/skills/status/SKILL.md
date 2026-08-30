---
name: status
description: Show current progress of the audit and implementation system — scanner completion, backlog counts, blockers.
allowed-tools: Read Grep Glob Bash(ls *) Bash(find *) Bash(wc *) Bash(git *) Bash(curl *)
---

# System Status

Show the current state of the ODD Team maintenance system.

## Protocol

1. Read `state/PROGRESS.md` and display its contents
2. Count actual files to verify accuracy:
   - Scanner completion: check `findings/` for output from each scanner
   - Backlog counts: count files in `backlog/{category}/` by status (grep frontmatter)
   - Navigation coverage: count domain files with vs. without populated code entry points
3. If counts don't match PROGRESS.md, update it
4. **Release trains** (`adrs/drafts/release-train-doc-gating.md`) — derive, never from a state file:
   - open trains: `grep -rl 'milestone:' backlog/ contributor/` grouped by version × status (**`contributor/` is not optional** — CTRIB items are the largest producer of release-gated work; a `backlog/`-only grep hid 22 stale items for 10 weeks, LSN-041) + `git -C ../documentation branch -r --list 'origin/release/*'`
   - when network allows: `curl -s https://api.github.com/repos/opendatadiscovery/odd-platform/releases/latest` + `.../milestones?state=open`
   - **reverse check (LSN-041)** — merged upstream work with no workspace record: `GET /search/issues?q=repo:opendatadiscovery/odd-platform+author:app/odd-contributor+type:pr` and diff the head branches (`contrib/CTRIB-NNN-*`) against `ls contributor/CTRIB-*.md`. A merged PR with no record is invisible work; book it before anything else.
   - a published release with a still-existing train, or a closed milestone with `pending-release` items → **Next action = the release gate** (`/implement release:{version}`, then post-merge `/review release:{version}` — `playbooks/release-train-merge.md`)
5. Report:
   - Overall phase (audit / triage / implementation / review)
   - What's been done
   - What's next (highest priority pending scanner or work item)
   - Any blockers or stale items

## Quick View Format

```
Phase: {current phase}
Scanners: {done}/{total} complete
Backlog: {total} items ({critical} critical, {high} high, {medium} medium, {low} low)
In Progress: {count} items
Done: {count} items
Release trains: {version}: {n} pending-release / {m} in-flight | none open
Navigation: {populated}/{total} domains have code pointers

Next action: {recommended next step}
```