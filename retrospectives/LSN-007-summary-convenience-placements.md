---
id: LSN-007
title: SUMMARY.md hierarchy accumulated convenience-placements that flattened conceptually-nested topics to top-level peers
date: 2026-04-30
domain: documentation
severity: medium
gates_informed:
  - cornerstone-2-aspect-deep-dive-hierarchy-depth
  - gate-7-ia-hierarchy-sanity
status: closed
---

# LSN-007: SUMMARY.md hierarchy accumulated convenience-placements that flattened conceptually-nested topics to top-level peers

## What happened

On 2026-04-30, an audit of `SUMMARY.md` surfaced multiple pages placed at the wrong depth in the navigation tree. Three concrete cases:

- `Directory` placed as a top-level peer of `Main Concepts` and `Features`. Conceptually, the Directory is a Data Discovery sub-feature; it should nest under a Data Discovery pillar landing (a sibling of `Data Modelling` and `Master Data Management`).
- `GenAI assistant` placed as a top-level peer of `Features`. Conceptually, GenAI is one of several active platform features (Alerting, Notifications, Activity Feed, Data Collaboration); these belong under a shared parent landing, not as scattered top-level entries.
- `Build a custom collector` placed as a sibling of the `Build and run` group. Conceptually, both are build-side developer tasks; "Build a custom collector" should nest inside the same parent group as the `Build and run` children, not next to the parent.

Each placement was locally well-executed: the page itself was good, its content was correct, and "next to a similar-feeling page" felt close enough at authoring time. Globally, the hierarchy no longer reflected conceptual depth — top-level claims peer status with primary navigation pillars, and these pages did not warrant that claim.

## Why it slipped

Each authoring session asked "where does this page slot in?" in isolation rather than walking the global SUMMARY taxonomy. The Quality Bar at the time covered the existence of a SUMMARY entry (Gate 7 — layout completeness) but not its **depth correctness** — whether peers at the chosen depth were conceptual peers, whether the chosen parent was the conceptually broadest reasonable one, whether the page was being placed *next to* a parent group rather than *inside* it. Convenience-placements ("there's no clean parent today, this slot felt close") were treated as acceptable because no rule said otherwise.

## Rule that emerged

**Cornerstone 2 — hierarchy depth must reflect conceptual depth.** SUMMARY.md is not a flat list — every entry's depth is a claim. Two pages at the same depth must be conceptual peers (not "one is a parent group with subpages and the other is a sibling of the parent"). Before adding any new SUMMARY entry, walk the conceptual tree: what is this page conceptually about, which existing top-level entry or pillar landing is the conceptual parent, if a parent exists in SUMMARY nest under it, if a parent exists conceptually but not yet in SUMMARY propose adding the parent landing first. Default to nesting under an existing thematic parent rather than adding a new top-level entry. **Gate 7 — IA hierarchy sanity** at review time. **FAIL** on convenience-placements. Both rules live in `CLAUDE.md` (Cornerstone 2 + Gate 7); Phase 3 of the architecture refactor moves them into `pillars/documentation/cornerstones.md` and `pillars/documentation/gates.md`. DOC-082 was logged as the IA refactor item to nest the three pages above under their proper parents.

## Forcing question

Walk the SUMMARY tree from root: at the depth this page is being placed, are its siblings conceptual peers, and is its parent the conceptually broadest reasonable one — or am I placing this next to a similar-feeling page because no clean parent was identified?

## References

- `documentation/SUMMARY.md` (the file containing the convenience-placements)
- Backlog item: `backlog/docs/DOC-082.md` (IA refactor)
- Related: LSN-006 (the sibling 2026-04-30 finding — content-type homing on feature pages; same root cause: local optimization without holding the global picture)