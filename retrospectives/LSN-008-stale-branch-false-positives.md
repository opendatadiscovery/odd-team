---
id: LSN-008
title: Scans against stale local branches produced false positives because GitBook commits land directly on origin/main
date: 2026-04-22
domain: documentation
severity: medium
gates_informed:
  - fetch-checkout-origin-main-before-scan
  - scanner-protocol-readme
status: closed
---

# LSN-008: Scans against stale local branches produced false positives because GitBook commits land directly on origin/main

## What happened

On 2026-04-22, a re-verification sweep over already-closed `done` items found two false positives and four scope narrowings. Root cause: scans had run against local branches in `../documentation` that lagged `origin/main` by several `[GITBOOK-NN]` commits. GitBook's web editor commits directly to `main`; any local branch that hasn't been refreshed misses those commits. The scanner protocol at the time did not require a fetch + checkout before scanning, so an older local snapshot of the docs tree generated findings that were already addressed on `main`. Implementers and reviewers acted on those findings, producing changes that either contradicted current `main` or duplicated existing fixes. The 2026-04-22 sweep also surfaced LSN-004 (the S2S fallback-cache incident).

## Why it slipped

The scanner protocol was treated as "read the relevant files" without specifying *which version* of those files. Local branches felt authoritative because they were what the editor opened. The build pipeline did not surface a "your branch is N commits behind origin/main" warning. GitBook's commit cadence (web editor → direct push to `main`) was not encoded as a known constraint that scanners had to handle.

## Rule that emerged

**Fetch + checkout `origin/main` of the documentation repo before scanning or authoring.** The rule lives in `scanners/README.md` and in `CLAUDE.md` "Documentation Authoring Rules". It applies to any session whose target repo is `documentation` — `/scan`, `/implement`, `/review` all run a fresh fetch first. A skipped fetch is a process-level finding; an item authored against a stale branch reopens as `blocked` until verified against current `origin/main`. Phase 3 of the architecture refactor moves the rule into `pillars/documentation/authoring.md`.

## Forcing question

Is `../documentation` currently checked out to `origin/main` with no commits behind, *as of right now* — or am I reading a snapshot that GitBook has already moved past?

## References

- `scanners/README.md` (the scan-protocol home)
- `state/PROGRESS.md` 2026-04-22 stale-branch re-verification sweep section
- Related: LSN-004 (the S2S fallback-cache incident surfaced by the same sweep)