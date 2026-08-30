---
name: LSN-041-release-gate-under-flip-and-detector-scope
title: A release gate that runs its checks but under-completes the close-out leaves silent multi-month ledger drift — and the detectors that should catch it were scoped to the wrong directories.
gates: [release-review, release-train-merge, status-detectors, contributor-bookkeeping]
date: 2026-08-30
---

# LSN-041 — The close-out is the gate, not a postscript

**Context.** After an 8-week pause the workspace ledger was reconciled against upstream truth. The
expensive parts of the methodology had all run correctly; what had failed was the cheap part at the end.
Three instances of one class:

1. **0.28.0** — reviewed 2026-06-18 (the review that *produced* `LSN-037` and generalised
   `playbooks/release-review.md`). It flipped **0 of its 37 items** and left **no release record**. Ten
   weeks later every 0.28.0 item was still open, including 13 doc items whose content had been live and
   correct on `docs.opendatadiscovery.org` the entire time.
2. **0.29.0** — reviewed 2026-06-26, thorough and well-evidenced: full suite on the published ghcr image,
   real-instance verification, ontology refresh, 23 items closed. But its delta summary described PRs
   #1790–#1797 as "maintainer-direct", and so **CTRIB-022..027 were never flipped** although all six PRs
   sit inside the released delta and their doc items were live-verified `done` in that same pass.
3. **CTRIB-052..059** — nine merged bot PRs (#1852–#1860) plus one open draft shipped the #1825 search
   epic with **no workspace record at all**.

**Why it survived for 10 weeks.** `playbooks/release-review.md` already names the detector — "*a closed
milestone has `pending-release` backlog items*" — and both `/status` and `/orient` implement it. But both
derived the manifest from **`grep -rl 'milestone:' backlog/`**, and `contributor/` was never in scope.
**22 of the 23 stale items were CTRIB records**, so the detector was structurally blind to the largest
producer of release-gated work. Instance 3 had no detector at all: nothing reconciled merged upstream PRs
against workspace records, so unbooked work was undetectable by construction.

## The rule

- **A gate is not finished when its checks pass; it is finished when every item it covers carries a
  verdict.** A release review that cannot flip an item must record *per item* why not (as the 0.28.0 GHSA
  four legitimately are: held on advisory disclosure). Silence is not a verdict.
- **The release record is the receipt.** A release with no `## Release record — {repo} {version}` heading in
  `state/PROGRESS.md` did not complete, whatever was run. Check for the heading before trusting the gate.
- **A detector must cover every producer of the thing it detects.** Scope `backlog/` **and** `contributor/`
  (fixed in `/status` + `/orient` alongside this file).
- **Reconcile in both directions.** Ledger→upstream catches stale statuses; **upstream→ledger** catches work
  that was never booked. Only the second would have found CTRIB-052..059. Added to `/status` as the reverse
  check: diff bot PR head branches (`contrib/CTRIB-NNN-*`) against `contributor/CTRIB-*.md`.
- **A superseded release does not need its own pinned suite re-run.** When `{version}` has already been
  superseded, satisfy checks 2+3 from the successor's published-artifact run (it contains the older code and
  is what operators run) and **say so explicitly in the record**. Re-pinning a suite to an image nobody runs
  is churn wearing the costume of rigour; silently skipping it is worse.

## How to apply

- `/review release:{version}` — check 7 is not optional and not "bookkeeping". Enumerate the manifest from
  `backlog/` **and** `contributor/`, and end with per-item verdicts + the release record.
- `/status`, `/orient` — the release-train check and the reverse unbooked-PR check both run in scope.
- When a pause exceeds a release cycle, reconcile **before** starting new work: upstream is the source of
  truth for what shipped; the ledger is only a claim about it.
