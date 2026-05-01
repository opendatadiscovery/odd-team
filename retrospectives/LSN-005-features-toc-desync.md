---
id: LSN-005
title: DOC-069 added a Custom navigation links H2 to Features.md without the matching in-page TOC row
date: 2026-04-27
domain: documentation
severity: medium
gates_informed:
  - gate-7-layout-completeness
  - in-page-toc-h2-sync
status: closed
---

# LSN-005: DOC-069 added a Custom navigation links H2 to Features.md without the matching in-page TOC row

## What happened

On 2026-04-27, DOC-069 added a `## Custom navigation links` H2 section to `docs/Features.md`. The page carries an in-page Table of Contents at the top (lines 3-29 at the time) — a list of links to every H2 anchor on the page, conventional across the entire Features landing. The new H2 shipped without the matching TOC row. The new section was discoverable only by scrolling past the TOC; readers who used the TOC as the page's navigation map missed it entirely. The gap was caught post-merge by the user. DOC-076 was logged to backfill the TOC row and to encode the rule.

## Why it slipped

The implementer touched the H2 sections on the page but did not look at the top of the file. The in-page TOC is a content artefact (a list of links), not metadata; nothing in the build tooling enforced a relationship between H2s and the TOC list. The Quality Bar at the time covered SUMMARY.md sync (page-level navigation) but not in-page TOC sync (within-page navigation). "Detection signal" — the presence of a top-of-page TOC — was not encoded as a thing reviewers should look for.

## Rule that emerged

**Gate 7 — Layout and completeness — extension: in-page TOC stays synchronized with H2s in the same commit.** Pages that carry an in-page TOC at the top (canonical example: `docs/Features.md`) must update the TOC row in the same commit that adds, renames, or removes an H2. Detection signal: read the top ~30 lines of the page being touched; if you see a sequence of `[Title](path.md#anchor)` lines, that is the TOC. The rule lives in `CLAUDE.md` "Documentation Authoring Rules" and is enforced under Gate 7; Phase 3 of the architecture refactor moves it into `pillars/documentation/authoring.md`.

## Forcing question

Does this page have an in-page TOC at the top, and if it does, does my change leave the TOC consistent with the H2s it indexes?

## References

- `docs/Features.md` (lines 3-29 at the time of incident — the canonical in-page TOC example)
- Backlog item: `backlog/docs/DOC-069.md` (originating change), `backlog/docs/DOC-076.md` (rule-encoding follow-up)
- Related: LSN-007 (a sibling layout-sync failure at the SUMMARY.md hierarchy level)