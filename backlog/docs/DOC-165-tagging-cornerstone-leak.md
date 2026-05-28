---
id: DOC-165
title: "tagging.md: rewrite the 'Cornerstone 5 holds' sentence in operator language (Gate 11 / LSN-026 first-found leak)"
category: docs
target_repo: documentation
status: done
priority: medium
affected_files:
  - documentation/docs/data-discovery/tagging.md (line 56 — the one sentence to rewrite)
depends_on: []
blocks: []
estimated_effort: small
scanner_source: "Gate 11 banned-term grep (rev 11 / LSN-026 case-law); first-found leak on 2026-05-27"
found_date: "2026-05-27"
---

## Description

The live page at `docs.opendatadiscovery.org/features/data-discovery/tagging` (source: `documentation/docs/data-discovery/tagging.md:56`) carries one sentence that references the workspace's internal documentation principle:

> *"Cornerstone 5 holds — two surfaces for two distinct content types: Management → Tags is the operator-mutating canonical home for the vocabulary; this page is the read-side canonical home for applying and finding by tags."*

"Cornerstone 5" is defined in `pillars/documentation/cornerstones.md` — an internal workspace artefact the reader has no access to. The sentence reads as the maintainer talking to themselves through the doc; the operator landing on this page from a search hit has no source-of-definition and either skims past, pauses with confusion, or concludes the docs aren't talking to them.

Full case-law: `retrospectives/LSN-026-workspace-vocabulary-leaked-to-published-doc.md`.

Per Gate 11 (`pillars/documentation/gates.md`): every banned-term hit is rewritten in operator language (naming the underlying user-observable concept directly), deleted (often the right call), or moved to an internal artefact.

For this sentence, the underlying user-observable concept is: **two pages cover tags from two different user actions** — finding/applying (this page) vs creating/editing the tag vocabulary (Management → Tags). That's the operator-facing fact; the rewrite states it directly without naming the methodology principle that drove the structural choice.

## Acceptance criteria

- [ ] `documentation/docs/data-discovery/tagging.md:56` no longer contains the string `Cornerstone 5`.
- [ ] The sentence has been **rewritten in operator language** stating the same user-observable fact: two pages cover tags from two different user actions (finding/applying here; creating/editing under Management → Tags). The cross-link to Management → Tags is preserved (one-way, per Cornerstone 2 hierarchy direction — but the rewrite does not mention "Cornerstone 2").
- [ ] Gate 11 banned-term grep returns zero hits on `tagging.md` after the change:
  ```bash
  grep -nE 'Cornerstone [0-9]+|Gate [0-9]+|\bLSN-[0-9]+\b|\bSHB-[0-9]+\b|\bREFACTOR-[0-9]+\b|feature-flow-builder|feature-reflector|doc-gap-finder|concept-merger|odd-sme|adr-archaeologist|Stress Protocol|Quality Bar|Pre-authoring stance' ../documentation/docs/data-discovery/tagging.md
  ```
- [ ] Whole-tree grep (`../documentation/docs/`) returns zero hits on the banned-term registry after the change (verifies no other leak exists at commit time; LSN-026 also notes this is the only known leak as of 2026-05-27).
- [ ] Live-site verification post-merge: WebFetch `https://docs.opendatadiscovery.org/features/data-discovery/tagging` and confirm the new sentence is rendered correctly + the cross-link to Management → Tags resolves.

## Suggested rewrite

(One concrete option; the author has final say.)

> *"Tags appear in two places, each for a different user action. This page covers **applying tags to entities and finding entities by tag**. The **Management → Tags** page is where operators **create and edit the tag vocabulary itself** (renaming, deleting, marking tags as 'important' for higher list ordering). Apply and find by tags here; manage the catalog of tags there."*

The rewrite states the same user-observable fact (two pages, two user actions, one is read-side and one is mutating) without naming any internal principle. The reader gets the operator distinction directly; they do not need to know what a "Cornerstone" is, or why the maintainer's docs-structure rule produced two pages, to use either of them.

## Context

This is the **first-found leak** under the new Gate 11 (`pillars/documentation/gates.md`, added 2026-05-27 in the same PR as this backlog item). The case-law is `retrospectives/LSN-026-workspace-vocabulary-leaked-to-published-doc.md`. The gap that allowed the leak to ship: the editorial-read stance (mandatory on every `/review`) is a quality stance, not a banned-term grep — single-sentence leaks slip past on long reads. Gate 11 is the mechanical complement; this backlog item proves the rule fires.

Subsequent leaks (future commits) get the same DOC-NNN shape with `scanner_source: "Gate 11 banned-term grep"`. The `retrospectives/LSN-026` reference is the case-law anchor for the class; per-instance backlog items don't need to re-narrate the why.

## Review (2026-05-28, session: doc-review-sweep — iter 18)

- **Result**: ACCEPTED — all 11 gates PASS for DOC-165 (commit ed61136).
- **Code verification highlights**: The LSN-026 "Cornerstone 5 holds" leak on tagging.md:56 is GONE; replaced with operator-facing "Tags appear in two places, each for a different user action" — VERIFIED via WebFetch + grep on current tagging.md returns 0 banned-term hits.
- **Live site**: VERIFIED via WebFetch 2026-05-28 — operator-language rewrite is live; cross-link to Management → Tags preserved.
- **Gate 11**: 0 strict hits on tagging.md (the leak is fixed); diff's commit-message and removed-line references to "Cornerstone 5" are workspace-internal/removal contexts, not new published-content leaks.
- **Notes**: flipping `review-ready` → `done`. This item is the canonical Gate 11 mechanical-grep success case — the leak that LSN-026 caught is now closed.
