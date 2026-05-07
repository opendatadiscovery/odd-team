---
id: LSN-013
title: ADR draft punted technical decisions as "open questions for human review" instead of doing the research
date: 2026-05-08
domain: documentation (cross-pillar — applies to any phase that authors proposals)
severity: medium
gates_informed:
  - playbooks/deep-research.md (the rule that emerged)
  - feedback_research_dont_punt.md (auto-memory)
  - feedback_laser_focus_velocity.md (related — same family)
status: closed
---

# LSN-013: Research-punt on the lineage substrate draft

## What happened

On 2026-05-08, while drafting `adrs/drafts/code-lineage-substrate.md` (the proposal that emerged from the i18n undocumented-features miss earlier the same day), the implementer authored a 270-line ADR that ended with a section titled "Open questions for human review" listing **eight technical decisions**: granularity (file/class/function), extractor toolchain (tree-sitter/SCIP/roll-our-own), edge taxonomy MVP, storage format, navigation migration shape, MVP axis set, phase sequencing, and whether to ship the parallel cheap patch immediately. Each entry had a "non-binding recommendation" and a "why open" note. The implementer framed the list as "tooling/granularity choices, not architectural ones," intending it as helpful preparation for human review.

The user's response, verbatim: *"Why are you relying on my review? Take an action for the research? Are you aware about the https://github.com/gsd-build/get-shit-done? Could you take the example of its researchers and run a deep research on how to create such lineage..."*

Within the same session, a research pass produced five artefacts in `adrs/drafts/research/code-lineage-substrate/` (STACK / SCHEMA / DOC-LINKAGE / PITFALLS / SUMMARY) using the gsd-build parallel-researcher pattern. All eight "open questions" were resolved into firm recommendations with HIGH/MEDIUM/LOW confidence levels and source citations. The ADR shipped as revision 2 with the open-questions section reduced to a single binary call (adopt/defer/reject the substrate itself).

## Why it slipped

Two reasons, both about scope of authorship rather than knowledge gap:

1. **Implementer mistook "list options for review" for "make decisions transparent."** The intent — surfacing the trade-off space so the maintainer could choose — looked principled. In practice, every technical decision in the list was tractable via `WebSearch` + `WebFetch` + reading `documentation/docs/SUMMARY.md`. The information was free; the implementer chose not to fetch it. The "open question" framing was scaffolding, not decision-making.
2. **Velocity bias was applied at one level but not the level above.** `feedback_laser_focus_velocity.md` already says "don't loop on options the user already approved at the ADR level." The implementer was thinking *inside* the ADR (don't punt Phase B trade-offs already enumerated in the ADR's risk section), not *at* the ADR (don't author an ADR that itself punts). The same family of decision-pushing failure, one level higher in the stack.

The workspace's velocity discipline lives in CLAUDE.md ("when in doubt, ship") and in scattered case-law (`feedback_laser_focus_velocity`, the DOC-138 Phase B example). It did not yet live in an executable protocol that fires *while authoring proposals*. So the discipline applied retroactively (the user noticed and corrected) rather than at-the-keyboard.

## Rule that emerged

`playbooks/deep-research.md` — codifies the gsd-build/get-shit-done parallel-researcher pattern as a workspace protocol. Fires on four trigger conditions, one of which is the explicit "I'm about to write 'open questions for human review' listing technical choices" signal. Procedure: decompose into 3-5 parallel research threads (STACK / SCHEMA / DOC-LINKAGE / PITFALLS / PROBES / SUMMARY artefacts in `adrs/drafts/research/{slug}/`), run them in parallel via `WebFetch`/`WebSearch`, synthesize into `SUMMARY.md` with HIGH/MEDIUM/LOW confidence per decision, fold recommendations back into the originating proposal. Exit criterion: the proposal ends with a single binary call (adopt/defer/reject), not a list of technical sub-questions.

CLAUDE.md gains a one-line pointer to the playbook in the ADR section.

`feedback_research_dont_punt.md` (auto-memory) carries the same rule for solo session memory — invoked every time the implementer is about to draft a proposal.

## Forcing question

Before adding "open questions for human review" to a draft: *"Could I answer this with a WebSearch, a WebFetch, or by reading a workspace file? If yes, the question is mine to resolve — not the maintainer's."*

## References

- File:line evidence:
  - `adrs/drafts/code-lineage-substrate.md` revision 1 (initial draft) — the eight-question section that triggered the pushback. Revision 2 (research-backed) is what shipped.
  - `adrs/drafts/research/code-lineage-substrate/{STACK,SCHEMA,DOC-LINKAGE,PITFALLS,PROBES,SUMMARY}.md` — the artefacts the research-pass produced.
- Originating thread: 2026-05-08 conversation in this workspace (i18n probe → substrate ADR → research-punt → revision 2).
- Related LSN entries: none directly; this is the first LSN on proposal-authorship discipline.
- Related auto-memory: `feedback_research_dont_punt.md`, `feedback_laser_focus_velocity.md`.
- Related playbook: `playbooks/deep-research.md` (the rule that emerged).
