---
id: LSN-012
title: Well-intentioned cornerstone codified the wrong pattern; same-day course-correction required after user feedback on the resulting doc
date: 2026-05-07
domain: documentation
severity: medium
gates_informed:
  - cornerstone-2-aspect-deep-dive-bucket-attribution
  - gate-7-ia-hierarchy-sanity
  - pre-authoring-stance-check
status: closed
---

# LSN-012: Well-intentioned cornerstone codified the wrong pattern; same-day course-correction required after user feedback on the resulting doc

## What happened

On 2026-05-07 morning, commit `62a5011` ("state: cornerstone rule — every feature attributes to exactly one bucket") added a new sub-rule to `pillars/documentation/cornerstones.md` Cornerstone 2. The rule was sound on three of its four parts (no orphans / eight buckets / cross-cutting features pick a primary), but the fourth part endorsed an *"Other {bucket} features" sub-list* pattern: when a feature lived inline on `Features.md` rather than on a dedicated detail page, the bucket landing was instructed to index it via reverse-links to `Features.md` anchors. Within the same day, sibling work on the documentation repo applied the rule: PR #66 (`feature/docs-feature-bucket-attribution-2026-05-07`, commit `531d093`) shipped a `## Other Data Discovery features` H2 on `data-discovery.md` (L22-35) with 10 reverse-link bullets. Combined with the IA-refactor batch (PR #65) that landed earlier in the day, the doc tree carried 22 reverse-link instances across 5 files (`data-discovery.md` + 4 detail pages — `data-discovery/{search,tagging,groups-domains}.md`, `data-lineage/data-objects.md`). The user flagged the inversion verbatim during `/review batch:feature/state-doc141-ia-refactor-2026-05-07` (2026-05-07 afternoon): *"Features/Overview is an index of all the features … it should have links to the detailed explanations of the features in the dedicated sections — not vice versa where we have references for index from some dedicated pages — this is crazy and stupid."* The cornerstone update had given implementers documented cover to ship the wrong shape.

## Why it slipped

The cornerstone rule was reasonable on paper: the bucket landing should index its features, so if some features live inline on `Features.md`, link to those anchors so the bucket landing doesn't require grepping `Features.md`. What the rule missed is that this inverts the index/detail relationship at the doc-product level — `Features.md` is the index (Cornerstone 1's first-time-reader surface), and detail surfaces below it MUST NOT treat the index as a peer page or a content home. The maintainer drafting the cornerstone ran the existing Pre-authoring stance check on the cornerstone change itself, but the questions are scoped to authoring a doc page; they do not directly catch a *framework rule* that endorses a wrong shape. The validation step that did catch it was the user reading the resulting doc — i.e., the framework had no internal way to detect that a codification entrenched a defect; only the doc-product output (and a careful operator) could expose it.

## Rule that emerged

`pillars/documentation/cornerstones.md` Cornerstone 2 was updated (DOC-150, this commit) to: (a) replace the second bullet's "Other {bucket} features sub-list" clause with a "homes the feature" rule that routes every inline-on-`Features.md` feature to its bucket landing (as inline content) or to a dedicated detail page; (b) state explicitly that `Features.md` is the **index** and cross-link direction is one-way (`Features.md` → detail; never the reverse); (c) name the migration corollary so future implementers reach for content-migration rather than reverse-linking when a feature lives inline on `Features.md`. `pillars/documentation/canonical-homes.md` L18 and `pillars/documentation/gates.md` Pre-authoring Q3 carry the same one-way-direction clarifier. DOC-149 carries the doc-side cleanup of the 22 reverse-link instances. The deeper meta-rule for case-law: **a framework rule (cornerstone, playbook, gate) is not validated until the doc product produced under it is read end-to-end by a Principal-stance reader.** The `/review` editorial audit (`playbooks/doc-product-editorial-read.md`) is the validation surface; LSN-011 already named that the doc product's coherence is not self-detecting from per-item gates, and this incident generalises the lesson to *framework-level rules* whose downstream output also requires editorial validation.

## Forcing question

When codifying a new framework rule that prescribes link direction, content placement, or cross-page structure, ask: *if I apply this rule literally on the next two authoring sessions, what shape does the doc product take, and does that shape preserve the index/detail and discoverability invariants the existing cornerstones already protect?*

## References

- `pillars/documentation/cornerstones.md` Cornerstone 2 (the cornerstone updated in this commit; pre-update text at commit `62a5011`)
- `pillars/documentation/canonical-homes.md` L18 (one-way direction clarifier)
- `pillars/documentation/gates.md` Pre-authoring stance check Q3 (one-way direction clarifier)
- `backlog/docs/DOC-150.md` (this cornerstone update)
- `backlog/docs/DOC-149.md` (doc-side cleanup of 22 reverse-link instances)
- `backlog/docs/DOC-141.md` … `backlog/docs/DOC-145.md` (review-ready items blocked on the Gate 7 IA finding until DOC-149 ships)
- documentation repo PR #66 (`feature/docs-feature-bucket-attribution-2026-05-07`, commit `531d093`) — the batch that applied the deprecated rule
- documentation repo PR #65 (`feature/docs-ia-refactor-pillars-2026-05-07`) — the carve-out batch whose detail pages carried 11 of the reverse-link instances
- Related: `LSN-011-doc-product-coherence-not-self-detecting.md` — the broader pattern (doc product's coherence requires editorial-read validation; per-item gates do not see the global picture)
- Related: `LSN-007-summary-convenience-placements.md` — adjacent IA-cornerstone failure mode (placement at wrong depth); same Cornerstone 2 jurisdiction
